"""
Traffic API routes.

Endpoint metric sources
-----------------------
  POST /ingest          → creates TrafficRecord; syncs topology edge (ingest-time only)
  POST /{id}/detect     → runs ML on existing record; updates detection fields
  GET  /packets-by-hour → uses telemetry_aggregation.build_telemetry_summary() for
                          consistent packet AND flow counts from a single source
  GET  /protocol-distribution → reads from TrafficRecord directly (packet SUM per protocol)
  GET  /health          → uses telemetry_aggregation for rolling-window metrics
  GET  /inventory-edges → reads persisted TopologyEdge rows ONLY (NO backfill on read)

Topology edge accumulation rules
---------------------------------
  - backfill_topology_from_traffic is NEVER called from GET endpoints
  - It is only called at ingest time (one record) via sync_edge_from_traffic_record
  - This prevents topology edge packet_counts from growing on every page load
  - Edge packet_counts are for visualization only; authoritative totals come from
    SUM(TrafficRecord.packet_count) via telemetry_aggregation

Packet vs flow vs telemetry records
-------------------------------------
  packet_count : SUM(TrafficRecord.packet_count) — actual network packets
  flow_count   : COUNT(TrafficRecord.id)         — ingested telemetry records
  alert_count  : COUNT(Alert.id)                 — ML-triggered security alerts
  These three metrics are distinct and must not be conflated in labels or queries.
"""

import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.models.alert import Alert
from app.models.device import Device
from app.models.model_version import ModelVersion
from app.models.topology_edge import TopologyEdge
from app.models.traffic_record import TrafficRecord
from app.models.user import User
from app.schemas.traffic import (
    DetectionResponse,
    ICSTrafficIn,
    InventoryEdgeResponse,
    PacketsByHourResponse,
    PacketsByHourRow,
    ProtocolDistributionResponse,
    ProtocolDistributionRow,
    TelemetryHealthResponse,
    TrafficRecordResponse,
)
from app.services.alerts import (
    make_alert_summary,
    severity_from_ml_alert_string,
    should_generate_alert_from_ml,
)
from app.services.device_linking import (
    mark_stale_devices_offline,
    resolve_device_id_for_flow,
    sync_device_after_detection,
    touch_device_last_traffic,
    resolve_stale_attacks_sweep,
)
from app.services.telemetry_aggregation import build_telemetry_summary
from app.services.topology import mark_stale_edges_inactive, sync_edge_from_traffic_record
from app.services.audit import record_audit
from app.services.ml_client import run_inference
from app.services.ml_infer_contract import validate_ml_infer_response
from app.services.tenant import get_accessible_tenant_ids
from app.db.session import get_db

router = APIRouter(prefix="/traffic", tags=["traffic"])
logger = logging.getLogger(__name__)


def _payload_from_record(record: TrafficRecord) -> dict:
    """
    Same fields as ml-service InferRequest; normalized so /infer maps to NetworkFlow
    (same shape as POST /predict: duration, sPackets, protocol, sAddress, ICS columns).
    """
    proto = (record.transport_protocol or "tcp").lower().strip()
    if proto not in ("tcp", "udp", "icmp"):
        proto = "tcp"

    def zint(v: int | None) -> int:
        return 0 if v is None else int(v)

    return {
        "packet_count": record.packet_count,
        "bytes_in": record.bytes_in,
        "bytes_out": record.bytes_out,
        "duration_ms": record.duration_ms,
        "payload_entropy": record.payload_entropy,
        "source_port": record.source_port,
        "destination_port": record.destination_port,
        "modbus_function_code": zint(record.modbus_function_code),
        "modbus_unit_id": zint(record.modbus_unit_id),
        "dnp3_function_code": zint(record.dnp3_function_code),
        "iec104_type_id": zint(record.iec104_type_id),
        "transport_protocol": proto,
        "source_ip": record.source_ip,
        "destination_ip": record.destination_ip,
    }


@router.post("/ingest", response_model=TrafficRecordResponse)
def ingest_traffic(
    payload: ICSTrafficIn,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("ingest_traffic")),
) -> TrafficRecordResponse:
    """
    Ingest a single ICS network flow as a TrafficRecord.

    This is the ONLY place where topology edges are synced at write time.
    sync_edge_from_traffic_record is called once per record with idempotency
    protection so repeated retries do not inflate edge packet_counts.
    """
    src_ip = str(payload.source_ip)
    dst_ip = str(payload.destination_ip)
    matched = resolve_device_id_for_flow(db, current_user.id, src_ip, dst_ip)

    record = TrafficRecord(
        user_id=current_user.id,
        source_ip=src_ip,
        destination_ip=dst_ip,
        source_port=payload.source_port,
        destination_port=payload.destination_port,
        transport_protocol=payload.transport_protocol,
        packet_count=payload.packet_count,
        bytes_in=payload.bytes_in,
        bytes_out=payload.bytes_out,
        duration_ms=payload.duration_ms,
        payload_entropy=payload.payload_entropy,
        modbus_function_code=payload.modbus_function_code,
        modbus_unit_id=payload.modbus_unit_id,
        dnp3_function_code=payload.dnp3_function_code,
        iec104_type_id=payload.iec104_type_id,
        ingestion_source=payload.ingestion_source,
        metadata_json=payload.metadata_json,
        device_id=matched,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    
    # Touch both source and destination devices if they exist in inventory
    active_devices = (
        db.query(Device)
        .filter(
            Device.user_id == current_user.id,
            Device.is_active.is_(True),
            Device.ip_address.in_([src_ip, dst_ip])
        )
        .all()
    )
    for dev in active_devices:
        touch_device_last_traffic(db, dev.id)

    # Sync topology edge for this single new record (idempotent — see topology._upsert_edge)
    # NOTE: backfill_topology_from_traffic is intentionally NOT called here.
    # Only this specific new record is sync'd to prevent historical re-accumulation.
    sync_edge_from_traffic_record(db, record)
    
    # CRITICAL: Commit touched device BEFORE sweep, so sweep reads fresh last_traffic_at
    db.commit()

    mark_stale_devices_offline(db, tenant_ids=[current_user.id])
    resolve_stale_attacks_sweep(db, tenant_ids=[current_user.id])
    mark_stale_edges_inactive(db, tenant_ids=[current_user.id])
    db.commit()
    
    return record


@router.post("/{record_id}/detect", response_model=DetectionResponse)
async def run_detection(
    record_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("run_detection")),
) -> DetectionResponse:
    actor_id = current_user.id
    query = db.query(TrafficRecord).filter(TrafficRecord.id == record_id)
    tenant_ids = get_accessible_tenant_ids(db, current_user)
    if tenant_ids is not None:
        query = query.filter(TrafficRecord.user_id.in_(tenant_ids))
    record = query.first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    if record.device_id is None and record.user_id is not None:
        record.device_id = resolve_device_id_for_flow(
            db,
            record.user_id,
            record.source_ip,
            record.destination_ip,
        )
        db.add(record)
        db.commit()

    ml_payload = _payload_from_record(record)
    db.close()

    raw = await run_inference(ml_payload)
    verdict = validate_ml_infer_response(dict(raw))

    query = db.query(TrafficRecord).filter(TrafficRecord.id == record_id)
    if tenant_ids is not None:
        query = query.filter(TrafficRecord.user_id.in_(tenant_ids))
    record = query.first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    active_model = (
        db.query(ModelVersion)
        .filter(ModelVersion.is_active.is_(True))
        .order_by(ModelVersion.created_at.desc())
        .first()
    )
    audit_actor = db.query(User).filter(User.id == actor_id).first()

    ml_status = str(verdict["ml_status"])
    alert_sev = str(verdict["alert_severity"])
    attack_detected = bool(verdict["attack_detected"])

    record.risk_score = verdict["risk_score"]
    record.ml_status = ml_status
    record.ml_alert_severity = alert_sev
    record.ml_attack_detected = attack_detected
    record.attack_class = str(verdict["attack_class"])
    record.confidence = float(verdict["confidence"])
    record.explanation_json = dict(verdict)

    if active_model:
        record.model_version_id = active_model.id

    evaluated_at = datetime.now(timezone.utc).replace(tzinfo=None)

    alert = None
    if should_generate_alert_from_ml(attack_detected):
        try:
            alert_orm_sev = severity_from_ml_alert_string(alert_sev)
        except ValueError as exc:
            raise HTTPException(
                status_code=503,
                detail=f"Invalid alert_severity from ML after validation: {exc}",
            ) from exc
        alert = Alert(
            traffic_record_id=record.id,
            severity=alert_orm_sev,
            summary=make_alert_summary(
                record.attack_class,
                ml_status,
                alert_sev,
                record.risk_score,
            ),
        )
        db.add(alert)

    try:
        db.add(record)
        sync_device_after_detection(
            db,
            record.device_id,
            traffic_id=record.id,
            risk_score=record.risk_score,
            ml_status=ml_status,
            evaluated_at=evaluated_at,
        )
        record_audit(
            db,
            action="traffic.detect",
            category="detection",
            actor=audit_actor,
            request=request,
            resource_type="traffic_record",
            resource_id=record.id,
            metadata={"attack_detected": attack_detected, "ml_status": ml_status},
        )
        # Sync topology edge for the updated record (idempotent — same record.id = no re-accumulation)
        sync_edge_from_traffic_record(db, record)
        mark_stale_devices_offline(
            db,
            tenant_ids=tenant_ids,
        )
        resolve_stale_attacks_sweep(db, tenant_ids=tenant_ids)
        mark_stale_edges_inactive(db, tenant_ids=tenant_ids)
        db.commit()
        
        if alert and alert.id:
            from app.tasks.notifications import send_alert_notification_task
            send_alert_notification_task.delay(alert.id)
    except Exception:
        db.rollback()
        raise

    response = DetectionResponse(
        record_id=record.id,
        risk_score=record.risk_score,
        ml_status=ml_status,
        alert_severity=alert_sev,
        attack_detected=attack_detected,
        device_id=record.device_id,
        attack_class=record.attack_class or "",
        confidence=record.confidence or 0.0,
        explanation=verdict["explanation"]
        if isinstance(verdict["explanation"], dict)
        else {},
        model_version=active_model.version if active_model else None,
    )
    return response


@router.get("/packets-by-hour", response_model=PacketsByHourResponse)
def packets_by_hour(
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("view_traffic")),
    tenant_id: int | None = Query(default=None),
) -> PacketsByHourResponse:
    """
    Return 24-hour traffic telemetry summary with explicit packet AND flow counts.

    Source: telemetry_aggregation.build_telemetry_summary() — the single source
    of truth for all packet/flow metrics. Calling this multiple times returns the
    same result for the same underlying data (pure read, no writes).

    Response fields
    ---------------
    packet_count_total : SUM(TrafficRecord.packet_count) over 24h — network packets
    flow_count_total   : COUNT(TrafficRecord.id) over 24h — telemetry records
    today_total        : DEPRECATED alias = packet_count_total (backward compat)
    avg_per_minute     : packet_count_total / actual elapsed minutes (not 24*60)
    rows               : per-hour breakdown with both packets and flow_count
    """
    tenant_ids = get_accessible_tenant_ids(db, current_user, tenant_id)

    summary = build_telemetry_summary(
        db,
        tenant_ids,
        source_endpoint="GET /traffic/packets-by-hour",
    )

    rows: list[PacketsByHourRow] = [
        PacketsByHourRow(
            hour=bucket["hour"],
            packets=bucket["packet_count"],
            flow_count=bucket["flow_count"],
            dominant_protocol=bucket["dominant_protocol"],
        )
        for bucket in summary["hourly_buckets"]
    ]

    # avg_per_minute: use total packets over actual elapsed time in the window.
    # Determine the oldest record's age to compute real elapsed minutes (max 24h*60).
    # If no records, avg is 0.
    packet_total = summary["packet_count_24h"]
    flow_total   = summary["flow_count_24h"]

    # Calculate elapsed minutes based on actual data range, capped at 24*60
    # This avoids the hardcoded 24*60 division that makes avg meaningless for fresh data
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    oldest_cutoff = now - timedelta(hours=24)
    elapsed_minutes = max(1, int((now - oldest_cutoff).total_seconds() / 60))
    avg_per_minute = int(packet_total / elapsed_minutes) if packet_total else 0

    peak_hour = summary["peak_hour"]

    logger.debug(
        "[packets_by_hour] endpoint=GET /traffic/packets-by-hour tenant_ids=%s "
        "packet_count_24h=%d flow_count_24h=%d avg_per_min=%d peak=%s rows=%d",
        tenant_ids, packet_total, flow_total, avg_per_minute, peak_hour, len(rows),
    )

    return PacketsByHourResponse(
        packet_count_total=packet_total,
        flow_count_total=flow_total,
        today_total=packet_total,   # DEPRECATED alias — same as packet_count_total
        avg_per_minute=avg_per_minute,
        peak_hour=peak_hour,
        rows=rows,
    )


@router.get("/protocol-distribution", response_model=ProtocolDistributionResponse)
def protocol_distribution(
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("view_traffic")),
    tenant_id: int | None = Query(default=None),
    window_hours: int = Query(24, ge=1, le=168),
) -> ProtocolDistributionResponse:
    """
    Return per-protocol packet distribution.

    packets per protocol = SUM(TrafficRecord.packet_count) for flows using that protocol.
    This is a network packet metric, NOT a flow count.
    """
    since = datetime.now(timezone.utc) - timedelta(hours=window_hours)
    query = db.query(TrafficRecord).filter(TrafficRecord.created_at >= since)
    tenant_ids = get_accessible_tenant_ids(db, current_user, tenant_id)
    if tenant_ids is not None:
        query = query.filter(TrafficRecord.user_id.in_(tenant_ids))

    # SUM of packet_count per ICS protocol category
    counts: dict[str, int] = {
        "Modbus TCP": 0,
        "DNP3": 0,
        "IEC104": 0,
        "Other": 0,
    }
    last_seen: dict[str, datetime | None] = {k: None for k in counts}

    for record in query.all():
        if record.modbus_function_code is not None:
            protocol = "Modbus TCP"
        elif record.dnp3_function_code is not None:
            protocol = "DNP3"
        elif record.iec104_type_id is not None:
            protocol = "IEC104"
        else:
            protocol = "Other"

        counts[protocol] += int(record.packet_count or 0)
        if record.created_at:
            seen = last_seen.get(protocol)
            if seen is None or record.created_at > seen:
                last_seen[protocol] = record.created_at

    total_packets = sum(counts.values())

    logger.debug(
        "[protocol_distribution] endpoint=GET /traffic/protocol-distribution "
        "tenant_ids=%s window_hours=%d total_packets=%d breakdown=%s",
        tenant_ids, window_hours, total_packets, counts,
    )

    rows = [
        ProtocolDistributionRow(
            protocol=protocol,
            packets=count,
            last_seen_at=last_seen.get(protocol),
        )
        for protocol, count in counts.items()
    ]
    rows.sort(key=lambda row: row.packets, reverse=True)

    return ProtocolDistributionResponse(
        window_hours=window_hours,
        total_packets=int(total_packets),
        protocols=rows,
    )


@router.get("/health", response_model=TelemetryHealthResponse)
def telemetry_health(
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("view_traffic")),
    tenant_id: int | None = Query(default=None),
) -> TelemetryHealthResponse:
    """
    Return rolling-window telemetry health metrics.

    Uses telemetry_aggregation.build_telemetry_summary() for consistent numbers.

    Packet metrics (SUM of actual network packets):
      packets_last_minute, packets_last_5min, packets_last_15min

    Flow metrics (COUNT of telemetry records):
      flow_count_last_minute, flow_count_last_5min, flow_count_last_15min

    Rate: avg_packets_per_minute_15m = packets_last_15min / 15 (not hardcoded 24*60)
    """
    tenant_ids = get_accessible_tenant_ids(db, current_user, tenant_id)

    summary = build_telemetry_summary(
        db,
        tenant_ids,
        source_endpoint="GET /traffic/health",
    )

    logger.debug(
        "[telemetry_health] endpoint=GET /traffic/health tenant_ids=%s "
        "pkts_15m=%d flows_15m=%d avg_pkt_per_min=%.1f last_seen=%s",
        tenant_ids,
        summary["packet_count_15min"],
        summary["flow_count_15min"],
        summary["avg_packets_per_minute_15m"],
        summary["last_traffic_at"],
    )

    return TelemetryHealthResponse(
        window_minutes=15,
        packets_last_minute=summary["packet_count_1min"],
        packets_last_5min=summary["packet_count_5min"],
        packets_last_15min=summary["packet_count_15min"],
        avg_packets_per_minute_15m=summary["avg_packets_per_minute_15m"],
        flow_count_last_minute=summary["flow_count_1min"],
        flow_count_last_5min=summary["flow_count_5min"],
        flow_count_last_15min=summary["flow_count_15min"],
        last_traffic_at=summary["last_traffic_at"],
        dropped_packets=None,
    )


@router.get("/inventory-edges", response_model=list[InventoryEdgeResponse])
def inventory_edges(
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("view_traffic")),
    tenant_id: int | None = Query(default=None),
    hours: int = Query(168, ge=1, le=720),
) -> list[InventoryEdgeResponse]:
    """
    Return aggregated flow edges between inventory device pairs.

    Source: persisted topology_edge rows with relationship_type = connected_to.

    IMPORTANT — topology backfill is NOT called from this GET endpoint.
    Calling backfill_topology_from_traffic on every read was the primary cause
    of edge packet_count inflation (it re-accumulated all historical packets on
    each page load). Topology edges are now only updated at ingest time.

    The packet_count returned per edge pair is the cumulative total accumulated
    at ingest time (idempotent per record via processed_record_ids tracking).
    """
    from app.models.topology_edge import TopologyRelationshipType
    from app.services.topology import edges_query_for_user

    tenant_ids = get_accessible_tenant_ids(db, current_user, tenant_id)

    # READ ONLY — no backfill, no writes, no side effects
    edges = (
        edges_query_for_user(db, current_user, tenant_id)
        .filter(TopologyEdge.relationship_type == TopologyRelationshipType.connected_to.value)
        .all()
    )

    pair_counts: dict[tuple[int, int], int] = defaultdict(int)
    for edge in edges:
        a, b = sorted((edge.source_device_id, edge.target_device_id))
        pair_counts[(a, b)] += int(edge.packet_count or 0)

    logger.debug(
        "[inventory_edges] endpoint=GET /traffic/inventory-edges tenant_ids=%s "
        "edge_pairs=%d hours_filter=%d",
        tenant_ids, len(pair_counts), hours,
    )

    return [
        InventoryEdgeResponse(device_a_id=a, device_b_id=b, packet_count=cnt)
        for (a, b), cnt in sorted(pair_counts.items(), key=lambda x: (-x[1], x[0][0], x[0][1]))
    ]

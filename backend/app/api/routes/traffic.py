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
)
from app.services.topology import mark_stale_edges_inactive, sync_edge_from_traffic_record
from app.services.audit import record_audit
from app.services.ml_client import run_inference
from app.services.ml_infer_contract import validate_ml_infer_response
from app.services.tenant import get_accessible_tenant_ids
from app.db.session import get_db

router = APIRouter(prefix="/traffic", tags=["traffic"])


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
    touch_device_last_traffic(db, matched)
    sync_edge_from_traffic_record(db, record)
    mark_stale_devices_offline(db, tenant_ids=[current_user.id])
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
        sync_edge_from_traffic_record(db, record)
        mark_stale_devices_offline(
            db,
            tenant_ids=tenant_ids,
        )
        mark_stale_edges_inactive(db, tenant_ids=tenant_ids)
        db.commit()
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
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    query = db.query(TrafficRecord).filter(TrafficRecord.created_at >= since)
    tenant_ids = get_accessible_tenant_ids(db, current_user, tenant_id)
    if tenant_ids is not None:
        query = query.filter(TrafficRecord.user_id.in_(tenant_ids))
    records = query.all()

    per_hour_packets: dict[str, int] = defaultdict(int)
    per_hour_protocols: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))

    for record in records:
        hour_key = record.created_at.strftime("%H:00")
        per_hour_packets[hour_key] += int(record.packet_count)
        protocol = record.transport_protocol.upper()
        per_hour_protocols[hour_key][protocol] += int(record.packet_count)

    rows: list[PacketsByHourRow] = []
    for hour in sorted(per_hour_packets.keys()):
        protocol_counts = per_hour_protocols[hour]
        dominant_protocol = max(protocol_counts, key=protocol_counts.get) if protocol_counts else "N/A"
        rows.append(PacketsByHourRow(hour=hour, packets=per_hour_packets[hour], dominant_protocol=dominant_protocol))

    today_total = sum(per_hour_packets.values())
    avg_per_minute = int(today_total / (24 * 60)) if today_total else 0
    peak_hour = max(per_hour_packets, key=per_hour_packets.get) if per_hour_packets else "N/A"

    return PacketsByHourResponse(
        today_total=today_total,
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
    since = datetime.now(timezone.utc) - timedelta(hours=window_hours)
    query = db.query(TrafficRecord).filter(TrafficRecord.created_at >= since)
    tenant_ids = get_accessible_tenant_ids(db, current_user, tenant_id)
    if tenant_ids is not None:
        query = query.filter(TrafficRecord.user_id.in_(tenant_ids))

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
    now = datetime.now(timezone.utc)
    window_minutes = 15
    since_15 = now - timedelta(minutes=window_minutes)
    since_5 = now - timedelta(minutes=5)
    since_1 = now - timedelta(minutes=1)

    base_query = db.query(TrafficRecord).filter(TrafficRecord.created_at >= since_15)
    tenant_ids = get_accessible_tenant_ids(db, current_user, tenant_id)
    if tenant_ids is not None:
        base_query = base_query.filter(TrafficRecord.user_id.in_(tenant_ids))

    def _sum_packets(since: datetime) -> int:
        q = base_query.filter(TrafficRecord.created_at >= since)
        total = q.with_entities(func.sum(TrafficRecord.packet_count)).scalar()
        return int(total or 0)

    packets_last_minute = _sum_packets(since_1)
    packets_last_5min = _sum_packets(since_5)
    packets_last_15min = _sum_packets(since_15)
    avg_packets_per_minute_15m = packets_last_15min / float(window_minutes)

    last_seen = base_query.with_entities(func.max(TrafficRecord.created_at)).scalar()

    return TelemetryHealthResponse(
        window_minutes=window_minutes,
        packets_last_minute=packets_last_minute,
        packets_last_5min=packets_last_5min,
        packets_last_15min=packets_last_15min,
        avg_packets_per_minute_15m=avg_packets_per_minute_15m,
        last_traffic_at=last_seen,
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
    Legacy shape for inventory graph — backed by persisted topology_edges (connected_to).
    """
    from app.models.topology_edge import TopologyRelationshipType
    from app.services.topology import backfill_topology_from_traffic, edges_query_for_user

    tenant_ids = get_accessible_tenant_ids(db, current_user, tenant_id)
    backfill_topology_from_traffic(
        db,
        tenant_ids=tenant_ids,
        hours=hours,
    )
    db.commit()

    edges = (
        edges_query_for_user(db, current_user, tenant_id)
        .filter(TopologyEdge.relationship_type == TopologyRelationshipType.connected_to.value)
        .all()
    )
    pair_counts: dict[tuple[int, int], int] = defaultdict(int)
    for edge in edges:
        a, b = sorted((edge.source_device_id, edge.target_device_id))
        pair_counts[(a, b)] += int(edge.packet_count or 0)

    return [
        InventoryEdgeResponse(device_a_id=a, device_b_id=b, packet_count=cnt)
        for (a, b), cnt in sorted(pair_counts.items(), key=lambda x: (-x[1], x[0][0], x[0][1]))
    ]

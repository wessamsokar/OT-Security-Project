"""Persisted OT topology: edges, traffic sync, metadata relationships, snapshots."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
import logging

logger = logging.getLogger(__name__)

from sqlalchemy.orm import Session

from app.models.device import Device
from app.models.topology_edge import (
    TopologyEdge,
    TopologyEdgeDirection,
    TopologyEdgeSource,
    TopologyRelationshipType,
)
from app.models.traffic_record import TrafficRecord
from app.models.user import User
from app.services.device_operational import refresh_device_operational_state, refresh_operational_states_for_query
from app.services.tenant import get_accessible_tenant_ids

OT_META_CONNECTED = "connected_device_id"
OT_META_PARENT = "parent_device_id"
OT_META_PEER = "network_peer_id"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _protocol_context_from_record(record: TrafficRecord) -> str | None:
    if record.modbus_function_code is not None:
        return "modbus"
    if record.dnp3_function_code is not None:
        return "dnp3"
    if record.iec104_type_id is not None:
        return "iec104"
    proto = (record.transport_protocol or "").lower()
    return proto or None


def _upsert_edge(
    db: Session,
    *,
    user_id: int,
    source_id: int,
    target_id: int,
    relationship_type: str,
    direction: str,
    edge_source: str,
    protocol_context: str | None = None,
    packet_delta: int = 0,
    bytes_delta: int = 0,
    metadata: dict | None = None,
    at: datetime | None = None,
    traffic_record_id: int | None = None,
) -> TopologyEdge:
    """Upsert an edge with an idempotency guarantee based on optional traffic_record_id."""
    if source_id == target_id:
        raise ValueError("self-loop edge")
    at = at or _utcnow()
    edge = (
        db.query(TopologyEdge)
        .filter(
            TopologyEdge.user_id == user_id,
            TopologyEdge.source_device_id == source_id,
            TopologyEdge.target_device_id == target_id,
            TopologyEdge.relationship_type == relationship_type,
        )
        .first()
    )
    if edge is None:
        metadata = metadata or {}
        if traffic_record_id:
            metadata["processed_record_ids"] = [traffic_record_id]
        edge = TopologyEdge(
            user_id=user_id,
            source_device_id=source_id,
            target_device_id=target_id,
            relationship_type=relationship_type,
            direction=direction,
            edge_source=edge_source,
            protocol_context=protocol_context,
            metadata_json=metadata,
            packet_count=max(0, packet_delta),
            bytes_total=max(0, bytes_delta),
            is_active=True,
            first_seen_at=at,
            last_seen_at=at,
        )
        db.add(edge)
        logger.debug("[topology_edge] upsert_new edge_id=%s source_id=%s target_id=%s rel_type=%s edge_source=%s", edge.id, source_id, target_id, relationship_type, edge_source)
        return edge

    merged = dict(edge.metadata_json or {})
    processed_ids = set(merged.get("processed_record_ids", []))
    if traffic_record_id and traffic_record_id in processed_ids:
        return edge

    if traffic_record_id:
        processed_ids.add(traffic_record_id)
        merged["processed_record_ids"] = list(processed_ids)
        edge.packet_count = int(edge.packet_count or 0) + max(0, packet_delta)
        edge.bytes_total = int(edge.bytes_total or 0) + max(0, bytes_delta)

    edge.is_active = True
    edge.last_seen_at = at
    if protocol_context:
        edge.protocol_context = protocol_context
    if metadata:
        merged.update(metadata)
    edge.metadata_json = merged
    db.add(edge)
    logger.debug("[topology_edge] upsert_update edge_id=%s source_id=%s target_id=%s rel_type=%s edge_source=%s", edge.id, source_id, target_id, relationship_type, edge_source)
    return edge


def sync_edge_from_traffic_record(db: Session, record: TrafficRecord) -> TopologyEdge | None:
    """
    Upsert a connected_to topology edge from a single traffic record.

    Idempotency: the record.id is passed as traffic_record_id so that repeated
    calls with the same record (e.g. from backfill or SSE) do not accumulate
    packet_count more than once per unique TrafficRecord.

    Topology edges are activity markers for visualization — authoritative packet
    totals always come from SUM(TrafficRecord.packet_count) in telemetry_aggregation.
    """
    if record.device_id is None or record.user_id is None:
        return None

    device = db.query(Device).filter(Device.id == record.device_id).first()
    if not device or not device.ip_address:
        return None

    dip = device.ip_address.strip()
    sip, rip = record.source_ip.strip(), record.destination_ip.strip()
    peer_ip: str | None = None
    direction = TopologyEdgeDirection.forward.value
    if dip == sip:
        peer_ip = rip
    elif dip == rip:
        peer_ip = sip
        direction = TopologyEdgeDirection.reverse.value
    else:
        return None

    peer = (
        db.query(Device)
        .filter(
            Device.user_id == record.user_id,
            Device.ip_address == peer_ip,
            Device.is_active.is_(True),
        )
        .first()
    )
    if peer is None or peer.id == device.id:
        return None

    bytes_total = int(record.bytes_in or 0) + int(record.bytes_out or 0)
    return _upsert_edge(
        db,
        user_id=record.user_id,
        source_id=device.id,
        target_id=peer.id,
        relationship_type=TopologyRelationshipType.connected_to.value,
        direction=direction,
        edge_source=TopologyEdgeSource.traffic_observed.value,
        protocol_context=_protocol_context_from_record(record),
        packet_delta=int(record.packet_count or 0),
        bytes_delta=bytes_total,
        # Pass record.id so _upsert_edge can guard against re-accumulation
        metadata={"last_traffic_record_id": record.id},
        traffic_record_id=record.id,
        at=record.created_at or _utcnow(),
    )


def sync_metadata_edges_for_device(db: Session, device: Device) -> int:
    """Materialize declared relationships from device metadata_json."""
    if not device.user_id:
        return 0
    meta = device.metadata_json if isinstance(device.metadata_json, dict) else {}
    created = 0
    at = _utcnow()

    def _link(
        target_id_raw: object,
        relationship_type: str,
        direction: str,
    ) -> None:
        nonlocal created
        try:
            target_id = int(target_id_raw)
        except (TypeError, ValueError):
            return
        if target_id == device.id:
            return
        target = db.query(Device).filter(Device.id == target_id, Device.user_id == device.user_id).first()
        if target is None:
            return
        _upsert_edge(
            db,
            user_id=device.user_id,
            source_id=device.id,
            target_id=target.id,
            relationship_type=relationship_type,
            direction=direction,
            edge_source=TopologyEdgeSource.metadata_declared.value,
            metadata={"declared_on_device_id": device.id},
            at=at,
        )
        created += 1

    if meta.get(OT_META_CONNECTED):
        _link(meta[OT_META_CONNECTED], TopologyRelationshipType.connected_to.value, TopologyEdgeDirection.bidirectional.value)
    if meta.get(OT_META_PEER):
        _link(meta[OT_META_PEER], TopologyRelationshipType.peer.value, TopologyEdgeDirection.bidirectional.value)
    if meta.get(OT_META_PARENT):
        try:
            parent_id = int(meta[OT_META_PARENT])
        except (TypeError, ValueError):
            parent_id = None
        if parent_id and parent_id != device.id:
            parent = db.query(Device).filter(Device.id == parent_id, Device.user_id == device.user_id).first()
            if parent:
                _upsert_edge(
                    db,
                    user_id=device.user_id,
                    source_id=parent.id,
                    target_id=device.id,
                    relationship_type=TopologyRelationshipType.parent.value,
                    direction=TopologyEdgeDirection.forward.value,
                    edge_source=TopologyEdgeSource.metadata_declared.value,
                    metadata={"child_device_id": device.id},
                    at=at,
                )
                created += 1

    return created


def mark_stale_edges_inactive(db: Session, *, tenant_ids: list[int] | None) -> int:
    from app.core.config import get_settings

    settings_cutoff_minutes = get_settings().device_offline_after_minutes
    cutoff = _utcnow() - timedelta(minutes=max(1, settings_cutoff_minutes))

    q = db.query(TopologyEdge).filter(
        TopologyEdge.is_active.is_(True),
        TopologyEdge.last_seen_at.isnot(None),
        TopologyEdge.last_seen_at < cutoff,
        TopologyEdge.edge_source == TopologyEdgeSource.traffic_observed.value,
    )
    if tenant_ids is not None:
        q = q.filter(TopologyEdge.user_id.in_(tenant_ids))

    n = 0
    for edge in q.all():
        edge.is_active = False
        db.add(edge)
        n += 1
    return n


def devices_query_for_user(db: Session, user: User, tenant_id: int | None = None):
    q = db.query(Device)
    tenant_ids = get_accessible_tenant_ids(db, user, tenant_id)
    if tenant_ids is not None:
        q = q.filter(Device.user_id.in_(tenant_ids))
    return q


def edges_query_for_user(db: Session, user: User, tenant_id: int | None = None):
    q = db.query(TopologyEdge)
    tenant_ids = get_accessible_tenant_ids(db, user, tenant_id)
    if tenant_ids is not None:
        q = q.filter(TopologyEdge.user_id.in_(tenant_ids))
    return q


def build_topology_snapshot(db: Session, user: User, tenant_id: int | None = None) -> dict:
    """
    Full topology snapshot for REST/SSE.
    
    This is a READ-ONLY operation. It does not perform DB writes or trigger
    stale offline sweeps. Sweeps are triggered at ingest time (traffic.py)
    or by background jobs, preventing race conditions with live telemetry updates.
    """
    tenant_ids = get_accessible_tenant_ids(db, user, tenant_id)

    devices = devices_query_for_user(db, user, tenant_id).order_by(Device.id.asc()).all()
    # Ensure operational_state is fully up to date for this snapshot in-memory
    refresh_operational_states_for_query(devices, log_changes=False, source="sse_tick")

    edges = edges_query_for_user(db, user, tenant_id).order_by(TopologyEdge.last_seen_at.desc().nullslast()).all()
    device_by_id = {d.id: d for d in devices}

    now = _utcnow()
    edge_activity = []
    for edge in edges:
        recent = False
        if edge.last_seen_at:
            recent = _naive(edge.last_seen_at) >= now - timedelta(minutes=5)
        edge_activity.append(
            {
                "edge_id": edge.id,
                "active": bool(edge.is_active and recent),
                "packet_count": edge.packet_count,
                "last_seen_at": edge.last_seen_at.isoformat() if edge.last_seen_at else None,
            }
        )

    nodes = []
    for d in devices:
        refresh_device_operational_state(d, now=now)
        nodes.append(
            {
                "device_id": d.id,
                "name": d.name,
                "ip_address": d.ip_address,
                "device_type": d.device_type,
                "operational_state": d.operational_state,
                "monitoring_status": d.monitoring_status,
                "last_traffic_at": d.last_traffic_at.isoformat() if d.last_traffic_at else None,
                "last_ml_risk_score": d.last_ml_risk_score,
                "last_ml_status": d.last_ml_status,
                "metadata_json": d.metadata_json or {},
                "is_active": d.is_active,
            }
        )

    serialized_edges = [_serialize_edge(e, device_by_id) for e in edges]

    logger.debug("[topology_snapshot] built snapshot nodes=%s edges=%s active_edges=%s", len(nodes), len(edges), len([e for e in edge_activity if e["active"]]))

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "nodes": nodes,
        "edges": serialized_edges,
        "edge_activity": edge_activity,
    }


def _naive(dt: datetime) -> datetime:
    if dt.tzinfo is not None:
        return dt.replace(tzinfo=None)
    return dt


def _serialize_edge(edge: TopologyEdge, device_by_id: dict[int, Device]) -> dict:
    src = device_by_id.get(edge.source_device_id)
    tgt = device_by_id.get(edge.target_device_id)
    return {
        "id": edge.id,
        "source_device_id": edge.source_device_id,
        "target_device_id": edge.target_device_id,
        "source_name": src.name if src else None,
        "target_name": tgt.name if tgt else None,
        "relationship_type": edge.relationship_type,
        "direction": edge.direction,
        "protocol_context": edge.protocol_context,
        "metadata_json": edge.metadata_json or {},
        "packet_count": edge.packet_count,
        "bytes_total": edge.bytes_total,
        "is_active": edge.is_active,
        "edge_source": edge.edge_source,
        "first_seen_at": edge.first_seen_at.isoformat() if edge.first_seen_at else None,
        "last_seen_at": edge.last_seen_at.isoformat() if edge.last_seen_at else None,
    }


def backfill_topology_from_traffic(
    db: Session,
    *,
    tenant_ids: list[int] | None,
    hours: int = 168,
) -> int:
    """
    Rebuild traffic_observed topology edges from historical TrafficRecord rows.

    SAFE TO CALL REPEATEDLY — idempotent by design.
    Each call to sync_edge_from_traffic_record passes the TrafficRecord.id as
    traffic_record_id, which is stored in the edge's processed_record_ids set.
    Subsequent calls for the same record will skip packet_delta accumulation,
    so edge.packet_count never inflates from repeated backfill runs.

    CALL RESTRICTIONS — this function MUST NOT be called from:
      ✗ GET/read endpoints (causes re-accumulation on every page load)
      ✗ SSE stream generators
      ✗ Any path triggered automatically per-request

    VALID CALL SITES:
      ✓ POST /api/v1/traffic/ingest  (ingest-time, for the single new record)
      ✓ Explicit admin backfill action (e.g. POST /admin/topology/backfill)
      ✓ Startup recovery scripts (one-shot, not on every boot)

    Returns the number of edges created or updated.
    """
    since = _utcnow() - timedelta(hours=hours)
    q = db.query(TrafficRecord).filter(
        TrafficRecord.created_at >= since,
        TrafficRecord.device_id.isnot(None),
    )
    if tenant_ids is not None:
        q = q.filter(TrafficRecord.user_id.in_(tenant_ids))

    count = 0
    for record in q.all():
        if sync_edge_from_traffic_record(db, record):
            count += 1
    return count


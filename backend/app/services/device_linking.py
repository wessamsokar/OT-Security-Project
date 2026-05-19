from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.device import Device
from app.models.traffic_record import TrafficRecord
from app.services.device_operational import refresh_device_operational_state


def resolve_device_id_for_flow(db: Session, user_id: int | None, source_ip: str, destination_ip: str) -> int | None:
    """
    Match TrafficRecord endpoints to Device.ip_address for the same owning user.

    Prefers deterministic ordering by device id ascending when multiple patterns match.
    """
    if user_id is None:
        return None

    sip, dip = source_ip.strip(), destination_ip.strip()
    dev = (
        db.query(Device)
        .filter(
            Device.user_id == user_id,
            Device.is_active.is_(True),
            Device.ip_address.isnot(None),
            or_(Device.ip_address == sip, Device.ip_address == dip),
        )
        .order_by(Device.id.asc())
        .first()
    )
    return dev.id if dev else None


def touch_device_last_traffic(db: Session, device_id: int | None, at: datetime | None = None) -> None:
    """Record that we observed traffic involving this inventory asset (without changing ML-derived status)."""
    if device_id is None:
        return
    device = db.query(Device).filter(Device.id == device_id).first()
    if device is None:
        return
    device.last_traffic_at = at or datetime.utcnow()
    refresh_device_operational_state(device, now=at)
    db.add(device)


def backfill_traffic_device_links(db: Session, device: Device) -> int:
    """
    Link historical traffic rows that were ingested before the device existed
    or while device_id was unset.
    """
    if device.ip_address is None or not device.ip_address.strip():
        return 0
    ip = device.ip_address.strip()
    rows = (
        db.query(TrafficRecord)
        .filter(
            TrafficRecord.user_id == device.user_id,
            TrafficRecord.device_id.is_(None),
            or_(TrafficRecord.source_ip == ip, TrafficRecord.destination_ip == ip),
        )
        .all()
    )
    n = 0
    for r in rows:
        r.device_id = device.id
        n += 1
    return n


def sync_device_after_detection(
    db: Session,
    device_id: int | None,
    *,
    traffic_id: int,
    risk_score: float | None,
    ml_status: str,
    evaluated_at: datetime | None = None,
) -> None:
    """
    Persist ML outcome on Device: risk snapshot, anomaly class, monitoring_status mapping.
    """
    if device_id is None:
        return
    device = db.query(Device).filter(Device.id == device_id).first()
    if device is None:
        return

    ts = evaluated_at or datetime.utcnow()
    device.last_ml_risk_score = risk_score
    device.last_ml_status = ml_status
    device.last_seen_traffic_id = traffic_id
    device.last_traffic_at = ts

    if ml_status == "under_attack":
        device.monitoring_status = "under_attack"
    elif ml_status == "suspicious":
        device.monitoring_status = "suspicious"
    elif ml_status == "unknown_degraded":
        # No device column for degraded — treat as elevated watch (ML contract already flagged).
        device.monitoring_status = "suspicious"
    else:
        device.monitoring_status = "active"

    refresh_device_operational_state(device, now=ts)
    db.add(device)


def mark_stale_devices_offline(db: Session, *, tenant_ids: list[int] | None) -> int:
    """
    Devices with stale last_traffic_at are marked offline (does not wipe last ML snapshot).
    Returns number of rows updated.
    """
    settings = get_settings()
    cutoff = datetime.utcnow() - timedelta(minutes=max(1, settings.device_offline_after_minutes))

    query = db.query(Device).filter(
        Device.last_traffic_at.isnot(None),
        Device.last_traffic_at < cutoff,
        Device.monitoring_status != "offline",
    )
    if tenant_ids is not None:
        query = query.filter(Device.user_id.in_(tenant_ids))

    updated = 0
    for d in query.all():
        d.monitoring_status = "offline"
        refresh_device_operational_state(d)
        db.add(d)
        updated += 1
    return updated

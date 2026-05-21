"""
Device linking and operational state persistence helpers.

Call sequence at ingest time (order matters for correctness)
-------------------------------------------------------------
1. resolve_device_id_for_flow()        — match IP → Device.id
2. [create TrafficRecord, db.add()]
3. db.commit()                          — persist record BEFORE sweep reads DB
4. touch_device_last_traffic()          — update last_traffic_at + set monitoring_status=active
                                          + refresh operational_state → ONLINE
5. sync_edge_from_traffic_record()      — idempotent topology edge upsert
6. [optional] mark_stale_devices_offline() — sweep; freshly-committed device won't be caught
7. [optional] mark_stale_edges_inactive()
8. db.commit()                          — persist state updates

Race condition that was fixed (Bug 1 + Bug 2)
----------------------------------------------
Old ordering:
  touch_device(db, matched)    ← sets last_traffic_at in memory only (not committed)
  mark_stale_devices_offline() ← queries DB → reads OLD last_traffic_at → marks device offline
  db.commit()                  ← commits the OFFLINE state (overwriting the ONLINE set above)

New ordering:
  db.commit()                  ← commit TrafficRecord first
  touch_device(db, matched)    ← update last_traffic_at; DB already has fresh record
  mark_stale_devices_offline() ← queries DB → reads NEW last_traffic_at → correctly skips device
  db.commit()                  ← commits ONLINE state

monitoring_status invariant (Bug 4 fix)
-----------------------------------------
touch_device_last_traffic() now sets monitoring_status = "active" unless the device is
under an ML security verdict (under_attack/suspicious). This allows derive_operational_state
to return ONLINE immediately on raw ingest, before any ML detection runs.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.device import Device
from app.models.traffic_record import TrafficRecord
from app.services.device_operational import refresh_device_operational_state

logger = logging.getLogger(__name__)

# monitoring_status values set by ML that must never be overwritten by raw ingest
_ML_SECURITY_STATUSES = frozenset({"under_attack", "suspicious"})


def resolve_device_id_for_flow(
    db: Session, user_id: int | None, source_ip: str, destination_ip: str
) -> int | None:
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


def touch_device_last_traffic(
    db: Session, device_id: int | None, at: datetime | None = None
) -> None:
    """
    Record that telemetry was observed from this inventory device.

    This is called at RAW INGEST time (before ML detection). It:
      1. Updates last_traffic_at to now (or the provided timestamp)
      2. Sets monitoring_status = "active" UNLESS the device has an active ML security
         verdict (under_attack / suspicious). This ensures derive_operational_state
         returns ONLINE immediately on ingest, not OFFLINE due to stale monitoring_status.
      3. Derives and persists operational_state

    IMPORTANT: Call db.commit() on the TrafficRecord BEFORE calling this function,
    so mark_stale_devices_offline can read the fresh last_traffic_at from the DB
    and correctly skip this device during the post-ingest sweep.
    """
    if device_id is None:
        return
    device = db.query(Device).filter(Device.id == device_id).first()
    if device is None:
        return

    ts = at or datetime.utcnow()
    previous_state = device.operational_state
    previous_status = device.monitoring_status

    device.last_traffic_at = ts

    # Set monitoring_status = "active" to allow derive_operational_state → ONLINE
    # Only preserve ML security verdicts (under_attack, suspicious) — these represent
    # ML detections that should not be overwritten by raw ingest activity.
    if device.monitoring_status not in _ML_SECURITY_STATUSES:
        device.monitoring_status = "active"

    refresh_device_operational_state(device, now=ts, log_changes=True, source="touch_device_last_traffic")

    logger.debug(
        "[device_state] device_id=%s prev_state=%s new_state=%s "
        "prev_status=%s new_status=%s last_traffic_at=%s source=touch_device_last_traffic",
        device_id,
        previous_state,
        device.operational_state,
        previous_status,
        device.monitoring_status,
        ts.isoformat(),
    )

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

    Called AFTER ML inference. Sets monitoring_status based on ML verdict:
      under_attack → monitoring_status = "under_attack" → operational_state = ANOMALOUS
      suspicious   → monitoring_status = "suspicious"   → operational_state = DEGRADED
      otherwise    → monitoring_status = "active"       → operational_state = ONLINE
    """
    if device_id is None:
        return
    device = db.query(Device).filter(Device.id == device_id).first()
    if device is None:
        return

    ts = evaluated_at or datetime.utcnow()
    
    # Stale telemetry protection
    # If the telemetry evaluated_at is older than a manual resolution or recovery, discard the ML outcome.
    if device.attack_resolved_at and ts <= device.attack_resolved_at:
        logger.debug("[device_state] device_id=%s ignoring stale ML detection due to manual resolution", device_id)
        return
    if device.last_recovered_at and ts <= device.last_recovered_at:
        logger.debug("[device_state] device_id=%s ignoring stale ML detection due to recovery", device_id)
        return

    previous_state = device.operational_state
    previous_status = device.monitoring_status

    device.last_ml_risk_score = risk_score
    device.last_ml_status = ml_status
    device.last_seen_traffic_id = traffic_id
    device.last_traffic_at = ts

    device.anomaly_score_updated_at = ts

    if ml_status == "under_attack":
        if device.monitoring_status not in _ML_SECURITY_STATUSES:
            device.attack_acknowledged_at = None
        device.monitoring_status = "under_attack"
        device.last_attack_at = ts
    elif ml_status == "suspicious" or ml_status == "unknown_degraded":
        if device.monitoring_status not in _ML_SECURITY_STATUSES:
            device.attack_acknowledged_at = None
        device.monitoring_status = "suspicious"
        device.last_attack_at = ts
    else:
        # If the device was previously under attack, and ML says it's clean,
        # we log a recovered timestamp. Note: the operational state logic
        # still relies on the cooldown window to actually transition it to ONLINE.
        if device.monitoring_status in _ML_SECURITY_STATUSES:
            device.last_recovered_at = ts
        device.monitoring_status = "active"

    refresh_device_operational_state(device, now=ts, log_changes=True, source="sync_device_after_detection")

    logger.debug(
        "[device_state] device_id=%s prev_state=%s new_state=%s "
        "prev_status=%s new_status=%s ml_status=%s risk=%.3f source=sync_device_after_detection",
        device_id,
        previous_state,
        device.operational_state,
        previous_status,
        device.monitoring_status,
        ml_status,
        risk_score or 0.0,
    )

    db.add(device)


def mark_stale_devices_offline(db: Session, *, tenant_ids: list[int] | None) -> int:
    """
    Sweep: mark devices with stale last_traffic_at as offline.

    CALL ORDERING: This must be called AFTER db.commit() for any recently-ingested
    TrafficRecord. The DB query reads last_traffic_at from persisted rows — if the
    ingest hasn't committed yet, the old last_traffic_at will be read and the freshly-
    active device will be incorrectly swept to offline.

    Does not wipe ML risk snapshot or ml_status. Only updates monitoring_status and
    operational_state for devices that are genuinely stale.
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
        previous_state = d.operational_state
        d.monitoring_status = "offline"
        refresh_device_operational_state(d, log_changes=True, source="mark_stale_sweep")

        logger.debug(
            "[device_state] device_id=%s prev_state=%s new_state=%s "
            "last_traffic_at=%s cutoff=%s source=mark_stale_sweep",
            d.id,
            previous_state,
            d.operational_state,
            d.last_traffic_at.isoformat() if d.last_traffic_at else "None",
            cutoff.isoformat(),
        )

        db.add(d)
        updated += 1

    if updated:
        logger.debug(
            "[device_sweep] marked_offline=%d cutoff=%s tenant_ids=%s",
            updated, cutoff.isoformat(), tenant_ids,
        )

    return updated

def resolve_stale_attacks_sweep(db: Session, *, tenant_ids: list[int] | None) -> int:
    """
    Sweep: Automatically resolve devices that were under attack but have not
    had new detections within the fully normalized timeout window (2x recovery timeout).
    This ensures that when a device fully recovers, its ML monitoring_status
    returns to active in the database and the UI ML badge turns green.
    """
    settings = get_settings()
    fully_normalized_cutoff = datetime.utcnow() - timedelta(
        minutes=max(1, settings.device_recovery_timeout_minutes * 2)
    )

    query = db.query(Device).filter(
        Device.monitoring_status.in_(["under_attack", "suspicious"]),
        Device.last_attack_at.isnot(None),
        Device.last_attack_at < fully_normalized_cutoff,
    )
    if tenant_ids is not None:
        query = query.filter(Device.user_id.in_(tenant_ids))

    updated = 0
    for d in query.all():
        previous_state = d.operational_state
        d.monitoring_status = "active"
        # We can update the recovered timestamp
        d.last_recovered_at = datetime.utcnow()
        refresh_device_operational_state(d, log_changes=True, source="auto_resolve_sweep")

        logger.debug(
            "[device_state] device_id=%s prev_state=%s new_state=%s "
            "last_attack_at=%s cutoff=%s source=auto_resolve_sweep",
            d.id,
            previous_state,
            d.operational_state,
            d.last_attack_at.isoformat() if d.last_attack_at else "None",
            fully_normalized_cutoff.isoformat(),
        )

        db.add(d)
        updated += 1

    if updated:
        logger.debug(
            "[device_sweep] auto_resolved=%d cutoff=%s tenant_ids=%s",
            updated, fully_normalized_cutoff.isoformat(), tenant_ids,
        )

    return updated

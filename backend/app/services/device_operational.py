"""
Device operational state derivation — server-side only.

State machine rules (priority order, first match wins)
-------------------------------------------------------
1. INACTIVE     : device.is_active is False — inventory-level deactivation
2. ANOMALOUS    : monitoring_status = "under_attack" — ML detected active attack
3. DEGRADED     : monitoring_status = "suspicious" — ML suspects abnormal pattern
4. OFFLINE      : last_traffic_at is older than offline_cutoff OR monitoring_status = "offline"
5. ONLINE       : last_traffic_at is fresh (within cutoff) — telemetry observed recently
   CAPTURE      : overlay on ONLINE when packet_capture_enabled=true in metadata
6. UNKNOWN      : last_traffic_at is None and no capture enabled — never seen telemetry

Key invariant
-------------
States 2 (ANOMALOUS) and 3 (DEGRADED) are ML-derived from monitoring_status.
State 5 (ONLINE) is telemetry-derived from last_traffic_at.
These are intentionally SEPARATE:
  - A device can be ONLINE (fresh traffic) without any ML verdict yet
  - A device with monitoring_status="offline" can be set ONLINE again the moment
    fresh traffic arrives and touch_device_last_traffic sets monitoring_status="active"
  - touch_device_last_traffic MUST set monitoring_status="active" on ingest to allow
    this function to return ONLINE (see device_linking.py)

Bug that was fixed
------------------
Old code fell through to OFFLINE for any device with fresh last_traffic_at
but monitoring_status != "active". This meant devices receiving raw ingest
(before ML detection ran) stayed OFFLINE because touch_device_last_traffic
didn't set monitoring_status. Fix: if last_traffic_at is fresh, return ONLINE
unless an ML verdict explicitly overrides it (anomalous/degraded checks above).
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from app.core.config import get_settings
from app.models.device import Device

logger = logging.getLogger(__name__)

OPERATIONAL_UNKNOWN = "unknown"
OPERATIONAL_ONLINE = "online"
OPERATIONAL_OFFLINE = "offline"
OPERATIONAL_INACTIVE = "inactive"
OPERATIONAL_ANOMALOUS = "anomalous"
OPERATIONAL_DEGRADED = "degraded"
OPERATIONAL_CAPTURE = "capture_enabled"
OPERATIONAL_RECOVERING = "recovering"
OPERATIONAL_ACKNOWLEDGED = "acknowledged"


def _naive_utc(dt: datetime) -> datetime:
    if dt.tzinfo is not None:
        return dt.replace(tzinfo=None)
    return dt


def derive_operational_state(device: Device, *, now: datetime | None = None) -> str:
    """
    Derive canonical operational state from device fields. Pure function — no DB writes.

    Priority (first match wins):
      INACTIVE → ANOMALOUS/DEGRADED (if fresh attack) → RECOVERING (if cooldown) 
      → OFFLINE (stale/explicit) → ONLINE/CAPTURE → UNKNOWN
    """
    now = _naive_utc(now or datetime.utcnow())
    settings = get_settings()
    offline_cutoff = now - timedelta(minutes=max(1, settings.device_offline_after_minutes))
    recovery_cutoff = now - timedelta(minutes=max(1, settings.device_recovery_timeout_minutes))
    # Double the timeout to fully normalize from recovering to online automatically
    fully_normalized_cutoff = now - timedelta(minutes=max(1, settings.device_recovery_timeout_minutes * 2))

    # Priority 1: Inventory-level deactivation
    if not device.is_active:
        return OPERATIONAL_INACTIVE

    meta = device.metadata_json if isinstance(device.metadata_json, dict) else {}
    capture_on = bool(meta.get("packet_capture_enabled"))

    # Priority 2: Manual Recovery Cooldown
    if device.last_recovered_at:
        recovered_naive = _naive_utc(device.last_recovered_at)
        if recovered_naive >= recovery_cutoff:
            return OPERATIONAL_RECOVERING

    # Priority 3: ML Status
    if device.monitoring_status in ("under_attack", "suspicious"):
        last_attack = device.last_attack_at
        last_attack_naive = _naive_utc(last_attack) if last_attack else None
        
        # If we have a timestamp and it has aged past the fully normalized cutoff
        if last_attack_naive and last_attack_naive < fully_normalized_cutoff:
            # The attack is so old it has fully decayed; fall through to normal traffic checks
            pass
        # If it has aged past the initial recovery cutoff but not fully normalized
        elif last_attack_naive and last_attack_naive < recovery_cutoff:
            # Check if it's actually online right now
            last = device.last_traffic_at
            last_naive = _naive_utc(last) if last else None
            if last_naive and last_naive >= offline_cutoff:
                return OPERATIONAL_RECOVERING
            # If offline, fall through to OFFLINE check below
        else:
            # Active attack (within cooldown window)
            if device.attack_acknowledged_at:
                return OPERATIONAL_ACKNOWLEDGED
            if device.monitoring_status == "under_attack":
                return OPERATIONAL_ANOMALOUS
            return OPERATIONAL_DEGRADED

    # Priority 4: Explicit offline OR stale telemetry
    last = device.last_traffic_at
    if last is None:
        # Never seen telemetry
        return OPERATIONAL_CAPTURE if capture_on else OPERATIONAL_UNKNOWN

    last_naive = _naive_utc(last)
    stale = last_naive < offline_cutoff

    if stale or device.monitoring_status == "offline":
        return OPERATIONAL_OFFLINE

    # Priority 5: Fresh telemetry → ONLINE (or CAPTURE overlay)
    return OPERATIONAL_CAPTURE if capture_on else OPERATIONAL_ONLINE


def refresh_device_operational_state(
    device: Device,
    *,
    now: datetime | None = None,
    log_changes: bool = False,
    source: str = "refresh",
) -> str:
    """
    Derive and persist operational_state on the device object (no DB flush).

    Parameters
    ----------
    device      : Device ORM object to update (in-memory only)
    now         : Reference timestamp (uses utcnow() if None)
    log_changes : If True, log state transitions for debug tracing
    source      : Label for the debug log (e.g. "touch_device", "sweep", "sse_tick")
    """
    previous = device.operational_state
    state = derive_operational_state(device, now=now)
    device.operational_state = state

    if log_changes and state != previous:
        logger.debug(
            "[device_state] device_id=%s prev=%s new=%s monitoring_status=%s "
            "last_traffic_at=%s source=%s",
            device.id,
            previous,
            state,
            device.monitoring_status,
            device.last_traffic_at.isoformat() if device.last_traffic_at else "None",
            source,
        )

    return state


def refresh_operational_states_for_query(
    devices: list[Device],
    *,
    now: datetime | None = None,
    log_changes: bool = False,
    source: str = "batch_refresh",
) -> int:
    """
    Refresh operational_state for a list of devices. Returns count of changed states.
    Pure in-memory update — does not flush to DB.
    """
    changed = 0
    for device in devices:
        previous = device.operational_state
        state = refresh_device_operational_state(
            device, now=now, log_changes=log_changes, source=source
        )
        if state != previous:
            changed += 1
    return changed

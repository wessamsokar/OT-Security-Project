"""Derive canonical device operational state from telemetry (server-side only)."""

from __future__ import annotations

from datetime import datetime, timedelta

from app.core.config import get_settings
from app.models.device import Device

OPERATIONAL_UNKNOWN = "unknown"
OPERATIONAL_ONLINE = "online"
OPERATIONAL_OFFLINE = "offline"
OPERATIONAL_INACTIVE = "inactive"
OPERATIONAL_ANOMALOUS = "anomalous"
OPERATIONAL_DEGRADED = "degraded"
OPERATIONAL_CAPTURE = "capture_enabled"


def _naive_utc(dt: datetime) -> datetime:
    if dt.tzinfo is not None:
        return dt.replace(tzinfo=None)
    return dt


def derive_operational_state(device: Device, *, now: datetime | None = None) -> str:
    """
    Priority:
    inactive → anomalous → degraded → offline (stale) → online → unknown (never seen)
    capture_enabled overlays when packet capture is enabled in metadata (still returns primary if anomalous).
    """
    now = _naive_utc(now or datetime.utcnow())
    settings = get_settings()
    offline_cutoff = now - timedelta(minutes=max(1, settings.device_offline_after_minutes))

    if not device.is_active:
        return OPERATIONAL_INACTIVE

    meta = device.metadata_json if isinstance(device.metadata_json, dict) else {}
    capture_on = bool(meta.get("packet_capture_enabled"))

    if device.monitoring_status == "under_attack":
        return OPERATIONAL_ANOMALOUS
    if device.monitoring_status in ("suspicious",):
        return OPERATIONAL_DEGRADED

    last = device.last_traffic_at
    if last is None:
        return OPERATIONAL_CAPTURE if capture_on else OPERATIONAL_UNKNOWN

    last_naive = _naive_utc(last)
    stale = last_naive < offline_cutoff

    if stale or device.monitoring_status == "offline":
        return OPERATIONAL_OFFLINE

    if device.monitoring_status == "active":
        if capture_on:
            return OPERATIONAL_CAPTURE
        return OPERATIONAL_ONLINE

    if capture_on:
        return OPERATIONAL_CAPTURE

    return OPERATIONAL_OFFLINE


def refresh_device_operational_state(device: Device, *, now: datetime | None = None) -> str:
    state = derive_operational_state(device, now=now)
    device.operational_state = state
    return state


def refresh_operational_states_for_query(devices: list[Device], *, now: datetime | None = None) -> int:
    changed = 0
    for device in devices:
        previous = device.operational_state
        state = refresh_device_operational_state(device, now=now)
        if state != previous:
            changed += 1
    return changed

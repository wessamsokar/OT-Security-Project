"""SOC health aggregates derived only from persisted ML and alert fields."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.device import Device
from app.models.traffic_record import TrafficRecord
from app.models.user import User, UserRole
from app.schemas.model import SocHealthResponse
from app.services.tenant import get_accessible_tenant_ids


def build_soc_health(db: Session, current_user: User, *, window_hours: int = 24, requested_tenant_id: int | None = None) -> SocHealthResponse:
    since = datetime.now(timezone.utc) - timedelta(hours=max(1, window_hours))

    traffic_base = db.query(TrafficRecord).filter(TrafficRecord.created_at >= since)
    alert_base = db.query(Alert).join(TrafficRecord, TrafficRecord.id == Alert.traffic_record_id).filter(
        Alert.created_at >= since
    )
    device_base = db.query(Device)

    tenant_ids = get_accessible_tenant_ids(db, current_user, requested_tenant_id)
    if tenant_ids is not None:
        traffic_base = traffic_base.filter(TrafficRecord.user_id.in_(tenant_ids))
        alert_base = alert_base.filter(TrafficRecord.user_id.in_(tenant_ids))
        device_base = device_base.filter(Device.user_id.in_(tenant_ids))

    flows_in_window = traffic_base.with_entities(func.count(TrafficRecord.id)).scalar() or 0

    ml_label = func.coalesce(TrafficRecord.ml_status, "(no_ml_output)")
    ml_rows = (
        traffic_base.with_entities(ml_label, func.count(TrafficRecord.id)).group_by(ml_label).all()
    )
    ml_status_counts = {str(lab): int(cnt) for lab, cnt in ml_rows}

    attack_rows = (
        traffic_base.filter(TrafficRecord.ml_attack_detected.is_(True))
        .with_entities(func.count(TrafficRecord.id))
        .scalar()
        or 0
    )

    sev_rows = alert_base.with_entities(Alert.severity, func.count(Alert.id)).group_by(Alert.severity).all()
    alerts_severity_counts = {sev.value: int(cnt) for sev, cnt in sev_rows}

    devices_registered = device_base.with_entities(func.count(Device.id)).scalar() or 0

    mon_rows = (
        device_base.with_entities(Device.monitoring_status, func.count(Device.id))
        .group_by(Device.monitoring_status)
        .all()
    )
    monitoring_status_counts = {str(st): int(cnt) for st, cnt in mon_rows}

    avg_risk = (
        device_base.with_entities(func.avg(Device.last_ml_risk_score))
        .filter(Device.last_ml_risk_score.isnot(None))
        .scalar()
    )
    avg_last_ml_risk = float(avg_risk) if avg_risk is not None else None

    return SocHealthResponse(
        window_hours=window_hours,
        traffic_flows_in_window=int(flows_in_window),
        ml_status_counts=ml_status_counts,
        traffic_attack_detected_count=int(attack_rows),
        alerts_severity_counts=alerts_severity_counts,
        devices_registered=int(devices_registered),
        monitoring_status_counts=monitoring_status_counts,
        avg_last_ml_risk_score=avg_last_ml_risk,
    )

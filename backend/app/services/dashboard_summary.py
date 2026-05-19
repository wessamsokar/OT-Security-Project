"""Shared dashboard aggregates for alerts API, SSE stream, and public snapshot."""

from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.incident import Incident, IncidentStatus
from app.models.traffic_record import TrafficRecord
from app.models.user import User, UserRole
from app.services.tenant import get_accessible_tenant_ids
from app.schemas.alerts import DashboardSummary


def _is_admin(user: User) -> bool:
    return bool(user.role and user.role.value == UserRole.admin.value)


def build_dashboard_summary(
    db: Session,
    current_user: User | None,
    *,
    public_mode: bool = False,
    requested_tenant_id: int | None = None,
) -> DashboardSummary:
    """
    When ``public_mode`` is True, aggregates are global (marketing / public snapshot).
    Otherwise ``current_user`` scopes customer data; admins see all tenants.
    """
    records_query = db.query(TrafficRecord)
    alerts_query = db.query(Alert).join(TrafficRecord, TrafficRecord.id == Alert.traffic_record_id)
    incidents_query = (
        db.query(Incident)
        .join(Alert, Alert.id == Incident.alert_id)
        .join(TrafficRecord, TrafficRecord.id == Alert.traffic_record_id)
        .filter(Incident.status != IncidentStatus.resolved)
    )
    avg_query = db.query(func.avg(TrafficRecord.risk_score))
    class_query = db.query(TrafficRecord.attack_class, func.count(TrafficRecord.id)).filter(
        TrafficRecord.attack_class.isnot(None)
    )
    ml_label = func.coalesce(TrafficRecord.ml_status, "(no_ml_output)")
    ml_query = db.query(ml_label, func.count(TrafficRecord.id)).group_by(ml_label)

    if not public_mode:
        assert current_user is not None
        tenant_ids = get_accessible_tenant_ids(db, current_user, requested_tenant_id)
        if tenant_ids is not None:
            records_query = records_query.filter(TrafficRecord.user_id.in_(tenant_ids))
            alerts_query = alerts_query.filter(TrafficRecord.user_id.in_(tenant_ids))
            incidents_query = incidents_query.filter(TrafficRecord.user_id.in_(tenant_ids))
            avg_query = avg_query.filter(TrafficRecord.user_id.in_(tenant_ids))
            class_query = class_query.filter(TrafficRecord.user_id.in_(tenant_ids))
            ml_query = (
                db.query(ml_label, func.count(TrafficRecord.id))
                .filter(TrafficRecord.user_id.in_(tenant_ids))
                .group_by(ml_label)
            )

    total_records = records_query.with_entities(func.count(TrafficRecord.id)).scalar() or 0
    total_alerts = alerts_query.with_entities(func.count(Alert.id)).scalar() or 0
    incidents_open = incidents_query.with_entities(func.count(Incident.id)).scalar() or 0
    avg_risk = avg_query.scalar() or 0.0

    class_rows = class_query.group_by(TrafficRecord.attack_class).all()
    ml_rows = ml_query.all()

    return DashboardSummary(
        total_records=int(total_records),
        total_alerts=int(total_alerts),
        incidents_open=int(incidents_open),
        avg_risk_score=float(avg_risk),
        class_distribution={label: int(count) for label, count in class_rows if label},
        ml_status_distribution={str(label): int(count) for label, count in ml_rows},
    )

"""
Shared dashboard aggregates for alerts API, SSE stream, and public snapshot.

Metric separation rules (enforced here)
-----------------------------------------
  total_records        : ALL-TIME COUNT of TrafficRecord rows. Never windowed.
                         Represents the complete historical telemetry dataset.

  flows_last_24h       : COUNT of TrafficRecord rows created in the last 24 hours.
                         Matches the window used by soc-health traffic_flows_in_window.
                         Use this for live operational display.

  total_packet_count_24h : SUM of TrafficRecord.packet_count for the last 24 hours.
                           Represents actual network packets — NOT flow count.

  total_alerts         : ALL-TIME COUNT of Alert rows. One flow may produce ≤ 1 alert.

These four metrics are semantically distinct and MUST NOT be mixed in UI labels.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.incident import Incident, IncidentStatus
from app.models.traffic_record import TrafficRecord
from app.models.user import User, UserRole
from app.services.tenant import get_accessible_tenant_ids
from app.schemas.alerts import DashboardSummary

logger = logging.getLogger(__name__)


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
    Build the full dashboard summary for alerts API, SSE stream, and public snapshot.

    When ``public_mode`` is True, aggregates are global (marketing / public snapshot).
    Otherwise ``current_user`` scopes customer data; admins see all tenants.

    Aggregation strategy
    --------------------
    - total_records          : COUNT(*) — all time, no window filter
    - flows_last_24h         : COUNT(*) filtered to last 24h
    - total_packet_count_24h : SUM(packet_count) filtered to last 24h
    - total_alerts           : COUNT(Alert) — all time
    - incidents_open         : COUNT(Incident) where status != resolved
    """
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    since_24h = now - timedelta(hours=24)

    # Base queries — tenant scoping applied below
    records_query     = db.query(TrafficRecord)
    records_24h_query = db.query(TrafficRecord).filter(TrafficRecord.created_at >= since_24h)
    alerts_query      = db.query(Alert).join(TrafficRecord, TrafficRecord.id == Alert.traffic_record_id)
    incidents_query   = (
        db.query(Incident)
        .join(Alert, Alert.id == Incident.alert_id)
        .join(TrafficRecord, TrafficRecord.id == Alert.traffic_record_id)
        .filter(Incident.status != IncidentStatus.resolved)
    )
    avg_query   = db.query(func.avg(TrafficRecord.risk_score))
    class_query = db.query(TrafficRecord.attack_class, func.count(TrafficRecord.id)).filter(
        TrafficRecord.attack_class.isnot(None)
    )
    ml_label = func.coalesce(TrafficRecord.ml_status, "(no_ml_output)")
    ml_query = db.query(ml_label, func.count(TrafficRecord.id)).group_by(ml_label)

    if not public_mode:
        assert current_user is not None
        tenant_ids = get_accessible_tenant_ids(db, current_user, requested_tenant_id)
        if tenant_ids is not None:
            records_query     = records_query.filter(TrafficRecord.user_id.in_(tenant_ids))
            records_24h_query = records_24h_query.filter(TrafficRecord.user_id.in_(tenant_ids))
            alerts_query      = alerts_query.filter(TrafficRecord.user_id.in_(tenant_ids))
            incidents_query   = incidents_query.filter(TrafficRecord.user_id.in_(tenant_ids))
            avg_query         = avg_query.filter(TrafficRecord.user_id.in_(tenant_ids))
            class_query       = class_query.filter(TrafficRecord.user_id.in_(tenant_ids))
            ml_query = (
                db.query(ml_label, func.count(TrafficRecord.id))
                .filter(TrafficRecord.user_id.in_(tenant_ids))
                .group_by(ml_label)
            )
    else:
        tenant_ids = None

    # --- All-time historical counts ---
    total_records = records_query.with_entities(func.count(TrafficRecord.id)).scalar() or 0
    total_alerts  = alerts_query.with_entities(func.count(Alert.id)).scalar() or 0

    # --- 24h operational counts ---
    flows_last_24h = (
        records_24h_query.with_entities(func.count(TrafficRecord.id)).scalar() or 0
    )
    total_packet_count_24h = int(
        records_24h_query.with_entities(func.sum(TrafficRecord.packet_count)).scalar() or 0
    )

    incidents_open = incidents_query.with_entities(func.count(Incident.id)).scalar() or 0
    avg_risk       = avg_query.scalar() or 0.0

    class_rows = class_query.group_by(TrafficRecord.attack_class).all()
    ml_rows    = ml_query.all()

    # Debug log so we can verify consistency during testing
    logger.debug(
        "[dashboard_summary] tenant_ids=%s total_records=%d flows_last_24h=%d "
        "packet_count_24h=%d total_alerts=%d incidents_open=%d",
        tenant_ids,
        total_records,
        flows_last_24h,
        total_packet_count_24h,
        total_alerts,
        incidents_open,
    )

    return DashboardSummary(
        total_records=int(total_records),
        flows_last_24h=int(flows_last_24h),
        total_packet_count_24h=int(total_packet_count_24h),
        total_alerts=int(total_alerts),
        incidents_open=int(incidents_open),
        avg_risk_score=float(avg_risk),
        class_distribution={label: int(count) for label, count in class_rows if label},
        ml_status_distribution={str(label): int(count) for label, count in ml_rows},
    )

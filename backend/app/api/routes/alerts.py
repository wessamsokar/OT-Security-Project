from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.dependencies import require_roles
from app.db.session import get_db
from app.models.alert import Alert, AlertSeverity
from app.models.incident import Incident, IncidentStatus
from app.models.traffic_record import TrafficRecord
from app.models.user import User, UserRole
from app.schemas.alerts import (
    ActiveThreatResponse,
    AlertResponse,
    DashboardSummary,
    MttrIncidentResponse,
    MttrSummaryResponse,
)

router = APIRouter(prefix="/alerts", tags=["alerts"])


def _is_admin(user: User) -> bool:
    return bool(user.role and user.role.value == UserRole.admin.value)


@router.get("", response_model=list[AlertResponse])
def list_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.customer)),
) -> list[AlertResponse]:
    query = db.query(Alert).join(TrafficRecord, TrafficRecord.id == Alert.traffic_record_id)
    if not _is_admin(current_user):
        query = query.filter(TrafficRecord.user_id == current_user.id)
    return query.order_by(Alert.created_at.desc()).limit(200).all()


@router.get("/dashboard", response_model=DashboardSummary)
def dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.customer)),
) -> DashboardSummary:
    records_query = db.query(TrafficRecord)
    alerts_query = db.query(Alert).join(TrafficRecord, TrafficRecord.id == Alert.traffic_record_id)
    incidents_query = (
        db.query(Incident)
        .join(Alert, Alert.id == Incident.alert_id)
        .join(TrafficRecord, TrafficRecord.id == Alert.traffic_record_id)
        .filter(Incident.status != IncidentStatus.resolved)
    )
    avg_query = db.query(func.avg(TrafficRecord.risk_score))

    if not _is_admin(current_user):
        records_query = records_query.filter(TrafficRecord.user_id == current_user.id)
        alerts_query = alerts_query.filter(TrafficRecord.user_id == current_user.id)
        incidents_query = incidents_query.filter(TrafficRecord.user_id == current_user.id)
        avg_query = avg_query.filter(TrafficRecord.user_id == current_user.id)

    total_records = records_query.with_entities(func.count(TrafficRecord.id)).scalar() or 0
    total_alerts = alerts_query.with_entities(func.count(Alert.id)).scalar() or 0
    incidents_open = incidents_query.with_entities(func.count(Incident.id)).scalar() or 0
    avg_risk = avg_query.scalar() or 0.0

    class_query = db.query(TrafficRecord.attack_class, func.count(TrafficRecord.id)).filter(
        TrafficRecord.attack_class.isnot(None)
    )
    if not _is_admin(current_user):
        class_query = class_query.filter(TrafficRecord.user_id == current_user.id)
    class_rows = class_query.group_by(TrafficRecord.attack_class).all()

    return DashboardSummary(
        total_records=total_records,
        total_alerts=total_alerts,
        incidents_open=incidents_open,
        avg_risk_score=float(avg_risk),
        class_distribution={label: count for label, count in class_rows},
    )


@router.get("/active-threats", response_model=list[ActiveThreatResponse])
def active_threats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.customer)),
) -> list[ActiveThreatResponse]:
    rows_query = (
        db.query(Alert, TrafficRecord)
        .join(TrafficRecord, TrafficRecord.id == Alert.traffic_record_id)
        .filter(Alert.severity.in_([AlertSeverity.critical, AlertSeverity.high]))
    )
    if not _is_admin(current_user):
        rows_query = rows_query.filter(TrafficRecord.user_id == current_user.id)
    rows = rows_query.order_by(Alert.created_at.desc()).limit(100).all()

    result: list[ActiveThreatResponse] = []
    for alert, record in rows:
        result.append(
            ActiveThreatResponse(
                threat_id=f"T-{alert.id}",
                attack_vector=record.attack_class or alert.summary,
                target_asset=record.destination_ip,
                risk=alert.severity.value.upper(),
                created_at=alert.created_at,
            )
        )
    return result


@router.get("/mttr", response_model=MttrSummaryResponse)
def mttr_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.customer)),
) -> MttrSummaryResponse:
    incidents_query = (
        db.query(Incident)
        .join(Alert, Alert.id == Incident.alert_id)
        .join(TrafficRecord, TrafficRecord.id == Alert.traffic_record_id)
    )
    if not _is_admin(current_user):
        incidents_query = incidents_query.filter(TrafficRecord.user_id == current_user.id)
    incidents = incidents_query.order_by(Incident.created_at.desc()).limit(50).all()
    now = datetime.now(timezone.utc)

    items: list[MttrIncidentResponse] = []
    mttr_values: list[int] = []

    for incident in incidents:
        opened = incident.created_at.replace(tzinfo=timezone.utc) if incident.created_at.tzinfo is None else incident.created_at
        minutes = max(1, int((now - opened).total_seconds() // 60))
        items.append(
            MttrIncidentResponse(
                incident_id=f"INC-{incident.id}",
                opened_at=incident.created_at,
                resolved_at=None,
                status=incident.status.value,
                mttr_minutes=minutes,
            )
        )
        if incident.status == IncidentStatus.resolved:
            mttr_values.append(minutes)

    average = int(sum(mttr_values) / len(mttr_values)) if mttr_values else (int(sum(i.mttr_minutes for i in items) / len(items)) if items else 0)

    return MttrSummaryResponse(
        average_mttr_minutes=average,
        target_sla_minutes=20,
        incidents=items,
    )

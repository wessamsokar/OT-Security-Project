from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.db.session import get_db
from app.models.alert import Alert, AlertSeverity
from app.models.incident import Incident, IncidentStatus
from app.models.traffic_record import TrafficRecord
from app.models.user import User
from app.schemas.alerts import (
    ActiveThreatResponse,
    AlertResponse,
    DashboardSummary,
    MttrIncidentResponse,
    MttrSummaryResponse,
)
from app.services.dashboard_summary import build_dashboard_summary
from app.services.tenant import get_accessible_tenant_ids

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertResponse])
def list_alerts(

    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("view_alerts")),
    tenant_id: int | None = Query(default=None),
) -> list[AlertResponse]:
    query = (
        db.query(Alert, User)
        .join(TrafficRecord, TrafficRecord.id == Alert.traffic_record_id)
        .outerjoin(User, TrafficRecord.user_id == User.id)
    )
    tenant_ids = get_accessible_tenant_ids(db, current_user, tenant_id)
    if tenant_ids is not None:
        query = query.filter(TrafficRecord.user_id.in_(tenant_ids))
    
    rows = query.order_by(Alert.created_at.desc()).limit(200).all()
    results = []
    for alert, user in rows:
        if user:
            alert.tenant_name = user.company_name or user.username
        else:
            alert.tenant_name = "Unknown"
        results.append(alert)
    return results


@router.get("/dashboard", response_model=DashboardSummary)
def dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("view_dashboard")),
    tenant_id: int | None = Query(default=None),
) -> DashboardSummary:
    return build_dashboard_summary(db, current_user, requested_tenant_id=tenant_id)


@router.get("/active-threats", response_model=list[ActiveThreatResponse])
def active_threats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("view_alerts")),
    tenant_id: int | None = Query(default=None),
) -> list[ActiveThreatResponse]:
    rows_query = (
        db.query(Alert, TrafficRecord)
        .join(TrafficRecord, TrafficRecord.id == Alert.traffic_record_id)
        .filter(Alert.severity.in_([AlertSeverity.critical, AlertSeverity.high, AlertSeverity.medium]))
    )
    tenant_ids = get_accessible_tenant_ids(db, current_user, tenant_id)
    if tenant_ids is not None:
        rows_query = rows_query.filter(TrafficRecord.user_id.in_(tenant_ids))
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
    current_user: User = Depends(require_permission("view_alerts")),
    tenant_id: int | None = Query(default=None),
) -> MttrSummaryResponse:
    incidents_query = (
        db.query(Incident)
        .join(Alert, Alert.id == Incident.alert_id)
        .join(TrafficRecord, TrafficRecord.id == Alert.traffic_record_id)
    )
    tenant_ids = get_accessible_tenant_ids(db, current_user, tenant_id)
    if tenant_ids is not None:
        incidents_query = incidents_query.filter(TrafficRecord.user_id.in_(tenant_ids))
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

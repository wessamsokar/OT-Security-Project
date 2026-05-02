from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.dependencies import require_roles
from app.db.session import get_db
from app.models.alert import Alert, AlertSeverity
from app.models.incident import Incident, IncidentStatus
from app.models.traffic_record import TrafficRecord
from app.models.user import UserRole
from app.schemas.alerts import (
    ActiveThreatResponse,
    AlertResponse,
    DashboardSummary,
    MttrIncidentResponse,
    MttrSummaryResponse,
)

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertResponse])
def list_alerts(
    db: Session = Depends(get_db),
    _user=Depends(require_roles(UserRole.admin, UserRole.customer)),
) -> list[AlertResponse]:
    return db.query(Alert).order_by(Alert.created_at.desc()).limit(200).all()


@router.get("/dashboard", response_model=DashboardSummary)
def dashboard(
    db: Session = Depends(get_db),
    _user=Depends(require_roles(UserRole.admin, UserRole.customer)),
) -> DashboardSummary:
    total_records = db.query(func.count(TrafficRecord.id)).scalar() or 0
    total_alerts = db.query(func.count(Alert.id)).scalar() or 0
    incidents_open = (
        db.query(func.count(Incident.id)).filter(Incident.status != IncidentStatus.resolved).scalar() or 0
    )
    avg_risk = db.query(func.avg(TrafficRecord.risk_score)).scalar() or 0.0

    class_rows = (
        db.query(TrafficRecord.attack_class, func.count(TrafficRecord.id))
        .filter(TrafficRecord.attack_class.isnot(None))
        .group_by(TrafficRecord.attack_class)
        .all()
    )

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
    _user=Depends(require_roles(UserRole.admin, UserRole.customer)),
) -> list[ActiveThreatResponse]:
    rows = (
        db.query(Alert, TrafficRecord)
        .join(TrafficRecord, TrafficRecord.id == Alert.traffic_record_id)
        .filter(Alert.severity.in_([AlertSeverity.critical, AlertSeverity.high]))
        .order_by(Alert.created_at.desc())
        .limit(100)
        .all()
    )

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
    _user=Depends(require_roles(UserRole.admin, UserRole.customer)),
) -> MttrSummaryResponse:
    incidents = db.query(Incident).order_by(Incident.created_at.desc()).limit(50).all()
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

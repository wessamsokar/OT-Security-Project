from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.dependencies import require_roles
from app.db.session import get_db
from app.models.alert import Alert
from app.models.incident import Incident, IncidentStatus
from app.models.traffic_record import TrafficRecord
from app.models.user import UserRole
from app.schemas.alerts import AlertResponse, DashboardSummary

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertResponse])
def list_alerts(
    db: Session = Depends(get_db),
    _user=Depends(require_roles(UserRole.admin, UserRole.analyst, UserRole.viewer)),
) -> list[AlertResponse]:
    return db.query(Alert).order_by(Alert.created_at.desc()).limit(200).all()


@router.get("/dashboard", response_model=DashboardSummary)
def dashboard(
    db: Session = Depends(get_db),
    _user=Depends(require_roles(UserRole.admin, UserRole.analyst, UserRole.viewer)),
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

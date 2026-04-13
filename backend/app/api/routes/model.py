from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.dependencies import require_roles
from app.db.session import get_db
from app.models.alert import Alert, AlertSeverity
from app.models.incident import Incident, IncidentStatus
from app.models.model_version import ModelVersion
from app.models.traffic_record import TrafficRecord
from app.models.user import User, UserRole
from app.schemas.model import ModelVersionResponse, RetrainResponse, SecurityPostureResponse
from app.tasks.retrain_task import retrain_model_task

router = APIRouter(prefix="/model", tags=["model"])
SERVICE_STARTED_AT = datetime.now(timezone.utc)


@router.post("/retrain", response_model=RetrainResponse)
def retrain_model(current_user: User = Depends(require_roles(UserRole.admin))) -> RetrainResponse:
    task = retrain_model_task.delay(triggered_by=current_user.username)
    return RetrainResponse(task_id=task.id, status="queued")


@router.get("/versions", response_model=list[ModelVersionResponse])
def list_versions(
    db: Session = Depends(get_db),
    _user=Depends(require_roles(UserRole.admin, UserRole.analyst, UserRole.viewer)),
) -> list[ModelVersionResponse]:
    return db.query(ModelVersion).order_by(ModelVersion.created_at.desc()).all()


@router.get("/security-posture", response_model=SecurityPostureResponse)
def security_posture(
    db: Session = Depends(get_db),
    _user=Depends(require_roles(UserRole.admin, UserRole.analyst, UserRole.viewer)),
) -> SecurityPostureResponse:
    since = datetime.now(timezone.utc) - timedelta(hours=24)

    blocked_ips_today = (
        db.query(func.count(func.distinct(TrafficRecord.source_ip)))
        .join(Alert, Alert.traffic_record_id == TrafficRecord.id)
        .filter(Alert.severity.in_([AlertSeverity.high, AlertSeverity.critical]))
        .filter(Alert.created_at >= since)
        .scalar()
        or 0
    )

    incidents_open = (
        db.query(func.count(Incident.id)).filter(Incident.status != IncidentStatus.resolved).scalar() or 0
    )

    active_model = (
        db.query(ModelVersion)
        .filter(ModelVersion.is_active.is_(True))
        .order_by(ModelVersion.created_at.desc())
        .first()
    )

    drift = "Monitoring"
    if active_model and isinstance(active_model.metrics_json, dict):
        drift_metric = active_model.metrics_json.get("model_drift") or active_model.metrics_json.get("drift_status")
        if isinstance(drift_metric, str):
            drift = drift_metric.title()

    uptime_seconds = int((datetime.now(timezone.utc) - SERVICE_STARTED_AT).total_seconds())
    uptime_label = f"{uptime_seconds // 3600}h {(uptime_seconds % 3600) // 60}m"

    return SecurityPostureResponse(
        system_uptime=uptime_label,
        blocked_ips_today=int(blocked_ips_today),
        failed_logins=0,
        model_drift=drift,
        incidents_open=int(incidents_open),
    )

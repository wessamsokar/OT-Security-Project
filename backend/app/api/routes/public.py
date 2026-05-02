from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.alert import Alert, AlertSeverity
from app.models.incident import Incident, IncidentStatus
from app.models.traffic_record import TrafficRecord
from app.schemas.alerts import ActiveThreatResponse, DashboardSummary, PublicLiveSnapshotResponse

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/live-snapshot", response_model=PublicLiveSnapshotResponse)
def live_snapshot(db: Session = Depends(get_db)) -> PublicLiveSnapshotResponse:
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

    active_rows = (
        db.query(Alert, TrafficRecord)
        .join(TrafficRecord, TrafficRecord.id == Alert.traffic_record_id)
        .filter(Alert.severity.in_([AlertSeverity.critical, AlertSeverity.high]))
        .order_by(Alert.created_at.desc())
        .limit(100)
        .all()
    )

    active_threats: list[ActiveThreatResponse] = []
    for alert, record in active_rows:
        active_threats.append(
            ActiveThreatResponse(
                threat_id=f"T-{alert.id}",
                attack_vector=record.attack_class or alert.summary,
                target_asset=record.destination_ip,
                risk=alert.severity.value.upper(),
                created_at=alert.created_at,
            )
        )

    dashboard = DashboardSummary(
        total_records=total_records,
        total_alerts=total_alerts,
        incidents_open=incidents_open,
        avg_risk_score=float(avg_risk),
        class_distribution={label: count for label, count in class_rows},
    )

    return PublicLiveSnapshotResponse(
        dashboard=dashboard,
        active_threats=active_threats,
        updated_at=datetime.now(timezone.utc),
    )

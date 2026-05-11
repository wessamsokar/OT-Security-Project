from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.alert import Alert, AlertSeverity
from app.models.traffic_record import TrafficRecord
from app.schemas.alerts import ActiveThreatResponse, PublicLiveSnapshotResponse
from app.services.dashboard_summary import build_dashboard_summary

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/live-snapshot", response_model=PublicLiveSnapshotResponse)
def live_snapshot(db: Session = Depends(get_db)) -> PublicLiveSnapshotResponse:
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

    dashboard = build_dashboard_summary(db, None, public_mode=True)

    return PublicLiveSnapshotResponse(
        dashboard=dashboard,
        active_threats=active_threats,
        updated_at=datetime.now(timezone.utc),
    )

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.config import get_settings
from app.db.session import get_db
from app.models.alert import Alert, AlertSeverity
from app.models.traffic_record import TrafficRecord
from app.schemas.alerts import ActiveThreatResponse, PublicLiveSnapshotResponse
from app.services.dashboard_summary import build_dashboard_summary

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/live-snapshot", response_model=PublicLiveSnapshotResponse)
def live_snapshot(
    db: Session = Depends(get_db),
    _user=Depends(require_permission("view_dashboard")),
) -> PublicLiveSnapshotResponse:
    settings = get_settings()
    if not settings.public_live_snapshot_enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    active_rows = (
        db.query(Alert, TrafficRecord)
        .join(TrafficRecord, TrafficRecord.id == Alert.traffic_record_id)
        .filter(Alert.severity.in_([AlertSeverity.critical, AlertSeverity.high, AlertSeverity.medium]))
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

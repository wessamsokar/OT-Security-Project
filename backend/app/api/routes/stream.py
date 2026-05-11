import asyncio
import json
from datetime import datetime, timezone
from typing import Generator

from fastapi import APIRouter, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func

from app.api.dependencies import enforce_ot_platform_access
from app.core.security import decode_token
from app.db.session import SessionLocal
from app.models.alert import Alert
from app.models.incident import Incident, IncidentStatus
from app.models.model_version import ModelVersion
from app.models.traffic_record import TrafficRecord
from app.models.user import User, UserRole

router = APIRouter(prefix="/stream", tags=["stream"])


def _extract_confidence(metrics: dict) -> float:
    if not isinstance(metrics, dict):
        return 0.0
    for key in ["confidence", "confidence_pct", "overall_confidence", "f1", "accuracy"]:
        value = metrics.get(key)
        if isinstance(value, (int, float)):
            return float(value * 100 if value <= 1 else value)
    return 0.0


def _serialize_alert(alert: Alert) -> dict:
    return {
        "id": alert.id,
        "traffic_record_id": alert.traffic_record_id,
        "severity": alert.severity.value,
        "status": alert.status.value,
        "summary": alert.summary,
        "created_at": alert.created_at.isoformat() if alert.created_at else None,
    }


def _build_snapshot(user: User) -> dict:
    db = SessionLocal()
    try:
        is_admin = bool(user.role and user.role.value == UserRole.admin.value)
        alerts_query = db.query(Alert).join(TrafficRecord, TrafficRecord.id == Alert.traffic_record_id)
        records_query = db.query(TrafficRecord)
        incidents_query = db.query(Incident).filter(Incident.status != IncidentStatus.resolved)
        avg_query = db.query(func.avg(TrafficRecord.risk_score))
        class_query = db.query(TrafficRecord.attack_class, func.count(TrafficRecord.id)).filter(
            TrafficRecord.attack_class.isnot(None)
        )

        if not is_admin:
            alerts_query = alerts_query.filter(TrafficRecord.user_id == user.id)
            records_query = records_query.filter(TrafficRecord.user_id == user.id)
            incidents_query = (
                incidents_query.join(Alert, Alert.id == Incident.alert_id)
                .join(TrafficRecord, TrafficRecord.id == Alert.traffic_record_id)
                .filter(TrafficRecord.user_id == user.id)
            )
            avg_query = avg_query.filter(TrafficRecord.user_id == user.id)
            class_query = class_query.filter(TrafficRecord.user_id == user.id)

        alerts = alerts_query.order_by(Alert.created_at.desc()).limit(20).all()

        total_records = records_query.with_entities(func.count(TrafficRecord.id)).scalar() or 0
        total_alerts = alerts_query.with_entities(func.count(Alert.id)).scalar() or 0
        incidents_open = incidents_query.with_entities(func.count(Incident.id)).scalar() or 0
        avg_risk = avg_query.scalar() or 0.0

        class_rows = class_query.group_by(TrafficRecord.attack_class).all()

        active_model = (
            db.query(ModelVersion)
            .filter(ModelVersion.is_active.is_(True))
            .order_by(ModelVersion.created_at.desc())
            .first()
        )
        ml_confidence = _extract_confidence(active_model.metrics_json if active_model else {})

        return {
            "alerts": [_serialize_alert(alert) for alert in alerts],
            "dashboard": {
                "total_records": int(total_records),
                "total_alerts": int(total_alerts),
                "incidents_open": int(incidents_open),
                "avg_risk_score": float(avg_risk),
                "class_distribution": {label: count for label, count in class_rows if label},
            },
            "ml_confidence": float(ml_confidence),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    finally:
        db.close()


def _validate_stream_token(token: str) -> User:
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    db = SessionLocal()
    try:
        sub = payload["sub"]
        try:
            uid = int(sub)
            user = db.query(User).filter(User.id == uid).first()
        except (ValueError, TypeError):
            user = db.query(User).filter(User.username == sub).first()
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        allowed = {
            UserRole.admin.value,
            UserRole.customer.value,
            UserRole.analyst.value,  # legacy compatibility
            UserRole.viewer.value,  # legacy compatibility
        }
        user_roles = {user.role.value if user.role else None}
        if getattr(user, "roles", None):
            user_roles.update({role.name for role in user.roles if role and role.name})

        if not {role for role in user_roles if role}.intersection(allowed):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        enforce_ot_platform_access(user)
        return user
    finally:
        db.close()


@router.get("/alerts")
async def alerts_stream(request: Request, token: str = Query(..., min_length=8)) -> StreamingResponse:
    user = _validate_stream_token(token)

    async def event_generator() -> Generator[str, None, None]:
        while True:
            if await request.is_disconnected():
                break

            snapshot = _build_snapshot(user)
            yield f"event: snapshot\ndata: {json.dumps(snapshot)}\n\n"
            await asyncio.sleep(5)

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(event_generator(), media_type="text/event-stream", headers=headers)

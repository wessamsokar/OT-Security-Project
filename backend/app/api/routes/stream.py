import asyncio
import json
import logging
from datetime import datetime, timezone
from time import monotonic
from collections.abc import AsyncGenerator

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import StreamingResponse

from app.api.dependencies import enforce_ot_platform_access
from app.core.config import get_settings
from app.core.security import decode_token
from app.db.session import SessionLocal
from app.models.alert import Alert
from app.models.model_version import ModelVersion
from app.models.traffic_record import TrafficRecord
from app.models.user import User
from app.services.permissions import user_has_permission, user_is_admin
from app.services.dashboard_summary import build_dashboard_summary
from app.services.tenant import get_accessible_tenant_ids
from app.services.topology import build_topology_snapshot

router = APIRouter(prefix="/stream", tags=["stream"])
settings = get_settings()
logger = logging.getLogger(__name__)
_active_streams = 0
_stream_lock = asyncio.Lock()


async def _try_acquire_stream() -> bool:
    global _active_streams
    async with _stream_lock:
        if _active_streams >= settings.sse_max_connections:
            return False
        _active_streams += 1
        return True


async def _release_stream() -> None:
    global _active_streams
    async with _stream_lock:
        _active_streams = max(0, _active_streams - 1)


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


def _build_snapshot(user: User, tenant_id: int | None = None) -> dict:
    db = SessionLocal()
    try:
        tenant_ids = get_accessible_tenant_ids(db, user, tenant_id)
        alerts_query = db.query(Alert).join(TrafficRecord, TrafficRecord.id == Alert.traffic_record_id)

        if tenant_ids is not None:
            alerts_query = alerts_query.filter(TrafficRecord.user_id.in_(tenant_ids))

        alerts = alerts_query.order_by(Alert.created_at.desc()).limit(20).all()

        dashboard = build_dashboard_summary(db, user, requested_tenant_id=tenant_id)

        active_model = (
            db.query(ModelVersion)
            .filter(ModelVersion.is_active.is_(True))
            .order_by(ModelVersion.created_at.desc())
            .first()
        )
        ml_confidence = _extract_confidence(active_model.metrics_json if active_model else {})

        return {
            "alerts": [_serialize_alert(alert) for alert in alerts],
            "dashboard": dashboard.model_dump(mode="json"),
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
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive user")
        if not user_has_permission(db, user, "view_streams"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        enforce_ot_platform_access(user)
        return user
    finally:
        db.close()


@router.get("/alerts")
async def alerts_stream(request: Request, tenant_id: int | None = None) -> StreamingResponse:
    raw_token = request.cookies.get(settings.auth_cookie_name)
    if not raw_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    user = _validate_stream_token(raw_token)
    if not await _try_acquire_stream():
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many active streams")

    async def event_generator() -> AsyncGenerator[str, None]:
        started = monotonic()
        logger.info("SSE stream opened", extra={"user_id": user.id, "active_streams": _active_streams})
        try:
            while True:
                if await request.is_disconnected():
                    break
                if monotonic() - started > settings.sse_max_connection_seconds:
                    yield "event: close\ndata: {\"reason\":\"max_duration\"}\n\n"
                    break

                snapshot = _build_snapshot(user, tenant_id)
                yield f"event: snapshot\ndata: {json.dumps(snapshot)}\n\n"
                await asyncio.sleep(settings.sse_interval_seconds)
        finally:
            await _release_stream()
            logger.info("SSE stream closed", extra={"user_id": user.id, "active_streams": _active_streams})

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(event_generator(), media_type="text/event-stream", headers=headers)


@router.get("/topology")
async def topology_stream(request: Request, tenant_id: int | None = None) -> StreamingResponse:
    """Live OT topology: node operational state, edges, and link activity (separate from alerts)."""
    raw_token = request.cookies.get(settings.auth_cookie_name)
    if not raw_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    user = _validate_stream_token(raw_token)
    if not await _try_acquire_stream():
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many active streams")

    async def event_generator() -> AsyncGenerator[str, None]:
        started = monotonic()
        seq = 0
        logger.info("Topology SSE opened", extra={"user_id": user.id})
        try:
            while True:
                if await request.is_disconnected():
                    break
                if monotonic() - started > settings.sse_max_connection_seconds:
                    yield "event: close\ndata: {\"reason\":\"max_duration\"}\n\n"
                    break

                db = SessionLocal()
                try:
                    snapshot = build_topology_snapshot(db, user, tenant_id)
                    # No db.commit() here — SSE generator must be read-only to avoid transaction locks
                finally:
                    db.close()

                seq += 1
                snapshot["seq"] = seq
                yield f"event: topology_batch\ndata: {json.dumps(snapshot)}\n\n"
                await asyncio.sleep(settings.sse_interval_seconds)
        finally:
            await _release_stream()
            logger.info("Topology SSE closed", extra={"user_id": user.id})

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(event_generator(), media_type="text/event-stream", headers=headers)

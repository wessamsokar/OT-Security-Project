import httpx
import redis
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import text

from app.core.config import get_settings
from app.db.session import SessionLocal

router = APIRouter(tags=["health"])
settings = get_settings()


@router.get("/healthz")
def healthz() -> dict:
    return {"status": "ok"}


@router.get("/readyz")
async def readyz() -> dict:
    checks: dict[str, str] = {}
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"status": "not_ready", "checks": {**checks, "database": str(exc)}},
        ) from exc
    finally:
        db.close()

    redis_client = redis.Redis.from_url(settings.redis_url)
    try:
        redis_client.ping()
        checks["redis"] = "ok"
    except redis.RedisError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"status": "not_ready", "checks": {**checks, "redis": str(exc)}},
        ) from exc
    finally:
        redis_client.close()

    async def probe_ml() -> int:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{settings.ml_service_url}/healthz")
            return response.status_code

    try:
        status_code = await probe_ml()
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"status": "not_ready", "checks": {**checks, "ml": str(exc)}},
        ) from exc
    if status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"status": "not_ready", "checks": {**checks, "ml": f"status {status_code}"}},
        )
    checks["ml"] = "ok"

    return {"status": "ready", "checks": checks}

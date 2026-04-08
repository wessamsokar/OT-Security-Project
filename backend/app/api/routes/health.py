import asyncio

import httpx
import redis
from fastapi import APIRouter
from sqlalchemy import text

from app.core.config import get_settings
from app.db.session import SessionLocal

router = APIRouter(tags=["health"])
settings = get_settings()


@router.get("/healthz")
def healthz() -> dict:
    return {"status": "ok"}


@router.get("/readyz")
def readyz() -> dict:
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
    finally:
        db.close()

    redis_client = redis.Redis.from_url(settings.redis_url)
    redis_client.ping()

    async def probe_ml() -> int:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{settings.ml_service_url}/healthz")
            return response.status_code

    status_code = asyncio.run(probe_ml())
    if status_code != 200:
        raise RuntimeError("ML service not ready")

    return {"status": "ready"}

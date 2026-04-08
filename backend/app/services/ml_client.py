from typing import Any

import httpx

from app.core.config import get_settings

settings = get_settings()


async def run_inference(payload: dict[str, Any]) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(f"{settings.ml_service_url}/infer", json=payload)
        response.raise_for_status()
        return response.json()


async def trigger_retrain(payload: dict[str, Any]) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(f"{settings.ml_service_url}/retrain", json=payload)
        response.raise_for_status()
        return response.json()

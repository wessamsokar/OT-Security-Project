from typing import Any

import httpx
from fastapi import HTTPException, status

from app.core.config import get_settings

settings = get_settings()


def _ml_base_url() -> str:
    return settings.ml_service_url.rstrip("/")


def _ml_error_detail(exc: httpx.HTTPStatusError) -> str:
    try:
        data = exc.response.json()
        if isinstance(data, dict):
            d = data.get("detail")
            if isinstance(d, str):
                return d
            if isinstance(d, list) and d:
                first = d[0]
                if isinstance(first, dict) and first.get("msg"):
                    return str(first["msg"])
        return exc.response.text[:300]
    except Exception:
        return exc.response.text[:300] or str(exc)


async def run_inference(payload: dict[str, Any]) -> dict[str, Any]:
    base = _ml_base_url()
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(f"{base}/infer", json=payload)
            response.raise_for_status()
            data = response.json()
            if not isinstance(data, dict):
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="ML service returned non-object JSON",
                )
            return data
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"ML inference failed: {_ml_error_detail(exc)}",
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Cannot reach ML service at {base}: {exc}",
        ) from exc


async def trigger_retrain(payload: dict[str, Any]) -> dict[str, Any]:
    base = _ml_base_url()
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(f"{base}/retrain", json=payload)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"ML retrain failed: {_ml_error_detail(exc)}",
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Cannot reach ML service at {base}: {exc}",
        ) from exc

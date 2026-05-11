"""
Strict validation for ML `/infer` responses. Backend persists ML output verbatim — no coercion to benign.
"""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status

_VALID_ML_STATUS = frozenset({"normal", "suspicious", "under_attack", "unknown_degraded"})
_VALID_ALERT_SEVERITY = frozenset({"low", "medium", "high", "critical"})
_REQUIRED_KEYS = frozenset(
    {
        "risk_score",
        "ml_status",
        "alert_severity",
        "attack_detected",
        "attack_class",
        "confidence",
        "explanation",
        "model_version",
    }
)


class MlInferVerdict(dict[str, Any]):
    """Typed view of validated ML inference JSON (immutable contract)."""


def validate_ml_infer_response(body: dict[str, Any]) -> dict[str, Any]:
    """Validate canonical ML contract. Raises HTTP 503 if malformed (never downgrade to benign)."""
    missing = _REQUIRED_KEYS - body.keys()
    if missing:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"ML service returned incomplete contract (missing keys: {sorted(missing)})",
        )

    ml_status = body.get("ml_status")
    if not isinstance(ml_status, str):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ML service invalid: ml_status must be a string",
        )
    ml_status_n = ml_status.strip().lower()
    if ml_status_n not in _VALID_ML_STATUS:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"ML service invalid ml_status: {ml_status!r}",
        )

    sev_raw = body.get("alert_severity")
    if not isinstance(sev_raw, str):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ML service invalid: alert_severity must be a string",
        )
    alert_severity = sev_raw.strip().lower()
    if alert_severity not in _VALID_ALERT_SEVERITY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"ML service invalid alert_severity: {sev_raw!r}",
        )

    ad = body.get("attack_detected")
    if not isinstance(ad, bool):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ML service invalid: attack_detected must be a boolean",
        )

    rs = body.get("risk_score")
    if rs is not None:
        if not isinstance(rs, (int, float)):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="ML service invalid: risk_score must be a number or null",
            )

    attack_class = body.get("attack_class")
    if not isinstance(attack_class, str):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ML service invalid: attack_class must be a string",
        )

    conf = body.get("confidence")
    if not isinstance(conf, (int, float)):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ML service invalid: confidence must be a number",
        )

    expl = body.get("explanation")
    if not isinstance(expl, dict):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ML service invalid: explanation must be an object",
        )

    mv = body.get("model_version")
    if not isinstance(mv, str) or not mv.strip():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ML service invalid: model_version must be a non-empty string",
        )

    return body

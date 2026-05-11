import pytest
from fastapi import HTTPException

from app.services.ml_infer_contract import validate_ml_infer_response


def _valid_ml_body() -> dict:
    return {
        "risk_score": 0.91,
        "ml_status": "under_attack",
        "alert_severity": "critical",
        "attack_detected": True,
        "attack_class": "dos",
        "confidence": 0.88,
        "model_version": "smartgrid-v2.1",
        "explanation": {"evaluation_failed": False},
    }


def test_validate_accepts_well_formed_infer_json():
    v = validate_ml_infer_response(_valid_ml_body())
    assert v["ml_status"] == "under_attack"


def test_validate_raises_503_on_missing_key():
    bad = dict(_valid_ml_body())
    del bad["attack_detected"]
    with pytest.raises(HTTPException) as ei:
        validate_ml_infer_response(bad)
    assert ei.value.status_code == 503


def test_validate_raises_503_on_unknown_ml_status():
    bad = dict(_valid_ml_body())
    bad["ml_status"] = "phony"
    with pytest.raises(HTTPException) as ei:
        validate_ml_infer_response(bad)
    assert ei.value.status_code == 503
    assert "normal" not in (ei.value.detail or "").lower()


def test_validate_accepts_unknown_degraded_status():
    b = dict(_valid_ml_body())
    b["risk_score"] = None
    b["ml_status"] = "unknown_degraded"
    b["alert_severity"] = "high"
    b["attack_detected"] = True
    validate_ml_infer_response(b)

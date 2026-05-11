from fastapi.testclient import TestClient
import pytest

from api.api import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_infer_returns_expected_fields(client):
    payload = {
        "packet_count": 80,
        "bytes_in": 4200,
        "bytes_out": 3000,
        "duration_ms": 200,
        "payload_entropy": 5.6,
        "source_port": 50222,
        "destination_port": 502,
        "modbus_function_code": 16,
        "modbus_unit_id": 2,
        "dnp3_function_code": 1,
        "iec104_type_id": 45,
        "transport_protocol": "tcp",
    }

    response = client.post("/infer", json=payload)
    assert response.status_code == 200

    body = response.json()
    assert "risk_score" in body
    assert "ml_status" in body
    assert body["ml_status"] in ("normal", "suspicious", "under_attack", "unknown_degraded")
    assert body.get("alert_severity") in ("low", "medium", "high", "critical")
    assert isinstance(body.get("attack_detected"), bool)
    assert "attack_class" in body
    assert "confidence" in body
    assert "explanation" in body
    assert isinstance(body["explanation"], dict)


def test_readyz_includes_pipeline_mode(client):
    response = client.get("/readyz")
    assert response.status_code == 200

    body = response.json()
    assert body["status"] == "ready"
    assert "model_version" in body
    assert body["model_version"].startswith("smartgrid-")


def test_retrain_returns_backward_compatible_shape(client):
    response = client.post("/retrain", json={"triggered_by": "test-user"})
    assert response.status_code == 200

    body = response.json()
    assert "model_version" in body
    assert "label" in body
    assert "metrics" in body

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_infer_returns_expected_fields():
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
    assert "attack_class" in body
    assert "confidence" in body
    assert "explanation" in body

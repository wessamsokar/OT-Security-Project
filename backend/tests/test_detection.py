import os

os.environ["DATABASE_URL"] = "sqlite:///./test_detection.db"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["ML_SERVICE_URL"] = "http://localhost:8001"
os.environ["JWT_SECRET_KEY"] = "test-secret"

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.api.routes.traffic as traffic_routes
from app.core.security import create_access_token, get_password_hash
from app.db.base import Base
from app.main import app
from app.models.user import User, UserRole


def test_ingest_endpoint_with_auth():
    engine = create_engine("sqlite:///./test_detection.db")
    TestingSessionLocal = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()
    admin_id = 1
    try:
        db.query(User).delete()
        admin = User(
            username="admin",
            email="admin@example.com",
            hashed_password=get_password_hash("admin123"),
            role=UserRole.admin,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
        admin_id = admin.id
    finally:
        db.close()

    async def fake_inference(payload: dict):
        return {
            "risk_score": 0.91,
            "ml_status": "under_attack",
            "alert_severity": "critical",
            "attack_detected": True,
            "attack_class": "dos",
            "confidence": 0.88,
            "model_version": "v1.0-test",
            "explanation": {
                "evaluation_failed": False,
                "ml_status": "under_attack",
                "alert_severity": "critical",
            },
        }

    traffic_routes.run_inference = fake_inference

    client = TestClient(app)
    token = create_access_token(str(admin_id))
    headers = {"Authorization": f"Bearer {token}"}

    ingest_payload = {
        "source_ip": "10.0.0.10",
        "destination_ip": "10.0.0.20",
        "source_port": 50000,
        "destination_port": 502,
        "transport_protocol": "tcp",
        "packet_count": 50,
        "bytes_in": 1000,
        "bytes_out": 1200,
        "duration_ms": 100,
        "payload_entropy": 3.1,
        "ingestion_source": "json",
        "metadata_json": {},
    }

    ingest = client.post("/api/v1/traffic/ingest", json=ingest_payload, headers=headers)
    assert ingest.status_code == 200

    record_id = ingest.json()["id"]
    detect = client.post(f"/api/v1/traffic/{record_id}/detect", headers=headers)
    assert detect.status_code == 200
    body = detect.json()
    assert body["attack_class"] == "dos"
    assert body["ml_status"] == "under_attack"
    assert body["alert_severity"] == "critical"
    assert body["attack_detected"] is True


def test_detect_returns_503_on_incomplete_ml_contract():
    """Invalid ML payloads must not be silently coerced to benign normal."""
    engine = create_engine("sqlite:///./test_detection_contract.db")
    TestingSessionLocal = sessionmaker(bind=engine)
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()
    admin_id = 1
    try:
        db.query(User).delete()
        admin = User(
            username="admin2",
            email="admin2@example.com",
            hashed_password=get_password_hash("admin123"),
            role=UserRole.admin,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
        admin_id = admin.id
    finally:
        db.close()

    async def bad_inference(payload: dict):
        return {
            "risk_score": 0.5,
            "ml_status": "under_attack",
            # missing alert_severity, attack_detected, etc.
            "attack_class": "dos",
            "confidence": 0.5,
            "model_version": "x",
            "explanation": {},
        }

    traffic_routes.run_inference = bad_inference
    client = TestClient(app)
    token = create_access_token(str(admin_id))
    headers = {"Authorization": f"Bearer {token}"}

    ingest = client.post(
        "/api/v1/traffic/ingest",
        json={
            "source_ip": "10.0.0.1",
            "destination_ip": "10.0.0.2",
            "source_port": 50001,
            "destination_port": 443,
            "transport_protocol": "tcp",
            "packet_count": 10,
            "bytes_in": 100,
            "bytes_out": 100,
            "duration_ms": 50,
            "payload_entropy": 2.0,
            "ingestion_source": "json",
            "metadata_json": {},
        },
        headers=headers,
    )
    assert ingest.status_code == 200
    rid = ingest.json()["id"]
    detect = client.post(f"/api/v1/traffic/{rid}/detect", headers=headers)
    assert detect.status_code == 503

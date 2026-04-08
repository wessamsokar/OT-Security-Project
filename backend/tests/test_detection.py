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
    try:
        db.query(User).delete()
        db.add(
            User(
                username="admin",
                email="admin@example.com",
                hashed_password=get_password_hash("admin123"),
                role=UserRole.admin,
            )
        )
        db.commit()
    finally:
        db.close()

    async def fake_inference(payload: dict):
        return {
            "risk_score": 0.91,
            "attack_class": "dos",
            "confidence": 0.88,
            "model_version": "v1.0",
            "explanation": {"top_features": [{"feature": "packet_count", "value": 80, "importance": 0.5}]},
        }

    traffic_routes.run_inference = fake_inference

    client = TestClient(app)
    token = create_access_token("admin")
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
    assert detect.json()["attack_class"] == "dos"

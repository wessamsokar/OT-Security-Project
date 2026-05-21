import os
import pytest
from datetime import datetime, timedelta

os.environ["DATABASE_URL"] = "sqlite:///./test_recovery.sqlite"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["ML_SERVICE_URL"] = "http://localhost:8001"
os.environ["JWT_SECRET_KEY"] = "test-secret"

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import create_access_token, get_password_hash
from app.db.base import Base
from app.main import app
from app.models.user import User, UserRole
from app.models.device import Device
from app.db.session import get_db
from tests.test_credentials import test_password

engine = create_engine("sqlite:///./test_recovery.sqlite", connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="module")
def client():
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(autouse=True)
def clean_db(client, db_session):
    db_session.query(Device).delete()
    db_session.query(User).delete()
    db_session.commit()

@pytest.fixture
def analyst_token(db_session):
    u = User(
        username="admin1",
        email="admin1@example.com",
        hashed_password=get_password_hash(test_password()),
        role=UserRole.admin,
        is_admin_approved=True,
    )
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)
    return create_access_token(subject=str(u.id))


def test_operational_recovery_lifecycle(client, analyst_token):
    headers = {"Authorization": f"Bearer {analyst_token}"}
    
    # 1. Create Device
    create_resp = client.post("/api/v1/devices", json={
        "name": "PLC-Target",
        "ip_address": "10.0.0.99"
    }, headers=headers)
    assert create_resp.status_code == 201
    device_id = create_resp.json()["id"]

    # 2. Simulate Attack via Ingestion (assuming test endpoint or direct DB manipulation)
    # Since we don't have a direct mock for ML inference here, we will just use DB to simulate ML outcome
    # But wait, we can just use the acknowledge and clear endpoints to test the lifecycle.
    
    # Let's set the device to under_attack manually to test acknowledge/clear
    db = TestingSessionLocal()
    dev = db.query(Device).filter(Device.id == device_id).first()
    dev.monitoring_status = "under_attack"
    dev.operational_state = "anomalous"
    dev.last_attack_at = datetime.utcnow()
    db.commit()
    db.close()

    # 3. Acknowledge Attack
    ack_resp = client.post(f"/api/v1/devices/{device_id}/acknowledge-attack", json={"reason": "Seen it"}, headers=headers)
    print(ack_resp.text)
    assert ack_resp.status_code == 200
    ack_data = ack_resp.json()
    assert ack_data["attack_acknowledged_at"] is not None

    # 4. Clear Attack
    clear_resp = client.post(f"/api/v1/devices/{device_id}/clear-attack", json={"reason": "False positive"}, headers=headers)
    assert clear_resp.status_code == 200
    clear_data = clear_resp.json()
    assert clear_data["monitoring_status"] == "active"
    assert clear_data["attack_resolved_at"] is not None
    assert clear_data["last_recovered_at"] is not None
    # Wait, the operational_state should be 'recovering' if there's a cooldown, or 'online'.
    # With the manual clear, refresh_device_operational_state is called, and since last_recovered_at is now, it should be recovering!
    assert clear_data["operational_state"] == "recovering"

import os
import pytest

os.environ["DATABASE_URL"] = "sqlite:///./test_db.sqlite"
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

engine = create_engine("sqlite:///./test_db.sqlite", connect_args={"check_same_thread": False})
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
def clean_db(db_session):
    db_session.query(Device).delete()
    db_session.query(User).delete()
    db_session.commit()

@pytest.fixture
def user1_token(db_session):
    u1 = User(
        username="user1",
        email="u1@example.com",
        hashed_password=get_password_hash(test_password()),
        role=UserRole.analyst,
        is_admin_approved=True,
    )
    db_session.add(u1)
    db_session.commit()
    db_session.refresh(u1)
    return create_access_token(subject=str(u1.id))

@pytest.fixture
def user2_token(db_session):
    u2 = User(
        username="user2",
        email="u2@example.com",
        hashed_password=get_password_hash(test_password()),
        role=UserRole.analyst,
        is_admin_approved=True,
    )
    db_session.add(u2)
    db_session.commit()
    db_session.refresh(u2)
    return create_access_token(subject=str(u2.id))


@pytest.fixture
def viewer_token(db_session):
    viewer = User(
        username="viewer",
        email="viewer@example.com",
        hashed_password=get_password_hash(test_password()),
        role=UserRole.viewer,
        is_admin_approved=True,
    )
    db_session.add(viewer)
    db_session.commit()
    db_session.refresh(viewer)
    return create_access_token(subject=str(viewer.id))


def test_device_crud_flow(client, user1_token):
    # 1. Create Device
    create_resp = client.post("/api/v1/devices", json={
        "name": "PLC-A",
        "device_type": "PLC",
        "ip_address": "10.0.0.1",
        "serial_number": "SN100"
    }, headers={"Authorization": f"Bearer {user1_token}"})
    assert create_resp.status_code == 201
    created = create_resp.json()
    device_id = created["id"]
    assert created.get("monitoring_status") == "offline"

    # 2. Get Device
    get_resp = client.get(f"/api/v1/devices/{device_id}", headers={"Authorization": f"Bearer {user1_token}"})
    assert get_resp.status_code == 200
    assert get_resp.json()["name"] == "PLC-A"

    # 3. Update Device
    update_resp = client.put(f"/api/v1/devices/{device_id}", json={
        "name": "PLC-A-Updated"
    }, headers={"Authorization": f"Bearer {user1_token}"})
    assert update_resp.status_code == 200
    assert update_resp.json()["name"] == "PLC-A-Updated"

    # 4. Delete Device
    del_resp = client.delete(f"/api/v1/devices/{device_id}", headers={"Authorization": f"Bearer {user1_token}"})
    assert del_resp.status_code == 204


def test_device_isolation(client, user1_token, user2_token):
    # User 1 creates a device
    create_resp = client.post("/api/v1/devices", json={
        "name": "User1-Device",
        "ip_address": "10.0.0.2"
    }, headers={"Authorization": f"Bearer {user1_token}"})
    assert create_resp.status_code == 201
    device_id = create_resp.json()["id"]

    # User 2 tries to access User 1's device
    get_resp = client.get(f"/api/v1/devices/{device_id}", headers={"Authorization": f"Bearer {user2_token}"})
    assert get_resp.status_code == 404

    # User 2 tries to update User 1's device
    update_resp = client.put(f"/api/v1/devices/{device_id}", json={"name": "Hacked"}, headers={"Authorization": f"Bearer {user2_token}"})
    assert update_resp.status_code == 404

    # User 2 lists their devices, should be empty
    list_resp = client.get("/api/v1/devices", headers={"Authorization": f"Bearer {user2_token}"})
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 0


def test_viewer_can_list_but_not_write_devices(client, viewer_token):
    list_resp = client.get("/api/v1/devices", headers={"Authorization": f"Bearer {viewer_token}"})
    assert list_resp.status_code == 200

    create_resp = client.post("/api/v1/devices", json={"name": "ReadOnlyPLC"}, headers={"Authorization": f"Bearer {viewer_token}"})
    assert create_resp.status_code == 403

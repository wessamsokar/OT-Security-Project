import os
import pytest

os.environ["DATABASE_URL"] = "sqlite:///./test_db.sqlite"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["ML_SERVICE_URL"] = "http://localhost:8001"
os.environ["JWT_SECRET_KEY"] = "test-secret"

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import get_password_hash, create_access_token
from app.db.base import Base
from app.main import app
from app.models.user import User, UserRole
from app.models.rbac import Role
from app.db.session import get_db

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
    db_session.query(Role).delete()
    db_session.query(User).delete()
    db_session.commit()

@pytest.fixture
def admin_token(db_session):
    admin = User(username="admin", email="admin@example.com", hashed_password="123", role=UserRole.admin)
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)
    return create_access_token(subject=str(admin.id))

@pytest.fixture
def viewer_token(db_session):
    viewer = User(
        username="viewer",
        email="viewer@example.com",
        hashed_password="123",
        role=UserRole.viewer,
        is_admin_approved=True,
    )
    db_session.add(viewer)
    db_session.commit()
    db_session.refresh(viewer)
    return create_access_token(subject=str(viewer.id))


def test_rbac_admin_can_create_role(client, admin_token):
    response = client.post("/api/v1/rbac/roles", json={
        "name": "Operator",
        "description": "General operator role"
    }, headers={"Authorization": f"Bearer {admin_token}"})
    
    assert response.status_code == 201
    assert response.json()["name"] == "Operator"


def test_rbac_viewer_cannot_create_role(client, viewer_token):
    response = client.post("/api/v1/rbac/roles", json={
        "name": "Hacker",
        "description": "Should fail"
    }, headers={"Authorization": f"Bearer {viewer_token}"})
    
    assert response.status_code == 403


def test_rbac_crud_flow(client, admin_token):
    # 1. Create Role
    role_resp = client.post("/api/v1/rbac/roles", json={
        "name": "DeviceReader",
        "description": "Can read devices"
    }, headers={"Authorization": f"Bearer {admin_token}"})
    assert role_resp.status_code == 201
    role_id = role_resp.json()["id"]
    
    # 2. Read Role
    get_resp = client.get(f"/api/v1/rbac/roles/{role_id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert get_resp.status_code == 200
    assert get_resp.json()["name"] == "DeviceReader"
    
    # 3. Update Role
    update_resp = client.put(f"/api/v1/rbac/roles/{role_id}", json={
        "name": "SuperDeviceReader"
    }, headers={"Authorization": f"Bearer {admin_token}"})
    assert update_resp.status_code == 200
    assert update_resp.json()["name"] == "SuperDeviceReader"
    
    # 4. Delete Role
    del_resp = client.delete(f"/api/v1/rbac/roles/{role_id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert del_resp.status_code == 204

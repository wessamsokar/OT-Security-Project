import os
import pytest

os.environ["DATABASE_URL"] = "sqlite:///./test_db.sqlite"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["ML_SERVICE_URL"] = "http://localhost:8001"
os.environ["JWT_SECRET_KEY"] = "test-secret"

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import create_access_token
from app.db.base import Base
from app.main import app
from app.models.user import User, UserRole
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
    db_session.query(User).delete()
    db_session.commit()


@pytest.fixture
def admin_token(db_session):
    admin = User(username="admin_users", email="admin_users@example.com", hashed_password="123", role=UserRole.admin)
    db_session.add(admin)
    db_session.commit()
    return create_access_token(subject=admin.username)


@pytest.fixture
def viewer_token(db_session):
    viewer = User(username="viewer_users", email="viewer_users@example.com", hashed_password="123", role=UserRole.viewer)
    db_session.add(viewer)
    db_session.commit()
    return create_access_token(subject=viewer.username)


def test_users_crud_admin_only(client, admin_token):
    create_resp = client.post(
        "/api/v1/users",
        json={
            "username": "test_user",
            "email": "test_user@example.com",
            "password": "Password123",
            "role": "viewer",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert create_resp.status_code == 201
    user_id = create_resp.json()["id"]

    list_resp = client.get("/api/v1/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert list_resp.status_code == 200
    assert len(list_resp.json()) >= 1

    get_resp = client.get(f"/api/v1/users/{user_id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert get_resp.status_code == 200
    assert get_resp.json()["email"] == "test_user@example.com"

    update_resp = client.put(
        f"/api/v1/users/{user_id}",
        json={"role": "analyst"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["role"] == "analyst"

    delete_resp = client.delete(f"/api/v1/users/{user_id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert delete_resp.status_code == 204


def test_users_forbidden_for_non_admin(client, viewer_token):
    resp = client.get("/api/v1/users", headers={"Authorization": f"Bearer {viewer_token}"})
    assert resp.status_code == 403

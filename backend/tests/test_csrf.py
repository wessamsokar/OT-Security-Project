import os

os.environ["DATABASE_URL"] = "sqlite:///./test_csrf.db"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["ML_SERVICE_URL"] = "http://localhost:8001"
os.environ["JWT_SECRET_KEY"] = "test-secret"
os.environ["CSRF_PROTECTION_ENABLED"] = "true"

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import get_password_hash
from app.db.base import Base
from app.main import app
from app.models.user import User, UserRole
from tests.csrf_helpers import fetch_csrf
from tests.test_credentials import test_password


def test_csrf_endpoint_sets_cookie():
    client = TestClient(app)
    response = client.get("/api/v1/auth/csrf")
    assert response.status_code == 200
    assert "csrf_token" in response.json()
    assert "ics_csrf_token" in response.cookies


def test_post_without_csrf_rejected():
    import tests.conftest as cf

    saved = {m: getattr(TestClient, m) for m in cf._UNSAFE_METHODS}
    for m in cf._UNSAFE_METHODS:
        setattr(TestClient, m, cf._ORIGINALS[m])

    engine = create_engine("sqlite:///./test_csrf.db")
    TestingSessionLocal = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()
    try:
        db.query(User).delete()
        db.add(
            User(
                username="analyst",
                email="analyst@example.com",
                hashed_password=get_password_hash(test_password()),
                role=UserRole.analyst,
                is_admin_approved=True,
            )
        )
        db.commit()
    finally:
        db.close()

    try:
        client = TestClient(app)
        response = client.post(
            "/api/v1/auth/login",
            json={"username": "analyst", "password": test_password()},
        )
        assert response.status_code == 403
        assert response.json()["detail"] == "CSRF token missing"
    finally:
        for m, fn in saved.items():
            setattr(TestClient, m, fn)


def test_post_with_mismatched_csrf_rejected():
    client = TestClient(app)
    headers = fetch_csrf(client)
    headers["X-CSRF-Token"] = "tampered-token"
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "nobody", "password": "wrong"},
        headers=headers,
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "CSRF token invalid"


def test_post_with_csrf_succeeds():
    client = TestClient(app)
    headers = fetch_csrf(client)
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "analyst", "password": test_password()},
        headers=headers,
    )
    assert response.status_code == 200
    assert "ics_access_token" in response.cookies

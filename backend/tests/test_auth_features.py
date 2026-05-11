import os
import pytest
from datetime import timedelta

os.environ["DATABASE_URL"] = "sqlite:///./test_db.sqlite"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["ML_SERVICE_URL"] = "http://localhost:8001"
os.environ["JWT_SECRET_KEY"] = "test-secret"
os.environ["EXPOSE_AUTH_TOKENS"] = "True"  # Crucial for testing tokens!

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import get_password_hash
from app.db.base import Base
from app.main import app
from app.models.user import OnboardingStatus, User, UserRole
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
    # Clean users table before each test
    db_session.query(User).delete()
    db_session.commit()


@pytest.fixture(autouse=True)
def stub_password_reset_email(monkeypatch):
    monkeypatch.setattr(
        "app.api.routes.auth.send_password_reset_email",
        lambda *_args, **_kwargs: (True, None),
    )


@pytest.fixture(autouse=True)
def stub_verification_email(monkeypatch):
    monkeypatch.setattr(
        "app.api.routes.auth.send_verification_email",
        lambda *_args, **_kwargs: (True, None),
    )


def sample_ot_register(email: str, *, full_name: str = "Test User") -> dict:
    """Minimal valid payload for onboarding registration tests."""
    return {
        "full_name": full_name,
        "company_name": "ACME Controls Ltd",
        "email": email,
        "job_title": "OT Security Lead",
        "industry_type": "manufacturing",
        "infrastructure_type": "Modbus TCP / SCADA DMZ",
        "estimated_device_count": 120,
        "country": "Egypt",
        "purpose_of_access": (
            "Need OT attack detection for our manufacturing ICS and incident response coordination "
            "with the plant SOC."
        ),
        "operates_ot_ics": True,
        "password": "Password123",
    }


def test_registration_success(client, db_session):
    response = client.post("/api/v1/auth/register", json=sample_ot_register("test@example.com"))
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "test@example.com"
    assert data["username"] == "Test User"
    assert data["is_admin_approved"] is False
    assert data["onboarding_status"] == "pending"


def test_login_pending_token_me_ok_devices_forbidden(client, db_session):
    """Pending users may sign in for limited shell; OT APIs stay gated."""
    client.post(
        "/api/v1/auth/register",
        json=sample_ot_register("pending@example.com", full_name="Pending User"),
    )
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"username": "pending@example.com", "password": "Password123"},
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    assert token

    me_resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["onboarding_status"] == "pending"

    dev_resp = client.get("/api/v1/devices/me", headers={"Authorization": f"Bearer {token}"})
    assert dev_resp.status_code == 403
    assert "pending" in dev_resp.json()["detail"].lower() or "review" in dev_resp.json()["detail"].lower()


def test_pending_user_cannot_hit_alerts_endpoint(client, db_session):
    client.post(
        "/api/v1/auth/register",
        json=sample_ot_register("pend2@example.com", full_name="Pending Two"),
    )
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"username": "pend2@example.com", "password": "Password123"},
    )
    token = login_resp.json()["access_token"]
    # No alerts in empty DB — route must still enforce onboarding before querying.
    alerts = client.get("/api/v1/alerts", headers={"Authorization": f"Bearer {token}"})
    assert alerts.status_code == 403


def test_registration_duplicate_full_name_allowed(client, db_session):
    first = client.post("/api/v1/auth/register", json=sample_ot_register("first_dup_name@example.com", full_name="Same Name"))
    assert first.status_code == 201
    second = client.post("/api/v1/auth/register", json=sample_ot_register("second_dup_name@example.com", full_name="Same Name"))
    assert second.status_code == 201
    assert second.json()["username"] == "Same Name"
    assert second.json()["email"] == "second_dup_name@example.com"


def test_registration_duplicate_email(client, db_session):
    # Create first user
    client.post("/api/v1/auth/register", json=sample_ot_register("duplicate@example.com", full_name="Test User 1"))

    # Try to create second user with same email
    response = client.post("/api/v1/auth/register", json=sample_ot_register("duplicate@example.com", full_name="Test User 2"))
    
    assert response.status_code == 400
    assert response.json()["detail"] in [
        "Invalid email",
        "Email already registered",
        "An account with this email already exists",
    ]


def test_forgot_and_reset_password(client, db_session):
    # Register user
    client.post("/api/v1/auth/register", json=sample_ot_register("reset@example.com", full_name="Reset User"))
    
    # Forgot password
    forgot_resp = client.post("/api/v1/auth/forgot-password", json={
        "email": "reset@example.com"
    })
    assert forgot_resp.status_code == 200
    # Because EXPOSE_AUTH_TOKENS is True, we get the token in the response
    data = forgot_resp.json()
    assert "token" in data
    token = data["token"]
    
    # Reset password
    reset_resp = client.post("/api/v1/auth/reset-password", json={
        "token": token,
        "new_password": "NewPassword123"
    })
    assert reset_resp.status_code == 200
    assert reset_resp.json()["message"] == "Password has been reset"
    
    # Self-registered users need admin approval to sign in
    reset_user = db_session.query(User).filter(User.email == "reset@example.com").first()
    assert reset_user is not None
    reset_user.is_admin_approved = True
    reset_user.onboarding_status = OnboardingStatus.approved
    db_session.commit()

    # Verify we can login with new password
    login_resp = client.post("/api/v1/auth/login", json={
        "username": "reset@example.com",
        "password": "NewPassword123"
    })
    assert login_resp.status_code == 200


def test_email_verification(client, db_session):
    # Create user manually to skip the auto-verification token sent in register
    user = User(
        username="unverified",
        email="unverified@example.com",
        hashed_password=get_password_hash("Password123"),
        is_email_verified=False,
        is_admin_approved=True,
        onboarding_status=OnboardingStatus.approved,
    )
    db_session.add(user)
    db_session.commit()

    # Login to get access token
    login_resp = client.post("/api/v1/auth/login", json={
        "username": "unverified@example.com",
        "password": "Password123"
    })
    access_token = login_resp.json()["access_token"]
    
    # Request verification email
    req_resp = client.post("/api/v1/auth/request-email-verification", headers={
        "Authorization": f"Bearer {access_token}"
    })
    assert req_resp.status_code == 200
    token = req_resp.json()["token"]
    
    # Verify email
    verify_resp = client.post("/api/v1/auth/verify-email", json={
        "token": token
    })
    assert verify_resp.status_code == 200
    assert verify_resp.json()["message"] == "Email verified"
    
    # Check DB
    db_session.refresh(user)
    assert user.is_email_verified is True

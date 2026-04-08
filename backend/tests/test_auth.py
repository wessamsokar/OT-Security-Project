import os

os.environ["DATABASE_URL"] = "sqlite:///./test_auth.db"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["ML_SERVICE_URL"] = "http://localhost:8001"
os.environ["JWT_SECRET_KEY"] = "test-secret"

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import get_password_hash
from app.db.base import Base
from app.main import app
from app.models.user import User, UserRole


def test_login_success():
    engine = create_engine("sqlite:///./test_auth.db")
    TestingSessionLocal = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()
    try:
        db.query(User).delete()
        db.add(
            User(
                username="analyst",
                email="analyst@example.com",
                hashed_password=get_password_hash("secret123"),
                role=UserRole.analyst,
            )
        )
        db.commit()
    finally:
        db.close()

    client = TestClient(app)
    response = client.post("/api/v1/auth/login", json={"username": "analyst", "password": "secret123"})

    assert response.status_code == 200
    assert "access_token" in response.json()

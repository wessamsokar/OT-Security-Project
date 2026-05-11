import os
import pytest

os.environ["DATABASE_URL"] = "sqlite:///./test_db.sqlite"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["ML_SERVICE_URL"] = "http://localhost:8001"
os.environ["JWT_SECRET_KEY"] = "test-secret"
os.environ["PACKET_CAPTURE_DIR"] = "./test_captures"

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import patch

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
    admin = User(username="admin_capture", email="admin_capture@example.com", hashed_password="123", role=UserRole.admin)
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)
    return create_access_token(subject=str(admin.id))

@pytest.fixture
def viewer_token(db_session):
    viewer = User(
        username="viewer_capture",
        email="viewer_capture@example.com",
        hashed_password="123",
        role=UserRole.viewer,
        is_admin_approved=True,
    )
    db_session.add(viewer)
    db_session.commit()
    db_session.refresh(viewer)
    return create_access_token(subject=str(viewer.id))


@patch("app.api.routes.capture.start_packet_capture")
def test_capture_packets_success(mock_start, client, admin_token):
    # Mock scapy import within the route to prevent failure if scapy is missing
    with patch.dict('sys.modules', {'scapy': __import__('unittest.mock'), 'scapy.all': __import__('unittest.mock')}):
        response = client.post("/api/v1/packet-capture", json={
            "interface": "eth0",
            "duration_seconds": 5,
            "output_filename": "test_output.pcap"
        }, headers={"Authorization": f"Bearer {admin_token}"})
        
        assert response.status_code == 202
        assert response.json()["status"] == "started"
        assert "test_output.pcap" in response.json()["file_path"]
        
        # Verify background task was enqueued with a capture_id
        assert mock_start.call_count == 1
        called_kwargs = mock_start.call_args.kwargs
        assert "capture_id" in called_kwargs


def test_capture_stop_and_status_not_found(client, admin_token):
    stop_resp = client.post(
        "/api/v1/packet-capture/stop",
        json={"capture_id": "missing-capture-id"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert stop_resp.status_code == 404

    status_resp = client.get(
        "/api/v1/packet-capture/missing-capture-id/status",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert status_resp.status_code == 404


def test_capture_packets_forbidden(client, viewer_token):
    response = client.post("/api/v1/packet-capture", json={
        "interface": "eth0",
        "duration_seconds": 5
    }, headers={"Authorization": f"Bearer {viewer_token}"})
    
    assert response.status_code == 403

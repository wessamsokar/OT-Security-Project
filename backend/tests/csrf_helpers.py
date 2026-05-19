"""Test helpers for double-submit CSRF with FastAPI TestClient."""

from fastapi.testclient import TestClient


def fetch_csrf(client: TestClient) -> dict[str, str]:
    response = client.get("/api/v1/auth/csrf")
    assert response.status_code == 200, response.text
    token = response.json()["csrf_token"]
    return {"X-CSRF-Token": token}

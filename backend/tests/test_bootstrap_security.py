import os

import pytest
from pydantic import ValidationError

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_bootstrap.db")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("ML_SERVICE_URL", "http://localhost:8001")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-for-bootstrap-validation")


def test_bootstrap_rejects_weak_password(monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("BOOTSTRAP_ADMIN_ENABLED", "true")
    monkeypatch.setenv("BOOTSTRAP_ADMIN_EMAIL", "bootstrap@example.com")
    monkeypatch.setenv("BOOTSTRAP_ADMIN_PASSWORD", "admin123")

    from app.core.config import Settings

    with pytest.raises(ValidationError) as exc:
        Settings()
    assert "weak" in str(exc.value).lower() or "predictable" in str(exc.value).lower()


def test_bootstrap_disabled_by_default(monkeypatch):
    monkeypatch.delenv("BOOTSTRAP_ADMIN_ENABLED", raising=False)
    monkeypatch.setenv("APP_ENV", "development")

    from app.core.config import Settings

    settings = Settings()
    assert settings.bootstrap_admin_enabled is False
    assert settings.allows_bootstrap_admin() is False


def test_bootstrap_blocked_in_production(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("BOOTSTRAP_ADMIN_ENABLED", "true")
    monkeypatch.setenv("BOOTSTRAP_ADMIN_EMAIL", "bootstrap@example.com")
    monkeypatch.setenv("BOOTSTRAP_ADMIN_PASSWORD", "StrongUniquePassword1!")
    monkeypatch.setenv("AUTH_COOKIE_SECURE", "true")
    monkeypatch.setenv("ML_SERVICE_API_KEY", "x" * 24)
    monkeypatch.setenv("JWT_SECRET_KEY", "x" * 32)

    from app.core.config import Settings

    with pytest.raises(ValidationError) as exc:
        Settings()
    assert "BOOTSTRAP_ADMIN_ENABLED" in str(exc.value)

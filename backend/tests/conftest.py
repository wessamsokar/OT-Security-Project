"""Pytest hooks: auto-inject CSRF headers on TestClient unsafe methods."""

from __future__ import annotations

import os

import pytest

from tests.test_credentials import ensure_test_password

ensure_test_password()
os.environ["BOOTSTRAP_ADMIN_ENABLED"] = "false"
os.environ.pop("BOOTSTRAP_ADMIN_PASSWORD", None)
from fastapi.testclient import TestClient

_UNSAFE_METHODS = ("post", "put", "patch", "delete")
_ORIGINALS: dict[str, object] = {}


def _ensure_csrf_cookie(client: TestClient) -> str:
    token = client.cookies.get("ics_csrf_token")
    if not token:
        response = client.get("/api/v1/auth/csrf")
        assert response.status_code == 200, response.text
        token = response.json().get("csrf_token") or client.cookies.get("ics_csrf_token")
    assert token, "CSRF cookie not set"
    return token


def _with_csrf_headers(client: TestClient, headers: dict | None) -> dict:
    token = _ensure_csrf_cookie(client)
    merged = dict(headers or {})
    if "X-CSRF-Token" not in merged:
        merged["X-CSRF-Token"] = token
    return merged


def _wrap_method(name: str):
    original = getattr(TestClient, name)

    def wrapper(self: TestClient, url, *args, **kwargs):
        kwargs["headers"] = _with_csrf_headers(self, kwargs.get("headers"))
        return original(self, url, *args, **kwargs)

    return wrapper


@pytest.fixture(autouse=True)
def _patch_testclient_csrf():
    for method in _UNSAFE_METHODS:
        if method not in _ORIGINALS:
            _ORIGINALS[method] = getattr(TestClient, method)
        setattr(TestClient, method, _wrap_method(method))
    yield
    for method, original in _ORIGINALS.items():
        setattr(TestClient, method, original)

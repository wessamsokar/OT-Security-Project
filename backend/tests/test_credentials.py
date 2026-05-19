"""Test-only credential helpers. Do not import from application code."""

from __future__ import annotations

import os
import secrets

_ENV_KEY = "ICS_TEST_PASSWORD"


def ensure_test_password() -> str:
    existing = os.environ.get(_ENV_KEY)
    if existing:
        return existing
    generated = f"Tst-{secrets.token_urlsafe(16)}!1Aa"
    os.environ[_ENV_KEY] = generated
    return generated


def test_password() -> str:
    return ensure_test_password()

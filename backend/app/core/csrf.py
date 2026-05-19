"""CSRF token generation and double-submit validation."""

import secrets
from typing import Final

from fastapi import HTTPException, Request, status

from app.core.config import Settings, get_settings

UNSAFE_HTTP_METHODS: Final[frozenset[str]] = frozenset({"POST", "PUT", "PATCH", "DELETE"})

# Paths exempt from CSRF (no session cookie auth or health probes)
CSRF_EXEMPT_SUFFIXES: Final[tuple[str, ...]] = (
    "/healthz",
    "/readyz",
    "/metrics",
)

def generate_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def _normalized_path(path: str) -> str:
    if not path:
        return "/"
    path = path.rstrip("/") or "/"
    return path


def is_csrf_exempt(request: Request) -> bool:
    path = _normalized_path(request.url.path)
    settings = get_settings()
    api_prefix = _normalized_path(settings.api_v1_prefix)
    token_flow_paths = {
        f"{api_prefix}/auth/reset-password",
        f"{api_prefix}/auth/verify-email",
        f"{api_prefix}/audit/csp-report",
    }
    if path in token_flow_paths:
        return True
    if any(path.endswith(suffix) for suffix in CSRF_EXEMPT_SUFFIXES):
        return True
    return False


def requires_csrf_validation(request: Request) -> bool:
    if request.method.upper() not in UNSAFE_HTTP_METHODS:
        return False
    settings = get_settings()
    if not settings.csrf_protection_enabled:
        return False
    return not is_csrf_exempt(request)


def validate_csrf(request: Request, settings: Settings | None = None) -> None:
    """
    Double Submit Cookie: header X-CSRF-Token must match non-HttpOnly csrf cookie.

    Attackers on other origins cannot read our cookie to forge the header; cross-site
    form POSTs do not send custom headers.
    """
    settings = settings or get_settings()
    cookie_token = request.cookies.get(settings.csrf_cookie_name)
    header_token = request.headers.get(settings.csrf_header_name)

    if not cookie_token or not header_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token missing",
        )

    if not secrets.compare_digest(cookie_token, header_token):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token invalid",
        )

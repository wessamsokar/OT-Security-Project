"""Centralized HTTP cookie helpers for auth and CSRF."""

from fastapi import Response

from app.core.config import Settings, get_settings


def set_auth_cookie(response: Response, token: str, settings: Settings | None = None) -> None:
    settings = settings or get_settings()
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=token,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite,
        max_age=settings.jwt_access_token_expire_minutes * 60,
        path=settings.auth_cookie_path,
    )


def clear_auth_cookie(response: Response, settings: Settings | None = None) -> None:
    settings = settings or get_settings()
    response.delete_cookie(
        key=settings.auth_cookie_name,
        path=settings.auth_cookie_path,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite,
        httponly=True,
    )


def set_csrf_cookie(response: Response, token: str, settings: Settings | None = None) -> None:
    """Non-HttpOnly cookie so the SPA can mirror it in X-CSRF-Token (double-submit)."""
    settings = settings or get_settings()
    response.set_cookie(
        key=settings.csrf_cookie_name,
        value=token,
        httponly=False,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite,
        max_age=settings.csrf_token_expire_hours * 3600,
        path=settings.auth_cookie_path,
    )


def clear_csrf_cookie(response: Response, settings: Settings | None = None) -> None:
    settings = settings or get_settings()
    response.delete_cookie(
        key=settings.csrf_cookie_name,
        path=settings.auth_cookie_path,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite,
        httponly=False,
    )

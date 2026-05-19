"""Known weak or predictable credentials — blocked for bootstrap and documented in audits."""

from __future__ import annotations

# Substrings that indicate placeholder/example secrets (JWT, DB, etc.)
INSECURE_SECRET_MARKERS = (
    "change-me",
    "super-secret",
    "dev-secret",
    "your-secret",
    "replace_with",
    "example",
    "placeholder",
)

# Passwords that must never be used for bootstrap or committed as examples
WEAK_KNOWN_PASSWORDS: frozenset[str] = frozenset(
    {
        "admin",
        "admin123",
        "password",
        "password123",
        "changeme",
        "secret",
        "secret123",
        "123456",
        "12345678",
        "qwerty",
        "letmein",
        "welcome",
        "customer123",
        "ics_password",
        "test",
        "test123",
    }
)

BOOTSTRAP_ALLOWED_ENVS: frozenset[str] = frozenset({"development", "dev", "local", "test"})

BOOTSTRAP_PASSWORD_MIN_LENGTH = 12


def is_weak_known_password(password: str) -> bool:
    if not password:
        return True
    normalized = password.strip().lower()
    if normalized in WEAK_KNOWN_PASSWORDS:
        return True
    if any(marker in normalized for marker in ("admin123", "password123", "changeme")):
        return True
    return False


def validate_bootstrap_password(password: str) -> None:
    if len(password) < BOOTSTRAP_PASSWORD_MIN_LENGTH:
        raise ValueError(
            f"BOOTSTRAP_ADMIN_PASSWORD must be at least {BOOTSTRAP_PASSWORD_MIN_LENGTH} characters"
        )
    if is_weak_known_password(password):
        raise ValueError(
            "BOOTSTRAP_ADMIN_PASSWORD is a known weak or predictable value; "
            "set a unique secret (e.g. openssl rand -base64 24)"
        )

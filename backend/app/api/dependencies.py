from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.security import decode_token
from app.db.session import get_db
from app.models.user import OnboardingStatus, User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def role_is_admin(role: object) -> bool:
    """Compare flexibly — some DB drivers / Enum bindings differ from strict ``UserRole.admin``."""
    if role is None:
        return False
    if isinstance(role, UserRole):
        return role == UserRole.admin
    raw = getattr(role, "value", role)
    return str(raw).split(".")[-1].lower() == UserRole.admin.value


def user_bypasses_admin_approval_gate(user: User, settings: Settings) -> bool:
    """Platform access after onboarding review (approved) plus legacy bootstrap paths."""
    if role_is_admin(user.role):
        return True
    email_lower = (user.email or "").strip().lower()
    boot = (settings.bootstrap_admin_email or "").strip().lower()
    if boot and email_lower == boot:
        return True
    if email_lower in settings.hidden_admin_emails_list:
        return True
    # Source of truth: onboarding_status (synced with is_admin_approved in API).
    onboarding = getattr(user, "onboarding_status", None)
    if onboarding == OnboardingStatus.rejected:
        return False
    if onboarding == OnboardingStatus.approved:
        return True
    if onboarding == OnboardingStatus.pending:
        return False
    return bool(user.is_admin_approved)


def enforce_ot_platform_access(user: User, settings: Settings | None = None) -> None:
    """
    Raise 403 unless the user may access OT monitoring, telemetry, and admin tooling.

    Use after ``get_authenticated_user`` for routes that expose sensitive OT data.
    """
    settings = settings or get_settings()
    if getattr(user, "onboarding_status", None) == OnboardingStatus.rejected:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Your onboarding request was not approved. "
                "Contact your ICS security administrator if you need more information."
            ),
        )

    if not user_bypasses_admin_approval_gate(user, settings):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Your organization request is pending administrative review. "
                "OT monitoring and analytics are unavailable until your access is approved."
            ),
        )


def _load_user_from_token(db: Session, token: str) -> User:
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    sub = payload["sub"]
    user: User | None = None
    try:
        uid = int(sub)
        user = db.query(User).filter(User.id == uid).first()
    except (ValueError, TypeError):
        user = db.query(User).filter(User.username == sub).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def get_authenticated_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> User:
    """Valid JWT and existing user — does not gate onboarding (use for `/auth/me` and similar)."""
    return _load_user_from_token(db, token)


def get_current_user(user: User = Depends(get_authenticated_user)) -> User:
    """Full OT platform session: approved org (or admin/bootstrap), rejects pending/rejected customers."""
    enforce_ot_platform_access(user)
    return user


def _normalize_role(role: UserRole | str) -> str:
    if isinstance(role, UserRole):
        value = role.value
    else:
        value = str(role)

    lowered = value.lower()
    if lowered in {"analyst", "viewer"}:
        return UserRole.customer.value
    return lowered


def require_roles(*roles: UserRole | str):
    allowed = {_normalize_role(role).lower() for role in roles}

    def validator(current_user: User = Depends(get_current_user)) -> User:
        user_roles = set()
        if current_user.role:
            user_roles.add(_normalize_role(current_user.role).lower())
        if getattr(current_user, "roles", None):
            user_roles.update({role.name.lower() for role in current_user.roles if role and role.name})

        if user_roles.isdisjoint(allowed):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user

    return validator

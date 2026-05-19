from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.security import decode_token
from app.db.session import get_db
from app.models.user import OnboardingStatus, User, UserRole
from app.services.audit import record_audit
from app.services.permissions import user_has_any_permission, user_has_permission, user_is_admin

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


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
    # Analyst and viewer accounts never need admin approval.
    role_val = str(getattr(user.role, "value", user.role)).lower()
    if role_val in ("analyst", "viewer"):
        return True
    email_lower = (user.email or "").strip().lower()
    boot = (settings.bootstrap_admin_email or "").strip().lower()
    if boot and email_lower == boot:
        return True
    if email_lower in settings.hidden_admin_emails_list:
        return True
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

    Approval is only required for customer-role accounts. Analysts, viewers, and
    admins bypass the gate entirely.

    Use after ``get_authenticated_user`` for routes that expose sensitive OT data.
    """
    settings = settings or get_settings()

    # Rejected users are always blocked regardless of role.
    if getattr(user, "onboarding_status", None) == OnboardingStatus.rejected:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Your onboarding request was not approved. "
                "Contact your ICS security administrator if you need more information."
            ),
        )

    # Non-customer roles (analyst, viewer, admin) bypass the approval gate.
    role_val = str(getattr(user.role, "value", user.role)).lower()
    if role_val in ("admin", "analyst", "viewer"):
        return

    # Customer accounts: must be explicitly approved.
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
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User is inactive")
    return user


def _token_from_request(request: Request, bearer_token: str | None) -> str:
    if bearer_token:
        return bearer_token

    settings = get_settings()
    cookie_token = request.cookies.get(settings.auth_cookie_name)
    if cookie_token:
        return cookie_token

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")


def get_authenticated_user(
    request: Request,
    db: Session = Depends(get_db),
    token: str | None = Depends(oauth2_scheme),
) -> User:
    """Valid JWT from HttpOnly cookie or Bearer header; does not gate onboarding."""
    token = _token_from_request(request, token)
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

    return value.lower()


def require_roles(*roles: UserRole | str):
    """Legacy role-name guard; prefer ``require_permission`` for new endpoints."""
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


def require_permission(*permission_codes: str):
    """Centralized permission check; admin role bypasses all codes."""

    def validator(
        request: Request,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        if user_is_admin(current_user):
            return current_user

        codes = tuple(permission_codes)
        if not user_has_any_permission(db, current_user, codes):
            record_audit(
                db,
                action="permission.denied",
                category="authz",
                actor=current_user,
                request=request,
                success=False,
                detail=f"Missing any of: {', '.join(codes)}",
                metadata={"required": list(codes)},
            )
            db.commit()
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user

    return validator


def require_all_permissions(*permission_codes: str):
    """Require every listed permission (admin bypass)."""

    def validator(
        request: Request,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        if user_is_admin(current_user):
            return current_user

        missing = [c for c in permission_codes if not user_has_permission(db, current_user, c)]
        if missing:
            record_audit(
                db,
                action="permission.denied",
                category="authz",
                actor=current_user,
                request=request,
                success=False,
                detail=f"Missing: {', '.join(missing)}",
                metadata={"missing": missing},
            )
            db.commit()
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user

    return validator

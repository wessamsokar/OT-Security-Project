import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import get_authenticated_user
from app.core.config import get_settings
from app.core.cookies import clear_auth_cookie, clear_csrf_cookie, set_auth_cookie, set_csrf_cookie
from app.core.csrf import generate_csrf_token
from app.core.security import create_access_token, get_password_hash, verify_password
from app.db.session import get_db
from app.models.auth_token import AuthTokenType
from app.models.user import OnboardingStatus, User, UserRole
from app.schemas.auth import (
    CsrfResponse,
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    ResetPasswordRequest,
    UserResponse,
    VerifyEmailRequest,
)
from app.services.audit import record_audit
from app.services.auth_tokens import consume_user_token, create_user_token, invalidate_user_tokens
from app.services.email import send_password_reset_email, send_verification_email
from app.services.permissions import resolve_user_permissions

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()
logger = logging.getLogger(__name__)


def _rotate_csrf(response: Response) -> str:
    token = generate_csrf_token()
    set_csrf_cookie(response, token)
    return token


@router.get("/csrf", response_model=CsrfResponse)
def issue_csrf_token(response: Response) -> CsrfResponse:
    """Issue or refresh CSRF cookie (call before any unsafe request from the SPA)."""
    token = _rotate_csrf(response)
    return CsrfResponse(csrf_token=token)


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> UserResponse:
    full_name = payload.full_name.strip()
    email = payload.email.strip().lower()

    existing_email = db.query(User).filter(func.lower(User.email) == email).first()
    if existing_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="An account with this email already exists")

    industry_val = payload.industry_type.value

    user = User(
        username=full_name,
        email=email,
        hashed_password=get_password_hash(payload.password),
        role=UserRole.customer,
        is_active=True,
        is_email_verified=False,
        is_admin_approved=False,
        admin_approved_at=None,
        onboarding_status=OnboardingStatus.pending,
        rejected_at=None,
        company_name=payload.company_name.strip(),
        job_title=payload.job_title.strip(),
        industry_type=industry_val,
        infrastructure_type=payload.infrastructure_type.strip(),
        estimated_device_count=payload.estimated_device_count,
        country=payload.country.strip(),
        purpose_of_access=payload.purpose_of_access.strip(),
        operates_ot_ics=payload.operates_ot_ics,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if db.query(User).filter(func.lower(User.email) == email).first():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="An account with this email already exists")

        raw = ""
        if getattr(exc, "orig", None):
            raw = str(exc.orig)
        if not raw:
            raw = str(exc)
        lowered = raw.lower()
        logger.warning("Registration integrity error: %s", raw[:500])

        # PostgreSQL/SQLite unique on username — migration 20260511_01 drops this so duplicate display names work.
        if "username" in lowered or "users_username" in lowered:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Duplicate display names require database migration 20260512_01. "
                    "Restart the backend container (it runs `alembic upgrade head`) or run that command manually, "
                    "then try again — or use a different full name until migrations apply."
                ),
            )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration could not be saved. Try another email or contact support if this persists.",
        )

    db.refresh(user)

    token = create_user_token(
        db,
        user.id,
        AuthTokenType.email_verification,
        timedelta(hours=settings.email_verification_token_expire_hours),
    )
    db.commit()

    background_tasks.add_task(send_verification_email, user.email, token)
    return user


@router.post("/login", response_model=MessageResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> MessageResponse:
    identifier = payload.username.strip()
    user: User | None = None
    if "@" in identifier:
        user = db.query(User).filter(func.lower(User.email) == identifier.lower()).first()
    else:
        matches = db.query(User).filter(User.username == identifier).all()
        if len(matches) == 1:
            user = matches[0]
        elif len(matches) > 1:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Several accounts use this name. Sign in with your email address.",
            )

    if not user or not verify_password(payload.password, user.hashed_password):
        record_audit(
            db,
            action="auth.login.failed",
            category="auth",
            request=request,
            success=False,
            detail=identifier[:120],
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")

    # Only customer accounts require admin approval before login.
    if user.role == UserRole.customer and user.onboarding_status == OnboardingStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="pending_approval",
        )

    if user.onboarding_status == OnboardingStatus.rejected:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Your organization’s access request was not approved. "
                "Contact your administrator if you need more information."
            ),
        )

    if settings.email_verification_required and not user.is_email_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email verification required")

    token = create_access_token(
        subject=str(user.id),
        expires_delta=timedelta(minutes=settings.jwt_access_token_expire_minutes),
        extra_claims={"onboarding_status": user.onboarding_status.value},
    )
    set_auth_cookie(response, token)
    _rotate_csrf(response)
    record_audit(
        db,
        action="auth.login.success",
        category="auth",
        actor=user,
        request=request,
        resource_type="user",
        resource_id=user.id,
    )
    db.commit()
    return MessageResponse(message="Logged in")


@router.get("/me", response_model=UserResponse)
def me(
    current_user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
) -> UserResponse:
    perms = sorted(resolve_user_permissions(db, current_user))
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        role=current_user.role,
        is_email_verified=current_user.is_email_verified,
        is_admin_approved=current_user.is_admin_approved,
        onboarding_status=current_user.onboarding_status.value
        if hasattr(current_user.onboarding_status, "value")
        else str(current_user.onboarding_status),
        permissions=perms,
    )


@router.post("/logout", response_model=MessageResponse)
def logout(request: Request, response: Response, db: Session = Depends(get_db)) -> MessageResponse:
    cookie_token = request.cookies.get(settings.auth_cookie_name)
    if cookie_token:
        from app.api.dependencies import _load_user_from_token

        try:
            user = _load_user_from_token(db, cookie_token)
            record_audit(
                db,
                action="auth.logout",
                category="auth",
                actor=user,
                request=request,
                resource_type="user",
                resource_id=user.id,
            )
            db.commit()
        except HTTPException:
            pass
    clear_auth_cookie(response)
    clear_csrf_cookie(response)
    return MessageResponse(message="Logged out")


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(
    payload: ForgotPasswordRequest,
    db: Session = Depends(get_db),
) -> MessageResponse:
    email = payload.email.strip().lower()
    user = db.query(User).filter(func.lower(User.email) == email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid email.")

    invalidate_user_tokens(db, user.id, AuthTokenType.password_reset)
    token = create_user_token(
        db,
        user.id,
        AuthTokenType.password_reset,
        timedelta(minutes=settings.password_reset_token_expire_minutes),
    )
    db.commit()
    sent, smtp_diag = send_password_reset_email(user.email, token)
    if not sent:
        base = "Unable to send password reset email. Check email (SMTP) settings or try again later."
        if settings.app_debug and smtp_diag:
            detail = f"{base} ({smtp_diag})"
        else:
            detail = base
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=detail)
    return MessageResponse(
        message="Reset link sent successfully.",
        token=token if (settings.expose_auth_tokens or settings.app_debug) else None,
    )


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)) -> MessageResponse:
    auth_token = consume_user_token(db, payload.token, AuthTokenType.password_reset)
    if not auth_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")

    user = db.query(User).filter(User.id == auth_token.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.hashed_password = get_password_hash(payload.new_password)
    db.add(user)
    db.commit()
    return MessageResponse(message="Password has been reset")


@router.post("/request-email-verification", response_model=MessageResponse)
def request_email_verification(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    if current_user.is_email_verified:
        return MessageResponse(message="Email is already verified")

    invalidate_user_tokens(db, current_user.id, AuthTokenType.email_verification)
    token = create_user_token(
        db,
        current_user.id,
        AuthTokenType.email_verification,
        timedelta(hours=settings.email_verification_token_expire_hours),
    )
    db.commit()

    background_tasks.add_task(send_verification_email, current_user.email, token)

    return MessageResponse(
        message="Verification email sent.",
        token=token if (settings.expose_auth_tokens or settings.app_debug) else None,
    )


@router.post("/verify-email", response_model=MessageResponse)
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)) -> MessageResponse:
    auth_token = consume_user_token(db, payload.token, AuthTokenType.email_verification)
    if not auth_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")

    user = db.query(User).filter(User.id == auth_token.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if not user.is_email_verified:
        user.is_email_verified = True
        user.email_verified_at = datetime.utcnow()
        db.add(user)

    db.commit()
    return MessageResponse(message="Email verified")

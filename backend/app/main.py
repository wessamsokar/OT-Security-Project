from datetime import datetime
import logging
from time import perf_counter

from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from app.api.dependencies import _load_user_from_token, oauth2_scheme
from app.api.router import api_router, health_router
from app.middleware.csrf import CsrfMiddleware
import app.models  # noqa: F401
from app.core.config import get_settings
from app.core.insecure_defaults import validate_bootstrap_password
from app.core.logging import configure_logging
from app.core.security import get_password_hash
from app.db.session import SessionLocal, get_db
from app.models.user import OnboardingStatus, User, UserRole

settings = get_settings()
configure_logging()
logger = logging.getLogger(__name__)

REQUEST_COUNT = Counter("backend_http_requests_total", "Total backend HTTP requests", ["method", "path", "status"])
REQUEST_LATENCY = Histogram("backend_http_request_duration_seconds", "Backend request latency", ["method", "path"])

limiter = Limiter(key_func=get_remote_address, default_limits=[f"{settings.rate_limit_per_minute}/minute"])

app = FastAPI(title=settings.app_name)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, lambda request, exc: Response("Rate limit exceeded", status_code=429))
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(CsrfMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        settings.csrf_header_name,
        "Accept",
    ],
    expose_headers=["X-Request-Id"],
)


def _metric_path(request: Request) -> str:
    route = request.scope.get("route")
    path = getattr(route, "path", None)
    if isinstance(path, str) and path:
        return path
    return request.url.path


def _bootstrap_admin_user() -> None:
    if not settings.allows_bootstrap_admin():
        return

    email = settings.bootstrap_admin_email.strip().lower()
    password = settings.bootstrap_admin_password
    full_name = settings.bootstrap_admin_name.strip() or "Admin"

    if not email or not password:
        logger.warning("Bootstrap admin is enabled but missing email/password")
        return

    try:
        validate_bootstrap_password(password)
    except ValueError as exc:
        logger.error("Bootstrap admin refused: %s", exc)
        return

    db = SessionLocal()
    try:
        if db.query(User).filter(User.role == UserRole.admin).first():
            return

        if db.query(User).filter(User.email == email).first():
            return

        admin = User(
            username=full_name,
            email=email,
            hashed_password=get_password_hash(password),
            role=UserRole.admin,
            is_active=True,
            is_email_verified=True,
            email_verified_at=datetime.utcnow(),
            is_admin_approved=True,
            admin_approved_at=datetime.utcnow(),
            onboarding_status=OnboardingStatus.approved,
            rejected_at=None,
        )
        db.add(admin)
        db.commit()
        logger.warning(
            "Bootstrap admin provisioned (development only); password was not logged",
            extra={"email": email},
        )
    except Exception:
        logger.exception("Failed to bootstrap admin user")
    finally:
        db.close()


@app.middleware("http")
async def secure_headers_and_metrics(request: Request, call_next):
    start = perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        metric_path = _metric_path(request)
        REQUEST_COUNT.labels(request.method, metric_path, "500").inc()
        REQUEST_LATENCY.labels(request.method, metric_path).observe(perf_counter() - start)
        logger.exception("Unhandled request error", extra={"path": request.url.path, "method": request.method})
        raise
    duration = perf_counter() - start
    metric_path = _metric_path(request)

    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    if settings.is_production:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = (
            "default-src 'none'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'"
        )

    REQUEST_COUNT.labels(request.method, metric_path, str(response.status_code)).inc()
    REQUEST_LATENCY.labels(request.method, metric_path).observe(duration)
    return response


@app.get("/metrics")
def metrics(
    request: Request,
    db=Depends(get_db),
    token: str | None = Depends(oauth2_scheme),
) -> Response:
    if settings.metrics_public:
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
    from app.services.permissions import user_is_admin

    raw_token = token or request.cookies.get(settings.auth_cookie_name)
    if not raw_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    user = _load_user_from_token(db, raw_token)
    if not user_is_admin(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Metrics restricted")
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.on_event("startup")
def on_startup() -> None:
    logger.info(
        "Starting backend",
        extra={
            "app_env": settings.app_env,
            "api_v1_prefix": settings.api_v1_prefix,
            "ml_service_url": settings.ml_service_url,
        },
    )
    _bootstrap_admin_user()


app.include_router(api_router, prefix=settings.api_v1_prefix)
app.include_router(health_router)

from datetime import datetime
import logging
from time import perf_counter

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from app.api.router import api_router, health_router
import app.models  # noqa: F401
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.security import get_password_hash
from app.db.session import SessionLocal
from app.models.user import User, UserRole

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _bootstrap_admin_user() -> None:
    if not settings.bootstrap_admin_enabled:
        return

    email = settings.bootstrap_admin_email.strip().lower()
    password = settings.bootstrap_admin_password
    full_name = settings.bootstrap_admin_name.strip() or "Admin"

    if not email or not password:
        logger.warning("Bootstrap admin is enabled but missing email/password")
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
        )
        db.add(admin)
        db.commit()
        logger.info("Bootstrap admin account created", extra={"email": email})
    except Exception:
        logger.exception("Failed to bootstrap admin user")
    finally:
        db.close()


@app.middleware("http")
async def secure_headers_and_metrics(request: Request, call_next):
    start = perf_counter()
    response = await call_next(request)
    duration = perf_counter() - start

    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "geolocation=()"

    REQUEST_COUNT.labels(request.method, request.url.path, str(response.status_code)).inc()
    REQUEST_LATENCY.labels(request.method, request.url.path).observe(duration)
    return response


@app.get("/metrics")
def metrics() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.on_event("startup")
def on_startup() -> None:
    _bootstrap_admin_user()


app.include_router(api_router, prefix=settings.api_v1_prefix)
app.include_router(health_router)

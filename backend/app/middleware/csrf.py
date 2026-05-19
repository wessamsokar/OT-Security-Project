"""ASGI middleware enforcing CSRF on state-changing API requests."""

import logging

from fastapi import HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.csrf import requires_csrf_validation, validate_csrf
from app.db.session import SessionLocal
from app.services.audit import record_audit

logger = logging.getLogger(__name__)


class CsrfMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        if requires_csrf_validation(request):
            try:
                validate_csrf(request)
            except HTTPException as exc:
                db = SessionLocal()
                try:
                    record_audit(
                        db,
                        action="csrf.denied",
                        category="auth",
                        request=request,
                        success=False,
                        detail=str(exc.detail),
                    )
                    db.commit()
                except Exception:
                    logger.exception("Failed to write CSRF audit log")
                finally:
                    db.close()
                return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

        return await call_next(request)

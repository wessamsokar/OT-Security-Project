from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_permission
from app.core.config import get_settings
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.audit import AuditLogResponse, ClientSecurityEvent, CspViolationReport
from app.services.audit import record_audit

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", response_model=list[AuditLogResponse])
def list_audit_logs(
    db: Session = Depends(get_db),
    _user=Depends(require_permission("view_audit_logs")),
    category: str | None = Query(default=None),
    action: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[AuditLogResponse]:
    query = db.query(AuditLog).order_by(AuditLog.created_at.desc())
    if category:
        query = query.filter(AuditLog.category == category.strip()[:32])
    if action:
        query = query.filter(AuditLog.action == action.strip()[:64])
    return query.limit(limit).all()


@router.post("/client-security-event", status_code=status.HTTP_202_ACCEPTED)
def record_client_security_event(
    payload: ClientSecurityEvent,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    record_audit(
        db,
        action=payload.action,
        category="frontend_security",
        actor=current_user,
        request=request,
        success=payload.severity not in {"high", "critical"},
        detail=payload.reason,
        metadata={
            "severity": payload.severity,
            "score": payload.score,
            "signals": payload.signals,
            **payload.metadata,
        },
    )
    db.commit()
    return {"status": "recorded"}


@router.post("/csp-report", status_code=status.HTTP_204_NO_CONTENT)
def record_csp_violation(
    payload: CspViolationReport,
    request: Request,
    db: Session = Depends(get_db),
) -> None:
    settings = get_settings()
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > settings.csp_report_max_bytes:
                raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="CSP report too large")
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid content length") from None

    report = payload.csp_report or payload.body or {}
    record_audit(
        db,
        action="runtime.integrity.failure",
        category="frontend_security",
        request=request,
        success=False,
        detail="CSP violation report",
        metadata={
            "blocked_uri": str(report.get("blocked-uri") or report.get("blockedURL") or "")[:300],
            "violated_directive": str(report.get("violated-directive") or report.get("effectiveDirective") or "")[:160],
            "document_uri": str(report.get("document-uri") or report.get("documentURL") or "")[:300],
            "source_file": str(report.get("source-file") or report.get("sourceFile") or "")[:300],
        },
    )
    db.commit()
    return None

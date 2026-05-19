import json
import logging
from typing import Any

from fastapi import Request
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.user import User

logger = logging.getLogger("ics.audit")


def _client_ip(request: Request | None) -> str | None:
    if request is None:
        return None
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()[:64]
    if request.client:
        return request.client.host
    return None


def _user_agent(request: Request | None) -> str | None:
    if request is None:
        return None
    ua = request.headers.get("user-agent")
    return ua[:512] if ua else None


def record_audit(
    db: Session,
    *,
    action: str,
    category: str,
    actor: User | None = None,
    request: Request | None = None,
    resource_type: str | None = None,
    resource_id: str | int | None = None,
    success: bool = True,
    detail: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> AuditLog:
    entry = AuditLog(
        actor_user_id=actor.id if actor else None,
        actor_email=(actor.email or "").strip().lower() if actor and actor.email else None,
        action=action[:64],
        category=category[:32],
        resource_type=resource_type[:64] if resource_type else None,
        resource_id=str(resource_id)[:64] if resource_id is not None else None,
        ip_address=_client_ip(request),
        user_agent=_user_agent(request),
        success=success,
        detail=detail,
        metadata_json=json.dumps(metadata, default=str)[:8000] if metadata else None,
    )
    db.add(entry)
    db.flush()
    logger.info(
        "audit",
        extra={
            "audit_action": action,
            "audit_category": category,
            "actor_user_id": entry.actor_user_id,
            "success": success,
        },
    )
    return entry

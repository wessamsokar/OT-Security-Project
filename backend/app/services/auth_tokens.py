import hashlib
import hmac
import secrets
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.auth_token import AuthToken, AuthTokenType

settings = get_settings()


def _hash_token(raw_token: str) -> str:
    return hmac.new(
        settings.jwt_secret_key.encode("utf-8"),
        raw_token.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def create_user_token(
    db: Session,
    user_id: int,
    token_type: AuthTokenType,
    expires_delta: timedelta,
) -> str:
    token = secrets.token_urlsafe(32)
    token_hash = _hash_token(token)
    expires_at = datetime.utcnow() + expires_delta

    auth_token = AuthToken(
        user_id=user_id,
        token_hash=token_hash,
        token_type=token_type,
        expires_at=expires_at,
    )
    db.add(auth_token)
    return token


def consume_user_token(db: Session, raw_token: str, token_type: AuthTokenType) -> AuthToken | None:
    token_hash = _hash_token(raw_token)
    now = datetime.utcnow()

    auth_token = (
        db.query(AuthToken)
        .filter(
            AuthToken.token_hash == token_hash,
            AuthToken.token_type == token_type,
            AuthToken.used_at.is_(None),
            AuthToken.expires_at >= now,
        )
        .first()
    )
    if not auth_token:
        return None

    auth_token.used_at = now
    db.add(auth_token)
    return auth_token


def invalidate_user_tokens(db: Session, user_id: int, token_type: AuthTokenType) -> int:
    now = datetime.utcnow()
    rows = (
        db.query(AuthToken)
        .filter(
            AuthToken.user_id == user_id,
            AuthToken.token_type == token_type,
            AuthToken.used_at.is_(None),
        )
        .update({AuthToken.used_at: now}, synchronize_session=False)
    )
    return int(rows or 0)

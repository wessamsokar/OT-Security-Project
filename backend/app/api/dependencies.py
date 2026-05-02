from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.session import get_db
from app.models.user import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> User:
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.query(User).filter(User.username == payload["sub"]).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
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
    allowed = { _normalize_role(role).lower() for role in roles }

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

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import require_roles
from app.core.config import get_settings
from app.core.security import get_password_hash
from app.db.session import get_db
from app.models.alert import Alert, AlertSeverity
from app.models.device import Device
from app.models.incident import Incident
from app.models.traffic_record import TrafficRecord
from app.models.user import User, UserRole
from app.schemas.alerts import ActiveThreatResponse, AlertResponse
from app.schemas.devices import DeviceResponse
from app.schemas.incidents import IncidentResponse
from app.schemas.traffic import TrafficRecordResponse
from app.schemas.users import UserAdminResponse, UserCreate, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])
settings = get_settings()


@router.get("", response_model=list[UserAdminResponse])
def list_users(
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles(UserRole.admin)),
    q: str | None = Query(default=None, min_length=1),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[UserAdminResponse]:
    query = db.query(User)
    hidden_emails = [settings.bootstrap_admin_email]
    hidden_emails.extend(settings.hidden_admin_emails_list)
    hidden_emails = [email.lower() for email in hidden_emails if email]
    if hidden_emails:
        query = query.filter(func.lower(User.email).not_in(hidden_emails))
    if q:
        needle = f"%{q.strip().lower()}%"
        query = query.filter(
            func.lower(User.username).like(needle) | func.lower(User.email).like(needle)
        )
    return query.order_by(User.created_at.desc()).limit(limit).all()


@router.post("", response_model=UserAdminResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles(UserRole.admin)),
) -> UserAdminResponse:
    username = payload.username.strip()
    email = payload.email.strip().lower()

    if db.query(User).filter(func.lower(User.email) == email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    if db.query(User).filter(func.lower(User.username) == username.lower()).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already exists")

    user = User(
        username=username,
        email=email,
        hashed_password=get_password_hash(payload.password),
        role=payload.role,
        is_active=payload.is_active,
        is_email_verified=payload.is_email_verified,
        email_verified_at=datetime.utcnow() if payload.is_email_verified else None,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user payload")
    db.refresh(user)
    return user


@router.get("/{user_id}", response_model=UserAdminResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles(UserRole.admin)),
) -> UserAdminResponse:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def _get_user_or_404(db: Session, user_id: int) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.get("/{user_id}/devices", response_model=list[DeviceResponse])
def list_user_devices(
    user_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles(UserRole.admin)),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[DeviceResponse]:
    _get_user_or_404(db, user_id)
    return (
        db.query(Device)
        .filter(Device.user_id == user_id)
        .order_by(Device.created_at.desc())
        .limit(limit)
        .all()
    )


@router.get("/{user_id}/alerts", response_model=list[AlertResponse])
def list_user_alerts(
    user_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles(UserRole.admin)),
    limit: int = Query(default=200, ge=1, le=500),
) -> list[AlertResponse]:
    _get_user_or_404(db, user_id)
    return (
        db.query(Alert)
        .join(TrafficRecord, TrafficRecord.id == Alert.traffic_record_id)
        .filter(TrafficRecord.user_id == user_id)
        .order_by(Alert.created_at.desc())
        .limit(limit)
        .all()
    )


@router.get("/{user_id}/threats", response_model=list[ActiveThreatResponse])
def list_user_threats(
    user_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles(UserRole.admin)),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[ActiveThreatResponse]:
    _get_user_or_404(db, user_id)
    rows = (
        db.query(Alert, TrafficRecord)
        .join(TrafficRecord, TrafficRecord.id == Alert.traffic_record_id)
        .filter(TrafficRecord.user_id == user_id)
        .filter(Alert.severity.in_([AlertSeverity.critical, AlertSeverity.high]))
        .order_by(Alert.created_at.desc())
        .limit(limit)
        .all()
    )

    result: list[ActiveThreatResponse] = []
    for alert, record in rows:
        result.append(
            ActiveThreatResponse(
                threat_id=f"T-{alert.id}",
                attack_vector=record.attack_class or alert.summary,
                target_asset=record.destination_ip,
                risk=alert.severity.value.upper(),
                created_at=alert.created_at,
            )
        )
    return result


@router.get("/{user_id}/incidents", response_model=list[IncidentResponse])
def list_user_incidents(
    user_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles(UserRole.admin)),
    limit: int = Query(default=200, ge=1, le=500),
) -> list[IncidentResponse]:
    _get_user_or_404(db, user_id)
    return (
        db.query(Incident)
        .join(Alert, Alert.id == Incident.alert_id)
        .join(TrafficRecord, TrafficRecord.id == Alert.traffic_record_id)
        .filter(TrafficRecord.user_id == user_id)
        .order_by(Incident.created_at.desc())
        .limit(limit)
        .all()
    )


@router.get("/{user_id}/traffic", response_model=list[TrafficRecordResponse])
def list_user_traffic(
    user_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles(UserRole.admin)),
    limit: int = Query(default=200, ge=1, le=500),
) -> list[TrafficRecordResponse]:
    _get_user_or_404(db, user_id)
    return (
        db.query(TrafficRecord)
        .filter(TrafficRecord.user_id == user_id)
        .order_by(TrafficRecord.created_at.desc())
        .limit(limit)
        .all()
    )


@router.put("/{user_id}", response_model=UserAdminResponse)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(UserRole.admin)),
) -> UserAdminResponse:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if payload.username is not None:
        username = payload.username.strip()
        existing = (
            db.query(User)
            .filter(func.lower(User.username) == username.lower(), User.id != user.id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already exists")
        user.username = username

    if payload.email is not None:
        email = payload.email.strip().lower()
        existing = (
            db.query(User)
            .filter(func.lower(User.email) == email, User.id != user.id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
        user.email = email

    if payload.password is not None:
        user.hashed_password = get_password_hash(payload.password)

    if payload.role is not None:
        user.role = payload.role

    if payload.is_active is not None:
        user.is_active = payload.is_active

    if payload.is_email_verified is not None:
        user.is_email_verified = payload.is_email_verified
        if payload.is_email_verified and not user.email_verified_at:
            user.email_verified_at = datetime.utcnow()
        if not payload.is_email_verified:
            user.email_verified_at = None

    if current_admin.id == user.id and payload.role is not None and payload.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Admin cannot demote self")

    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user payload")
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(UserRole.admin)),
) -> None:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if settings.bootstrap_admin_email and user.email.lower() == settings.bootstrap_admin_email.lower():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Default admin cannot be deleted")
    if user.id == current_admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Admin cannot delete self")
    db.delete(user)
    db.commit()
    return None
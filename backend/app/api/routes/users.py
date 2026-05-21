import logging
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission, get_current_user
from app.core.config import get_settings
from app.core.security import get_password_hash
from app.db.session import get_db
from app.models.alert import Alert, AlertSeverity
from app.models.auth_token import AuthToken
from app.models.device import Device
from app.models.incident import Incident
from app.models.traffic_record import TrafficRecord
from app.models.user import OnboardingStatus, User, UserRole, UserCustomerAssignment
from app.schemas.alerts import ActiveThreatResponse, AlertResponse
from app.schemas.devices import DeviceResponse
from app.schemas.incidents import IncidentResponse
from app.schemas.traffic import TrafficRecordResponse
from app.schemas.users import (
    CustomerAssignmentResponse,
    BulkAssignmentResponse,
    OnboardingRejectRequest,
    UserAdminResponse,
    UserCreate,
    UserCustomerAssignmentUpdate,
    UserUpdate,
)
from app.services.email import (
    send_email_verified_by_admin_notice,
    send_ot_onboarding_approved_email,
    send_ot_onboarding_rejected_email,
)
from app.services.permissions import user_has_permission, user_is_admin

router = APIRouter(prefix="/users", tags=["users"])
settings = get_settings()
logger = logging.getLogger(__name__)


@router.get("", response_model=list[UserAdminResponse])
def list_users(
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("view_users")),
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
    _user: User = Depends(require_permission("manage_users")),
) -> UserAdminResponse:
    username = payload.username.strip()
    email = payload.email.strip().lower()

    if db.query(User).filter(func.lower(User.email) == email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    approved = payload.is_admin_approved
    user = User(
        username=username,
        email=email,
        hashed_password=get_password_hash(payload.password),
        role=payload.role,
        is_active=payload.is_active,
        is_email_verified=payload.is_email_verified,
        email_verified_at=datetime.utcnow() if payload.is_email_verified else None,
        is_admin_approved=approved,
        admin_approved_at=datetime.utcnow() if approved else None,
        # Non-customer roles never need admin approval — auto-approve.
        onboarding_status=OnboardingStatus.approved if (approved or payload.role != UserRole.customer) else OnboardingStatus.pending,
        rejected_at=None,
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
    _user: User = Depends(require_permission("view_users")),
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
    _user: User = Depends(require_permission("view_users")),
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
    _user: User = Depends(require_permission("view_users")),
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
    _user: User = Depends(require_permission("view_users")),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[ActiveThreatResponse]:
    _get_user_or_404(db, user_id)
    rows = (
        db.query(Alert, TrafficRecord)
        .join(TrafficRecord, TrafficRecord.id == Alert.traffic_record_id)
        .filter(TrafficRecord.user_id == user_id)
        .filter(Alert.severity.in_([AlertSeverity.critical, AlertSeverity.high, AlertSeverity.medium]))
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
    _user: User = Depends(require_permission("view_users")),
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
    _user: User = Depends(require_permission("view_users")),
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
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_permission("manage_users")),
) -> UserAdminResponse:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    notify_email_verified = False
    notify_account_approved = False

    if payload.username is not None:
        user.username = payload.username.strip()

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
        was_email_verified = user.is_email_verified
        user.is_email_verified = payload.is_email_verified
        if payload.is_email_verified and not user.email_verified_at:
            user.email_verified_at = datetime.utcnow()
        if not payload.is_email_verified:
            user.email_verified_at = None
        if payload.is_email_verified and not was_email_verified:
            notify_email_verified = True

    if payload.is_admin_approved is not None:
        was_approved = user.is_admin_approved
        user.is_admin_approved = payload.is_admin_approved
        if payload.is_admin_approved:
            user.onboarding_status = OnboardingStatus.approved
            user.rejected_at = None
            if not was_approved:
                user.admin_approved_at = datetime.utcnow()
                notify_account_approved = True
        else:
            user.admin_approved_at = None
            if user.onboarding_status != OnboardingStatus.rejected:
                user.onboarding_status = OnboardingStatus.pending

    if current_admin.id == user.id and payload.role is not None and payload.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Admin cannot demote self")

    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user payload")
    db.refresh(user)

    verified_email_to = user.email
    verified_name = user.username

    if notify_email_verified:

        def _send_verified_email() -> None:
            ok, diag = send_email_verified_by_admin_notice(verified_email_to, verified_name)
            if not ok:
                logger.warning("Verified-email notification not sent: %s", diag)

        background_tasks.add_task(_send_verified_email)

    if notify_account_approved:
        company_snap = (user.company_name or "").strip()

        def _send_approved_email() -> None:
            ok, diag = send_ot_onboarding_approved_email(verified_email_to, verified_name, company_snap)
            if not ok:
                logger.warning("Onboarding-approved notification not sent: %s", diag)

        background_tasks.add_task(_send_approved_email)

    return user


@router.post("/{user_id}/onboarding/approve", response_model=UserAdminResponse)
def approve_onboarding_registration(
    user_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_permission("approve_users")),
) -> UserAdminResponse:
    """Mark self-registered user as approved; sends enterprise welcome email."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.role == UserRole.admin:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Administrators use role management, not onboarding approval.")
    if user.role != UserRole.customer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{user.role.value} accounts do not require admin approval and cannot be approved via this endpoint.",
        )

    user.onboarding_status = OnboardingStatus.approved
    user.is_admin_approved = True
    user.admin_approved_at = datetime.utcnow()
    user.rejected_at = None
    db.add(user)
    db.commit()
    db.refresh(user)

    email_to = user.email
    name_u = user.username
    company = (user.company_name or "").strip()

    def _send() -> None:
        ok, diag = send_ot_onboarding_approved_email(email_to, name_u, company)
        if not ok:
            logger.warning("approve_onboarding_registration email failed: %s", diag)

    background_tasks.add_task(_send)
    return user


@router.post("/{user_id}/onboarding/reject", response_model=UserAdminResponse)
def reject_onboarding_registration(
    user_id: int,
    payload: OnboardingRejectRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_permission("approve_users")),
) -> UserAdminResponse:
    """Reject access request; terminates login for this account until re-registration policy allows."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.role == UserRole.admin:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot reject administrator accounts.")
    if user.role != UserRole.customer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{user.role.value} accounts do not require admin approval and cannot be rejected via this endpoint.",
        )

    user.onboarding_status = OnboardingStatus.rejected
    user.is_admin_approved = False
    user.admin_approved_at = None
    user.rejected_at = datetime.utcnow()
    db.add(user)
    db.commit()
    db.refresh(user)

    email_to = user.email
    name_u = user.username
    company = (user.company_name or "").strip()
    reason = payload.reason

    def _send() -> None:
        ok, diag = send_ot_onboarding_rejected_email(email_to, name_u, company, reason)
        if not ok:
            logger.warning("reject_onboarding_registration email failed: %s", diag)

    background_tasks.add_task(_send)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_permission("manage_users")),
) -> None:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if settings.bootstrap_admin_email and user.email.lower() == settings.bootstrap_admin_email.lower():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Default admin cannot be deleted")
    if user.id == current_admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Admin cannot delete self")

    # FKs without ON DELETE CASCADE (auth_tokens, devices) would raise IntegrityError on user delete.
    try:
        db.query(AuthToken).filter(AuthToken.user_id == user_id).delete(synchronize_session=False)
        db.query(Device).filter(Device.user_id == user_id).delete(synchronize_session=False)
        db.delete(user)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        logger.warning("delete_user failed for user_id=%s: %s", user_id, exc)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Unable to delete this user because related data could not be removed.",
        )
    return None


@router.get("/{user_id}/customers", response_model=CustomerAssignmentResponse)
def get_user_customers(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CustomerAssignmentResponse:
    if current_user.id != user_id and not user_has_permission(db, current_user, "manage_users") and not user_is_admin(current_user):
        raise HTTPException(status_code=403, detail="Not authorized to view these assignments")

    user = _get_user_or_404(db, user_id)
    if user.role not in (UserRole.analyst, UserRole.viewer):
        raise HTTPException(status_code=400, detail="Only analysts and viewers can have assigned customers.")

    assignments = db.query(UserCustomerAssignment).filter(UserCustomerAssignment.assigned_user_id == user_id).all()
    customer_ids = [a.customer_user_id for a in assignments]
    customers = db.query(User).filter(User.id.in_(customer_ids)).all()
    return CustomerAssignmentResponse(assigned_customers=customers)


@router.get("/assignments/bulk", response_model=BulkAssignmentResponse)
def get_bulk_assignments(
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_permission("manage_users")),
) -> BulkAssignmentResponse:
    """Returns a map of analyst/viewer user_id (as string) to their assigned customers."""
    assignments = db.query(UserCustomerAssignment).all()
    
    # We need to map customer_id -> User
    customer_ids = {a.customer_user_id for a in assignments}
    if not customer_ids:
        return BulkAssignmentResponse(assignments={})
        
    customers = db.query(User).filter(User.id.in_(customer_ids)).all()
    customer_by_id = {c.id: c for c in customers}
    
    result = {}
    for a in assignments:
        key = str(a.assigned_user_id)
        if key not in result:
            result[key] = []
        if a.customer_user_id in customer_by_id:
            result[key].append(customer_by_id[a.customer_user_id])
            
    return BulkAssignmentResponse(assignments=result)


@router.put("/{user_id}/customers", response_model=CustomerAssignmentResponse)
def update_user_customers(
    user_id: int,
    payload: UserCustomerAssignmentUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_permission("manage_users")),
) -> CustomerAssignmentResponse:
    user = _get_user_or_404(db, user_id)
    if user.role not in (UserRole.analyst, UserRole.viewer):
        raise HTTPException(status_code=400, detail="Only analysts and viewers can have assigned customers.")

    # Validate all requested customer IDs exist and are actually customers
    requested_customers = db.query(User).filter(User.id.in_(payload.customer_ids)).all()
    valid_customer_ids = [c.id for c in requested_customers if c.role == UserRole.customer]
    
    if len(valid_customer_ids) != len(payload.customer_ids):
        raise HTTPException(status_code=400, detail="One or more provided IDs are invalid or not customer users.")

    # Clear existing assignments
    db.query(UserCustomerAssignment).filter(UserCustomerAssignment.assigned_user_id == user_id).delete(synchronize_session=False)

    # Add new assignments
    for cid in valid_customer_ids:
        db.add(UserCustomerAssignment(assigned_user_id=user_id, customer_user_id=cid))
        
    db.commit()

    return CustomerAssignmentResponse(assigned_customers=requested_customers)
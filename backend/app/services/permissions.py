from functools import lru_cache

from sqlalchemy.orm import Session, joinedload

from app.models.rbac import Role
from app.models.user import User, UserRole

# Canonical permission codes. Keep these stable; routes and frontend guards depend on them.
VIEW_DASHBOARD = "view_dashboard"
VIEW_SOC_HEALTH = "view_soc_health"
VIEW_ALERTS = "view_alerts"
MANAGE_ALERTS = "manage_alerts"
CLOSE_ALERTS = "close_alerts"
VIEW_TRAFFIC = "view_traffic"
INGEST_TRAFFIC = "ingest_traffic"
RUN_DETECTION = "run_detection"
VIEW_DEVICES = "view_devices"
CREATE_DEVICES = "create_devices"
EDIT_DEVICES = "edit_devices"
DELETE_DEVICES = "delete_devices"
VIEW_MODELS = "view_models"
RETRAIN_MODELS = "retrain_models"
VIEW_USERS = "view_users"
MANAGE_USERS = "manage_users"
APPROVE_USERS = "approve_users"
VIEW_ROLES = "view_roles"
MANAGE_ROLES = "manage_roles"
MANAGE_PERMISSIONS = "manage_permissions"
VIEW_AUDIT_LOGS = "view_audit_logs"
VIEW_STREAMS = "view_streams"
MANAGE_PACKET_CAPTURE = "manage_packet_capture"

PERMISSION_DESCRIPTIONS: dict[str, str] = {
    VIEW_DASHBOARD: "View the main SOC dashboard",
    VIEW_SOC_HEALTH: "View SOC health and security posture metrics",
    VIEW_ALERTS: "View alerts and active threats",
    MANAGE_ALERTS: "Manage alert metadata and workflow",
    CLOSE_ALERTS: "Close or resolve alerts",
    VIEW_TRAFFIC: "View traffic telemetry and packet analysis",
    INGEST_TRAFFIC: "Ingest traffic records",
    RUN_DETECTION: "Run ML detection on traffic records",
    VIEW_DEVICES: "View OT/ICS devices",
    CREATE_DEVICES: "Create OT/ICS devices",
    EDIT_DEVICES: "Edit OT/ICS devices and reconciliation state",
    DELETE_DEVICES: "Delete OT/ICS devices",
    VIEW_MODELS: "View ML model versions and confidence data",
    RETRAIN_MODELS: "Trigger ML model retraining",
    VIEW_USERS: "View users and onboarding state",
    MANAGE_USERS: "Create, update, or delete users",
    APPROVE_USERS: "Approve or reject onboarding requests",
    VIEW_ROLES: "View roles, permissions, and assignments",
    MANAGE_ROLES: "Create, update, delete, and assign roles",
    MANAGE_PERMISSIONS: "Assign permissions to roles",
    VIEW_AUDIT_LOGS: "View security audit logs",
    VIEW_STREAMS: "Subscribe to live event streams",
    MANAGE_PACKET_CAPTURE: "Start and manage packet capture jobs",
}

PERMISSION_CODES = tuple(PERMISSION_DESCRIPTIONS.keys())

READ_ONLY_PERMISSIONS = (
    VIEW_DASHBOARD,
    VIEW_SOC_HEALTH,
    VIEW_ALERTS,
    VIEW_TRAFFIC,
    VIEW_DEVICES,
    VIEW_MODELS,
    VIEW_STREAMS,
)

ROLE_PERMISSION_MAP: dict[str, tuple[str, ...]] = {
    "admin": PERMISSION_CODES,
    # Preserve customer behavior: read/write tenant assets, ingest traffic, run detection, capture.
    "customer": (
        VIEW_DASHBOARD,
        VIEW_SOC_HEALTH,
        VIEW_ALERTS,
        VIEW_TRAFFIC,
        INGEST_TRAFFIC,
        RUN_DETECTION,
        VIEW_DEVICES,
        CREATE_DEVICES,
        EDIT_DEVICES,
        DELETE_DEVICES,
        VIEW_MODELS,
        VIEW_STREAMS,
        MANAGE_PACKET_CAPTURE,
    ),
    "analyst": (
        VIEW_DASHBOARD,
        VIEW_SOC_HEALTH,
        VIEW_ALERTS,
        MANAGE_ALERTS,
        CLOSE_ALERTS,
        VIEW_TRAFFIC,
        INGEST_TRAFFIC,
        RUN_DETECTION,
        VIEW_DEVICES,
        CREATE_DEVICES,
        EDIT_DEVICES,
        VIEW_MODELS,
        VIEW_STREAMS,
        MANAGE_PACKET_CAPTURE,
    ),
    "viewer": READ_ONLY_PERMISSIONS,
}


def _role_name(user: User) -> str:
    if user.role:
        if isinstance(user.role, UserRole):
            return user.role.value
        return str(user.role).split(".")[-1].lower()
    return ""


def user_is_admin(user: User) -> bool:
    return _role_name(user) == UserRole.admin.value


@lru_cache(maxsize=256)
def _permissions_for_role_name(role_name: str) -> frozenset[str]:
    return frozenset(ROLE_PERMISSION_MAP.get(role_name.lower(), ()))


def resolve_user_permissions(db: Session, user: User) -> set[str]:
    """Effective permissions from DB role mappings; admin role always receives all codes."""
    if user_is_admin(user):
        return set(PERMISSION_CODES)

    # The static map is a secure fallback if a deployment has not seeded role_permissions yet.
    effective = set(_permissions_for_role_name(_role_name(user)))

    role_name = _role_name(user)
    if role_name:
        db_role = (
            db.query(Role)
            .options(joinedload(Role.permissions))
            .filter(Role.name == role_name)
            .first()
        )
        if db_role and db_role.permissions:
            effective.update(p.code for p in db_role.permissions if p.code)

    if getattr(user, "roles", None):
        for extra in user.roles:
            if extra and extra.permissions:
                effective.update(p.code for p in extra.permissions if p.code)

    return effective


def user_has_permission(db: Session, user: User, code: str) -> bool:
    if user_is_admin(user):
        return True
    return code in resolve_user_permissions(db, user)


def user_has_any_permission(db: Session, user: User, codes: tuple[str, ...]) -> bool:
    if user_is_admin(user):
        return True
    perms = resolve_user_permissions(db, user)
    return any(c in perms for c in codes)

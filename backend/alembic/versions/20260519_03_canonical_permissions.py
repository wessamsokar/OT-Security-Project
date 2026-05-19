"""seed canonical permission-based RBAC mappings

Revision ID: 20260519_03
Revises: 20260519_02
Create Date: 2026-05-19
"""

from datetime import datetime

from alembic import op
import sqlalchemy as sa

revision = "20260519_03"
down_revision = "20260519_02"
branch_labels = None
depends_on = None

PERMISSIONS = [
    ("view_dashboard", "View the main SOC dashboard"),
    ("view_soc_health", "View SOC health and security posture metrics"),
    ("view_alerts", "View alerts and active threats"),
    ("manage_alerts", "Manage alert metadata and workflow"),
    ("close_alerts", "Close or resolve alerts"),
    ("view_traffic", "View traffic telemetry and packet analysis"),
    ("ingest_traffic", "Ingest traffic records"),
    ("run_detection", "Run ML detection on traffic records"),
    ("view_devices", "View OT/ICS devices"),
    ("create_devices", "Create OT/ICS devices"),
    ("edit_devices", "Edit OT/ICS devices and reconciliation state"),
    ("delete_devices", "Delete OT/ICS devices"),
    ("view_models", "View ML model versions and confidence data"),
    ("retrain_models", "Trigger ML model retraining"),
    ("view_users", "View users and onboarding state"),
    ("manage_users", "Create, update, or delete users"),
    ("approve_users", "Approve or reject onboarding requests"),
    ("view_roles", "View roles, permissions, and assignments"),
    ("manage_roles", "Create, update, delete, and assign roles"),
    ("manage_permissions", "Assign permissions to roles"),
    ("view_audit_logs", "View security audit logs"),
    ("view_streams", "Subscribe to live event streams"),
    ("manage_packet_capture", "Start and manage packet capture jobs"),
]

ROLE_PERMS = {
    "admin": [code for code, _ in PERMISSIONS],
    "customer": [
        "view_dashboard",
        "view_soc_health",
        "view_alerts",
        "view_traffic",
        "ingest_traffic",
        "run_detection",
        "view_devices",
        "create_devices",
        "edit_devices",
        "delete_devices",
        "view_models",
        "view_streams",
        "manage_packet_capture",
    ],
    "analyst": [
        "view_dashboard",
        "view_soc_health",
        "view_alerts",
        "manage_alerts",
        "close_alerts",
        "view_traffic",
        "ingest_traffic",
        "run_detection",
        "view_devices",
        "create_devices",
        "edit_devices",
        "view_models",
        "view_streams",
        "manage_packet_capture",
    ],
    "viewer": [
        "view_dashboard",
        "view_soc_health",
        "view_alerts",
        "view_traffic",
        "view_devices",
        "view_models",
        "view_streams",
    ],
}

LEGACY_CODES = [
    "users:read",
    "users:write",
    "users:approve",
    "rbac:read",
    "rbac:write",
    "devices:read",
    "devices:write",
    "traffic:read",
    "traffic:write",
    "traffic:detect",
    "alerts:read",
    "alerts:write",
    "capture:read",
    "capture:write",
    "model:read",
    "model:retrain",
    "stream:read",
    "audit:read",
]


def upgrade() -> None:
    now = datetime.utcnow()
    for code, description in PERMISSIONS:
        op.execute(
            sa.text(
                """
                INSERT INTO permissions (code, description, created_at)
                VALUES (:code, :description, :created_at)
                ON CONFLICT (code) DO UPDATE
                SET description = EXCLUDED.description
                """
            ).bindparams(code=code, description=description, created_at=now)
        )

    # Replace system-role permission mappings with the canonical defaults.
    op.execute(
        """
        DELETE FROM role_permissions
        WHERE role_id IN (SELECT id FROM roles WHERE name IN ('admin', 'customer', 'analyst', 'viewer'))
        """
    )

    for role_name, codes in ROLE_PERMS.items():
        codes_sql = ", ".join(f"'{code}'" for code in codes)
        op.execute(
            f"""
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id
            FROM roles r
            CROSS JOIN permissions p
            WHERE r.name = '{role_name}' AND p.code IN ({codes_sql})
            ON CONFLICT DO NOTHING
            """
        )

    legacy_sql = ", ".join(f"'{code}'" for code in LEGACY_CODES)
    op.execute(f"DELETE FROM permissions WHERE code IN ({legacy_sql})")


def downgrade() -> None:
    codes_sql = ", ".join(f"'{code}'" for code, _ in PERMISSIONS)
    op.execute(
        f"""
        DELETE FROM role_permissions
        WHERE permission_id IN (SELECT id FROM permissions WHERE code IN ({codes_sql}))
        """
    )
    op.execute(f"DELETE FROM permissions WHERE code IN ({codes_sql})")

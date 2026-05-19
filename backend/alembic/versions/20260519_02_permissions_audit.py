"""restore permissions tables and add audit_logs

Revision ID: 20260519_02
Revises: 20260519_01
Create Date: 2026-05-19
"""

from datetime import datetime

from alembic import op
import sqlalchemy as sa

revision = "20260519_02"
down_revision = "20260519_01"
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
    "admin": [p[0] for p in PERMISSIONS],
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


def upgrade() -> None:
    op.create_table(
        "permissions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(length=64), nullable=False, unique=True),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "role_permissions",
        sa.Column("role_id", sa.Integer(), sa.ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
        sa.Column(
            "permission_id",
            sa.Integer(),
            sa.ForeignKey("permissions.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("actor_user_id", sa.Integer(), nullable=True),
        sa.Column("actor_email", sa.String(length=255), nullable=True),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("category", sa.String(length=32), nullable=False),
        sa.Column("resource_type", sa.String(length=64), nullable=True),
        sa.Column("resource_id", sa.String(length=64), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column("success", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("metadata_json", sa.Text(), nullable=True),
    )
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_category", "audit_logs", ["category"])
    op.create_index("ix_audit_logs_actor_user_id", "audit_logs", ["actor_user_id"])

    now = datetime.utcnow()
    permissions_table = sa.table(
        "permissions",
        sa.column("code", sa.String),
        sa.column("description", sa.String),
        sa.column("created_at", sa.DateTime),
    )
    op.bulk_insert(
        permissions_table,
        [{"code": code, "description": desc, "created_at": now} for code, desc in PERMISSIONS],
    )

    for role_name, codes in ROLE_PERMS.items():
        codes_sql = ", ".join(f"'{c}'" for c in codes)
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


def downgrade() -> None:
    op.drop_index("ix_audit_logs_actor_user_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_category", table_name="audit_logs")
    op.drop_index("ix_audit_logs_action", table_name="audit_logs")
    op.drop_index("ix_audit_logs_created_at", table_name="audit_logs")
    op.drop_table("audit_logs")
    op.drop_table("role_permissions")
    op.drop_table("permissions")

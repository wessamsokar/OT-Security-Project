"""rbac, devices, and auth token tables

Revision ID: 20260430_01
Revises: 20260408_01
Create Date: 2026-04-30
"""

from datetime import datetime

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260430_01"
down_revision = "20260408_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_email_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column("users", sa.Column("email_verified_at", sa.DateTime(), nullable=True))

    op.create_table(
        "roles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=64), nullable=False, unique=True),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

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
        "user_roles",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("role_id", sa.Integer(), sa.ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    )

    op.create_table(
        "devices",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("device_type", sa.String(length=64), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("serial_number", sa.String(length=128), nullable=True),
        sa.Column("location", sa.String(length=128), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_devices_user_id", "devices", ["user_id"])

    auth_token_type = postgresql.ENUM(
        "password_reset",
        "email_verification",
        name="authtokentype",
        create_type=False,
    )
    auth_token_type.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "auth_tokens",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("token_hash", sa.String(length=255), nullable=False),
        sa.Column("token_type", auth_token_type, nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    roles_table = sa.table(
        "roles",
        sa.column("name", sa.String),
        sa.column("description", sa.String),
        sa.column("is_system", sa.Boolean),
        sa.column("created_at", sa.DateTime),
    )

    op.bulk_insert(
        roles_table,
        [
            {
                "name": "admin",
                "description": "System administrator",
                "is_system": True,
                "created_at": datetime.utcnow(),
            },
            {
                "name": "analyst",
                "description": "Security analyst",
                "is_system": True,
                "created_at": datetime.utcnow(),
            },
            {
                "name": "viewer",
                "description": "Read-only user",
                "is_system": True,
                "created_at": datetime.utcnow(),
            },
        ],
    )

    op.execute(
        "INSERT INTO user_roles (user_id, role_id) "
        "SELECT users.id, roles.id FROM users "
        "JOIN roles ON users.role::text = roles.name"
    )


def downgrade() -> None:
    op.drop_table("auth_tokens")
    op.drop_index("ix_devices_user_id", table_name="devices")
    op.drop_table("devices")
    op.drop_table("user_roles")
    op.drop_table("role_permissions")
    op.drop_table("permissions")
    op.drop_table("roles")

    op.drop_column("users", "email_verified_at")
    op.drop_column("users", "is_email_verified")

    auth_token_type = sa.Enum("password_reset", "email_verification", name="authtokentype")
    auth_token_type.drop(op.get_bind(), checkfirst=True)

"""Add admin approval gate for non-admin accounts.

Revision ID: 20260513_01
Revises: 20260512_01
Create Date: 2026-05-13

Existing rows default to approved so upgrades do not lock out current users.
Self-registrations set is_admin_approved=False in application code.
"""

from alembic import op
import sqlalchemy as sa

revision = "20260513_01"
down_revision = "20260512_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    dialect = conn.dialect.name

    default_expr = sa.true() if dialect == "postgresql" else sa.text("1")
    op.add_column(
        "users",
        sa.Column(
            "is_admin_approved",
            sa.Boolean(),
            nullable=False,
            server_default=default_expr,
        ),
    )
    op.add_column("users", sa.Column("admin_approved_at", sa.DateTime(), nullable=True))

    if dialect == "postgresql":
        op.execute(
            sa.text(
                "UPDATE users SET admin_approved_at = COALESCE(email_verified_at, created_at) "
                "WHERE admin_approved_at IS NULL"
            )
        )
    else:
        op.execute(
            sa.text(
                "UPDATE users SET admin_approved_at = COALESCE(email_verified_at, created_at) "
                "WHERE admin_approved_at IS NULL"
            )
        )

    op.alter_column("users", "is_admin_approved", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "admin_approved_at")
    op.drop_column("users", "is_admin_approved")

"""remove permissions

Revision ID: 20260503_01
Revises: 20260502_01
Create Date: 2026-05-03
"""

from alembic import op
import sqlalchemy as sa

revision = "20260503_01"
down_revision = "20260502_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table("role_permissions")
    op.drop_table("permissions")


def downgrade() -> None:
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

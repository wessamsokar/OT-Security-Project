"""OT onboarding registration fields and onboarding_status.

Revision ID: 20260514_01
Revises: 20260513_01
Create Date: 2026-05-14

Existing users default to onboarding_status=approved (no behavior change).
Self-registration sets pending in application code.
"""

from alembic import op
import sqlalchemy as sa

revision = "20260514_01"
down_revision = "20260513_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "onboarding_status",
            sa.String(length=16),
            nullable=False,
            server_default="approved",
        ),
    )
    op.add_column("users", sa.Column("rejected_at", sa.DateTime(), nullable=True))
    op.add_column("users", sa.Column("company_name", sa.String(length=180), nullable=True))
    op.add_column("users", sa.Column("job_title", sa.String(length=120), nullable=True))
    op.add_column("users", sa.Column("industry_type", sa.String(length=64), nullable=True))
    op.add_column("users", sa.Column("infrastructure_type", sa.String(length=180), nullable=True))
    op.add_column("users", sa.Column("estimated_device_count", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("country", sa.String(length=80), nullable=True))
    op.add_column("users", sa.Column("purpose_of_access", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("operates_ot_ics", sa.Boolean(), nullable=True))

    op.alter_column("users", "onboarding_status", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "operates_ot_ics")
    op.drop_column("users", "purpose_of_access")
    op.drop_column("users", "country")
    op.drop_column("users", "estimated_device_count")
    op.drop_column("users", "infrastructure_type")
    op.drop_column("users", "industry_type")
    op.drop_column("users", "job_title")
    op.drop_column("users", "company_name")
    op.drop_column("users", "rejected_at")
    op.drop_column("users", "onboarding_status")

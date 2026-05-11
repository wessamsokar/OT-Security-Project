"""TrafficRecord stores canonical ML verdict (alert_severity, attack_detected).

Revision ID: 20260515_02
Revises: 20260515_01
"""

from alembic import op
import sqlalchemy as sa


revision = "20260515_02"
down_revision = "20260515_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "traffic_records",
        sa.Column("ml_alert_severity", sa.String(length=16), nullable=True),
    )
    op.add_column(
        "traffic_records",
        sa.Column(
            "ml_attack_detected",
            sa.Boolean(),
            nullable=True,
        ),
    )
    op.alter_column(
        "traffic_records",
        "ml_status",
        existing_type=sa.String(length=24),
        type_=sa.String(length=32),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "traffic_records",
        "ml_status",
        existing_type=sa.String(length=32),
        type_=sa.String(length=24),
        existing_nullable=True,
    )
    op.drop_column("traffic_records", "ml_attack_detected")
    op.drop_column("traffic_records", "ml_alert_severity")

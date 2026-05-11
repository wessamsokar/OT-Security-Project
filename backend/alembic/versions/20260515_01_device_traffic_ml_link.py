"""Device–traffic linkage, ML aggregate columns, TrafficRecord.ml_status.

Revision ID: 20260515_01
Revises: 20260514_01

Adds device_id on traffic_records, ML-derived telemetry on devices,
and per-flow ml_status on traffic_records.
"""

from alembic import op
import sqlalchemy as sa


revision = "20260515_01"
down_revision = "20260514_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "devices",
        sa.Column("last_ml_risk_score", sa.Float(), nullable=True),
    )
    op.add_column("devices", sa.Column("last_ml_status", sa.String(length=24), nullable=True))
    op.add_column(
        "devices",
        sa.Column(
            "monitoring_status",
            sa.String(length=24),
            nullable=False,
            server_default="offline",
        ),
    )
    op.add_column("devices", sa.Column("last_traffic_at", sa.DateTime(), nullable=True))
    op.add_column(
        "devices",
        sa.Column(
            "last_seen_traffic_id",
            sa.Integer(),
            sa.ForeignKey("traffic_records.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    op.add_column(
        "traffic_records",
        sa.Column(
            "device_id",
            sa.Integer(),
            sa.ForeignKey("devices.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "traffic_records",
        sa.Column("ml_status", sa.String(length=24), nullable=True),
    )
    op.create_index("ix_traffic_records_device_id", "traffic_records", ["device_id"])


def downgrade() -> None:
    op.drop_index("ix_traffic_records_device_id", table_name="traffic_records")
    op.drop_column("traffic_records", "ml_status")
    op.drop_column("traffic_records", "device_id")

    op.drop_column("devices", "last_seen_traffic_id")
    op.drop_column("devices", "last_traffic_at")
    op.drop_column("devices", "monitoring_status")
    op.drop_column("devices", "last_ml_status")
    op.drop_column("devices", "last_ml_risk_score")

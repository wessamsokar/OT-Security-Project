"""initial schema

Revision ID: 20260408_01
Revises:
Create Date: 2026-04-08
"""

from alembic import op
import sqlalchemy as sa


revision = "20260408_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    user_role = sa.Enum("admin", "analyst", "viewer", name="userrole")
    alert_severity = sa.Enum("low", "medium", "high", "critical", name="alertseverity")
    alert_status = sa.Enum("new", "investigating", "closed", name="alertstatus")
    incident_status = sa.Enum("open", "triaged", "resolved", name="incidentstatus")

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(length=50), nullable=False, unique=True),
        sa.Column("email", sa.String(length=120), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("role", user_role, nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    op.create_table(
        "model_versions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("version", sa.String(length=32), nullable=False, unique=True),
        sa.Column("label", sa.String(length=128), nullable=False),
        sa.Column("metrics_json", sa.JSON(), nullable=False),
        sa.Column("trained_by", sa.String(length=64), nullable=False),
        sa.Column("retrain_job_id", sa.String(length=64), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    op.create_table(
        "traffic_records",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_ip", sa.String(length=64), nullable=False),
        sa.Column("destination_ip", sa.String(length=64), nullable=False),
        sa.Column("source_port", sa.Integer(), nullable=False),
        sa.Column("destination_port", sa.Integer(), nullable=False),
        sa.Column("transport_protocol", sa.String(length=16), nullable=False),
        sa.Column("packet_count", sa.Integer(), nullable=False),
        sa.Column("bytes_in", sa.Integer(), nullable=False),
        sa.Column("bytes_out", sa.Integer(), nullable=False),
        sa.Column("duration_ms", sa.Float(), nullable=False),
        sa.Column("payload_entropy", sa.Float(), nullable=False),
        sa.Column("modbus_function_code", sa.Integer(), nullable=True),
        sa.Column("modbus_unit_id", sa.Integer(), nullable=True),
        sa.Column("dnp3_function_code", sa.Integer(), nullable=True),
        sa.Column("iec104_type_id", sa.Integer(), nullable=True),
        sa.Column("ingestion_source", sa.String(length=32), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("risk_score", sa.Float(), nullable=True),
        sa.Column("attack_class", sa.String(length=64), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("explanation_json", sa.JSON(), nullable=True),
        sa.Column("model_version_id", sa.Integer(), sa.ForeignKey("model_versions.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    op.create_table(
        "alerts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("traffic_record_id", sa.Integer(), sa.ForeignKey("traffic_records.id"), nullable=False),
        sa.Column("severity", alert_severity, nullable=False),
        sa.Column("status", alert_status, nullable=False),
        sa.Column("summary", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    op.create_table(
        "incidents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("alert_id", sa.Integer(), sa.ForeignKey("alerts.id"), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("owner", sa.String(length=64), nullable=False),
        sa.Column("status", incident_status, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("incidents")
    op.drop_table("alerts")
    op.drop_table("traffic_records")
    op.drop_table("model_versions")
    op.drop_table("users")

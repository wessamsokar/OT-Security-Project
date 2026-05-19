"""topology edges + device operational_state

Revision ID: 20260519_04
Revises: 20260519_03
Create Date: 2026-05-19
"""

from alembic import op
import sqlalchemy as sa

revision = "20260519_04"
down_revision = "20260519_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "devices",
        sa.Column("operational_state", sa.String(length=24), nullable=False, server_default="unknown"),
    )

    op.create_table(
        "topology_edges",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("source_device_id", sa.Integer(), nullable=False),
        sa.Column("target_device_id", sa.Integer(), nullable=False),
        sa.Column("relationship_type", sa.String(length=32), nullable=False),
        sa.Column("direction", sa.String(length=24), nullable=False),
        sa.Column("protocol_context", sa.String(length=64), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("packet_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("bytes_total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("edge_source", sa.String(length=32), nullable=False),
        sa.Column("first_seen_at", sa.DateTime(), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["source_device_id"], ["devices.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_device_id"], ["devices.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "source_device_id",
            "target_device_id",
            "relationship_type",
            name="uq_topology_edge_relationship",
        ),
    )
    op.create_index("ix_topology_edges_user_id", "topology_edges", ["user_id"])
    op.create_index("ix_topology_edges_source_device_id", "topology_edges", ["source_device_id"])
    op.create_index("ix_topology_edges_target_device_id", "topology_edges", ["target_device_id"])
    op.create_index("ix_topology_edges_last_seen_at", "topology_edges", ["last_seen_at"])


def downgrade() -> None:
    op.drop_index("ix_topology_edges_last_seen_at", table_name="topology_edges")
    op.drop_index("ix_topology_edges_target_device_id", table_name="topology_edges")
    op.drop_index("ix_topology_edges_source_device_id", table_name="topology_edges")
    op.drop_index("ix_topology_edges_user_id", table_name="topology_edges")
    op.drop_table("topology_edges")
    op.drop_column("devices", "operational_state")

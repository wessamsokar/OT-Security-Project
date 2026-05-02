"""add customer role and tenant scope for traffic records

Revision ID: 20260502_01
Revises: 20260430_01
Create Date: 2026-05-02
"""

from alembic import op
import sqlalchemy as sa

revision = "20260502_01"
down_revision = "20260430_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'customer'")
    op.execute("UPDATE users SET role = 'customer'::userrole WHERE role::text IN ('analyst', 'viewer')")

    op.add_column("traffic_records", sa.Column("user_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_traffic_records_user_id_users",
        "traffic_records",
        "users",
        ["user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_traffic_records_user_id", "traffic_records", ["user_id"])

    op.execute(
        """
        UPDATE traffic_records
        SET user_id = users.id
        FROM users
        WHERE users.role = 'admin'::userrole
          AND traffic_records.user_id IS NULL
        """
    )

    op.execute("INSERT INTO roles (name, description, is_system, created_at) VALUES ('customer', 'Customer tenant user', true, NOW()) ON CONFLICT (name) DO NOTHING")
    op.execute("DELETE FROM roles WHERE name IN ('analyst', 'viewer')")


def downgrade() -> None:
    op.drop_index("ix_traffic_records_user_id", table_name="traffic_records")
    op.drop_constraint("fk_traffic_records_user_id_users", "traffic_records", type_="foreignkey")
    op.drop_column("traffic_records", "user_id")


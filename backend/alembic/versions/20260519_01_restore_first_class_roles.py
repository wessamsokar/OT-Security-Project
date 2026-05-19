"""restore analyst and viewer as first-class RBAC roles

Revision ID: 20260519_01
Revises: 20260515_02
Create Date: 2026-05-19
"""

from alembic import op


revision = "20260519_01"
down_revision = "20260515_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO roles (name, description, is_system, created_at)
        VALUES
            ('admin', 'Platform administrator', true, NOW()),
            ('customer', 'Customer tenant user', true, NOW()),
            ('analyst', 'Security analyst with detection and response access', true, NOW()),
            ('viewer', 'Read-only visibility user', true, NOW())
        ON CONFLICT (name) DO UPDATE
        SET description = EXCLUDED.description,
            is_system = true
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM roles WHERE name IN ('analyst', 'viewer')")

"""attack_acknowledged_at timestamp

Revision ID: 20260521_02
Revises: 20260521_01
Create Date: 2026-05-21 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260521_02'
down_revision = '20260521_01'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('devices', sa.Column('attack_acknowledged_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('devices', 'attack_acknowledged_at')

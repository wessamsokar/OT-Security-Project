"""operational recovery timestamps

Revision ID: 20260521_01
Revises: 20260519_05
Create Date: 2026-05-21 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260521_01'
down_revision = '20260519_05'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('devices', sa.Column('last_attack_at', sa.DateTime(), nullable=True))
    op.add_column('devices', sa.Column('last_recovered_at', sa.DateTime(), nullable=True))
    op.add_column('devices', sa.Column('attack_resolved_at', sa.DateTime(), nullable=True))
    op.add_column('devices', sa.Column('anomaly_score_updated_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('devices', 'anomaly_score_updated_at')
    op.drop_column('devices', 'attack_resolved_at')
    op.drop_column('devices', 'last_recovered_at')
    op.drop_column('devices', 'last_attack_at')

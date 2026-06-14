"""Add user preferences

Revision ID: 202606131447
Revises: 
Create Date: 2026-06-13 14:47:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '202606131447'
down_revision: Union[str, None] = '20260521_02'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('email_alerts_enabled', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('users', sa.Column('default_landing_page', sa.String(length=32), server_default='dashboard', nullable=False))


def downgrade() -> None:
    op.drop_column('users', 'default_landing_page')
    op.drop_column('users', 'email_alerts_enabled')

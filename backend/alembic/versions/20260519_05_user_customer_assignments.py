"""add user_customer_assignments table

Revision ID: 20260519_05
Revises: 20260519_04
Create Date: 2026-05-19 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260519_05'
down_revision = '20260519_04'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'user_customer_assignments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('assigned_user_id', sa.Integer(), nullable=False),
        sa.Column('customer_user_id', sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_user_customer_assignments_assigned_user_id'), 'user_customer_assignments', ['assigned_user_id'], unique=False)
    op.create_index(op.f('ix_user_customer_assignments_customer_user_id'), 'user_customer_assignments', ['customer_user_id'], unique=False)
    op.create_index(op.f('ix_user_customer_assignments_id'), 'user_customer_assignments', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_user_customer_assignments_id'), table_name='user_customer_assignments')
    op.drop_index(op.f('ix_user_customer_assignments_customer_user_id'), table_name='user_customer_assignments')
    op.drop_index(op.f('ix_user_customer_assignments_assigned_user_id'), table_name='user_customer_assignments')
    op.drop_table('user_customer_assignments')

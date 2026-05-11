"""Allow duplicate display names on users.username (email stays unique).

Revision ID: 20260511_01
Revises: 20260503_01
Create Date: 2026-05-11
"""

from alembic import op
import sqlalchemy as sa

revision = "20260511_01"
down_revision = "20260503_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    dialect = conn.dialect.name

    # PostgreSQL: inspector often misses legacy UNIQUE names — drop known constraint explicitly.
    if dialect == "postgresql":
        op.execute(sa.text("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key"))
        return

    insp = sa.inspect(conn)
    for uc in insp.get_unique_constraints("users"):
        cols = uc.get("column_names") or []
        if cols == ["username"]:
            op.drop_constraint(uc["name"], "users", type_="unique")
            return


def downgrade() -> None:
    op.create_unique_constraint("users_username_key", "users", ["username"])

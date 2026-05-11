"""Force-drop UNIQUE on users.username (handles non-standard constraint names).

Revision ID: 20260512_01
Revises: 20260511_01
Create Date: 2026-05-12

Uses simple ALTER TABLE ... DROP CONSTRAINT IF EXISTS for known PostgreSQL names,
plus inspector fallback for SQLite.
"""

from alembic import op
import sqlalchemy as sa

revision = "20260512_01"
down_revision = "20260511_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    dialect = conn.dialect.name

    if dialect == "postgresql":
        # SQLAlchemy / Postgres default names; IF EXISTS keeps repeat runs safe.
        for name in ("users_username_key", "users_username_unique", "uq_users_username"):
            op.execute(sa.text(f'ALTER TABLE users DROP CONSTRAINT IF EXISTS "{name}"'))
        return

    insp = sa.inspect(conn)
    for uc in insp.get_unique_constraints("users"):
        cols = uc.get("column_names") or []
        if cols == ["username"]:
            op.drop_constraint(uc["name"], "users", type_="unique")


def downgrade() -> None:
    op.create_unique_constraint("users_username_key", "users", ["username"])

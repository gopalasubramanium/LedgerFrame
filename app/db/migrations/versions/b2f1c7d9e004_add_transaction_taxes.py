"""add transaction taxes

Revision ID: b2f1c7d9e004
Revises: c8a035ade752
Create Date: 2026-06-26
"""
import sqlalchemy as sa
from alembic import op

import app.db.base  # noqa: F401 — DecimalText custom column type

revision = "b2f1c7d9e004"
down_revision = "c8a035ade752"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("transactions") as batch:
        batch.add_column(sa.Column("taxes", app.db.base.DecimalText(), nullable=True))
    op.execute("UPDATE transactions SET taxes = '0' WHERE taxes IS NULL")


def downgrade() -> None:
    with op.batch_alter_table("transactions") as batch:
        batch.drop_column("taxes")

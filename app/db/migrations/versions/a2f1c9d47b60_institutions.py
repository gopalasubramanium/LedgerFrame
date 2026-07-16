# SPDX-License-Identifier: AGPL-3.0-or-later
"""institutions master — the first user-extensible master-with-CRUD (D-008, §9-1)

Additive and idempotent. Creates the ``institutions`` table (id · name · name_key · created_at)
with a UNIQUE index on the normalized ``name_key`` (Amendment F). Starts empty — the seed-from-
free-text-values + FK re-pointing migration is a later commit (§9-1 three-step). No FK columns
are added here; nothing references the master yet.

Revision ID: a2f1c9d47b60
Revises: f2b7c1a9e304
Create Date: 2026-07-16
"""
import sqlalchemy as sa
from alembic import op

revision = "a2f1c9d47b60"
down_revision = "f2b7c1a9e304"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Idempotent: fresh DBs are create_all-bootstrapped (table + index already present), so create
    # only what's missing on databases adopted into Alembic.
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "institutions" not in set(insp.get_table_names()):
        op.create_table(
            "institutions",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.Column("name_key", sa.String(length=120), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        )
    if "ix_institutions_name_key" not in {i["name"] for i in insp.get_indexes("institutions")}:
        op.create_index("ix_institutions_name_key", "institutions", ["name_key"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_institutions_name_key", table_name="institutions")
    op.drop_table("institutions")

# SPDX-License-Identifier: AGPL-3.0-or-later
"""R-43 §9-5: net_worth_snapshots carried-forward flag

Additive + idempotent (ADR-0001 chain). Adds nullable ``net_worth_snapshots.flags`` so a
backfilled point whose valuation carried a stale/missing price or FX is marked
'carried_forward' — the trend renders it reduced-emphasis with a served reason, never an
unmarked smooth line. NULL = a fully-priced point.

Revision ID: c2e5a8b41f30
Revises: b1d4f7a92c08
Create Date: 2026-07-18
"""
import sqlalchemy as sa
from alembic import op

import app.db.base  # noqa: F401

revision = "c2e5a8b41f30"
down_revision = "b1d4f7a92c08"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "net_worth_snapshots" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("net_worth_snapshots")}
    if "flags" not in cols:
        op.add_column("net_worth_snapshots", sa.Column("flags", sa.String(20), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "net_worth_snapshots" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("net_worth_snapshots")}
        if "flags" in cols:
            with op.batch_alter_table("net_worth_snapshots") as batch:
                batch.drop_column("flags")

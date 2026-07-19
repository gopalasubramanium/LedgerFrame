# SPDX-License-Identifier: AGPL-3.0-or-later
"""F-8: record the last history-acquisition outcome per instrument.

A failed acquisition used to leave no trace a user could ever see (a log line inside a
blanket except — and F-8c had silenced the logger). This table makes a silent zero-row
outcome impossible: the served coverage reason names the real blocker instead of the
generic "run Build history" CTA.

Revision ID: a3f7c9d21b40
Revises: c2e5a8b41f30
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "a3f7c9d21b40"
down_revision = "c2e5a8b41f30"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # LedgerFrame bootstraps fresh databases with `create_all`, so this table may already exist
    # when the migration runs (the "adopted" path in app/db/migrate.py). Guard as every other
    # create-table migration here does — without it, adoption degrades to "reconciled".
    bind = op.get_bind()
    if "instrument_acquisitions" in sa.inspect(bind).get_table_names():
        return
    op.create_table(
        "instrument_acquisitions",
        sa.Column("instrument_id", sa.Integer(), sa.ForeignKey("instruments.id"), primary_key=True),
        sa.Column("ts", sa.DateTime(), nullable=False),
        sa.Column("ok", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("source", sa.String(length=20), nullable=True),
        sa.Column("reason", sa.String(length=400), nullable=True),
    )


def downgrade() -> None:
    bind = op.get_bind()
    if "instrument_acquisitions" in sa.inspect(bind).get_table_names():
        op.drop_table("instrument_acquisitions")

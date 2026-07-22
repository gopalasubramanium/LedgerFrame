# SPDX-License-Identifier: AGPL-3.0-or-later
"""Quote last-failure columns: name WHY a refresh failed, per instrument.

R-63 §9-2 Delta 2.2 (owner one-pass 2026-07-23). Pricing Health must show the distinct cause
of a missing/stale price — throttled / empty / errored / parse_error / unmapped / no_key /
unsupported — and say "last throttled at T — will retry" without making a live call. The last
refresh failure is therefore persisted on the quote row; a successful refresh clears it.

Revision ID: d4b7e2f1a9c6
Revises: b8d3f1a97c25
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "d4b7e2f1a9c6"
down_revision = "b8d3f1a97c25"
branch_labels = None
depends_on = None

_COLS = {
    "last_failure_state": sa.Column("last_failure_state", sa.String(length=20), nullable=True),
    "last_failure_at": sa.Column("last_failure_at", sa.DateTime(), nullable=True),
    "last_failure_reason": sa.Column("last_failure_reason", sa.String(length=200), nullable=True),
}


def upgrade() -> None:
    # LedgerFrame bootstraps fresh DBs with `create_all` (the "adopted" path in app/db/migrate.py),
    # so these columns may already exist. Add only the missing ones — guard like the create-table
    # migrations on this chain, so adoption stays "adopted" rather than degrading to "reconciled".
    bind = op.get_bind()
    existing = {c["name"] for c in sa.inspect(bind).get_columns("quotes")}
    for name, col in _COLS.items():
        if name not in existing:
            op.add_column("quotes", col)


def downgrade() -> None:
    for name in reversed(list(_COLS)):
        op.drop_column("quotes", name)

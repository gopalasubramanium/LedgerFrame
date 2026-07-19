# SPDX-License-Identifier: AGPL-3.0-or-later
"""Legal acceptance: an append-only record of who answered what, and to which text.

page-legal §11-5 (owner, 2026-07-20). Unaccepted installs are locked at entry, and the
acceptance binds to the sha256 of the served legal content — a changed hash requires
re-acceptance. The table is an EVENT LOG rather than a flag, because a flag keeps the
answer and loses the question, and a later decline would erase the fact that an earlier
acceptance happened.

Revision ID: b8d3f1a97c25
Revises: a3f7c9d21b40
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "b8d3f1a97c25"
down_revision = "a3f7c9d21b40"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # LedgerFrame bootstraps fresh databases with `create_all`, so this table may already exist
    # when the migration runs (the "adopted" path in app/db/migrate.py). Guard as every other
    # create-table migration on this chain does — without it, adoption degrades to "reconciled".
    bind = op.get_bind()
    if "legal_acceptance_events" in sa.inspect(bind).get_table_names():
        return
    op.create_table(
        "legal_acceptance_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        # `sa.DateTime`, matching the `UTCDateTime` TypeDecorator on the model — its `impl` is
        # SA's DateTime, and it exists to normalise tz on the Python boundary, not to change the
        # stored type. Declaring String here would have created a table `create_all` disagrees
        # with, and the disagreement would only surface on an upgraded install, never a fresh one.
        sa.Column("ts", sa.DateTime(), nullable=False),
        sa.Column("action", sa.String(length=16), nullable=False),
        sa.Column("content_sha256", sa.String(length=64), nullable=False),
    )
    op.create_index("ix_legal_acceptance_events_ts", "legal_acceptance_events", ["ts"])
    op.create_index(
        "ix_legal_acceptance_events_content_sha256",
        "legal_acceptance_events",
        ["content_sha256"],
    )


def downgrade() -> None:
    op.drop_index("ix_legal_acceptance_events_content_sha256",
                  table_name="legal_acceptance_events")
    op.drop_index("ix_legal_acceptance_events_ts", table_name="legal_acceptance_events")
    op.drop_table("legal_acceptance_events")

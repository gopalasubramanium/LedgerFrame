# SPDX-License-Identifier: AGPL-3.0-or-later
"""R-43 §9-1: net_worth_snapshots provenance

Additive + idempotent (ADR-0001 chain). Adds ``net_worth_snapshots.source`` so a
retrospectively reconstructed row (``backfilled``) coexists with a forward worker row
(``live``) and an owner-pressed one (``manual``). A re-backfill keys on this: a real/live
row always supersedes a backfilled one, never the reverse, so re-running never duplicates.

Existing forward rows are the pre-R-43 worker behaviour → ``live`` (the server default
backfills them). Enum values are internal only — they never reach user copy (D-105).

Revision ID: a8f1c3d5e207
Revises: a7d3f2c15e94
Create Date: 2026-07-18
"""
import sqlalchemy as sa
from alembic import op

import app.db.base  # noqa: F401 — registers custom column types

revision = "a8f1c3d5e207"
down_revision = "a7d3f2c15e94"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "net_worth_snapshots" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("net_worth_snapshots")}
    if "source" not in cols:
        op.add_column(
            "net_worth_snapshots",
            sa.Column("source", sa.String(20), nullable=False, server_default="live"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "net_worth_snapshots" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("net_worth_snapshots")}
        if "source" in cols:
            with op.batch_alter_table("net_worth_snapshots") as batch:
                batch.drop_column("source")

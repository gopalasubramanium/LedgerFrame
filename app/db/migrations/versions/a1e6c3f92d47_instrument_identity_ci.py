# SPDX-License-Identifier: AGPL-3.0-or-later
"""instrument identity: case-insensitive, NULL-tolerant uniqueness (R-63 I-6)

Additive + best-effort, DUPE-TOLERANT (§9-i ADDENDUM rider 3). Creates a UNIQUE index on
``(upper(symbol), coalesce(exchange, ''))`` so the same logical instrument cannot exist twice:
the pre-existing ``uq_instr_symbol_exch`` constraint did NOT prevent two ``(TSLA, NULL)`` rows
(SQL treats NULL as distinct in a UNIQUE constraint, and it is case-sensitive) — the live
TSLA id-22/id-23 pair the R-63 diagnosis found.

The owner's live DB CONTAINS that duplicate today, so a plain ``CREATE UNIQUE INDEX`` would
FAIL and brick the upgrade. We swallow that failure and leave the data intact — exactly the
``f8c2a1b3d704`` (identifier uniqueness) precedent: new-duplicate prevention is absolute at
the SERVICE layer (``resolve_or_create_instrument`` looks up before it creates), and
``GET /system/instrument-duplicates`` surfaces the existing pair for the user to resolve on
Holdings. We never guess which row is canonical. After the user's cleanup the guard holds
at the code layer regardless; a fresh index binds on any DB whose data permits it.

Revision ID: a1e6c3f92d47
Revises: d4b7e2f1a9c6
Create Date: 2026-07-24
"""
import sqlalchemy as sa
from alembic import op

revision = "a1e6c3f92d47"
down_revision = "d4b7e2f1a9c6"
branch_labels = None
depends_on = None


def _index_exists(bind, name: str) -> bool:
    # Expression-based indexes are not reflectable via inspect().get_indexes(), so probe the
    # catalog directly on SQLite (the deployment target); fall back to reflection elsewhere.
    if bind.dialect.name == "sqlite":
        return bind.execute(
            sa.text("SELECT 1 FROM sqlite_master WHERE type='index' AND name=:n"), {"n": name}
        ).first() is not None
    return name in {ix["name"] for ix in sa.inspect(bind).get_indexes("instruments")}


def upgrade() -> None:
    bind = op.get_bind()
    if not _index_exists(bind, "uq_instr_identity_ci"):
        try:
            op.create_index(
                "uq_instr_identity_ci", "instruments",
                [sa.text("upper(symbol)"), sa.text("coalesce(exchange, '')")],
                unique=True,
            )
        except Exception:  # noqa: BLE001 — pre-existing duplicates; leave data intact,
            # the service guard blocks NEW ones and /system/instrument-duplicates surfaces these.
            pass


def downgrade() -> None:
    try:
        op.drop_index("uq_instr_identity_ci", table_name="instruments")
    except Exception:  # noqa: BLE001
        pass

"""Drop retired tables (D-014..D-017).

Removes the tables the v2 decisions retired:
  - provider_configs            (D-014 — provider config lives in .env)
  - notes                       (D-015 — per-record note fields suffice)
  - ai_conversations, ai_messages (D-016 — AI chat is ephemeral, never persisted)
  - dashboard_configs, dashboard_rotation_items (D-017 — rotation persists in settings rows)

First v2 migration on top of the inherited legacy chain (ADR 0001); an existing
v1 database upgrades in place.

**Data guard:** this migration refuses to drop any target table that still holds
rows — it raises loudly rather than silently destroying data. Clear/export the
rows first, then re-run.

**ASYMMETRIC BY DESIGN — the downgrade does NOT restore the two AI tables.**
`downgrade()` re-creates `provider_configs`, `notes`, `dashboard_configs` and
`dashboard_rotation_items`, so an operator can back this migration out. It
deliberately does **not** re-create `ai_conversations` / `ai_messages`.

Reversibility exists so an operator can undo a *schema change*. These two tables
are not a schema preference that was changed — they are a **promise the product
makes to the person using it**: Commitment 6, served on the Legal page, *"AI
questions and answers are never persisted"* (D-016). A promise that holds at head
and dissolves one `alembic downgrade` later is not a promise; it is a default.
Nothing in the codebase writes these tables, so restoring them would create a
place to persist conversations that only a future mistake could fill.

The narrowness is enforced rather than trusted:
`tests/integration/test_commitment_6_no_stored_conversations.py` drives a
downgrade → upgrade cycle and fails if either AI table returns **or** if the cycle
loses any other table.

*(The `upgrade()` path still drops both — a real v1 database has them, and
dropping them is the entire point of this revision.)*

Revision ID: f9e1a2b3c4d5
Revises: d1e7a4c02f95
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "f9e1a2b3c4d5"
down_revision = "d1e7a4c02f95"
branch_labels = None
depends_on = None

# Child-before-parent order so FK constraints never block a drop.
_DROP_ORDER = [
    "ai_messages",
    "ai_conversations",
    "notes",
    "dashboard_rotation_items",
    "dashboard_configs",
    "provider_configs",
]


def upgrade() -> None:
    conn = op.get_bind()
    present = set(sa.inspect(conn).get_table_names())

    # Guard: never silently drop data. Abort if any target table is non-empty.
    non_empty: list[str] = []
    for table in _DROP_ORDER:
        if table in present:
            count = conn.execute(sa.text(f"SELECT COUNT(*) FROM {table}")).scalar_one()
            if count:
                non_empty.append(f"{table} ({count} rows)")
    if non_empty:
        raise RuntimeError(
            "Refusing to drop retired tables that still hold data: "
            + ", ".join(non_empty)
            + ". These tables are retired by D-014..D-017; export or clear the rows, "
            "then re-run this migration."
        )

    for table in _DROP_ORDER:
        if table in present:
            op.drop_table(table)


def downgrade() -> None:
    # Recreate the retired tables (schema as of head d1e7a4c02f95), parent-before-child.
    op.create_table(
        "provider_configs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=40), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("config_json", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "notes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("instrument_id", sa.Integer(), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["instrument_id"], ["instruments.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_notes_instrument_id"), "notes", ["instrument_id"], unique=False)
    op.create_table(
        "dashboard_configs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("rotation_seconds", sa.Integer(), nullable=False),
        sa.Column("focus_page", sa.String(length=40), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "dashboard_rotation_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("config_id", sa.Integer(), nullable=False),
        sa.Column("page", sa.String(length=40), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["config_id"], ["dashboard_configs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_dashboard_rotation_items_config_id"),
        "dashboard_rotation_items",
        ["config_id"],
        unique=False,
    )
    # ⚠ ai_conversations / ai_messages are DELIBERATELY NOT RE-CREATED — see the
    # "asymmetric by design" note in this module's docstring. Commitment 6 promises the
    # user that AI questions and answers are never persisted; restoring a place to
    # persist them, in any reachable schema state, would make that promise conditional
    # on nobody running `alembic downgrade`.
    #
    # This asymmetry is guarded, not merely intended:
    # tests/integration/test_commitment_6_no_stored_conversations.py drives a full
    # downgrade → upgrade cycle and fails if either table comes back — and, in the same
    # test, fails if the cycle loses any OTHER table, so the exception stays exactly
    # this narrow.

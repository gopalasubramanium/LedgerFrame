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
    op.create_table(
        "ai_conversations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "ai_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("conversation_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("facts_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["conversation_id"], ["ai_conversations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_ai_messages_conversation_id"), "ai_messages", ["conversation_id"], unique=False
    )

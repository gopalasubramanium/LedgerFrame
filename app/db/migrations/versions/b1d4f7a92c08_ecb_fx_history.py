# SPDX-License-Identifier: AGPL-3.0-or-later
"""R-8 (R-43 §9-3): ecb_fx_history — per-date reference FX

Additive + idempotent (ADR-0001 chain). Creates ``ecb_fx_history`` keyed on
``(currency, as_of)`` so the per-date historical rate the retrospective valuation needs
can be stored (``ecb_fx_rates`` is PK-on-currency and cannot hold history). One row =
EUR→currency on one ECB publication date, from ``eurofxref-hist.csv``.

Revision ID: b1d4f7a92c08
Revises: a8f1c3d5e207
Create Date: 2026-07-18
"""
import sqlalchemy as sa
from alembic import op

import app.db.base  # noqa: F401 — registers DecimalText

revision = "b1d4f7a92c08"
down_revision = "a8f1c3d5e207"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if "ecb_fx_history" in sa.inspect(bind).get_table_names():
        return
    op.create_table(
        "ecb_fx_history",
        sa.Column("currency", sa.String(3), primary_key=True),
        sa.Column("as_of", sa.String(12), primary_key=True),
        sa.Column("rate", app.db.base.DecimalText(), nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=True),
    )
    op.create_index("ix_ecb_fx_history_asof", "ecb_fx_history", ["as_of"])


def downgrade() -> None:
    bind = op.get_bind()
    if "ecb_fx_history" in sa.inspect(bind).get_table_names():
        op.drop_index("ix_ecb_fx_history_asof", table_name="ecb_fx_history")
        op.drop_table("ecb_fx_history")

# SPDX-License-Identifier: AGPL-3.0-or-later
"""R-43 historical backfill — the growing pin sweep.

One module for the milestone; sections track the Phase-0 build order. Every pin is
fail-first RED on the real cause before its delta lands (the plan's build discipline).
"""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import select

from app.models import NetWorthSnapshot


# --------------------------------------------------------------------------- #
# Step 1 (§9-1) — snapshot provenance column
# --------------------------------------------------------------------------- #
async def test_net_worth_snapshot_has_provenance_defaulting_to_live(session):
    """§9-1: net_worth_snapshots gains a `source` provenance column so a backfilled row
    coexists with a forward worker row and an owner-pressed one. A row written the old way
    (no explicit source — the forward worker path) defaults to 'live'."""
    session.add(NetWorthSnapshot(
        ts=__import__("app.db.base", fromlist=["utcnow"]).utcnow(),
        base_currency="SGD",
        assets=Decimal("100"), liabilities=Decimal("0"), net_worth=Decimal("100"),
    ))
    await session.flush()
    row = (await session.execute(select(NetWorthSnapshot))).scalars().one()
    assert row.source == "live"  # forward-worker default; backfill/manual set it explicitly


async def test_snapshot_source_accepts_the_three_provenances(session):
    """The three §9-1 provenances round-trip. Enum values are internal (never user copy, D-105)."""
    from app.db.base import utcnow

    for src in ("backfilled", "live", "manual"):
        session.add(NetWorthSnapshot(
            ts=utcnow(), base_currency="SGD", assets=Decimal("1"),
            liabilities=Decimal("0"), net_worth=Decimal("1"), source=src,
        ))
    await session.flush()
    got = {r.source for r in (await session.execute(select(NetWorthSnapshot))).scalars().all()}
    assert got == {"backfilled", "live", "manual"}

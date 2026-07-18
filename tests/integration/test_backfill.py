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


# --------------------------------------------------------------------------- #
# Step 2 (R-8 / §9-3) — historical per-date reference FX
# --------------------------------------------------------------------------- #
# A slice of eurofxref-hist.csv shape: header + newest-first rows, a trailing empty column,
# a weekend gap (2026-07-17 Fri is the last publication before Sat 07-18 / Sun 07-19), and a
# 1999 pre-coverage row where INR/SGD are N/A (honestly-missing, never fabricated).
_HIST_CSV = (
    "Date, USD, INR, SGD, \n"
    "2026-07-17, 1.1435, 110.1020, 1.4765, \n"
    "2026-07-16, 1.1600, 111.0000, 1.4800, \n"
    "2026-07-15, 1.1500, 110.5000, 1.4780, \n"
    "1999-01-04, 1.1789, N/A, N/A, \n"
)


async def test_hist_ingest_resolves_exact_cross_rate(session):
    """A known date resolves base→quote via the EUR hub: USD→SGD = (EUR→SGD)/(EUR→USD),
    exact Decimal (no float drift)."""
    from app.services import fx_history

    res = await fx_history.ingest_hist(session, _HIST_CSV)
    assert res["dates"] == 4
    fxh = await fx_history.load_historical_fx(session, ["USD", "SGD", "INR"])
    # EUR→SGD / EUR→USD on 2026-07-17
    assert fxh.rate("USD", "SGD", "2026-07-17") == Decimal("1.4765") / Decimal("1.1435")
    assert fxh.rate("INR", "SGD", "2026-07-17") == Decimal("1.4765") / Decimal("110.1020")
    assert fxh.rate("SGD", "SGD", "2026-07-17") == Decimal("1")  # identity


async def test_hist_carries_last_published_rate_over_a_weekend(session):
    """§9-3: a non-publication day (weekend) carries the last published (Friday) rate forward,
    unflagged — the standard daily-close convention. Sat/Sun resolve to Friday's rate."""
    from app.services import fx_history

    await fx_history.ingest_hist(session, _HIST_CSV)
    fxh = await fx_history.load_historical_fx(session, ["USD", "SGD"])
    friday = fxh.rate("USD", "SGD", "2026-07-17")
    assert fxh.rate("USD", "SGD", "2026-07-18") == friday  # Saturday → Friday
    assert fxh.rate("USD", "SGD", "2026-07-20") == friday  # Monday (no row yet) → Friday


async def test_hist_pre_coverage_is_honestly_missing_never_fabricated(session):
    """W-1b per-date: a currency with no published rate on/before the date resolves to None
    (pre-coverage / before the file's earliest date), never a fabricated 1.0."""
    from app.services import fx_history

    await fx_history.ingest_hist(session, _HIST_CSV)
    fxh = await fx_history.load_historical_fx(session)
    assert fxh.eur_to("INR", "1999-01-04") is None       # INR N/A in the 1999 row
    assert fxh.rate("USD", "SGD", "1999-01-04") is None   # SGD leg missing → whole cross None
    assert fxh.eur_to("USD", "1998-01-01") is None        # before the earliest stored date
    assert fxh.rate("USD", "SGD", "2026-07-17") is not None  # sanity: present dates DO resolve


async def test_hist_ingest_is_idempotent(session):
    """Re-ingesting overwrites in place — no duplicate (currency, date) rows (the periodic-append
    path must not double the store)."""
    from sqlalchemy import func

    from app.models import EcbFxHistory
    from app.services import fx_history

    await fx_history.ingest_hist(session, _HIST_CSV)
    first = (await session.execute(select(func.count()).select_from(EcbFxHistory))).scalar()
    await fx_history.ingest_hist(session, _HIST_CSV)
    second = (await session.execute(select(func.count()).select_from(EcbFxHistory))).scalar()
    assert first == second and first > 0


async def test_needed_currencies_derives_from_held_pricing_currencies(session):
    """One derivation of the needed FX set: distinct held pricing currencies + base."""
    from app.models import Account, AssetClass, Holding, Instrument
    from app.services import fx_history

    acc = Account(name="A", currency="SGD")
    session.add(acc)
    await session.flush()
    usd = Instrument(symbol="TSLA", currency="USD", pricing_currency="USD")
    inr = Instrument(symbol="102000", currency="INR", pricing_currency="INR")
    session.add_all([usd, inr])
    await session.flush()
    session.add_all([
        Holding(account_id=acc.id, instrument_id=usd.id, asset_class=AssetClass.EQUITY,
                quantity=Decimal("1"), avg_cost=Decimal("1"), currency="USD"),
        Holding(account_id=acc.id, instrument_id=inr.id, asset_class=AssetClass.MUTUAL_FUND,
                quantity=Decimal("1"), avg_cost=Decimal("1"), currency="INR"),
    ])
    await session.flush()
    got = await fx_history.needed_currencies(session, "SGD")
    assert got == {"SGD", "USD", "INR"}

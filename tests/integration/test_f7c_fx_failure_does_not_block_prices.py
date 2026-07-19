# SPDX-License-Identifier: AGPL-3.0-or-later
"""R-43 §18-R6 (F-7c, CONFIRMED LIVE) — an FX-stage failure must skip ONLY the FX stage.

The owner re-ran Build history after the F-7a/F-7b fixes and coverage stayed **4/6**: BTC and XRP
still read "No price history yet". §18-F7c had already refuted the sequencing hypothesis
(acquisition never reads ``quotes.source``) and named the real suspect — ``acquire_history``
returned at the ECB-FX stage **before** ``acquire_prices`` ever ran. That prediction is what the
live re-run confirmed.

The bug is a stage-scoping error, not an FX bug: FX ingest and per-instrument price acquisition are
INDEPENDENT inputs, and one refusing must not silently cancel the other. It bit hardest in exactly
the owner's state — a store whose ``ecb_fx_history`` is already fresh (so FX is not even needed)
while the ECB endpoint serves a stale/corrupt file, which the F-4 integrity gate correctly refuses.
Every build then acquired NOTHING, forever, and the crypto era stayed cost-carried.

What must NOT regress: the F-4 gate still refuses to ingest a stale series (nothing written), and
no-egress still refuses the whole build (Guarantee 5).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace

from sqlalchemy import select

# The real F-4 shape: newest parsed date 2010 → the freshness gate refuses it (see
# tests/integration/test_ingest_integrity.py). This is what ECB's edge served on-stack.
_STALE_CORRUPT = (
    "Date, USD, INR, SGD, \n"
    "2010-02-14, 1, 2, 3, \n"
    "2009-12-31, 1.4406, 66.90, 2.02, \n"
    "2009-12-30, 1.4331, 66.50, 2.01, \n"
)


def _fresh_csv() -> str:
    """An ECB-hist-shaped CSV whose newest date is today — what the store already holds."""
    today = datetime.now(UTC).date()
    return (
        "Date, USD, INR, SGD, \n"
        f"{today.isoformat()}, 1.1435, 110.1020, 1.4765, \n"
        f"{(today - timedelta(days=1)).isoformat()}, 1.1600, 111.0000, 1.4800, \n"
    )


async def _seed_owner_state(session):
    """The owner's shape: two mapped cryptos + one equity held, and a FRESH fx store."""
    from app.models import Account, AssetClass, Instrument, InstrumentIdentifier, TxnType
    from app.models import Transaction as Txn
    from app.services import fx_history
    from app.services.portfolio import rebuild_holdings_from_transactions

    acc = Account(name="A", currency="SGD")
    session.add(acc)
    await session.flush()
    btc = Instrument(symbol="BTC", currency="USD", pricing_currency="USD", asset_class=AssetClass.CRYPTO)
    xrp = Instrument(symbol="XRP", currency="USD", pricing_currency="USD", asset_class=AssetClass.CRYPTO)
    tsla = Instrument(symbol="TSLA", currency="USD", pricing_currency="USD", asset_class=AssetClass.EQUITY)
    session.add_all([btc, xrp, tsla])
    await session.flush()
    session.add_all([
        InstrumentIdentifier(instrument_id=btc.id, id_type="coingecko_id", value="bitcoin"),
        InstrumentIdentifier(instrument_id=xrp.id, id_type="coingecko_id", value="ripple"),
    ])
    old = datetime.now(UTC) - timedelta(days=400)
    for instr in (btc, xrp, tsla):
        session.add(Txn(account_id=acc.id, instrument_id=instr.id, type=TxnType.BUY,
                        ts=old, quantity=Decimal("1"), price=Decimal("10"), currency="USD"))
    await session.flush()
    await rebuild_holdings_from_transactions(session)
    # The store's FX history is already FRESH — this build needs no FX download at all.
    await fx_history.ingest_hist(session, _fresh_csv(), max_staleness_days=7)
    await session.commit()
    return btc, xrp, tsla


def _patch_stack(monkeypatch, *, cg_calls: list, ecb=None):
    """Deterministic stand-ins: a refusing ECB, a working CoinGecko, an inert equity path."""
    monkeypatch.setattr("app.services.acquire.get_settings",
                        lambda: SimpleNamespace(base_currency="SGD", is_demo=False))

    async def _stale_fetch(timeout: float = 60.0):
        return _STALE_CORRUPT
    monkeypatch.setattr("app.services.acquire.fetch_ecb_hist", ecb or _stale_fetch)

    d1 = int((datetime.now(UTC) - timedelta(days=3)).timestamp() * 1000)
    d2 = int((datetime.now(UTC) - timedelta(days=2)).timestamp() * 1000)

    async def _fake_cg(cid, vs, start, end, timeout=30.0):
        cg_calls.append(cid)
        return {"prices": [[d1, 64024.63], [d2, 65010.0]], "total_volumes": []}
    monkeypatch.setattr("app.services.acquire.fetch_market_chart_range", _fake_cg)

    async def _fake_get_history(sess, symbol, interval, start, end, **kw):
        return []
    monkeypatch.setattr("app.services.market.get_history_cached", _fake_get_history)


async def test_fx_refusal_does_not_cancel_price_acquisition(session, monkeypatch):
    """RED (the owner's live 4/6): a refused ECB file left BTC/XRP with no candles, because
    acquire_history returned before acquire_prices. The FX stage may skip only ITSELF."""
    from app.models import PriceHistory
    from app.services import acquire

    btc, xrp, _tsla = await _seed_owner_state(session)
    cg_calls: list = []
    _patch_stack(monkeypatch, cg_calls=cg_calls)

    res = await acquire.acquire_history(session, "SGD")

    # The prices were acquired from CoinGecko despite the FX stage refusing.
    assert sorted(cg_calls) == ["bitcoin", "ripple"]
    for instr in (btc, xrp):
        rows = (await session.execute(
            select(PriceHistory).where(PriceHistory.instrument_id == instr.id))).scalars().all()
        assert rows, f"{instr.symbol} acquired no history"
        assert all(r.source == "coingecko" for r in rows)
    # The store's FX was already fresh, so the build is honestly usable — and it SAYS the FX
    # download was skipped (served, never a silent partial success).
    assert res["ok"] is True
    assert res["fx_error"] and "freshness" in res["fx_error"].lower()


async def test_fx_refusal_still_writes_no_fx_rows(session, monkeypatch):
    """F-4 must not regress: the stale file is refused, so the store keeps ONLY its own fresh
    rows — a skipped stage never becomes a poisoned one."""
    from app.services import acquire, fx_history

    await _seed_owner_state(session)
    before = await fx_history.status(session)
    _patch_stack(monkeypatch, cg_calls=[])

    await acquire.acquire_history(session, "SGD")

    after = await fx_history.status(session)
    assert after["rows"] == before["rows"] and after["latest"] == before["latest"]


async def test_every_build_evaluates_per_instrument_coverage_regardless_of_fx(session, monkeypatch):
    """The pin behind the owner's 4/6 → 6/6: coverage is evaluated per instrument on EVERY run,
    and an FX-stage refusal cannot hold a covered instrument at 'No price history yet'."""
    from app.services import acquire
    from app.services.coverage import coverage_summary

    await _seed_owner_state(session)
    _patch_stack(monkeypatch, cg_calls=[])

    before = await coverage_summary(session, "SGD")
    assert before["covered_count"] < before["total"]    # the owner's starting 4/6 shape

    await acquire.acquire_history(session, "SGD")

    after = await coverage_summary(session, "SGD")
    assert after["covered_count"] > before["covered_count"]
    crypto = [r for r in after["instruments"] if r["symbol"] in ("BTC", "XRP")]
    assert crypto and all(r["covered"] for r in crypto)


async def test_rerunning_is_idempotent_for_covered_holdings(session, monkeypatch):
    """A second Build history re-ingests in place: no duplicate candles, coverage unchanged.

    NOTE the honest scope of "re-fetch nothing": the fetch is NOT suppressed for a covered
    instrument, because a covered instrument still needs the days since the last build — skipping
    it would freeze history at the first build. Idempotency is therefore pinned where it is real:
    the WRITE is an upsert, so re-running changes no row count and no coverage number.
    """
    from app.models import PriceHistory
    from app.services import acquire
    from app.services.coverage import coverage_summary

    await _seed_owner_state(session)
    _patch_stack(monkeypatch, cg_calls=[])

    await acquire.acquire_history(session, "SGD")
    rows_1 = (await session.execute(select(PriceHistory))).scalars().all()
    cov_1 = await coverage_summary(session, "SGD")

    await acquire.acquire_history(session, "SGD")
    rows_2 = (await session.execute(select(PriceHistory))).scalars().all()
    cov_2 = await coverage_summary(session, "SGD")

    assert len(rows_2) == len(rows_1)
    assert cov_2["covered_count"] == cov_1["covered_count"] and cov_2["total"] == cov_1["total"]


async def test_no_usable_fx_still_acquires_prices_then_refuses_the_valuation(session, monkeypatch):
    """With an EMPTY fx store and a refused download there is no honest way to value in base — the
    build is refused (never a fabricated series). The price acquisition still runs, so the next
    build (once ECB recovers) is complete rather than starting from nothing."""
    from app.models import (
        Account,
        AssetClass,
        Instrument,
        InstrumentIdentifier,
        PriceHistory,
        TxnType,
    )
    from app.models import Transaction as Txn
    from app.services import acquire
    from app.services.portfolio import rebuild_holdings_from_transactions

    acc = Account(name="A", currency="SGD")
    session.add(acc)
    await session.flush()
    btc = Instrument(symbol="BTC", currency="USD", pricing_currency="USD", asset_class=AssetClass.CRYPTO)
    session.add(btc)
    await session.flush()
    session.add(InstrumentIdentifier(instrument_id=btc.id, id_type="coingecko_id", value="bitcoin"))
    session.add(Txn(account_id=acc.id, instrument_id=btc.id, type=TxnType.BUY,
                    ts=datetime.now(UTC) - timedelta(days=40), quantity=Decimal("1"),
                    price=Decimal("10"), currency="USD"))
    await session.flush()
    await rebuild_holdings_from_transactions(session)
    await session.commit()

    cg_calls: list = []
    _patch_stack(monkeypatch, cg_calls=cg_calls)

    res = await acquire.acquire_history(session, "SGD")

    assert res["ok"] is False                      # nothing to value against — refuse honestly
    assert "freshness" in res["message"].lower()
    assert cg_calls == ["bitcoin"]                 # ...but the prices were still acquired
    assert (await session.execute(
        select(PriceHistory).where(PriceHistory.instrument_id == btc.id))).scalars().all()


async def test_no_egress_still_refuses_the_whole_build(session, monkeypatch):
    """Guarantee 5 is untouched: under no-egress NOTHING is fetched — not FX, not prices."""
    from app.services import acquire

    await _seed_owner_state(session)
    cg_calls: list = []
    _patch_stack(monkeypatch, cg_calls=cg_calls)

    async def _no_egress():
        return False
    monkeypatch.setattr("app.services.acquire.egress_allowed", _no_egress)

    res = await acquire.acquire_history(session, "SGD")
    assert res["ok"] is False and res["acquired"] is False
    assert cg_calls == []
    assert "no-egress" in res["message"].lower()

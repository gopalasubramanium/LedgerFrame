# SPDX-License-Identifier: AGPL-3.0-or-later
"""R-43 §17 (F-6) — CoinGecko id auto-resolution at acquisition time.

The owner's BTC/XRP carry a dr-27-era ``source_override='alphavantage'`` and NO ``coingecko_id``,
so the Build-history acquisition skipped them (coverage 4/6). Two rulings are exercised here:

- §17-R2: ``_link_coingecko_by_symbol`` resolves an AMBIGUOUS symbol to the canonical
  top-market-cap primary (BTC → bitcoin, XRP → ripple) — the stored ``market_cap_usd`` is
  unreliable (the ``/coins/list`` sync has no cap), so it fetches live caps for the candidate ids
  and links the dominant one; a genuinely ambiguous minor symbol (comparable caps) serves candidates.
- §17-R1: ``acquire_prices`` routes crypto by CLASS to CoinGecko regardless of an AV quotes-override
  — a crypto with an AV override still acquires CoinGecko history (see test_acquire_prices).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal

import app.models  # noqa: F401 — register every table before the session fixture's create_all


async def _crypto(session, symbol: str, override: str | None = None):
    from app.models import AssetClass, Instrument

    instr = Instrument(symbol=symbol, currency="USD", pricing_currency="USD",
                       asset_class=AssetClass.CRYPTO, source_override=override)
    session.add(instr)
    await session.flush()
    return instr


async def _coin(session, cid: str, symbol: str, name: str, cap=None):
    from app.models import CoingeckoCoin

    session.add(CoingeckoCoin(id=cid, symbol=symbol, name=name,
                              market_cap_usd=Decimal(cap) if cap is not None else None))


async def _has_id(session, instrument_id: int) -> str | None:
    from sqlalchemy import select

    from app.models import InstrumentIdentifier

    return (await session.execute(
        select(InstrumentIdentifier.value).where(
            InstrumentIdentifier.instrument_id == instrument_id,
            InstrumentIdentifier.id_type == "coingecko_id"))).scalars().first()


async def test_ambiguous_btc_resolves_to_dominant_market_cap(session, monkeypatch):
    """§17-R2: 'btc' matches bitcoin + scam tokens; only bitcoin has a dominant cap → linked.
    The dominant cap here is the STORED one (bitcoin was enriched once) — resolves even offline."""
    from app.services.market import _link_coingecko_by_symbol

    await _coin(session, "bitcoin", "btc", "Bitcoin", cap="1275382680099")
    await _coin(session, "batcat", "btc", "batcat")
    await _coin(session, "big-tom-coin", "btc", "Big Tom Coin")
    btc = await _crypto(session, "BTC", override="alphavantage")
    await session.flush()

    err = await _link_coingecko_by_symbol(session, btc)
    assert err is None, f"expected a clean link, got served error: {err}"
    assert await _has_id(session, btc.id) == "bitcoin"


async def test_ambiguous_xrp_resolves_via_live_market_cap(session, monkeypatch):
    """§17-R2: 'xrp' matches ripple + scam tokens, NONE with a stored cap (the owner's real state).
    The linker fetches live caps for the candidate ids and links the dominant one (ripple)."""
    from app.providers.market import coingecko as cg
    from app.services.market import _link_coingecko_by_symbol

    await _coin(session, "ripple", "xrp", "XRP")                 # stored cap = None (real state)
    await _coin(session, "binance-peg-xrp", "xrp", "Binance-Peg XRP")
    await _coin(session, "harrypotterobamapacman8inu", "xrp", "HPOP8Inu")
    xrp = await _crypto(session, "XRP", override="alphavantage")
    await session.flush()

    async def _fake_prices(ids, timeout=20.0):
        assert set(ids) >= {"ripple", "binance-peg-xrp"}
        return {"ripple": {"usd": 1.09, "usd_market_cap": 64_000_000_000},
                "binance-peg-xrp": {"usd": 1.09, "usd_market_cap": 0},
                "harrypotterobamapacman8inu": {"usd": 0.0001}}
    monkeypatch.setattr(cg, "fetch_prices", _fake_prices)

    err = await _link_coingecko_by_symbol(session, xrp)
    assert err is None, f"expected a clean link, got served error: {err}"
    assert await _has_id(session, xrp.id) == "ripple"


async def test_genuinely_ambiguous_minor_symbol_serves_candidates(session, monkeypatch):
    """§17-R2: two comparable-cap tokens sharing a symbol → NO dominant primary → served
    candidates (never a silent guess). Preserves the dr-27 ambiguous-symbol behaviour."""
    from app.providers.market import coingecko as cg
    from app.services.market import _link_coingecko_by_symbol

    await _coin(session, "dupcoin-a", "dup", "Dup A")
    await _coin(session, "dupcoin-b", "dup", "Dup B")
    dup = await _crypto(session, "DUP")
    await session.flush()

    async def _fake_prices(ids, timeout=20.0):
        return {"dupcoin-a": {"usd_market_cap": 5_000_000},
                "dupcoin-b": {"usd_market_cap": 4_000_000}}   # comparable → not dominant
    monkeypatch.setattr(cg, "fetch_prices", _fake_prices)

    err = await _link_coingecko_by_symbol(session, dup)
    assert err is not None and "multiple" in err.lower()
    assert "dupcoin-a" in err and "dupcoin-b" in err
    assert await _has_id(session, dup.id) is None


async def test_crypto_with_av_override_still_acquires_coingecko_history(session, monkeypatch):
    """§17-R1/R2 (F-6, the owner's exact BTC state): a crypto instrument carrying an AV
    quotes-override and NO coingecko_id still acquires CoinGecko history — acquisition routes by
    CLASS, auto-resolves the canonical id, and the AV override never touches the history lane."""
    from sqlalchemy import select

    from app.models import Account, PriceHistory, TxnType
    from app.models import Transaction as Txn
    from app.services import acquire
    from app.services.portfolio import rebuild_holdings_from_transactions

    acc = Account(name="A", currency="SGD")
    session.add(acc)
    await session.flush()
    await _coin(session, "bitcoin", "btc", "Bitcoin", cap="1275382680099")  # dominant stored cap
    await _coin(session, "batcat", "btc", "batcat")
    btc = await _crypto(session, "BTC", override="alphavantage")
    session.add(Txn(account_id=acc.id, instrument_id=btc.id, type=TxnType.BUY,
                    ts=datetime.now(UTC) - timedelta(days=200), quantity=Decimal("1"),
                    price=Decimal("10"), currency="USD"))
    await session.flush()
    await rebuild_holdings_from_transactions(session)

    d1 = int((datetime.now(UTC) - timedelta(days=3)).timestamp() * 1000)

    async def _fake_cg(cid, vs, start, end, timeout=30.0):
        assert cid == "bitcoin"  # routed to CoinGecko with the auto-resolved id, never AV
        return {"prices": [[d1, 64024.63]], "total_volumes": []}
    monkeypatch.setattr("app.services.acquire.fetch_market_chart_range", _fake_cg)

    counts = await acquire.acquire_prices(session, "SGD")
    assert counts["crypto"] == 1
    rows = (await session.execute(
        select(PriceHistory).where(PriceHistory.instrument_id == btc.id))).scalars().all()
    assert rows and all(r.source == "coingecko" for r in rows)
    assert await _has_id(session, btc.id) == "bitcoin"  # the id was auto-linked at acquisition


async def test_coverage_names_the_blocker_for_unmapped_crypto(session):
    """§17-R3 (F-6): an uncovered crypto with no CoinGecko mapping is served the BLOCKER
    ('No CoinGecko mapping for BTC …'), never the 'run Build history' CTA the owner just ran."""
    from app.models import Account, TxnType
    from app.models import Transaction as Txn
    from app.services.coverage import coverage_summary
    from app.services.portfolio import rebuild_holdings_from_transactions

    acc = Account(name="A", currency="SGD")
    session.add(acc)
    await session.flush()
    btc = await _crypto(session, "BTC", override="alphavantage")
    session.add(Txn(account_id=acc.id, instrument_id=btc.id, type=TxnType.BUY,
                    ts=datetime.now(UTC) - timedelta(days=200), quantity=Decimal("1"),
                    price=Decimal("10"), currency="USD"))
    await session.flush()
    await rebuild_holdings_from_transactions(session)

    summ = await coverage_summary(session, "SGD")
    row = next(r for r in summ["instruments"] if r["symbol"] == "BTC")
    assert not row["covered"]
    assert "coingecko mapping" in row["summary"].lower() and "BTC" in row["summary"]
    assert "run build history" not in row["summary"].lower()

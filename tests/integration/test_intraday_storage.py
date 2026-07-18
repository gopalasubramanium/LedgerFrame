# SPDX-License-Identifier: AGPL-3.0-or-later
"""R-42 Phase 0.2 — interval-dimensioned storage pins (§9-1 / §9-4, dr-25 §4 guard).

The §2.1 survey proved the daily↔intraday partition is *structural*: the unique key is
(instrument_id, interval, ts); daily writes normalise ts to midnight while intraday keeps
its per-bar ts; the read filters `interval == interval`; and the daily collapse/repair
helpers early-return for non-daily. These pins lock that for the intraday axis so the
dr-25 "comb" is STRUCTURALLY IMPOSSIBLE across daily-vs-intraday — not merely absent by
luck — plus the §9-4 additive-idempotent, real-supersedes-demo upsert per interval.
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, select

import app.services.market as market
from app.models import Instrument, PriceHistory, Setting


class _IntradayStub:
    """A non-mock ('real') provider so get_history_cached serves/writes the cache
    (is_demo=False) instead of regenerating from the demo generator."""

    name = "alphavantage"
    fetch_on_demand = False

    def __init__(self, candles):
        self._candles = candles

    async def get_history(self, *a, **k):
        return self._candles


async def _mk_instrument(session, symbol="AAPL"):
    instr = Instrument(symbol=symbol, name=f"{symbol} Inc.", asset_class="equity", currency="USD")
    session.add(instr)
    await session.flush()
    return instr


def _candle(ts, close):
    c = Decimal(str(close))
    from app.schemas.common import Candle

    return Candle(ts=ts, open=c, high=c, low=c, close=c, volume=Decimal("1000"))


async def _row_count(session, instr_id, interval):
    return (await session.execute(
        select(func.count()).select_from(PriceHistory).where(
            PriceHistory.instrument_id == instr_id, PriceHistory.interval == interval)
    )).scalar_one()


async def test_intraday_rows_never_surface_in_a_daily_read(session, monkeypatch):
    # A daily row and an intraday row on the SAME trading date, same instrument.
    monkeypatch.setattr(market, "get_provider", lambda: _IntradayStub([]))
    instr = await _mk_instrument(session)
    day = datetime(2026, 7, 17, tzinfo=UTC)
    session.add(PriceHistory(instrument_id=instr.id, interval="1d", ts=day,
                             open=Decimal("190"), high=Decimal("190"), low=Decimal("190"),
                             close=Decimal("190"), volume=Decimal("2000000"), source="alphavantage"))
    session.add(PriceHistory(instrument_id=instr.id, interval="1min",
                             ts=day.replace(hour=19, minute=59), open=Decimal("195"), high=Decimal("195"),
                             low=Decimal("195"), close=Decimal("195"), volume=Decimal("1000"), source="alphavantage"))
    await session.flush()

    start, end = day - timedelta(days=2), day + timedelta(days=1)
    daily = await market.get_history_cached(session, "AAPL", "1d", start, end, allow_fetch=False)
    intraday = await market.get_history_cached(session, "AAPL", "1min", start, end, allow_fetch=False)

    assert [c.close for c in daily] == [Decimal("190")]          # only the daily row
    assert [c.close for c in intraday] == [Decimal("195")]        # only the intraday row
    # And the daily read's single row is midnight-normalised; the intraday one keeps time.
    assert daily[0].ts.hour == 0 and daily[0].ts.minute == 0
    assert intraday[0].ts.hour == 19 and intraday[0].ts.minute == 59


async def test_daily_read_is_empty_when_only_intraday_exists(session, monkeypatch):
    monkeypatch.setattr(market, "get_provider", lambda: _IntradayStub([]))
    instr = await _mk_instrument(session)
    day = datetime(2026, 7, 17, 19, 59, tzinfo=UTC)
    session.add(PriceHistory(instrument_id=instr.id, interval="1min", ts=day,
                             open=Decimal("195"), high=Decimal("195"), low=Decimal("195"),
                             close=Decimal("195"), volume=Decimal("1000"), source="alphavantage"))
    await session.flush()
    daily = await market.get_history_cached(session, "AAPL", "1d",
                                            day - timedelta(days=2), day + timedelta(days=1), allow_fetch=False)
    assert daily == []


async def test_intraday_fetch_writes_perbar_rows_then_reuses_cache(session, monkeypatch):
    base = datetime(2026, 7, 17, 15, 55, tzinfo=UTC)
    candles = [_candle(base + timedelta(minutes=i), 195 + i) for i in range(5)]
    monkeypatch.setattr(market, "get_provider", lambda: _IntradayStub(candles))
    instr = await _mk_instrument(session)

    served = await market.get_history_cached(session, "AAPL", "1min",
                                             base - timedelta(hours=1), base + timedelta(hours=1))
    assert len(served) == 5
    assert await _row_count(session, instr.id, "1min") == 5
    # Rows are per-bar (distinct exact ts, time-of-day preserved) and provider-labelled.
    rows = (await session.execute(select(PriceHistory).where(
        PriceHistory.instrument_id == instr.id, PriceHistory.interval == "1min"))).scalars().all()
    assert {r.ts.minute for r in rows} == {55, 56, 57, 58, 59}
    assert all(r.source == "alphavantage" for r in rows)


async def test_intraday_refetch_is_idempotent_no_duplicate_bars(session, monkeypatch):
    base = datetime(2026, 7, 17, 15, 55, tzinfo=UTC)
    candles = [_candle(base + timedelta(minutes=i), 195 + i) for i in range(5)]
    monkeypatch.setattr(market, "get_provider", lambda: _IntradayStub(candles))
    instr = await _mk_instrument(session)
    win = (base - timedelta(hours=1), base + timedelta(hours=1))

    await market.get_history_cached(session, "AAPL", "1min", *win)
    # Drop the 12h freshness marker so the SECOND call actually re-fetches + re-upserts.
    marker = (await session.execute(
        select(Setting).where(Setting.key == f"hist_fetched:{instr.id}:1min"))).scalars().first()
    if marker:
        await session.delete(marker)
        await session.flush()
    served = await market.get_history_cached(session, "AAPL", "1min", *win)

    assert len(served) == 5
    assert await _row_count(session, instr.id, "1min") == 5   # additive-idempotent: no dupes


async def test_demo_intraday_is_generated_but_never_cached(session, monkeypatch):
    # §9-8 + dr-24: the mock/demo provider generates intraday ON DEMAND (1D/5D stay alive in
    # demo — no dead control) and NEVER caches it. Caching would freeze the generator and
    # could bleed demo bars into a real cache; the regeneration path never touches real caches.
    from app.providers.market.mock import MockMarketDataProvider

    monkeypatch.setattr(market, "get_provider", lambda: MockMarketDataProvider())
    instr = await _mk_instrument(session)
    end = datetime(2026, 7, 17, 20, 0, tzinfo=UTC)
    served = await market.get_history_cached(session, "AAPL", "1min", end - timedelta(minutes=30), end)
    assert len(served) > 0                                   # alive in demo
    assert await _row_count(session, instr.id, "1min") == 0  # never persisted


async def test_intraday_first_fetch_spends_then_12h_marker_serves_cache_no_respend(session, monkeypatch):
    # §9-3 trigger flow: the FIRST user-triggered fetch spends (the provider is called, the
    # 12h `hist_fetched:{id}:{interval}` marker is written); a re-view WITHIN the marker serves
    # the STORED series with NO second provider call — the budget lock the range button relies
    # on so repeated clicks never re-spend. This is the "fetched → cached-fresh" transition.
    base = datetime(2026, 7, 17, 15, 55, tzinfo=UTC)
    candles = [_candle(base + timedelta(minutes=i), 195 + i) for i in range(5)]
    calls = {"n": 0}

    class _Counting(_IntradayStub):
        async def get_history(self, *a, **k):
            calls["n"] += 1
            return self._candles

    monkeypatch.setattr(market, "get_provider", lambda: _Counting(candles))
    instr = await _mk_instrument(session)
    win = (base - timedelta(hours=1), base + timedelta(hours=1))

    # Before any fetch the 12h marker is not fresh.
    assert await market.intraday_marker_fresh(session, instr.id, "1min") is False
    first = await market.get_history_cached(session, "AAPL", "1min", *win)
    assert len(first) == 5 and calls["n"] == 1            # spent once
    # The marker is now fresh → a re-view serves the stored series without re-spending.
    assert await market.intraday_marker_fresh(session, instr.id, "1min") is True
    second = await market.get_history_cached(session, "AAPL", "1min", *win)
    assert [c.close for c in second] == [c.close for c in first]
    assert calls["n"] == 1                                # cached-fresh — NO re-spend
    assert await _row_count(session, instr.id, "1min") == 5


async def test_intraday_real_supersedes_demo_at_same_ts(session, monkeypatch):
    # §9-4 precedence extends per interval: a REAL intraday bar supersedes a demo bar
    # at the same exact ts (never a second row → never a comb).
    ts = datetime(2026, 7, 17, 15, 59, tzinfo=UTC)
    monkeypatch.setattr(market, "get_provider", lambda: _IntradayStub([_candle(ts, 195)]))
    instr = await _mk_instrument(session)
    session.add(PriceHistory(instrument_id=instr.id, interval="1min", ts=ts,
                             open=Decimal("250"), high=Decimal("250"), low=Decimal("250"),
                             close=Decimal("250"), volume=Decimal("1"), source="mock"))
    await session.flush()

    await market.get_history_cached(session, "AAPL", "1min", ts - timedelta(hours=1), ts + timedelta(hours=1))
    assert await _row_count(session, instr.id, "1min") == 1
    row = (await session.execute(select(PriceHistory).where(
        PriceHistory.instrument_id == instr.id, PriceHistory.interval == "1min"))).scalars().first()
    assert row.close == Decimal("195") and row.source == "alphavantage"


async def _mk_hist(session, instr_id, ts, interval="5min", source="alphavantage"):
    from app.models import PriceHistory
    c = Decimal("100")
    session.add(PriceHistory(instrument_id=instr_id, interval=interval, ts=ts,
                             open=c, high=c, low=c, close=c, volume=Decimal("1000"),
                             source=source))


async def test_extended_hours_purge_removes_only_out_of_session_intraday(session):
    """W-3: the one-time cleanup removes persisted EXTENDED-HOURS intraday bars (outside
    the US regular session 09:30–16:00 ET) and nothing else — regular-session intraday and
    daily rows are untouched. Idempotent: a second run purges 0. (July = EDT, UTC-4:
    09:30 ET = 13:30 UTC, 16:00 ET = 20:00 UTC.)"""
    instr = await _mk_instrument(session)
    # Regular session (kept), including both boundaries.
    await _mk_hist(session, instr.id, datetime(2026, 7, 15, 13, 30, tzinfo=UTC))  # 09:30 ET
    await _mk_hist(session, instr.id, datetime(2026, 7, 15, 14, 0, tzinfo=UTC))   # 10:00 ET
    await _mk_hist(session, instr.id, datetime(2026, 7, 15, 20, 0, tzinfo=UTC))   # 16:00 ET
    # Extended hours (purged).
    await _mk_hist(session, instr.id, datetime(2026, 7, 15, 12, 0, tzinfo=UTC))   # 08:00 ET pre
    await _mk_hist(session, instr.id, datetime(2026, 7, 15, 23, 0, tzinfo=UTC))   # 19:00 ET post
    # A daily row must never be touched by the intraday cleanup.
    await _mk_hist(session, instr.id, datetime(2026, 7, 15, 0, 0, tzinfo=UTC), interval="1d")
    await session.flush()

    result = await market.repair_extended_hours_intraday(session)
    await session.flush()
    assert result["purged"] == 2
    assert await _row_count(session, instr.id, "5min") == 3   # only regular-session bars remain
    assert await _row_count(session, instr.id, "1d") == 1     # daily untouched

    again = await market.repair_extended_hours_intraday(session)
    assert again["purged"] == 0

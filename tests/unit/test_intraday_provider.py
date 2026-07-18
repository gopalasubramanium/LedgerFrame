# SPDX-License-Identifier: AGPL-3.0-or-later
"""R-42 Phase 0 — provider intraday seam (§9-2 / §9-6 / §9-7).

Fail-first pins for the first backend delta: the `intraday` capability flag, the
mock provider's owner-ruled 1-min / 5-min cadence (replacing the old 30-min bars),
and Alpha Vantage's TIME_SERIES_INTRADAY routing (+ tz-explicit, time-preserving
timestamps — intraday is NEVER midnight-normalised, §2.1).
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.providers.market.mock import MockMarketDataProvider
from app.providers.market.router import capabilities_for


def test_intraday_capability_declared():
    # §9-6: providers with a real intraday endpoint declare it; NAV/spot/daily-only
    # providers do not (the flag must match the adapter, never over-claim).
    assert capabilities_for("mock").intraday is True
    assert capabilities_for("alphavantage").intraday is True
    assert capabilities_for("yahoo").intraday is True
    assert capabilities_for("amfi_nav").intraday is False
    assert capabilities_for("coingecko").intraday is False
    assert capabilities_for("eodhd").intraday is False
    assert capabilities_for("kite").intraday is False
    assert capabilities_for("csv").intraday is False


async def test_mock_1min_cadence():
    prov = MockMarketDataProvider()
    end = datetime(2026, 7, 17, 20, 0, tzinfo=UTC)
    start = end - timedelta(minutes=30)
    candles = await prov.get_history("AAPL", "1min", start, end)
    assert len(candles) >= 25
    deltas = {candles[i + 1].ts - candles[i].ts for i in range(len(candles) - 1)}
    assert deltas == {timedelta(minutes=1)}


async def test_mock_5min_cadence():
    prov = MockMarketDataProvider()
    end = datetime(2026, 7, 17, 20, 0, tzinfo=UTC)
    start = end - timedelta(hours=2)
    candles = await prov.get_history("AAPL", "5min", start, end)
    deltas = {candles[i + 1].ts - candles[i].ts for i in range(len(candles) - 1)}
    assert deltas == {timedelta(minutes=5)}


async def test_mock_intraday_bars_are_not_flat():
    # Each bar carries a distinct value — an honest intraday wiggle, not one level
    # repeated (the old 30-min bucketing flattened every bar in a window).
    prov = MockMarketDataProvider()
    end = datetime(2026, 7, 17, 20, 0, tzinfo=UTC)
    start = end - timedelta(minutes=30)
    closes = {c.close for c in await prov.get_history("AAPL", "1min", start, end)}
    assert len(closes) > 3


async def test_mock_daily_cadence_unchanged():
    # Regression: daily bars stay 1-per-day (the structural partition, §2.1).
    prov = MockMarketDataProvider()
    end = datetime(2026, 7, 18, 0, 0, tzinfo=UTC)
    start = end - timedelta(days=5)
    candles = await prov.get_history("AAPL", "1d", start, end)
    deltas = {candles[i + 1].ts - candles[i].ts for i in range(len(candles) - 1)}
    assert deltas == {timedelta(days=1)}


async def test_av_intraday_routes_to_intraday_endpoint(monkeypatch):
    from app.providers.market.external import ExternalMarketDataProvider

    prov = ExternalMarketDataProvider("alphavantage", "KEY")
    captured: dict = {}

    async def _fake_get(params):
        captured.update(params)
        return {"Time Series (1min)": {
            "2026-07-17 15:59:00": {"1. open": "195.0", "2. high": "195.5",
                                    "3. low": "194.8", "4. close": "195.2", "5. volume": "1000"},
            "2026-07-17 15:58:00": {"1. open": "194.9", "2. high": "195.1",
                                    "3. low": "194.7", "4. close": "195.0", "5. volume": "900"},
        }}

    monkeypatch.setattr(prov, "_get", _fake_get)
    start = datetime(2026, 7, 17, 0, 0, tzinfo=UTC)
    end = datetime(2026, 7, 18, 0, 0, tzinfo=UTC)
    candles = await prov.get_history("AAPL", "1min", start, end)
    assert captured.get("function") == "TIME_SERIES_INTRADAY"
    assert captured.get("interval") == "1min"
    # W-3 (R-42 3b): regular trading hours only — AV defaults extended_hours=true, whose
    # pre/post-market bars rendered as session-boundary spikes on 5D.
    assert captured.get("extended_hours") == "false"
    assert len(candles) == 2
    # Time-of-day is preserved (intraday is not midnight-normalised) and tz-explicit.
    assert all(c.ts.tzinfo is not None for c in candles)
    assert any(c.ts.hour != 0 or c.ts.minute != 0 for c in candles)


async def test_av_daily_still_routes_to_daily_endpoint(monkeypatch):
    from app.providers.market.external import ExternalMarketDataProvider

    prov = ExternalMarketDataProvider("alphavantage", "KEY")
    captured: dict = {}

    async def _fake_get(params):
        captured.update(params)
        return {"Time Series (Daily)": {
            "2026-07-17": {"1. open": "195.0", "2. high": "195.5",
                           "3. low": "194.8", "4. close": "195.2", "5. volume": "1000"},
        }}

    monkeypatch.setattr(prov, "_get", _fake_get)
    start = datetime(2026, 7, 1, 0, 0, tzinfo=UTC)
    end = datetime(2026, 7, 18, 0, 0, tzinfo=UTC)
    await prov.get_history("AAPL", "1d", start, end)
    assert captured.get("function") == "TIME_SERIES_DAILY"


async def test_yahoo_intraday_maps_interval_and_range(monkeypatch):
    from app.providers.market.yahoo import YahooMarketDataProvider

    prov = YahooMarketDataProvider()
    captured: dict = {}

    async def _fake_chart(ysym, params):
        captured.update(params)
        base = int(datetime(2026, 7, 17, 15, 55, tzinfo=UTC).timestamp())
        return {
            "timestamp": [base, base + 60, base + 120],
            "indicators": {"quote": [{
                "open": [195.0, 195.1, 195.2], "high": [195.3, 195.4, 195.5],
                "low": [194.8, 194.9, 195.0], "close": [195.1, 195.2, 195.3],
                "volume": [1000, 1100, 1200],
            }]},
        }

    monkeypatch.setattr(prov, "_chart", _fake_chart)
    start = datetime(2026, 7, 17, 15, 0, tzinfo=UTC)
    end = datetime(2026, 7, 17, 21, 0, tzinfo=UTC)
    candles = await prov.get_history("AAPL", "1min", start, end)
    assert captured.get("interval") == "1m"
    assert captured.get("range") == "1d"
    assert len(candles) == 3

# SPDX-License-Identifier: AGPL-3.0-or-later
"""R-42 Phase 0.3 — the served per-range intraday availability decision (§9-2/§9-3/§9-9).

D-105: enabled/disabled + the REASON is decided server-side (tier- & capability-aware) and
SERVED — the frontend renders it and never decides it (this closes the dr-7 gap where the
disable set + reason string were frontend constants). One canonical derivation, reused by
the fetch trigger so the UI can never disagree with what the backend will actually do.
"""
from __future__ import annotations

import app.services.market as market
from app.models import Instrument


class _ProvStub:
    fetch_on_demand = False

    def __init__(self, name, av_tier=None):
        self.name = name
        self.av_tier = av_tier

    async def get_history(self, *a, **k):
        return []


async def _mk(session, **kw):
    defaults = {"symbol": "AAPL", "name": "Apple Inc.", "asset_class": "equity", "currency": "USD"}
    defaults.update(kw)
    instr = Instrument(**defaults)
    session.add(instr)
    await session.flush()
    return instr


async def test_ranges_are_1min_and_5min_server_side(session):
    # §9-2: the range→interval mapping lives server-side; 1D→1min, 5D→5min.
    assert market.INTRADAY_RANGES["1D"]["interval"] == "1min"
    assert market.INTRADAY_RANGES["5D"]["interval"] == "5min"
    instr = await _mk(session)
    avail = await market.intraday_availability(session, instr, no_egress=False)
    assert set(avail["ranges"]) == {"1D", "5D"}
    assert avail["ranges"]["1D"]["interval"] == "1min"
    assert avail["ranges"]["5D"]["interval"] == "5min"


async def test_mock_equity_is_enabled(session):
    # Active provider = mock (intraday-capable) → 1D/5D enabled, no reason.
    instr = await _mk(session)
    avail = await market.intraday_availability(session, instr, no_egress=False)
    for r in ("1D", "5D"):
        assert avail["ranges"][r]["enabled"] is True
        assert avail["ranges"][r]["reason"] is None


async def test_mutual_fund_is_disabled_with_nav_reason(session):
    instr = await _mk(session, symbol="HDFCNIFTY", asset_class="mutual_fund",
                      listing_country="IN", currency="INR")
    avail = await market.intraday_availability(session, instr, no_egress=False)
    slot = avail["ranges"]["1D"]
    assert slot["enabled"] is False
    assert "once daily" in slot["reason"].lower() or "nav" in slot["reason"].lower()
    assert slot["state"] == "class_disabled"


async def test_alphavantage_free_tier_is_disabled_server_side(session, monkeypatch):
    monkeypatch.setattr(market, "get_provider", lambda: _ProvStub("alphavantage", av_tier="free"))
    instr = await _mk(session)
    slot = (await market.intraday_availability(session, instr, no_egress=False))["ranges"]["1D"]
    assert slot["enabled"] is False
    assert slot["state"] == "tier_disabled"
    assert "premium" in slot["reason"].lower()


async def test_alphavantage_premium_tier_is_enabled(session, monkeypatch):
    monkeypatch.setattr(market, "get_provider", lambda: _ProvStub("alphavantage", av_tier="premium"))
    instr = await _mk(session)
    slot = (await market.intraday_availability(session, instr, no_egress=False))["ranges"]["1D"]
    assert slot["enabled"] is True


async def test_provider_without_intraday_capability_is_disabled(session, monkeypatch):
    # eodhd: history-capable but NOT intraday-capable → honest served refusal.
    monkeypatch.setattr(market, "get_provider", lambda: _ProvStub("eodhd"))
    instr = await _mk(session)
    slot = (await market.intraday_availability(session, instr, no_egress=False))["ranges"]["1D"]
    assert slot["enabled"] is False
    assert slot["state"] == "provider_incapable"
    assert "intraday" in slot["reason"].lower()


async def test_no_egress_disables_a_network_provider(session, monkeypatch):
    monkeypatch.setattr(market, "get_provider", lambda: _ProvStub("alphavantage", av_tier="premium"))
    instr = await _mk(session)
    slot = (await market.intraday_availability(session, instr, no_egress=True))["ranges"]["1D"]
    assert slot["enabled"] is False
    assert slot["state"] == "no_egress"


async def test_benchmark_intraday_reason_is_served(session):
    # §9-5: the benchmark overlay is daily-range only — the reason is SERVED, not a
    # frontend literal.
    instr = await _mk(session)
    avail = await market.intraday_availability(session, instr, no_egress=False)
    assert avail["benchmark_reason"] == "Benchmark comparison is daily-range only."

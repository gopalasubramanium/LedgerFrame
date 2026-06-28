"""Yahoo provider symbol translation + graceful degradation (no network)."""

from __future__ import annotations

import pytest

from app.providers.market.yahoo import YahooMarketDataProvider, _range_for, to_yahoo_symbol


@pytest.mark.parametrize(
    ("internal", "yahoo"),
    [
        ("AAPL", "AAPL"),
        ("^GSPC", "^GSPC"),
        ("BTC", "BTC-USD"),
        ("ETH", "ETH-USD"),
        ("RELIANCE.NSE", "RELIANCE.NS"),   # our .NSE -> Yahoo .NS
        ("HDFC.BSE", "HDFC.BO"),           # our .BSE -> Yahoo .BO
        ("VOD.L", "VOD.L"),                 # unchanged
        ("7203.T", "7203.T"),               # unchanged
    ],
)
def test_to_yahoo_symbol(internal, yahoo):
    assert to_yahoo_symbol(internal) == yahoo


def test_range_for_buckets():
    assert _range_for(3) == "5d"
    assert _range_for(30) == "1mo"
    assert _range_for(200) == "1y"
    assert _range_for(1000) == "5y"


async def test_quote_degrades_to_unavailable_on_error(monkeypatch):
    p = YahooMarketDataProvider()

    async def boom(url, params):
        raise RuntimeError("rate limited (429)")

    monkeypatch.setattr(p, "_get", boom)
    q = await p.get_quote("^GSPC")
    assert q.price is None
    assert q.entitlement.value == "unavailable"  # honest, never fabricated


async def test_fx_falls_back_when_unavailable(monkeypatch):
    p = YahooMarketDataProvider()

    async def boom(url, params):
        raise RuntimeError("429")

    monkeypatch.setattr(p, "_get", boom)
    fx = await p.get_fx_rate("USD", "SGD")
    assert fx.rate > 0  # mock fallback keeps valuation working

"""Alpha Vantage premium Index Data parsing + graceful fallback."""

from __future__ import annotations

from app.providers.market.external import (
    ExternalMarketDataProvider,
    _find_time_series,
    _row_field,
)


def test_find_time_series_tolerates_key_names():
    data = {
        "Meta Data": {"info": "x"},
        "Time Series (Daily)": {
            "2026-06-26": {"4. close": "5400.1"},
            "2026-06-25": {"4. close": "5380.0"},
        },
    }
    series = _find_time_series(data)
    assert "2026-06-26" in series


def test_row_field_matches_numbered_and_plain_keys():
    assert _row_field({"4. close": "10"}, "close") == "10"
    assert _row_field({"close": "11"}, "close") == "11"
    assert _row_field({"1. open": "9"}, "open") == "9"


async def test_index_quote_parses_premium_response(monkeypatch):
    p = ExternalMarketDataProvider("alphavantage", "testkey")

    async def fake_get(params):
        assert params["function"] == "INDEX_DATA"
        return {"data": {
            "2026-06-26": {"1. open": "5390", "2. high": "5410", "3. low": "5385", "4. close": "5400"},
            "2026-06-25": {"1. open": "5360", "2. high": "5385", "3. low": "5355", "4. close": "5380"},
        }}

    monkeypatch.setattr(p, "_get", fake_get)
    q = await p.get_quote("SPX")
    assert float(q.price) == 5400.0
    assert float(q.previous_close) == 5380.0
    assert q.entitlement.value == "delayed"


async def test_index_quote_unavailable_when_not_premium(monkeypatch):
    p = ExternalMarketDataProvider("alphavantage", "testkey")

    async def fake_get(params):
        # Non-premium keys get a notice; _get raises RateLimited on Note/Information.
        from app.providers.market.external import RateLimited
        raise RateLimited("premium endpoint")

    monkeypatch.setattr(p, "_get", fake_get)
    q = await p.get_quote("SPX")
    assert q.price is None
    assert q.entitlement.value == "unavailable"  # → Global page falls back to proxy

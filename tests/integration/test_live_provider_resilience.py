"""A live provider that returns no price must not crash the session or endpoints."""

from __future__ import annotations

from datetime import datetime, timezone

from app.schemas.common import EntitlementStatus, Quote
from app.services import market


class _NoDataProvider:
    name = "stub"
    fetch_on_demand = False

    async def get_quote(self, symbol, exchange=None):
        return Quote(symbol=symbol.upper(), price=None, currency="USD", source="stub",
                     entitlement=EntitlementStatus.UNAVAILABLE,
                     received_at=datetime.now(timezone.utc), is_stale=True)


async def test_refresh_quote_with_no_price_does_not_write_null(session, monkeypatch):
    monkeypatch.setattr(market, "get_provider", lambda: _NoDataProvider())
    q = await market.refresh_quote(session, "AAPL")
    assert q.price is None
    assert q.entitlement == EntitlementStatus.UNAVAILABLE
    # Session must still be usable (not poisoned by a failed NULL insert).
    again = await market.get_cached_quote(session, "AAPL")
    assert again.price is None


async def test_market_endpoints_ok_when_provider_returns_nothing(app_client, monkeypatch):
    monkeypatch.setattr(market, "get_provider", lambda: _NoDataProvider())
    assert (await app_client.get("/api/v1/markets/overview")).status_code == 200
    assert (await app_client.get("/api/v1/markets/global")).status_code == 200
    assert (await app_client.post("/api/v1/system/refresh-data")).status_code == 200

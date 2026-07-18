# SPDX-License-Identifier: AGPL-3.0-or-later
"""Phase A1: per-instrument routing wired into the quote path. The active market
provider must not fetch/overwrite an AMFI/CoinGecko/manual instrument."""

from __future__ import annotations


async def _add(app_client, symbol, **kw):
    body = {"symbol": symbol, "type": "buy", "ts": "2025-01-15T10:00:00",
            "quantity": 1, "price": 1, "currency": "INR"}
    body.update(kw)
    return await app_client.post("/api/v1/portfolio/transactions", json=body)


async def test_amfi_fund_not_priced_by_the_equity_provider(app_client):
    # Add a fund, map it to AMFI (no NAV published in this test) — the mock provider
    # must NOT hand it a fabricated equity price.
    await _add(app_client, "HDFCMF", asset_class="mutual_fund")
    await app_client.post("/api/v1/instruments/HDFCMF/map-amfi", json={"code": "119551"})
    d = (await app_client.get("/api/v1/instruments/HDFCMF")).json()
    q = d["quote"]
    assert q["source"] != "mock"                 # never a market-feed quote for a fund
    assert q["price"] is None                     # unavailable until NAV is published


async def test_equity_still_priced_by_active_provider(app_client):
    # A normal US equity is unaffected — the active (mock) provider prices it.
    d = (await app_client.get("/api/v1/instruments/AAPL")).json()
    assert d["quote"]["price"] is not None and d["quote"]["source"] == "mock"


async def test_pricing_health_exposes_routing(app_client):
    ph = (await app_client.get("/api/v1/portfolio/pricing-health")).json()
    rows = ph["holdings"]
    assert rows and all("route_source" in r and "route_lane" in r for r in rows)


async def test_pricing_health_serves_router_reason(app_client):
    # D1-c: the router's OWN reason (e.g. "awaiting NAV (refresh AMFI)") is served as a
    # distinct field so the diagnostics modal can surface it — it is otherwise masked by
    # the generic UNAVAILABLE failure_reason. RED before: no route_reason field.
    await _add(app_client, "HDFCMF", asset_class="mutual_fund")
    await app_client.post("/api/v1/instruments/HDFCMF/map-amfi", json={"code": "119551"})
    ph = (await app_client.get("/api/v1/portfolio/pricing-health")).json()
    row = next(r for r in ph["holdings"] if r["symbol"] == "HDFCMF")
    assert row["route_reason"] == "awaiting NAV (refresh AMFI)"

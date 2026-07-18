# SPDX-License-Identifier: AGPL-3.0-or-later
"""Regression: a holding added via the API is classified (asset class + country),
not defaulted to an unclassified US equity — so allocation and region-first Markets
reflect it. Covers the v1.10→v1.22 gap where wizard-added assets vanished from crypto
allocation and region tabs."""

from __future__ import annotations


async def test_added_crypto_is_classified_and_in_allocation(app_client):
    r = await app_client.post("/api/v1/portfolio/transactions", json={
        "symbol": "XRP", "type": "buy", "ts": "2025-01-15T10:00:00",
        "quantity": 1000, "price": 0.5, "currency": "USD", "asset_class": "crypto", "name": "XRP",
    })
    assert r.status_code == 200

    meta = (await app_client.get("/api/v1/instruments/XRP")).json()["instrument"]
    assert meta["asset_class"] == "crypto"          # not "equity"
    # §14dr-27(b): crypto is global — a bare crypto symbol is NOT fabricated a US listing
    # (the bare-ticker->US default is an exchange-listed-equity heuristic). Country stays
    # unknown; it still lands in crypto allocation below (the real regression this guards).
    assert meta["country"] != "US"

    summary = (await app_client.get("/api/v1/portfolio/summary")).json()
    assert summary["allocation_by_class"].get("crypto", 0) > 0


async def test_indian_stock_gets_country_for_region_grouping(app_client):
    await app_client.post("/api/v1/portfolio/transactions", json={
        "symbol": "TATAMOTORS.NSE", "type": "buy", "ts": "2025-02-01T10:00:00",
        "quantity": 10, "price": 900, "currency": "INR", "asset_class": "equity",
        "name": "Tata Motors", "exchange": "NSE",
    })
    items = (await app_client.get("/api/v1/markets/overview")).json()["instruments"]
    row = next(i for i in items if i["symbol"] == "TATAMOTORS.NSE")
    assert row["country"] == "IN" and row["held"] is True

# SPDX-License-Identifier: AGPL-3.0-or-later
"""D-097 — class-aware instrument search for the Add-flow picker. Existing
instruments are bucketed by the picked class; a match under a DIFFERENT class is
returned as `other_class` (navigate-only), never mixed into the selectable pool;
provider suggestions are routed to the picked class's provider."""

from __future__ import annotations


async def _mk(app_client, symbol, asset_class, ccy="USD"):
    r = await app_client.post("/api/v1/portfolio/transactions", json={
        "symbol": symbol, "type": "buy", "ts": "2024-01-01T00:00:00",
        "quantity": 1, "price": 1, "currency": ccy, "asset_class": asset_class,
    })
    assert r.status_code == 200


async def test_instruments_search_is_class_aware(app_client):
    await _mk(app_client, "ZFUNDEQ", "equity")
    await _mk(app_client, "ZFUNDMF", "mutual_fund", ccy="INR")

    r = (await app_client.get("/api/v1/instruments/search?q=ZFUND&asset_class=mutual_fund")).json()
    existing = {i["symbol"] for i in r["existing"]}
    other = {i["symbol"] for i in r["other_class"]}
    # Only the mutual_fund match is selectable; the equity is cross-class.
    assert "ZFUNDMF" in existing and "ZFUNDEQ" not in existing
    assert "ZFUNDEQ" in other
    assert all(i["asset_class"] == "mutual_fund" for i in r["existing"])
    # Provider suggestions bucket is always present (routed by class; may be empty).
    assert "suggestions" in r


async def test_instruments_search_without_class_buckets_all_as_existing(app_client):
    await _mk(app_client, "ZSOLO", "equity")
    r = (await app_client.get("/api/v1/instruments/search?q=ZSOLO")).json()
    # No class filter → everything is 'existing', nothing is cross-class.
    assert "ZSOLO" in {i["symbol"] for i in r["existing"]}
    assert r["other_class"] == []

async def test_instruments_search_carries_master_state_per_class(app_client):
    """§14dr-13 — the search response carries the class's instrument-master state so the
    picker's honest empty can say WHY (never synced vs no match). Demo seeds CoinGecko coins
    but no AMFI schemes → crypto master is synced, mutual-fund master is never synced until
    a refresh; classes with no dedicated master (equity) carry master=None."""
    from pathlib import Path
    # Crypto: demo seeds the coin master → synced.
    r = (await app_client.get("/api/v1/instruments/search?q=zz&asset_class=crypto")).json()
    assert r["master"] == {"provider": "coingecko", "synced": True}
    # Mutual fund: no AMFI schemes seeded → never synced (the actionable empty).
    r = (await app_client.get("/api/v1/instruments/search?q=zz&asset_class=mutual_fund")).json()
    assert r["master"] == {"provider": "amfi", "synced": False}
    # After an AMFI refresh, the master reads synced.
    fixture = (Path(__file__).parents[1] / "fixtures" / "amfi_navall_sample.txt").read_bytes()
    await app_client.post("/api/v1/amfi/refresh", files={"file": ("NAVAll.txt", fixture, "text/plain")})
    r = (await app_client.get("/api/v1/instruments/search?q=zz&asset_class=mutual_fund")).json()
    assert r["master"]["synced"] is True
    # No dedicated master for the equity lane (live provider search) → master is None.
    r = (await app_client.get("/api/v1/instruments/search?q=zz&asset_class=equity")).json()
    assert r["master"] is None

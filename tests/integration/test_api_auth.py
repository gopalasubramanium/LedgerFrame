# SPDX-License-Identifier: AGPL-3.0-or-later
"""API-level tests: demo boot, watchlist creation, PIN lock on mutations,
offline/degraded behaviour, and that the app works without Hailo or a provider.
"""

from __future__ import annotations


async def test_dashboard_opens_in_demo_mode(app_client):
    r = await app_client.get("/api/v1/system/status")
    assert r.status_code == 200
    assert r.json()["demo_mode"] is True
    home = await app_client.get("/api/v1/dashboard/home")
    assert home.status_code == 200
    assert home.json()["portfolio"]["total_value"] is not None


async def test_seeded_holdings_present(app_client):
    r = await app_client.get("/api/v1/portfolio/holdings")
    assert r.status_code == 200
    holdings = r.json()["holdings"]
    assert any(h["symbol"] == "AAPL" for h in holdings)


async def test_create_watchlist(app_client):
    r = await app_client.post("/api/v1/watchlists", json={"name": "Tech", "symbols": ["AAPL", "MSFT"]})
    assert r.status_code == 200
    lists = (await app_client.get("/api/v1/watchlists")).json()["watchlists"]
    assert any(w["name"] == "Tech" for w in lists)


async def test_ai_chat_works_without_hailo(app_client):
    # AI is disabled in tests → deterministic fallback must still answer with facts.
    r = await app_client.post("/api/v1/ai/chat", json={"question": "how did my portfolio do?"})
    assert r.status_code == 200
    assert "not financial advice" in r.text.lower()


async def test_ai_status_reports_unavailable_when_disabled(app_client):
    r = await app_client.get("/api/v1/ai/status")
    assert r.status_code == 200
    assert r.json()["available"] is False


async def test_pin_lock_blocks_mutations(app_client):
    # Set a PIN, then lock; protected mutation must 401.
    set_resp = await app_client.post("/api/v1/auth/set-pin", json={"pin": "004321"})
    assert set_resp.status_code == 200
    await app_client.post("/api/v1/auth/lock")
    app_client.cookies.clear()
    blocked = await app_client.post(
        "/api/v1/watchlists", json={"name": "X", "symbols": []}
    )
    assert blocked.status_code == 401
    # Unlock with correct PIN restores access.
    unlock = await app_client.post("/api/v1/auth/unlock", json={"pin": "004321"})
    assert unlock.status_code == 200
    ok = await app_client.post("/api/v1/watchlists", json={"name": "X", "symbols": []})
    assert ok.status_code == 200


async def test_wrong_pin_rejected(app_client):
    await app_client.post("/api/v1/auth/set-pin", json={"pin": "001111"})
    await app_client.post("/api/v1/auth/lock")
    app_client.cookies.clear()
    bad = await app_client.post("/api/v1/auth/unlock", json={"pin": "000000"})
    assert bad.status_code == 401


async def test_can_set_first_pin_even_with_lan_enabled(app_client, monkeypatch):
    """Regression: LAN-on + no-PIN must NOT block setting the first PIN."""
    from app.core.config import get_settings

    get_settings().allow_lan = True
    try:
        # Before a PIN exists, a mutation is refused (LAN safety)…
        blocked = await app_client.post("/api/v1/watchlists", json={"name": "X", "symbols": []})
        assert blocked.status_code == 403
        # …but setting the FIRST PIN must still succeed (no chicken-and-egg).
        r = await app_client.post("/api/v1/auth/set-pin", json={"pin": "005678"})
        assert r.status_code == 200
        # Now authenticated via the returned cookie → mutations work.
        ok = await app_client.post("/api/v1/watchlists", json={"name": "Y", "symbols": []})
        assert ok.status_code == 200
    finally:
        get_settings().allow_lan = False


async def test_watchlist_add_and_remove(app_client):
    create = await app_client.post("/api/v1/watchlists", json={"name": "WL", "symbols": []})
    wl_id = create.json()["id"]
    add = await app_client.post(f"/api/v1/watchlists/{wl_id}/items", json={"symbol": "tsla"})
    assert add.status_code == 200
    lists = (await app_client.get("/api/v1/watchlists")).json()["watchlists"]
    wl = next(w for w in lists if w["id"] == wl_id)
    assert any(i["symbol"] == "TSLA" for i in wl["items"])
    rm = await app_client.delete(f"/api/v1/watchlists/{wl_id}/items/TSLA")
    assert rm.status_code == 200

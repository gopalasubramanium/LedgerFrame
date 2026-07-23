# SPDX-License-Identifier: AGPL-3.0-or-later
"""Data-source (mock<->live) config endpoints and feed diagnostics."""

from __future__ import annotations


async def test_get_data_source(app_client):
    r = await app_client.get("/api/v1/system/data-source")
    assert r.status_code == 200
    body = r.json()
    assert "mock" in body["providers"]
    assert body["provider"]
    assert "has_api_key" in body


async def test_data_source_serves_verified_quote_entitlement_distinct_from_index_tier(app_client):
    """R-63 I-4 (two-premiums): the endpoint serves ``quote_entitlement`` — the VERIFIED quote
    capability — as a SEPARATE key from ``av_tier`` (the Index Data product). The Settings
    verified-tier display renders them per product, so a coarse "premium" can never stand in for
    a merely-delayed quote entitlement (§9-2, AC-9). Served-shape pin. On the mock provider both
    are null — honest: nothing has been verified. (The value learning is pinned at the provider
    level in ``tests/unit/test_av_quote_envelope.py``.)"""
    body = (await app_client.get("/api/v1/system/data-source")).json()
    assert "quote_entitlement" in body, "verified quote entitlement not served (I-4 display half)"
    assert "av_tier" in body, "Index-Data tier must remain a DISTINCT key, never conflated"


async def test_set_data_source_rejects_unknown(app_client):
    r = await app_client.put("/api/v1/system/data-source", json={"provider": "totally-made-up"})
    assert r.status_code == 400


async def test_set_data_source_writes_env(app_client, tmp_path, monkeypatch):
    # Redirect the .env path so the test doesn't touch the real repo .env.
    import app.core.envfile as envfile

    monkeypatch.setattr(envfile, "ENV_PATH", tmp_path / ".env")
    r = await app_client.put(
        "/api/v1/system/data-source",
        json={"provider": "mock", "base_currency": "USD"},
    )
    assert r.status_code == 200
    content = (tmp_path / ".env").read_text()
    assert "LEDGERFRAME_MARKET_PROVIDER=mock" in content
    assert "LEDGERFRAME_BASE_CURRENCY=USD" in content


async def test_set_data_source_key_only_saves_without_provider(app_client, tmp_path, monkeypatch):
    # data-feed-routing §14dr-1 (layer 1): the Save-key control posts {api_key} ONLY.
    # `provider` was wrongly required, so this 422'd every time (RED). A partial update
    # must store the key and leave the persisted provider untouched.
    import app.core.envfile as envfile

    monkeypatch.setattr(envfile, "ENV_PATH", tmp_path / ".env")
    # Persist a provider first, then save a key-only update.
    await app_client.put("/api/v1/system/data-source", json={"provider": "mock"})
    r = await app_client.put("/api/v1/system/data-source", json={"api_key": "SECRET-KEY"})
    assert r.status_code == 200, r.text
    content = (tmp_path / ".env").read_text()
    assert "LEDGERFRAME_MARKET_API_KEY=SECRET-KEY" in content
    assert "LEDGERFRAME_MARKET_PROVIDER=mock" in content  # provider left as persisted
    # The note must not read "now using 'None'" when no provider was sent.
    assert "None" not in r.json().get("note", "")


async def test_set_data_source_still_rejects_unknown_provider(app_client, tmp_path, monkeypatch):
    # Making `provider` optional must not weaken validation when it IS sent.
    import app.core.envfile as envfile

    monkeypatch.setattr(envfile, "ENV_PATH", tmp_path / ".env")
    r = await app_client.put("/api/v1/system/data-source", json={"provider": "totally-made-up"})
    assert r.status_code == 400


async def test_feeds_test_endpoint(app_client):
    # With feeds set empty, the diagnostic returns an empty result list (no network).
    await app_client.put("/api/v1/news/feeds", json={"feeds": []})
    r = await app_client.get("/api/v1/news/feeds/test")
    assert r.status_code == 200
    assert r.json()["results"] == []


async def test_instrument_news_endpoint(app_client):
    r = await app_client.get("/api/v1/instruments/AAPL/news")
    assert r.status_code == 200
    assert "items" in r.json() and r.json()["symbol"] == "AAPL"

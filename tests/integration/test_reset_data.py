"""Clearing demo data, seed-once behaviour, and live-data refresh endpoint."""

from __future__ import annotations


async def test_reset_clears_holdings_and_blocks_reseed(app_client):
    # Demo data is present initially.
    before = (await app_client.get("/api/v1/portfolio/holdings")).json()["holdings"]
    assert len(before) > 0
    # Clear it.
    r = await app_client.post("/api/v1/system/reset-data")
    assert r.status_code == 200
    after = (await app_client.get("/api/v1/portfolio/holdings")).json()["holdings"]
    assert after == []
    # Transactions gone too.
    txns = (await app_client.get("/api/v1/portfolio/transactions")).json()["transactions"]
    assert txns == []


async def test_seed_runs_once(session):
    from app.seed.demo import seed_demo_data

    assert await seed_demo_data(session) is True       # first time seeds
    assert await seed_demo_data(session) is False       # flag set → no re-seed


async def test_refresh_data_endpoint(app_client):
    r = await app_client.post("/api/v1/system/refresh-data")
    assert r.status_code == 200
    body = r.json()
    assert "refreshed" in body and "total" in body


async def test_data_source_switch_applies_in_process(app_client, tmp_path, monkeypatch):
    import app.core.envfile as envfile

    monkeypatch.setattr(envfile, "ENV_PATH", tmp_path / ".env")
    r = await app_client.put("/api/v1/system/data-source", json={"provider": "csv"})
    assert r.status_code == 200
    assert r.json()["applied"] is True

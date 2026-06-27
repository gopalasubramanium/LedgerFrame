"""Changing the base/reporting currency persists to .env and is validated."""

from __future__ import annotations


async def test_base_currency_update_persists_to_env(app_client, tmp_path, monkeypatch):
    import app.core.envfile as envfile

    monkeypatch.setattr(envfile, "ENV_PATH", tmp_path / ".env")
    r = await app_client.put("/api/v1/settings", json={"values": {"base_currency": "INR"}})
    assert r.status_code == 200
    body = r.json()
    assert body["applied"]["base_currency"] == "INR"
    assert "restarted_worker" in body
    assert "LEDGERFRAME_BASE_CURRENCY=INR" in (tmp_path / ".env").read_text()


async def test_base_currency_rejects_unsupported(app_client, tmp_path, monkeypatch):
    import app.core.envfile as envfile

    monkeypatch.setattr(envfile, "ENV_PATH", tmp_path / ".env")
    r = await app_client.put("/api/v1/settings", json={"values": {"base_currency": "XYZ"}})
    assert r.status_code == 400

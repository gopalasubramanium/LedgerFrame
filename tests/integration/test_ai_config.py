"""AI provider configuration endpoints."""

from __future__ import annotations


async def test_get_ai_config(app_client):
    r = await app_client.get("/api/v1/system/ai-config")
    assert r.status_code == 200
    assert "hailo" in r.json()["providers"]


async def test_set_ai_config_rejects_unknown(app_client):
    r = await app_client.put("/api/v1/system/ai-config", json={"enabled": True, "provider": "nope"})
    assert r.status_code == 400


async def test_set_ai_config_writes_env(app_client, tmp_path, monkeypatch):
    import app.core.envfile as envfile

    monkeypatch.setattr(envfile, "ENV_PATH", tmp_path / ".env")
    r = await app_client.put("/api/v1/system/ai-config", json={
        "enabled": True, "provider": "hailo", "hailo_base_url": "http://10.0.0.5:8000",
    })
    assert r.status_code == 200
    assert "LEDGERFRAME_HAILO_BASE_URL=http://10.0.0.5:8000" in (tmp_path / ".env").read_text()

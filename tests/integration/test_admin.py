"""Scoped admin endpoint: allow-list enforcement and safe degradation."""

from __future__ import annotations


async def test_admin_availability_endpoint(app_client):
    r = await app_client.get("/api/v1/system/admin/available")
    assert r.status_code == 200
    assert "available" in r.json()


async def test_admin_rejects_unknown_action(app_client):
    r = await app_client.post("/api/v1/system/admin", json={"action": "rm-rf", "arg": None})
    assert r.status_code == 400


async def test_admin_rejects_bad_argument(app_client):
    r = await app_client.post("/api/v1/system/admin", json={"action": "lan", "arg": "evil"})
    assert r.status_code == 400


async def test_admin_action_unavailable_without_helper(app_client):
    # The helper binary isn't installed in the test environment → 503, never executes.
    r = await app_client.post("/api/v1/system/admin", json={"action": "restart"})
    assert r.status_code == 503

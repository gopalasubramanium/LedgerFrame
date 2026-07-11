# SPDX-License-Identifier: AGPL-3.0-or-later
"""First-run checklist §3b deltas (page-first-run-checklist F-3/F-5).

The checklist needs two things the settings write surface previously lacked:
  - a settable **timezone** (backend zoneinfo is the validation truth), and
  - a server-persisted **first_run_complete** flag.
Both go through the existing `PUT /settings` allow-list (no new endpoint / no OpenAPI
shape change) — verified here.
"""

from __future__ import annotations


async def test_timezone_is_settable_and_reflected(app_client):
    r = await app_client.put("/api/v1/settings", json={"values": {"timezone": "Asia/Tokyo"}})
    assert r.status_code == 200
    assert r.json()["applied"]["timezone"] == "Asia/Tokyo"

    got = (await app_client.get("/api/v1/settings")).json()
    # Reflected both as the stored row and as the engine-consumed default.
    assert got["stored"]["timezone"] == "Asia/Tokyo"
    assert got["defaults"]["timezone"] == "Asia/Tokyo"


async def test_invalid_timezone_is_an_honest_400_never_a_silent_default(app_client):
    r = await app_client.put(
        "/api/v1/settings", json={"values": {"timezone": "Not/AZone"}}
    )
    assert r.status_code == 400
    # The bad value was NOT persisted.
    got = (await app_client.get("/api/v1/settings")).json()
    assert got["stored"].get("timezone") != "Not/AZone"


async def test_base_currency_side_effects_are_reported(app_client):
    """F-10: PUT /settings base_currency is the canonical path — it applies to the env
    (so the engine re-reports), resets the FX cache, and restarts the worker. The
    observable side effects: the response reports `restarted_worker`, and the new value
    is reflected in the engine-consumed default."""
    r = await app_client.put("/api/v1/settings", json={"values": {"base_currency": "USD"}})
    assert r.status_code == 200
    body = r.json()
    assert body["applied"]["base_currency"] == "USD"
    assert "restarted_worker" in body  # the side-effect branch ran

    got = (await app_client.get("/api/v1/settings")).json()
    assert got["defaults"]["base_currency"] == "USD"  # env applied → engine re-reports


async def test_first_run_complete_flag_persists(app_client):
    got = (await app_client.get("/api/v1/settings")).json()
    assert "first_run_complete" not in got["stored"]  # fresh instance → unset

    r = await app_client.put(
        "/api/v1/settings", json={"values": {"first_run_complete": "1"}}
    )
    assert r.status_code == 200

    got = (await app_client.get("/api/v1/settings")).json()
    assert got["stored"]["first_run_complete"] == "1"


async def test_set_pin_rejects_short_pin(app_client):
    """F-8: the API enforces the 6-digit minimum (SECURITY-BASELINE §3) — a 4-digit PIN
    is rejected at the boundary, not only by the frontend."""
    r = await app_client.post("/api/v1/auth/set-pin", json={"pin": "1234"})
    assert r.status_code == 422  # pydantic min_length violation
    # A 6-digit PIN is accepted.
    ok = await app_client.post("/api/v1/auth/set-pin", json={"pin": "123456"})
    assert ok.status_code == 200

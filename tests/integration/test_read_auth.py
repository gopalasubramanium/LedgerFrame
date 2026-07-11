# SPDX-License-Identifier: AGPL-3.0-or-later
"""Phase 1.1 — data-bearing GET endpoints are gated when a PIN is set."""

from __future__ import annotations


async def test_reads_open_without_pin(app_client):
    # No PIN → current open behaviour preserved.
    assert (await app_client.get("/api/v1/portfolio/summary")).status_code == 200


async def test_reads_gated_when_pin_set(app_client):
    # Set a PIN (returns a session cookie), then lock + drop the cookie.
    assert (await app_client.post("/api/v1/auth/set-pin", json={"pin": "004321"})).status_code == 200
    await app_client.post("/api/v1/auth/lock")
    app_client.cookies.clear()

    # A data read is now refused …
    assert (await app_client.get("/api/v1/portfolio/summary")).status_code == 401
    assert (await app_client.get("/api/v1/dashboard/home")).status_code == 401

    # … but the lock screen's own endpoints stay open.
    assert (await app_client.get("/api/v1/auth/state")).status_code == 200
    assert (await app_client.get("/health")).status_code == 200

    # Unlock restores read access.
    assert (await app_client.post("/api/v1/auth/unlock", json={"pin": "004321"})).status_code == 200
    assert (await app_client.get("/api/v1/portfolio/summary")).status_code == 200

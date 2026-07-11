# SPDX-License-Identifier: AGPL-3.0-or-later
"""Phase 1.7 — server-side session revocation (lock revokes a token; PIN change revokes all)."""

from __future__ import annotations


async def test_locked_token_cannot_be_replayed(app_client):
    await app_client.post("/api/v1/auth/set-pin", json={"pin": "004321"})
    await app_client.post("/api/v1/auth/lock")
    app_client.cookies.clear()
    tok = (await app_client.post("/api/v1/auth/unlock", json={"pin": "004321"})).json()["token"]
    hdr = {"Authorization": f"Bearer {tok}"}

    # The freshly-issued token works …
    assert (await app_client.post("/api/v1/watchlists", json={"name": "a", "symbols": []}, headers=hdr)).status_code == 200
    # … lock revokes *that* token server-side …
    assert (await app_client.post("/api/v1/auth/lock", headers=hdr)).status_code == 200
    app_client.cookies.clear()
    # … and a replay of the same token is refused (mutation and read).
    assert (await app_client.post("/api/v1/watchlists", json={"name": "b", "symbols": []}, headers=hdr)).status_code == 401
    assert (await app_client.get("/api/v1/portfolio/summary", headers=hdr)).status_code == 401


async def test_pin_change_revokes_all_existing_tokens(app_client):
    old = (await app_client.post("/api/v1/auth/set-pin", json={"pin": "001111"})).json()["token"]
    hdr_old = {"Authorization": f"Bearer {old}"}
    assert (await app_client.get("/api/v1/portfolio/summary", headers=hdr_old)).status_code == 200

    # Change the PIN (authenticated via the cookie from set-pin) → revoke-all.
    changed = await app_client.post("/api/v1/auth/set-pin", json={"pin": "002222"})
    assert changed.status_code == 200
    app_client.cookies.clear()

    # The OLD token is now invalid; the NEW one works.
    assert (await app_client.get("/api/v1/portfolio/summary", headers=hdr_old)).status_code == 401
    new = changed.json()["token"]
    assert (await app_client.get("/api/v1/portfolio/summary", headers={"Authorization": f"Bearer {new}"})).status_code == 200

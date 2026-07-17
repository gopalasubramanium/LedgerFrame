# SPDX-License-Identifier: AGPL-3.0-or-later
"""page-settings §9 / Phase 0 — the `_ALLOWED_KEYS` reconciliation (D-078).

Allow-list keys are INVISIBLE to the OpenAPI shape check (`/settings` serves a free
dict, `API-CONTRACT.md:91`), so each change is pinned here, not by the contract regen.

Delta 1 (§9-1, Amendment A): `long_term_days` SHIPS — a served-value round-trip + the
numeric validator (mirrors the route's `ge=0, le=3660`). The removed-key sweep
(delta 3, §9-2(b)/§9-6/§9-7) is pinned in the same file once those keys are gone.
"""

from __future__ import annotations


# --- §9-1 (Amendment A): long_term_days ships with Settings ------------------


async def test_long_term_days_is_settable_and_reads_back(app_client):
    """Served-value round-trip: the threshold PUTs and reads back as a stored row.
    RED before delta 1 on the current unknown-key-400 (`long_term_days` unlisted)."""
    r = await app_client.put("/api/v1/settings", json={"values": {"long_term_days": "500"}})
    assert r.status_code == 200, r.text
    assert r.json()["applied"]["long_term_days"] == "500"

    got = (await app_client.get("/api/v1/settings")).json()
    assert got["stored"]["long_term_days"] == "500"


async def test_long_term_days_validator_mirrors_route_bounds(app_client):
    """The numeric validator mirrors the route's `ge=0, le=3660` — a non-numeric or
    out-of-range value is an honest 400, never a silently-stored bad threshold."""
    for bad in ("abc", "-1", "3661"):
        r = await app_client.put("/api/v1/settings", json={"values": {"long_term_days": bad}})
        assert r.status_code == 400, f"{bad!r} should be rejected, got {r.status_code}"
        got = (await app_client.get("/api/v1/settings")).json()
        assert got["stored"].get("long_term_days") != bad

    # The bounds themselves are inclusive (0 and 3660 are valid).
    for ok in ("0", "3660"):
        r = await app_client.put("/api/v1/settings", json={"values": {"long_term_days": ok}})
        assert r.status_code == 200, f"{ok!r} should be accepted: {r.text}"

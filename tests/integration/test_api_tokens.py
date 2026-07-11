# SPDX-License-Identifier: AGPL-3.0-or-later
"""Phase 2.4 — scoped read-only API tokens: a negative test for each security property."""

from __future__ import annotations

import hashlib

import pytest
from sqlalchemy import select

from app.db.base import get_sessionmaker
from app.models import ApiToken


async def _mint(app_client, name="ci") -> dict:
    r = await app_client.post("/api/v1/tokens", json={"name": name})
    assert r.status_code == 200, r.text
    return r.json()


# (5) header scheme + GET-only, and (1) read for GET
async def test_token_authenticates_get_via_token_scheme(app_client):
    raw = (await _mint(app_client))["token"]
    assert raw.startswith("lft_")
    r = await app_client.get("/api/v1/portfolio/summary", headers={"Authorization": f"Token {raw}"})
    assert r.status_code == 200
    # A Bearer with the same value is NOT accepted as an API token (wrong scheme → not a session).
    await app_client.post("/api/v1/auth/set-pin", json={"pin": "004321"})  # set a PIN so reads are gated
    await app_client.post("/api/v1/auth/lock")
    app_client.cookies.clear()
    bad = await app_client.get("/api/v1/portfolio/summary", headers={"Authorization": f"Bearer {raw}"})
    assert bad.status_code == 401


# (1) read-only — a token cannot POST/PUT/DELETE/PATCH
@pytest.mark.parametrize("method,path,body", [
    ("post", "/api/v1/watchlists", {"name": "x", "symbols": []}),
    ("put", "/api/v1/policy", {}),
    ("patch", "/api/v1/goals/999", {"name": "g", "target_amount": 1}),
    ("delete", "/api/v1/watchlists/999", None),
])
async def test_token_is_read_only(app_client, method, path, body):
    raw = (await _mint(app_client))["token"]
    hdr = {"Authorization": f"Token {raw}"}
    call = getattr(app_client, method)
    r = await (call(path, headers=hdr, json=body) if body is not None else call(path, headers=hdr))
    assert r.status_code == 403, f"{method.upper()} {path} → {r.status_code} (expected 403)"


# (2) creation is PIN-gated — no minting without a session, and a token can't mint
async def test_token_creation_is_pin_gated(app_client):
    await app_client.post("/api/v1/auth/set-pin", json={"pin": "004321"})
    await app_client.post("/api/v1/auth/lock")
    app_client.cookies.clear()
    assert (await app_client.post("/api/v1/tokens", json={"name": "x"})).status_code == 401
    await app_client.post("/api/v1/auth/unlock", json={"pin": "004321"})
    assert (await app_client.post("/api/v1/tokens", json={"name": "x"})).status_code == 200


async def test_read_token_cannot_mint_tokens(app_client):
    raw = (await _mint(app_client))["token"]
    r = await app_client.post("/api/v1/tokens", json={"name": "evil"},
                              headers={"Authorization": f"Token {raw}"})
    assert r.status_code == 403


# (3) hashed at rest — raw never stored, only its SHA-256; never returned by list
async def test_token_stored_hashed_only(app_client):
    created = await _mint(app_client)
    raw = created["token"]
    async with get_sessionmaker()() as s:
        rows = (await s.execute(select(ApiToken))).scalars().all()
    assert rows
    for t in rows:
        assert t.token_hash != raw                                    # not the raw token
        assert raw not in (t.name or "") and raw not in (t.prefix or "")
    assert any(t.token_hash == hashlib.sha256(raw.encode()).hexdigest() for t in rows)
    listed = (await app_client.get("/api/v1/tokens")).json()["tokens"]
    assert all("token" not in t and raw not in str(t) for t in listed)  # raw never re-exposed


# (4) revocation — a revoked token is rejected
async def test_revoked_token_is_rejected(app_client):
    created = await _mint(app_client)
    raw, tid = created["token"], created["id"]
    hdr = {"Authorization": f"Token {raw}"}
    assert (await app_client.get("/api/v1/portfolio/summary", headers=hdr)).status_code == 200
    assert (await app_client.delete(f"/api/v1/tokens/{tid}")).status_code == 200   # session revokes
    assert (await app_client.get("/api/v1/portfolio/summary", headers=hdr)).status_code == 401


# (2, extended) listing is session-only — a read-only token cannot enumerate tokens
async def test_read_token_cannot_list_tokens(app_client):
    raw = (await _mint(app_client))["token"]
    r = await app_client.get("/api/v1/tokens", headers={"Authorization": f"Token {raw}"})
    assert r.status_code == 403

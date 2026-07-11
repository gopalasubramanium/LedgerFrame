# SPDX-License-Identifier: AGPL-3.0-or-later
"""Phase 1.2 — PIN brute-force protection (429 backoff/lockout)."""

from __future__ import annotations


async def test_sixth_rapid_wrong_pin_is_rate_limited(app_client):
    await app_client.post("/api/v1/auth/set-pin", json={"pin": "004321"})
    await app_client.post("/api/v1/auth/lock")
    app_client.cookies.clear()

    # Failures 1–5 are answered with 401 (wrong PIN); the 5th arms backoff.
    for _ in range(5):
        r = await app_client.post("/api/v1/auth/unlock", json={"pin": "000000"})
        assert r.status_code == 401, r.text

    # The 6th rapid attempt is refused with 429 + Retry-After, without checking the PIN.
    blocked = await app_client.post("/api/v1/auth/unlock", json={"pin": "000000"})
    assert blocked.status_code == 429
    assert int(blocked.headers.get("retry-after", "0")) >= 1

    # Even the CORRECT PIN is refused while in backoff (the gate runs first).
    still = await app_client.post("/api/v1/auth/unlock", json={"pin": "004321"})
    assert still.status_code == 429


async def test_success_before_backoff_resets_counter(app_client):
    await app_client.post("/api/v1/auth/set-pin", json={"pin": "004321"})
    await app_client.post("/api/v1/auth/lock")
    app_client.cookies.clear()
    for _ in range(4):                        # 4 failures — below the backoff threshold
        await app_client.post("/api/v1/auth/unlock", json={"pin": "000000"})
    ok = await app_client.post("/api/v1/auth/unlock", json={"pin": "004321"})
    assert ok.status_code == 200             # correct PIN still works, counter resets


async def test_failed_unlock_is_audited_durably(app_client):
    """§1.2 audit-backed: a wrong PIN persists a security AuditEvent even though the
    request handler raises (and the request session rolls back)."""
    from sqlalchemy import select

    from app.db.base import get_sessionmaker
    from app.models import AuditEvent

    await app_client.post("/api/v1/auth/set-pin", json={"pin": "004321"})
    await app_client.post("/api/v1/auth/lock")
    app_client.cookies.clear()
    r = await app_client.post("/api/v1/auth/unlock", json={"pin": "000000"})
    assert r.status_code == 401

    async with get_sessionmaker()() as s:
        events = (await s.execute(
            select(AuditEvent).where(AuditEvent.action == "unlock_failed"))).scalars().all()
    assert events, "failed unlock should be recorded in audit_events"

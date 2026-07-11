# SPDX-License-Identifier: AGPL-3.0-or-later
"""Phase 1.3 — first-PIN takeover window: over LAN, the first PIN must be set locally."""

from __future__ import annotations

from httpx import ASGITransport, AsyncClient

from app.core.config import get_settings


async def test_first_pin_refused_from_non_loopback_when_lan_exposed(app_client):
    app = app_client._transport.app  # same app + freshly-reset DB (no PIN yet)
    get_settings().allow_lan = True
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app, client=("203.0.113.9", 5555)),
            base_url="http://test",
        ) as remote:
            r = await remote.post("/api/v1/auth/set-pin", json={"pin": "004321"})
            assert r.status_code == 403, r.text
        # A loopback client (the fixture) CAN still set the first PIN even with LAN on.
        ok = await app_client.post("/api/v1/auth/set-pin", json={"pin": "004321"})
        assert ok.status_code == 200
    finally:
        get_settings().allow_lan = False


async def test_first_pin_allowed_from_non_loopback_when_not_lan_exposed(app_client):
    # Default (loopback-only, LAN off): a non-loopback client is unusual but the takeover
    # rule only applies when actually exposed — so it must not fire here.
    app = app_client._transport.app
    async with AsyncClient(
        transport=ASGITransport(app=app, client=("203.0.113.9", 5555)),
        base_url="http://test",
    ) as remote:
        r = await remote.post("/api/v1/auth/set-pin", json={"pin": "004321"})
        assert r.status_code == 200, r.text

# SPDX-License-Identifier: AGPL-3.0-or-later
"""The 451 acceptance gate, asserted AT THE AI PATHS themselves.

The gate is correct here **by inheritance** (AI-surfaces §0-F): `app/main.py` mounts the
whole v1 router behind `require_read_auth`, `ai.router` is in that router, and no AI path
matches the exempt prefixes (`/api/v1/auth/`, `/api/v1/legal`, `/api/v1/system/status`).
Verified, not assumed.

**Inheritance is not a test.** Nothing asserted the property *at these paths*, so the AI
surfaces were protected by a fact about the router that no one had written down — and the
specific failure mode is a **prefix widening**: the exempt set is matched by prefix, so a
future `/api/v1/ai-public` or a well-meant exemption for "the status ping" would silently
open a surface that reads the user's whole portfolio into a model prompt. This file makes
that show up as a red test rather than as a shipped feature.

Companion to `tests/integration/test_legal_acceptance.py`, which owns the gate itself and
its states. This file owns only the AI surfaces' membership in it. It deliberately repeats
that file's hardest-won discipline — **assert the path EXISTS in the frozen contract
first** — because a guessed path 404s whether the gate works or not, and a list of 404s
looks exactly like a passing test. (Writing the original, four of five paths were 404s.)
"""

from __future__ import annotations

import pytest
from sqlalchemy import delete

from app.models import LegalAcceptanceEvent

# Every AI-adjacent surface, with the method the contract actually exposes. `/ai/chat` is a
# POST that streams; `/briefing/refresh` is a write. All must refuse before acceptance —
# a gate that held reads and leaked writes would be worse than no gate.
AI_SURFACES = [
    ("GET", "/api/v1/ai/facts"),
    ("GET", "/api/v1/ai/grounding-status"),
    ("GET", "/api/v1/ai/status"),
    ("POST", "/api/v1/ai/chat"),
    ("GET", "/api/v1/briefing"),
    ("POST", "/api/v1/briefing/refresh"),
    ("GET", "/api/v1/system/ai-config"),
]


async def _clear_acceptance() -> None:
    """Return the install to 'never answered' — the state a fresh install boots in."""
    from app.db.base import get_session

    async for s in get_session():
        await s.execute(delete(LegalAcceptanceEvent))
        await s.commit()
        break


def _contract_paths() -> dict:
    import json
    from pathlib import Path

    return json.loads(
        (Path(__file__).resolve().parents[2] / "docs" / "specs" / "API-CONTRACT.json")
        .read_text(encoding="utf-8")
    )["paths"]


@pytest.mark.anyio
@pytest.mark.parametrize("method,path", AI_SURFACES, ids=[f"{m} {p}" for m, p in AI_SURFACES])
async def test_an_unaccepted_install_REFUSES_every_ai_surface(app_client, method, path):
    paths = _contract_paths()
    assert path in paths, (
        f"{path} is not in the frozen contract. Fix the test, not the gate — a guessed path "
        "404s whether the gate works or not, which would make this test look strong and "
        "prove nothing."
    )
    assert method.lower() in paths[path], (
        f"{path} does not expose {method} in the contract ({sorted(paths[path])})."
    )

    await _clear_acceptance()
    r = await app_client.request(method, path, json={"question": "hi"} if method == "POST" else None)

    assert r.status_code == 451, (
        f"{method} {path} answered {r.status_code} on an UNACCEPTED install. Every AI surface "
        "is gated by inheritance from the v1 router; if this is red, either the exempt set "
        "widened (it is matched by PREFIX) or an AI route was mounted outside the router. "
        "An open AI surface reads the user's entire portfolio into a model prompt."
    )


@pytest.mark.anyio
async def test_the_gate_binds_api_tokens_too_at_the_ai_paths(app_client):
    """`deps.py`: *"a token is not a second party who can be exempt from them"*.

    The acceptance gate runs BEFORE the PIN check, so an API token is not a way around it.
    Asserted at an AI path specifically: a token-authenticated integration hitting /ai/chat
    is the most plausible way for someone to reach these surfaces without ever having seen
    the terms.
    """
    await _clear_acceptance()
    r = await app_client.post(
        "/api/v1/ai/chat",
        json={"question": "how is my portfolio?"},
        headers={"Authorization": "Bearer lf_not_a_real_token"},
    )
    assert r.status_code == 451, (
        f"/api/v1/ai/chat answered {r.status_code} for a token-bearing caller on an "
        "unaccepted install. The terms bind the install, not the session."
    )


@pytest.mark.anyio
async def test_accepting_UNLOCKS_the_ai_surfaces(app_client):
    """Pinned against going blind: 451-everywhere would satisfy every test above.

    If a refactor broke the AI routes entirely — wrong mount, import error, 404 — the
    refusal tests would all still pass. This asserts the gate is a GATE and not a wall.
    """
    await _clear_acceptance()
    assert (await app_client.get("/api/v1/ai/grounding-status")).status_code == 451

    r = await app_client.post("/api/v1/legal/acceptance", json={"action": "accepted"})
    assert r.status_code == 200, r.text

    r = await app_client.get("/api/v1/ai/grounding-status")
    assert r.status_code == 200, (
        f"after accepting, /api/v1/ai/grounding-status still answered {r.status_code}. The "
        "AI surfaces must OPEN on acceptance — otherwise the tests above are passing "
        "because the routes are broken, not because the gate works."
    )

# SPDX-License-Identifier: AGPL-3.0-or-later
"""R-54 Phase 2 — the tier-1 answer driven across the EGRESS × ACCEPTANCE matrix, not a happy path.

Every other AI guard runs in the suite's DEFAULT cell only: accepted install, AI disabled, no-egress
OFF (`conftest.py`). §8 requires the cross-product, because the two properties this milestone rests on
are only meaningful if they hold in ALL FOUR cells — and a single-axis guard cannot see the corners:

  • ZERO-CALLS-BY-CONSTRUCTION — a tier-1 answer is identical whether no-egress is ON or OFF, because
    it makes no network call that could differ. Asserted as: the same question yields the SAME served
    facts across egress states, AND under no-egress not even an HTTP client is CONSTRUCTED (the panel
    goes local, not dark — the R-22 amendment's two-state consequence).
  • THE ACCEPTANCE GATE IS ORTHOGONAL TO EGRESS — an unaccepted install refuses `/ai/chat` with 451
    regardless of the egress toggle. Navigation and posture confer no authority; the server refuses.

Every assertion carries a blindness pin (facts non-empty; re-accept UNLOCKS) so the matrix cannot
pass vacuously — 451-everywhere or a silently-empty pack would otherwise satisfy it.
"""

from __future__ import annotations

import json

import httpx
import pytest
from sqlalchemy import delete

from app.models import LegalAcceptanceEvent

# A tier-1-routable question that pulls a rich pack (perf + concentration + allocation). Used for
# the gate/zero-calls tests, where the pack's exact contents do not matter.
QUESTION = "How is my portfolio performing and what's the risk?"

# For the cross-egress IDENTITY check, a COVERAGE-STABLE question: net worth rides the live valuation
# (latest quotes), never the date-aware price+FX series. The date-aware metrics gate on coverage, and
# a settings write fires a one-time `§12-R3` candle purge that flips coverage — a data-state side
# effect orthogonal to egress that would confound a comparison of a coverage-gated pack. Net worth is
# invariant to it, so any difference across egress is a real egress-dependence, not churn.
STABLE_QUESTION = "What is my net worth?"


async def _facts(app_client, question: str) -> list[tuple[str, str]]:
    r = await app_client.post("/api/v1/ai/chat", json={"question": question})
    assert r.status_code == 200, f"/ai/chat returned {r.status_code}: {r.text[:200]}"
    facts: list[tuple[str, str]] = []
    for line in r.text.splitlines():
        if line.startswith("data:"):
            ev = json.loads(line[5:].strip())
            if ev.get("type") == "facts":
                facts = [(f["label"], f["value"]) for f in ev["facts"]]
    return facts


async def _set_no_egress(app_client, on: bool) -> None:
    r = await app_client.put("/api/v1/settings", json={"values": {"privacy_mode": "1" if on else "0"}})
    assert r.status_code == 200, f"could not set privacy_mode: {r.status_code} {r.text[:200]}"


async def _clear_acceptance() -> None:
    """Return the install to 'never answered' — the state a fresh install boots in."""
    from app.db.base import get_session

    async for s in get_session():
        await s.execute(delete(LegalAcceptanceEvent))
        await s.commit()
        break


async def test_tier1_answer_is_identical_across_egress_states(app_client):
    """The zero-calls-by-construction proof: a DETERMINISTIC answer cannot depend on egress.

    If the served facts differed with the egress toggle, something in the answer path would be
    consulting the network (or the toggle) — the opposite of "built from your data only". Uses the
    COVERAGE-STABLE question (see STABLE_QUESTION) so the comparison isolates egress from the
    settings-write candle-purge side effect.
    """
    await _set_no_egress(app_client, False)
    egress_allowed = await _facts(app_client, STABLE_QUESTION)
    await _set_no_egress(app_client, True)
    no_egress = await _facts(app_client, STABLE_QUESTION)

    assert egress_allowed, "no facts produced — the comparison would be vacuous"  # blindness pin
    assert egress_allowed == no_egress, (
        "the tier-1 answer differs across egress states — it is not zero-calls-by-construction:\n"
        f"  egress-allowed: {egress_allowed}\n  no-egress:      {no_egress}"
    )


async def test_tier1_under_no_egress_constructs_no_http_client(app_client, monkeypatch):
    """Live: under no-egress the panel goes LOCAL, not dark — and builds no client to do it.

    `app_client` is already constructed before this patch, so the tripwire catches only a NEW client
    the answer path would build — exactly the Guarantee-5 violation this asserts against.
    """
    await _set_no_egress(app_client, True)

    class Tripwire:
        def __init__(self, *a, **kw):
            raise AssertionError(
                "an HTTP client was CONSTRUCTED answering a tier-1 question under no-egress — "
                "Guarantee 5 says zero outbound calls"
            )

    monkeypatch.setattr(httpx, "AsyncClient", Tripwire)
    facts = await _facts(app_client, QUESTION)
    assert facts, "tier-1 produced no answer under no-egress — it went dark instead of local"


@pytest.mark.parametrize("no_egress_on", [False, True], ids=["egress-allowed", "no-egress"])
async def test_the_gate_refuses_tier1_regardless_of_egress(app_client, no_egress_on):
    """The acceptance gate is ORTHOGONAL to egress — 451 in BOTH egress states when unaccepted."""
    await _set_no_egress(app_client, no_egress_on)
    await _clear_acceptance()

    r = await app_client.post("/api/v1/ai/chat", json={"question": QUESTION})
    assert r.status_code == 451, (
        f"unaccepted /ai/chat under no_egress={no_egress_on} returned {r.status_code}, not 451 — "
        "the gate must refuse regardless of egress; navigation/posture confers no authority"
    )

    # Blindness pin: re-accepting UNLOCKS it, so 451-everywhere cannot pass this vacuously.
    ok = await app_client.post("/api/v1/legal/acceptance", json={"action": "accepted"})
    assert ok.status_code == 200
    unlocked = await app_client.post("/api/v1/ai/chat", json={"question": QUESTION})
    assert unlocked.status_code == 200, (
        "AI must OPEN on acceptance — otherwise the 451 assertion above is passing for the wrong reason"
    )

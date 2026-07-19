# SPDX-License-Identifier: AGPL-3.0-or-later
"""THE ACCEPTANCE GATE (page-legal §11-5, owner 2026-07-20).

The owner ruled: *the user must accept the licence terms + product position; unaccepted installs
are LOCKED at entry*, and the enforcement point must be chosen **honestly** — *"frontend-only lock
is theatre; gate server-side"*.

**THIS MODULE IS THE PROOF THAT IT IS NOT THEATRE.** Every test here talks to the API directly,
with no browser and no React in the picture, because that is exactly the attack the ruling names:
a lock that only the UI honours is not a weaker gate, it is the absence of one, and the way to
demonstrate the difference is to skip the UI.

WHAT IS GUARDED, one test per ruling clause:
  * unaccepted → the data surface REFUSES (and refuses for API tokens too);
  * accepting UNLOCKS;
  * a CHANGED CONTENT HASH RE-LOCKS — the version-stamping clause;
  * a DECLINE is RECORDED, and re-locks;
  * `/legal` is READABLE PRE-ACCEPTANCE — the one exemption that is a matter of principle.

WHY THESE TESTS CLEAR THE LOG THEMSELVES. `tests/conftest.py` accepts once per `app_client`, so
the other ~1700 tests exercise the product rather than the gate. Every test below therefore starts
by deleting that acceptance: a gate test that inherited an acceptance would be green no matter what
the gate did.
"""

from __future__ import annotations

import pytest
from sqlalchemy import delete

from app.models import LegalAcceptanceEvent

# A representative data endpoint. Chosen because it serves FIGURES — the thing the gate exists to
# hold back — rather than a status ping that would prove little if it leaked.
DATA_ENDPOINT = "/api/v1/portfolio/holdings"


async def _clear_acceptance(app_client) -> None:
    """Return the install to 'never answered', the state a fresh install boots in."""
    from app.db.base import get_session

    async for s in get_session():
        await s.execute(delete(LegalAcceptanceEvent))
        await s.commit()
        break


@pytest.mark.anyio
async def test_an_unaccepted_install_REFUSES_the_data_surface(app_client):
    """The ruling's core claim, tested where it matters: over HTTP, with no UI involved.

    451 rather than 401 or 403 deliberately — the request is well-formed and the caller may be
    perfectly authorised; what is missing is consent. Collapsing it into 401 would make the lock
    screen unable to tell 'unlock with your PIN' from 'read and accept the terms', which are
    different things to ask a person to do.
    """
    await _clear_acceptance(app_client)
    r = await app_client.get(DATA_ENDPOINT)
    assert r.status_code == 451, (
        f"an unaccepted install served {DATA_ENDPOINT} with {r.status_code}. The gate is "
        f"frontend-only, which the owner's ruling calls theatre."
    )


@pytest.mark.anyio
async def test_accepting_UNLOCKS_the_data_surface(app_client):
    await _clear_acceptance(app_client)
    assert (await app_client.get(DATA_ENDPOINT)).status_code == 451

    r = await app_client.post("/api/v1/legal/acceptance", json={"action": "accepted"})
    assert r.status_code == 200
    assert r.json()["status"] == "accepted"

    assert (await app_client.get(DATA_ENDPOINT)).status_code == 200


@pytest.mark.anyio
async def test_a_CHANGED_DOCUMENT_re_locks_and_reports_STALE_not_NONE(app_client, monkeypatch):
    """Version-stamping (§11-5 clause 2). The acceptance binds to the TEXT, not to the act.

    The distinction between `stale` and `none` is the substance of this test, not decoration: a
    user who accepted last month and is being asked again because the document changed must not be
    greeted as though they never answered. The gate has to be able to say *what* changed state.
    """
    await _clear_acceptance(app_client)
    await app_client.post("/api/v1/legal/acceptance", json={"action": "accepted"})
    assert (await app_client.get(DATA_ENDPOINT)).status_code == 200

    # Change the served document — one clause, the smallest real edit — and the hash moves.
    from app.services import legal

    original = legal._LICENCE_CLAUSES
    monkeypatch.setattr(
        legal, "_LICENCE_CLAUSES",
        ({"text": "The Platform is released under a **different** Licence."},) + original[1:],
    )
    monkeypatch.setattr(
        legal, "_SECTIONS",
        tuple({**s, "clauses": legal._LICENCE_CLAUSES} if s["id"] == "licence" else s
              for s in legal._SECTIONS),
    )

    assert (await app_client.get(DATA_ENDPOINT)).status_code == 451, (
        "the document changed and the install stayed unlocked — the acceptance is bound to the "
        "act rather than to the text, and the user is being held to terms never shown to them."
    )
    status = (await app_client.get("/api/v1/legal/acceptance")).json()
    assert status["status"] == "stale", (
        f"expected 'stale' (they answered before, about an earlier text), got {status['status']!r}"
    )


@pytest.mark.anyio
async def test_a_DECLINE_is_recorded_and_the_install_stays_locked(app_client):
    """A decline must be a real answer, not a no-op that leaves the dialog up.

    It is APPENDED, never an overwrite: the event log keeps the earlier acceptance too, because
    what happened is that a person accepted and then changed their mind, and a store that erased
    the first half could not say so.
    """
    await _clear_acceptance(app_client)
    await app_client.post("/api/v1/legal/acceptance", json={"action": "accepted"})

    r = await app_client.post("/api/v1/legal/acceptance", json={"action": "declined"})
    assert r.status_code == 200
    assert r.json()["status"] == "none"
    assert (await app_client.get(DATA_ENDPOINT)).status_code == 451

    # Both events survive — the decline did not erase the acceptance that preceded it.
    from sqlalchemy import select

    from app.db.base import get_session

    async for s in get_session():
        actions = [e.action for e in
                   (await s.execute(select(LegalAcceptanceEvent)
                                    .order_by(LegalAcceptanceEvent.id))).scalars().all()]
        break
    assert actions == ["accepted", "declined"], actions


@pytest.mark.anyio
async def test_LEGAL_IS_READABLE_before_acceptance(app_client):
    """The exemption that is a matter of principle rather than plumbing.

    A gate that demanded acceptance of a document it would not let you read would be asking for
    consent that could not possibly be informed. The gate copy has to be readable too, or the
    lock screen cannot render itself.
    """
    await _clear_acceptance(app_client)
    for path in ("/api/v1/legal", "/api/v1/legal/acceptance", "/api/v1/legal/gate-copy"):
        r = await app_client.get(path)
        assert r.status_code == 200, f"{path} refused pre-acceptance with {r.status_code}"

    body = (await app_client.get("/api/v1/legal")).json()
    assert len(body["commitments"]["items"]) == 7, "the Commitments must be readable before you accept"


@pytest.mark.anyio
async def test_the_exempt_set_does_not_leak_a_data_endpoint(app_client):
    """The exemption list's containment, as a test rather than as care.

    An exempt PREFIX is the risk: `/api/v1/legal` is a prefix match, so a future
    `/api/v1/legal-export` carrying real figures would be silently exempt. This asserts the
    representative data surfaces are all still gated, so a widening shows up here.
    """
    await _clear_acceptance(app_client)
    # Every path here is asserted to EXIST first. A non-existent route returns 404 whether the
    # gate works or not, so a list of guessed paths would make this test look strong and prove
    # nothing — which is exactly what happened writing it (four of five were 404s).
    import json
    from pathlib import Path

    contract = json.loads(
        (Path(__file__).resolve().parents[2] / "docs" / "specs" / "API-CONTRACT.json")
        .read_text(encoding="utf-8")
    )
    for path in ("/api/v1/portfolio/holdings", "/api/v1/accounts", "/api/v1/net-worth/history",
                 "/api/v1/insurance", "/api/v1/estate"):
        assert path in contract["paths"], f"{path} is not in the contract — fix the test, not the gate"
        r = await app_client.get(path)
        assert r.status_code == 451, f"{path} is reachable on an UNACCEPTED install ({r.status_code})"


@pytest.mark.anyio
async def test_an_invalid_action_is_refused_rather_than_recorded(app_client):
    """The event log's vocabulary is closed. A typo must not become a third state that the status
    reader then has to guess about."""
    await _clear_acceptance(app_client)
    r = await app_client.post("/api/v1/legal/acceptance", json={"action": "sure-whatever"})
    assert r.status_code == 400
    assert (await app_client.get(DATA_ENDPOINT)).status_code == 451


@pytest.mark.anyio
async def test_a_data_reset_ERASES_acceptance_and_the_gate_RE_FIRES(app_client):
    """**RESET ERASES ACCEPTANCE — the SPECIFIED behaviour** (page-legal §11-D3, architect under
    delegation, 2026-07-20). This test is the inversion of an earlier one that pinned the opposite.

    THE RULING'S REASONING, because a later reader will find this surprising: **the gate binds the
    PERSON using the install, not the machine.** A data reset returns the install to **first-run
    posture** — that is what the control is for, and the commonest reason to press it is to hand
    the install to somebody else. A preserved consent record would then be **the previous user's**,
    and the app would greet a new person as though they had read and accepted a document they have
    never seen. That is not a convenience; it is a **false record of consent**, which is the one
    thing this table exists not to be.

    The earlier behaviour was defensible and was defended: acceptance is install-level, in the same
    family as the PIN, and *"clear my holdings"* is not obviously a request to withdraw consent.
    What decided it against that reading is the **direction of the failure**. Keeping the record
    fails by attributing an agreement to someone who never gave it. Erasing it fails by asking a
    returning user to press Accept a second time. Only one of those is a lie.

    **THE COPY CARRIES IT.** The old test said, of this exact behaviour, *"if that is the intended
    behaviour it must be stated in the reset control's copy — silently re-locking the app is not
    it."* That condition is now binding rather than hypothetical, and it is enforced by
    `test_the_reset_confirmation_copy_STATES_the_erasure` in `test_reset_data.py`. **This test and
    that one must be read together**: erasure without the copy is precisely the silent re-lock the
    predecessor refused.

    ⚑ REVERSIBLE (page-legal §11-D3) — a delegated ruling, carried to the owner at the re-look.
    """
    await _clear_acceptance(app_client)
    await app_client.post("/api/v1/legal/acceptance", json={"action": "accepted"})
    assert (await app_client.get(DATA_ENDPOINT)).status_code == 200, "precondition: accepted"
    assert (await app_client.post("/api/v1/auth/set-pin", json={"pin": "013579"})).status_code == 200
    assert (await app_client.post("/api/v1/system/reset-data",
                                  json={"pin": "013579"})).status_code == 200

    # FIRST-RUN POSTURE, and specifically "none" rather than "stale": the document did not change,
    # the RECORD went away. A "stale" here would mean the erase left an event behind and the user
    # would be greeted as a returning acceptor — the previous user's identity, which is the whole
    # defect this ruling closes.
    assert (await app_client.get("/api/v1/legal/acceptance")).json()["status"] == "none", (
        "a data reset must return the install to first-run posture. A surviving acceptance would "
        "be the PREVIOUS user's, and the next person would never be asked."
    )
    assert (await app_client.get(DATA_ENDPOINT)).status_code == 451, (
        "the gate must RE-FIRE after a reset — an erased consent record that did not re-lock "
        "would be the worst of both: no record, and no gate."
    )

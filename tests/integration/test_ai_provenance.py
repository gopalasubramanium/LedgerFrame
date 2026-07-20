# SPDX-License-Identifier: AGPL-3.0-or-later
"""THE PROVENANCE LEGEND MATCHES THE GENERATION PATH — §14-4, owner ruling 2026-07-20.

The walk's centrepiece. The panel already showed the reader WHAT AN ANSWER IS BUILT FROM; it never
showed WHO WROTE THE SENTENCE. Those are different questions, and the second is the one a reader
needs in order to weigh the first — a figure they can check against the pack themselves and a
figure a model phrased for them warrant different scrutiny even when they are the same figure.

    Built-in intelligence only — no model was used.
    Facts: built-in · Narration: on-device model — nothing left this device.
    Facts: built-in · Narration: external model.

⚠ THE ONE THING THESE TESTS EXIST TO CATCH: **a legend that reports the CONFIGURATION rather than
what HAPPENED.** Reading the legend off `resolve_posture()` is the natural implementation and is a
LIE in exactly the states the fallback exists to handle — provider down, rate limited, empty reply,
validation rejected. In every one of those a model is configured, no model wrote a word of what is
on screen, and a configuration-derived legend would credit it anyway. **A built-in-only legend on a
narrated answer is RED; a narration legend on a fallback is RED.** Both directions are driven here
against a REAL stream, not a unit call.

The validation-rejected branch is the sharpest case and gets its own test: the model DID write
something, and the reader is not seeing a word of it. An answer the validator threw away is not
narration.
"""

from __future__ import annotations

import json

import pytest

from app.ai.vocabulary import (
    KIND_BUILT_IN,
    KIND_EXTERNAL_MODEL,
    KIND_ON_DEVICE_MODEL,
    PROVENANCE_BUILT_IN,
    PROVENANCE_COPY,
)
from tests.stub_narration import STUB_CLOSING_SENTENCE


async def _events(app_client, question: str = "What is my net worth?") -> list[dict]:
    r = await app_client.post("/api/v1/ai/chat", json={"question": question})
    assert r.status_code == 200
    out = []
    for line in r.text.splitlines():
        if line.startswith("data:"):
            payload = line[5:].strip()
            if payload:
                out.append(json.loads(payload))
    return out


def _provenance(events: list[dict]) -> dict:
    hits = [e for e in events if e.get("type") == "provenance"]
    assert len(hits) == 1, (
        f"expected exactly ONE provenance event, got {len(hits)}. Every answer carries a legend "
        f"(§14-4) and carries it once — two legends on one answer is the disclaimer's Finding 4 "
        f"repeated on a new field."
    )
    return hits[0]


def _body(events: list[dict]) -> str:
    return "".join(e["delta"] for e in events if e.get("type") == "delta")


class _EchoProvider:
    """A stub that answers STRICTLY FROM THE FACT PACK — the §12-4 technique.

    Echoing the pack is the only narrow path through the validator: clause 2 (every significant
    figure traces to a fact), clause 3 (no ticker outside the facts/question), clause 4 (no
    recommendation language). Satisfying all three by construction is what makes the PASSING
    narrated state reachable in a test at all — every other stub falls back, and a suite that can
    only reach the fallback cannot guard the narrated legend.

    ⚠ IT READS THE SYSTEM MESSAGE, BY ROLE. The first version matched any message containing
    "FACTS" and picked up the USER turn instead — whose intent-focus line reads *"Use only the
    FACTS"* — so it narrated an empty string, fell back, and the guard around it passed through its
    optional arm without ever testing anything.
    """

    name = "openai_compatible"
    kind = "on_device_model"

    async def health(self):
        from app.schemas.ai import HealthStatus

        return HealthStatus(available=True, provider=self.name, models=["stub-narrator"])

    async def chat(self, req):
        from app.schemas.ai import AIChunk

        block = next((m.content for m in req.messages
                      if m.role == "system" and (m.content or "").startswith("FACTS")), "")
        first = next((ln for ln in block.splitlines() if ln.startswith("- ")), "")
        # Drop the trailing meta parenthetical. `render_facts` appends
        # "(source=…, as_of=2026-07-20T05:59:16.778669+00:00)", and echoing THAT fails clause 2 on
        # the timestamp's own digits — "unsupported figure '16.778669' not in the facts". A
        # perfectly grounded sentence rejected because it quoted the provenance metadata rather
        # than the figure. Recorded because it is the same shape as R-56: a validator comparing
        # digit runs cannot tell a fact from a timestamp.
        fact = first.lstrip("- ").split("  (")[0].strip()
        # §17-2 — the closing sentence comes from the ONE registered home, not from a literal here.
        # A stub sentence written inline is a sentence outside the phantom-referent guard, and the
        # sentence the owner rejected at the 3b walk was written exactly that way.
        yield AIChunk(delta=f"{fact} {STUB_CLOSING_SENTENCE}")
        yield AIChunk(done=True)


# --- Every answer carries a legend, and it leads its deltas ------------------------------------- #


async def test_every_answer_carries_exactly_one_provenance_legend(app_client):
    prov = _provenance(await _events(app_client))
    assert prov["provenance"] in PROVENANCE_COPY.values(), (
        f"unregistered legend served: {prov['provenance']!r}. §14-4's strings are SERVED from "
        f"PROVENANCE_COPY so a new generation path cannot invent its own claim about authorship."
    )


async def test_the_legend_arrives_before_the_answer_text(app_client):
    """It decides how the body is RENDERED, so it cannot arrive after it.

    A legend delivered on `done` would leave a narrated answer streaming in plain and restyling
    itself at the last token — the reader watching the product change its mind about what it is
    showing them. It also keeps contract clause 7 intact: facts still precede the answer, and the
    legend is not the answer.
    """
    events = await _events(app_client)
    kinds = [e["type"] for e in events]
    assert "provenance" in kinds, "no provenance event on the stream"
    assert kinds.index("facts") < kinds.index("provenance"), "facts lead (clause 7)"
    if "delta" in kinds:
        assert kinds.index("provenance") < kinds.index("delta"), (
            "the legend must precede the answer text it describes"
        )


# --- The legend reports WHAT HAPPENED, never what is configured --------------------------------- #


async def test_a_fallback_answer_reports_built_in_even_with_a_model_configured(app_client,
                                                                               monkeypatch):
    """THE CORE GUARD, direction 1: configured model + no narration ⇒ built-in legend.

    The default test posture has no reachable provider, so this is the shipped fallback path. The
    configuration is forced to name a model so the test cannot pass merely because nothing was
    configured — which would make it blind to the very substitution it exists to catch.
    """
    from app.core.config import reload_settings

    monkeypatch.setenv("LEDGERFRAME_AI_ENABLED", "true")
    monkeypatch.setenv("LEDGERFRAME_AI_PROVIDER", "openai_compatible")
    monkeypatch.setenv("LEDGERFRAME_OPENAI_BASE_URL", "http://127.0.0.1:1/v1")  # refuses instantly
    reload_settings()
    try:
        events = await _events(app_client)
        prov = _provenance(events)
        assert prov["narrated"] is False
        assert prov["kind"] == KIND_BUILT_IN
        assert prov["provenance"] == PROVENANCE_BUILT_IN, (
            f"a fallback answer was credited to a model: {prov['provenance']!r}. An on-device "
            f"model was CONFIGURED and wrote nothing that reached the reader; the legend must "
            f"describe the answer that was produced, not the one that was set up (§14-4)."
        )
    finally:
        reload_settings()


async def test_a_narrated_answer_is_never_labelled_built_in_only(app_client, monkeypatch):
    """THE CORE GUARD, direction 2: narration survived ⇒ the legend names the model.

    Driven through a stub provider that answers STRICTLY FROM THE FACT PACK — the only narrow path
    through the validator (clause 2: every significant figure traces to a fact; clause 3: no ticker
    outside the facts; clause 4: no recommendation language). Echoing the pack satisfies all three
    by construction. This is the §12-4 stub's technique, and it is what makes the PASSING narrated
    state reachable in a test at all.
    """
    from app.providers.ai import reset_ai_provider

    reset_ai_provider()
    monkeypatch.setattr("app.ai.grounding.get_ai_provider", lambda: _EchoProvider())
    try:
        events = await _events(app_client)
        prov = _provenance(events)
        # ⚠ ASSERTED, NOT BRANCHED ON. An earlier draft wrapped the real assertions in
        # `if prov["narrated"]:` with a built-in arm for "the stub didn't validate this time" —
        # and it PASSED, silently, through the else arm, because the stub was reading the wrong
        # message and never narrated at all. A guard whose happy path is optional is not a guard.
        assert prov["narrated"] is True, (
            "the stub did not reach the narrated branch — this guard would be blind. Check the "
            "FACTS block extraction before believing the legend."
        )
        assert prov["kind"] == KIND_ON_DEVICE_MODEL, prov
        assert prov["provenance"] != PROVENANCE_BUILT_IN, (
            "a MODEL-NARRATED answer is labelled 'no model was used'. The reader is being told "
            "the engine wrote sentences a model wrote (§14-4)."
        )
        assert prov["provenance"] == PROVENANCE_COPY[KIND_ON_DEVICE_MODEL]
    finally:
        reset_ai_provider()


async def test_an_undeclared_provider_errs_toward_EXTERNAL(app_client, monkeypatch):
    """The safe direction, asserted rather than assumed.

    The two possible errors are not equally bad. Calling a remote model "on-device" tells a user
    their figures stayed put when they left — a privacy claim the product cannot honour. Calling a
    local model "external" is a warning that is merely too strong. So a provider that does not
    declare its kind is treated as EXTERNAL, and that default is pinned here so a later
    "convenience" default cannot quietly invert it.
    """
    from app.providers.ai import reset_ai_provider

    class _Undeclared(_EchoProvider):
        kind = None  # declares nothing

    reset_ai_provider()
    monkeypatch.setattr("app.ai.grounding.get_ai_provider", lambda: _Undeclared())
    try:
        prov = _provenance(await _events(app_client))
        assert prov["narrated"] is True
        assert prov["kind"] == KIND_EXTERNAL_MODEL, (
            f"an undeclared provider was credited as {prov['kind']!r}. When the kind is unknown "
            f"the honest default is the one that cannot mislead about egress."
        )
    finally:
        reset_ai_provider()


async def test_the_validation_rejected_branch_reports_built_in(app_client, monkeypatch):
    """The sharpest case: the model DID write something and the reader sees none of it.

    An answer the validator threw away is not narration. Crediting the model here would describe a
    contribution the product deliberately discarded — and it is the branch where a
    configuration-derived legend looks most plausible and is most wrong.
    """
    from app.providers.ai import reset_ai_provider
    from app.schemas.ai import AIChunk, HealthStatus

    class _UngroundedProvider:
        name = "openai_compatible"

        async def health(self):
            return HealthStatus(available=True, provider=self.name, models=["stub"])

        async def chat(self, req):
            # A fabricated figure — clause 2 rejects it, so not one word of this reaches the reader.
            yield AIChunk(delta="Your net worth is 1,234,567.89 SGD and you should buy more.")
            yield AIChunk(done=True)

    reset_ai_provider()
    monkeypatch.setattr("app.ai.grounding.get_ai_provider", lambda: _UngroundedProvider())
    try:
        events = await _events(app_client)
        prov = _provenance(events)
        done = next(e for e in events if e["type"] == "done")
        assert done.get("fallback_signal"), "this is meant to be the validator-rejected branch"
        assert prov["narrated"] is False
        assert prov["provenance"] == PROVENANCE_BUILT_IN, (
            f"the validator discarded the model's answer, and the legend credits the model anyway: "
            f"{prov['provenance']!r}."
        )
        assert "1,234,567.89" not in _body(events), "discarded model text must never be shown"
    finally:
        reset_ai_provider()


async def test_no_egress_answers_report_built_in(app_client, monkeypatch):
    """Under no-egress there is no model by construction, in any posture."""
    import app.core.egress as egress

    async def _blocked() -> bool:
        return False

    monkeypatch.setattr(egress, "egress_allowed", _blocked)
    monkeypatch.setattr("app.ai.vocabulary.egress_allowed", _blocked, raising=False)
    events = await _events(app_client)
    prov = _provenance(events)
    assert prov["provenance"] == PROVENANCE_BUILT_IN
    assert prov["narrated"] is False


# --- Anti-blind pins ---------------------------------------------------------------------------- #


@pytest.mark.parametrize("kind", [KIND_BUILT_IN, KIND_ON_DEVICE_MODEL, KIND_EXTERNAL_MODEL])
def test_every_kind_has_a_registered_legend(kind: str):
    """A generation path with no legend would silently borrow another path's claim."""
    assert PROVENANCE_COPY.get(kind), f"{kind} has no registered provenance line"


def test_the_three_legends_are_distinct_and_substantive():
    """Three identical legends would pass every match test above while telling the reader the same
    thing in three different states — the failure the legend exists to prevent."""
    assert len(set(PROVENANCE_COPY.values())) == 3
    for kind, line in PROVENANCE_COPY.items():
        assert len(line) > 25, f"{kind}: {line!r} is too short to be a provenance statement"


def test_narrated_false_collapses_every_kind_to_built_in():
    """The rule itself, stated once as a unit assertion so the intent is readable without a stream."""
    from app.ai.vocabulary import provenance_for

    for kind in (KIND_BUILT_IN, KIND_ON_DEVICE_MODEL, KIND_EXTERNAL_MODEL):
        assert provenance_for(kind, narrated=False) == (KIND_BUILT_IN, PROVENANCE_BUILT_IN)
    assert provenance_for(KIND_ON_DEVICE_MODEL, narrated=True)[1] != PROVENANCE_BUILT_IN

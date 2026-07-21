# SPDX-License-Identifier: AGPL-3.0-or-later
"""AI chat endpoint — grounded, streaming via Server-Sent Events."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.grounding import answer_stream
from app.api.deps import get_db
from app.core.disclaimer import DISCLAIMER

router = APIRouter()


class ChatIn(BaseModel):
    question: str = Field(min_length=1, max_length=500)


@router.get("/ai/facts")
async def ai_facts(q: str = Query(min_length=1, max_length=500),
                   session: AsyncSession = Depends(get_db)) -> dict:
    """The grounded fact pack + classified intent for a question — the 'answer basis'.
    No model call; read-only; the same facts the assistant is allowed to use."""
    from app.ai.intent import classify_intent
    from app.ai.tools import gather_facts

    facts = await gather_facts(session, q)
    return {
        "intent": classify_intent(q).value,
        "facts": [f.model_dump(mode="json") for f in facts],
        "count": len(facts),
        "disclaimer": DISCLAIMER,
    }


# ── RATIFIED POSTURE COPY (§9 (f): "strings stay PROPOSED until 0a"; ratified 2026-07-20) ──
#
# The one sentence on the Ask panel that states what the DEVICE is doing. It is served, never
# composed client-side, for the reason §0-C exists: a posture sentence assembled in the browser is
# a second source of truth for a claim the product makes about itself.
#
# Named constants rather than inline literals so the ratified wording can be PINNED
# (`tests/unit/test_posture_copy_ratified.py`, the AC-L3 spec<->code parity pattern). Inline
# literals in a route body cannot be bound to a record without grepping a function, and a string
# nobody can bind is a string that drifts.
#
# ⚠ NO_EGRESS carries a divergence found at the 0a walk — see ai-surfaces.md §12-3. The drafted
# copy said no-egress meant no AI at all; what SHIPPED says answers are still built, from the
# user's data, without narration. The shipped sentence is the true one, and R-54 (tier-1
# deterministic answering) owns the amendment when that capability formally lands.
# ⊕ R-54 POSTURE-COPY AMENDMENT (Phase 1 delta 1; owner item-6 direction 2026-07-21). Recut per
# §9-G: "Hailo" leaves served copy; ONE user-facing local descriptor ("Ollama-compatible"); one
# locality phrasing; POSTURE_DISABLED's "fact-only" re-cut now tier-1 explains terms, not only
# figures. The strings are PROPOSED — formal ratification is by LOOKING at 0a-ii, rendered live —
# but the AC-L3 parity guard binds code↔record throughout, so the recut wording is recorded in
# `ai-surfaces.md` §12-3 with a dated note ("both versions true in their time").
#
# ⚠ NO_EGRESS keeps "answers are built" and "no AI narration" (both pinned by
# `test_the_no_egress_string_is_the_one_the_owner_RULED`, §12-3): it only GAINS the tier-1 clause —
# answers are now built from your data AND the app's own explanations, not "from your data only".
POSTURE_NO_EGRESS = ("No-egress is on — this device makes no outbound calls, so answers are built "
                     "on this device from your data and the app's own explanations, with no AI "
                     "narration.")
# item-6b: names its CAUSE in GLOSSARY vocabulary ("built-in intelligence"), no "deterministic" jargon.
POSTURE_DISABLED = ("Model AI is off — answers use built-in intelligence: your data and the app's "
                    "own explanations, on this device.")
# item-6a: the local pair is ONE user-facing kind, deliberately IDENTICAL — locality is the promise.
POSTURE_LOCAL_OPENAI = "On-device (local, Ollama-compatible) — data stays on this device."
POSTURE_LOCAL_NPU = "On-device (local, Ollama-compatible) — data stays on this device."
# item-6c: adopts the ratified three-kinds name "External model".
POSTURE_REMOTE = "External model — prompts (incl. your portfolio facts) are sent to the configured provider."

#: Every posture string the product can serve. The guard iterates THIS, so a new posture branch
#: that forgets to add its string here is caught by a coverage assertion rather than shipping
#: unratified copy on the one surface built to be honest about posture.
POSTURE_COPY = {
    "no_egress": POSTURE_NO_EGRESS,
    "disabled": POSTURE_DISABLED,
    "local_openai": POSTURE_LOCAL_OPENAI,
    "remote": POSTURE_REMOTE,
    "local_npu": POSTURE_LOCAL_NPU,
}


#: Posture key → the coarse `mode` the client reports. Kept beside POSTURE_COPY so a new branch
#: declares its copy and its mode in one place.
POSTURE_MODE = {
    "no_egress": "deterministic",
    "disabled": "deterministic",
    "local_openai": "local",
    "local_npu": "local",
    "remote": "remote",
}


@router.get("/ai/grounding-status")
async def ai_grounding_status() -> dict:
    """Whether AI answers are grounded, how they're narrated, and where data goes.
    No secrets — only the base URL's host is considered, never the key (§8).

    ⊕ 2026-07-20 (§14-3, Finding 6). The posture branch that used to live inline here is now
    `app.ai.vocabulary.resolve_posture()`, shared with `/system/ai-config`. It was duplicated
    logic reading two different sources — this route read `get_settings()`, the Settings tab read
    the `.env` FILE — and they disagreed the moment OS env was set. **Two surfaces working the
    same fact out separately IS the defect**; one resolver is the fix, not a tidy-up.

    NO-EGRESS FIRST, and it OVERRIDES the configured provider (R-22 AMENDMENT, owner 2026-07-20,
    option (b)) — that ordering now lives in the resolver, with its reasoning.

    The posture is still SERVED rather than inferred from `health.available`. An unavailable
    provider and a switched-off one look identical from the client, and they are the opposite of
    each other: one is broken, one is the product doing exactly what it promised. That is the
    distinction Commitment 3 turns on, and the same one the typed EgressBlocked re-raise preserves
    inside the providers.
    """
    from app.ai.vocabulary import KIND_IS_REMOTE, KIND_LABEL, resolve_posture
    from app.core.config import get_settings
    from app.providers.ai import get_ai_provider

    s = get_settings()
    provider = get_ai_provider()
    health = await provider.health()

    posture, kind = await resolve_posture()

    return {
        "grounded": True,
        "narration": provider.name if health.available else "deterministic-fallback",
        "model": (health.models[0] if health.models else None),
        "ai_enabled": s.ai_enabled,
        "mode": POSTURE_MODE[posture],
        "remote": KIND_IS_REMOTE[kind],
        "no_egress": posture == "no_egress",
        "privacy_label": POSTURE_COPY[posture],
        # ── The ruled vocabulary (§14-2). The panel's provenance legend and the Settings tab read
        #    the SAME kind, resolved in the SAME place.
        "kind": kind,
        "kind_label": KIND_LABEL[kind],
        "last_error": health.detail or None,
    }


@router.post("/ai/chat")
async def ai_chat(payload: ChatIn, session: AsyncSession = Depends(get_db)) -> StreamingResponse:
    async def event_gen():
        async for event in answer_stream(session, payload.question):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

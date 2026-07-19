# SPDX-License-Identifier: AGPL-3.0-or-later
"""Grounded AI orchestration: gather facts → prompt the model → stream answer.

If the model is unavailable, returns a deterministic template answer built only
from the gathered facts, so "Ask" always works (just without narration). A small
in-process rate limiter protects the NPU from request storms.
"""

from __future__ import annotations

import re
import time
from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.intent import classify_intent
from app.ai.prompt_builder import build_messages
from app.ai.prompts import REFUSAL_NO_FACTS, strip_reasoning
from app.ai.safety import validate_grounded_answer
from app.ai.tools import gather_facts
from app.core.config import get_settings
from app.core.disclaimer import DISCLAIMER
from app.providers.ai import get_ai_provider
from app.schemas.ai import AIRequest, GroundingFact

# D-070's ruled, user-visible fallback signal — normative in `SECURITY-BASELINE.md` §5 and
# `DECISIONS.md` D-070, and until now it existed NOWHERE in the codebase (AI-surfaces §0-G:
# grep across app/, frontend/src/ and tests/ returned zero hits). The validator correctly
# discarded unsafe model text and emitted the deterministic template — silently. The reason
# travelled only as `done` event metadata, which no frontend read because no frontend existed.
#
# It is SERVED, not composed client-side: a legal-adjacent string assembled in the browser
# would be a second source of truth for the sentence, which is the §0-C mistake repeated in
# the milestone that fixes it.
#
# Kept string-equal to the spec by `tests/unit/test_d070_fallback_signal.py` (the AC-L3
# spec<->code parity pattern). Edit the spec and the guard carries the change here; edit this
# alone and the guard goes red.
FALLBACK_SIGNAL = "AI answer didn't pass grounding checks — showing facts directly."

_request_times: list[float] = []


def _rate_limited() -> bool:
    now = time.monotonic()
    cutoff = now - 60
    _request_times[:] = [t for t in _request_times if t > cutoff]
    if len(_request_times) >= get_settings().ai_max_requests_per_minute:
        return True
    _request_times.append(now)
    return False


def _sentence_chunks(text: str) -> list[str]:
    """Split a validated answer into sentence-sized deltas for streaming."""
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [p + " " for p in parts if p.strip()] or [text]


def _template_answer(question: str, facts: list[GroundingFact]) -> str:
    if not facts:
        return REFUSAL_NO_FACTS
    lines = ["Here is what the data shows:"]
    for f in facts[:8]:
        suffix = " (may be out of date)" if f.is_stale else ""
        lines.append(f"• {f.label}: {f.value}{suffix}")
    lines.append("")
    lines.append(DISCLAIMER)
    return "\n".join(lines)


async def answer_stream(
    session: AsyncSession, question: str
) -> AsyncIterator[dict]:
    """Yields dicts: {'type': 'facts'|'delta'|'done', ...}. Designed for SSE."""
    facts = await gather_facts(session, question)
    # Surface the grounding facts to the client first — this is what the UI shows
    # alongside the answer (source + timestamp + stale badges).
    yield {"type": "facts", "facts": [f.model_dump(mode="json") for f in facts]}

    provider = get_ai_provider()
    health = await provider.health()

    if not health.available or _rate_limited():
        # Deterministic fallback — no fabrication, just the verified facts.
        text = _template_answer(question, facts)
        yield {"type": "delta", "delta": text}
        yield {"type": "done", "grounded": True, "provider": "fallback",
               "disclaimer": DISCLAIMER}
        return

    if not facts:
        yield {"type": "delta", "delta": REFUSAL_NO_FACTS}
        yield {"type": "done", "grounded": True, "provider": provider.name,
               "disclaimer": DISCLAIMER}
        return

    intent = classify_intent(question)
    messages = build_messages(question, intent, facts)
    req = AIRequest(messages=messages)

    # §3 SAFE STREAMING: buffer the model output server-side and validate it BEFORE any
    # of it reaches the client. Unsafe model text (a buy/sell recommendation, a
    # secret-like string, a fabricated number/ticker/headline) is therefore never shown —
    # on failure we emit only the deterministic fact-only answer.
    full = ""
    error: str | None = None
    try:
        async for chunk in provider.chat(req):
            if chunk.delta:
                full += chunk.delta        # buffer only — do NOT yield raw model text
            if chunk.done:
                break
    except Exception as exc:  # noqa: BLE001 — never crash the stream; surface the reason
        error = str(exc)[:300]

    answer = strip_reasoning(full)
    if not answer:
        # Model returned nothing usable (or only reasoning) → deterministic fallback.
        if error:
            yield {"type": "delta",
                   "delta": f"_The AI model didn't return an answer ({error}). "
                            "Showing the underlying data instead._\n\n"}
        yield {"type": "delta", "delta": _template_answer(question, facts)}
        yield {"type": "done", "grounded": True, "provider": "fallback",
               "error": error, "disclaimer": DISCLAIMER}
        return

    ok, reason = validate_grounded_answer(answer, facts, question)
    if not ok:
        # Unsafe/ungrounded — the model text is discarded, never shown. D-070: the user is TOLD
        # this happened. Silently swapping a model answer for a template is the product being
        # quietly less than it appeared, which is the opposite of the honesty the fallback exists
        # to protect. The signal leads, so it frames what follows rather than trailing it.
        yield {"type": "delta", "delta": f"_{FALLBACK_SIGNAL}_\n\n"}
        yield {"type": "delta", "delta": _template_answer(question, facts)}
        yield {"type": "done", "grounded": True, "provider": "fallback", "validation": reason,
               "fallback_signal": FALLBACK_SIGNAL, "disclaimer": DISCLAIMER}
        return

    # Validated → now safe to emit, chunked by sentence for a mild streaming feel.
    for piece in _sentence_chunks(answer):
        yield {"type": "delta", "delta": piece}
    yield {"type": "done", "grounded": True, "provider": provider.name,
           "intent": intent.value,
           "model": health.models[0] if health.models else None,
           "disclaimer": DISCLAIMER}

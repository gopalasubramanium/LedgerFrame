"""Grounded AI orchestration: gather facts → prompt the model → stream answer.

If the model is unavailable, returns a deterministic template answer built only
from the gathered facts, so "Ask" always works (just without narration). A small
in-process rate limiter protects the NPU from request storms.
"""

from __future__ import annotations

import time
from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.prompts import REFUSAL_NO_FACTS, SYSTEM_PROMPT, render_facts
from app.ai.tools import gather_facts
from app.core.config import get_settings
from app.providers.ai import get_ai_provider
from app.schemas.ai import AIRequest, ChatMessage, GroundingFact

_request_times: list[float] = []


def _rate_limited() -> bool:
    now = time.monotonic()
    cutoff = now - 60
    _request_times[:] = [t for t in _request_times if t > cutoff]
    if len(_request_times) >= get_settings().ai_max_requests_per_minute:
        return True
    _request_times.append(now)
    return False


def _template_answer(question: str, facts: list[GroundingFact]) -> str:
    if not facts:
        return REFUSAL_NO_FACTS
    lines = ["Here is what the data shows:"]
    for f in facts[:8]:
        suffix = " (may be out of date)" if f.is_stale else ""
        lines.append(f"• {f.label}: {f.value}{suffix}")
    lines.append("")
    lines.append("Information only, not financial advice.")
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
               "disclaimer": "Information only, not financial advice."}
        return

    if not facts:
        yield {"type": "delta", "delta": REFUSAL_NO_FACTS}
        yield {"type": "done", "grounded": True, "provider": provider.name,
               "disclaimer": "Information only, not financial advice."}
        return

    messages = [
        ChatMessage(role="system", content=SYSTEM_PROMPT),
        ChatMessage(role="system", content=render_facts(facts)),
        ChatMessage(role="user", content=question),
    ]
    req = AIRequest(messages=messages)
    produced = False
    async for chunk in provider.chat(req):
        if chunk.delta:
            produced = True
            yield {"type": "delta", "delta": chunk.delta}
        if chunk.done:
            break
    if not produced:
        # Model returned nothing usable → fall back rather than show an empty box.
        yield {"type": "delta", "delta": _template_answer(question, facts)}
    yield {"type": "done", "grounded": True, "provider": provider.name,
           "model": health.models[0] if health.models else None,
           "disclaimer": "Information only, not financial advice."}

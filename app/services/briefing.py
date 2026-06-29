"""Daily briefing generation — grounded summary of portfolio + market state.

Builds a short, factual briefing from deterministic data. If the AI provider is
available it may narrate the facts; otherwise a clean template is used. Stored as
plain text in settings so the Home page can show it instantly even offline.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import Setting
from app.services.portfolio import top_movers, value_portfolio

BRIEFING_KEY = "daily_briefing"
BRIEFING_TS_KEY = "daily_briefing_ts"


def _mover_str(h, base: str) -> str:
    from app.core.money import pct_change

    pct = None
    if h.price is not None and h.quantity:
        prev = h.price - (h.day_change_base / h.quantity)
        pct = pct_change(h.price, prev) if prev else None
    pctf = f" {pct:+.1f}%" if pct is not None else ""
    return f"{h.label} ({h.day_change_base:+,.0f} {base}{pctf})"


async def _deterministic_briefing(session: AsyncSession) -> tuple[str, list[str]]:
    """A factual briefing + the underlying fact lines (also fed to the AI)."""
    base = get_settings().base_currency
    val = await value_portfolio(session, base)
    gainers, losers = top_movers(val, n=3)
    facts = [
        f"Portfolio value: {val.total_value:,.2f} {base}",
        f"Today's change: {val.day_change:+,.2f} {base}",
    ]
    if val.total_return_pct is not None:
        facts.append(f"Total return: {val.total_return_pct:+.2f}%")
    if gainers:
        facts.append("Top movers up: " + "; ".join(_mover_str(g, base) for g in gainers))
    if losers:
        facts.append("Top movers down: " + "; ".join(_mover_str(x, base) for x in losers))

    # A line on how the broader markets moved (best-effort; never blocks).
    market_line = ""
    try:
        from app.ai.tools import market_facts

        mkt = await market_facts(session, limit=3)
        if mkt:
            market_line = "Markets: " + ", ".join(f"{m.label.split('·')[-1].strip()} {m.value}" for m in mkt) + "."
            facts += [f"{m.label}: {m.value}" for m in mkt]
    except Exception:  # noqa: BLE001
        pass

    parts = []
    if market_line:
        parts.append(market_line)
    parts.append(f"Your portfolio {val.total_value:,.2f} {base}, today {val.day_change:+,.2f} {base}.")
    if gainers:
        parts.append("Leading: " + ", ".join(_mover_str(g, base) for g in gainers) + ".")
    if losers:
        parts.append("Weighing on it: " + ", ".join(_mover_str(x, base) for x in losers) + ".")
    if val.has_stale:
        parts.append("Some prices may be out of date.")
    parts.append("Information only, not financial advice.")
    return " ".join(parts), facts


def _strip_reasoning(text: str) -> str:
    """Remove reasoning-model chain-of-thought so only the final answer is shown.

    Handles ``<think>…</think>`` blocks and the common case where a model dumps its
    reasoning and then a closing ``</think>`` with the real answer after it.
    """
    import re

    if "</think>" in text:
        text = text.rsplit("</think>", 1)[-1]
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    text = text.replace("<think>", "").replace("</think>", "")
    # Drop a leading "Okay, …/Sure, …/Here is …" preamble line if present.
    text = re.sub(r"^\s*(okay|sure|alright|here(?:'s| is))\b.*?\n", "", text, flags=re.IGNORECASE)
    return text.strip()


async def generate_briefing(session: AsyncSession) -> str:
    template, facts = await _deterministic_briefing(session)
    # If an AI provider is reachable, let it narrate the SAME facts (it may not add
    # any numbers of its own). Otherwise use the deterministic template.
    try:
        from app.ai.prompts import SYSTEM_PROMPT
        from app.providers.ai import get_ai_provider
        from app.schemas.ai import AIRequest, ChatMessage

        provider = get_ai_provider()
        health = await provider.health()
        if health.available and facts:
            # Add world-market + news context so the briefing tells a connected story
            # (global markets → your portfolio → relevant headlines). Still grounded —
            # the model may only use these facts.
            try:
                from app.ai.tools import market_facts, news_facts

                facts = facts + [f"{m.label}: {m.value}" for m in await market_facts(session, limit=8)]
                facts = facts + [f"News: {n.value}" for n in await news_facts(session, limit=4)]
            except Exception:  # noqa: BLE001
                pass
            messages = [
                ChatMessage(role="system", content=SYSTEM_PROMPT),
                ChatMessage(role="system", content="FACTS (the only data you may use):\n" + "\n".join(f"- {f}" for f in facts)),
                ChatMessage(role="user", content=(
                    "Write a daily briefing for a desk display — a short, connected story in 4-6 sentences, "
                    "plain prose, no markdown. Structure it: (1) how the broader/global markets moved today "
                    "(name a couple of indices and direction), (2) how that ties to your portfolio's move today "
                    "and its standout gainers/detractors, (3) one relevant headline if any. Use ONLY the FACTS; "
                    "quote their numbers; no reasoning or <think> tags. End with: Information only, not financial advice.")),
            ]
            text = ""
            async for chunk in provider.chat(AIRequest(messages=messages, max_tokens=2500)):
                if chunk.delta:
                    text += chunk.delta
                if chunk.done:
                    break
            text = _strip_reasoning(text)
            # If the model leaked only reasoning (little real answer left), fall back.
            if len(text) >= 25:
                if "not financial advice" not in text.lower():
                    text += "\n\nInformation only, not financial advice."
                return text
    except Exception:  # noqa: BLE001 — narration is best-effort
        pass
    return template


async def refresh_briefing(session: AsyncSession) -> str:
    text = await generate_briefing(session)
    await _set(session, BRIEFING_KEY, text)
    await _set(session, BRIEFING_TS_KEY, datetime.now(UTC).isoformat())
    return text


async def get_briefing(session: AsyncSession) -> dict:
    text = await _get(session, BRIEFING_KEY)
    ts = await _get(session, BRIEFING_TS_KEY)
    return {"text": text or "No briefing generated yet.", "generated_at": ts}


async def _get(session: AsyncSession, key: str) -> str | None:
    row = (await session.execute(select(Setting).where(Setting.key == key))).scalars().first()
    return row.value if row else None


async def _set(session: AsyncSession, key: str, value: str) -> None:
    row = (await session.execute(select(Setting).where(Setting.key == key))).scalars().first()
    if row:
        row.value = value
    else:
        session.add(Setting(key=key, value=value))
    await session.flush()

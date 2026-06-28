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

    pct = pct_change(h.price, h.price - (h.day_change_base / h.quantity)) if h.quantity else None
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

    parts = [f"Portfolio {val.total_value:,.2f} {base}, today {val.day_change:+,.2f} {base}."]
    if gainers:
        parts.append("Leading your holdings: " + ", ".join(_mover_str(g, base) for g in gainers) + ".")
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
            # Add a little market context so the briefing relates the portfolio to
            # how the broader markets did today (still grounded — only these facts).
            try:
                from app.ai.tools import market_facts

                facts = facts + [f"{m.label}: {m.value}" for m in await market_facts(session, limit=4)]
            except Exception:  # noqa: BLE001
                pass
            messages = [
                ChatMessage(role="system", content=SYSTEM_PROMPT),
                ChatMessage(role="system", content="FACTS (the only data you may use):\n" + "\n".join(f"- {f}" for f in facts)),
                ChatMessage(role="user", content="Write ONLY a concise 2-3 sentence daily briefing for the desk "
                            "display: lead with the portfolio's notable moves today, then one line relating it to "
                            "how the broader markets did. Plain English, no markdown, no reasoning or <think> tags."),
            ]
            text = ""
            async for chunk in provider.chat(AIRequest(messages=messages, max_tokens=1500)):
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

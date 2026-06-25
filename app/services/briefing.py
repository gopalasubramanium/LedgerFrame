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


async def generate_briefing(session: AsyncSession) -> str:
    base = get_settings().base_currency
    val = await value_portfolio(session, base)
    gainers, losers = top_movers(val, n=2)
    parts = [
        f"Portfolio value {val.total_value:,.2f} {base}, "
        f"today {val.day_change:+,.2f} {base}."
    ]
    if gainers:
        parts.append("Leading: " + ", ".join(f"{g.label} ({g.day_change_base:+,.0f})" for g in gainers) + ".")
    if losers:
        parts.append("Lagging: " + ", ".join(f"{x.label} ({x.day_change_base:+,.0f})" for x in losers) + ".")
    if val.has_stale:
        parts.append("Some prices may be out of date.")
    parts.append("Information only, not financial advice.")
    return " ".join(parts)


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

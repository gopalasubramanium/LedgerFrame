"""Backend "tools" that gather verified structured facts for the AI layer.

These are the ONLY source of numbers the assistant may reference. Each returns a
list of GroundingFact with provenance and timestamps. The AI never calls market
providers directly and never computes values itself.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import Watchlist
from app.schemas.ai import GroundingFact
from app.services.market import get_cached_quote
from app.services.portfolio import top_movers, value_portfolio


def _fmt(value, ccy: str) -> str:
    return f"{value:,.2f} {ccy}"


async def portfolio_facts(session: AsyncSession) -> list[GroundingFact]:
    base = get_settings().base_currency
    val = await value_portfolio(session, base)
    now = datetime.now(timezone.utc)
    facts = [
        GroundingFact(label="Portfolio total value", value=_fmt(val.total_value, base), timestamp=now),
        GroundingFact(label="Total unrealised P/L", value=_fmt(val.unrealised_pl, base), timestamp=now),
        GroundingFact(label="Today's change", value=_fmt(val.day_change, base), timestamp=now,
                      is_stale=val.has_stale),
    ]
    if val.total_return_pct is not None:
        facts.append(GroundingFact(label="Total return %", value=f"{val.total_return_pct}%", timestamp=now))
    return facts


async def movers_facts(session: AsyncSession) -> list[GroundingFact]:
    base = get_settings().base_currency
    val = await value_portfolio(session, base)
    gainers, losers = top_movers(val, n=3)
    now = datetime.now(timezone.utc)
    facts: list[GroundingFact] = []
    for g in gainers:
        facts.append(GroundingFact(label=f"Gainer {g.label}", value=_fmt(g.day_change_base, base),
                                   timestamp=now, is_stale=g.is_stale))
    for l in losers:
        facts.append(GroundingFact(label=f"Detractor {l.label}", value=_fmt(l.day_change_base, base),
                                   timestamp=now, is_stale=l.is_stale))
    return facts


async def allocation_facts(session: AsyncSession, key: str = "asset_class") -> list[GroundingFact]:
    base = get_settings().base_currency
    val = await value_portfolio(session, base)
    alloc = val.allocation(key)
    total = sum(alloc.values()) or 1
    now = datetime.now(timezone.utc)
    return [
        GroundingFact(label=f"Allocation ({key}) — {k}",
                      value=f"{_fmt(v, base)} ({v / total * 100:.1f}%)", timestamp=now)
        for k, v in sorted(alloc.items(), key=lambda kv: kv[1], reverse=True)
    ]


async def watchlist_quote_facts(session: AsyncSession) -> list[GroundingFact]:
    from sqlalchemy.orm import selectinload

    wl = (
        await session.execute(
            select(Watchlist).options(selectinload(Watchlist.items)).limit(1)
        )
    ).scalars().first()
    facts: list[GroundingFact] = []
    if not wl:
        return facts
    for item in wl.items[:8]:
        from app.models import Instrument

        instr = await session.get(Instrument, item.instrument_id)
        if not instr:
            continue
        q = await get_cached_quote(session, instr.symbol, instr.exchange)
        if q.price is None:
            facts.append(GroundingFact(label=instr.symbol, value="unavailable",
                                       source=q.source, entitlement="unavailable"))
        else:
            facts.append(GroundingFact(
                label=instr.symbol, value=_fmt(q.price, q.currency), source=q.source,
                timestamp=q.received_at, entitlement=q.entitlement.value, is_stale=q.is_stale))
    return facts


# Keyword → tool routing. Deliberately simple & transparent for a desk display.
async def gather_facts(session: AsyncSession, question: str) -> list[GroundingFact]:
    q = question.lower()
    facts: list[GroundingFact] = []
    if any(w in q for w in ("alloc", "exposure", "sector", "currency", "geograph", "concentrat")):
        key = "asset_class"
        if "currency" in q:
            key = "native_currency"
        elif "sector" in q:
            key = "asset_class"  # sector lives on instrument; asset_class is the safe default
        facts += await allocation_facts(session, key)
    if any(w in q for w in ("mov", "gain", "loser", "detractor", "today", "best", "worst")):
        facts += await movers_facts(session)
    if any(w in q for w in ("portfolio", "net worth", "total", "perform", "return", "value")):
        facts += await portfolio_facts(session)
    if any(w in q for w in ("watch", "price", "quote", "market", "overnight")):
        facts += await watchlist_quote_facts(session)
    if not facts:  # default: give a portfolio overview
        facts += await portfolio_facts(session)
    return facts

"""Backend "tools" that gather verified structured facts for the AI layer.

These are the ONLY source of numbers the assistant may reference. Each returns a
list of GroundingFact with provenance and timestamps. The AI never calls market
providers directly and never computes values itself.
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

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
    now = datetime.now(UTC)
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
    now = datetime.now(UTC)
    facts: list[GroundingFact] = []
    for g in gainers:
        facts.append(GroundingFact(label=f"Gainer {g.label}", value=_fmt(g.day_change_base, base),
                                   timestamp=now, is_stale=g.is_stale))
    for loser in losers:
        facts.append(GroundingFact(label=f"Detractor {loser.label}", value=_fmt(loser.day_change_base, base),
                                   timestamp=now, is_stale=loser.is_stale))
    return facts


async def allocation_facts(session: AsyncSession, key: str = "asset_class") -> list[GroundingFact]:
    base = get_settings().base_currency
    val = await value_portfolio(session, base)
    alloc = val.allocation(key)
    # Use gross (positive) assets as the denominator so weights are a clean share of
    # the asset base — a liability (negative) can't push a class above 100%.
    gross = sum((v for v in alloc.values() if v > 0), Decimal(0)) or Decimal(1)
    now = datetime.now(UTC)
    return [
        GroundingFact(label=f"Allocation ({key}) — {k}",
                      value=f"{_fmt(v, base)} ({v / gross * 100:.1f}%)", timestamp=now)
        for k, v in sorted(alloc.items(), key=lambda kv: kv[1], reverse=True)
        if v > 0
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


async def symbol_facts(session: AsyncSession, symbols: list[str]) -> list[GroundingFact]:
    """Quote + position facts for specific tickers named in the question."""
    from app.models import Holding, Instrument

    facts: list[GroundingFact] = []
    for sym in symbols[:5]:
        instr = (
            await session.execute(select(Instrument).where(Instrument.symbol == sym))
        ).scalars().first()
        if not instr:
            continue
        q = await get_cached_quote(session, instr.symbol, instr.exchange)
        name = instr.name if instr.name and instr.name.upper() != sym else sym
        if q.price is not None:
            facts.append(GroundingFact(
                label=f"{name} price", value=_fmt(q.price, q.currency), source=q.source,
                timestamp=q.received_at, entitlement=q.entitlement.value, is_stale=q.is_stale))
        else:
            facts.append(GroundingFact(label=f"{name} price", value="unavailable",
                                       source=q.source, entitlement="unavailable"))
        holding = (
            await session.execute(select(Holding).where(Holding.instrument_id == instr.id))
        ).scalars().first()
        if holding and holding.quantity:
            facts.append(GroundingFact(label=f"{name} holding", value=f"{holding.quantity} units"))
    return facts


async def market_facts(session: AsyncSession, limit: int = 14) -> list[GroundingFact]:
    """World indices + cross-asset benchmarks (the Global/Markets data) with % change."""
    from app.api.v1.routes.markets import _GLOBAL_MARKETS
    from app.services.market import display_quote

    facts: list[GroundingFact] = []
    for items in _GLOBAL_MARKETS.values():
        for sym, label in items:
            q = await display_quote(session, sym)
            if q.price is None:
                continue
            chg = f" ({q.change_pct:+.2f}%)" if q.change_pct is not None else ""
            facts.append(GroundingFact(
                label=label, value=f"{_fmt(q.price, q.currency)}{chg}", source=q.source,
                timestamp=q.received_at, entitlement=q.entitlement.value, is_stale=q.is_stale))
            if len(facts) >= limit:
                return facts
    return facts


async def news_facts(session: AsyncSession, limit: int = 6) -> list[GroundingFact]:
    """Recent free-RSS headlines (so 'what's in the news' uses the News page data)."""
    import asyncio

    from app.services.feeds import fetch_feeds

    try:
        items = await asyncio.wait_for(fetch_feeds(session, limit=limit), timeout=8)
    except (TimeoutError, Exception):  # noqa: BLE001
        items = []
    return [
        GroundingFact(label=f"Headline · {it.source}", value=it.headline,
                      source=it.source or "news", timestamp=it.published_at)
        for it in items[:limit]
    ]


async def networth_facts(session: AsyncSession) -> list[GroundingFact]:
    """Assets, liabilities and net worth in base currency."""
    base = get_settings().base_currency
    val = await value_portfolio(session, base)
    now = datetime.now(UTC)
    assets = sum((h.market_value_base for h in val.holdings if h.market_value_base > 0), Decimal(0))
    liabilities = -sum((h.market_value_base for h in val.holdings if h.market_value_base < 0), Decimal(0))
    return [
        GroundingFact(label="Net worth", value=_fmt(val.total_value, base), timestamp=now),
        GroundingFact(label="Total assets", value=_fmt(assets, base), timestamp=now),
        GroundingFact(label="Total liabilities", value=_fmt(liabilities, base), timestamp=now),
    ]


async def performance_facts(session: AsyncSession) -> list[GroundingFact]:
    """Return, risk and concentration metrics from the analytics engine."""
    from app.services.analytics import key_stats

    base = get_settings().base_currency
    try:
        ks = await key_stats(session, base)
    except Exception:  # noqa: BLE001
        return await portfolio_facts(session)
    want = {
        "Total return", "1Y return", "1Y volatility", "Max drawdown (1Y)",
        "Return / volatility", "Top 5 concentration", "Largest position",
        "Income (div/int)", "Income yield", "Realised P/L", "Unrealised P/L",
    }
    facts: list[GroundingFact] = []
    for m in ks.get("metrics", []):
        if m["label"] not in want or m["value"] is None:
            continue
        kind = m.get("kind")
        v = m["value"]
        if kind == "pct":
            value = f"{round(float(v), 2)}%"
        elif kind == "ratio":
            value = f"{round(float(v), 2)}"
        elif kind == "count":
            value = f"{v}"
        else:
            value = f"{v} {base}"
        if m.get("note"):
            value += f" ({m['note']})"
        facts.append(GroundingFact(label=m["label"], value=value))
    return facts


async def holdings_facts(session: AsyncSession, n: int = 8) -> list[GroundingFact]:
    """Largest positions by market value (what the user actually owns)."""
    base = get_settings().base_currency
    val = await value_portfolio(session, base)
    priced = sorted(val.holdings, key=lambda h: h.market_value_base, reverse=True)[:n]
    gross = sum((h.market_value_base for h in val.holdings if h.market_value_base > 0), Decimal(0)) or Decimal(1)
    return [
        GroundingFact(
            label=(h.name or h.label),
            value=f"{_fmt(h.market_value_base, base)} ({h.market_value_base / gross * 100:.1f}%)",
            is_stale=h.is_stale)
        for h in priced if h.market_value_base > 0
    ]


def _extract_symbols(question: str) -> list[str]:
    """Pull likely tickers from a question (e.g. AAPL, HDFC.BSE, BTC)."""
    import re

    stop = {
        "WHAT", "HOW", "MY", "THE", "ETF", "USD", "SGD", "INR", "AI", "PL", "FX", "OK", "VS",
        "DID", "ARE", "IS", "DO", "AND", "OR", "TODAY", "NOW", "ME", "WHY", "WHEN", "WHERE",
        "MARKET", "MARKETS", "NEWS", "GLOBAL", "WORLD", "CASH", "RISK", "NET", "WORTH", "TOTAL",
        "VALUE", "GAIN", "GAINS", "LOSS", "LOSSES", "RETURN", "RETURNS", "ALL", "ANY", "GOOD",
        "BAD", "BUY", "SELL", "HOLD", "YTD", "BEST", "WORST", "TOP", "OWN", "HAVE", "DOING",
        "PERFORM", "PORTFOLIO", "STOCKS", "PRICE", "PRICES", "MOVE", "MOVED", "UP", "DOWN",
    }
    out: list[str] = []
    for tok in re.findall(r"\b[A-Z]{2,10}(?:\.[A-Z]{1,4})?\b", question.upper()):
        if tok not in stop and tok not in out:
            out.append(tok)
    return out


# Intent-routed fact gathering. Picks the RIGHT data for the question (markets,
# news, net worth, performance/risk, allocation, movers, holdings, watchlist or a
# specific ticker) and anchors portfolio questions with the headline numbers — so
# the model has a rich, relevant, grounded dataset to reason over.
async def gather_facts(session: AsyncSession, question: str) -> list[GroundingFact]:
    q = question.lower()

    def has(*ws: str) -> bool:
        return any(w in q for w in ws)

    facts: list[GroundingFact] = []
    syms = _extract_symbols(question)
    if syms:
        facts += await symbol_facts(session, syms)

    is_market = has("market", "indices", "index", "global", "world", "nasdaq", "s&p", "s & p",
                    "dow", "nikkei", "ftse", "hang seng", "nifty", "stoxx", "sensex", "wall street")
    is_news = has("news", "headline", "happening", "story", "stories", "going on")
    is_networth = has("net worth", "networth", "asset", "liabilit", "wealth", "cash")
    is_perf = has("perform", "return", "risk", "volatil", "drawdown", "sharpe", "benchmark",
                  " vs ", "beat", "compare", "how am i", "doing", "yield", "dividend", "income")
    is_alloc = has("alloc", "exposure", "diversif", "concentrat", "sector", "weight", "spread")
    is_movers = has("mov", "gain", "los", "detractor", "best", "worst", "drop", "today", "up ", "down")
    is_holdings = has("biggest", "largest", "top holding", "what do i own", "position", "holding", "breakdown", "own")
    is_watch = has("watch", "watchlist")

    if is_market:
        facts += await market_facts(session)
    if is_news:
        facts += await news_facts(session)
    if is_networth:
        facts += await networth_facts(session)
    if is_perf:
        facts += await performance_facts(session)
    if is_alloc:
        facts += await allocation_facts(session, "native_currency" if "currency" in q else "asset_class")
    if is_movers:
        facts += await movers_facts(session)
    if is_holdings:
        facts += await holdings_facts(session)
    if is_watch:
        facts += await watchlist_quote_facts(session)

    portfolio_intent = is_networth or is_perf or is_alloc or is_movers or is_holdings or bool(syms)
    external_only = (is_market or is_news) and not portfolio_intent

    if not facts:
        # General/ambiguous question → a rich portfolio overview.
        facts = await portfolio_facts(session) + await movers_facts(session)
    elif not external_only:
        # Anchor portfolio questions with the headline numbers (prepended).
        facts = await portfolio_facts(session) + facts

    # De-duplicate by label, preserving order; cap to keep the prompt focused.
    seen: set[str] = set()
    deduped: list[GroundingFact] = []
    for f in facts:
        if f.label not in seen:
            seen.add(f.label)
            deduped.append(f)
    return deduped[:18]

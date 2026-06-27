"""Markets overview, search, and instrument detail/history."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.config import get_settings
from app.core.symbols import currency_for_symbol
from app.models import Holding, Instrument, WatchlistItem
from app.providers.market import get_provider
from app.services.market import display_quote, refresh_quote

router = APIRouter()

# Baseline symbols always shown. Uses live-provider-friendly ETF proxies instead of
# raw indices (^GSPC etc.), which Alpha Vantage doesn't serve.
_DEFAULT_OVERVIEW = [
    "SPY", "QQQ", "DIA", "EWJ", "FEZ", "EWU", "EWH", "INDA", "EWS",
    "AAPL", "MSFT", "NVDA", "GLD", "BTC", "ETH",
]


async def _overview_instruments(session: AsyncSession) -> list[Instrument]:
    """All instruments to show on market views: defaults + watchlist + holdings."""
    held_ids = (
        await session.execute(select(Holding.instrument_id).where(Holding.instrument_id.isnot(None)))
    ).scalars().all()
    wl_ids = (await session.execute(select(WatchlistItem.instrument_id))).scalars().all()
    by_id = {
        i.id: i
        for i in (await session.execute(select(Instrument).where(Instrument.id.in_({*held_ids, *wl_ids})))).scalars()
    }
    ordered: list[Instrument] = []
    seen: set[str] = set()
    # Defaults first (create rows if missing), then held/watchlist extras.
    for sym in _DEFAULT_OVERVIEW:
        instr = (await session.execute(select(Instrument).where(Instrument.symbol == sym))).scalars().first()
        if instr is None:
            instr = Instrument(symbol=sym, name=sym)
            session.add(instr)
            await session.flush()
        if instr.symbol not in seen:
            ordered.append(instr)
            seen.add(instr.symbol)
    for instr in by_id.values():
        if instr.symbol not in seen:
            ordered.append(instr)
            seen.add(instr.symbol)
    return ordered


@router.get("/markets/overview")
async def markets_overview(session: AsyncSession = Depends(get_db)) -> dict:
    held_ids = set(
        (await session.execute(select(Holding.instrument_id).where(Holding.instrument_id.isnot(None)))).scalars().all()
    )
    instruments = await _overview_instruments(session)
    items = []
    for instr in instruments:
        q = await display_quote(session, instr.symbol, instr.exchange)
        items.append({
            "symbol": instr.symbol,
            "name": instr.name,
            "asset_class": instr.asset_class.value if hasattr(instr.asset_class, "value") else str(instr.asset_class),
            "currency": currency_for_symbol(instr.symbol, instr.exchange) or instr.currency,
            "held": instr.id in held_ids,
            "quote": q.model_dump(mode="json"),
        })
    status = await get_provider().get_market_status("US")
    return {
        # `quotes` kept for backward-compat (flat quote list); `instruments` is richer.
        "quotes": [it["quote"] for it in items],
        "instruments": items,
        "market_status": status.model_dump(mode="json"),
        "demo_mode": get_settings().is_demo,
    }


# Major world indices + cross-asset benchmarks, grouped for the Global page.
# World markets via liquid, broadly-supported ETF proxies (so a live provider like
# Alpha Vantage — which doesn't serve raw indices such as ^GSPC — returns real
# values). Each entry is (symbol, label).
_GLOBAL_MARKETS: dict[str, list[tuple[str, str]]] = {
    "Americas": [("SPY", "US · S&P 500"), ("QQQ", "US · Nasdaq 100"), ("DIA", "US · Dow Jones")],
    "Europe": [("EWU", "UK · FTSE 100"), ("FEZ", "Europe · Euro Stoxx 50"), ("EWG", "Germany · DAX")],
    "Asia-Pacific": [("EWJ", "Japan · Nikkei 225"), ("EWH", "Hong Kong · Hang Seng"),
                     ("INDA", "India · Nifty 50"), ("EWS", "Singapore · STI")],
    "Commodities": [("GLD", "Gold"), ("SLV", "Silver"), ("USO", "Oil")],
    "Crypto": [("BTC", "Bitcoin"), ("ETH", "Ethereum")],
}


def global_market_symbols() -> list[str]:
    return [sym for items in _GLOBAL_MARKETS.values() for sym, _ in items]


@router.get("/markets/global")
async def markets_global(session: AsyncSession = Depends(get_db)) -> dict:
    groups = []
    for region, items_def in _GLOBAL_MARKETS.items():
        items = []
        for sym, label in items_def:
            q = await display_quote(session, sym)
            items.append({"symbol": sym, "label": label, "quote": q.model_dump(mode="json")})
        groups.append({"region": region, "items": items})
    status = await get_provider().get_market_status("US")
    return {"groups": groups, "market_status": status.model_dump(mode="json"), "demo_mode": get_settings().is_demo}


@router.get("/markets/search")
async def markets_search(q: str = Query(min_length=1, max_length=40)) -> dict:
    results = await get_provider().search_instruments(q)
    return {"results": [r.model_dump(mode="json") for r in results]}


@router.get("/instruments/{symbol}")
async def instrument_detail(symbol: str, session: AsyncSession = Depends(get_db)) -> dict:
    q = await refresh_quote(session, symbol)
    # Prefer stored instrument metadata (covers held/watchlisted symbols); fall back
    # to a provider search for anything else.
    instr = (
        await session.execute(select(Instrument).where(Instrument.symbol == symbol.upper()))
    ).scalars().first()
    if instr is not None:
        meta = {
            "symbol": instr.symbol, "name": instr.name,
            "asset_class": instr.asset_class.value if hasattr(instr.asset_class, "value") else str(instr.asset_class),
            "currency": currency_for_symbol(instr.symbol, instr.exchange) or instr.currency,
            "exchange": instr.exchange,
            "sector": instr.sector, "country": instr.country,
        }
    else:
        results = await get_provider().search_instruments(symbol)
        match = next((r for r in results if r.symbol == symbol.upper()), None)
        meta = match.model_dump(mode="json") if match else {"symbol": symbol.upper()}
    return {"quote": q.model_dump(mode="json"), "instrument": meta}


@router.get("/instruments/{symbol}/news")
async def instrument_news(symbol: str, session: AsyncSession = Depends(get_db)) -> dict:
    """News relevant to one instrument: provider news for the symbol + any RSS/Atom
    headlines mentioning the symbol or company name."""
    from app.services.feeds import fetch_feeds

    sym = symbol.upper()
    instr = (await session.execute(select(Instrument).where(Instrument.symbol == sym))).scalars().first()
    name = (instr.name if instr else "").replace(" (DEMO)", "").strip()
    terms = {sym.lower()}
    if name:
        terms.add(name.lower())
        first = name.split()[0].lower()
        if len(first) > 3:
            terms.add(first)

    items = list(await get_provider().get_news([sym]))
    try:
        for it in await fetch_feeds(session, limit=60):
            blob = f"{it.headline} {it.summary or ''}".lower()
            if any(t in blob for t in terms):
                items.append(it)
    except Exception:  # noqa: BLE001
        pass
    # Dedupe by headline, newest first.
    seen, out = set(), []
    for it in sorted(items, key=lambda i: i.published_at, reverse=True):
        if it.headline in seen:
            continue
        seen.add(it.headline)
        out.append(it.model_dump(mode="json"))
    return {"symbol": sym, "items": out[:15]}


@router.get("/instruments/{symbol}/history")
async def instrument_history(
    symbol: str,
    interval: str = Query("1d"),
    days: int = Query(180, ge=1, le=3650),
    session: AsyncSession = Depends(get_db),
) -> dict:
    from app.services.market import get_history_cached

    end = datetime.now(UTC)
    start = end - timedelta(days=days)
    candles = await get_history_cached(session, symbol, interval, start, end)
    return {
        "symbol": symbol.upper(),
        "interval": interval,
        "candles": [c.model_dump(mode="json") for c in candles],
    }

"""Markets overview, search, and instrument detail/history."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.config import get_settings
from app.models import Holding, Instrument, WatchlistItem
from app.providers.market import get_provider
from app.services.market import refresh_quote

router = APIRouter()

# Baseline symbols always shown (indices + popular instruments). The user's held
# and watchlisted instruments are merged in on top of these.
_DEFAULT_OVERVIEW = ["^GSPC", "^STI", "AAPL", "MSFT", "NVDA", "VOO", "GLD", "BTC", "ETH"]


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
        q = await refresh_quote(session, instr.symbol, instr.exchange)
        items.append({
            "symbol": instr.symbol,
            "name": instr.name,
            "asset_class": instr.asset_class.value if hasattr(instr.asset_class, "value") else str(instr.asset_class),
            "currency": instr.currency,
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
            "currency": instr.currency, "exchange": instr.exchange,
            "sector": instr.sector, "country": instr.country,
        }
    else:
        results = await get_provider().search_instruments(symbol)
        match = next((r for r in results if r.symbol == symbol.upper()), None)
        meta = match.model_dump(mode="json") if match else {"symbol": symbol.upper()}
    return {"quote": q.model_dump(mode="json"), "instrument": meta}


@router.get("/instruments/{symbol}/history")
async def instrument_history(
    symbol: str,
    interval: str = Query("1d"),
    days: int = Query(180, ge=1, le=3650),
) -> dict:
    end = datetime.now(UTC)
    start = end - timedelta(days=days)
    candles = await get_provider().get_history(symbol, interval, start, end)
    return {
        "symbol": symbol.upper(),
        "interval": interval,
        "candles": [c.model_dump(mode="json") for c in candles],
    }

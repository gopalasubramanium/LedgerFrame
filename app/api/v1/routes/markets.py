"""Markets overview, search, and instrument detail/history."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.config import get_settings
from app.providers.market import get_provider
from app.services.market import refresh_quote

router = APIRouter()

# Symbols shown on the Markets overview when no custom config exists.
_DEFAULT_OVERVIEW = ["^GSPC", "^STI", "AAPL", "MSFT", "NVDA", "VOO", "GLD", "BTC", "ETH"]


@router.get("/markets/overview")
async def markets_overview(session: AsyncSession = Depends(get_db)) -> dict:
    quotes = []
    for sym in _DEFAULT_OVERVIEW:
        q = await refresh_quote(session, sym)
        quotes.append(q.model_dump(mode="json"))
    status = await get_provider().get_market_status("US")
    return {
        "quotes": quotes,
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
    results = await get_provider().search_instruments(symbol)
    meta = next((r for r in results if r.symbol == symbol.upper()), None)
    return {
        "quote": q.model_dump(mode="json"),
        "instrument": meta.model_dump(mode="json") if meta else {"symbol": symbol.upper()},
    }


@router.get("/instruments/{symbol}/history")
async def instrument_history(
    symbol: str,
    interval: str = Query("1d"),
    days: int = Query(180, ge=1, le=3650),
) -> dict:
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)
    candles = await get_provider().get_history(symbol, interval, start, end)
    return {
        "symbol": symbol.upper(),
        "interval": interval,
        "candles": [c.model_dump(mode="json") for c in candles],
    }

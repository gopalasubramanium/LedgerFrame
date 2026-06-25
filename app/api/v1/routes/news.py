"""News headlines and AI briefing."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.providers.market import get_provider
from app.services.briefing import get_briefing, refresh_briefing

router = APIRouter()


@router.get("/news")
async def news(session: AsyncSession = Depends(get_db)) -> dict:
    from app.models import Watchlist
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    wl = (
        await session.execute(
            select(Watchlist).options(selectinload(Watchlist.items)).limit(1)
        )
    ).scalars().first()
    symbols = []
    if wl:
        from app.models import Instrument

        for it in wl.items[:8]:
            instr = await session.get(Instrument, it.instrument_id)
            if instr:
                symbols.append(instr.symbol)
    items = await get_provider().get_news(symbols or ["AAPL", "MSFT", "NVDA"])
    return {"items": [i.model_dump(mode="json") for i in items]}


@router.get("/briefing")
async def briefing(session: AsyncSession = Depends(get_db)) -> dict:
    return await get_briefing(session)


@router.post("/briefing/refresh")
async def briefing_refresh(session: AsyncSession = Depends(get_db)) -> dict:
    text = await refresh_briefing(session)
    return {"text": text}

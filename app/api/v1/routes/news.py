"""News headlines (free RSS + provider) and AI briefing."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_auth
from app.providers.market import get_provider
from app.services.briefing import get_briefing, refresh_briefing
from app.services.feeds import (
    DEFAULT_FEEDS,
    fetch_feeds,
    get_feed_urls,
    set_feed_urls,
    test_feeds,
)

router = APIRouter()


@router.get("/news")
async def news(session: AsyncSession = Depends(get_db)) -> dict:
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    from app.models import Watchlist

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

    # Free RSS feeds first (no key needed), then any provider news. The RSS fetch
    # is capped so a slow/blocked feed can never stall the News page; on timeout we
    # simply show provider headlines.
    import asyncio

    try:
        rss = await asyncio.wait_for(fetch_feeds(session, limit=30), timeout=12)
    except (TimeoutError, Exception):  # noqa: BLE001
        rss = []
    provider_items = await get_provider().get_news(symbols or ["AAPL", "MSFT", "NVDA"])
    items = rss + list(provider_items)
    return {
        "items": [i.model_dump(mode="json") for i in items],
        "rss_count": len(rss),
    }


@router.get("/news/feeds")
async def get_feeds(session: AsyncSession = Depends(get_db)) -> dict:
    return {"feeds": await get_feed_urls(session), "defaults": DEFAULT_FEEDS}


class FeedsIn(BaseModel):
    feeds: list[str]


@router.put("/news/feeds", dependencies=[Depends(require_auth)])
async def put_feeds(payload: FeedsIn, session: AsyncSession = Depends(get_db)) -> dict:
    await set_feed_urls(session, payload.feeds)
    return {"ok": True, "feeds": await get_feed_urls(session)}


@router.get("/news/feeds/test")
async def test_news_feeds(session: AsyncSession = Depends(get_db)) -> dict:
    return {"results": await test_feeds(session)}


@router.get("/briefing")
async def briefing(session: AsyncSession = Depends(get_db)) -> dict:
    return await get_briefing(session)


@router.post("/briefing/refresh")
async def briefing_refresh(session: AsyncSession = Depends(get_db)) -> dict:
    text = await refresh_briefing(session)
    return {"text": text}

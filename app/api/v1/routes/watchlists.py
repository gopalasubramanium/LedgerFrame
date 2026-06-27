"""Watchlists CRUD (create + list + add items)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_db, require_auth
from app.models import Instrument, Watchlist, WatchlistItem
from app.services.market import get_cached_quote

router = APIRouter()


class WatchlistIn(BaseModel):
    name: str
    symbols: list[str] = []


@router.get("/watchlists")
async def list_watchlists(session: AsyncSession = Depends(get_db)) -> dict:
    lists = (
        await session.execute(
            select(Watchlist).options(selectinload(Watchlist.items)).order_by(Watchlist.sort_order)
        )
    ).scalars().all()
    out = []
    for wl in lists:
        items = []
        for it in sorted(wl.items, key=lambda x: x.sort_order):
            instr = await session.get(Instrument, it.instrument_id)
            if not instr:
                continue
            q = await get_cached_quote(session, instr.symbol, instr.exchange)
            items.append({"symbol": instr.symbol, "name": instr.name,
                          "quote": q.model_dump(mode="json")})
        out.append({"id": wl.id, "name": wl.name, "items": items})
    return {"watchlists": out}


@router.post("/watchlists", dependencies=[Depends(require_auth)])
async def create_watchlist(payload: WatchlistIn, session: AsyncSession = Depends(get_db)) -> dict:
    wl = Watchlist(name=payload.name)
    session.add(wl)
    await session.flush()
    for i, sym in enumerate(payload.symbols):
        instr = (
            await session.execute(select(Instrument).where(Instrument.symbol == sym.upper()))
        ).scalars().first()
        if instr is None:
            instr = Instrument(symbol=sym.upper(), name=sym.upper())
            session.add(instr)
            await session.flush()
        session.add(WatchlistItem(watchlist_id=wl.id, instrument_id=instr.id, sort_order=i))
    await session.flush()
    return {"ok": True, "id": wl.id}


class SymbolIn(BaseModel):
    symbol: str


async def _default_watchlist(session: AsyncSession) -> Watchlist:
    wl = (await session.execute(select(Watchlist).order_by(Watchlist.sort_order))).scalars().first()
    if wl is None:
        wl = Watchlist(name="Watchlist")
        session.add(wl)
        await session.flush()
    return wl


@router.post("/watchlists/{wl_id}/items", dependencies=[Depends(require_auth)])
async def add_item(wl_id: int, payload: SymbolIn, session: AsyncSession = Depends(get_db)) -> dict:
    sym = payload.symbol.strip().upper()
    if not sym:
        return {"ok": False}
    wl = await session.get(Watchlist, wl_id) if wl_id else None
    if wl is None:
        wl = await _default_watchlist(session)
    instr = (await session.execute(select(Instrument).where(Instrument.symbol == sym))).scalars().first()
    if instr is None:
        instr = Instrument(symbol=sym, name=sym)
        session.add(instr)
        await session.flush()
    exists = (await session.execute(
        select(WatchlistItem).where(WatchlistItem.watchlist_id == wl.id, WatchlistItem.instrument_id == instr.id)
    )).scalars().first()
    if not exists:
        session.add(WatchlistItem(watchlist_id=wl.id, instrument_id=instr.id, sort_order=999))
        await session.flush()
    return {"ok": True, "watchlist_id": wl.id}


@router.delete("/watchlists/{wl_id}/items/{symbol}", dependencies=[Depends(require_auth)])
async def remove_item(wl_id: int, symbol: str, session: AsyncSession = Depends(get_db)) -> dict:
    instr = (await session.execute(select(Instrument).where(Instrument.symbol == symbol.upper()))).scalars().first()
    if instr:
        for it in (await session.execute(
            select(WatchlistItem).where(WatchlistItem.watchlist_id == wl_id, WatchlistItem.instrument_id == instr.id)
        )).scalars().all():
            await session.delete(it)
        await session.flush()
    return {"ok": True}


@router.delete("/watchlists/{wl_id}", dependencies=[Depends(require_auth)])
async def delete_watchlist(wl_id: int, session: AsyncSession = Depends(get_db)) -> dict:
    wl = await session.get(Watchlist, wl_id)
    if wl:
        await session.delete(wl)
        await session.flush()
    return {"ok": True}

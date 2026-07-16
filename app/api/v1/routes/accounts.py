# SPDX-License-Identifier: AGPL-3.0-or-later
"""Account / institution view + management (W7)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_auth
from app.services.accounts import (
    ACCOUNT_KINDS,
    accounts_report,
    create_account,
    delete_account,
    list_accounts,
    list_entities,
    update_account,
)
from app.services.entities import create_entity, delete_entity, update_entity

router = APIRouter()


class AccountIn(BaseModel):
    name: str = Field(max_length=120)
    institution: str | None = Field(default=None, max_length=120)
    kind: str = "brokerage"
    currency: str | None = Field(default=None, max_length=3)
    entity_id: int | None = Field(default=None)  # §9-4/D-064 — assign the account to an entity
    cost_basis_method: str | None = Field(default=None)  # §9-5/D-018 — fifo | average


@router.get("/accounts")
async def get_accounts(entity_id: int | None = Query(default=None),
                       session: AsyncSession = Depends(get_db)) -> dict:
    """Wealth grouped by account / institution."""
    return await accounts_report(session, entity_id=entity_id)


@router.get("/accounts/list")
async def get_accounts_list(session: AsyncSession = Depends(get_db)) -> dict:
    return {"accounts": await list_accounts(session), "kinds": ACCOUNT_KINDS}


class EntityIn(BaseModel):
    name: str = Field(max_length=80)
    kind: str | None = Field(default=None)  # §9-6/Amendment H — entity_kind vocab


@router.get("/entities")
async def get_entities(session: AsyncSession = Depends(get_db)) -> dict:
    """§4.7 list ownership entities (id · name · kind) — metadata only, for per-entity report
    sections in the quarterly pack. No valuation or recompute."""
    return {"entities": await list_entities(session)}


@router.post("/entities", dependencies=[Depends(require_auth)])
async def add_entity(payload: EntityIn, session: AsyncSession = Depends(get_db)) -> dict:
    try:
        res = await create_entity(session, payload.model_dump())
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc  # out-of-vocab kind
    await session.commit()
    return {"ok": True, **res}


@router.patch("/entities/{eid}", dependencies=[Depends(require_auth)])
async def edit_entity(eid: int, payload: EntityIn, session: AsyncSession = Depends(get_db)) -> dict:
    try:
        res = await update_entity(session, eid, payload.model_dump())
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    await session.commit()
    return {"ok": True, **res}


@router.delete("/entities/{eid}", dependencies=[Depends(require_auth)])
async def remove_entity(eid: int, session: AsyncSession = Depends(get_db)) -> dict:
    try:
        await delete_entity(session, eid)
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc  # FK-blocked: accounts still reference it
    await session.commit()
    return {"ok": True}


@router.post("/accounts", dependencies=[Depends(require_auth)])
async def add_account(payload: AccountIn, session: AsyncSession = Depends(get_db)) -> dict:
    try:
        res = await create_account(session, payload.model_dump())
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc  # honest 400 on bad entity/kind/currency
    await session.commit()
    return {"ok": True, **res}


@router.patch("/accounts/{aid}", dependencies=[Depends(require_auth)])
async def edit_account(aid: int, payload: AccountIn, session: AsyncSession = Depends(get_db)) -> dict:
    try:
        res = await update_account(session, aid, payload.model_dump())
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc  # account not found
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc  # bad entity/kind/currency
    await session.commit()
    return {"ok": True, **res}


@router.delete("/accounts/{aid}", dependencies=[Depends(require_auth)])
async def remove_account(aid: int, session: AsyncSession = Depends(get_db)) -> dict:
    try:
        await delete_account(session, aid)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    await session.commit()
    return {"ok": True}

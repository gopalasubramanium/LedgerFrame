# SPDX-License-Identifier: AGPL-3.0-or-later
"""Institution master CRUD (D-008; MASTER-DATA §6/§7) — page-accounts §9-1.

The first user-extensible master-with-CRUD. Typed responses (the plan's Institution/Entity
write-route rule): every served field is declared on the model so nothing is silently stripped.
Merge (§9-2) is added in the next commit.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_auth
from app.services.institutions import (
    delete_institution,
    get_or_create_institution,
    list_institutions,
    merge_institutions,
    rename_institution,
)

router = APIRouter()


class InstitutionIn(BaseModel):
    name: str = Field(max_length=120)


class InstitutionOut(BaseModel):
    id: int
    name: str
    account_count: int = 0  # §12-1: referenced-by counts drive the master card + the merge consequence
    policy_count: int = 0


class InstitutionListOut(BaseModel):
    institutions: list[InstitutionOut]


class InstitutionWriteOut(BaseModel):
    ok: bool
    id: int
    name: str


class MergeIn(BaseModel):
    survivor_id: int
    duplicate_id: int


class MergeOut(BaseModel):
    ok: bool
    survivor_id: int
    duplicate_id: int
    survivor_name: str
    repointed: int


class OkOut(BaseModel):
    ok: bool


@router.get("/institutions", response_model=InstitutionListOut)
async def get_institutions(session: AsyncSession = Depends(get_db)) -> dict:
    """The institution master (D-008) — starts empty; user-populated."""
    return {"institutions": await list_institutions(session)}


@router.post("/institutions", dependencies=[Depends(require_auth)], response_model=InstitutionWriteOut)
async def add_institution(payload: InstitutionIn, session: AsyncSession = Depends(get_db)) -> dict:
    try:
        inst = await get_or_create_institution(session, payload.name)  # resolve-or-create (Amendment F)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    await session.commit()
    return {"ok": True, "id": inst.id, "name": inst.name}


@router.post("/institutions/merge", dependencies=[Depends(require_auth)], response_model=MergeOut)
async def post_institution_merge(payload: MergeIn,
                                 session: AsyncSession = Depends(get_db)) -> dict:
    """User-driven merge (§9-2): fold the duplicate into the survivor, re-pointing both FK
    columns in one transaction. No fuzzy matching — the caller names both explicitly."""
    try:
        res = await merge_institutions(session, payload.survivor_id, payload.duplicate_id)
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    await session.commit()
    return {"ok": True, **res}


@router.patch("/institutions/{iid}", dependencies=[Depends(require_auth)],
              response_model=InstitutionWriteOut)
async def edit_institution(iid: int, payload: InstitutionIn,
                           session: AsyncSession = Depends(get_db)) -> dict:
    try:
        inst = await rename_institution(session, iid, payload.name)
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    await session.commit()
    return {"ok": True, "id": inst.id, "name": inst.name}


@router.delete("/institutions/{iid}", dependencies=[Depends(require_auth)], response_model=OkOut)
async def remove_institution(iid: int, session: AsyncSession = Depends(get_db)) -> dict:
    try:
        await delete_institution(session, iid)
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc  # FK-blocked: offers merge in plain language
    await session.commit()
    return {"ok": True}

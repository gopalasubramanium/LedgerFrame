# SPDX-License-Identifier: AGPL-3.0-or-later
"""Insurance (W3) — protection register. Reporting only, never advice."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_auth
from app.services.insurance import (
    create_policy,
    delete_policy,
    insurance_report,
    update_policy,
)

router = APIRouter()


class PolicyIn(BaseModel):
    name: str = Field(max_length=120)
    insurer: str | None = Field(default=None, max_length=120)
    policy_type: str = "other"
    policy_number: str | None = Field(default=None, max_length=80)
    insured_person: str | None = Field(default=None, max_length=120)
    cover_amount: float | None = None
    currency: str | None = Field(default=None, max_length=3)
    cash_value: float | None = None
    premium: float | None = None
    premium_frequency: str = "annual"
    start_date: str | None = None
    renewal_date: str | None = None
    nominee: str | None = Field(default=None, max_length=120)
    linked_goal_id: int | None = None
    documents: list[dict] | None = None
    notes: str | None = Field(default=None, max_length=2000)
    status: str = "active"


@router.get("/insurance")
async def list_insurance(entity_id: int | None = Query(default=None),
                         session: AsyncSession = Depends(get_db)) -> dict:
    # page-insurance §9-6. `entity_id` is REJECTED, not ignored: the register has no entity FK
    # (D-063, household by construction), so a scope param could only produce a precise-looking,
    # meaningless answer — the Policy/Scenarios household-scoped precedent.
    if entity_id is not None:
        raise HTTPException(400, "the insurance register is household-scoped: it cannot be filtered to one entity")
    return await insurance_report(session)


@router.post("/insurance", dependencies=[Depends(require_auth)])
async def add_insurance(payload: PolicyIn, session: AsyncSession = Depends(get_db)) -> dict:
    res = await create_policy(session, payload.model_dump())
    await session.commit()
    return {"ok": True, **res}


@router.patch("/insurance/{pid}", dependencies=[Depends(require_auth)])
async def edit_insurance(pid: int, payload: PolicyIn, session: AsyncSession = Depends(get_db)) -> dict:
    try:
        res = await update_policy(session, pid, payload.model_dump())
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc
    await session.commit()
    return {"ok": True, **res}


@router.delete("/insurance/{pid}", dependencies=[Depends(require_auth)])
async def remove_insurance(pid: int, session: AsyncSession = Depends(get_db)) -> dict:
    await delete_policy(session, pid)
    await session.commit()
    return {"ok": True}

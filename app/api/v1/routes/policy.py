# SPDX-License-Identifier: AGPL-3.0-or-later
"""Investment Policy endpoints (Phase 1): stored targets + live drift.

Read endpoints are open (like the rest of the read API); mutations are PIN-protected.
Drift is computed live and is strictly reporting — never a buy/sell recommendation.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_auth
from app.services.policy import (
    compute_drift,
    get_or_create_policy,
    policy_payload,
    replace_targets,
)

router = APIRouter()


class PolicyMetaIn(BaseModel):
    name: str | None = Field(default=None, max_length=80)
    base_currency: str | None = Field(default=None, max_length=3)
    default_band_pct: float | None = None
    max_position_pct: float | None = None      # null clears the concentration limit
    notes: str | None = Field(default=None, max_length=2000)


class TargetIn(BaseModel):
    dimension: str
    bucket: str = Field(max_length=40)
    target_pct: float
    min_pct: float | None = None
    max_pct: float | None = None


class TargetsIn(BaseModel):
    targets: list[TargetIn] = Field(default_factory=list, max_length=200)


@router.get("/policy")
async def get_policy(session: AsyncSession = Depends(get_db)) -> dict:
    policy = await get_or_create_policy(session)
    return policy_payload(policy)


@router.get("/policy/drift")
async def get_drift(entity_id: int | None = Query(default=None),
                    session: AsyncSession = Depends(get_db)) -> dict:
    """Live drift for the household. An entity filter is rejected: policy targets are
    household-wide, so drift for a single entity would compare it against a policy that is not
    its own."""
    # page-policy §9-21. Targets are household-global (one active policy, no entity FK), so scoping
    # the ACTUALS to one entity yields an answer that looks precise and means nothing. A silently
    # meaningless comparison is an API honesty trap — reject it, never ignore it. Per-entity
    # policies would be a data-model change (ROADMAP R-33).
    if entity_id is not None:
        raise HTTPException(400, "policy is household-scoped: drift cannot be filtered to one entity")
    return await compute_drift(session)


@router.put("/policy", dependencies=[Depends(require_auth)])
async def put_policy(payload: PolicyMetaIn, session: AsyncSession = Depends(get_db)) -> dict:
    from decimal import Decimal

    policy = await get_or_create_policy(session)
    if payload.name is not None:
        policy.name = payload.name.strip()[:80] or "Investment Policy"
    if payload.base_currency is not None:
        bc = payload.base_currency.strip().upper()
        policy.base_currency = bc or None
    if payload.default_band_pct is not None:
        if not 0 <= payload.default_band_pct <= 100:
            raise HTTPException(400, "The default band must be between 0 and 100%.")
        policy.default_band_pct = Decimal(str(payload.default_band_pct))
    # max_position_pct: a value sets the limit; explicitly clearing it is done via 0/None.
    if payload.max_position_pct is not None:
        if payload.max_position_pct <= 0:
            policy.max_position_pct = None
        elif payload.max_position_pct > 100:
            raise HTTPException(400, "The concentration limit must be between 0 and 100%.")
        else:
            policy.max_position_pct = Decimal(str(payload.max_position_pct))
    if payload.notes is not None:
        policy.notes = payload.notes.strip()[:2000] or None
    await session.flush()
    return policy_payload(policy)


@router.put("/policy/targets", dependencies=[Depends(require_auth)])
async def put_targets(payload: TargetsIn, session: AsyncSession = Depends(get_db)) -> dict:
    try:
        policy = await replace_targets(session, [t.model_dump() for t in payload.targets])
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return policy_payload(policy)

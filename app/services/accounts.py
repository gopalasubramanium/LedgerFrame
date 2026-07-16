# SPDX-License-Identifier: AGPL-3.0-or-later
"""Account / institution view (W7) — your wealth grouped by bank / broker / platform.

Reuses the existing Account model (name · institution · kind · currency) and groups the live
valuation by account. Reporting only. "Last activity" is derived from transactions (no
schema); nothing here changes how anything is priced.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.models import Account, Entity, Transaction
from app.services.confidence import score_holding
from app.services.institutions import get_or_create_institution
from app.services.portfolio import entity_account_filter, value_portfolio

ZERO = Decimal("0")
ACCOUNT_KINDS = ["brokerage", "bank", "retirement", "wallet", "property", "manual", "other"]


def _f(x: Decimal, p: int = 0) -> float:
    return float(round(x, p))


async def accounts_report(session: AsyncSession, entity_id: int | None = None) -> dict:
    base = get_settings().base_currency
    val = await value_portfolio(session, base, entity_id=entity_id)
    acc_q = select(Account).options(selectinload(Account.institution))  # name served via the join
    if entity_id is not None:  # §4.1: only this entity's accounts appear (incl. empty ones)
        acc_q = acc_q.where(Account.entity_id == entity_id)
    accounts = {a.id: a for a in (await session.execute(acc_q)).scalars()}
    la_q = (select(Transaction.account_id, func.max(Transaction.ts))
            .where(Transaction.deleted_at.is_(None)))  # §3.5 R11: ignore soft-deleted for last-activity
    la_ef = entity_account_filter(Transaction, entity_id)  # §4.1: no-op when entity_id is None
    if la_ef is not None:
        la_q = la_q.where(la_ef)
    last_act: dict[int | None, datetime | None] = {
        r[0]: r[1] for r in (await session.execute(la_q.group_by(Transaction.account_id))).all()}

    # account_id is None for account-less holdings (HoldingValue.account_id is int | None),
    # which groups under a "no account" bucket exactly as before.
    groups: dict[int | None, dict] = defaultdict(lambda: {
        "value": ZERO, "count": 0, "classes": defaultdict(lambda: ZERO),
        "currencies": set(), "stale": 0, "low": 0})
    for h in val.holdings:
        g = groups[h.account_id]
        g["value"] += h.market_value_base
        g["count"] += 1
        g["classes"][h.asset_class] += abs(h.market_value_base)
        if h.native_currency:
            g["currencies"].add(h.native_currency)
        if h.is_stale and h.symbol:
            g["stale"] += 1
        if h.market_value_base > 0 and score_holding(h)["confidence"] < 50:
            g["low"] += 1

    # Include accounts that exist but hold nothing yet (so a just-created account is visible).
    for acc_id in accounts:
        groups.setdefault(acc_id, {"value": ZERO, "count": 0, "classes": defaultdict(lambda: ZERO),
                                   "currencies": set(), "stale": 0, "low": 0})

    out = []
    for aid, g in groups.items():
        a = accounts.get(aid) if aid is not None else None
        classes = sorted(g["classes"].items(), key=lambda x: x[1], reverse=True)
        la = last_act.get(aid)
        out.append({
            "id": aid,
            "name": a.name if a else f"Account #{aid}",
            "institution": (a.institution.name if (a and a.institution) else None),
            "kind": a.kind if a else "brokerage",
            "currency": a.currency if a else base,
            "value": _f(g["value"]),
            "holdings": g["count"],
            "asset_classes": [c for c, _v in classes[:4]],
            "currencies": sorted(g["currencies"]),
            "stale": g["stale"],
            "low_confidence": g["low"],
            "last_activity": (la.date().isoformat() if la else None),
        })
    out.sort(key=lambda x: x["value"], reverse=True)
    return {"base_currency": base, "total": _f(val.total_value), "count": len(out),
            "accounts": out,
            "disclaimer": "Your holdings grouped by account / institution — reporting only. Base "
                          "values use current FX; 'last activity' is your latest recorded transaction."}


# --- account management --------------------------------------------------- #
def _account_dict(a: Account) -> dict:
    return {"id": a.id, "name": a.name,
            "institution": (a.institution.name if a.institution else None),
            "kind": a.kind, "currency": a.currency, "entity_id": a.entity_id}


async def _resolve_entity_id(session: AsyncSession, entity_id) -> int | None:
    """§9-4/D-064: an entity_id must reference a real entity, else an honest 400 (never a silent
    drop). None clears the assignment (account.entity_id is nullable — no ≥1-entity invariant)."""
    if entity_id is None:
        return None
    if await session.get(Entity, entity_id) is None:
        raise ValueError(f"No entity with id {entity_id} exists.")
    return entity_id


async def list_accounts(session: AsyncSession) -> list[dict]:
    rows = (await session.execute(
        select(Account).options(selectinload(Account.institution)).order_by(Account.name))).scalars().all()
    return [_account_dict(a) for a in rows]


async def list_entities(session: AsyncSession) -> list[dict]:
    """§4.7: enumerate ownership entities (id · name · kind) so the quarterly pack can render
    per-entity sections. Metadata enumeration only — no valuation, no recompute."""
    rows = (await session.execute(select(Entity).order_by(Entity.name))).scalars().all()
    return [{"id": e.id, "name": e.name, "kind": e.kind} for e in rows]


async def _resolve_institution(session: AsyncSession, raw_name):
    """Resolve a free-text institution NAME to a master row (resolve-or-create, Amendment F),
    or None when blank. Keeps the account/insurance editors working on a name until the
    Phase-1 MasterSelect swap (§9-1 write path)."""
    if not (raw_name and str(raw_name).strip()):
        return None
    return await get_or_create_institution(session, raw_name)


async def create_account(session: AsyncSession, data: dict) -> dict:
    a = Account(
        name=(data.get("name") or "Account").strip()[:120],
        kind=(data.get("kind") if data.get("kind") in ACCOUNT_KINDS else "brokerage"),
        currency=(data.get("currency") or get_settings().base_currency).upper()[:3],
    )
    a.institution = await _resolve_institution(session, data.get("institution"))
    if "entity_id" in data:
        a.entity_id = await _resolve_entity_id(session, data.get("entity_id"))
    session.add(a)
    await session.flush()
    return _account_dict(a)


async def update_account(session: AsyncSession, aid: int, data: dict) -> dict:
    a = await session.get(Account, aid)
    if a is None:
        raise LookupError("account not found")
    if data.get("name") and data["name"].strip():
        a.name = data["name"].strip()[:120]
    if "institution" in data:
        a.institution = await _resolve_institution(session, data.get("institution"))
    if "entity_id" in data:
        a.entity_id = await _resolve_entity_id(session, data.get("entity_id"))
    if data.get("kind") in ACCOUNT_KINDS:
        a.kind = data["kind"]
    if data.get("currency"):
        a.currency = data["currency"].upper()[:3]
    await session.flush()
    return _account_dict(a)


async def delete_account(session: AsyncSession, aid: int) -> None:
    """Refuse to delete an account that still has transactions — reassign them first
    (protects the ledger from orphaned holdings)."""
    n = (await session.execute(
        select(func.count()).select_from(Transaction).where(Transaction.account_id == aid))).scalar_one()
    if n:
        raise ValueError(f"account has {n} transaction(s) — reassign or remove them first")
    a = await session.get(Account, aid)
    if a is not None:
        await session.delete(a)

# SPDX-License-Identifier: AGPL-3.0-or-later
"""Entity CRUD (D-065; page-accounts §9-6 + Amendment H, §9-7).

Minimal: name + kind (from the ``entity_kind`` vocab). Amendment H — ``ENTITY_KINDS`` is the
single source (the ``policy_status`` pattern): the CRUD validates against it AND ``/refdata``
serves it, so the Entity model's inline comment is no longer the only home. §9-7 / D-029: there
is NO special "Household" — the lowest-id entity is renamable / re-kindable / deletable like any
other, under the same FK guard (no ``is_default`` flag, no ≥1-entity invariant).
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Account, Entity

# entity_kind vocab (MASTER-DATA §2; served by /refdata) — the single source (Amendment H).
ENTITY_KINDS = ["self", "spouse", "trust", "company", "other"]


def _entity_dict(e: Entity) -> dict:
    return {"id": e.id, "name": e.name, "kind": e.kind}


def _validate_kind(raw) -> str:
    if raw is None or raw == "":
        return "self"
    if raw not in ENTITY_KINDS:
        raise ValueError(f"kind must be one of {', '.join(ENTITY_KINDS)}.")
    return raw


async def create_entity(session: AsyncSession, data: dict) -> dict:
    e = Entity(name=(data.get("name") or "Entity").strip()[:80], kind=_validate_kind(data.get("kind")))
    session.add(e)
    await session.flush()
    return _entity_dict(e)


async def update_entity(session: AsyncSession, eid: int, data: dict) -> dict:
    e = await session.get(Entity, eid)
    if e is None:
        raise LookupError("entity not found")
    if data.get("name") and str(data["name"]).strip():
        e.name = str(data["name"]).strip()[:80]
    if "kind" in data and data.get("kind") is not None:
        e.kind = _validate_kind(data.get("kind"))
    await session.flush()
    return _entity_dict(e)


async def entity_reference_count(session: AsyncSession, eid: int) -> int:
    return (await session.execute(
        select(func.count()).select_from(Account).where(Account.entity_id == eid))).scalar_one()


async def delete_entity(session: AsyncSession, eid: int) -> None:
    """Blocked while any account references the entity — an honest served 400, enforced in the
    service (no DB cascade; the FK has no ondelete). The account-delete-guard precedent."""
    e = await session.get(Entity, eid)
    if e is None:
        raise LookupError("entity not found")
    n = await entity_reference_count(session, eid)
    if n:
        raise ValueError(
            f"This entity is assigned to {n} account(s). Reassign or remove those accounts before "
            f"deleting it.")
    await session.delete(e)

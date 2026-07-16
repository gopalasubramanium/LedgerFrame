# SPDX-License-Identifier: AGPL-3.0-or-later
"""Institution master (D-008; MASTER-DATA §6/§7) — the first user-extensible master-with-CRUD.

page-accounts §9-1 / Amendment F. Uniqueness is by a NORMALIZED name key (trimmed,
internal-whitespace-collapsed, case-insensitive); the stored display ``name`` keeps the
FIRST-SEEN casing. Create is **resolve-or-create** (an exact case/whitespace variant returns
the existing row), so it doubles as the upsert the account/insurance write paths call
(commit 3). Fuzzy variants ("DBS" vs "DBS Bank") are USER-DRIVEN merge only (§9-2, commit 2).
"""

from __future__ import annotations

from sqlalchemy import inspect as sa_inspect
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Institution

# Tables that FK into the master (columns land in commit 3). The delete guard counts across both.
_REFERENCING_TABLES = ("accounts", "insurance_policy")


def normalize_institution_name(raw: str | None) -> tuple[str, str]:
    """Return ``(display, key)``: the display name is trimmed with internal whitespace
    collapsed to single spaces (casing preserved); the key is that, casefolded. Amendment F."""
    display = " ".join((raw or "").split())[:120]
    return display, display.casefold()


def _institution_dict(i: Institution) -> dict:
    return {"id": i.id, "name": i.name}


async def list_institutions(session: AsyncSession) -> list[dict]:
    rows = (await session.execute(select(Institution).order_by(Institution.name))).scalars().all()
    return [_institution_dict(i) for i in rows]


async def get_or_create_institution(session: AsyncSession, raw_name: str | None) -> Institution:
    """Resolve an existing master row by normalized key, else create one (first-seen casing).
    This is the single write path the master POST and the account/insurance editors share."""
    display, key = normalize_institution_name(raw_name)
    if not display:
        raise ValueError("An institution name is required.")
    existing = (await session.execute(
        select(Institution).where(Institution.name_key == key))).scalars().first()
    if existing is not None:
        return existing
    inst = Institution(name=display, name_key=key)
    session.add(inst)
    await session.flush()
    return inst


async def rename_institution(session: AsyncSession, iid: int, raw_name: str | None) -> Institution:
    inst = await session.get(Institution, iid)
    if inst is None:
        raise LookupError("Institution not found.")
    display, key = normalize_institution_name(raw_name)
    if not display:
        raise ValueError("An institution name is required.")
    clash = (await session.execute(
        select(Institution).where(Institution.name_key == key, Institution.id != iid))).scalars().first()
    if clash is not None:
        raise ValueError(f'"{clash.name}" already exists — merge them instead of renaming onto it.')
    inst.name = display
    inst.name_key = key
    await session.flush()
    return inst


async def _fk_columns_present(session: AsyncSession) -> bool:
    """True once the ``institution_id`` FK columns exist (commit 3). Before then the master
    cannot be referenced by anything, so the delete guard is trivially satisfied — the guard
    code is built now (§9-1) and its RED path becomes reachable after commit 3."""
    def _check(sync_session) -> bool:
        insp = sa_inspect(sync_session.get_bind())
        return "institution_id" in {c["name"] for c in insp.get_columns("accounts")}
    return await session.run_sync(_check)


async def institution_reference_count(session: AsyncSession, iid: int) -> int:
    """How many accounts + insurance policies point at this institution (the FK guard)."""
    if not await _fk_columns_present(session):
        return 0
    total = 0
    for table in _REFERENCING_TABLES:
        total += (await session.execute(
            text(f"SELECT COUNT(*) FROM {table} WHERE institution_id = :i"), {"i": iid})).scalar_one()
    return total


async def delete_institution(session: AsyncSession, iid: int) -> None:
    """Delete blocked while any account/policy references it (§9-1; MASTER-DATA §7) — the honest
    served 400 offers merge instead (the account-delete-guard precedent)."""
    inst = await session.get(Institution, iid)
    if inst is None:
        raise LookupError("Institution not found.")
    n = await institution_reference_count(session, iid)
    if n:
        raise ValueError(
            f"This institution is still used by {n} account(s) or policy(ies). Reassign or merge "
            f"it into another institution before deleting it.")
    await session.delete(inst)

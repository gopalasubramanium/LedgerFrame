# SPDX-License-Identifier: AGPL-3.0-or-later
"""Planned contributions (W8) — recorded plans (SIPs, lump sums, withdrawals, prepayments).

Never a projection: we show a monthly-equivalent total and a combined 'planned cash-out',
but do NOT change the cash runway (a contribution builds wealth, it isn't consumption).
Reporting only.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.money import format_money_display
from app.models import Contribution
from app.services import fx
from app.services.runway import runway_report

ZERO = Decimal("0")
FREQUENCIES = ["monthly", "quarterly", "annual", "once"]
KINDS = ["invest", "withdraw", "prepay"]
# Monthly-equivalent multipliers ('once' is lumpy, not a monthly rate).
_FREQ_MONTHLY = {"monthly": Decimal("1"), "quarterly": Decimal("1") / 3,
                 "annual": Decimal("1") / 12, "once": ZERO}


def _dec(v) -> Decimal:
    try:
        return Decimal(str(v))
    except (InvalidOperation, ValueError, TypeError):
        return ZERO


async def _to_base(amount: Decimal, ccy: str, base: str) -> Decimal:
    if not amount or ccy == base:
        return amount or ZERO
    try:
        return await fx.convert(amount, ccy, base)
    except Exception:  # noqa: BLE001
        return amount


def _monthly(amount: Decimal, frequency: str) -> Decimal | None:
    """The per-row monthly rate — SERVER-SIDE (9-4). `once` has NO monthly rate: it returns None,
    not 0, because a served 0 would read as "this plan invests nothing per month"."""
    if frequency == "once":
        return None
    factor = _FREQ_MONTHLY.get(frequency)
    return None if factor is None else amount * factor


def _serialize(c: Contribution) -> dict:
    amount = _dec(c.amount)
    m_eq = _monthly(amount, c.frequency)
    return {"id": c.id, "name": c.name, "amount": float(amount),
            "amount_display": format_money_display(amount), "currency": c.currency,
            "frequency": c.frequency, "kind": c.kind, "target_goal_id": c.target_goal_id,
            "monthly_equivalent": None if m_eq is None else float(round(m_eq, 0)),
            "monthly_equivalent_display": None if m_eq is None else format_money_display(m_eq),
            "start_date": c.start_date, "active": bool(c.active), "note": c.note}


def _apply(c: Contribution, data: dict) -> None:
    if data.get("name") and data["name"].strip():
        c.name = data["name"].strip()[:120]
    if "amount" in data:
        c.amount = _dec(data["amount"])
    if data.get("currency"):
        # 9-6 — a categorical field references the master, never free text (the A9 defect class).
        from app.services.planning import validate_currency

        c.currency = validate_currency(data["currency"]) or c.currency
    if data.get("frequency") in FREQUENCIES:
        c.frequency = data["frequency"]
    if data.get("kind") in KINDS:
        c.kind = data["kind"]
    if "target_goal_id" in data:
        c.target_goal_id = data["target_goal_id"]
    if "start_date" in data:
        c.start_date = (data["start_date"] or None)
    if "active" in data:
        c.active = bool(data["active"])
    if "note" in data:
        c.note = (data["note"] or "").strip()[:2000] or None


async def create_contribution(session: AsyncSession, data: dict) -> dict:
    c = Contribution(name=(data.get("name") or "Contribution").strip()[:120],
                     currency=get_settings().base_currency)
    _apply(c, data)
    session.add(c)
    await session.flush()
    return _serialize(c)


async def update_contribution(session: AsyncSession, cid: int, data: dict) -> dict:
    c = await session.get(Contribution, cid)
    if c is None:
        raise ValueError("contribution not found")
    _apply(c, data)
    await session.flush()
    return _serialize(c)


async def delete_contribution(session: AsyncSession, cid: int) -> None:
    c = await session.get(Contribution, cid)
    if c is None:                       # 9-7b — honest 404, never a silent "ok" for nothing
        raise ValueError("That contribution no longer exists.")
    await session.delete(c)


async def contributions_report(session: AsyncSession) -> dict:
    base = get_settings().base_currency
    rows = (await session.execute(select(Contribution).order_by(Contribution.name))).scalars().all()
    monthly_invest = monthly_withdraw = ZERO
    for c in rows:
        if not c.active:
            continue
        m = (await _to_base(_dec(c.amount), c.currency, base)) * _FREQ_MONTHLY.get(c.frequency, ZERO)
        if c.kind == "withdraw":
            monthly_withdraw += m
        else:  # invest, prepay
            monthly_invest += m

    run = await runway_report(session)
    monthly_expense = _dec(run.get("monthly_expense", 0))
    return {
        "base_currency": base,
        "contributions": [_serialize(c) for c in rows],
        "monthly_invest": float(round(monthly_invest, 0)),
        "monthly_invest_display": format_money_display(monthly_invest),
        "monthly_withdraw": float(round(monthly_withdraw, 0)),
        "monthly_withdraw_display": format_money_display(monthly_withdraw),
        "monthly_net_investing": float(round(monthly_invest - monthly_withdraw, 0)),
        "monthly_net_investing_display": format_money_display(monthly_invest - monthly_withdraw),
        # A fuller liquidity picture WITHOUT changing the runway itself.
        "monthly_cash_out_with_expenses": float(round(monthly_expense + monthly_invest, 0)),
        "monthly_cash_out_with_expenses_display": format_money_display(monthly_expense + monthly_invest),
        "disclaimer": "Recorded plans, not projections. Contributions build wealth, so they do "
                      "not reduce the cash runway; shown here as planned cash movements only.",
    }

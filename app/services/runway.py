# SPDX-License-Identifier: AGPL-3.0-or-later
"""Cash runway (Phase 4a).

Liquid assets ÷ your recorded recurring **net** burn (recurring expenses − recurring
income), at today's FX. Honest when data is missing — no runway is invented without
recurring obligations. Reporting only, not a forecast of income and not advice.
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.money import format_money_display
from app.models import Obligation
from app.services import fx
from app.services.planning import MONTHLY_FACTOR, _add_months, _basis_values


def _q(v: Decimal, dp: int = 0) -> float:
    return float(round(v, dp))


async def runway_report(session: AsyncSession) -> dict:
    base, _net_worth, liquid = await _basis_values(session)
    obs = (await session.execute(select(Obligation))).scalars().all()

    monthly_expense = Decimal(0)
    monthly_income = Decimal(0)
    for o in obs:
        factor = MONTHLY_FACTOR.get(o.recurrence)
        if factor is None:                       # 'once' is lumpy, not a steady burn
            continue
        amt_base = await fx.convert(Decimal(o.amount), o.currency or base, base)
        monthly = amt_base * factor
        if (getattr(o, "kind", "expense") or "expense") == "income":
            monthly_income += monthly
        else:
            monthly_expense += monthly

    net_burn = monthly_expense - monthly_income
    if monthly_expense == 0 and monthly_income == 0:
        status = "no_data"
    elif net_burn <= 0:
        status = "positive"                      # income covers expenses — no drawdown
    else:
        status = "finite"

    runway_months = None
    runway_date = None
    if status == "finite" and net_burn > 0:
        months = liquid / net_burn
        runway_months = _q(months, 1)
        runway_date = _add_months(datetime.now(UTC).date(), int(min(months, Decimal(1200)))).isoformat()

    note = {
        "no_data": "Add recurring obligations (and income) to see a runway.",
        "positive": "Cash-flow positive — recorded income covers recurring expenses; liquid assets aren't being drawn down.",
        "finite": "At your recorded recurring net burn, your liquid assets would last this long.",
    }[status]

    return {
        "base_currency": base,
        "liquid": _q(liquid, 0),
        "liquid_display": format_money_display(liquid),
        "monthly_expense": _q(monthly_expense, 0),
        "monthly_expense_display": format_money_display(monthly_expense),
        "monthly_income": _q(monthly_income, 0),
        "monthly_income_display": format_money_display(monthly_income),
        "net_monthly_burn": _q(net_burn, 0),
        "net_monthly_burn_display": format_money_display(net_burn),
        "runway_months": runway_months,
        "runway_date": runway_date,
        "status": status,
        "note": note,
        "disclaimer": "Indicative — liquid assets ÷ your recorded recurring net burn, at today's FX. Not a forecast of income or advice.",
    }

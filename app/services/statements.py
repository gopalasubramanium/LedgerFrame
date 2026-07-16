# SPDX-License-Identifier: AGPL-3.0-or-later
"""Financial statements (W5) — income, fees, cash flow, and realised-vs-unrealised.

All derived from transactions already recorded (dividends, interest, deposits, withdrawals,
fees). Base-currency figures use *current* FX and are clearly caveated. Organisation for
review / your accountant — never tax or financial advice.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import Instrument, Transaction
from app.services import fx
from app.services.portfolio import entity_account_filter, value_portfolio
from app.services.tax import realised_gains_report

ZERO = Decimal("0")


async def _to_base(amount: Decimal | None, ccy: str, base: str) -> Decimal:
    if not amount:
        return ZERO
    if ccy == base:
        return amount
    try:
        return await fx.convert(amount, ccy, base)
    except Exception:  # noqa: BLE001 — best-effort; fall back to raw
        return amount


def _ty(t: Transaction) -> str:
    return t.type.value if hasattr(t.type, "value") else str(t.type)


def _f(x: Decimal, p: int = 0) -> float:
    return float(round(x, p))


async def statements_report(session: AsyncSession, year: int | None = None,
                            entity_id: int | None = None) -> dict:
    base = get_settings().base_currency
    st_q = select(Transaction).where(Transaction.deleted_at.is_(None))  # §3.5 R6: exclude soft-deleted
    st_ef = entity_account_filter(Transaction, entity_id)  # §4.1: no-op when entity_id is None
    if st_ef is not None:
        st_q = st_q.where(st_ef)
    txns = (await session.execute(st_q)).scalars().all()
    instr = {i.id: i for i in (await session.execute(select(Instrument))).scalars()}

    income_by_year: dict[int, dict] = defaultdict(lambda: {"dividend": ZERO, "interest": ZERO})
    fees_by_year: dict[int, dict] = defaultdict(lambda: {"commissions": ZERO, "taxes": ZERO})
    flow_by_year: dict[int, dict] = defaultdict(lambda: {"deposits": ZERO, "withdrawals": ZERO})
    inc_ccy: dict[int, dict] = defaultdict(lambda: defaultdict(lambda: ZERO))   # native, per year
    inc_sym: dict[int, dict] = defaultdict(lambda: defaultdict(lambda: ZERO))   # base, per year
    years: set[int] = set()
    now = datetime.now(UTC).replace(tzinfo=None)
    ttm_cut = now - timedelta(days=365)
    ttm_income = ZERO

    for t in txns:
        ts = t.ts.replace(tzinfo=None) if getattr(t.ts, "tzinfo", None) else t.ts
        yr = ts.year
        years.add(yr)
        ty = _ty(t)
        amt_base = await _to_base(t.amount, t.currency, base)
        # Fees & duty accrue from EVERY transaction's fee/tax fields.
        fees_by_year[yr]["commissions"] += await _to_base(t.fees, t.currency, base)
        fees_by_year[yr]["taxes"] += await _to_base(t.taxes, t.currency, base)

        if ty == "dividend":
            income_by_year[yr]["dividend"] += amt_base
            inc_ccy[yr][t.currency] += (t.amount or ZERO)
            in_row = instr.get(t.instrument_id) if t.instrument_id is not None else None
            sym = in_row.symbol if in_row else "—"
            inc_sym[yr][sym or "—"] += amt_base
            if ts >= ttm_cut:
                ttm_income += amt_base
        elif ty == "interest":
            income_by_year[yr]["interest"] += amt_base
            inc_ccy[yr][t.currency] += (t.amount or ZERO)
            inc_sym[yr]["Interest"] += amt_base
            if ts >= ttm_cut:
                ttm_income += amt_base
        elif ty == "deposit":
            flow_by_year[yr]["deposits"] += amt_base
        elif ty == "withdrawal":
            flow_by_year[yr]["withdrawals"] += amt_base
        elif ty == "fee":
            fees_by_year[yr]["commissions"] += abs(amt_base)

    years_sorted = sorted(years, reverse=True)
    yr = int(year) if year else (years_sorted[0] if years_sorted else now.year)

    inc = income_by_year.get(yr, {"dividend": ZERO, "interest": ZERO})
    income_total = inc["dividend"] + inc["interest"]
    fees_sel = fees_by_year.get(yr, {"commissions": ZERO, "taxes": ZERO})
    flow_sel = flow_by_year.get(yr, {"deposits": ZERO, "withdrawals": ZERO})

    # Realised (selected year, base at current FX) vs unrealised (open positions, now).
    realised = await realised_gains_report(session, year=yr, entity_id=entity_id)
    val = await value_portfolio(session, base, entity_id=entity_id)

    return {
        "base_currency": base,
        "years": years_sorted,
        "year": yr,
        # §14rp-1 (page-reports owner walk): the export date for the Unrealised (open-positions-now)
        # stat row — a now-snapshot is labelled explicitly AS-OF this date so it can never read as a
        # year figure inside a yearly artifact. ISO date (machine), rendered into the label by the CSV.
        "as_of": now.date().isoformat(),
        "income": {
            "dividend": _f(inc["dividend"]),
            "interest": _f(inc["interest"]),
            "total": _f(income_total),
            "ttm_total": _f(ttm_income),
            "by_currency": sorted(({"currency": c, "total": _f(v, 2)} for c, v in inc_ccy.get(yr, {}).items()),
                                  key=lambda x: abs(x["total"]), reverse=True),
            "by_symbol": sorted(({"symbol": s, "total": _f(v)} for s, v in inc_sym.get(yr, {}).items()),
                                key=lambda x: abs(x["total"]), reverse=True)[:12],
        },
        "fees": {
            "commissions": _f(fees_sel["commissions"]),
            "taxes": _f(fees_sel["taxes"]),
            "total": _f(fees_sel["commissions"] + fees_sel["taxes"]),
            "by_year": [{"year": y, "commissions": _f(v["commissions"]), "taxes": _f(v["taxes"]),
                         "total": _f(v["commissions"] + v["taxes"])}
                        for y, v in sorted(fees_by_year.items(), reverse=True)],
        },
        "cashflow": {
            "deposits": _f(flow_sel["deposits"]),
            "withdrawals": _f(flow_sel["withdrawals"]),
            "net": _f(flow_sel["deposits"] + flow_sel["withdrawals"]),
            "by_year": [{"year": y, "deposits": _f(v["deposits"]), "withdrawals": _f(v["withdrawals"]),
                         "net": _f(v["deposits"] + v["withdrawals"])}
                        for y, v in sorted(flow_by_year.items(), reverse=True)],
        },
        "income_by_year": [{"year": y, "dividend": _f(v["dividend"]), "interest": _f(v["interest"]),
                            "total": _f(v["dividend"] + v["interest"])}
                           for y, v in sorted(income_by_year.items(), reverse=True)],
        "realised_unrealised": {
            # §12rp-3 (page-reports gate condition): ONE TRUTH with the Realised P/L report. This
            # figure IS `realised_gains_report(...).base_realised_total_current_fx` (the call above),
            # so it must render byte-identical to the realised card/export — serve it at the SAME 2dp
            # precision, never re-rounded to whole units (a `_f` default-p=0 would drop the cents and
            # disagree on-screen: 14,820 vs 14,820.37). Pinned by test_statements_realised_equals_...
            "realised": _f(Decimal(str(realised.get("base_realised_total_current_fx", 0))), 2),
            "unrealised": _f(val.unrealised_pl),
        },
        "disclaimer": "Organisation for review / your accountant — not tax or financial advice. "
                      "Base-currency figures use current FX and are indicative, not for filing.",
    }


def statements_csv(rep: dict) -> str:
    """A flat 'accountant pack' CSV: income, fees and cash flow by year."""
    import csv
    import io

    buf = io.StringIO()
    w = csv.writer(buf)
    base = rep["base_currency"]
    # §12rp-1 (page-reports gate ruling): the Year control scopes BOTH the on-screen Realised stat
    # AND this export, so the SELECTED YEAR must reach the artifact — otherwise the control governs a
    # file it cannot change (the failure mode the owner named: "a control must clearly indicate what
    # it governs"). The by-year rollup below stays ALL-YEARS (the historical rollup is the value);
    # the year scopes the TITLE + the selected-year summary block, not the rollup.
    year = rep.get("year")
    year_tag = f" — {year}" if year else ""
    w.writerow([f"LedgerFrame statements{year_tag} (base {base}, current FX — indicative, not for filing)"])
    # §9-5 (page-reports, honesty): the export previously carried ONLY the top-line current-FX
    # caveat above; the fuller served D-077 disclaimer ("for your accountant / not tax or financial
    # advice") lived in the reader but never reached the file. Write it verbatim so the export
    # carries the same disclaimer the on-screen statements show.
    w.writerow([rep["disclaimer"]])
    # §12rp-1: the selected-year summary — the totals the Year control scopes (income / fees / cash
    # flow for that year). Defensive (.get) so the Phase-0 disclaimer pin, which passes a minimal rep,
    # still holds.
    inc = rep.get("income")
    fee = rep.get("fees")
    flow = rep.get("cashflow")
    if year and isinstance(inc, dict) and isinstance(fee, dict) and isinstance(flow, dict):
        w.writerow([])
        w.writerow([f"Selected year, {year}", "Dividends", "Interest", "Total"])
        w.writerow(["Income", inc.get("dividend"), inc.get("interest"), inc.get("total")])
        w.writerow([f"Selected year, {year}", "Commissions", "Taxes/duty", "Total"])
        w.writerow(["Fees", fee.get("commissions"), fee.get("taxes"), fee.get("total")])
        w.writerow([f"Selected year, {year}", "Deposits", "Withdrawals", "Net"])
        w.writerow(["Cash flow", flow.get("deposits"), flow.get("withdrawals"), flow.get("net")])
    # §14rp-1 (owner walk 2026-07-17): the Statements CARD renders Realised (selected year) and
    # Unrealised (open positions, now) — so the card's ARTIFACT must carry them too (an export mirrors
    # its section). Realised is the SAME one-derivation figure as realised-gains.csv (§12rp-3 —
    # statements derives it from realised_gains_report; ONE truth, rendered in two files, never a
    # second derivation), written as a YEAR-SCOPED row. Unrealised is a NOW-SNAPSHOT: it is labelled
    # explicitly AS-OF the export date so it can never read as a year figure inside this yearly
    # artifact. The values stay MACHINE NUMERICS (§14rp-2) — the base currency rides its own cell.
    ru = rep.get("realised_unrealised")
    if year and isinstance(ru, dict):
        as_of = rep.get("as_of")
        unreal_label = (f"Unrealised P/L (open positions, as of {as_of})" if as_of
                        else "Unrealised P/L (open positions, now)")
        w.writerow([])
        w.writerow([f"Realised P/L (selected year, {year})", ru.get("realised"), base])
        w.writerow([unreal_label, ru.get("unrealised"), base])
    w.writerow([])
    w.writerow(["Income by year", "Dividends", "Interest", "Total"])
    for r in rep["income_by_year"]:
        w.writerow([r["year"], r["dividend"], r["interest"], r["total"]])
    w.writerow([])
    w.writerow(["Fees by year", "Commissions", "Taxes/duty", "Total"])
    for r in rep["fees"]["by_year"]:
        w.writerow([r["year"], r["commissions"], r["taxes"], r["total"]])
    w.writerow([])
    w.writerow(["Cash flow by year", "Deposits", "Withdrawals", "Net"])
    for r in rep["cashflow"]["by_year"]:
        w.writerow([r["year"], r["deposits"], r["withdrawals"], r["net"]])
    return buf.getvalue()

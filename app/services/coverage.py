# SPDX-License-Identifier: AGPL-3.0-or-later
"""R-43 §12 step 7 — Build-history COVERAGE preflight (F-1).

F-1's root: ``run_backfill`` valued a 2019→2026 daily series against a price/FX store that barely
existed, with NO coverage check — so it built a square-pulse garbage line. This module reports, per
held instrument, what history actually exists on-stack: the earliest/latest real daily candle + its
count, and the per-currency FX coverage (from ``ecb_fx_history``). The trigger UI renders this
served summary so a build is never run blind, and step 8's refuse-until-coverage policy reads the
same derivation.

Every rendered value is a served display string (D-105); a genuinely-absent figure is null +
reasoned, never fabricated.
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import EcbFxHistory, Holding, Instrument, PriceHistory


def _iso_date(ts) -> str | None:
    """ISO YYYY-MM-DD from a stored ts (datetime) or as_of (str)."""
    if ts is None:
        return None
    if isinstance(ts, str):
        return ts[:10]
    return ts.date().isoformat() if hasattr(ts, "date") else str(ts)[:10]


async def _identifier(session: AsyncSession, instrument_id: int, id_type: str) -> str | None:
    from app.models import InstrumentIdentifier

    return (await session.execute(
        select(InstrumentIdentifier.value)
        .where(InstrumentIdentifier.instrument_id == instrument_id,
               InstrumentIdentifier.id_type == id_type)
    )).scalars().first()


async def _no_price_blocker(session: AsyncSession, instr, ac: str) -> str:
    """§17-R3 (F-6): the served reason WHY an instrument has no price history — it names the
    BLOCKER, never the 'run Build history' CTA the user just performed. The crypto case is F-6's
    exact defect: BTC/XRP were blocked on a missing CoinGecko mapping, yet served the build CTA."""
    from app.providers.market.router import CAPABILITIES, can_fetch_history, capabilities_for

    if ac == "crypto" and not await _identifier(session, instr.id, "coingecko_id"):
        return (f"No CoinGecko mapping for {instr.symbol} — pick the coin in the instrument picker, "
                "then Build history (it auto-resolves the canonical id when one clearly matches)")
    if ac == "mutual_fund" and not (
            await _identifier(session, instr.id, "amfi_code")
            or (instr.symbol or "").isdigit()):
        return (f"No AMFI scheme mapped for {instr.symbol} — map it to a scheme, then Build history")
    if not any(can_fetch_history(capabilities_for(name), ac) for name in CAPABILITIES):
        return f"No price provider supplies {ac or 'this asset'} history"
    # F-8: mappable and serveable, yet still empty — so acquisition was ATTEMPTED and failed. Its
    # recorded reason is the truth here; the build CTA would tell the user to redo what they just
    # did. This is the branch whose absence served BTC/XRP the generic CTA through every rebuild.
    from app.models import InstrumentAcquisition

    outcome = await session.get(InstrumentAcquisition, instr.id)
    if outcome is not None and not outcome.ok and outcome.reason:
        return outcome.reason
    # Genuinely not-yet-acquired (no attempt on record): the honest CTA.
    return "No price history yet — run Build history to acquire it"


async def _fx_span(session: AsyncSession, currency: str) -> tuple[str | None, str | None]:
    """Earliest/latest ecb_fx_history as_of for a currency (as ISO strings), or (None, None)."""
    row = (await session.execute(
        select(func.min(EcbFxHistory.as_of), func.max(EcbFxHistory.as_of))
        .where(EcbFxHistory.currency == currency.upper())
    )).one()
    return _iso_date(row[0]), _iso_date(row[1])


async def coverage_summary(session: AsyncSession, base_currency: str | None = None) -> dict:
    """Per-instrument + overall coverage of the on-stack price/FX history — the served Build-history
    preflight (F-1). Numbers match the store exactly (they are read from it)."""
    base = (base_currency or get_settings().base_currency or "SGD").upper()

    instruments = (await session.execute(
        select(Instrument).join(Holding, Holding.instrument_id == Instrument.id)
        .where(Holding.deleted_at.is_(None), Instrument.id.isnot(None)).distinct()
    )).scalars().all()

    fx_cache: dict[str, tuple[str | None, str | None]] = {}
    out: list[dict] = []
    covered_count = 0
    for instr in instruments:
        ac = instr.asset_class.value if hasattr(instr.asset_class, "value") else str(instr.asset_class or "")
        # A manual-priced instrument is carried at its manual valuation — it needs no market history
        # to be part of the date-aware series (it is carried flat), so it is covered by nature.
        if instr.is_manual_price:
            covered_count += 1
            out.append({
                "instrument_id": instr.id, "symbol": instr.symbol,
                "name": instr.name or instr.symbol, "asset_class": ac,
                "price_earliest": None, "price_latest": None, "price_days": 0,
                "needs_fx": False, "fx_currency": None, "fx_earliest": None, "fx_latest": None,
                "covered": True, "summary": "Manual valuation — no market history needed",
            })
            continue
        prow = (await session.execute(
            select(func.min(PriceHistory.ts), func.max(PriceHistory.ts), func.count())
            .where(PriceHistory.instrument_id == instr.id, PriceHistory.interval == "1d")
        )).one()
        p_earliest, p_latest, p_days = _iso_date(prow[0]), _iso_date(prow[1]), int(prow[2] or 0)

        pricing_ccy = (instr.pricing_currency or instr.currency or base).upper()
        needs_fx = pricing_ccy != base
        fx_earliest = fx_latest = None
        if needs_fx:
            if pricing_ccy not in fx_cache:
                fx_cache[pricing_ccy] = await _fx_span(session, pricing_ccy)
            fx_earliest, fx_latest = fx_cache[pricing_ccy]

        has_price = p_days > 0
        has_fx = (not needs_fx) or (fx_earliest is not None)
        covered = has_price and has_fx
        if covered:
            covered_count += 1

        # Served human summary (D-105) — the frontend renders it verbatim.
        if not has_price:
            summary = await _no_price_blocker(session, instr, ac)  # §17-R3: name the blocker
        elif needs_fx and not has_fx:
            summary = f"Prices {p_earliest}→{p_latest}, but no {pricing_ccy}→{base} FX history yet"
        elif needs_fx:
            summary = f"Prices {p_earliest}→{p_latest}; {pricing_ccy} FX {fx_earliest}→{fx_latest}"
        else:
            summary = f"Prices {p_earliest}→{p_latest}"
        if has_price:
            # F-8a: a SUCCESSFUL acquisition can still be short of the holding period (CoinGecko's
            # public API serves a bounded window). The span above is honest but does not say WHY it
            # starts where it does — the recorded note does, so the user is not left inferring.
            from app.models import InstrumentAcquisition

            note = await session.get(InstrumentAcquisition, instr.id)
            if note is not None and note.ok and note.reason:
                summary = f"{summary} — {note.reason}"

        out.append({
            "instrument_id": instr.id, "symbol": instr.symbol,
            "name": instr.name or instr.symbol, "asset_class": ac,
            "price_earliest": p_earliest, "price_latest": p_latest, "price_days": p_days,
            "needs_fx": needs_fx, "fx_currency": pricing_ccy if needs_fx else None,
            "fx_earliest": fx_earliest, "fx_latest": fx_latest,
            "covered": covered, "summary": summary,
        })

    total = len(out)
    all_covered = total > 0 and covered_count == total
    coverage_label = (
        "History is complete for every holding." if all_covered
        else f"History covers {covered_count} of {total} holding(s) — Build history to fill the rest."
        if total else "No holdings to build history for."
    )
    return {
        "base_currency": base,
        "instruments": out,
        "total": total, "covered_count": covered_count, "all_covered": all_covered,
        "coverage_label": coverage_label,
    }


# The served refusal a date-aware metric shows until the window has real coverage (§12-R1, D-105).
INSUFFICIENT_COVERAGE = "Insufficient price & FX history for this window — build history"


async def date_aware_computable(session: AsyncSession, base_currency: str | None = None) -> dict:
    """§12-R1 (F-2 REFUSE-UNTIL-COVERAGE): whether the date-aware series (TWR / period return /
    volatility / drawdown) is honestly computable. The threshold: every then-held holding has a
    real price within the §9-5 carry window AND per-date FX exists for its price currency → base.
    A headline risk metric is never computed from a series dominated by carried-from-nothing
    values (F-2's −99.93%). Returns ``{computable, reason, covered_count, total}`` — ``reason`` is
    the served refusal string when not computable, else None."""
    summ = await coverage_summary(session, base_currency)
    if summ["total"] == 0:
        return {"computable": False, "reason": INSUFFICIENT_COVERAGE,
                "covered_count": 0, "total": 0}
    computable = summ["all_covered"]
    return {"computable": computable,
            "reason": None if computable else INSUFFICIENT_COVERAGE,
            "covered_count": summ["covered_count"], "total": summ["total"]}

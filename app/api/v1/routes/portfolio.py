# SPDX-License-Identifier: AGPL-3.0-or-later
"""Portfolio: summary, holdings, transactions, CSV import, net-worth history."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from sqlalchemy import Float, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import PinConfirm, get_db, require_auth, require_pin, verify_fresh_pin
from app.core.config import get_settings
from app.core.money import (
    ZERO,
    D,
    format_money_display,
    format_price_display,
    format_signed_pct_display,
    money,
    to_display,
)
from app.core.provenance import cost_fx_basis_note, cost_fx_holding_note, valuation_label
from app.core.regions import region_of
from app.models import (
    Account,
    AssetClass,
    AuditEvent,
    Holding,
    Instrument,
    NetWorthSnapshot,
    Transaction,
    TxnType,
)
from app.schemas.common import ValuationMethod
from app.services import fx
from app.services.csv_import import (
    build_import_template,
    commit_import,
    export_transactions_csv,
    import_transactions_csv,
    preview_import,
)
from app.services.portfolio import (
    holdings_csv,
    rebuild_holdings_from_transactions,
    top_movers,
    value_portfolio,
)

router = APIRouter()

# §14rp-3 (page-reports owner walk 2026-07-17): the UTF-8 BOM. Excel decodes a BOM-less UTF-8 CSV as
# cp1252 and garbles an em dash in a disclaimer ("â€""); prefixing the BOM makes it decode UTF-8. The
# importer decodes utf-8-sig, so the BOM round-trips losslessly (transactions.csv / the template
# re-import cleanly). Guarded at the byte level by tests/integration/test_csv_encoding.py.
_UTF8_BOM = "\ufeff"


def _csv_response(body: str, filename: str) -> PlainTextResponse:
    """The ONE server home for every CSV export (D-050 / P-5): UTF-8 WITH a BOM (utf-8-sig) + the
    attachment disposition. Titles-human/data-machine + disclaimers-always are the builders' job;
    utf-8-sig-always is enforced here so no endpoint can forget it (DESIGN-SYSTEM §5.1)."""
    return PlainTextResponse(_UTF8_BOM + body, media_type="text/csv", headers={
        "Content-Disposition": f'attachment; filename="{filename}"'})


def _hv(h) -> dict:
    method = getattr(h, "valuation_method", ValuationMethod.MARKET_QUOTE.value)
    return {
        "id": h.holding_id, "label": h.label, "name": h.name, "symbol": h.symbol,
        "asset_class": h.asset_class, "quantity": to_display(h.quantity),
        # D-105: per-unit QUOTE price gets class-appropriate display precision (crypto → 6 sig figs);
        # market_value + the rest stay 2dp money (unaffected — this touches quote prices only).
        "currency": h.native_currency, "price": to_display(h.price),
        "price_display": format_price_display(h.price, h.asset_class),
        "market_value": to_display(h.market_value_base),
        "cost_basis": to_display(h.cost_basis_base),
        "unrealised_pl": to_display(h.unrealised_pl_base),
        "day_change": to_display(h.day_change_base),
        "day_change_pct": to_display(h.day_change_pct),
        # page-heatmap §12hm1-1: SERVED display strings for the tile readout (D-105 posture — the
        # frontend renders them verbatim, formats nothing). Null when the figure does not exist:
        # an unpriced value / an absent Today's change shows an em dash + reason, never a made-up 0.
        "market_value_display": format_money_display(h.market_value_base),
        "day_change_pct_display": format_signed_pct_display(h.day_change_pct),
        "is_stale": h.is_stale, "is_priced": h.is_priced,
        # §12-R2 (F-3 EXCLUSIONS ARE LOUD): the cost-basis FX honesty flags + excluded-lot count +
        # a SERVED reason string (D-105). Previously computed in the engine but serialized nowhere —
        # a 0-cost / value==P/L row read as fact. Recorded numbers are never rewritten; this only
        # names the honest omission. Null note on a fully-covered row (nothing rendered).
        "cost_fx_unavailable": getattr(h, "cost_fx_unavailable", False),
        "cost_fx_approximate": getattr(h, "cost_fx_approximate", False),
        "cost_fx_excluded_lots": getattr(h, "cost_fx_excluded_lots", 0),
        "cost_fx_note": cost_fx_holding_note(
            unavailable=getattr(h, "cost_fx_unavailable", False),
            approximate=getattr(h, "cost_fx_approximate", False),
            excluded_lots=getattr(h, "cost_fx_excluded_lots", 0),
        ),
        # Provenance: HOW this value was derived + a concise, honest label + the
        # real as-of timestamp (null when unpriced — never fabricated).
        "valuation_method": method,
        "valuation_label": valuation_label(ValuationMethod(method), is_stale=h.is_stale, price_available=True),
        "price_ts": h.price_ts.isoformat() if getattr(h, "price_ts", None) else None,
        # page-heatmap ND-8: listing country + its SERVER-DERIVED D-083 region bucket (no client
        # region map). `region` is total (unknown/absent country → "Other"); `country` may be null.
        "country": getattr(h, "country", None),
        "region": region_of(getattr(h, "country", None)),
    }


@router.get("/portfolio/summary")
async def portfolio_summary(entity_id: int | None = Query(default=None),
                            session: AsyncSession = Depends(get_db)) -> dict:
    base = get_settings().base_currency
    val = await value_portfolio(session, base, entity_id=entity_id)  # §4.1
    gainers, losers = top_movers(val)
    # Gross assets (positive holdings) vs liabilities (negative), so allocation weights are a
    # share of GROSS assets and the excluded liabilities are shown as an honest served figure
    # (donut footnote), never fabricated on the client (page-portfolio ND-4; GLOSSARY).
    gross_assets = val.gross_assets()   # the ONE denominator (A11) — same rule, one home
    liabilities = sum((h.market_value_base for h in val.holdings if h.market_value_base < 0), ZERO)
    # Cash & deposits KPI (D-054 / page-net-worth ND-3): immediately/near-term available cash =
    # the cash class + deposits (fixed_deposit). A served figure — the frontend renders the
    # string, never derives it (no client money math, P-1/GLOSSARY 'Cash & deposits').
    cash_and_deposits = sum(
        (h.market_value_base for h in val.holdings
         if h.market_value_base > 0 and (getattr(h, "asset_class", "") or "") in ("cash", "fixed_deposit")),
        ZERO,
    )
    return {
        "base_currency": base,
        "total_value": to_display(val.total_value),
        "gross_assets": to_display(gross_assets),
        "liabilities": to_display(liabilities),
        "cash_and_deposits": to_display(cash_and_deposits),
        "cost_basis": to_display(val.cost_basis),
        # §12-R2 (F-3): annotate the cost basis with the excluded-lot count so an incomplete basis
        # (which also distorts total_return's denominator) is never shown as complete. Served string
        # (D-105); null note + zero count on a fully-covered book.
        "cost_fx_excluded_lots": sum(getattr(h, "cost_fx_excluded_lots", 0) for h in val.holdings),
        "cost_basis_note": cost_fx_basis_note(
            excluded_lots=sum(getattr(h, "cost_fx_excluded_lots", 0) for h in val.holdings),
            approximate_holdings=sum(1 for h in val.holdings if getattr(h, "cost_fx_approximate", False)),
        ),
        "unrealised_pl": to_display(val.unrealised_pl),
        "day_change": to_display(val.day_change),
        "total_return_pct": to_display(val.total_return_pct),
        "has_stale": val.has_stale,
        "stale_count": sum(1 for h in val.holdings if h.is_stale),
        "allocation_by_class": {k: to_display(v) for k, v in val.allocation("asset_class").items()},
        "allocation_by_currency": {k: to_display(v) for k, v in val.allocation("native_currency").items()},
        "allocation_by_sector": {k: to_display(v) for k, v in val.sector_allocation().items()},
        "top_gainers": [_hv(h) for h in gainers],
        "top_losers": [_hv(h) for h in losers],
    }


class HoldingView(BaseModel):
    """Typed footprint of one holdings row (§9-6, D-050 contract hygiene). Money
    fields are display floats at the JSON boundary (`to_display`), nullable when
    unpriced."""
    id: int
    label: str | None = None
    name: str | None = None
    symbol: str | None = None
    asset_class: str | None = None
    quantity: float | None = None
    currency: str | None = None
    price: float | None = None
    price_display: str | None = None  # D-105 served display string (class-appropriate quote precision)
    market_value: float | None = None
    market_value_display: str | None = None  # §12hm1-1 served money display string (2dp, grouped)
    cost_basis: float | None = None
    unrealised_pl: float | None = None
    day_change: float | None = None
    day_change_pct: float | None = None
    day_change_pct_display: str | None = None  # §12hm1-1 served signed-percent display string
    is_stale: bool
    is_priced: bool
    # §12-R2 (F-3): cost-basis FX honesty — the flags + excluded-lot count + served reason string.
    cost_fx_unavailable: bool = False
    cost_fx_approximate: bool = False
    cost_fx_excluded_lots: int = 0
    cost_fx_note: str | None = None  # D-105 served reason (null when the basis is honestly complete)
    valuation_method: str | None = None
    valuation_label: str | None = None
    price_ts: str | None = None  # as-of ISO timestamp (null when unpriced)
    country: str | None = None   # ISO-3166 alpha-2 listing country (null when unknown)
    region: str | None = None    # D-083 six-bucket region, server-derived from country (page-heatmap ND-8)


class HoldingsResponse(BaseModel):
    base_currency: str
    holdings: list[HoldingView]


@router.get("/portfolio/holdings", response_model=HoldingsResponse)
async def portfolio_holdings(
    symbol: Annotated[str | None, Query()] = None,
    account_id: Annotated[int | None, Query()] = None,
    session: AsyncSession = Depends(get_db),
) -> dict:
    # ND-1 (Instrument Detail): `symbol` scopes the SAME canonical reader to one
    # instrument (P-3 — a scoped view is a filter of the reader, never a second code
    # path / no recompute). Empty list when the symbol is not held.
    # §9-11 + Amendment G: `account_id` scopes the SAME reader to one account's holdings
    # (the account rollup's drill-down target) — the identical filter-not-recompute posture as
    # `symbol`; each HoldingValue already carries `account_id`. Phase 0 ships the reader param
    # only; the Holdings-PAGE URL filter / clearable chip is Phase-1 work.
    base = get_settings().base_currency
    val = await value_portfolio(session, base)
    holdings = val.holdings
    if symbol:
        s = symbol.strip().upper()
        holdings = [h for h in holdings if (h.symbol or "").upper() == s]
    if account_id is not None:
        holdings = [h for h in holdings if h.account_id == account_id]
    return {"base_currency": base, "holdings": [_hv(h) for h in holdings]}


@router.get("/portfolio/holdings.csv", response_class=PlainTextResponse)
async def portfolio_holdings_csv(session: AsyncSession = Depends(get_db)) -> PlainTextResponse:
    """Server-side holdings CSV export (D-050 / P-5). The client never generates
    the file; cells are formula-injection sanitised in `holdings_csv`."""
    base = get_settings().base_currency
    val = await value_portfolio(session, base)
    return _csv_response(holdings_csv(val), "ledgerframe-holdings.csv")


@router.get("/portfolio/transactions.csv", response_class=PlainTextResponse)
async def portfolio_transactions_csv(session: AsyncSession = Depends(get_db)) -> PlainTextResponse:
    """Server-side transactions export (D-050 / P-5). Columns are exactly the import
    schema so this file re-imports losslessly (round-trip contract). FULL dataset —
    ignores the ledger's UI window; the client never generates the file."""
    return _csv_response(await export_transactions_csv(session), "ledgerframe-transactions.csv")


# R-63 §9-2 Delta 2.2 — served copy for each failure state. ⚠ PROPOSED (owner ratifies the exact
# wording at the 0a look; GLOSSARY-first). Held here, not invented at render time (D-105 — the
# frontend renders served copy verbatim). Names a FACT about pricing; no endpoint, no trade.
_FAILURE_NOTE_PROPOSED = {
    "throttled": "The data provider is rate-limiting requests — will retry.",
    "empty": "The provider returned no price for this symbol.",
    "errored": "Could not reach the data provider.",
    "parse_error": "The provider's response could not be read.",
    "unmapped": "Needs an identifier mapping before it can be priced.",
    "no_key": "The routed provider needs an API key this install does not hold.",
    "unsupported": "No configured source can price this instrument.",
}


def _routing_failure_state(diag) -> str | None:
    """The failure state derivable from ROUTING alone (no live call) — for a never-priced
    instrument with no persisted provider failure."""
    if diag is None:
        return None
    if diag.mapping_required:
        return "unmapped"
    if diag.auth_required:
        return "no_key"
    if diag.source_selected is None:
        return "unsupported"
    return None


def _failure_note_proposed(state: str | None, failure_at: str | None) -> str | None:
    """The PROPOSED served note for a failure state, with 'last at T' for a throttle (§9-9)."""
    if not state:
        return None
    note = _FAILURE_NOTE_PROPOSED.get(state)
    if note and state == "throttled" and failure_at:
        note = f"{note[:-1]} (last at {failure_at})."
    return note


@router.get("/portfolio/pricing-health")
async def pricing_health(session: AsyncSession = Depends(get_db)) -> dict:
    """Per-holding pricing diagnostics: valuation, method, source, entitlement,
    timestamp, staleness, status and any failure reason — the honest 'why is this
    number what it is' view. No secrets; read-only."""
    from collections import defaultdict

    from app.core.provenance import health_status as _status
    from app.core.provenance import valuation_label
    from app.models import Instrument
    from app.services.market import route_for_instrument

    base = get_settings().base_currency
    val = await value_portfolio(session, base)
    syms = [h.symbol for h in val.holdings if h.symbol]
    instr_by_sym = {
        i.symbol: i for i in (
            await session.execute(select(Instrument).where(Instrument.symbol.in_(syms)))
        ).scalars()
    } if syms else {}
    # R-63 §9-2 Delta 2.2: the persisted last-refresh FAILURE per instrument, so we can name the
    # distinct cause (throttled/empty/…) — and say when — WITHOUT a live call from this read.
    from app.models import Quote as QuoteRow
    _iids = [i.id for i in instr_by_sym.values()]
    fail_by_iid = {
        r.instrument_id: r for r in (await session.execute(
            select(QuoteRow.instrument_id, QuoteRow.last_failure_state,
                   QuoteRow.last_failure_at, QuoteRow.last_failure_reason)
            .where(QuoteRow.instrument_id.in_(_iids))
        )).all()
    } if _iids else {}
    from app.services.confidence import score_holding, summarise

    rows = []
    counts: dict[str, int] = defaultdict(int)
    scored: list = []
    for h in val.holdings:
        method = ValuationMethod(h.valuation_method)
        label = valuation_label(method, entitlement=h.entitlement, is_stale=h.is_stale, price_available=True)
        status = _status(method, entitlement=h.entitlement, is_stale=h.is_stale, price_available=True)
        reason = None
        if getattr(h, "fx_unavailable", False):
            # W-1b: a genuinely-unavailable FX rate — flagged honestly, distinct from a
            # missing quote. The value has a native price but no rate to state it in base.
            reason = f"FX rate unavailable — can't convert {h.native_currency} to {base}."
        elif method is ValuationMethod.ESTIMATED_VALUE:
            reason = "No live quote from the source — showing cost as a fallback."
        elif method is ValuationMethod.UNAVAILABLE:
            reason = "No value available from any configured source."
        instr = instr_by_sym.get(h.symbol) if h.symbol else None
        diag = await route_for_instrument(session, instr) if instr is not None else None
        if diag and diag.reason and not reason:
            reason = diag.reason
        # R-63 §9-2 Delta 2.2 — the TYPED failure state (never a flat "none"): the persisted
        # last-refresh cause if one is recorded, else derived from routing at request time. And
        # a served note (⚠ PROPOSED copy, held for the 0a look — GLOSSARY-first, Phase 4 rite).
        fail = fail_by_iid.get(instr.id) if instr is not None else None
        failure_state = (fail.last_failure_state if fail and fail.last_failure_state
                         else _routing_failure_state(diag))
        failure_at = (fail.last_failure_at.isoformat()
                      if fail and fail.last_failure_at else None)
        failure_note = _failure_note_proposed(failure_state, failure_at)
        counts[status] += 1
        conf = score_holding(h, mapping_required=bool(diag and diag.mapping_required))
        scored.append((abs(h.market_value_base), conf["confidence"]))
        rows.append({
            "id": h.holding_id, "symbol": h.symbol, "label": h.label,
            "asset_class": h.asset_class, "sector": h.sector,
            "exchange": h.exchange, "currency": h.native_currency,
            "native_price": to_display(h.price), "market_value": to_display(h.market_value_base),
            "valuation_method": h.valuation_method, "valuation_label": label, "status": status,
            "source": h.source, "entitlement": h.entitlement,
            "price_ts": h.price_ts.isoformat() if h.price_ts else None,
            "is_stale": h.is_stale, "failure_reason": reason,
            # §9-2 Delta 2.2: the typed cause + when + a PROPOSED served note (throttled/empty/…).
            "failure_state": failure_state, "failure_at": failure_at,
            "failure_note": failure_note,
            "source_override": h.source_override,
            # Phase A1: per-instrument routing decision.
            "route_lane": diag.lane if diag else "manual_only",
            "route_source": diag.source_selected if diag else "manual",
            "priority_chain": diag.priority_chain if diag else [],
            # §18-R4: the same chain per entry with its keyed state + SERVED annotation, so the
            # diagnostics modal can show "supported but unkeyed on this instance" instead of
            # letting a policy entry read as a phantom provider. Presentation only (D-072).
            "priority_chain_detail": [
                {"source": e.source, "keyed": e.keyed, "note": e.note}
                for e in (diag.priority_chain_detail if diag else [])
            ],
            "mapping_required": diag.mapping_required if diag else False,
            "auth_required": diag.auth_required if diag else False,
            # R-38 §9-10: which rule selected the source (override|matrix|lane|active).
            "route_rule": diag.route_rule if diag else "lane",
            # D1-c: the router's OWN reason (e.g. "awaiting NAV (refresh AMFI)"), served
            # distinct from failure_reason (which the generic UNAVAILABLE string masks) so
            # the diagnostics modal can surface it in the Routing block (D-105).
            "route_reason": diag.reason if diag else None,
            # Phase 2a: data confidence.
            **conf,
        })
    rows.sort(key=lambda r: (r["status"] != "Unavailable", r["status"] != "Estimated", r["label"]))
    # R-38 §9-8: the honest Alpha-Vantage tier string, served (never a fabricated real-
    # index label). Read the CACHED learned tier only — no probe, no egress from a read
    # endpoint. None unless the active provider is a non-premium AV key (grounded in
    # external.py). Index isn't a holdings lane, so this is the Markets-surface honesty
    # case surfaced here as provider context.
    from app.providers.market import get_provider
    from app.services.market import av_tier_note

    prov = get_provider()
    provider_tier_note = av_tier_note(
        getattr(prov, "name", None), getattr(prov, "av_tier", None))
    return {"base_currency": base, "holdings": rows, "summary": dict(counts),
            "confidence": summarise(scored), "provider_tier_note": provider_tier_note}


@router.post("/portfolio/pricing-health/{holding_id}/refresh", dependencies=[Depends(require_auth)])
async def refresh_holding(holding_id: int, session: AsyncSession = Depends(get_db)) -> dict:
    """Re-fetch one holding's quote through the router (respects its source). Manual
    holdings have nothing to fetch and report so."""
    from app.services.market import refresh_quote

    h = await session.get(Holding, holding_id)
    if h is None:
        raise HTTPException(404, "holding not found")
    if h.instrument_id is None:
        return {"ok": True, "refreshed": False, "reason": "manual holding — value is user-maintained"}
    instr = await session.get(Instrument, h.instrument_id)
    assert instr is not None  # FK guarantees the instrument row exists
    q = await refresh_quote(session, instr.symbol, instr.exchange)
    await rebuild_holdings_from_transactions(session)
    return {"ok": True, "refreshed": q.price is not None, "source": q.source,
            "price": to_display(q.price) if q.price is not None else None,
            "entitlement": q.entitlement.value if hasattr(q.entitlement, "value") else str(q.entitlement)}


@router.get("/portfolio/performance")
async def portfolio_performance(
    days: int = 365, benchmark: str = "SPY", include_manual: bool = False,
    entity_id: int | None = Query(default=None),
    session: AsyncSession = Depends(get_db),
) -> dict:
    from app.services.analytics import performance_series

    base = get_settings().base_currency
    data = await performance_series(
        session, base, max(7, min(days, 3650)), benchmark, include_manual=include_manual, entity_id=entity_id
    )
    data["base_currency"] = base
    return data


# Benchmarks the picker offers (symbol -> label). ETF proxies so live providers work.
_BENCHMARKS = {
    "SPY": "S&P 500", "QQQ": "Nasdaq 100", "DIA": "Dow 30",
    "EWS": "Singapore", "GLD": "Gold", "BTC": "Bitcoin",
}


@router.get("/portfolio/benchmarks")
async def list_benchmarks() -> dict:
    return {"benchmarks": [{"symbol": s, "label": label} for s, label in _BENCHMARKS.items()]}


@router.get("/portfolio/stats")
async def portfolio_stats(benchmark: str = "SPY", entity_id: int | None = Query(default=None),
                          session: AsyncSession = Depends(get_db)) -> dict:
    from app.services.analytics import key_stats

    return await key_stats(session, get_settings().base_currency, benchmark, entity_id=entity_id)


@router.get("/portfolio/attribution")
async def portfolio_attribution(
    days: int = 365, benchmark: str = "SPY", entity_id: int | None = Query(default=None),
    session: AsyncSession = Depends(get_db),
) -> dict:
    """§4.5 read-only return attribution + risk metrics. Wires the Unit A attribution engine and
    the Unit B risk metrics; both are entity-scoped and soft-delete-filtered inside those readers,
    and each returns its own honest 'unavailable' shape on thin data (never a 500). Same
    days/benchmark/entity_id params and clamping as the sibling readers."""
    from app.services.analytics import attribution, risk_metrics

    base = get_settings().base_currency
    window = max(7, min(days, 3650))
    return {
        "attribution": await attribution(session, base, window, entity_id=entity_id),
        "risk": await risk_metrics(session, base, window, benchmark, entity_id=entity_id),
    }


@router.get("/portfolio/attribution.csv", response_class=PlainTextResponse)
async def portfolio_attribution_csv(
    days: int = 365, entity_id: int | None = Query(default=None),
    session: AsyncSession = Depends(get_db),
) -> PlainTextResponse:
    """Server-side return-attribution CSV export (D-050 / P-5, page-portfolio §12-6b). The client
    never builds the file; every text cell is formula-injection sanitised. Rows are the per-holding
    contributions plus an explicit residual + the headline (which reconcile), matching the table."""
    import csv
    import io

    from app.services.analytics import attribution as attribution_reader
    from app.services.csv_import import sanitize_cell

    base = get_settings().base_currency
    window = max(7, min(days, 3650))
    attr = await attribution_reader(session, base, window, entity_id=entity_id)
    buf = io.StringIO()
    w = csv.writer(buf)
    # §9-5 (page-reports, honesty): the served disclaimer travels INTO the file — it exists in the
    # reader (`_ATTRIB_DISCLAIMER`) but was previously never written, so the export shed the very
    # "descriptive, not advice" caveat the on-screen table carries. Lead with it, then the table.
    w.writerow([sanitize_cell(attr.get("disclaimer") or "")])
    w.writerow([])
    # §14rp-2 (page-reports owner walk 2026-07-17): HUMAN column titles, not snake_case; the data cells
    # below stay machine numerics (raw contribution_pct number). A CSV must remain computable (D-105 is
    # a rendered-UI rule, not a data-artifact rule).
    w.writerow(["Holding", "Symbol", "Asset class", "Sector", "Contribution %"])
    if attr.get("available"):
        for h in attr.get("holdings", []):
            w.writerow([
                sanitize_cell(h.get("label") or ""), sanitize_cell(h.get("symbol") or ""),
                sanitize_cell(h.get("asset_class") or ""), sanitize_cell(h.get("sector") or ""),
                h.get("contribution_pct"),
            ])
        w.writerow(["Residual (income, realised, closed)", "", "", "", attr.get("residual_pct")])
        w.writerow(["Headline return", "", "", "", attr.get("headline_return_pct")])
    return _csv_response(buf.getvalue(), "attribution.csv")


class TransactionIn(BaseModel):
    account_id: int | None = None
    symbol: str | None = None
    type: TxnType
    ts: datetime
    quantity: float = 0
    price: float = 0
    fees: float = 0
    taxes: float = 0
    currency: str = "USD"
    note: str | None = None
    # Optional instrument metadata so a newly-created instrument is classified
    # correctly (asset class / country / display name), not defaulted to US equity.
    asset_class: AssetClass | None = None
    name: str | None = None
    exchange: str | None = None
    country: str | None = None
    # Merger recording (D-019): the "Absorbed into" target instrument B. The
    # merger form sets this (picker) plus the ratio in `price`; resolve_mergers
    # carries A's open position into B. Nullable — only meaningful for `merger`.
    related_instrument_id: int | None = None


def _naive_utc(dt: datetime) -> datetime:
    """Store timestamps as naive UTC for consistency with SQLite reads."""
    if dt.tzinfo is not None:
        return dt.astimezone(UTC).replace(tzinfo=None)
    return dt


def _txn_cash_impact(t: TransactionIn):
    """Signed cash impact, mirroring the CSV importer's convention."""
    gross = D(t.quantity) * D(t.price)
    costs = D(t.fees) + D(t.taxes)
    if t.type == TxnType.BUY:
        return -(gross + costs)
    if t.type == TxnType.SELL:
        return gross - costs
    if t.type in (TxnType.DIVIDEND, TxnType.INTEREST, TxnType.DEPOSIT):
        return gross - costs if gross else -costs
    if t.type in (TxnType.WITHDRAWAL, TxnType.FEE):
        return -(gross + costs) if gross else -costs
    return D(0)


# D-094: server-side sortable columns for the transactions ledger. Sort AND filter
# execute in SQL over the FULL dataset (never the loaded window) — the old 500-row
# silent cap is gone; the window is explicit and the response reports the total.
_TXN_SORT_COLS = {
    "ts": Transaction.ts,
    "type": Transaction.type,
    "amount": Transaction.amount,
    "quantity": Transaction.quantity,
    "price": Transaction.price,
    "currency": Transaction.currency,
    "symbol": Instrument.symbol,
    # Insertion order (id) — "recently added". Lets the UI surface just-imported
    # rows regardless of their (often historical) trade date after a CSV import.
    "added": Transaction.id,
}
# amount/quantity/price are stored as text (DecimalText); cast to numeric for
# ORDER BY so sorting is by value, not lexicographic ("9" would beat "10").
_TXN_NUMERIC_SORT = {"amount", "quantity", "price"}


@router.get("/portfolio/transactions")
async def list_transactions(
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
    sort: Annotated[str, Query()] = "ts",
    dir: Annotated[str, Query()] = "desc",
    filter: Annotated[str | None, Query()] = None,
    account_id: Annotated[int | None, Query()] = None,
    session: AsyncSession = Depends(get_db),
) -> dict:
    """The transactions ledger, windowed. D-094: sort + filter run server-side over
    the full non-deleted dataset; `total` reports its full size so the client can
    state "Showing X–Y of Z" and never silently truncate. Default: most-recent
    first. The full-dataset CSV export (statements/holdings, D-050) is unaffected —
    it ignores this window entirely."""
    sort_key = sort if sort in _TXN_SORT_COLS else "ts"
    descending = dir != "asc"
    col = _TXN_SORT_COLS[sort_key]

    # §3.5 R9: soft-deleted rows never appear in the ledger.
    conds = [Transaction.deleted_at.is_(None)]
    # §14ac-3 (Amendment G, transactions half): scope to one account at the SAME WHERE chokepoint the
    # count + the window both use, so "Showing X–Y of Z" and paging stay honest under the filter.
    if account_id is not None:
        conds.append(Transaction.account_id == account_id)
    q = (filter or "").strip()
    if q:
        like = f"%{q}%"
        conds.append(or_(
            Transaction.type.ilike(like),
            Transaction.currency.ilike(like),
            Transaction.note.ilike(like),
            Instrument.symbol.ilike(like),
        ))

    stmt = (
        select(Transaction, Instrument.symbol.label("symbol"), Instrument.name.label("name"))
        .outerjoin(Instrument, Transaction.instrument_id == Instrument.id)
        .where(*conds)
    )
    # Full filtered count — the honest denominator, computed before the window.
    total = (await session.execute(
        select(func.count()).select_from(stmt.subquery())
    )).scalar_one()

    order_col = cast(col, Float) if sort_key in _TXN_NUMERIC_SORT else col
    ordering = order_col.desc() if descending else order_col.asc()
    rows = (await session.execute(
        # id tiebreak keeps paging stable when the sort column ties.
        stmt.order_by(ordering, Transaction.id.desc()).limit(limit).offset(offset)
    )).all()

    out = []
    for t, symbol, name in rows:
        out.append({
            "id": t.id, "account_id": t.account_id, "symbol": symbol,
            "name": name if name and name != symbol else None,  # §14dr-19: name beside ticker (null when == symbol)
            "type": t.type.value if hasattr(t.type, "value") else str(t.type),
            "ts": t.ts.isoformat(),
            "quantity": to_display(D(t.quantity)), "price": to_display(D(t.price)),
            "fees": to_display(D(t.fees)), "taxes": to_display(D(getattr(t, "taxes", 0) or 0)),
            "amount": to_display(D(t.amount)), "currency": t.currency, "note": t.note,
            "related_instrument_id": t.related_instrument_id,  # D-019 merger target
        })
    return {
        "transactions": out,
        "total": int(total),
        "offset": offset,
        "limit": limit,
        "sort": sort_key,
        "dir": "desc" if descending else "asc",
        "filter": q,
    }


@router.post("/portfolio/transactions", dependencies=[Depends(require_auth)])
async def add_transaction(payload: TransactionIn, session: AsyncSession = Depends(get_db)) -> dict:
    from app.services.csv_import import _ensure_account, _ensure_instrument

    account = await _ensure_account(session, payload.account_id)
    instrument = await _ensure_instrument(
        session, payload.symbol.upper(), asset_class=payload.asset_class, name=payload.name,
        exchange=payload.exchange, country=payload.country,
    ) if payload.symbol else None
    # §4.2 Unit B: capture the live native→base rate as this trade's trade-date FX (write
    # only — nothing reads it yet). Only when ts is today (proximity guard); NULL for a
    # backdated trade or an unresolvable rate — never fabricated.
    ts = _naive_utc(payload.ts)
    fx_to_base, fx_base = await fx.capture_rate(payload.currency.upper(), get_settings().base_currency, ts)
    txn = Transaction(
        account_id=account.id,
        instrument_id=instrument.id if instrument else None,
        related_instrument_id=payload.related_instrument_id,  # D-019 merger target
        type=payload.type,
        ts=ts,
        quantity=D(payload.quantity), price=D(payload.price),
        fees=D(payload.fees), taxes=D(payload.taxes),
        amount=money(_txn_cash_impact(payload)),
        currency=payload.currency.upper(), note=payload.note,
        fx_to_base=fx_to_base, fx_base=fx_base,
    )
    session.add(txn)
    session.add(AuditEvent(category="mutation", action="add_transaction",
                           detail=f"{payload.type.value} {payload.symbol or ''}"))
    await session.flush()
    rebuilt = await rebuild_holdings_from_transactions(session)
    return {"ok": True, "transaction_id": txn.id, "holdings_rebuilt": rebuilt}


@router.put("/portfolio/transactions/{txn_id}", dependencies=[Depends(require_auth)])
async def update_transaction(
    txn_id: int, payload: TransactionIn, session: AsyncSession = Depends(get_db)
) -> dict:
    from app.services.csv_import import _ensure_account, _ensure_instrument

    txn = await session.get(Transaction, txn_id)
    if txn is None:
        raise HTTPException(404, "transaction not found")
    instrument = await _ensure_instrument(
        session, payload.symbol.upper(), asset_class=payload.asset_class, name=payload.name,
        exchange=payload.exchange, country=payload.country,
    ) if payload.symbol else None
    txn.instrument_id = instrument.id if instrument else None
    txn.related_instrument_id = payload.related_instrument_id  # D-019 merger target
    txn.type = payload.type
    txn.ts = _naive_utc(payload.ts)
    txn.quantity = D(payload.quantity)
    txn.price = D(payload.price)
    txn.fees = D(payload.fees)
    txn.taxes = D(payload.taxes)
    txn.amount = money(_txn_cash_impact(payload))
    txn.currency = payload.currency.upper()
    txn.note = payload.note
    # §9-4(c) — edit-path FX consistency. An edit that changes the currency or date invalidates
    # the stored trade-date rate (captured against the old pair), so RE-CAPTURE it exactly as the
    # add path does: today's live rate when ts is today, else honestly None (proximity guard) —
    # never a stale rate left over from before the edit. §2.5 gap: this was previously untouched.
    txn.fx_to_base, txn.fx_base = await fx.capture_rate(
        payload.currency.upper(), get_settings().base_currency, txn.ts)
    # §14dr-11 — re-scope the transaction's account. This is a PUT (full replace), so apply
    # account_id whenever the client SENT it (the old `if payload.account_id:` truthy guard
    # couldn't re-scope and swallowed the field). Resolve through `_ensure_account` exactly as
    # add does — `transactions.account_id` is NOT NULL, so a null/absent selection maps to the
    # default account (the add-flow bucket), never a constraint violation. Omitted → unchanged.
    if "account_id" in payload.model_fields_set:
        account = await _ensure_account(session, payload.account_id)
        txn.account_id = account.id
    session.add(AuditEvent(category="mutation", action="edit_transaction", detail=str(txn_id)))
    await session.flush()
    rebuilt = await rebuild_holdings_from_transactions(session)
    return {"ok": True, "holdings_rebuilt": rebuilt}


@router.post("/portfolio/reclassify", dependencies=[Depends(require_auth)])
async def reclassify(session: AsyncSession = Depends(get_db)) -> dict:
    """Fix asset class / country / mis-scraped names on existing instruments — infers
    from linked identifiers and a crypto-symbol heuristic. Safe & idempotent."""
    from app.services.market import reclassify_instruments

    result = await reclassify_instruments(session)
    session.add(AuditEvent(category="mutation", action="reclassify",
                           detail=f"reclassified={result['reclassified']} renamed={result['renamed']}"))
    await rebuild_holdings_from_transactions(session)
    return result


@router.delete("/portfolio/transactions/{txn_id}", dependencies=[Depends(require_auth)])
async def delete_transaction(txn_id: int, session: AsyncSession = Depends(get_db)) -> dict:
    txn = await session.get(Transaction, txn_id)
    if txn is None:
        raise HTTPException(404, "transaction not found")
    # §3.5 Unit C: soft-delete (set deleted_at) instead of removing the row, so an undo can
    # restore it. Unit B's R2 filter excludes it from the rebuild, so derived holdings
    # recompute exactly as if it had been hard-deleted.
    txn.deleted_at = datetime.now(UTC)
    session.add(AuditEvent(category="mutation", action="delete_transaction", detail=str(txn_id)))
    await session.flush()
    rebuilt = await rebuild_holdings_from_transactions(session)
    return {"ok": True, "holdings_rebuilt": rebuilt}


@router.post("/portfolio/transactions/{txn_id}/restore", dependencies=[Depends(require_auth)])
async def restore_transaction(txn_id: int, session: AsyncSession = Depends(get_db)) -> dict:
    """Undo a soft-delete: clear deleted_at so the txn re-enters the ledger + derived
    holdings. 404 if the id never existed; a no-op if the row is already live."""
    txn = await session.get(Transaction, txn_id)
    if txn is None:
        raise HTTPException(404, "transaction not found")
    txn.deleted_at = None
    session.add(AuditEvent(category="mutation", action="restore_transaction", detail=str(txn_id)))
    await session.flush()
    rebuilt = await rebuild_holdings_from_transactions(session)
    return {"ok": True, "holdings_rebuilt": rebuilt}


# --------------------------------------------------------------------------- #
# Manual assets & liabilities (cash, fixed deposits, property, private, loans).
# These carry a manual_value and are preserved across holdings rebuilds.
# --------------------------------------------------------------------------- #
class ManualHoldingIn(BaseModel):
    label: str
    asset_class: AssetClass = AssetClass.OTHER
    value: float
    currency: str = "SGD"
    account_id: int | None = None
    # Optional per-asset detail (FD rate/maturity, bond coupon, property valuation
    # date, retirement scheme, insurance policy, private ownership…). Stays null for
    # the simple "just a value" flow. Only whitelisted keys are persisted.
    meta: dict | None = None


# Optional metadata keys we accept per asset type — everything else is dropped, so a
# hostile/oversized payload can't bloat the row. Values are coerced to short strings.
_META_KEYS = {
    "fixed_deposit": ["principal", "rate", "start_date", "maturity_date", "payout_frequency",
                      "accrued_interest", "maturity_value", "issuer", "renewal_reminder"],
    "bond": ["issuer", "coupon", "maturity_date", "face_value", "clean_price", "dirty_price", "accrued_interest"],
    # D-091: `cost` (acquisition cost) added — a gap the per-class field spec found.
    "property": ["address", "valuation_date", "valuation_source", "next_review_date", "cost"],
    "retirement": ["scheme_name", "statement_date", "contribution_balance", "valuation_source"],
    "insurance": ["policy_type", "cash_value", "statement_date", "insurer"],
    # D-091: `round` (funding round) added — the other whitelist gap the field spec found.
    "private": ["company", "ownership", "valuation_date", "valuation_source", "next_review_date", "round"],
    "cash": ["issuer"],
    "other": ["valuation_date", "valuation_source", "note"],
}


def _clean_meta(asset_class, meta: dict | None) -> str | None:
    """Keep only whitelisted keys for the asset type, coerce to short strings, JSON."""
    import json

    if not meta:
        return None
    ac = asset_class.value if hasattr(asset_class, "value") else str(asset_class)
    allowed = set(_META_KEYS.get(ac, [])) | {"issuer", "valuation_date", "valuation_source", "note"}
    out = {}
    for k, v in meta.items():
        if k in allowed and v not in (None, ""):
            out[k] = str(v)[:120]
    return json.dumps(out) if out else None


async def _ensure_manual_account(session: AsyncSession) -> Account:
    acc = (
        await session.execute(select(Account).where(Account.kind == "manual"))
    ).scalars().first()
    if acc is None:
        acc = Account(name="Manual Assets", kind="manual", currency=get_settings().base_currency)
        session.add(acc)
        await session.flush()
    return acc


@router.get("/portfolio/manual-holdings")
async def list_manual_holdings(session: AsyncSession = Depends(get_db)) -> dict:
    rows = (
        await session.execute(  # §3.5 R8: don't list soft-deleted manual holdings in the editor
            select(Holding).where(Holding.manual_value.isnot(None)).where(Holding.deleted_at.is_(None)))
    ).scalars().all()
    import json

    def _meta(h):
        try:
            return json.loads(h.meta) if h.meta else None
        except (ValueError, TypeError):
            return None

    return {"holdings": [
        {
            "id": h.id, "label": h.label,
            "asset_class": h.asset_class.value if hasattr(h.asset_class, "value") else str(h.asset_class),
            "value": to_display(D(h.manual_value)), "currency": h.currency,
            "account_id": h.account_id, "meta": _meta(h),
        }
        for h in rows
    ]}


@router.post("/portfolio/manual-holdings", dependencies=[Depends(require_auth)])
async def add_manual_holding(payload: ManualHoldingIn, session: AsyncSession = Depends(get_db)) -> dict:
    account = (
        await session.get(Account, payload.account_id) if payload.account_id else None
    ) or await _ensure_manual_account(session)
    holding = Holding(
        account_id=account.id, label=payload.label, asset_class=payload.asset_class,
        quantity=D(1), avg_cost=D(payload.value), manual_value=D(payload.value),
        currency=payload.currency.upper(), meta=_clean_meta(payload.asset_class, payload.meta),
    )
    session.add(holding)
    session.add(AuditEvent(category="mutation", action="add_manual_holding", detail=payload.label))
    await session.flush()
    return {"ok": True, "id": holding.id}


@router.put("/portfolio/manual-holdings/{holding_id}", dependencies=[Depends(require_auth)])
async def update_manual_holding(
    holding_id: int, payload: ManualHoldingIn, session: AsyncSession = Depends(get_db)
) -> dict:
    h = await session.get(Holding, holding_id)
    if h is None or h.manual_value is None:
        raise HTTPException(404, "manual holding not found")
    h.label = payload.label
    h.asset_class = payload.asset_class
    h.avg_cost = D(payload.value)
    h.manual_value = D(payload.value)
    h.currency = payload.currency.upper()
    if payload.meta is not None:
        h.meta = _clean_meta(payload.asset_class, payload.meta)
    session.add(AuditEvent(category="mutation", action="edit_manual_holding", detail=str(holding_id)))
    await session.flush()
    return {"ok": True}


@router.delete("/portfolio/manual-holdings/{holding_id}", dependencies=[Depends(require_auth)])
async def delete_manual_holding(holding_id: int, session: AsyncSession = Depends(get_db)) -> dict:
    h = await session.get(Holding, holding_id)
    if h is None or h.manual_value is None:
        raise HTTPException(404, "manual holding not found")
    # §3.5 Unit C: soft-delete so an undo can restore it (Unit B's R1 filter excludes it
    # from valuation while deleted_at is set).
    h.deleted_at = datetime.now(UTC)
    session.add(AuditEvent(category="mutation", action="delete_manual_holding", detail=str(holding_id)))
    await session.flush()
    return {"ok": True}


@router.post("/portfolio/manual-holdings/{holding_id}/restore", dependencies=[Depends(require_auth)])
async def restore_manual_holding(holding_id: int, session: AsyncSession = Depends(get_db)) -> dict:
    """Undo a soft-delete: clear deleted_at so the manual holding is valued again. 404 if
    it never existed (or isn't a manual holding); a no-op if the row is already live."""
    h = await session.get(Holding, holding_id)
    if h is None or h.manual_value is None:
        raise HTTPException(404, "manual holding not found")
    h.deleted_at = None
    session.add(AuditEvent(category="mutation", action="restore_manual_holding", detail=str(holding_id)))
    await session.flush()
    return {"ok": True}


@router.post("/portfolio/purge-deleted", dependencies=[Depends(require_pin)])
async def purge_deleted(body: PinConfirm, session: AsyncSession = Depends(get_db)) -> dict:
    """Permanently hard-delete every soft-deleted holding and transaction ("empty trash").

    Irreversible and D-103-class: gated by ``require_pin`` (off API tokens / unprotected
    installs) AND a FRESH PIN (§14dr-20) — an ambient/unlocked session never satisfies it
    (SECURITY-BASELINE §3). Only rows with deleted_at set are removed — live rows are never
    touched. Purged rows were already excluded from every computation (Unit B), so a final
    rebuild keeps the derived-holdings invariant explicit."""
    await verify_fresh_pin(session, body.pin)
    dead_holdings = (await session.execute(
        select(Holding).where(Holding.deleted_at.isnot(None))
    )).scalars().all()
    dead_txns = (await session.execute(
        select(Transaction).where(Transaction.deleted_at.isnot(None))
    )).scalars().all()
    for h in dead_holdings:
        await session.delete(h)
    for t in dead_txns:
        await session.delete(t)
    session.add(AuditEvent(category="mutation", action="purge_deleted",
                           detail=f"holdings={len(dead_holdings)} transactions={len(dead_txns)}"))
    await session.flush()
    rebuilt = await rebuild_holdings_from_transactions(session)
    return {"ok": True, "holdings_purged": len(dead_holdings),
            "transactions_purged": len(dead_txns), "holdings_rebuilt": rebuilt}


class DeletedCount(BaseModel):
    holdings: int
    transactions: int
    total: int


@router.get("/portfolio/deleted-count", response_model=DeletedCount)
async def deleted_count(session: AsyncSession = Depends(get_db)) -> dict:
    """Count of soft-deleted rows awaiting purge — so the UI can hide the
    (PIN-gated) purge control at zero and show the count when non-empty."""
    from sqlalchemy import func

    hc = (await session.execute(
        select(func.count()).select_from(Holding).where(Holding.deleted_at.isnot(None))
    )).scalar_one()
    tc = (await session.execute(
        select(func.count()).select_from(Transaction).where(Transaction.deleted_at.isnot(None))
    )).scalar_one()
    return {"holdings": hc, "transactions": tc, "total": hc + tc}


@router.get("/portfolio/import/template", response_class=PlainTextResponse)
async def csv_template() -> PlainTextResponse:
    """D-096 — a downloadable sample CSV generated from the D-090 applicability
    matrix at request time (one example row per asset_class × permitted txn_type,
    valid vocabulary values, the exact import schema); can never drift from the
    contract, and is itself importable."""
    return _csv_response(build_import_template(), "ledgerframe-import-template.csv")


@router.post("/portfolio/import/csv", dependencies=[Depends(require_auth)])
async def import_csv(
    file: UploadFile = File(...),
    account_id: int | None = None,
    session: AsyncSession = Depends(get_db),
) -> dict:
    content = await file.read()
    try:
        result = await import_transactions_csv(session, content, account_id)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    session.add(AuditEvent(category="mutation", action="import_csv",
                           detail=f"{result['imported']} rows"))
    result["holdings_rebuilt"] = await rebuild_holdings_from_transactions(session)
    return result


@router.post("/portfolio/import/preview")
async def import_preview(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db),
) -> dict:
    """Validate + flag duplicates for an upload WITHOUT writing anything, so the user
    can review before committing. Non-mutating."""
    content = await file.read()
    try:
        return await preview_import(session, content)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.post("/portfolio/import/commit", dependencies=[Depends(require_auth)])
async def import_commit(
    file: UploadFile = File(...),
    account_id: int | None = None,
    skip_duplicates: bool = True,
    session: AsyncSession = Depends(get_db),
) -> dict:
    """Idempotent, atomic commit (re-importing the same file is a no-op). Skips
    duplicate rows by default."""
    content = await file.read()
    try:
        result = await commit_import(session, content, account_id, skip_duplicates=skip_duplicates)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    if result.get("imported"):
        result["holdings_rebuilt"] = await rebuild_holdings_from_transactions(session)
    return result


# R-43 §9-5 served reason for a carried-forward trend point (D-105 — the chart renders this
# verbatim; it never composes its own honesty copy).
_CARRIED_FORWARD_REASON = "Carried forward — a price or exchange rate was unavailable on this date."


@router.get("/net-worth/history")
async def net_worth_history(session: AsyncSession = Depends(get_db)) -> dict:
    """The unified net-worth trend — backfilled + live + manual points, each with served
    provenance and a §9-5 carried-forward flag/reason so the chart consumes served truth only."""
    rows = (
        await session.execute(select(NetWorthSnapshot).order_by(NetWorthSnapshot.ts))
    ).scalars().all()
    return {
        "history": [
            {"ts": r.ts.isoformat(), "assets": to_display(r.assets),
             "liabilities": to_display(r.liabilities), "net_worth": to_display(r.net_worth),
             "currency": r.base_currency,
             # §9-1 provenance (backfilled | live | manual) + §9-5 carried-forward marker.
             "source": r.source,
             "carried_forward": r.flags == "carried_forward",
             "reason": _CARRIED_FORWARD_REASON if r.flags == "carried_forward" else None}
            for r in rows
        ]
    }


# R-43 §9-2/§9-6: the net-worth backfill orchestrator + snapshot-now. Held refs so a
# fire-and-forget background task is not garbage-collected mid-run.
_backfill_tasks: set = set()


@router.post("/net-worth/backfill", dependencies=[Depends(require_auth)])
async def start_backfill() -> dict:
    """Start the historical net-worth backfill (§9-2 — the 'Build history' trigger). Runs
    backgrounded from already-cached price/FX (no provider call); the UI polls
    ``/net-worth/backfill-status``. Idempotent + refuses a concurrent run with a served reason."""
    import asyncio

    from app.services import backfill

    if backfill.is_running():
        return {"ok": False, "running": True,
                "message": "A backfill is already in progress."}
    base = get_settings().base_currency
    task = asyncio.create_task(backfill.run_backfill_background(base))
    _backfill_tasks.add(task)
    task.add_done_callback(_backfill_tasks.discard)
    return {"ok": True, "running": True, "message": "Building history…"}


@router.get("/net-worth/backfill-status")
async def backfill_status() -> dict:
    """Served progress of the backfill (running / done-of-total / current date / ok / failed)."""
    from app.services import backfill

    return backfill.read_status()


@router.get("/net-worth/coverage")
async def net_worth_coverage(session: AsyncSession = Depends(get_db)) -> dict:
    """§12 step 7 (F-1): the Build-history coverage preflight — per-instrument earliest/latest real
    candle + per-currency FX coverage + a served summary, so the trigger never runs blind against a
    zero-coverage store. Numbers are read straight from the store (they match it)."""
    from app.services.coverage import coverage_summary

    return await coverage_summary(session, get_settings().base_currency)


@router.post("/net-worth/snapshot", dependencies=[Depends(require_auth)])
async def take_snapshot(session: AsyncSession = Depends(get_db)) -> dict:
    """Write a dated net-worth snapshot now (§9-6, provenance=manual). Refused with a served
    reason (409) while a backfill is in flight — the dr-7 honest-disable pattern."""
    from app.services import backfill

    if backfill.is_running():
        raise HTTPException(409, "Backfill in progress — snapshot unavailable until it finishes.")
    return await backfill.snapshot_now(session, get_settings().base_currency)


@router.get("/net-worth/statement")
async def net_worth_statement(entity_id: int | None = Query(default=None),
                              session: AsyncSession = Depends(get_db)) -> dict:
    """Signed net-worth STATEMENT by asset class (D-033 / page-net-worth ND-4).

    An itemised balance: each asset class as a positive row, **liabilities negative**, and a
    **net total that reconciles to the Net worth headline** (`/portfolio/summary.total_value`).
    Deliberately distinct from `allocation_by_class` — allocation is a gross-asset WEIGHT
    (positive-only, liabilities excluded); the statement INCLUDES liabilities and nets to the
    headline. Statement ≠ allocation; the two are never interchanged. No client money math."""
    base = get_settings().base_currency
    val = await value_portfolio(session, base, entity_id=entity_id)
    rows = val.class_statement()
    gross = sum((v for c, v in rows if c != "liability"), ZERO)
    liab = sum((v for c, v in rows if c == "liability"), ZERO)
    return {
        "base_currency": base,
        "rows": [{"asset_class": c, "value": to_display(v)} for c, v in rows],
        "gross_assets": to_display(gross),
        "liabilities": to_display(liab),
        "net_worth": to_display(val.total_value),  # == summary.total_value (reconciles)
    }


@router.get("/portfolio/liquidity")
async def liquidity(entity_id: int | None = Query(default=None),
                    session: AsyncSession = Depends(get_db)) -> dict:
    """Graded liquidity ladder (Phase 3a) — how quickly the portfolio turns to cash."""
    from app.services.liquidity import liquidity_ladder

    return await liquidity_ladder(session, entity_id=entity_id)


@router.get("/portfolio/runway")
async def runway(session: AsyncSession = Depends(get_db)) -> dict:
    """Cash runway (Phase 4a) — liquid assets ÷ recurring net burn. Honest if no data."""
    from app.services.runway import runway_report

    return await runway_report(session)


@router.get("/portfolio/review")
async def review(session: AsyncSession = Depends(get_db)) -> dict:
    """Derived 'what needs a look' feed (Phase 4b) — reporting only, not advice."""
    from app.services.review import review_report

    return await review_report(session)


@router.get("/review")
async def review_page_ep(session: AsyncSession = Depends(get_db)) -> dict:
    """Review (D-030 — "Review Centre" retired to "Review") — one consolidated verdict per
    section + the attention list. Reporting only."""
    from app.services.review import review_centre

    return await review_centre(session)


@router.get("/review/history")
async def review_history_ep(session: AsyncSession = Depends(get_db)) -> dict:
    from app.services.review import review_history

    return await review_history(session)


class ReviewLogIn(BaseModel):
    note: str | None = None
    next_review_date: str | None = None  # ISO yyyy-mm-dd


@router.post("/review/log", dependencies=[Depends(require_auth)])
async def review_log_ep(payload: ReviewLogIn, session: AsyncSession = Depends(get_db)) -> dict:
    """Record the current state as a review (W1 §4.10)."""
    from app.services.review import record_review

    res = await record_review(session, payload.note, payload.next_review_date)
    await session.commit()
    return {"ok": True, **res}


# --------------------------------------------------------------------------- #
# Phase 2b — realised gains & tax lots (organisation/reporting, NOT tax advice).
# --------------------------------------------------------------------------- #
@router.get("/portfolio/realised-gains")
async def realised_gains(year: int | None = Query(default=None),
                         long_term_days: int | None = Query(default=None, ge=0, le=3660),
                         entity_id: int | None = Query(default=None),
                         session: AsyncSession = Depends(get_db)) -> dict:
    from app.services.tax import realised_gains_report

    return await realised_gains_report(session, year=year, long_term_days=long_term_days, entity_id=entity_id)


@router.get("/portfolio/tax-lots")
async def tax_lots(long_term_days: int | None = Query(default=None, ge=0, le=3660),
                   entity_id: int | None = Query(default=None),
                   session: AsyncSession = Depends(get_db)) -> dict:
    from app.services.tax import tax_lots_report

    return await tax_lots_report(session, long_term_days=long_term_days, entity_id=entity_id)


@router.get("/portfolio/tax-lots.csv", response_class=PlainTextResponse)
async def tax_lots_export(long_term_days: int | None = Query(default=None, ge=0, le=3660),
                          entity_id: int | None = Query(default=None),
                          session: AsyncSession = Depends(get_db)) -> PlainTextResponse:
    """§9-4 (page-reports): server-side open-tax-lots CSV export (D-050 / P-5). Born with its
    disclaimer block (§9-5) — the served "organisation only, not tax advice" caveat travels into
    the file. Mirrors the realised-gains export; the client never builds the file."""
    from app.services.tax import tax_lots_csv, tax_lots_report

    report = await tax_lots_report(session, long_term_days=long_term_days, entity_id=entity_id)
    return _csv_response(tax_lots_csv(report), "tax-lots.csv")


@router.get("/portfolio/realised-gains.csv", response_class=PlainTextResponse)
async def realised_gains_export(year: int | None = Query(default=None),
                                long_term_days: int | None = Query(default=None, ge=0, le=3660),
                                entity_id: int | None = Query(default=None),
                                session: AsyncSession = Depends(get_db)) -> PlainTextResponse:
    from app.services.tax import realised_gains_csv, realised_gains_report

    report = await realised_gains_report(session, year=year, long_term_days=long_term_days, entity_id=entity_id)
    csv_text = realised_gains_csv(report)
    return _csv_response(csv_text, f'realised-gains-{report["year"]}.csv')


@router.get("/portfolio/scenarios")
async def scenarios(entity_id: int | None = Query(default=None),
                    session: AsyncSession = Depends(get_db)) -> dict:
    """Factual 'what if' stress scenarios on today's holdings — scenario, not forecast (W6)."""
    # page-scenarios §9-8. `entity_id` is REJECTED, not ignored: the asset shocks would scope to one
    # entity while the liquidity what-ifs stay household (runway/obligations have no entity scope), a
    # silently meaningless mix. A precise-looking, meaningless comparison is an API honesty trap.
    if entity_id is not None:
        raise HTTPException(400, "scenarios are household-scoped: they cannot be filtered to one entity")
    from app.services.scenarios import scenario_report

    return await scenario_report(session)


@router.get("/portfolio/tags")
async def portfolio_tags(entity_id: int | None = Query(default=None),
                         session: AsyncSession = Depends(get_db)) -> dict:
    """Allocation by user tag + every holding's tags (W8). Reporting only."""
    from app.services.tags import tag_allocation

    return await tag_allocation(session, entity_id=entity_id)


class HoldingTagsIn(BaseModel):
    tags: list[str] = Field(default_factory=list, max_length=16)


@router.put("/portfolio/holdings/{holding_id}/tags", dependencies=[Depends(require_auth)])
async def set_tags(holding_id: int, payload: HoldingTagsIn,
                   session: AsyncSession = Depends(get_db)) -> dict:
    from app.services.tags import set_holding_tags

    try:
        res = await set_holding_tags(session, holding_id, payload.tags)
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc
    await session.commit()
    return {"ok": True, **res}


@router.get("/portfolio/statements")
async def statements(year: int | None = Query(default=None),
                     entity_id: int | None = Query(default=None),
                     session: AsyncSession = Depends(get_db)) -> dict:
    """Income, fees, cash flow and realised-vs-unrealised — from recorded transactions.
    Organisation for review / your accountant, not tax advice (W5)."""
    from app.services.statements import statements_report

    return await statements_report(session, year=year, entity_id=entity_id)


@router.get("/portfolio/statements.csv", response_class=PlainTextResponse)
async def statements_export(year: int | None = Query(default=None),
                            entity_id: int | None = Query(default=None),
                            session: AsyncSession = Depends(get_db)) -> PlainTextResponse:
    from app.services.statements import statements_csv, statements_report

    rep = await statements_report(session, year=year, entity_id=entity_id)
    # §12rp-1 (page-reports): the selected year rides the filename too (parity with realised-gains),
    # so the Year control's scope is visible on the downloaded artifact, not only inside it.
    fname = f'ledgerframe-statements-{rep["year"]}.csv'
    return _csv_response(statements_csv(rep), fname)


@router.get("/portfolio/cost-of-ownership")
async def cost_of_ownership_report(year: int | None = Query(default=None),
                                   entity_id: int | None = Query(default=None),
                                   session: AsyncSession = Depends(get_db)) -> dict:
    """§4.6 read-only cost of ownership: recorded fees (a currency fact reused from the statements
    report) and an estimated ongoing cost (each instrument's expense ratio × current value), kept
    as two separate blocks with no blended total. Entity-scoped and soft-delete-filtered like the
    sibling readers; null-rate holdings are surfaced as unavailable, never counted as 0."""
    from app.services.cost_of_ownership import cost_of_ownership

    return await cost_of_ownership(session, get_settings().base_currency, year=year, entity_id=entity_id)

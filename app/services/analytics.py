# SPDX-License-Identifier: AGPL-3.0-or-later
"""Portfolio performance analytics.

Reconstructs a portfolio value series through the ONE date-aware valuation engine
(app.services.portfolio.value_portfolio with an as_of date), plus a benchmark series
indexed to the same starting value, and deterministic summary stats.

Honesty notes (▲-B / R-43 §9-7):
- The performance series and TWR value each date at its OWN price + per-date FX (the R-8
  store) — NOT the holding's currency at today's rate. This retired the forked valuation that
  carried the W-1 currency bug + current-FX-across-history drift (they now consume one engine).
- Manual assets (cash/property/etc.) have no market series; the net-worth view (include_manual)
  holds them flat at their current base value — their per-date history is genuinely unknown,
  never fabricated.
- Realised P/L / income here stay at current FX (a distinct surface; the trade-date-FX realised
  total is exposed alongside them). All values are deterministic; the AI layer never touches them.
"""

from __future__ import annotations

import logging
import statistics
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.money import ZERO, D, money, to_display
from app.models import Transaction as Txn
from app.schemas.common import ValuationMethod
from app.services import fx
from app.services.portfolio import compute_fifo, entity_account_filter, value_portfolio
from app.services.tax import fifo_report, resolve_mergers

log = logging.getLogger("ledgerframe")


# ── R-54 Phase 0-2b — term ids are DERIVED, never declared here ───────────────────────────────
#
# §9-B: *"analytics' `term_id` becomes the derived reverse index of the same table."* Until this
# delta these ids were 18 inline literals sitting beside the registry's copy — two sources for one
# fact, which is the defect the registry exists to end (F6). Phase 0-2a made that transitional
# state safe with a parity tripwire; this function replaces it, and the tripwire is deleted in the
# same delta that makes it obsolete.
#
# A metric with no registry row simply carries no `term_id`, exactly as before — `Positions` is the
# standing example. The key is OMITTED rather than set to None so the served shape is byte-identical
# to the literals it replaces: `{"term_id": None}` would be a new key on the wire.
def _with_term_ids(metrics: list[dict]) -> list[dict]:
    """Attach each metric's Help glossary entry from the ONE registry."""
    from app.services.figure_registry import term_id_for_label

    for m in metrics:
        term_id = term_id_for_label(m["label"])
        if term_id is not None:
            m["term_id"] = term_id
    return metrics


async def key_stats(session: AsyncSession, base_currency: str, benchmark: str = "SPY",
                    entity_id: int | None = None) -> dict:
    """A panel of deterministic portfolio metrics.

    Only computes what we can derive honestly from the data — no fabricated Sharpe
    ratio or bond durations (we have no risk-free rate / instrument durations). The
    return/volatility ratio is labelled as such, not as a true Sharpe. ``entity_id``
    optionally scopes to one ownership entity (§4.1); default is the whole portfolio.
    """
    from collections import defaultdict

    val = await value_portfolio(session, base_currency, entity_id=entity_id)
    total = val.total_value or D("1")
    # Gross assets (exclude liabilities) — the right denominator for weights and
    # concentration, so a large mortgage can't push a position above 100%.
    gross = sum((h.market_value_base for h in val.holdings if h.market_value_base > 0), ZERO) or D("1")

    # Realised P/L and income (dividends/interest) from the transaction ledger,
    # converted to base currency at current FX.
    ks_q = select(Txn).where(Txn.instrument_id.isnot(None)).where(Txn.deleted_at.is_(None))  # §3.5 R4
    ks_ef = entity_account_filter(Txn, entity_id)  # §4.1: no-op when entity_id is None
    if ks_ef is not None:
        ks_q = ks_q.where(ks_ef)
    txns = resolve_mergers((await session.execute(ks_q)).scalars().all(), base_currency)  # §4.3
    by_instr: dict[int, list[Txn]] = defaultdict(list)
    for t in txns:
        if t.instrument_id is None:  # excluded by the query above; guard narrows int | None -> int
            continue
        by_instr[t.instrument_id].append(t)
    realised = ZERO
    income = ZERO
    # §4.2 (additive): the NEW historical trade-date-FX realised total, per-leg, from the same
    # fifo_report events the realised-gains report uses — so the two surfaces never diverge.
    realised_historical = ZERO
    realised_fx_excluded = 0
    for group in by_instr.values():
        res = compute_fifo(group)
        ccy = group[0].currency or base_currency
        rate = await fx.get_rate(ccy, base_currency)
        realised += res.realised_pl * rate          # retained current-FX (unchanged)
        income += res.income * rate                 # retained current-FX (unchanged)
        events, _lots = fifo_report(group, base_currency)
        for e in events:
            gh = e.gain_base_historical
            if gh is None:
                realised_fx_excluded += 1
            else:
                realised_historical += gh

    # ⊖ R-54 F-2 (owner ruling 2026-07-22) — THE FOUR HARDCODED ALLOCATION BUCKETS ARE DELETED.
    # `weight("cash","fixed_deposit")` etc. omitted bond/retirement/other, so the four served
    # metrics summed to 92.1% — an untrue census, and rendered on NO surface (Portfolio takes only
    # the concentration metrics; Home/Net worth use per-class `allocation_by_class`). The census the
    # product actually shows is per-class (the donut, enum-complete, sums to 100), and the AI grounds
    # it through `allocation_facts` off that same source. The dead grouping is removed, not left
    # served-but-unrendered; the registry's allocation rows re-point to the per-class derivation.

    # Concentration.
    priced = sorted((h for h in val.holdings if h.market_value_base > 0),
                    key=lambda h: h.market_value_base, reverse=True)
    largest = priced[0] if priced else None
    top5 = sum((h.market_value_base for h in priced[:5]), ZERO)

    # ⊕ R-54 I-1 — XIRR is computed HERE, BEFORE the bounded (cancellable) perf/TWR calls below, on
    # purpose. The `txns` loop is the ONLY ORM-attribute access left in this function; the two bounded
    # calls are wrapped in `asyncio.wait_for`, whose wall-clock cancellation (which CPU contention
    # triggers even for this small, network-free work) lands MID-QUERY and poisons the session. The
    # timeout handlers recover it with `rollback()`, which EXPIRES ORM instances — and async SQLAlchemy
    # cannot implicitly re-load an expired attribute. So every read AFTER a possible rollback must be a
    # plain dataclass (`val`/`largest` are `@dataclass`, unaffected) or a fresh query (TWR) — never a
    # stale ORM object. Moving `txns`'s reads up front makes that invariant hold. (R-43 §18-F7d.)
    # Money-weighted return (XIRR) over the transaction-backed (market) portfolio. Manual/statement
    # assets are excluded — they have no dated cost flow — so this is the IRR of the invested cash
    # flows plus the current invested value. Returns None ("not applicable") when the cash-flow history
    # is too thin to be meaningful.
    from datetime import date as _date

    from app.core.xirr import xirr as _xirr

    def _signed_flow(t) -> Decimal:
        # Money-in is negative, money-out/income positive — independent of how the
        # ledger stored ``amount`` (demo rows store it unsigned).
        gross = D(t.quantity) * D(t.price)
        costs = D(t.fees) + D(getattr(t, "taxes", 0) or 0)
        ty = t.type.value if hasattr(t.type, "value") else str(t.type)
        if ty == "buy":
            return -(gross + costs)
        if ty == "sell":
            return gross - costs
        if ty in ("dividend", "interest", "deposit"):
            return (gross - costs) if gross else -costs
        if ty in ("withdrawal", "fee"):
            return -(gross + costs) if gross else -costs
        return ZERO  # split/bonus/transfer: no cash flow

    flows: list[tuple[_date, float]] = []
    for t in txns:
        r = await fx.get_rate(t.currency or base_currency, base_currency)
        amt = float(_signed_flow(t) * r)
        if amt:
            flows.append((t.ts.date(), amt))
    invested_now = sum((h.market_value_base for h in val.holdings
                        if h.valuation_method != "manual_valuation"), ZERO)
    if invested_now > 0 and flows:
        flows.append((datetime.now(UTC).date(), float(invested_now)))
    xirr_pct = _xirr(flows)

    # §12-R1 (F-2 REFUSE-UNTIL-COVERAGE): the date-aware risk metrics (TWR / 1Y return / volatility
    # / drawdown) are computed from the per-date price+FX series. If the on-stack history doesn't
    # cover the window, that series is dominated by carried-from-nothing values and yields the
    # F-2 −99.93% garbage — so we REFUSE with a served state instead, never a fabricated number.
    from app.services.coverage import date_aware_computable

    cov = await date_aware_computable(session, base_currency)
    da_computable = cov["computable"]
    da_note = cov["reason"]  # the served refusal string when not computable (else None)

    # 1Y risk/return metrics from the invested performance series (best-effort —
    # never block the panel if the provider is slow/rate-limited). Skipped entirely when the
    # window isn't covered (no wasted per-date valuation, and no garbage to show).
    import asyncio

    ps: dict = {}
    if da_computable:
        try:
            perf = await asyncio.wait_for(
                performance_series(session, base_currency, 365, benchmark, entity_id=entity_id), timeout=14)
            ps = perf.get("stats") or {}
        except (TimeoutError, Exception):  # noqa: BLE001
            # ⊕ R-54 I-1 / R-43 §18-F7d — RECOVER THE SESSION. `wait_for` cancels its coroutine
            # mid-query when the wall-clock budget is exceeded; the cancellation leaves the transaction
            # invalid, and every later query (the TWR call below, and the downstream fact sources
            # `gather_facts` runs after this one) then raises PendingRollbackError — 500-ing the perf
            # card and the Ask "performance" answer. That was R-43 §18-F7d's "fails only under
            # contention" flake: a poisoned session, not a nulled metric. `rollback()` clears the invalid
            # state; nothing after it reads a stale ORM object (XIRR's `txns` reads are already done).
            ps = {}
            await session.rollback()
    # ⊕ R-54 F-8 (owner+architect ruling 2026-07-23, Guarantee-3). `or 0.0` conflated a MISSING
    # metric (empty `ps` — the perf series timed out / recovered above) with a genuine zero, so on a
    # real 14s perf-series timeout while the window IS covered (da_computable), `1Y return`,
    # `1Y volatility` and `Max drawdown (1Y)` all rendered a FABRICATED `0.00%` — TWR and the ratio
    # already dropped honestly. Keep None when absent so the established honest shape renders (the
    # frontend's `metricDisplay` → "—", the AI pack omits the None metric); a genuine 0.0 from a
    # populated `ps` still renders 0.00% as the real value it is.
    vol = ps.get("volatility_pct")
    ret = ps.get("return_pct")
    ret_vol = round(ret / vol, 2) if (ret is not None and vol) else None

    income_yield = float(income / total * 100) if total else 0.0

    # Time-weighted return (best-effort; None when history is too thin to be honest).
    import asyncio as _asyncio

    twr_pct = None
    if da_computable:
        try:
            twr_pct = await _asyncio.wait_for(time_weighted_return(session, base_currency), timeout=12)
        except (TimeoutError, Exception):  # noqa: BLE001
            # Same recovery as the perf series above (R-54 I-1) — a cancellation here also invalidates
            # the transaction; roll it back so the downstream fact sources don't inherit a poisoned
            # session. The return dict below reads only dataclasses and captured scalars, never ORM.
            twr_pct = None
            await session.rollback()

    return {
        "base_currency": base_currency,
        # §4.2 (additive): the SAME realised FX pair the realised-gains report exposes, under
        # identical field names, so the two surfaces never show divergent numbers. The
        # "Realised P/L" metric below is the retained current-FX figure, unchanged.
        "base_realised_total_current_fx": float(round(realised, 2)),
        "base_realised_total_historical_fx": float(round(realised_historical, 2)),
        "realised_fx_events_excluded": realised_fx_excluded,
        "metrics": _with_term_ids([
            {"label": "Gross assets", "value": to_display(val.total_value), "kind": "money"},
            {"label": "Unrealised P/L", "value": to_display(val.unrealised_pl), "kind": "money", "signed": True},
            {"label": "Realised P/L", "value": to_display(money(realised)), "kind": "money", "signed": True},
            {"label": "Income (div/int)", "value": to_display(money(income)), "kind": "money", "signed": True},
            {"label": "Income yield", "value": round(income_yield, 2), "kind": "pct"},
            # Total return rides the LIVE valuation (current quotes + current FX) — basis stated so it
            # never reads as the same basis as the date-aware metrics below (F-2's silent mixed basis).
            {"label": "Total return", "value": to_display(val.total_return_pct), "kind": "pct", "signed": True,
             "basis": "live"},
            {"label": "Money-weighted return (XIRR)", "value": xirr_pct, "kind": "pct", "signed": True,
             "note": "invested; annualised" if xirr_pct is not None else "not applicable"},
            # §12-R1: the date-aware metrics. When the window isn't covered they REFUSE with a served
            # state (value null + the served reason) — never the −99.93% garbage — and each carries
            # its basis label so the card never mixes a live and a date-aware basis silently.
            {"label": "Time-weighted return (TWR)", "value": twr_pct if da_computable else None, "kind": "pct", "signed": True,
             "basis": "date-aware", "note": da_note or ("invested; cumulative" if twr_pct is not None else "not applicable")},
            {"label": "1Y return", "value": ret if da_computable else None, "kind": "pct", "signed": True,
             "basis": "date-aware", "note": da_note},
            {"label": "1Y volatility", "value": vol if da_computable else None, "kind": "pct",
             "basis": "date-aware", "note": da_note},
            {"label": "Return / volatility", "value": ret_vol if da_computable else None, "kind": "ratio",
             "basis": "date-aware", "note": da_note},
            {"label": "Max drawdown (1Y)", "value": (ps.get("max_drawdown_pct") if da_computable else None), "kind": "pct", "signed": True,
             "basis": "date-aware", "note": da_note},
            # ⊖ F-2: the four hardcoded allocation-bucket metrics were removed here (see above).
            {"label": "Largest position", "value": (float(largest.market_value_base / gross * 100) if largest else 0.0), "kind": "pct",
             "note": largest.label if largest else None},
            {"label": "Top 5 concentration", "value": float(top5 / gross * 100), "kind": "pct"},
            {"label": "Positions", "value": len(val.holdings), "kind": "count"},
        ]),
    }


async def performance_series(
    session: AsyncSession,
    base_currency: str,
    days: int,
    benchmark: str = "SPY",
    include_manual: bool = False,
    entity_id: int | None = None,
) -> dict:
    """Performance of the *invested* portfolio (priced market holdings) vs a
    benchmark. Constant manual assets (cash/property) are excluded by default so
    the line reflects market movement; pass include_manual=True for a net-worth view.
    """
    from app.services.fx_history import load_historical_fx, needed_currencies
    from app.services.market import get_history_cached

    end = datetime.now(UTC)
    start = end - timedelta(days=days)

    # Time axis from the benchmark's daily candles (cached).
    bench_candles = await get_history_cached(session, benchmark, "1d", start, end)
    axis = [c.ts for c in bench_candles]
    if len(axis) < 2:
        return {"series": [], "benchmark": [], "benchmark_symbol": benchmark, "stats": None}

    # ▲-B (§9-7): value the invested portfolio through the ONE date-aware engine at each axis date,
    # so the line rides per-date price AND per-date FX. This retires the forked valuation that used
    # the HOLDING's currency (the W-1 bug) at TODAY's rate across all history (the current-FX drift).
    # Manual assets have no market series; for the net-worth view (include_manual) they ride flat at
    # their current base value (their history is genuinely unknown — never fabricated per-date).
    hist_fx = await load_historical_fx(session, list(await needed_currencies(session, base_currency)))

    manual_base = ZERO
    if include_manual:
        live = await value_portfolio(session, base_currency, warm=False, entity_id=entity_id)
        manual_base = sum((h.market_value_base for h in live.holdings
                           if h.valuation_method == ValuationMethod.MANUAL_VALUATION.value), ZERO)

    # Bound the work for very long windows: value at most _MAX as-of points, carrying the last
    # computed value forward across the skipped axis dates (a coarser sample of the same series,
    # never a fabricated figure). Logged, never silent (the no-silent-caps rule). The default
    # 365-day window is ~250 points → stride 1 (no downsample).
    _MAX = 500
    stride = max(1, (len(axis) + _MAX - 1) // _MAX)
    if stride > 1:
        log.info("performance_series: valuing every %dth of %d axis points (as-of budget)", stride, len(axis))
    portfolio_vals = [Decimal("0")] * len(axis)
    last = ZERO
    for i in range(len(axis)):
        if i % stride == 0 or i == len(axis) - 1:
            v = await value_portfolio(session, base_currency, warm=False,
                                      as_of=axis[i].date(), hist_fx=hist_fx, entity_id=entity_id)
            last = v.total_value + manual_base
        portfolio_vals[i] = last

    start_val = portfolio_vals[0] or Decimal("1")

    # Benchmark indexed to the portfolio's starting value.
    bench_first = D(bench_candles[0].close) or Decimal("1")
    bench_vals = [start_val * (D(c.close) / bench_first) for c in bench_candles]

    # Stats from daily returns of the portfolio series.
    series_f = [float(v) for v in portfolio_vals]
    daily_returns = [
        (series_f[i] - series_f[i - 1]) / series_f[i - 1]
        for i in range(1, len(series_f))
        if series_f[i - 1]
    ]
    peak = series_f[0]
    max_dd = 0.0
    for v in series_f:
        peak = max(peak, v)
        if peak:
            max_dd = min(max_dd, (v - peak) / peak)
    vol = statistics.pstdev(daily_returns) * (252 ** 0.5) * 100 if len(daily_returns) > 1 else 0.0
    ret_pct = (series_f[-1] / series_f[0] - 1) * 100 if series_f[0] else 0.0
    bench_ret = (float(bench_vals[-1]) / float(bench_vals[0]) - 1) * 100 if bench_vals[0] else 0.0

    return {
        "benchmark_symbol": benchmark,
        "series": [
            {"ts": axis[i].isoformat(), "value": to_display(portfolio_vals[i])}
            for i in range(len(axis))
        ],
        "benchmark": [
            {"ts": bench_candles[i].ts.isoformat(), "value": to_display(bench_vals[i])}
            for i in range(len(bench_candles))
        ],
        "stats": {
            "return_pct": round(ret_pct, 2),
            "benchmark_return_pct": round(bench_ret, 2),
            "excess_pct": round(ret_pct - bench_ret, 2),
            "max_drawdown_pct": round(max_dd * 100, 2),
            "volatility_pct": round(vol, 2),
            "best_day_pct": round(max(daily_returns) * 100, 2) if daily_returns else 0.0,
            "worst_day_pct": round(min(daily_returns) * 100, 2) if daily_returns else 0.0,
            "start_value": to_display(portfolio_vals[0]),
            "end_value": to_display(portfolio_vals[-1]),
        },
    }


async def time_weighted_return(session: AsyncSession, base_currency: str, days: int = 1825,
                               entity_id: int | None = None) -> float | None:
    """Time-weighted return of the transaction-backed portfolio, or None if not
    derivable. Reconstructs point-in-time holdings valued at cached historical prices
    and chain-links daily returns with each day's external (buy/sell) capital removed
    — so TWR reflects investment performance, not the timing of your contributions.
    Manual/statement assets are excluded (no price history). Values through the ONE date-aware
    engine (per-date price + FX — ▲-B §9-7), stride-capped so a long window stays responsive.
    Returns None on thin data."""
    from collections import defaultdict

    from app.core.twr import twr_from_flows
    from app.services.fx_history import load_historical_fx, needed_currencies

    twr_q = (select(Txn).where(Txn.instrument_id.isnot(None)).where(Txn.deleted_at.is_(None))  # §3.5 R5
             .order_by(Txn.ts))
    twr_ef = entity_account_filter(Txn, entity_id)  # §4.1: no-op when entity_id is None
    if twr_ef is not None:
        twr_q = twr_q.where(twr_ef)
    txns = (await session.execute(twr_q)).scalars().all()
    if len(txns) < 2:
        return None

    # SQLite returns naive datetimes; normalise so comparisons never mix tz-aware/naive.
    def _naive(dt: datetime) -> datetime:
        return dt.replace(tzinfo=None) if dt.tzinfo else dt

    end = datetime.now(UTC).replace(tzinfo=None)
    first = min(_naive(t.ts) for t in txns)
    start = max(first, end - timedelta(days=days))
    n = (end.date() - start.date()).days
    if n < 20:
        return None
    axis = [start + timedelta(days=i) for i in range(n + 1)]

    hist_fx = await load_historical_fx(session, list(await needed_currencies(session, base_currency)))

    # ▲-B (§9-7): each day's IN-WINDOW external capital in base at that day's PER-DATE FX (buys +,
    # sells −) — not the holding's currency at today's rate. Pre-window capital is already inside
    # values[0] (the engine reconstructs the full as-of position), so only in-window flows are
    # removed. A leg with no per-date rate is excluded (never valued at a fabricated rate).
    flow_by_day: dict = defaultdict(float)
    for t in txns:
        d = _naive(t.ts).date()
        if d < start.date() or d > end.date():
            continue
        r = hist_fx.rate(t.currency or base_currency, base_currency, d)
        if r is None:
            continue
        gross = float(D(t.quantity) * D(t.price) * r)
        if _is_buy(t):
            flow_by_day[d] += gross
        elif _is_sell(t):
            flow_by_day[d] -= gross

    # Value through the ONE date-aware engine (per-date price + FX), stride-capped for long windows;
    # flows are bucketed to the same strided steps so values and flows stay aligned (the forked
    # per-instrument valuation is DELETED — no second engine).
    _MAX = 500
    stride = max(1, (len(axis) + _MAX - 1) // _MAX)
    values: list[float] = []
    flows: list[float] = []
    bucket = 0.0
    for i, d in enumerate(axis):
        bucket += flow_by_day.get(d.date(), 0.0)
        if i % stride == 0 or i == len(axis) - 1:
            v = await value_portfolio(session, base_currency, warm=False,
                                      as_of=d.date(), hist_fx=hist_fx, entity_id=entity_id)
            values.append(float(v.total_value))
            flows.append(bucket)
            bucket = 0.0
    if len(values) < 2 or not any(v > 0 for v in values):
        return None
    return twr_from_flows(values, flows)


def _is_buy(t) -> bool:
    ty = t.type.value if hasattr(t.type, "value") else str(t.type)
    return ty == "buy"


def _is_sell(t) -> bool:
    ty = t.type.value if hasattr(t.type, "value") else str(t.type)
    return ty == "sell"


# ── §4.5 Unit A: return attribution (READ-ONLY analytics layered on existing data) ──────────
# Decomposes the portfolio's total return into per-holding contributions, rolled up to asset
# class and sector. It consumes value_portfolio + the same realised/income replay key_stats uses
# — it NEVER edits compute_fifo / fifo_report / resolve_mergers, and there is no schema change or
# money-path mutation. The honesty guarantee is an EXPLICIT residual: what a single-period
# price-based decomposition can't attribute per-holding (income, realised gains, positions closed
# in-period) is surfaced, not dropped, so Σ contributions + residual == the headline return.

_PP = Decimal("0.0001")   # contributions are reported to 4 dp of a percentage point

_ATTRIB_DISCLAIMER = (
    "Descriptive decomposition — not advice. A single-period, price-based approximation: each "
    "holding's contribution is its weight × its return on cost. Income, realised gains, and "
    "positions closed during the period are not attributed per-holding; they are surfaced "
    "together as an explicit residual, so the contributions plus the residual equal the total "
    "return exactly (nothing is dropped). Multi-period (Brinson) attribution is deferred."
)


def _unavailable(base_currency: str, days: int, reason: str) -> dict:
    """Thin-data shape (R3): no fabricated number, no crash — a clear 'not attributable' result,
    mirroring the None-on-thin-data ethos of the other analytics readers."""
    return {
        "available": False, "base_currency": base_currency, "window_days": days, "reason": reason,
        "headline_return_pct": None, "residual_pct": None, "cost_basis_base": None,
        "residual_breakdown": None, "holdings": [], "by_asset_class": [], "by_sector": [],
        "disclaimer": _ATTRIB_DISCLAIMER,
    }


def _attribute_core(holdings, total_unrealised: Decimal, total_cost: Decimal,
                    realised: Decimal, income: Decimal, base_currency: str, days: int) -> dict:
    """Pure single-period attribution (no IO), factored out so the decomposition and its
    reconciliation are deterministically testable.

    ``holdings`` are HoldingValue-like objects (``unrealised_pl_base``, ``asset_class``,
    ``sector``, ``label``, ``symbol``, ``holding_id``). A holding's contribution is its
    weight × its return on cost = ``(cost_i / total_cost) × (unrealised_i / cost_i)`` =
    ``unrealised_i / total_cost`` — computed directly so a zero-cost lot (e.g. bonus shares) is
    exact — reported as signed percentage points of the return. The ``residual`` = headline −
    Σ contributions is the explicit un-attributed remainder (income + realised gains + positions
    closed in-period); it is surfaced, never hidden, and ``Σ contributions + residual ==
    headline`` holds by construction (the residual absorbs exactly what the per-holding sum
    omits — defer, don't drop). Field names stay neutral (contributions, not 'winners'/'picks')."""
    from collections import defaultdict

    if total_cost is None or total_cost <= ZERO or not holdings:
        return _unavailable(base_currency, days, "insufficient cost basis to attribute a return")

    def _pp(x: Decimal) -> Decimal:
        return (x / total_cost * Decimal(100)).quantize(_PP)

    holdings_out: list[dict] = []
    ac_totals: dict[str, Decimal] = defaultdict(lambda: ZERO)
    sec_totals: dict[str, Decimal] = defaultdict(lambda: ZERO)
    contrib_sum = ZERO
    for h in holdings:
        c = _pp(h.unrealised_pl_base)
        contrib_sum += c
        ac_totals[h.asset_class] += c
        sec_totals[h.sector or "Unclassified"] += c   # null-safe: never dropped or mislabelled
        holdings_out.append({
            "holding_id": h.holding_id, "label": h.label, "symbol": h.symbol,
            "name": getattr(h, "name", None),   # §14dr-19: name beside the ticker (null when == symbol/placeholder)
            "asset_class": h.asset_class, "sector": h.sector,   # raw sector (bucket key handles null)
            "contribution_pct": float(c),
        })

    headline = ((total_unrealised + realised + income) / total_cost * Decimal(100)).quantize(_PP)
    residual = headline - contrib_sum          # defer-not-drop: the explicit un-attributed remainder
    holdings_out.sort(key=lambda r: (r["label"] or "", r["holding_id"]))   # neutral, deterministic order
    return {
        "available": True, "base_currency": base_currency, "window_days": days,
        "cost_basis_base": to_display(total_cost),
        "headline_return_pct": float(headline),
        "residual_pct": float(residual),
        # Indicative split of the residual (income vs realised); residual_pct above is the
        # authoritative reconciling figure. Both are in percentage points of the return.
        "residual_breakdown": {"income_pct": float(_pp(income)), "realised_pct": float(_pp(realised))},
        "holdings": holdings_out,
        "by_asset_class": [{"key": k, "contribution_pct": float(v)} for k, v in sorted(ac_totals.items())],
        "by_sector": [{"key": k, "contribution_pct": float(v)} for k, v in sorted(sec_totals.items())],
        "disclaimer": _ATTRIB_DISCLAIMER,
    }


async def _realised_income_base(session: AsyncSession, base_currency: str,
                                entity_id: int | None) -> tuple[Decimal, Decimal]:
    """Realised P/L and income (dividends + interest) in base currency at current FX — the SAME
    read-only ledger replay key_stats performs (it consumes compute_fifo's OUTPUT only; the
    FIFO/cost-basis money path is never mutated). Entity-scoped and soft-delete-filtered like the
    sibling readers, so attribution partitions identically."""
    from collections import defaultdict

    q = select(Txn).where(Txn.instrument_id.isnot(None)).where(Txn.deleted_at.is_(None))  # §3.5
    ef = entity_account_filter(Txn, entity_id)  # §4.1: no-op when entity_id is None
    if ef is not None:
        q = q.where(ef)
    txns = resolve_mergers((await session.execute(q)).scalars().all(), base_currency)  # §4.3 (read-only)
    by_instr: dict[int, list] = defaultdict(list)
    for t in txns:
        if t.instrument_id is None:
            continue
        by_instr[t.instrument_id].append(t)
    realised = ZERO
    income = ZERO
    for group in by_instr.values():
        res = compute_fifo(group)              # read-only: consume the engine's output, never mutate it
        rate = await fx.get_rate(group[0].currency or base_currency, base_currency)
        realised += res.realised_pl * rate
        income += res.income * rate
    return realised, income


async def attribution(session: AsyncSession, base_currency: str, days: int,
                      entity_id: int | None = None) -> dict:
    """§4.5 Unit A — read-only return attribution.

    Decomposes the portfolio's total return into per-holding contributions (signed percentage
    points of the return), rolled up to asset class and sector. Layered entirely on existing
    data: value_portfolio holdings for the price-based per-holding return, plus the same
    read-only realised/income replay key_stats uses. It never touches compute_fifo, fifo_report,
    or resolve_mergers beyond consuming their outputs — no schema change, no money-path mutation.

    Honesty: the decomposition is a single-period, price-based APPROXIMATION. What it cannot
    attribute per-holding (income, realised gains, positions closed in-period) is surfaced as an
    EXPLICIT residual — Σ contributions + residual == the headline total return, exactly. ``days``
    is accepted for API symmetry with the sibling readers; the current approximate method is
    since-inception (the windowed multi-period Brinson method is deferred). ``entity_id`` scopes
    to one ownership entity (§4.1); default (None) attributes the whole portfolio. Returns a clear
    'unavailable' shape on thin data (no holdings / non-positive cost basis), never a crash."""
    val = await value_portfolio(session, base_currency, entity_id=entity_id)
    if val.cost_basis is None or val.cost_basis <= ZERO or not val.holdings:
        return _unavailable(base_currency, days, "insufficient cost basis to attribute a return")
    realised, income = await _realised_income_base(session, base_currency, entity_id)
    return _attribute_core(val.holdings, val.unrealised_pl, val.cost_basis,
                           realised, income, base_currency, days)


# ── §4.5 Unit B: additional risk metrics (READ-ONLY, no risk-free rate) ──────────────────────
# Computed over the SAME performance series that already produces the shown volatility/drawdown
# (R7: single source of truth — we reuse performance_series' value series, never rebuild our own),
# plus a benchmark series where needed and current holdings for concentration. HARD RULE (as Unit
# A): the FIFO/cost-basis money path is never touched. Only metrics that need NO risk-free rate:
# beta, correlation, downside deviation, information ratio (benchmark-relative), HHI. Sharpe and
# Sortino are DELIBERATELY EXCLUDED — both require a risk-free rate this tool does not claim, and a
# zero-risk-free approximation would be a dishonest Sharpe (see the term-return-volatility term).

def _risk_unavailable(base_currency: str, days: int, benchmark_symbol: str | None) -> dict:
    return {
        "available": False, "base_currency": base_currency, "window_days": days,
        "benchmark_symbol": benchmark_symbol,
        "beta": None, "correlation": None, "downside_deviation": None,
        "information_ratio": None, "tracking_error": None, "hhi": None,
    }


def _risk_from_series(port_vals: list[float], bench_vals: list[float], market_values: list[float],
                      base_currency: str, days: int, benchmark_symbol: str | None) -> dict:
    """Pure risk metrics (no IO), factored out for deterministic testing.

    ``port_vals``/``bench_vals`` are the value series from performance_series (the single source
    of truth — daily returns are derived here, never an independently rebuilt series).
    ``market_values`` are current positive holding values (for HHI). Every metric needs NO
    risk-free rate. Benchmark-relative metrics (beta, correlation, information ratio) return None
    when no benchmark series is available; HHI and downside deviation do not need one. Thin data →
    None per metric (never a crash or a fabricated number), matching the other analytics readers.

    Annualisation (×√252) and % scaling mirror the existing volatility calc so downside deviation
    and tracking error read on the same scale as the shown 1Y volatility (R7)."""
    ann = 252 ** 0.5

    # Portfolio daily returns (same construction as performance_series' volatility input:
    # skip a step whose prior value is zero). Used for downside deviation.
    port_ret = [port_vals[i] / port_vals[i - 1] - 1
                for i in range(1, len(port_vals)) if port_vals[i - 1]]

    # Downside deviation: dispersion of the NEGATIVE returns only (a downside-risk measure — NOT
    # Sortino: no risk-free rate and no target-return excess). Zero when there is no downside.
    downside_deviation: float | None = None
    if port_ret:
        neg = [r for r in port_ret if r < 0]
        downside_deviation = round(statistics.pstdev(neg) * ann * 100, 2) if neg else 0.0

    # Paired portfolio/benchmark daily returns (aligned; a step needs both priors non-zero).
    pairs = [(port_vals[i] / port_vals[i - 1] - 1, bench_vals[i] / bench_vals[i - 1] - 1)
             for i in range(1, min(len(port_vals), len(bench_vals)))
             if port_vals[i - 1] and bench_vals[i - 1]]
    have_bench = len(pairs) >= 2

    beta: float | None = None
    correlation: float | None = None
    information_ratio: float | None = None
    tracking_error: float | None = None
    if have_bench:
        port_r = [p for p, _ in pairs]
        bench_r = [b for _, b in pairs]
        try:                                     # beta = cov(port, bench) / var(bench)
            var_b = statistics.variance(bench_r)
            beta = round(statistics.covariance(port_r, bench_r) / var_b, 4) if var_b else None
        except statistics.StatisticsError:
            beta = None
        try:                                     # correlation of the two return series
            correlation = round(statistics.correlation(port_r, bench_r), 4)
        except statistics.StatisticsError:       # a constant series has no correlation
            correlation = None
        # Information ratio: benchmark-relative excess ÷ tracking error (std of the return
        # difference). Needs NO risk-free rate. Perfect tracking (te == 0) → 0 active info.
        active = [p - b for p, b in pairs]
        te_daily = statistics.pstdev(active)
        tracking_error = round(te_daily * ann * 100, 2)
        excess = ((port_vals[-1] / port_vals[0]) - (bench_vals[-1] / bench_vals[0])) * 100 \
            if port_vals[0] and bench_vals[0] else 0.0
        if te_daily == 0:
            information_ratio = 0.0 if abs(excess) < 1e-12 else None
        else:
            information_ratio = round(excess / (te_daily * ann * 100), 4)

    # HHI concentration = Σ weightᵢ² over current positive-value holdings (pure concentration;
    # 1/N for N equal holdings, so two equal holdings = 0.5). Needs no series and no benchmark.
    total_mv = sum(market_values)
    hhi = round(sum((v / total_mv) ** 2 for v in market_values), 4) if total_mv > 0 else None

    available = bool(port_ret) or hhi is not None
    return {
        "available": available, "base_currency": base_currency, "window_days": days,
        "benchmark_symbol": benchmark_symbol,
        "beta": beta, "correlation": correlation, "downside_deviation": downside_deviation,
        "information_ratio": information_ratio, "tracking_error": tracking_error, "hhi": hhi,
    }


async def risk_metrics(session: AsyncSession, base_currency: str, days: int,
                       benchmark: str = "SPY", entity_id: int | None = None) -> dict:
    """§4.5 Unit B — read-only additional risk metrics.

    Reuses the existing performance series (the SAME one behind the shown volatility/drawdown —
    R7 single source of truth) plus current holdings, and computes only metrics that need NO
    risk-free rate: beta, correlation, downside deviation, information ratio (benchmark-relative),
    and HHI concentration. Sharpe and Sortino are deliberately not computed (they need a risk-free
    rate this tool does not claim). Benchmark defaults to the same benchmark the sibling analytics
    reference; when its series is unavailable (thin data / no benchmark), the benchmark-relative
    metrics come back None while HHI and downside deviation still compute. Best-effort within a
    time budget — the money path is never touched."""
    import asyncio

    perf: dict | None = None
    try:
        perf = await asyncio.wait_for(
            performance_series(session, base_currency, days, benchmark, entity_id=entity_id), timeout=14)
    except (TimeoutError, Exception):  # noqa: BLE001 — never let a slow provider break the panel
        perf = None

    val = await value_portfolio(session, base_currency, entity_id=entity_id)
    market_values = [float(h.market_value_base) for h in val.holdings if h.market_value_base > 0]
    port_vals = [pt["value"] for pt in perf["series"]] if perf and perf.get("series") else []
    bench_vals = [pt["value"] for pt in perf["benchmark"]] if perf and perf.get("benchmark") else []
    if not port_vals and not market_values:
        return _risk_unavailable(base_currency, days, benchmark)
    return _risk_from_series(port_vals, bench_vals, market_values, base_currency, days, benchmark)

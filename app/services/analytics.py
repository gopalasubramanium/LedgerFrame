"""Portfolio performance analytics.

Reconstructs a portfolio value series from current holdings × historical prices
(a common "today's holdings, valued back through time" view), plus a benchmark
series indexed to the same starting value, and deterministic summary stats.

Honesty notes:
- FX uses the *current* rate applied across history (a documented simplification;
  per-date FX would need historical FX series we don't fetch).
- Manual assets (cash/property/etc.) are held constant at their current value.
- All values are computed deterministically; the AI layer never touches these.
"""

from __future__ import annotations

import statistics
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.money import ZERO, D, money, to_display
from app.models import AssetClass, Holding, Instrument
from app.models import Transaction as Txn
from app.services import fx
from app.services.portfolio import compute_fifo, value_portfolio


async def key_stats(session: AsyncSession, base_currency: str, benchmark: str = "^GSPC") -> dict:
    """A panel of deterministic portfolio metrics.

    Only computes what we can derive honestly from the data — no fabricated Sharpe
    ratio or bond durations (we have no risk-free rate / instrument durations). The
    return/volatility ratio is labelled as such, not as a true Sharpe.
    """
    from collections import defaultdict

    val = await value_portfolio(session, base_currency)
    total = val.total_value or D("1")
    # Gross assets (exclude liabilities) — the right denominator for weights and
    # concentration, so a large mortgage can't push a position above 100%.
    gross = sum((h.market_value_base for h in val.holdings if h.market_value_base > 0), ZERO) or D("1")

    # Realised P/L and income (dividends/interest) from the transaction ledger,
    # converted to base currency at current FX.
    txns = (await session.execute(select(Txn).where(Txn.instrument_id.isnot(None)))).scalars().all()
    by_instr: dict[int, list[Txn]] = defaultdict(list)
    for t in txns:
        by_instr[t.instrument_id].append(t)
    realised = ZERO
    income = ZERO
    for group in by_instr.values():
        res = compute_fifo(group)
        ccy = group[0].currency or base_currency
        rate = await fx.get_rate(ccy, base_currency)
        realised += res.realised_pl * rate
        income += res.income * rate

    # Allocation weights.
    alloc = val.allocation("asset_class")

    def weight(*cls: str) -> float:
        return float(sum((alloc.get(c, ZERO) for c in cls), ZERO) / gross * 100)

    cash_pct = weight("cash", "fixed_deposit")
    equity_pct = weight("equity", "etf", "mutual_fund")
    crypto_pct = weight("crypto")
    alt_pct = weight("commodity", "property", "private")

    # Concentration.
    priced = sorted((h for h in val.holdings if h.market_value_base > 0),
                    key=lambda h: h.market_value_base, reverse=True)
    largest = priced[0] if priced else None
    top5 = sum((h.market_value_base for h in priced[:5]), ZERO)

    # 1Y risk/return metrics from the invested performance series.
    perf = await performance_series(session, base_currency, 365, benchmark)
    ps = perf.get("stats") or {}
    vol = ps.get("volatility_pct") or 0.0
    ret = ps.get("return_pct") or 0.0
    ret_vol = round(ret / vol, 2) if vol else None

    income_yield = float(income / total * 100) if total else 0.0

    return {
        "base_currency": base_currency,
        "metrics": [
            {"label": "Total value", "value": to_display(val.total_value), "kind": "money"},
            {"label": "Unrealised P/L", "value": to_display(val.unrealised_pl), "kind": "money", "signed": True},
            {"label": "Realised P/L", "value": to_display(money(realised)), "kind": "money", "signed": True},
            {"label": "Income (div/int)", "value": to_display(money(income)), "kind": "money", "signed": True},
            {"label": "Income yield", "value": round(income_yield, 2), "kind": "pct"},
            {"label": "Total return", "value": to_display(val.total_return_pct), "kind": "pct", "signed": True},
            {"label": "1Y return", "value": ret, "kind": "pct", "signed": True},
            {"label": "1Y volatility", "value": vol, "kind": "pct"},
            {"label": "Return / volatility", "value": ret_vol, "kind": "ratio"},
            {"label": "Max drawdown (1Y)", "value": ps.get("max_drawdown_pct", 0.0), "kind": "pct", "signed": True},
            {"label": "Cash & deposits", "value": round(cash_pct, 1), "kind": "pct"},
            {"label": "Equities & ETFs", "value": round(equity_pct, 1), "kind": "pct"},
            {"label": "Crypto", "value": round(crypto_pct, 1), "kind": "pct"},
            {"label": "Alternatives", "value": round(alt_pct, 1), "kind": "pct"},
            {"label": "Largest position", "value": (float(largest.market_value_base / gross * 100) if largest else 0.0), "kind": "pct",
             "note": largest.label if largest else None},
            {"label": "Top 5 concentration", "value": float(top5 / gross * 100), "kind": "pct"},
            {"label": "Positions", "value": len(val.holdings), "kind": "count"},
        ],
    }


def _carry_forward(dates: list[datetime], series: dict[datetime, Decimal]) -> list[Decimal]:
    """Map each axis date to the most recent known value at or before it."""
    out: list[Decimal] = []
    last = Decimal("0")
    keys = sorted(series)
    j = 0
    for d in dates:
        while j < len(keys) and keys[j] <= d:
            last = series[keys[j]]
            j += 1
        out.append(last)
    return out


async def performance_series(
    session: AsyncSession,
    base_currency: str,
    days: int,
    benchmark: str = "^GSPC",
    include_manual: bool = False,
) -> dict:
    """Performance of the *invested* portfolio (priced market holdings) vs a
    benchmark. Constant manual assets (cash/property) are excluded by default so
    the line reflects market movement; pass include_manual=True for a net-worth view.
    """
    from app.services.market import get_history_cached

    end = datetime.now(UTC)
    start = end - timedelta(days=days)

    # Time axis from the benchmark's daily candles (cached).
    bench_candles = await get_history_cached(session, benchmark, "1d", start, end)
    axis = [c.ts for c in bench_candles]
    if len(axis) < 2:
        return {"series": [], "benchmark": [], "benchmark_symbol": benchmark, "stats": None}

    holdings = (await session.execute(select(Holding))).scalars().all()

    # Pre-fetch FX rates for distinct native currencies.
    fx_cache: dict[str, Decimal] = {}

    async def rate(ccy: str) -> Decimal:
        if ccy not in fx_cache:
            fx_cache[ccy] = await fx.get_rate(ccy, base_currency)
        return fx_cache[ccy]

    # Sum each holding's value across the axis.
    portfolio_vals = [Decimal("0")] * len(axis)
    for h in holdings:
        instr = await session.get(Instrument, h.instrument_id) if h.instrument_id else None
        native = h.currency or (instr.currency if instr else base_currency)
        fx_rate = await rate(native)
        sign = Decimal("-1") if h.asset_class == AssetClass.LIABILITY else Decimal("1")

        if h.manual_value is not None or instr is None:
            if not include_manual:
                continue  # exclude constant manual assets from the performance line
            contrib = D(h.manual_value if h.manual_value is not None else D(h.quantity) * D(h.avg_cost))
            base_contrib = contrib * fx_rate * sign
            for i in range(len(axis)):
                portfolio_vals[i] += base_contrib
            continue

        candles = await get_history_cached(session, instr.symbol, "1d", start, end)
        closes = {c.ts: D(c.close) for c in candles}
        per_date = _carry_forward(axis, closes)
        qty = D(h.quantity)
        for i, close in enumerate(per_date):
            portfolio_vals[i] += qty * close * fx_rate * sign

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

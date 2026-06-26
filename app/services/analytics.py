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

from app.core.money import D, to_display
from app.models import AssetClass, Holding, Instrument
from app.providers.market import get_provider
from app.services import fx


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
    provider = get_provider()
    end = datetime.now(UTC)
    start = end - timedelta(days=days)

    # Time axis from the benchmark's daily candles.
    bench_candles = await provider.get_history(benchmark, "1d", start, end)
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

        candles = await provider.get_history(instr.symbol, "1d", start, end)
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

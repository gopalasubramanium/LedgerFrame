# SPDX-License-Identifier: AGPL-3.0-or-later
"""R-43 §9-8 — deterministic, network-free demo history generation.

Generates the two persisted stores the date-aware valuation engine reads, so the demo/pre-pass
lane can value the portfolio as-of any past date (and render a real backfilled trend) WITHOUT a
provider call:

  • ``price_history`` — a daily close series per held market instrument, from its earliest
    transaction to today, a smooth deterministic walk anchored to the mock catalog's base price.
  • ``ecb_fx_history`` — EUR→{USD, SGD, INR, EUR} per date, with rates that MOVE over the span so
    a valuation at each date's real FX differs from one at today's FX (the exact drift the ▲-B
    consolidation RED needs to manifest).

Determinism: no randomness (a per-symbol integer seed drives a ``sin`` oscillation), so the same
date range always yields the same series — a demo/test fixture, never a claim of real history.
Demo-only, gated by the seed's once-only flag. ``source='mock'`` marks every generated candle
(the §14dr-25 provenance convention: real data supersedes demo)."""

from __future__ import annotations

import math
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.money import D
from app.models import AssetClass, EcbFxHistory, Instrument, PriceHistory
from app.models import Transaction as Txn
from app.providers.market.mock import _CATALOG

# EUR→CCY anchors: (start rate at the earliest date, end rate today). The USD and SGD legs move
# differently, so USD→SGD (and INR→SGD) genuinely drift across the span — deterministic.
_FX_ANCHORS: dict[str, tuple[str, str]] = {
    "EUR": ("1", "1"),
    "USD": ("1.08", "1.14"),   # EUR→USD: USD weakens vs EUR over the span
    "SGD": ("1.44", "1.48"),   # EUR→SGD: mild drift
    "INR": ("88", "95"),       # EUR→INR: INR weakens vs EUR
}


def _seed_for(symbol: str) -> int:
    """A stable per-symbol integer (no hash randomisation) to phase-shift the oscillation."""
    return sum(ord(c) for c in symbol)


def _weekdays(start: date, end: date):
    """Every Mon–Fri from start to end inclusive — markets/ECB don't publish on weekends; the
    resolvers carry the last close forward, so weekday-only coverage is honest and compact."""
    d = start
    one = timedelta(days=1)
    while d <= end:
        if d.weekday() < 5:
            yield d
        d += one


def _price_on(base: float, idx: int, n: int, seed: int) -> Decimal:
    """Deterministic close: grows from ~0.70×base to ~1.00×base with a bounded oscillation."""
    trend = 0.70 + 0.30 * (idx / n if n else 1.0)
    osc = 1.0 + 0.06 * math.sin((idx + seed) / 40.0)
    return D(str(round(base * trend * osc, 6)))


def _fx_on(start: str, end: str, idx: int, n: int) -> Decimal:
    """Deterministic EUR→ccy rate, linearly interpolated start→end with a small oscillation."""
    s, e = float(start), float(end)
    val = s + (e - s) * (idx / n if n else 1.0)
    val *= 1.0 + 0.01 * math.sin(idx / 55.0)
    return D(str(round(val, 6)))


async def seed_demo_history(session: AsyncSession) -> dict:
    """Populate ``price_history`` + ``ecb_fx_history`` for the demo book. Idempotent: a no-op if
    ``price_history`` already has rows. Returns a summary (row counts + span)."""
    if (await session.execute(select(func.count()).select_from(PriceHistory))).scalar():
        return {"skipped": True}

    # Held market instruments = those referenced by a transaction (manual assets have no series).
    rows = (await session.execute(
        select(Txn.instrument_id, func.min(Txn.ts))
        .where(Txn.instrument_id.isnot(None))
        .group_by(Txn.instrument_id)
    )).all()
    if not rows:
        return {"skipped": True, "reason": "no transactions"}

    today = datetime.now(UTC).date()
    earliest = min((mn.date() if hasattr(mn, "date") else mn) for _iid, mn in rows)
    axis = list(_weekdays(earliest, today))
    n = len(axis) - 1 if len(axis) > 1 else 1

    # --- price_history: one daily close series per held instrument ---
    ph_payload: list[dict] = []
    for iid, first_ts in rows:
        instr = await session.get(Instrument, iid)
        if instr is None:
            continue
        # A mutual fund's history is official NAV (AMFI — step 6), not a market series; a manual-
        # priced instrument has no market feed. Neither gets a fabricated equity-style walk — they
        # stay honestly history-less in the demo (the trend renders them as a §9-5 carried-forward
        # gap), and the routing guarantee (a fund is never fetched from an equity provider) holds.
        if instr.asset_class == AssetClass.MUTUAL_FUND or instr.is_manual_price:
            continue
        cat = _CATALOG.get(instr.symbol)
        base = float(cat["base"]) if cat else float(D(instr.market_cap or 0) or 100)
        seed = _seed_for(instr.symbol or str(iid))
        first_day = first_ts.date() if hasattr(first_ts, "date") else first_ts
        for idx, day in enumerate(axis):
            if day < first_day:  # no candle before the instrument was first held
                continue
            close = _price_on(base, idx, n, seed)
            ph_payload.append({
                "instrument_id": iid, "interval": "1d",
                "ts": datetime(day.year, day.month, day.day, tzinfo=UTC),
                "open": close, "high": close, "low": close, "close": close,
                "volume": None, "source": "mock",
            })

    # --- ecb_fx_history: EUR→{USD, SGD, INR, EUR} per date ---
    now = datetime.now(UTC)
    fx_payload: list[dict] = []
    for idx, day in enumerate(axis):
        iso = day.isoformat()
        for ccy, (start, end) in _FX_ANCHORS.items():
            rate = Decimal("1") if ccy == "EUR" else _fx_on(start, end, idx, n)
            fx_payload.append({"currency": ccy, "as_of": iso, "rate": rate, "updated_at": now})

    for i in range(0, len(ph_payload), 2000):
        await session.execute(insert(PriceHistory), ph_payload[i:i + 2000])
    for i in range(0, len(fx_payload), 2000):
        await session.execute(insert(EcbFxHistory), fx_payload[i:i + 2000])
    await session.flush()
    return {
        "price_rows": len(ph_payload), "fx_rows": len(fx_payload),
        "instruments": len(rows), "earliest": earliest.isoformat(), "latest": today.isoformat(),
        "trading_days": len(axis),
    }

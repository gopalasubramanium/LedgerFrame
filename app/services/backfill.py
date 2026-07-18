# SPDX-License-Identifier: AGPL-3.0-or-later
"""R-43 §9-1/§9-2/§9-6 — the net-worth backfill orchestrator.

Reconstructs a DAILY net-worth series from the earliest transaction to today by valuing the
portfolio as-of each date through the ONE date-aware engine, and persists each as a dated
``net_worth_snapshots`` row with ``source='backfilled'``. Market holdings ride per-date price +
FX; manual assets (cash/property/…) have no market history, so their current base value is carried
FLAT (a known approximation, marked — never fabricated per-date).

Honesty + idempotency (§9-1):
  • A re-run REPLACES the backfilled rows (never duplicates).
  • A live/manual row for a date always SUPERSEDES a backfilled one (never the reverse): the
    backfill skips any date that already has a live/manual snapshot.
The orchestrator reads only already-cached price/FX (no provider call) — it runs under no-egress.
Acquisition (fetching missing history) is the separate, user-triggered step.

Served progress (§9-2): a JSON status file the UI polls (the self-update file-poll precedent).
Snapshot-now (§9-6) writes a ``source='manual'`` row and is refused (served reason) while a
backfill is in flight.
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.money import ZERO, money
from app.models import NetWorthSnapshot
from app.models import Transaction as Txn
from app.schemas.common import ValuationMethod
from app.services.portfolio import value_portfolio

log = logging.getLogger("ledgerframe")

_STATUS_FILE = "backfill.status"


# --------------------------------------------------------------------------- #
# Served progress (file-poll shape)
# --------------------------------------------------------------------------- #
def _status_path():
    return get_settings().logs_dir / _STATUS_FILE


def _write_status(**fields) -> None:
    try:
        p = _status_path()
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(fields))
    except Exception:  # noqa: BLE001 — progress is best-effort, never blocks the run
        pass


def read_status() -> dict:
    """The served backfill progress — running/done/total/current + ok/failed. Missing file = idle."""
    default = {"running": False, "ok": False, "failed": False,
               "done": 0, "total": 0, "current": None, "message": ""}
    try:
        p = _status_path()
        if p.exists():
            return {**default, **json.loads(p.read_text())}
    except Exception:  # noqa: BLE001
        pass
    return default


def is_running() -> bool:
    return bool(read_status().get("running"))


# --------------------------------------------------------------------------- #
# The backfill
# --------------------------------------------------------------------------- #
def _midnight(d) -> datetime:
    return datetime(d.year, d.month, d.day, tzinfo=UTC)


async def _manual_base(session: AsyncSession, base_currency: str) -> tuple:
    """Current signed base value of MANUAL holdings (cash/property/mortgage/…), split into
    (assets, liabilities). Carried flat across the backfill — their history is unknown."""
    live = await value_portfolio(session, base_currency, warm=False)
    manual = [h for h in live.holdings
              if h.valuation_method == ValuationMethod.MANUAL_VALUATION.value]
    assets = sum((h.market_value_base for h in manual if h.market_value_base > 0), ZERO)
    liabilities = -sum((h.market_value_base for h in manual if h.market_value_base < 0), ZERO)
    return assets, liabilities


async def run_backfill(session: AsyncSession, base_currency: str | None = None,
                       write_progress: bool = True, stride_days: int = 1,
                       commit: bool = True) -> dict:
    """Reconstruct + persist the backfilled net-worth series. Idempotent. Returns a summary
    (days written, span, runtime). The user-triggered path uses the default DAILY cadence
    (``stride_days=1``); the demo seed uses a coarser stride for a cheap-but-consistent line (the
    same engine + data, fewer points). ``commit=False`` lets a caller mid-transaction (the seed)
    fold this into its own commit. Progress is written to the served status file when
    ``write_progress``."""
    import time as _time

    base = (base_currency or get_settings().base_currency)
    earliest = (await session.execute(
        select(func.min(Txn.ts)).where(Txn.deleted_at.is_(None), Txn.instrument_id.isnot(None))
    )).scalar()
    if earliest is None:
        if write_progress:
            _write_status(running=False, ok=True, failed=False, done=0, total=0,
                          current=None, message="No transactions — nothing to backfill.")
        return {"days": 0, "reason": "no transactions"}

    start = earliest.date()
    today = datetime.now(UTC).date()
    days = [start + timedelta(days=i) for i in range((today - start).days + 1)]
    total = len(days)

    # Dates already covered by a REAL row (live/manual) — never shadowed by a backfilled one.
    real_dates = {
        (ts.date() if hasattr(ts, "date") else ts)
        for ts in (await session.execute(
            select(NetWorthSnapshot.ts).where(NetWorthSnapshot.source.in_(("live", "manual")))
        )).scalars().all()
    }

    # Idempotent: clear prior backfilled rows before regenerating.
    await session.execute(delete(NetWorthSnapshot).where(NetWorthSnapshot.source == "backfilled"))
    await session.flush()

    from app.services.fx_history import load_historical_fx, needed_currencies
    hist_fx = await load_historical_fx(session, list(await needed_currencies(session, base)))
    manual_assets, manual_liab = await _manual_base(session, base)

    if write_progress:
        _write_status(running=True, ok=False, failed=False, done=0, total=total,
                      current=start.isoformat(), message="Building history…")
    t0 = _time.monotonic()
    written = 0
    last_idx = len(days) - 1
    for i, d in enumerate(days):
        if d in real_dates:
            continue  # a live/manual row already owns this date
        if stride_days > 1 and (i % stride_days) != 0 and i != last_idx:
            continue  # coarser cadence (demo) — value every stride-th day + always the last
        v = await value_portfolio(session, base, warm=False, as_of=d, hist_fx=hist_fx)
        market_assets = sum((h.market_value_base for h in v.holdings if h.market_value_base > 0), ZERO)
        market_liab = -sum((h.market_value_base for h in v.holdings if h.market_value_base < 0), ZERO)
        assets = money(market_assets + manual_assets)
        liabilities = money(market_liab + manual_liab)
        # §9-5: mark the point carried-forward when a genuine per-date FX gap made a holding's
        # value unstatable in base (W-1b) — the honest whole-trend gap. A single always-unpriced
        # holding (e.g. a fund whose NAV history isn't loaded yet) is estimated at cost per-holding
        # (val_method), not a trend gap, so it does NOT flag every point. NULL = clean.
        gap = any(h.fx_unavailable for h in v.holdings)
        session.add(NetWorthSnapshot(
            ts=_midnight(d), base_currency=base, assets=assets, liabilities=liabilities,
            net_worth=money(assets - liabilities), source="backfilled",
            flags=("carried_forward" if gap else None),
        ))
        written += 1
        if write_progress and (i % 25 == 0):
            _write_status(running=True, ok=False, failed=False, done=i + 1, total=total,
                          current=d.isoformat(), message="Building history…")
    if commit:
        await session.commit()
    else:
        await session.flush()
    runtime = round(_time.monotonic() - t0, 1)
    if write_progress:
        _write_status(running=False, ok=True, failed=False, done=total, total=total,
                      current=today.isoformat(),
                      message=f"History built — {written} day(s) in {runtime}s.")
    log.info("backfill: %d days written (%s → %s) in %ss", written, start, today, runtime)
    return {"days": written, "earliest": start.isoformat(), "latest": today.isoformat(),
            "runtime_s": runtime, "total": total}


async def run_backfill_background(base_currency: str | None = None) -> None:
    """Entry point for a fire-and-forget background task: opens its own session, runs the
    ACQUISITION preflight (§12 step 2 — fetch + ingest the ECB per-date FX the series values from),
    then the backfill, and records failure in the served status (never crashes the caller).

    Under no-egress the preflight refuses (Guarantee 5): the served status carries the honest
    refusal and NO series is written — never the F-1 zero-coverage line built from an empty store."""
    from app.db.base import get_sessionmaker
    from app.services.acquire import acquire_history

    try:
        async with get_sessionmaker()() as session:
            # §12 step 2: acquire the inputs (ECB FX today; prices in later steps) BEFORE valuing.
            _write_status(running=True, ok=False, failed=False, done=0, total=0, current=None,
                          message="Downloading exchange-rate history…")
            acq = await acquire_history(session, base_currency)
            if not acq.get("ok"):
                # No-egress (or acquisition unavailable): refuse honestly, build nothing.
                _write_status(running=False, ok=False, failed=False, done=0, total=0,
                              current=None, message=acq.get("message", "History not built."))
                log.info("backfill refused: %s", acq.get("message"))
                return
            await run_backfill(session, base_currency)
    except Exception as exc:  # noqa: BLE001
        log.warning("backfill failed: %s", exc)
        _write_status(running=False, ok=False, failed=True, done=0, total=0, current=None,
                      message="Backfill failed — see logs.")


async def snapshot_now(session: AsyncSession, base_currency: str | None = None) -> dict:
    """Write a single dated ``source='manual'`` net-worth snapshot from the current valuation
    (full net worth incl. manual assets). §9-6: refused while a backfill is in flight."""
    base = (base_currency or get_settings().base_currency)
    val = await value_portfolio(session, base, warm=False)
    now = datetime.now(UTC)
    assets = money(sum((h.market_value_base for h in val.holdings if h.market_value_base > 0), ZERO))
    liabilities = money(-sum((h.market_value_base for h in val.holdings if h.market_value_base < 0), ZERO))
    session.add(NetWorthSnapshot(
        ts=now, base_currency=base, assets=assets, liabilities=liabilities,
        net_worth=money(assets - liabilities), source="manual",
    ))
    await session.commit()
    return {"ok": True, "ts": now.isoformat(), "net_worth": float(assets - liabilities)}

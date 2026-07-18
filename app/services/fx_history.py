# SPDX-License-Identifier: AGPL-3.0-or-later
"""R-8 (R-43 §9-3): historical per-date reference FX.

Ingests ECB ``eurofxref-hist.csv`` into ``ecb_fx_history`` (one row = EUR→CCY on one
publication date) and resolves a base→quote rate AS-OF any past date via the EUR hub —
``(EUR→quote)/(EUR→base)`` on that date. This is the FX resolver behind the date-aware
valuation engine; it is deliberately separate from ``app.services.fx`` (latest-rate-only,
USD hub) so a retrospective valuation never silently uses today's rate.

Honesty (W-1b per-date):
  • A currency with NO published rate on/before the date (pre-coverage — INR/SGD before
    ECB began quoting them) resolves to ``None``. A caller flags the value; it is never
    fabricated as 1.0 (a silent 1.0 in a base total is the W-1 failure mode).
  • ECB non-publication days (weekends/holidays) are NOT stored — the resolver carries the
    last published rate forward, the standard daily-close convention (§9-3, unflagged).
All arithmetic is ``Decimal``.
"""

from __future__ import annotations

import bisect
from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.money import D
from app.db.upsert import upsert
from app.models import EcbFxHistory, Holding, Instrument
from app.providers.market.ecb import parse_ecb_hist_csv


def _iso(on_date: str | date | datetime) -> str:
    """Normalise a date-ish to an ISO ``YYYY-MM-DD`` string (ISO strings sort chronologically)."""
    if isinstance(on_date, str):
        return on_date[:10]
    if isinstance(on_date, datetime):
        d = on_date.astimezone(UTC).date() if on_date.tzinfo else on_date.date()
        return d.isoformat()
    return on_date.isoformat()


# --------------------------------------------------------------------------- #
# Ingestion
# --------------------------------------------------------------------------- #
async def ingest_hist(session: AsyncSession, csv_text: str) -> dict:
    """Parse the ECB history CSV and upsert every (currency, date) rate.

    Idempotent: re-ingesting the same file overwrites in place (no duplicate rows), and a
    later file that carries new dates simply appends them — the periodic-append path. EUR=1
    per date is stored explicitly so an EUR-quoted or EUR-based book resolves without a
    special case. Returns ``{dates, rows}``."""
    by_date = parse_ecb_hist_csv(csv_text)
    now = datetime.now(UTC)
    payload: list[dict] = []
    for day, rates in by_date.items():
        for ccy, rate in rates.items():
            payload.append({"currency": ccy, "as_of": day, "rate": D(rate), "updated_at": now})
    if not payload:
        return {"dates": 0, "rows": 0}

    stmt = upsert(EcbFxHistory)
    stmt = stmt.on_conflict_do_update(
        index_elements=[EcbFxHistory.currency, EcbFxHistory.as_of],
        set_={"rate": stmt.excluded.rate, "updated_at": stmt.excluded.updated_at},
    )
    for i in range(0, len(payload), 2000):  # chunk under SQLite's variable limit
        await session.execute(stmt, payload[i:i + 2000])
    await session.flush()
    return {"dates": len(by_date), "rows": len(payload)}


# --------------------------------------------------------------------------- #
# Resolver
# --------------------------------------------------------------------------- #
class HistoricalFx:
    """A preloaded, in-memory per-date rate resolver — built once, resolved thousands of times
    across a backfill without per-date DB round-trips. ``series[CCY] = (dates_asc, rates)`` where
    ``dates_asc`` is a chronologically-sorted list of ISO date strings and ``rates`` the parallel
    EUR→CCY rates. Carry-forward = the greatest stored date ≤ the query date (§9-3)."""

    def __init__(self, series: dict[str, tuple[list[str], list[Decimal]]]):
        self._series = series

    def eur_to(self, ccy: str, on_date: str | date | datetime) -> Decimal | None:
        """EUR→ccy on ``on_date``, carrying the last published rate forward. ``None`` if the
        currency has no published rate on/before the date (pre-coverage — honestly-missing)."""
        ccy = (ccy or "").upper()
        if ccy == "EUR":
            return Decimal("1")
        entry = self._series.get(ccy)
        if not entry:
            return None
        dates, rates = entry
        iso = _iso(on_date)
        idx = bisect.bisect_right(dates, iso) - 1  # greatest stored date <= iso
        if idx < 0:
            return None  # query date precedes this currency's first published rate
        return rates[idx]

    def rate(self, base: str, quote: str, on_date: str | date | datetime) -> Decimal | None:
        """base→quote on ``on_date`` via the EUR hub: (EUR→quote)/(EUR→base). ``None`` if either
        leg is honestly-missing on that date — never a fabricated 1.0 (W-1b per-date)."""
        base, quote = (base or "").upper(), (quote or "").upper()
        if not base or not quote or base == quote:
            return Decimal("1")
        eb = self.eur_to(base, on_date)
        eq = self.eur_to(quote, on_date)
        if eb is None or eq is None or eb == 0:
            return None
        return eq / eb

    def _eur_to_dated(self, ccy: str, on_date: str | date | datetime) -> tuple[Decimal | None, str | None]:
        """Like :meth:`eur_to` but also returns the SOURCE publication date used (for staleness)."""
        ccy = (ccy or "").upper()
        if ccy == "EUR":
            return Decimal("1"), _iso(on_date)
        entry = self._series.get(ccy)
        if not entry:
            return None, None
        dates, rates = entry
        idx = bisect.bisect_right(dates, _iso(on_date)) - 1
        if idx < 0:
            return None, None
        return rates[idx], dates[idx]

    def rate_near(self, base: str, quote: str, on_date: str | date | datetime,
                  within_days: int = 7) -> tuple[Decimal | None, bool]:
        """base→quote as-of ``on_date`` for a trade-date fallback (§9-4a): returns ``(rate, ok)``
        where ``ok`` is True only when BOTH legs' carried-forward publication date is within
        ``within_days`` of ``on_date`` — otherwise the last-known rate is too stale to stand in as
        a trade-date rate, and the caller treats the cost as honestly-missing (never today's rate)."""
        base, quote = (base or "").upper(), (quote or "").upper()
        if not base or not quote or base == quote:
            return Decimal("1"), True
        eb, db = self._eur_to_dated(base, on_date)
        eq, dq = self._eur_to_dated(quote, on_date)
        if eb is None or eq is None or eb == 0:
            return None, False
        tgt = date.fromisoformat(_iso(on_date))

        def _near(src: str | None) -> bool:
            return src is not None and abs((tgt - date.fromisoformat(src)).days) <= within_days

        return eq / eb, (_near(db) and _near(dq))

    @property
    def currencies(self) -> set[str]:
        return set(self._series)


async def load_historical_fx(
    session: AsyncSession, currencies: list[str] | None = None
) -> HistoricalFx:
    """Build a :class:`HistoricalFx` from the store. ``currencies`` restricts the load to the
    needed set (the backfill loads only the book's pricing currencies + base); ``None`` loads all."""
    q = select(EcbFxHistory.currency, EcbFxHistory.as_of, EcbFxHistory.rate)
    if currencies:
        want = {c.upper() for c in currencies} | {"EUR"}
        q = q.where(EcbFxHistory.currency.in_(want))
    q = q.order_by(EcbFxHistory.currency, EcbFxHistory.as_of)
    rows = (await session.execute(q)).all()
    series: dict[str, tuple[list[str], list[Decimal]]] = {}
    for ccy, as_of, rate in rows:
        dates, rates = series.setdefault(ccy, ([], []))
        dates.append(as_of)
        rates.append(D(rate))
    return HistoricalFx(series)


async def rate_on(
    session: AsyncSession, base: str, quote: str, on_date: str | date | datetime
) -> Decimal | None:
    """Convenience single-lookup base→quote rate as-of a date. For a bulk backfill preload once
    with :func:`load_historical_fx` and reuse the resolver instead of calling this per date."""
    fxh = await load_historical_fx(session, [base, quote])
    return fxh.rate(base, quote, on_date)


# --------------------------------------------------------------------------- #
# Derivation of the needed set + store status
# --------------------------------------------------------------------------- #
async def needed_currencies(session: AsyncSession, base_currency: str) -> set[str]:
    """The ONE derivation of which historical FX pairs the backfill needs: the distinct pricing
    currencies of every held instrument, plus the base. For this book that is {USD, INR, SGD} →
    {USD→SGD, INR→SGD} crosses (SGD→SGD is identity). Kept here so the resolver and the backfill
    orchestrator agree on the set (one derivation, never two)."""
    base = (base_currency or "SGD").upper()
    ccys: set[str] = {base}
    rows = (await session.execute(
        select(Instrument.pricing_currency, Instrument.currency)
        .join(Holding, Holding.instrument_id == Instrument.id)
        .where(Holding.deleted_at.is_(None))
        .distinct()
    )).all()
    for pricing_ccy, instr_ccy in rows:
        ccy = (pricing_ccy or instr_ccy or "").upper()
        if ccy:
            ccys.add(ccy)
    return ccys


async def status(session: AsyncSession) -> dict:
    """Store coverage for served status: row count, currency count, and the date span."""
    total = (await session.execute(select(func.count()).select_from(EcbFxHistory))).scalar() or 0
    ccy_count = (await session.execute(
        select(func.count(func.distinct(EcbFxHistory.currency)))
    )).scalar() or 0
    lo = (await session.execute(select(func.min(EcbFxHistory.as_of)))).scalar()
    hi = (await session.execute(select(func.max(EcbFxHistory.as_of)))).scalar()
    return {"rows": total, "currencies": ccy_count, "earliest": lo, "latest": hi}

"""Market service: fetch quotes via the provider, persist with provenance, and
expose staleness. Never silently substitutes stale data for live — staleness is
computed from the stored ``received_at`` against the configured threshold and
returned explicitly on every quote.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.money import pct_change
from app.models import Instrument
from app.models import Quote as QuoteRow
from app.providers.market import get_provider
from app.schemas.common import EntitlementStatus, Quote

log = logging.getLogger(__name__)


def _is_stale(received_at: datetime) -> bool:
    if received_at.tzinfo is None:
        received_at = received_at.replace(tzinfo=UTC)
    age = (datetime.now(UTC) - received_at).total_seconds()
    return age > get_settings().stale_after_seconds


async def refresh_quote(session: AsyncSession, symbol: str, exchange: str | None = None) -> Quote:
    """Fetch a fresh quote and upsert it. On provider failure, return the last
    cached quote marked stale/cached rather than raising."""
    provider = get_provider()
    instrument = await _get_or_create_instrument(session, symbol, exchange)
    try:
        q = await provider.get_quote(symbol, exchange)
        if q.price is None:
            # Provider couldn't deliver (e.g. rate-limited). Do NOT write a null
            # price (the column is NOT NULL, and a null would poison the session).
            # Return the last cached quote, or an explicit "unavailable".
            return await get_cached_quote(session, symbol, exchange)
        # Race-safe upsert: concurrent dashboard requests often refresh the same
        # symbol at once (SPY appears on Home, Markets and Global). A check-then-
        # insert would hit "UNIQUE constraint failed: quotes.instrument_id"; an
        # atomic ON CONFLICT DO UPDATE can't.
        from sqlalchemy.dialects.sqlite import insert as sqlite_insert

        values = {
            "instrument_id": instrument.id,
            "price": q.price,
            "previous_close": q.previous_close,
            "currency": q.currency,
            "source": q.source,
            "entitlement": q.entitlement.value,
            "market_time": q.market_time,
            "received_at": datetime.now(UTC),
        }
        stmt = sqlite_insert(QuoteRow).values(**values)
        stmt = stmt.on_conflict_do_update(
            index_elements=[QuoteRow.instrument_id],
            set_={k: v for k, v in values.items() if k != "instrument_id"},
        )
        await session.execute(stmt)
        await session.flush()
        q.is_stale = False
        return q
    except Exception as exc:  # noqa: BLE001
        log.warning("quote refresh failed for %s: %s", symbol, exc)
        return await get_cached_quote(session, symbol, exchange)


async def get_cached_quote(
    session: AsyncSession, symbol: str, exchange: str | None = None
) -> Quote:
    """Return the last stored quote, marked stale if older than the threshold.
    If nothing is cached, mark the symbol UNAVAILABLE (no fabricated price)."""
    instrument = await _get_or_create_instrument(session, symbol, exchange)
    row = await session.get(QuoteRow, instrument.id)
    now = datetime.now(UTC)
    if row is None:
        return Quote(
            symbol=symbol.upper(), exchange=exchange, price=None,  # type: ignore[arg-type]
            currency=instrument.currency, source="none",
            entitlement=EntitlementStatus.UNAVAILABLE, received_at=now, is_stale=True,
        )
    stale = _is_stale(row.received_at)
    return Quote(
        symbol=symbol.upper(),
        exchange=exchange,
        price=row.price,
        previous_close=row.previous_close,
        change=(row.price - row.previous_close) if row.previous_close else None,
        change_pct=pct_change(row.price, row.previous_close) if row.previous_close else None,
        currency=row.currency,
        source=row.source,
        entitlement=EntitlementStatus.CACHED if stale else EntitlementStatus(row.entitlement),
        market_time=row.market_time,
        received_at=row.received_at,
        is_stale=stale,
    )


async def display_quote(session: AsyncSession, symbol: str, exchange: str | None = None) -> Quote:
    """Quote for page rendering. Serves the cache when fresh; only does a live
    fetch for 'cheap' providers (mock/csv). For rate-limited live providers it
    returns cached data so a page load never blocks on many serial API calls
    (refresh those via the worker or the Settings 'Refresh live data' button)."""
    cached = await get_cached_quote(session, symbol, exchange)
    if cached.price is not None and not cached.is_stale:
        return cached
    if getattr(get_provider(), "fetch_on_demand", True):
        return await refresh_quote(session, symbol, exchange)
    return cached


async def get_history_cached(
    session: AsyncSession,
    symbol: str,
    interval: str,
    start: datetime,
    end: datetime,
    max_age_hours: int = 12,
    allow_fetch: bool = True,
):
    """Return historical candles, cached in price_history.

    Refetches from the provider at most once per ``max_age_hours`` per
    instrument+interval — critical for rate-limited providers (Alpha Vantage's
    free tier is ~25 requests/day). Cheap providers (mock/csv) also benefit.
    """
    from app.models import PriceHistory, Setting
    from app.schemas.common import Candle

    instrument = await _get_or_create_instrument(session, symbol, None)
    marker_key = f"hist_fetched:{instrument.id}:{interval}"
    marker = (await session.execute(select(Setting).where(Setting.key == marker_key))).scalars().first()
    fresh = False
    if marker:
        try:
            ts = datetime.fromisoformat(marker.value)
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=UTC)
            fresh = (datetime.now(UTC) - ts).total_seconds() < max_age_hours * 3600
        except ValueError:
            fresh = False

    async def _from_db() -> list:
        rows = (
            await session.execute(
                select(PriceHistory)
                .where(
                    PriceHistory.instrument_id == instrument.id,
                    PriceHistory.interval == interval,
                    PriceHistory.ts >= start,
                    PriceHistory.ts <= end,
                )
                .order_by(PriceHistory.ts)
            )
        ).scalars().all()
        return [
            Candle(ts=r.ts, open=r.open, high=r.high, low=r.low, close=r.close, volume=r.volume)
            for r in rows
        ]

    if fresh or not allow_fetch:
        # Serve cached data without a (possibly slow) provider call. When fetching
        # isn't allowed (time-budget exceeded), return whatever we have, even empty.
        cached = await _from_db()
        if cached or not allow_fetch:
            return cached

    # Fetch from provider and upsert new candles.
    try:
        candles = await get_provider().get_history(symbol, interval, start, end)
    except Exception as exc:  # noqa: BLE001
        log.warning("history fetch failed for %s: %s", symbol, exc)
        return await _from_db()

    existing_ts = set(
        (
            await session.execute(
                select(PriceHistory.ts).where(
                    PriceHistory.instrument_id == instrument.id,
                    PriceHistory.interval == interval,
                )
            )
        ).scalars().all()
    )
    for c in candles:
        cts = c.ts.replace(tzinfo=None) if c.ts.tzinfo else c.ts
        if cts in existing_ts or c.ts in existing_ts:
            continue
        session.add(PriceHistory(
            instrument_id=instrument.id, interval=interval, ts=c.ts,
            open=c.open, high=c.high, low=c.low, close=c.close, volume=c.volume,
        ))
    if marker:
        marker.value = datetime.now(UTC).isoformat()
    else:
        session.add(Setting(key=marker_key, value=datetime.now(UTC).isoformat()))
    await session.flush()
    return candles


def _has_real_name(instr: Instrument) -> bool:
    """True when the instrument already has a human name (not just its ticker)."""
    n = (instr.name or "").strip()
    return bool(n) and n.upper() != instr.symbol.upper() and "(DEMO)" not in n and "(CSV)" not in n


async def backfill_instrument_name(session: AsyncSession, symbol: str) -> str | None:
    """Best-effort: fill an instrument's display name from the provider's search.

    Quotes (e.g. Alpha Vantage GLOBAL_QUOTE) don't carry names, so a ticker added
    by symbol shows only the ticker. This resolves the company/fund name once and
    persists it. Cheap on repeat calls (skips instruments that already have a name).
    """
    instr = (
        await session.execute(select(Instrument).where(Instrument.symbol == symbol.upper()))
    ).scalars().first()
    if instr is None or _has_real_name(instr):
        return instr.name if instr else None
    try:
        results = await get_provider().search_instruments(symbol)
        match = next((r for r in results if r.symbol.upper() == symbol.upper()), None) or (
            results[0] if results else None
        )
        if match and match.name and match.name.strip().upper() != symbol.upper():
            instr.name = match.name.strip()[:160]
            await session.flush()
    except Exception:  # noqa: BLE001 — names are cosmetic; never fail a refresh
        pass
    return instr.name


async def _get_or_create_instrument(
    session: AsyncSession, symbol: str, exchange: str | None
) -> Instrument:
    stmt = select(Instrument).where(Instrument.symbol == symbol.upper())
    if exchange:
        stmt = stmt.where(Instrument.exchange == exchange)
    instrument = (await session.execute(stmt)).scalars().first()
    if instrument is None:
        from sqlalchemy.exc import IntegrityError

        from app.core.symbols import currency_for_symbol

        instrument = Instrument(
            symbol=symbol.upper(), exchange=exchange, name=symbol.upper(),
            currency=currency_for_symbol(symbol, exchange) or "USD",
        )
        session.add(instrument)
        try:
            # Savepoint so a concurrent create (UNIQUE on symbol+exchange) can be
            # recovered without poisoning the outer transaction.
            async with session.begin_nested():
                await session.flush()
        except IntegrityError:
            instrument = (await session.execute(stmt)).scalars().first()
    return instrument

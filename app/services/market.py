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
        row = await session.get(QuoteRow, instrument.id)
        if row is None:
            row = QuoteRow(instrument_id=instrument.id)
            session.add(row)
        row.price = q.price
        row.previous_close = q.previous_close
        row.currency = q.currency
        row.source = q.source
        row.entitlement = q.entitlement.value
        row.market_time = q.market_time
        row.received_at = datetime.now(UTC)
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


async def _get_or_create_instrument(
    session: AsyncSession, symbol: str, exchange: str | None
) -> Instrument:
    stmt = select(Instrument).where(Instrument.symbol == symbol.upper())
    if exchange:
        stmt = stmt.where(Instrument.exchange == exchange)
    instrument = (await session.execute(stmt)).scalars().first()
    if instrument is None:
        instrument = Instrument(symbol=symbol.upper(), exchange=exchange, name=symbol.upper())
        session.add(instrument)
        await session.flush()
    return instrument

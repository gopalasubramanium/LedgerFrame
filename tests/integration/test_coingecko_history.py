# SPDX-License-Identifier: AGPL-3.0-or-later
"""R-43 §12 step 4 — CoinGecko crypto history adapter (daily range).

CoinGecko's public/free API is the crypto history owner (AV's crypto history is wrong-instrument
garbage, §12-R3). ``/coins/{id}/market_chart/range`` returns one reference price per day at 00:00
UTC for ranges >90 days (CoinGecko's documented auto-granularity); the free tier caps historical
depth at the past 365 days. We key each point to midnight UTC, source='coingecko', and never
fabricate a price (a non-positive point is dropped).
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

# A market_chart/range slice: [ms_epoch, price] pairs at 00:00 UTC on three consecutive days,
# plus a zero point (must be dropped, never fabricated) and matching volumes.
_D1 = int(datetime(2026, 1, 1, tzinfo=UTC).timestamp() * 1000)
_D2 = int(datetime(2026, 1, 2, tzinfo=UTC).timestamp() * 1000)
_D3 = int(datetime(2026, 1, 3, tzinfo=UTC).timestamp() * 1000)
_CHART = {
    "prices": [[_D1, 64024.63], [_D2, 65010.00], [_D3, 0]],
    "market_caps": [[_D1, 1.2e12], [_D2, 1.21e12], [_D3, 0]],
    "total_volumes": [[_D1, 3.0e10], [_D2, 3.1e10], [_D3, 0]],
}


def test_parse_market_chart_range_keys_daily_midnight_utc_and_drops_zero():
    """§12 step 4: parse yields one daily candle per point, keyed to midnight UTC; the reference
    price rides o/h/l/c (CoinGecko gives no OHLC — honest, no fabricated intraday range); a
    non-positive price is dropped (unavailable, never a fabricated 0)."""
    from app.providers.market.coingecko import parse_market_chart_range

    candles = parse_market_chart_range(_CHART)
    assert len(candles) == 2  # the zero point is dropped
    c0 = candles[0]
    assert c0.ts == datetime(2026, 1, 1, tzinfo=UTC)      # midnight-UTC keyed
    assert c0.close == Decimal("64024.63")                # the live-BTC-shaped number, not AV's 28.38
    assert c0.open == c0.high == c0.low == c0.close        # single reference price, no fabricated range
    assert c0.volume == Decimal("30000000000")


def test_alphavantage_never_owns_crypto_history_but_coingecko_does():
    """§12-R3/§12 step 4: after the adapter lands, CoinGecko IS the crypto daily-history owner and
    AV is NOT — the routing that sent BTC to AV's equity endpoint can never recur."""
    from app.providers.market.router import can_fetch_history, capabilities_for

    assert can_fetch_history(capabilities_for("coingecko"), "crypto") is True
    assert can_fetch_history(capabilities_for("alphavantage"), "crypto") is False


async def test_ingest_history_stores_coingecko_daily_price_history(session):
    """§12 step 4: ingesting a market_chart/range payload writes daily PriceHistory rows keyed to
    midnight UTC with source='coingecko'; idempotent (re-ingest overwrites in place, no duplicates)."""
    from sqlalchemy import func, select

    from app.models import AssetClass, Instrument, PriceHistory
    from app.services.coingecko import ingest_history

    btc = Instrument(symbol="BTC", currency="USD", pricing_currency="USD", asset_class=AssetClass.CRYPTO)
    session.add(btc)
    await session.flush()

    n = await ingest_history(session, btc.id, _CHART)
    assert n == 2
    rows = (await session.execute(
        select(PriceHistory).where(PriceHistory.instrument_id == btc.id).order_by(PriceHistory.ts)
    )).scalars().all()
    assert [r.ts for r in rows] == [datetime(2026, 1, 1, tzinfo=UTC), datetime(2026, 1, 2, tzinfo=UTC)]
    assert all(r.source == "coingecko" and r.interval == "1d" for r in rows)
    assert rows[0].close == Decimal("64024.63")

    # Idempotent — a second ingest does not duplicate.
    await ingest_history(session, btc.id, _CHART)
    total = (await session.execute(
        select(func.count()).select_from(PriceHistory).where(PriceHistory.instrument_id == btc.id)
    )).scalar()
    assert total == 2

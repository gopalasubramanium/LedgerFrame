# SPDX-License-Identifier: AGPL-3.0-or-later
"""CoinGecko service: cache the coin master, resolve/search by canonical id, and
publish prices to mapped instruments as ``coingecko`` market quotes (delayed).
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.money import D
from app.db.upsert import upsert
from app.models import CoingeckoCoin, InstrumentIdentifier, PriceHistory
from app.models import Quote as QuoteRow
from app.providers.market.coingecko import (
    parse_coins_list,
    parse_market_chart_range,
    parse_simple_price,
)

# The currency we store on the Quote (FX converts to base). Kept as USD for
# consistency with the existing crypto handling; multi-currency is exposed via search.
QUOTE_CCY = "USD"


async def ingest_history(session: AsyncSession, instrument_id: int, chart_json: dict,
                         interval: str = "1d") -> int:
    """§12 step 4: parse a ``market_chart/range`` payload and upsert daily PriceHistory rows for
    ``instrument_id`` (source='coingecko', keyed to midnight UTC). Idempotent — re-ingesting the
    same window overwrites in place on the (instrument_id, interval, ts) unique index, never
    duplicating. Returns the number of candles ingested."""
    candles = parse_market_chart_range(chart_json)
    if not candles:
        return 0
    payload = [{"instrument_id": instrument_id, "interval": interval, "ts": c.ts,
                "open": c.open, "high": c.high, "low": c.low, "close": c.close,
                "volume": c.volume, "source": "coingecko"} for c in candles]
    stmt = upsert(PriceHistory)
    stmt = stmt.on_conflict_do_update(
        index_elements=[PriceHistory.instrument_id, PriceHistory.interval, PriceHistory.ts],
        set_={"open": stmt.excluded.open, "high": stmt.excluded.high, "low": stmt.excluded.low,
              "close": stmt.excluded.close, "volume": stmt.excluded.volume,
              "source": stmt.excluded.source},
    )
    await session.execute(stmt, payload)
    await session.flush()
    return len(candles)


async def refresh_coins(session: AsyncSession, list_json: list) -> int:
    """Upsert the coin master from a ``/coins/list`` payload."""
    coins = parse_coins_list(list_json)
    now = datetime.now(UTC)
    for c in coins:
        stmt = upsert(CoingeckoCoin).values(
            id=c.id, symbol=c.symbol, name=c.name, updated_at=now,
        ).on_conflict_do_update(
            index_elements=[CoingeckoCoin.id],
            set_={"symbol": c.symbol, "name": c.name, "updated_at": now},
        )
        await session.execute(stmt)
    await session.flush()
    return len(coins)


async def publish_prices(session: AsyncSession, price_json: dict) -> int:
    """Given a ``/simple/price`` payload, write a Quote (source=coingecko) for every
    instrument mapped to one of those ids. Never writes a null/zero price."""
    prices = parse_simple_price(price_json)
    if not prices:
        return 0
    now = datetime.now(UTC)
    idents = (await session.execute(
        select(InstrumentIdentifier).where(InstrumentIdentifier.id_type == "coingecko_id")
    )).scalars().all()
    published = 0
    for ident in idents:
        cp = prices.get(ident.value)
        if cp is None:
            continue
        usd = cp.prices.get("usd")
        if usd is None:
            continue
        # cache market cap on the coin row for display
        if cp.market_cap_usd is not None:
            coin = await session.get(CoingeckoCoin, ident.value)
            if coin is not None:
                coin.market_cap_usd = cp.market_cap_usd
        values = {
            "instrument_id": ident.instrument_id, "price": D(usd), "previous_close": None,
            "currency": QUOTE_CCY, "source": "coingecko", "entitlement": "delayed",
            "market_time": cp.last_updated or now, "received_at": now,
        }
        stmt = upsert(QuoteRow).values(**values).on_conflict_do_update(
            index_elements=[QuoteRow.instrument_id],
            set_={k: v for k, v in values.items() if k != "instrument_id"},
        )
        await session.execute(stmt)
        published += 1
    await session.flush()
    return published


async def mapped_ids(session: AsyncSession) -> list[str]:
    rows = (await session.execute(
        select(InstrumentIdentifier.value).where(InstrumentIdentifier.id_type == "coingecko_id")
    )).scalars().all()
    return sorted(set(rows))


async def search_coins(session: AsyncSession, q: str, limit: int = 20) -> list[dict]:
    """Exact id / symbol match or name substring. Never auto-maps."""
    q = q.strip()
    if not q:
        return []
    like = f"%{q.lower()}%"
    rows = (await session.execute(
        select(CoingeckoCoin).where(or_(
            CoingeckoCoin.id == q.lower(),
            func.lower(CoingeckoCoin.symbol) == q.lower(),
            func.lower(CoingeckoCoin.name).like(like),
            func.lower(CoingeckoCoin.id).like(like),
        )).limit(limit)
    )).scalars().all()
    return [
        {"id": r.id, "symbol": r.symbol, "name": r.name,
         "market_cap_usd": float(r.market_cap_usd) if r.market_cap_usd is not None else None}
        for r in rows
    ]


async def status(session: AsyncSession) -> dict:
    total = (await session.execute(select(func.count()).select_from(CoingeckoCoin))).scalar() or 0
    mapped = len(await mapped_ids(session))
    # §14dr-13 — a true last-synced timestamp; None = never synced (the honest empty the
    # Masters card + the picker never-synced empty read from). `updated_at` upserted on refresh.
    synced = (await session.execute(select(func.max(CoingeckoCoin.updated_at)))).scalar()
    return {"coins": total, "mapped": mapped,
            "synced_at": synced.isoformat() if synced is not None else None}

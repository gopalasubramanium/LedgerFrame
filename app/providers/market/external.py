"""Opt-in external market data adapter (Alpha Vantage reference implementation).

This adapter is OFF unless ``LEDGERFRAME_MARKET_PROVIDER`` names it and a key is
present. It is provided as a worked example of the provider contract; before
relying on it confirm the vendor's current API docs, rate limits, and licence
(see docs/DATA_SOURCES.md). It NEVER scrapes web pages and reads its key only
from configuration. Any failure degrades to the mock provider upstream.

Alpha Vantage free tier is heavily rate-limited and delayed/EOD — quotes are
labelled accordingly so the UI never implies real-time entitlement.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import httpx

from app.core.money import D, price
from app.providers.market.mock import MockMarketDataProvider
from app.schemas.common import (
    Candle,
    EntitlementStatus,
    FxRate,
    Instrument,
    MarketStatus,
    NewsItem,
    Quote,
)

_BASE = "https://www.alphavantage.co/query"


class ExternalMarketDataProvider:
    def __init__(self, name: str, api_key: str):
        if not api_key:
            raise ValueError("external market provider requires an API key")
        self.name = name
        self._key = api_key
        self._mock = MockMarketDataProvider()  # fallback for unsupported calls
        self._sem = asyncio.Semaphore(1)  # respect tight free-tier rate limits

    async def get_quote(self, symbol: str, exchange: str | None = None) -> Quote:
        async with self._sem:
            try:
                async with httpx.AsyncClient(timeout=10) as client:
                    r = await client.get(
                        _BASE,
                        params={"function": "GLOBAL_QUOTE", "symbol": symbol, "apikey": self._key},
                    )
                    data = r.json().get("Global Quote", {})
                    px = data.get("05. price")
                    if not px:
                        raise ValueError("empty quote (rate limited or unknown symbol)")
                    prev = data.get("08. previous close")
                    now = datetime.now(timezone.utc)
                    return Quote(
                        symbol=symbol.upper(),
                        exchange=exchange,
                        price=price(px),
                        previous_close=price(prev) if prev else None,
                        change=price(data.get("09. change") or 0),
                        change_pct=D((data.get("10. change percent") or "0").rstrip("%")),
                        currency="USD",
                        source=self.name,
                        entitlement=EntitlementStatus.DELAYED,
                        market_time=now,
                        received_at=now,
                    )
            except Exception:  # noqa: BLE001 — fall back, never break the dashboard
                q = await self._mock.get_quote(symbol, exchange)
                q.source = f"{self.name}-fallback"
                q.entitlement = EntitlementStatus.UNAVAILABLE
                return q

    async def get_history(
        self, instrument_id: str, interval: str, start: datetime, end: datetime
    ) -> list[Candle]:
        # Intentionally delegates to mock for the demo build; wire TIME_SERIES_DAILY here.
        return await self._mock.get_history(instrument_id, interval, start, end)

    async def search_instruments(self, query: str) -> list[Instrument]:
        return await self._mock.search_instruments(query)

    async def get_market_status(self, market: str) -> MarketStatus:
        return await self._mock.get_market_status(market)

    async def get_fx_rate(self, base: str, quote: str) -> FxRate:
        return await self._mock.get_fx_rate(base, quote)

    async def get_news(self, instruments: list[str]) -> list[NewsItem]:
        return await self._mock.get_news(instruments)

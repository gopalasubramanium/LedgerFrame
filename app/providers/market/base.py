"""Market data provider interface. All providers implement this Protocol."""

from __future__ import annotations

from datetime import datetime
from typing import Protocol, runtime_checkable

from app.schemas.common import (
    Candle,
    FxRate,
    Instrument,
    MarketStatus,
    NewsItem,
    Quote,
)


@runtime_checkable
class MarketDataProvider(Protocol):
    #: Human-readable provider name surfaced as quote provenance.
    name: str

    async def get_quote(self, symbol: str, exchange: str | None = None) -> Quote: ...

    async def get_history(
        self, instrument_id: str, interval: str, start: datetime, end: datetime
    ) -> list[Candle]: ...

    async def search_instruments(self, query: str) -> list[Instrument]: ...

    async def get_market_status(self, market: str) -> MarketStatus: ...

    async def get_fx_rate(self, base: str, quote: str) -> FxRate: ...

    async def get_news(self, instruments: list[str]) -> list[NewsItem]: ...

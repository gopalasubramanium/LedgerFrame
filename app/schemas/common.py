"""Shared enums and value objects used across providers, services, and the API."""

from __future__ import annotations

import enum
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class EntitlementStatus(str, enum.Enum):
    REALTIME = "real-time"
    DELAYED = "delayed"
    END_OF_DAY = "end-of-day"
    CACHED = "cached"
    UNAVAILABLE = "unavailable"


class MarketState(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"
    PRE = "pre-market"
    POST = "post-market"
    UNKNOWN = "unknown"


class MoneyModel(BaseModel):
    """Base model that serialises Decimal as float at the JSON edge."""

    model_config = ConfigDict(json_encoders={Decimal: lambda d: float(d)}, from_attributes=True)


class Quote(MoneyModel):
    symbol: str
    exchange: str | None = None
    price: Decimal | None = None  # None == genuinely unavailable; never fabricated
    previous_close: Decimal | None = None
    change: Decimal | None = None
    change_pct: Decimal | None = None
    currency: str = "USD"
    source: str = "mock"
    entitlement: EntitlementStatus = EntitlementStatus.DELAYED
    market_time: datetime | None = None
    received_at: datetime
    is_stale: bool = False


class Candle(MoneyModel):
    ts: datetime
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: Decimal | None = None


class Instrument(MoneyModel):
    symbol: str
    exchange: str | None = None
    name: str = ""
    asset_class: str = "equity"
    currency: str = "USD"
    sector: str | None = None
    country: str | None = None


class MarketStatus(MoneyModel):
    market: str
    state: MarketState
    as_of: datetime
    next_change: datetime | None = None


class FxRate(MoneyModel):
    base: str
    quote: str
    rate: Decimal
    source: str = "mock"
    received_at: datetime
    is_stale: bool = False


class NewsItem(MoneyModel):
    headline: str
    summary: str | None = None
    url: str | None = None
    source: str
    published_at: datetime
    symbols: list[str] = []

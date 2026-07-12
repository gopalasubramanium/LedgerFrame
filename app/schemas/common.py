# SPDX-License-Identifier: AGPL-3.0-or-later
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


class ValuationMethod(str, enum.Enum):
    """HOW a value was arrived at — kept SEPARATE from entitlement (which is about
    data recency/rights). A holding shows both: e.g. entitlement=delayed +
    method=market_quote, or entitlement=unavailable + method=manual_valuation."""

    MARKET_QUOTE = "market_quote"          # a live/delayed exchange or provider quote
    OFFICIAL_NAV = "official_nav"          # fund NAV from an official source (e.g. AMFI)
    BROKER_QUOTE = "broker_quote"          # a broker-supplied mark
    FX_REFERENCE = "fx_reference"          # reference FX (central bank / fallback)
    MANUAL_VALUATION = "manual_valuation"  # user-entered value (cash, property, private)
    STATEMENT_IMPORT = "statement_import"  # value taken from an imported statement
    CALCULATED_ACCRUAL = "calculated_accrual"  # principal + accrued interest (FD/bond)
    ESTIMATED_VALUE = "estimated_value"    # best-effort estimate (e.g. cost fallback)
    UNAVAILABLE = "unavailable"            # no value available


class MoneyModel(BaseModel):
    """Base model that serialises Decimal as float at the JSON edge."""

    model_config = ConfigDict(json_encoders={Decimal: lambda d: float(d)}, from_attributes=True)


class Quote(MoneyModel):
    symbol: str
    exchange: str | None = None
    price: Decimal | None = None  # None == genuinely unavailable; never fabricated
    # D-105: the served DISPLAY string for `price` at class-appropriate precision (set by the quote
    # display formatter; the frontend renders it verbatim, no client formatting). None when no price.
    price_display: str | None = None
    previous_close: Decimal | None = None
    change: Decimal | None = None
    change_pct: Decimal | None = None
    currency: str = "USD"
    source: str = "mock"
    entitlement: EntitlementStatus = EntitlementStatus.DELAYED
    # How this value was derived (separate from entitlement). Defaults to a market
    # quote so every existing provider/quote stays valid without changes.
    valuation_method: ValuationMethod = ValuationMethod.MARKET_QUOTE
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

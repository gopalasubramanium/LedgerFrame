"""Opt-in external market data adapter (Alpha Vantage).

Implements real quotes, daily history, FX, and symbol search against Alpha
Vantage. Enabled only when ``LEDGERFRAME_MARKET_PROVIDER=alphavantage`` and a key
is configured (see docs/DATA_SOURCES.md). It NEVER scrapes pages and reads its key
only from configuration.

Rate limits: Alpha Vantage's free tier is very small (≈25 requests/day). This
adapter serialises requests, detects AV's rate-limit/notice responses, and on any
failure degrades to cached/mock data (labelled accordingly) so the dashboard never
breaks. History is cached in the DB by the market service, so a page load doesn't
re-spend the daily quota.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime

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

log = logging.getLogger(__name__)
_BASE = "https://www.alphavantage.co/query"

# Common crypto tickers — Alpha Vantage serves these via its currency endpoint,
# NOT GLOBAL_QUOTE (which is equities/ETFs only).
_CRYPTO = {"BTC", "ETH", "LTC", "XRP", "BCH", "ADA", "DOGE", "SOL", "DOT", "MATIC", "LINK", "AVAX"}


class RateLimited(Exception):
    """Alpha Vantage returned a rate-limit / notice response."""


def _check_limit(data: dict) -> None:
    # AV signals throttling via "Note" / "Information" (and sometimes "Error Message").
    for key in ("Note", "Information"):
        if key in data:
            raise RateLimited(str(data[key])[:160])


class ExternalMarketDataProvider:
    # Rate-limited: don't fetch on page load — serve cache, refresh via worker/button.
    fetch_on_demand = False

    def __init__(self, name: str, api_key: str):
        if not api_key:
            raise ValueError("external market provider requires an API key")
        self.name = name
        self._key = api_key
        self._mock = MockMarketDataProvider()
        self._sem = asyncio.Semaphore(1)  # respect tight free-tier rate limits

    async def _get(self, params: dict) -> dict:
        params = {**params, "apikey": self._key}
        # Tight timeout so a slow/limited provider can't hang dashboard requests.
        async with self._sem, httpx.AsyncClient(timeout=8) as client:
            r = await client.get(_BASE, params=params)
            r.raise_for_status()
            data = r.json()
        _check_limit(data)
        return data

    async def get_quote(self, symbol: str, exchange: str | None = None) -> Quote:
        now = datetime.now(UTC)
        sym = symbol.upper()
        # Crypto uses the currency endpoint (GLOBAL_QUOTE is equities/ETFs only).
        if sym in _CRYPTO:
            try:
                rate = await self._raw_fx(sym, "USD")  # raises on failure (no mock)
                return Quote(
                    symbol=sym, exchange=exchange, price=rate, currency="USD",
                    source=self.name, entitlement=EntitlementStatus.DELAYED,
                    market_time=now, received_at=now,
                )
            except Exception as exc:  # noqa: BLE001
                log.warning("AV crypto quote unavailable for %s: %s", sym, exc)
                return Quote(symbol=sym, exchange=exchange, price=None, currency="USD",
                             source=self.name, entitlement=EntitlementStatus.UNAVAILABLE,
                             received_at=now, is_stale=True)
        try:
            data = (await self._get({"function": "GLOBAL_QUOTE", "symbol": symbol})).get("Global Quote", {})
            px = data.get("05. price")
            if not px:
                raise ValueError("empty quote (unknown symbol or rate limited)")
            return Quote(
                symbol=symbol.upper(), exchange=exchange,
                price=price(px),
                previous_close=price(data["08. previous close"]) if data.get("08. previous close") else None,
                change=price(data.get("09. change") or 0),
                change_pct=D((data.get("10. change percent") or "0").rstrip("%")),
                currency="USD", source=self.name,
                entitlement=EntitlementStatus.DELAYED, market_time=now, received_at=now,
            )
        except Exception as exc:  # noqa: BLE001
            # NEVER fabricate a price for a live provider — return UNAVAILABLE so the
            # UI shows "—" and the user knows the live feed isn't delivering (e.g. the
            # Alpha Vantage daily limit was hit), not a misleading demo number.
            log.warning("AV quote unavailable for %s: %s", symbol, exc)
            return Quote(
                symbol=symbol.upper(), exchange=exchange, price=None,
                currency="USD", source=self.name,
                entitlement=EntitlementStatus.UNAVAILABLE, received_at=now, is_stale=True,
            )

    async def get_history(self, instrument_id: str, interval: str, start: datetime, end: datetime) -> list[Candle]:
        try:
            outputsize = "full" if (end - start).days > 100 else "compact"
            data = await self._get({"function": "TIME_SERIES_DAILY", "symbol": instrument_id, "outputsize": outputsize})
            series = data.get("Time Series (Daily)") or {}
            if not series:
                raise ValueError("empty history")
            candles: list[Candle] = []
            for date_str, row in series.items():
                ts = datetime.fromisoformat(date_str).replace(tzinfo=UTC)
                if start <= ts <= end:
                    candles.append(Candle(
                        ts=ts, open=price(row["1. open"]), high=price(row["2. high"]),
                        low=price(row["3. low"]), close=price(row["4. close"]),
                        volume=D(row.get("5. volume") or 0),
                    ))
            candles.sort(key=lambda c: c.ts)
            return candles
        except Exception as exc:  # noqa: BLE001
            # No mock fallback for a live provider — return empty so charts show
            # "no data" rather than fabricated history.
            log.warning("AV history unavailable for %s: %s", instrument_id, exc)
            return []

    async def search_instruments(self, query: str) -> list[Instrument]:
        try:
            data = await self._get({"function": "SYMBOL_SEARCH", "keywords": query})
            out: list[Instrument] = []
            for m in data.get("bestMatches", [])[:25]:
                out.append(Instrument(
                    symbol=m.get("1. symbol", "").upper(),
                    name=m.get("2. name", ""),
                    currency=m.get("8. currency", "USD"),
                    country=m.get("4. region"),
                ))
            return out or await self._mock.search_instruments(query)
        except Exception as exc:  # noqa: BLE001
            log.warning("AV search failed: %s", exc)
            return await self._mock.search_instruments(query)

    async def get_market_status(self, market: str) -> MarketStatus:
        return await self._mock.get_market_status(market)

    async def _raw_fx(self, base: str, quote: str):
        """AV exchange rate, raising on failure (no mock fallback)."""
        data = await self._get({
            "function": "CURRENCY_EXCHANGE_RATE", "from_currency": base, "to_currency": quote,
        })
        rate = data.get("Realtime Currency Exchange Rate", {}).get("5. Exchange Rate")
        if not rate:
            raise ValueError("empty fx (unsupported pair or rate limited)")
        return price(rate)

    async def get_fx_rate(self, base: str, quote: str) -> FxRate:
        now = datetime.now(UTC)
        try:
            return FxRate(base=base.upper(), quote=quote.upper(),
                          rate=await self._raw_fx(base, quote), source=self.name, received_at=now)
        except Exception as exc:  # noqa: BLE001
            # FX is needed for currency conversion across the app, so fall back to
            # the (approximate) mock rate rather than breaking valuation.
            log.warning("AV fx fell back to approx for %s/%s: %s", base, quote, exc)
            return await self._mock.get_fx_rate(base, quote)

    async def get_news(self, instruments: list[str]) -> list[NewsItem]:
        # AV has a NEWS_SENTIMENT endpoint, but it's quota-heavy; rely on RSS feeds.
        return []

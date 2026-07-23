# SPDX-License-Identifier: AGPL-3.0-or-later
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
from zoneinfo import ZoneInfo

from app.core.egress import egress_client
from app.core.money import D, price
from app.core.symbols import currency_for_symbol
from app.providers.market.mock import MockMarketDataProvider
from app.schemas.common import (
    Candle,
    EntitlementStatus,
    FailureState,
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

# Alpha Vantage index tickers (premium "Index Data" API, function=INDEX_DATA).
# Routed to that endpoint instead of GLOBAL_QUOTE. Non-premium keys get a notice,
# which we treat as "unavailable" so the Global page falls back to the ETF proxy.
_AV_INDEX_SYMBOLS = {"SPX", "COMP", "NDX", "DJI", "RUT", "RUI", "RUA", "VIX", "OEX", "MID", "SML"}

# R-42 §9-2: the intraday intervals we map ranges to (1D → 1min, 5D → 5min). AV's
# TIME_SERIES_INTRADAY stamps timestamps in US/Eastern market time (there is no UTC
# option), so we localise to UTC — the stored ts stays tz-explicit and time-of-day is
# preserved (intraday is NEVER midnight-normalised, §2.1/§9-5).
_AV_INTRADAY_INTERVALS = {"1min", "5min"}
_AV_INTRADAY_TZ = ZoneInfo("America/New_York")


class RateLimited(Exception):
    """Alpha Vantage returned a rate-limit / notice response."""


def _check_limit(data: dict) -> None:
    # AV signals throttling via "Note" / "Information" (and sometimes "Error Message").
    for key in ("Note", "Information"):
        if key in data:
            raise RateLimited(str(data[key])[:160])


def _find_time_series(data: dict) -> dict:
    """Return a ``{date_str: row}`` mapping from an AV response, tolerating both shapes:

    - the classic ``"Time Series (Daily)": {"2026-06-26": {"4. close": …}}`` (equities), and
    - the Index Data API's ``"data": [{"date": "2026-06-26", "close": …}, …]`` (a list).
    """
    for val in data.values():
        if isinstance(val, dict):
            sample = next(iter(val.values()), None)
            if isinstance(sample, dict) and any("-" in str(k) for k in list(val)[:3]):
                return val
        elif isinstance(val, list) and val and isinstance(val[0], dict):
            date_key = next((k for k in val[0] if "date" in k.lower()), None)
            if date_key:
                return {row[date_key]: row for row in val if row.get(date_key)}
    return {}


def _global_quote(data: dict) -> dict:
    """Return the ``GLOBAL_QUOTE`` payload, tolerating the DECORATED key AlphaVantage uses
    when an ``entitlement`` is requested.

    R-63 root cause: with ``entitlement=delayed`` (sent on every call, ``_get`` below), AV
    returns the quote under ``"Global Quote - DATA DELAYED BY 15 MINUTES"``, not the plain
    ``"Global Quote"``. Reading only the plain key saw ``{}`` on EVERY entitled response and
    reported the price UNAVAILABLE — the price was in the payload the whole time. This mirrors
    the :func:`_find_time_series` key-tolerance already used for history/index.

    Returns ``{}`` when no ``Global Quote*`` key holds a dict (a genuine empty / unknown-symbol
    response — ``{"Global Quote": {}}`` — stays empty → honest no-price, never fabricated)."""
    for k, v in data.items():
        if isinstance(v, dict) and k.lower().startswith("global quote"):
            return v
    return {}


def _row_field(row: dict, name: str):
    """Pull e.g. close/open from a row whose keys may be '4. close' or 'close'."""
    for k, v in row.items():
        if name in k.lower():
            return v
    return None


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
        # Real indices need the premium Index Data API. We *learn* the key's tier
        # from the first index response: None = unknown (attempt once), True =
        # premium (use real indices), False = free (don't waste calls — proxies only).
        self._index_entitled: bool | None = None
        # R-63 §9-2 (I-4, two-premiums): the QUOTE entitlement is a DIFFERENT product from the
        # Index Data one. We learn it from the GLOBAL_QUOTE envelope key AV actually returns —
        # a decorated "… DATA DELAYED BY 15 MINUTES" proves a delayed market-data entitlement,
        # a plain "Global Quote" is the free end-of-day tier. None until the first quote reply.
        self._quote_entitlement: str | None = None
        # R-63 §9-9 (I-7): when we were last rate-limited, so Pricing Health can say
        # "throttled — will retry" honestly rather than reading a throttle as "no price".
        self._last_throttled_at: datetime | None = None

    def _redact(self, text: object) -> str:
        """F-B (§8 secrets): never let a provider error echo our API key into the logs. Alpha
        Vantage's own error bodies quote the submitted key verbatim ("… your API key as <KEY> …"),
        and an httpx error carries the request URL with ``apikey=<KEY>`` — both would land our key
        in ``~/.ledgerframe-data/logs/``. Scrub the key from any string before it is logged."""
        s = str(text)
        if self._key:
            s = s.replace(self._key, "***REDACTED***")
        return s

    @property
    def supports_indices(self) -> bool:
        # Attempt indices until a response proves the key isn't entitled; after that
        # the Global/Markets page uses ETF proxies and we stop burning quota.
        return self._index_entitled is not False

    @property
    def av_tier(self) -> str:
        """'premium' | 'free' | 'unknown' — based on learned Index Data entitlement."""
        return {None: "unknown", True: "premium", False: "free"}[self._index_entitled]

    @property
    def quote_entitlement(self) -> str | None:
        """VERIFIED quote entitlement learned from the GLOBAL_QUOTE envelope AV returned
        ('delayed' / 'real-time' / 'end-of-day'), or None if no quote has been parsed yet.
        Distinct from :attr:`av_tier` (Index Data) — the two-premiums fix (I-4): a tier label
        must reflect what was VERIFIED per product, not a coarse config claim."""
        return self._quote_entitlement

    @property
    def last_throttled_at(self) -> datetime | None:
        return self._last_throttled_at

    def _note_quote_entitlement(self, raw: dict) -> None:
        """Learn the quote entitlement from the (possibly decorated) GLOBAL_QUOTE key."""
        for k in raw:
            kl = k.lower()
            if kl.startswith("global quote"):
                self._quote_entitlement = (
                    "real-time" if ("real-time" in kl or "realtime" in kl)
                    else "delayed" if "delayed" in kl
                    else "end-of-day")
                return

    def _no_quote(self, symbol: str, exchange: str | None, now: datetime,
                  state: FailureState, reason: str) -> Quote:
        """Build an UNAVAILABLE quote that NAMES why (R-63 §9-2) — never a bare 'none'."""
        log.warning("AV quote unavailable for %s: %s (%s)", symbol, self._redact(reason), state.value)
        return Quote(
            symbol=symbol.upper(), exchange=exchange, price=None,
            currency=currency_for_symbol(symbol, exchange) or "USD", source=self.name,
            entitlement=EntitlementStatus.UNAVAILABLE, failure_state=state,
            received_at=now, is_stale=True)

    async def _get(self, params: dict) -> dict:
        # F-4 (owner on-stack confirmation): the working premium call carries entitlement=delayed —
        # it selects the delayed dataset the product is entitled to (AV ignores it where N/A). A
        # caller may override it explicitly.
        params = {"entitlement": "delayed", **params, "apikey": self._key}
        # Tight timeout so a slow/limited provider can't hang dashboard requests.
        async with self._sem, await egress_client("price refresh", timeout=8) as client:
            r = await client.get(_BASE, params=params)
            r.raise_for_status()
            data = r.json()
        _check_limit(data)
        return data

    async def _index_quote(self, sym: str, exchange: str | None) -> Quote:
        """Quote for an index via the premium Index Data API (function=INDEX_DATA).
        Parsed defensively; any problem (not premium, rate limit, unknown symbol,
        unexpected shape) returns UNAVAILABLE so the caller falls back to a proxy."""
        now = datetime.now(UTC)
        try:
            data = await self._get({
                "function": "INDEX_DATA", "symbol": sym, "interval": "daily", "outputsize": "compact",
            })
            series = _find_time_series(data)
            if not series:
                raise ValueError("no index time-series (key not premium or unsupported)")
            dates = sorted(series.keys(), reverse=True)
            close = _row_field(series[dates[0]], "close")
            prev = _row_field(series[dates[1]], "close") if len(dates) > 1 else None
            if close is None:
                raise ValueError("no close field")
            px, pclose = price(close), (price(prev) if prev else None)
            self._index_entitled = True  # a valid index series ⇒ premium key
            return Quote(
                symbol=sym, exchange=exchange, price=px,
                previous_close=pclose,
                change=price(px - pclose) if pclose else None,
                change_pct=D(round((px - pclose) / pclose * 100, 4)) if pclose else None,
                currency="USD", source=self.name, entitlement=EntitlementStatus.DELAYED,
                market_time=now, received_at=now,
            )
        except Exception as exc:  # noqa: BLE001 — never fabricate; fall back to proxy
            # A "not yet entitled to index data" notice ⇒ free key; remember it so we
            # stop attempting indices (rate-limit notices don't prove the tier).
            not_entitled = "entitle" in str(exc).lower()
            if not_entitled:
                self._index_entitled = False
            log.warning("AV index unavailable for %s: %s", sym, self._redact(exc))
            return Quote(symbol=sym, exchange=exchange, price=None, currency="USD",
                         source=self.name, entitlement=EntitlementStatus.UNAVAILABLE,
                         failure_state=(FailureState.UNSUPPORTED if not_entitled
                                        else FailureState.ERRORED),
                         received_at=now, is_stale=True)

    async def get_quote(self, symbol: str, exchange: str | None = None) -> Quote:
        now = datetime.now(UTC)
        sym = symbol.upper()
        # Indices use the premium Index Data API, not GLOBAL_QUOTE.
        if sym in _AV_INDEX_SYMBOLS:
            return await self._index_quote(sym, exchange)
        # Crypto uses the currency endpoint (GLOBAL_QUOTE is equities/ETFs only).
        if sym in _CRYPTO:
            try:
                rate = await self._raw_fx(sym, "USD")  # raises on failure (no mock)
                return Quote(
                    symbol=sym, exchange=exchange, price=rate, currency="USD",
                    source=self.name, entitlement=EntitlementStatus.DELAYED,
                    market_time=now, received_at=now,
                )
            except RateLimited as exc:
                self._last_throttled_at = now
                return self._no_quote(sym, exchange, now, FailureState.THROTTLED, str(exc))
            except ValueError as exc:  # _raw_fx raises this on an empty/unsupported pair
                return self._no_quote(sym, exchange, now, FailureState.EMPTY, str(exc))
            except Exception as exc:  # noqa: BLE001
                return self._no_quote(sym, exchange, now, FailureState.ERRORED, str(exc))
        # R-63 §9-2 — classify the failure distinctly instead of one collapsed "empty quote
        # (unknown symbol or rate limited)". NEVER fabricate a price: a failed fetch returns an
        # UNAVAILABLE quote that NAMES why (throttled / errored / empty / parse_error).
        try:
            raw = await self._get({"function": "GLOBAL_QUOTE", "symbol": symbol})
        except RateLimited as exc:
            self._last_throttled_at = now
            return self._no_quote(symbol, exchange, now, FailureState.THROTTLED, str(exc))
        except Exception as exc:  # noqa: BLE001 — a network/HTTP/JSON error reaching AV
            return self._no_quote(symbol, exchange, now, FailureState.ERRORED, str(exc))

        self._note_quote_entitlement(raw)  # I-4: learn the VERIFIED quote entitlement (property)
        data = _global_quote(raw)
        px = data.get("05. price")
        if px:
            try:
                # AV returns the price in the listing's local currency but doesn't label it —
                # derive it from the symbol suffix (e.g. .BSE -> INR).
                ccy = currency_for_symbol(symbol, exchange) or "USD"
                return Quote(
                    symbol=symbol.upper(), exchange=exchange,
                    price=price(px),
                    previous_close=price(data["08. previous close"]) if data.get("08. previous close") else None,
                    change=price(data.get("09. change") or 0),
                    change_pct=D((data.get("10. change percent") or "0").rstrip("%")),
                    currency=ccy, source=self.name,
                    entitlement=EntitlementStatus.DELAYED, market_time=now, received_at=now,
                )
            except Exception as exc:  # noqa: BLE001 — a malformed numeric field is a parse error
                return self._no_quote(symbol, exchange, now, FailureState.PARSE_ERROR, str(exc))
        # No price. Distinguish a GENUINE empty (a Global Quote* key IS present, the provider just
        # has no price for this symbol — the exonerated .BSE class, probe #5) from an UNRECOGNISED
        # response (a shape we can't interpret — a real parse_error).
        if any(k.lower().startswith("global quote") for k in raw):
            return self._no_quote(symbol, exchange, now, FailureState.EMPTY,
                                  "empty quote — provider had no price for this symbol")
        return self._no_quote(symbol, exchange, now, FailureState.PARSE_ERROR,
                              f"unrecognised response keys: {list(raw)[:3]}")

    async def get_history(self, instrument_id: str, interval: str, start: datetime, end: datetime) -> list[Candle]:
        try:
            outputsize = "full" if (end - start).days > 100 else "compact"
            is_intraday = interval in _AV_INTRADAY_INTERVALS
            is_index = instrument_id.upper() in _AV_INDEX_SYMBOLS
            if is_intraday:
                # R-42 §9-3: intraday is a premium AV tier; the server-side av_tier gate
                # refuses it before we ever get here for a free/unknown key. `outputsize=full`
                # returns the full trailing intraday window (~30 days) — we filter to [start,end].
                data = await self._get({
                    "function": "TIME_SERIES_INTRADAY", "symbol": instrument_id,
                    "interval": interval, "outputsize": "full",
                    # W-3 (R-42 3b): regular trading hours only. AV defaults extended_hours=true,
                    # which returns 04:00–20:00 ET pre/post-market bars whose thin volume against
                    # the regular-session open/close rendered as session-boundary spikes on 5D.
                    # The honest default for this product is the regular session (09:30–16:00 ET).
                    "extended_hours": "false",
                })
                series = data.get(f"Time Series ({interval})") or _find_time_series(data)
            elif is_index:
                data = await self._get({
                    "function": "INDEX_DATA", "symbol": instrument_id, "interval": "daily", "outputsize": outputsize,
                })
                series = _find_time_series(data)
            else:
                data = await self._get({"function": "TIME_SERIES_DAILY", "symbol": instrument_id, "outputsize": outputsize})
                series = data.get("Time Series (Daily)") or {}
            if not series:
                raise ValueError("empty history")
            candles: list[Candle] = []
            for date_str, row in series.items():
                ts = datetime.fromisoformat(date_str)
                # Intraday timestamps are US/Eastern market time → localise to UTC (tz-explicit,
                # time-of-day preserved); daily timestamps are date-only → midnight UTC.
                ts = ts.replace(tzinfo=_AV_INTRADAY_TZ).astimezone(UTC) if is_intraday \
                    else ts.replace(tzinfo=UTC)
                if not (start <= ts <= end):
                    continue
                # Field names tolerated (AV uses '1. open'… but index keys may vary).
                close = _row_field(row, "close")
                if close is None:
                    continue
                o = _row_field(row, "open") or close
                h = _row_field(row, "high") or close
                low = _row_field(row, "low") or close
                candles.append(Candle(
                    ts=ts, open=price(o), high=price(h), low=price(low), close=price(close),
                    volume=D(_row_field(row, "volume") or 0),
                ))
            candles.sort(key=lambda c: c.ts)
            return candles
        except Exception as exc:  # noqa: BLE001
            # No mock fallback for a live provider — return empty so charts show
            # "no data" rather than fabricated history.
            log.warning("AV history unavailable for %s: %s", instrument_id, self._redact(exc))
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
            log.warning("AV search failed: %s", self._redact(exc))
            return await self._mock.search_instruments(query)

    async def get_market_status(self, market: str) -> MarketStatus:
        return await self._mock.get_market_status(market)

    async def _raw_fx(self, base: str, quote: str):
        """AV exchange rate, raising on failure (no mock fallback)."""
        data = await self._get({
            "function": "CURRENCY_EXCHANGE_RATE", "from_currency": base, "to_currency": quote,
        })
        # R-63 §9-0 audit: tolerate a decorated key here too (same fragility class as the quote
        # envelope), so an entitlement-decorated FX response never reads as an empty rate.
        payload = next((v for k, v in data.items()
                        if isinstance(v, dict) and "exchange rate" in k.lower()), {})
        rate = payload.get("5. Exchange Rate")
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
            log.warning("AV fx fell back to approx for %s/%s: %s", base, quote, self._redact(exc))
            return await self._mock.get_fx_rate(base, quote)

    async def get_news(self, instruments: list[str]) -> list[NewsItem]:
        # AV has a NEWS_SENTIMENT endpoint, but it's quota-heavy; rely on RSS feeds.
        return []

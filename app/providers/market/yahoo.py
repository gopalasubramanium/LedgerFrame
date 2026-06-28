"""Yahoo Finance provider — free, no API key required.

Uses Yahoo's public chart/search JSON endpoints. Serves **real index levels**
(^GSPC, ^IXIC, ^DJI, ^FTSE, ^N225, ^NSEI, …), global equities (RELIANCE.NS,
VOD.L, 7203.T), FX (EURUSD=X) and crypto (BTC-USD) — each in the listing's own
currency, which Yahoo reports directly.

These are unofficial endpoints, so every call degrades cleanly: a failure returns
an "unavailable" quote (never a fabricated price), and FX/search fall back to the
mock provider so valuation never breaks. It is opt-in (selected in Settings).
"""

from __future__ import annotations

import asyncio
import logging
import time
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
)
from app.schemas.common import Quote as Quote

log = logging.getLogger(__name__)

_CHART = "https://query1.finance.yahoo.com/v8/finance/chart/{sym}"
_SEARCH = "https://query1.finance.yahoo.com/v1/finance/search"
_UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")

# Common crypto tickers → Yahoo's "<SYM>-USD" form.
_CRYPTO = {"BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "BNB", "LTC", "DOT", "MATIC", "AVAX", "LINK"}
# Our exchange suffixes that differ from Yahoo's (Indian exchanges).
_SUFFIX_MAP = {"BSE": "BO", "NSE": "NS"}


def to_yahoo_symbol(symbol: str) -> str:
    """Translate an internal symbol to Yahoo's convention."""
    s = symbol.strip().upper()
    if s in _CRYPTO:
        return f"{s}-USD"
    if "." in s:
        base, suffix = s.rsplit(".", 1)
        return f"{base}.{_SUFFIX_MAP.get(suffix, suffix)}"
    return s


def _range_for(days: int) -> str:
    if days <= 5:
        return "5d"
    if days <= 31:
        return "1mo"
    if days <= 93:
        return "3mo"
    if days <= 186:
        return "6mo"
    if days <= 370:
        return "1y"
    if days <= 740:
        return "2y"
    return "5y"


class YahooMarketDataProvider:
    name = "yahoo"
    #: The Global page uses real index symbols (^GSPC, …) on providers that set this.
    supports_indices = True
    #: Yahoo's public endpoint rate-limits bursts hard (HTTP 429), so we DON'T fetch
    #: on page load — display serves the cache and the background worker refreshes
    #: symbols one at a time, paced (see `_get`). The dashboard stays responsive and
    #: Yahoo stays happy.
    fetch_on_demand = False

    def __init__(self) -> None:
        self._mock = MockMarketDataProvider()  # status + last-resort FX/search/news
        # Serialize ALL Yahoo calls with a minimum interval — one shared throttle
        # across the whole process, so the worker's refresh loop can't burst.
        self._lock = asyncio.Lock()
        self._last = 0.0
        self._min_interval = 1.5  # seconds between requests (Yahoo throttles bursts)

    async def _get(self, url: str, params: dict) -> dict:
        """Paced GET with 429 backoff. Serialized so we never burst Yahoo."""
        async with self._lock:
            for attempt in range(3):
                wait = self._min_interval - (time.monotonic() - self._last)
                if wait > 0:
                    await asyncio.sleep(wait)
                try:
                    async with httpx.AsyncClient(
                        timeout=httpx.Timeout(12.0, connect=5.0), headers={"User-Agent": _UA},
                    ) as client:
                        r = await client.get(url, params=params)
                    if r.status_code == 429 and attempt < 2:
                        await asyncio.sleep(1.5 * (attempt + 1))  # back off, then retry
                        continue
                    r.raise_for_status()
                    return r.json()
                finally:
                    self._last = time.monotonic()
            raise RuntimeError("rate limited (429)")

    async def _chart(self, ysym: str, params: dict) -> dict:
        data = await self._get(_CHART.format(sym=ysym), params)
        results = (data.get("chart") or {}).get("result") or []
        if not results:
            raise ValueError("empty chart result")
        return results[0]

    async def get_quote(self, symbol: str, exchange: str | None = None) -> Quote:
        now = datetime.now(UTC)
        ysym = to_yahoo_symbol(symbol)
        try:
            meta = (await self._chart(ysym, {"interval": "1d", "range": "5d"}))["meta"]
            px = meta.get("regularMarketPrice")
            if px is None:
                raise ValueError("no price in meta")
            prev = meta.get("chartPreviousClose") or meta.get("previousClose")
            ccy = meta.get("currency") or "USD"
            change = (px - prev) if prev else None
            return Quote(
                symbol=symbol.upper(), exchange=exchange, price=price(px),
                previous_close=price(prev) if prev else None,
                change=price(change) if change is not None else None,
                change_pct=D(round((change / prev) * 100, 4)) if prev else None,
                currency=ccy, source=self.name, entitlement=EntitlementStatus.DELAYED,
                market_time=now, received_at=now,
            )
        except Exception as exc:  # noqa: BLE001 — never fabricate a price
            log.warning("yahoo quote unavailable for %s (%s): %s", symbol, ysym, exc)
            return Quote(
                symbol=symbol.upper(), exchange=exchange, price=None, currency="USD",
                source=self.name, entitlement=EntitlementStatus.UNAVAILABLE,
                received_at=now, is_stale=True,
            )

    async def get_history(self, instrument_id: str, interval: str, start: datetime, end: datetime) -> list[Candle]:
        ysym = to_yahoo_symbol(instrument_id)
        try:
            res = await self._chart(ysym, {"interval": "1d", "range": _range_for((end - start).days)})
            ts = res.get("timestamp") or []
            q = (res.get("indicators") or {}).get("quote") or [{}]
            q0 = q[0] if q else {}
            opens, highs, lows, closes = (q0.get("open") or []), (q0.get("high") or []), (q0.get("low") or []), (q0.get("close") or [])
            vols = q0.get("volume") or []
            out: list[Candle] = []
            for i, t in enumerate(ts):
                c = closes[i] if i < len(closes) else None
                if c is None:
                    continue
                dt = datetime.fromtimestamp(t, UTC)
                if not (start <= dt <= end):
                    continue
                out.append(Candle(
                    ts=dt,
                    open=price(opens[i] if i < len(opens) and opens[i] is not None else c),
                    high=price(highs[i] if i < len(highs) and highs[i] is not None else c),
                    low=price(lows[i] if i < len(lows) and lows[i] is not None else c),
                    close=price(c),
                    volume=D(vols[i] if i < len(vols) and vols[i] is not None else 0),
                ))
            out.sort(key=lambda x: x.ts)
            return out
        except Exception as exc:  # noqa: BLE001 — no fabricated history
            log.warning("yahoo history unavailable for %s: %s", ysym, exc)
            return []

    async def search_instruments(self, query: str) -> list[Instrument]:
        try:
            data = await self._get(_SEARCH, {"q": query, "quotesCount": 15, "newsCount": 0})
            out: list[Instrument] = []
            for item in data.get("quotes", []):
                sym = item.get("symbol")
                if not sym:
                    continue
                out.append(Instrument(
                    symbol=sym,
                    name=item.get("shortname") or item.get("longname") or sym,
                    currency=item.get("currency") or "USD",
                    country=item.get("exchange"),
                ))
            return out or await self._mock.search_instruments(query)
        except Exception as exc:  # noqa: BLE001
            log.warning("yahoo search failed: %s", exc)
            return await self._mock.search_instruments(query)

    async def get_market_status(self, market: str) -> MarketStatus:
        return await self._mock.get_market_status(market)

    async def get_fx_rate(self, base: str, quote: str) -> FxRate:
        now = datetime.now(UTC)
        b, qc = base.upper(), quote.upper()
        if b == qc:
            return FxRate(base=b, quote=qc, rate=D(1), source=self.name, received_at=now)
        try:
            meta = (await self._chart(f"{b}{qc}=X", {"interval": "1d", "range": "1d"}))["meta"]
            rate = meta.get("regularMarketPrice")
            if not rate:
                raise ValueError("no fx rate")
            return FxRate(base=b, quote=qc, rate=price(rate), source=self.name, received_at=now)
        except Exception as exc:  # noqa: BLE001 — keep valuation working
            log.warning("yahoo fx fell back to mock for %s/%s: %s", b, qc, exc)
            return await self._mock.get_fx_rate(base, quote)

    async def get_news(self, instruments: list[str]) -> list[NewsItem]:
        # Headlines come from the free RSS feeds layer; nothing extra here.
        return await self._mock.get_news(instruments)

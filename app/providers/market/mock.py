# SPDX-License-Identifier: AGPL-3.0-or-later
"""Synthetic market data provider — the default "DEMO" mode.

Generates deterministic, realistic-looking prices from a per-symbol seed so the
same symbol yields a stable series across restarts. Everything it returns is
labelled DEMO and entitlement ``delayed`` so nothing is ever mistaken for live.
"""

from __future__ import annotations

import hashlib
import math
from datetime import UTC, datetime, timedelta

from app.core.money import D, price
from app.core.symbols import currency_for_symbol
from app.schemas.common import (
    Candle,
    EntitlementStatus,
    FxRate,
    Instrument,
    MarketState,
    MarketStatus,
    NewsItem,
    Quote,
)

# A small, varied universe so the demo dashboards feel populated.
_CATALOG: dict[str, dict] = {
    "AAPL": {"name": "Apple Inc. (DEMO)", "ac": "equity", "ccy": "USD", "sec": "Technology", "ctry": "US", "base": 195.0},
    "MSFT": {"name": "Microsoft Corp. (DEMO)", "ac": "equity", "ccy": "USD", "sec": "Technology", "ctry": "US", "base": 420.0},
    "NVDA": {"name": "NVIDIA Corp. (DEMO)", "ac": "equity", "ccy": "USD", "sec": "Technology", "ctry": "US", "base": 125.0},
    "AMZN": {"name": "Amazon.com Inc. (DEMO)", "ac": "equity", "ccy": "USD", "sec": "Consumer", "ctry": "US", "base": 185.0},
    "GOOGL": {"name": "Alphabet Inc. (DEMO)", "ac": "equity", "ccy": "USD", "sec": "Technology", "ctry": "US", "base": 175.0},
    "TSLA": {"name": "Tesla Inc. (DEMO)", "ac": "equity", "ccy": "USD", "sec": "Consumer", "ctry": "US", "base": 250.0},
    "JPM": {"name": "JPMorgan Chase (DEMO)", "ac": "equity", "ccy": "USD", "sec": "Financials", "ctry": "US", "base": 205.0},
    "VOO": {"name": "S&P 500 ETF (DEMO)", "ac": "etf", "ccy": "USD", "sec": "Index", "ctry": "US", "base": 500.0},
    "VWRA": {"name": "World Equity ETF (DEMO)", "ac": "etf", "ccy": "USD", "sec": "Index", "ctry": "IE", "base": 130.0},
    "D05": {"name": "DBS Group (DEMO)", "ac": "equity", "ccy": "SGD", "sec": "Financials", "ctry": "SG", "base": 38.0},
    "O39": {"name": "OCBC Bank (DEMO)", "ac": "equity", "ccy": "SGD", "sec": "Financials", "ctry": "SG", "base": 15.0},
    "RELIANCE": {"name": "Reliance Industries (DEMO)", "ac": "equity", "ccy": "INR", "sec": "Energy", "ctry": "IN", "base": 2900.0},
    "HDFCNIFTY": {"name": "HDFC NIFTY 50 Index Fund (DEMO)", "ac": "mutual_fund", "ccy": "INR", "sec": "Index / ETF", "ctry": "IN", "base": 245.0},
    "^GSPC": {"name": "S&P 500 Index (DEMO)", "ac": "etf", "ccy": "USD", "sec": "Index", "ctry": "US", "base": 5400.0},
    "^DJI": {"name": "Dow Jones Industrial (DEMO)", "ac": "etf", "ccy": "USD", "sec": "Index", "ctry": "US", "base": 39000.0},
    "^IXIC": {"name": "Nasdaq Composite (DEMO)", "ac": "etf", "ccy": "USD", "sec": "Index", "ctry": "US", "base": 17500.0},
    "^FTSE": {"name": "FTSE 100 (DEMO)", "ac": "etf", "ccy": "GBP", "sec": "Index", "ctry": "GB", "base": 8200.0},
    "^GDAXI": {"name": "DAX (DEMO)", "ac": "etf", "ccy": "EUR", "sec": "Index", "ctry": "DE", "base": 18500.0},
    "^N225": {"name": "Nikkei 225 (DEMO)", "ac": "etf", "ccy": "JPY", "sec": "Index", "ctry": "JP", "base": 39500.0},
    "^HSI": {"name": "Hang Seng (DEMO)", "ac": "etf", "ccy": "HKD", "sec": "Index", "ctry": "HK", "base": 18000.0},
    "^BSESN": {"name": "BSE Sensex (DEMO)", "ac": "etf", "ccy": "INR", "sec": "Index", "ctry": "IN", "base": 78000.0},
    "^STI": {"name": "Straits Times Index (DEMO)", "ac": "etf", "ccy": "SGD", "sec": "Index", "ctry": "SG", "base": 3400.0},
    "GLD": {"name": "Gold (DEMO)", "ac": "commodity", "ccy": "USD", "sec": "Commodity", "ctry": "US", "base": 2350.0},
    "SLV": {"name": "Silver ETF (DEMO)", "ac": "commodity", "ccy": "USD", "sec": "Commodity", "ctry": "US", "base": 28.0},
    "USO": {"name": "US Oil Fund (DEMO)", "ac": "commodity", "ccy": "USD", "sec": "Commodity", "ctry": "US", "base": 78.0},
    "SPY": {"name": "S&P 500 ETF (DEMO)", "ac": "etf", "ccy": "USD", "sec": "Index", "ctry": "US", "base": 540.0},
    "QQQ": {"name": "Nasdaq 100 ETF (DEMO)", "ac": "etf", "ccy": "USD", "sec": "Index", "ctry": "US", "base": 480.0},
    "DIA": {"name": "Dow 30 ETF (DEMO)", "ac": "etf", "ccy": "USD", "sec": "Index", "ctry": "US", "base": 390.0},
    "EWU": {"name": "UK (FTSE) ETF (DEMO)", "ac": "etf", "ccy": "USD", "sec": "Index", "ctry": "GB", "base": 35.0},
    "EWG": {"name": "Germany (DAX) ETF (DEMO)", "ac": "etf", "ccy": "USD", "sec": "Index", "ctry": "DE", "base": 34.0},
    "EZU": {"name": "Eurozone ETF (DEMO)", "ac": "etf", "ccy": "USD", "sec": "Index", "ctry": "EU", "base": 50.0},
    "EWJ": {"name": "Japan (Nikkei) ETF (DEMO)", "ac": "etf", "ccy": "USD", "sec": "Index", "ctry": "JP", "base": 72.0},
    "EWH": {"name": "Hong Kong ETF (DEMO)", "ac": "etf", "ccy": "USD", "sec": "Index", "ctry": "HK", "base": 18.0},
    "INDA": {"name": "India (Nifty) ETF (DEMO)", "ac": "etf", "ccy": "USD", "sec": "Index", "ctry": "IN", "base": 55.0},
    "EWS": {"name": "Singapore ETF (DEMO)", "ac": "etf", "ccy": "USD", "sec": "Index", "ctry": "SG", "base": 24.0},
    "FEZ": {"name": "Euro Stoxx 50 ETF (DEMO)", "ac": "etf", "ccy": "USD", "sec": "Index", "ctry": "EU", "base": 52.0},
    "BTC": {"name": "Bitcoin (DEMO)", "ac": "crypto", "ccy": "USD", "sec": "Crypto", "ctry": "XX", "base": 64000.0},
    "ETH": {"name": "Ethereum (DEMO)", "ac": "crypto", "ccy": "USD", "sec": "Crypto", "ctry": "XX", "base": 3400.0},
}

# Plausible FX rates relative to USD (DEMO).
_USD_RATES = {"USD": 1.0, "SGD": 1.35, "INR": 83.5, "EUR": 0.92, "GBP": 0.79, "JPY": 157.0, "AUD": 1.50, "CNY": 7.25, "HKD": 7.81}


def _seed(text: str) -> int:
    return int(hashlib.sha256(text.encode()).hexdigest()[:8], 16)


def _walk(symbol: str, day: int) -> float:
    """Deterministic multiplicative factor for a given symbol & day index.

    Amplitude, period AND phase of every component are derived from the
    per-symbol seed — not just the phase — so different symbols trace visibly
    different shapes (different number of humps, different heights), never one
    shared envelope under many names. This keeps the demo charts distinct after
    the PriceChart min/max normalisation, which strips the differing base level.
    Bounded to roughly [0.80, 1.20]; fully reproducible across restarts.
    """
    s = _seed(symbol)
    # Slow swing — period 7..29 days, amplitude 0.040..0.099.
    amp1 = 0.04 + (s % 60) / 1000.0
    per1 = 7.0 + (s // 60 % 23)
    slow = math.sin((day + s % 97) / per1) * amp1
    # Fast wobble — period 1.7..4.9, amplitude 0.015..0.039.
    amp2 = 0.015 + (s // 7 % 25) / 1000.0
    per2 = 1.7 + (s // 11 % 17) / 5.0
    fast = math.sin((day + s % 31) / per2) * amp2
    # Long swell — period 30..89 days, amplitude 0.020..0.059 (shape variety).
    amp3 = 0.02 + (s // 13 % 40) / 1000.0
    per3 = 30.0 + (s // 17 % 60)
    swell = math.sin((day + s % 53) / per3) * amp3
    return 1.0 + slow + fast + swell


class MockMarketDataProvider:
    name = "mock"

    def _info(self, symbol: str) -> dict:
        return _CATALOG.get(
            symbol.upper(),
            {"name": f"{symbol.upper()} (DEMO)", "ac": "equity", "ccy": "USD",
             "sec": "Unknown", "ctry": "US", "base": 100.0},
        )

    async def get_quote(self, symbol: str, exchange: str | None = None) -> Quote:
        info = self._info(symbol)
        now = datetime.now(UTC)
        day = now.toordinal()
        cur = info["base"] * _walk(symbol, day)
        prev = info["base"] * _walk(symbol, day - 1)
        return Quote(
            symbol=symbol.upper(),
            exchange=exchange,
            price=price(cur),
            previous_close=price(prev),
            change=price(cur - prev),
            change_pct=D(round((cur - prev) / prev * 100, 2)) if prev else None,
            currency=currency_for_symbol(symbol, exchange) or info["ccy"],
            source="mock",
            entitlement=EntitlementStatus.DELAYED,
            market_time=now,
            received_at=now,
            is_stale=False,
        )

    async def get_history(
        self, instrument_id: str, interval: str, start: datetime, end: datetime
    ) -> list[Candle]:
        info = self._info(instrument_id)
        step = timedelta(days=1) if interval in ("1d", "1w", "1mo") else timedelta(minutes=30)
        candles: list[Candle] = []
        t = start
        while t <= end:
            idx = t.toordinal() if step.days else int(t.timestamp() // 1800)
            base = info["base"] * _walk(instrument_id, idx)
            o = base * (1 + math.sin(idx / 5.0) * 0.004)
            c = base
            hi = max(o, c) * 1.008
            lo = min(o, c) * 0.992
            candles.append(
                Candle(
                    ts=t,
                    open=price(o),
                    high=price(hi),
                    low=price(lo),
                    close=price(c),
                    volume=D(1_000_000 + (_seed(instrument_id + str(idx)) % 4_000_000)),
                )
            )
            t += step
        return candles

    async def search_instruments(self, query: str) -> list[Instrument]:
        q = query.upper()
        out: list[Instrument] = []
        for sym, info in _CATALOG.items():
            if q in sym or q in info["name"].upper():
                out.append(
                    Instrument(
                        symbol=sym, name=info["name"], asset_class=info["ac"],
                        currency=info["ccy"], sector=info["sec"], country=info["ctry"],
                    )
                )
        return out[:25]

    async def get_market_status(self, market: str) -> MarketStatus:
        now = datetime.now(UTC)
        # Rough demo schedule: US equities open 13:30–20:00 UTC on weekdays.
        weekday = now.weekday() < 5
        state = MarketState.OPEN if (weekday and 13 <= now.hour < 20) else MarketState.CLOSED
        return MarketStatus(market=market, state=state, as_of=now)

    async def get_fx_rate(self, base: str, quote: str) -> FxRate:
        b, qc = base.upper(), quote.upper()
        now = datetime.now(UTC)
        rate = _USD_RATES.get(qc, 1.0) / _USD_RATES.get(b, 1.0)
        # Small deterministic daily wobble.
        rate *= 1 + math.sin((now.toordinal() + _seed(b + qc)) / 15.0) * 0.01
        return FxRate(base=b, quote=qc, rate=price(rate), source="mock", received_at=now)

    async def get_news(self, instruments: list[str]) -> list[NewsItem]:
        now = datetime.now(UTC)
        items: list[NewsItem] = []
        templates = [
            "{name} steadies as broad market digests rate expectations",
            "Analysts weigh {name} outlook amid sector rotation",
            "{name} trading volume in line with recent averages",
        ]
        for i, sym in enumerate(instruments[:6]):
            info = self._info(sym)
            items.append(
                NewsItem(
                    headline="[DEMO] " + templates[i % len(templates)].format(name=info["name"]),
                    summary="Synthetic demo headline. Configure a market provider for real news.",
                    url=None,
                    source="LedgerFrame DEMO",
                    published_at=now - timedelta(hours=i + 1),
                    symbols=[sym.upper()],
                )
            )
        return items

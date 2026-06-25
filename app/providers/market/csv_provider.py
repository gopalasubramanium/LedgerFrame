"""CSV-backed market data provider for local-only / testing use.

Reads OHLCV history from ``<imports_dir>/<SYMBOL>.csv`` with a header:
    date,open,high,low,close,volume
The latest row becomes the quote (entitlement = end-of-day). Falls back to the
mock provider for any symbol without a CSV so dashboards never go blank.
"""

from __future__ import annotations

import csv
from datetime import datetime, timezone
from pathlib import Path

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

MAX_CSV_BYTES = 10 * 1024 * 1024  # 10 MB safety cap


class CSVMarketDataProvider:
    name = "csv"

    def __init__(self, imports_dir: Path):
        self.imports_dir = imports_dir
        self._mock = MockMarketDataProvider()

    def _path(self, symbol: str) -> Path:
        return self.imports_dir / f"{symbol.upper()}.csv"

    def _read(self, symbol: str) -> list[Candle]:
        path = self._path(symbol)
        if not path.exists() or path.stat().st_size > MAX_CSV_BYTES:
            return []
        candles: list[Candle] = []
        with path.open(newline="") as fh:
            for row in csv.DictReader(fh):
                try:
                    candles.append(
                        Candle(
                            ts=datetime.fromisoformat(row["date"]).replace(tzinfo=timezone.utc),
                            open=price(row["open"]),
                            high=price(row["high"]),
                            low=price(row["low"]),
                            close=price(row["close"]),
                            volume=D(row.get("volume") or 0),
                        )
                    )
                except (KeyError, ValueError):
                    continue
        candles.sort(key=lambda c: c.ts)
        return candles

    async def get_quote(self, symbol: str, exchange: str | None = None) -> Quote:
        candles = self._read(symbol)
        if len(candles) < 1:
            return await self._mock.get_quote(symbol, exchange)
        last = candles[-1]
        prev = candles[-2].close if len(candles) > 1 else last.open
        return Quote(
            symbol=symbol.upper(),
            exchange=exchange,
            price=last.close,
            previous_close=prev,
            change=price(last.close - prev),
            change_pct=D(round((last.close - prev) / prev * 100, 2)) if prev else None,
            currency="USD",
            source="csv",
            entitlement=EntitlementStatus.END_OF_DAY,
            market_time=last.ts,
            received_at=datetime.now(timezone.utc),
        )

    async def get_history(
        self, instrument_id: str, interval: str, start: datetime, end: datetime
    ) -> list[Candle]:
        candles = self._read(instrument_id)
        if not candles:
            return await self._mock.get_history(instrument_id, interval, start, end)
        return [c for c in candles if start <= c.ts <= end]

    async def search_instruments(self, query: str) -> list[Instrument]:
        out: list[Instrument] = []
        for p in self.imports_dir.glob("*.csv"):
            sym = p.stem.upper()
            if query.upper() in sym:
                out.append(Instrument(symbol=sym, name=f"{sym} (CSV)", currency="USD"))
        return out or await self._mock.search_instruments(query)

    async def get_market_status(self, market: str) -> MarketStatus:
        return await self._mock.get_market_status(market)

    async def get_fx_rate(self, base: str, quote: str) -> FxRate:
        return await self._mock.get_fx_rate(base, quote)

    async def get_news(self, instruments: list[str]) -> list[NewsItem]:
        return []

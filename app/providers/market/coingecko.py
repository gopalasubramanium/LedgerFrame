# SPDX-License-Identifier: AGPL-3.0-or-later
"""CoinGecko crypto adapter (opt-in) — canonical-ID pricing.

Source: CoinGecko's public API (no key on the free tier). This module is the parser
+ HTTP fetch only; storage/lookup lives in ``app/services/coingecko.py``. Spec rules:

- Resolve and store the **canonical CoinGecko id**, never symbol alone — many coins
  share a symbol (e.g. two different tokens are both "btc"), so a holding must be
  mapped by id.
- Support multiple target currencies (USD/SGD/INR…).
- A missing / zero / non-positive price is **unavailable — never fabricated**.
- No wallet keys or private wallet access. Deterministic, fixture-driven tests.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal, InvalidOperation

from app.core.egress import egress_client
from app.schemas.common import Candle

BASE_URL = "https://api.coingecko.com/api/v3"
VS_CURRENCIES = ("usd", "sgd", "inr", "eur", "gbp")

# §12 step 4 — CoinGecko free/public-API historical policy (documented, honest):
#   • /coins/{id}/market_chart/range auto-selects granularity by range width: 1 day → 5-minutely,
#     2–90 days → hourly, >90 days → DAILY at 00:00 UTC. We always request >90-day ranges so the
#     points are daily-midnight (the valuation cadence).
#   • The free/public tier caps historical depth at the PAST 365 DAYS. Older data needs a paid plan
#     — an honest limit; a date before the cap is honestly-missing, never fabricated.
# Source: CoinGecko public API docs (Market Chart Range By ID; historical data range on the free
# plan). The exact free-tier depth is confirmed on the owner's stack (the STOP-window BTC call).
CRYPTO_HISTORY_FREE_TIER_DAYS = 365


@dataclass(frozen=True)
class CoinMeta:
    id: str
    symbol: str
    name: str


@dataclass(frozen=True)
class CoinPrice:
    id: str
    prices: dict[str, Decimal]      # ccy(lower) -> price (>0 only)
    market_cap_usd: Decimal | None
    last_updated: datetime | None


def parse_coins_list(data: list) -> list[CoinMeta]:
    out: list[CoinMeta] = []
    for row in data or []:
        cid = str(row.get("id", "")).strip()
        if not cid:
            continue
        out.append(CoinMeta(id=cid, symbol=str(row.get("symbol", "")).strip().lower(),
                            name=str(row.get("name", "")).strip()))
    return out


def _dec(v) -> Decimal | None:
    try:
        d = Decimal(str(v))
    except (InvalidOperation, ValueError, TypeError):
        return None
    return d if d > 0 else None


def parse_simple_price(data: dict) -> dict[str, CoinPrice]:
    """Parse a ``/simple/price`` response into per-id prices. Zero/absent prices are
    dropped (unavailable), never coerced to a fabricated value."""
    out: dict[str, CoinPrice] = {}
    for cid, row in (data or {}).items():
        if not isinstance(row, dict):
            continue
        prices: dict[str, Decimal] = {}
        for ccy in VS_CURRENCIES:
            p = _dec(row.get(ccy))
            if p is not None:
                prices[ccy] = p
        ts = row.get("last_updated_at")
        out[str(cid)] = CoinPrice(
            id=str(cid), prices=prices,
            market_cap_usd=_dec(row.get("usd_market_cap")),
            last_updated=datetime.fromtimestamp(ts, UTC) if isinstance(ts, (int, float)) else None,
        )
    return out


def parse_market_chart_range(data: dict) -> list[Candle]:
    """Parse ``/coins/{id}/market_chart/range`` into daily candles.

    The ``prices`` array is ``[[ms_epoch, price], …]`` — one reference price per point. For a
    >90-day range CoinGecko returns one point per day at 00:00 UTC; we key each to midnight UTC.
    CoinGecko gives a single price per point (not OHLC), so open/high/low/close all carry that
    daily reference price — honest (no fabricated intraday range). A non-positive price is dropped
    (unavailable, never a fabricated 0). Volume is matched from ``total_volumes`` by timestamp."""
    prices = (data or {}).get("prices") or []
    vols = {int(ts): v for ts, v in ((data or {}).get("total_volumes") or []) if isinstance(ts, (int, float))}
    out: list[Candle] = []
    seen: set[str] = set()
    for point in prices:
        if not isinstance(point, (list, tuple)) or len(point) < 2:
            continue
        ms, raw = point[0], point[1]
        if not isinstance(ms, (int, float)):
            continue
        price = _dec(raw)
        if price is None:
            continue  # zero/absent → unavailable, never fabricated
        # Normalise to midnight UTC (the daily key); dedup if two points land on the same date.
        day = datetime.fromtimestamp(ms / 1000, UTC).date()
        iso = day.isoformat()
        if iso in seen:
            continue
        seen.add(iso)
        vol = _dec(vols.get(int(ms)))
        out.append(Candle(ts=datetime(day.year, day.month, day.day, tzinfo=UTC),
                          open=price, high=price, low=price, close=price, volume=vol))
    out.sort(key=lambda c: c.ts)
    return out


def clamp_to_free_tier(start: datetime, end: datetime,
                       max_days: int = CRYPTO_HISTORY_FREE_TIER_DAYS) -> tuple[datetime, bool]:
    """F-8a: clamp ``start`` into CoinGecko's public-API historical window.

    ``CRYPTO_HISTORY_FREE_TIER_DAYS`` was DOCUMENTED above and then never applied — the acquirer
    asked for the whole holding period, so a crypto bought more than a year ago produced a request
    the public API rejects outright (HTTP 401, ``error_code 10012``: "Your request exceeds the
    allowed time range"). The refusal was swallowed per-instrument, so BTC/XRP acquired **zero rows,
    every build, forever** — a limit written in a comment is not a limit.

    A margin day is subtracted because the cap is enforced against request time, not our clock.
    Returns ``(start, clamped)``; ``clamped`` is True when history older than the window was
    dropped, so the caller can say so HONESTLY instead of implying full depth."""
    floor = end - timedelta(days=max_days - 1)
    return (floor, True) if start < floor else (start, False)


async def fetch_market_chart_range(coin_id: str, vs_currency: str, start: datetime, end: datetime,
                                   timeout: float = 30.0) -> dict:
    """One CoinGecko ``market_chart/range`` fetch = the daily reference-price series for ``coin_id``
    over ``[start, end]`` in ``vs_currency``. Routed through the egress choke point (no-egress →
    EgressBlocked). Request a >90-day window so the returned granularity is DAILY (00:00 UTC).

    The range is clamped to the public-API window (F-8a) — beyond it the API refuses the whole
    request, so an unclamped call returns NOTHING rather than less."""
    start, _clamped = clamp_to_free_tier(start, end)
    params = {"vs_currency": (vs_currency or "usd").lower(),
              "from": str(int(start.timestamp())), "to": str(int(end.timestamp()))}
    async with await egress_client(
        "crypto history backfill", timeout=timeout,
        headers={"User-Agent": "LedgerFrame/1.0 (+local)"}, follow_redirects=True,
    ) as c:
        r = await c.get(f"{BASE_URL}/coins/{coin_id}/market_chart/range", params=params)
        r.raise_for_status()
        return r.json()


async def fetch_coins_list(timeout: float = 20.0) -> list:

    async with await egress_client("crypto price refresh", timeout=timeout, headers={"User-Agent": "LedgerFrame/1.0 (+local)"}, follow_redirects=True) as c:
        r = await c.get(f"{BASE_URL}/coins/list")
        r.raise_for_status()
        return r.json()


async def fetch_prices(ids: list[str], timeout: float = 20.0) -> dict:
    if not ids:
        return {}

    params = {
        "ids": ",".join(sorted(set(ids))),
        "vs_currencies": ",".join(VS_CURRENCIES),
        "include_market_cap": "true", "include_last_updated_at": "true",
    }
    async with await egress_client("crypto price refresh", timeout=timeout, headers={"User-Agent": "LedgerFrame/1.0 (+local)"}, follow_redirects=True) as c:
        r = await c.get(f"{BASE_URL}/simple/price", params=params)
        r.raise_for_status()
        return r.json()

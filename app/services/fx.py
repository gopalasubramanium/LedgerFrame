"""Currency conversion with a short-lived in-process FX cache.

Rates come from the configured market provider. Conversions are pure Decimal.
A same-currency conversion is always exact (rate 1) and never hits the provider.
"""

from __future__ import annotations

import time
from decimal import Decimal

from app.core.money import D
from app.providers.market import get_provider

# (base, quote) -> (rate, fetched_monotonic)
_CACHE: dict[tuple[str, str], tuple[Decimal, float]] = {}
_TTL = 600.0  # 10 minutes; FX moves slowly enough for a desk display


async def get_rate(base: str, quote: str) -> Decimal:
    base, quote = base.upper(), quote.upper()
    if base == quote:
        return Decimal("1")
    key = (base, quote)
    now = time.monotonic()
    cached = _CACHE.get(key)
    if cached and now - cached[1] < _TTL:
        return cached[0]
    fx = await get_provider().get_fx_rate(base, quote)
    _CACHE[key] = (fx.rate, now)
    return fx.rate


async def convert(amount: Decimal, base: str, quote: str) -> Decimal:
    if base.upper() == quote.upper():
        return D(amount)
    rate = await get_rate(base, quote)
    return D(amount) * rate


def clear_cache() -> None:
    _CACHE.clear()

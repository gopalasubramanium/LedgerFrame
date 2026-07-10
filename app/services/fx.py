# SPDX-License-Identifier: AGPL-3.0-or-later
"""Currency conversion with a short-lived in-process FX cache.

Rates come from the configured market provider. Conversions are pure Decimal.
A same-currency conversion is always exact (rate 1) and never hits the provider.

Cross rates (e.g. INR -> SGD) are **triangulated through USD** rather than asked
for directly: providers quote the major USD pairs reliably, but exotic direct
crosses are often stale or simply wrong (Alpha Vantage's INR/SGD was ~13% off,
which threw off the value of every foreign holding). USD/INR x USD/SGD gives the
correct, internally-consistent cross.
"""

from __future__ import annotations

import time
from datetime import UTC, datetime
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

    if base == "USD" or quote == "USD":
        # A USD pair — ask the provider directly. If the provider can't serve it,
        # fall back to the ECB reference rate (never the other way round — an entitled
        # provider rate always wins over a reference rate).
        rate = None
        try:
            fx = await get_provider().get_fx_rate(base, quote)
            rate = fx.rate if fx and fx.rate and fx.rate > 0 else None
        except Exception:  # noqa: BLE001 — degrade to reference FX, don't crash valuation
            rate = None
        if rate is None:
            from app.services import ecb_fx

            ref, _method = ecb_fx.reference_rate(base, quote)
            rate = ref if ref is not None else Decimal("1")
    else:
        # Triangulate via USD using the (cached, reliable) USD legs.
        usd_to_base = await get_rate("USD", base)
        usd_to_quote = await get_rate("USD", quote)
        rate = (usd_to_quote / usd_to_base) if usd_to_base else Decimal("1")

    _CACHE[key] = (rate, now)
    return rate


async def convert(amount: Decimal, base: str, quote: str) -> Decimal:
    # Defence-in-depth: a missing/unknown currency must not crash valuation. With
    # no currency to convert from/to, value the amount at face in the target
    # currency rather than raise (callers guarantee a real currency in practice).
    if not base or not quote:
        return D(amount)
    if base.upper() == quote.upper():
        return D(amount)
    rate = await get_rate(base, quote)
    return D(amount) * rate


async def capture_rate(native: str, base: str, ts: datetime) -> tuple[Decimal | None, str | None]:
    """§4.2 trade-date FX capture: the live ``native``→``base`` rate, paired with the base it
    was captured against — but ONLY when the trade's date (``ts``) is today in UTC, because
    only then is today's live rate genuinely the trade-date rate.

    Trade-date proximity guard: a backdated trade (``ts`` on any prior UTC calendar day —
    whether typed into the API form or imported from a CSV of historical trades) returns
    ``(None, None)`` = "trade-date FX unavailable". We do NOT have that past day's rate and
    must never stamp today's rate on an older trade (the same fabrication Unit A's NULL
    backfill avoids).

    Same-currency (``native == base``) is exactly 1 regardless of date — a domestic trade's
    rate is 1 on every day (R11), so the date guard does not apply to it. A provider failure /
    unresolvable cross / ``get_rate``'s degrade-to-exactly-1 sentinel all return
    ``(None, None)`` and never block the commit. The rate stays a ``Decimal`` end to end.
    """
    native, base = (native or "").upper(), (base or "").upper()
    if not native or not base:
        return None, None
    if native == base:
        return Decimal("1"), base  # domestic = 1 at every date; proximity guard N/A
    # Only today's rate is a valid trade-date rate; a backdated trade is honestly unavailable.
    ts_date = (ts.astimezone(UTC) if ts.tzinfo is not None else ts).date()
    if ts_date != datetime.now(UTC).date():
        return None, None
    try:
        rate = await get_rate(native, base)
    except Exception:  # noqa: BLE001 — capture is best-effort; never block the commit
        return None, None
    if rate is None or rate <= 0 or rate == Decimal("1"):
        return None, None  # unresolved cross rate → honestly unavailable, not a fabricated 1
    return rate, base


def clear_cache() -> None:
    _CACHE.clear()

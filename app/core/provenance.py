# SPDX-License-Identifier: AGPL-3.0-or-later
"""Valuation provenance: concise, honest labels for HOW a value was derived.

Kept separate from *entitlement* (recency/rights). A holding always shows one
label from this module so the user can see at a glance whether a number is a live
market quote, an official NAV, a manual value, a stale cache, or unavailable.
"""

from __future__ import annotations

from app.schemas.common import EntitlementStatus, ValuationMethod

# The canonical, user-facing labels (per the product spec). ESTIMATED_VALUE and
# FX_REFERENCE are internal honest states shown where relevant.
_METHOD_LABELS: dict[ValuationMethod, str] = {
    ValuationMethod.MARKET_QUOTE: "Live / delayed market quote",
    ValuationMethod.OFFICIAL_NAV: "Official NAV",
    ValuationMethod.BROKER_QUOTE: "Broker quote",
    ValuationMethod.MANUAL_VALUATION: "Manual value",
    ValuationMethod.STATEMENT_IMPORT: "Statement value",
    ValuationMethod.CALCULATED_ACCRUAL: "Accrued estimate",
    ValuationMethod.ESTIMATED_VALUE: "Estimated value",
    ValuationMethod.FX_REFERENCE: "Reference FX",
    ValuationMethod.UNAVAILABLE: "Price unavailable",
}


def valuation_label(
    method: ValuationMethod,
    *,
    entitlement: EntitlementStatus | str | None = None,
    is_stale: bool = False,
    price_available: bool = True,
) -> str:
    """Concise label for a holding's current value.

    Precedence: genuinely-unavailable → "Price unavailable"; a stale/cached market
    quote → "Stale cached value"; otherwise the method's own label. Manual, NAV and
    statement values are never overridden by staleness — their freshness is conveyed
    by their own valuation date, not the market-cache clock.
    """
    if not price_available or method is ValuationMethod.UNAVAILABLE:
        return _METHOD_LABELS[ValuationMethod.UNAVAILABLE]
    ent = entitlement.value if isinstance(entitlement, EntitlementStatus) else entitlement
    if method is ValuationMethod.MARKET_QUOTE and (is_stale or ent == EntitlementStatus.CACHED.value):
        return "Stale cached value"
    return _METHOD_LABELS.get(method, _METHOD_LABELS[ValuationMethod.MARKET_QUOTE])


def cost_fx_holding_note(
    *, unavailable: bool, approximate: bool, excluded_lots: int
) -> str | None:
    """§12-R2 (F-3 EXCLUSIONS ARE LOUD): the served reason a holding's cost basis is incomplete or
    approximate — the value that was silent (W-1-class) until R-43. `None` when the cost basis is
    honestly complete (the fully-covered row shows nothing). Recorded numbers are never rewritten;
    this only names the honest gap (D-105 served string, D-076 excluded-count)."""
    if unavailable:
        n = max(excluded_lots, 1)
        return (f"Cost basis excludes {n} lot{'s' if n != 1 else ''} — "
                "no trade-date exchange rate available")
    if approximate:
        return ("Cost basis uses an approximate trade-date exchange rate "
                "(nearest published within 7 days)")
    return None


def cost_fx_basis_note(*, excluded_lots: int, approximate_holdings: int) -> str | None:
    """§12-R2: the Portfolio card's cost-basis annotation. Excluded lots take precedence (the
    incomplete-basis honesty line, which also distorts the total-return denominator); an
    all-approximate book gets the softer note. `None` when every lot's basis is complete & exact."""
    if excluded_lots > 0:
        return (f"Excludes {excluded_lots} lot{'s' if excluded_lots != 1 else ''} — "
                "trade-date FX unavailable")
    if approximate_holdings > 0:
        return "Cost basis uses approximate trade-date exchange rates for some holdings"
    return None


def method_for_quote(entitlement: EntitlementStatus, price_available: bool) -> ValuationMethod:
    """Default valuation method for a provider quote (market data). Unavailable when
    there's no price; otherwise a market quote — the common case."""
    if not price_available:
        return ValuationMethod.UNAVAILABLE
    return ValuationMethod.MARKET_QUOTE


def health_status(
    method: ValuationMethod,
    *,
    entitlement: EntitlementStatus | str | None = None,
    is_stale: bool = False,
    price_available: bool = True,
) -> str:
    """A single concise status word for the Pricing Health view. One of:
    Fresh · Delayed · End-of-day · Cached · Manual · Estimated · Unavailable.
    (Mapping-required / Authentication-required come from provider adapters.)"""
    if not price_available or method is ValuationMethod.UNAVAILABLE:
        return "Unavailable"
    if method in (ValuationMethod.MANUAL_VALUATION, ValuationMethod.STATEMENT_IMPORT):
        return "Manual"
    if method in (ValuationMethod.ESTIMATED_VALUE, ValuationMethod.CALCULATED_ACCRUAL):
        return "Estimated"
    if method is ValuationMethod.OFFICIAL_NAV:
        return "End-of-day"
    ent = entitlement.value if isinstance(entitlement, EntitlementStatus) else entitlement
    if is_stale or ent == EntitlementStatus.CACHED.value:
        return "Cached"
    if ent == EntitlementStatus.REALTIME.value:
        return "Fresh"
    if ent == EntitlementStatus.END_OF_DAY.value:
        return "End-of-day"
    return "Delayed"

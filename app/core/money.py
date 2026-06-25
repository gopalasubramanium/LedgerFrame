"""Decimal-based money helpers.

Rule enforced project-wide: monetary amounts are :class:`decimal.Decimal`, never
``float``. Floats are only acceptable at the very edge (chart pixels, JSON for the
browser) and are produced explicitly via :func:`to_display`.
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

ZERO = Decimal("0")
CENTS = Decimal("0.01")
PRICE_Q = Decimal("0.000001")  # quote precision (6dp) covers FX & crypto


def D(value: object) -> Decimal:
    """Coerce anything reasonable to a Decimal. Raises ValueError on garbage."""
    if isinstance(value, Decimal):
        return value
    if value is None or value == "":
        return ZERO
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise ValueError(f"cannot interpret {value!r} as a decimal") from exc


def money(value: object) -> Decimal:
    """Quantize to 2 decimal places for stored monetary amounts."""
    return D(value).quantize(CENTS, rounding=ROUND_HALF_UP)


def price(value: object) -> Decimal:
    """Quantize to 6 decimal places for quotes / FX rates."""
    return D(value).quantize(PRICE_Q, rounding=ROUND_HALF_UP)


def to_display(value: Decimal | None) -> float | None:
    """Convert a Decimal to float at the JSON boundary only. None passes through."""
    return None if value is None else float(value)


def pct_change(current: Decimal, previous: Decimal) -> Decimal | None:
    """Percentage change, or None when the base is zero (avoid division by zero)."""
    if previous == ZERO:
        return None
    return ((current - previous) / previous * Decimal("100")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

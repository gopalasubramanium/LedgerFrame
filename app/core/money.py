# SPDX-License-Identifier: AGPL-3.0-or-later
"""Decimal-based money helpers.

Rule enforced project-wide: monetary amounts are :class:`decimal.Decimal`, never
``float``. Floats are only acceptable at the very edge (chart pixels, JSON for the
browser) and are produced explicitly via :func:`to_display`.
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Context, Decimal, InvalidOperation

ZERO = Decimal("0")
CENTS = Decimal("0.01")
PRICE_Q = Decimal("0.000001")  # quote precision (6dp) covers FX & crypto

# D-105: quote-price DISPLAY precision by asset class, formatted in the backend so the frontend
# renders the string verbatim (money = served display strings; no client formatting). Stored native
# precision is unchanged — this is display only. Equities / ETFs / funds / indices → 2dp; crypto →
# up to 6 significant digits (so sub-cent tokens aren't truncated to "0.00").
_SIG6 = Context(prec=6, rounding=ROUND_HALF_UP)
_CRYPTO_CLASSES = frozenset({"crypto"})


def format_price_display(value: Decimal | None, asset_class: object = None) -> str | None:
    """A served display string for a QUOTE price at class-appropriate precision (D-105). None passes
    through (never a fabricated 0). Grouped thousands; crypto keeps 6 significant digits (trailing
    zeros trimmed), everything else is 2dp."""
    if value is None:
        return None
    p = D(value)
    ac = (asset_class.value if hasattr(asset_class, "value") else str(asset_class or "")).lower()
    if ac in _CRYPTO_CLASSES:
        return format(_SIG6.create_decimal(p), ",f")  # 6 significant digits, fixed notation
    return format(p.quantize(CENTS, rounding=ROUND_HALF_UP), ",.2f")


def format_fact_display(value: Decimal | None, currency: str) -> str | None:
    """A served display string for a GROUNDING-FACT amount: grouped thousands + currency suffix.

    THE NAMED PACK VARIANT (R-54 F-3, owner ruling 2026-07-21). The fact pack used to carry its own
    renderer — ``_fmt = f"{value:,.2f} {ccy}"`` in ``app/ai/tools.py`` — and that second home for
    rendering logic is what produced the defect: a token priced ``0.00004567`` reached the user as
    **``0.00 USD``**, on the one surface built to be honest about where numbers come from. The rule
    stated at the top of this module governs the pack too, so the pack's renderer now lives HERE.
    *The F6 fix is not "one function"; it is "no rendering logic outside money.py."*

    It shares the D-105 CORE — ``ROUND_HALF_UP``, ``None`` passthrough, sub-cent precision — and
    keeps the pack's own RATIFIED CONVENTIONS: thousands grouping and a currency suffix. It does
    **not** adopt the compact price style: ``68000.50`` stays ``68,000.50``, trailing zeros intact.
    That style remains the tape/price-display convention (``format_price_display``), and ratified
    rendering moves only where the defect was.

    **The sub-cent escalation is VALUE-driven, not class-driven, and that is deliberate.**
    ``format_price_display`` keys on ``asset_class == crypto`` and would render *every* crypto
    figure at 6 significant digits — which would restyle ``68,000.50`` and breach the ruling above.
    Escalating only when 2dp would print a non-zero value as ``0.00`` fixes exactly the defect and
    nothing else, and it protects a sub-cent price of any class rather than only the one that
    happened to expose it. A true zero still renders ``0.00`` — a legitimate zero is not sub-cent.

    ``None`` passes through so an unpriced fact stays honestly empty and never becomes a fabricated
    ``0`` (Guarantee 3) — closing, by construction, a path where the old renderer raised
    ``TypeError``.
    """
    if value is None:
        return None
    d = D(value)
    cents = d.quantize(CENTS, rounding=ROUND_HALF_UP)
    subcent = cents == ZERO and d != ZERO
    rendered = format(_SIG6.create_decimal(d), ",f") if subcent else format(cents, ",.2f")
    return f"{rendered} {currency}"


def format_money_display(value: Decimal | None) -> str | None:
    """A served display string for a MONEY amount: grouped thousands, 2dp (page-heatmap §12hm1-1,
    D-105 posture — the frontend renders it verbatim and formats nothing). None passes through, so
    an unpriced field stays honestly empty and is never a fabricated 0 (Guarantee 3)."""
    if value is None:
        return None
    return format(D(value).quantize(CENTS, rounding=ROUND_HALF_UP), ",.2f")


def format_signed_pct_display(value: Decimal | None) -> str | None:
    """A served display string for a SIGNED percentage change: explicit +/− (U+2212 minus, matching
    the app's signed-figure convention), 2dp, trailing '%'. None passes through (never a fabricated
    0% — a missing Today's change is shown as an em dash with a reason)."""
    if value is None:
        return None
    p = D(value).quantize(CENTS, rounding=ROUND_HALF_UP)
    sign = "+" if p > ZERO else "−" if p < ZERO else ""
    return f"{sign}{format(abs(p), ',.2f')}%"


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

"""Money helpers, currency conversion, and CSV injection safety."""

from __future__ import annotations

from decimal import Decimal

import pytest

from app.core.money import D, money, pct_change, price, to_display
from app.services import fx
from app.services.csv_import import sanitize_cell


def test_money_quantizes_to_cents():
    assert money("10.005") == Decimal("10.01")  # half-up
    assert money(10) == Decimal("10.00")


def test_price_six_dp():
    assert price("1.2345678") == Decimal("1.234568")


def test_D_rejects_garbage():
    with pytest.raises(ValueError):
        D("not-a-number")


def test_to_display_none_passthrough():
    assert to_display(None) is None
    assert to_display(Decimal("3.5")) == 3.5


def test_pct_change_zero_base_is_none():
    assert pct_change(Decimal("10"), Decimal("0")) is None
    assert pct_change(Decimal("110"), Decimal("100")) == Decimal("10.00")


async def test_same_currency_conversion_is_identity():
    assert await fx.convert(Decimal("100"), "USD", "USD") == Decimal("100")


async def test_cross_currency_conversion_uses_provider():
    fx.clear_cache()
    out = await fx.convert(Decimal("100"), "USD", "SGD")
    assert out > Decimal("100")  # SGD per USD > 1 in the demo rate table


def test_csv_formula_injection_neutralised():
    assert sanitize_cell("=SUM(A1:A2)").startswith("'")
    assert sanitize_cell("+1+1").startswith("'")
    assert sanitize_cell("-cmd").startswith("'")
    assert sanitize_cell("@import").startswith("'")
    assert sanitize_cell("normal") == "normal"

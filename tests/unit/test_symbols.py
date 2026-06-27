"""Trading-currency inference from ticker suffixes."""

from __future__ import annotations

import pytest

from app.core.symbols import currency_for_symbol


@pytest.mark.parametrize(
    ("symbol", "expected"),
    [
        ("HDFC.BSE", "INR"),
        ("RELIANCE.NSE", "INR"),
        ("VOD.L", "GBP"),
        ("7203.T", "JPY"),
        ("0700.HK", "HKD"),
        ("SHOP.TO", "CAD"),
        ("BHP.AX", "AUD"),
        ("D05.SI", "SGD"),
        ("SAP.DE", "EUR"),
        ("NESN.SW", "CHF"),
    ],
)
def test_currency_for_symbol_known_suffixes(symbol, expected):
    assert currency_for_symbol(symbol) == expected


@pytest.mark.parametrize("symbol", ["AAPL", "MSFT", "BTC", "BRK.B", "RDS.A", "", None])
def test_currency_for_symbol_unknown_returns_none(symbol):
    assert currency_for_symbol(symbol) is None


def test_currency_for_symbol_uses_exchange_code():
    assert currency_for_symbol("HDFC", exchange="BSE") == "INR"

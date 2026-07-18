# SPDX-License-Identifier: AGPL-3.0-or-later
"""Infer an instrument's *trading* currency from its ticker suffix.

Markets quote and settle in their local currency: a BSE/NSE stock trades in INR,
an LSE stock in GBP, a Tokyo stock in JPY, and so on. Alpha Vantage's
``GLOBAL_QUOTE`` returns the price in that local currency but does **not** label
it, so a foreign holding would otherwise be valued and shown as USD.

We derive the native currency from the exchange suffix (Yahoo/AV convention,
``SYMBOL.SUFFIX``) so the holding is valued and displayed in its real currency
and then converted to the base currency via FX — "market parlance" for a
multi-currency portfolio.

Returns ``None`` for symbols with no recognised suffix (e.g. plain US tickers
like ``AAPL``) so callers can fall back to their own default.
"""

from __future__ import annotations

# Exchange suffix (the part after the final dot) -> ISO 4217 currency.
_SUFFIX_CCY: dict[str, str] = {
    # India
    "BSE": "INR", "NSE": "INR", "NS": "INR", "BO": "INR",
    # United Kingdom / Ireland
    "L": "GBP", "LON": "GBP", "IL": "GBP",
    # Canada
    "TO": "CAD", "V": "CAD", "CN": "CAD", "NE": "CAD",
    # Australia / New Zealand
    "AX": "AUD", "NZ": "NZD",
    # East Asia
    "HK": "HKD",
    "T": "JPY", "TYO": "JPY",
    "SS": "CNY", "SZ": "CNY", "SHH": "CNY", "SHZ": "CNY",
    "KS": "KRW", "KQ": "KRW",
    "TW": "TWD", "TWO": "TWD",
    # Singapore
    "SI": "SGD", "SES": "SGD",
    # Eurozone
    "DE": "EUR", "F": "EUR", "PA": "EUR", "AS": "EUR", "BR": "EUR",
    "MI": "EUR", "MC": "EUR", "LS": "EUR", "VI": "EUR", "HE": "EUR",
    "IR": "EUR", "AT": "EUR",
    # Switzerland
    "SW": "CHF", "VX": "CHF",
    # Nordics
    "ST": "SEK", "OL": "NOK", "CO": "DKK",
    # Rest of world
    "JO": "ZAR", "SA": "BRL", "MX": "MXN", "TA": "ILS",
    "BK": "THB", "KL": "MYR", "JK": "IDR",
}


# Venue suffix / exchange → ISO-ish listing country, so region-first views group
# user-added instruments correctly (bare tickers are treated as US listings).
_SUFFIX_COUNTRY: dict[str, str] = {
    "BSE": "IN", "NSE": "IN", "NS": "IN", "BO": "IN",
    "L": "GB", "LON": "GB", "IL": "GB",
    "TO": "CA", "V": "CA", "CN": "CA", "NE": "CA",
    "AX": "AU", "NZ": "NZ", "HK": "HK", "T": "JP", "TYO": "JP",
    "SS": "CN", "SZ": "CN", "SHH": "CN", "SHZ": "CN",
    "KS": "KR", "KQ": "KR", "TW": "TW", "TWO": "TW",
    "SI": "SG", "SES": "SG",
    "DE": "DE", "F": "DE", "PA": "FR", "AS": "NL", "BR": "BE", "MI": "IT",
    "SW": "CH", "VX": "CH", "ST": "SE", "OL": "NO", "CO": "DK",
}
_CCY_COUNTRY: dict[str, str] = {
    "USD": "US", "SGD": "SG", "INR": "IN", "GBP": "GB", "JPY": "JP", "HKD": "HK",
    "AUD": "AU", "CAD": "CA", "CNY": "CN", "CHF": "CH",
}


def country_for_symbol(
    symbol: str | None, exchange: str | None = None, currency: str | None = None,
    *, bare_ticker_default: str | None = "US",
) -> str | None:
    """Best-effort listing country for a ticker (suffix → exchange → currency →
    bare-ticker=US). Returns None when nothing matches.

    ``bare_ticker_default`` is the fallback for a plain, suffix-less symbol. It defaults to
    "US" (a bare ticker is almost always a US listing) — but §14dr-27(b): that assumption is
    an EXCHANGE-LISTED-EQUITY heuristic. A mutual fund or crypto has no exchange listing, so
    callers pass ``None`` to derive a country only from a REAL signal (suffix / exchange) and
    leave it unknown otherwise, rather than fabricating a US listing that breaks AMFI
    capability and the (mutual_fund, IN) routing-matrix cell."""
    if symbol:
        sym = symbol.strip().upper()
        if "." in sym:
            suffix = sym.rsplit(".", 1)[1]
            if suffix in _SUFFIX_COUNTRY:
                return _SUFFIX_COUNTRY[suffix]
    if exchange and exchange.strip().upper() in _SUFFIX_COUNTRY:
        return _SUFFIX_COUNTRY[exchange.strip().upper()]
    if currency and currency.upper() in _CCY_COUNTRY:
        return _CCY_COUNTRY[currency.upper()]
    if symbol and "." not in symbol.strip():
        return bare_ticker_default  # bare ticker → US listing (equities only; see docstring)
    return None


def currency_for_symbol(symbol: str | None, exchange: str | None = None) -> str | None:
    """Best-effort native trading currency for a ticker.

    Checks the ``SYMBOL.SUFFIX`` suffix first, then a bare exchange code. Returns
    ``None`` when nothing matches (callers should fall back to their default).
    """
    if symbol:
        sym = symbol.strip().upper()
        if "." in sym:
            suffix = sym.rsplit(".", 1)[1]
            if suffix in _SUFFIX_CCY:
                return _SUFFIX_CCY[suffix]
    if exchange:
        ex = exchange.strip().upper()
        if ex in _SUFFIX_CCY:
            return _SUFFIX_CCY[ex]
    return None

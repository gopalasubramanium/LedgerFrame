# SPDX-License-Identifier: AGPL-3.0-or-later
"""R-63 Phase 1 — the pure execution-chain builder (§9-1). Head-first, capable+keyed market
lanes only; terminal / cache-publish / unkeyed / wrong-class lanes are excluded."""

from __future__ import annotations

from app.providers.market.router import (
    ProviderAvailability,
    RouteDiagnostic,
    fetch_chain,
)


def _diag(head, chain, lane="us_equity", ac="equity"):
    return RouteDiagnostic(
        instrument_id=1, symbol="AAPL", asset_class=ac, lane=lane,
        priority_chain=list(chain), source_selected=head, valuation_method="market_quote")


def test_head_is_tried_first_then_the_chain():
    # Head = alphavantage; chain lists eodhd first, but the head is pinned to the front.
    d = _diag("alphavantage", ["eodhd", "alphavantage", "yahoo", "csv", "manual"])
    avail = {"alphavantage": ProviderAvailability("alphavantage", True, True, True)}
    # eodhd needs a key and this instance holds none → skipped; manual is terminal → excluded.
    assert fetch_chain(d, "equity", avail) == ["alphavantage", "yahoo", "csv"]


def test_no_key_lane_is_skipped_never_stalled_on():
    # eodhd sits at the head but is unkeyed → the net skips it and walks on (never stalls).
    d = _diag("eodhd", ["eodhd", "alphavantage", "yahoo", "csv", "manual"])
    avail = {"alphavantage": ProviderAvailability("alphavantage", True, True, True)}
    assert fetch_chain(d, "equity", avail) == ["alphavantage", "yahoo", "csv"]


def test_cache_publish_and_terminal_excluded():
    # crypto lane: coingecko (cache-publish) and manual/cache (terminal) are never fetched here.
    d = _diag("alphavantage", ["coingecko", "alphavantage", "yahoo", "csv", "manual"],
              lane="crypto", ac="crypto")
    avail = {"alphavantage": ProviderAvailability("alphavantage", True, True, True)}
    # csv can't cover crypto (equity/etf only) → excluded by class; coingecko cache-publish → excluded.
    assert fetch_chain(d, "crypto", avail) == ["alphavantage", "yahoo"]


def test_keyless_lanes_are_always_available():
    # No availability map at all → keyless yahoo/csv still qualify; keyed lanes do not.
    d = _diag("yahoo", ["eodhd", "alphavantage", "yahoo", "csv", "manual"])
    assert fetch_chain(d, "equity", None) == ["yahoo", "csv"]

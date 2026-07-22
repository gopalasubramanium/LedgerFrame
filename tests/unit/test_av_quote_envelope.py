# SPDX-License-Identifier: AGPL-3.0-or-later
"""R-63 Phase 0 — the AlphaVantage entitlement-envelope parse.

The root cause R-63 opens on: with ``entitlement=delayed`` (sent on every AV call,
``external.py``), AlphaVantage returns ``GLOBAL_QUOTE`` data under a DECORATED
top-level key — ``"Global Quote - DATA DELAYED BY 15 MINUTES"`` — but the quote
parser read only ``data["Global Quote"]``, got ``{}``, and reported the price as
UNAVAILABLE on every symbol. The fix makes the quote parser tolerant of the
``"Global Quote*"`` key family (the ``_find_time_series`` precedent).

The fixtures are the CAPTURED REAL ENVELOPES (R-63 §9-0 rider — never hand-mocked):
- ``av_global_quote_entitled.json`` — probe #1, the decorated key with real fields.
- ``av_global_quote_empty.json``    — probe #5, AV's genuine-empty ``{"Global Quote": {}}``.

This is the canonical CAPABILITY-vs-PROPERTY case (CLAUDE.md / TEMPLATE): a live
provider returning HTTP 200 WITH DATA, which the code treated as "no data". A test
that only asks "does the call work?" stays green; only a test that asks "did we get
the PRICE?" turns red. This is that test — the one that would have caught this the
day ``entitlement=delayed`` (F-4) shipped.
"""

from __future__ import annotations

import json
from pathlib import Path

from app.providers.market.external import ExternalMarketDataProvider, _global_quote

_FX = Path(__file__).parents[1] / "fixtures"
_ENTITLED = json.loads((_FX / "av_global_quote_entitled.json").read_text())
_EMPTY = json.loads((_FX / "av_global_quote_empty.json").read_text())


def test_global_quote_tolerates_the_decorated_key():
    """Blindness pin (R-63 §9-0 / AC-3): the helper finds the payload under BOTH the plain
    and the entitlement-decorated key, and returns ``{}`` for a genuinely-empty envelope —
    on the CAPTURED REAL fixtures, so it protects the real AV behaviour, not a guessed shape."""
    # decorated key (probe #1) — the price is present
    assert _global_quote(_ENTITLED).get("05. price") == "378.0736"
    # plain key — unchanged
    assert _global_quote({"Global Quote": {"05. price": "1"}}).get("05. price") == "1"
    # genuine empty (probe #5) — stays empty, never fabricated
    assert _global_quote(_EMPTY) == {}
    # no quote key at all (e.g. an error/notice envelope) — empty, not a crash
    assert _global_quote({"Information": "..."}) == {}


async def test_entitled_envelope_yields_a_price(monkeypatch):
    """The decorated ``"Global Quote - DATA DELAYED BY 15 MINUTES"`` envelope must
    parse to the real price (378.0736). REPRODUCES the R-63 root cause: RED before
    the tolerant-parse fix (get_quote returns UNAVAILABLE / price None), green after."""
    p = ExternalMarketDataProvider("alphavantage", "testkey")

    async def fake_get(params):
        assert params["function"] == "GLOBAL_QUOTE"
        return _ENTITLED

    monkeypatch.setattr(p, "_get", fake_get)
    q = await p.get_quote("TSLA")

    assert q.price is not None, "entitled GLOBAL_QUOTE envelope parsed as no-price (the R-63 bug)"
    assert float(q.price) == 378.0736
    assert float(q.previous_close) == 378.93
    assert q.entitlement.value == "delayed"


async def test_genuine_empty_is_still_no_price(monkeypatch):
    """The tolerant parse must NOT fabricate: AV's genuine-empty ``{"Global Quote": {}}``
    (an unknown symbol) still resolves to UNAVAILABLE — distinct from the entitled case.
    Guards against a fix that greedily reads the first dict value and invents a number."""
    p = ExternalMarketDataProvider("alphavantage", "testkey")

    async def fake_get(params):
        return _EMPTY

    monkeypatch.setattr(p, "_get", fake_get)
    q = await p.get_quote("ZZZZINVALID")

    assert q.price is None
    assert q.entitlement.value == "unavailable"


async def test_plain_envelope_still_parses(monkeypatch):
    """Blindness pin: the fix must not regress the plain ``"Global Quote"`` envelope
    (what a call WITHOUT entitlement returns). If AV ever drops the decoration, this
    stays green — the guard protects the real behaviour, not just the decorated shape."""
    p = ExternalMarketDataProvider("alphavantage", "testkey")

    async def fake_get(params):
        return {"Global Quote": {"01. symbol": "TSLA", "05. price": "378.9300",
                                 "08. previous close": "369.5700", "09. change": "9.36",
                                 "10. change percent": "2.5326%"}}

    monkeypatch.setattr(p, "_get", fake_get)
    q = await p.get_quote("TSLA")
    assert q.price is not None and float(q.price) == 378.93

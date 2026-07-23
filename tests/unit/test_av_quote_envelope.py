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
import logging
from pathlib import Path

from app.providers.market.external import (
    ExternalMarketDataProvider,
    RateLimited,
    _global_quote,
)
from app.schemas.common import FailureState

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


# --- R-63 Phase 2: the failure-state taxonomy (§9-2) — distinct causes, never one "none" --- #

# The real AV throttle message, captured verbatim from the owner's live log (line 13605).
_REAL_BURST = ("Burst pattern detected. Please consider spreading out your API requests more "
               "evenly across a 1-minute window and query no more than 5 requests per second.")


async def test_priced_quote_has_no_failure_state(monkeypatch):
    p = ExternalMarketDataProvider("alphavantage", "testkey")
    monkeypatch.setattr(p, "_get", lambda params: _mk(_ENTITLED))
    q = await p.get_quote("TSLA")
    assert q.price is not None and q.failure_state is None


async def test_genuine_empty_classifies_as_empty(monkeypatch):
    """The canonical pair (owner §9-2): probe #5 genuine-empty → EMPTY (a Global Quote key IS
    present; the provider simply had no price), NOT parse_error."""
    p = ExternalMarketDataProvider("alphavantage", "testkey")
    monkeypatch.setattr(p, "_get", lambda params: _mk(_EMPTY))
    q = await p.get_quote("ZZZZINVALID")
    assert q.price is None
    assert q.failure_state is FailureState.EMPTY


async def test_unrecognised_shape_classifies_as_parse_error(monkeypatch):
    """The other half of the canonical pair: a response with NO recognisable quote key is a
    parse_error — distinct from empty, so a real 'we could not read this' never reads as 'no price'."""
    p = ExternalMarketDataProvider("alphavantage", "testkey")
    monkeypatch.setattr(p, "_get", lambda params: _mk({"Meta": {"note": "unexpected"}}))
    q = await p.get_quote("TSLA")
    assert q.price is None
    assert q.failure_state is FailureState.PARSE_ERROR


async def test_throttle_classifies_as_throttled_and_records_time(monkeypatch):
    """A rate-limit (the REAL burst-pattern message) → THROTTLED, and the time is recorded so
    Pricing Health can say 'throttled — will retry' rather than 'no price' (§9-9, I-7)."""
    p = ExternalMarketDataProvider("alphavantage", "testkey")

    async def boom(params):
        raise RateLimited(_REAL_BURST)

    monkeypatch.setattr(p, "_get", boom)
    assert p.last_throttled_at is None
    q = await p.get_quote("TSLA")
    assert q.price is None
    assert q.failure_state is FailureState.THROTTLED
    assert p.last_throttled_at is not None


async def test_network_error_classifies_as_errored(monkeypatch):
    p = ExternalMarketDataProvider("alphavantage", "testkey")

    async def boom(params):
        raise ConnectionError("dns failure")

    monkeypatch.setattr(p, "_get", boom)
    q = await p.get_quote("TSLA")
    assert q.price is None
    assert q.failure_state is FailureState.ERRORED


async def test_two_premiums_quote_entitlement_learned_from_envelope(monkeypatch):
    """I-4 (two-premiums): the VERIFIED quote entitlement is learned from the envelope AV actually
    returns — the decorated 'DATA DELAYED BY 15 MINUTES' key proves delayed market-data, separate
    from the Index Data tier (av_tier)."""
    p = ExternalMarketDataProvider("alphavantage", "testkey")
    assert p.quote_entitlement is None
    monkeypatch.setattr(p, "_get", lambda params: _mk(_ENTITLED))
    await p.get_quote("TSLA")
    assert p.quote_entitlement == "delayed"       # verified from the real decorated envelope
    assert p.av_tier == "unknown"                 # index tier is a DIFFERENT product, still unlearned


async def _mk_impl(data):
    return data


def _mk(data):
    return _mk_impl(data)


# --- R-63 0a F-B: provider error text must NOT echo the API key into the logs (§8 secrets) --- #

# AV's REAL error body echoes the submitted key verbatim (captured shape, key slot filled with the
# fake test key). An httpx error would similarly carry the request URL with ``apikey=<KEY>``.
_FAKE_KEY = "INVALID-DOCTOR-TEST"
_AV_KEY_ECHO = (f"We have detected your API key as {_FAKE_KEY} and our standard API rate limit is "
                "25 requests per day. Please visit https://www.alphavantage.co/premium/ to instantly "
                "remove all daily rate limits.")


async def test_quote_error_does_not_leak_the_key_into_logs(monkeypatch, caplog):
    """A quote-path provider error that echoes the key must be REDACTED before it is logged —
    the key never reaches ``~/.ledgerframe-data/logs/`` (F-B). Blindness pin: the warning MUST
    still fire (redaction, not silence)."""
    p = ExternalMarketDataProvider("alphavantage", _FAKE_KEY)

    async def fake_get(params):
        raise RateLimited(_AV_KEY_ECHO)

    monkeypatch.setattr(p, "_get", fake_get)
    with caplog.at_level(logging.WARNING, logger="app.providers.market.external"):
        q = await p.get_quote("IBM")

    assert q.price is None  # the error still resolves to an honest no-price
    blob = "\n".join(r.getMessage() for r in caplog.records)
    assert "AV quote unavailable" in blob, "blindness pin: the warning must still be emitted"
    assert _FAKE_KEY not in blob, "the API key leaked into the logs (F-B redaction failed)"
    assert "***REDACTED***" in blob


async def test_index_error_does_not_leak_the_key_into_logs(monkeypatch, caplog):
    """The OBSERVED leak path (the index fetch, external.py:236): AV's index error echoes the key;
    it must be redacted. This is the exact line the 0a run caught leaking the fake key."""
    p = ExternalMarketDataProvider("alphavantage", _FAKE_KEY)

    async def fake_get(params):
        raise RateLimited(_AV_KEY_ECHO)

    monkeypatch.setattr(p, "_get", fake_get)
    with caplog.at_level(logging.WARNING, logger="app.providers.market.external"):
        q = await p.get_quote("DJI")  # an index symbol → _index_quote path

    assert q.price is None
    blob = "\n".join(r.getMessage() for r in caplog.records)
    assert "AV index unavailable" in blob, "blindness pin: the warning must still be emitted"
    assert _FAKE_KEY not in blob, "the API key leaked into the logs via the index path (F-B)"

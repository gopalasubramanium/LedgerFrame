# SPDX-License-Identifier: AGPL-3.0-or-later
"""R-63 Phase 5 — the PROVIDER DOCTOR (§9-4 / AC-13 / AC-14).

The doctor live-tests each market provider lane once with a PUBLIC known symbol and reports a
redacted, per-lane verdict. These fail-first tests pin the behaviours the correctness gates cannot
see on their own:

* AC-14 — a lane that REACHES the provider, gets a 200, and parses NO price (``price is None``)
  MUST read FAIL, never PASS. This is the doctor catching THIS milestone's own root-cause class.
* AC-13 — ≤1 egress call per lane per run, counted; no-egress honesty (zero calls, honest reason);
  and REDACTION (a lane never carries a key or a holding's price).
* a no_key lane (needs a credential this instance lacks) is REPORTED as such, calls 0, never errored.

Stub providers mirror the small ``name`` + ``async def get_quote`` style of ``test_execution_net``.
``build_provider`` is monkeypatched at ``app.providers.market.build_provider`` (the doctor imports
it inside the function, the same way the execution net does) so no real lane is ever constructed.
"""

from __future__ import annotations

from datetime import UTC, datetime

from app.schemas.common import EntitlementStatus, FailureState, Quote
from app.services.provider_doctor import _PROBE_SYMBOLS, run_provider_doctor


class _PassStub:
    """A lane that PRICES its probe (a real, non-None price) → verdict pass."""

    def __init__(self, name: str, calls: list):
        self.name = name
        self._calls = calls

    async def get_quote(self, symbol, exchange=None):
        self._calls.append((self.name, symbol))
        return Quote(symbol=symbol.upper(), price="191.50", currency="USD", source=self.name,
                     entitlement=EntitlementStatus.DELAYED, received_at=datetime.now(UTC))


class _ParseEmptyStub:
    """A lane that REACHED the provider, got a 200, and parsed NO price — the AC-14 case."""

    def __init__(self, name: str, calls: list):
        self.name = name
        self._calls = calls

    async def get_quote(self, symbol, exchange=None):
        self._calls.append((self.name, symbol))
        return Quote(symbol=symbol.upper(), price=None, currency="USD", source=self.name,
                     entitlement=EntitlementStatus.UNAVAILABLE,
                     failure_state=FailureState.EMPTY,
                     received_at=datetime.now(UTC), is_stale=True)


def _lane(result: dict, name: str) -> dict:
    return next(ln for ln in result["lanes"] if ln["lane"] == name)


async def test_ac14_parse_empty_lane_reports_FAIL_and_a_pass_lane_reports_PASS(session, monkeypatch):
    """AC-14 — the milestone's OWN bug class: a parse-empty lane (200, no price) MUST read FAIL,
    never PASS. A lane that returns a real price reads PASS. total_calls counts both probes."""
    calls: list = []

    def fake_build(name):
        if name == "alphavantage":
            return _ParseEmptyStub("alphavantage", calls)  # reached, parsed empty
        if name == "yahoo":
            return _PassStub("yahoo", calls)               # a real price
        return None  # eodhd/kite unbuildable on this instance (no key)

    monkeypatch.setattr("app.providers.market.build_provider", fake_build)

    r = await run_provider_doctor(session)

    av = _lane(r, "alphavantage")
    assert av["verdict"] == "fail", "a parse-empty lane must FAIL, never pass (AC-14)"
    assert av["calls"] == 1
    assert "no price" in av["note"]  # names the reason from the failure_state
    yh = _lane(r, "yahoo")
    assert yh["verdict"] == "pass" and yh["calls"] == 1
    # total_calls counts exactly the two lanes that were actually probed.
    assert r["total_calls"] == 2
    assert ("alphavantage", "IBM") in calls and ("yahoo", "AAPL") in calls


async def test_at_most_one_call_per_lane_and_total_is_counted(session, monkeypatch):
    """AC-13 — every probed lane calls get_quote AT MOST ONCE, and total_calls == the number of
    probed lanes. A counter stub proves the call count is real, not asserted from outcome alone."""
    calls: list = []

    def fake_build(name):
        # Every quote lane builds (all keyed lanes 'have a key' here) → all four are probed.
        return _PassStub(name, calls)

    monkeypatch.setattr("app.providers.market.build_provider", fake_build)

    r = await run_provider_doctor(session)

    probed = [ln for ln in r["lanes"] if ln["lane"] in _PROBE_SYMBOLS]
    assert all(ln["calls"] <= 1 for ln in probed), "a lane must call get_quote at most once (AC-13)"
    assert r["total_calls"] == len(_PROBE_SYMBOLS) == len(calls)
    # No lane was called twice.
    assert len(calls) == len({(n, s) for n, s in calls})


async def test_no_key_lane_is_reported_not_errored(session, monkeypatch):
    """A keyed lane this instance lacks a credential for (build_provider → None) reads 'no_key',
    calls 0 — reported honestly, NOT an error, NOT a crash."""
    def fake_build(name):
        return _PassStub(name, []) if name == "yahoo" else None  # only keyless yahoo builds

    monkeypatch.setattr("app.providers.market.build_provider", fake_build)

    r = await run_provider_doctor(session)

    for lane in ("alphavantage", "eodhd", "kite"):
        entry = _lane(r, lane)
        assert entry["verdict"] == "no_key", f"{lane} should read no_key when unbuildable"
        assert entry["calls"] == 0
        assert entry["needs_key"] is True and entry["key_present"] is False
    # yahoo still probed → exactly one call total.
    assert r["total_calls"] == 1


async def test_no_egress_makes_zero_calls_and_says_why(session, monkeypatch):
    """Commitment 5 — with no-egress on, the doctor makes ZERO calls and returns an honest reason;
    EVERY lane reads 'skipped_no_egress'. Never a silent pass."""
    from app.models import Setting

    session.add(Setting(key="privacy_mode", value="true"))
    await session.flush()

    called: list = []

    def fake_build(name):
        called.append(name)  # must never be reached under no-egress
        return _PassStub(name, [])

    monkeypatch.setattr("app.providers.market.build_provider", fake_build)

    r = await run_provider_doctor(session)

    assert r["no_egress"] is True
    assert r["total_calls"] == 0
    assert all(ln["verdict"] == "skipped_no_egress" for ln in r["lanes"])
    assert all(ln["calls"] == 0 for ln in r["lanes"])
    assert r["note"] and "no-egress" in r["note"].lower()
    # The honesty is structural: no lane was even built.
    assert called == []


async def test_redaction_no_key_or_holding_price_leaks(session, monkeypatch):
    """AC-13 — a lane verdict carries ONLY the redacted fields. Never a key, never a holding price;
    the probe uses a PUBLIC known symbol, never a user holding."""
    monkeypatch.setattr("app.providers.market.build_provider",
                        lambda name: _PassStub(name, []))

    r = await run_provider_doctor(session)

    allowed = {"lane", "needs_key", "key_present", "known_symbol", "verdict", "calls", "note"}
    for entry in r["lanes"]:
        assert set(entry.keys()) == allowed, f"a lane leaked non-redacted fields: {entry.keys()}"
        # The known_symbol is one of the PUBLIC probe tickers, never a user holding.
        assert entry["known_symbol"] in set(_PROBE_SYMBOLS.values()) | {"bitcoin", "EUR/USD", "120503"}
        # No key-ish or secret key appears anywhere in the lane dict.
        blob = str(entry).lower()
        assert "api_key" not in blob and "secret" not in blob and "access_token" not in blob


async def test_proposed_lanes_are_listed_not_probed(session, monkeypatch):
    """The keyless-but-not-yet-buildable egress lanes are LISTED with verdict 'proposed', calls 0,
    and never probed this milestone (their live probe is proposed for the 0a look)."""
    monkeypatch.setattr("app.providers.market.build_provider",
                        lambda name: _PassStub(name, []))

    r = await run_provider_doctor(session)

    for lane in ("coingecko", "ecb_fx", "amfi_nav"):
        entry = _lane(r, lane)
        assert entry["verdict"] == "proposed" and entry["calls"] == 0

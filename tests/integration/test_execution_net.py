# SPDX-License-Identifier: AGPL-3.0-or-later
"""R-63 Phase 1 — the execution net (§9-1): the priority chain is REAL at fetch time.

Pin-head-keep-net: a route head (override / matrix cell / active lane) is tried first, but a
FAILED head falls through to the next capable+keyed market lane — yahoo, the keyless free net.

The capability-vs-property lesson (CLAUDE.md): it is not enough that *a price appeared* — the
test must prove the NET EXECUTED, i.e. that yahoo's fetch was actually invoked and its value is
what got stored (head=X, priced-by=Y). A test that only checked ``price is not None`` could pass
on a stale cache read; this one observes the fallback lane's call.
"""

from __future__ import annotations

from datetime import UTC, datetime

from app.providers.market.router import ProviderAvailability
from app.schemas.common import EntitlementStatus, Quote
from app.services import market


class _FailingHead:
    """The head lane (alphavantage) — reachable, keyed, but delivers no price."""

    name = "alphavantage"
    fetch_on_demand = False

    async def get_quote(self, symbol, exchange=None):
        return Quote(symbol=symbol.upper(), price=None, currency="USD", source="alphavantage",
                     entitlement=EntitlementStatus.UNAVAILABLE,
                     received_at=datetime.now(UTC), is_stale=True)


class _YahooSpy:
    """The fallback lane (yahoo) — records that it was actually called, then prices."""

    name = "yahoo"
    fetch_on_demand = False

    def __init__(self, calls: list):
        self._calls = calls

    async def get_quote(self, symbol, exchange=None):
        self._calls.append(("yahoo", symbol.upper()))
        return Quote(symbol=symbol.upper(), price="191.50", previous_close="190.00",
                     currency="USD", source="yahoo", entitlement=EntitlementStatus.DELAYED,
                     market_time=datetime.now(UTC), received_at=datetime.now(UTC))


def _wire(monkeypatch, calls):
    # Head = alphavantage, keyed on this instance; the head provider fails to price.
    monkeypatch.setattr(market, "provider_availability", lambda: {
        "alphavantage": ProviderAvailability(
            name="alphavantage", configured=True, has_credentials=True, enabled=True)})
    monkeypatch.setattr(market, "get_provider", lambda: _FailingHead())

    def fake_build(name):
        return _YahooSpy(calls) if name == "yahoo" else None

    # raising=False so this is a clean BEHAVIOURAL red against pre-net code (where the attribute
    # may not exist yet): the old path simply never calls it and yahoo stays un-fetched.
    monkeypatch.setattr("app.providers.market.build_provider", fake_build, raising=False)


async def test_net_falls_through_from_failed_head_to_yahoo(session, monkeypatch):
    """AV (head) fails → the net walks to yahoo, which PRICES it. The proof the net executed
    is that yahoo's fetch was observed AND its value was stored — not merely a non-null price."""
    calls: list = []
    _wire(monkeypatch, calls)

    r = await market.refresh_quote_detailed(session, "AAPL")

    # THE NET EXECUTED — yahoo's fetch was actually invoked (property, not just outcome):
    assert ("yahoo", "AAPL") in calls, "fallback net did not execute — yahoo was never fetched"
    assert r.fetched
    # Pin-head-keep-net provenance: head chose AV, yahoo priced it.
    assert r.route_head == "alphavantage"
    assert r.priced_by == "yahoo"
    assert float(r.quote.price) == 191.5
    # The stored quote carries the TRUE source (yahoo), so Pricing Health shows priced-by=yahoo
    # while the route still names head=alphavantage — head=X, priced-by=Y.
    cached = await market.get_cached_quote(session, "AAPL")
    assert cached.source == "yahoo"
    assert cached.price is not None


async def test_head_success_does_not_fire_the_net(session, monkeypatch):
    """Blindness pin: when the head prices, the net must NOT walk on — yahoo is never touched."""
    calls: list = []
    monkeypatch.setattr(market, "provider_availability", lambda: {
        "alphavantage": ProviderAvailability(
            name="alphavantage", configured=True, has_credentials=True, enabled=True)})

    class _GoodHead(_FailingHead):
        async def get_quote(self, symbol, exchange=None):
            return Quote(symbol=symbol.upper(), price="180.00", currency="USD",
                         source="alphavantage", entitlement=EntitlementStatus.DELAYED,
                         market_time=datetime.now(UTC), received_at=datetime.now(UTC))

    monkeypatch.setattr(market, "get_provider", lambda: _GoodHead())
    monkeypatch.setattr("app.providers.market.build_provider",
                        lambda name: _YahooSpy(calls) if name == "yahoo" else None)

    r = await market.refresh_quote_detailed(session, "AAPL")
    assert r.fetched and r.priced_by == "alphavantage"
    assert calls == [], "the net fetched a fallback even though the head priced the instrument"


async def test_refresh_outcome_carries_typed_failure_state(session, monkeypatch):
    """§9-2: when the head is throttled and no fallback can price, the refresh OUTCOME carries the
    typed state (THROTTLED) — 'distinct failures, never one none' reaches the refresh layer."""
    from app.schemas.common import FailureState

    class _Throttled(_FailingHead):
        async def get_quote(self, symbol, exchange=None):
            return Quote(symbol=symbol.upper(), price=None, currency="USD", source="alphavantage",
                         entitlement=EntitlementStatus.UNAVAILABLE,
                         failure_state=FailureState.THROTTLED,
                         received_at=datetime.now(UTC), is_stale=True)

    monkeypatch.setattr(market, "provider_availability", lambda: {
        "alphavantage": ProviderAvailability("alphavantage", True, True, True)})
    monkeypatch.setattr(market, "get_provider", lambda: _Throttled())
    monkeypatch.setattr("app.providers.market.build_provider", lambda name: None)  # no fallback builds

    r = await market.refresh_quote_detailed(session, "AAPL")
    assert r.outcome == "no_data" and not r.fetched
    assert r.failure_state is FailureState.THROTTLED


async def test_refresh_persists_then_clears_failure_state(session, monkeypatch):
    """§9-2 Delta 2.2 persistence: a throttled refresh records last_failure_state on the quote row
    (so Pricing Health can name it without a live call); a later success CLEARS it."""
    from app.models import Quote as QuoteRow
    from app.schemas.common import FailureState

    instr = await market._get_or_create_instrument(session, "AAPL", None)
    session.add(QuoteRow(instrument_id=instr.id, price="100", currency="USD",
                         source="alphavantage", entitlement="delayed",
                         received_at=datetime.now(UTC)))
    await session.flush()

    class _Throttled(_FailingHead):
        async def get_quote(self, symbol, exchange=None):
            return Quote(symbol=symbol.upper(), price=None, currency="USD", source="alphavantage",
                         entitlement=EntitlementStatus.UNAVAILABLE,
                         failure_state=FailureState.THROTTLED,
                         received_at=datetime.now(UTC), is_stale=True)

    monkeypatch.setattr(market, "provider_availability", lambda: {
        "alphavantage": ProviderAvailability("alphavantage", True, True, True)})
    monkeypatch.setattr(market, "get_provider", lambda: _Throttled())
    monkeypatch.setattr("app.providers.market.build_provider", lambda name: None)

    await market.refresh_quote_detailed(session, "AAPL")
    row = await session.get(QuoteRow, instr.id)
    await session.refresh(row)
    assert row.last_failure_state == "throttled"
    assert row.last_failure_at is not None

    # A good head now prices it → the recorded failure is cleared.
    class _Good(_FailingHead):
        async def get_quote(self, symbol, exchange=None):
            return Quote(symbol=symbol.upper(), price="123.0", currency="USD", source="alphavantage",
                         entitlement=EntitlementStatus.DELAYED,
                         market_time=datetime.now(UTC), received_at=datetime.now(UTC))

    monkeypatch.setattr(market, "get_provider", lambda: _Good())
    await market.refresh_quote_detailed(session, "AAPL")
    row = await session.get(QuoteRow, instr.id)
    await session.refresh(row)
    assert row.last_failure_state is None and row.last_failure_at is None

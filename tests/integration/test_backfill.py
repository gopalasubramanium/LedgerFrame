# SPDX-License-Identifier: AGPL-3.0-or-later
"""R-43 historical backfill — the growing pin sweep.

One module for the milestone; sections track the Phase-0 build order. Every pin is
fail-first RED on the real cause before its delta lands (the plan's build discipline).
"""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import select

from app.models import NetWorthSnapshot


# --------------------------------------------------------------------------- #
# Step 1 (§9-1) — snapshot provenance column
# --------------------------------------------------------------------------- #
async def test_net_worth_snapshot_has_provenance_defaulting_to_live(session):
    """§9-1: net_worth_snapshots gains a `source` provenance column so a backfilled row
    coexists with a forward worker row and an owner-pressed one. A row written the old way
    (no explicit source — the forward worker path) defaults to 'live'."""
    session.add(NetWorthSnapshot(
        ts=__import__("app.db.base", fromlist=["utcnow"]).utcnow(),
        base_currency="SGD",
        assets=Decimal("100"), liabilities=Decimal("0"), net_worth=Decimal("100"),
    ))
    await session.flush()
    row = (await session.execute(select(NetWorthSnapshot))).scalars().one()
    assert row.source == "live"  # forward-worker default; backfill/manual set it explicitly


async def test_snapshot_source_accepts_the_three_provenances(session):
    """The three §9-1 provenances round-trip. Enum values are internal (never user copy, D-105)."""
    from app.db.base import utcnow

    for src in ("backfilled", "live", "manual"):
        session.add(NetWorthSnapshot(
            ts=utcnow(), base_currency="SGD", assets=Decimal("1"),
            liabilities=Decimal("0"), net_worth=Decimal("1"), source=src,
        ))
    await session.flush()
    got = {r.source for r in (await session.execute(select(NetWorthSnapshot))).scalars().all()}
    assert got == {"backfilled", "live", "manual"}


# --------------------------------------------------------------------------- #
# Step 2 (R-8 / §9-3) — historical per-date reference FX
# --------------------------------------------------------------------------- #
# A slice of eurofxref-hist.csv shape: header + newest-first rows, a trailing empty column,
# a weekend gap (2026-07-17 Fri is the last publication before Sat 07-18 / Sun 07-19), and a
# 1999 pre-coverage row where INR/SGD are N/A (honestly-missing, never fabricated).
_HIST_CSV = (
    "Date, USD, INR, SGD, \n"
    "2026-07-17, 1.1435, 110.1020, 1.4765, \n"
    "2026-07-16, 1.1600, 111.0000, 1.4800, \n"
    "2026-07-15, 1.1500, 110.5000, 1.4780, \n"
    "1999-01-04, 1.1789, N/A, N/A, \n"
)


async def test_hist_ingest_resolves_exact_cross_rate(session):
    """A known date resolves base→quote via the EUR hub: USD→SGD = (EUR→SGD)/(EUR→USD),
    exact Decimal (no float drift)."""
    from app.services import fx_history

    res = await fx_history.ingest_hist(session, _HIST_CSV)
    assert res["dates"] == 4
    fxh = await fx_history.load_historical_fx(session, ["USD", "SGD", "INR"])
    # EUR→SGD / EUR→USD on 2026-07-17
    assert fxh.rate("USD", "SGD", "2026-07-17") == Decimal("1.4765") / Decimal("1.1435")
    assert fxh.rate("INR", "SGD", "2026-07-17") == Decimal("1.4765") / Decimal("110.1020")
    assert fxh.rate("SGD", "SGD", "2026-07-17") == Decimal("1")  # identity


async def test_hist_carries_last_published_rate_over_a_weekend(session):
    """§9-3: a non-publication day (weekend) carries the last published (Friday) rate forward,
    unflagged — the standard daily-close convention. Sat/Sun resolve to Friday's rate."""
    from app.services import fx_history

    await fx_history.ingest_hist(session, _HIST_CSV)
    fxh = await fx_history.load_historical_fx(session, ["USD", "SGD"])
    friday = fxh.rate("USD", "SGD", "2026-07-17")
    assert fxh.rate("USD", "SGD", "2026-07-18") == friday  # Saturday → Friday
    assert fxh.rate("USD", "SGD", "2026-07-20") == friday  # Monday (no row yet) → Friday


async def test_hist_pre_coverage_is_honestly_missing_never_fabricated(session):
    """W-1b per-date: a currency with no published rate on/before the date resolves to None
    (pre-coverage / before the file's earliest date), never a fabricated 1.0."""
    from app.services import fx_history

    await fx_history.ingest_hist(session, _HIST_CSV)
    fxh = await fx_history.load_historical_fx(session)
    assert fxh.eur_to("INR", "1999-01-04") is None       # INR N/A in the 1999 row
    assert fxh.rate("USD", "SGD", "1999-01-04") is None   # SGD leg missing → whole cross None
    assert fxh.eur_to("USD", "1998-01-01") is None        # before the earliest stored date
    assert fxh.rate("USD", "SGD", "2026-07-17") is not None  # sanity: present dates DO resolve


async def test_hist_ingest_is_idempotent(session):
    """Re-ingesting overwrites in place — no duplicate (currency, date) rows (the periodic-append
    path must not double the store)."""
    from sqlalchemy import func

    from app.models import EcbFxHistory
    from app.services import fx_history

    await fx_history.ingest_hist(session, _HIST_CSV)
    first = (await session.execute(select(func.count()).select_from(EcbFxHistory))).scalar()
    await fx_history.ingest_hist(session, _HIST_CSV)
    second = (await session.execute(select(func.count()).select_from(EcbFxHistory))).scalar()
    assert first == second and first > 0


async def test_needed_currencies_derives_from_held_pricing_currencies(session):
    """One derivation of the needed FX set: distinct held pricing currencies + base."""
    from app.models import Account, AssetClass, Holding, Instrument
    from app.services import fx_history

    acc = Account(name="A", currency="SGD")
    session.add(acc)
    await session.flush()
    usd = Instrument(symbol="TSLA", currency="USD", pricing_currency="USD")
    inr = Instrument(symbol="102000", currency="INR", pricing_currency="INR")
    session.add_all([usd, inr])
    await session.flush()
    session.add_all([
        Holding(account_id=acc.id, instrument_id=usd.id, asset_class=AssetClass.EQUITY,
                quantity=Decimal("1"), avg_cost=Decimal("1"), currency="USD"),
        Holding(account_id=acc.id, instrument_id=inr.id, asset_class=AssetClass.MUTUAL_FUND,
                quantity=Decimal("1"), avg_cost=Decimal("1"), currency="INR"),
    ])
    await session.flush()
    got = await fx_history.needed_currencies(session, "SGD")
    assert got == {"SGD", "USD", "INR"}


# --------------------------------------------------------------------------- #
# Step 3 (§2.2 verdict) — the date-aware valuation engine
# --------------------------------------------------------------------------- #
async def _seed_tsla_book(session):
    """A one-instrument USD book on an SGD base: 10 TSLA bought 2024-01-01 @ 100, a daily
    price history, a live quote, and per-date ECB FX. Returns (account, instrument)."""
    from datetime import UTC, datetime

    from app.models import Account, AssetClass, Holding, Instrument, PriceHistory, TxnType
    from app.models import Quote as QuoteRow
    from app.models import Transaction as Txn
    from app.services import fx_history
    from app.services.portfolio import rebuild_holdings_from_transactions

    acc = Account(name="A", currency="SGD")
    session.add(acc)
    await session.flush()
    instr = Instrument(symbol="TSLA", currency="USD", pricing_currency="USD", sector="Consumer Discretionary")
    session.add(instr)
    await session.flush()
    session.add(Txn(account_id=acc.id, instrument_id=instr.id, type=TxnType.BUY,
                    ts=datetime(2024, 1, 1, tzinfo=UTC), quantity=Decimal("10"),
                    price=Decimal("100"), currency="USD"))
    # Daily price history (midnight-UTC daily rows, the §14dr-25 convention).
    for d, close in [(datetime(2024, 6, 1, tzinfo=UTC), "200"),
                     (datetime(2025, 1, 1, tzinfo=UTC), "300")]:
        session.add(PriceHistory(instrument_id=instr.id, interval="1d", ts=d,
                                 open=Decimal(close), high=Decimal(close), low=Decimal(close),
                                 close=Decimal(close), source="alphavantage"))
    # Live quote (the as_of=None path).
    session.add(QuoteRow(instrument_id=instr.id, price=Decimal("400"), previous_close=Decimal("390"),
                         currency="USD", source="alphavantage", entitlement="delayed"))
    await session.flush()
    await rebuild_holdings_from_transactions(session)
    await fx_history.ingest_hist(session, _HIST_CSV)
    # A per-date USD/SGD anchor for 2024-06-01 (EUR→USD=1.10, EUR→SGD=1.45 → USD→SGD=1.45/1.10).
    from app.models import EcbFxHistory
    session.add_all([
        EcbFxHistory(currency="USD", as_of="2024-06-01", rate=Decimal("1.10")),
        EcbFxHistory(currency="SGD", as_of="2024-06-01", rate=Decimal("1.45")),
    ])
    await session.flush()
    return acc, instr


async def test_value_portfolio_accepts_as_of_and_is_byte_identical_when_none(session):
    """The load-bearing pin: value_portfolio(as_of=None) reproduces today's valuation output
    EXACTLY — same totals and same per-holding figures — so the date-aware generalisation is
    provably a no-op on the live path (RED before value_portfolio accepts as_of at all)."""
    from app.services.portfolio import value_portfolio

    await _seed_tsla_book(session)
    default = await value_portfolio(session, "SGD")
    as_of_none = await value_portfolio(session, "SGD", as_of=None)

    assert as_of_none.total_value == default.total_value
    assert as_of_none.cost_basis == default.cost_basis
    assert as_of_none.unrealised_pl == default.unrealised_pl
    assert len(as_of_none.holdings) == len(default.holdings)
    for a, b in zip(sorted(as_of_none.holdings, key=lambda h: h.holding_id),
                    sorted(default.holdings, key=lambda h: h.holding_id), strict=True):
        assert a.market_value_base == b.market_value_base
        assert a.cost_basis_base == b.cost_basis_base
        assert a.native_currency == b.native_currency


async def test_value_portfolio_as_of_uses_past_price_and_past_fx(session):
    """as_of=<past date> values from the PriceHistory close on/before the date and the per-date
    ECB FX — NOT today's quote or today's rate. 10 TSLA × 200 USD × (1.45/1.10) USD→SGD."""
    from datetime import date

    from app.services.portfolio import value_portfolio

    await _seed_tsla_book(session)
    val = await value_portfolio(session, "SGD", as_of=date(2024, 6, 1))
    tsla = [h for h in val.holdings if h.symbol == "TSLA"]
    assert tsla, "TSLA position should exist as-of 2024-06-01"
    expected = Decimal("10") * Decimal("200") * (Decimal("1.45") / Decimal("1.10"))
    # money() rounds to 2dp; compare the rounded headline.
    from app.core.money import money
    assert tsla[0].market_value_base == money(expected)
    assert val.total_value == money(expected)


async def test_value_portfolio_as_of_before_purchase_is_empty(session):
    """A date before the first buy has no position — the ledger-reconstructed portfolio is empty
    (no fabricated pre-existence)."""
    from datetime import date

    from app.services.portfolio import value_portfolio

    await _seed_tsla_book(session)
    val = await value_portfolio(session, "SGD", as_of=date(2023, 1, 1))
    assert [h for h in val.holdings if h.symbol == "TSLA"] == []
    assert val.total_value == Decimal("0.00")


# --------------------------------------------------------------------------- #
# Step 5 (§9-4) — trade-date cost-basis / fund currency inference (reader fixes)
# --------------------------------------------------------------------------- #
async def test_fund_recorded_in_sgd_infers_inr_cost_currency(session):
    """§9-4(b) at cause (portfolio.py:497): an AMFI fund whose NAV is INR (pricing_currency=INR)
    but whose buy was RECORDED in SGD must rebuild with holding.currency = INR — the fund's own
    currency — not the SGD transaction default. The recorded transaction numbers are untouched;
    only the derived cost currency is inferred correctly (resolves pre-release-walk item 10c)."""
    from app.models import Account, AssetClass, Instrument, TxnType
    from app.models import Transaction as Txn
    from app.services.portfolio import rebuild_holdings_from_transactions
    from sqlalchemy import select as _select
    from app.models import Holding

    acc = Account(name="A", currency="SGD")
    session.add(acc)
    await session.flush()
    # An AMFI scheme-code instrument: no exchange suffix (so venue inference yields nothing),
    # asset_class mutual_fund, pricing_currency INR (the authoritative NAV currency, W-2 field).
    fund = Instrument(symbol="102000", exchange=None, asset_class=AssetClass.MUTUAL_FUND,
                      currency="INR", pricing_currency="INR")
    session.add(fund)
    await session.flush()
    session.add(Txn(account_id=acc.id, instrument_id=fund.id, type=TxnType.BUY,
                    ts=__import__("app.db.base", fromlist=["utcnow"]).utcnow(),
                    quantity=Decimal("100"), price=Decimal("50"), currency="SGD"))  # recorded in SGD
    await session.flush()
    await rebuild_holdings_from_transactions(session)
    h = (await session.execute(_select(Holding).where(Holding.instrument_id == fund.id))).scalars().one()
    assert h.currency == "INR"  # the fund's NAV currency, not the SGD txn default


async def test_edit_recaptures_trade_date_fx_so_it_is_never_left_stale(app_client):
    """§9-4(c): the edit path (PUT …/transactions/{id}) must RE-CAPTURE fx_to_base like the add
    path — changing currency/date leaves the stored trade-date rate stale otherwise (§2.5 gap).
    Editing a domestic (rate-1) trade into a FOREIGN, BACKDATED one must re-capture as honestly
    unavailable (None) — never leave a stale rate 1 that misreads as a real cross-currency rate."""
    from datetime import UTC, datetime, timedelta

    from app.core.config import get_settings
    from app.db.base import get_sessionmaker
    from app.models import Transaction

    base = get_settings().base_currency
    today = datetime.now(UTC).replace(microsecond=0)
    r = await app_client.post("/api/v1/portfolio/transactions", json={
        "symbol": "AAPL", "type": "buy", "ts": today.isoformat(),
        "quantity": 1, "price": 100, "currency": base})
    tid = r.json()["transaction_id"]
    async with get_sessionmaker()() as s:
        t = await s.get(Transaction, tid)
        assert t.fx_to_base == Decimal("1") and t.fx_base == base  # domestic capture on add

    foreign = "USD" if base != "USD" else "INR"
    back = (today - timedelta(days=3)).isoformat()
    r2 = await app_client.put(f"/api/v1/portfolio/transactions/{tid}", json={
        "symbol": "AAPL", "type": "buy", "ts": back, "quantity": 1, "price": 100, "currency": foreign})
    assert r2.status_code == 200
    async with get_sessionmaker()() as s:
        t = await s.get(Transaction, tid)
        # Re-captured against the NEW currency+date: a backdated foreign trade is honestly
        # unavailable (proximity guard), so the stale rate-1 is cleared — not preserved.
        assert t.fx_to_base is None and t.fx_base is None


# --------------------------------------------------------------------------- #
# Step 9 (§9-8) — deterministic demo history generation (the step-4 enabler)
# --------------------------------------------------------------------------- #
async def test_demo_seeds_price_and_fx_history_so_as_of_prices_the_book(app_client):
    """§9-8: the demo now persists price_history + ecb_fx_history, so value_portfolio(as_of=<past>)
    prices the market book from generated history instead of returning 0 priced — the exact gap
    that would have flattened a consolidated performance line. Mixed USD/SGD/INR so the ▲-B drift
    can manifest."""
    from datetime import UTC, datetime, timedelta

    from sqlalchemy import func, select
    from app.db.base import get_sessionmaker
    from app.models import EcbFxHistory, PriceHistory
    from app.services.portfolio import value_portfolio

    async with get_sessionmaker()() as s:
        ph = (await s.execute(select(func.count()).select_from(PriceHistory))).scalar()
        fx = (await s.execute(select(func.count()).select_from(EcbFxHistory))).scalar()
        assert ph > 0 and fx > 0, "demo must generate price + FX history"
        # value the book 60 days ago: market positions must now be priced from generated history.
        d = (datetime.now(UTC) - timedelta(days=60)).date()
        val = await value_portfolio(s, "SGD", as_of=d)
        priced = [h for h in val.holdings if h.is_priced and h.market_value_base != 0]
        assert priced, "as-of valuation must price the market book from generated history"
        # deterministic: same inputs → identical total (a fixture, not a random walk).
        val2 = await value_portfolio(s, "SGD", as_of=d)
        assert val.total_value == val2.total_value


async def test_demo_fx_history_moves_over_the_span(app_client):
    """The generated per-date FX must MOVE (today's USD/SGD ≠ a past USD/SGD) — otherwise the
    current-FX-across-history drift the ▲-B consolidation fixes could not be demonstrated."""
    from datetime import UTC, datetime, timedelta

    from app.db.base import get_sessionmaker
    from app.services import fx_history

    async with get_sessionmaker()() as s:
        fxh = await fx_history.load_historical_fx(s, ["USD", "SGD"])
        today = datetime.now(UTC).date()
        early = today - timedelta(days=900)
        r_now = fxh.rate("USD", "SGD", today)
        r_then = fxh.rate("USD", "SGD", early)
        assert r_now is not None and r_then is not None
        assert r_now != r_then  # the drift the consolidation corrects


# --------------------------------------------------------------------------- #
# Step 4 (§9-7 / ▲-B) — analytics consolidation onto the date-aware engine
# --------------------------------------------------------------------------- #
class _RealStub:
    """A non-mock ('real') provider so get_history_cached serves the PERSISTED price_history
    (is_demo=False) instead of regenerating from the demo generator — lets the fixture pin exact
    closes, isolating the FX drift."""

    name = "alphavantage"
    fetch_on_demand = False

    async def get_history(self, *a, **k):
        return []

    async def get_fx_rate(self, *a, **k):
        return None


async def _seed_constant_price_moving_fx(session):
    """A single USD holding on an SGD base, bought before the window, with a CONSTANT USD price
    across the window and per-date FX that MOVES — so the only possible source of series movement
    is the FX. Plus a benchmark (SPY) series for the axis. Returns the window (start, end)."""
    from datetime import UTC, date, datetime, timedelta

    from app.models import Account, AssetClass, EcbFxHistory, Instrument, PriceHistory, TxnType
    from app.models import Transaction as Txn
    from app.services.portfolio import rebuild_holdings_from_transactions

    acc = Account(name="A", currency="SGD")
    session.add(acc)
    await session.flush()
    foo = Instrument(symbol="FOO", currency="USD", pricing_currency="USD", asset_class=AssetClass.EQUITY)
    session.add(foo)
    await session.flush()
    end = datetime.now(UTC)
    session.add(Txn(account_id=acc.id, instrument_id=foo.id, type=TxnType.BUY,
                    ts=end - timedelta(days=400), quantity=Decimal("100"), price=Decimal("10"),
                    currency="USD"))
    # Constant FOO close = 10 USD; a flat benchmark just to supply the axis; both weekdays.
    start = (end - timedelta(days=300)).date()
    d = start
    while d <= end.date():
        if d.weekday() < 5:
            ts = datetime(d.year, d.month, d.day, tzinfo=UTC)
            for sym_id, close in ((foo.id, "10"),):
                session.add(PriceHistory(instrument_id=sym_id, interval="1d", ts=ts,
                                         open=Decimal(close), high=Decimal(close), low=Decimal(close),
                                         close=Decimal(close), source="alphavantage"))
            # EUR->USD and EUR->SGD move differently → USD/SGD drifts across the window.
            idx = (d - start).days
            eur_usd = Decimal("1.05") + Decimal("0.0005") * idx
            eur_sgd = Decimal("1.44") + Decimal("0.0001") * idx
            for ccy, rate in (("EUR", Decimal("1")), ("USD", eur_usd), ("SGD", eur_sgd)):
                session.add(EcbFxHistory(currency=ccy, as_of=d.isoformat(), rate=rate))
        d += timedelta(days=1)
    await session.flush()
    await rebuild_holdings_from_transactions(session)
    # Benchmark SPY: a persisted series so the axis exists under the real-provider stub.
    spy = Instrument(symbol="SPY", currency="USD", pricing_currency="USD", asset_class=AssetClass.ETF)
    session.add(spy)
    await session.flush()
    d = start
    while d <= end.date():
        if d.weekday() < 5:
            ts = datetime(d.year, d.month, d.day, tzinfo=UTC)
            session.add(PriceHistory(instrument_id=spy.id, interval="1d", ts=ts,
                                     open=Decimal("500"), high=Decimal("500"), low=Decimal("500"),
                                     close=Decimal("500"), source="alphavantage"))
        d += timedelta(days=1)
    await session.flush()
    return start, end.date()


async def test_performance_series_must_track_per_date_fx_not_todays(session, monkeypatch):
    """▲-B RED (§9-7): with a CONSTANT USD price and MOVING per-date USD/SGD, the invested value
    genuinely moves (the date-aware engine proves it) — but the current performance_series values
    every historical point at TODAY's FX, so its line is FLAT. It must track per-date FX. FAILS
    RED against the drifted analytics; PASSES once it consumes the date-aware engine."""
    from datetime import UTC, datetime, timedelta

    import app.services.market as market
    from app.services.analytics import performance_series
    from app.services.portfolio import value_portfolio

    monkeypatch.setattr(market, "get_provider", lambda: _RealStub())
    start, end = await _seed_constant_price_moving_fx(session)

    # The TRUTH: the date-aware engine values the (constant-price) book differently across the
    # window because the FX moved — so any faithful performance line must move too.
    early = start + timedelta(days=20)
    late = end - timedelta(days=5)
    v_early = (await value_portfolio(session, "SGD", as_of=early)).total_value
    v_late = (await value_portfolio(session, "SGD", as_of=late)).total_value
    assert v_early != v_late, "sanity: per-date FX genuinely moves the constant-price valuation"

    perf = await performance_series(session, "SGD", 200, benchmark="SPY")
    vals = [p["value"] for p in perf["series"]]
    assert len(vals) > 2
    # The invested series MUST move with per-date FX. Drifted code holds today's FX constant →
    # a flat line. This is the fail-first RED the consolidation resolves.
    assert max(vals) != min(vals), "performance series must reflect per-date FX movement (▲-B W-1/current-FX drift)"


# --------------------------------------------------------------------------- #
# Step 5(a) (§9-4a) — trade-date cost-basis FX
# --------------------------------------------------------------------------- #
async def test_cost_basis_uses_stored_trade_date_fx_not_todays_rate(session):
    """§9-4(a): a cross-currency holding's cost basis converts at the STORED trade-date rate
    (transactions.fx_to_base), not today's rate. Buy 100 FOO @ 10 USD with a stored USD→SGD of
    2.50 → cost_basis_base = 2500 SGD, regardless of today's live USD/SGD. FAILS RED (today's
    rate) before the reader fix."""
    from datetime import UTC, datetime

    from app.models import Account, AssetClass, Instrument, TxnType
    from app.models import Quote as QuoteRow
    from app.models import Transaction as Txn
    from app.services.portfolio import rebuild_holdings_from_transactions, value_portfolio

    acc = Account(name="A", currency="SGD")
    session.add(acc)
    await session.flush()
    foo = Instrument(symbol="FOO", currency="USD", pricing_currency="USD", asset_class=AssetClass.EQUITY)
    session.add(foo)
    await session.flush()
    session.add(QuoteRow(instrument_id=foo.id, price=Decimal("10"), previous_close=Decimal("10"),
                         currency="USD", source="mock", entitlement="delayed"))
    session.add(Txn(account_id=acc.id, instrument_id=foo.id, type=TxnType.BUY,
                    ts=datetime(2024, 1, 2, tzinfo=UTC), quantity=Decimal("100"), price=Decimal("10"),
                    currency="USD", fx_to_base=Decimal("2.50"), fx_base="SGD"))  # stored trade-date rate
    await session.flush()
    await rebuild_holdings_from_transactions(session)
    val = await value_portfolio(session, "SGD")
    foo_hv = [h for h in val.holdings if h.symbol == "FOO"][0]
    # 100 × 10 USD × 2.50 (stored trade-date) = 2500 SGD — NOT today's live rate.
    assert foo_hv.cost_basis_base == Decimal("2500.00")


async def test_cost_basis_null_fx_is_honestly_flagged_not_todays_rate(session):
    """§9-4(a): a historical cross-currency trade with NO stored FX and NO per-date rate within
    ±7 days is honestly-missing — the holding is flagged (cost_fx_unavailable), never silently
    converted at today's rate. (With an ECB rate within 7 days it would instead be flagged
    approximate — covered on the owner's populated stack.)"""
    from datetime import UTC, datetime

    from app.models import Account, AssetClass, Instrument, TxnType
    from app.models import Quote as QuoteRow
    from app.models import Transaction as Txn
    from app.services.portfolio import rebuild_holdings_from_transactions, value_portfolio

    acc = Account(name="A", currency="SGD")
    session.add(acc)
    await session.flush()
    foo = Instrument(symbol="FOO", currency="USD", pricing_currency="USD", asset_class=AssetClass.EQUITY)
    session.add(foo)
    await session.flush()
    session.add(QuoteRow(instrument_id=foo.id, price=Decimal("10"), previous_close=Decimal("10"),
                         currency="USD", source="mock", entitlement="delayed"))
    # NULL fx_to_base (a backdated historical trade), and no ecb_fx_history seeded → no near rate.
    session.add(Txn(account_id=acc.id, instrument_id=foo.id, type=TxnType.BUY,
                    ts=datetime(2019, 1, 2, tzinfo=UTC), quantity=Decimal("100"), price=Decimal("10"),
                    currency="USD", fx_to_base=None, fx_base=None))
    await session.flush()
    await rebuild_holdings_from_transactions(session)
    val = await value_portfolio(session, "SGD")
    foo_hv = [h for h in val.holdings if h.symbol == "FOO"][0]
    assert foo_hv.cost_fx_unavailable is True  # flagged, not fabricated at today's rate


# --------------------------------------------------------------------------- #
# Step 7 (§9-1/§9-2/§9-6) — the backfill orchestrator
# --------------------------------------------------------------------------- #
async def _seed_backfill_book(session):
    """A market holding (TSLA/USD) + a manual cash asset, with generated price + FX history."""
    from datetime import UTC, datetime, timedelta

    from app.models import Account, AssetClass, EcbFxHistory, Holding, Instrument, PriceHistory, TxnType
    from app.models import Transaction as Txn
    from app.services.portfolio import rebuild_holdings_from_transactions

    acc = Account(name="A", currency="SGD")
    session.add(acc)
    await session.flush()
    tsla = Instrument(symbol="TSLA", currency="USD", pricing_currency="USD", asset_class=AssetClass.EQUITY)
    session.add(tsla)
    await session.flush()
    end = datetime.now(UTC)
    session.add(Txn(account_id=acc.id, instrument_id=tsla.id, type=TxnType.BUY,
                    ts=end - timedelta(days=40), quantity=Decimal("10"), price=Decimal("100"), currency="USD"))
    # A manual cash asset (no ledger history) — must carry flat across the backfill.
    session.add(Holding(account_id=acc.id, label="Cash", asset_class=AssetClass.CASH,
                        quantity=Decimal("1"), avg_cost=Decimal("5000"), manual_value=Decimal("5000"), currency="SGD"))
    start = (end - timedelta(days=45)).date()
    d = start
    while d <= end.date():
        ts = datetime(d.year, d.month, d.day, tzinfo=UTC)
        session.add(PriceHistory(instrument_id=tsla.id, interval="1d", ts=ts,
                                 open=Decimal("200"), high=Decimal("200"), low=Decimal("200"),
                                 close=Decimal("200"), source="mock"))
        for ccy, rate in (("EUR", Decimal("1")), ("USD", Decimal("1.10")), ("SGD", Decimal("1.45"))):
            session.add(EcbFxHistory(currency=ccy, as_of=d.isoformat(), rate=rate))
        d += timedelta(days=1)
    await session.flush()
    await rebuild_holdings_from_transactions(session)
    return acc


async def test_backfill_writes_daily_backfilled_snapshots_with_manual_flat(session):
    """§9-1: a daily backfilled series from the earliest txn, provenance=backfilled, that includes
    the manual cash carried flat. TSLA 10×200 USD×(1.45/1.10) + 5000 cash on each covered day."""
    from app.services import backfill

    await _seed_backfill_book(session)
    res = await backfill.run_backfill(session, "SGD", write_progress=False)
    assert res["days"] > 0
    rows = (await session.execute(
        select(NetWorthSnapshot).where(NetWorthSnapshot.source == "backfilled").order_by(NetWorthSnapshot.ts)
    )).scalars().all()
    assert len(rows) == res["days"]
    market = Decimal("10") * Decimal("200") * (Decimal("1.45") / Decimal("1.10"))
    from app.core.money import money
    # Every covered day: market value + 5000 flat cash (positions constant over the window).
    assert all(r.net_worth == money(market + Decimal("5000")) for r in rows[-5:])
    assert all(r.source == "backfilled" for r in rows)


async def test_backfill_is_idempotent_and_real_supersedes(session):
    """§9-1: re-running never duplicates (backfilled rows replaced), and a pre-existing live/manual
    row for a date is never shadowed by a backfilled one."""
    from datetime import UTC, datetime, timedelta

    from sqlalchemy import and_, func

    from app.services import backfill

    await _seed_backfill_book(session)
    # A live row for 3 days ago — must be preserved, not overwritten by a backfilled row.
    live_day = (datetime.now(UTC) - timedelta(days=3)).date()
    session.add(NetWorthSnapshot(ts=datetime(live_day.year, live_day.month, live_day.day, tzinfo=UTC),
                                 base_currency="SGD", assets=Decimal("99999"), liabilities=Decimal("0"),
                                 net_worth=Decimal("99999"), source="live"))
    await session.flush()

    r1 = await backfill.run_backfill(session, "SGD", write_progress=False)
    r2 = await backfill.run_backfill(session, "SGD", write_progress=False)
    assert r1["days"] == r2["days"]  # idempotent — no growth
    total_backfilled = (await session.execute(
        select(func.count()).select_from(NetWorthSnapshot).where(NetWorthSnapshot.source == "backfilled")
    )).scalar()
    assert total_backfilled == r2["days"]
    # The live row survived and no backfilled row shadows its date.
    shadow = (await session.execute(
        select(func.count()).select_from(NetWorthSnapshot).where(and_(
            NetWorthSnapshot.source == "backfilled",
            func.date(NetWorthSnapshot.ts) == live_day.isoformat()))
    )).scalar()
    assert shadow == 0


async def test_snapshot_now_writes_manual_row(session):
    """§9-6: snapshot-now writes a source='manual' dated row from the current full valuation."""
    from app.services import backfill

    await _seed_backfill_book(session)
    res = await backfill.snapshot_now(session, "SGD")
    assert res["ok"]
    row = (await session.execute(
        select(NetWorthSnapshot).where(NetWorthSnapshot.source == "manual")
    )).scalars().one()
    assert row.net_worth > 0


async def test_backfill_and_snapshot_endpoints_served(app_client):
    """The trigger, the served-progress poll, and snapshot-now are wired at the HTTP boundary."""
    r = await app_client.post("/api/v1/net-worth/backfill")
    assert r.status_code == 200 and "message" in r.json()
    st = (await app_client.get("/api/v1/net-worth/backfill-status")).json()
    assert set(("running", "done", "total", "ok", "failed")) <= set(st)
    snap = await app_client.post("/api/v1/net-worth/snapshot")
    assert snap.status_code in (200, 409)  # 409 only if a backfill is mid-flight


# --------------------------------------------------------------------------- #
# Step 8 (§9-5) — served trend: provenance + carried-forward flag
# --------------------------------------------------------------------------- #
async def test_backfill_flags_carried_forward_when_fx_missing(session):
    """§9-5: a date whose valuation could not honestly price a holding (here USD→SGD unavailable —
    no ecb_fx_history for USD) is marked 'carried_forward', never an unmarked smooth point."""
    from datetime import UTC, datetime, timedelta

    from app.models import Account, AssetClass, Instrument, PriceHistory, TxnType
    from app.models import Transaction as Txn
    from app.services import backfill
    from app.services.portfolio import rebuild_holdings_from_transactions

    acc = Account(name="A", currency="SGD")
    session.add(acc)
    await session.flush()
    foo = Instrument(symbol="FOO", currency="USD", pricing_currency="USD", asset_class=AssetClass.EQUITY)
    session.add(foo)
    await session.flush()
    end = datetime.now(UTC)
    session.add(Txn(account_id=acc.id, instrument_id=foo.id, type=TxnType.BUY,
                    ts=end - timedelta(days=30), quantity=Decimal("10"), price=Decimal("100"), currency="USD"))
    d = (end - timedelta(days=32)).date()
    while d <= end.date():
        session.add(PriceHistory(instrument_id=foo.id, interval="1d",
                                 ts=datetime(d.year, d.month, d.day, tzinfo=UTC),
                                 open=Decimal("200"), high=Decimal("200"), low=Decimal("200"),
                                 close=Decimal("200"), source="mock"))
        d += timedelta(days=1)
    await session.flush()
    await rebuild_holdings_from_transactions(session)  # NOTE: no ecb_fx_history seeded → USD→SGD unavailable
    await backfill.run_backfill(session, "SGD", write_progress=False)
    flagged = (await session.execute(
        select(NetWorthSnapshot).where(NetWorthSnapshot.flags == "carried_forward")
    )).scalars().all()
    assert flagged, "a date with unavailable FX must be flagged carried_forward"


async def test_net_worth_history_serves_provenance_and_gap_fields(app_client):
    """§9-1/§9-5 at the HTTP boundary: every trend point carries served provenance + a
    carried-forward flag (+ reason string when set) — the chart consumes served truth only."""
    d = (await app_client.get("/api/v1/net-worth/history")).json()
    assert d["history"], "demo seeds a net-worth trend"
    for p in d["history"]:
        assert p["source"] in ("backfilled", "live", "manual")
        assert isinstance(p["carried_forward"], bool)
        # the reason is served (non-null) exactly when carried_forward is set (D-105).
        assert (p["reason"] is not None) == p["carried_forward"]

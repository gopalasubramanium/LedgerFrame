# SPDX-License-Identifier: AGPL-3.0-or-later
"""Seed realistic DEMO data: accounts, instruments, transactions, watchlists,
dashboard rotation config. Idempotent — skips if data already exists.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.money import D
from app.models import (
    Account,
    AssetClass,
    Holding,
    Instrument,
    InsurancePolicy,
    Transaction,
    TxnType,
    Watchlist,
    WatchlistItem,
)
from app.providers.market.mock import _CATALOG
from app.services.portfolio import rebuild_holdings_from_transactions

# (symbol, type, date, qty, price, fees, ccy)
_DEMO_TXNS = [
    ("AAPL", "buy", "2023-02-10", 30, 150.0, 1.0, "USD"),
    ("AAPL", "buy", "2023-08-15", 20, 175.0, 1.0, "USD"),
    ("AAPL", "sell", "2024-04-01", 15, 190.0, 1.0, "USD"),
    ("MSFT", "buy", "2023-03-05", 15, 250.0, 1.0, "USD"),
    ("NVDA", "buy", "2023-06-20", 40, 45.0, 1.0, "USD"),
    ("VOO", "buy", "2023-01-12", 25, 360.0, 1.0, "USD"),
    ("D05", "buy", "2023-09-01", 200, 33.0, 5.0, "SGD"),
    ("RELIANCE", "buy", "2023-11-10", 50, 2400.0, 10.0, "INR"),
    ("HDFCNIFTY", "buy", "2023-07-01", 500, 200.0, 0.0, "INR"),
    ("BTC", "buy", "2023-05-01", 0.15, 28000.0, 5.0, "USD"),
]


SEED_FLAG_KEY = "demo_seed_done"


async def seed_demo_data(session: AsyncSession) -> bool:
    """Seed demo data exactly once. A persistent flag prevents re-seeding after the
    user clears their data (otherwise an empty DB would re-seed on every boot)."""
    from app.models import Setting

    flag = (await session.execute(select(Setting).where(Setting.key == SEED_FLAG_KEY))).scalars().first()
    if flag and flag.value == "1":
        return False
    existing = (await session.execute(select(func.count()).select_from(Transaction))).scalar()
    if existing:
        return False

    brokerage = Account(name="Demo Brokerage", kind="brokerage", currency="USD")
    sg_account = Account(name="Demo SG CDP", kind="brokerage", currency="SGD")
    cash = Account(name="Demo Cash", kind="cash", currency="SGD")
    session.add_all([brokerage, sg_account, cash])
    await session.flush()

    from app.services.identity import classify_defaults

    instruments: dict[str, Instrument] = {}
    for sym, info in _CATALOG.items():
        ac = AssetClass(info["ac"])
        manual = bool(info.get("manual_price"))  # catalog may flag manual-priced items
        instr = Instrument(
            symbol=sym, name=info["name"], asset_class=ac,
            currency=info["ccy"], sector=info["sec"], country=info["ctry"],
            market_cap=D(info["base"]) * D(1_000_000), is_manual_price=manual,
            # Phase 2: classify demo instruments so taxonomy is populated even on a
            # fresh create_all boot (before the migration backfill runs). Mirrors the
            # migration's is_manual_price-based rule so seeded + migrated rows agree.
            **classify_defaults(ac, is_manual_price=manual, currency=info["ccy"]),
        )
        instruments[sym] = instr
        session.add(instr)
    await session.flush()

    for sym, ttype, date, qty, price, fees, ccy in _DEMO_TXNS:
        acc = sg_account if ccy == "SGD" else brokerage
        session.add(Transaction(
            account_id=acc.id, instrument_id=instruments[sym].id, type=TxnType(ttype),
            ts=datetime.fromisoformat(date).replace(tzinfo=UTC),
            quantity=D(qty), price=D(price), fees=D(fees), currency=ccy,
            amount=D(qty) * D(price),
        ))
    await session.flush()

    # Manual / statement-valued assets across the taxonomy: cash, fixed deposit,
    # a government bond, a retirement account, property, and a mortgage liability.
    session.add_all([
        Holding(account_id=cash.id, label="Emergency cash", asset_class=AssetClass.CASH,
                quantity=D(1), avg_cost=D(25000), manual_value=D(25000), currency="SGD"),
        Holding(account_id=cash.id, label="6-month fixed deposit", asset_class=AssetClass.FIXED_DEPOSIT,
                quantity=D(1), avg_cost=D(50000), manual_value=D(50500), currency="SGD"),
        Holding(account_id=cash.id, label="Singapore Savings Bond (SSB)", asset_class=AssetClass.BOND,
                quantity=D(1), avg_cost=D(30000), manual_value=D(30450), currency="SGD"),
        Holding(account_id=cash.id, label="CPF Ordinary Account", asset_class=AssetClass.RETIREMENT,
                quantity=D(1), avg_cost=D(65000), manual_value=D(65000), currency="SGD"),
        Holding(account_id=cash.id, label="Home (est.)", asset_class=AssetClass.PROPERTY,
                quantity=D(1), avg_cost=D(900000), manual_value=D(980000), currency="SGD"),
        Holding(account_id=cash.id, label="Home mortgage", asset_class=AssetClass.LIABILITY,
                quantity=D(1), avg_cost=D(420000), manual_value=D(420000), currency="SGD"),
    ])

    # Link the demo crypto to canonical CoinGecko ids (metadata only — no price
    # change) so the per-asset crypto detail view is populated in demo mode.
    from app.models import CoingeckoCoin
    from app.services.identity import set_identifier

    now = datetime.now(UTC)
    session.add_all([
        CoingeckoCoin(id="bitcoin", symbol="btc", name="Bitcoin (DEMO)", market_cap_usd=D("1300000000000"), updated_at=now),
        CoingeckoCoin(id="ethereum", symbol="eth", name="Ethereum (DEMO)", market_cap_usd=D("410000000000"), updated_at=now),
    ])
    await session.flush()
    await set_identifier(session, instruments["BTC"].id, "coingecko_id", "bitcoin", provider="coingecko", is_primary=True)
    await set_identifier(session, instruments["ETH"].id, "coingecko_id", "ethereum", provider="coingecko", is_primary=True)

    wl = Watchlist(name="Core Watchlist", sort_order=0)
    session.add(wl)
    await session.flush()
    for i, sym in enumerate(["AAPL", "MSFT", "NVDA", "VOO", "GLD", "BTC", "ETH", "^STI"]):
        session.add(WatchlistItem(watchlist_id=wl.id, instrument_id=instruments[sym].id, sort_order=i))

    await session.flush()
    await rebuild_holdings_from_transactions(session)

    # Representative tags on a few holdings so the By-tag donut + /portfolio/tags render
    # populated in demo (page-portfolio §12b-6). Keys match the tag reader — instrument symbol
    # (or manual label), scoped to the holding's account; the seed-flag convention is unchanged.
    import json as _json

    from app.models import HoldingTag
    # §12b4-2: tags are USER-AUTHORED display strings, stored + rendered VERBATIM (no UI casing
    # transform anywhere). The seed authors them with display casing so demo reads like real data.
    _seed_tags = {
        "AAPL": ["Core", "Dividend"],
        "MSFT": ["Core", "Dividend"],
        "NVDA": ["Core", "Speculative"],
        "VOO": ["Core"],
        "BTC": ["Speculative"],
    }
    for h in (await session.execute(select(Holding).where(Holding.deleted_at.is_(None)))).scalars().all():
        instr = await session.get(Instrument, h.instrument_id) if h.instrument_id else None
        key = (instr.symbol if instr and instr.symbol else None) or h.label
        if key in _seed_tags and h.account_id is not None:
            session.add(HoldingTag(account_id=h.account_id, holding_key=key, tags=_json.dumps(_seed_tags[key])))

    # Synthetic net-worth snapshots (page-net-worth ND-1) so the demo trend renders POPULATED.
    # Demo-only, seed-flag convention — a REAL appliance accumulates these from the 6-hour worker
    # (app/worker.generate_snapshots); no history is ever fabricated on a real install. The series
    # ends at today's real seeded net worth and eases up to it (no claim of a specific past).
    from datetime import timedelta

    from app.core.config import get_settings
    from app.models import NetWorthSnapshot
    from app.services.portfolio import value_portfolio

    base_ccy = get_settings().base_currency
    val = await value_portfolio(session, base_ccy)
    assets_now = sum((h.market_value_base for h in val.holdings if h.market_value_base > 0), D("0"))
    liab_now = -sum((h.market_value_base for h in val.holdings if h.market_value_base < 0), D("0"))  # stored positive (worker convention)
    net_now = val.total_value
    _POINTS = 26  # ~6 months of weekly snapshots
    _now = datetime.now(UTC)
    for i in range(_POINTS):
        frac = D("0.80") + D("0.20") * (D(i) / D(_POINTS - 1))  # 80% → 100%, ending at today's real value
        ts = _now - timedelta(weeks=(_POINTS - 1 - i))
        session.add(NetWorthSnapshot(
            ts=ts, base_currency=base_ccy,
            assets=(assets_now * frac).quantize(D("1")),
            liabilities=(liab_now * frac).quantize(D("1")),
            net_worth=(net_now * frac).quantize(D("1")),
        ))

    # Insurance protection register (page-insurance) — a realistic household set so the page renders
    # POPULATED, exercising every honesty case live: a NON-BASE (USD) policy (§12in-1), a LAPSED policy
    # (visible, excluded from totals + the active count, §9-10), a MISSING premium (em dash, §12in-4),
    # and renewals spanning overdue / soon / upcoming (§12in-3). Demo-only, seed-flag convention.
    import json as _ins_json
    from datetime import timedelta as _td

    _today = datetime.now(UTC).date()

    def _iso(days: int) -> str:
        return (_today + _td(days=days)).isoformat()

    # A realistic MIXED-FREQUENCY register (page-insurance §14in-2): the premium is stored as the user
    # pays it (monthly 200, quarterly 150, …) and the page shows the ANNUAL EQUIVALENT (monthly ×12,
    # quarterly ×4). The monthly/quarterly annual-equivalents below equal the prior annual premiums, so
    # total_annual_premium is unchanged while the per-row "Premium / yr" now exercises the annualisation.
    _seed_policies = [
        # name, insurer, type, currency, cover, cash, premium, freq, renewal_days, status, docs
        ("Term Life", "Prudential Assurance Singapore", "term_life", "SGD", "500000", None, "100", "monthly", 45, "active", True),         # 1,200/yr
        ("Global Whole Life", "Zurich International", "whole_life", "USD", "500000", "12000", "800", "annual", 210, "active", False),       # 800/yr (non-base)
        ("IntegratedShield", "AIA Singapore", "health", "SGD", "1000000", None, "200", "monthly", 12, "active", False),                    # 2,400/yr
        ("Critical Illness", "Manulife (Singapore)", "critical_illness", "SGD", "300000", None, "450", "quarterly", -8, "active", False),  # 1,800/yr
        ("Personal Accident", "NTUC Income Insurance Co-operative", "personal_accident", "SGD", "250000", None, "40", "monthly", 90, "active", False),  # 480/yr
        ("Motor (private car)", "MSIG Insurance", "motor", "SGD", "80000", None, None, "annual", 25, "active", False),                     # no premium → em dash
        ("Home Contents", "Chubb Insurance Singapore", "property", "SGD", "150000", None, "150", "quarterly", 300, "active", False),       # 600/yr
        ("Endowment (matured)", "AXA Insurance", "whole_life", "SGD", "50000", "51000", "3000", "single", None, "lapsed", False),          # single-pay → em dash (no annual equiv)
    ]
    for name, insurer, ptype, ccy, cover, cash, prem, freq, rd, status, docs in _seed_policies:
        session.add(InsurancePolicy(
            name=name, insurer=insurer, policy_type=ptype, currency=ccy,
            cover_amount=D(cover), cash_value=(D(cash) if cash else None),
            premium=(D(prem) if prem else None), premium_frequency=freq,
            renewal_date=(_iso(rd) if rd is not None else None), status=status,
            documents=(_ins_json.dumps([{"label": "Policy schedule", "have": True},
                                        {"label": "Premium receipts", "have": False}]) if docs else None),
        ))

    session.add(Setting(key=SEED_FLAG_KEY, value="1"))
    await session.flush()
    return True

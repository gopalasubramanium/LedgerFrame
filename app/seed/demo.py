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
    Entity,
    EstateContact,
    EstateDocument,
    EstateProfile,
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


async def seed_estate(session: AsyncSession) -> None:
    """Seed the estate & document readiness register (page-estate) — a realistic household so the
    page renders POPULATED, exercising every honesty case live: a will marked EXECUTED (the profile
    chip leads, §12es-1); a review due SOON so the _REVIEW_SOON_DAYS=30 signal surfaces (§9-8); a
    MULTI-ROLE contact + contacts with blank phone/email (bare em dashes, §12in-4); and a document
    register with one MISSING + one OUTDATED (attention chips) among present ones. Roles/category/
    status render from the SERVED /refdata labels. Extracted so the Phase-3a pre-pass can populate a
    reset instance without re-running the whole demo seed."""
    import json as _est_json
    from datetime import timedelta as _td

    today = datetime.now(UTC).date()

    def _iso(days: int) -> str:
        return (today + _td(days=days)).isoformat()

    session.add(EstateProfile(
        will_status="executed",
        will_location="Home safe (fireproof box)",
        executor="Priya Raghunathan-Venkataraman",
        last_reviewed=_iso(-180),           # reviewed six months ago
        next_review_date=_iso(20),          # due in 20 days → within 30 → the review-soon signal fires (§9-8)
        notes="Solicitor: Wong & Partners. Signed copies held by the executor and in the bank locker.",
    ))

    # name, roles[], phone, email  (blank phone/email → bare em dash on the page)
    _seed_contacts = [
        ("Priya Raghunathan-Venkataraman", ["executor", "beneficiary", "emergency"], "+65 9123 4567", "priya.rv@example.com"),  # multi-role
        ("Arjun Mehta", ["nominee", "beneficiary"], "+65 8234 5678", "arjun.mehta@example.com"),
        ("Lakshmi Narasimhan", ["guardian"], "+65 8345 6789", None),                 # no email → em dash
        ("David Okonkwo-Williams", ["emergency"], None, "d.okonkwo@example.com"),     # no phone → em dash
        ("Chen Wei", ["beneficiary"], "+65 8456 7890", "chen.wei@example.com"),
        ("Fatima Al-Rashid", ["nominee", "guardian"], "+65 8567 8901", "fatima.ar@example.com"),
        ("Sanjay Gupta", ["executor"], "+65 8678 9012", None),                        # no email → em dash
    ]
    for name, roles, phone, email in _seed_contacts:
        session.add(EstateContact(name=name, roles=_est_json.dumps(roles), phone=phone, email=email))

    # title, category, status, location, review_date  (one MISSING + one OUTDATED; blank location/review → em dash)
    _seed_documents = [
        ("Last Will and Testament", "will", "present", "Home safe (fireproof box)", _iso(365)),
        ("Term Life Policy Schedule", "insurance", "present", "Filing cabinet A", _iso(110)),
        ("Property Title Deed (Apartment)", "property", "present", "Bank safe-deposit locker", None),
        ("Home Loan Agreement", "loan", "outdated", "Bank safe-deposit locker", _iso(-130)),   # OUTDATED (attention)
        ("Passport (primary holder)", "identity", "present", "Home safe", _iso(900)),
        ("Passport (spouse)", "identity", "missing", None, None),                              # MISSING (attention)
        ("Bank Account Details", "bank", "present", "Password manager", None),
        ("Income Tax Returns 2025", "tax", "present", "Cloud drive", None),
        ("Medical Directive / Living Will", "medical", "present", "Home safe", None),
        ("Vehicle Registration", "other", "present", "Glovebox", None),
    ]
    for title, category, status, location, review in _seed_documents:
        session.add(EstateDocument(title=title, category=category, status=status,
                                   location=location, review_date=review))


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
    # kind "bank" (was "cash" — out of ACCOUNT_KINDS vocab, which /accounts's write path would 400 on).
    cash = Account(name="Demo Cash", kind="bank", currency="SGD")
    session.add_all([brokerage, sg_account, cash])
    await session.flush()

    # Entities (§10-5 / D-065) + institution master (D-008) wiring for the /accounts page. Accounts
    # span three entities; institutions are FK'd from the account (the same master insurers FK into).
    # A near-duplicate pair ("DBS" vs "DBS Bank") seeds the user-driven merge demo (§9-2).
    from app.services.institutions import get_or_create_institution

    household = Entity(name="Household", kind="self")
    trust = Entity(name="Rajan Family Trust", kind="trust")
    person = Entity(name="Meera Iyer", kind="spouse")  # 0 accounts → the deletable-entity demo (§9-6)
    session.add_all([household, trust, person])
    await session.flush()

    saxo = await get_or_create_institution(session, "Saxo Markets")
    citi_sg = await get_or_create_institution(session, "Citibank Singapore")  # merge survivor
    citi = await get_or_create_institution(session, "Citibank")  # the merge duplicate — 1 account to re-point
    brokerage.institution = saxo
    brokerage.entity_id = trust.id
    sg_account.institution = citi_sg
    sg_account.entity_id = household.id
    cash.institution = citi
    cash.entity_id = household.id
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
    # D-008 (§9-1): insurers seed the shared Institution master (String col dropped) — resolve-or-create.
    from app.services.institutions import get_or_create_institution
    for name, insurer, ptype, ccy, cover, cash, prem, freq, rd, status, docs in _seed_policies:
        inst = await get_or_create_institution(session, insurer) if insurer else None
        session.add(InsurancePolicy(
            name=name, institution=inst, policy_type=ptype, currency=ccy,
            cover_amount=D(cover), cash_value=(D(cash) if cash else None),
            premium=(D(prem) if prem else None), premium_frequency=freq,
            renewal_date=(_iso(rd) if rd is not None else None), status=status,
            documents=(_ins_json.dumps([{"label": "Policy schedule", "have": True},
                                        {"label": "Premium receipts", "have": False}]) if docs else None),
        ))

    await seed_estate(session)

    session.add(Setting(key=SEED_FLAG_KEY, value="1"))
    await session.flush()
    return True

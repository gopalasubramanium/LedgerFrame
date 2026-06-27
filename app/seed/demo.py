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
    DashboardConfig,
    DashboardRotationItem,
    Holding,
    Instrument,
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
    ("BTC", "buy", "2023-05-01", 0.15, 28000.0, 5.0, "USD"),
]

_DEMO_PAGES = ["home", "portfolio", "markets", "heatmap", "news"]


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

    instruments: dict[str, Instrument] = {}
    for sym, info in _CATALOG.items():
        instr = Instrument(
            symbol=sym, name=info["name"], asset_class=AssetClass(info["ac"]),
            currency=info["ccy"], sector=info["sec"], country=info["ctry"],
            market_cap=D(info["base"]) * D(1_000_000),
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

    # Manual assets: cash, a fixed deposit, property, and a mortgage liability.
    session.add_all([
        Holding(account_id=cash.id, label="Emergency cash", asset_class=AssetClass.CASH,
                quantity=D(1), avg_cost=D(25000), manual_value=D(25000), currency="SGD"),
        Holding(account_id=cash.id, label="6-month fixed deposit", asset_class=AssetClass.FIXED_DEPOSIT,
                quantity=D(1), avg_cost=D(50000), manual_value=D(50500), currency="SGD"),
        Holding(account_id=cash.id, label="Home (est.)", asset_class=AssetClass.PROPERTY,
                quantity=D(1), avg_cost=D(900000), manual_value=D(980000), currency="SGD"),
        Holding(account_id=cash.id, label="Home mortgage", asset_class=AssetClass.LIABILITY,
                quantity=D(1), avg_cost=D(420000), manual_value=D(420000), currency="SGD"),
    ])

    wl = Watchlist(name="Core Watchlist", sort_order=0)
    session.add(wl)
    await session.flush()
    for i, sym in enumerate(["AAPL", "MSFT", "NVDA", "VOO", "GLD", "BTC", "ETH", "^STI"]):
        session.add(WatchlistItem(watchlist_id=wl.id, instrument_id=instruments[sym].id, sort_order=i))

    cfg = DashboardConfig(name="default", rotation_seconds=30)
    session.add(cfg)
    await session.flush()
    for i, page in enumerate(_DEMO_PAGES):
        session.add(DashboardRotationItem(config_id=cfg.id, page=page, sort_order=i))

    await session.flush()
    await rebuild_holdings_from_transactions(session)
    session.add(Setting(key=SEED_FLAG_KEY, value="1"))
    await session.flush()
    return True

# SPDX-License-Identifier: AGPL-3.0-or-later
"""Portfolio valuation, staleness, and CSV import against a real DB session."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal

from app.core.config import get_settings
from app.models import Account, AssetClass, Holding, Instrument
from app.models import Quote as QuoteRow
from app.services.csv_import import import_transactions_csv
from app.services.market import get_cached_quote
from app.services.portfolio import rebuild_holdings_from_transactions, value_portfolio


async def test_manual_assets_and_liabilities_net(session):
    acc = Account(name="A", currency="SGD")
    session.add(acc)
    await session.flush()
    session.add_all([
        Holding(account_id=acc.id, label="Cash", asset_class=AssetClass.CASH,
                quantity=Decimal("1"), avg_cost=Decimal("10000"),
                manual_value=Decimal("10000"), currency="SGD"),
        Holding(account_id=acc.id, label="Loan", asset_class=AssetClass.LIABILITY,
                quantity=Decimal("1"), avg_cost=Decimal("4000"),
                manual_value=Decimal("4000"), currency="SGD"),
    ])
    await session.flush()
    val = await value_portfolio(session, "SGD")
    # 10000 asset - 4000 liability = 6000 net
    assert val.total_value == Decimal("6000.00")


async def test_allocation_is_gross_and_excludes_liabilities(session):
    """ND-4 / D-033 / GLOSSARY: allocation weight = share of GROSS assets — liabilities are
    never an allocation row, and negatives/zeros are excluded. The map sums to gross assets."""
    acc = Account(name="A", currency="SGD")
    session.add(acc)
    await session.flush()
    instr = Instrument(symbol="AAPL", currency="SGD", sector="Technology")
    session.add(instr)
    await session.flush()
    session.add(QuoteRow(instrument_id=instr.id, price=Decimal("100"), previous_close=Decimal("100"),
                         currency="SGD", source="mock", entitlement="delayed"))
    session.add_all([
        Holding(account_id=acc.id, instrument_id=instr.id, label="AAPL", asset_class=AssetClass.EQUITY,
                quantity=Decimal("10"), avg_cost=Decimal("90"), currency="SGD"),
        Holding(account_id=acc.id, label="Cash", asset_class=AssetClass.CASH, quantity=Decimal("1"),
                avg_cost=Decimal("10000"), manual_value=Decimal("10000"), currency="SGD"),
        Holding(account_id=acc.id, label="Loan", asset_class=AssetClass.LIABILITY, quantity=Decimal("1"),
                avg_cost=Decimal("4000"), manual_value=Decimal("4000"), currency="SGD"),
    ])
    await session.flush()
    val = await value_portfolio(session, "SGD")

    alloc = val.allocation("asset_class")
    assert "liability" not in alloc  # liabilities are NOT an allocation row
    assert set(alloc) == {"equity", "cash"}
    gross = sum(h.market_value_base for h in val.holdings if h.market_value_base > 0)
    assert sum(alloc.values()) == gross == Decimal("11000")  # 1000 equity + 10000 cash
    assert val.total_value == Decimal("7000")  # net (gross − 4000 liability) is separate


async def test_sector_allocation_serves_the_d082_null_bucket(session):
    """ND-4 / D-082: positive holdings without a resolved sector roll into an explicit
    'Not sector-classified (non-equity)' bucket (never dropped); liabilities excluded; sums to gross."""
    from app.services.portfolio import UNCLASSIFIED_SECTOR_LABEL

    acc = Account(name="A", currency="SGD")
    session.add(acc)
    await session.flush()
    instr = Instrument(symbol="AAPL", currency="SGD", sector="Technology")
    session.add(instr)
    await session.flush()
    session.add(QuoteRow(instrument_id=instr.id, price=Decimal("100"), previous_close=Decimal("100"),
                         currency="SGD", source="mock", entitlement="delayed"))
    session.add_all([
        Holding(account_id=acc.id, instrument_id=instr.id, label="AAPL", asset_class=AssetClass.EQUITY,
                quantity=Decimal("10"), avg_cost=Decimal("90"), currency="SGD"),
        Holding(account_id=acc.id, label="Home", asset_class=AssetClass.PROPERTY, quantity=Decimal("1"),
                avg_cost=Decimal("50000"), manual_value=Decimal("50000"), currency="SGD"),  # sector null
        Holding(account_id=acc.id, label="Loan", asset_class=AssetClass.LIABILITY, quantity=Decimal("1"),
                avg_cost=Decimal("4000"), manual_value=Decimal("4000"), currency="SGD"),
    ])
    await session.flush()
    val = await value_portfolio(session, "SGD")

    sec = val.sector_allocation()
    assert sec.get("Technology") == Decimal("1000")
    assert sec.get(UNCLASSIFIED_SECTOR_LABEL) == Decimal("50000")  # property, no sector
    assert UNCLASSIFIED_SECTOR_LABEL == "Unclassified sector"  # D-082 amendment 2026-07-11
    gross = sum(h.market_value_base for h in val.holdings if h.market_value_base > 0)
    assert sum(sec.values()) == gross == Decimal("51000")  # liability excluded


async def test_stale_quote_is_flagged_and_marked_cached(session):
    instr = Instrument(symbol="AAPL", currency="USD")
    session.add(instr)
    await session.flush()
    old = datetime.now(UTC) - timedelta(seconds=get_settings().stale_after_seconds + 60)
    session.add(QuoteRow(instrument_id=instr.id, price=Decimal("100"),
                         previous_close=Decimal("99"), currency="USD",
                         source="mock", entitlement="delayed", received_at=old))
    await session.flush()
    q = await get_cached_quote(session, "AAPL")
    assert q.is_stale is True
    assert q.entitlement.value == "cached"


async def test_unavailable_quote_has_no_fabricated_price(session):
    instr = Instrument(symbol="ZZZZ", currency="USD")
    session.add(instr)
    await session.flush()
    q = await get_cached_quote(session, "ZZZZ")  # no quote row exists
    assert q.price is None
    assert q.entitlement.value == "unavailable"


async def test_csv_import_builds_holdings(session):
    csv_bytes = (
        b"date,symbol,type,quantity,price,fees,currency,note\n"
        b"2024-01-01,AAPL,buy,10,100,1,USD,first\n"
        b"2024-02-01,AAPL,buy,10,200,1,USD,second\n"
        b"2024-03-01,AAPL,sell,5,250,1,USD,trim\n"
    )
    result = await import_transactions_csv(session, csv_bytes)
    assert result["imported"] == 3
    await rebuild_holdings_from_transactions(session)
    val = await value_portfolio(session, "USD")
    aapl = [h for h in val.holdings if h.symbol == "AAPL"]
    assert aapl and aapl[0].quantity == Decimal("15")


async def test_csv_rejects_oversize(session):
    import pytest

    big = b"date,symbol,type,quantity,price,fees,currency,note\n" + b"x" * (6 * 1024 * 1024)
    with pytest.raises(ValueError):
        await import_transactions_csv(session, big)

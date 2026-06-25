"""Portfolio valuation, staleness, and CSV import against a real DB session."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
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


async def test_stale_quote_is_flagged_and_marked_cached(session):
    instr = Instrument(symbol="AAPL", currency="USD")
    session.add(instr)
    await session.flush()
    old = datetime.now(timezone.utc) - timedelta(seconds=get_settings().stale_after_seconds + 60)
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

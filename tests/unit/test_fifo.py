"""FIFO cost-basis correctness — the most safety-critical engine in the app."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

from app.models import Transaction, TxnType
from app.services.portfolio import compute_fifo


def _txn(ttype, date, qty, price, fees=0, amount=0):
    return Transaction(
        type=TxnType(ttype), ts=datetime.fromisoformat(date).replace(tzinfo=UTC),
        quantity=Decimal(str(qty)), price=Decimal(str(price)), fees=Decimal(str(fees)),
        amount=Decimal(str(amount)), currency="USD", account_id=1,
    )


def test_single_buy():
    res = compute_fifo([_txn("buy", "2024-01-01", 10, 100, fees=5)])
    assert res.quantity == Decimal("10")
    # cost basis includes fees: 10*100 + 5 = 1005
    assert res.cost_basis == Decimal("1005")
    assert res.avg_cost == Decimal("100.5")


def test_fifo_partial_sell_consumes_oldest_lot():
    txns = [
        _txn("buy", "2024-01-01", 10, 100),   # lot A @100
        _txn("buy", "2024-02-01", 10, 200),   # lot B @200
        _txn("sell", "2024-03-01", 5, 250),   # sells 5 from lot A
    ]
    res = compute_fifo(txns)
    assert res.quantity == Decimal("15")
    # realised = proceeds 5*250 - cost 5*100 = 1250 - 500 = 750
    assert res.realised_pl == Decimal("750")
    # remaining cost: 5@100 + 10@200 = 500 + 2000 = 2500
    assert res.cost_basis == Decimal("2500")


def test_fifo_sell_across_lots():
    txns = [
        _txn("buy", "2024-01-01", 10, 100),
        _txn("buy", "2024-02-01", 10, 200),
        _txn("sell", "2024-03-01", 15, 300),  # 10 from A, 5 from B
    ]
    res = compute_fifo(txns)
    assert res.quantity == Decimal("5")
    # realised = 15*300 - (10*100 + 5*200) = 4500 - 2000 = 2500
    assert res.realised_pl == Decimal("2500")
    assert res.cost_basis == Decimal("1000")  # 5 @ 200


def test_split_scales_lots():
    txns = [
        _txn("buy", "2024-01-01", 10, 100),
        _txn("split", "2024-02-01", 0, 2),  # 2:1 split
    ]
    res = compute_fifo(txns)
    assert res.quantity == Decimal("20")
    assert res.cost_basis == Decimal("1000")  # unchanged total
    assert res.avg_cost == Decimal("50")


def test_dividend_accrues_income_not_basis():
    txns = [
        _txn("buy", "2024-01-01", 10, 100),
        _txn("dividend", "2024-02-01", 0, 0, amount=25),
    ]
    res = compute_fifo(txns)
    assert res.income == Decimal("25")
    assert res.cost_basis == Decimal("1000")


def test_order_independence_sorts_by_time():
    # Same trades, scrambled input order → identical result.
    ordered = [_txn("buy", "2024-01-01", 10, 100), _txn("buy", "2024-02-01", 10, 200),
               _txn("sell", "2024-03-01", 15, 300)]
    scrambled = [ordered[2], ordered[0], ordered[1]]
    assert compute_fifo(ordered).cost_basis == compute_fifo(scrambled).cost_basis
    assert compute_fifo(ordered).realised_pl == compute_fifo(scrambled).realised_pl


def test_bonus_adds_shares_at_zero_cost():
    # buy 10 @100 (cost 1000), then 1:1 bonus (10 free shares)
    txns = [_txn("buy", "2024-01-01", 10, 100), _txn("bonus", "2024-02-01", 10, 0)]
    res = compute_fifo(txns)
    assert res.quantity == Decimal("20")
    assert res.cost_basis == Decimal("1000")   # total cost unchanged
    assert res.avg_cost == Decimal("50")         # halved by the bonus

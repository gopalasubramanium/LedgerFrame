# SPDX-License-Identifier: AGPL-3.0-or-later
"""Transaction & manual-holding CRUD, including taxes in cost basis."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

from app.models import Transaction, TxnType
from app.services.portfolio import compute_fifo


def _txn(ttype, date, qty, price, fees=0, taxes=0):
    return Transaction(
        type=TxnType(ttype), ts=datetime.fromisoformat(date).replace(tzinfo=UTC),
        quantity=Decimal(str(qty)), price=Decimal(str(price)),
        fees=Decimal(str(fees)), taxes=Decimal(str(taxes)),
        amount=Decimal("0"), currency="USD", account_id=1,
    )


def test_taxes_add_to_cost_basis():
    # buy 10 @100 with 5 fees + 5 taxes => basis 1010, avg 101
    res = compute_fifo([_txn("buy", "2024-01-01", 10, 100, fees=5, taxes=5)])
    assert res.cost_basis == Decimal("1010")
    assert res.avg_cost == Decimal("101")


def test_taxes_reduce_realised_proceeds():
    txns = [
        _txn("buy", "2024-01-01", 10, 100),
        _txn("sell", "2024-02-01", 10, 150, fees=2, taxes=3),
    ]
    res = compute_fifo(txns)
    # proceeds 1500 - 2 - 3 - cost 1000 = 495
    assert res.realised_pl == Decimal("495")


async def test_transaction_crud_via_api(app_client):
    add = await app_client.post("/api/v1/portfolio/transactions", json={
        "symbol": "NVDA", "type": "buy", "ts": "2024-05-01T09:30:00",
        "quantity": 5, "price": 100, "fees": 1, "taxes": 0.5, "currency": "USD",
    })
    assert add.status_code == 200
    tid = add.json()["transaction_id"]

    listed = await app_client.get("/api/v1/portfolio/transactions")
    assert any(t["id"] == tid and t["taxes"] == 0.5 for t in listed.json()["transactions"])

    upd = await app_client.put(f"/api/v1/portfolio/transactions/{tid}", json={
        "symbol": "NVDA", "type": "buy", "ts": "2024-05-01T09:30:00",
        "quantity": 8, "price": 110, "fees": 1, "taxes": 0.5, "currency": "USD",
    })
    assert upd.status_code == 200

    delete = await app_client.delete(f"/api/v1/portfolio/transactions/{tid}")
    assert delete.status_code == 200


async def test_edit_rescopes_transaction_across_accounts(app_client):
    # §14dr-11 — re-scoping a transaction moves it between account-scoped holdings views and
    # recomputes BOTH accounts' derived holdings. Fail-first RED against the old truthy guard
    # only for the null-clear/edge, but the cross-account move must hold end-to-end.
    add = await app_client.post("/api/v1/portfolio/transactions", json={
        "symbol": "ZQXT", "type": "buy", "ts": "2024-06-01T09:30:00",
        "quantity": 4, "price": 400, "currency": "USD", "account_id": 1,
    })
    assert add.status_code == 200
    tid = add.json()["transaction_id"]

    def held(resp, account):
        rows = resp.json()["holdings"]
        return [h for h in rows if h.get("symbol") == "ZQXT"]

    # Initially in account 1, not in account 2.
    a1 = await app_client.get("/api/v1/portfolio/holdings?account_id=1")
    a2 = await app_client.get("/api/v1/portfolio/holdings?account_id=2")
    assert held(a1, 1), "ZQXT should be in account 1 before the re-scope"
    assert not held(a2, 2), "ZQXT should NOT be in account 2 before the re-scope"

    # Re-scope to account 2.
    upd = await app_client.put(f"/api/v1/portfolio/transactions/{tid}", json={
        "symbol": "ZQXT", "type": "buy", "ts": "2024-06-01T09:30:00",
        "quantity": 4, "price": 400, "currency": "USD", "account_id": 2,
    })
    assert upd.status_code == 200

    # Now in account 2, gone from account 1 — both derived views recomputed.
    a1b = await app_client.get("/api/v1/portfolio/holdings?account_id=1")
    a2b = await app_client.get("/api/v1/portfolio/holdings?account_id=2")
    assert not held(a1b, 1), "ZQXT should have LEFT account 1 after the re-scope"
    assert held(a2b, 2), "ZQXT should have ARRIVED in account 2 after the re-scope"

    # Clear to NO account (account_id null). The old `if payload.account_id:` truthy guard could
    # NOT express this (RED). With the model_fields_set fix an explicit null re-scopes to none.
    clr = await app_client.put(f"/api/v1/portfolio/transactions/{tid}", json={
        "symbol": "ZQXT", "type": "buy", "ts": "2024-06-01T09:30:00",
        "quantity": 4, "price": 400, "currency": "USD", "account_id": None,
    })
    assert clr.status_code == 200
    a2c = await app_client.get("/api/v1/portfolio/holdings?account_id=2")
    assert not held(a2c, 2), "ZQXT should have LEFT account 2 after clearing its account"


async def test_foreign_symbol_holding_uses_native_currency(app_client):
    # A .BSE stock trades in INR even though the form defaulted to USD — the
    # engine must value/report it in INR (then convert to base for totals).
    add = await app_client.post("/api/v1/portfolio/transactions", json={
        "symbol": "HDFC.BSE", "type": "buy", "ts": "2024-05-01T09:30:00",
        "quantity": 10, "price": 1500, "currency": "USD",
    })
    assert add.status_code == 200

    holdings = (await app_client.get("/api/v1/portfolio/holdings")).json()["holdings"]
    hdfc = next(h for h in holdings if (h.get("symbol") or "").startswith("HDFC"))
    assert hdfc["currency"] == "INR"


async def test_manual_holding_crud_via_api(app_client):
    add = await app_client.post("/api/v1/portfolio/manual-holdings", json={
        "label": "Gold bar", "asset_class": "commodity", "value": 5000, "currency": "SGD",
    })
    assert add.status_code == 200
    hid = add.json()["id"]
    listed = await app_client.get("/api/v1/portfolio/manual-holdings")
    assert any(h["id"] == hid and h["value"] == 5000 for h in listed.json()["holdings"])
    upd = await app_client.put(f"/api/v1/portfolio/manual-holdings/{hid}", json={
        "label": "Gold bar", "asset_class": "commodity", "value": 5500, "currency": "SGD",
    })
    assert upd.status_code == 200
    assert (await app_client.delete(f"/api/v1/portfolio/manual-holdings/{hid}")).status_code == 200

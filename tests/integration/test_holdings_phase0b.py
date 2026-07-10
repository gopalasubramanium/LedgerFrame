# SPDX-License-Identifier: AGPL-3.0-or-later
"""Holdings page-build Phase 0b — the contract deltas: /refdata (D-005),
holdings.csv (D-050), the TransactionIn merger reshape (D-019), and the typed
holdings response (§9-6)."""

from __future__ import annotations

from sqlalchemy import select

from app.models import Instrument


async def test_refdata_serves_fixed_vocabularies(app_client):
    r = await app_client.get("/api/v1/refdata")
    assert r.status_code == 200
    data = r.json()
    # AssetClass (13) and TxnType (11, incl. merger) come from the code enums.
    assert len(data["asset_class"]) == 13
    assert "liability" in data["asset_class"]
    assert len(data["txn_type"]) == 11
    assert "merger" in data["txn_type"]
    # Authored DEF-2 asset_subclass (6).
    assert data["asset_subclass"] == ["crypto", "derivative", "equity", "etf", "mutual_fund", "reit"]
    # ValuationMethod (9) + EntitlementStatus (5).
    assert len(data["valuation_method"]) == 9
    assert data["entitlement"] == ["real-time", "delayed", "end-of-day", "cached", "unavailable"]
    # Domain vocabs sourced from their service constants.
    assert data["account_kind"][0] == "brokerage"
    assert "term_life" in data["policy_type"]
    assert data["premium_frequency"] == ["monthly", "quarterly", "annual", "single"]


async def test_holdings_response_is_typed(app_client):
    await app_client.post("/api/v1/portfolio/transactions", json={
        "symbol": "AAPL", "type": "buy", "ts": "2024-05-01T09:30:00",
        "quantity": 3, "price": 100, "currency": "USD",
    })
    r = await app_client.get("/api/v1/portfolio/holdings")
    assert r.status_code == 200
    body = r.json()
    assert body["base_currency"]
    h = next(x for x in body["holdings"] if (x.get("symbol") or "") == "AAPL")
    # Exactly the typed footprint — keys present, money as float|None.
    for key in ("id", "symbol", "asset_class", "quantity", "currency", "price",
                "market_value", "cost_basis", "unrealised_pl", "is_stale", "valuation_method"):
        assert key in h
    assert isinstance(h["is_stale"], bool)


async def test_holdings_csv_is_server_side(app_client):
    await app_client.post("/api/v1/portfolio/manual-holdings", json={
        "label": "Gold bar", "asset_class": "commodity", "value": 5000, "currency": "SGD",
    })
    r = await app_client.get("/api/v1/portfolio/holdings.csv")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    assert "attachment" in r.headers.get("content-disposition", "")
    text = r.text
    assert text.splitlines()[0].startswith("symbol,name,asset_class,currency,quantity,price")
    assert "Gold bar" in text


async def test_merger_related_instrument_id_roundtrips(app_client, session):
    # Two instruments: AAA (absorbed) and BBB (target).
    await app_client.post("/api/v1/portfolio/transactions", json={
        "symbol": "AAA", "type": "buy", "ts": "2024-01-01T09:30:00",
        "quantity": 10, "price": 50, "currency": "USD",
    })
    await app_client.post("/api/v1/portfolio/transactions", json={
        "symbol": "BBB", "type": "buy", "ts": "2024-01-02T09:30:00",
        "quantity": 5, "price": 80, "currency": "USD",
    })
    bbb = (await session.execute(select(Instrument).where(Instrument.symbol == "BBB"))).scalar_one()

    # Record the merger: AAA absorbed into BBB at ratio 1.0 (ratio in `price`).
    m = await app_client.post("/api/v1/portfolio/transactions", json={
        "symbol": "AAA", "type": "merger", "ts": "2024-03-01T09:30:00",
        "quantity": 0, "price": 1.0, "currency": "USD",
        "related_instrument_id": bbb.id,
    })
    assert m.status_code == 200

    txns = (await app_client.get("/api/v1/portfolio/transactions")).json()["transactions"]
    merger = next(t for t in txns if t["type"] == "merger")
    assert merger["related_instrument_id"] == bbb.id


async def test_txn_applicability_matrix(app_client):
    """D-090 — the Add-flow Type dropdown filter matrix, served from /refdata."""
    r = await app_client.get("/api/v1/refdata/txn-applicability")
    assert r.status_code == 200
    m = r.json()
    # Every AssetClass value has a row.
    ac = (await app_client.get("/api/v1/refdata")).json()["asset_class"]
    assert set(ac) <= set(m)
    # Ratified judgment calls.
    assert "bonus" in m["etf"]            # amendment: ETF bonus ON
    assert "bonus" not in m["crypto"]     # crypto corporate actions OFF
    assert "interest" in m["retirement"] and "interest" in m["liability"]
    assert "bonus" in m["mutual_fund"] and "split" in m["mutual_fund"]
    assert "interest" in m["fixed_deposit"] and "interest" in m["bond"] and "interest" in m["cash"]
    assert "dividend" in m["equity"] and "dividend" not in m["bond"]
    # Pure balances don't offer buy/sell.
    assert "buy" not in m["cash"] and "buy" not in m["fixed_deposit"]


async def test_meta_keys_gaps_persist(app_client):
    """D-091 — property `cost` and private `round` are now whitelisted."""
    await app_client.post("/api/v1/portfolio/manual-holdings", json={
        "label": "Flat", "asset_class": "property", "value": 900000, "currency": "SGD",
        "meta": {"address": "1 Main St", "cost": "750000"},
    })
    await app_client.post("/api/v1/portfolio/manual-holdings", json={
        "label": "Startup stake", "asset_class": "private", "value": 50000, "currency": "USD",
        "meta": {"company": "Acme", "round": "Series A"},
    })
    rows = (await app_client.get("/api/v1/portfolio/manual-holdings")).json()["holdings"]
    flat = next(h for h in rows if h["label"] == "Flat")
    stake = next(h for h in rows if h["label"] == "Startup stake")
    assert flat["meta"]["cost"] == "750000"
    assert stake["meta"]["round"] == "Series A"

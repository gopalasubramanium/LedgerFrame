# SPDX-License-Identifier: AGPL-3.0-or-later
"""Holdings page-build Phase 0b — the contract deltas: /refdata (D-005),
holdings.csv (D-050), the TransactionIn merger reshape (D-019), and the typed
holdings response (§9-6)."""

from __future__ import annotations

from sqlalchemy import select

from app.models import Instrument


def _vals(data, key):
    # item 3b — each vocab is now {value, label}; extract values for assertions.
    return [o["value"] for o in data[key]]


async def test_refdata_serves_fixed_vocabularies(app_client):
    r = await app_client.get("/api/v1/refdata")
    assert r.status_code == 200
    data = r.json()
    # AssetClass (13) and TxnType (11, incl. merger) come from the code enums.
    assert len(data["asset_class"]) == 13
    assert "liability" in _vals(data, "asset_class")
    assert len(data["txn_type"]) == 11
    assert "merger" in _vals(data, "txn_type")
    # Authored DEF-2 asset_subclass (6).
    assert _vals(data, "asset_subclass") == ["crypto", "derivative", "equity", "etf", "mutual_fund", "reit"]
    # ValuationMethod (9) + EntitlementStatus (5).
    assert len(data["valuation_method"]) == 9
    assert _vals(data, "entitlement") == ["real-time", "delayed", "end-of-day", "cached", "unavailable"]
    # Domain vocabs sourced from their service constants.
    assert _vals(data, "account_kind")[0] == "brokerage"
    assert "term_life" in _vals(data, "policy_type")
    assert _vals(data, "premium_frequency") == ["monthly", "quarterly", "annual", "single"]
    # item 3b — served DISPLAY LABELS (never hardcoded in the UI): acronyms/brands
    # overridden, snake_case titleized.
    labels = {o["value"]: o["label"] for o in data["asset_class"]}
    assert labels["equity"] == "Equity" and labels["etf"] == "ETF" and labels["mutual_fund"] == "Mutual fund"


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
    ac = _vals((await app_client.get("/api/v1/refdata")).json(), "asset_class")
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


async def test_holdings_symbol_filter_is_a_scoped_view(app_client):
    """ND-1 (Instrument Detail) — `?symbol=` scopes the SAME holdings reader to one
    instrument (P-3 filter, not a second code path). Unknown symbol → empty."""
    await app_client.post("/api/v1/portfolio/transactions", json={
        "symbol": "AAPL", "type": "buy", "ts": "2024-05-01T09:30:00",
        "quantity": 3, "price": 100, "currency": "USD",
    })
    scoped = (await app_client.get("/api/v1/portfolio/holdings?symbol=AAPL")).json()["holdings"]
    assert scoped and all((h.get("symbol") or "").upper() == "AAPL" for h in scoped)
    # Same reader, same numbers as the full list (P-3: a filter, never recomputed).
    full = (await app_client.get("/api/v1/portfolio/holdings")).json()["holdings"]
    aapl_full = next(h for h in full if (h.get("symbol") or "") == "AAPL")
    assert scoped[0]["market_value"] == aapl_full["market_value"]
    # Not held → empty, honestly (no fabricated row).
    assert (await app_client.get("/api/v1/portfolio/holdings?symbol=ZNOPE")).json()["holdings"] == []


async def test_refdata_serves_source_override_vocab(app_client):
    """ND-3 — per-instrument source-override routing options, sourced from the
    market-router CAPABILITIES (never drifts)."""
    data = (await app_client.get("/api/v1/refdata")).json()
    so = _vals(data, "source_override")
    assert so[0] == "auto"                       # clears the override
    assert "coingecko" in so and "amfi_nav" in so and "kite" in so
    # Served labels for the routing brands (item 3b).
    labels = {o["value"]: o["label"] for o in data["source_override"]}
    assert labels["coingecko"] == "CoinGecko" and labels["amfi_nav"] == "AMFI"


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

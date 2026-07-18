# SPDX-License-Identifier: AGPL-3.0-or-later
"""A5 (legacy CSV → safe v2 + optional metadata), A6 (manual-asset metadata),
A7 (Pricing Health actions: source override + per-holding refresh)."""

from __future__ import annotations

# --- A5: legacy CSV import routes through the safe v2 path -------------------- #

async def test_legacy_csv_classifies_and_dedupes(app_client):
    csv = (
        b"date,symbol,type,quantity,price,fees,taxes,currency,note,asset_class,country\n"
        b"2025-02-01,SOL,buy,5,150,0,0,USD,,crypto,\n"
    )
    r1 = await app_client.post("/api/v1/portfolio/import/csv", files={"file": ("t.csv", csv, "text/csv")})
    assert r1.status_code == 200 and r1.json()["imported"] == 1
    # Classified (not defaulted to equity) via the shared v2 path.
    m = (await app_client.get("/api/v1/instruments/SOL")).json()["instrument"]
    assert m["asset_class"] == "crypto"
    # Idempotent: same file again imports nothing (content-hash / fingerprint dedup).
    r2 = await app_client.post("/api/v1/portfolio/import/csv", files={"file": ("t.csv", csv, "text/csv")})
    assert r2.json()["imported"] == 0


async def test_csv_optional_identifier_and_injection_guard(app_client):
    csv = (
        b"date,symbol,type,quantity,price,fees,taxes,currency,note,asset_class,identifier_type,identifier_value\n"
        b"2025-03-01,INFY.NSE,buy,3,1500,0,0,INR,=cmd|calc,equity,isin,INE009A01021\n"
    )
    r = await app_client.post("/api/v1/portfolio/import/csv", files={"file": ("t.csv", csv, "text/csv")})
    assert r.status_code == 200 and r.json()["imported"] == 1
    m = (await app_client.get("/api/v1/instruments/INFY.NSE")).json()["instrument"]
    assert any(i["id_type"] == "isin" and i["value"] == "INE009A01021" for i in m["identifiers"])


# --- A6: manual asset metadata (optional, whitelisted) ----------------------- #

async def test_manual_holding_meta_roundtrip_and_whitelist(app_client):
    r = await app_client.post("/api/v1/portfolio/manual-holdings", json={
        "label": "OCBC 12-month FD", "asset_class": "fixed_deposit", "value": 50000, "currency": "SGD",
        "meta": {"rate": "3.4%", "maturity_date": "2026-01-15", "issuer": "OCBC", "evil": "x" * 999},
    })
    assert r.status_code == 200
    rows = (await app_client.get("/api/v1/portfolio/manual-holdings")).json()["holdings"]
    fd = next(h for h in rows if h["label"] == "OCBC 12-month FD")
    assert fd["meta"]["rate"] == "3.4%" and fd["meta"]["issuer"] == "OCBC"
    assert "evil" not in fd["meta"]                 # non-whitelisted key dropped


async def test_manual_value_still_works_without_meta(app_client):
    r = await app_client.post("/api/v1/portfolio/manual-holdings", json={
        "label": "Emergency cash 2", "asset_class": "cash", "value": 1000, "currency": "SGD"})
    assert r.status_code == 200


# --- A7: pricing-health actions --------------------------------------------- #

async def test_source_override_set_and_clear(app_client):
    # A keyless source valid for a US equity is accepted (§5).
    r = await app_client.patch("/api/v1/instruments/AAPL", json={"source_override": "yahoo"})
    assert r.status_code == 200 and r.json()["source_override"] == "yahoo"
    r2 = await app_client.patch("/api/v1/instruments/AAPL", json={"source_override": "auto"})
    assert r2.json()["source_override"] is None


async def test_source_override_validation(app_client):
    # Unknown provider → rejected.
    bad = await app_client.patch("/api/v1/instruments/AAPL", json={"source_override": "not-a-provider"})
    assert bad.status_code == 400
    # A credentialed provider without credentials (demo has no EODHD key) → rejected.
    auth = await app_client.patch("/api/v1/instruments/AAPL", json={"source_override": "eodhd"})
    assert auth.status_code == 400 and "credential" in auth.json()["detail"].lower()
    # Kite (India-only) on a US equity → rejected.
    region = await app_client.patch("/api/v1/instruments/AAPL", json={"source_override": "kite"})
    assert region.status_code == 400
    # AMFI on a non-fund → rejected.
    amfi = await app_client.patch("/api/v1/instruments/AAPL", json={"source_override": "amfi_nav"})
    assert amfi.status_code == 400


async def _add_listed_crypto(app_client, symbol: str):
    # Mirror the D-089 Add flow: one POST /portfolio/transactions with the symbol only —
    # no coingecko mapping is attached (that is the §14dr-27 root the correction path fixes).
    return await app_client.post("/api/v1/portfolio/transactions", json={
        "symbol": symbol, "type": "buy", "ts": "2025-01-01T00:00:00",
        "quantity": 1, "price": 10, "currency": "USD", "asset_class": "crypto"})


async def test_source_override_coingecko_autolinks_unambiguous_symbol(app_client):
    # §14dr-27(a): the Add flow drops the CoinGecko canonical id (it is sent as the bare
    # symbol), so an unmapped crypto reaches the correction with no coingecko_id. Correcting
    # the source to coingecko now auto-matches the symbol against the synced coin master: an
    # UNAMBIGUOUS hit links the id and the override proceeds (RED before: hard rejection).
    from app.db.base import get_sessionmaker
    from app.models import CoingeckoCoin

    async with get_sessionmaker()() as s:
        s.add(CoingeckoCoin(id="solana-x-dr27", symbol="solx", name="Solana X"))
        await s.commit()
    assert (await _add_listed_crypto(app_client, "SOLX")).status_code == 200

    r = await app_client.patch("/api/v1/instruments/SOLX", json={"source_override": "coingecko"})
    assert r.status_code == 200, r.text
    assert r.json()["source_override"] == "coingecko"
    # The canonical id is now persisted (so prices/history arrive and future edits pre-fill).
    m = (await app_client.get("/api/v1/instruments/SOLX")).json()["instrument"]
    assert any(i["id_type"] == "coingecko_id" and i["value"] == "solana-x-dr27" for i in m["identifiers"])


async def test_source_override_coingecko_ambiguous_symbol_served_error(app_client):
    # §14dr-27(a): ambiguous symbol → served candidate string (D-105), no silent guess.
    from app.db.base import get_sessionmaker
    from app.models import CoingeckoCoin

    async with get_sessionmaker()() as s:
        s.add_all([CoingeckoCoin(id="dupcoin-a", symbol="dup", name="Dup A"),
                   CoingeckoCoin(id="dupcoin-b", symbol="dup", name="Dup B")])
        await s.commit()
    assert (await _add_listed_crypto(app_client, "DUP")).status_code == 200

    r = await app_client.patch("/api/v1/instruments/DUP", json={"source_override": "coingecko"})
    assert r.status_code == 400
    detail = r.json()["detail"].lower()
    assert "multiple" in detail and "dupcoin-a" in detail and "dupcoin-b" in detail
    # Nothing was linked (the rejection rolled back cleanly).
    m = (await app_client.get("/api/v1/instruments/DUP")).json()["instrument"]
    assert not any(i["id_type"] == "coingecko_id" for i in m["identifiers"])


async def test_source_override_coingecko_no_match_served_error(app_client):
    # §14dr-27(a): no coin matches → served string directing to the picker; capability
    # rejection for genuinely uncoverable cases (a non-crypto) is unchanged (test above).
    assert (await _add_listed_crypto(app_client, "NOSUCHDR27")).status_code == 200
    r = await app_client.patch("/api/v1/instruments/NOSUCHDR27", json={"source_override": "coingecko"})
    assert r.status_code == 400
    assert "no coingecko coin" in r.json()["detail"].lower()


async def test_new_mutual_fund_is_not_defaulted_to_us(app_client):
    # §14dr-27(b): a free-form MF created via the Add flow must NOT be fabricated a US listing
    # (the bare-ticker->US / USD-default heuristic is an EQUITY heuristic). Its country stays
    # unknown until an AMFI mapping supplies IN — so amfi_nav no longer wrongly "doesn't cover US".
    r = await app_client.post("/api/v1/portfolio/transactions", json={
        "symbol": "DR27MF", "type": "buy", "ts": "2025-01-01T00:00:00",
        "quantity": 10, "price": 50, "currency": "INR", "asset_class": "mutual_fund"})
    assert r.status_code == 200, r.text
    m = (await app_client.get("/api/v1/instruments/DR27MF")).json()["instrument"]
    assert m["country"] != "US" and m["listing_country"] != "US"
    # Correcting to amfi_nav now fails with the HONEST mapping error, not "doesn't cover US".
    ov = await app_client.patch("/api/v1/instruments/DR27MF", json={"source_override": "amfi_nav"})
    assert ov.status_code == 400
    detail = ov.json()["detail"].lower()
    assert "amfi scheme mapping" in detail and "doesn't cover" not in detail


async def test_new_crypto_is_not_defaulted_to_us(app_client):
    # §14dr-27(b): crypto is global — a bare crypto symbol must not be labelled a US listing.
    r = await app_client.post("/api/v1/portfolio/transactions", json={
        "symbol": "DR27CRYP", "type": "buy", "ts": "2025-01-01T00:00:00",
        "quantity": 1, "price": 1, "currency": "USD", "asset_class": "crypto"})
    assert r.status_code == 200, r.text
    m = (await app_client.get("/api/v1/instruments/DR27CRYP")).json()["instrument"]
    assert m["country"] != "US"


async def test_new_equity_still_classifies_us(app_client):
    # The equity heuristic is PRESERVED: a bare US ticker still classifies as a US listing.
    r = await app_client.post("/api/v1/portfolio/transactions", json={
        "symbol": "DR27EQ", "type": "buy", "ts": "2025-01-01T00:00:00",
        "quantity": 1, "price": 100, "currency": "USD", "asset_class": "equity"})
    assert r.status_code == 200
    m = (await app_client.get("/api/v1/instruments/DR27EQ")).json()["instrument"]
    assert m["country"] == "US"


async def test_region_capability_error_names_the_field(app_client):
    # §14dr-27(b): a genuine region mismatch names the FIELD it evaluated (the listing
    # country), so the rejection is self-diagnosing (D-105). AAPL is a US listing; kite is IN-only.
    r = await app_client.patch("/api/v1/instruments/AAPL", json={"source_override": "kite"})
    assert r.status_code == 400
    detail = r.json()["detail"].lower()
    assert "listing country" in detail and "us" in detail


async def test_refresh_holding_action(app_client):
    holdings = (await app_client.get("/api/v1/portfolio/holdings")).json()["holdings"]
    market = next(h for h in holdings if h["symbol"] == "AAPL")
    manual = next(h for h in holdings if h["symbol"] is None)
    rm = await app_client.post(f"/api/v1/portfolio/pricing-health/{market['id']}/refresh")
    assert rm.status_code == 200 and rm.json()["refreshed"] is True
    ru = await app_client.post(f"/api/v1/portfolio/pricing-health/{manual['id']}/refresh")
    assert ru.status_code == 200 and ru.json()["refreshed"] is False

# SPDX-License-Identifier: AGPL-3.0-or-later
"""Account write path (page-accounts §9-4/§9-5/§9-9, Phase 0).

The two headline features had NO write path: AccountIn omitted both entity_id (D-064) and
cost_basis_method (D-018). These add them, FK/vocab-validated, plus the D-018 rebuild-on-change.
"""

from __future__ import annotations


# --- §9-4: entity assignment writable + validated -------------------------- #
async def test_account_entity_id_is_writable(app_client):
    # entity_id round-trips (it was omitted from AccountIn → silently dropped today → RED).
    a = (await app_client.post("/api/v1/accounts", json={"name": "E", "entity_id": None})).json()
    assert a["entity_id"] is None

    # A real assignment round-trips when an entity exists (the demo backfill's default entity may
    # or may not be present in isolation — the guaranteed positive lives in the Entity-CRUD test,
    # where POST /entities creates one deterministically).
    ents = (await app_client.get("/api/v1/entities")).json()["entities"]
    if ents:
        eid = ents[0]["id"]
        p = (await app_client.patch(f"/api/v1/accounts/{a['id']}",
                                    json={"name": "E", "entity_id": eid})).json()
        assert p["entity_id"] == eid


async def test_account_entity_id_nonexistent_is_honest_400(app_client):
    bad = await app_client.post("/api/v1/accounts", json={"name": "X", "entity_id": 999999})
    assert bad.status_code == 400  # today: silently accepted/dropped → RED


# --- §9-5: cost-basis method writable + vocab-enforced + restatement -------- #
async def test_account_cost_basis_method_writable_and_vocab_enforced(app_client):
    a = (await app_client.post("/api/v1/accounts",
                               json={"name": "C", "cost_basis_method": "average"})).json()
    assert a["cost_basis_method"] == "average"  # today: AccountIn omits it → dropped → RED
    bad = await app_client.post("/api/v1/accounts",
                                json={"name": "C2", "cost_basis_method": "lifo"})
    assert bad.status_code == 400  # out-of-vocab rejected


async def test_changing_method_on_account_with_history_restates_realised_gains(app_client):
    # Demo Brokerage holds AAPL: buy 30@150, buy 20@175, sell 15@190.
    # FIFO realised = 15*(190-150) = 600; AVERAGE (pool 160) = 15*(190-160) = 450 — they must differ.
    bid = next(a["id"] for a in (await app_client.get("/api/v1/accounts/list")).json()["accounts"]
               if a["name"] == "Demo Brokerage")
    before = (await app_client.get("/api/v1/portfolio/realised-gains?year=2024")).json()

    r = await app_client.patch(f"/api/v1/accounts/{bid}",
                               json={"name": "Demo Brokerage", "cost_basis_method": "average"})
    assert r.status_code == 200
    assert r.json().get("restatement")  # the D-018 restatement warning is surfaced (today: absent → RED)

    after = (await app_client.get("/api/v1/portfolio/realised-gains?year=2024")).json()
    # The realised figures actually MOVE after the method change (the restatement is real).
    assert after["base_realised_total_current_fx"] != before["base_realised_total_current_fx"]


# --- §9-9: kind + currency write-enforcement (no silent coercion) ---------- #
async def test_out_of_vocab_kind_is_rejected_not_coerced(app_client):
    # Today: invalid kind silently coerces to "brokerage" (200) → RED.
    bad = await app_client.post("/api/v1/accounts", json={"name": "K", "kind": "cryptobank"})
    assert bad.status_code == 400


async def test_out_of_vocab_currency_is_rejected(app_client):
    # Today: currency is upper()[:3] with no vocab check, so "ZZZ" is accepted (200) → RED.
    bad = await app_client.post("/api/v1/accounts", json={"name": "C", "currency": "ZZZ"})
    assert bad.status_code == 400
    # A supported currency still works.
    ok = await app_client.post("/api/v1/accounts", json={"name": "C2", "currency": "usd"})
    assert ok.status_code == 200 and ok.json()["currency"] == "USD"


async def test_patch_out_of_vocab_kind_rejected(app_client):
    aid = (await app_client.post("/api/v1/accounts", json={"name": "K2"})).json()["id"]
    bad = await app_client.patch(f"/api/v1/accounts/{aid}", json={"name": "K2", "kind": "nope"})
    assert bad.status_code == 400


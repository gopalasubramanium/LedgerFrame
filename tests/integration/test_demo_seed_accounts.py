# SPDX-License-Identifier: AGPL-3.0-or-later
"""Demo seed wiring for the /accounts page (page-accounts §10-5, Phase 1).

The seed now creates entities (Household + a trust + a person), wires the institution master
(D-008) to every demo account, and seeds a near-duplicate pair for the user-driven merge demo
(§9-2). This is the estate-seed precedent: a fresh demo instance must render the page populated.
"""

from __future__ import annotations


async def test_demo_seed_creates_entities_and_wires_accounts(app_client):
    ents = {e["name"]: e for e in (await app_client.get("/api/v1/entities")).json()["entities"]}
    assert {"Household", "Rajan Family Trust", "Meera Iyer"} <= set(ents)
    assert ents["Rajan Family Trust"]["kind"] == "trust"
    assert ents["Meera Iyer"]["kind"] == "spouse"

    # Every demo account carries an institution (the master), served via the join — none is bare.
    rep = {a["name"]: a for a in (await app_client.get("/api/v1/accounts")).json()["accounts"]}
    assert rep["Demo Brokerage"]["institution"] == "Saxo Markets"
    assert rep["Demo SG CDP"]["institution"] == "Citibank Singapore"
    assert rep["Demo Cash"]["institution"] == "Citibank"
    # The cash account's kind is a VALID vocab value now (was "cash", out of ACCOUNT_KINDS) — so the
    # /accounts editor's write path would not 400 on it.
    assert rep["Demo Cash"]["kind"] == "bank"

    # entity_id is writable + served on the list endpoint; accounts span the entities.
    lst = {a["name"]: a for a in (await app_client.get("/api/v1/accounts/list")).json()["accounts"]}
    assert lst["Demo Brokerage"]["entity_id"] == ents["Rajan Family Trust"]["id"]
    assert lst["Demo SG CDP"]["entity_id"] == ents["Household"]["id"]
    assert lst["Demo Cash"]["entity_id"] == ents["Household"]["id"]

    # The near-duplicate merge pair both exist, each with a real account reference (a REAL merge
    # re-points at least one account) — §9-2 pre-pass demo.
    insts = {i["name"]: i for i in (await app_client.get("/api/v1/institutions")).json()["institutions"]}
    assert insts["Citibank"]["account_count"] == 1
    assert insts["Citibank Singapore"]["account_count"] == 1

    # Meera Iyer holds no accounts → the deletable-entity demo (delete is NOT FK-blocked).
    meera_id = ents["Meera Iyer"]["id"]
    assert all(a["entity_id"] != meera_id for a in lst.values())


async def test_dev_boot_path_yields_exactly_three_entities_no_duplicate_household(app_client):
    """§12pk-4: the app_client fixture runs the REAL dev.sh boot path — Alembic migrations (the
    entities migration f4a9c2b71e08 inserts a default 'Household') THEN the demo seed. Before the
    seed fix this yielded FOUR entities (two 'Household') and the Reports Pack rendered TWO per-entity
    'Household' sections; the create_all + seed path (reset-demo-data.sh, no migrations) yielded the
    correct three. The seed now get-or-creates 'Household' (the institution/estate resolve-or-create
    precedent), so BOTH boot paths yield exactly the canonical three."""
    names = sorted(e["name"] for e in (await app_client.get("/api/v1/entities")).json()["entities"])
    assert names == ["Household", "Meera Iyer", "Rajan Family Trust"], names
    assert names.count("Household") == 1, "the migration-default Household must be reused, not duplicated"

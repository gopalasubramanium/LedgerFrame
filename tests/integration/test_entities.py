# SPDX-License-Identifier: AGPL-3.0-or-later
"""Entity CRUD (D-065; page-accounts §9-6 + Amendment H, §9-7).

Only GET /entities existed. These add POST/PATCH/DELETE with kind vocab-enforced (entity_kind,
graduated to the policy_status single-source pattern) and DELETE blocked while any account
references the entity (service-level 400, no cascade). §9-7: NO "Household" special-casing —
the lowest-id entity is renamable/re-kindable/deletable under the same FK guard.
"""

from __future__ import annotations


async def test_entity_create_rename_rekind(app_client):
    c = await app_client.post("/api/v1/entities", json={"name": "Trust A", "kind": "trust"})
    assert c.status_code == 200, c.text
    eid = c.json()["id"]
    assert c.json()["name"] == "Trust A" and c.json()["kind"] == "trust"

    p = await app_client.patch(f"/api/v1/entities/{eid}", json={"name": "Family Trust", "kind": "company"})
    assert p.status_code == 200 and p.json()["name"] == "Family Trust" and p.json()["kind"] == "company"

    names = {e["name"] for e in (await app_client.get("/api/v1/entities")).json()["entities"]}
    assert "Family Trust" in names


async def test_entity_kind_vocab_enforced(app_client):
    bad = await app_client.post("/api/v1/entities", json={"name": "X", "kind": "alien"})
    assert bad.status_code == 400


async def test_entity_assignment_round_trips_end_to_end(app_client):
    # The guaranteed §9-4 positive: create an entity, assign an account to it, read it back.
    eid = (await app_client.post("/api/v1/entities", json={"name": "E1", "kind": "self"})).json()["id"]
    a = (await app_client.post("/api/v1/accounts", json={"name": "Acc", "entity_id": eid})).json()
    assert a["entity_id"] == eid


async def test_entity_delete_blocked_while_an_account_references_it(app_client):
    eid = (await app_client.post("/api/v1/entities", json={"name": "E2", "kind": "self"})).json()["id"]
    await app_client.post("/api/v1/accounts", json={"name": "Acc", "entity_id": eid})
    blocked = await app_client.delete(f"/api/v1/entities/{eid}")
    assert blocked.status_code == 400  # honest served 400 (account-delete-guard precedent)

    # Unreferenced entity deletes cleanly.
    e3 = (await app_client.post("/api/v1/entities", json={"name": "E3", "kind": "self"})).json()["id"]
    assert (await app_client.delete(f"/api/v1/entities/{e3}")).status_code == 200


async def test_household_is_not_special(app_client):
    # §9-7 / D-029: the lowest-id entity is renamable + re-kindable like any other (no is_default).
    ents = (await app_client.get("/api/v1/entities")).json()["entities"]
    if not ents:  # ensure at least one entity to exercise the "no special-casing" rule
        ents = [(await app_client.post("/api/v1/entities", json={"name": "Household", "kind": "self"})).json()]
    lowest = min(ents, key=lambda e: e["id"])
    r = await app_client.patch(f"/api/v1/entities/{lowest['id']}", json={"name": "Renamed", "kind": "trust"})
    assert r.status_code == 200 and r.json()["name"] == "Renamed"

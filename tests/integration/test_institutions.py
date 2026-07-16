# SPDX-License-Identifier: AGPL-3.0-or-later
"""Institution master (D-008; MASTER-DATA §6/§7) — the first user-extensible master-with-CRUD.

page-accounts §9-1 / Amendment F: the master is unique by NORMALIZED name (trimmed,
internal-whitespace-collapsed, case-insensitive), and the stored display name keeps the
FIRST-SEEN casing. Fuzzy variants ("DBS" vs "DBS Bank") are user-driven merge only (§9-2),
never auto-collapsed here.
"""

from __future__ import annotations


async def test_institution_master_starts_empty(app_client):
    # D-008: the master starts empty; no accounts/policies are seeded into it yet (commit 3).
    r = await app_client.get("/api/v1/institutions")
    assert r.status_code == 200
    assert r.json()["institutions"] == []


async def test_institution_crud_and_first_seen_casing_collapse(app_client):
    # Create — trimmed + first-seen casing.
    c = await app_client.post("/api/v1/institutions", json={"name": "DBS "})
    assert c.status_code == 200, c.text
    iid = c.json()["id"]
    assert c.json()["name"] == "DBS"

    # Amendment F: a case/whitespace variant resolves to the SAME row; first-seen casing survives.
    c2 = await app_client.post("/api/v1/institutions", json={"name": "dbs"})
    assert c2.status_code == 200
    assert c2.json()["id"] == iid and c2.json()["name"] == "DBS"

    # ...and it is still one row.
    lst = (await app_client.get("/api/v1/institutions")).json()["institutions"]
    assert [i["name"] for i in lst] == ["DBS"]

    # Rename to a genuinely different (fuzzy) name — user-driven, allowed.
    p = await app_client.patch(f"/api/v1/institutions/{iid}", json={"name": "DBS Bank"})
    assert p.status_code == 200 and p.json()["name"] == "DBS Bank"

    # Delete — no FK references exist yet (commit 1); the FK-block is proven after commit 3.
    d = await app_client.delete(f"/api/v1/institutions/{iid}")
    assert d.status_code == 200
    assert (await app_client.get("/api/v1/institutions")).json()["institutions"] == []


async def test_institution_rename_blocks_name_clash(app_client):
    a = (await app_client.post("/api/v1/institutions", json={"name": "OCBC"})).json()["id"]
    (await app_client.post("/api/v1/institutions", json={"name": "UOB"}))
    # Renaming OCBC onto UOB's normalized key is refused (merge instead).
    r = await app_client.patch(f"/api/v1/institutions/{a}", json={"name": "uob"})
    assert r.status_code == 400
    assert "merge" in r.json()["detail"].lower()


async def test_institution_missing_id_is_404(app_client):
    assert (await app_client.patch("/api/v1/institutions/999999", json={"name": "X"})).status_code == 404
    assert (await app_client.delete("/api/v1/institutions/999999")).status_code == 404

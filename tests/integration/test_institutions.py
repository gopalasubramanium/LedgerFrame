# SPDX-License-Identifier: AGPL-3.0-or-later
"""Institution master (D-008; MASTER-DATA §6/§7) — the first user-extensible master-with-CRUD.

page-accounts §9-1 / Amendment F: the master is unique by NORMALIZED name (trimmed,
internal-whitespace-collapsed, case-insensitive), and the stored display name keeps the
FIRST-SEEN casing. Fuzzy variants ("DBS" vs "DBS Bank") are user-driven merge only (§9-2),
never auto-collapsed here.
"""

from __future__ import annotations


async def test_institution_master_lists_seeded_insurers(app_client):
    # Post-commit-3 the master is FK'd from insurance too, so the demo insurers seed it
    # (Amendment F fold). A brand-new name is absent until created.
    r = await app_client.get("/api/v1/institutions")
    assert r.status_code == 200
    names = {i["name"] for i in r.json()["institutions"]}
    assert "AIA Singapore" in names
    assert "Nonexistent Bank XYZ" not in names


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

    # ...and it is exactly one row for DBS (the master may already hold demo-seeded insurers).
    lst = (await app_client.get("/api/v1/institutions")).json()["institutions"]
    assert [i["name"] for i in lst].count("DBS") == 1

    # Rename to a genuinely different (fuzzy) name — user-driven, allowed.
    p = await app_client.patch(f"/api/v1/institutions/{iid}", json={"name": "DBS Bank"})
    assert p.status_code == 200 and p.json()["name"] == "DBS Bank"

    # Delete — this row has no FK references (no account/policy points at it), so it deletes.
    d = await app_client.delete(f"/api/v1/institutions/{iid}")
    assert d.status_code == 200
    remaining = {i["name"] for i in (await app_client.get("/api/v1/institutions")).json()["institutions"]}
    assert "DBS Bank" not in remaining


async def test_institution_list_serves_referenced_by_counts(app_client):
    # §12-1 / §12ac-5: GET /institutions serves per-institution account_count + policy_count so the
    # master card renders them and the merge consequence reads the SERVED counts (not client-derived).
    # RED before the reshape: the served rows carried only {id, name}.
    await app_client.post("/api/v1/accounts", json={"name": "A1", "institution": "CountBank"})
    await app_client.post("/api/v1/accounts", json={"name": "A2", "institution": "CountBank"})
    row = next(i for i in (await app_client.get("/api/v1/institutions")).json()["institutions"]
               if i["name"] == "CountBank")
    assert row["account_count"] == 2
    assert row["policy_count"] == 0
    # AIA Singapore is seeded from a demo policy (Amendment F fold) → at least one policy reference.
    aia = next(i for i in (await app_client.get("/api/v1/institutions")).json()["institutions"]
               if i["name"] == "AIA Singapore")
    assert aia["policy_count"] >= 1


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


# --- merge (§9-2, user-driven) -------------------------------------------- #
async def test_institution_merge_folds_duplicate_into_survivor(app_client):
    # User-driven: the caller names the survivor + the duplicate explicitly (no fuzzy detect).
    s = (await app_client.post("/api/v1/institutions", json={"name": "DBS"})).json()["id"]
    d = (await app_client.post("/api/v1/institutions", json={"name": "DBS Bank"})).json()["id"]

    m = await app_client.post("/api/v1/institutions/merge",
                              json={"survivor_id": s, "duplicate_id": d})
    assert m.status_code == 200, m.text
    assert m.json()["survivor_name"] == "DBS"

    # The duplicate row is gone; the survivor remains — one transaction.
    names = [i["name"] for i in (await app_client.get("/api/v1/institutions")).json()["institutions"]]
    assert "DBS" in names and "DBS Bank" not in names
    # (Re-pointing of referencing accounts/policies is proven in commit 3, once the
    #  institution_id FK columns exist — see test_institution_migration.py.)


async def test_institution_merge_rejects_same_and_missing(app_client):
    s = (await app_client.post("/api/v1/institutions", json={"name": "OCBC"})).json()["id"]
    same = await app_client.post("/api/v1/institutions/merge",
                                 json={"survivor_id": s, "duplicate_id": s})
    assert same.status_code == 400
    missing = await app_client.post("/api/v1/institutions/merge",
                                    json={"survivor_id": s, "duplicate_id": 999999})
    assert missing.status_code == 404

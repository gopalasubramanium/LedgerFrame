# SPDX-License-Identifier: AGPL-3.0-or-later
"""Account write path (page-accounts §9-4/§9-5/§9-9, Phase 0).

The two headline features had NO write path: AccountIn omitted both entity_id (D-064) and
cost_basis_method (D-018). These add them, FK/vocab-validated, plus the D-018 rebuild-on-change.
"""

from __future__ import annotations


async def _an_entity_id(app_client) -> int:
    return (await app_client.get("/api/v1/entities")).json()["entities"][0]["id"]


# --- §9-4: entity assignment writable + validated -------------------------- #
async def test_account_entity_id_is_writable(app_client):
    eid = await _an_entity_id(app_client)
    a = (await app_client.post("/api/v1/accounts", json={"name": "E", "entity_id": eid})).json()
    assert a["entity_id"] == eid  # today: silently dropped (AccountIn omits entity_id) → RED

    p = (await app_client.patch(f"/api/v1/accounts/{a['id']}",
                                json={"name": "E", "entity_id": None})).json()
    assert p["entity_id"] is None  # PATCH can clear it


async def test_account_entity_id_nonexistent_is_honest_400(app_client):
    bad = await app_client.post("/api/v1/accounts", json={"name": "X", "entity_id": 999999})
    assert bad.status_code == 400  # today: silently accepted/dropped → RED

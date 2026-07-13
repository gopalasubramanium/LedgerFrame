# SPDX-License-Identifier: AGPL-3.0-or-later
"""Estate & document readiness (W4) — profile, contacts, documents, review signals."""

from __future__ import annotations


async def test_estate_readiness_and_review_signals(app_client):
    # Default: no will → a neutral "No will recorded" review item.
    rev = (await app_client.get("/api/v1/portfolio/review")).json()
    assert any(i["area"] == "Estate" and "No will" in i["title"] for i in rev["items"])

    c = (await app_client.post("/api/v1/estate/contacts",
                               json={"name": "Spouse", "relationship": "spouse",
                                     "roles": ["nominee", "executor", "emergency", "bogus"]})).json()
    assert c["ok"]
    assert c["roles"] == ["nominee", "executor", "emergency"]  # invalid role dropped

    await app_client.post("/api/v1/estate/documents",
                          json={"title": "Property deed", "category": "property", "status": "missing"})
    await app_client.put("/api/v1/estate/profile",
                         json={"will_status": "executed", "will_location": "Home safe"})

    rep = (await app_client.get("/api/v1/estate")).json()
    rd = rep["readiness"]
    assert rd["will_status"] == "executed"
    assert rd["nominees"] == 1 and rd["executors"] == 1 and rd["emergency"] == 1
    assert rd["docs_total"] == 1 and rd["docs_attention"] == 1

    # Review now flags the missing document and no longer "No will".
    rev = (await app_client.get("/api/v1/portfolio/review")).json()
    ests = [i["title"] for i in rev["items"] if i["area"] == "Estate"]
    assert any("missing" in t for t in ests)
    assert not any("No will" in t for t in ests)

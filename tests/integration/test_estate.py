# SPDX-License-Identifier: AGPL-3.0-or-later
"""Estate & document readiness (W4) — profile, contacts, documents, review signals."""

from __future__ import annotations


async def test_estate_readiness_and_review_signals(app_client):
    # The demo seed now ships an estate register (page-estate Phase 3a); clear it so this test's
    # counts are exact (the insurance-seed precedent, test_insurance.py).
    rep0 = (await app_client.get("/api/v1/estate")).json()
    for c in rep0["contacts"]:
        await app_client.delete(f"/api/v1/estate/contacts/{c['id']}")
    for d in rep0["documents"]:
        await app_client.delete(f"/api/v1/estate/documents/{d['id']}")
    await app_client.put("/api/v1/estate/profile", json={
        "will_status": "none", "will_location": None, "executor": None,
        "last_reviewed": None, "next_review_date": None, "notes": None})

    # Default (cleared): no will → a neutral "No will recorded" review item.
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


async def test_demo_seed_ships_a_realistic_estate_register(app_client):
    """The demo seed populates the estate register (page-estate Phase 3a) in the SPECIMEN's shape so
    /estate renders POPULATED live: an executed will, a multi-role contact, contacts with blank
    phone/email (em dashes), and one MISSING + one OUTDATED document. Unit-verifies the seed like the
    insurance-seed precedent, and pins the _REVIEW_SOON_DAYS=30 signal fires on the seeded next-review."""
    rep = (await app_client.get("/api/v1/estate")).json()

    # Profile — will executed (the profile-card chip leads, §12es-1); the review is due SOON.
    assert rep["profile"]["will_status"] == "executed"
    assert rep["profile"]["executor"]

    # Contacts — ~7, including exactly one MULTI-ROLE contact, and blanks that render as em dashes.
    contacts = rep["contacts"]
    assert len(contacts) == 7
    assert sum(1 for c in contacts if len(c["roles"]) >= 3) == 1        # one multi-role contact
    assert any(c["phone"] is None for c in contacts)                    # a blank phone → em dash
    assert any(c["email"] is None for c in contacts)                    # a blank email → em dash
    assert all("relationship" not in c for c in contacts)              # the retired field never returns (§9-5)

    # Documents — ~10 with exactly one MISSING + one OUTDATED (attention), the rest present.
    docs = rep["documents"]
    assert len(docs) == 10
    assert sum(1 for d in docs if d["status"] == "missing") == 1
    assert sum(1 for d in docs if d["status"] == "outdated") == 1

    # Readiness counts (§9-3: counts, never money) reflect the seed.
    rd = rep["readiness"]
    assert rd["docs_total"] == 10 and rd["docs_present"] == 8 and rd["docs_attention"] == 2
    assert rd["executors"] == 2 and rd["emergency"] == 2

    # The seeded next_review is within _REVIEW_SOON_DAYS (30) → the review-soon signal fires (§9-8).
    rev = (await app_client.get("/api/v1/portfolio/review")).json()
    ests = [i["title"] for i in rev["items"] if i["area"] == "Estate"]
    assert any("Estate review due in" in t for t in ests), ests

# SPDX-License-Identifier: AGPL-3.0-or-later
"""Insurance (W3) — CRUD, totals, and the renewal reminder in the review feed."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta


async def test_insurance_crud_totals_and_renewal_reminder(app_client):
    # Use the base currency so totals are identity (no FX) and the assertion is exact.
    base = (await app_client.get("/api/v1/insurance")).json()["base_currency"]
    # The demo seed now ships a register (page-insurance §12in-1); clear it so this CRUD test is exact.
    for p in (await app_client.get("/api/v1/insurance")).json()["policies"]:
        await app_client.delete(f"/api/v1/insurance/{p['id']}")
    renewal = (datetime.now(UTC).date() + timedelta(days=20)).isoformat()
    r = (await app_client.post("/api/v1/insurance", json={
        "name": "Term Life", "insurer": "DBS", "policy_type": "term_life",
        "cover_amount": 500000, "currency": base, "premium": 1200,
        "premium_frequency": "annual", "renewal_date": renewal,
        "nominee": "Spouse", "insured_person": "Self"})).json()
    assert r["ok"]
    pid = r["id"]

    rep = (await app_client.get("/api/v1/insurance")).json()
    assert rep["count"] == 1
    assert rep["total_cover"] == 500000
    assert rep["total_annual_premium"] == 1200
    assert rep["upcoming_renewals"] and rep["upcoming_renewals"][0]["name"] == "Term Life"

    # Renewal surfaces in the review feed as a neutral reminder.
    rev = (await app_client.get("/api/v1/portfolio/review")).json()
    assert any(i["area"] == "Insurance" for i in rev["items"])

    # Edit → cover updates; a required field (currency) can't be nulled.
    await app_client.patch(f"/api/v1/insurance/{pid}", json={
        "name": "Term Life", "policy_type": "term_life", "cover_amount": 600000,
        "currency": base, "premium_frequency": "annual"})
    rep = (await app_client.get("/api/v1/insurance")).json()
    assert rep["total_cover"] == 600000

    # Delete.
    await app_client.delete(f"/api/v1/insurance/{pid}")
    assert (await app_client.get("/api/v1/insurance")).json()["count"] == 0

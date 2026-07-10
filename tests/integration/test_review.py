# SPDX-License-Identifier: AGPL-3.0-or-later
"""Phase 4b — derived review feed ('what needs a look'; reporting only)."""

from __future__ import annotations

from datetime import date, timedelta


async def test_review_shape_and_disclaimer(app_client):
    d = (await app_client.get("/api/v1/portfolio/review")).json()
    assert "items" in d and len(d["items"]) >= 1 and "not advice" in d["disclaimer"].lower()
    for i in d["items"]:
        assert {"area", "title", "severity"} <= set(i)


async def test_review_surfaces_policy_drift_and_concentration(app_client):
    await app_client.put("/api/v1/policy/targets", json={"targets": [
        {"dimension": "asset_class", "bucket": "equity", "target_pct": 40}]})   # demo equity ≪ 40 → under band
    await app_client.put("/api/v1/policy", json={"max_position_pct": 25})        # property ≫ 25 → concentration
    d = (await app_client.get("/api/v1/portfolio/review")).json()
    policy_items = [i for i in d["items"] if i["area"] == "policy"]
    assert len(policy_items) >= 2 and d["count"] >= 2


async def test_review_surfaces_goals_and_obligations(app_client):
    soon = (date.today() + timedelta(days=20)).isoformat()
    await app_client.post("/api/v1/goals", json={"name": "Trip", "target_amount": 5000, "target_date": soon, "basis": "none"})
    await app_client.post("/api/v1/obligations", json={"name": "Tax bill", "amount": 4000, "due_date": soon, "recurrence": "once", "kind": "expense"})
    areas = {i["area"] for i in (await app_client.get("/api/v1/portfolio/review")).json()["items"]}
    assert "goals" in areas and "obligations" in areas


async def _incomplete_count(app_client) -> int:
    items = (await app_client.get("/api/v1/portfolio/review")).json()["items"]
    for i in items:
        if "incomplete details" in i["title"]:
            assert i["severity"] == "info"   # low-priority, never a hard wall
            return int(i["title"].split(" ", 1)[0])
    return 0


async def test_review_flags_incomplete_manual_details(app_client):
    """D-091 — a manual holding recorded as a bare value (no optional detail)
    increments the low-priority (info) 'incomplete details' count; one recorded
    WITH detail does not."""
    before = await _incomplete_count(app_client)
    await app_client.post("/api/v1/portfolio/manual-holdings", json={
        "label": "Bare FD", "asset_class": "fixed_deposit", "value": 10000, "currency": "SGD",
    })
    await app_client.post("/api/v1/portfolio/manual-holdings", json={
        "label": "Detailed FD", "asset_class": "fixed_deposit", "value": 20000, "currency": "SGD",
        "meta": {"rate": "3.5", "maturity_date": "2027-01-01"},
    })
    after = await _incomplete_count(app_client)
    assert after == before + 1   # only the bare one adds to the count

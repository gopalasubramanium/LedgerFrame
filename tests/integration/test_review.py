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
    policy_items = [i for i in d["items"] if i["area"] == "Policy"]   # §12rv1-5: display-cased
    assert len(policy_items) >= 2 and d["count"] >= 2


async def test_review_surfaces_goals_and_obligations(app_client):
    soon = (date.today() + timedelta(days=20)).isoformat()
    await app_client.post("/api/v1/goals", json={"name": "Trip", "target_amount": 5000, "target_date": soon, "basis": "none"})
    await app_client.post("/api/v1/obligations", json={"name": "Tax bill", "amount": 4000, "due_date": soon, "recurrence": "once", "kind": "expense"})
    areas = {i["area"] for i in (await app_client.get("/api/v1/portfolio/review")).json()["items"]}
    assert "Goals" in areas and "Income & expenses" in areas   # §12rv1-5 display-cased; §12rv2-1 vocabulary


async def _incomplete_count(app_client) -> int:
    items = (await app_client.get("/api/v1/portfolio/review")).json()["items"]
    for i in items:
        if "incomplete details" in i["title"]:
            assert i["severity"] == "Info"   # low-priority, never a hard wall (§12rv1-5: display-cased)
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


async def test_review_serves_display_cased_labels(app_client):
    """§12rv1-5 (D-105) — the reader serves DISPLAY-CASED area/severity labels, never lowercase enum
    keys (copy-hygiene defect). Fail-first: RED on the pre-fix reader (which served 'review'/'info',
    'data'/'policy'…). The frontend renders these verbatim (D-005). Both readers derive from the same
    `review_report`, so /portfolio/review and /review reflect it identically."""
    for path in ("/api/v1/portfolio/review", "/api/v1/review"):
        d = (await app_client.get(path)).json()
        items = d["items"] if "items" in d else d["attention"]
        assert items, f"{path} should serve at least one item"
        for i in items:
            # First letter upper-cased — no lowercase enum key leaks into a served label.
            assert i["severity"][:1].isupper(), f"severity not display-cased: {i['severity']!r} ({path})"
            assert i["area"][:1].isupper(), f"area not display-cased: {i['area']!r} ({path})"
            assert i["severity"] in ("Review", "Info"), i["severity"]


async def test_review_groups_income_and_expenses_not_obligations(app_client):
    """§12cf1-2 alignment (page-review §12rv2-1) — the served attention AREA for a due income/expense
    is the USER'S vocabulary, "Income & expenses", not the model's word "Obligations".

    An INCOMING salary is not an "obligation" to the person reading it — the exact mislabel the Cash
    flow walk fixed. Review reads the same records, so it must use the same word.
    """
    soon = (date.today() + timedelta(days=20)).isoformat()
    # An INCOME obligation due soon — this is the case the old label got wrong.
    await app_client.post("/api/v1/obligations", json={
        "name": "Salary", "amount": 8000, "due_date": soon, "recurrence": "monthly", "kind": "income"})
    items = (await app_client.get("/api/v1/portfolio/review")).json()["items"]
    areas = {i["area"] for i in items}

    assert "Income & expenses" in areas
    assert "Obligations" not in areas          # the model's word never reaches the user

# SPDX-License-Identifier: AGPL-3.0-or-later
"""Insurance page-build Phase 0 — the §9 contract/behaviour deltas, fail-first.

Each test is written to be RED on the pre-delta code and GREEN after the delta it guards
(page-insurance §9). Grouped by the ruling number it pins.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta


async def _base(app_client) -> str:
    return (await app_client.get("/api/v1/insurance")).json()["base_currency"]


# --------------------------------------------------------------------------- #
# 9-10 + 9-4 (Amendment A) — count is ACTIVE-only, and money is served as display strings.
# --------------------------------------------------------------------------- #
async def test_count_and_totals_count_active_only(app_client):
    """`count` must agree with the totals it rides beside on Net worth's D-081 line (active only).
    RED today: `count` = len(all rows) = 2 while the totals sum 1 active policy (Amendment A cause i)."""
    base = await _base(app_client)
    await app_client.post("/api/v1/insurance", json={
        "name": "Active Term", "policy_type": "term_life", "cover_amount": 100000,
        "currency": base, "cash_value": 5000, "premium_frequency": "annual", "status": "active"})
    await app_client.post("/api/v1/insurance", json={
        "name": "Lapsed Whole", "policy_type": "whole_life", "cover_amount": 200000,
        "currency": base, "cash_value": 9000, "premium_frequency": "annual", "status": "lapsed"})
    rep = (await app_client.get("/api/v1/insurance")).json()
    assert rep["count"] == 1                    # active-only — RED today (== 2)
    assert rep["total_cover"] == 100000         # lapsed excluded from totals
    assert rep["total_cash_value"] == 5000
    assert len(rep["policies"]) == 2            # both still visible in the records table


async def test_money_served_as_display_strings(app_client):
    """D-105: every money figure is served as a display string (Amendment A cause ii).
    RED today: the `*_display` keys do not exist."""
    base = await _base(app_client)
    await app_client.post("/api/v1/insurance", json={
        "name": "Term Life", "policy_type": "term_life", "cover_amount": 500000,
        "currency": base, "cash_value": 12000, "premium": 1200,
        "premium_frequency": "annual", "status": "active"})
    rep = (await app_client.get("/api/v1/insurance")).json()
    assert rep["total_cover_display"] == "500,000.00"
    assert rep["total_cash_value_display"] == "12,000.00"
    assert rep["total_annual_premium_display"] == "1,200.00"
    pol = rep["policies"][0]
    assert pol["cover_amount_display"] == "500,000.00"
    assert pol["cash_value_display"] == "12,000.00"
    assert pol["premium_display"] == "1,200.00"
    # a missing money figure stays honestly empty, never a fabricated 0 (Guarantee 3)
    await app_client.post("/api/v1/insurance", json={
        "name": "No Cash", "policy_type": "health", "cover_amount": 50000,
        "currency": base, "premium_frequency": "annual", "status": "active"})
    rep = (await app_client.get("/api/v1/insurance")).json()
    no_cash = next(p for p in rep["policies"] if p["name"] == "No Cash")
    assert no_cash["cash_value_display"] is None
    assert no_cash["premium_display"] is None


# --------------------------------------------------------------------------- #
# 9-10 — policy_status is a fixed vocab (active/lapsed/expired), enforced like its siblings.
# --------------------------------------------------------------------------- #
async def test_policy_status_vocab_served_and_enforced(app_client):
    """/refdata serves `policy_status` as {value,label}; an unknown status is forced to the default,
    exactly as an unknown policy_type → 'other'. RED today: the vocab is absent and status is free text."""
    refdata = (await app_client.get("/api/v1/refdata")).json()
    assert [o["value"] for o in refdata["policy_status"]] == ["active", "lapsed", "expired"]
    assert refdata["policy_status"][1]["label"] == "Lapsed"          # titleized via the standard path
    base = await _base(app_client)
    r = (await app_client.post("/api/v1/insurance", json={
        "name": "Bogus Status", "policy_type": "health", "currency": base,
        "premium_frequency": "annual", "status": "not-a-real-status"})).json()
    assert r["status"] == "active"                                   # unknown → default (sibling of policy_type)
    # a valid non-default value is preserved
    r2 = (await app_client.post("/api/v1/insurance", json={
        "name": "Lapsed", "policy_type": "health", "currency": base,
        "premium_frequency": "annual", "status": "lapsed"})).json()
    assert r2["status"] == "lapsed"


# --------------------------------------------------------------------------- #
# 9-6 — the register is household-scoped; ?entity_id is REJECTED, not silently ignored.
# --------------------------------------------------------------------------- #
async def test_entity_id_rejected_with_400(app_client):
    """A silently-ignored scope param is an API honesty trap (the register has no entity FK, D-063).
    RED today: the unknown param is dropped and the request returns 200."""
    r = await app_client.get("/api/v1/insurance", params={"entity_id": 1})
    assert r.status_code == 400
    assert "household" in r.json()["detail"].lower()
    # the unscoped call still works
    assert (await app_client.get("/api/v1/insurance")).status_code == 200


# --------------------------------------------------------------------------- #
# 9-7 (Amendment C) — ONE renewal derivation: insurance_report and Review share renewal_reminders;
# overdue unifies on the helper's -3650d clamp.
# --------------------------------------------------------------------------- #
async def test_renewal_clamp_excludes_ancient_overdue(app_client):
    """The page's upcoming_renewals unifies on the shared helper's -3650d clamp: a policy overdue by
    >10 years is NOT surfaced. RED against the old unbounded inline `days <= 60` (which included it)."""
    base = await _base(app_client)
    ancient = (datetime.now(UTC).date() - timedelta(days=4000)).isoformat()   # ~11 years overdue
    soon = (datetime.now(UTC).date() + timedelta(days=45)).isoformat()
    for name, rd in [("Ancient", ancient), ("Soon", soon)]:
        await app_client.post("/api/v1/insurance", json={
            "name": name, "policy_type": "health", "currency": base,
            "premium_frequency": "annual", "status": "active", "renewal_date": rd})
    rep = (await app_client.get("/api/v1/insurance")).json()
    names = [u["name"] for u in rep["upcoming_renewals"]]
    assert "Soon" in names                       # within the 60-day page horizon
    assert "Ancient" not in names                # RED today: old inline `days <= 60` had no lower clamp
    assert all("id" in u for u in rep["upcoming_renewals"])   # shared helper returns id for row-linking


async def test_upcoming_renewals_is_exactly_the_shared_helper(session):
    """page-insurance §9-7 (the Scenarios §9-4 equality-test pattern): the page's upcoming_renewals IS
    renewal_reminders at the page window — one derivation, not a second inline copy."""
    from app.core.config import get_settings
    from app.services.insurance import (
        _RENEWAL_SOON_DAYS,
        create_policy,
        insurance_report,
        renewal_reminders,
    )

    base = get_settings().base_currency
    for name, d in [("A", 10), ("B", 50), ("C", 200)]:
        renewal = (datetime.now(UTC).date() + timedelta(days=d)).isoformat()
        await create_policy(session, {"name": name, "policy_type": "health", "currency": base,
                                      "premium_frequency": "annual", "status": "active",
                                      "renewal_date": renewal})
    await session.commit()
    rep = await insurance_report(session)
    helper = await renewal_reminders(session, _RENEWAL_SOON_DAYS)
    assert rep["upcoming_renewals"] == helper          # one derivation — cannot silently diverge
    assert [u["name"] for u in helper] == ["A", "B"]   # C (200d) outside the 60d page horizon; sorted by days


# --------------------------------------------------------------------------- #
# 9-12 — cover_by_type is display-cased at the backend boundary (the UI never maps enums).
# --------------------------------------------------------------------------- #
async def test_cover_by_type_display_cased_at_boundary(app_client):
    """§9-12 — cover_by_type serves {type, label, value, value_display}. RED today: no `label` key."""
    base = await _base(app_client)
    await app_client.post("/api/v1/insurance", json={
        "name": "CI", "policy_type": "critical_illness", "cover_amount": 100000,
        "currency": base, "premium_frequency": "annual", "status": "active"})
    row = (await app_client.get("/api/v1/insurance")).json()["cover_by_type"][0]
    assert row["type"] == "critical_illness"
    assert row["label"] == "Critical illness"       # display-cased at the boundary, not a raw enum
    assert row["value_display"] == "100,000.00"

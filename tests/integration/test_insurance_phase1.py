# SPDX-License-Identifier: AGPL-3.0-or-later
"""Insurance page-build Phase 1 — the §12 gate-condition deltas, fail-first.

Each test is RED on the pre-delta code and GREEN after the delta it guards (page-insurance §12in-*).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta


async def _base(app_client) -> str:
    return (await app_client.get("/api/v1/insurance")).json()["base_currency"]


async def _clear(app_client) -> None:
    for p in (await app_client.get("/api/v1/insurance")).json()["policies"]:
        await app_client.delete(f"/api/v1/insurance/{p['id']}")


# --------------------------------------------------------------------------- #
# §12in-1 — per-policy money display strings carry the currency code when currency != base.
# --------------------------------------------------------------------------- #
async def test_non_base_currency_display_carries_the_code(app_client):
    """A policy whose currency != base shows the code in the display string; base rows stay bare.
    RED today: the display is bare '500,000.00' regardless of currency. (Base-agnostic + register
    cleared, so the full suite's cross-test base_currency leak cannot flake it.)"""
    await _clear(app_client)
    base = await _base(app_client)
    other = "EUR" if base != "EUR" else "USD"   # a currency guaranteed different from the base
    await app_client.post("/api/v1/insurance", json={
        "name": "BasePol", "policy_type": "term_life", "cover_amount": 100000,
        "currency": base, "premium": 500, "premium_frequency": "annual", "status": "active"})
    await app_client.post("/api/v1/insurance", json={
        "name": "OtherPol", "policy_type": "whole_life", "cover_amount": 500000,
        "currency": other, "cash_value": 12000, "premium": 800,
        "premium_frequency": "annual", "status": "active"})
    pols = (await app_client.get("/api/v1/insurance")).json()["policies"]
    bp = next(p for p in pols if p["name"] == "BasePol")
    op = next(p for p in pols if p["name"] == "OtherPol")
    assert bp["cover_amount_display"] == "100,000.00"                 # bare (base currency)
    assert op["cover_amount_display"] == f"{other} 500,000.00"        # code-prefixed (non-base)
    assert op["cash_value_display"] == f"{other} 12,000.00"
    assert op["premium_display"] == f"{other} 800.00"


# --------------------------------------------------------------------------- #
# §12in-2 — the served disclaimer carries the two ratified exclusion sentences.
# --------------------------------------------------------------------------- #
async def test_disclaimer_carries_exclusion_sentences(app_client):
    """The served disclaimer states lapsed/expired exclusion and the Net-worth cash-value exclusion.
    RED today: the disclaimer stops after the current-FX caveat."""
    disc = (await app_client.get("/api/v1/insurance")).json()["disclaimer"]
    assert "excluded from the totals and the active count" in disc
    assert "excluded from Net worth" in disc
    assert "see Net worth" in disc


# --------------------------------------------------------------------------- #
# §12in-3 — renewal_reminders serves a per-item `state`; the frontend never re-derives it.
# --------------------------------------------------------------------------- #
async def test_renewal_state_served_per_item(app_client):
    """Each renewal carries state overdue/soon/upcoming from the ONE backend threshold. RED: no key."""
    base = await _base(app_client)
    today = datetime.now(UTC).date()
    cases = {"OverdueP": -5, "SoonP": 10, "UpcomingP": 50}
    for name, d in cases.items():
        await app_client.post("/api/v1/insurance", json={
            "name": name, "policy_type": "health", "currency": base,
            "premium_frequency": "annual", "status": "active",
            "renewal_date": (today + timedelta(days=d)).isoformat()})
    ren = {r["name"]: r for r in (await app_client.get("/api/v1/insurance")).json()["upcoming_renewals"]}
    assert ren["OverdueP"]["state"] == "overdue"    # days < 0
    assert ren["SoonP"]["state"] == "soon"          # 0..30 (the backend _INSURANCE_SOON_DAYS)
    assert ren["UpcomingP"]["state"] == "upcoming"  # > 30, within the 60d page window


async def test_soon_threshold_is_backend_only_one_store(app_client):
    """§12in-3 — the soon-day threshold lives in ONE backend store; Review imports it, does not redefine."""
    import app.services.insurance as ins
    import app.services.review as rev

    assert hasattr(ins, "_INSURANCE_SOON_DAYS")
    # Review must not carry its own copy of the constant value — it reads the insurance one.
    assert getattr(rev, "_INSURANCE_SOON_DAYS", None) is ins._INSURANCE_SOON_DAYS

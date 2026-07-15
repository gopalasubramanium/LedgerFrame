# SPDX-License-Identifier: AGPL-3.0-or-later
"""Insurance page-build — owner walk BATCH 1, §14in-2 (fail-first).

The "Premium / yr" column must render the ANNUAL EQUIVALENT of the premium, built by the ONE
_annual_premium derivation the totals accumulator also uses (page-insurance §14in-2). RED on the
pre-fix code (no `annual_premium_display` field); GREEN after the delta.
"""

from __future__ import annotations

from decimal import Decimal


async def _base(app_client) -> str:
    return (await app_client.get("/api/v1/insurance")).json()["base_currency"]


async def _clear(app_client) -> None:
    for p in (await app_client.get("/api/v1/insurance")).json()["policies"]:
        await app_client.delete(f"/api/v1/insurance/{p['id']}")


# --------------------------------------------------------------------------- #
# §14in-2 — a monthly-50 policy renders 600.00/yr, NOT the raw per-frequency 50.
# --------------------------------------------------------------------------- #
async def test_monthly_premium_renders_annual_equivalent(app_client):
    """A monthly premium of 50 must serve annual_premium_display == "600.00" (×12). RED today: the field
    does not exist; the page rendered the raw per-frequency premium_display ("50.00") under a "/ yr" head."""
    await _clear(app_client)
    base = await _base(app_client)
    await app_client.post("/api/v1/insurance", json={
        "name": "Monthly50", "policy_type": "health", "cover_amount": 100000,
        "currency": base, "premium": 50, "premium_frequency": "monthly", "status": "active"})
    pol = (await app_client.get("/api/v1/insurance")).json()["policies"][0]
    assert pol["annual_premium"] == 600.0
    assert pol["annual_premium_display"] == "600.00"           # ×12, annualised
    assert pol["premium_display"] == "50.00"                   # the per-frequency premium is still served


async def test_frequency_multipliers_and_single_is_null(app_client):
    """monthly ×12, quarterly ×4, annual ×1, single → null (no recurring equivalent → em dash, §12in-4)."""
    await _clear(app_client)
    base = await _base(app_client)
    cases = {
        "M": ("monthly", 100, "1,200.00"),      # ×12
        "Q": ("quarterly", 300, "1,200.00"),    # ×4
        "A": ("annual", 1200, "1,200.00"),      # ×1
    }
    for name, (freq, prem, _disp) in cases.items():
        await app_client.post("/api/v1/insurance", json={
            "name": name, "policy_type": "term_life", "currency": base,
            "premium": prem, "premium_frequency": freq, "status": "active"})
    # single-pay carries a premium but has NO annual equivalent → null
    await app_client.post("/api/v1/insurance", json={
        "name": "S", "policy_type": "whole_life", "currency": base,
        "premium": 5000, "premium_frequency": "single", "status": "active"})
    # no-premium policy → null too
    await app_client.post("/api/v1/insurance", json={
        "name": "None", "policy_type": "motor", "currency": base,
        "premium_frequency": "annual", "status": "active"})
    by = {p["name"]: p for p in (await app_client.get("/api/v1/insurance")).json()["policies"]}
    for name, (_f, _p, disp) in cases.items():
        assert by[name]["annual_premium_display"] == disp
    assert by["S"]["annual_premium"] is None
    assert by["S"]["annual_premium_display"] is None           # single → em dash
    assert by["None"]["annual_premium_display"] is None        # no premium → em dash


# --------------------------------------------------------------------------- #
# §14in-2 — the A11 equality: Σ(served per-row annual) == total_annual_premium (ONE derivation).
# --------------------------------------------------------------------------- #
async def test_sum_of_row_annuals_reconciles_with_total(app_client):
    """Σ(served per-row annual_premium over ACTIVE policies) == total_annual_premium — pinning that the
    column and the strip come from the ONE _annual_premium derivation (base-currency, so FX is identity;
    the same _to_base path already covers cover/cash totals). A lapsed row must NOT contribute."""
    await _clear(app_client)
    base = await _base(app_client)
    seed = [
        ("m", "monthly", 100, "active"),      # 1200/yr
        ("q", "quarterly", 250, "active"),    # 1000/yr
        ("a", "annual", 1800, "active"),      # 1800/yr
        ("s", "single", 9000, "active"),      # no annual equivalent
        ("n", "annual", None, "active"),      # no premium
        ("lapsed", "monthly", 500, "lapsed"), # excluded from the total
    ]
    for name, freq, prem, status in seed:
        body = {"name": name, "policy_type": "term_life", "currency": base,
                "premium_frequency": freq, "status": status}
        if prem is not None:
            body["premium"] = prem
        await app_client.post("/api/v1/insurance", json=body)
    rep = (await app_client.get("/api/v1/insurance")).json()
    row_sum = sum(
        Decimal(str(p["annual_premium"]))
        for p in rep["policies"]
        if p["status"] == "active" and p["annual_premium"] is not None
    )
    assert row_sum == Decimal("4000")                          # 1200 + 1000 + 1800
    assert Decimal(str(rep["total_annual_premium"])) == row_sum

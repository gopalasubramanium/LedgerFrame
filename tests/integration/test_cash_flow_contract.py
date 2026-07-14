# SPDX-License-Identifier: AGPL-3.0-or-later
"""page-cash-flow Phase 0 — the §9 contract deltas (9-4, 9-5, 9-6, 9-7b)."""

from __future__ import annotations

BASE = "/api/v1"


async def _obl(client, **kw):
    body = {"name": "Rent", "amount": 1200, "due_date": "2026-08-01",
            "recurrence": "monthly", "kind": "expense"}
    body.update(kw)
    r = await client.post(f"{BASE}/obligations", json=body)
    assert r.status_code == 200, r.text
    return r.json()


async def _con(client, **kw):
    body = {"name": "SIP", "amount": 600, "frequency": "quarterly", "kind": "invest"}
    body.update(kw)
    r = await client.post(f"{BASE}/contributions", json=body)
    assert r.status_code == 200, r.text
    return r.json()


# --------------------------------------------------------------------------- #
# 9-4 — the per-row monthly-equivalent is SERVED. The frontend computes no money.
# --------------------------------------------------------------------------- #


async def test_obligation_rows_serve_a_monthly_equivalent(app_client):
    await _obl(app_client, name="Rent", amount=1200, recurrence="monthly")
    await _obl(app_client, name="Insurance", amount=1200, recurrence="quarterly")
    await _obl(app_client, name="Tax", amount=1200, recurrence="once")

    rows = {r["name"]: r for r in (await app_client.get(f"{BASE}/obligations")).json()["obligations"]}

    assert rows["Rent"]["monthly_equivalent"] == 1200
    assert rows["Insurance"]["monthly_equivalent"] == 400          # 1200 / 3, computed SERVER-side
    # A one-off has NO monthly rate — it is lumpy, not a burn (D-057). An honest null, never a 0
    # that would read as "this costs nothing per month".
    assert rows["Tax"]["monthly_equivalent"] is None
    assert rows["Tax"]["monthly_equivalent_display"] is None


async def test_contribution_rows_serve_a_monthly_equivalent(app_client):
    await _con(app_client, name="SIP", amount=600, frequency="quarterly")
    await _con(app_client, name="Lump sum", amount=5000, frequency="once")
    rows = {r["name"]: r for r in (await app_client.get(f"{BASE}/contributions")).json()["contributions"]}
    assert rows["SIP"]["monthly_equivalent"] == 200                # 600 / 3
    assert rows["Lump sum"]["monthly_equivalent"] is None          # 'once' has no monthly rate


# --------------------------------------------------------------------------- #
# 9-5 — D-105: money is a SERVED display string on all four readers.
# --------------------------------------------------------------------------- #


async def test_all_four_readers_serve_money_as_display_strings(app_client):
    await _obl(app_client)
    await _con(app_client)
    await app_client.post(f"{BASE}/goals", json={"name": "House", "target_amount": 250000,
                                                 "basis": "net_worth", "target_date": "2027-01-01"})

    g = (await app_client.get(f"{BASE}/goals")).json()
    o = (await app_client.get(f"{BASE}/obligations")).json()
    c = (await app_client.get(f"{BASE}/contributions")).json()
    r = (await app_client.get(f"{BASE}/portfolio/runway")).json()

    goal = g["goals"][0]
    assert isinstance(goal["target_base_display"], str) and "," in goal["target_base_display"]
    assert isinstance(goal["current_base_display"], str)
    assert isinstance(goal["remaining_base_display"], str)
    # A percentage is NOT money — it stays a number (the D-105 scope amendment is about MONEY).
    assert isinstance(goal["progress_pct"], float)

    assert isinstance(o["obligations"][0]["amount_base_display"], str)
    assert isinstance(o["next_12m_total_display"], str)
    assert isinstance(c["contributions"][0]["amount_display"], str)
    assert isinstance(c["monthly_invest_display"], str)
    assert isinstance(r["net_monthly_burn_display"], str)
    assert isinstance(r["liquid_display"], str)


async def test_an_absent_money_figure_stays_honestly_empty(app_client):
    """A goal with basis 'none' has NO progress — it must not be a fabricated 0 (Guarantee 3)."""
    await app_client.post(f"{BASE}/goals", json={"name": "Someday", "target_amount": 1000,
                                                 "basis": "none"})
    goal = (await app_client.get(f"{BASE}/goals")).json()["goals"][0]
    assert goal["current_base"] is None and goal["progress_pct"] is None
    assert goal["current_base_display"] is None
    assert goal["remaining_base_display"] is None


# --------------------------------------------------------------------------- #
# 9-6 — served validation copy is USER copy, and `currency` references the master.
# --------------------------------------------------------------------------- #


async def test_validation_copy_is_user_copy_not_a_python_tuple(app_client):
    cases = [
        ("/obligations", {"name": "x", "amount": 1, "due_date": "2026-08-01",
                          "recurrence": "monthly", "kind": "zzz"}),
        ("/obligations", {"name": "x", "amount": 1, "due_date": "2026-08-01",
                          "recurrence": "zzz", "kind": "expense"}),
        ("/goals", {"name": "x", "target_amount": 1, "basis": "zzz"}),
    ]
    for path, body in cases:
        r = await app_client.post(f"{BASE}{path}", json=body)
        assert r.status_code == 400, (path, r.status_code)
        detail = r.json()["detail"]
        # A Python tuple/list literal ALWAYS renders as ('a', 'b') or ['a', 'b'] — that is the
        # defect. Quoting the offending VALUE ('zzz') is fine and is good copy.
        assert "('" not in detail and "['" not in detail, f"raw tuple served: {detail!r}"
        for internal in ("target_amount", "due_date", "target_goal_id", "_pct"):
            assert internal not in detail


async def test_currency_must_come_from_the_master(app_client):
    """The A9 defect class, closed here too: a categorical field references MASTER-DATA."""
    from app.core.config import SUPPORTED_CURRENCIES

    bad = [
        ("/obligations", {"name": "x", "amount": 1, "due_date": "2026-08-01",
                          "recurrence": "monthly", "kind": "expense", "currency": "ZZZ"}),
        ("/goals", {"name": "x", "target_amount": 1, "basis": "none", "currency": "ZZZ"}),
        ("/contributions", {"name": "x", "amount": 1, "frequency": "monthly",
                            "kind": "invest", "currency": "ZZZ"}),
    ]
    for path, body in bad:
        r = await app_client.post(f"{BASE}{path}", json=body)
        assert r.status_code == 400, (path, r.status_code)
        assert "ZZZ" in r.json()["detail"]

    # A real currency passes, case-insensitively, stored in the master's spelling.
    ok = await app_client.post(f"{BASE}/goals", json={"name": "x", "target_amount": 1,
                                                      "basis": "none", "currency": "sgd"})
    assert ok.status_code == 200
    assert (await app_client.get(f"{BASE}/goals")).json()["goals"][0]["currency"] == "SGD"
    assert "SGD" in SUPPORTED_CURRENCIES


# --------------------------------------------------------------------------- #
# 9-7b — DELETE of a missing id is an honest 404, not a silent "ok".
# --------------------------------------------------------------------------- #


async def test_deleting_a_missing_record_is_an_honest_404(app_client):
    """200-ok-for-nothing left the UI unable to tell 'deleted' from 'never existed' — on the
    platform's FIRST destructive action."""
    for path in ("/goals/99999", "/obligations/99999", "/contributions/99999"):
        r = await app_client.delete(f"{BASE}{path}")
        assert r.status_code == 404, (path, r.status_code)

    g = await app_client.post(f"{BASE}/goals", json={"name": "x", "target_amount": 1, "basis": "none"})
    gid = g.json()["id"]
    assert (await app_client.delete(f"{BASE}/goals/{gid}")).status_code == 200
    assert (await app_client.delete(f"{BASE}/goals/{gid}")).status_code == 404   # already gone

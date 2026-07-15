# SPDX-License-Identifier: AGPL-3.0-or-later
"""Review Centre (W1) — consolidated sections, and recorded reviews over time."""

from __future__ import annotations


async def test_review_centre_has_all_sections(app_client):
    d = (await app_client.get("/api/v1/review")).json()
    assert {"trust", "policy", "liquidity", "goals", "changed"} <= set(d["sections"])
    assert "attention" in d and "disclaimer" in d
    assert d["sections"]["trust"]["confidence"] >= 0


async def test_record_review_snapshots_state_and_lists_history(app_client):
    r = (await app_client.post("/api/v1/review/log",
                               json={"note": "checked drift", "next_review_date": "2026-09-01"})).json()
    assert r["ok"] and r["id"]
    h = (await app_client.get("/api/v1/review/history")).json()["history"]
    assert h and h[0]["note"] == "checked drift"
    assert h[0]["next_review_date"] == "2026-09-01"
    # The snapshot captured metrics automatically.
    assert "net_worth" in h[0] and "confidence" in h[0] and "attention_count" in h[0]


async def test_recent_split_surfaces_corporate_verify_item(app_client):
    """§4.3 Unit 1: a recently-recorded split raises a 'verify quantity & cost' attention item."""
    from datetime import UTC, datetime

    today = datetime.now(UTC).date().isoformat()
    await app_client.post("/api/v1/portfolio/transactions", json={
        "symbol": "SPLITCO", "type": "buy", "ts": f"{today}T10:00:00Z",
        "quantity": 10, "price": 100, "currency": "USD"})
    r = await app_client.post("/api/v1/portfolio/transactions", json={
        "symbol": "SPLITCO", "type": "split", "ts": f"{today}T11:00:00Z",
        "quantity": 0, "price": 2, "currency": "USD"})   # 2:1 split (ratio in price)
    assert r.status_code == 200

    attention = (await app_client.get("/api/v1/review")).json()["attention"]
    corp = [a for a in attention if a["area"] == "Corporate"]   # §12rv1-5: display-cased
    assert corp, "expected a corporate-action verify item"
    assert "SPLITCO" in corp[0]["title"] and "verify" in corp[0]["title"].lower()


async def test_policy_verdict_carries_its_input_quality(app_client):
    """A10 — the Review policy verdict is annotated with the quality of the prices it rests on,
    so a section computed off stale prices can never present as fresh. Same reader as the Policy
    page (`compute_drift`), so the annotation cannot diverge between the two."""
    pol = (await app_client.get("/api/v1/review")).json()["sections"]["policy"]
    assert "stale_inputs" in pol and "inputs_stale" in pol

    # The demo's quotes are freshly mocked, so nothing is STALE...
    assert pol["stale_inputs"] == 0
    # ...but it holds a manually-valued asset that scores below the low-confidence band, so the
    # verdict genuinely does rest on an input we do not fully trust — and now says so. (This is
    # the guard finding a real thing in the shipped fixture, not a contrived one.)
    assert pol["inputs_stale"] is True

    drift = (await app_client.get("/api/v1/policy/drift")).json()
    assert drift["low_confidence_inputs"] >= 1
    # Same reader, so the two payloads cannot disagree about the inputs.
    assert drift["stale_inputs"] == pol["stale_inputs"]
    assert drift["inputs_stale"] == pol["inputs_stale"]


async def test_net_worth_matches_canonical_summary_to_the_cent(app_client):
    """§14in-8 — the Review headline net-worth + today's-change are the SAME served figures the canonical
    /portfolio/summary reader carries (value_portfolio), at full cent precision. RED on the pre-fix code:
    review_centre rounded both to whole dollars (796,246.00 / +17.00 vs the canonical 796,246.41 / +16.73)."""
    summary = (await app_client.get("/api/v1/portfolio/summary")).json()
    review = (await app_client.get("/api/v1/review")).json()
    assert review["net_worth"] == summary["total_value"]                       # to the cent, one derivation
    assert review["sections"]["changed"]["day_change"] == summary["day_change"]
    # And it is NOT silently whole-dollar-rounded (the defect signature).
    assert review["net_worth"] != round(float(summary["total_value"]), 0) or float(summary["total_value"]).is_integer()

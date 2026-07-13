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
    corp = [a for a in attention if a["area"] == "corporate"]
    assert corp, "expected a corporate-action verify item"
    assert "SPLITCO" in corp[0]["title"] and "verify" in corp[0]["title"].lower()

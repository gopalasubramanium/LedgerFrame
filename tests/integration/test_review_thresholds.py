# SPDX-License-Identifier: AGPL-3.0-or-later
"""page-review Phase 0 (ND-1/ND-2): the owner-set thresholds (D-084), the D-087
`other`-class over-use signal, and the D-030 rename. Fail-first: these are RED on the
pre-Phase-0 code (constants 6/90, no over-use signal, /review absent)."""

from __future__ import annotations

from app.services import review


def test_thresholds_match_owner_set_defaults_d084_d087():
    # D-084 owner-set overrides + the D-087 over-use constant.
    assert review._RUNWAY_LOW_MONTHS == 3, "D-084: runway floor is 3 months"
    assert review._GOAL_SOON_DAYS == 180, "D-084: goal-soon window is 180 days"
    assert getattr(review, "_OTHER_CLASS_OVERUSE_PCT", None) == 10, "D-087: other-class over-use at 10%"


async def test_other_class_overuse_signal_fires(app_client):
    """D-087 — when `other`-classed holdings dominate gross assets, a review item prompts
    reclassification (own signal; reporting only, never a wall)."""
    await app_client.post("/api/v1/portfolio/manual-holdings", json={
        "label": "Big misc", "asset_class": "other", "value": 100_000_000, "currency": "SGD",
    })
    items = (await app_client.get("/api/v1/portfolio/review")).json()["items"]
    overuse = [i for i in items if "reclassify" in i["title"].lower() and "other" in i["title"].lower()]
    assert overuse, "an 'other'-class over-use item should fire above the threshold"


async def test_other_class_overuse_failure_is_isolated(app_client, monkeypatch):
    """D-059 — the over-use signal has its OWN guard: if it raises, the rest of the feed
    still returns (one failing signal never breaks the feed)."""
    def _boom(_val):
        raise RuntimeError("boom")

    monkeypatch.setattr(review, "_other_class_overuse_item", _boom)
    r = await app_client.get("/api/v1/portfolio/review")
    assert r.status_code == 200
    body = r.json()
    assert "items" in body  # feed intact
    assert not [i for i in body["items"] if "reclassify" in i["title"].lower()]  # the guarded item is absent


async def test_d030_rename_review_endpoint(app_client):
    """D-030 — `/review/centre` retired to `/review`; the centre JSON shape is served at /review.
    (The old path no longer has an API route — it falls through to the SPA shell, i.e. HTML, not the
    JSON centre shape.)"""
    r = await app_client.get("/api/v1/review")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/json")
    body = r.json()
    assert "sections" in body and "attention" in body and "attention_count" in body
    # The old path no longer serves the centre JSON (rename applied).
    old = await app_client.get("/api/v1/review/centre")
    assert not old.headers.get("content-type", "").startswith("application/json")

# SPDX-License-Identifier: AGPL-3.0-or-later
"""R-38 Phase 0.4 — route_rule provenance on /portfolio/pricing-health (§9-10) + the
tier-degraded honest string (§9-8, grounded in external.py — no new tier semantics)."""

from __future__ import annotations

_MATRIX = "/api/v1/system/routing-matrix"
_HEALTH = "/api/v1/portfolio/pricing-health"
_RULES = {"override", "matrix", "lane", "active"}


async def test_pricing_health_serves_route_rule_on_every_row(app_client):
    """Every holding row carries a served route_rule from the ONE route() derivation."""
    r = await app_client.get(_HEALTH)
    assert r.status_code == 200
    rows = r.json()["holdings"]
    assert rows, "demo seed should have holdings"
    for row in rows:
        assert row.get("route_rule") in _RULES, row


async def test_a_matrix_cell_shows_route_rule_matrix_on_pricing_health(app_client):
    """A mapped, capable, keyless cell flips a holding's provenance to route_rule=matrix."""
    classes = {row["asset_class"] for row in (await app_client.get(_HEALTH)).json()["holdings"]}
    assert "equity" in classes, "demo seed should have an equity holding"

    # yahoo is keyless and covers equity everywhere → a capable cell that prices.
    put = await app_client.put(_MATRIX, json={
        "asset_class": "equity", "listing_country": "*", "provider": "yahoo"})
    assert put.status_code == 200, put.text

    rows = (await app_client.get(_HEALTH)).json()["holdings"]
    equity_rules = [row["route_rule"] for row in rows if row["asset_class"] == "equity"]
    assert "matrix" in equity_rules, equity_rules


async def test_av_tier_note_is_honest_and_grounded():
    """The served tier string reflects the learned av_tier only — None otherwise
    (external.py:96-157; no new tier semantics invented)."""
    from app.services.market import av_tier_note

    assert av_tier_note("alphavantage", "free") is not None
    assert "proxy" in av_tier_note("alphavantage", "free").lower()
    assert av_tier_note("alphavantage", "premium") is None   # premium prices real indices
    assert av_tier_note("yahoo", "free") is None             # not an AV tier concern
    assert av_tier_note("mock", None) is None


async def test_pricing_health_serves_provider_tier_note_key(app_client):
    """The response carries the served provider_tier note (null under the mock provider —
    honest: no tier degradation to report)."""
    body = (await app_client.get(_HEALTH)).json()
    assert "provider_tier_note" in body
    assert body["provider_tier_note"] is None   # tests run on mock, not AV

# SPDX-License-Identifier: AGPL-3.0-or-later
"""page-heatmap Phase 0 (ND-8) — the HoldingView reshape: per-holding `country` +
server-derived D-083 `region`, so the Heatmap's region filter reads served values (no
client region map, the Markets rule).

Fail-first: RED on the pre-reshape shape (HoldingView had neither field).
"""
from __future__ import annotations

from app.core.regions import REGIONS


async def test_holdings_serve_country_and_region(app_client):
    d = (await app_client.get("/api/v1/portfolio/holdings")).json()
    assert d["holdings"], "demo should have holdings"
    for h in d["holdings"]:
        # Both fields are present on every row (reshape applied).
        assert "country" in h and "region" in h
        # region is TOTAL — always one of the six D-083 buckets (never null, never "Global").
        assert h["region"] in REGIONS, h["region"]
        assert h["region"] != "Global"


async def test_region_is_derived_from_country_server_side(app_client):
    """Every served region matches the canonical derivation of its served country — proving the
    server derived it (the client is never expected to map country → region)."""
    from app.core.regions import region_of

    d = (await app_client.get("/api/v1/portfolio/holdings")).json()
    for h in d["holdings"]:
        assert h["region"] == region_of(h["country"])
    # The demo spans multiple regions (US equities + an India + a Singapore name, per markets tests).
    regions = {h["region"] for h in d["holdings"]}
    assert len(regions) >= 2, f"expected a multi-region demo, got {regions}"

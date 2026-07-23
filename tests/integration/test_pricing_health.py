# SPDX-License-Identifier: AGPL-3.0-or-later
"""Phase 3a: pricing-health diagnostics endpoint."""

from __future__ import annotations

_STATUSES = {"Fresh", "Delayed", "End-of-day", "Cached", "Manual", "Estimated", "Unavailable"}


async def test_pricing_health_reports_provenance(app_client):
    r = await app_client.get("/api/v1/portfolio/pricing-health")
    assert r.status_code == 200
    body = r.json()
    holdings = body["holdings"]
    assert holdings, "demo data should seed holdings"
    for h in holdings:
        assert h["status"] in _STATUSES
        assert "valuation_method" in h and "valuation_label" in h
        assert "source" in h and "entitlement" in h and "price_ts" in h
    # Manual demo assets (cash/property) report a Manual status.
    assert "Manual" in {h["status"] for h in holdings}
    # Summary counts are consistent with the rows.
    assert sum(body["summary"].values()) == len(holdings)
    # No secrets leak.
    blob = r.text.lower()
    assert "api_key" not in blob and "secret" not in blob


async def test_pricing_health_stale_flag_reconciles_with_summary_count(app_client):
    """§14dr-3 — the per-holding `is_stale` flag (the marker Pricing Health renders to identify WHICH
    holdings are stale) and the Stale-banner count come from ONE shared reader (value_portfolio). Pin
    the reconciliation: the number of is_stale rows in the pricing-health payload equals
    /portfolio/summary.stale_count — so "banner count == marked rows" holds by construction, never a
    second independently-computed number."""
    ph = (await app_client.get("/api/v1/portfolio/pricing-health")).json()
    summary = (await app_client.get("/api/v1/portfolio/summary")).json()
    assert "stale_count" in summary
    marked = sum(1 for h in ph["holdings"] if h["is_stale"])
    assert marked == summary["stale_count"]


async def test_pricing_health_carries_typed_failure_state(app_client):
    """R-63 §9-2 Delta 2.2: every row carries the typed failure fields; when a state is present it
    is one of the taxonomy values and it has a served (PROPOSED) note — never a bare 'none'."""
    _TAXONOMY = {"throttled", "empty", "errored", "parse_error", "unmapped", "no_key", "unsupported"}
    body = (await app_client.get("/api/v1/portfolio/pricing-health")).json()
    for h in body["holdings"]:
        assert "failure_state" in h and "failure_at" in h and "failure_note" in h
        if h["failure_state"] is not None:
            assert h["failure_state"] in _TAXONOMY
            assert h["failure_note"], "a typed failure state must carry a served note"


async def test_manual_holdings_serve_a_source_word_never_null(app_client):
    """R-63 0a F-A (§11-I): a manual holding has no market instrument and so no market source —
    it must serve the honest word 'manual' (matching its route_source), never a null that the
    Pricing Health Source column renders as the literal 'null (head manual)'."""
    body = (await app_client.get("/api/v1/portfolio/pricing-health")).json()
    manual = [h for h in body["holdings"] if h["status"] == "Manual"]
    assert manual, "demo seeds manual holdings (cash/property)"
    for h in manual:
        assert h["source"] == "manual", f"manual holding served source={h['source']!r} (F-A)"
        assert h["route_source"] == "manual"  # the pair the Source column joins — now consistent


async def test_quote_demo_residue_repair_is_inert_in_demo_mode(app_client):
    """R-63 F-C (I-10) — the migration rider is gated to LIVE instances. The demo seed is the mock
    provider, so its ``source='mock'`` quotes are legitimate; a pricing-health read must NOT purge
    them (and must not claim the once-per-install marker, or a later demo→live switch would skip the
    real purge). Route-level pin: the mock-priced demo holdings survive the read, twice."""
    first = (await app_client.get("/api/v1/portfolio/pricing-health")).json()
    priced = [h for h in first["holdings"] if h.get("source") == "mock"]
    assert priced, "the demo seed should carry mock-sourced quotes"
    second = (await app_client.get("/api/v1/portfolio/pricing-health")).json()
    still = [h for h in second["holdings"] if h.get("source") == "mock"]
    assert len(still) == len(priced), "demo mock quotes must survive the pricing-health read (not purged)"

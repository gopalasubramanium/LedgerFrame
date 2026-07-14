# SPDX-License-Identifier: AGPL-3.0-or-later
"""Phase 1 — Investment Policy: stored targets + live drift/band/concentration."""

from __future__ import annotations


async def test_default_policy_is_created(app_client):
    p = (await app_client.get("/api/v1/policy")).json()
    assert p["name"] == "Investment Policy"
    assert p["default_band_pct"] == 5.0 and p["targets"] == []


async def test_set_targets_all_dimensions(app_client):
    r = await app_client.put("/api/v1/policy/targets", json={"targets": [
        {"dimension": "asset_class", "bucket": "equity", "target_pct": 30},
        {"dimension": "asset_class", "bucket": "property", "target_pct": 40, "min_pct": 30, "max_pct": 50},
        {"dimension": "currency", "bucket": "SGD", "target_pct": 60},
        {"dimension": "region", "bucket": "India", "target_pct": 20},
    ]})
    assert r.status_code == 200 and len(r.json()["targets"]) == 4


async def test_target_validation(app_client):
    # Unknown dimension.
    bad = await app_client.put("/api/v1/policy/targets", json={"targets": [
        {"dimension": "sector_x", "bucket": "tech", "target_pct": 10}]})
    assert bad.status_code == 400
    # Out-of-range target.
    oob = await app_client.put("/api/v1/policy/targets", json={"targets": [
        {"dimension": "asset_class", "bucket": "equity", "target_pct": 150}]})
    assert oob.status_code == 400
    # Duplicate bucket in a dimension.
    dup = await app_client.put("/api/v1/policy/targets", json={"targets": [
        {"dimension": "currency", "bucket": "SGD", "target_pct": 10},
        {"dimension": "currency", "bucket": "SGD", "target_pct": 20}]})
    assert dup.status_code == 400


async def test_drift_reports_band_status_and_gap(app_client):
    await app_client.put("/api/v1/policy/targets", json={"targets": [
        {"dimension": "asset_class", "bucket": "equity", "target_pct": 30},
        {"dimension": "asset_class", "bucket": "property", "target_pct": 40, "min_pct": 30, "max_pct": 50},
    ]})
    d = (await app_client.get("/api/v1/policy/drift")).json()
    assert d["has_targets"] is True and "not financial advice" in d["disclaimer"].lower()
    ac = next(x for x in d["dimensions"] if x["dimension"] == "asset_class")
    buckets = {r["bucket"]: r for r in ac["rows"]}
    # Demo is property-heavy → property over its band, equity under.
    assert buckets["property"]["status"] == "over"
    assert buckets["equity"]["status"] == "under"
    # Every row carries a factual base-currency gap and a band.
    for r in ac["rows"]:
        assert "gap_base" in r and "lower_pct" in r and "upper_pct" in r
    # Held-but-untargeted classes are surfaced honestly.
    assert ac["untargeted"]
    assert ac["coverage_pct"] == 70.0


async def test_concentration_flag(app_client):
    r = await app_client.put("/api/v1/policy", json={"max_position_pct": 25})
    assert r.status_code == 200 and r.json()["max_position_pct"] == 25.0
    d = (await app_client.get("/api/v1/policy/drift")).json()
    # The demo property dominates → it breaches a 25% single-position limit.
    assert d["concentration"] and d["concentration"][0]["weight_pct"] > 25


async def test_clear_concentration_limit(app_client):
    await app_client.put("/api/v1/policy", json={"max_position_pct": 25})
    cleared = await app_client.put("/api/v1/policy", json={"max_position_pct": 0})
    assert cleared.json()["max_position_pct"] is None
    d = (await app_client.get("/api/v1/policy/drift")).json()
    assert d["concentration"] == []


# --------------------------------------------------------------------------- #
# Gate A9 — `bucket` is a CATEGORICAL field: it must reference MASTER-DATA.
# Before this gate the write path validated the DIMENSION but stored `bucket` as
# free text (`bucket[:40]`), so a garbage bucket was ACCEPTED — a free-text enum,
# which CLAUDE.md's hard rule forbids. A MasterSelect in the UI cannot close a hole
# an API token can still drive. (page-policy §10-8)
# --------------------------------------------------------------------------- #


async def test_bucket_must_come_from_the_dimension_master(app_client):
    # asset_class: not in the AssetClass master.
    bad = await app_client.put("/api/v1/policy/targets", json={"targets": [
        {"dimension": "asset_class", "bucket": "zzz", "target_pct": 10}]})
    assert bad.status_code == 400
    detail = bad.json()["detail"]
    assert "zzz" in detail and "equity" in detail  # honest: names the offender AND the master

    # region: not one of the six D-083 buckets.
    bad_region = await app_client.put("/api/v1/policy/targets", json={"targets": [
        {"dimension": "region", "bucket": "Mars", "target_pct": 10}]})
    assert bad_region.status_code == 400 and "Mars" in bad_region.json()["detail"]

    # currency: not in the currency master.
    bad_ccy = await app_client.put("/api/v1/policy/targets", json={"targets": [
        {"dimension": "currency", "bucket": "XYZ", "target_pct": 10}]})
    assert bad_ccy.status_code == 400 and "XYZ" in bad_ccy.json()["detail"]


async def test_valid_buckets_pass_and_are_stored_in_the_master_spelling(app_client):
    ok = await app_client.put("/api/v1/policy/targets", json={"targets": [
        {"dimension": "asset_class", "bucket": "equity", "target_pct": 30},
        {"dimension": "region", "bucket": "India", "target_pct": 20},
        {"dimension": "currency", "bucket": "sgd", "target_pct": 50},
    ]})
    assert ok.status_code == 200
    by_dim = {t["dimension"]: t["bucket"] for t in ok.json()["targets"]}
    assert by_dim["asset_class"] == "equity"
    assert by_dim["region"] == "India"
    # Canonicalised to the master's spelling — "sgd" cannot enter as a second SGD bucket.
    assert by_dim["currency"] == "SGD"

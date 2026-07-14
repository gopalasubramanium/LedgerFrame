# SPDX-License-Identifier: AGPL-3.0-or-later
"""Phase 1 — Investment Policy: stored targets + live drift/band/concentration."""

from __future__ import annotations

from decimal import Decimal

import pytest

from app.services import policy as policy_svc
from app.services.portfolio import HoldingValue, PortfolioValuation


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


# --------------------------------------------------------------------------- #
# Gate A10 — a verdict computed off STALE prices can never present as FRESH.
# `compute_drift` consumed the valuation's market values but surfaced NO staleness
# and NO confidence (zero `is_stale` / `confidence` in services/policy.py), so the
# page would state "Equity is OVER its band" off a stale price, unqualified.
# Product Guarantee 3 — "stale values are flagged, never hidden" — does not exempt
# a DERIVED verdict. (page-policy §10-7; the page-news audit-the-guards lesson)
# --------------------------------------------------------------------------- #


def _holding(*, stale: bool, method: str = "market_quote", value: str = "100"):
    return HoldingValue(
        holding_id=1, label="ACME", name="Acme Corp", symbol="ACME", asset_class="equity",
        sector=None, quantity=Decimal(1), native_currency="SGD", price=Decimal(value),
        market_value_base=Decimal(value), cost_basis_base=Decimal("50"),
        unrealised_pl_base=Decimal("50"), day_change_base=Decimal(0),
        is_stale=stale, is_priced=True, valuation_method=method,
    )


def _valuation(holdings):
    return PortfolioValuation(base_currency="SGD", total_value=Decimal("100"), holdings=holdings)


async def _drift_with(session, monkeypatch, holdings):
    await policy_svc.replace_targets(
        session, [{"dimension": "asset_class", "bucket": "equity", "target_pct": 10}])

    async def _fake_value_portfolio(_session, _base, entity_id=None):
        return _valuation(holdings)

    monkeypatch.setattr(policy_svc, "value_portfolio", _fake_value_portfolio)
    return await policy_svc.compute_drift(session)


async def test_drift_off_stale_prices_is_flagged(session, monkeypatch):
    d = await _drift_with(session, monkeypatch, [_holding(stale=True)])

    # The verdict itself still fires (the figure is shown, never hidden — Guarantee 3)...
    row = d["dimensions"][0]["rows"][0]
    assert row["status"] == "over"
    # ...but it can no longer present as fresh.
    assert d["stale_inputs"] == 1
    assert d["inputs_stale"] is True
    assert d["inputs_note"]                       # an honest, served reason
    assert "stale" in d["inputs_note"].lower()


async def test_drift_off_fresh_prices_carries_no_false_warning(session, monkeypatch):
    d = await _drift_with(session, monkeypatch, [_holding(stale=False)])
    assert d["stale_inputs"] == 0
    assert d["low_confidence_inputs"] == 0
    assert d["inputs_stale"] is False
    assert d["inputs_note"] is None               # no warning where there is nothing to warn about


async def test_drift_flags_low_confidence_inputs(session, monkeypatch):
    # An estimated value scores 40 — below the low-confidence band (<50, PRODUCT-SPEC §5).
    d = await _drift_with(session, monkeypatch, [_holding(stale=False, method="estimated_value")])
    assert d["low_confidence_inputs"] == 1
    assert d["inputs_stale"] is True              # the verdict rests on inputs we do not trust
    assert d["inputs_note"]


# --------------------------------------------------------------------------- #
# Gate A11 — ONE weight derivation (P-1 / D-038).
# Policy's per-bucket `actual_pct` for asset_class/currency IS the same figure
# Portfolio owns as "Allocation weight" (D-033). It used to be computed by a SECOND
# code path (a private loop in services/policy.py) that merely happened to apply the
# same rule. This test crosses the two served payloads: a change to one that does not
# reach the other is a P-1 violation, and it fires. (page-policy §10-4)
# --------------------------------------------------------------------------- #


async def test_policy_weights_are_portfolios_allocation_weights(app_client):
    summary = (await app_client.get("/api/v1/portfolio/summary")).json()
    gross = summary["gross_assets"]
    assert gross > 0

    # Target every class the book actually holds, so every bucket produces a drift row.
    classes = sorted(summary["allocation_by_class"])
    await app_client.put("/api/v1/policy/targets", json={"targets": [
        {"dimension": "asset_class", "bucket": c, "target_pct": 0} for c in classes]})

    drift = (await app_client.get("/api/v1/policy/drift")).json()
    rows = {r["bucket"]: r for d in drift["dimensions"] if d["dimension"] == "asset_class"
            for r in d["rows"]}
    assert rows, "the asset_class dimension produced no rows"

    for cls, value in summary["allocation_by_class"].items():
        expected = round(value / gross * 100, 1)          # Portfolio's canonical weight
        assert rows[cls]["actual_pct"] == pytest.approx(expected, abs=0.1), (
            f"{cls}: Policy says {rows[cls]['actual_pct']}%, Portfolio's allocation says {expected}%")


async def test_policy_currency_weights_are_portfolios_allocation_weights(app_client):
    summary = (await app_client.get("/api/v1/portfolio/summary")).json()
    gross = summary["gross_assets"]

    ccys = sorted(summary["allocation_by_currency"])
    await app_client.put("/api/v1/policy/targets", json={"targets": [
        {"dimension": "currency", "bucket": c, "target_pct": 0} for c in ccys]})

    drift = (await app_client.get("/api/v1/policy/drift")).json()
    rows = {r["bucket"]: r for d in drift["dimensions"] if d["dimension"] == "currency"
            for r in d["rows"]}
    for ccy, value in summary["allocation_by_currency"].items():
        expected = round(value / gross * 100, 1)
        assert rows[ccy]["actual_pct"] == pytest.approx(expected, abs=0.1)


# --------------------------------------------------------------------------- #
# PHASE 0 — the §9 one-pass contract deltas (9-3, 9-6, 9-17, 9-21, 9-18).
# --------------------------------------------------------------------------- #


async def test_drift_serves_gross_assets_and_not_a_net_total(app_client):
    """9-3 — the denominator the weights are actually OF, and no net total beside them.

    `total_value` was NET of liabilities while every % divides by GROSS assets. Serving both
    meant serving two numbers that cannot be reconciled the moment a liability exists. Net worth
    is canonical for the net total (P-1), so the drift payload does not carry it at all.
    """
    d = (await app_client.get("/api/v1/policy/drift")).json()
    assert "total_value" not in d          # the unreconcilable figure is GONE, not relabelled
    assert d["gross_assets"] > 0
    assert d["gross_assets_display"]       # D-105: served, rendered verbatim

    summary = (await app_client.get("/api/v1/portfolio/summary")).json()
    # One denominator, one home (A11) — Policy's base IS Portfolio's gross assets.
    assert d["gross_assets"] == summary["gross_assets"]
    # ...and it is NOT the net total (the demo carries a liability, so these genuinely differ).
    assert summary["total_value"] != summary["gross_assets"]


async def test_drift_money_is_served_as_display_strings(app_client):
    """9-6 — D-105 binds ALL money: the frontend renders, it never formats."""
    await app_client.put("/api/v1/policy/targets", json={"targets": [
        {"dimension": "asset_class", "bucket": "equity", "target_pct": 30}]})
    await app_client.put("/api/v1/policy", json={"max_position_pct": 5})
    d = (await app_client.get("/api/v1/policy/drift")).json()

    row = d["dimensions"][0]["rows"][0]
    assert isinstance(row["gap_base_display"], str)
    assert isinstance(row["actual_value_display"], str)
    assert "," in row["actual_value_display"] or "." in row["actual_value_display"]  # formatted
    for u in d["dimensions"][0]["untargeted"]:
        assert isinstance(u["actual_value_display"], str)
    assert d["concentration"], "the demo breaches a 5% limit"
    assert isinstance(d["concentration"][0]["value_display"], str)
    # Percentages stay raw numbers — 9-6 scopes D-105 to MONEY (owner ruling).
    assert isinstance(row["actual_pct"], float)


async def test_concentration_rows_carry_a_nullable_symbol(app_client):
    """9-17 — D-098: an entity reference links. A symbol-less manual asset renders plain text."""
    await app_client.put("/api/v1/policy", json={"max_position_pct": 1})
    d = (await app_client.get("/api/v1/policy/drift")).json()
    assert d["concentration"]
    for c in d["concentration"]:
        assert "symbol" in c                       # present on EVERY row...
        assert c["symbol"] is None or isinstance(c["symbol"], str)   # ...nullable, never guessed
    # The demo's dominant position is a manual property (no symbol) — it must be honestly null,
    # not a fabricated route.
    assert any(c["symbol"] is None for c in d["concentration"])


async def test_drift_rejects_an_entity_scope(app_client):
    """9-21 — policy targets are HOUSEHOLD-global, so scoping the actuals to one entity would
    compare it against a policy that was never its own. A silently meaningless comparison is an
    API honesty trap; it is an honest 400 instead."""
    r = await app_client.get("/api/v1/policy/drift", params={"entity_id": 1})
    assert r.status_code == 400
    assert "household" in r.json()["detail"].lower()
    # The household read still works.
    assert (await app_client.get("/api/v1/policy/drift")).status_code == 200


async def test_default_band_pct_is_five(app_client):
    """9-18 — the ratified default band. A ratified VALUE ships a code test pinning the SERVED
    value in the same batch as the spec edit (the D-084 rule) — a spec edit alone leaves the code
    free to silently disagree."""
    assert (await app_client.get("/api/v1/policy")).json()["default_band_pct"] == 5.0


async def test_refdata_serves_the_currency_master(app_client):
    """The `currency` bucket picker and the A9 validator must read the SAME list.

    MASTER-DATA §3 (amended 2026-07-14): the currency master is the fixed constant
    SUPPORTED_CURRENCIES — the table the spec used to describe was never built — so currency is a
    FIXED vocabulary and belongs on /refdata (D-005: the frontend carries zero vocabulary copies).
    """
    from app.core.config import SUPPORTED_CURRENCIES
    from app.services.policy import master_buckets

    vocabs = (await app_client.get("/api/v1/refdata")).json()
    served = [o["value"] for o in vocabs["currency"]]
    assert served == list(SUPPORTED_CURRENCIES)
    # The picker's options and the write path's validator cannot drift apart.
    assert tuple(served) == master_buckets("currency")

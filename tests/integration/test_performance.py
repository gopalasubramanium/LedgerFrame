# SPDX-License-Identifier: AGPL-3.0-or-later
"""Portfolio performance analytics endpoint."""

from __future__ import annotations


async def test_performance_returns_series_and_stats(app_client):
    r = await app_client.get("/api/v1/portfolio/performance?days=180")
    assert r.status_code == 200
    d = r.json()
    assert len(d["series"]) > 2
    assert len(d["benchmark"]) == len(d["series"])
    assert d["stats"] is not None
    assert "return_pct" in d["stats"] and "volatility_pct" in d["stats"]
    assert d["benchmark_symbol"]


async def test_benchmark_series_differs_from_portfolio_series(app_client):
    # §14dr-24: the benchmark rides the served-history path (SPY) and the portfolio line
    # is a separate reconstruction — they are re-based to the same start but must not be
    # the same curve, and the benchmark tracks SPY's real movement (never a flat line).
    d = (await app_client.get("/api/v1/portfolio/performance?days=365")).json()
    series = [p["value"] for p in d["series"]]
    bench = [p["value"] for p in d["benchmark"]]
    assert len(series) > 2 and len(bench) == len(series)
    assert series != bench
    assert max(bench) != min(bench)


async def test_performance_excludes_constant_manual_assets(app_client):
    # The invested series should move (priced holdings), not be a flat manual line.
    d = (await app_client.get("/api/v1/portfolio/performance?days=365")).json()
    vals = [p["value"] for p in d["series"]]
    assert max(vals) != min(vals)


async def test_benchmarks_endpoint(app_client):
    r = await app_client.get("/api/v1/portfolio/benchmarks")
    assert r.status_code == 200
    syms = [b["symbol"] for b in r.json()["benchmarks"]]
    assert "SPY" in syms


async def test_key_stats_endpoint(app_client):
    r = await app_client.get("/api/v1/portfolio/stats")
    assert r.status_code == 200
    metrics = {m["label"]: m for m in r.json()["metrics"]}
    assert "Total value" in metrics and "1Y volatility" in metrics
    # Concentration uses gross assets, so it must never exceed 100%.
    assert metrics["Top 5 concentration"]["value"] <= 100.01
    assert metrics["Largest position"]["value"] <= 100.01


async def test_key_stats_term_ids_map_to_catalogue(app_client):
    from app.services.help import HELP

    help_ids = {e["id"] for e in HELP}
    d = (await app_client.get("/api/v1/portfolio/stats")).json()
    metrics = {m["label"]: m for m in d["metrics"]}

    # Every metric except Positions carries a term_id that resolves in the catalogue.
    for m in d["metrics"]:
        if m["label"] == "Positions":
            assert m.get("term_id") is None  # self-explanatory count — no glossary term
            continue
        assert m.get("term_id") in help_ids, f"{m['label']} -> {m.get('term_id')}"

    # Specific mappings (XIRR & TWR share one term; the buckets share one; the two
    # concentration metrics share one).
    assert metrics["Money-weighted return (XIRR)"]["term_id"] == "term-xirr-twr"
    assert metrics["Time-weighted return (TWR)"]["term_id"] == "term-xirr-twr"
    assert metrics["Largest position"]["term_id"] == "term-concentration"
    assert metrics["Top 5 concentration"]["term_id"] == "term-concentration"
    for lbl in ("Cash & deposits", "Equities & ETFs", "Crypto", "Alternatives"):
        assert metrics[lbl]["term_id"] == "term-allocation-weight"


async def test_key_stats_term_id_is_purely_additive(app_client):
    # Regression: the term_id label must be ADDITIVE only — it may not perturb any
    # computed value, drop/rename a key, or reshape a metric. (Absolute demo values
    # aren't asserted here: the mock provider's prices aren't order-stable across the
    # full suite — the sibling endpoint test uses ≤100 invariants for the same reason.
    # Byte-identical value invariance for this edit was verified out-of-band with a
    # before/after capture of the full /stats payload.)
    d = (await app_client.get("/api/v1/portfolio/stats")).json()

    # term_id + basis (§12-R1 F-2 valuation-basis label) are additive fields beyond the original schema.
    allowed = {"label", "value", "kind", "signed", "note", "term_id", "basis"}
    for m in d["metrics"]:
        extra = set(m) - allowed
        assert not extra, f"{m['label']} has unexpected keys {extra}"
        assert {"label", "value", "kind"} <= set(m)

    metrics = {m["label"]: m["value"] for m in d["metrics"]}
    # Price-independent invariants that a perturbed weight/count computation would break.
    assert metrics["Positions"] == 14  # count of seeded holdings — independent of prices
    assert 0 <= metrics["Largest position"] <= metrics["Top 5 concentration"] <= 100.01


async def test_performance_respects_benchmark_param(app_client):
    r = await app_client.get("/api/v1/portfolio/performance?days=90&benchmark=GLD")
    assert r.status_code == 200
    assert r.json()["benchmark_symbol"] == "GLD"

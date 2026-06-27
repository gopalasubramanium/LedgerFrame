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


async def test_performance_respects_benchmark_param(app_client):
    r = await app_client.get("/api/v1/portfolio/performance?days=90&benchmark=GLD")
    assert r.status_code == 200
    assert r.json()["benchmark_symbol"] == "GLD"

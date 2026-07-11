# SPDX-License-Identifier: AGPL-3.0-or-later
"""Phase 2.3 — /metrics: Prometheus text, gated (loopback or authenticated)."""

from __future__ import annotations

from httpx import ASGITransport, AsyncClient


async def test_metrics_available_from_loopback(app_client):
    # The test client is loopback (127.0.0.1) → allowed. Make a request first so a counter exists.
    await app_client.get("/health")
    r = await app_client.get("/metrics")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/plain")
    body = r.text
    assert "ledgerframe_http_requests_total" in body
    assert "ledgerframe_http_request_duration_seconds_count" in body


async def test_metrics_denied_from_non_loopback_without_auth(app_client):
    app = app_client._transport.app
    async with AsyncClient(transport=ASGITransport(app=app, client=("203.0.113.9", 5000)),
                           base_url="http://test") as remote:
        r = await remote.get("/metrics")
        assert r.status_code == 403


async def test_metrics_allowed_from_non_loopback_with_valid_session(app_client):
    tok = (await app_client.post("/api/v1/auth/set-pin", json={"pin": "004321"})).json()["token"]
    app = app_client._transport.app
    async with AsyncClient(transport=ASGITransport(app=app, client=("203.0.113.9", 5000)),
                           base_url="http://test") as remote:
        r = await remote.get("/metrics", headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 200
        assert "ledgerframe_http_requests_total" in r.text


async def test_worker_job_outcomes_exposed_via_metrics(app_client):
    """Worker (separate process) records outcomes to a shared file; the API's /metrics
    reads and exposes them (§2.3)."""
    from app.core import metrics

    metrics.record_worker_job("market", "success")
    metrics.record_worker_job("market", "error")
    metrics.record_worker_job("history", "success")

    body = (await app_client.get("/metrics")).text
    assert 'ledgerframe_worker_job_runs_total{job="market",outcome="success"} 1' in body
    assert 'ledgerframe_worker_job_runs_total{job="market",outcome="error"} 1' in body
    assert 'ledgerframe_worker_job_runs_total{job="history",outcome="success"} 1' in body

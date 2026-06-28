"""The AI gathers the RIGHT facts for the question (markets vs net worth vs news),
not just watchlist quotes."""

from __future__ import annotations

import json


async def _fact_labels(app_client, question: str) -> list[str]:
    r = await app_client.post("/api/v1/ai/chat", json={"question": question})
    assert r.status_code == 200
    labels: list[str] = []
    for line in r.text.splitlines():
        if line.startswith("data:"):
            ev = json.loads(line[5:].strip())
            if ev.get("type") == "facts":
                labels = [f["label"] for f in ev["facts"]]
    return labels


async def test_markets_question_pulls_global_indices(app_client):
    labels = await _fact_labels(app_client, "How did the markets do today?")
    joined = " ".join(labels)
    assert "S&P 500" in joined or "Nasdaq 100" in joined or "Dow Jones" in joined


async def test_networth_question_pulls_assets_liabilities(app_client):
    labels = await _fact_labels(app_client, "What is my net worth?")
    assert any("Net worth" in label for label in labels)
    assert any("liabilities" in label.lower() for label in labels)


async def test_performance_question_pulls_risk_metrics(app_client):
    labels = await _fact_labels(app_client, "How is my portfolio performing and what's the risk?")
    joined = " ".join(labels).lower()
    assert "return" in joined and ("volatility" in joined or "drawdown" in joined)


async def test_general_question_anchors_with_portfolio(app_client):
    labels = await _fact_labels(app_client, "Give me an overview")
    assert any("Portfolio total value" in label for label in labels)

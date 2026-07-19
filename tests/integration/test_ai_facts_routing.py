# SPDX-License-Identifier: AGPL-3.0-or-later
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
    """A question with no specific intent still anchors on the headline figure.

    ⚠ This assertion PINNED A DEFECT. It read `"Portfolio total value"` — a D-021-retired
    term that `app/ai/tools.py:33` served to the user and fed to the model as grounded fact
    (AI-surfaces §0-H). The test was green for months **because it agreed with the defect**,
    and a copy pass that trusted the suite would have found nothing wrong.

    The term is now **Net worth**, resolved per context rather than by precedent: the value is
    `value_portfolio(...).total_value`, which sums every holding with no liability filter, and
    liabilities are stored negative — so it is liabilities-inclusive, which `GLOSSARY.md:65`
    defines as Net worth. (`networth_facts` had labelled the identical value correctly all
    along, one function away.)

    *Third test this programme has found pinning stale content* — page-help §9-5 found three at
    once, R-52 found one in `test_performance.py`. A test that asserts a wrong string is not
    coverage; it is the defect with a second signature.
    """
    labels = await _fact_labels(app_client, "Give me an overview")
    assert any("Net worth" in label for label in labels)

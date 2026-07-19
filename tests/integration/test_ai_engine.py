# SPDX-License-Identifier: AGPL-3.0-or-later
"""Part B: fact pack (B4), evidence model (B5), prompt builder (B6), and the
/ai/facts + /ai/grounding-status endpoints (Part C)."""

from __future__ import annotations


async def test_data_quality_facts_report_issues(app_client):
    # A pricing-health/data-quality question adds data_quality facts (the demo has an
    # unmapped mutual fund + manual assets).
    r = await app_client.get("/api/v1/ai/facts", params={"q": "which prices are stale or need mapping?"})
    facts = r.json()["facts"]
    dq = [f for f in facts if f.get("fact_type") == "data_quality"]
    assert dq, "expected data-quality facts for a pricing-health question"


def test_prompt_builder_includes_policy_intent_and_facts():
    from app.ai.intent import Intent
    from app.ai.prompt_builder import build_messages
    from app.schemas.ai import GroundingFact

    facts = [GroundingFact(label="Net worth", value="100,000 SGD")]
    msgs = build_messages("What changed today?", Intent.PORTFOLIO_MOVEMENT, facts)
    roles = [m.role for m in msgs]
    assert roles == ["system", "system", "user"]
    assert "only the facts" in msgs[0].content.lower() or "only the facts below" in msgs[0].content.lower()
    assert "100,000 SGD" in msgs[1].content              # fact pack rendered
    assert "Focus:" in msgs[2].content                    # intent focus appended


async def test_ai_facts_endpoint(app_client):
    r = await app_client.get("/api/v1/ai/facts", params={"q": "What changed in my portfolio today?"})
    assert r.status_code == 200
    body = r.json()
    assert body["intent"] == "portfolio_movement"
    assert body["count"] > 0 and body["facts"]
    assert "not financial advice" in body["disclaimer"].lower()


async def test_grounding_status_endpoint(app_client):
    s = (await app_client.get("/api/v1/ai/grounding-status")).json()
    assert s["grounded"] is True and "narration" in s


def test_evidence_model_fields():
    from app.schemas.ai import GroundingFact

    f = GroundingFact(label="x", value="1", fact_type="holding", currency="SGD",
                      related_symbols=["AAPL"], confidence="high")
    d = f.model_dump()
    assert d["fact_type"] == "holding" and d["related_symbols"] == ["AAPL"] and d["confidence"] == "high"


# --- B9: daily briefing enrichment ------------------------------------------ #

async def test_daily_briefing_includes_data_quality_and_concentration(app_client):
    await app_client.post("/api/v1/briefing/refresh")
    text = (await app_client.get("/api/v1/briefing")).json()["text"].lower()
    assert "not financial advice" in text
    # The demo is property-heavy + has an unmapped fund → concentration / data notes.
    assert "concentration" in text or "data to review" in text


# --- B10: grouped, deduped news --------------------------------------------- #

async def test_grouped_news_dedupes_and_groups(app_client):
    d = (await app_client.get("/api/v1/news/grouped")).json()
    assert "groups" in d and "total" in d
    # Each group's headlines are unique within the response.
    seen = set()
    for g in d["groups"]:
        assert g["name"] in {"My holdings", "India", "Singapore", "US", "Global", "Macro / FX"}
        for it in g["items"]:
            key = "".join(ch for ch in it["headline"].lower() if ch.isalnum())[:64]
            assert key not in seen
            seen.add(key)

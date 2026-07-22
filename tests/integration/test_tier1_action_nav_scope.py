# SPDX-License-Identifier: AGPL-3.0-or-later
"""TIER-1 ACTION/NAV SCOPE — R-54 W-5 (owner ruling 2026-07-22, 0a-ii loop-1).

A tier-1 (b)/(c) answer — "how do I add a holding", "how do I change the theme" — is SCOPED to
the top help hit + its labeled link, and NOTHING else. No portfolio headline figures, no second
help fact. The pointer IS the answer (W-4). Tier-2 grounding keeps the full pack (this is
MODE-scoped, never global), so a model still narrates from everything.

RULING: "Tier-1 (b)/(c) scope = the top help hit + its labeled link, nothing else. Guard: an
action/nav tier-1 answer carrying portfolio headline facts turns RED."

Driven at the SERVED pack (`POST /ai/chat`), which under the suite's default posture
(`LEDGERFRAME_AI_ENABLED=false` → tier 1) is exactly the tier the scope governs.

FAIL-FIRST: on the pre-W-5 build these answers carried `portfolio_facts` (Net worth, Unrealised
P/L, Today's change, Total return) PREPENDED plus a second/third help fact — seen RED here.
"""

from __future__ import annotations

import json

_HEADLINE = {"Net worth", "Unrealised P/L", "Today's change", "Total return"}


async def _facts_event(app_client, question: str) -> list[dict]:
    r = await app_client.post("/api/v1/ai/chat", json={"question": question})
    assert r.status_code == 200
    for line in r.text.splitlines():
        if line.startswith("data:"):
            e = json.loads(line[5:].strip())
            if e.get("type") == "facts":
                return e["facts"]
    raise AssertionError("no facts event")


async def test_action_answer_is_scoped_to_the_single_page_hit(app_client):
    """"how do I add a holding" → exactly one fact, Help · Holdings, pointing at the page."""
    facts = await _facts_event(app_client, "how do I add a holding")
    labels = [f["label"] for f in facts]
    assert labels == ["Help · Holdings"], f"action answer not scoped to the top page hit: {labels}"
    assert not (_HEADLINE & set(labels)), "an action/nav tier-1 answer must carry NO headline figures"
    assert facts[0]["link_id"] == "page:/holdings"


async def test_nav_answer_promotes_settings_over_a_fuzzy_match_and_scopes(app_client):
    """"how do I change the theme" → Help · Settings (NOT Heatmap), pointing at the appearance tab.

    The search ranker put Help · Heatmap first (it matches on "colour"); W-5 promotes the
    page-settings entry because the question names a Settings control ("theme" → appearance), so
    the scoped tier-1 pointer goes where the action happens.
    """
    facts = await _facts_event(app_client, "how do I change the theme")
    labels = [f["label"] for f in facts]
    assert labels == ["Help · Settings"], f"nav answer not scoped to the Settings hit: {labels}"
    assert not (_HEADLINE & set(labels))
    assert facts[0]["link_id"] == "page:/settings?tab=appearance"


async def test_nav_answer_INJECTS_settings_when_the_ranker_misses_the_control(app_client):
    """F-11 (owner ruling 2026-07-23, 3b finding 1(c)) — "how do I change the base currency" →
    Help · Settings pointing at the GENERAL tab, scoped, exactly like the "theme" case.

    THE DEFECT THIS PINS: for "theme" `search_help` surfaces the page-settings entry, so W-5's
    reorder had something to promote. For "base currency" `search_help` ranks Glossary currency
    terms above it and returns NO Settings entry at all (Gross assets / Realised P/L / Reports),
    so reordering promoted nothing and the answer fell through to the broad 8-fact portfolio pack —
    a settings-control question with no Settings link. The fix INJECTS the page-settings fact for
    the resolved tab when the ranker misses it.

    FAIL-FIRST: on the pre-fix build this is RED — `["Net worth", "Unrealised P/L", ...]`, a pack of
    eight, no `Help · Settings`, no `page:/settings?tab=general`.
    """
    facts = await _facts_event(app_client, "how do I change the base currency")
    labels = [f["label"] for f in facts]
    assert labels == ["Help · Settings"], f"base-currency nav answer not scoped to Settings: {labels}"
    assert not (_HEADLINE & set(labels)), "an action/nav tier-1 answer must carry NO headline figures"
    assert facts[0]["link_id"] == "page:/settings?tab=general"


async def test_settings_injection_covers_the_other_general_controls(app_client):
    """F-11 sibling-keyword coverage — the General tab's OTHER controls (timezone · long-term
    threshold · reporting currency) route to the same GENERAL tab, so the fix is the control-set,
    not one keyword. Blindness pin: if the injection ever regressed to promote-only, these (which
    the ranker also misses) would fall back to the broad pack and RED here."""
    for q in ("how do I change the timezone",
              "how do I set the long-term threshold",
              "how do I change my reporting currency"):
        facts = await _facts_event(app_client, q)
        labels = [f["label"] for f in facts]
        assert labels == ["Help · Settings"], f"{q!r} not scoped to Settings: {labels}"
        assert facts[0]["link_id"] == "page:/settings?tab=general", f"{q!r} -> {facts[0]['link_id']}"


async def test_term_answer_is_NOT_scoped_the_discriminator(app_client):
    """The scope is action/nav ONLY — a TERM answer (a) still carries its figures + headline.

    Without this, "scope everything to one fact" would pass the guards above while gutting the
    ratified tier-1(a) frame (explanation + the user's own XIRR/TWR).
    """
    labels = [f["label"] for f in await _facts_event(app_client, "what is XIRR")]
    assert "Help · XIRR & TWR" in labels
    assert _HEADLINE & set(labels), "a term answer keeps its headline context (not action/nav scope)"
    assert len(labels) > 1


async def test_tier2_keeps_the_full_pack_for_an_action_question(session):
    """MODE-scoped, not global: in GROUNDING (tier 2) the action question keeps the full pack so a
    model narrates from everything — only DETERMINISTIC (tier 1) scopes to the pointer."""
    from app.ai.tools import AnswerMode, gather_facts
    from app.seed.demo import seed_demo_data

    await seed_demo_data(session)
    await session.flush()

    tier1 = [f.label for f in await gather_facts(session, "how do I add a holding",
                                                 mode=AnswerMode.DETERMINISTIC)]
    tier2 = [f.label for f in await gather_facts(session, "how do I add a holding",
                                                 mode=AnswerMode.GROUNDING)]
    assert tier1 == ["Help · Holdings"], tier1
    assert _HEADLINE & set(tier2), "tier-2 must keep the full pack (headline figures) for narration"
    assert len(tier2) > len(tier1)

# SPDX-License-Identifier: AGPL-3.0-or-later
"""What the AI actually RETRIEVES from the help corpus — pinned against ranker drift.

AI-surfaces §9(a), which reframed the question it was given. The kickoff asked *"how do we
keep the grounding corpus fresh / regenerate it"*. The survey (§0-I) found there is nothing
to regenerate: the corpus is a **Python literal** (`app/services/help.py:14`), read by
`search_help` with **no cache, no index and no build step**. There is no cache, so there is
no drift to flush.

**The real exposure is the RANKER.** One source serves both the Help page and the AI
(`help.py:4-6`), but the AI consumes it *through* `search_help`, so **a ranking change is a
grounding change**. That is not hypothetical — `help.py:1311-1315` records it happening:
adding the *"What LedgerFrame is"* entry made `search_help("what is xirr")` return the
platform blurb first, so *"the AI would have answered a question about XIRR with the platform
blurb"*. `page-help.md:1084-1086` records the same event in the sharpest available words —
**"a ranking regression reached the AI before it reached the page."**

`tests/integration/test_help.py:147` asserts only that *some* help fact comes back. It would
have stayed green through that entire regression.

So this file pins **what the AI is actually handed**, for a fixed question set, on the AI's own
path (`help_facts` → `search_help(limit=3)`) rather than the page's. A ranker edit that changes
the AI's view now reds **on the AI path, by name**.

**Content currency is pinned here too**, because the corpus moved twice under this milestone's
feet: the Help milestone **rewrote the knowledge base** (the v1 entries were factually wrong)
and the Legal milestone **renamed Product Guarantees → Product Commitments** and rewrote the
entry-and-gate truth. `CURRENT.md:63-76` rules that no pre-2026-07-19 review of AI help-grounding
is still valid. These tests read the **post-rewrite, post-rename** corpus and fail if retired
vocabulary reappears in what the model is fed.

⚠ **Scope, stated rather than implied.** This pins the SERVER ranker, which is the one feeding
the model. `page-help.md:1071-1078` records that a **second, client-side ranker** exists for the
page's type-ahead and that the two *"could drift"*. This file cannot see that one; the divergence
remains a known, recorded gap and not something these greens should be read as covering.
"""

from __future__ import annotations

import pytest

from app.ai.tools import help_facts

# (question, entry id the AI must be handed). Chosen for what they protect, not for coverage:
#   - xirr        — the RECORDED regression (§0-I). A definition question must retrieve the
#                   definition, not the platform blurb.
#   - commitments — post-RENAME content (Legal milestone).
#   - acceptance  — post-LEGAL content: the gate is new truth the corpus has to carry.
#   - net worth   — the headline figure; the most consequential thing to mis-ground.
#   - allocation  — a "how do I" against a page entry, the shape most likely to be out-ranked
#                   by a glossary definition (the coverage-vs-tier case help.py:1338 documents).
RETRIEVAL_PINS = [
    ("what is xirr", "term-xirr-twr"),
    ("what are the product commitments", "page-legal"),
    ("why do I have to accept terms", "page-legal"),
    ("what is net worth", "page-net-worth"),
    ("how do I set a target allocation", "page-policy"),
]


def _retrieved_titles(question: str) -> list[str]:
    """The help titles the AI is handed — its own path, not the page's."""
    return [f.label.removeprefix("Help · ") for f in help_facts(question)]


def _titles_by_id() -> dict[str, str]:
    from app.services.help import HELP

    return {e["id"]: e["title"] for e in HELP}


@pytest.mark.parametrize("question,entry_id", RETRIEVAL_PINS, ids=[q for q, _ in RETRIEVAL_PINS])
def test_the_ai_retrieves_the_right_help_entry(question: str, entry_id: str):
    titles = _titles_by_id()
    assert entry_id in titles, (
        f"pinned entry id {entry_id!r} no longer exists in the corpus. Fix the pin deliberately — "
        "an entry disappearing is itself a grounding change."
    )
    expected = titles[entry_id]
    retrieved = _retrieved_titles(question)

    assert expected in retrieved, (
        f"For {question!r} the AI is handed {retrieved} — {expected!r} is not among them.\n"
        "A ranking change IS a grounding change: the AI reads the corpus through search_help, so "
        "this is the model being fed different facts, not a search-results cosmetic. "
        "help.py:1311-1315 records this exact failure reaching the AI before the page."
    )


def test_the_xirr_regression_specifically_cannot_recur():
    """The recorded incident, pinned as itself rather than as a general principle.

    Adding *"What LedgerFrame is"* once made `search_help("what is xirr")` return the platform
    blurb FIRST. `_STOPWORDS` fixed it. This asserts the ordering, not merely the membership —
    the entry the AI leads with is the one it answers from.
    """
    retrieved = _retrieved_titles("what is xirr")
    assert retrieved, "the AI was handed no help facts for a definition question"
    assert "xirr" in retrieved[0].lower() or "twr" in retrieved[0].lower(), (
        f"the AI leads with {retrieved[0]!r} for 'what is xirr'. This is help.py:1311-1315's "
        "regression recurring — the AI would answer a question about XIRR from whatever this is."
    )


def test_the_ai_is_never_fed_retired_vocabulary():
    """Post-RENAME currency, at the point the model actually sees the words.

    The Legal milestone renamed Product Guarantees → Product Commitments. `help.py` is not just
    page copy — `tools.py:145` feeds it to the model as fact, so a stale entry here teaches the
    AI retired vocabulary that then comes back out in prose no copy review reads.

    ⚠ The ordinary English word is NOT retired (GLOSSARY's deprecated table carves this out
    explicitly: *"indicative, not a guarantee of sale price or timing"* is plain English). Only
    the TERM is — hence the specific phrases rather than a bare word match.
    """
    questions = [q for q, _ in RETRIEVAL_PINS] + [
        "what will ledgerframe never do", "what are my rights", "is my data private",
    ]
    for question in questions:
        for fact in help_facts(question):
            body = fact.value.lower()
            for retired in ("product guarantees", "product guarantee ", "guarantee 5", "guarantee 7"):
                assert retired not in body, (
                    f"For {question!r} the AI is fed {fact.label!r}, whose body contains retired "
                    f"vocabulary {retired!r}. The rename was 2026-07-20 (page-legal §11-1); the "
                    "corpus the model reads must carry it too."
                )


def test_the_ai_receives_the_STRUCTURED_help_projection():
    """The widened projection (owner ruling 2026-07-20) — pinned, because it IS the grounding.

    `help_facts` carried `body` alone. It now carries the entry's MEANING unconditionally
    (`body` + `interpret`) plus a budgeted structural tail (`outputs`, `inputs`). What the model is
    handed is the grounding, so this shape is pinned: widening or narrowing it again must be a
    deliberate, visible change rather than a side effect of editing a projection helper.

    `search_help`'s own return shape is deliberately UNCHANGED — it is the Help page's
    search-result contract (`test_help.py` pins its four keys). Widening the AI's view was never a
    reason to change what the page's type-ahead receives.
    """
    from app.ai.tools import _HELP_FACT_CORE, _render_help_fact
    from app.services.help import HELP, strip_markup

    assert _HELP_FACT_CORE == ("body", "interpret"), (
        f"the core grounding tier changed to {_HELP_FACT_CORE}. Both fields are unconditional by "
        "ruling: dropping `interpret` under a budget is what hid the acceptance answer from the "
        "AI in the first place."
    )

    legal = next(e for e in HELP if e["id"] == "page-legal")
    rendered = _render_help_fact(legal)
    assert strip_markup(legal["body"]).strip() in rendered, "the body is missing from the fact"
    assert "Interpret:" in rendered, (
        "the interpret section is missing — this is the field the ruling exists to include."
    )
    assert "**" not in rendered, (
        "markdown markers reached the model (help.py:1352-1357 — the AI reads strings, never "
        "styling)."
    )


def test_the_widened_pack_stays_within_its_pinned_size():
    """"Scoped" is a size claim, so the size is asserted rather than trusted.

    The ruling widened the pack DELIBERATELY and BOUNDED. These numbers are measured against the
    corpus as it stands (largest rendered fact 3,254 chars, on `page-legal`). If a future entry
    pushes past them, that is a content decision to take knowingly — a prompt is a budget, and an
    unbounded fact pack crowds out the question it is supposed to answer.
    """
    from app.ai.tools import _HELP_FACT_BUDGET, _render_help_fact
    from app.services.help import HELP

    largest = max((len(_render_help_fact(e)), e["id"]) for e in HELP)
    assert largest[0] <= 4000, (
        f"the largest rendered help fact is now {largest[0]} chars ({largest[1]}). The pinned "
        "ceiling is 4000. Raise it deliberately, or shorten the entry."
    )
    assert _HELP_FACT_BUDGET == 3600, (
        f"the optional-tail budget changed to {_HELP_FACT_BUDGET}; it is pinned at 3600."
    )

    for question in ("why do I have to accept terms", "how do I set a target allocation",
                     "what is net worth"):
        total = sum(len(f.value) for f in help_facts(question))
        assert total <= 12000, (
            f"the help portion of the fact pack for {question!r} is {total} chars — past the "
            "pinned 12000 ceiling for three entries. The pack is crowding out the answer."
        )


def test_no_help_fact_is_truncated_mid_text():
    """Whole fields only: a caveat cut in half is worse than one never sent — it reads complete."""
    from app.ai.tools import _render_help_fact
    from app.services.help import HELP

    for entry in HELP:
        rendered = _render_help_fact(entry)
        if not rendered:
            continue
        assert not rendered.endswith(("…", "...")), (
            f"{entry['id']}'s help fact ends in an ellipsis — something was truncated. Fields are "
            "included WHOLE or not at all, precisely so a caveat can never stop mid-sentence."
        )


def test_the_legal_entry_the_ai_gets_KNOWS_ABOUT_THE_ACCEPTANCE_GATE():
    """THE FAIL-FIRST PROOF for the widened fact pack (owner ruling 2026-07-20).

    Post-LEGAL currency at the point the model sees it. `CURRENT.md:72-76` — an AI that describes
    entry without the consent gate is citing retired fact. Absence of retired words is not
    presence of current ones, so this is the positive half.

    Seen RED under the body-only projection: the AI was handed
    `['Help · Legal', 'Help · Help']` and not one of them contained the word "accept", because
    `page-legal`'s ruled *"Accepting the terms"* section lives in `interpret` — a field
    `help_facts` did not carry. The corpus held the answer; the model was handed the document's
    table of contents.
    """
    facts = help_facts("why do I have to accept terms")
    assert facts, "the AI was handed nothing for a question about acceptance"
    joined = " ".join(f.value.lower() for f in facts)
    assert "accept" in joined, (
        "the help facts the AI receives about entering the product never mention acceptance. "
        f"It was handed: {[f.label for f in facts]}"
    )
    assert "declin" in joined, (
        "the AI is not told that declining is a real answer — the ruled Legal copy says it is "
        "recorded and the app stays locked. An AI that omits it describes a different product."
    )


def test_the_retrieval_pins_are_not_vacuous():
    """Pinned against going blind: empty retrieval would satisfy nothing above except by luck."""
    for question, _ in RETRIEVAL_PINS:
        assert _retrieved_titles(question), (
            f"help_facts({question!r}) returned nothing — the AI's help grounding is silently "
            "off, and the pins above would be asserting membership in an empty list."
        )

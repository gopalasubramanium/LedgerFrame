# SPDX-License-Identifier: AGPL-3.0-or-later
"""SUBSTRING MATCHING IS NOT INTENT MATCHING — the R-54 §9-A word-boundary specimens.

R-54 §0-A found `gather_facts` routed on bare SUBSTRING membership (`app/ai/tools.py:561-576`,
`has(*ws)` → `any(w in q for w in ws)`), so a fact source fired on a fragment inside an unrelated
word:

    "los"  ⊂ c-LOS-ed, LOS-t, LOS-e        → movers facts on a question about closed-end funds
    "own"  ⊂ d-OWN-load, d-OWN-grade, kn-OWN → holdings facts on "how do I download my data"
    "down" ⊂ DOWN-load, DOWN-grade          → movers facts, same questions
    "mov"  ⊂ re-MOV-e                       → movers facts on "remove a holding"
    "spread" ⊂ SPREAD-sheet                 → allocation facts on an export question

**Why this is a correctness defect and not untidiness.** Tier-1's entire claim is DETERMINISM, and
these matches are deterministic — they are reliably WRONG, which is worse than noisy. A user asking
a pure help question ("how do I download my data") was handed their gainers and detractors as the
grounded basis of the answer, and the model was told those facts were relevant. The pack is capped
at 20 (`_dedupe`, `tools.py:523`), so junk facts do not merely sit there: **they evict real ones.**

ASSERTED AT THE SERVED PACK, NOT AT THE HELPER — the F5/Finding-5 lesson (`ai-surfaces.md` §15-1,
`test_ai_fact_pack_canonical.py`): the defect is a routing bypass, so a test of the matcher in
isolation can pass while the pack served to the panel still carries the junk. These drive
`POST /ai/chat` and read the `facts` event the panel actually renders.

RULED at the R-54 §9 one-pass (chat, 2026-07-20): `classify_intent`'s closed enum is the SINGLE
intent authority, `gather_facts`' flags become derivations of it in ONE table, and matching is
WORD-BOUNDARY. Owner: "A single source of truth for intent resolution prevents contradictory
states; deterministic matching is superior to probabilistic guessing for core navigation."

FAIL-FIRST: every assertion here was seen RED on the pre-fix build (r54 Phase 0-1).
"""

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


def _movers(labels: list[str]) -> list[str]:
    """Movers facts are labelled `Gainer …` / `Detractor …` (`app/ai/tools.py:104,107`)."""
    return [x for x in labels if x.startswith("Gainer ") or x.startswith("Detractor ")]


def _allocation(labels: list[str]) -> list[str]:
    """Allocation facts are labelled `Allocation — <served class label>` (F-7, 2026-07-22 —
    the `(asset_class)` token + raw enum left user copy; `app/ai/tools.py::allocation_facts`)."""
    return [x for x in labels if x.startswith("Allocation — ")]


async def test_download_question_does_not_pull_movers_or_holdings(app_client):
    """"down" ⊂ "download" and "own" ⊂ "download" — TWO false triggers in one word.

    This is the specimen that names the defect best: a pure product-usage question, answerable
    from Help alone, that fired the movers AND holdings fact sources because the word "download"
    happens to contain "down" and "own".
    """
    labels = await _fact_labels(app_client, "How do I download my data?")
    assert not _movers(labels), (
        f'"download" pulled movers facts via the "down"/"own" substrings: {_movers(labels)}'
    )


async def test_closed_end_fund_question_does_not_pull_movers(app_client):
    """"los" ⊂ "closed" — a definitional question routed as a market-movement question."""
    labels = await _fact_labels(app_client, "What is a closed-end fund?")
    assert not _movers(labels), (
        f'"closed" pulled movers facts via the "los" substring: {_movers(labels)}'
    )


async def test_downgrade_question_does_not_pull_movers(app_client):
    """"down" and "own" ⊂ "downgraded"."""
    labels = await _fact_labels(app_client, "What does it mean when a bond is downgraded?")
    assert not _movers(labels), (
        f'"downgraded" pulled movers facts via the "down"/"own" substrings: {_movers(labels)}'
    )


async def test_spreadsheet_question_does_not_pull_allocation(app_client):
    """"spread" ⊂ "spreadsheet" — an export question routed as an allocation question."""
    labels = await _fact_labels(app_client, "Can I open the export in a spreadsheet?")
    assert not _allocation(labels), (
        f'"spreadsheet" pulled allocation facts via the "spread" substring: {_allocation(labels)}'
    )


async def test_remove_a_holding_does_not_pull_movers(app_client):
    """"mov" ⊂ "remove".

    Note this question DOES legitimately concern holdings — the defect under test is the MOVERS
    source firing on "remove", which has nothing to do with the day's gainers and losers.
    """
    labels = await _fact_labels(app_client, "How do I remove a holding I entered by mistake?")
    assert not _movers(labels), (
        f'"remove" pulled movers facts via the "mov" substring: {_movers(labels)}'
    )

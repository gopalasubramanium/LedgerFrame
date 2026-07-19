# SPDX-License-Identifier: AGPL-3.0-or-later
"""AC-L6 — THE SCOPED-CAVEAT REGISTRY (page-legal §9-2, owner 2026-07-19; D-106).

THE FAILURE THIS EXISTS TO PREVENT is not a bug. It is a REVIEWER BEING DILIGENT.

CLAUDE.md's hard rule reads: *"Every piece of information has ONE canonical page. Other pages may
summarize it with a link, never duplicate it."* The Legal page is now the canonical home for the
product-level position. A future reviewer applying that rule honestly, in good faith, at speed,
will see twenty-five served `disclaimer` strings scattered across the services and read them as
twenty-five copies of the thing Legal now owns. Deleting them would look like tidying. It would
pass review. It would shrink the diff.

**It would also be the single largest honesty regression the product could suffer**, and §9-2
rules it out in advance:

* a **scoped caveat** is served by the reader that owns a figure, sits at the point of use, and is
  **part of the figure** — it says what THAT number is and is not, where you read it;
* the **product-level position** is stated once, on Legal;
* one-canonical-home governs the second and **not** the first;
* therefore **removing a scoped caveat is an HONESTY REGRESSION, not a de-duplication.**

A rule recorded in a plan file cannot stop that reviewer. A RED test can.

WHY THIS IS DISCOVERED, NOT LISTED
----------------------------------
The page-legal §0-D survey enumerated **ten** surfaces by hand. Discovery finds **twenty-five**.
The survey was not careless — it read the ten that serve a page-facing reader, and missed the
grounding pack, the analytics readers, statements, review, scenarios, runway, liquidity, policy and
tags. That gap is the argument: **a hand-written registry protects what its author happened to
remember, and silently abandons the rest.** So the floor below is generated from the tree, and the
guard asserts the count never falls — which protects the caveats nobody has thought about yet.

Additions are free and unguarded: this is a FLOOR, not a fixed set. Nothing here discourages a new
caveat, and everything here notices a deleted one.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
APP = REPO / "app"

# A served scoped caveat, as it appears in the source: a `"disclaimer"` mapping key.
_SERVED_CAVEAT = re.compile(r'"disclaimer"\s*:')


def _discover() -> dict[str, int]:
    """{repo-relative path: served-caveat count} across the backend."""
    found: dict[str, int] = {}
    for p in sorted(APP.rglob("*.py")):
        n = len(_SERVED_CAVEAT.findall(p.read_text(encoding="utf-8", errors="ignore")))
        if n:
            found[str(p.relative_to(REPO))] = n
    return found


# ---------------------------------------------------------------------------------------------
# THE FLOOR — recorded 2026-07-19 at the Legal Phase-0 build, from the tree as it then stood.
#
# Regenerate ONLY when a caveat is deliberately retired with a ruling to point at. Editing this
# dict to make a red test green is the exact move the module exists to stop; if you are here
# because a number went down, the question is not "what is the new number" but "who decided that
# figure no longer needs to say what it is not, and where is that written".
# ---------------------------------------------------------------------------------------------
CAVEAT_FLOOR: dict[str, int] = {
    "app/ai/grounding.py": 5,
    "app/api/v1/routes/ai.py": 1,
    "app/services/accounts.py": 1,
    "app/services/analytics.py": 2,
    "app/services/confidence.py": 1,
    "app/services/contributions.py": 1,
    "app/services/estate.py": 1,
    "app/services/insurance.py": 1,
    "app/services/liquidity.py": 1,
    "app/services/planning.py": 2,
    "app/services/policy.py": 1,
    "app/services/review.py": 2,
    "app/services/runway.py": 1,
    "app/services/scenarios.py": 1,
    "app/services/statements.py": 1,
    "app/services/tags.py": 1,
    "app/services/tax.py": 2,
}

# Caveats that are NOT a `"disclaimer":` mapping key and so cannot be discovered by the scan.
# Listed individually BECAUSE the scan cannot see them — the one honest reason to hand-list.
# ⊕ AMENDED 2026-07-20 (AI-surfaces Phase 0.1; page-legal §14-E). `app/schemas/ai.py` MOVED OUT of
# this tuple and into its own test below. It is not retired — it is checked HARDER. See §14-E.
_UNDISCOVERABLE: tuple[tuple[str, str], ...] = (
    ("frontend/src/routes/Estate.tsx", "A record and reminders, never legal advice."),
    ("app/services/tax.py", "Open lots by FIFO. Organisation only — not tax advice."),
    ("app/services/confidence.py",
     "Data-quality signal only — how well-sourced each value is. Not advice."),
)


def test_the_scanner_can_still_see_the_caveats():
    """The registry's OWN health check — the part allowed to fail.

    A scanner that drifts (the key is renamed, the services move) finds ZERO, and zero is
    indistinguishable from "every caveat was legitimately retired". Every floor guard needs the
    check that proves it is still looking at something.
    """
    found = _discover()
    assert found, (
        "discovered ZERO served caveats across app/ — the scanner has gone blind, and AC-L6 is "
        "now a test that passes because it never looks."
    )
    assert sum(found.values()) >= sum(CAVEAT_FLOOR.values())


@pytest.mark.parametrize("path", sorted(CAVEAT_FLOOR), ids=lambda p: p)
def test_no_scoped_caveat_was_removed(path: str):
    """AC-L6. Per-file, so a failure names WHERE the honesty was lost.

    Seen RED before landing, by deleting the Confidence reader's caveat
    (*"Data-quality signal only — how well-sourced each value is. Not advice."*) — the exact
    edit a one-canonical-home reading would produce.
    """
    found = _discover().get(path, 0)
    floor = CAVEAT_FLOOR[path]
    assert found >= floor, (
        f"A SCOPED CAVEAT WAS REMOVED from {path} ({found} found, {floor} expected).\n"
        f"\n"
        f"Removing one is an HONESTY REGRESSION, not a de-duplication (page-legal §9-2, D-106).\n"
        f"A scoped caveat is PART OF THE FIGURE — it states what that number is and is not, at the\n"
        f"point the user reads it. The Legal page owns the product-level position ONLY; it does\n"
        f"not own, absorb, shorten or replace these, and no figure should travel without the limit\n"
        f"it was published under.\n"
        f"\n"
        f"If a caveat is being retired deliberately, that needs a ruling to cite — then lower the\n"
        f"floor in the same commit, citing it."
    )


@pytest.mark.parametrize("path,text", _UNDISCOVERABLE, ids=[p for p, _ in _UNDISCOVERABLE])
def test_the_named_caveats_are_still_worded_as_they_ship(path: str, text: str):
    """Four caveats guarded by their WORDS, not their presence.

    The count guard above cannot tell a caveat that was rewritten into meaninglessness from one
    left alone — a `"disclaimer"` key whose value became "See the Legal page." still counts as one.
    The load-bearing specimens: the Estate subtitle (rendered client-side, so no backend scan
    reaches it), the FIFO tax-lot caveat that exports carry into the file, and Confidence's — the
    one this guard's RED specimen deletes.

    *(The AI's fixed information-only line was a fourth entry here until 2026-07-20; it now has a
    stronger test of its own, immediately below.)*
    """
    src = (REPO / path).read_text(encoding="utf-8")
    assert text in src, (
        f"{path} no longer carries its scoped caveat verbatim:\n  {text!r}\n"
        f"See page-legal §9-2 / D-106 — this is an honesty regression unless a ruling says "
        f"otherwise."
    )


def test_the_ai_fixed_disclaimer_still_SHIPS_its_exact_wording():
    """The AI's fixed information-only line — guarded by its SHIPPED VALUE, not its spelling.

    ⊕ AMENDED 2026-07-20 (AI-surfaces Phase 0.1, page-legal §14-E). This was an `_UNDISCOVERABLE`
    entry asserting the literal appeared in `app/schemas/ai.py`'s source. Phase 0.1 turned the
    thirteen scattered literals of this sentence into ONE constant (`app/core/disclaimer.py`),
    because Commitment 2 promises the disclaimer is **FIXED** — a claim about identity across
    paths that thirteen independent literals could only satisfy by coincidence.

    That made the old assertion red on a file whose SERVED VALUE had not changed by a byte. The
    honest fix is not to delete the guard and not to reinstate the duplicate: it is to check the
    thing that was always meant — **what ships** — instead of the spelling of the line that
    produces it. A source-literal check could never have caught `disclaimer: str = "See Legal."`
    being introduced *elsewhere*; this resolves the actual default the schema carries.

    Strictly stronger than what it replaces, on the registry's own terms: the old test would pass
    if the literal sat in a comment, and would fail on a rename that changed nothing the user
    reads. This one does neither.

    ⚠ Commitment 2's line is the PRODUCT-LEVEL position (D-106 kind (b)) and is the one thing this
    module's consolidation warning does NOT cover — §9(c) authorised centralising it, and only it.
    The scoped caveats (kind (a)) above are untouched and must stay that way.
    """
    from app.core.disclaimer import DISCLAIMER
    from app.schemas.ai import AIAnswer

    text = "Information only, not financial advice."
    assert text == DISCLAIMER, (
        f"the fixed information-only disclaimer has been reworded: {DISCLAIMER!r}. Commitment 2 "
        "names it; rewording it is a change to what the product promises, not a copy edit."
    )
    assert AIAnswer.model_fields["disclaimer"].default == text, (
        "app/schemas/ai.py no longer SHIPS the fixed information-only disclaimer as its default: "
        f"{AIAnswer.model_fields['disclaimer'].default!r}\n"
        "See page-legal §9-2 / D-106 — this is an honesty regression unless a ruling says "
        "otherwise."
    )


def test_legal_does_not_claim_to_own_the_scoped_caveats():
    """The other direction, and the one a count cannot catch.

    AC-L6 would be satisfied by a Legal page that left all twenty-five in place while TELLING the
    reader they are superseded. §9-2 rules Legal owns the product-level position **only**, so the
    page must not present itself as the home for the limits on individual figures.
    """
    from app.services.help_markup import strip_markup
    from app.services.legal import all_legal

    # Walks CLAUSES and SUB-CLAUSES since the formal register (page-legal §11-4): an overreach
    # buried in one sub-clause is exactly as damaging as one in a heading, and a guard that only
    # read clause text would miss the lettered items entirely.
    d = all_legal()
    parts = [strip_markup(d["preamble"])]
    for s in d["sections"]:
        for c in s["clauses"]:
            parts.append(strip_markup(c["text"]))
            parts.extend(strip_markup(i) for i in c["items"])
    blob = " ".join(parts).lower()
    for overreach in ("supersedes", "replaces the", "instead of the notes",
                      "all disclaimers are", "the only disclaimer"):
        assert overreach not in blob, (
            f"Legal's copy claims authority over the scoped caveats ({overreach!r}). It owns the "
            f"product-level position ONLY (page-legal §9-2)."
        )

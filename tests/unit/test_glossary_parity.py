# SPDX-License-Identifier: AGPL-3.0-or-later
"""GLOSSARY PARITY GUARD (page-heatmap §13-1, owner-approved at the close 2026-07-13).

The glossary lives in TWO stores: ``docs/specs/GLOSSARY.md`` (canonical — the file CLAUDE.md's hard
rule names: *"every term shown to users must exist in GLOSSARY.md with that exact spelling"*) and
``frontend/src/mocks/glossary.ts`` (the data the ``[Help]`` popover actually renders). page-heatmap
ND-11 shipped a term to the SECOND store only while the build record claimed the FIRST; the drift was
invisible until an owner walk caught it. Vigilance did not hold the invariant, so this guard does.

PLACEMENT RATIONALE (recorded per the close):
* NOT the dev-only smoke suite — this is hermetic (two files on disk; no server, DB or browser;
  deterministic). The smoke convention exists for checks that need the LIVE app. A guard that cannot
  run in CI cannot block the drift it exists to catch.
* NOT Vitest, despite guarding a frontend file. Reading the spec from `frontend/` needs either
  ``@types/node`` (a NEW DEPENDENCY — CLAUDE.md requires an ADR) or relaxing Vite's
  ``server.fs.allow`` outside the frontend root (widening the dev server's filesystem access for a
  docs check — verified: Vite rejects the import with "Denied ID"). Neither is worth it.
* pytest already runs in CI, reads both files with the stdlib, and is the natural home for
  repo-wide spec-vs-code invariants — the same posture as the API-contract drift check.

THE THIRD STORE (page-help §9-2, ruled 2026-07-19)
---------------------------------------------------
This guard was written for TWO stores. Reading the engine for the Help page found a THIRD:
``app/services/help.py``'s ``category: "Terms"`` entries — what ``GET /api/v1/help`` serves AND
what the AI cites as fact (``app/ai/tools.py`` pulls them into the grounded fact pack). It was
unguarded, and it had drifted exactly as the two-store lesson predicts:

    the popover store and the served store shared 2 term ids out of 90.

They were not two copies of one vocabulary; they were two vocabularies with SILENT ALIASES for
the same concept — ``term-runway``/``term-cash-runway``, ``term-confidence``/``term-data-confidence``,
``term-realised-gains``/``term-realised-pl`` (the last carrying wording D-026 had already
deprecated). Nothing could see it, because each store was only ever compared to itself.

``GLOSSARY.md`` is now the ENFORCED PARENT of both code stores. That is not a new rule — the
spec's own preamble already says so (*"Terms marked [Help] have a full what/why/improves entry in
the in-app Help catalogue"*); it simply had no mechanism. This is the mechanism.

*Generalise, again: when the two-store guard finds a third store, the answer is not a third
pairwise check — it is one parent every store is measured against.*
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
SPEC = REPO / "docs" / "specs" / "GLOSSARY.md"
POPOVER = REPO / "frontend" / "src" / "mocks" / "glossary.ts"

# Entries look like:  term: "Net worth",
_TERM = re.compile(r'^\s*term:\s*"([^"]+)"', re.MULTILINE)


def _popover_terms() -> list[str]:
    return _TERM.findall(POPOVER.read_text(encoding="utf-8"))


def test_the_two_glossary_stores_both_exist():
    assert SPEC.is_file(), SPEC
    assert POPOVER.is_file(), POPOVER
    assert _popover_terms(), "no terms parsed from the popover data — the parser has drifted"


def _served_terms() -> list[tuple[str, str]]:
    """(id, title) for every `category: "Terms"` entry in the served help catalogue."""
    from app.services.help import HELP

    return [(e["id"], e["title"]) for e in HELP if e["category"] == "Glossary"]


# §9-2(e) — ENTRY HEADINGS, NOT TERMS. A help entry may cover several glossary terms under one
# heading ("XIRR & TWR" explains two; "FIFO (first-in, first-out)" is a term plus its expansion).
# Those headings are not user-facing TERMS and cannot be required to exist in GLOSSARY.md verbatim.
# They are exempt BY NAME WITH A REASON — never by silence, and never by loosening the match.
_HEADING_NOT_A_TERM = {
    "Entitlement & stale": "covers two terms (Entitlement, Stale) under one heading",
    "XIRR & TWR": "covers two terms (XIRR, TWR) under one heading",
    # The two rows that sat here — "Realised gains & tax lots" (D-026) and "Total value" (D-021) —
    # were DEPRECATED TERMS, not headings. Their exemptions EXPIRED in the content pass, as written:
    # the entries are now "Realised P/L" and "Gross assets", both of which pass on their own merit.
    "FIFO (first-in, first-out)": "term plus its parenthetical expansion",
    "Income (dividends & interest)": "term plus its parenthetical expansion",
    "1-year return": "a windowed instance of Period return, not a distinct term",
    "1-year volatility": "a windowed instance of Volatility, not a distinct term",
    "Maximum drawdown (1-year)": "a windowed instance of Maximum drawdown",
    "Allocation weights": "plural heading over the Allocation weight term",
    "Beta": "portfolio-metric heading; the term itself is post-release (Tier 3, §9-5)",
    "Correlation": "portfolio-metric heading; term post-release (Tier 3)",
    "Downside deviation": "portfolio-metric heading; term post-release (Tier 3)",
    "Information ratio": "portfolio-metric heading; term post-release (Tier 3)",
    "Tracking error": "portfolio-metric heading; term post-release (Tier 3)",
    "HHI (concentration)": "term plus its parenthetical expansion",
    "Estimated ongoing cost": "portfolio-metric heading; term post-release (Tier 3)",
}


def test_the_served_help_store_exists_and_parses():
    assert _served_terms(), "no Terms entries parsed from app/services/help.py"


@pytest.mark.parametrize("term_id,title", _served_terms())
def test_served_help_term_exists_in_the_spec_or_is_a_declared_heading(term_id: str, title: str):
    """§9-2(c) — the SERVED store is measured against GLOSSARY.md, same as the popover store.

    This is the guard that makes the three-store drift build-breaking. It is deliberately the
    SAME assertion as the popover check (`**Term**` present in the spec) so the two stores cannot
    diverge in what "parity" means.
    """
    if title in _HEADING_NOT_A_TERM:
        pytest.skip(f"declared entry heading, not a term: {_HEADING_NOT_A_TERM[title]}")
    spec = SPEC.read_text(encoding="utf-8")
    assert f"**{title}**" in spec, (
        f'"{title}" ({term_id}) is served to users by GET /api/v1/help — and cited by the AI — '
        f"but is NOT in docs/specs/GLOSSARY.md with that exact spelling. Add it to the SPEC "
        f"first (page-heatmap §13-1), or declare it in _HEADING_NOT_A_TERM with a reason."
    )


def test_the_two_code_stores_use_ONE_id_per_concept():
    """§9-2(d) — no silent aliases. Two ids for one concept is how the stores drifted apart.

    A concept present in BOTH code stores must carry the SAME id in both. This is asserted by
    TITLE: if the popover and the catalogue both define "Cash runway", they must agree on its id.
    Seen RED on the three known aliases before the reconciliation landed.
    """
    popover = POPOVER.read_text(encoding="utf-8")
    # id -> term, from  "term-cash-runway": { term: "Cash runway",
    pairs = re.findall(r'"(term-[a-z0-9-]+)":\s*\{\s*term:\s*"([^"]+)"', popover)
    popover_by_title = {title: tid for tid, title in pairs}
    assert popover_by_title, "popover id→term parser has drifted"

    drift = [
        f'"{title}": popover uses {popover_by_title[title]!r}, served store uses {tid!r}'
        for tid, title in _served_terms()
        if title in popover_by_title and popover_by_title[title] != tid
    ]
    assert not drift, (
        "SILENT ALIAS — the same concept carries different ids in the two code stores:\n  "
        + "\n  ".join(drift)
        + "\nOne concept, one id (page-help §9-2d)."
    )


# KNOWN BLIND SPOT of the check above, recorded rather than left implicit: it joins the two stores
# BY TITLE, so it can only see an alias whose title still agrees. The third known alias —
# `term-realised-gains` "Realised gains & tax lots" vs `term-realised-pl` "Realised P/L" — had
# drifted in BOTH id and title, so the title join cannot reach it. What catches that class is the
# DEPRECATED-WORDING guard (D-026), which ships with the content pass (delta 3) because it goes red
# on content, not on ids. *A guard's blind spot belongs in writing next to the guard.*


@pytest.mark.parametrize("term", _popover_terms())
def test_popover_term_exists_in_the_spec_with_identical_spelling(term: str):
    """Every term the [Help] popover renders must be in docs/specs/GLOSSARY.md, spelled identically.

    Terms are the bolded first cell of a GLOSSARY.md table row: ``| **Net worth** | … |``.
    """
    spec = SPEC.read_text(encoding="utf-8")
    assert f"**{term}**" in spec, (
        f'"{term}" is rendered to users by the [Help] popover but is NOT in docs/specs/GLOSSARY.md '
        f"with that exact spelling. Add it to the SPEC (the canonical store) — never to the frontend "
        f"data alone (page-heatmap §13-1)."
    )


# ---------------------------------------------------------------------------
# §9-bis-8(c) — THE TIER-3 VISIBILITY COUNTER (page-help, 2026-07-19)
#
# R-51 defers the ~44 `[Help]`-marked-but-unserved terms to POST-RELEASE, and §9-bis-2 upholds
# that deferral. Both rest on ONE stated mechanism: *"the parity guard reports the
# marked-but-unserved count as a non-blocking number"*, so the gap stays visible instead of going
# quiet. **That counter was never written.** The deferral has therefore been resting on a
# mechanism that did not exist. Written here.
#
# It is NON-BLOCKING BY DESIGN: the gap is ruled acceptable, so a gap must never fail the suite.
# What it DOES assert is that the counter itself still works — because the only thing worse than
# no counter is a broken one reading 0, which looks exactly like a closed gap.
# ---------------------------------------------------------------------------

_HELP_MARKED_ROW = re.compile(r"^\|\s*\*\*([^*|]+)\*\*\s*\|.*\*\*\[Help\]\*\*", re.MULTILINE)


def _help_marked_terms() -> list[str]:
    """Terms whose GLOSSARY.md row carries the **[Help]** promise of a catalogue entry."""
    spec = SPEC.read_text(encoding="utf-8")
    body = spec.split("## Deprecated terms")[0]  # a retired term promises nothing
    return [t.strip() for t in _HELP_MARKED_ROW.findall(body)]


def test_the_tier3_counter_can_still_see_both_sides():
    """The counter's OWN health check — this is the part that is allowed to fail.

    A parser that drifts (GLOSSARY's row format changes, the marker is restyled, help.py's
    category string is renamed) reports **zero unserved terms**, which is indistinguishable from
    "R-51 is complete". That silent-success mode is the whole risk of a non-blocking counter, so
    both sides are asserted non-empty here and nowhere else.
    """
    marked = _help_marked_terms()
    served = _served_terms()
    assert marked, (
        "parsed ZERO [Help]-marked terms from GLOSSARY.md — the marker or row format has drifted. "
        "The Tier-3 counter is now blind and would silently report the gap as closed."
    )
    assert served, "parsed ZERO served Terms entries from app/services/help.py — parser drifted."


def test_REPORT_the_tier3_marked_but_unserved_count():
    """NON-BLOCKING. Prints the R-51 / §9-bis-2 gap. This test does not fail on the gap.

    Run with ``-s`` (or read the captured output of a failing run) to see the number.

    **The number is an UPPER BOUND, and saying so is part of reporting it honestly.** Two reasons
    it overstates: (1) one catalogue entry may legitimately cover several marked terms under one
    heading (``XIRR & TWR``) — those are declared in ``_HEADING_NOT_A_TERM``; (2) some ``[Help]``
    marks are **PROPOSED, not RATIFIED**, so the platform never actually promised them. R-51 says
    the genuinely-owed count *"must be counted, not assumed"* — this reports the bound, it does
    not adjudicate it.
    """
    marked = _help_marked_terms()
    served_titles = {title for _id, title in _served_terms()}
    unserved = sorted(t for t in marked if t not in served_titles)

    print(
        f"\n[R-51 / §9-bis-2 Tier-3 visibility counter — NON-BLOCKING]\n"
        f"  [Help]-marked terms in GLOSSARY.md : {len(marked)}\n"
        f"  served as catalogue Terms entries  : {len(served_titles)}\n"
        f"  marked but UNSERVED (upper bound)  : {len(unserved)}\n"
        f"  post-release per ROADMAP R-51; deferral ruled acceptable BECAUSE this stays visible.\n"
        + "".join(f"    - {t}\n" for t in unserved)
    )

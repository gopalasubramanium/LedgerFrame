# SPDX-License-Identifier: AGPL-3.0-or-later
"""AC-L7 — LEGAL'S COPY JOINS THE ACCURACY CORPUS (page-legal §9-3, owner 2026-07-19).

§9-3's deciding rationale was that **served copy inherits the Help truth bar**. That is a claim
about guards, and a claim about guards is worth exactly the guards that exist. This module is the
payment: the same bar `tests/unit/test_help_content_accuracy.py` holds Help to, applied to Legal.

Same bar means the same three things, and the FIRST is not optional:

* **markup-stripped text**, always. `help_markup.py` records why this is a safety property rather
  than a tidy-up: an inline marker inside a phrase separates its words, so `you **should**` does
  not contain "you should" and the platform's central no-advice guarantee could be broken *in
  bold* by a green suite;
* **advice-free**, across every string;
* **no decision IDs and no implementation notes** in served prose (page-chrome §11-8).

THE EXEMPTION IS GONE — AND THAT IS THE POINT (page-legal §11-2, owner, 2026-07-20)
-----------------------------------------------------------------------------------
This module used to carry a **named, scoped, self-measuring exemption**. The seven Commitments
failed the Help bar on two counts, inherently: four cited a decision ID — `(D-077)`, `(D-004)`,
`(D-016)`, `(D-071)` — and Commitment 1 contained the word "endpoints". It was a genuine collision
between two live rules (AC-L3 rules the Commitments **verbatim**; page-chrome §11-8 bars decision
IDs from served prose), and the 0a flagged it for the owner because **no edit available to the
build could satisfy both** — the only edit that would was an edit to the ratified source.

**The owner authorized that edit.** `PRODUCT-SPEC.md` §3 was cleaned: the parenthetical IDs became
non-rendered annotations below the blockquote, the backticked identifier became the label the
Settings control actually carries, the document-internal cross-reference was made self-contained,
and *"No order endpoints exist"* became *"has no mechanism for doing so"*. AC-L3 carried every one
of those to the served copy automatically, which is exactly what that guard was built to do.

**So the exemption is DELETED rather than narrowed, and the bar below now runs unexempted over
every string on the page — authored and verbatim alike.** The two tests that measured the
exemption's width are deleted with it: an exemption that no longer exists cannot be measured, and
leaving a green test named after it would be a monument to a problem that was solved.

**Why the corpus split survives the exemption's deletion.** `_authored()` and `_verbatim()` are
still separate, and still tested separately, because they differ in **who may edit them** even now
that they meet the same bar: authored strings are this milestone's, and verbatim strings are the
spec's — a red on the second means *"go amend PRODUCT-SPEC.md"*, never *"reword it here"*. The
split stopped being about latitude and is now about provenance.
"""

from __future__ import annotations

import re

import pytest

from app.services.help_markup import strip_markup
from app.services.legal import all_legal

# --- The corpus, split by WHO AUTHORED IT ------------------------------------------------------ #
# The split IS the guard's design. Merging them would let the verbatim block's exemption silently
# cover authored prose, which is the failure mode an exemption always has.


def _authored() -> list[tuple[str, str]]:
    """Every string this milestone WROTE. Held to the full Help bar, no exemptions."""
    d = all_legal()
    out = [(f"section:{s['id']}", strip_markup(s["body"])) for s in d["sections"]]
    out += [(f"section-title:{s['id']}", s["title"]) for s in d["sections"]]
    out.append(("commitments:title", d["commitments"]["title"]))
    out.append(("commitments:intro", strip_markup(d["commitments"]["intro"])))
    out += [(f"pointer:{p['file']}", strip_markup(p["what"])) for p in d["pointers"]]
    out.append(("pack_footer", strip_markup(d["pack_footer"])))
    return out


def _verbatim() -> list[tuple[str, str]]:
    """The seven Commitments — ratified elsewhere, reproduced here, not editable by this build."""
    return [(f"commitment:{i}", strip_markup(g))
            for i, g in enumerate(all_legal()["commitments"]["items"], 1)]


# The Help bar, copied deliberately rather than imported: importing would couple Legal's floor to
# a module that may narrow for Help's own reasons, and a shared mutable bar is how one page's
# exception becomes another page's silent relaxation.
_ADVISORY = ("you should", "we recommend", "aim for", "a good value", "you must",
             "advise", "the best way to")
_IMPLEMENTATION = ("response_model", "privacy_mode", "/api/", "endpoint", "localstorage",
                   "refdata", "asset_class", "server-side")
_DECISION_ID = re.compile(r"\b[DP]-\d{3}\b|\bND-\d+\b|§")


@pytest.mark.parametrize("where,text", _authored(), ids=[w for w, _ in _authored()])
def test_authored_legal_copy_meets_the_full_help_bar(where: str, text: str):
    """No exemptions. Every string this build wrote.

    Seen RED writing it, on this build's own prose: the position section read *"has no way to: no
    order endpoints exist"* — an honest sentence that leaked an implementation term straight out
    of Commitment 1. Rewritten to *"has no mechanism for doing so"*. The guard caught the author,
    which is the only kind of catch worth having.
    """
    low = text.lower()
    for banned in _ADVISORY:
        assert banned not in low, f"{where} contains advisory phrasing: {banned!r}"
    for leak in _IMPLEMENTATION:
        assert leak not in low, f"{where} leaks an implementation note: {leak!r}"
    m = _DECISION_ID.search(text)
    assert not m, f"{where} leaks a decision ID into served copy: {m.group(0)!r}"


@pytest.mark.parametrize("where,text", _verbatim(), ids=[w for w, _ in _verbatim()])
def test_verbatim_commitments_meet_the_full_help_bar_UNEXEMPTED(where: str, text: str):
    """THE SAME BAR AS `_authored`, with nothing carved out (§11-2, owner, 2026-07-20).

    This test previously checked advice ONLY, because the exemption held decision IDs and
    implementation notes out of scope. The spec was cleaned, so the carve-out is gone and this
    runs the full bar — the identical three checks the authored corpus faces.

    ⚠ **A RED HERE IS NOT A TEST TO UPDATE, AND NOT A STRING TO REWORD IN `legal.py`.** These
    seven are the spec's, and AC-L3 asserts byte-equality with it. The fix is always to amend
    `docs/specs/PRODUCT-SPEC.md` §3 and let AC-L3 carry the change here — which is precisely how
    the exemption this test replaced came to be deletable.
    """
    low = text.lower()
    for banned in _ADVISORY:
        assert banned not in low, f"{where} contains advisory phrasing: {banned!r}"
    for leak in _IMPLEMENTATION:
        assert leak not in low, (
            f"{where} leaks an implementation note: {leak!r} — amend PRODUCT-SPEC.md §3, "
            f"never app/services/legal.py alone (AC-L3 asserts they are byte-equal)."
        )
    m = _DECISION_ID.search(text)
    assert not m, (
        f"{where} leaks a decision ID into served copy: {m.group(0)!r} — §3's annotation table "
        f"below the blockquote is where lineage lives; the blockquote is what the user reads."
    )


def test_the_two_corpora_stay_disjoint():
    """Provenance, not latitude — the split's remaining job (see the module docstring).

    Both corpora now meet the same bar, so this no longer guards an exemption from spreading. It
    guards the FAILURE MESSAGE: a red in `_verbatim` must route the author to PRODUCT-SPEC.md, and
    a red in `_authored` must route them to legal.py. A string that drifted into both corpora
    would make one of those two instructions wrong.
    """
    assert not ({w for w, _ in _authored()} & {w for w, _ in _verbatim()})

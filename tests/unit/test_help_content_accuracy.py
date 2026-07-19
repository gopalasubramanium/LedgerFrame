# SPDX-License-Identifier: AGPL-3.0-or-later
"""HELP CONTENT ACCURACY GUARDS (page-help §9-7, ruled 2026-07-19).

The Help catalogue is prose ABOUT the product, served to users and cited by the AI. That makes it
the one surface where a sentence can be fluent, well-formed, reviewed — and false.

It had been false for a long time. The v1-era catalogue described pages this product does not have
("Snapshot", "Planning", "Investment policy"), a Simple/Expert toggle that was removed, a pencil
button that never shipped, four Settings tabs where six ship, and used wording two decisions had
already retired. None of it failed anything, because **nothing compared the copy to the product**.

A spec edit regenerates no contract, so a content rule with no test is a wish. These are the tests.

WHY THESE LIVE HERE AND NOT IN tests/integration/test_help.py: that module tests the KB's SHAPE and
its endpoint. These compare the KB against OTHER FILES in the repo (the nav model, the glossary's
deprecated-terms table) — the same repo-wide spec-vs-code posture as the parity guard next door.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from app.services.help import HELP

REPO = Path(__file__).resolve().parents[2]
NAV = REPO / "frontend" / "src" / "components" / "ui" / "nav.ts"
GLOSSARY = REPO / "docs" / "specs" / "GLOSSARY.md"

_PAGES = [e for e in HELP if e["category"] == "Pages"]


def _nav_items() -> list[tuple[str, str, bool]]:
    """(label, path, built) for every entry in the canonical nav model."""
    src = NAV.read_text(encoding="utf-8")
    body = src[src.index("export const NAV_GROUPS") :]
    return [
        (m.group("label"), m.group("path"), bool(m.group("built")))
        for m in re.finditer(
            r'\{\s*label:\s*"(?P<label>[^"]+)",\s*path:\s*"(?P<path>[^"]+)"'
            r'(?:,\s*built:\s*(?P<built>true))?\s*\}',
            body,
        )
    ]


def test_the_nav_model_parses():
    items = _nav_items()
    assert len(items) == 19, f"expected the 19 RD-9 nav items, parsed {len(items)}"
    assert ("Home", "/", True) in items


def test_every_page_entry_names_a_page_that_actually_exists():
    """A `Pages` entry's title must be a nav label, spelled identically (nav label = H1 = route).

    Seen RED on the v1-era catalogue: "Snapshot", "Planning", "Investment policy" and
    "Pricing health" are not nav labels — the first two name pages that no longer exist, the
    others are the wrong spelling of pages that do.
    """
    labels = {label for label, _p, _b in _nav_items()}
    wrong = [e["title"] for e in _PAGES if e["title"] not in labels]
    assert not wrong, (
        f"help entries name pages that are not in the nav model: {wrong}\n"
        f"Titles must match a nav label EXACTLY (casing included: 'Net worth', 'Cash flow', "
        f"'Pricing Health')."
    )


def test_help_never_documents_a_page_the_user_cannot_open():
    """Only BUILT pages get an entry — documenting an unreachable page is a dead end.

    This is why Legal has no entry yet: it is in the nav model but not built, so an entry for it
    would send a reader to a page that renders "isn't built yet". It is authored in the Legal
    milestone, alongside the page. (The same rule keeps Help itself out until Help ships.)
    """
    unbuilt = {label for label, _p, built in _nav_items() if not built}
    documented_but_unreachable = [e["title"] for e in _PAGES if e["title"] in unbuilt]
    assert not documented_but_unreachable, (
        f"help documents pages the user cannot reach: {documented_but_unreachable}. "
        f"Author the entry in the milestone that ships the page."
    )


def test_every_built_page_has_a_help_entry():
    """The other direction: a built page with no entry is a hole in the catalogue.

    Help and Legal are excluded while unbuilt (the test above owns that case).
    """
    built = {label for label, _p, built in _nav_items() if built}
    documented = {e["title"] for e in _PAGES}
    assert not (built - documented), f"built pages with no help entry: {sorted(built - documented)}"


def test_no_page_entry_points_at_a_redirect_only_path():
    """`/snapshot`, `/planning` and `/global` are redirects, not pages. Naming one as a
    destination teaches the user a route that does not exist as a page."""
    dead = ("/snapshot", "/planning", "/global")
    hits = [
        (e["id"], p) for e in HELP for p in dead
        if p in e["body"] or p in e.get("keywords", "")
    ]
    assert not hits, f"help copy points at redirect-only paths: {hits}"


# --- Deprecated wording ---------------------------------------------------------------------- #
# GLOSSARY.md's "Deprecated terms" table says outright: "These must not appear in UI copy."
# Its first column is prose, not a machine vocabulary, so the checks are AUTHORED — but the set of
# rows is READ, and every row must be triaged here. A new deprecated row therefore breaks this
# module until someone decides how (or whether) it can be checked. That is the point: the coverage
# claim is mechanical even though each pattern is a judgment.
_DEPRECATED_CHECKS: dict[str, str | None] = {
    "Detail level: Simple/**Expert**": r"\bsimple\s*/\s*expert\b|\bexpert\s+(?:mode|view)\b",
    "Home layout: Simple / **Full**": r"\bsimple\s*/\s*full\b|\bhome layout\b",
    "Total value": r"\btotal value\b",
    "Portfolio value": r"\bportfolio value\b",
    "Snapshot (page/nav)": r"\bsnapshot (?:page|view|tab)\b",
    "Top movers": r"\btop movers\b",
    "Today (alone)": None,  # bare "today" is ordinary English; "Today's change" is the term
    "Day / day_change": r"\bday_change\b",
    "Realised gain(s) (incl. headings)": r"\brealised gains?\b",
    "Realised (alone)": None,  # unbounded; the row above covers the reachable case
    "Paper gain": r"\bpaper gain\b",
    "as_of / delayed (loose usage)": r"\bas_of\b",
    "Provider (as user-facing provenance)": None,  # "provider" is legitimate in Data feeds copy
    "route_source / routing (user-facing)": r"\broute_source\b",
    "Cost of ownership": r"\bcost of ownership\b",
    "Platform": None,  # too common a word to match safely; Institution is enforced by review
    "Household (as a term/kind)": None,  # "Household" is a valid ENTITY NAME; only the kind retired
    "Review Centre": r"\breview cent(?:re|er)\b",
    "Needs a look (as label)": None,  # retired as a PAGE LABEL; the phrase survives in prose —
                                      # Review's own shipped subtitle reads "What needs a look"
    "What needs attention": r"\bwhat needs attention\b",
    "Planning (as page label)": r"\bplanning page\b|\bthe planning view\b",
}

# The deprecated table carves out its own exceptions, and this guard must honour them rather than
# override them. Each is by (entry id, row) with the reason — never a blanket relaxation.
_DEPRECATED_EXEMPT: dict[tuple[str, str], str] = {
    ("term-unrealised-pl", "Paper gain"):
        'GLOSSARY.md permits this row explicitly: "colloquialism may be EXPLAINED, not shown". '
        "The entry explains it; it is never used as a label.",
    ("term-ongoing-cost", "Cost of ownership"):
        "The entry names the retired concept only to say the two cost figures are deliberately "
        "NEVER added into one — naming what the product refuses to compute is the honesty, not a "
        "relapse into the retired term.",
}


def _deprecated_rows() -> list[str]:
    text = GLOSSARY.read_text(encoding="utf-8")
    table = text[text.index("## Deprecated terms") :]
    rows = re.findall(r"^\|\s*([^|]+?)\s*\|", table, re.MULTILINE)
    return [r for r in rows if r.strip() and r.strip() != "Retired term" and not r.startswith("-")]


def test_every_deprecated_row_is_triaged_here():
    """Coverage, mechanically. A new row in the deprecated table must be given a pattern or an
    explicit `None` with a reason — it cannot be silently uncovered."""
    missing = [r for r in _deprecated_rows() if r not in _DEPRECATED_CHECKS]
    assert not missing, (
        f"new deprecated terms are not triaged in _DEPRECATED_CHECKS: {missing}\n"
        f"Give each a regex, or None with a comment saying why it cannot be matched safely."
    )


@pytest.mark.parametrize("entry", HELP, ids=lambda e: e["id"])
def test_no_help_copy_uses_a_deprecated_term(entry: dict):
    """Seen RED before the content pass on: 'Simple/Expert' (page-home), 'Total value' and
    'Realised gains' (Terms titles + bodies)."""
    blob = " ".join(
        str(entry.get(k, "")) for k in ("title", "body", "keywords", "what", "why", "improves")
    ).lower()
    for row, pattern in _DEPRECATED_CHECKS.items():
        if (entry["id"], row) in _DEPRECATED_EXEMPT:
            continue
        if pattern and re.search(pattern, blob):
            pytest.fail(
                f'{entry["id"]} uses retired wording matching {pattern!r} (deprecated: "{row}"). '
                f"GLOSSARY.md's deprecated-terms table gives the replacement."
            )


@pytest.mark.parametrize("entry", HELP, ids=lambda e: e["id"])
def test_no_help_copy_advises_or_leaks_an_implementation_note(entry: dict):
    """Advice-free across ALL categories (it previously covered Terms only), plus copy hygiene.

    The product never advises. And a decision ID or an internal name in served prose is a defect
    (page-chrome §11-8) — this catalogue is the surface most likely to leak one, because it is the
    only place the product explains itself.
    """
    fields = ("title", "body", "keywords", "what", "why", "improves")
    blob = " ".join(str(entry.get(k, "")) for k in fields)
    low = blob.lower()

    for banned in ("you should", "we recommend", "aim for", "a good value", "you must",
                   "advise", "the best way to"):
        assert banned not in low, f'{entry["id"]} contains advisory phrasing: {banned!r}'

    assert not re.search(r"\b[DP]-\d{3}\b|\bND-\d+\b|§", blob), \
        f'{entry["id"]} leaks a decision ID into served copy'
    for leak in ("response_model", "privacy_mode", "/api/", "endpoint", "localstorage",
                 "refdata", "asset_class", "server-side"):
        assert leak not in low, f'{entry["id"]} leaks an implementation note: {leak!r}'

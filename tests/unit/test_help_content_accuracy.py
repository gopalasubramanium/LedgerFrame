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
from app.services.help_markup import strip_markup

REPO = Path(__file__).resolve().parents[2]
NAV = REPO / "frontend" / "src" / "components" / "ui" / "nav.ts"
GLOSSARY = REPO / "docs" / "specs" / "GLOSSARY.md"

_PAGES = [e for e in HELP if e["category"] == "Pages"]


# --- Which fields the prose guards read -------------------------------------------------------- #
# DERIVED, never hardcoded. Every guard below used to carry its own literal tuple
# ("title", "body", "keywords", "what", "why", "improves"). That was a silent-success trap of the
# purest kind: the 9-bis-1 redesign added `inputs`, `options`, `outputs`, `interpret` and `example`,
# and every one of those guards would have kept passing while saying NOTHING about the new prose —
# green because it never looked, which is indistinguishable from green because it is clean.
#
# So the field set is read off the entries themselves. A field added tomorrow is guarded today.
# `id` and `category` are machine keys, not prose, and `links` is checked separately (its labels are
# nav labels; its topics must resolve).
_NOT_PROSE = {"id", "category", "links"}


def _prose_fields(entry: dict) -> list[str]:
    return [k for k in entry if k not in _NOT_PROSE]


def _prose(entry: dict, fields: list[str] | None = None) -> str:
    """Every authored string in an entry, flattened — list-valued fields included, MARKUP STRIPPED.

    THE STRIP IS THE GUARD, not a tidy-up (§9-bis-11(b)). Every check below matches phrases —
    substrings and word-boundary regexes — against shipped product strings. A marker sitting
    INSIDE a phrase separates its words and defeats the match: `you **should**` does not contain
    "you should", so the platform's central no-advice guarantee would be broken *in bold* by a
    green suite. That is the silent-success mode in its purest form, and formatting must never be
    a way to smuggle a claim past the guard that exists to catch it.

    Proven by fail-first specimens in `tests/unit/test_help_markup.py`, which also fails if this
    strip is ever removed — so the wiring cannot rot quietly.
    """
    out: list[str] = []
    for k in fields if fields is not None else _prose_fields(entry):
        v = entry.get(k)
        if isinstance(v, str):
            out.append(v)
        elif isinstance(v, list):
            out.extend(x for x in v if isinstance(x, str))
    return strip_markup(" ".join(out))


def test_the_prose_field_set_is_derived_and_covers_the_new_redesign_fields():
    """The guard that guards the guards: prove the derived set actually sees 9-bis-1's fields.

    If someone re-hardcodes a field tuple, or a redesign field silently stops being authored,
    this is what goes red — not a content test that quietly checks less than it claims.
    """
    covered = {f for e in HELP for f in _prose_fields(e)}
    for field in ("body", "keywords", "what", "why", "improves",
                  "inputs", "options", "outputs", "interpret", "example", "level"):
        assert field in covered, (
            f"{field!r} is authored nowhere in HELP, so every prose guard below is vacuous for it. "
            f"Either the content regressed or the field was renamed without the guards following."
        )


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


@pytest.mark.parametrize("entry", HELP, ids=lambda e: e["id"])
def test_page_names_in_PROSE_use_the_canonical_casing(entry: dict):
    """A page named INSIDE a body/triad must be spelled as the nav spells it (D-022).

    The title guard above only checks a `Pages` entry's own title. It cannot see a page named in
    passing — which is where "Pricing health" (lowercase h) survived the whole content pass and was
    caught by EYE at the 0a walk, twice, inside Terms entries.

    Only the MULTI-WORD labels are checked: single-word ones ("Home", "Reports", "Review") are
    ordinary English and matching them would fire on every sentence. A fully-lowercase mention is
    left alone as prose; a Capitalised-first-word mention is clearly naming the page, so it must
    match the nav exactly.
    """
    multiword = [label for label, _p, _b in _nav_items() if " " in label]
    for label in multiword:
        for field in _prose_fields(entry):
            if field == "title":
                continue  # the title guard above owns that case
            text = _prose(entry, [field])
            for m in re.finditer(re.escape(label), text, re.I):
                got = text[m.start():m.end()]
                if got in (label, label.lower()):
                    continue
                pytest.fail(
                    f'{entry["id"]}.{field} names the page as {got!r}; the nav spells it '
                    f"{label!r} (nav label = H1 = route)."
                )


# --- Deprecated wording ---------------------------------------------------------------------- #
# GLOSSARY.md's "Deprecated terms" table says outright: "These must not appear in UI copy."
# Its first column is prose, not a machine vocabulary, so the checks are AUTHORED — but the set of
# rows is READ, and every row must be triaged here. A new deprecated row therefore breaks this
# module until someone decides how (or whether) it can be checked. That is the point: the coverage
# claim is mechanical even though each pattern is a judgment.
_DEPRECATED_CHECKS: dict[str, str | None] = {
    # page-legal §11-1 (owner, 2026-07-20). The pattern catches the TERM in its three shipped
    # shapes — "Product Guarantee(s)", the bare plural "the Guarantees", and the numbered citation
    # "Guarantee 5" — and never the ordinary English SINGULAR, which the glossary row explicitly
    # preserves. Help serves *"indicative, not a guarantee of sale price or timing"* on two
    # Liquidity entries: a plain-English caveat, and a guard that swept it would force a false
    # rename onto honest copy.
    #
    # FAIL-FIRST, MEASURED (not asserted): run against the PRE-rename catalogue at `f7e70c0` this
    # pattern bites 4 lines — the Legal entry's body, keywords, outputs and interpret — and bites
    # 0 of the two Liquidity strings. An earlier, narrower draft of this pattern caught only 2 of
    # the 4 and is recorded here because the miss is the instructive part: it had no plural arm,
    # so *"The Guarantees are reproduced word for word"* sailed through green.
    "**Product Guarantees** / **Guarantee *n***":
        r"\bproduct guarantees?\b|\bguarantees\b|\bguarantee\s+\d\b",
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
    ("page-legal", "**Product Guarantees** / **Guarantee *n***"):
        "KEYWORDS ONLY, and keywords are a SEARCH INDEX rather than displayed copy — no user "
        "reads this field, they only match against it. A rename that deletes the old word from "
        "the index strands every user who learned the product under the old name: they search "
        "the only word they know and the catalogue tells them it has nothing. The entry's four "
        "PROSE fields (body, outputs, interpret, title) carry the new term exclusively, and the "
        "guard still holds them — verified by removing this exemption, which reds on keywords "
        "alone and on nothing else.",
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
    blob = _prose(entry).lower()
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
    blob = _prose(entry)
    low = blob.lower()

    for banned in ("you should", "we recommend", "aim for", "a good value", "you must",
                   "advise", "the best way to"):
        assert banned not in low, f'{entry["id"]} contains advisory phrasing: {banned!r}'

    assert not re.search(r"\b[DP]-\d{3}\b|\bND-\d+\b|§", blob), \
        f'{entry["id"]} leaks a decision ID into served copy'
    for leak in ("response_model", "privacy_mode", "/api/", "endpoint", "localstorage",
                 "refdata", "asset_class", "server-side"):
        assert leak not in low, f'{entry["id"]} leaks an implementation note: {leak!r}'


# --- The dead-affordance guard (9-bis-1 inputs/options) ---------------------------------------- #
# Section 2 now tells the user WHAT THEY CAN DO on a page. That is the highest-risk prose in the
# product: a body that describes a page vaguely ages slowly, but a named control that does not
# exist sends the user hunting for it and finding nothing. This catalogue has already shipped
# exactly that — the Settings entry described a staleness threshold on Data feeds that
# Settings.tsx:70 records as "not yet built — served only", and it survived a full content pass
# because nothing compared an affordance claim to the product.
#
# WHAT THIS CAN AND CANNOT PROVE, stated honestly: it proves a named affordance EXISTS somewhere in
# the shipped product. It cannot prove it exists on the page the entry claims, nor that the
# surrounding sentence is true. It kills the invented control and the retired one — the two failure
# modes that actually happened — and no more than that. A guard that overclaims its reach is the
# same silent-success bug in a different coat.
_UI = REPO / "frontend" / "src"
_SERVICES = REPO / "app"

# Words that carry the sentence but are not the affordance. `inputs`/`options` are authored as
# "Label — what it does", so only the part BEFORE the dash is a claim about a control's name.
_LABEL_SPLIT = re.compile(r"\s+[—:]\s+")


# Comments are NOT shipped text, and this is not a nicety — it is the whole guard.
# Proven by its own RED specimen: re-injecting the historical false claim ("Stale-after threshold —
# how long a price may go without refreshing") did NOT go red, because Settings.tsx:70 carries the
# words in a comment that says, in as many words, "not yet built". A guard that reads comments
# would have blessed the exact defect it was written to catch — and the comment saying a thing
# does not exist is the LAST place a claim that it exists should find corroboration.
_LINE_COMMENT = re.compile(r"//[^\n]*|#[^\n]*")
_BLOCK_COMMENT = re.compile(r"/\*.*?\*/|\{/\*.*?\*/\}", re.S)


def _shipped_text() -> str:
    """Every string the product could RENDER, lowercased: the frontend, plus the backend services
    that SERVE display labels (master-data vocabularies are titleized at runtime, so the source
    carries `expense` where the user sees `Expense` — hence the case-insensitive compare).

    Two exclusions, both load-bearing:

    * COMMENTS — see above.
    * ``app/services/help.py`` ITSELF. The catalogue cannot be its own evidence. Including it made
      every claim trivially findable in the very string that made the claim, which is not a weak
      guard but a circular one: it would have returned green for any invented control whatsoever.
      Caught by the RED specimen, not by review.
    """
    parts = []
    for root, globs in ((_UI, ("*.tsx", "*.ts")), (_SERVICES, ("*.py",))):
        for g in globs:
            for p in root.rglob(g):
                if p.name == "help.py" and p.parent.name == "services":
                    continue
                src = p.read_text(encoding="utf-8", errors="ignore")
                parts.append(_LINE_COMMENT.sub(" ", _BLOCK_COMMENT.sub(" ", src)))
    return " ".join(parts).lower()


_SHIPPED = _shipped_text()

# Affordance phrases that are deliberately NOT literal UI strings, each with its reason. An entry
# may describe a control in the user's words rather than the button's — but it must be listed here,
# so the exception is a decision on the record and not an accident.
_AFFORDANCE_EXEMPT: dict[str, str] = {
    "Nothing to fill in": "Scenarios has no inputs at all; saying so IS the honest answer, and "
                          "an absent control cannot appear in the source.",
    "Sort the table by any column": "Sorting is a DataTable capability, not a labelled control.",
    "A target weight and an optional band per bucket": "Describes the per-row editor pair in the "
                                                       "user's words; the labels themselves "
                                                       "(Target, Minimum, Maximum) are separate.",
    "Any entry title": "The Help accordion's entry titles are content, not a fixed label.",
}


@pytest.mark.parametrize("entry", [e for e in HELP if "inputs" in e], ids=lambda e: e["id"])
def test_every_named_affordance_exists_in_the_shipped_product(entry: dict):
    """A control Help names must be findable in the product. Seen RED on the Settings entry's
    staleness threshold — described for a whole release, never built."""
    dead = []
    for claim in entry["inputs"]:
        # STRIPPED first — this guard reads the field directly, not through `_prose()`, so it
        # needs the strip in its own right. `**Retry** — …` would otherwise look up the literal
        # `**Retry**`, find nothing, and report a REAL control as dead: a false alarm that teaches
        # the next reader to relax the guard rather than trust it.
        label = _LABEL_SPLIT.split(strip_markup(claim), 1)[0].strip()
        if label in _AFFORDANCE_EXEMPT:
            continue
        # A claim may name several controls ("Edit, Rename, Merge… and Delete on a row").
        for part in re.split(r",|;|/| and (?=[A-Z])", label):
            part = part.strip().strip(".…")
            if len(part) < 3 or part in _AFFORDANCE_EXEMPT:
                continue
            if part.lower() not in _SHIPPED:
                dead.append(part)
    assert not dead, (
        f'{entry["id"]}.inputs names controls that exist NOWHERE in the shipped product: {dead}\n'
        f"Either the affordance was never built (delete the claim — a dead affordance sends the "
        f"user hunting), or it is named differently in the UI (use the shipped label), or it is a "
        f"deliberate paraphrase (add it to _AFFORDANCE_EXEMPT with the reason)."
    )


# An `options` item enumerating real choices is authored as "Control: A · B · C". Items without
# that shape are prose ABOUT the choices ("the shock set is fixed") and carry no enumeration to
# check — they are skipped, not silently passed off as verified.
_ENUM = re.compile(r"^[^:]+:\s*(?P<values>.+·.+)$")


@pytest.mark.parametrize("entry", [e for e in HELP if "options" in e], ids=lambda e: e["id"])
def test_every_enumerated_option_value_exists_in_the_shipped_product(entry: dict):
    """CLAUDE.md: every categorical field references MASTER-DATA — no free-text enums. Help is
    where that rule is easiest to break, because an option list is prose here and a vocabulary
    everywhere else. An invented value ("Theme: System · Light · Dark · Sepia") reads exactly like
    a real one and sends the user looking for a setting that does not exist.

    Master-data labels are titleized from their stored values at render time, so the compare is
    case-insensitive: the source carries `expense` where the user is shown `Expense`."""
    invented = []
    for item in entry["options"]:
        m = _ENUM.match(strip_markup(item))  # direct field read — strip in its own right
        if not m:
            continue
        for value in m.group("values").split("·"):
            value = value.strip()
            if len(value) < 2:
                continue
            if value.lower() not in _SHIPPED:
                invented.append(value)
    assert not invented, (
        f'{entry["id"]}.options lists choices that exist NOWHERE in the shipped product: '
        f"{invented}\nAn option the user cannot actually pick is a fabricated fact about the "
        f"product. Use the served vocabulary's own labels."
    )


# --- Section 3: sample-marked examples, and the reading order (9-bis-1 / 9-bis-3) --------------- #
_GLOSSARY = [e for e in HELP if e["category"] == "Glossary"]
_SAMPLE_MARK = "Sample — "


@pytest.mark.parametrize("entry", _GLOSSARY, ids=lambda e: e["id"])
def test_every_glossary_example_is_marked_as_an_illustrative_sample(entry: dict):
    """9-bis-3: examples are STATIC and clearly marked as illustrative samples.

    The marker lives in the SERVED STRING, not only in the page's styling. An example is a set of
    figures beside a definition — the single most impersonatable thing this catalogue holds — and
    it is read by more than the page: `app/ai/tools.py` pulls this content into the grounded fact
    pack. A chip rendered in the UI would leave the AI quoting bare numbers with nothing marking
    them as invented. So the honesty travels with the content, wherever the content goes.

    R-53 (post-release) is what would make examples personal, and it needs the ENGINE to serve
    derivation traces — re-deriving a figure here to narrate it would make Help a second derivation
    site, which is the failure the one-derivation law exists to prevent.
    """
    example = entry.get("example")
    assert example, f'{entry["id"]} has no worked example; §9-bis-1 gives every term one.'
    assert example.startswith(_SAMPLE_MARK), (
        f'{entry["id"]}.example must open with {_SAMPLE_MARK!r} so the figures are marked as '
        f"invented wherever the string is read — the page, the API, and the AI fact pack alike. "
        f"Got: {example[:40]!r}"
    )
    # A sample must never present itself as the reader's own position. "your" in an example is the
    # exact sentence that turns an illustration into a false statement about someone's money.
    assert "your" not in example.lower(), (
        f'{entry["id"]}.example says "your" — that claims the sample figures are the reader\'s. '
        f"Write the illustration in the third person."
    )


def test_the_glossary_reading_order_covers_every_term_exactly_once():
    """Basics > expert is ordered by an explicit list, so the list must not drift from the terms.

    A term missing from it still RENDERS (it sorts to the end — a forgotten list must never delete
    content from the page), which is precisely why the omission needs a test to be audible.
    """
    from app.services.help import _GLOSSARY_ORDER

    ids = [e["id"] for e in _GLOSSARY]
    assert len(_GLOSSARY_ORDER) == len(set(_GLOSSARY_ORDER)), "_GLOSSARY_ORDER repeats an id"
    missing = [i for i in ids if i not in _GLOSSARY_ORDER]
    stale = [i for i in _GLOSSARY_ORDER if i not in ids]
    assert not missing, f"glossary terms with no place in the reading order: {missing}"
    assert not stale, f"_GLOSSARY_ORDER names terms that no longer exist: {stale}"


def test_the_served_reading_order_is_sections_then_basics_to_expert():
    """The ORDER IS THE FEATURE here, so it is asserted on what is served, not on the source list."""
    from app.services.help import _GLOSSARY_ORDER, all_help

    served = all_help()["entries"]
    cats = [e["category"] for e in served]
    assert cats == sorted(cats, key=["Orientation", "Pages", "Glossary"].index), (
        "sections are served out of journey order; Orientation must precede Pages, and Pages "
        "the Glossary."
    )
    assert [e["id"] for e in served if e["category"] == "Glossary"] == _GLOSSARY_ORDER
    levels = [e["level"] for e in served if e["category"] == "Glossary"]
    assert levels == sorted(levels, key=["Basics", "Core", "Advanced"].index), (
        f"glossary levels are not in basics > expert order: {levels}"
    )


# --- The deprecated-term guard, extended to AI FACT LABELS ------------------------------------- #
# AI-surfaces §0-H. `test_no_help_copy_uses_a_deprecated_term` above reads HELP entries, and
# `_shipped_text()` reads frontend + backend source as one undifferentiated blob for EXISTENCE
# checks. Neither looks at what the AI calls a number.
#
# That gap shipped a defect: `app/ai/tools.py` served `GroundingFact(label="Portfolio total
# value")` — "Total value" is D-021-retired, and the row was already in _DEPRECATED_CHECKS. The
# guard did not fire because its corpus was Help content, not fact labels.
#
# A fact label is not ordinary source text, and this is why it gets its own guard rather than a
# wider grep:
#   * it is SHOWN TO THE USER, before the answer (D-067's fact-pack-first trust UX);
#   * it is FED TO THE MODEL as grounded fact, so a retired term enters the AI's own vocabulary
#     and comes back out in prose no copy review ever reads.
#
# WHAT THIS CAN AND CANNOT PROVE: it reads LITERAL label= arguments via the AST. A label built at
# runtime (an f-string, a variable, a master-data lookup) is invisible to it and is stated here
# rather than papered over — the same honesty `_shipped_text()`'s docstring applies to itself.

import ast  # noqa: E402 — appended section; kept beside the code that uses it


def _ai_fact_labels() -> list[tuple[str, str]]:
    """Every literal `GroundingFact(label="…")` in `app/`, as (file:line, label)."""
    found: list[tuple[str, str]] = []
    for path in sorted((REPO / "app").rglob("*.py")):
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"))
        except SyntaxError:  # pragma: no cover — a broken file is another suite's problem
            continue
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            name = getattr(node.func, "id", None) or getattr(node.func, "attr", None)
            if name != "GroundingFact":
                continue
            for kw in node.keywords:
                if kw.arg == "label" and isinstance(kw.value, ast.Constant) \
                        and isinstance(kw.value.value, str):
                    rel = path.relative_to(REPO).as_posix()
                    found.append((f"{rel}:{node.lineno}", kw.value.value))
    return found


_AI_FACT_LABELS = _ai_fact_labels()


def test_the_ai_fact_label_corpus_is_not_empty():
    """Pinned against going blind: an AST walk that matched nothing would bless anything."""
    # The threshold is deliberately LOW and the reason is the honest one: most fact labels are
    # built at runtime (f-strings over instruments, master-data lookups), so the LITERAL corpus is
    # small — 7 at the time of writing. A high threshold here would be a number that looked
    # rigorous and broke on the next legitimate refactor. This asserts the walk still matches
    # something, which is the only claim it can honestly make.
    assert len(_AI_FACT_LABELS) >= 5, (
        f"only {len(_AI_FACT_LABELS)} literal AI fact labels found — the AST walk stopped "
        "matching GroundingFact constructions, so the guard below is checking an empty corpus "
        "and would stay green through any retired term."
    )


@pytest.mark.parametrize(
    "site,label", _AI_FACT_LABELS, ids=[f"{s} {label}" for s, label in _AI_FACT_LABELS],
)
def test_no_ai_fact_label_uses_a_deprecated_term(site: str, label: str):
    """Seen RED on `app/ai/tools.py:33` — `label="Portfolio total value"` (D-021).

    The replacement is read from GLOSSARY.md's deprecated table, which retires "Total value" in
    favour of *"Net worth (with liabilities) / Gross assets (positive holdings), **per context**"*.
    The context is the discriminator, and it is settled per site by what the code actually sums —
    not by copying whatever the last fix used.
    """
    low = label.lower()
    for row, pattern in _DEPRECATED_CHECKS.items():
        if pattern and re.search(pattern, low):
            pytest.fail(
                f'{site} serves the AI a fact labelled "{label}", which matches retired wording '
                f'{pattern!r} (deprecated: "{row}").\n'
                "This label is shown to the user BEFORE the answer and fed to the model as "
                "grounded fact, so a retired term here enters the AI's own vocabulary. "
                "GLOSSARY.md's deprecated-terms table gives the replacement — several are "
                '"per context", so resolve it from what the code sums, not from precedent.'
            )

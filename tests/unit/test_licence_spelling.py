# SPDX-License-Identifier: AGPL-3.0-or-later
"""THE §9-7 SPELLING GUARD — user-facing prose says "licence" (page-legal §9-7).

WHY THIS EXISTS, AND WHY IT EXISTS *LATE*. §9-7 ruled the split in as many words — **user-facing
prose takes the British "licence"; filenames and SPDX identifiers keep "License"**, because those
are fixed by convention and not freely changeable. The ruling then shipped **with no guard**, and
the predictable thing happened: the 0a specimen served `PageHeader` subtitle *"**License**,
disclaimer, and the terms…"* — the American spelling, in the most prominent prose on the very page
the ruling was about. The same wrong spelling was live in `INFORMATION-ARCHITECTURE.md` §5. Neither
was caught by review; both were found months later by a grep run for an unrelated rename.

**That is the whole argument for mechanising a spelling ruling.** A convention that lives only in a
plan file is enforced by whoever last read the plan file, which over a long enough project is
nobody. This module is §9-7 made executable.

WHAT IT READS, AND WHY BOTH:
  * **the SERVED payload** — `all_legal()` and `all_help()` walked recursively — not the source
    that produces it. A guard over source text asserts what someone typed; a guard over the
    response asserts what a user is actually sent, which is the thing the ruling is about. It also
    means a wrong spelling is caught no matter which module it came from.
  * **frontend authored strings** — quoted literals in `routes/` and `components/ui/`. Not all copy
    is served: the defect that motivated this guard was a `PageHeader` subtitle typed directly into
    a `.tsx` file, and a served-only guard would have sailed straight past it.

THE FOUR EXEMPT CONTEXTS, each earning its place rather than listed for convenience:

  1. **PROPER NAMES.** `GNU Affero General Public License` is the actual title of an actual
     document. ⚑ **This is a real refinement of §9-7 and is raised as PROPOSED at the re-look**
     (page-legal §11-E3): the ruling as written says *user-facing prose = "licence"*, and applied
     literally it would force the product to **misname the licence it ships under** — on the page
     whose purpose is to state that licence correctly. Renaming someone else's document to suit
     our house style is not a spelling convention, it is an inaccuracy. The exemption is narrow: it
     matches known licence titles, not the bare word.
  2. **URLs.** `https://www.gnu.org/licenses/agpl-3.0.html` is an address. It is not spelled, it is
     resolved, and "correcting" it breaks it.
  3. **Filenames and SPDX identifiers** — `LICENSE`, `LICENSES.md`, `SPDX-License-Identifier`.
     Exactly the carve-out §9-7 states.
  4. **Code identifiers** — `licenseUrl`, `license_key`. These need no rule of their own: the
     pattern requires a word boundary on *both* sides, so a match embedded in a longer token never
     fires. Recorded because it is invisible in the regex and a future reader would otherwise add a
     redundant exemption for it.

NOT GUARDED, DELIBERATELY: the British **verb** is "license" ("to license software") while the noun
is "licence". No served string uses the verb today, so the guard treats every American spelling as
a defect. If a genuine verb use ever needs to ship, it belongs in `_VERB_EXEMPTIONS` **by name and
with a reason** — the same discipline the deprecated-terms table uses — never by loosening the
pattern. Widening a bar to admit one string quietly admits every string.

PLACEMENT: pytest rather than Vitest, and for the reason `test_copy_hygiene.py` records — it reads
frontend source off disk, which Vitest cannot do without a new dependency (⇒ ADR). It runs in the
standing backend suite, so it is on every close by construction.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
SRC = REPO / "frontend" / "src"

#: The American spelling, as a whole word. Both boundaries are required, which is also what makes
#: `licenseUrl` and `license_key` exempt without an explicit rule (see the module docstring).
_AMERICAN = re.compile(r"\b[Ll]icens(?:e|es|ed|ing)\b")

#: Spans in which the American spelling is CORRECT and must be left alone. Each is a span-producing
#: pattern: a hit inside any matched span is exempt.
_EXEMPT_SPANS: tuple[tuple[str, re.Pattern[str]], ...] = (
    # 1. Proper names of real licence documents. Narrow by construction — it matches titles, never
    #    the bare word, so "under this License" is still a defect.
    ("proper name of a licence document", re.compile(
        r"(?:GNU (?:Affero |Lesser )?General Public|Apache|MIT|BSD|Mozilla Public|Eclipse Public)"
        r" Licen[cs]e"
    )),
    # 2. URLs — addresses, not prose.
    ("a URL", re.compile(r"https?://\S+")),
    # 3. Filenames and SPDX identifiers — §9-7's stated carve-out.
    ("a filename or SPDX identifier", re.compile(r"SPDX-License-Identifier|\bLICENSES?(?:\.\w+)?\b")),
)

#: Genuine British VERB uses ("to license"), which are spelled with an s. Empty, and that is the
#: honest state: no served string uses the verb. An entry here must carry the exact string and a
#: reason, so that admitting one never widens the bar for the rest.
_VERB_EXEMPTIONS: frozenset[str] = frozenset()


def _offending(text: str) -> list[str]:
    """Every American spelling in `text` that is not inside an exempt span."""
    if text in _VERB_EXEMPTIONS:
        return []
    exempt: list[tuple[int, int]] = []
    for _label, pat in _EXEMPT_SPANS:
        exempt.extend(m.span() for m in pat.finditer(text))
    out = []
    for m in _AMERICAN.finditer(text):
        if any(lo <= m.start() and m.end() <= hi for lo, hi in exempt):
            continue
        out.append(f"{m.group(0)!r} in …{text[max(0, m.start() - 70):m.end() + 70]}…")
    return out


# --------------------------------------------------------------------------------------------- #
# Surface 1 — the SERVED payload.
# --------------------------------------------------------------------------------------------- #

def _served_strings() -> list[tuple[str, str]]:
    """Every string in the Legal and Help responses, with a dotted path to where it lives."""
    from app.services.help import all_help
    from app.services.legal import all_legal

    out: list[tuple[str, str]] = []

    def walk(value, path: str) -> None:
        if isinstance(value, str):
            out.append((path, value))
        elif isinstance(value, dict):
            for k, v in value.items():
                walk(v, f"{path}.{k}")
        elif isinstance(value, (list, tuple)):
            for i, v in enumerate(value):
                walk(v, f"{path}[{i}]")

    walk(all_legal(), "legal")
    walk(all_help(), "help")
    return out


def test_the_served_payload_never_spells_it_the_american_way():
    """Every string the product SENDS a user says "licence" (page-legal §9-7)."""
    offenders = [f"{path}: {hit}" for path, text in _served_strings() for hit in _offending(text)]
    assert not offenders, (
        "§9-7: user-facing prose takes the British \"licence\". Found the American spelling in "
        "SERVED content:\n  - " + "\n  - ".join(offenders) +
        "\n\nIf this is a proper name, a URL, a filename or an SPDX identifier, it belongs in an "
        "exempt span rather than being reworded. If it is the British VERB, add the exact string "
        "to _VERB_EXEMPTIONS with a reason. Do not widen the pattern."
    )


def test_the_served_walker_actually_SEES_the_legal_page():
    """A corpus guard that walked nothing would pass forever.

    The failure mode this closes is specific and has happened in this repo: a green suite that
    never looked is indistinguishable from a green suite that found nothing. So the walker is
    required to reach real Legal prose and to have found the one legitimate American spelling the
    product serves — the AGPL's own title. If that assertion ever fails, the guard above is
    measuring an empty set and its greenness means nothing.
    """
    served = _served_strings()
    assert len(served) > 200, f"the walker collected only {len(served)} strings — it is not reaching the corpora"
    assert any("General Public License" in text for _p, text in served), (
        "the walker no longer sees the AGPL's title, so it is probably not reaching Legal's "
        "pointers — the guard above would be green over the wrong corpus"
    )


# --------------------------------------------------------------------------------------------- #
# Surface 2 — authored frontend copy.
# --------------------------------------------------------------------------------------------- #

_STRING = re.compile(r'"([^"\n]{4,300})"')

#: JSX TEXT CONTENT — the copy between a tag's `>` and the next `<`, carrying no braces.
#:
#: THIS SECOND PATTERN EXISTS BECAUSE ITS ABSENCE WAS A LIVE DEFECT IN THIS GUARD. The first
#: version read quoted literals only, which is what `test_copy_hygiene.py` does and what this
#: module copied without questioning. It caught the `Legal.tsx` subtitle purely because that copy
#: happens to sit in an ATTRIBUTE (`subtitle="…"`). Rendered children are not quoted:
#:
#:     <p className="ph__egress">Refresh unavailable — no-egress is on…</p>
#:
#: is prose a user reads, in a file the guard was "covering", and the quoted-literal scan does not
#: see one character of it. The gap was found by grepping for an unrelated term and noticing the
#: scanner had missed a string that was plainly there. **A guard's coverage claim is only worth
#: what its extractor can actually reach**, and "it scans this file" is not the same claim as "it
#: reads this file's copy".
_JSX_TEXT = re.compile(r">([^<>{}\n]{4,300})<")


def _user_facing_files() -> list[Path]:
    files = [*(SRC / "routes").glob("*.tsx"), *(SRC / "components" / "ui").glob("*.tsx")]
    return [f for f in files if ".test." not in f.name]


def _copy_on_line(line: str) -> list[str]:
    """Every user-readable fragment on one line: quoted literals AND JSX text children."""
    out = []
    for literal in _STRING.findall(line):
        if literal.startswith(("./", "../", "/", "#/")):
            continue  # an import path or route, not copy
        out.append(literal)
    out.extend(_JSX_TEXT.findall(line))
    return out


def _offending_strings(path: Path) -> list[str]:
    out: list[str] = []
    in_block_comment = False
    for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        stripped = line.lstrip()
        # JSX block comments `{/* … */}` span lines and are where lineage notes live — including
        # notes that legitimately quote a retired or misspelled term in order to retire it. Tracked
        # across lines, because a one-line `startswith` check reads continuation lines as copy.
        if in_block_comment:
            if "*/" in line:
                in_block_comment = False
            continue
        if stripped.startswith(("{/*", "/*")) and "*/" not in line:
            in_block_comment = True
            continue
        if stripped.startswith(("//", "*", "/*", "{/*")):
            continue  # a comment is where SPDX headers and lineage notes BELONG
        for fragment in _copy_on_line(line):
            out.extend(f"{path.relative_to(REPO)}:{lineno}: {hit}" for hit in _offending(fragment))
    return out


@pytest.mark.parametrize("path", _user_facing_files(), ids=lambda p: p.name)
def test_authored_frontend_copy_never_spells_it_the_american_way(path: Path):
    """The surface the original defect shipped on: a subtitle typed straight into a `.tsx`."""
    offenders = _offending_strings(path)
    assert not offenders, (
        "§9-7: user-facing prose takes the British \"licence\".\n  - " + "\n  - ".join(offenders)
    )


# --------------------------------------------------------------------------------------------- #
# THE FAIL-FIRST SPECIMENS — the guard is only worth its green if it is known to bite.
# --------------------------------------------------------------------------------------------- #

#: The first is the REAL defect, verbatim from the reverted `Legal.tsx` subtitle that shipped in the
#: 0a. It is kept as a specimen so the exact string that got through can never get through again.
_MUST_BITE = (
    ("the real 0a defect", "License, disclaimer, and the terms you have LedgerFrame under."),
    ("injected into served prose", "You may use the Platform under this License."),
    ("the IA §5 defect", "the licence it ships under — License, disclaimer, product position"),
    ("plural", "The Licenses that apply to your dependencies."),
    ("past participle", "This software is licensed to you at no cost."),
)

#: Strings that MUST survive. A guard that cannot tell these from the ones above would force the
#: product to misname the AGPL, break a URL, or rename a file that cannot be renamed.
_MUST_SPARE = (
    ("the AGPL's real title", "The full text of the GNU Affero General Public License, version 3."),
    ("an SPDX identifier", "SPDX-License-Identifier: AGPL-3.0-or-later"),
    ("a shipped filename", "The full record ships as LICENSES.md alongside the source."),
    ("a URL", "See https://www.gnu.org/licenses/agpl-3.0.html for the text."),
    ("a code identifier", "const licenseUrl = pointer.url;"),
    ("a snake_case identifier", "row.license_key is never read back."),
    ("correct British prose", "The Licence, the disclaimer, and the terms you have it under."),
)


@pytest.mark.parametrize("label,specimen", _MUST_BITE, ids=[label for label, _ in _MUST_BITE])
def test_the_guard_BITES_its_red_specimens(label: str, specimen: str):
    assert _offending(specimen), (
        f"the §9-7 guard did not catch the {label} specimen: {specimen!r}. A spelling guard that "
        "misses the defect it was written for is worse than none — it certifies the surface."
    )


#: Lines in the shape real copy actually ships in. The extractor must reach the copy in each.
_EXTRACTOR_SPECIMENS = (
    ("a quoted attribute", '        subtitle="License, disclaimer, and the terms."', True),
    ("JSX text content", '        <p className="x" role="status">Read the License before you begin.</p>', True),
    ("JSX text, no attributes", "        <p>Your License has changed.</p>", True),
    ("a line comment", "        // the old copy said License, kept here as lineage", False),
    ("an import path", '        import { License } from "./legal/License";', False),
)


@pytest.mark.parametrize(
    "label,line,must_bite", _EXTRACTOR_SPECIMENS, ids=[s[0] for s in _EXTRACTOR_SPECIMENS]
)
def test_the_EXTRACTOR_reaches_copy_in_every_shape_it_ships_in(label: str, line: str, must_bite: bool):
    """The coverage claim, tested directly rather than assumed.

    This is the test that would have caught this module's own first version. That version read
    quoted literals only and would have passed every assertion in this file while being blind to
    every `<p>`-rendered sentence in the app — a guard reporting green over copy it could not see.
    Scanning a file and reading its copy are different claims, and only the second one matters.
    """
    import tempfile

    with tempfile.NamedTemporaryFile("w", suffix=".tsx", delete=False) as fh:
        fh.write(line + "\n")
        tmp = Path(fh.name)
    try:
        # `_offending_strings` reports paths relative to REPO; a tmp file is outside it, so the
        # extraction is exercised through `_copy_on_line` directly.
        hits = [h for frag in _copy_on_line(line) for h in _offending(frag)]
    finally:
        tmp.unlink(missing_ok=True)
    if must_bite:
        assert hits, f"the extractor did not reach copy shaped as {label}: {line!r}"
    else:
        assert not hits, f"the extractor wrongly treated {label} as user copy: {line!r}"


@pytest.mark.parametrize("label,specimen", _MUST_SPARE, ids=[label for label, _ in _MUST_SPARE])
def test_the_guard_SPARES_the_contexts_that_are_correct(label: str, specimen: str):
    assert not _offending(specimen), (
        f"the §9-7 guard falsely flagged {label}: {specimen!r}. Over-firing is not the safe "
        "direction here — it pressures the next author into misnaming a real document, breaking a "
        "URL, or renaming a file whose name is fixed by convention."
    )

# SPDX-License-Identifier: AGPL-3.0-or-later
"""COPY-HYGIENE GUARD — governance-speak must never reach user-facing strings (page-home §12ho1-1).

The owner caught Home's subtitle shipping the *internal governance* vocabulary of the specs
("every figure is **owned** by the page it links to" — P-1/D-038) as user copy. It was not one
slip: the same defect class was live in **nine** files ("the **reader** is unreachable", "**canonical**
on Markets & Portfolio", …). The words are how WE talk about the architecture; they are not how the
product talks to the person reading it.

The honest INTENT stays — an empty always says why, a summary always says where the full detail
lives. Only the wording becomes plain.

PLACEMENT: CI-unit, and pytest rather than Vitest for the same reason as the glossary parity guard —
it reads frontend source files off disk, which Vitest cannot do without `@types/node` (a new
dependency ⇒ ADR) or a widened Vite `server.fs.allow`. See page-heatmap §13-1.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
SRC = REPO / "frontend" / "src"

#: Internal architecture vocabulary. Fine in code comments, plan docs and test names — never in a
#: string the user reads.
BANNED = re.compile(r"\b(canonical|readers?|owned by|owns nothing)\b", re.IGNORECASE)

#: A double-quoted JS/TS string literal.
_STRING = re.compile(r'"([^"\n]{8,200})"')


def _user_facing_files() -> list[Path]:
    files = [*(SRC / "routes").glob("*.tsx"), *(SRC / "components" / "ui").glob("*.tsx")]
    return [f for f in files if ".test." not in f.name]


def _offending_strings(path: Path) -> list[str]:
    """Quoted strings containing governance-speak, ignoring comment lines and non-copy attributes."""
    out: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.lstrip()
        if stripped.startswith(("//", "*", "/*")):
            continue  # a code comment is where this vocabulary BELONGS
        for literal in _STRING.findall(line):
            # Skip non-copy attribute values (imports, class names, routes, test ids).
            if literal.startswith(("./", "../", "/", "#/")) or " " not in literal:
                continue
            if BANNED.search(literal):
                out.append(f"{path.relative_to(REPO)}: {literal!r}")
    return out


@pytest.mark.parametrize("path", _user_facing_files(), ids=lambda p: p.name)
def test_no_governance_speak_in_user_copy(path: Path):
    """No user-facing string says "canonical", "reader(s)" or "owned by" (page-home §12ho1-1)."""
    offenders = _offending_strings(path)
    assert not offenders, (
        "Governance-speak leaked into user copy — these words describe the ARCHITECTURE to us, not "
        "the product to its reader. Keep the honest intent, plainly worded:\n  " + "\n  ".join(offenders)
    )

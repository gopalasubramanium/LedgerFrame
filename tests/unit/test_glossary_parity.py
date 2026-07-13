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

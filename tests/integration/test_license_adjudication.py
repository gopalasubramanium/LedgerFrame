# SPDX-License-Identifier: AGPL-3.0-or-later
"""release-readiness Gate A8 — adjudication is an ARTIFACT, not a conversation.

The audit used to end with *"1 runtime finding needs a human"* and exit 1. A human would then say
something in a chat window, and everyone would move on. **Nothing recorded who decided what, when, or
why** — and nothing stopped the finding being quietly forgotten, or the decision outliving the fact it
was made about.

So the audit now fails on any finding without a **recorded ruling** in
``scripts/license-adjudications.toml``, and **"clean" means ZERO UNADJUDICATED FINDINGS — never "zero
findings"**. The graph will always contain licences that need a decision; the gate is that each one
*has* one.

**The three states are proven here**, because a mechanism nobody has watched fail is not a mechanism:

1. **RED** with no rulings (today's baseline — 1 runtime + 3 dev findings, 21 unruled families);
2. **GREEN** once the owner's rulings land;
3. **RED again** when a ruling stops describing reality — mutate a ``licence`` field and the stamp no
   longer matches the thing it stamped.

State 3 is the one that matters most over time. **A rubber stamp that outlives what it stamped is
worse than no stamp: it looks like diligence.**
"""

from __future__ import annotations

import os
import subprocess
import sys
import tomllib
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
TOOL = REPO / "scripts" / "license_audit.py"
RULINGS = REPO / "scripts" / "license-adjudications.toml"


def _audit(adjudications: Path | str | None) -> subprocess.CompletedProcess:
    env = dict(os.environ)
    env["LF_ADJUDICATIONS"] = str(adjudications) if adjudications else "/nonexistent"
    return subprocess.run(
        [sys.executable, str(TOOL)], cwd=REPO, capture_output=True, text=True, env=env
    )


# --- state 1: RED with no rulings ---------------------------------------------------------------


def test_RED_when_nothing_is_adjudicated() -> None:
    """The baseline this mechanism exists to fix."""
    r = _audit(None)
    assert r.returncode == 1, "the audit passed with ZERO recorded rulings"
    assert "UNADJUDICATED (RUNTIME)" in r.stdout
    assert "certifi" in r.stdout, "the one runtime finding must be named, not merely counted"
    assert "new platform-conditional family with no ruling" in r.stdout.lower()


# --- state 2: GREEN once the rulings land -------------------------------------------------------


def test_GREEN_with_the_owner_rulings_recorded() -> None:
    r = _audit(RULINGS)
    assert r.returncode == 0, f"the adjudicated audit is not clean:\n{r.stdout[-1500:]}"
    assert "CLEAN — zero UNADJUDICATED findings" in r.stdout


def test_clean_does_NOT_mean_zero_findings() -> None:
    """The distinction the owner asked to be stated in the output itself.

    The findings are still there. They are simply all adjudicated. Anyone reading this output must not
    be able to come away thinking the dependency graph is free of copyleft.
    """
    r = _audit(RULINGS)
    assert "does NOT mean 'no flagged licences'" in r.stdout
    assert "certifi" in r.stdout, "an adjudicated finding is still REPORTED, not hidden"


# --- state 3: RED again when a ruling stops describing reality -----------------------------------


def test_RED_again_when_a_rulings_LICENCE_no_longer_matches(tmp_path: Path) -> None:
    """Mutate the licence a ruling claims, and the stamp must stop clearing the package.

    This is the anti-rubber-stamp assertion: a ruling clears ONLY the exact thing it described.
    """
    doc = RULINGS.read_text().replace(
        'licence = "Mozilla Public License 2.0 (MPL 2.0)"\nversions = "*"\nruling = "ACCEPT"\ndecided_by = "owner"\ndate = "2026-07-14"\nrationale = """\nThe only RUNTIME finding',
        'licence = "MIT"\nversions = "*"\nruling = "ACCEPT"\ndecided_by = "owner"\ndate = "2026-07-14"\nrationale = """\nThe only RUNTIME finding',
        1,
    )
    assert 'licence = "MIT"' in doc, "the test failed to mutate the ruling — it would prove nothing"

    mutated = tmp_path / "mutated.toml"
    mutated.write_text(doc)

    r = _audit(mutated)
    assert r.returncode == 1, "a ruling that misdescribes the package still cleared it"
    assert "STALE RULING" in r.stdout
    assert "certifi" in r.stdout


def test_RED_when_a_ruling_outlives_its_package(tmp_path: Path) -> None:
    """A ruling for something we no longer depend on is dead weight, and the audit says so."""
    doc = RULINGS.read_text() + """

[[ruling]]
package = "a-package-we-do-not-depend-on"
ecosystem = "python"
scope = "runtime"
licence = "GPL-3.0"
versions = "*"
ruling = "ACCEPT"
decided_by = "owner"
date = "2020-01-01"
rationale = "left behind"
"""
    stale = tmp_path / "stale.toml"
    stale.write_text(doc)

    r = _audit(stale)
    assert r.returncode == 1
    assert "no longer a dependency" in r.stdout


def test_RED_when_a_NEW_platform_family_appears(tmp_path: Path) -> None:
    """The platform-conditional category is enumerated, not waved through: a NEW family blocks."""
    doc = RULINGS.read_text().replace('family = "@esbuild/*"', 'family = "@something-else/*"', 1)
    dropped = tmp_path / "dropped.toml"
    dropped.write_text(doc)

    r = _audit(dropped)
    assert r.returncode == 1
    assert "@esbuild/*" in r.stdout


# --- the rulings file is itself a real artifact ---------------------------------------------------


def test_every_ruling_records_WHO_decided_WHEN_and_WHY() -> None:
    """A ruling without a rationale is a rubber stamp with extra steps."""
    doc = tomllib.loads(RULINGS.read_text())
    for r in doc["ruling"] + doc["platform_family"]:
        name = r.get("package") or r["family"]
        assert r.get("decided_by") == "owner", f"{name}: no deciding party recorded"
        assert r.get("date"), f"{name}: no decision date"
        assert len((r.get("rationale") or "").strip()) > 20, f"{name}: no real rationale"
        assert r["ruling"].upper() in ("ACCEPT", "REJECT"), f"{name}: not a ruling"


def test_the_runtime_ruling_is_marked_as_NOT_legal_counsel() -> None:
    """The owner's own framing, and it must survive in the file rather than in a chat log."""
    doc = tomllib.loads(RULINGS.read_text())
    certifi = next(r for r in doc["ruling"] if r["package"] == "certifi")
    assert "not legal counsel" in certifi["rationale"].lower()

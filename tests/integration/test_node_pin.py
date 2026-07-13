# SPDX-License-Identifier: AGPL-3.0-or-later
"""release-readiness Gate A7 (RD-4) — the Node version is pinned, and the claim is TRUE.

FAIL-FIRST. Before the fix:

* ``frontend/package.json`` had **no ``engines`` field** and there was **no ``.nvmrc``** — nothing
  pinned Node at all (§1-2f).
* ``scripts/install.sh:263`` warned only below **Node 18**, and told the user *"ensure … Node 18+"*.
  **That claim was already false.** Vite's own floor is ``^20.19.0 || >=22.12.0``, so a user on Node
  18 or 21 would follow our instructions and then fail to build the frontend.

RD-4 asks for the **narrowest TRUE claim**. A stated minimum the toolchain cannot actually run on is
the same defect class as a fabricated figure — it is a number we did not check, presented as fact.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
PKG = REPO / "frontend" / "package.json"
NVMRC = REPO / ".nvmrc"
INSTALL = REPO / "scripts" / "install.sh"

#: The real floor, taken from the toolchain itself (vite's `engines.node`), not from a guess.
REQUIRED = "^20.19.0 || >=22.12.0"


def test_frontend_declares_an_engines_floor() -> None:
    pkg = json.loads(PKG.read_text())
    assert "engines" in pkg, "frontend/package.json pins no Node version at all"
    assert pkg["engines"].get("node") == REQUIRED, (
        f"engines.node must state the toolchain's ACTUAL floor ({REQUIRED}), not a guess"
    )


def test_the_engines_floor_matches_what_the_toolchain_really_requires() -> None:
    """Pinned to vite's own declaration, so this cannot drift into a comfortable fiction."""
    vite = REPO / "frontend" / "node_modules" / "vite" / "package.json"
    if not vite.is_file():
        return  # deps not installed in this environment; the assertion above still holds the line
    assert json.loads(vite.read_text())["engines"]["node"] == REQUIRED, (
        "vite's Node floor changed — update REQUIRED and the claims that quote it, together"
    )


def test_nvmrc_exists_and_satisfies_the_floor() -> None:
    assert NVMRC.is_file(), ".nvmrc is missing — nothing tells a contributor which Node to use"
    major = int(re.sub(r"[^0-9.]", "", NVMRC.read_text().strip()).split(".")[0])
    assert major >= 22, f".nvmrc pins Node {major}, which is below the toolchain's floor"


def test_install_sh_no_longer_claims_node_18() -> None:
    """The claim that was already false.

    `install.sh` told users "Node 18+" while vite refuses to run below 20.19. Following our own
    instructions would have left them unable to build the frontend.
    """
    text = INSTALL.read_text()
    assert "Node 18+" not in text, "install.sh still claims Node 18+, which the toolchain cannot run"
    assert re.search(r"NODE_MIN_MAJOR=", text), "install.sh must state its minimum in ONE place"

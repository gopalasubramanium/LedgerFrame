# SPDX-License-Identifier: AGPL-3.0-or-later
"""release-readiness Gate B9 — the installer ASKS about a PIN (owner stance: document-plus-prompt).

FAIL-FIRST. Before this, `install.sh` never offered to set a PIN. It printed a warning *if* you turned
LAN on ("set a PIN in Settings right after install") and otherwise said nothing at all.

That is gap 7 (SECURITY-BASELINE): **the default install has no PIN**, and on a loopback-only box that
is a defensible convenience — the owner's ADR says so. **What was wrong was that nobody was ever
ASKED.** A person who would happily have set one simply never got the chance, and the only mention of
it arrived as a warning *after* they had already chosen LAN.

The owner's ratified stance (B9) is precisely calibrated, and this file pins all three halves of it:

1. **The wizard ASKS, and RECOMMENDS** — default yes.
2. **Skipping is allowed** on a loopback-only install, and the documented warning is **printed**, not
   buried. The convenience survives; the silence does not.
3. **LAN keeps the HARD requirement.** That is not a prompt, it is a gate — and the backend enforces it
   independently (`app/api/deps.py`). Those tests are untouched and must stay green: a prompt in a shell
   script is not a security control, and this change must not be mistaken for one.
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
INSTALL = REPO / "scripts" / "install.sh"
SET_PIN = REPO / "scripts" / "set_pin.py"


# --- the wizard asks --------------------------------------------------------------------------


def test_the_wizard_offers_to_set_a_PIN() -> None:
    """It never did. The whole finding, in one assertion."""
    text = INSTALL.read_text()
    assert re.search(r"ask_yn\s+\"[^\"]*PIN", text), (
        "install.sh never OFFERS to set a PIN — a user who would have set one is never asked"
    )


def test_the_PIN_step_is_RECOMMENDED_by_default() -> None:
    """Encouraged, not merely available: the default answer is yes."""
    text = INSTALL.read_text()
    m = re.search(r"ask_yn\s+\"([^\"]*PIN[^\"]*)\"\s+\"(\w)\"", text)
    assert m, "the PIN question has no default"
    assert m.group(2) == "y", "the PIN step must DEFAULT TO YES — the stance is 'encouraged'"


def test_skipping_is_allowed_but_the_warning_is_PRINTED() -> None:
    """The convenience survives; the silence does not.

    Skipping on loopback must leave the user PIN-less *and told about it* — not PIN-less and unaware.
    """
    text = INSTALL.read_text()
    assert "SKIP_PIN_WARNING" in text, (
        "skipping the PIN prints no warning — the user is left unaware, which is the actual defect"
    )
    warn_block = text[text.index("SKIP_PIN_WARNING") :][:600]
    assert "loopback" in warn_block.lower() or "this device only" in warn_block.lower()


def test_LAN_makes_the_PIN_NON_optional_in_the_wizard() -> None:
    """LAN is a gate, not a prompt. The wizard must not let someone opt out of it."""
    text = INSTALL.read_text()
    assert re.search(r"ENABLE_LAN\"?\s*==\s*true.*\n?.*(PIN_REQUIRED|REQUIRE_PIN)", text) or (
        "PIN_REQUIRED" in text
    ), "the wizard does not force a PIN when LAN is enabled"


def test_the_wizard_actually_sets_the_pin_via_the_real_hasher() -> None:
    """It must not invent its own PIN storage — that is how a second, weaker code path is born."""
    assert SET_PIN.is_file(), "scripts/set_pin.py is missing"
    assert "set_pin.py" in INSTALL.read_text(), "install.sh does not call the PIN helper"
    assert "hash_pin" in SET_PIN.read_text(), (
        "the helper must use the app's own Argon2 hasher, not roll its own"
    )


# --- the helper does what it says -------------------------------------------------------------


def _run_set_pin(pin: str, data_dir: Path) -> subprocess.CompletedProcess:
    import os

    env = dict(os.environ)
    env["LEDGERFRAME_DATA_DIR"] = str(data_dir)
    env["LEDGERFRAME_SECRET_KEY"] = "x" * 48
    return subprocess.run(
        [sys.executable, str(SET_PIN)], input=pin, cwd=REPO, env=env, capture_output=True, text=True
    )


def test_the_helper_REFUSES_a_weak_pin(tmp_path: Path) -> None:
    """D-002's floor is 6 digits. The installer must not be the one place it can be undercut."""
    r = _run_set_pin("123", tmp_path)
    assert r.returncode != 0, "a 3-digit PIN was accepted"
    assert "6" in (r.stderr + r.stdout)


def test_the_helper_sets_a_real_ARGON2_hash_and_never_the_pin(tmp_path: Path) -> None:
    """The PIN is hashed with the app's own hasher, and the plaintext never reaches the database."""
    r = _run_set_pin("135791", tmp_path)
    assert r.returncode == 0, f"set_pin failed: {r.stderr[-400:]}"

    import sqlite3

    db = tmp_path / "db" / "ledgerframe.db"
    assert db.is_file(), "the helper did not create/migrate the database"
    rows = sqlite3.connect(db).execute("select pin_hash from users").fetchall()
    assert rows and rows[0][0], "no PIN hash was stored"
    stored = rows[0][0]
    assert stored.startswith("$argon2"), f"not an Argon2 hash: {stored[:20]!r}"
    assert "135791" not in stored, "the PIN itself is recoverable from the stored value"

    from app.core.security import verify_pin

    assert verify_pin("135791", stored)
    assert not verify_pin("000000", stored)

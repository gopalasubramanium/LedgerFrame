# SPDX-License-Identifier: AGPL-3.0-or-later
"""release-readiness Gate A6 (RD-6) — no migration without a fresh backup.

FAIL-FIRST. Before the fix, ``scripts/update.sh:71`` read::

    owner_sh "cd '$REPO_DIR' && ./scripts/backup.sh" && log "backup created" || log "backup skipped"

It **tried** to back up, **swallowed the failure**, and then **migrated anyway**. "Backup skipped" was
printed into a log nobody reads, and a forward-only migration then ran against un-backed-up data.

RD-6 makes the upgrade lifecycle forward-only with **no supported downgrade** — which means the backup
is not a nicety, it is *the entire rollback story*. A migration that runs without one is a migration
with no way back. So the gate now **aborts**, and the only way past it is to say so explicitly with
``--no-backup``.

The sequencing assertion matters as much as the gate itself: a gate that runs *after* the migration is
not a gate.
"""

from __future__ import annotations

import os
import re
import subprocess
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
GATE = REPO / "scripts" / "lib" / "backup_gate.sh"
UPDATE = REPO / "scripts" / "update.sh"


def _run(snippet: str, backups: Path, extra: dict[str, str] | None = None) -> int:
    env = {
        "PATH": os.environ["PATH"],
        "HOME": os.environ.get("HOME", "/tmp"),
        "LF_BACKUPS_DIR": str(backups),
    }
    env.update(extra or {})
    return subprocess.run(
        ["bash", "-c", f"source '{GATE}'; {snippet}"], env=env, capture_output=True, text=True
    ).returncode


def test_the_gate_exists() -> None:
    assert GATE.is_file(), "scripts/lib/backup_gate.sh is missing — nothing is guarding the migration"


def test_no_backup_at_all_means_ABORT(tmp_path: Path) -> None:
    """The defect, in one line: an empty backups dir must stop the update dead."""
    backups = tmp_path / "backups"
    backups.mkdir()
    assert _run("lf_require_fresh_backup", backups) != 0, (
        "the update proceeded with NO backup — a forward-only migration with no way back"
    )


def test_a_STALE_backup_is_not_a_backup(tmp_path: Path) -> None:
    """A backup from last month does not protect the migration you are about to run."""
    backups = tmp_path / "backups"
    backups.mkdir()
    old = backups / "ledgerframe-20260101T000000Z.db"
    old.write_text("x")
    old.touch()
    os.utime(old, (time.time() - 86_400 * 30, time.time() - 86_400 * 30))

    assert _run("lf_require_fresh_backup", backups) != 0, "a 30-day-old backup was accepted as fresh"


def test_a_FRESH_backup_lets_the_update_proceed(tmp_path: Path) -> None:
    backups = tmp_path / "backups"
    backups.mkdir()
    (backups / "ledgerframe-now.db").write_text("x")

    assert _run("lf_require_fresh_backup", backups) == 0, "a fresh backup was rejected"


def test_the_no_backup_override_is_honoured(tmp_path: Path) -> None:
    """The user may skip it — but only by SAYING so. That is the whole difference."""
    backups = tmp_path / "backups"
    backups.mkdir()
    assert _run("LF_NO_BACKUP=1 lf_require_fresh_backup", backups) == 0


# --- update.sh actually uses it, and uses it BEFORE migrating ----------------------------------


def test_update_sh_calls_the_gate() -> None:
    assert "lf_require_fresh_backup" in UPDATE.read_text(), "update.sh does not call the backup gate"


def test_update_sh_advertises_the_override() -> None:
    assert "--no-backup" in UPDATE.read_text(), "the override must be documented in the script"


def test_the_gate_runs_BEFORE_the_migration() -> None:
    """A gate that fires after the migration is not a gate.

    This is the assertion that would have caught the original bug even if the backup had 'worked':
    the old script's backup line was there, and it still migrated when the backup failed.
    """
    text = UPDATE.read_text()
    gate_at = text.index("lf_require_fresh_backup")
    migrate_at = re.search(r"db_migrate\.py", text)
    assert migrate_at, "update.sh no longer migrates?"
    assert gate_at < migrate_at.start(), (
        "the backup gate runs AFTER the migration — by then there is nothing left to protect"
    )

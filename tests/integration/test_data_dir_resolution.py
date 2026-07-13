# SPDX-License-Identifier: AGPL-3.0-or-later
"""release-readiness Part B/1 — ONE data-dir resolution path, honoured by EVERY script.

FAIL-FIRST. Before the fix, the repo had **five** different answers to "where is the data dir?" and
only one of them read ``.env`` at all:

* ``scripts/doctor.sh:8``          → ``${LEDGERFRAME_DATA_DIR:-/mnt/ledgerframe-data}``
* ``scripts/benchmark.sh:8``       → ``${LEDGERFRAME_DATA_DIR:-/mnt/ledgerframe-data}``
* ``scripts/reset-demo-data.sh:7`` → ``${LEDGERFRAME_DATA_DIR:-$REPO_DIR/data}``
* ``scripts/start-dev.sh:8``       → ``${LEDGERFRAME_DATA_DIR:-$REPO_DIR/data}``
* ``scripts/update.sh:93``         → ``sed`` out of ``.env`` (the ONLY one that read it)
* ``app/core/config.py:40``        → ``/mnt/ledgerframe-data``, correctly loaded from ``.env``

The bash scripts read only the EXPORTED variable. So a user who set ``LEDGERFRAME_DATA_DIR`` in
``.env`` — which is the documented contract — and then ran ``./scripts/reset-demo-data.sh`` from a
plain shell hit that script's *own* fallback and operated on **the wrong directory**. That is the
page-review close-out gotcha, and it was never a one-off: it was a class.

These tests were RED against that baseline (no ``scripts/lib/datadir.sh`` existed; every script
computed its own fallback) and GREEN after: one primitive, sourced by all of them, resolving to one
documented default that is pinned to the app's own.
"""

from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
PRIMITIVE = REPO / "scripts" / "lib" / "datadir.sh"

#: Every script that needs to know where the data lives. They MUST NOT each answer it themselves.
CONSUMERS = [
    "doctor.sh",
    "reset-demo-data.sh",
    "benchmark.sh",
    "start-dev.sh",
    "dev.sh",
    "install.sh",
    "update.sh",
]


def _bash(snippet: str, cwd: Path, env: dict[str, str] | None = None) -> str:
    """Run a bash snippet and return its stdout, stripped."""
    e = {"PATH": os.environ["PATH"], "HOME": os.environ.get("HOME", "/tmp")}
    e.update(env or {})
    r = subprocess.run(
        ["bash", "-c", snippet], cwd=cwd, env=e, capture_output=True, text=True, check=True
    )
    return r.stdout.strip()


def test_the_shared_primitive_exists() -> None:
    """There is ONE place that answers 'where is the data dir?'."""
    assert PRIMITIVE.is_file(), (
        "scripts/lib/datadir.sh is missing — every script is inventing its own answer"
    )


@pytest.mark.parametrize("script", CONSUMERS)
def test_no_script_invents_its_own_data_dir_fallback(script: str) -> None:
    """No script may carry its own ``${LEDGERFRAME_DATA_DIR:-...}`` fallback.

    This is the assertion that was RED: a per-script fallback IS the divergence. The one legitimate
    place to name a default is the primitive itself.
    """
    text = (REPO / "scripts" / script).read_text()
    invented = re.findall(r"\$\{LEDGERFRAME_DATA_DIR:-[^}]*\}", text)
    assert not invented, f"{script} invents its own data-dir fallback: {invented}"


@pytest.mark.parametrize("script", CONSUMERS)
def test_every_consumer_sources_the_primitive(script: str) -> None:
    text = (REPO / "scripts" / script).read_text()
    assert "lib/datadir.sh" in text, f"{script} does not source the shared data-dir primitive"


def test_the_primitive_honours_dot_env(tmp_path: Path) -> None:
    """The documented contract: ``LEDGERFRAME_DATA_DIR`` in ``.env`` is what the tools use.

    This is the user-visible bug in one assertion — the bash scripts read only the EXPORTED variable,
    so a value that lived only in ``.env`` was silently ignored.
    """
    fake = tmp_path / "repo"
    (fake / "scripts" / "lib").mkdir(parents=True)
    (fake / "scripts" / "lib" / "datadir.sh").write_text(PRIMITIVE.read_text())
    (fake / ".env").write_text(f"LEDGERFRAME_DATA_DIR={tmp_path}/from-dot-env\n")

    got = _bash("source scripts/lib/datadir.sh; lf_data_dir", cwd=fake)
    assert got == f"{tmp_path}/from-dot-env"


def test_an_exported_variable_still_wins_over_dot_env(tmp_path: Path) -> None:
    """Precedence matches the app's own (pydantic-settings): the environment beats the file."""
    fake = tmp_path / "repo"
    (fake / "scripts" / "lib").mkdir(parents=True)
    (fake / "scripts" / "lib" / "datadir.sh").write_text(PRIMITIVE.read_text())
    (fake / ".env").write_text(f"LEDGERFRAME_DATA_DIR={tmp_path}/from-dot-env\n")

    got = _bash(
        "source scripts/lib/datadir.sh; lf_data_dir",
        cwd=fake,
        env={"LEDGERFRAME_DATA_DIR": f"{tmp_path}/exported"},
    )
    assert got == f"{tmp_path}/exported"


def test_the_bash_default_is_the_SAME_default_the_app_uses() -> None:
    """ONE documented default — the scripts and the app may never drift apart.

    Without this, the primitive would simply become a *sixth* answer.
    """
    from app.core.config import Settings

    app_default = str(Settings.model_fields["data_dir"].default)

    fake_repo = REPO  # no .env override needed: we ask the primitive for its built-in default
    got = _bash(
        "source scripts/lib/datadir.sh; LF_DATA_DIR_IGNORE_DOT_ENV=1 lf_data_dir", cwd=fake_repo
    )
    assert got == app_default, (
        f"the scripts default to {got!r} but the app defaults to {app_default!r} — "
        "that is exactly the divergence this primitive exists to end"
    )

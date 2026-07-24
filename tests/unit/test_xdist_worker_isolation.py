# SPDX-License-Identifier: AGPL-3.0-or-later
"""R-65 Phase 2 — the per-worker DB/data-dir isolation guard (F-10-grade, blindness-pinned).

Asserts that pytest-xdist workers cannot collide on the data dir / DB. Two pure-function tests run at
EVERY solo gate (not vacuous — they exercise `worker_data_dir` deterministically regardless of how
the suite is invoked); one observational test verifies the LIVE wiring under xdist and skips solo.

Blindness pin (pinned against going blind, CLAUDE.md): the pure tests fail loudly if the derivation
ever stops folding the worker id into the path — the exact regression that would silently re-share
one DB across N workers. See `tests/xdist_isolation.py`, `docs/plans/r65-test-runtime.md`.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from tests.xdist_isolation import worker_data_dir, worker_id


def test_two_workers_never_share_a_data_dir() -> None:
    """The core isolation property: distinct worker ids → distinct data dirs, id present in each.

    Meaningful at the SOLO gate — it drives the derivation directly, not via `PYTEST_XDIST_WORKER`."""
    base = Path("/tmp/lf-xdist-guard-base")
    a = worker_data_dir(base, "gw0")
    b = worker_data_dir(base, "gw1")

    assert a != b, (
        f"two xdist workers resolved to the SAME data dir ({a}) — they would share one SQLite file "
        "and the autouse clean-slate would drop+create it from both processes (R-65 blocker)"
    )
    # Blindness pin: the worker id MUST be in the path. A derivation that ignored the worker id (e.g.
    # returned `base` unchanged) could pass the `a != b` check by luck of two mkdtemp bases in the
    # real wiring, while silently re-sharing under a shared base. Requiring the id makes the
    # isolation observable-by-design, not incidental.
    assert "gw0" in str(a) and "gw1" in str(b), (
        f"worker id absent from the derived paths ({a}, {b}) — isolation is not keyed on the worker "
        "and could regress to a shared DB without turning any test red (F-10 blindness pin)"
    )


def test_solo_path_is_byte_identical() -> None:
    """The solo path is SACRED: no worker id → the base dir is returned UNCHANGED, so a plain
    `pytest` run behaves exactly as it did before xdist (owner ruling: verdicts stay solo)."""
    base = Path("/tmp/lf-xdist-guard-base")
    assert worker_data_dir(base, "") == base


def test_live_effective_db_path_carries_the_worker_id_under_xdist() -> None:
    """Observational: under a REAL xdist run, the live effective `db_path` must contain this
    worker's id — proving the conftest wiring actually forced the per-worker dir past the inherited
    env var. Skips solo, where the two pure tests above already pin the mechanism."""
    worker = worker_id()
    if not worker:
        pytest.skip("not under xdist; the pure-function guards cover the isolation mechanism solo")

    from app.core.config import get_settings

    db_path = str(get_settings().db_path)
    assert worker in db_path, (
        f"under xdist worker {worker!r}, but the live effective db_path {db_path!r} lacks the worker "
        "id — the per-worker isolation is NOT wired; N workers are sharing ONE DB (R-65 regression). "
        f"LEDGERFRAME_DATA_DIR={os.environ.get('LEDGERFRAME_DATA_DIR')!r}"
    )

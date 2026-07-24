# SPDX-License-Identifier: AGPL-3.0-or-later
"""R-65 Phase 2 — per-worker DB/data-dir isolation for pytest-xdist (INNER-LOOP only).

Under xdist the CONTROLLER process imports `conftest` during collection, runs `mkdtemp()`, and sets
`LEDGERFRAME_DATA_DIR` in its own environ. Workers are spawned inheriting that environ, so a plain
`os.environ.setdefault(...)` in the worker is a NO-OP — all N workers would share the controller's
ONE data dir / SQLite file, and the autouse `_shared_db_clean_slate` would drop+create that single
DB from N processes concurrently (observed: `OperationalError`, cross-worker collisions).

The fix keys the effective data dir by `PYTEST_XDIST_WORKER`. ONE declaration, consumed by BOTH:
  * `conftest` (module import) — forces the per-worker dir past the inherited env var; and
  * the census guard (`tests/unit/test_xdist_worker_isolation.py`) — asserts the isolation holds.

Gate/close verdicts stay SOLO (owner ruling, R-65 hard fence); xdist never carries a verdict. The
SOLO path is SACRED: `worker_id() == ""` → `worker_data_dir` returns the base UNCHANGED, so a plain
`pytest` run is byte-identical to pre-xdist.
"""

from __future__ import annotations

import os
from pathlib import Path


def worker_id() -> str:
    """The xdist worker id (`gw0`, `gw1`, …), or `""` under plain/solo pytest.

    xdist sets `PYTEST_XDIST_WORKER` in each worker's environment before the worker imports
    conftest, so this is available at conftest MODULE-IMPORT time — early enough to key the data
    dir before any app config is read."""
    return os.environ.get("PYTEST_XDIST_WORKER", "")


def worker_data_dir(base: Path, worker: str) -> Path:
    """The effective `LEDGERFRAME_DATA_DIR` for a pytest process.

    SOLO (`worker == ""`) returns `base` UNCHANGED — the solo path is byte-identical to pre-xdist.
    Under xdist, NEST the worker id into the path so that (a) two workers can never resolve to the
    same dir (no shared DB), and (b) the census guard can ASSERT the id is present — isolation by
    DESIGN, not by the luck of two independent `mkdtemp` calls. The worker id is a fixed xdist token
    (`gw<N>`), safe as a single path segment."""
    return base if not worker else base / worker

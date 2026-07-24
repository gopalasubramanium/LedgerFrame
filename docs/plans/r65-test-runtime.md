# R-65 — Test-suite runtime: measure, then parallelize

**Type:** TEST-INFRA (no product code, no served surfaces, no copy).
**Charter:** `ROADMAP.md` R-65. **Owner ruling** 2026-07-23 (chat) + Phase-2 slotting 2026-07-24
(after R-63 close, before R-59). Cross-ref: memory `backend-suite-run-mechanics`,
`gate-runs-must-be-solo`; F-10 (`63ec86a`); `tests/isolation.py`; `tests/conftest.py`.

---

## Phase 1 — SURVEY (DONE 2026-07-23, no dedicated run)

Recorded in full in the ROADMAP R-65 row. In brief:
- **(a) durations** — full run ~18 min / 2130 tests; NO single sink. Slowest 30 ≈ 316s (~29%),
  almost all heavy AI fact-pack / performance / tier-1 integration (full portfolio derivation per
  test) + the genuine concurrency tests (`test_history_cache_race`).
- **(b) real-sleep debt** — **ZERO** wall-clock sleeps in test code; the only `sleep` sites are
  already monkeypatched. The suite is **NOT sleep-bound**; the cost is per-test DDL reset
  (`_shared_db_clean_slate`, ~3%/test) × 2130 + heavy integration derivation. The census is empty
  — nothing to convert to a mocked clock. **That emptiness is the finding.**
- **(c) xdist feasibility** — **FEASIBLE as an inner-loop accelerant.** The ONE blocker is the
  **shared DB keyed by URL**: the autouse clean-slate drops+creates ONE DB; N workers collide.
  Process globals are already safe (xdist workers are separate processes → module globals per
  worker; F-10's `RESET_REGISTRY` + census guard hold per-test isolation). Migration/db tests
  already repoint `DATA_DIR` at their own `tmp_path`.

---

## Phase 2 — SHAPE (this session)

### Scope (owner-ruled 2026-07-24, ROADMAP R-65)

1. **Per-worker DB / `LEDGERFRAME_DATA_DIR` isolation keyed by `PYTEST_XDIST_WORKER`** so N workers
   never share a database or data dir. **Workers absent (plain pytest) behave byte-identically to
   today — the solo path is sacred.**
2. **An F-10-style census guard** that ASSERTS per-worker isolation — blindness-pinned, meaningful
   at the SOLO gate (not vacuous), and failing loudly if the mechanism disappears.
3. **xdist config + a documented inner-loop invocation** (`-n auto`) in the run-mechanics docs.
4. **Migration/DB tests** verified (not assumed) under xdist.

### The blocker, precisely

`tests/conftest.py:13-14` runs `mkdtemp()` then `os.environ.setdefault("LEDGERFRAME_DATA_DIR", …)`
at **module import**. Under xdist the **controller** process imports conftest during collection →
`mkdtemp` → sets `LEDGERFRAME_DATA_DIR` in the controller env. Workers are spawned inheriting the
controller env, so their own `setdefault` is a **no-op** → **all N workers share the controller's
ONE data dir / DB**. The clean-slate then drop+creates that single DB from N processes → collisions.

### The fix

A pure, testable derivation `worker_data_dir(base, worker)` in `tests/xdist_isolation.py`:
- `worker == ""` (solo / controller) → returns `base` unchanged → **byte-identical solo path**.
- worker present → nests the worker id into the path (`base / worker`), so (a) two workers can
  never resolve to the same dir and (b) the guard can ASSERT the id is present — **isolation by
  design, not by mkdtemp luck**.

conftest, under xdist (`PYTEST_XDIST_WORKER` set), **forces** the per-worker dir past the inherited
env var; solo keeps the `setdefault` exactly as before.

### The guard — `tests/unit/test_xdist_worker_isolation.py`

- `test_two_workers_never_share_a_data_dir` — pure-function; two worker ids → two distinct dirs, and
  the id is IN each path (blindness pin: an isolation that ignored the worker id turns this RED).
  **Runs at every solo gate — not vacuous.**
- `test_solo_path_is_unchanged` — `worker_data_dir(base, "") == base` (solo sacred).
- `test_live_effective_dir_carries_the_worker_id_under_xdist` — observational: under xdist asserts
  the LIVE `settings.db_path` contains the real `PYTEST_XDIST_WORKER`; **skips** solo (the two pure
  tests cover the mechanism there).

**Count delta (attributed):** +2 passed always; +1 skipped under solo (the live test). Solo gate:
**2174 → 2176 passed / 15 → 16 skipped.**

---

## Hard fences (owner + architect, restated)

- **GATE/CLOSE VERDICTS REMAIN SOLO, uncontended, ordered AND randomized, unchanged.** xdist is an
  inner-loop accelerant ONLY. Any promotion of parallel runs to verdict status requires a paired-run
  equivalence baseline + a **separate chat ruling**; doubt defaults to the slow path. **Nothing here
  promotes anything.**
- **`_shared_db_clean_slate` semantics are UNTOUCHED.** The per-test DDL-reset cost is a possible
  Phase-3 candidate, **NOT authorized** — its own ruled delta with F-10-grade guards.
- Inner-loop xdist runs are always **stated as inner-loop** in any report that cites them.

## Dependency note (no ADR)

`pytest-xdist` added to `pyproject.toml [dev]`. **No ADR** — the same class as `pytest-randomly`
(pyproject:35-41, R-54 ruling): "a long-standing test tool, not a new capability, so it needs no
ADR." Adding it reds `test_license_audit`; `LICENSES.md` regenerated.

---

## Evidence ledger (executed 2026-07-24)

- **RED-first (blocker):** a 12-test DB-writing subset under `-n 4` BEFORE the fix → **6 passed / 6
  errors** (`OperationalError`); all workers resolved to the SAME `/tmp/lf-test-*/db/ledgerframe.db`
  (controller mkdtemp inherited via env). POST-fix: **12 passed**, each worker on its own
  `/tmp/lf-test-*/gw{N}/db/ledgerframe.db`.
- **RED-first (guard):** the census guard against a worker-ignoring derivation → RED
  (`assert base != base`); against the real derivation → 2 passed / 1 skipped (solo), 3 passed
  (under `-n 2`, the live test runs).
- **xdist demo (INNER-LOOP, stated as such):**
  - `-n auto` (=16 on a 16-core box): **2175 passed / 15 skipped / 1 failed / 1 error in 4m45s**.
    BOTH non-passes are `database is locked` (SQLite busy-timeout) on the two genuine-concurrency
    tests (`test_history_cache_race`, `test_pin_ratelimit`) under CPU oversubscription —
    **NOT cross-worker collisions** (zero `no such table`/`IntegrityError`/`UNIQUE constraint`
    signatures; per-worker DB isolation holds).
  - `-n 8` (CPU headroom): **2177 passed / 15 skipped / 0 failed / 0 error in 4m46s** — clean green.
    `-n 8` is AS FAST as `-n auto` (the suite is DDL/I/O-bound past ~8 workers), so headroom is the
    recommended inner-loop run (`make test-fast`). Speed-up ≈ **3.5×** vs the ~16–18 min solo baseline.
- **SOLO gate pair** (both orders, seed 6363) on final committed code — the REAL verdict: see §7.

**Count delta reconciliation:** solo run adds +2 passed (the two pure guard tests) and +1 skipped
(the live-under-xdist test skips solo): **2174 → 2176 passed / 15 → 16 skipped.** Under xdist all 3
guard tests run (+3 passed) — hence the `-n 8` green shows 2177 passed / 15 skipped.

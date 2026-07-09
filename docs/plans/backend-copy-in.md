# Plan — Backend copy-in + OpenAPI freeze

**Milestone.** Bring the LedgerFrame v1 backend into this v2 repo as the working
foundation, prune the tables/code the specs already decided to drop, and freeze
the inherited HTTP contract as the v2 baseline.

**Legacy source.** `~/Documents/github/LedgerFrame` — **READ-ONLY**. We copy
*from* it; we never modify it. (Legacy is itself a git repo at `973e68f`; we copy
its working tree, excluding caches.)

**Sequencing.** Three phases, **one commit per phase boundary**, tests reported
before each commit. This plan file is committed first, ahead of Phase A.

**Non-negotiables carried from CLAUDE.md / specs.** No new financial capability
in this milestone. Money math stays backend `Decimal`. Phases A and B introduce
**no spec features** — copy, then prune. Feature build (masters, `/refdata`,
route renames, entity/token UI endpoints) is later work and only *catalogued*
here (Phase C delta table).

---

## Environment facts (established by inspection)

- Python **3.12.3** locally; project `requires-python >=3.12`.
- Dependencies live in **`pyproject.toml`** (no `requirements*.txt`). Dev extras
  provide `pytest`, `pytest-asyncio`, `ruff`, `mypy`.
- App entrypoint: `app.main:app` (via `create_app()`); FastAPI. The frontend
  static mount is **optional** — `settings_static_dir()` returns `None` when
  `frontend/dist/index.html` is absent, so the API runs headless (tests + OpenAPI
  generation do not need a frontend).
- Alembic: `alembic.ini` → `script_location = app/db/migrations`; DB URL supplied
  at runtime from settings. **24 migrations, single linear chain**, head =
  **`d1e7a4c02f95`** (`instrument_annual_cost_bps`), base = `c8a035ade752`.
- Test suite: **104 test files** under `tests/{unit,integration,e2e,fixtures}`,
  `tests/conftest.py` present. `asyncio_mode = auto`. CI runs `ruff check .` then
  `pytest -q`.

---

## PHASE A — Faithful copy, tests green (one commit)

**Goal:** the v1 backend runs in this repo with the suite green, changed only by
mechanical fixes (paths/imports/build glue). No feature changes, prunes, or
renames.

### Copy set (from legacy working tree, excluding `__pycache__`/caches)

- `app/` (backend; includes `app/db/migrations/` — the Alembic tree)
- `alembic.ini`
- `tests/` (backend tests + fixtures)
- `pyproject.toml` (the dependency/build manifest)
- `.env.example`
- `scripts/` (server/ops scripts — all present scripts are ops: backup, doctor,
  install, lf-admin, restore, update, uninstall, start-dev, reset-demo-data,
  db_migrate, gen_openapi, benchmark)
- `systemd/` (4 unit files)
- `Dockerfile`, `docker-compose.yml`, `.dockerignore`

### Explicitly NOT copied

- `frontend/`, `dist/`, `node_modules/`, frontend `package.json`, build artifacts
- Any `.env` with real values (copy **only** `.env.example`)
- Database files (`*.db/*.sqlite*`) — none tracked in legacy anyway
- Stray transcript / date-named artifacts `09-Jul-2026`, `*this-session…*.txt`
  (D-079)
- Legacy docs/prose: `README.md`, `ARCHITECTURE.md`, `CHANGELOG.md`,
  `PHASE_REPORT.md`, `OPERATIONS.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CLA.md`,
  `TRADEMARKS.md`, `LICENSE`, legacy `ROADMAP.md`, `docs/`, `audit/`, `v2/` —
  **v2 writes its own docs**
- `config/` (empty), `imports/` (runtime dir), `.github/` (v2 will author its own
  CI in Phase C's spirit; not part of the byte-faithful backend)

### Mechanical fixes allowed (and expected)

- Create a **minimal v2 `README.md` stub** — `pyproject.toml` references
  `readme = "README.md"`, required for an editable install; v2 authors its own
  (does not copy legacy's).
- Extend `.gitignore` with Python/data/venv/cache rules.
- Fix only import/path breakage that stops the copied code running here. Record
  every such fix in the Phase A section of `CURRENT.md`.

### Migration strategy (decided) → ADR

**Keep the legacy Alembic chain intact** so an existing v1 database upgrades in
place; v2 changes are **new migrations on top** of head `d1e7a4c02f95`. Recorded
as `docs/adr/0001-keep-legacy-alembic-chain.md`.

### Acceptance criteria (A)

1. Copy set present; excluded set absent (spot-check `frontend/`, transcripts,
   real `.env` all absent).
2. `python -m venv .venv` + editable install of `.[dev]` succeeds.
3. `alembic heads` reports the single head `d1e7a4c02f95` (chain intact).
4. `pytest -q` result **reported in full** before commit. Target: parity with
   legacy (same pass count, no *new* failures attributable to the copy). Any
   pre-existing legacy failure/skip is noted as such, not "fixed".
5. No file under the copied tree modified except the mechanical fixes listed in
   `CURRENT.md`.
6. ADR committed; `.gitignore` covers `.venv/`, `__pycache__/`, data, caches.

---

## PHASE B — Decision-driven prune (one commit; every deletion listed)

**Goal:** delete exactly what DECISIONS already retired — nothing more. No new
spec features.

### Deletions

- **D-014** `ProviderConfig` → table `provider_configs`
- **D-015** `Note` → table `notes`
- **D-016** `AIConversation`, `AIMessage` → tables `ai_conversations`, `ai_messages`
- **D-017** `DashboardConfig`, `DashboardRotationItem` → tables
  `dashboard_configs`, `dashboard_rotation_items`

  For each: remove the model, any **dead routes/schemas** referencing it, seed
  references, and add **one additive Alembic migration** (down_revision =
  `d1e7a4c02f95`) that drops the six tables. **Data guard:** the migration counts
  rows first and **raises (fails loudly) if any target table is non-empty** —
  it never silently drops data. FK-safe drop order (children before parents:
  `ai_messages` before `ai_conversations`; `dashboard_rotation_items` before
  `dashboard_configs`). A matching `downgrade()` recreates the tables.

- **D-080** delete `verify_token()` (`app/core/security.py`), the **commented-out
  `_carry_forward` duplicate** (`app/services/analytics.py` — keep the live one),
  the **no-op `account` fetch** in `app/services/portfolio.py`.

- **D-042** remove server-side `/global` route handling **if it exists**.
  (Investigation note: legacy exposes `/markets/global` for the Markets *Global
  tab*, which the specs KEEP — that is **not** the D-042 frontend `/global`
  page. Confirm whether any bare `/global` server route exists; if not, record
  "no server-side `/global` route — nothing to remove".)

### Guardrails

- **Pruning only.** No master-data tables, no `/refdata`, no route renames here.
  Anything noticed that a later spec feature will change is written to the
  **"Phase C+ delta" note** in this file, not coded now.
- Run the **full** suite. Remove only tests that tested pruned code; list them.

### Acceptance criteria (B)

1. The six models and their references are gone; `grep` for each name across
   `app/` returns only the new migration's table-name strings.
2. New migration applies cleanly on an up-to-date DB and **raises on non-empty**
   target tables (verified with a seeded-row test on a scratch DB).
3. `alembic heads` shows the single new head; `alembic downgrade -1` then
   `upgrade head` round-trips.
4. D-080 items deleted; no remaining callers.
5. D-042 resolved (removed or documented as absent).
6. `pytest -q` reported; only pruned-code tests removed, each named in `CURRENT.md`.

---

## PHASE C — OpenAPI freeze (one commit)

**Goal:** freeze the inherited contract and make drift detectable.

### Deliverables

- **`docs/specs/API-CONTRACT.json`** — OpenAPI generated from the running app
  (post-prune), deterministic (sorted keys) so diffs are meaningful.
- **`docs/specs/API-CONTRACT.md`** — states: (1) this is the **frozen v2 baseline
  contract as inherited**; (2) a **delta table** of endpoints the specs will
  add / rename / remove, each with its **decision ID** (from IA + DECISIONS:
  `/refdata` D-005; `/snapshot`→`/net-worth` and `/planning`→`/cash-flow`
  redirects D-022/D-042/D-056; Entity CRUD D-065; API-token management D-069;
  server-side holdings CSV export D-050; watchlist management scoping D-052;
  briefing/instrument explainers on the one AI pipeline D-068; etc.);
  (3) the **rule**: any endpoint change from here on **updates this contract in
  the same commit**.
- **Drift check** — a script/`make` target that regenerates the OpenAPI doc and
  **fails if it differs** from the committed `API-CONTRACT.json`.

### Acceptance criteria (C)

1. `API-CONTRACT.json` committed; regeneration is byte-stable (re-running the
   generator produces no diff).
2. Drift check **passes** on the committed contract and **fails** on a synthetic
   change (verified once).
3. `API-CONTRACT.md` delta table present, every row carrying a decision ID; the
   same-commit update rule stated.
4. Delta summary reported to the owner to sanity-check against DECISIONS.

---

## Phase C+ delta note (things later specs will change — NOT done in A/B)

Populated as observations arise during A/B; this is the queue for post-freeze
feature work (each gated by its own plan file, per CLAUDE.md scope rule):

- **`ai.py` and `dashboard.py` routes survive the prune** — they do **not**
  reference the dropped AI/dashboard tables (AI chat is already ephemeral;
  rotation config is not read from `DashboardConfig`). They are reshaped later,
  not pruned now: Ask panel / one-AI-pipeline (D-067/P-6) and Home composition
  (D-046) will revisit them.
- **Legacy route names still in place** — `planning.router` serves `/planning`
  (rename to `/cash-flow`, D-056/D-022) and the snapshot route predates
  `/net-worth` (D-022). Renames + redirects are Phase-C-delta / feature work.
- **No `/refdata` endpoint yet** (D-005) — masters/refdata is feature work.
- **`/markets/global` stays** — it is the Markets *Global tab* data endpoint
  (D-051, KEEP); it is **not** the D-042 frontend `/global` page.

---

## Status

- Plan written; **Phase A DONE** (copy, 458 green); **Phase B DONE** (prune,
  455 green). Phase C next.

### Phase B result (deletions, exhaustive)

- **Models removed** (`app/models/__init__.py`): `ProviderConfig` (D-014),
  `Note` (D-015), `AIConversation` + `AIMessage` (D-016), `DashboardConfig` +
  `DashboardRotationItem` (D-017).
- **References cleaned:** `app/api/v1/routes/system.py` (`reset-data` import list
  + delete loop + docstring — dropped `AIConversation/AIMessage/Note`);
  `app/seed/demo.py` (dropped `DashboardConfig/DashboardRotationItem` import +
  the default-dashboard seed block + the now-unused `_DEMO_PAGES`).
- **D-080:** deleted `verify_token()` (`app/core/security.py`), the commented-out
  `_carry_forward` duplicate (`app/services/analytics.py`, live one kept), the
  no-op `account = await session.get(Account, …)` fetch + its `if account: pass`
  block (`app/services/portfolio.py`; `Account` import retained — still used).
- **D-042:** **no bare server-side `/global` route exists** — nothing to remove.
  (`/markets/global` is the kept Global-tab endpoint.)
- **Migration** `f9e1a2b3c4d5_drop_retired_tables.py` (down_revision
  `d1e7a4c02f95`): drops the six tables child-first; **data-guarded** — raises
  `RuntimeError` if any target table holds rows; `downgrade()` recreates all six.
  Verified: single head; clean upgrade drops all six; guard aborts on a seeded
  row; `downgrade -1`/`upgrade head` round-trips.
- **Tests removed (pruned-code only):** `tests/unit/test_security.py` —
  `test_token_roundtrip`, `test_token_expiry`, `test_tampered_token_rejected`
  (all exercised the deleted `verify_token`); the PIN tests stay. No other test
  referenced a pruned symbol.
- **Suite:** `pytest -q` → **455 passed, 0 failed**. OpenAPI unchanged (prune
  touched no route shape); the inherited contract test still matches.

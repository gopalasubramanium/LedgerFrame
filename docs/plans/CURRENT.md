# CURRENT — Active Plan

The spec-generation sequence is defined in `docs/plans/spec-generation.md`
(ROADMAP pre-task + specs 1–6). This file tracks live status. The next session
starts from files, not memory.

## DONE

- **ROADMAP.md** (repo root) — all 14 parked items (R-1..R-14) extracted from
  DECISIONS.md, historical-FX merged (D-020 + D-076), header rule stated
  (nothing built without a plan file in `docs/plans/`). SaaS/PaaS (D-001)
  recorded as ADR-note, not a ROADMAP item.
- **docs/specs/GLOSSARY.md** — canonical term definitions; Deprecated-terms
  table (term → replacement → decision ID); Net worth formula; both movers
  pairs with the which-list rule; three-layer freshness structure; Source /
  Provider / Routing split; Product Guarantees block verbatim.
- **docs/specs/MASTER-DATA.md** — D-005 hybrid architecture (fixed vocabs via
  /refdata + DB CHECK vs user-extensible masters via DB tables, frontend zero
  copies); every fully-decided fixed vocabulary with complete seed values;
  currency master + FX-translatability rule; country/region model; institution,
  sector, tag masters + admin screens; migration dispositions. (DEF backfill
  since completed — see below; only DEF-2/DEF-6 authoring items remain.)
- **docs/specs/INFORMATION-ARCHITECTURE.md** — IA principles P-1..P-8 + Reports
  Pack exception verbatim; full page map (page/route/nav group/purpose); per-page
  canonical ownership tables (Owns / Summarises-with-reader / Links); navigation
  spec (D-043 groups, /snapshot redirect, /global removed, rotation eligibility);
  Home Simple/Full composition + ticker strip (D-046/D-047); feature-verdict
  appendix (Batches 7–9) + a killed/dropped safeguard appendix.
- **docs/specs/PRODUCT-SPEC.md** — what LedgerFrame is + who it's for; deployment
  posture (loopback default, LAN+PIN, VPN/Tailscale, SaaS out-of-scope-not-
  precluded); Product Guarantees verbatim; deliberate-semantics register (honesty
  features, architectural invariants, calculation honesty invariants incl.
  never-overwrite-NAV, honest-NULL FX, no-FK isolation); Review threshold
  named-constants table w/ rationale (D-059, values from 04 §13); scope principle
  (D-065/P-7); first-run checklist (D-045); Settings Privacy section (D-069).
- **docs/specs/DESIGN-BRIEF.md** — the Rebuild Playbook design brief, committed
  verbatim so the design source never leaves the repo again.
- **docs/specs/DESIGN-SYSTEM.md** — principles (numbers-first, semantic-only
  colour, typographic hierarchy, provenance-first); design tokens (slate palette
  light/dark, type scale 12/13/14/16/20/28, spacing, density comfortable/compact)
  — concrete values PROPOSED, to ratify at kitchen-sink review; four page
  templates + per-page mapping; full component inventory (props + usage rules);
  the compose-components hard rule; house-SVG chart policy + D-053 treemap/ECharts
  escape hatch; WCAG-AA / keyboard / reduced-motion / high-contrast a11y baseline.
- **INFORMATION-ARCHITECTURE.md amended** — Cash flow route resolved to
  `/cash-flow` (D-022 principle), `/planning` redirects; Needs-decision item
  cleared.
- **docs/specs/SECURITY-BASELINE.md** — threat model (D-001); D-004 gap
  disposition table (all 14 → fixed-in-v2 / accepted-with-ADR); PIN policy
  (D-002, access-lock-not-encryption + disk-encryption guidance); sudo helper
  install-time opt-in + allow-list + graceful degradation (D-003); normative AI
  validation contract (D-071) + visible fallback (D-070); ingress/egress
  symmetry (P-8/D-075/D-060); no-egress toggle semantics + Privacy state
  statement; positive privacy guarantees (D-016, no telemetry, hash-chained
  audit); CI hardening (dep pinning/CVE, durable rate limiter, CORS assertion);
  server-side export sanitisation (D-050); preserved baseline measures.

**All six specs in `spec-generation.md` are now written** (GLOSSARY, MASTER-DATA,
INFORMATION-ARCHITECTURE, PRODUCT-SPEC, DESIGN-SYSTEM, SECURITY-BASELINE) plus
ROADMAP.md and DESIGN-BRIEF.md.

- **DEF backfill DONE** — extracted verbatim from the legacy v1 source
  (`~/Documents/github/LedgerFrame`, read-only reference; app source enters this
  repo later as its own milestone). Filled in place with file:line cites:
  - DEF-1 currency master seed — 22-code union, base-eligible 9 (`config.py:18`),
    +5 (`refdata.ts:8`), +8 (`PortfolioEditor.tsx:22`); FX-translatability noted
    as runtime-validated (no static list). MASTER-DATA §3.
  - DEF-3 `ACCOUNT_KINDS` (7, `accounts.py:24`); DEF-4 `POLICY_TYPES` (10) /
    `premium_frequency` (4, `insurance.py:23-25`); DEF-5 `DOC_CATEGORIES` (9) /
    `CONTACT_ROLES` (5, `estate.py:19-20`). MASTER-DATA §2.
  - DEF-7 Review constants reconciled against `review.py:25-30` — all values
    matched the audit; two proposed names corrected (`_INSURANCE_SOON_DAYS`,
    `_CORP_ACTION_RECENT_DAYS`). PRODUCT-SPEC §5.
  - Sudo allow-list — exact `_ADMIN_ACTIONS` set (`system.py:24-36`).
    SECURITY-BASELINE §4.
- **DEF-2 / DEF-6 AUTHORED** — the two remaining items were authored (PROPOSED,
  ratify at review), so §9 is now empty:
  - DEF-2 `asset_subclass` fixed vocab (6): `crypto, derivative, equity, etf,
    mutual_fund, reit`. Per-value table names each consumer — only `derivative`
    is read by the router (`router.py:131`); crypto/equity/mutual_fund are
    code-assigned display-only; etf/reit PROPOSED per D-009. bond/deposit/
    retirement deliberately excluded (their lanes route by asset_class, not
    subclass). MASTER-DATA §2.
  - DEF-6 sector master: 11 GICS sectors seeded (PROPOSED, user-extensible), with
    the `_SECTOR_MAP` 12→seed migration mapping — Technology→Information
    Technology; Crypto / Index-ETF / Commodities → no map (sector=null, no silent
    merge). MASTER-DATA §6.

- **docs/plans/REVIEW-GUIDE.md** — plain-language review companion for the
  project owner (accountant, non-developer). Reads standalone; organized by owner
  concern (promises/never-does · how money is counted · pages & v1 removals ·
  dropdown lists with full values · privacy/security · ROADMAP one page). Every
  item carries an in-practice example, a decision ID, and an Approve/Challenge
  checkbox. Opens with an ATTENTION shortlist (~11 items: DEF-2 etf/reit, DEF-6
  GICS seed + three-null migration, Review thresholds, FX/tax posture, insurance
  exclusion, currency seed, cost-basis fifo/average, region derivation, the two
  spec interpretations). Includes an auditor's "how the numbers can be trusted"
  section (extracted/standard/authored trust tiers + 3 file:line spot-checks) and
  a one-page sign-off summary. Reading aid only — specs stay authoritative.

- **Batch 12 (D-081–D-088) — review-challenge resolutions** — the owner's
  REVIEW-GUIDE challenges recorded as a DECISIONS.md addendum and folded into the
  affected specs:
  - **D-081** insurance cash value → visible **valued** line on Net worth,
    excluded from the headline total (amends D-039). GLOSSARY, IA, PRODUCT-SPEC §4a.
  - **D-082** non-equity `sector=null` shown as an explicit **"Not
    sector-classified (non-equity)"** bucket. MASTER-DATA §6, GLOSSARY, IA Portfolio.
  - **D-083** region expanded to **six buckets** (India/Singapore/US/Europe/APAC/
    Other) with a full listing-country membership table. MASTER-DATA §4, GLOSSARY.
  - **D-084** review defaults owner-set: `_RUNWAY_LOW_MONTHS = 3` (was 6),
    `_GOAL_SOON_DAYS = 180` (was 90); rest as audited. These two deliberately
    diverge from `review.py` — recorded in PRODUCT-SPEC §5 audit trail. ROADMAP R-15.
  - **D-085** classification guidance: `asset_class` = exposure, `asset_subclass`
    = wrapper; listed REIT = `property` + `reit`. MASTER-DATA §2, GLOSSARY.
  - **D-086** no annualized return below a minimum-history threshold; cumulative
    only; XIRR from threshold upward. GLOSSARY returns, PRODUCT-SPEC §4c.
  - **D-087** `other` retained as the honest escape valve + Review signal
    `_OTHER_CLASS_OVERUSE_PCT = 10%`. MASTER-DATA §2, PRODUCT-SPEC §5, IA Review.
  - **D-088** ROADMAP restructured — R-6/R-8/R-14 bundled as the v2.1 "accounting
    precision" theme; R-15 (user-configurable thresholds) added. ROADMAP.md.
  - Affirmed unchanged: A2 (11 GICS sectors), REVIEW-GUIDE §3.3 (v1 removals).
  - REVIEW-GUIDE annotated with **→ Resolved** lines throughout; Spot-check 1
    updated for the deliberate D-084 divergence.

- **Backend copy-in milestone — plan** at `docs/plans/backend-copy-in.md`
  (Phase A copy · Phase B prune · Phase C OpenAPI freeze; acceptance criteria per
  phase). Migration strategy ADR: `docs/adr/0001-keep-legacy-alembic-chain.md`.
- **Backend copy-in — PHASE A DONE (faithful copy, tests green).** Copied the v1
  backend from the read-only legacy source (`~/Documents/github/LedgerFrame`):
  `app/` (138 py + Alembic tree, 24 migrations, single head `d1e7a4c02f95`),
  `alembic.ini`, `tests/` (104 files), `pyproject.toml`, `.env.example`,
  `scripts/` (12 ops scripts), `systemd/` (4 units), Docker configs. Excluded:
  frontend, build artifacts, real `.env`, DB files, legacy docs/README, D-079
  transcripts. Env via **uv** (`python3-venv`/pip unavailable under PEP 668):
  `uv venv .venv` + `uv pip install -e '.[dev]'`.
  - **Mechanical fixes only** (recorded per CLAUDE.md): (a) authored a minimal v2
    `README.md` stub — required by `pyproject.toml`'s `readme=` for the editable
    install (v2's own, not legacy's); (b) extended `.gitignore` (Python/data/
    venv/caches); (c) regenerated `docs/openapi.json` from the copied app via the
    copied `scripts/gen_openapi.py` — the inherited `test_openapi_contract.py`
    reads that committed artifact, which lives in legacy `docs/` (deliberately not
    copied); regeneration is deterministic and byte-identical to legacy (121
    paths). No source file altered otherwise.
  - **Tests: `pytest -q` → 458 passed, 0 failed** (79.8s). Before the openapi.json
    regeneration: 456 passed, 2 failed (both the missing-artifact case above);
    after: fully green. No legacy behaviour changed.

- **Backend copy-in — PHASE B DONE (decision-driven prune).** Deleted exactly
  what DECISIONS retired, nothing more:
  - **Models** (`app/models/__init__.py`): `ProviderConfig` (D-014), `Note`
    (D-015), `AIConversation`/`AIMessage` (D-016), `DashboardConfig`/
    `DashboardRotationItem` (D-017), plus their references in `system.py`
    (`reset-data`) and `seed/demo.py` (default-dashboard seed + `_DEMO_PAGES`).
  - **D-080** dead code: `verify_token()`, the commented `_carry_forward`
    duplicate (live one kept), the no-op `account` fetch + `if account: pass` in
    `portfolio.py`.
  - **D-042**: no bare server-side `/global` route exists — nothing to remove
    (`/markets/global` is the kept Global-tab endpoint, D-051).
  - **Migration** `f9e1a2b3c4d5_drop_retired_tables` (on head `d1e7a4c02f95`):
    drops the six tables child-first, **data-guarded** (raises loudly if any
    holds rows), with a full `downgrade()`. Verified: single head; clean upgrade;
    guard aborts on a seeded row; downgrade/upgrade round-trip.
  - **Tests removed (pruned-code only):** `test_token_roundtrip`/`_expiry`/
    `_tampered_token_rejected` in `tests/unit/test_security.py` (they exercised
    the deleted `verify_token`); PIN tests kept.
  - **Suite: `pytest -q` → 455 passed, 0 failed** (was 458; −3 removed tests).
    OpenAPI unchanged; inherited contract test still matches.

- **Backend copy-in — PHASE C DONE (OpenAPI freeze).** Froze the inherited HTTP
  contract as the v2 baseline:
  - **`docs/specs/API-CONTRACT.json`** (OpenAPI 3.1, 121 paths) generated from
    the post-prune app, deterministic (sorted keys); `docs/openapi.json` mirrors
    it for the inherited contract test.
  - **`docs/specs/API-CONTRACT.md`** — baseline statement + **delta table** of
    endpoints the specs will add/rename/remove (each row a decision ID) + the
    same-commit update rule. Frontend-route redirects noted as not-API-paths.
  - **Drift check** `scripts/check_api_contract.py` + `make api-contract-check`
    (regenerate and fail on any diff). Verified: passes clean, fails on a
    synthetic injected path.
  - **Suite: 455 passed, 0 failed.**

**Backend copy-in milestone COMPLETE** (Phases A/B/C). See
`docs/plans/backend-copy-in.md` for the full record.

- **Frontend foundation milestone — plan + ADR.** Plan at
  `docs/plans/design-system-build.md` (Phase A scaffold · B tokens · C
  components · D kitchen-sink + ratification; acceptance criteria per phase;
  components only, no templates/pages this milestone). Stack recorded as
  **ADR-0002** (`docs/adr/0002-frontend-stack-react-vite.md`): React + TS + Vite
  from scratch, CSS custom properties as the single token source, no CSS
  framework/charting/webfont dependency without a further ADR.
- **Frontend foundation — PHASE A DONE (scaffold, all checks green).** `frontend/`
  app boots; `/health` probe via Vite dev proxy → backend (127.0.0.1:8321)
  showing ok+version / unreachable (verified end-to-end against the live
  backend); light→dark→system theme cycle (D-066) wired to the token layer via
  `<html data-theme>`, per-device localStorage (D-078), flash-free bootstrap.
  ESLint 9 + `tsc` + Vitest (3 tests). **Token drift check**
  (`frontend/scripts/check-design-tokens.mjs`, `npm run check:tokens`) fails on
  any raw hex/px in components outside the token layer — proven green clean and
  red on a deliberate violation. `npm run check` + `npm run build` pass. Minimal
  token slice committed; full DESIGN-SYSTEM §2 set is Phase B.

- **Frontend foundation — PHASE B DONE (tokens).** Full DESIGN-SYSTEM §2 token
  set in `frontend/src/theme/tokens.css`: colour (light/dark) + high-contrast
  override; type scale 12/13/14/16/20/28 + line-heights/weights + UI/serif
  fallback stacks (no webfont dependency, ADR-deferred); 4px spacing scale;
  radius/border/`--shadow-1`; density (comfortable/compact); motion duration
  collapsing to 0 when reduced. D-078 axes via `DisplayProvider` stamping
  resolved `data-density`/`data-contrast`/`data-motion` on `<html>`, per-device
  localStorage, following `prefers-contrast`/`prefers-reduced-motion` on
  `system`. Tabular figures proven live. All PROPOSED per §2.6. Checks + build
  green.

- **Frontend foundation — PHASE C DONE (components).** Full DESIGN-SYSTEM §5
  inventory in `frontend/src/components/ui/` (19 named + `Sparkline` + a generic
  `Select`): inputs (Money/Quantity/Percent/Date/InstrumentPicker/MasterSelect),
  data display (DataTable, TrendStat, AllocationDonut, PriceChart, Treemap,
  QuoteCardRow, TickerStrip), provenance (ProvenanceBadge, StalenessChip),
  structure (PageHeader, EmptyState, ReviewCard, GlossaryTerm). No raw
  `<input>`/`<select>`; MasterSelect resolves categoricals through a mock
  `/refdata` registry (verbatim MASTER-DATA seeds); money from backend decimal
  strings via display-only formatters (no frontend math); house-SVG charts only
  (squarified treemap, no ECharts — D-053). Mock fixtures cover negatives, long
  names, multi-currency, and stale/low-confidence/manual/unavailable provenance.
  22 tests; check + build green; drift clean. Two under-specified points flagged
  (segment palette; generic Select) in `docs/plans/design-system-build.md` and
  Needs decision below.

- **Frontend foundation — PHASE D DONE (kitchen sink + ratification).**
  `/kitchen-sink` route renders every §5 component in every meaningful state
  (loading/empty/error/stale/negative/low-confidence/long-RTL labels), both
  themes + both densities switchable live, organized for a ratification
  walk-through; a **token swatch board** labels palette/type/spacing with token
  names. `docs/plans/RATIFICATION.md` lists every PROPOSED token group + every
  component with checkboxes + the two open interpretations + a sign-off block.
  Visually verified in headless Chromium (treemap-label distortion found and
  fixed). 23 tests; check + build green.

**Frontend foundation milestone COMPLETE** (Phases A/B/C/D). See
`docs/plans/design-system-build.md` for the full record. The four page templates
(overview/entity-detail/worklist/settings) and real pages remain deliberately
out of scope — components only.

- **Design-system RATIFIED (2026-07-10, approved with 3 amendments).** Owner
  ratified §2 tokens + the full component inventory at the kitchen sink. Applied
  through the token layer (drift green, AA re-verified both themes): (1) **accent**
  cobalt→slate-navy (`#24476f` / `#6f9fd4`); (2) **light gain** desaturated ~15%
  (`#15803d`→`#1e763e`; dark unchanged); (3) **treemap** flat fills → a continuous
  **magnitude scale** (`--treemap-base` + data-driven `color-mix` intensity; soft
  tint near 0%, full at ≥5%) with a scale legend on the kitchen sink. The 5-tone
  segment palette and `ui/Select` ratified as implemented. DESIGN-SYSTEM §2
  PROPOSED markers flipped to ratified. Record: `docs/plans/RATIFICATION.md`.

- **Page-build framework — plan + first page (PLAN ONLY, not built).**
  - **`docs/plans/TEMPLATE-page-build.md`** — the reusable plan template every
    page build follows. Forces, before any code: IDENTITY · OWNERSHIP TABLE ·
    API SURFACE (with a backend-first *contract delta* list) · COMPONENTS (ratified
    only; new components forbidden without a DESIGN-SYSTEM amendment) ·
    VOCABULARIES · DECISIONS IN FORCE · ACCEPTANCE CRITERIA (incl. honesty +
    theme/density) · BUILD PHASES (deltas first, one commit/phase) · NEEDS
    DECISION (surfaced pre-build). Each section is *derived from the specs with a
    section reference*, never re-invented.
  - **`docs/plans/page-holdings.md`** — first instantiation (Holdings, the
    canonical data-entry page: D-012 picker · D-019 merger · D-012 import review
    queue · D-049 soft-delete/undo/one-Add-flow · D-050 server-side CSV). Fully
    filled from the specs. **Not built — owner reviews first.** Its NEEDS DECISION
    surfaces real pre-build blockers (below).

- **BUG FIX — holdings/CSV/summary 500 (blocking, 2026-07-10).** The valuation
  reader (`value_portfolio`, shared by holdings, holdings.csv, summary) could
  **crash the whole reader** on one problematic holding. Could **not** reproduce
  the owner's exact trigger (demo data + a full Add-flow replay both return 200),
  so fixed the **class**: (1) confirmed + fixed a concrete crash —
  `fx.convert(amount, None, base)` did `None.upper()` → `AttributeError`; guarded
  `fx.convert` against a falsy currency + gave `value_portfolio`'s `native_ccy` a
  base-currency fallback; (2) **per-holding resilience** — extracted
  `_value_one_holding`; any per-holding failure now degrades to an **Unavailable**
  row (0, unpriced — honest, not fabricated) and is **logged** (`holding id/label
  + reason`), so the reader never 500s and the root cause is diagnosable from the
  logs. 460 backend tests (+1 resilience regression); ruff clean; demo + replay
  verified 200. **Owner: if it still misbehaves, the warning log now names the
  offending holding + reason — share that line to fix the root cause at source.**

- **Holdings final-batch (owner greenlight, 2026-07-10).**
  - **500 CLOSED** — environmental (backend wasn't running); resilience +
    fx/native_ccy guards stay as defence-in-depth (§9-24).
  - **Tags clipping fixed + row quick actions** — per-row actions moved to a
    compact **`RowMenu`** (⋯); Holdings: Details/Tags/Delete, Transactions:
    Edit(`TxnEditDialog`)/Delete; DataTable gains a **`truncate`** column option.
    No clipped headers / no mandatory h-scroll at laptop widths (§9-22).
  - **D-092** — Insurance signpost tile (navigates to `/insurance`, never
    branches the form; D-062) (§9-20).
  - **D-093** — editable import review grid (per-cell error highlighting, inline
    fix or exclude, Commit gated until all rows resolved; commit re-uploads a
    reconstructed CSV) (§9-21).
  - **Purge polish** — new `GET /portfolio/deleted-count` (contract +1 → 124
    paths); purge control hidden at zero, shows the count (§9-23).
  - **Dev ergonomics** — `make dev` / `scripts/dev.sh` runs backend + frontend
    together (creates a local dev `.env` on first run, never `/mnt`); README
    documents it.
  - 42 frontend + 460 backend tests; drift/ruff/lint/typecheck/build green.
  - **PROPOSED for ratification:** D-090 (matrix, now with the import-bypass
    clause) + D-091 (per-class fields) in MASTER-DATA §10/§11.

## HOLDINGS — DONE ✅ (page ACCEPTED at the true final pass, 2026-07-10)

**`/holdings` is complete and owner-accepted.** All ten acceptance/confirmation
walks are resolved (page-holdings.md §9-1..39); the entries below are the walk log,
kept as the build history. Everything that page-holdings.md surfaced is shipped and
verified (the last two — D-097 class-aware picker and the popover overlay rule —
were verified live in Chromium). The Holdings page is the reference instantiation of
`TEMPLATE-page-build.md`; the retrospective folding its lessons back into the
template is the next task. No open Holdings blockers remain.

## IN-PROGRESS (Holdings walk log — page now DONE above)

- **Holdings acceptance walk — 4 findings fixed 2026-07-10.** (page-holdings.md §9-9..11)
  - **Select dark-popup bug** — native `<select>`/date popups now follow the
    theme via `color-scheme` + tokenized `option` colours in the ui input layer;
    "open in both themes" specimen added to `/kitchen-sink`; TEMPLATE §7 now
    requires manual open-state verification in both themes.
  - **Split/bonus fields** (D-019 way, no engine change) — verified the pinned
    §4.3 vectors, then gave each purpose-labelled fields: **split → "Split
    ratio"** (→ price, qty 0); **bonus → "Bonus units"** (→ quantity, zero cost,
    no price).
  - **Terminology** — "Total value" (retired D-021) → **"Net worth"** on the
    summary (net-of-liabilities), as a linked P-1 summary; frontend grep found no
    other deprecated terms.
  - Still pending owner: ratify **`TextInput`** (§9-8) at the Holdings look.
  - 36 frontend tests + build green; drift/typecheck/lint clean.

- **Holdings acceptance walk #2 — 4 Add-flow findings fixed 2026-07-10; no engine
  change** (page-holdings.md §9-12..15). Engine semantics verified first, then
  forms reshaped:
  - **Dividend / Interest** → single **"Amount received"** field (verified
    total-cash, not per-share, in `statements_report`/`compute_fifo`); mapped
    quantity 1 × price so stored `amount` == the entered value. Interest
    instrument optional.
  - **Fee** → single **"Amount"** with help text; routes to **Recorded fees** via
    the fee-type `amount` (never the `fees` field → no D-048 double-count), never
    cost basis (no `compute_fifo` branch). GLOSSARY gains **"Fee (recorded)"**.
  - **Fractional quantities** audited end-to-end — DB `DecimalText`, engine
    `Decimal`, API `float`, frontend free-decimal: **supported, no integer-only
    layer, no fix needed**. Optional non-blocking NEEDS DECISION: Decimal-string
    API for sub-float crypto exactness (parked-worthy).
  - 38 frontend tests + build green; backend 459 unchanged; ruff clean.

- **D-089 — Type-first Add flow (owner, 2026-07-10; recorded in DECISIONS.md).**
  The Add entry step is now a **grid of asset-type tiles in user vocabulary**
  (Stocks & ETFs · Mutual fund · Crypto · Cash · Fixed deposit · Bond · Property ·
  Retirement · Private · Liability · Other), each with a plain-language subtitle;
  choosing a tile routes to the **existing single D-049 flow** with branch +
  fields preselected. Listed/Manual mechanism tabs are no longer the front door;
  the flow underneath is unchanged. Tile→branch/asset-class from MASTER-DATA
  `AssetClass` (no new vocabulary); Listed tiles classify new instruments
  (crypto→CoinGecko, mutual_fund→AMFI). **No backend/engine/contract change.**
  Verified in headless Chromium; 39 frontend tests + build green (also fixed a
  ToastProvider timer leak on unmount). page-holdings §9-16.

- **D-090 / D-091 RATIFIED + SHIPPED, D-094 recorded (owner, 2026-07-10).**
  page-holdings §9-25/26; DECISIONS.md D-090/D-091/D-094.
  - **D-090 (RATIFIED, ETF-Bonus amendment) — shipped.** Matrix served at
    `GET /refdata/txn-applicability` (frontend zero-copy D-005; contract +1 →
    **125 paths**). Listed Type dropdown filters by class (`MasterSelect` gains an
    `include` subset prop); Manual branch gains a **"Record transaction"** sub-mode
    (interest/deposit/withdrawal/fee/transfer; buy/sell excluded) posting an
    instrument-less cash-flow txn via the existing endpoint. **No engine change.**
    MASTER-DATA §10 → RATIFIED (ETF Bonus ✓).
  - **D-091 (RATIFIED) — shipped.** `_META_KEYS` gains property `cost` + private
    `round`; Manual Add form prompts the per-class OPTIONAL-PROMPTED fields
    (`MANUAL_META_FIELDS`) → `meta`. Review signal `_INCOMPLETE_DETAILS_MIN = 1`
    (severity `info`) — *"N holdings have incomplete details"*, never a hard wall
    (PRODUCT-SPEC §5). MASTER-DATA §11 → RATIFIED.
  - **D-094 (recorded + both tables done).** Audit: `DataTable` is presentational;
    the page wired neither sort nor filter (raw API order; txns capped at 500).
    **Holdings** → client-side sort/filter **shipped** (bounded dataset; explicit
    assumption + ~1,000-position revisit threshold). **Transactions** →
    **server-side shipped** (own commit): `GET /portfolio/transactions` gains
    sort/dir/filter/offset/limit + **`total`**; sort+filter over the full dataset,
    windowed (100/page), UI states *"Showing X–Y of Z"* with Prev/Next + debounced
    filter — **500-row silent cap gone**; numeric columns cast for value-sort; CSV
    export stays full-dataset (D-050). Worklist rule added to
    `TEMPLATE-page-build.md` §4/§7.
  - **Commit 1** (D-090/D-091/D-094-record + Holdings client-side): **463 backend**
    (+3) + **45 frontend** (+3). **Commit 2** (transactions server-side): **467
    backend** (+4 paging) + **46 frontend** (+1). ruff/contract-drift/tokens/lint/
    typecheck/build green throughout.

- **Final-walk findings #7 — CSV round-trip bug + layout (owner, 2026-07-10;
  NOT yet committed — owner re-verifies first).** page-holdings §9-27..30;
  DECISIONS.md D-095.
  - **Round-trip bug (D-095) FIXED.** The Holdings **Export** was a positions
    **snapshot** while **Import** ingests a transactions **ledger** → every row
    failed, symbols "(none)". A snapshot can't round-trip without fabricating trade
    dates, so the lossless pair is a **transactions export ⇄ transactions import**:
    new `GET /portfolio/transactions.csv` (columns == `IMPORT_COLUMNS`; wired to the
    ledger Export; contract +1 → **126**); the importer now returns one honest
    `format_error` for a snapshot instead of 14 garbage rows. **Permanent
    round-trip test** + rule in `TEMPLATE-page-build.md` §7.
  - **Import review grid** responsive (content-typed columns), dialog `size="xl"`.
  - **Add dialog** two-column form at desktop, dialog `size="lg"` — `Dialog` gains
    a **`size`** prop (§5.4 amendment).
  - **Holdings table** fits 1366px: Symbol+Name merged into one identity cell,
    Class → chip, Source → `StalenessChip`+tooltip; compact density one step denser.
  - **469 backend** (+2 round-trip) + **48 frontend** (+2) tests; all checks green.

- **Post-import + polish findings #8 (owner, 2026-07-10).** page-holdings §9-31..34.
  - **Import visibility (item 1)** — *not* a persistence bug (commit saves +
    rebuilds fine). Imported rows are historical-dated → they sank below the
    most-recent-first window. Fix: ledger gains an **`added`** (insertion-order)
    sort; **post-commit the ledger jumps to "recently added"** + toast says so.
  - **StalenessChip (item 2)** — fixed *"Stale · as of Stale cache"* (label passed
    as `asOf`) and the width. Holdings response now carries real **`price_ts`**;
    chip reads compact **"Stale · 08 Jul"** (full date in tooltip), just "Stale"
    when no timestamp; `nowrap`, no horizontal scroll.
  - **Table height (item 3)** — `DataTable` caps at **`60vh`** and scrolls
    internally (sticky header); page can't grow unboundedly. Template rule added.
  - **Tile order (item 4)** — **"Other"** moved to last, after Insurance.
  - **470 backend** (+1 recently-added) + **49 frontend** (+1 import-visibility)
    tests; ruff/contract-drift/tokens/lint/typecheck/build green.
  - **Committing this batch together with findings #7** (owner: "commit everything
    pending"). — committed `98f1dc2`.

- **Confirmation-pass findings #9 (owner, 2026-07-10) — verified with REAL flows.**
  page-holdings §9-35..37; DECISIONS.md D-096. **Not yet committed** (owner does one
  more confirmation pass first).
  - **Import "Imported 0" (item 1)** — diagnosed via a real browser + real-API flow:
    *not* a payload bug (committed CSV contains exactly the included rows, proven by
    a payload-guard test); cause is duplicate-skip. `Toast` gains a **`tone`**; a
    zero-import commit now shows a **warning** ("No rows were committed — …
    duplicates"), never success. Verified in Chromium (amber toast screenshot).
  - **Holdings table 1366px (item 2)** — verified by screenshots that it still
    overflowed (`1184 > 1110`, ⋯ clipped). Fix: **dropped the Price column** (it's
    "—" for manual holdings; Value is the decision figure; price → row Details). Now
    `overflowX: false` at 1366 & 1920, both themes; ⋯ fully visible.
  - **D-096 (item 3)** — Import dialog "Download template" → generated from the
    D-090 matrix (one row per class × permitted type; can't drift; self-importable).
    Verified in Chromium (downloads `ledgerframe-import-template.csv`).
  - **472 backend** (+2: template round-trip, duplicate-skip report) + **52 frontend**
    (+3: payload guard, warning toast, template button) tests; contract 126 paths,
    drift green; ruff/tokens/lint/typecheck/build green. — committed `af50f6c`.

- **Final findings #10 (owner, 2026-07-10) — picker + popover, verified LIVE.**
  page-holdings §9-38/39; DECISIONS.md D-097.
  - **D-097 class-aware picker** — was mock-backed & class-blind. New
    `GET /instruments/search?q=&asset_class=` (contract +1 → **127**) returns
    `existing`/`other_class`/`suggestions`; the picker takes the Add-flow class,
    filters existing by it, routes provider search (AMFI/CoinGecko/market), and
    shows cross-class matches as **navigate links, never selectable**. Verified in
    Chromium (mutual-fund add shows AAPL only as "Found in equity: AAPL →").
  - **Universal popover rule** — custom popovers portal to the viewport
    (`position:fixed` + max-height + internal scroll); the InstrumentPicker menu
    now portals to `document.body`. Verified in Chromium (`portaledOutsideDialog:
    true`, `dialogScroll: false`). Recorded in DESIGN-SYSTEM §6 + kitchen-sink
    open-inside-dialog case.
  - **474 backend** (+2 instruments-search) + **53 frontend** (+1 class-aware
    picker) tests; contract 127 paths, drift green; ruff/tokens/lint/typecheck/
    build green. **Committing now** (owner: "commit … then I do the true final pass").

- **D-090 / D-091 — PROPOSED spec tables (owner, 2026-07-10; SUPERSEDED — see the
  ratified+shipped entry above), + compact picker fixed now.**
  - **D-090 (MASTER-DATA §10, PROPOSED)** — AssetClass × TxnType applicability
    matrix; the Type dropdown will filter by class (form-level only, **engine
    unchanged**). Judgment calls flagged (crypto corporate actions off;
    retirement/liability interest).
  - **D-091 (MASTER-DATA §11, PROPOSED)** — per-class REQUIRED vs
    OPTIONAL-PROMPTED creation fields, seeded from the D-049 `_META_KEYS`
    whitelist. Verified present (FD rate/maturity, bond coupon/maturity, property
    address/valuation-date, retirement scheme, private company/ownership); gaps =
    property `cost`, private `round`. Incomplete details → a low-priority Review
    signal, never a hard wall.
  - **Compact type picker (done)** — all 11 tiles + Cancel now fit without
    scrolling on a laptop (3 cols verified in headless Chromium at 1366×768);
    presentational, independent of ratification.
  - Recorded: DECISIONS.md (D-090/D-091 PROPOSED); page-holdings §9-17/18/19.
    39 frontend tests + build green; no backend change.

- **Corporate-actions gap — RECORDED (owner-identified 2026-07-10; not built).**
  1. **ROADMAP R-7 enriched** into the v2.1 "accounting precision" theme:
     **de-merger / spin-off** (merger-in-reverse — cost-basis apportionment per
     approved ratio, holding-period carry, zero realised gain) **+ ticker/symbol
     rename**. Plan-file coverage spelled out (ratio user-input vs published
     reference, multi-instrument creation flow, FX acquisition-rate carry,
     provenance labelling). `ROADMAP.md` R-7 + v2.1 theme.
  2. **VERIFIED (this milestone):** editing an instrument's **name** preserves
     transaction history + price continuity — transactions/holdings/lots reference
     `instruments.id` (FK), identity is `(id_type, value)`. Recorded in GLOSSARY
     ("Ticker / name change"). The **symbol/ticker rename** is not yet exposed
     (`InstrumentPatch` lacks a symbol field) → added to ROADMAP R-7.
  3. **GLOSSARY entries added** (canon): **Rights issue** (= Buy at rights price),
     **Buyback** (= Sell at offer price) — existing types, correct cost basis, no
     special form; **De-merger / Spin-off** (R-7); **Ticker / name change**. The
     in-app **Help copy** task is queued for the Help/Holdings page plan (NEXT).

## DONE (Holdings page-build — all phases)

- **Holdings build COMPLETE (Phases 0a/0b/1/2, 2026-07-10).** See
  `docs/plans/page-holdings.md`.
  - **0a — §5 component amendment, RATIFIED** — Dialog/Drawer, ConfirmDialog+PIN,
    FileInput, Toast/Snackbar; `--scrim` token.
  - **0b — backend contract deltas** — `GET /refdata` (D-005, 22 vocabs),
    `GET /portfolio/holdings.csv` (D-050), `TransactionIn` merger reshape (D-019),
    typed `GET /portfolio/holdings` (§9-6). Contract regenerated (121→**123
    paths**); **459 backend tests**; ruff clean.
  - **1 — page assembly** — `/holdings` composes the ratified components:
    holdings table + linked P-1 summary header (→ Portfolio, D-023), transactions
    ledger with soft-delete + 10s undo Toast, one Add flow (listed/manual;
    merger = Absorbed-into + Ratio), import (FileInput→preview→commit), tags
    editor, purge [PIN], server-side Export (P-5). Vocab via `/refdata`
    (`RefdataProvider`; MasterSelect reads live values, registry is the offline
    fallback). Verified in headless Chromium against the live backend (real
    seeded data). Surfaced + built **`TextInput`** (§9-8, PROPOSED) for free-text
    label/tag fields.
  - **2 — tests** — `Holdings.test.tsx` (6, API-mocked). Frontend suite **35
    tests**; drift + typecheck + lint + build green.
  - **Follow-ups (non-blocking, in page-holdings §9):** InstrumentPicker→real
    instrument search (symbol entry works via the create path; merger-target
    id needs it); per-holding tags read-back; purge PIN→session-auth binding;
    `summary`/`import-preview` response typing.

## INSTRUMENT DETAIL — DONE ✅ (page ACCEPTED, Phase-3 walk complete, 2026-07-11)

**`/instrument/:symbol` is complete and owner-accepted** — the first **entity-detail**
template variant (`docs/plans/page-instrument-detail.md`). Phases 0/1/2 built +
Phase-3 acceptance walk resolved across three finding batches, all verified rendered:
- **Phase 0 (`2eb656b`)** contract deltas: holdings `?symbol=` scoped reader (ND-1),
  `/refdata` `source_override` (ND-3), typed `GET /instruments/{symbol}` (ND-4).
- **Phases 1/2 (`45c243a`)**: the page (scoped quote/identity/class-panel/house-SVG
  chart/position/ongoing-cost/news/edit); the **AI explainer is DEFERRED** to the
  AI-surfaces milestone (ND-2/ND-5; D-068 intact — page ships without it).
- **Walk batch 1 (`9e90b60`)**: D-098 symbol links, D-099 class-scoped ongoing cost,
  layout. **Batch 2 (`df60600`)**: served display labels (item 3b). **Batch 3
  (`61dfa41`)**: PriceChart amendment (RATIFIED). **Surfaces (`7cb8066`,`1271ce7`)**:
  D-100 layered cards, D-101 themed scrollbars + header-outside-scroll. **Refinements
  (`b374765`)**: canonical link in card header, header-owns-gutter. **Close-out**:
  the **MetaStrip** primitive (Identity compact metadata; verified desktop 1-row /
  mobile 2-col).
- **Cosmetic backlog (D-101, parked → chrome polish pass):** the themed scrollbar
  *thumb* doesn't paint in headless captures (overlay-scrollbar rendering); the
  structural fix (header-owns-gutter, track below header) is verified. Revisit the
  thumb-pixel polish at the chrome pass. **Not blocking.**

No open Instrument Detail blockers remain. `MetaStrip`, `PriceChart` amendment,
`.lf-card`/`.lf-card__body`, and the themed-scrollbar/header-outside-scroll patterns
are now platform-wide primitives.

## PAGE-CHROME — C-1..C-6 RESOLVED; Phase 0a BUILT, AWAITING RATIFICATION (2026-07-11)

- **Blockers C-1..C-6 resolved (owner, 2026-07-11)** — recorded in `page-chrome.md`
  §9 + committed. Two changed specs: **D-102** (sidebar responsive: off-canvas below
  laptop, fixed at laptop+; IA §3) and **D-103** (purge-PIN NEVER binds to the unlock
  session — always fresh PIN; SECURITY-BASELINE §3). C-2 Ask-panel deferral confirmed
  (slot reserved, D-067 pending); C-3 version-check endpoints already exist
  (`system/version-check`, `system/update-status`) → verify no-egress + network-trace
  test in Phase 1; C-4 first-run checklist is its own later plan (chrome reserves the
  gate slot only); C-5 session contract reconciles against existing `auth/*` endpoints.
- **Phase 0a — RATIFIED (owner, 2026-07-11) ✅.** Kitchen-sink look passed: icon toggles
  (stateful-glyph rule, DESIGN-SYSTEM §5.5) + LockScreen blur+scrim verified illegible in
  both themes; `☰` reserved, collision-free at narrow width. Commits `acf2d1a`/`77a355e`/
  `f0f4419`. **Phase 1 (shell assembly) is now IN-PROGRESS** (see below). Re-ratify amendments
  that landed: (1) slim TopBar, **icon-only**
  display/rotation/Detail controls, brand narrow-only; (2) StaleBanner/UpdateBanner as
  **full-width status strips BELOW the bar**; (3) Sidebar **progressive reveal** (all six
  D-043 headers, only built pages as entries — Holdings today; `NavItem.built`; `showAll`);
  (4) **bolder active rail** (`--nav-rail-width`). **Icon re-ratify:** (a) **stateful-glyph
  rule** (DESIGN-SYSTEM §5.5) — every stateful toggle shows a state-distinct glyph (theme
  ☀/☾/◐, density ≡/≣, contrast ▨/◧/■, motion ≈/—/≋, rotation ↻/⊘, Detail ╱/╪; `☰` reserved
  for the menu toggle); (b) **LockScreen over a blurred snapshot** — `backdrop-filter:
  blur(--lock-blur=24px)` + heavy `--lock-scrim`, `@supports` fallback to near-opaque
  `--lock-scrim-opaque` so content is unreadable on any browser (D-002). Checks + build
  green, **72 frontend tests**. Owner does a quick kitchen-sink look at the icons + lock
  blur (illegibility check is visual/theirs — no headless browser here), then Phase 1.
  Below is the component set (unchanged surface).
- **Phase 0a components** in `frontend/src/components/ui/`:
  **Sidebar** (D-043 six groups from `ui/nav.ts`; D-102 responsive; router-driven
  active + `activePath` preview override), **TopBar** (D-066 layout container;
  relocates DisplayControls; owns rotation D-044 + Detail D-040 toggles; `askSlot`
  reserved for D-067), **StaleBanner**, **UpdateBanner** (presentational; no-egress
  guard is Phase-1 data-layer), **DemoBadge**, **Clock**, **LockScreen** (D-002 access
  lock; min-6 PIN; reuses ConfirmDialog pattern). DESIGN-SYSTEM §5.5 gains the chrome
  inventory table (PROPOSED). Staged at `/kitchen-sink` ("Global chrome (§5.5)");
  ratification checklist in `page-chrome.md` §10. **No shell assembly / router wiring /
  backend change yet** — Phase 1 after ratify. Checks: lint/typecheck/drift + **70
  frontend tests** (8 new) + build all green.

- **Page-chrome Phase 1 (shell) + Phase 2 (tests) — DONE (2026-07-11).** `AppShell`
  (`components/AppShell.tsx`) composes Sidebar + slim TopBar + status strips + lock gate
  once around every route via `AppRoutes` (`AppRoutes.tsx`); kitchen-sink stays outside
  the shell. DisplayControls moved out of Holdings/InstrumentDetail/App into the TopBar
  (D-066). Redirects wired (D-042/D-022/D-056); unbuilt routes → honest `NotBuilt`. Chrome
  data via `api/system` (auth-state→lock, version-check→UpdateBanner) + `api/chrome`
  (settings→Clock/DemoBadge, summary→StaleBanner). **C-3:** backend no-egress guard added
  to `GET /system/version-check` (zero outbound under `privacy_mode`) + network-trace
  acceptance test; summary gained `stale_count`. Commits `93b717c` (Phase 1) + Phase 2
  tests. **Frontend 79 · backend 479 · drift/typecheck/lint/contract green.**

## PAGE-CHROME — DONE ✅ (milestone SIGNED OFF, owner, 2026-07-11)

**The global chrome (app shell) milestone is complete and owner-signed-off.** C-1..C-6
resolved; Phase 0a (7 components ratified) → Phase 1 (shell assembly + C-3 no-egress
guard) → Phase 2 (tests) → Phase 3 (4 live-verify batches, all PROPOSED items ratified).
Full record: **`page-chrome.md` §10 (build), §11 (Phase-3 walk §11-1..§11-21), §12
(retrospective)**. Ratified: lucide icon set (ADR-0003), page-action icon-button pattern
(DESIGN-SYSTEM §5.5), TickerStrip global footer (D-047 amendment — DECISIONS + DESIGN-
SYSTEM §5.2), narrow TopBar overflow popover / time-only Clock / DemoBadge sidebar-footer,
ticker speed 30s. Lock no-leak **owner-verified live (D-002)**. **Playwright breakpoint
overflow suite (ADR-0004)** wired into `npm run check`. `TEMPLATE-page-build.md` amended
from the retrospective (copy-hygiene + app-wide-label rules, Playwright/overflow line,
shell-plan note). Parked: D-101 scrollbar-thumb (R-18), ticker speed setting (R-16),
indices→Markets (R-17). Deferred by prior decision: Ask panel (D-067, C-2), first-run
checklist (D-045, C-4). Commits: backend `93b717c`; frontend `1c77f58`→ close-out.

## FIRST-RUN CHECKLIST — DONE ✅ (milestone owner-closed, 2026-07-11)

**The first-run checklist (D-045, C-4) milestone is complete and owner-closed.** Phase 0
(contract deltas: `timezone` + `first_run_complete` settable via `PUT /settings`) → Phase 0a
(3 §5.5 components ratified: `Switch`, `Combobox`, `FirstRunChecklist`) → Phase 1 (overlay
mounts in `AppShell` after the lock gate; five steps wired to canonical endpoints) → Phase 2
(tests) → Phase-3 pre-pass (scripted smoke caught **F1–F11**, all fixed) → Phase-3 live walk
(batch 1 §11-1 pinned-header/footer layout; batch 2 §11-2 F3 confirm-on-pick + §11-3/F6
provider-429 backoff). Owner live re-verify passed (SGD-as-suggested confirms). Full record:
**`page-first-run-checklist.md` §10–§13** (§13 = retrospective). Replaces PersonaOnboarding
(killed, D-045). Shipped platform patterns: **`CommitMenu`/`onCommit`** commit-on-pick selects
(DESIGN-SYSTEM §5.5), **gate-overlay D-101 layout** (pinned header/footer, desktop no-scroll,
sheet <900px). F6 backoff (Retry-After · cooldown breaker · honest-stale FX) is
provider+worker-only, **contract untouched**. ROADMAP additions this milestone: **R-22..R-25**.
Owner DECLINED for this milestone (recorded §12a): personal-profile fields, display-axis
onboarding steps, per-lane provider config. Checks at close: **95 frontend + 32 Playwright +
487 backend**, contract current.

## PORTFOLIO — DONE ✅ (page ACCEPTED, Phase-3b walk complete, 2026-07-12)

**`/portfolio` is complete and owner-accepted** — the analytics half of the Holdings↔Portfolio
split (D-023), second overview-template page. Phases 0/0a/1/2 + Phase-3a scripted pre-pass +
Phase-3b owner walk (batches 1–4, all ratified). Full record: **`page-portfolio.md` §9–§13**
(§13 = milestone retrospective). New decision this milestone: **D-104** (tag normalise-on-write vs
render-verbatim; demo-seed casing a sanctioned exception; `_clean_tags` kept as-is). Platform
legacy shipped: **categorical data-viz palette** (DESIGN-SYSTEM §4), **progressive per-card
loading** (TEMPLATE overview standard), **donut/chart hover readouts**, **DataTable-everywhere for
tabular cards**, **PriceChart comparison mode** (§5 amendment), **equal-geometry-from-the-grid rule**
for stat rails + its pre-pass assertion. Pre-pass full green (data + controls + equal rail geometry +
0 overflow 320/375/900/1366 × both themes, 0 console errors). `TEMPLATE-page-build.md` amended §7/§8
(every visual/geometry fix ships a pre-pass assertion; wait cards out of skeleton before asserting).
No open Portfolio blockers.

## NET WORTH — DONE ✅ (page ACCEPTED, Phase-3b walk complete, 2026-07-12)

**`/net-worth` is complete and owner-accepted.** Third overview-template page, the reciprocal of
Portfolio — it owns the Net worth headline Holdings/Portfolio summarise (D-032), **closing the
three-way reciprocity** (one reader, `/portfolio/summary.total_value`; verified). Phases 0/0a/1/2 +
Phase-3a pre-pass + Phase-3b walk (batches 1–3, all ratified). Two backend deltas — **ND-3
`cash_and_deposits`** (= cash + fixed_deposit) and **ND-4 `GET /net-worth/statement`** (signed
per-class balance, reconciles to the headline; statement ≠ allocation, allocation stays gross-only);
no §5 amendment. **ND-1 demo snapshots seeded** (26 synthetic, demo-only). New: **ROADMAP R-28**
(liquid/illiquid trend — forward-only, plan-gated). Platform legacy: `DataTable` `<tfoot>` totals +
separator, honest-metadata rule, card-fill assertion class, `src/format/metrics.ts`. Full record:
**`page-net-worth.md` §9–§14** (§14 retrospective). Commits `2282926`→ batch-3 close-out.

## PRICING HEALTH — DONE ✅ (page ACCEPTED, Phase-3b walk complete, 2026-07-12)

**`/pricing-health` is complete and owner-accepted.** First **Reports-group** page (Worklist template),
canonical home for provenance/confidence/routing diagnostics (D-038). §9 all-resolved; **no §3b deltas**
(everything already served) → Phase 0 skipped; Phase-0a confirm-only (no §5 amendment). Per-holding
diagnostics table + confidence card + Details dialog (read-only routing chain + confidence_factors) +
Correct-source (`MasterSelect` per-instrument correction, never priority editing, D-072) + refresh
(per-holding + bulk `/system/refresh-data`, `[S]`-gated, honest no-egress). **ND-1 reconciliation via a
shared `staleCount` query** (§12ph1-1): banner + page footnote read one polled+invalidatable source.
Platform legacy (promoted to DESIGN-SYSTEM §5.2): the **shared summary-count query pattern** +
**`.lf-visually-hidden` caption rule**. `/system/staleness` recorded orphaned (08-TECH-DEBT). Full
record: **`page-pricing-health.md` §9–§13** (§13 retrospective — the fastest page: verify-first emptied
§3b, one-pass §9, composition-only Phase-0a). Commits `60d2338`→ batch-1 close-out.

## MARKETS — DONE ✅ (page ACCEPTED, owner phone re-verify, 2026-07-13)

**`/markets` is complete and owner-accepted.** Markets-group home (overview + worklist hybrid, ND-3 —
the shape Heatmap/News inherit); unblocked **R-17** (ticker indices → `/markets`); absorbed the removed
`/global` page. Phases 1/2/3a + Phase-3b walk (batches 1–4) + retrospective (page-markets §13). One
backend delta: **D-105** quote-price display precision (`price_display` on `Quote` + `HoldingView`;
contract regenerated, no path change) — otherwise ratified-component composition. Platform legacy
promoted (DESIGN-SYSTEM/TEMPLATE): **single vertical scroll region** invariant (`contain: layout`),
**centralized `.lf-table a` link treatment**, **D-105 precision**, **30d Sparkline on Global-tab rows**,
segmented-button region tabs. Retrospective lessons folded into TEMPLATE §7/§8 + §3b (fail-first for
tooling guards; vertical-scroll invariant; ⚠ verify-first divergence flag). Full record:
**`page-markets.md` §9–§13**. No open blockers; batch history endpoint stays not-registered.

### (walk log — the batches above are now DONE)

**Phase-3b batch 4 (owner, 2026-07-13)** — page-markets §12mk4. Batch-3 RATIFIED live (PageHeader
search + 320px flex-wrap; D-105 precision). **§12mk4-1 BUG:** Global-tab index rows misaligned below
the laptop breakpoint (long labels forced price under label / displaced the spark) — the flex-wrap
space-between row rendered numbers inline-vs-wrapped inconsistently by label length. **Fix:** explicit
2-line stacked layout for EVERY row ≤900px (label line, then spark+price+change line), number line
right-anchored (`margin-left:auto`) so price/change align + the fixed spark never displaces. CSS-only.
Fail-first proven (old layout at 880px = inline/not-stacked). Permanent pre-pass **PART 1c** asserts at
320/375/880 × both themes (Asia-Pacific stress case): all stacked, no overlap, price/change aligned.
140 unit + 93 overflow green; live pre-pass green, 0 console errors.

**Phase-3b batch 3 (owner, 2026-07-12)** — page-markets §12mk3: **§12mk3-1** "Find a symbol" moved to
the **PageHeader** (beside `+`; standalone card removed; 320px = header flex-wrap drops it to a row
under the title, bounded input; results in an anchored dropdown) — **PROPOSED, owner ratifies at
re-verify**. **§12mk3-2 = D-105** quote display precision: formatted in the **backend**
(`format_price_display`), served as `price_display` (Quote + `HoldingView`), frontend renders verbatim
(dropped `formatPrice` from every quote surface). Equity/ETF/fund/index → 2dp; **crypto → 6 sig figs**;
`None` → "—". `HoldingView` is a typed response_model so the field had to be declared (found+fixed);
API-CONTRACT regenerated (no path change). Portfolio VALUES keep 2dp (unaffected). **§12mk3-3** ticker
index-click CLOSED the page-chrome §11-19 interim (R-17 shipped, owner-verified). Backend 493 (+1) ·
frontend 140 unit + 93 overflow · live pre-passes (Markets/Portfolio/Net-worth/Pricing-Health) green, 0
console errors; D-105 verified live.

**Phase-3b batch 2 (owner, 2026-07-12)** — page-markets §12mk2: **§12mk2-1 Global-tab 30-day
sparklines** (scoped option (a) approved). Per index row, a 30d `Sparkline` via the existing
`getInstrumentHistory`; progressive per-row (motion-safe placeholder → spark), honest absent ("—") on
fetch failure (no fabricated flat line), reduced-motion-safe, fixed footprint (overflow-safe). **Global
tab ONLY**; grid/watchlist sparks (b) + a batch history endpoint (c) DECLINED — (c) recorded
**not-registered**. §11-3/§11-5 accepted. 139 unit + 93 overflow green; live pre-pass green (PART 1b: 3
sparks, 0 stuck; 0 overflow; 0 console errors).

**Phase-3b batch 1 (owner, 2026-07-12)** — page-markets §12: reconciliations RATIFIED (§11-1 [Help]
scope, §11-2 gainers>0, §11-3 Dialog+TextInput both pre-ratified/not-new); **§11-5 wired** a page-level
`/markets/search` "Find a symbol" (InstrumentPicker uses `/instruments/search`, so it was truly
unwired, not redundant). Fixes: **§12mk1-1** two-vertical-scrollbars BUG — shell `min-height:0` +
`contain:layout` on `.lf-shell__content` (Chromium overflow-propagation; document scrolled beside the
content) + Markets tables flow; **permanent ALL-PAGES single-scroll assertion** added to the overflow
suite (fail-first proven). **§12mk1-2** REPEAT MISS (Portfolio §12b3-3) — centralized `.lf-table__td a`
→ `.lf-table a` + fixed the Gainers/Losers list links; asserted 0 underlined. **§12mk1-3** VERIFY-ONLY:
history endpoint is per-symbol (no batch), ~4KB@30d/~25KB@180d, resolves for proxies+watchlist symbols —
feeds a scoped sparkline decision (not built). Still open: the page-chrome ticker index-link §-entry
CLOSE. 138 unit + 93 overflow green; live pre-pass green, 0 console errors.

### (prior) Phases 1/2/3a — DONE (2026-07-12)

**`/markets` is built + pre-pass green; awaiting the owner acceptance walk.** Fifth
overview-template page (an **overview + worklist hybrid**, ND-3 — the Markets-group shape Heatmap/News
inherit). Plan `docs/plans/page-markets.md` §11 has the full record. **§9 all-resolved (owner
2026-07-12); no §3b delta** (ND-1 = display-sort of served `change_pct`) → Phase 0 skipped; Phase 0a
composition-only (no §5 amendment — segmented-button region tabs + chip status pill are ratified).
- **Phase 1** — page + `/markets` route + `api/markets.ts`. Market status · Global tab (served groups
  as segmented region tabs, per-index **ETF-proxy honesty badge** D-051/ND-6, no client region map) ·
  **Gainers/Losers** display-sort (top/bottom N=5, losers only <0, honest empty; which-list rule
  guarded, never Contributors/Detractors, D-024) · instrument grid (search + column sort, Held badge)
  · **watchlist management** (only here, D-052; create/delete/add/remove, `[S]`; rename DECLINED) ·
  Heatmap/News signposts. **R-17 wired** — `fetchTickerQuotes` sets index `href` → `/markets` (ND-5).
- **Phase 2** — `Markets.test.tsx` (9, incl. which-list copy test + proxy badge + display-sort +
  watchlist CRUD) + `api/chrome.test.ts` (2, R-17 ticker-link) + overflow suite extended to `/markets`.
  **137 unit + 65 Playwright green; check/build green.**
- **Phase 3a** — `e2e/smoke/markets-smoke.spec.ts` GREEN first run (live app + real backend): every
  section populated, R-17 ticker links present (30), watchlist round-trip, proxy badge shown/absent
  correctly, 0 overflow 320/375/900/1366 × both themes, 0 console errors.
- Build-time reconciliations recorded in §11 (glossary `[Help]` scope = Gainers/Losers only; gainers
  filtered >0 for honesty; create via Dialog+TextInput; `/markets/search` left unwired).
- **Open at the walk:** the page-chrome ticker index-link §-entry still needs its one-line **CLOSE**
  (ND-5). Commits `72b8630`… (draft) → §9 → Phase 1 → Phase 2 → Phase 3a.

## NEWS — DONE ✅ (page ACCEPTED, owner re-verify, 2026-07-13)

**`/news` is complete and owner-accepted.** Third Markets-group page (overview + worklist hybrid, ND-4);
canonical home for the **briefing + grouped headlines** (D-037/D-068); receives Markets' region links
(D-051). Phases 0/0a/1/2/3a + Phase-3b (batch 1) + close-out. **§9 one-pass; zero §5-amendment
fallbacks** (NewsList + Segmented both extracted, not invented). Single backend delta: **ND-2 no-egress
guard** (behavioral, contract unchanged; C-3 network-trace test). Platform legacy promoted (DESIGN-SYSTEM
§5.2): **`NewsList`** (RATIFIED) + **`Segmented`** (extracted, all 3 call-sites migrated — PriceChart,
Markets, News). Retrospective lessons folded into TEMPLATE §3b (verify-first **audits guards, not just
shapes** — caught a shipping Guarantee-5 hole). Full record: **`page-news.md` §9–§13**. Open follow-ups
(non-blocking): feed management → **Settings plan** (ND-6); **`GET /news` unconsumed** → tech-debt (ND-7).

### (walk log — the phases above are now DONE)

**Phase-3b batch 1 (owner, 2026-07-13)** — page-news §12: **NewsList RATIFIED** (§12nw1-1, DESIGN-SYSTEM
§5.2). **§12nw1-2** headline buckets → **segmented tabs** (Markets Global-tab pattern; one served bucket
per tab, verbatim, one visible; wraps at 320px) — PROPOSED, ratify at re-verify; segmented buttons now
recur 3× → extract-candidate recorded. **§12nw1-3 (ND-8 REVERSAL)** per-card refresh on Briefing +
Headlines: verify-first found **no contract delta** — briefing regenerate = `POST /briefing/refresh`
(require_auth [S]); headlines = a re-GET of `/news/grouped` (no auth). Refresh is egress → **disabled
under no-egress** (ND-2 governs), aria-busy in-progress, toast outcome; 429 via per-feed degradation.
148 unit + 105 overflow green; live pre-pass green (tabs + refresh + no-egress-disable), 0 console errors.

### (prior) Phases 0/0a/1/2/3a — DONE (2026-07-13)

**`/news` is built + pre-pass green; awaiting the owner acceptance walk.** Third Markets-group page
(overview + worklist hybrid, ND-4). §9 all-resolved (owner 2026-07-13). Full record: **`page-news.md`
§9–§11**. **Phase 0 (backend-first): ND-2 no-egress guard** — the news/briefing readers make ZERO
outbound calls under `privacy_mode` (C-3 network-trace pattern; contract unchanged); backend 495→**497**.
**Phase 0a: extracted `NewsList`** (shared from InstrumentDetail — DESIGN-SYSTEM §5.2; external new-tab
links, per-symbol InstrumentDetail links, plain-text 2-line clamp ND-12, flows). **Phase 1:** briefing
card (**deterministic served text; NO AI copy** ND-1 — LLM narration deferred to the AI-surfaces
milestone; **NO refresh** ND-8) + grouped-headlines body (served buckets **verbatim**, ND-3) + honest
no-egress/empty/error states; **`[Help]` Briefing + Headlines** (ND-9, added to GLOSSARY). **Phase 2:**
`News.test.tsx` (6, incl. the sanitisation test) + overflow/single-scroll extended to `/news`. **Phase
3a:** `news-smoke` GREEN (briefing no-AI-copy, 3 groups/16 headlines, links, no-egress toggle+restore,
single scroll, 0 overflow × both themes, 0 console errors). **146 unit + 105 Playwright + 497 backend.**
- **Recorded for later:** feed management deferred to the **Settings plan** (ND-6); **`GET /news`
  unconsumed** → tech-debt line (ND-7); D-051 region-link divergence noted (ND-3, no mapping invented).

## REVIEW — DONE ✅ (page ACCEPTED, owner live re-verify, 2026-07-13)

**`/review` is complete and owner-accepted.** Planning-group page (worklist template), canonical home for
review verdicts + attention list + Mark-reviewed/history + the D-059 threshold table. Phases 0/0a/1/2 +
Phase-3a pre-pass + **Phase-3b owner walk Batch 1 (§12rv1-1..7) — accepted at the first live re-verify.**
Reconciled in code this milestone: **D-084/D-087** thresholds + over-use signal (Phase 0, closing the
long-standing spec-vs-code drift), **D-030** rename `/review/centre → /review`. New: **ROADMAP R-29**
(implicit "seen" state). Ratified at the walk: §12rv1-1 icon, §12rv1-4 severity colours, and the ND-11
GLOSSARY terms **Mark reviewed + Severity**. Platform legacy: the shared **`relativeDays`/`relativeTime`
day-copy** (app-wide, Review + News) and the **display-cased-at-the-boundary** reader pattern. Full record:
**`page-review.md` §9–§13** (§13 retrospective). No open Review blockers.

**Phase-3b Batch 1 (§12rv1-1..7) — walk log (findings now DONE).** Two OWNER PICKs taken: relative-time →
**"Today"/"N days ago"**; retired-label
replacement → **"Attention"**. Findings: **rv1-1** Mark-reviewed gains a `CircleCheck` icon + kept text
(PROPOSED); **rv1-2** auto-mark-reviewed DECLINED → **ROADMAP R-29** (implicit "seen" state, own plan);
**rv1-3** ONE shared `relativeDays` formatter app-wide (Review tile + NewsList §11-4), 0/1/N unit-tested;
**rv1-4** severity is SEMANTIC (ND-4 REVERSAL, PROPOSED) — `Review`→`--attention` token, `Info`→neutral,
neutral fallback, no invented colour; **rv1-5** backend serves **display-cased** area/severity (D-105
precedent) — count on raw, shape unchanged (no regen), frontend verbatim + case-normalised lookups, Net
worth ReviewCard reflects it; **rv1-6** history DataTable worklist cap confirmed (search/pagination
DECLINED, ≤24 rows); **rv1-7** retired "Needs a look" label → "Attention" (body copy kept, D-030). Full
record: **`page-review.md` §12**. Backend **501** · frontend **158 unit + 117 Playwright** · pre-pass GREEN
(reconciliation 4==4==4, 0 overflow both themes, 0 console errors). Owner accepted; dev `ReviewLog`
pre-pass residue cleared via the seed-sanctioned reset at close (§13 tooling note).

## REVIEW — Phases 0/0a/1/2/3a build detail (2026-07-13)

**`/review` is built + pre-pass green; awaiting the owner acceptance walk.** Planning-group page (worklist
template); canonical home for review verdicts + attention + Mark-reviewed/history + the D-059 threshold
table. §9 all-resolved (owner one-pass 2026-07-13). Full record: **`page-review.md` §9–§11**. **Phase 0
(backend-first, fail-first):** reconciled the code to spec — **`_RUNWAY_LOW_MONTHS=3`, `_GOAL_SOON_DAYS=180`
(D-084)** + the **D-087 over-use signal**, and the **D-030 rename `/review/centre → /review`** (contract
regenerated; PRODUCT-SPEC §5 divergence note closed). **Phase 1:** worklist page — summary rail + attention
DataTable (**neutral severity chip verbatim** ND-4, **area→canonical-page link** ND-7 w/ unknown-area
no-link, review-first sort) + history (last-24 legend) + Mark-reviewed (Dialog+TextInput+DateInput, [S]);
GLOSSARY gains **Mark reviewed + Severity** (PROPOSED). **Phase 2:** ND-3 reconciliation + area-map +
Mark-reviewed request-body tests; overflow/single-scroll extended. **Phase 3a:** pre-pass GREEN — **ND-3
reconciliation demonstrated LIVE** (ReviewCard count == Review page count == served count), Mark-reviewed
round-trip, 0 overflow × both themes, 0 console errors. **Backend 501 · 153 unit + 117 Playwright.**
Open at the walk: **Mark reviewed + Severity GLOSSARY ratify** (ND-11).

## HEATMAP — DONE ✅ (owner accepted 2026-07-13)

**`/heatmap` is built, walked and CLOSED.** Markets-group overview page; **owns nothing canonical** — a
treemap **visualisation** of `/portfolio/holdings` (tile size = served `market_value`, tile colour = served
**Today's change**). Priced-only, **assets only** (liabilities excluded), **stale INCLUDED** (staleness
honesty carried by the global StaleBanner, ND-3); honest coverage note + both empty states. Full record:
**`page-heatmap.md` §9–§13** (§13 retrospective).

**Verify-first paid for itself: NO new endpoint.** §10 proved the existing holdings reader already served
size, colour, honesty and the class filter. Backend work was only what the owner chose:
- **§3b reshape (ND-8, applied):** `HoldingView` gains **`country`** + a **server-derived `region`** (D-083
  **six** buckets — no client region map). This also **reconciled a spec-vs-code divergence**: `region_of`
  was still the legacy 3-bucket (`IN/SG/US` → "Global"); there is now **one canonical**
  `app/core/regions.py`, reused by both `HoldingView.region` and the policy region dimension.
- **§12hm1-1 (applied):** `HoldingView` gains **`market_value_display`** + **`day_change_pct_display`** —
  served display strings (D-105 posture; the frontend formats nothing).

**DESIGN-SYSTEM §5.2 Treemap — two amendments RATIFIED 2026-07-13** *(this supersedes the earlier NEXT-item
phrasing that a "§5 amendment" was needed for the page treatment: the Treemap render + magnitude scale were
**already ratified** (2026-07-10), so no page-treatment amendment was required — per the plan's Step-2.3
correction. The amendments below are the two **interactions the owner chose at the walk**, not the render.)*:
- **Click-through** (ND-7) — optional per-node `href` makes a tile a **keyboard-operable link** to its
  instrument (D-098); Enter native + Space handled; outline/inset-shadow only ⇒ **no layout shift**.
- **Readout** (§12hm1-1, an **ND-7c REVERSAL** on live evidence) — name/symbol · value · **Today's change**
  on **hover AND keyboard focus** (never hover-only, WCAG 1.4.13); an **anchored overlay** that is
  **container-safe by construction** (an edge tile cannot push it past the map boundary — verified at
  320px) and out of flow ⇒ no layout shift. A missing figure → **em dash + reason** (ratified copy: *"No
  prior close to compare."*), never a fabricated 0; a **real served zero** shows as `0.00%`.

**D-053 ECharts escape hatch — NOT triggered.** §7 defined parity as **6 checkable criteria**; the pre-pass
evaluates and prints them — **all 6 PASS**, so the **house SVG stands** and no ADR/dependency was needed.

**Walk (§12, Batch 1)** — one finding: **§12hm1-1** the tile readout. **Ratified at the walk:** ND-7
click-through, ND-11 GLOSSARY **"Heatmap"**, ND-12 + coverage/assets-only copy; at the re-verify: the
**readout amendment** + its reason copy. **Accepted, not defects:** the dominant flat **"Home (est.)"** tile
(largest holding, no daily change — honest v1 parity) and its **"Today's change 0.00%"** (a genuine served
zero for a manual valuation).

**⚠ STRIKE found at the walk (§13) — and closed.** The Phase-1 record claimed "GLOSSARY gains Heatmap", but
the term had landed in **`mocks/glossary.ts` only** — `docs/specs/GLOSSARY.md`, the file the hard rule
names, never got it. **Platform legacy:** a **glossary parity guard**
(**`tests/unit/test_glossary_parity.py`**, CI-unit, 14 terms) now asserts every `[Help]` popover term exists
in the spec with the **identical spelling** (fail-first proven on a *spelling* drift, not just absence) —
*one truth in two stores needs a guard, not vigilance*. **Placement:** CI-unit, not the dev-only smoke suite
(it is hermetic); **pytest not Vitest** because reading the spec from `frontend/` would need `@types/node`
(a new dependency ⇒ ADR) or a widened Vite `server.fs.allow` — see `page-heatmap.md` §13-1. Folded into
`TEMPLATE-page-build.md` (+ "a spec claim must cite the spec FILE").

**Verification:** backend **552** · ruff clean on touched files · contract drift green; frontend
`npm run check` **exit 0** (lint · typecheck · tokens · **172 unit** · **129 Playwright**); **live pre-pass
GREEN** — RENDERED geometry, readout on hover+focus container-bounded on all 12 tiles @320px & @1366px,
keyboard Enter → InstrumentDetail, 0 overflow × both themes, **0 console errors**.

**⚠ Open, NOT mine, NOT fixed (owner's call):** `make lint` is **RED on trunk** — 4 × ruff `E741` in
`tests/integration/test_attribution_api.py` + `frontend/e2e/smoke/reset.py`, from commit `3cedd36`. Left
untouched (out of page scope; hygiene gets its own commit).

**Home page — DONE ✅ (owner accepted 2026-07-14).** `docs/plans/page-home.md` — §9 resolutions +
§12ho1-1..§12ho4-1 + the §13 retrospective. A **composition-only** page: it owns **nothing**, and every
widget is a linked summary of the canonical page's reader (P-1/D-038). Shipped:
- **ONE ratified grid** — the Simple layout was REMOVED (**D-046 AMENDMENT**, §12ho1-6). It fits
  **1440×900 with zero scroll** on the real dataset; 1366×768 scrolls modestly, accepted as honest.
- **`/dashboard/home` RETIRED** (§9-4) — Home composes from the canonical readers, one card each,
  progressively loaded. **`home_layout` REMOVED** from the settings contract (it would have been a
  write-only key, D-078); **`home_quote_source`** stays. `PUT /settings` now **400s an unknown key**
  instead of silently accepting it.
- §5 amendments RATIFIED (DESIGN-SYSTEM): **SummaryHead `meta`** + **QuoteCardRow `summary`** (one header
  anatomy, no page-local variants) · **Lucide ↗** · **Donut centre readout** + legend cap "+N more ↗"
  (**Portfolio inherits**) · **Select borderless resting state** (platform-wide, focus ring retained).
- **It took THREE assemblies.** The lessons — *a widget list is not a layout*; *a gate artifact must model
  the box the product actually has*; *four guards reported green over a visibly broken page*; *a content
  cut that buys nothing is pure loss* — are folded into **TEMPLATE-page-build.md**. See **§13**.

## POLICY — DONE ✅ (page ACCEPTED, owner walk complete, 2026-07-15)

**The first page with a WRITE UI** — and the first to carry an **[S]-gated editor**. Full record in
`docs/plans/page-policy.md`: **§9** (21 items, owner one-pass) · **§10** (verify-first) · **§10-A** (Gate-A
addendum **A9–A11**, shipped pre-release because a parked page does not park its engine's defects) · **§11**
(build) · **§12po1 / §12po2 / §12po3** (three walk batches) · **§13** (retrospective).

**What the build produced beyond the page itself** — two defects generalised into **cross-page guards**
(the shared `.lf-page` shell; the centralised in-page link treatment), a ratified **`StatusChip`** with both
page-local chips migrated onto it, a **platform-wide input-focus** amendment, **ReviewCard containment**, the
**dialog-scroll composition rule**, the **D-105 scope amendment** (money = served display strings
everywhere), and **9 GLOSSARY terms**.

**§13 headline:** *a written assertion can pass while the visible defect remains.* The re-verify gate caught
**two items that had been reported done** — which is the gate working exactly as designed.

## CASH FLOW — DONE ✅ (page ACCEPTED, owner walk complete, 2026-07-15)

The **first per-row CRUD page** — Goals, Obligations (shown as **"Income & expenses"**), Contributions
(D-056/D-057). The two **§0-protected D-057 invariants are PINNED IN CODE** (contributions never reduce the
runway; `once` obligations are excluded from recurring burn — each proving **both halves**). Full record in
`docs/plans/page-cash-flow.md`: §9 (15 items, one-pass) · §10 (verify-first) · §11 (Phase 0/0a) · §12 (geometry
gate + Phase 1–3a) · §14 (walk) · §16 (retrospective).

**Platform produced beyond the page:** the ratified **`Button`** (icon+label, both page-local copies migrated
onto it) · the **table-header edge-to-edge fill** (one component, pixel-guarded) · the **`.lf-card__footnote`**
inset · the **first sanctioned `StatusChip` positive/negative** (the runway status) · **5 GLOSSARY terms**.

**Cross-page:** the walk reached back into **Review** (§12rv2-1 — the *"obligations"* attention area relabelled
to **"Income & expenses"**, and its ND-7 route corrected to Cash flow, which also fixed the identical
`goals → /scenarios` misroute) and forward into **Scenarios** (page-scenarios **SN-1** scope-note).

**§16 headline:** *computed styles are claims; rendered pixels are facts* — and *the CI e2e suite runs without a
backend*, so component guards live on the static specimen. Both mechanised into TEMPLATE + 08-TECH-DEBT.

## SCENARIOS — DONE ✅ (page ACCEPTED, owner, 2026-07-15)

**`/scenarios` is complete and owner-accepted** — the read-only Planning-group page: **deterministic what-if
shocks on today's values, "a scenario, never a forecast"** (D-058). **Fastest full loop yet — one walk batch.**
Full record in `docs/plans/page-scenarios.md`: §9 (14 items, owner one-pass) · §10 (verify-first) · §11 (Phase
0/0a) · §12 (geometry gate) · §13 (Phases 1–3a) · §14 (walk §12sc1) · **§15 (close-out + retrospective)**.

**Verify-first paid off — the reader was already frozen and read-only, so §3b was all guard/honesty deltas, not
a new endpoint.** Backend deltas (all fail-first, contract regen same commit): `*_display` money strings (D-105) ·
the **A10 staleness annotation** from the shared `confidence.portfolio_input_quality` helper (§9-2) · **exposures
from the canonical `allocation()`** — the private loop deleted, one derivation pinned by an equality test (§9-4,
A11 closed) · **named shock constants** with rationale (§9-7, the R-11 seam) · **`?entity_id` → honest 400**
(household-only, §9-8) · the drawdown note aligned to **"expenses"** (SN-1/§9-10).

**Platform produced beyond the page:** the **magnitude-scaled house-SVG impact bar** (§12sc1-3; the **donut was
DECLINED** on chart-semantics honesty — alternative hypotheticals do not sum) · **2 GLOSSARY terms** (`Shock`,
`Exposure`) · the **standing D-058 forecast-language guard** (mechanised, proven RED). **R-11 upgraded** to an
interactive per-class shock **slider** over a parameterized endpoint (§12sc1-2, own plan file required).

**§15 retrospective headline:** *`getBoundingClientRect` is clamped to the visible box* (measure the clipped
element's `scrollWidth`), *a `@media` breakpoint must model the content box not the viewport* (the sidebar eats
~230px), and *a media-query-responsive component is un-guardable on a static specimen* — it runs in the pre-pass
at real viewports. All three folded into TEMPLATE §7 (extending existing rules, not duplicating).

## INSURANCE — DONE ✅ (page ACCEPTED, owner, 2026-07-16)

**`/insurance` is complete and owner-accepted** — the protection register (Worklist template, the Cash flow
CRUD patterns). Phase 3b closed across two owner walk batches (page-insurance §14in-1..8); the owner
confirmed the hygiene commit (`331e856`) and ACCEPTED the page, **including Instrument Detail full-width as
shipped** (a ruling, not a drift — the §14in-6 uniform page-inset consequence). **Platform delivered beyond
the page:** the **page-inset standard + cross-page inset guard** (§14in-6), the **base-currency-affix
retrofit platform-wide** (§14in-7, one form), the **one-headline Review fix** matching Net worth to the cent
(§14in-8), the **annual-premium single-derivation** (§14in-2), the hygiene commit (CashFlow partial-mock
crash + collateral TrendStat wrap), and **R-36 parked** (premiums→Cash flow). Full record:
**page-insurance.md §11–§15** (§15 = close-out + retrospective). The walk-log detail below is kept as build
history.

   **Walk batch 1 (owner, 2026-07-16; page-insurance §14in-1..5):** §14in-1 page padding — removed the
   page-local `margin-bottom` that stacked on `.lf-page`'s gap (28px → the standard 16px, matching
   cash-flow/scenarios). §14in-2 honesty bug — the "Premium / yr" column served the raw per-frequency
   premium (monthly 50 → 50); it now renders the served **annual equivalent** built by ONE
   `_annual_premium` helper the strip total also uses (monthly 50 → 600; single-pay → em dash), Σ(column)
   reconciles with the total (A11 equality test). §14in-4 renewals card — aligned subgrid rows +
   content-driven height (no dead-space stretch). §14in-5 — base-currency affix on the money totals
   (served `base_currency` via the muted `.lf-stat__unit` slot); DESIGN-SYSTEM "Base-currency indication"
   entry (PROPOSED). §14in-3 parked → **R-36**. Backend 774 · Insurance unit 9 · overflow 179 · live
   insurance + net-worth pre-passes GREEN, 0 console errors; fail-first proven (backend `KeyError`,
   geometry gaps `[16,28,28]`). **The owner re-walks — nothing self-certified.**
   **Walk batch 2 (owner re-walk with platform screenshots, 2026-07-16; page-insurance §14in-6/7/8):**
   §14in-1 **RE-OPENED** — the batch-1 gap-rhythm guard measured an adjacent property, not the page inset
   (lesson folded in). §14in-6 **page-inset standard** — Insurance/Holdings rendered a larger inset at wide
   viewports (Holdings capped itself; Insurance inherited a cap via a `.ins` CSS class collision with
   Instrument Detail). Added DESIGN-SYSTEM §3.1 "Page inset" (RATIFIED); renamed InstrumentDetail `.ins`→
   `.idp` + dropped its + Holdings' `max-width`/`margin`; strengthened the inset guard (measures at 1728).
   §14in-7 **base-currency affix RATIFIED + retrofitted platform-wide** (see the retrofits section — now
   DONE). §14in-8 **Review headline** — served whole-dollar-rounded (`796,246.00`/`+17.00`) vs canonical
   `796,246.41`/`+16.73`; removed the `round()` so Review renders the SAME served figure (D-105). Verify:
   backend 775 (+1) · overflow 179 (inset guard) · live smokes (net-worth/portfolio/review/scenarios/
   cash-flow/insurance) GREEN, 0 console errors; fail-first proven for all three. Touched accepted pages
   carry dated delta notes. **The owner re-walks — nothing self-certified.** Full record: **§14 batch 2.**
   - **(prior) Insurance build detail (Phases 0/1/2/3a) — DONE (2026-07-16).**
   §9 closed one-pass (2026-07-15, +amendments A–D); §12 geometry gate RATIFIED WITH CONDITIONS (2026-07-16,
   §12in-1..5). **Phase 0** (8 deltas): meta removal, D-105 + count-active-only (Amendment A — Net worth
   D-081 migrated to `total_cash_value_display`), `policy_status` vocab, `?entity_id`→400, one
   `renewal_reminders` helper (named windows), `cover_by_type` display-cased, doc-default seed content, 6
   GLOSSARY terms. **§12 deltas:** currency code on non-base display strings (§12in-1); served exclusion
   disclaimer (§12in-2); served renewal `state` with one backend threshold store (§12in-3). **Phase 1:**
   `/insurance` assembled on the ratified geometry — totals strip → policies DataTable spine → flanking
   renewals + cover-by-type → served disclaimer; [S]-gated CRUD editor (MasterSelect, insurer typeahead via
   a new `TextInput` `suggestions` datalist, documents checklist Switch+TextInput, `linked_goal_id` omitted);
   nav `/insurance` → built. **Phase 2:** 8 render guards + the STANDING adequacy-language guard (proven
   RED→GREEN) + overflow suite (12). **Phase 3a pre-pass GREEN** on the demo-seeded live instance (CRUD
   round-trip, containment, both themes, 0 console errors) — and **caught a real bug** (the `policy_status`
   mock-refdata gap, fixed). Net-worth D-081 pre-pass re-verified GREEN. Full record: **`page-insurance.md`
   §11 (Phase 0) · §12 (gate) · §13 (Phases 1–3a).** **Phase 3b (owner walk) is the gate — not self-certified.**
   ⚠ Pre-existing (not mine): the `CashFlow.tsx:330` unhandled error fails the frontend `npm run check` —
   reproduces at `c0e9fb1`, out of scope, in `08-TECH-DEBT.md`.
## ESTATE — CLOSED ✅ · owner walk ACCEPTED (2026-07-16) · §14es-1 fixed, milestone done

**§12 SPECIMEN GEOMETRY RATIFIED (owner, 2026-07-16)** — two rulings + one Phase-1 condition, recorded
verbatim in `page-estate.md §12`:
- **§12es-1** — the specimen DEVIATION is the ratified geometry: **will status LEADS the profile card**,
  the readiness strip is **COUNTS-ONLY** (no `will_status` tile; §4 strip-placement superseded to match).
- **§12es-2** — page subtitle + both EmptyState wordings **RATIFIED AS SHOWN**.
- **§12es-3 (condition, DELIVERED)** — the rendered label MUST be the SERVED `/refdata` label. `/refdata`
  served `will_status:none` → **"None"** (RED); amended **spec-first** so **"Not recorded"** is the served
  label (MASTER-DATA §2 note + per-vocab `_VOCAB_LABEL_OVERRIDES` in `refdata.py`; offline mirror in
  `mocks/refdata.ts`). Fail-first tests RED→GREEN; all four estate vocabs render served labels verbatim.

**Phase 1 (assembly) + Phase 2 (tests) + Phase 3a (pre-pass) DONE (commits `aa092c6`/`8acffb4`/`185f2a1`).**
`/estate` is wired (`api/estate.ts` + `Estate.tsx`/`.css`; nav `built:true`; route in `AppRoutes`): profile
card (will-status chip leads) → readiness COUNTS strip (no money/affix, §9-3) → contacts + documents
DataTables (served-label chips) → served disclaimer once. Editors: one `Dialog` (profile/contact/document),
`ui/` only; roles as composed `Switch` rows (§9-6); `ConfirmDialog` delete; `[S]`-gated (ambient PIN, D-103).
Demo seed extended with a realistic estate register (executed will; review +20d; 7 contacts incl. one 3-role
+ blanks; 10 docs incl. 1 missing + 1 outdated) and unit-verified. `/estate` added to ALL THREE
`overflow.spec.ts` route arrays + page-inset guard.

**Phase-3a pre-pass GREEN** (`e2e/smoke/estate-smoke.spec.ts`, live app + real backend, 11/11 parts, 0 console
errors): will-chip leads (served label), counts-only strip, attention chips, verbatim disclaimer, em-dash
cells, the `_REVIEW_SOON_DAYS=30` signal ("Estate review due in 20 days", §9-8), full CRUD through the `[S]`
gate (profile edit; contact add→edit→delete w/ multi-role Switch; document add→delete), containment +
single-vertical-scroll at 320/375/900/1366 × both themes. `review-smoke` re-run GREEN (estate signals; the
shared `estate_signals()` seam holds). `npm run check` **EXIT 0** (227 vitest + 228 Playwright); backend suite
**795 passed**; ruff/tsc/eslint/token-drift clean.

**OWNER WALK (Phase 3b) DONE — ACCEPTED 2026-07-16.** The owner walked `/estate`: **ONE finding**,
everything else accepted. **§14es-1** (theme uniformity) — the profile-card Edit button was **text-only**
while every sibling action button (Add contact/Add document, Policy's Set/Edit policy) carries a lucide
icon + text. Fixed to the platform standard: Edit → **`Pencil` icon + "Edit"** (icon decorative
`aria-hidden`; text is the accessible name), and the **button-anatomy standard RATIFIED** in DESIGN-SYSTEM
§5.4. Guard `Estate.test.tsx::§14es-1` RED (text-only, no svg) → GREEN; `npm run check` **EXIT 0**;
profile-card screenshots (light+dark) in `e2e/smoke/artifacts/`. **§9-9 GLOSSARY terms RATIFIED**
(PROPOSED→ratified, parity green). Full record: `page-estate.md §14`; central close row in
`RATIFICATION.md §6`. **Milestone CLOSED — not self-certified; owner-accepted.**

## PLATFORM POLISH BATCH — DONE ✅ (owner walk findings, 2026-07-16; Estate stays CLOSED)

Three platform-level owner-walk findings, each fixed CENTRALLY at the standard and recorded as a platform
batch (delta notes on touched accepted surfaces). No page-local one-offs. `npm run check` **EXIT 0** from
`frontend/` (229 vitest + 234 Playwright); ALL page smokes re-run GREEN (icon change is platform-wide).

- **P-1 — labelled Button icon sizes to the font (bug, §5.4 amendment).** The lucide icon in a labelled
  `Button` rendered at `--icon-size` (**18px**) on **13px** text (`.lf-btn` = `--font-size-13`) — visibly
  oversized (Estate *Edit*, Policy *Set policy*). Fixed CENTRALLY in the ratified Button's icon slot:
  `.lf-btn svg { width/height: 1em }` — the glyph tracks the button's own font-size, cap-height aligned,
  **never larger**; every labelled icon button inherits it (no per-page sizing). The **icon-only**
  `.lf-iconbtn` (bar controls, page-action buttons) is a **distinct surface** and keeps `--icon-size`.
  DESIGN-SYSTEM §5.4 amended (ONE rule). **Guard** (`e2e/icon-button.spec.ts`, retargeted from the old
  "==18px token" assertion the owner overruled): rendered svg bounding height **≤ font-size + 1px** —
  RED on 18px, GREEN at ~13px; both themes; kitchen-sink specimen + Review live. Fail-first proven.
- **P-2 — Estate profile Edit → `variant="primary"` (bug).** Was the default (grey) variant while every
  other header action (Add contact/document, Policy Set/Edit) is primary. `Estate.tsx` fixed; guard in
  `Estate.test.tsx` (RED→GREEN). Dated delta note `page-estate.md §15`. Screenshots (light+dark) captured.
- **P-3 — sidebar fits without scrolling (owner ruling: DENSITY, accordion DECLINED).** SYSTEM group was
  cut off at normal heights. Tightened the nav's vertical rhythm via **tokens** (`--nav-item-pad-y`,
  `--nav-group-gap`, `--nav-label-pad-y`) sized for the **FULL RD-9 nav (6 groups + 19 items)**, not
  today's 14 — so it isn't redone at Accounts. Brand + demo footer **pinned**; `.lf-sidebar__nav` is the
  one scroll region; below a **~640–680px floor** the items alone scroll with the brand pinned (never
  hidden groups). DESIGN-SYSTEM §5.5 gains the nav-density rule + floor. **Guards**
  (`e2e/sidebar-density.spec.ts`, real viewports, in `npm run check`): 1366×720 & 1024×700 fit with
  measured headroom for the still-to-ship items + footer; 1024×460 engages degradation cleanly; both
  themes; fail-first proven. **Content inset unchanged** — the page-inset guard (§3.1, measured at 1728)
  re-run GREEN. Dated delta note `page-chrome.md §13`. Full-sidebar screenshot (every group @1366×720).
- **Bonus hygiene:** a **pre-existing stale selector** in the dev-only `pricing-health-smoke` (`.ph__chip`
  → the migrated `.lf-statuschip`, red since the page-policy §9-15 StatusChip extraction) was retargeted;
  smoke GREEN. Not caused by this batch.

**NEXT unchanged: Accounts** (see below).

---

## ACCOUNTS — PHASE 1+2+3a GREEN ⏸ AWAITING OWNER WALK (Phase 3b) (2026-07-16)

**Geometry gate ✅ RATIFIED WITH CONDITION (owner, 2026-07-16)** — one condition (§12ac-1: the
accounts-table Value header carries the SERVED `base_currency`, never hardcoded) + four acceptances
(§12ac-2..5: cost-basis label on every account · RowMenu "View holdings" · StatusChip unused · the
subtitle/EmptyStates/three dialog bodies are protected copy). Recorded in `page-accounts.md §12ac`.

**Phase 1 (assembly) + Phase 2 (tests) + Phase 3a (scripted pre-pass) DONE — build record in
`page-accounts.md §13`.** `routes/Accounts.tsx` composes the ratified geometry live: the accounts
DataTable spine (institution · kind · currency · cost basis · entity · **Value({served base})** · ⋯
RowMenu View-holdings/Edit/Delete) + footer Σ → Entities card → Institution master card (served
referenced-by counts). [S]-gated editors; the **§9-3 MasterSelect data-source extension goes LIVE**
(institution select reads the DB master; Create-new POSTs to `/institutions`); the §9-5 cost-basis
restatement warning is interposed before the PATCH (wording PROPOSED). Deferred halves landed: the
**Holdings `?account=` chip** (Amendment G; delta note `page-holdings.md`), the **Insurance insurer →
MasterSelect** (delta note `page-insurance.md §16a`), the **demo seed** (entities + institutions + wired
accounts + a merge pair; `test_demo_seed_accounts.py`), nav flip + route + all three overflow arrays.
One backend delta (`GET /institutions` serves `account_count`/`policy_count`; contract regen, 130 paths).

- **Suites:** `npm run check` (from `frontend/`) **EXIT 0** — 239 Vitest + 246 Playwright (incl.
  `/accounts` overflow/inset at 320/375/900/1366 × both themes). Backend `pytest` **829 passed**;
  `test_copy_hygiene` 70 green; `make api-contract-check` green.
- **Phase-3a pre-pass** (`e2e/smoke/accounts-smoke.spec.ts`, DEV-ONLY): **13/13 parts GREEN, 0 console
  errors** on the RESET, demo-seeded instance — served Value header, footer Σ tile-integrity, served
  FIFO label, full [S] CRUD (inline-created institution LIVE POST; cost-basis change → warning →
  rebuild), entity add/rename/delete-blocked, institution rename + a **REAL merge**, Amendment-G
  drill-down, containment + geometry both themes × 4 breakpoints. Touched-page smokes GREEN:
  `insurance-smoke`, `net-worth-smoke`, `portfolio-smoke` (two cold-boot flakes cleared on retry — not
  regressions). Holdings has no smoke (covered by accounts-smoke Part 10 + the unit round-trip).

**⏸ STOP — AWAITING OWNER WALK (Phase 3b, next session).** Walk URL: `http://127.0.0.1:5173/#/accounts`
on the reset, demo-seeded instance. Judgment items: the §9-5 restatement wording (PROPOSED); the
copy-hygiene-reworded subtitle; whether Merge/Rollup want on-page [Help] popovers. **Not self-certified.**

*(Prior status, retained for the record:)*

## ACCOUNTS — PHASE 0a DONE ⏸ AWAITING OWNER GEOMETRY RATIFICATION at /kitchen-sink (2026-07-16)

**§9 RESOLVED (owner one-pass, 2026-07-16): ALL FOURTEEN items ACCEPTED as proposed + Amendments F/G/H +
one Recording Note.** Recorded verbatim in `page-accounts.md §9` (each row carries its → Ruling; nothing
struck). **Phase 0 (backend-first) COMPLETE** — 11 commits (`837eaec`…`a13f360`), one delta per commit,
each fail-first RED→GREEN, contract regen same-commit for shape changes; `make api-contract-check` green;
ruff clean; frontend `npm run check` (from `frontend/`) **EXIT 0** (234 passed). Evidence table in
`page-accounts.md §11`.

**Phase 0 deltas delivered (§9 item → commit):**
1. **[9-1]** `institutions` master table + typed CRUD (first user-extensible master; Amendment F uniqueness — trimmed/whitespace/case-insensitive `name_key`, first-seen casing). `a2f1c9d47b60`.
2. **[9-2]** `POST /institutions/merge` — user-driven, no fuzzy; re-points both FK cols + deletes duplicate in one txn.
3. **[9-1+F]** Three-step fold migration `b3e2f1a9c740`: seed master from BOTH `accounts.institution` + `insurance_policy.insurer` → `institution_id` FKs → DROP both String cols (native ALTER; child FKs safe). Readers serve name via join; writers resolve-or-create. **Insurance delta note `page-insurance.md §16`** + suites re-run.
4. **[9-4]** `AccountIn.entity_id` — FK-validated, honest 400; served in `_account_dict`.
5. **[9-5]** `AccountIn.cost_basis_method` (fifo/average, single-sourced to /refdata); method-change on an account w/ history → `rebuild_holdings_from_transactions` + `restatement` warning (proven: AAPL FIFO 600 → avg 450).
6. **[9-6+H]** `ENTITY_KINDS` graduated to the single-source /refdata pattern (MASTER-DATA §2 note); Entity CRUD (`POST/PATCH/DELETE /entities`, kind vocab→400, DELETE FK-blocked); **§9-7 no "Household" special-casing**.
7. **[9-9]** Kind + currency write-enforcement — out-of-vocab → honest 400 (no silent coerce).
8. **[9-10]** `accounts_report` served `value_display`/`total_display` (platform display path; `_f` whole-unit dropped); `base_currency` already served.
9. **[9-11+G]** `GET /portfolio/holdings?account_id=` reader (filter-not-recompute, `?symbol` precedent). **Holdings-page chip is Phase 1.**
10. **[9-13]** `_VOCAB_LABEL_OVERRIDES` FIFO fix ("Fifo"→"FIFO"); 4 GLOSSARY terms (Cost-basis method · Account kind · Rollup · Merge) spec-first + popover mirror (parity green).
11. **[9-12]** CSV-import silent-first-account fallback → **08-TECH-DEBT entry** (`csv_import.py:428-438`, Holdings follow-up) — recorded, not fixed. + this CURRENT.md flip.

**Phase 0a — geometry specimen + §9-3 ratification frame BUILT (the GEOMETRY GATE).**
`frontend/src/routes/AccountsMockup.tsx` (+ `Accounts.css`) mounted at `/kitchen-sink` as **"Accounts —
LAYOUT SPECIMEN (page-accounts §9 / Phase 0a) — PROPOSED, AWAITING RATIFICATION"**. Worklist geometry:
the Accounts DataTable spine (institution · kind · currency · cost basis · entity · value · ⋯ RowMenu +
**footer Σ totals row** with the SGD base-currency affix, §14in-7) → Entities card (D-065) → Institution
master card (D-008). Six frames: populated (8 accounts / 5 institutions; mixed kinds/currencies/cost-basis;
**FIFO** served label; entity-less em dash; **Household ordinary row** D-029/§9-7; long institution
truncates; footer **Σ = 1,643,550.00 SGD** tile-integrity green) · ALL-EMPTY (usable from zero, only the
migration's Household) · **§9-3 add-inline institution MasterSelect** (DB-backed master, mock-backed here)
· entity delete FK-blocked · institution delete FK-blocked→merge-offered · **merge mid-flow** ("DBS" ←
"DBS Bank", plain-language consequence). Composed ratified `ui/` only (`FooterRow` exported from the barrel
— no component change). **Rendered-verified both themes; `npm run check` from `frontend/` EXIT 0** (234
Playwright passed). Full gate record + the 3 flagged geometry decisions in **`page-accounts.md §12`**.

**⏸ STOP — AWAITING OWNER GEOMETRY RATIFICATION at `/kitchen-sink`. PHASE 1 IS BLOCKED until sign-off.**
Phase 1 then carries the deferred halves: the Holdings-page account chip (Amendment G), the Insurance
typeahead→MasterSelect swap (§9-3), demo-seed entity creation (§10-5), `NavItem.built` + route wiring.

---

### ACCOUNTS — PLAN DRAFTED, awaited §9 one-pass (2026-07-16, SUPERSEDED by the block above)

**`docs/plans/page-accounts.md` written through §10 (verify-first) + §9 (NEEDS DECISION). No code.**
The largest remaining page milestone — **two masters land here** (Entity CRUD D-065; Institution
master D-008). Identity confirmed from specs: **Accounts** · `/accounts` · **Wealth** group ·
**Worklist** template (`DESIGN-SYSTEM:229`, verified, not presumed); sidebar-density slot already
reserved. §10 verify-first read the engine (four code-audit passes, file:line cites in the plan) and
surfaced the load-bearing reality: **`AccountIn` omits BOTH `entity_id` and `cost_basis_method`** — the
two headline features (D-064 entity assignment, D-018 cost-basis selector) have **no write path** and
are §3b adds, not "wire the existing endpoint"; **Entity CRUD is a D-065 add** (only `GET /entities`
exists, no delete-block); **the Institution master is greenfield** (both `accounts.institution` and
`insurance_policy.insurer` are free text; no extensible master-with-CRUD exists anywhere — sector/tag
are not tables); the `/accounts` rollup serves **raw float money** (D-105 display-string delta due);
`?entity_id` filters on 15 readers but has **zero frontend callers** (dormant; R-35/R-33 park per-entity).

**§9 = 14 numbered items (7 ⚑ load-bearing), UNRESOLVED — awaiting owner one-pass:**
1. ⚑ Institution master — build + FK re-pointing migration (both columns, fold-not-destroy)
2. ⚑ Institution **merge** — semantics (user-driven, no fuzzy) + scope (ship-now vs defer)
3. ⚑ Institution selector — the **add-inline component** (MasterSelect data-source extension vs new control; §4 amendment)
4. ⚑ Entity assignment writable on the account form (D-064; `AccountIn` +`entity_id`)
5. ⚑ Cost-basis method writable + D-018 restatement/rebuild (`AccountIn` +`cost_basis_method`)
6. ⚑ Entity CRUD (D-065) — POST/PATCH/DELETE + delete-block FK guard
7. ⚑ Default **"Household"** entity — protected / renamable / deletable semantics
8. ⚑ `?entity_id` scoping — **no entity switcher this milestone** (specs silent; entity is an account attribute, R-35 parked)
9. Kind + currency write-validation — enforce (400) vs silent-coerce
10. Money on the page (D-105) — served `*_display` strings + base-currency affix
11. Account rollups as linked P-1 summaries — the drill-down link target (no `?account_id` holdings view today)
12. CSV import ↔ account-creation seam — one canonical home (+ flag the silent-first-account fallback)
13. GLOSSARY / SN-class sweep — 4 missing terms + the `fifo → "Fifo"` served-label fix
14. Inherited platform standards (confirm-only)

**STOP condition met — owner rules §9 one-pass; nothing above §9 resolved by the author.**

---

## ESTATE — §9 CLOSED one-pass · Phase 0 DONE (2026-07-16)

**§9 RESOLVED (owner one-pass, 2026-07-16): all ten items ACCEPTED as proposed + AMENDMENT E on 9-5.**
Recorded verbatim in `page-estate.md §9` (each row carries its → RULING; nothing struck) with Amendment E
(fold-then-drop for `relationship`). **Phase 0 (backend-first) COMPLETE** — one delta per commit, each
fail-first RED→GREEN, contract regen same-commit for shape changes; `make api-contract-check` green; **full
backend suite 790 passed**; ruff clean. Evidence table in `page-estate.md §11`.

Phase 0 deltas delivered (commits `7d15247` … `718abad`):
1. **[9-1]** Deleted `GET /estate/meta`; `/refdata` is the single vocab source (removal by SHAPE). Contract regen'd; `API-CONTRACT.md:73` ✅.
2. **[9-5 + Amendment E]** Retired `relationship` — migration `f2b7c1a9e304` folds it into `notes` before dropping (data-preserving); removed from `ContactIn`/`_contact_dict`/model; contract regen'd.
3. **[9-2]** `?entity_id` → honest 400 on all 8 endpoints (`reject_entity_id` dep, plain-language copy). Contract regen'd (query param).
4. **[9-7]** Equality test pinning the one doc-attention derivation (test-only, mutation-proven teeth).
5. **[9-8]** `_REVIEW_SOON_DAYS = 30` added to PRODUCT-SPEC §5 D-059 + a behavioural code test (surfaces at 30d, silent at 31d).
6. **[9-9]** Estate GLOSSARY terms authored spec-first, popover mirrored, parity green. **PROPOSED — ratify at the walk.**
7. **[9-10]** STANDING legal-advice-language content guard (disclaimer RATIFIED VERBATIM); RED→GREEN mutation-proven.
8. **[9-3 / 9-4]** Money/affix + staleness/confidence recorded **N/A (CHOSEN)**; typed `/estate` response DEFERRED (`08-TECH-DEBT.md`).

**Phase 0a — kitchen-sink Estate specimen BUILT (the GEOMETRY GATE).** `frontend/src/routes/EstateMockup.tsx`
+ `Estate.css`, mounted in `KitchenSink.tsx` (bleed Section) — **view at `/kitchen-sink` → "Estate — LAYOUT
SPECIMEN"**. Three frames: (a) populated register (7 contacts incl. one 3-role, long names; 10 documents,
one MISSING + two OUTDATED; bare em-dash optional cells), (b) all-empty registers (EmptyState reason+CTA;
profile `will_status none`), (c) the ROLES Switch multi-select (§9-6). Geometry: profile card → readiness
COUNTS strip (no currency affix) → contacts DataTable → documents DataTable → ratified disclaimer once.

**AWAITING OWNER GEOMETRY RATIFICATION.** **Phase 1 (page assembly) is BLOCKED** until the owner ratifies
the specimen geometry by looking (`/kitchen-sink`). Out of scope until then: nav flip, `/estate` route,
`overflow.spec.ts` route-array additions (all three), the no-money-string render guard (ships Phase 2).

## NEXT
2. Then the standing queue, unchanged: **Accounts** (D-065, `entity_id` scoping; **also owns the Institution
   master §9-5 defers to it**) · **Reports (+ Pack)** · **Settings** · **Help · Legal** · the **AI-surfaces
   milestone** · **Voice** (definition still owed — only after the owner defines it, ROADMAP **R-32**) · then
   release **Gates C→F** and tag `v2.0.0`.

**Release posture unchanged (RD-9 Amendment 3):** the release gate is **FULL COMPLETION**; Gates C–F stay
dormant until the owner accepts the full set. **Standing, owner-only:** the **CLA counsel review** before the
first external merge (Gate B2).

## Scheduled cross-page retrofits (owner-picked targets; each re-runs its own pre-pass)

These are **platform patterns ratified on one page** that later-accepted pages must adopt one at a time —
never a one-shot sweep (the *"per-instance copies of a standard ARE the defect"* rule, applied forward).
Each target is a **small commit + a pre-pass re-run**, owner picks the order:

- ~~**Base-currency indication**~~ — **✅ DONE (owner pulled it forward, walk batch 2 §14in-7, 2026-07-16).**
  DESIGN-SYSTEM §5.2 **RATIFIED**; the muted served-`base_currency` affix (`.lf-stat__unit`, one form) is
  applied to every money summary tile/strip: Net worth (four tiles), Portfolio (rail + Costs), Holdings,
  Review, Scenarios (exposures + caption), Cash flow (runway), Home (net-worth/change), Insurance (first).
  Inline `SGD` embeds (Review/Holdings/Home) converted to the one affix. Instrument Detail has no
  base-currency summary tiles (facts `<dl>` labels the currency) — out of scope.
- **[Help] popover scope + Segmented extraction** — the standing prior retrofits (page-markets / page-news
  legacy) remain owner-picked.

## ROADMAP additions (this session)

- **R-36 — Insurance premiums → Cash flow (derived integration)** (owner-requested 2026-07-16,
  page-insurance §14in-3). Parked; a plan file must decide derived-line vs suggested-entries, double-count
  handling, D-057 §0-protected invariants untouched, one derivation (the §14in-2 `_annual_premium`),
  lapse/deletion semantics, and which figure Review summarises. **No behaviour invented.**

## OWNER RATIFICATIONS (2026-07-14)

- **A10 wording — RATIFIED AS PROPOSED.** The served copy stands verbatim:
  **"1 holding is low-confidence — these figures may not reflect current values."**
  The served fields are ratified with it: **`stale_inputs`, `low_confidence_inputs`, `inputs_stale`,
  `inputs_note`** (on `/policy/drift`; `stale_inputs` + `inputs_stale` on `/review` `sections.policy`,
  from the **same reader**, so the two cannot disagree).
  **Judgment call CONFIRMED: NO second Review attention item.** *Rationale, recorded:* the existing
  **stale-prices signal already covers that surface** — a second item would **double-report one fact**,
  and an attention list that says the same thing twice teaches the user to discount all of it. The
  annotation rides the **verdict** instead of becoming a competing row. **This closes page-policy §9-5.**
- **Currency-master divergence — RESOLVED, option (a): the SPEC follows the verified CODE.**
  **MASTER-DATA §3 is AMENDED**: **`SUPPORTED_CURRENCIES`** (`app/core/config.py:18`, **9 codes**) is
  documented as **the canonical currency master**. **The reference TABLE it described was never built** —
  the amendment says so plainly rather than leaving a spec that describes a fiction.
  **`is_base_eligible` is restated against the constant:** all 9 codes are base-eligible, so the flag's
  distinction is **real but currently degenerate** (base set == transaction set). **Note recorded:** if
  multi-currency expansion ever needs a genuine transaction-only tier, **building the real table is a
  deliberate future delta** — one line in the amendment, **no R-item** (it is a consequence of a product
  decision not yet made, not a parked piece of work; **R-2** is the decision that would trigger it).
  Superseded §3 text is **struck through, preserved**.

## Needs decision

All open items are **ratification of authored PROPOSED values** (not blocking):

- **DEF-2 `asset_subclass` (MASTER-DATA §2)** — ratify/amend the 6-value vocab;
  `etf`/`reit` are the two speculative additions (D-009, not in code). Now carry
  **D-085 classification guidance** (class=exposure, subclass=wrapper); still
  PROPOSED pending kitchen-sink ratification.
- **DEF-6 sector seed (MASTER-DATA §6)** — the 11 GICS sectors were **affirmed at
  review (A2)**; ratify formally at kitchen-sink. The 3 no-map values stay
  `sector=null` and now surface as the D-082 "Not sector-classified" bucket.
- ~~Design tokens (DESIGN-SYSTEM §2)~~ — **RATIFIED 2026-07-10** (with 3
  amendments: accent, light gain, treemap magnitude scale). Only residual: a
  **future** ADR if the UI/serif fonts are ever self-hosted (fallback stacks ship
  now). See `docs/plans/RATIFICATION.md`.
- ~~Cash flow route~~ — **resolved**: `/cash-flow` canonical, `/planning`
  redirects (D-022 principle applied to D-056).
- ~~Segment/category chart palette~~ — **RESOLVED (ratified 2026-07-10)**: the
  5-tone slate-ramp+accent palette approved as implemented.
- ~~Generic `Select` primitive~~ — **RESOLVED (ratified 2026-07-10)**: `ui/Select`
  is the home for non-master view-scope selects; MasterSelect stays bound to
  MASTER-DATA vocabularies.

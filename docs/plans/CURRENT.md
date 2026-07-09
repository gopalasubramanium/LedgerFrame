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

## IN-PROGRESS

- (none)

## NEXT

1. **Kitchen-sink / ratification review** — the surface now exists: run
   `cd frontend && npm run dev`, open `/#/kitchen-sink`, and walk
   `docs/plans/RATIFICATION.md` to ratify the PROPOSED design tokens
   (DESIGN-SYSTEM §2), resolve the two open interpretations (segment palette;
   generic Select), and confirm the authored DEF-2/DEF-6 vocabularies
   (MASTER-DATA §2/§6). Clear the PROPOSED markers for what is approved.
2. **Feature build (post-freeze)** — per the API-CONTRACT delta table, each
   gated by its own plan file: `/refdata` (D-005), entity CRUD (D-065), holdings
   CSV export (D-050), the Realised P/L / Review / Ongoing-cost renames (D-026/
   D-030/D-029), and the route-rename redirects (D-022/D-056).

## Needs decision

All open items are **ratification of authored PROPOSED values** (not blocking):

- **DEF-2 `asset_subclass` (MASTER-DATA §2)** — ratify/amend the 6-value vocab;
  `etf`/`reit` are the two speculative additions (D-009, not in code). Now carry
  **D-085 classification guidance** (class=exposure, subclass=wrapper); still
  PROPOSED pending kitchen-sink ratification.
- **DEF-6 sector seed (MASTER-DATA §6)** — the 11 GICS sectors were **affirmed at
  review (A2)**; ratify formally at kitchen-sink. The 3 no-map values stay
  `sector=null` and now surface as the D-082 "Not sector-classified" bucket.
- **Design tokens (DESIGN-SYSTEM §2)** — ratify PROPOSED palette/type/spacing/
  density; the UI/serif font choice may need an ADR if self-hosting adds a
  dependency.
- ~~Cash flow route~~ — **resolved**: `/cash-flow` canonical, `/planning`
  redirects (D-022 principle applied to D-056).
- **Segment/category chart palette (DESIGN-SYSTEM §4)** — §4 mandates "slate ramp
  + accent" for allocation/category segments but §2.1 defines no explicit
  categorical palette. Phase C derived 5 tones from existing tokens (accent +
  slate lightness ramp); ratify or replace at kitchen-sink.
- **Generic `Select` primitive** — added in Phase C for non-master view-scope
  selects (D-046 QuoteCardRow source), since §5 names only MasterSelect and §6
  bans raw `<select>`. Confirm this is the intended home vs. folding into
  MasterSelect.

# design-system-build.md — Frontend foundation + design system + kitchen sink

**Milestone.** Stand up the v2 frontend app, implement the DESIGN-SYSTEM tokens
as the single source of truth, build the full DESIGN-SYSTEM §5 component
inventory, and assemble a `/kitchen-sink` ratification surface. **Components
only — no real pages, no templates.** The four page templates
(overview/entity-detail/worklist/settings) are explicitly out of scope for this
milestone.

**Governing specs:** `DESIGN-SYSTEM.md` (normative tokens + component inventory),
`DESIGN-BRIEF.md` (source brief), `INFORMATION-ARCHITECTURE.md` (page/reader
context), `API-CONTRACT.json` (frozen schemas for mock data), `GLOSSARY.md` +
`MASTER-DATA.md` (terminology + vocabularies). CLAUDE.md hard rules apply:
no invented UI/terms/fields; every term matches GLOSSARY; categorical fields
reference MASTER-DATA; no money math in the frontend; no new dependency without
an ADR.

**Cadence:** one commit per phase; update `CURRENT.md` at the end of each phase;
flag any spec gap as **Needs decision** in CURRENT.md rather than improvising.

---

## Stack decision (ADR-0002)

- **React + TypeScript + Vite**, matching the legacy frontend so patterns and
  team knowledge carry over. This is a **from-scratch build** — no legacy
  component code is copied in.
- **Styling:** CSS custom properties are the single source of design tokens
  (DESIGN-SYSTEM §2 values). A thin hand-rolled utility/class layer sits on top;
  no CSS framework dependency is added (would need its own ADR).
- **Hard requirement:** every colour / size / space / radius in any component
  resolves to a token CSS variable. **No literal hex or px values in
  components** — enforced by the Phase A drift check.
- Recorded as `docs/adr/0002-frontend-stack-react-vite.md`.

New runtime/build dependencies introduced by this milestone (react, react-dom,
react-router-dom, vite, typescript, vitest, eslint, testing-library) are
authorized under this ADR as the baseline toolchain. Any dependency **beyond**
this set — a CSS framework, a charting library (ECharts escape hatch, D-053), a
self-hosted webfont package — requires its own ADR (CLAUDE.md).

---

## PHASE A — Scaffold

**Goal:** a booting `frontend/` app that talks to the backend, switches themes
through the token layer, and has the lint/typecheck/test + drift-check tooling
wired.

Scope:
- `frontend/` Vite + React + TS app; dev server on 5173 (backend already
  allow-lists this origin for CORS, `app/main.py:159`).
- Backend health probe: a small client that calls `/health` (backend on
  `127.0.0.1:8321`) via a Vite dev proxy, surfaced on the boot screen
  (ok / unreachable / version). This proves the FE↔BE seam without building any
  real page.
- Theme switching: **light / dark / system** cycle (D-066) wired to the token
  layer — `system` resolves via `prefers-color-scheme`, an explicit choice
  overrides, persisted to localStorage (per-device, D-078). Theme is applied by
  stamping `data-theme` on the document root; tokens key off it.
- Tooling: ESLint + `tsc --noEmit` typecheck + Vitest; npm scripts for
  `dev/build/lint/typecheck/test`.
- **Drift check** (`scripts/check-design-tokens.mjs`): fails if any component
  source under `frontend/src` (excluding the token file(s) and theme setup)
  contains a raw hex colour or a hardcoded px value. Wired to an npm script and
  intended for CI. Ships with the rule proven (a deliberate violation fails it).

**Acceptance criteria:**
- [ ] `npm run dev` boots; the app renders and shows backend health status
      (ok + version when the backend is up, a clear unreachable state when not).
- [ ] Theme cycle light→dark→system works, persists across reload, and `system`
      follows the OS preference; all theme-driven values come from tokens.
- [ ] `npm run lint`, `npm run typecheck`, `npm run test` all pass on the
      scaffold.
- [ ] `npm run check:tokens` passes clean on the scaffold **and** fails when a
      raw hex/px is deliberately introduced into a component (demonstrated, then
      reverted).
- [ ] No literal hex/px in any component; token file is the only place values
      live.

---

## PHASE B — Tokens

**Goal:** DESIGN-SYSTEM §2 implemented as the token layer, complete with the
density, reduced-motion, and high-contrast axes (D-078), and tabular figures
proven.

Scope:
- §2.1 colour ramp (light + dark, both themes) — every semantic token verbatim.
- §2.2 typography — type scale 12/13/14/16/20/28 with the role line-heights +
  weights; UI family = Inter with the specified system fallback stack; serif =
  Source Serif 4 with fallback. **Fonts are loaded via the fallback system
  stacks only in this milestone — no self-hosted webfont package is added**
  (that would need an ADR per DESIGN-SYSTEM §2.2 / CLAUDE.md). Tabular figures
  via `font-feature-settings: "tnum" 1`.
- §2.3 spacing scale (4px grid), §2.4 radius/border/elevation.
- §2.5 density: **comfortable / compact** as a per-device axis (localStorage),
  driving row height + cell padding via tokens.
- D-078 a11y axes: **reduced-motion** (honours the setting AND
  `prefers-reduced-motion`) and **high-contrast** (boosts border/text contrast),
  both per-device.
- A tabular-figure proof sample (numbers aligning in a column) rendered on the
  boot/kitchen-sink surface.

**Acceptance criteria:**
- [ ] Every §2.1/§2.3/§2.4/§2.5 value exists as a CSS custom property; changing
      theme/density/contrast re-resolves them with no component edits.
- [ ] Tabular figures proven: a column of varied-width numbers aligns on the
      decimal.
- [ ] Reduced-motion and high-contrast toggles take effect (visually and via
      the media queries) and persist per-device.
- [ ] Drift check still green; no raw values leaked into components.
- [ ] Tokens carry a PROPOSED marker in comments where DESIGN-SYSTEM §2 marks
      them PROPOSED, so the ratification board can cite them.

---

## PHASE C — Components

**Goal:** build the full DESIGN-SYSTEM §5 inventory to the specified props
surfaces and usage rules, wired to realistic mock data shaped by the frozen
API-CONTRACT schemas.

Inventory (DESIGN-SYSTEM §5):
- **Inputs (§5.1):** MoneyInput, QuantityInput, PercentInput, DateInput,
  InstrumentPicker, MasterSelect.
- **Data display (§5.2):** DataTable, TrendStat, AllocationDonut, PriceChart,
  Treemap, QuoteCardRow, TickerStrip.
- **Provenance & status (§5.3):** ProvenanceBadge, StalenessChip.
- **Structure & chrome (§5.4):** PageHeader, EmptyState, ReviewCard.
  (GlossaryTerm is listed §5.4 — included as it is part of the inventory.)

Rules enforced in the build:
- Every input is a token-styled component; **no raw `<input>`/`<select>`** in
  any consumer (§6). MasterSelect never inlines an option list — vocab comes
  from mock `/refdata`-shaped data referencing MASTER-DATA.
- Monetary props are backend-computed `Decimal` **strings**; components render,
  never compute, money.
- Numbers right-aligned, tabular, per-unit dp (money 2dp, price 6dp, percent
  2dp, quantity per-instrument).
- **House-SVG charts only** (D-053): AllocationDonut, PriceChart, Treemap
  (squarified) are hand-rolled SVG — no charting dependency. If treemap parity
  fails within scope, the recorded escape hatch is ECharts **via a new ADR**
  (not taken pre-emptively).
- Charts use the semantic palette: gain/loss only on gain/loss values;
  allocation segments use the slate ramp + accent, never a rainbow.
- **Mock data is realistic finance data:** plausible instrument names + long
  names, large and negative values, multiple currencies, and
  stale/low-confidence/unavailable provenance states — so every honesty state is
  exercisable. Shapes derive from `API-CONTRACT.json`; terms from GLOSSARY.

**Acceptance criteria:**
- [ ] Every §5 component exists in `frontend/src/components/ui/` with the
      specified props surface and honours its usage rules.
- [ ] No raw `<input>`/`<select>` and no inline categorical option lists in any
      component or mock consumer.
- [ ] Charts are house SVG (no charting dependency in `package.json`); treemap
      is squarified; escape hatch untaken (or, if taken, an ADR exists).
- [ ] Mock fixtures cover negative values, long names, multiple currencies, and
      stale / low-confidence / unavailable provenance.
- [ ] Drift check, lint, typecheck, and unit tests (at least render + key-rule
      tests per component category) pass.

---

## PHASE D — Kitchen sink + ratification

**Goal:** a `/kitchen-sink` route that renders every component in every
meaningful state, plus a token swatch board, organized for a human ratification
walk-through; ending with a RATIFICATION.md checklist.

Scope:
- `/kitchen-sink` route rendering **every component in every meaningful state**:
  loading, empty, error, stale, negative, low-confidence/unavailable,
  RTL-length / very long labels, both densities, both themes,
  reduced-motion/high-contrast.
- A **token swatch board**: colour palette, type scale, spacing scale — each
  swatch **labeled with its token name** so the owner ratifies named values, not
  guesses.
- Organized top-down for a walk-through (tokens board → inputs → data display →
  charts → provenance → chrome), with each section headed and each state
  labeled.
- `docs/plans/RATIFICATION.md`: a checklist listing **every PROPOSED token**
  (palette both themes, type roles, spacing, radius/border/elevation, density
  metrics — §2.6) and **every component**, each with a checkbox, for the owner's
  sign-off.

**Acceptance criteria:**
- [ ] `/kitchen-sink` renders every component; each meaningful state is present
      and labeled; both themes and both densities are switchable live on the
      page.
- [ ] Swatch board shows palette + type scale + spacing, each labeled with the
      token name.
- [ ] `RATIFICATION.md` enumerates every PROPOSED token and every component with
      checkboxes; nothing PROPOSED in DESIGN-SYSTEM §2.6 is missing.
- [ ] Drift check, lint, typecheck, tests all green.
- [ ] CURRENT.md updated: milestone DONE, ratification review queued as NEXT.

---

## Out of scope (this milestone)

- The four page templates and any real page (Home, Net worth, …).
- Any backend change, new endpoint, or live data wiring beyond the `/health`
  probe.
- Self-hosted webfont packages, CSS frameworks, charting libraries (each needs
  its own ADR).
- Ratifying the values — that is the owner's kitchen-sink review that this
  milestone sets up.

## Status

- **PHASE A — DONE.** `frontend/` React+TS+Vite app scaffolded from scratch
  (ADR-0002). Boots with a health probe (`/health` via Vite dev proxy → backend
  on 8321) showing ok+version / unreachable; light→dark→system theme cycle
  (D-066) wired to the token layer, `data-theme` on `<html>`, per-device
  localStorage (D-078), flash-free via an inline bootstrap. Tooling: ESLint 9
  (flat), `tsc` typecheck, Vitest (3 tests). **Token drift check**
  (`scripts/check-design-tokens.mjs`) fails CI on any raw hex/px in component
  source outside the token layer — verified green clean and red on a deliberate
  violation. Minimal token slice in `src/theme/tokens.css` (full §2 set is Phase
  B). All of `npm run check` (lint+typecheck+tokens+test) and `npm run build`
  pass; dev-server proxy verified end-to-end against the live backend.
- **PHASE B — DONE.** Full DESIGN-SYSTEM §2 token set in `src/theme/tokens.css`:
  §2.1 colour (light/dark) + a **high-contrast** override layer; §2.2 type scale
  12/13/14/16/20/28 with role line-heights + weights + UI/serif fallback stacks
  (no webfont package — ADR-deferred); §2.3 full 4px spacing scale; §2.4
  radius/border/elevation (`--shadow-1`); §2.5 **density** (comfortable/compact)
  metrics; §7 **motion** duration token collapsing to 0 when reduced. D-078 axes
  wired via a `DisplayProvider` (density/contrast/motion) that stamps resolved
  `data-density`/`data-contrast`/`data-motion` on `<html>`, per-device
  localStorage, following `prefers-contrast`/`prefers-reduced-motion` when set to
  `system`; flash-free bootstrap extended to all axes. Tabular figures proven
  with a live decimal-aligned sample column. Every value carries a PROPOSED
  marker per §2.6. `npm run check` (now 4 tests) + build green; drift clean.
- **PHASE C — DONE.** Full DESIGN-SYSTEM §5 inventory in
  `src/components/ui/` (19 named components + a supporting `Sparkline` and a
  generic `Select` primitive): MoneyInput, QuantityInput, PercentInput,
  DateInput, InstrumentPicker, MasterSelect · DataTable, TrendStat,
  AllocationDonut, PriceChart, Treemap, QuoteCardRow, TickerStrip ·
  ProvenanceBadge, StalenessChip · PageHeader, EmptyState, ReviewCard,
  GlossaryTerm. All to their §5 props surfaces + usage rules: no raw
  `<input>`/`<select>` (inputs wrap natives internally); MasterSelect resolves
  every categorical field through a mock `/refdata` registry (verbatim
  MASTER-DATA seeds), never an inline list; money rendered from backend decimal
  strings via display-only formatters (no frontend math); numbers right-aligned
  + tabular + per-unit dp. Charts are **house SVG** (D-053) — Sparkline, donut,
  price chart (candles/line + MA/BB/RSI + benchmark), **squarified** treemap —
  no charting dependency; escape hatch untaken. Mock fixtures exercise negatives,
  long names, multiple currencies, and stale / low-confidence / manual /
  unavailable provenance. 22 tests. Check + build green; drift clean. Two
  under-specified points flagged (see Needs decision).
- PHASE D — NOT STARTED

## Needs decision (surfaced in Phase C — non-blocking, for kitchen-sink review)

- **Category/segment chart palette (DESIGN-SYSTEM §2.1/§4).** §4 says
  allocation/category segments use "the slate ramp + accent, not a rainbow", but
  §2.1 defines **no explicit categorical palette**. Phase C derived 5 segment
  tones from existing tokens — `--accent`, `--text-secondary`, `--border-strong`,
  `--text-tertiary`, `--text-primary` (a monochrome lightness ramp + the accent),
  cycling for >5 segments. **Ratify or replace** at review (adjacent-shade
  distinguishability + AA on surfaces). Used by AllocationDonut and Treemap-flat.
- **Generic `Select` primitive.** DESIGN-SYSTEM §5 names MasterSelect (for
  MASTER-DATA categorical fields) but no generic select, while §6 forbids raw
  `<select>` and D-046's QuoteCardRow specifies a "source" **select**
  (markets/holdings/global/watchlist — a view scope, not a data vocabulary).
  Phase C added a thin `ui/Select` primitive for such view-scope controls.
  **Confirm** this is the intended home for non-master selects (vs. folding into
  MasterSelect).

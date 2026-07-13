# page-heatmap.md — Heatmap page build plan

**Status: DONE ✅ — owner ACCEPTED the Heatmap page 2026-07-13.** All phases built, walked and closed:
§9 resolved one-pass; §11 build record; §12 walk (Batch 1 — the tile readout, an ND-7c reversal); §13
retrospective. **Ratified:** ND-7 click-through, §12hm1-1 readout (DESIGN-SYSTEM §5.2), ND-11 GLOSSARY
"Heatmap", and all page copy. No open Heatmap blockers. Drafted 2026-07-13 from
`TEMPLATE-page-build.md`. Verify-first (§10) done before §3/§4/§5 (D-019 — read what the engine serves +
audit its honesty guards). **Every gap is in §9; I resolved none.**

Heatmap is a **Markets-group** page (Markets · Heatmap · News, IA §3) on the **Overview template**
(DESIGN-SYSTEM §3). It **owns nothing canonical** — it is a treemap **visualisation** of holdings
valuations (IA §2/§5 "Owns: nothing canonical"), the visual sibling of Instrument Detail's owns-nothing
posture: every figure is a *filter/derivation of a canonical reader*, never a recompute (P-3).

> **⚠ THREE things dominate this plan (read first).** **(1) The core fits an EXISTING reader — no delta.**
> `GET /portfolio/holdings` already serves per-holding `market_value` (size), `day_change` +
> `day_change_pct` (colour), `is_stale`/`is_priced` (honesty), `asset_class` (the class filter) — so a
> v1-parity flat heatmap needs **NO §3b delta → Phase 0 is SKIPPED** (§10-1). **(2) The Treemap render is
> ALREADY RATIFIED.** DESIGN-SYSTEM §5.2 lists `Treemap` (`nodes {label,value,tone,magnitudePct}`,
> squarified) and the **magnitude scale ratified 2026-07-10** (specimen live at `/kitchen-sink`), so for
> v1-parity **Phase 0a is CONFIRM-ONLY, NO §5 amendment** — this **corrects CURRENT.md's "§5 amendment"
> phrasing** (corrected at close). **(3) The v2 enhancements the ratified component canNOT express** —
> tile **tooltip**, **click-through** (D-098), a **stale marker**, and **grouped/nested** tiles — are
> genuine gaps: each is a §9 enhancement that, only if the owner wants it, becomes a **§5 amendment**
> (tooltip/click/stale) and/or a **§3b HoldingView reshape** (region filter needs `country`/`region`;
> sector grouping needs `sector` — both live in the engine but are **not on `HoldingView`**, §10-4).

---

## 1. IDENTITY

*Source: INFORMATION-ARCHITECTURE.md §2 (page map, :74), §3 (nav + rotation, :106); DESIGN-SYSTEM.md §3.*

| Field | Value | Spec ref |
|-------|-------|----------|
| Page name (H1 = nav label = route) | **Heatmap** | IA §2 (:74), D-022 |
| Route | `/heatmap` | IA §2 (:74); nav.ts:38 already declares it |
| Nav group | **Markets** (Markets · Heatmap · News) | IA §3 (:106) |
| Page template | **Overview** (composed viewer — a chart + controls + honest legend/empty) | DESIGN-SYSTEM §3 (:227) |
| Rotation eligibility | **Confirm YES** (any nav page eligible, D-044) — and **rotation skips it when empty/errored** (D-044), which the honest empty state below already provides (ND-9) | IA §3 / DECISIONS.md:319 |
| One-line purpose | **Heatmap** — a treemap of **your holdings**: tile **size = position value**, tile **colour = today's % change** (green up / red down, intensity = magnitude). A visualisation only — every number comes from the holdings reader; it advises nothing and computes nothing. | IA §2 (:74/:263) |

---

## 2. OWNERSHIP TABLE

*Copied from INFORMATION-ARCHITECTURE.md §5 (Heatmap, :263–269). Never re-derived.*

**Owns (canonical, authoritative, fully explained here):**
- **Nothing canonical.** IA §5 is explicit: *"Owns: nothing canonical — a treemap visualisation of
  holdings."* The page owns only the **visualisation** (the treemap layout + the size/colour encoding),
  never any figure.

**Summarises (other pages' info — via the named canonical reader, never recomputed):**

| Summary shown | Canonical page | Shared reader reused | Link target |
|---------------|----------------|----------------------|-------------|
| Per-holding **value** (tile size) | Holdings / Portfolio | **`value_portfolio`** via `GET /portfolio/holdings` (`market_value`) — the same reader Holdings/Instrument Detail use | InstrumentDetail (`/instrument/{symbol}`) |
| Per-holding **today's % change** (tile colour) | Holdings / Portfolio | **`value_portfolio`** via `GET /portfolio/holdings` (`day_change`, `day_change_pct`) | InstrumentDetail |
| **Coverage** ("shown / priced") + priced-only honesty | Pricing Health (provenance) | `is_stale`/`is_priced` from the **same** `/portfolio/holdings` rows | Pricing Health (for "why unpriced") |

**Links to:** each tile → **InstrumentDetail** (`/instrument/{symbol}`) by symbol (D-098 — an entity
reference is a direct link to its detail page); the coverage/"unpriced" note → **Pricing Health** (D-038,
the canonical home for provenance/why-unpriced). *(Tile click-through is an ND — see §9-7; if declined,
the page still links out from the legend/coverage line, never a dead visual.)*

**Enforcement corollary (P-1/D-031):** the heatmap **shows no figure the holdings reader does not serve**
— size is the served `market_value`, colour is the served `day_change_pct`; the frontend performs **no
money math** (it only *classifies* the served signed change into a semantic tone and passes the served
magnitude, exactly as `signOf`/`reviewVerdict` do elsewhere — a display classification, not a
computation). Any headline figure (net worth, gross assets) is **not** shown here — it is Net worth's.

**Scoped-view posture (P-3 — the Instrument Detail lesson):** like Instrument Detail, this page **owns
nothing**; every value is a **filter of a canonical reader** (`/portfolio/holdings`, optionally scoped by
a client-side class/region filter — never a second code path, never a recompute). Acceptance proves the
tiles' values reconcile with the Holdings/Portfolio figures for the same holdings (§7).

---

## 3. API SURFACE

*Source: API-CONTRACT.json (frozen) + API-CONTRACT.md delta table. Verify-first shapes in §10.*

### 3a. Endpoints consumed (already in the frozen contract)

| Method + path | Purpose on this page | Response shape (verified §10) |
|---------------|----------------------|-------------------------------|
| `GET /portfolio/holdings` | **the whole page** — one tile per priced holding | `{base_currency, holdings:[HoldingView]}` where `HoldingView` = `{id, label, name, symbol, asset_class, quantity, currency, price, price_display, market_value, cost_basis, unrealised_pl, day_change, day_change_pct, is_stale, is_priced, valuation_method, valuation_label, price_ts}` (`portfolio.py:110/140`) |

**This single reader supplies size (`market_value`), colour (`day_change` sign + `day_change_pct`
magnitude), honesty (`is_stale`/`is_priced`), the identity link (`symbol`), and the class filter
(`asset_class`).** No other endpoint is needed for **v1 parity**.

### 3b. Contract deltas (needed but not in the baseline — BUILD BACKEND-FIRST, only if §9 approves)

**For v1-parity: EMPTY → Phase 0 is SKIPPED.** The two deltas below are **CONDITIONAL — built only if the
owner chooses the matching §9 enhancement.** Each is a **reshape** of `HoldingView` (the fields exist on
the engine's holding object — `value_portfolio` carries `sector` and `country` — but are **not exposed on
`HoldingView`**, §10-4); reshape regenerates `API-CONTRACT.json` + `docs/openapi.json` same commit, plus a
**served-value test** (TEMPLATE §3b note — a value/field that isn't shape-pinned drifts silently).

| kind | Endpoint / field (current → intended) | Gated on | Why this page would need it |
|------|---------------------------------------|----------|------------------------------|
| reshape | `HoldingView` **+ `sector`** (already on `value_portfolio` rows + served by `/portfolio/pricing-health`) | **§9-1** (grouping by sector) | a sector filter/grouping needs a per-tile sector; not on `HoldingView` today |
| reshape | `HoldingView` **+ `country`** (or derived `region`, D-083; both on the engine row) | **§9-8** (region filter, v1 parity) | v1's region filter derived region from `country`; `HoldingView` serves neither |

**⚠ Verify-first divergence flags.** **(a)** the **region filter existed in v1** (§10-6) but its inputs
(`country`/`region`) are **not on the v2 `HoldingView`** — a real gap, caught by reading the shape, not
assumed (ND-8). **(b)** grouping-by-sector needs a field the reader has internally but doesn't serve
(ND-1). Neither is invented in §3b; both are §9 questions.

---

## 4. COMPONENTS

*Source: DESIGN-SYSTEM.md §5 (ratified) + §3 (templates). Ratified only; a missing affordance is a §9
amendment request. Data-wired to the real `/portfolio/holdings` endpoint.*

| Ratified component | Role on this page | Data source (real endpoint) | Prop/state not exercised at kitchen-sink |
|--------------------|-------------------|-----------------------------|------------------------------------------|
| **PageHeader** | H1 "Heatmap" + subtitle + the size/colour legend + coverage line in actions | — | header with a legend/control cluster |
| **Treemap** (D-053) | the heatmap itself — `nodes:{label,value,tone,magnitudePct}`, `squarified` | `/portfolio/holdings` → one node per priced holding | **static render + magnitude scale already RATIFIED** (2026-07-10); node **count/scale** of a real portfolio not stress-tested at KS |
| **Segmented** *(or `MasterSelect`)* | the **asset-class filter** (v1 parity) | client-side over the served `asset_class` values (or `/refdata` AssetClass, §5) | a filter control over served categories |
| **EmptyState** | "No priced holdings to chart." (reason) · "No holdings match this filter." · reader error + retry | reader shapes | the honest empty + filter-empty |
| **Skeleton** | progressive load of the single chart card | — | one big-card skeleton |
| **GlossaryTerm** | `[Help]` on **Heatmap** and **Today's change** | GLOSSARY | the Heatmap definition (ND-11 — term not yet in GLOSSARY) |

**Data source (Holdings retrospective):** every component above is wired to the **real**
`/portfolio/holdings` reader — **no mock-backed affordance** on this page.

**Affordances the ratified Treemap LACKS (enumerated precisely — each is a §9 enhancement; NONE is needed
for v1 parity):**
- **Tile tooltip / hover readout (ND-7).** The component renders `<rect>`s + an HTML label overlay only;
  it exposes **no tile geometry or hover callback**, so the page cannot add a per-tile tooltip (symbol ·
  value · today's % change, tabular) without a **§5 amendment** (an `onHover`/tooltip render prop, or
  exposed tile rects). v1 had **no tooltip** — labels + the size·colour legend only. → §9-7.
- **Tile click-through (ND-7, D-098).** Tiles are not links; no `onSelect`/`href`. A tile → InstrumentDetail
  needs a **§5 amendment** (`onSelect(node)` or per-tile link). v1 had **no click-through**. → §9-7.
- **Stale/unpriced marker (ND-3).** `tone ∈ {gain,loss,flat}` only — there is **no way to mark a tile as
  stale/unpriced** on the ratified component. Two honest routes: **(a) EXCLUDE** unpriced tiles and show a
  **coverage note** (v1's approach — **no amendment**, recommended); **(b)** a stale marker = a **§5
  amendment**. → §9-3.
- **Grouped / nested tiles + group headers (ND-1).** The component is **flat** (one level). Grouping by
  class/sector as nested tiles with headers needs a **§5 amendment** AND a served `sector` (§3b). v1 was
  **flat + filters**, not grouped. → §9-1.

**Component usage rules the build must honour (DESIGN-SYSTEM §5/§6):**
- **Tones are SEMANTIC only** — `gain`/`loss`/`flat` + the ratified magnitude scale (`--treemap-base` +
  `color-mix` intensity, floor 15% → full at ≥5%); **no hardcoded colour**, all colour in the token layer.
- **Tabular figures** in any legend/tooltip/coverage line (tabular-nums), never proportional.
- **Honest-metadata rule** — a legend line appears only for a control/encoding actually present (no
  "region" legend if the region filter isn't built).
- **Single vertical scroll region + header outside scroll (D-101)**; **progressive per-card loading**
  (Skeleton → chart / EmptyState / error+retry).
- **Copy hygiene** — the colour metric is **"Today's change"** (D-025); **"day change"/"day_change" is
  RETIRED** (GLOSSARY :245) — it must not appear in any user string.

**Tables — dataset-size posture (D-094):** *no table on this page* (a single treemap). The treemap's node
count = priced holdings (**bounded** — tens; one tile per position), so client-side filtering is fine;
record a revisit threshold (~hundreds of holdings → tiny tiles unreadable → an "others" floor, §9-5).

---

## 5. VOCABULARIES

*Source: MASTER-DATA.md + served data.*

| Field on this page | Vocabulary / source | Fixed / served | Ref |
|--------------------|---------------------|----------------|-----|
| **asset_class** (class filter) | served `asset_class` on each holding → MASTER-DATA `AssetClass` (D-005) | served display keys; the filter control uses `/refdata` AssetClass **or** the distinct served values (ND — §9-1 confirms) | §10; MASTER-DATA AssetClass |
| **region** (region filter — *only if §9-8 approved*) | **D-083 six buckets** (India · Singapore · US · Europe · APAC · Other), derived from `listing_country`, never stored | served **only after the §3b reshape** (country/region not on `HoldingView` today) | GLOSSARY:158; MASTER-DATA §4 |
| **today's % change** (colour) | served `day_change_pct` | served number; **label = "Today's change"** (D-025), never "day change" | GLOSSARY:112 |

All labels are **served display strings** (D-005) — render verbatim; **never** show an internal field name
(`day_change_pct`, `asset_class` key) in a user string (copy hygiene).

---

## 6. DECISIONS IN FORCE

| Decision | What it forbids / requires on this page |
|----------|------------------------------------------|
| **D-053** | **Heatmap = KEEP, re-implemented.** Rebuild the treemap on the **house SVG chart layer (squarified), DROPPING ECharts.** **Escape hatch (verbatim):** *"if parity isn't reached within the plan-file scope, fall back to ECharts with an ADR documenting the single-dependency exception."* House-SVG **first**; ECharts **only** as a last resort **gated by the checkable parity definition in §7** + an ADR — never a default, never a vibe. |
| **D-038 / P-1** | Owns **nothing**; every figure is the holdings reader's; no headline total here; provenance/"why unpriced" links to **Pricing Health**. |
| **D-098** | An entity reference (a tile's symbol) is a **direct link to InstrumentDetail** (`/instrument/{symbol}`) — if tile click-through is approved (§9-7). |
| **D-025** | The colour metric is **"Today's change"** — the **only** term; "day change"/"Day"/"Total change" retired. |
| **D-024** | Price-move direction uses **Gainers / Losers** vocabulary (Markets); this is a visualisation, not a movers *list*, so no ranked list — but any directional wording aligns (gain/loss). |
| **D-083 / D-007** | **Region** is derived from `listing_country`, **never stored**; six buckets. Only relevant if the region filter is approved (§9-8). |
| **D-082** | A positive holding with **no resolved sector** rolls into an explicit **"Not sector-classified (non-equity)"** bucket — relevant only if sector grouping is approved (§9-1); never a silent merge. |
| **Guarantee 3 / D-027** | **Gross-assets principle:** only positive-value, priced holdings size a tile; **liabilities (negative) and unpriced holdings are honestly excluded with a stated reason** (a coverage note), never faked or sized at 0 silently. Every empty region states why. |
| **D-094** | Bounded dataset (one tile/holding); client-side filter fine + a revisit threshold recorded (§9-5). |
| **D-065 / P-7** | **Household scope** — the holdings reader takes **no `entity_id`** (only `symbol`), so the heatmap is household-only; logged for the Accounts milestone (no selector now, §9-10). |
| **D-044** | Rotation-eligible; **rotation skips empty/errored pages** — the honest empty state satisfies this (§9-9). |
| **D-005 / D-050** | Served vocab/labels (zero-copy); any export is server-side (no CSV planned here — a treemap isn't tabular; confirm §9 if wanted). |

---

## 7. ACCEPTANCE CRITERIA

- [ ] **Happy path (size + colour):** with priced holdings, the treemap renders **one tile per holding**,
      **size ∝ `market_value`**, **tone = sign(`day_change`)** (gain/loss/flat) with **intensity ∝
      |`day_change_pct`|** (the ratified magnitude scale). Tile values **reconcile** with Holdings/Portfolio
      for the same holdings (P-1, no recompute).
- [ ] **Priced-only + coverage (Guarantee 3):** unpriced holdings are **excluded** and a **coverage line**
      states "showing N of M holdings" (or the §9-3 resolution); **liabilities are excluded** (gross-assets)
      with a stated reason — never a 0-sized or faked tile.
- [ ] **Stale (Guarantee 3):** stale-but-priced tiles are handled per §9-3 (flagged or noted) — never
      silently shown as fresh.
- [ ] **Empty state:** no priced holdings → **"No priced holdings to chart."** (reason); filter empties →
      **"No holdings match this filter."**; reader error → honest error + retry. (Empty ⇒ rotation skips it,
      D-044.)
- [ ] **Class filter (v1 parity):** filtering by asset class narrows the tiles; the control uses served
      categories (§5); "All" restores. *(Region filter only if §9-8 approved.)*
- [ ] **Copy hygiene:** the colour metric reads **"Today's change"** everywhere; **grep proves no "day
      change"/"day_change"/internal field name** in any user string (§11-8 / §11-4 app-wide).
- [ ] **Terms match GLOSSARY:** `[Help]` on **Heatmap** (ND-11 — add the term) and **Today's change**;
      categoricals from MASTER-DATA via `/refdata` (or served values).
- [ ] **No frontend money math** — size/colour are served values; the frontend only classifies sign → tone.
- [ ] **Both themes + densities;** tones legible in light AND dark; labels render only where the tile is
      large enough (>8%×6%, the component rule) and stay crisp.
- [ ] **Rendered layout + overflow (jsdom cannot measure — Playwright):** at **320/375/900/1366 × both
      themes**, **zero horizontal overflow** (extend `e2e/overflow.spec.ts`) + **single vertical scroll
      region** (only `.lf-shell__content` scrolls). Geometry fixes **fail-first**.
- [ ] **Rendered tile-geometry check (pre-pass):** on a seeded portfolio, assert the treemap fills its card
      (no dead space), tiles are non-overlapping, and the largest holding is the largest tile — measured
      with `getBoundingClientRect` in the Playwright pre-pass, not jsdom.
- [ ] **CHECKABLE PARITY DEFINITION (the D-053 ECharts gate).** "Parity reached in-scope" = **ALL** of:
      (1) house-SVG squarified tiles, size ∝ value, within the card at all four breakpoints × both themes;
      (2) semantic tone + ratified magnitude intensity, correct in both themes; (3) labels legible on tiles
      above the size threshold, no clipping/overflow; (4) priced-only + honest coverage/empty states;
      (5) the class filter works; (6) 0 console errors, single scroll region, 0 overflow (pre-pass GREEN).
      **The ECharts escape hatch (D-053) is triggered ONLY if this checklist cannot be met with the house
      SVG within plan-file scope, and ONLY with an ADR documenting the single-dependency exception** — it
      is a measured gate, never a preference.

---

## 8. BUILD PHASES

*One commit per phase. Backend deltas FIRST. **Do not start until §9 clears.***

- **Phase 0 — Contract deltas: SKIPPED for v1-parity (§3b empty).** Built **only if** §9-1 (sector) or §9-8
  (region) is approved → then a `HoldingView` **reshape backend-first** (regenerate contract same commit +
  a served-field test), **before** any assembly.
- **Phase 0a — Treemap specimen: CONFIRM-ONLY (no §5 amendment) for v1-parity.** The static render +
  magnitude scale are **already ratified** (2026-07-10; specimen at `/kitchen-sink`) — confirm the page's
  node mapping against it. **Author a PROPOSED §5 amendment ONLY if** the owner approves an enhancement the
  component can't express (tooltip / click-through / stale marker / grouping, §9-7/§9-3/§9-1) — then ratify
  it at `/kitchen-sink` before assembly.
- **Phase 1 — Page assembly:** compose PageHeader + Treemap + filter + EmptyState/Skeleton over
  `/portfolio/holdings`; map holdings → nodes (priced-only; size=`market_value`; tone=sign(`day_change`);
  magnitude=|`day_change_pct`|); coverage line; honest empty/error; class filter; `[Help]`.
- **Phase 2 — Tests:** node-mapping test (size/tone/magnitude from served fields; priced-only excludes
  liabilities + unpriced); coverage-line test; filter test; honest empty/error; **extend the overflow +
  single-scroll suites to `/heatmap`**; drift/typecheck/lint/build green. Layout claims are NOT closed by
  jsdom (§7).
- **Phase 3a — Scripted pre-pass (GREEN before the walk):** drive the live `/heatmap` on the seeded demo +
  real backend; assert rendered tiles, coverage/empty honesty, the class filter, **rendered tile-geometry**
  (fills card, non-overlapping, largest-holding-largest-tile), 0 overflow 320/375/900/1366 × both themes,
  single scroll region, 0 console errors. Geometry fixes **fail-first** (reproduce the defect first).
- **Phase 3b — Owner acceptance walk (LIVE, judgment items only):** each finding → a numbered
  `page-heatmap.md §*` entry, fixed + re-verified live; **the Heatmap GLOSSARY term ratifies at the walk**
  (ND-11); **the owner closes the page** (never self-certified).

---

## 9. NEEDS DECISION — RESOLVED (owner, one-pass, 2026-07-13)

All 12 items resolved in one pass; each matched a §9 item by **number + topic**. Considered-options table
preserved beneath.

**Resolutions (owner, 2026-07-13):**
- **ND-1 (a) — FLAT per-holding tiles** (v1 parity). No nested-treemap amendment, no `sector` reshape for
  grouping. Grouped views are a future amendment via their own plan only.
- **ND-2 (a) — size = `market_value`** in base currency.
- **ND-3 — colour = Today's change % (served `day_change_pct`); (a) EXCLUDE UNPRICED + coverage note;
  INCLUDE STALE.** Rationale (verbatim): *stale holdings have real cached values — excluding them would
  hide them (Guarantee 3); their staleness honesty on this page is carried by the global StaleBanner (the
  P-1 summary of the canonical Pricing Health reader), so a per-tile stale marker is declined as
  duplication, not forgotten.* Coverage note **"Showing N of M holdings — unpriced excluded."** (PROPOSED,
  ratify at walk).
- **ND-4 (a) — EXCLUDE liabilities**, on-page note **"Assets only — liabilities are excluded."**
  (gross-assets principle; PROPOSED copy).
- **ND-5 (a) — render all tiles, labels only where they fit.** Revisit threshold (D-094): if a portfolio
  approaches **~200 positions**, revisit an "Others" floor (plan note, no build).
- **ND-6 (a) — NO export here** (DECLINED, not deferred — Reports territory).
- **ND-7 (b, NOT c) — CLICK-THROUGH YES, TOOLTIP NO.** A §5 Treemap amendment: per-tile activation →
  InstrumentDetail (D-098), `onSelect`/`href` on nodes. **HARD REQUIREMENTS:** keyboard operability (tiles
  focusable, Enter/Space activate, visible focus ring — WCAG-AA) and **no layout shift** on hover/focus.
  Author PROPOSED + a `/kitchen-sink` open-state (keyboard) case; ratify at the walk (PriceChart precedent).
  **Hover tooltip DECLINED for v2** (touch/a11y surface not needed; labels + legend carry symbol + Today's
  change) — a future amendment if wanted, noted, not ROADMAP-worthy.
- **ND-8 (b) — KEEP the region filter; approve the §3b reshape.** Additive `HoldingView` fields `country`
  + served `region` (D-083 six buckets, derived **SERVER-SIDE** from `listing_country` — no client region
  map, the Markets rule). Backend-first, contract regen same commit, drift green; **fail-first** (test red
  on the old shape). Filters = `ui/Select` (view-scope): class + region; filter empty-state uses ND-12.
- **ND-9 — rotation YES** (D-044; empty ⇒ auto-skip).
- **ND-10 — HOUSEHOLD-ONLY confirmed**; logged for the Accounts milestone.
- **ND-11 — ADD "Heatmap" to GLOSSARY** (PROPOSED, ratify at walk): a treemap visualisation of your
  holdings — tile size = value, colour = Today's change; owns no figure (every number from the canonical
  readers). `[Help]` on **Heatmap** + **Today's change**.
- **ND-12 — both empty-state strings ACCEPTED verbatim:** **"No priced holdings to chart."** /
  **"No holdings match this filter."**

**Lower-risk confirms ratified as listed:** served labels (D-005); reporting-only; the honest coverage
note; house-SVG-first with the checkable ECharts parity gate (§7).

**⚠ Verify-first divergence reconciled in Phase 0 (D-083, §10-9).** The server region derivation
(`policy.py:region_of`) is the **legacy 3-bucket** (`IN/SG/US` → else "Global"), but D-083 / `/refdata`
define the **six buckets** (India · Singapore · US · Europe · APAC · Other, MASTER-DATA §4). Phase 0
reconciles `region_of` to the ratified six-bucket derivation (one canonical server function, reused by
both the new `HoldingView.region` and the policy region dimension), per-bucket fail-first tests. Recorded
like the review D-084/D-087 code drift — a ratified model the code hadn't fully implemented.

**Build sequence:** Phase 0 (ND-8 reshape + region reconcile, backend-first, contract regen, fail-first) →
Phase 0a (ND-7 click-through amendment PROPOSED at `/kitchen-sink`; magnitude scale confirm-only) → Phase 1
assembly → Phase 2 tests (+ overflow/single-scroll to `/heatmap`) → Phase 3a scripted pre-pass GREEN. STOP
for the Phase-3b owner walk. Ratifications pending at the walk: **ND-11 GLOSSARY term, ND-7 click-through
amendment, the two empty strings + the coverage/assets-only notes.**

### CLOSE lines — owner walk, 2026-07-13

- **CLOSE ND-7 (click-through) — RATIFIED 2026-07-13.** The DESIGN-SYSTEM §5.2 Treemap amendment moves
  **PROPOSED → RATIFIED** (keyboard-operable tile links, no layout shift). *The tooltip half of ND-7 is
  **REVERSED** on live evidence — see §12hm1-1.*
- **CLOSE ND-11 — RATIFIED 2026-07-13.** "Heatmap" is a GLOSSARY term. **⚠ Strike found at the walk:**
  the term had been added to the frontend glossary data (`mocks/glossary.ts`) but **NOT** to
  `docs/specs/GLOSSARY.md` — the file the CLAUDE.md hard rule actually names. The Phase-1 build record
  claimed "GLOSSARY gains Heatmap" and was **not true of the spec**. Fixed at the close (GLOSSARY §System).
- **CLOSE ND-12 + the coverage/assets-only notes — RATIFIED verbatim 2026-07-13.** "No priced holdings to
  chart." / "No holdings match this filter." / "Showing N of M holdings — unpriced excluded." /
  "Assets only — liabilities are excluded."
- **Walk note — the dominant flat "Home (est.)" tile is ACCEPTED, not a defect.** The largest holding has
  no daily change, so it renders as a large neutral tile. That is honest (size = value, colour = Today's
  change) and matches v1. **Recorded so it never resurfaces as a defect.** *(Live confirmation: the reader
  serves `day_change_pct = 0` for it — a manual valuation that genuinely did not move today — so the tile
  reads "Today's change 0.00%", a real served zero, not the em-dash/absent case.)*

---

**Considered options (draft record — the resolutions above are authoritative).**

| # | Item | Why it blocks / what's needed | Options (owner picks) |
|---|------|-------------------------------|-----------------------|
| **ND-1** | **Grouping dimension: flat vs grouped.** | The Treemap is **flat**; `HoldingView` serves `asset_class` but **not `sector`**. Grouping needs a component amendment (§4) + possibly a `sector` reshape (§3b). | **(a) FLAT per-holding tiles (v1 parity, recommended — no amendment/delta);** (b) grouped by **asset_class** (served) — needs a nested-treemap §5 amendment; (c) grouped by **sector** — needs BOTH the amendment AND the `sector` reshape (§3b). |
| **ND-2** | **Size metric confirm.** | v1 sized by `market_value`; confirm for v2. | **(a) `market_value` in base currency (v1 parity, recommended);** (b) something else (would need a served field). |
| **ND-3** | **Colour metric confirm + stale/unpriced treatment.** | Colour = today's % change (`day_change_pct`). Stale/unpriced honesty (Guarantee 3) has no component marker. | Colour: **today's % change (v1 parity, recommended)**. Stale/unpriced: **(a) EXCLUDE unpriced + coverage note (v1, no amendment, recommended);** (b) a stale marker (§5 amendment). |
| **ND-4** | **Liabilities (negative values).** | A negative value can't size a tile; gross-assets principle excludes them. | **(a) EXCLUDE liabilities, note "assets only" (recommended, matches allocation/GLOSSARY);** (b) a separate liabilities strip (new surface → ROADMAP). |
| **ND-5** | **Small / zero-value tile floor.** | Tiny holdings → sub-pixel, unlabelled tiles; at hundreds of holdings the map is unreadable. | **(a) render all, labels only where they fit (v1, recommended for tens);** (b) an "Others" floor below X% (new behaviour); record a revisit threshold (D-094). |
| **ND-6** | **CSV / export?** | A treemap isn't tabular; Reports owns exports (D-050). | **(a) NO export here (recommended — Reports territory);** (b) export the underlying holdings table (already at `/portfolio/holdings.csv`). |
| **ND-7** | **Tile interactivity: tooltip + click-through.** | Neither exists on the ratified component (§4). Both are **§5 amendments** if wanted; v1 had neither. | **(a) NONE (v1 parity — labels + legend only, no amendment);** (b) **click-through → InstrumentDetail** (D-098) — §5 amendment; (c) **hover tooltip** (symbol · value · today's % change, tabular) — §5 amendment; (b)+(c) together. |
| **ND-8** | **Region filter (v1 had it).** | v1 filtered by region (derived from `country`). v2 `HoldingView` serves **neither `country` nor `region`** — needs a §3b reshape. | **(a) DROP the region filter for v2 (class filter only — no delta);** (b) KEEP it — approve the `country`/`region` `HoldingView` reshape (§3b). |
| **ND-9** | **Rotation eligibility.** | D-044 says any nav page is eligible; confirm + rely on the empty state (rotation skips empty). | **Confirm YES** (recommended; empty ⇒ auto-skip). |
| **ND-10** | **Entity scope.** | The holdings reader takes no `entity_id` (household). | **Confirm HOUSEHOLD-ONLY** (recommended; log for Accounts, no selector now). |
| **ND-11** | **Terminology: "Heatmap" not in GLOSSARY.** | CLAUDE.md hard rule — every shown term is in GLOSSARY with that spelling. "Heatmap" is a nav label/H1 but **has no GLOSSARY entry**. | **ADD PROPOSED "Heatmap"** (a treemap visualisation of your holdings; size = value, colour = today's change; owns no figure) + `[Help]`, ratify at the walk (Review ND-11 pattern). Colour term is **"Today's change"** (already GLOSSARY, D-025). |
| **ND-12** | **Empty-state copy (exact strings).** | Guarantee 3 wants a reason; confirm wording. | Proposed: **"No priced holdings to chart."** (no data) / **"No holdings match this filter."** (filter) — owner confirms verbatim. |

**Lower-risk confirms (owner ratifies with the above):** served labels throughout (D-005); reporting-only
(no advice/action); the coverage note honest; house-SVG-first with the checkable ECharts gate (§7).

---

## 10. VERIFY-FIRST FINDINGS (2026-07-13) — read before assuming shapes (D-019 + audit guards)

Ran the read-what-the-engine-serves pass (and read the legacy v1 heatmap, read-only reference) before
drafting §3/§4/§5. **No shape assumed; gaps went to §9, not §3b guesses.**

| # | What the engine actually serves / the legacy did | Source (file:line) |
|---|--------------------------------------------------|--------------------|
| 1 | **`GET /portfolio/holdings` serves everything for a flat heatmap:** per-holding `market_value` (size), `day_change` + `day_change_pct` (colour), `is_stale`/`is_priced` (honesty), `symbol` (link), `asset_class` (class filter). ⇒ **§3b empty, Phase 0 skipped.** Route takes `symbol` scope only (no `entity_id`). | `app/api/v1/routes/portfolio.py:110` (HoldingView), `:126–128` (day_change/pct, is_stale), `:140–154` (route) |
| 2 | **The reader is `value_portfolio`** — the SAME reader Holdings + Instrument Detail use (P-1 reconciliation by construction). `day_change_pct` is a computed property on the holding row (`market_value − day_change → prev`). | `app/services/portfolio.py:169–173` |
| 3 | **Treemap is RATIFIED, flat, magnitude-scaled:** `TreemapNode = {label, value, tone:"gain"|"loss"|"flat", magnitudePct?}`, squarified; **magnitude scale ratified 2026-07-10** (floor 15% → full at ≥5%); specimen + scale sample live at `/kitchen-sink`. **No** tooltip / click / stale-tone / nesting. | `frontend/src/components/ui/Treemap.tsx:8/97`, `mocks/types.ts:100`, `DESIGN-SYSTEM.md:101–106/:314`, `routes/KitchenSink.tsx:531–535` |
| 4 | **⚠ `sector` + `country` are on the engine row but NOT on `HoldingView`.** `value_portfolio` rows carry `sector` (`:147`) and `country` (`:164`, "for region drift"); `sector_allocation()` exists (`:204`); `/portfolio/pricing-health` serves `sector` (`:219`). ⇒ region filter / sector grouping ⇒ a `HoldingView` **reshape** (§3b, ND-1/ND-8). | `app/services/portfolio.py:145–164/:204`, `app/api/v1/routes/portfolio.py:219` |
| 5 | **IA: Heatmap owns nothing** — "a treemap visualisation of holdings"; Markets group; house-SVG squarified, drop ECharts (D-053). | `INFORMATION-ARCHITECTURE.md:74/:106/:263–269/:416` |
| 6 | **Legacy v1 heatmap** consumed **`api.holdings`** (+ marketsOverview for quote change_pct & country): **size = `market_value` (floored at 1), colour = daily % change, FLAT per-symbol tiles, filters by asset_class AND region** (region derived from `country`), **priced-only** (`is_priced && market_value>0`) with a **`shown/total` coverage note** + a `size · colour` legend; empty states "noPriced" vs "noMatch"; demo-mode note. **No grouping, no tooltip, no click-through.** | `~/Documents/github/LedgerFrame/frontend/src/pages/Heatmap.tsx` (read-only reference) |
| 7 | **Terminology:** the colour metric's canonical term is **"Today's change"** (D-025); **"day change"/"Day"/"day_change" are RETIRED** (must not appear in user copy). **"Heatmap" is NOT a GLOSSARY term** → ND-11 (nav label exists, definition doesn't). **Region** = D-083 six buckets, derived from `listing_country`. | `GLOSSARY.md:112/:245–246/:158` |
| 8 | **`/heatmap` is declared in nav but NOT built** (no route in `AppRoutes` → NotBuilt fallback today); household-only (no `entity_id`); **rotation skips empty/errored pages** (D-044), which the honest empty satisfies. | `frontend/src/components/ui/nav.ts:38`, `DECISIONS.md:319` |
| 9 | **⚠ Region derivation diverges from D-083.** `region_of` maps only `IN/SG/US` → else **"Global"** (legacy 3-bucket), but D-083 / `/refdata` (`_REGION = ["India","Singapore","US","Europe","APAC","Other"]`) + MASTER-DATA §4 define **six buckets** with an explicit membership table. Phase 0 reconciles `region_of` to the six-bucket derivation (ONE canonical server function, reused by `HoldingView.region` + policy). | `app/services/policy.py:26/29`, `app/api/v1/routes/refdata.py:71`, `MASTER-DATA.md:201–213` |

**Owner sign-off surface (all in §9):** ND-1 (grouping — the headline shape choice), ND-3 (stale/unpriced
honesty), ND-7 (tooltip/click = §5 amendments?), ND-8 (region filter = §3b reshape?), plus
ND-2/4/5/6/9/10/11/12. **No build until the owner resolves §9.**

---

**Sign-off to start build:** §9 has no open blocker · §3b deltas (only if ND-1/ND-8 approve) are approved ·
no §5 amendment is required unless an ND-7/ND-3/ND-1 enhancement is chosen. **CURRENT.md correction (fold
at close):** its "Heatmap needs a treemap §5 amendment" line is **imprecise** — the treemap *render* is
already ratified; a §5 amendment arises **only** if an interactive/grouping enhancement (§9) is chosen.

---

## 11. BUILD RECORD — Phases 0/0a/1/2/3a DONE; Phase-3b (owner walk) PENDING (2026-07-13)

- **Phase 0 — backend-first (ND-8), fail-first.** `app/core/regions.py` — the ONE canonical
  **six-bucket** region derivation (D-083 membership, MASTER-DATA §4; a total function, unknown → Other).
  Reconciled the legacy 3-bucket `policy.py:region_of` (IN/SG/US → else "Global") to it, re-exported so
  the policy region dimension **and** the new `HoldingView.region` share one function (§10-9 divergence).
  `HoldingView` + `_hv` gain **`country`** (nullable) + server-derived **`region`**; contract regenerated
  same commit (drift green). Fail-first proven RED on the pre-reshape shape (git-stash: ModuleNotFound /
  missing fields); tests: `test_regions.py` (per-bucket) + `test_heatmap_reader.py` (served + derived).
  **Backend 525.**
- **Phase 0a — Treemap click-through amendment (ND-7, PROPOSED).** `TreemapNode` gains optional
  **`href`** → a keyboard-operable overlay `<a>` (focusable, **Enter** native + **Space** handled),
  accessible name = label, linking to InstrumentDetail (D-098). Focus/hover = outline + inset shadow only
  (**NO layout shift**), tokenized. Back-compatible (no href ⇒ non-interactive). **Hover tooltip DECLINED**
  (ND-7). `/kitchen-sink` keyboard specimen; DESIGN-SYSTEM §5.2 amendment PROPOSED. Magnitude scale
  unchanged (already ratified 2026-07-10; confirmed against ratified tokens).
- **Phase 1 — assembly.** `routes/Heatmap.tsx` (+`.css`), routed at `/heatmap` (nav `built:true`), over
  the **existing** `/portfolio/holdings` reader (no page endpoint). Treemap of **priced holdings only**
  (excludes unpriced + liabilities, gross-assets; **stale INCLUDED**, ND-3): size = `market_value`, tone =
  sign(`day_change`), magnitude = |`day_change_pct`|; tile `href` → InstrumentDetail (symboled only).
  Class + region **`ui/Select`** filters (served values; class labels via `/refdata` D-005, region served
  display-cased). Honest **coverage note** + **assets-only note**; empty states (ND-12); progressive load;
  **`[Help]`** on Heatmap + Today's change. GLOSSARY gains **Heatmap** (PROPOSED, ND-11).
- **Phase 2 — tests.** `Heatmap.test.tsx` (5) + `Treemap.test.tsx` (3, the ND-7 keyboard amendment);
  `/heatmap` added to the overflow + single-scroll suites. **Frontend check green** (129 Playwright + unit
  + typecheck/lint/tokens).
- **Phase 3a — pre-pass GREEN.** `e2e/smoke/heatmap-smoke.spec.ts` on live app + real backend: 12 tiles ·
  RENDERED geometry (fills card, non-overlapping, container-bounded) · region filter 12→4 (US) ·
  **tile click-through → InstrumentDetail via keyboard Enter** · `[Help]` · single scroll · 0 overflow
  320/375/900/1366 × both themes · **0 console errors** · the **§7 ECharts-parity checklist all 6 PASS →
  ECharts hatch NOT triggered (house SVG stands)**. **Fail-first geometry fix (§7 "labels clipped, not
  overflowing"):** the pre-pass caught an edge-tile label spilling 27px past the map; fixed with
  `overflow:hidden` on `.lf-treemap` (clip at the boundary) + a computed-`overflowX` assertion in the
  SAME pre-pass (RED before, GREEN after).

**Verification:** backend **525** · ruff · contract drift clean; frontend **129 Playwright + unit** ·
typecheck/lint/tokens/build green; **live pre-pass GREEN**, 0 console errors. **STOP for the Phase-3b
owner walk (judgment items) — I do NOT self-certify.** Ratifications pending at the walk: **ND-11 GLOSSARY
"Heatmap"**, **ND-7 Treemap click-through amendment**, and the coverage/assets-only/empty copy strings.

---

## 12. PHASE-3b OWNER WALK — BATCH 1 (2026-07-13)

Findings from the owner's live walk. Each is reproduced (RED) before the fix; every visual fix ships its
own pre-pass assertion in the SAME batch. **Ratification pending at the re-verify: the readout amendment.**

### §12hm1-1 — Tile value readout (ND-7c REVERSAL) — DONE, ratify at re-verify

**Owner (live evidence):** the tooltip-DECLINED half of ND-7 is **reversed** — values are wanted on hover.
Not a new idea, a **reversal on evidence**: the labels + legend alone don't answer "what is this tile
worth, and what did it do today?" without leaving the page.

**Built as a §5 amendment extension to the (now ratified) Treemap — PROPOSED, ratify at the re-verify:**

- **Readout = name/symbol · value · Today's change** (D-025 — "Today's change" is the only term).
- **SERVED display strings, backend-first.** `HoldingView` gains **`market_value_display`** (grouped, 2dp)
  and **`day_change_pct_display`** (signed, U+2212 minus, 2dp, trailing `%`), from two new
  `app/core/money.py` helpers — the **D-105 posture**: the frontend renders them verbatim and **formats
  nothing**. The page pairs the served amount with the served `base_currency`; no client money math, no
  client rounding, no client sign. Contract regenerated in the same commit; drift green.
- **Hover AND keyboard focus — never hover-only** (WCAG 1.4.13). The click-through amendment already made
  linked tiles focusable; a tile with a **`readout` but no `href`** (e.g. the property) now gets a
  focusable target too, so no tile's value is pointer-only. `role=status` / `aria-live=polite` announces
  the active tile (the AllocationDonut precedent); the link's accessible name stays its **label**, so a
  link still announces its destination and not a paragraph of figures. Touch: the focus/active state shows it.
- **No layout shift, and container-safe by construction.** The readout is an **anchored overlay** (map's
  bottom-left, `pointer-events:none`) rather than a tile-following tooltip — **anchoring is the mechanism**:
  an edge tile cannot push it past the map boundary at any breakpoint, so it can never clip against the
  `overflow:hidden` the Phase-3a label fix installed. Being absolutely positioned it is out of flow ⇒ zero
  layout shift. Both themes (token layer only).
- **Honesty (Guarantee 3).** A missing figure renders as an **em dash + its reason**
  ("No prior close to compare."), never a fabricated 0 — the reader serves `null`, not `0`, when there is
  no Today's change. *(In the demo the property serves a REAL `0.00%`; the em-dash branch is exercised by
  the unit tests and the `/kitchen-sink` specimen.)*
- **Kitchen sink:** a new Treemap readout specimen (hover · Tab-focus · **edge tiles** · a tile with **no**
  Today's change).

**Fail-first evidence (RED before the fix):**
```
Error: locator.textContent: Test timeout of 30000ms exceeded.
  - waiting for locator('.lf-treemap__tip')          ← the readout did not exist
> 93 |  expect((await tip.textContent())?.trim() || "", "readout is empty until a tile is hovered/focused")
```
Then GREEN, with the pre-pass now asserting: readout **empty until** hover/focus · appears on **HOVER** ·
clears on pointer-leave · appears on **keyboard FOCUS** · carries the **"Today's change"** label ·
`.lf-treemap__hot` count **== tile count** (every tile reachable) · and **container-bounded for all 12
tiles at 320px and 1366px** (`readout is inside the map … never clipped`).

**Files:** `app/core/money.py` (`format_money_display`, `format_signed_pct_display`) ·
`app/api/v1/routes/portfolio.py` (`_hv` + `HoldingView`) · `docs/specs/API-CONTRACT.json` + `openapi.json` ·
`frontend/src/mocks/types.ts` (`TreemapReadout`) · `components/ui/Treemap.tsx` + `charts.css` ·
`routes/Heatmap.tsx` · `api/holdings.ts` · `mocks/fixtures.ts` + `routes/KitchenSink.tsx` ·
tests: `tests/unit/test_money_and_fx.py`, `tests/integration/test_heatmap_reader.py`,
`components/ui/Treemap.test.tsx`, `routes/Heatmap.test.tsx`, `e2e/smoke/heatmap-smoke.spec.ts`.

### Batch-1 verification

Backend **537** passed · ruff clean on every touched file · **contract drift green**. Frontend `npm run
check` **exit 0**: lint · typecheck · **tokens** · **172** unit · **129** Playwright (overflow +
single-scroll, `/heatmap` included). **Live pre-pass GREEN** — 12 tiles; geometry
`{fillRatio:1, overlapRatio:0, outside:0, maxTileRatio:0.807, overflowX:"hidden", mapWithinCard:true}`;
readout on hover + focus and **container-bounded on all 12 tiles @320px and @1366px**; region filter 12→4;
keyboard Enter lands on InstrumentDetail; **0 console errors**; **§7 ECharts-parity checklist all 6 PASS →
hatch NOT triggered**.

**⚠ Pre-existing, NOT mine, NOT fixed (reported, awaiting the owner's call):** `make lint` is **RED on
trunk** — 4 × ruff `E741` (ambiguous `l`) in `tests/integration/test_attribution_api.py` and
`frontend/e2e/smoke/reset.py`, from commit `3cedd36` (Portfolio Phase-3b batch 2). Untouched here because
it is outside this page's scope and the house rule is that hygiene gets its **own** commit.

### CLOSE lines — owner re-verify, 2026-07-13 (Heatmap ACCEPTED)

- **CLOSE §12hm1-1 — RATIFIED 2026-07-13.** The **readout amendment** moves **PROPOSED → RATIFIED** in
  DESIGN-SYSTEM §5.2: hover **AND** keyboard focus, the **anchored overlay** (container-safe by
  construction, no layout shift), and **served display strings** (the frontend formats nothing).
- **CLOSE — reason copy RATIFIED verbatim:** **"No prior close to compare."**
- **Walk note — the property's "Today's change 0.00%" is ACCEPTED, not a defect.** The owner reviewed it
  live: it is a **genuine served zero** (a manual valuation that did not move today), not a fabricated one
  and not the absent case. The em-dash-plus-reason branch is reserved for a **`null`** Today's change.
  **Recorded so it never resurfaces as a defect.**
- **Page CLOSED.** `/heatmap` accepted by the owner 2026-07-13. No open Heatmap blockers.

---

## 13. RETROSPECTIVE (2026-07-13)

### Strike-check first — anything claimed but not live/verifiable?

Every claim in §11/§12 was re-checked against the artefact it names, not against my memory of writing it.

| Claim | Verdict |
|-------|---------|
| **Phase 1: "GLOSSARY gains Heatmap (PROPOSED, ND-11)"** | ❌ **STRIKE — false of the spec.** The term landed in `frontend/src/mocks/glossary.ts` **only**. `docs/specs/GLOSSARY.md` — the file CLAUDE.md's hard rule actually names — never got it. Caught at the walk while recording the ratification (i.e. *by the owner's process, not by mine*). Fixed in Batch 1; now guarded (below). |
| Phase 0: `HoldingView` serves `country` + six-bucket `region`, server-derived | ✅ live — served on every row; `test_heatmap_reader.py` pins it; contract regenerated. |
| Phase 0: `policy.py:region_of` reconciled to the D-083 six buckets | ✅ live — one canonical `app/core/regions.py`, re-exported; per-bucket tests. |
| Phase 0a/§12: Treemap click-through + readout | ✅ live at `/heatmap` **and** `/kitchen-sink`; keyboard Enter lands on InstrumentDetail in the pre-pass. |
| §7 "parity is a gate, not a vibe" — 6 checkable criteria | ✅ the pre-pass **evaluates and prints** all 6; all PASS ⇒ the D-053 ECharts hatch is **not** triggered. |
| §12hm1-1: "served display strings, the frontend formats nothing" | ✅ verifiable — `market_value_display` / `day_change_pct_display` on the wire; the page concatenates the served `base_currency` and does no arithmetic. |
| Phase 3a: geometry assertions | ✅ RENDERED (`getBoundingClientRect`), not jsdom-shaped. |
| **`make lint` green** | ❌ **NOT claimed — and it is RED on trunk** (4 × ruff `E741`, from `3cedd36`, in files this page never touched). Reported, deliberately not folded in. Left open for the owner. |

### Lessons

1. **Two stores for one truth need a GUARD, not vigilance** *(the strike above)*. The glossary lives in
   `docs/specs/GLOSSARY.md` (canonical) **and** `mocks/glossary.ts` (what the popover renders). Nothing
   compared them, so a term could be "added to the glossary" while the glossary — the spec one — never saw
   it, and a build record could truthfully describe the code while lying about the spec. **A hard rule with
   no executable check is a hope.** Closed at this close with a **parity guard**
   (**`tests/unit/test_glossary_parity.py`**, 14 terms): every term the `[Help]` popover renders must exist
   in `docs/specs/GLOSSARY.md` with the **identical spelling**. Fail-first proven by breaking the spec's
   *spelling* (`Heatmap` → `HeatMap`) → **1 failed / 14 passed**, restored → **15 passed** — so it catches
   **drift**, not merely absence.
   **Placement (recorded):** **CI-unit, not the dev-only smoke suite** — the guard is hermetic (two files
   on disk; no server, DB or browser; deterministic), and the smoke convention exists for checks that need
   the LIVE app. *A guard that cannot run in CI cannot block the drift it exists to catch.*
   **Why pytest and not Vitest**, despite guarding a frontend file: reading the spec from `frontend/`
   needs either **`@types/node`** — a **new dependency**, which CLAUDE.md gates behind an **ADR** — or
   relaxing Vite's **`server.fs.allow`** outside the frontend root (widening the *dev server's* filesystem
   access for a docs check; verified — Vite rejects the import with `Denied ID`). Neither is worth it for a
   docs invariant, and **pytest already runs in CI**, reads both files with the stdlib, and is the natural
   home for repo-wide **spec-vs-code** invariants (the same posture as the API-contract drift check).
   *Both attempts are recorded here rather than silently discarded: the placement was chosen on a
   constraint, not a preference.*
2. **"Spec claims must cite the spec file."** The Phase-1 record said "GLOSSARY gains…" while the diff
   touched only a `.ts` file. The build record should name the **file it changed**; had it done so, the
   strike would have been visible at write time. *(Folded into TEMPLATE-page-build.md.)*
3. **An assertion that cannot observe the failure is not a guard.** Phase 3a's first label-overflow
   assertion used `scrollWidth`, which **cannot see a clip** — it kept reporting 27px after `overflow:hidden`
   fixed the defect. Reframing it to the computed `overflowX` + a container-bounds check made it fail-first
   for real (`visible` → `hidden`). The same instinct produced the readout's **anchored** overlay: rather
   than test-and-clamp a tile-following tooltip at every breakpoint, anchoring makes "it cannot clip" a
   **property of the layout**, so the assertion confirms a guarantee instead of sampling for a bug.
4. **A "declined" resolution is a hypothesis, and live evidence outranks it.** ND-7c declined the tooltip on
   the reasoning that "labels + legend carry symbol + Today's change". On the real page they did not — you
   could not tell what a tile was **worth** without leaving. The reversal cost one batch because the
   ratified component was extended, not rebuilt. **One-pass §9 resolution is the right default; the walk is
   the correction mechanism, and using it is not a failure of the plan.**
5. **Verify-first keeps paying.** §10 proved `/portfolio/holdings` already served size, colour, honesty and
   the class filter — so **no new endpoint** was invented for a whole page. The only backend work was what
   the owner actually chose (the ND-8 region reshape, and later the §12hm1-1 display strings). It also
   surfaced the **D-083 spec-vs-code divergence** (`region_of` was still the legacy 3-bucket returning
   "Global") *before* it could be built on.
6. **Display casing/formatting belongs at the serialization boundary.** The D-105 posture (serve display
   strings) made the readout trivially honest: no client rounding, no client sign, no client currency
   math — and a `null` stays `null`, so "no Today's change" cannot become "0.00%".

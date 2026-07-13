# page-heatmap.md — Heatmap page build plan

**Status: PLAN ONLY — nothing built. STOP at §9 (owner resolves, one pass).** Drafted 2026-07-13 from
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

## 9. NEEDS DECISION — for the owner (one pass, before any build)

*Everything the specs under-specify. I resolved **none**. New ideas beyond v1 → ROADMAP, not invented here.*

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

**Owner sign-off surface (all in §9):** ND-1 (grouping — the headline shape choice), ND-3 (stale/unpriced
honesty), ND-7 (tooltip/click = §5 amendments?), ND-8 (region filter = §3b reshape?), plus
ND-2/4/5/6/9/10/11/12. **No build until the owner resolves §9.**

---

**Sign-off to start build:** §9 has no open blocker · §3b deltas (only if ND-1/ND-8 approve) are approved ·
no §5 amendment is required unless an ND-7/ND-3/ND-1 enhancement is chosen. **CURRENT.md correction (fold
at close):** its "Heatmap needs a treemap §5 amendment" line is **imprecise** — the treemap *render* is
already ratified; a §5 amendment arises **only** if an interactive/grouping enhancement (§9) is chosen.

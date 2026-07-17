# page-instrument-detail.md — Instrument Detail build plan

**Status: BUILT — Phases 0/1/2 DONE (2026-07-10); awaiting owner Phase-3 acceptance
walk.** Second instantiation of `TEMPLATE-page-build.md`; first **entity-detail**
variant.

**Build progress (2026-07-10):**
- **Phase 0 (contract deltas) DONE** — ND-1 holdings `?symbol=`, ND-3 `/refdata`
  `source_override`, ND-4 typed `GET /instruments/{symbol}`. Contract 127 paths,
  drift green; +2 backend tests. Commit `2eb656b`.
- **Phase 1 (assembly) DONE** — `/instrument/:symbol` route + `InstrumentDetail`
  page: scoped quote/provenance, identity/taxonomy, class-conditional provider
  panel, house-SVG price history (D-053), **position-if-held via the scoped reader
  (ND-1)**, ongoing-cost (D-029), scoped news (D-037), edit dialog (name/asset_class/
  source_override). The AI explainer is a **deferred note** (D-068 intact).
  **Self-verified live in Chromium** (AAPL: real quote, chart, position matching
  Holdings, real news) — the owner Phase-3 walk is the acceptance bar.
- **Phase 2 (tests) DONE** — 6 render tests incl. honest unpriced/not-held states
  and a **request-body assertion** on the edit PATCH; 59 frontend + 476 backend
  green.
- **Deferred (non-blocking, honest):** the edit form omits **country** — there is
  no `country` master in `/refdata` (only `region`); exposing it needs a country
  vocab (a `/refdata` follow-up). Recorded here, not silently dropped.

**ND resolutions (owner, 2026-07-10):**
- **ND-1 — position-if-held:** a **`symbol` filter param on the existing holdings
  reader** (`GET /portfolio/holdings?symbol=`) — P-3: a scoped view is a *filter of
  the canonical reader*, **no new endpoint**. Contract delta, same commit.
- **ND-2 + ND-5 — AI explainer DEFERRED to the AI-surfaces milestone.** The
  **Ask-panel** component is built there (serving chat + instrument explainer +
  report helper) with its own DESIGN-SYSTEM amendment + ratification. **This page
  ships without the explainer section.** D-068 stays intact — recorded as
  **explicitly pending**, not dropped.
- **ND-3 — approved:** add a `source_override` vocab to `/refdata`.
- **ND-4 — approved:** type `GET /instruments/{symbol}`, same-commit contract regen.

---

## 1. IDENTITY

| Field | Value | Spec ref |
|-------|-------|----------|
| Page name (H1 = symbol/name) | Instrument Detail | IA §2 |
| Route | `/instrument/:symbol` | IA §2 (IA line 93/360) |
| Nav group | none — reached by any symbol link (not a sidebar item) | IA §2 (line 93) |
| Page template | **Entity-detail** (header + identity/taxonomy + related panels + scoped readers) | DESIGN-SYSTEM §3 |
| Rotation eligibility | No (record-scoped, not a dashboard) | IA §3 |
| One-line purpose | A **scoped view (P-3)** of the quote / news / portfolio readers for one instrument; edit its taxonomy; set ongoing cost; explain it (P-6). **Canonical home for nothing.** | IA §360 (D-037, D-068) |

**Already links here (must not dead-end):** the Holdings row **Details** action and
the **D-097 cross-class** links both navigate to `#/instrument/:symbol` today — this
page is what makes them resolve.

---

## 2. OWNERSHIP TABLE

**This page OWNS nothing** — IA §360: "Not a canonical home for anything it shows."
Everything is a P-3 scoped view of a canonical reader, or an edit of the instrument
record. This is the defining constraint (P-1/P-3).

**Summarises (scoped views via the named reader, never recomputed):**

| Summary shown | Canonical page | Shared reader reused | Link target |
|---------------|----------------|----------------------|-------------|
| Quote + provenance + staleness | Markets | `display_quote` / market reader | Markets |
| Price history chart | Markets | `/instruments/{symbol}/history` reader | Markets |
| Scoped news | News | `/instruments/{symbol}/news` (D-037) | News |
| Position if held (qty / value / unrealised P/L) | Portfolio (Holdings) | `value_portfolio`, filtered to this instrument (P-3) | Holdings / Portfolio |
| Ongoing cost (expense ratio) | Portfolio ongoing-cost | ongoing-cost reader (D-029) | Ongoing cost |

**Owns (record edit, not a "figure"):** the instrument **record** edit
(asset_class / listing_country / name / source_override) and its ongoing-cost
setting — these are record mutations, not canonical figures.

**Links to:** Markets · News · Holdings/Portfolio · Pricing Health (provenance).

**Enforcement corollary (P-1/D-031):** every figure here is rendered by the
canonical reader and **carries a link** to its canonical page; this page adds **no
figure** its canonical page does not show. State this in the build.

---

## 3. API SURFACE

### 3a. Endpoints consumed (already in the frozen contract)

| Method + path | Purpose on this page | Response shape pinned? |
|---------------|----------------------|------------------------|
| `GET /instruments/{symbol}` | Identity, taxonomy, quote, provenance, mapped-provider detail | Partially — verify (§9) |
| `GET /instruments/{symbol}/history` | Price history → PriceChart | Verify shape |
| `GET /instruments/{symbol}/news` | Scoped news (D-037, P-3) | Verify shape |
| `PATCH /instruments/{symbol}` | Edit asset_class / country / name / source_override | Pinned (`InstrumentPatch`) |
| `PUT /instruments/{symbol}/ongoing-cost` | Set ongoing cost (D-029) | Pinned |
| `GET /portfolio/pricing-health` | Provenance/why-this-number for this symbol (filter) | Pinned |
| `POST /ai/facts` + `POST /ai/chat` (or `/briefing`) | "Explain this instrument" (P-6, D-068) — grounded + validated | Verify which powers the explainer |
| `POST /instruments/{symbol}/map-{amfi,coingecko,kite}` | Provider mapping (pricing correctness) | Pinned |

### 3b. Contract deltas (needed but not in the baseline — BUILD BACKEND-FIRST)

| kind | Endpoint (current → intended) | Decision | Why this page needs it |
|------|-------------------------------|----------|------------------------|
| *(candidate)* reshape/add | **Position-if-held for one instrument** — a scoped read (`GET /instruments/{symbol}/position` or a documented client-side filter of the holdings reader) | P-3 / D-023 | The "position if held" panel must reuse `value_portfolio`, never recompute (§9). Decide: scoped endpoint vs documented filter of the existing typed holdings response. |
| *(verify)* reshape | `GET /instruments/{symbol}` response typing | §9-6 hygiene | If untyped (`additionalProperties`), pin an explicit footprint like the Holdings reshape. |

*Each delta is built backend-first and regenerates `API-CONTRACT.json` +
`docs/openapi.json` in the same commit.*

---

## 4. COMPONENTS

| Ratified component | Role on this page | Data source (real / **mock**) | Prop/state not exercised at kitchen-sink |
|--------------------|-------------------|-------------------------------|------------------------------------------|
| PageHeader | Symbol + name + actions (Edit, Explain) | — | — |
| PriceChart | Price history (house-SVG, D-053) | `…/history` (real) | Long/empty/stale history |
| ProvenanceBadge | Source · freshness · confidence | `/instruments/{symbol}` (real) | Unavailable / low-confidence |
| StalenessChip | Stale flag + as-of (compact, §9-32) | `/instruments/{symbol}` (real) | — |
| DataTable | This instrument's transactions (if held); news list | portfolio/news readers (real) | — |
| MasterSelect | Edit: asset_class, listing_country, source_override | `/refdata` (real) | — |
| TextInput | Edit: display name | — | — |
| MoneyInput / PercentInput | Ongoing cost entry | — | — |
| Dialog | Edit-instrument + set-ongoing-cost editors | — | Popover-inside-dialog (verify §7) |
| EmptyState | Unpriced / no-history / not-held / no-news reasons | — | — |

**Data source rule (retrospective):** the **explainer (P-6)** and **news** must be
wired to the **real** grounded/validated pipeline and news reader — a mock here
would pass tests while fabricating (Product Guarantee 3). Flag any mock in §9.

**Component usage rules to honour:**
- **Row actions** (transactions-of-this-instrument table) → `RowMenu` (⋯); no wide
  action columns.
- **Popover overlay (DESIGN-SYSTEM §6)** — the edit dialog's `MasterSelect`/
  `DateInput` overlay within the viewport; verify open **inside the dialog**.
- **Context-scoped picker** — N/A (we are on an instrument); but `source_override`
  is a provider select bound to `/refdata`, not free text.

**Tables — dataset-size posture (D-094):** the "transactions of this instrument"
table is **bounded** (one instrument's own trades — tens of rows) → client-side
sort/filter, threshold-noted. The news list is bounded (reader-capped).

---

## 4b. PER-VARIANT FIELD & ACTION SPECS

The instrument has **no create-form variants** (it already exists), but its
**mapped-provider detail panel is class-conditional** (a display variant, from
`/instruments/{symbol}` `detail`):

| Class (variant) | Class-specific panel shown | Served by |
|-----------------|----------------------------|-----------|
| mutual_fund | AMFI: fund house, category, ISIN, official NAV + date | `/instruments/{symbol}` `detail.mutual_fund` |
| crypto | CoinGecko: canonical id, symbol, market cap | `detail.crypto` |
| derivative | F&O identity: expiry / strike / lot / segment | `detail.derivative` |
| equity / etf / other | Exchange · sector · country only (no extra panel) | base fields |

Edit form fields are the same for all classes (`InstrumentPatch`:
asset_class / country / name / source_override) — **served by `/refdata`**, never
hardcoded.

---

## 5. VOCABULARIES

| Field | Vocabulary / master | Fixed (/refdata) or extensible | MASTER-DATA ref |
|-------|---------------------|-------------------------------|-----------------|
| asset_class | `asset_class` | fixed (/refdata) | MASTER-DATA §2 |
| listing_country | country / region model | fixed | MASTER-DATA §4 |
| source_override | provider routing (market/amfi/coingecko/kite/auto) | fixed | MASTER-DATA (routing) — verify vocab (§9) |
| sector (display) | sector master | extensible | MASTER-DATA §6 |

Name is free text → **TextInput** (not categorical).

---

## 6. DECISIONS IN FORCE

| Decision | What it forbids / requires here |
|----------|---------------------------------|
| **P-3 / D-037** | This is a scoped view; quote/news are filters of canonical readers — never a second code path. |
| **P-1 / D-031** | Owns nothing; every figure links to its canonical page and adds nothing extra. |
| **D-068 / P-6** | The "explain this instrument" rides the single grounded+validated pipeline; **no direct model call**; ends with the info-only disclaimer; ephemeral (D-016). |
| **D-029** | "Ongoing cost (expense ratio)" naming (retires "Cost of ownership"). |
| **D-053** | Price history uses the house-SVG PriceChart (ECharts only via the treemap escape hatch — N/A here). |
| **D-072** | Provider mapping / source_override is visible + editable; priority-editing stays out. |
| **Guarantee 3** | Unpriced/stale/unavailable render "—" + reason; the explainer never fabricates a number. |
| **D-097 / §6 popover** | Edit-dialog selects overlay within the viewport (portal rule). |

---

## 7. ACCEPTANCE CRITERIA

- [ ] **Happy path:** a held, priced instrument shows quote+provenance, history chart, position, ongoing cost, news; all figures link to their canonical page.
- [ ] **Empty/honest states:** not-held → "Not in your portfolio" (reason); no history → reason; unpriced → "—" + reason; no news → reason; **explainer unavailable → visible fallback** (D-070), never fabricated.
- [ ] **Stale / low-confidence:** flagged via StalenessChip/ProvenanceBadge, never hidden.
- [ ] **Class-conditional panel** renders the right provider detail (mutual_fund NAV / crypto cap / derivative F&O) and nothing for plain equity.
- [ ] **Edit** (asset_class/country/name/source_override) + **set ongoing cost** persist via the pinned endpoints; categoricals from `/refdata`.
- [ ] **Both densities + both themes**; **interactive open states** (edit-dialog selects) checked in both themes.
- [ ] **No frontend money math**; terms match GLOSSARY; categoricals via /refdata.
- [ ] **Round-trip (D-095):** N/A (no export/import surface here).
- [ ] **Request-body assertion:** edit + ongoing-cost submits assert the actual request body.
- [ ] **Rendered layout verification (1366 & 1920, both themes):** header + chart + panels fit; the edit dialog's open selects overlay without dialog scroll (rendered, not unit-tested).
- [ ] **Context-scoped picker (D-097):** N/A (no instrument picker on this page).
- [ ] **P-3 proof:** quote/news/position come from the canonical readers (same code path), verified by matching the canonical page's numbers.

---

## 8. BUILD PHASES

- **Phase 0 — Contract deltas (§3b):** decide + build the position-if-held read and any response-typing; regenerate contract same commit; drift green.
- **Phase 1 — Page assembly:** entity-detail template; compose ratified components; wire real readers (quote/history/news/position/ongoing-cost/explainer); honest empty/stale/unavailable states.
- **Phase 2 — Tests:** render tests + acceptance criteria; request-body assertions; drift/typecheck/lint green.
- **Phase 3 — Owner acceptance walk (LIVE):** drive the real app — priced vs unpriced vs unavailable, held vs not-held, each class's panel, the explainer's fallback, the edit dialog's popovers, layout at 1366/1920 both themes (rendered/screenshot). Findings → numbered §9-* entries, fixed and re-verified live. **Done only after this walk.**

---

## 9. NEEDS DECISION *(surface to owner BEFORE build)*

| # | Item | Why it blocks / what's needed | Proposed resolution (for owner) |
|---|------|-------------------------------|---------------------------------|
| ND-1 | **Position-if-held read** (§3b) | Must reuse `value_portfolio` (P-3), never recompute. | Add a small scoped endpoint `GET /instruments/{symbol}/position` returning the canonical per-holding view, OR document a client-side filter of the typed holdings response. Recommend the scoped endpoint (keeps the frontend math-free). |
| ND-2 | **Which pipeline powers "explain this instrument"** | `/ai/facts` + `/ai/chat` vs `/briefing` — must ride P-6, show the fact-pack before the answer, be ephemeral. | Confirm the endpoint(s) + whether an **Ask panel** component exists/needs a DESIGN-SYSTEM amendment (mock-backed explainer is forbidden — Guarantee 3). |
| ND-3 | **`source_override` vocabulary** (§5) | Categorical must reference a master; is the provider-routing set in `/refdata`? | If absent, add a `source_routing` fixed vocab to `/refdata` (contract delta) or confirm the existing key. |
| ND-4 | **`GET /instruments/{symbol}` response typing** (§3b) | If untyped, pin a footprint (Holdings §9-6 hygiene). | Reshape to an explicit typed response before assembly. |
| ND-5 | **Ask-panel component** | If the explainer needs a streaming panel affordance the inventory lacks → DESIGN-SYSTEM amendment (new components forbidden without one). | Decide at kitchen-sink: reuse existing primitives vs amend. |

---

**Sign-off to start build:** ND-1..ND-5 resolved · §3b deltas approved · no §4
component needs an unresolved amendment · no affordance left mock-backed (§4).

---

## Phase-3 acceptance walk — findings batch 1 (owner, 2026-07-10)

Implemented + **verified rendered** (Chromium), committed in three batches.

- **§I-1 — D-098 symbol links (DONE).** The Holdings symbol is a direct link to
  `/instrument/{symbol}`; row-menu Details stays discoverable. Template rule added.
  DECISIONS.md D-098.
- **§I-2 — PriceChart amendment (PROPOSED, mini-ratify).** Simple/Advanced toggle
  (Simple = line, default here), hover crosshair + tooltip (date/close, OHLCV in
  Advanced), period selector (1D..Max) with **honest short-history** (`coverageNote`,
  e.g. "Only 4 days of history available" — never stretched), volume band in
  Advanced. Kitchen-sink specimen added; DESIGN-SYSTEM §5.2 amended (PROPOSED).
  **Verified live.**
- **§I-3 — Formatting (DONE).** (a) position figures right-aligned + tabular, text
  left. (b) **Item 3b served display labels** — `/refdata` serves `{value,label}`
  (authored once, D-005); `useLabelFor` applied everywhere raw enums leaked
  (Holdings class chips + txn-type, Instrument identity). Verified live.
- **§I-4 — Layout (DONE).** The AI/explainer deferred-note sits ABOVE News; News
  caps at ~5 items with internal scroll.
- **§I-5 — D-099 class-scoped ongoing cost (DONE).** Expense ratio is fund-only
  (mutual_fund/etf); equity pages show no field/card; PUT rejects a non-fund bps; a
  Review signal surfaces existing non-fund rows (never deleted). MASTER-DATA §11,
  DECISIONS.md D-099. Verified live.

Owner continues the walk after this batch.

## Phase-3 acceptance walk — findings batch 2 (owner, 2026-07-10) — platform-wide, PROPOSED

Token/component-layer polish; **verified rendered** at light/dark/high-contrast.

- **§I-6 — D-100 card/section border primitive (PROPOSED).** `.lf-card`
  (structure.css) — soft `--border` on `--surface-raised`; applied to Instrument
  Detail sections (6 cards) + the Holdings Net-worth summary; DataTable/Dialog keep
  their own surfaces. Kitchen-sink specimen. Verified: correct border/surface tokens
  in all three modes (high-contrast → stronger `--border`).
- **§I-7 — D-101 themed scrollbars (PROPOSED).** Global themed scrollbars
  (`index.css`, standards + WebKit, token-coloured; both themes + high-contrast).
  The Holdings table-scrollbar-overlaps-border defect fixed via
  `scrollbar-gutter: stable` + an inset thumb — verified: the table's right border
  is clean. Kitchen-sink scrollable-panel specimen. (Scrollbar thumb not visible in
  headless element screenshots — overlay-scrollbar rendering; owner ratifies live.)

Both are **PROPOSED pending the owner's visual ratify** at the next look.

## Phase-3 acceptance walk — cross-ratify (owner, 2026-07-11)

- **PriceChart amendment — RATIFIED** as implemented (toggle/hover/periods + honest
  short-history verified live).
- **D-100 RATIFIED w/ amendment — LAYERED cards.** The Holdings summary-card
  treatment is the standard: a section with a headline nests its content in a
  `.lf-card__body` panel (`--surface` + border) for depth, not a flat fill. Applied
  to Instrument Detail's six sections (6 cards → 6 nested bodies, verified). Kitchen
  sink specimen updated. **Verified rendered** both themes.
- **D-101 RATIFIED w/ amendment — header-outside-scroll.** The News-block pattern is
  the standard. `DataTable` moves the toolbar OUTSIDE an inner `.lf-table__scroll`;
  only the table scrolls (sticky column header), `.lf-table-wrap` keeps the border
  (`overflow: hidden`). **Verified rendered** (Holdings: `toolbarOutsideScroll: true`,
  the filter bar sits outside the scroll on both themes). Kitchen sink specimen
  updated. Both are the platform-wide primitives.

**Cross-ratify refinements (owner, 2026-07-11) — verified rendered both themes:**
- **D-100 companion rule** — a card's canonical-home cross-link lives in the card
  HEADER, top-right (the News pattern). Moved Quote → "Markets ↗" and Position →
  "Holdings ↗" into their headers (`.ins__cardhead`, title-left/link-right); News
  already followed it. Recorded in DESIGN-SYSTEM card usage rules.
- **D-101 refinement (scrollbar vs column header)** — the **visual middle path
  worked, no structural split**: the sticky column-header owns the reserved gutter
  (last `th` paints the header fill + bottom border across it via `box-shadow`), so
  the scroll track reads as starting BELOW the header. Verified in cropped
  table-edge screenshots (both themes): the header block + bottom rule span to the
  right border; the scroll region begins below it. (The two-table split was NOT
  needed.)

---

## DELTA NOTE — 2026-07-16 (page-insurance walk batch 2, §14in-6)

- **CSS prefix renamed `.ins` → `.idp`** to end a namespace collision with the Insurance page (both used
  `.ins`; Instrument Detail's root rule was bleeding a `max-width`/centering onto Insurance, and the two
  pages were cross-contaminating `.ins__cardhead / __section / __field`). Pure rename — restores this page
  to its own rules; InstrumentDetail.test.tsx (7) green.
- **Removed `.idp { max-width: 70rem; margin: 0 auto }`** to conform to the new DESIGN-SYSTEM §3.1 "Page
  inset" standard (shell owns the inset; no page-local cap/centering). **Visible change:** the page now
  renders full-width like Net worth/Portfolio (was a centred ~1120px column) — flagged for owner
  confirmation at the re-walk. Overflow suite covers `/instrument/AAPL` at all breakpoints + the 1728 inset guard; green.

---

## DELTA NOTE — 2026-07-18 (R-38 data-feed-routing Phase 3b re-walk, §14dr-4)

- **Advanced candlestick chart: malformed candles fixed (rendered as crosses).**
  Verify-first, the served OHLC is correct (backend `markets.py` → alphavantage
  `get_history`; the `Candle → PricePoint` mapping is a straight passthrough) — the
  defect is **rendering geometry** in the shared `PriceChart` component. Two
  compounding causes at real daily density:
  - **The body outline ballooned into a "+".** The candle body `<rect>` inherited a
    `stroke` with **no `vector-effect: non-scaling-stroke`** (unlike every sibling
    series), so the SVG default 1-user-unit stroke was scaled non-uniformly by the
    plot's `preserveAspectRatio="none"` into a fat cross around a thin fill. **Fix:**
    candle bodies render **fill-only** (`stroke: none`); the wick keeps a **crisp
    non-scaling stroke** — parity with `__line/__axis/__overlay/__bench/__cmp`.
  - **The body width collapsed with density.** `bw = slot*0.5` gave ~0.39 viewBox
    units at the 6M/~124-bar default (thinner than the wick). **Fix:** band-based
    width with a readable floor and a no-overlap clamp:
    `min(slot, max(slot*0.7, 0.6))`.
  - **Fix-at-standard sweep:** the fix is at the component, so **every candle
    consumer** inherits it — Instrument Detail (Advanced) and the kitchen-sink candle
    specimens; Portfolio / Net worth use `mode="line"` (unaffected). A **dense
    real-shaped fixture** (`DENSE_CANDLE_SERIES`, ~130 daily bars) + kitchen-sink
    specimen back a **fail-first unit geometry test** (RED on the collapsed width;
    asserts body between open/close, wick to high/low, no overlap) **and an e2e
    box-geometry test** (RED on the cross bloom — bodies must read as non-overlapping
    rectangles). Instrument Detail pre-pass re-run stated in the report.

## DELTA NOTE — 2026-07-18 (R-38 data-feed-routing Phase 3b re-walk, §14dr-5)

- **Zoom on the Advanced chart (owner-ruled enhancement, minimal).** The shared
  `PriceChart` gains **wheel + pinch zoom about the cursor**, **Advanced view only**,
  with a **ratified `Button` ("Reset zoom", §5.4)** shown only while zoomed. The zoom
  is a `[lo,hi]` window over the series in index space (native non-passive
  listeners → `preventDefault` stops page-scroll while zooming; the y-scale + overlays
  recompute to the visible data). **Non-persistent** — a new `series` (period change /
  unmount) clears it; **no served field, no contract change**. A legend hint ("Scroll
  or pinch to zoom · showing N of M") appears only in Advanced (honest metadata — the
  control exists there). Coverage: a unit test (wheel narrows the window, Reset
  restores; Simple view ignores the wheel) + an e2e interaction test (zoom + Reset +
  no horizontal overflow). Nothing beyond this scope.

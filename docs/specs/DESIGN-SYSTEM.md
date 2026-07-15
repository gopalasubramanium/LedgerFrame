# DESIGN-SYSTEM.md — LedgerFrame v2

**Normative.** Operationalises `DESIGN-BRIEF.md` into design principles, tokens,
page templates, and the component library. CLAUDE.md hard rule (restated in §6):
**every user input uses a component from `src/components/ui/`; raw `<input>`,
`<select>`, or ad-hoc styling is forbidden — pages compose components, pages
never style primitives.** Terms match GLOSSARY.md; page assignments match
INFORMATION-ARCHITECTURE.md.

**Ratification.** For this file the token *values* (hex palette, spacing scale,
type weights/line-heights, font choices) are **authored proposals**, not
extractions. Values taken verbatim from the brief (e.g. the 12/13/14/16/20/28
type scale) are marked **BRIEF** and are not open for re-proposal.

> **RATIFIED 2026-07-10 (kitchen-sink review).** The component library was built
> and reviewed visually at `/kitchen-sink`; the owner ratified §2 **with three
> amendments** (below). Every value previously marked *PROPOSED* in §2 is now
> **ratified as of 2026-07-10** and the PROPOSED markers are superseded. The
> three amended values carry **ratified (amended at kitchen-sink review)
> 2026-07-10**:
>
> 1. **Accent** — cobalt → deeper slate-tinged navy (§2.1).
> 2. **Gain, light theme only** — desaturated ~15% to remove neon bleed on light
>    backgrounds; dark unchanged (§2.1).
> 3. **Treemap fill intensity** — a continuous magnitude scale via the token
>    layer (`--treemap-base` + a data-driven intensity), replacing flat
>    full-saturation fills (§2.1 / §4).
>
> Also ratified as implemented: the 5-tone categorical segment palette (§4) and
> the generic `ui/Select` primitive (§5). Full record: `docs/plans/RATIFICATION.md`.

---

## 1. Design principles

The visual language targets **institutional wealth platforms** (Addepar,
private-bank client portals) — not a startup dashboard, not default shadcn.

1. **Numbers are the interface.** Tabular (monospaced-figure) numerals
   everywhere, **right-aligned**, with **consistent decimal places per unit
   type** (money 2dp, price 6dp, percent 2dp, quantity per-instrument
   precision). **Quote-price display precision is by asset class, formatted in
   the BACKEND (D-105, ratified 2026-07-13):** equities / ETFs / funds / indices
   → 2dp; crypto → up to 6 significant digits (so sub-cent tokens aren't
   truncated to `0.00`); served as a display string (`price_display`) the
   frontend renders **verbatim** — no client formatting of quote prices; stored
   native precision unchanged. Thin table rules; generous row-density options
   (comfortable/compact, §2.5). Money math is never done in the frontend
   (backend `Decimal` only — PRODUCT-SPEC §4b); components render figures the
   backend computed.
2. **Colour is semantic only.** A near-monochrome **slate** base; **one
   accent**; **green/red reserved strictly for gain/loss**; **amber strictly
   for staleness/attention**. Never decorative colour. Colour is never the sole
   signal (§7).
3. **Hierarchy through typography, not boxes.** **Max two font families** (a
   quality grotesque for UI with tabular figures; an optional serif for report
   headers). Type scale **12/13/14/16/20/28** (BRIEF). Minimal borders and
   shadows.
4. **Provenance is a first-class UI element.** One standardized
   **ProvenanceBadge** renders **source · freshness · confidence** identically
   on every number that has them (§5). This is the UI expression of the
   three-layer freshness structure (GLOSSARY: Entitlement / Stale / Status) and
   the Source/Provider/Routing split.

---

## 2. Design tokens

Tokens are semantic (name = meaning); each theme supplies the value. Consume via
CSS custom properties; never hard-code a raw hex in a component.

### 2.1 Colour — light & dark (ratified 2026-07-10)

Near-monochrome slate ramp + one accent + strict semantic gain/loss/attention.
`system` theme resolves to light or dark via `prefers-color-scheme`; an explicit
theme cycle (light→dark→system) overrides (D-066). Contrast pairings must pass
WCAG AA at ratification (§7).

| Semantic token | Light | Dark | Use |
|----------------|-------|------|-----|
| `--bg` | `#f8fafc` | `#020617` | App background |
| `--surface` | `#ffffff` | `#0f172a` | Cards, tables, panels |
| `--surface-raised` | `#f1f5f9` | `#1e293b` | Header rows, popovers, raised chrome |
| `--border` | `#e2e8f0` | `#1e293b` | Thin table rules, dividers, input borders |
| `--border-strong` | `#cbd5e1` | `#334155` | Focus rings' track, emphasized dividers |
| `--text-primary` | `#0f172a` | `#f1f5f9` | Figures, headings, body |
| `--text-secondary` | `#475569` | `#94a3b8` | Labels, captions, secondary cells |
| `--text-tertiary` | `#94a3b8` | `#64748b` | Placeholder, disabled, footnotes |
| `--accent` | `#24476f` | `#6f9fd4` | Interactive/selected state, links, primary action. **Ratified (amended) 2026-07-10** — cobalt→slate-navy, HSL(212,51%,29%)/(211,54%,63%); AA 9.5:1 (light) / 6.45:1 (dark) |
| `--accent-contrast` | `#ffffff` | `#0f172a` | Text/icon on an accent fill |
| `--gain` | `#1e763e` | `#4ade80` | Positive change **only**. **Ratified (amended) 2026-07-10** — light desaturated ~15% (HSL 142,72→59%,29%), AA 5.65:1; dark unchanged |
| `--loss` | `#b91c1c` | `#f87171` | Negative change **only** |
| `--attention` | `#b45309` | `#fbbf24` | Staleness / attention **only** (amber) |
| `--focus-ring` | `#24476f` | `#6f9fd4` | Keyboard focus outline (tracks `--accent`) |
| `--treemap-base` | `#f1f5f9` | `#1e293b` | **Ratified (amended) 2026-07-10** — neutral mix endpoint for the treemap magnitude scale (§4) |

Rules: `--gain`/`--loss` appear only on gain/loss figures and their glyphs;
`--attention` only on StalenessChip / attention markers; `--accent` is used
sparingly (selection, primary action, links) — it is not a brand wash.

**Treemap magnitude scale (ratified amended 2026-07-10).** Heatmap tiles encode
day-move **magnitude** as fill intensity: the tile's `--gain`/`--loss` is blended
toward `--treemap-base` by a data-driven ratio (`color-mix`) — a soft muted tint
near 0% reaching full intensity at **≥5%** (floor 15%, cap 5%). Direction stays
semantic (gain green / loss red); intensity is the only added encoding, and all
colour still lives in the token layer (the component supplies only the ratio).

### 2.2 Typography

| Aspect | Value | Status |
|--------|-------|--------|
| Type scale (px) | **12 / 13 / 14 / 16 / 20 / 28** | BRIEF |
| UI family | Quality grotesque with tabular figures — **proposed:** Inter (self-hosted) with fallback `system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif` | ratified 2026-07-10 |
| Report-header family (optional) | A serif for report headers — **proposed:** Source Serif 4 (self-hosted) with fallback `Georgia, "Times New Roman", serif` | ratified 2026-07-10 |
| Weights | 400 regular · 500 medium · 600 semibold | ratified 2026-07-10 |
| Numerals | **tabular** (`font-feature-settings: "tnum" 1;`) on every figure | BRIEF |

Type-scale roles (ratified 2026-07-10):

| Size | Role | Line-height | Weight |
|------|------|-------------|--------|
| 28 | Page H1 / hero figure (TrendStat headline) | 34 | 600 |
| 20 | Section heading | 28 | 600 |
| 16 | Subhead / emphasized figure | 24 | 500 |
| 14 | Body / default cell | 20 | 400 |
| 13 | Secondary cell / dense table | 18 | 400 |
| 12 | Caption / badge / footnote | 16 | 500 |

Adding a **self-hosted webfont is a bundle change**; if it introduces a package
dependency it needs an ADR (CLAUDE.md). The fallback stacks above keep the
system shippable without one.

### 2.3 Spacing scale — 4px grid (ratified 2026-07-10)

| Token | px |
|-------|----|
| `--space-0` | 0 |
| `--space-1` | 2 |
| `--space-2` | 4 |
| `--space-3` | 8 |
| `--space-4` | 12 |
| `--space-5` | 16 |
| `--space-6` | 20 |
| `--space-7` | 24 |
| `--space-8` | 32 |
| `--space-9` | 40 |
| `--space-10` | 48 |
| `--space-12` | 64 |

### 2.4 Radius, border, elevation (ratified 2026-07-10)

Minimal borders and shadows (principle 3). `--radius-sm` 4px · `--radius-md` 6px
· `--radius-lg` 10px. Borders are 1px `--border` (thin rules). Elevation is
restrained: `--shadow-1` a single soft shadow for popovers/menus only; cards use
a border, not a shadow.

**D-100 — card/section primitive (ratified w/ amendment 2026-07-11, LAYERED
standard).** `.lf-card` (`components/ui/structure.css`) = a soft `--border` on
`--surface-raised`. **Amendment:** a section with a headline block nests its content
in `.lf-card__body` — an inner panel on `--surface` with its own border — giving
**depth (layered), not a single flat fill** (the Holdings net-worth card family is
the standard). Both themes + high-contrast follow automatically. Instrument Detail's
six sections adopt it; kitchen-sink specimen shows the layered card. **Companion
rule (2026-07-11): a card's canonical-home cross-link lives in the card HEADER,
top-right** (title left, link right — the News pattern), for every
summary-with-link card (Quote → Markets, Position → Holdings, News → News); never in
the body.

**D-101 — themed scrollbars + header-outside-scroll (ratified w/ amendment
2026-07-11).** All scrollbars are styled in `index.css` via standards
`scrollbar-width: thin` + `scrollbar-color` and the WebKit equivalents, using tokens
(`--scrollbar-size`, `--scrollbar-thumb` = `--border-strong`, hover =
`--text-tertiary`; track transparent) — following both themes + high-contrast; the
WebKit thumb is **inset** (transparent border + content-box clip). **Amendment
(the News-block pattern is the standard):** a scroll region is the CONTENT area only,
below the section/card header — the header stays OUTSIDE the scroll container. In
`DataTable` the **toolbar (filter/actions) sits outside** an inner `.lf-table__scroll`
(the only scrolling element; `scrollbar-gutter: stable`, sticky column header);
`.lf-table-wrap` keeps the border + rounded corners (`overflow: hidden`) so the thumb
never overlaps the border. Kitchen-sink scrollable-panel specimen shows
header-outside-scroll. **Refinement (2026-07-11): the sticky column header owns its
full width including the reserved gutter** — the last header cell paints the header
fill + bottom border across the gutter zone (a `box-shadow`, no structural split), so
the scrollbar track reads as starting BELOW the column header, not beside it.
**Single vertical scroll region (ratified 2026-07-13, page-markets §12mk1-1):** the
shell content (`.lf-shell__content`) is the **one** vertical scroller — the
document/window itself **must never scroll** (a second scrollbar beside the content).
The shell is `height:100vh; overflow:hidden` with the flex column allowed to shrink
(`min-height:0`) AND **`contain: layout` on `.lf-shell__content`**, which stops a tall
descendant from propagating overflow up to `documentElement` (a Chromium quirk). A
page whose primary tables are overview content lets them **flow** (no `--table-max-h`
cap) rather than open a nested scrollbar beside the page scroll. Guarded by a permanent
ALL-PAGES Playwright assertion (the window can't scroll; spacer-forced, fail-first).

### 2.5 Density modes (D-045 / D-078)

Two modes: **comfortable** (default) and **compact**. Density is a **per-device**
property (localStorage), set in **Settings → Appearance** (D-045/D-078) — it is
not server-persisted and not part of rotation config. Density scales row height
and cell padding (primarily in DataTable) and the wall-kiosk reading distance.

| Density | Table row height | Cell padding (Y) | Status |
|---------|------------------|------------------|--------|
| comfortable | 44px | `--space-4` (16) | ratified 2026-07-10 |
| compact | 28px | `--space-2` (8) | amended 2026-07-10 (one step denser; page-holdings §9-30) |

### 2.6 Ratification checklist — COMPLETE (2026-07-10)

**Ratified at the kitchen-sink review** (component library built + reviewed
visually at `/kitchen-sink`): §2.1 palette (both themes), §2.2 font choices +
weights + line-heights, §2.3 spacing, §2.4 radius/border/elevation, §2.5 density
metrics — all ratified, with the three amendments recorded at the top of §2 and
in `docs/plans/RATIFICATION.md`. Font families are ratified as the **fallback
stacks** shipping today; self-hosting Inter / Source Serif 4 remains a future ADR
(§2.2). BRIEF-tagged values (type-scale sizes, tabular figures, the
semantic-colour rules) were fixed and out of scope for re-proposal.

---

## 3. Page templates

Four templates; **every page uses exactly one** (brief). The Reports Pack is the
one exception — it is a print artifact (D-038), not a template page.

| Template | Shape | Used by |
|----------|-------|---------|
| **Overview** | Composed dashboard of stat tiles, charts, and summary widgets (owned figures + linked summaries). | Home, Net worth, Portfolio, Markets, Heatmap, News, Scenarios, Reports |
| **Entity-detail** | Focused single-record view: header + identity/taxonomy + related panels + scoped readers. | Instrument Detail |
| **Worklist** | Primary DataTable(s) + row actions + CRUD editor, for records you manage or work through. | Holdings, Accounts, Review, Policy, Cash flow, Insurance, Estate, Pricing Health |
| **Settings** | Sectioned/tabbed configuration or content pages in the System group. | Settings, Help, Legal |

Notes:
- **Home** (Overview) has **ONE layout** — the ratified grid (D-046 AMENDMENT, page-home
  §12ho1-5/§12ho1-6). *(It branched on Simple/Full until the Simple layout was removed.)*
- **Reports Pack** (`/reports/pack`) uses a dedicated **print layout**, not one of
  the four — it is the sanctioned artifact (D-038/D-061).
- Every template opens with **PageHeader** (§5) and routes empty regions through
  **EmptyState** (§5).
- **Worklist row actions (standard affordance, added 2026-07-10).** Every
  worklist DataTable row carries its per-row actions (details / edit / delete,
  and any row-scoped action like tags) in a compact **`RowMenu`** (⋯) overflow
  menu (§5.4), wired to the existing edit + soft-delete behaviours. This keeps
  data-dense tables narrow so they **degrade gracefully at laptop widths** (a
  single icon column instead of wide text buttons); long text columns truncate
  (DataTable `truncate`) rather than forcing horizontal scroll. Interactive
  open states (the ⋯ menu) are verified manually in both themes (§7).

### 3.1 Page inset — ONE standard, shell-owned (RATIFIED 2026-07-16, page-insurance §14in-6)

**Every page renders at the SAME content inset from the chrome, on all four sides.** The inset is a single
tokenized value **owned by the shell** — `.lf-shell__content` sets `padding: var(--space-7) var(--space-6)
var(--space-12)` (top / horizontal / bottom) and **every in-shell page inherits it by sitting inside that
box**. Net worth and Portfolio are the reference: their `.lf-page` root fills the shell content box with no
further inset.

- **A page MUST NOT add a root `max-width`, a centering `margin`, or its own root `padding`.** A capped,
  centered root (`max-width` + `margin: 0 auto`) reads as a **larger inset than every full-width page at
  wide viewports** — invisible at ≤1366 (the cap doesn't bite) and plainly visible at 1600+. This is what
  drifted: Holdings capped itself at `72rem` and Insurance inherited `70rem` **through a CSS class
  collision** (two pages both used the `.ins` prefix), so both centered ~250px in from each edge at 1920
  while the rest ran full-width.
- **Guarded (pixels, at the width where it appears):** `e2e/overflow.spec.ts` — *"every page fills the
  shell content box"* measures each built route's `.lf-page` box against the shell content box **at 1728px**
  and asserts left+right inset ≈ 0. It runs WIDE deliberately: a guard that measures at 1366 (where no
  cap bites) is green over the real defect — the §14in-1 lesson (*a guard must measure the geometry the
  finding names, not an adjacent property at a width where the bug can't appear*).
- **A page may still cap an inner content MEASURE** (a reading column inside a card, a dialog form width)
  — that is component-local, not the page root. The rule is only about the **page root inset**.

---

## 4. Chart layer policy

- **House SVG only.** All charts are house SVG components (the `Donut`,
  `Sparkline`, `LineSeries` layer, extended with `Treemap` and `PriceChart`).
  **No charting dependency ships without an ADR.**
- **Heatmap treemap (D-053).** Rebuild the treemap on the house SVG chart layer
  using a **squarified** algorithm, **dropping ECharts**. **Escape hatch:** if
  parity isn't reached within the plan-file scope, fall back to ECharts with an
  **ADR documenting the single-dependency exception** (D-053). This is the only
  sanctioned path back to a charting dependency.
- Charts use the semantic palette (§2.1): gain/loss green/red only where a value
  is a gain/loss.
- **Categorical identity palette (AMENDMENT — RATIFIED 2026-07-11, page-portfolio §12-6).**
  Segment/category identity is a **distinct axis** from semantic colour: a tokenized
  **`--cat-1..8`** set — a fixed-order 8-hue palette (blue · aqua · yellow · green · violet ·
  red · magenta · orange), **assigned in order, never cycled beyond the set** (a 9th identity
  folds into "Other" — follow-up). **Colour-blind-aware and validated** with the dataviz
  validator: light worst-adjacent CVD ΔE 24.2; dark = the same hues stepped for the dark surface
  (ΔE 10.3, floor band — legal because identity is carried **with the always-present legend
  labels** + segment relief). Defined for **light + dark**; **high-contrast inherits** the set
  (the contrast-boosted legend provides relief). **Semantic gain/loss/attention stay reserved for
  meaning** and are never reused as a category hue. Applied to all AllocationDonut segments;
  specimen (palette board + donut, ratify across all three modes) at `/kitchen-sink`. Supersedes
  the retired 5-tone slate-ramp segment palette.

---

## 5. Component library

Built **before any page** (brief). Every component lives in
`src/components/ui/`. Props below are the surface; **usage rules are normative**.
Categorical props resolve through MASTER-DATA.md (never inline lists); monetary
props are backend-computed `Decimal` strings (never client-computed).

> **AMENDMENT 2026-07-10 (Holdings page-build) — RATIFIED 2026-07-10.** Four
> components are added — a **FileInput** (§5.1), **Dialog** + **ConfirmDialog**
> (§5.4), and a **Toast/Snackbar** (§5.5) — resolving `page-holdings.md` §9-2..5.
> Built token-compliant (drift check green), demonstrated at `/kitchen-sink`, and
> **ratified at the owner's look** (both themes; light-theme scrim opacity and
> nested-drawer isolation confirmed; reduced-motion toast behaviour confirmed).
> A `--scrim` backdrop token was added to §2.1. No other component changed.

### 5.1 Inputs (the only sanctioned way to accept user input)

| Component | Props (surface) | Usage rules |
|-----------|-----------------|-------------|
| **MoneyInput** | `value` (Decimal string), `currency` (from currency master), `onChange`, `min?`, `max?`, `disabled?`, `aria-label` | Currency-aware; the **only** control for money entry. No raw number input for money; **no client-side money math**; currency options from the currency master (MASTER-DATA §3). Renders/edits with 2dp, tabular. |
| **QuantityInput** | `value`, `onChange`, `precision?` (per-instrument), `step?`, `disabled?` | Share/unit quantities; high precision; tabular, right-aligned. |
| **PercentInput** | `value`, `onChange`, `min?`, `max?`, `disabled?` | Targets, bands, thresholds (e.g. `long_term_days` is a number input, not this). 2dp; shows `%`. |
| **DateInput** | `value` (ISO `yyyy-mm-dd`), `onChange`, `min?`, `max?` | Replaces every inline `type="date"`; stores ISO. |
| **TextInput** *(amended — PROPOSED)* | `value`, `onChange`, `placeholder?`, `disabled?`, `maxLength?`, `onEnter?`, `aria-label` | Plain **free-text** entry for name-like fields that are NOT money/date/quantity/**categorical** (e.g. manual-asset label, tag entry). Wraps the native input (§6). **NOT** for categorical data — use MasterSelect. **Amended 2026-07-10 (Holdings page-build §9-8) — PROPOSED, ratify at the Holdings look.** |
| **InstrumentPicker** (D-012) | `value` (instrument id), `onSelect`, `allowCreate`, `scope?` | Typeahead over existing instruments + provider search; **explicit "create new instrument"** path (no silent auto-create); selecting sets currency/asset_class from the instrument. Used for symbol entry and the merger "Absorbed into" field (D-019). |
| **MasterSelect** | `master` (vocabulary/master id), `value`, `onChange`, `onCommit?`, `allowCreate?` (extensible masters only) | **The** select for every categorical field. Fixed vocabularies from `/refdata`; extensible masters from their endpoints (MASTER-DATA §1). **Never** an inline option list. `allowCreate` only where the master is user-extensible (institution, sector, tag). **`onCommit` (opt-in, 2026-07-11 first-run F3):** commit-on-pick mode — fires on **every** selection, including re-picking the value already shown (a native `<select>` emits no `change` for a same-value pick), so a pre-filled suggestion can be confirmed by choosing it. Renders via the internal `CommitMenu` (button + portaled listbox); native path unchanged when absent. |
| **FileInput** *(amended)* | `onChange` (FileList), `accept?`, `multiple?`, `disabled?`, `aria-label`, `label?` | The sanctioned file control (CSV import); wraps the native input internally (§6 — no raw `<input type="file">`). Click-to-browse + drag-and-drop; shows the chosen filename. **Amended 2026-07-10 (Holdings page-build §9-3).** |
| **Select** | `value`, `onChange`, `options`, `disabled?`, `onCommit?`, `aria-label` | Generic select for **non-master view-scope / user-record** choices (e.g. QuoteCardRow source, the account picker over `/accounts`). Categorical **data** fields use MasterSelect instead. **`onCommit`** = the same commit-on-pick mode as MasterSelect (first-run F3). *(Ratified 2026-07-10; `onCommit` added 2026-07-11.)* |

**INPUT FOCUS IS ONE TREATMENT (§5.1 AMENDMENT — RATIFIED 2026-07-15, page-policy §12po1-10; platform-wide).**
Every field wrapper (`.lf-field` — MoneyInput, PercentInput, QuantityInput, TextInput, DateInput, Select,
MasterSelect, and any input inside a Dialog) carries **ONE `focus-visible` ring on the WRAPPER**; the inner
control **suppresses its own**. Before this, a focused text input showed the global `:focus-visible` ring on
the `<input>` **and** a recoloured border on the wrapper — a **doubled, uneven** treatment that differed from
`Select` (which had already been fixed this way, §12ho2-11). This amendment makes `Select`'s behaviour the
rule for all of them. A **`.lf-field--error`** state is added for the field a served validation message points
at (colour is never the only signal — the message is always rendered too).
**A11Y, NON-NEGOTIABLE: this UNIFIES the ring; it never removes it.** A keyboard user must always see exactly
where they are — the ring is only ever moved to the wrapper, never dropped. Specimens at `/kitchen-sink`:
rest · focus · error · disabled, in both themes.

**CONTAINMENT IS THE COMPONENT'S JOB (RATIFIED 2026-07-15, page-policy §12po2-1 / §13-3).** **A component
whose height is a function of its DATA will eventually break every placement it has.** `ReviewCard` rendered
every section it was handed: 17 attention items grew it to **1243px**, broke the Net worth row and displaced
the **Portfolio** card beside it. Fixing the page that happened to get caught would have left the defect
**armed at every other placement**. So a data-driven list **caps and scrolls internally at the COMPONENT**
(the `--table-max-h` posture), and offers a **`maxItems`** cap with an honest **"+N more ↗"** to its canonical
page — **never silent truncation** (Home had been silently dropping items). The **full list lives only on the
canonical page** (P-1).

**THE DIALOG BODY IS *THE* SCROLL CONTAINER (RATIFIED 2026-07-15, page-policy §12po2-3 / §13-4).** A table
with its **own** scroll region nested inside a `Dialog` that already scrolls gives **two scroll regions
fighting**: rows slide half-under the sticky header and read exactly like a **duplicated header** overlapping
the content. **One scroll region, one sticky header block, one grid template** — so columns align across rows
**by construction**. *Sub-rule:* sticky offsets are measured from the scroll container's **content edge**, so
`top: 0` pins a header one **padding-length down**, leaving a gutter for content to scroll through **above**
it — cancel the padding explicitly.

**ICON + LABEL BUTTONS (page-policy §12po3-1).** An in-button icon is sized by **`--icon-size`** (`.lf-btn svg`
— it is **already global**; a per-call-site `size` prop is a lie about what controls it) and sits on a
**centred inline-flex row with a token gap**, so it lands on the label's optical centre instead of
baseline-aligning against it. **The text label is always kept — an icon is never a label on its own.**
⚠ **2nd occurrence** (Review's *Mark reviewed* · Policy's *Edit policy*), each with a page-local flex row.
**The 3rd occurrence EXTRACTS the shared treatment** (the `Segmented` / `StatusChip` centralization rule).

**`Button` — THE button, and THE icon+label treatment (§5.4 AMENDMENT — RATIFIED 2026-07-15, page-cash-flow
§9-13).** Props: `children` (the **mandatory** text label — an icon is never a label on its own), `icon?`
(lucide; sized by `--icon-size`, which `.lf-btn svg` already applies globally — a per-call `size` prop is a
lie about what controls it), `variant?` (`default`|`primary`). **Extracted at the THIRD occurrence** (Review's
*Mark reviewed* · Policy's *Set/Edit policy* · Cash flow's *Add …*), per the trigger page-policy §12po3-1
recorded. **Both page-local copies (`.rv__markbtn`/`.rv__markicon`, `.pol__btn`) are MIGRATED onto it and
DELETED.** A centred inline-flex row with a token gap, so the icon lands on the label's **optical centre**
instead of baseline-aligning against it.

**THE TABLE HEADER PAINTS EDGE-TO-EDGE (RATIFIED 2026-07-15, page-cash-flow §12cf1-1).** `scrollbar-gutter:
stable` reserves a strip the `<table>` cannot cover, so the header fill stopped short of the right border and
the card showed through the top-right corner — **filled on the left, empty on the right**. The header band is
therefore painted by the **scroll CONTAINER's own background** (two token layers: the fill + the header's
bottom border), which *does* cover the gutter, anchored to the top of the scrollport so it stays under the
sticky header while rows scroll beneath it. ⚠ **The previous fix — a `box-shadow` on `.lf-table__th:last-child`
— CANNOT WORK and is deleted:** that shadow is painted into the scrollbar gutter of the very container that
**clips** it. *Computed styles said the shadow was there; the rendered pixels said otherwise — which is why the
guard asserts **pixels** (`e2e/table-header-fill.spec.ts`), not styles.* **Pixel guards sample clear of the rounded corner (antialiasing bleeds otherwise) and require five consecutive clean runs before trust; and — being a COMPONENT guard — this one runs against the backend-free `/kitchen-sink` specimen, not a product page (page-cash-flow §13b/§13c).**

**CARD FOOTNOTE (RATIFIED 2026-07-15, page-cash-flow §12cf1-4).** A legend/disclaimer line under a card's
content uses **`.lf-card__footnote`** — a **token** inset at the component level, never a per-page nudge.
Without it the line sat **flush against the table's border** (zero gap) and read as part of the table's frame
rather than a note about it.

### 5.2 Data display

| Component | Props (surface) | Usage rules |
|-----------|-----------------|-------------|
| **DataTable** | `columns` (`{key,label,align,format,sortable}`), `rows`, `sort`, `onSort`, `filter?`, `onExport?` (server-side), `stickyHeader`, `density`, `rowLink?`, **`footer?`** (`FooterRow[]`: `{key, cells: {byColumnKey}, emphasis?}`) | **One implementation** for every table (Holdings, transactions, tax lots, drift, policy targets, insurance, estate, pricing health, accounts). Sticky header; `aria-sort` on sortable headers; numbers right-aligned + tabular + per-unit dp; **export is server-side** (P-5) — the client never generates the file. Respects density (§2.5). **`<tfoot>` totals primitive (RATIFIED 2026-07-12, Net worth §12b1-2/§12b2-1):** reconciling totals render as `<tfoot>` rows **inside the same `<table>`**, so they share the body's **column grid AND scroll gutter by construction** — a total value can never drift out of alignment with its column (a totals `<dl>` outside the scroll region does). Cells are keyed by column key; `emphasis` = the ruled/bold net row; a **separator rule** is drawn above the totals section (first `<tfoot>` row), both themes. Any table with reconciling totals uses this, never a sibling totals block. **Caption = screen-reader-only (RATIFIED 2026-07-12, Pricing Health §12ph1-3):** a `DataTable` inside a **titled card** keeps its `<caption>` for accessibility but hides it visually (via `.lf-visually-hidden` — 1px dims from `--border-width`, no raw px), because the card header already names the table; a visible caption is a **duplicate title**. **Link treatment is centralized — tables can't opt out (RATIFIED 2026-07-13, page-markets §12mk1-2):** every anchor in a `.lf-table` inherits the ratified accent, **no-underline-at-rest** link (`.lf-table a`, hover underlines) — a per-instance fix of this standard is not a fix (it recurred: Portfolio §12b3-3 → Markets). Non-table link lists style their anchors to match at the page level. |
| **TrendStat** | `label`, `value`, `delta?` (with gain/loss colour), `unit`, `sparkline?`, `provenance?` | KPI/stat tiles (Net worth KPI strip, Portfolio stat rail, Today's change). Delta uses `--gain`/`--loss` only. Optional ProvenanceBadge slot. |
| **MetaStrip** *(new 2026-07-11)* | `items` (`{label, value}[]`) | Compact **label/value metadata** — dense identity/taxonomy that recurs across entity-detail pages (instrument, and future accounts/policies/estate). **Desktop:** one row of equal-width label-over-value pairs; **narrow (< 40rem):** wraps to a tight 2-column grid. Labels `--text-tertiary` small; values below (plain or an `lf-chip`). Display-only (no math). First used on Instrument Detail Identity. |
| **AllocationDonut** | `segments` (`{label,value}`), `legend`, `onSegmentClick?`, **`footnote?`** | Allocation by class/sector/currency/tag (Portfolio, D-033); one summary donut on Home. **Not** used on Net worth (composition donut dropped, D-054). Slate+accent segments (§4). **Amendment RATIFIED 2026-07-11 (Portfolio Phase-0a, ND-4):** an honest **`footnote`** line under the donut for excluded liabilities/zeros (a **served** figure, no client math) — the sector donut also carries the served D-082 "Not sector-classified (non-equity)" segment. |
| **PriceChart** *(amended — RATIFIED 2026-07-11)* | `series`, `overlays?` (`MA`/`BB`/`RSI`), `mode` (`candles`\|`line`), `benchmark?`, `interval`, **`controls?`**, **`defaultView?`** (`simple`\|`advanced`), **`periods?`**, **`activePeriod?`**, **`onPeriodChange?`**, **`coverageNote?`** | House-SVG price/performance chart (D-035, no ECharts). **Amendment RATIFIED 2026-07-11 (Instrument Detail walk):** a **Simple/Advanced view toggle** (Simple = line + price only, the Instrument-Detail default; Advanced = candles + volume + MA/BB/RSI), a **hover crosshair + tooltip** (date + close, OHLCV in Advanced), and a **period selector** (1D/5D/1M/3M/6M/YTD/1Y/5Y/Max) with **honest short-history** (shows only what exists, labels it via `coverageNote`, never stretches or fabricates). Back-compatible: without `controls` it behaves as before. Open-state case at `/kitchen-sink`. **Amendment RATIFIED 2026-07-11 (Portfolio Phase-0a, ND-3d/e): `comparison?` (`{values,label,sublabel?}`)** — a second **same-unit** series on the **SHARED** value axis (unlike `benchmark`, which normalises each series to its own range), with a legend swatch + a provenance sublabel. For portfolio-vs-benchmark performance where both series arrive pre-indexed to a common start (zero client math). Verified both themes + high-contrast. |
| **Treemap** (D-053) *(click-through + readout amendments RATIFIED 2026-07-13, page-heatmap ND-7 / §12hm1-1)* | `nodes` (`{label,value,tone,magnitudePct?,`**`href?`**`,`**`readout?`**`}`), `squarified` | Heatmap; house SVG squarified; ECharts escape hatch via ADR only (§4). **Click-through — RATIFIED 2026-07-13 (owner walk; proposed as page-heatmap ND-7):** an optional per-node **`href`** makes a tile a **keyboard-operable link** to its entity (D-098) — an overlay `<a>` per tile (focusable, **Enter** native + **Space** handled), accessible name = the tile label; **focus/hover use outline + inset shadow only (NO layout shift)**. Back-compatible: without `href`, tiles are non-interactive. **Readout — RATIFIED 2026-07-13 (owner re-verify; page-heatmap §12hm1-1, an ND-7c REVERSAL on live evidence):** an optional per-node **`readout`** (`{value,change,note?}`) shows **name/symbol · value · Today's change** on **hover AND keyboard focus** (never hover-only — WCAG 1.4.13; a tile with a `readout` but no `href` is still focusable, so no tile's value is pointer-only). Every figure is a **SERVED display string** — the component formats nothing (D-105); a missing figure renders as an **em dash + its reason** (ratified copy: *"No prior close to compare."*), never a fabricated 0 (Guarantee 3) — while a **real served zero** ("Today's change 0.00%", e.g. a manual valuation that genuinely did not move) is shown as the zero it is. The readout is an **anchored overlay** (bottom-left of the map, `pointer-events:none`, `role=status`/`aria-live` — the AllocationDonut precedent): anchoring, rather than following the tile, is what makes it **container-safe by construction** — an edge tile cannot push it past the map boundary at any breakpoint (verified at 320px) — and being out of flow it causes **no layout shift**. Hover + focus + edge-tile + missing-change cases at `/kitchen-sink`. |

**Honest-metadata rule (RATIFIED 2026-07-12, Net worth §12b2-3).** A metadata / legend line —
`MetaStrip` items, a `PriceChart` legend line, any status/label strip — **describes only a control or
a fact that is actually present on the page.** Never surface a line for a control that doesn't exist
in the current context (the PriceChart "View: Simple/Advanced" line renders **only** when its toggle
does, i.e. `controls`; on a page with no view toggle the line is omitted). Metadata that names an
absent control is dishonest chrome — it tells the user a lever exists when it does not.

**Shared summary-count query (RATIFIED 2026-07-12, Pricing Health §12ph1-1).** When a **chrome
summary count** (e.g. the StaleBanner's stale-price count) is **also rendered on its canonical page**,
both MUST read **one shared, polled, invalidatable client query** — never two independent fetches.
The pattern (`src/state/staleCount.ts`, `useSyncExternalStore`): a module store polls the canonical
reader, exposes `useX()` (banner + page read the **same cached value**) and `invalidateX()` (any
mutating action — e.g. a refresh — refetches so both move together). A page **must not** render a
figure it independently computed while claiming it "matches" the chrome — the two would skew under
fetch timing. Applies to any future chrome↔page count (stale, review-attention, update).
| **QuoteCardRow** (D-046) | `quotes`, `source` (select: markets/holdings/global/watchlist) | Home's single compact quote-card row with source select; replaces the three separate market rows. |
| **TickerStrip** (D-047 AMENDMENT, **ratified 2026-07-11** — §11-17) | `quotes` (`TickerQuote[]`: `symbol`, `priceDisplay`, `changePct`, `stale?`, `href?`) | **Global chrome FOOTER** — a fixed, always-visible strip at the bottom of the shell, **every width** (was Home-Full-only). Holdings (+ world indices); a symbol with an `href` **links to its canonical home** (holdings → `/instrument/{symbol}`, D-098; **indices → `/markets`** — R-17 **shipped 2026-07-13** with the Markets build, §11-19 closed). Prices are the backend-formatted **`priceDisplay`** string (D-105), rendered verbatim. **Staleness flagged per item** (amber). Marquee **halts under reduced motion** → static + manually scrollable; speed/height/gap are tokens (`--ticker-scroll-duration` 30s, `--ticker-height`, `--ticker-gap`). **Hidden entirely under lock** (leaks nothing, D-002). Home Full no longer duplicates it. |

| **NewsList** (EXTRACTED + **RATIFIED 2026-07-13**, page-news ND-5 / §12nw1-1 — seen live at the News walk) | `items` (`NewsListItem[]`: `headline`, `source`, `url?`, `published_at`, `symbols?`), `showSymbols?`, `emptyMessage?`, `emptyReason?` | A list of headlines, each an **external link (new tab, `rel="noreferrer noopener"`)** + a `source · relative-time` meta line; optional **per-symbol links to InstrumentDetail** (`showSymbols`, grouped News). **Extracted** from the Instrument-Detail news list (the recurring-pattern rule) so News (grouped) and InstrumentDetail (scoped) share **one** implementation. Headlines render as **PLAIN TEXT** (React escapes; the backend also sanitises untrusted feeds — page-news ND-12) and **clamp to 2 lines with an ellipsis** so a long headline never overflows. **Flows** (no internal scroll cap) so the shell content stays the single vertical scroll region (§12mk1-1). Empty → `EmptyState` with a reason. |

| **Segmented** (EXTRACTED + RATIFIED 2026-07-13, page-news §13a) | `options` (`SegmentedOption[]`: `value`, `label` (ReactNode)), `value`, `onChange`, `aria-label` | The **one** segmented-button control — `role="group"` + `aria-pressed`, a bordered container with borderless segments (active fills), **wraps at narrow widths**. **Extracted** because the pattern had recurred **3×** (PriceChart view-toggle + periods, Markets region tabs, News buckets); those page-local copies (`lf-chartbtn`, `mk__seg`, `nw__seg`) are **removed and migrated** to this primitive (the centralization rule — per-instance copies of a standard are the defect, page-markets §12mk1-2). A segment `label` is a ReactNode, so a tab may carry a count badge (`lf-segbtn__count`). |

### 5.3 Provenance & status

| Component | Props (surface) | Usage rules |
|-----------|-----------------|-------------|
| **ProvenanceBadge** | `source`, `entitlement`, `valuationMethod`, `confidence` (`{score,band}`), `asOf` | The **one** standardized badge; renders **source · freshness · confidence identically** on every number that has provenance. Wording per GLOSSARY (Source, Entitlement, Status). Canonical, fullest detail on Pricing Health. |
| **StatusChip** *(NEW — §5 AMENDMENT **RATIFIED 2026-07-15**, page-policy §9-15; owner accepted the SUPERSET + both migrations)* | `label` (**ReactNode, MANDATORY**), `tone?` (`neutral`\|`attention`\|`positive`\|`negative`), `count?`, `title?` | **THE status/severity chip.** **Extracted at the THIRD recurrence** of the same page-local pattern — Pricing Health's `ph__chip`, Review's `rv__chip`, and Policy's band chip — under the centralization rule the `Segmented` extraction set (*per-instance copies of a standard are the defect*). **Both page-local copies are MIGRATED onto it and DELETED; none remains** (grep-verified; their guards were **retargeted, not removed**, and every pre-pass is green after the migration — a behaviour-neutral swap). **The label is MANDATORY and always rendered: a chip's meaning is NEVER carried by colour alone** (WCAG 1.4.1). Tones are semantic tokens only (§1). **On Policy, `over` AND `under` BOTH render `attention` (amber), and `positive`/`negative` are FORBIDDEN** (page-policy §9-16): gain/loss colouring would *value* the gap ("over = bad"), which is the nearest a colour can come to implying a trade (D-055). ⚠ **DEVIATION FROM THE §9-15 RULING, SURFACED NOT SILENTLY RESOLVED:** the ruling said *"variants neutral / attention"* **and** *"migrate `ph__chip` … no behaviour change"* — **those two clauses conflict.** `ph__chip` has **four** tones (`ok`/`warn`/`bad`/`neutral`): Pricing Health colours **Fresh** green and **Unavailable/Estimated** red. A two-variant chip would have **silently deleted those semantics** — a real regression dressed as compliance. The chip therefore ships a **superset** (`positive`/`negative` added), Policy is barred from using them, and the migration is genuinely behaviour-preserving. **Owner ratifies the superset at the walk.** Specimens at `/kitchen-sink`: neutral · attention · attention-under · with-count · positive · negative · long-label. |
| **StalenessChip** | `isStale`, `asOf`, `staleAfter?` | Amber (`--attention`) chip for the **Stale** layer; **flags, never hides** the value. Distinct from ProvenanceBadge (which carries the full source·freshness·confidence). |

### 5.4 Structure & chrome

| Component | Props (surface) | Usage rules |
|-----------|-----------------|-------------|
| **PageHeader** | `title` (H1 = nav label = route, D-022), `subtitle?`, `actions?` | Opens every page; states the canonical/summary split in the subtitle where relevant (e.g. Portfolio "analytics" ↔ Holdings "management", D-023). |
| **EmptyState** | `message`, `reason`, `action?` | Every empty/"—" region shows a **reason** (Product Guarantee 3: "—" with a reason, never blank). |
| **SummaryLink / SummaryHead** *(RULE — PROPOSED 2026-07-13, page-home §12ho1-2; ratify at the re-verify)* | `to`/`href`, `destination`; `SummaryHead` adds `title`, `whole?` | **THE linked-summary affordance.** A tile that summarises a figure another page **owns** carries the **corner ↗, top-right of the tile** — and nothing else. **Titles are never text links. There are no page-local variants.** *(Codified at the 3rd recurrence, per the centralization rule: the same idea had drifted into four forms — a text link under the title (Home), "Portfolio ↗" in a header row (Net worth), a bare corner glyph (Review/Portfolio tiles), and a footer "Review →" (ReviewCard). All four are conformed.)* The ↗ glyph is decorative; the link is **keyboard focusable** and its **`aria-label` names the destination**. **`whole`** makes the entire tile header the click target — **pure-summary tiles only**: a header carrying its own interactive content (a **[Help]** popover) must not use it, because nesting an interactive element inside a link is an accessibility defect. Hover/focus change colour + outline only ⇒ **no layout shift**. |
| **ReviewCard** | `sections` (verdicts), `attention`, `link` | Summary-with-link on Home/Net worth; canonical body on Review. **Enforcement corollary:** shows no figure the Review page does not (P-1). |
| **GlossaryTerm** | `term` (`term-*` id), `children` | Popover linking a shown term to its GLOSSARY entry; term spelling must match GLOSSARY exactly. |
| **Dialog** *(amended)* | `open`, `onClose`, `title`, `children`, `footer?`, `variant?` (`center`\|`drawer`), `size?` (`md`\|`lg`\|`xl`), `dismissOnBackdrop?` | The worklist **CRUD-editor** container (Add flow, edit forms, import wizard) and the base for ConfirmDialog. Focus-trapped, Esc-to-close, backdrop-dismiss, restores focus on close; portal + `--scrim` backdrop + `--shadow-1`. **`size`** sets the centered panel width — `md` (32rem, default), `lg` (`min(46rem,96vw)`, two-column forms), `xl` (`min(64rem,96vw)`, wide review grids); all clamp to the viewport so they only widen on desktop. **Amended 2026-07-10 (Holdings page-build §9-2; `size` added §9-29).** |
| **ConfirmDialog** *(amended)* | `open`, `title`, `message`, `confirmLabel?`, `destructive?`, `requirePin?`, `onCancel`, `onConfirm` | Confirm overlay for destructive actions; **reuses Dialog**. `requirePin` gates confirmation on a masked PIN (purge-deleted, D-002/D-049). **Amended 2026-07-10 (Holdings page-build §9-5).** |
| **RowMenu** *(amended)* | `items` (`{label,onClick,danger?,disabled?}`), `aria-label?` | Compact per-row overflow menu (⋯) for **worklist row actions** — details / edit / delete / tags. Closes on outside-click / Esc. Keeps data-dense tables narrow (§3 worklist note). **Amended 2026-07-10 (Holdings page-build §9-22).** |

### 5.5 Global chrome (D-066) — composed, not per-page

DemoBadge, Clock (timezone), theme cycle, rotation toggle, **StaleBanner**,
**UpdateBanner** (respects no-egress: zero outbound calls when enabled, version
check + banner included), and the **Ask panel** (P-6: SSE streaming, fact-pack
before answer, validated-before-display, ephemeral, privacy-mode label always
visible — D-067). The Detail toggle leaves the top bar but only Home branches on
it (D-040/D-066). The **first-run checklist** (D-045) replaces PersonaOnboarding.

**Chrome component inventory** *(amendment **RATIFIED 2026-07-11** — page-chrome
Phase 0a, C-1; recomposed + re-ratified per owner amendments 1–4).*
The pieces above are now built as named components in `src/components/ui/`
(previously only `DisplayControls` existed). Ratified at
`/kitchen-sink` before shell assembly:

| Component | Props (surface) | Usage rules |
|-----------|-----------------|-------------|
| **Sidebar** | `open?`, `onClose?`, `groups?` (default `NAV_GROUPS`), `activePath?`, `showAll?` | The ONE nav: six fixed groups in fixed order (D-043), NOT reorderable; active route from the router (NavLink), bolder accent rail (`--nav-rail-width`). **Progressive reveal:** every group header always renders; only **built pages** (`item.built`) appear as entries — a group with none built shows its header only; entries appear as pages ship. `showAll` previews the full skeleton (specimens). **Responsive (D-102):** fixed at laptop+, off-canvas below (opened by the TopBar toggle). Brand wordmark shows here at laptop+. `activePath` forces the highlight for previews only. **Amendment PROPOSED 2026-07-11 (page-portfolio §12 batch-3):** page entries are **indented** under their group header (extra left padding) for visual hierarchy — the active rail stays at the left edge; D-043 groups/order are untouched. |
| **TopBar** *(amendment PROPOSED 2026-07-13, page-home §9-15 — ratify at the walk)* | `onToggleNav?`, `controls?`, `clock?`, `demoBadge?`, `rotationOn?`+`onToggleRotation?`, `askSlot?` | Composed once above every page (D-066). **Slim (~48px), calm register.** Layout container; the shell supplies the slots. Right-aligned cluster is **icon-only** (tooltip + aria-label carry the state): the relocated display axes (`controls`), then the **one toggle this bar owns — rotation (D-044)** — then Clock + DemoBadge. **Amendment PROPOSED 2026-07-13 (page-home §9-15):** the **Detail toggle is REMOVED from the top bar** — `detailLevel?`/`onToggleDetail?` are **deleted** from the props. This closes a spec-vs-code divergence: **D-040** ("the global top-bar toggle is **removed**") and **IA §Global chrome** ("the Detail toggle **leaves** the top bar" — its list otherwise reads "StaleBanner *kept*", "rotation toggle *stays*") always said it goes; this row said it stays, and the code shipped it **with state that persisted nowhere**. The control is **Settings'** ("**Home layout: Simple / Full**", the §9-1 ratified label), backed by the **server-persisted `home_layout`** setting — so **rotating to Home uses the configured layout, one setting, no special case** (D-040). IA/D-040 stand as written; this row is corrected to match them. **No banners inside** (they are strips below — amendment 2). Brand "LedgerFrame" sits top-left **only at narrow widths** (the sidebar carries it at laptop+ → exactly one brand visible, never two). Shows the nav toggle at narrow widths (D-102). **`askSlot` is the reserved Ask-panel slot (D-067) — DEFERRED (C-2), left empty for now.** |
| **StaleBanner** | `count`, `href?` (→ Pricing Health) | Status summary, NOT a canonical figure (P-1) — reads the summary reader, links to the canonical page, recomputes nothing. **Renders as a full-width slim status strip BELOW the top bar, in normal flow (pushes content, never overlays), only when active** (amendment 2). Amber attention only (§2.1). **Hidden at `count ≤ 0`** (no "0 stale" noise). |
| **UpdateBanner** | `version` (`string \| null`), `href?` (→ Settings/About), `onDismiss?` | Full-width status strip below the bar (as StaleBanner). **Presentational only — makes no network call.** The version comes from a no-egress-guarded reader; under no-egress that reader does ZERO outbound calls and passes `null`, so the strip never renders (D-075/D-060). Zero-outbound is verified at the data layer (C-3), not in the component. |
| **DemoBadge** | `active?` | Signals demo/seed data (no figure is real). Renders nothing when not demo (honest). |
| **Clock** | `timezone` (IANA, from Settings D-013), `now?` (freeze) | Device clock — no figure, no provenance. Ticks each minute; `now` freezes it (tests/specimens). Timezone is never guessed. |
| **LockScreen** | `open`, `onUnlock(pin)`, `error?`, `busy?` | Full-screen PIN gate; **access lock, not encryption** (D-002/SECURITY-BASELINE §3). Numeric PIN, min 6 digits; reuses the ConfirmDialog masked-PIN pattern (no new input primitive). Unlock/session call + lockout `Retry-After` live in the shell (C-5). Unlocking grants ambient session access only — it does NOT authorize purge (D-103). |

`NAV_GROUPS` (`ui/nav.ts`) is the canonical sidebar model, verbatim from
INFORMATION-ARCHITECTURE §3 (D-043); each `NavItem` carries a `built` flag (only
built pages appear as entries). Display axes, rotation, and Detail are rendered as
**icon-only** `.lf-iconbtn` buttons (tooltip + aria-label carry state); rotation and
Detail are plain buttons owned by TopBar, not separate components.

**Stateful-icon rule (re-ratify 2026-07-11; icons = lucide, ADR-0003 §11-15).** A
**stateful** toggle MUST render a **state-distinct icon per state** — the icon *shows*
the current state, the tooltip *names* it ("Function: state"). A single fixed icon for a
control that has states is forbidden. **No icon may collide with another bar control**;
`Menu` is **reserved** for the sidebar/menu toggle (narrow widths). Icons are lucide,
imported per-name from `src/icons.ts` (tree-shaken, bundled, no CDN). Current bar
assignments:

| Control | States → lucide icons |
|---------|-----------------------|
| Theme | light `Sun` · dark `Moon` · system `Monitor` |
| Density | comfortable `Rows2` · compact `Rows4` |
| Contrast | system `Contrast` · normal `Circle` · high `Disc` |
| Motion | full `Waves` · reduced `Minus` · system `Wind` |
| Rotation | on `RotateCw` · off `Ban` |
| Detail | simple `LineChart` · full `CandlestickChart` |
| Menu / overflow | `Menu` (reserved) · `MoreHorizontal` (overflow popover, RowMenu) |
| Page actions | Edit `Pencil` · Import `Upload` · Export `Download` · Add `Plus` |

**LockScreen blur (D-002, re-ratify 2026-07-11).** The lock renders over a **blurred,
dimmed snapshot** of the live screen (`backdrop-filter: blur(--lock-blur)`, 24px), PIN
gate centered. Illegibility is a **security requirement** (a wall appliance must not
leak net worth to an ambient shoulder-view), so it does **not** rely on blur alone:
a heavy `--lock-scrim` dims on top, and an `@supports` fallback swaps to a near-opaque
`--lock-scrim-opaque` wherever `backdrop-filter` is unsupported — content is genuinely
unreadable on every browser regardless of blur. `--lock-blur` is a token; verify the
illegibility at the kitchen sink.

**Icon-button & tooltip rules (batch 2, 2026-07-11).**
- **Uniform hit area.** Every `.lf-iconbtn` (bar controls + page-action buttons) is a
  fixed **`--iconbtn-size`** square with a single glyph size, glyph flex-centered — they
  read uniform whatever the glyph's own metrics. `☰` stays reserved for the menu toggle.
- **Tooltip = "Function: state" only.** A stateful toggle's `title` is exactly
  `Function: state` (e.g. `Theme: dark`) — no "click to change" trailer — and its
  `aria-label` matches the tooltip.

**TopBar narrow composition (RATIFIED 2026-07-11 — D-102 extension, batch 2).** Below the
900px laptop breakpoint the display axes + rotation + Detail **collapse into a single
overflow popover** (`aria-label="Display settings"`); the bar then shows only Menu + brand
+ overflow + Clock + DemoBadge and **never wraps at any width ≥320px**. The popover reuses
`--surface-raised`/`--border`/`--shadow-1`, closes on outside-click/Esc.

**Clock (RATIFIED 2026-07-11, batch 2).** Time-only in the bar at **all** widths; the full
date + IANA timezone name live in the tooltip/`aria-label`.

**DemoBadge placement (RATIFIED 2026-07-11, batch 2).** At laptop+ it renders in the
**sidebar footer** (bottom-left); below the breakpoint it moves into the **top bar**.
Never hidden while demo data is active.

**Page-action icon-button pattern (RATIFIED 2026-07-11 — DESIGN-SYSTEM §5.5; §11-16).**
The standard for page-header actions: **ALL** page-header actions are **icon-only
`.lf-iconbtn`** (lucide icon) with tooltip + matching `aria-label`, on a **visible bordered
surface** — `.lf-iconbtn--framed` (never a ghost/naked icon). Example set: Instrument
Detail **Edit** `Pencil`; Holdings **Import** `Upload` / **Export CSV** `Download`. The
**primary** action (**Add** `Plus`) is icon-only too but uses the **accent-filled
`.lf-iconbtn--primary`** variant so the primary action keeps its emphasis + discoverability.

**First-run checklist components (RATIFIED 2026-07-11 — page-first-run-checklist Phase
0a, D-045).** Three pieces, ratified at the kitchen sink (Switch · Combobox typed-filter
+ portal + narrow width · FirstRunChecklist overlay incl. all authored copy — the five
step texts, the F-9 interplay lines, and the PIN access-lock/not-encryption note, D-002
wording). `--radius-pill` ratified. Ratified as implemented:

| Component | Props (surface) | Usage rules |
|-----------|-----------------|-------------|
| **Switch** | `checked`, `onChange`, `label?`, `disabled?`, `aria-label?` | Boolean toggle (`role="switch"` + `aria-checked`); the inventory had none. First used by the no-egress step; available to the future Settings page. |
| **Combobox** | `options` (`{label,value}[]`), `value`, `onChange`, `placeholder?`, `aria-label?` | **Searchable** picker over an arbitrary list (client-side filter). For long option sets (the ~400 IANA timezones, F-4) where `Select`/`MasterSelect` (native selects) are poor. Menu **portals to the viewport** (fixed + max-height + internal scroll) per §6. **NOT for MASTER-DATA categoricals** — use `MasterSelect`. |
| **FirstRunChecklist** | `open`, five value props, `timezoneOptions`, `providerOptions`, `links`, per-step handlers, `onDismiss` | The D-045 first-run overlay: a **dismissible** card (not a blocking gate — F-1) with five **skippable** steps (base currency · timezone · PIN · data provider · no-egress), each an **inline-minimal control** that writes the real setting (F-2) plus a **"more options" link** to its Settings home. Presentational/prop-driven; the shell wires it in Phase 1 **after the lock gate** (F-7). Plain copy (no decision IDs); shows the F-9 interplay notes (no-egress → prices won't refresh; provider → noted when no-egress is on). Provider = **selection only** — the API-key path links to Settings, never a key field (F-8/D-069). |

`--radius-pill` token added for the Switch track. Ratified 2026-07-11.

**Toast / Snackbar** *(amended 2026-07-10 — Holdings page-build §9-4).* A
transient, timed, dismissible notification with an optional action slot, provided
via a `ToastProvider` + `useToast()` `show(spec)`. Auto-dismisses after
`durationMs` (default **10000** — the soft-delete undo window, D-049) with a
visible countdown bar; ARIA live-region (`role="status"`, `aria-live="polite"`);
countdown + entrance animation disabled under reduced motion (the dismiss timer
still fires). It carries **no figure and no provenance** — status only.

---

## 6. The hard rule (CLAUDE.md, restated)

**Every user input uses a component from `src/components/ui/`. Raw `<input>`,
`<select>`, or ad-hoc styling is forbidden.** Pages **compose** components; pages
**never style primitives**. Corollaries:

- Every categorical field is a **MasterSelect** bound to a MASTER-DATA vocabulary
  — no inline option lists, no `refdata.ts` copies (D-005/D-049).
- Every money field is a **MoneyInput**; every date a **DateInput**; every table
  a **DataTable**. No bespoke one-off table or input.
- Styling is via tokens (§2) and templates (§3); components own their look. A
  page that needs a new visual affordance adds/extends a **component**, it does
  not inline styles.
- **Popover overlay rule (universal, all components).** Any open dropdown /
  result list / popover — `InstrumentPicker`, `ui/Select`, `MasterSelect`,
  `DateInput` — must **overlay within the viewport**, never expand its container or
  create dialog-level scroll. Native controls (`select`, `input[type=date]`)
  satisfy this by construction; **custom popovers** (e.g. the InstrumentPicker
  result list) **must portal to `document.body`** with `position: fixed` anchored
  to the field, a viewport-relative `max-height`, and internal scroll. Verified by
  an **open-state-inside-a-dialog** case at `/kitchen-sink` (§5.4 Dialog demo).
  Recorded from the Holdings final walk (page-holdings §9-39).

---

## 7. Accessibility baseline

- **Contrast: WCAG AA.** Normal text ≥ 4.5:1, large text / UI glyphs ≥ 3:1.
  Every §2.1 pairing is validated at ratification (§2.6); gain/loss/attention
  figures must pass on their surfaces.
- **Keyboard navigation.** Full keyboard operability; visible **focus ring**
  (`--focus-ring`); DataTable sortable headers are keyboard-operable with
  `aria-sort`; menus/popovers trap and restore focus; logical tab order.
- **Colour is never the sole signal.** Gain/loss also carries sign/arrow;
  staleness also carries the StalenessChip icon/text; status also carries the
  one-word chip. Colour-blind safe.
- **Reduced motion** (per-device, D-078): honour the setting **and**
  `prefers-reduced-motion`; disables rotation animation and chart transitions.
- **High contrast** (per-device, D-078): boosts border/text contrast and chip
  legibility.
- **Theme-complete & responsive from day one:** light/dark/system; phone → wall
  kiosk. Per-device display properties (theme, density, sidebar-collapsed,
  reduced-motion, high-contrast) are localStorage (D-078).

---

**Derived from:** `docs/specs/DESIGN-BRIEF.md` (Rebuild Playbook design brief),
`docs/audit/01-FEATURE-INVENTORY.md` (chart/component inventory), and
`docs/audit/DECISIONS.md`. Decision IDs applied: D-005, D-012, D-019, D-022,
D-033, D-035, D-040, D-045, D-046, D-047, D-049, D-053, D-054, D-066, D-067,
D-078, plus P-1 and P-5. Concrete token values were authored proposals (§2),
**ratified at the kitchen-sink review 2026-07-10** (with three amendments — see
the top of §2); values taken verbatim from the brief are marked **BRIEF**.

## Needs decision

- (none) — §2 token values are **ratified** (2026-07-10, §2.6). The only residual
  item is a **future** ADR if/when the UI/serif fonts are self-hosted (a bundle
  dependency); the ratified fallback system stacks keep the system shippable
  meanwhile (§2.2). Not blocking.


---

## §5 AMENDMENTS — page-home Phase-3b Batch 2 (PROPOSED 2026-07-14, ratify at re-verify)

**A. `SummaryHead` gains a `meta` slot — and it is the ONE tile-header anatomy (§12ho2-5).**
Every summary tile's header is: **title (left) · optional trailing meta · ↗ (right)** — one type size,
one weight, one spacing. `meta` is what removed the page-local header bars: **ReviewCard**'s attention
count (*"3 need a look"*) and **QuoteCardRow**'s source select now sit **in** the header row instead of
each tile inventing its own. A header carrying interactive meta (a Select, a [Help] popover) is **not**
a whole-header link — nesting an interactive element inside a link is an accessibility defect.

**B. `QuoteCardRow` gains `summary={{to, destination}}` (§12ho1-5, owner-approved).** When the row IS a
summary tile it renders the standard `SummaryHead`; without it the caller had to bolt on a second title
or a naked corner ↗. Omit it and the row keeps its plain label (the gallery / non-summary use).

**C. The ↗ is the Lucide `arrow-up-right` SVG (§12ho2-8).** ADR-0003's set. A typographic "↗" rendered
differently in every font and sat on the text baseline instead of optically centred on the title. It is
one component, so every site changed at once. `aria-label` is unchanged; the icon is `aria-hidden`.

**D. `AllocationDonut` gains `legendMax` + `legendMore` (§12ho1-7, owner: lever B).** The **legend** caps
at the N largest classes **by served value**; the **RING still draws every segment** — a capped ring
would misrepresent the figure. The overflow row states a **count** and links to the canonical page
(*"+4 more ↗"*). **No "Other" bucket is invented and no share is recomputed** (Guarantee 3, D-105): this
is a display **selection**, the same class as the Gainers/Losers sort — not money math.

**E. `NewsList` gains `clampLines` (§12ho2-9).** A summary clamps each headline to one line and links to
the page that owns the full text; News itself clamps nothing.

**F. §5.2 — `Select` RESTING STATE is borderless (§12ho2-11, PLATFORM-WIDE).** A Select is a **view-scope**
control ("which slice am I looking at"), not a data-entry field; wearing the same hard border as a
MoneyInput made every scope picker read as an empty form waiting to be filled. **Resting:** borderless on
a subtly elevated surface. **Hover:** the border returns. **Focus-visible: the ring is RETAINED, unchanged
— a11y is not a style to trade away.** Text inputs keep their border: *"type here"* is a different promise
from *"choose a view"*. Applies at **every** Select site (Home quotes, Markets, Heatmap, …) because it is
one component. Specimens in `/kitchen-sink`.


---

## §5 AMENDMENTS — page-home Phase-3b Batch 3 (PROPOSED 2026-07-14, ratify at re-verify)

**G. `AllocationDonut` — the value readout moves to the RING'S CENTRE (§12ho3-2, platform-wide).**
Hover **or keyboard focus** on a segment renders the **served class label + share** in the donut hole.
It is **anchored** at the centre: it cannot overlap the legend or a neighbouring tile, **nothing follows
the cursor**, and because it is absolutely positioned inside the ring there is **no layout shift** when
it appears. A long class label **ellipsises inside the hole** rather than spill over the ring. The old
readout was a text line *beneath* the donut; the hole was empty space, and it is now where the question
gets answered. **Both themes, all breakpoints.** The `aria-live` readout is **retained** (visually
hidden) — moving the *visual* readout must not cost the *accessible* one. **Portfolio inherits it**, as
does every other Donut site. Specimen in `/kitchen-sink` (hover · focus · long-label).

**H. Donut ring density (§12ho2-12 lever 2, folded into G).** The ring is **8rem** (was 9rem) so it sits
with the capped legend instead of towering over it. **Measured honestly: this bought ~0px of page
height** — the *capped legend* (6 rows) is taller than the ring, so the **legend**, not the ring, sets
that tile's height. It is kept because it is better balanced, **not** because it won a fit.
**MOTION RULE (RECORDED 2026-07-14, page-policy §12po1-11).** **Reduced motion disables MOVEMENT, never
ACCESS.** When `prefers-reduced-motion` (or the Settings axis) is set, an animated surface must stop moving
**and remain fully reachable** — it may never become unusable or hide content that motion was carrying. The
motivating case: the **TickerStrip** correctly halts its marquee and becomes statically scrollable
(behaviour **confirmed correct** at the owner walk), but it did so with **no room reserved for a scrollbar**,
so a chunky default-looking bar crowded the quotes. It now uses the **quotes-row treatment** — a thin,
**themed** bar with a stable gutter and reserved space. *Stopping the animation was right; making the
fallback ugly-but-working was not the same as making it right.*


---

## §5.2 AMENDMENT — Base-currency indication on money summary surfaces (RATIFIED 2026-07-16, owner walk batch 2 §14in-7; first proposed §14in-5)

**A money SUMMARY tile/strip showing a base-currency aggregate carries a small muted currency-code
affix** (e.g. `SGD`) next to the value — so the reader always knows which currency the aggregate is in.
One pattern, **token-styled via the existing `.lf-stat__unit` slot** (muted `--text-tertiary`, regular
weight, `--space-2` before the value's trailing edge) — **no new component**, and it is **never
colour-semantic**. The affix source is the **SERVED `base_currency`** (D-005 — the frontend picks nothing;
`liquidity`, `runway`, `statement`, `insurance` and other readers already serve it). It rides the
**`unit`** prop of `TrendStat`; a **non-money** tile (a count, a policy tally) carries none. Per-row
**non-base** amounts already carry their own code inline (the Insurance §12in-1 pattern); this amendment
governs the **base-currency SUMMARY** figure, which was otherwise bare.

- **ONE form only.** The affix is the muted `.lf-stat__unit` slot beside the value — **never** embedded
  inside the value string (`SGD 796,246.00`). Review/Holdings/Home had inline embeds; those are converted
  to the affix so the platform has a single rendering of the standard (§14in-7).
- **Retrofit DONE (owner pulled it forward, §14in-7 — 2026-07-16):** applied to every base-currency money
  summary tile/strip — **Home** money widgets, **Net worth** headline tiles, **Portfolio** stat strip +
  Costs, **Holdings** net-worth summary, **Review** net-worth stat, **Scenarios** exposure tiles + "Net
  worth today", **Cash flow** runway money, **Insurance** totals (first instance). The affix source is the
  page reader's **served `base_currency`** (never hardcoded); a page whose reader lacked it gained it
  backend-first. Money **rows** that already carry per-quote codes (Markets, Heatmap, Pricing Health) are
  out of scope. Each touched accepted page carries a dated delta note + a re-run pre-pass.

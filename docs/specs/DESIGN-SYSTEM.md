# DESIGN-SYSTEM.md — LedgerFrame v2

**Normative.** Operationalises `DESIGN-BRIEF.md` into design principles, tokens,
page templates, and the component library. CLAUDE.md hard rule (restated in §6):
**every user input uses a component from `src/components/ui/`; raw `<input>`,
`<select>`, or ad-hoc styling is forbidden — pages compose components, pages
never style primitives.** Terms match GLOSSARY.md; page assignments match
INFORMATION-ARCHITECTURE.md.

**Ratification.** For this file the token *values* (hex palette, spacing scale,
type weights/line-heights, font choices) are **authored proposals**, not
extractions. Every proposed value is marked **PROPOSED — ratify at kitchen-sink
review**; ratification happens when the component library is built and reviewed
visually. Until then, proposed values are the working values. Values taken
verbatim from the brief (e.g. the 12/13/14/16/20/28 type scale) are marked
**BRIEF** and are not open for re-proposal.

---

## 1. Design principles

The visual language targets **institutional wealth platforms** (Addepar,
private-bank client portals) — not a startup dashboard, not default shadcn.

1. **Numbers are the interface.** Tabular (monospaced-figure) numerals
   everywhere, **right-aligned**, with **consistent decimal places per unit
   type** (money 2dp, price 6dp, percent 2dp, quantity per-instrument
   precision). Thin table rules; generous row-density options
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

### 2.1 Colour — light & dark (PROPOSED — ratify at kitchen-sink review)

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
| `--accent` | `#2563eb` | `#60a5fa` | Interactive/selected state, links, primary action |
| `--accent-contrast` | `#ffffff` | `#0f172a` | Text/icon on an accent fill |
| `--gain` | `#15803d` | `#4ade80` | Positive change **only** |
| `--loss` | `#b91c1c` | `#f87171` | Negative change **only** |
| `--attention` | `#b45309` | `#fbbf24` | Staleness / attention **only** (amber) |
| `--focus-ring` | `#2563eb` | `#60a5fa` | Keyboard focus outline |

Rules: `--gain`/`--loss` appear only on gain/loss figures and their glyphs;
`--attention` only on StalenessChip / attention markers; `--accent` is used
sparingly (selection, primary action, links) — it is not a brand wash.

### 2.2 Typography

| Aspect | Value | Status |
|--------|-------|--------|
| Type scale (px) | **12 / 13 / 14 / 16 / 20 / 28** | BRIEF |
| UI family | Quality grotesque with tabular figures — **proposed:** Inter (self-hosted) with fallback `system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif` | PROPOSED |
| Report-header family (optional) | A serif for report headers — **proposed:** Source Serif 4 (self-hosted) with fallback `Georgia, "Times New Roman", serif` | PROPOSED |
| Weights | 400 regular · 500 medium · 600 semibold | PROPOSED |
| Numerals | **tabular** (`font-feature-settings: "tnum" 1;`) on every figure | BRIEF |

Type-scale roles (PROPOSED — ratify at kitchen-sink review):

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

### 2.3 Spacing scale — 4px grid (PROPOSED — ratify at kitchen-sink review)

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

### 2.4 Radius, border, elevation (PROPOSED — ratify at kitchen-sink review)

Minimal borders and shadows (principle 3). `--radius-sm` 4px · `--radius-md` 6px
· `--radius-lg` 10px. Borders are 1px `--border` (thin rules). Elevation is
restrained: `--shadow-1` a single soft shadow for popovers/menus only; cards use
a border, not a shadow.

### 2.5 Density modes (D-045 / D-078)

Two modes: **comfortable** (default) and **compact**. Density is a **per-device**
property (localStorage), set in **Settings → Appearance** (D-045/D-078) — it is
not server-persisted and not part of rotation config. Density scales row height
and cell padding (primarily in DataTable) and the wall-kiosk reading distance.

| Density | Table row height | Cell padding (Y) | Status |
|---------|------------------|------------------|--------|
| comfortable | 44px | `--space-4` (12) | PROPOSED |
| compact | 32px | `--space-3` (8) | PROPOSED |

### 2.6 Ratification checklist

Every value marked PROPOSED above is a working value to be **ratified at the
kitchen-sink review** (component library built + reviewed visually): §2.1 palette
(both themes), §2.2 font choices + weights + line-heights, §2.3 spacing, §2.4
radius/border/elevation, §2.5 density metrics. BRIEF-tagged values (type-scale
sizes, tabular figures, the semantic-colour rules) are fixed and out of scope for
re-proposal.

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
- **Home** (Overview) additionally branches on Home layout (Simple/Full, D-040/D-046).
- **Reports Pack** (`/reports/pack`) uses a dedicated **print layout**, not one of
  the four — it is the sanctioned artifact (D-038/D-061).
- Every template opens with **PageHeader** (§5) and routes empty regions through
  **EmptyState** (§5).

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
  is a gain/loss; allocation/category segments use the slate ramp + accent, not
  a rainbow.

---

## 5. Component library

Built **before any page** (brief). Every component lives in
`src/components/ui/`. Props below are the surface; **usage rules are normative**.
Categorical props resolve through MASTER-DATA.md (never inline lists); monetary
props are backend-computed `Decimal` strings (never client-computed).

### 5.1 Inputs (the only sanctioned way to accept user input)

| Component | Props (surface) | Usage rules |
|-----------|-----------------|-------------|
| **MoneyInput** | `value` (Decimal string), `currency` (from currency master), `onChange`, `min?`, `max?`, `disabled?`, `aria-label` | Currency-aware; the **only** control for money entry. No raw number input for money; **no client-side money math**; currency options from the currency master (MASTER-DATA §3). Renders/edits with 2dp, tabular. |
| **QuantityInput** | `value`, `onChange`, `precision?` (per-instrument), `step?`, `disabled?` | Share/unit quantities; high precision; tabular, right-aligned. |
| **PercentInput** | `value`, `onChange`, `min?`, `max?`, `disabled?` | Targets, bands, thresholds (e.g. `long_term_days` is a number input, not this). 2dp; shows `%`. |
| **DateInput** | `value` (ISO `yyyy-mm-dd`), `onChange`, `min?`, `max?` | Replaces every inline `type="date"`; stores ISO. |
| **InstrumentPicker** (D-012) | `value` (instrument id), `onSelect`, `allowCreate`, `scope?` | Typeahead over existing instruments + provider search; **explicit "create new instrument"** path (no silent auto-create); selecting sets currency/asset_class from the instrument. Used for symbol entry and the merger "Absorbed into" field (D-019). |
| **MasterSelect** | `master` (vocabulary/master id), `value`, `onChange`, `allowCreate?` (extensible masters only) | **The** select for every categorical field. Fixed vocabularies from `/refdata`; extensible masters from their endpoints (MASTER-DATA §1). **Never** an inline option list. `allowCreate` only where the master is user-extensible (institution, sector, tag). |

### 5.2 Data display

| Component | Props (surface) | Usage rules |
|-----------|-----------------|-------------|
| **DataTable** | `columns` (`{key,label,align,format,sortable}`), `rows`, `sort`, `onSort`, `filter?`, `onExport?` (server-side), `stickyHeader`, `density`, `rowLink?` | **One implementation** for every table (Holdings, transactions, tax lots, drift, policy targets, insurance, estate, pricing health, accounts). Sticky header; `aria-sort` on sortable headers; numbers right-aligned + tabular + per-unit dp; **export is server-side** (P-5) — the client never generates the file. Respects density (§2.5). |
| **TrendStat** | `label`, `value`, `delta?` (with gain/loss colour), `unit`, `sparkline?`, `provenance?` | KPI/stat tiles (Net worth KPI strip, Portfolio stat rail, Today's change). Delta uses `--gain`/`--loss` only. Optional ProvenanceBadge slot. |
| **AllocationDonut** | `segments` (`{label,value}`), `legend`, `onSegmentClick?` | Allocation by class/sector/currency/tag (Portfolio, D-033); one summary donut on Home. **Not** used on Net worth (composition donut dropped, D-054). Slate+accent segments (§4). |
| **PriceChart** | `series`, `overlays?` (`MA`/`BB`/`RSI`), `mode` (`candles`\|`line`), `benchmark?`, `interval` | House-SVG price/performance chart: candles + MA/BB/RSI on Instrument Detail; line + benchmark mode for the Portfolio performance panel (D-035). No ECharts. |
| **Treemap** (D-053) | `nodes` (`{label,value,tone}`), `squarified` | Heatmap; house SVG squarified; ECharts escape hatch via ADR only (§4). |
| **QuoteCardRow** (D-046) | `quotes`, `source` (select: markets/holdings/global/watchlist) | Home's single compact quote-card row with source select; replaces the three separate market rows. |
| **TickerStrip** (D-047) | `quotes`, `source` | **Home Full layout only** — never Simple, never any other page (D-047). |

### 5.3 Provenance & status

| Component | Props (surface) | Usage rules |
|-----------|-----------------|-------------|
| **ProvenanceBadge** | `source`, `entitlement`, `valuationMethod`, `confidence` (`{score,band}`), `asOf` | The **one** standardized badge; renders **source · freshness · confidence identically** on every number that has provenance. Wording per GLOSSARY (Source, Entitlement, Status). Canonical, fullest detail on Pricing Health. |
| **StalenessChip** | `isStale`, `asOf`, `staleAfter?` | Amber (`--attention`) chip for the **Stale** layer; **flags, never hides** the value. Distinct from ProvenanceBadge (which carries the full source·freshness·confidence). |

### 5.4 Structure & chrome

| Component | Props (surface) | Usage rules |
|-----------|-----------------|-------------|
| **PageHeader** | `title` (H1 = nav label = route, D-022), `subtitle?`, `actions?` | Opens every page; states the canonical/summary split in the subtitle where relevant (e.g. Portfolio "analytics" ↔ Holdings "management", D-023). |
| **EmptyState** | `message`, `reason`, `action?` | Every empty/"—" region shows a **reason** (Product Guarantee 3: "—" with a reason, never blank). |
| **ReviewCard** | `sections` (verdicts), `attention`, `link` | Summary-with-link on Home/Net worth; canonical body on Review. **Enforcement corollary:** shows no figure the Review page does not (P-1). |
| **GlossaryTerm** | `term` (`term-*` id), `children` | Popover linking a shown term to its GLOSSARY entry; term spelling must match GLOSSARY exactly. |

### 5.5 Global chrome (D-066) — composed, not per-page

DemoBadge, Clock (timezone), theme cycle, rotation toggle, **StaleBanner**,
**UpdateBanner** (respects no-egress: zero outbound calls when enabled, version
check + banner included), and the **Ask panel** (P-6: SSE streaming, fact-pack
before answer, validated-before-display, ephemeral, privacy-mode label always
visible — D-067). The Detail toggle leaves the top bar but only Home branches on
it (D-040/D-066). The **first-run checklist** (D-045) replaces PersonaOnboarding.

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
D-078, plus P-1 and P-5. Concrete token values are **authored proposals** (§2),
authorized for this file and marked **PROPOSED — ratify at kitchen-sink review**;
values taken verbatim from the brief are marked **BRIEF**.

## Needs decision

- (none blocking) — token values are proposed working values pending the
  kitchen-sink ratification (§2.6). The only external dependency is confirming
  the UI/serif **font choice** (and whether self-hosting it warrants an ADR per
  CLAUDE.md); the fallback system stacks keep the system shippable meanwhile.

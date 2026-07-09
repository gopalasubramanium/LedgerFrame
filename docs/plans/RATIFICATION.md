# RATIFICATION.md — kitchen-sink sign-off checklist

**Purpose.** DESIGN-SYSTEM §2 marks every concrete token *value* as **PROPOSED —
ratify at kitchen-sink review**, and the component library was built before any
page (the brief). This checklist is the owner's sign-off surface: walk the
`/kitchen-sink` route with this file open, check each token group and each
component, and note any change. Nothing here is ratified until checked.

**How to review.** Run the frontend (`cd frontend && npm run dev`), open
`http://127.0.0.1:5173/#/kitchen-sink`. Use the control bar to switch
**theme / density / contrast / motion** and confirm each row below in both
themes and both densities. BRIEF-tagged values (the 12/13/14/16/20/28 type
sizes, tabular figures, the semantic-colour rules) are **fixed** and out of scope
for re-proposal.

Legend: `[ ]` = not reviewed · `[x]` = approved as proposed · annotate a line
with **CHANGE:** to request a different value.

---

## 1. Design tokens (DESIGN-SYSTEM §2 — all PROPOSED)

### 1.1 Colour palette — §2.1 (verify in BOTH themes)

Swatches are on the token board, each labeled with its token name.

- [ ] `--bg` (light `#f8fafc` / dark `#020617`)
- [ ] `--surface` (`#ffffff` / `#0f172a`)
- [ ] `--surface-raised` (`#f1f5f9` / `#1e293b`)
- [ ] `--border` (`#e2e8f0` / `#1e293b`)
- [ ] `--border-strong` (`#cbd5e1` / `#334155`)
- [ ] `--text-primary` (`#0f172a` / `#f1f5f9`)
- [ ] `--text-secondary` (`#475569` / `#94a3b8`)
- [ ] `--text-tertiary` (`#94a3b8` / `#64748b`)
- [ ] `--accent` (`#2563eb` / `#60a5fa`)
- [ ] `--accent-contrast` (`#ffffff` / `#0f172a`)
- [ ] `--gain` (`#15803d` / `#4ade80`)
- [ ] `--loss` (`#b91c1c` / `#f87171`)
- [ ] `--attention` (`#b45309` / `#fbbf24`)
- [ ] `--focus-ring` (`#2563eb` / `#60a5fa`)
- [ ] **WCAG AA** — all text/gain/loss/attention pairings pass on their surfaces (§7)

### 1.2 Typography — §2.2 (roles/weights/line-heights + families PROPOSED)

- [ ] Type roles + line-heights: 28/34, 20/28, 16/24, 14/20, 13/18, 12/16
- [ ] Weights: 400 regular · 500 medium · 600 semibold
- [ ] UI family — Inter (fallback stack shipping now; self-hosting needs an ADR)
- [ ] Serif family — Source Serif 4 (fallback stack; report headers)
- [ ] Tabular figures align (proof column on the boot screen + throughout)

### 1.3 Spacing scale — §2.3

- [ ] 4-pixel grid: `--space-1`=2 … `--space-12`=64 (board bars labeled)

### 1.4 Radius / border / elevation — §2.4

- [ ] `--radius-sm` 4 · `--radius-md` 6 · `--radius-lg` 10
- [ ] Border width 1 (thin rules); focus width/offset 2/2
- [ ] `--shadow-1` (popovers/menus only; cards use a border, not a shadow)

### 1.5 Density — §2.5

- [ ] comfortable: row 44, cell pad-Y 12 (`--space-4`)
- [ ] compact: row 32, cell pad-Y 8 (`--space-3`)

### 1.6 Accessibility axes — §7 / D-078

- [ ] Reduced motion halts the ticker + transitions (setting **and** OS pref)
- [ ] High contrast boosts border/secondary-text legibility (both themes)

---

## 2. Components (DESIGN-SYSTEM §5 — built before any page)

Confirm each renders correctly across states, densities, and themes on
`/kitchen-sink`.

### 2.1 Inputs (§5.1)

- [ ] **MoneyInput** — currency-aware, 2dp tabular, disabled/negative/large states
- [ ] **QuantityInput** — high-precision, right-aligned tabular
- [ ] **PercentInput** — 2dp, trailing %
- [ ] **DateInput** — ISO yyyy-mm-dd
- [ ] **InstrumentPicker** — typeahead + **explicit** create path (no silent auto-create)
- [ ] **MasterSelect** — options from the master registry; create only on extensible masters
- [ ] **Select** *(supporting primitive — see §3)* — view-scope select (source)

### 2.2 Data display (§5.2)

- [ ] **DataTable** — sort (aria-sort), filter, server-side export, sticky header, density, negative cells, empty/loading/error
- [ ] **TrendStat** — gain/loss/flat delta with sign glyph; sparkline; provenance slot; "—" no-data
- [ ] **AllocationDonut** — by class; by sector with the "Not sector-classified" bucket (D-082)
- [ ] **PriceChart** — line + benchmark; candles + MA/BB/RSI (house SVG)
- [ ] **Treemap** — squarified, semantic tone (house SVG; ECharts escape hatch untaken)
- [ ] **QuoteCardRow** — compact cards + source select (D-046)
- [ ] **TickerStrip** — Home Full only; halts under reduced motion (D-047)
- [ ] **Sparkline** *(supporting; used by TrendStat)*

### 2.3 Provenance & status (§5.3)

- [ ] **ProvenanceBadge** — source · freshness · confidence, identical across states (Fresh/EOD/Stale/Manual/Unavailable)
- [ ] **StalenessChip** — amber, flags (never hides); renders nothing when fresh

### 2.4 Structure & chrome (§5.4)

- [ ] **PageHeader** — title/subtitle/actions
- [ ] **EmptyState** — always shows a reason (Product Guarantee 3)
- [ ] **ReviewCard** — verdicts + attention + link; adds no figure Review lacks (P-1)
- [ ] **GlossaryTerm** — popover; term spelling matches GLOSSARY

---

## 3. Open interpretations to confirm (surfaced during the build)

Two points were under-specified and resolved provisionally; the review should
confirm or redirect them (also in `design-system-build.md` / CURRENT.md).

- [ ] **Segment/category chart palette** — §4 mandates "slate ramp + accent" but
  §2.1 defines no explicit categorical palette. Provisional: 5 tones derived
  from `--accent` + a slate lightness ramp (`--text-secondary`,
  `--border-strong`, `--text-tertiary`, `--text-primary`), cycling beyond 5.
  Confirm distinguishability + AA, or specify an explicit categorical palette.
- [ ] **Generic `Select` primitive** — §5 names only MasterSelect; §6 bans raw
  `<select>`; D-046 needs a source **select** (a view scope, not a data
  vocabulary). Provisional: a thin `ui/Select` for view-scope controls. Confirm
  this is the intended home vs. folding into MasterSelect.

---

## Sign-off

- [ ] All token groups reviewed (§1)
- [ ] All components reviewed (§2)
- [ ] Both open interpretations resolved (§3)
- [ ] Any **CHANGE:** notes captured back into DESIGN-SYSTEM.md (values) or the
      relevant component, and the PROPOSED markers cleared for what was approved

**Ratified by:** ____________________  **Date:** ____________

Once ratified, drop the **PROPOSED** markers in DESIGN-SYSTEM §2 for the approved
values and record the sign-off in CURRENT.md.

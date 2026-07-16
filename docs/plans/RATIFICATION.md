# RATIFICATION.md — kitchen-sink sign-off checklist

**Status: RATIFIED 2026-07-10** — approved with three amendments (now applied).
DESIGN-SYSTEM §2 markers flipped PROPOSED → ratified; amended values marked
"ratified (amended at kitchen-sink review) 2026-07-10". This file is the record.

**How it was reviewed.** The component library was built before any page (the
brief) and reviewed visually at `/kitchen-sink` across both themes, both
densities, and the contrast/motion axes. Amended values were re-verified after
the change (see §4–§5).

Legend: `[x]` = approved. Amendments are recorded in §4.

---

## 1. Design tokens (DESIGN-SYSTEM §2) — RATIFIED

### 1.1 Colour palette — §2.1 (both themes)

- [x] `--bg` · `--surface` · `--surface-raised` · `--border` · `--border-strong`
- [x] `--text-primary` · `--text-secondary` · `--text-tertiary`
- [x] `--accent` — **amended** (see §4.1)
- [x] `--accent-contrast`
- [x] `--gain` — **amended, light only** (see §4.2)
- [x] `--loss` · `--attention`
- [x] `--focus-ring` (tracks `--accent`; contrast re-verified)
- [x] `--treemap-base` — **new, amended** (see §4.3)
- [x] **WCAG AA** — all pairings pass on their surfaces, both themes (§5)

### 1.2 Typography — §2.2

- [x] Type roles + line-heights: 28/34, 20/28, 16/24, 14/20, 13/18, 12/16
- [x] Weights: 400 / 500 / 600
- [x] UI family — Inter (ratified as the fallback stack; self-hosting = future ADR)
- [x] Serif family — Source Serif 4 (fallback stack)
- [x] Tabular figures align

### 1.3 Spacing scale — §2.3
- [x] 4-pixel grid `--space-1`=2 … `--space-12`=64

### 1.4 Radius / border / elevation — §2.4
- [x] `--radius-sm/md/lg` 4/6/10 · border 1 · focus 2/2 · `--shadow-1`

### 1.5 Density — §2.5
- [x] comfortable 44 / pad 12 · compact 32 / pad 8

### 1.6 Accessibility axes — §7 / D-078
- [x] Reduced motion halts ticker + transitions (setting **and** OS pref)
- [x] High contrast boosts border/secondary-text legibility (both themes)

---

## 2. Components (DESIGN-SYSTEM §5) — RATIFIED

### 2.1 Inputs (§5.1)
- [x] MoneyInput · QuantityInput · PercentInput · DateInput
- [x] InstrumentPicker (explicit create; no silent auto-create)
- [x] MasterSelect (options from the master registry; create only on extensible)
- [x] Select (supporting primitive — §3, ratified)

### 2.2 Data display (§5.2)
- [x] DataTable (sort/aria-sort, filter, server-side export, sticky, density, negatives, empty/loading/error)
- [x] TrendStat · Sparkline
- [x] AllocationDonut (incl. "Not sector-classified" bucket, D-082)
- [x] PriceChart (line+benchmark; candles+MA/BB/RSI)
- [x] Treemap — **amended: magnitude scale** (see §4.3)
- [x] QuoteCardRow · TickerStrip (Home Full only; halts on reduced motion)

### 2.3 Provenance & status (§5.3)
- [x] ProvenanceBadge (Fresh/EOD/Stale/Manual/Unavailable, identical layout)
- [x] StalenessChip (amber; flags, never hides; nothing when fresh)

### 2.4 Structure & chrome (§5.4)
- [x] PageHeader · EmptyState (always a reason) · ReviewCard (P-1) · GlossaryTerm

---

## 3. Open interpretations — RESOLVED

- [x] **Segment/category chart palette** — **ratified as implemented**: 5 tones
  from `--accent` + a slate lightness ramp (`--text-secondary`,
  `--border-strong`, `--text-tertiary`, `--text-primary`), cycling beyond 5.
- [x] **Generic `Select` primitive** — **ratified as implemented**: `ui/Select`
  is the home for non-master view-scope selects (e.g. QuoteCardRow source);
  MasterSelect stays bound to MASTER-DATA vocabularies.

---

## 4. Amendments (applied 2026-07-10)

### 4.1 Accent — cobalt → deeper slate-tinged navy
- **Change:** light `--accent` `#2563eb` → **`#24476f`** (HSL 221,83%,53% →
  212,51%,29%); dark `#60a5fa` → **`#6f9fd4`** (HSL 213,94%,68% → 211,54%,63%).
  `--focus-ring` tracks it in both themes.
- **Rationale:** an institutional register distinct from a generic cobalt SaaS
  blue — deeper, slate-desaturated, "distinctly ours" (DESIGN-BRIEF: private-bank
  register, not default shadcn).
- **Verification:** link/primary-action contrast **9.52:1** (light) / **6.45:1**
  (dark); white-on-accent and dark-on-accent button text both ≥6.4:1; focus ring
  ≥3:1 on all surfaces. WCAG AA pass.

### 4.2 Gain (light theme only) — desaturate ~15%
- **Change:** light `--gain` `#15803d` → **`#1e763e`** (HSL 142,72%,29% →
  142,59%,29%; hue + lightness preserved, saturation −13pp). **Dark unchanged**
  (`#4ade80`).
- **Rationale:** eliminate neon-green bleed on light backgrounds while keeping
  the gain hue and readability.
- **Verification:** contrast on `--surface` **5.65:1**, on `--bg` **5.40:1** —
  WCAG AA pass for small text (≥4.5:1).

### 4.3 Treemap fill intensity — continuous magnitude scale
- **Change:** flat full-saturation gain/loss fills → a continuous scale where
  **fill intensity encodes day-move magnitude**. New token `--treemap-base`
  (`#f1f5f9` / `#1e293b`) is the neutral mix endpoint; the component supplies a
  data-driven intensity ratio and CSS `color-mix` blends `--gain`/`--loss` toward
  the base. Near-0% → soft muted tint (floor 15%); **≥5% → full intensity**.
- **Rationale:** a heatmap should read magnitude at a glance, not just direction.
- **Implementation note:** all colour stays in the token layer; the component
  passes only `--fill-intensity` (a %). The drift check stays green (no literals).
- **Verification:** demonstrated on `/kitchen-sink` with a magnitude-scale legend
  (sample tiles at 0.5% / 2% / 5%+, both signs) plus the live heatmap showing
  Gold (+5.2%) at full intensity vs VWRA (+0.4%) as a soft tint.

---

## 5. Owner device verification (logged 2026-07-10)

- [x] **320px viewport — QuoteCardRow badges** render correctly (symbol +
  StalenessChip wrap without clipping; cards scroll horizontally).
- [x] **LAN mobile rendering** — the app renders correctly on a phone over LAN
  (responsive layout, phone → wall-kiosk).
- [x] **WCAG AA, both themes** — palette pairings and the three amended values
  verified to pass AA in light and dark.

---

## Sign-off

- [x] All token groups reviewed (§1)
- [x] All components reviewed (§2)
- [x] Both open interpretations resolved (§3)
- [x] Three amendments applied + re-verified (§4) and folded into DESIGN-SYSTEM §2
- [x] Owner device verification logged (§5)

**Ratified by:** Owner (kitchen-sink review)   **Date:** 2026-07-10

DESIGN-SYSTEM §2 PROPOSED markers are cleared; amended values carry "ratified
(amended at kitchen-sink review) 2026-07-10".

---

## 6. Page closes — central acceptance log

**Convention (from Insurance onward):** every **page close** (owner acceptance of a
page-build milestone) is logged **centrally here** — one row per page — so the
acceptance record has a single home instead of living only in each plan file. Each
row cites the plan file whose §-retrospective carries the full record; this log is
the index, not the record. Pages accepted before Insurance stay recorded in their
own plan files (not back-filled).

| Page | Accepted | Owner | Full record | Platform items ratified at the close |
|------|----------|-------|-------------|--------------------------------------|
| **Insurance** (`/insurance`) | 2026-07-16 | Owner (live walk, batches 1–2) | `page-insurance.md` §14–§15 | **Page inset** — one shell-owned standard (DESIGN-SYSTEM §3.1); **Instrument Detail full-width** as its detail-page consequence (a ruling, not a drift). **Base-currency affix** retrofitted platform-wide (DESIGN-SYSTEM §5.2, one form). **Review headline == Net worth to the cent** (removed the whole-dollar `round`, D-105). **Annual-premium single-derivation** (§14in-2). GLOSSARY: Cover · Cover amount · Premium · Premium frequency · Nominee · Insured person · Renewal. R-36 parked (premiums → Cash flow). |
| **Estate** (`/estate`) | 2026-07-16 | Owner (live walk, one finding) | `page-estate.md` §12–§14 | **Button anatomy** — a labelled action `Button` carries its action's lucide icon + text (Plus add / Pencil edit; icon decorative `aria-hidden`, text is the accessible name) — one standard (DESIGN-SYSTEM §5.4, RATIFIED at §14es-1). **§14es-1**: the profile Edit button → Pencil + "Edit", fixed to the standard (guard RED→GREEN, `Estate.test.tsx`). GLOSSARY (RATIFIED): Will · Will status · Executor · Beneficiary · Guardian · Emergency contact · Readiness. **`will_status:none` → "Not recorded"** served-label override (MASTER-DATA §2, §12es-3). Readiness strip **COUNTS-only, no `will_status` tile** (§12es-1); **no money on the page** (§9-3, chosen N/A). `relationship` **fold-then-drop** migration (§9-5 + Amendment E). |

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
| **Reports** (`/reports`) | 2026-07-17 | Owner (live walk, batch 1; exports opened in LibreOffice + Excel) | `page-reports.md` §14–§15 | **Export artifacts — one honesty standard** (DESIGN-SYSTEM §5.1, RATIFIED at §14rp-2/§14rp-3): **titles human, data machine, disclaimers always, utf-8-sig always**, enforced by `_csv_response` (BOM) + same-batch code tests. **§14rp-1**: an export **mirrors its section** — statements.csv gains the Realised (year-scoped) + Unrealised (explicit **as-of**) stat block; realised stays **one derivation** (§12rp-3), rendered in two files. **§14rp-2**: the four CSVs' headers → human titles (data cells stay machine numerics — D-105 is a rendered-UI rule, not a data-artifact rule). **§14rp-3**: **encoding is honesty** — all seven CSV endpoints ship `utf-8-sig` so Excel stops garbling the em dash; the **byte-level BOM guard** is the mechanism (TEMPLATE §7). GLOSSARY (RATIFIED): **Report**. **§12rp-1** control-group placement ratified as shipped. **Amendment-I declined-exports ledger stays PENDING** (closes at the Reports Pack milestone, not here). Contract 131 paths (tax-lots.csv add, Phase 0). |
| **Reports Pack** (`/reports/pack`) — *artifact, not an IA page (D-038)* | 2026-07-17 | Owner (live walk: on-screen artifact + print PDF, batch 1) | `reports-pack.md` §12–§15 | **The one sanctioned print/export artifact** — a backend-composed self-contained HTML doc (no app JS, inline CSS) composed from the canonical readers, disclaimers preserved. **Print palette + `@media print` geometry RATIFIED BY LOOKING** (DESIGN-SYSTEM §5.1a — light bg/dark text, gain/loss as a sign-carried enhancement, break-before per section, running header). **§12pk-1** served /refdata labels not raw keys (`refdata.label_for`); **§12pk-2** running header suppressed on page 1 (masked; §5.1a convention); **§12pk-3** single-card sections one heading; **§12pk-4** seed get-or-creates Household (3 entities on both boot paths). **§14pk-1** entry point → the §5.4 **primary Button** (Reports-ONLY, D-041); **§14pk-2** Review rows render served item text; **§14pk-3** one consistent realised period stated in the heading. GLOSSARY (RATIFIED): **Consolidated · Per-entity**. **THE AMENDMENT-I DECLINED-EXPORTS LEDGER FLIPPED PENDING → DELIVERED** (all five: Policy drift · Net worth trend · Review · Scenarios · Cash flow) — the oldest open debt in the rebuild closes. Contract 132 paths (Phase 0 route add). |
| **Accounts** (`/accounts`) | 2026-07-16 | Owner (live re-walk, batch 1 + re-walk) | `page-accounts.md` §14–§15 | **First DB-backed extensible master + merge** (Institution, D-008; `String`→FK **fold-then-drop** across BOTH `accounts.institution` **and** `insurance_policy.insurer`, Amendment F). **MasterSelect data source → DB-backed master** (an `options` prop; DESIGN-SYSTEM §5.1 clarification, **no new component**, RATIFIED at the §12 gate). **Cross-page affordance guarded as a JOURNEY** (§14ac-2, the journey-guard RED proof; TEMPLATE §7). **Table specimen must render the row's IDENTITY column** (§14ac-1 Name-column gate miss; TEMPLATE §7). **Entity CRUD** + `entity_kind` graduated to `/refdata` (Amendment H); **cost-basis method writable + restatement** (D-018, §9-5 wording RATIFIED AS SHIPPED); **account-scoped Holdings + Transactions** (`?account_id=`, one shared URL builder, Amendment G). GLOSSARY (RATIFIED): Cost-basis method · Account kind · Rollup · Merge; **`fifo` → "FIFO"** served-label override. Subtitle rewrite RATIFIED AS SHIPPED (§14ac-6). **P-4 brand mark "the double rule"** shipped (BrandMark + sidebar lockup + favicon; DESIGN-SYSTEM §5.6, PROPOSED — owner ratifies from the close-out screenshots). R-35 (per-entity/institution filtered views) parked with a scope sketch. |
| **Settings** (`/settings`) | 2026-07-18 | Owner (live walk + two re-walks, batches 1–2) | `page-settings.md` §14 (CLOSED) + §15 | **SIX tabs** — General · Appearance · Privacy · Data feeds · AI · System (**D-069 amendments #1 Data feeds §14st-1 + #2 AI §14st-2**; IA-arrangement rulings absorbed cheaply while in-flight — §15 lesson (a)). **§5.4 DANGER `ButtonVariant` RATIFIED** (Reset data; `--loss-contrast`). **D-078 write-only reconciliation** — seven keys removed (three rotation + contrast/motion + refresh/sleep), `long_term_days` added; each pinned by served-value / unknown-key-400 tests (allow-list changes invisible to contract regen — the `home_layout` pattern). **PARAM-WINS + one resolution helper** (`tax.resolve_long_term_days`, Amendment A). GLOSSARY (RATIFIED): Density · API token · Privacy mode · Data provider · High contrast · Reduced motion (Appearance/Rotation/AI/Data feeds are plain UI labels — no entries). **"AI, not AI & Voice"** dead-affordance rule (§15 lesson (b)); **PIN-mutating smoke never run without a restore path** (§15 lesson (c)). **No backend change after Phase 0/1** (git diff app/ empty across both walk batches). **R-37 (rotation engine)**, **R-38 (provider routing matrix — ACTIVATED next)**, **R-39 (chrome-sidebar-refresh — final pre-release, §14st-3)** parked; **RD-9 Amendment 4** enumerates the v2.0.0 set + moves Voice (R-32) post-release. |
| **data-feed-routing (R-38)** — *feature/platform milestone, not an IA page* | 2026-07-18 | Owner (batch-9 report basis; **owner walk DEFERRED to pre-release by dated ruling** — §14 ruling 1c) | `data-feed-routing.md` §14 (**CLOSED, 29 findings / 9 batches**) + §15 | **`routing_matrix` model + `route()` slot 3.5 AMENDMENT-A prepend semantics** (a cell can never price *less* than today; on failure/degradation resolution continues the step-4 chain; `route_rule=matrix` only when the cell actually priced). **Flag-2 capability validation** — the resolve-time gate is CAPABILITY (live-capable + keyed), NOT chain-membership (§12). **Option-B migration** — active provider stays a separate env-rooted terminal fallback; **empty matrix = byte-identical to today** (PARAM-WINS). **Settings → Data feeds editor** (`DataTable` + `MasterSelect` cell + `StatusChip` + `Button`, §9-9 — NO §5 amendment). **Pricing Health provenance chips + MetaStrip** (read-only `route_rule` override/matrix/lane/active; `av_tier` honest string — D-072 INTACT). **D-072 annotated (STANDS)**; **R-13 affirmed parked** (different shape). GLOSSARY (RATIFIED): **Routing matrix** (spec-first + parity guard). **Metadata-derived reset scope + `RESET_KEEP_TABLES` KEEP-drift guard** (dr-26). **Auto-link flows coingecko/amfi** at create + correction (dr-27). **§26-bis both-postures re-run rule** (a real-data-render finding is not closable mock-forced). **dr-23 purge label "Confirmed" RATIFIED**; **dr-25 RESOLVED-WITH-CARRYOVER** (chart sign-off rides R-42 + the pre-release walk). Contract **134 path-keys** (Flag 1). |

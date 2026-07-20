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
| **intraday-series (R-42)** — *feature/platform milestone, not an IA page* | 2026-07-18 | Owner (0a specimen **ratified by looking**; **3b walk on the live instance**; **§14dr-25 carryover FULLY ACCEPTED**) | `intraday-series.md` (walk ledger **CLOSED, 3 findings / 1 batch**) + §15 strike-check | **Interval-dimensioned `price_history` under the structural daily/intraday partition** (no new table, no migration; the comb-impossible pins — `test_intraday_storage.py`). **`intraday_availability()` — a single server-side decision** (dr-7 D-105 gap closed: served, tier-keyed disable reasons — free/unknown · mutual-fund NAV · provider-incapable · no-egress). **Range-button JIT fetch trigger + 12h `hist_fetched` idempotency** (never re-spends). **`extended_hours=false` + one-time purge** of stored extended-hours rows (W-3; the exact-param pin). **W-1 quote-currency valuation** — market value derives from `quote.currency`, ranked above the drifted holding currency, + the **honest fx-unavailable state** (silent 1.0 killed — W-1b). **W-2 currency reconciliation** in `recognise_amfi_fund` + the D1-b repair (legacy `currency` field healed to INR). **Pan-when-zoomed** on `PriceChart`; **period-carryover fallback** (a served-disabled range falls back to the default daily range); **dr-8 loading treatment**; **mock 1-min/5-min cadence alignment**; **demo generates intraday**. GLOSSARY (RATIFIED): **Intraday · Interval** (spec-first + parity guard). **§9-1 forever-retention (no silent prune)** → R-47 filed; **§9-5 benchmark daily-range-only** → R-48 filed; **§9-6 active-provider-only intraday** → R-49 filed. **Cost-currency (SGD cost vs INR NAV) folded into R-43** (trade-date cost-basis FX). Contract steady at **134 path-keys** (no shape changed after Phase 0). |
| **historical-backfill (R-43)** — *feature/platform milestone, not an IA page* | 2026-07-19 | Owner (**walk-driven acceptance**, in chat — the 0a specimen and the 3b walk merged into ONE findings cycle, F-1..F-9, driven on the **live instance**) | `r43-historical-backfill.md` (walk ledger **CLOSED — 8 numbered findings, F-1..F-4 + F-6..F-9; no F-5 was ever assigned; 14 defects counting the lettered sub-findings**) + §23 (§15 strike-check) | **Date-aware valuation engine** — `value_portfolio(as_of=…)` as the ONE derivation, with the **byte-identical `as_of=None` pin** (`test_backfill.py:185`) proving consolidation smuggled in no behaviour change; the drifted valuation forks were **deleted**, not added to (▲-B). **Performance / TWR consolidation** onto that engine. **Per-date ECB FX store** (`ecb_fx_history`) — **zip ingest + integrity + the carry-forward convention** (the legacy CSV URL is no longer fetched: ECB's own edge served a stale-corrupt object, **F-4**). **Trade-date cost basis via stored `fx_base` + LOUD exclusions** — a lot that cannot be converted is excluded *visibly*, never silently zeroed into a headline P/L (**F-3**). **Daily backfill orchestrator** — provenance column, **idempotent, resumable, coverage preflight** (**F-1**). **Class-capability acquisition with ONE-linker id resolution** — acquisition routes by class capability, **never** the quotes-lane override; ids resolve through `_identifier` alone (**F-6/F-7**). **Honest per-instrument acquisition outcomes** (`instrument_acquisitions`: ok/rows/source/reason on every instrument, every run — "it failed but nothing anywhere says so" is unreachable, **F-8**). **Refuse-until-coverage perf metrics with basis labels** (**F-2** — one card may never mix two valuation bases). **Honest refresh reporting** (attempted/succeeded/skipped/stale; counting cache reads as refreshes is a lie with a progress bar, **F-7b**). **Chain keyed/unkeyed presentation — §5 amendment RATIFIED on the owner's screenshots.** **StatusChip `muted` prop.** **Ingest integrity as a standing discipline** (`ingest_guard`: freshness + sanity on EVERY ingest, writing nothing on refusal) — the milestone's hardest-won lesson is that **provenance is not integrity**: the genuine authoritative source served bad data **twice** (ECB's edge, AMFI's portal page), and both real payloads are permanent RED specimens. **F-8c**: a migration may never disable the application's logging — the reason F-8a ran unseen for weeks. **Filed at close: R-50** (AMFI whole-market-download-per-window → cached window store / per-scheme source) **POST-RELEASE** by architect ruling under standing delegation. **Open, recorded, ruling owed: §21-3** (a `TimeoutError` still escapes the AMFI chunk loop). Pre-release walk gains **10d–10g**, including **§20-P `LEDGERFRAME_SECRET_KEY` as a Gate-C blocker-before-exposure**. Contract **138 path-keys** (shape settled at Phase 0, unmoved since). |
| **Help** (`/help`) + **Settings → About** | 2026-07-19 | Owner (3b look ACCEPTED incl. voice; About SIGNED OFF at §9-bis-14, re-look waived) | `page-help.md` §9/§9-bis (**CLOSED**) + §16 strike-check | **THE HELP PAGE, REBUILT** — a three-section journey (Orientation → Pages → Glossary, §9-bis-1) after the 0a specimen was REJECTED; **type-ahead search** (§9-bis-4); **deep links that land** (`?topic=`, HashRouter — the accordion's open state is URL-driven, which is why `<details>` is forbidden). **THE KNOWLEDGE BASE WAS REWRITTEN** — the v1-era entries were **factually wrong** (they described "Snapshot", "Planning", a removed Simple/Expert toggle, four Settings tabs where seven ship) and `app/ai/tools.py:145` feeds them to the AI as **grounded fact**; AI-surfaces' grounding review must read the NEW content. **CONSTRAINED SERVED MARKUP MODEL** (§9-bis-9(b)) — a minimal sanctioned subset, no freeform HTML in either direction, rendered through DS typography tokens, with **accuracy guards running on MARKUP-STRIPPED text** so formatting can never hide a claim from the guard that would have caught it. **THE HELP CURRENCY LAW** (owner, CLAUDE.md hard rule + TEMPLATE §8) — *Help is live documentation: any platform change updates Help in the same milestone, unsaid*; every close now states a Help delta or a **guard-corroborated** "no Help impact", and the **HELP CURRENCY SUITE** is named so it can be run rather than remembered. **DS §5 — the five HELP patterns RATIFIED** (Content Accordion · Topic CardGrid · type-ahead results · reveal-on-hover Link · ILLUSTRATIVE SAMPLE chip), each with its implementation note as **part of** the ratification. **DS §5 — the five ABOUT patterns RATIFIED** (pull-quote · social-icon row · brand-lockup size variant · beat heading + ✦ ornament · **semantic-icon treatment** — lucide removed brand glyphs, so meaning lives in the accessible name; true brand marks only via a future ADR; `Heart` stands). **DS §3 STANDING RULE — prose is FULL-WIDTH RESPONSIVE by default**, a fixed measure only where explicitly ratified per surface (the 78ch cap retired at §9-bis-9(b) came back as 62ch on About three days later; a measure cap is invisible to every guard the project runs). **About is the 7th Settings tab** (D-069 amendment #3, reversing the card-in-System ruling), rebuilt on a **four-beat narrative template** whose original wording was **VETOED ON ACCURACY** — it described a trading product — establishing that **About meets the same truth bar as Help content**, now pinned by a test. **First vendored redistributed asset** (`author-gs.jpg`, EXIF-stripped, never fetched at runtime) with `docs/audit/ASSETS.md` created for it; **licence ruled by the owner**: *© Gopala Subramanium, all rights reserved … not covered by the AGPL licence of the code* — carved out of the AGPL grant. ⚠ **THE ISOLATION NEAR-MISS**: `SMOKE_BASE` redirects only the browser, so an "isolated" pre-pass wrote to the owner's LIVE database and was saved only by his PIN lock answering 401 — **luck, not design**; 3 specs fixed, **18 OPEN** in `08-TECH-DEBT.md`, harness must **fail closed**. **UNDEFINED-TOKEN CLASS CLOSED** — 23 references to non-existent custom properties (incl. three `outline` shorthands that left Help with **no keyboard focus ring**), now guarded source-level (`check-design-tokens` Check 2) **and** by computed style in a real browser. **Policy duplicate band/concentration block removed.** Contract **138 path-keys / 63 schemas** (unchanged). **R-51 Tier-3 glossary visibility** (71 marked / 29 served / 58 unserved) non-blocking, post-release. |
| **Legal** (`/legal`) + the **acceptance gate** | 2026-07-20 | Owner (**ratified by looking**, in chat — the 0a specimen revised on five rulings, then the **re-look** accepted with all six items named; §3b accepted in the same message) | `page-legal.md` §11 (banner) · §12 walk ledger (**CLOSED, 0 findings**) · §13 (pre-pass 54/54) · §14 (close) · §15 (**11 lessons, each with what turns red**) | **THE RENAME: "Product Guarantees" → PRODUCT COMMITMENTS** — *"guarantee" is warranty-family vocabulary and the AGPL §15 position is NO WARRANTY*, so the page contradicted itself in its own vocabulary; the seven are **self-enforced behavioural commitments, tested**. GLOSSARY-first, then served strings, then corpora; **internal specs keep "Guarantee" as history** (§11-G, NO SWEEP — history is not rewritten). **THE ACCEPTANCE GATE, SERVER-SIDE** (§11-E1) — an unaccepted install answers **451 on every `/api/v1` read**, including for API tokens (*a token is not a second party who can be exempt from the terms*); the enforcement runs **BEFORE the PIN check**, because the other order leaves every fresh install wide open. It is a **CONSENT boundary, never an authentication one — SECURITY-BASELINE §20-P is UNCHANGED**, annotated so no later reader mistakes it. **Append-only event record** binding each answer to the **sha256 of the served document**; three states, not two (**`accepted` / `stale` / `none`** — a returning user whose document changed is told so, not greeted as a stranger). **RESET ERASES ACCEPTANCE** (§11-D3/§11-E2a — the inversion of an earlier test): the gate binds **the person, not the machine**, and a preserved record after a reset would be the *previous* user's — a false record of consent. **DECLINE IS A REAL ANSWER**, recorded, install stays locked. **/legal READABLE WITHOUT ACCEPTING** — a gate demanding agreement to a text it will not show asks for consent it has made impossible to inform. **THE FORMAL REGISTER** (§11-D) — numbered clauses **derived from POSITION, never typed**, defined-term capitals, 9-5-bis **convenience links** (marked, `noreferrer noopener`, never load-bearing: the page must stay true with every link dead). **PRODUCT-SPEC §3 CLEANED and AC-L3 now runs UNEXEMPTED** (§11-C — the self-measuring exemption deleted). **§9-7 MECHANISED** (§11-E3) — the licence-spelling guard, **RED on a real defect in the very next surface built under the un-guarded ruling**; amended to a **NAMED allow-list** of official titles after the free-form alternative was *measured* letting `Widget Foundation Public License` escape (§11-F), now a permanent RED specimen. **DS §5 (all RATIFIED 2026-07-20):** **Checkbox** — the only sanctioned checkbox, wrapping the native element, extracted after the gate was found hand-rolling one; **Legal formal-document typography** — page-scoped and **registered as an exception rather than promoted** (*a library pattern with one legitimate caller is one the next page will misuse*); **reading-return bar** — and its two strings **SERVED** (§11-K, architect ruling): *"nothing has been accepted yet"* is a claim about the acceptance record, and **the scope of "served" is the PATH, not the panel**. **`npm run check:primitives`** — the guard for a hard rule that had stood in CLAUDE.md since the design-system milestone and was enforced by **nobody**; **the rule itself escalated INTO CLAUDE.md** at this close (*ask of every hard rule: what turns red?*). **HELP CURRENCY**: Legal's entry + the gate/lock/reset truth, **atomic with `built:true`**; suite **313/15**. Contract **141 paths / 71 schemas**. Backend **1822 solo, ordered AND randomized**; pre-pass **54/54** on an isolated instance, where the PIN-less, PIN-protected and post-reset gates proved **byte-identical** — consent-before-PIN and reset-to-first-run-posture holding at once. **Carried to pre-release backlog:** 10-D item 4 (prose rhythm — a `HelpProse` question) and the §9-7 guard's **spec-scope gap** (clean by measurement, not by guard). |
| **AI-surfaces (D-067 / D-068)** — *feature/platform milestone, not an IA page* | 2026-07-20 | Owner (**ratified by looking**, in chat — the 0a specimen walked and re-driven twice, then the **3b walk ACCEPTED with all PROPOSED strings ratified** and **two walk fixes ruled**) | `ai-surfaces.md` §17 (the 3b walk rulings) · §18 (**§-LEDGER CLOSED — F1–F10 + two walk fixes, every disposition**) · §19 (**strike-check, 10 lessons, each with what turns red**) · §20 (Help currency) · §21 (changed files) | **THE ASK PANEL SHIPPED (D-067)** — composed entirely from ratified primitives, **no new component**. The first prose in this product **written by a model**, and with it the first distinction it had to draw **visually** rather than in copy. **THE PROVENANCE LEGEND** (§15-4, the walk's centrepiece) — every answer carries a **served** line saying **who wrote the sentence**, in three states, with model prose in **italic**. ⚠ **Its first implementation was a LIE and the guard caught it**: reading the kind from `resolve_posture()` labelled a model-narrated answer *"no model was used"* — the exact failure §14-4 exists to prevent, by the exact route its own docstring warned about, **in the same hour it was written**. The kind now comes from **the provider that emitted the tokens**; removing the configured read made the legend **truer and the stream lighter at once**. **AN UNDECLARED PROVIDER IS TREATED AS EXTERNAL** — when the answer is unknown, take the error that cannot mislead about egress. **DS §5 MODEL-TEXT AMENDMENT RATIFIED** — italic, **semantic not decorative**, on a `getComputedStyle` **measurement** in both directions and both themes, because *"the italics look right"* is what a screenshot invites and cannot settle; slant **because colour is taken** (gain/loss, staleness, warning) and *a new semantic needs a free axis, not a prettier one*. **GLOSSARY: THE THREE KINDS OF INTELLIGENCE RATIFIED** — Built-in intelligence · On-device model (Ollama-compatible) · External model; **"hailo" retired user-facing** while surviving as an internal id so the owner's `.env` keeps working. **ONE RESOLVER** (`app/ai/vocabulary.py`) after the Settings tab was caught **naming a provider that was not the one answering** (Finding 6): `/system/ai-config` read the `.env` FILE while `/ai/grounding-status` read the EFFECTIVE settings — *two sources of truth for one fact is the whole defect*. **The tab's sentence is now SERVED**, not composed in the browser (§0-C). **ACCEPTANCE-GATED AI** — the 451 gate covers `/ai/chat`, **tested at those paths**, and the guarantee asserted as what it is: the panel cannot be **opened** and **the server refuses regardless** (a DOM-absence check would pass happily on a build whose server had stopped refusing). **ONE CANONICAL FACT PER FIGURE + NO RAW MONEY IN THE PACK** (F5) — and its lesson: **identity is DECLARED, never inferred from the value**, because *"no two facts render the same number"* would delete **Total assets** for a user with no liabilities. **§17-1 ONE LOCALITY STATEMENT AT EVERY MOMENT** — the posture line hands over to the legend; **D-067's "always visible" gains a dated reading note** (the rule is unchanged; what is settled is what satisfies it), and the *never-neither* arm is guarded hardest because the obvious reading of the ruling **would** breach D-067. **§17-2 A FIXED SENTENCE MAY NOT CITE UI THAT DOES NOT RENDER** — the stub claimed *"as of the timestamps listed there"* against fresh facts that render no chip; **our fixed sentences meet the same truth bar as served copy**, the rejected specimen kept verbatim and checked by the same function as the rule. **§17-3 `Income (div/int)` SANCTIONED GLOSSARY-FIRST**, parity both ways, **no app-wide rename** — *one sanctioned short form is a vocabulary; a tolerance for abbreviating is how a vocabulary stops being one*. **§17-4 THE TAB SAYS WHEN WRITING TO IT WOULD DO NOTHING** (F9) — a conditional served sentence, detected by **divergence, not presence**, because under systemd the `.env` file IS the `EnvironmentFile` and a presence check would warn **every correctly-configured install** that its saves do nothing. **TWO-TIER SEED**: the no-egress deterministic answering shipped here is **R-54 tier-1's seed**, not a separate thing to reconcile. ⚠ **THE MILESTONE'S OWN DEFECT CLASS, COMMITTED THREE TIMES BY ITS TOOLING**: a patch script that printed *"patched"* on a no-op; **three scaffolding-greens** (a guard whose happy path is optional is not a guard); and **camera-over-green THREE times** — twice at §16-F, then again at §17-6 where a **37/37 run produced three light screenshots labelled dark**, in the drive written to show §16-F had been learned. *Knowing a failure mode by name is not having a guard for it.* ⊕ **`make lint` was RED on HEAD** — an `I001` from §15-3 that the §16-E gate table never ran; *a gate table is only as honest as its most-forgotten row*. **HELP CURRENCY**: `term-income` made findable by the sanctioned short form — **caught by asking, not by a guard**, and the gap (*recorded ≠ findable*) carried to the pre-release backlog as §19-J. Backend **1963 solo, ordered AND randomized** (reconciled: 1951 + the 12 tests this close added); `npm run check` **PASS** (**408 vitest / 41 files · 361 Playwright**); currency **569/15**; contract **141 paths / 71 schemas**, unchanged. **⚑ Filed at close: F10** — the fresh-DB `get_history_cached` check-then-insert race (**three sites in one function**), **its own delta immediately after this close, BEFORE R-54, release-train blocking**; **R-54/R-55** (Amendment 7); **R-56** (F7, post-release). |

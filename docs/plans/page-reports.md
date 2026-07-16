# page-reports — Reports (`/reports`) build plan

**Status: DONE ✅ — page ACCEPTED (owner walk, 2026-07-17).** §9 RESOLVED (one-pass) · §12 GEOMETRY GATE
RATIFIED WITH CONDITIONS · Phases 0/0a/1/2/3a DONE · **§14 owner walk (batch 1, three findings)
FIXED + ACCEPTED (contingent on the batch, 2026-07-17)** · **§15 retrospective** written; lessons
mechanised. **Amendment-I declined-exports ledger stays PENDING** (it closes at the Pack milestone, not
here). See §9 (rulings), §11 (Phase-0 evidence), §12 (gate ruling), §13 (build record), **§14 (walk),
§15 (retrospective)**.

This plan is a *derivation from the specs*, not a fresh design. Every section cites the
spec it is copied from. Where the specs under-specify, the item is a **NEEDS DECISION**
(§9), surfaced to the owner **before** build — not improvised mid-build.

---

## PART 0 — P-5: the brand mark rides the MOBILE header too (SHIPPED, commit `c888000`)

**Not part of the Reports build — a platform fix batched with this planning session.** The
desktop sidebar carried the BrandMark lockup; the mobile top bar rendered a bare
"LedgerFrame" with no mark (owner walk 2026-07-17), because the shell had **two hand-built
lockups** and only one got the mark.

- **Fix at the standard:** ONE **`BrandLockup`** component (`frontend/src/components/ui/BrandLockup.tsx`)
  — BrandMark + wordmark at the ratified geometry/sizing (mark at the wordmark cap height,
  `aria-hidden` mark, wordmark the accessible name) — consumed by **BOTH** the sidebar brand
  row and the mobile header. `brand.css` moves the lockup geometry to a surface-agnostic
  `.lf-brandlockup*`; each host supplies its own padding/font (the wordmark inherits it), so
  the sidebar-density row-height math (page-chrome §13/P-3) is untouched.
- **Guard** (`frontend/e2e/mobile-brand.spec.ts`, in `npm run check`; MEDIA-QUERY / real-viewport
  territory — the mobile header shows only below the 900px D-102 breakpoint, which jsdom cannot
  evaluate): at **320 and 375, both themes** the mobile brand is visible, the `svg.lf-brandmark`
  is painted to the **left** of the wordmark, the mark is `aria-hidden`, the accessible name is
  "LedgerFrame". **Fail-first proven** — all four RED on the bare mobile header (`hasMark` false
  while `brandVisible` true), GREEN once both surfaces share `BrandLockup`.
- **Suites GREEN** — `npm run check` **EXIT 0** from `frontend/` (250 passed = vitest + all
  Playwright, incl. `AppShell.test.tsx`, `sidebar-density.spec.ts`, `overflow.spec.ts`,
  `mobile-brand.spec.ts`). **DESIGN-SYSTEM §5.6** gains the `BrandLockup` row + the one-lockup
  rule and flips **PROPOSED → RATIFIED**. Shell record delta: page-chrome §14.
- **Mobile-header screenshot:** `docs/plans/assets/p5-mobile-header.png` — renders
  `☰ · [double-rule mark] LedgerFrame · ⋯ · clock` at 375px.

---

**Governing rules (CLAUDE.md + ratified milestone) apply verbatim — see TEMPLATE-page-build.md.**
Reports is **read/export-only** (no user input mutates data), so the mutation-oriented rules
(request-body assertion, round-trip import, [S] writes) are recorded as **chosen absences**
below where they would otherwise apply.

---

## 1. IDENTITY

*Source: INFORMATION-ARCHITECTURE.md §2 (page map), §3 (nav); DESIGN-SYSTEM.md §3 (templates).*

| Field | Value | Spec ref |
|-------|-------|----------|
| Page name (H1 = nav label = route) | **Reports** | IA §2 (`INFORMATION-ARCHITECTURE.md:82`), D-022 |
| Route | `/reports` | `INFORMATION-ARCHITECTURE.md:82` |
| Nav group | **Reports** (group 5; **Reports listed before Pricing Health** within it) | `INFORMATION-ARCHITECTURE.md:104-111` (`:108`) |
| Page template | **Overview** (per the §3 mapping) — **⚑ see §9-6:** the TEMPLATE "Reports-group pages are worklist-shaped" note is Pricing-Health-specific, not Reports | `DESIGN-SYSTEM.md:227` (Overview list includes "…Reports"); Pricing Health is worklist `DESIGN-SYSTEM.md:229` |
| Rotation eligibility | Not a rotation page (Reports is a deliberately-visited records/export surface) | IA §3 (D-044) |
| One-line purpose | "Statements, Realised P/L report, tax lots; server-side exports." | IA §2 (`INFORMATION-ARCHITECTURE.md:82`) |

**The Reports Pack (`/reports/pack`) is NOT this page** — it is a **sanctioned artifact, not an
IA page** (`INFORMATION-ARCHITECTURE.md:92`, D-038), reachable **from Reports only** (D-041/D-061).
Its ownership block is quoted verbatim in §2; its rendering mechanism and scope are the
load-bearing §9 items.

---

## 2. OWNERSHIP TABLE

*Copied from INFORMATION-ARCHITECTURE.md §5 (per-page ownership, `:343-351`). Never re-derived.*

**Owns (canonical, authoritative, fully explained on this page)** — verbatim from `INFORMATION-ARCHITECTURE.md:343-351`:

> ### Reports (`/reports`) — D-060
> - **Owns:** statements (income / fees / cash flow / realised-vs-unrealised);
>   the **Realised P/L report** — headings per D-026, **both** realised totals
>   (current-FX caveated + trade-date-FX with excluded-events count); open tax
>   lots; exports **server-side** (P-5). `long_term_days` stays a **neutral
>   user-set threshold** (Product Guarantee 4). The "explain this report" AI
>   helper rides the **P-6 pipeline only** (D-060).
> - **Links:** Reports Pack (from Reports only, D-041/D-061).

**Summarises (other pages' info — via the named reader, linked, never recomputed):**

| Summary shown | Canonical page | Shared reader reused | Link target |
|---------------|----------------|----------------------|-------------|
| *(none)* — the IA ownership block for Reports has **no `Summarises` line** (`INFORMATION-ARCHITECTURE.md:343-351`); every figure Reports shows is a figure it **owns**. | — | — | — |

**Recorded absence (P-1):** Reports **owns** its statements / Realised P/L / tax-lots figures
outright — it is a canonical home, not a summariser. The one figure that is another page's
canonical output and appears in an **export** context is **return attribution** (Portfolio's
canonical reader, `page-portfolio §12-6b`) — see §9-13 for whether Reports links or re-homes it.

**Links to:**
- **Reports Pack** (`/reports/pack`) — from Reports **only** (D-041/D-061; `INFORMATION-ARCHITECTURE.md:344,92`).

**Enforcement corollary (P-1/D-031):** Reports adds no figure its readers do not already produce
— every number is a canonical-reader output rendered as the backend served it (no frontend money
math). The Pack **composes canonical readers, never re-derives** (`INFORMATION-ARCHITECTURE.md:355-358`,
D-061) — quoted in §10-4.

**The Reports Pack — verbatim ownership (`INFORMATION-ARCHITECTURE.md:353-358`, load-bearing, do not drift):**

> ### Reports Pack (`/reports/pack`) — D-038, D-061
> - **Nature:** the one sanctioned duplication — a print-optimised artifact, not an
>   IA page. Consolidated section (net-worth trend + review) then **per-entity
>   sections** (P-3): net worth, drift, realised, risk + attribution. Composed
>   **from canonical readers**, disclaimers preserved. Reachable from Reports only.

**The exception status (`INFORMATION-ARCHITECTURE.md:41-49`, verbatim):**

> **The Reports Pack exception (D-038, verbatim):**
> > **Reports Pack = the one sanctioned duplication**: a print/export artifact
> > composed from canonical readers, disclaimers preserved — not a page in the
> > IA sense.
> The Reports Pack is therefore excluded from the canonical-home discipline: it is
> an artifact assembled from the canonical readers, not a page that owns or
> re-derives anything (D-061).

---

## 3. API SURFACE

*Source: API-CONTRACT.json (frozen baseline) + API-CONTRACT.md delta table. Router:
`app/api/v1/routes/portfolio.py`; services: `app/services/`.*

### 3a. Endpoints consumed (already in the frozen contract)

All the report readers and their CSV exports **already exist** in the frozen baseline (copied
in Phase A, frozen Phase C). Verify-first confirms shapes from the reader code (§10).

| Method + path | Purpose on this page | Params | Response shape pinned? |
|---------------|----------------------|--------|------------------------|
| `GET /portfolio/statements` | Statements section (income / fees / cash flow / realised-vs-unrealised) | `year?`, `entity_id?` (`portfolio.py:1046-1054`) | Served dict `statements_report` (`statements.py:109-148`) — keys listed §10-3. **Typed?** verify (`response_model` strips undeclared keys — TEMPLATE §3b note). |
| `GET /portfolio/statements.csv` | Statements export | `year?`, `entity_id?` (`portfolio.py:1057-1064`) | `PlainTextResponse` text/csv, `statements_csv` (`statements.py:151-172`) — **partial** caveat only (§9-5) |
| `GET /portfolio/realised-gains` | Realised P/L report — both totals + excluded count | `year?`, `long_term_days=365`, `entity_id?` (`portfolio.py:974-981`) | Served dict `realised_gains_report` (`tax.py:352-370`) — keys §10-3 |
| `GET /portfolio/realised-gains.csv` | Realised P/L export | `year?`, `long_term_days=365`, `entity_id?` (`portfolio.py:993-1000`) | text/csv `realised_gains_csv` (`tax.py:400-416`) — **drops** disclaimer + historical-FX total + excluded count (§9-5) |
| `GET /portfolio/tax-lots` | Open tax-lots section | `long_term_days=365`, `entity_id?` (`portfolio.py:984-990`) | Served dict `tax_lots_report` (`tax.py:396-397`) — keys §10-3. **No `.csv` sibling** (§9-4) |
| `GET /portfolio/attribution.csv` | (Pack / attribution export — Portfolio-owned; §9-13) | `days=365`, `entity_id?` (`portfolio.py:345-375`) | text/csv — **drops** `_ATTRIB_DISCLAIMER` (§9-5) |

*(Holdings CSV `GET /portfolio/holdings.csv` and Transactions CSV `GET /portfolio/transactions.csv`
are **already delivered on their own pages** — Holdings — and are **not** re-homed here; see §10 inventory.)*

### 3b. Contract deltas (needed but not in the baseline — BUILD BACKEND-FIRST)

**Each row below is CONTINGENT on a §9 resolution — do not build any until §9 is passed.** `kind`
∈ add / rename / remove / reshape.

| kind | Endpoint (current → intended) | Decision | Why this page needs it |
|------|-------------------------------|----------|------------------------|
| add | *(none)* → `GET /portfolio/tax-lots.csv` | §9-4 | Reports owns "open tax lots; exports server-side" but only the JSON reader exists (`portfolio.py:984-990`); a tax-lots export needs a CSV builder. **Contingent on §9-4.** |
| reshape | `GET /portfolio/realised-gains.csv` (drops honesty payload) → carries the disclaimer + `base_realised_total_historical_fx` + `realised_fx_events_excluded` | §9-5 | An export that sheds its disclaimers is a **Guarantee-3 / D-020/D-076 violation**; the honest trade-date-FX total + excluded-events count live only in the JSON reader (`tax.py:360-369`), never in the CSV (`tax.py:400-416`). **Contingent on §9-5.** |
| reshape | `GET /portfolio/attribution.csv` (no disclaimer) → carries `_ATTRIB_DISCLAIMER` | §9-5 | `_ATTRIB_DISCLAIMER` exists (`analytics.py:457-463`) but the CSV builder never writes it (`portfolio.py:364-373`). **Contingent on §9-5 + §9-13.** |
| reshape | `GET /portfolio/statements.csv` (partial caveat) → carries the full D-077 "for your accountant / not tax advice" disclaimer | §9-5 | CSV emits only the top-line current-FX caveat (`statements.py:159`); the fuller reader disclaimer (`statements.py:146-147`) does not reach the file. **Contingent on §9-5.** |
| add (⚑) | *(none)* → the **Reports Pack** render/export path (`/reports/pack`) | §9-1, §9-2 | The Pack is spec-silent on its rendering mechanism (print stylesheet / server HTML / PDF — §10-4) and requires **server-side per-entity composition** (first server-side consumer of the dormant `entity_id`). Shape unknowable until §9-1/§9-2 resolve. **Contingent.** |

**⚑ Verify-first divergence flags (§10):** the biggest premise-vs-reality gaps are (a) the CSVs
**already shed disclaimers today** (a shipping honesty hole, §9-5), (b) **no tax-lots CSV exists**
(§9-4), and (c) the Pack's **rendering mechanism is spec-silent** (§9-1). None was assumed away.

---

## 4. COMPONENTS

*Source: DESIGN-SYSTEM.md §5 (ratified inventory). List only ratified components.*

| Ratified component | Role on this page | Data source | Prop/state not exercised at kitchen-sink |
|--------------------|-------------------|-------------|------------------------------------------|
| **PageHeader** | Reports H1 + intro | static | — |
| **DataTable** | Statements sub-tables, Realised P/L events, open tax-lots rows | **real** (`/portfolio/statements`, `/portfolio/realised-gains`, `/portfolio/tax-lots`) | — |
| **EmptyState** | Empty year / no realised gains / no open lots — each with a **reason** (Guarantee 3) | real | — |
| **Skeleton** | Per-section progressive loading (each reader owns its card's state — §12-8) | real | — |
| **Button** | Server-side export controls (one per artifact; `apiDownload` link, journey-guarded) | real (CSV endpoints) | download/`apiDownload` link behaviour (as Holdings §9) |
| **Select** (user-record) | **Year** filter (over the reader's served `years` list) — **user data, not a master** → `Select`, not `MasterSelect` | real (`years` from the reader) | — |
| **GlossaryTerm** / `[Help]` | "Tax lot", "Realised P/L", "Statements" popovers | mock glossary + `GLOSSARY.md` | see §9-9 (terminology gaps) |
| **SummaryLink** / card-header link | The **Reports Pack** entry point (card-header top-right link, D-100) | route link | — |
| **StalenessChip / ProvenanceBadge** | Only if the in-page figures carry staleness/provenance (holdings-derived) | real | — |

**Data source (Holdings retrospective):** every table above is wired to a **real** report reader —
there is no mock-backed affordance on this page. (The `[Help]` popover reads the mock glossary
registry as everywhere; the canonical term store is `GLOSSARY.md` — §9-9.)

**Affordances the ratified inventory lacks (amendment required before build — see §9):**
- **The Reports Pack print/export layout** — the Pack "uses a **dedicated print layout, not one of
  the four** templates" (`DESIGN-SYSTEM.md:235-236`); no ratified component covers a print artifact.
  This is a **§9-1 component/mechanism gap**, not a normal page assembly.
- **A `long_term_days` threshold control** *if* Reports exposes it editable (§9-7) — the Realised P/L
  reader takes `long_term_days` but there is no ratified numeric-threshold input surfaced on a report
  page; whether it is set here or read from Settings is §9-7.

**Component usage rules honoured (DESIGN-SYSTEM §5/§6):**
- **Entity references link directly (D-098)** — any symbol in a Realised P/L / tax-lots row links to
  `/instrument/{symbol}`.
- **Cards are LAYERED (D-100)** — each report section is a `.lf-card` with its content in a
  `.lf-card__body`; the **Pack cross-link lives in the card header, top-right**.
- **Scroll = content only, header outside (D-101)** — record tables keep the toolbar/header outside the
  scroll; each `DataTable` caps at `60vh` and scrolls internally.

**Tables — dataset-size posture (D-094):**
- **Statements** sub-tables (income/fees/cash-flow by year): **bounded** (a handful of years) →
  client-side sort/filter acceptable; revisit if a ledger ever spans >~50 years.
- **Realised P/L events** and **open tax-lots**: **potentially unbounded / append-only** (grow with
  trade history). Verify-first: the readers return the **full** grouped set in one dict today
  (`tax.py:343-350`, `:386-394`) — no server-side paging on `/portfolio/realised-gains` or
  `/portfolio/tax-lots`. **§9-8** records whether these need server-side paging (like Transactions,
  D-094) or stay bounded-by-year (the `year` filter caps realised P/L; tax-lots has no year filter).

---

## 4b. PER-VARIANT FIELD & ACTION SPECS

**Not applicable** — Reports has no entity with variants and **no data-entry form** (read/export only).
No per-variant field/action matrix. **Deferred cross-milestone dependency:** the **"explain this
report" AI helper** (D-060, P-6 pipeline) is **DEFERRED to the AI-surfaces milestone** with a visible
placeholder note (mirroring the Instrument Detail explainer deferral, D-068) — §9-10.

---

## 5. VOCABULARIES

*Source: MASTER-DATA.md. Every categorical field → its vocabulary + control.*

| Field on this page | Vocabulary / master | Fixed or extensible | MASTER-DATA ref |
|--------------------|---------------------|---------------------|-----------------|
| **Year** filter | **user data** (the reader's served `years` list) — **`Select`, not `MasterSelect`** | user-record | n/a (not a master) |
| **`long_term_days`** threshold (if surfaced — §9-7) | **user-set neutral integer** (Guarantee 4; **no jurisdiction presets**, D-077) | user setting | n/a |
| **Entity** (Pack per-entity sections only) | **user-record** (entities) — server-composed sections, **NOT** an interactive `MasterSelect`/switcher (§9-2, accounts §9-8) | user-record | n/a |

**No categorical MASTER-DATA field appears on this page** — Reports renders report readers; it has no
enum-valued input. All "fields" above are user-record filters/thresholds (`Select` / numeric), never
`MasterSelect`.

---

## 6. DECISIONS IN FORCE

*Source: docs/audit/DECISIONS.md. Each decision that constrains this page.*

| Decision | What it forbids / requires on this page |
|----------|------------------------------------------|
| **D-060** | Reports **owns** statements / Realised P/L / tax-lots; exports server-side; the AI helper rides the **P-6 pipeline only** (`DECISIONS.md:346`). |
| **D-038** | Reports Pack is the **one sanctioned duplication** — a print/export artifact from canonical readers, **not a page in the IA sense** (`DECISIONS.md:290-294`). |
| **D-041** | Reports (+ Pricing Health) enter the sidebar; the **Pack is reachable from Reports ONLY** (`DECISIONS.md:307-308`). |
| **D-061** | Pack = consolidated + per-entity sections (P-3), print-optimised, **composed from canonical readers, disclaimers preserved**, reachable from Reports only (`DECISIONS.md:347`). |
| **D-050 / P-5** | **All exports server-side**; the client never generates files (`DECISIONS.md:336`, `:51`). |
| **D-026** | Realised report heading is **"Realised P/L report"**; "Realised gain(s)" is a deprecated term (`GLOSSARY.md:114`, `:299-300`) — the page must **not** label it "Realised gains" (§9-9). |
| **D-020 / D-076** | Trade-date FX is **honestly `None`** for backdated trades; the trade-date-FX realised total shows an **excluded-events count** — and this **must travel into the export** (§9-5; PRODUCT-SPEC §4a). |
| **D-077 / Guarantee 4** | **No jurisdiction tax logic ever**; `long_term_days` is a neutral user-set threshold; statements/realised outputs are **"for your accountant"** — the export must carry that disclaimer (§9-5). |
| **D-105** | The backend serves **pre-formatted display strings**; the frontend renders them verbatim (readers carry a `disclaimer` display string — §10-3). |
| **Guarantee 3** | Every empty region shows a **reason**; insufficient inputs render "—", never fabricated; a **stale/excluded** value is flagged, never hidden. |
| **P-1 / D-031** | Every figure has ONE canonical home; Reports owns its figures and **links** the Pack; the Pack **never re-derives** (composes readers). |
| **P-3** | Per-entity Pack sections are a **filter of a canonical reader**, not a duplicate — server-composed, not a client switcher (§9-2). |
| **D-098** | Symbols/entities in report rows **link** to their entity-detail page. |
| **D-094** | Each table declares its dataset-size assumption + sort/filter location (§4, §9-8). |

---

## 7. ACCEPTANCE CRITERIA

*Written as checkable statements. Read/export-only page — mutation criteria are recorded absences.*

- [ ] **Happy path:** `/reports` renders the statements, Realised P/L report, and open-tax-lots
      sections, each from its canonical reader, with the **Reports Pack** entry link (card header).
- [ ] **Empty state (Guarantee 3):** empty year, **no realised gains**, and **no open lots** each show
      a **reason**, never a blank or a fabricated zero.
- [ ] **Error state:** a failing reader skeletons then shows an honest per-section error with retry
      (progressive per-card loading, §12-8) — the page never blocks on the slowest reader.
- [ ] **Stale / low-confidence:** any holdings-derived figure flags staleness; realised totals show the
      **current-FX caveat AND the trade-date-FX excluded-events count** (D-020/D-076) **in-page**.
- [ ] **Disclaimers travel INTO the exports (⚑ §9-5):** every CSV carries its on-screen disclaimer —
      the D-077 "for your accountant / not tax advice" line, the current-FX caveat, and the trade-date-FX
      excluded-count. An export that sheds a disclaimer **fails this criterion** (Guarantee violation).
- [ ] **Export journey-guard (page-accounts §14ac-2):** clicking each real Export control triggers the
      **server-side** download of the intended artifact (assert the request URL/params, not just a
      handler call); no client-side file generation (P-5).
- [ ] **Negative / large / long-name data** render correctly (tabular figures, no overflow).
- [ ] **Both densities + both themes** correct; interactive OPEN states (the year `Select` popup)
      verified in light AND dark.
- [ ] **Keyboard + WCAG AA** (focus ring, aria-sort, labels).
- [ ] **No frontend money math** — every figure is a backend-served string/number (D-105).
- [ ] **Terms match GLOSSARY** (with the §9-9 additions); the label is **"Realised P/L report"**, never
      "Realised gains" (D-026).
- [ ] **Tables (D-094):** statements bounded (client-side); realised/tax-lots per §9-8 disposition.
- [ ] **Rendered layout verification (overflow suite, ADR-0004):** extend `e2e/overflow.spec.ts` to cover
      `/reports` — zero horizontal overflow at 320/375/900/1366 × both themes; only `.lf-shell__content`
      scrolls vertically.
- [ ] **Copy hygiene (page-chrome §11-8):** no decision ID / `server-side` / endpoint name in any
      user-facing string; a changed label updated app-wide.
- [ ] **Recorded absence — writes:** Reports performs **no mutation** → no `[S]` PIN gate, no
      request-body assertion, no round-trip import test (D-095). This is the **chosen absence**, stated
      so the next reader does not treat it as a gap.
- [ ] **The Pack (⚑ §9-1/§9-2/§9-11):** acceptance criteria for `/reports/pack` are **deferred to its §9
      resolutions** — its rendering mechanism, per-entity composition, and whether it ships this
      milestone are all open. Disclaimers-preserved and composed-from-readers (D-061) are the fixed
      invariants any resolution must honour.

---

## 8. BUILD PHASES

*One commit per phase. Backend deltas (§3b) FIRST — but ALL §3b rows are contingent on §9. **No phase
starts until §9 is passed.***

- **Phase 0 — Contract deltas (§3b, each contingent on its §9 item):** build backend-first, regenerate
  `API-CONTRACT.json` + `docs/openapi.json` same commit, drift green. Candidates: tax-lots CSV (§9-4);
  the disclaimer-carrying CSV reshapes (§9-5); the Pack path (§9-1/§9-2). **A same-batch code test pins
  every reshaped CSV's disclaimer rows** (TEMPLATE §3b value-test note).
- **Phase 1 — Page assembly:** compose the ratified components; wire to the readers; honest
  empty/error/stale states; progressive per-card loading; the Pack entry link.
- **Phase 2 — Tests:** render/acceptance tests; extend `e2e/overflow.spec.ts` for `/reports`; drift +
  typecheck + lint green.
- **Phase 3a — Scripted pre-pass (GREEN before the walk):** drive `/reports` in both themes across the
  breakpoints on the live app + real backend; every section out of skeleton; **prove each export
  download carries its disclaimers** (the ⚑ honesty case); fix everything surfaced first.
- **Phase 3b — Owner acceptance walk (LIVE, judgment items only):** copy/semantics/the Pack rendering
  decision. The owner closes the phase.
- **Close ritual:** record the close (plan retrospective + `RATIFICATION.md §6`), strike-check every
  §9 item against the diff, **push** before the owner re-uploads.

---

## 10. VERIFY-FIRST RECORD (file:line)

*Read the engine before assuming shapes (D-019). Every claim cites the code/spec.*

### 10-1. The CSV / export endpoints that exist today

Router: `app/api/v1/routes/portfolio.py`. **Six** CSV endpoints, all `GET`, `PlainTextResponse`,
`media_type="text/csv"` (none stream):

| Export | Path | Params (honest) | Emits disclaimer in file? | Staleness/provenance in file? |
|--------|------|-----------------|---------------------------|-------------------------------|
| Statements | `GET /portfolio/statements.csv` (`portfolio.py:1057`) | `year?`, `entity_id?` | **Partial** — only the top-line current-FX caveat (`statements.py:159`); the full D-077 line (`statements.py:146-147`) is **dropped** | No |
| Realised P/L | `GET /portfolio/realised-gains.csv` (`portfolio.py:993`) | `year?`, `long_term_days=365`, `entity_id?` | **NO** — no disclaimer, no historical-FX total, no excluded count (`tax.py:400-416`) | No |
| Tax lots | *(NONE — JSON only, `portfolio.py:984`)* | — | — | — |
| Attribution | `GET /portfolio/attribution.csv` (`portfolio.py:345`) | `days=365`, `entity_id?` | **NO** — `_ATTRIB_DISCLAIMER` exists (`analytics.py:457-463`) but is never written (`portfolio.py:364-373`) | No |
| Holdings *(delivered on Holdings; not re-homed)* | `GET /portfolio/holdings.csv` (`portfolio.py:186`) | none | No | **YES** — `is_stale`, `valuation_method` (`portfolio.py:512-527`) |
| Transactions *(delivered on Holdings; not re-homed)* | `GET /portfolio/transactions.csv` (`portfolio.py:196`) | none (full dump) | No | No (raw ledger) |

**Existing frontend links to these:** the only wired CSV exports in `frontend/src/` are Holdings' own
(`page-holdings §9`, Export → `apiDownload`); **no frontend surface links statements/realised/tax-lots/
attribution CSVs today** — Reports is their first UI consumer. What Reports **adds vs links:** it must
surface the statements / realised / tax-lots exports (and decide attribution, §9-13), and (per §9) add
the missing tax-lots CSV + the disclaimer reshapes.

### 10-2. The declined-exports inventory (grep DECLINED + D-061 across CURRENT.md, page plans §9, DECISIONS.md)

**7 pages declined a per-page export pointing at Reports.** None may be silently dropped — each is
delivered by the Pack or re-declined in §9-3.

| # | Source (file:line) | Page/surface | Export declined | Rationale (quote) | Names D-061 (Pack)? |
|---|--------------------|--------------|-----------------|-------------------|---------------------|
| 1 | `page-net-worth.md:300-301` | Net worth (ND-14) | Per-page CSV | "**DECLINED, not deferred** … exports are **Reports** territory (D-038/D-050)" | No (D-038/D-050) |
| 2 | `page-pricing-health.md:243-244` | Pricing Health (ND-12) | Diagnostics CSV | "**DECLINED** — no CSV here; exports are the **Reports page's** territory" | No |
| 3 | `page-review.md:284-285` | Review (ND-10) | Per-page export | "**DECLINED** … export is **Reports territory**" | No |
| 4 | `page-heatmap.md:286,350` | Heatmap (ND-6a) | Treemap export | "**NO export here (DECLINED)** — **Reports territory**"; draft redirects any export to the already-delivered `/portfolio/holdings.csv` | No |
| 5 | `page-scenarios.md:303,329` | Scenarios (§9-12) | `/scenarios` export | "**DECLINE** … the **Reports Pack (D-061)** is the home, decided at the **Reports plan**" | **Yes (D-061)** |
| 6 | `page-cash-flow.md:344,371` | Cash flow (§9-14) | Planning export | "**DECLINE** — the **Reports Pack (D-061)** is the export home, composed from these canonical readers" | **Yes (D-061)** |
| 7 | `page-policy.md:500,536` | Policy (§9-20) | `/policy` drift export | "**DECLINE.** Drift's export home is the **Reports Pack (D-061)**, composed from this page's canonical reader" | **Yes (D-061)** |

**Inventory count: 7 declined exports across 7 pages.** Three (Scenarios / Cash flow / Policy) name the
**Reports Pack (D-061)** as the home explicitly; four (Net worth / Pricing Health / Review / Heatmap)
say "Reports territory" via D-038/D-050 without naming D-061 — those four are the ones most at risk of
silent drop and must be explicitly dispositioned in §9-3.

**Already-delivered exports Reports does NOT re-home:** Holdings CSV (`portfolio/holdings.csv`, D-050,
`page-holdings §9`), Transactions CSV (`portfolio/transactions.csv`, round-trip), Realised P/L CSV +
Return-attribution CSV pinned on Portfolio (`page-portfolio §12-6b`, `API-CONTRACT.json:9031`).

### 10-3. Statements / Realised P/L / tax-lots readers (served shapes + display strings + disclaimers)

- **`statements_report`** (`app/services/statements.py:46-148`) — `(session, year=None, entity_id=None) → dict`.
  Keys (`:109-148`): `base_currency, years, year, income{dividend,interest,total,ttm_total,by_currency[],by_symbol[]},
  fees{commissions,taxes,total,by_year[]}, cashflow{deposits,withdrawals,net,by_year[]}, income_by_year[],
  realised_unrealised{realised,unrealised}, disclaimer`. **Display string (D-105):** `disclaimer`
  (`:146-147`) — *"Organisation for review / your accountant — not tax or financial advice. Base-currency
  figures use current FX and are indicative, not for filing."*
- **`realised_gains_report`** (`app/services/tax.py:284-370`) — `(session, year=None, long_term_days=365,
  entity_id=None) → dict`. Keys (`:352-370`): `year, years, long_term_days, base_currency, currency_groups[],
  base_realised_total_current_fx, base_realised_total_historical_fx, realised_fx_events_excluded, disclaimer`.
  Each group (`:343-350`): `currency, realised_total, short_term, long_term, income, events[]`; each event
  (`:315-323`): `symbol, name, sell_date, acquired_date, quantity, proceeds, cost, gain, holding_days,
  long_term`. Honest-NULL: `gain_base_historical` returns `None` when a leg lacks a stored rate (`:70-78`),
  incrementing `realised_fx_events_excluded` (`:326-328`). Engine: `fifo_report` (`tax.py:94-182`) — pure
  FIFO/average replay (the valuation `compute_fifo` is a different, untouched function, `tax.py:5-6`).
  **Display string:** `disclaimer` (`:362-369`).
- **`tax_lots_report`** (`app/services/tax.py:373-397`) — `(session, long_term_days=365, entity_id=None) → dict`.
  Keys (`:396-397`): `long_term_days, lots[], disclaimer`; each lot (`:386-394`): `symbol, name,
  acquired_date, quantity, unit_cost, cost, currency, holding_days, long_term`. **Display string:**
  `disclaimer` = *"Open lots by FIFO. Organisation only — not tax advice."* (`:397`). **No CSV sibling** (§9-4).

### 10-4. The Pack's composition + "print-optimised" mechanics

- **Composition** (`INFORMATION-ARCHITECTURE.md:353-358`, quoted §2): consolidated section (net-worth
  trend + review) then **per-entity sections (P-3): net worth, drift, realised, risk + attribution**,
  composed **from canonical readers**, disclaimers preserved.
- **Per-entity ≠ switcher.** No frontend entity switcher exists; `?entity_id` is **dormant** with **zero
  frontend callers** (`page-accounts.md:333`, §9-8 ACCEPTED: "entity is an **account attribute, not** a
  page filter; the `?entity_id` param stays **dormant** … **no switcher**"). The 15 portfolio readers
  **do** filter by `entity_id` server-side (`accounts.py:36`; §10-5). **So the Pack's per-entity sections
  are SERVER-COMPOSED sections in an artifact — the backend iterates entities and calls the readers with
  `entity_id` — NOT an interactive switcher.** The Pack would be the **first server-side consumer** of the
  dormant param (§9-2), consistent with P-5 server-side exports.
- **"Print-optimised" is SPEC-SILENT on mechanism.** The specs say only: "a **print/export artifact**"
  (`IA:43`), "a **print-optimised artifact**" (`IA:355`), "**print-optimised**" (`DECISIONS.md:347`), "a
  **print artifact**, not a template page" (`DESIGN-SYSTEM.md:222-223`), "a dedicated **print layout**,
  not one of the four" (`DESIGN-SYSTEM.md:235-236`). **Nowhere** is a `@media print` stylesheet vs
  server-rendered HTML vs PDF chosen. → **§9-1 (⚑ load-bearing).**

### 10-5. `entity_id` / `account_id` honesty on the export endpoints

The one filter primitive is `entity_account_filter(model, entity_id)` (`portfolio.py:255-266`) — scopes by
the owning account's `entity_id`, **no-op when None**, and **handles only `entity_id`, never `account_id`**.

| Endpoint | `entity_id` | `account_id` |
|----------|-------------|--------------|
| `statements` / `statements.csv` | **Honoured** (`portfolio.py:1046-1064`; `statements.py:50-52`) | **Absent** |
| `realised-gains` / `realised-gains.csv` | **Honoured** (`portfolio.py:974-1000`; `tax.py:254-256,291`) | **Absent** |
| `tax-lots` | **Honoured** (`portfolio.py:984-990`; `tax.py:378`) | **Absent** |
| `attribution.csv` | **Honoured** (`portfolio.py:347,361`) | **Absent** |
| `holdings.csv` / `transactions.csv` | **Absent** | **Absent** (transactions = deliberate full dump) |
| `scenarios` (context) | **REJECTED 400** (household-scoped, `portfolio.py:1013-1014`) | **Absent** |

**Honest posture:** every report reader honours `entity_id` server-side but **no report accepts
`account_id`** — per-account report scoping does not exist. `holdings.account_id` is a **dormant reader
param** with no UI consumer (`portfolio.py:171-174`). This is why the Pack's per-entity composition is
feasible server-side today (entity_id works) while any per-account report scoping is out of scope (§9-8).

### 10-6. Money / staleness travelling into the exports

Confirmed against the CSV builders: **only Holdings CSV** carries staleness/provenance (`is_stale`,
`valuation_method`, `portfolio.py:512-527`). The **statements / realised / attribution** CSVs emit **bare
numbers with at most a partial caveat** (§10-1). The rich provenance JSON (`GET /portfolio/pricing-health`,
`portfolio.py:205-224`) is not folded into any report export. **An export that sheds its served
disclaimers is a Guarantee-3 / D-020/D-076 violation** — the current CSVs already do (§9-5).

### 10-7. SN-class vocabulary sweep + GLOSSARY gaps + inherited platform standards

- **GLOSSARY (`GLOSSARY.md`):** **EXISTS** — "Reports Pack" (`:278`), "Statements" (plural, `:204`),
  "Tax lot / Open lot" (`:65`), "Realised P/L" (`:114`). **MISSING / gaps** — no standalone **"Report"**
  entry; **"Statement"** (singular) is undefined (only plural "Statements"); **"Realised gains" is a
  DEPRECATED term** that must normalise to "Realised P/L" (D-026, `:299-300`) — the page must not use it.
  → **§9-9.** (Per page-heatmap §13-1, any new term ships to `GLOSSARY.md` **first**, then the popover
  data, guarded by `test_glossary_parity.py`.)
- **Inherited platform standards:** inset guard route + overflow arrays (extend `overflow.spec.ts` for
  `/reports`); D-098 entity links; D-100 layered cards; D-101 header-outside-scroll; D-094 table posture.
  **`[S]` writes — NONE:** Reports is read/export-only; **recorded chosen absence** (§7), no PIN gate.

### 10-8. ⚑ Divergence flags (premise vs reality)

1. **The CSVs already shed disclaimers today** (§10-1/§10-6) — a **shipping honesty hole**, not a new
   feature; caught by reading the builders. → §9-5.
2. **No tax-lots CSV exists** — the reader is JSON-only (`portfolio.py:984-990`). → §9-4.
3. **The Pack rendering mechanism is spec-silent** (§10-4). → §9-1.
4. **The TEMPLATE "Reports-group pages are worklist-shaped" note** conflicts with **DESIGN-SYSTEM §3**,
   which lists Reports under **Overview** (`:227`) and Pricing Health under Worklist (`:229`) — the two
   group members use **different** templates, so the generalisation does not hold for Reports. → §9-6.

### 10-9. ⚑ `long_term_days` persistence verdict (Amendment J — verify FIRST, file:line)

**Amendment J requires the persistence question answered BEFORE any control is designed. Verdict:
NO persisted user setting backs `long_term_days` anywhere in the codebase.** Evidence:

| Where a setting could live | What's actually there | Verdict |
|----------------------------|-----------------------|---------|
| **Request param** | `long_term_days: int = Query(default=365, ge=0, le=3660)` on `realised-gains` (`portfolio.py:981`), `tax-lots` (`portfolio.py:990`), the new `tax-lots.csv` route (`portfolio.py:999`) and `realised-gains.csv` (`portfolio.py:1014`) | A per-request param defaulting to **365**, not a stored preference |
| **Reader default** | `realised_gains_report(…, long_term_days: int = 365, …)` (`tax.py:285`, clamp `:289`); `tax_lots_report(…, long_term_days: int = 365, …)` (`tax.py:377`) | Hard default **365** when the param is absent |
| **Env `Settings`** | `app/core/config.py:29-80` — `base_currency`, `timezone`, … **no `long_term_days` field** | Not an env setting |
| **DB settings allow-list** | `_ALLOWED_KEYS` (`app/api/v1/routes/settings.py:23-39`) — 15 keys (`base_currency`, `timezone`, `first_run_complete`, …) — **`long_term_days` is NOT listed**; the generic `Setting` key/value model (`models/__init__.py:101`) stores no such key | Not a persisted DB setting; a PUT would be REJECTED (unknown-key 400) |
| **Settings page** | Unbuilt (CURRENT.md NEXT list) | No UI seam exists yet |

**Posture (Amendment J):** Reports renders the **SERVED default (365) READ-ONLY** — a display-only line
(*"Long-term threshold: 365 days"*, neutral, Guarantee 4 / D-077, no jurisdiction presets), **not** an
input. **NO settings store is built as a side effect.** The **Settings seam** is recorded here for the
future: when Settings ships, add `long_term_days` to `_ALLOWED_KEYS` (with a numeric validator) and have
the readers read the stored value as the default — at which point Reports' read-only line links to
Settings (the accepted §9-7 resolution). Until then the read-only value is the served 365. **No code was
written for 9-7** — the verdict is the deliverable.

---

## 9. NEEDS DECISION — RESOLVED (owner one-pass 2026-07-17)

*All thirteen items RESOLVED in a single owner pass on **2026-07-17** — **every item ACCEPTED as
proposed**, with **Amendments I/J/K** and **Recording Notes 1/2** (recorded verbatim below the table).
⚑ marks the load-bearing items named in the task. The "Ruling" column carries the disposition + date;
the "Proposed resolution" column is retained as the accepted text.*

### Amendments & recording notes (owner, 2026-07-17 — verbatim)

- **AMENDMENT I (binds 9-3 + 9-11):** the five Pack-delivered dispositions are recorded as
  **"Pack-delivered (PENDING the Pack milestone)"** — the declined-exports ledger **CLOSES ONLY at the
  Pack milestone's close**. Closing the Reports page does **not** close the debt. `CURRENT.md` carries the
  pending ledger line until then. The two re-declines (Pricing Health diagnostics, Heatmap treemap) close
  now with rationale.
- **AMENDMENT J (binds 9-7):** verify the threshold's persistence **FIRST**. If no user-setting store
  exists (likely — Settings is unbuilt), Reports renders the **SERVED default (365) read-only** with the
  Settings seam recorded in the plan — **NO settings store is built as a side effect**.
- **AMENDMENT K (binds 9-10) + the phasing corollary:** **no on-page placeholder** for the AI helper
  (records only, D-060 intact) — and by the same **dead-affordance** principle, **the Pack entry point does
  NOT ship on the Reports page this milestone**; it arrives with the Pack milestone (D-041 Reports-only is
  preserved — recorded, not rendered).
- **RECORDING NOTE 1 (binds 9-5):** attribution.csv's content change gets a **dated delta note in
  page-portfolio.md** (§12-6b owns that export).
- **RECORDING NOTE 2 (binds 9-6):** clarify the TEMPLATE's "Reports-group worklist" note in passing (it
  describes **Pricing Health**, not Reports) — one doc line, so the next reader doesn't trip.

| # | Item | Ruling (owner 2026-07-17) | Accepted resolution (as proposed) |
|---|------|---------------------------|-----------------------------------|
| **9-1 ⚑** | **The Reports Pack's rendering mechanism** — print stylesheet / server-rendered HTML / PDF? | ✅ **ACCEPTED as proposed (2026-07-17)** — server-rendered print-optimised HTML; browser print-to-PDF; **no PDF dependency without an ADR**. **Pack = its own milestone** (with 9-11). | **Server-rendered, print-optimised HTML at `/reports/pack`** (a dedicated backend-composed HTML route with a `@media print` stylesheet), **not** a client route and **not** a new PDF dependency (no ADR for a PDF lib without owner sign-off). The browser's print-to-PDF is the export path; keeps P-5 (server composes the artifact) and adds no dependency. |
| **9-2 ⚑** | **The Pack's per-entity composition** — how are per-entity sections produced given there is NO entity switcher? | ✅ **ACCEPTED as proposed (2026-07-17)** — server-composed per-entity sections; **the `entity_id` param stays UI-dormant** (honours accounts §9-8). | **Server-composed sections:** the Pack backend iterates the user's entities and calls each canonical reader with `entity_id`, emitting a fixed section per entity — an **artifact section, not an interactive switcher** (honours accounts §9-8: no page-level switcher invented; the param stays UI-dormant, consumed only server-side inside the artifact). |
| **9-3 ⚑** | **Disposition of each of the 7 declined per-page exports** (§10-2) — delivered by the Pack, or re-declined? None may be silently dropped. | ✅ **ACCEPTED + AMENDMENT I (2026-07-17)** — the **5 Pack-delivered** dispositions are recorded as **"Pack-delivered (PENDING the Pack milestone)"**; the ledger **closes only at the Pack milestone**. The **2 re-declines** (Pricing Health diagnostics, Heatmap treemap) **close now** with rationale. | **Delivered by the Pack, not as standalone per-page CSVs:** drift (Policy), net-worth trend + review (Net worth/Review), scenarios (Scenarios), cash-flow (Cash flow) are exactly the Pack's consolidated + per-entity sections (§2) — composed from those pages' canonical readers. **Pricing Health diagnostics + Heatmap treemap are RE-DECLINED** (a diagnostics table and a non-tabular treemap are not report artifacts; Heatmap already redirects to the delivered `holdings.csv`). Record all 7 dispositions in the build. |
| **9-4** | **No tax-lots CSV export exists** (JSON only, `portfolio.py:984-990`) — does Reports offer a tax-lots export? | ✅ **ACCEPTED as proposed (2026-07-17)** — add `GET /portfolio/tax-lots.csv`, backend-first, born with its disclaimer block (9-5 discipline from birth). **DONE — Phase 0 commit 4 (§11).** | **Add `GET /portfolio/tax-lots.csv`** (a `tax_lots_csv` builder mirroring `realised_gains_csv`, columns = the lot keys + the disclaimer row per §9-5), backend-first, regenerating the contract in the same commit. |
| **9-5 ⚑(honesty)** | **The report CSVs shed their served disclaimers today** (§10-1/§10-6) — realised-gains.csv drops the disclaimer + `base_realised_total_historical_fx` + `realised_fx_events_excluded`; attribution.csv drops `_ATTRIB_DISCLAIMER`; statements.csv carries only a partial caveat. | ✅ **ACCEPTED + RECORDING NOTE 1 (2026-07-17)** — reshape all three CSVs to carry their served disclaimers; attribution.csv's change gets a dated delta note in page-portfolio.md. **DONE — Phase 0 commits 1/2/3 (§11); disclaimer rows pinned.** | **Reshape all report CSVs (backend-first) to carry their served disclaimers**: realised-gains.csv gains a disclaimer block + the historical-FX total + excluded-events count row; attribution.csv gains `_ATTRIB_DISCLAIMER`; statements.csv gains the full D-077 line. **Same-batch code tests pin the disclaimer rows** (TEMPLATE §3b value-test note). Fixes a shipping hole regardless of the rest of the page. |
| **9-6** | **Page template — Overview (§3) vs the TEMPLATE "Reports-group worklist" note** (§10-8 divergence). | ✅ **ACCEPTED + RECORDING NOTE 2 (2026-07-17)** — **Overview** per `DESIGN-SYSTEM.md:227`; clarify the TEMPLATE "Reports-group worklist" note (it describes Pricing Health, not Reports) in one doc line. | **Overview** per the authoritative `DESIGN-SYSTEM.md:227` mapping — the page is a composed surface of owned sections + the Pack link; the "Reports-group worklist" note describes **Pricing Health** (the worklist group-mate, `:229`), not Reports. No DESIGN-SYSTEM amendment needed. |
| **9-7** | **`long_term_days` control** — is the neutral threshold **editable on Reports**, or read-only from Settings? | ✅ **ACCEPTED + AMENDMENT J (2026-07-17)** — verify persistence FIRST. **VERDICT (§10-9): NO persisted setting exists** → Reports renders the **served default (365) READ-ONLY** + the Settings seam note. **No settings store built as a side effect.** | **Read from the user setting, shown read-only on Reports** with a link to Settings (keeps one canonical home for the threshold; avoids a new input component). *(Amendment J: since no setting store exists yet, the read-only value is the SERVED default; the Settings seam is recorded, not built.)* |
| **9-8** | **Realised P/L / tax-lots table dataset-size posture (D-094)** — bounded-by-year, or server-side paging? | ✅ **ACCEPTED as proposed (2026-07-17)** — **bounded-by-filter, client-side**; the **~1,000-row revisit threshold** recorded. | **Bounded-by-filter, client-side** for now: Realised P/L is capped by the **year** filter; tax-lots is open lots only (bounded by holdings). Record the assumption + a **revisit threshold** (server-side paging if a single year's realised events or open lots exceed ~1,000 rows), mirroring the Holdings D-094 posture. **No per-account scoping** (no report accepts `account_id`, §10-5). |
| **9-9** | **Terminology gaps (GLOSSARY)** — no standalone "Report"; "Statement" (singular) undefined; "Realised gains" is deprecated. | ✅ **ACCEPTED as proposed (2026-07-17)** — "Report" authored spec-first; "Statements" (plural) confirmed as the label; copy uses **"Realised P/L report"**, never the deprecated "Realised gains" (D-026). **DONE — Phase 0 commit 6 (§11); parity green.** | **Add to `GLOSSARY.md` first** (then popover data, guarded by `test_glossary_parity.py`): **"Report"** (a composed statements/Realised-P/L/tax-lots view — for your accountant), and confirm **"Statements"** (plural) is the label used (avoid the singular). **Never** label anything "Realised gains" — use **"Realised P/L report"** (D-026). |
| **9-10** | **The "explain this report" AI helper** (D-060, P-6 pipeline). | ✅ **ACCEPTED + AMENDMENT K (2026-07-17)** — DEFERRED to the AI-surfaces milestone; **NO on-page placeholder** (records only, D-060 intact) — the dead-affordance principle. | **DEFERRED to the AI-surfaces milestone** with a recorded pending decision (D-060 stays intact) — never silently dropped. *(Amendment K: no on-page placeholder — records only, not a rendered dead affordance.)* Not built this milestone. |
| **9-11** | **Does the Pack (`/reports/pack`) ship THIS milestone, or is it phased after the Reports page?** | ✅ **ACCEPTED + AMENDMENT I / phasing corollary (2026-07-17)** — **phase it**: Reports page + export-honesty fixes first; **Pack = a second milestone**. The **Pack entry point does NOT ship on the Reports page this milestone** (D-041 preserved — recorded, not rendered). | **Phase it:** ship the **Reports page + the export honesty fixes (§9-4/§9-5) first** (self-contained, closes a shipping hole); build the **Pack as a second milestone** once §9-1/§9-2 are ratified. *(Amendment K corollary: no Pack entry point on Reports this milestone.)* |
| **9-12** | **Pack scope confirmation** — the exact sections + the readers each composes. | ✅ **ACCEPTED as proposed (2026-07-17)** — the section→reader map is ratified; **re-verified at the Pack milestone** (no re-derivation, D-061). | **Consolidated:** net-worth trend reader + review reader. **Per-entity:** `value_portfolio` (net worth), policy-drift reader, `realised_gains_report` (realised), risk reader, attribution reader — each called with `entity_id` server-side (§9-2). Re-verify the reader list at the Pack milestone; no re-derivation (D-061). |
| **9-13** | **Attribution CSV ownership (P-1)** — attribution is Portfolio's canonical export (`page-portfolio §12-6b`); does Reports link it, re-home it, or only use it inside the Pack? | ✅ **ACCEPTED as proposed (2026-07-17)** — attribution **stays Portfolio's**; Reports does not re-home it (appears only inside the Pack). The §9-5 disclaimer fix still applies (shared honesty fix). | **Reports does not re-home attribution as a standalone export** — attribution appears **only inside the Pack's per-entity "risk + attribution" section** (composed from the canonical reader, §9-12). Its standalone CSV stays Portfolio's. The §9-5 disclaimer fix to `attribution.csv` still applies (it's a shared honesty fix). |

---

**Sign-off — §9 CLOSED (owner 2026-07-17):** all **13 items RESOLVED** (ACCEPTED as proposed + Amendments
I/J/K + Notes 1/2). §3b deltas that this milestone builds (§9-4 tax-lots CSV, §9-5 disclaimer reshapes) are
**DONE in Phase 0** (§11). The Pack rows (9-1/9-2/9-3-Pack-portion/9-11/9-12) are **its own milestone** — the
declined-exports ledger stays **PENDING** in `CURRENT.md` until the Pack closes (Amendment I). **Phase 1
(page assembly) is BLOCKED until the owner ratifies the Phase-0a specimen (§12).**

### AMENDMENT — 9-12 map extended by the Pack milestone (owner ruling 2026-07-17, reports-pack Pack-1)

*The Pack milestone's §9 (reports-pack.md) resolved **Pack-1** on 2026-07-17: the two Amendment-I
dispositions that do **not** map to the §9-12 list — **Cash flow** and **Scenarios**, both
household-scoped (per-entity is impossible: Scenarios rejects `entity_id` by design
`portfolio.py:1043-1044`; Cash flow has no entity seam, D-057) — are delivered as **consolidated
subsections**, not silently dropped. This amendment records that extension so **one** ratified map
exists, not two conflicting ones.*

**The ratified §9-12 map, as amended (2026-07-17):**
- **Consolidated** = net-worth trend · review **· cash flow · scenarios** *(the two additions bind
  this milestone; both are household-scoped by construction, so they can only be consolidated)*.
- **Per-entity** = `value_portfolio` (net worth) · policy-drift · realised P/L · risk + attribution.

The original 9-12 row (Consolidated = net-worth trend + review) stands as first drafted; **this dated
amendment is authoritative** where they differ. All five Amendment-I dispositions now map to a named
Pack section — see the reports-pack.md §0 ledger-mapping table.

---

## 11. PHASE 0 — CONTRACT-DELTA EVIDENCE (backend-first; RED→GREEN per commit)

*One delta per commit, in the task's order. Each honesty delta was proven **fail-first RED on the
real cause** (the pre-fix builder shedding the served payload), then GREEN with a pinning test
(TEMPLATE §3b value-test discipline). `npm run check` EXIT CODE and `make api-contract-check` are
recorded where they apply.*

| # | Delta [§9] | Fail-first RED (real cause) | GREEN (pin) | Commit |
|---|-----------|-----------------------------|-------------|--------|
| 1 | **realised-gains.csv** carries the served disclaimer + `base_realised_total_historical_fx` total row + `realised_fx_events_excluded` count row [9-5] | `test_realised_gains_csv_carries_served_disclaimer_and_both_totals` RED — the builder emitted only the bare `currency,symbol,…` event table (no disclaimer, no totals) | Builder leads with a title + served disclaimer + a current-FX / trade-date-FX / excluded-count totals block, then the event table; pin GREEN, existing `test_realised_gains_csv` updated for the new lead block | _(this commit)_ |
| 2 | **attribution.csv** gains the served `_ATTRIB_DISCLAIMER` [9-5 + Recording Note 1] | `test_attribution_csv_carries_served_disclaimer` RED — the reader served the disclaimer but the CSV builder never wrote it (a shed-disclaimer hole) | Builder leads with the served disclaimer, then the per-holding table; pin GREEN, existing `test_attribution_csv_export` updated for the lead block. Dated delta note in page-portfolio.md §12-6b (export stays Portfolio-owned, §9-13) | _(this commit)_ |
| 3 | **statements.csv** carries the full D-077 disclaimer [9-5] | `test_statements_csv_carries_the_full_D077_disclaimer` RED — the file shipped only the top-line current-FX caveat; the served "for your accountant / not tax or financial advice" line never reached it | Builder writes the served `disclaimer` verbatim under the caveat line; pin GREEN | _(this commit)_ |
| 4 | **add** `GET /portfolio/tax-lots.csv` [9-4], born with its disclaimer block [9-5] | `test_tax_lots_csv_exists_and_carries_its_disclaimer` RED — no route (404); the tax-lots reader was JSON-only | New `tax_lots_csv` builder (mirrors `realised_gains_csv`; lot-key columns; leads with the served disclaimer) + `GET /portfolio/tax-lots.csv` route. **Contract regenerated same commit — 130 → 131 paths; `make api-contract-check` GREEN.** Pin GREEN | _(this commit)_ |
| 5 | **9-7 threshold persistence verdict** [9-7 + Amendment J] — records only | n/a (verify-first record) | **VERDICT: no persisted setting backs `long_term_days`** (§10-9, file:line) → served-default-365 **read-only** on Reports + the Settings seam recorded. **No code written** — the verdict is the deliverable | _(this commit)_ |
| 6 | **GLOSSARY spec-first** [9-9] — "Report" authored; "Statements" (plural) confirmed as the label; "Realised P/L report" is the heading (never the deprecated "Realised gains", D-026) | n/a (spec + parity guard) | `docs/specs/GLOSSARY.md` gains **"Report"** FIRST, then the popover mirror (`frontend/src/mocks/glossary.ts` `term-report`); **`test_glossary_parity.py` GREEN (49 passed)** | _(this commit)_ |
| 7 | **Records** [Amendments + Notes] | n/a | Amendment-I **pending declined-exports ledger** written into `CURRENT.md` (5 Pack-delivered PENDING the Pack milestone; 2 re-declines closed now); Recording Note 2 TEMPLATE clarification (the "Reports-group worklist" note is Pricing-Health-specific). **`08-TECH-DEBT.md` untouched — no known-red found** (all suites green this phase) | _(this commit)_ |

**Phase-0 gate:** `make api-contract-check` GREEN (131 paths) · backend report/CSV/glossary suites GREEN
(see §11 rows) · **`08-TECH-DEBT.md` untouched — nothing to log** (no known-red on trunk). Frontend-check
EXIT CODE is stated at the Phase-0a specimen (§12), the frontend-touching step.

---

## 12. PHASE 0a — LAYOUT SPECIMEN (the geometry gate) — PROPOSED, AWAITING RATIFICATION

**A static, unwired specimen at `/kitchen-sink` → "Reports — LAYOUT SPECIMEN (page-reports §9 / Phase
0a)". Phase 1 (page assembly) is BLOCKED until the owner ratifies this geometry BY LOOKING** (the
page-home lesson: a correct widget list can still be a wrong page — geometry is a requirement a list
cannot express). Files: `frontend/src/routes/ReportsMockup.tsx` + `Reports.css`, registered in
`KitchenSink.tsx`.

**Proposed geometry (OVERVIEW template — §9-6, `DESIGN-SYSTEM.md:227`, NOT worklist):** three OWNED,
STACKED sections in reading order —

1. **Statements** — year filter + Export → `statements.csv`; income/fees/cash-flow by year (a negative
   net-cash-flow year shown honestly); realised-vs-unrealised for the selected year; the served
   disclaimer in-page.
2. **Realised P/L report** — year filter + Export → `realised-gains.csv`; the **`long_term_days` read-only
   line** (Amendment J — served default 365, never an input); per-event table (symbol **links**, D-098;
   a long instrument name **truncates**); **BOTH base totals VISIBLE** (current-FX 14,820.00 AND
   trade-date-FX 13,905.00) with the **excluded-events count rendered because it is non-zero** ("2 events
   excluded — trade-date FX unavailable", D-020/D-076); the served disclaimer in-page.
3. **Open tax lots** — Export → `tax-lots.csv`; the read-only threshold line; the lots table (mixed
   USD/INR, `cost == qty × unit_cost` served — tile-integrity); the served disclaimer in-page.

Each section is a **D-100 layered card** whose header (title · year filter · Export) sits **OUTSIDE the
scroll** (D-101); each disclaimer is **rendered VERBATIM as served (D-105) AND captioned "travels into
the export (<file>.csv)"** — the §9-5 story honest on both surfaces. Export controls use the **§5.4
anatomy** (Download icon + label). **NO Reports Pack entry point** (Amendment K phasing corollary — D-041
preserved, recorded not rendered) and **NO AI-helper placeholder** (Amendment K, D-060 intact) — the
specimen shows exactly what ships.

**Honesty frames staged:** an **EMPTY YEAR** (Realised P/L for a year with no sales → `EmptyState` with a
reason; the year filter + Export stay — an empty year's export is an honest empty file, not an error) and
**NO OPEN LOTS** (`EmptyState`). The non-zero excluded-FX-events count is rendered in the populated frame;
a long institution/symbol name truncates in the identity cell.

**Frame = the REAL content region** (`ks__viewport--scroll`, 1440×724 = viewport − chrome − shell
padding) fed **real-shaped data**, per the page-home gate-artifact rule. **Media-query / overflow regions
are a §13c pre-pass check at REAL viewports** (the fixed sidebar eats width) — NOT claimed on this static
specimen (TEMPLATE §7 exception); nothing responsive is guarded here.

**Checks:** frontend `npm run check` **EXIT 0** from `frontend/` (250 passed = vitest + all Playwright,
incl. `overflow.spec.ts`). Both themes captured: `docs/plans/assets/reports-specimen-{light,dark}.png`
(the capped real content-region frame) + `reports-specimen-full-{light,dark}.png` (the full populated
mockup, so the totals block + excluded-count + tax-lots are visible in one view).

**STOP — owner ratifies the geometry before Phase 1.** Open questions for the walk: does the composed
Overview reading order (Statements → Realised P/L → Open tax lots) lead correctly; is the read-only
threshold line clear (Amendment J); do the in-page disclaimers + "travels into the export" captions read
honestly without copy-hygiene leaks.

**§11 evidence — Phase 0a row:**

| # | Deliverable | Check | Where |
|---|-------------|-------|-------|
| 0a | Reports LAYOUT SPECIMEN (Overview; 3 stacked owned sections + 2 honesty frames; served disclaimers travel-noted; read-only threshold; no Pack / no AI) | frontend `npm run check` **EXIT 0** (250 passed) from `frontend/` | `/kitchen-sink` → "Reports — LAYOUT SPECIMEN"; `assets/reports-specimen*.png` |

---

## 12 — GEOMETRY GATE RULING: **RATIFIED WITH CONDITIONS (owner, 2026-07-17)**

**The owner ratified the Phase-0a specimen geometry BY LOOKING** (the Overview reading order Statements
→ Realised P/L report → Open tax lots; D-100 cards; header-outside-scroll; served disclaimers in-page +
travel-noted; read-only threshold; no Pack / no AI). The ⏸ block above flips to **RATIFIED WITH
CONDITIONS** — one ruling and three conditions carry into Phase 1 assembly. Recorded verbatim (nothing
struck); each item's Phase-1 disposition is in §13.

| # | Ruling / condition (owner 2026-07-17) | Phase-1 obligation |
|---|----------------------------------------|--------------------|
| **§12rp-1** | **RULING (option b):** the **Statements table stays ALL-YEARS** — the historical rollup is the value. The **Year control moves/relabels to sit VISIBLY on what it scopes**: the **Realised stat + the `statements.csv` export**. *Owner rationale, recorded:* **a control must clearly indicate what it governs; reporting ambiguity is the failure mode.** | Assemble so the scope is **unmistakable** — the Year control lives WITH the Realised stat + Export group, labelled for them, **clearly NOT a table filter**. The all-years income/fees/cash-flow table carries no year control; the scoped group (Year → Realised stat + Export) is visually distinct. A card-anatomy deviation is **flagged, not drifted** (see §13 — the statements export is made to honour the year so the scope reaches the artifact). |
| **§12rp-2** | **CONDITION:** the **Realised P/L table carries PER-ROW currency** — a **Currency column** (the tax-lots table's precedent) or the §12in-1 per-row code affix on Gain (native). **One pattern, applied consistently with the tax-lots table.** | The realised events (served grouped by native currency) flatten into one table with a **Currency column** — the SAME pattern the open-tax-lots table already uses (Currency column). Gain is labelled **"Gain (native)"**; the Currency column names the native currency per row. |
| **§12rp-3** | **CONDITION:** the **Statements Realised stat and the Realised P/L current-FX total must be ONE truth** — verify with file:line; one derivation consumed twice = fine (record it); two derivations → pin equality with a backend test (Review-headline precedent) or reshape to one reader. **Evidence in §13 either way.** | **Verify-first VERDICT (file:line):** `statements_report` DERIVES its realised figure by calling `realised_gains_report` (`statements.py:106`) and consuming `base_realised_total_current_fx` (`statements.py:143`) — **one derivation** — BUT re-rounds it via `_f` **default `p=0`** (`statements.py:42-43`), so the served statements figure **dropped the cents** and could disagree on-screen with the realised card/export (14,820 vs 14,820.37). **RESHAPE TO ONE TRUTH:** serve the statements realised at 2dp (`_f(…, 2)`) so `statements_report(Y).realised_unrealised.realised == realised_gains_report(Y).base_realised_total_current_fx`, **pinned by a fail-first backend equality test** (RED on `p=0`). Evidence in §13. |
| **§12rp-4** | **RATIFIED AS SHOWN:** the **subtitle (protected copy)**, both **EmptyState wordings**, the **travels-into-export captions**, the **section order**. The subtitle's claim — *"Every export carries the same disclaimers you see here"* — is now a **TESTABLE PROMISE**; Phase 2's artifact guards are what keep it true. | Render the ratified subtitle + both EmptyState wordings + the travel captions **verbatim** (protected copy). Phase 2 ships **artifact-level journey guards** that download each real export and assert the disclaimers are INSIDE the file — the promise is mechanised, not asserted.

**§12 flips ⏸ → RATIFIED WITH CONDITIONS (owner, 2026-07-17). Phase 1 assembly is UNBLOCKED.**

---

## 13 — PHASE 1/2/3a BUILD RECORD (2026-07-17)

**Phase 1 (assembly) + Phase 2 (tests) + Phase 3a (scripted pre-pass) DONE — GREEN, AWAITING THE OWNER
WALK. Phase 3b NOT started (no self-certification).** Commits: `3280d00` (§12 + backend deltas) ·
`5a4e037` (Phase 1 + 2) · `233e640` (Phase 3a). `npm run check` from `frontend/` **EXIT 0** (251 vitest
+ 262 Playwright). Full backend suite **845 passed**; `make api-contract-check` **GREEN** (no path change).

### 13-1. Backend honesty deltas the §12 conditions forced (fail-first RED → GREEN)

| Δ [cond] | Fail-first RED (real cause) | GREEN (pin) | file:line |
|----------|-----------------------------|-------------|-----------|
| statements realised served at 2dp = the realised reader's total [§12rp-3] | `test_statements_realised_equals_the_realised_gains_reader` RED on the pre-ruling `_f` **default p=0** — statements served **804.0** while the realised reader served **804.5** (cents dropped, the two surfaces disagreed) | `_f(…, 2)` so `statements_report(Y).realised_unrealised.realised == realised_gains_report(Y).base_realised_total_current_fx`; **verified LIVE (both 804.50 SGD)** | `statements.py:143`; reader call `:106`; `_f` `:42-43` |
| statements.csv honours the scoped year [§12rp-1] | `test_statements_csv_honours_the_selected_year` RED on the pre-ruling builder — the file carried **no year anywhere**, so the two years produced identical text and the Year control governed a file it could not change | title + a **Selected-year summary block** + the **filename** now carry the year; the by-year rollup stays all-years | `statements.py:151-177`; filename `portfolio.py:1082-1085` |

### 13-2. §12rp-3 VERDICT (the one-truth evidence)

**ONE derivation, reshaped to render identically.** `statements_report` computes its realised figure by
**calling `realised_gains_report`** (`statements.py:106`) and consuming `base_realised_total_current_fx`
(`statements.py:143`) — there is no second code path. The only defect was a **lossy re-round** (`_f`
default `p=0`); serving it at 2dp makes the two surfaces byte-identical, and a **fail-first backend
equality test pins it** (RED on p=0, GREEN at p=2). The Reports page renders the Statements Realised stat
from `realised_unrealised.realised` and the Realised P/L current-FX total from the realised reader — proven
equal on-screen (both **804.50 SGD** live) and in the render test.

### 13-3. Phase 1 assembly (`5a4e037`)

`frontend/src/api/reports.ts` (typed clients + export paths) · `Reports.tsx` + `Reports.css` (three D-100
cards per the RATIFIED geometry) · `nav.ts` (`/reports` → `built:true`) · `AppRoutes.tsx` (route) ·
`glossary.ts` (`term-statements` / `term-realised-pl` / `term-tax-lot` popover mirrors — spec spellings in
`GLOSSARY.md`, parity policed) · `overflow.spec.ts` (`/reports` in all three route arrays) ·
`AppShell.test`/`chrome.test` updated (Reports is now a built route/nav entry).
- **§12rp-1:** the Statements TABLE is all-years; a bordered SCOPED GROUP (`data-scope="statements-year"`,
  labelled *"Realised figure & export — for year"*) holds the Year control + Realised stat + Export,
  visibly NOT a table filter.
- **§12rp-2:** the Realised P/L table carries a per-row **Currency** column — the SAME pattern the
  open-tax-lots table uses (live: tax-lots spans **USD / SGD / INR**).
- **§12rp-4:** the subtitle, both EmptyState wordings, the travel captions and the section order render
  verbatim (protected copy); the served disclaimers render VERBATIM (D-105).
- **Amendment J** read-only threshold (365, no input); **Amendment K** — NO Pack entry point, NO AI
  placeholder. **[S]-gate absence recorded** (the Estate §9-3 pattern): Reports is read/export-only — no
  mutation, so no PIN gate, no request-body assertion, no round-trip import test. Absence as a decision.

### 13-4. Phase 2 tests — the artifact-guard RED proof is the headline

- **Render guards** (`Reports.test.tsx`, 9): §12rp-1 all-years table + Year-scoped stat/export (BOTH
  behaviours), §12rp-2 per-row currency, §12rp-3 one-truth, both base totals + the non-zero excluded
  count (and HIDDEN at zero), verbatim disclaimers + travel captions, read-only threshold (no input),
  EmptyStates, honest per-card error.
- **⚑ Artifact-level JOURNEY guards** (`e2e/smoke/reports-artifact-smoke.spec.ts`, DEV-ONLY): for EACH
  Export control, Playwright clicks the REAL button, captures the DOWNLOAD, and asserts INSIDE the file —
  the served disclaimer; for `realised-gains.csv` the trade-date-FX total + excluded-count rows; for
  `statements.csv` the scoped year in BOTH content and filename. **FAIL-FIRST PROOF:** a test routes a
  **stubbed statements.csv stripped of the disclaimer** and asserts the downloaded bytes do NOT contain
  it — proving the guard reads the **file**, not the DOM (which shows the disclaimer regardless). Live:
  **4/4 GREEN incl. the fail-first.**

### 13-5. Phase 3a — scripted pre-pass (GREEN, on a reset demo-seeded instance)

`e2e/smoke/reports-smoke.spec.ts` (DEV-ONLY) drove the LIVE app + real backend:
- **both themes × 320/375/900/1366:** containment (doc + `.lf-shell__content` h-overflow ≤ 1px), one
  vertical scroll region, every card OUT of skeleton, **0 console errors** — 8/8 GREEN.
- **year round-trip** (populated **2024** ↔ empty **2023**): the empty year shows the ratified EmptyState
  and keeps the filter + Export + disclaimer alive; round-trips back — GREEN.
- **symbol link** (`AAPL` in a report row) lands on **Instrument Detail** (D-098) — GREEN.
- Screenshots: `e2e/smoke/artifacts/reports-{light,dark}-1366.png`.
- **Pre-pass finding, FIXED in-session (`233e640`):** the Realised Year dropdown offered only
  `realised.years` (years WITH sales), so an empty year was unselectable and the ratified EmptyState +
  round-trip were unreachable. Fix: both Year controls offer the **union** of the two readers' year lists
  (all ledger years). Also pluralised the excluded caveat ("1 event" vs "N events").

### 13-6. Walk-data observation (for Phase 3b — NOT a defect)

The demo seed has a **single realised sale** (AAPL, 2024) with **no stored trade-date FX rate**, so the
Realised P/L card shows current-FX **804.50 SGD** vs trade-date-FX **0.00 SGD** with *"1 event excluded"*.
This is honest (the one event genuinely lacks a stored rate) but a **thin/degenerate divergence**. The
per-row Currency column is richly exercised by the **open-tax-lots** table (USD/SGD/INR); the realised
table shows one currency. If the owner wants a richer walk artifact (both base totals non-zero + excluded
> 0, multi-currency realised), that is a **demo-seed enrichment** (add a foreign-currency sale WITH a
stored `fx_to_base` + keep one excluded) — seed changes unit-verified per the precedent. Recorded here as
a judgment item; not built (no self-certification; the seed already exercises the excluded case).

**Phase 3a GREEN → the owner walk (Phase 3b / §14) is below.**

---

## 14 — PHASE 3b OWNER ACCEPTANCE WALK — CLOSED ✅ (batch 1, three findings; owner ACCEPTED 2026-07-17)

**The owner walked `/reports` with the REAL exports opened in LibreOffice + Excel (2026-07-17).** Three
findings, everything else accepted. All three are **backend-first, one delta per commit, fail-first** —
each pin updated in the same commit as its reshape; the artifact journey guards re-run **4/4 GREEN live**
against the fixed backend. Acceptance is **CONTINGENT on this batch** (owner, 2026-07-17); the batch shipped.

| # | Finding (owner walk) | Fix + fail-first proof | Commit / evidence |
|---|----------------------|------------------------|-------------------|
| **§14rp-1** | **statements.csv omitted the Realised/Unrealised figures its card renders.** An export must mirror its section. | statements.csv gains a **stat block**: **Realised (selected year)** as a YEAR-SCOPED row, **Unrealised** as an explicit **AS-OF row** (label carries the export date — *"open positions, as of YYYY-MM-DD"* — so a now-snapshot never reads as a year figure inside a yearly artifact). `statements_report` serves `as_of` (ISO). Realised is the **same one-derivation figure** as realised-gains.csv (§12rp-3 — one truth, two files, not two derivations). **Fail-first:** `test_statements_csv_carries_the_realised_and_unrealised_stat_block` RED on the pre-walk builder (wrote neither) → GREEN; the artifact journey guard extends to assert both rows in the downloaded file. | `a3be92b` · live guard log: *"disclaimer+realised+unrealised=present"* · screenshot `assets/reports-csv-fixed-2026-07-17.png` (Realised 804.50 SGD · Unrealised as-of 2026-07-16 103053.0 SGD) |
| **§14rp-2** | **All four CSVs shipped internal snake_case column headers.** | realised-gains / tax-lots / attribution headers → **HUMAN TITLES** ("Sold date", "Holding days", "Long term", "Gain (native)", "Asset class", "Contribution %", …) from the GLOSSARY vocabulary where a term exists, plain English otherwise; statements was already human. **Deliberate counterpart recorded:** DATA CELLS stay **MACHINE NUMERICS** (raw numbers, ISO dates, yes/no) — display strings are a rendered-UI rule (D-105), **not** a data-artifact rule; a CSV must remain computable. Pins updated same commit + `test_report_csv_headers_are_human_but_data_cells_stay_machine` (both halves). **DESIGN-SYSTEM §5.1 "Export artifacts"** note added (titles human · data machine · disclaimers always · utf-8-sig always). **attribution.csv changed again** → dated addendum in `page-portfolio.md §12-6b` (export stays Portfolio-owned, §9-13). | `691d794` · screenshot columns visible |
| **§14rp-3** | **Excel showed the em dash garbled (`â€"`)** — the CSVs shipped UTF-8 **without a BOM** and Excel decoded cp1252. | **ALL CSV endpoints emit `utf-8-sig`** through one home, `_csv_response(body, filename)` (the seven: statements · realised-gains · tax-lots · attribution · holdings · transactions · import-template). The importer already decodes `utf-8-sig`, so the BOM **round-trips losslessly** (transactions/template re-import guards post the BOM'd bytes and still import clean). **Fail-first at the BYTE level:** `tests/integration/test_csv_encoding.py` asserts each artifact's raw bytes begin with `EF BB BF` (RED today) **and** that the files still parse WITH the BOM. Line-0 header pins in the round-trip + holdings tests updated to decode `utf-8-sig`. | `750d99e` · live: all four downloads BOM=True, em dash decodes to **—** (cp1252-on-BOMless would show `â€"`) |

**§12rp-4's testable promise now has three more teeth** — the subtitle *"Every export carries the same
disclaimers you see here"* is guarded not only by the disclaimer journey guards but by the **stat block**,
the **human-title pins**, and the **byte-level BOM guard**. All three findings mechanised, not just fixed.

**Re-run at close (all GREEN):** artifact journey guards **4/4 live** (incl. the fail-first stubbed proof);
backend suite **849 passed**; `make api-contract-check` **GREEN** (header/encoding changes are content, not
shape — **no path change**, 131 paths); frontend `npm run check` **EXIT 0** from `frontend/` (251 vitest +
262 Playwright — no frontend source touched by the batch). Four CSVs re-downloaded from the live backend and
open-verified (BOM present, human headers, disclaimers travel, stat block, em dash correct).

**Acceptance (owner, 2026-07-17):** `/reports` **ACCEPTED** — §14 batch 1 (three findings) FIXED + accepted
(contingent on the batch, now shipped); everything else on the walk accepted. **No ⏸ remains** on this page.

---

## 15 — §14 STRIKE-CHECK + RETROSPECTIVE (lessons MECHANISED)

**Strike-check — every §9 / §12 / §14 item verified against the ACTUAL diff (`8a2f1fe..HEAD`), a claim is
not a change (§13-2 rule):**

- **§9-4** tax-lots.csv route — present (`portfolio.py`, contract 131 paths). ✓
- **§9-5** disclaimer reshapes (realised-gains / attribution / statements) — present + pinned; **now also
  carry human headers (§14rp-2) + the BOM (§14rp-3)**. ✓
- **§9-7 / Amdt J** served-default-365 read-only, no store built — unchanged. ✓
- **§9-9** GLOSSARY "Report" — authored spec-first, **now flipped PROPOSED→RATIFIED** (this walk). ✓
- **§12rp-1** all-years table + Year-scoped stat/export — shipped; the statements export now ALSO carries the
  Realised/Unrealised stat block (§14rp-1) with the scoped year. **Control-group placement ratified as
  shipped.** ✓
- **§12rp-2** per-row Currency column on Realised P/L — shipped; the CSV's Currency header is human. ✓
- **§12rp-3** one-truth (statements Realised == realised reader's current-FX total) — held; the stat block
  writes the SAME derivation (804.50 both, live). ✓
- **§12rp-4** protected copy + the testable subtitle promise — three new guards (§14). ✓
- **§14rp-1/2/3** — the three walk findings, each FIXED + pinned (above). ✓
- **Amendment-I (declined-exports ledger) is EXPLICITLY NOT CLOSED here** — it closes at the **Reports Pack
  milestone** (the five Pack-delivered dispositions stay PENDING; `CURRENT.md` keeps the ledger line). ✓

**Lessons MECHANISED (a lesson recorded but not mechanised recurs — the standing rule):**

- **(a) Export artifacts are guarded at the BYTE level as well as the content level — encoding is part of
  honesty (§14rp-3).** The disclaimer journey guards read the *decoded text* and were green while Excel
  garbled the em dash, because the defect was **below** the text — the byte encoding. The **BOM test**
  (`test_csv_encoding.py`, asserting `EF BB BF` on each artifact + a clean parse with the BOM) is the
  mechanism. **Folded into `TEMPLATE-page-build.md §7`** as an artifact-guard line: *a content guard proves
  the right characters; a byte guard proves the right bytes — an export needs both.*
- **(b) An export mirrors its section — a figure rendered on a card belongs in that card's artifact, with
  now-snapshots explicitly as-of (§14rp-1).** The earlier "keep realised in exactly one file" instinct
  (§12rp-3) confused *one derivation* with *one file*; the owner wants the card's figures in the card's
  export. The as-of label is what keeps a now-snapshot honest inside a period artifact. **Folded into the
  DESIGN-SYSTEM §5.1 "Export artifacts" note** (disclaimers-always + as-of snapshots).
- **(c) Titles human, data machine (§14rp-2)** — D-105's pre-formatted-display-string rule is a *rendered-UI*
  rule, not a *data-artifact* rule. A CSV header is UI (name it in the user's words); a CSV cell is data
  (keep it computable). **Folded into the DESIGN-SYSTEM §5.1 "Export artifacts" note** + pinned both halves.

**One home for the honesty:** the three rules (titles human · data machine · disclaimers always ·
utf-8-sig always) live in **DESIGN-SYSTEM §5.1 "Export artifacts"** and are enforced by `_csv_response`
(BOM) + the same-batch code tests (headers/disclaimers/stat block). The next export page copies the note,
not a per-endpoint habit.

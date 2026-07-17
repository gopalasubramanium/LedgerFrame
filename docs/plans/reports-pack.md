# reports-pack — Reports Pack (`/reports/pack`) MILESTONE plan

**Status: PHASE 0a GEOMETRY RATIFIED WITH CONDITIONS (owner, 2026-07-17) — §9 RESOLVED (owner one-pass
2026-07-17, all 9 ACCEPTED as proposed) · Phase 0 (print palette + GLOSSARY + the `/reports/pack` route
+ docs) SHIPPED · Phase 0a PRINT-GEOMETRY ratified with four conditions (§12pk-1..4, §7a).** Phase 1
(the four condition fixes + the Reports-page entry point) is UNBLOCKED and lands THIS session; the
owner acceptance walk (Phase 3b) + the Amendment-I ledger flip are a SEPARATE session. This is a
**milestone plan for a sanctioned print/export artifact — the Pack is NOT an IA page (D-038).** It inherits the Reports-page rulings already
in hand (page-reports §9: 9-1 / 9-2 / 9-11 / 9-12 / 9-13 + Amendment I) — those are **cited,
not re-decided**. Every claim below carries a file:line cite (verify-first, D-019). Build does
not start until §9 is passed.

**This milestone closes the Amendment-I declined-exports ledger** (page-reports §9, Amendment I):
the five Pack-delivered dispositions (Policy drift · Net worth trend · Review · Scenarios · Cash
flow) each map to a named Pack section in the **ledger-mapping table (§0)**; the milestone's close
flips them **PENDING → DELIVERED** with that table as evidence.

**Rulings already in hand — cite, do NOT re-litigate (page-reports §9, owner 2026-07-17):**
- **9-1** — rendering = **server-rendered print-optimised HTML** at `/reports/pack` with `@media
  print`; **browser print-to-PDF is the export path; NO PDF dependency without an ADR.**
- **9-2** — per-entity sections are **SERVER-COMPOSED**: the backend iterates the user's entities
  and calls each canonical reader with `entity_id`; the param stays **UI-dormant** (honours
  accounts §9-8 — no switcher).
- **9-12** — section → reader map ratified: **consolidated** = net-worth trend + review;
  **per-entity** = value_portfolio · policy-drift · realised P/L · risk · attribution.
  **Re-verified in §10-1, NOT re-litigated.**
- **9-13** — **attribution appears ONLY inside the Pack** (its standalone CSV stays Portfolio's);
  the §9-5 disclaimer fix already shipped on `attribution.csv` (page-reports §11).
- **9-11 / Amendment K** — the Pack is its **own milestone** (this one); the **Reports-page entry
  point ships THIS milestone** (the artifact will exist, so the link may — D-041 Reports-only
  preserved).

---

## 0. THE AMENDMENT-I LEDGER-MAPPING TABLE (the milestone's close evidence)

*Every one of the five Pack-delivered declined exports (page-reports §10-2) maps to a named Pack
section composed from that page's canonical reader. Two do NOT map to the ratified §9-12 list —
they are **Pack-1** (⚑ §9). None may be silently dropped (Amendment I).*

| # | Declined export (source) | Canonical reader (file:line) | Entity axis (verified) | Pack section | Maps to §9-12? |
|---|--------------------------|------------------------------|------------------------|--------------|----------------|
| 1 | **Policy drift** (`page-policy §9-20`) | `compute_drift` `app/services/policy.py:108-219` | **per-entity** — `entity_id` honoured `:108,:112` | per-entity **"Policy drift"** — LIVE `reports_pack._entity_drift` (`app/services/reports_pack.py`) | **YES** (§9-12 per-entity drift) |
| 2 | **Net worth trend** (`page-net-worth ND-14`) | `net_worth_history` route `app/api/v1/routes/portfolio.py:894-906` | **consolidated-only** — NO `entity_id`; reads `NetWorthSnapshot` (not entity-scoped) | consolidated **"Net worth trend"** — LIVE `reports_pack._consolidated_net_worth_trend` | **YES** (§9-12 consolidated) |
| 3 | **Review** (`page-review ND-10`) | `review_report` / `review_centre` `app/services/review.py:86-260,285-349` | **consolidated-only** — NO `entity_id` (`:86,:285`) | consolidated **"Review"** — LIVE `reports_pack._consolidated_review` | **YES** (§9-12 consolidated) |
| 4 | **Scenarios** (`page-scenarios §9-12`) | `scenario_report` `app/services/scenarios.py:49` | **household-only — per-entity ACTIVELY REJECTED** (400 `portfolio.py:1043-1044`; `ValueError` `scenarios.py:54-55`) | consolidated **"Scenarios" (Pack-1 NEW)** — LIVE `reports_pack._consolidated_scenarios` | **NO → Pack-1 ⚑ (RESOLVED — extended, §9)** |
| 5 | **Cash flow** (`page-cash-flow §9-14`) | `obligations_report` `app/services/planning.py:135`; `goals_report` `:98`; `contributions_report` `app/services/contributions.py:115` | **household-only** — readers take **only `session`**, no `entity_id` seam (D-057) | consolidated **"Cash flow" (Pack-1 NEW)** — LIVE `reports_pack._consolidated_cash_flow` | **NO → Pack-1 ⚑ (RESOLVED — extended, §9)** |

**Mapping verdict:** 3 of 5 map cleanly to a ratified §9-12 section. **Scenarios and Cash flow do
NOT** — both are **household-scoped** (Scenarios rejects `entity_id` by design as an "API honesty
trap", `portfolio.py:1040-1042`; Cash flow has no entity dimension at all), so **per-entity
composition is impossible** for them. They can only live as **consolidated-only** subsections. The
ratified §9-12 consolidated list names only *net-worth trend + review*. → **Pack-1 (⚑): extend the
consolidated section to add household-scoped Scenarios + Cash-flow subsections, or re-declare their
disposition.** Recommendation in §9. **The ledger stays PENDING in `CURRENT.md` until this
milestone's close** (Amendment I); the close flips all five PENDING → DELIVERED against this table.

**Pack-1 RESOLVED (owner 2026-07-17):** the consolidated section is extended with Cash flow +
Scenarios subsections (page-reports §9-12 dated amendment). **Phase 0 has BUILT all five sections**
(the LIVE anchors above name their `reports_pack.py` renderers) — **evidence is now STAGED for the
close**. Per Amendment I the **ledger itself still flips PENDING → DELIVERED only at THIS milestone's
close** (after the owner acceptance walk), not at Phase 0; this table is that close's evidence.

---

## 1. IDENTITY — an ARTIFACT, not an IA page

*The Pack is a **sanctioned artifact**, not an IA page (`INFORMATION-ARCHITECTURE.md:92`, D-038).
The IDENTITY table is adapted: no nav group, no rotation, no figure ownership.*

| Field | Value | Spec ref |
|-------|-------|----------|
| Artifact name | **Reports Pack** | `GLOSSARY.md:279`, D-038 |
| Route | `/reports/pack` — **backend-served HTML** (not an SPA route) | `INFORMATION-ARCHITECTURE.md:92`, 9-1 |
| Nav group | **NONE** — not in the sidebar; reachable **from Reports ONLY** | `INFORMATION-ARCHITECTURE.md:92`, D-041 |
| Template | **Dedicated PRINT layout — NOT one of the four page templates** | `DESIGN-SYSTEM.md:223,235-236` |
| Rotation | **N/A** (not a page) | — |
| One-line purpose | "A print-optimised consolidated + per-entity report artifact, composed from canonical readers, disclaimers preserved." | `INFORMATION-ARCHITECTURE.md:355-358` |
| Rendering | **Server-rendered print-optimised HTML** with `@media print`; browser print-to-PDF is the export path; **no PDF dependency** (9-1) | 9-1 |
| Composition | **Server-composed** — backend iterates `list_entities` and calls each reader with `entity_id`; the param stays UI-dormant (9-2) | 9-2 |

---

## 2. OWNERSHIP — the ONE sanctioned duplication (verbatim, do not drift)

*The Pack is **excluded from the canonical-home discipline** — it owns and re-derives NOTHING; it
assembles the canonical readers. The exception is quoted verbatim.*

**The Reports Pack exception (`INFORMATION-ARCHITECTURE.md:41-49`, VERBATIM):**

> **The Reports Pack exception (D-038, verbatim):**
> > **Reports Pack = the one sanctioned duplication**: a print/export artifact
> > composed from canonical readers, disclaimers preserved — not a page in the
> > IA sense.
> The Reports Pack is therefore excluded from the canonical-home discipline: it is
> an artifact assembled from the canonical readers, not a page that owns or
> re-derives anything (D-061).

**The Pack's composition (`INFORMATION-ARCHITECTURE.md:353-358`, VERBATIM):**

> ### Reports Pack (`/reports/pack`) — D-038, D-061
> - **Nature:** the one sanctioned duplication — a print-optimised artifact, not an
>   IA page. Consolidated section (net-worth trend + review) then **per-entity
>   sections** (P-3): net worth, drift, realised, risk + attribution. Composed
>   **from canonical readers**, disclaimers preserved. Reachable from Reports only.

**Enforcement corollary (P-1 / D-031 / D-061):** the Pack **adds no figure its readers do not
already produce**. Every number is a canonical-reader output rendered as the backend served it (no
frontend money math, D-105). It **never re-derives** (`INFORMATION-ARCHITECTURE.md:355-358`). The
per-entity sections are a **filter of a canonical reader** (P-3), server-composed (9-2), never a
recompute or a second code path.

**Links (D-041):** reachable **from Reports only** — the Reports-page entry point ships this
milestone (§8 Phase 2). No sidebar entry, no other inbound link.

---

## 3. API SURFACE

*Source: API-CONTRACT.json (frozen baseline, 131 paths after page-reports Phase 0) +
API-CONTRACT.md delta table. The Pack **composes readers server-side** — it calls the service
functions directly (not over HTTP), iterating entities. So it consumes reader **functions**, and
adds exactly **one new route** (the HTML artifact).*

### 3a. Readers consumed (service functions, already in the app — verified §10-1)

| Reader (service fn) | file:line | Section it composes | `entity_id`? | Empty behaviour |
|---------------------|-----------|---------------------|--------------|-----------------|
| `net_worth_history` (route reads `NetWorthSnapshot`) | `portfolio.py:894-906` | consolidated net-worth trend | **N** (consolidated-only) | `{"history":[]}` |
| `review_report` / `review_centre` | `review.py:86-260,285-349` | consolidated review | **N** (consolidated-only) | fallback item "Nothing needs a look right now." |
| `scenario_report` *(Pack-1)* | `scenarios.py:49` | consolidated scenarios (proposed) | **N — rejects** `entity_id` | `asset_scenarios`/`liquidity` computed household-wide |
| `obligations_report` / `goals_report` / `contributions_report` *(Pack-1)* | `planning.py:135,98`; `contributions.py:115` | consolidated cash flow (proposed) | **N** (household-only) | empty rows / zero totals |
| `value_portfolio` | `portfolio.py:392-435` | per-entity net worth | **Y** `:393,:407-409` | zeros; `has_stale=False` |
| `compute_drift` | `policy.py:108-219` | per-entity drift | **Y** `:108,:112` | `dimensions=[]`, `has_targets=False` |
| `realised_gains_report` | `tax.py:284-371` | per-entity realised | **Y** `:285,:291` | `currency_groups=[]`, zeros |
| `risk_metrics` | `analytics.py:678-711` | per-entity risk | **Y** `:678,:695,:699` | `available=False`, metrics `None` |
| `attribution` | `analytics.py:560-583` | per-entity attribution (9-13) | **Y** `:561,:577,:580` | `available=False`, `reason="insufficient cost basis…"` |
| `list_entities` (entity enumeration) | `accounts.py:160-164`; route `GET /entities` `accounts.py:51-55` | drives the per-entity loop | — | `[]` (zero-entity case → Pack-4) |

### 3b. Contract delta (BUILD BACKEND-FIRST — CONTINGENT on §9)

| kind | Endpoint | Contingent on | Why |
|------|----------|---------------|-----|
| **add** | `GET /reports/pack` → **`HTMLResponse`**, `response_class=HTMLResponse`, self-contained (inline CSS, **no app JS**) | Pack-1 (section set) · Pack-2 (print palette) · Pack-5 (header/disclaimers) · Pack-10 (access/self-containment) | The one new route. It imports the reader service fns, iterates `list_entities`, and composes one HTML document. **Regenerate `API-CONTRACT.json` + `docs/openapi.json` same commit** (131 → 132 paths). |

**Serving mechanics (verify-first, §10-3) — NO new dependency:**
- The SPA is served by a **catch-all** `@app.get("/{full_path:path}")` at `app/main.py:212-227`
  (returns `FileResponse(index.html)` for unmatched non-`api/` paths). **A `/reports/pack` route
  must register BEFORE this catch-all** (routes match in registration order; the catch-all is
  added last). Either add it in `app/main.py` above `:212`, or on the versioned API router.
- **No Jinja2 / templates precedent exists** (`grep HTMLResponse|Jinja|Template app/` → none);
  Jinja2 is **NOT** a dependency (`pyproject.toml`). **Adding Jinja2 would need an ADR** — so the
  Pack composes HTML by **f-string / string composition** returned via `HTMLResponse`, the exact
  analog of the existing `PlainTextResponse` CSV pattern (`portfolio.py:10,63-67`;
  `_csv_response` `:63-67`). **No new dependency, no ADR** (consistent with 9-1's "no PDF dep").

---

## 4. COMPONENTS — a DEDICATED print layout (not the ratified page inventory)

*The Pack "uses a **dedicated print layout, not one of the four** templates"
(`DESIGN-SYSTEM.md:235-236`). It is a **backend-rendered self-contained HTML document** — it does
**NOT** compose the React `src/components/ui/` inventory (no app JS runs in the artifact,
Pack-10). Its "components" are print-layout primitives authored in the artifact's inline CSS.*

**Affordances the ratified inventory does NOT cover (amendment required — see §9):**
- **A print palette + print stylesheet** — the platform is dark-theme, token-driven
  (`frontend/src/theme/tokens.css`); **no `@media print` rule, no print palette, no print tokens
  exist anywhere in `frontend/src`** (verified §10-2). Dark backgrounds do not print. **→ Pack-2
  (⚑): author a minimal print palette (light bg / dark text) + page rules, spec-first
  (DESIGN-SYSTEM amendment).** The **light theme** (`tokens.css:22-64`) is the natural donor.
- **Page-break + section-header primitives** — per-section page breaks (`break-inside: avoid` per
  card, `break-before: page` per top-level section), a repeating artifact header, per-section
  disclaimer blocks. None exist in the ratified inventory (it is screen-only). Authored in the
  print stylesheet under Pack-2.

**Rules the artifact still honours:**
- **Disclaimers preserved (D-061 / D-105):** every reader's served `disclaimer` string renders
  **verbatim** in its section; disclaimer-less sections rely on the artifact header (Pack-5).
- **No frontend money math:** every figure is the backend-served string/number (D-105). Note
  `value_portfolio` returns a **`PortfolioValuation` object, not a dict** (`portfolio.py:392-435`)
  — the Pack reads its fields (`total_value`, `cost_basis`, `unrealised_pl`, …), never recomputes.
- **Entity references (D-098):** symbols in realised / attribution rows — in a **print** artifact,
  links are inert; render the symbol as text (a print artifact is read on paper). Confirm in §9
  (part of Pack-6/section spec) whether any live link is retained for the on-screen rendering.

---

## 5. VOCABULARIES

| Field in the artifact | Vocabulary / master | Control | Ref |
|-----------------------|---------------------|---------|-----|
| **Entity** (per-entity section headers) | **user-record** (entities) — server-composed, NOT a `MasterSelect`/switcher (9-2) | none (server loop) | `list_entities` `accounts.py:160-164`; `ENTITY_KINDS` `entities.py:20` |
| **Base currency** (artifact header) | user setting (`base_currency`, served by each reader) | display-only | e.g. `tax.py:352-370` |
| **"Consolidated" / "Per-entity"** section-header terms | **GLOSSARY** — **BOTH MISSING** (`GLOSSARY.md`: only "Reports Pack" `:279`, "Entity" `:68`) | display copy | **→ Pack-7 (spec-first)** |

**No categorical MASTER-DATA input** — the Pack has no user input at all; it is a read-only
server-composed artifact.

---

## 6. DECISIONS IN FORCE

| Decision | What it requires of the Pack |
|----------|------------------------------|
| **D-038** (`DECISIONS.md:290-294`) | The Pack is the **one sanctioned duplication** — a print/export artifact from canonical readers, **not an IA page**. |
| **D-061** (`DECISIONS.md:347`) | Consolidated + per-entity sections (P-3), print-optimised, **composed from canonical readers, disclaimers preserved**, reachable from Reports only. |
| **D-041** (`DECISIONS.md:307-308`) | Reachable **from Reports ONLY** — no sidebar entry, no other inbound link. |
| **D-105** | The backend serves pre-formatted display strings; the Pack renders them **verbatim** (reader `disclaimer` strings, money displays). |
| **D-050 / P-5** | Server composes the artifact; the client never generates the file (browser print-to-PDF is a print action, not client file generation). |
| **Guarantee 3** (`PRODUCT-SPEC.md:66-67`) | Every empty region shows a **reason**; an empty entity/section renders an honest note, never a blank or fabricated zero (→ Pack-3). |
| **Guarantee 2 — "No advice"** (`PRODUCT-SPEC.md:64-65`) | The artifact carries the not-advice posture; each reader's "reporting only, not advice" disclaimer travels (→ Pack-5). |
| **Export-artifacts standard** (`DESIGN-SYSTEM.md:430-442`) | "Disclaimers always" + now-snapshot "as-of" apply to the artifact (content-level). Scope-to-print is **Pack-8**. |
| **P-1 / D-031** | Every figure has ONE canonical home; the Pack **links/composes, never re-homes** — attribution stays Portfolio's (9-13). |
| **9-2 / accounts §9-8** | `entity_id` stays **UI-dormant** — server-composed sections, no interactive switcher. |

---

## 7. ACCEPTANCE CRITERIA — adapted for a PRINT ARTIFACT

*The Pack has no data entry → the mutation criteria (PIN gate, request-body assertion, round-trip
import) are **recorded chosen absences**. The geometry gate is adapted for print (below).*

- [ ] **Composition:** `/reports/pack` renders a **consolidated section** (net-worth trend +
      review [+ cash flow + scenarios if Pack-1 extends]) then a **per-entity section per entity**
      (net worth · drift · realised · risk + attribution), each from its canonical reader
      server-composed with `entity_id` (9-2).
- [ ] **Disclaimers preserved (D-061 / D-105):** every reader's served `disclaimer` renders
      verbatim in its section; the **3 disclaimer-less sections** (net-worth trend, value_portfolio
      net worth, risk) are covered by the artifact header (Pack-5). **An artifact-level journey
      guard asserts each disclaimer is present INSIDE the rendered artifact** (the Reports
      §14 lesson — assert the artifact, not the DOM theory).
- [ ] **Empty entity / empty section (Guarantee 3 → Pack-3):** an entity with no policy / no
      realised events / no holdings renders an **honest empty-section note with the reader's served
      reason** (drift `has_targets=False`; realised `currency_groups=[]`; risk `available=False`;
      attribution `reason="insufficient cost basis…"`), never a blank or a fabricated zero.
- [ ] **Zero / single-entity degenerate case (Pack-4):** with **zero** entities → consolidated
      only (no per-entity sections, with an honest note); with **one** entity → consolidated + one
      per-entity section (near-duplication flagged, per the ruling).
- [ ] **Print palette (Pack-2):** the artifact prints on a **light background with dark text** (no
      dark-theme fills); verified in **Playwright `media: print` emulation** captures, both the
      screen rendering AND the print emulation.
- [ ] **Page breaks:** each top-level section starts on a fresh page; a section/card does not split
      mid-content where avoidable (`break-inside: avoid`); verified in print emulation.
- [ ] **Artifact header (Pack-5/6):** carries the title "Reports Pack", **generated date**, **base
      currency**, the **current-FX caveat**, and the **"not advice"** line — present on the first
      page (and repeated per print page if feasible).
- [ ] **Self-contained (Pack-10):** the artifact reads with **no app JS** (inline CSS, no external
      fetch); opening `/reports/pack` directly serves a complete document.
- [ ] **No frontend money math (D-105):** every figure is the backend-served string/number; the
      `PortfolioValuation` object's fields are read, never recomputed.
- [ ] **Reachable from Reports only (D-041):** the Reports page gains the entry link this milestone;
      **a journey guard clicks the real link and asserts arrival** at the rendered artifact
      (page-accounts §14ac-2 — a cross-page affordance is guarded as a journey, not destination-only).
- [ ] **Terms match GLOSSARY (Pack-7):** "Consolidated" / "Per-entity" exist in `GLOSSARY.md` with
      the exact spelling before they render; guarded by `test_glossary_parity.py` if mirrored.
- [ ] **Copy hygiene (page-chrome §11-8):** no decision ID / `entity_id` / `server-side` / endpoint
      name in any rendered string.
- [ ] **Recorded chosen absences:** the Pack performs **no mutation** and emits **no new CSV** (its
      export is browser print-to-PDF) → **no PIN gate, no request-body assertion, no round-trip
      import test, no utf-8-sig/BOM guard** (the CSV byte rule applies to CSV artifacts, not print
      HTML — Pack-8). Stated so the next reader does not treat these as gaps.

---

## 7a. THE GEOMETRY GATE — adapted for a PRINT ARTIFACT

**The 0a specimen for a print artifact = the RENDERED PACK on seeded (real-shaped) data, ratified
by the owner looking at BOTH the on-screen rendering AND the print-emulation captures** (Playwright
`media: print`). The owner ratifies **print output**, not app chrome:

- **Light print palette** visible (Pack-2) — no dark fills bleeding onto the page.
- **Page breaks** between sections (consolidated → each entity) render cleanly.
- **Per-section disclaimers** are visible in the print capture (the §9-5/§14 honesty story on the
  page the owner will actually print).
- **Consolidated + ≥2 per-entity sections** present on real-shaped seed data (per the page-home
  gate-artifact rule — feed REAL-SHAPED data: multiple entities, at least one with an empty section
  to prove Pack-3, one entity with no holdings to prove Pack-4's near-duplication case).

**Phase 1 (assembly) is BLOCKED until the owner ratifies this print geometry BY LOOKING** (the
page-home lesson: a correct section list can still be a wrong artifact — print geometry is a
requirement a list cannot express). The specimen note records this adaptation explicitly.

### GATE STATUS — ✅ RATIFIED WITH CONDITIONS (owner, 2026-07-17)

**The Phase-0a print geometry is RATIFIED WITH CONDITIONS.** The owner looked at BOTH the on-screen
rendering AND the print-emulation captures (§7a) and accepted the print geometry — light palette,
per-section page breaks, per-section disclaimers, and the consolidated + ≥2 per-entity structure on
real-shaped seed data. The **in-session running-header overlap fix** (§11 row 7 — a reserved top band
so the fixed running header no longer prints on top of the section heading) is recorded as **part of
the ratified geometry**. Four conditions attach (all four of the specimen's open items ACCEPTED as
recommended — §12pk-1..4 below); each is a Phase-1 delta, one per commit, fail-first:

- **§12pk-1 — attribution rows render SERVED display labels, never reader keys.** The §12es-3
  label-truth rule (the UI renders the served label verbatim, never a raw key) applied to the
  **server-side composer**: the Pack is the composer standing in for the UI here, so it resolves the
  attribution `by_asset_class` key (`fixed_deposit`, …) to its display label from **the same /refdata
  truth** every JSON route serves through (`refdata._label` + the per-vocab overrides — the single
  source; ETF → "ETF", fixed_deposit → "Fixed deposit"). Never re-map or invent a label.
- **§12pk-2 — the running header is SUPPRESSED on page 1.** The artifact header block owns page 1; the
  running header exists for **loose pages 2+** (an accountant's stapled printout). Record the
  convention in the DESIGN-SYSTEM §5.1a print note.
- **§12pk-3 — single-card consolidated sections collapse to ONE heading.** A consolidated subsection
  whose body is a single card no longer prints the section `<h2>` and the card `<h3>` as a duplicate
  title (the DataTable-caption lesson) — one heading on paper.
- **§12pk-4 (seed layer, NOT a Pack defect) — the dev.sh boot path yields a duplicate "Household".**
  Migrations insert a default "Household" entity (`f4a9c2b71e08`), then the demo seed creates another,
  so the app-boot path yields two "Household" per-entity sections while `reset-demo-data.sh`
  (create_all + seed, no migrations) yields the canonical three. Fix in the **seed layer** so BOTH
  boot paths yield the canonical three (get-or-create Household — the estate-seed / institution
  resolve-or-create precedent); seed unit-verified. Record here + one line in `08-TECH-DEBT.md` only
  if anything remains after the fix.

**The owner acceptance walk (Phase 3b) is NOT this session** — this session records the ratification,
lands the four Phase-1 fixes + the Reports-page entry point, adds the Phase-2 journey guard, and runs
the Phase-3a scripted pre-pass to GREEN. The close (Amendment-I ledger flip) is a separate session
after the owner's pass.

### GATE STATUS (as-proposed record, superseded by the ratification above) — ⏸ PROPOSED (2026-07-17)

**The Phase-0a specimen is BUILT and PROPOSED** (evidence in §11). It was rendered on the reset demo
seed (entities **Household · Rajan Family Trust · Meera Iyer** — the seed exercises a populated
entity AND a thin one) and captured both on-screen at 1440 and as a **real paginated print PDF** (via
Chromium `page.pdf()`, which honours `@media print`). **Capture inventory** (all under
`docs/plans/assets/`):

| Capture | File | What it proves |
|---------|------|----------------|
| Screen — top (1440) | `pack-specimen-screen-top-1440.png` | Header block (title · generated · base currency SGD · FX caveat · not-advice); CONSOLIDATED label; Net worth trend with the signed change (+159,234.00, grayscale-safe). |
| Screen — a consolidated section (1440) | `pack-specimen-consolidated-cashflow-1440.png` | Cash flow honest empty note ("nothing to project") + served disclaimer (Pack-3 for a consolidated section). |
| Screen — a per-entity boundary, POPULATED (1440) | `pack-specimen-per-entity-household-1440.png` | Household: net worth (Unrealised +82,503.20 · Today +73.02, signed green), real risk metrics, attribution +12.57% with signed per-class rows. |
| Screen — an empty-section note, THIN entity (1440) | `pack-specimen-empty-entity-meera-1440.png` | Meera Iyer (0 accounts): every section renders its **served reason**, never a blank/0 — "No holdings", "No policy targets…", "No realised events…", "Risk metrics unavailable…", "insufficient cost basis…". |
| Print — page 1 (PDF) | `pack-specimen-print-page1.png` | Light palette; the title header + disclaimer on a clean cover page; running header present. |
| Print — page 2 (PDF) | `pack-specimen-print-page2.png` | **Running header repeats on page 2+**; a **section break lands cleanly**; the header band is reserved (no overlap after the print-spacing fix); signed figures legible in grayscale. |
| Print — full artifact (PDF) | `pack-specimen-print.pdf` | The whole 10-page paginated print output the owner would actually print. |

**Fixed captures (2026-07-17, Phase 1 §12pk-1/2/3 — SUPERSEDING; the originals above are kept, the
gate record cites them):** re-captured after the four ratification fixes landed, on the same reset
3-entity seed.

| Capture (fixed) | File | What it now proves |
|-----------------|------|--------------------|
| Print — page 1 | `pack-specimen-print-page1-fixed.png` | **§12pk-2:** page 1 shows the artifact header block ONLY — the running header is suppressed (masked by the opaque header block); no page-1 header ↔ running-header redundancy. |
| Print — page 2 | `pack-specimen-print-page2-fixed.png` | **§12pk-2:** the running header repeats on page 2+ (inset to the content column); **§12pk-3:** "Net worth trend" prints as ONE heading (the section h2), no duplicate card h3. |
| Print — full artifact | `pack-specimen-print-fixed.pdf` | The 10-page fixed print output. |
| Screen — Household per-entity (1440) | `pack-specimen-per-entity-household-fixed-1440.png` | **§12pk-1:** the Attribution asset-class rows render SERVED display labels (Bond · Cash · Equity · **Fixed deposit** · Liability · Property · Retirement), never the raw reader key. |

**Tile-integrity (one derivation, P-1):** every figure is a canonical-reader output — Household's net
worth (739,108.20) is `value_portfolio(entity_id=Household).total_value`, the SAME value the Net
worth / Holdings readers serve; the Pack formats it with the shared `format_money_display`, never a
recompute. There is one derivation, cited in `reports_pack.py`.

**Known open items surfaced by the specimen — ALL FOUR now RATIFIED as conditions (owner 2026-07-17):
item 1 → §12pk-1, item 2 → §12pk-2, item 3 → §12pk-3, item 4 → §12pk-4 (see the ratified GATE STATUS
above). They were flagged not-fixed at specimen time to respect the STOP condition; they are the
Phase-1 delta set THIS session.**
1. **Asset-class keys render as reader keys** (e.g. `fixed_deposit` with an underscore) in the
   attribution "by asset class" rows — the reader serves the raw `key`, not the `/refdata` display
   label. A copy refinement (map keys → display labels) is a candidate for Phase 1; flagged, not
   improvised.
2. **Page-1 header ↔ running-header redundancy** — page 1 shows both the full header and the running
   header band (same text). Harmless; the owner may prefer suppressing the running header on page 1.
3. **Consolidated single-card sections repeat the section `<h2>` as the card `<h3>`** (e.g. "Net worth
   trend" twice) — a minor duplicate-title (the DataTable caption lesson). Candidate copy tidy.
4. **Demo-seed/migration wrinkle (NOT a Pack defect):** a fresh `dev.sh` boot runs migrations that
   insert a default "Household" entity, so the app-boot path yields **two** "Household" entities
   (migration default + demo seed) → two per-entity "Household" sections. The canonical
   `reset-demo-data.sh` (create_all + seed, no migrations) yields the correct **three** entities, and
   the specimen was captured against that state. The duplicate is a seed/migration interaction to
   resolve in the seed layer, independent of the Pack.

---

## 8. BUILD PHASES (one commit per phase; §3b FIRST; NO phase starts until §9 passes)

- **Phase 0 — Print-palette spec + the HTML route skeleton (§3b, contingent on Pack-1/2/5/10):**
  author the print palette + `@media print` rules **spec-first** (DESIGN-SYSTEM amendment, Pack-2);
  add `GET /reports/pack` (`HTMLResponse`) registered **before** the `main.py:212` catch-all,
  composing the readers server-side via `list_entities`; regenerate `API-CONTRACT.json` +
  `docs/openapi.json` same commit (131 → 132), `make api-contract-check` green. GLOSSARY terms
  (Pack-7) authored spec-first, parity guard green.
- **Phase 0a — Print-geometry specimen (the gate, §7a) — PROPOSED, AWAITING RATIFICATION:** render
  the Pack on reset seeded data; capture both on-screen and **Playwright `media: print`** in the
  section-rich + empty-section + single-entity frames. **STOP — owner ratifies the print geometry
  before Phase 1.**
- **Phase 1 — Artifact assembly:** compose all sections from the canonical readers (server-side
  entity loop, 9-2); honest empty-section notes (Pack-3); zero/single-entity handling (Pack-4);
  artifact header (Pack-5/6); the Reports-page **entry link** (D-041, ships this milestone).
- **Phase 2 — Tests:** artifact-level render guards (sections present, disclaimers verbatim, empty
  cases); **the artifact JOURNEY guard** (the entry link click → arrival; disclaimers/sections
  present INSIDE the rendered artifact; print stylesheet linked); the Reports→Pack journey
  (page-accounts §14ac-2). Drift + typecheck + lint green.
- **Phase 3a — Scripted pre-pass (GREEN before the walk):** drive the live artifact on a reset
  seeded instance; capture print-emulation both palettes; 0 console errors; every section renders;
  fix everything surfaced first.
- **Phase 3b — Owner acceptance walk (LIVE, print output):** the owner **prints the artifact** (or
  print-previews) and ratifies the print geometry, disclaimers, section order, and copy. The owner
  closes the phase.
- **Close ritual:** record the close (plan retrospective + `RATIFICATION.md §6`); **flip the
  Amendment-I ledger PENDING → DELIVERED** against the §0 table in `CURRENT.md`; strike-check every
  §9 item against the diff; **push** before the owner re-uploads.

---

## 10. VERIFY-FIRST RECORD (file:line) — read the engine before assuming shapes (D-019)

### 10-1. The §9-12 readers, per entity — served shape + `entity_id` + EMPTY-ENTITY behaviour

**The one filter primitive** is `entity_account_filter(model, entity_id)` (`portfolio.py:255-266`)
— returns `None` when `entity_id is None` (whole-portfolio, unchanged), else scopes by the owning
account's `entity_id`. All five entity-aware readers pass through this chokepoint.

**CONSOLIDATED (NO `entity_id` — render once, NOT per entity):**
- **Net-worth trend** — `net_worth_history` route `portfolio.py:894-906`: reads the
  `NetWorthSnapshot` table ordered by ts; snapshots are **not entity-scoped**, so the trend is
  **consolidated-only**. Keys: `history[]` of `{ts, assets, liabilities, net_worth, currency}`
  (`:898-905`). **No served disclaimer.** Empty → `{"history":[]}` (empty list, no raise).
- **Review** — `review_report` `review.py:86-260` and `review_centre` `:285-349`: both take
  **only `session`** (no `entity_id`); internal `compute_drift` / `value_portfolio` are called
  **without** `entity_id` (`:95,:299,:303`) → whole-portfolio. Keys: `review_report` → `as_of,
  count, items[], disclaimer` (`:255-260`); `review_centre` → `base_currency, net_worth, sections,
  attention, attention_count, last_review, disclaimer` (`:317-348`). **Disclaimer** at `:259`
  ("Items to review — reporting only, not advice…") and `:347`. Empty → fallback item "Nothing
  needs a look right now.", `count=0` (`:247-249`); sub-reader failures swallowed (`:244-245`), no
  raise.

**PER-ENTITY (each called with `entity_id` via `entity_account_filter`):**
- **Net worth (value)** — `value_portfolio` `portfolio.py:392-435`: `entity_id` `:393`, filter
  `:407-409`. **Returns a `PortfolioValuation` OBJECT, not a dict** — fields `base_currency,
  holdings[], total_value, cost_basis, unrealised_pl, day_change, has_stale` (`:405-434`). **No
  served disclaimer.** Empty entity → rows empty, `total_value/cost_basis/unrealised_pl/day_change`
  all `money(0)`, `has_stale=False`; per-holding failures degrade to Unavailable (`:416-424`), no
  raise.
- **Drift** — `compute_drift` `policy.py:108-219`: `entity_id` `:108`, forwarded to
  `value_portfolio(…, entity_id=…)` `:112`. Keys `:200-219` (`base_currency, gross_assets,
  has_targets, max_position_pct, dimensions[], concentration[], stale_inputs, …, disclaimer`).
  **Disclaimer** `:218` ("Reporting only — distance from your own targets. Not financial advice.").
  **Empty entity (no targets)** → `dimensions=[]` (loop `continue` `:126-128`),
  `has_targets=False`, `concentration=[]` (`:175`), `gross` defaults to `Decimal(1)` (div-zero
  guard `:116`); zeros/empty, no raise.
- **Realised P/L** — `realised_gains_report` `tax.py:284-371`: `entity_id` `:285`, via
  `_txns_by_instrument(session, entity_id)` `:291` (`entity_account_filter(Transaction, …)`
  `:254`). Keys `:352-370` (`year, years, long_term_days, base_currency, currency_groups[],
  base_realised_total_current_fx, base_realised_total_historical_fx, realised_fx_events_excluded,
  disclaimer`). **Disclaimer** `:363-370`. **Empty entity** → `currency_groups=[]`, both totals
  `0.0`, `realised_fx_events_excluded=0`, `years=[current_year]` (`:299,:354-357,:368`), no raise.
- **Risk** — `risk_metrics` `analytics.py:678-711`: `entity_id` `:678`, forwarded to
  `performance_series(…, entity_id=…)` `:695` and `value_portfolio(…, entity_id=…)` `:699`. Keys
  `:670-677` (`available, base_currency, window_days, benchmark_symbol, beta, correlation,
  downside_deviation, information_ratio, tracking_error, hhi`). **No served disclaimer.** **Empty
  entity** → `_risk_unavailable`: `available=False`, all metric keys `None` (`:594-601,:709-710`),
  no raise.
- **Attribution** — `attribution` `analytics.py:560-583`: `entity_id` `:561`, via
  `value_portfolio(…, entity_id=…)` `:577` and `_realised_income_base(session, base, entity_id)`
  `:580`. Keys (available) `:517-529`; (unavailable) `:469-475`. **`_ATTRIB_DISCLAIMER`** defined
  `:457-463`, served in both shapes (`:473,:528`). **Empty entity** → `_unavailable`:
  `available=False`, numeric keys `None`, `reason="insufficient cost basis to attribute a return"`
  (`:466-475,:578-579`), no raise.

**Empty-section honesty verdict:** all five entity-aware readers degrade to zeros / empty-lists /
`available=False` on an empty entity — **none raise** — so the server-side loop is safe. **What the
Pack RENDERS for those empty sections is a §9 item (Pack-3):** Guarantee 3 requires an honest
reason, not a blank or a fabricated zero.

### 10-2. Entity enumeration — the loop the Pack iterates (+ the zero-entity case)

- **`list_entities(session)`** `accounts.py:160-164` — docstring **explicitly cites** "§4.7:
  enumerate ownership entities so the **quarterly pack** can render **per-entity sections**.
  Metadata enumeration only — no valuation." Returns `list[dict]` of `{id, name, kind}` ordered by
  `Entity.name`. Empty DB → `[]`.
- **Endpoint** `GET /entities` → `get_entities` `accounts.py:51-55` (`{"entities":[...]}`;
  docstring cites "per-entity report" use).
- **`ENTITY_KINDS = ["self","spouse","trust","company","other"]`** `entities.py:20`. **There is NO
  special "Household" entity and NO ≥1-entity invariant** (`entities.py:6-8`). → **the Pack MUST
  handle the zero-entity case (Pack-4).**

### 10-3. Print reality — palette, `@media print`, HTML-serving mechanics

- **NO print palette exists.** `frontend/src/theme/tokens.css` (266 lines): light theme `:22-64`
  (`--bg:#f8fafc`, `--surface:#ffffff`, `--text-primary:#0f172a`), dark `:66-…`, high-contrast
  `:106-117`; the **only** media query is `prefers-reduced-motion` `:260`. **No `@media print`
  anywhere in `frontend/src`** (the `grep print` hits are z-index "content printing through"
  comments). **DESIGN-SYSTEM has no print CSS guidance** — only "a print artifact… a dedicated
  print layout, not one of the four" (`DESIGN-SYSTEM.md:223,235-236`). → **Pack-2.** Donor for
  light-bg/dark-text = the light theme `tokens.css:22-64`.
- **HTML serving:** SPA served by the **catch-all** `@app.get("/{full_path:path}")`
  `main.py:212-227` (real files → `FileResponse`, else `index.html` `:227`; `api/` misses 404 at
  `:222-223`). **No Jinja2/templates precedent** (`grep HTMLResponse|Jinja|Template app/` → none);
  **Jinja2 absent from `pyproject.toml`** (FastAPI `:11`) → adding it needs an ADR. **A
  `/reports/pack` HTML route must register BEFORE `main.py:212`.**
- **Non-JSON response precedent:** `PlainTextResponse` for CSV (`portfolio.py:10`, `_csv_response`
  `:63-67`; `response_class=PlainTextResponse` on `:200,209,357,835,1011,1024,1087`);
  `StreamingResponse` for AI (`ai.py:9`). **The HTML analog is `from fastapi.responses import
  HTMLResponse` → `HTMLResponse(html_str)`** — one-for-one with the CSV pattern, **no new
  dependency** (ships with FastAPI/Starlette). Composition = **f-string / string composition** (no
  Jinja2), consistent with 9-1's no-new-dependency posture.

### 10-4. Scenarios + Cash flow — the two unmapped ledger items (Pack-1)

- **Scenarios** — `scenario_report(session, entity_id=None)` `scenarios.py:49`. **Per-entity is
  ACTIVELY REJECTED:** route `GET /portfolio/scenarios` raises 400 "scenarios are household-scoped:
  they cannot be filtered to one entity" (`portfolio.py:1043-1044`; rationale — an "API honesty
  trap" — `:1040-1042`); the service duplicates the guard (`ValueError`, `scenarios.py:54-55`). It
  fuses per-asset shocks with **household-only** liquidity readers (`runway_report`,
  `obligations_report`, `scenarios.py:95,98`). Keys `:127-144` (`net_worth, exposures,
  asset_scenarios, liquidity, …, disclaimer`). **Per-entity is meaningless by design →
  consolidated-only Pack section, or re-declare.**
- **Cash flow** — `obligations_report(session)` `planning.py:135` (keys `:178-182`:
  `base_currency, obligations[], next_12m_total, disclaimer`); siblings `goals_report(session)`
  `:98`, `contributions_report(session)` `contributions.py:115`. **All take only `session`** — no
  `entity_id` param on any route (`GET /goals` `planning.py:76-77`, `/obligations` `:121-122`,
  `/contributions` `:178-179`). **D-057** (`DECISIONS.md:343`) pins protected semantics
  (contributions don't reduce runway; 'once' obligations excluded from burn) — cash flow is
  **household-scoped by construction**. **Per-entity does not exist → consolidated-only, or
  re-declare.**

### 10-5. GLOSSARY + export-standard + spec cites

- **GLOSSARY** (`GLOSSARY.md`): **"Reports Pack"** `:279`; **"Entity"** `:68`. **"Consolidated" —
  NO entry**; **"Per-entity" — NO entry** (both needed for section headers → **Pack-7**).
- **Export-artifacts standard** — **`DESIGN-SYSTEM.md:430-442`** (RATIFIED 2026-07-17;
  **NOT** §5.1 — §5.1 is "Inputs" `:320`; the page-reports plan's "§5.1" label is imprecise).
  Four rules: **titles human / data machine · disclaimers always · utf-8-sig always**. **Scoped to
  "server-side CSV export"** and dated today — a **print/PDF artifact is not explicitly named**
  → **Pack-8** (does it bind the print HTML, or only its CSV exports?).
- **PRODUCT-SPEC**: Guarantee 2 "No advice" `:64-65`; Guarantee 3 "No fabrication" `:66-67`;
  Guarantee 4 (`long_term_days` neutral) `:68-69`. **"Reports Pack" not mentioned in PRODUCT-SPEC.**
- **IA**: exception `:41-49`; detail `:353-358`; page-map `:92`; links `:351`; D-061 KEEP `:426`.
- **DECISIONS**: D-038 `:290-294`; D-041 `:307-308`; D-061 `:347`; D-057 `:343`.

### 10-6. ⚑ Divergence flags (premise vs reality)

1. **Two of the five Amendment-I dispositions (Scenarios, Cash flow) do NOT map to a §9-12
   section** — both household-scoped, per-entity impossible (§10-4). → **Pack-1.**
2. **No print palette exists** — a shipping gap the Pack cannot render without (§10-3). → **Pack-2.**
3. **No "Household" entity / no ≥1-entity invariant** — the zero-entity case is real (§10-2). →
   **Pack-4.**
4. **3 of 7 readers carry NO served disclaimer** (net-worth trend, value_portfolio, risk) — the
   "disclaimers always" standard needs a home for them (§10-1). → **Pack-5.**
5. **The export-artifacts standard is CSV-scoped** and does not name a print artifact (§10-5). →
   **Pack-8.**
6. **A backend HTML route bypasses the SPA LockScreen** (D-002 is a frontend soft lock;
   `/reports/pack` is served by the backend before the catch-all) — access posture is a gap. →
   **Pack-10.**

---

## 9. NEEDS DECISION — RESOLVED (owner one-pass 2026-07-17)

*All **nine** items RESOLVED in a single owner pass on **2026-07-17** — **every item ACCEPTED as
proposed**, with **recording notes on Pack-1, Pack-4, and Pack-9** (verbatim below). ⚑ marks the
load-bearing items the task named. Each row flips **OPEN → RESOLVED** with its ruling + date; the
"Proposed resolution" column is retained as the accepted text.*

### Rulings (owner 2026-07-17)

| # | Ruling | Date |
|---|--------|------|
| **Pack-1 ⚑** | ✅ **RESOLVED — ACCEPTED as proposed.** Extend the CONSOLIDATED section with household-scoped **Cash flow** + **Scenarios** subsections. Consolidated becomes: **net-worth trend · review · cash flow · scenarios**. **RECORDING NOTE (below):** this SUPERSEDES the ratified §9-12 map — a dated amendment is appended to page-reports §9-12 so one ratified map exists. The §0 ledger now maps all five Amendment-I dispositions to named sections. | 2026-07-17 |
| **Pack-2 ⚑** | ✅ **RESOLVED — ACCEPTED as proposed.** Author the minimal print palette + `@media print` rules **spec-first** (DESIGN-SYSTEM amendment): light bg / dark text (light-theme donor), semantic gain/loss retained **as enhancement** (the sign carries the information — colour never alone), page-break rules, repeating artifact header. | 2026-07-17 |
| **Pack-3 ⚑** | ✅ **RESOLVED — ACCEPTED as proposed.** Empty sections render an honest note carrying the reader's **served reason**, never a blank or a fabricated 0; the section stays present so the artifact structure is stable across entities (Guarantee 3). | 2026-07-17 |
| **Pack-4 ⚑** | ✅ **RESOLVED — ACCEPTED as proposed.** Consolidated always renders. **RECORDING NOTE (below):** **zero** entities → consolidated + the honest omission note; **one** entity → its per-entity section **still renders** (structural stability; the partial overlap is accepted). | 2026-07-17 |
| **Pack-5 ⚑** | ✅ **RESOLVED — ACCEPTED as proposed.** The artifact header carries the global disclaimer block (title · generated date · base currency · current-FX caveat · not-advice line); sections with a served `disclaimer` render it verbatim; the 3 disclaimer-less sections rely on the header + a "reporting only" caption. | 2026-07-17 |
| **Pack-6 ⚑** | ✅ **RESOLVED — ACCEPTED as proposed.** Order: consolidated first (net-worth trend → review → cash flow → scenarios), then per-entity sections (entities **alphabetical**), each entity's subsections net worth → drift → realised → risk + attribution. Owner ratifies the order at the Phase-0a gate. | 2026-07-17 |
| **Pack-7** | ✅ **RESOLVED — ACCEPTED as proposed.** Author "Consolidated" and "Per-entity" in `GLOSSARY.md` **first**, then any popover mirror, guarded by `test_glossary_parity.py`. | 2026-07-17 |
| **Pack-8** | ✅ **RESOLVED — ACCEPTED as proposed.** Extend the export-artifacts standard: "disclaimers always" + now-snapshot **"as-of"** labelling **bind the print HTML** (content-level); the **utf-8-sig/BOM** rule is **CSV-only** and does not apply (the Pack emits no CSV). Record the scope split in DESIGN-SYSTEM. | 2026-07-17 |
| **Pack-9** | ✅ **RESOLVED — ACCEPTED as proposed.** The artifact is **fully self-contained** (inline CSS, no app JS, no external fetch); **access follows the platform read posture — no one-route guard**. **RECORDING NOTES (below):** SECURITY-BASELINE gains the named line (the Pack route, consolidated human-readable artifact under the read posture, loopback default; revisit under read-auth); the **read-auth revisit is recorded in SECURITY-BASELINE §7 (gap #7) + R-1**, not R-30 (verify-first: R-30 is the Postgres-backend item — owner re-ruling 2026-07-17, this session). Both are Phase-0 doc commits. | 2026-07-17 |

### Recording notes (owner 2026-07-17 — verbatim)

- **RECORDING NOTE (Pack-1):** the consolidated extension extends to **trend · review · cash flow ·
  scenarios**. This **SUPERSEDES the ratified §9-12 map** — a **dated amendment is appended to
  `page-reports.md` §9-12** (owner ruling 2026-07-17, Pack-1) so **one** ratified map exists, not two
  conflicting ones. The **§0 ledger-mapping table** now maps all five Amendment-I dispositions to
  named sections.
- **RECORDING NOTE (Pack-4):** **zero** entities → consolidated + the honest omission note; **one**
  entity → its per-entity section **still renders** (structural stability; the partial overlap is
  accepted, not collapsed).
- **RECORDING NOTE (Pack-9):** the artifact is fully self-contained (inline CSS, no app JS, no
  external fetch); access follows the platform read posture — **no one-route guard**.
  **SECURITY-BASELINE gains the named line** (the Pack route: consolidated human-readable artifact
  under the read posture, loopback default; revisit under read-auth). The **read-auth revisit note**
  lands in **SECURITY-BASELINE §7 (gap #7 disposition) + a cross-ref to R-1 (passphrase mode)** —
  **NOT ROADMAP R-30**: verify-first found R-30 is the **Postgres-backend option**, and there is no
  read-auth ROADMAP item (the read-on-no-PIN posture lives in SECURITY §7 gap #7 + R-1). The owner
  re-ruled this home on 2026-07-17 (this session) so the ROADMAP is not corrupted. Both are Phase-0
  doc commits.

### Accepted resolutions (as proposed — retained verbatim)

| # | Item | Why it blocked | Accepted resolution (as proposed) |
|---|------|---------------|----------------------------------|
| **Pack-1 ⚑** | **Scenarios + Cash flow do not map to the ratified §9-12 section list** — both are household-scoped (Scenarios rejects `entity_id` by design `portfolio.py:1043-1044`; Cash flow has no entity seam, D-057), so per-entity composition is impossible. The §9-12 consolidated list names only *net-worth trend + review*. Amendment I commits both to Pack delivery — they cannot be silently dropped. | Closes the Amendment-I ledger. Neither maps cleanly (the task's expected ⚑). | **Extend the CONSOLIDATED section** to add two household-scoped subsections — **Scenarios** (`scenario_report`) and **Cash flow** (`obligations_report` + `goals_report` + `contributions_report`) — since both are inherently household/consolidated. Consolidated becomes: net-worth trend · review · cash flow · scenarios. This delivers all five Amendment-I dispositions against §0. *(Alternative: re-declare Scenarios/Cash-flow as not-in-Pack — but both explicitly named D-061 as their export home, so extending is the honest closure.)* |
| **Pack-2 ⚑** | **No print palette exists** — `frontend/src/theme/tokens.css` is dark-theme + light-theme only; no `@media print` rule, no print tokens anywhere in `frontend/src`; DESIGN-SYSTEM has no print guidance (§10-3). Dark backgrounds do not print. | The artifact cannot render legibly without it. New print affordance → DESIGN-SYSTEM amendment. | **Author a minimal PRINT PALETTE + `@media print` rules spec-first** (DESIGN-SYSTEM amendment): light background / dark text (donor = light theme `tokens.css:22-64`), semantic gain/loss retained, page-break rules (`break-before: page` per top-level section, `break-inside: avoid` per card), a repeating artifact header. Inline in the artifact's self-contained CSS (no app token layer at runtime). |
| **Pack-3 ⚑** | **Empty-entity / empty-section treatment** — every entity-aware reader degrades to zeros / empty / `available=False` on an empty entity (no policy → drift; no realised → realised; no holdings → risk/attribution "insufficient"), none raise (§10-1). What does the Pack RENDER for those? | Guarantee 3: an empty region shows a reason, never a blank or fabricated zero. | **Render an honest empty-section note carrying the reader's served reason** (drift "no targets set"; realised "no realised events this period"; risk/attribution the served `reason`), never omit silently and never render a fabricated 0. Keep the section present so the artifact structure is stable across entities. |
| **Pack-4 ⚑** | **Single / zero-entity degenerate case** — no "Household" entity, no ≥1-entity invariant (`entities.py:6-8,20`). With **one** entity the consolidated + one per-entity section may read as a duplicate; with **zero** entities there are no per-entity sections at all (§10-2). | The artifact must not render an empty or confusingly-duplicated shell. | **Consolidated always renders.** **Per-entity sections render only when ≥1 entity exists.** With **zero** entities → consolidated only, plus an honest note ("No ownership entities defined — per-entity sections omitted"). With **one** entity → still render its per-entity section (the consolidated trend/review are genuinely different figures from the single entity's point valuations); accept the partial overlap. Owner confirms whether one-entity should collapse instead. |
| **Pack-5 ⚑** | **Artifact header content + disclaimer coverage** — 3 of 7 readers carry **no served disclaimer** (net-worth trend, value_portfolio net worth, risk, §10-1); "disclaimers always" (`DESIGN-SYSTEM.md:430-442`) must still be honoured. | Every figure must sit under a disclaimer; the header is the natural home. | **The artifact header carries the global disclaimer block:** title "Reports Pack", **generated date**, **base currency**, the **current-FX caveat**, and the **"not advice"** line (Guarantee 2, `PRODUCT-SPEC.md:64-65`). Sections **with** a served `disclaimer` render it verbatim (D-105); the **3 disclaimer-less sections** rely on the header + a short "reporting only" section caption. |
| **Pack-6 ⚑** | **Section order** — §9-12 fixes the set but the exact rendered order (esp. after Pack-1 extends consolidated) and the per-entity ordering are unstated. | The reading order is a print-artifact requirement a section list cannot express (page-home lesson). | **Consolidated first** (net-worth trend → review → [cash flow → scenarios]), **then per-entity sections**, entities in `list_entities` order (**alphabetical by name**, `accounts.py:161`), each entity's subsections in §9-12 order (net worth → drift → realised → risk + attribution). Owner ratifies the order at the Phase-0a print-geometry gate (§7a). |
| **Pack-7** | **Terminology** — "Consolidated" and "Per-entity" are section-header terms **absent from GLOSSARY** (`GLOSSARY.md` has only "Reports Pack" `:279`, "Entity" `:68`). | CLAUDE.md hard rule: every user-shown term exists in GLOSSARY with exact spelling. | **Author "Consolidated" and "Per-entity" in `GLOSSARY.md` FIRST** (the §9-9 "Report" precedent), then any popover mirror, guarded by `test_glossary_parity.py`. |
| **Pack-8** | **Does the export-artifacts standard bind the PRINT artifact?** — `DESIGN-SYSTEM.md:430-442` is scoped to "server-side **CSV** export" and dated today; a print/HTML artifact is not named (§10-5). | Ambiguity on which honesty rules bind the Pack's own output. | **Extend the standard to name the print artifact:** "disclaimers always" and now-snapshot **"as-of"** labelling **DO** bind the print HTML (content-level). The **utf-8-sig/BOM** rule is **CSV-only** and does **not** apply — the Pack emits no CSV (its export is browser print-to-PDF). Record this scope split in the DESIGN-SYSTEM note. |
| **Pack-9** | **Access control + self-containment of a backend-served HTML route** — `/reports/pack` registers **before** the SPA catch-all (`main.py:212`) and is served by the backend, **bypassing the React LockScreen** (D-002 is a frontend soft access lock, §10-3,§10-6). | A directly-hit backend route should not be less guarded than the app it summarises. | **The artifact is fully self-contained** (inline CSS, **no app JS**, no external fetch) so it reads on paper. **Access follows the same network posture** (loopback default / LAN+PIN / VPN, SECURITY-BASELINE) as every backend route. Owner decides whether the SPA soft-lock must also cover `/reports/pack` (a backend guard) or the network posture suffices — flagged, not assumed. |

---

**Sign-off — §9 CLOSED (owner 2026-07-17):** all **9 items RESOLVED** (ACCEPTED as proposed + the
Pack-1/4/9 recording notes). The §3b delta (`GET /reports/pack`) is approved and **BUILT in Phase 0**
(§11); Pack-2's print palette is authored spec-first (§11). **Phase 1 (the Reports-page entry point +
the owner acceptance walk) remains BLOCKED until the owner ratifies the Phase-0a print-geometry
specimen by looking (§7a).**

---

## 11. PHASE 0 — BUILD EVIDENCE (one delta per commit)

*Phase 0 built the print palette (spec-first), the GLOSSARY terms, the `/reports/pack` route (with
its contract regen), the Pack-9 doc line, and the §0 ledger anchors — one delta per commit, in the
task's order. The route's content pins were proven fail-first (the route disabled → the path 404s,
demonstrated at build time). `make api-contract-check` GREEN (132 paths).*

| # | Delta [Pack-#] | RED / evidence | GREEN (pin) | Commit |
|---|----------------|----------------|-------------|--------|
| 1 | reports-pack §9 flipped OPEN → RESOLVED; page-reports §9-12 dated amendment (Consolidated = trend · review · cash flow · scenarios) [Pack-1] | n/a (recording) | Rulings + Pack-1/4/9 recording notes verbatim; one ratified map | `docs plan` |
| 2 | **DESIGN-SYSTEM §5.1a** print artifact amendment — minimal print palette (light bg/dark text, light-theme donor; gain/loss AS enhancement, the +/− sign carries meaning) + `@media print` (break-before per section, break-inside:avoid per card) + running header; Pack-8 scope split (disclaimers/as-of bind print HTML; BOM CSV-only) [Pack-2/8] | n/a (spec-first) | DESIGN-SYSTEM §5.1a + §3 cross-ref | `docs spec` |
| 3 | **GLOSSARY** "Consolidated" + "Per-entity" authored spec-first [Pack-7] | n/a (spec + parity guard) | `test_glossary_parity` GREEN (52 passed); no popover mirror (JS-free artifact) | `docs spec` |
| 4 | **add `GET /reports/pack`** → `HTMLResponse`, f-string (no Jinja2 → no dependency), registered before the SPA catch-all, `require_read_auth` (Pack-9); composes all readers server-side, served display strings (D-105) [the route] | `test_..._route_serves_html...` RED with the route disabled (path 404s) | 7 content pins GREEN (header · 4 consolidated · per-entity per entity · disclaimer verbatim · empty-entity served reasons · zero-entity omission · single-entity renders). **Contract regenerated same commit — 131 → 132 paths; `make api-contract-check` GREEN.** | `app+tests` |
| 5 | **SECURITY-BASELINE** §1 Pack-route read-posture line + gap #7 read-auth revisit (→ R-1, NOT R-30) [Pack-9] | n/a (doc) | §1 named line + §2 gap #7 extended | `docs spec` |
| 6 | **§0 ledger** — five dispositions cite their LIVE `reports_pack.py` anchors (evidence staged; flip stays at close) | n/a (doc) | §0 table + verdict note | `docs plan` |
| 7 | **Phase 0a print-geometry specimen** — rendered on the reset 3-entity seed; screen (1440) + real paginated print PDF; print running-header overlap fixed (top-band reserved per page) | Specimen looked at (§7a): running-header overlap FOUND on page 2+ → RED | Reserved a print top band (`.pack-section`/`.pack-header` padding-top) → running header repeats cleanly, section breaks land; captures in `docs/plans/assets/` | `this commit` |

**Phase-0 gate:** `make api-contract-check` GREEN (132 paths) · backend unit suites GREEN
(`test_reports_pack.py` 7 · `test_glossary_parity.py` 52 · `test_copy_hygiene.py`) · ruff clean.
**Frontend `npm run check` NOT run** — no `frontend/src` change this milestone (the artifact is
backend-served; the only frontend file is the DEV-ONLY capture harness, never wired into CI).

**STOP — the Phase-0a specimen is ⏸ PROPOSED (§7a). Phase 1 (the Reports-page entry point + the
owner walk) does NOT start until the owner ratifies the print geometry by looking.**

*(Superseded: the owner ratified the print geometry with four conditions on 2026-07-17 — see the §7a
GATE STATUS. Phase 1/2/3a landed this session; §12–§13 below are the records + evidence.)*

---

## 12 — PHASE 1 RATIFICATION-CONDITION RECORDS (§12pk-1..4, owner 2026-07-17)

*The four conditions the owner attached to the print-geometry ratification (§7a). Each is a Phase-1
delta, one per commit, fail-first. All four ACCEPTED as recommended.*

| # | Condition (owner) | Resolution shipped | Where |
|---|-------------------|--------------------|-------|
| **§12pk-1** | Attribution rows render SERVED display labels, never reader keys (the §12es-3 label-truth rule applied to the server-side composer; same /refdata truth). | The attribution `by_asset_class` key resolves through a new public **`refdata.label_for(vocab, value)`** — the per-vocab overrides + titleizer the `/refdata` endpoint serves through (`fixed_deposit` → "Fixed deposit", `etf` → "ETF"). The Pack (the composer standing in for the UI) renders the served label; the raw key never leaks. | `reports_pack.py:_entity_risk_attribution`; `refdata.py:label_for` |
| **§12pk-2** | The running header is SUPPRESSED on page 1 (the header block owns page 1; the running header is for loose pages 2+). Convention → DESIGN-SYSTEM print note. | A fixed running header repeats on every printed page in Chromium, so page 1's copy is **masked**: the opaque header block paints over it (`z-index` 11 > 10), and the running header is inset to the content column so the mask covers it exactly. Recorded in **DESIGN-SYSTEM §5.1a**. | `reports_pack.py:_STYLE @media print`; `DESIGN-SYSTEM.md §5.1a` |
| **§12pk-3** | Single-card consolidated sections collapse to ONE heading (no h2+h3 duplication on paper). | The four single-card consolidated subsections (net-worth trend · review · cash flow · scenarios) render via a new **`_plain_card`** (no card `<h3>`); the section `<h2>` is the only heading. Per-entity sections keep their card h3s (their h2 is the entity name — not duplicates). | `reports_pack.py:_plain_card` |
| **§12pk-4** | Seed-layer fix so BOTH boot paths yield the canonical three entities (dev.sh migrate+seed had a duplicate "Household"). | The seed **get-or-creates** "Household" (the institution/estate resolve-or-create precedent), so the migration-default Household is reused, never duplicated. Verified LIVE on both paths (create_all+seed AND migrate+seed) → exactly three. Not a Pack defect; nothing remains → no `08-TECH-DEBT` line. | `app/seed/demo.py:seed_demo_data` |

## 13 — PHASE 1/2/3a BUILD EVIDENCE (fail-first RED → GREEN, one delta per commit)

### 13-1. Phase 1 — the four condition fixes + the entry point

| Δ [§12pk] | Fail-first RED | GREEN (pin) | Commit |
|-----------|----------------|-------------|--------|
| §12pk-1 served labels | `test_attribution_rows_render_served_labels_not_reader_keys` RED — the artifact rendered the raw `fixed_deposit` key, not "Fixed deposit" | served label renders, raw key absent | `app+tests` |
| §12pk-2/3 print CSS | `test_single_card_consolidated_sections_render_one_heading_not_h2_plus_h3` RED on the duplicate `<h3>`; page-1 running header FOUND in the specimen | one heading; page 1 masked (0 dark px) / page 2 running header (465) — verified in the re-captured PDF | `app+tests+docs` |
| §12pk-4 seed | `test_dev_boot_path_yields_exactly_three_entities_no_duplicate_household` RED — the migrate+seed path yielded `['Household','Household','Meera Iyer','Rajan Family Trust']` | get-or-create → exactly the canonical three; verified LIVE on both boot paths | `app+tests` |
| The entry point (Amendment-K corollary ends) | — | a §5.4 PageHeader action links `/reports/pack` (new tab), Reports-ONLY (D-041 verified — no other surface links it); `Reports.test.tsx` pins href/target/rel/label; vite proxies `/reports/pack` for dev parity; page-reports.md §16 dated delta | `frontend+docs` |

### 13-2. Phase 2 — the artifact JOURNEY guard (DEV-ONLY, live)

`e2e/smoke/reports-pack-journey-smoke.spec.ts` clicks the REAL entry point → follows the popup to the
artifact → asserts INSIDE it: the Pack-5 header block, all four consolidated sections (single heading
each), one per-entity section per SEEDED entity (exactly three), the §12pk-1 served labels (not raw
keys), a served disclaimer verbatim, the Pack-3 empty-entity reason. **Fail-first:** a stub strips
`/reports/pack` of that content — the link/DOM are identical, so only reading the artifact bytes catches
it. **Print-emulation (RENDERED PIXELS):** page 1 top band = 0 dark px (running header suppressed),
page 2 = 465 (present). Live **3/3 GREEN**.

### 13-3. Phase 3a — scripted pre-pass (GREEN, on a reset demo-seeded instance)

- **§12pk-4 LIVE on both boot paths** — create_all+seed AND a genuine fresh dev.sh boot (migrations
  insert Household → seed reuses it) each yield exactly `['Household','Meera Iyer','Rajan Family Trust']`,
  no duplicate; the artifact renders exactly three `pack-section--entity`.
- **The entry-point journey** — `reports-pack-journey-smoke` 3/3 GREEN (above).
- **The artifact at 1440 + print emulation** — captured (docs/plans/assets fixed set); the artifact is
  **theme-independent** (self-contained inline print palette, not app tokens) and **JS-free** (Pack-9),
  so it is print-palette and 0-console-error by construction in any app theme.
- **Reports page pre-pass** — `reports-smoke` 8/8 (containment + **0 console errors**, light+dark ×
  320/375/900/1366) with the new entry point present; `reports-artifact-smoke` 4/4 (export disclaimers,
  regression-free).
- **Tile-integrity spot (one derivation, cite)** — `realised_gains_report` (`app/services/tax.py:284`)
  is consumed once by the Reports page (household, no `entity_id`) and once by the Pack (per-entity).
  The household current-FX total (**804.02 SGD**, 2024) equals the Pack's **Rajan Family Trust**
  per-entity realised (**+804.02**), which holds the only realised event; Household + Meera render the
  honest "no realised events" note. One reader, two consumers, identical figure.
- **Backend suite** `pytest -q` → **859 passed**; **`make api-contract-check` GREEN** (no path change —
  the route already existed since Phase 0).
- **Frontend `npm run check` from `frontend/` → EXIT 0** (vitest incl. the Reports entry-point pin +
  262 Playwright overflow/tile-integrity).
- **Fresh print PDF** committed to the capture set (`docs/plans/assets/pack-specimen-print-fixed.pdf`
  + page1/page2 fixed PNGs + the Household served-labels screen).

**STOP CONDITION HONOURED:** Phase 3a is GREEN and self-consistent; the **owner acceptance walk
(Phase 3b) is a SEPARATE session** (no self-certification). The **Amendment-I declined-exports ledger
stays PENDING** — it flips PENDING → DELIVERED only at the milestone close, after the owner's pass.

---

## 14 — PHASE 3b OWNER ACCEPTANCE WALK (owner walked the live artifact + the print PDF, 2026-07-17)

**Three findings; everything else ACCEPTED.** The owner walked BOTH the on-screen artifact and the
printed PDF. Acceptance is **contingent on this batch** (the §14es precedent). Each finding is a
one-delta commit, fail-first.

### §14pk-2 — Review rows rendered area/severity labels with NO item text → **FIXED**

**Finding (PDF walk).** The consolidated Review section printed each row's **area + severity tags but
no signal text** — content-free rows. *A category label without its item is a blank wearing a costume.*

**Verify-first (cite).** The review reader's `_item(area, title, severity)` serves the signal text as
**`title`** (`app/services/review.py:44`; e.g. `title="2 key documents marked missing or outdated"`) —
there is **no `body` field**. The Pack composer rendered `i.get("body")` (`reports_pack.py`
`_consolidated_review`), which is always empty. **Root cause: wrong served-field name**, not missing
data.

**Fix.** Render `i.get("title")` verbatim (D-105). **Fail-first pin:** `test_review_rows_render_the_
served_item_text_not_just_labels` asserts a stable, date-independent seeded signal
(*"… documents marked missing or outdated"* — the seed's one MISSING + one OUTDATED estate document)
is INSIDE the artifact — **RED** on the pre-fix `body` (proven by revert), **GREEN** on `title`.

### §14pk-3 — Realised per-entity period was inconsistent (a leaked year default) → **FIXED**

**Finding (PDF walk).** In one artifact, empty entities said *"No realised events recorded for **2026**"*
while Rajan rendered a **2024** event — an inconsistent, unexplained period.

**Verify-first (cite).** `realised_gains_report` is **calendar-year-scoped** (`app/services/tax.py:284`).
With **no `year`** it defaults to **`years[0]`** — the entity's latest event year — **or the current
year if the entity has none** (`tax.py:298`, `yr = int(year) if year else (years[0] if years else
datetime.now(UTC).year)`). So each entity's section was scoped to a **different** period: Rajan → 2024
(its event year), the empty entities → 2026 (the wall-clock year). **Root cause: a per-entity year
default leaking** — the section never stated any period, so the divergence read as a bug.

**Fix (scope to the ruled intent — one household period, stated explicitly).** `render_reports_pack`
computes **one** `realised_year` = the household-wide latest recorded realised year
(`realised_gains_report(session)["year"]`, or the current year if the household has none). **Every**
per-entity realised section is scoped to that year (`realised_gains_report(year=realised_year, …)`),
the **heading states it** (`Realised P/L — {year}`), and the **empty note derives from the SAME value**
— one source, both templates. **Fail-first pin:** `test_realised_sections_share_one_consistent_period_
label` asserts the populated heading (`Realised P/L — 2024`) AND the empty note (`… for 2024`) agree,
and that no empty entity leaks the current year — **RED** on the pre-fix default (proven by revert).

**Owner observation (recorded, NOT a blocker).** The Pack summarises the household's **latest recorded
realised year** (the seed's entire recorded realised history is a single year, 2024, so the artifact is
fully honest today). A household accruing realised events across **multiple** years would show only the
latest here; a true multi-year all-time roll-up would sum per-year reader outputs into a figure **no
single reader produces** (P-1 / D-031 — the Pack adds no figure its readers do not already produce), so
it is deferred to an **owner line**, not guessed. Flagged for the owner's future call.

### §14pk-1 — the Reports-page entry point broke §5.4 button anatomy → **FIXED**

**Finding (owner walk).** The "Reports Pack" entry point shipped as a **link-styled anchor**
(`<a className="lf-btn">`) — hover underline/border — instead of the ratified §5.4 **primary Button**
(the page-estate §14es-1 button-uniformity standard).

**Fix.** `<Button variant="primary" icon={Printer} onClick={() => window.open("/reports/pack",
"_blank", "noopener")}>Reports Pack</Button>` — the ratified icon+label treatment (icon decorative,
`aria-hidden`; the text child is the accessible name; a `<button>` takes no link underline). The
artifact is a backend HTML route, so the Button opens it in a new tab via `window.open`.

**Guards (fail-first, RED on the anchor).** `Reports.test.tsx` asserts the control is a `<button>` with
the **`lf-btn--primary`** class, carries the lucide `<svg>`, and calls `window.open("/reports/pack",
"_blank", "noopener")`. The journey smoke asserts LIVE that it is a primary Button with
**`text-decoration: none` on hover** (the §14es-1 rendered-style precedent). page-reports.md §16 gains
the addendum.

### §14 — batch evidence (re-captured on the reset 3-entity seed, superseding; originals kept)

The three fixes re-captured after landing, on a fresh 3-entity instance (Household · Rajan Family
Trust · Meera Iyer):

| Evidence | File | Proves |
|----------|------|--------|
| Print — full artifact | `docs/plans/assets/pack-specimen-print-batch1.pdf` | The 10-page fixed print output. |
| Review section (print) | `docs/plans/assets/pack-specimen-review-items-batch1.png` | **§14pk-2:** every Review row carries its served item text (e.g. *"Insurance 'Critical Illness' renewal is overdue"*, *"2 key documents marked missing or outdated"*), not just area/severity tags. |
| Realised section — Rajan (print) | `docs/plans/assets/pack-specimen-realised-period-batch1.png` | **§14pk-3:** heading **"Realised P/L — 2024"** states the period; empty entities cite the SAME 2024. |
| Entry point (Reports header) | `docs/plans/assets/pack-specimen-entrypoint-button-batch1.png` | **§14pk-1:** the ratified filled **primary Button** (printer icon + "Reports Pack"), not a link-styled anchor. |

**Re-run GREEN:** the artifact JOURNEY guards + the §14pk-1 hover assertion + the print-emulation pins
(`reports-pack-journey-smoke` — page 1 = 0 dark px, page 2 = 465) · the Reports page pre-pass
(`reports-smoke` — 0 console errors, light+dark × 4 widths) · `reports-artifact-smoke` — **18/18**.
Backend **`pytest -q` 861 passed** · `make api-contract-check` **GREEN** · frontend
**`npm run check` from `frontend/` EXIT 0** (262 Playwright).

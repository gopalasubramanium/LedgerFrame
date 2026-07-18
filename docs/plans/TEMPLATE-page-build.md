# TEMPLATE — page build plan

**Copy this file to `docs/plans/page-<name>.md` for every page build. Fill every
section before writing any code.** A page plan is a *derivation from the specs*,
not a fresh design: each section is copied from the named spec with a section
reference, never re-invented. If a section cannot be filled from the specs, that
is a **NEEDS DECISION** item (§9) — surface it to the owner *before* build, not
mid-build.

**Governing rules (CLAUDE.md + ratified milestone) — true for every page:**
- Pages **compose** ratified `src/components/ui/` components; they never style
  primitives and never introduce a raw `<input>`/`<select>` (DESIGN-SYSTEM §6).
- **A new component is forbidden without a DESIGN-SYSTEM amendment.** If the page
  needs an affordance the ratified inventory lacks, it goes in §4 *and* §9 as an
  amendment request — build does not start until it is resolved.
- Every **term** shown to a user exists in GLOSSARY.md with that exact spelling.
- Every **categorical field** is a `MasterSelect` bound to a MASTER-DATA
  vocabulary/master — no inline option lists.
- **All money math is backend `Decimal`; the frontend never computes financial
  values** — it renders the strings the backend produced.
- **Every information item has ONE canonical page** (IA P-1). A page shows its
  own owned figures; anything else is a *summary produced by the canonical
  page's reader* (never recomputed) with a link.
- **Contract freeze (API-CONTRACT.md).** Any endpoint the page needs that does
  not yet exist — or must change shape — is a **contract delta** (§3), built
  **backend-first**, regenerating `docs/specs/API-CONTRACT.json` +
  `docs/openapi.json` in the **same commit** (`make api-contract-check`).
- **Honesty (Product Guarantee 3):** every empty / "—" region shows a **reason**;
  stale values are flagged (never hidden or faked); insufficient inputs render
  "—", never a fabricated number.
- **Progressive, per-card loading (page-portfolio §12-8) — the standard for overview pages.**
  A composed page **NEVER blocks the whole page on the slowest reader.** Each card owns its
  reader's state: **Skeleton** (`ui/Skeleton`) while loading → **data** / **EmptyState** / an
  **honest error** (with retry). Fire readers **independently** (not one `Promise.all` gate); a
  shared reader may drive several cards, but slow readers only skeleton their own card. **Acceptance
  (pre-pass):** every card resolves **out of skeleton** (no `.lf-skeleton` left after load).
- **Copy hygiene (page-chrome §11-8).** A **decision ID** (`D-0…`, `P-…`, `§…`) or an
  **implementation note** (`server-side`, an internal enum, an endpoint/table name)
  **never** appears in a **user-facing string** — only in code comments / plan docs.
  User copy is plain language; every shown term matches GLOSSARY.
- **LAYOUT GEOMETRY IS SPECIFIED IN THE PLAN, BEFORE ASSEMBLY — a widget list is not a layout
  (page-home §12ho1-3).** For **Overview / composed** pages, the plan must carry a **grid map** (column
  structure per breakpoint), the **density / viewport target** (e.g. *"Full fits one viewport at
  ≥1366×768 with the demo dataset"*), and the **visual hierarchy** (what leads, by size and placement).
  **The owner approves the geometry BEFORE assembly.** page-home is the motivating case: §9 resolved
  *which* widgets Home shows and in *what order*, the build passed every test and the pre-pass — and the
  page still **failed its purpose**, because "an at-a-glance snapshot" is a **geometry** requirement a
  widget list cannot express. A stacked column of correct cards is a correct list and a wrong page.
- **THE GATE ARTIFACT MUST MODEL THE BOX THE PRODUCT ACTUALLY HAS (page-home §12ho1-7 / §12ho2-12).**
  A geometry gate (a mockup, a specimen frame) is only worth the box it is measured in. page-home's
  mockup was framed as a **bare 1366×768 viewport** — so it promised the page the **chrome's** height on
  top of its own, the owner ratified a layout against a box that does not exist, and the wired page then
  **clipped its own donut and headlines**. The frame was corrected twice: first to the **content region**
  (viewport − chrome), then again to **content region − the shell's own padding**, which is the height a
  page's content really gets. **Render mockup frames inside the real shell, or subtract the chrome AND
  the shell padding explicitly — and feed them REAL-SHAPED data** (page-home's demo had 5 asset classes
  and 3 quotes; the real dataset had 8 and 7, and the difference was the whole fit).
  **Corollary — the same rule governs `@media` BREAKPOINT selection (page-scenarios §12sc1-1, now a
  stated rule).** A media query fires on the **viewport**, but the content box is **viewport − the fixed
  chrome** (the sidebar eats ~230px at laptop widths), so a breakpoint tuned to the viewport promises a
  fit the content box does not have: a 4-across tile grid set at ~1100px lands four tiles in a ~870px
  box and clips. **Set a multi-column breakpoint for the content box, not the viewport** — measure the
  box the product has, don't assume the viewport.
- **A GUARD MUST EXERCISE THE FAILURE GEOMETRY, AND BE PROVEN RED BEFORE IT IS TRUSTED (page-home
  §12ho2-1 / §12ho3-3).** page-home shipped **three** guards that reported green over a visibly broken
  page: one **counted** affordances (8 ↗, all with aria-labels — all true of headers lying in a heap in
  the wrong corner); one compared **tile boxes** at **one width** (the boxes did not intersect while
  their *contents* printed through each other at 375px); one checked **containment** against the
  **gallery's wide** quote cards (the badge only escapes a *narrow* one). Each was fixed by making it
  assert the thing the human actually sees — **rendered text**, the **painted card box** — at **every
  breakpoint**, and by giving it a specimen that **reproduces the defect**. *A guard that only looks
  where the bug was last time is not a guard; a specimen only proves what it exercises.*
- **MEASURE WHICH ELEMENT BINDS BEFORE CUTTING CONTENT — a cut that buys nothing is pure loss
  (page-home §12ho2-12).** A grid row is as tall as its **tallest** tile, so trimming any *other* tile
  buys **zero**. page-home nearly cut a headline (and did shrink the donut ring) for **no height at
  all**: the ring was never the constraint (the capped **legend** was taller), and the headline cut only
  paid *after* density made that tile the binding one. **Spend design levers first (padding, gaps, dead
  bands, layout bugs), and measure each lever's real effect — do not assume it.**
- **A CI BOUND MAY BE A RATCHET WHILE A DECISION IS PENDING (page-home §12ho2-12).** When a target is
  not met and closing it needs an **owner decision**, do **not** assert the fiction and do **not** delete
  the check: assert the **current** number as a ceiling, name the target in the message, and let it fall
  to the target when the decision lands. Honesty stays green; regressions still fail.
- **A GLOSSARY term ships to the SPEC, not just the popover data (page-heatmap §13-1).** The glossary
  has **two stores** — `docs/specs/GLOSSARY.md` (canonical; the file CLAUDE.md's hard rule names) and
  `frontend/src/mocks/glossary.ts` (what `[Help]` renders). page-heatmap added a term to the **second
  only**, and the build record claimed the first: the spec was never touched and nothing noticed until an
  owner walk. **Add the term to `GLOSSARY.md` first**, then the popover data. Guarded by
  **`tests/unit/test_glossary_parity.py`** (CI-unit) — every popover term must exist in the spec with the
  **identical spelling**. *Generalise: whenever one truth lives in two stores, write the guard — vigilance
  is not a mechanism.*
- **A spec claim must cite the spec FILE (page-heatmap §13-2).** In §11/§12, when a record says "GLOSSARY
  gains X" / "DESIGN-SYSTEM §5 amended", it must **name the file the diff actually touched**. A claim about
  a spec whose diff contains no spec file is a **strike** — and writing the filename is what makes that
  visible at write time rather than at the walk.
- **Label/copy changes are app-wide (page-chrome §11-4).** When a user-facing label or
  copy string changes, **grep the whole frontend** and update **every** instance in the
  same change — never fix only the one you found (§11-4 recurred because the first fix
  touched one of two Export buttons).
- **Wired ≠ rendered ≠ accepted (Holdings retrospective).** The highest-impact
  Holdings defects all passed the test suite: a 500-row silent cap, a
  snapshot-vs-ledger CSV mismatch, a table overflowing 1366px, and a mock-backed
  picker offering wrong-class results. Therefore: an affordance backed by **mock
  fixtures** passes tests while failing live (flag every one — §4); **layout /
  overflow / popover** claims are unprovable by unit tests (verify by rendering —
  §7); the acceptance bar is **driving the real rendered app** (owner walk — §8
  Phase 3), never green suites alone.

**Shell / global-chrome plans adapt this template (page-chrome retrospective §12).** A
plan for the app shell / global chrome (not a content page) has **no single route and no
figure ownership**: §1/§2 describe **UI-state** ownership (nav, display axes, lock) and
**status summaries** instead; acceptance criteria are **cross-page** (a page from each of
the four templates renders inside the shell); and the regression surface is
**layout/overflow across every page** — extend the Playwright suite (ADR-0004), not just
one page's tests. New chrome components ratify as a **set** at `/kitchen-sink` before
assembly (a Phase-0a step). See `page-chrome.md`.

**Gate / overlay plans adapt this template too (first-run retrospective §13).** A one-time
**gate/overlay** mounted in the shell (first-run checklist, lock) is **not a content page**:
no route, no nav entry, no figure ownership — §1/§2 describe **step/UI-state** and the
**settings it writes** (through the same canonical endpoints, never a second code path).
Acceptance is **behavioural** (skippable, links out, honest), not a single-page happy path.
**Layout follows D-101:** a full-shell overlay **pins its header/footer and scrolls only its
content**, **caps to the viewport on desktop** (all steps fit, no scroll), and becomes a
**full-height sheet below the 900px laptop breakpoint** (D-102). It **mounts after the lock
gate** (unlock precedes onboarding) and leaks nothing behind either. See
`page-first-run-checklist.md`.

---

## 1. IDENTITY

*Source: INFORMATION-ARCHITECTURE.md §2 (page map), §3 (navigation + rotation);
DESIGN-SYSTEM.md §3 (page templates). Every row cites its spec section.*

| Field | Value | Spec ref |
|-------|-------|----------|
| Page name (H1 = nav label = route) | | IA §2, D-022 |
| Route | | IA §2 |
| Nav group | | IA §3 |
| Page template (overview / entity-detail / worklist / settings) | | DESIGN-SYSTEM §3 |
| Rotation eligibility | | IA §3 (D-044) |
| One-line purpose | | IA §2 |

> **Reports-group pages are worklist-shaped (page-pricing-health §13, ND-7):** a **summary header +
> a diagnostics/records body** (e.g. Pricing Health = portfolio-confidence card + per-holding
> diagnostics table). Use the Worklist template, not Overview.
> **⚑ Clarification (page-reports §9-6, 2026-07-17 — Recording Note 2):** this note describes **Pricing
> Health**, not the whole Reports *group*. The group's other member, **Reports itself, is an Overview
> page** (`DESIGN-SYSTEM.md:227`) — a composed surface of owned sections, not a worklist. Do not
> generalise "Reports-group ⇒ Worklist" to the Reports page; check the DESIGN-SYSTEM §3 mapping per page.
>
> **Fast-path (page-pricing-health §13):** a clean **verify-first (§3/§10)** that finds every reader
> already in the frozen contract **empties §3b → Phase 0 is skipped**, and if the ratified inventory
> already covers the page, **Phase 0a is confirm-only (no §5 amendment)**. Reading the engine first is
> the biggest schedule lever — it also prevents §3b guesses.

---

## 2. OWNERSHIP TABLE

*Copied from INFORMATION-ARCHITECTURE.md §5 (per-page ownership). Never
re-derived. "Owns" = canonical here. "Summarises" MUST name the canonical page
**and the shared reader** it reuses (no second code path). "Links" = navigations.*

**Owns (canonical, authoritative, fully explained on this page):**
- …

**Summarises (other pages' info — via the named reader, linked, never recomputed):**

| Summary shown | Canonical page | Shared reader reused | Link target |
|---------------|----------------|----------------------|-------------|
| | | | |

**Links to:**
- …

**Enforcement corollary (P-1/D-031):** a summary widget may not add a figure its
canonical page does not show. State how this page honours it.

**Scoped-view pages (entity-detail, P-3 — the Instrument Detail lesson):** an
entity-detail page typically **owns nothing** — every figure is a *filter* of a
canonical reader (quote/news/position…), a scoped **endpoint param** (`?symbol=`) or
a documented client-side filter, **never a recompute / second code path**. State
this explicitly, and prove it in acceptance (the scoped numbers match the canonical
page's).

---

## 3. API SURFACE

*Source: API-CONTRACT.json (frozen baseline) + API-CONTRACT.md delta table.*

### 3a. Endpoints consumed (already in the frozen contract)

| Method + path | Purpose on this page | Response shape pinned? |
|---------------|----------------------|------------------------|

### 3b. Contract deltas (needed but not in the baseline — BUILD BACKEND-FIRST)

Each row is built backend-first and regenerates `API-CONTRACT.json` +
`docs/openapi.json` in the **same commit** (freeze rule). `kind` ∈
add / rename / remove / reshape.

> **Note (typed responses):** a `response_model` **strips** any dict key it doesn't declare — a served
> field vanishes silently unless the model has it (page-markets §12mk3-2: `HoldingView.price_display`).
> When adding a served field to a typed route, add it to the model AND regenerate the contract.
>
> **Note (a ratified backend VALUE needs a same-batch code test — page-review §13).** A decision that
> sets a **threshold/constant/served-value** (not a shape) regenerates no contract, so a spec edit alone
> leaves the **code free to silently disagree** — D-084/D-087 set `_RUNWAY_LOW_MONTHS`/`_GOAL_SOON_DAYS`
> and the over-use signal in the spec, but `review.py` still served the legacy 6/90 with no over-use, and
> the drift surfaced **only at this page's verify-first pass, months later**. Rule: a ratified value
> decision ships a **code test pinning the served value in the SAME batch as the spec edit**, fail-first.
>
> **Note (rename/removal tests discriminate by SHAPE, not status — page-review §12rv1-5 / test_review_thresholds).**
> The SPA serves **`200` HTML** for any unmatched path, so a retired endpoint still returns `200` — a
> status-code assertion passes on a broken rename. Assert the **response shape** instead: the new path is
> `application/json` of the intended shape; the old path is **not** JSON (it fell through to the shell).

**⚠ Verify-first divergence flag — worth keeping (page-markets §13d).** Verify-first (D-019) reads what
the engine actually serves before assuming shapes. When it finds that a **plan/brief premise diverges
from reality**, flag it explicitly with **⚠** in §9/§10 and resolve it — don't silently build to the
premise. Two catches this pattern earned: the **banner-refresh premise** (the brief assumed the
StaleBanner offered refresh — it never did) and **a served endpoint shipping unwired** (`/markets/search`
had no caller; the picker used `/instruments/search`). A divergence surfaced early is a §9 item, not a
walk finding.
> **Audit GUARDS, not just shapes (page-news §13a).** Verify-first also checks each reader's **honesty
> guards**, not only its response fields: a surface that **egresses** must honour **no-egress**; a
> mutation must carry the right **auth**. A served surface that *should* be guarded but **isn't** is a
> §9 item exactly like a missing shape — the News readers made egress with **no `privacy_mode` guard**
> (a **shipping Guarantee-5 hole**), caught only because verify-first grepped for the guard. Reading the
> engine means reading its guards.

| kind | Endpoint (current → intended) | Decision | Why this page needs it |
|------|-------------------------------|----------|------------------------|

---

## 4. COMPONENTS

*Source: DESIGN-SYSTEM.md §5 (ratified inventory). List only ratified
components. Name any prop or state the kitchen sink did **not** exercise — those
carry build+test risk. Any needed affordance NOT in the inventory is an
amendment request (also list it in §9).*

| Ratified component | Role on this page | Data source (real endpoint / **mock**) | Prop/state not exercised at kitchen-sink |
|--------------------|-------------------|----------------------------------------|------------------------------------------|

**Data source (Holdings retrospective).** For each component name whether it is
wired to a **real endpoint** or a **mock fixture**. A mock-backed affordance passes
every test while failing live (the InstrumentPicker shipped mock-backed through many
"green" walks) — it is **not "done"** until wired to real data. Any still-mock
affordance is a **§9 NEEDS DECISION** ("mock-backed affordance").

**Affordances the ratified inventory lacks (amendment required before build — see §9):**
- …

**Component usage rules the build must honour (from DESIGN-SYSTEM §5/§6 + Holdings):**
- **Row actions** live in a `RowMenu` (⋯) overflow — never wide always-visible
  action columns (they force horizontal scroll; page-holdings §9-22/§9-36).
- **Entity references link directly (D-098)** — a symbol/name/entity in a table cell
  is a **direct link to its entity-detail page** (e.g. the Holdings symbol →
  `/instrument/{symbol}`); any row-menu "Details" stays as the discoverable path,
  not the only one.
- **Context-scoped pickers (D-097)** — any instrument/entity/account picker
  **filters its pool by the active context** (asset class, entity…) and routes
  search to that context's provider; a match under a **different** context is a
  **navigate-to link, never a selectable result** into the wrong flow.
- **Popover overlay (DESIGN-SYSTEM §6, universal)** — any custom dropdown/result
  list **portals to the viewport** (fixed + `max-height` + internal scroll) and
  overlays; it never expands a dialog or adds dialog-level scroll. Verified open
  **inside a dialog** at `/kitchen-sink`.
- **Suggestion-confirming selects → commit-on-pick (first-run F3, §13).** When a select is
  **pre-filled with a suggested value the user must be able to CONFIRM by choosing it**, a
  native `<select>` is wrong: the browser emits **no `change` for a same-value pick**, so
  re-selecting the suggestion is a silent no-op. Use `MasterSelect`/`Select` with **`onCommit`**
  (the `CommitMenu` commit-on-pick pattern — fires on **every** pick incl. the unchanged one).
  This is the platform pattern for any confirm-the-suggestion step; plain change-driven
  selects stay the default everywhere else.
- **Cards are LAYERED (D-100)** — sections/panels use `.lf-card` (outer border on
  `--surface-raised`); a section with a headline nests its content in a
  `.lf-card__body` panel (`--surface` + border) for depth, not a flat fill. A card's
  **canonical-home cross-link lives in the card HEADER, top-right** (the News
  pattern), for every summary-with-link card — never in the body.
- **Scroll = content only, header outside (D-101)** — a scroll region is the content
  below the section/card header (header outside the scroll container); `DataTable`
  keeps the toolbar outside the scroll and only the rows scroll. All scrollbars are
  themed via tokens.
- **Dense label/value metadata → `MetaStrip`** (DESIGN-SYSTEM §5.2) — identity /
  taxonomy strips (one row desktop, 2-col narrow), not a bespoke grid.
- **A second template variant reveals reusable primitives** — Instrument Detail (the
  entity-detail variant) surfaced `MetaStrip`, `.lf-card__body`, the card-header
  link, and the PriceChart amendment. **Extract page-local patterns that recur into
  the component layer + DESIGN-SYSTEM; do not leave them page-local.**

**Tables — dataset-size posture (D-094, required for every `DataTable`):** for
each table on the page, state (a) its **dataset-size assumption** (bounded / small
vs unbounded / growing, with the reasoning) and (b) **where sort and filter
execute** — client-side or server-side.
- **Bounded** (e.g. holdings, accounts, policy rows — tens of rows): client-side
  sort/filter is acceptable; record the assumption **and** a threshold at which to
  revisit (move server-side).
- **Unbounded / append-only** (e.g. transactions, audit log, price history):
  **server-side** — sort **and** filter run over the **full dataset** (never the
  loaded page), with pagination / cursor / windowed loading; default view + a
  server-side full-dataset CSV export (D-050) regardless of what is loaded. The
  endpoint's sort/filter/page params are a **contract delta** (§3b).

Every table also **caps at a viewport-relative max height and scrolls internally**
(sticky header), so a long table never grows the page unboundedly — this is the
`DataTable` default (`--table-max-h`, `60vh`); a page overrides it only with reason.

---

## 4b. PER-VARIANT FIELD & ACTION SPECS

*Fill this only if the page's entity has **variants** (asset class, policy type,
account kind, document category…). The Holdings build learned this the hard way
(D-089/D-090/D-091): a single generic form misclassifies and offers nonsense.*

- **Entry is in the user's vocabulary (D-089).** The entry/selection step presents
  **plain-language choices** (type-first tiles), not internal enum names; the
  internal branch/mechanism is an implementation detail, never the front door.
- **Actions per variant (D-090).** State which actions/types the form **offers per
  variant** as an applicability matrix — **form-level filtering only, engine
  unchanged**. Odd-but-real events entered by import are **not** filtered by UI
  opinion.
- **Fields per variant (D-091).** Per variant, list **REQUIRED** (only what
  valuation/honesty need) vs **OPTIONAL-PROMPTED** fields; incomplete optional
  detail is a low-priority Review signal, **never a hard wall**.
- **Backend-served, frontend zero-copy (D-005).** The matrix / field-spec is served
  from the backend (e.g. `/refdata/*`), never hardcoded in the frontend.
- **Display variants too (Instrument Detail lesson).** Variants also drive
  **class-conditional display panels** (e.g. mutual_fund NAV / crypto cap / F&O
  identity) — shown **only when actually present/linked, never fabricated**
  (Guarantee 3).
- **Deferred cross-milestone dependency.** If a section depends on a future milestone
  (e.g. an AI surface), it is **DEFERRED with a visible placeholder note + a recorded
  pending decision**, never silently dropped (D-068 stayed intact when the Instrument
  Detail explainer was deferred).

| Variant | Actions/types offered | REQUIRED fields | OPTIONAL-PROMPTED fields | Served by |
|---------|-----------------------|-----------------|--------------------------|-----------|
| | | | | |

---

## 5. VOCABULARIES

*Source: MASTER-DATA.md. Every categorical field → its vocabulary/master and the
control (always `MasterSelect`, except user-record pickers which use `Select`).*

| Field on this page | Vocabulary / master | Fixed (/refdata) or extensible | MASTER-DATA ref |
|--------------------|---------------------|-------------------------------|-----------------|

Note any field that is **user data, not a master** (e.g. account/entity pickers) —
these use `Select` over a user-record list, not `MasterSelect`.

---

## 6. DECISIONS IN FORCE

*Source: docs/audit/DECISIONS.md. Each decision that constrains this page, with
one line on what it **forbids or requires here**.*

| Decision | What it forbids / requires on this page |
|----------|------------------------------------------|

---

## 7. ACCEPTANCE CRITERIA

*User-visible behaviours that define "done". MUST include the honesty states and
the theme/density matrix. Written as checkable statements.*

- [ ] **Happy path:** …
- [ ] **Empty state:** every empty region shows a reason (Product Guarantee 3).
- [ ] **Error state:** …
- [ ] **Stale / low-confidence:** flagged, never hidden or faked.
- [ ] **Negative / large / long-name data** render correctly (tabular, no overflow).
- [ ] **Both densities** (comfortable/compact) and **both themes** (light/dark) correct.
- [ ] **Interactive OPEN states verified manually in both themes** — native
      popups (the `Select`/`MasterSelect` dropdown, the `DateInput` picker) and
      overlays (Dialog/Drawer, Toast) are opened and checked in light AND dark
      (a static screenshot misses them; native popups are not stylable and rely
      on `color-scheme`). Add each interactive open state to `/kitchen-sink`.
- [ ] **Keyboard + WCAG AA** (focus ring, aria-sort, labels).
- [ ] **No frontend money math** — every figure comes from the backend.
- [ ] **Terms** match GLOSSARY; **categoricals** come from MASTER-DATA via /refdata.
- [ ] **Tables (D-094):** each table's dataset-size assumption + sort/filter
      location (§4) is honoured — bounded tables filter/sort client-side; unbounded
      tables filter/sort **server-side over the full dataset**, not the loaded page.
- [ ] **Round-trip (D-095):** any surface that both **exports and imports** the
      same format has a **lossless round-trip test** — export → import preview →
      **zero errors, zero fixes**. The app's own export must be its import's
      cleanest input; the export's columns are exactly the import's schema. If a
      surface exports a *report* that is deliberately not re-importable (e.g. a
      snapshot vs a ledger), the importer must **say so with one honest message**,
      never fail every row.
- [ ] **EXPORT ARTIFACTS ARE GUARDED AT THE BYTE LEVEL, NOT ONLY THE CONTENT LEVEL — encoding is part
      of honesty (page-reports §14rp-3 / §15).** A CSV/export artifact obeys the DESIGN-SYSTEM §5.1
      "Export artifacts" standard — **titles human, data machine, disclaimers always, utf-8-sig always** —
      and each half is a **separate guard**: a **content** guard reads the decoded text (disclaimers travel,
      headers are human titles, figures present); a **byte** guard reads the raw bytes (`test_csv_encoding.py`
      asserts the UTF-8 BOM `EF BB BF` on each artifact AND that it still parses WITH the BOM). page-reports'
      disclaimer journey guards were green while Excel garbled an em dash, because the defect (BOM-less UTF-8
      decoded as cp1252) lived **below** the text — a content guard cannot see it. *A guard that proves the
      right characters does not prove the right bytes; an export that egresses to a spreadsheet needs both.*
      An export figure that mirrors an on-screen section carries the section's disclaimer, and a
      **now-snapshot** in a period artifact is labelled explicitly **as-of** (never reads as a period figure).
- [ ] **A COMPOSED ARTIFACT IS PIXEL-WALKED LIKE A PAGE — ITEM-LEVEL CONTENT + PERIOD LABELS, NOT JUST
      SECTION PRESENCE (reports-pack §15).** A print/export artifact assembled from many readers passes its
      content pins (every section present, disclaimers verbatim, empty reasons) while still being **wrong to
      the eye** — the owner's PDF walk caught **two** such defects the pins missed: a Review section that
      rendered **category/severity labels with no item text** (a blank wearing a costume — the composer read a
      field name the reader does not serve), and a Realised section whose **period was inconsistent across
      entities** (a leaked per-entity year default: empties "2026" vs a populated "2024"). *Section-presence
      pins are necessary but not sufficient.* Artifact guards must assert **ITEM-LEVEL content** (a known
      seeded signal's text is INSIDE the artifact, not just its section heading) and **PERIOD/scope labels**
      (the populated section's period label and the empty note derive from ONE period source and agree with
      the query). Corollary — **verify-first the reader's ACTUAL served field names before composing** (§14pk-2
      shipped `i.get("body")` against a reader that serves `title`); a composer that guesses a field name
      renders silent blanks. And a composer must **not inherit a reader's per-item default** (a year-scoped
      reader's per-entity year default) as if it were an artifact-wide truth — compute the artifact's scope
      **once** and pass it to every section (§14pk-3).
- [ ] **Request-body assertion (Holdings §9-35):** for any payload assembled from
      UI state (row selections, include/exclude, filters), a test asserts the
      **actual request body** equals the intended data — not merely that a handler
      was called. (The import "committed exactly the included rows" guard.)
- [ ] **Rendered layout verification (Holdings §9-30/36/39; page-chrome §11-14):** every
      fit / overflow / popover-overlay claim is verified by **rendering** in both themes,
      NOT by unit tests — *"tests green is not acceptance for layout"* (**jsdom has no
      layout engine** — `scrollWidth`/`clientWidth` are always 0 there). Row-action column
      fully visible; no horizontal scroll for core columns; open popovers overlay without
      expanding the dialog. **Extend the Playwright overflow suite (ADR-0004,
      `e2e/overflow.spec.ts`) to cover this page** — it asserts zero horizontal overflow at
      **320/375/900/1366px × both themes** on the document + `.lf-shell__content`, and is
      wired into `npm run check`.
- [ ] **Single vertical scroll region — the document never scrolls (page-markets §12mk1-1):** the
      overflow suite was **horizontal-only**, so a page that scrolled the whole window beside the
      content scroller slipped through. The permanent ALL-PAGES assertion now also proves **only
      `.lf-shell__content` scrolls vertically** — the document/window can't (spacer-forced tall
      content → `window.scrollY` stays 0). *An invariant not asserted is an invariant not held:* when
      a bug reveals an **unmeasured dimension**, add that dimension to the suite, not just a one-off
      fix. (The shell guarantees it via `contain: layout`.)
- [ ] **Every visual/geometry fix ships with a pre-pass assertion (page-portfolio §12b4-1):**
      a layout/geometry finding is NOT closed by the edit alone — a **repeat finding is the
      signature of a fix with no assertion guarding it**. When a fix asserts equal/aligned/
      non-overflowing geometry (equal tile width+height, shared inset, capped scroll), add a
      **measuring assertion to the scripted pre-pass** (rendered `getBoundingClientRect`, grouped
      as the eye groups it — e.g. per row), at **all breakpoints**, so a regression re-trips it.
      jsdom cannot measure — the assertion lives in the Playwright pre-pass / overflow suite.
- [ ] **Fail-first, and reproduce the owner-visible defect BEFORE writing the assertion
      (page-net-worth §12b3-1/§12b3-3):** an assertion **never seen to fail is not a guard**. First
      **reproduce the reported defect** (measure it / screenshot it) so the assertion targets the
      REAL geometry — do not assert your *theory* of the defect. (Batch 2 asserted sparkline↔tile
      *overlap* and passed; the true defect was card **dead space** — the theory was wrong, the
      measurement was honest, so the fix "did not land".) Confirm the new assertion goes **RED on the
      current build**, then fix, then green. **Measure the actual element** (e.g. the sparkline svg
      AND its `<path>` vs each tile), never container-vs-container. Report the fail-first run in the
      §-entry.
- [ ] **Fail-first applies to TOOLING guards too, not just geometry (page-markets §13a):** *a guard
      never seen to fire is not a guard.* Any new **pre-check / degraded-state branch / dev script /
      CI guard** must be **demonstrated firing on the failure it guards** — exercise its FAILURE path,
      including the common case. (The `dev.sh` silent-exit regression shipped because the port
      pre-check was never run on its free-port path — the normal case — where `set -e` + a non-zero
      `grep` aborted the script before starting anything.) A guard whose red path is never observed is
      assumed-working, not verified.
- [ ] **COMPUTED STYLES ARE CLAIMS; RENDERED PIXELS ARE FACTS (page-cash-flow §13a).** A **visual**
      guard samples the **rendered pixels**, never `getComputedStyle`. The table-header corner shipped a
      `box-shadow` that *computed* correctly and *painted* nothing (it was clipped by the very container's
      scrollbar gutter): the style said "present", the pixels said "absent", and **the pixels were right**.
      When you assert a colour, a fill, a border reaches somewhere, **screenshot a small patch and compare
      it** — and sample **clear of rounded corners** (antialiasing near a radius bleeds into the patch and
      flakes the guard: move ≥ the corner radius inward, and require **five consecutive clean runs** before
      trusting a pixel diff).
- [ ] **A COMPONENT GUARD MEASURES A STATIC SPECIMEN (page-cash-flow §13b).** A guard for a **component**
      (a chip, a button, a table's chrome) runs against its **`/kitchen-sink` specimen**, which is static
      and needs no backend — NOT against a product page, whose content may be empty. Two component guards
      here passed in isolation and **timed out in the full CI e2e run**, because *the CI e2e suite has no
      backend* (§3b tooling note): the product pages rendered empty and the guards waited for content that
      could not exist. **A guard that needs a backend to find its subject is a page test wearing a
      component's name** — label it as one, and point it at the specimen.
      **Exception — a MEDIA-QUERY-RESPONSIVE component cannot be guarded on a static specimen
      (page-scenarios §12sc1-1).** Narrowing a fixed-width `/kitchen-sink` frame does not change the
      **viewport** the `@media` rule responds to, so a specimen frame can never reproduce a
      breakpoint-driven reflow (a 2×2→4-across tile strip). Its containment guard must run in the
      **scripted pre-pass at REAL viewports** (§13c), with the **shell present** so the fixed chrome
      subtracts real width — not on the specimen (§13b). This is the one component guard that lives in
      the pre-pass, not the kitchen-sink suite; label it so the next reader does not "fix" it back onto
      the specimen.
- [ ] **ASSERTIONS WITH TEETH — for any OWNER-VISIBLE defect (page-policy §13-1):** the assertion
      **(a)** is written against the **RENDERED artefact the owner looked at**; **(b)** is **seen RED on
      that exact state** (a mutation proof, not a claim); and **(c)** carries the **fixture that
      reproduces it** — *a guard whose fixture cannot express the defect is decoration* (a 3-item
      ReviewCard fixture proves nothing about the 17-item defect that broke the row).
      **Corollary:** if an assertion goes **RED on something the owner has already ACCEPTED**, the
      **assertion is wrong, not the product** — measure before you assert. **Assert CONTAINMENT** ("is
      the thing inside its box?"), **never a container's scroll metrics**: a clipping container keeps
      `scrollWidth === clientWidth` while a control is cut off the edge.
      *This is the page-home §12ho2-1 lesson RECURRING — recurrence means it was recorded but never
      MECHANISED, which is why it is now a checklist gate.*
      **Containment is measured on the CLIPPED ELEMENT, and `getBoundingClientRect` cannot see it
      (page-scenarios §12sc1-1).** A non-wrapping tabular value that overruns its tile is clipped, but
      its **rect is clamped to the visible box** (96px reported for 160px of content) — so a rect check,
      and a card-level tile-integrity guard whose subject is the card not the value, both pass. The
      honest test measures the **content element itself**: `el.scrollWidth <= el.clientWidth` on the
      value node. (Scenarios shipped a card-level guard that missed a child-tile clip for exactly this
      reason.)
- [ ] **Copy hygiene (page-chrome §11-8):** no decision ID (`D-0…`/`P-…`/`§…`) or
      implementation note (`server-side`, enum/endpoint names) in any user-facing string
      — grep the rendered copy. A changed label is updated **app-wide** (§11-4), not only
      where found.
- [ ] **Context-scoped picker (D-097):** verified **live** that a class/entity
      picker never offers a wrong-context option; cross-context matches appear only
      as navigate links.
- [ ] **A CROSS-PAGE AFFORDANCE IS GUARDED AS A JOURNEY (page-accounts §14ac-2).** A link/button that
      navigates to another page is guarded by **clicking the REAL control and asserting the destination
      STATE** (the arrived page is scoped/filtered as intended) — not merely that the destination renders
      correctly when handed the right params. A **destination-only** guard can be green while the link is
      broken: Accounts' "View holdings" tested Holdings-given-`?account=` (green) but never the click,
      which navigated via a manual `window.location.hash` write and arrived **unfiltered** (the
      destination mounted before the router's `location.search` reflected the query → an unfiltered fetch
      raced the scoped one). Click-the-control journey tests caught it; the fix was react-router
      navigation through a **shared URL builder** both entry points consume.
- [ ] **A TABLE SPECIMEN MUST RENDER THE ROW'S IDENTITY COLUMN (page-accounts §14ac-1).** A management/
      worklist table's first duty is to identify its row — so its geometry specimen **renders the row's
      IDENTITY column** (the name/symbol the user reads to know *what it is*), and its honesty cases include
      **a row identifiable ONLY by that column** (e.g. an account with no institution → "—" · Brokerage ·
      INR is unidentifiable without its Name). Accounts' ratified geometry led with *institution*; neither
      the §12 gate nor the pre-pass caught the missing **Name** column because no specimen row forced it.
      The identity-only row is what makes the gate fail *by looking* — a specimen only proves what it
      exercises.
- [ ] **A GUARD MEASURES THE GEOMETRY THE FINDING NAMES (page-insurance §14in-1/§15b).** A guard
      asserts the **exact dimension the finding names, at the width where it appears** — not a
      neighbouring property. §14in-1's gap-rhythm guard went **green on section gaps (16px rhythm)**
      while the owner's finding was the **page inset**; the false green hid the bug until batch 2. A
      green on an adjacent property is a false green — pin the named dimension (here, the page inset,
      measured at 1728) or the guard is decoration.
- [ ] **PHASE/BATCH REPORTS STATE THE FRONTEND-CHECK EXIT CODE FROM THE CORRECT DIRECTORY; NO
      KNOWN-RED LEFT ON TRUNK (page-insurance §15b(a)).** Every phase/batch report states the
      **`npm run check` EXIT CODE run from the frontend directory** (not a partial suite, not a stale
      module) — the exit-0 hard gate is what flushes hidden reds. §14in's **7 red Insurance unit tests
      hid behind the known-red `CashFlow.tsx:330` failure**; a known-red left standing is a screen the
      next regression hides behind. **A known-red is fixed or explicitly quarantined the SAME day it is
      found** (logged in `08-TECH-DEBT.md` with the reproducing ref), never left standing on trunk.

---

## 8. BUILD PHASES

*One commit per phase. Backend deltas (§3b) FIRST, then page assembly, then
tests. Never assemble the page against an endpoint that does not exist.*

- **Phase 0 — Contract deltas (if §3b non-empty):** build backend-first;
  regenerate `API-CONTRACT.json` + `docs/openapi.json` same commit; drift check
  green. *(Skip only if §3b is empty.)*
- **Phase 1 — Page assembly:** compose ratified components; wire to the endpoints;
  honest empty/error/stale states.
- **Phase 2 — Tests:** component/render tests, the acceptance criteria (§7),
  drift + typecheck + lint green; visual check both themes/densities. **For any
  layout-affecting change, extend the Playwright overflow suite (ADR-0004)** — jsdom
  cannot catch overflow (page-chrome §11-14); `npm run check` runs it.
- **Phase 3a — Scripted pre-pass, MUST be GREEN before the owner walk (first-run
  retrospective §13, PRIMARY LESSON):** author an **owner-independent scripted pre-pass**
  (the `e2e/smoke/` pattern — a dev-only Playwright/driver harness against the **live** app +
  real backend on a **reset** instance, captured console errors + telemetry, **never wired
  into `npm run check`/CI**). Drive the whole flow the owner would, in **both themes across
  the breakpoints**, and **fix everything it surfaces first**. On the first-run milestone this
  caught **11 findings before the walk — including backend defects no frontend test could see**
  (F5 `.env` drift, F6 provider-429 re-hammer, F8 API-side PIN length, F11 test `.env`
  isolation). The pre-pass tooling must be **deterministic** (reset the DB via a scripted
  reset that snapshots/restores `.env`, reads the active data dir) so it never drifts config
  across runs. **Do not start the owner walk until the pre-pass returns green (0 console
  errors, correct fresh state).** **A geometry/visual fix during the walk must add its own
  measuring assertion to this pre-pass in the SAME batch (page-portfolio §12b4-1)** — a repeat
  finding across batches means the earlier fix shipped without an assertion. **That assertion must
  be seen to FAIL on the pre-fix build (fail-first) and must measure the OWNER-VISIBLE defect, not a
  theory of it (page-net-worth §12b3-1)** — reproduce the defect (measure/screenshot) first, or you
  will "fix" the wrong thing and it recurs. Also **wait each progressive-loaded card out of skeleton
  before asserting its content** (§12-8) so the pre-pass never races a per-card reload.
- **Phase 3b — Owner acceptance walk (LIVE, Holdings retrospective) — JUDGMENT ITEMS ONLY:**
  the owner drives the **real rendered app**, because the biggest Holdings defects surfaced
  only there (silent 500-cap, snapshot-vs-ledger round-trip, 1366px overflow, mock-backed
  picker), across ~10 walks. With Phase 3a green, the walk is **for judgment calls** (copy,
  layout feel, semantics, ratifications) — not for defects the pre-pass should have caught.
  Each finding becomes a numbered `page-<name>.md §*` entry, fixed and **re-verified live** by
  the owner. A page is **done only after this walk**, not at green suites. Layout/popover/picker
  items MUST be verified by rendering (screenshots / DOM measurement), not tests. **The owner
  closes the phase — never self-certify it.**
- **Close ritual — the milestone is written down, then PUSHED (page-accounts §15-2).** On acceptance:
  (a) record the close (plan §-retrospective + the central acceptance log, `RATIFICATION.md §6`); (b)
  strike-check every §9/§12/§walk item against the actual diff before writing the retrospective (a claim
  is not a change — §13-2); (c) **push the close-out commits to the remote before the owner re-uploads.**
  Durability is part of closing, not an afterthought — the entire v2 rebuild once sat unpushed on the
  local trunk (255 commits ahead of `origin/main`). **The session that closes a milestone ends with
  `git push`.**
  - **CURRENT.md must be in the close commit's diff (data-feed-routing §15 forensic).** Every close
    updates `CURRENT.md` (the DONE/NEXT pointer the next session starts from). **The close report must
    show `CURRENT.md` inside the close commit's diff; a claimed CURRENT.md update without the file in
    the diff FAILS the close.** (A `git log --oneline -- CURRENT.md` at the R-38 close confirmed prior
    closes did touch it — this rule keeps it that way instead of on trust.)

---

> **THE CI e2e SUITE RUNS WITHOUT A BACKEND (page-cash-flow §13b/§13c).** `npm run check`'s Playwright
> pass has **no server** — product pages render their honest empty/error states, not data. So a **page-level**
> e2e assertion that needs real rows **only executes locally** (against a dev backend) and is **silently
> absent in CI**. Consequences: (1) **component** guards belong on the backend-free `/kitchen-sink` specimen;
> (2) a guard that was green locally can time out the moment it runs in the suite — **run the FULL suite, not
> the file in isolation, before trusting a new e2e guard**; (3) closing the gap itself (a CI backend, or an
> explicit local-only tier) is **its own task**, logged in `08-TECH-DEBT.md`.
>
> **A SILENT NO-OP EDIT IS A CLAIM, NOT A CHANGE (page-policy §13-2).** A scripted string-replace that
> matches **nothing** fails **silently** — page-policy's pencil icon was reported shipped on exactly that.
> **Every scripted replace asserts its match count**, and **no UI change is reported without looking at the
> render**. Likewise a **mutation proof run against the hot-reloading dev server can measure a STALE
> module** — wait for the rebuild, or the proof is worthless.

## 9. NEEDS DECISION

*Everything the specs under-specify, listed for the owner **before** build. Do
not improvise a resolution; do not start build on any item still open here.
Categories to check every time:*

- **Missing/ambiguous contract shape** — an endpoint whose response is not pinned,
  or a request body that lacks a field a decision requires.
- **Component gap** — an affordance no ratified component provides (needs a
  DESIGN-SYSTEM amendment before it can be built — new components are forbidden).
- **Mock-backed affordance** — a component wired to a mock fixture, not a real
  endpoint (§4). It passes tests but is not real; name the endpoint it needs and
  whether that endpoint is a contract delta (§3b).
- **Spec silence** — a behaviour the IA/decisions imply but do not specify.
- **Terminology gap** — a term the page must show that is not yet in GLOSSARY.
- **Vocabulary gap** — a categorical field with no MASTER-DATA vocabulary.

| # | Item | Why it blocks / what's needed | Proposed resolution (for owner to approve) |
|---|------|-------------------------------|--------------------------------------------|

---

**Sign-off to start build:** §9 has no open blocker · §3b deltas are approved ·
no component in §4 requires an unresolved amendment.

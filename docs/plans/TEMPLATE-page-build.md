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
- [ ] **Copy hygiene (page-chrome §11-8):** no decision ID (`D-0…`/`P-…`/`§…`) or
      implementation note (`server-side`, enum/endpoint names) in any user-facing string
      — grep the rendered copy. A changed label is updated **app-wide** (§11-4), not only
      where found.
- [ ] **Context-scoped picker (D-097):** verified **live** that a class/entity
      picker never offers a wrong-context option; cross-context matches appear only
      as navigate links.

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
  errors, correct fresh state).**
- **Phase 3b — Owner acceptance walk (LIVE, Holdings retrospective) — JUDGMENT ITEMS ONLY:**
  the owner drives the **real rendered app**, because the biggest Holdings defects surfaced
  only there (silent 500-cap, snapshot-vs-ledger round-trip, 1366px overflow, mock-backed
  picker), across ~10 walks. With Phase 3a green, the walk is **for judgment calls** (copy,
  layout feel, semantics, ratifications) — not for defects the pre-pass should have caught.
  Each finding becomes a numbered `page-<name>.md §*` entry, fixed and **re-verified live** by
  the owner. A page is **done only after this walk**, not at green suites. Layout/popover/picker
  items MUST be verified by rendering (screenshots / DOM measurement), not tests. **The owner
  closes the phase — never self-certify it.**

---

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

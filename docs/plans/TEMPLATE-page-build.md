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

| Ratified component | Role on this page | Prop/state not exercised at kitchen-sink |
|--------------------|-------------------|------------------------------------------|

**Affordances the ratified inventory lacks (amendment required before build — see §9):**
- …

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
  drift + typecheck + lint green; visual check both themes/densities.

---

## 9. NEEDS DECISION

*Everything the specs under-specify, listed for the owner **before** build. Do
not improvise a resolution; do not start build on any item still open here.
Categories to check every time:*

- **Missing/ambiguous contract shape** — an endpoint whose response is not pinned,
  or a request body that lacks a field a decision requires.
- **Component gap** — an affordance no ratified component provides (needs a
  DESIGN-SYSTEM amendment before it can be built — new components are forbidden).
- **Spec silence** — a behaviour the IA/decisions imply but do not specify.
- **Terminology gap** — a term the page must show that is not yet in GLOSSARY.
- **Vocabulary gap** — a categorical field with no MASTER-DATA vocabulary.

| # | Item | Why it blocks / what's needed | Proposed resolution (for owner to approve) |
|---|------|-------------------------------|--------------------------------------------|

---

**Sign-off to start build:** §9 has no open blocker · §3b deltas are approved ·
no component in §4 requires an unresolved amendment.

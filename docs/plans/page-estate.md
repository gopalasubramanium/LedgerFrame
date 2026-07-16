# page-estate — build plan

**PLAN ONLY (verify-first).** Filled through §10 (verify-first record) and §9
(NEEDS DECISION, PROPOSED but UNRESOLVED — owner rules one-pass, the
Insurance/Scenarios precedent). **No code beyond Part 0.** Copied from
`TEMPLATE-page-build.md`; every section derives from the named spec with a
file:line reference, never re-invented.

**Part 0 (doc-landing) — no-op, all three already landed (commit `15f682d`).**
TEMPLATE §7 carries both Insurance-close mechanisms (the geometry-the-finding-
names guard, TEMPLATE §7 `page-insurance §14in-1/§15b`; and the frontend-check
exit-code / no-known-red-on-trunk rule, `page-insurance §15b(a)`);
DESIGN-SYSTEM §5.1 carries the media-query-responsive-guard exception cross-
referencing TEMPLATE §7 (`DESIGN-SYSTEM.md:389`); RATIFICATION.md §6 carries the
central page-close log, the "closes logged centrally from Insurance onward"
convention (`RATIFICATION.md:154`), and the Insurance close entry
(`RATIFICATION.md:163`). Nothing re-landed.

**Shape to build against (from the task brief / Insurance pattern — NOT built):**
a three-register Worklist — a profile card (will status + executor, `[S]`-gated
`PUT`) + a contacts DataTable (CRUD, roles) + a documents DataTable (CRUD,
category + status) + a readiness summary of counts (no currency affix — counts,
not money). Estate documents are a **first-class register** with their own
category/status vocab — **NOT** the per-policy checklist pattern (the D-062
two-concepts split; do not conflate with Insurance's JSON `[{label,have}]`).

---

## 1. IDENTITY

*Source: INFORMATION-ARCHITECTURE.md §2/§3; DESIGN-SYSTEM.md §3.*

| Field | Value | Spec ref |
|-------|-------|----------|
| Page name (H1 = nav label = route) | **Estate** | IA §2 `INFORMATION-ARCHITECTURE.md:81` |
| Route | **`/estate`** | IA §2 `:81` |
| Nav group | **Planning** — last (6th) entry: Review · Policy · Cash flow · Scenarios · Insurance · **Estate** | IA §3 `:107` |
| Page template | **Worklist** (DataTable(s) + row actions + CRUD editor) | DESIGN-SYSTEM §3 `DESIGN-SYSTEM.md:229` |
| Rotation eligibility | Not a rotation surface (Planning-group record page, not an overview widget) | IA §3 (D-044) |
| One-line purpose | *"Will/executor, contacts, document-readiness register; isolated, no FKs."* | IA §2 `:81` |

> Worklist shape (per the Insurance/Cash flow precedent): a **summary header
> (readiness counts) + a records body (two DataTables) + a profile card + a
> `[S]`-gated CRUD editor** — the Worklist template, not Overview.
>
> **Fast-path note:** verify-first (§10) finds **every reader already frozen in
> the contract** (`/estate` + writes; `API-CONTRACT.json:4143-4751`), so §3b is a
> short **remove/guard/vocab/N-A** list — no new endpoint. Reading the engine
> first is the biggest schedule lever.

---

## 2. OWNERSHIP TABLE

*Copied from INFORMATION-ARCHITECTURE.md §5 (Estate, `:336-341`, D-063).*

**Owns (canonical, authoritative, fully explained here):** — IA §5 `:338-341`

- **Will status & executor** — `EstateProfile` (singleton): `will_status`,
  `will_location`, `executor`, `last_reviewed`, `next_review_date`, `notes`
  (`estate.py:36-38`, `_profile_dict`).
- **Contacts** — people & their **roles** (`nominee, beneficiary, executor,
  emergency, guardian` from `/refdata`); fields `name, roles[], phone, email,
  notes` (+ `relationship`, but see **⚠ §9-5**) (`estate.py:55-61`).
- **The estate document register** — a first-class register (`title, category,
  status, location, review_date, related_to, notes`); category + status from
  `/refdata`; `related_to` **free text by design** (D-063 no-FK invariant)
  (`estate.py:99-101`). **Distinct from Insurance's per-policy checklist**
  (D-062, GLOSSARY `:231-232`).
- **Readiness counts** — `docs_total, docs_present, docs_attention, will_status,
  nominees (nominee+beneficiary), executors, emergency` (`estate.py:151-159`).
- **The protected D-055-class disclaimer** — served today (`estate.py:161-162`):
  *"Family governance — a record of what exists and where, and reminders to keep
  it current. Not legal or estate-planning advice."* (ratify wording, §9-10).

**Summarises (other pages' info — via the named reader, linked, never recomputed):**

| Summary shown | Canonical page | Shared reader reused | Link target |
|---------------|----------------|----------------------|-------------|
| *(none — Estate is a terminal owner; it summarises no other page's figure on-page)* | — | — | — |

**Reciprocal note (who summarises Estate):** **Review** surfaces Estate's
will/document/review-date status strings in its attention feed via the shared
`estate_signals()` helper (`review.py:153-157` → `estate.py:165-188`) — Review
**owns the attention row**, Estate **owns the underlying records**. The IA §5
Estate block has an **Owns line only** (no Summarises / Links rows) — recorded
faithfully; the page links out only for its own Help terms.

**Enforcement corollary (P-1/D-031):** Estate holds **no market inputs and no
money** and **does not FK** into portfolio tables (D-063 no-FK isolation,
protected §0). The will-state Review shows and the will-state the page shows are
the **same `profile.will_status`** (single source) — the plan must not propose
normalising the tables (§10-2) nor a second will-state derivation (§9-7).

---

## 3. API SURFACE

*Source: API-CONTRACT.json (frozen) + API-CONTRACT.md delta table.*

### 3a. Endpoints consumed (already in the frozen contract)

| Method + path | Purpose on this page | Response shape pinned? |
|---------------|----------------------|------------------------|
| `GET /api/v1/estate` | **The whole page** — profile, contacts[], documents[], readiness, disclaimer | **In the contract; untyped** (bare `dict`). Full shape in §10-1. `API-CONTRACT.json:4143` |
| `PUT /api/v1/estate/profile` **[S]** | Save will status / executor / review dates / notes (`ProfileIn`) | in contract; `require_auth` (`routes/estate.py:68`) · `JSON:4751` |
| `POST /api/v1/estate/contacts` **[S]** | Add a contact (`ContactIn`) | in contract; `require_auth` (`:75`) · `JSON:4210` |
| `PATCH /api/v1/estate/contacts/{cid}` **[S]** | Edit a contact (`ContactIn`) — 404 on missing | in contract; `require_auth` (`:82`) · `JSON:4363` |
| `DELETE /api/v1/estate/contacts/{cid}` **[S]** | Delete a contact | in contract; `require_auth` (`:92`) · `JSON:4287` |
| `POST /api/v1/estate/documents` **[S]** | Add a document (`DocumentIn`) | in contract; `require_auth` (`:99`) · `JSON:4447` |
| `PATCH /api/v1/estate/documents/{did}` **[S]** | Edit a document (`DocumentIn`) — 404 on missing | in contract; `require_auth` (`:106`) · `JSON:4600` |
| `DELETE /api/v1/estate/documents/{did}` **[S]** | Delete a document | in contract; `require_auth` (`:116`) · `JSON:4524` |
| `GET /api/v1/refdata` | `will_status`, `estate_doc_status`, `estate_doc_category`, `contact_role` as `{value,label}` for the editor MasterSelects | in contract (`refdata.py:133-136`) |

**Write path exists and is [S]-gated.** All seven writes carry
`dependencies=[Depends(require_auth)]` — a CRUD page; the editor is `[S]`-gated
at the UI (ambient PIN session, D-103) mapping to the `require_auth` backend gate
(`deps.py:77-110`: 401 when locked, 403 for read-only tokens on mutations). The
two GETs are read-gated router-wide (`require_read_auth`, `deps.py:113-124`).
Note verbs: create = `POST`, edit = **`PATCH`**, delete = `DELETE`, profile =
`PUT` (singleton).

### 3b. Contract deltas (needed but not in the baseline — BUILD BACKEND-FIRST)

> **⚠ Verify-first divergence flag.** The reader **exists**; §3b is a
> **remove / behaviour / N-A / doc** list — what the reader guards and whether a
> leftover endpoint is retired, not a *"no reader"* list. **Every row is PROPOSED
> and GATED on its §9 item. None is approved.**

| kind | Endpoint (current → intended) | Decision | Why this page needs it |
|------|-------------------------------|----------|------------------------|
| **remove ✅** | `GET /api/v1/estate/meta` → **DELETED** (vocab lives on `/refdata`) | **§9-1** (D-005) | **DELIVERED 2026-07-16.** No consumer (grep clean); deleted; contract regen same commit (`API-CONTRACT.json`/`openapi.json` no longer carry the path); drift check green. Removal proven by SHAPE (`test_estate_phase0.py::test_estate_meta_endpoint_removed_by_shape`, RED→GREEN). |
| **behaviour ✅** | `GET /api/v1/estate` + writes — **`?entity_id` REJECTED (400)** | **§9-2** | **DELIVERED 2026-07-16.** Shared `reject_entity_id` dependency on **all 8 endpoints** (read + 7 writes), ordered before `require_auth`; plain-language *"the estate register is household-scoped: it cannot be filtered to one entity"* (no decision IDs in served copy). The added `entity_id` query param regen'd the contract same commit. Fail-first `test_estate_phase0::test_entity_id_rejected_with_400_on_every_endpoint` RED (silent 200)→GREEN. |
| **behaviour / spec ✅** | `review.py` estate signal + `estate.py` — **`_REVIEW_SOON_DAYS = 30` promoted to a named-constant table row + same-batch code test** | **§9-8** (D-059) | **DELIVERED 2026-07-16.** Added to PRODUCT-SPEC §5 D-059 table (value 30, rationale: one month's notice before a scheduled estate review, mirroring `_INSURANCE_SOON_DAYS`). Same-batch behavioural test `test_estate_phase0::test_review_soon_days_threshold_is_30_per_spec` pins the SERVED threshold (surfaces at 30d, silent at 31d); teeth proven (constant→31 = RED). |
| **N/A (recorded, not built)** | `GET /api/v1/estate` — **NO `*_display` money strings; NO base-currency affix** | **§9-3** (D-105) | There is **no money field anywhere** on this page (§10-4). D-105 served-display-strings and the base-currency affix are **N/A by construction** — recorded as a chosen decision so the absence is deliberate, not missed. |
| **N/A (recorded, not built)** | `GET /api/v1/estate` — **NO staleness / confidence annotation** | **§9-4** (A10) | No market inputs; every field is a user record (§10-4). A10 staleness/confidence is **N/A by construction** — recorded, not silently skipped. |
| **doc-only ✅** | **API-CONTRACT.md** — `/estate/meta` `remove` row flipped to **✅ delivered** | **§9-1** | Done 2026-07-16, same-commit contract regen (freeze rule). |

**Note (typed response).** `/estate` returns a bare `dict`. **Typing is
DEFERRED** — a `response_model` silently strips undeclared keys and this page
adds no served fields (only removes `/estate/meta`); record in `08-TECH-DEBT.md`
alongside the Insurance/Scenarios deferrals, do not bundle.

**Rename/removal test discriminates by SHAPE, not status** (TEMPLATE §3b note):
after deleting `/estate/meta`, assert the old path is **not** `application/json`
of the meta shape (the SPA serves `200` HTML for any unmatched path).

---

## 4. COMPONENTS

*Worklist template — readiness header + profile card + two records tables + CRUD
editor. Only ratified components (DESIGN-SYSTEM §5).*

| Ratified component | Role on this page | Data source | Prop/state not exercised at kitchen-sink |
|--------------------|-------------------|-------------|------------------------------------------|
| **PageHeader** | H1 "Estate" + subtitle carrying the protected **"a readiness register, never legal advice"** bar (§9-10) | served `disclaimer` (**real**) | subtitle carrying protected copy |
| **TrendStat / summary tiles** | The **readiness strip** — Will status · Documents present/attention · Nominees · Executors · Emergency contacts. **Counts, NOT money → no currency affix** (§9-3) | `.readiness` (**real**) | count-only tiles (no unit affix) |
| **DataTable** | The **contacts table** — name · roles (chips) · phone · email. **Bounded (tens of rows), client-side** sort/filter (D-094) | `.contacts[]` (**real**) | — |
| **DataTable** | The **documents register** — title · category (chip) · status (StatusChip) · location · review date. **Bounded, client-side** (D-094). *A first-class register, NOT a checklist (D-062).* | `.documents[]` (**real**) | — |
| **StatusChip** | Document **status** (present / missing / outdated) and **will_status** (none/draft/executed/needs_update) — semantic tone only | served `status` / `will_status` | needs_update / outdated tones |
| **`.lf-card` + label/value** or **MetaStrip** | The **profile card** — will status · will location · executor · last reviewed · next review date · notes | `.profile` (**real**) | MetaStrip for estate identity (new surface) |
| **RowMenu (⋯)** | Per-row **Edit · Delete** on both tables — never a wide action column (D-094 / Holdings §9-22) | — | — |
| **Dialog** + **MasterSelect** + **TextInput** + **DateInput** | The **CRUD editors** (contact / document / profile), `[S]`-gated (D-103). MasterSelect for `category`/`status`/`will_status`; **roles multi-select — see §9-6**; DateInput for review dates; TextInput for name/executor/location/notes | `/refdata` + `*In` (**real**) | the roles multi-select composition (§9-6) |
| **ConfirmDialog (+ PIN)** | Delete confirmation; `[S]` gate on the write entry points (D-103, fresh PIN never bound to unlock) | — | — |
| **EmptyState** | **Empty register(s)** — no contacts / no documents / will `none` — each with a reason + CTA (§9-1 honesty; Product Guarantee 3) | `len == 0` / `will_status == "none"` | the reason + CTA per register |
| **Skeleton** | Per-card progressive loading (single reader drives the page) | — | — |
| **GlossaryTerm** | `[Help]` — **Will, Executor, Beneficiary, Guardian, Emergency contact, Readiness** and the status values are **MISSING** from GLOSSARY (§9-9); *Nominee* + *Estate documents* exist | GLOSSARY | — |

**Affordances the ratified inventory lacks (amendment required before build — see §9):**
- **A multi-select over a fixed vocab** for contact `roles` (a `list[str]`; a
  contact may hold several roles, e.g. executor + guardian). `MasterSelect` is
  **single-select**. **PROPOSE composing from ratified `Switch` rows (one per
  role) or a chip multi-select inside the editor Dialog** (no new component); if
  the owner wants a distinct reusable `MultiSelect` primitive that is a §5
  amendment → **§9-6**.

**Component usage rules the build must honour:** cards LAYERED (D-100); scroll =
content only, header outside (D-101); the shared `.lf-page` shell + **one page
inset** (DESIGN-SYSTEM §3.1, `:248`) — add no root `max-width`/centering/padding;
row actions in `RowMenu`; `MasterSelect` for every categorical (no inline option
lists); popovers portal to the viewport (DESIGN-SYSTEM §6). **No money strings,
no base-currency affix** on this page (§9-3). **No chart** proposed (readiness is
counts; a chart would be a §5 amendment, not an assumption).

**Tables — dataset-size posture (D-094):** both the contacts table and the
documents register are **bounded** (a household holds tens of each) → **client-
side** sort/filter; revisit threshold **~500 rows** (never realistic).

---

## 4b. PER-VARIANT FIELD & ACTION SPECS

**Partially applicable.** The document register has a `category` variant
(`will/insurance/property/loan/identity/bank/tax/medical/other`) and a `status`
variant, but the **field set is UNIFORM across categories** — `DocumentIn` is one
flat schema (`routes/estate.py:47-54`); the engine does **not** branch
required/optional fields by category. Likewise `ContactIn` is one flat schema
across roles. So:

- **Entry is in the user's vocabulary (D-089):** every editor opens with plain-
  label MasterSelects (served `{value,label}` from `/refdata`), not raw enums.
- **Fields per variant (D-091): NOT branched today**, and not opened this
  milestone (recorded so the absence is a decision, not an omission).
- **Served by:** `/refdata` for every categorical (D-005, frontend zero-copy).

| Variant | Actions/types offered | REQUIRED fields | OPTIONAL-PROMPTED fields | Served by |
|---------|-----------------------|-----------------|--------------------------|-----------|
| **Contact** (any role) | Add / Edit / Delete | `name` (`ContactIn.name`, required) | `roles[]`, `phone`, `email`, `notes` (+ `relationship` ⚠ §9-5) | `/refdata` `contact_role` |
| **Document** (any category) | Add / Edit / Delete | `title` (`DocumentIn.title`, required) | `category`, `status`, `location`, `review_date`, `related_to`, `notes` | `/refdata` `estate_doc_category`, `estate_doc_status` |
| **Profile** (singleton) | Edit only (`PUT`) | *(none hard-required; all nullable)* | `will_status`, `will_location`, `executor`, `last_reviewed`, `next_review_date`, `notes` | `/refdata` `will_status` |

Unknown enum values are coerced server-side (`will_status`→`none`
`estate.py:48-49`; `category`→`other` `:112`; `status`→`present` `:114`; roles
filtered to `CONTACT_ROLES` `:72`) — the editor must only ever submit valid
`/refdata` values, so coercion is a backstop, never the front door.

---

## 5. VOCABULARIES

*Source: MASTER-DATA.md §2. Every categorical → its vocabulary + `MasterSelect`.*

| Field on this page | Vocabulary / master | Fixed (/refdata) or extensible | MASTER-DATA ref |
|--------------------|---------------------|-------------------------------|-----------------|
| `profile.will_status` | `WILL_STATUSES` (`none, draft, executed, needs_update`) — refdata key **`will_status`** | Fixed (/refdata) | `MASTER-DATA.md:64` (D-010) |
| `document.status` | `DOC_STATUSES` (`present, missing, outdated`) — refdata key **`estate_doc_status`** | Fixed (/refdata) | `MASTER-DATA.md:65` (D-010) |
| `document.category` | `DOC_CATEGORIES` (9: `will…other`) — refdata key **`estate_doc_category`** | Fixed (/refdata) | `MASTER-DATA.md:75` (DEF-5) |
| `contact.roles[]` | `CONTACT_ROLES` (`nominee, beneficiary, executor, emergency, guardian`) — refdata key **`contact_role`** | Fixed (/refdata) | `MASTER-DATA.md:76` (DEF-5) |

**Refdata key names differ from the constant names and from the `/estate/meta`
keys** (verified `refdata.py:133-136`): `will_status`, `estate_doc_status`,
`estate_doc_category`, `contact_role`. The MasterSelects bind to **these** keys.

**User data, not a master (use free text / `TextInput`, never MasterSelect):**
`name`, `executor`, `will_location`, `phone`, `email`, `notes`, `title`,
`location`, `related_to` (free text by design, D-063), and dates via `DateInput`.
The `relationship` field is a spec-vs-code divergence — **⚠ §9-5**.

---

## 6. DECISIONS IN FORCE

*Source: docs/audit/DECISIONS.md. Each decision that constrains this page.*

| Decision | What it forbids / requires on this page |
|----------|------------------------------------------|
| **D-063** (`DECISIONS.md:349`) | Roles/category/statuses from `/refdata`; **relationship folded into roles**; `related_to` free text; **no-FK isolation invariant** (§0). ⇒ **Do not normalise the estate tables; do not FK into portfolio**; surface `related_to` as free text. Relationship-fold vs code = **⚠ §9-5**. |
| **D-062** (`DECISIONS.md:348`, GLOSSARY `:225-232`) | Estate documents ("is my documentation in order") are **distinct from** the per-policy checklist ("do I hold this policy's papers"). ⇒ Build the documents register as a **DataTable with category/status vocab**, never the Insurance `[{label,have}]` Switch checklist. |
| **D-010** (`MASTER-DATA.md:50-51,64-65`) | `WILL_STATUSES` / `DOC_STATUSES` enumerated verbatim; `relationship` dropped, folded into `CONTACT_ROLES`. ⇒ Editor consumes `/refdata`, submits only valid values; relationship handled per §9-5. |
| **D-005** (`API-CONTRACT.md:73`) | Vocab served from `/refdata`, frontend zero-copy; retire the `/estate/meta` duplicate. ⇒ §9-1 remove delta. |
| **D-055 / §0 honesty family** (`DECISIONS.md:341,62-64`) | The "reporting, never advice" protected-copy class. ⇒ Estate is a **readiness register, never legal/estate-planning advice** — protected bar + standing content guard (§9-10). |
| **D-105** (scope amendment) | Money = served display strings everywhere. ⇒ **N/A here — no money** (§9-3), recorded as a chosen decision. |
| **D-059** (`PRODUCT-SPEC.md §5`) | Every Review threshold is a named constant with a one-line rationale + a same-batch code test. ⇒ `_REVIEW_SOON_DAYS = 30` promoted (§9-8). |
| **D-103** (SECURITY-BASELINE) | The `[S]` gate / purge-PIN is a fresh PIN, never bound to the unlock session. ⇒ every write (profile PUT included) is `[S]`-gated. |
| **D-094 / D-100 / D-101 / §3.1** | DataTable dataset posture + layered cards + header-outside-scroll + one page inset. ⇒ both tables bounded/client-side; `/estate` added to the inset guard (§10-8). |
| **D-044** | Rotation eligibility — Estate is a record page, not a rotation widget. |

---

## 7. ACCEPTANCE CRITERIA

*Checkable, user-visible. Includes honesty states + theme/density matrix.*

- [ ] **Happy path:** `/estate` renders the readiness strip, profile card,
      contacts table, and documents register from the live `GET /estate`; the
      `[S]`-gated editors create/edit/delete a contact, a document, and the
      profile, round-tripping through the real endpoints (request-body asserted,
      Holdings §9-35).
- [ ] **Empty state:** empty contacts / empty documents / will `none` each show
      a **reason + CTA** (Product Guarantee 3) — never a blank panel.
- [ ] **Error state:** a failed reader skeletons its own card then shows an
      **honest error with retry** (progressive per-card loading, TEMPLATE §12-8).
- [ ] **Staleness / low-confidence:** **N/A by construction** — no market inputs
      (§9-4); recorded, not faked.
- [ ] **No money on the page:** the readiness tiles are **counts** — no currency,
      no base-currency affix (§9-3). A guard asserts no money-formatted string is
      rendered.
- [ ] **Long-name / large-count data** render correctly (long executor/contact
      names truncate with `title`; many roles as wrapping chips; no overflow).
- [ ] **Both densities + both themes** correct; **interactive OPEN states**
      (MasterSelect / DateInput popups, Dialog, ConfirmDialog, Toast) verified in
      light AND dark at `/kitchen-sink`.
- [ ] **Keyboard + WCAG AA** (focus ring, `aria-sort`, labels, roles chips).
- [ ] **Terms match GLOSSARY** (the §9-9 additions land in `GLOSSARY.md` FIRST,
      then the popover — parity guard `test_glossary_parity.py`); **categoricals
      come from `/refdata`** (`will_status`, `estate_doc_status`,
      `estate_doc_category`, `contact_role`), no inline option lists.
- [ ] **Tables (D-094):** both bounded → client-side sort/filter; assumption +
      revisit threshold recorded (§4).
- [ ] **Protected copy (§9-10):** the "readiness register, never legal advice"
      bar renders from the served `disclaimer`; a **STANDING legal-advice-language
      content guard** is proven **RED→GREEN** (the Scenarios D-058 forecast-guard
      / Insurance adequacy-guard precedent).
- [ ] **`?entity_id` (§9-2):** honest **400** on every estate endpoint (fail-
      first: accepted today = RED), IF the owner rules reject.
- [ ] **Copy hygiene (page-chrome §11-8):** no decision ID / impl note in any
      user-facing string; a changed label updated app-wide.
- [ ] **Rendered layout verification (ADR-0004):** `#/estate` added to **all
      three** `overflow.spec.ts` route arrays (PAGES per-breakpoint, the page-
      inset `ROUTES` `:107`, the shared-shell `SHELL_ROUTES` `:169`); zero
      horizontal overflow + single vertical scroll at 320/375/900/1366 × both
      themes; **page-inset measured at 1728** (DESIGN-SYSTEM §3.1).
- [ ] **A guard measures the geometry the finding names** (TEMPLATE §7,
      `page-insurance §14in-1`) — pin the named dimension, not a neighbour.
- [ ] **Phase reports state the `npm run check` EXIT CODE from `frontend/`; no
      known-red left on trunk** (TEMPLATE §7, `page-insurance §15b(a)`). *Note the
      pre-existing `CashFlow.tsx:330` known-red logged in `08-TECH-DEBT.md` —
      fixed or quarantined the day the Estate build starts, never built over.*
- [ ] **Every geometry fix ships a fail-first pre-pass assertion** measuring the
      OWNER-VISIBLE defect (page-portfolio §12b4-1 / page-net-worth §12b3-1).

---

## 8. BUILD PHASES

*One commit per phase. Backend deltas (§3b) FIRST, then assembly, then tests.*

- **Phase 0 — Contract deltas (§3b, gated on §9):** delete `GET /estate/meta`
  (§9-1), confirm no consumer, regen `API-CONTRACT.json` + `docs/openapi.json`
  same commit, flip the `API-CONTRACT.md:73` row to ✅, drift check green;
  `?entity_id`→400 (§9-2, fail-first) IF ruled; promote `_REVIEW_SOON_DAYS` to
  PRODUCT-SPEC §5 + a same-batch code test (§9-8) IF ruled. Resolve `relationship`
  (§9-5) at the schema boundary before the editor is specced.
- **Phase 0a — GLOSSARY + `/refdata` confirm (§9-9):** add the estate terms to
  `GLOSSARY.md` FIRST, then the popover data; confirm the four vocabs already
  serve `{value,label}` (they do). No new `/kitchen-sink` component unless §9-6
  rules a `MultiSelect` amendment.
- **Phase 1 — Page assembly:** compose the ratified components on the Worklist
  geometry (readiness strip → profile card → contacts table + documents register
  → `[S]`-gated editors); honest empty/error states; served `disclaimer` bar.
- **Phase 2 — Tests:** render/component tests + the acceptance criteria (§7);
  extend `overflow.spec.ts` (all three route arrays); the standing content guard
  RED→GREEN; drift/typecheck/lint green.
- **Phase 3a — Scripted pre-pass (GREEN before the walk):** drive the live app +
  real backend on a reset instance, both themes across breakpoints; CRUD round-
  trips; 0 console errors; every card out of skeleton; each geometry fix adds a
  fail-first measuring assertion.
- **Phase 3b — Owner acceptance walk (judgment items only):** the owner drives
  the real rendered app and closes the phase. **Never self-certified.**

---

## 9. NEEDS DECISION — **RESOLVED (owner one-pass, 2026-07-16)**

*Everything the specs under-specify, surfaced BEFORE build. The owner ruled all
ten in one pass on **2026-07-16** — every item **ACCEPTED as proposed**, with one
amendment on 9-5 (**Amendment E**, recorded verbatim below the table). Each row's
final cell carries its **→ RULING**; nothing is struck. Build may start (§3b
deltas approved; no §4 affordance rides an unresolved amendment).*

| # | Item | Why it blocks / what's needed | Proposed resolution → **RULING (2026-07-16)** |
|---|------|-------------------------------|--------------------------------------------|
| **9-1** | **Retire `GET /estate/meta`** (D-005) | The delta row (`API-CONTRACT.md:73`) is unshipped; `/refdata` already serves all four vocabs with labels (`refdata.py:133-136`). Two sources for one vocab is the drift trap. | **Delete `/estate/meta`**; confirm no consumer (frontend unbuilt; grep clean); regen contract same commit; flip the delta row to ✅; discriminate the removal by response **shape** not status (Insurance §9-3 precedent). **→ RULING: ✅ ACCEPTED 2026-07-16 — delete `/estate/meta`; fail-first by SHAPE.** |
| **9-2** | **`?entity_id` on estate endpoints** | Silently ignored today (no estate endpoint declares it). Household-only by construction (no entity FK, D-063). Policy/Scenarios/Insurance reject with an honest 400. | **Reject with honest 400** on every estate endpoint (household-scoped), **fail-first** (accepted today = RED). *Alternative:* leave ignored (weaker — inconsistent with the sibling pages). Recommend reject. **→ RULING: ✅ ACCEPTED 2026-07-16 — honest 400 on every estate endpoint (reads + writes); plain-language "the estate register is household-scoped", no decision IDs in served copy.** |
| **9-3** | **Money / base-currency affix — N/A** (D-105) | There is **no money field** anywhere on this page (§10-4). Recording the absence keeps it a chosen decision, not a missed standard. | **Record as N/A (chosen):** no `*_display` strings, no base-currency affix — readiness tiles are counts. A guard asserts no money-formatted string renders. **→ RULING: ✅ ACCEPTED 2026-07-16 — money/base-currency affix N/A (CHOSEN); the no-money-string render guard ships with the Phase 2 page tests (see §11).** |
| **9-4** | **Staleness / confidence (A10) — N/A** | No market inputs; every field is a user record (§10-4). | **Record as N/A (chosen):** no staleness/confidence annotation; the honesty burden here is empty-state reasons + the advice guard, not freshness. **→ RULING: ✅ ACCEPTED 2026-07-16 — staleness/confidence (A10) N/A (CHOSEN).** |
| **9-5** | **⚠ The `relationship` field — spec-vs-code divergence** | D-010/D-063 + MASTER-DATA `:112-116` say `relationship` is **dropped, folded into `roles`**; but the code still carries and **serves** a free-text `relationship` (`ContactIn` `routes/estate.py:40`; `EstateContact`; `_contact_dict` `estate.py:60`). The editor field spec cannot be written until this is ruled. | **Match the ratified spec:** the editor **omits** `relationship`; a backend delta stops serving it and drops the column (migration) — OR keep the column as inert legacy but never edit/display it. Recommend the drop (the spec says "dropped"), owner rules the migration scope. **→ RULING: ✅ ACCEPTED 2026-07-16 — DROP the column + retire the field from `ContactIn`/`_contact_dict`, PLUS AMENDMENT E (below): fold-then-drop, free text is folded into `notes` (prefixed `Relationship: «value»`), never destroyed.** |
| **9-6** | **Contact `roles` multi-select — component affordance** | `roles` is a `list[str]` over a fixed 5-value vocab (a contact may hold several). `MasterSelect` is **single-select**; the ratified inventory has no fixed-vocab multi-select. | **Compose from ratified `Switch` rows** (one per role) inside the editor Dialog — no new component (the Insurance documents-checklist precedent). *Alternative:* ratify a reusable `MultiSelect` primitive (§5 amendment). Recommend Switch rows. **→ RULING: ✅ ACCEPTED 2026-07-16 — compose from ratified `Switch` rows inside the editor Dialog; MultiSelect primitive DECLINED (no new component).** |
| **9-7** | **Readiness / will-state single derivation (A11 seam)** | Review already delegates to the shared `estate_signals()` (`review.py:153-157`), so will-state is single-sourced (`profile.will_status`). But `estate_signals()` and `estate_report().readiness` compute **doc-attention twice** independently (identical predicate `status in ("missing","outdated")`, `estate.py:154` vs `:175`). | **Accept as consistent-by-construction** (same module, same predicate, one will-state source) **+ an equality test** pinning the two attention counts — the renewal_reminders precedent without the refactor. *Alternative:* extract one `_estate_readiness(profile, docs)` both call. Recommend the test-only option. **→ RULING: ✅ ACCEPTED 2026-07-16 — equality test only (A11, test-only); NO refactor. The test IS the mechanism.** |
| **9-8** | **`_REVIEW_SOON_DAYS = 30` named constant (D-059)** | The estate review-date signal uses `_REVIEW_SOON_DAYS = 30` (`estate.py:23`) but it is **absent from PRODUCT-SPEC §5's D-059 table** — a served value the spec doesn't record can silently drift (the page-review §13 lesson). | **Add a §5 table row** (`_REVIEW_SOON_DAYS = 30`, rationale: one month's notice before a scheduled estate review, mirroring `_INSURANCE_SOON_DAYS`) **+ a same-batch code test** pinning the served value, fail-first. **→ RULING: ✅ ACCEPTED 2026-07-16 — add the §5 D-059 row + a same-batch fail-first code test pinning `_REVIEW_SOON_DAYS = 30`.** |
| **9-9** | **GLOSSARY terminology gap (SN-class parity)** | The page shows terms **absent from GLOSSARY.md**: **Will, Will status, Executor, Beneficiary, Guardian, Emergency contact, Readiness (document-readiness)**, and the status values **draft / executed / needs_update / present / missing / outdated**. Only *Nominee* + *Estate documents* exist (insurance-framed). Parity guard fails otherwise. | **Author the user-facing terms in `GLOSSARY.md` FIRST** (then the popover data), each plain-language, exact spelling. Owner approves the set + wording. (Status values may ride their parent term rather than each getting a row — owner's call.) **→ RULING: ✅ ACCEPTED 2026-07-16 — author Will, Will status, Executor, Beneficiary, Guardian, Emergency contact, Readiness in `GLOSSARY.md` FIRST, then mirror the popover; STATUS VALUES (draft/executed/needs_update/present/missing/outdated) RIDE their parent term's entry — no per-value rows. Mark PROPOSED → ratify at the walk.** |
| **9-10** | **Protected legal-advice bar + standing content guard** (D-055 / §0 family) | The page is a readiness register, **never legal advice**. The engine already serves a disclaimer (`estate.py:161-162`): *"Family governance — a record of what exists and where, and reminders to keep it current. Not legal or estate-planning advice."* Needs a ratified bar + a mechanised guard. | **(a) Surface the served string as the PageHeader protected bar** — ratify it verbatim or amend the wording; **(b) a STANDING legal-advice-language content guard** asserting no directive/advice phrasing ("you should", "we recommend", "draft your will", "you must") appears in any served estate copy, proven **RED→GREEN** (the D-058 forecast-guard / adequacy-guard precedent). Owner rules wording + guard scope. **→ RULING: ✅ ACCEPTED 2026-07-16 — the served disclaimer (`estate.py:161-162`) is RATIFIED VERBATIM (do not reword) as the protected bar; add the STANDING legal-advice-language content guard over ALL served estate copy (the disclaimer itself must also pass), proven RED→GREEN, permanent + labelled standing.** |

### AMENDMENT E (binds 9-5) — recorded verbatim (owner, 2026-07-16)

> The `relationship` column is DROPPED per spec (D-010/D-063, MASTER-DATA), but the
> migration must not destroy data: before the drop, every contact with a non-empty
> `relationship` gets it FOLDED into its `notes` field, prefixed
> `Relationship: «value»` (newline-appended if notes exist). Free text cannot map
> into the fixed `roles` vocab — folded, not destroyed. One fail-first test: a
> fixture contact with `relationship="sister"` + existing notes → after migration,
> notes carry both, column gone, serve/edit surfaces clean.

**Binding on the §3b `relationship` retire row and the §11 Phase-0 record.** The
Alembic migration rides the legacy chain (ADR-0001); the contact shape changes, so
the contract regen rides the same commit (freeze rule).

---

## 10. VERIFY-FIRST RECORD (D-019)

*What the engine actually serves — read in code, file:line, before any build.*

### 10-1. The reader + the CRUD engine — frozen; reads open, writes [S]-gated
`GET /estate` (`routes/estate.py:57-59`) → `estate_report()` (`estate.py:141-162`)
serves **`{profile, contacts[], documents[], readiness, disclaimer}`**:
- **profile** (`_profile_dict` `:36-38`): `will_status, will_location, executor,
  last_reviewed, next_review_date, notes` (singleton; no `id`).
- **contacts[]** (`_contact_dict` `:55-61`): `id, name, relationship, roles[],
  phone, email, notes` (sorted by name).
- **documents[]** (`_doc_dict` `:99-101`): `id, title, category, location,
  status, review_date, related_to, notes` (sorted by category, title).
- **readiness** (`:151-159`): `docs_total, docs_present, docs_attention (missing
  + outdated), will_status, nominees (nominee+beneficiary), executors,
  emergency` — **raw counts, no score, no percentage**.
- **disclaimer** (`:161-162`) — the protected string (§9-10).

Writes (all `require_auth`, `routes/estate.py`): `PUT /estate/profile` (`:68`,
`ProfileIn`), `POST/PATCH/DELETE /estate/contacts[/{cid}]` (`:75/:82/:92`,
`ContactIn`), `POST/PATCH/DELETE /estate/documents[/{did}]` (`:99/:106/:116`,
`DocumentIn`). 404 on missing id (`:86-87/:110-111`). All return `{ok:True,...}`.

### 10-2. No-FK isolation + no entity scope — D-063 intact
Three isolated tables (`EstateProfile/Contact/Document`, models `549-582`); no FK
into portfolio; `related_to` is free text (max 120). **The plan does not propose
normalising** (protected §0). No `entity_id` anywhere → §9-2.

### 10-3. `/estate/meta` is a leftover; `/refdata` is the D-005 source
`GET /estate/meta` (`routes/estate.py:62-65`) serves the four vocabs as **bare
lists** under keys `doc_categories/contact_roles/will_statuses/doc_statuses`.
`/refdata` (`refdata.py:133-136`) already serves the **same four as
`{value,label}`** under `will_status/estate_doc_status/estate_doc_category/
contact_role`. The delta says remove `/estate/meta` → §9-1 / §3b.

### 10-4. Money, staleness, confidence — genuinely NONE
No money/amount/currency/value field in any estate response, dict, `*In` model,
or ORM model (verified). No stale/confidence/as_of field. → recorded as **chosen
N/A decisions** (§9-3, §9-4), not missed.

### 10-5. `?entity_id` — silently ignored (the Insurance §10-7 class)
No estate endpoint declares `entity_id`; FastAPI ignores the unknown param. →
§9-2 proposes honest-400, fail-first.

### 10-6. Profile shape drives the editor
`ProfileIn` (`routes/estate.py:29-35`): `will_status, will_location, executor,
last_reviewed, next_review_date, notes` — all nullable, string-typed (dates are
ISO strings, not typed). `will_status` coerced to `none` if invalid (`:48-49`).
→ profile editor: `will_status` MasterSelect + TextInputs + two DateInputs.

### 10-7. The Review pre-cut seam (A11) — one helper, two derivations
Review's estate block delegates to `estate_signals()` (`review.py:153-157` →
`estate.py:165-188`), which reads `profile.will_status` directly and emits: *"No
will recorded"* (`:170`), *"Will is marked as needing an update"* (`:172`),
*"{n} key document(s) marked missing or outdated"* (`:177`), *"Estate review is
overdue (was …)"* (`:183`), *"Estate review due in {days} days"* (`:185`).
Will-state is **single-sourced**; doc-attention is computed **twice** (`:154` vs
`:175`, same predicate). → §9-7 (equality test, not refactor).

### 10-8. Platform standards inherited — /estate absent from the guards
`/estate` is **absent from all three `overflow.spec.ts` route arrays** — the
per-breakpoint `ROUTES` (`:10-28`), the page-inset `ROUTES` (`:107-108`), and the
shared-shell `SHELL_ROUTES` (`:169`). The build **adds `#/estate` to all three**
(§7). Page maps to Worklist (`DESIGN-SYSTEM.md:229`); page-inset standard applies
(§3.1, measured at 1728). The `_REVIEW_SOON_DAYS` named constant is unrecorded in
§5 → §9-8. Writes are `[S]`-gated (profile PUT included, §10-1).

### 10-9. SN-class vocabulary check — terms grepped against GLOSSARY
Absent user-facing terms: Will, Will status, Executor, Beneficiary, Guardian,
Emergency contact, Readiness, and the status values. Present: Nominee
(`GLOSSARY.md:246`), Estate documents (`:232`). → §9-9 (author in `GLOSSARY.md`
FIRST, parity guard).

### 10-10. Frontend state — nothing built
`/estate` is a `NotBuilt` route; no page, no tests, no route-array entry. This is
a from-scratch Worklist assembly on the Insurance/Cash flow patterns.

---

**Sign-off to start build:** §9's ten items resolved owner one-pass · §3b deltas
approved · no §4 affordance (the roles multi-select, §9-6) requires an unresolved
amendment.

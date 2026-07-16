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
| **N/A ✅ (recorded)** | `GET /api/v1/estate` — **NO `*_display` money strings; NO base-currency affix** | **§9-3** (D-105) | **RECORDED 2026-07-16 (§11-N/A).** No money field anywhere (§10-4); readiness tiles are counts. The no-money-string render guard ships with the Phase 2 page tests. |
| **N/A ✅ (recorded)** | `GET /api/v1/estate` — **NO staleness / confidence annotation** | **§9-4** (A10) | **RECORDED 2026-07-16 (§11-N/A).** No market inputs; every field is a user record (§10-4). |
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
| **TrendStat / summary tiles** | The **readiness strip** — Documents present · Needs attention · Nominees & beneficiaries · Executors · Emergency contacts. **COUNTS-ONLY, NOT money → no currency affix** (§9-3). **Will status is NOT a strip tile — it LEADS the profile card** (§12es-1 ruling; the strip-placement below is superseded — see §12) | `.readiness` (**real**) | count-only tiles (no unit affix) |
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

- **Phase 0 — ✅ DONE 2026-07-16 (see §11 record).** Contract deltas (§3b, gated on §9): delete `GET /estate/meta`
  (§9-1), confirm no consumer, regen `API-CONTRACT.json` + `docs/openapi.json`
  same commit, flip the `API-CONTRACT.md:73` row to ✅, drift check green;
  `?entity_id`→400 (§9-2, fail-first) IF ruled; promote `_REVIEW_SOON_DAYS` to
  PRODUCT-SPEC §5 + a same-batch code test (§9-8) IF ruled. Resolve `relationship`
  (§9-5) at the schema boundary before the editor is specced.
- **Phase 0a — ✅ BUILT 2026-07-16, AWAITING OWNER GEOMETRY RATIFICATION.** GLOSSARY
  + `/refdata` confirm (§9-9) landed in Phase 0. The **kitchen-sink Estate specimen**
  (the geometry gate) is built: `frontend/src/routes/EstateMockup.tsx` + `Estate.css`,
  mounted in `KitchenSink.tsx` — view at `/kitchen-sink` → "Estate — LAYOUT SPECIMEN".
  Three frames (populated · all-empty · roles Switch multi-select). No new component
  (§9-6 ruled Switch rows; MultiSelect declined). **Phase 1 blocked until ratified.**
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

## 11. PHASE-0 RECORD (backend-first; delivered 2026-07-16)

*Every §9 ruling executed backend-first, one delta per commit, each fail-first and proven
RED on the real cause before the fix (RED→GREEN, or a mutation proof where the mechanism IS
the test). Contract regen rode the same commit as any shape change; `make api-contract-check`
green throughout. Tests live in `tests/integration/test_estate_phase0.py` (app/service level)
and `tests/integration/test_db_migrate.py` (the Amendment-E migration).*

| # | Delta | Files (impl) | Guard (RED→GREEN) | Contract |
|---|-------|--------------|-------------------|----------|
| **9-1** | Delete `GET /estate/meta`; `/refdata` is the single vocab source | `routes/estate.py` (endpoint + unused imports removed) | `test_estate_meta_endpoint_removed_by_shape` — discriminates by SHAPE (meta keys served → RED; gone → GREEN) | regen'd; `estate/meta` gone from `API-CONTRACT.json`/`openapi.json`; `API-CONTRACT.md:73` row ✅ |
| **9-5 + E** | Retire `relationship` (fold-then-drop) | migration `f2b7c1a9e304`; `models/__init__.py:560-` (col removed); `estate.py` `_contact_dict`/`_apply_contact`; `routes/estate.py` `ContactIn` | `test_served_contact_has_no_relationship_field` (served shape); `test_db_migrate::test_upgrade_from_prior_head_folds_relationship_into_notes_then_drops` (Asha: `notes\nRelationship: sister`; Ravi: folded line; Meera: untouched); `test_estate_relationship_column_absent_after_migrations` | regen'd (`ContactIn` shape); `relationship` gone from the contract |
| **9-2** | `?entity_id` → honest 400 on all 8 endpoints | `routes/estate.py` `reject_entity_id` dep (ordered before `require_auth`) | `test_entity_id_rejected_with_400_on_every_endpoint` — silent 200 → RED; 400 "household-scoped" (no decision IDs) → GREEN | regen'd (`entity_id` query param on 8 paths) |
| **9-7** | Equality test pinning the one doc-attention derivation | *(test-only, no refactor)* | `test_doc_attention_count_is_one_derivation` — mutation of `estate_signals` predicate → RED; revert → GREEN | none |
| **9-8** | `_REVIEW_SOON_DAYS = 30` → PRODUCT-SPEC §5 D-059 row + code test | `PRODUCT-SPEC.md §5` (new row) | `test_review_soon_days_threshold_is_30_per_spec` — surfaces at 30d, silent at 31d; drift const→31 → RED | none (constant) |
| **9-9** | GLOSSARY terms authored spec-first, popover mirrored | `GLOSSARY.md` (7 terms, status values ride parents) → `frontend/src/mocks/glossary.ts` | `test_glossary_parity.py` green (44); `test_help` advisory guard green. Marked **PROPOSED** — ratify at the walk | none |
| **9-10** | STANDING legal-advice-language content guard | *(test-only; disclaimer RATIFIED VERBATIM, not reworded)* | `test_no_advice_language_in_served_estate_copy` — scans the disclaimer + 400 msg + all 5 `estate_signals` templates; inserting an advice phrase into the disclaimer → RED; restore → GREEN | none |

### 11-N/A — chosen decisions recorded (not built), per the §9 rulings

- **9-3 — money / base-currency affix: N/A (CHOSEN).** There is no money field anywhere on this
  page (§10-4): readiness tiles are **counts**. No `*_display` strings, no base-currency affix. The
  **no-money-string render guard** (asserts no money-formatted string renders on the page) ships
  with the **Phase 2 page tests**, not Phase 0 — noted here so it is a decision, not an omission.
- **9-4 — staleness / confidence (A10): N/A (CHOSEN).** No market inputs; every field is a user
  record. No staleness/confidence annotation. The honesty burden here is empty-state reasons + the
  §9-10 advice guard, not freshness.
- **Typed `/estate` response — DEFERRED.** Logged in `08-TECH-DEBT.md` (page-estate §3b) alongside
  the Policy/Scenarios deferrals; Phase 0 only removed/retired surfaces, added no served field.

### 11-carry — honesty carry-overs binding the Phase-0a specimen

- **§12in-4 (carried over):** blank OPTIONAL fields that are **user-data-absent** render as **bare
  em dashes** (no "reason" pill — a reason is for an empty *region*, not an empty *cell*). Empty
  *registers* (no contacts / no documents / will `none`) each still show an **EmptyState with reason
  + CTA**. The specimen stages both.

---

**Sign-off to start build:** §9's ten items resolved owner one-pass (2026-07-16, all ACCEPTED +
Amendment E) · §3b deltas **delivered** (Phase 0 complete, evidence above) · no §4 affordance (the
roles multi-select, §9-6 → Switch rows) requires an unresolved amendment. **Phase 1 was BLOCKED
until the owner ratified the Phase-0a specimen geometry at `/kitchen-sink` — RATIFIED 2026-07-16, see §12.**

---

## 12. GATE — SPECIMEN GEOMETRY RATIFICATION — **RATIFIED (owner, 2026-07-16)**

*The §12 geometry gate (the Phase-0a kitchen-sink Estate specimen,
`frontend/src/routes/EstateMockup.tsx` + `Estate.css`, viewed at `/kitchen-sink` →
"Estate — LAYOUT SPECIMEN") was walked by the owner on **2026-07-16**. Status flips
**⏸ AWAITING RATIFICATION → RATIFIED**, with **two rulings** and **one Phase-1
condition**. Phase 1 is UNBLOCKED. Each item below carries its → RULING; nothing is
struck.*

### §12es-1 — the specimen DEVIATION is ACCEPTED as the ratified geometry → **RULING: ACCEPTED (owner, 2026-07-16)**

The specimen **deviates** from the §4 strip-placement: it puts **will status LEADING
the profile card** (its canonical home) and makes the **readiness strip COUNTS-ONLY**
(five count tiles: Documents present · Needs attention · Nominees & beneficiaries ·
Executors · Emergency contacts). The §4 row originally listed *"Will status"* as the
first strip tile.

- **The deviation is the RATIFIED geometry.** Will status LEADS the profile card; the
  readiness strip is **counts-only** with **no `will_status` tile**.
- **Rationale recorded (owner):** a status **chip** in a **counts** strip **mixes
  types** (the mixed-scope lesson — a strip of counts should not carry one non-count
  chip); and `will_status` has **one canonical rendering** (the profile card), so a
  strip tile would be a **second rendering of one fact**.
- **`readiness.will_status` is SERVED but not RENDERED as a tile.** The `GET /estate`
  reader still emits `readiness.will_status` (`estate.py:155`) — the page **does not
  render it in the strip**; the profile-card chip is the one rendering. Served ≠
  rendered here, by design.
- **§4 is SUPERSEDED to match** (updated 2026-07-16): the §4 TrendStat row now reads
  *"Documents present · Needs attention · Nominees & beneficiaries · Executors ·
  Emergency contacts — COUNTS-ONLY; will status is NOT a strip tile, it leads the
  profile card"*, noting this ruling.

### §12es-2 — page subtitle + both EmptyState wordings → **RULING: RATIFIED AS SHOWN (owner, 2026-07-16)**

Ratified **as-shipped** (render these verbatim in Phase 1; do not reword):

- **Page subtitle:** *"A readiness register — will, contacts and key documents. A
  record and reminders, never legal advice."*
- **Contacts EmptyState** — message *"No contacts yet"*; reason *"Add the people who
  matter to your estate — executors, beneficiaries, guardians and emergency contacts,
  with their roles."*; action **"Add contact"**.
- **Documents EmptyState** — message *"No documents yet"*; reason *"Record where your
  key documents live — will, deeds, policies, identity and more — and whether each is
  present, missing or outdated."*; action **"Add document"**.

(The served **disclaimer** bar is already RATIFIED VERBATIM under §9-10 — unchanged.)

### §12es-3 — Phase-1 CONDITION: LABEL TRUTH — the rendered label MUST be the SERVED `/refdata` label → **CONDITION (owner, 2026-07-16)**

The specimen renders `will_status: none` as **"Not recorded"**. The rendered label
**MUST be the label `/refdata` actually serves** — never frontend copy. **Verify what
`/refdata` serves for `none`; if it differs, amend the LABEL spec-first** (MASTER-DATA
vocab labels → then the refdata source) **so that "Not recorded" IS the served label.**

- **VERIFIED (2026-07-16):** `/refdata` served `will_status: none` → label **"None"**
  today (`_label("none")` titleizes the lowercase value, `refdata.py:48-57`) — this
  **DIFFERS** from the specimen's "Not recorded". → **the condition FIRES: amend
  spec-first.**
- **Fail-first:** a test asserting the SERVED `{value:"none"}` label **equals "Not
  recorded"** goes **RED** on the current backend (it serves "None"), then **GREEN**
  after the label amendment (MASTER-DATA vocab label + the refdata source override).
- **Same check across ALL FOUR estate vocabs** (`will_status`, `estate_doc_status`,
  `estate_doc_category`, `contact_role`): the page renders **served labels verbatim,
  everywhere** — no client-side casing/mapping. (Every other value already titleizes to
  the specimen's label; only `will_status:none` needed the override.)

### §12in-4 (carry-over, binds Phase 1) — bare em dashes for empty CELLS

Blank OPTIONAL fields that are **user-data-absent** render as **bare em dashes** (no
"reason" pill — a reason is for an empty *region*, not an empty *cell*). Empty
*registers* (no contacts / no documents / will `none`) each still show an **EmptyState
with reason + CTA** (§12es-2). Recorded under §11-carry; restated here as a Phase-1
binding.

---

## 13. BUILD RECORD — Phase 1 / 2 / 3a (delivered 2026-07-16)

*Phase 1 (assembly) → Phase 2 (tests) → Phase 3a (scripted pre-pass, GREEN) built on
the RATIFIED §12 geometry. Commits `aa092c6` (§12 rulings + §12es-3 label),
`8acffb4` (Phase 1+2), `185f2a1` (Phase 3a). **Phase 3b (owner walk) is NOT this
session — the page is AWAITING THE OWNER WALK, not self-certified.***

### 13-1. §12es-3 LABEL VERDICT — before / after (the gate condition)

| | Served `/refdata` `will_status:none` label | Source |
|--|--|--|
| **BEFORE** | **"None"** (RED) | `_label("none")` titleizes the lowercase value (`refdata.py`) |
| **AFTER** | **"Not recorded"** (GREEN) | per-vocab `_VOCAB_LABEL_OVERRIDES` (`refdata.py`) + MASTER-DATA §2 spec note; offline-fallback mirror in `frontend/src/mocks/refdata.ts` |

Amended **spec-first** (MASTER-DATA vocab label → refdata source), never frontend copy.
The wired page renders the SERVED label via `useLabelFor` — so `will_status:none` renders
"Not recorded" from the endpoint. The live pre-pass confirmed the SERVED label reaches the
DOM (PART 2: `'executed' → 'Executed'` leads the profile card; the render path is the same
for `none → Not recorded`). All four estate vocabs render served labels verbatim.

### 13-2. Evidence table (guard → RED→GREEN)

| Guard | File | RED→GREEN |
|-------|------|-----------|
| §12es-3 — served `will_status:none` label == "Not recorded" | `tests/integration/test_estate_phase0.py::test_will_status_none_served_label_is_not_recorded` | RED (served "None") → GREEN (override) |
| §12es-3 — all four estate vocabs served verbatim | `test_estate_phase0.py::test_all_four_estate_vocab_labels_are_served_verbatim` | RED (`none`→"None") → GREEN |
| Profile chip LEADS (served label + factual tone) | `frontend/src/routes/Estate.test.tsx` | GREEN |
| §12es-3 render — `none` → "Not recorded" in the DOM, never "None" | `Estate.test.tsx` (RefdataContext supplies served labels) | GREEN |
| Readiness = 5 count tiles, no will_status tile (§9-3/§12es-1) | `Estate.test.tsx` | GREEN |
| Served-label role chips; missing/outdated attention chips | `Estate.test.tsx` | GREEN |
| Served disclaimer verbatim, once (§9-10) | `Estate.test.tsx` | GREEN |
| Both EmptyStates (§12es-2); em-dash optional cell (§12in-4) | `Estate.test.tsx` | GREEN |
| §9-3 — no money-formatted string / no base-currency affix | `Estate.test.tsx` | **RED-proven** (polluted fixture `1,200.00` trips it) → GREEN |
| Page-level advice-language guard | `Estate.test.tsx` | **RED-proven** (polluted fixture `you should` trips it) → GREEN |
| STANDING served-copy advice guard (backend, Phase 0) | `test_estate_phase0.py::test_no_advice_language_in_served_estate_copy` | GREEN (mutation-proven in Phase 0) |
| Demo-seed ships a realistic estate register | `test_estate.py::test_demo_seed_ships_a_realistic_estate_register` | GREEN (seed unit-verified) |
| `/estate` in ALL THREE overflow route arrays + page-inset guard | `frontend/e2e/overflow.spec.ts` | GREEN (320/375/900/1366 × both themes; inset @1728; shared shell) |

### 13-3. Phase-1 assembly (file:line)

- `frontend/src/api/estate.ts` — `fetchEstate` (GET) + 7 `[S]`-gated writes (profile PUT;
  contacts & documents CRUD). No `*_display`/money fields (§9-3).
- `frontend/src/routes/Estate.tsx` + `Estate.css` — profile card (`data-card="profile"`,
  will-status chip leads via `useLabelFor("will_status", …)`) → readiness COUNTS strip
  (`data-card="readiness"`, 5 `TrendStat` tiles, no affix) → contacts `DataTable`
  (`data-card="contacts"`) → documents `DataTable` (`data-card="documents"`) → served
  `.est__disclaimer` once. One `Dialog` editor (profile/contact/document); roles as composed
  `Switch` rows (§9-6); `ConfirmDialog` delete (contacts/documents). Ambient PIN session
  (D-103), no second prompt.
- `frontend/src/AppRoutes.tsx` — `/estate` route wired; `frontend/src/components/ui/nav.ts`
  — `built: true`. GLOSSARY `[Help]` on **Will status** (`term-will-status`). *(The other
  estate terms are authored in `GLOSSARY.md` + `glossary.ts` (Phase 0, parity-guarded); the
  ratified `TrendStat`/`DataTable`/`MetaStrip`/`Switch` label APIs are string-only, so
  in-cell popovers are declined — consistent with the Cash flow / Insurance precedent of
  anchoring popovers only on custom-rendered labels, never inside table cells.)*
- `frontend/e2e/overflow.spec.ts` — `#/estate` added to the per-breakpoint `ROUTES`, the
  page-inset `ROUTES`, and `SHELL_ROUTES` (all three).

### 13-4. Phase-3a pre-pass results (`e2e/smoke/estate-smoke.spec.ts`, LIVE, GREEN)

Ran against the live app (`5173`) + real backend (`8321`) on a demo-seeded estate register
(executed will, next_review +20d, 7 contacts incl. one 3-role, 10 documents incl. 1 missing
+ 1 outdated). **11/11 parts GREEN, 0 console errors:**

- **will-status chip leads** with the SERVED "Executed" label (§12es-1).
- **readiness = 5 count tiles; no money-formatted string, no `.lf-stat__unit` affix** (§9-3).
- **missing/outdated documents render attention chips**; served disclaimer verbatim once (§9-10).
- **blank phone → bare em dash** (§12in-4).
- **review-soon signal fires:** `"Estate review due in 20 days"` on the seeded next_review (§9-8).
- **full CRUD round-trip** through the `[S]`-gated editors: profile edit; contact add→edit→delete
  with **multi-role Switch selection** (Executor + Guardian); document add→delete.
- **containment** (count values + status/role chips) at 320/375/420/500/900/1100/1366; long
  Name/Email cells ellipsize by design (truncate columns) with the table scrolling inside its card.
- **geometry:** both themes × 320/375/900/1366 — 0 horizontal overflow (document + content),
  **single vertical scroll region** (`window.scrollY` stays 0).
- **`review-smoke` re-run GREEN** (11 attention rows incl. the estate signals — the shared
  `estate_signals()` seam holds).
- **`npm run check` EXIT 0** (227 vitest + 228 Playwright, incl. `/estate` overflow + page-inset
  + shared-shell). Full backend suite **795 passed**. `ruff`/token-drift/`tsc`/`eslint` clean.

### 13-5. STATUS — Phase 3a GREEN → OWNER WALK DONE (Phase 3b ACCEPTED 2026-07-16, see §14)

> **Superseded by §14:** the owner walk ran 2026-07-16 — ONE finding (§14es-1, fixed), everything
> else accepted, milestone CLOSED. The record below is the pre-walk entry-ticket state, kept as-is.

The pre-pass is the **entry ticket**, not acceptance. Judgment items reserved for the owner walk
(Phase 3b): the §9-9 GLOSSARY terms marked **PROPOSED** (ratify at the walk); the copy feel of the
ratified subtitle/EmptyStates (§12es-2, already ratified-as-shown but re-confirmed live); the
overall geometry/feel of the wired page vs the specimen. **Not self-certified.**

**URL + dataset for the walk:** `http://127.0.0.1:5173/#/estate` on the demo-seeded instance
(executed will, review due in ~20 days, 7 contacts incl. one 3-role + blank phone/email, 10
documents incl. one MISSING + one OUTDATED). *(Note: the pre-pass edited the seeded profile
executor to "Priya R-V (edited)" during its CRUD leg; re-seed via `seed_estate` or
`reset-demo-data.sh` for a pristine walk.)*

---

## 14. OWNER WALK (Phase 3b) — **ACCEPTED 2026-07-16 · ONE FINDING · MILESTONE CLOSED**

*The owner drove the real rendered `/estate` (2026-07-16, live app + real backend, demo-seeded
register). **ONE finding (§14es-1); everything else accepted** — the §12es-1 geometry (will status
LEADS the profile card, counts-only readiness strip), the §12es-2 subtitle + EmptyState copy (re-
confirmed live), the served-label chips, the disclaimer bar, and the §9-9 GLOSSARY terms. The
acceptance was **contingent on the §14es-1 fix**; this batch delivered it. **§14 → CLOSED.***

### §14es-1 — the profile-card Edit button broke button anatomy (bug, theme uniformity) → **FIXED + ACCEPTED (contingent, owner 2026-07-16)**

**Finding.** The Estate profile card's **"Edit"** button was **text-only**, while every other action
button on the platform carries a lucide **icon + text**: Estate's own *Add contact* / *Add document*
(`Plus`, `Estate.tsx:281/309`), Policy's *Set/Edit policy* (`Pencil`, `Policy.tsx:218/261`), Cash
flow's *Add …* (`Plus`). A lone text-only action button on one card is a **uniformity defect**.

**Fixed platform-standard-first (the §14in-6 lesson — a standard beats a page fix):**

1. **Precedent verified.** Policy composes `<Button variant="primary" icon={Pencil} …>` — the ratified
   `Button` icon+label treatment (`Button.tsx:35-49`): the component emits `{Icon && <Icon
   aria-hidden="true" focusable="false" />}` **before** the text child, so the **icon is decorative**
   and the **text child is the accessible name** (`children` is the MANDATORY label, `Button.tsx:9`).
2. **DESIGN-SYSTEM button-anatomy line added + RATIFIED** (the owner named the standard by asking for
   it). New line under the §5.4 `Button` amendment (`DESIGN-SYSTEM.md`): *a primary/header action
   `Button` carries a lucide icon + text label — `Plus` for add, `Pencil` for edit — icon decorative
   (`aria-hidden`), the text child is the accessible name*; scoped to the labelled `Button` (the
   icon-only `.lf-iconbtn` page-header pattern is a distinct surface, explicitly unaffected).
   **RATIFIED 2026-07-16, page-estate §14es-1 walk.**
3. **Estate Edit → `Pencil` + "Edit"** (`Estate.tsx:238`, `import { Pencil, Plus } from "../icons"`),
   composed **identically** to the Policy precedent. **Platform sweep for other text-only header
   action buttons on ACCEPTED pages:** clean — CashFlow (`Add …`), Policy (`Set/Edit policy`), and
   Estate's own `Add contact`/`Add document` **all already carry their icon**. The one residual
   text-only add is Insurance's **inline dialog list-composer** ("Add" beside a TextInput inside the
   policy-documents checklist, `Insurance.tsx:428`) — a **form-internal add-to-list control, NOT a
   header/primary action**, so it falls **outside** the ratified anatomy scope. **Listed as a
   borderline retrofit candidate for the owner's future call; NOT changed in this batch** (accepted
   page).
4. **Guard (fail-first, RED→GREEN).** `Estate.test.tsx::"§14es-1 — the profile Edit button carries a
   lucide icon AND its accessible name is 'Edit'"` — asserts the Edit button **contains an `<svg>`**
   AND its **accessible name is exactly "Edit"**. **RED** on today's text-only button (`svg` = null);
   **GREEN** after the fix. Estate render suite **11/11 GREEN**; **`npm run check` EXIT 0** (run from
   `frontend/`: lint + typecheck + token-drift + 227 vitest + 228 Playwright overflow/inset/shell).
5. **Screenshot (the re-walk substitute for a one-button fix — owner pre-accepted contingent on it):**
   profile card, **light + dark**, at `frontend/e2e/smoke/artifacts/estate-profile-edit-{light,dark}.png`
   — the `Pencil` glyph rides beside "Edit" top-right of the card in both themes; live probe confirmed
   `svg` present, accessible text exactly "Edit".

### §14 close-out — PROPOSED → RATIFIED sweep + acceptance

- **§9-9 GLOSSARY terms → RATIFIED** (owner walk 2026-07-16): Will · Will status · Executor ·
  Beneficiary · Guardian · Emergency contact · Readiness (status values ride their parent). The
  PROPOSED marker in `GLOSSARY.md` (Estate-terms block) is flipped to **RATIFIED**; parity suite
  (`test_glossary_parity.py`) green after the edit.
- **§12es-2 copy** (subtitle + both EmptyStates) — **ratified-as-shipped** at the walk (already
  ratified-as-shown at §12; re-confirmed live, rendered verbatim, unchanged).
- **`will_status:none` → "Not recorded"** served-label note (`MASTER-DATA.md §2`) — already **ratified**
  at the §12es-3 specimen walk; the wired-page walk **confirmed it shipped** (the served `/refdata`
  label reaches the DOM; all four estate vocabs render served labels verbatim).
- **Central close row** logged in `RATIFICATION.md §6` (the Insurance-onward convention).
- **No ⏸ remains** in this plan (the sole `⏸` occurrence is the §12 *historical* "⏸ → RATIFIED"
  transition note, not an open gate).

**Acceptance:** **Owner, 2026-07-16 (live walk).** One finding (§14es-1), fixed + evidenced above;
everything else accepted. **§14 CLOSED. page-estate milestone CLOSED.**

### §15 — post-close platform polish delta (platform batch P-2, 2026-07-16)

**Estate is CLOSED; this is a delta note on a touched accepted surface, recorded per the platform-batch
convention (Insurance §14in-6/§14in-7 precedent).**

- **P-2 — profile Edit button → `variant="primary"` (owner walk 2026-07-16).** The profile-card **Edit**
  was the **default (grey)** `Button` variant while every other header action — its own **Add contact** /
  **Add document**, and Policy's **Set/Edit policy** — is the **primary (accent)** variant. Fixed to
  `variant="primary"` (`Estate.tsx`, the `.est__edit` button). **Guard:** `Estate.test.tsx` gains
  *"P-2 — the profile Edit button carries the primary (accent) variant"* asserting `.lf-btn--primary` on
  the Edit button — **RED before, GREEN after** (proven). Screenshots (light + dark) in
  `e2e/smoke/artifacts/polish-estate-header-*.png`. `estate-smoke` re-run GREEN (0 console errors).
- **P-1 also lands here centrally** (no page code): the labelled `Button`'s icon now renders at the
  button's font-size (DESIGN-SYSTEM §5.4), so the Estate Edit pencil is no longer oversized — a single
  `.lf-btn svg` change, inherited (see CURRENT.md platform-polish batch + `page-chrome.md §13` for P-3).

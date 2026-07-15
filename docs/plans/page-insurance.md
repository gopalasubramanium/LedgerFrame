# page-insurance — build plan

**Status: 🟢 §9 CLOSED (2026-07-15) · Phase 0 done · Phase 0a specimen shipped · §12 geometry gate RATIFIED
WITH CONDITIONS (owner, 2026-07-16; §12in-1..5) · Phases 1–3a done · Phase 3b WALK BATCH 1 fixed + pre-pass
re-GREEN (§14in-1..5), AWAITING OWNER RE-WALK.** See §11 (Phase 0), §12 (gate rulings), §13 (Phases 1–3a
build record), §14 (walk batch 1). Phase 3b is the gate — nothing self-certified; the owner re-walks.

Drafted 2026-07-15 from `TEMPLATE-page-build.md`. The **verify-first pass (D-019) is done** — §10 records
what the insurance engine **actually serves and actually guards**, with `file:line` cites. Every ambiguity is
in **§9**; the owner resolves them **one-pass**.

Insurance is a **Planning**-group page (IA §2/§3): the **protection register** — policies, cover-by-type,
upcoming renewals, per-policy document checklists (IA §5, D-039/D-062). It is a **Worklist** page
(DESIGN-SYSTEM §3 names Insurance in the Worklist row) — a summary header + a records table + a per-row CRUD
editor, built on the **Cash flow CRUD patterns**. Its protected copy bar is the D-055-class bar for this page:

> **"A register, never an adequacy judgment."** No cover-adequacy verdict, no *"you are under-insured"*, no
> recommendation. It records and reminds; it **never rates whether cover is adequate** and never suggests
> buying or switching. The engine already serves an adequacy-negating disclaimer (`insurance.py:156-157`) and
> **computes no adequacy figure** — the bar is honest by construction (§9-2 rules the exact wording + a
> standing content guard, the D-058 precedent).

**Headline of the verify-first pass — the reader is FROZEN, read-only-for-reads + [A]-gated writes, and mostly
honest; the deltas are guard/vocab/D-105 shape, not a missing engine:**

1. ✅ **The register exists and the CRUD engine is complete.** `GET /api/v1/insurance` (`insurance_report`,
   `services/insurance.py:120`) serves `{base_currency, policies[], count, total_cover, total_cash_value,
   total_annual_premium, cover_by_type[], upcoming_renewals[], disclaimer}`; `POST/PATCH/DELETE
   /api/v1/insurance[/{id}]` are **`require_auth`-gated** (`routes/insurance.py:53,60,70`) with `PolicyIn`
   (§10-1). **The no-FK isolation is intact** — `linked_goal_id` is a plain `Integer`, no `ForeignKey`, and
   there is **no `entity_id` column** (§10-2, D-063 protected).
2. ⚠ **`/insurance/meta` was never removed** — the D-005 migration to `/refdata` **half-happened**: `/refdata`
   serves `policy_type`/`premium_frequency` as `{value,label}` (`refdata.py:144-149`), but the legacy
   `GET /insurance/meta` still ships (`routes/insurance.py:48`) as bare lists. The API-CONTRACT delta table
   already carries the `remove` row, gated *"once `/refdata` lands"* — which it has (§10-4). → **§9-3**.
3. ⚠ **Money is raw floats** — `cover_amount`/`cash_value`/`premium` and every total / `cover_by_type` value
   are `float(...)` (`insurance.py:60-62,150-153`). The **D-105 scope amendment** (money = served display
   strings everywhere) binds this page, exactly as it bound Scenarios §9-3 (§10-5). → **§9-4**.
4. ⚠ **Insurer is free text; the Institution master does not exist yet.** `insurer` is `String(120)`
   (`models:525`), and **no institution table or endpoint exists anywhere** (§10-6) — `accounts.institution`
   is also free-text `String(120)`. IA §5 (line 427) and MASTER-DATA D-008 say insurer comes *from the
   master*, but that master is **unbuilt** — a genuine owner scope call, not a shape fix. → **§9-5**.
5. ⚠ **`?entity_id` is silently ignored** — `list_insurance` takes no such param (`routes:44`); FastAPI drops
   it with a 200. Policy and Scenarios both **reject with an honest 400** (household-only). The register has
   **no entity FK by design** (D-063), so it *cannot* scope — the Policy §9-21 class (§10-7). → **§9-6**.
6. ⚠ **Renewal is derived TWICE — the A11 class.** The page computes `upcoming_renewals` inline at
   `_RENEWAL_SOON_DAYS = 60` (`insurance.py:27,142`); Review calls a **separate** `renewal_reminders(session,
   30)` in the same module (`insurance.py:161`, from `review.py:144` with `_INSURANCE_SOON_DAYS = 30`). Two
   code paths for *"renewal due soon"*, different windows and different overdue handling (§10-8). → **§9-7**.
7. ✅ **The D-081 exclusion is consistent by construction — ONE reader.** Net worth's *"Insurance cash value
   (excluded)"* valued line reads **`GET /insurance`** and uses `total_cash_value` + `count` (`net-worth.ts:64-87`)
   — the **same figure Insurance owns** (`insurance.py:151`). Insurance states + links; it must **not**
   re-derive (§10-9). *(One caveat rides on §9-4 and §9-10 — see there.)*

---

## 1. IDENTITY

*Source: INFORMATION-ARCHITECTURE.md §2 (page map), §3 (navigation); DESIGN-SYSTEM.md §3 (templates).*

| Field | Value | Spec ref |
|-------|-------|----------|
| Page name (H1 = nav label = route) | **Insurance** | IA §2, D-022 |
| Route | **`/insurance`** | IA §2 (`nav.ts:49` — **no `built: true`**, renders `NotBuilt` today) |
| Nav group | **Planning** (Review · Policy · Cash flow · Scenarios · **Insurance** · Estate) | IA §3 |
| Page template | **Worklist** — DESIGN-SYSTEM §3 names Insurance in the Worklist row explicitly (primary DataTable + row actions + CRUD editor). **Copied, not presumed.** | DESIGN-SYSTEM §3 |
| Rotation eligibility | **Eligible** (*"any nav page"*, D-044); an **empty register → EmptyState → skipped by construction** (§9-1 copy). | IA §3 (D-044) |
| One-line purpose | **The protection register — policies, cover, renewals and per-policy documents; a register, never an adequacy judgment.** | IA §2, D-062 |

---

## 2. OWNERSHIP TABLE

*Copied from INFORMATION-ARCHITECTURE.md §5 (Insurance, line 325; D-039/D-062).*

**Owns (canonical, authoritative, fully explained here):** — IA §5, D-062

- **The protection register** — the policy records (name, insurer, type, number, insured person, nominee,
  cover, cash value, premium + frequency, start/renewal dates, status, notes) (§10-1).
- **Cover-by-type** — cover totals grouped by `policy_type` (`cover_by_type`, `insurance.py:153`).
- **Upcoming renewals** — active policies whose renewal falls within the page horizon (`upcoming_renewals`,
  `insurance.py:142`) — ⚠ but see §9-7 (one canonical renewal derivation with Review).
- **The per-policy documents checklist** — *"do I hold this policy's papers?"* (`documents` JSON `[{label,have}]`,
  `models:538`). **Distinct from Estate documents** — the D-062 two-concepts split (GLOSSARY:225-231).
- **The base-currency totals** — `total_cover`, `total_cash_value`, `total_annual_premium` (current-FX,
  caveated) (`insurance.py:150-152`).
- **The protected D-055-class disclaimer** — *"Records and reminders only … not an assessment of whether your
  cover is adequate, and not advice."* (`insurance.py:156-157`).

**Summarises (other pages' info — via the named reader, linked, never recomputed):**

| Summary shown | Canonical page | Shared reader reused | Link target |
|---------------|----------------|----------------------|-------------|
| *(none — Insurance is a terminal owner; it does not summarise another page's figure on-page)* | — | — | — |

**Reciprocal note (who summarises Insurance):** **Net worth** summarises Insurance's `total_cash_value` as the
D-081 *"Insurance cash value (excluded)"* valued line, via **`GET /insurance`** (`net-worth.ts:87`) — Net worth
**owns that exclusion line**, Insurance **owns the figure**. Insurance states the exclusion on-page and **links
to Net worth**, never re-rendering the excluded-line treatment (IA §5 line 199-200; §10-9).

**Links to:** **Net worth** (the cash-value exclusion line) · possibly **Planning/Cash flow** (if
`linked_goal_id` is surfaced — §9-9). Per D-038, a figure links to the canonical page where its base lives.

**Enforcement corollary (P-1/D-031):** the cash-value figure Insurance shows and the figure Net worth excludes
are the **same served `total_cash_value`** — one reader, no second derivation (§10-9). The register **does not
FK** into portfolio tables and holds no market inputs (§10-2).

---

## 3. API SURFACE

*Source: API-CONTRACT.json (frozen) + API-CONTRACT.md delta table.*

### 3a. Endpoints consumed (already in the frozen contract)

| Method + path | Purpose on this page | Response shape pinned? |
|---------------|----------------------|------------------------|
| `GET /api/v1/insurance` | **The whole page** — totals, cover-by-type, upcoming renewals, policies[] | **In the contract; untyped** (bare `dict`). Full shape in §10-1. |
| `POST /api/v1/insurance` **[A]** | Create a policy (`PolicyIn`) | in the contract; `require_auth` (`routes:53`) |
| `PATCH /api/v1/insurance/{id}` **[A]** | Edit a policy (`PolicyIn`) | in the contract; `require_auth` (`routes:60`) |
| `DELETE /api/v1/insurance/{id}` **[A]** | Delete a policy | in the contract; `require_auth` (`routes:70`) |
| `GET /api/v1/refdata` | `policy_type` + `premium_frequency` as `{value,label}` for the editor MasterSelects | in the contract (`refdata.py:144-149`) |

**Write path exists and is [A]-gated.** This is a **CRUD page** — the editor is `[S]`-gated at the UI (ambient
PIN session, D-103), mapping to the `require_auth` backend gate.

### 3b. Contract deltas (needed but not in the baseline — BUILD BACKEND-FIRST)

> **⚠ Verify-first divergence flag.** The reader **exists**; §3b is a **guard / vocab / D-105 / A11** list —
> what the reader *guards and serves as shape*, not a *"no reader"* list. **Every row is PROPOSED and GATED on
> its §9 item. None is approved.**

| kind | Endpoint (current → intended) | Decision | Why this page needs it |
|------|-------------------------------|----------|------------------------|
| **remove** | `GET /insurance/meta` → **deleted** (vocab lives on `/refdata`) | **§9-3** (D-005) | The delta table already carries this `remove` row (API-CONTRACT.md:72), gated *"once `/refdata` lands"* — it has. Two sources for one vocab is the drift trap. |
| **reshape** | `GET /insurance` — **serve `*_display` money strings** (`cover_amount`, `cash_value`, `premium`, `total_cover`, `total_cash_value`, `total_annual_premium`, each `cover_by_type` value) | **§9-4** (D-105) | Every money figure is a raw float (`insurance.py:60-62,150-153`). Backend formats; frontend renders verbatim. The Scenarios §9-3 precedent. **Cross-page:** Net worth's D-081 line consumes `total_cash_value` (raw) — the reshape adds `total_cash_value_display` and Net worth migrates to it in the same change (app-wide label rule). |
| **behaviour** | `GET /insurance` — **`?entity_id` REJECTED (400)** | **§9-6** | Silently ignored today; the register is household-only by construction (no entity FK, D-063). Reject like Policy/Scenarios. Fail-first (accepted today = RED). |
| **behaviour** | `GET /insurance` / `review.py` — **ONE canonical renewal derivation** | **§9-7** (A11) | The page (`upcoming_renewals`, 60d inline) and Review (`renewal_reminders`, 30d) are two code paths for *"renewal due soon"*. Unify on `renewal_reminders(within_days)`; the window is a parameter. Pinned by a test. |
| **reshape / behaviour** | `GET /insurance` — **`cover_by_type.type` served display-labelled** (or the frontend maps via `/refdata` labels) | **§9-12** | `type` is served as the raw enum (`insurance.py:153`), e.g. `term_life`. Display-case at the backend boundary (the §12rv1-5 pattern) or map on the client — a served-string call. |
| **behaviour / vocab** | `GET /refdata` + `PolicyIn.status` — **`policy_status` fixed vocab** + validated | **§9-10** | `status` is unvalidated free text defaulting `active` (`insurance.py:90-93` validates only type/frequency). MASTER-DATA has no entry. Totals count active only; the excluded-line `count` includes inactive — a scope mismatch. |
| **reshape** | `GET /insurance` — **served default documents checklist labels** (if §9-8 rules a suggested set) | **§9-8** | No server-side default label set exists; `documents` is whatever the client writes. A suggested checklist is backend-served (D-005), never frontend-hardcoded. |
| **doc-only** | **API-CONTRACT.md** — flip the `/insurance/meta` `remove` row to ✅ delivered; add the reshape/behaviour rows | **§9-3/§9-11** | Same-commit contract regen (freeze rule). |

**Note (typed response).** `/insurance` returns a bare `dict`. **Typing is DEFERRED** — a `response_model`
silently strips undeclared keys, and this batch *adds* served fields (Scenarios / Policy §9-10 precedent).
Record in `08-TECH-DEBT.md`; do not bundle.

---

## 4. COMPONENTS

*Worklist template — summary header + records table + CRUD editor. Only ratified components (DESIGN-SYSTEM §5).*

| Ratified component | Role on this page | Data source | Prop/state not exercised at kitchen-sink |
|--------------------|-------------------|-------------|------------------------------------------|
| **PageHeader** | H1 "Insurance" + subtitle carrying the protected **"a register, never an adequacy judgment"** bar (§9-2) | — | subtitle carrying protected copy |
| **TrendStat** (or summary tiles) | The **totals strip** — Total cover · Cash value (excluded) · Annual premium · policy count | `.total_*` (**real**) | — |
| **DataTable** | The **policies table** — name · insurer · type (chip) · cover · premium · renewal · status. **Bounded (tens of rows), client-side** sort/filter (D-094). | `.policies[]` (**real**) | `footer?` (no reconciling total — totals live in the header strip) |
| **DataTable** *(or labelled list)* | **Cover-by-type** breakdown | `.cover_by_type` (**real**) | — |
| **StatusChip** | Policy **status** (active/lapsed/…) and the **renewal-soon** flag (*"Renews in N days"* / *"Overdue"*) — semantic tone only (§9-10) | served `status` / `days` | — |
| **RowMenu (⋯)** | Per-row **Details · Edit · Delete** — never a wide action column (D-094 / Holdings §9-22) | — | — |
| **Dialog** + **MasterSelect** + **Money/Date/TextInput** + **Switch** | The **CRUD editor** (create/edit), `[S]`-gated (D-103). MasterSelect for `policy_type`/`premium_frequency`/`status`; Money for cover/cash/premium; Date for start/renewal; TextInput for name/insurer/number/insured/nominee/notes; **Switch rows for the documents checklist** (§9-8) | `/refdata` + `PolicyIn` (**real**) | the documents-checklist composition (§9-8) |
| **ConfirmDialog (+ PIN)** | Delete confirmation; `[S]` gate on the write entry points (D-103) | — | — |
| **EmptyState** | The **empty register** (no policies) — reason + a route to add the first policy (§9-1) | `count == 0` | the reason + CTA |
| **Skeleton** | Per-card progressive loading (single reader drives the page) | — | — |
| **GlossaryTerm** | `[Help]` — **Cover**, **Premium**, **Nominee**, **Insured person**, **Renewal** are **MISSING** from GLOSSARY (§9-11); *Policy documents (checklist)* and *Insurance cash value* exist | GLOSSARY | — |

**Affordances the ratified inventory lacks:** **the per-policy documents checklist** — a list of `{label, have}`
rows with a toggle and an add-label affordance. **PROPOSE composing from ratified `Switch` + `TextInput` rows
inside the editor Dialog** (no new component). If the owner wants a distinct reusable `Checklist` primitive,
that is a **§5 amendment → §9-8**. **No chart is proposed** (cover-by-type is a `DataTable`/tiles; a bar/donut
would be a §5 amendment, not an assumption — and a donut over cover-by-type asserts composition, which is
honest here *only if* types are mutually-exclusive parts of total cover — defer any chart to a walk idea).

**Component usage rules the build must honour:** cards LAYERED (D-100); scroll = content only (D-101); the
shared `.lf-page` shell + centralised in-page link treatment (the cross-page guards); row actions in `RowMenu`;
money = served display strings rendered verbatim (§9-4); popovers portal to the viewport (DESIGN-SYSTEM §6);
`MasterSelect` for every categorical (no inline option lists).

**Tables — dataset-size posture (D-094):** the policies table is **bounded** (a household holds tens of
policies) → **client-side** sort/filter; revisit threshold **~500 policies** (never realistic). Cover-by-type
is bounded at **≤10 rows** (the type vocab).

---

## 4b. PER-VARIANT FIELD & ACTION SPECS

**Partially applicable — the entity (a policy) has a `policy_type` variant, but the field set is UNIFORM across
types today** (`PolicyIn` is one flat schema; `_FIELDS`/`_DEC_FIELDS`, `insurance.py:70-73`). The engine does
**not** branch required/optional fields by type. So:

- **Entry is in the user's vocabulary (D-089):** the editor opens with a **Policy type** MasterSelect in
  plain labels (served `{value,label}` from `/refdata`), not raw enums.
- **Fields per variant (D-091):** **NOT branched today.** Whether some types should prompt type-specific
  fields (e.g. *motor* → vehicle; *property* → address; *health* → sum-insured basis) is **out of scope for
  this milestone unless the owner rules otherwise** — recorded as a possible future D-091-style enrichment,
  **not built** (§9 does not open it; noted here so the absence is a decision). REQUIRED (engine-enforced):
  `name`, `currency`, `premium_frequency`, `status` (`insurance.py:76`). All else OPTIONAL.

| Variant | Actions/types offered | REQUIRED fields | OPTIONAL-PROMPTED fields | Served by |
|---------|-----------------------|-----------------|--------------------------|-----------|
| *(all policy types)* | Create · Edit · Delete (uniform) | name · currency · premium_frequency · status | insurer · policy_number · insured_person · cover_amount · cash_value · premium · start/renewal dates · nominee · documents · notes | `/refdata` + `PolicyIn` |

---

## 5. VOCABULARIES

*Source: MASTER-DATA.md. Every categorical → `MasterSelect` over a `/refdata` vocab; user-record pickers use `Select`.*

| Field on this page | Vocabulary / master | Fixed (/refdata) or extensible | MASTER-DATA ref |
|--------------------|---------------------|-------------------------------|-----------------|
| `policy_type` | `policy_type` (10) | Fixed (/refdata, `{value,label}`) | DEF-4 (MASTER-DATA:72) |
| `premium_frequency` | `premium_frequency` (4) | Fixed (/refdata, `{value,label}`) | DEF-4 (MASTER-DATA:73) |
| `status` | **`policy_status`** = `active / lapsed / expired` — ✅ **RULED (§9-10)**, added to MASTER-DATA §2 + `/refdata` | Fixed (/refdata, `{value,label}`) | MASTER-DATA §2 (Phase 0) |
| `currency` | `currency` (`SUPPORTED_CURRENCIES`, 9) | Fixed (/refdata) | MASTER-DATA §3 |
| `insurer` | **Free text with a client-side typeahead** over served `policies[]` — ✅ **RULED (§9-5, Amendment B)** | *(the Institution master is DEFERRED — see seam below)* | MASTER-DATA:284 |

**User data, not a master (use `Select`/`TextInput`, not `MasterSelect`):** `insured_person`, `nominee` are
**free text by design** (names, not vocabulary — IA §5). `insurer` is free text this milestone; its typeahead
suggestions are derived **client-side** from the already-served `policies[]` (Amendment B — UI convenience over
served data, not a vocabulary and not money math).

**Named seam — Institution master (D-008), DEFERRED to the Accounts milestone (§9-5, Amendment B).** `insurer`
and `accounts.institution` will both re-point to the Institution master when Accounts (which co-owns
`institution`) builds it. No `/insurance/insurers` endpoint is added now. Until then insurer stays free text.

**Named seam — `linked_goal_id` (§9-9, Amendment D).** The column stays (soft link, no FK — D-063) but is
**omitted from the editor** this milestone. It surfaces **once goals have a home to link to** — a one-line
seam, **not a ROADMAP item** (a consequence of an unmade product decision, the currency-master precedent).

**Documents checklist seed content (§9-8, Amendment D) — NOT a vocabulary.** A new policy's checklist is
seeded with four **user-editable default labels** (*Policy schedule · Premium receipts · Nominee form · Terms &
conditions*), served from the backend as **seed content** (record data), never a `/refdata` vocab and never a
GLOSSARY term — the parity guard must not police them.

---

## 6. DECISIONS IN FORCE

| Decision | What it forbids / requires on this page |
|----------|------------------------------------------|
| **D-062** *(two-concepts split)* | Insurance owns **policies + the per-policy documents checklist**; Estate owns estate documents. The two document concepts **never merge** (GLOSSARY:225). insurer/policy_type **from masters** (IA line 427) — ⚠ §9-5. |
| **D-039 / D-081** *(cash-value exclusion)* | Cash value is **excluded from the headline Net worth total**; Net worth shows the labelled *valued* exclusion line, Insurance **states + links** to it — the **same served `total_cash_value`**, never a second derivation (§10-9). Opt-in inclusion stays parked (R-9). |
| **D-063** *(no-FK isolation — PROTECTED)* | The register **does not FK** into portfolio tables; `linked_goal_id` is a **soft link, no FK**. The plan must **not** propose normalising it (§10-2). |
| **D-055-class bar** | **"A register, never an adequacy judgment."** No adequacy verdict, no under-insured claim, no recommendation. Protected copy; a standing content guard (§9-2, D-058 precedent). |
| **D-105** *(money = served display strings)* | Every money figure is **formatted in the backend, rendered verbatim**. Raw floats today → §9-4. |
| **D-005** | Served labels (policy_type/frequency/status, `cover_by_type.type`) render **verbatim** from `/refdata` / a display-cased boundary; **no** client enum→label map, **no** raw enum in the UI (§9-12). |
| **D-008** | `insurer` (and `accounts.institution`) resolve to the **Institution master** — but the master is **unbuilt** (§9-5). |
| **D-103** *(ambient PIN)* | Write entry points are `[S]`-gated via the ambient PIN session; purge/destructive actions take a **fresh PIN** (never bound to unlock). |
| **Guarantee 3 (honesty)** | Empty register → reason + CTA; a missing figure → **"—"**, never a fabricated number; totals use **current FX**, caveated (already in the disclaimer, `insurance.py:157`). |
| **Guarantee 1** | The platform **never advises**. A renewal reminder is a **neutral fact**, never *"you should renew / buy more cover"*. |
| **D-094** | The policies table is **bounded → client-side** sort/filter. |
| **D-098 / D-100 / D-101** | Canonical-home links (Net worth); layered cards; scroll = content only. |
| **TEMPLATE §7/§13** | Assertions with teeth · pixels are facts · component guards on the specimen **except media-query-responsive ones** (§13c pre-pass at real viewports) · CI has no backend. |

---

## 7. ACCEPTANCE CRITERIA

- [ ] **Happy path:** the totals strip, the policies DataTable (name · insurer · type · cover · premium ·
      renewal · status), cover-by-type, and upcoming renewals render from the served payload.
- [ ] **CRUD live:** create / edit / delete a policy through the `[S]`-gated Dialog editor (MasterSelect for
      every categorical, Money/Date/TextInput for the rest); the table + totals refresh from the reader.
- [ ] **D-055 bar — NO adequacy / advice language (protected).** Grep the rendered copy for `under-insured`,
      `adequate`/`adequacy` (outside the disclaimer's own negation), `you should`, `recommend`, `sufficient
      cover` — **zero** outside the protected disclaimer. A **standing** guard (§9-2, the D-058 precedent).
- [ ] **One reader for the D-081 figure (P-1), DEMONSTRATED live:** Insurance's shown cash-value total ==
      Net worth's *"Insurance cash value (excluded)"* line (both `GET /insurance.total_cash_value`).
- [ ] **One renewal derivation (A11), DEMONSTRATED:** the page's upcoming-renewals and Review's insurance
      signal come from **one** `renewal_reminders` helper (differing only by window param) — a test proves it
      (§9-7).
- [ ] **No frontend money math / D-105:** every money figure is a **served display string**; percentages (if
      any) format client-side.
- [ ] **Honest states (Guarantee 3):** empty register → reason + add CTA; a policy with no cover/cash/premium
      shows **"—"**, never `0` presented as a fact; stale FX caveat present on the totals.
- [ ] **`status` & `?entity_id`:** non-active policies are handled per §9-10 (counted consistently); `?entity_id`
      is rejected with an honest 400 (§9-6).
- [ ] **Terms match GLOSSARY** — including the additions under §9-11 (**spec first**, then the popover store;
      parity guard).
- [ ] **Categoricals from /refdata:** `policy_type`/`premium_frequency`/`status` via `MasterSelect`; **no**
      raw enum shown (`cover_by_type.type` display-labelled, §9-12); `/insurance/meta` gone (§9-3).
- [ ] **Copy hygiene:** no decision ID or implementation note (`policy_type`, `linked_goal_id`, `cover_amount`)
      in any user-facing string.
- [ ] **Both densities · both themes · keyboard · WCAG AA**; interactive OPEN states (MasterSelect/Date popups,
      Dialog) verified in both themes.
- [ ] **Rendered layout verification (ADR-0004):** `/insurance` added to the **overflow + single-scroll** suite
      **and** the shared-shell + themed-link cross-page guards (320/375/900/1366 × both themes).
- [ ] **Geometry gate (§9-1):** the Worklist grid map (summary strip + table + editor) ratified from a specimen
      **inside the real shell with real-shaped data** BEFORE assembly — pixels sampled, not computed. *(Note the
      media-query exception: any responsive strip's containment guard runs in the §13c pre-pass at real
      viewports, not on the static specimen.)*
- [ ] **Assertions with teeth (§13):** every owner-visible defect's guard is written against the **rendered**
      artefact, seen **RED** on that state, with the fixture that reproduces it.

---

## 8. BUILD PHASES

- **Phase 0 — Contract deltas (§3b), backend-first, contract regenerated in the SAME commit, fail-first:**
  §9-3 `/insurance/meta` removal · §9-4 display strings · §9-6 entity 400 · §9-7 one renewal helper · §9-10
  `policy_status` vocab + count scope · §9-12 `cover_by_type` label · §9-8 default checklist (if ruled) ·
  §9-11 GLOSSARY (spec first) · the doc-only contract flip. *(Whatever §9 does not approve collapses out.)*
- **Phase 0a — DESIGN-SYSTEM amendment ONLY IF the documents-checklist is ruled a new primitive (§9-8) or a
  chart is ruled in.** Else **confirm-only** (the ratified inventory + Switch/TextInput composition covers it).
- **Phase 1 — Page assembly.** Worklist on the Cash flow CRUD patterns: totals strip · policies DataTable +
  RowMenu · cover-by-type · upcoming renewals · the `[S]`-gated Dialog editor · the documents checklist · the
  protected bar + disclaimer · honest empty/"—" states.
- **Phase 2 — Tests.** The §7 criteria; the **D-055 adequacy grep** (standing); the **live one-reader**
  reconciliation (Insurance cash-value == Net worth line); the **one-renewal-derivation** test; extend the
  overflow/single-scroll/shell/link suites to `/insurance`.
- **Phase 3a — Scripted pre-pass GREEN before the walk.** Live app + real backend on a **reset** instance
  (empty → the EmptyState is the first thing it drives), then a **seeded** instance so policies, totals,
  cover-by-type and renewals render — both themes × every breakpoint, **0 console errors**.
- **Phase 3b — Owner acceptance walk (LIVE) — JUDGMENT ITEMS ONLY.** **The owner closes the phase.**

---

## 9. NEEDS DECISION — ✅ RESOLVED, OWNER ONE-PASS 2026-07-15

**All 13 items are ruled — every one ACCEPTED as proposed, with four owner amendments (A–D) folded into the
named rows.** Rulings first; the **original questions and proposed resolutions are PRESERVED VERBATIM below**.
**Matched by NUMBER AND TOPIC before recording — all 13 agree; no mismatch.** Build is unblocked through
Phase 0a — then it **STOPS at the geometry gate**.

| # | Topic | ✅ RULING (owner, 2026-07-15) |
|---|-------|------------------------------|
| **9-1** | Geometry | ✅ **ACCEPTED** — totals TrendStat strip → policies DataTable (spine) → upcoming-renewals + cover-by-type flanking cards; empty register → EmptyState. **GATE: static specimen at `/kitchen-sink`** (real shell, real-shaped data, honesty frames). **STOP after Phase 0a for screenshot ratification BEFORE Phase 1.** |
| **9-2** | Protected bar | ✅ **ACCEPTED** — subtitle bar **"A register, never an adequacy judgment."** + served disclaimer at the table foot; **standing adequacy-language content guard ships with the page tests in Phase 2** (D-058 precedent), **not now**. |
| **9-3** | `/insurance/meta` removal | ✅ **ACCEPTED** — delete the endpoint; editor reads `/refdata`. Phase-0, contract regen; flip the API-CONTRACT `remove` row to ✅ delivered. |
| **9-4** | D-105 money | ✅ **ACCEPTED + AMENDMENT A** — serve `*_display` for all policy money, the three totals, and each `cover_by_type` value. **Bundled with 9-10 into ONE Phase-0 change** (both touch the accepted Net worth D-081 line). |
| **9-5** | Insurer master | ✅ **ACCEPTED + AMENDMENT B** — Institution master **DEFERRED to the Accounts milestone** (it co-owns `institution`). **NO new `/insurance/insurers` endpoint** — the editor's insurer typeahead derives distinct suggestions **client-side** from the served `policies[]`. Master recorded as a named seam. |
| **9-6** | `?entity_id` | ✅ **ACCEPTED** — `GET /insurance` rejects `?entity_id` with an honest **400** (household-scoped). Fail-first. |
| **9-7** | Renewal A11 | ✅ **ACCEPTED + AMENDMENT C** — one `renewal_reminders(session, within_days)` helper; **both windows become named constants with rationale rows in the D-059 table** (`_RENEWAL_SOON_DAYS = 60` "a page you visit deliberately"; `_INSURANCE_SOON_DAYS = 30` "the attention feed"). Overdue unifies on the helper's **−3650d clamp**, deliberately; a fixture pins it. |
| **9-8** | Documents defaults | ✅ **ACCEPTED + AMENDMENT D** — four default labels (*Policy schedule · Premium receipts · Nominee form · Terms & conditions*) are **owner-ratified SEED CONTENT** (user-editable record data), **NOT GLOSSARY vocabulary** — the parity guard must not be misapplied. |
| **9-9** | `linked_goal_id` | ✅ **ACCEPTED + AMENDMENT D** — **omit from the editor** this milestone; column untouched (soft link, D-063). "Surface once goals have a home" is a **one-line seam note in this plan, NOT a ROADMAP R-item** (the currency-master precedent — a consequence of an unmade product decision). |
| **9-10** | `status` vocab | ✅ **ACCEPTED + AMENDMENT A** — vocab = **`active / lapsed / expired`**; totals stay active-only; **`count` fixed to count active** so the excluded-line and totals agree (bundled with 9-4). |
| **9-11** | Terminology | ✅ **ACCEPTED** — canonical term is **"Cover"** (not "Sum assured"); add Cover / Cover amount, Premium, Premium frequency, Nominee, Insured person, Renewal to `GLOSSARY.md` first, then the mock. PROPOSED → ratify at walk. |
| **9-12** | `cover_by_type` enum | ✅ **ACCEPTED** — serve `{type, label, value, value_display}` (display-cased at the backend boundary, §12rv1-5); the UI never maps enums. |
| **9-13** | Staleness (A10) | ✅ **ACCEPTED** — **A10 confirmed N/A** (user records, no market inputs; only the current-FX caveat, already in copy). Recorded so the absence is a decision, not a gap. |

### The four owner amendments (2026-07-15) — recorded in full

- **AMENDMENT A (binds 9-4 + 9-10):** both change figures the **ACCEPTED Net worth page renders on its D-081
  line** (`total_cash_value` → display string; `count` semantics change when inactive rows drop out). Bundle
  both into **ONE Phase-0 change**; **fail-first on BOTH** (a mixed active/lapsed fixture: today's `count` = 2
  vs totals over 1 → RED; a served total is a display string → RED on today's float); **re-run Net worth's
  pre-pass** after; append a **dated delta note to `docs/plans/page-net-worth.md`** recording that an accepted
  page's rendered figures changed and why (a §-entry, never a silent edit).
- **AMENDMENT B (binds 9-5):** Institution master **DEFERRED to the Accounts milestone**. **No new endpoint** —
  the insurer typeahead is a **client-side** distinct-suggestion derivation over the served `policies[]` (UI
  convenience over served data; **not** money math, **not** a vocabulary). The master is a **named seam**
  (§2 Ownership + §5 Vocabularies).
- **AMENDMENT C (binds 9-7):** one `renewal_reminders(session, within_days)` helper; **both windows named
  constants with rationale rows in the D-059 named-constants table (PRODUCT-SPEC §5):** `_RENEWAL_SOON_DAYS =
  60` (*"a page you visit deliberately"*) alongside `_INSURANCE_SOON_DAYS = 30` (*"the attention feed"*).
  Overdue semantics unify on the helper's existing **−3650d clamp**, deliberately; the fixture pins it.
- **AMENDMENT D (binds 9-8 + 9-9):** the four default checklist labels are **owner-ratified SEED CONTENT**
  (user-editable record data), **NOT** GLOSSARY vocabulary — recorded so the parity guard is not misapplied.
  9-9's *"surface `linked_goal_id` once goals have a home"* is a **one-line seam note in this plan, NOT a
  ROADMAP R-item**.

**Execution order (owner):** **Phase 0** (9-3 · 9-4+9-10[A] · 9-10 vocab · 9-6 · 9-7[C] · 9-12 · 9-8[D] ·
9-11, all backend-first, contract regen same commit, fail-first) → **Phase 0a** (the 9-1 specimen) → **STOP
for the geometry ratification.** Phase 1 assembly proceeds only after it.

---

### The original questions and proposed resolutions — PRESERVED

| # | Item | Why it blocks / what's needed | Proposed resolution (PROPOSED — owner decides) |
|---|------|-------------------------------|------------------------------------------------|
| **9-1** | **Page composition / geometry** — where the totals strip, the policies table, cover-by-type, upcoming renewals, and the editor sit; empty-register copy. | Worklist template (DESIGN-SYSTEM §3) — *a widget list is not a layout* (page-home §12ho1-3). This is a geometry ruling + a specimen gate. | **PROPOSE:** a **totals TrendStat strip** (Total cover · Cash value *(excluded, → Net worth)* · Annual premium · Count) → the **policies DataTable** with RowMenu as the page's spine → **upcoming renewals** and **cover-by-type** as flanking cards. Empty register → EmptyState (*"No policies yet — add your first policy to build your protection register."* + Add CTA). **Ratify the grid map from a specimen (real shell, real-shaped data) before assembly.** |
| **9-2** | **Protected copy bar wording + standing guard (D-055-class).** | The bar must be legible and enforced. The engine already negates adequacy in the served disclaimer and computes **no** adequacy figure (§10-1/§10-11). | **PROPOSE:** subtitle bar **"A register, never an adequacy judgment."** + keep the served disclaimer at the table foot; add a **standing content guard** grepping the rendered copy for adequacy/advice words outside the disclaimer (the D-058 forecast-guard precedent — mechanised, proven RED). **Ratify wording at the walk.** |
| **9-3** | **`/insurance/meta` removal (D-005).** | The endpoint still ships (`routes:48`) though `/refdata` serves the same vocab as `{value,label}`; two sources for one vocab. The API-CONTRACT `remove` row is due (§10-4). | **PROPOSE:** **delete `/insurance/meta`**; the editor reads `/refdata`. Phase-0, contract regen same commit. Flip the delta-table row to ✅ delivered. |
| **9-4** | **D-105 money display strings.** | Every money figure is a raw float (§10-5). D-105 binds all money. | **PROPOSE:** serve `*_display` for `cover_amount`/`cash_value`/`premium`, the three totals, and each `cover_by_type` value; render verbatim. **Cross-page:** add `total_cash_value_display` and migrate Net worth's D-081 line to it in the same change (app-wide label rule). |
| **9-5** | **Insurer → Institution master (D-008) — the master is UNBUILT.** | IA/MASTER-DATA say insurer comes from the Institution master, but **no institution table or endpoint exists** (§10-6); `accounts.institution` is also free text. Building the master touches Accounts (unbuilt) — it is bigger than this page. | **PROPOSE (owner call):** **defer the Institution master to the Accounts milestone** (which co-owns `institution`); ship `insurer` this milestone as **free text with a suggestion list over existing distinct insurer values** (a lightweight `/insurance/insurers` or reuse of served values), and record the master as a named seam. *Alternative:* build the master now as its own backend-first task before this page. **Owner picks the scope.** |
| **9-6** | **`?entity_id` — silently ignored.** | `list_insurance` ignores it (200); the register has no entity FK (D-063), so it cannot scope — the Policy §9-21 class (§10-7). | **PROPOSE:** **household-only** — `/insurance` **rejects `?entity_id` with an honest 400** (*"the insurance register is household-scoped"*). Fail-first (accepted today = RED). Per-entity registers → ROADMAP if ever wanted. |
| **9-7** | **Renewal derived twice (A11).** | The page (`upcoming_renewals`, 60d inline, `insurance.py:142`) and Review (`renewal_reminders`, 30d, `insurance.py:161`) are two code paths for *"renewal due soon"*, with different overdue handling (§10-8). | **PROPOSE:** **ONE** `renewal_reminders(session, within_days)` helper; the page calls it with its horizon (**60**? confirm), Review with **30** (`_INSURANCE_SOON_DAYS`); the window is a **parameter**, the overdue/date logic is shared. A test pins both call-sites to the one helper. Confirm the page horizon (60 vs a smaller number). |
| **9-8** | **Documents checklist — default label set + component.** | Shape is `[{label,have}]` (`models:538`); **no server-side default labels** exist. Free-text vs a suggested checklist is an owner call; and the checklist affordance is not a ratified component (§4). | **PROPOSE:** a **small suggested default label set served from the backend** (D-005) — e.g. *Policy schedule · Premium receipts · Nominee form · Terms & conditions* — user-editable, not per-type initially. **Compose the checklist UI from ratified `Switch` + `TextInput` rows** in the editor (no new component). If the owner wants a reusable `Checklist` primitive → §5 amendment. |
| **9-9** | **`linked_goal_id` — stored, unused, no Goals page.** | The column exists (soft link, D-063) but the report ignores it and there is **no Goals page** to link to (goals surface in Planning/Cash flow) (§10-2). | **PROPOSE:** **omit `linked_goal_id` from the editor UI this milestone** (nothing to link to); keep the column untouched (protected soft link). Record a ROADMAP/plan seam to surface it once goals have a home. **Owner confirms omit vs surface.** |
| **9-10** | **`status` vocabulary + totals scope.** | `status` is unvalidated free text, default `active` (`insurance.py:90-93` validates only type/frequency); no MASTER-DATA entry. Totals count **active only** (`:130`), but the excluded-line `count` = **all rows** (`:149`) — a scope mismatch Net worth inherits (§10-10). | **PROPOSE:** add a **`policy_status` fixed vocab** (`active`, `lapsed`, `expired` — or `active`/`inactive`; owner picks) to MASTER-DATA + `/refdata`, validated in `_apply`; totals stay active-only; **fix `count` to count active** so the excluded-line and the totals agree. Fail-first on the count scope. |
| **9-11** | **Terminology gaps (GLOSSARY).** | Shown terms **Cover** (amount), **Premium**, **Nominee**, **Insured person**, **Renewal** are **absent** from GLOSSARY (§10-11); *Policy documents (checklist)* and *Insurance cash value* exist. Hard rule: every shown term in GLOSSARY. | **PROPOSE:** add **Cover / Cover amount, Premium, Premium frequency, Nominee, Insured person, Renewal** to `docs/specs/GLOSSARY.md` **first**, then `mocks/glossary.ts` (parity guard). **Decide "Cover" vs "Sum assured"** (regional — SG/global "cover/sum insured" vs India "sum assured"); pick one canonical term. **PROPOSED → walk.** |
| **9-12** | **`cover_by_type.type` served as a raw enum.** | `type` is the raw `policy_type` value (`insurance.py:153`), e.g. `term_life` — a raw enum in a served figure (D-005 boundary). | **PROPOSE:** **display-case at the backend boundary** (the §12rv1-5 pattern — serve `{type, label, value}`), so the UI never maps enums; *or* the frontend maps via `/refdata` labels. Prefer the backend boundary for one truth. |
| **9-13** | **Staleness / confidence (A10) — N/A confirm.** | Policies are user-entered records with **no market inputs**, so the A10 layer is genuinely N/A — but non-base totals are FX-translated at **current FX** (`_to_base`, `insurance.py:39-47`), a mild external input, already caveated in copy (§10-12). | **PROPOSE:** **A10 is N/A** for policy records — no `stale_inputs` annotation (unlike Scenarios); the existing *"Base-currency totals use current FX"* caveat is sufficient. **Owner confirms N/A** (so the absence is a decision, not a silent gap). |

---

**Sign-off to start build:** §9 has no open blocker · §3b deltas are approved · no component in §4 requires an
unresolved amendment.

**✅ §9 CLOSED (owner one-pass, 2026-07-15). Phase 0 + Phase 0a proceed; Phase 1 assembly is BLOCKED until the
owner ratifies the §9-1 specimen geometry at `/kitchen-sink`.**

---

## 10. VERIFY-FIRST RECORD (D-019)

*What the engine **actually serves and actually guards**. Every claim carries a `file:line` cite.*

### 10-1. The reader + the CRUD engine — frozen; reads open, writes [A]-gated

**`GET /api/v1/insurance`** (`routes/insurance.py:43-45`) → `insurance_report` (`services/insurance.py:120`).
**In `API-CONTRACT.json`; untyped** (bare `dict`). **Served shape:**

```
{ base_currency,
  policies: [ { id, name, insurer, policy_type, policy_number, insured_person,
                cover_amount, currency, cash_value, premium, premium_frequency,
                start_date, renewal_date, nominee, linked_goal_id,
                documents:[{label,have}], notes, status } ],   # _serialize, :50-67
  count,                                    # = len(rows) — ALL rows, incl. inactive (:149)
  total_cover, total_cash_value, total_annual_premium,          # active-only (:150-152)
  cover_by_type: [ { type, value } ],       # active-only, raw enum `type` (:153)
  upcoming_renewals: [ { id, name, renewal_date, days } ],      # 60-day horizon (:142)
  disclaimer }                              # protected D-055-class copy (:156-157)
```

**Writes:** `POST /insurance` (`:53`), `PATCH /insurance/{pid}` (`:60`), `DELETE /insurance/{pid}` (`:70`) —
**all `require_auth`-gated**, all `session.commit()` after the service call. `PolicyIn` (`:23-40`) is the
create/edit body. `create_policy`/`update_policy`/`delete_policy` (`services:96-118`) are the CRUD engine;
`_apply` (`:79-93`) validates only `policy_type` and `premium_frequency` against their constant lists and
**forces `other`/`annual` on an unknown value** — `status` is **not** validated (§10-10).

### 10-2. No-FK isolation + no entity scope — D-063 intact

`InsurancePolicy` (`models/__init__.py:521-541`): `linked_goal_id` is a plain **`Integer`, no `ForeignKey`**
(`:537`, commented *"soft link"*); `documents` is **`Text`** holding `JSON [{label,have}]` (`:538`); the money
columns are **`DecimalText`** (`:529,531,532`) — stored as strings, so `Decimal` precision is preserved. There
is **no `entity_id` column** — the register is household-only **by construction** (D-063 protected). The
migration (`f1a2c7d5e9b3_insurance_policy.py:19-43`) is additive/idempotent and touches nothing else.

### 10-3. Read-only-for-reads; the write path is the CRUD editor

`insurance_report` performs **no session writes**. The mutations are the three `require_auth` routes (§10-1) —
this is a **Worklist CRUD page**, not a computed read-only page (contrast Scenarios). The `[S]` UI gate maps to
`require_auth` (D-103).

### 10-4. Vocab routing — `/refdata` serves it; `/insurance/meta` is a leftover

`/refdata` imports `POLICY_TYPES` and `FREQUENCIES` from `services/insurance` and serves them as `policy_type`
(`refdata.py:144`) and `premium_frequency` (`:145`), **wrapped to `{value,label}`** by `_labeled` (`:60-61`,
via `:149`) — labels auto-titleized (`term_life` → *"Term life"*, `critical_illness` → *"Critical illness"*;
`_label`, `:54-58`), which read acceptably. **But `GET /insurance/meta`** (`routes/insurance.py:48-50`) **still
ships**, returning the bare lists — the D-005 migration's **removal half never happened**. API-CONTRACT.md:72
carries the `remove` row, gated *"once `/refdata` lands"* — which it has. → **§9-3.**

### 10-5. Money is raw floats (D-105)

`_serialize` returns `cover_amount`/`cash_value`/`premium` as `float(...)` (`insurance.py:60-62`); the totals
are `float(round(...))` (`:150-152`); `cover_by_type` values are `round(v, 0)` floats (`:153`). **No `*_display`
strings anywhere.** The D-105 scope amendment (money = served display strings) binds this page as it bound
Scenarios §9-3. → **§9-4.**

### 10-6. Insurer is free text; the Institution master does not exist

`insurer` is `String(120)` nullable (`models:525`), accepted verbatim (`PolicyIn.insurer`, `routes:25`;
`_FIELDS`, `service:70`). **A grep of `app/api`, `app/services`, and `app/models` finds no institution table,
no institution endpoint, no institution service** — `accounts.institution` (`models:130`) is *also* free-text
`String(120)`. `refdata.py:115` *claims* extensible masters are *"served by their own endpoints"*, but that
endpoint is **unbuilt**. MASTER-DATA D-008 (`:284,:354`) describes the master + a re-pointing migration as a
**disposition, not a shipped fact**. IA §5 line 427 (*"insurer/policy_type from masters"*) is therefore
**aspirational for insurer**. → **§9-5** (owner scope call; not a shape fix).

### 10-7. `?entity_id` — silently ignored (the Policy §9-21 class)

`list_insurance(session)` (`routes:44`) declares **no `entity_id` param**; `insurance_report(session)`
(`service:120`) takes none. FastAPI drops an unknown query param and returns **200** — so `?entity_id=1` is
silently accepted-and-ignored. Policy and Scenarios both **reject with a 400** (household-only). Since the
register has no entity FK (§10-2), it *cannot* scope — the honest posture is a 400. → **§9-6.**

### 10-8. Renewal derived twice — the A11 class

The page computes `upcoming_renewals` **inline** in `insurance_report`: `_RENEWAL_SOON_DAYS = 60`
(`insurance.py:27`), appending any active policy with `days <= 60` (`:139-143`, includes arbitrarily overdue).
Review uses a **separate** function `renewal_reminders(session, within_days)` (`insurance.py:161-175`),
windowed `-3650 <= days <= within_days`, called from `review.py:143-144` with `_INSURANCE_SOON_DAYS = 30`
(`review.py:29`). **Two code paths for the same concept**, differing in window (60 vs 30) and overdue cutoff.
This is the A11 defect class (one rule, second derivation). → **§9-7.**

### 10-9. The D-081 exclusion is ONE reader — consistent by construction ✅

Net worth's *"Insurance cash value (excluded)"* valued line reads **`GET /insurance`**
(`frontend/src/api/net-worth.ts:87`, `getInsurance`) and uses **`total_cash_value` + `count`** (`:64-68`,
commented *"Insurance valued exclusion line (D-039/D-081) — only total_cash_value + count are used here"*). The
`/net-worth/statement` endpoint (`portfolio.py:879-897`) nets **portfolio** holdings only and **does not**
include insurance cash value (correct — the register is isolated, D-063). So Insurance **owns** `total_cash_value`
and Net worth **summarises** it — one served figure, no second derivation (P-1). Insurance must render that
figure (or link), never recompute the exclusion treatment.

### 10-10. `status` + the count/total scope mismatch

`status` defaults `active` (`PolicyIn`, `routes:40`; `models:540`) and is **not validated** against any vocab
(`_apply` validates only type/frequency, `:90-93`). `insurance_report` **skips non-active rows** for the
totals and cover-by-type (`if r.status != "active": continue`, `:130`) — but `count = len(rows)` counts **all**
rows (`:149`) and `policies[]` returns **all** rows (`:148`). So an inactive policy inflates `count` (which Net
worth's excluded line displays) while contributing nothing to `total_cash_value`. MASTER-DATA has no
`policy_status` entry. → **§9-10.**

### 10-11. Protected bar + adequacy audit — CLEAN ✅

The served disclaimer already negates adequacy and advice: *"Records and reminders only — not an assessment of
whether your cover is adequate, and not advice. Base-currency totals use current FX."* (`insurance.py:156-157`;
module docstring `:2-8` and route docstring `:2`). **A scan of `insurance.py` finds no adequacy / gap /
under-insured / sufficiency computation** — only totals, cover-by-type, and renewal reminders. The D-055-class
bar is therefore **honest by construction** (no adequacy figure to suppress). The §9-2 standing guard mechanises
it (the D-058 precedent). GLOSSARY: **Cover / Premium / Nominee / Insured person / Renewal** are **missing**
(§10 grep vs `GLOSSARY.md`); *Policy documents (checklist)* (`:231`) and *Insurance cash value* (`:233`) exist.
→ **§9-11.**

### 10-12. Staleness / confidence (A10) — genuinely N/A

Policies are **user-entered records** with **no market quotes** — so the A10 stale/low-confidence layer that
Scenarios/Policy carry has **no input to flag here**. The one external input is **current FX** on non-base
totals (`_to_base` → `fx.convert`, `insurance.py:39-47`), already caveated in the disclaimer (*"Base-currency
totals use current FX"*). Recording this so the A10 absence is a **decision, not a silent gap** — the owner
confirms N/A at **§9-13**.

### 10-13. Frontend state — nothing built

`/insurance` is in the nav (`nav.ts:49`) with **no `built: true`** — it renders `NotBuilt` today (the Scenarios
pre-build state). **No `frontend/src/api/insurance.ts`, no `Insurance.tsx` route** exists (grep). The only
insurance touch-point in the built frontend is Net worth's `getInsurance` for the D-081 line (§10-9).

---

## 11. BUILD RECORD — Phase 0 → Phase 0a (2026-07-16)

**Phase 0 (backend-first, one delta per commit, contract regenerated in the same commit where the shape
changed, every guard fail-first).** All 765 backend tests pass; `make api-contract-check` green.

| Item | Change | RED evidence (before) → GREEN |
|------|--------|-------------------------------|
| **9-3** | Delete `GET /insurance/meta` (`routes/insurance.py`); vocab lives on `/refdata` | Grep confirmed no consumer (§10-13); endpoint removed, contract regenerated (path dropped), API-CONTRACT.md `remove` row → ✅ |
| **9-4 + 9-10 (Amendment A)** | `*_display` for all policy money + the 3 totals + each `cover_by_type` value (D-105); `count` = **active only**; Net worth's D-081 line → `total_cash_value_display` | `test_insurance_phase0`: RED on both causes — `count == 2` while totals sum 1 active; `KeyError: 'total_cover_display'` → GREEN. Net worth pre-pass **re-run GREEN**; delta note in `page-net-worth.md §15` |
| **9-10** | `policy_status` fixed vocab `active/lapsed/expired` — MASTER-DATA §2 + `/refdata`, enforced in `_apply` like `policy_type` | RED: `refdata["policy_status"]` KeyError + `status` stored verbatim → GREEN (unknown → `active`) |
| **9-6** | `?entity_id` → honest **400** (`routes/insurance.py`) | RED: silent `200` → GREEN `400` ("household-scoped"); contract regenerated (new query param) |
| **9-7 (Amendment C)** | ONE `renewal_reminders(session, within_days)` helper; page calls it at `_RENEWAL_SOON_DAYS=60`, Review at `_INSURANCE_SOON_DAYS=30`; both named in the D-059 table (PRODUCT-SPEC §5); overdue unifies on the `_OVERDUE_CLAMP_DAYS=3650` clamp | RED: a >10y-overdue policy surfaced under the old inline `days<=60`, and `upcoming_renewals != renewal_reminders(60)` → GREEN (clamp excludes it; the equality test pins both call-sites to the one helper) |
| **9-12** | `cover_by_type` serves `{type, label, value, value_display}` (display-cased at the boundary, §12rv1-5) | RED: no `label` key → GREEN (`critical_illness` → "Critical illness") |
| **9-8 (Amendment D)** | Report serves `document_defaults` (four labels) as **seed content**, not a vocab | RED: absent → GREEN; code + MASTER-DATA note record "seed content, not vocabulary" |
| **9-11** | GLOSSARY: Cover / Cover amount, Premium, Premium frequency, Nominee, Insured person, Renewal — **`GLOSSARY.md` first**, then `mocks/glossary.ts` (canonical "Cover", never "sum assured") | `test_glossary_parity` GREEN (37); PROPOSED → ratify at walk |

**Out of scope, not taken (per the brief):** `response_model` typing for `/insurance` (08-TECH-DEBT); the
Institution master (§9-5 Amendment B — deferred to Accounts); any `linked_goal_id` surface (§9-9 — omit,
column untouched); any adequacy computation (§9-2 — the served disclaimer stands; the standing
adequacy-language content guard ships with the page tests in Phase 2, not now).

**⚠ Pre-existing, NOT mine, NOT fixed (out of scope):** the frontend `npm run check` is RED on **one
unhandled error** — `CashFlow.tsx:330` reads `obs.obligations.length` on `undefined` during an
`AppShell.test.tsx` **redirect** test (a partial mock). **Verified pre-existing** — it reproduces at
`c0e9fb1` (before any insurance work) and none of the insurance commits touch CashFlow/AppShell. Recorded in
`08-TECH-DEBT.md`; left for a separate hygiene commit (the "make lint RED on trunk" precedent). Everything I
added is green: 765 backend, glossary parity, NetWorth unit, typecheck, lint, tokens, build.

**Phase 0a — the §9-1 STATIC LAYOUT SPECIMEN** ships at `/kitchen-sink` (*"Insurance — LAYOUT SPECIMEN
(page-insurance §9-1) — PROPOSED, AWAITING RATIFICATION"*), composed from ratified `ui/` components only,
tokens only. Real-shaped data — **9 policies**, mixed types + long insurer names, SGD. Money written **as the
backend serves it** (display strings). Three frames:
- **populated register** — the totals TrendStat strip (Total cover · Cash value *(excluded)* · Annual premium ·
  Active policies = **8**, the lapsed policy excluded) → the **policies DataTable** spine (Policy + insurer
  subline · display-cased Type · Cover · Premium/yr · Renewal + chip · Status chip · ⋯ RowMenu) → flanking
  **upcoming-renewals** + **cover-by-type** cards. Honesty staged: a **LAPSED** policy (visible, excluded from
  totals + count); an **OVERDUE** and a **Renews soon** renewal chip (§9-7); a **MISSING premium** (em dash,
  §Guarantee-3). Protected bar in the subtitle (§9-2); the disclaimer once at the table foot.
- **empty register** — `EmptyState` (reason + Add CTA).
- **documents checklist** — composed **Switch + TextInput** rows seeded with the four default labels (§9-8,
  Amendment D; no new component).

Verified rendered in **both themes, 0 console errors** (via a fresh `vite preview` of the production build —
the running dev server had a stale HMR cache). Screenshots: `frontend/e2e/smoke/artifacts/insurance-specimen-{light,dark}.png`.

---

## 12. GEOMETRY GATE — ✅ RATIFIED WITH CONDITIONS (owner, 2026-07-16)

**The §9-1 specimen geometry is RATIFIED as shown** — the totals strip + the single policies table as the
spine + the two flanking cards; the ⋯ row menu; the renewal-soon/overdue chip treatment; the protected-bar
placement; the documents-checklist affordance. **Phase 1 proceeds** on the ratified geometry, subject to five
owner conditions recorded verbatim below.

| # | Ruling (owner, 2026-07-16) |
|---|---------------------------|
| **§12in-1** | **Non-base-currency treatment (spec gap the specimen surfaced).** Per-policy money display strings **carry the currency code when the policy's currency ≠ base** (e.g. `USD 500,000.00`); base-currency rows stay bare. Decided **at the backend boundary** (D-105 — the frontend formats nothing). Totals remain base-currency with the current-FX caveat. The specimen/demo data gains **one non-SGD policy** so the case is exercised, not just staged. |
| **§12in-2** | **The on-page exclusion statement is SERVED copy.** The served disclaimer is **extended** with both sentences shown in the specimen: *lapsed/expired excluded from totals and count*, and *cash value excluded from Net worth ("— see Net worth")*. One truth, one served string (D-005). |
| **§12in-3** | **Renewal state is SERVED, never re-derived (A11-adjacent).** `renewal_reminders` serves a per-renewal **`state`** (`overdue` / `soon` / `upcoming`); the frontend renders it verbatim. **No client-side day-threshold constant may exist** — `_INSURANCE_SOON_DAYS` lives in **ONE store (backend)**. |
| **§12in-4** | **Em-dash distinction RECORDED as a decision.** A register field the user left blank (premium, renewal date, cash value) renders a **bare em dash** — *"not recorded"* is self-evident for user-entered optional data. **Computed** figures keep the Guarantee-3 em-dash-**plus-reason** requirement. (A ruling, not a slide.) |
| **§12in-5** | **RATIFIED AS SHOWN (ships as-is):** the EmptyState wording including *"— cover, premiums, renewals and documents"*, and the StatusChip tones (**Active = `positive`, Lapsed = `attention`** — factual states, the Pricing Health precedent). |

**Carried to the owner walk (still PROPOSED):** the §9-11 GLOSSARY terms; the §9-2 protected-bar wording + the
standing adequacy-language guard (mechanised in Phase 2); the §9-8 default checklist labels.

**Geometry gate PASSED. Phase 1 assembly proceeds under §12in-1..5.**

---

## 13. BUILD RECORD — Phases 1 → 3a (2026-07-16)

**Geometry gate PASSED with conditions (§12in-1..5).** Phase 1 pre-assembly backend deltas (one commit
each, fail-first proven RED on the real cause; no contract shape change — the route is an untyped dict):

| Item | Change (file:line) | RED → GREEN |
|------|--------------------|-------------|
| **§12in-1** | Per-policy `*_display` carry the currency code when `currency != base` (`_money_display`, `insurance.py`); base rows bare. Demo seeds a realistic register incl. a USD + a lapsed policy (`seed/demo.py`). | `test_insurance_phase1`: bare `"500,000.00"` for a non-base policy → RED → GREEN (`EUR 500,000.00`). Existing absolute-count tests clear the register first. |
| **§12in-2** | Served disclaimer extended with the two exclusion sentences (`insurance.py`). | disclaimer stopped after the FX caveat → RED → GREEN (both sentences + `see Net worth`). |
| **§12in-3** | `renewal_reminders` serves per-item `state` (overdue/soon/upcoming); the soon threshold `_INSURANCE_SOON_DAYS` lives in ONE backend store (`insurance.py`), Review imports it (`review.py`, value unchanged). | no `state` key → RED → GREEN; the equality test still pins both call-sites to the one helper. |

**Phase 1 — assembly.** Typed `api/insurance.ts`; `Insurance.tsx` on the ratified §9-1 geometry: totals
TrendStat strip → policies `DataTable` spine (served display strings; served `policy_type_label` §9-12;
served renewal-`state` chip §12in-3; `StatusChip` tones §12in-5; `RowMenu`) → flanking upcoming-renewals +
cover-by-type cards → the served disclaimer at the table foot (linkifies only the trailing *"see Net
worth"*). Progressive loading (Skeleton → data / EmptyState / honest error). **[S]-gated CRUD editor**
(`Dialog`, ambient PIN session D-103): `MasterSelect` for type/frequency/status; **insurer = free
`TextInput` + client-side distinct suggestions** over the served `policies[]` (§9-5 — a new opt-in
`suggestions` datalist on `TextInput`, a convenience not a vocabulary); documents checklist composed
`Switch` + `TextInput`, a new policy seeded from `document_defaults` (§9-8); **`linked_goal_id` omitted**
(§9-9). Dates via `DateInput`. GLOSSARY `[Help]` popovers on the marked terms. Route wired; nav `/insurance`
→ `built: true`. Backend adds served `policy_type_label` (§9-12, no client enum map).

**Phase 2 — tests.** `Insurance.test.tsx` (8): totals served strings + active count; lapsed row visible but
excluded; served-state chips (Overdue / Renews soon) with **mandatory labels**; non-base currency code;
missing premium = bare em dash (§12in-4); disclaimer's two sentences + the `see Net worth` link; empty
register CTA. **STANDING adequacy-language guard (§9-2, the D-058 precedent)** — proven **RED** by a
temporary *"Coverage adequacy"* heading, then restored GREEN; permanent. `/insurance` added to the overflow
+ single-scroll cross-page suite (12 pass, both themes, 320–1366).

**Phase 3a — scripted pre-pass GREEN on the demo-seeded live instance** (`e2e/smoke/insurance-smoke.spec.ts`):
the seeded register renders live; §12in-1 `USD 500,000.00` on the non-base row; §9-10 lapsed shown, active
count **7 < 8** rows; §12in-3 served overdue/soon chips; §12in-2 disclaimer sentences + the link; §9-2 no
adequacy language; **CRUD round-trip add → edit → delete through the [S]-gated editor**; containment at
320/375/420/500/900/1100/1366 (the clipped element's `scrollWidth`, never a container metric); single
vertical scroll region, 0 horizontal overflow both themes; **0 console errors**.

**⚠ The pre-pass earned its keep — it caught a bug no unit test could:** the live editor threw *"Unknown
master: policy_status"* because the offline **mock refdata registry** (`mocks/refdata.ts`) lacked the new
vocab (the live `/refdata` had it since Phase 0.3). Fixed. A green unit suite is not acceptance — the live
render is (Holdings retrospective).

**Cross-page (Net worth, ACCEPTED page):** the demo now seeds an insurance register with cash value, so Net
worth's D-081 exclusion line renders live (previously the demo had 0 policies). `net-worth-smoke` PART 6
updated from *"line omitted"* to *"line PRESENT, `total_cash_value_display` served verbatim + the see-Insurance
link"* and **re-run GREEN**. Recorded in `page-net-worth.md §15`.

**⚠ Pre-existing, NOT mine (out of scope):** the frontend `npm run check` still fails on one unhandled
`CashFlow.tsx:330` error in an `AppShell` redirect test — verified pre-existing at `c0e9fb1`, logged in
`08-TECH-DEBT.md`. Everything I added is green: **770 backend** (769 + 1 net after the phase1 additions),
insurance unit (8) + NetWorth unit (7), overflow (12), both live pre-passes, typecheck / lint / tokens /
build.

**STOP.** Phases 1–3a are complete and the pre-pass is GREEN. **Phase 3b (the owner acceptance walk) is the
gate — nothing here is self-certified. The walk has not begun.**

---

## 14. OWNER WALK — BATCH 1 (owner, 2026-07-16)

**The owner walked the live `/insurance` (demo-seeded, 2026-07-16) and filed five findings.** Recorded
verbatim below; four are fixed this batch (three walk bugs + the §14in-2 honesty defect + one platform
first-instance), one is parked to ROADMAP. **Nothing here is self-certified — the owner re-walks.**

| # | Kind | Finding (owner) | Disposition |
|---|------|-----------------|-------------|
| **§14in-1** | bug | Page padding **exceeds the platform standard** — the whitespace between the totals strip, the policies card and the flanking cards is larger than every other page. | **FIXED** (Part 3.1). |
| **§14in-2** | bug (honesty) | The **"Premium / yr"** column renders the served **per-frequency** `premium_display` — a monthly 50 shows as `50`, not `600`. A precise-looking figure that is **wrong**, and **Σ(column) ≠ the Annual premium total** shown in the strip beside it. | **FIXED** — backend-first (Part 2). |
| **§14in-3** | scope → ROADMAP | Premiums should **flow into Cash flow automatically** — the owner calls the current separation *"disintegrated"*. | **PARKED → R-36** (Part 4). NOT batched: Cash flow's obligations register is §0-PROTECTED (D-057); derived-row injection is a data-model + semantics decision needing its own plan. |
| **§14in-4** | bug | **Upcoming-renewals card** — dead vertical space; rows misaligned (dates float, right edge ragged). | **FIXED** (Part 3.2). |
| **§14in-5** | platform decision | **Base-currency indication** on money summary surfaces should be shown **platform-wide** (which currency the aggregate is in). | **FIRST INSTANCE now** on the Insurance totals strip + **DESIGN-SYSTEM amendment (PROPOSED)** (Part 3.3); **cross-page retrofit scheduled, not batched** (CURRENT.md, beside the [Help]/Segmented retrofits). |

### §14in-1 — page padding exceeds the platform standard (bug) — FIXED

**Root cause (measured live, fail-first):** the shell content padding is IDENTICAL on every page
(`24 / 20 / 64 / 20` px on `.lf-shell__content`) — **not** the deviation. The deviation is **page-local
vertical margin**: `.ins__totals` and `.ins__section` each carried `margin-bottom: var(--space-4)` (12px),
which **stacks on top of** `.lf-page`'s `gap: var(--space-5)` (16px) → the gap between the totals strip and
the policies card, and between the policies card and the flanking cards, rendered at **28px** where
`/cash-flow` and `/scenarios` (which set NO page-local margins) hold a consistent **16px** rhythm. A
per-instance copy fighting the shared `.lf-page` gap IS the defect (the Segmented/StatusChip rule).

**RED (before):** measured `/insurance` gaps = **28px, 28px** vs `/cash-flow` = **16, 16, 16, 16** and
`/scenarios` = **16, 16, 16** (same shell padding on all three). **Fix:** deleted the two page-local
`margin-bottom` rules; `.lf-page`'s gap now owns the vertical rhythm. **GREEN:** all `/insurance` gaps =
**16px**, matching the platform standard. Guarded by the pre-pass rhythm assertion (Part 5).

### §14in-2 — "Premium / yr" rendered the per-frequency premium (bug, honesty) — FIXED (backend-first)

**The lie:** the column read the served `premium_display`, which is the premium **as the user pays it**
(a monthly premium of 50 renders `50.00`), while its header says *"/ yr"* and the strip beside it sums the
**annual-equivalent** `total_annual_premium`. So the column showed a precise-but-wrong number **and** the
column did not reconcile with the total.

**Fix (Part 2), one derivation:** a per-policy annual-equivalent is now computed by **one function**,
`_annual_premium(premium, frequency)`, that **both** the served per-row `annual_premium_display` AND the
`total_annual_premium` accumulator call — no second derivation. Frequency semantics (GLOSSARY): monthly
×12, quarterly ×4, annual ×1, **single → no recurring equivalent** (served `null` → the UI renders a bare
em dash, the §12in-4 user-data-absent case). Non-base policies keep the §12in-1 currency-code affix. The
column renders `annual_premium_display` verbatim; the editor still captures premium + frequency as entered
(the register stores what the user pays; the page shows the annual equivalent).

**RED (before) → GREEN:** `test_insurance_walk1` — a monthly-50 fixture asserting
`annual_premium_display == "600.00"` (RED: field absent), and an **equality test**
`Σ(served per-row annual, FX-converted) == total_annual_premium` (the A11 pattern — pins the one
derivation). See §14 build record (Part 5).

### §14in-4 — upcoming-renewals card: dead space + misaligned rows (bug) — FIXED

**Root cause (measured live, fail-first):** (a) the flanking grid stretched the renewals card to
**351px** to match the taller 7-row cover-by-type sibling, while the renewals content was only ~159px →
**~190px of reserved dead vertical space**; (b) rows were flex with `margin-left:auto`, so the date column
floated (measured date left edges at **L569 / L542 / L542 / L464** — ragged) and only the chip right edge
happened to align.

**Fix:** the renewals list is now a **subgrid** — every row shares three tracks: policy name
(`minmax(0,1fr)`, truncating, min-width) · date (tabular, right-aligned) · state chip / *"in N days"*
(right-edge aligned); the list fills the card width. The flanking grid uses `align-items: start` so each
card's height is **content-driven** (consistent with the cover-by-type sibling) — no reserved dead space.
Breakpoints model the content box; the responsive containment guard runs in the **pre-pass at real
viewports** (TEMPLATE §7 media-query exception), not on a static specimen. **RED → GREEN** proven by the
pre-pass row-alignment + no-dead-space assertions (Part 5).

### §14in-5 — base-currency indication (platform decision) — FIRST INSTANCE + DESIGN-SYSTEM (PROPOSED)

Money **summary tiles/strips** that show a base-currency aggregate now carry a **small muted currency-code
affix** (e.g. `SGD`) next to the value — one pattern, token-styled via the existing `.lf-stat__unit` slot
(muted `--text-tertiary`, no new component), **never colour-semantic**. The affix source is the SERVED
`base_currency` (`/insurance` already serves it, `insurance.py`). Applied to the Insurance totals strip's
three **money** tiles now (Total cover · Cash value · Annual premium); the **Active policies** count tile
carries none (it is not money). Per-row non-base amounts already carry codes (§12in-1).

Recorded as a **DESIGN-SYSTEM.md "Base-currency indication" entry (PROPOSED — owner ratifies at the
re-walk)**. The **cross-page retrofit is a scheduled batch** — each already-accepted money-summary page
(liquidity/runway/statement readers already serve `base_currency`; Net worth, Portfolio, Home, Review
tiles) needs its own pre-pass re-run — listed in CURRENT.md beside the [Help]/Segmented retrofits, owner
picks the targets. **Not batched here.**

### §14 BUILD RECORD — Walk batch 1 (2026-07-16) — RED → GREEN

**Backend (§14in-2), fail-first, no contract shape change** (the `/insurance` route is an untyped dict —
the added `annual_premium` / `annual_premium_display` keys flow through; `make api-contract-check` green):

| Item | Change (file) | RED → GREEN |
|------|---------------|-------------|
| **§14in-2** | One `_annual_premium(premium, frequency)` helper (`services/insurance.py`) — monthly ×12, quarterly ×4, annual ×1, **single/none → None**; BOTH `_serialize.annual_premium_display` AND the `total_annual_premium` accumulator call it (one derivation). Demo seed converted to a **mixed-frequency** register (`seed/demo.py`): monthly 100/200/40, quarterly 450/150, single 3000, one no-premium — annual-equivalents chosen so `total_annual_premium` is unchanged. Frontend: the "Premium / yr" column renders `annual_premium_display` (`Insurance.tsx`); `api/insurance.ts` typed. | `test_insurance_walk1` (3): a monthly-50 fixture asserting `annual_premium_display == "600.00"` — **RED: `KeyError: 'annual_premium'`** (field absent, column showed the raw per-frequency premium) → **GREEN**; the multiplier + single→null cases; and the **A11 equality** `Σ(active per-row annual) == total_annual_premium` (base-currency, exact). Unit: `Insurance.test.tsx` gains a monthly-100 row asserting the /yr cell reads `1,200.00`, not `100.00`. |

**Frontend (§14in-1 / §14in-4 / §14in-5), CSS/compose only:**

| Item | Change | RED (measured live) → GREEN |
|------|--------|-----------------------------|
| **§14in-1** | Deleted the page-local `margin-bottom: var(--space-4)` on `.ins__totals` + `.ins__section` (`Insurance.css`) — `.lf-page`'s gap now owns the rhythm. | pre-pass **PART 7a**: section gaps **[16, 28, 28]** on the pre-fix CSS (guard RED, *"section rhythm == .lf-page gap"*) → **[16, 16, 16]** (== the platform standard, as `/cash-flow` and `/scenarios`). |
| **§14in-4** | Renewals list → **subgrid** (name · date · chip/days, right-edge aligned); flanking grid `align-items: start` (content-driven height). The 1-col totals breakpoint widened 30rem → **40rem** (the §14in-5 affix widened the largest money value; a 2-col tile clipped `2,952,505.50 SGD` below ~560px). | pre-pass **PART 7c**: pre-fix date lefts **L569/L542/L542/L464** (ragged), both flank cards stretched to **351px** → dates all **L589**, right edges all **L767**, renewals **213px < cover-by-type 318px** (no dead-space stretch), slack below list **30px**. Containment @320..1366 GREEN after the breakpoint fix. |
| **§14in-5** | Totals money tiles pass `unit={base_currency}` (`Insurance.tsx`) → the muted `.lf-stat__unit` affix; DESIGN-SYSTEM.md "Base-currency indication" entry (PROPOSED). | pre-pass **PART 7d**: Total cover / Cash value / Annual premium each carry **`SGD`**; the **Active policies** count tile carries **none**. |

**Verification (all GREEN):** backend **774 passed** (+3 walk1; 16 insurance) · `api-contract-check` green ·
frontend typecheck / lint / tokens clean · `Insurance.test.tsx` **9** · `NetWorth.test.tsx` **7** · build
green · overflow suite **179** (incl. `/insurance` 320/375/900/1366 × both themes + shared-shell +
themed-link) · **`insurance-smoke` live GREEN** (PART 7a–7d + containment + CRUD round-trip + single
vertical scroll + **0 console errors**, both themes) · **`net-worth-smoke` live GREEN** (D-081 line
`16,140.13` served verbatim — unaffected). **Fail-first proven** on the real cause for both the backend
(`KeyError`) and the geometry (gaps `[16,28,28]`).

**⚠ Pre-existing, NOT mine (unchanged, out of scope):** the frontend `npm run check` is still RED on the
`CashFlow.tsx:330` unhandled error in an `AppShell` redirect test (reproduces at `c0e9fb1`, logged in
`08-TECH-DEBT.md`). None of this batch touches CashFlow/AppShell.

**§14in-3 is PARKED to ROADMAP R-36 — not built.** No premiums→Cash-flow behaviour was invented.

**STOP — AWAITING OWNER RE-WALK.** Batch 1 is fixed + re-verified by the scripted pre-pass; **nothing here
is self-certified**. The owner re-walks `/insurance` (padding rhythm, the annualised "Premium / yr" column
+ its reconciliation, the aligned renewals card, the base-currency affix) and ratifies §14in-5 (the
DESIGN-SYSTEM "Base-currency indication" entry, still PROPOSED).

---

## 14 — OWNER WALK BATCH 2 (owner re-walk with platform screenshots, 2026-07-16)

The owner re-walked platform-wide and filed three findings. Two are platform decisions with cross-page
reach; every touched ACCEPTED page carries a dated delta note + a re-run pre-pass. **STOP before any
acceptance claim — the owner re-walks.**

### §14in-1 RE-OPENED — the batch-1 guard measured the wrong property (lesson)

**Batch 1 "fixed" §14in-1 by aligning the SECTION GAPS (16px rhythm) — but the owner's finding was the
PAGE INSET** (the padding between the shell and the page content on all four sides). The gap-rhythm guard
went **green on an adjacent property**, leaving the real defect standing. **Recorded lesson (folded into
the guard):** *a guard must measure the geometry the finding NAMES — matching some neighbouring property
is a green that hides the bug.* This is the page-home §12ho2-1 / §12sc1-1 lesson recurring; the strengthened
inset guard now measures the four-side inset at the width where it appears. **Superseded by §14in-6.**

### §14in-6 (bug + spec gap) — page inset drifted; no DESIGN-SYSTEM standard existed — FIXED

**Finding:** Insurance AND Holdings render a visibly larger page inset than Net worth / Portfolio /
Scenarios. **Root cause (measured live at 1728/1920, fail-first):** two page roots capped + centred
themselves — Holdings `.hold { max-width: 72rem; margin: 0 auto }`, and Insurance inherited
`max-width: 70rem; margin: 0 auto` **through a CSS class collision** (Instrument Detail's page root also
used the `.ins` prefix, so its rule bled onto Insurance — and the two pages were cross-contaminating
`.ins__cardhead / __section / __field` as well). At 1920 both centred ~250px in from each edge while every
other page ran full-width; **invisible at ≤1366** (the cap doesn't bite), which is why the batch-1 guard
(measuring at 1200) never saw it. There was **no page-inset standard in DESIGN-SYSTEM**, which is why pages
drifted.

**Fix:**
1. **Spec first — DESIGN-SYSTEM §3.1 "Page inset" (RATIFIED 2026-07-16):** ONE shell-owned content inset
   for all pages (`.lf-shell__content` padding, the value Net worth/Portfolio render); no page-local
   `max-width` / centering `margin` / root padding.
2. **Instrument Detail:** renamed its `.ins` prefix → **`.idp`** (ending the collision — Insurance is the
   rightful `ins`) and removed its `max-width` + `margin: 0 auto`. (Delta note: `page-instrument-detail.md`.)
3. **Holdings:** removed `.hold` `max-width` + `margin: 0 auto`. (Delta note: `page-holdings.md`.)
4. **Insurance** needed **no change** — with the collision gone it has no root `max-width`.
5. **Guard (pixels, at the width where it appears):** `e2e/overflow.spec.ts` — *"every page fills the
   shell content box"* — replaces the batch-1 test; measures each built route's `.lf-page` box vs the shell
   content box **at 1728px** and asserts left+right inset ≈ 0.

**RED → GREEN:** the strengthened guard, run on the pre-fix tree, reported `#/holdings left=148 right=148 |
#/instrument/AAPL left=164 right=164 | #/insurance left=164 right=164` (RED) → all pages left=right=0 after
the fix (GREEN). InstrumentDetail (7) + Holdings (23) unit tests pass after the rename.

### §14in-7 (owner ruling) — base-currency indication RATIFIED; retrofit pulled forward — DONE

**Owner ruling:** the DESIGN-SYSTEM §5.2 base-currency indication (first shipped on Insurance, §14in-5) is
**RATIFIED as shipped**, and the cross-page retrofit is **pulled forward — done now** (the owner overruled
the batch-1 scheduling). Flipped DESIGN-SYSTEM §5.2 → **RATIFIED (2026-07-16)** and applied the muted
`.lf-stat__unit` affix (source = each reader's **served `base_currency`**, never hardcoded) to every
base-currency money summary tile/strip:

| Page | Tiles affixed | base_currency source | Inline form converted? |
|------|---------------|----------------------|------------------------|
| **Net worth** | the four headline tiles (Net worth · Gross assets · Liabilities · Cash & deposits) | `/portfolio/summary` (`portfolio.ts`) | — |
| **Portfolio** | rail money tiles (Today's change · Unrealised P/L · Realised P/L · Cost basis) + **Costs** (recorded fees · ongoing cost) | `/portfolio/summary`, `/portfolio/cost-of-ownership` | — |
| **Holdings** | the linked net-worth summary tile | `/portfolio/summary` (`baseCcy`) | **yes** (`SGD …` embed → affix) |
| **Review** | the net-worth stat | `/review` (`base_currency`) | **yes** (embed → affix) |
| **Scenarios** | the four Exposure tiles + the "Net worth today" caption | `/portfolio/scenarios` | — |
| **Cash flow** | the three runway money figures (net burn · monthly expenses · monthly income) | `/portfolio/runway` | — |
| **Home** | the net-worth + today's-change widgets | `/portfolio/summary` | **yes** (page-local `.hm3__unit` → the one `.lf-stat__unit`) |
| **Insurance** | totals strip (first instance, §14in-5) | `/insurance` | — |

**ONE form, not two:** the affix is the ratified `.lf-stat__unit` slot everywhere (via `TrendStat`'s `unit`
prop, or the same class for the few non-`TrendStat` money figures); the page-local `.hm3__unit` copy was
removed. **Instrument Detail** has **no** base-currency summary TILES — its "Your position" is a facts
`<dl>` whose money row already labels the currency (`Value (SGD)`) — so it is out of scope (verified, not
skipped). Markets / Heatmap / Pricing Health rows carry per-quote codes already — out of scope.

**Platform improvement (TrendStat):** a **zero-width-space break** now sits before the `unit`, so on a
narrow tile the code drops to its own line instead of clipping the value (invisible when it fits) —
otherwise the widened value clipped at 320px (Scenarios) / would have at 500px (Insurance). Proven RED
(Scenarios exposure `980,000.00SGD` clipped `191>186` @320) → GREEN (wraps, `186==186`).

### §14in-8 (bug, honesty) — Review headline disagreed with Net worth — FIXED (backend-first)

**Finding:** Review showed `SGD 796,246.00` / `+17.00` while Holdings/Net worth showed `796,246.41` /
`+16.73` — the same figures, two values. **Root cause (verify-first, file:line):** `review.py:319` served
`round(float(val.total_value), 0)` and `:335` `round(float(val.day_change), 0)` — **whole-dollar rounded**,
while Net worth renders the un-rounded `val.total_value` from the SAME `value_portfolio` reader with the
same client formatter. Review also embedded `SGD` inside the value string.

**Fix (D-105, one derivation):** removed both `round(..., 0)` so Review serves the full-precision figure
(identical to `/portfolio/summary`); Review's tile renders it with the same `formatMoney`/`formatSignedMoney`
and carries the base-currency **affix** (not an embed). **RED → GREEN:** `test_review_centre` —
`review.net_worth == /portfolio/summary.total_value` (and `day_change` likewise) — RED on the pre-fix round
→ GREEN. Live: `/review` and `/portfolio/summary` both serve `796,246.41 / 16.73`; the review-smoke asserts
the rendered headline matches to the cent + carries the affix. (Delta note: `page-review.md`.)

### §14 BATCH-2 verification (all GREEN)

- **Backend:** `775 passed` (+1 walk-2 equality test) · `api-contract-check` green (no contract shape
  change — `/review` fields stay `float`).
- **Frontend:** `tsc` clean · lint clean on all touched files · tokens clean · unit suites for every
  touched page pass (Net worth 7 · Portfolio 12 · Holdings 23 · Scenarios 9 · Cash flow 10 · Review 8 ·
  Home 8 · Instrument Detail 7) · production build implied by tsc+smokes.
- **e2e:** `overflow.spec.ts` **179 pass** incl. the **strengthened inset guard** (fail-first proven).
  Live smokes GREEN with the new render guards: **net-worth** (four tiles carry the affix), **review**
  (headline == canonical to the cent + affix), **portfolio · scenarios · cash-flow · insurance** — 0
  console errors, both themes, 320–1366 (+ 1728 for inset).
- **Fail-first proven** on the real cause for all three: inset guard (`left=148/164` RED), Review
  (`KeyError`-class rounding mismatch RED), affix-clip (`191>186` RED).

**⚠ Pre-existing, NOT mine (unchanged, out of scope):** the `AppShell.test.tsx` redirect test errors on the
`CashFlow.tsx` `obligations.length` partial-mock crash — reproduces with my CashFlow edit reverted;
logged in `08-TECH-DEBT.md`. Every touched page's own unit + smoke suites are green.

**STOP — AWAITING OWNER RE-WALK.** Nothing self-certified. The owner re-walks: the uniform page inset at
wide viewports (Insurance/Holdings now match Net worth/Portfolio; **Instrument Detail is now full-width** —
a consequence of the uniform-inset ruling, flagged for confirmation), the base-currency affix on every
money summary across the platform (one form), and the Review headline now matching Net worth/Holdings to
the cent.

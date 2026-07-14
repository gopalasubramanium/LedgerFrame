# page-cash-flow — build plan (PLAN ONLY — nothing is built)

**Status: DRAFT, §9 OPEN.** Drafted 2026-07-15 from `TEMPLATE-page-build.md`. The **verify-first pass
(D-019) is done** — §10 records what the three planning readers **actually serve and what they actually
guard**, with `file:line` cites. **Nothing is built.** Every ambiguity is in **§9**; the owner resolves them
**one-pass**. **I resolved none.**

Cash flow is a **Planning**-group page (IA §2/§3) and the **canonical home for Goals, Obligations and
Contributions** (D-056 rename; D-057). Its two protected semantics are **§0-PROTECTED** (DECISIONS §0,
"deliberate honesty features"):

> **Contributions never reduce the cash runway.** **`once` obligations are excluded from recurring net burn.**

**Headline of the verify-first pass — six findings, all in §9:**

1. ✅ **The editor shape is decided by evidence, and the evidence says the OPPOSITE of Policy.** All three
   resources serve **per-row CRUD** (`POST` / `PATCH /{id}` / `DELETE /{id}`), PIN-gated (§10-1). Policy's
   bulk-replace followed from *its* endpoint being an atomic replace; **that reasoning does not transfer**,
   and it is not inherited here.
2. ✅ **Both D-057 invariants HOLD IN CODE — and are proven by construction, not by accident** (§10-2):
   `runway_report` **never queries the Contribution table at all**, and `'once'` is dropped because
   `MONTHLY_FACTOR` simply **has no key for it**.
3. ⚠ **…but NEITHER invariant has a pinning test.** No test creates a contribution and asserts the runway is
   unchanged; no test creates a `once` obligation and asserts it is absent from the burn. **§0-protected
   semantics with no code test is exactly the D-084 lesson** — a spec sentence the code is free to
   silently break (§10-2c). **This is the highest-value finding in the pass.**
4. ✅ **The income question is ANSWERED by the model, not by me:** income is a **flagged obligation**
   (`Obligation.kind ∈ {expense, income}`, `models:492`), **not** a signed amount (`amount` is `gt=0`) and
   **not** a separate record type (§10-4). **No record type is invented.**
5. ⚠ **Money is served as raw floats, and one figure the page needs is NOT SERVED AT ALL.** The **D-105
   scope amendment** (money = served display strings **everywhere**, ratified 2026-07-15) now binds this
   page, and **there is no per-row monthly-equivalent** on the obligations or contributions readers — only
   the **totals**. A per-row "≈ per month" column would be **client money math**, which is forbidden
   (§10-5).
6. ⚠ **Deletion is a HARD delete with no undo** — and this page would be the platform's **first explicit
   destructive UI action**. Holdings has **soft-delete + 10s undo**; these endpoints have neither (§10-7).

---

## 1. IDENTITY

| Field | Value | Spec ref |
|-------|-------|----------|
| Page name (H1 = nav label = route) | **Cash flow** *(the label is "Cash flow"; "Planning" survives only as the GROUP name — D-056)* | IA §2/§5, D-022, D-056 |
| Route | **`/cash-flow`** *(canonical; **`/planning` redirects** for migration — IA §3)* | IA §2/§3 |
| Nav group | **Planning** (Review · Policy · **Cash flow** · Scenarios · Insurance · Estate) | IA §3 |
| Page template | **Worklist** — DESIGN-SYSTEM §3 **names Cash flow in the Worklist row explicitly** (*"Primary DataTable(s) + row actions + CRUD editor, for records you manage or work through"*). **Copied, not presumed.** | DESIGN-SYSTEM §3 |
| Rotation eligibility | **Eligible** — *"any nav page"* (D-044). Corollary: rotation **skips empty pages**, and a fresh install has **all three lists empty** (§9-8), so an unconfigured Cash flow is skipped by construction — the Policy §9-11 precedent. | IA §3 (D-044) |
| One-line purpose | **Goals, Obligations, Contributions** (IA §2). | IA §2 |

---

## 2. OWNERSHIP TABLE

**Owns (canonical, authoritative, fully explained here):** — IA §5, D-057

- **Goals** — the records (name, target amount, target date, currency, basis) **and their live progress**
  against the served basis.
- **Obligations** — the records (name, amount, due date, currency, recurrence, **kind: expense/income**),
  their **next due** date, **occurrences in 12 months**, and the **next-12-months outflow total**.
- **Contributions** — the records (name, amount, currency, frequency, kind, optional goal link, active), and
  their **monthly-equivalent** totals + **planned cash-out**.
- **The protected D-057 copy** — *contributions do not reduce the runway* (served on the contributions
  reader, `contributions.py:117-118`) and *`once` obligations are excluded from recurring burn*.

**Summarises (other pages' info — via the named reader, linked, never recomputed):**

| Summary shown | Canonical page | Shared reader reused | Link target |
|---------------|----------------|----------------------|-------------|
| **Cash runway** (status · months · net monthly burn) | **Net worth** (D-036 — runway is canonical **there**, IA §5 says so explicitly) | **`runway_report`** (`services/runway.py:27`) — served by `GET /portfolio/runway`. **The same reader Net worth's runway card reads.** Never a second computation. | `/net-worth` |
| *(gated on §9-3)* the runway's **monthly expense / income / net burn** figures | Net worth | the **same** `runway_report` — see the ⚠ below | `/net-worth` |

⚠ **THE SINGLE-DERIVATION SEAM, stated precisely.** `monthly_expense`, `monthly_income` and
`net_monthly_burn` are **the runway reader's own figures** (`runway.py:64-67`) — they are **derived from
this page's obligations** but they are **served by Net worth's reader**. If this page shows them, it must
show **the served ones**, never re-derive them from the obligation rows it already has in hand. That
re-derivation would be trivially easy to write, would agree today, and would be **exactly the second code
path** P-1/D-038 forbid — the **A11 defect on Policy, repeated**. §9-3 rules whether they are shown at all.

**Links to:**
- **Net worth** — the canonical runway (D-036). *(This page **completes a link that is already dead**: Net
  worth's runway card renders `<Link to="/cash-flow">Edit obligations →</Link>` (`NetWorth.tsx:258`) and
  `/cash-flow` **does not exist yet** — it renders `NotBuilt`. **Gate C3** forbids shipping dead nav links.)*
- **Review** — the page that summarises this one's goal/obligation/runway signals (D-038).

**Enforcement corollary (P-1/D-031):** Review's `sections.goals` and its goal/obligation/runway attention
items are produced by **`goals_report` / `obligations_report` / `runway_report`** — **this page's own
readers** (`review.py:21,24,114,123,149`). The reconciliation therefore holds **by construction**, exactly
as Policy↔Review does. Acceptance **demonstrates it live** (the ND-3 *demonstrate-not-prose* rule).

---

## 3. API SURFACE

### 3a. Endpoints consumed (already in the frozen contract)

**All nine paths are in the frozen baseline.** The page needs **no new endpoint to read or to write**.

| Method + path | Purpose on this page | Response shape pinned? |
|---------------|----------------------|------------------------|
| `GET /api/v1/goals` | Goals + live progress | **In the contract; untyped** (bare `dict`). Shape: §10-1. |
| `POST /api/v1/goals` · `PATCH /api/v1/goals/{id}` · `DELETE /api/v1/goals/{id}` | Goal CRUD — **PIN-gated** (`require_auth`) | Typed request (`GoalIn`). **`DELETE` is a HARD delete** (§10-7). |
| `GET /api/v1/obligations` | Obligations + next-12m total | **In the contract; untyped.** |
| `POST` · `PATCH /{id}` · `DELETE /{id}` `/api/v1/obligations` | Obligation CRUD — **PIN-gated** | Typed (`ObligationIn`). |
| `GET /api/v1/contributions` | Contributions + monthly-equivalent totals | **In the contract; untyped.** |
| `POST` · `PATCH /{cid}` · `DELETE /{cid}` `/api/v1/contributions` | Contribution CRUD — **PIN-gated** | Typed (`ContributionIn`). |
| `GET /api/v1/portfolio/runway` | The **summarised** runway (Net worth's canonical reader) | **In the contract.** |
| `GET /api/v1/refdata` | `goal_basis` · `obligation_recurrence` · `obligation_kind` · `contribution_frequency` · `contribution_kind` (D-005) | **In the contract**, with served `{value,label}` display labels. |
| *(currency)* | `/refdata` → **`currency`** (the master, per the MASTER-DATA §3 amendment) | **In the contract** (added at the Policy build). |

### 3b. Contract deltas (needed but not in the baseline — BUILD BACKEND-FIRST)

> **⚠ Verify-first divergence flag.** As with Policy, the premise "does a reader exist?" resolves **in the
> page's favour** — readers **and** per-row write paths both exist and are both frozen. **Every row below is
> a GUARD / HONESTY / D-105 delta found by auditing what the readers *guard*, not what they *return*.**

**Every row is PROPOSED and GATED on its §9 item. None is approved.**

| kind | Endpoint (current → intended) | Decision | Why this page needs it |
|------|-------------------------------|----------|------------------------|
| **test-only** | **PIN the two §0-protected D-057 invariants in code** | **§9-1** (D-057 §0; the **D-084 rule**) | **The highest-value delta and it changes no shape.** Neither invariant has a test (§10-2c): nothing fails if a refactor makes contributions reduce the runway, or lets a `once` obligation into the burn. **A ratified semantic with no code test is a sentence the code is free to break.** Fail-first, both directions. |
| **reshape** | `GET /obligations`, `GET /contributions` — **serve a per-row `monthly_equivalent`** (+ `_display`) | **§9-4** (no client money math) | The page wants to show *"≈ 500/month"* per row. **It is not served** — only the totals are (§10-5). Computing it in the UI is **client money math**, forbidden by CLAUDE.md. The factor already exists server-side (`MONTHLY_FACTOR`, `_FREQ_MONTHLY`) — **it must be applied there, not here.** |
| **reshape** | `GET /goals`, `/obligations`, `/contributions`, `/portfolio/runway` — **serve `*_display` money strings** | **§9-5** (**D-105 scope amendment**, ratified 2026-07-15) | Every money figure is a **raw float** (`_q()` / `float(round(...))`). D-105 now binds **all money**, not just quote prices: the backend formats, the frontend renders **verbatim**. Same delta the Policy build shipped. |
| **behaviour** | `POST/PATCH /goals`, `/obligations`, `/contributions` — **served 400 `detail` is USER copy** | **§9-6** (§12po1-6, app-wide) | Still leaking field names: *"kind must be one of ('expense','income')"* (`planning.py:45`), *"basis must be one of …"* (`:64`), *"recurrence must be one of …"* (`:107`). **The Policy walk already ruled this class of defect** — it is fixed at the source, app-wide, and this page's endpoints were **not** in that sweep. |
| **behaviour** | `DELETE /{id}` — **404 on a missing record** (currently a silent `200 {"ok": true}`) | **§9-7** | `delete_goal` / `delete_obligation` (`planning.py:88-93`, `:139-144`) **return `ok: true` for an id that never existed**. The UI cannot distinguish *"deleted"* from *"there was nothing there"* — an honesty hole on the platform's **first destructive action**. *(`delete_contribution` behaves the same.)* |
| **doc-only** | **API-CONTRACT.md** — add the nine planning paths as **`present`** rows | **§9-9** | Frozen in the **JSON**, absent from the **.md** delta table — the same documentation gap the Policy pass found. **No contract change.** |

**Note (typed responses).** All three GET routes return bare `dict`s. **Typing is DEFERRED** for the same
reason as Policy §9-10 — a `response_model` **silently strips undeclared keys**, and this batch would be
*adding* served fields. It is recorded in `08-TECH-DEBT.md`, not bundled here.

---

## 4. COMPONENTS

| Ratified component | Role on this page | Data source | Prop/state not exercised at kitchen-sink |
|--------------------|-------------------|-------------|------------------------------------------|
| **PageHeader** | H1 "Cash flow" + subtitle; `actions` = the [S]-gated add entry point(s) | — | state-adaptive verb per §12po1-2 |
| **DataTable** | **Three tables** — Goals · Obligations · Contributions | the three readers (**real**) | `footer?` for the served **totals** rows |
| **Dialog** | The **CRUD editor** — **one record at a time** (§9-2), the Worklist standard | — | `size` (`md`/`lg`) |
| **RowMenu** | Per-row **Edit / Delete** (the Worklist standard — never wide action columns) | — | — |
| **ConfirmDialog** | **Delete confirmation** — `destructive` variant (§9-7) | — | ⚠ **`requirePin` is NOT needed** (`require_auth` is an **ambient PIN session**, D-103 — the Policy §9-1 precedent) |
| **MoneyInput** | `amount` / `target_amount` — **the only** control for money entry | — | currency pairing |
| **DateInput** | `due_date` (required) · `target_date` (optional) · `start_date` (optional) | — | — |
| **MasterSelect** | `basis` · `recurrence` · `kind` (obligation) · `frequency` · `kind` (contribution) · `currency` | `/refdata` (**real**) | — |
| **TextInput** | `name`, `note` (free text — not categorical) | — | `maxLength` (80 / 120 / 1000 / 2000, per the schemas) |
| **Switch** | Contribution **`active`** (a boolean) | — | — |
| **Select** | Contribution → **`target_goal_id`** — a **user-record** picker (a list of the user's goals), **NOT** a master (§5) | `/goals` (**real**) | the "no goal" option |
| **StatusChip** | ⚠ **Only where a status genuinely exists** — the **runway status** (`no_data`/`positive`/`finite`) if §9-3 shows it, and *possibly* obligation `kind`. **NOT invented per row.** | served | Policy is barred from `positive`/`negative`; **this page is not** — a runway status genuinely *is* good/bad (§9-11) |
| **Segmented** | **Only if §9-10 rules the three resources are TABBED** rather than stacked | client view state | per-tab counts (`lf-segbtn__count`) |
| **EmptyState** | **Three of them** — the state a fresh install shows for **all three** lists (§9-8) | — | the `action` slot |
| **Skeleton** | Per-card progressive loading — **four independent readers**, never one `Promise.all` gate | — | — |
| **GlossaryTerm** | `[Help]` — Goal · Obligation · Contribution · Cash runway are **already in GLOSSARY**; the burn/monthly terms are **not** (§9-12) | GLOSSARY | — |
| **ToastProvider** | Save / delete outcome | — | — |

**Data source.** Every affordance is wired to a **real endpoint**. **No mock-backed affordance.**

**Affordances the ratified inventory lacks:** **none identified.** The **`Dialog` + `RowMenu` +
`ConfirmDialog` + `MoneyInput`/`DateInput`/`MasterSelect`** set already covers per-row CRUD. *(If the walk
disagrees, it is a §5 amendment — build does not start on it.)*

**Component usage rules the build must honour**

- **The Policy editor patterns carry over — but as PATTERNS, not as a shape.** The **grid-row layout**
  (§12po2-3: one shared grid template so columns align), the **served-validation-copy** posture (§12po1-6),
  the **dialog-is-THE-scroll-container** rule (§13-4), the **unified input focus** (§12po1-10) and the
  **icon+label button** treatment (§12po3-1) all apply. **The bulk-replace SHAPE does not** — it followed
  from Policy's endpoint being atomic, and these are not (§9-2).
- ⚠ **Icon+label buttons: this page would be the THIRD** (Review's *Mark reviewed* · Policy's *Edit policy*
  · Cash flow's *Add …*). **The centralization rule then TRIGGERS: extract the shared treatment** into
  `src/components/ui/` + a DESIGN-SYSTEM amendment (the `Segmented`/`StatusChip` precedent). **This is a
  Phase-0a item, recorded now so it is not missed** (§9-13).
- **Cards are LAYERED (D-100)**; **scroll = content only (D-101)**; **row actions in a `RowMenu`**.
- **`Contribution.target_goal_id` is a SOFT link** (`models:608` — an `Integer`, **no FK**). A contribution
  may therefore point at a **deleted goal**. The UI must render that honestly (**"—"**, never a fabricated
  name, and never a broken link) — §9-7.

**Tables — dataset-size posture (D-094):** **all three are BOUNDED** (a household's goals, obligations and
contributions are tens of rows; the readers return the full set with no pagination). **Sort and filter
execute client-side.** Revisit threshold: **~200 rows** in any one list. Each table keeps the `DataTable`
default cap (`--table-max-h`, 60vh, sticky header, internal scroll).

---

## 4b. PER-VARIANT FIELD & ACTION SPECS

**The page has THREE record types, and they are not variants of one entity** — they have different fields,
different vocabularies and different meanings. The matrix is filled so a generic "add record" form cannot be
improvised (the D-089/D-090/D-091 lesson).

| Record | Actions | REQUIRED fields | OPTIONAL-PROMPTED | Served by |
|--------|---------|-----------------|-------------------|-----------|
| **Goal** | add · edit · delete | `name` (1–80), `target_amount` (**> 0**), `basis` (**MasterSelect → `goal_basis`**: net_worth / liquid / **none**) | `target_date`, `currency`, `note` (≤1000) | `/refdata` → `goal_basis`; currency master |
| **Obligation** | add · edit · delete | `name` (1–80), `amount` (**> 0**), **`due_date` (REQUIRED — 10 chars)**, `recurrence` (**→ `obligation_recurrence`**: once / monthly / quarterly / annual), **`kind` (→ `obligation_kind`: expense / income)** | `currency`, `note` (≤1000) | `/refdata` |
| **Contribution** | add · edit · delete | `name` (≤120), `amount`, `frequency` (**→ `contribution_frequency`**), `kind` (**→ `contribution_kind`**: invest / withdraw / prepay) | `currency`, `target_goal_id` (**Select over the user's goals**), `start_date`, `active` (bool), `note` (≤2000) | `/refdata`; `/goals` |

- **`basis = none`** is a real, deliberate value: it means **no automatic progress** (`planning.py:78` —
  `current` is `None`, so `progress_pct` stays `null`). The form must **offer it**, and the table must render
  its progress as **"—"**, never `0%`. *A goal with no basis is not a goal at 0%.*
- **`kind = income` is how income EXISTS** (§10-4). The form presents it in the user's language, not as an
  enum key — and the amount stays **positive** (a negative amount is rejected: `amount: float = Field(gt=0)`).
- **Backend-served, frontend zero-copy (D-005).** All five vocabularies are **already served** by `/refdata`
  (`refdata.py:128-132`). **Zero new vocabulary work.**

---

## 5. VOCABULARIES

| Field | Vocabulary / master | Fixed (`/refdata`) or extensible | MASTER-DATA ref |
|-------|---------------------|----------------------------------|-----------------|
| `Goal.basis` | **Goal.basis** — 3 (`net_worth, liquid, none`) | **Fixed** — `/refdata` → `goal_basis` | MASTER-DATA §2 (D-010) |
| `Obligation.recurrence` | **Obligation.recurrence** — 4 (`once, monthly, quarterly, annual`) | **Fixed** — `obligation_recurrence` | MASTER-DATA §2 (D-010) |
| `Obligation.kind` | **Obligation.kind** — 2 (`expense, income`) | **Fixed** — `obligation_kind` | MASTER-DATA §2 (D-010) |
| `Contribution.frequency` | **Contribution.frequency** — 4 (`monthly, quarterly, annual, once`) | **Fixed** — `contribution_frequency` | MASTER-DATA §2 (D-010) |
| `Contribution.kind` | **Contribution.kind** — 3 (`invest, withdraw, prepay`) | **Fixed** — `contribution_kind` | MASTER-DATA §2 (D-010) |
| `currency` (all three) | **Currency master** = **`SUPPORTED_CURRENCIES`** (9) | **Fixed** — `/refdata` → `currency` | MASTER-DATA **§3 (AMENDED 2026-07-15)** — the master is the **constant**; the table it described **was never built** |

**Not a master (user data):** `name`, `note` (free text); **`target_goal_id`** — a picker over the **user's
own goals**, so it uses **`Select`**, not `MasterSelect` (the template's explicit carve-out).

⚠ **Two look-alike vocabularies must not be conflated** (MASTER-DATA §2 warns about this class):
**`Obligation.recurrence`** and **`Contribution.frequency`** hold the *same four values* but are **different
fields on different records** — and `once` means something **different in each**: for an obligation it means
*excluded from recurring burn* (**§0-protected**); for a contribution it means *monthly-equivalent = 0*
(`_FREQ_MONTHLY["once"] = ZERO`, `contributions.py:26`). **Do not share a single select model between them.**

⚠ **The write paths do NOT validate `currency` against the master.** `_norm_ccy` (`planning.py:48`) just
upper-cases whatever arrives; `contributions._apply` (`:58`) truncates to 3 chars. **This is the A9 defect,
in three more places** — a free-text categorical on a write path (§9-6).

---

## 6. DECISIONS IN FORCE

| Decision | What it forbids / requires on this page |
|----------|------------------------------------------|
| **D-057** *(§0-PROTECTED)* | **Contributions never reduce the runway. `once` obligations are excluded from recurring net burn.** Protected copy may not be removed. **Both are UNTESTED today — §9-1 pins them.** |
| **D-056** | The page is **"Cash flow"**; "Planning" is only the **group** name. Route `/cash-flow`; `/planning` **redirects**. |
| **D-036** | **Runway is canonical on NET WORTH.** This page **links** to it — it never computes a second runway. |
| **D-038 / P-1 / D-031** | Review summarises this page's goal/obligation/runway signals **via the same readers** (§10-3). A summary adds **no figure** the canonical page lacks. ⚠ **And this page must not re-derive Net worth's monthly figures from rows it happens to hold** (§2). |
| **D-005** | All five vocabularies + currency from `/refdata`. **No inline option list.** Served labels **verbatim**. |
| **D-105** *(SCOPE AMENDMENT, ratified 2026-07-15)* | **Money is formatted in the BACKEND and rendered verbatim — everywhere.** The frontend formats **no money**. Percentages stay client-side. → **§9-5**. |
| **CLAUDE.md hard rule** | **All money math is backend `Decimal`; the frontend never computes financial values.** → the per-row monthly-equivalent **must be served** (§9-4). |
| **D-065 / P-7** | Shipping **CRUD UI for an existing capability** adds no capability — it **passes the scope test** (the Entity-CRUD and Policy precedents). |
| **D-044** | Rotation-eligible; **empty pages are skipped** — and a fresh install is empty on all three lists. |
| **D-098** | An entity reference in a cell **links**. *(Here: a contribution's linked **goal** → its goal row. A **soft** link, so a dangling id renders as **"—"**, never a guessed route — §9-7.)* |
| **D-103 / D-002** | Mutations are **PIN-gated** (`require_auth`) — **ambient session**, so **no second PIN prompt** on save or delete. |
| **D-094** | Bounded tables → client-side sort/filter (§4). |
| **Guarantee 3** | Every empty region states a **reason**; **"—" never a fabricated number** — *a goal with `basis = none` has **no** progress, not 0%*. |
| **Guarantee 1** | The platform never executes trades and **never advises**. Goals show **progress, never "on track"**; the readers' disclaimers are **protected copy** (`planning.py:92`, `:129`, `runway.py:70`, `contributions.py:117`). |
| **TEMPLATE §13-1 / §13-2** *(new, from page-policy)* | **Assertions with teeth** (rendered artefact · seen RED on that exact state · the fixture that reproduces it) and **a silent no-op edit is a claim, not a change**. |

### Two threshold families — the Policy distinction applies here too

- **Family A — Review's app-authored constants:** **`_GOAL_SOON_DAYS = 180`**, `_OBLIGATION_SOON_DAYS = 30`,
  `_RUNWAY_LOW_MONTHS = 3` (D-084; PRODUCT-SPEC §5). **Canonical on REVIEW.** **User-configurability is
  ROADMAP R-15, PARKED.**
- **Family B — the user's own numbers:** every `amount`, `target_amount`, `target_date`, `due_date`.

**⇒ Every number the user TYPES here is Family B. The 180-day "goal soon" horizon is Family A and belongs to
Review** — §9-11 rules whether this page may even *display* it, and it may **never** offer to edit it.

---

## 7. ACCEPTANCE CRITERIA

- [ ] **Happy path:** all three lists render with their served rows and served totals.
- [ ] **§0-PROTECTED — D-057, PROVEN, NOT ASSERTED IN PROSE:**
      **(a)** adding a contribution of any size **changes `runway_months` by exactly nothing**;
      **(b)** a `once` obligation **contributes 0** to `net_monthly_burn` while still appearing in the
      next-12-months total. **Both fail-first, seen RED against a deliberately broken implementation.**
- [ ] **Single derivation (P-1/D-038):** the runway figures shown here are the **served** ones; a test
      demonstrates the page's numbers **==** Net worth's, **live** (the ND-3 posture).
- [ ] **No frontend money math:** the per-row monthly-equivalent is **served** (§9-4); every money figure is
      a **served display string** rendered verbatim (§9-5). **Grep the page for arithmetic on money.**
- [ ] **Honest "—" (Guarantee 3):** a goal with `basis = none` shows **"—"** for progress, **never 0%**; a
      contribution whose linked goal was deleted shows **"—"**, never a fabricated name or a broken link.
- [ ] **Empty states (×3):** the state a **fresh install** shows — each states a **reason** and offers the
      way forward (the Policy §9-13 pattern).
- [ ] **Deletion (the platform's first destructive UI action):** a **`ConfirmDialog` (destructive)** precedes
      it; the outcome is honest (§9-7); **no second PIN prompt** (ambient session, D-103).
- [ ] **Request-body assertion** (Holdings §9-35): the `POST`/`PATCH` body **equals the intended record** —
      not merely that a handler was called.
- [ ] **Vocabulary (D-005):** every categorical is a `MasterSelect` on the served vocabulary; **`recurrence`
      and `frequency` do not share a model** (§5).
- [ ] **Terms** match GLOSSARY exactly — including any added under §9-12 (**spec first**, then the popover
      store; the parity guard polices it).
- [ ] **Copy hygiene (§12po1-6):** **no served 400 names an internal field** (`kind`, `basis`, `recurrence`
      are *vocabulary* words — the **enum tuple** printed raw is the defect).
- [ ] **ASSERTIONS WITH TEETH (TEMPLATE §13-1):** every owner-visible defect's guard is written against the
      **rendered** artefact, **seen RED on that exact state**, and carries the **fixture that reproduces it**.
- [ ] **Both densities · both themes · keyboard · WCAG AA**; interactive **open** states verified in both
      themes (the `MasterSelect` dropdown **inside the Dialog** — the popover-in-dialog rule).
- [ ] **Rendered layout verification (ADR-0004):** `/cash-flow` added to the **overflow + single-scroll**
      suite (320/375/900/1366 × both themes) **and** to the **shared `.lf-page` shell** and **themed-link**
      cross-page guards (§12po1-1 / §12po1-7 — a new page must satisfy them **by existing**).
- [ ] **Dead link closed:** Net worth's **"Edit obligations →"** now resolves (Gate C3).
- [ ] **Export: NOT built** (§9-14 — expected DECLINED).

---

## 8. BUILD PHASES

- **Phase 0 — Contract deltas (§3b), backend-first, contract regenerated in the SAME commit.** **Start with
  §9-1 (the D-057 pinning tests) — they are fail-first and they change no shape**, so they can and should
  land before anything else touches these services.
- **Phase 0a — DESIGN-SYSTEM §5 amendment: EXTRACT the icon+label button treatment** (the **3rd** occurrence
  — §9-13). Kitchen-sink specimen; **owner ratifies before assembly**. *(Skip only if §9-13 defers it.)*
- **Phase 1 — Page assembly.** Compose ratified components; per-card progressive loading; honest
  empty/error/"—" states.
- **Phase 2 — Tests.** The §7 criteria; the **D-057** guards; the **live Cash-flow↔Net-worth↔Review**
  reconciliation; extend the **overflow / single-scroll / shell / link** suites to `/cash-flow`.
- **Phase 3a — Scripted pre-pass, GREEN before the walk.** Live app + real backend on a **reset instance**
  (which is **empty** — so the empty states are the *first* thing it must drive), both themes × every
  breakpoint, **full CRUD round-trip incl. delete**, 0 console errors.
- **Phase 3b — Owner acceptance walk (LIVE) — JUDGMENT ITEMS ONLY.** **The owner closes the phase — never
  self-certify it.**

---

## 9. NEEDS DECISION — ✅ **RESOLVED, OWNER ONE-PASS 2026-07-15**

**All 15 items are ruled. Build is unblocked through Phase 0a — then it STOPS at the geometry gate.**
Rulings first; the **original questions, options and evidence are PRESERVED VERBATIM below** — a resolved
question keeps its reasoning, or the next reader inherits a verdict with no argument.

**Matched by NUMBER AND TOPIC before recording — all 15 agree; no mismatch, no STOP.**

| # | Topic | ✅ RULING (owner, 2026-07-15) |
|---|-------|------------------------------|
| **9-1** | The two §0 D-057 invariants are untested | **PIN BOTH — fail-first, Phase 0, BEFORE any UI touches these services.** (a) adding a contribution leaves **`runway_months` unchanged**; (b) a **`once`** obligation contributes **0** to `net_monthly_burn` **but still appears** in the 12-month total. **Each seen RED against a deliberately broken implementation.** |
| **9-2** | Editor shape | **PER-ROW CRUD.** One `Dialog` per record; `RowMenu` → Edit / Delete. **No bulk replace, no contract change.** Policy's **grid / validation / scroll PATTERNS carry over; its SHAPE does not.** |
| **9-3** | Runway summary | **SHOWN** — the **served `runway_report`, rendered verbatim**, with a **D-100 canonical-home link to Net worth**. Pinned by a **live identity test**: this page's figures **==** Net worth's, from the **same reader**. |
| **9-4** | Per-row monthly-equivalent | **§3b RESHAPE — serve `monthly_equivalent` (+ `_display`) per row** on `/obligations` and `/contributions`. **Factors applied SERVER-SIDE.** Fail-first. |
| **9-5** | D-105 scope | **§3b — `*_display` served across ALL FOUR readers** (`format_money_display` already exists), **rendered verbatim**. |
| **9-6** | Validation copy + unvalidated currency | **Phase 0, AT THE SOURCE:** plain-language `detail` (**no raw tuples**) **+ `currency` validated ∈ the master → 400** on **all three** writers — **the A9 defect class, closed here too.** Strings **PROPOSED → walk.** **App-wide grep** for remaining raw-tuple details. |
| **9-7** | Deletion | **(a) `ConfirmDialog` (destructive)**, ambient PIN session, **no second prompt**. **Soft-delete + undo DECLINED for these resources — rationale recorded: they are trivially re-creatable rows. Undo parity tracks RISK (Holdings' transaction-bearing records), not affordance-for-its-own-sake.** **(b) §3b: `DELETE` of a missing id → honest 404** (200-ok-for-nothing is **RED today**). **(c) Goal delete WARNS with the LIVE contribution count** — *"N contributions point at this goal — they keep their records but lose the link"* (copy **PROPOSED**); an **orphaned `target_goal_id` renders "—", never a guessed route.** |
| **9-8** | Three empty states | **Per-list `EmptyState`** with a **reason + a way forward** (copy **PROPOSED → walk**). **NO first-run checklist step.** |
| **9-9** | Contract docs | **Nine `present` rows** in `API-CONTRACT.md`. **Doc-only.** |
| **9-10** | ⚠ **GEOMETRY RULING** | **THREE STACKED SECTIONS — Obligations · Contributions · Goals — + the 9-3 runway summary card.** Each table **internally capped/scrolled** (`--table-max-h`); **ONE page scroll region.** **GATE: Phase 0a ships a STATIC layout specimen at `/kitchen-sink`** (real-shaped data **incl. long lists**, **inside the real shell**, **both themes**). **STOP after Phase 0a for the owner's screenshot ratification BEFORE Phase 1 assembly.** |
| **9-11** | Goal-soon + runway status | **`days_to_target` displayed as a served FACT** (*"in N days"*). **NO "soon" flag here** — Review owns the threshold; **no Family-A constant is shown or editable on this page.** **The runway `StatusChip` MAY use `positive`/`negative`** — **ratified as the FIRST sanctioned use** (a cash fact implies no trade). **Policy's bar on those tones stands unchanged.** |
| **9-12** | GLOSSARY gaps | **Add: Net monthly burn · Monthly equivalent · Next 12 months · Planned cash out · Progress (goal).** **`docs/specs/GLOSSARY.md` FIRST**, then `mocks/glossary.ts` (parity guard). **PROPOSED → walk.** |
| **9-13** | Icon+label button (3rd occurrence) | **EXTRACT IT** — the **§12po3-1 trigger** fires. A `ui/` component + **DESIGN-SYSTEM amendment**, with **Review AND Policy MIGRATED onto it**, kitchen-sink specimen. **Ratify at walk.** |
| **9-14** | Export | **DECLINED** — the **Reports Pack** (D-061) is the home. |
| **9-15** | Entity scope | **HOUSEHOLD-ONLY by construction; no param added.** Per-entity planning → **ROADMAP** one-liner. |

**Execution order (owner):** **Phase 0** (9-1 **first**, then 9-4 · 9-5 · 9-6 · 9-7b · 9-9) → **Phase 0a**
(9-13 extraction + migrations; the 9-10 static specimen) → **STOP for the geometry ratification.**
**Phases 1–3a proceed only after it.**

---

### The original questions, options and evidence — PRESERVED


| # | Item | Why it blocks / what's needed | Proposed resolution (for owner to approve) |
|---|------|-------------------------------|---------------------------------------------|
| **9-1** | ⚠ **The two §0-PROTECTED D-057 invariants have NO pinning test.** | Both **hold in code** (§10-2) — but **by construction, not by contract**: `runway_report` simply never queries contributions, and `MONTHLY_FACTOR` simply has no `once` key. **Nothing fails if a future refactor changes either.** This is precisely the **D-084 lesson** (a ratified value/semantic with no code test is one the code is free to silently disagree with) — and these are **§0-protected**, the strongest class of guarantee the product makes. | **PIN BOTH, FAIL-FIRST, IN PHASE 0** — before any UI work touches these services. (a) add a contribution → **`runway_months` is unchanged**; (b) a `once` obligation → **contributes 0 to `net_monthly_burn`** but **still appears** in the 12-month total. Each **seen RED** against a deliberately broken implementation. |
| **9-2** | **Editor shape — per-row or bulk?** *(the headline shape question)* | **The evidence says per-row and it says so unambiguously:** all three resources serve **`POST` / `PATCH /{id}` / `DELETE /{id}`** (§10-1). **Policy's bulk-replace is NOT a precedent** — it followed from *its* endpoint being an atomic replace, and reasoning by habit here would invent a shape the API does not have. | **PER-ROW CRUD.** One **`Dialog`** editing **one record**; `RowMenu` → Edit / Delete. **No bulk replace, no contract change.** *(The Policy editor's grid/validation/scroll PATTERNS carry over; its SHAPE does not.)* |
| **9-3** | **Does this page show the runway figures at all — and if so, which?** | Net worth is the **canonical** runway (D-036), and this page **owns the obligations the runway is made of**. Showing `net_monthly_burn` here is genuinely useful (it is the *consequence* of the rows the user is editing) — but it is **Net worth's figure**, and the temptation to re-derive it from rows already in hand is **the A11 defect waiting to recur**. | **SHOW IT — as a SUMMARY, from the SERVED `runway_report`, with a canonical-home link to Net worth** (D-100: card header, top-right). **Never re-derived**, and pinned by a test that the two pages' numbers are **identical, live**. *(Alternative: show nothing and link only — cleaner P-1, but it hides the direct consequence of the user's own edits.)* |
| **9-4** | ⚠ **Per-row monthly-equivalent is NOT SERVED.** | The page wants *"≈ 500/month"* on each recurring row. The readers serve **only the totals** (§10-5). Computing it client-side is **money math in the frontend** — forbidden outright. | **§3b reshape: serve `monthly_equivalent` (+ `_display`) per row** on `/obligations` and `/contributions`. The factors already exist server-side (`MONTHLY_FACTOR`, `_FREQ_MONTHLY`) — **apply them there.** *(Rejecting this means the column cannot exist.)* |
| **9-5** | **D-105 scope amendment binds this page.** | Every money figure is a **raw float**. The amendment (ratified **2026-07-15**) makes money a **served display string everywhere**. | **§3b reshape: serve `*_display`** across all four readers, rendered **verbatim** — the delta Policy already shipped (`format_money_display` exists). |
| **9-6** | ⚠ **Served validation copy leaks internals — AND `currency` is unvalidated.** | *"kind must be one of ('expense', 'income')"* prints a **raw Python tuple** to a human (`planning.py:45,64,107`). Separately, **`currency` is never checked against the master** in any of the three writers (§5) — **the A9 defect, three more times**. | **Fix both at the SOURCE, Phase 0** (the §12po1-6 ruling is already app-wide): plain-language `detail`, and **validate `currency` ∈ the master → 400**. Strings **PROPOSED → ratify at the walk**. |
| **9-7** | ⚠ **Deletion: hard, silent, and the platform's FIRST destructive UI action.** | Three sub-problems: **(a)** `DELETE` is a **hard delete with no undo** — Holdings has **soft-delete + 10s undo**, this has neither; **(b)** deleting a **non-existent** id returns **`200 {"ok": true}`** — the UI cannot tell "deleted" from "never existed"; **(c)** `Contribution.target_goal_id` is a **soft link with no FK**, so deleting a goal **silently orphans** contributions pointing at it. | **(a) `ConfirmDialog` (destructive), no PIN prompt** (ambient session, D-103) — **and record whether soft-delete+undo is owed here** (parity with Holdings) or deliberately declined. **(b) §3b: honest `404`.** **(c) The UI renders an orphaned link as "—"**, never a guessed route; **and the owner rules whether deleting a goal should warn** that N contributions point at it. |
| **9-8** | **Three empty states — and a fresh install shows all three at once.** | Nothing is seeded: a new user lands on a page that is **entirely empty**. This is the **most-seen state**, not an edge case (the Policy §9-13 lesson). | Per-list **`EmptyState`** with a **reason + a way forward** (PROPOSED copy, ratify at walk). **NO first-run checklist step** (the checklist stays minimal, D-045 — the Policy precedent). |
| **9-9** | **API-CONTRACT.md never lists the nine planning paths.** | Frozen in the JSON, absent from the .md delta table — the same doc gap Policy found. | **Nine `present` rows.** **Doc-only, no contract change.** |
| **9-10** | **Page composition: three stacked sections, or a `Segmented` switcher?** | Three tables + summary + totals is a **long** page — exactly the content that trips the single-vertical-scroll invariant. Policy chose `Segmented`. **But these three are not three views of one thing** (as Policy's dimensions were) — they are **three different record types** the user may want to see **together**. **A widget list is not a layout** — this is a **geometry ruling, and the owner makes it.** | **PROPOSE: three STACKED sections** (they are not alternatives to each other; a user reasoning about cash flow wants obligations *and* contributions in view), with **each table internally capped/scrolled** so the page keeps **one** scroll region. **If stacked is ruled, the layout needs a grid map + geometry gate before assembly**, measured **inside the real shell** with **real-shaped data**. |
| **9-11** | **Goal-soon (180d) and runway-status display.** | `_GOAL_SOON_DAYS = 180` is a **Family-A** constant, canonical on **Review**. `days_to_target` **is** served per goal (`planning.py:87`). May this page **flag** a goal as "soon" — and if so, whose threshold is it? Separately: may the runway `StatusChip` use **positive/negative** tones (Policy is barred from them — but a runway status genuinely *is* good/bad)? | **Show the served `days_to_target` as a FACT** (e.g. "in 120 days") **and do NOT flag "soon" here** — the *judgement* belongs to Review, which owns the threshold. **This page never displays or offers to edit a Family-A constant.** **Runway status MAY use positive/negative** (unlike Policy: there is no trade being implied — only a cash fact). |
| **9-12** | **GLOSSARY gaps.** | **Present:** *Goal* · *Obligation* · *Contribution* · *Cash runway* · *Liquid* · *Liquidity ladder*. **MISSING**, and all displayed: **Net monthly burn** · **Monthly equivalent** · **Next 12 months** · **Planned cash out** · **Progress** (a goal's). | **Add to `docs/specs/GLOSSARY.md` FIRST, then `mocks/glossary.ts`** (the two-store rule; the parity guard polices it). **All PROPOSED → owner ratifies at the walk.** |
| **9-13** | ⚠ **The icon+label button reaches its THIRD occurrence here.** | Review (*Mark reviewed*) · Policy (*Edit policy*) · Cash flow (*Add goal/obligation/contribution*). **page-policy §12po3-1 recorded the trigger explicitly: the 3rd occurrence EXTRACTS the shared treatment.** | **EXTRACT it in Phase 0a** — a ratified button-with-icon treatment in `src/components/ui/` + a DESIGN-SYSTEM amendment, with **Review and Policy migrated onto it** (the `Segmented`/`StatusChip` precedent: *per-instance copies of a standard are the defect*). **Owner ratifies at the walk.** |
| **9-14** | **Export?** | Every Reports-adjacent surface exports server-side (P-5). There is **no** planning export endpoint. | **DECLINE** — the **Reports Pack** (D-061) is the export home, composed from these canonical readers. **No §3b delta.** *(Expected outcome — recorded so it is a decision, not an omission.)* |
| **9-15** | **Entity scope.** | **None of the three models has an entity FK**, and **no endpoint accepts `entity_id`** (§10-6). So the page is household-only **by construction** — but the **Policy §9-21 precedent** says the *absence* of a param is not the same as a *rejected* one. | **HOUSEHOLD-ONLY**, and **no param is added**. *(Unlike Policy, there is nothing to reject — the param never existed. Recorded so the next reader does not "add entity scoping" without a data-model change → **ROADMAP**.)* |

---

**Sign-off to start build:** §9 has no open blocker · §3b deltas are approved · no component in §4 requires an
unresolved amendment.

**Not signed off. §9 is open — 15 items. Nothing is built.**

---

## 10. VERIFY-FIRST RECORD (D-019)

*What the three readers **actually serve and actually guard**. Every claim carries a `file:line` cite.*

### 10-1. The three resources — per-row CRUD, PIN-gated, all frozen

**Nine paths, all in `API-CONTRACT.json`:** `/goals` `[get, post]` · `/goals/{goal_id}` `[patch, delete]` ·
`/obligations` `[get, post]` · `/obligations/{obligation_id}` `[patch, delete]` · `/contributions`
`[get, post]` · `/contributions/{cid}` `[patch, delete]` (+ `/portfolio/runway` `[get]`).

**Every mutation carries `dependencies=[Depends(require_auth)]`** (`planning.py:59,71,88,101,116,139,163,171,183`)
— the **[S]** gate, already in place, ambient PIN session (D-103).

**⇒ THE EDITOR SHAPE IS SETTLED BY EVIDENCE: PER-ROW.** There is **no** bulk endpoint. **Policy's
bulk-replace was a consequence of `PUT /policy/targets` being an atomic replace — that premise is absent
here, so the conclusion does not transfer.** (§9-2.)

**Served shapes:**

- **`GET /goals`** (`goals_report`, `planning.py:66`): `{base_currency, goals:[{id, name, basis, currency,
  target_amount, target_base, target_date, note, current_base, progress_pct, remaining_base,
  days_to_target}], disclaimer}`. **`current_base` / `progress_pct` / `remaining_base` are `null` when
  `basis = "none"`** (`:78` — `current` is `None`) **or when `target_base <= 0`**. *An honest null, not a 0.*
- **`GET /obligations`** (`:96`): `{base_currency, obligations:[{id, name, amount, currency, amount_base,
  due_date, recurrence, kind, note, occurrences_12m, next_due}], next_12m_total, disclaimer}`.
  **Only `kind == "expense"` counts toward `next_12m_total`** (`:120`) — income is excluded from the
  *outflow* total, correctly.
- **`GET /contributions`** (`contributions.py:95`): `{base_currency, contributions:[…], monthly_invest,
  monthly_withdraw, monthly_net_investing, monthly_cash_out_with_expenses, disclaimer}`.
- **`GET /portfolio/runway`** (`runway.py:27`): `{base_currency, liquid, monthly_expense, monthly_income,
  net_monthly_burn, runway_months, runway_date, status, note, disclaimer}`.

### 10-2. The D-057 invariants — BOTH HOLD, BY CONSTRUCTION ✅

**(a) Contributions never reduce the runway.** `runway_report` (`runway.py:27-47`) selects **`Obligation`
only** (`:29`). **It never queries the `Contribution` table at all** — there is no import, no join, no
filter. The invariant is not *enforced*; it is **structurally impossible to violate without adding code**.
The reverse dependency exists and is one-way: `contributions_report` **calls** `runway_report` (`:108`) to
show `monthly_cash_out_with_expenses` — *a fuller liquidity picture **without changing the runway itself***
(`contributions.py:115-116`, comment verbatim). **The direction of that dependency is the whole guarantee.**

**(b) `once` obligations are excluded from recurring net burn.** `MONTHLY_FACTOR` (`planning.py:26`) contains
**only** `monthly`/`quarterly`/`annual`. In `runway_report`: `factor = MONTHLY_FACTOR.get(o.recurrence)` →
**`None` for `once`** → **`continue`** (`runway.py:36-38`, comment: *"'once' is lumpy, not a steady burn"*).
A `once` obligation **still appears** in `obligations_report` and **still counts** toward `next_12m_total`
(`planning.py:120`) — which is correct: it is a **real** future outflow, just not a **recurring** one.

**⚠ 10-2c. NEITHER INVARIANT HAS A PINNING TEST. This is the pass's biggest finding.**
`tests/integration/test_runway.py` covers no_data / finite / positive / quarterly-normalisation /
kind-validation — **and nothing else**. Grep across `tests/`:
- **no test creates a contribution and asserts the runway is unchanged** → *zero results*;
- **no test creates a `once` obligation and asserts it contributes 0 to the burn** → *zero results* (the
  only `"once"` in the suite is a Review fixture, `test_review.py:28`).

**These are §0-PROTECTED semantics** (DECISIONS §0 lists them beside the not-a-Sharpe disclaimer and the
honest-NULL FX). **A ratified semantic with no code test is a sentence the code is free to silently
disagree with — the D-084 lesson, verbatim.** → **§9-1.**

### 10-3. Consumers — the single-derivation posture

| Consumer | Reader it calls | Cite |
|---|---|---|
| **Net worth** — the runway card | **`runway_report`** (via `GET /portfolio/runway`) | `NetWorth.tsx:79,240-258` |
| **Review** — goal-soon, obligation-soon, low-runway signals + `sections.goals` | **`goals_report` · `obligations_report` · `runway_report`** — **this page's own readers** | `review.py:21,24,114,123,149,275-278` |
| **Scenarios** — liquidity what-ifs | **`runway_report` · `obligations_report`** | `scenarios.py:16-18,69,72` |

**⇒ Every figure this page shares with Net worth, Review and Scenarios already flows from ONE reader per
figure.** The by-construction reconciliation holds **before a line is written**. The **risk** is purely
forward-looking: this page will hold the obligation rows in hand, and re-deriving `net_monthly_burn` from
them would be easy, would agree today, and would be **the A11 defect repeated** (§2, §9-3).

**⚠ 10-3b. Net worth's runway card links to a page that does not exist.** `NetWorth.tsx:258` renders
`<Link to="/cash-flow">Edit obligations →</Link>` — and `/cash-flow` is **not routed** (`nav.ts` has no
`built: true` for it; the route renders `NotBuilt`). **A dead nav/summary link in the shipped build is a
Gate-C3 failure.** Building this page **closes it**.

### 10-4. The income question — ANSWERED BY THE MODEL ✅ (nothing invented)

**Income is a FLAGGED OBLIGATION.** `Obligation.kind: Mapped[str] = mapped_column(String(8),
default="expense")  # expense|income` (`models:492`); the vocabulary is `OBLIGATION_KINDS = ("expense",
"income")` (`planning.py:25`) and is served by `/refdata` as **`obligation_kind`** (`refdata.py:130`).

It is **not** a signed amount: `ObligationIn.amount: float = Field(gt=0)` (`planning.py:35`) — **a negative
amount is rejected**. It is **not** a separate record type. `runway_report` branches on the flag
(`runway.py:41-44`): `income` accumulates `monthly_income`, everything else `monthly_expense`; the runway is
then `monthly_expense − monthly_income` (`:46`), and `obligations_report` excludes income from the
**outflow** total (`planning.py:120`).

**⇒ Net worth's copy — *"Add recurring obligations (and income)…"* (`runway.py:70`) — is describing the
`kind` flag.** **No record type is invented; the form simply offers the flag in plain language** (§4b).

### 10-5. ⚠ Monthly-equivalent: totals are SERVED, per-row is NOT — and money is raw floats

**Served (backend, correct):** `monthly_expense` · `monthly_income` · `net_monthly_burn` (`runway.py:64-67`)
· `monthly_invest` · `monthly_withdraw` · `monthly_net_investing` · `monthly_cash_out_with_expenses`
(`contributions.py:110-116`). Multi-currency → base is **server-side at today's FX** (`fx.convert`,
`planning.py:75,113`; `contributions._to_base:35`), **caveated in every disclaimer**.

**NOT served:** a **per-row `monthly_equivalent`**. The obligation rows carry `amount`, `amount_base`,
`recurrence`, `occurrences_12m` — **but no monthly figure**; contribution rows carry `amount`, `currency`,
`frequency` — **no monthly figure**. A *"≈ 500/month"* column would therefore be **`amount × factor`
computed in the browser** — **client money math, forbidden by CLAUDE.md's hard rule.** → **§9-4.**

**And all money is a raw float** (`_q()` → `float(round(...))`, `planning.py:62`; `float(round(...))`,
`contributions.py:110`). The **D-105 SCOPE AMENDMENT (ratified 2026-07-15)** makes money a **served display
string everywhere** — so all four readers need `*_display`, exactly as Policy's did. → **§9-5.**

### 10-6. Entity scope — household-only, by construction

`Goal` (`models:471`), `Obligation` (`:484`) and `Contribution` (`:600`) have **no entity FK**, and **no
endpoint accepts `entity_id`** (grep over `routes/planning.py`, `services/planning.py`, `contributions.py`,
`runway.py` → **zero hits**). **Nothing to scope and nothing to reject** — unlike Policy, where the param
existed and had to be turned into an honest 400 (§9-15).

### 10-7. ⚠ Deletion — hard, silent, and soft-linked

- **Hard delete, no undo.** `session.delete(...)` (`planning.py:91`, `:142`; `contributions.py:92`). **Holdings
  ships soft-delete + a 10s undo toast + purge-[PIN]; these endpoints have none of it.** This page would be
  the platform's **first explicit destructive UI action** — the parity question is **§9-7**.
- **A missing id deletes "successfully".** `delete_goal` (`:88-93`): `g = await session.get(...)`;
  `if g is not None: await session.delete(g)`; **`return {"ok": True}` regardless.** The UI **cannot
  distinguish** *deleted* from *never existed*. An honesty hole on a destructive action.
- **`Contribution.target_goal_id` is a SOFT link** — `mapped_column(Integer, nullable=True)  # soft link`
  (`models:608`). **No FK, no cascade.** Deleting a goal **silently orphans** every contribution pointing at
  it, and the UI must render that as **"—"**, never a fabricated name or a guessed route (D-098).

### 10-8. Goal semantics — display only what is served

`progress_pct` = `current / target_base × 100` where `current` is **`net_worth`** or **`liquid`** per the
goal's `basis`, or **`None`** when `basis = "none"` (`planning.py:78-85`). `days_to_target` is served when a
`target_date` exists (`:87-89`). `remaining_base` is served.

**There is NO funding linkage from contributions to goal progress.** `target_goal_id` is a **label**, not a
funding mechanism — **no code adds contributions into a goal's progress**. **A "goal funding" or "projected
completion" figure would be INVENTED, and is barred** (Guarantee 3; the disclaimer at `:91-93` says progress
is *"a fact against your target — not a forecast"*). **Display exactly what is served.**

### 10-9. Vocabulary status

**Masters — all five ALREADY SERVED** (`refdata.py:128-132`): `goal_basis` · `obligation_recurrence` ·
`obligation_kind` · `contribution_frequency` · `contribution_kind`; plus **`currency`** (added at the Policy
build). **Zero new vocabulary work.**

**GLOSSARY — present:** *Goal* (:178) · *Obligation* (:179, **and it states the `once` exclusion as protected
semantics**) · *Contribution* (:180, **and it states the runway exclusion**) · *Cash runway* (:177) · *Liquid*
(:176) · *Liquidity ladder* (:175).
**GLOSSARY — MISSING** (all displayed): **Net monthly burn** · **Monthly equivalent** · **Next 12 months** ·
**Planned cash out** · **Progress**. → **§9-12** (spec **first**, then the popover store).

### 10-10. ⚠ Served validation copy leaks internals — and `currency` is unvalidated

- `raise HTTPException(400, f"kind must be one of {OBLIGATION_KINDS}")` (`planning.py:45`) → prints a **raw
  Python tuple** to a human. Same at `:64` (`basis`) and `:107` (`recurrence`).
- **`currency` is never validated against the master.** `_norm_ccy` (`:48`) upper-cases whatever arrives;
  `contributions._apply` (`:58`) truncates to 3 chars. **A free-text categorical on a write path** — the
  **A9 defect, in three more places**, and the §12po1-6 ruling (fix at the source, app-wide) **did not reach
  these endpoints**. → **§9-6.**

---

## 11. BUILD RECORD — Phase 0 → Phase 0a (2026-07-15)

**Phase 0 (backend-first, contract regenerated in the same commit). All fail-first.**

| Item | RED evidence (before the fix) |
|------|-------------------------------|
| **9-1** — pin **both §0 D-057 invariants** *(shipped FIRST, alone, before anything else touched these services)* | Both invariants **held**, so the tests passed on first write — which proves nothing. **Seen RED against deliberately broken implementations:** letting contributions into the burn **collapsed the runway 60.4 → 1.2 months** (`assert 1.2 == 60.4`; `assert 152000.0 == 2000.0`); adding `"once"` to `MONTHLY_FACTOR` turned a one-off tax bill into a monthly burn (`assert 92000.0 == 2000.0`; `assert 90000.0 == 0`). **Both perturbations reverted.** |
| **9-4** — per-row `monthly_equivalent`, server-side | `KeyError: 'monthly_equivalent'` |
| **9-5** — `*_display` on all four readers (D-105) | `KeyError: 'target_base_display'` |
| **9-6** — user-plain `detail` + `currency` ∈ the master | `raw tuple served: "kind must be one of ('expense', 'income')"` |
| **9-7b** — `DELETE` of a missing id → 404 | `assert 200 == 404` |
| **9-9** | Nine `present` rows + the behaviour deltas (doc-only). |

**Two decisions inside 9-4 worth stating, because a "0" would have been the easy wrong answer:**
- A **`once` obligation serves `monthly_equivalent: null`, NOT `0`.** A one-off has **no monthly rate**;
  a served `0` would read as *"this costs nothing per month"*. **Excluded from the burn is not the same as
  free** (D-057). Same for a `once` contribution.
- A goal with **`basis = none`** serves **`null`** progress, not `0%`. *A goal without a basis is not a goal
  at zero* (Guarantee 3).

**⚠ A guard of mine was too crude, and I fixed the GUARD.** My first §9-6 assertion banned **apostrophes**
outright — which would also have banned **quoting the offending value** (`'zzz'`), i.e. *good copy*. It was
tightened to ban the **tuple/list literal** specifically. *The guard must catch the defect, not the good
copy that resembles it.*

**⚠ The app-wide grep 9-6 demanded found one more, outside this page:** `PUT /settings` served
*"unknown setting key(s): `['foo']`"* — a raw Python **list**. **Fixed in the same sweep** (the §12po1-6
rule is app-wide, and a copy fix is never only where it was spotted).

**Phase 0a**

- **9-13 — `Button` EXTRACTED** (DESIGN-SYSTEM §5.4 amendment, **PROPOSED**). The **3rd occurrence** fired
  the trigger page-policy §12po3-1 recorded. **Review's `.rv__markbtn`/`.rv__markicon` and Policy's
  `.pol__btn` are MIGRATED onto it and DELETED — none remains** (grep-verified). The **icon-button guard was
  RETARGETED at the shared class, not removed** — *a migration that drops its guard stops being proven* —
  and it **passes on both migrated buttons, both themes**.
- **9-10 — the STATIC LAYOUT SPECIMEN** ships at `/kitchen-sink`, in the **real content region**
  (1440×724 = viewport − chrome − shell padding), **both themes**, with **real-shaped data**: 12
  obligations · 7 contributions · 5 goals, long names, multi-currency, **a `once` row rendering "—"**, and
  **a basis-less goal rendering "—"**. The specimen **scrolls like the real page does** (the Home frame is
  `overflow: hidden` because that grid must *fit*; a worklist must not), and **each table caps and scrolls
  inside itself** — asserted: the 12-row list scrolls **within its own table**, so the **page keeps ONE
  scroll region**.

### ⚠ Two defects the guards caught in MY OWN specimen — both real, both mine

1. **I hand-rolled the ↗ summary link** (`.lf-summarylink` — which is `position: absolute`) inside an
   unpositioned header, and **the glyph ESCAPED ITS CARD**. This is **the exact defect that killed the
   first Home build** (§12ho1-4), and the **tile-integrity guard caught it**. Replaced with the **ratified
   `SummaryHead`**. *"There are no page-local variants" is the rule — and this is why.*
2. **I broke the Home-grid guard by ordinal position.** It located its frame with
   `querySelector(".ks__viewport")` — *"the first frame in the gallery"* — which **silently became a
   different specimen** the moment I added one above it. **Fixed to locate the Home frame by its CONTENT.**
   *A guard that depends on document order is a guard that quietly changes what it measures.*

### ⚠ FINDING — recorded, deliberately NOT fixed here

**`.lf-card__header` has no CSS rule at all.** `.lf-card` and `.lf-card__body` are ratified, but the card
**header** is **page-local on every page that has one** (`.nw__cardhead`, Pricing Health's, News's) — and
**Policy uses `.lf-card__header`, which styles nothing** (its stale chip falls under the title by accident,
not by design). That is a **centralization candidate** — but **Policy is an ACCEPTED page, and a geometry
gate is not the place to silently restyle it.** Cash flow uses its own `.cf__head` for now. **Owner's call.**

---

## 12. ⏸ STOP — GEOMETRY GATE (awaiting the owner's ratification)

**Phases 1–3a do not start until the owner ratifies the §9-10 geometry from the specimen.**

**To review:** `/kitchen-sink` → *"Cash flow — LAYOUT SPECIMEN (§9-10) — PROPOSED, AWAITING
RATIFICATION"*. Screenshots (both themes, top/mid/end) in `frontend/e2e/smoke/artifacts/cf-specimen-*.png`.

**What is being ratified:** three **stacked** sections (Obligations · Contributions · Goals) + the runway
summary card; each table **internally capped** (`--table-max-h: 22rem`) so the **page keeps one scroll
region**; the section header carrying **title + its total + the add action on one row**.

**Also pending ratification:** the `Button` extraction + both migrations · the empty-state copy (9-8) ·
the goal-delete warning copy (9-7c) · the GLOSSARY additions (9-12) · the §9-6 validation strings.

---

## 13. BUILD RECORD — Phases 1 → 3a (2026-07-15)

**Geometry gate PASSED** (owner, 2026-07-15) — the §9-10 three-stacked-sections layout was ratified from the
specimen and assembly proceeded.

**Phase 1 — assembly.** GLOSSARY **first**, then the popover store (5 terms; parity guard green). Per-row
CRUD (one `Dialog` per record, `RowMenu` → Edit/Delete), the runway **summarised** from Net worth's served
reader via `SummaryHead`, three empty states, `ConfirmDialog` for deletes with the **live orphan warning**.
Route + nav wired — **Net worth's "Edit obligations →" is no longer a dead link** (Gate C3).

**Phase 2 — tests (10 frontend + the backend suite), every guard PROVEN RED on the defect it exists to catch.**

| Guard | Mutation → RED |
|---|---|
| **D-057 — a `once` obligation has NO monthly rate** | rendering `?? "0.00"` instead of the em dash → **`expected '0.00' to be '—'`** |
| **§9-2 — per-row CRUD, not bulk** | making the editor always `POST` instead of `PATCH`-ing the row → **`expected 'POST' to be 'PATCH'`** |

Also pinned: served money rendered **verbatim**; a basis-less goal shows **"—", never 0%**; an **orphaned**
contribution shows **"—"**, never a fabricated goal name; the **protected D-057 copy** is on the page; the
request **body** equals the intended record; the served validation error renders **in place** with the
dialog **open**; all three empty states. `/cash-flow` added to the **overflow · single-scroll · shared-shell
· themed-link** cross-page guards.

**Phase 3a — pre-pass GREEN on a live reset instance.** Empty states → full CRUD round-trip against the real
PIN-gated write path → **D-057 verified LIVE** (a **100,000/month** contribution did **not** move the runway;
the one-off tax bill is **absent from the burn**) → the runway summary **==** Net worth's served figure →
`DELETE` of a missing id is an honest **404** → geometry clean at 320/375/900/1366 × both themes →
**0 console errors**.

### Three of my own mistakes, recorded

1. **My test assertions were sloppy, not the page.** `"18,400.00"` **contains** the substring `"0.00"`, so
   *"the row must not contain 0.00"* failed on a **correct** page; and *"House deposit"* appears in **both**
   the goals table and the contributions "Towards" cell, so a page-wide query silently measured the **wrong
   table**. Both were rewritten to assert **the specific cell in the specific section**.
2. **A real copy bug, caught by a test:** the goal-delete warning rendered *"**1 contribution point** at this
   goal"* — I pluralised the noun and not the verb. Fixed to *"1 contribution **points** … it keeps its
   record but loses the link"*.
3. ⚠ **The pre-pass raced a progressively-loaded card — the very race the template warns about (§12-8).** I
   asserted as soon as the runway card was *"visible"*, but a card's **header** is visible while its **body**
   is still loading, so it read back just `"Cash runway"` and failed **on a page that was fine**. Fixed to
   **wait the card out of its skeleton** first. *(And the pre-pass was **not idempotent**: `reset.py` clears
   settings and the PIN but **not** these records, so a second run's "empty state" claim was false. It now
   **establishes its own precondition** — a pre-pass that only works once is not a pre-pass.)*

### For the walk — pending ratification

The `Button` extraction + both migrations · the **empty-state copy** (9-8) · the **goal-delete warning copy**
(9-7c) · the **5 GLOSSARY terms** (9-12) · the **§9-6 validation strings** · the **first sanctioned use of
`StatusChip` positive/negative** on the runway status (9-11).

**Noted, not fixed:** `Next due` / `Target date` render the **served ISO date** (`2026-09-30`) rather than a
formatted date. D-105 covers **money**, not dates, so this is a **copy/polish judgement for the owner**, not
a defect — raised rather than silently changed.

**Phase 3b (owner acceptance walk) is the gate. Nothing here is self-certified.**

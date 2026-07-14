# page-policy — build plan (PLAN ONLY — nothing is built)

**Status: DRAFT · §9 AWAITING THE OWNER'S ONE-PASS · ▶ NEXT IN THE QUEUE (RD-9 Timing Amendment 3, owner
2026-07-14).**

> **Policy RESUMES FIRST.** Amendment 3 makes the release gate **full completion**, so the Planning group
> returns to the **front** of the queue in merit order — Policy leads it. *(Amendment 2 had parked this
> page post-release; that ruling is superseded.)* **The §9 one-pass is the next task.**
>
> **Three of this plan's findings were never parked with the page.** **A9/A10/A11** (this plan's §10-8,
> §10-7 and §10-4) were defects in the **release-set engine** that Review already ships, so the owner
> approved them as a **Gate-A addendum**. They are **fixed, fail-first** — see **§10-A**. *A parked page
> does not park its engine's defects.*
>
> **§9 now stands at 21 items with THREE CLOSED:**
> - **§9-4 CLOSED** by **A11** (one weight derivation) — *and its consequence is live:* §2's conditional
>   Portfolio cross-link is now **unblocked**.
> - **§9-7 CLOSED** by **A9** (bucket master validation).
> - **§9-5 CLOSED** by **A10 + the owner's wording ratification (2026-07-14)** — the copy and the served
>   fields are **RATIFIED as proposed**, and **no second Review attention item** is added (rationale:
>   the existing stale-prices signal already covers that surface; a second would double-report one fact).
>
> **⇒ 18 items remain for the one-pass.**
>
> ⚠ **Re-verify any remaining finding whose code changed since 2026-07-14** — three already did, and
> **§10-5b is still armed** (the payload still serves a **net** `total_value` beside **gross**-denominated
> weights; A11 gave the denominator one home but did **not** serve it).
> ⚠ **§5 and §9-14 are affected by a spec amendment:** MASTER-DATA §3 was **amended 2026-07-14** — the
> currency master is the **`SUPPORTED_CURRENCIES` constant (9 codes)**, not the reference table §5 cites.
> **There is no currency table.** Re-read §5's currency row against the amended spec.

Drafted 2026-07-14 from `TEMPLATE-page-build.md`. The **verify-first pass
(D-019) is done** — §10 records what the policy engine **actually serves and what it actually guards**,
with `file:line` cites. **The PAGE is not built.** Every ambiguity is in **§9**; the owner resolves them
**one-pass**. **I resolved none.**

Policy is the **Planning** group's keystone: IA §2 — `/policy`, Planning, *"Canonical home for
investment-policy intent and drift (computed live)."* It is the **only** page that owns the user's
**intent**; Review, the Reports Pack and Home all **summarise** it and never the reverse (IA §5, D-038).

**Headline of the verify-first pass — five findings, all in §9:**

1. ⚠ **The readers exist and are already frozen.** `GET /policy`, `GET /policy/drift`, `PUT /policy`,
   `PUT /policy/targets` are all **in `API-CONTRACT.json` today** (3 paths of 128). API-CONTRACT.**md**'s
   delta table simply never listed them (the inherited baseline already satisfied D-055, so no delta was
   ever written). The brief's "text search is inconclusive" resolves to a **documentation gap, not a code
   gap** (§10-1).
2. ⚠ **A PIN-gated write path already ships** (`require_auth`). PRODUCT-SPEC §5's *"the user's own policy
   bands"* is **real, not aspirational** — and since **nothing is seeded**, an un-edited policy has **zero
   targets**, so a read-only Policy page would render **permanently empty** (§10-2). Editing is not a
   nice-to-have; it is what makes the page exist.
3. ✅ **Policy↔Review is ONE derivation, by construction, today.** `review.py:22` imports
   `compute_drift` from `services/policy.py` — the ND-3 precedent holds with **no new work** (§10-3).
   One hygiene divergence found (Review re-derives `has_targets` locally, §10-3b).
4. ⚠ **The drift payload serves a NET total beside GROSS-denominated weights** — `total_value` is net of
   liabilities while every `%` divides by gross assets. Printing both reconciles to nothing the moment a
   mortgage exists (§10-5b). A Guarantee-3 defect waiting for a build to walk into it.
5. ⚠ **`bucket` is not validated against its dimension's master** on the write path — a free-text enum on
   a categorical field, against CLAUDE.md's hard rule (§10-8).

**D-055 audit result: served copy is CLEAN.** No served string names or implies a trade; there is **no
legacy v1 Policy UI** to audit (§10-6). One label risk (`gap_base`) is a §9 copy decision, not a free
choice at build time.

---

## 1. IDENTITY

*Source: INFORMATION-ARCHITECTURE.md §2 (page map), §3 (navigation + rotation); DESIGN-SYSTEM.md §3
(page templates). Copied, not presumed.*

| Field | Value | Spec ref |
|-------|-------|----------|
| Page name (H1 = nav label = route) | **Policy** | IA §2, D-022 |
| Route | **`/policy`** | IA §2 |
| Nav group | **Planning** (Review · Policy · Cash flow · Scenarios · Insurance · Estate) | IA §3 |
| Page template | **Worklist** — *"Primary DataTable(s) + row actions + CRUD editor, for records you manage or work through."* DESIGN-SYSTEM §3 **names Policy in the Worklist row explicitly** — not a presumption. | DESIGN-SYSTEM §3 |
| Rotation eligibility | **Eligible** — *"Any nav page is eligible"* (D-044). Note the corollary: *"rotation skips pages that error or are **empty**"* — a policy with **no targets is empty** (§10-2), so an un-configured Policy page is **skipped by construction**. Confirm in §9-11. | IA §3 (D-044) |
| One-line purpose | **Canonical home for investment-policy intent and drift (computed live).** | IA §2 |

---

## 2. OWNERSHIP TABLE

*Copied from INFORMATION-ARCHITECTURE.md §5 (Policy). Never re-derived.*

**Owns (canonical, authoritative, fully explained on this page):** — IA §5, D-055

- **Investment-policy intent** — the **target allocation** per dimension (`asset_class` / `currency` /
  `region`), the **tolerance bands** (`default_band_pct`, plus per-target `min_pct` / `max_pct`), the
  **optional concentration limit** (`max_position_pct`), and the policy's `name` / `base_currency` /
  `notes`.
- **Drift** — actual − target per bucket, **computed LIVE on every read, never stored** (D-055; proven
  in §10-5: there is no drift column in the data model at all).
- **Band status** per bucket (in band / over / under) and the **out-of-band** verdict.
- **Concentration breaches** against the user's own `max_position_pct`.
- **Coverage** and **untargeted buckets** (held-but-not-targeted) — the honest "your policy does not
  mention this" surface.
- **The protected disclaimer** — *"Reporting, never a trade instruction"* (D-055, IA §1: protected
  copy, may not be removed).

**Summarises (other pages' info — via the named reader, linked, never recomputed):**

IA §5 is explicit: **"Summarises: —. Drift is summarised *by* Review and the Reports Pack, not the
reverse."** Policy summarises **nothing** in the baseline design.

| Summary shown | Canonical page | Shared reader reused | Link target |
|---------------|----------------|----------------------|-------------|
| *(none in the baseline design)* | — | — | — |
| **⚠ CANDIDATE — stale/low-confidence input count** (gated on §9-5) | Pricing Health (D-038, D-072) | would be a **served** count on `/policy/drift`, or the ratified **shared `staleCount` store** (DESIGN-SYSTEM §5.2, Pricing Health §12ph1-1) — **never a second fetch** | `/pricing-health` |

**Links to:**

- **Review** (`/review`) — the page that summarises this one's drift verdict (D-038). The **inbound** link
  already exists in code: `Review.tsx:34` maps attention `area: "policy" → "/policy"`.
- **⚠ Portfolio** (`/portfolio`) — **only if §9-4 rules that Policy's `actual_pct` is Portfolio's
  allocation weight**, in which case the weight columns carry the canonical-home cross-link (D-100: card
  header, top-right). **Do not add this link before §9-4 is ruled** — it asserts an ownership
  relationship the owner has not yet decided.

**Enforcement corollary (P-1/D-031) — how this page honours it:**

Policy **owns everything it displays**, so the corollary binds the pages that summarise *it*, not this
page — with **two exceptions the build must not paper over**:

- **§10-3 (the Review seam):** Review's `sections.policy.out_of_band` and its policy attention items are
  produced by **`compute_drift` — this page's own reader** (`review.py:22`). The corollary therefore
  holds **by construction**, not by vigilance. Acceptance **demonstrates** it live (§7), following the
  ND-3 *demonstrate-not-prose* precedent.
- **⚠ §10-4 (the allocation seam):** Policy's per-bucket `actual_pct` for `asset_class` and `currency`
  is **the same figure Portfolio owns as "Allocation weight" (D-033)** — computed by **a second code
  path**. Whether that is a P-1 violation is **§9-4**. The build must not resolve it by silently
  rendering the number.

---

## 3. API SURFACE

*Source: `API-CONTRACT.json` (frozen baseline, 128 paths) + API-CONTRACT.md delta table.*

### 3a. Endpoints consumed (already in the frozen contract)

**All four policy paths are in the frozen baseline** (verified in `API-CONTRACT.json`, §10-1) — the page
needs **no new endpoint to render or to edit**.

| Method + path | Purpose on this page | Response shape pinned? |
|---------------|----------------------|------------------------|
| `GET /api/v1/policy` | **Intent** — the stored policy + its targets (the editor's source of truth) | **In the contract; untyped** (returns a bare `dict` — `routes/policy.py:46`). Shape from `policy_payload` (`services/policy.py:51`): `{name, base_currency, default_band_pct, max_position_pct, notes, targets:[{dimension,bucket,target_pct,min_pct,max_pct}]}` |
| `GET /api/v1/policy/drift` | **The page body** — live drift, band status, coverage, untargeted, concentration | **In the contract; untyped** (`routes/policy.py:52`). Full shape in §10-1. |
| `PUT /api/v1/policy` | Edit policy **meta** — name, base currency, `default_band_pct`, `max_position_pct` (0/None clears), notes | **In the contract**, typed request (`PolicyMetaIn`). **PIN-gated** (`require_auth`). |
| `PUT /api/v1/policy/targets` | Replace the **target set** — **bulk, atomic, all-or-nothing** (`replace_targets`, `services/policy.py:165`) | **In the contract**, typed request (`TargetsIn`, ≤200 targets). **PIN-gated**. **There is no per-row POST/PATCH/DELETE** — see §9-2. |
| `GET /api/v1/refdata` | `policy_dimension`, `asset_class`, `region` vocabularies for the editor's selects (D-005) | **In the contract**; served with `{value,label}` display labels. |
| *(currency master — its own endpoint)* | the `currency` dimension's bucket master (extensible; `refdata.py:114`) | **Confirm the exact path at Phase 0** — MASTER-DATA §3 governs; it is **not** in `/refdata`. |

### 3b. Contract deltas (needed but not in the baseline — BUILD BACKEND-FIRST)

> **⚠ Verify-first divergence flag (D-019, page-markets §13d).** The brief's premise — *"find the actual
> served surface; if no dedicated reader exists, that is a headline §9/§3b question"* — **diverges from
> reality in the page's favour**: a dedicated reader **and** a dedicated PIN-gated write path both exist
> and are both frozen. **§3b is therefore NOT a "the page has no reader" delta list.** Every row below is
> a **guard / honesty / hygiene** delta the verify-first pass found in a reader that already ships — the
> `page-news` lesson (*audit guards, not shapes*) is what produced this table, and it is the whole value
> of the pass.

**Every row is PROPOSED and GATED on its §9 item. None is approved. Do not build any of them until the
owner rules.** Each, if approved, is built **backend-first**, regenerating `API-CONTRACT.json` +
`docs/openapi.json` in the **same commit** (`make api-contract-check`).

| kind | Endpoint (current → intended) | Decision | Why this page needs it |
|------|-------------------------------|----------|------------------------|
| **reshape** | `GET /policy/drift` — **add `gross_assets`** (the actual denominator); **drop or relabel `total_value`** | **§9-3** (Guarantee 3; D-033) | The payload serves `total_value` = **net worth** (net of liabilities) beside percentages whose denominator is **gross assets** (§10-5b). A page showing both shows **two numbers that cannot be reconciled** whenever a liability exists. The page needs the number the weights are actually *of*. |
| **reshape** | `GET /policy/drift` — **serve money as display strings** (`gap_base_display`, `actual_value_display`, `value_display`) | **§9-6** (D-105) | D-105 ratified **money is formatted in the BACKEND; the frontend renders it verbatim** (the `price_display` precedent). The payload serves **raw floats** (`_q()`, `services/policy.py:34`), so a Policy page must format currency client-side — which D-105 removed the licence for. |
| **reshape** | `GET /policy/drift` — **serve a stale / low-confidence input count** | **§9-5** (Guarantee 3; D-038/D-072) | `compute_drift` surfaces **no staleness and no confidence at all** (§10-7). The page would print an out-of-band **verdict** derived from a **stale price** with **no flag** — Guarantee 3 says stale values are *flagged, never hidden*, and a derived verdict is not exempt. |
| **behaviour** | `PUT /policy/targets` — **validate `bucket` ∈ the dimension's master**; reject unknown buckets `400` | **§9-7** (CLAUDE.md hard rule; D-005; MASTER-DATA) | `replace_targets` validates the **dimension** but stores **`bucket` as free text** (`bucket[:40]`, `services/policy.py:189`) — a **free-text enum on a categorical field**, which the hard rule forbids. A UI select cannot fix a write path an API token can still call. |
| **hygiene** | `review.py:308` — read the **served** `drift["has_targets"]`, not a local re-derivation | **§9-8** (P-1/D-038) | Review re-expresses one fact in a second place (§10-3b). They agree today by coincidence of identical rules; nothing enforces it. |
| **doc-only** | **API-CONTRACT.md** — add the four policy paths as **`present`** rows | **§9-9** | The paths are in the frozen **JSON** but absent from the **.md** delta table, which is why a text search for "policy" reads as inconclusive. **No contract change** — a documentation repair so the next reader is not misled. |

**Note (typed responses).** Both GET routes return a bare `dict` (untyped). If §9 approves any reshape,
adding a `response_model` would be the moment to type them — but note the page-markets §12mk3-2 trap: a
`response_model` **silently strips any key it does not declare**. Typing these routes is **its own
decision** (§9-10), not a freebie bundled into a field addition.

**Note (a ratified backend VALUE needs a same-batch code test).** Nothing on this page is an app-authored
threshold (§6, "two threshold families") — every number is the **user's own** — so the D-084 trap does
not bite here. The one served *constant* is the `default_band_pct` **default of 5** (`models:442`); if
§9 ratifies that default, it ships a **code test pinning it in the same batch** as the spec edit.

---

## 4. COMPONENTS

*Source: DESIGN-SYSTEM.md §5 (ratified inventory). Only ratified components are listed.*

| Ratified component | Role on this page | Data source | Prop/state not exercised at kitchen-sink |
|--------------------|-------------------|-------------|------------------------------------------|
| **PageHeader** | H1 "Policy" + subtitle carrying the **protected D-055 line**; `actions` = the [S]-gated **Edit policy** entry point | — | subtitle carrying protected copy |
| **DataTable** | **The page body** — one table per dimension (`asset_class` / `currency` / `region`): bucket · target · actual · drift · band · gap. Plus the **concentration** table and the **untargeted** rows. | `GET /policy/drift` (**real**) | `footer?` for the **coverage** row (see below); band-status chip in a cell |
| **Segmented** | The **dimension switcher** (asset class / currency / region) if the three tables are switched rather than stacked — **§9-12 decides**; ratified for exactly this (page-news §13a) | client-side view state | count badges per segment (`lf-segbtn__count`) |
| **EmptyState** | **The first thing every new user sees** (§10-2): no policy defined → message + **reason** + `action` | `has_targets: false` | the `action` slot pointing at the editor / first-run checklist (§9-13) |
| **Skeleton** | Per-card progressive loading — the drift reader and the intent reader are **independent fetches**, never one `Promise.all` gate | — | — |
| **Dialog** | The **CRUD editor** container (the Worklist standard, DESIGN-SYSTEM §3) — policy meta + the target set | — | `size` (`lg` likely — a target row is dimension+bucket+3 percents) |
| **PercentInput** | **Every number the user types** — `target_pct`, `min_pct`, `max_pct`, `default_band_pct`, `max_position_pct`. §5.1 names this control's purpose verbatim: *"Targets, bands, thresholds"* | — | min/max clamping at 0–100 |
| **MasterSelect** | `dimension` (→ `policy_dimension`) and **`bucket` (→ the dimension's master)** — this **is** D-055's *"bucket becomes a select driven by the dimension's master"* | `/refdata` (**real**) + currency master | **switching `master` when the dimension changes** — and revalidating an already-typed bucket against the new master (§9-7) |
| **TextInput** | policy `name`, `notes` (free text, not categorical) | — | `maxLength` (80 / 2000, per `PolicyMetaIn`) |
| **RowMenu** | Per-target row actions (edit / remove) — the Worklist standard (⋯ overflow, never wide action columns) | — | — |
| **ConfirmDialog** | Removing a target / clearing the concentration limit, if destructive-confirm is wanted (§9-2) | — | `requirePin` is **not** needed — `require_auth` is ambient session (D-103) |
| **ToastProvider** | Save success / failure after a `PUT` | — | — |
| **GlossaryTerm** | `[Help]` popovers — **but see §9-14**: most of the terms this page shows are **not in GLOSSARY yet** | `GLOSSARY.md` → `mocks/glossary.ts` | — |
| **StalenessChip** | **Only if §9-5 approves** — flagging that a verdict rests on stale inputs | served stale count | — |

**Data source.** Every affordance above is wired to a **real endpoint** — `/policy`, `/policy/drift`,
`/refdata`, and the currency master. **There is no mock-backed affordance on this page**, which is the
direct payoff of the readers and the write path already existing (§10-1/§10-2).

### Affordances the ratified inventory lacks (amendment required before build — see §9)

- ⚠ **A status chip (band status: In band / Over / Under).** The ratified inventory has **exactly one**
  chip — `StalenessChip`, which is **stale-specific** (amber `--attention`, `badges.css:42`: *"amber
  attention only"*). There is **no general status chip**.
  **The precedent is a fork, and §9-15 must pick a side:**
  - **Follow the precedent as-is:** Pricing Health hand-rolled a page-local `ph__chip`; page-review's
    **ND-4 explicitly chose "a page-local severity chip … no amendment"**, and its colours were
    **RATIFIED 2026-07-13** (§12rv1-4: amber `--attention` for `Review`, **neutral** for `Info`). On that
    precedent Policy adds a page-local band chip and **needs no §5 amendment**.
  - **⚠ Or invoke the centralization rule — this is the 3rd recurrence.** A page-local chip would now
    exist in **three** places (`ph__chip` → review severity → policy band). **`Segmented` was extracted
    at exactly this threshold** (page-news §13a: *"Extracted because the pattern had recurred 3× … those
    page-local copies are removed and migrated"*), and DESIGN-SYSTEM §5.2 states the rule outright:
    *"per-instance copies of a standard are the defect."* By the project's own rule, **the third chip is
    the extraction trigger** — a ratified `StatusChip` (§5 amendment, Phase 0a, ratified at
    `/kitchen-sink`), with `ph__chip` and the review severity chip **migrated onto it**.

  **I do not resolve this.** It is a §5 amendment request (§9-15) and build does not start on it.

**Out-of-band colour treatment (PROPOSED — ratify at the walk, §9-16).** Semantic-only colour
(DESIGN-SYSTEM §1). The proposal: **amber `--attention`** for **both** `over` and `under` (they are the
same thing — *needs a look*), **neutral** for `in_band`. **Explicitly NOT `--gain` / `--loss`:** green/red
would encode "over = bad, under = good", which is a **valuation of the gap** and the nearest thing to a
trade implication a colour can carry (D-055). This mirrors the ratified severity treatment exactly
(amber attention / neutral).

### Component usage rules the build must honour

- **Cards are LAYERED (D-100)** — each dimension section is an `.lf-card` with its content in a
  `.lf-card__body`; any canonical-home cross-link sits in the **card header, top-right**.
- **Scroll = content only (D-101)** — the `DataTable` toolbar stays outside the scroll; only rows scroll.
- **Entity references link directly (D-098)** — the **concentration** table's `label` is a **holding**.
  If a symbol is available it links to `/instrument/{symbol}`. **⚠ But the payload serves only
  `h.name or h.label` — a display string, no symbol and no id** (`services/policy.py:147`). Linking would
  need a served identifier: that is a **contract delta**, so it is **§9-17**, not a build-time guess.
- **Row actions live in a `RowMenu`** — never wide always-visible action columns.
- **Coverage row → `DataTable` `footer?`** — `coverage_pct` (the sum of a dimension's targets) is a
  **reconciling total** of the target column. DESIGN-SYSTEM §5.2 (RATIFIED 2026-07-12): reconciling totals
  render as `<tfoot>` **inside the same table**, never a sibling totals block, *"so they share the body's
  column grid AND scroll gutter by construction."* Coverage ≠ 100% is a **fact to state honestly**, not
  an error to hide (a policy that targets 70% of the book is a legitimate policy — `test_policy.py:57`
  pins `coverage_pct == 70.0`).

**Tables — dataset-size posture (D-094):** **every table on this page is BOUNDED.** Targets are capped at
**200 by the contract** (`TargetsIn`, `routes/policy.py:42`) and realistically number in the tens (a
dimension has 13 / 6 / ~N buckets). Untargeted rows are bounded by the bucket count; concentration rows
are bounded by the holding count and are **only** the breaches. **Sort and filter therefore execute
client-side.** Revisit threshold: if any table exceeds **~200 rows** (only reachable via the concentration
table on a very large book with a very low limit), move to server-side. Every table keeps the `DataTable`
default cap (`--table-max-h`, `60vh`, sticky header, internal scroll).

---

## 4b. PER-VARIANT FIELD & ACTION SPECS

**The policy target IS a variant entity — the variant is the `dimension`,** and the fields it drives are
**which master the `bucket` select is bound to**. This is D-055's core requirement, so the matrix is
filled rather than skipped.

| Variant (`dimension`) | Actions/types offered | REQUIRED fields | OPTIONAL-PROMPTED fields | Served by |
|-----------------------|-----------------------|-----------------|--------------------------|-----------|
| **`asset_class`** | add / edit / remove a target | `bucket` (**MasterSelect → `asset_class`**, 13 values), `target_pct` | `min_pct`, `max_pct` (else `default_band_pct` applies — `services/policy.py:106`) | `/refdata` → `asset_class` (D-005) |
| **`currency`** | add / edit / remove a target | `bucket` (**MasterSelect → the currency master**, extensible), `target_pct` | `min_pct`, `max_pct` | **currency master — its own endpoint** (MASTER-DATA §3; `refdata.py:114`) |
| **`region`** | add / edit / remove a target | `bucket` (**MasterSelect → `region`**, the **6** D-083 buckets: India · Singapore · US · Europe · APAC · Other) | `min_pct`, `max_pct` | `/refdata` → `region` (D-007/D-083) |

- **Backend-served, frontend zero-copy (D-005).** All three masters are **already served**
  (`refdata.py:133-134` serves `policy_dimension` and `region`; `asset_class` at `:118`). **The frontend
  hardcodes none of them.** D-055's *"bucket = a select driven by the dimension's master"* is satisfiable
  with **zero new vocabulary work** — a clean verify-first result.
- **The band is a per-target OPTIONAL override of a policy-level default.** `min_pct`/`max_pct` null ⇒
  the band is `target ± default_band_pct`, **clamped to [0,100]** (`services/policy.py:106-109`). The
  editor must make that inheritance **visible** (a blank band field is not "no band" — it is "the default
  band"), or the user will misread it. Copy is **§9-18**.
- **Display variants.** `region` exists **only** as a policy dimension — Portfolio has no region donut
  (`routes/portfolio.py:120-122` serves class / currency / sector). So the region table is a figure this
  page **uniquely** shows, and §9-4's allocation question **does not touch it**.

---

## 5. VOCABULARIES

*Source: MASTER-DATA.md. Every categorical field → its vocabulary/master and its control.*

| Field on this page | Vocabulary / master | Fixed (`/refdata`) or extensible | MASTER-DATA ref |
|--------------------|---------------------|----------------------------------|-----------------|
| `dimension` | **PolicyTarget.dimension** — 3 values (`asset_class, currency, region`) | **Fixed** — `/refdata` → `policy_dimension` (`refdata.py:70,133`) | MASTER-DATA §2 (row: *PolicyTarget.dimension*, 02 §2.8) |
| `bucket` **when** `dimension = asset_class` | **AssetClass** — 13 values | **Fixed** — `/refdata` → `asset_class` | MASTER-DATA §2 (D-010) |
| `bucket` **when** `dimension = region` | **Region** — **6** values (D-083) | **Fixed** — `/refdata` → `region`. *"The six values below are the complete `region` vocabulary (used as a policy-dimension bucket set, D-055)"* — MASTER-DATA §4 names this page's use case verbatim. | MASTER-DATA §4 (D-007/D-083) |
| `bucket` **when** `dimension = currency` | **Currency master** | **Extensible** — its **own endpoint**, not `/refdata` (`refdata.py:114`) | MASTER-DATA §3 (D-006) |
| `base_currency` (policy meta) | **Currency master**, restricted to **`is_base_eligible = true`** | Extensible | MASTER-DATA §3 — *"Base-currency picker draws from `is_base_eligible = true` only"* |
| `status` (**served**, display) | `in_band` / `over` / `under` (`services/policy.py:110`) | **Served** — render as a **labelled chip, never the raw enum** (copy hygiene, page-chrome §11-8). **Not in GLOSSARY** → §9-14. | §10-10 |

**Not a master (user data / free text):** policy `name`, `notes`; the concentration table's `label` (a
holding's name — a name, not a vocabulary, exactly like `insured_person` under D-062).

⚠ **The write path does not enforce this table (§10-8).** `replace_targets` validates the **dimension**
against `DIMENSIONS` but stores **`bucket` as free text** (`services/policy.py:173-189`). A `MasterSelect`
in the UI does not close a hole in the API. **§9-7.**

---

## 6. DECISIONS IN FORCE

| Decision | What it forbids / requires on this page |
|----------|------------------------------------------|
| **D-055** (Policy page — KEEP) | **Drift computed live, never stored.** `bucket` is a **select driven by the dimension's master**. *"Reporting, never a trade instruction"* is **protected copy** (IA §1) — it may not be removed, and **no served string, label, chip, colour or empty-state may name or imply a trade** ("buy", "sell", "rebalance by X", "trim", "top up"). **Policy reports a gap. It never names a trade.** |
| **D-038 / P-1 / D-031** | Policy is **canonical** for intent + drift; **Review summarises it** via **the same reader** (`compute_drift` — §10-3), never a second code path. A summary may add **no figure** this page does not show. Corollary: **§9-4** — Policy's `actual_pct` must not become a *second* code path for **Portfolio's** canonical allocation weight. |
| **D-005** (frontend zero-copy) | Every vocabulary comes from `/refdata` / the masters. **No inline option list** for dimension, asset class, or region. Served labels render **verbatim**. |
| **D-065 / P-7** (scope test) | *"The rebuild adds no new capabilities, but **UI for existing capabilities that decided features depend on is in scope**."* The policy **write path already exists** (§10-2) — so shipping **policy editing UI adds no capability** and **passes P-7**, exactly as Entity CRUD did. This is the decision §9-1 turns on. |
| **Gross-asset invariant** (D-033; GLOSSARY *Allocation weight*) | Every weight, drift and concentration figure divides by **gross assets** (positive-value holdings only) — **a mortgage cannot distort a weight**. Confirmed in code (§10-5). Corollary the build must not break: **do not print a net total beside gross weights** (§9-3). |
| **D-044** (rotation) | Policy is rotation-eligible; rotation **skips empty pages** — an un-targeted policy is empty (§10-2). |
| **D-022** | Route = nav label = H1 = **"Policy"**. |
| **D-094** (table posture) | Every table's dataset-size assumption + sort/filter location is stated (§4): **all bounded, client-side**. |
| **D-098** (entity refs link) | The concentration row names a **holding** → it should link to its instrument. **Blocked: the payload serves no identifier** (§9-17). |
| **D-100 / D-101** | Layered cards; scroll = content only, header outside. |
| **D-105** (money = served display strings) | Money is formatted **in the backend**; the frontend renders it **verbatim**. The drift payload serves **raw floats** → **§9-6**. |
| **D-059 / D-084 / R-15** | **Cited to EXCLUDE, not to apply** — see the two-families rule below. **R-15 stays parked** and must not be referenced by this page. |
| **D-002 / D-103** | Mutations are **PIN-gated** (`require_auth`); unlocking grants **ambient session** access — it does **not** need a second PIN prompt on save (that is `requirePin`, reserved for purge). |
| **Product Guarantee 3** (honesty) | Every empty region states a **reason**; **stale values are flagged, never hidden** — including a **verdict derived from stale inputs** (**§9-5**); an insufficient input renders **"—"**, never a fabricated number. |

### The two threshold families — **these must never be conflated**

The page displays numbers that look alike and are governed by **completely different rules**. Stating
which family each displayed number belongs to is a **hard requirement of this plan**.

| | **Family A — Review's named constants** | **Family B — the user's OWN policy values** |
|---|---|---|
| **What** | `_LIQUID_THIN_PCT` (15), `_RUNWAY_LOW_MONTHS` (**3**), `_GOAL_SOON_DAYS` (**180**), `_OBLIGATION_SOON_DAYS` (30), `_OTHER_CLASS_OVERUSE_PCT` (**10**), … | `default_band_pct` (**5** by default), per-target `min_pct` / `max_pct`, `max_position_pct`, every `target_pct` |
| **Who sets them** | **The app.** Owner-set defaults (D-084/D-087), one **rationale each** (D-059) | **The user.** Stored per policy; **PIN-gated write path** (§10-2) |
| **Governing decisions** | D-059, D-084, D-087; PRODUCT-SPEC §5 | **D-055**; PRODUCT-SPEC §5's final row |
| **Canonical home** | **Review** (PRODUCT-SPEC §5 table) | **Policy — this page** |
| **User-configurable?** | **No — ROADMAP R-15, PARKED** | **Yes. Already. That is what the page is.** |

PRODUCT-SPEC §5's own table draws the line explicitly in its last row:

> | Policy band / concentration | **per-policy** | Out-of-band buckets; positions over `max_position_pct` | Uses **the user's own policy bands** and optional concentration limit — **no fixed number.** |

**Therefore, binding on the build:**

1. **Every number displayed on `/policy` is Family B.** There is no app-authored threshold on this page.
2. **R-15 does not apply here and must not be cited here.** R-15 parks making **Family A** configurable.
   Family B is **already** user-set by design — pointing R-15 at this page would promise a feature that
   already exists and imply the user's own bands are not yet editable.
3. **`/policy` must never display or offer to edit a Family-A constant** — those live on Review.
4. The one Family-A-*shaped* value in the policy engine is `default_band_pct`'s **default of 5**
   (`models/__init__.py:442`) — a **seed default for a user-owned value**, not a threshold. If §9 ratifies
   it, it ships a code test pinning it in the same batch (§3b note).

---

## 7. ACCEPTANCE CRITERIA

- [ ] **Happy path:** with targets set, each dimension table renders bucket · target · actual · drift ·
      band · gap; band status renders as a **labelled chip** (never the raw `in_band`/`over`/`under`);
      coverage renders as a `<tfoot>` row; untargeted buckets and concentration breaches render.
- [ ] **D-055 — NO TRADE LANGUAGE (protected).** The protected line renders. **Grep the rendered copy**
      for `buy`, `sell`, `rebalance`, `trim`, `top up`, `reduce`, `increase`, `adjust by` — **zero hits**
      in any label, chip, tooltip, empty state, aria-label or `[Help]` body. **The gap column's label is
      the ratified §9-19 string, and it is a *gap*, not an instruction.** This is a **standing test**, not
      a one-time check.
- [ ] **Gross-asset invariant (D-033) — proven, not asserted.** A fixture with a **large mortgage**
      (negative `market_value_base`, `asset_class = liability`) **changes no weight, no drift, no band
      status and no concentration figure** versus the same fixture without it. *A liability cannot distort
      a weight* — a fail-first test, seen RED against a net-denominator implementation.
- [ ] **Drift is LIVE (D-055).** Changing a holding's value changes the drift on the next read **with no
      write to any policy table** — and there is **no drift column** to write to (§10-5).
- [ ] **Policy↔Review reconciliation — DEMONSTRATED LIVE, not prose (the ND-3 precedent).** The count of
      out-of-band rows + concentration breaches **the Policy page displays** **==** Review's served
      `sections.policy.out_of_band`, on the same data, **in the running app**. By construction they share
      `compute_drift` (§10-3) — the test proves the construction was not broken.
- [ ] **Empty state (Guarantee 3):** with **no targets** — the state **every new user starts in** (§10-2)
      — the page shows a **reason** ("No policy defined"), not a blank or a fabricated 0%, and offers the
      §9-13 route forward.
- [ ] **Stale / low-confidence (Guarantee 3):** per §9-5 — a verdict resting on stale inputs is
      **flagged**, never silently printed as fact.
- [ ] **Error state:** each card fails independently with an honest error + retry; a failing drift read
      never blanks the intent card (per-card progressive loading, page-portfolio §12-8).
- [ ] **Editing ([S]-gated, per §9-1/§9-2):** saving `PUT`s the intended payload — a **request-body
      assertion** (Holdings §9-35): the body equals the intended target set, not merely "a handler was
      called". **Bulk-replace semantics are load-bearing** (§10-2b): a test proves that editing **one**
      row does not drop the others.
- [ ] **Vocabulary (D-005/D-055):** the `bucket` select is bound to the **dimension's master** and
      **re-binds when the dimension changes**; no inline option list anywhere; served labels verbatim.
- [ ] **Negative / large / long-name data** render correctly (tabular, no overflow) — a 40-char bucket, a
      long holding name in the concentration table, a 100% target, a 0% target.
- [ ] **Both densities** (comfortable/compact) and **both themes** (light/dark) correct.
- [ ] **Interactive OPEN states verified manually in both themes** — the `MasterSelect` dropdown inside
      the editor `Dialog` (a **popover inside a dialog** — the §6 universal rule: it portals to the
      viewport and overlays, never expands the dialog or adds dialog-level scroll), the `RowMenu`, the
      `[Help]` popover, the Toast. Each added to `/kitchen-sink`.
- [ ] **Keyboard + WCAG AA** — focus ring, `aria-sort` on sortable headers, labelled inputs, and the band
      chip's meaning **not carried by colour alone** (it carries a **text label**).
- [ ] **No frontend money math** — every figure comes from the backend. Per §9-6, no frontend money
      **formatting** either, if D-105 is ruled to bind here.
- [ ] **Terms match GLOSSARY exactly** — including the terms **added** under §9-14, added to
      **`docs/specs/GLOSSARY.md` FIRST**, then `mocks/glossary.ts` (the page-heatmap §13-1 lesson: the
      glossary has **two stores**; `tests/unit/test_glossary_parity.py` polices them and **now polices
      additions**).
- [ ] **Copy hygiene (page-chrome §11-8):** no decision ID (`D-0…`/`P-…`/`§…`) and no implementation note
      (`asset_class`, `in_band`, `gap_base`, `max_position_pct`, endpoint or table names) in **any**
      user-facing string. A changed label is updated **app-wide** (§11-4).
- [ ] **Tables (D-094):** the bounded/client-side posture in §4 is honoured.
- [ ] **Rendered layout verification (ADR-0004):** **extend `e2e/overflow.spec.ts` to `/policy`** — zero
      horizontal overflow at **320 / 375 / 900 / 1366px × both themes**, on the document **and**
      `.lf-shell__content`. jsdom has no layout engine; unit tests cannot see this.
- [ ] **Single vertical scroll region — extended to `/policy`:** only `.lf-shell__content` scrolls
      vertically; the document/window never does (`window.scrollY` stays 0 under spacer-forced tall
      content). Three stacked dimension tables plus concentration is exactly the content that would trip
      this.
- [ ] **Geometry gate (if §9-12 composes the page):** if the layout is a summary header over stacked
      dimension sections, the **grid map + density/viewport target + visual hierarchy are ratified by the
      owner BEFORE assembly**, and the gate artifact is measured **inside the real shell** (viewport −
      chrome − shell padding — the page-home §12ho1-7 lesson) with **real-shaped data** (a full 13-class
      asset_class table + 6 regions + N currencies, not a toy 3-row demo).
- [ ] **Every visual/geometry fix ships a pre-pass assertion, seen RED first** (page-portfolio §12b4-1 /
      page-net-worth §12b3-1): reproduce the **owner-visible** defect (measure/screenshot), then assert
      **that** geometry, at **all breakpoints**.
- [ ] **Fail-first applies to TOOLING guards too** (page-markets §13a): the D-055 copy grep, the
      gross-denominator test and the Policy↔Review reconciliation test are each **demonstrated firing on
      the failure they guard** before they are trusted.
- [ ] **Export: NOT built** (§9-20 — expected DECLINED, per the Reports precedent).

---

## 8. BUILD PHASES

*One commit per phase. **Sign-off first: §9 has no open blocker.***

- **Phase 0 — Contract deltas (§3b).** **Only the rows §9 approves.** Backend-first; regenerate
  `API-CONTRACT.json` + `docs/openapi.json` **same commit**; drift check green. *(If §9 approves none,
  Phase 0 collapses to the **doc-only** API-CONTRACT.md repair (§9-9) — the pricing-health fast-path.)*
- **Phase 0a — DESIGN-SYSTEM §5 amendment — ONLY IF §9-15 rules "extract".** Build a ratified
  `StatusChip`, **migrate `ph__chip` + the review severity chip onto it**, demonstrate at
  `/kitchen-sink`, **owner ratifies before assembly**. *(If §9-15 rules "page-local, per the ND-4
  precedent", Phase 0a is **confirm-only** — no amendment, and this phase is skipped.)*
- **Phase 1 — Page assembly.** Compose ratified components against the real endpoints. Honest
  empty/error/stale states. **Per-card progressive loading** — the intent reader and the drift reader are
  independent; a slow drift read skeletons **its own card only** and never blanks the page.
- **Phase 2 — Tests.** Component/render tests; the §7 acceptance criteria; the **D-055 copy grep**, the
  **gross-denominator fail-first test**, and the **Policy↔Review reconciliation** test. Drift check +
  typecheck + lint green. **Extend the Playwright overflow + single-scroll suite to `/policy`** (ADR-0004;
  `npm run check` runs it).
- **Phase 3a — Scripted pre-pass — MUST be GREEN before the owner walk.** The `e2e/smoke/` pattern against
  the **live** app + real backend on a **reset** instance; both themes × every breakpoint; console errors
  captured; **not** wired into CI. Drive the flow the owner would — **including the empty first-run state**
  (§10-2 makes it the default) **and** a full CRUD round-trip. **Wait each progressive card out of
  skeleton before asserting its content.** Fix everything it surfaces **before** the walk.
- **Phase 3b — Owner acceptance walk (LIVE) — JUDGMENT ITEMS ONLY.** With 3a green, the walk is for the
  judgment calls this plan deliberately did not make: **the out-of-band colour treatment** (§9-16), **the
  gap column's label** (§9-19), **the band-inheritance copy** (§9-18), the empty-state copy (§9-13), and
  the §9-15 chip ratification. Each finding becomes a numbered `page-policy.md §12` entry, fixed and
  **re-verified live by the owner**. **The owner closes the phase — never self-certify it.**

---

## 9. NEEDS DECISION

*Everything the specs under-specify. **I resolved none of these.** The owner resolves them **one-pass**;
build starts on **none** of them while open. Proposals are for the owner to approve, amend or reject.*

| # | Item | Why it blocks / what's needed | Proposed resolution (for owner to approve) |
|---|------|-------------------------------|---------------------------------------------|
| **9-1** | **Does v2 ship policy EDITING, or read-only + ROADMAP?** *(the headline question)* | The brief asked whether a write path exists. **It does** — `PUT /policy` + `PUT /policy/targets`, **PIN-gated**, **already in the frozen contract** (§10-2). And **nothing is seeded**: `get_or_create_policy` creates an **empty** policy, so `has_targets = false` is **the state every user starts in** (§10-2). **A read-only Policy page therefore renders permanently empty for everyone** — the canonical home of the Planning group would show nothing, and rotation would **skip it** (D-044). Read-only is not a smaller option; it is a **non-functional page**. | **SHIP [S]-GATED CRUD.** It **passes P-7 explicitly** (D-065's own test: *"UI for existing capabilities that decided features depend on is in scope"*) — the capability ships today; only its UI is missing, exactly the Entity-CRUD precedent. Auth = the served `require_auth` (ambient PIN session, D-103 — **no** second PIN prompt on save). |
| **9-2** | **Editor shape: bulk-replace vs per-row CRUD.** | `PUT /policy/targets` is **atomic bulk replace** (`replace_targets`, `services/policy.py:165` — `targets.clear()` then re-add). There is **no** per-row `POST`/`PATCH`/`DELETE`. So a row-level UI must **read-modify-write the whole set** on every edit. That is a real design constraint (a dropped row = silent data loss), and per-row endpoints would be a **§3b contract delta**. | **Bulk-replace, no delta.** Edit the target set in **one `Dialog`** and `PUT` the whole set. Single-user app ⇒ no lost-update risk. **Acceptance must prove it** (§7): editing one row does not drop the others. *(Rejecting this = a §3b delta for per-row endpoints.)* |
| **9-3** | ⚠ **The drift payload serves a NET total beside GROSS-denominated weights.** | `total_value` = `val.total_value` = **net of liabilities** (= Net worth), while **every** `%` divides by **gross assets** (§10-5b). Print both and they **cannot be reconciled** whenever a liability exists: weights sum to 100% of a number the page never shows, beside a smaller number labelled "total". A **Guarantee-3 defect** the build would otherwise walk straight into. | **§3b reshape: serve `gross_assets`** (the actual denominator) and **drop `total_value`** from this payload (Net worth is canonical for it — P-1). If it stays, it is **relabelled** and **never** placed where it reads as the base of the weights. |
| **9-4** | ⚠ **Is Policy's `actual_pct` the same figure as Portfolio's "Allocation weight" (D-033)?** | Policy re-aggregates class and currency weights in **its own loop** (`services/policy.py:95-98`); Portfolio serves the canonical `allocation_by_class` / `allocation_by_currency` from `val.allocation()` (`routes/portfolio.py:120-121`). **Same rule, same denominator, TWO code paths.** They agree today only because the rules happen to match — a change to `allocation()` (an exclusion, a label) would **silently** not reach Policy. This is exactly the "second code path" P-1/D-038 forbid. *(`region` is unaffected — Portfolio has no region allocation.)* | **Rule it one way, explicitly.** **(a)** *Same figure* ⇒ Policy's drift derives its actuals **from `allocation()`** (one derivation, the ND-3 posture), and the weight columns carry a **canonical-home link to Portfolio** (D-100, card header). **(b)** *Distinct figure* (a policy-scoped derivation) ⇒ **record the reasoning in DECISIONS**, and add a **test pinning the two to agree** so the divergence can never be silent. **Do not leave it unruled.** |
| **9-5** | ⚠ **A verdict derived from STALE inputs is currently unflagged.** | `compute_drift` surfaces **no staleness and no confidence** — zero `is_stale` / `confidence` / `price_ts` in `services/policy.py` (§10-7). The page would state *"Equity is **over** its band"* off a **stale price**, with no flag. Review flags stale holdings separately, but **the Policy verdict itself carries no honesty layer**. Guarantee 3: *stale values are flagged, never hidden* — a **derived verdict** is not exempt. | **§3b reshape: serve a stale / low-confidence input count** on `/policy/drift`; the page renders the ratified **`StalenessChip`** + a link to **Pricing Health** (D-072). If a shared client count is preferred, reuse the ratified **`staleCount` store** (DESIGN-SYSTEM §5.2) — **never a second independent fetch.** |
| **9-6** | **Does D-105 (money = served display strings) bind this page?** | D-105 ratified **backend money formatting, rendered verbatim** (`price_display`). The drift payload serves **raw floats** (`gap_base`, `actual_value`, `value`) — so the page must format currency **client-side**, which D-105 removed the licence for. But D-105's text is scoped to **quote prices by asset class**; `frontend/src/format/number.ts` exists and other pages use it. **The scope is genuinely ambiguous** — it must be ruled, not assumed. | **Rule D-105's scope.** **(a)** *It binds all money* ⇒ **§3b reshape**: serve `*_display` strings. **(b)** *It is quote-price-scoped* ⇒ record that in DECISIONS and let `format/number.ts` format policy money (percentages are unaffected either way). |
| **9-7** | ⚠ **`bucket` is a free-text enum on the write path.** | `replace_targets` validates `dimension ∈ DIMENSIONS` but stores **`bucket` unvalidated** (`bucket[:40]`, `services/policy.py:189`). `PUT {"dimension":"asset_class","bucket":"zzz","target_pct":10}` **succeeds** — creating a target that matches no holding, silently inflating `coverage_pct`. **CLAUDE.md hard rule:** *"Every categorical field must reference MASTER-DATA. No free-text enums."* A `MasterSelect` **cannot** close a hole an API token can still drive. | **§3b behaviour delta: validate `bucket` ∈ the dimension's master; `400` on unknown.** (Currency = the currency master; asset_class / region = the `/refdata` vocabularies.) Fail-first test. |
| **9-8** | **Review re-derives `has_targets` locally.** | `review.py:308` computes `"has_targets": drift.get("dimensions") != []` while the drift payload **already serves** `has_targets` (`services/policy.py:157`). One fact, two expressions — they agree today by coincidence (§10-3b). Trivial, but it is the exact pattern P-1 exists to prevent. | **§3b hygiene: read the served field.** One line. |
| **9-9** | **API-CONTRACT.md never lists the policy endpoints.** | All four are in the frozen **JSON**; **none** is in the **.md** delta table — which is precisely why a text search for "policy" reads inconclusive and why this plan had to go to the code to find the page's reader. The next reader deserves better. | **Doc-only: add four `present` rows** to the delta table (the D-052/D-072 precedent — *"already in the baseline, no change needed"*). **No contract change.** |
| **9-10** | **Should the two GET routes be typed (`response_model`)?** | Both return a bare `dict` (`routes/policy.py:46,52`) — untyped in the contract, like `/portfolio/holdings` before the §9-6 reshape. Typing is contract hygiene, **but** page-markets §12mk3-2: a `response_model` **silently strips any key it does not declare**. If typing rides along with a field addition, a field can vanish **unnoticed**. | **Type them — but as their OWN change**, not bundled into a field addition; regenerate the contract and **assert each served key survives**. Or **defer** (untyped is the status quo and blocks nothing). Owner picks. |
| **9-11** | **Rotation.** | D-044: any nav page is eligible, and **empty pages are skipped** — so an un-targeted Policy is skipped **automatically**. Confirm that is the intent (it is arguably ideal: a kiosk shows Policy **only once the user has one**). | **Rotation-eligible, no special case.** The empty-skip is a feature, not a bug. |
| **9-12** | **Page composition: three tables stacked, or one table + a dimension `Segmented`?** | The page has up to **three** dimension tables (13 asset classes / N currencies / 6 regions) **plus** untargeted rows **plus** concentration. Stacked, that is a **long** page — and it is the exact content that trips the single-vertical-scroll invariant (§7). `Segmented` is **ratified** for precisely this (page-news §13a). **This is a geometry decision, and a widget list is not a layout** (TEMPLATE / page-home §12ho1-3). | **`Segmented` dimension switcher** over **one** table, with concentration as its own card below. **If stacked is preferred, the layout needs a ratified grid map + a geometry gate before assembly** (§7/§8), measured **inside the real shell** with **real-shaped data** (13 classes, not 3). |
| **9-13** | **Empty state — copy + the route forward.** | `has_targets = false` is **the default state of a fresh install** (§10-2), so this is **the most-seen state of the page**, not an edge case. It needs a reason (Guarantee 3) and a way out. Is it also a **first-run checklist** step (D-045)? *(The checklist today covers base currency, timezone, PIN, provider, no-egress — **not** policy.)* | **Copy (owner ratifies):** *"No policy defined. Set target allocations to see how far your holdings sit from your own targets."* + a **"Set targets"** action opening the editor. **Adding a first-run checklist step is a SEPARATE decision** (it touches `page-first-run-checklist.md`) — **propose: no**, keep the checklist minimal. **Note the copy must not imply a trade** (D-055). |
| **9-14** | **GLOSSARY gaps — the page shows terms the glossary does not define.** | **Present:** *Investment policy (IPS)* (:154), *Drift & bands* (:155), *Dimension* (:156), *Concentration* (:150). **MISSING** (all displayed): **Target**, **Band** (as a column word — *"Drift & bands"* is a compound entry, not the header), **In band / Out of band**, **the gap column's term** (§9-19), **Untargeted**, **Coverage**. Also: the **H1/nav label is "Policy"**, which is **not a GLOSSARY term** — and "policy" already means an **insurance** policy elsewhere (*Policy documents (checklist)*, D-062). CLAUDE.md: *every term shown to users must exist in GLOSSARY.md with that exact spelling.* `mocks/glossary.ts` holds **zero** policy terms. | **Add the missing terms to `docs/specs/GLOSSARY.md` FIRST, then `mocks/glossary.ts`** — the page-heatmap §13-1 lesson (**two stores**; the parity guard now polices additions). **Owner ratifies each definition.** Separately: **rule the "Policy" label collision** — propose keeping the nav label **"Policy"** (IA §2 is normative) and adding a GLOSSARY entry disambiguating it from *insurance policy*. |
| **9-15** | **Band-status chip: page-local, or EXTRACT a ratified `StatusChip` (§5 amendment)?** | The ratified inventory has **only** `StalenessChip` (stale-specific, amber-only). page-review **ND-4 chose page-local** (*"the Pricing Health `ph__chip` precedent — no amendment"*). **But a page-local chip would now be the THIRD** (`ph__chip` → review severity → policy band) — and **`Segmented` was extracted at exactly the 3rd recurrence** (page-news §13a), under the rule DESIGN-SYSTEM §5.2 states outright: *"per-instance copies of a standard are the defect."* **The project's own rule says the third one is the trigger.** | **EXTRACT `StatusChip`** (§5 amendment, **Phase 0a**, ratified at `/kitchen-sink`), and **migrate `ph__chip` + the review severity chip onto it** — the centralization rule, applied at the threshold it names. *(Owner may instead rule "page-local, per ND-4" — then Phase 0a is skipped and the debt is accepted **explicitly**, not by default.)* |
| **9-16** | **Out-of-band visual treatment.** | Semantic-only colour (DESIGN-SYSTEM §1). `over` and `under` need a treatment that **does not valuate the gap** — colouring `over` red / `under` green would encode *"over = bad"*, which is the closest a **colour** can come to implying a trade (D-055). | **Amber `--attention` for BOTH `over` and `under`** (they are the same thing: *needs a look*); **neutral** for `in_band`. **Never `--gain`/`--loss`.** Mirrors the **ratified** severity treatment (page-review §12rv1-4: amber attention / neutral). Chip carries a **text label** — meaning never colour-alone (WCAG). **Ratify at the walk.** |
| **9-17** | **Can a concentration row link to its instrument (D-098)?** | D-098: an entity reference in a table cell is a **direct link** to its entity-detail page. The concentration row **names a holding** — but the payload serves only `label` (`h.name or h.label`, `services/policy.py:147`): **no symbol, no id**. Linking is impossible without a **contract delta**. | **§3b reshape: serve `symbol` (nullable) on each concentration row** → link to `/instrument/{symbol}`; **a manual asset with no symbol renders as plain text, never a guessed route** (the ND-7 honest-no-link precedent). **Or** accept no link and record why. |
| **9-18** | **Band-inheritance copy — a blank band field is NOT "no band".** | `min_pct`/`max_pct` null ⇒ the band is `target ± default_band_pct`, **clamped to [0,100]** (`services/policy.py:106-109`). An editor showing empty band fields will be read as *"no band"* when it actually means *"the default band"*. **Silent misreading of the user's own risk tolerance.** | Show the **effective** band as the inherited value (e.g. a placeholder reading the default), with copy naming the inheritance. **Owner ratifies the exact string** at the walk. Also **ratify the `default_band_pct` default of 5** (`models:442`) — and if ratified, it ships a **code test pinning it in the same batch** (§3b note). |
| **9-19** | ⚠ **What is the `gap_base` column CALLED? (a D-055 decision, not a copy nicety)** | `gap_base` = the base-currency distance from target (`services/policy.py:111`; `+ve` = over). D-055 **permits** it — *"Policy drift reports a **gap**"* — but **the label is what decides compliance**: *"Gap to target"* is a **gap**; *"Amount to sell"* / *"Rebalance by"* is a **trade instruction and a D-055 violation**. This is the single highest-risk string on the page and **must not be chosen at build time**. | **Propose: "Gap to target"** (+ a GLOSSARY entry, §9-14). **Owner ratifies the exact string.** Whatever is chosen, the §7 copy grep enforces it forever. |
| **9-20** | **Export?** | Every other Reports-adjacent surface exports server-side (P-5). Policy has **no export endpoint** and the **Reports precedent DECLINED** page-level export — drift already reaches the **Reports Pack** (IA §5: *"Drift is summarised by Review and the **Reports Pack**"*). | **DECLINE.** Drift's export home is the **Reports Pack** (D-061), which composes it from **this page's canonical reader**. No `/policy` export; **no §3b delta.** *(Expected outcome per the brief — recorded so it is a decision, not an omission.)* |
| **9-21** | **Entity scope — should `/policy` expose `?entity_id`?** | `GET /policy/drift` **accepts `entity_id`** (`routes/policy.py:52`) — but **targets are household-global**: one active `InvestmentPolicy` row, and **no entity FK** on `InvestmentPolicy` / `PolicyTarget` (`models:437-464`). So `?entity_id` compares **one entity's actual allocation against the HOUSEHOLD's targets** — a comparison that means nothing. **Review calls it with no entity** (`review.py:283`) ⇒ household. | **HOUSEHOLD-ONLY. The page does not expose the param.** This keeps Policy and Review on **identical** inputs (the §7 reconciliation depends on it). *(Per-entity policies would be a data-model change → **ROADMAP**, not v2.)* |

---

**Sign-off to start build:** §9 has no open blocker · §3b deltas are approved · no component in §4
requires an unresolved amendment.

**Not signed off. §9 is open — 21 items. Nothing is built.**

---

## 10. VERIFY-FIRST RECORD (D-019)

*What the engine **actually serves and actually guards** — read before anything was assumed. Every claim
carries a `file:line` cite. **Audit guards, not just shapes** (page-news §13a).*

### 10-1. The reader(s) — THEY EXIST, AND THEY ARE ALREADY FROZEN ⚠

The brief flagged API-CONTRACT.md's text search for "policy" as **inconclusive**. Resolved:

- **`API-CONTRACT.json` (the frozen baseline, 128 paths) contains all four:** `/api/v1/policy`
  (`get`, `put`), `/api/v1/policy/drift` (`get`), `/api/v1/policy/targets` (`put`).
- **API-CONTRACT.md's delta table contains none of them** — because the **inherited v1 baseline already
  satisfied D-055**, so no delta was ever needed and none was ever written.

**⚠ Divergence flag:** this is a **documentation gap, not a code gap**. The page's reader is not missing;
it was never *written down*. → **§9-9** (doc-only repair).

**Served shape — `GET /policy/drift`** (`compute_drift`, `services/policy.py:78`):

```
{ base_currency, total_value, has_targets, max_position_pct,           # :154-162
  dimensions: [ { dimension, coverage_pct,                             # :130-135
                  rows: [ { bucket, target_pct, actual_pct, drift_pct,
                            lower_pct, upper_pct, status,              # :112-121
                            gap_base, actual_value } ],
                  untargeted: [ { bucket, actual_pct, actual_value } ] # :125-129
              } ],
  concentration: [ { label, weight_pct, limit_pct, value } ],          # :145-150
  disclaimer: "Reporting only — distance from your own targets. Not financial advice." }  # :161
```

`status ∈ {in_band, over, under}` (`:110`). Targets are served sorted by `(dimension, bucket)` (`:65`);
concentration is sorted by weight descending (`:152`). Percentages are 1dp, money 0dp (`_q`, `:34`).

**Served shape — `GET /policy` (intent)** (`policy_payload`, `:51`): `{name, base_currency,
default_band_pct, max_position_pct, notes, targets:[{dimension, bucket, target_pct, min_pct, max_pct}]}`.

**Honesty guards present:** the **protected disclaimer** is served on every drift read (`:161`) and is
**pinned by a test** (`test_policy.py:45` asserts `"not financial advice"` in it). **Untargeted** buckets
are served rather than dropped (`:125`) — held-but-not-targeted exposure is **surfaced, not hidden**.
`coverage_pct` (`:132`) makes an incomplete policy **visible** rather than normalising it to 100%.

**Honesty guards ABSENT:** no staleness, no confidence (§10-7); no `gross_assets` despite gross being the
denominator (§10-5b); money served as raw floats, not display strings (§10-9).

### 10-2. Where policy VALUES live — a PIN-gated write path ships, and NOTHING is seeded ⚠

- **`PUT /api/v1/policy`** (`routes/policy.py:57`) — meta: `name`, `base_currency`, `default_band_pct`
  (0–100 or `400`), `max_position_pct` (**`<= 0` clears it**, `> 100` → `400`), `notes`.
- **`PUT /api/v1/policy/targets`** (`routes/policy.py:85`) — the target set.
- **Both carry `dependencies=[Depends(require_auth)]`.** `require_auth` (`deps.py:77-87`) = *"Guard
  mutating endpoints. Raises 401 when a PIN is set and no valid session token"*, and **a read-only API
  token can never mutate** (403). This is the **[S] gate**, already in place.

**⇒ PRODUCT-SPEC §5's *"the user's own policy bands"* is REAL, not aspirational.**

**And nothing is seeded.** `get_or_create_policy` (`services/policy.py:38`) creates an **empty**
`InvestmentPolicy` — `name = "Investment Policy"`, `default_band_pct = 5` (`models:442`), **no targets**.
`test_policy.py:8-11` pins exactly that (`targets == []`). There is **no policy seed anywhere** (grep over
`app/`, `scripts/`, `alembic/`: only the model default and the migration's `server_default="5"`).

**⇒ `has_targets = false` is the state EVERY user starts in. A read-only Policy page renders permanently
empty for everyone.** This is what makes §9-1 a real decision rather than a formality.

**10-2b. The write path is BULK-REPLACE, atomic.** `replace_targets` (`:165`) validates every row, then
`policy.targets.clear()` → re-add → flush (`:192-197`). **All-or-nothing; no per-row endpoint exists.** A
row-level UI must read-modify-write the whole set (**§9-2**). Validation present: unknown dimension `400`
(`:173`), empty bucket `400` (`:176`), duplicate `(dim, bucket)` `400` (`:179`), `target_pct` outside
0–100 `400` (`:186`), `min > max` `400` (`:187`). All pinned by `test_policy.py:14-35`.

### 10-3. The Policy↔Review seam — ONE derivation, by construction ✅

**`review.py:22` — `from app.services.policy import compute_drift`.** Review does **not** re-implement
drift; it **calls this page's reader**:

| Review surface | Call site | What it takes |
|---|---|---|
| Policy **attention items** | `review.py:79` | `compute_drift(session)` → over/under rows (`:80-85`) + concentration (`:86-87`) |
| **`sections.policy`** (the verdict) | `review.py:283` | `compute_drift(session)` → `_out_of_band(drift)` |
| **Mark-reviewed** (`ReviewLog.drift_flags`) | `review.py:332` | `compute_drift(session)` → `_out_of_band(drift)` |

`_out_of_band` (`review.py:266-268`) = *count of rows with `status ∈ {over, under}`* + *count of
concentration breaches*.

**⇒ The by-construction reconciliation the brief asked about ALREADY HOLDS, with no new work.** Policy's
page reader and Review's signals **cannot diverge**, because they are **the same function**. This is the
ND-3 / `staleCount` precedent, satisfied at the source rather than by a shared client store. **D-038 holds:
Review summarises; Policy is canonical.** §7 **demonstrates** it live (the ND-3 *demonstrate-not-prose*
rule) rather than asserting it here.

**10-3b. One hygiene divergence ⚠.** `review.py:308` computes `"has_targets": drift.get("dimensions") !=
[]` — a **local re-derivation** of a fact the payload **already serves** (`has_targets`,
`services/policy.py:157`, `any(policy.targets)`). They agree today **only because** a target's dimension is
validated into `DIMENSIONS` (`:173`), so any stored target guarantees its dimension appears in
`dimensions`. **Nothing enforces that.** One fact, two expressions → **§9-8**.

### 10-4. ⚠ The allocation seam — the same figure down two code paths

| | Portfolio (canonical, D-033) | Policy |
|---|---|---|
| by asset class | `val.allocation("asset_class")` — `routes/portfolio.py:120` | own loop, `_bucket_of(h,"asset_class")` → `h.asset_class` — `services/policy.py:70-75, 95-98` |
| by currency | `val.allocation("native_currency")` — `routes/portfolio.py:121` | own loop → `h.native_currency` — `services/policy.py:74` |
| by region | *(none — Portfolio has no region allocation)* | own loop → `region_of(h.country)` — `services/policy.py:75` |

`allocation()` (`portfolio.py:190-202`) and `compute_drift`'s loop apply the **identical** rule (positive
market values only, summed by key). **Same figure, same denominator, two implementations.** They agree
today by coincidence of matching rules — a change to `allocation()` would **not** reach Policy, silently.
**P-1/D-038 name this exact pattern.** → **§9-4**. *(`region` is Policy-only and unaffected.)*

### 10-5. Invariants confirmed in code ✅

- **GROSS-ASSET denominator — CONFIRMED.** `gross = sum(h.market_value_base for h in val.holdings if
  h.market_value_base > 0) or Decimal(1)` (`services/policy.py:83`). Bucket sums use the **same
  positive-only filter** (`:97`), as does concentration (`:141`). **A mortgage (negative
  `market_value_base`, `asset_class = liability`) is excluded from the denominator AND from every bucket
  — it cannot distort a weight.** This matches the canonical rule verbatim (`portfolio.py:193-196`:
  *"Only positive-value holdings (gross assets) are counted: liabilities are NEVER allocation rows … A
  liability must not net against an asset class"* — D-033).
- **Liabilities excluded — CONFIRMED** (same filter, three places).
- **Drift computed LIVE — CONFIRMED.** `compute_drift` recomputes from the **current valuation** on every
  read (`:82`). **The data model has NO drift storage at all** — `InvestmentPolicy` (`models:437-449`)
  and `PolicyTarget` (`models:452-464`) store **only intent**; there is no drift column, table or cache
  to go stale. D-055's *"drift computed live, never stored"* is **structural**, not merely observed. The
  module docstring states the intent (`services/policy.py:2-9`) and the schema enforces it.
- **Division-by-zero guarded** — `or Decimal(1)` (`:83`) prevents a zero-portfolio crash. *(Note: with no
  holdings, every `actual_pct` is then `0`, which is honest.)*

**10-5b. ⚠ …but the payload serves a NET total beside those GROSS weights.** `services/policy.py:156`
serves `"total_value": _q(val.total_value, 0)` — and `val.total_value` accumulates **every** holding,
including negative ones (`portfolio.py:404`), i.e. it is the **net-of-liabilities Net worth** headline (IA
§5, Holdings: *"the header reads `total_value`, which is **net of liabilities** = Net worth"*).

**So the payload carries percentages denominated in GROSS assets and a total denominated in NET worth, and
never serves the gross figure the percentages are actually of.** A page printing both would show two
numbers that **cannot be reconciled** the moment a liability exists. → **§9-3**.

### 10-6. D-055 guardrail audit — served copy is CLEAN ✅

Grepped `services/policy.py`, `routes/policy.py`, `review.py` for
`rebalanc|buy|sell|trim|top up|reduce your|increase your`:

- **The only hits are two code comments asserting the prohibition** — `routes/policy.py:5` (*"never a
  buy/sell recommendation"*) and `services/policy.py:8` (*"never 'buy/sell' and never names a trade"*).
  **Comments, not served strings** — and correct.
- **Every served string is a factual gap statement:**
  - `"Reporting only — distance from your own targets. Not financial advice."` (`policy.py:161`) ✅
  - `"«Bucket» is over its asset class band (42.0% vs 30.0%)"` (`review.py:84-85`) — a **distance**. ✅
  - `"«Label» is 71.2% of assets (limit 25%)"` (`review.py:87`) — a **fact**. ✅
- **No `status` value, no field name and no disclaimer names or implies a trade.** ✅
- **There is NO legacy v1 Policy UI to audit.** No `frontend/src/routes/Policy.tsx`, no policy component,
  no policy API client. The **only** frontend reference to policy is `Review.tsx:34` — the attention
  `area → route` map (`policy: "/policy"`), navigation, not copy. **The page is a genuine greenfield: no
  inherited copy debt.**

**⚠ The one live risk is a label that does not exist yet.** `gap_base` (`:111`, comment *"+ve = over
target (factual, not advice)"*) is a base-currency amount. D-055 **permits** it — *"Policy drift reports a
**gap**"* — but its **display label** is what decides compliance: **"Gap to target"** is a gap;
**"Amount to sell"** is a trade instruction. **The single highest-risk string on the page, and it must be
ratified, not chosen at build time.** → **§9-19**, enforced forever by the §7 copy grep.

### 10-7. ⚠ Honesty-guard gap — drift is blind to staleness and confidence

Grep of `services/policy.py` for `is_stale` / `confidence` / `price_ts`: **zero hits.** Every percentage,
every band verdict and every concentration flag is derived from `value_portfolio`'s market values —
**which may be stale or low-confidence** — and **nothing in the payload says so**. Review flags stale and
low-confidence holdings as **separate** items (`review.py:97-101`), but **the Policy verdict itself carries
no honesty layer**: the page would state *"Equity is **over** its band"* off a stale price, unqualified.

Product Guarantee 3 — *stale values are flagged, never hidden* — **does not exempt a derived verdict**.
The ratified affordance (`StalenessChip`) already exists. → **§9-5**.

*(This finding is the direct payoff of the page-news §13a rule: **verify-first audits GUARDS, not just
shapes.** The response shape is complete and correct; the **guard** is missing.)*

### 10-8. ⚠ `bucket` is a free-text enum on the write path

`replace_targets` (`:170-190`) validates `dimension ∈ DIMENSIONS` (`:173`) — but `bucket` is only checked
**non-empty** (`:176`) and then **truncated and stored** (`bucket=bucket[:40]`, `:189`). **No master
membership check.** `PUT /policy/targets {"dimension":"asset_class","bucket":"zzz","target_pct":10}`
**succeeds**, storing a target that matches no holding and **silently inflating `coverage_pct`**.

CLAUDE.md hard rule: *"Every categorical field must reference MASTER-DATA. No free-text enums."* A
`MasterSelect` in the UI **does not close a hole an API token can still drive**. → **§9-7**.

### 10-9. ⚠ Money is served as raw floats (D-105)

`_q()` (`:34`) returns `float(round(v, dp))`. So `gap_base`, `actual_value`, `value` and `total_value` are
**raw numbers**, not display strings. D-105 (DECISIONS.md:743-753) ratified that **money is formatted in
the backend and rendered verbatim** (the `price_display` precedent). Whether D-105 binds beyond quote
prices is genuinely ambiguous — **so it is ruled, not assumed**. → **§9-6**.

### 10-10. Vocabulary status — masters are ready; the GLOSSARY is not

**Masters — all three bucket vocabularies are ALREADY SERVED** (D-055 needs **zero** new vocab work):

| Dimension | Master | Served at |
|---|---|---|
| *(the dimension itself)* | `policy_dimension` — 3 values | `/refdata` (`refdata.py:70`, exposed `:133`) |
| `asset_class` | `AssetClass` — 13 values | `/refdata` (`refdata.py:118`) |
| `region` | `Region` — **6** values (D-083) | `/refdata` (`refdata.py:134`) |
| `currency` | Currency master (**extensible**) | **its own endpoint** — not `/refdata` (`refdata.py:114`; MASTER-DATA §3) |

MASTER-DATA §4 names this page's use case **verbatim**: the six regions are *"the complete `region`
vocabulary (used as a **policy-dimension bucket set**, D-055)"*.

**GLOSSARY — present:** *Investment policy (IPS)* (:154), *Drift & bands* (:155), *Dimension* (:156),
*Concentration* (:150).
**GLOSSARY — MISSING, and all of them are displayed:** **Target**, **Band**, **In band / Out of band**,
the **gap** term (§9-19), **Untargeted**, **Coverage** — plus the **"Policy"** label itself (which
collides with *insurance* policy, D-062). `mocks/glossary.ts` contains **zero** policy terms.
→ **§9-14** (spec **first**, then the popover store — page-heatmap §13-1; the parity guard now polices
additions).

### 10-11. The two threshold families — verified distinct in code and spec

- **Family A** (`review.py:25-30` + D-084/D-087): `_LIQUID_THIN_PCT`, `_RUNWAY_LOW_MONTHS = 3`,
  `_GOAL_SOON_DAYS = 180`, `_OBLIGATION_SOON_DAYS`, `_INSURANCE_SOON_DAYS`, `_CORP_ACTION_RECENT_DAYS`,
  `_OTHER_CLASS_OVERUSE_PCT = 10` — **app-authored**, canonical on **Review**, **R-15 parked**.
- **Family B** (`models:442-443`, `policy_targets:461-463`): `default_band_pct`, `min_pct`, `max_pct`,
  `max_position_pct`, `target_pct` — **the user's own**, canonical **here**, **already editable**
  (§10-2).

**PRODUCT-SPEC §5's final table row states the boundary itself:** *"Policy band / concentration |
**per-policy** | … | Uses **the user's own policy bands** and optional concentration limit — **no fixed
number**."*

**⇒ Every number displayed on `/policy` is Family B. R-15 does not apply to this page and must not be
cited on it** (see §6).

### 10-12. Entity scope

`GET /policy/drift` accepts **`?entity_id`** (`routes/policy.py:52`), threaded into `value_portfolio`
(`services/policy.py:82`). But **targets are household-global**: one active policy row
(`get_or_create_policy`, `:39-42`), and **no entity FK** on `InvestmentPolicy` or `PolicyTarget`
(`models:437-464`). So `?entity_id` compares **one entity's actual allocation against the HOUSEHOLD's
targets**. **Review calls `compute_drift(session)` with no entity** (`review.py:283`) ⇒ household.
→ **§9-21** (propose household-only; the §7 reconciliation depends on Policy and Review sharing inputs).

---

## 10-A. GATE-A ADDENDUM — findings FIXED PRE-RELEASE (owner-approved 2026-07-14)

**Why these shipped while the page is parked.** RD-9 Timing Amendment 2 declared release intent: the
**Policy PAGE moves post-release**, but three of this plan's §10 findings are defects in
`services/policy.py` / `services/review.py` / the API — **code that IS in the release set and that Review
already ships**. *A parked page does not park its engine's defects.* The owner approved them as a **Gate-A
addendum**; each was **fail-first** and shipped in **one commit**.

**⚠ Standing rule for resumption:** this plan's §9/§10 was written against the code as of 2026-07-14.
**Any finding must be RE-VERIFIED at resumption if interim code changes touch it.** Three now have.

| Gate | This plan's finding | Status now |
|------|---------------------|------------|
| **A9** | **§10-8 / §9-7** — `bucket` was a **free-text enum** on the write path | ✅ **FIXED.** `master_buckets(dimension)` is the one place the bucket vocabulary is named (AssetClass · the currency master · the six D-083 REGIONS). Unknown bucket → **400**, naming both the offender and the master. Buckets store in the **master's spelling** (`"sgd"` cannot enter as a second `SGD`). **RED first: `assert 200 == 400`** — a garbage bucket was accepted. **§9-7 is CLOSED.** |
| **A10** | **§10-7 / §9-5** — a **verdict** derived from **stale** prices presented as **fresh** | ✅ **FIXED (fields + copy PROPOSED — owner ratifies the wording).** `/policy/drift` now serves `stale_inputs`, `low_confidence_inputs`, `inputs_stale`, `inputs_note`; `/review` `sections.policy` serves `stale_inputs`, `inputs_stale` — **from the same reader**, so they cannot disagree (pinned by test). Figures are still **shown**, never hidden. **RED first: `KeyError: 'stale_inputs'`.** **✅ WORDING RATIFIED BY THE OWNER 2026-07-14** — the copy stands verbatim (*"1 holding is low-confidence — these figures may not reflect current values."*) and the served fields are ratified with it. **NO second Review attention item** — *rationale:* the existing stale-prices signal already covers that surface, and a second item would **double-report one fact**. **§9-5 is CLOSED.** |
| **A11** | **§10-4 / §9-4** — `actual_pct` was a **second code path** for Portfolio's allocation weight | ✅ **FIXED — resolved as §9-4 option (a), "same figure".** Drift now reads `val.allocation(...)`; `HoldingValue.region` makes region an ordinary allocation key; `PortfolioValuation.gross_assets()` is the **ONE denominator**; `_bucket_of` deleted. **Cost call: LIGHT — no STOP.** **Fail-first, honest: the equality test was GREEN today** (the two paths agreed *by coincidence*; the divergence was **latent**), so it was **proven to fire** by perturbing the canonical path → **RED: `assert 4.4 == 3.3 ± 0.1`**. **§9-4 is CLOSED** — but its *consequence* is still live: **the weight columns now legitimately carry a canonical-home link to Portfolio (D-100)**, which §2 left conditional on this ruling. |

### What this changes about the rest of the plan

- **§9 is now 21 items with THREE CLOSED** — **§9-4** (A11), **§9-7** (A9), and **§9-5** (A10 + the owner's
  wording ratification, 2026-07-14). **⇒ 18 items remain for the one-pass.**
- **§2's conditional Portfolio link is now unblocked** (it was gated on §9-4).
- **§3b shrinks:** the `bucket`-validation and stale-annotation rows are **delivered**. The rows that
  remain open are **§9-3** (serve `gross_assets`, drop/relabel the net `total_value`), **§9-6** (D-105
  money display strings), **§9-17** (a concentration-row identifier for D-098 linking), and the
  **doc-only** §9-9 (API-CONTRACT.md `present` rows).
- **§10-5b is UNCHANGED and still live** — the payload still serves the **net** `total_value` beside
  **gross**-denominated weights. A11 gave the denominator **one home** (`gross_assets()`); it did **not**
  serve it. **The reconciliation defect is still armed for whoever builds the page.**

### New findings recorded while fixing (not resolved here)

- ✅ **The currency master TABLE does not exist — RESOLVED by the owner 2026-07-14, option (a): the SPEC
  follows the verified CODE.** **MASTER-DATA §3 is AMENDED**: `SUPPORTED_CURRENCIES`
  (`app/core/config.py:18`, **9 codes**) is now documented as **the canonical currency master**, and the
  reference table §3 used to describe is recorded as **never built** (superseded text struck through,
  preserved). `is_base_eligible` is restated against the constant — all 9 are base-eligible, so the flag's
  distinction is **real but currently degenerate**. A real table becomes a **deliberate future delta** only
  if multi-currency expansion needs a transaction-only tier (**no R-item**; **R-2** is the decision that
  would trigger it).
  ⚠ **CONSEQUENCE FOR THIS PLAN, still open:** **§5's currency row cites the old MASTER-DATA §3 table**
  and must be **re-read against the amended spec** at the one-pass; **§9-14** (GLOSSARY additions) is
  unaffected in substance but shares the citation.
- ⚠ **The gross-assets sum is hand-spelled in ~8 other readers** (analytics, review, news, ai/tools,
  worker, briefing, planning, seed). They all apply the same rule **today**. `gross_assets()` is now the
  home to converge them on; that sweep is a **separate change**, deliberately not smuggled into A11.
- ⚠ **The A10 guard found a real defect in the SHIPPED demo fixture** — a manually-valued holding scoring
  below the low-confidence band, so the demo's drift verdict genuinely rests on an input we do not fully
  trust. The first version of the test asserted the convenient fiction (`inputs_stale is False`) and was
  **corrected to assert what is true**. *The fixture was not "wrong" — the verdict was simply never honest
  about it before.*

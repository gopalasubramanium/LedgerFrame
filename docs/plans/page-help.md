# page-help — build plan

**Status: DRAFTED TO §9 (2026-07-19). PLAN ONLY — no code. STOP at §9 pending the owner one-pass.**

Help is **release-blocking** (`release-readiness.md:532`, **Gate C2**, RD-9). This plan is the house
`TEMPLATE-page-build.md` filled from the specs, stopping at §9, after a **verify-first pass** over what
`GET /api/v1/help` actually serves and what its honesty guards are.

> **⚠ Citation correction (2026-07-19).** The SCOPE-NOTES header called verify-first "**D-019**".
> `docs/audit/DECISIONS.md:209-215` shows **D-019 is "Merger recording in the transaction form"** —
> unrelated. **Verify-first is a `TEMPLATE-page-build.md` plan-file rule, not a numbered decision.** Every
> citation in this plan is corrected accordingly; the misattribution is logged as **§9-11** so it is fixed
> wherever else it was copied, not just here. *(A spec claim must cite the thing it actually names —
> page-heatmap §13-2.)*

Help **IS an IA page** (unlike R-38/R-42/R-43, which were platform milestones) — it has a route, a nav
slot, and a page template already assigned in the specs. So the full template applies.

The **SCOPE-NOTES (SN-1)** at the foot of this file are owner rulings recorded ahead of the draft. They are
**inputs to §9, not resolutions of it**, and they are preserved verbatim.

---

## 0. VERIFY-FIRST PASS — what is actually there

*Read before assuming. **Four** premises — in the brief, in Gate C2, and in the SCOPE-NOTES — diverge from
what the code and specs actually hold. Each is flagged **⚠** and carried into §9 (TEMPLATE §3 divergence
rule). The KB as served today is **41 entries: Pages 11 · Terms 29 · About 1**.*

### 0-A ⚠ DIVERGENCE — the `[Help]` popovers do NOT point at `/help`. Nothing does.

Gate C2's justification reads: *"The `[Help]` popovers already ship across built pages and point at a page
that **does not exist**"* (`release-readiness.md:532`). **The second half is not true of the code.**

`GlossaryTerm` (`frontend/src/components/ui/GlossaryTerm.tsx:16-42`) is a **self-contained hover/focus
tooltip**: a `<span role="button">` whose open state renders a `<span role="tooltip">` carrying
`entry.term` + `entry.definition` from `frontend/src/mocks/glossary.ts`. It contains **no `<a>`, no `to`,
no `href`, and no `/help`**. A grep for "See Help" / "Learn more" style copy across `frontend/src` returns
**nothing**.

The only `/help` references in the frontend are:

| File:line | What |
|---|---|
| `frontend/src/components/ui/nav.ts:64` | `{ label: "Help", path: "/help" }` — **no `built: true`** |
| `frontend/src/components/ui/Sidebar.tsx:73` | `group.items.filter((i) => i.built)` — so Help is **filtered out of the rendered sidebar** |
| `frontend/src/AppRoutes.tsx:64` | `<Route path="*" element={<NotBuilt />} />` — `/help` falls through to the honest fallback |
| `frontend/src/components/ui/chrome.test.tsx:48` | asserts `queryByRole("link", { name: "Help" })` is **null** — the absence is currently a *pinned* invariant |
| `frontend/src/components/AppShell.test.tsx:346` | renders `/help`, asserts it is unbuilt |

**So the live defect is not a dead link.** It is: **a spec'd IA page (`INFORMATION-ARCHITECTURE.md:85`)
with a fully-served backend, a reserved route, and a reserved nav slot — that has no page.** Users cannot
reach help at all; the popovers are terminal (definition only, nowhere to go deeper).

**This makes the milestone easier, not harder** — there is no dead-end retrofit to unwind. §9-1 changes
shape accordingly: it is a **target list for ADDING popovers + adding the deeper-reading path**, not for
retiring dead ones. The one genuinely dead affordance is listed in 0-D.

### 0-B ⚠ DIVERGENCE — `GET /api/v1/help` already EXISTS, is in the frozen contract, and is UNCONSUMED

| File:line | What |
|---|---|
| `app/api/v1/routes/system.py:745-752` | `@router.get("/help")`, `help_content(q: str \| None = None) -> dict`; delegates to `all_help()` / `search_help(q, limit=6)`. Docstring: *"In-app help — all entries, or ranked results for a query. Read-only, no secrets."* |
| `app/services/help.py:12` | `HELP: list[dict]` — a ~550-line structured KB, **41 entries**, categories `Pages` · `Terms` · `About` |
| `app/services/help.py:519-527` | `all_help()` → `{"categories": [...], "entries": [...]}`; projects `what`/`why`/`improves` **only** onto Terms entries |
| `app/services/help.py:529-544` | `search_help(query, limit)` — title/keyword-weighted ranking |
| `docs/specs/API-CONTRACT.json:5909`, `docs/openapi.json:5909` | `/api/v1/help` **is in the frozen contract** |
| `tests/integration/test_help.py` | 9 tests — id uniqueness, Terms triads non-empty, term-set coverage, **an advice-free phrasing guard**, projection shape, search ranking, endpoint, AI grounding |

**No frontend client exists.** `docs/audit/03-API-SURFACE.md:51` names the expected binding `helpContent`;
grep finds **zero** hits in `frontend/src/api/`. The KB is served and nothing reads it.

**Consequence — the fast-path MOSTLY applies (TEMPLATE §1 note, page-pricing-health §13):** every reader
this page needs **already exists and needs no new endpoint**. But the fast-path does **not** fully clear
§3b here: reading the contract *entry* (not just its presence) shows the response shape is **unpinned**
(§3a) — so §3b carries **one reshape row** and Phase 0 is a small backend-first commit, not a skip. The
bulk of the work is frontend assembly + a **content-accuracy pass on the served strings**.

> *Worth stating as a rule: "the endpoint is in the frozen contract" is **not** the same as "its shape is
> frozen". The fast-path test is whether the contract PINS what the page will render — check the entry,
> not the index.*

### 0-C ⚠ DIVERGENCE — the served help content is **v1-era and factually stale**

The KB's `Pages` entries describe an IA **this product no longer has**. Verified against
`INFORMATION-ARCHITECTURE.md §2` and `nav.ts`:

| `help.py` entry | Claim | Reality |
|---|---|---|
| `page-snapshot:41` | a page called **"Snapshot"** | v2 has **Net worth** (`/net-worth`); `/snapshot` is a *redirect*, not a page (`nav.ts:5-7`) |
| `page-planning:51` | a page called **"Planning"** with goals + obligations | v2 split this into **Cash flow** and **Scenarios**; `/planning` is a redirect |
| `page-policy:45` | titled **"Investment policy"** | v2's nav label / H1 / route is **Policy** (D-022: nav label = H1 = route) |
| `page-pricing-health:35` | titled **"Pricing health"** | v2 spells it **Pricing Health** (`nav.ts:57`) — capital H |
| `page-reports:56` | *"Realised gains by year"* | **D-026 deprecated "Realised gains"**; the ratified term is **Realised P/L report** (`glossary.ts:54`) |
| `page-home:14` | *"the top-bar **Simple/Expert** toggle"* | D-046/D-047 ratified **Simple / Full** |
| `page-planning:51` | *"Edit an item with the **✎** button"* | page-policy §13-2 records the pencil icon as a **silent no-op edit** that never shipped |
| — | no entry exists for | **Accounts · Heatmap · Review · Insurance · Estate · Scenarios · Cash flow · Legal** |

**Every claim in help copy must match ratified behaviour** (standing block). As served, a large fraction
does not. **The content-accuracy pass is the bulk of this milestone**, and it is what §9-5 scopes.

### 0-D — the one genuinely dead affordance: `term-*` entries that render nowhere

`frontend/src/mocks/glossary.ts` holds **63 entries; 22 render at no site** (dead popover data):
`term-intraday`, `term-interval`, `term-snapshot`, `term-backfill`, `term-report`, `term-rollup`,
`term-merge`, `term-monthly-equivalent`, `term-goal-progress`, `term-policy-investment`,
`term-cost-basis`, `term-unrealised-pl`, `term-data-confidence`, `term-mark-reviewed`, `term-severity`,
`term-home`, `term-will`, `term-executor`, `term-beneficiary`, `term-guardian`,
`term-emergency-contact`, `term-readiness`.

`tests/unit/test_glossary_parity.py:52-58` is **one-way** (popover → spec: `f"**{term}**" in spec`). It
does not check the reverse, does not check ids or definitions, and **cannot see a term that renders
nowhere** — all 22 pass. This is the "one truth in two stores" lesson (TEMPLATE, page-heatmap §13-1)
with the guard pointing in only one direction. → **§9-8**.

### 0-E — THE THREE-STORE PROBLEM (the finding that most shapes this plan)

There are **three** term stores, not the two the specs name:

| # | Store | Role | Guarded? |
|---|---|---|---|
| 1 | `docs/specs/GLOSSARY.md` | canonical spec (**300** bolded terms) | — |
| 2 | `frontend/src/mocks/glossary.ts` | what `[Help]` popovers render (**63** ids, flat `definition`) | parity → store 1, one-way |
| 3 | `app/services/help.py` `category: "Terms"` | what `/help` serves **and what the AI cites** (**29** ids, `what`/`why`/`improves` triad) | `test_help.py` shape/phrasing only — **no parity to store 1 or 2** |

Stores 2 and 3 share **2 ids out of 90** (`term-concentration`, `term-unrealised-pl`). They are
**near-disjoint vocabularies with silent aliases** for the same concept:

- `term-cash-runway` (fe) ↔ `term-runway` (be)
- `term-data-confidence` (fe) ↔ `term-confidence` (be)
- `term-realised-pl` (fe) ↔ `term-realised-gains` (be) — **and the backend id/title carries the D-026
  deprecated wording**

And **17 of the 29 backend Terms titles are absent from `GLOSSARY.md`**, so adopting them wholesale as
popover data would fail the parity guard for: *Entitlement & stale · XIRR & TWR · Realised gains & tax
lots · FIFO (first-in, first-out) · Total value · Income (dividends & interest) · 1-year return · 1-year
volatility · Maximum drawdown (1-year) · Allocation weights · Beta · Correlation · Downside deviation ·
Information ratio · Tracking error · HHI (concentration) · Estimated ongoing cost*.

Several of those are **entry titles, not glossary terms** ("XIRR & TWR" is a compound heading). That is a
**structural** mismatch: *a help entry title is not a glossary term*, and the plan must not pretend
otherwise. → **§9-2** is the load-bearing decision of this milestone.

### 0-F — blast radius: the KB is AI-grounded

`app/ai/tools.py:145-148` calls `search_help(question, limit=3)` and emits the results as
`fact_type="help"` in the grounded fact pack; `test_help.py` pins it
(`test_ai_facts_grounded_in_help`). `app/services/help.py:3-7` states the KB is *"a single structured
source of truth used by BOTH the Help page (`GET /help`) and the AI"*.

**So the 0-C content rewrite changes what the AI cites as fact.** AI-surfaces (D-067/D-068) is milestone
#3 in `CURRENT.md`'s THEN list — after Help. Correcting stale content **before** that milestone is the
right order (the AI should not be grounded in v1 page names), but it is a **cross-milestone touch** and
must be declared. → **§9-9**.

### 0-G — **GLOSSARY.md already declares the Help catalogue's contract — and 44 entries are missing**

`docs/specs/GLOSSARY.md:7-8`, in the normative preamble, verbatim:

> *"Terms marked **[Help]** have a full what/why/improves entry in the in-app Help catalogue."*

So the **spec already defines the relationship** between the glossary and the Help KB, and already
specifies the entry shape (`what` / `why` / `improves` — exactly the triad `all_help()` projects onto
Terms entries, `help.py:519-527`). **This is not a model this plan needs to invent.** It exists.

But the spec's obligation is **unmet by a wide margin**:

| Measure | Count |
|---|---|
| Canonical terms in `GLOSSARY.md` (10 topical sections) | **133** |
| Terms **marked `[Help]`** — i.e. promised a what/why/improves entry | **73** |
| Terms entries actually served by `help.py` | **29** |
| **Promised but not served** | **≈44** |

`GLOSSARY.md` also carries **23 deprecated-term rows** with replacements and deciding IDs — the exact
table needed to catch 0-C's D-026 "Realised gains" defect mechanically.

**Two consequences.** First, **§9-2 is much less open than it looked**: the spec already names
`GLOSSARY.md` as the parent and the `[Help]` mark as the join key; the plan's job is to *enforce* an
existing rule, not choose a new one. Second, **§9-5's scope is now bounded by a real number** — 44 missing
entries — and shipping all 44 at v2.0.0 is almost certainly wrong for a release-blocking milestone. That
is the tier split §9-5 asks the owner to rule.

**Also noted:** some `[Help]` marks carry **PROPOSED** provenance rather than RATIFIED (e.g. `:310` Home,
*"PROPOSED 2026-07-13, page-home §9-13 — ratify at the walk"*). The `[Help]` mark is therefore **not
uniformly a ratified promise**, which matters when counting what is actually owed. → **§9-5**.

### 0-H — the popover inventory (the survey the brief calls load-bearing)

**41 render sites** across 14 route files. Full table in **§10**. Summary by page:

| Page | On-page `[Help]` sites |
|---|---|
| Policy | 7 · Insurance | 6 · Home | 3 · Reports | 3 · CashFlow | 3 |
| Settings | 2 direct + 5 via `Field helpTerm` · Accounts | 2 · News | 2 · Heatmap | 2 · Scenarios | 2 |
| Markets | 1 · Estate | 1 · Review | 1 |
| KitchenSink | 4 (gallery specimens, not a product page) |
| **Holdings** | **0 on-page** — its only affordance is `ConfirmDialog helpTerm="term-purge"` (`Holdings.tsx:616`), inside a destructive modal |
| **Portfolio · Instrument Detail · Net worth · Pricing Health** | **0** |
| **Chrome** (`AppShell.tsx`, all `components/ui/*` except `ConfirmDialog`) | **0** |

**This confirms SN-1's owner-picked target list empirically** (Holdings, Instrument Detail, Portfolio,
chrome) **and extends it by two the owner did not name: Net worth and Pricing Health** — both built,
accepted, and popover-free. The extension is offered for the owner to confirm or trim, not assumed. →
**§9-1 ⚑**.

---

## 1. IDENTITY

*Source: INFORMATION-ARCHITECTURE.md §2/§3; DESIGN-SYSTEM.md §3.*

| Field | Value | Spec ref |
|-------|-------|----------|
| Page name (H1 = nav label = route) | **Help** | `INFORMATION-ARCHITECTURE.md:85`, D-022 |
| Route | `/help` | `INFORMATION-ARCHITECTURE.md:85`; already reserved at `nav.ts:64` |
| Nav group | **System** (Settings · Help · Legal) | `INFORMATION-ARCHITECTURE.md:109` |
| Page template | **Settings** template — *"Sectioned/tabbed configuration or content pages in the System group. Settings, Help, Legal"* | `DESIGN-SYSTEM.md:230` (verbatim) |
| Rotation eligibility | **Not eligible** — System-group utility page, not a rotation surface (D-044) | IA §3 |
| One-line purpose | *"Searchable knowledge base (pages + terms + guarantees)."* | `INFORMATION-ARCHITECTURE.md:85` (verbatim) |

**The template is already assigned — do not re-litigate it.** `DESIGN-SYSTEM.md:230` names Help
explicitly under the **Settings** template. This settles the "topic index vs single page" half of the
brief's §9-3: a Settings-template page is **sectioned**, and the served `categories`
(`Pages` · `Terms` · `About`) are the sections. What remains open is the *deep-link mechanism* → §9-3.

**The IA purpose line also settles the brief's §9-6:** search is **not** an invented feature and **not**
absent from the spec — `INFORMATION-ARCHITECTURE.md:85` says **"Searchable"**, and `search_help()` is
already built and tested. Help **must** be searchable.

---

## 2. OWNERSHIP TABLE

*Source: INFORMATION-ARCHITECTURE.md §5. P-1: one canonical page per piece of information.*

> **⚠ SPEC SILENCE — IA §5 has no Help subsection.** The per-page canonical-ownership sections run
> Reports (`:347`) · Reports Pack (`:357`) · Pricing Health (`:364`) · Settings (`:373`) · Instrument
> Detail (`:396`) · Global chrome (`:404`). **Help and Legal are absent.** Help has a page-map row
> (`:85`) and a nav slot (`:109`) but **no ownership entry anywhere in the IA**. The table below is
> therefore **derived, not copied** — which the template forbids doing silently. → **§9-14**.

**Owns (canonical, authoritative):**
- **The help knowledge base itself** — the `Pages` / `Terms` / `About` entries served by
  `GET /api/v1/help`. This is the only page that renders the KB in full.
- **Nothing else.** Help owns **no figure, no money value, no user record.**

**Summarises (other pages' information — pointer only, never a second home):**

| Summary shown | Canonical page | Shared reader reused | Link target |
|---|---|---|---|
| What each page is for (`Pages` entries) | each page itself | `GET /api/v1/help` (`category: "Pages"`) | that page's route |
| What each term means (`Terms` entries) | `docs/specs/GLOSSARY.md` (spec) / the page that shows the term | `GET /api/v1/help` (`category: "Terms"`) | the owning page |
| The product guarantees (`About`) | `PRODUCT-SPEC.md` §0 guarantees | `GET /api/v1/help` (`category: "About"`) | — |

**Enforcement corollary (P-1 / D-031) — how this page honours it.** Help is a **reader and a pointer,
never a second home**. Concretely, the binding rule this plan adopts:

> **Help describes what a page is FOR and what a term MEANS. It never restates a page's figures, never
> carries a number, and never duplicates a procedure that the page itself owns.** A help entry that finds
> itself explaining *how to compute* something is out of scope; it links to the page that computes it.

**Help carries no money and no live figures at all** — so D-105 (which binds *all* money display,
`DECISIONS.md:793-794`) is **N/A by construction**. Recording the absence keeps it a chosen decision, not
a missed standard (the page-estate §9-3 precedent). A guard asserts no money-formatted string renders on
`/help` → §7.

**Links to:** every built page (from its `Pages` entry) · Settings · Legal.

---

## 3. API SURFACE

### 3a. Endpoints consumed (already in the frozen contract)

| Method + path | Purpose on this page | Response shape pinned? |
|---|---|---|
| `GET /api/v1/help` | full KB — `{"categories": [...], "entries": [{id, category, title, body, what?, why?, improves?}]}` | **⚠ NO** — see below |
| `GET /api/v1/help?q=` | ranked search — `{"query": q, "entries": [{id, category, title, body}]}` (≤6) | **⚠ NO** — see below |

**⚠ DIVERGENCE (0-B follow-on) — the contract entry exists but pins NOTHING.** The route is declared
`-> dict` (`system.py:746`), so `API-CONTRACT.json:5909` records the `200` response as an **untyped free
object**: `{"type": "object", "additionalProperties": true}`, title `Response Help Content Api V1 Help
Get`. The endpoint is *in* the frozen contract while its **shape is not frozen at all** — squarely
TEMPLATE §9's *"missing/ambiguous contract shape"* category.

Today only `tests/integration/test_help.py` holds the shape, and it asserts the **service functions**, not
the wire format. A frontend page built against an unpinned dict has no contract protection: a field could
be renamed or dropped and **the contract check would stay green**. → **§9-12**.

**Honesty guards audited (TEMPLATE §3 "audit GUARDS, not just shapes", page-news §13a):**
- **No egress.** The KB is a static in-process list; `help_content` makes no network call, so there is no
  `privacy_mode` obligation to check. ✅
- **No secrets.** The route is unauthenticated and read-only by design (docstring, `system.py:747`); no
  entry carries a credential, path, or token. ✅
- **Advice-free.** `test_help.py:65-71` already asserts no Terms entry contains *"you should" / "aim for"
  / "a good value" / "we recommend"*. ✅ — but it covers **Terms only**; `Pages` and `About` bodies are
  unguarded. → **§9-7**.
- **Accuracy.** **No guard at all.** Nothing asserts a `Pages` entry names a page that exists. This is
  exactly how 0-C's stale content survived. → **§9-7**.

### 3b. Contract deltas

**ONE row — a reshape, not an addition.** The endpoint exists and needs no new reader; what it lacks is a
pinned shape.

| kind | Endpoint (current → intended) | Decision | Why this page needs it |
|---|---|---|---|
| **reshape** | `GET /api/v1/help` — untyped `-> dict` → a declared `response_model` (`HelpEntry` / `HelpResponse`) | **§9-12** | The page renders served strings verbatim; without a pinned shape a renamed field breaks the page while the contract check stays green |

> **⚠ `response_model` STRIPS undeclared keys (TEMPLATE §3b note, page-markets §12mk3-2:
> `HoldingView.price_display`).** Terms entries carry `what`/`why`/`improves` **conditionally** —
> `all_help()` omits them on non-Terms entries (`help.py:521-524`). A naive model would either **strip
> the triad entirely** or force it onto entries that must not have it. The model must make the three
> fields **`Optional`, excluded when unset**, and `test_help.py:73`'s
> `test_all_help_surfaces_glossary_for_terms_only` must be **extended to the wire response**, not just
> the service projection — otherwise the very guard that proves the projection would keep passing while
> the endpoint stopped serving it.

**So Phase 0 is NOT skipped** — it is one small backend-first commit, regenerating `API-CONTRACT.json` +
`docs/openapi.json` in the **same commit** (freeze rule). *(An earlier draft of this plan called §3b empty
on the strength of "the endpoint is in the contract". Reading the contract entry itself corrected it —
which is the whole point of verify-first.)*

> **Note (TEMPLATE §3b, page-review §13):** the content corrections in 0-C change **served values, not
> shapes** — they regenerate no contract, so *a spec edit alone would leave the code free to silently
> disagree*. Therefore **every ratified content rule ships a same-batch, fail-first code test** pinning
> the served value (§7, §9-7). This is the mechanism that replaces the missing contract regen.

---

## 4. COMPONENTS

*Source: DESIGN-SYSTEM.md §5 (ratified inventory). Every component below is already ratified — **no
DESIGN-SYSTEM amendment is required for this page**.*

| Ratified component | Role on this page | Data source | Prop/state not exercised at kitchen-sink |
|---|---|---|---|
| `PageHeader` | H1 "Help" + the purpose line | static | — |
| `TextInput` (`ui/index.ts:13`) | the **search field** (`?q=`) | **real** — `GET /help?q=` | debounced-search usage is new; no new prop |
| `Segmented` (`ui/index.ts:46`) | category filter — Pages / Terms / About | **real** — served `categories` | — |
| `.lf-card` + `.lf-card__body` (D-100) | one card per category section; entry bodies nest in the inner panel | **real** | — |
| `EmptyState` | "no results for «q»" with a reason (Guarantee 3) | — | — |
| `Skeleton` | per-section load state (progressive, TEMPLATE §12-8) | — | — |
| `GlossaryTerm` | **unchanged**; the retrofit adds *sites*, not a new component | `mocks/glossary.ts` | — |
| `Button` | "clear search" | — | — |

**Data source (Holdings retrospective).** The page itself is wired **entirely to a real endpoint** — there
is **no mock-backed affordance on `/help`**. ✅

**⚠ But the popover retrofit IS mock-backed**, and stays so: `GlossaryTerm` reads
`frontend/src/mocks/glossary.ts` (a bundled fixture), not `/help`. Under TEMPLATE §4 that is a **§9
NEEDS DECISION ("mock-backed affordance")** — and it is the same decision as the three-store problem. →
**§9-2**.

**⚠ Affordances the ratified inventory lacks — an honest reading.** A grep of `DESIGN-SYSTEM.md` for
`long-form | prose | topic index | content-heavy | Markdown` returns **exactly one hit: line 547, the
GlossaryTerm row.** There is **no prose/article/accordion/table-of-contents/search-results component in
the ratified inventory**, and Help is the product's only prose page. Two readings:

- **(i) No amendment needed** — an entry is a **title + body paragraph inside `.lf-card__body`**, which is
  composition of ratified primitives, not a new component. `DESIGN-SYSTEM.md §3.1` explicitly sanctions
  the one thing prose needs: *"A page may still cap an inner content **MEASURE** (a reading column inside
  a card…) — that is component-local, not the page root."* So a readable line-length is **already
  allowed** without an amendment.
- **(ii) An amendment is needed** — a search-results list and a category filter are recurring affordances
  that will want a home in the component layer (TEMPLATE §4: *"extract page-local patterns that recur"*).

**Proposed: (i) for the build, with (ii) deferred** — build from ratified primitives, and if the prose
block or results list proves reusable at the walk, extract it **then**, at its second site, per the
centralisation rule. **Recorded rather than assumed** → **§9-13**. *(An earlier draft asserted "no
amendment required" flatly; the DESIGN-SYSTEM grep does not support that confidence.)*

**No templating engine exists anywhere in the stack** — the Reports Pack composes HTML by f-string, and
`reports-pack.md:163-176` records *"No Jinja2 / templates precedent exists… Adding Jinja2 would need an
ADR"*. **Help bodies are therefore plain text, not Markdown**, and no renderer is introduced (CLAUDE.md:
no new dependencies without an ADR).

**Component rules this build must honour:** popovers portal to the viewport and overlay (DESIGN-SYSTEM
§6); scroll is content-only with the header outside (D-101); cards are layered (D-100); a card's
cross-link lives in the **header, top-right** (`SummaryLink`, DESIGN-SYSTEM:545) — which is how a `Pages`
entry links to its page.

**Tables (D-094):** **none on this page.** The KB is rendered as sectioned cards, not a `DataTable`.
Dataset is **bounded** (41 entries, authored, not user-generated), and **search executes server-side**
(`search_help`), so no client-side filtering of an unbounded set arises.

---

## 4b. PER-VARIANT FIELD & ACTION SPECS

**N/A.** Help has no entity, no variants, no forms, no mutations. The page is **read-only**.

---

## 5. VOCABULARIES

*Source: MASTER-DATA.md.*

| Field on this page | Vocabulary / master | Fixed or extensible | Ref |
|---|---|---|---|
| Help category (Pages / Terms / About) | **served fixed list** — `_CATEGORIES` (`app/services/help.py:516`) | **Fixed**, backend-served | — |

**⚠ Not in MASTER-DATA.md.** The category list is a served constant, not a `/refdata` vocabulary. Per
CLAUDE.md's hard rule (*"every categorical field must reference MASTER-DATA"*) the `Segmented` filter is a
categorical control bound to a list that has no master. Two honest readings — it is a **display grouping**
rather than a data field, or it needs a MASTER-DATA row. → **§9-10**.

**No user input, no `MasterSelect`, no user-record picker.** The only input is the free-text search box,
which is a query, not a categorical field.

---

## 6. DECISIONS IN FORCE

| Decision | What it forbids / requires on this page |
|---|---|
| **D-022** (nav label = H1 = route) | H1 is exactly **"Help"**, route exactly `/help` — and the served `Pages` titles must use the **same spellings** (0-C violates this today: "Investment policy", "Pricing health", "Snapshot", "Planning") |
| **D-043** (six fixed nav groups) | Help enters **System**, between Settings and Legal — the slot already exists (`nav.ts:64`); no reorder, no new group |
| **Verify-first** (TEMPLATE rule, **not** D-019 — see the header correction) | §0 above; the divergences are flagged ⚠, not built around |
| **page-chrome P-3** (`page-chrome.md:503-511`) | the sidebar density is **already sized for all 19 RD-9 nav items including Help** — *"not redone at Accounts/Settings/Help/Legal"*; `e2e/sidebar-density.spec.ts` reserves the slot. Adding Help **consumes a reserved slot**, it does not force a re-density |
| **Gate C3** (`release-readiness.md:533`) | *"no nav entry in the release build leads to `NotBuilt`"* — a fail-first test. Help's flip must land **with** its page, never before |
| **Dead-affordance principle** (`page-chrome.md:578`) | *"a control wired to nothing is hidden until its engine lands, not shipped"* — which is exactly why `nav.ts:64` is `built:false` today. **The current state is correct behaviour, not a bug** |
| **D-026** (Realised P/L, not "Realised gains") | the served `page-reports` body and the `term-realised-gains` id/title carry the **deprecated** wording — corrected in the content pass |
| **D-046 / D-047** (Simple / Full) | the served `page-home` body says **"Simple/Expert"** — wrong; corrected |
| **D-100 / D-101** (layered cards; scroll = content only) | section cards are layered; only `.lf-shell__content` scrolls |
| **D-105** (money display) | **N/A (chosen)** — Help renders no money; guarded (§2, §7) |
| **D-078** (settings persistence split) | Help persists **nothing** — no per-device state, no server setting. The search query is URL state (`?q=`), not persistence |
| **P-1 / D-031** (one canonical page) | Help **summarises-with-pointers only** (§2) |
| **Guarantee 3** (honesty) | empty search results show a **reason**; a `Pages` entry for an unbuilt page is **not shown** rather than lying |
| **Guarantee (never advises)** | the advice-free phrasing guard extends from Terms to **all** categories (§9-7) |
| **R-39 constraints** (`ROADMAP.md:52`) | **(a)** semantic-only colour; **(b)** no avatar/account block; **(c)** collapse-to-icon rides the **existing D-078 sidebar-collapsed** setting — **none of the three is touched by adding a nav entry**; see §9-4 |

---

## 7. ACCEPTANCE CRITERIA

- [ ] **Happy path:** `/help` renders the served KB in three sections (Pages · Terms · About); every entry
      shows title + body; Terms entries additionally show **what / why / improves**.
- [ ] **Search:** typing a query hits `GET /help?q=`, renders ≤6 ranked results, and is **reachable and
      shareable as `?q=` URL state**; clearing restores the full KB.
- [ ] **Deep link:** a `#`-anchored entry id (per §9-3's ruling) scrolls to and visibly marks that entry.
- [ ] **Nav:** **Help appears in the sidebar** under System, between Settings and Legal, at every
      breakpoint and in the collapsed state; it is the **active** item on `/help`.
- [ ] **`chrome.test.tsx:48` is INVERTED, not deleted** — the pinned "Help link is null" invariant becomes
      "Help link is present"; `AppShell.test.tsx:346` picks a still-unbuilt route (Legal) for its
      NotBuilt case. *(A test that pins the defect must be flipped deliberately and be seen to flip.)*
- [ ] **Content accuracy (the milestone's real bar):** **every** `Pages` entry names a page that exists in
      `nav.ts` with the **identical spelling**; no entry references a redirect-only path
      (`/snapshot`, `/planning`, `/global`); no entry uses D-026 / D-046-deprecated wording. Pinned by a
      **fail-first** test (§9-7) that is **seen RED on today's content**.
- [ ] **Advice-free across ALL categories** — the `test_help.py:65` phrasing guard extends beyond Terms,
      proven RED→GREEN.
- [ ] **No money math, no money strings** — a guard asserts no money-formatted string renders on `/help`.
- [ ] **Terms match GLOSSARY** — whatever §9-2 rules, the parity guard covers the store the page renders,
      and is **seen RED** on a deliberately misspelled term.
- [ ] **Empty state:** a no-match search shows a reason, not a blank.
- [ ] **Error state:** an endpoint failure shows an honest message + retry; the page never renders a
      half-KB silently.
- [ ] **Both densities and both themes** correct; **interactive open states** (a popover on `/help`)
      checked in light AND dark.
- [ ] **Keyboard + WCAG AA** — the search field is labelled, the Segmented filter is keyboard-operable,
      focus ring visible, section headings form a correct heading order.
- [ ] **Copy hygiene (page-chrome §11-8):** no decision ID (`D-0…`/`P-…`/`§…`) or implementation note
      (endpoint names, `privacy_mode`, internal enums) in any served or rendered help string. **This page
      is the highest-risk surface for that defect in the product** — it is prose about the product.
- [ ] **Overflow / single scroll region:** `/help` added to `e2e/overflow.spec.ts` — zero horizontal
      overflow at 320/375/900/1366 × both themes; only `.lf-shell__content` scrolls vertically. **Long
      unbroken body text is the specific risk** this page brings.
- [ ] **Cross-page journey (page-accounts §14ac-2):** a `Pages` entry's link is guarded by **clicking the
      real control** and asserting the **destination page state**, not by rendering the destination.
- [ ] **Retrofitted popovers (per §9-1's confirmed list):** each renders on the real page, overlays without
      expanding its container, and its term passes parity.
- [ ] **`npm run check` exit code stated from the frontend directory**; no known-red left on trunk
      (page-insurance §15b(a)).

---

## 8. BUILD PHASES

*One commit per phase. Backend deltas (§3b) FIRST.*

- **Phase 0 — Contract delta (§3b).** Declare the `response_model` on `GET /api/v1/help` with the triad
  **optional-and-excluded-when-unset**; extend the projection guard to the **wire** response; regenerate
  `API-CONTRACT.json` + `docs/openapi.json` **same commit**; drift check green.
- **Phase 1 — Content pass (BACKEND-FIRST, before any page exists).** Correct the KB in
  `app/services/help.py` per §9-5's ratified scope: fix the stale `Pages` entries (0-C), resolve the
  D-026 / D-046 wording, add entries for the pages with none, and resolve the term-id aliases per §9-2.
  **Each rule ships its fail-first guard in the same commit** (§3b note). `test_help.py:88`'s
  `"Investment policy"` assertion updates in this commit. **Declared AI touch** (§9-9 / 0-F).
- **Phase 2 — Page assembly.** `frontend/src/routes/Help.tsx` + the `helpContent` client
  (`docs/audit/03-API-SURFACE.md:51`); compose the ratified components (§4); progressive per-section
  loading; honest empty/error states; `?q=` URL state; deep-link anchors.
- **Phase 3 — Nav + the pinned-invariant flip.** `nav.ts:64` gains `built: true`; **invert**
  `chrome.test.tsx:48`; repoint `AppShell.test.tsx:346`. *(This is the whole of §9-4's mechanism —
  one flag.)*
- **Phase 4 — `[Help]` retrofit** to §9-1's **owner-confirmed** list. **Every target page is CLOSED and
  ACCEPTED**, so each touched page takes a **dated DELTA NOTE in its own plan file** + a **re-run
  pre-pass** (the page-insurance §14in / page-holdings precedent). Enumerated per page:
  `page-holdings.md` · `page-instrument-detail.md` · `page-portfolio.md` · `page-chrome.md` ·
  *(pending §9-1)* `page-net-worth.md` · `page-pricing-health.md`.
- **Phase 5 — Tests.** §7 criteria; extend `e2e/overflow.spec.ts` with `/help`; the dead-entry guard
  (§9-8); typecheck + lint + drift green; `npm run check` exit 0 from `frontend/`.
- **Phase 6 — Scripted pre-pass (MUST be green before the walk).** Drive `/help` live in both themes
  across breakpoints: search, filter, deep-link, every section out of skeleton, 0 console errors. **Plus
  a re-run of each accepted page's existing pre-pass** touched in Phase 4.
- **Phase 7 — Owner acceptance walk (LIVE) — judgment items only.** **All help copy is PROPOSED until the
  owner ratifies it here** (SN-1: *"Copy is PROPOSED → ratified at the walk"*). This walk is unusually
  copy-heavy: it is the ratification of the product's entire explanatory voice. **The owner closes the
  phase — never self-certify.**
- **Close ritual.** Plan §-retrospective + `RATIFICATION.md §6` row; strike-check every §9/§walk item
  against the actual diff; **`CURRENT.md` must be inside the close commit's diff**; `git push`.

---

## 9. NEEDS DECISION — **PARTIALLY RESOLVED (one-pass in chat, 2026-07-19)**

*Ruled in chat on **2026-07-19** by the **architect under the owner's standing delegation**, **reversible
by dated entry**. **Five ⚑ items RULED** (9-1, 9-2, 9-5, 9-6, 9-9); **9-11 / 9-12 stand as logged**, and
§3b's reshape row proceeds in Phase 0. Each ruled row carries its **→ RULING** in the final cell; nothing
is struck.*

**Still OPEN — and none blocks Phase 0:** 9-0 · 9-3 · 9-4 · 9-8 · 9-10 · 9-13 · 9-14 · 9-T. They gate
later phases (page assembly, nav flip, retrofit) and are carried to the next pass.

**9-7 proceeds under the PROCEED instruction** (*"the contract reshape row + content-store guard + KB
content pass **per the plan**"*) — its guards are the mechanism the content pass runs on. Recorded here as
**proceeding-per-plan rather than separately ruled**, so the distinction stays visible.

| # | Item | Why it blocks / what's needed | **PROPOSED resolution → RULING (2026-07-19)** |
|---|---|---|---|
| **9-0** | **⚠ Re-baseline Gate C2's premise** | `release-readiness.md:532` says the popovers *"point at a page that does not exist"*. **They point nowhere at all** (0-A) — `GlossaryTerm` has no link. The gate's stated defect is not the real one, and the real one is larger: a spec'd IA page with a served backend and no page. | **Correct the Gate C2 justification line** to the verified defect: *"`/help` is a spec'd IA page (IA:85) with a fully-served backend (`GET /api/v1/help`) and a reserved nav slot, but no page; the `[Help]` popovers are terminal — a definition with nowhere to read further."* Scope is unchanged; only the premise is corrected. **A gate must name the defect it actually gates.** |
| **9-1 ⚑** | **THE TARGET LIST** — which pages get `[Help]`, and which terms | SN-1 rules targets are **owner-picked per page**. The survey (0-H, §10) is the real data to pick from. Four pages named in SN-1 have zero; **two more the owner did not name also have zero**. | **Confirm the SN-1 four** — Holdings (on-page; it has only a modal popover today), Instrument Detail, Portfolio, chrome — **and EXTEND by two: Net worth and Pricing Health** (both built, accepted, popover-free). Per-page candidate terms proposed in **§10-B**, each drawn from terms **already in GLOSSARY.md**. **Owner confirms / trims / extends per page.** *No popover is a dead-end under any trim* — the affordance is a self-contained tooltip (0-A), so a trimmed target simply has no popover; nothing is left pointing anywhere. **This is the ⚑ ruling that unblocks Phase 4.** **→ RULING: ✅ CONFIRMED AS SURVEYED + EXTENDED (2026-07-19)** — SN-1's four **plus Net worth and Pricing Health**. Zero GLOSSARY additions needed for the common case; no trim dead-ends by design. |
| **9-2 ⚑** | **CONTENT MODEL — the three-store problem** (0-E) | The load-bearing decision. Two term stores share **2 ids of 90**, with silent aliases and one D-026-deprecated title; **17 of 29** backend titles fail GLOSSARY parity; and a help **entry title** is structurally not a **glossary term**. The popover is mock-backed (§4). **But 0-G narrows this sharply:** `GLOSSARY.md:7-8` **already** declares the model — *"Terms marked **[Help]** have a full what/why/improves entry in the in-app Help catalogue"* — naming `GLOSSARY.md` as parent and the `[Help]` mark as the join key. The job is to **enforce an existing rule**, not choose a new one. | **SERVED is canonical for the PAGE; BUNDLED stays canonical for the POPOVER — and the two are given ONE spec parent, not merged.** Specifically: **(a)** `/help` renders **only** the served KB (store 3) — the page never reads `mocks/glossary.ts`; **(b)** the `[Help]` popover keeps reading `mocks/glossary.ts` (store 2) — **it is a bundled tooltip on purpose**: it must open instantly, offline, with no request per hover; **(c)** **`GLOSSARY.md` (store 1) becomes the enforced parent of BOTH** — the existing one-way parity guard is extended to cover store 3's `Terms` **`title`** fields too, so all three agree on spelling. **Per 0-G this is enforcement of `GLOSSARY.md:7-8`, already normative — the guard is the mechanism the spec has been missing, and the 23-row deprecated-terms table (`GLOSSARY.md:318`) is the ready-made check that catches the D-026 defect mechanically;** **(d)** the **alias ids are reconciled** (`term-runway`→`term-cash-runway`, `term-confidence`→`term-data-confidence`, `term-realised-gains`→`term-realised-pl`, adopting the **frontend/D-026-correct** spelling in each case); **(e)** the **17 non-glossary backend titles** are ruled to be **entry headings, not terms** — exempted from parity by an explicit allow-list carrying a reason per row, *never* by silence. *Rejected alternative: merge into one store. It sounds right and is wrong — it would either force a network request per popover hover, or ship the whole 550-line KB into the bundle.* **Owner rules (a)–(e).** **→ RULING: ✅ ACCEPTED (2026-07-19)** — served canonical for the page; bundled canonical for the popover (**offline, instant, no per-hover request**); **`GLOSSARY.md` the ENFORCED parent of both**. **Extend the two-store parity guard (page-heatmap §13-1 precedent) to cover `help.py`'s Terms store, so the 2-of-90 silent-alias drift becomes BUILD-BREAKING.** Merging the stores **stays rejected** for the reasons stated. |
| **9-3** | **Page structure + deep-link mechanism** | Template is **already settled** (Settings template, `DESIGN-SYSTEM.md:230`) and **search is already spec'd** (IA:85) — so only the deep-link half is genuinely open. Hash routing is in use, so an anchor competes with the route hash. | **Sectioned single page + `?q=` + `#`-fragment anchors.** Three `.lf-card` sections in served `categories` order (Pages · Terms · About), each entry anchored by its **served `id`** (`page-home`, `term-xirr-twr`) — the ids already exist and are unique (`test_help.py:11`). Under HashRouter the deep link is `#/help?q=…#term-xirr-twr`-shaped; **the page scrolls to the anchor in an effect keyed on the fragment**, rather than relying on browser-native anchor scrolling, which HashRouter does not deliver. Search state lives in `?q=` so a result is shareable. **No separate topic-index page** — 41 entries do not warrant one, and a second page would split the canonical home. |
| **9-4** | **Sidebar placement — now vs at R-39** | Help is **not visible** in the nav today, but its slot is **already ratified and coded** (`nav.ts:64`, System group, between Settings and Legal, per IA:109 / D-043). | **Flip `built: true` on `nav.ts:64`. That is the entire change** — no new entry, no reorder, no new group, no new component. **It cannot collide with R-39**, whose three ratified constraints (`ROADMAP.md:52`) are (a) semantic-only colour, (b) no avatar/account block, (c) collapse-to-icon rides the **existing D-078 sidebar-collapsed** setting — **none of which concerns which items are visible**. R-39 restyles the sidebar; it does not re-decide its contents. **Nothing here is re-done at R-39.** *(Note the flip also inverts a pinned test — §7, Phase 3.)* |
| **9-5 ⚑** | **Content authoring scope for v2.0.0** | 0-C: a large fraction of served content is v1-era and **wrong**. Shipping it would violate *"every claim in help copy must match ratified behaviour."* Eight built pages have **no** entry. **And 0-G puts a number on the rest: `GLOSSARY.md` marks 73 terms `[Help]`, `help.py` serves 29 — ≈44 promised entries do not exist.** Shipping all 44 is not a release-blocking milestone; shipping none leaves the spec's own promise unmet. This is the milestone's bulk and needs the owner's line. | **Three tiers. TIER 1 (release-blocking, MUST ship correct):** fix every stale `Pages` entry (Snapshot→Net worth, Planning→Cash flow + Scenarios, Investment policy→Policy, Pricing health→Pricing Health), the **D-026** "Realised gains" wording, the **D-046** "Simple/Expert" wording, and **delete the `✎` claim** (page-policy §13-2: the pencil never shipped). **TIER 2 (release-blocking):** author the **8 missing `Pages` entries** — Accounts · Heatmap · Review · Insurance · Estate · Scenarios · Cash flow · Legal — so no built page is undocumented. **TIER 3 (POST-RELEASE):** the **≈44 `[Help]`-marked terms with no catalogue entry** (0-G), plus enrichment of the existing 29. **Rationale:** Tiers 1–2 are *honesty* — the product must not describe itself **falsely**, and that is a release bar. Tier 3 is *completeness* — describing itself **partially** is honest, and completeness is not a release bar. **Mechanism so Tier 3 is not silently forgotten:** the parity guard (§9-2c) reports the `[Help]`-marked-but-unserved count as a **visible non-blocking number**, and the remainder is logged to `08-TECH-DEBT.md` — *no silent caps* (TEMPLATE). **Note also that some `[Help]` marks are PROPOSED, not RATIFIED** (`GLOSSARY.md:310`), so the 44 is an upper bound on what is genuinely owed. **Every shipped entry is reviewed against the page spec it describes**, and is PROPOSED until the Phase-7 walk. **Owner rules the tier split.** **→ RULING: ✅ ACCEPTED (2026-07-19)** — **Tier 1 + Tier 2 release-blocking** (fix every false entry; author the 8 missing pages); **Tier 3 (~44 terms) POST-RELEASE, filed as a ROADMAP row.** The governing principle is recorded **verbatim**: ***"describing itself falsely is a release bar; describing itself partially is not."*** |
| **9-6 ⚑** | **TONE / VOICE — the specimen to ratify** | SN-1 requires all copy ratified by the owner. A voice ratified *once, in-plan* is far cheaper than re-litigating every entry at the walk (**41 today, 49 after §9-5's Tier 2**). | **Ratify the voice from the three specimens in §11**, drafted in the product's existing honest-plain register (they are rewrites of real entries, not inventions). The proposed rules: **second person, present tense; state what the page/term IS and what it is FOR; name the honest limit plainly; never prescribe an action; never use a decision ID or an internal enum; no marketing register.** **Owner ratifies the voice specimen; every entry then conforms to it.** **→ RULING: ✅ CRITERION NOW, RATIFICATION AT 0a (2026-07-19)** — the three §11 specimens **must match the register of the product's already-ratified served strings** (*"headlines are retrieved, never invented"*; *"Carried forward — a price or exchange rate was unavailable on this date"*): **plain, honest, no marketing, no hedging.** **Any specimen drifting from that register FAILS the criterion.** **The owner ratifies voice BY LOOKING at the rendered 0a specimen, not as prose in a plan** — so §11 is a criterion to build against, not the ratification itself. |
| **9-7** | **Content-accuracy + advice-free guards** (0-B, §3a) | The advice guard covers **Terms only**; there is **no accuracy guard at all** — which is precisely how 0-C's stale content survived to release-blocking status. A spec edit regenerates no contract (§3b note), so nothing stops silent drift back. | **Two standing guards, each proven RED→GREEN:** **(a)** an **accuracy guard** asserting every `Pages` entry's title matches a `nav.ts` label exactly and references no redirect-only path — **seen RED on today's content** (it fails on 4+ entries now, which is the proof it works); **(b)** the **advice-free phrasing guard extended from `Terms` to ALL categories**. *A guard never seen to fire is not a guard* (page-markets §13a). |
| **9-8** | **The 22 dead popover entries** (0-D) | 22 of 63 popover entries render nowhere; the parity guard is one-way and cannot see them. Dead copy is a maintenance liability that reads as shipped. | **Do NOT delete them in this milestone** — several (`term-snapshot`, `term-backfill`, `term-intraday`, `term-interval`) are R-42/R-43 terms authored spec-first and awaiting their retrofit sites, and §9-1's target list will **consume some of them**. **Instead: (a)** run the reverse check and **record the surviving dead list in the close-out** after Phase 4 consumes what it consumes; **(b)** add a **non-blocking reverse-parity report** (not a failing test) so the count is visible rather than invisible; **(c)** log deletion of the true leftovers to `08-TECH-DEBT.md` as post-release. **Deleting terms mid-milestone would fight §9-1's ruling before it is made.** |
| **9-9** | **⚠ AI blast radius of the content pass** (0-F) | `app/ai/tools.py:145` grounds AI answers in this KB, pinned by `test_help.py`. Rewriting content **changes what the AI cites as fact** — and AI-surfaces (D-067/D-068) is the *next* milestone. | **Proceed, and declare it.** Correcting stale content **before** AI-surfaces is the right order — the AI must not be grounded in v1 page names, and doing it later means AI-surfaces inherits known-false facts. **Declare the touch explicitly in the Phase-1 commit + the close-out**, re-run the AI grounding tests in the same batch, and **note in `CURRENT.md` that AI-surfaces inherits a corrected KB.** *(Sequencing note: the AI-surfaces intake already carries a contention-fragile streaming test — unrelated, but the same milestone boundary.)* **→ RULING: ✅ ACCEPTED (2026-07-19)** — proceed; **the touch is declared.** **Record a cross-note into the AI-surfaces milestone intake: the help KB content is rewritten THIS milestone — AI-surfaces' grounding review must read the NEW content, never the v1-era entries.** |
| **9-10** | **Help category vocabulary vs MASTER-DATA** (§5) | The `Segmented` filter binds to `_CATEGORIES` (`help.py:516`), a served constant with **no MASTER-DATA entry** — nominally against CLAUDE.md's hard rule. | **Rule it a DISPLAY GROUPING, not a categorical data field** — it classifies authored content, is never stored, never user-set, and never filters user data. **Record the exemption explicitly in MASTER-DATA.md with its reason** (not by silence), and pin the three values with a served-value test. *Alternative: add a `/refdata` vocabulary — rejected as ceremony for a 3-value display axis.* **Owner confirms the exemption is recorded rather than assumed.** |
| **9-11** | **⚠ The "D-019 = verify-first" misattribution** | This plan's own SCOPE-NOTES header cited verify-first as **D-019**; `DECISIONS.md:209-215` shows D-019 is **"Merger recording in the transaction form"**. Verify-first is a `TEMPLATE-page-build.md` rule with **no decision ID**. A wrong ID propagates by copy-paste and makes a plan look spec-grounded where it is not. | **Corrected in this file's header.** **Grep `docs/` for other `D-019` citations and correct every one in the same commit** (the app-wide-label rule, page-chrome §11-4, applied to spec citations). *(This is the cheapest possible instance of page-heatmap §13-2 — "a spec claim must cite the spec FILE".)* **→ RULING: ✅ STANDS AS LOGGED (2026-07-19).** |
| **9-12** | **⚠ The `/help` contract shape is UNPINNED** (§3a, §3b) | The route is `-> dict`, so `API-CONTRACT.json:5909` records `{"type":"object","additionalProperties":true}`. The endpoint is in the frozen contract while its **shape is frozen not at all** — a field could vanish and the drift check would stay green. TEMPLATE §9 *"missing/ambiguous contract shape"*. | **Declare a `response_model` (Phase 0).** The triad (`what`/`why`/`improves`) must be **`Optional` and excluded-when-unset**, or the model will either strip it or force it onto non-Terms entries — the `HoldingView.price_display` trap. **Extend `test_help.py:73` to assert the WIRE response**, not only the service projection, and see it **RED** against a deliberately-stripping model first. *This is the one genuine contract delta; everything else about the endpoint is already real.* **→ RULING: ✅ STANDS AS LOGGED (2026-07-19) — §3b's reshape row PROCEEDS IN PHASE 0.** |
| **9-13** | **Component gap — prose, search results, category filter** (§4) | `DESIGN-SYSTEM.md` has **no** long-form/prose/topic-index/search-results component (grep: one hit, the GlossaryTerm row). Help is the product's only prose page. New components are **forbidden** without an amendment. | **Build from ratified primitives now; defer any extraction.** An entry is a title + body in `.lf-card__body`; the reading measure uses the **already-sanctioned** inner-MEASURE cap (`DESIGN-SYSTEM.md §3.1`), not a page-root `max-width`. Search results reuse the same card. **If the prose block or results list recurs, extract at its SECOND site** per the centralisation rule — not pre-emptively. **No Markdown renderer** (no templating precedent; would need an ADR). **Owner confirms this is composition, not an unratified component.** |
| **9-14** | **IA §5 has no Help ownership entry** (§2) | Help has a page-map row (`IA:85`) and a nav slot (`IA:109`) but **no per-page canonical-ownership subsection** — so §2 of this plan is **derived**, which the template forbids doing silently. Legal has the same gap. | **Add an IA §5 subsection for Help** carrying §2's table, whose substance is the one-line rule: **Help owns the knowledge base and nothing else; it describes what a page is FOR and what a term MEANS, and never restates a figure, a number, or a procedure another page owns.** Spec-first, before Phase 2. **Flag that Legal (the next milestone) has the identical gap**, so it is fixed there rather than rediscovered. |
| **9-T** | **GLOSSARY additions** | Under §9-2(c) the parity guard extends to the served store, and §9-1 may pick terms not yet in the spec. | **Spec-first, always** (page-heatmap §13-1): **no term is added to any popover or served store before `docs/specs/GLOSSARY.md`.** The exact additions **cannot be enumerated until §9-1 and §9-2 are ruled** — §10-B's candidates are drawn from terms **already in GLOSSARY.md** precisely so the common case needs **zero** additions. **Any addition §9-1 forces is listed and ratified before Phase 4**, never improvised at build time. |

**Sign-off to start build (2026-07-19):** **§3b's reshape row is APPROVED** · no open item blocks Phase 0
· the ⚑ rulings that gate Phase 0 (**9-2**, **9-5**) are **RULED**. **Phase 0 PROCEEDS**, backend-first,
**one delta per commit, fail-first, contract regen in the same commit with the path-key count stated.**

**⛔ HARD STOP AT THE 0a SPECIMEN** — rendered Help page + a live popover + the three voice specimens
visible, **walked pixel-by-pixel for the owner. Ratifications in chat only.** Phases beyond 0a
(nav flip, the §9-1 retrofit, the owner walk) do **not** begin until 0a is ratified.

---

## 10. SURVEY DATA (the verify-first evidence behind §9)

### 10-A. Full `[Help]` render-site inventory — 41 sites

| # | File:line | term id | Label | Surface |
|---|---|---|---|---|
| 1 | `routes/Home.tsx:213` | term-net-worth | Net worth | `SummaryHead` tile title |
| 2 | `routes/Home.tsx:263` | term-todays-change | Today's change | `SummaryHead` lead tile title |
| 3 | `routes/Home.tsx:400` | term-briefing | Briefing | sub-heading, News tile |
| 4 | `routes/Markets.tsx:434` | term-gainers-losers | Gainers / Losers | card heading |
| 5 | `routes/Accounts.tsx:591` | term-account-kind | Kind | form field label |
| 6 | `routes/Accounts.tsx:595` | term-cost-basis-method | Cost-basis method | form field label |
| 7 | `routes/Reports.tsx:293` | term-statements | Statements | card title |
| 8 | `routes/Reports.tsx:349` | term-realised-pl | Realised P/L report | card title |
| 9 | `routes/Reports.tsx:409` | term-tax-lot | Open tax lots | card title |
| 10 | `routes/Scenarios.tsx:128` | term-exposure | Exposures | card title |
| 11 | `routes/Scenarios.tsx:144` | term-shock | Stress scenarios | card title |
| 12–17 | `routes/Insurance.tsx:388,405,410,415,421,425` | term-cover, term-premium, term-premium-frequency, term-renewal, term-insured-person, term-nominee | Cover amount, Premium, Premium frequency, Renewal date, Insured person, Nominee | policy-drawer field labels |
| 18 | `routes/Estate.tsx:250` | term-will-status | Will status | inline field label |
| 19 | `routes/Policy.tsx:300` | term-coverage | Coverage | DataTable row cell |
| 20–24 | `routes/Policy.tsx:316-320` | term-target, term-band, term-out-of-band, term-gap-to-target, term-concentration | Target, Band, Out of band, Gap to target, Concentration | legend strip |
| 25 | `routes/Policy.tsx:326` | term-untargeted | Untargeted | sub-heading |
| 26 | `routes/News.tsx:86` | term-briefing | Briefing | card heading |
| 27 | `routes/News.tsx:105` | term-headlines | Headlines | card heading |
| 28 | `routes/Review.tsx:166` | term-review | Review | card heading |
| 29 | `routes/Heatmap.tsx:125` | term-todays-change | Today's change | legend meta |
| 30 | `routes/Heatmap.tsx:162` | term-heatmap | Heatmap | footer help paragraph |
| 31 | `routes/CashFlow.tsx:309` | term-net-monthly-burn | Net monthly burn | figure label, runway card |
| 32 | `routes/CashFlow.tsx:334` | term-next-12-months | Next 12 months | card-header total label |
| 33 | `routes/CashFlow.tsx:366` | term-planned-cash-out | Planned cash out | card-header total label |
| 34 | `routes/Settings.tsx:372` | term-api-token | API tokens | card title, Privacy tab |
| 35 | `routes/Settings.tsx:1131` | term-routing-matrix | Routing matrix | card title, Data feeds |
| 36–40 | `routes/Settings.tsx:240,252,260,300,548` *(via `Field helpTerm`, renderer at :1189)* | term-density, term-high-contrast, term-reduced-motion, term-privacy-mode, term-data-provider | Density, High contrast, Reduced motion, No-egress mode, Market data provider | field labels |
| 41 | `routes/Holdings.tsx:616` *(via `ConfirmDialog helpTerm`, renderer at `ui/ConfirmDialog.tsx:74`)* | term-purge | literal `[Help]` | inside destructive confirm dialog — **the only literal `[Help]` string in the app** |

*(`routes/KitchenSink.tsx:1011,1083,1084,1085` are gallery specimens, excluded from the product count.)*

**Zero on-page sites:** Portfolio · Instrument Detail · Net worth · Pricing Health · Holdings *(modal
only)* · all chrome.

### 10-B. §9-1 candidate targets — **PROPOSED, for the owner to confirm / trim / extend**

*Every candidate is a term **already present in `GLOSSARY.md`**, so the common case needs **no** §9-T
addition. Deliberately sparse — SN-1 **DECLINED blanket-tooltip-everything** (noise + unbounded copy
burden).*

| Page | Anchor (surface) | Proposed term | Already in `mocks/glossary.ts`? |
|---|---|---|---|
| **Holdings** | table column header | **Unrealised P/L** | ✅ `term-unrealised-pl` *(currently dead — 0-D)* |
| **Holdings** | table column header | **Cost basis** | ✅ `term-cost-basis` *(currently dead)* |
| **Portfolio** | allocation card title | **Gross assets** | ✅ `term-gross-assets` *(KitchenSink only)* |
| **Portfolio** | stats card | **Concentration** | ✅ `term-concentration` |
| **Instrument Detail** | identity strip | **Data confidence** | ✅ `term-data-confidence` *(currently dead)* |
| **Net worth** | KPI strip | **Net worth** | ✅ `term-net-worth` |
| **Net worth** | trend card title | **Snapshot** | ✅ `term-snapshot` *(R-43, awaiting a site)* |
| **Net worth** | liquidity card | **Cash runway** | ✅ `term-cash-runway` *(KitchenSink only)* |
| **Pricing Health** | diagnostics column | **Data confidence** | ✅ `term-data-confidence` |
| **Chrome** | top-bar display toggle | **Density** | ✅ `term-density` |

**Note how this consumes four of 0-D's dead entries** — which is exactly why §9-8 proposes *not* deleting
them before this ruling lands.

---

## 11. §9-6 VOICE SPECIMENS — **PROPOSED, for the owner to ratify**

> **⚠ SUPERSEDED BY THE SHIPPED COPY (2026-07-19, Phase 1).** These three were drafted **before** the
> per-page audit, so they are proposals, not the product. The §9-6 ruling puts ratification **at the 0a
> specimen, by looking** — so what the owner ratifies is the copy that actually ships, rendered. The
> three specimens now correspond to live entries and are captured in the 0a walk: **`page-net-worth`**
> (Pages), **`term-data-confidence`** (Terms), **`guarantee`** (About). The drafts below are kept as the
> record of what was proposed, and the shipped text is what stands.

*Three rewrites of real entries — one per category — in the register the product already uses. The
catalogue ships **48 entries** (Pages 18 · Terms 29 · About 1).*

**Specimen A — a `Pages` entry** *(rewrite of `page-snapshot`, corrected per 0-C):*

> **Net worth.** What you own minus what you owe, and how that has moved. The page shows the current
> figure, a trend built from dated snapshots, a breakdown by asset class, the liquidity ladder, and your
> cash runway. Dates with no price or exchange rate are carried forward and flagged, never filled in with
> a guess — so a gap in the trend is a gap you can see.

**Specimen B — a `Terms` entry** *(rewrite of `term-confidence`):*

> **Data confidence.** A 0–100 score for how well-sourced a holding's value is. It starts from the
> valuation method and subtracts for each honesty problem — a stale quote, a missing identifier mapping,
> a source that returned nothing. Every deduction is itemised, so the score is always explainable rather
> than a verdict. A low score means the figure is poorly grounded, not that the holding is a poor one.

**Specimen C — an `About` entry** *(the guarantee, tightened):*

> **What LedgerFrame will never do.** It never places a trade. It never tells you to buy, sell or hold,
> and it gives no tax or financial advice. It never invents a price, a headline or a figure — where data
> is unavailable you get "—" and the reason. The AI explains figures that were verified elsewhere; it
> does not produce them. Your data stays on your machine, and nothing is reported anywhere.

**The rules these specimens encode (proposed):** second person, present tense · say what it **is** and
what it is **for** · name the honest limit plainly, as a feature of the design rather than an apology ·
**never prescribe an action** · no decision IDs, no endpoint or enum names · no marketing register ·
every product term spelled exactly as GLOSSARY spells it.

---

## 12. PHASE 0 RECORD — backend-first, one delta per commit (2026-07-19)

*Three deltas, each fail-first, each seen RED before the fix. **Phase 0 is backend-only** — no page
exists yet; the 0a specimen is the next step and the HARD STOP.*

### Delta 1 — pin the `/help` contract shape (§9-12) · `8653be3`

**Fail-first:** 3 tests RED before the fix (`test_help_endpoint_all_and_query`,
`test_help_wire_response_keeps_the_conditional_glossary_triad`,
`test_help_search_wire_response_omits_the_triad`).

**⚠ FINDING the plan did not predict — the route serves TWO shapes.** A naive single
`response_model` raised `ResponseValidationError: Field required: categories` against the **search**
response. The untyped `-> dict` had been hiding that `GET /help` returns the full catalogue
(`categories` + entries) while `GET /help?q=` returns a search result (`query` + compact entries).
It is a **union**, and the contract now says so. *A single loose model would have re-hidden exactly
what typing was supposed to expose.*

**The conditional triad trap held as predicted** (TEMPLATE §3b, `HoldingView.price_display`):
`what`/`why`/`improves` are `Optional` **and** the route sets `response_model_exclude_unset=True`,
so non-Terms entries serve the fields **absent, not `null`** — a null triad would render an empty
section on the page. The pre-existing projection test calls the **service**, so it could not have
seen either loss; the new guards assert the **wire**.

**Contract regen (same commit):** path keys **138 → 138** (a reshape, not an addition); component
schemas **58 → 62** (`HelpEntry`, `HelpResponse`, `HelpSearchEntry`, `HelpSearchResponse`); the 200
moves from an untyped object to `anyOf[$ref, $ref]`. `make api-contract-check`: current.

### Delta 2 — GLOSSARY.md becomes the enforced parent of the third store (§9-2c/d/e) · `cd62755`

**Fail-first:** `test_the_two_code_stores_use_ONE_id_per_concept` RED on two aliases —
`"Data confidence"` (popover `term-data-confidence` vs served `term-confidence`) and
`"Cash runway"` (`term-cash-runway` vs `term-runway`). Both reconciled to the popover spelling; no
other reference existed.

**§9-2(e) as ruled**, with **two corrections to the plan's own proposal**: of the 17 titles the plan
proposed exempting as "entry headings", **two were not headings** — `"Realised gains & tax lots"`
(D-026) and `"Total value"` (D-021) are **deprecated terms** the glossary says must not appear in UI
copy. Exempting them would have **laundered the defect under a rule invented to excuse it**. They
were flagged with their deciding IDs and their exemptions **expired in delta 3**, as written.

**Recorded blind spot:** the alias check joins the stores **by title**, so it cannot see an alias
whose title also drifted — which is the case for the third one (`term-realised-gains`). That is
written next to the guard, and the deprecated-wording guard (delta 3) is what covers the class.

### Delta 3 — the KB content pass + the accuracy guards (§9-5 Tier 1+2, §9-7)

**Content.** `Pages` entries **11 → 17**. Every stale claim the survey found was corrected, not only
the ones §0 had listed — the audit found more than the plan did: `page-settings` described **four**
tabs where **six** ship, `page-markets` named region tabs that are not the served ones
(**Americas · Europe · Asia-Pacific · Commodities · Crypto**), `page-holdings` named controls
(`"Add asset"`, `"Edit / import"`) that do not exist, and `page-home` listed **dropped** widgets
(top holdings, watchlist & FX). Seven new entries: **Accounts · Heatmap · Review · Insurance ·
Estate · Scenarios · Cash flow**.

**⚠ DEVIATION FROM THE §9-5 TIER 2 RULING — Legal's entry is NOT authored, and the owner should
rule on it.** Tier 2 named 8 pages; **7 shipped**. Legal is in the nav model but **`built: false`**
with no route, so an entry for it would send a reader to a page that renders *"isn't built yet"* —
a **dead end, in the milestone whose entire point is retiring dead ends**, and against Gate C3. It
is authored in the Legal milestone, **which is the very next one**. This is mechanised rather than
left to intent: `test_help_never_documents_a_page_the_user_cannot_open` fails if an entry names an
unbuilt page, and `test_every_built_page_has_a_help_entry` fails the moment Legal ships without
one. *Recorded as a deviation because it is one — the ruling said eight.*

**Guards (§9-7), each seen RED on real content:**

| Guard | What it caught when first run |
|---|---|
| every `Pages` title is a nav label, spelled identically | `Snapshot`, `Planning`, `Investment policy`, `Pricing health` |
| no entry documents an **unbuilt** page | (the rule that keeps Legal out) |
| every **built** page has an entry | the 7 that had none |
| no copy points at a redirect-only path | `/snapshot`, `/planning`, `/global` |
| **every deprecated row is triaged** | 5 rows the plan had never seen (`Review Centre`, `What needs attention`, `Planning (as page label)`, `Household`, `Needs a look`) |
| no copy uses a **deprecated term** | `Realised gains` ×3 entries, `Total value` ×2, plus the two titles |
| advice-free **across all categories** (was Terms-only) | **my own new Review copy** — *"not something you must act on"* |
| no decision ID / implementation note in served copy | clean |

**The deprecated guard honours the spec's own carve-outs rather than overriding them.** GLOSSARY
permits "paper gain" explicitly — *"colloquialism may be explained, not shown"* — and the
ongoing-cost entry names "total cost of ownership" only to say the two figures are **never** added
into one. Both are exempted **by (entry, row) with a written reason**, never by relaxing the match.

**⚠ FINDING — a retired term still ships as a Portfolio label, and was deliberately NOT fixed
here.** `app/services/analytics.py:189` serves a key-stat whose user-facing `label` is
**`"Total value"`** (D-021-retired). The help entry behind it was corrected and its `term_id`
repointed, but **Portfolio is a closed, accepted page**: changing its rendered copy needs a dated
delta note + a re-run pre-pass, which does not belong in a help-content commit. **Filed as
`ROADMAP.md` R-52, owner ruling owed** on pre- vs post-release.

**⚠ FINDING — three tests were PINNING the stale content.** `test_search_ranks_relevant_entries`
asserted the title `"Investment policy"`; `test_help_endpoint_all_and_query` asserted
`"Pricing health"`; `test_metric_glossary_terms_present` asserted `term-total-value`. They were
green for months **because they agreed with the defect**. Corrected in the same commit as the
content, with the reason written at the assertion. *A test that pins a wrong string is not
protection — it is the defect with a second vote.*

**Lesson — a keyword must DISCRIMINATE (new, from this pass).** The new Scenarios entry carried
`"what if"` in its keywords. The search tokenizer splits on non-alphanumerics, so that indexed the
bare token **`what`** at keyword weight — and `"what is xirr"` then ranked **Scenarios above
XIRR & TWR**. Caught by an existing ranking test. *An English question word in a keyword list
matches every question and distinguishes nothing; keywords are for discriminating terms only.*

**Tier 3 filed:** `ROADMAP.md` **R-51** — the ≈44 `[Help]`-marked terms with no catalogue entry,
POST-RELEASE per §9-5, with the verbatim principle recorded on the row.

**Gates:** full backend suite run **SOLO** at delta 1 (**1244 passed, exit 0**) and again at delta 3.
`ruff` clean. `make api-contract-check` current.

---

## 13. PHASE 1 + THE 0a SPECIMEN (2026-07-19) — walked, awaiting ratification

*Built to the §9-3 / §9-13 / §9-4 rulings. **STOP is here**: nothing beyond 0a (the §9-1 popover
retrofit, the owner walk) begins until the specimen is ratified in chat.*

### What shipped

| Piece | Detail |
|---|---|
| `frontend/src/routes/Help.tsx` + `.css` | Settings-template page; sections in the **served** category order |
| `frontend/src/api/help.ts` | the `helpContent` binding `docs/audit/03-API-SURFACE.md:51` had named and nobody had written |
| `AppRoutes.tsx` | `/help` registered |
| `nav.ts` | `built: true` — **the entire nav change** |
| `Help.test.tsx` | 8 tests: structure, triad-on-Terms-only, one-anchor, search-replaces, honest empty, honest error, deep link, filter |
| `e2e/overflow.spec.ts` | `/help` **and** `/help?q=` added to every sweep |

### §9-3 as ruled — ONE canonical anchor, and a deep link that really lands

**Search REPLACES the catalogue** rather than rendering matches above it. That is the criterion, not a
style choice: two renderings would put **two elements carrying `id="term-xirr-twr"`** in the DOM, and a
deep link would land on whichever came first. One entry, one anchor — asserted in unit tests *and*
measured in the walk (`DUPLICATE anchors: none`).

**The deep link is a query param, not a `#fragment`.** Under HashRouter the route already lives in the
hash, so a second fragment is not addressable and the browser performs **no** native anchor scroll. A
`#`-anchor would have *looked* native and silently done nothing. `?topic=` + an effect that scrolls is
the honest mechanism, and the landed entry is **visibly marked** — landing mid-page with no indication
is how a working deep link still feels broken.

### §9-13 as ruled — composition only, NO amendment requested

Built from `PageHeader` · `TextInput` · `Segmented` · `Button` · `EmptyState` · `Skeleton` · `.lf-card`
+ `.lf-card__body`. The reading measure uses the **already-sanctioned inner-MEASURE cap**
(`DESIGN-SYSTEM §3.1`), never a page-root `max-width` — **measured in the walk: prose 689px inside an
1086px card.** **No DESIGN-SYSTEM amendment is requested**, so there is nothing of that kind for the
owner to ratify here.

### §9-4 as ruled — one flag, and R-39 is untouched

`nav.ts` gains `built: true`. Nothing else: no new entry, no reorder, no new group, no component. R-39's
three recorded constraints (`ROADMAP.md:52`) — semantic-only colour · no avatar/account block ·
collapse-to-icon rides the **existing** D-078 `sidebar-collapsed` setting — all concern how the sidebar
**looks and persists**, not which items it lists, so **nothing here is re-done there**. page-chrome
**P-3** sized the nav density for all 19 RD-9 items **by name, Help included**, so this consumes a
reserved slot rather than forcing a re-density.

**Two pinned tests were inverted, not deleted** — `chrome.test.tsx` asserted Help's link was **null**,
and `AppShell.test.tsx` used `/help` as its unbuilt-route fixture (repointed to `/legal`). *The
progressive-reveal invariant is the thing being guarded; Help crossing from hidden to shown is exactly
the transition it exists to police.*

### The 0a walk (isolated instance: ports 8399/5199, temp data dir, `.env` snapshotted → verified
unchanged, throwaway vite config deleted, owner's stack untouched)

| Check | Result |
|---|---|
| Nav entry present, active, in the System group | ✅ `SYSTEM ǀ Settings ǀ Help` |
| Sections in served order | ✅ `Pages · Terms · About` |
| Entries rendered | ✅ **48** |
| Duplicate anchors | ✅ **none** |
| Reading measure capped | ✅ 689 / 1086 px |
| Containment @ 320 / 375 / 768 / 1366 | ✅ **no element overruns at any width** |
| Deep link `?topic=term-xirr-twr` | ✅ scrolled into view **and** marked |
| Search replaces catalogue | ✅ 6 ranked hits, `Policy` first |
| No-match | ✅ honest reason, not a blank |
| Live `[Help]` popover (Home → Net worth) | ✅ opens, overlays |
| Light + dark | ✅ both captured |
| **Console errors** | ✅ **0**, across every step and both themes |

`npm run check` from `frontend/`: **exit 0** (361 e2e). Backend suite: solo, green.

### ⚠ Two defects the walk caught that the guards did not

**1 — "Pricing health" (lowercase h) inside two Terms bodies.** My accuracy guard checks a `Pages`
entry's **own title** against the nav; it could not see a page named **in passing** inside another
entry's prose. Caught **by eye**, in the rendered page, twice. Fixed, and the guard extended:
`test_page_names_in_PROSE_use_the_canonical_casing` now checks every multi-word nav label in every
body/triad field. *A guard that checks a field checks that field — the walk is what finds the rest.*

**2 — the walk was reading a STALE backend.** The first run reported **47** entries when the catalogue
had 48: `uvicorn` was started before the content edits and serves the module it imported at boot. The
count is what exposed it — every other assertion was green and meaningless. Backend restarted, walk
re-run, **48**. *This is the recorded "a proof run against a stale module is worthless" hazard, and the
only reason it was caught is that one number was checkable against something known.*

### ⚑ ONE DESIGN JUDGMENT FOR THE OWNER AT 0a

**"Link to this topic" renders on all 48 entries.** It is what makes a topic shareable, and it is
honest — but it is 48 buttons on a page whose job is reading, and in the walk it reads as repetitive
chrome. Options: **(a)** keep as-is; **(b)** keep but reveal on hover/focus only (quiet until wanted —
*recommended*); **(c)** drop it — deep links still work, they would just be produced by the popovers
that link here (Phase 4) rather than by the page. **Not resolved unilaterally — this is the kind of
judgment 0a exists for.**

> **Answered at §9-bis-7** — the owner took option **(b)**, re-scoped into the new layout.

---

## §9-bis — 0a REJECTED; redesign rulings (owner in chat, 2026-07-19)

**Status: the §13 specimen above is SUPERSEDED.** It was walked, it was green on every guard it
had, and it was **rejected by looking**. That sequence is the point: a specimen can pass every
mechanical check and still be the wrong shape, and the only instrument that catches it is the
owner's eye on the rendered page. The gates were not wrong; they were not sufficient.

### §9-bis-0 (owner) — the rejection, and its reason

The first 0a specimen — **three-tab `Pages · Terms · About`, capped reading column,
submit-button search** — is **REJECTED**.

The capped prose measure was **DS-conformant and still wrong for this surface**. The Help landing
is a **catalogue surface, not a reading column**: the user arrives to *find* a topic, not to read
a document top-to-bottom, and a narrow measure makes a catalogue longer to scan for no benefit.

**Reading measure is not repealed — it is relocated.** It still applies **inside an expanded
entry**, where the user genuinely is reading prose. The distinction is *scanning vs reading*, and
the layout must serve whichever the user is actually doing at that moment.

> **⚠ VERIFY-FIRST NOTE on the mechanism named above (architect, 2026-07-19).** The ruling calls
> the rejected specimen **"three-tab"** and **"capped reading column"**. **The shipped code is
> neither**, and the record must say so before anyone builds against the description instead of
> the code:
>
> - **There are no tabs.** `Help.tsx:139` renders a **`Segmented` category filter** (`role="group"`
>   + `aria-pressed`, not `role="tablist"`); all three categories render **stacked simultaneously**
>   and the filter *narrows* the stack. `Help.test.tsx:55` asserts all three `h2`s present at once
>   — a tabbed layout could not pass it.
> - **There is no page-level column cap.** `Help.css:35-44` caps `.help__body` at **`78ch`** —
>   component-local prose only, which is exactly what DS §3.1 sanctions. The page root is
>   uncapped, as the 1728px shell-inset guard requires.
>
> **This changes nothing about the ruling.** The owner rejected **what they saw rendered**, and
> what they saw — three stacked category sections, prose in a narrow measure, a search that only
> answers on submit — is real. The rejection stands on the look, which is the only instrument that
> was ever going to catch it. The correction is recorded because §9-bis-0 otherwise leaves a false
> statement about the codebase in the plan file, and the next reader would inherit it. *Same
> discipline as the R-52 premise correction: the finding is right, the stated mechanism was not.*
>
> **Consequence for the rebuild:** "remove the tabs" is not a task — there are none. The real work
> is replacing a **filtered flat stack** with a **three-section journey**, and replacing a
> **submit-button** search with type-ahead (§9-bis-4). The `78ch` cap does not need removing
> either; per §9-bis-0 it **moves** to the expanded-entry body, where it is now correct.

### §9-bis-1 (owner) — the three-section user journey

Help is restructured into a **three-section user journey**, and **only these three sections**:

| # | Section | What it carries |
|---|---|---|
| 1 | **Orientation** | What problem the platform solves · why it exists · how it solves it · the **logical mental model for leveraging the pages together**. Links from this narrative into each page's Section-2 entry. |
| 2 | **Pages** | Per-page **expandable entries (accordion)**: expected user **inputs**, the **options**, the **outputs** the user sees, and **how to use / fill / interpret** them. **Pointers** for figures only. |
| 3 | **Glossary** | Terms ordered **basics → expert**, each with an explanation and a **worked example**. |

**IA law is binding on Section 2:** Help carries **pointers**, never figures. Help never becomes a
second home for any number — the canonical page owns it, Help says where to look and how to read
it. A figure rendered in Help would be a second derivation site and is forbidden on both counts.

### §9-bis-2 (owner, ⚑A) — R-51 tiering STANDS

Section 3 ships **now** with every **Tier-1 + Tier-2** term. **Tier 3** (~44 marked-but-unserved)
stays **post-release**, unchanged from the R-51 ruling. The governing principle, verbatim:

> **"Describing itself falsely is a release bar; describing itself partially is not."**

The **parity guard keeps reporting the marked-but-unserved count** as a non-blocking number, so
the gap stays visible instead of going quiet.

### §9-bis-3 (owner, ⚑B) — worked examples are STATIC, and R-53 is filed

Worked examples in Section 3 are **static and clearly marked as illustrative samples**.

Showing the **user's own** figures with step-by-step derivation would require the calculation
engine to **serve derivation traces** — new endpoints, a contract change. **Frontend
re-derivation is forbidden** (the one-derivation law); a Help page that recomputed a number to
explain it would become a second derivation site, which is exactly the failure the law exists to
prevent. Filed as **ROADMAP R-53, POST-RELEASE**.

### §9-bis-4 (owner, ⚑C) — search is TYPE-AHEAD

Search results appear **as the user types**, and are **pinned strictly to Help content** across
all three sections. The submit-button search of the rejected specimen is gone.
**Platform-wide search is out of scope and is NOT filed** — it was not deferred, it was declined.

### §9-bis-5 (owner, ⚑D) — Section-2 depth is accepted, with its cost

Section-2 depth is **accepted with its schedule cost acknowledged**. Recorded reason:

> **Comprehensive, accuracy-guarded documentation is a core trust mechanism for this product, not
> polish.**

This is the ruling that authorises the largest single content burden in the milestone. It is
recorded with its cost stated so that it is never later mistaken for scope creep.

### §9-bis-6 (owner) — About LEAVES Help, and moves to Settings

The **About tab is REMOVED from Help** and becomes a **card inside the existing Settings → System
tab**. **No 7th Settings tab.**

Content: brief platform description, author, credits, links —

- Platform · https://ledgerframe.org · https://github.com/gopalasubramanium/ledgerframe
- Author · https://me.sgopala.com/ · https://github.com/gopalasubramanium ·
  https://www.linkedin.com/in/gopalasubramanium/ · https://paypal.me/sgopala

**Copy is PROPOSED until the 0a look.** This is an **accepted-page touch on Settings** → a dated
delta note in `docs/plans/page-settings.md` **and** a Settings pre-pass re-run are required.
**Credits must be reconciled with `LICENSES.md`** — a credits list that disagrees with the
licence record is the page describing itself falsely.

### §9-bis-7 (architect, under delegation) — "Link to this topic", re-proposed

The ⚑ judgment above is answered: **option (b)**. "Link to this topic" is re-proposed inside the
new layout as a **reveal-on-hover/focus affordance or a per-entry icon** — **not** a persistent
button on every entry. **The owner rules at 0a by looking.**

Unchanged: deep links remain **`?topic=`** (HashRouter — a second `#` fragment is not
addressable), and there is **one canonical anchor per topic**.

### §9-bis-8 (architect, verify-first) — what the rebuild actually costs, found by reading the code

Three findings the rulings did not know about. Each is verified, not assumed.

**(a) EVERY pattern §9-bis-1 asks for is a NEW DS pattern.** `src/components/ui/index.ts` was
inventoried in full: there is **no Accordion, no Tabs, no CardGrid, and no generic
type-ahead-with-results-list** primitive. What exists: `Segmented` (the ratified tab substitute),
`Combobox` (a real type-ahead, but scoped and barred from MASTER-DATA categoricals by DS §5.1),
`DataTable`, and `.lf-card`. Card grids today are **page-local CSS** (`repeat(auto-fit, …)`) in six
routes with **no shared class**. So the topic-card grid, the accordion entry, and the type-ahead
results list are **three PROPOSED DS amendments**, built from ratified primitives where possible
and listed for owner ratification at 0a. *This is the schedule cost §9-bis-5 accepted, made
explicit.*

**(b) ⚠ An accordion runs into a RECORDED DECLINATION, and must not be built over it silently.**
`frontend/src/theme/tokens.css:186-191` records: *"accordion/collapsible groups were **DECLINED**
(hiding destinations costs a click + orientation)"*. There are **zero** `<details>`/`<summary>`
elements in the entire frontend — the declination held.

That declination is **scoped to the sidebar nav**, and its stated reason is about **destinations**:
collapsing the nav hides places the user can go. A Help entry is **content, not a destination** —
the entry's title stays visible when collapsed, so nothing is hidden except prose the user has not
asked for yet, and the catalogue-vs-reading distinction of §9-bis-0 is precisely the argument *for*
collapsing it. **The distinction is defensible and I am proceeding on it** — but it is recorded
here, and flagged in the 0a report, because building an accordion against a written DECLINED
without naming it would be exactly the kind of quiet precedent-breaking this plan file exists to
prevent. **Owner may overrule at 0a by looking.**

**(c) ⚠ The parity guard does NOT report the unserved count — the mechanism §9-bis-2 relies on
does not exist.** R-51 promises a *"visibility mechanism so this does not go quiet: the parity
guard reports the marked-but-unserved count as a non-blocking number"*, and §9-bis-2 restates it.
**`tests/unit/test_glossary_parity.py` contains no such counter** — verified by grep; the only
Tier-3 references are prose reasons inside `_HEADING_NOT_A_TERM`. The Tier-3 deferral was ruled
acceptable **because** the gap would stay visible; the thing making it visible was never built, so
the deferral currently rests on a mechanism that does not exist. **Building it is in scope for
Phase 0-bis** — a non-blocking reported count, fail-first like everything else. *A promised guard
that was never written is indistinguishable from a guard that silently stopped working, which is
why this is being fixed now rather than filed.*

---

## SCOPE-NOTES *(preserved verbatim — owner rulings recorded ahead of the draft; inputs to §9)*

### SN-1 — `[Help]` retrofit to the pre-affordance pages *(owner, 2026-07-14)*

**Retrofit `[Help]` to the pages built BEFORE the affordance existed — Holdings, Instrument Detail,
Portfolio, and the chrome.**

- **Targets are owner-picked, per page.** Which terms get a popover is a **judgment call the owner makes
  page by page** — not a rule automation applies.
- **Copy is PROPOSED → ratified at the walk.** Every popover body is drafted as PROPOSED and **ratified by
  the owner at the page walk**, like all user-facing copy.
- **Blanket-tooltip-everything is DECLINED.** Reason recorded: **noise + an unbounded copy burden**. A
  popover on every term trains the user to ignore all of them, and every one of them is a string somebody
  has to write, ratify, and keep true.

**Binding on the retrofit (from the existing rules, not new ones):**

- **A GLOSSARY term ships to the SPEC, not just the popover data** (page-heatmap §13-1). The glossary has
  **two stores** — `docs/specs/GLOSSARY.md` (canonical) and `frontend/src/mocks/glossary.ts` (what
  `[Help]` renders). **Add to `GLOSSARY.md` FIRST**, then the popover data.
  `tests/unit/test_glossary_parity.py` polices them: every popover term must exist in the spec with the
  **identical spelling**.
- Every retrofitted term must already exist in GLOSSARY with that exact spelling (CLAUDE.md hard rule), or
  its addition is a §9 item — **not an improvisation at build time**.

> **Verify-first note (2026-07-19):** SN-1's "**two stores**" is now known to be **three** — `help.py`'s
> served `Terms` entries are a third, unguarded store (0-E). SN-1 is not wrong; it is **incomplete**,
> because the third store was invisible until this pass read the engine. **§9-2 resolves it.**

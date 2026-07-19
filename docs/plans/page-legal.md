# page-legal — LEGAL milestone build plan

*Per `TEMPLATE-page-build.md`. **STATUS: §9 CLOSED (owner in chat, 2026-07-19) — BUILD OPEN.**
All eight items are ruled; the rulings are recorded in §9 below, and §3b / §4 / §7 / §8 are completed
from them. Phase 0 begins.*

**Milestone position:** Help is CLOSED (RATIFICATION §6). Legal is the next milestone, and
`page-help.md:718` names it as such — *"It is authored in the Legal milestone, which is the very
next one."*

---

## 0. SURVEY — what already exists (verify-first, before asserting anything)

*Every claim below is a file:line read during this kickoff, not a recollection.*

### 0-A. The route and nav entry already exist — as a **deliberate dead affordance**

| Fact | Evidence |
|---|---|
| Nav model carries Legal in the **System** group | `frontend/src/components/ui/nav.ts:65` — `{ label: "Legal", path: "/legal" }` |
| It is the **only** System item without `built: true` | `nav.ts:63-65` — Settings and Help both carry `built: true`; Legal does not |
| The sidebar therefore **does not render it as a link** | `frontend/src/components/ui/chrome.test.tsx:52` — `expect(screen.queryByRole("link", { name: "Legal" })).toBeNull()` |
| `/legal` is the repo's **canonical example of an unbuilt route** | `frontend/src/components/AppShell.test.tsx:346-350` — *"Repointed to /legal: Help is BUILT as of page-help Phase 1 … Legal is the remaining one (its milestone is next)"*, asserting `/isn't built yet/` |
| The honest fallback it renders today | `frontend/src/routes/NotBuilt.tsx:12` — `message="This page isn't built yet"` |

**Reading:** the dead-affordance rule is *already mechanised* — `built` is the flag, and flipping it
is the ship gate. This milestone's job is to earn the flag, not to invent the plumbing.

### 0-B. The IA already fixes Legal's scope and placement

- `docs/specs/INFORMATION-ARCHITECTURE.md:86` —
  `| **Legal** | `/legal` | System | License, disclaimer, Product Guarantees, no-jurisdiction-tax stance. |`
- `docs/specs/INFORMATION-ARCHITECTURE.md:109` — `6. **System** — Settings · Help · Legal`

**Four owned contents, already ratified by the IA.** The plan does not get to add a fifth without an
IA amendment, and does not get to drop one.

### 0-C. The Product Guarantees are already **destined verbatim** for this page

`docs/specs/PRODUCT-SPEC.md:60` — *"Destined verbatim for the glossary guarantee block, **the Legal
page**, and README"* — followed by the seven guarantees (`PRODUCT-SPEC.md:62-78`): no trades ·
no advice · no fabrication · no jurisdiction tax logic (D-077) · no egress (opt-in, D-004) ·
no stored AI conversations (D-016) · the validation contract never weakens (D-071).

This is the strongest constraint in the milestone: **the copy is already written and already
ratified.** Legal renders it verbatim; it does not paraphrase it.

### 0-D. Disclaimers are **already served, per-surface** — and that is not duplication

The product has a mature, consistent pattern: **each reader serves its own scoped `disclaimer`
string**, and the frontend renders it verbatim.

| Surface | Served string | Evidence |
|---|---|---|
| Confidence | *"Data-quality signal only — how well-sourced each value is. Not advice."* | `app/services/confidence.py:83` |
| Estate | *"Family governance — a record of what exists and where, and reminders …"* | `app/services/estate.py:161` |
| Insurance | *"Records and reminders only — not an assessment of whether your cover is …"* | `app/services/insurance.py:259` |
| Planning / goals | *"Progress is a fact against your target — not a forecast or advice."* | `app/services/planning.py:130` |
| Cash flow | *"Known future cash flows you've entered … Not advice."* | `app/services/planning.py:181` |
| Contributions | *"Recorded plans, not projections …"* | `app/services/contributions.py:142` |
| Accounts | *"Your holdings grouped by account / institution — reporting only."* | `app/services/accounts.py:103` |
| Tax lots | *"Open lots by FIFO. Organisation only — not tax advice."* | `app/services/tax.py:424` |
| AI answers | `disclaimer: str = "Information only, not financial advice."` | `app/schemas/ai.py:74` |
| Estate page subtitle | *"A record and reminders, never legal advice."* | `frontend/src/routes/Estate.tsx:231` |

**Exports carry their disclaimer INTO the file** — `app/api/v1/routes/portfolio.py:429-432`,
`app/services/tax.py:430,444,467` (*"BORN WITH ITS DISCLAIMER"*).

**This is the central §9 tension** (→ §9-2): per-surface disclaimers are **scoped caveats at the
point of use**, not copies of a general legal statement. If the Legal page is read as *the* canonical
home for "disclaimer", a naive one-canonical-home reading would delete them all — which would be a
severe honesty regression, against Guarantee 2 and against every per-page §9-5 honesty ruling.

### 0-E. The licence surface is already built, generated, and adjudicated

| Artifact | Nature | Evidence |
|---|---|---|
| Settings → About tab licence line | **rendered, hand-authored, client-side** | `frontend/src/routes/Settings.tsx:914-917` — *"Released under the AGPL-3.0-or-later licence and built on open-source software — the full dependency and licence record ships with the source."* |
| Guard on that line | it is *"the only sentence on the surface that is a legal …"* | `frontend/src/routes/Settings.test.tsx:480` |
| `docs/audit/LICENSES.md` | **GENERATED**, full transitive graph; *"This file reports; it does not adjudicate"* | `LICENSES.md:1-12` |
| Owner/counsel rulings | `scripts/license-adjudications.toml` — *"adjudication is an artifact, not a conversation"* | `LICENSES.md:8-9` |
| `NOTICE` | **GENERATED** wholesale by `write_notice()`; AGPL text + third-party deps | `NOTICE:1-12` |
| `docs/audit/ASSETS.md` | **hand-maintained** provenance register — *"the opposite of LICENSES.md"* (vendored assets, not dependencies) | `ASSETS.md:1-8` |
| `LICENSE` | the AGPL-3.0 text itself | repo root |

**Note the split the plan must not blur:** LICENSES.md/NOTICE audit **dependencies we do not
vendor**; ASSETS.md registers **assets we do vendor** (`ASSETS.md:5-8`). Also relevant: the
**About tab already exists** as of `page-settings` D-069 amendment #3 (`settings-smoke.spec.ts:18-21`
— seven tabs, About is the seventh).

### 0-F. Legal's Help entry is a **recorded, mechanised debt** owed to this milestone

`page-help.md:718-724` — the deviation, verbatim in substance:

> **⚠ DEVIATION FROM THE §9-5 TIER 2 RULING — Legal's entry is NOT authored.** Tier 2 named 8 pages;
> **7 shipped**. Legal is in the nav model but **`built: false`** with no route, so an entry for it
> would send a reader to a page that renders *"isn't built yet"* — a **dead end, in the milestone
> whose entire point is retiring dead ends**, and against Gate C3. It is authored in the Legal
> milestone, **which is the very next one.**

**Two guards enforce it — both verified present:**

| Guard | Location | What it does to this milestone |
|---|---|---|
| `test_help_never_documents_a_page_the_user_cannot_open` | `tests/unit/test_help_content_accuracy.py:127` | Blocks the entry **while** `built: false` |
| `test_every_built_page_has_a_help_entry` | `tests/unit/test_help_content_accuracy.py:142` | **Fails the moment Legal ships without one** |

**The two guards form a vice, and that is the design.** They make the Help entry and the `built: true`
flip a **single atomic step** — neither can land without the other. This *is* the HELP CURRENCY LAW
(CLAUDE.md) mechanised for this page: the close states the Help delta that shipped, guard-corroborated
by the HELP CURRENCY SUITE (`TEMPLATE-page-build.md:615-618`).

Help's served catalogue lives in `app/services/help.py` (1283 lines; `Pages` category entries from
`:88`). The Settings entry already mentions *"the licence it ships under"* (`help.py:550-551`).

### 0-G. GLOSSARY / terminology state

- `GLOSSARY.md:14` — the guarantee block is *"Destined verbatim for the glossary guarantee block,
  **the Legal page**, and README"* (the same sentence as PRODUCT-SPEC §3 — one source, two mirrors).
- `GLOSSARY.md:282` — *"The Estate page is a **readiness register, never legal or estate-planning
  advice**."*
- `GLOSSARY.md:310` — Reports Pack is *"A print/export artifact composed from canonical readers with
  **disclaimers preserved** … **Not a page in the IA sense**"* (D-038/D-061).
- **No GLOSSARY entry for "Legal", "Disclaimer", or "Licence" as terms.** → §9-7.

### 0-H. The Reports Pack (D-038) lane

`app/services/reports_pack.py:95-98` — `_disclaimer()` renders `<p class="pack-disclaimer">`; the Pack
composes **each reader's own** disclaimer (`:165,179,202-205,232,263,279,293`). `:50` records a
**reporting-only fallback caption for readers that serve NO disclaimer of their own.**

So the Pack **already has** a disclaimer discipline, sourced per-reader. → §9-4.

### 0-I. No backend Legal surface exists

`app/api/v1/routes/system.py` serves `/system/status`, `/system/config`, `/system/ai-config`,
`/system/version-check`, `/help` (`:826`) and others — **no `/legal`, no `/system/legal`.**
No `app/services/legal.py`. Whether Legal needs one at all is → §9-3.

---

## 1. IDENTITY *(pre-filled from the IA; confirm at build)*

| Field | Value | Spec ref |
|-------|-------|----------|
| Page name (H1 = nav label = route) | **Legal** | IA §2 (`:86`), D-022 |
| Route | `/legal` | IA §2 (`:86`); already in `nav.ts:65` |
| Nav group | **System** (Settings · Help · Legal) | IA §3 (`:109`) |
| Page template | ⚑ **→ §9-1** — not an overview, not a worklist; a static document surface | DESIGN-SYSTEM §3 |
| Rotation eligibility | **None** — a System page is not rotation content | IA §3 (D-044) |
| One-line purpose | *License, disclaimer, Product Guarantees, no-jurisdiction-tax stance.* | IA §2 (`:86`) — **verbatim** |

## 2. OWNERSHIP TABLE *(from IA §5 — the four IA-named contents)*

**Owns (canonical here):**
- The **Product Guarantees** block, rendered verbatim (`PRODUCT-SPEC.md:62-78`).
- The **no-jurisdiction-tax stance** (D-077) as a stated position.
- The **product-level disclaimer** — the general no-advice/no-execution/reporting-only statement.
- The **licence statement** for LedgerFrame itself (AGPL-3.0-or-later).

**Explicitly does NOT own (pointers only, no duplication):**

| Not owned | Canonical home | Legal's treatment |
|---|---|---|
| Per-surface disclaimers | each reader (`confidence.py:83`, `estate.py:161`, …) | **untouched** — they stay at the point of use (→ §9-2) |
| Dependency licence graph | `docs/audit/LICENSES.md` (generated) | pointer (→ §9-5) |
| Third-party notices | `NOTICE` (generated) | pointer (→ §9-5) |
| Vendored-asset provenance | `docs/audit/ASSETS.md` (hand-maintained) | pointer (→ §9-5) |
| The AGPL text | `LICENSE` | pointer (→ §9-5) |
| The About licence line | `Settings.tsx:914` | ⚑ relationship unresolved (→ §9-5) |
| The validation contract | `SECURITY-BASELINE.md` (normative) | Guarantee 7 names it; Legal does not restate it |

## 3. API SURFACE

### 3a. Endpoints consumed (already in the frozen contract)
**None.** Legal consumes only its own new endpoint (§3b).

### 3b. Contract deltas — **NON-EMPTY; the milestone is BACKEND-FIRST** (§9-3 ruled SERVED)

| Delta | Detail |
|---|---|
| **`GET /api/v1/legal`** | **NEW path.** Read-only, no query params, no secrets, no DB. Backed by `app/services/legal.py`, mirroring `app/services/help.py`'s shape (a module-level structured constant + an `all_legal()` accessor). |
| Response schema | **NEW.** `LegalResponse` — the product-level position, the seven Guarantees verbatim, the licence position + file pointers, and the Pack footer string. |
| Path count | **138 → 139.** Contract regenerated **in the same commit** as the route, both counts stated in the commit message (standing rule). |

## 4. COMPONENTS
**§9-1 ruled: no new components, no new template, no DESIGN-SYSTEM amendment.** Legal is a
**prose document composed from ratified primitives**:

| Primitive | Use on Legal |
|---|---|
| `PageHeader` | H1 **"Legal"** (= nav label = route, D-022) + the IA one-line purpose as subtitle |
| `Card` | one per IA content — **Disclaimer · Product Guarantees · Licence · No jurisdiction tax** |

**Full-width prose** per the standing DESIGN-SYSTEM §3 rule ruled and guarded at `page-help
§9-bis-14` (`4b0727e`) — **reused, not re-minted.**

## 5. VOCABULARIES
No categorical fields — Legal has no enums, no MASTER-DATA dependency. Terminology → §9-7.

## 6. DECISIONS IN FORCE
D-001 (single-user appliance; future-proprietary-layer path — bears on licence adjudication) ·
**D-004** (no-egress, Guarantee 5) · **D-016** (no stored AI conversations, Guarantee 6) ·
D-022 (H1 = nav label = route) · **D-038 / D-061** (Reports Pack; disclaimers preserved) ·
D-060 (*"for your accountant"*) · D-069 (Settings tabs, incl. About) · **D-071** (validation
contract never weakens, Guarantee 7) · **D-077** (no jurisdiction tax logic, Guarantee 4) ·
D-105 (money = served display strings — **does NOT govern prose**; the kickoff's citation is
corrected on the record at §9-3) · **D-106** (*the per-reader served-disclaimer convention* — minted
by this milestone at §9-3, giving an ID to the §0-D convention that was live and unruled) ·
**THE HELP CURRENCY LAW** (CLAUDE.md; page-help §9-bis-11(d)).

## 7. ACCEPTANCE CRITERIA *(completed from the §9 rulings)*

| # | Criterion | How it is guarded |
|---|---|---|
| **AC-L1** | `/legal` renders real contents; `NotBuilt` is unreachable at that path | route test + the 0a walk |
| **AC-L2** | `nav.ts` Legal carries `built: true` and the sidebar renders it as a link | **inverts** `chrome.test.tsx:52`; **repoints** `AppShell.test.tsx:346-350`, whose comment names Legal as the last unbuilt example and needs a successor or deletion |
| **AC-L3** | The seven Product Guarantees render **verbatim** | **string equality against `PRODUCT-SPEC.md:62-77`**, not by eye |
| **AC-L4** | `test_every_built_page_has_a_help_entry` green with a real Legal entry | `test_help_content_accuracy.py:142` (the vice's second bite) |
| **AC-L5** | The page claims **nothing** the product does not do — the **§9-8 NEVER list (a)–(d)** | new guard, **fail-first with RED specimens**: a jurisdiction-compliance claim · a warranty term beyond AGPL · abstract *"secure/compliant/audited"* · implied counsel review |
| **AC-L6** | **No per-surface disclaimer was removed by this milestone** (§9-2 corollary) | new **scoped-caveat registry** guard, **RED on a removed per-reader disclaimer** |
| **AC-L7** | Legal's copy meets the **Help truth bar** | Legal's strings join the **accuracy corpus**, markup-stripped, same bar as Help (§9-3's deciding rationale) |
| **AC-L8** | The Pack footer line matches Legal's served string **byte-for-byte** | fail-first test in the Pack suite (§9-4, one source / two renderers) |

## 8. BUILD PHASES *(completed — backend-first per §9-3)*

**Delta 0 (precedes Phase 0, own commit).** NetWorth `var(--radius-2)` regularization — dated delta
note in `page-net-worth.md` + Net worth pre-pass re-run (the new CLAUDE.md standing rule's first
application).

**Phase 0 — backend, one delta per commit.**
1. **GLOSSARY.md rows FIRST** — Legal · Disclaimer · Licence (§9-7 split noted); then the code
   stores; parity guard green; **Tier-3 counter movement stated honestly**.
2. **`app/services/legal.py` + `GET /api/v1/legal`** — contract regen **same commit**, **138 → 139**.
3. **Guards fail-first** — AC-L5 (RED specimens → green), AC-L6 (RED on a removed caveat → green);
   Legal joins the accuracy corpus.
4. **Reports Pack** — the single footer line from the served string; fallback caption unchanged;
   AC-L8 fail-first.

**Phase 1 — assembly.**
5. `/legal` page — prose document, both themes, containment **320 / 375 / 768 / 1366**, served
   strings for **all** states including the **load-failure** state.
6. **ATOMIC (§9-6, one commit):** Legal's Help entry **+** `nav.ts` `built: true`. Both accuracy-guard
   bites green. **HELP CURRENCY satisfied by construction.** About tab untouched (§9-5).

**Then STOP at the 0a specimen** for the owner's ratification — including every prose string.

---

## 9. NEEDS DECISION — **CLOSED (owner in chat, 2026-07-19).**

*The one-pass ran in chat on 2026-07-19. All eight items are ruled. **No ruling was typed in this
CLI** — the table below is the record of what the owner (and, where marked, the architect under
delegation) decided. The PROPOSED table that follows it is left standing unedited: it is the
reasoning the rulings were made against, and a plan that erases its own deliberation cannot be
audited.*

### 9-RULINGS — the record

| # | Ruled by | Ruling |
|---|---|---|
| **9-1** | architect, under delegation | **ACCEPTED as proposed.** Legal is a **prose-document composed from ratified primitives** — `PageHeader` + a stack of `Card` sections, one per IA content — **reusing the existing full-width prose rule** (`page-help §9-bis-14`, commit `4b0727e`). **No fifth template is minted and no DESIGN-SYSTEM amendment is taken.** The System-group⇒settings-template inference stays forbidden (`TEMPLATE:145-149`). |
| **9-2** | owner | **ACCEPTED — the two-kind split is ruled, in writing.** (a) **Scoped caveats** are **part of the figure**, served at the point of use, and **owned by their own surfaces**; Legal does not own, absorb, shorten, or centralise them. (b) Legal owns **ONLY the product-level position** (no-advice / no-execution / reporting-only). **Corollary, binding:** *removing a scoped caveat is an **honesty regression**, not a de-duplication* — enforced as a diff-level check by **AC-L6**. Written into **IA §5** (below) so it survives this milestone. |
| **9-3** | owner | **ACCEPTED — SERVED.** `GET /api/v1/legal`, backed by **`app/services/legal.py`** mirroring `help.py`. **The deciding rationale is the guard bar, not the transport:** served copy inherits the **Help truth-bar machinery** (the accuracy corpus), which client constants cannot. The milestone is therefore **backend-first** and **§3b is non-empty**. The kickoff's D-105 citation is **corrected on the record** — D-105 binds **money**, not prose; the real precedent is the per-reader served-`disclaimer` convention (§0-D), now given an ID as **D-106**. |
| **9-4** | owner | **ACCEPTED as proposed.** The Reports Pack gains **ONE product-level reporting-only / no-advice footer line**, sourced from the **SAME served string Legal renders** — one source, two renderers, no second code path (D-038 lane). **Per-reader disclaimers in the Pack are untouched**, and the **reporting-only fallback caption** (`reports_pack.py:50`) is **unchanged**. **The seven Guarantees stay OFF print artifacts** — they are a page, not a report footer. |
| **9-5** | owner | **ACCEPTED — keep BOTH licence mentions, with distinct jobs.** **About = credit** (*what this is and who built it*); **Legal = terms** (*under what terms you have it*). The honest alternative — delete the About sentence — was considered and **declined**. **Legal reproduces no generated file** (`NOTICE`, `LICENSES.md` stay canonical where they are generated). **"Pointer" means: names the file that ships with the source. Never a URL** — a local-first product cannot link to a hosted licence page. **The About tab is untouched by this milestone.** |
| **9-6** | architect, under delegation | **ACCEPTED — the scheduling commitment stands and is ATOMIC.** Legal's `Pages` entry in `app/services/help.py` and the `nav.ts` `built: true` flip are **ONE commit**. The two accuracy-guard bites (`test_help_content_accuracy.py:127` blocks the entry before the flip; `:142` fails the flip without the entry) **form the vice** — neither can land alone. HELP CURRENCY is satisfied **by construction**, not by promise. |
| **9-7** | owner | **ACCEPTED as proposed.** **User-facing prose = British "licence"**; **filenames and SPDX identifiers = "License"** (fixed by convention, not freely changeable). **The split is written into GLOSSARY.md as deliberate**, so it reads as a decision rather than as sloppiness. Three rows land this milestone: **Legal · Disclaimer · Licence**. |
| **9-8** | owner | **ACCEPTED — the NEVER list (a)–(d) is binding page-copy constraint, guarded by AC-L5.** The page **never**: **(a)** claims compliance with any **named jurisdiction's** regulation, statute or tax code (the product has no jurisdiction logic at all — D-077 / Guarantee 4, so any such claim is a fabrication); **(b)** offers **indemnity, warranty, or limitation-of-liability** terms **beyond what the AGPL already states** (restating §15/§16 in the product's own words risks contradicting the licence it ships under); **(c)** describes itself as **"secure" / "compliant" / "audited"** in the abstract; **(d)** implies **review by counsel** unless the owner states counsel reviewed it. **No legal text is drafted by this CLI.** Connective prose is composed from **ratified primitives only** and ships **PROPOSED until the owner's 0a look**. **Counsel review is recorded as the owner's OPTION, not a gate.** |

### 9-CONSEQUENCES — what the rulings changed elsewhere, this commit

- **IA §5** gains a **`### Legal (/legal)`** section carrying the **9-2 two-kind split** and the
  **9-5 About/Legal distinction**, dated 2026-07-19.
- **DECISIONS.md** mints **D-106** — *the per-reader served-disclaimer convention*, the convention
  §0-D found live with no decision ID (precedent: §0-D's ten surfaces; ruled at 9-3).
- **CLAUDE.md** gains a standing rule from the Help-close review (architect ruling): *when a new
  guard REDs an accepted surface, the fix ships **with** a dated delta note and that page's pre-pass
  re-run **in the same delta** — flagging alone is not sufficient.* Its first application is the
  **NetWorth `var(--radius-2)` regularization** (`page-net-worth.md`, own delta, before Phase 0).

---

### 9-PROPOSED — the reasoning of record (unedited, pre-ruling)

*⚑ = was an owner call. Every row's PROPOSED resolution was accepted; see 9-RULINGS above for the
authoritative wording and for the two places the ruling went beyond the proposal (9-3's D-106 mint,
9-5's explicit declining of the delete-About alternative).*

| # | Item | Why it blocks / what's needed | PROPOSED resolution (for owner to approve) |
|---|------|-------------------------------|--------------------------------------------|
| **9-1 ⚑** | **Page template for a static document surface** | IA §2 fixes Legal's contents but DESIGN-SYSTEM §3 maps pages to *overview / entity-detail / worklist / settings* — **Legal is none of them.** It has no data, no rows, no controls. TEMPLATE §1 warns against generalising group→template (the Reports-group clarification, `TEMPLATE:145-149`), so "System group ⇒ settings template" is exactly the inference that note forbids. New components are **forbidden** without a DESIGN-SYSTEM amendment (CLAUDE.md). | **Prose-document layout built from ratified primitives** — `PageHeader` (H1 "Legal", per D-022) + a stack of `Card` sections, one per IA content (Disclaimer · Product Guarantees · Licence · No-jurisdiction-tax). Precedent exists: the **About tab is prose in a ratified surface**, and its full-width prose rule was ruled and guarded at `page-help §9-bis-14` (commit `4b0727e`). **Proposal: reuse that ruling rather than mint a template.** If the owner reads Legal as needing a *named* fifth template, that is a **DESIGN-SYSTEM amendment and must precede build.** |
| **9-2 ⚑** | **Disclaimer scope — and the one-canonical-home collision** | *The load-bearing item.* CLAUDE.md: *"Every piece of information has ONE canonical page … Other pages may summarize it with a link, never duplicate it."* But **~10 surfaces serve their own scoped disclaimer** (§0-D) and **exports carry them into the file** (`tax.py:467` — *"BORN WITH ITS DISCLAIMER"*). A naive reading makes Legal canonical for "disclaimer" and every per-surface caveat a duplication to delete — a **severe honesty regression** against Guarantee 2 and every per-page §9-5 honesty ruling. Left unruled, a later reviewer will "fix" it in the wrong direction. | **Rule the two as different kinds, in writing.** (a) **Scoped caveats** — served, at the point of use, about *that reader's* limits (*"Open lots by FIFO. Organisation only — not tax advice."*). They are **part of the figure**, not a copy of the legal statement, and Legal **does not own, absorb, or shorten them**. (b) **The product-level position** — no-advice / no-execution / reporting-only, stated once, canonically, on Legal. **Legal owns (b) only.** Corollary to record: **removing a scoped caveat is an honesty regression, not a de-duplication** (AC-L6 makes it a diff-level check). ⚑ Owner confirms the two-kind split and that it is written into IA §5 so it survives this milestone. |
| **9-3 ⚑** | **Content source: served vs client-rendered — and a citation to correct** | Sets §3b, the build order, and the whole milestone's shape. **⚠ Citation note, verify-first:** the kickoff brief cited *"served strings per D-105"*, but **D-105 is about MONEY** — *"Quote-price display precision by asset class … money = served display strings"* (`DECISIONS.md:787-789`), scope-amended to *"D-105 BINDS ALL MONEY"* with **percentages explicitly out of scope** (`:793-798`). **D-105 does not govern prose.** The real precedent is the **per-reader served-`disclaimer` convention** (§0-D) and Help's served catalogue (`app/services/help.py`) — a **convention with no decision ID**, which is precisely why this needs a ruling rather than an inference. | **Serve it** — `GET /api/v1/legal` (or `/system/legal`, alongside `/help` at `system.py:826`), backed by `app/services/legal.py`, mirroring `help.py`. **Rationale:** (1) it matches every comparable surface — Help, and all ~10 disclaimers; (2) **accuracy guards bind server-side corpora**, so served copy inherits the *same truth bar as Help* (`test_help_content_accuracy.py`) — the brief's actual requirement; (3) the Reports Pack composes **server-side** (`reports_pack.py`), so served copy is reachable by §9-4 with no second code path. **Counter-argument recorded honestly:** Legal is static, never personalised, and needs no DB — the About licence line is client-rendered today (`Settings.tsx:914`), so client constants are *defensible* and cheaper. **The deciding question is the guard bar, not the transport.** ⚑ Owner rules; **§3b and Phase 0 hinge on this.** |
| **9-4 ⚑** | **Reports Pack interaction (D-038 lane)** | The Pack is *"composed from canonical readers with **disclaimers preserved**"* (`GLOSSARY.md:310`) and has a **fallback caption for readers serving none** (`reports_pack.py:50`). Unruled, the next Pack change either bolts the full Guarantees block onto a print artifact or silently drops the product-level position. Also: the Pack is *"Not a page in the IA sense"*, so IA one-canonical-home does not straightforwardly cover it. | **A single-line product-level footer, not the Guarantees block.** The Pack keeps its per-reader disclaimers **unchanged** (§9-2a) and gains **one** reporting-only/no-advice line sourced from the **same** string Legal renders (one source, two renderers — no second code path, satisfying D-038's "composed from canonical readers"). **The seven Guarantees do NOT go into the Pack** — they are a *page*, not a report footer, and would bloat every print artifact. ⚑ Owner rules whether the Pack gains the line at all. **If §9-3 rules client-rendered, this item becomes materially harder** (the Pack composes server-side and would need the string duplicated) — recorded because it is a real consequence of 9-3, not a separate question. |
| **9-5 ⚑** | **Licence surface — pointers vs duplication, and the About-line relationship** | Five artifacts already exist (§0-E): `LICENSE`, `NOTICE` (generated), `LICENSES.md` (generated, *"reports; does not adjudicate"*), `license-adjudications.toml` (owner/counsel), `ASSETS.md` (hand-maintained). **Duplicating any generated file into a page guarantees staleness** — `Settings.tsx:908-912` already records exactly this reasoning for the About tab. And the About tab **already** carries a licence sentence, so two System surfaces would speak about the licence. | **Legal states the product's own licence (AGPL-3.0-or-later) in one sentence and points; it reproduces no generated file.** The dependency graph, notices, and asset provenance **ship with the source** and stay canonical there. **On the About line: keep both, with distinct jobs** — About answers *"what is this and who built it"* (a credit), Legal answers *"under what terms"* (the position). ⚑ **Owner call, because this is the sharpest one-canonical-home collision in the milestone** and the honest alternative is real: **delete the About sentence and let Legal own the licence entirely.** Recorded as a genuine option, not a strawman. **A local-first product cannot link to a hosted licence page**, so "pointer" here means *names the file that ships with the source*, never a URL. |
| **9-6** | **Legal's own Help entry — authored IN THIS MILESTONE** | Owed by the `page-help.md:718` deviation (§0-F) and by the HELP CURRENCY LAW (CLAUDE.md). **Not open in principle — mechanically enforced.** Listed so it is scheduled, not so it is decided. | **No decision needed; a scheduling commitment.** A `Pages`-category entry for **Legal** is authored in `app/services/help.py` **in the same commit that flips `nav.ts` to `built: true`.** The two guards (`test_help_content_accuracy.py:127,142`) make that atomicity **structural**: 127 blocks the entry before the flip, 142 fails the flip without the entry — **neither can land alone.** The entry conforms to the §9-6 voice ruling (second person, present tense, names the honest limit, never prescribes an action, no decision IDs). Close states the Help delta, **guard-corroborated** by the HELP CURRENCY SUITE. |
| **9-7** | **Terminology gap — GLOSSARY has no entry for the page's own terms** | CLAUDE.md: *"Every term shown to users must exist in GLOSSARY.md with that exact spelling."* GLOSSARY has **no** entry for **Legal**, **Disclaimer**, or **Licence** (§0-G) — yet all three will be user-visible (nav label, section headings). A guard-adjacent gap: the nav-label/prose casing guard is live (`test_page_names_in_PROSE_use_the_canonical_casing`). | **Add three GLOSSARY rows in this milestone**, matching the rendered spelling exactly — **"Legal"** (the page), **"Disclaimer"**, **"Licence"**. ⚑ **Spelling is an owner call and the codebase is currently SPLIT:** the product renders British **"licence"** (`Settings.tsx:914-916`, and `.set__licence`), while the artifacts use American **"License"** (`LICENSE`, `LICENSES.md`) — the latter being **fixed by convention** (SPDX identifiers, filenames) and not freely changeable. **Proposal: user-facing prose = "licence"; filenames and SPDX = "License"**, with the split written into GLOSSARY so it reads as deliberate rather than sloppy. |
| **9-8 ⚑** | **What the product must NEVER claim on this page** | The brief asks this explicitly, and it is the one item where getting it wrong is a **product-integrity failure**, not a build defect. A legal page is the natural place to drift into reassurance the product cannot back — and CLAUDE.md is absolute: *"never executes trades, never advises, never fabricates a number."* | **Record a NEVER list as binding page copy constraints, guarded by AC-L5:** the page **never** (a) claims compliance with any **named jurisdiction's** regulation, statute, or tax code — the product has **no jurisdiction logic at all** (D-077/Guarantee 4), so any such claim is a fabrication; (b) offers **indemnity, warranty, or a limitation-of-liability** term beyond what the **AGPL already states** — the AGPL's §15/§16 are the warranty position, and restating them in the product's own words risks **contradicting the licence it ships under**; (c) describes itself as **"secure"**, **"compliant"**, or **"audited"** in the abstract (`SECURITY-BASELINE.md` is normative and specific; adjectives are not); (d) implies **review by counsel** unless the owner states counsel reviewed it. ⚑ **Owner call, and it may need counsel** — `LICENSES.md:8-9` already routes adjudication to *"owner/counsel"*, so the precedent for escalating is established. **Flagged as the item most likely to need input this CLI cannot supply: nothing here is a ruling, and no legal text should be drafted by me.** |

---

**§9 CLOSED 2026-07-19 (owner in chat).** §3b, §4, §7 and §8 above are completed from the rulings.
No ruling was typed in this CLI. **Phase 0 is open**; the build stops at the **0a specimen** for the
owner's ratification — including **every prose string on this page**, which ships **PROPOSED**.

---

## 10. PHASE 0 + PHASE 1 BUILT — **0a SPECIMEN, STOPPED FOR THE OWNER'S RATIFICATION** (2026-07-19)

*Isolated instance only (spare-port frontend → spare-port backend, temp `LEDGERFRAME_DATA_DIR`,
demo seed). `smoke-target.mjs` fail-closed; `SMOKE_ALLOW_LIVE` never set. The owner's live stack
was not touched. **Every prose string on this page is PROPOSED** and is ratified by the owner
looking at it — §9-8 bars this CLI from drafting legal text, and nothing here is a ruling.*

### 10-A. What shipped

| Delta | Commit | What |
|---|---|---|
| §9 record | `b5f0039` | §9 CLOSED; IA §5 Legal section; **D-106** minted; CLAUDE.md standing rule |
| NetWorth regularization | `b0ac8e3` | the Help close's `--radius-2` fix gets its delta note + pre-pass re-run |
| Phase 0.1 | `2dfa831` | GLOSSARY rows: **Legal · Disclaimer · Licence** |
| Phase 0.2 | `d46f9b3` | `app/services/legal.py` + `GET /api/v1/legal`; contract **138 → 139** |
| Phase 0.3 | `6be57a1` | **AC-L6** scoped-caveat registry · **AC-L7** accuracy corpus |
| Phase 0.4 | `8092969` | Reports Pack product-level footer (**AC-L8**) |
| Phase 1a | `2a7eec7` | the `/legal` page + route |
| Phase 1b **ATOMIC** | `b14a15e` | Legal's Help entry **+** `nav.ts` `built: true`, one commit |

### 10-B. AC status

| # | Verdict | Evidence |
|---|---|---|
| **AC-L1** | ✅ | `/legal` renders 6 cards; `NotBuilt` unreachable; 0 console errors |
| **AC-L2** | ✅ | nav `built: true`; sidebar renders the link (walked); `chrome.test.tsx` **inverted**, `AppShell.test.tsx` **repointed** |
| **AC-L3** | ✅ | 7 guarantees, string equality vs `PRODUCT-SPEC.md` §3, parsed at test time; verified again in the browser |
| **AC-L4** | ✅ | `test_every_built_page_has_a_help_entry` green with a real entry |
| **AC-L5** | ✅ | 4 NEVER bites, each driven **RED on the shipped corpus** then green |
| **AC-L6** | ✅ | discovered registry, floor 25; driven **RED** by deleting Confidence's caveat |
| **AC-L7** | ✅ | authored copy meets the full Help bar; one **named, reasoned** exemption (10-D) |
| **AC-L8** | ✅ | Pack footer matches the served string byte-for-byte; driven **RED** on one character |

### 10-C. The 0a walk (isolated, 2026-07-19)

- **H1** `Legal`; **six cards** in served order — Disclaimer · The limits on each figure · Licence ·
  No jurisdiction tax logic · **Product Guarantees** · Where to find the full record. The four
  IA-owned contents are all present, and the fifth and sixth cards are not new *contents*: "The
  limits on each figure" is D-106 stated to the reader, and "Where to find the full record" is
  §9-5's pointer list.
- **Guarantees:** 7, numbered, **verbatim** — the rendered text equals the served array exactly.
- **Pointers:** `0` anchors in the pointer list (§9-5 — a local-first page must work offline).
- **Containment:** doc overflow **0** and section overflow **0** at **320 / 375 / 768 / 1366 ×
  light and dark**. **0 console errors, 0 page errors.**
- **Nav:** the Legal link renders; **every nav item now carries `built: true`** — the
  dead-affordance backlog is empty for the first time.
- **Help:** the `page-legal` entry is live; the deep link `#/help?topic=page-legal` opens it
  expanded, with all three Section-2 blocks rendering.
- **Reports Pack:** footer present on a generated artifact and byte-identical to the served
  string; the `Reporting only, not advice.` fallback caption unchanged; **0 of 7 Guarantees**
  reached the artifact.

### 10-D. ⚑ OPEN FOR THE OWNER AT THE 0a — four items, none decided here

1. **Decision IDs are visible to users on this page.** Guarantees 4–7 render `(D-077)`, `(D-004)`,
   `(D-016)`, `(D-071)`. This is a **genuine collision between two live rules** — AC-L3/§9-8 rule
   the Guarantees VERBATIM; page-chrome §11-8 bars decision IDs from served prose — and no edit
   available to the build satisfies both, because the only one that would is an edit to the
   ratified source. Held by a **named, scoped, self-measuring exemption**. *Amend `PRODUCT-SPEC.md`
   §3 (the AC-L3 guard then carries the change here automatically and the exemption is deleted),
   or accept.*
2. **Backticks render literally.** `` `long_term_days` `` shows its backticks — the served markup
   subset has no code-span construct. It appears **twice**: in verbatim Guarantee 4, and in this
   build's **authored** no-jurisdiction section, which was written to match. *Fixing only the
   authored one would make two cards disagree, so both are left for one decision.*
3. **A dangling cross-reference.** Guarantee 7 ends *"the contract (below, §8)"* — a
   PRODUCT-SPEC-internal pointer that points at nothing on the Legal page.
4. **Prose rhythm.** A paragraph following a list, and consecutive paragraphs, sit **tight** —
   visible in the Disclaimer and Licence cards. The spacing comes from `HelpProse`, which is
   **shared with the accepted Help page**, so tightening it on Legal alone would make two prose
   surfaces disagree, and changing it globally is a delta on Help under the new standing rule.
   *Left for the owner precisely because it is not Legal's decision alone.*

### 10-E. Honest notes

- **The §0-D survey undercounted.** It found **10** scoped caveats; discovery found **25**. AC-L6's
  registry is generated from the tree for that reason.
- **Tier-3 counter moved 71 → 72 marked, 58 → 59 unserved.** Only `Legal` carries `[Help]`; its
  entry is a **Pages** entry, not a Glossary-category one, so it lands in the unserved bound the
  same way `Home` and `Heatmap` already do. Not new drift.
- **No code-store GLOSSARY rows were added** (a deviation from the brief's "then the stores",
  flagged at the time): the parity guard is directional, and popover entries with no UI to invoke
  them would be dead data.
- **The Pack's per-reader disclaimer count on this dataset is 1**, so the artifact demonstrates the
  footer and the fallback caption strongly and the *preservation* of per-reader disclaimers only
  weakly. The stronger evidence for preservation is the seeded unit fixture, where that assertion
  is a test.

**STOPPED. Awaiting the owner's ratification of every prose string on this page, and of the four
items in 10-D.**

---

## 11. 0a REVISION ORDERED — the owner looked, and ruled (2026-07-20)

> ## ⬛ RATIFIED — the owner looked, and accepted (2026-07-20)
>
> **THE 0a AND THE RE-LOOK ARE RATIFIED, AND §3b IS ACCEPTED, BY THE OWNER IN CHAT ON 2026-07-20.**
> No ruling was typed in this CLI; the owner's message is the acceptance record, and it named
> **all six** items:
>
> | # | Item | Where it lives |
> |---|---|---|
> | 1 | **The PRODUCT-SPEC §3 diff** — the rename + apparatus clean-up, read in full | [§11-C](#11-c-product-spec-3-cleaned-ac-l3-runs-unexempted--shipped-2026-07-20-4dcd987) |
> | 2 | **The two sentences** — the gate's acceptance prompt and explainer, PROPOSED since §9-8 because this CLI does not draft legal text. **They are now the owner's, and the PROPOSED flag is discharged.** | [§11-E1](#11-e1-the-acceptance-gate-server-side--shipped-2026-07-20-d44eee5) |
> | 3 | **The Legal page in BOTH THEMES** — six articles, anchors, formal register, containment | [§11-D](#11-d-the-formal-register--9-5-bis-convenience-links--shipped-2026-07-20-817235f) |
> | 4 | **The gate / stale / reset / decline behaviour** — including that a **reset ERASES acceptance** and the gate re-fires as `none` | [§11-E1](#11-e1-the-acceptance-gate-server-side--shipped-2026-07-20-d44eee5) · [§11-E2a](#11-e2a-reset-erases-acceptance) |
> | 5 | **The three DS items** — Checkbox · page-scoped Legal typography (registered, deliberately not promoted) · reading-return bar | [§11-J](#11-j-the-hard-rule-violation--a-raw-checkbox-in-the-gate-the-primitive-and-the-guard) → `DESIGN-SYSTEM.md` §5, flipped **PROPOSED → RATIFIED (dated)** |
> | 6 | **The architect's reading-bar ruling** — the two strings are state claims on the consent path and must be SERVED | [§11-K](#11-k-the-reading-bar-is-served--the-11-j-open-question-ruled-and-shipped-2026-07-20) |
>
> **§3b ACCEPTED in the same message** — the contract deltas this milestone introduced
> (`GET /api/v1/legal`, `/legal/acceptance` GET+POST, `/legal/gate-copy`) are accepted as the
> milestone's API surface. **Both counts at acceptance: 141 paths · 71 schemas.**
>
> **What this discharges:** the 0a is no longer *"superseded and not ratified"* — the re-look
> build it was superseded by has itself been looked at and accepted, so the milestone's design
> record is **closed**. **§11-OPEN item 2 (gate copy PROPOSED) is DISCHARGED** by item 2 above,
> and it was the last PROPOSED string in the milestone. **10-D item 4 (prose rhythm) is NOT
> discharged here** — it was never a Legal question; it remains a shared-`HelpProse` delta and is
> carried to the pre-release backlog, not closed by silence.
>
> *(The paragraph below is the pre-ratification framing, left unedited — it was true when written,
> and rewriting it would erase the record of where this milestone stood. §15 lesson 1.)*

*The owner read the rendered 0a specimen and ordered revisions. **No ruling was typed in this
CLI**; §11-RULINGS is the record of what was decided in chat on 2026-07-20. The 0a is therefore
**not ratified** — it is superseded by the build these rulings order, which stops again at a
**RE-LOOK** (§11-F). The three of the four 10-D items that the rulings dispose of are marked
against them below; the fourth is carried forward unchanged.*

### 11-RULINGS — the record

| # | Ruled by | Ruling |
|---|---|---|
| **11-1** | owner | **RENAME: "Product Guarantees" → "PRODUCT COMMITMENTS".** Rationale, stated: *"guarantee" is warranty-family vocabulary; the AGPL §15 position is **NO WARRANTY**; the seven are **self-enforced behavioural commitments, tested.*** The old name invited the reader to hear a warranty on a page whose licence section says there is none — the page contradicted itself in its own vocabulary. **GLOSSARY-first**, then the served strings, then the corpora; **historical records are history and are not rewritten** (see 11-B scope). |
| **11-2** | owner | **PRODUCT-SPEC §3 EDIT AUTHORIZED** — rename **+ apparatus clean-up**: (a) decision-ID parentheticals become **non-rendered annotations**; (b) backtick identifiers are replaced by **the human terms they mean**; (c) spec-internal cross-references (Guarantee 7's *"(below, §8)"*) are made **self-contained**. **Claims unchanged in substance.** **AC-L3 rules verbatim against the CLEANED source**, and the **self-measuring exemption is DELETED** — the guard runs unexempted. The **full §3 diff is captured in the report** for the owner's re-ratification read. *This disposes of **10-D items 1, 2 and 3** at their source: the edit the 0a said it could not make is now authorized, and AC-L3 carries it to the page automatically.* |
| **11-3** | owner | **9-5-bis — CONVENIENCE LINKS PERMITTED.** The **shipped files remain canonical** (§9-5 stands). Convenience links to external authoritative texts are permitted — e.g. the AGPL at `https://www.gnu.org/licenses/agpl-3.0.html` — **marked as convenience**, carrying `rel="noreferrer noopener"`, and **never load-bearing**: the page must remain complete and true with every link dead. This **amends** §9-5's *"Never a URL"* to *"never a URL **in place of** the shipped file"*. |
| **11-4** | owner | **FORMAL REGISTER.** The page reads as a **formal agreement**: numbered clauses and sub-clauses (**1, 1.1, 1.1.a**), **defined-term capitals**, and bold/italic conventions. **Register changes dress, never claims** — **AC-L5 / AC-L6 / AC-L7 / AC-L8 and the accuracy corpus (markup-stripped) still bind**, unchanged and unrelaxed. New **DS PROPOSED** items are raised for the owner: **formal-document typography** — clause numbering · defined-terms treatment · any new construct the register requires. |
| **11-5** | owner | **ACCEPTANCE GATE — NEW SCOPE, ACCEPTED INTO THIS MILESTONE.** The user must **accept the licence terms + the product position**; **unaccepted installs are LOCKED at entry.** Acceptance **binds to the hash of the served legal content**: a changed hash requires **re-acceptance at next entry**. The enforcement point is to be chosen **honestly** — a frontend-only lock is **theatre**; the gate is **server-side**, exempting only the legal-content, acceptance, and auth endpoints needed to render the gate itself. |

### 11-CONSEQUENCES — what the rulings change, and one they did not reach

- **10-D disposed:** items **1** (visible decision IDs), **2** (literal backticks) and **3** (the
  dangling *"below, §8"*) are **all resolved by 11-2 at the source** — the spec is cleaned and
  AC-L3 carries the cleaned text to the page. **Item 4 (prose rhythm) is NOT reached by these
  rulings** and is carried into the RE-LOOK unchanged: it remains a shared-`HelpProse` question
  that is a delta on Help, not on Legal alone.
- **Scope grows.** 11-5 adds a **backend store + migration + a server-side gate + a chrome
  change** to what was a documentation page. Per the standing CLAUDE.md rule, the **accepted
  surfaces it touches** (chrome/shell lock screen, first-run) take **dated delta notes in their
  own plan files and a pre-pass re-run**, in the same delta — not a footnote in a close report.
- **SECURITY-BASELINE:** the acceptance gate **composes with** the PIN flow and **never replaces
  or weakens it**. **§20-P is unchanged.** Recorded so that a later reader cannot mistake the
  new gate for an authentication boundary: it is a **consent** boundary in front of the same
  data, and an install with no PIN is no more protected after this milestone than before it.

### 11-OPEN — raised by this CLI against the rulings, not decided here

1. **§3's own subtitle becomes false.** PRODUCT-SPEC §3 is titled *"Product Guarantees (verbatim
   from DECISIONS.md)"*, and `DECISIONS.md:14-33` carries the same block. 11-2 authorizes editing
   **§3**; 11-B rules **DECISIONS.md is history and untouched**. After the clean-up the two
   diverge, and **§3's parenthetical would assert a verbatim relationship that no longer holds** —
   on the spec whose whole purpose in this milestone is to be the true source. Treating the
   subtitle as **apparatus** (11-2a) and restating the real relationship is inside the authorized
   scope and is what this build does; **it is flagged because it is a claim-adjacent edit, not a
   cosmetic one**, and the owner should see it in the §3 diff.
2. **Gate copy is PROPOSED**, per §9-8 — this CLI does not draft legal text, and the acceptance
   sentence is the most consequential string in the product: it is what the user is recorded as
   having agreed to.

> **Both items are now DISPOSED — see [§11-DISPOSITIONS](#11-dispositions--the-owner-ruled-on-the-four-raised-items-2026-07-20).**
> Item 1 was **endorsed** (the architect, on the §3 subtitle); item 2 ~~**stands PROPOSED** and is
> carried to the re-look with the gate copy~~ — **DISCHARGED 2026-07-20: the owner ratified the two
> sentences by looking (§11 banner, item 2).** Two further items raised *by the build* — reset
> erasure and hash granularity — were ruled at the same time and are recorded there; the hash
> granularity decision (whole-document, so any edit re-asks) is **ratified as built** under re-look
> item 4.

~~**§11 OPEN. The build resumes at 11-B and STOPS AT THE RE-LOOK.**~~
**§11 CLOSED 2026-07-20** — the re-look happened, the owner ratified all six items (banner at the
top of §11), and **§11-OPEN item 2 is discharged**: the gate copy is no longer PROPOSED. The
PROPOSED markers that lived in the **code** (`app/services/legal.py`, the `LegalGateCopy` docstring,
`api/legal.ts`, `AcceptanceGate.tsx`) are updated to RATIFIED in the same commit as this record —
a stale ⚑ in a source file outlives any plan file, and the next reader would have believed it.

---

### 11-B. THE RENAME — shipped (2026-07-20)

**GLOSSARY-first, as ruled.** `GLOSSARY.md` leads: the block is retitled **Product Commitments**
with the dated rename note and its *why*; a **Product Commitments** term row is added that
**points at that block rather than copying it** (the one-canonical-home rule applied to the
glossary's own page); the **Legal** row is redefined; and a **Deprecated terms** row retires
*Product Guarantees* / *Guarantee n*. Then the served strings, then the corpora.

**THE GREP — reported, as ordered.** `"Guarantee"` across the tree, triaged by whether a **user
can read it**:

| Where | Hits | Disposition |
|---|---|---|
| `app/services/legal.py` — served title, symbols, API key | 6 | **renamed** (`COMMITMENTS`, `COMMITMENTS_TITLE`, response key `commitments`) |
| `app/services/help.py` — the Legal entry's body · outputs · interpret | 3 | **renamed** (served prose) |
| `app/services/help.py` — the Legal entry's `keywords` | 1 | **old word KEPT, exempted by name** — keywords are a search index, not displayed copy; deleting it strands every user who knows only the old name |
| `app/services/help.py` — Orientation entry `id: "guarantee"` | 1 | **KEPT.** It is a live deep-link target (`#/help?topic=guarantee`); renaming it breaks every existing link for no reader-visible gain |
| `app/api/v1/routes/system.py` — response models | 4 | **renamed**; contract regenerated |
| `frontend/` Legal surface — page, api types, CSS classes, tests | ~20 | **renamed** |
| `docs/specs/` — PRODUCT-SPEC · IA · SECURITY-BASELINE · README headings/prose | 8 | **renamed** (living specs) |
| **`frontend/src/routes/PricingHealth.tsx:254`** | **1** | ⚑ **THE ONE USER-FACING STRING OUTSIDE LEGAL** — *"prices degrade to honest stale (Guarantee 5)"*, rendered on an **accepted page**. Handled as its **own regularization delta** with a dated note in `page-pricing-health.md` **and that page's pre-pass re-run**, per the standing CLAUDE.md rule — **not** swept into this one |
| `frontend/` + `app/` **code comments** citing "Guarantee 3/5" | ~25 | **DELIBERATELY UNTOUCHED.** They are internal decision-lineage citations, not UI copy; the deprecated table binds *"UI copy"*. Renaming them would touch a dozen accepted surfaces for zero reader-visible gain |
| `DECISIONS.md`, `RATIFICATION.md`, closed plan files | many | **HISTORY. Untouched**, as ruled |

**Two ordinary-English uses were protected, not swept.** Help's Liquidity entries serve
*"indicative, **not a guarantee** of sale price or timing"*. That is the plain English word, not
the retired term, and the deprecated row says so explicitly. The guard's pattern was **built to
spare it and measured against it** — an earlier draft of that pattern caught only 2 of the 4 real
hits, and the miss is recorded in the guard rather than quietly fixed.

**Guards.** The `test_every_deprecated_row_is_triaged_here` guard did its job unprompted: adding
the deprecated row **broke the suite** until the new term was given a pattern, which is the
mechanical-coverage property that module was built for. Backend **FULL solo: 1681 passed / 1
failed → fixed → green** (the failure was real — `test_reports_pack.py` imported the old symbol,
caught by the suite rather than by reading). Frontend `npm run check` **exit 0**. Contract
regenerated; **counts unchanged at 139 paths / 67 schemas** — a field rename is not a surface
change.

**A second live defect, found by the grep and fixed here.** `Legal.tsx`'s `PageHeader` subtitle
read *"**License**, disclaimer, …"* — **American spelling in user-facing prose**, which §9-7 ruled
against in as many words (*user-facing prose = British "licence"*; filenames and SPDX identifiers
keep "License"). The same wrong spelling was in **IA §5's page table**. Both corrected. It shipped
in the 0a and no guard caught it — **§9-7's ruling has no guard**, and that gap is now on the
record as a PROPOSED item for the re-look.

---

### 11-C. PRODUCT-SPEC §3 CLEANED; AC-L3 RUNS UNEXEMPTED — shipped (2026-07-20, `4dcd987`)

Ruling **11-2** authorized the edit the 0a said it could not make. §3's seven commitments are
cleaned **for rendering**: decision-ID parentheticals become a **non-rendered annotation table**
below the blockquote (AC-L3's parser reads **blockquote lines only**, so nothing there can reach a
user, and the lineage is kept rather than lost); the backticked `long_term_days` becomes **"the
Long-term threshold"**, the label the Settings control actually carries; and Commitment 7's
document-internal *"(below, §8)"* becomes self-contained. **Claims unchanged in substance.**

**Fail-first, observed rather than asserted.** AC-L3 went **RED on exactly the five edited
commitments** — 2 and 3 were untouched and stayed green — then green once the served tuple
matched. **No hand-edit on the `legal.py` side:** the guard carried every change across, which is
the whole argument for its existence.

**The exemption is DELETED, not narrowed**, and both self-measuring tests go with it: an exemption
that no longer exists cannot be measured, and a green test named after a solved problem is a
monument. The verbatim corpus now faces the **identical three-check bar** as authored copy. The
corpus **split survives, for a different reason than before** — it is now about **provenance** (a
red in `_verbatim` must route the reader to `PRODUCT-SPEC.md`, never to `legal.py`), not latitude.

**One clean-up beyond the three the owner named, flagged rather than slipped.** Commitment 1's
*"No order endpoints exist (Kite is market-data read-only)"*. Running the bar unexempted requires
it — *"endpoints"* is a banned implementation term — and **naming one provider understated the
commitment**, which binds *every* market connection. Now: *"has no mechanism for doing so. Its
market connections are read-only price data."* **See §11-DISPOSITIONS-2 — endorsed.**

**Two consequences handled, not left.** `GLOSSARY.md` held a **third copy** of the block that
nothing guarded; once §3 was cleaned it went stale silently — the exact failure the
one-canonical-home rule exists to prevent, in the worst possible file. Replaced with a pointer.
And **"Long-term threshold"** entered served copy with **no glossary row**, though it has been
user-visible in Settings since that control shipped. Added.

Backend **FULL solo: 1681 passed, 15 skipped.**

---

### 11-D. THE FORMAL REGISTER + 9-5-bis CONVENIENCE LINKS — shipped (2026-07-20, `817235f`)

Ruling **11-4**: the page reads as a **formal agreement**. A **preamble** fixing the defined terms,
then **six numbered Articles** over the same six served contents — **no content added, none
dropped, the IA unchanged.**

**Two build decisions, both PROPOSED until the owner's look:**

1. **Numbering is STRUCTURAL, never typed.** No served string carries a clause number; the renderer
   derives *"2.1.a"* from three indices. **Typed numbers are how a formal document rots** — insert
   a clause and every later number is silently wrong, *undetectably*, because the numbers are
   prose. Guarded two ways: the rendered sequence is asserted exactly, and **no clause may open
   with its own number**.
2. **The markup subset is UNCHANGED and `MARKUP_DIALECT` is NOT bumped.** Defined terms are
   Capitalised in the text itself, so no new inline construct was needed. The alternative was
   considered and **rejected on a safety ground, not a cost one**: guards read `strip_markup`
   output, and every new inline marker is one more way to split a phrase and send a guard quietly
   green. The contract change here is the **shape** of the content, not the dialect.

**9-5-bis (ruling 11-3) — each condition made MECHANICAL rather than intended:** the shipped file
stays canonical (every pointer must name one); the link is **marked as a convenience** and carries
`rel="noreferrer noopener"`; and it is **never load-bearing** — a guard **strips every URL** and
asserts the row still answers *"where is this?"*, including a check for descriptions that **defer
to their link**. That is the condition violated **by omission**, which is precisely why intention
alone could not hold it. URLs are **https-only and host-allow-listed**: an open `url` field on a
legal page is how it eventually points somewhere nobody vetted.

**Fail-first:** all three new guards driven **RED on deliberate specimens** — a deferring
description, an `http` URL, an unvetted host — before being trusted.

**Two guards caught this build, and both fixes were the build's to make, not the guards'.** The
Help entry said *"does not advise or act"* and the **advisory-phrase bar bit "advise"** — the bar
is blunt and **right** to be; the copy was reworded. And **AC-L6 and both accuracy corpora read the
old single-body shape**; they now walk **clauses and sub-clauses**, because an overreach buried in
a lettered item is exactly as damaging as one in a heading.

**Recorded because it is how guards go wrong:** an earlier draft of the frontend numbering guard
asserted *"no digits in any served string"* and matched **`AGPL-3.0-or-later`** and the dialect id.
The note lives in the test.

**HELP CURRENCY:** the Legal entry rewritten for the register, the rename rationale, and the
convenience-link marking.

Contract regenerated: **139 paths (unchanged) / 67 → 68 schemas** (`LegalClause` is new;
`LegalSection` → `LegalArticle` is a rename). Backend **FULL solo 1704 passed**. Frontend
`npm run check` **exit 0**.

---

### 11-E1. THE ACCEPTANCE GATE, SERVER-SIDE — shipped (2026-07-20, `d44eee5`)

Ruling **11-5**: unaccepted installs are **LOCKED at entry**, and the enforcement point chosen
**honestly** — *"a frontend-only lock is theatre"*.

**The gate is in `require_read_auth`**, the router-wide dependency every `/api/v1` read already
passes. **Proof it is not theatre:** the moment it landed, **22 of 25 tests in one integration
module went 451** with no browser involved. A React app that refused to render while `curl`
returned the whole portfolio would not be a weaker gate — it would be **the absence of one**.

**It runs BEFORE the PIN check, deliberately** — terms first, then unlock. After would leave an
unaccepted **PIN-less** install wide open, which is **every fresh install**. It runs for **API
tokens** too: a LAN widget is not a second party who can be exempt from this install's terms.

**451, not 401.** The request is well-formed and the caller may be perfectly authorised; what is
missing is **consent**. Collapsing them would leave the lock screen unable to tell *"unlock with
your PIN"* from *"read and accept the terms"*.

**The exempt set is exactly what rendering the gate needs.** `/legal` is exempt **as a matter of
principle, not plumbing**: a gate demanding acceptance of a text it would not show is asking for
consent that **cannot be informed**. `/system/status` is the one entry that is not self-evident, so
it is **named as a deliberate widening** rather than buried.

**Version-stamping:** the acceptance binds to a **sha256 of the served document**. Reword one
sub-clause and every install is asked again; change a comment, a CSS rule or a test and nothing
moves. A hand-maintained version constant was **rejected** — its failure mode is **silent and
one-directional** (text changes, version doesn't, users held to terms never shown). **See
§11-DISPOSITIONS-4 — whole-document hash KEPT.**

**An EVENT LOG, not a flag.** A flag keeps the answer and loses the question, and a decline would
erase the fact that an earlier acceptance happened. Status is **three-valued**: a user re-asked
because the document changed is **`stale`**, not **`none`**, and must not be greeted as a stranger.

**Found by the suite, not by reasoning.** Reset-data purges every table not in `RESET_KEEP_TABLES`
(§14dr-26), so a data reset **silently withdrew consent** and re-locked the app. This delta
**preserved** acceptance and flagged the counter-argument as PROPOSED. **The owner ruled the other
way — see §11-DISPOSITIONS-3; the behaviour is INVERTED in §11-E2.**

**A test that looked strong and proved nothing.** A test asserted 451 on five data endpoints;
**four were 404s**. A non-existent route refuses whether the gate works or not. It now asserts each
path **exists in the contract first**.

Contract: **139 → 141 paths, 68 → 71 schemas**. Backend **FULL solo 1712 passed**. Gate copy
**PROPOSED** (§9-8). **The frontend gate is not in this delta** — it is §11-E2.

---

### 11-DISPOSITIONS — the owner ruled on the four raised items (2026-07-20)

*Ruled in chat on 2026-07-20; **no ruling was typed in this CLI**. Two were the owner's to endorse
directly; two were taken **by the architect under delegation** and are marked as such — a
delegated ruling is **reversible by the owner at the re-look**, and both are listed in the PROPOSED
carry-forward for exactly that reason.*

| # | Item | Ruled by | Disposition |
|---|---|---|---|
| **11-D1** | **§3 subtitle rewrite** (raised as §11-OPEN item 1) | architect | **ENDORSED.** §3 is the **rendering source**; `DECISIONS.md` is the **ratifying record**. The old *"(verbatim from DECISIONS.md)"* asserted a relationship that the clean-up ended, on the one spec whose purpose in this milestone is **to be the true source**. The rewrite **sits in the §3 diff** and is carried to the owner's re-read there, not buried in a plan file. |
| **11-D2** | **Commitment 1 rewrite** (the clean-up beyond the three named) | architect | **ENDORSED.** It fixes **two** defects at once: an **AC-L7 violation** (*"endpoints"* is a banned implementation term, and the guard now runs unexempted) and an **understatement** (naming Kite implied the commitment bound one provider when it binds every market connection). **In the diff for the owner's re-read.** |
| **11-D3** | **Does reset erase acceptance?** | architect, **under delegation — reversible** | **RESET ERASES ACCEPTANCE. The earlier fix is INVERTED.** The gate binds **the person using the install**, not the machine. Reset returns the install to **first-run posture**; a preserved consent record would be **the previous user's**, and holding a new user to it would be **wrong**. So erasure-on-reset is now the **specified** behaviour — **deliberate, fail-first tested** (reset → gate re-fires; the accept/decline event log is wiped with the data) **and STATED in the reset-data confirmation copy so it is never silent.** Shipped in **§11-E2**. |
| **11-D4** | **Hash granularity** — whole document vs. materiality | architect, **under delegation — reversible** | **WHOLE-DOCUMENT HASH KEPT.** The alternative requires the product to make a **materiality judgment** about its own legal text — deciding which edits are small enough not to re-ask — and that judgment is exactly the thing a consent record must not make on the user's behalf. **Any change to served content re-locks.** The **cost is stated and accepted**: a typo fix in one sub-clause re-asks every install. |

**What 11-D3 and 11-D4 have in common, and why both are reversible:** each is a choice between a
**convenient** behaviour and a **conservative** one, and in both the conservative reading was taken
because the thing at stake is a **record of what a person agreed to**. Neither is a technical
finding; both are judgements the owner may take differently, which is why they are delegated
rulings on the record rather than build decisions in a commit message.

**§11-OPEN item 2 (gate copy) is NOT disposed** and stands **PROPOSED** to the re-look.

---

### 11-E3. §9-7 MECHANISED — the licence-spelling guard (2026-07-20)

**The defect that ordered this.** §9-7 ruled the spelling split *in as many words* — user-facing
prose takes British **"licence"**; **filenames and SPDX identifiers keep "License"** — and then
shipped **with no guard**. The 0a served *"**License**, disclaimer, …"* as the `PageHeader`
subtitle: the American spelling, in the most prominent prose on the very page the ruling was
about, with the same error live in **IA §5**. Neither was caught by review. Both were found by a
grep run for an unrelated rename. **A convention that lives only in a plan file is enforced by
whoever last read the plan file — which, over a long enough project, is nobody.**

**`tests/unit/test_licence_spelling.py` reads two surfaces, and needs both.**

| Surface | What it reads | Why it is not redundant |
|---|---|---|
| **Served payload** | `all_legal()` + `all_help()`, walked recursively | Asserts what a user is **sent**, not what someone typed — so a wrong spelling is caught whichever module produced it |
| **Authored frontend copy** | quoted literals in `routes/` + `components/ui/` | **The original defect was a `.tsx` subtitle.** A served-only guard would have sailed straight past it |

**Fail-first, both surfaces, observed:**
- the **real reverted `Legal.tsx` defect** → RED, naming `Legal.tsx:65`;
- an **injected `License` in served preamble prose** → RED, naming `legal.preamble`;
- restored → **94 passed**.

The real defect is kept **verbatim as a permanent specimen**, alongside four more must-bite strings
and seven must-spare ones, so the exact string that got through can never get through again.

**⚑ ONE REFINEMENT OF §9-7, RAISED AS PROPOSED — the ruling is under-specified.** Applied
literally, *"user-facing prose says licence"* would force the product to **misname the licence it
ships under**: `GNU Affero General Public License` is the **actual title of an actual document**,
and it is served on Legal's pointer row. **Renaming someone else's document to suit our house style
is not a spelling convention, it is an inaccuracy** — on the one page whose purpose is to state
that licence correctly. The guard therefore exempts **proper names** narrowly (known licence
titles, never the bare word), and **the owner should rule whether §9-7 is amended to say so.** The
other three exemptions — URLs, filenames/SPDX, and code identifiers — are either §9-7's own stated
carve-out or mechanical consequences of requiring a word boundary on both sides.

**Not guarded, deliberately and on the record:** British spells the **noun** *licence* and the
**verb** *license*. No served string uses the verb, so the guard treats every American spelling as
a defect. A future genuine verb use goes in `_VERB_EXEMPTIONS` **by name and with a reason** —
never by loosening the pattern, because widening a bar to admit one string quietly admits all of
them.

**Scope, stated so it is not mistaken for coverage it does not have:** the guard reads **served
content and authored frontend copy**. It does **not** read `docs/specs/`, where the IA §5 instance
lived. Those were corrected in §11-B and a grep confirms the specs are currently clean, but **that
is a measurement, not a guard** — a spec regression would not be caught. Widening to the specs is a
judgement about what counts as "user-facing" and is left for the owner rather than assumed.

**§11-E3a — A DEFECT IN THIS GUARD, FOUND AND FIXED THE SAME DAY (2026-07-20).** The first version
read **quoted literals only** — copied from `test_copy_hygiene.py` without asking whether that
extractor was sufficient here. It caught the `Legal.tsx` subtitle purely by luck of shape:
`subtitle="…"` is an attribute. **Rendered JSX children are not quoted**, so a whole class of
user-facing prose — every `<p>Sentence a user reads</p>` in the app — was invisible to a guard that
reported itself as covering those files. Found by grepping for an unrelated term and noticing the
scanner had missed a string that was plainly there. Now extracts **both** shapes, with the JSX
block-comment state tracked across lines so lineage notes are still spared, and with
`test_the_EXTRACTOR_reaches_copy_in_every_shape_it_ships_in` asserting the coverage claim directly
rather than leaving it assumed. Proven live: `License` injected into `PricingHealth.tsx`'s served
`<p>` → **RED at `PricingHealth.tsx:254`**. *Scanning a file and reading its copy are different
claims, and only the second one is worth a green.*

---

### 11-E2. THE ACCEPTANCE GATE, FRONT END — shipped (2026-07-20)

**This component is not the lock, and the distinction is the design.** The server refuses every
`/api/v1` read with **451** until this install has accepted (§11-E1). `AcceptanceGate.tsx` is the
only way a person can *answer* that refusal. **If the whole frontend gate were deleted, the data
would still be refused** — which is exactly the difference between a gate and a picture of one.

**THE ORDER MIRRORS THE SERVER: consent, then authentication, then setup.** The acceptance panel
renders in front of `LockScreen`, because the server's check runs before the PIN check. Any other
order asks a person to unlock an app whose terms they have never been shown.

| Requirement | How it is met |
|---|---|
| Checkbox + served copy naming exactly what is accepted | `ACCEPTANCE_PROMPT` rendered **verbatim** as the checkbox label; **Accept is disabled until it is ticked** |
| `/legal` readable **without** accepting | *Read the Legal page* hides the panel, opens the document, and shows a **return bar** — a state that is not a trap |
| PIN-less acceptance-only entry | Accepting **is** entry. No PIN is invented to stand in for consent — it is a **consent** boundary, never an authentication one |
| Decline recorded, stays locked | `Decline` POSTs `declined`, renders the served `declined_note`, and **the panel stays up** |
| Re-lock on hash change | Status `stale` renders the served `stale_note` — a returning user is told **why**, not greeted as a stranger |
| Reset erasure (§11-D3) | Handled by the same path as everything else — see the 451 listener below |

**THE CLIENT NEVER DECIDES WHETHER CONSENT STILL APPLIES.** `client.ts` announces **every 451** on
a window event and the shell re-reads the status. Consent can lapse for reasons the shell cannot
predict — a changed document, a data reset — and reacting to the server's refusal covers the causes
nobody enumerated as well as the two that were.

**A DEFECT FOUND BY DRIVING A BROWSER, WHICH REVIEW AND 1713 TESTS HAD BOTH MISSED.** On a
**PIN-protected, unaccepted** install the user was shown **the PIN prompt, not the consent panel**.
§11-E1 exempted the legal endpoints from the *acceptance* check and stopped there — they were still
behind the **PIN** check, which runs immediately after. So the shell could not read the consent
state or fetch the gate's copy, and `/legal` was **unreadable before accepting** on exactly the
installs most likely to have a real user behind them. **Every test in the gate's own module runs on
a PIN-less install**, which is why nothing caught it. Fixed by widening `_read_stays_open` to
`/api/v1/legal`, pinned fail-first by
`test_the_gate_can_RENDER_ITSELF_on_a_PIN_PROTECTED_install`. What that widening exposes, stated
exactly: **the Legal document** (public text that ships in the source tree), **the gate copy**
(likewise), and **the acceptance status** — a three-valued string, a hash and a timestamp. **No
holding, no figure, no personal record.** The PIN still guards every byte of user data.

**A SECOND DEFECT FROM THE SAME WALK.** After accepting, Home was **full of "Couldn't load this
summary"**. Pages fetch once in a mount `useEffect` and there is no shared query cache: a page
mounted *behind* the gate had every read refused, cached the honest error, and had no reason to ask
again. Each card's **Retry** worked — but making a user click six of them to undo a refusal the
product itself created **is not an honest empty, it is a mess wearing one**. The page subtree is
now keyed on an entry epoch and remounts when the gate clears. Verified: **0 occurrences** after.

**Fail-first, measured:** the nine gate tests were run against a build with `gateOpen` forced to
`false` — **all nine RED**, then green. A gate test that cannot fail when the gate is gone is
decoration.

**⚑ PROPOSED, carried to the re-look:** the **gate copy** (§9-8 — this CLI does not draft legal
text, and the acceptance sentence is the most consequential string in the product); the **reset
confirmation copy**; and a **DS item** — the checkbox-with-prose construct is the first of its kind
in the chrome layer, and whether it becomes a design-system primitive is the owner's call.

---

### 11-F. §9-7 AMENDED — official titles keep their official spelling (2026-07-20)

**Ruled by the architect under delegation, owner-confirmed in chat 2026-07-20. No ruling was typed
in this CLI.** §11-E3 raised the refinement as PROPOSED; it is now **the ruling**.

**§9-7 as amended:** *user-facing prose takes the British **"licence"**; **official names and
quoted titles keep their official spelling**; filenames and SPDX identifiers keep "License".* Our
own prose is unchanged — it stays *licence*, everywhere, without exception.

**THE AMENDMENT IS A NAMED ALLOW-LIST, NEVER FREE-FORM — and that half is binding.** The exemption
is `_OFFICIAL_TITLES` in `tests/unit/test_licence_spelling.py`: **eight titles, each written out in
full**, from which the exempt-span pattern is built and from nothing else. Adding a title is an act
of **naming**, with a name attached in a diff. The alternative reading — exempt anything
*title-shaped*, or anything in quotes — was rejected because it hands every author a way to spell
it the American way by capitalising a noun in front of it.

**That is not a hypothetical, it is measured.** The same amendment implemented free-form
(`(?:[A-Z]\w+ )+Licen[cs]e`) was run against the specimens:

| Specimen | Named list | Free-form |
|---|---|---|
| `You may use the Platform under this License.` | **RED** | RED |
| `Released under the Widget Foundation Public License.` | **RED** | **green — ESCAPES** |
| `Your rights are the rights the License grants.` | **RED** | RED |
| `The full text of the GNU Affero General Public License, version 3.` | green | green |

The middle row is the whole reason the ruling says *never free-form*, and it is now pinned as a
permanent RED specimen (*"a title-shaped string nobody listed"*) so the closure of the list is
tested rather than trusted.

**Fail-first, as the ruling required, observed:** RED on a free-form `License` in prose; **green**
on `GNU Affero General Public License`. Two more spare-specimens were added with it — a dependency
title on the list (`Apache License`) and **an official title inside quotes**, which is the *quoted
titles* half of the amendment made executable rather than asserted.

**Guard:** `tests/unit/test_licence_spelling.py` — **104 passed** (was 94; +10 specimens). The four
exempt contexts are now **official titles · URLs · filenames and SPDX identifiers · code
identifiers**, the last being a mechanical consequence of requiring a word boundary on both sides.

**Scope unchanged, and still stated:** the guard reads **served content and authored frontend
copy**. It does **not** read `docs/specs/`. That remains a measurement, not a guard.

---

### 11-G. NO SWEEP — internal specs keep "Guarantee" as historical vocabulary (owner, 2026-07-20)

**Ruled by the owner in chat 2026-07-20. No ruling was typed in this CLI.**

**The ruling:** `SECURITY-BASELINE.md` and the other internal specs **keep "Guarantee"**. There is
**no sweep**, now or later.

**The rationale, which is the load-bearing part:** the **deprecated-terms row binds UI copy — by
design**. `GLOSSARY.md`'s row retires *Product Guarantees* / *Guarantee n* **as terminology shown
to users**, and every instance a user can actually read was renamed in §11-B (served strings) and
§11-1 (the one remaining `PricingHealth.tsx` string). What survives in the specs is **decision
lineage**: an internal document citing *"(Product Guarantee 5)"* is naming **the thing that was
ruled, under the name it was ruled under**. Rewriting those citations would make the specs disagree
with `DECISIONS.md`, `RATIFICATION.md` and the closed plan files, which are **history and are not
rewritten** — the same principle §11-B already applied to the ~25 code comments and to the closed
plans, now stated as a ruling rather than a judgement call.

**The state, measured today (not asserted):** 24 instances across six specs —
`SECURITY-BASELINE.md` 9 (including the `## Guarantee 5 — the OUTBOUND-CALL INVENTORY` section
heading, a named enforcement record), `DESIGN-SYSTEM.md` 4, `PRODUCT-SPEC.md` 3, `API-CONTRACT.md`
3, `GLOSSARY.md` 3 (the rename note, the deprecated-synonym pointer, and the deprecated row itself
— all three of which **must** keep the old word to do their job), `INFORMATION-ARCHITECTURE.md` 2.
**All 24 are citations or the retirement record. None is user-facing copy.**

**What this ruling closes:** the §9-7 guard's stated scope gap — *"it does not read `docs/specs/`"*
— is **no longer an open question about whether to widen it**. The specs are deliberately outside
the bar, so a guard over them would be a guard over history. The scope stays as §11-E3 states it.

---

### 11-H. CORRECTION TO THE §11-B RECORD — the claim exceeded the change (2026-07-20)

**Owner-ordered, non-negotiable. Appended, not edited in place: a correction that overwrites the
thing it corrects is not a correction.**

**THE CLAIM.** §11-B's commit message (`fc506c5`) reported the rename as *"GLOSSARY.md leads …
**then the served strings, then the corpora**"*, and its grep table — reproduced in §11-B above —
carried the row:

| Where | Hits | Disposition |
|---|---|---|
| `docs/specs/` — PRODUCT-SPEC · IA · **SECURITY-BASELINE** · README headings/prose | 8 | **renamed** (living specs) |

**THE CHANGE.** `git show fc506c5 --numstat` on those files:

| File | Lines changed |
|---|---|
| `docs/specs/SECURITY-BASELINE.md` | **2** |
| `docs/specs/PRODUCT-SPEC.md` | 3 |
| `docs/specs/INFORMATION-ARCHITECTURE.md` | 2 |
| `README.md` | 1 |

**THE GAP, stated exactly.** The number *8* was arithmetically true — eight lines were changed.
**The word "renamed" was not.** At `fc506c5^` there were **35** instances of "Guarantee" across
`docs/specs/*.md`; the delta changed eight of them and **27 survived**, including — in the file the
row names — the section heading `## Guarantee 5 — the OUTBOUND-CALL INVENTORY`. Two further specs
carrying the term, `DESIGN-SYSTEM.md` (4) and `API-CONTRACT.md` (3), **were not in the table at
all**, so the row also understated its own denominator. A reader of that record would conclude the
specs had been swept. **They had not been, and the record is hereby corrected.**

**What is NOT being corrected:** the survivors were never a defect. §11-G has since ruled that they
**stay**, deliberately, as historical vocabulary. **The error was in the reporting, not in the
code** — which is precisely why it needed catching by something other than a passing suite. Every
test was green; nothing a guard measures was wrong. The only thing wrong was **the sentence
describing what had been done**, and the only reader positioned to catch it was the owner, reading
the diff against the claim.

**Why this is filed as a correction and not a footnote.** §11-B's record is **the record** — the
next reader of this milestone learns what happened from it, and it said the specs were renamed.
Leaving that standing while adding the true state elsewhere would produce a plan file that
contradicts itself and a reader who believes whichever section they read first.

---

### 11-I. CONTRACT DRIFT FROM §11-E2a — found at the re-look, fixed here (2026-07-20)

**Found by running `scripts/check_api_contract.py` for the Step-2 gate refresh — RED.** Not caused
by Step 1, which touched one test module and this plan file and cannot move an HTTP contract.

**The cause.** §11-E2a (`c18b847`) added the erasure paragraph to `POST /api/v1/system/reset-data`'s
docstring — *"ALSO ERASES YOUR ACCEPTANCE OF THE LEGAL TERMS (page-legal §11-D3) …"* — and **did not
regenerate the contract**. FastAPI serves that docstring as the operation `description`, so it is
**contract surface**, not a comment. The committed contract has been describing that endpoint
without the erasure since `c18b847`.

**What it is, and what it is not.** Description-only: **141 paths / 71 schemas, unchanged** on both
sides of the regeneration. No path, parameter, schema or status code moved. The defect is that a
generated artifact stopped matching its generator — the class of drift the check exists for.

**Why it is worth its own delta rather than a line in a report.** The one place a reader looks to
learn what `reset-data` does is the contract, and the contract said the reset kept an acceptance it
erases. §11-D3's whole point is that the erasure is **never silent**; a stale contract is one more
surface saying otherwise. The confirmation copy stated it, the docstring stated it, and the
published contract did not.

**Fixed:** `python scripts/check_api_contract.py --write` → `docs/specs/API-CONTRACT.json` +
`docs/openapi.json` regenerated; check now exits **0**.

**Lesson, carried to §15:** a docstring on a routed handler is **served text**, and the contract
regeneration belongs in the same commit that edits it — the same same-commit discipline §11-B
already applied when it renamed the response models.

---

### 11-J. THE HARD-RULE VIOLATION — a raw checkbox in the gate; the primitive and the guard (2026-07-20)

**Found by honest self-report at the re-look, not by any check.** Nothing went red. `npm run check`
exited 0, the suite was green, the Playwright pre-pass passed, and the §11-E2 review was written and
read. This was found by re-reading the file against CLAUDE.md's hard rules, one at a time.

**THE VIOLATION.** `AcceptanceGate.tsx:90` (`§11-E2`) rendered a hand-rolled
`<input type="checkbox">` with its own `useId`, its own label wiring, and no focus ring of its own.
CLAUDE.md and DESIGN-SYSTEM §6 both say, in as many words: *"Every user input uses a component from
`src/components/ui/`. Raw `<input>`, `<select>`, or ad-hoc styling is forbidden."*

**Why nothing caught it.** Every gate that ran asks whether the control **works**. The unit tests
found it by `getByRole("checkbox")` and clicked it; it ticked, and the Accept button enabled. The
token check asks whether values resolve through tokens — this element had **no** styling at all, so
there was nothing to fail. The pre-pass asks whether the page contains itself and logs no errors; an
unstyled native checkbox does both. **Not one of them asks whether the control is the SANCTIONED
one**, because until this delta no gate in this repo ever did.

**It is a mitigating fact and not an excuse that the file lives in `src/components/ui/`.** The rule
is about *primitives owning native elements*; `ui/` is where primitives live, which is exactly why
a raw element there is harder to see and not easier to justify. The other fifteen raw `<input>`s in
this tree are each inside their own primitive — `TextInput`, `MoneyInput`, `DateInput`, `FileInput`,
the PIN fields — which is what the rule looks like when it is being kept.

**THE FIX — three parts, `7011522`.**

1. **The Checkbox primitive** (`Checkbox.tsx` + `inputs.css`): label association, Space-key
   operation, `:focus-visible` ring from `--focus-ring`, disabled state that dims the label too,
   both themes via semantic tokens only. **The native input is kept and visually replaced**, not
   reimplemented on a `<button>` the way `Switch` is — `role="switch"` has no native element so
   Switch had to build one, whereas a checkbox **has** one and every part of consent machinery
   (announcement, the Space key, submission) is got right by construction only by using it.
   **No copy lives in the component**; `label` is the caller's string.
2. **The gate consumes it.** **No copy change** — the served prompt is passed through **verbatim**
   as the label; the acceptance sentence remains PROPOSED as served (§11-OPEN item 2, still open).
   `.lf-gate__check` keeps the **frame** only, and `.lf-gate__prompt` is **deleted** because its
   styling now belongs to the primitive: a surface that keeps its own copy of a primitive's
   typography is the next drift.
3. **`check:primitives`** (`scripts/check-ui-primitives.mjs`), wired into `npm run check` beside
   `check:tokens` / `check:copy` / `check:smoke-isolation` — **the standing suite, not a one-off**.
   No raw `<input type="checkbox">` anywhere in `src`, allow-list of **exactly one file**: the
   primitive that owns the element. Scope is deliberately the type that was **violated** rather
   than a speculative sweep over every input type; widening it to `<select>` is a deliberate act
   with a ratified primitive behind it, not a regex someone broadens on a hunch. It is **pinned
   against going blind** — if `Checkbox.tsx` ever stops holding a native checkbox the guard fails
   loudly rather than passing by protecting nothing (the `--text-primary` lesson from the token
   check).

**FAIL-FIRST — driven RED twice.** Blind first (guard present, primitive absent → *"the guard would
pass by protecting nothing"*), then on the real violation: `✗ Raw checkbox input: 1 occurrence(s)
… src/components/ui/AcceptanceGate.tsx:90`. Green only after the gate consumed the primitive.

**A defect in the guard, found while driving it and fixed before it was trusted.** The first version
stripped comments **without preserving newlines** and therefore reported `AcceptanceGate.tsx:87` for
a violation on line **90**. A guard that names the wrong line sends its reader to innocent code and
teaches them to distrust it — the same genre as the §11-D numbering guard that matched
`AGPL-3.0-or-later`, and the note lives in the script for the same reason.

**Also shipped:** the primitive exported from `ui/index.ts`; a four-state **KitchenSink §5.1
specimen** (unticked · ticked · disabled · long wrapping label) so the owner ratifies it on the
surface primitives are ratified on; **5 unit tests**, one per behaviour the primitive exists to
centralise, so *"the gate has a working checkbox"* and *"the checkbox is correct"* stop being the
same claim.

**DESIGN-SYSTEM** (`9d14994`, all **PROPOSED** pending the owner's look): Checkbox into the §5.1
inventory; **Legal formal-document typography registered as page-scoped** and deliberately not
promoted; the **reading-return bar**.

**⚑ RAISED, NOT DECIDED.** The reading-return bar's two strings (*"You are reading the Legal page.
Nothing has been accepted yet."* / *"Return to accept"*) are **authored in `AppShell.tsx`**, not
served — unlike every string inside the gate (§9-3/§9-8). They state **UI state** rather than terms,
which is the likely reason they were never questioned, but they sit **on the consent path**. Not
changed here; for the owner.

**HELP CURRENCY:** **no Help impact** — corroborated. No served string, no route, no user-visible
copy and no user-facing behaviour changed in this delta; the gate renders the same served prompt,
verbatim, through a different control. HELP CURRENCY SUITE green below, and it can **see** this
surface: the accuracy corpus binds Help's Legal entry to the gate's live served strings, which are
unchanged and therefore still matched — a claim of no-change that the corpus would have broken had
the copy moved.

#### The isolated re-render (2026-07-20) — `8f087c4`

Driven on the isolated stack (**5199 → 8399 → temp data dir**; the owner's `5173`/`8321` untouched,
`.env` snapshotted and verified byte-identical after, both servers killed by PID). Two screenshots,
**resting** state (unticked, unfocused — the state a person actually arrives at):
`docs/plans/assets/relook-5-checkbox-gate-pinless.png` and `…-pin-protected.png`.

**The two files are BYTE-IDENTICAL, and that is the result, not a mistake.** The gate sits in front
of the PIN, so a PIN-protected unaccepted install must show the **same consent panel** as a PIN-less
one. That equality is the §11-E2 fix holding — **driven, not assumed**, which is §15 lesson 5.

**Measured on the live render — both themes × both gate states:**

| Behaviour | Light | Dark |
|---|---|---|
| Label association (`label[for]` == `input[id]`, no `aria-label`) | ✓ | ✓ |
| Space toggles **and** untoggles | ✓ | ✓ |
| Ticked box — background / tick | `#24476f` / `#ffffff` | `#6f9fd4` / `#0f172a` |
| Focus ring (`--focus-ring`) | `2px solid #24476f` | `2px solid #6f9fd4` |

**Console: 116 errors, every one of them the expected `451`** an unaccepted install answers each
`/api/v1` read with — i.e. the server-side gate (§11-E1) working. **Zero others.**

**A defect in the PROBE, found and fixed while driving it — not a product defect.** The first read
reported the ticked box as still `--surface`, which looked exactly like a broken `:checked` rule.
It is not: `background` and `border-color` are **transitioned** on that element, and
`getComputedStyle` **mid-transition returns the interpolated value**. `color` is not in the
transition list, which is why it alone appeared to apply — the asymmetry that gave it away. A 400ms
settle was added. Recorded because *"the guard is wrong"* and *"the code is wrong"* look identical
for exactly as long as it takes to check which, and this is the third time in this milestone
(§11-D's `AGPL-3.0-or-later` match, §11-J's line-number defect) that it was the instrument.

**One accident, corrected in the open (`fe0d68b`).** The throwaway `vite.prepass.config.ts` was
swept into `8f087c4` by a `git add -A` while it still existed on disk. It is **deleted in a
follow-up rather than amended away**, so the record of what `8f087c4` contained stays true (§15
lesson 1). It names `5199`/`8399` and never the owner's live ports, so it was not a
smoke-isolation violation — it is removed because **a committed dev driver is a topology the next
reader copies**.

#### GATES — refreshed for what this delta touched (solo, 2026-07-20)

| Gate | Result |
|---|---|
| `npm run check` (frontend, full chain) | **exit 0** |
| ├ lint · typecheck | clean |
| ├ `check:tokens` | ✓ no raw hex/px outside the token layer; **89** referenced tokens all defined |
| ├ `check:copy` · `check:smoke-isolation` | ✓ |
| ├ **`check:primitives`** *(new)* | ✓ no raw checkbox in **137** source files |
| ├ vitest | **40 files / 379 passed** (was 374 — +5 Checkbox) |
| └ Playwright | **361 passed** |
| HELP CURRENCY SUITE (`test_help_content_accuracy.py` + `test_glossary_parity.py`) | **313 passed, 15 skipped** |
| `scripts/check_api_contract.py` | **exit 0** — contract current |

**Backend not re-run: nothing in this delta touches it.** No Python file, no served string, no
route, no schema changed — the diff is one primitive, one guard script, one consuming component,
one stylesheet, a specimen, and documents. Re-running 1704 backend tests to assert that a CSS file
did not move an HTTP contract would be theatre; the contract check above is the gate that actually
answers that question, and it is green.

---

### 11-K. THE READING BAR IS SERVED — the §11-J open question, ruled and shipped (2026-07-20)

**THE RULING** (architect under delegation, **owner-ratified in chat 2026-07-20**): the
reading-return bar's two strings are **state claims on the consent path and must be SERVED**.
§11-J raised them and deliberately did not decide them; this delta closes that, and it is the
**last code of the milestone**.

**The reasoning, because the counter-argument is the one that let them ship.** They look like
chrome. *"Return to accept"* is a button label, and *"You are reading the Legal page. Nothing has
been accepted yet."* describes a UI state — which is exactly why nobody questioned them while every
string inside the gate was served under §9-3/§9-8. The distinction does not survive the test that
matters: **"nothing has been accepted yet" is an assertion about the acceptance record**, made to a
person mid-consent, and the record is the server's. A claim about server state authored in a `.tsx`
file is one **no accuracy guard can reach** — the corpus binds Help's Legal entry to the SERVED
strings, so a frontend-authored sentence could contradict the document indefinitely with every gate
green. The scope of *served* is **the PATH, not the panel**.

**SCHEMA CHANGE, DECLARED.** `LegalGateCopy` gains `reading_note` + `reading_return`, fed from new
`app/services/legal.py` constants beside the other four. **Contract regenerated in THIS commit**
(the §11-I lesson, applied rather than re-learned). **Both counts, measured after the regen:**
**141 paths · 71 schemas** — *unchanged*, and that is the expected result, not an omission: this
adds two **fields to an existing schema**, no route and no new model. A moved count here would have
meant something else had drifted in.

**FAIL-FIRST — driven RED before a line of source moved, on both sides:**
- Backend `test_the_reading_bar_strings_are_SERVED_with_the_rest_of_the_gate_copy` — pins the
  payload's key set exactly (*every string on the path, or none*) and both values against the
  constants. RED: `AttributeError`/key mismatch, no such fields.
- Frontend — the gate test's stubbed `COPY` gained the two strings as **deliberate non-shipping
  stand-ins** (*"You are reading it. Nothing is accepted."* / *"Go back and answer"*), and the
  reading-state test now asserts **`COPY.reading_note` / `COPY.reading_return` verbatim**. RED
  against the authored strings, which is the whole point: a component holding its own copy renders
  the real sentence and **fails** against a stub. Matching the shipped wording would have passed
  either way and proved nothing — the §11-J *"is the guard or the code wrong"* discipline, applied
  to a test's fixture.

**Shipped:** the two constants; the schema + endpoint fields; `LegalGateCopy` consumed by
`AcceptanceGate`'s prop **in place of a restated four-field structural type** (which had already
been a drift waiting to happen and would have gone stale on this very commit); `AppShell` renders
`gateCopy.reading_note` / `.reading_return` and **the authored strings are deleted**.

**ONE CONSEQUENCE, NOT HIDDEN.** *"Read the Legal page"* is now **disabled until the copy loads**,
as the checkbox already was. Serving the bar's strings means the reading state's **way back** is
served, so entering it with `copy === null` would strand a reader in a document with no rendered
exit. The alternative — a hardcoded fallback label — would **re-author the string this delta
exists to remove**, so the gate is made inert as a whole instead of half-usable: it does not enter
a state it cannot render the exit from. The `readingLegal && gateCopy` guard in `AppShell` is that
invariant restated at the render site, not defensive padding.

**Also:** `AppShell.test.tsx`'s gate-copy stub was **three inline four-field literals**; they are
now one `GATE_COPY` constant. A stub duplicated per call site drifts from the contract in silence,
because an under-described stub still parses and the surface simply renders `undefined` — the same
genre as the restated prop type above, found in the same delta.

**GATES — this delta (frontend run as the GATE, not the parts — §15 lesson 10):**

| Gate | Result |
|---|---|
| `npm run check` (full chain) | **exit 0** |
| ├ lint · typecheck · `check:copy` · `check:smoke-isolation` | clean |
| ├ `check:tokens` | ✓ **89** referenced tokens all defined |
| ├ `check:primitives` | ✓ no raw checkbox |
| ├ vitest | **40 files / 379 passed** |
| └ Playwright | **361 passed** |
| `scripts/check_api_contract.py` | **exit 0** — current, regenerated this commit |
| `tests/integration/test_legal_acceptance.py` | **10 passed** |

Backend FULL solo (ordered + randomized) and the HELP CURRENCY SUITE run at **Phase 2/3a**, below —
this delta changes served strings, so unlike §11-J it does **not** get to skip them.

**HELP CURRENCY:** ⚑ assessed at Phase 3a with the suite, not asserted here. Two new served strings
exist; the *user-visible wording is byte-identical* to what shipped, so the expectation is **no Help
delta** — but that is a claim the corpus adjudicates, not this note.

---

## 12. PHASE 3b — OWNER ACCEPTANCE WALK — FINDINGS LEDGER (2026-07-20)

**ACCEPTANCE BASIS: the owner's ratification in chat on 2026-07-20** (the banner at the head of
§11), given after reading the §3 diff, the two gate sentences, the Legal page in **both themes**,
and the gate/stale/reset/decline behaviour — the six items enumerated there. This is a **walk by
looking**, on the owner's own instance and in chat, not a scripted 3b re-drive; the precedent is
`data-feed-routing.md` §14 ruling 1c and `intraday-series.md`, where the acceptance basis was
likewise the reviewed evidence rather than a fresh drive.

**LEDGER STATUS: open until the Phase 2/3a re-drive below records against it.** Findings the
scripted pre-pass raises after the ratification are filed here as **F-items** and triaged at the
close; a defect found after acceptance is still a defect, and the ratification does not retire the
pre-pass.

| # | Finding | Disposition |
|---|---|---|
| — | **None.** The §13 re-drive raised **no product finding**: 54/54 green. Its three initial reds were all **probe defects**, diagnosed and recorded in §13 rather than filed here — a defect in the instrument is not a defect in the product, and filing it as one would corrupt the count. | **LEDGER CLOSED — 0 findings.** |

---

## 13. PHASE 2 + 3a — TESTS GREEN + SCRIPTED PRE-PASS, ISOLATED INSTANCE (2026-07-20)

Driven on the **isolated stack** — Vite dev **5199** → backend **8399** → a **temp data dir**
(`/tmp/lf-prepass-*`). The owner's `5173`/`8321`/`~/.ledgerframe-data` were **never touched**;
`.env` was snapshotted and **verified byte-identical after** (`460a2da0…7afae6`), the throwaway
`vite.prepass.config.ts` was deleted before anything was staged (the `fe0d68b` lesson, mechanised
into the harness's exit trap), and the isolated ports were confirmed clear at the end. Vite dev
rather than the prod build, deliberately: the prod CSP blocks `index.html`'s theme-flash inline
script and would have cost one benign console error against a **0-others** claim.

### 13-A. The pre-pass — **54 / 54 PASSED**

| Area | Checks | Result |
|---|---|---|
| **Served copy** | gate-copy carries all **six** strings incl. `reading_note` / `reading_return` | ✓ |
| **The reading bar (§11-K)** | note + button label render **verbatim from the payload**, gate stood down | ✓ |
| **The formal Legal page** | **six articles**; numbers `1.` – `6.` **derived from position**; all 7 anchors (`#legal-preamble`, the four sections, `#legal-commitments`, `#legal-pointers`); **seven Commitments** | ✓ |
| **Containment** | both themes × **320 / 375 / 768 / 1366 / 1440** — `scrollWidth − clientWidth ≤ 0` at every one | ✓ 10/10 |
| **Gate — PIN-less** | consent panel is the entry; served prompt + explainer verbatim | ✓ |
| **Gate — decline** | stays locked · served declined note · **nothing recorded as accepted** | ✓ |
| **Gate — accept** | gate closes, app entered, recorded against the current hash, **no PIN invented** | ✓ |
| **Gate — stale** | API reports the **third state**; the returning user is told the document *changed*; re-accepting rebinds to the current hash | ✓ |
| **Gate — PIN-protected** | **consent panel, not the PIN prompt**; lock is *behind* the gate; after consent the PIN is what remains | ✓ |
| **Reset erasure (§11-D3/§11-E2a)** | reset → acceptance `none` → gate **re-fires**, and re-fires as **none, not stale** | ✓ |
| **Help** | reachable, carries Legal's entry | ✓ |
| **Pack footer (AC-L8)** | a **really generated** Pack (`/reports/pack`, 17 053 bytes, HTTP 200) carries Legal's footer **byte-for-byte** | ✓ |
| **Pack containment** | the same Pack is **REFUSED 451** while unaccepted — the gate contains the one data-bearing artifact outside `/api/v1` | ✓ |
| **Console** | **116 × 451** (acceptance gate) + **18 × 401** (PIN lock) — *both the product refusing, by design* — and **0 others** | ✓ |

### 13-B. THE THREE GATE STATES ARE BYTE-IDENTICAL, AND THAT IS THE RESULT

`prepass3a-01-gate-pinless.png`, `prepass3a-08-gate-pin-protected.png` and
`prepass3a-10-reset-refires-none.png` share one sha256 (`107d9925…`). A PIN-less unaccepted
install, a **PIN-protected** unaccepted install, and an install **freshly reset** all present the
**same consent panel** — §11-E2's fix (consent before PIN) and §11-D3's ruling (a reset returns the
install to first-run posture) holding **simultaneously**, and *driven rather than assumed*, which is
§15 lesson 5. The §11-J re-render found the same equality across two states; this extends it to
three.

### 13-C. THREE REDS, ALL THREE THE INSTRUMENT — the fourth occurrence this milestone

The first run was **50/53**. Every red was in the probe:

1. **`/reports/pack` → 451.** The probe fetched the Pack *after* the reset, i.e. on an
   **unaccepted** install, where the read gate refuses it **by design**. Verified against
   `deps.py` before touching anything — the endpoint carries `require_read_auth`, the same gate.
   The Pack generation moved to the accepted posture; **and the 451 was kept as its own assertion**,
   because the refusal is worth pinning too.
2. **The byte-for-byte footer**, downstream of (1).
3. **18 console 401s.** They appear only after the PIN is set and the reset relocks the install:
   the **PIN lock refusing reads**. The filter excluded 451 and nothing else, so a second legitimate
   refusal read as noise. Now counted **separately by cause** rather than lumped into one
   "expected" bucket — a filter that hides two different refusals behind one number cannot tell you
   which one stopped working.

**This is the FOURTH instrument-at-fault this milestone** (§11-D's `AGPL-3.0-or-later` match,
§11-J's line-number defect, §11-J's mid-transition `getComputedStyle`, and now this). Recorded with
the others in §15, because the pattern is now the milestone's most reliable finding: *when a probe
goes red against code that three other gates call green, suspect the probe first — and then
**check**, because "suspect the probe" is exactly how a real defect gets waved through.* Each of the
three above was confirmed against the source before being reclassified.

### 13-D. GATES — the full set, solo (2026-07-20)

Run **solo**: no other pytest process shared the machine (the void-verdict rule), and the pre-pass
was held until both backend runs had finished.

| Gate | Result |
|---|---|
| **Backend FULL, solo, ORDERED** (`-p no:randomly`) | **1822 passed, 15 skipped** (12:26) |
| **Backend FULL, solo, RANDOMIZED** (the order-pair) | **1822 passed, 15 skipped** (09:58) |
| `npm run check` — **the gate, not the parts** (lesson 10) | **exit 0** |
| ├ lint · typecheck · `check:copy` · `check:smoke-isolation` | clean |
| ├ `check:tokens` | ✓ **89** tokens all defined |
| ├ **`check:primitives`** | ✓ no raw checkbox in **137** source files |
| ├ vitest | **40 files / 379 passed** |
| └ Playwright | **361 passed** |
| **HELP CURRENCY SUITE** (`test_help_content_accuracy` + `test_glossary_parity`) | **313 passed, 15 skipped** |
| **Licence + Legal guards** (`test_licence_spelling`, `test_legal_accuracy`, `test_legal_content`, `test_legal_acceptance`) | **181 passed** |
| `scripts/check_api_contract.py` | **exit 0** — **141 paths · 71 schemas** |
| **Scripted pre-pass, isolated** | **54 / 54** |

---

## 15. STRIKE-CHECK RETROSPECTIVE — the lessons, MECHANISED (2026-07-20)

*Seeded at the re-look, completed at the close. **A lesson that is only written down is this
milestone's own lesson 2 waiting to happen**, so each carries what turns RED. Where the answer is
"nothing", it says so — an honest gap beats a decorative one.*

| # | Lesson | What turns RED |
|---|---|---|
| 1 | Commit messages are records (§11-H) | **Nothing — stated.** No guard can read intent; the discipline is the numbers-before-summary-words rule below. |
| 2 | A convention in a plan file is enforced by nobody (§11-E3) | `test_licence_spelling.py` (**104**) — and, generally, the requirement that a ruling ships with its guard |
| 3 | Scanning ≠ reading the copy (§11-E3a) | `test_the_EXTRACTOR_reaches_copy_in_every_shape_it_ships_in` |
| 4 | A routed handler's docstring is served text (§11-I) | `scripts/check_api_contract.py` — *it fired again at this very close* |
| 5 | Drive the browser; a green suite is not an entry (§11-E2) | `test_the_gate_can_RENDER_ITSELF_on_a_PIN_PROTECTED_install` + the 3a pre-pass |
| 6 | A hard rule without a guard is a request (§11-J) | `npm run check:primitives` — **and the rule is now in CLAUDE.md** |
| 7 | The instrument-at-fault pattern (§11-D/§11-J/§13-C) | **Nothing — a habit, stated with its counter-caveat** |
| 8 | The PIN × acceptance matrix gap (§11-E2) | the PIN-protected gate tests + 3a's PIN-protected phase |
| 9 | A refusal the product creates, the product undoes (§11-E2) | the entry-epoch remount + "0 occurrences" verification |
| 10 | Running the parts is not running the gate | `npm run check` as one chain |
| 11 | A constraint must prove it earns its keep (§11-F) | the permanent **ESCAPES** specimen in `test_licence_spelling.py` |

---

1. **COMMIT MESSAGES ARE RECORDS, AND THEY MEET THE SAME TRUTH BAR AS SERVED COPY.** (Owner,
   2026-07-20, from §11-H.) A commit message is read by every future maintainer, cannot be
   corrected in place, and is the only account of intent a diff does not carry. §11-B's said the
   specs were *renamed* when 8 of 35 instances had changed — no test could have caught it, because
   nothing about the **code** was wrong. **The bar is: describe what the diff does, not what the
   task was called.** A summary word like *"renamed"*, *"swept"*, or *"all"* is a **claim of
   completeness** and must be checked against the numbers before it ships — the same discipline
   already applied to gate counts and fail-first evidence, which are never asserted without being
   measured.
2. **A CONVENTION THAT LIVES ONLY IN A PLAN FILE IS ENFORCED BY NOBODY.** (§11-E3.) §9-7 ruled the
   spelling split in as many words and shipped with no guard; the very next surface built under it
   served the wrong spelling in its most prominent line, and review did not catch it. A ruling that
   is not mechanised is a ruling with an expiry date.
3. **SCANNING A FILE AND READING ITS COPY ARE DIFFERENT CLAIMS.** (§11-E3a.) The guard reported
   coverage of files whose `<p>`-rendered prose its extractor could not see. Only the second claim
   is worth a green, and the way to know which one you have is to **test the extractor**, not the
   rule.
4. **A DOCSTRING ON A ROUTED HANDLER IS SERVED TEXT.** (§11-I.) FastAPI publishes it as the
   operation `description`, so editing one without regenerating the contract leaves the published
   contract describing behaviour the product no longer has. **The regeneration belongs in the
   commit that edits the docstring**, exactly as a response-model rename does.
5. **DRIVE THE BROWSER; A GREEN SUITE IS NOT AN ENTRY.** (§11-E2.) 1713 tests and a review both
   missed that a PIN-protected install showed the PIN prompt instead of the consent panel, because
   every test in the gate's module ran on a PIN-less install. The defect was on the installs most
   likely to have a real user behind them.
6. **A HARD RULE WITHOUT A GUARD IS A REQUEST.** (§11-J.) *"Raw `<input>` is forbidden"* has stood
   in CLAUDE.md and DESIGN-SYSTEM §6 since the design-system milestone, and it was enforced by
   **nobody**: the gate shipped a hand-rolled checkbox through `npm run check`, a green suite, a
   Playwright pre-pass and a written review. **Every one of those asks whether a control WORKS;
   none asked whether it is the SANCTIONED one**, and a working violation is the kind no
   correctness gate can see. This is lesson 2 (*a convention that lives only in a plan file is
   enforced by nobody*) escalated: **the same is true of a convention in CLAUDE.md itself.** The
   test of a hard rule is not that it is written prominently — it is that something goes red.
   **Ask of every hard rule: what turns red?** Where the answer is *nothing*, the rule is a
   request, and the correct response is a guard in the standing suite, not a reminder.
   **ESCALATED TO `CLAUDE.md` AT THIS CLOSE** as a standing hard rule, because it is a rule *about*
   that list: a hard rule there is exactly the kind most likely to be believed and least likely to
   be checked.
7. **THE INSTRUMENT-AT-FAULT PATTERN — FOUR TIMES THIS MILESTONE, AND THE CAVEAT MATTERS AS MUCH AS
   THE PATTERN.** (§11-D's guard matching `AGPL-3.0-or-later`; §11-J's guard reporting the wrong
   line after stripping comments without preserving newlines; §11-J's `getComputedStyle` returning
   the **interpolated mid-transition** value; §13-C's three pre-pass reds.) *"The guard is wrong"*
   and *"the code is wrong"* look **identical** for exactly as long as it takes to check which —
   and a new probe disagreeing with three established gates is usually the probe. **But the caveat
   is the lesson:** *"suspect the instrument"* is also precisely how a real defect gets waved
   through, so it is a **hypothesis, never a disposition**. Each of the four was confirmed against
   the source — `deps.py`, the transition list, the guard's own output — *before* being
   reclassified. **Nothing turns red here**; this is a habit, and it is recorded as one rather than
   dressed up as a mechanism.
8. **THE MATRIX GAP: EVERY GATE TEST RAN PIN-LESS UNTIL THE WIDENING.** (§11-E2.) The gate has two
   independent axes — PIN set / not, and acceptance none / stale / accepted — and the whole module
   exercised **one column**. The suite was not thin; it was **thorough along one axis and blind
   along the other**, which is the shape that reads as coverage. **Ask of any new state machine:
   what is the second axis, and does anything test the cells off the diagonal?** Mechanised as the
   PIN-protected gate tests, and driven again in 3a's PIN-protected phase — where the three gate
   states turned out **byte-identical** (§13-B), which is only a meaningful result *because* the
   off-diagonal cell is now driven.
9. **A REFUSAL THE PRODUCT CREATES MUST BE UNDONE BY THE PRODUCT.** (§11-E2.) Pages mounted behind
   the gate cached their honest "Couldn't load this summary" and had no reason to re-ask, so Home
   after accepting was a wall of errors with six working **Retry** buttons. **A per-card Retry that
   works is not a defence** — making a person clear a refusal the product itself manufactured is
   *a mess wearing the costume of an honest empty state*. The subtree is keyed on an entry epoch
   and remounts when the gate clears; verified at **0 occurrences**.
10. **RUNNING THE PARTS IS NOT RUNNING THE GATE.** `npm run check` is a **chain** — lint →
   typecheck → tokens → copy → smoke-isolation → primitives → vitest → overflow. Running vitest and
   the guards individually and reporting them green says nothing about whether the chain **exits
   0**: an early link failing is exactly what a hand-picked sequence hides, and the chain is the
   thing CI and the next contributor actually run. Every gate table in this milestone reports
   `npm run check` **as one command with its exit code**, with the parts as sub-rows beneath it —
   evidence, not substitutes.
11. **A CONSTRAINT MUST PROVE IT EARNS ITS KEEP.** (§11-F.) §9-7's amendment could have exempted
   official titles either as a **named allow-list** or by a free-form *title-shaped* pattern. The
   two were **implemented and measured against the same specimens** instead of argued: the
   free-form version let `Released under the Widget Foundation Public License.` through — it hands
   every author a way to spell it the American way by capitalising a noun in front of it. That
   escaping specimen is now **pinned as a permanent RED** (*"a title-shaped string nobody listed"*),
   so the **closure of the list is tested rather than trusted**. The general form: when choosing
   between a tight rule and a general one, **write the specimen the general one would let through**
   — if you cannot, the tight rule may be costing you nothing.

**One item from the close brief could not be substantiated: a "JSX-comment route kill."** The
record carries two JSX-comment incidents — §11-E3a (the extractor read quoted literals only, so
every `<p>` of rendered prose was invisible to a guard reporting those files as covered) and §11-J
(comment-stripping without newline preservation, giving a wrong line number) — but **no event in
which a JSX comment removed a route**. It is recorded as *not found* rather than reconstructed:
inventing a lesson would be exactly the §11-H failure this list opens with.

---

## 14. MILESTONE CLOSE — LEGAL (2026-07-20)

**§-LEDGER CLOSED.** §9 CLOSED · §11 CLOSED (all six items ratified) · §12 walk ledger **CLOSED,
0 findings** · §13 pre-pass **54/54** · §15 strike-check complete, **11 lessons, each with what
turns red**. **F-items: none were filed** — the milestone's defects were all found and fixed
*inside* the deltas that introduced them (§11-E2's two browser-found defects, §11-E3a's extractor,
§11-I's contract drift, §11-J's raw checkbox), so there is no triage list. **Polish carried to the
pre-release backlog:** 10-D item 4 (prose rhythm — a shared-`HelpProse` question, never a Legal
one) and the §9-7 guard's **scope gap** (it reads served content + frontend copy, **not**
`docs/specs/` — currently clean by measurement, not by guard).

### 14-A. CHANGED FILES — from the ACTUAL diff (`b14a15e~1..HEAD`, 28 commits)

**48 files · +5 070 / −441** (excluding `docs/plans/assets/`).

| Area | Files | Note |
|---|---|---|
| **Backend — the gate** | `app/api/deps.py` (+80) · `app/api/v1/routes/system.py` (+177) · `app/models/__init__.py` (+26) · `alembic/…/b8d3f1a97c25_legal_acceptance.py` (+55) | Server-side enforcement **before** the PIN check; the append-only event table |
| **Backend — the content** | `app/services/legal.py` (**+423**) · `app/services/help.py` (+95) | The six articles, the Commitments, the gate copy, `PACK_FOOTER`, `content_hash()`; Help's Legal entry |
| **Contract** | `docs/specs/API-CONTRACT.json` · `docs/openapi.json` (+398 each) | **141 paths · 71 schemas** |
| **Frontend — the gate** | `AcceptanceGate.tsx` (+138) · `AppShell.tsx` (+130) · `api/legal.ts` (+94) · `api/client.ts` (+9) · `chrome.css` (+72) | Consent before PIN; the 451 listener; the reading-return bar |
| **Frontend — the primitive** | `Checkbox.tsx` (+67) · `inputs.css` (+71) · `ui/index.ts` · `KitchenSink.tsx` (+30) · `scripts/check-ui-primitives.mjs` (**+114**) · `package.json` | The DS Checkbox, its specimen, **and the guard that should have existed** |
| **Frontend — the page** | `routes/Legal.tsx` (+114) · `routes/Legal.css` (+103) · `nav.ts` · `PricingHealth.tsx` · `Settings.tsx` | The formal register; the `built:true` flip; the Commitment rename's two call sites |
| **Specs** | `PRODUCT-SPEC.md` (+63) · `GLOSSARY.md` (+63) · `DESIGN-SYSTEM.md` (+62) · `IA.md` · `SECURITY-BASELINE.md` · `README.md` | §3 cleaned + renamed; the three DS entries; §20-P **unchanged**, annotated |
| **Tests** | `test_licence_spelling.py` (**+347**, new) · `test_legal_acceptance.py` (+315) · `test_legal_accuracy.py` (+142) · `test_legal_content.py` (+138) · `AcceptanceGate.test.tsx` (+206) · `Legal.test.tsx` (+144) · `Checkbox.test.tsx` (+73) · `test_reset_data.py` (+71) · `conftest.py` (+28) · 4 others | The guards the rulings needed |
| **Plans** | `page-legal.md` (**+1 021**) · `page-chrome.md` (+43) · `page-first-run-checklist.md` (+27) · `page-pricing-health.md` (+47) | **The three delta notes on accepted surfaces** — the standing CLAUDE.md rule honoured, not footnoted |

### 14-B. HELP CURRENCY — the delta this milestone shipped

**Help changed, and it was atomic with the surface.** `app/services/help.py` (+95): **Legal's own
entry** (`page-legal`, Pages category, with the nav `built:true` flip in the *same commit* —
`b14a15e`), plus **the gate/lock/reset truth** written into the affected entries as the behaviour
landed: the acceptance gate as a real entry condition (§11-E2), and **reset now erasing acceptance**
(§11-D3) — both dated in-file. This is the Currency Law working as intended: the Help edits are
*inside* the commits that changed the product, not swept up afterwards.

**Guard corroboration: HELP CURRENCY SUITE — 313 passed, 15 skipped**, and it can *see* this
surface: the accuracy corpus binds Help's Legal entry to the gate's **live served strings**, which
is why §11-J could claim "no Help impact" credibly and why §11-K's byte-identical wording claim was
adjudicated rather than asserted.

### 14-C. GATES AT THE CLOSE

Backend **1822 / 15 skipped** solo, **ordered and randomized** · `npm run check` **exit 0**
(40 files / 379 vitest · 361 Playwright · 89 tokens · 137 files primitive-clean) · HELP CURRENCY
**313 / 15** · licence + legal guards **181** · contract **exit 0, 141 / 71** · pre-pass **54 / 54**.

**MILESTONE CLOSED — Legal, 2026-07-20.** Walk ledger CLOSED (0 findings); §15 strike-check
complete; `RATIFICATION.md §6` row appended.

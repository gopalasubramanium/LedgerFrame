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

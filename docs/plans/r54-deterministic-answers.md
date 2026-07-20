# R-54 — Deterministic answer intelligence: the two-tier Ask panel

**Status: ✅ §9 CLOSED 2026-07-20 (owner one-pass, in chat) — BUILD AUTHORIZED.** §7 and §8 are
completed from the resolutions; Phase 0 begins backend-first. **The §-ledger below governs the close:
no CLOSED claim is admissible while any I-row lacks a disposition.**

*History: written §0–§9 as a plan-only survey session (`ac8ea65`), then closed at the one-pass.*

**Naming.** `r54-deterministic-answers.md` follows the milestone convention already on disk
(`r43-historical-backfill.md`) — `page-*.md` is for pages, `r<N>-*.md` for ROADMAP-row milestones.
The Ask panel is not a page; it is a component mounted in the shell
(`frontend/src/components/AppShell.tsx:235`) and on Instrument Detail
(`frontend/src/routes/InstrumentDetail.tsx:198`).

**Source of scope:** `ROADMAP.md` R-54 (authoritative, incl. its CARRIED-INTO-R-54 block) ·
`release-readiness.md` RD-9 Amendments 7–9 (**and 10**, filed from this §9) · `ai-surfaces.md` §12-3 (the tier-1 seed), §13, §14,
§17 · `docs/audit/DECISIONS.md` R-22 AMENDMENT · `GLOSSARY.md` (the three kinds of intelligence).

---

## §-LEDGER — INTAKE ENUMERATED AT PLAN TIME

*Per the TEMPLATE amendment (chat ruling 2026-07-20 / `ai-surfaces.md` §19-K): **every §0 intake
item enters the §-ledger as a numbered row at plan time. This ledger may not claim CLOSED while any
row lacks a disposition.** This plan is the rule's first user.*

| # | Kind | Item | Origin | Disposition |
|---|---|---|---|---|
| **I-1** | Intake | **Contention-robustness fix** — `tests/integration/test_ai_facts_routing.py:34` (`test_performance_question_pulls_risk_metrics`) fails only under machine contention, passes solo | `r43-historical-backfill.md` §18-F7d → re-assigned post-close, `ai-surfaces.md` §19-K → `ROADMAP.md` R-54 (i) | **OPEN — ⊕ root-cause HYPOTHESIS recorded at Phase 0-1 (`88c5ce4`):** the failure is likely a **date-aware coverage / seed-state dependency, NOT machine contention** — `performance_facts` skips `None`-valued metrics (`tools.py:352-353`) and every metric the assertion can be satisfied by is `value if da_computable else None` (`analytics.py:205-210`), so an uncovered window nulls **all** of them at once. Its delta must also account for Phase 0-1 **changing this question's routing** (now `RISK_CONCENTRATION → {perf, alloc}`) against the 20-fact cap |
| **I-2** | Intake | **Fixture hygiene** — `frontend/src/components/ui/AskPanel.test.tsx:27` mocks `privacy_label` with a **live served string**; make it obviously synthetic | `ROADMAP.md` R-54 (ii) — **⚠ premise corrected, see §0-K** | **OPEN** |
| **I-3** | §9 | **Posture-descriptor unification** — "OpenAI-compatible endpoint" vs "Ollama-compatible" | `ROADMAP.md` R-54 (iii); decision-shaped, so §9-G not intake | ✅ **DISPOSITIONED 2026-07-20 — UNIFY** (§9-G). One user-facing descriptor, **"Ollama-compatible"**; "Hailo" leaves served copy. **The ruling is closed; the STRINGS ratify at 0a by looking** — the ledger distinguishes the two |

| **F-1** | Finding | **`Total liabilities` is not a GLOSSARY term** — GLOSSARY has **Liability** (`:67`, singular, an asset-class concept) and uses "Liabilities" only inside Net worth's definition prose (`:65`); neither sanctions it as a **figure label**, yet `networth_facts` (`tools.py:330-332`) serves it to users | Found at Phase 0-2a (`0d19a5a`) building the registry — by the first guard ever to measure the **AI's fact labels** against GLOSSARY | ✅ **RATIFIED + CLOSED 2026-07-20** (owner: *GLOSSARY catch-up*). Verifying the reading made it stronger than the finding — **D-032** and **D-054** already ratify **Liabilities** by name, `NetWorth.tsx:204` has **shipped** that label, and `:208` renders *"…− Liabilities (GLOSSARY)"*, **citing a spec entry that did not exist**. The defect was the **missing row**. `GLOSSARY.md` gained **Liabilities** spec-first (`2c0016d`), the registry's canonical label follows it, and **the carve-out is deleted — an ordinary row, zero exceptions** (`fa7b656`). Sibling `Total assets` → `Gross assets` applied at 0-2a |

| **F-2** | Finding | **Allocation weights omit three shipped asset classes** — `key_stats`' four buckets are `weight(...)` over hardcoded names (`analytics.py:94-97`); **`bond`, `other` and `retirement` are in NO bucket**, so the weights do not sum to 100% | Found at Phase 0-2b (`fa7b656`) from ruling ②'s *principle* — its stated precondition (a *dynamic* `key_stats` path) **does not exist**; the metrics are static literals | **⚑ OPEN — OWNER RULING OWED.** **Proven live on the SHIPPED DEMO DATA: 6.2 + 4.4 + 1.0 + 80.5 = 92.1, a 7.9-POINT SHORTFALL** on an accepted surface (D-048), caught by nothing. **Not fixed:** the repair changes **what the Portfolio page displays** — a product-content decision, not a refactor — and would break 0-2b's byte-identity proof for a reason unrelated to the derivation. The ruled fix (*derive from the `AssetClass` enum, one source*) is the likely shape, and it lands with the **page-portfolio pre-pass + dated delta note** per the rite |

*Rows F-n (walk findings) are appended below this table as the milestone runs. **The CLOSED claim
enumerates I-rows, F-rows and lettered sub-findings alike.***

**⊕ 2026-07-20, at the §9 close — I-1 and I-2 remain OPEN and carry into Phase 0.** Stated here
rather than left to be noticed: §9 closing is **not** the ledger closing, and the milestone that
mechanised this rule is the last one that should blur them. **I-1** is this milestone's by
re-assignment (`ai-surfaces.md` §19-K) and its reproduction follows the **F10 blindness-pin /
vacuous-green** technique; **I-2** carries §9-H's convention plus the second instance §0-K found.

---

## §0. SURVEY — VERIFY-FIRST

*Every claim carries `file:line`. Nothing here is recalled; each was read or executed this session.*

### 0-A. ⛔ INTENT ROUTING TODAY IS **TWO INDEPENDENT ROUTERS THAT DO NOT SHARE CODE**

This is the survey's central structural finding, and it reframes §9-A.

**Router 1 — `classify_intent`** (`app/ai/intent.py:58-69`). A 16-member `Intent` str-enum
(`intent.py:15-31`) resolved by an **ordered list of 13 compiled regexes, first-match-wins**
(`intent.py:35-52`, iterated `:63-65`). Ordering is load-bearing and commented — region/market
before generic movement (`intent.py:46-48`). Fallback: a bare-ticker regex (`intent.py:55`) AND'd
against a verb list → `INSTRUMENT_QUESTION` (`:67-68`); otherwise `UNKNOWN_GENERAL_QUESTION`
(`:69`).

**Router 2 — `gather_facts`** (`app/ai/tools.py:558-635`). It **does not consume router 1's result
for its branching.** It lowercases the question (`tools.py:559`) and computes eight boolean flags
from `has(*ws)` **substring** membership (`tools.py:561-576`), plus a `personal` regex
(`:580-582`). Flags are **additive** — several fact sources concatenate. `classify_intent` is
consulted **twice only, and only to prepend extra facts**: data-quality/pricing-health
(`tools.py:615-618`) and help facts (`tools.py:624-628`).

**The limits, from the code and stated plainly:**

- **Substring, not word-boundary.** `has("mov", "gain", "los", …, "up ", "down")`
  (`tools.py:574`) — `"los"` matches *closed*, *lost*, *lose*; `"own"` (`:575`) matches
  *downgrade*, *known*. No stemming, no negation handling.
- **The two routers can disagree** on one question — router 1 may return
  `MARKET_REGION_QUESTION` while router 2 gathers portfolio facts, because they read different
  word lists.
- **No embeddings, no LLM classification, no learning anywhere.** `_ALIASES` is a hardcoded
  30-name dict (`tools.py:400-411`); `_TICKER_STOP` a hardcoded stop-set (`:415-422`).
- Tickers are recognised only when typed **upper-case in the original text** (`tools.py:445-447`),
  capped at 3 (`:448`); deep-facts capped at 2 (`:509`). Final pack capped at 20 (`_dedupe(…,
  cap: int = 20)`, `tools.py:523,551`).
- **Last-resort fallback:** nothing matched → `portfolio_facts + movers_facts`
  (`tools.py:631-632`).

**Why this is the §9 headline.** The kickoff frames §9-A as *"a closed intent taxonomy vs an open
matcher."* The survey finds the product **already has both, unreconciled** — a closed 16-member
enum and an open additive substring matcher, neither of which is the other's source of truth. R-54
does not get to choose between two hypotheticals; it has to rule on **two shipped things**.

### 0-B. THE TIER-1 SEED, AS SHIPPED: A TEMPLATE THAT EMITS **NO PROSE**

The no-model path is `app/ai/grounding.py:147-154` — `if not health.available or _rate_limited():`
→ provenance event → `_template_answer` → `done` with `"provider": "fallback"`.

**`_template_answer` (`grounding.py:79-98`) writes no fact prose at all.** With facts present it
returns `_with_disclaimer("")` (`:98`) — the body is **just the disclaimer**, because the panel
already renders the `facts` event above it (rationale `:82-95`). With no facts it returns
`REFUSAL_NO_FACTS` (`:96-97`, defined `prompts.py:67-71`).

`DISCLAIMER = "Information only, not financial advice."` — `app/core/disclaimer.py:39`, the single
permitted literal site, closure-enforced by `tests/unit/test_disclaimer_closure.py`.
`_with_disclaimer` (`grounding.py:61-76`) **strips every occurrence and re-appends one**, so
placement is normalised rather than appended-if-missing.

**Therefore: "deterministic answering" today is the fact pack + a disclaimer.** There is no term
explanation, no figure-alongside-term, no deep link, no action steps. **The seed is the *posture
copy* and the *fact projection* — not an answering capability.** The ratified sentence
(`app/api/v1/routes/ai.py:56-57`, ai-surfaces §12-3) describes what tier 1 *will* be more than what
it *is*, which is exactly why R-54 owns the amendment.

The D-070 fallback signal is `grounding.py:40` —
`"AI answer didn't pass grounding checks — showing facts directly."` — emitted **only** on the
validation-rejected branch's `done` event (`:221-222`), deliberately not as a delta (`:208-213`).

### 0-C. ⛔ THE WIDENED FACT PACK **MISSES THE ENTIRE GLOSSARY CATEGORY** — tier-1(a)'s exact case

The Phase-0.9 widening (`CURRENT.md:170-183`) is implemented at `app/ai/tools.py:211-212`:

```python
_HELP_FACT_CORE  = ("body", "interpret")     # unconditional
_HELP_FACT_EXTRA = ("outputs", "inputs")     # budgeted, whole fields only
```

`_HELP_FACT_BUDGET = 3600` (`tools.py:219`); `_render_help_fact` (`:222-246`) renders core
unconditionally (`:239`) then admits each extra only if it fits (`:243`) — never truncating
mid-text.

**Executed against the live corpus this session:**

```
glossary entries: 29    with interpret: 0
fields on a glossary entry: body, example, improves, keywords, level, title, what, why
non-glossary:     24    with interpret: 20
```

**All 29 `term-*` entries carry `what` / `why` / `improves` / `example` and NONE carries
`interpret`, `outputs` or `inputs`.** The pack therefore projects **`body` alone** for every
glossary term — the precise failure the widening was ruled to fix, on the one category tier-1
category (a) is built from. The tiers were named from *page*-entry field names and the Glossary
category uses a different schema; nothing compared them.

**Errs safe** (an under-informed answer, never a fabricated one) and is **outside any shipped
ruling**, so it is recorded here and raised at **§9-B**, not fixed by this plan.

`search_help`'s contract is **unchanged and must stay so** — `app/services/help.py:1385-1423`,
returning exactly `{"id","category","title","body"}` (`:1422-1423`). `help_facts`
(`tools.py:249-269`) uses it **only as a ranker**, then re-reads the full entry from `HELP` by id
(`:261,264`) and renders through `_render_help_fact` — the split is explicit at `tools.py:255-258`.

**Size limits are NOT constants in `app/ai/`.** `≤4000`/`≤12000` exist only as test assertions —
`tests/integration/test_ai_grounding_corpus.py:175-178` and `:184-189`; the budget itself is pinned
at `:180-182`, the core tier at `:145-149`.

### 0-D. CANONICAL ENDPOINT PER FIGURE — and a posture collision

One prefix: `api_router = APIRouter(prefix="/api/v1")` (`app/api/v1/router.py:32`), 21 prefixless
sub-routers (`:33-53`). **Path namespaces do not track module names** — `portfolio.py` serves
`/portfolio/*`, `/net-worth/*` and `/review*`; `markets.py` serves `/markets/*` and
`/instruments/*`; `system.py` serves `/system/*`, `/ai/status`, `/help` and `/legal*`.

| Figure | Canonical endpoint | Serving line | Served as |
|---|---|---|---|
| Net worth (headline) | `GET /portfolio/summary` → `total_value` | `portfolio.py:115`, field `:138` | **raw float** |
| Net worth (itemised) | `GET /net-worth/statement` → `net_worth` | `portfolio.py:1042`, field `:1064` | raw |
| Gross assets | `GET /portfolio/summary` → `gross_assets` | `portfolio.py:139` | raw |
| Liabilities | `GET /portfolio/summary` → `liabilities` | `portfolio.py:140` | raw |
| Total unrealised P/L | `GET /portfolio/summary` → `unrealised_pl` | `portfolio.py:151` | raw |
| Today's change | `GET /portfolio/summary` → `day_change` | `portfolio.py:152` | raw |
| Total return % | `GET /portfolio/summary` → `total_return_pct` | `portfolio.py:153` | raw |
| XIRR | `GET /portfolio/stats` | `portfolio.py:383` → `analytics.py:198` | raw or `null` |
| TWR | `GET /portfolio/stats` | `portfolio.py:383` → `analytics.py:203` | raw or `null` + served refusal `note` |
| Realised P/L | `GET /portfolio/stats` metric | `analytics.py:189` | raw |
| Income (div/int) | `GET /portfolio/stats` metric | `analytics.py:190` | raw |
| Allocation weights | `GET /portfolio/summary` → `allocation_by_*` | `portfolio.py:155-157` | raw (base-ccy amounts, **not** percentages) |
| Drift vs target | `GET /policy/drift` | `policy.py:51` → `services/policy.py:152-209` | raw **+ `*_display`** |
| Cash runway | `GET /portfolio/runway` | `portfolio.py:1075` → `runway.py:65-78` | raw **+ `*_display`** |
| Realised gains | `GET /portfolio/realised-gains` | `portfolio.py:1125` → `tax.py:378` | raw + served `disclaimer` |
| Per-holding price/value | `GET /portfolio/holdings` | `portfolio.py:201`, schema `:163-201` | raw **+ `*_display`** |
| Per-instrument quote | `GET /instruments/{symbol}` → `quote` | `markets.py:390`, return `:432` | raw |
| Liquidity ladder | `GET /portfolio/liquidity` | `portfolio.py:1066` | raw |
| Accounts / goals / insurance / scenarios | `/accounts`, `/planning/*`, `/insurance`, `/portfolio/scenarios` | `accounts.py:34`, `planning.py:76,121`, `insurance.py:41`, `portfolio.py:1169` | raw **+ `*_display`** |

**⚠ CAGR does not exist and must not be offered.** No implementation anywhere in `app/`; the only
hits are **prohibitions** — `PRODUCT-SPEC.md:152` (D-086: cumulative only, no annualised/CAGR
figure) and `DECISIONS.md:495`. `intent.py:45` matches "cagr" only as an intent keyword and
`tools.py:421` lists it as an acronym. **A tier-1 registry row for CAGR would be a fabricated
figure** — the exact thing the platform never does.

**⚠ THE POSTURE COLLISION.** The DS standard is *served display strings for all rendered values*,
and D-105's formatters say so explicitly — `app/core/money.py:25,38,47`, each documented *"the
frontend renders it verbatim and formats nothing"*, each passing `None` through rather than
fabricating a `0`. **But `to_display` is not a formatter: it returns `float`**
(`app/core/money.py:80`), and **every headline figure a user would name in a question — net worth,
unrealised P/L, today's change, total return %, XIRR, TWR, allocation — is served RAW**
(`portfolio.py:138-157`; `analytics.py:186-208`). Two postures coexist on one contract. Tier 1 must
therefore obtain a **display string**, and the frontend may not make one. **§9-C.**

The AI pack already solved this **for itself**: `_fmt` (`tools.py:25`) emits `f"{value:,.2f} {ccy}"`
and Finding 5 routed the pack through it (`tools.py:363`). That is a *second* formatting site to the
`money.py` one — which is fine while it serves only the pack, and is a §9-C input the moment tier 1
renders a figure as an answer.

### 0-E. ⛔ THERE IS **NO** TERM → ENDPOINT REGISTRY. Two partial adjacent maps exist.

Grepping `app/` for `TERM_TO_*`, `ENDPOINT_MAP`, `FIGURE_ENDPOINT`, `METRIC_MAP`, `FACT_KEY`,
`_ENDPOINT` returns **nothing**. No module maps a user-facing figure name to the route serving it.

Two adjacent maps, and **both matter to §9-B**:

1. **`FIGURE_IDENTITY`** — `app/ai/tools.py:53-63`. Lower-cased label → `(figure id, canonical
   label)`. **9 entries.** Term → **fact key**, no endpoint. Consumed by `figure_identity`
   (`:66-74`), `_canonical_label` (`:77-79`) and `_dedupe` (`:523-551`), which dedupes by label
   **and** figure id, first-wins, then **relabels the survivor to the GLOSSARY spelling**
   (`:544-549`). Its design rationale is worth quoting because it pre-argues §9-B: *a coincidence of
   values is not an identity* — Net worth and Total assets are equal for a user with no liabilities
   and are still two figures (`tools.py:28-52`). Guard:
   `tests/integration/test_ai_fact_pack_canonical.py:2,94`, asserted on the **served pack**, not
   the formatter, because the bug was a bypass.
2. **`term_id` on the stats metrics** — `app/services/analytics.py:186-208`. Thirteen metrics each
   carry a glossary entry id (`term-gross-assets`, `term-unrealised-pl`, `term-realised-pl`,
   `term-income`, `term-income-yield`, `term-total-return`, `term-xirr-twr`, `term-period-return`,
   `term-volatility`, `term-return-volatility`, `term-max-drawdown`, `term-allocation-weight`,
   `term-concentration`). **This is the closest existing thing to the registry R-54 needs** — and it
   is metric → **help entry**, living in the analytics service, pointing the *opposite* direction
   from what tier-1(a) wants.

`GLOSSARY.md` names canonical *pages* in prose (`:65` Net worth, `:226`/`:228` liquidity/runway) and
`:65` pins Net worth to `value_portfolio.total_value` — **documentation, not a machine-readable
registry.** No help entry stores a route or endpoint field (`app/services/help.py:87` notes titles
equal nav labels, and nothing more).

**Tier-1(a) has a ready-made spine and one missing rail.** 29 `term-*` Help entries
(`app/services/help.py:748-1273`), each already deep-linkable via `?topic=`, each already carrying
`what`/`why`/`improves`. The missing rail is term → canonical endpoint. **§9-B.**

### 0-F. DEEP-LINK INVENTORY — what exists TODAY, and three dead affordances

**HashRouter confirmed** — `frontend/src/main.tsx:3`, wrapping `<AppRoutes/>` at `:20-22`. No
`BrowserRouter` anywhere. Route table: `frontend/src/AppRoutes.tsx:33-73` (23 routes; `/kitchen-sink`
deliberately outside `AppShell` at `:33`).

**Exactly three files read URL search params outside tests** — `Holdings.tsx:120-121`,
`Help.tsx:263-264`, `Settings.tsx:107-108`.

| Target | Addressable today? | Evidence |
|---|---|---|
| **Settings tab** (all 7, incl. **AI** and **About**) | ✅ **YES** | `Settings.tsx:107` `useSearchParams`; `:108-109` validated against `TAB_IDS`; `:110` `setParams({tab:v},{replace:true})`; ids `:83-84` |
| **Help topic** | ✅ YES | `Help.tsx:50-57` `hashParams` (prefers `location.search`, falls back to slicing the raw hash so a **pasted** URL works on first paint); `:263-264`; force-open `:301-303`; scroll `:307-313`; `#`-fragment rationale `:40-43` |
| **Holdings scoped to an account** | ✅ YES | `Holdings.tsx:118-132`; one canonical builder `frontend/src/nav/holdingsLink.ts:10-12` |
| **Add-holding form** | ⛔ **NO** | `useState` at `Holdings.tsx:107`; modal rendered `:527-533`; component `:777`. No route, no `?add=`, no `?dialog=` |
| **Theme control itself** | ⛔ **NO** (tab only) | Control is a `Select` at `Settings.tsx:232-243` reading `useTheme()` (`:221`); reachable only to `#/settings?tab=appearance` |
| **Reports year/section** | ⛔ NO | local `useState`, `Reports.tsx:212-218` |
| **Instrument chart range** | ⛔ NO | local state, `InstrumentDetail.tsx:125-149` |

**⛔ DEAD AFFORDANCE 1 — the owner's example (b) cannot be built today.** *"How do I add a holding"*
→ *"Help steps **plus a deep link to the actual add form**"*. The add form is a `useState` modal.
Per the DEAD-AFFORDANCE RULE this is **a new ROADMAP row, never a link**:

> **Would-be row R-59 — URL-addressable entity-creation dialogs.** Give the Holdings add dialog (and
> its siblings `importOpen`/`purgeOpen`/`tagsFor`/`editTxn`, `Holdings.tsx:108-111`) a URL-driven
> open state, through **one shared builder** on the `nav/holdingsLink.ts` pattern, with the
> **click-the-real-control journey guard** page-accounts §14ac-2 mandates.

**⛔ DEAD AFFORDANCE 2 — the owner's example (c) lands one level short.** *"Toggle the theme"* →
*"deep-link straight to the Settings tab/control."* The **tab** is addressable; the **control** is
not. Two honest resolutions, and it is the owner's call (**§9-D**): accept tab-level pointing as
sufficient for *explains-and-points*, **or** file:

> **Would-be row R-60 — control-level deep linking within a Settings tab.** A `?control=` param that
> focuses/highlights a named control. Note `Settings.tsx:110` calls `setParams({tab:v})` with a
> **fresh object**, so it **drops any sibling param** — R-60 would have to fix that first.

**⛔ DEAD AFFORDANCE 3 — an unknown `?topic=` is a SILENT NO-OP.** `Help.tsx:302` writes a dead key
into the `open` map; `:309` finds `entryRefs.current[topic]` `undefined` and the optional chain
no-ops. The page renders normally with nothing opened and nothing scrolled. **A registry entry
pointing at a retired entry id would fail invisibly** — which is precisely the dead-affordance-with-
extra-steps case §9-E must guard. (`topic` is validated against **served catalogue ids**,
`Help.tsx:334`, not a frontend enum — so the guard has to reach the served catalogue.)

**⚠ Stale comment, en route:** `AppRoutes.tsx:59` says *"four URL-addressable tabs"*; the
implementation has **seven** (`Settings.tsx:83-84`). Not owned by this milestone; noted so it is not
re-discovered.

### 0-G. THE PROVENANCE LEGEND HAS NO ROOM FOR A TIER DECLARATION

Three states, `app/ai/vocabulary.py:97-99`, registry `PROVENANCE_COPY` `:104-108` keyed by
`KIND_BUILT_IN`/`KIND_ON_DEVICE_MODEL`/`KIND_EXTERNAL_MODEL` (`:47-49`).

Selection is two-step: `provenance_for(kind, *, narrated)` (`:131-140`) computes
`effective = kind if narrated else KIND_BUILT_IN` (`:139`); `kind` comes from
`kind_of_provider(provider)` (`:111-128`) — **the provider that actually emitted the tokens**, never
configuration (`grounding.py:105-114`), with anything unrecognised falling to
`KIND_EXTERNAL_MODEL` (`:127-128`) because *when the answer is unknown, take the error that cannot
mislead about egress*.

**Consequence for R-54:** a tier-1 answer is `narrated=False`, so it collapses to
`"Built-in intelligence only — no model was used."` — **the same line a tier-2 fallback gets**
(`grounding.py:149,159,187,219` all call `_provenance_event()` bare). A reader cannot distinguish
*"the deterministic tier answered you"* from *"the model was asked and failed."* Those are different
facts and the legend exists to keep exactly this kind of difference legible. **§9-F.**

The treatment is `.lf-ask__answer--model`, italic, semantic-not-decorative, applied from the
**served** `narrated` flag — `DESIGN-SYSTEM.md:1157,1175-1176`, CSS `ask.css:105`, both directions
guarded (`DESIGN-SYSTEM.md:1202-1203`). **Slant because colour is taken** — gain/loss, staleness and
warning already own colour, and a fourth colour meaning *"a model wrote this"* would read as a
judgement about content rather than authorship. **Any tier declaration R-54 proposes inherits that
constraint: it needs a free axis, not a prettier one, and it is a PROPOSED DS entry ratified at 0a
by looking.**

### 0-H. ACCEPTANCE GATE + PIN — covered by inheritance; a new endpoint must be registered

Applied **once, router-wide**: `app/main.py:211` (and the second mount `:233`). The gate is inside
`require_read_auth` — `app/api/deps.py:224-231`, raising `451` with
*"The Legal terms have not been accepted on this install."* — the only `451` in `app/`. It runs
**before** the PIN check (`deps.py:217-231` then `:233-244`), **for API tokens too** (`:217-223`).
Exempt prefixes are `("/api/v1/auth/", "/api/v1/legal", "/api/v1/system/status")`
(`deps.py:113-117`); **no AI path matches**.

The proving test is `tests/integration/test_ai_acceptance_gate.py` — `AI_SURFACES` at `:33-41`
enumerates seven AI paths, each asserted **present in the frozen contract** *before* the 451
assertion (`:70-79`), *because a guessed path 404s whether the gate works or not* (`:20-22`), plus a
token-bearing caller test (`:87`) and the anti-blindness unlock test (`:104`).

**Binding consequence for §3b:** any tier-1 endpoint R-54 adds is covered by inheritance but is
**not tested at its own path until it is added to `AI_SURFACES`**. That addition is part of the
delta, not a follow-up.

**What a deep link does in unaccepted/locked states** is **not established by this survey** and is
an acceptance-criteria gap, not an assumption to make: the gate returns 451 on reads, and a link
that lands on a page whose readers are all 451 needs a stated behaviour. **§9-E carries it.**

### 0-I. ⚠ A RATE-LIMITED REQUEST IS INDISTINGUISHABLE FROM A DOWN MODEL

`grounding.py:147` tests `not health.available or _rate_limited()` in **one condition**, so both
emit `"provider": "fallback"` with a built-in legend and **no** `fallback_signal`. Rate limiting is
in-process only (`_request_times` module global, `_rate_limited()` `:45-52`, 60-second window
against `ai_max_requests_per_minute` `:49`).

**Why R-54 cannot ignore it.** Tier 1 makes **zero network calls by construction** and therefore
**can never be legitimately rate-limited**. If tier-1 answers route through this branch they inherit
a throttle that has no reason to apply to them — and a user in no-egress posture, the posture the
product is proudest of, would hit it. **§9-F carries this with the tier declaration**, since both
turn on the same question: which branch a tier-1 answer is emitted from.

### 0-J. POSTURE-COPY AMENDMENT SCOPE — the exact ratified strings

Five served posture constants, `app/api/v1/routes/ai.py:56-61`, registry `POSTURE_COPY` `:66-72`,
mode map `POSTURE_MODE` `:77-83`; served never client-composed (`:41-50`); **pinned by
`tests/unit/test_posture_copy_ratified.py`** on the AC-L3 spec↔code parity pattern — *edit the
record and the guard carries the change into the product; edit the product alone and the guard goes
red* — and it also asserts **coverage**, so a new posture branch that forgets to register a string
reds rather than shipping unratified copy (ai-surfaces §12-3).

The ratified table is `ai-surfaces.md:985-991`. **Only the no-egress row was ruled explicitly**; the
other four were ratified by the look.

**Strings that gain dated notes when tier 1 formally lands** — the enumeration §9-G rules on:

1. **`POSTURE_NO_EGRESS`** (`ai.py:56-57`) — *"No-egress is on — this device makes no outbound calls,
   so answers are built from your data only, with no AI narration."* The comment at `ai.py:52-55`
   already records that R-54 owns its amendment.
2. **`POSTURE_DISABLED`** (`ai.py:58`) — *"Deterministic — fact-only answers; nothing is sent
   anywhere."* **"fact-only" becomes false the moment tier 1 explains a term**, so this string moves
   whether or not anyone plans for it.
3. **The Ask posture line's descriptor** — `POSTURE_LOCAL_OPENAI` (`ai.py:59`), *"local
   OpenAI-compatible endpoint"* — vs the Settings/GLOSSARY *"Ollama-compatible"* label
   (`vocabulary.py:52-56`). **This is I-3 / §9-G.**
4. **The Settings AI-tab sentence** — `AI_TAB_COPY`, `app/api/v1/routes/system.py:356-378`. Note
   R-57 is **sequenced immediately after R-54 precisely so it edits settled strings**
   (`release-readiness.md` Amendment 8) — so leaving this half-amended is not a deferral, it is a
   handoff defect.

**The accuracy guards must hold both versions true in their time** (`ROADMAP.md` R-54), and a change
here reds `tests/unit/test_help_content_accuracy.py`, which binds Help claims to live product
strings — i.e. **the posture amendment and the Help delta are one delta, not two**.

### 0-K. ⚠ VERIFY-FIRST DIVERGENCE — INTAKE ROW I-2's PREMISE IS WRONG

`ROADMAP.md` R-54 (ii) describes `AskPanel.test.tsx:27` as mocking `privacy_label` with *"a **retired
real string**."* **It is not retired. It is live and ratified:**

```
app/api/v1/routes/ai.py:61          POSTURE_LOCAL_NPU = "On-device (local Hailo/Ollama) — portfolio facts stay on this device."
frontend/src/.../AskPanel.test.tsx:27   privacy_label: "On-device (local Hailo/Ollama) — portfolio facts stay on this device.",
```

It is the **local NPU row of the ratified five-string table** (`ai-surfaces.md:990`). The confusion
is traceable and worth writing down: §14-2 retired the user-facing word *"hailo"* from the **kind
label** (`kind_label` → *"On-device model (Ollama-compatible)"*, `vocabulary.py:52-56`), and
`GLOSSARY.md:382` records that retirement — but `privacy_label` is a **different served field**, and
its Hailo/Ollama posture string was ratified **later**, at the 0a look. **Two fields, one word, one
retired and one not.**

**The hazard the row names is real and worse than stated:** the fixture is byte-identical to
currently-served copy, so a grep for the served string finds a test file, and a specimen cannot tell
fixture copy from product copy. **And there is a second instance the row did not name** —
`NO_EGRESS_STATUS` (`AskPanel.test.tsx:37-39`) carries the ratified no-egress string verbatim.

Note the file's own convention is **deliberate duplication** — `AskPanel.test.tsx:43-45` records
that `DISCLAIMER` (`:42`), `PROV_BUILT_IN` (`:46`), `PROV_ON_DEVICE` (`:47-48`) and
`FALLBACK_SIGNAL` (`:49`) are written out rather than imported **so the assertions are not
tautological**. **I-2's fix must not break that**: the goal is copy that is *obviously synthetic*
where the test only needs *a* string, while assertions that must pin *the* served string keep
pinning it. Which of the two each literal is, is a per-literal judgement — carried on **I-2**, and
§9-H asks the owner only for the naming convention.

### 0-L. HELP CURRENCY — what this milestone will touch

The `ask` entry is `app/services/help.py:626` (`category: "Orientation"`, title *"Asking about your
data"*). It already carries the provenance line as a listed output and the three kinds in
`interpret` (ai-surfaces §15-4).

**Three-store parity is enforced with `GLOSSARY.md` as the parent** —
`tests/unit/test_glossary_parity.py`. Stores: `docs/specs/GLOSSARY.md` (canonical),
`frontend/src/mocks/glossary.ts` (the `[Help]` popover), and `app/services/help.py`'s
`category: "Glossary"` entries (`_served_terms`, `:66-71` — note the docstring still says
`"Terms"`, the code reads `"Glossary"`). Every served term must appear in the spec as `**Title**`
(`:104-118`) unless declared in `_HEADING_NOT_A_TERM` **by name with a reason** (`:77-95`) — *never
by silence, and never by loosening the match*. A separate test forbids **silent aliases** — one id
per concept across both code stores (`:122-140`).

**Consequence:** any new sanctioned term R-54 introduces (a tier name, a legend word, a link label)
is **spec-first — `GLOSSARY.md` before either code store** — and the parity guard carries it. The
Help delta this milestone owes is named at **§9-I**; per the Help Currency Law the close states the
delta or a **guard-corroborated** "no Help impact", and given the panel gains behaviour, "no impact"
would carry the burden of proof.

### 0-M. `check:primitives` IS THE SHAPE THE §9-E GUARD SHOULD COPY

`frontend/package.json:22` → `node scripts/check-ui-primitives.mjs`, wired into the aggregate
`check` (`:24`). Its scope is **narrow and deliberate**: only raw `<input type="checkbox">`
(`RAW_CHECKBOX`, `check-ui-primitives.mjs:66`), one allow-listed owner
(`OWNER = "src/components/ui/Checkbox.tsx"`, `:39`, skipped `:76`), comments stripped with newlines
preserved so reported line numbers stay accurate (`:54-62`), violations printed `file:line` and
exit 1 (`:99-109`).

**And it is pinned against going blind** (`:88-97`): if `Checkbox.tsx` disappears or stops
containing `type="checkbox"`, the guard **exits 1 rather than passing vacuously** — the CLAUDE.md
requirement that a guard fail loudly rather than pass by protecting nothing. **The
panel-explains/page-acts guard (§9-E) is the same shape: a static source scan with a named owner and
a blindness pin.**

**What the AskPanel renders today** (`frontend/src/components/ui/AskPanel.tsx`), composition-only,
no new primitive (`:12-17`, rationale `:20-38`): trigger Button (`:241-247`) → Dialog (`:249-250`) →
served posture line (`:271-282`, the rendered expression is `{status.privacy_label}` at `:276`,
removed once the provenance legend arrives per §17-1) → composer `TextInput` + Ask Button
(`:284-297`) → idle `EmptyState` (`:299-304`) → fallback signal, served verbatim, **leading** the
facts (`:316-320`) → fact pack (`:322-331`) → answer with the served disclaimer projected out
(`:337-346`, projection `:231-237`) → provenance legend (`:358-362`) → served disclaimer (`:369`).
State is ephemeral by construction — `reset()` (`:142-156`), no localStorage (`:35-37`).

**Interactive controls beyond input and submit: exactly two, both incidental** — the Dialog trigger
(`:241`) and a per-fact **Show more/Show less** toggle rendered only for multi-line help facts
(`:101-105`, gated `:93`, `:67-69`). **No tabs, no settings, no model picker, no history, no
copy/export.** *The boundary §9-E is asked to guard is, today, actually held* — which is the best
possible moment to write the guard, and also means the guard must be **proven RED against a
deliberate specimen**, since no current violation exists to catch it.

---

## §1. IDENTITY

*Not a page — a component milestone. §1/§2 describe UI-state and capability, per the TEMPLATE's
shell/overlay adaptation (`TEMPLATE-page-build.md:108-126`).*

| Field | Value | Spec ref |
|---|---|---|
| Surface | **Ask panel** (`AskPanel.tsx`), mounted in the shell (`AppShell.tsx:235`) and on Instrument Detail as *"Explain"* (`InstrumentDetail.tsx:198`) | ai-surfaces §1 |
| Route | **None.** A Dialog inside the shell | — |
| Template | Gate/overlay adaptation of the page template | `TEMPLATE-page-build.md:116-126` |
| One-line purpose | Answer a user's question about **their own figures and this product**, declaring **which tier answered** and **who wrote the sentence** | `ROADMAP.md` R-54 |
| Tier 1 | **Deterministic** — intent routing + canonical endpoints; **zero network calls BY CONSTRUCTION**; works in every posture incl. no-egress | `ROADMAP.md` R-54 |
| Tier 2 | **Model narration** — egress-gated per the R-22 amendment | `DECISIONS.md` R-22 AMENDMENT |
| **Boundary** | **The panel EXPLAINS AND POINTS; the page ACTS.** Deep links, never embedded controls | `ROADMAP.md` R-54 |
| Out of scope | **Step-by-step calculation display = R-53** (engine-served derivation traces, ⛔ post-release). Cross-referenced, never duplicated | `ROADMAP.md` R-53 |

**The R-53 boundary is sharper than the brief implies, and the survey can state where it falls.**
Glossary entries already ship a **static, sample-marked** `example` field — e.g.
`app/services/help.py:822`, *"Sample — 10,000 invested in January and 90,000 more in December…"*
**R-54 replaces the sample *figure* with the user's own, from its canonical endpoint. R-53 adds the
*derivation steps* that produced it.** One is a lookup, the other needs the engine to serve a trace
— which is exactly why R-53 is an architectural epic and R-54 is not.

## §2. OWNERSHIP — UI-state and routing, never figures

**Owns (canonical here):** the intent taxonomy and its routing; the term → canonical-endpoint
registry (**location §9-B**); the deep-link registry (**location §9-D**); the tier declaration
(**§9-F**); the posture copy (**§9-G**).

**Owns NO figure.** Every number tier 1 shows is read from that figure's canonical endpoint (§0-D)
and **never recomputed** — the one-derivation law. A tier-1 answer is a **reader**, like any summary
widget, and the enforcement corollary applies unchanged: **it may not show a figure its canonical
page does not show.**

**Links to:** Help (`?topic=`), Settings (`?tab=`), Holdings (`?account=`) — §0-F.

## §3. API SURFACE

### 3a. Consumed (already in the frozen contract)

`GET /ai/facts` (`ai.py:24`) · `GET /ai/grounding-status` (`ai.py:86`) · `POST /ai/chat`
(`ai.py:133`) · `GET /help` (`system.py:993`) · plus the per-figure canonical endpoints of §0-D, on
demand and **only** those the registry names.

### 3b. Contract deltas — ✅ **RESOLVED: NONE. And the reason is itself a finding.**

**Verified against the frozen contract this session, not assumed:**

```
docs/specs/API-CONTRACT.json → paths: 141   schemas: 71     (baseline, unchanged)
AI paths present: /ai/chat · /ai/facts · /ai/grounding-status · /ai/status · /system/ai-config
AI schemas present: ChatIn — and NOTHING ELSE
```

**No tier-1 work adds a path.** The §9-B registry resolves **inside** `gather_facts` / the answer
stream (backend-internal, no surface). §9-C routes figures through the **existing** fact-pack
projection. §9-D's **served link IDs ride the existing `/ai/facts` response and the `/ai/chat` SSE
events.** **141 / 71 stand. No regeneration.**

**⚠ BUT — AND THIS IS THE FINDING — THE AI RESPONSE SHAPES ARE NOT PINNED BY THE CONTRACT AT ALL.**
`ai_facts` is declared `-> dict` (`app/api/v1/routes/ai.py:26`) and returns a hand-built dictionary
(`:33-38`); `/ai/chat` is a `StreamingResponse` (`ai.py:135-143`). **`GroundingFact` is not a
contract schema** — it exists only as a Pydantic model (`app/schemas/ai.py:46-67`) that never reaches
the contract because no route declares it as a `response_model`.

**The consequence, stated plainly: adding link IDs to the served fact shape regenerates NOTHING, so
`make api-contract-check` stays green while the shape the frontend consumes changes underneath it.**
This is the TEMPLATE's `response_model` note (`TEMPLATE-page-build.md:204-206`) **inverted** — that
note warns a typed response *strips* undeclared keys; here there is no model, so nothing is stripped
**and nothing is pinned**.

**Therefore this milestone pins the shapes itself.** A **served-shape test** on `/ai/facts` and on
the `facts`/`provenance` SSE events is a **Phase-0 deliverable, not a nicety** — it is the only thing
that can turn red when tier-1 changes what the panel is handed. *A contract check that cannot see a
shape is not a guard for that shape, and reporting 141/71 unchanged would otherwise read as "nothing
moved" when something did.*

**⊕ FILED AS `ROADMAP.md` R-61 — POST-RELEASE** (owner ruling, 2026-07-20, at the §9 conveyance:
*the finding was too good to live only in a plan file*). Typing the AI responses properly
(`response_model` + contract regeneration) touches **every** AI surface and would move the contract
counts, so it is **larger than R-54** and was deliberately not folded in. **The release-relevant
coverage is R-54's own Phase 0-6 served-shape test**, not R-61. *R-54 recorded the knowledge rather
than inventing a ruling; the owner then ruled.*

## §4. COMPONENTS

Ratified only. The panel composes `Dialog`, `TextInput`, `Button`, `Skeleton`, `EmptyState`,
`StalenessChip` (`AskPanel.tsx:12-17`).

Tier 1 adds, at most: **a link affordance inside an answer**. Whether an existing primitive covers
it or it is a **DESIGN-SYSTEM amendment request** is not settled here — it depends on §9-D/§9-E
(whether links render as inline prose links or as a distinct pointer element). **Listed as a
potential amendment; ratified at 0a by looking, never assumed.**

**Forbidden by the §1 boundary and guarded at §9-E:** any interactive control inside the panel
beyond the question input, submit, and the existing incidental two (§0-M).

## §5. VOCABULARIES

The **three kinds of intelligence** are ratified and are used exactly as spelled —
`GLOSSARY.md:343,353-355`: **Built-in intelligence** · **On-device model** · **External model**.
Served labels `vocabulary.py:52-56`; served label for the second is **"On-device model
(Ollama-compatible)"**.

**Note the vocabulary gap R-54 opens.** GLOSSARY defines *Built-in intelligence* as *"deterministic
answers assembled from your own figures by the app itself"* (`:353`) — which is **tier 1's
definition already**, under a name that also covers the tier-2 fallback. If R-54 needs a term that
distinguishes *"tier 1 answered"* from *"tier 2 failed and you got built-in"*, that term is **new and
spec-first** (§0-L). **§9-F.**

## §6. DECISIONS IN FORCE

| Decision | What it requires here |
|---|---|
| **R-22 AMENDMENT** (`DECISIONS.md:911`) | No-egress means **zero calls including loopback**. Two posture states, not three. Tier 1 is inside it **by construction**, not as an exception — *no egress question can arise about a code path that cannot make a call* |
| **Commitment 5** | Zero outbound calls as an **observable property of the device** — never delegated to a process LedgerFrame does not control |
| **Commitment 7 / SECURITY-BASELINE §5** | The validation contract, clause identity pinned by `tests/unit/test_validation_contract_pinned.py:52-60` against `SECURITY-BASELINE.md:139-168`. **Whether tier-1 output is subject to it at all is §9-J** |
| **D-070** | A fallback is **signalled**, never silent (`grounding.py:40`). Extends to tier boundaries: a tier-1 miss must be visible |
| **D-086** (`PRODUCT-SPEC.md:152`) | **No annualised/CAGR figure exists.** A registry row for it would fabricate a number |
| **P-1 / one-derivation law** | Tier 1 reads canonical endpoints; **never recomputes**, never becomes a second derivation site |
| **D-105 / DS** | Served display strings for rendered values; the frontend formats nothing — **collides with §0-D, raised at §9-C** |
| **Help Currency Law** | The close states the Help delta or a **guard-corroborated** "no Help impact" |

## §7. ACCEPTANCE CRITERIA — **COMPLETED from the §9 resolutions**

*Every row answers **"what turns red?"** — the CLAUDE.md bar. Where the honest answer is "nothing
today", it says so; silence is not permitted. The guards ruled at §9-D/E/F are AC rows here, not
footnotes.*

### 7-A. Tier-1 determinism — the claim the milestone exists to make

- [ ] **ONE intent router.** `classify_intent`'s closed enum is the sole authority; the eight
      `gather_facts` flags are **derived from it, in one table**. **What turns red:** the two routers
      cannot disagree **because there is only one** — structural. Plus: a test pinning each flag as a
      derivation, so re-introducing an independent word list reds.
- [ ] **Word-boundary matching.** **What turns red:** the §0-A substring hazards as **RED
      specimens** — *"closed"*/*"lost"* must not trip `"los"`, *"downgrade"* must not trip `"own"`.
      Seen failing on the pre-fix build.
- [ ] **A miss fails honestly.** An unroutable question returns the **ratified empty-fallback
      shape** — never an approximate answer. **What turns red:** a specimen question with no intent
      asserting the empty shape, not a nearest match.
- [ ] **Tier 1 makes ZERO network calls.** **What turns red:** a guard proving no tier-1 path can
      reach `egress_client`. *This is what converts "by construction" from a claim into a fact.*
- [ ] **Tier 1 is never rate-limited** (§9-F). **What turns red:** a test that **produces tier-1
      answers with the limiter exhausted**, and asserts a rate-limited tier-2 **falls back TO tier-1**
      rather than to a bare fact list.
- [ ] **Tier 1 answers under no-egress, live** — the panel goes **local, not dark** (the R-22
      amendment's two-state consequence).

### 7-B. Figures — one derivation, one projection

- [ ] **Every tier-1 figure arrives via the fact-pack projection** (§9-C) — never a `to_display`
      float, never a raw endpoint read. **What turns red:** a render-path test asserting the
      projection is the only source.
- [ ] **Every figure matches its canonical page's figure**, read from the §0-D endpoint, **never
      recomputed** (one-derivation law). **What turns red:** a cross-check against the canonical
      reader.
- [ ] **No fabricated figure.** A term with no live figure **explains the term and says so**
      (Guarantee 3). **What turns red:** a registry-completeness test — **and no CAGR row exists**
      (D-086); a row for a figure the engine does not serve reds.
- [ ] **The registry is ONE table** (§9-B) — `FIGURE_IDENTITY` absorbs it; analytics' `term_id` is
      its **derived reverse index**. **What turns red:** three-store parity extended to the registry;
      a second store for one fact reds.
- [ ] **Glossary entries reach the pack whole** — `what`+`why` unconditional, `improves`+`example`
      budgeted. **What turns red:** a guard comparing the tier lists to the **actual Glossary
      schema**, so a field in one and not the other cannot go quiet again (§0-C had nothing).

### 7-C. Links — the panel points, the page acts

- [ ] **Backend serves semantic link IDs; the frontend owns ID→route** (§9-D).
- [ ] **Bidirectional resolution.** **What turns red:** every **served ID is registered**, and every
      **registered ID resolves** against the **live route/topic catalogue** — reaching the *served*
      Help catalogue, since an unknown `?topic=` is a **silent no-op** (`Help.tsx:302,309,334`).
- [ ] **No interactive control inside the panel** beyond input, submit and the incidental two
      (§0-M). **What turns red:** a guard in the `check:primitives` shape — narrow scan, named owner,
      **blindness pin** — **proven RED on a deliberate specimen**, because the boundary is currently
      held and no live violation exists to catch it.
- [ ] **A deep link never bypasses the acceptance gate or the PIN** — **the server refuses
      regardless** (§9-E). **What turns red:** a representative test at the server, not a client
      matrix; navigation confers no authority.
- [ ] **A link only ever targets a route that exists today.** **What turns red:** the resolution
      guard — and it is what makes the **R-54 → R-59 ordering mechanical**: the add-holding form's ID
      **cannot be registered before its route ships**. Until then tier-1(b) links to the **Holdings
      page**, which exists.

### 7-D. Provenance, posture and copy

- [ ] **No fourth legend axis** (§9-F). Tier-1 **is** the no-narration state; the ratified
      *"Built-in intelligence only — no model was used."* stands. **What turns red:** the existing
      nine `test_ai_provenance.py` assertions, unchanged and still green.
- [ ] **Tier-1 prose is fixed SERVED sentences** under the **§17-2 truth bar** — a fixed sentence
      may not cite UI that does not render. **What turns red:** the §17-2 guard.
- [ ] **All rendered strings served**, incl. errors / empty / disabled (ai-surfaces §0-C).
- [ ] **The recut five-string posture table is ratified at 0a by looking** (§9-G) — PROPOSED until
      then. **What turns red:** `test_posture_copy_ratified.py`, incl. its **coverage** assertion, so
      a new posture branch that forgets a string reds rather than shipping unratified copy.
- [ ] **"Hailo" is gone from served copy**; **"Ollama-compatible"** is the one user-facing
      descriptor. **What turns red:** the **deprecated-term guard's corpus extended to ALL served AI
      strings** — the §14-2 lesson mechanised (*retiring a term without a parity guard is retiring it
      in one place*).
- [ ] **Dated notes on the amended strings; both versions true in their time.** **What turns red:**
      `test_help_content_accuracy.py`, which binds Help claims to live product strings — i.e. **the
      posture amendment and the Help delta are ONE delta**.

### 7-E. Contract, gate and shape

- [ ] **No contract delta; 141 paths / 71 schemas unchanged**, stated and pinned (§3b).
- [ ] **The served AI shapes are pinned BY THIS MILESTONE** — a shape test on `/ai/facts` and on the
      `facts`/`provenance` SSE events. **What turns red:** that test, and **only** that test — the
      contract check **cannot see these shapes** (§3b), which is precisely why it is owed.
- [ ] **Any new path is added to `AI_SURFACES`** (`test_ai_acceptance_gate.py:33-41`) **in the same
      delta**. *Expected to be vacuous — §3b adds no path — and asserted anyway so the rule does not
      lapse the first time it has nothing to do.*

### 7-F. Presentation and the standing bar

- [ ] **Both themes, both densities**; prose full-width responsive; **tabular figures**; semantic
      colour only.
- [ ] **Keyboard + WCAG AA**; the panel is a Dialog and keeps its focus contract.
- [ ] **Rendered-layout claims verified by RENDERING**, not unit tests (jsdom has no layout engine);
      the pre-pass carries any measuring assertion.
- [ ] **Copy hygiene** — no decision IDs, no `§` refs, no endpoint/enum names in user-facing strings.
- [ ] **Help currency** (§9-I): the `ask` entry rewritten for two tiers **including the zero-egress
      call-out**; GLOSSARY **spec-first** for new terms; the **HELP CURRENCY SUITE** green at close.
      *"No Help impact" is not available to this milestone.*
- [ ] **Every new guard proven RED first**, on a specimen that reproduces the defect — never a
      theory of it.

---

## §8. BUILD PHASES

*One delta per commit. Backend-first. **Both postures** (§26-bis): never the owner's live stack, no
hardcoded ports, secrets never printed. Gate verdicts from **uncontended solo runs, ordered AND
randomized**. **NO PUSH.***

### Phase 0 — BACKEND: one router, one registry, the widened pack *(several deltas)*

Backend-first because every later phase consumes it. Each delta **fail-first RED on the real cause**.

- **0-1 — Router consolidation (§9-A).** `classify_intent`'s enum becomes the single authority; the
  eight `gather_facts` flags become **one derivation table**. **Word-boundary** matching. **RED
  first:** the §0-A substring specimens (*closed*/*lost*/*downgrade*) on the pre-fix build. Then the
  honest-miss path → the ratified empty-fallback shape.
- **0-2 — The registry (§9-B).** `term-id` → declared fact identity → canonical endpoint, absorbed
  into `FIGURE_IDENTITY`; analytics' `term_id` re-derived as the **reverse index of the same table**.
  Three-store parity extended. **No CAGR row** (D-086). **RED first:** a term resolving to two
  sources, and a registry row for a figure the engine does not serve.
- **0-3 — The pack widening (§9-B amendment).** Glossary category: `what`+`why` unconditional,
  `improves`+`example` budgeted, **whole fields, never truncated mid-text**. **RED first:** the §0-C
  census — a glossary term projecting `body` alone. **Plus the schema-comparison guard**, so the tier
  lists and the Glossary schema cannot silently diverge again.
- **0-4 — Figures through the projection (§9-C)** and **0-5 — served link IDs (§9-D)**.
- **0-6 — The served-shape pins (§3b).** `/ai/facts` and the `facts`/`provenance` SSE events. **The
  contract cannot see these shapes; this is what turns red.** Contract **141/71 restated unchanged,
  no regen.**

### Phase 0-1 — ONE ROUTER (`88c5ce4`) — DONE

**Ruled at §9-A; this is the delta.** `classify_intent`'s closed enum is now the single intent
authority, `INTENT_FACT_SOURCES` is the one table, and `gather_facts` no longer routes.

**FAIL-FIRST — 5/5 RED on the pre-fix build**, asserted at the **served pack**
(`tests/integration/test_intent_word_boundary.py`, driving `POST /ai/chat` and reading the `facts`
event the panel renders). The F5 lesson governed the level: the defect is a **routing bypass**, so a
matcher-level test passes straight through it. The clearest specimen:

```
"remove a holding" pulled movers facts via the "mov" substring:
['Gainer BTC', 'Gainer D05', 'Gainer Emergency cash',
 'Detractor VOO', 'Detractor MSFT', 'Detractor NVDA']
```

**What shipped.**

| Change | File |
|---|---|
| `WATCHLIST_QUESTION` added to the enum | `app/ai/intent.py` |
| Market / portfolio rules gained the vocabulary their flags carried | `app/ai/intent.py` |
| `INTENT_FACT_SOURCES` — the one table — + `fact_sources()`, which **raises** on an unmapped intent | `app/ai/intent.py` |
| Eight flags become a projection of the table; the `has(*ws)` substring matcher deleted | `app/ai/tools.py` |
| The **second `classify_intent` call** removed — it was the visible seam between the two routers | `app/ai/tools.py` |
| The allocation axis check word-boundary matched (`\bcurrenc(?:y\|ies)\b`) | `app/ai/tools.py` |

**Two things the survey did not predict, handled rather than papered over.**

1. **The enum could not express everything the flags could.** `is_watch` had **no intent**, so a
   literal consolidation would have **silently dropped watchlist routing** — the capability would
   have died inside a refactor that reported success. Hence `WATCHLIST_QUESTION`. For the same
   reason the market rule gained `markets?`/`indices`/the remaining index names and the portfolio
   rule gained `assets?`/`liabilit\w*`/`cash`/`wealth`/`positions?`: **an authority that cannot name
   a route cannot own it**, and "one router" must not mean "a narrower product."
2. **`RISK_CONCENTRATION` legitimately needs two sources.** The old flags reached both **by
   accident** — the word *"risk"* happened to sit inside `is_perf`'s list — so the table maps it to
   `{perf, alloc}` **on purpose**. Written down because the accident and the intention are
   indistinguishable from the behaviour alone.

**Guards, and both RED paths observed** (`tests/unit/test_intent_routing_table.py`, 11 tests):

| Mutation | Result |
|---|---|
| A flag regrows a question-text check (`is_market = "market" in q`) | **RED**, as intended |
| The derivation disappears entirely | **RED via the BLINDNESS PIN**, not a vacuous pass |

Coverage (every `Intent` has a row) · no unknown source declared · `fact_sources()` raises on an
unregistered intent, **proven** not assumed · the substring specimens pinned at the classifier too ·
the honest miss returns `UNKNOWN_GENERAL_QUESTION` **and an empty source set**.

**⚠ A GUARD CAUGHT ITSELF, AND IT IS THE LESSON OF THIS DELTA.** The "only one routing authority on
disk" test was first written as a **substring sweep of the source text** and went **RED on
`app/ai/tools.py`** — whose only mention of the table is a **comment** explaining where its flags now
come from. *A guard that reads comments finds claims, not code* — precisely page-help §9-bis-9(d)
(a guard that read comments found *"the control exists"* corroborated by a comment saying it did
**not** exist yet), and precisely why `check-ui-primitives.mjs:54-62` strips comments before
scanning. Rewritten to walk the **AST**, so only a real `Name`/`Attribute` reference counts: it
cannot be tripped by prose, and cannot be silenced by deleting a comment. **Recorded rather than
quietly fixed** — the near-miss is worth more than the fix.

**Gates — solo, uncontended.**

| Gate | Result |
|---|---|
| Backend, **ordered** (`-p no:randomly`) | **1982 passed, 15 skipped** — exit 0 |
| Backend, **randomized** | `**1982 passed, 15 skipped** — exit 0` |
| `make lint` | **PASS** |
| Contract | **141 / 71 unchanged, no regen** (no path, no schema — §3b) |

Baseline before the delta was **1966**; the +16 are this delta's own (5 served-pack specimens +
11 structural guards).

**⊕ I-1 — A ROOT-CAUSE HYPOTHESIS, FROM READING THE CODE THIS DELTA TOUCHED.** `I-1` is
`test_performance_question_pulls_risk_metrics`, and this delta **changed how its question routes**
(now `RISK_CONCENTRATION → {perf, alloc}`, previously `is_perf → {perf}`), so "it passed" is not a
sufficient report. Reading the path it now takes:

`performance_facts` **skips any metric whose value is `None`** (`app/ai/tools.py:352-353`), and every
metric the test's assertion can be satisfied by — `1Y volatility`, `Return / volatility`,
`Max drawdown (1Y)` — is served as `value if da_computable else None`
(`app/services/analytics.py:205-210`). So when the **date-aware window is not covered**,
`da_computable` is `False`, **all** of those metrics become `None`, all are skipped, and the
assertion `("volatility" in joined or "drawdown" in joined)` fails.

**That is a coverage/seed-state dependency, not machine contention** — which would explain why it
"passes solo" (the seeded backfill has settled) without any of the gates ever being able to see it.
**Not fixed here** — I-1 is its own intake row and its own delta; this is the evidence that delta
should start from, rather than re-running the test and blaming the machine. **The fix must also
account for the routing change above**: the pack is capped at 20 (`_dedupe`), and this delta added
allocation facts to that question's pack.

**Help currency:** no user-facing string changed in this delta — internal routing only. Stated here;
**the milestone's Help delta is owed at close** (§9-I), not at this phase.

---

### Phase 0-2a — THE REGISTRY, AI-SIDE ONLY (`0d19a5a`) — DONE

**Ruled at §9-B, split into 0-2a/0-2b by chat ruling 2026-07-20.** `app/services/figure_registry.py`
is the one table: **21 rows**, each `figure_id → canonical GLOSSARY label → canonical endpoint +
field`, carrying `term_id` and aliases. `FIGURE_IDENTITY` is **absorbed** — the table is gone from
`app/ai/tools.py`, and its two functions keep their exact contracts so `_dedupe` is untouched by the
move. **`analytics.py` is untouched**, as ruled.

**Why it lives in `app/services`, not `app/ai`.** 0-2b has `analytics.py` derive from it, and
analytics is a **portfolio** surface. A registry under `app/ai/` would make a non-AI page import the
AI package to learn its own figures' names — a layering inversion, and the kind that is very hard to
undo once something depends on it. Nothing in the module imports from `app/ai`.

#### ⚑ F-1 — A LIVE GLOSSARY VIOLATION, INSIDE THE MAP BUILT TO PREVENT IT

`FIGURE_IDENTITY`'s whole job was relabelling figures to their **GLOSSARY spelling** — its own
comment cites `GLOSSARY.md:157/161` for exactly that. Two of its nine rows carried labels
**GLOSSARY does not have**:

| Served label | GLOSSARY says |
|---|---|
| `Total assets` (`tools.py:60`) | **Gross assets** (`GLOSSARY.md:66`) — "Total value" was already D-021-retired |
| `Total liabilities` (`tools.py:61`) | **Liability** (`GLOSSARY.md:67`), singular, an asset-class concept |

`networth_facts` (`tools.py:330-332`) has been **serving both to users** in the fact pack the panel
renders under *"What this is built from"*. CLAUDE.md's hard rule is that every term shown to a user
exists in GLOSSARY with that exact spelling.

**Nothing could see it.** `test_glossary_parity` measures the **Help store** against the spec —
GLOSSARY is its enforced parent — and the **AI's fact labels were never in any store it reads**.
The three-store guard had a fourth store.

**Disposition, split by whether a decision is required:**

* **`Total assets` → `Gross assets` — APPLIED.** Not a new decision: the GLOSSARY term exists and
  the same row cites D-021. `"total assets"` survives as an **alias**, so old labels still resolve
  and absorbing the map drops no mapping (`test_gross_assets_carries_the_retired_label_as_an_alias`).
* **`Total liabilities` — ⚑ OPEN, F-1, for the owner.** GLOSSARY has **Liability** (singular) and
  uses the word *"Liabilities"* only inside Net worth's definition prose. Neither sanctions it as a
  **figure label**. **NOT renamed here** — which spelling is right is an owner call, and it is
  carried as a **declared exemption with a reason** in `LABELS_NOT_IN_GLOSSARY`, the
  `_HEADING_NOT_A_TERM` convention: *exempt BY NAME WITH A REASON — never by silence, and never by
  loosening the match*. The guard stays strict; the question stays visible.

**What turns red now:** `test_every_canonical_label_is_a_glossary_term_or_a_declared_exemption` —
the first guard in this product to measure **the AI's fact labels** against GLOSSARY — plus
`test_exemptions_are_not_stale`, so an exemption cannot outlive the row it covers.

#### Two more findings from building it

**`term_id` IS ONE-TO-MANY, and the ruling's phrasing (*"term-id → fact identity"*) implies
one-to-one.** `term-xirr-twr` covers **2** figures, `term-allocation-weight` **4**,
`term-concentration` **2**. So the table is keyed by **`figure_id`** — which *is* unique — and
`figures_for_term()` returns a **tuple, not a row**. This is not a workaround: it is the correct
tier-1(a) behaviour, since *"what is XIRR"* should show the explanation alongside **both** XIRR and
TWR, and the Help entry is itself a two-term heading `test_glossary_parity` already declares.

**Net worth has NO `term-*` Help entry.** The headline figure and a GLOSSARY term, with nothing in
the Help glossary to explain it — so `term_id=None` is a **real answer** in the schema, not a gap to
fill with a guess. Tier-1(a) may show the figure without an explanation and **must not invent one**
(`test_a_figure_may_have_no_help_entry_and_that_is_a_real_answer`). Likely **R-55** Help-content
territory; **not filed by this delta**.

#### The ruled fail-firsts — five mutations, each on the right guard

| Mutation | Guard that fired |
|---|---|
| `"net worth"` aliased onto `gross_assets` | `test_no_label_resolves_to_two_figures` |
| Two rows claiming the same `(endpoint, field)` | `test_no_two_rows_claim_the_same_canonical_source` |
| A `CAGR` row added | `test_no_registry_row_for_a_prohibited_figure` (D-086) |
| Endpoint typo'd to an unrouted path | `test_every_row_names_an_endpoint_the_app_actually_routes` |
| An undeclared non-GLOSSARY label | `test_every_canonical_label_is_a_glossary_term_or_…` |

The endpoint guard checks each row against the **frozen contract**, not a plausible-looking string —
so an aspirational endpoint reds rather than shipping as a dead promise.

⚠ **The collision guard caught my own data first.** Its first RED was a **self**-collision: rows
listing the canonical label again inside `aliases`. The guard was right and the table was redundant.
Both were fixed — the aliases cleaned, and the guard made precise (it compares **figures**, not
names, and separately forbids a row repeating its own canonical label), so a genuine ambiguity can
never again hide behind a self-collision.

#### The transitional two-sources state, made safe the F6 way

As ruled: `analytics.py` keeps its 18 inline `term_id`s for exactly one delta, so the mapping
briefly lives in two places — *the* defect this registry exists to end.
`test_analytics_inline_term_id_equals_the_registry` parametrises over **all 18**, AST-parsed (the
Phase 0-1 lesson: a guard that reads comments finds claims, not code) with a **blindness pin on the
parser** so a drifted parser cannot pass over an empty list. Coverage is asserted in both directions.
**The test documents its own deletion at 0-2b** — if it is still here afterwards, that is the bug.

#### One existing guard repointed, deliberately

`test_the_figure_identity_map_is_not_empty` (`test_ai_fact_pack_canonical.py`) imported
`FIGURE_IDENTITY`; §9-B moved its **subject**. It is **repointed, not deleted** — deleting a
blindness pin because its import broke is a guard silently retired, precisely the failure the pin
exists to prevent — and **strengthened**: it now asserts both that identities are declared *and*
that the lookup `_dedupe` actually calls still resolves one. An empty registry and a registry the
resolver cannot reach are both "protecting nothing", and only the first was visible before.

#### Gates — solo, uncontended

| Gate | Result |
|---|---|
| Backend, **ordered** | **2014 passed, 15 skipped** — exit 0 |
| Backend, **randomized** | `**2014 passed, 15 skipped** — exit 0` |
| `make lint` | **PASS** |
| Contract | **141 / 71 unchanged, no regen** — no path, no schema |

1982 → 2014; the +32 are this delta's guards.

**Help currency:** no served string changed. `Total assets` → `Gross assets` moves a **fact-pack
label**, which *is* user-visible — but it moves it **onto** the ratified GLOSSARY spelling, so the
Help accuracy corpus binds to a term that now matches the spec rather than diverging from it. The
milestone's Help delta is owed at close (§9-I).

---

### Phase 0-2b — THE DERIVATION, PORTFOLIO-FACING (`fa7b656`) — DONE

**Ruled at §9-B; split from 0-2a and pre-ruled in four items (chat, 2026-07-20).** `analytics.py`'s
18 inline `term_id` literals are **deleted**; the ids are **derived** from the one registry through
`_with_term_ids()`. The transitional tripwire is deleted in this same delta.

#### ① F-1 RATIFIED — and verifying the reading made it stronger than the finding

**Spec-first, in its own commit (`2c0016d`) ahead of the code**, as ruled. The owner ruled *GLOSSARY
catch-up* rather than rename, and the corroboration is overwhelming:

| Evidence | What it shows |
|---|---|
| **D-032** | Net worth page canonical for *"Net worth, Gross assets, **Liabilities**"* |
| **D-054** | KPI strip ratified as *"Net worth / Gross assets / **Liabilities** / Cash & deposits"* |
| `NetWorth.tsx:204` | **has shipped** `label="Liabilities"` on that **accepted** page |
| `NetWorth.tsx:208` | renders *"Net worth = Gross assets − Liabilities **(GLOSSARY)**"* |

That last row is the finding in one line: **a user-facing string citing GLOSSARY for a term GLOSSARY
did not contain.** The defect was never the label — it was the **missing row**. GLOSSARY now carries
**Liabilities** as the *aggregate figure* (positive, a component of Net worth), stated **distinct
from Liability**, the asset-class term for a single holding. *A figure and a taxonomy one letter
apart, which is exactly why nothing noticed.*

Registry canonical label → **Liabilities**; `"total liabilities"` survives as an **alias** so
`_dedupe` relabels the served fact to the ratified spelling. **The carve-out is deleted: an ordinary
row, zero exceptions**, as ruled.

**⊕ AND THE AUDIT FOUND TWO CARVE-OUTS THAT WERE NEVER NEEDED.** `Cash & deposits` and
`Return / volatility` were exempted while **both ARE GLOSSARY terms**. `test_exemptions_are_not_stale`
could not see it: it asked whether an exemption named a **used** label, never whether it was
**necessary**. *An unnecessary carve-out is worse than none — it is a hole with a reason attached,
and it is exactly where the next real violation hides.* The guard now reds on any carve-out whose
label IS in GLOSSARY. **13 → 10, each proven load-bearing.**

#### ② ⚑ F-2 — THE CENSUS GAP IS REAL, AND IT IS NOT WHERE IT WAS PREDICTED

**The predicted precondition does not exist.** Ruling ② was conditioned on *"the dynamic key_stats
path"*; there is none. The four allocation metrics are **static literals**
(`analytics.py:213-216`). **Recorded as a wrong prediction rather than quietly dropped** — the
survey-side claim was mine, and a prediction that did not hold is worth more on the record than off
it.

**The real gap is one level down.** The buckets are `weight(...)` over **hardcoded class names**
(`analytics.py:94-97`), and against the enum:

```
AssetClass members in NO bucket:  bond · other · retirement
```

(`liability` is correctly absent — weights are share of **gross** assets, liabilities excluded, per
GLOSSARY *Allocation weight*.)

**Proven live on the SHIPPED DEMO DATA**, not argued from the enum:

```
Cash & deposits 6.2 · Equities & ETFs 4.4 · Crypto 1.0 · Alternatives 80.5
SUM = 92.1        →  a 7.9-POINT SHORTFALL
```

**The Portfolio stat rail under-reports allocation today**, on an **accepted** surface (D-048), and
**nothing catches it**. The demo seed contains `other`, so this is visible in the default dataset —
it did not need real-shaped data to appear, only for someone to add the four numbers up.

**NOT FIXED HERE, and the reason is the point.** The repair changes **what an accepted page
displays** — a product-content decision, not a refactor — and it would break the byte-identity this
delta exists to prove, for a reason unrelated to the derivation. Ruling ②'s *"fix in 0-2b"* was
conditioned on a path that does not exist, so applying it anyway would be executing the letter of a
ruling whose premise failed. **⚑ F-2 is filed OPEN for an owner ruling.**

#### ③ BYTE-IDENTITY — PROVEN. THE SKIP IS HEREBY STATED.

```
before: 2740 bytes   sha256 69eba119290186be0236634804519877
after : 2740 bytes   sha256 69eba119290186be0236634804519877
*** IDENTICAL — zero byte difference ***      (18 term_id keys, unchanged)
```

Captured by driving `GET /api/v1/portfolio/stats` through the real app before and after the change,
serialised with sorted keys.

**⟶ Per ruling ③: byte-identity proven, therefore the `page-portfolio` pre-pass is SKIPPED, AND
THIS SENTENCE IS THE STATEMENT OF THE SKIP.** No dated delta note is owed on `page-portfolio.md`,
because the served surface did not move. **No third option was taken.**

**One hazard the proof forced into the open.** A metric with no registry row must carry **no
`term_id` key at all** — emitting `{"term_id": None}` would be a **new key on the wire** and would
have broken byte-identity silently. `Positions` is the standing example. `_with_term_ids` omits
rather than nulls, and `test_analytics_still_derives_term_ids_at_all` pins **both halves**.

#### ④ THE TRANSITIONAL TRIPWIRE IS DELETED IN THE DELTA THAT OBSOLETED IT

`test_analytics_inline_term_id_equals_the_registry` promised its own deletion at 0-2b in its
docstring, and is **gone**. *A tripwire that outlives its transition asserts a tautology and reads
to the next person as though a risk is still being managed.*

It is replaced **not by another comparison but by proof that there is only one source**:
`test_analytics_declares_no_inline_term_id` (AST-parsed, so a comment can neither satisfy nor trip
it — the Phase 0-1 lesson), plus a blindness pin that fails if the derivation stops attaching ids at
all.

#### The guards, mutation-proven — four, each on the right one

| Mutation | Guard that fired |
|---|---|
| An inline `term_id` returns to `analytics.py` | `test_analytics_declares_no_inline_term_id` |
| The derivation silently stops attaching ids | `test_analytics_still_derives_term_ids_at_all` (blindness pin) |
| An **unnecessary** carve-out is added | `test_exemptions_are_not_stale` |
| A metric emits `term_id=None` instead of omitting | `test_analytics_still_derives_term_ids_at_all` |

#### Gates — solo, uncontended

| Gate | Result |
|---|---|
| Backend, **ordered** | **1996 passed, 15 skipped** — exit 0 |
| Backend, **randomized** | `**1996 passed, 15 skipped** — exit 0` |
| `make lint` | **PASS** |
| Contract | **141 / 71 unchanged, no regen** |
| **`key_stats` byte-identity** | **PROVEN IDENTICAL** → pre-pass skipped, skip stated |

2014 → 1996 is **−18 by design**: the parametrised tripwire's 18 cases deleted, replaced by 2
structural guards. Stated so the drop is not read as coverage lost.

**Help currency:** `GLOSSARY.md` gained the **Liabilities** row (spec-first, `2c0016d`). The served
fact label moves from `"Total liabilities"` to the ratified `"Liabilities"` — **onto** the spec
rather than away from it. Milestone Help delta still owed at close (§9-I).

---

### Phase 0a — THE SPECIMEN, RATIFIED BY LOOKING *(isolated instance; expect 1–3 revision loops)*

Reset + isolated per the harness convention; **both themes**; zero console errors (excluding expected
`451`s on an unaccepted install).

**PROPOSED for the owner's look — the ratification surface of this milestone:**

1. **The recut five-string posture table** (§9-G) — "Hailo" gone, **"Ollama-compatible"** throughout,
   one locality phrasing, `POSTURE_DISABLED`'s *"fact-only answers"* re-cut now tier-1 has landed.
2. **Tier-1 answer specimens, one per category** — (a) term + the user's own figure, (b) action +
   Help steps + a deep link, (c) navigation/settings + a deep link.
3. **Any PROPOSED DS entry** for the link affordance (§4) — *ratified at 0a by looking, never
   assumed*, and on a **free axis**: colour and slant are both taken.
4. **The honest-miss render.**

**Revision loops are expected and are the point** — the ai-surfaces 0a took four. **The owner closes
this phase; it is never self-certified.**

### Phase 1 — ASSEMBLY

Tier-1 wired in the panel; the frontend **ID→route registry** (§9-D); the **link affordance** only as
ratified at 0a. **Two accepted-surface corrections ship here under the guard-REDs-an-accepted-surface
rite** (CLAUDE.md), each with **a dated delta note in the page's own plan file AND that page's
pre-pass re-run, in the same delta — flagging them in the close report is explicitly not sufficient**:

- **`Settings.tsx:110`'s sibling-param drop** → dated note in **`page-settings.md`** + Settings
  pre-pass re-run.
- **`AppRoutes.tsx:59`'s stale "four tabs" comment** → corrected in the same commit (records-truth
  bar; no plan-file note owed — a comment, not a surface).

### Phase 2 — TESTS AND GUARDS

Every §7 row that names a guard. **Each proven RED first**, on a specimen that reproduces the defect.

- The **panel-explains/page-acts** guard and the **bidirectional resolution** guard, both in the
  `check:primitives` shape — narrow scan, named owner, **blindness pin**.
- The **deep-link-never-bypasses-the-gate** test, **at the server**.
- The **limiter** test: tier-1 answers still produced with the limiter exhausted.
- The **deprecated-term corpus** extended to all served AI strings.
- **Driven across BOTH egress states and BOTH acceptance states** — a matrix, not a happy path.
- **`npm run check` exit code stated, run from `frontend/`.** **No known-red left on trunk.**

### Phase 3a — SCRIPTED PRE-PASS *(reset + isolated; green BEFORE the walk)*

Owner-independent, live app + real backend, reset instance, both themes across the breakpoints,
console errors captured. **Fix everything it surfaces first.** Any geometry fix adds its **measuring
assertion in the same batch**, seen RED on the pre-fix build. **Plus the Settings pre-pass re-run
owed by Phase 1.**

### Phase 3b — OWNER ACCEPTANCE WALK *(judgment items only)*

With 3a green, the walk is for **judgment** — copy, feel, semantics, ratifications — not for defects
3a should have caught. Each finding becomes a numbered **F-n row in the §-ledger**, fixed and
**re-verified live**. **The owner closes the phase.**

### CLOSE — under the Help Currency Law

- **§-ledger CLOSED** — enumerating **I-1, I-2, I-3** and every **F-n**. **⚠ I-1 (contention
  robustness, this milestone's by re-assignment — reproduced with the F10 blindness-pin /
  vacuous-green technique) and I-2 (fixtures, §9-H convention + the second instance) MUST carry
  dispositions. A ledger claiming CLOSED with an open intake row is a checkably false enumeration** —
  the §19-K lesson, and this plan is the rule's first user.
- **Strike-check** every §9/§walk item **against the actual diff** — a claim is not a change.
- **Help currency:** the delta that shipped (§9-I). *"No Help impact" is unavailable here.*
- **`CURRENT.md` in the close commit's diff** — a claimed update without the file in the diff **fails
  the close**.
- **`RATIFICATION.md §6`** row appended.
- **KB-SYNC** derived from `git diff --name-only`, never recalled.
- **The two-commit hash-citation pattern** where a record must cite its delta's hash: **delta, then
  records-only citation. Never amend-to-substitute — an amended citation dangles.**
- **NO PUSH** (harness classifier; the owner pushes).

---

## §9. NEEDS DECISION — **CLOSED 2026-07-20** (owner one-pass, in chat)

*All ten items plus the carried intake row resolved in one pass. **The owner's rationale lines are
recorded VERBATIM**, as his acceptance in his own words — never paraphrased. Two rows were filed
from the dead-affordance findings (below), and one dated amendment was written back onto an earlier
ruling's own record (§9-B).*

### 9-A ✅ RESOLVED — ONE ROUTER, A CLOSED TAXONOMY, AND AN HONEST MISS

**Ruled.** `classify_intent`'s **closed enum is the single intent authority**. `gather_facts`' eight
substring flags (`tools.py:561-576`) become **derivations of it — one table**, not a second opinion.
Matching becomes **word-boundary**, retiring the `"los"`/`"own"` substring hazards (§0-A). A **miss
routes to the ratified empty-fallback shape** — tier-1 **never guesses**.

> *Owner:* "Accepted. (Industry best practice: A single source of truth for intent resolution
> prevents contradictory states; deterministic matching is superior to probabilistic guessing for
> core navigation)."

**What this resolves that the brief could not have known to ask:** §0-A found the choice was never
between two hypotheticals — the product **shipped both** a closed enum and an open additive matcher,
neither authoritative. The ruling does not pick a design; it **collapses two shipped routers into
one**, which is a Phase-0 refactor with a fail-first obligation.

**What turns red:** the two routers can no longer disagree **because there is only one** — a
structural guarantee, not a test. The tests that must exist: word-boundary matching (the substring
hazards as RED specimens) and the miss path returning the empty-fallback shape.

### 9-B ✅ RESOLVED — ONE BACKEND REGISTRY TABLE, PARITY-GUARDED; the term-field widening ratified as a DATED AMENDMENT

**Ruled — the registry.** **One backend table**: `term-id` → **declared fact identity** (the F5
identity, §0-E) → **canonical endpoint**. `FIGURE_IDENTITY` (`tools.py:53-63`) **absorbs it** rather
than sitting beside it. Analytics' `term_id` (`analytics.py:186-208`) becomes the **derived reverse
index of the same table** — not a second store. **Three-store glossary parity extends to it.**

**Ruled — the term-field widening.** For the **Glossary category**: `what` + `why` **unconditional**,
`improves` + `example` **budgeted**. This is the **same intent** as the owner's Phase-0.9 ruling —
the entry's MEANING is unconditional, structural extras are budgeted — applied to a **corrected
census**, not a re-opened decision.

> *Owner:* "Accepted (with 9-B amendment). (Industry best practice: Centralizing fact identity into
> a single parity-guarded backend table prevents drift and ensures robust reverse-indexing for
> analytics)."

**⊕ THE DATED AMENDMENT IS WRITTEN ON THE PHASE-0.9 RULING'S OWN RECORD, NOT ONLY HERE.** That
ruling's canonical home is the **`docs/plans/CURRENT.md` "Needs decision" resolved block** — *"✅
RESOLVED 2026-07-20 (owner) — the grounding fact pack is WIDENED, SCOPED. (AI-surfaces Phase 0.9.)"*
— which is the **only** place it lives in full (`ai-surfaces.md:650,1107` reference it; neither
records it). The amendment is filed **there**, dated, citing this §9-B. *Why that matters and is not
bookkeeping:* the defect was that the ruling's census **never measured the Glossary category**, so a
correction filed only against the milestone that found it would leave **the next reader of the
ruling believing the wrong census** — the same failure shape as §19-K, one document over.

**What turns red:** three-store parity extended to the registry; and a guard comparing the tier
lists against the **actual Glossary schema**, so a field added to one and not the other cannot go
quiet again (§0-C had **nothing**).

### 9-C ✅ RESOLVED — TIER-1 FIGURES FLOW **ONLY** THROUGH THE FACT-PACK PROJECTION

**Ruled.** A tier-1 figure reaches the reader **only** via the fact-pack projection — **never** a
`to_display` float (`money.py:80`), **never** a raw endpoint value. **If a figure is not reachable
through the pack, the pack is extended** — the frontend is never the place the gap is closed.
Registry rows exist **only for shipped figures**: **no CAGR row** (D-086, `PRODUCT-SPEC.md:152`).

> *Owner:* "Accepted. (Industry best practice: Enforcing strict data projection pipelines—where
> figures only flow through verified fact-packs—prevents raw data leaks and UI formatting
> inconsistencies)."

**This dissolves the §0-D posture collision rather than arbitrating it.** The question was which of
two coexisting postures (raw floats vs D-105 display strings) tier-1 should adopt; the answer is
**neither directly** — the pack's own formatter (`_fmt`, `tools.py:25`) is already the one path, and
routing tier-1 through it means the raw/display split on `/portfolio/summary` **is not tier-1's
problem to solve**. It stays a live inconsistency on the contract, owned by nobody here, and is
**not** silently inherited.

**What turns red:** a tier-1 render path that reads an endpoint field directly instead of a
projected fact.

### 9-D ✅ RESOLVED — SERVED SEMANTIC LINK IDs, FRONTEND-OWNED ID→ROUTE REGISTRY, BIDIRECTIONAL GUARD

**Ruled.** The **backend serves semantic link IDs**; the **frontend owns the ID→route registry**.
A **bidirectional resolution guard**: every **served ID is registered**, and every **registered ID
resolves** against the live route/topic catalogue.

> *Owner:* "Accepted. (Industry best practice: Strict separation of concerns—backend issues semantic
> IDs, frontend maps them to routes—coupled with a bidirectional resolution guard eliminates silent
> dead-link failures)."

**Two corrections ship inside this milestone, both on accepted surfaces:**

1. **The `setParams` sibling-param drop** — `Settings.tsx:110` calls `setParams({tab: v})` with a
   fresh object and **drops any sibling param**. Fixed here, under the **guard-REDs-an-accepted-
   surface rite** (CLAUDE.md): a **dated delta note in `page-settings.md` + that page's pre-pass
   re-run, in the same delta**. Flagging it in a close report is explicitly not sufficient.
2. **The stale `AppRoutes.tsx:59` comment** — *"four URL-addressable tabs"* against an
   implementation with **seven** — corrected in the same commit, under the records-truth bar.

**Why the guard is the whole ruling.** §0-F found an unknown `?topic=` is a **silent no-op**
(`Help.tsx:302,309`) and topics validate against the **served** catalogue (`:334`) — so a registry
entry pointing at a retired id fails **invisibly**. Bidirectionality is what closes it: a
one-directional check would let a served ID name a route nobody registered.

### 9-E ✅ RESOLVED — BOTH GUARDS, IN THE `check:primitives` SHAPE (§0-M)

**Ruled.**

1. **The panel-explains/page-acts guard.** The answer body **may contain links and nothing
   interactive besides**. **A control rendered inside the panel turns red.**
2. **The 9-D bidirectional resolution guard** (above).
3. **Plus a spec sentence with a representative test:** a deep link **never bypasses the acceptance
   gate or the PIN** — **the server refuses regardless.**

> *Owner:* "Accepted. (Industry best practice: Enforcing a strict boundary between conversational UI
> (informational) and page UI (actionable) prevents unintended state changes and security bypasses)."

**Item 3 closes the §0-H gap by inverting it.** The survey asked *"what does a deep link do in
unaccepted/locked states?"* and treated it as a UI question. The ruling answers it as a **server**
question: a link is a navigation, and navigation confers no authority — the 451/PIN layers
(`deps.py:217-244`) refuse whatever the URL says. **The client is not where this is enforced**, so
the test is a representative one, not a matrix.

**Both guards take the `check:primitives` shape** (§0-M): narrow scan, named owner, **blindness
pin** — exit 1 rather than pass vacuously if the subject disappears. **And both must be proven RED
on a deliberate specimen**, since §0-M found the boundary is **currently held** and no live
violation exists to catch them.

### 9-F ✅ RESOLVED — NO FOURTH LEGEND AXIS; TIER-1 **IS** THE NO-NARRATION STATE

**Ruled.** **No fourth axis is added to the legend.** Tier-1 **is** the no-narration state — the
ratified *"Built-in intelligence only — no model was used."* is **already true of it**. Tier-1 prose
is **fixed served sentences under the §17-2 truth bar** (a fixed sentence may not cite UI that does
not render); copy adjustments are **PROPOSED strings for 0a**.

**And tier-1 never routes through the rate-limit fallback branch.** A **rate-limited tier-2 falls
back TO tier-1** — the limiter becomes a reason to reach tier-1, never a reason tier-1 is withheld.

> *Owner:* "Accepted. (Industry best practice: Deterministic, local, zero-call operations must
> mathematically bypass network-centric rate limiters to ensure UI responsiveness and architectural
> honesty)."

**What turns red:** a test that **produces tier-1 answers with the limiter exhausted**. This is the
§0-I finding converted into a guard — the two conditions sharing one `if` (`grounding.py:147`) is
exactly what that test forbids from recurring.

**On the distinguishability the survey raised:** §0-G worried a reader cannot tell *tier-1 answered*
from *tier-2 failed*. The ruling declines to solve it with a legend axis — the **answer's own
content** is the tell (tier-1 explains and points; a tier-2 fallback shows facts and the D-070
signal), and adding a fourth semantic axis would spend a scarce channel on a distinction the prose
already makes.

### 9-G ✅ RESOLVED — PRINCIPLES CONFIRMED; **THE STRINGS ARE RATIFIED AT 0a BY LOOKING** *(carries intake I-3)*

**Ruled, three principles:**

1. **The retirement governs.** **"Hailo" leaves served copy.** `POSTURE_LOCAL_NPU` (`ai.py:61`) is
   **re-worded in the three-kinds vocabulary**, with a **dated note on the pinned table**
   (ai-surfaces §12-3) — AC-L3 parity carries the change into the product, and **both versions are
   true in their time**. The **deprecated-term guard's corpus extends to all served AI strings** —
   which is what makes the retirement real rather than declared (the §14-2 lesson, recurring:
   *retiring a term without a parity guard is retiring it in one place*).
2. **One user-facing descriptor: "Ollama-compatible" everywhere**, on GLOSSARY's own
   name-the-standard rationale. **Both local providers are one user-facing kind.**
3. **One locality phrasing** — *"data stays on this device"*. **`POSTURE_DISABLED`'s "fact-only
   answers" is re-cut when tier-1 formally lands** — the §0-J finding that tier-1 makes that string
   false, accepted.

**The full recut five-string table is a PROPOSED 0a SPECIMEN. The owner ratifies the strings by
looking** — not from this file.

> *Owner:* "Accepted (principles confirmed; strings at 0a). (Industry best practice: Consistent,
> unified terminology for system posture across all surfaces is mandatory for maintaining user trust
> in privacy guarantees)."

**I-3 is hereby dispositioned: UNIFY.** The §-ledger row closes on this ruling; the *strings* remain
open until 0a, and the ledger distinguishes the two.

### 9-H ✅ RESOLVED — FIXTURES OBVIOUSLY SYNTHETIC, **NEVER BYTE-IDENTICAL TO SERVED COPY**

**Ruled.** Test fixtures are **obviously synthetic** and **never byte-identical to served copy**.
Applies to **`AskPanel.test.tsx:27`** *and* the **second instance** (`NO_EGRESS_STATUS`, `:37-39`)
that §0-K found and the intake row had not named.

> *Owner:* "Accepted. (Industry best practice: Synthetic test fixtures must be textually distinct
> from production strings to ensure test validity and reliable codebase debugging via search)."

**What turns red: NOTHING TODAY beyond the recorded convention — stated, not promised.** This is the
honest answer the "what turns red?" discipline demands, and it is written as such rather than
softened into an implied guard.

**⚠ Carries the dated premise correction** — filed on `ROADMAP.md` R-54 (A-3): *"(ii) retired real
string"* was **wrong**; the string is **live** (`POSTURE_LOCAL_NPU`, `ai.py:61`). The hazard is
**byte-identity with served copy**, not retirement.

**Note the constraint the fix must respect** (§0-K): `AskPanel.test.tsx:43-45` records that several
literals are **deliberately duplicated rather than imported, so assertions are not tautological**.
Synthetic copy is correct where the test needs *a* string; assertions that must pin *the* served
string keep pinning it. That per-literal classification is **I-2's** work.

### 9-I ✅ RESOLVED — THE HELP DELTA, NAMED UP FRONT

**Ruled.** The **`ask` entry** (`help.py:626`) is **rewritten for two tiers**, including **the
owner's zero-egress call-out** — the product value he named at the 0a walk: *a clear statement of
what the built-in intelligence can do without egress is worth having in itself.* **GLOSSARY is
spec-first** for any newly sanctioned term. **The currency suite runs at close.**

> *Owner:* "Accepted. (Industry best practice: System documentation must strictly mirror the shipped
> reality of multi-tiered capabilities and explicitly state zero-egress guarantees)."

**"No Help impact" is not available to this milestone** — the panel gains behaviour, so the delta is
owed by default (§0-L).

### 9-J ✅ RESOLVED — **CONFIRM READING**: tier-1 output does NOT pass the model-output validator

**Ruled.** Tier-1 output **does not pass through the model-output validator**. It satisfies the
contract **BY CONSTRUCTION**: registry resolution **produces facts**; the fact list **is the
showing**; every rendered figure **is a displayed fact**; tier-1 prose meets the **served-copy truth
bar**. **The validator remains the model's gate.**

> *Owner:* "Accepted (Confirm reading). (Industry best practice: Running deterministic, static
> served constants through an LLM validator is a circular anti-pattern; correctness by construction
> is the proper architectural approach)."

**The clause-6 precedent is honoured** (ai-surfaces §19-G): this was raised as a **reading of a
ratified clause**, not resolved by the surveying session, and escalated for the owner to confirm —
which is the shape that lesson prescribes.

**Why the question was real and not pedantry** (§0-J): clause 2 requires every significant figure to
trace to a fact (`safety.py:131-142`), and a tier-1 figure comes from its **canonical endpoint** —
so an unamended reading could have **rejected a tier-1 answer for being too authoritative**. The two
recorded validator limits that err safe — `_sig3("0.00") → ""` (R-56) and a timestamp's digits
reading as an unsupported figure (ai-surfaces §15-4) — are **model-gate limits and stay there**.

---

### ⛔ DEAD-AFFORDANCE FINDINGS — would-be ROADMAP rows, NOT links

Per the DEAD-AFFORDANCE RULE. **⊕ BOTH FILED 2026-07-20** at the §9 one-pass, with the owner's
ruling on each. The rule worked exactly as written: a target the survey found missing became a
ROADMAP row, never a link.

| Would-be row | Finding | Blocks |
|---|---|---|
| **R-59 — FILED ⚡ v2.0.0** (RD-9 **Amendment 10**; sequenced after R-54, before R-58) | The **add-holding form is not URL-reachable**: `useState` (`Holdings.tsx:107`), modal `:527-533`. Siblings `importOpen`/`purgeOpen`/`tagsFor`/`editTxn` (`:108-111`) share it | **The owner's tier-1 example (b) exactly** — *"how do I add a holding"* + a deep link to the add form |
| **R-60 — FILED, POST-RELEASE** (tab-level addressing ruled **sufficient** for v2.0.0) | The **theme control is not addressable**, only its tab (`Settings.tsx:232-243`; tabs `:83-84`). Also `setParams({tab:v})` (`:110`) uses a fresh object and **drops sibling params** — R-60 must fix that first | **The owner's tier-1 example (c)** — *"toggle the theme"* → the control. Tab-level pointing may satisfy *explains-and-points*: **§9-D** |

### "What turns red?" — asked of every constraint this plan states

| Constraint | What turns red |
|---|---|
| Tier 1 makes zero network calls | **Guard owed, ruled at §9-A/§9-F.** Incl. the limiter test: tier-1 answers still produced with the limiter exhausted |
| The panel never embeds a control | **Guard ruled, §9-E(a)** — `check:primitives` shape + blindness pin; **proven RED on a deliberate specimen** (the boundary is currently held, §0-M) |
| Every registered deep link resolves | **Guard ruled, §9-D/§9-E(b)** — **bidirectional**: every served ID registered, every registered ID resolves against the live catalogue |
| Posture strings stay ratified | ✅ `tests/unit/test_posture_copy_ratified.py`, incl. **coverage** |
| The legend matches the generation path | ✅ `tests/integration/test_ai_provenance.py` (9 assertions) |
| Model text carries the treatment, facts do not | ✅ both directions (`DESIGN-SYSTEM.md:1202-1203`) |
| One canonical fact per figure | ✅ `tests/integration/test_ai_fact_pack_canonical.py:2,94`, on the **served pack** |
| Terms exist in GLOSSARY with that spelling | ✅ `tests/unit/test_glossary_parity.py`, three stores, spec as parent |
| The 451 gate covers AI paths | ✅ `test_ai_acceptance_gate.py` — **only for paths listed in `AI_SURFACES`** (§0-H) |
| Help claims match live product strings | ✅ `tests/unit/test_help_content_accuracy.py` |
| Every user input uses a ratified primitive | ⚠ **Partly** — `check:primitives` covers **raw checkboxes only** (`check-ui-primitives.mjs:66`) |
| Tier-1 answers are not rate-limited | **Guard ruled, §9-F** — a test producing tier-1 answers with the limiter exhausted. A rate-limited tier-2 falls back **to** tier-1 |
| Glossary entries reach the fact pack whole | **Ruled, §9-B** — `what`+`why` unconditional, `improves`+`example` budgeted; guard compares the tier lists to the **actual Glossary schema**. Dated amendment filed on the Phase-0.9 ruling's own record (`CURRENT.md`) |

---

**Sign-off to start build:** ✅ **§9 CLOSED 2026-07-20** — no open blocker · §3b resolved (below) ·
no §4 amendment unresolved · **I-3 dispositioned (§9-G: UNIFY); I-1 and I-2 carry into Phase 0 and
must be dispositioned before any CLOSED claim.**

**⊕ BUILD AUTHORIZED — §7 and §8 are COMPLETED (above) and §3b is RESOLVED (no delta; 141/71
unchanged, with the unpinned-shape finding stated). Phase 0 begins backend-first.**

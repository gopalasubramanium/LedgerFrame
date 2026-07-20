# R-54 — Deterministic answer intelligence: the two-tier Ask panel

**Status: PLAN ONLY — written §0 through §9, STOPPED AT §9.** No build code. No phase beyond its
skeleton heading. The §9 one-pass happens **in chat** with the owner; **no item below is resolved
by this session**, and nothing in §8 starts until §9 has no open blocker.

**Naming.** `r54-deterministic-answers.md` follows the milestone convention already on disk
(`r43-historical-backfill.md`) — `page-*.md` is for pages, `r<N>-*.md` for ROADMAP-row milestones.
The Ask panel is not a page; it is a component mounted in the shell
(`frontend/src/components/AppShell.tsx:235`) and on Instrument Detail
(`frontend/src/routes/InstrumentDetail.tsx:198`).

**Source of scope:** `ROADMAP.md` R-54 (authoritative, incl. its CARRIED-INTO-R-54 block) ·
`release-readiness.md` RD-9 Amendments 7–9 · `ai-surfaces.md` §12-3 (the tier-1 seed), §13, §14,
§17 · `docs/audit/DECISIONS.md` R-22 AMENDMENT · `GLOSSARY.md` (the three kinds of intelligence).

---

## §-LEDGER — INTAKE ENUMERATED AT PLAN TIME

*Per the TEMPLATE amendment (chat ruling 2026-07-20 / `ai-surfaces.md` §19-K): **every §0 intake
item enters the §-ledger as a numbered row at plan time. This ledger may not claim CLOSED while any
row lacks a disposition.** This plan is the rule's first user.*

| # | Kind | Item | Origin | Disposition |
|---|---|---|---|---|
| **I-1** | Intake | **Contention-robustness fix** — `tests/integration/test_ai_facts_routing.py:34` (`test_performance_question_pulls_risk_metrics`) fails only under machine contention, passes solo | `r43-historical-backfill.md` §18-F7d → re-assigned post-close, `ai-surfaces.md` §19-K → `ROADMAP.md` R-54 (i) | **OPEN** |
| **I-2** | Intake | **Fixture hygiene** — `frontend/src/components/ui/AskPanel.test.tsx:27` mocks `privacy_label` with a **live served string**; make it obviously synthetic | `ROADMAP.md` R-54 (ii) — **⚠ premise corrected, see §0-K** | **OPEN** |
| **I-3** | §9 | **Posture-descriptor unification** — "OpenAI-compatible endpoint" vs "Ollama-compatible" | `ROADMAP.md` R-54 (iii); decision-shaped, so §9-G not intake | **OPEN — §9** |

*Rows F-n (walk findings) are appended below this table as the milestone runs. **The CLOSED claim
enumerates I-rows, F-rows and lettered sub-findings alike.***

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

### 3b. Contract deltas — **NOT PROPOSED IN THIS SESSION**

**Deliberately empty.** Whether tier 1 needs a new endpoint — a registry-resolution route, a
served-display-string route (§9-C), a deep-link resolution route (§9-D) — **depends on §9-B/C/D**,
which are the owner's. Proposing a shape here would be improvising the resolution the plan exists to
ask for. **§3b is filled after the §9 one-pass, before Phase 0.**

**Binding, whatever lands:** built backend-first, regenerating `API-CONTRACT.json` +
`docs/openapi.json` **in the same commit**; and **every new path is added to `AI_SURFACES`
(`tests/integration/test_ai_acceptance_gate.py:33-41`) in that same delta** (§0-H).

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

## §7. ACCEPTANCE CRITERIA — **PROPOSED, completed after §9**

Stated now only where they follow from ratified rules and do not presuppose a §9 answer.

- [ ] **Tier 1 makes zero network calls, and this is GUARDED, not asserted** — the guard is what
      makes *"by construction"* a fact rather than a claim. **What turns red: to be specified with
      §9-A's mechanism** — a test that fails if a tier-1 path can reach `egress_client`.
- [ ] **Tier 1 answers under no-egress**, live, with the panel **local not dark**.
- [ ] **Every figure tier 1 shows matches its canonical page's figure**, read from the endpoint of
      §0-D, never recomputed.
- [ ] **No figure is fabricated** — a term with no live figure explains the term and says so
      (Guarantee 3); **no CAGR row exists** (D-086).
- [ ] **Every deep link resolves to a live target**, guarded (§9-E). A missing target is a ROADMAP
      row, never a link.
- [ ] **No interactive control renders inside the panel** beyond input/submit/the incidental two —
      guarded on the `check:primitives` shape **with a blindness pin** (§0-M).
- [ ] **The legend states who wrote the sentence**, and **the tier declaration (§9-F) does not
      contradict it**.
- [ ] **All rendered strings are served**, incl. errors/empty/disabled (§0-C of ai-surfaces).
- [ ] **Both themes, both densities**; prose full-width responsive; tabular figures.
- [ ] **Posture strings hold both versions true in their time** — `test_posture_copy_ratified.py`
      green against the amended table, with dated notes (§0-J).
- [ ] **The acceptance gate is tested at any new path** — added to `AI_SURFACES` (§0-H); and **the
      unaccepted/locked deep-link behaviour is stated and asserted** (§9-E).
- [ ] **Fail-first on every new guard**, each seen RED on a specimen that reproduces the defect.
- [ ] **Help currency:** the delta below (§9-I), or a guard-corroborated "no Help impact".

## §8. BUILD PHASES — *skeleton only; NOT AUTHORED (stop at §9)*

- **Phase 0** — Contract deltas (§3b, filled after the one-pass), backend-first.
- **Phase 0a** — Specimen on an isolated instance; **ratified by the owner looking**. Any new DS
  entry ratifies here.
- **Phase 1** — Tier-1 assembly.
- **Phase 2** — Tests + guards.
- **Phase 3a** — Scripted pre-pass, green before the walk.
- **Phase 3b** — Owner acceptance walk.
- **Close** — §-ledger (**I-1/I-2/I-3 reconciled**), strike-check, Help currency, `CURRENT.md` in
  the close diff, KB-SYNC, push.

---

## §9. NEEDS DECISION — ⚑ THE ONE-PASS LIST

*Nothing below is resolved by this session. Ten items.*

| # | Item | Why it blocks | What the survey established |
|---|---|---|---|
| **9-A** | **Intent taxonomy vs open matcher — and what happens to the TWO routers already shipped** | Tier 1's whole claim is determinism. A matcher that guesses is a model by another name | **§0-A.** `classify_intent` (closed 16-enum, ordered regex, `intent.py:15-52`) and `gather_facts` (open additive substring flags, `tools.py:558-635`) **do not share code and can disagree**. The question is not which to build — it is which of two shipped things becomes tier-1's router, and what becomes of the other. Sub-question: **how a tier-1 MISS fails honestly** — the ratified empty-fallback shape, never an approximate answer |
| **9-B** | **Per-term figure resolution: the registry's shape and WHERE IT LIVES** | One source of truth for one fact (the F6 lesson) | **§0-E.** No term→endpoint registry exists. Two partial maps do: `FIGURE_IDENTITY` (`tools.py:53-63`, 9 entries, term→fact key) and `term_id` on stats metrics (`analytics.py:186-208`, 13 metrics→help entry, pointing the opposite way). 29 `term-*` Help entries are the spine. **Extend one, or build a third?** — and a third is two sources for one fact unless it subsumes them |
| **9-C** | **Where a tier-1 figure gets its DISPLAY STRING** | The frontend never computes or formats money; the DS requires served display strings | **§0-D.** Headline figures are served **raw** (`to_display` returns `float`, `money.py:80`; `portfolio.py:138-157`), while D-105 formatters exist and are used elsewhere (`money.py:25,38,47`). The AI pack already formats **for itself** (`_fmt`, `tools.py:25`) — a second formatting site, acceptable for a prompt, **a decision the moment it renders an answer** |
| **9-D** | **Deep-link registry: served or frontend-owned?** | Same one-source question, for links | **§0-F.** Settings tabs (7), Help `?topic=`, Holdings `?account=` exist. `nav/holdingsLink.ts:10-12` is the ratified one-builder precedent. Served would let the backend name link targets in answers; frontend-owned keeps route knowledge where routes live |
| **9-E** | **Two guards, and what turns red for each** | *A hard rule without a guard is a request* | (a) **Panel-explains/page-acts** — §0-M gives the shape (`check-ui-primitives.mjs`: narrow scan, named owner, **blindness pin**), and the boundary is **currently held**, so the guard must be proven RED on a deliberate specimen. (b) **Every registered link resolves** — non-trivial: an unknown `?topic=` is a **silent no-op** (`Help.tsx:302,309`) and topics validate against the **served** catalogue (`:334`), so the guard must reach it. **Also owed: what a deep link does in unaccepted (451) / locked states** — §0-H found this unestablished |
| **9-F** | **Tier declaration within the ratified legend's grammar** | The reader cannot currently tell tier-1-answered from tier-2-failed | **§0-G.** Both collapse to *"Built-in intelligence only — no model was used."* (`vocabulary.py:139`). Any new treatment needs a **free axis** — colour is taken, slant is taken (`DESIGN-SYSTEM.md:1175`). **Carries §0-I**: tier 1 shares the fallback branch with the **rate limiter** (`grounding.py:147`), which by construction cannot apply to it. **Carries §5**: if a new term is needed it is spec-first |
| **9-G** | **⚑ CARRIED (I-3): posture-descriptor unification, and the full amendment enumeration** | R-54 owns posture copy; R-57 is sequenced next **to edit settled strings** | **§0-J.** The Ask line says *"local OpenAI-compatible endpoint"* (`ai.py:59`); Settings/GLOSSARY say *"Ollama-compatible"* (`vocabulary.py:52-56`). **Both ratified, both true.** Unify or keep. **And the enumeration is wider than the brief listed:** `POSTURE_DISABLED` (`ai.py:58`) says *"fact-only answers"*, which **tier 1 makes false**; plus `AI_TAB_COPY` (`system.py:356-378`) — leaving that half-amended is a handoff defect into R-57 |
| **9-H** | **I-2's fixture convention** | The file duplicates served strings **on purpose** (`AskPanel.test.tsx:43-45`) so assertions aren't tautological | **§0-K.** Needed: the naming convention for *obviously synthetic* copy (the ROADMAP suggests `"POSTURE LINE (TEST FIXTURE)"`). Per-literal classification stays with **I-2**. **⚠ And the row's premise needs correcting on the record: the string is LIVE (`ai.py:61`), not retired** |
| **9-I** | **The Help delta this milestone owes, named up front** | Help Currency Law | **§0-L.** At minimum the `ask` entry (`help.py:626`). Any new sanctioned term is **spec-first**: `GLOSSARY.md` → both code stores, carried by `test_glossary_parity.py`. Given the panel gains behaviour, *"no Help impact"* would carry the burden of proof |
| **9-J** | **Is tier-1 output subject to the validation contract?** | Not asked by the brief; the survey forced it | Clause 2 requires every significant figure to trace to a fact (`safety.py:131-142`). A tier-1 answer's figure **comes from the canonical endpoint, not necessarily via the fact pack** — so it could be **rejected for being too authoritative**. Related known limits, both recorded and erring safe: `_sig3("0.00") → ""` (R-56) and a timestamp's digits reading as an unsupported figure (ai-surfaces §15-4). **Applying the contract unchanged, exempting tier 1, or something narrower is an owner call** |

### ⛔ DEAD-AFFORDANCE FINDINGS — would-be ROADMAP rows, NOT links

Per the DEAD-AFFORDANCE RULE. **Neither is filed by this session**; both are named so §9-D is
decided knowing what does not exist.

| Would-be row | Finding | Blocks |
|---|---|---|
| **R-59 — URL-addressable entity-creation dialogs** | The **add-holding form is not URL-reachable**: `useState` (`Holdings.tsx:107`), modal `:527-533`. Siblings `importOpen`/`purgeOpen`/`tagsFor`/`editTxn` (`:108-111`) share it | **The owner's tier-1 example (b) exactly** — *"how do I add a holding"* + a deep link to the add form |
| **R-60 — control-level deep linking within a Settings tab** | The **theme control is not addressable**, only its tab (`Settings.tsx:232-243`; tabs `:83-84`). Also `setParams({tab:v})` (`:110`) uses a fresh object and **drops sibling params** — R-60 must fix that first | **The owner's tier-1 example (c)** — *"toggle the theme"* → the control. Tab-level pointing may satisfy *explains-and-points*: **§9-D** |

### "What turns red?" — asked of every constraint this plan states

| Constraint | What turns red |
|---|---|
| Tier 1 makes zero network calls | **Nothing today.** Guard owed with §9-A |
| The panel never embeds a control | **Nothing today** — the boundary is held by habit (§0-M). Guard owed, §9-E(a) |
| Every registered deep link resolves | **Nothing today**, and an unknown `?topic=` is a **silent no-op** (§0-F). Guard owed, §9-E(b) |
| Posture strings stay ratified | ✅ `tests/unit/test_posture_copy_ratified.py`, incl. **coverage** |
| The legend matches the generation path | ✅ `tests/integration/test_ai_provenance.py` (9 assertions) |
| Model text carries the treatment, facts do not | ✅ both directions (`DESIGN-SYSTEM.md:1202-1203`) |
| One canonical fact per figure | ✅ `tests/integration/test_ai_fact_pack_canonical.py:2,94`, on the **served pack** |
| Terms exist in GLOSSARY with that spelling | ✅ `tests/unit/test_glossary_parity.py`, three stores, spec as parent |
| The 451 gate covers AI paths | ✅ `test_ai_acceptance_gate.py` — **only for paths listed in `AI_SURFACES`** (§0-H) |
| Help claims match live product strings | ✅ `tests/unit/test_help_content_accuracy.py` |
| Every user input uses a ratified primitive | ⚠ **Partly** — `check:primitives` covers **raw checkboxes only** (`check-ui-primitives.mjs:66`) |
| Tier-1 answers are not rate-limited | **Nothing today** — shares the branch (§0-I). Carried, §9-F |
| Glossary entries reach the fact pack whole | **Nothing today** — `body` only, and no guard compares the tier lists to the Glossary schema (§0-C). Raised, §9-B |

---

**Sign-off to start build:** §9 has no open blocker · §3b deltas approved · no §4 amendment
unresolved · **I-1/I-2/I-3 have dispositions.**

**STOP — §9 reached. The one-pass happens in chat.**

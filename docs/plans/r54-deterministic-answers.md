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
| **I-1** | Intake | **Contention-robustness fix** — `tests/integration/test_ai_facts_routing.py:34` (`test_performance_question_pulls_risk_metrics`) fails only under machine contention, passes solo | `r43-historical-backfill.md` §18-F7d → re-assigned post-close, `ai-surfaces.md` §19-K → `ROADMAP.md` R-54 (i) | **OPEN — ⊕ root-cause HYPOTHESIS recorded at Phase 0-1 (`88c5ce4`):** the failure is likely a **date-aware coverage / seed-state dependency, NOT machine contention** — `performance_facts` skips `None`-valued metrics (`tools.py:352-353`) and every metric the assertion can be satisfied by is `value if da_computable else None` (`analytics.py:205-210`), so an uncovered window nulls **all** of them at once. Its delta must also account for Phase 0-1 **changing this question's routing** (now `RISK_CONCENTRATION → {perf, alloc}`) against the 20-fact cap. **⊕ CORROBORATED at 0a-ii (owner ruling 2026-07-22, Recon 3): the covered→uncovered decay was OBSERVED live** on the isolated instance — direct evidence for the date-aware/seed-state hypothesis over machine contention. ✅ **RESOLVED + FIXED 2026-07-22** (`95d14a5`). **RECONCILIATION — both observations, neither merely preferred:** R-43 §18-F7d was **CORRECT** and IS the pytest mechanism — a wall-clock `asyncio.wait_for` timeout on `performance_series`/`time_weighted_return` (`analytics.py`) fires under CPU starvation, **CANCELS the coroutine mid-query, and POISONS the shared session** → `PendingRollbackError` (reproduced deterministically: a forced tiny-timeout raised exactly that error; R-43's row-3 `PendingRollbackError` is the same). The **Phase-0 seed-state hypothesis was CONFOUNDED for this surface** — the `app_client` fixture is **fully covered** (`seed_demo_history` seeds even HDFCNIFTY's mock NAV series → `da_computable=True`; `1Y volatility`/`Max drawdown` present, proven by probe), so coverage never nulls the metrics in pytest; the covered→uncovered decay (0a-ii Recon-3) is a **live-instance** phenomenon on `:8399`, a **different surface**, not the pytest cause. **FIX:** `session.rollback()` in each timeout handler (recovers the invalid transaction; the block is read-only so it discards nothing) + XIRR's ORM (`txns`) reads **moved ahead of the bounded calls** — async SQLAlchemy cannot implicitly re-load an expired attribute, and `val`/`largest` are `@dataclass` (unaffected), TWR issues a fresh query. Value-neutral (XIRR independent of coverage/perf; 40 XIRR/perf tests + `test_pack_reachability` pass). **GUARD (RED-first):** `test_key_stats_recovers_the_session_after_a_bounded_series_timeout` — deterministic rollback-spy, **RED pre-fix** (blindness pin: spy counts zero rollbacks); the real forced-cancellation recovery verified **5/5** (200 + full facts + concentration). The poison itself is not deterministically reproducible (`wait_for` converts `CancelledError`→`TimeoutError`; it lands only when interrupting a driver op; a caught statement error does not persist) — stated in the test. **⚠ ADJACENT LATENT FINDING — flagged for a ruling, NOT fixed here (normative):** on a genuine 14s perf timeout `vol = ps.get("volatility_pct") or 0.0` renders **`1Y volatility 0.00%` / `Max drawdown 0.00%`** (fabricated zeros — Guarantee-3) while TWR/ratio honestly drop; pre-existing, rare, a rendered-Portfolio-output change — owner ruling owed |
| **I-2** | Intake | **Fixture hygiene** — `frontend/src/components/ui/AskPanel.test.tsx:27` mocks `privacy_label` with a **live served string**; make it obviously synthetic | `ROADMAP.md` R-54 (ii) — **⚠ premise corrected, see §0-K** | **OPEN — ⊕ SHARPENED by Phase 1 delta 1 (`c5c13f6`, 2026-07-21):** the posture recut RETIRED the strings `AskPanel.test.tsx:27` (`Hailo/Ollama`) and `:37-39` (no-egress) mock, so those fixtures now mock **retired** copy, not merely live-byte-identical — worse than the original finding. Delta 1 left them (they are test doubles, not served copy — §9-G scope; no frontend test breaks, the mock is self-consistent). I-2's per-literal synthetic-vs-pin classification (§9-H) now MUST also drop the retired vendor word from these two fixtures. ✅ **RESOLVED + FIXED 2026-07-22** (`c124eda`). The two `privacy_label` mocks (`STATUS` :28, `NO_EGRESS_STATUS` :38-40) — INPUT mocks the panel echoes, asserted self-referentially at :88-106 — made **obviously synthetic** (`"TEST-FIXTURE … stand-in, never served."`), dropping the retired "Hailo" word. **A THIRD byte-identical served string in the same fixture object was found and handled** — `kind_label` (`"On-device model (Ollama-compatible)"`, unasserted; same grep/specimen hazard) — under §9-H's own already-grown scope (it grew once from :27 to :37-39 when §0-K found the second; this is the third, flagged in the commit, not silent). The ASSERTION PINS (`DISCLAIMER`/`PROV_BUILT_IN`/`PROV_ON_DEVICE`/`FALLBACK_SIGNAL`) **deliberately keep pinning *the* served string** (the non-tautological duplication convention, :43-45) — untouched. Served posture strings stay pinned in `test_posture_copy_ratified.py`. **What turns red:** nothing today beyond the recorded convention (§9-H stated this honestly). AskPanel.test.tsx **33/33** green |
| **I-3** | §9 | **Posture-descriptor unification** — "OpenAI-compatible endpoint" vs "Ollama-compatible" | `ROADMAP.md` R-54 (iii); decision-shaped, so §9-G not intake | ✅ **DISPOSITIONED 2026-07-20 — UNIFY** (§9-G). One user-facing descriptor, **"Ollama-compatible"**; "Hailo" leaves served copy. **The ruling is closed; the STRINGS ratify at 0a by looking** — the ledger distinguishes the two |

| **F-1** | Finding | **`Total liabilities` is not a GLOSSARY term** — GLOSSARY has **Liability** (`:67`, singular, an asset-class concept) and uses "Liabilities" only inside Net worth's definition prose (`:65`); neither sanctions it as a **figure label**, yet `networth_facts` (`tools.py:330-332`) serves it to users | Found at Phase 0-2a (`0d19a5a`) building the registry — by the first guard ever to measure the **AI's fact labels** against GLOSSARY | ✅ **RATIFIED + CLOSED 2026-07-20** (owner: *GLOSSARY catch-up*). Verifying the reading made it stronger than the finding — **D-032** and **D-054** already ratify **Liabilities** by name, `NetWorth.tsx:204` has **shipped** that label, and `:208` renders *"…− Liabilities (GLOSSARY)"*, **citing a spec entry that did not exist**. The defect was the **missing row**. `GLOSSARY.md` gained **Liabilities** spec-first (`2c0016d`), the registry's canonical label follows it, and **the carve-out is deleted — an ordinary row, zero exceptions** (`fa7b656`). Sibling `Total assets` → `Gross assets` applied at 0-2a |

| **F-2** | Finding | **Allocation weights omit three shipped asset classes** — `key_stats`' four buckets are `weight(...)` over hardcoded names (`analytics.py:94-97`); **`bond`, `other` and `retirement` are in NO bucket**, so the weights do not sum to 100% | Found at Phase 0-2b (`fa7b656`) from ruling ②'s *principle* — its stated precondition (a *dynamic* `key_stats` path) **does not exist**; the metrics are static literals | **⚑ OPEN — OWNER RULING OWED.** **Proven live on the SHIPPED DEMO DATA: 6.2 + 4.4 + 1.0 + 80.5 = 92.1, a 7.9-POINT SHORTFALL** on an accepted surface (D-048), caught by nothing. **Not fixed:** the repair changes **what the Portfolio page displays** — a product-content decision, not a refactor — and would break 0-2b's byte-identity proof for a reason unrelated to the derivation. **⊕ SCHEDULED 2026-07-20/21 (owner): its OWN delta in the Phase-1 window, no silent drop.** **Survey the ratified stats spec FIRST** — four-bucket vs per-class. **Governing principle either way:** every class in a **labelled** bucket · weights **sum to 100** · the census **derived from the `AssetClass` enum** (D-082 generalised). If the four-bucket grouping is ratified, **explicit assignments for `bond` / `other` / `retirement` come back to chat**. **Fail-first on the 92.1% sum with REAL-SHAPED data**; **page-portfolio pre-pass re-run + dated note**; any new labels **GLOSSARY-first**. ✅ **SURVEYED + RULED + FIXED 2026-07-22** (architect under delegation; options 1+3, option 2 rejected). **Premise correction:** the four buckets rendered on NO accepted surface — the ratified allocation is the per-class donut (sums to 100). **The dead grouping DELETES** (4 `key_stats` metrics + `weight()` gone; contract regen — **141/71 unchanged**, the untyped-`dict` §3b situation, stated). **The registry RE-POINTS** to per-class enum-derived rows (`_alloc_figures`, endpoint = the existing `allocation_by_class`, labels via `label_for` — no recompute, no coinage). **The deferral LIFTS** (`pack_reachable=True`, `DEFERRED_TO_F2` + its tripwire deleted; `term-allocation-weight` pulls per-class, unheld class OMITTED not "unavailable"). Fail-firsts: census enum-complete + sums-to-100 (the 92.1% set), dead-buckets absence. Rite: page-portfolio dated note + pre-pass (donut unchanged, 0 errors); movers on camera at 0a-ii. Shipped as its own commit pair |

| **F-3** | Finding | **The fact pack has its OWN money formatter, and it destroys sub-cent prices.** `_fmt` (`tools.py:25`) is `f"{value:,.2f} {ccy}"`; the D-105 formatters (`money.py:25,38,47`) are the product's. Three differences, one of them live | Found at Phase 0-4 by the ruled survey (1a), **before** any unification — which is what the survey-first ordering was for | ✅ **RULED + FIXED 2026-07-21** (`33f57bf`) — `_fmt` deleted, `money.py` owns all rendering, `format_fact_display` is the named pack variant. ✅ **RATIFIED at 0a-i 2026-07-21** (owner, by looking): `SHIBX 0.00004567 USD` (sub-cent) and `GLD unavailable` (unpriced) on camera (`2e9104e`, re-cut honest per W-3/item-2). Original finding, for the record: **⚑ (ruling 1c: STOP, change nothing).** **(i) LIVE — sub-cent destruction:** a crypto quote of `0.00004567` renders **`0.00 USD`** through `_fmt`, while `format_price_display(…, "crypto")` gives `0.00004567`. `money.py:19-20` states the D-105 intent **verbatim**: *"crypto → up to 6 significant digits (so sub-cent tokens aren't truncated to `0.00`)"* — **the pack does exactly what D-105 exists to prevent.** Compounds with **R-56**: `_sig3("0.00") → ""` is discarded, so such a fact **cannot be narrated either** — fact list shows `0.00`, model falls back. Invisible on the demo set (BTC is high-priced): a **real-shaped-data** case. **(ii) LATENT — rounding mode:** `_fmt` uses Python's default (**banker's/HALF_EVEN** — `2.005 → 2.00`), D-105 uses **HALF_UP** (`→ 2.01`). **Not reachable on headline money today**, because `portfolio.py:577` cent-quantizes each holding first — latent, not live. **(iii) LATENT — `None`:** `_fmt(None)` **raises `TypeError`**; the D-105 formatters pass `None` through (Guarantee 3, never a fabricated 0). **⚠ NOT a pure refactor either way:** D-105's crypto path also drops thousands grouping and trims trailing zeros (`68000.50 → 68000.5`), so unification **changes ratified fact-list rendering** (ratified at AI-surfaces 0a) and needs a ruling + dated note. The R-54 0a specimens will put it in front of the owner regardless |

| **F-4** | Finding | **Watchlist fact fidelity** — `watchlist_quote_facts` read `wl.items[:8]` over a relationship with **no `order_by`** (`models/__init__.py:492`), so facts followed **insertion order** and could slice away the rows the user put at the top | Found at Phase 0-4 while building the F-3 fixture; **filed by owner ruling 2026-07-21 item 4** | ✅ **FIXED 2026-07-21** (`7ba669f`). **It was the one-line ORDER BY it appeared to be** — and in the **AI path**, not the model: `watchlists.py:34` already sorts explicitly, so the **page was right and only the AI's view of it was wrong**. Fixed in `tools.py` so no shipped surface moves. *Grounding that does not mirror what the user sees is a **fidelity** defect, not a cosmetic one* |
| **F-5** | Finding | **`pct` / `ratio` / `count` are still rendered INLINE in `tools.py`** (`f"{round(float(v), 2)}%"` and siblings) — F-3's *"no rendering logic outside `money.py`"* was **scoped to `_fmt`** and these three survived it | Found at Phase 0-4, exposed by a **false positive** in the raw-float guard (it fired on `Return / volatility = 11.82`, a legitimately unitless ratio) | ✅ **RULED 2026-07-21 — the F-3 precedent applies WHOLESALE; own delta immediately after 0-5, BEFORE 0a's specimens are cut.** (a) registry gains **`value_kind`** (money/pct/ratio/count) as a **declared column** — rendering dispatches on kind, **never inferred from the value** (the F5-identity lesson applied to units); (b) `money.py` owns **per-kind named variants**, no inline formatting survives anywhere; (c) blast radius proven **the F-3 way** — byte-identity for every unaffected rendering, movers enumerated by ruled class; (d) **0a gains one fact per kind**, rounding changes ratified **by looking**, dated notes on any moved ratified rendering; (e) **the false-positive lesson rides the record** — `Return / volatility` stays a **unitless ratio**. ✅ **FIXED 2026-07-21 (`a8c89f5`).** `value_kind` is a declared registry column dispatched on (never inferred); `money.py` owns `format_pct_display` (unsigned, 2dp HALF_UP) + `format_ratio_display` + `format_fact_by_kind`; the inline `round(float(v),2)` dispatch is gone from `performance_facts` **and** from `total_return`'s WINNING render (`portfolio_facts` — the first-wins dedupe bypass, the F-3 "formatter exists but is bypassed" lesson recurring at the dedupe layer). Count declared on Positions, **no renderer** (Q2), tripwire armed. ✅ **RATIFIED at 0a-i 2026-07-21** (owner, by looking): `Income yield 0.00%` and `Top 5 concentration 94.60%` (trailing-zero movers, fixed 2dp) on camera (`2e9104e`); **the RATIO kind (`Return / volatility`) is DEFERRED to 0a-ii** — coverage-gated on a fresh instance, unit-tested meanwhile (item 3). **⊕ CLAUSE (b) DATED SCOPE ANNOTATION (Q1 ruling 2026-07-21):** *"no rendering logic outside `money.py` — **completed for value_kind-dispatched registry-figure renders** (incl. `total_return`@`portfolio_facts`); **per-item annotations = F-7.**"* An absolute claim with five known exceptions is the §19-K shape; the claim is **re-scoped, not carried as a lie**. Original finding: The architecture holds for **money** and not yet for the rest. `round(float(v), 2)` is float-based, carrying the **same banker's-rounding class as F-3(ii)**. **Filed not fixed:** it is the same ratified-rendering question F-3 was, on three more value kinds, so it wants a ruling rather than a judgement call inside a delta |
| **F-6** | Finding | **⛔ A REGRESSION THIS MILESTONE SHIPPED.** Phase 0-1's word-boundary conversion **silently killed the stems** written for the substring matcher (`perform`, `return`, `concentrat`, `diversif`): under `\b(...)\b` the trailing boundary requires the word to END there, so *"performing"*, *"concentration"* and *"diversified"* stopped routing. **6 of 9 probes misrouted** | Found at Phase 0-4 **by accident**, asking whether XIRR reached the pack — **not by any gate**, and not by the delta that introduced it | ✅ **FIXED 2026-07-21** (`7ba669f`) — stems carry `\w*`; **0/16 misrouted**; pinned by `test_intent_stem_probes.py` through **inflected** forms, with a blindness pin that caught `liabilit` unprobed on its first run. **⚑ THE LESSON, and it is new: A TEST THAT CAN REACH ITS ASSERTION BY TWO ROUTES CANNOT TELL YOU THAT ONE OF THEM BROKE** — the 1982-test suite stayed green because the one performance test's question also contains *"risk"*. Phase 0-1's guards were sound about what they measured and **none asked whether the rules still matched real questions**: the property was verified, the capability was not |
| **F-7** | Finding | **Per-item annotation rendering is still inline** — 5 sites in `tools.py` format a pct annotation inline and are NOT registry figures (no declared `value_kind`): allocation weight `.1f%` (`:118`), market/instrument quote change `+.2f%` (`:171,499`), holdings weight `.1f%` (`:425`), series change `+.1f%` (`:516`) | Filed at the F-5 delta (Q1 ruling 2026-07-21) — the residue of scoping F-5 to value_kind-dispatched registry figures; the ruled mechanism (registry `value_kind` dispatch) structurally cannot apply to a quantity with no `figure_id`. **⊕ WIDENED by W-2 (owner's 0a-i look, 2026-07-21):** the 0a-i frame showed `Largest position 80.55%` beside its annotation `(80.6%)` — the two-faces question live on ONE frame — and `Allocation (asset_class)` **leaks an internal token** into user copy | **⚑ OPEN — REQUIRED SURVEY BEFORE ANY RULING (r2 + W-2).** For each annotated quantity, compare against the **canonical page's rendering of the SAME quantity** on **BOTH axes: precision AND label vocabulary** — the real question is not *"which file owns the f-string"* but whether the same figure **wears two faces** (the F-3 species) and whether the label is the **canonical page's** term or an internal token (`asset_class`); bespoke precisions/labels may be deliberate or drift, and only the survey table can say. **Byte-identity asserted for all five sites at the F-5 delta** (`test_allocation_weight_annotation_is_unchanged` pins the one-decimal `.1f` weight form on the served pack). Not release-blocking; own delta after F-5. ✅ **SURVEYED + RULED + FIXED 2026-07-22** (owner, chat — five ruling items). **Q1** sites 1/4/5 → **2dp** via money.py (two-faces ends; site 4's `largest_position` collision dissolves — pack `Allocation — Property 80.55%` == registry `Largest position 80.55%`, proven live). **Q2** site 1 → **`Allocation — <served class label>`** via `label_for` (the `(asset_class)` token + raw enum gone; `label_for` covers every AssetClass value → no STOP-for-chat). **Q3** sites 2/3/5 → the canonical **signed-% variant (U+2212, explicit sign)**; site 3 keeps `" today"`. **Q4** sites 4/5 KEPT + **DECLARED**: `PackContext` tier (WEIGHT/CHANGE) + `format_pack_context`, **census guard** `test_no_ambient_pct_fstring_survives_in_the_pack` (no ambient annotation f-string survives — registry = named/term-resolvable tier, pack-context = declared second tier). **THE RITE**: F-5 pin updated deliberately + dated note; dated notes in `page-portfolio.md`/`page-markets.md`/`page-instrument-detail.md`; movers enumerated by class; **formal movers-on-camera owed at 0a-ii**. Shipped as its own commit pair; delta 5 proceeds next |

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

**⚠ 2026-07-21 DELTA NOTE — THIS PHASE SHIPPED A REGRESSION. See ledger row F-6 (fixed
`7ba669f`).** The word-boundary conversion recorded above as a correctness win **also silently
killed the stems** the substring matcher had carried for free — `perform`, `return`, `concentrat`,
`diversif`. Under `\b(...)\b` the trailing boundary requires the word to END there, so
*"performing"*, *"concentration"* and *"diversified"* stopped routing: **6 of 9 probe questions
misrouted**, and **the gates below were green while it was true.**

*The delta that shipped a defect should point at the record of it* — otherwise this section reads as
an unqualified success to everyone who arrives at it, which is exactly how a lesson fails to travel.
**What this phase's guards did NOT ask:** whether the rules still matched real questions. They
proved the substring hazards gone and the table authoritative — both true, both about the property
changed rather than the capability changed. **F-6 carries the standing lesson** (*a test that can
reach its assertion by two routes cannot tell you that one of them broke*) and the **capability-probe
step** now binding on every remaining phase.

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

### Phase 0-3 — THE GLOSSARY CATEGORY REACHES THE PACK (`77d063b`) — DONE

**The §0-C repair**, per the dated amendment on the Phase-0.9 ruling's own record (`CURRENT.md`).
Carries the owner-ratified **Positions** GLOSSARY catch-up in the same phase.

#### FAIL-FIRST — a census, not a specimen

```
29 glossary entries still project `body` alone:
['term-valuation-method', 'term-entitlement-stale', 'term-data-confidence',
 'term-xirr-twr', 'term-drift']…
```

The guard is **the shape of the defect**, not a hand-picked example: *no glossary entry may project
`body` alone.* A specimen would have proven one entry fixed; the census proves the category is.

#### The fix — TIERS ARE PER-CATEGORY, because the corpus has two schemas

| Category | Core (unconditional) | Extra (budgeted) |
|---|---|---|
| `Glossary` | `body` · **`what`** · **`why`** | `improves` · `example` |
| everything else (unchanged) | `body` · `interpret` | `outputs` · `inputs` |

**The split is identical in both** — core is the entry's MEANING, extra is structural detail — and
only the field **names** differ, because the two categories are written to different schemas. That
is the whole of §0-C: the Phase-0.9 ruling was right and its **census** was incomplete, having been
named from page-entry fields only. The owner **amended** it rather than re-opening it.

#### Budget adherence and the ratified size pins, RE-PROVEN with the widened tiers

| Pin | Measured after widening |
|---|---|
| Largest rendered **glossary** fact ≤ 4000 | **1,499** (`term-attribution`) |
| Largest rendered fact, **any** category ≤ 4000 | **3,254** (`page-legal`) |
| Per-question help portion ≤ 12000 | asserted on the **SERVED pack**, three term questions |
| `_HELP_FACT_BUDGET == 3600` | unchanged |

A widening is exactly the change that could breach these, so they are re-proven **here** rather than
left to the corpus test written for the old projection.

#### ⚠ A PIN THAT HAD GONE HALF-BLIND, REPOINTED

`test_ai_grounding_corpus.py` asserted `_HELP_FACT_CORE == ("body", "interpret")` and called that
**"the core grounding tier"**. After this delta there are **two** tier sets, and that assertion
would have kept passing **while saying nothing whatever about the Glossary category** — a guard
reading as complete while covering half of its subject. *That is §0-C's own failure mode, one
abstraction level up: an unnoticed category.* It now pins **both** tuples explicitly, each with the
reason its fields are unconditional.

#### ⊕ POSITIONS — the F-1 pattern, applied a second time

**Owner-ratified as a GLOSSARY catch-up. Spec-first (`32fef65`), ahead of the registry row.**

**The derivation was verified BEFORE the definition was written, as ruled — and it changed the
definition.** The obvious wording (*"how many positions you own"*) is **wrong**:

```
Positions metric      = 14
/holdings rows total  = 14
  positive value      = 13
  negative (liability)=  1
```

It is `len(value_portfolio(...).holdings)`: soft-deleted excluded (`portfolio.py:647`), **liabilities
INCLUDED**, and holdings that failed valuation included as *Unavailable* (`:663-676`). So it counts
**rows in the ledger, not assets owned** — 13 assets and one mortgage report **14**. The GLOSSARY row
states that and marks the distinction from **Gross assets**, which counts value and excludes
liabilities.

*Writing the definition from the LABEL rather than the DERIVATION is the F5 defect — identity is
DECLARED, never inferred — and here it would have shipped a spec that disagreed with the number
printed beside it.* **No exemption class for counts:** an ordinary GLOSSARY term and an ordinary
registry row.

#### ⚠ MUTATION TESTING FOUND TWO BLIND SPOTS IN THIS DELTA'S OWN GUARDS

Recorded as process, because the outcome alone would misrepresent how it was reached.

1. **Two mutations appeared not to fire** — I had run them against the wrong file. They *are*
   caught, by the tier-configuration pin. **The verification was incomplete, not the guards.**
   Reported rather than silently re-run, because "the mutation didn't fire" and "I didn't look
   where it fires" are indistinguishable in a report that only shows the second attempt.
2. **The "unconditional" test was really a PRESENCE test** — and presence is exactly what a budget
   also provides, right up until an entry grows. Rewritten with a synthetic entry… which **still
   did not fire**, because a *short* core field fits the budget whether it is core or budgeted.
   **The discriminating property is SIZE, not position.** Corrected a second time — oversized core
   fields, so only a field never charged to the budget can survive — and demoting `why` now reds it.

*Both blind spots were found by mutating and neither by reading.* The test's docstring carries the
history so the next reader knows why it is shaped so awkwardly.

#### Gates — solo, uncontended

| Gate | Result |
|---|---|
| Backend, **ordered** | **2006 passed, 15 skipped** — exit 0 |
| Backend, **randomized** | `**2006 passed, 15 skipped** — exit 0` |
| `make lint` | **PASS** |
| Contract | **141 / 71 unchanged, no regen** |

1996 → 2006; the +10 are this delta's widening guards.

**Help currency:** `GLOSSARY.md` gained **Positions** (spec-first, `32fef65`). No served string
changed by the widening — it changes what the **model is given**, not what the user is shown. The
milestone's Help delta remains owed at close (§9-I).

---

### Phase 0-4 (part 1) — F-3 FIXED: one home for rendering (`33f57bf`) — DONE

**Owner ruling 2026-07-21, seven items.** `_fmt` is **deleted**; `money.py` owns all rendering; the
pack's ratified conventions become a **named variant** sharing the D-105 core.

#### ① The live defect — FAIL-FIRST at the served pack, real-shaped data

```
'SHIBX' rendered '0.00 USD' — a sub-cent price shown as 0.00 is a
fabricated-looking number (money.py:19-20, D-105).
```

**Getting a RED that measured the real thing took three fixture attempts, and each failure is a
property of the system worth keeping:**

1. Asking about the token **directly** routes through `_one_instrument_facts` → **`refresh_quote`**
   (`tools.py:476`), a **live fetch**. The deterministic mock provider **overwrote the seeded
   `0.00004567` with `100.74`**, so the assertion was measuring a price the fixture invented.
   *A fixture that silently replaces the number under test proves nothing.*
2. A **new** watchlist is never read — `watchlist_quote_facts` takes `.first()`.
3. **`Watchlist.items` declares no `order_by`** (`models/__init__.py:492`), so it returns in **id
   order** and `tools.py:125` slices `items[:8]`; the appended row was sliced off.

The test now seeds into the first watchlist **and makes room explicitly**, with each of the three
traps written into the fixture so the next reader does not re-discover them.

**⊕ NOTED IN PASSING, not chased (out of this delta's scope):** because that slice runs over an
**unordered** relationship, **the AI's watchlist facts follow INSERTION order and ignore the user's
`sort_order` entirely.**

#### ②③ The architecture — no rendering logic outside `money.py`

`format_fact_display(value, currency)` — grouped thousands + currency suffix (the pack's **ratified**
conventions), on the D-105 **core**: `ROUND_HALF_UP`, `None` passthrough, sub-cent precision.
**16 call sites rewritten; `_fmt` genuinely deleted, not aliased** — pinned by
`test_fmt_no_longer_exists_in_the_pack`.

**The sub-cent escalation is VALUE-driven, not class-driven, and ruling ③ forces that.**
`format_price_display` keys on `asset_class == crypto` and would render **every** crypto figure at
6 significant digits — restyling `68,000.50` and breaching *"ratified rendering moves ONLY where the
defect was."* Escalating only when 2dp would print a **non-zero** value as `0.00` fixes exactly the
defect, and protects a sub-cent price of **any** class rather than only the one that exposed it. A
true zero still renders `0.00` — a legitimate zero is not sub-cent.

**(iii) closed by construction:** `None` passes through, so an unpriced fact stays honestly empty
(Guarantee 3) instead of raising `TypeError`. **(ii) unified while still latent** —
`portfolio.py:577` cent-quantizes holdings before the pack sees them, so no shipped figure was
reaching the half-cent boundary. *Fixing it now costs nothing; fixing it after a caller started
passing unquantized values would have been a silent change to a figure on screen.*

#### ⑤ BLAST RADIUS — PROVEN, NOT ASSUMED

**13 of 21 corpus values byte-identical**, across negatives, zero, grouping, and large magnitudes.
Every value that moved is in one of the **two ruled classes**, enumerated by name in a permanent
pin:

| Class | Values |
|---|---|
| **(i) sub-cent escalation** | `0.004 → 0.004` · `0.00004567 → 0.00004567` · `0.000012` · `0.0031` (all were `0.00`) |
| **(ii) half-cent HALF_UP** | `1.005 → 1.01` · `2.005 → 2.01` · `0.125 → 0.13` · `0.005 → 0.01` |

Nothing outside those two classes changed. The pin keeps `_legacy_fmt` as the comparison baseline,
so the claim stays checkable rather than historical.

#### ⚠ A CORRECTION TO THIS MILESTONE'S OWN SURVEY

The F-3 survey reported that D-105's crypto path *"drops thousands grouping and trims trailing
zeros"*. **The grouping half was WRONG** — `format(_SIG6.create_decimal(p), ",f")` keeps the
separator, so the compact style is `68,000.5`, not `68000.5`. The trailing-zero difference is real
and is the whole of what ruling ③ protects. *Recorded rather than silently corrected: the survey is
the evidence the ruling was made on, so an error in it belongs on the record.*

#### ⑥ CROSS-REF — R-56

F-3's fix removes **rendering-artifact zeros** from `_sig3`'s input: a sub-cent price no longer
arrives as `"0.00"`, so it no longer reduces to `""` and is no longer discarded from the traceable
set. **R-56 remains open for TRUE zero-valued facts** (a genuine `0.00` change, true and useful) —
its blast radius is now **smaller**, not closed.

#### ④ OWED AT 0a — carried into the §8 specimen list

**The 0a specimens MUST include a sub-cent token fact and an unpriced fact.** The owner ratifies the
corrected renderings **by looking**, and the fact-pack rendering pin carries the change with a dated
note: *"the 2026-07 ratification exhibited no sub-cent case."*

#### Gates — solo, uncontended

| Gate | Result |
|---|---|
| Backend, **ordered** | **2014 passed, 15 skipped** — exit 0 |
| Backend, **randomized** | `**2014 passed, 15 skipped** — exit 0` |
| `make lint` | **PASS** |
| Contract | **141 / 71 unchanged, no regen** |

**Suite reconciliation: 2006 → 2014, +8 = this delta's own** (2 served-pack sub-cent + 6
blast-radius / architecture pins). No other test moved.

**Help currency:** no Help or GLOSSARY entry changed. The **rendered fact values** change in the two
enumerated classes — user-visible, and therefore ratified at 0a by looking (④), not asserted here.

---

### Phase 0-4 (proper) — FIGURES THROUGH THE PROJECTION (`7ba669f`) — DONE

**§9-C, on the ruling of 2026-07-21 (five items).** Survey table first, then the wiring.

#### ⛔ F-6 — A REGRESSION THIS MILESTONE SHIPPED AT PHASE 0-1, FOUND HERE

**This is the headline, and it is a self-inflicted one.** Phase 0-1 replaced the substring matcher
with word-boundary rules. Several alternations in `_RULES` were **stems written for that substring
matcher** — `perform`, `return`, `concentrat`, `diversif` — and under `\b(...)\b` the **trailing**
boundary requires the word to END there. The stems stopped matching their own inflections:

```
"How is my portfolio performing?"  → PORTFOLIO_OVERVIEW   (not PERFORMANCE_ANALYSIS)
"What is my concentration?"        → UNKNOWN_GENERAL      (not RISK_CONCENTRATION)
"How diversified am I?"            → UNKNOWN_GENERAL      (not ALLOCATION_ANALYSIS)
```

**SIX OF NINE probe questions misrouted, and the 1982-test suite was GREEN.** The single performance
test survived because its question — *"How is my portfolio performing **and what's the risk?**"* —
also contains "risk" and reached performance facts through `RISK_CONCENTRATION` instead.

> **THE LESSON, AND IT IS NEW: A TEST THAT CAN REACH ITS ASSERTION BY TWO ROUTES CANNOT TELL YOU
> THAT ONE OF THEM BROKE.** The assertion was about *facts arriving*; it was silent on *which route
> delivered them*. Phase 0-1's own guards were sound — they proved the substring hazards gone and
> the table authoritative — and **not one of them asked whether the rules still matched real
> questions.** I verified the property I had changed and not the capability I had changed it in.

**How it was found:** not by a gate, and not by review. By asking an unrelated question — *does XIRR
reach the pack?* — and reading the intent that came back. **Recorded as found-by-accident**, because
"caught by the next phase" would imply a mechanism that does not exist.

**Fixed:** stems carry `\w*` — anchored at the START, open at the end. **0/16 misrouted.**
**Guarded:** `tests/unit/test_intent_stem_probes.py` pins every stem through an **inflected** form
(a probe using the bare stem would pass against the broken regex and prove nothing), re-asserts the
Phase 0-1 substring specimens so the two corrections cannot cancel out, and carries a **blindness
pin** that scans `_RULES` for `\w*` stems and demands a probe for each — **it immediately caught
`liabilit` unprobed**, which is the pin working on its first run.

#### ① NARROW-BY-DEMAND — the survey table, and the extensions enumerated

**16 of 22 registry rows were pack-reachable.** The six that were not, with their demand status:

| Row | Demanded via | Disposition |
|---|---|---|
| `xirr` · `twr` | **`term-xirr-twr`** — the ROADMAP's own tier-1(a) worked example | **EXTENDED** (added to `performance_facts`' `want`) |
| `alloc_*` ×4 | `term-allocation-weight` | **DEMANDED but DEFERRED to F-2** |
| `positions` | not term-linked | **stays unreachable** — served by its canonical page |

**The extension is exactly two rows.** Nothing else was added: the scope is what tier-1 can resolve
to, not everything the engine computes.

**Why the four buckets were NOT extended, stated rather than assumed.** F-2 is open on those exact
buckets — `bond`, `other` and `retirement` fall into none of them, so the weights sum to **92.1%**.
Extending grounding into a census known to be incomplete would hand the model figures that **do not
add up**; it is worse than not grounding it in them at all. They ship with F-2's delta, which owns
the census. The model is not blind meanwhile: `allocation_facts` already grounds allocation.

**Pins re-proven with the extension:** largest rendered fact and the ≤4000/≤12000 ceilings unchanged
(the two added facts are short metric lines); the 20-fact cap is unaffected — a performance pack
carries well under it.

#### ② THE CENSUS IS DECLARED, NOT AMBIENT

Every row now carries **`pack_reachable`**. Five are `False`, each deliberately. Guarded **both
ways**: a row claiming `True` must actually be producible (checked against behaviour, not against
the field), and the field cannot go vacuous.

*The registry is a MAP of where each figure canonically lives — never a promise that the AI serves
everything.* An unreachable row is served by its **canonical page**, which is a complete answer.

#### ③ THE BOUNDARY GUARD

Tier-1 may never resolve a term to a figure the pack cannot produce — otherwise the panel names a
number it cannot show, which is the **dead-affordance shape in figures rather than links**.

The F-2 deferral is an **exemption declared by name with a reason**, and it carries a companion test
that **fails once F-2 lands**, so the exemption is deleted by a red test rather than by someone
remembering. *A stale exemption is a hole with a reason attached.*

#### ④ F-4 — one line, and in the AI path

`watchlist_quote_facts` read `wl.items[:8]` over a relationship with **no `order_by`**
(`models/__init__.py:492`), so the fact list followed **insertion order** and could slice away the
rows the user had put at the top.

**`watchlists.py:34` already sorts explicitly — so the PAGE was right and only the AI's view of it
was wrong.** Grounding that does not mirror what the user sees is a **fidelity** defect, not a
cosmetic one. Fixed in `tools.py`, **not** on the relationship: the API already sorts, so a
model-level change would alter a shipped surface to fix a bug it does not have.

#### ⑤ THE FAIL-FIRSTS — and a false positive corrected

The raw-float guard's first draft rejected any bare decimal and fired on **`Return / volatility` =
`11.82`** — a **ratio**, legitimately unitless and correctly projected at 2dp. *An assertion that
reds on something correct is wrong about the product, not the other way round.* Narrowed to what
actually distinguishes an unprojected value — **precision**, since `to_display` returns the engine's
full float — plus money figures carrying their currency.

**⚑ F-5, FILED NOT FIXED — the residue that false positive exposed.** `pct`, `ratio` and `count` are
still rendered **inline in `tools.py`** (`f"{round(float(v), 2)}%"` and siblings). F-3's ruling —
*"no rendering logic outside `money.py`"* — was **scoped to `_fmt`**, and these three survived it. So
the architecture holds for **money** and not yet for the rest. `round(float(v), 2)` is float-based,
carrying the **same banker's-rounding class as F-3(ii)**. Filed for a ruling rather than folded in:
it is the same ratified-rendering question F-3 was, on three more value kinds.

#### Gates — solo, uncontended

| Gate | Result |
|---|---|
| Backend, **ordered** | **2041 passed, 15 skipped** — exit 0 |
| Backend, **randomized** | `**2041 passed, 15 skipped** — exit 0` |
| `make lint` | **PASS** |
| Contract | **141 / 71 unchanged, no regen** |

**Suite reconciliation: 2014 → 2041, +27 = this delta's own** (9 reachability/projection + 18 stem
probes). No other test moved.

**Help currency:** no Help or GLOSSARY entry changed. Grounding gains XIRR and TWR — what the model
is given, not what the user is shown. F-6's fix restores routing that was ratified behaviour before
Phase 0-1 broke it.

---

### Phase 0-5 — SERVED SEMANTIC LINK IDs (`ce58d70`) — DONE

**§9-D, on the ruling of 2026-07-21 item 4.** The backend issues `<kind>:<key>` IDs; the frontend's
ID→route registry lands in Phase 1. This is the **served half**, plus the served half of the
bidirectional resolution guard.

#### `canonical_page` IS DECLARED, NOT INFERRED — and that was checked before the column existed

The obvious move is to assign each figure a page from its name. **That is the F5 defect** (identity —
and now location — is DECLARED, never inferred), so the spec was read first:

| Source | What it declares |
|---|---|
| **D-032** + IA §5 *Net worth Owns* | `net_worth` · `gross_assets` · `liabilities` → **`/net-worth`** |
| **D-032** + IA §5 *Portfolio Owns* | `todays_change` · `unrealised_pl` · `realised_pl` · `total_return` → **`/portfolio`** |
| **IA §5 Portfolio Owns names "KeyStats" explicitly** | every stats-served metric — XIRR, TWR, 1Y return, volatility, drawdown, income, concentration, `positions` → **`/portfolio`** |
| **D-033** (allocation canonical on Portfolio) | the four `alloc_*` rows → **`/portfolio`** |

**All 22 rows are declarable with no inference.** The `KeyStats` clause is the load-bearing one:
without it, XIRR and TWR would have had no ratified home and assigning them one would have been a
guess wearing a citation.

#### THE LINK IS STAMPED AT THE `_dedupe` CHOKEPOINT, AND THAT IS THE DESIGN

`_attach_link_ids` runs inside `_dedupe`, not in the fact producers. **`_dedupe` is where a fact's
identity is finally settled** — it collapses figures by declared identity and relabels the survivor
to its GLOSSARY spelling — so it is the one place a link can be attached **from the figure a fact
IS, rather than from the label it happened to arrive with**.

Stamping per-producer would put `portfolio_facts`, `networth_facts`, `performance_facts` and
`holdings_facts` each in charge of where a figure lives: **four sites deciding one fact**, which is
the exact shape this milestone has spent its whole length removing. *The mutation that collapsed
every figure onto one page (M3) is what that failure looks like, and the probe distinguishes it.*

**`None` is a real answer.** A fact with no registry row, or a row with no canonical page, carries no
link. Tier-1 declines rather than inventing a destination — *a link that resolves to nothing is a
dead affordance with extra steps.*

#### Served end-to-end, incl. the tier-1(a) worked example

```
"what is XIRR"  → Help · XIRR & TWR   link_id=help:term-xirr-twr
                → Net worth           link_id=page:/net-worth
                → Unrealised P/L      link_id=page:/portfolio
```

#### THE BIDIRECTIONAL GUARD — served half

| Assertion | Checked against |
|---|---|
| `help:<id>` names a real entry | **`GET /api/v1/help`** — the served catalogue a deep link resolves against |
| `page:<route>` names a real route | **`AppRoutes.tsx` itself**, parsed |
| every ID is namespaced and of a known kind | `{help, page}` |
| a fact with no destination carries **no** link | the `None` path, exercised |

**A dead `page:` route reds HERE, not in Phase 1** — the dead-affordance rule applied to figures
rather than links.

#### ⊕ THE F-6 GATING CONSEQUENCE, APPLIED FOR THE FIRST TIME (ruling item 2)

**(a) CAPABILITY PROBES ship alongside the property guards.** Property guards alone are what let F-6
through: they proved the thing that changed and never asked whether the capability still worked. The
probes here drive **real questions end-to-end at the served surface** and assert **the link a user
would actually follow**.

**(b) THE REDUNDANT-ROUTE AUDIT is written into each assertion** — what ELSE could satisfy this? Four
places it changed the test that got written:

| Assertion | The redundant route it had to exclude |
|---|---|
| help ids are real | checking `app.services.help.HELP` directly is **circular** — that is the store the pack reads. Uses the **served endpoint** instead. |
| a term question links to its entry | *"some `help:` link is present"* passes on the **wrong** entry. Asserts the **exact** id. |
| a figure links to its owning page | *"some `page:` link is present"* passes if **every** figure collapsed onto one page. Asserts **two figures with DIFFERENT pages** — confirmed by mutation M3. |
| routes exist | a hardcoded path list in the test passes while the router says otherwise. **Parses `AppRoutes.tsx`.** |

*An assertion reachable two ways cannot tell you which one broke.*

#### Mutations — four, each on the right guard

| Mutation | Guard that fired |
|---|---|
| `canonical_page` → a route the app does not register | route-existence guard |
| a `help:` id absent from the served catalogue | help-catalogue guard **and** both term probes |
| every figure collapsed onto one page | the different-pages probe (**only** that one — the discriminating assertion) |
| an unknown link kind (`route:`) | well-formedness/kind guard |

#### ⊕ Item 3 — the 0-1 delta note

**Confirmed MISSING, and done immediately (`5709911`) rather than deferred to this commit.** The
Phase 0-1 record described the word-boundary conversion as a correctness win and said nothing about
the regression the same conversion shipped; it now carries a dated F-6 cross-reference and states
that **the gates listed directly beneath it were green while the defect was live**. *The delta that
shipped a defect should point at the record of it, or the lesson lives only where it was found.*

#### Gates — solo, uncontended

| Gate | Result |
|---|---|
| Backend, **ordered** | **2049 passed, 15 skipped** — exit 0 |
| Backend, **randomized** | `**2049 passed, 15 skipped** — exit 0` |
| `make lint` | **PASS** |
| Contract | **141 / 71 unchanged, no regen** |

**Suite reconciliation: 2041 → 2049, +8 = this delta's own** (link-ID guards + capability probes).
No other test moved.

**⚠ Contract note, stated because it is exactly §3b's finding in action:** `GroundingFact` gained
`link_id`, a **new field on the served `/ai/facts` response and SSE `facts` events** — and the
contract counts are **unchanged**, because those shapes are not typed (`ai_facts` returns `dict`;
`/ai/chat` is a `StreamingResponse`). This is the §3b/R-61 hazard occurring for real: *the served
shape moved and `make api-contract-check` cannot see it.* What sees it is this milestone's own
served-shape work — the guards above assert the field's presence and content directly. **Phase 0-6
pins the shape formally.**

**Help currency:** no Help or GLOSSARY entry changed. Link IDs are served metadata, not rendered
copy; how the panel renders a link is Phase 1 and ratifies at 0a.

---

### Phase 0-5a — F-5 FIXED: PER-KIND RENDERING (`a8c89f5`) — DONE

**F-5, ruled 2026-07-21, its own delta immediately after 0-5, before 0a's specimens are cut.** The
scope readings (Q1/Q2) were put to the owner in chat 2026-07-21 and are recorded on the F-5 and F-7
ledger rows and the specimen list.

**The ruling, echoed item by item:**

- **(a) `value_kind` is a DECLARED registry column.** Added to `Figure`, required (no default, so a
  new row cannot forget it), declared on all 22 rows. Rendering dispatches on the declared kind —
  **never inferred from the value** (the F5-identity lesson applied to units). Its authority is cited
  per row: stats-served rows cite `analytics.py`'s per-metric `kind` (parity-guarded); summary rows
  cite the canonical-page derivation clause (`total_return`'s pct is the summary field name).
- **(b) `money.py` owns per-kind named variants.** `format_pct_display` (unsigned, 2dp HALF_UP,
  trailing `%`), `format_ratio_display` (2dp HALF_UP, no unit), and `format_fact_by_kind` (the
  dispatcher). `performance_facts`' inline `if kind == "pct": f"{round(float(v),2)}%"` block is gone.
  **⊕ The clause-(b) claim is RE-SCOPED with a dated annotation (Q1/r1)** — "completed for
  value_kind-dispatched registry-figure renders; per-item annotations = F-7" — because an absolute
  claim with five known exceptions is the §19-K shape.
- **(c) Blast radius proven the F-3 way.** Unit corpus byte-identical (`UNAFFECTED`), movers
  enumerated by ruled class: **trailing-zero** (`0.0→0.00`, `94.60375→94.60`, `5.0→5.00`, `12.5→12.50`)
  and **half-cent HALF_UP** (`0.125→0.13`, `2.675→2.68`); ratio the same two classes. Every mover is a
  fixed-2dp normalisation, all within the ruled class.
- **(d) 0a gains one fact per kind** — **except count**, dropped with the reason recorded (Q2, below).
- **(e) `Return / volatility` stays a unitless RATIO** — no `%`, no currency, 2dp. The false-positive
  lesson rides `figure_registry.py` and `test_return_volatility_stays_a_unitless_ratio`.

**Q2 — count: declared, NO renderer (option 3 + tripwire).** Positions declares `value_kind="count"`
for parity completeness, but there is **no `format_count_display`** — a formatter with no live caller
is the code shape of a dead affordance, and no count fact is pack-reachable (`pack_reachable=False`).
Two tripwires: `format_fact_by_kind("count")` **raises** (code level), and
`test_count_has_no_renderer_and_no_reachable_row_demands_one` **reds** the moment a `pack_reachable`
count row appears without a renderer (with a blindness pin that there IS a count figure). **The 0a
count specimen is dropped, reason recorded** — *"no count fact is pack-reachable; specimen owed when
one becomes so."* Option 2 (make Positions reachable) was rejected: expanding what the panel grounds
inside a rendering delta is the exact side-effect narrow-by-demand exists to prevent.

**⊕ THE DEDUPE-LAYER DISCLOSURE (ruling disclosure 2).** `total_return` is rendered by
`portfolio_facts:89`, which **wins `_dedupe`** (first-wins; `gather_facts` prepends `portfolio_facts`
on any portfolio intent) over `performance_facts`' copy. So fixing only `performance_facts` would
have left the user-facing Total return on its inline `f"{val.total_return_pct}%"` — **the F-3
"formatter exists but is bypassed" lesson recurring at the DEDUPE layer**, recorded as such. The
winning site now renders through `format_pct_display`. Byte-identical below 1000% (total_return_pct
is a pre-quantized 2dp `Decimal`), so the move is architectural, not a live defect.

**⊕ F-7 FILED (ruling r2).** The five per-item annotation sites (allocation/holdings weights, quote
and series % changes) are NOT registry figures — no declared `value_kind`, so the ruled dispatch
mechanism cannot reach them. Filed OPEN with a **required survey before any ruling**: pack precision
vs the canonical page's rendering of the SAME quantity (does the figure *wear two faces* — the F-3
species). **Byte-identity asserted for all five this delta** (`test_allocation_weight_annotation_is_unchanged`
pins the `.1f` one-decimal weight form on the served pack — routing it through the 2dp variant would
have broken it).

**FAIL-FIRST — the served pack, real (demo) values.** `Income yield` is `0.0` on the demo seed and
was RED before the fix, rendering `0.0%`; it now renders `0.00%` — **deterministic in every suite
context**, so it is the guaranteed served RED. *⚠ A first draft pinned Top-5 concentration's exact
`94.60%`, which passed solo and FAILED at the full-suite gate — its number moves with cross-test
FX/quote state (a separate concern from this delta's rendering). Corrected to assert the fixed-2dp
SHAPE at the served level and keep the exact trailing-zero proof at the deterministic UNIT level.*
The F-6 consequence applied: capability probes drive real questions end-to-end at the served surface,
and each carries its redundant-route note (a bare "some pct has 2dp" would pass on an already-2dp
value; the guaranteed RED names the specific zero-yield figure).

**One home for rendering, guarded AST-not-substring.** `test_performance_facts_no_longer_rounds_floats_inline`
walks the AST for a real `round(float(...))` call — *a guard that reads comments finds claims, not
code* (Phase 0-1's lesson; the docstring and code comments quote the old form verbatim). Blindness
pin: `format_fact_by_kind` must still be called.

**Gates — solo, uncontended.**

| Gate | Result |
|---|---|
| Backend, **ordered** (`-p no:randomly`) | **2064 passed, 15 skipped** — exit 0 |
| Backend, **randomized** | **2064 passed, 15 skipped** — exit 0 |
| `make lint` | **PASS** |
| Contract | **141 / 71 unchanged, no regen** |

**Suite reconciliation: 2049 → 2064, +15 = this delta's own** (2 served-pack capability probes + 1
ratio-shape probe + 1 total_return probe + 1 annotation byte-identity + 5 blast-radius unit + 2 count
tripwire + 2 parity + 1 one-home guard). No other test moved.

**⚠ Contract note (§3b in action, again):** the pct/ratio facts' **rendered values changed**
(`0.0%→0.00%`, and every trailing-zero/half-cent mover) — a change to the served `/ai/facts` and SSE
`facts` shapes' CONTENT — and the contract counts are **unchanged**, because `GroundingFact.value`
is an untyped served shape (`ai_facts -> dict`). *The contract cannot see a rendering change; what
sees it is this delta's served-pack probes.* Phase 0-6 pins the shape formally.

**Help currency:** no Help or GLOSSARY entry changed — no new sanctioned term (the kinds are internal
render dispatch, not user-facing vocabulary). The **rendered fact values** move in the enumerated
classes, which is user-visible and therefore ratified at **0a by looking** (specimen list item 4),
not asserted here. The milestone's Help delta remains owed at close (§9-I).

---

### Phase 0-6 — THE SERVED-SHAPE TEST (`1df5ac5`) — DONE

**§3b / §7-E, on the chat ruling of 2026-07-21 (GO 0-6 as scoped).** The last Phase-0 deliverable:
the guard that reds when tier-1 changes what the frontend is handed. No normative question surfaced
in the survey — the shapes are mechanical to pin — so it ran survey → guard → RED-specimen → gates
without stopping.

**Why it is owed, restated from the survey.** `ai_facts` is `-> dict` (`ai.py:26`), `/ai/chat` is a
`StreamingResponse` (`ai.py:134`), and `GroundingFact` is **no route's `response_model`**, so it never
reaches the frozen contract. `make api-contract-check` therefore stays green while the served shape
moves — which it has, twice this milestone: `link_id` landed at 0-5 and F-5 moved the rendered
pct/ratio *values* at 0-5a, the counts unmoved both times. **This file is the only thing that reds on
those.** R-61 (typed AI responses + contract regen) is the durable fix and is post-release; this is
the release-relevant cover.

**What it pins** (`tests/integration/test_ai_served_shapes.py`, 8 tests):

| Pinned | How |
|---|---|
| `/ai/facts` envelope | keys == the frontend's `FactPack` (parsed from `ai.ts`); `count == len(facts)`; served `disclaimer == DISCLAIMER` |
| Every served fact's shape | carries **every field `ai.ts::GroundingFactDTO` declares** (the panel's own contract, parsed not copied) AND the **full `GroundingFact` model** incl. `link_id` — on BOTH `/ai/facts` and the SSE `facts` event |
| SSE `provenance` | keys **exactly** `{type, kind, narrated, provenance}`; `narrated` is a real `bool` (any string is truthy and would mis-style every answer) |
| SSE `facts` / `done` ordering | facts **lead** (clause 7); the legend **precedes** its deltas; `done` is **last and unique**, carrying `{grounded, provider, disclaimer}` |
| `fallback_signal` | present on `done` on the **validator-rejected branch** (driven with an ungrounded provider — a shape pinned on a branch that never emits it is a pin on nothing) |
| §3b signpost | `GroundingFact` is asserted **absent** from the contract schemas — reds if R-61 types the responses, so the overlap is retired deliberately, not left to drift |

**⊕ THE REDUNDANT-ROUTE AUDIT, and it is load-bearing here.** The shapes are read from the **served
wire** (`GET /ai/facts`, the `POST /ai/chat` SSE stream), never from `GroundingFact` in-process.
Asserting against the Python model would be **circular** — green even if a route stopped serving the
model (a `response_model` that strips undeclared keys is the classic way). The model DERIVES the
expected field set; the served bytes are what is checked. The frontend contract is likewise **parsed
from `ai.ts`**, not transcribed, so adding a consumed field there extends the pin automatically.

**FAIL-FIRST — proven RED on deliberate specimens** (the §0-M pattern: the shapes exist and hold
today, so a specimen must reproduce a break). Both reverted after observation:

| Mutation | Guard that fired |
|---|---|
| provenance event key `provenance` → `prov` | `test_the_provenance_event_shape_is_exact` |
| `/ai/facts` serialises facts with `exclude={"link_id"}` | `test_every_served_fact_carries_the_full_frontend_and_model_field_set` |

**Gates — solo, uncontended.**

| Gate | Result |
|---|---|
| Backend, **ordered** (`-p no:randomly`) | **2072 passed, 15 skipped** — exit 0 |
| Backend, **randomized** | **2072 passed, 15 skipped** — exit 0 |
| `make lint` | **PASS** |
| Contract | **141 / 71 unchanged, no regen** (no app code changed) |

**Suite reconciliation: 2064 → 2072, +8 = this delta's own** (2 blindness/parity + 1 envelope + 1
fact-shape + 3 SSE event shapes + 1 §3b signpost). No other test moved.

**⚠ The untyped-shape sentence, one more time and now with a guard behind it:** the served `/ai/facts`
and SSE `facts`/`provenance` shapes are pinned by THIS test and by **nothing in the contract**
(141/71 cannot see them). That is the §3b finding, and 0-6 is the guard it asked for.

**Help currency:** no Help or GLOSSARY entry changed — a test-only delta. The milestone's Help delta
remains owed at close (§9-I).

---

### Phase 0a — THE SPECIMEN, RATIFIED BY LOOKING

**⊕ DATED SEQUENCING CORRECTION (owner ruling 2026-07-21) — 0a SPLITS INTO 0a-i AND 0a-ii.** Recorded
here as a correction, not a silent restructure. The §8 sketch (conveyed 2026-07-20) ordered Phase 0a
**wholly before Phase 1**; the 0a specimen-prep survey (2026-07-21) found **3 of the 6 specimens are
Phase-1-dependent** — they render nothing until the panel is assembled — and item 5 is **circular**
(Phase 1 builds the link affordance *"only as ratified at 0a"*). The split resolves both:

- **Phase 0a-i — the FACT-RENDERING look, NOW** *(this state; the Phase-0 backend is complete)*:
  the F-3 and F-5 renderings + the honest miss (originally items **3, 4, 6**). Real served renders,
  reset/isolated, both themes.
- **Phase 0a-ii — the ASSEMBLY look, AFTER Phase 1**: the posture recut, tier-1 answer specimens,
  and the link-affordance DS entry (originally items **1, 2, 5**). Item 5's circularity resolves by
  the standing DS rule read correctly — **Phase 1 builds the affordance as PROPOSED, and 0a-ii is
  where *"ratified at 0a by looking"* happens for it, rendered live.**

**⚠ NO MOCKED SPECIMENS, now or ever (owner, 2026-07-21).** A specimen of an unbuilt surface asks the
owner to ratify a drawing, and Phase 1 "building to the drawing" is camera-over-green territory. The
0a-ii items wait for the real surface; they are **not** mocked into 0a-i.

Reset + isolated per the harness convention; **both themes**; zero console errors (excluding expected
`451`s on an unaccepted install). **Revision loops are expected and are the point** — the ai-surfaces
0a took four. **The owner closes each sub-phase; it is never self-certified.**

#### Phase 0a-i — PROPOSED for the owner's look *(fact-rendering; this state)*

3. **⚑ OWED BY F-3 (owner ruling 2026-07-21, item 4) — A SUB-CENT TOKEN FACT AND AN UNPRICED
   FACT.** The corrected renderings are **user-visible** and are ratified **by looking**, not by
   the blast-radius pin. The fact-pack rendering pin carries the change with a **dated note**:
   *"the 2026-07 ratification exhibited no sub-cent case."* **The 2026-07 ratification could not
   have covered this — the demo set has no sub-cent instrument**, which is precisely why the
   defect survived a walk. **F-3 ledger row: pending 0a-i.**
4. **⚑ OWED BY F-5 (ruling 2026-07-21, item 1d) — ONE FACT PER `value_kind`**: money, pct, ratio
   — **count DROPPED, reason recorded (Q2 ruling 2026-07-21):** *no count fact is pack-reachable
   (Positions is `pack_reachable=False`), so no count specimen can be cut; the specimen is owed when
   a count fact becomes reachable, and the tripwire announces that moment.* The per-kind rounding
   changes are **user-visible** and are ratified **by looking**; any ratified rendering that moves
   carries a **dated note**. **⊕ F-5 SHIPPED (`a8c89f5`), so this look has real specimens** — a
   fixed-2dp pct (`Income yield 0.00%`, and every trailing-zero/half-cent mover), a ratio
   (`Return / volatility`, no `%`). **F-5 ledger row: pending 0a-i.**
6. **The honest-miss render.** An unroutable question returns the ratified empty-fallback shape —
   the panel goes to its idle/miss state, not an approximate answer.

##### ⊕ 0a-i DRIVEN 2026-07-21 (`2e9104e`) — SPECIMENS CUT, TWO OBSTACLES FLAGGED — awaiting owner's look

Isolated instance (`:8399`, temp data dir, `mock` provider, demo seed + a seeded sub-cent token),
owner's stack (`:8321`/`:5173`) untouched; `.env` snapshot invariant held; both themes; **0 console
errors** excluding the benign prod-dist CSP theme-flash. Screenshots at `docs/plans/assets/`:

| Specimen | Files | Shows |
|---|---|---|
| **F-5 per-kind** (item 4) | `r54-0a-i-perkind-{light,dark}.png` | **money** (`Realised P/L 802.30 SGD`), **pct** — the F-5 fixes on camera: **`Income yield 0.00%`** and **`Top 5 concentration 94.60%`** (trailing-zero movers, fixed 2dp). Allocation annotations render `(80.6%)` one-decimal — **F-7 byte-identity, live** |
| **F-3 sub-cent + unpriced** (item 3) | `r54-0a-i-subcent-unpriced-{light,dark}.png` | **`SHIBX 0.00004567 USD`** (sub-cent, not `0.00`) and **`GLD unavailable`** (unpriced, `None` passthrough — the demo's own unpriced instrument) |

**⊕ W-3 / item-2 — SPECIMEN-FRAME HYGIENE, ANSWERED + FIXED BEFORE PHASE 1 (owner 2026-07-21).** The
first cut carried a seeded **`NOPRICE`** instrument that rendered `105.83 USD` — and that value was
**mock-invented, not seeded**: it was added with **no `Quote` row**, and the mock provider generates a
deterministic price for any equity symbol on the `get_cached_quote` cache-miss refresh. *The F-3
fixture-saga class exactly — a fixture that silently prices the instrument under test proves nothing.*
The watchlist specimen was **re-cut with `NOPRICE` removed** (`2e9104e`), so the committed frame reads
honestly with no backstory: real quotes (AAPL, MSFT, BTC…), the seeded sub-cent `SHIBX`, and the
demo's own unpriced `GLD`. The item-1 ratification stands regardless (`NOPRICE` was never a ratified
value). **Seeded data pinned:** exactly one instrument (`SHIBX`, priced `0.00004567`); every other
value is demo or mock-warmed.

**⚑ TWO 0a-i SPECIMENS WERE COVERAGE-GATED — both now RULED (owner 2026-07-21):**

1. **The RATIO kind** (`Return / volatility`) → **DEFERRED to 0a-ii (item 3).** It is **date-aware**:
   `None` until `all_covered` (every held holding priced in the carry window + per-date FX). On a fresh
   isolated instance the demo's **`HDFCNIFTY`** (an unmapped Indian fund, held) is uncovered, so
   `da_computable=False` and the ratio never renders; coverage needs AMFI-scheme mapping + INR FX
   backfill, R-43 machinery disproportionate to a rendering specimen. Its rendering is
   deterministically unit-tested (`format_ratio_display`) meanwhile; its LIVE look is owed at 0a-ii on
   a covered instance (added to the 0a-ii specimen list below).
2. **The honest-miss shape** → **TIER-1 MISS RULED (item 4).** `gather_facts`' last-resort
   (`if not facts: portfolio_facts + movers`, `tools.py:704-705`) is **scoped to TIER-2 GROUNDING
   ONLY**. **Tier-1's unroutable path takes the ratified honest-miss shape** (empty fallback + what CAN
   be asked). **Phase 1 implements the split; guard: a tier-1 response carrying facts for an unroutable
   question turns RED.** The ratification target is the **tier-1 miss on a funded instance, owed at
   0a-ii** — not the empty-portfolio state (the earlier "needs an empty portfolio" framing is
   superseded: the miss is a tier behaviour, not a data state).

**⊕ DATED NOTE on the F-3 fact-pack rendering pin (owed by F-3, ruling 2026-07-21 item 4):** the
2026-07 ratification exhibited **no sub-cent case** (the demo set has no sub-cent instrument); this
0a-i cut **puts one on camera** — `SHIBX 0.00004567 USD` — for the owner's look. **⊕ DATED NOTE on
F-5's moved renderings:** the pct trailing-zero movers (`Income yield 0.00%`, `Top 5 concentration
94.60%`) are user-visible and are now before the owner at 0a-i, per ruling item 1d.

**HARD STOP — the owner closes 0a-i by looking; it is never self-certified.**

#### Phase 0a-ii — owed AFTER Phase 1 assembly *(not cuttable now; NOT mocked)*

1. **The recut five-string posture table** (§9-G) — "Hailo" gone, **"Ollama-compatible"** throughout,
   one locality phrasing, `POSTURE_DISABLED`'s *"fact-only answers"* re-cut now tier-1 has landed.
   **Owed at 0a-ii, rendered live.** The PROPOSED strings are **drafted below now** (copy, not
   assembly — no reason to improvise them mid-Phase-1), so the owner can object to wording early;
   **formal ratification stays at 0a-ii.**
2. **Tier-1 answer specimens, one per category** — (a) term + the user's own figure, (b) action +
   Help steps + a deep link, (c) navigation/settings + a deep link. **Owed at 0a-ii** (needs the
   Phase-1 panel wiring + ID→route registry). **⊕ (a) puts BOTH figure states on camera** —
   **covered** (the live figure beside the explanation) and **uncovered** (the null state), per
   R2 below, so the null-state rendering is ratified by looking, not defaulted.
5. **The PROPOSED DS entry** for the link affordance (§4) — *ratified at 0a by looking, never
   assumed*, and on a **free axis**: colour and slant are both taken. **Owed at 0a-ii** (Phase 1
   builds it PROPOSED; 0a-ii ratifies it live — the resolution of the circularity above).
7. **The RATIO kind live look** (`Return / volatility`, from item 3) — **deferred from 0a-i,
   coverage-gated** (date-aware; the demo's unmapped-held `HDFCNIFTY` blocks `all_covered` on a fresh
   instance). Cut on a **covered** instance at 0a-ii; deterministically unit-tested (`format_ratio_display`)
   meanwhile.
8. **The tier-1 honest-miss on a funded instance** (item 4) — Phase 1 splits the last-resort fallback
   (tier-2 only) from the tier-1 miss (ratified empty-fallback + what CAN be asked). The ratification
   target is the **tier-1 miss on a funded account**, not an empty-portfolio state.

##### PROPOSED recut posture table (§9-G) — DRAFT for early objection; formal ratification at 0a-ii

Applying §9-G's three principles: **(1)** "Hailo" leaves served copy; **(2)** one user-facing
descriptor — **"Ollama-compatible"** — for both local kinds; **(3)** one locality phrasing —
*"data stays on this device"* — and `POSTURE_DISABLED`'s *"fact-only answers"* re-cut now tier-1
explains terms (not only figures). Current → PROPOSED, keyed as `POSTURE_COPY` (`ai.py:66-72`):

**⊕ REFINED by the owner's early direction (item 6, 2026-07-21) — accepted as direction; FORMAL
ratification at 0a-ii, rendered live.** `disabled` and `remote` recut to name their cause in GLOSSARY
vocabulary (no engineering jargon); the local pair stays identical (locality is the promise).

| Key | Current (ratified 2026-07-20) | PROPOSED recut — owner-directed (§9-G + item 6) |
|---|---|---|
| `no_egress` | "No-egress is on — this device makes no outbound calls, so answers are built from your data only, with no AI narration." | "No-egress is on — this device makes no outbound calls, so answers are built on this device from your data and the app's own explanations, with no model narration." |
| `disabled` | "Deterministic — fact-only answers; nothing is sent anywhere." | **"Model AI is off — answers use built-in intelligence: your data and the app's own explanations, on this device."** *(item 6b — names its cause; GLOSSARY "built-in intelligence"; no "deterministic" jargon)* |
| `local_openai` | "On-device (local OpenAI-compatible endpoint) — data stays on this device." | "On-device (local, Ollama-compatible) — data stays on this device." |
| `local_npu` | "On-device (local Hailo/Ollama) — portfolio facts stay on this device." | "On-device (local, Ollama-compatible) — data stays on this device." |
| `remote` | "Remote — prompts (incl. portfolio facts) are sent to the configured provider." | **"External model — prompts (incl. your portfolio facts) are sent to the configured provider."** *(item 6c — adopts the ratified kind name "External model")* |

**⊕ Owner-settled (item 6):** **(a)** the local pair (`local_openai` / `local_npu`) **stays identical**
— *"locality is the promise"* (§9-G(2), one user-facing kind); **(b)** `disabled` recut as above to
name its cause in GLOSSARY vocabulary; **(c)** `remote` adopts the ratified three-kinds name **"External
model"**. `no_egress` stays as drafted. **These are copy, ratified by looking at 0a-ii, rendered live;
Phase 1 implements them (item 7).**

##### ⊕ 0a-ii DRIVEN 2026-07-21 — FULL SPECIMEN SET CUT, both themes — **AWAITING THE OWNER'S LOOK (HARD STOP)**

**Isolation.** Two isolated instances, owner's stack (`:8321`/`:5173`) untouched, `.env` snapshot
hash-verified restored (`460a2da0…` before == after). Both instances **AI-disabled → tier-1
deterministic**; terms accepted per install. Frontend served **same-origin by each backend** (prod
`dist`), the 0a-i approach — the ONE benign prod-dist CSP theme-flash console error is filtered (it is
pre-paint, never in a settled frame; documented at 0a-i). **All 26 specimens: 0 non-benign console
errors.** Panel `.lf-ask__facts` is the ratified `max-height:30vh` scroll region, so long answers were
scrolled to bring the specimen's subject in-frame (the panel's scroll IS the real surface). Screenshots
at `docs/plans/assets/` on the `r54-0a-ii-<name>-<theme>.png` pattern.

**⚑ THE INSTANCE PLAN — OUTCOME, with reconciliations (files won over the kickoff; stated as ruled):**

- **UNCOVERED = the standard demo seed** (`:8399`). Coverage census proven live: **7/8 covered; the
  SOLE blocker is `HDFCNIFTY`** ("No AMFI scheme mapped"), exactly as the plan predicted. `RELIANCE`
  (INR) is covered (INR FX + price history seeded by `demo_history`). `all_covered=False` → the
  date-aware set (TWR/1Y/ratio/max-dd) is null.
- **COVERED = the demo minus `HDFCNIFTY`** (`:8398`) — built by **deleting the one HDFCNIFTY txn via
  the real product API** (`DELETE /portfolio/transactions/{id}`, a real user removing a position), the
  "no Indian **funds**" shape (RELIANCE, a coverable Indian **stock**, stays). Result: **`all_covered=True`,
  7/7, `da_computable=True`** — **the R-43 backfill fallback was NOT needed** (FX + held-instrument
  history already seeded). §26-bis honored: both are shapes a real user occupies; neither is mock-forced.
- **⚠ RECONCILIATION 1 — the kickoff's "uncovered XIRR" premise is imprecise; XIRR is CASH-FLOW-based,
  not coverage-gated.** XIRR renders **live on BOTH instances** (0.57% uncovered / 0.59% covered) —
  it needs dated cash flows, not window price+FX coverage. What the coverage gate governs is **TWR and
  the 1Y set (return/volatility/ratio/max-dd)**. So the tier-1(a) **uncovered** specimen is honestly a
  **mixed** answer — **XIRR live + TWR "unavailable"** — and the covered/uncovered *distinction on camera*
  is carried by **TWR** (71.62% vs "unavailable"), which is R2's point either way (a reachable figure that
  is null renders the "unavailable"-style served string, not a silent omit). Both labelled accordingly.
- **⚠ RECONCILIATION 2 — the RATIO needed a SEPARATE, NON-R-43 fallback, stated.** Even at
  `all_covered=True` the ratio was null: `performance_series` builds its 1Y axis **from the benchmark's
  candles**, and **`SPY` had 0 seeded price rows** (`demo_history` seeds *held* instruments only; nobody
  holds the benchmark) → empty series → `ret=vol=0` → ratio `None`. This is **not** the R-22/R-43 coverage
  machinery the plan pre-authorised (that addresses HDFCNIFTY's mapping, which the delete already solved).
  The fix is **benchmark warming**: seed `SPY`'s daily series with **`demo_history`'s own generator**
  (`_price_on`, `source='mock'`) — precisely what opening the **Portfolio performance chart** triggers on
  any instance, and consistent with the demo's stated design (its date-aware metrics are *meant* to
  compute on mock series). Result: **`Return / volatility = 10.51`**, stable across probes. ✅ **RULED
  LEGITIMATE at 0a-ii (owner 2026-07-22): "the product's own path, §26-bis honored"** — benchmark warming
  is what a real user viewing Portfolio performance triggers; it is a bounded, stated warming, not a
  portfolio-shape forcing.
- **⚠ RECONCILIATION 3 — the I-1 dynamic was OBSERVED.** A transient **covered→uncovered decay** at boot
  (first stats call momentarily covered, then settled uncovered on the uncovered instance) — the
  **date-aware coverage / seed-state dependency** I-1's Phase-0 hypothesis records, *not* machine
  contention. Mitigated by settling + re-probing to a stable state before every capture; final states held
  across many calls. Corroborates the I-1 hypothesis on the record (I-1 remains OPEN, owed Phase-2/close).

**⚑ ITEM 0 — the owed F-2 statement (echoed).** The `/portfolio/stats` four-bucket **field removal is a
DELIBERATE contract change**; the regen ran **same-commit** (`125cac5`). "141/71 unchanged" is the
**expected** outcome because the four metrics lived in the **untyped `/portfolio/stats -> dict` `metrics`
list, not a typed schema** — so the schema *content* moved but the **typed contract counts did not**, and
the **served-shape pins + the census guard** carried the change (the §3b situation, stated not silent).
Neither "path/schema count moved" nor a silent drop; the second branch of the owed either/or holds.

**THE SPECIMEN TABLE — file ↔ on camera ↔ ruling ratified:**

| 0a-ii item | Files (`…-{light,dark}.png`) | On camera / ruling |
|---|---|---|
| **1 — recut posture table (§9-G)** | `r54-0a-ii-posture-{disabled,no_egress,local_openai,local_npu,remote}` | The FIVE recut strings live (idle panel). **`local_openai` == `local_npu` byte-identical** — *"On-device (local, Ollama-compatible) — data stays on this device."* (**Hailo gone, local pair identical**); `disabled` *"Model AI is off — … built-in intelligence …"*; `no_egress` recut w/ the tier-1 *"app's own explanations"* clause (+ `--closed` accent); `remote` *"External model — …"*. Verified against `/ai/grounding-status` per posture. **Formal §9-G ratification cut.** |
| **2a covered** | `r54-0a-ii-tier1a-covered` | *"what is XIRR"*: explanation + **XIRR 0.59%** + **TWR 71.62%** BOTH live, each → Portfolio. R2 covered state. |
| **2a uncovered** | `r54-0a-ii-tier1a-uncovered` | **XIRR 0.57% live + TWR "unavailable"** — R2's null-state PROPOSED served string (recon. 1: the covered/uncovered face is TWR). |
| **3 — (b) action** | `r54-0a-ii-action-holdings` | *"how do I add a holding"*: Help·Holdings inline + **→ Open Holdings** (`page:/holdings`). R1 (R-59 supplies the add-form id later). |
| **4 — (c) navigation** | `r54-0a-ii-nav-theme` | *"how do I change the theme"*: Help·Settings (Appearance=theme) + **→ Open Settings** (`page:/settings?tab=appearance`). R1(ii). |
| **5 — link affordance (PROPOSED DS §5.5)** | *(in-frame on every tier-1 answer specimen)* | The trailing **ArrowUpRight** pointer in **`--accent`**, `font-style:normal` (measured at 4b), on every resolvable fact, none on unlinked facts. Ratified by looking, live. |
| **6 — the ratio kind** | `r54-0a-ii-ratio` | **`Return / volatility  10.51`** — unitless, **NO `%`** (F-5 ratio kind; 0a-i deferral discharged). Recon. 2 applies (benchmark warmed). |
| **7 — tier-1 honest miss (funded)** | `r54-0a-ii-honest-miss` | Unroutable question → the **empty tier-1 miss** (*"I don't have the data needed…"*), **NO last-resort facts** — the delta-2 split, proven on a FUNDED instance. |
| **8 — F-7 + F-2 movers** | `r54-0a-ii-movers-allocation`; `r54-0a-ii-movers-change` | Allocation: **9 per-class rows, `Allocation — <human label>`, 2dp weights, sum = 100.00, `82.20%` == Largest position** (F-2 census + F-7 Q1/Q2, two-faces dissolved). Change: AAPL **`~6-month change −25.95%`** — **U+2212** minus (F-7 Q3). |

**No code moved** — specimen assets + this record only (`git status`: 26 untracked assets, nothing tracked
modified). No suite/gate run (none warranted). **Help currency: no Help/GLOSSARY entry changed** — served
posture strings + already-served `label_for`/`unavailable` vocabulary only; guard-corroborated (the
`ask`-entry rewrite remains §9-I's own close delta). **HARD STOP — the owner closes 0a-ii by looking;
1–3 revision loops expected; Phase 2 is NOT entered.**

##### ⊕ 0a-ii WALKED 2026-07-22 — RATIFICATIONS + REVISION LOOP 1 (owner, chat)

**The owner walked the full 0a-ii set** ("accept all walk recommendations + ratify as walked").

**① RATIFIED AS WALKED (owner, by looking, 2026-07-22) — dated notes on every covered row:**
- **(a)** the **§9-G posture table is FORMAL** — all five strings as cut, subject only to item-6ii's
  one-word fix (**W-7(ii)**: the `no_egress` frame re-cut after the fix; the other four stand).
- **(b)** the **F-2 + F-7 movers** — per-class rows, human labels, 2dp, sum 100.00, `82.20%` ==
  Largest position; the U+2212 changes.
- **(c)** the **ratio kind** (`10.51`, unitless), the **covered/uncovered pair** — the mixed
  **XIRR-live / TWR-unavailable** frame **ACCEPTED as the stronger R2 specimen** (the plan's
  "uncovered XIRR" phrasing keeps its dated correction, Recon 1) — and the **sub-cent/unpriced** set
  (carried from 0a-i, now in tier-1 context).
- **(d)** the **DS §5.5 trailing-arrow affordance RATIFIED FOR VALUE ROWS** (DESIGN-SYSTEM §5.5
  updated: PROPOSED → RATIFIED for value rows).
- **② RECON RULINGS:** **(a)** benchmark warming is **LEGITIMATE** — it is the product's own path
  (opening the Portfolio performance chart warms `SPY`), §26-bis honored; recorded on the F-5/ratio
  record. **(b)** the Recon-3 coverage-decay corroboration is **noted on I-1's ledger row** (I-1
  stays OPEN, owed at close).

**③ REVISION LOOP 1 — one focused delta (W-4 · W-5 · W-6 · W-7), full standing discipline, then
RE-CUT ONLY THE AFFECTED SPECIMENS.** Shipped as `caa23da` — see the delta record below (`Phase 1 loop-1 delta`).

### Phase 1 — ASSEMBLY

Tier-1 wired in the panel; the frontend **ID→route registry** (§9-D); the **link affordance** only as
ratified at 0a. **Two accepted-surface corrections ship here under the guard-REDs-an-accepted-surface
rite** (CLAUDE.md), each with **a dated delta note in the page's own plan file AND that page's
pre-pass re-run, in the same delta — flagging them in the close report is explicitly not sufficient**:

- **`Settings.tsx:110`'s sibling-param drop** → dated note in **`page-settings.md`** + Settings
  pre-pass re-run.
- **`AppRoutes.tsx:59`'s stale "four tabs" comment** → corrected in the same commit (records-truth
  bar; no plan-file note owed — a comment, not a surface).

**Phase 1 delta sequence (owner-confirmed 2026-07-21): 1 posture amendment · 2 tier-1 miss split ·
3 frontend ID→route registry · 4 tier-1 composition + link affordance (PROPOSED DS) · 5 accepted-
surface corrections (setParams, F-2 census own delta, AppRoutes comment).**

##### ⊕ DELTA 4 COMPOSITION RULING (owner, chat 2026-07-22) — read BEFORE building delta 4

The delta-4 **survey** (this session) drove the three §9 category questions through the served pack
and found: the pack already grounds each category, but the tier-1 ANSWER does not yet **point**, and
one figure gap. Both design questions were put to the owner; the ruling, verbatim in effect:

- **R1 — action/navigation answers link to the PAGE/TAB WHERE YOU ACT** (owner selected "the page/tab
  where you act"). *"how do I add a holding"* → **`page:/holdings`** (the page; the add-form ID waits
  for R-59, the ordering the bidirectional guard enforces mechanically). *"how do I change the theme"*
  → **`page:/settings?tab=appearance`** — **tab-level**, which §9-D already ruled sufficient (R-60,
  control-level, stays post-release). The Help CONTENT is already shown inline as a fact, so the
  pointer's value is going where the action happens, not re-opening the same entry.
  **Build consequences, enumerated:** (i) a `page-<route>` help fact's pointer targets `/<route>`, not
  `help:page-<route>`; (ii) a small **question→Settings-tab** map is needed (theme/density/contrast →
  `appearance`; PIN/lock → `privacy`; provider/feed → `data-feeds`; model → `ai`; …) — product content,
  GLOSSARY/tab-label vocabulary, not free-text; (iii) **`resolveAskLink` (delta 3) must be EXTENDED to
  accept a query on a `page:` route** (`page:/settings?tab=appearance` → validate `/settings` ∈
  KNOWN_PAGE_ROUTES, preserve `?tab=appearance`) — today it rejects any route with a query. That is a
  delta-3 surface change, so it ships with its own guard extension and the frontend `askLinks.test.ts`
  round-trip widened.
- **R2 — surface the term's named figure (a), null-state is an in-delta design call as a PROPOSED
  served string, BOTH states on camera at 0a-ii** (owner note, verbatim intent): *"Null-state
  rendering: the survey found two shipped patterns (watchlist renders 'unavailable'; performance_facts
  omits None metrics). For an uncovered-XIRR term answer, choose in-delta following the closest
  ratified pattern, as a PROPOSED served string — and put BOTH states on camera at 0a-ii (covered and
  uncovered) so the choice is ratified by looking, not by default."* So: extend gather so a term
  question pulls that term's registry figures (`figures_for_term`) into the pack when live; when the
  figure is **null/uncovered** (XIRR is date-aware — the same coverage gate that deferred the ratio
  kind at 0a-i), render an **"unavailable"-style PROPOSED served string** rather than omitting it
  silently (§7-B: *"a term with no live figure explains the term and says so"* — the "says so" wants a
  visible statement, so the watchlist/GLD `unavailable` pattern is the closest, not `performance_facts`'
  silent omit). **0a-ii item 2 now cuts (a) TWICE** — covered and uncovered — added to that list above.

**Sequencing note for the builder:** R1(iii) means delta 4 re-opens `askLinks.ts`; consider a **4a
(backend composition: figure surfacing + question→tab map + page/tab link semantics) / 4b (frontend
affordance + §9-E guard + the resolver query extension)** split, mirroring the 0-2a/0-2b and
0-4-part1/proper pattern. The null-state served string is spec-first if it introduces a sanctioned term
(§0-L). Deep links inherit the gate/PIN (§9-E item 3 representative test). W-1 named-deixis binds any
Help body the composition pulls.

#### Phase 1 delta 1 — POSTURE-COPY AMENDMENT (`c5c13f6`) — DONE

**Owner item-6 direction (2026-07-21).** The 5 `POSTURE_COPY` strings recut per §9-G; **"Hailo" leaves
served copy**; the strings are **PROPOSED — formal ratification by LOOKING at 0a-ii, rendered live** —
recorded in `ai-surfaces.md` §12-3 (both versions true in their time) so the AC-L3 parity guard binds.

| Key | Recut (item 6) |
|---|---|
| `no_egress` | keeps "answers are built" + "no AI narration" (both still pinned); GAINS the tier-1 "…and the app's own explanations" clause |
| `disabled` | "Model AI is off — answers use built-in intelligence: your data and the app's own explanations, on this device." (item 6b — names its cause, GLOSSARY vocab, no "deterministic" jargon) |
| `local_openai` / `local_npu` | both "On-device (local, Ollama-compatible) — data stays on this device." (item 6a — **identical**, one user-facing kind) |
| `remote` | "External model — prompts (incl. your portfolio facts) are sent to the configured provider." (item 6c) |

**Guards.** **(a) Distinctness exception** — the local pair carved out **by name with the item-6a
reason**, all-same vacuity catch retained, and it **reds as UNNEEDED if the pair diverges** (the 0-2b
unnecessary-carve-out lesson: a hole with a reason cannot outlive the reason). **(b) Deprecated-vendor
guard EXTENDED** — `test_no_served_posture_string_carries_the_retired_vendor_word` now scans **all
served AI copy** (`POSTURE_COPY` + `KIND_LABEL`), closing the **§14-2 one-place gap** (the tab-summary
guard never covered `POSTURE_LOCAL_NPU`). **§11-I boundary:** the corpus is SERVED strings only —
provider class names (`HailoOllamaProvider`) and internal docstrings stay, the `.env` `hailo` id stays.

**FAIL-FIRST — both RED on the real cause, reverted by the recut:** the deprecated guard RED on
`POSTURE_LOCAL_NPU`'s `"Hailo"`; the distinctness exception RED as *"unneeded — the pair has diverged"*
(the pair was not yet identical).

**⊕ I-2 SHARPENED (not fixed here).** The recut retired the strings `AskPanel.test.tsx:27`/`:37-39`
mock, so those fixtures now mock **retired** copy. Left to I-2's delta (test doubles, not served copy —
§9-G scope; no frontend test breaks). Ledger row updated.

**Gates — solo, uncontended.** Backend **2073 passed / 15 skipped**, ordered AND randomized; `make
lint` PASS; contract **141/71 unchanged**. **Suite reconciliation: 2072 → 2073, +1** (the new
deprecated-vendor guard; the distinctness test was rewritten in place). No other test moved.
**Untyped-shape caveat:** the served `privacy_label` (`/ai/grounding-status`) and `summary`
(`/system/ai-config`) **content** moved — untyped dict shapes the contract cannot see. **Help currency:
no Help/GLOSSARY entry changed** (no Help entry quotes the posture strings; the `ask`-entry rewrite is
§9-I's own delta). Formal ratification of the strings is owed at **0a-ii**, rendered live.

#### Phase 1 delta 2 — THE TIER BOUNDARY + THE TIER-1 MISS SPLIT (`766717a`) — DONE

**Pre-ruled (chat 2026-07-21; 0a-i item 4).** The tier-1/tier-2 boundary did not exist in code —
**defining it was this delta's job.** `AnswerMode` (`tools.py`) is the name the survey found missing:
the product already shipped both a deterministic template path and a model-narration path (§0-B),
unreconciled and un-named. The serving path now **declares** which tier answers, and the ruled miss
split becomes construction on top of it.

**⊕ THE REQUIRED SURVEY — the ruled reorder question, answered NO-REORDER.** Delta 2 carried a
pre-authorisation: *"if the survey shows the boundary cannot be defined without the composition work
(delta 4), reordering delta 4 ahead is pre-authorized."* It cannot and was not needed. The tier is
**"will a model narrate?"**, which is decidable at the top of `answer_stream` from **`health.available`
+ the in-process limiter alone** — `DisabledAIProvider.health()` returns `available=False` directly,
and a live provider's health probe fails closed under the egress gate, so disabled / no-egress /
model-down **all collapse to one check**. Nothing from delta 4's answer *composition* feeds the mode
decision. **Delta 2 proceeded as sequenced.**

**What shipped.**

| Change | File |
|---|---|
| `AnswerMode` enum — `DETERMINISTIC` (tier 1) / `GROUNDING` (tier 2); the declared boundary | `app/ai/tools.py` |
| `gather_facts(…, *, mode=AnswerMode.GROUNDING)` — the last-resort (`if not facts: portfolio_facts + movers`) is **TIER-2 ONLY**; tier-1 returns the empty honest miss. Default `GROUNDING` → `/ai/facts` and every existing caller/test **byte-identical** | `app/ai/tools.py` |
| `_answer_mode(health)` — resolves the tier from health + limiter, folding **§0-I's two-conditions-one-`if`** into one declared mode | `app/ai/grounding.py` |
| `answer_stream` resolves mode **before** gathering (the mode drives `gather_facts`' miss behaviour), then branches: `DETERMINISTIC` → template/honest-miss; `GROUNDING` → narration | `app/ai/grounding.py` |
| 5 `gather_facts` fakes gain the `mode` kwarg the serving path now passes | `tests/unit/test_{ai_fallback,ask_answer_projection,d070_fallback_signal,disclaimer_closure,validation_contract_pinned}.py` |

**§9-F, structurally.** Merging the limiter into mode resolution makes the two §9-F promises
*separable* and true by construction: (1) a **tier-1 posture never consults the limiter** — the
`_rate_limited()` side-effect is charged only on the model-available branch, so tier 1 can never be
throttled (*"zero network calls by construction"* now also means *"never rate-limited"*); (2) a
**rate-limited tier-2 falls back TO tier 1** — an available-but-exhausted model resolves to
`DETERMINISTIC` and produces a real deterministic answer, never a bare fact list. The old
`not health.available or _rate_limited()` sharing one `if` (§0-I) is retired.

**⚠ THE MISS SPLIT IS SYMMETRIC — and the guard proves both halves.** The headline guard is the ruled
one (*"a tier-1 response carrying facts for an unroutable question turns RED"*), but a fix that emptied
the last-resort for **both** tiers would satisfy it while silently breaking tier 2. So the split is
pinned in both directions: tier-1 miss → empty (served path, `test_tier1_miss_split.py`), tier-2 miss
→ **keeps** the last-resort (seeded helper, same file), and a routable tier-1 question still carries
its facts (the not-vacuously-empty discriminator).

**FAIL-FIRST — RED on the real cause, at the served pack.** The suite's default posture
(`LEDGERFRAME_AI_ENABLED=false` → `DisabledAIProvider` → `health.available is False`) **is tier 1**, so
`POST /ai/chat` exercises the exact posture the split governs. On the pre-split build an unroutable
question (`"xyzzy plugh frobnicate"` → `UNKNOWN_GENERAL_QUESTION`, empty sources, no symbol, no Help
match) returned the last-resort `Gainer …`/`Detractor …` pack, and the body fell to the disclaimer-only
(facts-present) path instead of the refusal — **both assertions seen RED**, reverted by the split. The
mode resolver is pinned in isolation (`test_answer_mode.py`), including the limiter side-effect on both
tiers (the tier-1-silence assertion means nothing without the tier-2-records discriminator).

**⚑ ONE SCOPED DESIGN CALL, STATED.** `GET /ai/facts` — the *"answer basis"* diagnostic
(`ai.py:24-38`) — keeps the `GROUNDING` default rather than becoming posture-aware. It reports the
**maximal** grounding set (what *can* be used), which is a different concern from the tiered *answer*
the panel streams over SSE; the ruled miss is an **answer-path** behaviour (*"tier-1's unroutable
path"*), and `/ai/facts` runs no health check today. Making the basis endpoint posture-aware would
break its byte-identity and the Phase 0-6 shape pin for a gain outside the ruling's scope. A follow-up
if the owner wants it; not folded in here.

**Gates — solo, uncontended.**

| Gate | Result |
|---|---|
| Backend, **ordered** (`-p no:randomly`) | **2082 passed, 15 skipped** — exit 0 |
| Backend, **randomized** | **2082 passed, 15 skipped** — exit 0 |
| `make lint` | **PASS** |
| Contract | **141 / 71 unchanged, no regen** (no path, no schema) |

**Suite reconciliation: 2073 → 2082, +9 = this delta's own** (4 tier-1 miss-split + 5 answer-mode). No
other test moved — every existing caller runs `gather_facts` at the `GROUNDING` default, so tier-2 is
byte-identical.

**⚠ Untyped-shape caveat (§3b in action):** the SSE `facts` event's **content** now differs by tier for
an unroutable question (empty in tier 1, last-resort in tier 2) — an untyped served shape the contract
cannot see (`ai_facts -> dict`; `/ai/chat` a `StreamingResponse`). What sees it is this delta's
served-path guards; Phase 0-6's `test_ai_served_shapes.py` pins the envelope regardless of tier.

**Help currency: no Help/GLOSSARY entry changed** — the tier boundary is serving-path internals, no
user-facing vocabulary. The 0a-ii honest-miss ratification (item 8: *"the tier-1 honest-miss on a
funded instance"*) now has its split in place to render. The milestone's Help delta remains owed at
close (§9-I).

**⊕ I-1 TOUCHPOINT, noted not resolved.** This delta does not change I-1's question's routing, but it
does change what an *unroutable* tier-1 question returns. I-1 remains OPEN, owed in the Phase-2/close
window with its recorded date-aware/seed-state hypothesis intact.

#### Phase 1 delta 3 — THE FRONTEND ID→ROUTE REGISTRY (`51ede7d`) — DONE

**§9-D's other half.** Phase 0-5 shipped the **served** half (the backend issues `<kind>:<key>` link
IDs; `test_served_link_ids.py` proves each is well-formed, of a known kind, and names a real
route/Help entry). This delta ships the **frontend-owned ID→route registry** and closes the
**bidirectional resolution guard**. No app code changed — the frontend gains a pure module, the
backend gains three test-only closures.

**The registry — `frontend/src/nav/askLinks.ts`.** `resolveAskLink(linkId)` is the ONE place a served
ID becomes a destination: `help:<id>` → `/help?topic=<id>` (URL-encoded), `page:<route>` → the route,
**restricted to the BUILT NAV PAGES** (`KNOWN_PAGE_ROUTES`, derived from the one `nav.ts` model, not
hand-listed twice — the `holdingsLink.ts` single-builder principle). Anything it cannot map — unknown
kind, unbuilt/unknown route, malformed ID — returns **`null`**: tier-1 declines rather than inventing a
destination (*a link that resolves to nothing is a dead affordance with extra steps*, §0-F). It returns
a react-router `to`, never a hand-built hash. `help:` topic **validity** is deliberately not re-checked
here — it resolves against the SERVED catalogue on arrival (`Help.tsx:334`) and the backend guard binds
served `help:` IDs to real entries; a static topic list here would be a **second source of truth** for a
served fact (the §0-C mistake).

**The bidirectional closure — where each leg lives, and why.**

| Leg | Guard | Home |
|---|---|---|
| resolver **semantics** (round-trip, refuse specimens, capability probes, kind list) | `askLinks.test.ts` (7 vitest, **pure**) | frontend |
| **forward** — every served `canonical_page` ∈ the resolver's accepted set (nav pages) | `test_every_canonical_page_resolves_in_the_frontend_registry` | backend |
| **registered → live** — every nav route ∈ the routes AppRoutes registers | `test_every_frontend_nav_route_is_a_route_the_router_registers` | backend |
| **kind parity** — served `KNOWN_KINDS` == frontend `KNOWN_LINK_KINDS` | `test_the_served_kinds_and_the_frontend_resolver_kinds_are_the_SAME_set` | backend |

**Why the file-parsing legs are in Python, not vitest.** The first cut read `AppRoutes.tsx`/`nav.ts`
with `node:fs` inside the vitest file; **`tsc -b` failed** — the frontend `src` project has no node
types, and there is no precedent (no frontend test reads a source file). Rather than add `@types/node`
to a UI tsconfig (a config change for a test-parsing convenience), the file-parsing closures moved to
`test_served_link_ids.py`, which **already** parses `AppRoutes.tsx` in Python and now parses `nav.ts`
and `askLinks.ts` too. The frontend half stays pure and the backend half owns the cross-file truth —
the same served-half/registered-half division §9-D describes, mapped onto the language that reads files.

**The gap the forward closure catches — proven, not asserted.** The pre-existing route guard checked
`canonical_page ⊆ AppRoutes routes`. But the resolver only accepts **nav** pages — a strict subset
(AppRoutes also carries `/kitchen-sink`, redirects, `/instrument/:symbol`). So a `canonical_page` that
is a real route but **not a nav page** passed every prior check and still resolved to `null` in the
panel — a silent dead link. **Mutation proof:** pointing a row's `canonical_page` at `/kitchen-sink`
left the **old** AppRoutes-route guard GREEN while the **new** frontend-resolution guard went RED —
the new guard catches exactly the leg the old one missed. All three closures were mutation-proven
(`/kitchen-sink`, a `/ghost-page` nav route, an extra `ghost` frontend kind), each reverted.

**⚠ A FULL-SUITE FLAKE, DIAGNOSED NOT BLAMED.** The first `npm run check` reported `Settings.test.tsx >
routing matrix` RED — a 1 s `waitFor` timeout on a test this delta does not touch (3 files, none
`Settings.*`). A stray `npm run dev` (a leaked Playwright/dev webServer) was starving the timer under
full-suite CPU. Killed it; `Settings.test.tsx` then passed **32/32 in isolation** and the full gate
passed clean. *An order/load-dependent failure that blames an innocent file is the worst kind to debug*
(the same lesson `test_ai_fallback.py:49-59` records) — recorded so the next reader does not re-chase it.

**Gates.**

| Gate | Result |
|---|---|
| Frontend `npm run check` (from `frontend/`) | **exit 0** — vitest **415 passed** (42 files; +7 askLinks), Playwright **361 passed** |
| Backend, **ordered** (`-p no:randomly`) | **2085 passed, 15 skipped** — exit 0 |
| Backend, **randomized** | **2085 passed, 15 skipped** — exit 0 |
| `make lint` | **PASS** |
| Contract | **141 / 71 unchanged, no regen** (no path, no schema) |

**Suite reconciliation: backend 2082 → 2085, +3 = this delta's own** (forward + registered-live + kind
parity); **vitest 408 → 415, +7 = this delta's own** (askLinks semantics). No other test moved.

**Help currency: no Help/GLOSSARY entry changed** — the registry is navigation plumbing, no user-facing
vocabulary. The link **affordance** (how a resolved link renders in the panel) is delta 4, PROPOSED and
ratified at 0a-ii. The milestone's Help delta remains owed at close (§9-I).

#### Phase 1 delta 4a — BACKEND TIER-1 COMPOSITION: THE ANSWER POINTS (`0a7e05d`) — DONE

**Per the delta-4 composition ruling (owner, chat 2026-07-22), R1 + R2, backend half of the 4a/4b
split.** The survey found the pack already GROUNDS each category, but the tier-1 answer did not yet
**point** (R1) and a term answer showed the explanation without the user's own figure (R2). This
delta builds both on the served path; the frontend affordance, the resolver query extension and the
§9-E guard are **delta 4b**.

**What shipped.**

| Change | File |
|---|---|
| **R2 — `term_figure_facts`**: a term question surfaces the term's registry figures (`figures_for_term`) into the pack, **live-or-`"unavailable"`**. Scoped to the **top-ranked** help hit (search_help's #1 is what the question is about) so an action question whose top hit is a PAGE gathers no figures and a low-rank term hit injects no noise. Both tiers (surfacing a figure is grounding, honest in tier 2) | `app/ai/tools.py` |
| **ONE DERIVATION, never a second** — values read from the SAME canonical producers `gather_facts` already uses (`performance_facts` / `portfolio_facts` / `networth_facts`), the producer chosen from the figure's **declared** endpoint (`SUMMARY_ENDPOINT`/`STATS_ENDPOINT`, now public on the registry), matched back by declared identity | `figure_registry.py`, `tools.py` |
| **NULL IS SAID, NOT SWALLOWED** — a reachable figure whose value is null (XIRR/TWR are date-aware; the coverage gate that deferred the ratio kind at 0a-i) renders the **watchlist/GLD `"unavailable"` pattern** (`tools.py:180`), never `performance_facts`' silent None-omit (§7-B: "explains the term and **says so**"). The string is PROPOSED, ratified by looking at 0a-ii. Unreachable rows (the four F-2 alloc buckets) yield **no** fact — unreachable ≠ null | `tools.py` |
| **R1(i) — `_help_link_id` / `_page_help_route`**: a `page-<slug>` help fact points at **`page:/<slug>`** (Home → `/`), not `help:page-<slug>` — the help content is already shown inline, so the pointer goes where the action happens | `tools.py` |
| **R1(ii) — `_settings_tab_for`**: a Settings help fact carries **`page:/settings?tab=<tab>`** for the topic asked (theme → appearance). Ordered, word-boundary matched, ratified tab vocabulary; NOT an intent router (selects no facts) | `tools.py` |

**⊕ SURVEY CORRECTION, on the record.** The ruling's map was ILLUSTRATIVE and one entry was wrong
against the shipped UI: it said *"PIN/lock → privacy"*, but **PIN and auto-lock live on the SYSTEM
tab** (`Settings.tsx:84`; the `page-settings` body: *"System covers your PIN, auto-lock, network
access and data controls"*). Privacy holds no-egress and API tokens. Each class is mapped to the tab
that **actually holds its control** — pointing where the action happens is the ruling's own
principle, so this corrects the example against verified UI rather than deviating from it. The
theme → appearance mapping (the on-camera 0a-ii specimen) is unaffected.

**FAIL-FIRST — five RED on the real cause, reverted by the build** (dumped the served pack first):
(1) *"what is XIRR"* carried `help:term-xirr-twr` **alone**, no XIRR/TWR figure — RED
(`figures present were ['net_worth','todays_change','total_return','unrealised_pl']`); (2) the null
figure was **omitted**, not `"unavailable"` — RED (`term_figure_facts` did not exist → AttributeError,
then a missing fact); (3) the Help·Holdings fact linked to `help:page-holdings` — RED; (4) the
Help·Settings fact carried no `?tab=` — RED; (5) the served-page-link guard was vacuous until page
facts served `page:` links. Each seen RED at the served surface, then GREEN.

**Guards — capability probes + redundant-route audits, blindness-pinned, mutation-proven.** Two new
`page:`-link **declared-table closures**, both **mutation-proven RED**: `page-home`→`/home` (broken
special case) reds the Pages→route invariant guard; a bogus tab id in the map reds the tab-id-validity
guard. The R2 covered/null probes distinguish the composition path from the pre-existing
performance-pack path (redundant-route audit). **Served-shape pins (0-6) already cover the
composition**: `test_ai_served_shapes` reads *"what is XIRR"* off the wire and asserts the full
`GroundingFact` field set on every fact — so the new figure/`"unavailable"` facts and the
query-bearing `page:` links are validated with no new envelope (still a `GroundingFact` list).

**Gates — solo, uncontended.**

| Gate | Result |
|---|---|
| Backend, **ordered** (`-p no:randomly`) | **2092 passed, 15 skipped** — exit 0 |
| Backend, **randomized** | **2092 passed, 15 skipped** — exit 0 |
| `make lint` | **PASS** |
| Contract | **141 / 71 unchanged, no regen** (no path, no schema — R2 adds facts, not endpoints) |

**Suite reconciliation: 2085 → 2092, +7 = this delta's own** — 5 in `test_served_link_ids.py`
(page-fact-points-at-page, settings-topic-points-at-tab, pages-entry-maps-to-registered-route,
tab-map-emits-real-tabs, served-page-link-names-registered-route) + 2 in `test_pack_reachability.py`
(term-question-surfaces-figures, null-figure-renders-unavailable). No other test moved — the top-hit
scoping kept an action question's pack byte-identical and the perf/routing/corpus suites unchanged.

**⚠ Untyped-shape caveat (§3b in action):** the SSE/`/ai/facts` `facts` event **content** now differs
for a top-hit-term question (gains the term's figure facts, live or `"unavailable"`) and page-help
facts now carry `page:` links, some with a `?tab=` query — untyped served strings the contract cannot
see (`ai_facts -> dict`; `/ai/chat` a `StreamingResponse`). What sees them is this delta's served-path
guards plus the Phase 0-6 shape pin, which reads *"what is XIRR"* and asserts the full fact shape.

**Help currency: no Help/GLOSSARY entry changed, guard-corroborated.** No help entry text moved — the
`"unavailable"` value is the **already-served** watchlist word (`tools.py:180`), not a new sanctioned
term, and it is ratified by looking at 0a-ii; the `?tab=` targets are internal link IDs, not user
copy. The `ask`-entry rewrite (§9-I) and W-1 deixis on any touched Help body are **delta 4b / close**.
The HELP CURRENCY SUITE ran inside the gate.

**⊕ SEQUENCING — delta 4b is owed next.** The frontend half: the link **affordance** rendered as
PROPOSED DS (§4, ratified live at 0a-ii); the §9-E **panel-explains/page-acts** guard; **`resolveAskLink`
extended to accept a `?tab=` query on a `page:` route** (the R1(iii) delta-3 surface change, with its
`askLinks.test.ts` round-trip widened) so `page:/settings?tab=appearance` resolves end-to-end; the
deep-link-inherits-gate/PIN representative test; W-1 named-deixis on any Help copy the composition
pulls. **Between 4a and 4b the served query link exists but the resolver returns null — not a trunk
red (no guard asserts it) and not user-visible (the affordance is 4b).**

**⊕ I-LEDGER touchpoints, noted not resolved.** This delta changes what a **term** question returns;
it does not touch I-1's performance-question routing (its date-aware/seed-state hypothesis stands,
owed in the Phase-2/close window). I-2 (fixture hygiene) and F-2 (allocation census) and F-7
(per-item annotation survey) remain OPEN with their scheduled deltas.

#### Phase 1 delta 4b — FRONTEND: THE LINK AFFORDANCE + THE §9-E BOUNDARY (`34f6245`) — DONE

**The frontend half of the composition ruling — the panel now POINTS on screen.** Delta 4a served the
link IDs and the composed pack; this renders the affordance, extends the resolver for the tab query,
and guards the boundary. **Camera-over-green: the affordance was rendered live and measured, not
trusted green.**

**What shipped.**

| Change | File |
|---|---|
| **R1(iii) — `resolveAskLink` accepts a `?tab=` query** on a `page:` route: validate the PATH against the accepted nav set, PRESERVE the query verbatim (was: reject any route with a `?`). `askLinkLabel` names a link's destination from the ONE nav model (D-043) | `frontend/src/nav/askLinks.ts` |
| **The affordance — `FactPointer`**: a fact whose served `link_id` resolves renders a trailing **ArrowUpRight** pointer that NAVIGATES and closes the ephemeral panel; a fact with no resolvable link renders **none** (never an arrow to nowhere). `aria-label` names the destination | `frontend/src/components/ui/AskPanel.tsx` |
| **`GroundingFactDTO` gains `link_id`** — the DELIBERATE frontend-contract update the §3b served-shape guard exists to force (a new served field is adopted on purpose, not by drift) | `frontend/src/api/ai.ts` |
| **PROPOSED DS entry (§5.5) + `.lf-ask__pointer`** — SPEAKS SummaryLink's ratified language (ArrowUpRight · `--accent` · surface-pill hover · focus ring · aria-label names destination), NOT a second affordance form | `DESIGN-SYSTEM.md`, `ask.css` |
| **§9-E boundary guard — `check:ask-boundary`** (wired into `npm run check`): the panel may render only the ratified §4 primitives + links; a control component or raw interactive HTML in the panel reds. Named owner, comment-stripped, **blindness-pinned** | `frontend/scripts/check-ask-boundary.mjs`, `package.json` |
| **Deep-link gate representative test** (§9-E item 3): a tier-1 link's destination page reads a **gated** endpoint — `GET /portfolio/holdings` is 451 on an unaccepted install. Navigation confers no authority; the server refuses | `tests/integration/test_served_link_ids.py` |

**⊕ THE FREE AXIS, and why it is `--accent` not a new colour.** Like the model-text italic amendment,
the affordance needs *a free axis, not a prettier one* (§0-G). Gain/loss/staleness/warning own
**colour**; model authorship owns **italic**. The navigation accent (`--accent`, D-098's "this links
elsewhere" tone — the same `.idp__link` / SummaryLink use) is the free axis: it says *"this goes
somewhere"* without valuing the number or claiming authorship. **This reuses the ratified SummaryLink
LANGUAGE** rather than inventing a second linked-affordance form — the centralization rule.

**FAIL-FIRST.** The `askLinks` round-trip was RED before the query extension (a `?tab=` route resolved
to `null`); the `check:ask-boundary` guard was **proven RED on TWO deliberate specimens** — a raw
`<select>` in the panel AND a non-allow-listed `./` control import — and its **blindness pin fires**
(removing the Dialog import makes it exit 1 rather than pass). The AskPanel affordance tests assert the
pointer renders + names its destination, renders NONE for an unlinked fact, and closes the panel on
navigate.

**⊕ CAMERA-OVER-GREEN (owner instruction).** Driven on an **isolated** stack (Vite dev :5199 → backend
:8399, temp data, demo seed, AI disabled → tier-1; owner's `:8321`/`:5173` untouched, `.env` snapshot
hash-verified restored). The panel opened on *"what is XIRR"* rendered the delta-4a composition (the
explanation + the XIRR/TWR figures) with a pointer on every linked fact. **Measured, not eyeballed**
(`getComputedStyle`, settle before probe): the pointer colour is **exactly `--accent`** — `#24476f`
(light) / `#6f9fd4` (dark) — and **`font-style: normal`** (NOT the model-text italic), in **both
themes**, distinct from the fact-value tone. **0 non-benign console errors.** Screenshots looked at.
The DS entry's claims are thus measured; its **FORMAL ratification stays at 0a-ii** (item 5 — both
themes, owner's look), where this delta's live surface is exactly what gets cut.

**W-1 deixis: N/A this delta — no Help body copy was touched.** The affordance adds navigation chrome
(`Open <page>`) from the nav model, not served answer copy; the `ask`-entry rewrite (§9-I) and its W-1
named-deixis are the close's delta.

**Gates.**

| Gate | Result |
|---|---|
| Frontend `npm run check` (from `frontend/`) | **exit 0** — vitest **424 passed** (42 files; +9), Playwright **361 passed**, all check scripts incl. **`check:ask-boundary`** |
| Backend, **ordered** (`-p no:randomly`) | **2093 passed, 15 skipped** — exit 0 |
| Backend, **randomized** | **2093 passed, 15 skipped** — exit 0 |
| `make lint` | **PASS** |
| Contract | **141 / 71 unchanged** (no path, no schema) |

**Suite reconciliation: vitest 415 → 424, +9 this delta's own** (6 askLinks query/label + 3 AskPanel
affordance); **backend 2092 → 2093, +1** (the deep-link gate representative test); Playwright 361
unchanged (the camera used a throwaway driver, deleted — not a committed spec, matching the italic
legend's pre-pass-measurement precedent). No other test moved.

**⚠ Untyped-shape caveat (§3b):** `GroundingFactDTO` now declares `link_id` — the served field the
Phase 0-6 shape pin already asserts on every served fact; the frontend contract is updated
deliberately, which is exactly the §3b flow (a new served field is adopted on purpose, R-61 the
durable fix).

**Help currency: no Help/GLOSSARY entry changed, guard-corroborated.** The affordance is navigation
chrome; no served answer copy or vocabulary moved. The currency suite ran inside `npm run check`.

**⊕ I-LEDGER.** I-1 / I-2 / F-2 / F-7 remain OPEN, carried visibly. Delta 4 (a+b) is complete; the
Phase-1 delta sequence continues with **delta 5** (accepted-surface corrections: `setParams`
sibling-param fix under the Settings rite, the F-2 census own delta, the `AppRoutes.tsx:59` comment).
The **F-7 survey** stays STOP-for-chat; **0a-ii PREP** is the HARD STOP.

#### Phase 1 F-7 delta — THE PACK-CONTEXT ANNOTATION TIER, DECLARED (`46a9d05`) — DONE

**Per the F-7 ruling (owner, chat 2026-07-22, five items).** The survey found five inline pct
annotations in `tools.py` — not registry figures — drifting from their canonical pages on **precision**
(1dp vs 2dp, the two-faces W-2 caught live) and **vocabulary** (`Allocation (asset_class) — equity`).
This delta conforms them and DECLARES a second tier. **Its own commit pair (ruling item 6).**

**What shipped.**

| Change | File |
|---|---|
| **`PackContext` tier + `format_pack_context`** — the DECLARED second tier: WEIGHT → `format_pct_display` (2dp unsigned), CHANGE → `format_signed_pct_display` (2dp, **U+2212**, explicit sign). money.py owns the rendering, this owns only the kind→variant dispatch (as the registry owns `value_kind`) | `app/ai/tools.py` |
| **Q1 — sites 1/4/5 → 2dp**: allocation weight, holdings weight, ~6-month change all render through the WEIGHT/CHANGE variants. The two-faces ends — pack `Allocation — Property 80.55%` == registry `Largest position 80.55%` (proven live) | `app/ai/tools.py` |
| **Q2 — site 1 label** → `Allocation — {label_for("asset_class", k)}` (asset_class) / `Allocation — {code}` (currency), via `_alloc_bucket_label`. `label_for` is the **same served /refdata truth** the donut's `labelFor` reads; it covers every `AssetClass` value → **no missing label, no STOP-for-chat** | `app/ai/tools.py` |
| **Q3 — sites 2/3/5** → the canonical signed-% variant (U+2212, explicit sign); **site 3 keeps `" today"`** (period context is honesty in a context-free line) | `app/ai/tools.py` |
| **Q4 — the CENSUS GUARD** `test_no_ambient_pct_fstring_survives_in_the_pack` (AST): no f-string in `tools.py` formats a float and appends `%`. Registry figures were the F-5 census; this is the second-tier census — no ambient annotation f-string survives in either | `test_fact_pack_kinds.py` |

**Corollary on the record (ruling Q4):** the figure registry is the **named / term-resolvable tier**
(a `figure_id`, a canonical page, often a Help term); pack-context annotations are the **declared
second tier** — kept for grounding, but enumerated and census-guarded, never ambient.

**FAIL-FIRST — four RED on the real cause:** the census guard reds naming the exact five sites
(`[155, 208, 588, 662, 679]`); the two conformance probes red on the `.1f` form and the
`Allocation (asset_class) — <enum>` label; the tier import reds (no `PackContext`). Then GREEN.

**MOVERS, enumerated by ruled class (rite):**
- **Label (site 1), always:** `Allocation (asset_class) — equity` → `Allocation — Equity` (every bucket, via `label_for`).
- **Weight → 2dp (sites 1, 4), always:** `(45.6%)` → `(45.60%)`; `(80.6%)` → `(80.55%)`.
- **Change → U+2212 (sites 2, 3), negatives only:** `(-2.35%)` → `(−2.35%)`; **byte-identical on positive changes** (already 2dp, explicit `+`).
- **Change → 2dp + U+2212 (site 5), always:** `+7.9%` → `+7.93%`, `-2.1%` → `−2.13%`.

**THE RITE, in full (ruling item 5):**
- **F-5 byte-identity pin updated DELIBERATELY** — `test_allocation_weight_annotation_is_unchanged` →
  `..._conforms_to_2dp_and_the_served_class_label`, with a **dated note** in `test_fact_pack_kinds.py`
  (the pre-F-7 one-decimal/raw-enum ratification is superseded 2026-07-22).
- **Dated delta notes** in `page-portfolio.md` (allocation weight), `page-markets.md` (quote change),
  `page-instrument-detail.md` (quote + period change) — each records the pack conformed TO the page and
  the **page itself did NOT change** (records-truth). Stale comment in `figure_registry.py` corrected.
- **Camera-over-green (in-delta pre-pass):** isolated stack (owner's stack untouched, `.env` restored),
  `/ai/facts` served every bucket as `Allocation — <human>` at 2dp, the Ask panel rendered them live
  with **0 console errors**, and pack `80.55%` == the page's largest concentration. **Formal
  movers-on-camera owed at 0a-ii** (owner's look, both themes).

**Gates.** Backend **2096 passed / 15 skipped, ordered AND randomized**, exit 0; `make lint` PASS;
contract **141/71 unchanged** (no path/schema — rendering + labels only). Suite reconciliation:
**2093 → 2096, +3** this delta's own (census + holdings-weight conformance + tier-declared), with
`test_allocation_weight_annotation_is_unchanged` **renamed in place** to `..._conforms_to_2dp_and_the_
served_class_label` (a flipped assertion, not a count change) and `test_intent_word_boundary._allocation`
updated to the new label (a mover, not a new test). **⚠ The owner's live stack (`:8321`/`:5173`) was
running during both gate passes** — an idle dev server, not a competing pytest, and the gate's fixture DB
never touches it; ordered==randomized (2096) corroborates no contention.

**⚠ Untyped-shape caveat (§3b):** the `facts` event **content** moved — allocation labels and every
weight/change annotation — an untyped served string the contract cannot see; the served-shape pins and
the census guard are what see it. **Help currency: no Help/GLOSSARY entry changed** — the served class
labels come from the existing `/refdata` MASTER-DATA vocabulary (`label_for`), not new copy;
guard-corroborated.

#### Phase 1 delta 5 — ACCEPTED-SURFACE CORRECTIONS: setParams + AppRoutes comment (`817a73c`) — DONE

**Per the queue (owner 2026-07-22) — the mechanical accepted-surface corrections under the rite.**
The **F-2 census is its OWN delta** and is surveyed below (STOP for chat).

**What shipped.**

| Change | File |
|---|---|
| **`setParams` sibling-param fix (§9-D)** — `Settings.tsx` switched tabs with a **fresh** `{tab:v}` object, dropping every sibling query param. Replaced with the react-router **functional updater** (`(prev) => { prev.set("tab", v); return prev; }`), so only `tab` changes and siblings survive. Latent today (no sibling is produced yet — R-60 is post-release), fixed so a future one can't be silently dropped | `frontend/src/routes/Settings.tsx` |
| **`AppRoutes.tsx:59` comment** — "four URL-addressable tabs" → **seven** (records-truth bar; rides this commit, no plan note) | `frontend/src/AppRoutes.tsx` |

**FAIL-FIRST + THE RITE.** `Settings.test.tsx` — *"changing a tab PRESERVES sibling query params"* —
RED before (the sibling `keep=me` dropped), GREEN after. **Settings pre-pass re-run (isolated, spare
ports, `.env` restored):** `/settings?tab=general&keep=me` driven Appearance → Privacy → System →
About, **`keep=me` preserved on every switch**, each tab set correctly, **0 console errors**. **Dated
delta note in `page-settings.md`** (the guard-REDs-an-accepted-surface rite — the ruling required it).

**Gates.** `npm run check` **exit 0** (vitest **425 passed** / Playwright **361** / all check scripts
incl. `check:ask-boundary`); no backend change. Suite reconciliation: **vitest 424 → 425, +1** (the
sibling-param test). **Help currency: no Help entry changed** — a param-plumbing fix + a comment;
guard-corroborated.

#### Phase 1 F-2 delta — ALLOCATION CENSUS: dead grouping deleted, registry re-points per-class (`125cac5`) — DONE

**⊕ RULED 2026-07-22 (architect under delegation) — options 1+3, option 2 rejected by name.** The
survey (recorded below) found the four-bucket grouping **unratified, rendered nowhere, incomplete**
(92.1%) — a premise correction on *"live on an accepted surface"*. The ruling: **delete the dead
grouping, re-point the registry to the existing per-class derivation** (no recompute).

**What shipped.**

| Change | File |
|---|---|
| **Ruling 1 — the dead grouping DELETES.** The four hardcoded buckets + `weight()` + the four `/portfolio/stats` metrics removed. A **deliberate contract change** — regen same-commit | `app/services/analytics.py` |
| **Ruling 2 — the registry RE-POINTS, not recomputes.** The four `alloc_*` rows → **per-class, enum-derived** (`_alloc_figures`: one row per positive `AssetClass`), endpoint = the EXISTING `allocation_by_class` (the donut's source, `/portfolio/summary`), labels via `label_for` (F-7 reuse). Enum-complete + sums-to-100 by construction. Stale three-bucket exemptions removed; per-class exemptions generated from the same rows | `app/services/figure_registry.py` |
| **Ruling 3 — the deferral LIFTS.** Rows → `pack_reachable=True`; `term-allocation-weight` pulls the per-class figures. `term_figure_facts` gains `allocation_facts` as the alloc producer (SUMMARY-endpoint but not a headline figure), and an **unheld class is OMITTED, not "unavailable"** — allocation is a census, absence = not-held, not a coverage gap | `app/ai/tools.py` |
| **`DEFERRED_TO_F2` exemption DELETED**; `test_the_f2_deferral_list_is_not_stale` (built to red at this moment) removed; reverse-index count 4 → 12; the four-bucket parity assertion flipped to absence; the analytics-metric blindness pin 19 → 15 | tests |

**FAIL-FIRST (ruling item 5).** (a) `test_the_allocation_census_is_enum_complete_and_sums_to_100` — RED
on enum-completeness (registry had four coarse rows, not per-class); GREEN after (12 per-class rows,
served weights sum to 100). (b) `test_the_dead_four_buckets_no_longer_reach_the_stats_response` — RED
before removal, GREEN after. A live-diagnosed regression fixed in-flight: the now-reachable alloc
figures collided at the dedupe layer (`term_figure_facts` emitted 12 "unavailable" that clobbered the
real weights) — caught by the census guard, fixed by producing them from `allocation_facts`.

**THE RITE.** **`page-portfolio` pre-pass re-run + dated note** — the Portfolio "By class" donut is
**exactly the per-class census the registry now points to** (Cash 2.05% · … · Property 80.55%, sums to
100), driven clean at 1366×950, **0 console errors, unchanged** (the deleted metrics rendered nowhere).
**Formal movers-on-camera** (the AI answer now pulling per-class figures) **owed at 0a-ii**. Labels via
`label_for` — no coinage.

**Gates.** Backend **2097 passed / 15 skipped, ordered AND randomized**, exit 0; `make lint` PASS. Suite
reconciliation: **2096 → 2097, +1 net** — +2 new census guards (enum-complete/sums-to-100, dead-buckets
absence) − 1 deleted (`test_the_f2_deferral_list_is_not_stale`, its tripwire fired). Movers by class: every
allocation label `Allocation — <label>` now resolves to a per-class registry figure; `term-allocation-weight`
reverse-indexes 4 → 12; the analytics metrics list 19 → 15.

**Contract: 141/71 UNCHANGED, stated not silent (ruling item 1).** The four metrics lived in the untyped
`/portfolio/stats -> dict` `metrics` list, not a typed schema, so the same-commit regen produced **no
diff**. The ruling flagged this as the one place the delta *may* move 141/71; it did not, and the reason
(untyped shape, the §3b situation) is on the record rather than left as silence.

**⚠ Untyped-shape caveat (§3b):** the `/portfolio/stats` `metrics` content moved (four fewer entries)
and the AI `facts` event gains per-class allocation figures for `term-allocation-weight` — untyped
served shapes the contract cannot see; the census guard and the served-shape pins are what see them.
**Help currency: no Help/GLOSSARY entry changed** — the per-class labels reuse the existing `/refdata`
MASTER-DATA vocabulary (`label_for`); guard-corroborated.

---

**THE SURVEY (recorded for the ruling; the premise correction).** The four `key_stats` buckets
(`analytics.py`) omitted `bond`/`retirement`/`other` — 92.14% on demo. **They rendered on NO accepted
surface**: Portfolio takes only `term-concentration` metrics; Home/Net worth use per-class
`allocation_by_class`; the AI pack excluded them. The **ratified** allocation is the per-class donut
(D-033/D-048), enum-complete, sums to 100. So the four-bucket grouping did **not** prove ratified; the
premise (*"live on an accepted surface"*) was false, and the fix shape was ruled: delete + re-point
per-class (options 1+3); option 2 (invent a coarse taxonomy for a grouping nobody renders) rejected.

#### Phase 1 loop-1 delta — W-4 · W-5 · W-6 · W-7 (0a-ii revision loop 1) — `caa23da` — DONE

**Per the 0a-ii walk (owner, chat 2026-07-22).** One focused delta answering four walk findings, full
standing discipline (the two new guards RED first), then a re-cut of ONLY the affected specimens.

**What shipped.**

| # | Change | Files |
|---|---|---|
| **W-5** | A tier-1 **ACTION/NAV** answer (SETTINGS_HELP whose top help hit is a PAGE) is **SCOPED to that one hit** — no headline figures, no second help fact (`gather_facts` returns `[hf[0]]`). MODE-scoped: tier-2 keeps the full pack. **Plus** the fuzzy-rank fix the scope EXPOSED: a settings-tab question promotes the `page-settings` hit over a `Heatmap`-on-"colour" match, so "change the theme" points at **Appearance**, not Heatmap | `app/ai/tools.py` |
| **W-4** | The **labeled link line** — DS §5.5 second PROPOSED variant, `.lf-ask__linkline`: a scoped action/nav answer POINTS with **"→ Open Holdings" / "→ Open Appearance settings"** (the ratified `--accent` link, no bare orphaned arrow). Value rows + multi-fact prose facts keep the ratified trailing arrow. `askLinkLabel` gains the **Settings tab-label vocabulary** ("Appearance settings") | `frontend/src/components/ui/AskPanel.tsx`, `ask.css`, `nav/askLinks.ts`, `DESIGN-SYSTEM.md` §5.5 |
| **W-6** | **Two misses, two truths** — `REFUSAL_UNROUTABLE` ("I can't match that to anything I can answer…") distinct from the no-data line; `classify_miss` decides purely from ROUTING (source/symbol/help hit), and grounding emits the matching string | `app/ai/prompts.py`, `app/ai/tools.py`, `app/ai/grounding.py` |
| **W-7** | **(i)** Help `term-xirr-twr` body/improves *"not applicable"* → *"unavailable"* (aligns the Help with the tier-1 rendering; W-1 deixis clean). **(ii)** `POSTURE_NO_EGRESS` *"no AI narration"* → *"no model narration"* — pin + `ai-surfaces.md` §12-3 record updated **deliberately** | `app/services/help.py`, `app/api/v1/routes/ai.py`, `test_posture_copy_ratified.py`, `ai-surfaces.md` |

**FAIL-FIRST — both new guards RED first, then GREEN:**
- **W-5** `test_tier1_action_nav_scope.py` (new): reverting the `return [hf[0]]` scope → the action/nav
  answer carried the portfolio headline + multiple help facts — **RED** on both the holdings and the
  theme case (the theme case also proving the Settings-over-Heatmap promotion). Restored → GREEN.
- **W-6** `test_tier1_miss_split.py` (extended): reverting the miss selection to `_template_answer` →
  the unroutable body carried the **no-data** truth — **RED**. Restored → GREEN. `classify_miss` pinned
  seed-independently (routed → `no_data`, unmatched → `unroutable`); the two strings are DISTINCT.
- **W-4** `AskPanel.test.tsx` (4 new): the labeled line renders an `<a>` (never a control, §9-E),
  names its tab destination, closes the panel on navigate, and a page-linked help fact in a MULTI-fact
  pack keeps its trailing arrow (the discriminator that leaves ratified frames untouched).

**THE RITE — re-cut ONLY the affected specimens (owner: "ratified frames do not get re-cut").** The
affected surfaces: **(b)/(c)** action/nav answers (W-4/W-5), the **honest miss** (W-6), the **no_egress**
posture frame (W-7ii), **and tier-1(a)** covered+uncovered (W-7i changes the Help·XIRR body text VISIBLE
in that frame — re-cut for camera-honesty, stated). Everything else (ratio, allocation, change, the other
four postures) is untouched by this delta and is NOT re-cut. **12 re-cut frames (both themes, 0 non-benign
console errors, isolated instances, `.env` hash-restored):** `action-holdings` + `nav-theme` (scoped to the
top help hit + the labeled **"↗ Open Holdings"** / **"↗ Open Appearance settings"** line — no headline,
no second help fact); `honest-miss` (the UNROUTABLE string); `posture-no_egress` ("no model narration");
`tier1a-covered` + `tier1a-uncovered` (Help·XIRR body now "'unavailable' otherwise"; figures unchanged —
XIRR live, TWR 71.62%/"unavailable"). **Verified by looking.**

**Gates — solo.** Backend **2102 passed / 15 skipped ordered / 2102 passed / 15 skipped randomized**
(⚠ ran under the owner's idle dev stack — CPU-contended, ~19–21 min/run; not a competing pytest, fixture
DB untouched, ordered==randomized corroborates no flakiness). `make lint` PASS. `npm run check` **exit 0
(vitest 429 passed / 42 files · Playwright 361 passed)**. Suite reconciliation: backend **2097 → 2102, +5**
(4 action/nav-scope + 1 classify_miss); vitest **425 → 429, +4** (AskPanel W-4), Playwright 361 unchanged.
**Untyped-shape caveat (§3b):** the SSE `facts` content moves for action/nav (scoped)
and misses (two strings) — the served-path guards + the miss/scope tests are what see it. **Help
currency:** the `term-xirr-twr` Help body changed (W-7i) — a Help delta, **stated** (rides §9-I's owed
`ask`-entry close delta); the posture string moved with its §12-3 record. **HARD STOP for the owner's
loop-2 look.**

#### Phase 1 loop-2 walk → loop-3 delta — W-4 EXTENSION (prose facts carry no pointer) — `c10ad30` — DONE

**Loop-2 WALKED 2026-07-22 (owner, chat):**
**① RATIFIED AS RE-CUT (owner, by looking) — dated notes:** the scoped action answer + the labeled
link line (**DS §5.5 variant 2 FORMAL**), the nav answer incl. the theme→Appearance promotion,
`REFUSAL_UNROUTABLE` verbatim, the no_egress recut, the `'unavailable'` Help copy. (DESIGN-SYSTEM §5.5
updated: variant 2 PROPOSED → RATIFIED.)
**② W-4 EXTENSION — a deliberate, dated amendment to 1c's ratified frames.** **Prose / help facts now
render NO pointer** — the bare trailing/orphan ↗ is removed from prose facts EVERYWHERE (it pointed at a
destination the reader was not being sent to). **Value rows keep the ratified trailing arrow; scoped
action/nav answers keep the labeled line.** Frontend-only (`AskPanel.tsx`: the prose branch renders the
labeled line when scoped, else nothing; `FactPointer` JSDoc + DS §5.5 note it is value-rows-only).
**Guard (loop-3):** `AskPanel.test.tsx` — a prose fact rendering a pointer glyph outside the labeled-line
variant reds (the loop-1 "prose keeps its arrow" discriminator was FLIPPED deliberately); **proven RED
first** (restoring the prose `FactPointer` reds it), and a value row still carries its arrow (the
not-vacuous discriminator).
**③ GATE NOTE — standing-rules clarification recorded** (`memory/gate-runs-must-be-solo`): "uncontended"
means no STATE-SHARING process, not zero CPU load; CPU-load contention is flagged and acceptable when
isolation is proven and ordered==randomized agree. **I-1 corollary noted:** a pass under CPU load is
disposition-relevant evidence (argues against a pure load-flake).

**Gates.** No backend code changed — the **backend 2102 verdict (loop-1) stands**. `npm run check` **exit 0
(vitest 429 passed / 42 files · Playwright 361 passed)**; vitest 429 unchanged (the loop-1 discriminator
test FLIPPED in place, not a count change); Playwright 361 unchanged. `make lint` N/A (no Python moved).

**THE RITE — re-cut ONLY the frames the extension visibly touches (owner's list): `tier1a-covered`,
`tier1a-uncovered`, `ratio`, `movers-allocation` — both themes** (each had a prose/help fact whose trailing
↗ is now gone; their value rows keep arrows). `action-holdings`/`nav-theme` already render the labeled line
(unchanged); `honest-miss`/postures have no facts; `movers-change`'s AAPL rows are VALUE rows (arrows kept)
— none re-cut. **8 re-cut frames verified (both themes, 0 non-benign console errors, per-row pointer census:
every prose fact ptr=0/link=0, every value row ptr=1):** the orphan ↗ under each prose fact's "Show more"
is gone; figures unchanged (XIRR live, TWR 71.62%/"unavailable", ratio 10.51, allocation sums to 100).

**④ PHASE 2 AUTHORIZED after the loop-3 look** (owner ruling item 4): the test matrix (both egress × both
acceptance states) begins after the owner's loop-3 look, **with no further stop between loop-3 and Phase
2's report**. **HARD STOP for the owner's loop-3 look.**

### Phase 2 — TESTS AND GUARDS

Every §7 row that names a guard. **Each proven RED first**, on a specimen that reproduces the defect.

- The **panel-explains/page-acts** guard and the **bidirectional resolution** guard, both in the
  `check:primitives` shape — narrow scan, named owner, **blindness pin**.
- The **deep-link-never-bypasses-the-gate** test, **at the server**.
- The **limiter** test: tier-1 answers still produced with the limiter exhausted.
- The **deprecated-term corpus** extended to all served AI strings.
- **Driven across BOTH egress states and BOTH acceptance states** — a matrix, not a happy path.
- **`npm run check` exit code stated, run from `frontend/`.** **No known-red left on trunk.**

#### Phase 2 execution (2026-07-22) — the guard audit + the net-new egress×acceptance matrix

**THE §7 GUARD AUDIT (this session, fan-out).** Every §7 acceptance row that names a guard was
mapped to its standing test: **19/19 exist** — 17 dedicated, 2 structural/composed — each with a
blindness pin or an explicit FAIL-FIRST note. **Most were already built at Phase 0/1** and needed
no new work: `test_intent_routing_table.py` (one router, flags-as-derivation + blindness pin) ·
`test_intent_word_boundary.py` + `test_intent_stem_probes.py` (the §0-A substring specimens,
SEEN-RED) · `test_tier1_miss_split.py` (honest-miss shape, two-truths) · `test_answer_mode.py`
(tier-1 never consults the limiter; rate-limited tier-2 falls back **to tier-1**) ·
`test_figure_registry.py` (ONE table, no CAGR row, `term_id` as derived reverse index) ·
`test_pack_reachability.py` (projection-only, canonical-page cross-check, enum-complete allocation) ·
`test_ai_grounding_corpus.py` (tier lists pinned to the **actual Glossary schema**, §0-C) ·
`test_served_link_ids.py` + `frontend/src/nav/askLinks.test.ts` (bidirectional resolution; every
served ID registered, every registered ID resolves against the **served** catalogue) ·
`frontend/scripts/check-ask-boundary.mjs` (the §9-E panel-explains/page-acts guard, `check:primitives`
shape + blindness pin) · `test_ai_acceptance_gate.py` (451 at the seven AI paths, path-exists-first) ·
`test_ai_provenance.py` (no fourth legend axis) · `test_stub_narration_sentences.py` (§17-2 truth
bar) · `test_posture_copy_ratified.py` (the five strings + **coverage** assertion + the
retired-vendor-word "hailo" guard over all served posture strings) · `test_ai_served_shapes.py`
(the `/ai/facts` + `facts`/`provenance` SSE shape pins).

**NET-NEW — THE EGRESS × ACCEPTANCE MATRIX** (`test_tier1_egress_acceptance_matrix.py`, `097fa34`). §8's
"a matrix, not a happy path": the two axes were each driven, but **never CROSSED for AI** — the default
suite runs only the *(accepted, model-unavailable, no-egress-OFF)* cell. Four cells now driven, each
with a blindness pin against a vacuous pass:
- **tier-1 identical across egress states** — the *zero-calls-by-construction* proof. Compared on a
  **coverage-stable** question (net worth rides the live valuation, never the date-aware series): a
  settings write fires a **`§12-R3` wrong-instrument candle purge** that flips date-aware coverage — a
  data-state side effect **orthogonal to egress** that churns the coverage-gated perf pack (this also
  corroborates I-1's live-instance covered→uncovered decay, 0a-ii Recon-3, on a second surface). Pin:
  facts non-empty.
- **tier-1 under no-egress constructs NO http client** — fills the audit's ONE behavioural gap: the
  zero-calls property was proven structurally (import-scan gate) and at the provider, but **never at the
  served `/ai/chat` path**. `forbid_http` tripwire; the panel goes **local, not dark** (R-22 amendment).
- **the gate refuses tier-1 regardless of egress** (parametrized both egress states) — 451 unaccepted;
  anti-blind: re-accepting **UNLOCKS** (200), so 451-everywhere cannot pass it.

**GAPS — declined / deferred with rationale (no silent drop):**
- *Literal 141/71 count pin* — **DECLINED.** The drift check (`test_openapi_contract`) pins the **full
  committed spec** (every path AND schema), a **stronger** guarantee than a count; **141/71 confirmed
  current** this session. §7-E's "pinned" is met by a superset.
- *A single "all AI strings served" enumeration guard* and *a re-runnable check-ask-boundary RED
  specimen fixture* — **DEFERRED to the pre-release backlog.** Distributed served-string coverage
  (miss/posture/tab tests) + the standing blindness pin already hold; neither is release-blocking.

**GATES.** `npm run check` (from `frontend/`): **exit 0** — vitest **429** (I-2 is fixture-only, no
count change), Playwright **361**, lint + `check:primitives` + `check:ask-boundary` +
`check:internal-copy` green. Backend suite **solo, ordered**: **2107 passed / 15 skipped**, exit 0 (18:43). CPU-contended by the
owner's idle dev stack (`uvicorn :8321 --reload`) — **isolated temp DBs, no state-sharing pytest**, the
acceptable-contention case per the loop-2 clarification. **Randomized pass NOT run** — `pytest-randomly`
is not installed and adding it is an **ADR-gated dependency** (CLAUDE.md); the ordering-dependence concern
is covered instead by per-test isolation (`_fresh_engine_per_test` + per-test temp SQLite + `ratelimit`/
`metrics`/`fx` resets) and by the two new tests passing **standalone**. Suite reconciliation: **2102 → 2107,
+5** — `test_tier1_egress_acceptance_matrix.py` (**+4**: identity · zero-http-client · gate×2-egress) +
`test_key_stats_recovers…` (**+1**, I-1); vitest/Playwright unchanged (the matrix is backend-only).
**§3b untyped-shape caveat unchanged; no contract delta (141/71).** No known-red left on trunk.

**⊕ SESSION-END STATE (2026-07-22).** **I-1, I-2 and Phase 2 are DONE** (commits `95d14a5` · `c124eda`
· `d19fc59` · `097fa34` · `2cd0193`). **Phase 3a (the scripted pre-pass) is the NEXT and was NOT run
this session** — a full isolated live drive (both themes, the whole Ask surface, 0 non-benign console
errors) is a re-drive-prone task whose value is in being done carefully, not rushed at a session's tail,
and the owner's live stack is up on `:8321` (isolate to `:8399`/spare ports; `.env` snapshot-restore;
prod-`dist` same-origin, filter the one benign CSP theme-flash; harness recipe in `memory/prepass-harness`).
**Then Phase 3b (owner walk) → CLOSE.**

**⊕ ACCUMULATING §-LESSON CANDIDATES (for the close — MECHANISED there, not written here):**
1. **A flake's mechanism must be REPRODUCED, not inferred.** I-1's Phase-0 seed-state hypothesis was
   *confounded* because it never executed the fixture's coverage state (which is fully covered); the real
   cause was R-43's session-poison, reproduced by a forced cancellation. *What turns red:* the rollback-spy
   guard — but the deeper lesson is a review habit, not a guard.
2. **`asyncio.wait_for` over a session-using coroutine is a session-poison hazard.** Its cancellation lands
   mid-query and invalidates the transaction; recovery is `rollback()` + keeping all ORM reads ahead of the
   bounded call (async SQLAlchemy cannot re-load an expired attribute). *What turns red:* the recovery guard.
3. **When the failure itself is not deterministically reproducible, guard the FIX's mechanism and SAY SO.**
   (`wait_for` converts `CancelledError`→`TimeoutError`; a caught statement error does not persist.) The
   test's docstring carries the honesty; the real recovery was hand-verified 5/5.
4. **A fixture-hygiene sweep must cover the WHOLE fixture object, not the named literals.** I-2's row named
   two `privacy_label`s; the pass found a third byte-identical served string (`kind_label`) in the same
   object. A byte-identical served string in a test is a grep/specimen hazard whether or not it is asserted.
5. **A matrix guard must CROSS its axes.** The egress and acceptance axes were each driven but never crossed
   for AI; the default suite runs one cell and the corners hide there. And: compare egress-independence on a
   **coverage-stable** question — a settings-write side effect (`§12-R3` candle purge → coverage flip)
   confounds a coverage-gated comparison (which also corroborated I-1's live decay on a second surface).
6. **⚠ CARRIED FINDING (owner ruling owed):** on a genuine perf-series timeout, `vol = ps.get(...) or 0.0`
   renders **fabricated `0.00%` volatility/drawdown** (Guarantee 3) while TWR/ratio honestly drop —
   pre-existing, rare, a rendered-Portfolio-output change; not fixed in I-1 (normative). Needs a ruling.

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

**⊕ W-1 DEIXIS RULE (owner's 0a-i look, 2026-07-21) — folded into this delta.** **Canonical-page deixis
is NAMED, never pointed:** *"on the Markets page"*, never *"here"* / *"edited here and nowhere else"*.
The reason is structural and new: **every Help body is now also Ask-panel copy** (the widened fact pack
projects Help bodies into the panel, §0-C), so a Help sentence written with page-relative deixis
(*"here"*) is **false the moment it is read in the Ask panel**, which is not that page. The `ask`-entry
rewrite and any Help body it pulls must use named deixis; the content gate inherits it. **R-55's
content gate inherits this rule too** (one line onto its ROADMAP row, this records commit).

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

# R-63 — Pricing routing reliability (fix the chain once and for all)

> **⚡ PRE-RELEASE, RD-9 Amendment 11.** Owner ruling at the R-54 close (2026-07-23):
> *"data is the core of this platform, can't leave it so loose" / "needs to be fixed once
> and for all."* **Investigation-first — a hard gate.** Phase A (read-only live diagnosis)
> is DONE and its findings ARE the survey core of §0. This file runs §0 → §9 and **STOPS**
> at §9 for the chat one-pass. No code has changed and none changes until §9 is ruled.
>
> Cross-refs: `docs/audit/05-PROVIDERS-AND-ROUTING.md` · `data-feed-routing.md` (R-38) ·
> `page-pricing-health.md` · `page-settings.md` · `docs/reference/alpha_vantage_claude_code_reference.md`
> (committed this session, `b88adbe`) · `ROADMAP.md` R-63 · `release-readiness.md` RD-9 Amdt 11.

---

## 0. SURVEY

### 0-A. Phase A — READ-ONLY LIVE DIAGNOSIS (evidence, 2026-07-23)

**Method (boundaries honoured):** live logs read in place; the live DB **copied** to a temp
path and inspected read-only (copy since deleted); settings/keys **loaded, never printed**;
one instrumented **5-call** AlphaVantage probe with real egress (the owner's own key), each
call's raw envelope captured. Live stack/data never written, never restarted. AV free/premium
entitlement labels cross-checked against the committed reference doc.

**⛳ THE ROOT CAUSE (dominant, affects every AV symbol): an entitlement-envelope PARSE mismatch.**
`external.py:124` injects `entitlement=delayed` on **every** AV call (added at F-4). With that
parameter, AlphaVantage returns the quote under a **decorated top-level key** —
`"Global Quote - DATA DELAYED BY 15 MINUTES"` — but `external.py:191` reads only
`data.get("Global Quote", {})`. It therefore gets `{}` on **every** entitled response, raises
`"empty quote (unknown symbol or rate limited)"`, and returns `UNAVAILABLE`. **The price is in
the response the whole time, under a key the parser never looks for.** The key IS entitled to
delayed data (AV served it); this is a parsing defect, not an entitlement or quota failure.

**Probe results (5 calls, all HTTP 200, no throttle):**

| # | Call | Result | Reading |
| --- | --- | --- | --- |
| 1 | TSLA GLOBAL_QUOTE **entitlement=delayed** (what the code sends) | key = `"Global Quote - DATA DELAYED BY 15 MINUTES"`; `data["Global Quote"]` = **absent** | **the bug, reproduced** |
| 2 | TSLA GLOBAL_QUOTE **no entitlement** | `{"Global Quote": {…}}`, price **378.93** | works without the param |
| 3 | **SBICARD.BSE** GLOBAL_QUOTE no entitlement | price **644.75** | `.BSE` **exonerated** |
| 4 | RELIANCE.BSE GLOBAL_QUOTE no entitlement (control) | price **1303.65** | `.BSE` class works |
| 5 | ZZZZINVALID GLOBAL_QUOTE no entitlement | `{"Global Quote": {}}` | AV's genuine-empty envelope |

**Live-log corroboration** (`~/.ledgerframe-data/logs/ledgerframe.log`): every AV symbol —
TSLA, AAPL, MSFT, NVDA, SPY, QQQ, GLD, SBICARD.BSE, AARK — logs the **identical**
`"AV quote unavailable … empty quote (unknown symbol or rate limited)"` (lines 13440–13651).
One line (13605) caught a genuine transient throttle: *"Burst pattern detected … no more than 5
requests per second."* — a **secondary** contributor during a 19-symbol serial blast, not the
dominant cause.

**Live-DB corroboration** (read-only copy): the three symptom instruments (TSLA id 22,
AARK id 27, SBICARD.BSE id 29) have **no `quotes` row at all** — so `get_cached_quote` returns
`source="none"`, the frontend appends `(corrected)` because a `source_override='alphavantage'`
is set (`PricingHealth.tsx:216`), and the valuation falls to cost → `ESTIMATED_VALUE`
(`portfolio.py:510`) → confidence base 40 − 15 (`"no source could price it"`) = **25/low**
(`confidence.py`), which is exactly what the owner sees. `routing_matrix` has `equity→* =
alphavantage` and `etf→US = alphavantage`; `privacy_mode=false` (egress on). CoinGecko (BTC,
65762) and AMFI (the fund) — both **keyless** — have real cached prices. **Only the
key-gated AV lane is dark.** (Aside for §9-i: TSLA has a **duplicate instrument** — id 22 with
the override, id 23 without; noted, not central.)

**Fan-out vs budget:** the refresh universe is holdings **plus** the market-overview default
set (`markets.py:26`: SPY/QQQ/DIA/EWJ/FEZ/EWU/EWH/INDA/EWS/… ≈ 16 ETF proxies). One pass fires
**19 AV calls**; AV free tier is **25/day** (reference §1). The owner's key returns *delayed*
data (a premium market-data entitlement), so it is not the 25/day free tier — but the per-second
burst guard still trips on a serial blast. Free-first ordering (f) would keep the money-free
lanes (yahoo/coingecko/amfi) carrying the load regardless.

### 0-B. The five investigation questions — answered, evidence-cited

- **(i) What does AV actually return, and is "premium" verified?** AV returns **valid delayed
  quote data** for every symbol tried, under the decorated envelope key when `entitlement=delayed`
  is sent. The key **is** entitled to 15-min-delayed market data (verified live, probe #1). The
  Settings **"premium"** label is **config-claimed and coarse**: the adapter's own `av_tier`
  (`external.py:116`) learns tier **only from INDEX_DATA** responses (a *different* premium
  product the key may lack), never from quotes — so it can read "unknown/free" while quotes are
  fully entitled. Two different "premium" notions are conflated.
- **(ii) Which path collapses distinct failures into one "none"?** Three layers, compounding:
  (1) `external.py:207-216` — one `except Exception` funnels **parse-miss, unknown-symbol,
  throttle (`RateLimited`), HTTP error** all into a single `UNAVAILABLE` quote with the message
  `"empty quote (unknown symbol or rate limited)"`; the `RateLimited` text is discarded.
  (2) `refresh_quote_detailed` (`market.py:684-691`) reports a generic `no_data` /
  *"unsupported on this provider, or limit hit"*. (3) `get_cached_quote` (`market.py:733-739`)
  stores/returns `source="none"` when no row exists; the UI appends `(corrected)`.
- **(iii) Why no fall-through to yahoo — does an override pin & remove the net?** **There is no
  fetch-time net at all.** `refresh_quote_detailed` only ever fetches from the **single active
  provider** (`get_provider()` = `alphavantage`); the `priority_chain` is a **display/ownership
  decision, never an execution fallback** — no code walks it to try the next provider. The
  `override` branch (`router.py:338-344`) does pin the head and return immediately with no
  capability revalidation, but even without an override the matrix/active-provider path fetches
  only AV. **Yahoo is never instantiated or called** (zero yahoo lines in the logs). So the
  shipped sentence — *"routing falls through to the default lane"* — describes a fallthrough that
  exists in the **decision** of which provider is *named*, never in the **execution** of fetching.
- **(iv) Why eodhd(no key) at priority 1 — skip or stall?** Neither. `DEFAULT_PRIORITY`
  (`router.py:150`) is a policy constant; `route()` selects the **active provider** when it is in
  the chain (`router.py:411`); `eodhd` is only **annotated `(no key)` for display**
  (`_chain_detail`) and is **never fetched**, because the chain is not walked at fetch time. It
  neither skips nor stalls — it is decorative.
- **(v) Why do stale chips never clear?** The three symbols have **no quote row**; each refresh
  gets `UNAVAILABLE` (price None) → the code correctly refuses to write a null price
  (`market.py:684`) → returns the (empty) cache → valuation falls to cost (`ESTIMATED_VALUE`).
  Nothing ever advances the state because the only lane tried (AV) always parse-fails. The chip is
  permanent until a real price lands, which never happens on the AV lane as shipped.
- **(vi) The `.BSE` suspect.** **Exonerated.** SBICARD.BSE and RELIANCE.BSE both return real
  prices without entitlement (probe #3, #4). The `.BSE` symbols failed only because the
  envelope-parse bug hits **all** symbols equally, and the message *"empty quote (unknown symbol
  or rate limited)"* invited the wrong suspicion — which is itself finding (b): the collapsed
  message misdirected the diagnosis.

### 0-C. Code census — the routing/provider layer (what a fix touches)

- `app/providers/market/external.py` — the AV adapter. **Root-cause site** (`:124` entitlement
  inject, `:191` fragile parse, `:207` failure collapse). History parse (`_find_time_series`) is
  already key-tolerant; quote parse is not.
- `app/providers/market/router.py` — pure `route()`; `DEFAULT_PRIORITY`, `CAPABILITIES`,
  `ChainEntry`, override/matrix/active precedence. Decides **ownership**, not execution.
- `app/services/market.py` — `refresh_quote_detailed` (single-provider fetch; **no chain
  walk**), `route_for_instrument`, `_refetch_route_mismatched` (coingecko-only), `get_cached_quote`.
- `app/services/confidence.py` — score/band/factors (drives the 25/low the owner sees).
- `app/api/v1/routes/portfolio.py` — `/portfolio/pricing-health` (the diagnostics surface).
- `app/providers/market/{yahoo,coingecko,amfi,eodhd,kite,ecb,csv,mock}.py` — the lanes a real
  fallback would fetch from. `yahoo` is keyless and `_ALL`-class — the natural free-first net.
- Frontend: `frontend/src/routes/PricingHealth.tsx`, `Settings.tsx` (the routing sentence
  `:1417-1418`), `RoutingMatrixMockup.tsx`.
- Specs: `GLOSSARY.md:138` (Routing matrix promise), `:118` (Source/Provider/Routing split),
  `:103` (Data confidence). No failure-state taxonomy terms exist yet (GLOSSARY-first in §9).

### 0-D. Survey inputs (a)–(g) — where each lands

- **(a)** rule pins HEAD, never removes the net → §9-1 (override semantics) + the **execution
  fallback** that must exist first (§0-B iii). *The sentence is false today for a deeper reason
  than an override: there is no fetch-time net at all.*
- **(b)** failure taxonomy (throttled/unmapped/errored/empty ≠ one "none"), surfaced in Pricing
  Health → §9-2 + §9-3 (served vocabulary, GLOSSARY-first).
- **(c)** per-symbol empty honesty (`.BSE`) → folded into (b); the class itself is exonerated, but
  the *genuine* empty (probe #5) must read differently from a parse-miss.
- **(d)** provider preflight (`is_available`-shaped) + **provider doctor** on Pricing Health → §9-4.
  *A doctor would have caught "AV returns 200 but we parse empty" on day one.*
- **(e)** cache staleness honesty for forming bars → §9-5.
- **(f)** **FREE-FIRST** chain ordering (owner ruling 2026-07-23) → §9-6. Money is a routing cost
  dimension; core function never requires payment. Yahoo/coingecko/amfi are keyless.
- **(g)** leverage the configured provider's full value → §0-E (ROADMAP candidates, **never R-63
  scope**).

### 0-E. (g) — AV capabilities beyond pricing (ROADMAP-row candidates, NOT R-63 scope)

From the committed reference: `NEWS_SENTIMENT` (FREE), `OVERVIEW`/`INCOME_STATEMENT`/`EARNINGS`
(FREE fundamentals), `DIVIDENDS`/`SPLITS` (FREE corporate actions), `SYMBOL_SEARCH` (FREE, would
sharpen mapping). Listed for the owner as future rows; **R-63 fixes pricing routing only.**

---

## 1. IDENTITY

R-63 is a **cross-cutting reliability fix**, not a new page. Primary owners: the AV adapter and
the refresh/execution path; secondary deltas on two **accepted** surfaces — **Pricing Health**
(new diagnostics: failure taxonomy + provider doctor) and **Settings → Data feeds** (the routing
sentence must become true). Both accepted-surface changes ship under the **guard-REDs-an-accepted-
surface rite** (CLAUDE.md): a dated delta note in each page's plan file + that page's pre-pass
re-run, in the same delta — **not** a close-report footnote.

## 2. OWNERSHIP TABLE (canonical homes — INFORMATION-ARCHITECTURE)

- Per-instrument routing **decision** → `route()` (internal) · surfaced read-only on **Pricing
  Health**. · Provider config/keys → **Settings → Data feeds**. · Failure taxonomy vocabulary →
  **GLOSSARY** (one home) then served. · Provider-doctor result → **Pricing Health** (read-only).
  No figure duplicated; other pages link.

## 3. API SURFACE

- **3a. Consumed (frozen contract):** `GET /portfolio/pricing-health` (extend rows with typed
  failure state), Settings routing-matrix endpoints (unchanged shape).
- **3b. Contract deltas (BUILD BACKEND-FIRST — approval owed at §9):**
  - a typed **failure-state** field on each pricing-health row (enum, not free text);
  - a **provider-doctor** read endpoint (per-provider verdict, redacted — key presence + a live
    known-symbol resolve, never the key);
  - possibly a `route_source`/execution-trace addition so "what the router did next" is honest.
  *Exact shapes drafted after §9 rules the taxonomy and doctor scope.*

## 4. COMPONENTS

Every user input via `src/components/ui/`. The provider-doctor surface is **read-only**
diagnostics (Badge/Table/status chips already in the DS). No raw inputs. Any new affordance the
ratified inventory lacks → listed in §9 before build.

## 5. VOCABULARIES

Failure-state terms are **categorical** → MASTER-DATA + GLOSSARY-first (§9-3). No free-text enums.
Candidate internal states (naming ruled at §9): `parse_error` · `throttled` · `unmapped` ·
`errored` · `empty` · `no_key` · `unsupported`. User-facing wording is a **separate** GLOSSARY
decision (copy hygiene: name a fact, never an endpoint).

## 6. DECISIONS IN FORCE

- GLOSSARY:138 Routing-matrix promise (*"falls back to its normal source exactly as before"*) —
  R-63 must make it **true**, not reword it away.
- Source/Provider/Routing split (D-028); Data-confidence penalties (GLOSSARY:103); no-egress
  Guarantee 5 (a fallback must **never** make a call under no-egress); F-4 entitlement=delayed
  (its intent — request delayed data — stays; its **parse** must tolerate the entitled envelope).
- Commitments: never fabricate a number; money math backend-only.

## 7. ACCEPTANCE CRITERIA (completed from the §9 one-pass — every row answers "what turns red?")

**Parse + fixtures (§9-0).**
- [ ] **AC-1** A test RED-reproduces the decorated-envelope parse-miss on the **captured real
  probe-#1 envelope** (`"Global Quote - DATA DELAYED BY 15 MINUTES"`), then greens after the
  tolerant `Global Quote*` parse. *Red when:* the parser regresses to `data["Global Quote"]` only.
- [ ] **AC-2** A test asserts the **genuine-empty** case (captured real probe-#5 envelope,
  `{"Global Quote": {}}`) resolves to `empty`, **distinct** from `parse_error`. *Red when:* the two
  collapse to one state again.
- [ ] **AC-3** The `entitlement` audit: a guard enumerates every AV call site and asserts each
  either omits `entitlement` or parses the entitled envelope. *Red when:* a new call site sends
  `entitlement` into a non-tolerant parse.

**Execution net + provenance (§9-1).**
- [ ] **AC-4** With AV forced to fail (real probe-#1 fixture), the fetch **walks the chain** and
  **yahoo serves the price** — for both a matrix cell and an explicit override (pin-head-keep-net).
  *Red when:* the fetch stops at the pinned head and returns cache/none. (This is the canonical
  **capability-vs-property** case — a 200-with-data that parses empty; cite the TEMPLATE lesson.)
- [ ] **AC-5** On a net catch, Pricing Health shows **head=X, priced-by=Y** (provenance rider).
  *Red when:* the rendered source hides that a fallback fired.
- [ ] **AC-6** `no_key` lanes are **skipped** in the walk (never "stalled on"). *Red when:* an
  unkeyed lane is attempted and errors.

**Taxonomy + confidence (§9-2, §9-9).**
- [ ] **AC-7** All seven states (`parse_error · throttled · unmapped · errored · empty · no_key ·
  unsupported`) are distinguishable in the per-holding diagnostics drawer; the summary chip uses the
  coarser served vocabulary. *Red when:* any two are indistinguishable in the drawer.
- [ ] **AC-8** `throttled` surfaces "last throttled at T — will retry". *Red when:* a throttle
  reads as `empty`/`none`.
- [ ] **AC-9** Tier labels reflect **verified capability per product** (quotes vs index), never the
  coarse config claim (two-premiums fix). *Red when:* Settings shows "premium" while a product is
  unverified/unentitled.

**Free-first + budget (§9-6).**
- [ ] **AC-10** `DEFAULT_PRIORITY` orders free/keyless before key-gated within capability
  (`us_equity: [yahoo, alphavantage, eodhd, csv, manual]` et al.); **no core price requires a paid
  key**. *Red when:* a keyless-capable lane sits below a paid one.
- [ ] **AC-11** An explicit matrix/override **wins** over free-first but **keeps the net**
  (§9-1). *Red when:* an override disables the fallback.
- [ ] **AC-12** The refresh budget spends **holdings before overview proxies**. *Red when:* proxy
  refresh can starve a holding of its one daily call.

**Doctor (§9-4).**
- [ ] **AC-13** Provider doctor is an **on-demand button**, spends **≤1 egress call per lane per
  run**, **counts calls on screen**, verdicts **redacted** (key presence / reachability /
  known-symbol resolve — never the key, never a holding value). *Red when:* it auto-runs, exceeds
  the budget, or leaks a secret/value.
- [ ] **AC-14** The doctor **would have caught this bug** — a lane returning 200-with-data that
  parses empty reports **FAIL (parse)**, not PASS. *Red when:* a parse-empty lane reports healthy.

**Standing.**
- [ ] **AC-15** **Blindness pins** on every new guard (a guard that protects nothing fails loudly).
- [ ] **AC-16** Help Currency Law: Pricing Health + Settings routing copy deltas shipped, or
  guard-corroborated "no impact".
- [ ] **AC-17** Accepted-surface **rite** discharged for **Pricing Health** and **Settings**
  (dated delta note + pre-pass re-run each — §9-7).
- [ ] **AC-18** Both suite verdicts (ordered AND randomized, declared seeds); UTF-8-safe edits.

## 8. BUILD PHASES (authored from the §9 one-pass — backend-first, fail-first each)

- **Phase 0 — the parse-miss RED + fix (the root cause).** Capture the real envelopes as
  committed fixtures (probe #1 decorated, probe #5 genuine-empty). Write the RED that would have
  caught this the day F-4 shipped (AC-1), on the real fixture → fix the AV quote parser to tolerate
  the `Global Quote*` key family (the `_find_time_series` pattern) → green → assert the
  genuine-empty distinction (AC-2). Audit every `entitlement` use (AC-3). *This is the delta that
  makes TSLA/SBICARD.BSE/AARK price again.*
- **Phase 1 — the execution net (§9-1).** Make the priority chain **real at fetch time**: on the
  selected source failing, walk to the next **capable, keyed** lane (skip `no_key`), for both
  matrix and override (pin-head-keep-net). Provenance: carry head=X / priced-by=Y (AC-4/5/6).
  Fail-first: AV forced to fail → yahoo serves (the capability-vs-property lesson).
- **Phase 2 — the failure taxonomy + confidence integration (§9-2/§9-9).** The seven states from
  adapter → refresh → pricing-health row (typed field, §3b). `throttled` carries last-throttle/retry.
  Two-premiums fix: verified-capability tier labels (AC-7/8/9).
- **Phase 3 — free-first ordering + budget (§9-6).** Reorder `DEFAULT_PRIORITY` (free/keyless
  before paid, within capability); refresh budget spends holdings before overview proxies; explicit
  user cell/override wins but keeps the net (AC-10/11/12).
- **Phase 4 — surface deltas under the RITE (§9-7).** Pricing Health: taxonomy drawer +
  head/priced-by provenance. Settings: recut the routing sentence (`Settings.tsx:1417-1418`) so it
  is **true**, and the "Market data provider" card's meaning shift (single source → preferred head).
  **Dated delta note + pre-pass re-run** for `page-pricing-health.md` AND `page-settings.md`.
- **Phase 5 — the provider doctor (§9-4).** On-demand button; ≤1 egress/lane/run; calls counted
  on screen; redacted verdicts; known-symbol set (proposed below). Must report a parse-empty lane as
  FAIL (AC-13/14).
- **Phase 6 — 0a specimens** incl. PROPOSED failure-state copy (GLOSSARY-first, §9-3) and the recut
  Settings sentences → **tests both postures** (egress on / no-egress: a fallback NEVER calls under
  no-egress) → **3a** scripted pre-pass → **owner 3b on his LIVE symptoms** (TSLA/SBICARD.BSE/AARK) →
  **close** (§-ledger CLOSED, strike-check, Help currency, KB-sync).

*Proposed provider-doctor known symbols (owner ratifies at 0a):* yahoo→`AAPL`, alphavantage→`IBM`,
eodhd→`AAPL.US`, coingecko→`bitcoin`, amfi_nav→a live scheme code, ecb_fx→`EUR/USD`, kite→`INFY`.

*Proposed free-first `DEFAULT_PRIORITY` (owner ratifies at build):*
`us_equity/sg_equity: [yahoo, alphavantage, eodhd, csv, manual]` ·
`in_equity: [yahoo, kite, alphavantage, eodhd, csv, manual]` ·
`crypto: [coingecko, yahoo, alphavantage, csv, manual]` ·
`fx: [ecb_fx, yahoo, alphavantage, cache]` · `global_fund: [yahoo, eodhd, alphavantage, statement,
manual]`. (Mutual-fund/bond/deposit/derivative lanes unchanged — no free market-quote source applies.)

Standing: two-commit records · both suite verdicts (declared seeds) · UTF-8-safe edits · never the
owner's live stack · NO PUSH · KB-sync from actual diff · normative questions STOP for chat.

---

## §-LEDGER (intake seeded at build time — TEMPLATE §8 / ai-surfaces §19-K)

A ledger may not claim CLOSED while any intake row lacks a disposition. Intake from Phase A:

| Row | Source | Item | Disposition |
| --- | --- | --- | --- |
| I-1 | §0-A / §0-B(i,ii) | AV entitlement-envelope parse-miss (root cause) collapsed into one "empty" message | **DISCHARGED — Phase 0 `e3dd4e7`** (tolerant `Global Quote*` parse + `_raw_fx` audit; fail-first RED on the real probe-#1 envelope, green after; genuine-empty probe-#5 still no-price). The *collapse into one message* half (distinct failure STATE) is Phase 2 (I-3). |
| I-2 | §0-B(iii) | No fetch-time fallback net — priority chain is display-only, never walked; yahoo never called | **DISCHARGED — Phase 1 `95df927`** (`fetch_chain` + `build_provider` + `_refresh_via_net`; pin-head-keep-net for override AND matrix; RED proved the net EXECUTED — yahoo fetched — not merely a price appeared; `no_key` lanes skipped). The **head=X/priced-by=Y SURFACE labelling** on Pricing Health lands in Phase 4 (data already carried via `source` vs `route_source`). |
| I-3 | §0-B(ii) | Distinct failures collapsed at three layers (adapter / refresh / cache) | **DISCHARGED — Phase 2** (Delta 2.1 `9d54f4f` adapter+refresh · Delta 2.2 backend `34974b6` persistence+row · Delta 2.2 frontend `c882648` drawer). Distinct causes typed adapter → refresh → pricing-health row → drawer; the flat "none" is gone. |
| I-4 | §0-B(i) | Two-premiums conflation — `av_tier` learns only from INDEX_DATA; Settings "premium" is a coarse config claim | **IN PROGRESS — Phase 2 Delta 2.1 `9d54f4f`** (backend: `quote_entitlement` learned from the envelope, distinct from `av_tier`). Remaining: the Settings verified-tier **display** → Phase 4 (rite). |
| I-5 | §0-A fan-out rider | 19-call refresh fan-out (overview proxies) vs AV per-sec/daily budget; free-first + holdings-first mitigates | **DISCHARGED — Phase 3 `2a9fa1e`** (holdings-before-proxies budget: `_display_symbols` (`system.py`) orders holdings → watchlist → overview/global proxies **deterministically** — they were previously merged in a set — and the budget walks in order and stops at the time budget, so a holding is never starved of a call by an overview proxy; `test_refresh_budget_order.py` asserts the seeded holding refreshes before any overview-only proxy. Free-first chain ordering (§9-6) keeps keyless lanes carrying load. Full-suite verdict **2135, both orders**.) *Row was mislabelled `OPEN → Phase 3` after Phase 3 shipped; corrected at the 2026-07-24 Phase-4 re-entry ledger↔records reconciliation.* |
| I-6 | §9-i | Duplicate TSLA instrument (id 22 / id 23) — **invariant question**: did the product permit the duplicate? If so, that is an architectural finding (root-cause it); owner cleans his live data via the UI once the cause is known | **CAUSE FOUND — 2026-07-24 Phase-4 re-entry reconciliation.** The assigned Phase-1 invariant probe **never ran** — Phase 1 closed (`95df927`/`ee07dd1`) without it; caught by the ledger↔records grep at re-entry (recorded here, **not aged silently**). **Root cause — the product DOES permit the duplicate, two compounding reasons:** (1) `uq_instr_symbol_exch = UniqueConstraint("symbol","exchange")` (`app/models/__init__.py:193`) does **not** stop two `(TSLA, NULL)` rows — SQL treats NULL as **distinct** in a UNIQUE constraint, and `exchange` is nullable (`:170`); (2) the two holding-creation get-or-create paths use **inconsistent lookup keys** — `market._get_or_create_instrument` (`app/services/market.py:1442`) matches `symbol.upper()` + exchange-only-if-truthy, while `csv_import` (`app/services/csv_import.py:472`) matches **bare `symbol` (NOT uppercased)**, no exchange filter. So a holding added once with `exchange=NULL` and again with an exchange set (or different casing) yields two independently-priced instruments — the live id-22 (`source_override`) / id-23 symptom, and why one prices while the other shows `(corrected)`. **No dedup/merge pass exists in the create paths.** **Disposition owed — §9-i scope fork surfaced to owner (2026-07-24):** fold a preventive guard into R-63 (data-integrity, R-63's own charter) **vs.** file a post-fence ROADMAP row (§9-10 feature-freeze). **OPEN until ruled;** rides to the 0a report if unresolved. Live-data cleanup remains the owner's via the UI (§9-i). |
| I-7 | §0-A log 13605 | Genuine transient throttle ("Burst pattern … 5 req/sec") — secondary contributor; surfaces as `throttled` | **DISCHARGED — Phase 2** (`RateLimited`→`THROTTLED` + `last_throttled_at`, real burst text `9d54f4f`; persisted `34974b6`; drawer renders "throttled — … will retry (last at T)" `c882648`, copy PROPOSED). |

### Accepted-surface RITE — consolidation (recorded explicitly per the owner ruling 2026-07-23)

R-63 changes two accepted surfaces across several deltas: **Pricing Health** (Phase 2 Delta 2.2 —
typed failure state + throttle-retry surface; Phase 5 — provider doctor) and **Settings → Data
feeds** (Phase 3 — free-first meaning shift; Phase 4 — verified-tier label + the recut routing
sentence). **Ruling (owner, 2026-07-23):** the guard-REDs-an-accepted-surface **rite obligations
(a dated delta note + a page pre-pass re-run) are discharged ONCE, at Phase 4, covering ALL R-63
deltas on each page** — provided (i) this consolidation is recorded now (it is), and (ii) any served
copy or visible-state change made ahead of Phase 4 is held **PROPOSED** and ratified at the 0a look.
Delta 2.2's new served strings (e.g. a throttle-retry line) ship as **PROPOSED**, GLOSSARY-first.

### Phase verdicts (full backend suite — the completion gate; a phase is not complete on a subset)

Verdict cadence (owner ruling 2026-07-23): mid-phase deltas may gate on (new tests both seeds) +
a stated domain subset as an INNER-LOOP signal, but a **phase is complete only when the FULL
backend suite passes ordered AND randomized (declared seeds)**; the close requires it regardless.

| Phase | Full-suite ordered (`-p no:randomly`) | Full-suite randomized (`--randomly-seed=6363`) |
| --- | --- | --- |
| **1 — execution net** (`95df927`) | **2121 passed, 15 skipped** (22:37) | **2121 passed, 15 skipped** (21:52) |
| **2 — failure taxonomy** (`9d54f4f`·`34974b6`·`c882648`) | **2130 passed, 15 skipped** (18:01, `--durations=30`) | **2130 passed, 15 skipped** (18:17) |
| **3 — free-first + budget** (`2a9fa1e`) | **2135 passed, 15 skipped** (17:16) | **2135 passed, 15 skipped** (17:09) |

**Phase 1 · 2 · 3 all COMPLETE** — each on the full-suite verdict (both orders), not a subset.
Reconciliation: 2121 → 2130 (+9, Phase 2) → **2135 (+5, Phase 3:** 3 free-first ordering + 1
budget counted-calls + 1 override-wins-keeps-net). Backend **2135 solo, ordered AND randomized**.
Help currency: **no impact, guard-corroborated** (Phase 3 is internal chain policy + refresh order;
the Settings "Market data provider" card meaning-shift copy is Phase 4, under the rite).

**Suite-count reconciliation:** **2121 → 2130 (+9)**, all attributable to R-63 Phase 2 tests:
Delta 2.1 — 6 taxonomy tests in `test_av_quote_envelope.py` (priced-no-state · empty · parse_error ·
throttled · errored · two-premiums) + 1 in `test_execution_net.py` (refresh carries the typed state);
Delta 2.2 — 1 in `test_execution_net.py` (persist-then-clear) + 1 in `test_pricing_health.py` (row
carries typed fields). Frontend tests (vitest `PricingHealth.test.tsx`, +1 drawer test) are not in
the backend count. Backend: **2130 solo, ordered AND randomized**.

**Contract line:** **141 paths / 71 schemas — unchanged** (`scripts/check_api_contract.py` clean).
`GET /portfolio/pricing-health` is declared **`-> dict` (UNTYPED)**, so the new
`failure_state`/`failure_at`/`failure_note` fields are **NOT contract-pinned** (0 occurrences in
`API-CONTRACT.json`) — the R-61/§3b discipline applies. The **served-shape pin** covering them is
`tests/integration/test_pricing_health.py::test_pricing_health_carries_typed_failure_state` (asserts
every row carries the fields and any state has a note) **plus** the frontend `PricingHealthDetail`
type + its vitest drawer test. ("api-contract current" alone is not the sentence — the pin is named.)

---

## 9. NEEDS DECISION — **CLOSED 2026-07-23 (owner one-pass, in chat).**

All twelve items resolved. Each disposition cites **"Chat ruling 2026-07-23 (§9 one-pass)"**; the
*Owner:* lines are his acceptance **verbatim** (his words, recorded, not paraphrased).

**§9-0 RESOLVED — BOTH: tolerant `Global Quote*` parse (the `_find_time_series` pattern) AND an
audit of every `entitlement` use.** Delayed data kept (entitled, fresher). **Rider:** fail-first
REDs use the **captured real envelopes** as committed fixtures — probe #1 (decorated) and probe #5
(genuine empty) — never hand-mocked. Chat ruling 2026-07-23 (§9 one-pass). *Owner:* "Accepted.
(Industry best practice: Utilizing captured, real-world API payloads as test fixtures prevents
blind spots caused by synthetic mocks; tolerant parsing ensures resilience against upstream schema
additions or entitlement flags)."

**§9-1 RESOLVED — (i) pin-head-keep-net, overrides AND matrix cells.** The execution fallback is
built **first** (the chain becomes real at fetch time; `no_key` lanes skipped). **Provenance
rider:** on a net catch, Pricing Health shows head=X, priced-by=Y. Chat ruling 2026-07-23 (§9
one-pass). *Owner:* "Accepted. (Industry best practice: Graceful degradation via fallback routing
is essential for resilience, provided strict data provenance is maintained so the user always sees
the true source of the rendered data)."

**§9-2 RESOLVED — all seven states confirmed** (`parse_error · throttled · unmapped · errored ·
empty · no_key · unsupported`): full taxonomy in the per-holding diagnostics drawer; coarser served
chip vocabulary at summary level. **Two-premiums fix included:** tier labels reflect **verified
capability per product**, never the coarse config claim. Chat ruling 2026-07-23 (§9 one-pass).
*Owner:* "Accepted. (Industry best practice: Granular observability and surfacing mathematically
verified capabilities rather than static configuration claims prevents false confidence)."

**§9-3 RESOLVED — PROPOSED copy at build, owner ratifies at the 0a look, GLOSSARY-first.** Chat
ruling 2026-07-23 (§9 one-pass). *Owner:* "Accepted. (Industry best practice: Glossary-driven
development ensures ubiquitous language across the codebase and user interface, eliminating semantic
drift)."

**§9-4 RESOLVED — provider doctor: on-demand button ONLY**; ≤1 egress call per lane per run, calls
counted on screen, verdicts redacted (key presence, reachability, known-symbol resolve — never the
key, never a holding's value); known-symbol set proposed in the plan (§8). **No network preflight
gates routing; the free `no_key` check DOES inform chain-walking.** Chat ruling 2026-07-23 (§9
one-pass). *Owner:* "Accepted. (Industry best practice: For privacy-first architectures, explicit
user consent for egress, strict rate-limiting, and redaction of sensitive telemetry are
non-negotiable security baselines)."

**§9-5 RESOLVED — fold into Stale; "forming" defers to R-42.** Chat ruling 2026-07-23 (§9
one-pass). *Owner:* "Accepted. (Industry best practice: Strict milestone boundary management and
scope containment prevent delivery delays caused by adjacent feature creep)."

**§9-6 RESOLVED — free-first within capability**; pattern ruled `us_equity: [yahoo, alphavantage,
eodhd, csv, manual]`; full per-lane tables PROPOSED in the plan (§8); explicit user matrix/override
wins over free-first BUT keeps the net (§9-1). **Riders:** refresh budget spends holdings before
overview proxies; the Settings "Market data provider" card's meaning shifts (single source →
preferred head) — its sentence changes under the rite. Chat ruling 2026-07-23 (§9 one-pass).
*Owner:* "Accepted. (Industry best practice: Optimizing API consumption by defaulting to free
tiers—while strictly respecting user-defined overrides and maintaining the fallback net—is the
standard for cost-efficient data orchestration)."

**§9-7 RESOLVED — the rite confirmed** for `page-pricing-health.md` AND `page-settings.md` (dated
delta notes + pre-pass re-runs). Chat ruling 2026-07-23 (§9 one-pass). *Owner:* "Accepted.
(Industry best practice: Adhering to established governance rites ensures zero regressions when
modifying previously ratified, stable surfaces)."

**§9-8 RESOLVED — shared identifier layer stays**; provider-specific transforms isolated at the
boundary only where demanded; `SYMBOL_SEARCH` mapping = ROADMAP candidate. Chat ruling 2026-07-23
(§9 one-pass). *Owner:* "Accepted. (Industry best practice: Implementing the Adapter Pattern to
maintain a unified internal domain model while isolating provider-specific transforms at the system
boundary)."

**§9-9 RESOLVED — surface it**: the `throttled` state + "last throttled at T — will retry" in
diagnostics; numeric budget meters deferred with the (g) candidates. Chat ruling 2026-07-23 (§9
one-pass). *Owner:* "Accepted. (Industry best practice: Transparently surfacing rate-limit
exhaustion and expected retry intervals prevents user confusion and duplicate requests)."

**§9-10 RESOLVED — fence confirmed.** §0-E files as ONE umbrella POST-RELEASE ROADMAP row (**R-64**
— next free R-number): "AV capability leverage — NEWS_SENTIMENT, fundamentals, corporate actions,
SYMBOL_SEARCH — decomposed when taken", citing §0-E + the committed reference doc. Chat ruling
2026-07-23 (§9 one-pass). *Owner:* "Accepted. (Industry best practice: Enforcing strict feature
freezes for current milestones and aggressively pushing non-critical enhancements to the
post-release roadmap)."

**§9-i RESOLVED — investigate the CAUSE in-build** (duplicate instruments as an invariant question:
if the product permitted id 22/23, that is a finding — ledger row I-6); the owner's live-data
cleanup is HIS, via the product UI, guided once the cause is known. Chat ruling 2026-07-23 (§9
one-pass). *Owner:* "Accepted. (Industry best practice: Treating invariant violations (duplicate
instruments) as critical architectural findings requiring root-cause analysis, while relying on
standard UI tools for user-side data remediation)."

**Sign-off: §9 CLOSED, no open blocker. Build begins at Phase 0 — the parse-miss RED on the real
probe-#1 envelope, first.**

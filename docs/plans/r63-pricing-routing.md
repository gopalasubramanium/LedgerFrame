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
- [x] **AC-5** On a net catch, Pricing Health shows **head=X, priced-by=Y** (provenance rider).
  *Red when:* the rendered source hides that a fallback fired.
- [ ] **AC-6** `no_key` lanes are **skipped** in the walk (never "stalled on"). *Red when:* an
  unkeyed lane is attempted and errors.

**Taxonomy + confidence (§9-2, §9-9).**
- [ ] **AC-7** All seven states (`parse_error · throttled · unmapped · errored · empty · no_key ·
  unsupported`) are distinguishable in the per-holding diagnostics drawer; the summary chip uses the
  coarser served vocabulary. *Red when:* any two are indistinguishable in the drawer.
- [ ] **AC-8** `throttled` surfaces "last throttled at T — will retry". *Red when:* a throttle
  reads as `empty`/`none`.
- [x] **AC-9** Tier labels reflect **verified capability per product** (quotes vs index), never the
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
- [x] **AC-13** Provider doctor is an **on-demand button**, spends **≤1 egress call per lane per
  run**, **counts calls on screen**, verdicts **redacted** (key presence / reachability /
  known-symbol resolve — never the key, never a holding value). *Red when:* it auto-runs, exceeds
  the budget, or leaks a secret/value.
- [x] **AC-14** The doctor **would have caught this bug** — a lane returning 200-with-data that
  parses empty reports **FAIL (parse)**, not PASS. *Red when:* a parse-empty lane reports healthy.

**Instrument-identity guard (I-6, §9-i ADDENDUM — Phase 3.5).** *(All met — `e7a7e94`.)*
- [x] **AC-19** New-dupe prevention is **absolute at the code layer**: a single identity resolver
  is used by **all** instrument-create paths (the two former keys — `market._get_or_create_instrument`
  `symbol.upper()`+optional-exchange, and `csv_import`'s bare non-uppercased `symbol` — collapse to
  one). *Red when:* a create path resolves identity by any other key, or a second `(TSLA, NULL)` /
  case-variant row is creatable through the real path. (Fail-first through the **real** get-or-create,
  not a synthetic uniqueness test — §9-i ADDENDUM rider 4.)
- [x] **AC-20** The DB uniqueness gap is closed where data permits: a functional guard treats
  `exchange=NULL` and a set exchange under the same symbol as **one** identity bucket (NULL is no
  longer distinct). *Red when:* two rows with the same `upper(symbol)` and equivalent exchange
  (NULL≡NULL) coexist on a clean DB.
- [x] **AC-21** The migration is **dupe-tolerant** (hard rider 3): on a DB that already contains
  duplicates it **does not fail/brick** — it binds fully where data permits and **surfaces** the
  existing duplicates instead. *Red when:* the migration raises on pre-existing duplicate data
  (migration-chain test on a seeded-dupe DB).
- [x] **AC-22** Existing duplicates are **surfaced** ("duplicate instruments — resolve on Holdings",
  copy PROPOSED, GLOSSARY-first) so the owner can clean them via the UI; the guard makes recurrence
  impossible thereafter. *Red when:* a pre-existing duplicate is neither blocked-at-source nor
  surfaced (silent).

**Standing.**
- [ ] **AC-15** **Blindness pins** on every new guard (a guard that protects nothing fails loudly).
- [ ] **AC-16** Help Currency Law: Pricing Health + Settings routing copy deltas shipped, or
  guard-corroborated "no impact".
- [x] **AC-17** Accepted-surface **rite** discharged for **Pricing Health** and **Settings**
  (dated delta note + pre-pass re-run each — §9-7). Delta notes written 2026-07-24; **pre-pass re-runs
  DONE 2026-07-24** (both pages, both themes, 0 non-benign console errors, screenshots looked at,
  back-linked into both delta notes). See the SESSION record at the tail.
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
- **Phase 3.5 — the instrument-identity guard (I-6, §9-i ADDENDUM, folded 2026-07-24).** **Two
  fixes only** (rider 2): **(a)** unify the get-or-create lookup keys behind **one identity resolver**
  used by every create path (F6 — two keys for one identity is the defect); **(b)** close the
  NULL-exchange uniqueness gap (functional index / equivalent). **Dupe-tolerant migration** (rider 3):
  binds fully where data permits, and on a DB that already holds duplicates it **surfaces** them
  ("duplicate instruments — resolve on Holdings", PROPOSED copy) instead of failing. Fail-first: the
  RED reproduces the NULL-exchange dupe through the **real** path (both former key shapes); migration-
  chain tests cover the dupe-tolerant path; blindness pin. **Lands before Phase 4's pre-pass re-runs**
  (rider 6); full-suite pair at completion. Discharges ledger I-6 (AC-19..22).
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
| I-4 | §0-B(i) | Two-premiums conflation — `av_tier` learns only from INDEX_DATA; Settings "premium" is a coarse config claim | **DISCHARGED — Phase 2 Delta 2.1 `9d54f4f` (backend) + Phase 4 `7ef6f15` (display).** Backend: `quote_entitlement` learned from the GLOBAL_QUOTE envelope, distinct from `av_tier`. Display: `/system/data-source` now serves `quote_entitlement`; the Settings provider table shows capability **per product** — "Quotes: delayed" (verified) / "Indices: premium" (Index Data) — so a coarse "premium" never stands in for a merely-delayed quote entitlement (AC-9). Served-shape pin `test_data_source::…serves_verified_quote_entitlement_distinct_from_index_tier` + the Settings vitest verified-tier assertion. Copy PROPOSED (0a). |
| I-5 | §0-A fan-out rider | 19-call refresh fan-out (overview proxies) vs AV per-sec/daily budget; free-first + holdings-first mitigates | **DISCHARGED — Phase 3 `2a9fa1e`** (holdings-before-proxies budget: `_display_symbols` (`system.py`) orders holdings → watchlist → overview/global proxies **deterministically** — they were previously merged in a set — and the budget walks in order and stops at the time budget, so a holding is never starved of a call by an overview proxy; `test_refresh_budget_order.py` asserts the seeded holding refreshes before any overview-only proxy. Free-first chain ordering (§9-6) keeps keyless lanes carrying load. Full-suite verdict **2135, both orders**.) *Row was mislabelled `OPEN → Phase 3` after Phase 3 shipped; corrected at the 2026-07-24 Phase-4 re-entry ledger↔records reconciliation.* |
| I-6 | §9-i | Duplicate TSLA instrument (id 22 / id 23) — **invariant question**: did the product permit the duplicate? If so, that is an architectural finding (root-cause it); owner cleans his live data via the UI once the cause is known | **CAUSE FOUND — 2026-07-24 Phase-4 re-entry reconciliation.** The assigned Phase-1 invariant probe **never ran** — Phase 1 closed (`95df927`/`ee07dd1`) without it; caught by the ledger↔records grep at re-entry (recorded here, **not aged silently**). **Root cause — the product DOES permit the duplicate, two compounding reasons:** (1) `uq_instr_symbol_exch = UniqueConstraint("symbol","exchange")` (`app/models/__init__.py:193`) does **not** stop two `(TSLA, NULL)` rows — SQL treats NULL as **distinct** in a UNIQUE constraint, and `exchange` is nullable (`:170`); (2) the two holding-creation get-or-create paths use **inconsistent lookup keys** — `market._get_or_create_instrument` (`app/services/market.py:1442`) matches `symbol.upper()` + exchange-only-if-truthy, while `csv_import` (`app/services/csv_import.py:472`) matches **bare `symbol` (NOT uppercased)**, no exchange filter. So a holding added once with `exchange=NULL` and again with an exchange set (or different casing) yields two independently-priced instruments — the live id-22 (`source_override`) / id-23 symptom, and why one prices while the other shows `(corrected)`. **No dedup/merge pass exists in the create paths.** **RULED — CHAT 2026-07-24 (§9-i ADDENDUM): OPTION 1, FOLDED INTO R-63**, six riders (see §9-i ADDENDUM). Fix = (a) unify get-or-create lookup keys (F6 principle) + (b) close the NULL-exchange gap via a **dupe-tolerant** migration that binds where data permits and **surfaces** existing dupes ("resolve on Holdings") rather than bricking a live upgrade. **DISCHARGED — Phase 3.5 `e7a7e94`.** Fix (a): `app.services.identity.resolve_or_create_instrument` — one identity resolution (lookup key = DB uniqueness key: `upper(symbol)`+exchange, NULL≡NULL); every create path routes through it (`market._get_or_create_instrument` delegates; `csv_import`, watchlists ×2, markets overview call it). Fix (b): functional UNIQUE index `uq_instr_identity_ci` on `(upper(symbol), coalesce(exchange,''))` — create_all on fresh DBs + a **dupe-tolerant** best-effort migration (`a1e6c3f92d47`, mirrors ratified `f8c2a1b3d704`) that does NOT brick a live DB holding the dupe; `GET /system/instrument-duplicates` + a **Pricing Health banner** ("Resolve on Holdings", PROPOSED) surface any pre-existing pair. Fail-first through the real path (`test_instrument_identity_guard.py`: guard-off reproduces the two-`(TSLA,NULL)`-rows bug + surface; guard-on blocks the NULL/case twin; both former keys resolve to ONE row; migration dupe-tolerance; blindness pin asserts the index exists). Owner's live-data cleanup remains HIS via the UI (§9-i); the 0a report carries it as his action item with the Holdings/Pricing-Health surface showing the pair. **Note:** the guard makes concurrent first-creates of a NEW symbol a real serialization point, which raises the back-to-back flake rate of the inherently-flaky F-10 test `test_concurrent_first_load_does_not_race_on_repair_markers` (clean HEAD ~50% back-to-back; passes in file/suite context) — recorded in the verdict section, re-run per project F-10 practice. |
| I-7 | §0-A log 13605 | Genuine transient throttle ("Burst pattern … 5 req/sec") — secondary contributor; surfaces as `throttled` | **DISCHARGED — Phase 2** (`RateLimited`→`THROTTLED` + `last_throttled_at`, real burst text `9d54f4f`; persisted `34974b6`; drawer renders "throttled — … will retry (last at T)" `c882648`, copy PROPOSED). |
| I-8 | 0a walk finding **F-A** (2026-07-24) | Manual holdings render the code token **`null (head manual)`** on the Pricing Health Source column (§11-I — a raw null on a served surface; the netCaught head-rider on a null `source`) | **DISCHARGED — `05be910`** (owner ruled FIX-IN-R-63). `portfolio.py` serves **`source="manual"`** for a manual holding (`diag is None`), matching its `route_source="manual"` → the Source column renders `manual`, never `null (head manual)`. Backend-only (frontend renders the served `source` verbatim; vitest fixture already used `source:"manual"`). Copy **PROPOSED**. Test `test_pricing_health.py::test_manual_holdings_serve_a_source_word_never_null`. **Frame refreshed at the close's final specimen set** (owner ruling); dated note in `page-pricing-health.md`. |
| I-9 | 0a walk finding **F-B** (2026-07-24) | Provider error text can **echo the API key into the server log** — AV's error body quotes the submitted key verbatim, and an httpx URL error carries `apikey=<KEY>` (§8 secrets) | **DISCHARGED — `05be910`** (owner ruled FIX-BEFORE-CLOSE). `ExternalMarketDataProvider._redact()` scrubs the configured key from **all five** `log.warning("AV …")` sites (both the error-body echo AND the URL form). `get_quote` never raises (catches → `_no_quote`), so no key-bearing exception escapes to an unredacted logger (doctor included). Tests (log-capture, fake key, blindness pin): `test_av_quote_envelope.py::{test_quote_error_…, test_index_error_… (the observed path), test_urlembedded_apikey_form_…}` — the last asserts the **URL-embedded `apikey=<KEY>`** form specifically resolves to `apikey=***REDACTED***`. |
| I-10 | 3b live walk finding **F-C** (2026-07-24) | On the owner's LIVE instance **AARK** served **priced-by=`mock`** at **Confidence 100 · high** with **head=`alphavantage`**, and `mock` is **not in the drawer's priority chain** — a fabricated-confidence / phantom-source class (a settled real number was never produced, yet the row reads high-confidence from a source the chain never lists) | **DIAGNOSED — Phase A DONE 2026-07-24 (see the F-C PHASE A section below); STILL OPEN pending the architect/owner fix ruling + Phase B.** Root cause PROVEN on an isolated instance (repro reproduced the owner's exact number **109.878669**): **NOT** the assumed provider lazy-import degrade, **NOT** a chain fallthrough to a `mock` lane. The execution net legitimately walks the **`csv`** lane (keyless, covers etf, in the `us_equity` chain), and the CSV provider **silently substitutes mock on a CSV miss** (`csv_provider.py:64-67` → `self._mock.get_quote()` returns `source="mock"`, price = mock's default base 100 × `_walk` ≈ 109.88, entitlement `delayed`, fresh). The net writes `source="mock"`; confidence scores by the ROUTE's `valuation_method="market_quote"` (head=alphavantage, active-in-chain) → base 100, no penalty → **100/high**; badge `delayed` = mock's own entitlement. Provenance recorded the TRUTH (head=alphavantage / priced-by=mock) — the R-63 provenance work is what made it seeable. **Fix scope = numbered options in the F-C PHASE A section → HARD STOP for the ruling.** Its session also carries the **"Source override" rename** (§4, DONE `96d9e4b`). |
| I-11 | 3b scope-addendum finding **F-D** (architect, 2026-07-24) | On the owner's real key the verified-tier cell read **"Quotes: not yet verified / Indices: premium"** after a session that DID parse a real GLOBAL_QUOTE (pre-purge TSLA) — the two learned tiers disagree | **DIAGNOSED (diagnose-only, 2026-07-24; see the F-D section below). No fix code — persistence semantics are an owner ruling.** Both tiers are **per-process instance state** on the `get_provider()` singleton, **not persisted** (`external.py:126,131`; wiped by restart / `reset_provider` on a settings change). The asymmetry is structural: **`av_tier` (Index Data) is learned by an ON-DEMAND probe the `/system/data-source` endpoint fires itself** (`system.py:145-146` → `get_quote("DJI")` → `_index_quote` → `_index_entitled=True`), so merely LOADING Settings→Data feeds learns "premium" — no holdings needed; **`quote_entitlement` (GLOBAL_QUOTE) has NO probe** — it is learned only as a passive side-effect of a real holding refresh parsing a quote (`external.py:276`), and the DJI probe **bypasses** it (indices route through `_index_quote`, never `_note_quote_entitlement` — `external.py:247-248,221`). The architect's candidate is **CONFIRMED**: post-purge **zero holdings ⇒ the refresh path fires zero GLOBAL_QUOTE calls ⇒ `quote_entitlement` stays `None`** ("not yet verified") while the self-probing `av_tier` shows premium. Owner ruling owed: persist `quote_entitlement`, and/or fire a quote-side verification probe symmetric with the index one. Dispositions with F-C. |

### Accepted-surface RITE — consolidation (recorded explicitly per the owner ruling 2026-07-23)

R-63 changes two accepted surfaces across several deltas: **Pricing Health** (Phase 2 Delta 2.2 —
typed failure state + throttle-retry surface; **Phase 3.5 — the duplicate-instrument banner, I-6**;
Phase 5 — provider doctor) and **Settings → Data feeds** (Phase 3 — free-first meaning shift;
Phase 4 — verified-tier label + the recut routing sentence). **Ruling (owner, 2026-07-23):** the guard-REDs-an-accepted-surface **rite obligations
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
| **3.5 — instrument-identity guard** (`e7a7e94` + hardening `e2ab16e`) | **2143 passed, 15 skipped** (17:43) | **2143 passed, 15 skipped** (17:07, seed 6363) |
| **4 + 5 — surface deltas + provider doctor** (`7ef6f15` · `b72ee18`) | **2150 passed, 15 skipped** (16:48) | **2150 passed, 15 skipped** (17:05, seed 6363) |

**Phase 1 · 2 · 3 · 3.5 all COMPLETE** — each on the full-suite verdict (both orders), not a subset.
**Phase 3.5 reconciliation:** 2135 → **2143 (+8):** 7 in `test_instrument_identity_guard.py`
(guard-off dupe repro + surface · NULL-twin blocked · case-variant blocked · distinct-listing allowed ·
market+csv resolve to one · concurrent-create recovery · migration dupe-tolerance) + 1
`test_resolver_recovers_from_locked_writer` (the hardening). Backend **2143 solo, ordered AND
randomized (seed 6363)**; the first-run spillover is gone on the hardened code (0 errors both orders).
Reconciliation: 2121 → 2130 (+9, Phase 2) → **2135 (+5, Phase 3:** 3 free-first ordering + 1
budget counted-calls + 1 override-wins-keeps-net). Backend **2135 solo, ordered AND randomized**.
Help currency: **no impact, guard-corroborated** (Phase 3 is internal chain policy + refresh order;
the Settings "Market data provider" card meaning-shift copy is Phase 4, under the rite).

**Phase 3.5 (I-6 guard, `e7a7e94`) — verdict IN PROGRESS.** Expected count +7 (the new
`test_instrument_identity_guard.py`): **2135 → 2142**. Inner-loop signals already green: new tests
**7/7** (`-p no:randomly`); rewired-path regression **36 passed** (identity/csv/imports/markets/
execution-net/routing); PricingHealth vitest **17/17**; `tsc` clean; `ruff` clean.

> **⚠ CORRECTION — 2026-07-24 (never age silently, the I-5 precedent).** This "Expected count **+7** →
> 2142" was WRONG: Phase 3.5 landed **+8 → 2143** (the extra is the `e2ab16e` hardening test
> `test_resolver_recovers_from_locked_writer`, filed the same phase). The FINAL verdict table above and
> the close reconciliation (2135 → 2143, +8) both correctly record **+8**; this in-progress line is left
> as history with this dated correction so the estimate does not read as the ratified count.
**Concurrency contention — FOUND and HARDENED (`e2ab16e`).** The identity guard makes a concurrent
first-create of the SAME new symbol a real serialization point. The **first ordered full-suite run
on `e7a7e94`** (**2141 passed, 15 skipped, 1 error**) surfaced ONE flaky **spillover**: a losing
request's INSERT could not take SQLite's writer lock within `busy_timeout` and raised
`OperationalError('database is locked')`, which 500'd the request AND stranded the lock so the
**next** test's clean-slate `DROP TABLE transactions` also failed (`test_backfill`). It was
**non-deterministic** (0/3 in a targeted repro of the concurrency-test→backfill pair). Root fix:
`resolve_or_create_instrument` now treats that `OperationalError` as the lost race it is — re-reads
the committed winner (a WAL read needs no writer lock), re-raising only if the row is genuinely
absent. Isolated from the unchanged `IntegrityError` path so it cannot regress it; covered by
`test_resolver_recovers_from_locked_writer` (deterministic). **Measured on the F-10 stress test
`test_concurrent_first_load_does_not_race_on_repair_markers`: back-to-back 1/5 → 5/5 pass, ~40s →
~17s** (losers stop waiting out `busy_timeout`). *(R-65's per-worker DB isolation still addresses the
shared-clean-slate root; this fix removes R-63's contribution.)* Re-verdict owed on the final code
(`e2ab16e`) below.

**Suite-count reconciliation:** **2121 → 2130 (+9)**, all attributable to R-63 Phase 2 tests:
Delta 2.1 — 6 taxonomy tests in `test_av_quote_envelope.py` (priced-no-state · empty · parse_error ·
throttled · errored · two-premiums) + 1 in `test_execution_net.py` (refresh carries the typed state);
Delta 2.2 — 1 in `test_execution_net.py` (persist-then-clear) + 1 in `test_pricing_health.py` (row
carries typed fields). Frontend tests (vitest `PricingHealth.test.tsx`, +1 drawer test) are not in
the backend count. Backend: **2130 solo, ordered AND randomized**.

**Contract line (through Phase 3.5):** **142 paths / 71 schemas** — was 141/71; **+1 path**
(`GET /system/instrument-duplicates`, Phase 3.5), regenerated `API-CONTRACT.json` + `docs/openapi.json`
in the same delta (`e7a7e94`). **0 new schemas** — the endpoint is declared **`-> dict` (UNTYPED)**,
mirroring `/system/identifier-duplicates` and `/portfolio/pricing-health`, so its shape is **NOT
contract-pinned** (R-61/§3b discipline). Its **served-shape pins** are the backend
`test_instrument_identity_guard.py::test_guard_off_reproduces_the_duplicate` (asserts the
`duplicate_instruments` shape: `symbol`/`exchange`/`instrument_count`/`instruments[]`) **plus** the
frontend `InstrumentDuplicatesResp` type + its PricingHealth vitest banner test. Earlier: the Phase-2
`GET /portfolio/pricing-health` is also `-> dict`, its `failure_state`/`failure_at`/`failure_note`
pinned by `test_pricing_health.py::test_pricing_health_carries_typed_failure_state` + the frontend
`PricingHealthDetail` type. ("api-contract current" alone is not the sentence — the pins are named.)

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

**§9-i ADDENDUM — CHAT RULING 2026-07-24 (I-6 fix scope, at the Phase-4 re-entry).** The Phase-4
re-entry reconciliation found the assigned Phase-1 invariant probe had **never run** and root-caused
I-6 (the product permits the duplicate; see the I-6 ledger row). The scope fork — fold a preventive
guard into R-63 vs. file a post-fence ROADMAP row — was put to the owner. **RULED: OPTION 1 — FOLDED
INTO R-63**, six riders (echoed verbatim-intent):
1. **In-charter, not creep** — §9-10's fence was built against **feature** leverage
   (news/fundamentals); a data-integrity guard on instrument identity is the charter's core
   (*"data is the core… once and for all"*), and §9-i already classed invariant violations as
   critical architectural findings. Phase A found the duplicate **inside** the pricing diagnosis.
2. **Scope, tight** — exactly **two** fixes: **(a)** unify the inconsistent get-or-create lookup keys
   (one identity resolution — the F6 principle: two keys for one identity is the whole defect);
   **(b)** close the NULL-exchange gap in the uniqueness constraint (functional index or equivalent).
   Nothing else rides.
3. **The migration MUST be dupe-tolerant (hard rider)** — the owner's live DB contains id-22/23
   today; a unique index that fails to create on existing data would **brick a live upgrade**.
   New-dupe prevention is **absolute at the code layer immediately**; the constraint **binds fully
   where data permits**; where existing duplicates exist, the instance **SURFACES** them
   (*"duplicate instruments — resolve on Holdings"*) instead of failing. Live cleanup stays the
   owner's via the UI (§9-i unchanged). After his cleanup + this guard, recurrence is impossible.
4. **Fail-first + blindness pin** — the RED reproduces the NULL-exchange duplicate through the
   **real** get-or-create path (both former key shapes), proving the guard blocks the door the dupe
   actually walked through — not a synthetic uniqueness test. Migration-chain tests cover the
   dupe-tolerant path.
5. **I-6 discharges here**; the 0a report notes the owner's pending UI cleanup as his action item,
   with the Holdings surface showing him the pair.
6. **Sequencing** — this sub-delta (**Phase 3.5**) lands **before** Phase 4's pre-pass re-runs (so
   the rite's drives run on guarded code); full-suite pair at its completion per the cadence rule.

*Owner reversal, one-liner:* "I-6 post-fence instead." *(Owner:* CHAT RULING 2026-07-24.)

**Sign-off: §9 CLOSED, no open blocker. Build begins at Phase 0 — the parse-miss RED on the real
probe-#1 envelope, first.**

---

## SESSION-END HANDOFF — 2026-07-24 (unattended run) — REMAINING: pre-pass re-runs + 0a specimens

**Status: Phases 0–5 are CODE-COMPLETE and verdict-backed.** Every backend/frontend delta is
committed and gated; the accepted-surface **rite delta notes are written** (page-pricing-health.md,
page-settings.md, 2026-07-24). **Remaining for R-63:** the rite's second obligation — the **pre-pass
re-runs** (Pricing Health + Settings) — and the **0a specimen cut**. Both are browser-driven on an
isolated stack. **Not attempted this run** by the unattended-run rule *"a clean partial beats a
degraded full"* + the harness's documented fragility (memory `prepass-harness`) against a deep
context. This block tees the next pass so it runs cleanly with full budget.

**Harness (memory `prepass-harness`, the load-bearing points):** backend `uvicorn app.main:app
--port 8399` with OS-env `LEDGERFRAME_DATA_DIR=<temp>` + `LEDGERFRAME_DEMO_SEED=true` +
`LEDGERFRAME_SECRET_KEY=…` (`setsid … & disown`); Vite dev 5199 via a throwaway
`frontend/vite.prepass.config.ts` (proxy `/api`+`/health`→`:8399`) — **delete before staging**;
snapshot the repo-root `.env`, restore + hash-verify **from repo root** after; driver `.mjs`
**inside `frontend/`** — delete before staging; HashRouter deep links (`#/pricing-health`,
`#/settings?tab=data-feeds`, `#/holdings`); dismiss first-run (`aria-label="Dismiss setup"`) or
`PUT /settings {values:{first_run_complete:"true"}}`; unlock reads with `POST /api/v1/legal/acceptance
{"action":"accepted"}`; **both themes**; force a fresh mount between findings (`about:blank`→target);
teardown by port (`ss -ltnp | grep :PORT`), verify by probe.

**Pre-pass re-run (rite obligation):** Pricing Health + Settings, both themes, **0 non-benign console
errors**, screenshots looked at → **back-link into the two 2026-07-24 delta notes.** Achievable on the
plain demo seed (both pages render; the recut Settings copy shows; the doctor card is present; the
free-first chain leads yahoo).

**0a specimens (item 4) — file ↔ seeding ↔ ruling it ratifies:**
1. **Settings routing sentence + provider-card meaning** `r63-0a-settings-routing-{light,dark}.png` —
   NO seeding; render `#/settings?tab=data-feeds`. Ratifies §9-1 + §9-6.
2. **Verified-tier display** `r63-0a-settings-verified-tier-{light,dark}.png` — needs
   `/system/data-source` → `quote_entitlement:"delayed"` + `av_tier:"premium"`. On the mock demo both
   are null → cell reads "Quotes: not yet verified". To show the two-product cell: (a) stub the
   endpoint in the drive, or (b) capture on the owner's live AV instance. Ratifies I-4 / AC-9.
3. **Free-first chain display** `r63-0a-pricing-chain-{light,dark}.png` — NO seeding; Pricing Health →
   a holding's Details dialog → chain leads yahoo. Ratifies §9-6.
4. **head=X / priced-by=Y net-catch row** `r63-0a-pricing-headpricedby-{light,dark}.png` — SEED a
   quote where `route_source` (head) ≠ `source` (priced-by): a `QuoteRefresh`/`quotes` row with
   `route_head='alphavantage'`, stored `source='yahoo'` for a seeded holding → the Source column
   renders "yahoo (head alphavantage)". Ratifies §9-1 / AC-5.
5. **Failure-state drawer copy** `r63-0a-pricing-failstates-{light,dark}.png` (throttled "last at T ·
   will retry" · empty · parse_error · no_key · unsupported) — SEED per-holding quote rows with
   `last_failure_state` + `last_failure_at` set to each state; open the drawer per row. Ratifies §9-2 +
   §9-9.
6. **Provider-doctor panel — call counter + a FAIL** `r63-0a-doctor-{light,dark}.png` — on the demo
   (no keys, egress on) the doctor shows `no_key`/`proposed` lanes + "0 live calls" — NO FAIL. To show
   a FAIL + a non-zero counter: stub `POST /portfolio/provider-doctor` in the drive to return a lane
   with `verdict:"fail"` + `total_calls≥1`, OR run on the owner's live keyed instance (where the AV
   lane's parse class shows). Ratifies §9-4 / AC-13 / AC-14.
7. **Holdings duplicate surfacing** `r63-0a-holdings-dup-{light,dark}.png` — SEED a duplicate pair:
   raw-insert a second `(TSLA, NULL)` row into the isolated DB **bypassing the resolver** (the guard
   blocks new dupes; insert before `uq_instr_identity_ci` binds, or via raw SQL) → the Pricing Health
   dup banner + Holdings show the pair. Ratifies I-6 / §9-i (the owner's own live cleanup stays his).

Then: the specimen table (file ↔ on camera ↔ ruling) in the report; **STOP for the owner's look. Do
NOT proceed to 3a.** **R-65 Phase 2 (queue item 5) was dropped this run** (the work order's droppable
overflow), still slotted after the R-63 close.

---

## SESSION — 2026-07-24 (focused) — PRE-PASS RE-RUNS + 0a SPECIMEN CUT — DONE → HARD STOP

The rite's second obligation and the 0a specimen cut, browser-driven on an isolated stack. **No product
code changed** (records + assets only). Re-entry state: HEAD `b329027`, tree clean, ledger↔records
reconciled by grep (I-1..I-7 all DISCHARGED). Next after the owner's look: **3a scripted pre-pass →
3b owner walk on his LIVE symptoms → close**. **Not started this session (HARD STOP).**

### Isolation harness (confirmed torn down)
Temp `LEDGERFRAME_DATA_DIR`; backend `uvicorn :8399`; Vite dev `:5199` (throwaway `vite.prepass.config.ts`)
→ backend; driver `.mjs` inside `frontend/`. **The owner's live stack (:8321/:5173/`~/.ledgerframe-data`)
and his AlphaVantage key were never used** — his key was **overridden to `INVALID-DOCTOR-TEST`** via OS
env (the repo-root `.env` carries his real key; OS-env override kept it out of the run). Repo-root `.env`
snapshotted and **hash-verified identical** (`460a2da0…afae6`) before and after. **Teardown verified by
probe:** ports 8399/5199 free; throwaway driver + `vite.prepass.config.ts` deleted; owner ports never
bound. **Both themes; 0 non-benign console errors** on every drive.

> **⚠ Isolation note, recorded (not hidden):** the FIRST Config-A boot inadvertently **inherited the
> owner's real AV key from `.env`** (only DATA_DIR/DEMO_SEED/SECRET_KEY were OS-overridden), and one
> `markets/global` index fetch ran with it (learned `av_tier=premium` — read-only market data, his temp
> DB never mutated, same egress class as Phase A's deliberate probe). Caught at the verified-tier
> specimen (it showed his entitled *"Indices: premium"*). **The stack was torn down and the entire run
> re-driven with the key overridden to `INVALID-DOCTOR-TEST`** so his credential is never used and the
> entitled readout is correctly **deferred to his 3b** (ruling #1). All committed specimens are from the
> clean re-drive.

### The three specimen rulings (chat 2026-07-24) — applied, echoed
1. **Verified tier — NO STUB.** Captured the honest isolated state **"Quotes: not yet verified /
   Indices: free"** (nothing verified this process on a non-entitled test key). The **entitled
   two-product cell** (*"Quotes: delayed / Indices: premium"*) needs his real premium key → **DEFERRED
   to 3b** (recorded here + in `page-settings.md`). *(Handoff premise "both-null → not yet verified" was
   corrected on camera: both-null renders an em dash `—`; "not yet verified" needs a truthy index tier,
   which the invalid test key supplies as `free`.)*
2. **Doctor FAIL — PRODUCED FOR REAL.** Seeded `INVALID-DOCTOR-TEST`; ran the doctor with egress on →
   **3 live calls, `alphavantage` verdict=FAIL (calls=1)**, `yahoo`/`eodhd` FAIL "reached, parsed empty"
   (AC-14 on camera), `kite` no_key, proposed lanes. **Redacted — the key is absent from the doctor
   response** (verified: `INVALID-DOCTOR-TEST ∉ response JSON`). Also captured the honest **no-egress**
   panel (0 calls, all `skipped_no_egress`).
3. **Duplicate — raw-SQL LEGITIMATE.** Dropped `uq_instr_identity_ci`, raw-inserted a second `(TSLA,
   NULL)` row — reproducing the **pre-guard legacy state** the owner's live DB holds (his id-22/23); here
   id-6 + id-39. The guard blocks NEW dupes while history enters through this raw path — exactly what the
   banner surfaces. Rationale recorded.

### Specimen table (file ↔ on camera ↔ ruling ratified) — all in `docs/plans/assets/`, both themes
| # | File(s) `…-{light,dark}.png` | On camera | Ratifies |
| --- | --- | --- | --- |
| — | `r63-prepass-pricing-health-*`, `r63-prepass-settings-datafeeds-*` | full-page rite re-walk; 0 console errors | **AC-17 rite** |
| 1 | `r63-0a-settings-routing-*`, `r63-0a-settings-provider-head-*` | recut Routing-matrix sentence (verbatim); "preferred head lane / free-first chain" card | §9-1 + §9-6 |
| 2 | `r63-0a-settings-verified-tier-*` | "Quotes: not yet verified / Indices: free" (honest; entitled cell → 3b) | I-4 / AC-9 (ruling 1) |
| 3 | `r63-0a-pricing-chain-*` | AAPL Details: chain **leads `1. yahoo`**, `eodhd (no key)` muted | §9-6 |
| 4 | `r63-0a-pricing-headpricedby-*` (+ prepass PH) | Source col **`yahoo (head alphavantage)`**, `yahoo (head mock)` (matrix), `coingecko` | §9-1 / AC-5 |
| 5 | `r63-0a-pricing-failstate-{throttled,empty,parse_error,no_key,unsupported,unmapped}-*` | typed drawer per state + served note; **throttled "will retry (last at T)"** | §9-2 + §9-9 |
| 6 | `r63-0a-doctor-fail-*`, `r63-0a-doctor-noegress-*` | egress-on **3 calls / AV FAIL / redacted**; no-egress **0 calls / all skipped** | §9-4 / AC-13 / AC-14 (ruling 2) |
| 7 | `r63-0a-dup-banner-*` | "1 duplicate instrument — TSLA … new duplicates can no longer be created" | I-6 / §9-i (ruling 3) |

### Deferred to the owner's 3b (his LIVE keyed instance) — explicit
- **The verified-tier ENTITLED two-product cell** — *"Quotes: delayed / Indices: premium"* — needs his
  real premium AV key (ruling 1). 0a shows only the honest not-verified state.
- **His live duplicate cleanup** — resolving his own TSLA id-22/23 via the Holdings UI (§9-i unchanged);
  the guard makes recurrence impossible thereafter.
- **His live Refresh on his real symptoms** (TSLA / SBICARD.BSE / AARK) — proving the parse-fix + the
  execution net actually price them on his instance (the milestone's origin).

### Findings raised for the 0a look (recorded, NOT fixed this session — owner rules disposition)
- **F-A — manual holdings render `null (head manual)` in the Source column.** A manual holding has a null
  `source`; the R-63 Phase-4 netCaught branch (`route_source !== source` → `"Y (head X)"`) appends
  `(head manual)` and renders the null as the literal string `"null"`. Cosmetic, on the PROPOSED
  head/priced-by copy. Candidate fix: suppress the head-rider (or the whole cell) when `source` is
  null/manual. *Seen on `r63-prepass-pricing-health-*` (the manual rows).*
- **F-B — the AV adapter logs AlphaVantage's error text verbatim, which can echo the submitted key.** On
  an index fetch with a bad key, AV returns *"We have detected your API key as <KEY> …"* and
  `app.providers.market.external` logs it at WARNING → a **real key could land in
  `~/.ledgerframe-data/logs/`**. The provider-doctor **response** is redacted (AC-13 holds — verified);
  this is a **separate, pre-existing adapter logging behavior** surfaced by this run. Candidate: redact
  `apikey`/key-shaped tokens from provider error strings before logging. *(Filed for the owner —
  disposition his: fold a redaction into R-63, or file to R-58/R-64.)*

**HARD STOP for the owner's look, walked in chat. Do NOT proceed to 3a. Expect 1–3 revision loops.**

---

## SESSION — 2026-07-24 (LOOP-2) — 0a WALK RULING applied; re-cut frames → next look

The owner walked the 0a (chat 2026-07-24) and ruled. No further product behavior changed beyond the
one W-b copy/state fix below. Re-cut frames only (ruling 5). **Next: loop-2 look → 3a → owner 3b → close.**

### Ruling 1 — RATIFIED AS WALKED (owner, by looking)
The **recut Settings sentences** (routing-matrix sentence + "Market data provider" preferred-head card),
**head=X / priced-by=Y provenance**, the **five failure-state drawer copies** (throttled/empty/parse_error/
no_key/unsupported — the sixth, `unmapped`, also walked), the **duplicate-instrument banner**, the
**verified-tier truthful demo state** ("Quotes: not yet verified / Indices: free"), and the **no-egress
doctor copy** are **RATIFIED**. Dated ratification notes appended to `page-pricing-health.md` and
`page-settings.md`.

### W-a — the doctor-vs-page yahoo "contradiction": EXPLAINED, path parity CONFIRMED (not a finding)
**One-line result:** the doctor and the refresh net fetch through the **identical path** —
`build_provider(lane).get_quote(symbol[, exchange])` (`_refresh_via_net` `market.py:749-753` vs
`provider_doctor.py:120/137`); same construction, same adapter method, **same parse**. So the doctor
**does** diagnose the real refresh path — **not a finding**. The apparent contradiction was an artifact
of the **specimen seed**: the page's `yahoo`-priced rows were **raw-inserted DB fixtures** (to show the
net-catch provenance), **never live-fetched**; the doctor made a **real** live `yahoo` call to `AAPL`
that genuinely returned empty (Yahoo blocks/limits unauthenticated automated quotes from this host).
That is the doctor **working** — faithfully reporting that the live `yahoo` lane does not resolve on this
instance, exactly what the refresh would hit. Evidence: doctor `total_calls=3`, `yahoo` FAIL "reached,
parsed empty"; the page's yahoo values were the seeded `quotes.source='yahoo'` rows.

### W-b — DONE: doctor "proposed" → honest `not_run` (a served surface may not carry scaffolding)
`coingecko`/`ecb_fx`/`amfi_nav` are the keyless lanes `build_provider` cannot construct yet (no live
probe path), so they were **listed** but reported `verdict="proposed"` / *"live probe proposed for the
0a look"* — dev-planning language on a served surface. **Replaced with the real state `not_run`** +
honest note *"not probed on this instance — no live probe is wired for this lane yet"* (copy PROPOSED,
ratified loop-2). Code: `app/services/provider_doctor.py` (`_UNPROBED_LANES`, `_NOT_RUN_NOTE`,
`verdict="not_run"`); test `test_unprobed_lanes_report_the_honest_not_run_state` (asserts `not_run`,
calls 0, **blindness pin**: note served + no "proposed"); frontend `doctorTone` already neutrals it
(comment + type-doc updated). Doctor suite **6/6** ordered; `ruff`/`tsc` clean; PricingHealth vitest
**19/19**. *(Chose `not_run` over wiring a live probe: these three lanes aren't in `build_provider`, and
R-63 is a reliability fix, not a provider-expansion — an honest not-run state is the tight, truthful
choice the ruling offered.)*

### W-c — DONE: UNSUPPORTED re-seeded self-consistently (no source, no price)
The old specimen (VOO with a live `yahoo` price **and** `unsupported`) was self-contradictory. Re-seeded
as a genuine unsupported holding: **`SGB2032` (a `bond`)** — `bond ∉ _ALL` and no configured lane
(`eodhd` doesn't list bond) prices it, so `route()` returns `source_selected=None` → `unsupported`
naturally, with **no quote row → source `none`, native price `—`, valued from cost (Estimated)**. The
drawer now reads the state's true shape: Source **none**, Route **—**, Native price **—**, "No configured
source can price this instrument." (VOO restored to a clean `yahoo (head mock)` matrix net-catch.)

### Re-cut frames (loop-2 deliverable) — `docs/plans/assets/`, both themes, 0 console errors
- `r63-0a-doctor-fail-{light,dark}` — `coingecko`/`ecb_fx`/`amfi_nav` now **`not_run`** (W-b).
- `r63-0a-pricing-failstate-unsupported-{light,dark}` — the self-consistent bond (W-c).
- `r63-prepass-pricing-health-{light,dark}`, `r63-0a-pricing-headpricedby-{light,dark}` — refreshed for
  the VOO-clean + bond-added table.
- (`r63-0a-doctor-noegress-*` unchanged — byte-identical; `not_run` only appears egress-on.)

### Still OPEN (findings the 0a ruling did not disposition — carried to the owner)
- **F-A** — manual holdings render `null (head manual)` in the Source column (netCaught rider on a null
  `source`). Visible on `r63-prepass-pricing-health-*`. **NOT fixed** (head/priced-by ratified as walked;
  no ruling to touch the manual-row rider). Awaits the owner's disposition.
- **F-B** — the AV adapter logs AV's key-echoing error text (a real key could reach the server log; the
  doctor *response* is redacted). **NOT fixed.** Awaits disposition (fold into R-63 redaction, or R-58/R-64).

**Full backend-suite verdict (both orders) is OWED before close** for the W-b `provider_doctor` delta
(inner-loop green: doctor 6/6 + ruff/tsc/vitest). **Loop-2 look next — then 3a, then the owner's live 3b.**

---

## SESSION — 2026-07-24 (LOOP-3) — loop-2 RATIFIED; F-A + F-B FIXED

### Ruling 1 — LOOP-2 RATIFIED (owner, by looking)
The re-cut frames are ratified: the honest **`not_run`** doctor copy, the self-consistent **SGB2032
UNSUPPORTED** (no source, no price), and the **W-a path-parity** explanation recorded as **NOT-A-FINDING**
with its evidence (doctor and refresh both fetch via `build_provider().get_quote()`; the yahoo mismatch
was seeded-fixture vs live-empty).

### F-A — FIXED IN R-63 (§11-I: a code token on a served surface)
`portfolio.py` pricing-health row now serves **`source="manual"`** for a manual holding (no market
instrument → `diag is None`), matching its `route_source="manual"` — so the Source column renders
**`manual`**, never the literal **`null (head manual)`**. Backend-only (the frontend already renders a
served `source` verbatim; the PricingHealth vitest fixture already used `source:"manual"`). Copy PROPOSED.
Test: `test_pricing_health.py::test_manual_holdings_serve_a_source_word_never_null` (manual rows serve
`"manual"`, never null; `route_source` consistent). **The refreshed frame is owed at the CLOSE's final
specimen set** (owner ruling — "rides the next commit; frame refreshed at the close's final set").

### F-B — FIXED BEFORE CLOSE (§8 secrets: provider error text could echo the key into logs)
`ExternalMarketDataProvider._redact()` scrubs the configured key from **every** logged provider error
(all five `log.warning("AV …", … exc/reason)` sites) — covering both AV's own key-echoing error body
(*"… your API key as <KEY> …"*) and the `apikey=<KEY>` an httpx URL error carries. `get_quote` already
catches every exception and returns `_no_quote(reason=str(exc))` (never raises), so no key-bearing
exception escapes to an unredacted logger (e.g. the doctor). Tests (log-capture, using the fake key
`INVALID-DOCTOR-TEST`): `test_av_quote_envelope.py::test_quote_error_does_not_leak_the_key_into_logs`
and `…test_index_error_does_not_leak_the_key_into_logs` (the observed index path, `external.py:236`) —
each asserts **the key substring is absent from the logs** AND (blindness pin) **the warning still fired**
(`***REDACTED***` present). Inner-loop: AV-envelope + doctor **18 passed**; pricing-health **4 passed**;
ruff clean; PricingHealth vitest **19/19** (unchanged — F-A is backend-only).

### Verdict + close path
Full backend suite (both orders, seed 6363) running on the final F-A/F-B/W-b code — the **close verdict**
(the W-b-only checkpoint was **2150 passed, 15 skipped** ordered). Expected `+3` (2 F-B log-capture + 1
F-A). **Next: report the both-orders verdict → 3a scripted pre-pass → STOP for the owner's live 3b (his
TSLA cleanup via Holdings, his real Refresh, the entitled verified-tier cell on his real key) → close per
the full ritual.** F-A's refreshed manual-rows frame lands in the close's final specimen set.

---

## SESSION — 2026-07-24 (3a) — CLOSE VERDICT + scripted pre-pass → HARD STOP for the owner's live 3b

### Full backend-suite CLOSE VERDICT — both orders, SOLO/uncontended, seed declared
| Order | Result | Time |
| --- | --- | --- |
| ordered (`-p no:randomly`) | **2154 passed, 15 skipped** | 28:07 |
| randomized (`--randomly-seed=6363`) | **2154 passed, 15 skipped** | 20:15 |

Both runs **SOLO** (no overlapping pytest — the verdict was captured before any browser drive; census/3a
ran only after). **Seed 6363** declared. Count matches the pre-stated **2154** exactly.

**Suite-count reconciliation (2135 → 2154, +19, itemized per test file — the WHOLE post-Phase-3 delta):**
- **Phase 3.5 (+8)** → 2143 — `test_instrument_identity_guard.py` (**8**: 7 guard + 1 `test_resolver_recovers_from_locked_writer` hardening).
- **Phase 4 (+1)** → 2144 — `test_data_source.py` (verified-tier `quote_entitlement` distinct from `av_tier`).
- **Phase 5 (+6)** → 2150 — `test_provider_doctor.py` (**6**).
- **W-b (+0)** → 2150 — `test_provider_doctor.py` test RENAMED (`test_proposed…` → `test_unprobed…`), assertions changed in place; net 0.
- **F-A (+1)** → 2151 — `test_pricing_health.py::test_manual_holdings_serve_a_source_word_never_null`.
- **F-B (+3)** → 2154 — `test_av_quote_envelope.py`: `test_quote_error_…`, `test_index_error_…` (observed path), `test_urlembedded_apikey_form_…` (the URL `apikey=<KEY>` form).

**15-skip census:** the **15 skips are the LONGSTANDING milestone baseline, unchanged** — Phase 1 was
`2121 passed, 15 skipped`; every phase since reports `… 15 skipped`; **R-63 introduced ZERO new skips**
(+33 passed / +0 skipped across the whole milestone). Known conditional skips include
`test_fact_pack_kinds.py:123` (return/vol shape date-dependent) and `test_glossary_parity.py:114`
(a declared heading that is not a term); the remainder are pre-existing `skipif`/optional-path skips
constant across the milestone. (Contract line unchanged this loop: **143 paths / 71 schemas** — no new
endpoint; the doctor stays `-> dict`, F-A/F-B touch no contract.)

### 3a scripted pre-pass — 28/28 assertions PASSED, both themes, 0 non-benign console errors
Driven on the isolated stack (temp DATA_DIR + the seeded DB; his live stack/key never used — key
overridden to `INVALID-DOCTOR-TEST`; `.env` hash-verified identical; stack torn down, ports free,
throwaway deleted). Assertions cover: head=X/priced-by=Y present; **NO `null (head manual)` token
anywhere + manual rows read `manual`** (F-A, on camera — `r63-3a-manual-source-row-*`); duplicate banner;
throttled drawer copy + "last at"; **unsupported drawer = no source + served note** (SGB2032); doctor
**alphavantage FAIL** + **coingecko `not_run`** + `total_calls≥1`; recut routing sentence; provider-head
card; verified-tier "not yet verified / free"; **0 console errors** each theme. Shots:
`docs/plans/assets/r63-3a-{pricing-health,manual-source-row,unsupported,doctor-fail,settings-datafeeds}-{light,dark}.png`
— the **close's final specimen set**, including the refreshed F-A frame. **This discharges the re-run
half of the accepted-surface rite for the F-A delta** (delta-note half already in `page-pricing-health.md`).

### HARD STOP — the 3b is the owner's, live, in chat
Remaining before close, all **owner-hands / live**: his **TSLA duplicate cleanup** via Holdings, his
**real Refresh** (proving the parse-fix + execution net price his TSLA/SBICARD.BSE/AARK), and the
**entitled verified-tier cell** on his real premium key ("Quotes: delayed / Indices: premium"). After
his live 3b: the **full close ritual** (§-ledger CLOSED — I-1..I-9 all DISCHARGED; strike-check; Help
currency; `RATIFICATION.md §6` row; KB-sync). **No 3b executed here. HARD STOP.**

---

## SESSION — 2026-07-24 (3b, PARTIAL) — owner live walk; F-C filed; HANDOFF for the F-C session

### 3b — owner live walk on his real premium instance (PARTIAL, 2026-07-24)
Walked in chat on the owner's live keyed stack (his own hands — never driven from here):
- **Purge-with-PIN: PASS** (D-103 fresh-PIN honoured).
- **Pre-purge evidence ACCEPTED (owner's screenshots) — the R-63 core fix proven live on his real key:**
  - **TSLA priced `2,523.22`, source `alphavantage (corrected)`** — the entitlement-envelope **parse fix
    + the execution net are live and pricing his real symptom** (the milestone's origin: TSLA was dark).
  - a fund priced **`103504` via `amfi_nav`** (the keyless lane serving real NAV).
  - the **duplicate-instrument banner correct** on his real id-pair.
- **Portfolio now EMPTY by owner action** (he purged after the evidence — so the remaining live checks
  run on a fresh book).
- **OPEN from 3b, both owed BEFORE close ratification:**
  1. the **verified-tier cell strings on his real key** (the entitled *"Quotes: delayed / Indices:
     premium"* readout — deferred here throughout, now his to confirm live);
  2. the **owner's copy verdict on ALL `PROPOSED` strings** (every R-63 served string shipped PROPOSED —
     doctor copy, failure notes, banner, routing sentences, verified-tier, `not_run`, F-A `manual`).
- **F-C filed** (ledger I-10) — see below; owner ruled **fix-in-R-63**.

### Ruling — the "Source override" rename (owner, 2026-07-24)
The instrument **Edit / Identity** label **"Source"** renames to **"Source override"**. Today the single
word *"Source"* means **override** on the Identity/Edit surface but **priced-by** on the quote/provenance
badge — **one label, two semantics**. Recorded here; **the fix rides F-C's session** (same surface family).

### Recorded deviations (never silently)
- **a1793d8 mixed work + records in one commit** — the URL-form F-B test (work) was staged together with
  the ledger rows + page note (records), against the two-commit rule. **Noted, not rewritten** (history
  stands; the rule holds for the next session).
- (The Phase 3.5 **+7 → +8** estimate correction is recorded at its own line above, I-5 precedent.)

---

## FILES-FIRST HANDOFF — successor session (the F-C session), 2026-07-24

**STATE.** R-63 is **code-complete and CLOSE-VERDICT-BACKED** (backend **2154 passed, 15 skipped, BOTH
orders, solo, seed 6363**; contract **143/71**; frontend green). §-ledger **I-1..I-9 DISCHARGED**;
**I-10 (F-C) OPEN**. 0a specimens ratified as walked; 3a scripted pre-pass **28/28**; both accepted-surface
rites discharged (delta notes + pre-pass re-runs, back-linked). 3b **partially** walked live (above).
HEAD at handoff: this session's records commit.

**OPEN before R-63 can CLOSE:**
1. **F-C (I-10)** — AARK priced-by=`mock`/Confidence 100·high/head=`alphavantage`, `mock` not in the chain.
   **Investigation-first** (diagnosis before fix scope; evidence before hypothesis). **Detail belongs in
   the fresh session's prompt file** — start there.
2. **"Source override" rename** — rides the F-C session (Identity/Edit label; disambiguates the two
   "Source" semantics).
3. **Owner live 3b remainder** — the **verified-tier strings on his real key** + his **copy verdict on all
   PROPOSED strings**. Both are owner-hands, live, in chat.
4. **Then the full close ritual** — §-ledger CLOSED (I-1..I-10), strike-check, Help currency
   (guard-corroborated), `RATIFICATION.md §6` row, KB-sync. Only after 1–3 land.

**NEXT ACTIONS (successor).** Read `CLAUDE.md` · `CURRENT.md` · this plan (esp. this handoff + the I-10
row + the Source-override ruling) · the F-C **prompt file** (carries the evidence detail). Re-verify state
by grep (HEAD, tree clean, ledger↔records). Then diagnose F-C read-only first (its own §), scope the fix
with the owner, ride the rename, gather the owner's live 3b remainder, and close.

**Pre-release backlog + ROADMAP filed this session:** the stale-banner/lock-timeout/long-op UX-resilience
family → `pre-release-walk.md`; background auto-refresh → `ROADMAP.md` (post-release, egress-gated).

---

## F-C PHASE A — DIAGNOSIS (evidence, 2026-07-24) — root cause PROVEN; STOP for the fix ruling

**Charter honoured:** diagnosis before fix; evidence before hypothesis; the obvious story proved-or-killed,
not fixed. Phase A only — **no fix code this session** (the label §4 is a separate, already-ruled item).

### Method — isolated reproduction (the owner's live stack / real key NEVER used)
A throwaway pytest repro (`tests/integration/test_fc_repro_DELETEME.py`, **run then deleted — not committed**)
drove the **REAL** path on a temp-DB isolated instance, no network, no key: head `alphavantage` forced to
return no price, `yahoo` forced to return no price, and the **REAL** `build_provider("csv")` walked against an
empty imports dir. It reproduced the owner's finding **exactly**, including his precise number.

### The obvious story is KILLED
The seductive story was: *AV can't price AARK → the provider's lazy-import/error path degrades the whole
provider to Mock → Mock fabricates a quote → the layers launder it to 100.* **All three legs are false:**
- The owner's provider is a healthy AlphaVantage (his live TSLA priced `2,523.22` via it, 3b). `get_provider()`
  returns `External`, **not** a degraded Mock — no import error fired.
- The net's `build_provider` is explicitly **fail-closed to `None`, never Mock** (`__init__.py:65-101`, docstring
  "an un-buildable lane is skipped by the net, never mocked"). It cannot substitute mock.
- `mock` is **in no `DEFAULT_PRIORITY` chain** and `fetch_chain` filters it out — the net never *names* a mock lane.

### The PROVEN root cause — the CSV lane launders mock into the execution net
`fetch_chain(diag, "etf", …)` for a US ETF returns **`['alphavantage', 'yahoo', 'csv']`** (`router.py:449-462`):
`csv` is **keyless** (`_is_keyed` passes) and **covers `etf`** (`CAPABILITIES["csv"]`, `router.py:65-67`), so it is a
legitimate fallback lane in `us_equity`/`sg_equity`/`in_equity`/`crypto` (`DEFAULT_PRIORITY`, `router.py:156-168`).
The net (`_refresh_via_net`, `market.py:747-783`) walks it: AV head → `price None` → continue; yahoo → `price None`
→ continue; **`csv` → `CSVMarketDataProvider.get_quote("AARK")` finds no `AARK.csv` and returns
`await self._mock.get_quote(symbol)` (`csv_provider.py:64-67`)** — a fully-formed `Quote(source="mock",
price=100.0×_walk, entitlement=DELAYED, is_stale=False)`. Because `q.price is not None`, the net accepts it and
persists `source = q.source = "mock"` (`market.py:764-777`). **Reproduced number: `109.878669` — byte-identical to
the owner's recorded "native USD 109.878669".** So the drawer's "native" figure was **mock's** number, never AV's.

### The five required answers, each file:line-cited
- **(a) Exact entry point of mock for a real holding.** `app/providers/market/csv_provider.py:64-67` — the CSV
  provider's own internal mock fallback on a CSV miss, invoked by the live execution net at `market.py:749,753`
  when it walks the `csv` lane that `fetch_chain` (`router.py:449-462`) legitimately includes. It is **not** the
  provider-registry degrade (`__init__.py`), **not** the router's `active_provider == "mock"` demo branch
  (`router.py:418`), **not** `build_provider` (fail-closed to `None`). One site.
- **(b) Why confidence scored 100/high.** The ROUTE chose `valuation_method="market_quote"` (head=alphavantage is
  the active provider, in-chain — `router.py:418-421`); `confidence._BASE["market_quote"]=100` (`confidence.py:16`)
  and **no penalty fires** — the mock quote is fresh (no −20 stale), entitlement is `delayed` not `unavailable`
  (no −15), not `mapping_required`, FX present. `band_of(100)="high"` (`confidence.py:34`). **The confidence layer
  scores by the route's valuation_method and is BLIND to the fact `priced_by` was actually `mock`** — the seam.
- **(c) Why the badge said "delayed".** `MockMarketDataProvider.get_quote` hard-codes
  `entitlement=EntitlementStatus.DELAYED` (`mock.py:133`); the net stores `q.entitlement.value` = `"delayed"`
  (`market.py:768`). It is mock's own label, not an AV entitlement.
- **(d) What else can hit this path (an enumeration = a completeness claim).** **Any** holding whose lane chain
  contains `csv` — i.e. **`us_equity`, `sg_equity`, `in_equity`, `crypto`** (all list `csv` in `DEFAULT_PRIORITY`;
  `global_fund`/`bond`/fund/deposit/derivative do **not**) — where the head and every earlier keyed lane (AV, yahoo,
  [kite for IN], eodhd-if-keyed) fail to price it. The CSV mock fallback fires for **every** symbol on an instance
  with no CSV files (the normal case), so the exposure is the whole equity/etf/crypto class, not AARK alone. **Sister
  leak:** `csv_provider.py:88-89` does the identical mock substitution for **history** — but that is already caught
  by the demo-residue repair machinery (`_hist_row_is_demo`/`repair_history_demo_residue`, `market.py:866,894`);
  the **quote** path has **no** such repair, which is why the mock quote persisted and scored high.
- **(e) Did stored provenance record the truth?** **YES** — `route_head="alphavantage"` and `priced_by="mock"` were
  both stored and shown (drawer: mock absent from the chain; Identity: override alphavantage). **The R-63 Phase-1/4
  provenance work is precisely what made this defect SEEABLE.** The defect is not the provenance; it is that a mock
  price is **served at all** for a real holding and then **scored 100/high**.

### F-D (diagnose-only, architect scope-addendum 2026-07-24) — the verified-tier disagreement
See ledger **I-11**. Summary: both learned tiers are **per-process** (`external.py:126,131`; not persisted).
`av_tier` is learned by an **on-demand probe the `/system/data-source` endpoint fires itself** (`system.py:145-146`
`get_quote("DJI")` → `_index_quote` → `_index_entitled=True`) — so viewing Settings learns "premium" with **zero
holdings**. `quote_entitlement` has **no probe**; it is learned only passively from a real holding refresh
(`external.py:276`), and the DJI probe bypasses it (indices route through `_index_quote`, never
`_note_quote_entitlement` — `external.py:247-248,221`). The architect's candidate is **confirmed**: post-purge
**zero holdings ⇒ zero GLOBAL_QUOTE calls ⇒ `quote_entitlement` stays None** while `av_tier` self-probes to premium.
**No fix code** — whether to persist `quote_entitlement` and/or add a symmetric quote-side probe is an **owner ruling**.

### FIX-SCOPE OPTIONS (F-C) — numbered, with blast radius + test plan; STOP for the ruling
The evidence localises the defect to **one site** (`csv_provider.py:64-67`) plus **one blind seam** (confidence
scores the route method, not `priced_by`). Sizing three options against that (do not pre-commit):

- **Option 1 — Sever the CSV→mock QUOTE fallback (tightest, root-cause).** On a CSV miss, return a no-price
  `Quote` typed `unsupported`/`empty` instead of `self._mock.get_quote()`. The net's existing `q.price is None →
  continue` then skips csv and walks to `manual`/no_data, so AARK reads honestly (estimated-from-cost, **low**
  confidence, typed state) instead of a fabricated 100/high. *Blast radius:* the CSV provider is real only when
  (i) `market_provider=csv` (a local/testing mode — dashboards would show *unpriced* rather than demo numbers; the
  docstring's "never go blank" was a demo nicety, arguably wrong for a keyed instance) or (ii) it is a net fallback
  lane (the leak). Leaves the **history** mock fallback (`:88-89`) untouched — already repaired elsewhere — or
  handles it in the same spirit. *Test plan:* the deleted repro becomes the **fail-first RED** (net never stores
  `source="mock"` for a real holding); + csv-mode still prices from a REAL `AARK.csv`; + AARK now scores low, typed
  `unsupported`. **Recommended core.**
- **Option 2 — Confidence law: a `mock`/`demo`-served price can never score "high" outside demo mode
  (defense-in-depth).** Teach `score_holding` (or the row it reads) about `priced_by`/`source` and cap/penalise a
  mock-served value. *Blast radius:* `confidence.py` + its callers must thread `source` (today it reads only
  `valuation_method`). Treats the **symptom** (the 100) not the **cause** (mock served at all) — **weaker alone**,
  good as a belt-and-braces companion to Option 1, and it also covers any *future* mock leak.
- **Option 3 — Standing guard: the net never persists `source ∈ {mock,demo}` on a non-demo instance (a blindness
  pin).** A guard/assert around the net's write (`market.py:764`) + a test that reds if any lane re-introduces a
  mock leak. *Blast radius:* tiny; makes Option 1 **regression-proof** (turns the invariant red, satisfying "what
  turns red?"). *Test plan:* the pin fails loudly if a mock-sourced quote is ever written by the net.
- **Migration / re-score rider (independent of which option):** the owner's live AARK `quotes` row already holds a
  `source="mock"` value scored high. A one-time repair — mirroring `repair_history_demo_residue` but for the
  **quotes** table (`source ∈ {mock,demo}` on a non-demo instance → delete the row so valuation falls to estimated
  and re-scores low) — clears the stored fabrication. Fail-first + blindness pin.

**RECOMMENDATION:** **Option 1 (sever the CSV quote→mock fallback, typed `unsupported`/`empty`) + Option 3 (standing
no-mock-in-net guard) + the quotes-table migration rider.** Option 2 optional as defense-in-depth. This is the
tight two-fixes-plus-guard shape the charter prefers, and it maps the mock case onto the existing seven-state
taxonomy rather than inventing a new surface. **HARD STOP — the architect reviews in chat and the owner rules before
any Phase B fix code. Phase A ends here.**

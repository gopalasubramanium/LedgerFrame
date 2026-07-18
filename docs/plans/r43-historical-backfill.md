# r43-historical-backfill — Historical valuation backfill (ROADMAP R-43) build plan

> **PLAN ONLY — verify-first, STOP AT §9.** This session produces the plan; **no code,
> no migrations, no app-code commits**. The §9 one-pass is walked with the owner in chat
> (the R-35/R-38/R-42 plan-file-first precedent). Do not resolve §9 items here — **propose**;
> the owner rules (⚑). Committed docs-only.

This plan adapts `TEMPLATE-page-build.md` for a **feature milestone** (not a single page) —
the R-38 (`data-feed-routing.md`) / R-42 (`intraday-series.md`) precedent: §0 *what it is*,
§1 *owner definition*, §2 *verify-first survey* (every claim `file:line`), §3 *scope*, then
the template's §4–§8 adapted, §9 *open items → PROPOSED resolutions*, and the build phases
owner-gated behind §9. **Governing rules (CLAUDE.md + TEMPLATE header) apply in full**: GLOSSARY
terms exactly; no invented affordances (every proposed control has real contents day one); ONE
canonical derivation; served display strings for every rendered value incl. progress/gap/error
(D-105); ratified components only; Decimal-only money math (backend); contract-freeze
(backend-first, regenerate `API-CONTRACT.json` + `docs/openapi.json` same commit).

---

## 0. WHAT R-43 IS

A **historical valuation backfill** — the platform values the portfolio *as it was on each
past date* from **price history + the transaction ledger + per-date FX**, persists those
valuations as **dated snapshots**, and so the **Net worth trend stops being flat/linear**
(today only *forward* snapshots exist, written every 6h by the worker — §2.1). It powers the
**Net-worth trend** (and, if the owner scopes it in, Portfolio performance — §9-7).

R-43 is ruled into **v2.0.0** (RD-9 Amendment 6, owner 2026-07-18) and **carries three
folded-in scopes**:

1. **R-8 — historical FX series** — its **hard dependency**. Retrospective valuation needs a
   **per-date** FX rate; today FX is current-rate-only (§2.4). Pulled into v2.0.0 with R-43.
2. **Transaction currency + trade-date cost-basis FX** — folded in at the R-42 close
   (2026-07-18). ⚠ **Verify-first divergence (§2.5):** the currency column and trade-date-FX
   *storage* **already exist and are populated** — the real gap is the *reader* + a currency
   inference fix, not a new column.
3. **The Net-worth snapshot-now trigger** — an icon `Button` on the trend card (Net worth is
   an accepted page — a **dated delta note + pre-pass re-run on touch**).

**The platform still never fabricates a number.** A backfilled valuation exists only where
its inputs honestly exist; a date with no price or no FX rate is a **flagged/honest gap**,
never a carried-forward fiction presented as fact and **never a fabricated 1.0 FX rate**
(the W-1b rule, extended per-date — §2.4). Every rendered value — incl. progress, gap and
error states — is a **served display string** (D-105). All money math is backend `Decimal`.

### ⚠ VERIFY-FIRST DIVERGENCE FLAGS (premise vs reality — resolve in §9)

The template requires flagging where the plan/kickoff premise diverges from the engine
(D-019; page-markets §13d). Four surfaced:

- **⚠-A — Transaction currency + trade-date FX are NOT absent; they already exist (§2.5).**
  `transactions.currency` is a populated NOT-NULL column; `transactions.fx_to_base`/`fx_base`
  exist (migration `a1c8f34b9d62`) and are **captured live at add-commit**; the Holdings
  add/edit/import forms already render a Currency `MasterSelect`. **§9-4 is reframed** from
  "add a column" to "wire the *reader* + fix the fund currency inference + edit-path FX
  consistency". **No transaction-currency migration.**
- **⚠-B — There is ALREADY a second (and third) valuation engine, and they drift (§2.2).**
  `analytics.performance_series` and `analytics.time_weighted_return` re-implement valuation
  *without* going through `_value_one_holding`, and they carry the exact **W-1 currency bug**
  R-42 fixed (`analytics.py:262,399`), plus current-FX-across-history, plus mutually
  inconsistent quantity handling. R-43's "ONE derivation" mandate is therefore a
  **consolidation**, not merely an addition — see §9-7.
- **⚠-C — Crypto historical fetch has NO working path (§2.3/§2.6).** BTC/XRP carry
  `source_override='alphavantage'`, but AV's `TIME_SERIES_DAILY` is an *equity* endpoint and
  returns empty for crypto; CoinGecko has **no `get_history` method at all**. Crypto backfill
  is **new code**, not just quota — §9-2.
- **⚠-D — AMFI historical NAV DOES exist (open question resolved), but is unwired (§2.3).**
  An AMFI historical archive is reachable (`DownloadNAVHistoryReport_Po.aspx`, ~90-day
  chunks, back to 2006); the current adapter fetches current-day `NAVAll.txt` only. Fund
  history is **new code**; the exact param names need **one confirming test call** before
  build — §9-2/§9-3.

## 1. OWNER DEFINITION (the ruled scope — PRESERVED)

Recorded across `ROADMAP.md:55` (R-43 row), `CURRENT.md:31-48`, and `release-readiness.md`
RD-9 Amendment 6 (owner 2026-07-18):

- **Retrospective portfolio valuation** from price history + transactions + per-date FX.
- **A Decimal engine** — no client money math (D-105).
- **Persisted snapshots** — the trend reads dated snapshots, not a live recompute per view.
- **Powers** the Net-worth trend (definitely) + performance (scope guard, §9-7).
- **Hard-depends on R-8** (historical FX) — pulled in.
- **Includes** transaction currency + trade-date cost-basis FX (R-42-close fold-in) and the
  **Net-worth snapshot-now trigger**.
- **Sequenced** immediately after intraday-series (R-42) — R-42 and R-43 grow the **same
  history store**, so storage/keying decisions are made adjacently.

> **Owner priority rationale (RD-9 Amendment 6):** Time-to-Value / first-open credibility —
> a flat/linear trend undermines the very first open of the appliance.

## 2. VERIFY-FIRST CURRENT-STATE SURVEY (all claims cited `file:line`)

*Read the engine before assuming shapes (D-019). Six survey passes, 2026-07-18, on the demo
instance `/home/gopalasubramanium/.ledgerframe-data/db/ledgerframe.db` (real data dumped).*

### 2.1 — The snapshot store today: forward-only, scalar, 6-hour worker

- **Table `net_worth_snapshots`** (`app/models/__init__.py:416-423`): `{id, ts, base_currency,
  assets, liabilities, net_worth}` — three scalar `Decimal` totals + ts + currency. **No
  `source`/`kind` column, no per-class detail.** This **confirms R-28's "scalar totals only"**
  (`ROADMAP.md:40`). Sibling `portfolio_snapshots` (`:404-413`) has `detail_json` but it is
  **written empty** (`worker.py:73-76` → model default `"{}"`).
- **Writer + cadence:** `app/worker.generate_snapshots()` (`worker.py:65-84`) writes **both**
  a `PortfolioSnapshot` and a `NetWorthSnapshot` in one commit, on an **interval of every 6
  hours** (`worker.py:136`, APScheduler). It is the **only** 6-hour job **not** also kicked
  off at boot (`:145-147`), so a fresh appliance shows the empty state for ~6–12h. The demo
  seed can synthesize 26 weekly points (`app/seed/demo.py:249-274`), but **the live demo DB
  currently has 0 rows in both snapshot tables** — a clean slate for coexistence.
- **Trend consumption:** `GET /net-worth/history` (`app/api/v1/routes/portfolio.py:925-937`)
  returns **all** snapshots ordered by ts, no params, no backfill — `{history:[{ts, assets,
  liabilities, net_worth, currency}]}`. Frontend `NetWorth.tsx:110-116` plots a **single
  net_worth line** (`PriceChart` line mode, `:172-173`). The **"two-snapshot rule" is
  FRONTEND-only** (`NetWorth.tsx:171`: `trendPoints.length >= 2`); below it the served empty
  state reads *"Not enough history yet"* / *"Net-worth history accumulates as the appliance
  runs — the trend appears once at least two snapshots exist."* (`:175-176`). Home does **not**
  read this store (it uses Portfolio performance).

### 2.2 — The valuation derivation: ONE engine today, but analytics.py already forks it

- **Canonical path:** `value_portfolio()` (`app/services/portfolio.py:415-458`) = **Σ
  per-holding** via `_value_one_holding()` (`portfolio.py:270-384`) — the total is a pure sum,
  so per-holding correctness *is* total correctness. The three inputs: **(i) quantity** =
  `D(h.quantity)` off the pre-computed `Holding` row (`portfolio.py:310`), itself a FIFO replay
  of the ledger by `rebuild_holdings_from_transactions` (`:461-510`) via the **pure**
  `compute_fifo()` (`:87-138`); **(ii) price** = latest single `Quote` row via
  `get_cached_quote` (`market.py:559-590`, `Quote` PK=instrument_id — no date dimension);
  **(iii) FX** = current rate via `fx.convert_checked(mv, price_ccy, base)` (`portfolio.py:333`).
- **Not date-parameterised today** — every input reads a *latest/current* source; there is
  **no `as_of` argument anywhere**.
- **⚠ Already-forked engines (⚠-B):** `analytics.performance_series` (`analytics.py:216-328`)
  and `analytics.time_weighted_return` (`:331-434`) value holdings back through time **without**
  `_value_one_holding`, and diverge three ways: (1) currency from the **holding** not the price
  row — the **W-1 bug** (`analytics.py:262,399`); (2) **current-FX across all history**
  (`:251-256`, documented as a simplification); (3) `performance_series` holds *today's*
  quantity constant (`:281-282`) while `time_weighted_return` reconstructs as-of positions
  (`:404-431`). Two engines already disagree — R-43 must **collapse them onto one**.
- **The seam that has no source yet:** `PriceHistory`/`Candle` carry **no currency column**
  (`models:321-333`; `schemas/common.py:72-78`), and **per-date FX does not exist** (§2.4).

> **ARCHITECTURAL VERDICT (the single most important decision).** Make **ONE** derivation
> date-aware: generalise `_value_one_holding` to accept an optional `as_of: date | None`
> (with `as_of=None` reproducing today's path byte-for-byte) behind **three pluggable
> resolvers**: **position** (`compute_fifo` over `txns where ts <= as_of` — the function is
> already pure, zero new logic); **price+currency** (latest `Quote` when `None`, else the
> `PriceHistory` close on/before `as_of` **paired with `instrument.pricing_currency`** because
> the candle has no currency — the W-2 field); **FX** (current rate when `None`, else the
> per-date rate from the R-8 store). `value_portfolio` threads `as_of` through; the total stays
> Σ per-holding. This retires the `analytics.py` drift instead of adding a fourth engine.

### 2.3 — Price-history depth, per provider (the held book vs the instrument table)

- **The instruments table has 28 rows; only 6 are *held*** (appear in `transactions`):
  BTC(15, crypto/USD, `source_override=alphavantage`), SBICARD.BSE(17, equity/INR),
  TSLA(18, equity/USD), 102000(25, mutual_fund/INR, amfi), XRP(27, crypto/USD,
  `source_override=alphavantage`), 145834(28, mutual_fund/INR, amfi). `exchange` is NULL on
  every row; `pricing_currency` is the authoritative price currency (W-2 field, `models:187`).
- **Daily (`interval='1d'`) coverage actually cached** (real dump): TSLA 250 rows, SBICARD 243,
  BTC 124 — all `2025-07-21 → 2026-07-17`, all `source='alphavantage'`; **XRP 0 daily**, and
  **all three funds (102000/145834/108466) have ZERO daily history.** So of the 6 held, only 3
  have any daily series, and only ~1 year deep — the transactions go back to **2019** (§2.5).
- **Alpha Vantage (VERIFIED):** owner is **premium**; `get_history` already selects
  `outputsize="full"` for ranges >100 days (`external.py:217,240`) → **one call = full 20+yr
  daily series**. `Semaphore(1)` + `fetch_on_demand=False` (`external.py:96,103`) so it never
  fires on page-load. `full` is premium-gated per current AV docs (owner qualifies).
- **CoinGecko (VERIFIED):** adapter implements **only** `/coins/list` + `/simple/price`
  (`coingecko.py:82,90`) — **no `get_history`/`market_chart` at all**; no instrument carries a
  `coingecko_id`. Free tier caps history at **365 days**; `>90d` ranges return daily. Multi-year
  crypto history on free tier is **impossible** without a paid plan.
- **Crypto today rides AV via `source_override` — and AV crypto history is BROKEN (⚠-C):**
  `TIME_SERIES_DAILY` is an equity endpoint (no `DIGITAL_CURRENCY_DAILY`), so BTC/XRP history
  calls return empty (`external.py:240-243,269`).
- **AMFI historical NAV (⚠-D — open question RESOLVED):** the current adapter fetches
  current-day `NAVAll.txt` only (`amfi.py:26,96`) — funds have 0 history rows. But an AMFI
  **historical archive exists** (`portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx`),
  date-range query, **~90-day max per request** (~4 calls/yr/scheme), depth **back to 2006**.
  *Exact per-scheme param names UNCERTAIN* — confirm with one manual test call before build.

### 2.4 — R-8 historical FX: no per-date store; one ECB file = the whole history

- **FX today is latest-rate-only.** `fx.get_rate_or_none` (`fx.py:28-67`) with a 10-min
  in-process TTL keyed by `(base, quote)` — **no date dimension**; live path crosses via **USD**
  (`fx.py:58-63`). The ECB reference layer (`ecb_fx.py`, `providers/market/ecb.py`) parses
  `eurofxref-daily.xml` and crosses via **EUR** (`ecb_fx.py:73-79`).
- **The FX table `ecb_fx_rates` (`models:256-264`) is PK-on-`currency`** — one row per currency,
  **overwritten each refresh** (`ecb_fx.py:40-46`). Real dump: **30 rows, a single `as_of =
  2026-07-17`** (INR 110.1020, SGD 1.4765, USD 1.1435 — all EUR→CCY). **No per-date FX exists
  anywhere.** This is the core R-8 gap.
- **ECB historical series (VERIFIED):** `https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.csv`
  — **one download = the full daily history back to 1999** (~2,800 rows, newest-first), header
  = `Date` + **40 currencies incl. USD, INR, SGD**. Per-currency coverage **starts later than
  1999** for Asian currencies (INR/SGD empty in the 1999 row) → dates before a currency's
  coverage are honestly-missing (§2.4 honest-missing). **Sandbox caveat:** this environment's
  egress served fixture-like values for recent ECB dates; **validate real numbers on the
  owner's stack**, not the sandbox.
- **Base currency = SGD** (`config.py:55`, validated against `SUPPORTED_CURRENCIES`
  `config.py:18`). The book prices in exactly **two** currencies (USD, INR). **Needed per-date
  series = {USD→SGD, INR→SGD}**, each an **EUR-cross** `(EUR→SGD)/(EUR→X)` (the ECB history is
  EUR-quoted — R-43 must use the EUR hub, not the live path's USD hub). SGD→SGD = identity.
- **Honest-missing (W-1b, `intraday-series.md:566-601`) extended per-date:** `get_rate_or_none`
  already returns `None` (never 1.0) and `convert_checked` returns `(amount, False)` so the
  caller flags the value (`fx.py:91-102`; `portfolio.py:333-346`). R-43's rule: a historical
  date with no ECB rate (non-publication day, or pre-coverage) → **flagged valuation, never a
  fabricated 1.0.** The per-date store must represent "no rate on date D" distinctly from
  "rate = 1".

### 2.5 — Transactions: currency + trade-date FX already present (⚠-A)

- **Schema (`models:370-401`):** `transactions.currency` is **NOT-NULL, default `"USD"`,
  populated** (`:384`); trade-date FX columns `fx_to_base` (`:394`) + `fx_base` (`:395`) exist
  (migration `a1c8f34b9d62` — additive, NULL-backfill by design, on the **transactions** table).
  `TxnType` = 11 values (`:42-55`; MASTER-DATA `:55`).
- **Real ledger dump — 6 buys, `2019-01-18 → 2025-06-25`:** SBICARD 2019-01-18 (INR),
  102000 2019-07-18 (SGD), TSLA 2022-07-18 (USD), BTC 2024-07-18 (SGD), XRP 2024-07-18 (SGD),
  145834 2025-06-25 (SGD). **"Earliest 2019 buys" verified.** The **currency mismatch is
  confirmed**: 4 rows have `txn_ccy != instrument_ccy` (the two INR funds recorded in SGD; the
  two USD coins recorded in SGD).
- **Trade-date FX is captured live at add-commit** by `fx.capture_rate` (`fx.py:105-136`) via
  `add_transaction` (`portfolio.py:571`) — but only same-currency `=1` shortcuts are stored for
  this owner; **every genuine cross-currency historical trade has `fx_to_base = NULL`** (the
  proximity guard refuses to stamp today's rate on a backdated trade, `fx.py:128`). So R-43's
  reader **must tolerate NULL `fx_to_base` on all historical rows.**
- **Cost basis today is native-only, converted at TODAY's rate.** `compute_fifo` sums cost in
  **native currency, no FX** (`portfolio.py:87-138`); `_value_one_holding` then converts
  `cost_base = fx.convert(cost_native, native_ccy, base)` **at the current rate**
  (`portfolio.py:334`). **The plug point for trade-date cost-basis FX is `portfolio.py:334`**
  (or push per-lot trade-date base-cost through `compute_fifo`). The **India-fund native-ccy
  inference bug** lives at `rebuild_holdings_from_transactions:497` (an AMFI scheme code with no
  exchange falls back to the txn's SGD, not INR).
- **Edit flow already has the currency field** (add `Holdings.tsx:1068`, edit `:1273`, import
  `:1429`; backend `TransactionIn.currency` `portfolio.py:427`, edit `:614`). ⚠ **but the edit
  path (`PUT …/transactions/{id}`, `portfolio.py:592-627`) never re-captures `fx_to_base`** —
  changing currency/date leaves the stored trade-date rate stale (an R-43 edit-flow gap).

### 2.6 — Egress, budget, jobs, progress

- **No-egress = a hard structural wall.** `app/core/egress.py` denies at the constructor:
  `egress_client()` calls `assert_egress_allowed()` **before** building any `httpx` client
  (`egress.py:73-83`), raising `EgressBlocked` (`:44-47`, served reason *"No-egress is on — …
  The device makes zero outbound calls in this mode (Product Guarantee 5)."*). **Implication:
  a backfill fetches nothing under no-egress — it must report an honest "not run" state**, never
  an interpolated series. (`privacy_mode` is currently unset on this instance — a config
  coincidence, not a weaker guarantee.)
- **Per-provider live-call tally for this held book (with new fetch paths built):** AV equities
  TSLA + SBICARD = **~2 calls** (`outputsize=full`); crypto BTC + XRP = **new path** (AV crypto
  broken; CoinGecko free-tier ≤365d, or paid) ; AMFI funds 102000 + 145834 = **chunked ~90-day
  calls** (~4/yr/scheme); **ECB FX = ONE fetch** for the entire history. AV free tier ≈ 25
  req/day (`market.py:751`) is the binding budget when unkeyed (owner is premium).
- **No task queue / job table.** Background work is APScheduler in a separate worker process
  (`worker.py:124-140`); the existing `backfill_history` job is **400-day trailing only**
  (`worker.py:52`), and `POST /system/fetch-history` is **fully synchronous** (`system.py:553-573`,
  clamps `days∈[30,3650]`, 12h dedup marker `hist_fetched:{id}:{interval}` `market.py:790-799`).
  Neither serves a multi-year, multi-instrument, resumable backfill.
- **Served-progress precedent to follow:** the one-click **self-update** runs **detached**
  (`asyncio.create_subprocess_exec`, `system.py:708-709`), writes `logs/update.{log,status}`,
  and the frontend polls `GET /system/update-status` (`system.py:644-675`, returns `{running,
  ok, failed, status, version, log_tail}`). R-43 should **reuse this file-based served-progress
  shape** for the backfill runner (new backgrounded runner needed; the *pattern* is not new).

### 2.7 — Performance reality (informs granularity, §9-1)

- Span **2019-01-18 → today ≈ 7.5 years** ≈ **~1,950 trading days**. Daily backfill of the
  6-held book = **~11,700 instrument-valuations** and **~1,950–3,900 snapshot rows**; the price
  cache itself must grow **~8×** (from ~1,451 daily rows to ~11,700) before valuation is even
  possible for the full span.
- **The arithmetic is cheap** (Decimal over ~12k valuations on SQLite = **seconds**). **The
  cost is the network fetch** to populate the price rows across rate-limited providers — warm
  (fully cached) valuation+snapshot pass ≈ **tens of seconds to a couple of minutes**;
  **cold, end-to-end, is quota-bound and could span far longer** (days of throttled fetching
  on a free key — owner is premium, which mostly removes this).
- **Granularity trade:** daily × 7.5yr is heavy and quota-bound; **monthly-back / daily-recent**
  (~390 pts) matches the data's real shape — only SBICARD and one fund predate 2022; BTC/XRP
  and the second fund are 2024–2025 — and avoids fabricating fine granularity where no source
  series exists. Informs §9-1.

## 3. SCOPE & NON-GOALS  *(drafted; finalised after §9)*

**In scope.**
- **One date-parameterised valuation engine** — the SAME `_value_one_holding` derivation called
  with an `as_of` date (§2.2 verdict); consolidate the `analytics.py` forks onto it (⚠-B).
- **Persisted dated snapshots** with **provenance** (backfilled vs live-accumulated vs
  snapshot-now — §9-1), idempotent re-backfill, coexisting with the existing forward snapshots.
- **R-8 historical FX** — ECB `eurofxref-hist` ingested + stored **per-date**; {USD→SGD,
  INR→SGD} as EUR-crosses; per-date honest-missing (§9-3).
- **Per-provider historical price acquisition** for the backfill window — AV equities (built),
  **new** crypto history path (⚠-C), **new** AMFI historical path (⚠-D) — user-triggered,
  within the R-42 budget discipline, with a **served progress state** (§9-2).
- **Trade-date cost-basis FX** — wire the *reader* at `portfolio.py:334`, fix the fund
  native-ccy inference (`portfolio.py:497`), and make the edit path FX-consistent (§9-4).
  **No transaction-currency migration** (⚠-A).
- **The Net-worth snapshot-now trigger** (icon `Button` on the trend card, §9-6).
- **Honest gaps policy** for the trend where prices/FX are missing (§9-5).

**Non-goals (stated, not built).**
- **No background poll/scheduler for the backfill** — user-triggered (R-42 budget discipline).
  The existing 6-hour forward-snapshot worker job is untouched.
- **No silent rewrite of recorded transaction numbers** — the R-42 batch-1 refusal stands;
  currency is *labelled*, corrections are the owner's per-transaction choice (§9-4).
- **No fabricated valuation / no 1.0 FX** — a date with no honest price/FX input is a flagged
  gap (§2.4 W-1b extended per-date).
- **No new financial capability** (PRODUCT-SPEC §6) — this persists a valuation the engine
  already computes, over time; it invents no new metric.
- **No backfill under no-egress** — honest "not run" state (§2.6).
- Scope-guarded: whether **Portfolio performance/TWR** rides backfilled history **this**
  milestone is an owner call (§9-7); default proposed = **trend only now** (but the `analytics.py`
  drift fix, ⚠-B, is in scope regardless because it is a correctness bug).

## 4. DATA MODEL / COMPONENTS / VOCABULARIES / DECISIONS  *(drafted; finalised after §9)*

**Data model deltas (magnitude/shape are §9 owner calls):**
- **Per-date FX store (R-8).** `ecb_fx_rates` is PK-on-`currency` (§2.4) → **cannot** hold
  history. Propose a **new dated store** — either a composite `(currency, as_of)` key on a new
  table (e.g. `ecb_fx_history`) or a `(base, quote, date)` rate table — storing EUR→CCY per
  date; must represent "no rate on date D" distinctly from "rate=1" (§9-3). **Migration.**
- **Snapshot provenance.** `net_worth_snapshots` has no `source`/`kind` column (§2.1) →
  add one (`source ∈ {backfilled, live, snapshot_now}`) so backfilled and forward rows coexist
  and a re-backfill is idempotent (newer real data supersedes) — mirrors the price-history
  `source` precedent. **Migration** (§9-1). *(Contrast R-42, which needed no migration.)*
- **No transaction-currency migration** (⚠-A) — the column exists.

**API surface (contract deltas — build backend-first, regenerate contract same commit):**
- A **backfill trigger** endpoint (start, per-provider plan) + a **served-progress** poll
  endpoint (the `update-status` file-poll shape, §2.6) — §9-2.
- `GET /net-worth/history` gains **per-point provenance + gap/flag** fields so the trend renders
  honest gaps and marks backfilled vs live points (D-105) — §9-5. *(Typed-response note: add
  fields to the `response_model` or they are silently stripped — page-markets §12mk3-2.)*
- Exact boundaries are §9 owner calls; each row is built backend-first with a fail-first test.

**Components (ratified inventory only).** `PriceChart` (line mode, the trend); `Button` (icon,
snapshot-now trigger — the dr-8 `loading` async standard); `EmptyState` (no-history / no-egress
honest states); `StalenessChip`/`ProvenanceBadge` (per-point freshness/provenance);
progress surface for the backfill (reuse the async standard). **No new component expected**; any
gap → a **DESIGN-SYSTEM §5 amendment at a Phase-0a specimen**, never mid-build (R-42 §9-10
precedent). §9-6.

**Vocabularies (settled — no gap).** The transaction/holding **currency** field draws from
`SUPPORTED_CURRENCIES` (`config.py:18` — SGD, USD, INR, EUR, GBP, JPY, AUD, CNY, HKD) via
`/refdata`; MASTER-DATA §3 (`:209-210`) already states this. **No MASTER-DATA delta.** `TxnType`
(11 values) unchanged.

**Decisions in force:**

| Decision | What it requires on R-43 |
|----------|--------------------------|
| **D-105** | Every rendered value — incl. backfill progress, gap markers, error/disabled states, disable reasons — is a **served** display string; the frontend renders, never decides. |
| **§4c — None, not fabricated** | A date with insufficient inputs (no price, no FX) → flagged/"—", never a made-up number. |
| **§4c — Never mix trade-date & current FX** | The trade-date-FX cost total and the current-FX total stay separate; a leg with no valid trade-date rate is excluded/flagged, not silently converted at today's rate. |
| **§4c — Never overwrite NAV** | Official NAV / manual valuations are never degraded by staleness; only market quotes degrade. |
| **D-020 / D-076** | Honest-NULL trade-date FX + **excluded-events count** (the protected honesty line, §4a) — extended per-date. |
| **Guarantee 3 / 5** | No fabrication; **no backfill under no-egress** (honest "not run"). |
| **D-019** | Verify-first — this survey; divergences flagged (⚠-A…D), resolved in §9, never silently built to premise. |

## 5. ACCEPTANCE CRITERIA  *(drafted; finalised after §9)*

- [ ] **One derivation:** the backfill values via the SAME `_value_one_holding` engine with an
      `as_of` date; a **structural test** proves `as_of=None` reproduces today's value exactly,
      and the `analytics.py` forks are re-pointed at it (the W-1 currency bug at
      `analytics.py:262,399` is retired, not duplicated). *(⚠-B)*
- [ ] **Populated trend (happy path):** on an egress-allowed premium instance, a user-triggered
      backfill produces a **multi-point** Net-worth trend from 2019 forward; the chart is no
      longer flat/linear.
- [ ] **Per-date FX honesty:** valuations use the ECB rate **as-of each date**; a date with no
      rate (non-publication / pre-coverage) is **flagged, never 1.0** (W-1b per-date, §2.4).
- [ ] **Trade-date cost basis:** cost/P&L convert at the **trade-date** rate where known;
      historical trades with `fx_to_base = NULL` fall back **honestly** (flagged), never silently
      at today's rate; recorded numbers are **never rewritten** (⚠-A / §9-4).
- [ ] **Provenance + idempotency:** backfilled vs live vs snapshot-now points are distinguishable
      (served provenance); re-running the backfill **never duplicates** and **newer real data
      supersedes** (§9-1).
- [ ] **Honest gaps:** dates with missing price/FX render per the §9-5 ruling (served
      gap/estimated marker), never a fabricated segment.
- [ ] **No-egress:** a backfill under no-egress makes **zero** outbound calls and shows the honest
      "not run" state (§2.6).
- [ ] **Snapshot-now:** the trend-card icon `Button` writes a dated snapshot with served
      in-progress/success/error states; its interaction with an in-flight backfill is defined
      (§9-6).
- [ ] **Served progress:** the backfill exposes served progress (running/ok/failed + log tail);
      resumable on interruption (§9-2).
- [ ] **Provider honesty:** crypto/fund history that cannot be fetched honestly (⚠-C/⚠-D) shows a
      **served reason**, not a silent gap or a fabricated series.
- [ ] **Both postures:** mock lane covered by the suite; a **budget-aware real slice** (§26-bis:
      one real instrument end-to-end) verified on the premium key (§9-8).
- [ ] **D-105 / copy hygiene:** all progress/gap/error/disable strings served; no decision ID or
      internal enum in user copy; GLOSSARY parity green.
- [ ] **Net worth accepted-page touch:** dated delta note + Phase-3a pre-pass re-run on the Net
      worth page; rendered verification (both themes/densities, breakpoints) of the trend +
      trigger + honest states.
- [ ] **No frontend money math** — every figure served from the Decimal backend.

## 6. BUILD PHASES (owner-gated — build begins only after §9)

- **Phase 0 — Backend-first (contract + data-model deltas).** The date-parameterised engine
  (`_value_one_holding(as_of=…)` + 3 resolvers, §2.2 verdict), consolidating `analytics.py`
  (⚠-B); the per-date FX store + ECB `eurofxref-hist` ingestion (§9-3); the snapshot-provenance
  migration (§9-1); new provider history paths — crypto (⚠-C) + AMFI historical (⚠-D, after the
  one confirming param test); the backgrounded backfill runner + served-progress endpoints
  (§2.6 precedent); the trade-date cost-basis reader + fund-ccy inference fix + edit-path FX
  consistency (§9-4). Regenerate `API-CONTRACT.json` + `docs/openapi.json` **same commit**; drift
  green; **fail-first RED on each delta**.
- **Phase 0a — Specimen + ratification.** `/kitchen-sink` specimens for the trend with
  backfilled/gap/flagged points, the snapshot-now trigger states, and the backfill progress
  surface across served states (running/ok/failed/no-egress). If any affordance needs a
  component the inventory lacks → **§5 DESIGN-SYSTEM amendment here**, never mid-build.
- **Phase 1 — Assembly.** Wire the trend to the backfilled history + provenance/gap rendering;
  the snapshot-now trigger (dr-8 async standard); the backfill trigger + progress UX; honest
  empty/error/stale/no-egress states; delete any frontend-decided honesty strings (serve them).
- **Phase 2 — Tests.** The `as_of=None` structural-equivalence test; per-date FX honest-missing;
  idempotent re-backfill; trade-date cost basis with NULL-fallback; provenance coexistence; both
  postures; typecheck/lint/contract/overflow green; `npm run check` **exit 0 from the frontend
  dir** (state the exit code — page-insurance §15b(a)).
- **Phase 3a — Scripted pre-pass (GREEN before the walk).** Drive the whole flow the owner would
  in **both themes across breakpoints**, **both postures** (mock + the §26-bis budget-aware real
  slice), 0 console errors; every geometry fix ships a **fail-first** measuring assertion
  reproducing the owner-visible defect first (page-net-worth §12b3-1). Wait each progressive card
  out of skeleton before asserting.
- **Phase 3b — Owner acceptance walk (LIVE) — judgment items only.** Owner drives the real
  rendered app; findings become numbered `r43-historical-backfill.md §*` entries, fixed and
  re-verified live. **Resolves pre-release-walk item 10c** (fund P/L cost-currency). **Owner
  closes the phase — never self-certify.**
- **Close ritual.** Record the close (plan §-retrospective + `RATIFICATION.md §6`); strike-check
  every §9/walk item against the diff; **`CURRENT.md` in the close commit's diff**; **`git push`**;
  **append R-43's walk rows to `pre-release-walk.md` item 10 AT CLOSE** (see §-pre-release below).

## 7. FUTURE PRE-RELEASE-WALK ITEMS (noted now; APPEND at close, not now)

Per the close-ritual, at R-43 close append to `pre-release-walk.md` item 10:
- **Resolve 10c** — India funds' P/L cost-currency: confirm trade-date cost-basis FX resolves
  the SGD-recorded / INR-NAV distortion (the item the pre-release walk already parks for the R-43
  walk, `pre-release-walk.md:99-102`).
- **Historical trend integrity** — the Net-worth trend renders a plausible multi-year line from
  2019; backfilled vs live points are provenance-marked; honest gaps show the served
  gap/flag marker (never a fabricated segment); no-egress backfill shows "not run".
- **Per-date FX honesty spot-check** — a pre-coverage date (INR before ECB coverage) or a
  non-publication day is flagged, never valued at 1.0.
- **Snapshot-now** — the trend-card trigger writes a dated point with served states, correct
  during/after an in-flight backfill.

## 8. TERMINOLOGY (GLOSSARY — §9-T, spec-first, PROPOSED not committed)

Author **spec-first** — `docs/specs/GLOSSARY.md` THEN `frontend/src/mocks/glossary.ts` (the
two-store parity guard, page-heatmap §13-1) — proposed terms:
- **Snapshot** — a dated record of the portfolio's valuation (assets / liabilities / net worth)
  at a point in time. *(Note: "Snapshot" already exists as a retired page/nav alias for Net
  worth, GLOSSARY `:317` / D-022 — the R-43 term is the **data concept**; reconcile spelling so
  the two do not collide.)*
- **Backfill** — reconstructing past valuations from price history + transactions + per-date FX,
  and persisting them as dated snapshots; a backfilled figure is marked as such and rests on
  honestly-available inputs (a date without inputs is a flagged gap, never fabricated).
- Any further term the build surfaces (e.g. a gap/estimated marker label) → same spec-first path.

---

## 9. OPEN ITEMS — PROPOSED RESOLUTIONS (the §9 one-pass is walked with the owner; ⚑ = owner rules)

*Do not resolve these here — **propose**. The rulings supersede these PROPOSED resolutions,
which stand as the reasoning of record (the R-38/R-42 §9 precedent). ⚑ marks where the owner
must rule.*

| # | Item | Why it blocks / what's needed | PROPOSED resolution (owner to approve) |
|---|------|-------------------------------|-----------------------------------------|
| **§9-1** | **Snapshot model — granularity, provenance, idempotency, coexistence.** | Backfilled granularity (cost/fidelity); how backfilled/live/snapshot-now points are distinguished; re-backfill must not duplicate; both stores write to `net_worth_snapshots`. | ⚑ **Granularity:** **monthly-back + daily for the recent window** (§2.7 — matches the data's real shape; only 2 holdings predate 2022; avoids fabricating fine granularity where no source exists). Alt: weekly throughout, or daily throughout (heavier). **Provenance:** add a **`source` column** (`backfilled`/`live`/`snapshot_now`) — a **migration** (contrast R-42) — mirroring the price-history `source` precedent. **Idempotency:** re-backfill keys on `(source, ts)`; a re-run replaces backfilled rows for a date, and a **real/live row always supersedes a backfilled one** (never the reverse), never duplicating. **Coexistence:** both snapshot tables are **empty today** (§2.1) — define the boundary now (backfilled historical vs worker forward) before both write. *Recommend monthly-back/daily-recent + `source` column.* |
| **§9-2** | **History acquisition — trigger UX, per-provider plan, progress, resumability, new-instrument.** | Where the user starts a backfill; per-provider call plan; served progress; resumable; what refreshes when an instrument is added later. | ⚑ **Trigger placement:** the **Net-worth trend empty/short-history state** (where the need is felt) **and/or** Settings → Data feeds. *Recommend the trend empty-state as primary (the first-open credibility rationale), with a Settings entry too.* **Runner:** a **new backgrounded runner** following the self-update **file-poll served-progress** precedent (§2.6) — `POST` to start, `GET …/status` to poll (running/ok/failed + log tail); **resumable** via the per-instrument/per-interval freshness marker (`market.py:790`). **Per-provider plan (§2.6):** AV equities = full-series 1 call each; **crypto = new path (⚠-C)**; **AMFI = new historical path (⚠-D)**; ECB = 1 fetch. **New instrument later:** its backfill runs on next user trigger (never a silent auto-poll). ⚑ confirm trigger placement + that it stays user-triggered. |
| **§9-3** | **R-8 ingestion — ECB historical store + per-date honest-missing.** | `ecb_fx_rates` is PK-on-currency (no history, §2.4); need per-date storage + ingestion + honest-missing. | **New dated FX store** (composite `(currency, as_of)` or `(base,quote,date)`) holding EUR→CCY per date; **ingest** `eurofxref-hist.csv` once (full history back to 1999) + periodic **append** of new dates. Derive **{USD→SGD, INR→SGD}** as **EUR-crosses** (§2.4 — use the EUR hub, not the live USD hub). **Per-date honest-missing:** a date with no rate (non-publication / pre-coverage) = **flagged valuation, never 1.0** (W-1b per-date); the store distinguishes "no rate on D" from "rate=1". ⚑ **Owner honesty call:** the ECB **weekend/holiday convention** — use the **last published trading-day rate** for a non-publication date (ECB's own convention), vs flag every non-publication date. *Recommend last-published-trading-day (standard), flag only true pre-coverage/absent.* **Validate real ECB numbers on the owner's stack** (the sandbox served fixture data, §2.4). |
| **§9-4** | **Transaction currency + trade-date cost basis (⚠-A — REFRAMED).** | Premise ("currency absent") is wrong — the column + trade-date-FX storage + edit UI already exist (§2.5). The real gaps: the reader, the fund-ccy inference, edit-path FX. | **No transaction-currency migration.** Wire the **reader** (the migration's "Unit C"): cost/P&L convert at **trade-date `fx_to_base`** where present (plug at `portfolio.py:334` / per-lot through `compute_fifo`); **all historical rows have `fx_to_base = NULL`** (§2.5) → an **honest fallback** (flag, or per-date ECB rate from §9-3), **never today's rate silently** (§4c). Fix the **India-fund native-ccy inference** (`portfolio.py:497`) so an AMFI-code holding's cost currency is **INR**, not the SGD txn default. Make the **edit path re-capture/preserve** `fx_to_base` on currency/date change (`portfolio.py:592-627` gap). ⚑ **Owner rules:** for a NULL-FX historical trade, (a) flag the cost/P&L as trade-date-FX-unavailable (D-020/D-076 excluded-count), or (b) substitute the **per-date ECB rate** from R-8 (§9-3) as an honest, dated rate. *Recommend (b) where R-8 has the date, else (a).* **Recorded numbers are never rewritten** (batch-1 refusal stands). |
| **§9-5** | **Honest-gaps rendering policy.** | How the trend renders dates with missing price/FX. | ⚑ **Owner honesty ruling.** Options: (a) **carry-forward last-known WITH a served gap/estimated marker**; (b) a broken line; (c) excluded span. *Recommend (a) carry-forward-with-visible-flag* — the trend stays readable and the honesty stays visible (served marker + reason, D-105); a broken line reads as an error, an excluded span hides real time. Never carry-forward *silently*. |
| **§9-6** | **Snapshot-now trigger.** | Placement, served states, interaction with an in-flight backfill, Net-worth accepted-page protocol. | **Placement:** an **icon `Button` on the trend card header** (the ruled placement; card-header cross-link/action convention, D-100). **States:** served in-progress (dr-8 `loading`) / success / error. **Interaction with backfill:** a snapshot-now during a running backfill writes a **`live`/`snapshot_now`-sourced** point (§9-1 provenance) — it never collides with backfilled rows; if the backfill is mid-write, the trigger is **disabled with a served reason** *(or queued)*. ⚑ confirm disable-vs-queue during backfill. **Net-worth accepted-page:** dated delta note + Phase-3a pre-pass re-run on touch. |
| **§9-7** | **What consumes the new history (scope guard) + the `analytics.py` drift (⚠-B).** | Trend obviously; does Portfolio performance/TWR ride backfilled history THIS milestone? And the pre-existing drift must be addressed. | ⚑ **Scope call:** **trend only now**; file a ROADMAP row for **performance/TWR-on-backfilled-history** if wanted. **BUT** the `analytics.py` fork (⚠-B) carries the **W-1 currency bug** (`analytics.py:262,399`) — a **correctness defect regardless of scope** — so R-43 **consolidates** `performance_series`/`time_weighted_return` onto the one date-aware engine (§2.2 verdict) as part of building it. *Recommend: trend-only consumption now + drift-consolidation in scope (it is a bug fix, not a feature). ⚑ confirm the scope guard.* |
| **§9-8** | **Demo + postures.** | Demo backfill story; mock vs real slice (budget-aware). | **Demo:** generate a **consistent backfilled trend** for the mock provider (the option-1 precedent — 1D/5D alive in demo, no dead control) so the trend renders a real line in demo/pre-pass (cf. page-net-worth ND-1 option-b synthetic seed). **Real posture:** the **§26-bis budget-aware slice** — backfill **one real held instrument end-to-end** (e.g. TSLA, which already has AV daily depth) on the premium key in Phase 3a. ⚑ confirm demo-generates-backfill vs real-only + honest empty. |
| **§9-T** | **Terminology (GLOSSARY).** | "Snapshot" (data concept — collides with the retired page alias, GLOSSARY `:317`), "Backfill" absent. | Author **spec-first** (`GLOSSARY.md` THEN `mocks/glossary.ts`, parity guard) — **"Snapshot"** (dated valuation record; reconcile with the retired nav alias) + **"Backfill"** (§8). Internal enums (`source`, `backfilled`) stay out of user copy. *No ⚑ expected — standard spec-first add.* |

---

## 9-bis. §9 RESOLUTIONS (the one-pass — walked with the owner in chat, 2026-07-18)

*The §9 one-pass happened in chat on 2026-07-18. The owner's standing delegation to the
architect governs (recorded as such; each ruling reversible by a dated entry). The PROPOSED
resolutions in §9 stand as the reasoning of record; these RULINGS supersede them where they
differ. Recorded as dated lettered entries per the R-38/R-42 precedent.*

- **§9-1 — 2026-07-18 — RULED: DAILY granularity throughout** (architect under owner
  delegation). Overrides the monthly-back/daily-recent proposal: ~2,550 rows for the owner's
  book is SQLite-trivial and uniform fidelity beats a granularity seam. **CONDITION:** Phase 0
  MEASURES the full-daily backfill runtime on the demo book and states it in the report; if a
  typical book exceeds ~3 minutes, the hybrid returns as a dated amendment.
  `net_worth_snapshots` gains a provenance column (migration): `backfilled | live | manual`.
  Scale valve → ROADMAP note (granularity/archival for very large books), filed not built.
- **§9-2 — 2026-07-18 — RULED: backfill trigger on the Net-worth trend card** (architect under
  owner delegation). The empty state's CTA becomes the trigger ("Build history" — exact copy
  proposed in the plan, served strings); served progress state; idempotent + resumable; re-run
  (after new instruments) via the same card's action. Snapshot-now icon `Button` is the ongoing
  affordance once history exists. Net worth is an ACCEPTED page: dated delta note + Phase-3a
  pre-pass re-run on touch; the control's exact form is ratified at the 0a specimen.
- **§9-3 — 2026-07-18 — RULED: ECB non-publication days carry forward the last published rate,
  unflagged** (architect under owner delegation). The standard daily-close convention; document
  it in the plan + GLOSSARY note. A genuinely missing stretch in the series → W-1b
  honest-missing, flagged, zero-contribution.
- **§9-4 — 2026-07-18 — RULED (reframed per ⚠-A: reader fixes, no migration)** (architect under
  owner delegation): (a) cost basis uses the STORED trade-time `fx_base` — `portfolio.py:334`
  stops converting at today's rate; (b) the India-fund SGD-vs-INR currency inference defect
  (`portfolio.py:497`) is fixed at cause; (c) edit-path FX consistency (edits preserve/recompute
  stored trade-time FX coherently). Historical-trade NULL-FX fallback: nearest published rate
  within ≤7 days, flagged approximate (served); beyond → honest-missing (cost stays
  native-labelled, P/L flagged). Recorded transaction numbers are NEVER rewritten (the R-42
  batch-1 refusal stands).
- **§9-5 — 2026-07-18 — RULED: honest gaps render as carry-forward with visible distinction**
  (architect under owner delegation). The trend line continues across price/FX gaps but the
  gapped span uses the ratified reduced-emphasis chart treatment and a served "carried forward
  from <date>" reason in the tooltip. No unmarked smooth line; no broken line.
- **§9-6 — 2026-07-18 — RULED: snapshot-now DISABLED with served reason during an in-flight
  backfill** (architect under owner delegation). "Backfill in progress" — the dr-7 honest-disable
  pattern.
- **§9-7 — 2026-07-18 — RULED: trend-only consumption now** + ROADMAP row "performance/TWR on
  backfilled history" (architect under owner delegation). **AND the ⚠-B consolidation is IN-SCOPE
  AS A CORRECTNESS FIX:** `analytics.performance_series` and `time_weighted_return`
  (`analytics.py:262,399`) are consolidated onto the one date-aware engine THIS milestone — they
  carry the W-1 currency bug; fail-first RED must prove that drift before the consolidation
  lands. Expect performance/TWR outputs to CHANGE when the bug dies; the report states
  representative before/after figures for the owner walk.
- **§9-8 — 2026-07-18 — RULED: demo generates a consistent backfilled trend** (architect under
  owner delegation; option-1 precedent; no dead chart in demo/pre-pass). Real posture = §26-bis
  budget-aware slice at 3a — backfill ONE real held instrument end-to-end on the premium key.
  Honest-empty for real-only surfaces where demo can't be consistent.
- **§9-T — 2026-07-18 — RULED: "Snapshot" + "Backfill" spec-first** (architect under owner
  delegation): GLOSSARY.md THEN mocks/glossary.ts, parity guard; reconciled with the retired
  alias (GLOSSARY `:317`); internal enums (`source`, `backfilled`) never in user copy.
- **AMFI archive test call — 2026-07-18 — AUTHORIZED** (architect under owner delegation): ONE
  read-only confirming call to `DownloadNAVHistoryReport_Po.aspx` in Phase 0 to pin the exact
  params (keyless, budget-free) BEFORE building the chunked fetcher.

---

**PHASE 0 GO — STOP AT 0a.** §9 is resolved (9-bis). Phase 0 is backend-first, one delta per
commit, fail-first RED on the real cause, contract regen same-commit with path-key count stated
(baseline 134), Decimal-only money math, served strings for every rendered state, mutating work
on demo/isolated instances only. **STOP at the 0a specimen** — the owner ratifies it in chat;
ratifications never in this CLI. Phase 1 arrives as a separate instruction.

---

## 10. PHASE 0 PROGRESS LOG (2026-07-18 session — the backend spine)

One delta per commit, fail-first RED on the real cause, gates green at each commit. The
**foundation + load-bearing engine are DONE**; the acquisition/orchestrator/rendering cluster
that the **0a pixel specimen** needs is **NEXT** (a rendered trend cannot exist until the
orchestrator writes backfilled snapshots and the served trend + demo generation feed it).

### DONE — committed, tested, gates green

- **Step 1 (§9-1) — provenance migration** — `net_worth_snapshots.source ∈
  {backfilled|live|manual}` (migration `a8f1c3d5e207`, off head `a7d3f2c15e94`). Idempotent +
  round-trips; existing forward rows default `live`. Pins green. — commit `7138e7d`.
- **Step 2 (R-8 / §9-3) — historical per-date FX store** — new `ecb_fx_history` table
  `(currency, as_of)` (migration `b1d4f7a92c08`); `eurofxref-hist.csv` parser (text-in,
  egress-free to test) + one-fetch fetcher through the egress choke point;
  `app/services/fx_history.py` (idempotent ingestion, a preloaded `HistoricalFx` EUR-hub
  resolver, `needed_currencies()` = the one derivation). Pins: exact cross-rate, §9-3 weekend
  carry-forward, W-1b pre-coverage → None, idempotent re-ingest, needed-set. **Real ECB numbers
  still to be validated on the owner's stack** (sandbox egress serves fixture data — §2.4). —
  commit `542d95f`.
- **Step 3 (§2.2) — the date-aware valuation engine (LOAD-BEARING)** — `value_portfolio` /
  `_value_one_holding` take an optional `as_of` behind the three resolvers (position = ledger
  FIFO truncated at the date; price+currency = `PriceHistory` close on/before, paired with
  `pricing_currency`; FX = the R-8 store). **The byte-identical pin holds: `as_of=None`
  reproduces today's valuation exactly — proven across the whole suite (1155 passed, +10 new, 0
  regressions).** W-1b per-date honesty threads through. — commit `0a6e364`.
- **Step 5(b) (§9-4b) — India-fund cost-currency inference AT CAUSE** — `portfolio.py:497` (and
  the as-of path) prefer the instrument's `pricing_currency` over the txn's recorded currency
  when the venue gives none; an INR fund recorded in SGD now derives INR cost, not SGD (the
  **pre-release-walk 10c root cause**). Recorded numbers never rewritten. Integration suite 648
  passed, 0 regressions. — commit `6f6d8aa`.
- **Step 5(c) (§9-4c) — edit-path trade-date FX re-capture** — `update_transaction` re-captures
  `fx_to_base`/`fx_base` after an edit (mirroring add), so changing currency/date never leaves a
  stale rate (§2.5 gap). Pin RED-first; 129 edit-surface tests pass. — commit `0dce8fb`.

### ⚠ SEQUENCING FINDING (2026-07-18) — steps 4 and 5(a) are DATA-COUPLED

Verified empirically on the demo book: `price_history` has **0 rows** and `ecb_fx_history` is
**empty**, so `value_portfolio(as_of=…)` returns positions but **0 priced**. Consequences:

- **Step 4 cannot land cleanly in isolation.** Consolidating `performance_series`/`time_weighted_
  return` onto the date-aware engine (which reads persisted `PriceHistory` via `_price_close_asof`)
  would **flatten the demo Portfolio performance line** — a regression to an ACCEPTED page — because
  the demo never persists `PriceHistory` (only `get_history_cached` does, lazily). A faithful
  consolidation must either preload history first or run after the backfill populates it.
- **Step 5(a) has the same shape.** The honest-missing fallback flips cross-currency cost to
  native-labelled when no per-date rate exists; with `ecb_fx_history` empty, the demo's
  cross-currency costs (BTC/XRP/funds) all go honest-missing → the accepted Portfolio/Net-worth
  cost figures change. Meaningful only once the R-8 store is populated.

**Both depend on demo data population — which is step 9 (demo generation of `PriceHistory` +
`ecb_fx_history`).** RE-SEQUENCE RATIFIED by the owner (2026-07-18): **step 9 → step 4 → step 5(a)**
→ steps 6/7/8 → 0a. Steps 9 and 4 are now DONE and non-regressing (below).

### DONE (cont.) — the re-sequenced cluster

- **Step 9 (§9-8) — deterministic demo history generation** — `app/seed/demo_history.py` generates
  (network-free, deterministic) `price_history` per held MARKET instrument (funds/manual skipped —
  a fund's history is AMFI NAV, step 6) + `ecb_fx_history` EUR→{USD,SGD,INR,EUR} with rates that
  MOVE across the span. 5789 price + 3668 FX rows; a full DAILY as-of sweep = **1284 days in ~13s
  (~10 ms/day) — validates the §9-1 DAILY-throughout ruling** (far under 3 min; no hybrid). Trend
  moves 11,539 (2023) → 62,158 (today). Full suite 1159 → 0 regressions. — commit `399df6e`.
- **Step 4 (§9-7 / ▲-B) — analytics consolidation** — `performance_series` + `time_weighted_return`
  now value each date through the ONE date-aware engine (per-date price + FX); the forked valuation
  + `_carry_forward` helper are DELETED. Fail-first RED (owner cond. #2): constant-price / moving-FX
  fixture proves the drifted series is FLAT (1342.618) while the truth moves. Before/after (demo,
  cond. #3): 2023-03-01 invested value **17,690.10 → 18,149.52 SGD (+459.42, ~2.6%)**; after 365d
  return 7.94%, TWR 70.58%. include_manual carries manual flat; long windows stride-capped at 500
  as-of valuations (logged). Full suite 1157, 0 regressions. **Accepted-page (Portfolio perf/TWR)
  figures legitimately change — dated delta + 3a pre-pass re-run covers it.** **Perf note:** /stats
  + /performance are heavier now (per-date valuation; key_stats timeouts degrade gracefully) — a
  batched as-of preload is a worthwhile follow-up for slow real hardware. — commit `d5f9a44`.

- **Step 5(a) — trade-date cost-basis FX** — cost basis converts at each open lot's trade-date FX
  (stored `fx_to_base`, else ≤7-day ECB fallback flagged `approximate`, else honest-missing
  flagged `cost_fx_unavailable`). Reader-only, no migration; gated behind a cross-currency-txn
  check (zero overhead for a domestic book). Demo: AAPL/RELIANCE at ECB trade-date rate flagged
  approximate, D05 (SGD) unchanged. Full suite 1159, 0 regressions. — commit `47065d7`.
  **§9-4 is now COMPLETE (a, b, c).**

- **Step 7 (§9-1/§9-2/§9-6) — backfill orchestrator** — `app/services/backfill.py`: `run_backfill`
  reconstructs a DAILY net-worth series through the date-aware engine (market at per-date price+FX;
  manual carried flat), `source='backfilled'`, idempotent + real-supersedes, no-egress-safe, served
  file-poll progress. `snapshot_now` writes `source='manual'`; 409-refused mid-backfill (§9-6).
  Endpoints POST `/net-worth/backfill`, GET `/net-worth/backfill-status`, POST `/net-worth/snapshot`;
  contract 134 → 137. USER-TRIGGERED (not in the demo seed — keeps the suite fast). Suite 1163,
  0 regressions. — commit `7774819`.
- **Step 8 (§9-5) — served trend** — `/net-worth/history` serves per-point `source` +
  `carried_forward` + served reason; new nullable `net_worth_snapshots.flags` (migration
  `c2e5a8b41f30`); the backfill flags a genuine per-date FX gap (W-1b), tightened so a single
  always-estimated holding does not flag the whole line. Contract regenerated. Suite 1165, 0
  regressions. — commits `7f47811`, `e16cbc9`.

**BACKEND TREND CHAIN COMPLETE + API-LEVEL SPECIMEN GREEN (2026-07-18).** On an isolated demo
instance, driving the whole flow through the API/services:
- (a) backfill = **1258 daily points 2023-01-12 → 2026-07-18 in 13.5s** (§9-1 measured; DAILY
  ruling holds); served trend = 1258 backfilled + 26 live points; **the line runs 742,489 →
  793,108 SGD** — a real multi-year trend, no longer flat.
- (c) carried-forward flag verified on a genuine FX gap (step-8 pin); demo trend clean (0 gaps).
- (d) snapshot-now writes a manual point; (f) 409-refused + served "Building history…" while a
  backfill is in flight.
- (e) TODAY's net worth = **797,193.17 SGD, unchanged** on the live path (byte-identical engine).
- (f-perf) ▲-B before/after stated at step 4.

- **§9-T — GLOSSARY** — "Snapshot" + "Backfill" spec-first (GLOSSARY.md → glossary.ts), parity
  green (64 pins). Reconciled with the retired page/nav alias (D-022). — commit `1f5a8fd`.
- **Frontend (Phase-1-into-0a) — Net-worth trend wiring** — the empty state's "Build history"
  primary Button (§9-2 trigger) + served progress polling (message + n-of-m + current date);
  once history exists, a header snapshot-now icon Button (§9-6, disabled with the served
  "Backfill in progress" reason during a run) + a Build/Rebuild action; a provenance note when
  the trend includes reconstructed history; the §9-5 carried-forward reason surfaced as the chart
  coverage note. Design tokens only; frontend check exit 0 (337 e2e + unit). — commit `65f4a35`.
- **§9-8 — demo trend now a CONSISTENT backfill** — replaced the synthetic 80%→100% easing
  (which interleaved with the real backfill as a visual comb, caught in the live drive) with a
  coarse (monthly) run of the real engine; `run_backfill` gains `stride_days` + `commit`. — commit
  `63cd864`.

**LIVE 0a PIXEL SPECIMEN — DRIVEN GREEN (2026-07-18, isolated instance, prod dist same-origin).**
Screenshots captured; the owner walk ratifies (never this CLI):
- **(a)** the Net-worth trend renders a **clean multi-year backfilled line** (2023→2026) with the
  Snapshot + Build-history header actions and the served provenance note.
- **(b)** clicking "Build history" shows the **served "Building history…" progress** (spinner on
  the button); the live daily backfill completed **1258 days in 11.5s**, then the trend refilled.
- **(d)** the snapshot-now icon Button is present and **disabled/grayed during the backfill**
  (§9-6 honest-disable) — verified in the progress screenshot.
- **(e)** today's headline is **unchanged** on the live path (byte-identical engine).

**OPEN FINDINGS for the owner walk (not blockers; recorded honestly):**
1. **Per-date-valuation perf.** `/portfolio/stats` + `/portfolio/performance` are materially
   slower now (per-date valuation; ~2.5–5s each) and the demo seed's backfill lifted the test
   suite ~7→~9.7 min. A **batched as-of preload** (resolve txns/prices once, value in-memory) is
   the worthwhile follow-up — flagged since step 4.
2. **A single transient 500** appeared once in the live drive under concurrent page reads during a
   backfill. WAL + a 30s busy timeout are already configured (`db/base.py:144`), so it is not a
   simple lock; likely a slow-request edge tied to finding 1. Verify on the owner walk.

### NEXT — remaining for the full milestone (owner-directed)

- **Step 6 — history acquisition** (network; owner validates on-stack). AMFI confirming call →
  chunked archive fetcher; CoinGecko `market-chart/range`; AV `outputsize=full`. Build vs fixtures.
- **Perf follow-up** (finding 1): batched as-of preload for the analytics + backfill hot paths.
- **Phase 1 polish / Phase 3a pre-pass** (both themes/breakpoints, no-egress state) → the owner
  0a ratification, then Phase 1 assembly proper.

---

## 11. WALK-FINDINGS LEDGER (real-instance, owner drive 2026-07-18 ~23:40)

The owner ran **"Build history"** on his **LIVE** instance and reviewed screenshots in chat.
**Step 6 (real history acquisition) is NOT built**, so the step-7 orchestrator reconstructed a
2019→2026 daily series against a price/FX cache that barely exists. Causes verified read-only
against a **copy** of the live DB (`.env` sha256 unchanged, live DB never written — mtime
`2026-07-18 23:38`). Reproduced through the real engine (`value_portfolio`, `key_stats`,
`performance_series`, `time_weighted_return`) on the copy. **F-1/F-2/F-3 = INVESTIGATED, causes
verified, NO fixes — fix sequencing decided in chat and likely couples to step 6 (coverage).**

**Shared root cause (all three):** the live acquisition stores were never populated on-stack —
`ecb_fx_history` has **0 rows** and `price_history` for the held book is ~1yr for 3 of 6 holdings,
**0 for both funds**, and **wrong-instrument garbage for the two crypto tickers** (AV
`TIME_SERIES_DAILY` is an equity endpoint — ⚠-C): live BTC quote **64,024.63 USD** vs AV daily
"BTC" close **28.38**; live XRP **1.0868 USD** vs AV daily "XRP" close **12.20**. Held-book
`price_history` (1d) earliest→latest: TSLA/SBICARD **2025-07-21**→2026-07-17, XRP **2025-11-20**,
BTC **2026-01-20**, funds 102000/145834 **none**. `ecb_fx_rates` (live/current) has 30 rows @
2026-07-17 (so the **live headline prices fine**); `ecb_fx_history` (backfill FX) is **empty** (so
every cross-currency holding zeroes in the as-of path). The backfill/analytics read
`ecb_fx_history`; the headline reads `ecb_fx_rates` — hence they disagree.

### F-1 — Max trend is a square pulse that ends low (data-honesty, P1) — CAUSE VERIFIED
- **Dump (copy):** `net_worth_snapshots` = **2739 rows, all `source='backfilled'`, all flagged
  `carried_forward`**, 2019-01-18→2026-07-18. Shape: **0.00** for 2019-01→2024-07-17 → **flat
  200,000.00** 2024-07-18→2026-01-19 → collapse **198.10** (2026-01-20) → **141.90** (last,
  2026-07-18). Only two step edges (`0→200000` at the BTC buy, `200000→198.10` at 2026-01-20).
- **Engine repro (copy):** the plateau = **BTC's recorded cost (5×40,000 SGD = 200,000)** carried
  as value (`_value_one_holding` cost fallback, `portfolio.py:503-506`, `estimated_value`). BTC is
  the **only** contributor on every date because its currency resolves to **SGD = base** (null
  `pricing_currency`, no symbol inference, txn recorded SGD → `_asof_holdings` `portfolio.py:358`),
  so `_hist_convert_checked` same-currency short-circuit (`portfolio.py:317`) spares it. Every
  other holding (TSLA/SBICARD/XRP/funds, USD/INR) hits `hist_fx.rate(…→SGD)=None` (empty
  `ecb_fx_history`) → `fx_ok=False` → **mv_base=ZERO** (`portfolio.py:537-548`, W-1b). At
  2026-01-20 BTC's garbage AV history begins (39.62), repricing 200,000→198.10; the tail 141.90 =
  5×28.38 (garbage). **Last point 141.90 ≠ headline 473,006.67** because headline uses live
  `quotes` + current `ecb_fx_rates` (all six priced), the backfill uses `price_history` +
  `ecb_fx_history` (empty).
- **Preflight gap (F-1 #4):** `run_backfill` (`backfill.py:94-177`) builds `days` = earliest-txn→
  today (`:106-117`) and values every day with **no coverage preflight** — no price/FX coverage
  check, no served coverage report, no warning; the only early-out is "no transactions" (`:113`).
  A preflight belongs at `backfill.py:106-118` and/or the §9-2 trigger endpoint
  (`POST /net-worth/backfill`). Note `gap = any(h.fx_unavailable …)` (`:156`) flags **every** point
  `carried_forward` — the whole-trend flag fires on 100% of rows, which is itself the coverage tell.

### F-2 — TWR/1Y −99.93%, drawdown −99.94% beside Total return +131.13% (correctness, P1) — CAUSE VERIFIED
- **Repro (copy, `key_stats`):** Total value 473,012.89, Total return **+131.13%**, TWR **−99.93%**,
  1Y **−99.93%**, Max drawdown **−99.94%**, 1Y vol 105.73% — all reproduced on the same card.
- **`performance_series` stats:** `start_value=200000.0`, `end_value=141.9`, `worst_day_pct=-99.9`,
  the **cliff at 2026-01-20** (200,000→198.10). The series is **BTC-only** — every other holding is
  FX-zeroed exactly as in F-1 — so it traces BTC's cost-plateau→garbage-price trajectory.
- **How zero-coverage enters (cite):** `performance_series` values each axis date through the
  consolidated date-aware engine — `value_portfolio(as_of=…, hist_fx=…)` at `analytics.py:250-251`;
  `time_weighted_return` likewise at `analytics.py:368-369` (+ cashflow rates via the same empty
  `hist_fx`, `:348`). With `ecb_fx_history` empty they inherit F-1's zeroing.
- **The honesty conflict (cite):** ONE card mixes two valuation bases — "Total return"
  (`analytics.py:180`) = `val.total_return_pct` from the **live** `value_portfolio` (`:50`, current
  quotes + `ecb_fx_rates`) → +131.13%; "1Y/TWR/Max drawdown" (`:183-188`) from the **date-aware
  backfill series** (empty `ecb_fx_history`) → −99.9x%. (Total return is itself distorted by F-3:
  its denominator `cost_basis` excludes the two zeroed costs.)
- **§9-5 honesty question (report only — no implement):** what should the perf series do on
  no/partial-coverage dates? (a) **exclude** the date (gap in the line) — honest but discontinuous;
  (b) **flag + carry** per §9-5 — readable, honesty visible, but a synthetic-looking flat run;
  (c) **refuse with served reason until coverage exists** (a coverage-gated card) — most honest for
  a card whose every number is coverage-dependent, but hides the card until step 6 runs;
  (d) exclude a holding from the series only on its uncovered dates (partial-portfolio series) —
  most faithful but needs per-holding coverage accounting. Trade-offs surfaced; owner rules.

### F-3 — TSLA & SBICARD cost basis silently ZERO (correctness, P1) — CAUSE VERIFIED
- **Txn dump (copy):** SBICARD buy 2019-01-18 `currency=INR fx_to_base=NULL` (1000×500=500,000 INR);
  TSLA buy 2022-07-18 `currency=USD fx_to_base=NULL` (100×400=40,000 USD); BTC/XRP/102000/145834 all
  `currency=SGD fx_to_base=1`.
- **Engine repro (copy, live path):** TSLA `cost_base=0.00 upl=49,176.80 cost_fx_unavailable=True`;
  SBICARD `cost_base=0.00 upl=8,785.22 cost_fx_unavailable=True` (upl == market value exactly).
  BTC 200,000 / XRP 50 / 102000 4,000 / 145834 600 all reconcile at face. **Portfolio
  `cost_basis=204,650.00 = 200,000+4,000+600+50`** — the two foreign costs excluded.
- **Cause (cite):** `_trade_date_cost_map` (`portfolio.py:376-435`). A foreign lot (`lccy != base`,
  `:414`) needs a trade-date rate: `acq_fx`=NULL (`:418-419`) → ≤7-day fallback
  `hist_fx.rate_near(lccy, base, acquired_ts, 7)` (`:423`) against the **empty `ecb_fx_history`** →
  None → `missing=True`, lot **excluded** (`:427-429`), holding flagged `"unavailable"` (`:433`) →
  `cost_override=(0.00,"unavailable")` applied at `portfolio.py:529-532` → `cost_base=0`.
- **Why the other four differ (F-3 #3 — the inconsistency IS the finding):** they were **recorded
  in SGD = base**, so `lccy==base` → domestic lot, cost taken at face rate 1 (`:414-416`),
  `has_foreign=False` → left on the unchanged path (`:431-432`). **One book, three cost behaviours**
  driven by the *recorded* currency: foreign-recorded (TSLA/SBICARD) → cost zeroed; SGD-recorded →
  cost at face; and separately, the *value* side of every non-SGD holding is zeroed in the backfill.
- **Silent? (F-3 #4 — YES, silent = W-1-class defect):** `cost_fx_unavailable`/`cost_fx_approximate`
  are computed in the engine (`portfolio.py`, `tax.py`) but **serialized nowhere** — absent from all
  API routes and the frontend (grep: 0 hits in `app/api/`, `frontend/src/`). The Holdings endpoint
  serves `cost_basis`/`unrealised_pl` per holding (`portfolio.py:81-82`) with **no flag**, so the
  0-cost and the value-equals-P/L are shown as fact. The value-side W-1b reason exists
  (`portfolio.py:247-250`) but does not fire here (the live value converts fine). **Silent exclusion
  from a headline P/L.** Recorded numbers are never rewritten (correct); the defect is the *unflagged
  omission*, not a rewrite.

**Fix sequencing (NOT decided here):** all three trace to absent coverage (`ecb_fx_history` empty +
sparse/garbage `price_history`) — so the fixes **likely couple to step 6** (real acquisition:
ECB `eurofxref-hist` ingest, AV `outputsize=full`, crypto history via CoinGecko not AV, AMFI
archive). Independent of step 6: the **backfill coverage preflight** (F-1 #4), the **perf-card
coverage/honesty policy** (F-2 §9-5), and **surfacing `cost_fx_unavailable`** (F-3 #4) are
render/served-string honesty gaps. Sequencing ruled in chat.

---

## 12. FIX BATCH — RULINGS + BUILD ORDER (2026-07-19, architect under the owner's standing delegation)

The §11 causes are verified. The fixes are ruled and sequenced. Rulings are dated, reversible by
a later dated entry (the R-38/R-42 precedent). The shared root — **step 6 (real acquisition)
never ran on-stack** — is now built as part of this batch, and the three render/served-string
honesty gaps (F-1 preflight, F-2 policy, F-3 surfacing) land alongside it.

### 12-R — RULINGS (dated 2026-07-19)

- **§12-R1 — F-2 policy: REFUSE-UNTIL-COVERAGE.** Date-aware metrics (TWR, 1Y return,
  volatility, drawdown) render an **honest served state** — *"Insufficient price & FX history for
  this window — build history"* — until the window has real coverage. **Principle pinned:** a
  headline risk metric is never computed from a series dominated by carried-from-nothing values.
  **Computability threshold (pinned):** the date-aware series is computable from the **first date
  at which every then-held holding has a real price within the §9-5 carry window AND per-date FX
  exists for that holding's price currency → base**; before that date the metric refuses. Each
  metric on the Portfolio card carries its **basis label** (live vs date-aware) — no mixed silent
  bases (F-2's exact defect: +131.13% live beside −99.93% date-aware on one card).
- **§12-R2 — F-3 surfacing: EXCLUSIONS ARE LOUD.** `cost_fx_unavailable` / `cost_fx_approximate`
  are **serialized and rendered**: excluded lots flagged on the Holdings row; Portfolio cost
  basis annotated (*"excludes N lots — FX unavailable"*); served reason strings (D-105).
  **Recorded numbers are still never rewritten** — the defect is the unflagged omission (D-020 /
  D-076 excluded-count), not a rewrite.
- **§12-R3 — Class-aware history capability.** A provider's history/intraday capability is
  **per asset class** (AV daily+intraday = equity/etf only). Fetching a class the provider cannot
  serve is **impossible by construction** — refused at the capability layer, mirroring the Flag-2
  quote-capability precedent. This is why the live BTC/XRP AV daily candles are wrong-instrument
  garbage (BTC "close" 28.38 vs live 64,024): AV `TIME_SERIES_DAILY` is an equity endpoint.

### 12-B — BUILD ORDER (one delta per commit; contract regen same-commit, baseline 137)

1. **F-3 surfacing** (§12-R2) — serialization + Holdings/Portfolio rendering; excluded lots flag;
   annotation counts correct; zero regressions on fully-covered books. Contract regen (new fields).
2. **ECB ingest wired into the product flow** — Build-history preflight ingests/refreshes
   `eurofxref-hist` (one keyless fetch) before valuing; idempotent append; no-egress → honest
   served refusal.
3. **Class-aware capability + garbage purge** (§12-R3) — capability gating per class; one-time
   idempotent purge of wrong-instrument crypto candles (crypto rows from AV daily/intraday),
   logged counts (dr-25/W-3); AV history for a crypto instrument refused at the capability layer;
   purge second run = 0.
4. **CoinGecko history adapter** (crypto daily range) — free-tier depth cited honestly; capability
   true for crypto daily; budget-aware chunking; pins on shape/keying (midnight-UTC daily,
   `source=coingecko`).
5. **AMFI archive fetcher** (`DownloadNAVHistoryReport_Po.aspx`, ~90-day chunks, back only as far
   as the book needs) — build against the documented params + a recorded fixture; exact params
   marked **TO-CONFIRM on-stack (▲-D)**; pins on chunk stitching + scheme filtering.
6. **AV equities full depth** (`outputsize=full`) for held equities — calls-per-instrument stated;
   12h idempotency marker honored.
7. **Coverage preflight on Build history (F-1)** — per-instrument coverage summary
   (earliest/latest real candle + FX coverage) served + surfaced in the trigger UI before running;
   the run proceeds with the summary visible; re-runs supersede (idempotent §9-1).
8. **F-2 policy implementation** (§12-R1) — computability threshold; served insufficient-coverage
   states on the Portfolio card; basis labels; pins: the owner's BTC-only scenario (garbage-free
   but coverage-poor) renders the served refusal, NOT −99.93%; a fully-covered demo book computes
   normally.
9. **Demo + gates** — demo lane stays consistent (generated coverage → demo computes everything;
   assert no demo regressions); full suite, ruff, contract count, frontend exit code from
   `frontend/`.

### 12-STOP — OWNER ON-STACK VALIDATION WINDOW (the ruled option-1)

After step 9, print — verbatim, copy-pasteable — the commands for the owner to run on THEIR
machine (their premium key, their egress): (a) the AMFI archive confirming call (exact URL +
params) for one of their schemes; (b) one CoinGecko daily-range call for BTC; (c) one AV
`outputsize=full` call for one held equity. Owner pastes the raw responses back; any param delta
→ a fail-first pin update stating the delta. Then owner restarts, opens Net worth, reviews the
served coverage preflight, runs **Build history**, reviews the trend + Portfolio card. Findings
return via chat. **No close ritual in this CLI** — 0a/3b ratification + F-ledger closure happen in
chat after the owner's re-run.

---

## 13. FIX-BATCH PROGRESS LOG (2026-07-19 session — the F-1/F-2/F-3 fixes + step-6 acquisition)

One delta per commit, fail-first RED on the real cause, gates green at each commit. **All nine
build-order deltas are DONE**; the batch STOPS at the owner's on-stack validation window (§12-STOP).

### DONE — committed, tested, gates green

- **§12-R rulings** — F-2 refuse-until-coverage, F-3 exclusions-loud, class-aware capability
  recorded (reasoning of record before the code). — commit `c1b8ff0` (docs-only).
- **Step 1 (F-3 surfacing / §12-R2)** — `cost_fx_unavailable`/`cost_fx_approximate` + an
  excluded-lot count (D-076) now SERIALIZED (`_hv`, `HoldingView`) with served reason strings
  (`provenance.cost_fx_*_note`, D-105); Holdings P/L cell shows a loud `!` marker; Portfolio card
  annotates cost basis ("excludes N lots — FX unavailable"). Recorded numbers never rewritten.
  Contract path-keys unchanged (137, additive fields).
- **Step 2 (ECB ingest wired)** — `app/services/acquire.py::acquire_history` fetches
  `eurofxref-hist` (one keyless fetch) + ingests idempotently BEFORE valuing; `run_backfill_background`
  acquires-then-values; **no-egress → served refusal, no series written** (Guarantee 5); offline
  demo (mock) skips the real fetch (seed-generated FX).
- **Step 3 (class-aware capability + purge / §12-R3)** — `ProviderCapabilities.history_asset_classes`
  / `intraday_asset_classes`; AV set to equity/etf only; `can_fetch_history/intraday`;
  `_history_source` refuses a class the source can't serve AT THE CAPABILITY LAYER;
  `repair_wrong_class_candles` (dr-25/W-3) purges wrong-instrument candles (AV crypto), interval-precise,
  guarded one-time + run in the acquisition preflight. Purge second run = 0.
- **Step 4 (CoinGecko history)** — `parse_market_chart_range` (daily, midnight-UTC keyed, no fabricated
  OHLC/zero) + `fetch_market_chart_range`; `services/coingecko.ingest_history` (source=coingecko,
  idempotent); coingecko capability `history=True, {crypto}`. Free-tier depth documented honestly.
- **Step 5 (AMFI archive)** — `parse_nav_history` (column-mapping by HEADER — robust to ▲-D order
  variance; N.A. → None), `chunk_date_ranges` (contiguous ≤90-day), `fetch_nav_history`
  (params TO-CONFIRM ▲-D); `services/amfi.ingest_nav_history` (scheme-filtered, source=amfi_nav).
- **Step 6 (AV full depth + acquisition orchestration)** — `acquire.acquire_prices` routes each held
  instrument to its class's provider (equity → AV `outputsize=full`, 1 call/instrument, 12h marker;
  crypto → CoinGecko; fund → AMFI chunks); unmapped instruments skipped honestly; wired into
  `acquire_history`. Runs only for real (non-demo, egress-allowed) instances.
- **Step 7 (coverage preflight / F-1)** — `services/coverage.coverage_summary` (per-instrument
  earliest/latest real candle + FX coverage + served summary; numbers match the store);
  `GET /net-worth/coverage` (**contract 137 → 138**); NetWorth trend card renders the served
  preflight (uncovered holdings) before/while a build runs.
- **Step 8 (F-2 refuse-until-coverage / §12-R1)** — `coverage.date_aware_computable` gate;
  `analytics.key_stats` serves TWR/1Y/vol/drawdown as null + the served refusal (never −99.93%),
  skips the per-date valuation when uncovered, and tags each metric's `basis` (live vs date-aware);
  Portfolio Risk-&-return card renders the served refusal. `demo_history` now generates a fund NAV
  series so the demo is fully covered and computes normally (no demo regression).
- **Step 9 (demo + gates)** — full backend suite **1189 passed** (0 regressions); `ruff` green;
  contract current at **138** path-keys; frontend `npm run check` **exit 0 from `frontend/`** (337
  e2e+unit). Demo lane consistent (coverage all-covered; date-aware metrics compute).

### STOP — OWNER ON-STACK VALIDATION WINDOW (the ruled §12-STOP)

The batch stops here. The owner runs the three confirming calls on THEIR stack (their premium key,
their egress), pastes the raw responses back, and any param delta becomes a fail-first pin update.
Then the owner restarts, opens Net worth, reviews the served coverage preflight, runs **Build
history**, and reviews the trend + Portfolio card. Findings return via chat. **No close ritual /
ratification in this CLI** — the 0a/3b ratification + F-1/F-2/F-3 ledger closure happen in chat
after the owner's re-run.

---

## 14. F-4 — INGEST INTEGRITY (2026-07-19, owner on-stack attribution + fix)

**Attribution RESOLVED — no interception anywhere** (owner, on-stack). `ax4z.com` is Myra Security
GmbH's legitimate CDN CNAME domain (WHOIS: Myra Security GmbH; php.net's zone file documents it as
"a shortcut domain for CNAMEs by myracloud"); ECB's `www` CNAME→Myra edge is ECB's real
infrastructure. **The defect:** ECB's edge served a **STALE-CORRUPT object** for the legacy
`eurofxref-hist.csv` URL — last-modified 2020-06-18, a nonsense counting-pattern row dated
2010-02-14 atop 2009 data, 733,262 bytes — while the **`.zip` is current + genuine** (verified
twice: top row 2026-07-17, SGD 1.4765; 635,583 bytes in <0.5s). No hosts/resolver/harness action;
all interception-related orders dropped.

**Provider confirmations (owner on-stack, all CONFIRMED):** (a) AMFI archive — `frmdt`/`todt`
`dd-MMM-yyyy`, semicolon CSV, header exactly as parsed (the ▲-D uncertainty is RESOLVED — the
step-5 built assumption was correct); (b) CoinGecko range — `[[ms,price],…]` daily, 360d on the
free tier; (c) AV `TIME_SERIES_DAILY&outputsize=full` — "Output Size: Full size" on the premium
key, working call carries `entitlement=delayed` (added to the AV client). Key was rotated after a
transcript leak; `.env` updated.

**F-4 fix (fail-first, gates green):**
- **Ingest the ZIP, not the CSV** — `ecb.fetch_ecb_hist` fetches `eurofxref-hist.zip` and unzips
  in-memory (`extract_hist_csv`, pure/testable); the legacy CSV URL is no longer fetched.
- **Ingest integrity guard** — new `app/services/ingest_guard.py`: `assert_fresh` (newest date must
  be within N days — the decisive stale-corrupt tell) + `assert_not_truncated` (a plausible row
  count). `fx_history.ingest_hist(max_staleness_days=7)` refuses a stale/corrupt or truncated file
  and writes NOTHING; generalised to CoinGecko + AMFI ingests (`verify=True` on the acquisition
  path) — AV history already returns `[]` on error (never a partial fabrication). RED = today's
  real file (newest date 2010) → refused.
- **Hard timeout + served error + resumable** — `acquire_history` wraps the FX fetch in
  `asyncio.wait_for(90s)` and the per-instrument price fetches in `wait_for(60s)`; a timeout or an
  integrity refusal degrades to a **served error** the trigger UI shows, and the build is
  retriable (no stage can spin indefinitely — the F-4 hang).
- **AV `entitlement=delayed`** — added to the AV client's base params (owner's working call).

## 16. F-6 — CRYPTO HISTORY NOT ACQUIRED (2026-07-19, owner on-stack re-run ~04:00) — INVESTIGATED

**Owner evidence (live re-run, 2026-07-19 ~04:00):** FX ingested via the zip (F-4 works live);
AMFI + AV full-depth acquired (SBICARD, TSLA, both funds); the Max trend renders a real multi-year
line ending at the headline; TWR honestly "—". **Coverage is 4 of 6 — BTC and XRP acquired
NOTHING.** The preflight still reads *"No price history yet — run Build history to acquire it"*
(which the owner just did), and both BTC/XRP quotes show STALE chips post-refresh.

Causes verified **read-only** against a **copy** of the live DB (`.env` sha256
`460a2da0…97afae6` unchanged, live DB never written — mtime `2026-07-19 03:54`). Reproduced through
the real routing/acquisition/coverage code.

### F-6 #1 — the BTC/XRP instrument rows (dump, copy)
| id | symbol | asset_class | pricing_ccy | currency | source_override | identifiers |
|----|--------|-------------|-------------|----------|-----------------|-------------|
| 15 | BTC | crypto | NULL | USD | **alphavantage** | **NONE** |
| 27 | XRP | crypto | USD | USD | **alphavantage** | **NONE** |

Both carry the dr-27-era `source_override='alphavantage'` (expected). **Neither has any
`instrument_identifiers` row — `coingecko_id` is ABSENT** (expected: the auto-linker only fires when
the override is being set to *coingecko*; the owner's correction set *alphavantage*, so the id was
never linked — `market.py:287-295`). `price_history` for both = **0 rows** (the step-3 purge cleared
the old AV wrong-instrument garbage; nothing replaced it). The other 4 held instruments have deep
1d history (SBICARD 1562, TSLA 1883, 102000 1846, 145834 2279) and `ecb_fx_history` is populated
(226,615 rows, 1999→2026-07-17) — so coverage is genuinely 4/6.

### F-6 #2 — what the orchestrator DECIDED for BTC/XRP (routing trace, file:line)
The acquisition orchestrator `acquire_prices` routes **by asset class**, NOT by the quotes-lane
override: the crypto branch (`acquire.py:160-164`) never consults `source_override`. So the AV
override does **not** cause a capability refusal here — crypto is already sent to CoinGecko, not AV.
**The branch that skipped them is the missing CoinGecko id:** `_identifier(instr.id,
"coingecko_id")` → `None` → `counts["skipped"] += 1` + logs *"crypto has no coingecko_id — skipped
(honest)"* + `continue` (`acquire.py:161-164`). **There is no auto-resolution at acquisition time.**
Verdict: the blocker is **missing coingecko id + no auto-link at acquisition**, not the AV override
(the override matters only for QUOTES — F-6 #4).

### F-6 #3 — why the served no-history reason is generic, not the blocker (file:line)
`coverage_summary` derives the served per-instrument string from **row presence only**
(`coverage.py:90-91`): `if not has_price: summary = "No price history yet — run Build history to
acquire it"`. It never inspects WHY history is absent (no mapping vs class-unservable vs
not-yet-run), so BTC/XRP — genuinely blocked on a missing CoinGecko mapping — are served the exact
CTA the owner just performed. This is the R3 defect.

### F-6 #4 — the stale crypto quote chips (data + file:line)
Live BTC/XRP quotes (copy): `source='alphavantage'`, `entitlement='delayed'`, BTC `64,494.96 USD`,
XRP `1.0924 USD`, `received_at 2026-07-18 19:53` — **~8h before the DB mtime (07-19 03:54)**. AV
serves a **real** crypto quote via its **currency** endpoint (`CURRENCY_EXCHANGE_RATE`, `_raw_fx`),
NOT `GLOBAL_QUOTE` — `external.py:176-184` (BTC/XRP ∈ `_CRYPTO`), labelled `DELAYED`. Staleness:
`_is_stale` (`market.py:32-39`) gives a `delayed` quote only the short `stale_after_seconds=900`
(`config.py:69`) threshold — the end-of-day 30h grace applies only to `end-of-day`/`official_nav`.
Crypto trades 24/7 and the last successful crypto quote fetch was 07-18 19:53, so at view-time the
~8h-old value exceeds 900s → **flagged stale**. **Verdict: a GENUINELY stale value (real, delayed,
~8h old), not a mislabel** — the chip is honest and correct. The deeper issue is that the AV
quotes-override keeps crypto quotes on AV's FX endpoint instead of the crypto lane's natural
provider (CoinGecko). Per R4 this is a **recommendation for a chat ruling — NOT an auto-migration**
(§17-R4 below).

## 17. F-6 FIX BATCH — RULINGS + BUILD ORDER (2026-07-19, architect under the owner's standing delegation)

Rulings dated 2026-07-19, reversible by a later dated entry (the R-38/R-42 precedent):

- **§17-R1 — history acquisition routes by CLASS CAPABILITY, not the quotes-lane override.** A
  quotes correction is a quotes decision; it must never block history acquisition from the provider
  that can serve the class (crypto → CoinGecko). `acquire_prices` already routes by class; the AV
  override is made irrelevant to history by construction. **Pin:** a crypto instrument with an AV
  quotes-override still acquires CoinGecko history.
- **§17-R2 — CoinGecko id auto-resolution at acquisition time**, reusing the ONE existing linker
  `_link_coingecko_by_symbol` (no second implementation). Unambiguous symbol → link + proceed;
  ambiguous → resolve to the canonical **top-market-cap** primary when it is the clear primary
  (BTC → bitcoin, XRP → ripple), else serve candidates. **Disambiguation rule (pinned):** the coin
  master's stored `market_cap_usd` is unreliable (only 2 of 17,630 rows carry it — the `/coins/list`
  sync has no cap), so on an ambiguous symbol the linker fetches live caps for the candidate ids via
  the existing `/simple/price?include_market_cap` (`fetch_prices`, ONE call, budget-aware), persists
  them, and links the candidate whose positive cap **dominates** every other (runner-up is None/0,
  or top ≥ 10× runner-up). No dominant cap → served candidates (never a silent guess). Graceful
  fallback to the stored caps if the fetch fails (egress/network). **Pin:** BTC and XRP both resolve;
  a genuinely ambiguous minor symbol (comparable/no caps) serves candidates.
- **§17-R3 — no-history reasons state the BLOCKER**, never a CTA the user just performed:
  `coverage_summary` names the cause for an uncovered instrument (*"No CoinGecko mapping for BTC — …"*
  / *"No provider supplies <class> price history"*), falling back to the build CTA only for a
  genuinely not-yet-built, mappable instrument. Served at the trend-card preflight (D-105).
- **§17-R4 — stale crypto chip: REPORT + RECOMMEND, no auto-migration.** #4 verified the chip is
  honest (real `delayed` value, ~8h old). The AV quotes-override on a crypto instrument is the
  wrong-provider root; the **recommendation** (for a chat ruling) is to drop the AV override on
  BTC/XRP so crypto quotes route to CoinGecko per the crypto lane — the owner's overrides are **NOT**
  auto-migrated (the R-42 batch-1 no-silent-rewrite precedent, extended to quotes-lane config).

### 17-B — BUILD ORDER (one delta per commit; contract stays 138 — no API-shape change)
1. **§17-R2 linker disambiguation** — `_link_coingecko_by_symbol` gains top-market-cap resolution
   for ambiguous symbols. Fail-first RED: BTC/XRP resolve to bitcoin/ripple; a comparable-cap minor
   symbol serves candidates.
2. **§17-R1/R2 wiring** — `acquire_prices` auto-resolves via the linker before skipping, then fetches
   CoinGecko history. Fail-first RED: a crypto with an AV override + no id acquires CoinGecko history.
3. **§17-R3 blocker strings** — `coverage_summary` names the blocker. Fail-first RED: an uncovered
   unmapped crypto serves the mapping blocker, not the build CTA.
4. **Gates + demo** — full suite, ruff, contract 138, frontend `npm run check` exit 0 from `frontend/`.

## 18. LESSONS (recorded)

- **§15-L1 (F-4) — Provenance is not integrity.** Even the genuine, authoritative source served a
  **six-year-stale corrupt object** from its own edge. Authenticating the *source* (WHOIS, CNAME,
  TLS) proves origin, not payload correctness. **Freshness + sanity verification is mandatory on
  every ingest** — the newest date must be recent and the parse non-truncated — and a failing
  check REFUSES the data with a served error, never a silent bad write. Generalised across every
  history/FX parser (ECB, AMFI, CoinGecko, AV).

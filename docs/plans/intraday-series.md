# intraday-series — Intraday price series (ROADMAP R-42) build plan

> **STATUS: §9 RESOLVED (owner 2026-07-18, in chat) → PHASE 0 IN PROGRESS (backend-first,
> STOP at 0a specimen).** R-42 was **ACTIVATED** with an owner **definition** at the
> data-feed-routing §14dr-13 re-walk (2026-07-18; `ROADMAP.md:54`), sequenced as the
> milestone **immediately after data-feed-routing closes, BEFORE Help**. data-feed-routing
> (R-38) is **CLOSED** (RATIFICATION §6, 2026-07-18; `CURRENT.md:20`). This file is the full
> plan authored per `TEMPLATE-page-build.md` (adapted for a feature milestone the way
> `data-feed-routing.md` was), **verify-first** (every claim cites `file:line`). **The §9
> one-pass was walked with the owner in chat on 2026-07-18 and every item is now RULED** —
> the rulings are recorded in **§9-RULINGS** below; the §9 PROPOSED table stands as the
> reasoning of record. Build now proceeds **backend-first** (Phase 0), **STOPPING at the
> Phase 0a specimen** for owner ratification in chat. Phase 1 does not begin here.

---

## 0. WHAT R-42 IS

An **intraday price series** — sub-daily bars — so the **1D / 5D** ranges on the
Instrument Detail chart can show an honest intraday granularity instead of the daily-only
store they promised. dr-7 (`data-feed-routing.md §18`, `§14dr-7`) **disabled 1D/5D with an
honest reason** ("Intraday prices aren't available yet — daily history only") pending this
milestone; R-42 re-enables them **only where the data honestly exists**.

The platform still **never fabricates a price** and **never advises**. An intraday series
is shown only when it was actually fetched and stored; a range with no intraday data stays
honestly disabled (the dr-7 posture holds until the fetch runs), and **every** greyed state
carries a **served** reason (D-105) — a change from dr-7's frontend-hardcoded string.

## 1. OWNER DEFINITION (2026-07-18, verbatim intent — PRESERVED)

Recorded at activation (`data-feed-routing.md §20 R-42`, `ROADMAP.md:54`) — the three
properties the milestone must honour:

1. **Tier-aware.** The fetch respects the **learned `av_tier`**. The **free tier keeps the
   honest disabled 1D/5D** (intraday is a premium-tier capability); a premium tier enables
   the intraday fetch. No tier is ever assumed — the tier is the one already learned/served,
   not invented.
2. **User-triggered.** An **explicit fetch per instrument / per range** — never a
   background poll or scheduler. This inherits the budget discipline named at dr-7:
   **`alphavantage free ≈ 25 req/day`** (the constraint that makes a poll dishonest in the
   first place).
3. **Persisted permanently once fetched.** An intraday series, once pulled, is **stored and
   reused** — no re-fetch on every view. Storage is the existing `PriceHistory.interval`
   seam.

> **Owner sub-expectation recorded at dr-7 / ROADMAP:** **1-min bars for 1D** (~390 pts),
> **daily for 1M/1Y** (unchanged). 5D's interval is a §9 owner call (§9-2).

## 2. VERIFY-FIRST CURRENT-STATE SURVEY (all claims cited `file:line`)

*Read the engine before assuming shapes (D-019). Four survey passes, 2026-07-18.*

### 2.1 — The storage seam: the interval dimension is structural, not incidental

The `price_history` unique key is `ix_hist_instr_interval_ts = (instrument_id, interval,
ts)` (`app/models/__init__.py:340`) — **interval is in the key.** batch-8's dr-25 fix
(`a7d3f2c15e94`) made the write path date-normalise `ts` to `00:00:00 UTC` **for daily
intervals only**:

- `_DAILY_INTERVALS = frozenset({"1d", "1w", "1mo"})` (`app/services/market.py:436`).
- `_norm_hist_ts(ts, interval)` returns `ts` **unchanged** when `interval not in
  _DAILY_INTERVALS` (`market.py:444-448`); intraday bars keep their **real per-bar ts**.
- The read `_from_db` filters `PriceHistory.interval == interval` as a **hard SQL equality**
  (`market.py:579`); `_collapse_daily_rows` **early-returns for non-daily** (`market.py:471`);
  the one-time `repair_history_demo_residue` is scoped to `interval.in_(_DAILY_INTERVALS)`
  (`market.py:493`).
- The migration itself records the intent: *"Intraday intervals (R-42) are untouched"*
  (`a7d3f2c15e94_price_history_date_key.py:14`); model comment: *"admitting distinct
  intraday bars (R-42) under the same date"* (`app/models/__init__.py:337-339`).

**Conclusion (load-bearing for §9-1):** a daily-series read (`interval="1d"`) can **never**
return an intraday row, and vice versa — the partition is **structural**. The dr-25 "comb"
was demo-vs-real at two timestamps *within one interval*, not a daily-vs-intraday mix. **No
new table is required; no migration is required** — the `interval` column and the exact-ts
unique index already partition the two cleanly.

### 2.2 — The persistence / idempotency seam already keys per interval

`get_history_cached(session, symbol, interval, start, end, max_age_hours=12,
allow_fetch=True)` (`market.py:521-528`) refetches *"at most once per `max_age_hours` per
instrument+interval"* via a `Setting` marker `hist_fetched:{instrument.id}:{interval}`
(`market.py:561`). The upsert (`market.py:627-661`) inserts new candles, lets a **real**
candle supersede a **demo** one *for daily* (the dr-25 precedence), and **never overwrites an
existing real row** (`market.py:661`). Because the marker and the key are already
interval-scoped, intraday persistence and idempotent re-use are the *same* seam, not a new one.

### 2.3 — dr-7 honest-disable is FRONTEND-HARDCODED and NOT tier-aware (a D-105 gap)

- The range control is `Segmented` with a `disabledPeriods?: Record<string,string>` prop
  (value → reason) added by dr-7 (`frontend/src/components/ui/PriceChart.tsx:35-38, 269-281`).
- **But the disable set and the reason string are module-level frontend constants**:
  `INTRADAY_REASON = "Intraday prices aren't available yet — daily history only."` and
  `DISABLED_PERIODS = { "1D": INTRADAY_REASON, "5D": INTRADAY_REASON }`
  (`frontend/src/routes/InstrumentDetail.tsx:50-51`). The disable is **unconditional** — it
  keys off **no** served signal and **no** `av_tier`. The backend serves no per-range
  enabled/disabled flag. This is a **D-105 gap**: unlike the tier-note (§2.4), the disable
  reason is a frontend literal, not a served display string.
- The chart request sends **`days` only** — `getInstrumentHistory(sym, periodToDays(period))`
  → `/instruments/${symbol}/history?days=${days}` (`frontend/src/api/instruments.ts:55-57`);
  `periodToDays` maps range→**days**, never an interval (`InstrumentDetail.tsx:52-59`). There
  is **no range→interval mapping anywhere**.
- The chart **truncates each candle ts to the date**: `t: c.ts.slice(0, 10)`
  (`InstrumentDetail.tsx:110`) — the current consumption path **discards time-of-day**, so it
  cannot render intraday bars without change.

### 2.4 — `av_tier` is learned IN-MEMORY (not persisted) and already served

- Learned from the first `INDEX_DATA` response: `_index_entitled: bool | None`
  (`app/providers/market/external.py:96-99`); `av_tier` property maps `{None:"unknown",
  True:"premium", False:"free"}` (`external.py:107-110`). Premium is proven by a valid index
  series (`external.py:140`); free only by an explicit "entitle" notice (`external.py:149-153`).
- **It is in-memory on the provider singleton for the process lifetime — not a DB row/column.**
  A one-time probe primes it (`app/api/v1/routes/system.py:131-132`, `get_quote("DJI")`).
- Already **served** (D-105): `system.py:145` (`av_tier` on `/system/data-source`),
  `portfolio.py:288-292` (`provider_tier_note`). Already **gates** behaviour: `av_tier_note`
  serves *"index via ETF proxy — key not premium"* for `alphavantage` + `free`/`unknown`
  (`market.py:271-278`); `supports_indices` returns `False` once proven free (`external.py:101-105`).
  Displayed read-only in Settings → Data feeds (`frontend/src/routes/Settings.tsx:492-517`) and
  Pricing Health (`PricingHealth.tsx:262-267`).

### 2.5 — Provider intraday capability: mostly ABSENT; the cache layer is already intraday-aware

The provider Protocol is `get_history(instrument_id, interval, start, end)`
(`app/providers/market/base.py:26-28`) — `interval` is a free-form `str`, no enum.

| Provider | File | Intraday today? | Note |
|----------|------|-----------------|------|
| Alpha Vantage | `external.py:207-243` | **NO** | `interval` arg **ignored**; always `TIME_SERIES_DAILY`/`INDEX_DATA`+`"daily"`. Needs `TIME_SERIES_INTRADAY` + `1min/5min/…`. `Semaphore(1)` (`:95`), `fetch_on_demand=False` (`:88`). |
| Yahoo | `yahoo.py:209` | **NO** | `interval` ignored; hardcodes `"interval":"1d"`. Endpoint natively supports intraday — small change. |
| Mock | `mock.py:135-160` | **YES (30-min)** | `step = timedelta(minutes=30)` for any non-daily interval (`mock.py:139`). Covers the lane for tests, but cadence ≠ owner's 1-min (§9-7). |
| CSV | `csv_provider.py:84-89` | YES (via mock) | Delegates to mock. |
| CoinGecko | `coingecko.py` | **NO (no history at all)** | Spot-price only (`/simple/price`); no `get_history`. Coin intraday possible via `/market_chart` — would need adding. |
| AMFI | `amfi.py:33-41` | **N/A** | Once-daily NAV (`nav_date: date`); intraday **meaningless** — honest disable. |
| Kite / EODHD | `kite.py:173` / `eodhd.py:163` | NO | Kite history returns `[]`; EODHD hardcodes daily. |

`ProviderCapabilities` declares `history: bool` but **no `intraday` flag** (`router.py:37`) —
a clean seam to add. There are **no numeric rate constants** anywhere — only the "≈25 req/day"
prose (`external.py:9`) plus the semaphore + `fetch_on_demand=False` disciplines.

### 2.6 — Routing: history rides the ACTIVE PROVIDER; the matrix can block but not redirect

`route()` consults the matrix at **step 3.5** (`router.py:291-307`, AMENDMENT-A PREPEND).
History reuses that decision via `route_for_instrument` (`market.py:604-608`) but the gate
`_history_source(diag, active_name)` **refuses** any source `!= active_name` with
*"history owned by {src}, not the active provider"* (`market.py:41-59`), and the actual fetch
calls `get_provider().get_history(...)` — the **global active provider** (`market.py:616`).
So today the matrix can only **block** a history fetch (→ cache-only), never **redirect** one;
history effectively rides the **active provider**. R-38 §9-6 ruled the matrix **quotes-lane
scope**; extending it to a second (history/intraday) lane is a **scope decision** (§9-6).

### 2.7 — Chart consumption + benchmark

- Endpoint: `GET /instruments/{symbol}/history` — `interval: str = Query("1d")`, `days: int
  = Query(180, ge=1, le=3650)` (`app/api/v1/routes/markets.py:478-494`); response
  `{symbol, interval, candles: [{ts, open, high, low, close, volume}]}` (Candle schema
  `app/schemas/common.py:72-78`). This is the **only** endpoint that accepts an `interval`.
- The **benchmark** is on the **Portfolio → Performance** chart (NOT Instrument Detail). It
  rides `get_history_cached(session, benchmark, "1d", start, end)` to define the axis
  (`app/services/analytics.py:238-242, 275-288`). Every analytics/system history caller
  hardcodes `"1d"` (`analytics.py:239,276,383`; `system.py:569`).

### 2.8 — Refresh + budget

- Refresh-all is **frontend-orchestrated** across **quotes + FX + news** and **explicitly
  excludes history** and masters (`frontend/src/api/pricing-health.ts:89-131`; the quotes
  endpoint `POST /system/refresh-data` iterates `_display_symbols` calling `refresh_quote`
  only, `system.py:508-550`; dr-17, `data-feed-routing.md:1701-1719`). History has its own
  endpoint `POST /system/fetch-history` (`system.py:553`), **not** part of refresh-all.
- **dr-15 lesson:** a refresher that **skips on cache-state** lies (CoinGecko Sync-now kept a
  2-coin stale cache because `if coins == 0` gated the refetch — `data-feed-routing.md:1548-1571`).
- **Budget:** no per-day call counter exists; the disciplines are the 12h freshness marker
  (`market.py:527,561-569`), the refresh time-budget (`budget_s=40`, `per_symbol_s=8`,
  `system.py:522-523`), the AV `Semaphore(1)` + `fetch_on_demand=False`, Yahoo pacing/429
  breaker (`yahoo.py:91-101,148-163`), and the **§26-bis budget-aware real slice** rule (2–3
  instruments, `data-feed-routing.md:2053-2061`).

## 3. SCOPE & NON-GOALS

**In scope.** Intraday fetch for the ranges the owner named (1D primarily; 5D per §9-2), on
the **Instrument Detail** chart, **tier-aware** (server-side `av_tier` gate) + **user-triggered**
(explicit per-instrument/per-range, no poll) + **persisted forever** (the `interval` seam).
Re-enabling the dr-7 disabled ranges **only where intraday honestly exists**, with **served**
disable reasons (D-105) everywhere else. Provider intraday adapter (AV + Yahoo at minimum).
Carries the **dr-25 final chart sign-off** (1D/5D re-enable here — `data-feed-routing.md:2302-2307`,
`pre-release-walk.md:18-24`).

**Non-goals (stated, not built).** No background poll/scheduler (owner definition). No
intraday on **Portfolio → Performance** or its **benchmark** (stays daily — §2.7/§9-5). No
intraday for **mutual funds** (AMFI NAV is once-daily — honest disable) or any class/provider
that cannot serve it honestly. No historical **backfill** of intraday (that is not what
"user-triggered per range" means). No new routing lane unless the owner rules §9-6 that way
(default: active-provider-only). No client-side re-derivation — the chart consumes served
series and served disable strings (D-105). No R-43 (valuation backfill) coupling.

## 4. DATA MODEL

**No new table, no migration.** §2.1 proves the existing `price_history`
(`app/models/__init__.py:321-341`) already carries intraday cleanly: `interval` is in the
unique key, non-daily `ts` is kept per-bar, and the daily normalise/collapse/repair helpers
all early-return for non-daily. Intraday rows are distinguished by their `interval` value
(e.g. `"1min"`, `"5min"`) and `source` (provider provenance, already added by dr-25).

**The one structural guard R-42 must ADD (proposed, §9-1):** a test that pins the interval
partition — an intraday-interval read never returns under a daily query and vice versa — so
the dr-25 comb is **structurally impossible** for the daily-vs-intraday axis, not merely
absent by luck. (jsdom cannot help here; it is a backend test.)

## 5. API SURFACE

### 5a. Endpoints consumed (already in the frozen contract)

| Method + path | Purpose here | Shape pinned? |
|---------------|--------------|---------------|
| `GET /instruments/{symbol}/history?interval=&days=` | intraday candles (interval param already exists, unused by the frontend) | `{symbol, interval, candles[]}` (`markets.py:490-493`) |
| `GET /system/data-source` (serves `av_tier`) | the tier signal the gate keys off | `system.py:145` |

### 5b. Contract deltas (needed — BUILD BACKEND-FIRST)

Each row is built backend-first, regenerating `API-CONTRACT.json` + `docs/openapi.json` in
the **same commit** (freeze rule; `make api-contract-check`). The **magnitude and exact
shape are a §9 owner call** (§9-2/§9-3/§9-9) — listed here as the reasoning of record.

| kind | Endpoint (current → intended) | Decision | Why |
|------|-------------------------------|----------|-----|
| reshape | `GET /instruments/{symbol}/history` → gains **served per-range availability** (enabled/disabled + **served reason**, tier- & capability-aware) | §9-9 | Move the dr-7 disable decision from a frontend constant (`InstrumentDetail.tsx:50`) to a **served** D-105 truth; the frontend renders it, never decides it. |
| reshape/add | the intraday **fetch trigger** path — user-triggered per-instrument/per-range fetch, **server-side `av_tier` gate** | §9-3 | Reuse `get_history_cached` with a real intraday interval; refuse intraday server-side when `av_tier != premium` (not just UI-greyed). |

> The exact endpoint boundary (reshape the existing history route vs a sibling
> `availability` reader vs a POST fetch trigger) is proposed in §9 for the owner to rule;
> the **shape** is the binding artifact, the path-key count is reported as observed.

## 6. ROUTING INTERACTION

Per §2.6, history rides the **active provider**; the matrix can block, not redirect.
**Proposed default (§9-6):** intraday rides the **active provider only** — add an
`intraday: bool` capability to `ProviderCapabilities` (`router.py:37` seam) so
`_history_source` refuses intraday with a **served** reason when the active provider lacks it,
exactly as it already refuses non-owned history. A future intraday-aware **matrix** lane is a
**ROADMAP note**, not this milestone — unless the owner rules otherwise (§9-6 ⚑).

## 7. FRONTEND CONSUMPTION

- **Range → interval mapping** lands in `InstrumentDetail.tsx` (where `periodToDays` lives,
  `:52-59`): 1D → 1-min, 5D → §9-2 interval, 1M/3M/6M/YTD/1Y/5Y/Max → daily (unchanged). The
  request passes the mapped `interval` (the endpoint already accepts it, `markets.py:481`).
- **Intraday ts rendering:** replace the date-truncation `c.ts.slice(0, 10)`
  (`InstrumentDetail.tsx:110`) with full-ts handling for intraday intervals (x-axis shows
  time-of-day for 1D, date for 5D). Served candle ts is ISO **with time** (intraday is **not**
  midnight-normalised — §2.1).
- **The disable/enable + reason is SERVED (D-105)** — the frontend renders `disabledPeriods`
  from the served availability map, deleting the hardcoded `INTRADAY_REASON`/`DISABLED_PERIODS`
  constants (`:50-51`). No dead controls: a range is enabled only where data honestly exists
  or can be fetched; otherwise disabled **with a served reason**.
- **The trigger** is the range button itself (commit-on-pick; the first-run F3
  confirm-the-suggestion precedent, `TEMPLATE-page-build.md:274-279`) with the **dr-8 async
  standard** (`Button`/`Segmented` loading → `disabled` + `aria-busy` + perceptible pending,
  re-click guarded) — §9-3/§9-10 ⚑.

## 8. VOCABULARIES / COMPONENTS / TERMS

- **GLOSSARY adds (spec-first, then `mocks/glossary.ts`, parity guard `test_glossary_parity.py`
  — page-heatmap §13-1):** **"Intraday"** and **"Interval"** are absent from
  `docs/specs/GLOSSARY.md` (verified). Proposed spec-first entries (§9-T). Range labels
  (1D/5D…) already exist as chart copy; `interval` internal literals (`1min`/`5min`) are
  **never** user-facing (copy hygiene, page-chrome §11-8).
- **No new MASTER-DATA vocabulary.** The user picks a **range**, not an interval; the
  range→interval mapping is internal.
- **Components:** ratified inventory only — `Segmented` (range control, already has the dr-7
  disabled-option state), `PriceChart` (`disabledPeriods`), the dr-8 `Button loading`
  standard. If the trigger needs an affordance the inventory lacks, that is a **§5
  DESIGN-SYSTEM amendment raised at Phase 0a** (§9-10), never improvised.

## 9-precursor. DECISIONS IN FORCE

| Decision | What it requires here |
|----------|-----------------------|
| **D-105 / D-005 / P-1** | disable/enable + **reasons** are **served** display strings; range→interval routing is not frontend math; one canonical derivation. |
| **Guarantee 3** | every greyed/empty range shows a **reason**; insufficient/absent intraday → honest disable, never a fabricated 1-3-candle "1D" (the dr-7 posture). |
| **Guarantee 5 (no-egress)** | the intraday fetch is **egress** → **zero** calls under no-egress; the free/unknown tier stays disabled with a served reason. |
| **dr-7** | 1D/5D honest-disable is the fallback state R-42 lifts **only where data exists**. |
| **dr-25** | the daily↔intraday partition must be **structurally impossible** to comb (§4 guard). |
| **dr-15** | the user-trigger must **not** skip on a lying cache-state; re-fetch is honest + idempotent (the 12h marker is the honest guard, not a lie). |
| **§26-bis / AMENDMENT-A** | both postures (mock + budget-aware real slice); matrix stays quotes-lane unless §9-6 rules otherwise. |

## 10. ACCEPTANCE CRITERIA (drafted; finalised after §9)

- [ ] **Happy path (premium):** on a premium-keyed instance, 1D (and 5D per §9-2) are
      **enabled**; picking one **fetches**, **persists**, and renders intraday bars with
      **time-of-day** on the axis.
- [ ] **Persist + reuse:** a re-view within the freshness window serves the **stored** series
      (no re-fetch); a re-fetch beyond the window is **idempotent** (no comb, no duplicate bars).
- [ ] **Tier honesty (free/unknown):** 1D/5D stay **disabled with a SERVED reason**; the gate
      is **server-side** (an intraday interval is refused by the backend, not only UI-greyed).
- [ ] **Class honesty:** mutual-fund (AMFI NAV) shows a served *"once-daily NAV"* disable;
      a provider that cannot serve intraday shows a served per-provider disable.
- [ ] **No-egress:** zero provider calls under no-egress; honest disabled state.
- [ ] **Structural partition (dr-25):** a daily read never returns intraday rows and vice
      versa (backend test); intraday can never comb a daily series.
- [ ] **Benchmark unaffected:** Portfolio → Performance + its benchmark stay **daily**.
- [ ] **Both postures (§26-bis):** mock lane covered by the suite; a **budget-aware real
      slice** (2–3 instruments, one 1D fetch each) verified on the premium key.
- [ ] **D-105 / copy hygiene:** all disable reasons served; no `interval` literal or decision
      ID in user copy; GLOSSARY parity green.
- [ ] **Rendered verification (both themes/densities, breakpoints):** intraday axis + disabled
      states verified by rendering, not unit tests (Playwright pre-pass).

## 11. BUILD PHASES (owner-gated — build begins only after §9)

- **Phase 0 — Backend-first (contract deltas §5b).** Provider intraday adapter (AV
  `TIME_SERIES_INTRADAY`, Yahoo intraday), `intraday` capability flag (`router.py:37`),
  `_history_source` intraday gate (tier + capability, **server-side**), the **served per-range
  availability** map (D-105), server-side `av_tier` refusal. **No migration** (§4). Regenerate
  contract same commit; drift green. Fail-first RED on each delta.
- **Phase 0a — Specimen.** `/kitchen-sink` intraday chart + the range control across **all**
  served states: premium-enabled, free/unknown-disabled, MF-disabled, provider-incapable-
  disabled, no-egress-disabled. If the trigger needs a component the inventory lacks → **§5
  amendment here** (§9-10), never mid-build.
- **Phase 1 — Assembly.** Range→interval mapping, the fetch trigger (dr-8 async standard),
  intraday ts rendering (replace `slice(0,10)`), served `disabledPeriods` (delete the frontend
  constants), honest loading/empty/error states.
- **Phase 2 — Tests.** The structural-partition test (dr-25), the server-side tier-gate test,
  idempotent-re-fetch, both postures; typecheck/lint/contract/overflow green; `npm run check`
  **exit 0** from the frontend dir (state the exit code — page-insurance §15b(a)).
- **Phase 3a — Scripted pre-pass (GREEN before the walk).** Drive the flow the owner would in
  **both themes across breakpoints**, **both postures** (mock + the §26-bis budget-aware real
  slice), 0 console errors; every geometry fix ships a fail-first measuring assertion.
- **Phase 3b — Owner acceptance walk (RESUMED per data-feed-routing §14 ruling 1c).** The
  short scripted milestone walk resumes here; the **dr-25 final chart sign-off** (1D/5D on the
  real-keyed instance) is taken here **and** carried to the pre-release walk. Owner closes the
  phase.
- **Close ritual.** Record the close (plan §-retrospective + `RATIFICATION.md §6`); strike-check
  every §9/walk item against the diff; **`CURRENT.md` must be in the close commit's diff**;
  **`git push`**. **Append this milestone's walk rows to `pre-release-walk.md` item 10 AT CLOSE**
  (not now) — the dr-25 final chart sign-off + any intraday-specific rows.

---

## 9. OPEN ITEMS — PROPOSED RESOLUTIONS (the §9 one-pass is walked with the owner; ⚑ = owner rules)

*Do not resolve these here — propose. The rulings supersede these PROPOSED resolutions, which
stand as the reasoning of record (the R-38 §9 precedent, `data-feed-routing.md:348-416`).*

| # | Item | Why it blocks / what's needed | PROPOSED resolution (owner to approve) |
|---|------|-------------------------------|-----------------------------------------|
| **§9-1** | **Storage model + retention.** | Same table vs separate intraday table; how "persisted forever" coexists with SQLite growth; the dr-25 comb must be **structurally** impossible. | **SAME `price_history` table, interval-dimensioned** — §2.1 proves the partition is structural (`market.py:579`, non-daily early-returns at `:448,:471,:493`); **no new table, no migration.** Add a **structural-partition test** (§4) so daily↔intraday can never comb. **Retention math (honest):** US-equity 1D 1-min ≈ **390 candles / instrument / trading day**; 5D at 5-min ≈ ~390 more. "Persisted forever" is realistic because fetches are **user-triggered per instrument/range** (only fetched windows persist), not a full-book daily poll — a heavy user fetching 1D for 50 instruments every trading day is ≈ 390×50×250 ≈ **4.9M rows/yr worst case**, but typical footprint is a small multiple of instruments viewed. ⚑ **Owner call:** truly **forever**, or a documented **prune** for stale intraday windows (e.g. keep the last K fetched days)? *Recommend forever + an honest-math footnote + a ROADMAP prune note if growth bites.* |
| **§9-2** | **Range→interval mapping vs dr-7.** | Which ranges map to which intervals; what un-greys on premium; which honest-disable states REMAIN, each with a served reason. | **1D → 1-min** (~390 pts, owner expectation); **1M/3M/6M/YTD/1Y/5Y/Max → daily (unchanged).** **Un-greys on premium:** 1D (and 5D). **Disable states that REMAIN (each a SERVED reason, D-105):** (a) free/unknown tier; (b) mutual-fund (AMFI NAV once-daily); (c) a provider that cannot serve intraday (CoinGecko/Kite/EODHD today); (d) no-egress. ⚑ **Owner call:** **5D's interval** — 5-min (~390 pts over 5 days) vs 15-min vs 30-min (the mock's current cadence). *Recommend 5-min for 5D.* |
| **§9-3** | **Fetch-on-demand within the premium budget.** | WHAT control, WHERE, fetching WHAT window, showing WHAT while fetching, WHAT budget guard; `av_tier` gated **server-side**. | **Control = the range button itself** (commit-on-pick, first-run F3 precedent), **on Instrument Detail only** (refresh-all stays separate — dr-17 masters-excluded precedent). Fetch window = the mapped range. While fetching: the **dr-8 async standard** (`aria-busy` + perceptible pending, re-click guarded) + per-card skeleton. Budget guard = the existing **12h `hist_fetched:{id}:{interval}` marker** (`market.py:561`) so a re-click within window serves cache. **`av_tier` gated SERVER-SIDE** — the backend refuses an intraday interval when `av_tier != premium` with a served reason, not only a UI grey. ⚑ **Owner call:** trigger = the range button, or a **distinct "Fetch intraday" affordance**? And confirm **Instrument-Detail-only**. *Recommend the range button + Instrument-Detail-only.* |
| **§9-4** | **Persist-forever vs upsert policy.** | How intraday upserts interact with upsert-never-overwrites + real-supersedes-demo; idempotent re-fetch of a persisted window. | Reuse the existing upsert (`market.py:627-661`): real-supersedes-demo + midnight-normalisation are **daily-only**, so intraday keys on **exact per-bar ts** and simply **inserts new bars, never overwrites an existing real bar** (`:661`). Idempotent re-fetch: within the 12h marker → cache; beyond → additive upsert (a same-session partial-day re-fetch fills in **later** bars as new ts rows, never rewriting earlier ones). *No ⚑ expected — confirm the additive semantics.* |
| **§9-5** | **Chart consumption.** | Served intraday shape (tz — **not** midnight-normalised); benchmark on intraday; performance of long series. | Served candle ts is **ISO with time** for intraday; the frontend renders full ts (replace `slice(0,10)`, §2.3/§7). **Benchmark: NO intraday** — Portfolio → Performance + benchmark stay **daily** (§2.7); intraday is **Instrument-Detail-only**, which has no benchmark overlay, so the benchmark is untouched. **No server-side downsampling needed** — the mapping caps intraday to 1D/5D (~390–780 pts); long ranges stay daily. *No ⚑ expected — confirm Instrument-Detail-only scope.* |
| **§9-6** | **Routing story.** | Intraday rides the matrix, or the active provider only? Extending the matrix to a second lane is a SCOPE decision. | **Active-provider-only (cheap + honest default)** — §2.6 shows history already rides the active provider (`market.py:616`) and the matrix can only block. Add an **`intraday: bool` capability** (`router.py:37`) so `_history_source` refuses intraday honestly when the active provider lacks it. A future intraday-aware **matrix lane** is a **ROADMAP note**. ⚑ **Owner call:** ratify **active-provider-only**, or rule intraday onto a **second matrix lane** now (extends AMENDMENT-A scope). *Recommend active-provider-only + ROADMAP note.* |
| **§9-7** | **Both postures.** | What the mock serves for intraday so the suite covers the lane; the real-posture walk slice. | Mock **already** serves 30-min intraday bars (`mock.py:139`) — the suite covers the lane today. Real posture = the **§26-bis budget-aware slice** (2–3 instruments, one 1D fetch each on the premium key). ⚑ **Owner call:** **align the mock cadence** to the chosen intervals (emit 1-min for `"1min"`, 5-min for `"5min"`) so the specimen/suite exercises the **real** cadence, or accept 30-min mock bars for tests with the divergence noted? *Recommend aligning the mock cadence.* |
| **§9-8** | **Demo data.** | Whether demo regeneration includes intraday for the mock provider (option-1 precedent) or intraday stays real-only with an honest empty in demo. | The demo path regenerates and **does not cache** (`market.py:621-625`); mock already produces intraday on demand. **PROPOSE demo shows generated intraday** (1D/5D **enabled** in demo, no dead control — the rotation-toggle/"real contents day one" rule + owner option-1 precedent). The alternative (real-only, greyed in demo) would leave 1D/5D **dead** in demo, contradicting no-dead-controls. ⚑ **Owner call:** option-1 (demo shows generated intraday) vs real-only + honest empty. *Recommend option-1.* |
| **§9-9** | **Served disable decision (D-105 gap surfaced by §2.3).** | The dr-7 disable reason is a **frontend constant** (`InstrumentDetail.tsx:50`), not served, not tier-aware — a D-105 gap. R-42 must serve it. | Move the per-range **enabled/disabled + reason** decision to the **backend** (tier- & capability-aware), served on the history/instrument reader (§5b); the frontend **renders** it and deletes the hardcoded constants. This is a **contract shape** delta — the exact boundary (reshape the history route vs a sibling `availability` reader) is proposed for ⚑ ruling with §9-3. *Recommend reshaping the history reader to carry availability.* |
| **§9-10** | **Trigger component gap.** | Is a per-instrument/per-range intraday-fetch trigger covered by the ratified inventory, or does it need a DESIGN-SYSTEM amendment? | Reuse `Segmented` (range control) + the **dr-8 `Button loading`** async standard — the range button becomes the trigger (commit-on-pick). **No new component expected.** If Phase 0a finds the composition doesn't hold, raise a **§5 DESIGN-SYSTEM amendment at 0a** (the R-38 §9-9 precedent), never mid-build. ⚑ if 0a surfaces a gap. |
| **§9-T** | **Terminology (GLOSSARY).** | "Intraday" / "Interval" are absent from `GLOSSARY.md`. | Author **spec-first** (`GLOSSARY.md` THEN `mocks/glossary.ts`, parity guard) — **"Intraday"** (sub-daily price bars for a trading day) and **"Interval"** (the bar granularity of a series). `interval` literals stay out of user copy. *No ⚑ expected — standard spec-first add.* |

---

## §9-RULINGS — OWNER RULINGS (2026-07-18, walked in chat)

*The §9 one-pass was walked with the owner on 2026-07-18. Every item below is now RULED;
the PROPOSED table above stands as the reasoning of record. Rationales are the owner's,
summarised. Build proceeds backend-first (Phase 0), STOPPING at the 0a specimen.*

- **§9-1 Storage + retention — RULED: accepted (owner 2026-07-18).** Same `price_history`
  table, **interval-dimensioned** (§2.1: the partition is structural — `market.py:579` hard
  SQL `interval == interval`, daily helpers early-return non-daily `:448/:471/:493`); **no
  new table, no migration.** Add the **structural-partition pin** (§4) so daily↔intraday can
  never comb. Retention is **truly forever — no prune, ever.** The honest growth math (§9-1
  PROPOSED: ≈390 candles/instrument/trading-day for 1D 1-min) stands; growth is bounded in
  practice because fetches are user-triggered per instrument/range (only viewed windows
  persist), not a full-book poll. *Owner rationale:* a retention guarantee that silently
  prunes is not a guarantee — future bloat is managed **by roadmap, never by silent
  pruning**. Filed **ROADMAP R-47 "intraday compaction / downsampling"** (parked) as the
  honest release valve if growth ever bites.

- **§9-2 Range→interval mapping — RULED: accepted (owner 2026-07-18).** **1D → 1-minute;
  5D → 5-minute** (≈390-point render budget per range; both native Alpha Vantage
  `TIME_SERIES_INTRADAY` intervals). 1M/3M/6M/YTD/1Y/5Y/Max stay **daily, unchanged**. 1D and
  5D un-grey on premium; the honest-disable states that REMAIN (each a **served** reason,
  D-105): free/unknown tier · mutual-fund (AMFI NAV once-daily) · a provider that cannot
  serve intraday · no-egress.

- **§9-3 Fetch trigger — RULED: accepted (owner 2026-07-18).** The **range button itself is
  the trigger**, **Instrument Detail only**. First click on an unfetched range = fetch, with
  a **served in-progress state**; the 12h `hist_fetched:{id}:{interval}` marker
  (`market.py:561`) is the idempotency/budget lock — repeated clicks never re-spend. The
  `av_tier` gate is **server-side** (the backend refuses an intraday interval when
  `av_tier != premium`, not merely a UI grey); the free tier keeps the honest disable with a
  **served, tier-keyed** reason string. **This milestone also fixes the dr-7 D-105 gap
  (§9-9):** the disable reasons and the disabled set move from frontend constants
  (`InstrumentDetail.tsx:50-51`) to **served**.

- **§9-4 Upsert — RULED: accepted (owner 2026-07-18).** **Additive-idempotent, per-interval
  source precedence.** The annotated upsert-never-overwrites-a-real-row +
  real-supersedes-demo policy (`market.py:643-661`) extends per-interval; intraday keys on
  **exact per-bar ts** (no midnight-normalise, §2.1) and inserts new bars, never rewriting an
  existing real bar. A partial-day re-fetch fills later bars as new ts rows.

- **§9-5 Scope — RULED: accepted (owner 2026-07-18).** **Instrument-Detail-only.** The
  **benchmark overlay is HIDDEN on 1D/5D** with a served reason —
  **"Benchmark comparison is daily-range only"** (exact string, served). Benchmark-intraday
  is filed to **ROADMAP R-48 "benchmark on intraday ranges"** (parked). **At this milestone's
  close**, update the `pre-release-walk.md` dr-25 carryover wording (item 1, `:18-24`) to
  match — the 1D/5D final chart sign-off is **instrument-line-only** on intraday (no
  two-line portfolio+benchmark assertion for 1D/5D). *(Noted now; the edit lands at close per
  the close-ritual.)*

- **§9-6 Routing — RULED: accepted (owner 2026-07-18).** Intraday rides the **active provider
  only**; the matrix does **NOT** gain a second lane. Add an `intraday: bool` capability
  (`router.py:37` seam) so `_history_source` refuses intraday honestly when the active
  provider lacks it. Filed **ROADMAP R-49 "history / intraday routing lane"** (parked) with
  the survey's finding as rationale — history routing is a different shape (the matrix can
  **block** but not **redirect**, `market.py:41-59,616`), so a second lane is its own
  milestone.

- **§9-7 Mock cadence — RULED: accepted (owner 2026-07-18).** Align the mock provider to the
  real intervals (**1-min for `"1min"`, 5-min for `"5min"`**) so the pins assert the true
  range→interval mapping; **replace the 30-min bars** (`mock.py:139`).

- **§9-8 Demo data — RULED: accepted (owner 2026-07-18).** The demo cache **generates
  intraday** for the mock provider (the option-1 precedent) — 1D/5D stay **alive in demo**;
  no dead controls.

- **§9-9 Served disable decision (dr-7 D-105 gap) — RULED: folded into §9-3.** Served,
  tier-keyed; the frontend renders the served availability map and deletes the hardcoded
  `INTRADAY_REASON`/`DISABLED_PERIODS` constants.

- **§9-10 Trigger component gap — RULED: accepted (owner 2026-07-18).** Reuse `Segmented`
  (range control) + the dr-8 `Button loading` async standard; no new component expected. If
  Phase 0a surfaces a composition gap, raise a §5 DESIGN-SYSTEM amendment **at 0a**, never
  mid-build.

- **§9-T Terminology — RULED: accepted (owner 2026-07-18).** Author spec-first —
  **"Intraday"** and **"Interval"** into `GLOSSARY.md` then `mocks/glossary.ts` (parity
  guard); `interval` literals stay out of user copy.

- **Chart time rendering — RULED: accepted (owner 2026-07-18).** The chart's ts→date
  truncation (`InstrumentDetail.tsx:110`) must render **intraday time-of-day**; intraday
  points are **NOT midnight-normalised** — that is the structural daily/intraday partition:
  the read filters `interval == interval` as hard SQL (`market.py:579`) and the daily helpers
  early-return for non-daily (`market.py:448/:471/:493`). This is the **comb-impossible
  proof** the §4 pin asserts.

---

**STOP AT 0a.** §9 is RULED and recorded. Build proceeds backend-first (Phase 0, §11);
the session STOPS at the **Phase 0a specimen** for owner ratification in chat. Phase 1
(assembly) is a separate instruction and does not begin here.

---

## PHASE 0a — RATIFICATION + GATE RULINGS (owner 2026-07-18, in chat)

**0a specimen RATIFIED — owner, 2026-07-18, in chat.** The `/kitchen-sink` intraday
specimen (Phase 0.7) — the intraday chart + the range control across every served state
(premium-enabled, free/unknown tier-disabled, MF class-disabled, provider-incapable-
disabled, no-egress-disabled) — was walked with the owner and accepted. Phase 1 (assembly)
now proceeds.

**Three 0a-gate rulings (owner 2026-07-18, per architect recommendation under standing
delegation):**

- **(e) benchmark-hidden — N/A ACCEPTED.** Instrument Detail has **no benchmark overlay**
  to hide (it is Portfolio → Performance that carries the benchmark, §2.7), so no benchmark
  control is invented on this page. The served `benchmark_reason` string
  (`"Benchmark comparison is daily-range only."`) is **retained in the availability payload**
  (`market.py:368,447`) for **R-48** (benchmark-on-intraday), a forward hook, not a dead
  field. No control, no dead affordance — the honest posture is that the field is present in
  the contract and simply not consumed by a benchmark control that doesn't exist here.
- **Period-carryover fallback → PHASE 1** (this session). A verified 0a behaviour:
  navigating from an intraday range on one instrument to an instrument where that range is
  disabled kept the disabled range **active with an honest empty**. The fix (fall back to the
  instrument's default daily range on load when the current range is served-disabled) is a
  Phase-1 assembly item.
- **dr-8 loading skeleton → PHASE 1** (this session). During the intraday fetch the bare
  "Fetching…" note is replaced by the **ratified dr-8 loading treatment** (skeleton +
  `aria-busy`); a Phase-1 assembly item.

**Owner addition (2026-07-18): chart pan-when-zoomed** — the owner observed the chart zooms
(§14dr-5) but does not horizontal-pan/scroll once zoomed. Added as **Phase 1 item 3**
(verify-first: cite the existing zoom; add horizontal pan while zoomed; a reset affordance
already exists — `PriceChart.tsx:381-385`).

**Verify-and-repair — ROADMAP R-47/48/49:** checked the repo `ROADMAP.md`. The three rows
filed by `b5efcb3` (§9-1/§9-5/§9-6) are **PRESENT** — `ROADMAP.md:59` (R-47 intraday
compaction/downsampling), `:60` (R-48 benchmark on intraday ranges), `:61` (R-49
history/intraday routing lane), each in house style with §9 rationale + cross-refs. **No
duplicate rows written.** (The knowledge-base copy that showed them missing was stale; the
repo is authoritative and correct.)

---

## PHASE 1 — ASSEMBLY (in progress this session; one delta per commit)

Owner-ruled scope (session instruction 2026-07-18): (1) period-carryover fallback,
(2) dr-8 loading state, (3) chart pan-when-zoomed, (4) any remaining plan Phase-1 items.
The specimen frontend (Phase 0.7, `328f9d7`) already landed the range→interval mapping (the
page sends a RANGE), the range-button fetch trigger, intraday ts rendering (`fmtTick`
replaces the `slice(0,10)` truncation, `InstrumentDetail.tsx:52-56`), and the served
`disabledPeriods` (the hardcoded `INTRADAY_REASON`/`DISABLED_PERIODS` constants are gone).
Phase 1 completes the loading/empty treatment + the pan interaction. Per-item status is
tracked in the commit train; the pre-pass section below records the walk.

---

## PHASE 2 — TESTS (GREEN)

Backend **1138 → 1139** (+1: the fetched→cached-fresh 12h-marker trigger-flow pin,
`test_intraday_storage.py`). Frontend vitest **316 → 320** (+4: carryover fallback,
in-flight dr-8 skeleton e2e, PriceChart loading unit, pan-when-zoomed). `npm run check`
**exit 0** (lint · typecheck · design-tokens · internal-copy · 320 vitest · **337
Playwright overflow** incl. Instrument Detail at 320/375/768/1366/1440 both themes — the
chart changes introduce no overflow). `ruff` green. `make api-contract-check` **current**
— **no contract shape changed** in Phase 1/2 (the availability shape was frozen in Phase 0),
so the path-key count is **unchanged**. Sweep coverage: trigger flow (fetch→fetched→
cached-fresh) · served disabled reasons per class/tier/provider/egress (Phase 0
availability suite) · carryover fallback · pan/zoom/reset · daily-path regression
(`test_daily_history_unchanged_without_range`) · comb-impossible re-asserted
(`test_intraday_storage.py` partition pins) · idempotent re-fetch under the 12h marker.

## PHASE 3a — SCRIPTED PRE-PASS (GREEN)

Driven in a real Chromium against **isolated** instances (temp data dirs; owner's
`~/.ledgerframe-data`, `5173→8321`, and repo `.env` all **untouched** — `.env` sha256
verified unchanged after the run; `prepass-harness` memory). Two postures:

**Mock/demo posture (no egress) — 9/9 checks, 0 console errors:**

| # | Check | Result |
|---|-------|--------|
| 1 | AAPL 1D → 1-minute intraday, time-of-day axis (tooltip "17:13") | PASS |
| 2 | AAPL 5D → 5-minute intraday | PASS |
| 3 | Re-pick 1D re-renders (instant on mock) | PASS |
| 4 | Advanced → zoom → **pan** (window 112-1264 → 288-1440) | PASS |
| 5 | Reset zoom restores the full range (data-window cleared) | PASS |
| 6 | Mutual fund (HDFCNIFTY) greys 1D/5D with the served once-daily-NAV reason | PASS |
| 7 | Carryover: 1D → fund falls back to a daily range (6M), no dead empty | PASS |
| 8 | Kitchen-sink specimen renders the served-state matrix | PASS |
| 9 | 0 console errors across the walk | PASS |

**Real-posture slice (isolated real-keyed instance, owner `.env` read-only + verified
unchanged, budget-aware):** learned **`av_tier = premium`** → intraday enabled. TWO
instruments × (1D, 5D) fetched **once each** (4 live Alpha Vantage `TIME_SERIES_INTRADAY`
calls + the 1 tier probe): AAPL/MSFT 1D → **1-min, ~825 real market-session candles**;
5D → **5-min, ~933 candles**; real timestamps, time-of-day present. A re-view served
**`fetch_state=cached`** — the 12h marker prevents any second spend. Browser render slice
(cached, no re-spend): **4/4** — smooth 1-/5-minute charts, time-of-day axis (1D "14:33";
5D "07-14 18:30"), **0 console errors**, screenshots captured. Owner data untouched.

---

## PHASE 3b — OWNER ACCEPTANCE WALK — FINDINGS LEDGER (2026-07-18) — **CLOSED: 3 findings, 1 batch**

> **LEDGER CLOSED (2026-07-18).** Walk findings **W-1 · W-2 · W-3**, all verified-cause /
> fixed / RED→GREEN / both-postures in **batch-1** (`153b00d..1c9f8dc`), owner-accepted on
> the live re-walk (see MILESTONE CLOSE below). **Final tally: 3 findings, 1 batch.**

*The owner's 3b walk surfaced three findings. Verify-first: each verified cause is dumped
with `file:line` cites BEFORE any fix (real-data dumps from a **read-only copy** of the
owner DB — `~/.ledgerframe-data/db/ledgerframe.db` copied to scratchpad, never queried in
place). Standing rules apply: RED-first on the real cause, one delta per commit, both
postures, STOP at the end for the owner re-walk.*

### W-1 — INR-priced holdings valued WITHOUT FX conversion (data-integrity, P1) — FIXED (W-1a `47384f3`, W-1b `f1f70a3`)

**Owner-walk evidence (screenshots):** TSLA 100 × USD 380.84 → SGD 49,176.57 (USD→SGD
~1.291 — correct). 145834: 100 × INR 14.8131 → "Value (SGD) 1,481.31" (raw INR magnitude;
honest ≈ S$20–22). 102000: INR 1,132.23 × 100 → "113,223.00" (same raw pattern). Net worth
therefore includes ~S$113k+ of unconverted INR magnitude.

**VERIFIED CAUSE (read-only DB dump + code cites):** *not* a missing FX rate — INR **is**
present (ECB cache, `EUR→INR = 110.1020`, `EUR→SGD = 1.4765`, 30 currencies loaded;
`ecb_fx.py:73-79`). The real cause: the valuation derives the value's currency from the
**holding**, not the **quote**. In the owner's book both funds have **`holding.currency =
'SGD'`** (holdings 4 & 6) while **`quote.currency = 'INR'`** (the AMFI NAV's true currency).
`_value_one_holding` computes `native_ccy` as `currency_for_symbol(sym) or h.currency or
instrument.currency or base` (`portfolio.py:279-284`). For an AMFI scheme code
(`"145834"`, no exchange suffix) `currency_for_symbol` returns `None`
(`app/core/symbols.py:99-115`), so **`h.currency='SGD'` wins**. Then `mv_native = qty ×
quote.price` (an INR magnitude) is passed to `fx.convert(mv_native, 'SGD', 'SGD')`
(`portfolio.py:302,322`), which same-currency short-circuits to **rate 1.0**
(`fx.py:69-70`) — the value renders as raw INR labelled SGD. Reproduces the walk figures
exactly: 100×14.8131 = 1481.31; 100×1132.23 = 113223. The `holding.currency='SGD'` is itself
drift: the FIFO builder defaults it from the txn/account currency when the symbol has no
exchange suffix (`portfolio.py:472-483`). **Class:** the currency used to interpret a
**live price** must be the **quote's** currency, ranked above the drift-prone holding /
instrument currency. **Silent-1.0 note:** the `Decimal("1")` fallbacks at `fx.py:52,57` are
*latent* here (every quote currency in the book — INR, USD — is ECB-covered) but are a real
class defect the fix must also close (W-1b).

**FIX (two deltas):** (a) **W-1a** — the market value + day change of a live-quoted holding
convert FROM `quote.currency` (authoritative), ranked above `h.currency`/`instrument.currency`;
cost basis stays in the stored holding currency (the recorded cost currency — a separate,
pre-existing data concern, flagged not silently changed). (b) **W-1b** — kill the silent
`Decimal("1")` FX fallback: a genuinely-unavailable rate surfaces an **honest flagged
state** (served `fx unavailable` reason + confidence factor via the existing mechanism),
never a fabricated 1.0. Net worth / Portfolio totals read the same corrected valuation
(`portfolio.py:209,425`) — no re-derivation.

### W-2 — instrument `currency` vs `pricing_currency` divergence (data class) — FIXED (`6291c97`)

**VERIFIED (DB dump):** ALL three AMFI funds carry `currency='USD'`, `pricing_currency='INR'`
(instruments 25/26/28) — the divergence is the **class**, not one row. `recognise_amfi_fund`
sets `pricing_currency='INR'` but never touches `instrument.currency` (`market.py:150`),
leaving the USD residue the Identity card renders. Fix: reconcile the full currency field set
in the D1 helper; extend the D1-b repair (`recognise_unconverted_amfi_funds`,
`market.py:155-193`) to heal existing rows (idempotent, counted). Identity card render field
to be cited before the fix.

### W-3 — 5D spike artifacts at session boundaries (verify, then rule-ready) — FIXED (`fd94f9d`)

**VERIFIED CAUSE (read-only DB dump):** **extended-hours candles** (cause (a)), not bad
ticks and not a rendering artifact. TSLA 5min spanned **08:00–23:55 UTC** — 540/930 candles
OUTSIDE the regular US session (13:30–20:00 UTC); the regular-session open (13:30 UTC) had
volume **1,071,821** vs **~2,651** pre-market. The paired spikes are the open/close volume
jumps against thin pre/post-market bars, repeated each of the 5 days. Alpha Vantage
`TIME_SERIES_INTRADAY` was fetched WITHOUT `extended_hours`, so AV's default `true` returned
the 04:00–20:00 ET window (`external.py:224-227`, pre-fix).

**FIX:** the AV client sends `extended_hours=false` (regular 09:30–16:00 ET only —
`external.py:224-233`). A one-time idempotent `repair_extended_hours_intraday`
(`market.py`, the dr-25 cleanup pattern) purges rows already stored outside the regular
session (US/Eastern wall-clock, DST-correct), scoped to non-daily intervals so daily rows
are never touched; guarded by a `hist_extended_hours_purged_v1` Setting marker in
`get_history_cached`. **No bad-tick filtering** (that would be the silent data-filtering the
product must never do — none was needed; the cause was policy, not outliers).

**ROADMAP candidate (owner to rule):** extended hours as an explicit USER choice (a
pre/post-market toggle). NOT built — the honest default is the regular session. Filed here
as a candidate row for the owner, per the finding's "do NOT build it" instruction.

### PHASE 3b BATCH-1 REPORT (W-1 · W-2 · W-3) — GREEN, STOP for owner re-walk

**Per-finding.** Each: verified cause (dumps + cites, above) · fix at the cause · commit ·
RED→GREEN · posture evidence.

- **W-1a `47384f3`** — market value + day change convert FROM `quote.currency` (ranked above
  the drift-prone `holding.currency`); cost stays on the recorded holding currency (the
  transactions recorded SGD cost — a separate, pre-existing data concern, flagged not
  silently rewritten). `native_currency` now serves the price currency. RED→GREEN:
  `test_fx_quote_currency.py` (INR fund in SGD account converts; TSLA/USD unchanged;
  mixed-book net worth).
- **W-1b `f1f70a3`** — `fx.get_rate_or_none` never fabricates 1.0; the valuation converts via
  `convert_checked`, so a genuinely-missing rate flags the holding (served `failure_reason`
  + `−30` confidence factor) and contributes 0 to net worth — never a silent 1.0. Latent in
  the owner's book (all quote currencies ECB-covered) but the class defect is closed.
  RED→GREEN: `test_missing_rate_is_flagged_never_fabricated_one`.
- **W-2 `6291c97`** — `recognise_amfi_fund` reconciles `instrument.currency='INR'` too; the
  D1-b repair now also triggers on a `currency != INR` divergence, so the owner's
  already-converted-but-USD rows (25/26/28) are healed, not skipped. RED→GREEN:
  `test_repair_heals_currency_only_divergence` + currency assertion in the existing pin.
- **W-3 `fd94f9d`** — `extended_hours=false` + `repair_extended_hours_intraday` (idempotent,
  counted, non-daily-scoped). RED→GREEN: `extended_hours=false` param pin +
  `test_extended_hours_purge_removes_only_out_of_session_intraday`.

**Both-postures.** Mock suite: 1145 backend pass. **Real-posture (isolated COPY of the
owner DB, FX forced through the cached ECB reference rates, no egress, owner `.env` sha256
verified UNCHANGED, owner live stack untouched):** D1-b healed all 3 funds
(currency USD→INR); valuation in SGD — **145834: 100×14.8131 INR → S$19.86** (was raw
1,481.31); **102000 → S$1,518.30** (was 113,223.00); **TSLA/USD → S$49,175.32** (unchanged);
**net worth S$472,508.70**, ~S$113k of unconverted INR magnitude removed; `fx_unavailable`
False (rates present, honestly converted). W-3 purge on the real rows: intraday **1841 →
786** (purged 1055 extended-hours candles, 1 instrument = TSLA); the 786 remaining are
regular-session only.

**Gates.** Backend **1139 → 1145** (+6). Frontend `npm run check` **exit 0** (from
`frontend/`; 337 Playwright overflow incl. Instrument Detail all breakpoints/themes — no
frontend source changed). `ruff` clean. `make api-contract-check` **current** — **no
contract shape changed** (path-key count unchanged at 134; the fx-unavailable reason rides
the existing `failure_reason` + `confidence_factors`).

**Cleanup counts.** W-3 real data: 1055 extended-hours candles purged (idempotent — a
second run is 0). W-2 real data: 3 funds healed (idempotent — second run 0).

**dr-25 carryover.** The 5D DATA is clean after W-3 — the extended-hours rows are purged and
new fetches are regular-session only, so the session-boundary spikes have no source. The
visual 5D render on the real-keyed instance is the owner re-walk's to confirm (below); the
carryover resolves once the owner sees the clean 5D.

**STOP.** Batch-1 (W-1/W-2/W-3) is code-complete, gated, and pushed. No close ritual, no
`RATIFICATION`/`CURRENT.md` close record, no CLI ratification — this batch STOPS here for the
owner re-walk in chat (per the batch instruction). The fix commits themselves are pushed.

---

## MILESTONE CLOSE (2026-07-18) — STEP 1 records

*The close ritual. GATE 0 precondition met: the owner confirmed in chat — **"3b accepted,
dr-25 fully accepted"** — after visually verifying clean TSLA 1D/5D charts on their real
instance. No feature work in this session; records + strike-check only.*

- **Phase 3b ACCEPTED — owner, in chat (2026-07-18).** After the re-walk on the live
  instance: net worth corrected to honest figures (~S$113k of unconverted INR magnitude
  removed — W-1), the India funds **102000/145834 converted with Identity Currency INR**
  (W-2), **TSLA unchanged**, and **clean TSLA 1D/5D visually confirmed** by owner eyes
  (W-3). The three walk findings are accepted as fixed.

- **§14dr-25 (R-38 carryover) — FULLY ACCEPTED — owner, in chat (2026-07-18).** The partial
  acceptance recorded at the R-38 close (2026-07-18, morning — "waiting until intraday data
  comes in") **converts to full acceptance.** The daily comb was fixed at batch 8
  (`98c3be2`); intraday is now live; the session-boundary spikes were root-caused (W-3: the
  Alpha Vantage `extended_hours` default) and the stored extended-hours rows purged; the
  charts render clean on the real-keyed instance by owner eyes. **The dr-25 final chart
  sign-off is complete.** (Cross-referenced in `docs/plans/data-feed-routing.md` under its
  dr-25 entry and in `docs/plans/pre-release-walk.md` item 1.)

- **Walk-findings ledger → CLOSED: 3 findings, 1 batch** (header updated above).

- **Cost-currency ruling (architect under owner's standing delegation, 2026-07-18 —
  reversible by a dated entry).** The India fund transactions recorded **cost in SGD while
  the NAV is INR**, which distorts the unrealised P/L display. This is a **data-entry
  currency question, not a valuation bug** — batch-1 **correctly did not rewrite recorded
  costs** (W-1a converts *market value* from `quote.currency` and leaves the stored cost
  basis on its recorded currency, flagged not silently changed). **Transaction currency +
  trade-date cost-basis FX is FOLDED INTO R-43's scope**: R-43 already carries R-8
  (historical FX series) as a hard dependency, and trade-date conversion is its natural home.
  Recorded here and in `ROADMAP.md`'s R-43 row.

---

## §15 — STRIKE-CHECK RETROSPECTIVE (2026-07-18) — STEP 2

*Lessons from the R-42 build + the 3b walk, each strike-checked against the repo (the
mechanism — test / guard / rule — is named and verified present at close).*

1. **Value-currency derives from the QUOTE, not the holding.** The W-1 class: a live-quoted
   holding's market value must be interpreted in the **quote's** currency, ranked above the
   drift-prone `holding.currency` / `instrument.currency`.
   **Mechanism (verified):** the conversion-source pin + the mixed-currency net-worth pin in
   `tests/integration/test_fx_quote_currency.py` (INR fund in an SGD account converts;
   TSLA/USD unchanged; mixed-book net worth honest). Fix at `app/services/portfolio.py`.

2. **Provider DEFAULTS are part of the contract.** An unsent parameter is still a decision —
   Alpha Vantage `TIME_SERIES_INTRADAY` defaults `extended_hours=true`, which silently
   returned the 04:00–20:00 ET window and produced the 5D session-boundary spikes (W-3).
   **Mechanism (verified):** the pins assert the **exact params sent** —
   `tests/unit/test_intraday_provider.py:92` asserts `captured.get("extended_hours") ==
   "false"`. **Recorded rule for all future provider integrations:** assert the exact request
   parameters, never trust a provider default.

3. **Silent fallbacks are findings.** The `fx.convert` `Decimal("1")` same-currency/no-rate
   fallback fabricated a 1.0 rate (W-1b) — latent in the owner's book but a real class defect.
   **Mechanism (verified):** a genuinely-missing rate now surfaces a **served reason +
   confidence penalty + zero contribution**, pinned by
   `tests/integration/test_fx_quote_currency.py::test_missing_rate_is_flagged_never_fabricated_one`.
   Fix at `app/services/fx.py` (`get_rate_or_none` / `convert_checked`) + `confidence.py`.

4. **Green gates cannot see a wrong number that renders confidently.** **1,139 tests were
   green** while net worth was overstated by ~S$113k — only the **owner walk on real data**
   caught it (the mock suite never carried an INR-quoted-in-SGD-account holding).
   **Mechanism (verified):** per-milestone **owner walks** (resumed by the R-38 §14 ruling
   1c) + the **pre-release walk checklist** (`docs/plans/pre-release-walk.md`), now carrying
   a mixed-currency book spot-check (item added this close).

5. **The harness push classifier can block `git push`.** During batch-1 the harness classifier
   blocked the push; the workaround is that **the owner pushes from their own terminal**.
   **Mechanism (verified):** recorded in harness memory (`harness-push-classifier.md`) so a
   future session does **not** retry-loop on a blocked push.

### Changed-file table — from the ACTUAL diff

`git diff --stat <milestone-base>..HEAD`, where **`<milestone-base> = b5efcb3`** — the commit
preceding the R-42 plan's **first Phase-0 commit** (`51f03cc` "R-42 Phase 0.1 — provider
intraday seam"), recovered via `git log --reverse -- docs/plans/intraday-series.md` cross-read
against the commit train. *Caveat (honest):* this range also contains the interleaved **R-38
POST-CLOSE DELTA D1** commits (`42fb752..dc72f0a` — the India-MF recognition helper/repair +
`test_d1_*` files + `release-readiness.md`), which landed in the same window before the R-42
Phase-0a record; they are included in the raw range, not excised.

```
 ROADMAP.md                                      |   8 +-
 app/api/v1/routes/amfi.py                       |  16 +-
 app/api/v1/routes/markets.py                    |  45 ++++-
 app/api/v1/routes/portfolio.py                  |  10 +-
 app/main.py                                     |  15 ++
 app/providers/market/external.py                |  31 ++-
 app/providers/market/mock.py                    |  13 +-
 app/providers/market/router.py                  |  12 +-
 app/providers/market/yahoo.py                   |  11 +-
 app/services/confidence.py                      |   5 +
 app/services/fx.py                              |  44 +++-
 app/services/market.py                          | 254 ++++++++++++++++++++++--
 app/services/portfolio.py                       |  29 ++-
 docs/openapi.json                               |  17 ++
 docs/plans/CURRENT.md                           |  31 +--
 docs/plans/data-feed-routing.md                 |  88 ++++++++
 docs/plans/intraday-series.md                   | 230 +++++++++++++++++++++
 docs/plans/release-readiness.md                 |  38 +++-
 docs/specs/API-CONTRACT.json                    |  17 ++
 docs/specs/GLOSSARY.md                          |  11 +
 frontend/src/api/instruments.ts                 |  22 +-
 frontend/src/api/pricing-health.ts              |   3 +
 frontend/src/components/ui/PriceChart.tsx       |  85 +++++++-
 frontend/src/components/ui/charts.css           |   6 +
 frontend/src/components/ui/ui.test.tsx          |  60 ++++++
 frontend/src/mocks/glossary.ts                  |  13 ++
 frontend/src/routes/InstrumentDetail.test.tsx   | 164 ++++++++++++++-
 frontend/src/routes/InstrumentDetail.tsx        | 100 ++++++++--
 frontend/src/routes/PricingHealth.test.tsx      |  38 +++-
 frontend/src/routes/PricingHealth.tsx           |   9 +-
 tests/integration/test_d1_amfi_recognition.py   | 102 ++++++++++
 tests/integration/test_d1_amfi_repair.py        | 127 ++++++++++++
 tests/integration/test_d1_leak_copy.py          |  54 +++++
 tests/integration/test_fx_quote_currency.py     | 176 ++++++++++++++++
 tests/integration/test_intraday_availability.py | 104 ++++++++++
 tests/integration/test_intraday_endpoint.py     |  62 ++++++
 tests/integration/test_intraday_storage.py      | 225 +++++++++++++++++++++
 tests/integration/test_routing.py               |  11 +
 tests/unit/test_intraday_provider.py            | 143 +++++++++++++
 39 files changed, 2324 insertions(+), 105 deletions(-)
```

**Gates at close:** backend **1145 passing**; `make api-contract-check` **current** (contract
**134 path-keys**, unchanged — no shape changed after Phase 0); `ruff check .` **clean**;
frontend `npm run check` **exit 0** from `frontend/` (lint · typecheck · tokens · 320 vitest ·
337 Playwright overflow). *(Backend count re-confirmed in the close report.)*

---

**MILESTONE CLOSED — intraday-series (R-42), 2026-07-18.** Walk ledger CLOSED (3/1); §15
strike-check recorded; `RATIFICATION.md §6` row appended; `CURRENT.md` advanced to R-43.
The owner re-uploads the knowledge base; the R-43 kickoff happens in chat. **No R-43 work in
this session.**

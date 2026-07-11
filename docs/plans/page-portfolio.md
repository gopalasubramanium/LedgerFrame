# page-portfolio.md — Portfolio (analytics) page build plan

**Status: Batch 13 NDs RATIFIED + Phase-0 VERIFICATION DONE (2026-07-11) — STOPPED for owner
sign-off before Phase-0a/1.** Instantiated from `TEMPLATE-page-build.md` (latest — incl. the
Phase-3a scripted pre-pass step). Every section is derived from the specs with a section
reference; nothing here is invented. **§9 records the ratified ND resolutions + verification
findings; §10 is the Phase-0 verification report + the remaining owner sign-off items.** No
backend delta was needed (the ND-12 conditional did not trigger). **Do not begin Phase-0a/1
until the owner signs off §10.**

Portfolio is the second **overview-template** page (Net worth/Home are the others) and the
**analytics** half of the Holdings↔Portfolio split (D-023). Holdings is DONE; this page is its
"analytics" counterpart and the canonical home its value/positions header summarises.

---

## 1. IDENTITY

*Source: INFORMATION-ARCHITECTURE.md §2 (page map), §3 (nav); DESIGN-SYSTEM.md §3.*

| Field | Value | Spec ref |
|-------|-------|----------|
| Page name (H1 = nav label = route) | **Portfolio** | IA §2, D-022 |
| Route | `/portfolio` | IA §2 |
| Nav group | **Wealth** (Net worth · Portfolio · Holdings · Accounts) | IA §3 |
| Page template | **Overview** (composed stat tiles / charts / summary widgets) | DESIGN-SYSTEM §3 |
| Rotation eligibility | Eligible (a dashboard-class Wealth page; confirm in §9) | IA §3 (D-044) |
| One-line purpose | **Investment analytics** — the canonical home for Today's change, Unrealised/Realised P/L, Cost basis, Total return, allocation, performance, Contributors/Detractors, concentration, attribution, costs. The **management** surface is Holdings (D-023). | IA §2, D-023 |

**Subtitle states the split (D-023):** Portfolio "analytics" ↔ Holdings "management", cross-linked both ways.

---

## 2. OWNERSHIP TABLE

*Copied from INFORMATION-ARCHITECTURE.md §5 (Portfolio). Never re-derived.*

**Owns (canonical, authoritative, fully explained here):**
- **Stat rail (D-032):** Today's change, Unrealised P/L, **Realised P/L**, Cost basis, Total return.
- **Allocation (D-033/D-048):** donuts by **class / sector / currency / tag**; the sector donut
  carries the explicit **"Not sector-classified (non-equity)"** bucket for `sector = null` (D-082).
- **Contributors / Detractors (D-034):** contribution-weighted lists (GLOSSARY) — **not**
  Gainers/Losers (that pair is Markets', D-024).
- **Performance chart (D-035):** with **benchmark picker + stats — these live ONLY here**.
- **Concentration / Largest position / Top-5 / HHI** (kept distinct, never interchanged, D-029); **KeyStats**.
- **Attribution** (per-holding contribution rolled to class/sector, with an explicit **residual**; single-period approximation — GLOSSARY).
- **Costs card (D-048):** **Recorded fees** vs **Ongoing cost (expense ratio)** — **two blocks, never blended**.
- **Return / volatility** with the **not-a-Sharpe disclaimer** (protected copy, D-030).

**Summarises (other pages' info — via the named reader, linked, never recomputed):**

| Summary shown | Canonical page | Shared reader reused | Link target |
|---------------|----------------|----------------------|-------------|
| Net worth headline | Net worth (`/net-worth`) | Net worth headline reader (D-032) | `/net-worth` |

**Links to:** Holdings ("manage", D-023) · InstrumentDetail per holding row (D-098) · Pricing Health (freshness) · Reports (Realised P/L report, D-026) — confirm the exact link set in §9.

**Enforcement corollary (P-1/D-031):** every stat-rail figure and allocation weight is read from
the **canonical Portfolio reader** (`value_portfolio` via `/portfolio/summary` et al.), never
recomputed in the frontend. Holdings' value/positions header **summarises this page's reader**
(IA §5 Holdings) — this page must not, in turn, recompute anything Holdings shows. **No frontend money math.**

**Scoped/handoff note:** Portfolio **owns** the analytics figures; Net worth **owns** Net
worth/Gross assets/Liabilities (D-032). The two summarise each other's headline with a link,
each via the other's reader. The exact Holdings-header ⇄ Portfolio-reader handoff has an open
question — see **§9 ND-2**.

---

## 3. API SURFACE

*Source: API-CONTRACT.json (frozen) + API-CONTRACT.md. The Portfolio analytics readers are
**already frozen** — this page is largely assembly over existing endpoints.*

### 3a. Endpoints consumed (already in the frozen contract)

| Method + path | Purpose on this page | Response shape pinned? |
|---------------|----------------------|------------------------|
| `GET /portfolio/summary` | stat rail (`total_value`, `cost_basis`, `unrealised_pl`, `day_change`, `total_return_pct`), `has_stale`/`stale_count`, `allocation_by_class`/`_currency`/`_sector`, `top_gainers`/`top_losers` (movers) | keys known (route reads); **no `realised_pl` — see ND-12** |
| `GET /portfolio/tags` | allocation **by tag** donut (D-033/D-048) | `tag_allocation` shape — confirm matches AllocationDonut (ND-4) |
| `GET /portfolio/performance?days=&benchmark=&include_manual=` | performance chart: `series`, `value`, benchmark series, `return_pct`, `benchmark_return_pct`, `excess_pct`, `volatility_pct`, `max_drawdown_pct`, `best/worst_day_pct`, `stats` | keys known; **return basis/labels open — ND-3** |
| `GET /portfolio/benchmarks` | benchmark picker list (`SPY,QQQ,DIA,EWS,GLD,BTC` → labels) | pinned (`{benchmarks:[{symbol,label}]}`) |
| `GET /portfolio/stats?benchmark=` | Concentration / Largest / Top-5 / HHI / KeyStats / Return-volatility (`key_stats`) | shape opaque (`kind/label/metrics/note/term_id/value`) — **confirm distinct figures + disclaimer source, ND-5/ND-6** |
| `GET /portfolio/attribution?days=&benchmark=` | `attribution` (with residual) + `risk` (risk_metrics; not-a-Sharpe) | keys known; residual/display open — ND-7 |
| `GET /portfolio/cost-of-ownership?year=` | Costs card — recorded fees + ongoing cost (two blocks, never blended) | pinned (two-block, no total) |
| `GET /portfolio/realised-gains` | Realised P/L figure/report (D-026) | report shape (year); **stat-rail figure source — ND-12** |
| `GET /portfolio/realised-gains.csv` | Realised P/L report CSV export (P-5/D-050) | pinned |
| `GET /portfolio/holdings` | movers rows / per-holding links (already typed) | `HoldingsResponse` (typed) |

**Entity scoping:** every reader accepts `entity_id` (D-065). Whether Portfolio shows an entity
selector or is Household-default only is **ND-8**.

### 3b. Contract deltas (needed but not in the baseline — BUILD BACKEND-FIRST)

**None confirmed yet.** Two *candidate* deltas depend on §9 resolutions (do not build until resolved):

| kind | Endpoint (current → intended) | Decision | Why (pending §9) |
|------|-------------------------------|----------|------------------|
| reshape? | `GET /portfolio/summary` → add a **realised total** field | D-032 | The stat rail needs a **Realised P/L** figure; `summary` has `unrealised_pl` but **no realised** (ND-12). Alternative: read `/portfolio/realised-gains`. Owner picks. |
| rename? | `summary.top_gainers/top_losers` → `contributors/detractors` | D-024/D-034 | The Portfolio page must **label** these Contributors/Detractors; keys currently say gainers/losers (ND-1). Alternative: frontend display-label mapping, no contract change. Owner picks. |

Any approved delta regenerates `API-CONTRACT.json` + `docs/openapi.json` in the **same commit** (`make api-contract-check`).

---

## 4. COMPONENTS

*Source: DESIGN-SYSTEM.md §5 (ratified inventory) + §3 (overview template). Ratified only; a
missing affordance is a §9 amendment request. Every one below is data-wired to a **real**
endpoint (no mock fixtures on a canonical analytics page).*

| Ratified component | Role on this page | Data source (real endpoint) | Prop/state not exercised at kitchen-sink |
|--------------------|-------------------|-----------------------------|------------------------------------------|
| **PageHeader** | H1 "Portfolio" + D-023 analytics/management subtitle + actions (export, benchmark) | — | actions slot w/ multiple actions |
| **TrendStat** | stat rail (Today's change, Unrealised/Realised P/L, Cost basis, Total return) + concentration figures | `/portfolio/summary`, `/portfolio/realised-gains`, `/portfolio/stats` | provenance slot + delta colour on a rail of 5 |
| **AllocationDonut** | 4 allocation donuts (class / sector / currency / tag), D-033/D-048 | `/portfolio/summary` (class/currency/sector) + `/portfolio/tags` | the D-082 "Not sector-classified" segment; RTL/long labels |
| **PriceChart** (amended, Instrument-Detail variant) | performance chart: portfolio vs benchmark series | `/portfolio/performance` | **two series (portfolio + benchmark) overlaid** — confirm the amended chart supports a benchmark overlay (ND-3 / possible §5 amendment) |
| **DataTable** | Contributors / Detractors lists; (optionally) Top-5 positions | `/portfolio/summary.top_*`, `/portfolio/holdings` | bounded small lists (5 rows) — sort N/A |
| **Select** | benchmark picker (served list), performance window, allocation-dimension tabs | `/portfolio/benchmarks` (served) + view-scope | served-list Select (like the provider Select) |
| **StalenessChip / ProvenanceBadge** | per-figure / per-series freshness (D-027) | freshness fields on each reader | on a stat rail + on a chart series |
| **EmptyState** | honest "insufficient history" (D-086 below-threshold), no priced holdings, thin-data attribution/risk | reader "unavailable" shapes | below-min-history performance/XIRR message |
| **GlossaryTerm** | `[Help]` on Total return, XIRR, TWR, Return/volatility, HHI, Ongoing cost, Attribution | GLOSSARY (help copy) | multiple [Help] anchors on one page |

**Affordances the ratified inventory may lack (amendment — resolve in §9 before build):**
- **Benchmark overlay on the performance chart.** The performance chart plots **portfolio + a
  benchmark series** (D-035). `PriceChart` (as amended for Instrument Detail) plots one price
  series — a **two-series overlay + rebasing to a common start** may be a **DESIGN-SYSTEM §5
  amendment** (ND-3). Do not build a new chart without it.
- **A donut with a labelled "null/other" segment.** `AllocationDonut` must show the D-082
  "Not sector-classified (non-equity)" bucket as a first-class, labelled segment (not dropped) —
  confirm the ratified donut renders it (ND-4).

**Component usage rules the build must honour (template §4):**
- **Cards are layered (D-100);** a card's canonical cross-link (e.g. "Realised P/L report →")
  lives in the **card header, top-right**.
- **House-SVG charts only (D-053);** no ECharts. The performance chart is `PriceChart`.
- **Scroll = content only, header outside (D-101);** any list caps at `--table-max-h`.
- **No raw `<input>`/`<select>`;** benchmark/dimension/window pickers are `ui/Select`.
- **A recurring page-local pattern extracts to the component layer**, not left page-local.

---

## 5. VOCABULARIES

*Source: MASTER-DATA.md. Every categorical → its master + the control.*

| Field on this page | Vocabulary / master | Fixed (/refdata) or extensible | MASTER-DATA ref |
|--------------------|---------------------|-------------------------------|-----------------|
| Allocation dimension — **class** | `AssetClass` | fixed | MASTER-DATA §2 |
| Allocation dimension — **sector** | sector master (11 GICS + `null` bucket) | extensible; `null` = D-082 bucket | MASTER-DATA §6, D-082 |
| Allocation dimension — **currency** | currency master | fixed | MASTER-DATA §3 |
| Allocation dimension — **tag** | tag master (user) | extensible | MASTER-DATA (tags) |
| **Benchmark** picker | served `/portfolio/benchmarks` list | **served system list, NOT a MASTER-DATA master** | served (like the data-provider list) — a `Select`, not `MasterSelect` |
| Performance **window** / dimension **tabs** | view-scope UI (1M/3M/1Y/Max…) | n/a (view state) | `Select` / tabs (ND-10) |

**Benchmark is user/system config, not a MASTER-DATA categorical** → `Select` over the served
list (frontend zero-copy, D-005), exactly like the first-run provider list. The allocation
grouping VALUES (class/sector/currency labels) are **served display labels**, never hardcoded.

---

## 6. DECISIONS IN FORCE

*Source: docs/audit/DECISIONS.md — each with what it forbids/requires here.*

| Decision | What it forbids / requires on this page |
|----------|------------------------------------------|
| **D-023** | Portfolio = **analytics**; Holdings = management. Subtitle states the split; cross-link both ways. No management (add/edit/delete) here. |
| **D-024** | Two movers pairs: this page shows **Contributors / Detractors** (contribution-weighted), **never** "Gainers/Losers" (Markets' term) or the retired "Top movers". |
| **D-025 / D-026** | "Today's change" is the only term for the day move; "Realised P/L" / "Unrealised P/L" symmetric; retired labels forbidden. |
| **D-029** | Concentration · Largest position · Top-5 · HHI stay **distinct**, never interchanged; a fees card may be titled "Costs". |
| **D-030** | The **not-a-Sharpe disclaimer is protected copy** — shown verbatim wherever Return/volatility appears; Detail-level control label "Simple/Expert" (scope per D-040). |
| **D-031 / P-1** | Mechanism = P-1; every figure read from the canonical reader; Holdings summarises this page (no second code path). |
| **D-032** | This page is **canonical** for Today's change, Unrealised/Realised P/L, Cost basis, Total return; it **summarises** the Net worth headline with a link. |
| **D-033 / D-048** | Allocation (class/sector/currency/tag) canonical here; **allocation weight = share of gross assets, liabilities excluded** (GLOSSARY). |
| **D-034** | Contributors/Detractors canonical here (Gainers/Losers = Markets). |
| **D-035** | Performance chart + **benchmark picker + stats live ONLY here** (Home/Net worth show linked sparkline summaries, never the picker). |
| **D-040** | **Detail level is Home-only in v2** — Portfolio shows full analytics always, **no Simple/Expert toggle** here (ND-11). |
| **D-048** | Costs card: **recorded fees vs ongoing cost, never blended**, no total. |
| **D-054** | (Handoff) the composition donut was **dropped on Net worth**; Portfolio keeps the allocation donuts — they answer different questions, not duplicates. |
| **D-082** | The sector donut shows an explicit **"Not sector-classified (non-equity)"** bucket for `sector = null`. |
| **D-086** | **No annualized return below the minimum-history threshold** — Total return is cumulative; XIRR "Not applicable" below threshold; never a fabricated annualized figure. |
| **D-065** | Entity scoping (Household default; entity selector per ND-8). |
| **D-005 / D-050** | Served vocab/benchmark list (zero-copy); any CSV export is server-side (the client never builds the file). |

---

## 7. ACCEPTANCE CRITERIA

*Checkable, user-visible. Includes honesty states + theme/density + overflow.*

- [ ] **Stat rail (D-032):** Today's change · Unrealised P/L · **Realised P/L** · Cost basis · Total return — every figure from the canonical reader, **no frontend math**, each freshness-flagged; Total return is **cumulative** and below the min-history threshold it is the **only** return shown (D-086).
- [ ] **Allocation (D-033):** donuts by class / sector / currency / tag; **denominator = gross assets, liabilities excluded** (GLOSSARY); the **sector donut shows the "Not sector-classified (non-equity)" bucket** (D-082); negative/zero-value holdings handled honestly (per ND-4).
- [ ] **Contributors / Detractors (D-024/D-034):** labelled exactly that — **never "Gainers/Losers"**; contribution-weighted; honest empty/insufficient state (fewer than N, all flat).
- [ ] **Performance chart (D-035):** portfolio + benchmark overlay with a **benchmark picker** (served list) and window control; return labels are honest (TWR/cumulative per ND-3); benchmark provenance labelled (ETF proxy); below min-history → cumulative only, **XIRR "Not applicable"** (D-086); insufficient history shows an EmptyState, never a fabricated curve.
- [ ] **Concentration block (D-029):** Concentration · Largest position · Top-5 · HHI shown as **distinct** labelled figures (never interchanged).
- [ ] **Return / volatility (D-030):** the **not-a-Sharpe disclaimer shown verbatim** (protected copy, source per ND-6).
- [ ] **Costs card (D-048):** Recorded fees and Ongoing cost as **two separate blocks, no blended total**; null-rate holdings shown "unavailable", never counted as 0.
- [ ] **Attribution:** per-holding contribution rolled to class/sector **with an explicit residual** (Σ + residual = headline); labelled a single-period approximation; thin-data → honest "unavailable".
- [ ] **Honesty (Guarantee 3):** every empty / "—" region states a reason; stale flagged (D-027), never hidden or faked.
- [ ] **Terms match GLOSSARY**; **copy hygiene** — no decision IDs / impl notes / internal enum keys (`top_gainers`, `day_change`) in any user string; `[Help]` links resolve.
- [ ] **Cross-links (D-023/D-032):** Portfolio ↔ Holdings both ways; Net worth headline summary links to `/net-worth`; per-row → InstrumentDetail (D-098).
- [ ] **No Detail toggle here** (D-040, Home-only) (ND-11).
- [ ] **Both themes + both densities**; interactive OPEN states (benchmark/dimension `Select`, any popover) verified in both themes.
- [ ] **Rendered layout + overflow:** verified by **rendering** at 320/375/900/1366px both themes with zero horizontal overflow — **extend the Playwright overflow suite (ADR-0004)** to `/portfolio` (donuts + chart + rails are overflow-prone); jsdom cannot catch it.
- [ ] **Server-side CSV** (Realised P/L report, D-050) — client never builds the file.

---

## 8. BUILD PHASES

*One commit per phase. Backend deltas FIRST. Nothing assembled against a non-existent endpoint.
**Do not start until §9 clears.***

- **Phase 0 — Contract deltas (only if §9 approves ND-12 realised-figure and/or ND-1 movers
  rename):** build backend-first; regenerate `API-CONTRACT.json` + `docs/openapi.json` same
  commit; drift green. *(Skip if §9 resolves both to "frontend-only / read existing endpoint".)*
- **Phase 0a — DESIGN-SYSTEM §5 amendment (only if ND-3 needs a benchmark-overlay chart / ND-4 a
  donut null-segment):** author PROPOSED, ratify at `/kitchen-sink` before assembly.
- **Phase 1 — Page assembly:** compose ratified components over the readers; honest empty/error/stale
  states; Portfolio↔Holdings cross-links; benchmark picker + window; four allocation donuts; Costs card.
- **Phase 2 — Tests:** component/render tests + acceptance (§7); **extend the Playwright overflow suite
  to `/portfolio`**; drift/typecheck/lint/build green; visual check both themes/densities.
- **Phase 3a — Scripted pre-pass (MUST be green before the walk):** author an `e2e/smoke`-style
  driver against the live app + real backend on a seeded instance; drive every control (benchmark
  switch, dimension tabs, window, links), assert non-empty populated states + 0 console errors; fix
  everything it surfaces first.
- **Phase 3b — Owner acceptance walk (LIVE, judgment items only):** owner drives the real rendered app;
  each finding → a numbered `page-portfolio.md §*` entry, fixed + re-verified live. **Owner closes the page.**

---

## 9. NEEDS DECISION — RESOLVED (owner-ratified 2026-07-11) + Phase-0 verification

**Batch 13: all 12 ND items owner-ratified 2026-07-11.** Each resolution below is recorded as
ratified, then annotated with the **Phase-0 verification finding** (what the engine actually
serves — D-019 read-first). Where verification **diverges** from the resolution's premise it is
flagged **⚠ OWNER SIGN-OFF** — those are for the owner's report review before Phase-0a/1. Full
verification detail is in **§10**.

- **ND-1 — Contributors/Detractors (RATIFIED · verified ✅).** Option A: **internal engine keys
  → display mapping, no contract rename** (copy hygiene isolates keys from UI strings). Rank
  strictly by `day_change_base`; label **"Contributors — today"** (no period-contribution math).
  *Verified:* `top_movers` sorts by `day_change_base` (`portfolio.py:438`); `/portfolio/summary`
  serves `top_gainers`/`top_losers`. Frontend maps `top_gainers`→**Contributors — today**,
  `top_losers`→**Detractors — today**. Settled.
- **ND-2 — Holdings header (RATIFIED · verified ✅, IA text amended).** Keep as shipped: the
  Holdings header shows the **Net worth** headline, linking to both Net worth and Portfolio.
  *Verified single authoritative reader:* the Holdings header reads **`GET /portfolio/summary` →
  `total_value`** (`frontend/src/api/holdings.ts:122`), and `total_value` = `value_portfolio`'s
  **net-of-liabilities** total (the summary's `allocation_by_class` includes `liability: −…` and
  sums to `total_value`) — i.e. the figure IS Net worth, served by the **Portfolio reader
  (`value_portfolio`)**. IA §5 (Holdings) text amended to name this precisely (reader =
  `value_portfolio`/`/portfolio/summary.total_value`; figure = **Net worth** headline; links to
  both pages). **No code change.** Portfolio summarises the same net total as "Net worth" (one
  reader, no second code path). Settled.
- **ND-3 — Performance chart (RATIFIED · ⚠ OWNER SIGN-OFF on labels + a §5 amendment).**
  Ratified: label exactly what the engine serves in GLOSSARY terms; benchmark carries ETF-proxy
  provenance + explicit dividend treatment; below-threshold → cumulative + `coverageNote`; both
  series rebased; use the existing benchmark prop unless verification proves it can't carry the
  series. *Verified (`analytics.py:216`):*
  - **(a) The portfolio return is NOT a formal TWR.** `series` is **current holdings marked to
    market over the window** (today's `qty` × historical closes × FX), **invested-only** (manual
    cash/property excluded unless `include_manual`); `stats.return_pct` = simple `end/start−1`.
    ⚠ So labelling it "Cumulative return (TWR)" would be **inaccurate** — it is a *current-holdings
    price return*. **Owner: pick the honest label** (e.g. "Invested holdings — price return, current
    positions"). The stat-rail's separate **TWR/XIRR** figures come from `/portfolio/stats` (distinct
    numbers) and are honestly "Not applicable" on thin history (D-086, engine-enforced).
  - **(b) Benchmark = PRICE-ONLY (no dividends).** `bench_vals` uses raw daily `close` (no
    total-return adjustment), **indexed to the portfolio's start value**. Label: **"S&P 500 — SPY
    proxy · price return (excl. dividends)"**. Confirmed.
  - **(c) Below-threshold:** the endpoint serves the same shape with whatever history exists (no
    server coverage field); the honest short-history note is a **frontend `PriceChart.coverageNote`**
    (machinery already exists). D-086 is satisfied — the chart shows cumulative only; no annualized
    figure is computed by the chart. Settled.
  - **(d)+(e) ⚠ REBASING + PriceChart amendment.** The engine serves **absolute-value** series
    (benchmark pre-rebased to the portfolio's start value), **not** cumulative-return-% series, so
    "plot from 0% with zero frontend math" is **not directly possible**. Worse, **`PriceChart`'s
    `benchmark` prop normalises each series to its OWN min/max range** (`PriceChart.tsx:128`) — a
    relative-*shape* overlay (fine for Instrument Detail) that **cannot show out/under-performance on
    a shared axis**. → **A §5 `PriceChart` amendment is REQUIRED** (Phase-0a): a **comparison mode**
    where portfolio + benchmark share one axis (either plot the served absolute values on a common
    value axis = zero math, **or** a rebased-to-0% mode that converts value→% once in the chart
    layer). **Owner: choose value-axis (zero math) vs rebased-to-0% (a single chart-layer transform).**
- **ND-4 — Allocation & composition (RATIFIED · ⚠ OWNER SIGN-OFF on the D-082 bucket).**
  Ratified: denominator = gross assets (liabilities excluded); exclude negative/zero positions
  from the donut, footnote them; D-082 null bucket via its raw served label; verify tags payload.
  *Verified:*
  - **Denominator/liabilities:** `allocation("asset_class")` **includes** liabilities as a
    **negative** entry (`liability: −420000` in `summary`) — the donut must **filter to positive
    segments** (gross = Σ positives, matching `key_stats` gross, `analytics.py:47`) and **footnote
    the excluded liabilities/zeros** ("Liabilities −X excluded — allocation is of gross assets").
    Settled (frontend filtering + footnote, per resolution).
  - **⚠ D-082 null bucket is NOT served.** `sector_allocation()` (`portfolio.py:192`) emits **only
    positive holdings that HAVE a sector** — all `sector = null` holdings are **omitted entirely**;
    there is **no "Not sector-classified (non-equity)" label in the payload**. So "raw served label"
    does not exist. **Owner: (a)** frontend derives an honest residual bucket = gross − Σ(served
    sectors), labelled from D-082/GLOSSARY (a fixed frontend string, not served); **or (b)** a small
    backend addition to emit the null bucket. Blocks the sector donut until chosen.
  - **Tags payload (verified):** `/portfolio/tags` = `{total, tags:[{tag,value,count,pct}],
    holdings:[…]}`; `pct` is over the **net `total`**. Donut reads `tags[].{tag,value}`. Empty →
    EmptyState. Settled.
- **ND-5 — Concentration stats (RATIFIED · ⚠ OWNER SIGN-OFF: 2 of 4 served).** Ratified: render
  served `label`/`term_id` only (D-005); verify the four D-029 figures arrive distinct.
  *Verified (`/portfolio/stats.metrics`):* served concentration figures are **`Largest position`**
  and **`Top 5 concentration`** (both `term_id=term-concentration`). **⚠ NO standalone
  "Concentration" and NO "HHI" are served** (`key_stats` computes `largest` + `top5` only —
  `analytics.py:93`; HHI is defined in GLOSSARY but never computed). **Owner: (a)** ship the two
  served figures + drop HHI/standalone-Concentration from this page, **or (b)** a backend delta to
  add HHI. The rail/KeyStats otherwise map served `label`+`term_id` directly (Total value,
  Unrealised/Realised P/L, Income, Total return, XIRR, TWR, 1Y return, 1Y volatility, Return/
  volatility, Max drawdown, allocation weights, Positions). Settled except HHI.
- **ND-6 — Volatility note (RATIFIED · verified ✅ → else-branch).** *Verified:* `/portfolio/stats`
  serves **no `note`/`disclaimer`** for Return/volatility. → Per the resolution's else-branch: the
  not-a-Sharpe disclaimer is a **frontend constant copied verbatim from GLOSSARY** ("…Explicitly
  NOT a Sharpe ratio (no risk-free rate subtracted)…", D-030 protected) with an **exact-match unit
  test** to make paraphrase drift impossible. Settled.
- **ND-7 — Attribution residual (RATIFIED · verified ✅).** *Verified:* `/portfolio/attribution`
  serves `attribution.headline_return_pct`, `residual_pct`, `residual_breakdown{income_pct,
  realised_pct}`, and per-holding `contribution_pct`. Render the **residual as its own labelled row**
  + a "single-period approximation" caveat so Σ(contributions) + residual reconcile to the headline;
  **never compute/pad on the frontend**. Settled.
- **ND-8 — Entity scope (RATIFIED · verified ✅).** **No selector on this page**; default strictly
  to household. Entity CRUD belongs to the unbuilt **Accounts** milestone (D-065). The backend
  `entity_id` hook (present on every portfolio reader) is **logged as a future integration item**
  for the Accounts plan (recorded in CURRENT.md → NEXT). Settled.
- **ND-9 — List length (RATIFIED · verified ✅).** **N = 5**; show only what exists (never pad);
  if Detractors empty → explicit **EmptyState** ("Nothing declined today", Guarantee 3). *Verified:*
  `top_movers(n=5)` returns priced-only; losers filtered to `< 0` (`portfolio.py:438`). Settled.
- **ND-10 — Windows + manual toggle (RATIFIED · verified ✅).** Windows **1M/3M/6M/YTD/1Y/5Y/Max**
  mapped to `days` (YTD = days-since-Jan-1); expose **`include_manual` as an explicit labelled
  toggle, default off** (matches the endpoint baseline). *Verified:* `days` clamps 7…3650;
  `include_manual` default false (`analytics.py:221`); `PriceChart` already has
  `periods`/`activePeriod`/`onPeriodChange`. Settled.
- **ND-11 — Detail toggle (RATIFIED).** **No Detail toggle** on Portfolio (D-040 Home-only). Settled.
- **ND-12 — Realised P/L rail (RATIFIED · verified ✅ → Option B, NO delta · ⚠ label nuance).**
  Option B: **read `/portfolio/realised-gains`** (no engine/contract delta), display **"Realised
  P/L · YTD"** linking to the full **Reports** report, preserving D-076 FX caveats verbatim.
  *Verified:* the endpoint **serves a usable total** — `base_realised_total_current_fx` (807.07 in
  demo) + `base_realised_total_historical_fx` + `realised_fx_events_excluded` + the D-076
  `disclaimer` string. **→ The ND-12 conditional does NOT trigger; no backend delta; Phase 0 does
  not stop.** **⚠ Label nuance:** the report's `year` is the **latest year with realised events**
  (2024 in demo), **not** the calendar year (2026) — so a literal **"YTD" label may be inaccurate**.
  **Owner: confirm** the rail labels with the **served `year`** ("Realised P/L · 2024") rather than
  "YTD", or accept "YTD" with the report's year semantics.

**Lower-risk confirms (owner-ratified 2026-07-11):** **rotation eligibility = YES** (Dashboard,
D-044) · cross-page links bound **exactly per drafted IA §2** · all financial figures treated as
**served display strings** (no frontend math) · the **Realised P/L card links to the Reports page**.

---

## 10. PHASE 0 — VERIFICATION FINDINGS (2026-07-11) — STOP for owner sign-off

Ran the verification pass live against the seeded backend (18 demo holdings) — read what the
engine serves before committing to any build shape (D-019). **No backend delta was needed** (the
ND-12 conditional did not trigger), so Phase 0 completes here and **STOPS for owner review**; do
not begin Phase-0a/1 until the owner signs off this report.

**Engine-serving facts (as verified):**

| Item | What the engine serves | Source |
|------|------------------------|--------|
| Movers | `top_gainers`/`top_losers` ranked by `day_change_base` (today) | `portfolio.py:438`, `/portfolio/summary` |
| Holdings-header figure | `GET /portfolio/summary.total_value` = `value_portfolio` **net-of-liabilities** (= Net worth) | `holdings.ts:122`, `portfolio.py` `value_portfolio` |
| Performance return basis | **current-holdings mark-to-market**, invested-only, simple `end/start−1` — **NOT a formal TWR**; manual excluded unless `include_manual` | `analytics.py:216` |
| Benchmark basis | **price-only** raw daily closes (no dividends), **pre-indexed to the portfolio's start value** | `analytics.py:287` |
| Performance below-threshold | same shape, whatever history exists; **no server coverage note** (frontend `coverageNote`) | `analytics.py:241`; `PriceChart.tsx:27` |
| Allocation (class/ccy) | **includes liabilities as a negative entry** (net); gross = Σ positives | `portfolio.py:185`, `summary` payload |
| Sector allocation | **omits all `sector = null` holdings** — **no D-082 bucket served** | `portfolio.py:192` |
| Tags | `{total, tags:[{tag,value,count,pct}], holdings:[…]}`; pct over net total | `tags.py` `tag_allocation` |
| Concentration | **`Largest position` + `Top 5 concentration` only — NO HHI, NO standalone Concentration** | `/portfolio/stats.metrics`, `analytics.py:93` |
| Volatility note | **not served** (no `note`/`disclaimer`) → frontend GLOSSARY constant | `/portfolio/stats` |
| Attribution residual | **served**: `residual_pct` + `residual_breakdown` + per-holding `contribution_pct` | `/portfolio/attribution` |
| Realised P/L total | **served & usable**: `base_realised_total_current_fx` (+ historical-FX + excluded count + D-076 disclaimer) | `/portfolio/realised-gains` |
| PriceChart benchmark prop | exists (`benchmark: number[]`) but **normalises each series to its own range** — no shared axis | `PriceChart.tsx:128` |

**Resulting Phase-0a scope (pending owner sign-off):**
1. **`PriceChart` §5 amendment (REQUIRED, ND-3d/e):** add a **comparison mode** (shared value axis
   for two same-unit series, or a rebased-to-0% transform in the chart layer) — the current
   per-series normalisation cannot show portfolio-vs-benchmark out/under-performance. Ratify at
   `/kitchen-sink`. *Owner picks value-axis (zero math) vs rebased-to-0%.*
2. **AllocationDonut null-bucket handling (ND-4, owner call):** either a frontend-derived
   "Not sector-classified" residual segment (fixed label) **or** a backend null-bucket addition —
   plus a donut **footnote affordance** for excluded liabilities/zeros (confirm the ratified donut
   supports a footnote line, else a small §5 note).

**Open owner sign-off items (from §9, before Phase-0a/1):**
- ND-3a: honest label for the performance return (not "TWR").
- ND-3d/e: value-axis vs rebased-to-0% for the comparison chart (drives the §5 amendment shape).
- ND-4: D-082 null bucket — frontend residual vs backend addition.
- ND-5: HHI — drop from this page vs backend delta (only Largest position + Top-5 are served).
- ND-12: rail label — served `year` ("· 2024") vs "· YTD".

**Sign-off to start Phase-0a/1:** the five open items above resolved · the §5 `PriceChart`
comparison-mode amendment scoped · everything else in §9 is settled and verified. **No further
build until the owner signs off this verification report.**

# page-portfolio.md — Portfolio (analytics) page build plan

**Status: DONE ✅ — page owner-accepted 2026-07-12 (see §13 retrospective).** Phases 0/0a/1/2 +
Phase-3a scripted pre-pass + Phase-3b owner walk (batches 1–4, all ratified). Batch-13 NDs ratified
(§9/§11); Phase-0 verification (§10); ND-4 backend delta shipped; Phase-0a amendments (PriceChart
comparison mode + AllocationDonut footnote) ratified. Pre-pass runs full green (data + controls +
donut/chart hover + equal rail geometry + 0 overflow at 320/375/900/1366 × both themes, 0 console
errors). Platform legacy: categorical palette, progressive per-card loading, hover readouts,
DataTable-everywhere, PriceChart comparison mode, equal-geometry-from-the-grid rule. Commits
`751f9bf`→ batch-4 close-out. **No open blockers.**

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

---

## 11. PHASE-0 REOPEN — Batch-13 owner calls executed (2026-07-11)

Owner signed off §10 and made the five calls. Executed below (backend delta = **one commit**,
contract regenerated, suite green). Sequence next: Phase-0a specimens, then PAUSE for ratification.

- **ND-3a — chart label (DONE) · ⚠ TWR flag (HELD for owner).** Chart line labelled **"Current
  holdings — price return"** (with the **"include manual assets"** variant when on). GLOSSARY term
  **added**, defined exactly as the engine computes (today's positions marked-to-market over the
  window; excludes flows and closed positions; not TWR/money-weighted). **⚠ NOT DONE (contradicted
  by verification):** the call to *"correct the TWR line to say TWR is not implemented"* and to
  *register ROADMAP R-26 (flow-aware TWR)* — **verification found flow-aware TWR IS implemented**:
  `time_weighted_return` (`analytics.py:331`) reconstructs point-in-time holdings and **chain-links
  daily returns with each day's external capital removed** via `app/core/twr.twr_from_flows`, and it
  is **served** as the stat-rail **"Time-weighted return (TWR)"** metric (`term-xirr-twr`; returns
  "Not applicable" on thin history, D-086). Writing "not implemented" would be false and R-26 would
  duplicate an existing capability. **HELD — owner to confirm:** keep the GLOSSARY TWR line as-is
  (accurate) and **drop R-26**? (The chart-is-not-TWR distinction is fully captured by the new term.)
- **ND-3d/e — shared value axis (SETTLED).** Plot the **served portfolio value series** + the
  **served pre-indexed benchmark series** on **one shared value axis, zero frontend math**. Phase-0a
  §5 scope: `PriceChart` **"comparison mode"** = a **second same-unit series on the shared axis +
  legend + provenance sublabel** ("S&P 500 — SPY proxy · price return, excl. dividends"). Nothing more.
- **ND-4 — BACKEND DELTA (DONE, committed this reopen; contract regen + suite green).** Spec
  enforcement (D-082 + GLOSSARY):
  - **(a) D-082 bucket served:** `sector_allocation()` now emits **"Not sector-classified
    (non-equity)"** (module constant `UNCLASSIFIED_SECTOR_LABEL`) for every positive holding without a
    sector; the donut sums to gross (`portfolio.py`).
  - **(b) Denominator = gross assets, liabilities excluded, never allocation rows:** `allocation()`
    counts **positive holdings only** (no `liability` row; class/currency sum to gross); `tag_allocation`
    denominator switched to **gross** (`tags.py`); `/portfolio/summary` gains served **`gross_assets`**
    + **`liabilities`** for the honest donut footnote (no frontend math).
  - **Verified live:** `allocation_by_class` has no `liability` key and sums to `gross_assets`
    (1,239,848.4); `allocation_by_sector` includes the D-082 bucket and sums to gross; `tags.total` =
    gross. **Tests:** `test_allocation_is_gross_and_excludes_liabilities`,
    `test_sector_allocation_serves_the_d082_null_bucket`. **Contract unchanged** (untyped `dict`
    endpoints — regen confirms current). **489 backend passed.**
- **ND-5 — HHI (SETTLED; branch reported: "legacy served it" → already an existing v2 capability,
  NO delta, NO R-27).** Legacy check: `~/Documents/github/LedgerFrame/audit/04-CALCULATION-ENGINE.md:142`
  + `PHASE_REPORT.md:729` + `test_help.py` (`term-hhi`) confirm legacy computed HHI. **Verification:
  v2 STILL computes it** (`risk_metrics`, `analytics.py`) and **serves it live** at
  **`/portfolio/attribution.risk.hhi` (= 0.6311)** — the Phase-0 "HHI not served" finding was checking
  the wrong endpoint (`/portfolio/stats`). So the page reads **Largest position + Top-5 from
  `/portfolio/stats`** and **HHI from `/portfolio/attribution.risk`** — all D-029 figures present, no
  backend change, **R-27 not registered.**
- **ND-12 — rail label (SETTLED).** The Realised P/L rail uses the **served report `year`** —
  **"Realised P/L · {year}"** (e.g. "· 2024"), **never "YTD"**; reads `/portfolio/realised-gains`
  (`base_realised_total_current_fx` + D-076 caveats verbatim); links to the **Reports** page unchanged.

**Phase-0a scope (final, pending ratification):**
1. **`PriceChart` comparison-mode §5 amendment (PROPOSED):** second same-unit series on a shared
   value axis + legend + provenance sublabel (ND-3d/e). Ratify at `/kitchen-sink`.
2. **AllocationDonut null-bucket + footnote specimens (PROPOSED):** renders the served D-082 bucket
   as a first-class labelled segment + a footnote line for excluded liabilities (`summary.liabilities`).
   Ratify at `/kitchen-sink`.

**One open owner item before Phase 1 (beyond Phase-0a ratification): the ⚠ TWR flag above (ND-3a).**

---

## 12. PHASE-3B WALK — batch 1 (owner, 2026-07-11)

Owner's live walk. Each finding recorded, fixed, pre-pass re-run, then owner re-verifies.

- **§12-1 — Content had no gap from the sidebar (template-level BUG, FIXED).** `/portfolio`'s `.pf`
  set no root padding while `.hold`/`.ins` each set their own → Portfolio's content sat flush against
  the chrome. Moved the content padding to the **shared `.lf-shell__content`** (owned by the shell,
  not per page); removed it from `.hold`/`.ins` (their max-width/centering kept). **Overflow-suite
  check added:** all built content pages (`/holdings`, `/portfolio`, `/instrument/:sym`) share **one
  content-left inset** (equal, non-zero) — catches any page that drops or doubles the gap.
- **§12-2 — Stat rail: compact equal tiles, responsive (PROPOSED, ratify at re-verify).** Rail is a
  fixed 6-col grid (6×1) → 3-col (≤72rem) → 2-col (≤40rem); tiles compacted (smaller value size +
  padding) so all six fit a row and money never overflows. **TWR is a normal grid tile** (no orphan
  row). The **Realised P/L tile's Report link is now the D-100 header-arrow** (↗) inside the tile,
  top-right, linking to Reports.
- **§12-3 — Allocation legend rendered raw enum keys (D-005 + copy-hygiene BUG, FIXED).** The class
  donut showed `fixed_deposit`/`equity`/`etf`. Class labels now resolve through the **served
  `labelFor("asset_class", …)`** — the same source Holdings' class chips use. Audited all four donuts
  (sector/currency/tag were already display strings) + the attribution **Class** column (already
  mapped). **Test added:** no donut legend label matches an internal key pattern
  (`^[a-z]+(_[a-z]+)*$`).
- **§12-4 — D-082 bucket label: OWNER DECISION PENDING.** Options: keep **"Not sector-classified
  (non-equity)"** as-is · "No sector (non-equity)" · "Sector Unavailable". **Kept as-is** (no change)
  pending the owner's pick at re-verify. If changed: it's a **served** label (backend-side change +
  D-082 amendment in DECISIONS.md + GLOSSARY update; contract untouched — label is data).
- **§12-5 — Attribution table D-101 (FIXED).** The table now scrolls inside its own container with a
  **`--table-max-h` cap** and the **header pinned (sticky) outside the row scroll**, like the Holdings
  tables. (Horizontal scroll for the wide case was already in place.)
- **§12-6 — Categorical data-viz palette (DESIGN-SYSTEM §4 amendment, PROPOSED).** Replaced the
  monochrome slate-ramp segment palette with a **tokenized categorical identity palette** —
  `--cat-1..8`, a fixed-order 8-hue set (blue/aqua/yellow/green/violet/red/magenta/orange),
  **colour-blind-aware and VALIDATED** with the dataviz validator (light: worst adjacent CVD ΔE 24.2;
  dark: the same hues stepped for the dark surface, ΔE 10.3 floor band — legal with the always-present
  legend + segment relief). **Semantic gain/loss/attention stay reserved for meaning**; categorical
  identity is a distinct axis. Applied to all four donuts (`.lf-seg--0..7`, cycle of 8). Light + dark
  defined; **high-contrast inherits** the validated set (identity carried by the contrast-boosted
  legend labels). **Kitchen-sink specimen:** the 8-swatch palette board + an 8-identity donut; ratify
  by toggling theme + contrast. *(Caveat: >8 identities currently cycle; a proper "Other" fold is a
  follow-up — allocation dimensions rarely exceed 8.)*

**Checks after batch 1:** frontend **112 vitest + 41 Playwright** (incl. content-left-offset +
raw-key guards) + drift + build green. Live pre-pass re-run green (below).

**Batch 1 — RATIFIED (owner, 2026-07-11):** §12-2 compact stat rail and §12-6 categorical palette
ratified as seen live (owner confirms the palette across theme + high-contrast at re-verify).

## PHASE-3B WALK — batch 2 (owner, 2026-07-11)

Recorded, fixed, pre-pass re-run green, awaiting owner re-verify.

1. **D-082 label → "Unclassified sector" (owner pick; §12-4 resolved).** Served backend-side
   (`UNCLASSIFIED_SECTOR_LABEL`); **D-082 amendment recorded in DECISIONS.md**, GLOSSARY + MASTER-DATA
   updated (definition keeps the truth: non-equity holdings *have no sector*, not pending). The
   segment carries an **explanation tooltip** (donut hover/legend). Contract untouched (label is data).
2. **Page-action enforcement.** "Manage holdings" is now a **ratified icon-only framed page-action**
   (`lf-iconbtn--framed`, Rows4 icon, tooltip + aria-label). Audited the page — no other text-action
   stragglers (Reports/Net-worth are in-content D-100 cross-links, not header actions).
3. **AllocationDonut true ring.** `.lf-donut__svg circle { fill: none }` beats the categorical fill
   so the **centre is transparent** in every theme.
4. **Excluded-liabilities footnote once per section.** One `* Liabilities … excluded` line at the
   Allocation section bottom; each affected donut (class/sector/currency) carries the **`*` marker**;
   the served figure is unchanged. (Per-donut `.lf-donut__footnote` removed from the page.)
5. **Concentration + Risk&return tiles centre-aligned** (PROPOSED, ratify at re-verify); tabular
   figures retained.
6. **Return attribution → DataTable** (client sort + filter, like Holdings) + reconciling residual +
   headline summary below. **Export: `GET /portfolio/attribution.csv`** (server-side, D-050;
   contract regenerated same commit, +1 path; backend test) via the ratified **Export CSV** button.
7. **Hover values.** PriceChart already had a crosshair + close tooltip; **added the benchmark value**
   to the tooltip in comparison mode. **AllocationDonut segment hover/focus** shows *label · value ·
   pct · note* (aria-live), **keyboard-reachable via the focusable legend**. Kitchen-sink specimens
   (true-ring + hover donut; Skeleton).
8. **Progressive per-card loading** (TEMPLATE amendment). `/portfolio` loads **per card**: each shows
   `ui/Skeleton` → data / EmptyState / honest error; readers fire independently (no full-page block on
   the slowest). New `Skeleton` component. Recorded in `TEMPLATE-page-build.md` as the overview
   standard; **pre-pass asserts no card is left in skeleton**.

**Checks after batch 2:** frontend **112 vitest + 41 Playwright** + drift + build; backend **490**
(+ attribution.csv test), contract current. Live pre-pass green (donut hover readout, Export CSV,
filter, no residual skeletons, 0 overflow 320/375/900/1366 × both themes, 0 console errors).

**Batch 2 — RATIFIED (owner, seen live):** true-ring donut, donut/chart hover readouts,
progressive per-card skeletons, centre-aligned concentration/risk tiles.

## PHASE-3B WALK — batch 3 (owner, 2026-07-11)

Recorded, fixed, pre-pass re-run green, awaiting owner re-verify. (Page NOT closed.)

1. **Stat-rail values formatted + centre-aligned.** The tiles passed a **raw `delta` number**
   (108109.45) which TrendStat rendered unformatted. Fixed by dropping the redundant delta subline
   (value == the figure) and adding a **`tone`** to TrendStat that **colours the value itself**
   (gain/loss); the value is the served number **formatted** (comma groups) via the same helper as
   the rest of the page. Main-rail tiles now get the **ratified centre-aligned** treatment.
   Movers deltas were already formatted (formatSignedMoney/Percent).
2. **Movers show the instrument price.** *Verified:* `price` + `currency` are **already served** on
   each mover row (no reshape) — added them to the mover display (formatted, alongside the delta).
3. **Attribution symbol links match Holdings.** Added a shared **`.lf-table__td a`** treatment
   (accent, no underline; underline on hover) so DataTable cell links never diverge to browser
   blue/underline. Audited the page — movers/net-worth/Reports links were already accent/no-underline.
4. **Skeleton → subtle pulse/fade** (opacity), not a directional shimmer; **static under
   reduced-motion**. Kitchen-sink specimen present.
5. **Sidebar hierarchy (DESIGN-SYSTEM §5.5 amendment, PROPOSED).** Page entries **indented** under
   their group header (extra left padding); the active rail stays at the left edge. Visual only —
   D-043 groups/order untouched. Global chrome.
6. **Demo seed tags.** Added representative tags (**core / dividend / speculative**) to several demo
   holdings so the **By-tag donut + `/portfolio/tags` render populated** in demo (verified: core
   40,103 · speculative 20,251 · dividend 17,153). Seed-flag convention unchanged; a tags test was
   updated for the seeded state.

**Checks after batch 3:** frontend **113 vitest** (+ mover-price) **+ 41 Playwright** + drift +
build; backend suite green + contract current. Live pre-pass green (comma-formatted rail values,
By-tag donut populated, mover price, donut hover, no residual skeletons, 0 overflow, 0 console errors).

**Batch 3 — RATIFIED (owner, 2026-07-11):** sidebar page-entry indentation (§12b3-5), skeleton
pulse/fade (§12b3-4), and the categorical palette (§12-6) confirmed live across theme +
high-contrast.

## PHASE-3B WALK — batch 4 (owner, 2026-07-11)

Recorded, fixed, pre-pass re-run, awaiting owner re-verify. (Page NOT closed.)

1. **§12b4-1 — Stat-rail tiles: EQUAL geometry from the grid (repeat of §12b3-1, now fixed at the
   root).** The Realised P/L (· 2024) tile still read shorter than its siblings. Root cause: the
   Realised tile wraps its `TrendStat` in `.pf__railtile` (for the corner Report link); the wrapper
   is the grid item and stretches to the row height, but the inner `.lf-stat` — the element that
   PAINTS the tile (bg/border) — was content-height, so it under-filled the cell. Fix is
   grid-driven, not content-driven: `.pf__railtile > .lf-stat { flex: 1 1 auto }` so the painted box
   fills the stretched cell; equal columns already come from `repeat(6,1fr)` → `3` → `2`. **Content
   can no longer resize a tile.** **New pre-pass assertion added** (portfolio-smoke §PART 1): every
   painted `.pf__rail[data-card="rail"] .lf-stat`, grouped by rendered row, must be equal width AND
   height (≤1px) at 320/375/900/1366. **Verified live GREEN:** wSpread 0 / hSpread 0 on all rows at
   all four breakpoints (2×3 at 320/375, 3×2 at 900, 6×1 at 1366).
2. **§12b4-2 — Demo-seed tags re-authored with display casing** → `Core`, `Dividend`,
   `Speculative` (`app/seed/demo.py`). **RULE RECORDED: tags are user-authored strings rendered
   VERBATIM — no UI casing transform anywhere.** Verified: the By-tag donut renders `t.tag`
   directly and no `.lf-donut__label`/legend CSS applies `text-transform` (the only `uppercase` is
   the unrelated sidebar group header). The seed writes `HoldingTag` rows directly (bypassing the
   write-path cleaner) and `tag_allocation` serves them unmodified, so seeded casing is preserved.
   **⚠ OWNER DECISION (contradiction to surface):** the USER write path
   `set_holding_tags` → `_clean_tags` (`app/services/tags.py:29`) **lowercases + underscores +
   truncates(24)** every user-entered tag (`"Core"→"core"`, `"High Conviction"→"high_conviction"`;
   asserted by `test_tags_contributions.py`). So "rendered verbatim" holds for the SEED but **not for
   user-entered tags** — a real install would show mixed casing (seeded `Core` vs user `core`).
   Left unchanged per F6 (not in the batch; behavioural + test change). Owner: (a) accept
   seed-only display casing (demo cosmetic), or (b) relax `_clean_tags` to preserve author casing
   (behavioural change + update the normalisation test + a DECISIONS entry). **Live tag-render not
   yet confirmed on the running instance** — the seeded DB predates this change; needs a demo
   re-seed (owner-authorised DB reset) to show `Core`/`Dividend`/`Speculative`.
3. **§12b4-3 — Movers currency: KEEP ISO codes (owner rec; no change).** Verified the mover rows
   already render the SERVED ISO code (`{r.currency} {price}`, e.g. `USD`/`SGD`/`INR`), sourced from
   `currency_for_symbol`/instrument/txn currency (`portfolio.py`). Symbols were rejected as
   ambiguous (SGD/USD both render `$`). Switching to distinct served symbols (`S$`/`US$`/`₹`) would
   require a symbol field on the currency master + backend formatting (no client mapping) — **not
   done** (owner recommended ISO). Decision recorded; no code change.
4. **§12b4-4 — Risk & return tone: gain/loss colour on signed metrics.** Reused the TrendStat
   `tone` mechanism: **1Y return**, **Return / volatility**, and **Max drawdown (1Y)** now take
   `tone` from the SERVED value's sign (`metricTone` → `signOf(m.value)`, no client math). **1Y
   volatility stays NEUTRAL** (a magnitude, not a direction) — deliberately not toned. Max drawdown
   is engine-computed ≤ 0, so it reads loss-red when non-zero; flat at 0.

**Checks after batch 4:** frontend **113 vitest + 41 overflow Playwright + drift + typecheck +
lint + build** green; backend `test_tags_contributions.py` green (seed casing doesn't affect the
write-path normalisation test). **Live pre-pass FULL GREEN** (re-run ×3 after an owner-authorised
demo re-seed): tile-geometry assertion equal width+height per row at all four breakpoints incl. the
Realised tile; cased By-tag donut (`Core`/`Speculative`/`Dividend`); mover price; donut hover;
attribution residual/HHI; 0 overflow 320/375/900/1366 × both themes; 0 console errors. Pre-pass
hardened to **wait each progressive card out of skeleton before asserting** (fixed a PART-5 race).

**Batch 4 — RATIFIED (owner, 2026-07-12):** §12b4-1 (equal-geometry rail), §12b4-3 (ISO-code mover
currency), §12b4-4 (signed risk/return tone) verified live. §12b4-2 resolved by **D-104**
(normalise-on-write + render-verbatim + sanctioned demo-seed casing; `_clean_tags` kept as-is).

---

## 13. MILESTONE RETROSPECTIVE — Portfolio DONE ✅ (owner sign-off, 2026-07-12)

**`/portfolio` is complete and owner-accepted.** The second overview-template page (after the Home/
Net-worth family), the analytics half of the Holdings↔Portfolio split (D-023). Phases 0/0a/1/2 +
Phase-3a scripted pre-pass + Phase-3b owner walk (batches 1–4, all ratified). Commits `751f9bf`→
(batch-4 close-out). No open blockers.

**What the build produced (platform legacy — reusable beyond this page):**
- **Categorical data-viz palette** (DESIGN-SYSTEM §4): `--cat-1..8`, colour-blind-validated, light +
  dark + high-contrast; semantic gain/loss/attention stay reserved for meaning (§12-6).
- **Progressive per-card loading** (TEMPLATE overview standard): each card resolves on its own reader
  — Skeleton → data / EmptyState / honest error; no full-page block on the slowest reader (§12-8).
- **Hover/focus readouts** on donut segments + the comparison chart (label · value · pct · note;
  keyboard-reachable via the focusable legend) (§12-7).
- **DataTable-everywhere for tabular cards** (attribution as a sort/filter/CSV DataTable, like
  Holdings) (§12-6).
- **PriceChart comparison mode** (shared value axis, second same-unit series + legend + provenance
  sublabel) — the §5 amendment ratified at Phase-0a.
- **Equal-geometry-from-the-grid rule** for stat rails (§12b4-1) + its pre-pass assertion.

**Process lessons (folded into `TEMPLATE-page-build.md` this commit):**
1. **A repeat finding is the signature of a fix with no assertion.** §12b3-1 (rail tiles) recurred as
   §12b4-1 because the first fix shipped without a measuring guard. **Rule encoded (TEMPLATE §7/§8):
   every visual/geometry fix ships a rendered-measurement pre-pass assertion, in the SAME batch, at
   all breakpoints.** jsdom can't measure — it lives in Playwright.
2. **Verify-first ND resolutions caught two would-be fabrications.** Reading the engine before writing
   the resolution overturned two premises: the "TWR not implemented / register R-26" call (flow-aware
   TWR **is** implemented + served — §11 ND-3a) and the "HHI not served / add a delta" call (HHI **is**
   computed + served at `/portfolio/attribution.risk` — §11 ND-5; Phase-0 had checked the wrong
   endpoint). **Keep verify-first phrasing in every future ND resolution** (D-019 read-first).
3. **Progressive loading races the pre-pass** — assert card content only after waiting it out of
   skeleton (fixed a PART-5 flake; rule added to TEMPLATE §8).

**Judgment-flagged (owner calls this milestone, not derivable from specs):** D-104 tag
normalise-vs-verbatim posture (kept `_clean_tags`; demo casing a sanctioned exception); ISO currency
codes over ambiguous symbols in movers (§12b4-3); D-082 bucket label wording "Unclassified sector"
(§12-4 → batch-2 #1); performance return honest label "Current holdings — price return" over "TWR"
(§11 ND-3a). Each is recorded with its rationale so a later reader doesn't re-litigate it.

---

## DELTA NOTE — 2026-07-16 (page-insurance walk batch 2, §14in-7)

- **Base-currency affix (RATIFIED):** the stat-rail money tiles (Today's change · Unrealised P/L · Realised
  P/L · Cost basis) and the **Costs** figures (recorded fees · ongoing cost) now carry the served
  `base_currency` (`/portfolio/summary`, `/portfolio/cost-of-ownership`) as the muted `.lf-stat__unit`
  affix; %/metric tiles carry none. Portfolio.test.tsx (12) + `portfolio-smoke` green.

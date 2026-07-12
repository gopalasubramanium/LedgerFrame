# page-markets.md — Markets page build plan

**Status: §9 RESOLVED — Phases 1/2/3a DONE, Phase-3b walk IN-PROGRESS (batch 1 done, owner
2026-07-12).** Phase 0 skipped (no §3b delta), Phase 0a composition-only (no §5 amendment). Drafted
2026-07-12 from
`TEMPLATE-page-build.md` (incl. the §7/§8 fail-first + reproduce-the-defect-first amendments, the
Reports-group/worklist-shape note, the Phase-3a scripted-pre-pass standard, and progressive-per-card
loading). Verify-first pass done (§10 — read what the markets/quotes/indices/watchlist readers
actually serve before assuming shapes, D-019). **Nothing is built.** Every ambiguity is in §9; the
owner resolves them.

Markets is the **Markets-group** home page and the canonical home for **quotes, indices, market
status, Gainers/Losers, symbol search, the instrument grid, the Global tab, and watchlist
management** (IA §5, D-037/D-034/D-051/D-052). It **absorbs the removed `/global` page's job** (the
Global tab; no redirect exists, D-042). Shipping it **unblocks ROADMAP R-17** — the TickerStrip's
index entries link here (§9 ND-5, REQUIRED in scope).

---

## 1. IDENTITY

*Source: INFORMATION-ARCHITECTURE.md §2 (page map), §3 (nav + rotation); DESIGN-SYSTEM.md §3.*

| Field | Value | Spec ref |
|-------|-------|----------|
| Page name (H1 = nav label = route) | **Markets** | IA §2, D-022 |
| Route | `/markets` | IA §2 |
| Nav group | **Markets** (Markets · Heatmap · News) | IA §3 |
| Page template | **Overview + worklist hybrid** — market-status/indices/Gainers-Losers header over an instrument-grid + watchlists worklist body. **Template fit is a §9 item (ND-3).** | DESIGN-SYSTEM §3 |
| Rotation eligibility | **Confirm ND-9** (dashboard-class? Markets is a live-data page) | IA §3 (D-044) |
| One-line purpose | **Markets** — quotes, indices, market status, **Gainers/Losers** (price-move lists, D-034), symbol search, the instrument grid, the **Global** tab (world indices), and **watchlist management**. Region-news dropped → links to News (D-051). | IA §2/§5 |

**`/global` is removed with no redirect (D-042);** this page **owns the Global tab** that did its job.

---

## 2. OWNERSHIP TABLE

*Copied verbatim from INFORMATION-ARCHITECTURE.md §5 (Markets). Never re-derived.*

**Owns (canonical, authoritative, fully explained here):**
- **Quotes, indices, market status** (D-037).
- **Gainers / Losers** — **price-move** lists ranked by price change (D-034); **NOT**
  Contributors/Detractors (that contribution-weighted pair is **Portfolio's**, D-024). GLOSSARY
  which-list rule is protected.
- **Region tabs; symbol search; the instrument grid; the Global tab** (world indices).
- **Real-vs-ETF-proxy badge** — a **protected honesty feature** (D-051): a world index shown via a
  liquid ETF proxy (not the real index level) is labelled as such, never passed off as the index.
- **Watchlist management** — create/delete lists, add/remove items — **management lives ONLY here**
  (D-052).

**Dropped:** region-news blocks → **link to News region groups** (D-051).

**Summarises:** — (nothing).

**Links to:** **News** (region groups, D-051) · **InstrumentDetail** per symbol (scoped quote/news,
P-3) · **Heatmap** (sibling Markets page). The **TickerStrip index entries link here** (R-17, ND-5).

**Enforcement corollary (P-1/D-031):** every quote/index/status figure is a **served display value**
from the markets readers; the frontend performs **no money math** (ranking Gainers/Losers is a
**display sort of served `change_pct`**, not a computation — confirm framing in ND-1).

---

## 3. API SURFACE

*Source: API-CONTRACT.json (frozen) + API-CONTRACT.md. Verify-first shapes are pinned in §10.*

### 3a. Endpoints consumed (already in the frozen contract)

| Method + path | Purpose on this page | Response shape (verified §10) |
|---------------|----------------------|-------------------------------|
| `GET /markets/overview` | the instrument grid + market status | `{quotes, instruments:[{symbol,name,asset_class,currency,country,held,quote}], market_status, demo_mode}` — **no Gainers/Losers list (ND-1)**; no region param (ND-2) |
| `GET /markets/global` | the **Global tab** (world indices by region) + the D-051 badge | `{groups:[{region, items:[{symbol,label,quote}]}], market_status, demo_mode, real_indices}` — indices are a **hardcoded backend universe** (`_GLOBAL_MARKETS`, ND-7) |
| `GET /markets/search?q=` | symbol search | `{results:[…provider search hits…]}` |
| `GET /watchlists` | watchlist panel (lists + item quotes) | `{watchlists:[{id,name,items:[{symbol,name,quote}]}]}` |
| `POST /watchlists` · `DELETE /watchlists/{id}` | create / delete a list (**`require_auth`**, ND-4) | `{ok,id}` / `{ok}` |
| `POST /watchlists/{id}/items` · `DELETE /watchlists/{id}/items/{symbol}` | add / remove an item (**`require_auth`**) | `{ok}` |
| `GET /instruments/search?q=&asset_class=` | class-aware picker for add-to-watchlist (D-097) | `existing`/`other_class`/`suggestions` (reused from Holdings) |

### 3b. Contract deltas (needed but not in the baseline — BUILD BACKEND-FIRST)

**None asserted.** The one candidate — a **served Gainers/Losers list** — is raised in **§9 ND-1**
(the alternative is a display-sort of the served overview quotes, no delta). Suspected gaps go to
**§9, not a §3b guess.** Any approved delta regenerates `API-CONTRACT.json` + `docs/openapi.json`
same commit (`make api-contract-check`).

---

## 4. COMPONENTS

*Source: DESIGN-SYSTEM.md §5 (ratified) + §3 (templates). Ratified only; a missing affordance is a §9
amendment request. Data-wired to real endpoints.*

| Ratified component | Role on this page | Data source (real endpoint) | Not exercised at kitchen-sink |
|--------------------|-------------------|-----------------------------|-------------------------------|
| **PageHeader** | H1 "Markets" + subtitle + actions (search, new watchlist) | — | multiple actions |
| **DataTable** | the **instrument grid**; **Gainers/Losers** lists; **watchlist** item tables | `/markets/overview.instruments`, `/watchlists` | sort by served `change_pct`; a `held` badge column |
| **QuoteCardRow** (D-046) | compact **indices / Global-tab** quote rows (or the grid header) | `/markets/global.groups` | a quote row with the real-vs-ETF-proxy badge |
| **Select** (or a tab control) | **region tabs**, quote-view scope | view-scope (ND-2) | region tabs — a Tabs affordance may be a §5 amendment (ND-2) |
| **InstrumentPicker** | symbol **search** + add-to-watchlist (class-aware, D-097) | `/markets/search`, `/instruments/search` | search feeding both the grid and watchlist-add |
| **RowMenu** | watchlist item actions (remove; open); grid row → InstrumentDetail | — | remove-item (auth) |
| **ConfirmDialog (+[S])** | create/delete list, remove item (`require_auth`, ND-4) | — | `[S]`-gated watchlist mutation |
| **ProvenanceBadge / StalenessChip** | per-quote freshness; the **real-vs-ETF-proxy** badge (D-051) | `quote` fields; `real_indices` + per-item symbol | protected-honesty proxy badge |
| **TrendStat / a status pill** | **market status** (open/closed) + headline index moves | `market_status` | a market-open/closed indicator |
| **EmptyState** | no watchlists, empty search, unreachable reader | reader shapes | empty-watchlist / no-results |
| **GlossaryTerm** | `[Help]` on Gainers/Losers, Index, ETF proxy, Market status | GLOSSARY | Gainers/Losers vs Contributors/Detractors distinction |

**Affordances the ratified inventory may lack (amendment — resolve in §9 before build):**
- **Region tabs (ND-2).** If region filtering is a **tab bar** (not a `Select`), a **Tabs** affordance
  may be a DESIGN-SYSTEM §5 amendment. Confirm `Select`/segmented buttons suffice, or propose Tabs.
- **Market-status pill.** A small open/closed indicator — confirm a ratified element covers it
  (a chip/`TrendStat`) or it is a tiny §5 note.

**Component usage rules the build must honour (template §4):**
- **Which-list rule (D-024, protected):** these are **Gainers/Losers** (price-move), **never**
  Contributors/Detractors — copy is guarded.
- **No frontend money math:** Gainers/Losers is a **display sort of served `change_pct`** (ND-1), not
  a computed ranking of prices.
- **Real-vs-ETF-proxy is protected honesty (D-051):** a proxy is always labelled; never shown as the
  real index.
- **Watchlist mutations are `require_auth`** (`[S]`, ND-4); server-side; no client fabrication.
- **Scroll = content only, header outside (D-101);** grids/watchlists cap at `--table-max-h`.
- **DataTable caption sr-only inside titled cards** (DESIGN-SYSTEM §5.2); reconciling totals use `<tfoot>`.

---

## 5. VOCABULARIES

*Source: MASTER-DATA.md + served data. Every categorical → its master/served source.*

| Field on this page | Vocabulary / source | Fixed / served | Ref |
|--------------------|---------------------|----------------|-----|
| Instrument **asset_class** (grid) | `AssetClass` | fixed (served label) | MASTER-DATA §2 |
| **Region** (tabs / Global groups) | served `region` on `/markets/global.groups`; grid `country` | **served** (Global regions: Americas/Europe/Asia-Pacific/Commodities/Crypto) — **or** the D-083 six buckets? (ND-2) | §10; D-083 |
| **Index universe** | `_GLOBAL_MARKETS` (backend constant) | **hardcoded backend list, not a master, not user-editable** (ND-7) | markets.py |
| **Search** provider hits | `/markets/search` / `/instruments/search` | served | §10 |
| Quote **source** (if a select) | served provider list | served (D-005) — but see ND-8 (source select is Home's, D-052) | IA §5 |

All quote/status/region/index labels are **served display strings** — render verbatim; never hardcode.

---

## 6. DECISIONS IN FORCE

*Source: docs/audit/DECISIONS.md — each with what it forbids/requires here.*

| Decision | What it forbids / requires on this page |
|----------|------------------------------------------|
| **D-024** | Two movers pairs: this page shows **Gainers / Losers** (price-move), **never** Contributors/Detractors (Portfolio's contribution-weighted pair) or the retired "Top movers". |
| **D-034** | **Gainers/Losers canonical here** (Contributors/Detractors = Portfolio). |
| **D-037** | Quotes / indices / market status canonical here; **News** is canonical for briefing + grouped headlines (this page **links** to News, never duplicates it). |
| **D-051** | Keep region tabs, search, indices, Gainers/Losers, instrument grid, **Global tab**, the **real-vs-ETF-proxy badge** (protected honesty). **Drop region-news blocks → link to News.** |
| **D-052** | **Watchlist management lives ONLY here** (create/delete lists, add/remove items). Home shows watchlist quotes via a source select (that is Home's, not this page — ND-8). |
| **D-042** | `/global` removed, **no redirect**; this page owns the Global tab that did its job. |
| **D-005 / D-050** | Served vocab/labels (zero-copy); any export server-side. |
| **D-069 / D-002** | Watchlist mutations `require_auth` (`[S]`); under **no-egress**, live quotes degrade to **honest stale**, never fabricated (Guarantee 5). |

---

## 7. ACCEPTANCE CRITERIA

*Checkable, user-visible. Includes honesty states + theme/density + overflow + the §7/§8 fail-first rule.*

- [ ] **Quotes / instrument grid (D-037):** the served instruments render with quotes + a `held`
      badge; sortable; freshness flagged (D-027); no frontend money math.
- [ ] **Gainers / Losers (D-024/D-034):** labelled exactly that — **never "Contributors/Detractors"**;
      **price-move** ranking (display sort of served `change_pct`, ND-1); honest empty state.
- [ ] **Global tab (D-042/D-051):** world indices by region; the **real-vs-ETF-proxy badge** shown on
      any proxy-sourced index (protected honesty); `real_indices`/per-item symbol drive it.
- [ ] **Market status (D-037):** open/closed shown honestly from `market_status`.
- [ ] **Search (D-037):** symbol search returns served hits; a hit links to InstrumentDetail / adds to
      a watchlist (class-aware, D-097).
- [ ] **Watchlist management (D-052):** create/delete lists + add/remove items, all `require_auth`
      (`[S]`); honest empty state; no client fabrication.
- [ ] **Region-news dropped → News links (D-051):** no region-news blocks; region groups link to News.
- [ ] **R-17 ticker wiring (ND-5, REQUIRED):** the TickerStrip's index entries now **link to `/markets`**
      (holdings still → InstrumentDetail, D-098); the ticker §-entry (index-link) is **closed**.
- [ ] **Terms match GLOSSARY;** copy hygiene — no decision IDs / enum keys (`^GSPC`, `change_pct`) in
      any user string; `[Help]` on Gainers/Losers (with the which-list distinction), Index, ETF proxy.
- [ ] **No-egress honesty:** live quotes degrade to stale, never faked (Guarantee 5).
- [ ] **Both themes + both densities;** interactive OPEN states (region tabs, search, watchlist
      dialogs) verified in both themes.
- [ ] **Rendered layout + overflow:** verified at 320/375/900/1366 both themes, zero horizontal
      overflow — **extend the overflow suite** to `/markets`. Geometry fixes **fail-first** (§7/§8).

---

## 8. BUILD PHASES

*One commit per phase. Backend deltas FIRST. Nothing assembled against a non-existent endpoint.
**Do not start until §9 clears.***

- **Phase 0 — Contract deltas (only if §9 turns ND-1 toward a served Gainers/Losers list):**
  backend-first; regenerate contract same commit; drift green. *(Skip if ND-1 = display-sort.)*
- **Phase 0a — DESIGN-SYSTEM §5 amendment (only if ND-2 needs a Tabs affordance / ND-6 a status
  pill):** author PROPOSED, ratify at `/kitchen-sink` before assembly.
- **Phase 1 — Page assembly:** compose ratified components over the readers; progressive per-card
  loading; honest empty/error/stale states; instrument grid + Gainers/Losers + Global tab + market
  status + search + watchlist management + News links; **R-17 ticker wiring**.
- **Phase 2 — Tests:** component/render + acceptance (§7); **extend the overflow suite to `/markets`**;
  a **which-list copy test** (Gainers/Losers, never Contributors/Detractors); the **R-17 ticker-link**
  test; drift/typecheck/lint/build green.
- **Phase 3a — Scripted pre-pass (MUST be green before the walk):** drive the live page + real backend
  on seeded demo; assert populated grid/indices/gainers-losers/watchlists, the proxy badge, market
  status, search, the R-17 ticker link, 0 overflow, 0 console errors; fix everything it surfaces first.
- **Phase 3b — Owner acceptance walk (LIVE, judgment items only):** each finding → a numbered
  `page-markets.md §*` entry, fixed + re-verified live, geometry fixes **fail-first**. **Owner closes the page.**

---

## 9. NEEDS DECISION — RESOLVED (owner, 2026-07-12)

All 11 items resolved. Each matched an option laid out at draft; the ND-2 STOP-gate (below) was
**verified clear** before recording. The detailed option text is retained beneath the resolutions as
the considered-options record. **No §3b delta (ND-1 = display-sort) and no §5 amendment** (segmented
buttons + chip/TrendStat are ratified) — Phase 0 is skipped, Phase 0a is composition-only.

**Resolutions (owner, 2026-07-12):**
- **ND-1 (a) — display-sort, NO delta.** Gainers/Losers = a **display-sort of the served
  `change_pct`** over the **full served overview grid** (the universe). **Top/bottom N = 5**; the
  **losers list shows only entries where `change_pct < 0`** (never a "loser" that rose); **honest
  empty states** (a Portfolio ND-9 mirror). Framed as **ordering served values, not money math** — no
  computed ranking. Phase 0 skipped.
- **ND-2 — region tabs = the SERVED Global groups; grid has NO region filter.** The region tabs are
  the **served `/markets/global` groups rendered as tabs over the Global view** — **no client
  country→region mapping, ever** (D-005). The **instrument grid gets search + column sort, no region
  filter.** Control = the **ratified segmented-button pattern** (the PriceChart-periods precedent);
  **NO Tabs §5 amendment.** **STOP-gate verified clear:** `/markets/overview` takes no region param
  and does no backend region mapping of the grid (`markets.py:61`) — v1 never region-filtered the grid
  via backend mapping, so the conditional (a served-region delta as the only honest path) is **not
  triggered**.
- **ND-3 — Hybrid CONFIRMED.** Overview header (**market status + indices + Gainers/Losers**) over a
  **worklist body** (**instrument grid + watchlists**). Recorded as the **Markets-group shape**
  (Heatmap/News inherit it).
- **ND-4 — Watchlist UX as drafted.** Multi-list panel; **add** via the class-aware
  `InstrumentPicker`; **remove** via `RowMenu`; **create/delete** via `ConfirmDialog`; **all
  `[S]`-gated.** **Rename: DECLINED** — no endpoint, not a v1 capability. Recorded **declined, not
  deferred**.
- **ND-5 — R-17 target = `/markets` plain.** The Global tab lives on the page; **no deep-link
  anchor.** `fetchTickerQuotes` **sets index `href`s → `/markets`** (holdings still → InstrumentDetail,
  D-098); **CLOSE the ticker index-link §-entry in `page-chrome.md` this milestone.**
- **ND-6 — badge per Global-tab index item.** Protected copy matches the **Portfolio benchmark
  provenance style** ("— via SPY proxy"); **served/verbatim**, a proxy is **never shown as the index**.
- **ND-7 — visible-not-editable CONFIRMED** (D-072 posture). A user-configurable index universe is
  **NOT registered** — revisit only on demonstrated need.
- **ND-8 — CONFIRMED.** The quote-source select is **Home's** (D-046); Markets **renders its sections
  directly** (grid, Global, watchlists) — no source-select card.
- **ND-9 — Rotation-eligible: YES** (D-044 — a markets board is the archetypal wall page).
- **ND-10 — CONFIRMED no `entity_id`** (market data, not portfolio-scoped; readers take none, §10).
- **ND-11 — CONFIRMED.** Markets **links to `/heatmap`** (D-053), **never embeds** the treemap.
- **Market-status pill.** The **ratified chip/`TrendStat`** suffices — **no §5 amendment**.

**Confirms:** the **which-list rule** guarded (Gainers/Losers here, never Contributors/Detractors,
D-024 — a copy test in Phase 2); **served labels** throughout (D-005); watchlist mutations **`[S]`**;
**no-egress → honest stale** (Guarantee 5).

**Build sequence:** ND-1 = display-sort → **skip Phase 0**; **Phase 0a = composition-only confirm** (no
§5 amendment) → **Phase 1** assembly (incl. R-17 ticker wiring) → **Phase 2** (the **which-list copy
test** + the **R-17 ticker-link test**) → **Phase 3a** scripted pre-pass **GREEN before the walk**
(fail-first standard). STOP after the pre-pass report.

---

**Considered options (draft record — the resolutions above are authoritative).** Items flagged
**⚠ CONTRACT/SCOPE GAP** were the pre-resolution risk callouts.

- **ND-1 — Gainers/Losers source. ⚠ CONTRACT GAP.** **`/markets/overview` does NOT serve a
  Gainers/Losers list** — it serves the instrument grid (`instruments[].quote.change_pct`). Options:
  **(a)** derive the two lists by **display-sorting the served overview quotes** by `change_pct`
  (top/bottom N — a display sort of served values, no money math), **or (b)** a **backend delta**
  serving `gainers`/`losers`. Also the **universe** to rank (all overview instruments? held only? a
  fixed market set?). Owner picks the source + universe.
- **ND-2 — Region tabs. ⚠ possible §5 amendment.** `/markets/overview` has **no region param**;
  instruments carry `country`/`asset_class`; `/markets/global` groups by `region`
  (Americas/Europe/Asia-Pacific/Commodities/Crypto). Options: **(a)** client-side filter of the served
  grid by region (which region set — the Global regions, or the **D-083 six buckets** used elsewhere?),
  **(b)** a backend region param. And the **control**: a `Select` vs a **Tabs** affordance (a §5
  amendment if Tabs). Owner picks region model + control.
- **ND-3 — Template fit (owner-flagged).** Markets is an **overview + worklist hybrid** — a
  market-status/indices/Gainers-Losers header (overview-ish) over an instrument-grid + watchlists
  worklist body. Confirm the treatment (DESIGN-SYSTEM §3 does not assign Markets a single template);
  record the hybrid shape for the Markets group (Heatmap/News follow).
- **ND-4 — Watchlist management UX.** CRUD is served + `require_auth` (`[S]`), and **Markets owns it**
  (D-052 — settled, not reopened). Confirm the affordances: **multiple lists** (the GET returns many);
  a watchlists panel of `DataTable`s; **add** via the class-aware `InstrumentPicker`/search; **remove**
  via `RowMenu`; **create/delete list** via `ConfirmDialog` (`[S]`). Any list-rename? (no rename
  endpoint exists — confirm out-of-scope or a delta).
- **ND-5 — R-17 ticker wiring (REQUIRED in scope).** The `TickerStrip` index entries are **currently
  unlinked** (holdings → InstrumentDetail, indices unlinked, D-098). On Markets' ship they **link to
  `/markets`**. Confirm the **target** (`/markets`, or a Global-tab anchor/deep-link) and that the
  **ticker index-link §-entry is closed** this milestone (the ticker's `href` for index items is set;
  `fetchTickerQuotes` in `api/chrome.ts` currently sets no href on indices).
- **ND-6 — Real-vs-ETF-proxy badge (D-051, protected honesty).** Served by `real_indices` (global) +
  the per-item symbol (proxy vs `^index`). Confirm the **badge placement** (per Global-tab index) +
  the protected copy (a proxy is labelled, never shown as the index).
- **ND-7 — Index universe.** `_GLOBAL_MARKETS` is a **backend constant** (5 regions, ~14 indices), not
  a served master, **not user-editable**. Confirm it stays **visible-not-editable** (like routing under
  D-072); a user-configurable index set would be a ROADMAP item, not v2. Owner confirms.
- **ND-8 — Quote source select.** The **QuoteCardRow source select** (markets/holdings/global/watchlist)
  is a **Home** feature (D-046/D-047/D-052) — on **Markets** the sections render directly (grid, Global,
  watchlists), no source-select card. Confirm the source select is **not** a Markets affordance.
- **ND-9 — Rotation eligibility (D-044).** Confirm YES/NO for a live-data Markets page.
- **ND-10 — Entity scope (D-065).** Markets is market data (not portfolio-scoped) — confirm **no
  `entity_id`** here (the readers take none; verified §10).
- **ND-11 — Heatmap boundary (D-053).** The **Heatmap is its own page** (`/heatmap`, D-053) — confirm
  Markets **links** to it and does **not** embed the treemap.

**Lower-risk confirms (owner ratifies with the above):** served labels throughout (D-005); the
which-list rule (Gainers/Losers here, never Contributors/Detractors, D-024); watchlist mutations
`[S]`-gated; no-egress → honest stale.

---

## 10. VERIFY-FIRST FINDINGS (2026-07-12) — read before assuming shapes (D-019)

Ran the read-what-the-engine-serves pass before drafting §3/§4. **No shape was assumed; gaps went to
§9, not §3b.**

| Item | What the engine actually serves | Source |
|------|--------------------------------|--------|
| Markets overview | `{quotes, instruments:[{symbol,name,asset_class,currency,country,held,quote}], market_status, demo_mode}` — the instrument grid; **NO gainers/losers**; **no region param** | `markets.py:61` |
| Markets global | `{groups:[{region, items:[{symbol,label,quote}]}], market_status, demo_mode, real_indices}` — world indices by region; `real_indices` = real-vs-proxy (D-051) | `markets.py:141` |
| Index universe | **hardcoded** `_GLOBAL_MARKETS` (Americas/Europe/Asia-Pacific/Commodities/Crypto, ~14 entries), ETF-proxy ⇄ `^index`; **not a served master, not user-editable** | `markets.py:98` |
| Markets search | `{results:[…provider hits…]}` | `markets.py:166` |
| Watchlists | `GET {watchlists:[{id,name,items:[{symbol,name,quote}]}]}`; create/delete list + add/remove item all **`require_auth`**; **no rename endpoint** | `watchlists.py` |
| Gainers/Losers | **NOT served as a list** — must be a display-sort of the overview quotes or a backend delta (ND-1) | contract (absent) |
| Entity scope | markets readers take **no `entity_id`** (market data, not portfolio-scoped) | route signatures |
| Ticker index link | `fetchTickerQuotes` sets `href` on **holdings only** (→ InstrumentDetail); **indices unlinked** — R-17 wires them → `/markets` (ND-5) | `api/chrome.ts` |

**Owner sign-off surface (all in §9):** ND-1 (Gainers/Losers source — the one potential §3b delta),
ND-2 (region model + Tabs), ND-3 (template fit), ND-5 (R-17 ticker wiring — required), plus the
confirms (ND-4/6/7/8/9/10/11). **No further build until the owner resolves §9.**

---

## 11. BUILD RECORD — Phases 1/2/3a DONE; Phase 3b (owner walk) PENDING (2026-07-12)

§9 resolved (owner, 2026-07-12) → **Phase 0 skipped** (ND-1 = display-sort, no §3b delta) →
**Phase 0a composition-only** (no §5 amendment: segmented buttons + chip status pill are ratified).

- **Phase 1 (`bb…`/assembly).** `frontend/src/routes/Markets.tsx` (+`.css`) + `api/markets.ts`, routed
  at `/markets` (`AppRoutes.tsx`, nav `built:true`). Overview+worklist hybrid (ND-3): market-status
  pill · Global tab (served groups as segmented region tabs, per-index ETF-proxy badge, honest
  real/proxy note) · Gainers/Losers (display-sort of served `change_pct`, top/bottom N=5, losers only
  <0, honest empty) · instrument grid (search + column sort, Held badge, staleness; no region filter)
  · watchlists (multi-list, add via `InstrumentPicker`, remove via `RowMenu`, create via
  `Dialog`+`TextInput`, delete via `ConfirmDialog`, all `[S]`) · Heatmap/News signposts.
  **R-17 wired:** `fetchTickerQuotes` sets index `href` → `/markets` (holdings still → InstrumentDetail).
- **Phase 2 (tests).** `Markets.test.tsx` (9) incl. the **which-list copy test** (never
  Contributors/Detractors) + proxy-badge + display-sort + watchlist CRUD; `api/chrome.test.ts` (2) the
  **R-17 ticker-link test**; overflow suite extended to `/markets`. **137 unit + 65 Playwright green.**
- **Phase 3a (pre-pass, GREEN first run).** `e2e/smoke/markets-smoke.spec.ts` on live app + real
  backend: 5 region tabs · Gainers/Losers 10 rows · grid 20 rows (search→1) · proxy badge shown /
  absent on commodities · watchlist create/delete round-trip · **R-17 ticker links present (30)** · 0
  overflow at 320/375/900/1366 × both themes · **0 console errors.**

**Build-time reconciliations (small judgment calls, faithful to §9 — flag at the walk if any is off):**
1. **`[Help]` scope.** Only **Gainers / Losers** is a GLOSSARY term, so it gets the `GlossaryTerm`
   popover (which-list distinction). **Index / ETF proxy / Market status are NOT glossary terms** —
   ND-6 makes the proxy honesty **served copy** ("— via SPY proxy"), and Index/Market status are
   served display labels. No new glossary terms invented (CLAUDE.md hard rule). The drafted §7 line
   naming Index/ETF-proxy `[Help]` is superseded by this — served copy, not popovers.
2. **Gainers honesty.** ND-1 constrained losers to `<0`; for symmetry the **gainers list is filtered
   to `>0`** (a decliner can't be a "Gainer") — a flat symbol appears in neither. Honest reading; relax
   at the walk if the owner wants pure top-N.
3. **Create-list control.** `ConfirmDialog` can't collect a name, so **create uses `Dialog`+`TextInput`**
   (the same primitive `ConfirmDialog` wraps); **delete uses `ConfirmDialog`** (destructive). Both
   `[S]` server-side. Composition of ratified parts — no new component.
4. **Ticker index-link §-entry (page-chrome).** R-17 is wired here; the page-chrome close-out note
   still needs its one-line **CLOSE** (ND-5) — do at the walk/close.
5. **`/markets/search` reader** left unwired — symbol discovery is the class-aware `InstrumentPicker`
   (`/instruments/search`); the grid "search" is a client filter of served rows (ND-2). No unused
   reader added.

**STOP after the pre-pass (owner directive).** Phase 3b = the owner acceptance walk (live, judgment
items) → numbered `§*` findings, each fixed + re-verified, geometry fixes fail-first; owner closes the
page.

---

## 12. PHASE-3B ACCEPTANCE WALK — batch 1 (owner, 2026-07-12)

**Reconciliation calls (from the §11 flags) — owner rulings:**
- **§11-1 RATIFIED.** `[Help]` scope stands: only **Gainers / Losers** carries a `GlossaryTerm`;
  ETF-proxy honesty is served copy (needs no glossary anchor); Index / Market status are served
  labels. No invented terms.
- **§11-2 RATIFIED.** Gainers filtered **> 0** (symmetry is the honest read) — on an all-red day the
  Gainers list is **empty with a reason** ("Nothing gained today."), Losers likewise on an all-green day.
- **§11-3 CONFIRMED — composes ratified primitives only, nothing new this build.** The new-watchlist
  create uses **`Dialog`** (§5.4 amendment, ratified at the Holdings build) + **`TextInput`** (§5.1,
  authored + ratified at the Holdings build — *not* new here). No retroactive §5.5 amendment / no
  kitchen-sink specimen needed.
- **§11-5 REOPENED → WIRED.** Report first: the watchlist **`InstrumentPicker` calls
  `/instruments/search`** (the class-aware endpoint), **NOT `/markets/search`** — so `/markets/search`
  was genuinely unwired, not redundant (both ultimately hit `get_provider().search_instruments`, but
  the endpoint had no caller). Fix: wired a **page-level "Find a symbol" search to the served
  `/markets/search`** (a hit → InstrumentDetail); the **grid filter stays client-side** for in-grid
  narrowing. `§12mk1-5`.

**Batch fixes:**
- **§12mk1-1 — BUG: two vertical scrollbars (structural, fail-first).** Repro (live diag): at tall
  viewports (h ≥ ~950) `/markets` scrolled the **whole document** (`window.scrollY` reached 712) beside
  the `.lf-shell__content` scroller — a Chromium overflow-**propagation** quirk where a tall descendant
  inflates `documentElement.scrollHeight` even though `.lf-shell` is `100vh/overflow:hidden` and `body`
  never overflows. Not reproducible on the other pages' content, but a latent shell gap. **Structural
  fix on the shell:** `min-height: 0` on the flex column (`.lf-shell__main`/`__content`) + **`contain:
  layout` on `.lf-shell__content`** (a containment boundary that stops the propagation — the guarantee
  the shell content is the ONE vertical scroller). Markets tables also **flow** (`.mk .lf-table__scroll
  { max-height: none }`) so a capped grid doesn't open a *nested* second scrollbar either. **Invariant +
  permanent ALL-PAGES assertion** (was a gap in the horizontal-only suite): every route × width, force
  the content tall with a spacer, then assert the **window cannot scroll** — only `.lf-shell__content`
  does. Proven fail-first: `winScrolled` = **0 with the fix vs 548 with containment removed**.
- **§12mk1-2 — REPEAT MISS: default-styled links (Portfolio §12b3-3 recurred).** The earlier fix was
  **per-instance**; this is the **centralization** the retrospective demanded. The shared table rule
  is broadened `.lf-table__td a` → **`.lf-table a`** so *any* anchor in *any* table gets the ratified
  accent/no-underline treatment (tables cannot opt out). The Gainers/Losers are **lists, not tables**,
  so they can't inherit it — fixed per-page (`.mk__movesym a`, mirroring Portfolio's `.pf__moversym a`)
  along with the new search-result links. **Assertion** (live pre-pass): **0** underlined anchors inside
  `.lf-table` or the Gainers/Losers lists.
- **§12mk1-3 — VERIFY ONLY (no build): price-history data cost.** Endpoint **`GET
  /instruments/{symbol}/history?interval=1d&days=N`** → `{symbol, interval, candles:[{ts,open,high,low,
  close,volume}]}`. **Per-symbol only — NO batch endpoint.** Resolves for **every** symbol tried: `SPY`
  (ETF proxy) 180, `^GSPC` (real index) 181, `BTC` 180, `AAPL` 180 — so **index proxies AND watchlist
  symbols resolve**. Payload ≈ **~140 B/candle → ~25 KB at 180 daily candles, ~4 KB at 30d.** Cost for
  Global-tab index sparklines (~14 indices): **~14 requests (no batch) × ~4 KB @30d ≈ 56 KB** (or ~350 KB
  @180d). `Sparkline` is ratified (takes `number[]` closes). **Scoped decision for the owner (not this
  batch):** (a) **Global-tab index sparklines** (14 progressive per-card fetches, ~56 KB @30d), (b)
  **click-through-only** (InstrumentDetail already has the full house-SVG `PriceChart`), or (c) **ROADMAP
  a batch history endpoint** if sparklines are wanted broadly (grid + watchlists too). Recommend (a) at a
  short window if the owner wants movement-over-time on the board; otherwise (b).

**Still open (not in batch 1):** the page-chrome **ticker index-link §-entry CLOSE** (ND-5) — R-17 is
wired + tested here; the one-line close in `page-chrome.md` remains for a later batch/close-out.

**Batch-1 verification:** frontend **138 unit + 93 Playwright overflow** green (the +28 single-scroll
guards included); **live pre-pass green** with the new single-scroll / link / page-search assertions;
**0 console errors**; typecheck/lint/tokens/build green.

### Batch 2 (owner, 2026-07-12)

- **§12mk2-1 — Global-tab 30-day sparklines (scoped option (a), APPROVED).** Each **Global-tab index
  row** renders a **30d `Sparkline`** via the existing `getInstrumentHistory(symbol, 30)` (reused; no
  new reader). **Progressive per-row load:** a motion-safe placeholder → the spark. **Honest absent
  state:** a fetch failure / <2 closes renders "**—**" (`.mk__spark--na`), **never a fabricated flat
  line**. The ratified `Sparkline` is a static SVG (no animation); only the **loading placeholder**
  pulses, and it collapses under reduced motion (both the OS `prefers-reduced-motion` and the in-app
  `data-motion="reduced"` toggle). **Fixed footprint** so loading/spark/absent never shift the row
  (overflow-safe). The spark's tone = its own net direction (chart geometry / visualization, not a
  reported figure — the PriceChart precedent). **Global tab ONLY** — grid + watchlist rows carry **no**
  spark. Scoped **(b)** (grid/watchlist sparks) and **(c)** (a batch history endpoint) **DECLINED**;
  **(c) recorded NOT-REGISTERED** (per-symbol `GET /instruments/{symbol}/history` only) — revisit on
  demonstrated need. **Assertions:** unit (an SVG spark renders in the Global tab) + pre-pass **PART
  1b** (sparks render for available symbols; **0 stuck** in the loading placeholder) + the existing
  0-overflow sweep still green.
- **§11-3 / §11-5 — ACCEPTED (owner).** Dialog+TextInput compose ratified primitives (no amendment);
  the page-level `/markets/search` wiring stands.

**Batch-2 verification:** frontend **139 unit + 93 Playwright overflow** green; **live pre-pass green**
(**PART 1b: 3 sparks rendered, 0 stuck**; 0 overflow at 320/375/900/1366 × both themes); **0 console
errors**; typecheck/lint/tokens/build green.

**Owner's upcoming walk covers:** ticker index-click (→ then CLOSE the page-chrome ND-5 §-entry),
watchlist CRUD loop, proxy-badge cold read, page search for an off-grid symbol, and the new
sparklines. **STOP after checks + pre-pass green (owner).**

### Batch 3 (owner, 2026-07-12)

- **§12mk3-1 — "Find a symbol" → PageHeader (PROPOSED, ratify at re-verify).** The standalone search
  card is removed; the compact search input now sits in the **PageHeader `actions`, beside the
  new-watchlist `+`**. Results render in a **dropdown anchored to the input** (dismiss on outside
  click, result click, or clearing). **320px behavior (explicit, simplest ratified-compatible):** the
  header's existing `flex-wrap` drops the action group (search + `+`) to **its own row under the
  title**; the search is bounded (`width: 12rem; max-width: 100%`) so it never overflows — no
  icon-collapse interaction needed. Overflow suite **green at 320/375/900/1366** (+ the header input
  present at every width). A hit → InstrumentDetail; the grid keeps its own client-side filter.
- **§12mk3-2 — Quote display precision (D-105, recorded in DECISIONS).** Formatted **in the backend**
  (`format_price_display`, `app/core/money.py`) and served as `price_display` on the `Quote` schema +
  `HoldingView`; the frontend renders it **verbatim** (removed `formatPrice` from every quote surface:
  TickerStrip, Markets movers/grid/watchlists/Global tab, InstrumentDetail quote). **Policy:**
  equities/ETFs/funds/indices → **2dp**; crypto → **6 significant digits**; grouped; stored precision
  unchanged. `None` price → "—" (never a fabricated 0). Verified live: SPY/AAPL `189.53`/`580.03` (2dp),
  **BTC `65,758.5` / ETH (6-sig)**, GLD unavailable → "—". **Contract:** `HoldingView.price_display`
  added (`/portfolio/holdings` is a typed response_model — the field must be declared or it's stripped;
  found + fixed); API-CONTRACT regenerated same commit (no path change). **Spot-checks:**
  Portfolio/Net-worth/Pricing-Health pre-passes green — portfolio **VALUES keep 2dp** money formatting
  (unaffected; this touches quote prices only). Backend formatter unit test added.
- **§12mk3-3 — Ticker index-click → CLOSED the page-chrome §11-19 interim.** Owner verified the
  index-click lands on `/markets` live; `page-chrome.md §11-19` now carries a one-line **CLOSED** entry
  referencing **R-17 shipped** (the interim "indices unlinked" path is retired).

**Batch-3 verification:** **backend 493 tests** (+1 D-105 formatter) · ruff · contract drift clean;
**frontend 140 unit + 93 Playwright overflow** · typecheck/lint/tokens/build green; **live pre-passes
green** — Markets + Portfolio + Net-worth + Pricing-Health, **0 console errors**; D-105 precision
verified live. **STOP for owner re-verify** (which ratifies the PROPOSED PageHeader search look).

### Batch 4 (owner, 2026-07-13)

**RATIFIED from batch 3 (owner, live):** the **PageHeader "Find a symbol"** placement + its 320px
flex-wrap behavior (§12mk3-1), and **D-105** quote precision verified across ticker / grid /
watchlists / Global (2dp + BTC 6-sig + honest "—" on unavailable).

- **§12mk4-1 — BUG: Global-tab index rows misalign below the laptop breakpoint.** Long labels
  ("US · Nasdaq 100 — via QQQ proxy") could force the price under the label and displace the sparkline.
  **Root cause:** the row used `flex-wrap: wrap` + `justify-content: space-between`, which renders the
  number group **inline** (beside the label) when it fits and **wrapped** (below) when it doesn't — so
  rows with different label lengths render inconsistently. (Headless showed a *clean* transition at
  ~640px — ≤~600 all-below, ≥640 all-inline — but a real phone's wider font metrics tip a width into a
  **mixed** inline/wrapped state, which is the misalignment the owner saw.) **Fix (§12mk4-1):** an
  **explicit two-line layout for EVERY row ≤900px** — line 1 = label + proxy, line 2 = spark + price +
  change — *consistent for all rows, not just overflowing ones*. The number line is **right-anchored**
  (`.mk__idxprice { margin-left: auto }`), so price/change align across rows at any width and the
  fixed-width spark sits left, never displaced. **Fail-first:** at 880px the old row/wrap layout
  renders the numbers **inline** (`allStacked=false`) — the assertion catches it; the fix stacks every
  row (`true`). **Permanent assertion (pre-pass PART 1c):** 320/375/880 × **both themes**, on
  **Asia-Pacific** (the most varied labels — the stress case): every row is 2-line stacked, **no
  spark/price overlap**, and **price/change right-aligned across rows** (right-edge spread ≤ 2px).

**Batch-4 verification:** **frontend 140 unit + 93 Playwright overflow** · typecheck/lint/tokens/build
green; **live pre-pass green** — Markets PART 1c (align) at 320/375/880 × both themes, **0 console
errors**. CSS-only fix (no contract/backend change). **STOP for owner phone re-verify.**

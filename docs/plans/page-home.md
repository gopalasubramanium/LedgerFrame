# page-home.md — Home page build plan

**Status: PLAN ONLY — §9 OPEN (drafted 2026-07-13). No page code. Do not build.**
Drafted from `TEMPLATE-page-build.md`. **Verify-first (§10) was done BEFORE §1–§8** (D-019 — read what
the engine actually serves *and audit its honesty guards*, not just its shapes). **Every gap is in §9; I
resolved none.**

Home is the **Overview-group** landing page at `/` (IA §2/§3) on the **Overview template**
(DESIGN-SYSTEM §3). It is the purest expression of P-1: it **owns nothing at all** — every figure on it is
a **linked summary** of the page that owns it (D-038). It is a *composition*, not a viewer.

> **⚠ FOUR things dominate this plan (read first).**
>
> **(1) A legacy `/dashboard/home` aggregate EXISTS in the frozen contract — and it is NOT D-046.**
> It serves a v1 shape (hardcoded `SPY/QQQ/GLD/BTC` markets, portfolio totals, portfolio movers, FX,
> market status, briefing) with **no** allocation, **no** sparkline, **no** ReviewCard, **no** headlines,
> **no** source select and **no** layout concept (§10-2). Whether Home **retires** it (composing from the
> canonical readers, one card per reader, progressively loaded) or **reshapes** it (one call) is an
> architectural question with real costs on both sides — **§9-4, owner's call.** I did not presume.
>
> **(2) The layout setting does not exist anywhere.** `GET`/`PUT /settings` exist and are *generic*, but
> the allow-list has **no `home_layout` key** (§10-3) — so there is **no store, no default and no served
> value** for Simple/Full. This is a **§3b delta** (an allow-list addition + a default), **not** a new
> endpoint. **§9-3.**
>
> **(3) The control's LABEL is genuinely unsettled — GLOSSARY does not arbitrate it.** GLOSSARY carries
> **both** "Detail level: Simple/**Expert**" (:226) **and** "Home layout: Simple / **Full**" (:227), each
> claiming to be *the* control for Home; the **code invents a third** ("Detail: Simple/Full",
> `TopBar.tsx:90`). The hard rule ("every term shown to users exists in GLOSSARY with that exact
> spelling") cannot be satisfied while two spellings both exist. **§9-1 — this blocks §5 and §7 copy.**
>
> **(4) The ticker is NOT Home's.** The **D-047 AMENDMENT is RATIFIED** (2026-07-11): TickerStrip is
> **global chrome footer on every page** — so **Home renders no ticker of its own**. Three specs still
> carry the superseded "ticker in Full" framing (§10-12); they are listed for correction at close, per
> convention. **Home Full must not duplicate it.**

---

## 1. IDENTITY

*Source: INFORMATION-ARCHITECTURE.md §2 (page map), §3 (nav + rotation), §4 (Home composition);
DESIGN-SYSTEM.md §3.*

| Field | Value | Spec ref |
|-------|-------|----------|
| Page name (H1 = nav label = route) | **Home** | IA §2, D-022 |
| Route | **`/`** | IA §2; `nav.ts:24` already declares it (**no `built` flag** — §10-1) |
| Nav group | **Overview** (Home is its only member) | IA §3 (`nav.ts:24`) |
| Page template | **Overview** (composed dashboard of stat tiles, charts and summary widgets — *"owned elsewhere"*) | DESIGN-SYSTEM §3 (:227) |
| Rotation eligibility | **YES** — any nav page is eligible (D-044); **rotating to Home uses the configured Home layout — one setting, no special case** (D-040, IA §3). Rotation **skips empty/errored** pages. ⚠ *Rotation is currently a UI-only toggle with no implementation — §10-6, §9-14.* | IA §3; DECISIONS D-040/D-044 |
| One-line purpose | **Home** — the landing view: a fixed set of **linked summaries** of the pages that own them (net worth + Today's change, performance, allocation, both movers pairs, review, briefing + headlines, quotes). It computes nothing, owns nothing, and adds no figure its canonical page does not show. | IA §4 |

---

## 2. OWNERSHIP TABLE

*Copied from INFORMATION-ARCHITECTURE.md §4/§5. Never re-derived.*

**Owns (canonical, authoritative, fully explained here):**
- **NOTHING. Not one figure.** IA §4 is explicit: *"Home owns nothing; every widget is a summary produced
  by the canonical page's reader, linked to that page (P-1)."* Home is the **only** page in the IA whose
  ownership column is empty by design — it is a composition of other pages' canonical output.

**Summarises (other pages' info — via the named canonical reader, never recomputed):**

| Summary widget shown | Canonical page (owns the figure) | Shared reader reused | Link target |
|----------------------|----------------------------------|----------------------|-------------|
| **Net worth + Today's change** lines | **Net worth** (headline) / Portfolio | `/portfolio/summary` (`total_value`, `day_change`, `has_stale`, `stale_count`, `base_currency`) | `/net-worth` |
| **Performance sparkline** | **Portfolio** (D-035) | `/portfolio/performance` (`series[{ts,value}]`) | `/portfolio` |
| **One allocation donut** | **Portfolio** (D-033) | `/portfolio/summary` (`allocation_by_*` — **which dimension: §9-5**) | `/portfolio` |
| **Contributors / Detractors** summary | **Portfolio** (D-034 — *contribution-weighted* pair) | `/portfolio/summary` (`top_gainers` / `top_losers`) | `/portfolio` |
| **Gainers / Losers** summary | **Markets** (D-034 — *price-move* pair) | `/markets/overview` (a **display sort** of served `change_pct` — §10-7e) | `/markets` |
| **ReviewCard** | **Review** (D-038) | `/portfolio/review` (`review_report`) — **the same reader Net worth's ReviewCard uses** | `/review` |
| **Briefing summary + top headlines** | **News** (D-037) | `/briefing` (`text`) + `/news/grouped` (`groups`, `no_egress`) | `/news` |
| **Compact quote cards** (one row, source select) | **Markets** (D-037/D-052) | per source: `/markets/overview` · `/portfolio/holdings` · `/markets/global` · `/watchlists` | `/markets` |

**Links to:** every widget deep-links to the page that owns its figure (the table above). There is no
widget without a link — a summary with no route to its canon is a dead end.

**Enforcement corollary (P-1/D-038, IA §4 verbatim):** *"A summary widget may not add figures its
canonical page does not show."* Home therefore shows **no figure that is not already on its canonical
page**, and **performs no money math** — every value is a served figure rendered as served (D-105 posture);
the only client-side derivations permitted are **display classifications** (sign → gain/loss tone) and a
**display sort** (Gainers/Losers, §10-7e), exactly as the canonical pages already do.

**One-fetch-site rule (the ReviewCard / staleness pattern).** Where a chrome summary and a page summary
show the same count, they must read **one** query, not two:
- **Attention count** — Home's ReviewCard reads **`/portfolio/review`**, the same reader Net worth's
  ReviewCard uses (`NetWorth.tsx:100/310`), and the Review page reads `/review`. Both are served by the
  **same** `app/services/review.py`, so **the count reconciles with `/review` by construction**
  (page-review ND-3) — Home adds **no third fetch site** and **no recount**.
- **Stale count** — owned by the **global chrome** `StaleBanner` via the ONE shared stale query
  (`AppShell.tsx:156`, page-pricing-health §12ph1-1). **Home must not fetch or render a second stale
  count.**

---

## 3. API SURFACE

*Source: API-CONTRACT.json (frozen). Verified shapes in §10.*

### 3a. Endpoints consumed (already in the frozen contract)

| Method + path | Purpose on this page | Response fields the page shows (verified §10) |
|---------------|----------------------|-----------------------------------------------|
| `GET /portfolio/summary` | headline lines · the donut · Contributors/Detractors | `base_currency`, `total_value`, `day_change`, `has_stale`, `stale_count`, `allocation_by_class` / `allocation_by_sector` / `allocation_by_currency`, `top_gainers[]`, `top_losers[]` |
| `GET /portfolio/performance?days&benchmark&include_manual` | performance sparkline | `series: [{ts, value}]` (raw values, **not pre-indexed**), `benchmark: [{ts,value}]`, `stats` |
| `GET /portfolio/review` | ReviewCard (verdict sections + attention count) | `sections`/verdicts, `count` |
| `GET /briefing` | briefing summary | `text` (a **served display string** — deterministic, rendered verbatim), `generated_at` |
| `GET /news/grouped` | top headlines | `groups[{name, items[]}]`, `total`, **`no_egress`** |
| `GET /markets/overview` | quote cards (source = *Markets*) **and** the Gainers/Losers display sort | `instruments[]` (incl. `change_pct`), `quotes[]`, `market_status`, `demo_mode` |
| `GET /markets/global` | quote cards (source = *Global*) | `groups[]` (world indices) |
| `GET /portfolio/holdings` | quote cards (source = *Holdings*) | `HoldingView[]` |
| `GET /watchlists` | quote cards (source = *Watchlist*) | `watchlists[]` — ⚠ **serves the LISTS; whether it serves QUOTES is unconfirmed — §9-7** |
| `GET`/`PUT /settings` | the Home-layout setting (**once the key exists** — §3b) | `stored{}` / `defaults{}`; PUT `values{}` |

**No new endpoint is required for any D-046 widget.** Every figure Home shows is already served.

### 3b. Contract deltas (needed but not in the baseline — BUILD BACKEND-FIRST, only if §9 approves)

| kind | Endpoint / field (current → intended) | Gated on | Why this page needs it |
|------|---------------------------------------|----------|------------------------|
| **allow-list + default** | `GET/PUT /settings` — add **`home_layout`** to `_ALLOWED_KEYS` (`settings.py:23`) and a **default** to `defaults{}` | **§9-3** (and §9-1 for the value spelling) | The layout has **no store and no default** today (§10-3). The endpoints already exist and take a free-form `stored`/`values` dict, so this is an **allow-list + default** change, **not** a new endpoint. **Server-persisted is required** (D-078: Home layout is explicitly listed as a settings row, *"it defines what rotation shows"*, and must survive a browser wipe). |
| **retire or reshape** | `GET /dashboard/home` — legacy v1 aggregate → **retire** (Home composes from the canonical readers) **or** **reshape** to the D-046 set | **§9-4** | It exists in the frozen contract and API-CONTRACT.md:82 already flags it *"reshape — D-046"*, but its current shape is **not** D-046 (§10-2). Either path is a contract change; **the owner picks**. *(Costs are laid out in §9-4 — I did not choose.)* |
| **served value** | quote-card **source persistence** — a settings key (e.g. per-source choice) **if** the choice is to survive a reload | **§9-7** | There is **no store** for the source select today, server-side or per-device (§10-7h). D-078's posture is server-persisted for kiosk survival; a per-device choice would be the exception and needs saying so. |

*Any §3b item that ships regenerates `API-CONTRACT.json` + `docs/openapi.json` **in the same commit**,
with a **served-value test** (TEMPLATE §3b: a value/field that is not shape-pinned drifts silently — an
allow-list key is exactly such a value, since `stored` is a free dict and the shape will not catch it).*

---

## 4. COMPONENTS

*Ratified components only (DESIGN-SYSTEM §5). **New components are forbidden** — any gap is a §5
amendment listed below, never an improvisation.*

| Widget | Ratified component | Reader | Status / gap |
|--------|--------------------|--------|--------------|
| Net worth + Today's change lines | **TrendStat** (`label`, `value`, `delta`, `unit`, `sparkline?`) — DESIGN-SYSTEM :310 | `/portfolio/summary` | ✅ ratified |
| Performance sparkline | **Sparkline** (chart layer, §4/:252) | `/portfolio/performance` | ✅ ratified. *Which series/window/benchmark → §9-8* |
| One allocation donut | **AllocationDonut** (`segments`, `legend`, `onSegmentClick?`) — :312 | `/portfolio/summary` | ✅ ratified. *Which dimension → §9-5* |
| Contributors / Detractors | **DataTable** or stat rows (as Portfolio renders them) | `/portfolio/summary` | ✅ ratified |
| Gainers / Losers | same | `/markets/overview` + display sort | ✅ ratified. ⚠ **2nd occurrence of the Markets sort** — see the centralization note below |
| ReviewCard | **ReviewCard** (`sections`, `attention`, `link`) — :351 | `/portfolio/review` | ✅ ratified — *"Summary-with-link on **Home**/Net worth"*: the component was built **for this page** |
| Briefing summary | *(none — News renders it as a plain card body, `News.tsx:84`)* | `/briefing` | ⚠ **no ratified component.** Home would be the **2nd** occurrence → per the centralization rule (extract at the **3rd**) it may be **page-local**; an owner who wants it shared needs a **§5 amendment**. **§9-16.** |
| Top headlines | **NewsList** (EXTRACTED + RATIFIED 2026-07-13) — :334 | `/news/grouped` | ✅ ratified. *How many / which groups → §9-9* |
| Compact quote cards + source select | **QuoteCardRow** (`quotes`, `source`) — :331; the select is a **view-scope `Select`** (:303) | per source (§3a) | ✅ ratified — built **for Home** (D-046). *Sources served + default + persistence → §9-7* |
| Ticker strip | **TickerStrip** — **GLOBAL CHROME FOOTER** (D-047 AMENDMENT, ratified 2026-07-11) | *(chrome)* | ✅ **NOT Home's.** Home renders **no ticker** (§10-12) |
| First-run checklist | **FirstRunChecklist** — **GLOBAL CHROME OVERLAY** (`AppShell.tsx:70`) | *(chrome)* | ✅ **NOT Home's.** Home needs **no** first-run affordance (§10-9) |
| Stale / no-egress / demo honesty | **StaleBanner**, **DemoBadge**, no-egress state — **GLOBAL CHROME** | *(chrome)* | ✅ **NOT Home's.** Home must not re-render a second stale count (§2) |
| Every empty region | **EmptyState** (`message`, `reason`, `action?`) — :350 | — | ✅ ratified. *Per-widget copy → §9-11* |
| Progressive load | **Skeleton** per card | — | ✅ ratified |

**Centralization note (the house rule: extract at the 3rd recurrence).** Two display derivations recur:
- the **Gainers/Losers display sort** of served `change_pct` (Markets `N=5`, `Markets.tsx:180`) — Home is
  the **2nd** occurrence → keep it **page-local** for now, and record that a 3rd occurrence forces
  extraction. *(This is display logic, not a second reader and not money math — §10-7e.)*
- the **briefing card body** (News is the 1st) — same rule, §9-16.

**No component is mock-backed on this page** — every widget above has a real reader in §3a
(TEMPLATE §9 "mock-backed affordance" check: **clean**).

---

## 4b. PER-VARIANT FIELD & ACTION SPECS

Home has **two variants** — the layout setting (D-046). *(Both the control's label and its two value
names are **§9-1**; below I use D-046's own words, **which is not a resolution.**)*

| Variant | Composition (D-046, verbatim) |
|---------|-------------------------------|
| **Simple** | **headline + ReviewCard + briefing only** — nothing else. |
| **Full** | the fixed set: **net worth + Today's change lines · performance sparkline · one allocation donut · both movers summaries · ReviewCard · briefing summary + top headlines · compact quote cards (one row, source select)**. |

- **Widget ORDER in Full** is not specified by D-046 (it gives a *list*, not a layout) → **§9-10**
  (I propose D-046's listing order for the owner to confirm; I did not adopt it).
- **Dropped from Home (D-046) — must NOT appear:** the **top-holdings widget**; the **three separate
  market rows** (world indices / your markets / watchlist+FX) — replaced by the single quote-card row.
- **R-19 (customisable Home — movable/resizable widgets, user-selected set) is PARKED.** The v2 widget
  set is **FIXED**. No drag, no resize, no add/remove, no per-widget hide.
- **Both layouts obey** single-scroll (D-100/D-101) and **progressive per-card loading** — readers fire
  **independently**, never behind one `Promise.all` gate (a slow reader skeletons **its own card only**).
  *(This is also the strongest engineering argument in §9-4 — an aggregate endpoint is a single gate.)*

---

## 5. VOCABULARIES

| Field | Vocabulary source | Status |
|-------|-------------------|--------|
| **Layout values** (Simple / Full **or** Simple / Expert) | GLOSSARY :226 **and** :227 — **two competing entries** | ⚠ **UNSETTLED — §9-1.** Not free text either way; the owner picks the ratified pair and the loser is **retired** into the Deprecated-terms table. |
| **Quote-card source** (`markets` / `holdings` / `global` / `watchlist`) | **view-scope**, not a master vocabulary — DESIGN-SYSTEM :303 explicitly ratifies the QuoteCardRow source as a generic `Select` for *"non-master view-scope"* choices | ✅ **D-005 satisfied** (a MASTER-DATA vocab is **not** required). *Which sources are actually served + the default → §9-7.* |
| **Asset-class labels** (donut legend, if by class) | `/refdata` (D-005 — the frontend carries **zero** vocabulary copies) | ✅ served |
| **Every user-facing term** | GLOSSARY, exact spelling | ✅ for: **Net worth**, **Today's change**, **Gainers / Losers**, **Contributors / Detractors**, **Briefing**, **Headlines**, **Review**. ⚠ **"Home" itself has no GLOSSARY entry** (only *"Home layout"*) → **§9-13** (Heatmap ND-11 precedent). |

**Retired terms that must not appear** (GLOSSARY Deprecated): *"day change"* (→ **Today's change**, D-025);
*"Review Centre"*, *"Needs a look"*, *"What needs attention"* (→ **Review**, D-030). The two movers pairs
are **never interchanged** (D-024): price-move = **Gainers/Losers** (Markets); contribution-weighted =
**Contributors/Detractors** (Portfolio).

---

## 6. DECISIONS IN FORCE

| ID | What it binds on this page |
|----|----------------------------|
| **D-046** | Home = a **fixed** linked-summary set; Simple/Full layouts; **drops** the top-holdings widget + the 3 market rows. |
| **D-047 AMENDMENT** *(RATIFIED 2026-07-11)* | **Supersedes** D-047's *"Home Full layout only"*: TickerStrip is **global chrome footer on every page and width**. **Home renders NO ticker of its own** — *"Home Full no longer duplicates it"* (DECISIONS :697–706). |
| **D-040** | Detail level is **scoped to Home** — *"Settings control; global top-bar toggle removed"*; **rotating to Home uses the configured layout — one setting, no special case."** ⚠ *The code still has a top-bar toggle — §10-5.* |
| **D-030** | One label for the control **wherever it appears** — which is precisely why two GLOSSARY spellings cannot both stand (**§9-1**). |
| **D-038 / P-1** | One canonical page per figure; a summary **reuses the canonical reader**, never a second code path, and **adds no figure the canonical page lacks**. |
| **D-044** | Home is rotation-eligible; rotation **skips empty/errored** pages; **no Home-local rotation logic** (the store is server-persisted settings). |
| **D-052** | Watchlists are **managed on Markets only**; **Home shows watchlist quotes via the source select** — read-only here. |
| **D-005** | Served vocabularies; the frontend carries **zero** vocab copies. |
| **D-065 / P-7** | **Household scope** — `/portfolio/*` accept `entity_id` but Home is **household-only, no selector** (the Portfolio ND-8 posture). |
| **D-100 / D-101** | Layered cards; **one scroll region**; scroll = content only. |
| **D-105** | Money/percent arrive as **served display strings** where the reader provides them — rendered **verbatim**; the frontend formats nothing it can be served. |
| **Guarantee 3** | Never fabricate a figure: every empty shows a **reason**; a missing value is an **em dash + why**. |
| **Guarantee 5** | **No-egress**: zero outbound calls; the news/quote widgets show an **honest empty with the reason**, never stale-as-fresh and never invented. |
| **R-19** | **PARKED** — customisable Home is *not* v2. The widget set is **FIXED** (amends D-046 only if ever unparked). |

---

## 7. ACCEPTANCE CRITERIA

*Every criterion is checkable. "Looks right" is not a criterion.*

**Ownership / honesty**
- [ ] **Home shows no figure its canonical page does not show** (P-1 enforcement corollary) — for each
      widget, the shown figures are a **subset** of the canonical page's, spot-checked against it.
- [ ] **Reconciliation, by construction:** Home's ReviewCard attention count **equals** `/review`'s count
      **and** Net worth's ReviewCard count — demonstrated **live** in the pre-pass (page-review ND-3).
- [ ] **No second stale count:** the only stale surface on `/` is the **chrome** StaleBanner.
- [ ] **No money math on the client** — grep: no arithmetic on served figures; the only derivations are
      the sign→tone classification and the Gainers/Losers **display sort**.
- [ ] **Every widget deep-links** to its canonical page (no dead summary).
- [ ] **Guarantee 3:** every empty widget renders `EmptyState` with a **reason**; no fabricated 0/—.
- [ ] **Guarantee 5:** under **no-egress**, the headline/quote widgets show the **honest reason**
      (`/news/grouped.no_egress` is served) — no fetch, no invented item.
- [ ] **Per-item staleness** is preserved in every compact summary (quote cards carry `StalenessChip`).

**Composition / layout**
- [ ] **Simple** renders **exactly** headline + ReviewCard + briefing — and **nothing else**.
- [ ] **Full** renders **exactly** the D-046 set — and **nothing else** (no top-holdings widget, no 3
      market rows, **no ticker**).
- [ ] **No ticker on Home** (D-047 amendment) — asserted: `/` contains no page-level TickerStrip; the
      **chrome footer** one is present (as on every page).
- [ ] **Progressive loading:** readers fire **independently**; a slow reader skeletons **only its own
      card**; **no card is left in skeleton** after load.
- [ ] **Single scroll region** (D-100/D-101) and **0 horizontal overflow** — **both layouts × both themes
      × 320/375/900/1366** (Playwright; jsdom cannot catch overflow — ADR-0004).

**Setting / rotation**
- [ ] The layout setting is **server-persisted** (survives a browser wipe — D-078) and Home reads it;
      changing it in Settings changes Home **without a Home-local override**.
- [ ] **Rotating to Home uses the configured layout** — one setting, no special case (D-040). Home
      contains **no rotation logic**.

**Copy / terms**
- [ ] Every shown term matches **GLOSSARY** exactly (incl. the §9-1 arbitration outcome); the retired
      spellings (**"day change"**, **"Review Centre"**, **"Needs a look"**) appear **nowhere**.
- [ ] **Copy hygiene grep:** no decision ID (`D-0…`/`P-…`/`§…`) and no implementation note (enum key,
      endpoint or table name) appears in any user-facing string.
- [ ] **[Help]** targets resolve (§9-12); the glossary **parity guard** (`tests/unit/test_glossary_parity.py`)
      stays green — any new term ships to **`docs/specs/GLOSSARY.md`** first (page-heatmap §13-1).

---

## 8. BUILD PHASES

*One commit per phase. Backend deltas FIRST. Never assemble against an endpoint that does not exist.*

- **Phase 0 — Contract deltas (§3b), backend-first, fail-first.** Whatever §9-3/§9-4/§9-7 approve:
  the `home_layout` settings key + its default; the `/dashboard/home` disposition; any source-persistence
  key. Regenerate `API-CONTRACT.json` + `docs/openapi.json` **same commit**; drift green; **served-value
  tests** (an allow-list key is invisible to a shape check — §3b note).
- **Phase 0a — §5 amendments, if any.** Only if §9-16 (a shared briefing component) or §9-15 (the top-bar
  Detail toggle) is chosen: author **PROPOSED** + a `/kitchen-sink` case; **ratify at the walk**.
  *(Expected: **none** — every widget already has a ratified component, §4.)*
- **Phase 1 — Page assembly.** Compose ratified components at `/`; **replace the boot/health scaffold**
  currently rendered there (`App.tsx`, §10-1) and set `built: true` in `nav.ts`. Independent readers,
  per-card skeletons, honest empty/error/stale states, deep links.
- **Phase 2 — Tests.** Render tests per widget + per **layout**; the §7 criteria; **extend the Playwright
  overflow + single-scroll suites to `/` — in BOTH layouts** (the layout is a composition change, so one
  layout's pass says nothing about the other).
- **Phase 3a — Scripted pre-pass, MUST be GREEN before the walk.** Dev-only `e2e/smoke/` harness against
  the **live** app + real backend on the seeded demo: drive **both layouts × both themes × all
  breakpoints**; assert the **ReviewCard reconciliation live** (Home == Net worth == `/review`); assert
  **no page-level ticker** and **exactly one** stale surface; assert **every card leaves skeleton**;
  capture **console errors** (must be 0). Every visual fix during the walk ships its **own fail-first
  assertion in the same batch**.
- **Phase 3b — Owner acceptance walk (LIVE) — judgment items only.** Each finding becomes a numbered
  `page-home.md §12*` entry, fixed and **re-verified live**. **The owner closes the page — never
  self-certified.**

---

## 9. NEEDS DECISION — OPEN (owner, one pass)

*Everything the specs under-specify. **I resolved none of these.** No build starts on any item still open
here. Ordered: blockers first.*

| # | Item | Why it blocks / evidence | Options (for the owner — **not** a recommendation) |
|---|------|--------------------------|-----------------------------------------------------|
| **9-1** | **The control's LABEL and its two VALUE names.** | **GLOSSARY does not arbitrate — it carries BOTH:** :226 **"Detail level: Simple/Expert"** *(presentation-only view mode, scoped to Home, "the control's single label wherever it appears" — D-030)* and :227 **"Home layout: Simple / Full"** *(the Settings control choosing Home's composition — D-040/D-046/D-047)*. **The code invents a third:** `AppShell.tsx:51` `detailLevel: "simple"｜"full"`, `TopBar.tsx:90` `aria-label="Detail: Simple/Full"` — D-030's noun with D-046's values. **D-030 requires ONE label**; the hard rule requires the shown term to be in GLOSSARY **with that exact spelling** — impossible while both stand. **Blocks §5 and all §7 copy.** | (a) **"Home layout: Simple / Full"** wins; retire "Detail level: Simple/Expert" to Deprecated-terms. (b) **"Detail level: Simple / Expert"** wins; retire "Home layout"; rename the values in code. (c) Both survive as **two different things** (a *layout* and a *density*) — **then D-046's Simple/Full is the layout and Expert is something else that must be specified, or dropped.** *Whichever wins, the loser is RETIRED (Deprecated-terms table) and the code is renamed.* |
| **9-2** | **Where the layout control LIVES until Settings ships.** | D-040 puts it **in Settings** — but **Settings is not built** (it is item 3 in the NEXT queue). Home cannot ship a switchable layout with no switch, and must not grow a page-local control that contradicts D-040 once Settings arrives. | (a) **Ship Home at the DEFAULT layout only**, no switch, until Settings lands (cost: the second layout is built + tested but unreachable by the owner until then — the pre-pass can still drive both). (b) A **temporary on-page control**, removed when Settings ships (cost: it contradicts D-040 while it exists, and "temporary" UI has a habit of staying). (c) **Build Settings first**, then Home (cost: reorders the NEXT queue). |
| **9-3** | **The `home_layout` setting: key + DEFAULT on a fresh install.** | **It does not exist** (`settings.py:23` — `_ALLOWED_KEYS` has no such key; §10-3). No store, no default, no served value. **D-078 requires it server-persisted** (*"Home layout … it defines what rotation shows"*) so a kiosk survives a browser wipe. | Key name follows §9-1. **Default: Simple or Full?** (Simple = the calmer first impression + fewer readers on an empty instance; Full = the wall-appliance identity the product is built around.) **§3b — backend-first.** |
| **9-4** | **`/dashboard/home` — RETIRE or RESHAPE?** | It is **in the frozen contract** and API-CONTRACT.md:82 already flags it *"reshape — D-046"* — but its **current shape is v1, not D-046** (§10-2): hardcoded `SPY/QQQ/GLD/BTC`, portfolio movers only, FX, market status, briefing; **no** allocation, sparkline, ReviewCard, headlines, source select or layout. **Nothing in the frontend calls it.** | (a) **RETIRE it** — Home composes from the 8 canonical readers, one card each. *Pro: it is the only shape that satisfies D-038 ("reuses the canonical page's reader, never a second code path") and the mandated **progressive per-card loading** — an aggregate is **one gate**, so the slowest reader would blank the whole page. Con: more requests; a dead endpoint must be removed from the contract (a deliberate contract deletion).* (b) **RESHAPE it to D-046** — one call. *Pro: one round trip on a kiosk. Con: a **second code path** for figures owned elsewhere, a single gate that defeats per-card skeletons, and it must be kept in lockstep with 8 readers forever.* **Owner's call — the contract changes either way.** |
| **9-5** | **Which allocation dimension is Home's ONE donut?** | D-046/IA §4 say *"one allocation donut"* and name **no dimension**. The reader serves **three** — `allocation_by_class`, `allocation_by_sector`, `allocation_by_currency` — and **Portfolio renders all three** (`Portfolio.tsx:274–276`). | (a) **By class** (the most common reading of "allocation"). (b) **By sector**. (c) **By currency**. (d) A **view-scope select** over the three — *note: that is an affordance D-046 does not grant, and it edges toward R-19 (parked).* |
| **9-6** | **Movers: list LENGTH (N) per pair.** | *Composition itself is NOT open — IA §4 + GLOSSARY settle it: **both** pairs, one of each (Contributors/Detractors from **Portfolio**, Gainers/Losers from **Markets**), never interchanged (D-024).* But **N** differs across the code today: `/portfolio/summary` serves **5** (`top_movers(..., n=5)`, `portfolio.py:469`); Markets shows **5** (`Markets.tsx:52`); the legacy dashboard used **4** (`dashboard.py:39`). A Home *summary* is presumably shorter than the canonical page's list. | Pick N per pair (e.g. **3** for a summary vs the canonical **5**), or reuse 5. *Whatever is chosen, the summary must not out-detail its canonical page (P-1).* |
| **9-7** | **Quote cards: which sources are SERVED, the DEFAULT source, and where the choice PERSISTS.** | The component's source list is hardcoded 4-up — `markets｜holdings｜global｜watchlist` (`QuoteCardRow.tsx:9`) — and DESIGN-SYSTEM :303 ratifies it as a **view-scope** select (so **no MASTER-DATA vocab is needed** — D-005 is satisfied). **But:** ⚠ `/watchlists` serves the **lists**, and I did **not** confirm it serves **quotes** for them (§10-7g) — if it does not, "Watchlist" is a **mock-backed affordance** and needs a reader; **no default source is specified**; and **the choice has NO store** — no settings key, no per-device store (§10-7h), so it resets on every reload. | Confirm the 4 sources (drop any that has no reader); pick the **default**; choose persistence: **server settings key** (D-078's kiosk posture) **vs per-device** (a deliberate exception that must be stated). |
| **9-8** | **The sparkline's series, window and benchmark.** | `/portfolio/performance` **requires** `days`, `benchmark` **and** `include_manual`, and **always returns a `benchmark` series alongside `series`** — **there is no comparison-free variant** (§10-7b). `series` is **raw values `{ts,value}`, not pre-indexed**. D-046 says *"performance sparkline"* — **not** a comparison — so Home presumably renders **only** `series`; but it must still **send** a benchmark, and the server still computes one. | Choose the **window** (e.g. 30/90/180d — Home has no basis for one), the **benchmark to send** (and whether Home renders it: D-046 implies **no**), and `include_manual`. *If Home renders no benchmark, note that the server computes one anyway — accept, or (a §3b delta) allow the benchmark to be omitted.* |
| **9-9** | **"Top headlines": how many, from which group?** | `/news/grouped` returns **grouped** headlines (My holdings · India · Singapore · US · Global · Macro/FX). D-046 says *"briefing summary + top headlines"* and specifies **neither a count nor a group**. GLOSSARY: *"My holdings" is ranked by relevance*. | Pick the count (e.g. 3–5) and the source group: (a) **"My holdings"** only (the most personal, and the only relevance-ranked group); (b) a flat top-N across all groups; (c) the first N of each group *(almost certainly too much for a summary)*. |
| **9-10** | **Widget ORDER in Full.** | D-046 gives a **list**, not a layout. | I **propose D-046's own listing order** (net worth + Today's change → sparkline → donut → both movers → ReviewCard → briefing + headlines → quote cards) for the owner to confirm or reorder. **I did not adopt it.** |
| **9-11** | **Per-widget empty-state copy (verbatim strings).** | Guarantee 3 requires a **reason**, not just an empty box, for **8** widgets — and an empty instance (no holdings, no news) hits **all of them at once**. No spec supplies the strings. | Owner supplies/approves the exact strings per widget (the ND-12 pattern: message + reason). |
| **9-12** | **`[Help]` targets on Home.** | Which terms get a popover here — and Home is a *summary* page, so a [Help] on every figure would be noise. | Candidates: **Net worth**, **Today's change**, **Briefing**, **Headlines**, **Gainers/Losers**, **Contributors/Detractors**, **Review**. Owner picks the set. |
| **9-13** | **GLOSSARY: is "Home" a term?** | "Home" is a **nav label / H1**, and GLOSSARY has only *"Home layout"* — **no "Home" entry** (§10-4). **Heatmap ND-11 is the precedent** (the same gap, added at that page's walk). | (a) **Add "Home"** (PROPOSED → ratify at the walk) — *note the parity guard now enforces the spec store*. (b) Rule that a **nav label is not a term** and needs no entry — *then say so once, generally, because the same question will recur for every page.* |
| **9-14** | **Rotation (D-044) is NOT implemented — is wiring it in Home's scope?** | The toggle exists as **UI-only state** (`AppShell.tsx:50`, `TopBar.tsx:78`) with **no interval, no navigation, and no read of the served `rotation_pages`/`focus_page`** — which **are** allow-listed (`settings.py:26`) but **never consumed**. That is exactly the **write-only allow-list key** D-078 requires to be *"either consumed or removed"*. Home is the rotation **landing** page, so the gap surfaces here — but the logic is **chrome's**, not Home's (D-044: no page-local rotation). | (a) **Out of scope** — Home only honours the configured layout; rotation gets its **own** task (recommended framing: it is a chrome/Settings feature). (b) **In scope** — wire rotation **in the chrome** during this build (cost: it is not a Home page concern and would grow this plan). *Either way: **no rotation logic inside Home**.* |
| **9-15** | **The top-bar Detail toggle: which spec wins?** | ⚠ **Spec-vs-spec divergence** (§10-5). **D-040**: *"global top-bar toggle **removed**"*. **IA :390**: *"the Detail toggle **leaves** the top bar"* — in a list whose other items read *"StaleBanner **kept**"*, *"rotation toggle **stays**"*, so "leaves" = **departs**. **But DESIGN-SYSTEM :375** ratifies TopBar props **`detailLevel?`+`onToggleDetail?`** and says the bar owns *"the two toggles … rotation (D-044) and **Detail level** (D-040, only Home branches)"* — **and the code implements it**, with **local, non-persisted** state that no server setting backs. | (a) **IA/D-040 win** → **remove** the toggle from TopBar (a **DESIGN-SYSTEM §5.5 amendment** + a chrome change — *outside Home's page code*), control lives in Settings. (b) **DESIGN-SYSTEM wins** → the top bar **keeps** it, and D-040/IA are amended to say so; it must then be **backed by the server setting** (§9-3), not local state. *Today's code is neither: a toggle that persists nothing.* |
| **9-16** | **A shared "briefing" component — §5 amendment or page-local?** | There is **no ratified briefing component**; News renders it as a plain card body (`News.tsx:84`). Home would be the **2nd** occurrence; the house rule extracts at the **3rd**. | (a) **Page-local on Home** (follows the rule; revisit at a 3rd use). (b) **Extract now** as a §5 amendment (PROPOSED → ratify at the walk). |

---

## 10. VERIFY-FIRST FINDINGS (2026-07-13) — read before assuming shapes (D-019 + audit the guards)

| # | Finding | Evidence (file:line) |
|---|---------|----------------------|
| 1 | **Home is UNBUILT.** `/` currently renders the **boot/health scaffold** (backend-status dots + a tabular-numeral sample), not a dashboard. `nav.ts` declares Home but with **no `built: true`** flag. Phase 1 **replaces** this scaffold. | `frontend/src/App.tsx:38`; `AppRoutes.tsx:30`; `components/ui/nav.ts:24` |
| 2 | **⚠ `/dashboard/home` EXISTS in the frozen contract and is a LEGACY v1 aggregate — NOT D-046.** It serves `now`/`timezone`/`demo_mode`/`market_status`, a `portfolio` block, `top_movers` (**portfolio** gainers/losers, n=4), `markets` from a **hardcoded** list, `fx`, and `briefing`. It has **no** allocation, **no** sparkline, **no** ReviewCard, **no** headlines, **no** source select and **no** layout concept. **Nothing in the frontend calls it.** API-CONTRACT.md already flags it for reshape. → **§9-4** | `app/api/v1/routes/dashboard.py:21` (`_HOME_MARKETS = ["SPY","QQQ","GLD","BTC"]`), `:34–97`; `docs/specs/API-CONTRACT.md:82` |
| 3 | **The Home-layout setting DOES NOT EXIST.** `GET`/`PUT /settings` exist and are **generic** (`stored` free dict / `values` patch), but `_ALLOWED_KEYS` has **no `home_layout`** — and `defaults{}` serves none. So: **no store, no default, no served value.** This is an **allow-list + default** delta, **not** a new endpoint. → **§3b / §9-3** | `app/api/v1/routes/settings.py:23–34` (allow-list), `:37` (GET), `:44` (defaults), `:61` (PUT) |
| 4 | **⚠ The label collision is REAL and GLOSSARY does not settle it** — two entries both claim the Home control, with **different value pairs**; and **"Home" itself is not a term** (only *"Home layout"*). → **§9-1 / §9-13** | `docs/specs/GLOSSARY.md:226` (*Detail level: Simple/**Expert***), `:227` (*Home layout: Simple / **Full***) |
| 5 | **⚠ Spec-vs-spec-vs-code divergence on the top-bar Detail toggle.** D-040 + IA say it **leaves** the top bar (IA's list contrasts it with *"StaleBanner kept"* / *"rotation toggle stays"*); **DESIGN-SYSTEM §5.5 ratifies it as a TopBar prop** and the **code implements it** — with **local state that persists nowhere**. → **§9-15** | `DECISIONS.md:302` (*"global top-bar toggle removed"*); `INFORMATION-ARCHITECTURE.md:390-391`; `DESIGN-SYSTEM.md:375`; `AppShell.tsx:51/153–154`; `TopBar.tsx:31/90–94` |
| 6 | **⚠ Rotation (D-044) is a UI-only toggle with NO implementation.** `rotationOn` is chrome state with **no interval, no navigation**, and **no read** of the served `rotation_pages`/`focus_page` — which **are** allow-listed but **never consumed** (precisely the **write-only allow-list key** D-078 orders *"consumed or removed"*). → **§9-14** | `AppShell.tsx:50`; `TopBar.tsx:78`; `settings.py:26`; `DECISIONS.md:408–412` |
| 7 | **Every D-046 widget's reader EXISTS. No new endpoint is needed.** Per widget: | |
| 7a | **Net worth + Today's change** — `/portfolio/summary` serves `total_value`, `day_change`, `has_stale`, `stale_count`, `base_currency` (plus `gross_assets`/`liabilities`). | `app/api/v1/routes/portfolio.py:110-118`; `NetWorth.tsx:154` |
| 7b | **Sparkline** — `/portfolio/performance` returns `series:[{ts,value}]` (**raw values, NOT pre-indexed**) **and always a `benchmark` series** + `stats`; `days`, `benchmark`, `include_manual` are **all required** query params. **There is no comparison-free variant.** → **§9-8** | `frontend/src/api/portfolio.ts:69–75` (`PerformanceResp`), `:147` (query) |
| 7c | **Allocation** — `/portfolio/summary` serves **three** dimensions (`allocation_by_class` / `_sector` / `_currency`); Portfolio renders **all three**. D-046 wants **one**, unnamed. → **§9-5** | `portfolio.py:120-122`; `Portfolio.tsx:274–276` |
| 7d | **Contributors / Detractors** — served as `top_gainers` / `top_losers` on `/portfolio/summary` (**n=5**), and **labelled** *"Contributors — today"* / *"Detractors — today"* on Portfolio. The **served field names differ from the shown labels** — do not let the enum key leak into copy (D-024/copy hygiene). | `app/services/portfolio.py:469`; `Portfolio.test.tsx:112–115` |
| 7e | **Gainers / Losers** — **no served ranked list exists.** Markets derives them as a **DISPLAY SORT** of the served `change_pct` over `/markets/overview` (N=5), explicitly *"a display SORT … the page performs no money math"*. Home reusing that sort is a **2nd occurrence of display logic**, not a second reader — permitted, and page-local until a 3rd (§4). | `Markets.tsx:50/52/180–181` |
| 7f | **ReviewCard** — `/portfolio/review` (`review_report`) is the **same reader Net worth's ReviewCard already uses**; the Review **page** uses `/review` (`review_centre`). **Both are served by the same `app/services/review.py`**, so the attention count **reconciles by construction** (page-review ND-3). Home adds **no third fetch site**. | `portfolio.py:920` (`/portfolio/review`), `:928` (`/review`); `NetWorth.tsx:100/310` |
| 7g | **Briefing + headlines** — `/briefing` serves `text` (a **served display string**, deterministic; **AI narration deferred**, D-068) + `generated_at`; `/news/grouped` serves `groups`/`total`/**`no_egress`**. ⚠ **Quote sources:** readers exist for *Markets* (`/markets/overview`), *Holdings* (`/portfolio/holdings`) and *Global* (`/markets/global`); **`/watchlists` serves the LISTS — I did not confirm it serves QUOTES.** If it does not, **"Watchlist" is a mock-backed affordance**. → **§9-7** | `frontend/src/api/news.ts:32–33`; `api/markets.ts:93–95` |
| 7h | **The quote-source select has NO persistence.** No settings key, no per-device store — the choice resets on reload. Its 4 values are **hardcoded in the component**, which **DESIGN-SYSTEM explicitly ratifies as a view-scope `Select`** — so **D-005/MASTER-DATA do NOT require a served vocab here** (a real check, not an assumption). → **§9-7** | `QuoteCardRow.tsx:9/17–22`; `DESIGN-SYSTEM.md:303` |
| 8 | **Honesty is INHERITED from the chrome — Home must not re-implement it.** `StaleBanner` renders from the **one shared stale query** (so a page-local stale count would be a **second source of truth** — the very defect page-pricing-health §12ph1-1 fixed); no-egress state is chrome-level; `/news/grouped` flags `no_egress` **per response**; per-item staleness is carried **inside** `QuoteCardRow` (`StalenessChip` per quote). | `AppShell.tsx:76/89/156`; `QuoteCardRow.tsx:43` |
| 9 | **First-run needs NO Home affordance.** The checklist is a **global chrome overlay** shown over *any* page, gated on the server-persisted `first_run_complete`. What remains open is only what each **widget** shows on an **empty** instance (→ **§9-11**), not a Home-local checklist. | `AppShell.tsx:70–73`; `settings.py:33` |
| 10 | **Household scope (D-065/P-7).** `/portfolio/*` accept `entity_id` but default to **household**, and the built pages show **no entity selector** (page-portfolio ND-8). Home follows: **household-only, no selector.** | `portfolio.py` (`entity_id: int｜None = Query(default=None)`) |
| 11 | **Every widget has a ratified component; NO §5 amendment is expected.** The **ReviewCard** and **QuoteCardRow** inventory entries name **Home** as their home — they were built *for this page* and are still unused. The one true gap is the **briefing card body** (no component; News renders it locally) → **§9-16**. | `DESIGN-SYSTEM.md:331` (QuoteCardRow), `:351` (ReviewCard *"on Home/Net worth"*); `News.tsx:84` |
| 12 | **⚠ SPEC STALENESS — the superseded "ticker in Full" framing survives in three places.** The **D-047 AMENDMENT is RATIFIED (2026-07-11)** — TickerStrip is **global chrome footer, every page**, and *"Home Full no longer duplicates it"* — and DESIGN-SYSTEM :332 is correct. But: **IA :162** still lists *"Ticker strip — **Full layout only**"* inside the D-046 table; **IA :170** still marks the amendment *"**PROPOSED**"* (it is ratified); **GLOSSARY :227** still says *"Full adds the fuller widget set **and the ticker strip**"*; and **CURRENT.md** still says *"(+ the D-047 ticker strip in Full)"*. **None changes the build** (Home renders no ticker), but all four are **stale text** → **correct at close**, per convention. | `DECISIONS.md:697–706`; `DESIGN-SYSTEM.md:332`; `INFORMATION-ARCHITECTURE.md:162/170`; `GLOSSARY.md:227`; `docs/plans/CURRENT.md` |

**Net of verify-first:** **no new endpoint** is needed for any D-046 widget (§10-7) — the whole page is a
composition of readers that already exist. The genuine open questions are **architectural** (retire or
reshape `/dashboard/home` — §9-4), **a missing setting** (§9-3, a §3b allow-list delta), **a terminology
conflict the GLOSSARY cannot arbitrate** (§9-1), and **two live spec-vs-code divergences** the build must
not silently paper over (**§10-5** the top-bar toggle, **§10-6** rotation) — both flagged **⚠**, both
resolved by the owner, not by me (D-019: *when the code diverges from the spec, flag it and resolve it —
never silently build to the code*).

---

**STOP — §9 is OPEN. Do not build.** Next action is the **owner's one-pass §9 resolution**; only then does
Phase 0 begin.

# page-home.md — Home page build plan

**Status: REBUILT + WIRED, but BLOCKED at §12ho1-7 — the ratified grid does NOT fit one viewport once
it is wired inside the chrome with real data. Phases 1 and 2 are DONE; Phase 3a CANNOT be certified
until the owner picks a lever (§12ho1-7). Home ships ONE layout (§12ho1-6 — Simple removed).
Read §12ho1-7 FIRST.**
*(Historical: §9 RESOLVED 2026-07-13; Phases 0/0a/1/2/3a and Phase-3b Batch 1 are recorded below — the
Phase-1 assembly they describe no longer exists. Read §12ho1-4 first.)*
Drafted from `TEMPLATE-page-build.md`. **Verify-first (§10) was done BEFORE §1–§8** (D-019 — read what
the engine actually serves *and audit its honesty guards*, not just its shapes). **Every gap went to §9;
the owner resolved all 16 in one pass (2026-07-13) — resolutions at the head of §9, options preserved.**

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

## 9. NEEDS DECISION — **RESOLVED** (owner, one pass, 2026-07-13)

> **RESOLUTIONS (owner, 2026-07-13).** All 16 items resolved in one pass; the considered options are
> preserved in the table below. **Ratifications pending at the walk:** the §9-1 label + its
> Deprecated-terms entry, the §9-11 empty-state strings, the §9-13 GLOSSARY **"Home"** term, the §9-15
> TopBar amendment, and the §12-recorded **layout default**.
>
> - **9-1 (a) — the control is "Home layout: Simple / Full" EVERYWHERE.** GLOSSARY :227 **stands** (its
>   stale *"and the ticker strip"* note corrected at close — §10-12); **"Detail level: Simple/Expert"**
>   (:226) is **RETIRED** to the Deprecated-terms table **with a pointer**. Code renamed
>   (`detailLevel` → `homeLayout`, aria-labels, test ids); **copy-hygiene grep for "Detail level" /
>   "Expert" app-wide**.
> - **9-2 (a) — Home ships at the DEFAULT layout, with NO user-facing switch, until Settings.** **Both
>   layouts are BUILT and TESTED.** The §8 walk instructions carry the exact `PUT /settings` command to
>   flip `home_layout` live. CURRENT.md's Settings-candidates list gains *"Home layout control (D-040;
>   §9-2a interim = default-only)"*.
> - **9-3 — §3b delta, backend-first.** `home_layout` → `_ALLOWED_KEYS`; values **`simple|full`**;
>   **server default `full`**; served on the settings read. Contract regen **same commit**; **fail-first**
>   (the key is rejected/ignored RED before, accepted after; the default asserted).
> - **9-4 (a) — RETIRE `/dashboard/home`.** A **deliberate contract DELETION**, backend-first, same-commit
>   regen + drift green. The API-CONTRACT delta row moves from *"reshape — D-046"* to **"retired —
>   page-home §9-4 (D-038: canonical readers only; per-card loading)"**. **Fail-first:** a test proving the
>   route is **gone**, **JSON-shape-discriminating** (the Review lesson). Home composes from the canonical
>   readers, **one card each, progressively loaded**.
> - **9-5 (a) — the donut is allocation BY CLASS** (served `allocation_by_class`), linking to **Portfolio**
>   (where all three dimensions live).
> - **9-6 — movers: N=3 per pair, BOTH pairs**, labels served verbatim and **never interchanged** (D-024):
>   **Contributors/Detractors → Portfolio**; **Gainers/Losers → Markets**.
> - **9-7 — VERIFY watchlist quotes first** *(done — see the ✅ below)*. Sources = the **four ratified
>   view-scope options**; any source with no reader is **dropped and recorded**. **Default `holdings`.**
>   Persistence: a **`home_quote_source` server settings key** (allow-list delta **rides with 9-3**, same
>   commit).
> - **9-8 — the sparkline MIRRORS Portfolio's default view:** same window, same `benchmark` param, same
>   `include_manual`. It renders **`series` only** — no benchmark line, **no client indexing or math**. The
>   **unused server-side benchmark computation is ACCEPTED and recorded** (revisit only if it ever costs).
> - **9-9 (a) — top headlines = the "My holdings" group, N=3**, linking to **News**.
> - **9-10 — Full order = D-046's listing order:** headline stat block → sparkline → donut → movers pair →
>   ReviewCard → briefing + headlines → quote cards. **Simple** = headline + ReviewCard + briefing.
> - **9-11 — all 8 per-widget empty-state strings** drafted **PROPOSED** in this commit (message + reason,
>   Guarantee 3); **ratify at the walk**.
> - **9-12 — `[Help]` on Net worth, Today's change, Briefing only.**
> - **9-13 (a) — GLOSSARY gains "Home"** (PROPOSED): *the summary dashboard; owns nothing — every figure is
>   a linked summary of its canonical page (P-1/D-038)*. In **`docs/specs/GLOSSARY.md`** — the **parity
>   guard** (`tests/unit/test_glossary_parity.py`) enforces it (page-heatmap §13-1).
> - **9-14 (a) — rotation wiring is OUT of Home's scope.** The D-078 violation is recorded as a **queued
>   chrome task** in CURRENT.md (*"consume `rotation_pages`/`focus_page` or remove the keys — D-044/D-078;
>   slots with Settings"*) **+ a line in `docs/audit/08-TECH-DEBT.md`**.
> - **9-15 (a) — the top-bar Detail toggle is REMOVED** (its own chrome commit + §-entry): a **DESIGN-SYSTEM
>   §5.5 amendment (PROPOSED → ratify at the walk)** deleting `detailLevel?`/`onToggleDetail?` from TopBar
>   and correcting its toggle note to **rotation-only**. **IA/D-040 stand as written.** Copy/test grep so no
>   dangling reference remains.
> - **9-16 (a) — the briefing summary stays PAGE-LOCAL on Home** (2nd occurrence; extraction at the **3rd**,
>   per the centralization rule).
>
> **✅ 9-7 VERIFIED BEFORE BUILDING (the blocker the owner gated on):** **`/watchlists` already serves a
> quote per item** (`watchlists.py:38–40` — `get_cached_quote` per instrument → `items[].quote`, the same
> `ServedQuote` shape as `/markets/overview` and `/markets/global`). So the Watchlist source needs **NO new
> endpoint and NO composition** — and **no source is dropped: all four have a real reader.** *(Pinned by
> `test_watchlists_serve_a_quote_per_item` so it is never re-litigated.)*

*The table below is the ORIGINAL analysis, preserved — the options the owner chose between. Nothing here
is open any more.*

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

**§9 is RESOLVED (2026-07-13).** Build record: §11.

---

## 11. BUILD RECORD — Phases 0/0a/1/2/3a DONE; Phase-3b (owner walk) PENDING (2026-07-13)

- **Phase 0 — contract deltas (backend-first, fail-first).** `home_layout` (`simple|full`, **default
  `full`**) + `home_quote_source` (**default `holdings`**) added to the settings allow-list; both
  defaults **and both vocabularies** are SERVED (so the frontend carries no vocab copy, D-005). The
  backend is the validation truth: an unrecognised value is an honest **400** — **`"expert"` is
  refused**, since §9-1 retired that vocabulary. **`/dashboard/home` RETIRED** (deliberate contract
  deletion); contract regenerated same commit, drift green. **Fail-first:** 8 of 11 tests RED before
  (a PUT of `home_layout` was **silently ignored** — the writer skips unknown keys; and the aggregate
  returned **200**).
  **Three dependencies the retirement exposed — none papered over:**
  1. **The SPA catch-all answered ANY unmatched `/api/` path with `index.html` and 200 OK**, so a
     deleted endpoint was indistinguishable from a live one and the retirement was **unobservable**.
     An unmatched API path is now an honest **JSON 404**. This also **strengthened the D-030 guard**:
     `test_d030_rename_review_endpoint` asserted *"the old route isn't JSON"* — true only **because of
     the catch-all**. It now asserts a real 404 + no payload.
  2. `system.py` imported **`_HOME_MARKETS`** from the dead module to warm the refresh list. Home has
     no curated tiles now, and those four symbols are a **strict subset of `_DEFAULT_OVERVIEW`** — so
     coverage shrinks by **nothing** (pinned by a test).
  3. The soft-delete **R12 guard** used `dashboard._holding_currencies`. The behaviour it guarded is
     still live, so the guard **MOVED** to the canonical reader (`summary.allocation_by_currency`)
     rather than being deleted with the endpoint.
- **Phase 0a — §9 resolutions recorded; TopBar amendment PROPOSED (§9-15).** No new components
  (§9-16 keeps the briefing page-local at its 2nd occurrence). API-CONTRACT delta row → *"retired"*.
  **08-TECH-DEBT** records the **D-078 violation** (rotation keys allow-listed but never consumed) as a
  queued **chrome** task — out of Home's scope (§9-14).
- **Phase 1 — chrome edit + assembly.** The **top-bar Detail toggle is REMOVED** (§9-15); `homeLayout`
  is the only vocabulary; **"Detail level: Simple/Expert" retired** to Deprecated-terms; GLOSSARY gains
  **"Home"** (PROPOSED) **in the spec** (the parity guard enforces it). `routes/Home.tsx` composes the
  D-046 set from the canonical readers — each card its own reader, its own skeleton, **no `Promise.all`
  gate**. `App.tsx` (the boot scaffold) **deleted** — Home replaced it at `/`.
  **Two things found while assembling, both fixed:** an unreachable `/settings` would have left Home
  **skeletoning forever** with no reason shown (it now shows an honest error + retry, and **never falls
  back to an invented layout**); and **QuoteCardRow demanded a full `Provenance`** the quote readers do
  not serve (`confidence`/`status` are not per-quote and the row never displays them) — requiring it
  would have forced callers to **invent provenance**, so the prop type is **narrowed to the fields it
  renders**. No visual change; staleness stays served and shown per item.
- **Phase 2 — tests (10).** Layout composition per **served** setting; the honest layout-error state;
  **D-024 label integrity** (both pairs, neither borrowing the other's name); the **served** attention
  count (Home never recounts); Guarantee 3/5 per widget (stale count, per-item staleness in the quote
  cards, no-egress reason, empty briefing, unreachable reader). Overflow + single-scroll suites cover
  `/`. *(One test caught a real race — the Markets pair arrives on its own reader, so a synchronous
  assertion passed alone and failed in the full run.)*
- **Phase 3a — scripted pre-pass GREEN** (`e2e/smoke/home-smoke.spec.ts`): served defaults
  (`full`/`holdings`) · **`/dashboard/home` → 404** · FULL renders all 7 D-046 cards, none left in
  skeleton · **no page-level ticker** (1 on the page — the chrome footer's; **0 inside Home**) ·
  reconciliation (**`/portfolio/review` == `/review`**, and Home renders the count **it was served**) ·
  **both movers pairs** under their canonical labels · the **source select across all four served
  sources** (Markets 20 · Holdings 7 · Global 15 · Watchlist 8) · **[Help] × 3** · SIMPLE renders
  headline + ReviewCard + briefing with the Full-only cards **absent** · single scroll + **0 overflow**
  across **both layouts × both themes × 320/375/900/1366** · **0 console errors**.

  **⚠ The pre-pass caught a REAL composition defect (fail-first, exactly its job): the ReviewCard was
  MISSING in Simple.** It had been nested inside the Full-only block, so Simple rendered headline +
  briefing — violating D-046 (*"Simple = headline + ReviewCard + briefing"*). The Phase-2 unit test
  missed it because it only asserted what Simple must **not** show; **an "is not there" test needs its
  "is there" half.** Both fixed in the same batch.

  It also caught **a defect in the pre-pass itself**, worth recording: reconciling the **rendered DOM**
  against a **later** API call is **racy on a live system** — the refresh worker cleared a stale-driven
  review item between the page's fetch and the check (4 → 3), and the "mismatch" was **our clock, not
  the product**. The assertion now compares the DOM to **the response the page itself received**.

**Verification:** backend **564** · ruff clean on touched files · **contract drift green**; frontend
`npm run check` **exit 0** (lint · typecheck · tokens · **179 unit** · **129 Playwright**); **live
pre-pass GREEN**, 0 console errors.

### Walk instructions (§9-2a — there is no on-page switch until Settings ships)

Flip the layout live with exactly this, then reload `/`:

```bash
curl -X PUT http://127.0.0.1:8321/api/v1/settings \
     -H 'Content-Type: application/json' \
     -d '{"values":{"home_layout":"simple"}}'    # or "full" (the served default)
```

**STOP for the Phase-3b owner walk (judgment items) — I do NOT self-certify.** Ratifications pending at
the walk: the **§9-1 label + its Deprecated-terms entry**, the **§9-11 empty-state strings**, the
**§9-13 GLOSSARY "Home"** term, the **§9-15 TopBar amendment**, and the **layout default (`full`)**.

---

## 12. PHASE-3b OWNER WALK — BATCH 1 (2026-07-13)

**Owner verdict: the Home layout FAILS its purpose** — a no-scroll, at-a-glance snapshot. Plus one copy
defect and one design-language deviation. **§12ho1-1 and §12ho1-2 are DONE in this batch. §12ho1-3 is a
PROPOSAL ONLY — HARD STOP for owner approval before any layout code.**

### §12ho1-1 — Subtitle copy defect (governance-speak in user copy) — DONE, ratify the pick

**The defect.** Home's subtitle — *"every figure is owned by the page it links to"* — is **internal
governance language** (P-1/D-038) leaked into **user copy**. Those words are how *we* talk about the
architecture; they are not how the product talks to the person reading it.

**Owner's three candidates** (implemented **(a)**; **all three listed for ratification at re-verify**):
- **(a) "Your summary — tap any card for the full picture"** ← **IMPLEMENTED (PROPOSED)**
- (b) "Your wealth at a glance"
- (c) *(no subtitle)*

**It was never one slip — the defect CLASS was live in 11 files.** The app-wide grep ("canonical",
"owned", "reader") found **16 user strings**. The honest **intent stays** everywhere; only the wording
becomes plain:

| Before (governance-speak) | After (user-plain, same honesty) | Where |
|---|---|---|
| "The reader is unreachable — values are withheld, never guessed." | "We couldn't reach the source of these figures — they're held back rather than guessed." | Heatmap · NetWorth · Portfolio · PricingHealth · Markets · News · Review |
| "Its reader is unreachable — the figure is withheld, never guessed." | "We couldn't reach the source of this figure — it's held back rather than guessed." | Home |
| "The settings reader is unreachable — rather than guess a layout, Home shows nothing." | "We couldn't reach your settings — rather than guess a layout, Home shows nothing." | Home |
| "Today's change — **canonical on** Net worth." | "Today's change — **full detail on** Net worth." | Home legend *(the owner's named example)* |
| "A scoped view; **canonical on** Markets & Portfolio" | "A focused view — **full detail on** Markets & Portfolio" | InstrumentDetail |
| "Fetching from the market & portfolio **readers**." | "Fetching the latest market and portfolio data." | InstrumentDetail |
| "Fetching from the pricing **reader**." | "Fetching the latest prices." | Holdings |
| "The Global **reader** returned no index groups." / "The markets **reader** returned no instruments." | "No index groups came back." / "No instruments came back." | Markets |
| "Reporting only; every figure comes from the **canonical readers**." | "Reporting only — every figure comes straight from your own data." | Heatmap |
| "The pricing **reader** is unreachable. Values are not shown rather than guessed." | "We couldn't reach the price source. Values are left out rather than guessed." | KitchenSink |

**Guarded, not just fixed** (the *"one truth in two stores needs a guard"* lesson generalised): a new
**CI-unit copy-hygiene guard** — `tests/unit/test_copy_hygiene.py` — fails if `canonical`, `reader(s)`
or `owned by` appears in **any** user-facing string in `routes/` or `components/ui/` (code comments,
where the vocabulary belongs, are ignored). **Fail-first: RED on 11 files** before the fix, green after.

### §12ho1-2 — Linked-summary affordance: CONFORM + CODIFY — DONE, ratify the rule

**The deviation.** Home's text-links-below-titles were a **fourth** variant of one idea. The grep found
the affordance had drifted into **four** forms:

| Variant | Where |
|---|---|
| a **text link** in the header row (no ↗) | **Home** (7 cards) — the deviation the owner caught |
| "Portfolio ↗" as a **text link with a glyph** | Net worth · Portfolio (Costs) · Instrument Detail (×3) |
| a **bare corner glyph** | Review tile · Portfolio (Realised P/L tile) |
| a **footer text link**, "Review →" | **ReviewCard** (a ratified *component* — so it shipped everywhere it is used) |

**(a) + (c) CONFORMED — all four, app-wide (§11-4: never fix only the instance you found).** One
affordance now: **the corner ↗, top-right of the tile**. New shared components
`ui/SummaryLink` + `ui/SummaryHead`. Titles are no longer links anywhere. Every ↗ is a **real link**
(keyboard focusable, Enter activates) whose **`aria-label` names the destination** — the glyph is
decorative. **`whole`** makes the entire header the click target for **pure-summary** tiles; a header
carrying a **[Help]** popover deliberately does **not** use it, because nesting an interactive element
inside a link is an accessibility defect (that is why the owner scoped it to *"where the tile is a pure
summary"*). Hover/focus change colour + outline only ⇒ **no layout shift**. *Movers carries **two** ↗ —
it summarises two canonical pages, and a single whole-header target would hide one of them.*

**(b) CODIFIED (PROPOSED → ratify at re-verify).** DESIGN-SYSTEM §5 gains the **RULE**: *"A linked
summary carries the corner ↗ affordance top-right of the tile; titles are not text links; no
page-local variants."* Codified at the **3rd recurrence**, exactly per the centralization rule.

**Fail-first:** the pre-pass asserts **0 text-link variants**, **≥5 ↗ affordances**, **every ↗ carries an
`aria-label`**, and the first is **keyboard-focusable** — RED before (0 affordances, 7 text links), GREEN
after (**0 text links · 8 ↗ · 8 with aria-label**).

### §12ho1-3 — Layout rework (no-scroll snapshot) — **STEP 1: PROPOSAL ONLY. AWAITING OWNER APPROVAL.**

**The diagnosis, stated plainly.** §9 resolved *which* widgets Home shows (D-046) and *in what order*
(§9-10). It never specified a **geometry**. So the build did the only thing a widget list can produce:
**a single stacked column of correct cards** — which passed every test and the pre-pass, and still
**fails the page's purpose**. *A widget list is not a layout.* (Folded into TEMPLATE now — see below.)

**Target (owner's intent): Full fits ONE viewport at ≥1366×768 with the demo dataset — no scrolling.**
Hierarchy = **attention first** (Today's change, ReviewCard), achieved by **SIZE and PLACEMENT only**.
The D-046 set is **fixed**; there is **no dynamic reordering** (that is R-19, parked).

#### Grid map — **Full**, ≥1366 (12 columns × 3 rows, no half-empty rows)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ H1 "Home"   ·   subtitle                                                (page header) │
├───────────────────────────────┬───────────────────────────────┬──────────────────────┤
│ HEADLINE  (cols 1-5)          │ PERFORMANCE (cols 6-9)        │ REVIEW  (cols 10-12) │  R1
│ ┌───────────────────────────┐ │ sparkline, full-bleed         │ attention count LEAD │  ~34vh
│ │ Net worth       [?]    ↗  │ │                        ↗      │ verdict rows      ↗  │
│ │  S$ 1,234,567.00          │ │                               │ (the second "lead"   │
│ │ ─────────────────────────  │ │                               │  by placement)      │
│ │ Today's change  [?]       │ │                               │                      │
│ │  +S$ 2,140.55  (+0.42%)   │ │                               │                      │
│ │  ← THE LEAD: largest type │ │                               │                      │
│ └───────────────────────────┘ │                               │                      │
├───────────────────────────────┼───────────────────────────────┴──────────────────────┤
│ ALLOCATION (cols 1-4)         │ MOVERS  (cols 5-12)                                  │  R2
│ donut + legend           ↗    │ 4 lists × N=3, in ONE row of four columns:            │  ~30vh
│                               │ Contributors │ Detractors │ Gainers │ Losers          │
│                               │        ↗ Portfolio        │      ↗ Markets           │
├───────────────────────────────┴──────────────────────────────┬───────────────────────┤
│ BRIEFING + HEADLINES  (cols 1-8)                             │ QUOTES  (cols 9-12)   │  R3
│ briefing text (clamped 3 lines) + 3 headlines           ↗    │ source select    ↗    │  ~30vh
│                                                              │ compact cards, wrap    │
└──────────────────────────────────────────────────────────────┴───────────────────────┘
```

- **The lead is Today's change**, not Net worth: largest type in the headline block, gain/loss toned.
  Net worth sits above it as the anchor figure. **ReviewCard is the second lead** — top-right, the
  strongest corner after the headline, with its attention count as the block's largest element.
- **[Help]** stays inline with its term (Net worth, Today's change, Briefing — §9-12). **↗** sits
  top-right of **every** tile (§12ho1-2). Neither moves at any breakpoint.
- **No half-empty rows:** each row is fully packed; the three row heights sum to ~94vh + header.

#### Behaviour by width

| Width | Grid | Notes |
|---|---|---|
| **≥1920** | same 12-col map | tiles grow; type scale unchanged (no stretched figures); max page width caps so lines stay readable |
| **1440×900** | same 12-col map | the comfortable case — most headroom; **fits one viewport** |
| **1366×768** | same 12-col map, **compact density** | **the hard target.** Movers → N=3 (already), briefing clamped to 3 lines, quote row scrolls *within its own tile* if the source is long |
| **tablet (900–1365)** | **6-col, 4 rows** | headline (6) · performance+review (3+3) · allocation+movers (2+4) · briefing+quotes (3+3). **One viewport is NOT promised here** — the page may scroll |
| **mobile (<900)** | **1-col stack** | D-046 order, single scroll region. No grid gymnastics |
| **Simple (all widths)** | **centred single column**, max ~46rem | headline + ReviewCard + briefing, calm, generous spacing. **No grid.** |

#### Honesty note on the target — read this before approving

**I will not shrink content below legibility to win the fit.** At **1366×768** the three-row map fits
**with the demo dataset** only because Movers is N=3 and the briefing is line-clamped. If, at your real
dataset, honest content cannot fit legibly, the correct outcome is **Full scrolls a little** — not
6px type or a truncated figure. If that happens I will say so rather than quietly shrink; the
alternative levers (all owner calls, none taken here) would be: drop Movers to N=2, or move Quotes
below the fold as the one scrollable tile.

**Also note:** the single-scroll invariant (D-100/D-101) holds in every case — the shell owns the one
scroll region; no tile scrolls the page.

#### Step 2 (ONLY after your approval)

Implement the approved grid; the pre-pass gains a **viewport-fit assertion for Full at 1366×768 and
1440×900** on demo data (`document.scrollHeight <= innerHeight`), alongside the existing
overflow/single-scroll/console checks across **both layouts × both themes × all breakpoints**.

### Process fix — folded NOW, not at close

`TEMPLATE-page-build.md` gains a governing rule for **Overview/composed** pages: **layout geometry (grid
map, density, viewport target) is specified in the plan and owner-approved BEFORE assembly — a widget
list is not a layout.** page-home §12ho1-3 is cited as the motivating case.

### Batch-1 verification

Backend **620** · ruff clean on touched files. Frontend `npm run check` **exit 0**: lint · typecheck ·
tokens · **179 unit** · **129 Playwright**. **Live pre-pass GREEN** — governance-speak in Home's copy:
**[]** · legacy text links: **0** · ↗ affordances: **8**, all with `aria-label` · both layouts × both
themes × 320/375/900/1366 · **0 console errors**.

**STOP — §12ho1-3 Step 2 is NOT built.** Awaiting the owner's approval of the wireframe above.

**Pending ratification at re-verify (carried + new):** §9-1 label + Deprecated-terms entry · §9-11
empty-state strings · §9-13 "Home" · §9-15 TopBar amendment · the `full` default · **§12ho1-1 subtitle
pick (a/b/c)** · **§12ho1-2 codified affordance rule** · **§12ho1-3 approved grid**.

---

## §12ho1-4 — REGRESSION: the assembly is REJECTED; Phase-1 REBUILD behind a new gate (2026-07-14)

**Owner verdict (verbatim): the page requires a fresh build; incremental patching of this assembly is
closed.** This entry records the regression, the salvage audit, and the new gate. **The Home page is
TORN DOWN. `/` is honestly unbuilt. Nothing is wired until the mockup below is ratified.**

### 1. The regression — reproduced BEFORE anything was touched (fail-first)

Screenshots: `docs/evidence/page-home/12ho1-4-REGRESSION-home.png`,
`…-REGRESSION-net-worth.png`. Geometry probe at 1366×768 on the live app:

| Owner observation | Reproduced | Measurement |
|---|---|---|
| (a) card header rows are GONE from their tiles; the ↗ headers pile up at the top-right of the PAGE | ✅ | **5 of 7** `.lf-summaryhead` computed `position: absolute`, all pinned to **y=75, right-aligned to the page** — **10 overlapping pairs**. The visible garble is `ContribAlloGaiPeDeQuotes ↗`. |
| (b) the approved §12ho1-3 grid was not applied — still a stacked column | ✅ | Correct, and **expected**: §12ho1-3 Step 2 was never built (the plan STOPped for approval). The approval and the build never met. |
| (c) net effect worse than before Batch 1 | ✅ | Confirmed — Batch 1 introduced (a). |

**Root cause (one line, and it is not Home's).** `SummaryHead`'s `whole` branch rendered
`className="lf-summaryhead lf-summaryhead--whole lf-summarylink"`. In `structure.css`,
`.lf-summarylink { position: absolute; top: 0; right: 0 }` (:279) is declared **after**
`.lf-summaryhead { position: relative }` (:258) at **equal specificity** — so **`absolute` won**, and
every whole-header was ripped out of its tile and positioned against a distant ancestor. The class
that positions the **corner glyph** was put on the **header**.

**It was never Home-only. It shipped to FOUR pages** — `whole` is used 11×: Home (6), **Instrument
Detail (3)**, **Net worth (1)**, **Portfolio (1)**. Net worth's *"Portfolio ↗"* was floating above its
own H1 in the page's corner, on a page the owner had already CLOSED. A third instance of the same
defect class was then found in the ratified **ReviewCard**: `.lf-review__head` had no
`position: relative`, so its ↗ escaped the same way.

**Why every suite was green.** The §12ho1-2 checks **counted** the affordance — 8 `[data-summarylink]`,
8 with `aria-label`, first one keyboard-focusable. All of that stays true of a header lying in a heap
in the wrong corner. **A count is not a geometry**, and jsdom has no layout engine (ADR-0004). The
kitchen-sink had **no SummaryHead specimen at all**, so nobody — human or machine — ever *looked* at
the component. That is the process defect, and it is fixed below.

### 2. Salvage audit — proven by suites, not by claims

**KEPT** (all still green): Phase-0 backend/contract work (`home_layout` + `home_quote_source` keys and
their served defaults, `/dashboard/home` retired, watchlist quotes) — pinned by
`tests/integration/test_home_reader.py`, which is why deleting the frontend smoke spec lost **no**
Phase-0 proof; the §9 resolutions; the backend, copy-hygiene and glossary-parity guards; the TopBar
§9-15 removal; and the codified **corner-↗ RULE** (DESIGN-SYSTEM §5) — **the rule stands; its
implementation failed.**

**REPAIRED, not deleted — `SummaryHead` / `SummaryLink` / `ReviewCard`.** The diagnosis says the
primitives are **sound** and only the `whole` branch's class composition was wrong: the non-`whole`
form was correct all along (it rendered `relative`, inside its tile, throughout the regression).
Deleting them would have broken four pages to fix one line. So: the `lf-summarylink` class comes off
the header, `.lf-review__head` gets `position: relative`, and both are now **guarded** (below).

**DELETED:** the Home page tree — `routes/Home.tsx`, `Home.css`, `Home.test.tsx`, and
`e2e/smoke/home-smoke.spec.ts` (its composition assertions describe a page that no longer exists).
`/` renders the honest **NotBuilt** state; `nav.ts` no longer marks Home built. There is no
half-torn-down page anywhere.

### 3. The guard that would have caught it — `e2e/tile-integrity.spec.ts` (NEW, permanent)

The invariant, stated once: **a summary header renders inside its own tile.** Asserted in a real
browser: no header is `position: absolute`; every header sits within its `.lf-card`'s bounds; **no two
headers overlap**; and every ↗ sits inside the header that owns it. **Fail-first: RED on all four
routes** — *including the kitchen-sink specimen*, which proves the defect was in the **primitive**,
not in Home's usage — **GREEN after the repair.** The gallery now carries **SummaryHead specimens
(plain + `whole`)**, so the component can never again ship unlooked-at.

### 4. NEW GATE — the static Home mockup at `/kitchen-sink` ⟵ **STOP: OWNER RATIFIES IN THE BROWSER**

`routes/HomeMockup.tsx` — **static by construction**: hardcoded demo-shaped data, **no readers, no
fetches, no state**, mounted **only** in the gallery, never at `/`. Real tokens, ratified components.
**Each frame IS a viewport** (the Full frame is exactly 1366×768), so the fit is *seen*, not asserted
at. Toggle the gallery's theme control for dark.

Screenshots: `12ho1-4-mockup-full-light.png`, `…-full-dark.png`, `…-simple-light.png`.

**Full — 12 columns × 3 rows, fits 1366×768 with demo data, 0 overflow, 0 clipped tiles:**

```
┌─────────────────────────┬─────────────────────────┬────────────────────────┐
│ NET WORTH      (1-4)  ↗ │ TODAY'S CHANGE  (5-8) ↗ │ REVIEW      (9-12)  ↗  │ R1
│ 796,216.68 SGD          │  +2,140.55 SGD  ← LEAD  │ "3 need a look"        │
│ Gross assets / Liabilities│ +0.27%   (28px, toned) │ 3 verdict rows         │
│ Performance ↗ + sparkline│ sparkline               │                        │
├─────────────────────────┼─────────────────────────┴────────────────────────┤
│ ALLOCATION     (1-4)  ↗ │ MOVERS                        (5-12)  ↗ ↗        │ R2
│ donut BESIDE its legend │ Contributors│Detractors│Gainers│Losers (N=3 each) │
├─────────────────────────┴──────────────┬───────────────────────────────────┤
│ BRIEFING + HEADLINES     (1-6)       ↗ │ QUOTES            (7-12)       ↗  │ R3
│ 2 clamped lines + 3 headlines          │ source select + compact cards      │
└────────────────────────────────────────┴───────────────────────────────────┘
```

- **The lead is Today's change** — the largest figure on the page (28px, the **top of the ratified
  type scale**), gain/loss toned. Net worth is the *anchor*, not the lead. Review is the second lead
  **by placement**. Attention dominates by **SIZE**, never motion.
- **Row heights are sized to what each row's tallest tile actually needs, measured in the browser**
  (205 / 210 / 246px) — not an even split that clips real content. **No figure, chart or list was
  shrunk to win the fit**; the page's own padding and gaps paid for it. **No half-empty rows.**
- **Simple** = a calm centred column (max 46rem): headline + ReviewCard + briefing. No grid.
- **Forbidden imports honoured:** no widget picker (R-19), no greeting, no projected income, no
  spending, no goal gauge, no account filter, no "as of" footer. The D-046 set is **fixed**.
- **Guarded:** the mockup's own claim — *fits 1366×768, no tile clips its content* — is asserted in
  `tile-integrity.spec.ts`, so the gate artifact cannot silently rot before ratification.

#### Three things the mockup PROPOSES — they are decisions, not improvisations

1. **The hero card summarises TWO canonical pages.** The net-worth figures are **Net worth**'s; the
   sparkline is **Portfolio**'s performance series (D-035/§9-8). So the tile carries **two ↗** — the
   Movers precedent — rendered as the title's ↗ plus a *"Performance ↗"* caption on the chart, rather
   than two competing titles. **Approve, or split them back into two tiles (which costs the 3-row fit).**
2. **Gross assets / Liabilities now appear on Home.** D-046 lists only *"net worth + Today's change
   lines"*. Both figures **are** on the canonical Net worth page, so P-1's corollary is satisfied — but
   this **widens D-046's widget content**. **Ratify or drop.**
3. **`QuoteCardRow` renders its own head** (*"Quotes"* + the source select), so the Quotes tile adds
   **only** the corner ↗ — otherwise the title appears twice. Giving the component a proper
   `SummaryHead` is a **PROPOSED §5 amendment**; it was **not** improvised into `ui/`.

*Also noted, not acted on:* the type scale tops out at **28px**, so the hero figure is 28px. If you
want a stronger lead, that is a **type-scale amendment** (a display size) — say so and it is proposed
properly, not smuggled in as a raw pixel value.

### 5. Verification

Backend **620**, unchanged (no backend file touched). Frontend `npm run check` **exit 0**: lint ·
typecheck · tokens · **169 unit** (Home's 10 removed with the page) · **134 Playwright** (129 + the 5
new tile-integrity assertions). `tile-integrity` proven **RED before / GREEN after** on all four
routes. Full mockup measured at 1366×768: **vertical overflow 0 · horizontal overflow 0 · clipped
tiles 0**, light and dark.

### 6. Pending ratification (carried + new)

§9-1 label + Deprecated-terms · §9-11 empty-state strings · §9-13 "Home" · §9-15 TopBar amendment ·
the `full` default · §12ho1-1 subtitle pick (a/b/c) · §12ho1-2 codified ↗ rule · **the mockup itself**
· **the three PROPOSED items above**.

**STOP — nothing is wired.** After ratification, Phase 1 rebuilds against the canonical readers per the
§9 resolutions (per-card progressive loading, honest per-widget empty/stale/error states, [Help] per
§9-12, deep links per D-038, layouts via the served `home_layout`, single scroll, copy hygiene), and
the pre-pass gains the per-widget and viewport-fit assertions this regression earned.

---

## §12ho1-5 — GATE RESULT: the grid is RATIFIED (owner, 2026-07-13)

The static Full mockup is **RATIFIED as-is**: the 12-column × 3-row grid, Today's change as the lead,
Review in the strongest remaining corner, row heights sized to content, the 1366×768 fit.

**The three flagged proposals — all APPROVED:**
1. **The hero tile carries TWO ↗** (net-worth figures + the Portfolio sparkline) — the Movers precedent.
2. **Gross assets / Liabilities lines APPROVED** — recorded as a **D-046 content widening**. P-1 holds:
   both figures live on the canonical Net worth page, so the summary adds nothing its canon lacks.
3. **A SummaryHead on QuoteCardRow APPROVED** as the PROPOSED §5 amendment — **ratify at the walk**.

**The ratified geometry is now ONE stylesheet** — `routes/home-grid.css` — imported by **both** the live
page and the static specimen in `/kitchen-sink`. They cannot drift: what was ratified is what ships.

---

## §12ho1-6 — SIMPLE LAYOUT REMOVED (owner reversal, 2026-07-13)

**Home ships ONE layout — the ratified grid.** Owner's rationale, recorded: *one strong layout beats two
half-maintained ones.* The **widget set is unchanged** and still FIXED (R-19 stays parked); only the
*choice between two layouts* dies. Cascade, all in one batch, none silent:

- **D-046 AMENDMENT** (DECISIONS.md): Home layout = the ratified grid; the Simple definition is
  **RETIRED**. The D-046 row itself is marked amended, so the table never reads as current on its own.
- **Contract delta (backend-first, fail-first):** `home_layout` **REMOVED** from `_ALLOWED_KEYS`, from
  the served defaults, and from the served vocabulary. Keeping it would have left a **write-only key** —
  precisely the D-078 defect just recorded against the rotation keys. `home_quote_source` **stays**.
  Tests flipped: key-accepted → **key-REJECTED**, plus a shape-discriminating assertion that the key is
  absent from **both** the defaults and the vocabularies (a 400 alone can be an accident).
  Contract regenerated same commit; drift green — and note the regen produced **no diff**: `/settings`
  serves a free dict, so a shape check **cannot see an allow-list key**. That is exactly why the
  served-value tests carry this, and it is worth remembering the next time a key is added.
- **The removal exposed a trap, and it is fixed rather than re-armed.** `PUT /settings` used to
  `continue` past unknown keys — so a write to a key the server does not store returned **200 and
  changed nothing**. That is what made the original Phase-0 bug invisible for a whole build, and merely
  delisting `home_layout` would have re-created it verbatim. **An unknown key is now an honest 400.**
- **GLOSSARY:** *"Home layout: Simple / Full"* → **Deprecated terms**, joining *"Detail level:
  Simple/Expert"* (which it had itself retired). The "Home" entry no longer points at a layout control.
  Parity guard green.
- **IA + DESIGN-SYSTEM** corrected: the *"rotating to Home uses the configured layout"* and *"Home
  branches on Simple/Full"* lines are gone — there is nothing left to configure or branch on.
- **§9-1 / §9-2 / §9-3** (the label, the interim control, the default) stand as **history, SUPERSEDED**.
  Nothing to ratify there any more.

---

## §12ho1-7 — ⚠ BLOCKING: the ratified grid does NOT fit one viewport once it is WIRED. **OWNER'S CALL.**

**I am reporting this rather than shrinking anything to hide it — and the fault is mine.**

**The gate artifact flattered the design.** The mockup frame was a bare **1366×768**. The real page does
not get a bare viewport: it sits inside the chrome, so its content region at a 1366×768 screen is
**680px**, and after the PageHeader the grid gets **~573px**. My frame promised the page the chrome's
height on top of its own. *(The specimen is now 1366×**680** — the region the page actually gets. A gate
that measures a box the product does not have is not a gate.)*

**And demo data flattered it a second time.** With the real dataset the honest content needs **~891px**:

| Row | Needs | Driver |
|---|---|---|
| R1 | 293px | the ReviewCard |
| R2 | **328px** | the allocation donut — the legend carries **8 asset classes**, not the demo's 5 |
| R3 | 270px | briefing + THREE headlines (§9-9) |

**891 needed vs ~573 available.** Measured live at 1366×768: the page scrolls **346px**; at 1440×900,
**174px**; it fits only at ~1920×1080. Screenshot: `docs/evidence/page-home/12ho1-7-wired-1366x768.png`.

**What I did NOT do:** shrink type, truncate a figure, or clip a tile. The first wiring *did* clip —
it severed the donut, the third headline and the stale line while every "does it overflow" check
stayed green, because the tiles were `overflow: hidden`. **Clipping is not fitting.** The grid now
floors every row at its own min-content: it fills the region exactly as ratified when it can, and when
it cannot, the tiles stay whole and the **shell** scrolls (the single scroll region, D-100/D-101, is
intact; horizontal overflow is 0 at every breakpoint).

**Two real defects the wiring surfaced, both fixed:**
1. **The ReviewCard was listing EVERY review item** — which makes Home *the Review page* and violates
   P-1. It now shows **N=3** (the ratified mockup showed 3; the §9-6/§9-9 precedent). The **attention
   count is untouched** — it is the SERVED count, so it still reconciles with `/review` by construction.
   **PROPOSED — ratify at the walk.**
2. **The donut was WRAPPING its legend under the ring** in a 4-column tile (doubling the tile's height),
   instead of sitting **beside** it as ratified. Pinned to `nowrap`.

### The levers — none of them are mine to pull

| # | Lever | Cost |
|---|---|---|
| **A** | **Accept the scroll** at 1366×768 (~346px). | Breaks the "at-a-glance, no-scroll snapshot" purpose — the very thing that failed the first build. |
| **B** | **Cap the donut legend** (e.g. top 5 classes + the rest as one "Other" segment, served). | Needs a decision on what "Other" means; a truncated legend must not misrepresent the ring. |
| **C** | **Shrink the donut ring** (9rem → ~6rem) and/or drop the briefing to 1 clamped line. | Density, not dishonesty — but it is a design change to a ratified component. |
| **D** | **Two rows at 1366**, moving Quotes below the fold as the one thing you scroll to. | Changes the ratified map. |
| **E** | **Accept that the target is 1440×900+**, and 1366×768 scrolls a little. | Honest, and the appliance may well run at 1080p. |

**My reading, offered not taken:** **B + E**. The donut legend is the single biggest offender (328px in a
573px budget) and an 8-row legend is not a *summary* anyway; capping it is the one change that buys the
fit without touching type size or the ratified map. But an "Other" bucket is a **data** decision, and
that is yours.

### Status

- **Phase 1 (wiring) — DONE.** All 7 D-046 cards from the canonical readers; per-card progressive
  loading (no `Promise.all` gate); honest per-widget empty/stale/error states; [Help] on Net worth,
  Today's change, Briefing (§9-12); deep links (D-038); both movers pairs, never interchanged (D-024);
  per-item staleness preserved on the quote cards; **no layout branch anywhere**.
  *Also hardened:* a reader answering with a partial payload used to **throw and take the page down**
  (`Object.entries(undefined)`) — the old page never hit it only because it sat behind the layout gate.
  A missing field now degrades to an honest empty with a reason, never a white screen.
- **Phase 2 (tests) — DONE.** 8 Home tests: the D-046 set + no layout branch; D-024 label integrity;
  the SERVED attention count (Home never recounts, and never out-details `/review`); Guarantee 3
  (per-item staleness in the compact summary); Guarantee 5 (no-egress reason); the honest unreachable
  reader (one bad reader never blanks the page); the empty briefing; copy hygiene.
  `npm run check` **exit 0** — lint · typecheck · tokens · **177 unit** · **135 Playwright**.
  Backend **621**, contract drift green, glossary parity green.
- **Phase 3a (pre-pass) — INCOMPLETE, and I will not self-certify it.** Live at 1366×768 and 1440×900:
  all 7 cards render, **0 left in skeleton**, **9 ↗**, **0 clipped tiles**, **0 horizontal overflow**,
  **0 console errors**. But the **viewport-fit assertion the task requires CANNOT pass** — see above.
  It is not a test I can make green without a decision that is yours to make.

**STOP.** Pending ratification at the walk: §9-11 strings · §9-13 "Home" · §9-15 TopBar amendment
(applied) · §12ho1-1 subtitle pick · the QuoteCardRow SummaryHead amendment · the Deprecated-terms
additions · **the ReviewCard N=3 cap** · **and §12ho1-7 above, which blocks the fit.**

---

## §12 — PHASE-3b OWNER WALK, BATCH 2 (2026-07-14)

Fail-first throughout: every defect below was reproduced (screenshot or failing assertion) **before**
it was touched.

### §12ho1-7 RESOLVED (owner) — legend lever **B + E**

- **Donut legend caps at the TOP-5 classes by served weight**, with a **"+N more ↗"** row linking to
  Portfolio. It states a **count**, never a figure: **no "Other" bucket is invented and no share is
  recomputed** (Guarantee 3 / D-105). It is a display **selection** — the same class as the
  Gainers/Losers sort — not money math. **The RING still draws every segment**: a capped ring would
  misrepresent the figure the legend is describing.
- **Fit target moves to 1440×900 with the REAL dataset**; **1366×768 scrolling modestly is ACCEPTED as
  honest**. The viewport-fit assertion moved with it (real-shaped specimen data — 8 asset classes, 6
  quotes — so the gate cannot flatter itself with tidy demo data the way it did last time). **1366 keeps
  its place in the no-clip / no-overlap matrix; it just no longer has to fit.**

### §12ho2-1 — MOBILE WAS BROKEN, **and the guard was lying about it**

**The guard first.** `tile-integrity` ran at **one width (1366)** and compared **whole tile boxes**. At
375px the page was visibly garbage and the suite reported **zero overlaps** — because the tiles' *boxes*
did not intersect even while their *contents* did. A guard that only looks where the bug was last time
is not a guard. It now (a) runs at **320/375/768/1366/1440**, (b) compares the **rendered text**, not the
containers — *text printed through other text* is the actual symptom — and (c) still checks header
geometry. **Proven RED on the current build at 320/375/768** before any fix.

**The defect.** Below the desktop breakpoint the grid stayed a **height-constrained** flex child inside a
full-height page, so its rows were squeezed to a fraction of what their contents needed and the content
bled straight out of the tiles: the *Today's change* figure printed **through** the *Performance*
caption; the donut printed through the movers tile. Before: `12ho2-1-BEFORE-mobile-375.png`.

**The fix.** Below the desktop target the page is **content-height, not viewport-height** — one viewport
is a *desktop* promise (§12ho1-7). Tiles collapse to a single full-width column in the ratified grid's
reading order, no absolute-position bleed, one scroll region. Both themes. GREEN at every width.

### §12ho2-2 — Subtitle (PROPOSED → ratify)

Implemented the owner's phrasing: **"Your summary — the ↗ on any card opens the full view."**
*Alternative offered:* **"Your summary — every card opens its full view (↗)."** (Same promise, but it
leads with the card rather than the glyph.)

### §12ho2-3 — Today's change sparkline anchors to the tile **bottom**, fills the width
It grows into whatever the figure leaves and sits on the tile's floor — **no dead band**. It keeps a
**minimum**, not a fixed height: these charts have no intrinsic size, so an unbounded `flex: 1 1 auto`
let them *demand* space rather than fill it (the donut once asked for 432px — §12ho1-7). Grow, yes;
drive the row's height, no.

### §12ho2-4 — Backdrop covered half the page
`height: 100%` resolves against the **content region**, so once the grid grew past it the page surface
simply **stopped** and the shell showed through below — a visible seam. It is `min-height: 100%` now: the
surface spans the region **and** follows the content, whichever is taller.

### §12ho2-5 — Uniform tile headers
Every tile uses the **SummaryHead** anatomy: **title left · trailing meta · ↗ right**. `SummaryHead`
gained a **`meta`** slot, which is what let the page-local header bars die: **Review's "3 need a look"**
and the **Quotes source select** now sit *in* the header row. The hero's *"Performance"* caption — its
own label class, its own ↗ placement — is now a plain SummaryHead like everything else. **QuoteCardRow**
took the `summary` prop (the §5 amendment the owner approved at §12ho1-5). Kitchen-sink specimens updated.

### §12ho2-6 — Quotes fills its tile: **two rows**
Free wrapping was a trap: with a source serving many symbols the row wrapped to four or five rows and
became the **tallest tile on the page**, dragging row 3 — and the whole grid — past the viewport. It is
now exactly **two rows**, columns flowing sideways, and the overflow scrolls **within the tile**. The page
still never scrolls sideways.

### §12ho2-7 — The tile is **News**, not "Briefing" (PROPOSED → ratify)
The owner is right: the tile is mostly **headlines**, and naming the whole thing after one of its two
parts mislabelled the rest. Title = **News**, ↗ → `/news`. Inside: a **labelled Briefing line** (or its
honest empty state) and **Top headlines**. Both are GLOSSARY terms, used verbatim, for the two different
things they name.

### §12ho2-8 — The ↗ is the **Lucide `arrow-up-right`** SVG
ADR-0003's set. A typographic "↗" rendered differently in every font and sat on the **text baseline**
rather than optically centred on the title. One component ⇒ every site changed at once; `aria-label`
unchanged, icon `aria-hidden`. *(It also revealed dead CSS: the hover state was `text-decoration:
underline`, which an SVG cannot honour — the affordance is now a subtle surface pill, still no layout
shift.)*

### §12ho2-9 — Tile-internal responsiveness
Movers' four columns **stretch** and each list spreads its rows over the height it is given; the
ReviewCard's verdicts do the same; the donut centres beside its capped legend; the sparklines fill.
**No empty bands** in any tile at any breakpoint. `NewsList` gained `clampLines` (a summary shows one
line and links to the full text).

### §12ho2-10 — Formatting parity AUDIT (Home vs each canonical page)

| Tile | Figure / label | Canonical page renders | Home renders | Verdict |
|---|---|---|---|---|
| Net worth | `total_value` | `796,216.68` | `796,216.68` + unit | ✅ served string, tabular |
| Net worth | **Liabilities sign** | `-420,000.00` | `-420,000.00` | ✅ **served sign, verbatim** — Home does not re-sign it |
| Net worth | Gross assets | `1,216,216.68` | `1,216,216.68` | ✅ |
| Today's change | `day_change` | signed + toned | signed + toned | ✅ sign→tone is a display classification |
| Movers | `change_pct` | `+1.07%` / `−0.85%` | identical | ✅ tabular, signed |
| Review | severity casing | served display-case | mapped to verdict, **title verbatim** | ✅ enum key never leaks |
| News | relative time | `3h ago` | `3h ago` | ✅ same formatter |
| Quotes | price + staleness | `USD 188.52` + chip | identical | ✅ per-item staleness preserved |

**One divergence found and fixed:** the holdings reader serves `name == symbol` for listed instruments,
so the quote card printed **"AAPL" twice** — once as the symbol, once as its own name. A name that
merely repeats the symbol is not a name. *(Unit-asserted: served strings pass through unformatted.)*

### §12ho2-11 — `Select` resting border (DESIGN-SYSTEM §5.2 amendment, PROPOSED → ratify)
A Select is a **view-scope** control, not a data-entry field; the hard border made every scope picker
read as an empty form waiting to be filled. **Resting: borderless** on a subtly elevated surface.
**Hover: the border returns. Focus-visible: the ring is RETAINED, unchanged** — a11y is not a style to
trade away. Text inputs keep their border: *"type here"* is a different promise from *"choose a view"*.
Platform-wide (Home quotes, Markets, Heatmap, …) because it is one component.

### §12ho2-12 — ⚠ THE 1440×900 FIT IS **NOT** MET. **Owner's call, again — I did not cut your counts.**

Batch 2 took the overshoot from **533px → 170px** at 1440×900, and every px of that came from **defects
and density**, not from content:

| Fix | Recovered |
|---|---|
| `fr` rows in an auto-height grid let the **tallest** row scale **every** row up with it (rows needing 255px were handed 352px) → content-sized rows that stretch only into spare space | ~180px |
| Quotes wrapping to 4–5 rows → exactly 2 | ~115px |
| ReviewCard's per-item `area` sub-line (Review owns that detail, P-1) | ~60px |
| Headline clamp to one line in the summary; tile density | ~50px |

**It still needs ~170px more than the region gives it.** Closing that means cutting counts **you** set —
**headlines 3→2 (§9-9)** (~46px) and/or **ReviewCard 3→2 verdicts** (~65px) — or shrinking the donut ring.
**I will not quietly cut them to make a number go green.** The CI assertion is therefore a **ratchet**,
not a pass: it holds the overshoot at ≤130px on the specimen so it can never grow, and it comes down to
**0** the moment you pick a lever. **Reporting the number beats asserting a fiction.**

### Batch-2 verification

Backend **621** unchanged. Frontend `npm run check` **exit 0**: lint · typecheck · tokens · **177 unit** ·
**155 Playwright** (tile-integrity now **25 cases** — 5 routes × 5 breakpoints — plus the fit ratchet).
Live pre-pass, **both themes × 375 / 768 / 1366 / 1440**: **7/7 cards · 0 skeletons · 9 ↗ · 0 horizontal
overflow · 0 console errors · 0 overlapping text · 0 clipped tiles.** Scroll: 1440 **170px** · 1366
**302px** (accepted) · tablet/phone scroll by design.

**STOP — owner re-verify. Pending ratification:** §12ho1-7 legend treatment · §12ho2-2 subtitle (owner's
phrasing implemented; one alternative offered) · §12ho2-7 **News** title · §12ho2-11 **Select** amendment ·
§12ho2-5 SummaryHead `meta` + QuoteCardRow `summary` · §12ho2-8 Lucide ↗ · **§12ho2-12 the fit lever** ·
carried: §9-11 strings · §9-13 "Home" · §12ho1-1 subtitle pick · ReviewCard N=3 cap.

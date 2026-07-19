# INFORMATION-ARCHITECTURE.md — LedgerFrame v2

**Normative.** Every piece of information has ONE canonical page (CLAUDE.md hard
rule). This file records the principles, the page map, each page's canonical
ownership + summaries, the navigation spec, Home composition, and the full
feature-verdict appendix. Terms used here must match GLOSSARY.md exactly.

---

## 1. General IA principles (verbatim from DECISIONS.md)

The mechanism for the whole IA is **P-1** including its enforcement corollary
(D-031). The principles below are quoted verbatim from DECISIONS.md §"General
principles":

> - **P-1 (Canonical home + summaries).** Each piece of information has ONE
>   canonical page where it is authoritative and fully explained. Other pages
>   may show a summary produced by the same backend reader (never recomputed,
>   never a second code path) with a link to the canonical page. Home is
>   entirely composed of such summaries and owns nothing. Enforcement
>   corollary: **a summary widget may not add figures its canonical page does
>   not show.**
> - **P-2 (Answers, not ingredients).** Canonical home = where the answer is
>   explained, not where its ingredients are typed.
> - **P-3 (Scoped views are not duplicates).** Entity-scoped or
>   instrument-scoped views of a canonical reader are a filter, not a
>   duplicate.
> - **P-4 (Guessable groups).** Navigation group names must be guessable from
>   their contents.
> - **P-5 (Server-side exports).** All exports are server-side; the client
>   never generates files. (Inherits formula-injection sanitisation.)
> - **P-6 (One AI pipeline).** All AI surfaces ride the single
>   grounded+validated pipeline; no feature may ever add a direct model call.
> - **P-7 (Scope test).** The rebuild adds no new capabilities, but UI for
>   existing capabilities that decided features depend on is in scope.
>   (Entity CRUD D-065 and token UI D-069 pass this test.)
> - **P-8 (One path in, one path out).** One sanitised path in
>   (sanitise-at-ingest, D-075) and one validated path out (P-6); no feature
>   may bypass either.

**The Reports Pack exception (D-038, verbatim):**

> **Reports Pack = the one sanctioned duplication**: a print/export artifact
> composed from canonical readers, disclaimers preserved — not a page in the
> IA sense.

The Reports Pack is therefore excluded from the canonical-home discipline: it is
an artifact assembled from the canonical readers, not a page that owns or
re-derives anything (D-061).

**Deliberate honesty features are protected copy** (DECISIONS.md §0) and may not
be removed from the pages that carry them: the not-a-Sharpe disclaimer (D-030),
the real-vs-ETF-proxy badge (D-051), "reporting, never a trade instruction" on
Policy (D-055), contributions-don't-reduce-runway and 'once'-obligations-excluded
(D-057), honest-NULL trade-date FX with excluded-events count (D-020/D-076), the
insurance-cash-value **valued** exclusion lines (D-039/D-081), the visible AI-fallback signal
(D-070), and the normative validation contract (D-071).

---

## 2. Page map

Every page, its route, its nav group (D-043), and its one-line purpose. Groups
and order are fixed and match §3.

| Page | Route | Nav group | Purpose (one line) |
|------|-------|-----------|--------------------|
| **Home** | `/` | Overview | Summary dashboard composed entirely of linked summaries; owns nothing (P-1). |
| **Net worth** | `/net-worth` | Wealth | Canonical home for Net worth, Gross assets, Liabilities, net-worth trend, liquidity ladder, cash runway. |
| **Portfolio** | `/portfolio` | Wealth | Canonical home for investment analytics (Today's change, Unrealised/Realised P/L, Cost basis, Total return, allocation, performance, Contributors/Detractors). |
| **Holdings** | `/holdings` | Wealth | Management surface: add/edit/delete holdings, transactions, manual assets, imports. |
| **Accounts** | `/accounts` | Wealth | Manage accounts (institution, kind, currency, cost-basis method, entity) and Entity CRUD; rollups are linked summaries. |
| **Markets** | `/markets` | Markets | Canonical home for quotes, indices, market status, Gainers/Losers, watchlists. |
| **Heatmap** | `/heatmap` | Markets | Treemap visualisation of holdings on the house SVG chart layer. |
| **News** | `/news` | Markets | Canonical home for the briefing and grouped headlines. |
| **Review** | `/review` | Planning | Canonical home for review verdicts + attention; Mark-reviewed with history. |
| **Policy** | `/policy` | Planning | Canonical home for investment-policy intent and drift (computed live). |
| **Cash flow** | `/cash-flow` | Planning | Goals, Obligations, Contributions (renamed from "Planning", D-056; route matches page name per D-022). |
| **Scenarios** | `/scenarios` | Planning | Deterministic what-if shocks on today's values; a scenario, never a forecast. |
| **Insurance** | `/insurance` | Planning | Protection register; cash value excluded from Net worth. |
| **Estate** | `/estate` | Planning | Will/executor, contacts, document-readiness register; isolated, no FKs. |
| **Reports** | `/reports` | Reports | Statements, Realised P/L report, tax lots; server-side exports. |
| **Pricing Health** | `/pricing-health` | Reports | Canonical home for provenance, confidence, and routing diagnostics. |
| **Settings** | `/settings` | System | Configuration across ~~4~~ ~~5~~ **6** tabs *(General · Appearance · Privacy · **Data feeds** · **AI** · System — D-069 amended 2026-07-18, §14st-1 Data feeds + §14st-2 AI)*, incl. Privacy and API-token cards. **Also the canonical home of the About card** (platform description · author · credits · links), inside the **System** tab — **no 7th tab** *(2026-07-19, page-help §9-bis-6: About moved off Help)*. |
| **Help** | `/help` | System | **Three-section help: Orientation · Pages (per-page usage detail) · Glossary; type-ahead search over help content.** *(Rewritten 2026-07-19, page-help §9-bis-1 — supersedes "pages + terms + guarantees".)* **About lives in Settings → System** (§9-bis-6). Help carries **pointers, never figures** — it is never a second home for any number. |
| **Legal** | `/legal` | System | License, disclaimer, Product Guarantees, no-jurisdiction-tax stance. |

**Not in the sidebar (reachable by link only):**

| Surface | Route | Reached from | Nature |
|---------|-------|--------------|--------|
| **Reports Pack** | `/reports/pack` | Reports only (D-041/D-061) | Sanctioned artifact, not an IA page (D-038). |
| **Instrument Detail** | `/instrument/:symbol` | any symbol link | Scoped view of Markets/News/Portfolio readers (P-3). |

---

## 3. Navigation spec

### Sidebar groups, fixed order (D-043)

Not user-reorderable; the nav-customization control is removed (D-043/D-069).
Group names are guessable from contents (P-4); "Stewardship" was rejected.

1. **Overview** — Home
2. **Wealth** — Net worth · Portfolio · Holdings · Accounts
3. **Markets** — Markets · Heatmap · News
4. **Planning** — Review · Policy · Cash flow · Scenarios · Insurance · Estate
5. **Reports** — Reports · Pricing Health
6. **System** — Settings · Help · Legal

Reports and Pricing Health enter the sidebar in v2 (previously orphaned, D-041).

### Sidebar responsive behaviour (D-102)

- **Laptop width and up:** the sidebar is **fixed and always visible**.
- **Below laptop width:** the sidebar is **off-canvas/collapsible**, opened by a
  **top-bar toggle** (part of the D-066 chrome).
- Only *visibility* is responsive. The six groups, their fixed order, and their
  non-reorderability (D-043) never change — narrow widths hide/reveal the same nav,
  they do not restructure it.

### Route dispositions (D-042 — deliberate asymmetry)

| Route | Disposition |
|-------|-------------|
| `/snapshot` | **Redirect → `/net-worth`**, kept for migration (D-022/D-042). |
| `/planning` | **Redirect → `/cash-flow`**, kept for migration — same rationale as `/snapshot` (D-022/D-056). |
| `/global` | **Removed, no legacy redirect** (D-042). |
| `/net-worth` | New canonical route; nav label = H1 = route (D-022). |
| `/cash-flow` | New canonical route for the Cash flow page; nav label = route (D-022 principle applied to the D-056 rename). |

### Rotation eligibility (D-044)

- **Any nav page is eligible.** The page set and interval are configured in
  Settings and **server-persisted** (settings rows, D-017/D-078) so kiosk
  behaviour survives a browser wipe. localStorage is not a store for rotation.
- The **top-bar rotation toggle stays** (D-044/D-066).
- **Rotation skips pages that error or are empty** (D-044).
- Rotating to Home just shows **Home** — there is **one layout** (D-046 AMENDMENT,
  page-home §12ho1-6), so there is no layout for rotation to configure. *(This line
  read "uses the configured Home layout" while two layouts existed.)*

---

## 4. Home composition (D-046 / D-047)

Home owns nothing; every widget is a summary produced by the canonical page's
reader, linked to that page (P-1). A summary widget may not add figures its
canonical page does not show (enforcement corollary).

**Full layout** — the fixed set of linked summary widgets (D-046):

| Widget | Canonical page (reader reused) |
|--------|-------------------------------|
| Net worth + Today's change lines | Net worth / Portfolio headline readers |
| Performance sparkline | Portfolio performance reader (D-035) |
| One allocation donut | Portfolio allocation reader (D-033) |
| Contributors/Detractors summary | Portfolio movers reader (D-034) |
| Gainers/Losers summary | Markets movers reader (D-034) |
| ReviewCard | Review centre reader (D-038) |
| Briefing summary + top headlines | News reader (D-037) |
| Compact quote cards (one row, source select) | Markets quotes reader (D-037/D-052) |
| **Ticker strip** | Markets quotes reader — ~~**Full layout only** (D-047)~~ **global chrome footer, every page** *(struck 2026-07-18, ruling (f): superseded by the **D-047 AMENDMENT** — the ticker is the always-visible shell footer; see the amendment note below and page-chrome §11-17)* |

~~**Simple layout** (D-046): headline + ReviewCard + briefing only.~~
*(**Struck 2026-07-18** (page-settings milestone close, ruling (f)): superseded by
the **D-046 AMENDMENT** — the Simple layout was **RETIRED**; Home has **ONE**
composition, the ratified grid, and no layout to switch between. Original
preserved above. See page-home §12ho1-6 and the amendment note below.)*

**Dropped from Home** (D-046): the top-holdings widget; the three separate market
rows (world indices / your markets / watchlist+FX) — replaced by the single
compact quote-card row.

**Ticker strip (D-047 — AMENDED, PROPOSED, page-chrome §11-17):** promoted from
Home-Full-only to the **global chrome FOOTER** — a fixed, always-visible strip at the
bottom of the shell on **every page and width** (wall-appliance identity, everywhere).
Shows the user's holdings + world indices (both from the frozen contract:
`/portfolio/holdings` + `/markets/global`). Staleness stays flagged per item; the
marquee halts under reduced motion (then static + manually scrollable); it is hidden
entirely under lock (D-002). **Home Full no longer duplicates it in-page.**

**There is no Home-layout control** (D-046 AMENDMENT, page-home §12ho1-6): the
**Simple** layout was removed, so Home has ONE composition — the ratified grid — and
nothing to switch between. The top-bar Detail toggle was already removed (page-home
§9-15), and the `home_layout` setting is retired from the contract rather than left as
a write-only key (D-078). *(D-040 scoped a Detail level to Home; nothing branches now.)*

---

## 5. Per-page canonical ownership

For each page: **Owns** (canonical, authoritative, fully explained here) ·
**Summarises** (other pages' info, via the named reader, linked — never
recomputed) · **Links**. Reader names follow DECISIONS.md and the audit; a
summary reuses the canonical page's reader, never a second code path.

### Net worth (`/net-worth`) — D-032, D-033, D-036, D-054

- **Owns:** Net worth, Gross assets, Liabilities (D-032); net-worth trend;
  liquidity ladder; cash runway (D-036); the **composition-by-class table**
  (itemised statement incl. liabilities — explicitly *not* a duplicate of
  Portfolio allocation weight, D-033); the insurance-cash-value **valued**
  exclusion line ("Insurance cash value (excluded): «amount» — see Insurance",
  D-039/D-081) — the value is shown but **excluded from the headline Net worth
  total**.
- **KPI strip:** Net worth / Gross assets / Liabilities / Cash & deposits (D-054).
  The **composition donut is dropped** (D-054).
- **Summarises:** Portfolio headline (Today's change etc.) with link (D-032);
  linked performance sparkline via Portfolio's performance reader (D-035);
  ReviewCard via Review reader (D-038).
- **Links:** "edit obligations" → Cash flow (D-036); Insurance (exclusion line).

### Portfolio (`/portfolio`) — D-032, D-033, D-034, D-035, D-048

- **Owns:** Today's change, Unrealised P/L, Realised P/L, Cost basis, Total
  return (stat rail, D-032); Allocation by class / sector / currency / **tag**
  (donuts, D-033/D-048) — the sector donut carries an explicit **"Not
  sector-classified (non-equity)"** bucket for `sector = null` holdings (D-082);
  Contributors / Detractors (D-034); the performance
  chart with benchmark picker + stats (these live **only** here, D-035);
  Concentration / Largest position / Top-5 / HHI; KeyStats; Attribution (with
  residual); the **Costs** card (recorded fees vs Ongoing cost, **never
  blended**, D-048); the not-a-Sharpe disclaimer (protected, D-030).
- **Summarises:** Net worth headline with link (D-032).
- **Links:** Holdings ("manage") ↔ Portfolio ("analytics") both ways (D-023).

### Holdings (`/holdings`) — D-023, D-049, D-050

- **Owns:** the management surface — add/edit/delete holdings; transactions
  ledger; manual assets. Instrument picker replaces free-text symbol (D-012);
  merger type in the txn form (D-019); **all vocab from `/refdata`** (the
  6-value `TXN_ASSET_CLASSES` subset dies); import **preview→commit** with an
  **unresolved-symbol review queue**; soft-delete + 10s undo + purge-deleted
  [PIN]. **AddAssetWizard folds into one Add flow** (branch: listed instrument
  vs manual asset; per-type meta whitelisted).
- **CSV export:** merged into server-side `/portfolio/holdings.csv` (P-5, D-050);
  the client never generates the file.
- **Summarises:** the value/positions header shows the **Net worth** headline — a P-1 summary of
  the **single authoritative reader `value_portfolio`** (served by `GET /portfolio/summary`; the
  header reads `total_value`, which is **net of liabilities** = Net worth), **linked, never a second
  computation**. It **links to both Net worth and Portfolio** (page-portfolio ND-2, verified
  2026-07-11). Portfolio summarises the same `value_portfolio` net total as "Net worth" — one reader,
  no divergent code path.
- **Links:** Net worth + Portfolio (from the headline); Pricing Health; InstrumentDetail per row.

### Accounts (`/accounts`) — D-064, D-065

- **Owns:** account CRUD — name, **institution from the Institution master**,
  **kind from `/refdata`**, currency, the **cost-basis method selector**
  (fifo/average, D-018), **entity assignment on the account form** (D-064);
  the **Entity CRUD** card (name + kind from vocab; delete blocked while
  accounts reference the entity, D-065).
- **Summarises:** account rollups (value, holdings count, classes, currencies,
  stale/low-confidence counts) are P-1 summaries of the holdings/value reader,
  linked (D-064).

### Markets (`/markets`) — D-034, D-037, D-051, D-052

- **Owns:** quotes, indices, market status (D-037); **Gainers/Losers** (D-034);
  region tabs; symbol search; instrument grid; the Global tab; the
  **real-vs-ETF-proxy badge** (protected honesty feature, D-051); **watchlist
  management** (create/delete lists, add/remove items — management lives only
  here, D-052).
- **Dropped:** region-news blocks → **link to News region groups** (D-051).
- **Summarises:** —.
- **Links:** News (region groups); InstrumentDetail (scoped quote/news, P-3).

### Heatmap (`/heatmap`) — D-053

- **Owns:** nothing canonical — a treemap **visualisation** of holdings.
- **Implementation:** rebuilt on the house SVG chart layer (squarified
  algorithm), **dropping ECharts**. Escape hatch: if parity isn't reached within
  the plan-file scope, fall back to ECharts with an ADR documenting the
  single-dependency exception (D-053).

### News (`/news`) — D-037, D-068

- **Owns:** the **briefing** (deterministic template + optional validated
  narration; model may add no numbers) and **grouped headlines** by area; My
  holdings ranked by relevance; manual refresh (D-037/D-068). Briefing is
  worker-refreshed and canonical here (D-068).
- **Summarises:** —.
- **Note:** per-instrument news is a P-3 scoped view on InstrumentDetail (D-037).

### Review (`/review`) — D-038, D-059

- **Owns:** section verdicts + attention list; **Mark-reviewed** (records
  `ReviewLog` with note + next review date); review history. Signal thresholds
  are enumerated in the Review spec as **named constants, each with a one-line
  rationale** (D-059); per-signal try/except resilience preserved. Defaults are
  owner-set (D-084): `_RUNWAY_LOW_MONTHS = 3`, `_GOAL_SOON_DAYS = 180`, the rest
  as audited; the `_OTHER_CLASS_OVERUSE_PCT = 10%` over-use signal is added
  (D-087). Full table in PRODUCT-SPEC §5; user-configurable thresholds are
  ROADMAP R-15 (D-084).
- **Summarises:** consumes runway (Net worth reader) and drift (Policy reader)
  via the same canonical readers the summaries use; provenance/confidence link
  to Pricing Health (D-038).

### Policy (`/policy`) — D-038, D-055

- **Owns:** investment-policy **intent** — target allocation per dimension
  (asset_class/currency/region), tolerance bands, optional concentration limit;
  **drift computed live, never stored** (D-055). `bucket` is a **select driven
  by the dimension's master** (D-055). "Reporting, never a trade instruction" is
  protected copy (D-055).
- **Summarises:** —. Drift is summarised *by* Review and the Reports Pack, not
  the reverse.

### Cash flow (`/cash-flow`) — D-036, D-056, D-057

- **Owns:** Goals, Obligations, Contributions (D-057). Protected semantics:
  **contributions don't reduce runway**; **'once' obligations are excluded from
  recurring burn** (D-057). Vocab/currency from the masters.
- **Summarises:** links to the **runway result on Net worth** (runway is
  canonical there, D-036), not a second runway computation.
- **Nav:** sits in the **Planning** group (D-056). The page label is "Cash flow";
  "Planning" survives only as the group name. Canonical route `/cash-flow`;
  `/planning` redirects (§3).

### Scenarios (`/scenarios`) — D-058

- **Owns:** the fixed shock set; exposures; liquidity what-ifs. "Scenario, never
  a forecast" preserved (D-058).
- **Summarises:** runway what-ifs consume the **canonical runway reader** (Net
  worth), not a private copy (D-036/D-058).
- **ROADMAP:** user-defined shocks, gated on a proper plan file (R-11, D-058).

### Insurance (`/insurance`) — D-039, D-062

- **Owns:** the protection register — policies, cover-by-type, upcoming
  renewals; **insurer from the Institution master**; **policy_type / frequency
  from `/refdata`**; the per-policy **documents checklist**. `insured_person` /
  `nominee` stay free text (names, not vocabulary). The net-worth exclusion is
  stated on-page (D-039/D-062).
- **Glossary tie:** the per-policy documents checklist ("do I hold this policy's
  papers") is distinct from Estate documents ("is my estate documentation in
  order") — D-062.

### Estate (`/estate`) — D-063

- **Owns:** will status / executor; contacts (**roles from `/refdata`**,
  relationship folded into roles); documents (**category / status from
  `/refdata`**); readiness counts. `related_to` stays **free text**; the
  **no-FK isolation invariant** is protected (D-063).

### Reports (`/reports`) — D-060

- **Owns:** statements (income / fees / cash flow / realised-vs-unrealised);
  the **Realised P/L report** — headings per D-026, **both** realised totals
  (current-FX caveated + trade-date-FX with excluded-events count); open tax
  lots; exports **server-side** (P-5). `long_term_days` stays a **neutral
  user-set threshold** (Product Guarantee 4). The "explain this report" AI
  helper rides the **P-6 pipeline only** (D-060).
- **Links:** Reports Pack (from Reports only, D-041/D-061).

### Reports Pack (`/reports/pack`) — D-038, D-061

- **Nature:** the one sanctioned duplication — a print-optimised artifact, not an
  IA page. Consolidated section (net-worth trend + review) then **per-entity
  sections** (P-3): net worth, drift, realised, risk + attribution. Composed
  **from canonical readers**, disclaimers preserved. Reachable from Reports only.

### Pricing Health (`/pricing-health`) — D-038, D-072

- **Owns:** per-holding provenance/confidence diagnostics — status chip
  (Fresh/Delayed/End-of-day/Cached/Manual/Estimated/Unavailable), confidence
  score+band, source + entitlement, the **routing chain per holding**
  (visibility yes, editability no — D-072), refresh + correct-source controls,
  identifier-duplicate banner, portfolio confidence card. Canonical home for
  provenance and confidence (D-038).

### Settings (`/settings`) — D-069

- **Owns:** configuration across ~~**4 tabs**~~ ~~**five tabs**~~ **six tabs** —
  **General · Appearance · Privacy · Data feeds · AI · System** *(D-069 amended
  2026-07-18 at the Settings Phase-3b walk + re-walk — amendment #1 (Data feeds),
  page-settings §14st-1; amendment #2 (AI tab), page-settings §14st-2)*. The
  **Data feeds** tab is the
  canonical home for **feed/provider configuration** — market data provider,
  provider API key (write-only, D-003), stale-after posture, and the **ND-6 news
  feeds** editor — that config being its own nature. The **AI** tab is the
  canonical home for the **read-only served AI-config line** (model management
  deferred to AI-surfaces, D-067/D-068); named **"AI", not "AI & Voice"** until
  R-32 is defined. **Auto-lock and Allow LAN are
  access controls, not feeds**, and stay on the **System** tab. Adds a **Privacy
  section** (no-egress
  toggle; "AI never persists" statement; privacy-mode indicator; **current
  egress state shown as a plain statement** — "This device makes no network
  calls" when enabled — state shown, not merely offered) and an **API-token
  management card** (create/name/revoke; token shown once; [S]-gated; passes
  P-7). Appearance gains density, loses persona. Nav-customization dies (D-043).
  The System tab **degrades gracefully without the sudo helper** (D-003/D-069).
- Setting persistence split per D-078 (per-device localStorage vs server rows).
- **⊕ 2026-07-19 (page-help §9-bis-6) — the System tab gains an About card.**
  Settings becomes the **canonical home** for the platform's self-description:
  brief description, author, credits, and links. It arrives as a **card inside
  the existing System tab — NOT a 7th tab**; the six-tab count above is
  unchanged. It moved here because Help was restructured into a three-section
  user journey (Orientation · Pages · Glossary) with no room for a fourth
  concern that was never help content in the first place. **Credits are
  reconciled against `docs/audit/LICENSES.md`** — a credits list that disagrees
  with the licence record is the page describing itself falsely, which is a
  release bar. Accepted-page touch: dated delta note in `page-settings.md` +
  a Settings pre-pass re-run.

### Instrument Detail (`/instrument/:symbol`) — D-037, D-068 (scoped view, P-3)

- **Nature:** a scoped view (filter) of canonical readers — quote/news scoped
  per P-3 (D-037); position if held; edit instrument
  (asset_class/listing_country/name/source_override); set ongoing cost; the
  "explain this instrument" explainer rides **P-6** (D-068). Not a canonical
  home for anything it shows.

### Global chrome (D-045, D-066)

- Sidebar per D-043; **StaleBanner kept**; **UpdateBanner respects no-egress**
  (no-egress enabled = zero outbound calls, version check and banner included);
  DemoBadge, theme cycle, clock kept; rotation toggle stays; the Detail toggle
  leaves the top bar (only Home branches on it, D-040/D-066).
- **PersonaOnboarding is killed** (D-045), replaced by a minimal **first-run
  checklist** against real settings: base currency, timezone, PIN, data
  provider, **and the no-egress toggle** — each step skippable, each linking to
  its Settings home. Density becomes a plain Settings→Appearance option.
- The **Ask panel** (D-067) rides P-6: SSE streaming, fact-pack shown before the
  answer, validated-before-display, ephemeral (D-016), privacy-mode label always
  visible.

---

## Appendix A — Feature verdicts (Batches 7–9, D-046..D-069)

Recorded so no killed/reshaped feature silently resurfaces. Verdicts verbatim
from DECISIONS.md §7.

| ID | Feature | Verdict |
|----|---------|---------|
| D-046 | Home | **SIMPLIFY** (fixed linked-summary set; ~~Simple/Full layouts~~ **ONE layout — D-046 AMENDMENT, struck 2026-07-18 ruling (f), page-home §12ho1-6**; drops top-holdings widget + 3 market rows) |
| D-047 | Ticker strip | **KEEP (scoped)** — ~~Home Full layout only~~ **global chrome footer — D-047 AMENDMENT, struck 2026-07-18 ruling (f), page-chrome §11-17** |
| D-048 | Portfolio page | **KEEP** |
| D-049 | Holdings + editor + add flow | **KEEP (reshaped)** — picker, merger, /refdata vocab, import review queue, one Add flow |
| D-050 | Holdings CSV export | **MERGE** → server-side `/portfolio/holdings.csv` |
| D-051 | Markets page | **SIMPLIFY** — drop region-news blocks; keep real-vs-ETF-proxy badge |
| D-052 | Watchlists | **KEEP** — management on Markets only |
| D-053 | Heatmap | **KEEP (re-implemented)** — house SVG squarified, drop ECharts (ADR escape hatch) |
| D-054 | Net worth page | **KEEP (reshaped)** — KPI strip; composition donut dropped |
| D-055 | Policy page | **KEEP** — bucket from master; drift live; protected copy |
| D-056 | Planning page | **KEEP, renamed Cash flow** |
| D-057 | Goals / Obligations / Contributions | **KEEP** — protected semantics |
| D-058 | Scenarios | **KEEP** — fixed shocks; ROADMAP user-defined shocks |
| D-059 | Review page | **KEEP** — named-constant thresholds |
| D-060 | Reports page | **KEEP (reshaped)** — D-026 headings; both realised totals; server-side exports |
| D-061 | Reports Pack | **KEEP** — sanctioned artifact |
| D-062 | Insurance page | **KEEP (reshaped)** — insurer/policy_type from masters; exclusion stated |
| D-063 | Estate page | **KEEP (reshaped)** — /refdata vocab; no-FK invariant |
| D-064 | Accounts page | **KEEP (reshaped)** — cost-basis selector + entity assignment here |
| D-065 | Entity CRUD | **KEEP (UI added)** — card on Accounts |
| D-066 | Global chrome | **KEEP (reshaped)** — sidebar/banners; UpdateBanner respects no-egress |
| D-067 | Ask panel | **KEEP** — P-6, ephemeral |
| D-068 | Briefing + instrument explainers | **KEEP** — deterministic + validated narration |
| D-069 | Settings | **KEEP (reshaped)** — Privacy + API-token cards; persona dies |

## Appendix B — Killed / dropped elsewhere (safeguard)

Not in Batches 7–9 but recorded here so they do not resurface via the IA:

| Item | Verdict | Decision |
|------|---------|----------|
| PersonaOnboarding | **KILLED** → first-run checklist | D-045 |
| `ProviderConfig` table | **DROP** (config in `.env`) | D-014 |
| `Note` table | **DROP** (per-record notes suffice; ROADMAP instrument notes) | D-015 |
| `AIConversation` / `AIMessage` | **DROP** — AI chat ephemeral | D-016 |
| `DashboardConfig` / `DashboardRotationItem` | **DROP** — rotation in settings rows | D-017 |
| `/global` route | **REMOVED**, no redirect | D-042 |
| Home top-holdings widget; 3 separate market rows | **DROPPED** | D-046 |
| Net worth composition donut | **DROPPED** | D-054 |
| Markets region-news blocks | **DROPPED** → link to News | D-051 |
| Global top-bar Simple/Expert as app-wide control | **REMOVED** (scoped to Home) | D-040 |
| Nav-customization control | **REMOVED** | D-043 |
| Frontend vocabulary copies (`refdata.ts`, `TXN_ASSET_CLASSES`, inline lists) | **RETIRED** | D-005/D-049 |

---

**Derived from:** `docs/audit/01-FEATURE-INVENTORY.md`, `docs/audit/06-UI-AND-TERMINOLOGY-AUDIT.md`
§(c) and §(d), and `docs/audit/DECISIONS.md`. Decision IDs applied: P-1..P-8,
D-005, D-012, D-014..D-020, D-022, D-023, D-026, D-030, D-031..D-069, D-072,
D-075, D-076, D-077, D-078, plus **Batch 12: D-081 (Net worth valued exclusion
line), D-082 (non-equity sector bucket), D-084 (owner-set review defaults),
D-087 (`other` over-use signal)**. Where the audit recommended a canonical home
(06 §c), DECISIONS.md's Batch-5 assignments (D-032..D-039) govern.

## Needs decision

- (none) — the Cash flow route is resolved: canonical **`/cash-flow`**, with
  **`/planning` redirecting** for migration, applying D-022's route-matches-page-name
  principle to the D-056 rename (same rationale as `/snapshot`→`/net-worth`).
  Recorded in §2, §3, and §5.

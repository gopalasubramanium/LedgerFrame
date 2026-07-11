# DECISIONS.md — LedgerFrame v2 Product Decisions

Status: **COMPLETE** — 12 batches, 88 decisions (D-001–D-088). All linkages closed
(L-1 → D-056, L-2 → D-076). Batch 12 (D-081–D-088) resolves the owner's
review-challenge round recorded in `docs/plans/REVIEW-GUIDE.md`.
Source audits: OPEN-QUESTIONS.md, 01–09 audit docs. This file is the authoritative
input for authoring MASTER-DATA.md, GLOSSARY.md, INFORMATION-ARCHITECTURE.md,
SECURITY-BASELINE.md, ROADMAP.md, and the ADRs named below. Claude Code acts on
this file with zero interpretation; anything not decided here goes to
docs/plans/CURRENT.md under "Needs decision".

---

## Product Guarantees (D-077 + accumulated)

Destined verbatim for the glossary guarantee block, the Legal page, and README:

1. **No trades.** LedgerFrame never places or executes trades. No order
   endpoints exist (Kite is market-data read-only).
2. **No advice.** Never gives buy/sell/hold, tax, or financial advice. Every
   AI answer ends with the fixed information-only disclaimer.
3. **No fabrication.** Never fabricates a price, headline, or figure.
   Insufficient inputs produce "—"/None with a reason, never a made-up number.
4. **No jurisdiction tax logic — ever** (D-077). `long_term_days` is a
   neutral user-set threshold with no jurisdiction presets. Statements and
   Realised P/L outputs are "for your accountant".
5. **No egress (opt-in)** (D-004). With the no-egress toggle enabled the
   device makes zero outbound network calls — version check, feeds, and
   banner included (D-066, D-075).
6. **No stored AI conversations** (D-016). AI questions and answers are
   never persisted.
7. **The validation contract never weakens** (D-071). Implementation may
   improve; the contract (below, §8) may not be loosened.

## General principles

- **P-1 (Canonical home + summaries).** Each piece of information has ONE
  canonical page where it is authoritative and fully explained. Other pages
  may show a summary produced by the same backend reader (never recomputed,
  never a second code path) with a link to the canonical page. Home is
  entirely composed of such summaries and owns nothing. Enforcement
  corollary: **a summary widget may not add figures its canonical page does
  not show.**
- **P-2 (Answers, not ingredients).** Canonical home = where the answer is
  explained, not where its ingredients are typed.
- **P-3 (Scoped views are not duplicates).** Entity-scoped or
  instrument-scoped views of a canonical reader are a filter, not a
  duplicate.
- **P-4 (Guessable groups).** Navigation group names must be guessable from
  their contents.
- **P-5 (Server-side exports).** All exports are server-side; the client
  never generates files. (Inherits formula-injection sanitisation.)
- **P-6 (One AI pipeline).** All AI surfaces ride the single
  grounded+validated pipeline; no feature may ever add a direct model call.
- **P-7 (Scope test).** The rebuild adds no new capabilities, but UI for
  existing capabilities that decided features depend on is in scope.
  (Entity CRUD D-065 and token UI D-069 pass this test.)
- **P-8 (One path in, one path out).** One sanitised path in
  (sanitise-at-ingest, D-075) and one validated path out (P-6); no feature
  may bypass either.

**Deliberate honesty features (protected — not removable copy):**
the "not a Sharpe ratio" disclaimer (D-030); the real-indices vs ETF-proxy
badge (D-051); "reporting, never a trade instruction" on Policy (D-055);
contributions-don't-reduce-runway and 'once'-obligations-excluded-from-burn
(D-057); honest-NULL trade-date FX with excluded-events count (D-020,
D-076); insurance-cash-value exclusion lines (D-039); the visible
AI-fallback signal (D-070); the normative validation contract (D-071).

**Architectural invariants:**
- Estate/insurance registers deliberately do NOT FK into portfolio tables;
  `estate_document.related_to` is free text by design. Protected from future
  schema "normalisation". (D-063)
- All money math is backend `decimal.Decimal`; the frontend never computes
  financial values. Downstream reports consume canonical readers
  (`value_portfolio`, `fifo_report`); they never re-derive money. (Carried
  from 04; reaffirmed by P-1.)
- A single shared datetime-normalisation utility handles all naive/aware
  UTC handling; the scattered per-module fixes (`_sort_ts`, `_naive`,
  `_carry_forward`) are retired. (D-080)

---

## 1. Deployment target & security posture

- **D-001 — Target exposure: single-user, local-first + optional LAN**
  (OQ 15). v2 core is a single-user local appliance: loopback bind by
  default, LAN opt-in requires a PIN. No TLS, CSRF tokens, or multi-user
  isolation in v2 core. ADR must record: (a) SaaS/PaaS hardening is
  explicitly out of scope for v2 core and will be handled in a future
  proprietary layer — v2 must not make choices that preclude that layer;
  (b) VPN/Tailscale is the sanctioned remote-access answer.
- **D-002 — PIN policy: numeric PIN, minimum 6 digits** (OQ 16). Argon2 +
  exponential lockout retained. SECURITY-BASELINE.md must state the PIN is
  an access lock, not data-at-rest protection — users rely on OS disk
  encryption. ROADMAP: optional passphrase mode (8–64 chars).
- **D-003 — Keep in-app `.env` writes and the sudo admin helper** (OQ 17).
  Guardrails retained: fixed action allow-list, never free-form shell,
  write-only key API (values never readable back), `.env` chmod 0600. The
  sudo helper is a documented **install-time opt-in**; the app degrades
  gracefully when absent (System controls hidden/disabled with explanation).
- **D-004 — 07 gaps disposition.**
  **Fix in v2:** #4 durable rate-limiter state (survives restart); #11
  hash-chained audit log (tamper-evidence); #12 dependency pinning + CVE
  scanning in CI; #14 assert CORS-credentials cannot ship in production
  builds; plus the **no-egress toggle** (Product Guarantee 5; surfaced in
  first-run per D-045; wired per D-066/D-069/D-075).
  **Explicitly accept, record in ADR:** #1 multi-user, #2 TLS/secure
  cookies, #3 CSRF token, #5 (per D-003), #6 (per D-002), #7
  no-PIN-open-local, #8 OS keyring, #9 heuristic AI validator (posture set
  by D-070/D-071), #13 restore-trusts-backup.

## 2. Master data

- **D-005 — Architecture: hybrid** (OQ 1). Fixed vocabularies = code-defined
  enums, served via a single `/refdata` endpoint, enforced with DB CHECK
  constraints. User-extensible masters = DB reference tables, FK-enforced.
  **The frontend carries zero local vocabulary copies** — `refdata.ts`,
  `policyTemplates.ts`, and all inline lists are retired. Rule: **every
  vocabulary (fixed or extensible) must have its complete seed value list
  enumerated in MASTER-DATA.md; no vocabulary is confirmed without values.**
- **D-006 — Currency master** with `is_base_eligible` flag
  (base/reporting-eligible subset vs. wider transaction-currency set).
  Governing rule: **a currency may exist in the master only if the FX
  service can translate it.** Seed values: EXTRACTION REQUIRED — union of
  `config.SUPPORTED_CURRENCIES` (9, base-eligible), `refdata.ts` CURRENCIES
  (14), PortfolioEditor inline list (22), validated against the rule.
  ROADMAP: user-requestable transaction currencies, FX-validated.
- **D-007 — `listing_country` (ISO-3166 alpha-2) is the single authoritative
  country field** (OQ 4). Drop `instruments.country` (free text) and
  `instruments.domicile_country`. Region derived: IN→India, SG→Singapore,
  US→US, else Global. ISO-3166 reference table seeds the picker. Migration:
  map legacy free-text values to ISO2 with a **manual review list for
  unmappables — no silent best-guess.** ROADMAP: domicile for fund-tax
  display.
- **D-008 — One user-extensible Institution master** (OQ 2), FK'd from
  `accounts.institution` and `insurance_policy.insurer`. Estate `related_to`
  stays free text (architectural invariant, §0).
- **D-009 — Instrument taxonomy.** `asset_class`: fixed enum (13 values,
  D-010). `asset_subclass`: fixed vocab (values EXTRACTION REQUIRED from
  code usage; at least `etf, reit, mutual_fund, derivative` — routing reads
  `derivative`). `liquidity_profile`: fixed enum (D-010). `sector`:
  user-extensible master, seeded GICS-like (seed list to be authored —
  see DEFERRED). **Drop `asset_category`**; migration moves surviving
  `asset_category` values into tags before the column drops.
- **D-010 — Fixed-vocabulary sweep confirmed.** All below are fixed
  vocabularies per D-005. EXTRACTION REQUIRED items must be copied verbatim
  from the named source before MASTER-DATA.md is written.
  - `TxnType` (11): `buy, sell, dividend, interest, deposit, withdrawal,
    fee, split, bonus, merger, transfer`. Frontend gains `merger`.
  - `AssetClass` (13): `equity, etf, mutual_fund, bond, cash, fixed_deposit,
    commodity, crypto, property, private, retirement, liability, other`.
  - `liquidity_profile` (5): `listed, redeemable, locked, illiquid, manual`.
  - `Entity.kind` (5): `self, spouse, trust, company, other`.
  - `Goal.basis` (3): `net_worth, liquid, none`.
  - `Obligation.recurrence` (4): `once, monthly, quarterly, annual`.
  - `Obligation.kind` (2): `expense, income`.
  - `Contribution.frequency` (4): `monthly, quarterly, annual, once`.
  - `Contribution.kind` (3): `invest, withdraw, prepay`.
  - `EstateProfile.will_status` (4): `none, draft, executed, needs_update`.
  - `EstateDocument.status` (3): `present, missing, outdated`.
  - `ValuationMethod` (9): `market_quote, official_nav, broker_quote,
    manual_valuation, statement_import, calculated_accrual, estimated_value,
    fx_reference, unavailable`. (All values retained in the enum per D-073;
    no v2 lane emits `calculated_accrual` or `statement_import`.)
  - `EntitlementStatus` (5): `real-time, delayed, end-of-day, cached,
    unavailable` (LedgerFrame never claims real-time).
  - `Account.kind`: EXTRACTION REQUIRED — `ACCOUNT_KINDS`,
    `app/services/accounts.py`.
  - `InsurancePolicy.policy_type` / `premium_frequency`: EXTRACTION
    REQUIRED — `POLICY_TYPES`, `FREQUENCIES` (insurance service, served by
    `/insurance/meta`).
  - `EstateDocument.category` / contact roles: EXTRACTION REQUIRED —
    `DOC_CATEGORIES`, `CONTACT_ROLES` (served by `/estate/meta`).
    **`estate_contact.relationship` is folded into the roles vocabulary**
    and the separate field dropped.
- **D-011 — Tag master: user-extensible, dedupe/rename** (rename cascades to
  all tagged holdings). Tag uniqueness is **case-insensitive**; migration
  includes a dedupe/merge pass for case and whitespace variants. Cap of 16
  tags/holding retained.
- **D-012 — Instrument picker replaces free-text symbol entry.** Typeahead
  over existing instruments + provider search; picking sets currency/asset
  class from the instrument. Explicit "create new instrument" path replaces
  silent auto-creation. **Bulk imports use the same resolution logic with a
  review queue for unresolved symbols — imports never silently auto-create
  instruments.** Also removes `_get_or_create_instrument` side effects from
  GET paths.
- **D-013 — IANA timezone select** replaces free-text timezone input.

## 3. Dead tables & schema-only features

- **D-014 — Drop `ProviderConfig`.** Provider config lives in `.env` (D-003).
- **D-015 — Drop `Note`.** Per-record note fields cover the need. ROADMAP:
  instrument notes.
- **D-016 — Drop `AIConversation`/`AIMessage`; AI chat is ephemeral**
  (OQ 13). Recorded as Product Guarantee 6 in SECURITY-BASELINE.md.
  ROADMAP: opt-in chat history.
- **D-017 — Drop `DashboardConfig`/`DashboardRotationItem`.** Rotation/focus
  config persisted server-side in settings rows only (kiosk behaviour must
  survive a browser wipe); v1's write-only allow-listed keys become
  read-back-and-consumed (reconciliation rule in D-078). localStorage is not
  a store for rotation config.
- **D-018 — Per-account cost-basis method selector (fifo/average)** (OQ 5).
  New accounts default to `fifo`; help text states the method is
  per-account. Changing method on an account with history triggers a
  holdings rebuild with a restatement warning (realised/unrealised figures
  will change). Selector lives on the account form (D-064). `spec`
  (specific-lot) → ROADMAP.
- **D-019 — Merger recording in the transaction form** (OQ 6). Fields:
  "Absorbed into" (instrument picker per D-012) and "Ratio", mapping to the
  existing schema (`related_instrument_id`; ratio in `price`). No schema
  change. ROADMAP: audit whether other corporate actions (spin-offs, symbol
  changes) need first-class recording; splits/bonuses already
  engine-covered.
- **D-020 — Trade-date FX: keep honest-NULL behaviour** (OQ 7). Same-day
  capture only; backdated trades show the secondary "trade-date FX" realised
  total with an excluded-events count. Historical backfill → ROADMAP (merged
  entry, see D-076).

## 4. Terminology (canonical term → retired synonyms)

- **D-021 — Two headline concepts** (OQ 10): **Net worth** = Gross assets −
  Liabilities (glossary states the formula explicitly); **Gross assets** =
  sum of positive holdings. Rule: **Net worth is the only headline total;
  Gross assets appears only as a labelled component.** Retired: "Total
  value", "Portfolio value".
- **D-022 — Page: Net worth.** Nav label = H1 = route `/net-worth`.
  `/snapshot` redirects during migration (D-042). Retired: "Snapshot".
- **D-023 — Portfolio = analytics page; Holdings = management page.** Each
  page's subtitle states the split; cross-links both ways.
- **D-024 — Two movers pairs.** **Gainers / Losers** for price-move lists;
  **Contributors / Detractors** for contribution-weighted lists. GLOSSARY.md
  defines both pairs and states which list type uses which. Retired: "Top
  movers" as a label.
- **D-025 — Today's change.** Retired from UI copy: "Today" (alone), "Day",
  "day_change".
- **D-026 — Realised P/L and Unrealised P/L** (symmetric). Report heading is
  "Realised P/L report". Retired: "Realised gain(s)" including headings,
  "Realised" (alone), "paper gain" (glossary may explain it as the
  colloquialism).
- **D-027 — Freshness structure confirmed:** **Entitlement** (grade a source
  claims: real-time/delayed/end-of-day/cached/unavailable) · **Stale**
  (cached older than threshold; flagged, never hidden) · **Status** (one-word
  Pricing Health chip: Fresh/Delayed/End-of-day/Cached/Manual/Estimated/
  Unavailable). Loose "as_of"/"delayed" usage outside these definitions
  retired.
- **D-028 — Source / Provider / Routing.** **Source** = user-facing
  provenance term (what owns this price). **Provider** = adapter/config
  concept, Settings only. **Routing/route** = internal + Pricing Health
  diagnostics only.
- **D-029 — Four confirms:** **Ongoing cost (expense ratio)** (retired as a
  figure label: "cost of ownership"; a card may be titled "Costs") ·
  Concentration terms stay distinct (Concentration, Largest position, Top-5,
  HHI — never interchanged) · **Entity** ("Household" is an entity name, not
  a term) · **Account** (name) + **Institution** (retired: "platform").
- **D-030 — Three confirms:** control label **"Detail level: Simple/Expert"**
  wherever the control appears (scope per D-040) · page/concept **Review**
  (retired as labels: "Review Centre", "Needs a look", "What needs
  attention"; "what needs a look" may survive as body copy) · **the
  not-a-Sharpe disclaimer is protected** (honesty list, §0).

## 5. Information architecture (item → canonical page)

- **D-031 — Mechanism = P-1**, including the enforcement corollary.
- **D-032 — Headline split.** **Net worth page** canonical for: Net worth,
  Gross assets, Liabilities. **Portfolio page** canonical for investment
  analytics figures: Today's change, Unrealised P/L, Realised P/L, Cost
  basis, Total return. Each page summarizes the other's headline with a
  link.
- **D-033 — Allocation canonical on Portfolio** (by class / sector /
  currency / tag). The Net worth page keeps its **composition-by-class
  table** — recorded explicitly: allocation weight (share of gross assets)
  and the net-worth composition table (itemised statement incl. liabilities)
  answer different questions and are not duplicates. Home: one summary
  donut, linked.
- **D-034 — Contributors/Detractors canonical on Portfolio;
  Gainers/Losers canonical on Markets.** Home shows one summary of each,
  linked.
- **D-035 — Performance chart canonical on Portfolio** (benchmark picker +
  stats live only there). Home and Net worth show linked sparkline
  summaries.
- **D-036 — Net-worth trend, liquidity ladder, cash runway: canonical on
  Net worth** (P-2). Scenarios/Review consume runway via the same reader as
  summaries. Cash flow page links to the runway result; Net worth page links
  to "edit obligations".
- **D-037 — News canonical for briefing + grouped headlines; Markets
  canonical for quotes/indices/market status.** Home: briefing summary + top
  headlines + compact quote cards, linked. InstrumentDetail news/quote =
  scoped view per P-3.
- **D-038 — Drift → Policy; Review/attention → Review; Provenance/confidence
  → Pricing Health.** Home/Net worth show ReviewCard as summary-with-link.
  **Reports Pack = the one sanctioned duplication**: a print/export artifact
  composed from canonical readers, disclaimers preserved — not a page in the
  IA sense.
- **D-039 — Insurance cash value stays excluded from Net worth** (OQ 12),
  permanently in v2. Stated visibly on the Insurance page **and** as a
  labelled line on the Net worth page ("Insurance cash value: not counted —
  see Insurance"). ROADMAP: opt-in inclusion.

## 6. Navigation & view modes

- **D-040 — Detail level scoped to Home** (OQ 8). Settings control "Home
  layout: Simple / Full"; global top-bar toggle removed. Rotation
  interaction: rotating to Home uses the configured Home layout — one
  setting, no special case. ROADMAP: app-wide detail level, gated on
  per-page specs.
- **D-041 — Reports and Pricing Health enter the sidebar** (OQ 9). Reports
  Pack stays reachable from Reports only (artifact per D-038).
- **D-042 — Route dispositions (deliberate asymmetry):** `/global` removed,
  no legacy redirect. `/snapshot` → `/net-worth` redirect kept for
  migration.
- **D-043 — Sidebar: grouped, fixed order** (not user-reorderable). Groups:
  **Overview** (Home) · **Wealth** (Net worth, Portfolio, Holdings,
  Accounts) · **Markets** (Markets, Heatmap, News) · **Planning** (Review,
  Policy, Cash flow, Scenarios, Insurance, Estate) · **Reports** (Reports,
  Pricing Health) · **System** (Settings, Help, Legal). Principle P-4
  applies; "Stewardship" rejected as a group name. Nav-customization control
  removed.
- **D-044 — Rotation kept, fully configurable.** Page set (any nav page
  eligible) + interval set in Settings, server-persisted (D-017); top-bar
  toggle stays. **Rotation skips pages that error or are empty.**
- **D-045 — PersonaOnboarding killed.** Replaced by a minimal first-run
  checklist against real settings: base currency, timezone, PIN, data
  provider, **and the no-egress toggle** (privacy posture is an explicit
  first-run choice) — each step skippable, each linking to its Settings
  home. Density becomes a plain Settings→Appearance option.

## 7. Features (verdicts)

| ID | Feature | Verdict | Notes |
|----|---------|---------|-------|
| D-046 | Home | SIMPLIFY | Fixed set of linked summary widgets: Net worth + Today's change lines, perf sparkline, one allocation donut, both movers summaries, ReviewCard, briefing summary + top headlines, compact quote cards (one row, source select). Dropped: top-holdings widget; the 3 separate market rows. Simple layout = headline + ReviewCard + briefing; Full = the set above. |
| D-047 | Ticker strip | KEEP (scoped) | **Home Full layout only** — never Simple, never other pages. Grounds: wall-appliance identity (D-017/D-040/D-044). |
| D-048 | Portfolio page | KEEP | Stat rail = D-032 analytics figures; donuts gain by-tag view; Contributors/Detractors labels; Costs card never blends recorded fees with ongoing cost; not-Sharpe disclaimer. |
| D-049 | Holdings + editor + add flow | KEEP (reshaped) | Instrument picker (D-012), merger type (D-019), all vocab from `/refdata` (the 6-value TXN_ASSET_CLASSES subset dies), import preview→commit + unresolved-symbol review queue, soft-delete + 10s undo + purge-deleted [PIN]. **AddAssetWizard folds into one Add flow** (branch: listed instrument vs manual asset; per-type meta kept, whitelisted). |
| D-050 | Holdings CSV export | MERGE | Into server-side `/portfolio/holdings.csv` (P-5). |
| D-051 | Markets page | SIMPLIFY | Keep region tabs, search, indices, Gainers/Losers, instrument grid, Global tab, real-vs-ETF-proxy badge (honesty feature, §0). **Drop region-news blocks** — link to News region groups. |
| D-052 | Watchlists | KEEP | Management on Markets only; Home shows watchlist quotes via source select; InstrumentDetail keeps add-to-watchlist. |
| D-053 | Heatmap | KEEP (re-implemented) | Rebuild treemap on the house SVG chart layer (squarified algorithm), **dropping ECharts**. Escape hatch: if parity isn't reached within the plan-file scope, fall back to ECharts with an ADR documenting the single-dependency exception. |
| D-054 | Net worth page | KEEP (reshaped) | KPI strip (Net worth / Gross assets / Liabilities / Cash & deposits), trend, composition table, liquidity ladder, runway, ReviewCard summary, insurance-exclusion line (D-039), linked perf sparkline. **Composition donut dropped.** |
| D-055 | Policy page | KEEP | `bucket` becomes a select driven by the dimension's master. Drift computed live, never stored. "Reporting, never a trade instruction" protected (§0). |
| D-056 | Planning page | KEEP, renamed **Cash flow** | Closes L-1. Nav group Planning = Review, Policy, Cash flow, Scenarios, Insurance, Estate. |
| D-057 | Goals / Obligations / Contributions | KEEP | Semantics protected (§0): contributions don't reduce runway; 'once' obligations excluded from burn. Vocab/currency from masters. |
| D-058 | Scenarios | KEEP | Fixed shock set; "scenario, never a forecast" preserved; runway what-ifs via canonical reader. ROADMAP: user-defined shocks (gated on a proper plan file). |
| D-059 | Review page | KEEP | Verdicts + attention + Mark-reviewed (ReviewLog) + history. Signal thresholds enumerated in spec as **named constants, each with a one-line rationale**. Per-signal try/except resilience preserved. |
| D-060 | Reports page | KEEP (reshaped) | Headings per D-026; both realised totals (current-FX caveated + trade-date-FX with excluded count); exports server-side; long-term-days stays a neutral user-set threshold (Product Guarantee 4); AI helper rides P-6 pipeline only. |
| D-061 | Reports Pack | KEEP | Sanctioned artifact (D-038): consolidated + per-entity sections (P-3), print-optimised, composed from canonical readers, disclaimers preserved, reachable from Reports only. |
| D-062 | Insurance page | KEEP (reshaped) | Insurer from Institution master; policy_type/frequency from `/refdata`; net-worth exclusion stated on-page; `insured_person`/`nominee` stay free text (names, not vocabulary). Glossary distinguishes the per-policy documents checklist ("do I hold this policy's papers") from Estate documents ("is my estate documentation in order"). |
| D-063 | Estate page | KEEP (reshaped) | Roles/category/statuses from `/refdata`; relationship folded into roles; `related_to` free text; **no-FK isolation invariant** (§0). |
| D-064 | Accounts page | KEEP (reshaped) | Institution from master; kind from `/refdata`; **cost-basis method selector here** (D-018); **entity assignment on the account form**; rollups are P-1 summaries, linked. |
| D-065 | Entity CRUD | KEEP (UI added) | Minimal CRUD (name, kind from vocab) as a card on Accounts; delete blocked while accounts reference the entity. Passes P-7. |
| D-066 | Global chrome | KEEP (reshaped) | Detail toggle leaves top bar; rotation toggle stays; sidebar per D-043; StaleBanner kept; **UpdateBanner respects no-egress: no-egress enabled = zero outbound calls, version check and banner included**; DemoBadge, theme cycle, clock kept. |
| D-067 | Ask panel | KEEP | SSE streaming; fact-pack shown before answer (trust UX); validated-before-display; ephemeral (D-016); privacy-mode label always visible; P-6. |
| D-068 | Briefing + instrument explainers | KEEP | Deterministic template + optional validated narration (model may add no numbers); stored + worker-refreshed; canonical on News. Instrument explainer rides P-6. |
| D-069 | Settings | KEEP (reshaped) | 4 tabs. Adds: **Privacy section** (no-egress toggle, "AI never persists" statement, privacy-mode indicator, **current egress state shown as a plain statement — "This device makes no network calls" when enabled — state shown, not merely offered**); **API-token management card** (create/name/revoke, token shown once, [S]-gated; passes P-7). Appearance gains density, loses persona. Nav-customization dies (D-043). System tab degrades gracefully sans sudo helper (D-003). |

## 8. AI, providers & routing

- **D-070 — Validator strictness kept as-is** (OQ 14). False rejections are
  the accepted cost (fallback is a correct deterministic template). Add a
  **user-visible fallback signal**: "AI answer didn't pass grounding checks —
  showing facts directly." ROADMAP: revisit strictness only if fallback
  frequency proves high in practice.
- **D-071 — Validation contract is normative spec** (goes into
  SECURITY-BASELINE.md with protected status; Product Guarantee 7):
  model output is **buffered, never streamed raw**; every significant
  money/% number must trace to a fact; unknown tickers rejected;
  recommendation / real-time-claim / secret-like content rejected; failure →
  deterministic template; the same contract gates chat, briefing, and
  instrument explainers (P-6). **Implementation may improve; the contract
  may not weaken.**
- **D-072 — No user-editable provider priority** (OQ 18). Hard-coded lane
  chains + per-instrument `source_override` (validated) retained. Pricing
  Health shows the chain per holding — visibility yes, editability no.
  ROADMAP: per-lane priority editing only on demonstrated need.
- **D-073 — Bond / deposit / retirement lanes: manual is the honest,
  specified v2 behaviour** (OQ 19). Per-type meta (FD rate, coupon…) kept as
  **reference fields, not calculation inputs**. `calculated_accrual` and
  `statement_import` are removed from the lane chains but **retained in the
  ValuationMethod vocabulary** (no v2 lane emits them). ROADMAP (verbatim):
  "FD accrued-interest valuation — first post-v2 feature; plan file must
  cover day-count conventions, compounding variants, maturity handling, and
  provenance labelling of calculated values."
- **D-074 — `ecb_fx` is a translation-reference source only** (OQ 20).
  Never prices a holding; feeds FX conversion fallback only. Enforced in the
  router capability matrix (quote=✗) and recorded as spec.
- **D-075 — One cached feed reader.** Worker fetches RSS on the refresh
  interval into the `market_news` cache table; all endpoints read the cache;
  per-instrument news is a P-3 scoped view. `sanitize_untrusted` applied
  **once at ingest** (P-8), not per-read. Manual refresh button stays.
  No-egress ON = no feed fetches; cache served with honest staleness
  marking.

## 9. Reporting/tax & housekeeping

- **D-076 — Native-currency is the filing-grade output** (OQ 21; closes
  L-2). Base-currency realised totals remain explicitly indicative — both
  variants shown per D-060 with caveats preserved. ROADMAP (merged with
  D-020): "Historical FX series (enables trade-date backfill + per-date
  realised totals)."
- **D-077 — No jurisdiction tax logic, permanently** (OQ 22). Product
  Guarantee 4. `long_term_days` stays a neutral user-set threshold with no
  jurisdiction presets; statements/realised outputs are "for your
  accountant". Appears in the glossary guarantee block and Legal page.
- **D-078 — Settings persistence split by nature** (08 §2).
  **Per-device (localStorage):** theme, density, sidebar-collapsed,
  reduced-motion, high-contrast — properties of the display.
  **Server-persisted (settings rows):** Home layout (per D-040/D-044
  linkage — it defines what rotation shows), language, rotation/focus
  (D-017), and everything already server-side. Each setting's home is listed
  in the spec. **Hard requirement: the v1 write-only allow-list keys are
  reconciled — every allow-listed key is either consumed or removed.**
- **D-079 — Stray repo files removed** (OQ 23). The two session-transcript
  `.txt` files and `09-Jul-2026` leave the repo; gitignore patterns added
  for transcript/working-note artifacts. Content worth keeping belongs in
  spec files, not the root.
- **D-080 — Dead code confirmed deletable** (OQ 24): `verify_token()` (no
  callers), the commented-out `_carry_forward` duplicate, the no-op
  `account` fetch in `portfolio.py`. Spec requirement: v2 ships **one shared
  datetime-normalisation utility** addressing the naive/aware bug class
  (architectural invariant, §0).

---

## Batch 12 — Review-challenge resolutions (D-081–D-088)

Resolutions of the owner's review challenges recorded in
`docs/plans/REVIEW-GUIDE.md` (ATTENTION items A1–A11 and body §2.4/§2.9/§3.3/§4.1).
Each amends the spec(s) noted; Claude Code applies them with zero interpretation.

- **D-081 — Insurance cash value is a visible *valued* line on Net worth**
  (REVIEW-GUIDE A7/H7). **Amends D-039.** The Net worth page shows insurance
  cash value as a labelled line with its **actual value**, still **excluded from
  the headline Net worth total**. The prior "not counted" copy becomes a valued,
  excluded line — "Insurance cash value (excluded): «amount» — see Insurance."
  Exclusion from the headline and the on-Insurance statement are unchanged;
  opt-in *inclusion* stays parked (R-9). Specs: GLOSSARY, INFORMATION-ARCHITECTURE
  (Net worth Owns), PRODUCT-SPEC §4a.

- **D-082 — Non-equity `sector=null` shows an explicit bucket** (A3). The
  three-null migration (Crypto / Index-ETF / Commodities → `sector=null`, D-009)
  **stands**; `sector` stays null in data (no forced merge). Sector views
  (allocation-by-sector and sector rollups) **display an explicit
  "Unclassified sector" bucket** (**label amended 2026-07-11**, page-portfolio §12-4;
  was "Not sector-classified (non-equity)") rather than dropping null rows. The
  GLOSSARY definition keeps the truth: non-equity holdings **have no sector**, not a
  pending state. Served backend-side (`UNCLASSIFIED_SECTOR_LABEL`); contract untouched
  (label is data). Specs: MASTER-DATA §6, GLOSSARY (bucket label), INFORMATION-ARCHITECTURE
  (Portfolio allocation).

- **D-083 — Region derivation expanded to six buckets** (A10). The derived
  `region` vocabulary becomes **India / Singapore / US / Europe / APAC / Other**
  (was India / Singapore / US / Global). Region stays **derived from
  `listing_country`, never stored** (D-007 unchanged in that respect). A full
  membership table is authored in MASTER-DATA §4; any `listing_country` not
  listed falls to **Other** (catch-all). These six are the complete `region`
  policy-dimension bucket set. Specs: MASTER-DATA §4, GLOSSARY (Region).

- **D-084 — Review threshold defaults set by the owner** (A5/§2.9). Defaults are
  the audited values **except** `_RUNWAY_LOW_MONTHS = 3` (was 6) and
  `_GOAL_SOON_DAYS = 180` (was 90). All other constants keep their audited
  values. These two now **deliberately diverge from the legacy `review.py`
  values** — they are owner-set product defaults, not code-reconciled numbers;
  the divergence is intended and recorded so the audit trail stays honest.
  **ROADMAP: user-configurable review thresholds** (new R-15). Specs:
  PRODUCT-SPEC §5, INFORMATION-ARCHITECTURE (Review), REVIEW-GUIDE §2.9.

- **D-085 — Instrument classification guidance** (A1). Resolves etf/reit:
  **`asset_class` describes economic exposure; `asset_subclass` describes the
  wrapper.** A listed REIT may be **`asset_class = property` with
  `asset_subclass = reit`** (property exposure, listed-equity wrapper); likewise
  `etf`/`mutual_fund` are wrappers over whatever exposure the class states. The
  6-value subclass vocab (incl. PROPOSED `etf`/`reit`) **stands**; this guidance
  governs assignment. Specs: MASTER-DATA §2, GLOSSARY (Instrument).

- **D-086 — No annualized returns below a minimum-history threshold** (§2.4).
  Below a **named minimum-history constant**, performance surfaces show
  **cumulative (non-annualized) return only**; **no annualized figure**
  (annualized/CAGR-style return, 1Y trailing return/volatility) is displayed
  below the threshold. **XIRR appears from the minimum-history threshold
  upward**; below it XIRR stays "Not applicable" (extends the honest-NULL "None,
  not fabricated" invariant). The threshold is a named constant defined in the
  calculation engine (like the D-059 constants), not a value fabricated here.
  Specs: GLOSSARY (XIRR, Total return, 1-year return), PRODUCT-SPEC §4c,
  REVIEW-GUIDE §2.4.

- **D-087 — `other` retained as the honest escape valve + over-use signal**
  (A1/§4.1). `other` stays in the fixed vocabularies (asset_class, account kind,
  insurance policy_type, estate category, …) as the honest escape valve — never
  force a wrong specific value. **Adds a Review signal:
  `_OTHER_CLASS_OVERUSE_PCT = 10` (%)** — fires when `other`-classed holdings
  exceed ~10% of gross assets, prompting proper reclassification; wrapped in its
  own try/except like every Review signal (D-059). Specs: MASTER-DATA §2,
  PRODUCT-SPEC §5, INFORMATION-ARCHITECTURE (Review).

- **D-088 — ROADMAP restructured into a v2.1 "accounting precision" theme**
  (A9/R-8). **`spec` specific-lot cost basis (R-6), historical FX series (R-8),
  and FD accrued-interest valuation (R-14)** are bundled as the **v2.1
  "accounting precision"** theme — the first coherent post-v2 milestone, each
  still gated on its own plan file (R-14's day-count / compounding / maturity /
  provenance gate unchanged). Adds **R-15 user-configurable review thresholds**
  (from D-084). Specs: ROADMAP.md, REVIEW-GUIDE §6.

**Affirmed unchanged (no decision needed):** A2 (the 11 GICS sectors seed) and
REVIEW-GUIDE §3.3 (the v1 removals) were reviewed and accepted as written;
clarifying notes recorded in the guide.

---

## Holdings page-build addendum (D-089)

- **D-089 — Type-first Add flow** (owner, 2026-07-10; Holdings acceptance walk).
  The Add-to-holdings entry step becomes **type-first**: a **grid of asset-type
  tiles in user vocabulary** — *Stocks & ETFs, Mutual fund, Crypto, Cash, Fixed
  deposit, Bond, Property, Retirement, Private, Liability, Other* — each with a
  one-line plain-language subtitle. Choosing a tile **routes to the existing
  single D-049 Add flow** with the correct branch and per-type fields
  preselected. The **Listed/Manual mechanism tabs stop being the front door**
  (the mechanism becomes an implementation detail of routing); **the single flow
  underneath is unchanged**.
  - **Branch routing** (owner clarification, help copy): **Listed** = all
    provider-quoted assets — **equities, ETFs, crypto (CoinGecko), mutual funds
    (AMFI)**; **Manual** = manually-valued types — **property, FD, retirement,
    private, cash, liabilities** (per D-073 manual lanes; bond routes Manual as
    it carries no live quote here). **Insurance is never in this flow** (its own
    register, D-062).
  - **Type → branch/asset-class mapping comes from the existing MASTER-DATA
    `AssetClass` vocabulary — no new vocabulary.** The Listed tiles pass their
    asset class to the new-instrument classification (so crypto→CoinGecko,
    mutual_fund→AMFI route correctly); the Manual tiles preselect
    `ManualHoldingIn.asset_class`.
  - Specs: page-holdings.md §9-16; GLOSSARY branch clarification implicit in the
    per-type help copy. **No backend/engine/contract change** (routing + preselect
    only).

- **D-090 — Transaction-type applicability matrix** (owner, 2026-07-10;
  **RATIFIED 2026-07-10 with one amendment**). A table of **AssetClass × TxnType**
  stating which types the Add-flow Type dropdown offers per class (MASTER-DATA
  §10). **Form-level filtering only — the engine is unchanged**, and CSV imports
  of odd-but-real historical events are **not** filtered by it (importer commits
  regardless). **Amendment: ETF Bonus ON** (ETF unit splits/consolidations occur).
  Confirmed as proposed: crypto corporate actions OFF; retirement/liability
  interest ON; MF split+bonus ON; FD/bond/cash interest ON — the **Manual-branch
  transaction path** this implies is **approved** (matches the FD tile's "interest
  recorded separately" promise). Shipped: matrix served at
  `GET /refdata/txn-applicability` (frontend zero-copy, D-005); Listed dropdown
  filtered; Manual "Record transaction" sub-mode (interest/deposit/withdrawal/
  fee/transfer). page-holdings §9-17.
- **D-091 — Per-class creation-time field spec** (owner, 2026-07-10;
  **RATIFIED 2026-07-10**). A per-`AssetClass` table of **REQUIRED** (only what
  valuation/honesty need) vs **OPTIONAL-PROMPTED** creation fields (MASTER-DATA
  §11), seeded from the D-049 `_META_KEYS` whitelist. Ratified **including** the
  two whitelist gaps (property `cost`, private `round`, both added to `_META_KEYS`)
  and the **incomplete-details Review signal** — a manual holding recorded with no
  optional detail surfaces as *"N holdings have incomplete details"* (severity
  `info`, `_INCOMPLETE_DETAILS_MIN = 1`), **never a hard wall**. Frontend now
  prompts the OPTIONAL fields on the Manual Add form. page-holdings §9-18.

- **D-092 — Insurance signpost tile** (owner, 2026-07-10). The Add type-picker
  gains an **Insurance** tile that **navigates to the Insurance register and
  never branches the Add form** — insurance policies stay their own register
  (D-062 unchanged). Subtitle: "Policies live in their own register — we'll take
  you there." page-holdings §9-20.
- **D-093 — Editable import review grid** (owner, 2026-07-10). Import preview
  becomes an **editable review grid**: per-cell error highlighting (malformed
  values / invalid type; unresolved symbols per D-012; invalid type-for-class per
  D-090 once ratified), fixable **inline** or the row **excluded**; **Commit is
  disabled until every row is resolved or excluded**. Fixed rows commit by
  reconstructing a corrected CSV from the included rows and re-uploading (the
  commit path re-validates). No engine change. page-holdings §9-21.

- **D-094 — Table dataset-size posture: Holdings client-side, Transactions
  server-side** (owner, 2026-07-10). Audit finding: the `DataTable` component is
  presentational (it accepts `sort`/`filter` props); the Holdings page previously
  wired **neither**, so both tables rendered in raw API order and Transactions was
  silently capped at `limit=500`. Decision:
  - **Holdings — client-side sort/filter is acceptable** because the dataset is
    bounded (family portfolios are tens of positions). This is recorded as an
    **explicit assumption with a threshold note**: if a portfolio ever approaches
    ~1,000 positions, revisit and move Holdings server-side too (page-holdings
    §9-25). *Shipped this batch.*
  - **Transactions — server-side (shipped, 2026-07-10).** Sort **and** filter
    execute **server-side over the full dataset** (never the loaded page), with
    windowed loading (`offset`/`limit`, default 100, most-recent first). The
    response carries **`total`** so the UI states *"Showing X–Y of Z"* and **never
    silently truncates** — the old 500-row cap is gone (the headline defect). The
    `GET /portfolio/transactions` endpoint gained sort/dir/filter/offset/limit
    params + total — contract regenerated same commit, drift green. Numeric columns
    (amount/quantity/price, stored as `DecimalText`) are **cast to numeric for
    ORDER BY** so sorting is by value, not lexicographic. **CSV export stays
    full-dataset server-side regardless of the loaded window** (D-050).
  - **Worklist rule:** every table's page-build plan must state its **dataset-size
    assumption** and **where sort/filter execute** (client vs server). Added to
    `TEMPLATE-page-build.md`.

- **D-095 — CSV round-trip contract** (owner, 2026-07-10; final-walk item 1).
  **Any surface that both exports and imports a format must have a lossless
  round-trip test** — export → import preview → **zero errors, zero fixes**; the
  app's own export is its import's cleanest input (export columns == import schema).
  Diagnosis: the Holdings **Export** was a positions **snapshot** while **Import**
  ingests a transactions **ledger** — different schemas, so every row failed and
  symbols showed "(none)". A snapshot can't round-trip into a ledger without
  fabricating trade dates (Product-Guarantee violation). Fix: a new
  `GET /portfolio/transactions.csv` whose columns are exactly `IMPORT_COLUMNS`
  (wired to the ledger's Export); the importer detects a snapshot and returns one
  honest `format_error` instead of per-cell garbage; a permanent round-trip test.
  Rule recorded in page-holdings §9-27 + `TEMPLATE-page-build.md` §7. Also this
  walk: the `Dialog` **`size`** prop (§5.4 amendment; md/lg/xl, viewport-clamped),
  the Add dialog's two-column form, the responsive import review grid, the compact
  Holdings table (merged identity cell, class chip, provenance chip), and a
  one-step-denser compact density. Contract +1 → **126 paths**.

- **D-096 — Generated import template** (owner, 2026-07-10; confirmation pass). The
  Import dialog gains a **"Download template"** action serving a sample CSV
  **generated at request time from the D-090 applicability matrix** — one example
  row per (asset_class × permitted txn_type), valid vocabulary values, real ISO
  dates, example symbols per class, the exact import schema. Generated from the
  spec table so it **can never drift from the contract**, and is itself importable
  (round-trips with zero errors). `GET /portfolio/import/template` now returns this
  (was a static 5-row sample). page-holdings §9-37.
  - **Also this pass (bug + polish, not new decisions):** the import "Imported 0"
    bug was diagnosed via a **real browser + real-API flow** — *not* a payload bug
    (the committed CSV contains exactly the included rows, proven by test); the
    cause is duplicate-skip. Fix: a commit that imports zero now shows a **warning**
    toast ("No rows were committed — …duplicates"), never success styling (the
    Toast gains a `tone`). The Holdings table now **fits 1366px** with the ⋯ column
    fully visible (Price column dropped — it is "—" for manual holdings and Value is
    the decision figure; verified by rendered screenshots, `overflowX: false`).

- **D-097 — Instrument picker respects the picked asset class** (owner, 2026-07-10;
  confirmation pass). The Add-flow class (from the D-089 tile) filters **both** the
  picker's pools: **existing instruments** by stored `asset_class`, and **provider
  search routed to that class's provider only** (AMFI for mutual_fund, CoinGecko for
  crypto, the market provider for equity/etf) — never a cross-provider mix. A typed
  symbol that exists in the ledger under a **different** class appears under a
  separator (*"Found in equity: D05 →"*) as a **navigate-to link, never a selectable
  result** into the wrong flow (upholds D-012/D-089). New backend
  `GET /instruments/search?q=&asset_class=` returns three honest buckets
  (`existing` / `other_class` / `suggestions`); the picker is wired to it (was
  mock-backed). **Verified live** in a mutual-fund add (AAPL shows only as a
  cross-class link, not a mutual-fund result). Also this pass: the **universal
  popover overlay rule** (custom popovers portal to the viewport; DESIGN-SYSTEM §6).
  page-holdings §9-38/39. Contract +1 → **127 paths**.

- **D-098 — Entity references in tables link to their entity-detail page** (owner,
  2026-07-10; Instrument Detail walk). The **symbol** in the Holdings identity cell
  is a **direct link** to `/instrument/{symbol}`; the row-menu **Details** stays as
  the discoverable path. Generalised to a worklist-template rule: *entity references
  in tables link directly to their entity-detail page.* page-instrument-detail §I-1.
- **D-099 — Ongoing cost (expense ratio) is CLASS-SCOPED** (owner, 2026-07-10;
  Instrument Detail walk; **spec fix**). `annual_cost_bps` applies to **fund-wrapped
  classes only — `mutual_fund`, `etf`** — not equity, crypto, or manual classes.
  Equity/other pages show **no** expense-ratio field or card. Enforced: the Instrument
  Detail Ongoing-cost section + action are gated by class; the
  `PUT /instruments/{symbol}/ongoing-cost` **rejects** a non-null bps on a non-fund
  class (clearing is always allowed). **Migration:** existing non-fund rows carrying a
  bps are **surfaced for review** (a Review signal), **never silently deleted** — the
  owner clears or reclassifies. Recorded in MASTER-DATA §11. page-instrument-detail §I-4.

- **D-100 — Card/section border primitive; LAYERED standard** (owner, 2026-07-10;
  **ratified w/ amendment 2026-07-11**). `.lf-card` = soft `--border` on
  `--surface-raised`. **Cross-ratify amendment:** the Holdings summary-card treatment
  is the standard — a section with a headline block **nests its content in an inner
  `.lf-card__body` panel** (`--surface` + border) for depth, not a single flat fill.
  Applied to Instrument Detail's six sections; DataTable/Dialog keep their own
  surfaces. Both themes + high-contrast. DESIGN-SYSTEM §2.4.
- **D-101 — Themed scrollbars; header-outside-scroll standard** (owner, 2026-07-10;
  **ratified w/ amendment 2026-07-11**). Scrollbars styled via tokens (thin; track
  transparent; thumb `--border-strong`, hover `--text-tertiary`; inset), standards +
  WebKit, both themes + high-contrast. **Cross-ratify amendment:** the Instrument
  Detail News-block pattern is the standard — the scroll region is the **content
  area only, below the section header** (header outside the scroll container). In
  `DataTable` the **toolbar (filter/actions) moves outside** an inner
  `.lf-table__scroll` (only the table scrolls; `scrollbar-gutter: stable`, sticky
  column header); `.lf-table-wrap` keeps the border (`overflow: hidden`) so the thumb
  never overlaps it. DESIGN-SYSTEM §2.4.
- **PriceChart amendment — RATIFIED** (owner, 2026-07-11) as implemented: Simple/
  Advanced toggle (Simple default), hover crosshair + tooltip, period selector with
  honest short-history. DESIGN-SYSTEM §5.2 marker flips PROPOSED → ratified.

- **D-102 — Sidebar responsive behaviour** (owner, 2026-07-11; page-chrome C-6).
  Closes an IA gap: D-043 fixes the six sidebar groups and their order but never
  specified narrow-width behaviour. Resolution: the sidebar is **fixed (always
  visible) at laptop widths and up**, and **off-canvas/collapsible below laptop
  width**, opened by a **top-bar toggle**. The groups, their order, and their
  non-reorderability (D-043) are unchanged — only visibility is responsive, never
  content or arrangement. Recorded in INFORMATION-ARCHITECTURE §3.
- **D-103 — Purge-PIN NEVER binds to the unlock session** (owner, 2026-07-11;
  page-chrome C-5). The destructive purge (the only irreversible action) **always
  demands fresh PIN entry**, regardless of lock state — an unlocked/ambient session
  does **not** satisfy the purge PIN. Rationale: the PIN is the access lock (D-002),
  and on a wall-mounted appliance an unlocked session is ambient; the point of no
  return therefore requires deliberate re-entry, not ambient authority. This settles
  the page-holdings §9 follow-up (purge-PIN→session binding): the binding is
  **deliberately none**. Recorded in SECURITY-BASELINE §3.

- **D-047 AMENDMENT — TickerStrip promoted to the global chrome footer** (owner,
  2026-07-11; page-chrome §11-17; **RATIFIED 2026-07-11**). Supersedes the original
  D-047 "Home Full layout only" scope: the ticker is now a **fixed, always-visible footer
  strip in the global chrome on every page and width**. Content = the user's holdings +
  world indices, both from the **frozen contract** (`/portfolio/holdings` +
  `/markets/global` — the latter already exposes index quotes; **no contract change**).
  Footer height/gap/scroll-speed are tokens (`--ticker-scroll-duration` ratified at 30s);
  shell content reserves the space; mobile safe-area respected; **staleness flagged per
  item**; holdings symbols **link to entity detail** (D-098), indices unlinked; marquee
  **halts under reduced motion** (then static + manually scrollable); **hidden entirely
  under lock** (D-002 — leaks nothing; **owner-verified live 2026-07-11**). Home Full no
  longer duplicates it. Recorded in IA §4, DESIGN-SYSTEM §5.2. Future: per-device speed
  setting (ROADMAP R-16); indices→Markets link when Markets ships (ROADMAP R-17).

**Post-spec note:** D-089/D-092/D-093 are Holdings page-build decisions recorded
after the 12-batch spec close (D-001–D-088); they change no earlier decision.
**D-090 and D-091 were ratified 2026-07-10** (D-090 with the ETF-Bonus amendment);
**D-094** records the table dataset-size posture; **D-095** the CSV round-trip
contract; **D-096** the generated import template; **D-097** the class-aware
instrument picker. None changes an earlier decision.

---

## ROADMAP.md register (accumulated breadcrumbs — not v2 work)

| # | Item | Source |
|---|------|--------|
| R-1 | Optional passphrase mode (8–64 chars) | D-002 |
| R-2 | User-requestable transaction currencies, FX-validated | D-006 |
| R-3 | Domicile for fund-tax display | D-007 |
| R-4 | Instrument notes | D-015 |
| R-5 | Opt-in AI chat history | D-016 |
| R-6 | `spec` (specific-lot) cost-basis method | D-018 |
| R-7 | Corporate-actions audit: spin-offs, symbol changes as first-class recordings | D-019 |
| R-8 | Historical FX series (enables trade-date backfill + per-date realised totals) | D-020, D-076 |
| R-9 | Insurance cash value: opt-in inclusion in Net worth | D-039 |
| R-10 | App-wide Detail level, gated on per-page specs | D-040 |
| R-11 | User-defined scenario shocks, gated on a proper plan file | D-058 |
| R-12 | Revisit AI validator strictness only if fallback frequency proves high | D-070 |
| R-13 | Per-lane provider priority editing, only on demonstrated need | D-072 |
| R-14 | **FD accrued-interest valuation — first post-v2 feature; plan file must cover day-count conventions, compounding variants, maturity handling, and provenance labelling of calculated values** | D-073 |
| R-15 | User-configurable review thresholds (defaults set in D-084) | D-084 |
| R-16 | Ticker scroll speed as a per-device display setting | D-047-amend, D-078 |
| R-17 | Ticker index entries link to Markets (when the Markets page ships) | D-047-amend, D-098 |
| R-18 | D-101 themed scrollbar-thumb polish | D-101 |
| R-19 | Customisable Home — movable/resizable widgets, user-selected set (**amends D-046**; per-widget summary-reader gate) | D-046 (amend) |
| R-20 | External widget API — scoped long-lived keys for read-only summary widgets (read-only only; D-001 LAN/VPN posture) | D-069 |
| R-21 | External-connectivity adaptors (FIX, ISO 20022) as read-only provider lanes (no order flow; honest stale under no-egress) | Product Guarantee 1 & 5 |
| R-21a | MCP surface — AI-tool integration, evaluate in the AI-surfaces milestone (not a market-data lane) | D-067, D-068 |
| R-22 | AI provider configuration — local (Ollama) vs cloud API; key handling via the D-069 token pattern; under no-egress AI is local-only; explicit input to the AI-surfaces milestone plan (incl. whether first-run/Settings gain an AI step there) | D-067, D-068, D-069 |
| R-23 | RSS / user-defined news feeds as a news provider lane (provenance-labelled; zero calls under no-egress) | owner 2026-07-11 |
| R-24 | First-boot license acceptance gate — **cannot be a D-045 step (skippable ≠ acceptance)**; a separate blocking gate; revisit only if licensing/distribution posture demands (owner may instead strike + build now) | owner 2026-07-11 |
| R-25 | Personal-profile fields (name for personalization) — **hard-gated on a deliberate D-045/PRODUCT-SPEC no-profiling amendment + owner re-affirmation against the privacy identity; DOB/gender remain out** | D-045 (amend), PRODUCT-SPEC |

**v2.1 "accounting precision" theme (D-088).** R-6 (`spec` specific-lot cost
basis), R-8 (historical FX series), and R-14 (FD accrued-interest valuation) are
grouped as the v2.1 "accounting precision" milestone — the first coherent
post-v2 theme; each item keeps its own plan-file gate. The authoritative
grouping lives in `ROADMAP.md`.

Also recorded (ADR, not ROADMAP): SaaS/PaaS layer is a future proprietary
layer; v2 must not preclude it (D-001).

## DEFERRED (mechanical, not product decisions — with what each blocks)

| Item | What it is | Blocks |
|------|-----------|--------|
| DEF-1 | EXTRACTION REQUIRED — currency union (SUPPORTED_CURRENCIES 9 ∪ refdata 14 ∪ PortfolioEditor 22), validated against the FX-translatable rule | MASTER-DATA.md (D-005 completeness rule); currency master seed |
| DEF-2 | EXTRACTION REQUIRED — `asset_subclass` values from code usage | MASTER-DATA.md; instrument taxonomy vocab (D-009) |
| DEF-3 | EXTRACTION REQUIRED — `ACCOUNT_KINDS` (`app/services/accounts.py`) | MASTER-DATA.md; account form (D-064) |
| DEF-4 | EXTRACTION REQUIRED — `POLICY_TYPES`, `FREQUENCIES` (insurance service) | MASTER-DATA.md; Insurance form (D-062) |
| DEF-5 | EXTRACTION REQUIRED — `DOC_CATEGORIES`, `CONTACT_ROLES` (estate service), incl. the relationship→roles fold | MASTER-DATA.md; Estate forms (D-063) |
| DEF-6 | Sector master seed list (GICS-like) — authorship, not extraction | MASTER-DATA.md; sector picker (D-009) |
| DEF-7 | Review threshold constants table with per-value rationale — authorship from `services/review.py` values | Review page spec (D-059) |

No product decisions were deferred: all 80 items received a verdict.

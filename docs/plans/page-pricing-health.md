# page-pricing-health.md — Pricing Health (diagnostics) page build plan

**Status: DONE ✅ — page owner-accepted 2026-07-12 (see §13 retrospective).** First Reports-group
page (Worklist template), canonical home for provenance/confidence/routing diagnostics (D-038). §9
all-resolved; **no §3b deltas → Phase 0 skipped**; Phase-0a confirm-only (no §5 amendment); Phases
1/2 + Phase-3a pre-pass + Phase-3b walk (batch 1, ratified). **ND-1 reconciliation via a shared
`staleCount` query** (banner + page one source). Platform legacy: shared summary-count query pattern
+ `.lf-visually-hidden` caption rule (both promoted to DESIGN-SYSTEM §5.2). Build record: §11; walk
§12; retrospective §13. **No open blockers.**

Pricing Health is the **first Reports-group page** and the canonical home for **provenance,
confidence, and routing diagnostics** (D-038) — the honest "why is this number what it is" view. The
global **StaleBanner** is a P-1 summary of this page (its stale count must reconcile here).

---

## 1. IDENTITY

*Source: INFORMATION-ARCHITECTURE.md §2 (page map), §3 (nav); DESIGN-SYSTEM.md §3.*

| Field | Value | Spec ref |
|-------|-------|----------|
| Page name (H1 = nav label = route) | **Pricing Health** | IA §2, D-022 |
| Route | `/pricing-health` | IA §2 |
| Nav group | **Reports** (Reports · Pricing Health) | IA §3 (D-041) |
| Page template | **Worklist** (per-holding DataTable + row actions + a summary header) | DESIGN-SYSTEM §3 |
| Rotation eligibility | **Eligible: YES** (D-044 — any nav page; the user picks the set) | IA §3 (D-044) |
| One-line purpose | **Pricing Health** — per-holding provenance/confidence/routing diagnostics: the honest "why is this number what it is" view, and the canonical home for provenance + confidence (D-038). Read-only diagnostics + refresh / correct-source controls (no provider-priority editing, D-072). | IA §2/§5, D-038 |

---

## 2. OWNERSHIP TABLE

*Copied verbatim from INFORMATION-ARCHITECTURE.md §5 (Pricing Health). Never re-derived.*

**Owns (canonical, authoritative, fully explained here):**
- **Per-holding provenance/confidence diagnostics** — status chip (Fresh / Delayed / End-of-day /
  Cached / Manual / Estimated / Unavailable), **confidence score + band**, **source + entitlement**,
  the **routing chain per holding** (visibility yes, editability no — D-072), **refresh +
  correct-source controls**, the **identifier-duplicate banner**, the **portfolio confidence card**.
- **Canonical home for provenance and confidence** (D-038).

**Summarises:** nothing — this page is the canonical *source*; other surfaces summarise IT.

**Summarised-by (other pages/chrome summarise this page's figures, via the shared reader, linked):**

| Summary shown elsewhere | Where | Shared reader | Reconciles here |
|-------------------------|-------|---------------|-----------------|
| **StaleBanner** stale count | Global chrome (every page) | `value_portfolio` (via `/portfolio/summary.stale_count`) | **must equal** the page's stale count (ND-1) |
| Per-holding provenance/confidence chips | Holdings, Instrument Detail | same `value_portfolio` valuation | link to Pricing Health (D-038) |

**Enforcement corollary (P-1/D-031):** every diagnostic is read from the canonical reader
(`/portfolio/pricing-health`, itself over `value_portfolio`). The StaleBanner and every per-holding
chip are **P-1 summaries of this reader** — no second staleness/confidence code path. **No frontend
money math** (values are served display strings).

---

## 3. API SURFACE

*Source: API-CONTRACT.json (frozen) + API-CONTRACT.md. Verify-first shapes are pinned in §10.*

### 3a. Endpoints consumed (already in the frozen contract)

| Method + path | Purpose on this page | Response shape (verified §10) |
|---------------|----------------------|-------------------------------|
| `GET /portfolio/pricing-health` | the whole page: per-holding diagnostics + status-count summary + portfolio confidence | `{base_currency, holdings:[…per-holding…], summary:{status→count}, confidence:{overall, overall_band, by_band:{band:{count, value_pct}}}}` — over `value_portfolio`; **no `entity_id` (household-only), ND-11** |
| `POST /portfolio/pricing-health/{holding_id}/refresh` | per-holding refresh (row action) | `{ok, refreshed, reason?}`; manual holdings honestly report "nothing to fetch"; **`require_auth`** |
| `POST /system/refresh-data` | **bulk** "Refresh all shown" | budgeted refresh (40s overall + 8s/symbol), reports updated/failed/skipped; **`require_auth`**; **same endpoint any banner one-click refresh must use (one code path, ND-2)** |
| `PATCH /instruments/{symbol}` (`source_override`) | **correct-source** control (per-instrument) | validated via `validate_source_override` ("" / "auto" clears); options served by `/refdata.source_override`; **`require_auth`**; per-instrument correction — **NOT** priority editing (D-072), ND-4 |
| `GET /refdata` (`source_override` list) | the correct-source `MasterSelect` options | served vocab (D-005 zero-copy) |
| `GET /system/identifier-duplicates` | the identifier-duplicate banner | `{duplicates:[…], count}` (from `duplicate_identifiers`) |
| `GET /portfolio/summary` (`stale_count`) | reconcile the page's stale count with the StaleBanner (P-1) | `stale_count` — the banner's source (ND-1) |

### 3b. Contract deltas (needed but not in the baseline — BUILD BACKEND-FIRST)

**None confirmed.** Every surface IA lists (diagnostics, per-holding + bulk refresh, correct-source,
identifier-duplicates, confidence) is **already served**. Suspected gaps go to **§9, not a §3b
guess** — candidates only if the owner chooses a backend route (e.g. ND-2 a page-scoped refresh vs the
existing bulk `/system/refresh-data`; ND-1 a single reconciled stale-count source). Any approved delta
regenerates `API-CONTRACT.json` + `docs/openapi.json` same commit (`make api-contract-check`).

---

## 4. COMPONENTS

*Source: DESIGN-SYSTEM.md §5 (ratified) + §3 (worklist template). Ratified only; a missing affordance
is a §9 amendment request. Data-wired to real endpoints (no mock fixtures on a canonical page).*

| Ratified component | Role on this page | Data source (real endpoint) | Not exercised at kitchen-sink |
|--------------------|-------------------|-----------------------------|-------------------------------|
| **PageHeader** | H1 "Pricing Health" + D-038 subtitle + actions (Refresh all, export?) | — | multiple actions incl. a gated one |
| **DataTable** | per-holding diagnostics worklist (status, confidence, source, entitlement, as-of, value) | `/portfolio/pricing-health.holdings` | status/confidence chip columns; sort by status/confidence |
| **StalenessChip / ProvenanceBadge** | the status chip per holding (Fresh/Delayed/Cached/Manual/Estimated/Unavailable) + entitlement | served `status`/`valuation_label`/`entitlement`/`price_ts` | the full status set incl. Unavailable/Estimated |
| **RowMenu** (⋯) | per-row actions: **Refresh**, **Correct source**, Details | refresh + PATCH endpoints | a gated (auth) row action |
| **MasterSelect** | the correct-source picker (served `source_override` options) | `/refdata.source_override` | a served-vocab select bound to a per-instrument correction |
| **ConfirmDialog (+ PIN?)** | gate for refresh / correct-source (both `require_auth`) — see ND-3 | — | auth-gated diagnostic action |
| **MetaStrip** | the **routing chain per holding** (lane · priority chain · source selected · auth/mapping flags) in a row-detail | served `route_*`/`priority_chain`/`*_required` | a chain/label strip that is **read-only** (D-072) |
| **TrendStat** (+ a band breakdown) | the **portfolio confidence card** (overall band + by-band value%) and the status-count summary | `/portfolio/pricing-health.confidence`/`.summary` | a band/confidence summary tile |
| **EmptyState** | honest empty (no holdings), all-manual (nothing to refresh), unreachable reader | reader shapes | all-manual portfolio message |
| **GlossaryTerm** | `[Help]` on Confidence, Provenance, Entitlement, Routing, each status | GLOSSARY | multiple status `[Help]` anchors |

**Affordances the ratified inventory may lack (amendment — resolve in §9 before build):**
- **Routing-chain display (ND-5).** The per-holding chain (lane → priority chain → selected source,
  with auth/mapping flags) may not map cleanly to `MetaStrip`. Confirm `MetaStrip`/chips suffice, or
  it is a small **§5 amendment** (a read-only "route chain" affordance). **Never editable (D-072).**
- **Confidence card + band breakdown (ND-6).** The value-weighted `by_band` breakdown
  (`{count, value_pct}` per high/medium/low) may want a small segmented bar. Confirm ratified
  components cover it or propose a §5 addition.

**Component usage rules the build must honour (template §4):**
- **No config controls (D-072):** the routing chain is **visible, never editable**; the page must
  **not** sprout provider-priority settings. `source_override` is a per-instrument *correction*, the
  only sanctioned write.
- **No raw `<input>`/`<select>`;** correct-source is a `MasterSelect` over served options.
- **Scroll = content only, header outside (D-101);** the worklist caps at `--table-max-h`.
- **Server-side export only (P-5/D-050)** if any export exists (ND-12).
- **A recurring page-local pattern extracts to the shared layer** (e.g. the status chip).

---

## 5. VOCABULARIES

*Source: MASTER-DATA.md + served diagnostics. Every categorical → its master/served source.*

| Field on this page | Vocabulary / source | Fixed / served | Ref |
|--------------------|---------------------|----------------|-----|
| **Status** (Fresh/Delayed/End-of-day/Cached/Manual/Estimated/Unavailable) | served `status` / `valuation_label` (provenance) | **served** (D-005) | `app/core/provenance` |
| **Confidence band** (high/medium/low) | served `confidence_band` (`band_of`: high≥80, medium≥50, **low<50**) | **served** | `confidence.py` (04-CALC §10) |
| **Source / entitlement** | served `source`, `entitlement`, `route_source` | **served** | route diagnostics |
| **Routing lane / priority chain** | served `route_lane`, `priority_chain` | **served, read-only (D-072)** | 05-PROVIDERS-AND-ROUTING |
| **Correct-source** options | `source_override` master | **served** `/refdata` (D-005) | refdata.py |

All categoricals are **served display strings** — render verbatim; never hardcode a status/band/lane
label or a provider list.

---

## 6. DECISIONS IN FORCE

*Source: docs/audit/DECISIONS.md — each with what it forbids/requires here.*

| Decision | What it forbids / requires on this page |
|----------|------------------------------------------|
| **D-038** | Provenance/confidence are **canonical here**. Home/Net worth show ReviewCard summaries; per-holding chips elsewhere **link here**. Reports Pack is a separate artifact, not this page. |
| **D-072** | Routing chain is **visible, never editable** — **no provider-priority config controls**. `source_override` (per-instrument correction, validated) is the only sanctioned write; per-lane priority editing is parked (R-13). |
| **D-027 / Guarantee 3** | Freshness/confidence **flagged, never hidden or faked**; every empty / "—" / Unavailable states a reason. |
| **D-031 / P-1** | Every diagnostic from the canonical reader; the **StaleBanner + per-holding chips are P-1 summaries** of this reader — no second staleness/confidence path. |
| **D-069 / D-002** | Refresh + correct-source are `require_auth` — confirm the gating ([S]/PIN) + honest degradation; under **no-egress** refresh makes **zero outbound calls** and degrades to honest stale (Guarantee 5). |
| **D-005 / D-050** | Served vocab (statuses/bands/lanes/sources, zero-copy); any export is server-side. |
| **D-065** | Household-default (no entity selector here; ND-11). |

---

## 7. ACCEPTANCE CRITERIA

*Checkable, user-visible. Includes honesty states + theme/density + overflow + the §7/§8 fail-first rule.*

- [ ] **Per-holding diagnostics (D-038):** each holding shows status chip, confidence score+band,
      source+entitlement, as-of, value — all **served** (no client math); sortable; Unavailable /
      Estimated states carry their reason (Guarantee 3).
- [ ] **StaleBanner reconciliation (P-1, ND-1):** the page's stale count **equals** the StaleBanner's
      count (both from `value_portfolio`); demonstrated, not asserted in prose.
- [ ] **Refresh (ND-2/ND-3):** per-holding refresh + a **bulk "Refresh all"** run through the
      canonical endpoints; **any banner one-click refresh uses the SAME `/system/refresh-data` code
      path**; gated per D-069/D-002; **no-egress → zero calls**, honest stale; 429/backoff honest.
- [ ] **Correct-source (D-072, ND-4):** a validated **per-instrument** `source_override`
      (`MasterSelect` over served options); **no provider-priority editing anywhere on the page**.
- [ ] **Routing chain (D-072):** the per-holding lane/priority-chain/selected-source is shown
      **read-only**; `auth_required` / `mapping_required` surfaced as honest flags, never as a fabricated value.
- [ ] **Identifier-duplicate banner:** rendered from `/system/identifier-duplicates` when `count > 0`
      (honest "we never guess which is correct"), omitted at zero.
- [ ] **Portfolio confidence card (ND-6):** value-weighted overall band + by-band breakdown, served.
- [ ] **Terms match GLOSSARY;** copy hygiene — no decision IDs / impl notes / enum keys
      (`amfi_nav`, `end_of_day`) in any user string; `[Help]` on Confidence/Provenance/Routing/statuses.
- [ ] **No config controls (D-072):** grep the page — no provider-priority setting exists.
- [ ] **Both themes + both densities;** interactive OPEN states (MasterSelect, RowMenu, ConfirmDialog) verified in both themes.
- [ ] **Rendered layout + overflow:** verified by rendering at 320/375/900/1366 both themes, zero
      horizontal overflow — **extend the Playwright overflow suite** to `/pricing-health`. Every
      visual/geometry fix **fails-first** and measures the real element (TEMPLATE §7/§8).
- [ ] **Server-side export** (if any, ND-12) — client never builds the file.

---

## 8. BUILD PHASES

*One commit per phase. Backend deltas FIRST. Nothing assembled against a non-existent endpoint.
**Do not start until §9 clears.***

- **Phase 0 — Contract deltas (only if §9 turns ND-1/ND-2 toward a backend route):** backend-first;
  regenerate contract same commit; drift green. *(Skip if all resolve to existing endpoints.)*
- **Phase 0a — DESIGN-SYSTEM §5 amendment (only if ND-5 routing-chain / ND-6 confidence-band needs a
  new affordance):** author PROPOSED, ratify at `/kitchen-sink` before assembly.
- **Phase 1 — Page assembly:** compose ratified components over the readers; progressive per-card
  loading; honest empty/error/stale/Unavailable states; per-holding diagnostics table; confidence
  card + status-count summary; refresh (per-holding + bulk) + correct-source; identifier-duplicate
  banner; StaleBanner reconciliation.
- **Phase 2 — Tests:** component/render tests + acceptance (§7); **extend the overflow suite to
  `/pricing-health`**; a **stale-count-reconciles-the-banner** test; drift/typecheck/lint/build green.
- **Phase 3a — Scripted pre-pass (MUST be green before the walk):** drive the live page + real backend
  on seeded demo; assert populated diagnostics, the banner↔page count reconciliation, refresh + correct-source
  flows (honest states), no config controls, 0 console errors, 0 overflow; fix everything it surfaces first.
- **Phase 3b — Owner acceptance walk (LIVE, judgment items only):** each finding → a numbered
  `page-pricing-health.md §*` entry, fixed + re-verified live, geometry fixes **fail-first**. **Owner closes the page.**

---

## 9. NEEDS DECISION — RESOLVED (owner, 2026-07-12)

All 13 items resolved. Each matched an option laid out at draft (ND-10 the owner **overrode** the
draft's "presumably not" with the explicit D-044 text). The detailed option text is retained beneath
the resolutions as the considered-options record.

**Resolutions (owner, 2026-07-12):**
- **ND-1 (a).** By-construction reconciliation accepted — both endpoints derive from `value_portfolio`
  (P-1 satisfied at the reader). The page displays its **own `is_stale` count**; acceptance + a test
  **demonstrate banner count == page count live**.
- **ND-2 (a) · divergence recorded.** The banner stays **count + link only**; refresh is a Pricing
  Health affordance — **per-holding row action + a bulk "Refresh all" → `/system/refresh-data`**.
  **Brief divergence recorded honestly: the StaleBanner never offered refresh — the brief was wrong.**
- **ND-3.** Gate = **session `[S]`** (D-069; not destructive → no fresh-PIN prompt, D-103 untouched).
  **No-egress → zero outbound**, an honest "**refresh unavailable — no-egress is on**" state, stale
  flags stand (Guarantee 5). Bulk refresh is long-running (40s + 8s/sym): **honest in-progress state**
  + the served **updated/failed/skipped** summary rendered on completion. **429 honesty rides the F6
  backoff already in the worker** (no new backoff work here).
- **ND-4.** `source_override` via **`MasterSelect`** over served options, framed as a per-instrument
  **CORRECTION** — never priority editing.
- **ND-5.** **Row-detail** (a Details row action) composing **`MetaStrip` + inline chips**: lane ·
  priority chain · selected source · auth/mapping flags. **Read-only. NO new component** — if the
  composition genuinely fails, **STOP and request the amendment** (don't invent one).
- **ND-6.** Ratified components only: overall band = **`TrendStat`** tile; by-band = a **compact
  served table** (band · count · value %); status counts = a **chip strip**. **No segmented bar**
  (consistent with Net worth ND-8).
- **ND-7.** **Worklist template CONFIRMED.** Reports-group nuance recorded for the following pages:
  **report/worklist-shaped — a summary header + a diagnostics body**.
- **ND-8.** **Show `confidence_factors`** in the row-detail, under the routing chain — the served "why
  this score" list, **verbatim**.
- **ND-9.** Leave `/system/staleness` **unwired**; recorded as **orphaned** here + a **tech-debt line**
  (candidate for removal at a future contract-review milestone — contract frozen, no change now).
- **ND-10.** **Rotation-eligible: YES** — D-044 is explicit (any nav page; the user picks the set).
  The draft's "presumably not" is **overridden** by the decision text.
- **ND-11.** **Household-only** confirmed (reader takes no `entity_id`); logged for the Accounts milestone.
- **ND-12.** **DECLINED** — no CSV here; exports are the Reports page's territory (same rationale as
  Net worth ND-14). Recorded as **declined, not deferred**.
- **ND-13.** Show **both flags** as honest per-holding indicators — copy **PROPOSED at build**
  ("Needs an API key — add in Settings", "Needs identifier mapping"); links land honestly (**NotBuilt**
  until Settings ships). **Diagnostic-only, no config.**

**Confirms:** served labels throughout (D-005); bands **high≥80 / med≥50 / low<50** as served; **zero
provider-priority controls** (D-072 — a grep stands in acceptance).

**Build sequence:** no §3b deltas → **skip Phase 0**; **Phase 0a = confirm-only** at the kitchen sink
(composition of ratified parts, no specimens) → Phase 1 assembly → Phase 2 (incl. the
banner-reconciliation test) → Phase 3a pre-pass (green before the walk, fail-first standard).

---

**Considered options (draft record — the resolutions above are authoritative).** Items flagged
**⚠ VERIFY-FIRST DIVERGENCE** contradicted a premise in the brief.

- **ND-1 — StaleBanner ↔ page stale-count reconciliation.** The banner reads
  `/portfolio/summary.stale_count`; the page reads `/portfolio/pricing-health`. **Both derive from the
  same `value_portfolio` reader** (per-holding `is_stale`), so the count **reconciles by
  construction** — but via **two different endpoints**. Options: **(a)** accept the by-construction
  reconciliation and display the page's own stale count (count of `is_stale` rows), OR **(b)** point
  the banner at the pricing-health count for a single serving endpoint. Owner call. Either way the page
  must **visibly reconcile** (acceptance + a test).
- **ND-2 — Refresh action home + one code path. ⚠ VERIFY-FIRST DIVERGENCE.** The brief says "the
  banner offers one-click refresh today" — **verification: it does NOT.** The `StaleBanner` is
  **count + link to Pricing Health only** (`StaleBanner.tsx`; `AppShell` passes no `onRefresh`).
  Refresh lives at **`POST /system/refresh-data`** (bulk) + **`POST /portfolio/pricing-health/{id}/refresh`**
  (per-holding). Options: **(a)** keep the banner link-only; refresh is a Pricing Health affordance
  (per-holding row action + a bulk "Refresh all" → `/system/refresh-data`); **(b)** add one-click
  refresh to the banner, calling the **same `/system/refresh-data`** the page's bulk refresh uses (one
  code path). Owner call — but the page's bulk refresh and any banner refresh **must be one endpoint**.
- **ND-3 — Refresh + correct-source gating & honesty.** Both are `require_auth`. Confirm the **gate**
  (session [S] vs fresh PIN, D-069/D-002/D-103), the **no-egress** behaviour (zero outbound; honest
  stale, Guarantee 5), and **429/backoff** honesty (reuse the first-run F6 backoff pattern where relevant).
- **ND-4 — Correct-source control.** `PATCH /instruments/{symbol}` `source_override` (validated;
  options via `/refdata.source_override`). Confirm this is the correct-source affordance and that it is
  framed as a **per-instrument correction** (allowed, D-072), **never** as provider-priority editing.
- **ND-5 — Routing-chain display (possible §5 amendment).** Render the per-holding lane / priority
  chain / selected source / auth+mapping flags **read-only** — via `MetaStrip` in a row-detail, inline
  chips, or a small new "route chain" affordance? Owner picks (amendment gate).
- **ND-6 — Portfolio confidence card + status-count summary.** `confidence` = `{overall, overall_band,
  by_band:{band:{count, value_pct}}}`; `summary` = `{status→count}`. Which components (a `TrendStat`
  band tile + a value-weighted by-band bar; a status-count strip)? Confirm ratified components suffice
  or propose a §5 addition.
- **ND-7 — Template fit (first Reports-group page).** DESIGN-SYSTEM §3 maps Pricing Health to
  **Worklist** (per-holding DataTable + a summary header). Confirm Worklist (not Overview); the Reports
  group's only other page is Reports (+ the Reports Pack artifact, D-038, separate). Any Reports-group
  template nuance to record for the pages that follow?
- **ND-8 — `confidence_factors` per holding.** `score_holding` serves `confidence_factors` (the "why
  this score" list). Surface them (row-detail) or omit for v2? Owner call.
- **ND-9 — `/system/staleness` is orphaned.** The endpoint exists but has **no consumers** (the banner
  uses `summary.stale_count`, the page uses `pricing-health`). Confirm we **leave it** (do not wire the
  page to it); recorded so a later reader doesn't assume it's the source of truth.
- **ND-10 — Rotation eligibility.** Reports-group pages are presumably **NOT** dashboard-rotation
  eligible (D-044). Confirm.
- **ND-11 — Entity scope.** `pricing_health` takes **no `entity_id`** (household-only). Confirm
  household-default, no selector (consistent with Portfolio/Net worth), logged for the Accounts milestone.
- **ND-12 — Server-side export (D-050).** Does Pricing Health offer a CSV of the diagnostics, or is
  export Reports territory (declined, like Net worth ND-14)? Owner call.
- **ND-13 — `mapping_required` / `auth_required` surfacing.** Show as honest per-holding flags
  ("source needs a key", "needs identifier mapping") linking to the fix? Confirm the copy + that it is
  diagnostic-only (no config).

**Lower-risk confirms (owner ratifies with the above):** all status/band/lane/source labels are
**served** (D-005); confidence bands = high≥80 / medium≥50 / **low<50** (served); the page carries
**no provider-priority config** (D-072).

---

## 10. VERIFY-FIRST FINDINGS (2026-07-12) — read before assuming shapes (D-019)

Ran the read-what-the-engine-serves pass before drafting §3/§4. **No shape was assumed; gaps went to
§9, not §3b.**

| Item | What the engine actually serves | Source |
|------|--------------------------------|--------|
| Pricing-health reader | `{base_currency, holdings:[{id,symbol,label,asset_class,sector,exchange,currency,native_price,market_value,valuation_method,valuation_label,status,source,entitlement,price_ts,is_stale,failure_reason,source_override,route_lane,route_source,priority_chain,mapping_required,auth_required, confidence, confidence_band, confidence_factors}], summary:{status→count}, confidence:{overall,overall_band,by_band:{band:{count,value_pct}}}}` — over `value_portfolio` | `portfolio.py:173` |
| Entity scope | `pricing_health` has **no `entity_id`** (household-only) | route signature |
| Confidence bands | `band_of`: **high≥80, medium≥50, low<50**; portfolio summarise is **value-weighted** | `confidence.py:34`, 04-CALC §10 |
| StaleBanner source | reads **`/portfolio/summary.stale_count`** (via `api/chrome.ts:25`), links to `/pricing-health`; **no refresh action in the banner** | `chrome.ts`, `StaleBanner.tsx`, `AppShell.tsx:155` |
| Refresh (per-holding) | `POST /portfolio/pricing-health/{id}/refresh` (`require_auth`); manual holdings report "nothing to fetch" | `portfolio.py:237` |
| Refresh (bulk) | `POST /system/refresh-data` (`require_auth`); budgeted 40s + 8s/symbol; reports updated/failed/skipped | `system.py:393` |
| Correct-source | `PATCH /instruments/{symbol}` `source_override` (validated; "" / "auto" clears); options via `/refdata.source_override` | `markets.py:272`, `refdata.py:140` |
| Identifier-duplicates | `GET /system/identifier-duplicates` → `{duplicates:[…], count}` | `system.py:102`, `identity.py:62` |
| Routing | `route_for_instrument` → lane, priority_chain, source_selected, auth_required, mapping_required, reason; **hard-coded chains, not editable (D-072)** | 05-PROVIDERS-AND-ROUTING §; `market.py` |
| `/system/staleness` | exists but **no frontend consumers** (orphaned) | `system.py:372`, grep |

**Owner sign-off surface (all in §9):** the two ⚠ items — ND-2 (the banner does **not** refresh
today; pick the refresh home + one code path) and the ND-1 banner↔page reconciliation — plus the
component-shape calls (ND-5 routing chain, ND-6 confidence card) and the confirms. **→ §9 now
RESOLVED; Phases 0a/1/2/3a built (§11).**

---

## 11. PHASES 0a / 1 / 2 / 3a — BUILT + PRE-PASS GREEN (2026-07-12) — STOP for the owner's walk

- **Phase 0 skipped** (no §3b deltas). **Phase 0a — CONFIRM ONLY:** ratified parts compose the page
  (DataTable, ProvenanceBadge, RowMenu, MasterSelect, MetaStrip, Dialog, TrendStat) — **no §5
  amendment, no kitchen-sink specimen** (ND-5 composed cleanly, ND-6 needed no segmented bar).
- **Phase 1 — assembly** (`frontend/src/routes/PricingHealth.tsx` + `.css`, `api/pricing-health.ts`;
  `/pricing-health` routed, nav `built`). Progressive per-card loading over the readers:
  per-holding **diagnostics DataTable** (Holding · Value · Status chip · Confidence score+band ·
  Source · RowMenu), a **portfolio confidence card** (overall-band `TrendStat` + a by-band served
  table + a status-count chip strip — **no segmented bar**, ND-6), the **identifier-duplicate banner**
  (shown only when `count>0`), a **Details dialog** (`ProvenanceBadge` + a **read-only** routing-chain
  `MetaStrip`+chips + `confidence_factors`, ND-5/ND-8), a **Correct-source dialog** (`MasterSelect`
  over served options — a per-instrument **correction**, never priority editing, D-072/ND-4).
  **Refresh:** per-holding row action + a bulk **"Refresh all" → `/system/refresh-data`** (one code
  path), `[S]`-gated, with an honest **no-egress** state (ND-2/ND-3). The banner stays link-only; the
  page shows its **own `is_stale` count** that **reconciles** with `summary.stale_count` (ND-1(a)).
  **No provider-priority config anywhere** (D-072).
- **Phase 2 — tests.** `PricingHealth.test.tsx` (6, incl. the **banner-reconciliation invariant** —
  page stale count == count of `is_stale` rows); overflow suite extended to `/pricing-health`
  (320/375/900/1366 × both themes) + the shared-inset check. **Frontend check: 126 vitest + 57
  overflow + lint/typecheck/tokens/build.**
- **Phase 3a — scripted pre-pass GREEN ×3** (`e2e/smoke/pricing-health-smoke.spec.ts`, dev-only). On
  seeded demo: 14 populated diagnostics rows; **live banner↔page reconciliation** (page `is_stale` == 
  `/portfolio/summary.stale_count`, 5==5); the Details routing chain is **read-only** (no controls) and
  the page has **no priority config** (D-072); the Correct-source dialog opens a served `MasterSelect`;
  the identifier-duplicate banner is present iff duplicates exist; no residual skeletons; **0 overflow**
  at all four breakpoints × both themes; **0 console errors**.

**Commits:** `60d2338` (§9 resolutions) · `635f1ce` (Phase 1+2) · Phase-3a close-out. **STOP — the
Phase-3b acceptance walk is the owner's** (fail-first standard for any geometry fix, TEMPLATE §7/§8).

---

## 12. PHASE-3B WALK — batch 1 (owner, 2026-07-12)

Recorded, fixed, pre-pass re-run green, awaiting owner re-verify. (Page NOT closed.)

1. **§12ph1-1 — RECONCILIATION BUG (ND-1 guarantee), fixed structurally.** The banner and the page
   footnote were **two independent fetches** — the banner's count was fetched **once at `AppShell`
   mount** (never invalidated), the footnote computed its **own** `is_stale` count from a separate
   `pricing-health` fetch; under a staleness change between them the footnote's "matches the Stale
   banner" claim went **false** (owner saw banner "6" vs footnote "0" live). **Fix:** ONE shared
   client query — **`src/state/staleCount.ts`** (`useSyncExternalStore`, polls `/portfolio/summary`,
   exposes `invalidateStaleCount()`). Both the `StaleBanner` (via `AppShell`) and the footnote read
   **this single cached value**, so they can never disagree; the footnote **renders the shared value**
   (never asserts an equality it isn't displaying); refresh actions call `invalidateStaleCount()` so
   banner + footnote **move together**. **Pre-pass skew test added:** banner == footnote at load AND
   after a server-side staleness mutation (a refresh). **⚠ Honest fail-first note:** a *numeric*
   fail-first was **not reproducible this session** — the demo currently has **0 stale holdings** (all
   refreshed fresh) and there is **no force-stale affordance**, so the mutation is a no-op (0→0). The
   bug is owner-observed-live and architecturally reproduced (two fetch sites, mount-cached banner, no
   invalidation); the fix **removes the second fetch by construction**, and the skew test asserts the
   invariant that would trip on the old architecture given any stale holding.
2. **§12ph1-2 — Confidence card dead-right (BUG + fail-first).** The `.ph__confgrid` used
   `repeat(auto-fit, minmax(14rem,1fr))` — at wide widths it created a **phantom empty track**, so
   the three sections rendered at ~248px each and left **261px dead on the right** (measured
   fail-first at 1366). **Fix:** deterministic **equal-geometry** columns — `repeat(3, 1fr)` at
   laptop+ (stacked below), `align-items: stretch`; the stale footnote spans full width. **Pre-pass
   card-fill assertion added** (the Net worth card-fill class): the sections row fills the card width
   (dead-right ≤ 2px) at all breakpoints — **verified 261px → 1px**.
3. **§12ph1-3 — Duplicate title (DataTable caption repeats the card header).** **Rule recorded: a
   `DataTable` inside a titled card keeps its `<caption>` for screen readers but hides it visually**
   (the card header already names the table). Fixed in the component — the caption now uses a new
   **`.lf-visually-hidden`** utility (1px dims via the `--border-width` token, no raw px). **Audit:**
   this fixes every DataTable app-wide — Net worth statement + liquidity ladder, Portfolio
   attribution, Holdings/transactions all had a visible caption repeating their card title; now all
   sr-only. Pre-pass asserts the caption is present (a11y) but visually hidden. *(Candidate for a
   DESIGN-SYSTEM §5.2 line — owner greenlights promotions.)*
4. **§12ph1-4 — "Refresh all" → ratified icon-only framed page-action.** Now
   `lf-iconbtn lf-iconbtn--framed` (RotateCw, tooltip + `aria-label="Refresh all prices"`,
   `aria-busy` while refreshing); the `[S]`-gated / no-egress-disabled behaviour is unchanged.
5. **§12ph1-5 — dev.sh port pre-check (tooling only, no app change).** `scripts/dev.sh` now pre-checks
   ports **8321** + **5173**; if either is held it prints the **owning PID + command + a one-line kill
   hint** and **exits non-zero** — never silently half-starts. Verified: syntax + live detection of the
   held ports.

**Reusable outcomes:** `src/state/staleCount.ts` (a shared polled+invalidatable client query — the
pattern for any "summary count also shown on its canonical page"); the **`.lf-visually-hidden`**
utility + the **caption-hidden rule** for DataTables inside titled cards.

**Checks after batch 1:** frontend **126 vitest + 57 overflow + lint/typecheck/tokens/build** green.
Live pre-pass GREEN ×3 (shared-count skew test, confidence card-fill 261→1px, caption hidden,
icon-only Refresh all, plus all Phase-3a assertions).

**Batch 1 — RATIFIED (owner, 2026-07-12, seen live):** shared-`staleCount`-query reconciliation,
confidence-card fill, caption rule, icon-only Refresh-all, dev.sh port guard. Refresh-all exercised
live (gate + progress + served summary) and the row-detail read (routing chain + confidence_factors)
— both honest. Promotions applied to DESIGN-SYSTEM §5.2 (shared-count query + `.lf-visually-hidden`
caption rule).

---

## 13. MILESTONE RETROSPECTIVE — Pricing Health DONE ✅ (owner sign-off, 2026-07-12)

**`/pricing-health` is complete and owner-accepted.** The first **Reports-group** page (Worklist
template) and the canonical home for provenance/confidence/routing diagnostics (D-038). No backend
deltas; no §5 amendment. Phases 0a/1/2 + Phase-3a pre-pass + Phase-3b walk (batch 1, all ratified).

**Why this was the fastest page yet:**
- **Verify-first (§10) emptied §3b.** Reading what the engine already serves —
  `/portfolio/pricing-health`, per-holding + bulk refresh, `PATCH …source_override`,
  `/system/identifier-duplicates`, confidence bands — showed **everything was already in the frozen
  contract**, so **§3b was empty → Phase 0 was skipped entirely**. The single biggest time-saver.
- **One-pass §9.** All 13 NDs resolved in one owner round, each matching a drafted option (one
  override: rotation). No re-opens, no mid-build clarifications.
- **Composition-only Phase 0a.** Ratified parts covered the page (`DataTable`, `ProvenanceBadge`,
  `RowMenu`, `MasterSelect`, `MetaStrip`, `Dialog`, `TrendStat`) — **confirm-only, no specimens, no
  §5 amendment** — because the taxonomy/provenance components already existed from Instrument Detail.

**Reports-group template nuance (recorded per ND-7, for the pages that follow — Reports, etc.):**
a Reports-group page is **report/worklist-shaped — a summary header + a diagnostics/records body**
(here: the portfolio-confidence card + the per-holding diagnostics table). Encoded in
`TEMPLATE-page-build.md`.

**Template legacy (reusable platform outcomes this milestone):**
- **`src/state/staleCount.ts`** — the shared, polled, invalidatable client-query pattern for any
  chrome summary count that also renders on its canonical page (DESIGN-SYSTEM §5.2).
- **`.lf-visually-hidden`** + the **caption-hidden rule** for DataTables inside titled cards
  (DESIGN-SYSTEM §5.2).

**Judgment-flagged (owner calls, recorded with rationale):** ND-2 (the banner never refreshed — brief
divergence; refresh is a page affordance); ND-1 by-construction reconciliation via the shared query;
ND-9 `/system/staleness` left orphaned (tech-debt). The §12ph1-1 **honest fail-first note** (a 0==0
non-reproduction reported plainly, not dressed up) was owner-accepted as the right call.

---

## DELTA NOTE — 2026-07-18 (R-38 data-feed-routing Phase 3b re-walk, §14dr-3)

- **Stale holdings are now identifiable on the per-holding diagnostics table.** The
  banner + confidence card count "N stale" but the table could not show WHICH
  (§14ac-2 — a destination that states a count but can't answer "which" only
  half-answers). **Verify-first:** the per-holding `is_stale` flag is **already
  served** (`portfolio.py:266`; `PricingRow.is_stale`) and is the exact summand
  behind the banner count (`/portfolio/summary.stale_count`, one shared reader
  `value_portfolio`) — presentation gap only, no backend change.
  - **Rendered** (smallest ratified-component answer, no new component): a **Stale**
    `StatusChip` marker in the Status cell (the served flag, attention tone,
    "Stale" GLOSSARY term).
  - **Findable:** the rows are **default-ordered stale-first** (pinned to the top,
    identifiable on arrival with zero interaction) and the diagnostics `DataTable`'s
    existing `sort`/`onSort` are now **wired** (the columns were flagged
    `sortable` but inert — clicks did nothing; the headers now actually sort).
  - **One source, pinned:** a backend reconciliation test asserts
    `sum(is_stale)` in the pricing-health payload **==**
    `/portfolio/summary.stale_count` (banner count == marked rows, by construction).
    The frontend guard asserts the marked rows are exactly the stale ones and are
    the top rows; the stale-banner → Pricing Health dev-smoke journey now asserts
    **identifiability at the destination**, not just arrival.

## DELTA NOTE — 2026-07-18 (R-38 data-feed-routing Phase 3b re-walk batch 3, §14dr-8)

- **Async refresh/save actions now give perceptible feedback + guard re-clicks
  (fix-at-standard, DESIGN-SYSTEM §5.4).** **Verify-first:** the header "Refresh all"
  already set `aria-busy` + a served toast, but with **no spinner** the pending flash was
  imperceptible on a fast backend (the owner clicked 4×), and the **per-row Refresh** and
  **Save correction** had **no in-flight guard at all** (re-clickable). Fix:
  - The shared `Button` gains a **`loading`** prop (disabled + `aria-busy` + a perceptible
    in-button spinner, stilled under reduced motion). The **"Refresh all"** icon now
    **spins** while refreshing; **Save correction** is a `loading` `Button`; **per-row
    Refresh** is guarded (a re-fire while in flight is ignored, and the menu item disables).
  - Completion stays the **served-outcome toast** (`Refreshed N of M…`, `Source corrected
    for …`) — never an invented client result. The honest disable rules (no-egress,
    invalid input) are unchanged.
  - **Sweep:** the standard was applied across the data-feeds surfaces — Settings feed
    **save/test** and the routing-matrix **Add rule**.
  - Fail-first: a `Button` unit test (loading → disabled + `aria-busy` + spinner, click
    guarded) and a Pricing Health integration test (Save correction disables in-flight,
    a re-click fires no second call, completion toast on resolve) — both RED before.
    Pricing Health pre-pass re-run stated in the report.

## DELTA NOTE — 2026-07-19 (R-43 §18-R4, F-7 ruling (a))

- **The priority chain now distinguishes "keyed here" from "supported, no key".**
  **Verify-first (§18-F7b #1):** the chain the owner saw was **not** bad data — it is the
  shipped policy constant `DEFAULT_PRIORITY` (`router.py`), which by design names every
  provider that *could* price the lane, including keyed ones this instance has no
  credential for (`eodhd`, `kite`). Rendered as an undifferentiated list of pills, those
  entries read as **providers that do not exist**; that false alarm survived **two levels
  of review** before the dumps falsified it. The defect was therefore **presentational,
  and real**.
- **Fix.** `route()` now also returns `priority_chain_detail` — the **same** chain, in the
  same order, each entry carrying `keyed` + a served `note`. An entry whose provider has
  `needs_key=True` and no credential on this instance is `keyed: false` with the **served**
  note **`(no key)`**; every other entry is unannotated. The diagnostics modal renders an
  unkeyed entry with `StatusChip muted` (the ratified disabled dimming, DESIGN-SYSTEM §5
  amendment 2026-07-19) and appends the **served** note verbatim — **no frontend-invented
  copy** (D-105).
- **What did NOT change.** The chain is still **read-only** (D-072) and still **selects
  nothing** (§18-F7b #2 — an unkeyed entry was already inert). No provider was removed from
  the policy, no route changed, and `priority_chain` is served unchanged for existing
  readers. Presentation only.
- **One derivation.** "Does this instance hold a credential for this provider" is now the
  single helper `_is_keyed()`, shared with the routing-matrix keyed gate (§9-7) — which
  keeps its conservative unknown-case answer (a gate must never price through a credential
  it cannot see; an annotation must never assert an absence it cannot see).
- **Fail-first:** `tests/unit/test_chain_keyed_presentation.py` (the §18 pin —
  SBICARD.BSE's chain renders `kite`/`eodhd` unkeyed while the keyed provider renders
  normally; keyless/terminal entries never annotated; a credential flips the entry;
  routing unchanged) and a Pricing Health frontend test (unkeyed pill is `muted` + carries
  the served note; a keyed pill is neither) — both RED before.
- **ACCEPTED-page rule honoured:** scripted pre-pass re-run on touch — see the run recorded
  in this note's batch (isolated stack, owner's 5173/8321/`~/.ledgerframe-data` untouched).

---

## DELTA NOTE — 2026-07-20 (R-LEGAL §11-1 rename, regularization)

**One served string changed. Nothing else on this page moved.**

`PricingHealth.tsx` served, in the no-egress banner:

> Refresh unavailable — no-egress is on; prices degrade to honest stale **(Guarantee 5)**.

The owner's §11-1 ruling retired *"Product Guarantees"* / *"Guarantee n"* in favour of **Product
Commitments** / **Commitment n** — *"guarantee" is warranty-family vocabulary and the licence's
position is NO WARRANTY (AGPL section 15)*. **The claims are unchanged; this is a rename.** The
banner now reads **(Commitment 5)**.

**WHY THIS TOOK ITS OWN DELTA INSTEAD OF RIDING THE RENAME COMMIT.** The rename's grep found
exactly **one** user-facing instance of the retired term outside Legal, and it was this one — on a
page **already accepted**. The standing CLAUDE.md rule is that a change to an accepted surface
ships **with a dated delta note in that page's plan file and that page's pre-pass re-run, in the
same delta**; flagging it in a close report is explicitly not sufficient. So it was carried out of
`fc506c5` deliberately and landed here. (The ~25 `Guarantee 3/5` **code comments** across the
frontend are internal decision-lineage, not UI copy, and stay — §11-B.)

**PRE-PASS RE-RUN — isolated stack, 2026-07-20.** Backend `:8399` on a temp data dir with demo
seed; Vite dev `:5199` proxying to it. **The owner's `:8321` / `:5173` / `~/.ledgerframe-data` were
not touched**, and `.env` was snapshotted before and restored after.

| Check | Result |
|---|---|
| Page renders, `h1` = "Pricing Health" | ✅ |
| The changed banner rendered (no-egress ON) | ✅ *"…degrade to honest stale **(Commitment 5)**."* |
| `"Guarantee"` anywhere in the rendered page | ✅ **absent** |
| Console errors (light + dark, 1440×900) | ✅ **0** |
| Portfolio confidence · per-holding diagnostics · staleness line | ✅ unchanged |

⚠ **The gate was pre-accepted over the API for this run.** The acceptance gate (§11-5) is
server-side and live, and the *frontend* gate had not shipped at this point — so an un-accepted
isolated instance answers **451** to every data read and the page would have rendered empty. This
is stated because a pre-pass whose setup silently differs from a user's first run is not the same
walk the user gets.

**A REAL DEFECT THE PRE-PASS CAUGHT, recorded because it is the argument for driving the browser.**
The first attempt rendered **no `h1` at all** and logged a 500. The cause was in this very delta:
the explanatory JSX comment had been placed **inside** `{noEgress && ( … )}`, and a parenthesised
JSX expression admits exactly one child — so the file did not parse and the whole route was dead.
A diff review reads that comment as obviously inert. **It broke the page.**

## DELTA NOTE — 2026-07-24 (R-63 pricing-routing reliability — the CONSOLIDATED accepted-surface rite)

**Pricing Health is CLOSED/accepted; this is the dated delta note the guard-REDs-an-accepted-surface
rite requires (CLAUDE.md), discharged ONCE for ALL R-63 changes to this page** per the recorded rite
consolidation (`r63-pricing-routing.md` §-ledger, owner ruling 2026-07-23). Every served string added
here is **PROPOSED** and is ratified only at the owner's 0a look.

**Folded R-63 deltas on this page, each by commit:**
- **Phase 2 Delta 2.2 (`c882648`)** — the per-holding **typed-failure drawer**: distinct causes
  (`parse_error · throttled · unmapped · errored · empty · no_key · unsupported`) named where the old
  flat "none" stood; `throttled` carries "last throttled at T — will retry".
- **Phase 3 (`2a9fa1e`)** — the read-only **priority-chain display** now leads **free-first**
  (yahoo-before-paid within capability); a visible-state change on this page.
- **Phase 3.5 (`e7a7e94`)** — the **duplicate-instrument banner** (mirrors the identifier-duplicate
  banner): "N duplicate instruments … Resolve on Holdings; new duplicates can no longer be created."
  Surfaces any pair that pre-dates the identity guard; the owner resolves it on Holdings (§9-i).
- **Phase 4 (`7ef6f15`)** — **head=X / priced-by=Y** provenance: the Source column shows "Y (head X)"
  when the route head (`route_source`) differs from who priced the row (`source`), so a fallback-net
  catch is never hidden (§9-1, AC-5).
- **Phase 5 (the provider doctor)** — the on-demand **provider-doctor panel** (≤1 egress call per lane,
  calls counted on screen, verdicts redacted, parse-empty = FAIL); folded here (see the commit in the
  R-63 close record).

**Pre-pass re-run (the rite's second obligation):** run ONCE after Phase 5 so the single drive covers
every delta above **including the doctor** — Pricing Health on an isolated demo instance, **both
themes**, 0 non-benign console errors, screenshots looked at. Recorded in the R-63 Phase-5 / 0a report
and back-linked here on completion. *(A close-report flag is explicitly NOT sufficient — CLAUDE.md.)*

**✅ PRE-PASS RE-RUN — DONE 2026-07-24.** Driven on an isolated demo instance (temp `LEDGERFRAME_DATA_DIR`,
Vite dev :5199 → backend :8399, the owner's live stack and his AV key never touched — the key was
**overridden to `INVALID-DOCTOR-TEST`** so his credential was never used; repo-root `.env` snapshotted
and **hash-verified identical** after, throwaway driver + config deleted). **Both themes, 0 non-benign
console errors** each. Every R-63 delta on this page walked and **screenshots looked at**: the
typed-failure drawer (throttled with "last at T", empty, parse_error, no_key, unsupported, unmapped),
the free-first priority chain (leads `yahoo`, `eodhd (no key)` muted), the duplicate-instrument banner
(TSLA pair), head=X/priced-by=Y provenance (`yahoo (head alphavantage)`, `yahoo (head mock)`), and the
provider doctor in **both** postures (no-egress → 0 calls / all `skipped_no_egress`; egress-on with the
invalid key → **3 live calls, `alphavantage` FAIL, redacted, key never on screen** — AC-13/14 confirmed
on camera). Assets `docs/plans/assets/r63-prepass-pricing-health-{light,dark}.png` + the `r63-0a-pricing-*`
/ `r63-0a-doctor-*` / `r63-0a-dup-banner-*` specimens. **Two findings** raised for the owner's 0a look
(see the R-63 0a report / `r63-pricing-routing.md` §-ledger): (i) manual holdings render `null (head
manual)` in the Source column (the netCaught branch on a null `source`); (ii) the AV adapter logs AV's
error text verbatim, which can echo the submitted key into the server log on the index-fetch path
(the doctor *response* is redacted; this is a separate adapter behavior).

**✅ 0a RATIFIED AS WALKED — 2026-07-24 (owner, by looking).** The R-63 Pricing Health deltas are
**ratified**: the **head=X / priced-by=Y provenance**, the **failure-state drawer copies**
(throttled/empty/parse_error/no_key/unsupported/unmapped, `_FAILURE_NOTE_PROPOSED`), the **duplicate-
instrument banner**, and the **no-egress provider-doctor copy**. **Loop-2 fix (W-b):** the doctor's
`coingecko`/`ecb_fx`/`amfi_nav` lanes now report the honest **`not_run`** state (was the scaffolding
`proposed`); **(W-c):** the UNSUPPORTED specimen was re-seeded self-consistently (a `bond` with no source
and no price). The PROPOSED copy stands as walked; full ratification is logged at the R-63 close after
3a/3b. *(F-A `null (head manual)` and F-B key-echo logging remain OPEN — not dispositioned at this walk.)*

**✅ F-A FIXED — 2026-07-24 (`05be910`, owner ruled fix-in-R-63).** The Source column no longer renders
the `null (head manual)` code token (§11-I): the pricing-health row serves **`source="manual"`** for a
manual holding (no market instrument), matching its `route_source="manual"`, so the cell reads **`manual`**.
Backend-only; **copy PROPOSED**. *(The `:642` line above stays as accurate 0a history — F-A WAS open at the
walk.)* **The refreshed manual-rows frame lands in the CLOSE's final specimen set**, and **the 3a scripted
pre-pass re-run discharges the re-run half of the accepted-surface rite for this F-A delta** (the delta-note
half is this note).

**⊕ PHASE B ADDENDUM — 2026-07-24 (F-C / I-10, `275852f`).** A live-instance behaviour change on this
page, under the same consolidated rite. The AARK defect (F-C): a `mock`-sourced quote laundered through
the CSV lane rendered here at Confidence **100/high**. The fix removes it — a **once-per-install
`repair_quote_demo_residue`** now runs at the **top of the pricing-health read** (before valuation, gated
to live instances), deleting stored demo/synthetic quote rows. So a formerly-phantom holding now renders
its **true unpriced/typed state** (Estimated / the typed failure note) instead of a high-confidence
fabrication; the confidence law (Option 2) additionally caps any residual mock price below "high". **No
new served string on this page** (existing typed-state copy carries it). **Rite re-run half:** rides the
**close's final 3a specimen set** (the severed-fallback typed states on camera), F-A precedent.

**⊕ R5 RATIFICATION FLIP — 2026-07-24 (owner).** The PROPOSED Pricing Health strings above — the
head=X/priced-by=Y provenance, the failure-state drawer copies, and the duplicate-instrument banner — are
**RATIFIED** (rendered confirmation still at the close's final look).

**⊕ RITE RE-RUN — DISCHARGED 2026-07-24 (close step 1, the final 3a scripted pre-pass).** The
guard-REDs-an-accepted-surface rite's **second obligation (a page pre-pass re-run) is discharged here for
ALL accumulated Pricing Health deltas** — F-A (I-8) and the Phase-B quote-residue repair. Driven on an
isolated **live** instance (`:8399`/`:5199`, key overridden to `INVALID-DOCTOR-TEST`, `.env` hash-verified,
stack torn down), **both themes, 0 non-benign console errors, 13/13 assertions**. On camera: manual rows
read `manual` (no `null (head manual)`); a **severed-fallback** row (`csv (head alphavantage)`, typed
`empty`, no mock); the **confidence-law cap** (a `mock` price at **40 · low** with "not from a live source
(capped)"); the head/priced-by provenance and the duplicate banner. Assets
`docs/plans/assets/r63-3a-close-{pricing-health,aark-empty,confidence-cap}-{light,dark}.png`. Specimen
inventory in `r63-pricing-routing.md` (CLOSE STEP 1). *(A close-report flag alone is NOT sufficient —
CLAUDE.md; this is the on-page record.)*

**Scope (explicit, not implied):** this is a **delta-focused** re-cut of the Pricing Health surfaces
**changed since the 28/28 first-3a acceptance** (`4088326`) — provenance, F-A manual rows, the duplicate
banner, and the new severed-fallback + confidence-cap. The **throttled** drawer, the **unsupported** (bond)
drawer, and the **provider-doctor** panel are **NOT re-cut here** and do not need to be: `git diff
4088326..HEAD` shows this page's sole renderer (`frontend/src/routes/PricingHealth.tsx`) and
`app/services/provider_doctor.py` are **byte-identical**, and the only Phase-B change on the pricing-health
read is mock-scoped (the confidence cap is guarded `if source in {mock,demo}`; the residue repair deletes
only mock/demo rows — never a throttled/unsupported/doctor row). Those three surfaces keep their 28/28
coverage by byte-identity. Reconciliation table in `r63-pricing-routing.md` (CLOSE STEP 1).

---

## DELTA NOTE — 2026-07-24 (R-63 closing session — F-E/F-F, the guard-REDs-an-accepted-surface rite)

**Pricing Health is CLOSED/accepted; this dated note records the two R-63 closing-session deltas on this
page (F-E and F-F), per the guard-REDs-an-accepted-surface rite (CLAUDE.md). Copy is PROPOSED → the owner's
final look; the pre-pass re-run rides this session's final pre-pass (§6).**

**F-E — the duplicate-instrument banner now resolves the ORPHAN case here (ledger I-12, owner ruling R8,
`38f50f9`).** A holdings/transactions purge is a soft-delete, so a legacy duplicate INSTRUMENT pair can
survive and a re-add can strand one copy with zero live references. Holdings is derived from transactions,
so an orphan has no Holdings row — the old *"Resolve on Holdings"* copy was a dead-end for it. The banner now
distinguishes the case: an orphaned duplicate reads *"[SYMBOL] appears more than once. One copy is unused (no
holdings) and can be removed here; the copy your holdings use is untouched."* with a **[Remove unused copy]**
action (ui/Button) wired to `POST /system/instrument-duplicates/{id}/remove`; an all-in-use duplicate keeps
the *"Resolve on Holdings"* copy. The removal refuses a non-orphan (409) and a lone non-duplicate — it can
never delete a legitimate zero-holding instrument (e.g. a watchlist-only row). **New served strings on this
page (PROPOSED):** the orphan banner sentence + the *"Remove unused copy"* / *"Removed the unused copy of
[SYMBOL]."* toast. GLOSSARY: no new **defined** term ("duplicate instrument" ships descriptively, R7; "unused
(no holdings)" is descriptive copy).

**F-F — the confidence card's stale clause is scope-labelled and can no longer flicker against the banner
(ledger I-13, owner ruling R9, `537b79f`).** The card rendered its stale numerator from the shared store but
its denominator from a separate pricing-health fetch, so a refresh could show a transient banner/card
mismatch. The denominator now comes from the SAME shared reader (`/portfolio/summary.holdings_count` →
`useStaleCount().total`), so numerator and denominator move together — banner and card cannot disagree even
transiently. **Changed served string (PROPOSED):** the card clause is now *"{n} of {m} holdings have a stale
price — the same count the Stale banner shows"* (scope word "holdings" distinguishes it from the refresh
toast). The refresh toast (specced in `frontend/src/api/pricing-health.ts` `refreshAllMarketData`, lane
"Quotes & indices") now names its universe: *"Refreshed {r} of {t} refresh targets (holdings, watchlist &
indices)… · {s} still stale"*. The AppShell StaleBanner copy (*"…price is stale"*, holdings) is **unchanged**.

**Verdicts (inner-loop, this session):** PricingHealth vitest **21/21** (+2 across F-E/F-F); backend F-E
`test_orphan_duplicate_cleanup.py` **6/6** + F-F `test_summary_serves_holdings_count_as_the_stale_denominator`;
tsc/eslint/ruff clean. Full backend-suite verdict **2174 passed / 15 skipped, SOLO, both orders, seed 6363**
(ordered 17:09 · randomized 17:26; reconciled 2166→2174 (+8), itemized in `r63-pricing-routing.md` §5).
**Pre-pass re-run: DISCHARGED 2026-07-24** — the guard-REDs-an-accepted-surface rite's second obligation for
these two closing-session deltas. Scripted browser pre-pass on an **isolated** stack (`:8402`/`:5202`, mock
provider so ZERO egress, key overridden, `.env` hash-verified `460a2da0…afae6`, ports torn down), **both
themes, 0 non-benign console errors, 23/23 assertions**, screenshots **looked at**. On camera: the orphan
banner (*"one copy is unused (no holdings)"* + [Remove unused copy]); the scope-labelled card (*"1 of 14
holdings have a stale price — the same count the Stale banner shows"*) with **banner==card agreement pinned**;
the scope-labelled refresh toast (*"…19 of 23 refresh targets (holdings, watchlist & indices) · 4 still
stale"* — proxies, not the 1 holding); the cleanup clearing the banner (*"Removed the unused copy of AAPL."*).
Assets `docs/plans/assets/r63-close2-{orphan-banner,stale-card,refresh-toast,banner-cleared}-*.png`; specimen
table in `r63-pricing-routing.md` §6. *(A close-report flag alone is NOT sufficient — CLAUDE.md; this is the
on-page record.)*

**⊕ TOKEN-GUARD CORRECTION — 2026-07-24 (closing session; the NetWorth.css `--radius-2` precedent).** Running
the full frontend guard suite this session surfaced a **pre-existing `check:tokens` RED on this page**, red
since the Phase-5 provider-doctor CSS shipped (`b72ee18`) and NOT introduced by F-E/F-F: `.ph__doctorname`
and `.ph__doctorsym` referenced **undefined** tokens `var(--font-weight-medium)` / `var(--font-weight-regular)`
(the sanctioned names are `--weight-medium: 500` / `--weight-regular: 400`), so the doctor labels rendered at
the browser default weight — a real cosmetic defect the standing guard flags. Fixed to the defined tokens in
the same delta. Per CLAUDE.md (*"a new guard that reds an accepted surface is a delta on that surface, not a
footnote"* — the same handling the Help close used for `var(--radius-2)` in `NetWorth.css`): this is the dated
on-page record; `check:tokens` is now green (89 tokens, all defined); the pre-pass re-run rides §6.

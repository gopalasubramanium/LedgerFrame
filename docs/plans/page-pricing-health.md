# page-pricing-health.md — Pricing Health (diagnostics) page build plan

**Status: PLAN ONLY — owner reviews §9 before any code.** Drafted 2026-07-12 from
`TEMPLATE-page-build.md` (incl. the §7/§8 fail-first + reproduce-the-defect-first amendments, the
Phase-3a scripted-pre-pass standard, and the progressive-per-card-loading overview standard).
Verify-first pass done (§10 — read what the freshness/provenance/routing/confidence readers actually
serve before assuming shapes, D-019). **Nothing is built.** Every ambiguity is in §9; the owner
resolves them.

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
| Rotation eligibility | Reports pages — **presumably NOT dashboard-rotation eligible; confirm ND-10** | IA §3 (D-044) |
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

## 9. NEEDS DECISION — OPEN (owner resolves; nothing resolved here)

Each item is an ambiguity the specs do not settle. Options laid out; **I resolved none.** Items
flagged **⚠ VERIFY-FIRST DIVERGENCE** contradict a premise in the brief and need an owner call.

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
component-shape calls (ND-5 routing chain, ND-6 confidence card) and the confirms. **No further build
until the owner resolves §9.**

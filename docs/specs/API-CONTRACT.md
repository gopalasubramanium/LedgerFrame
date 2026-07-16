# API-CONTRACT.md — v2 baseline HTTP contract

**Normative for the HTTP surface.** `docs/specs/API-CONTRACT.json` is the
**frozen v2 baseline contract as inherited** from the v1 backend (copied in under
`docs/plans/backend-copy-in.md`, then pruned in Phase B). It is the OpenAPI 3.1
document generated from the running FastAPI app: **121 paths**, generated
deterministically (sorted keys) so diffs are meaningful.

This is the *starting* contract, not the *target* contract. The specifications
(INFORMATION-ARCHITECTURE.md + DECISIONS.md) will **add, rename, and remove**
endpoints as v2 features are built. The delta table below records every such
change we already know about, each with its decision ID, so the frozen baseline
and the intended destination are both visible.

`docs/openapi.json` holds the same bytes in the machine location the inherited
`tests/integration/test_openapi_contract.py` reads; both files are written and
checked together (see the drift rule).

---

## The rule (drift control)

**Any change to an endpoint (path, method, request/response schema, operation)
MUST regenerate and commit this contract in the SAME commit.**

```bash
python scripts/check_api_contract.py --write   # re-freeze after an intended change
python scripts/check_api_contract.py           # drift check — exits 1 if stale
make api-contract-check                         # same check, via make
```

The drift check regenerates the contract from the live app and fails if it
differs from the committed `docs/specs/API-CONTRACT.json` (or `docs/openapi.json`).
Run it in CI.

---

## Delta table — endpoints the specs will change

`kind`: **add** (new endpoint) · **rename** (path/label change) · **remove**
(superseded/deleted) · **reshape** (same path, changed payload) · **present**
(the inherited contract already satisfies the decision — no change needed).
"Current" paths exist in the frozen baseline today.

**Delivered 2026-07-10 (Holdings page-build Phase 0b):** `GET /api/v1/refdata`
(D-005), `GET /api/v1/portfolio/holdings.csv` (D-050), the `TransactionIn`
merger reshape (D-019, adds `related_instrument_id`), and the typed
`GET /api/v1/portfolio/holdings` response (§9-6). Later same-day additions:
`GET /api/v1/portfolio/deleted-count` (§9-23, +1 → 124) and
`GET /api/v1/refdata/txn-applicability` (D-090, +1 → 125) and
`GET /api/v1/portfolio/transactions.csv` (D-095 round-trip, +1 → **126**). Baseline
is now **126 paths**; the per-master `*/meta` removals (D-005) stay pending until
their pages migrate.

**Delivered 2026-07-10 (D-094):** `GET /api/v1/portfolio/transactions` gained
server-side **sort / dir / filter / offset / limit** query params **plus `total`,
`offset`, `limit`, `sort`, `dir`, `filter`** in the response, so sort and filter
run over the full dataset (not the loaded page) with windowed loading and an
explicit total — the old 500-row silent cap is gone. Same-path **reshape** — no
new path; still **125 paths** (row below).

| Kind | Endpoint (current → intended) | Decision | Note |
|------|-------------------------------|----------|------|
| **add ✅** | `GET /api/v1/refdata` | **D-005** | **Delivered 2026-07-10.** Single fixed-vocabulary endpoint (22 vocabs). Retires the per-master meta endpoints and all frontend inline lists. |
| **add ✅** | `GET /api/v1/refdata/txn-applicability` | **D-090** | **Delivered 2026-07-10.** AssetClass → offered TxnTypes for the Add-flow Type dropdown (MASTER-DATA §10). Form-level filter only; frontend zero-copy (D-005). |
| **add ✅** | `GET /api/v1/instruments/search` | **D-097** | **Delivered 2026-07-10.** Class-aware picker search: `existing` (picked class) · `other_class` (navigate-only cross-class) · `suggestions` (provider routed by class). +1 path → **127**. |
| **reshape ✅** | `GET /api/v1/portfolio/holdings` (+ `?symbol=`) | **ND-1 / P-3** | **Delivered 2026-07-10.** `symbol` filter scopes the canonical holdings reader to one instrument (Instrument Detail "position if held") — a filter, no new endpoint, no recompute. |
| **reshape ✅** | `GET /api/v1/refdata` (+ `source_override`) | **ND-3** | **Delivered 2026-07-10.** Per-instrument source-override routing vocab (`auto` + market-router providers, sourced from CAPABILITIES). |
| **reshape ✅** | `GET /api/v1/refdata` (values → `{value, label}`) | **item 3b** | **Delivered 2026-07-10.** Each vocab now serves DISPLAY LABELS so the UI never hardcodes a mapping (D-005): acronyms/brands overridden (ETF, AMFI, CoinGecko), snake_case titleized (mutual_fund → "Mutual fund"). |
| **reshape ✅** | `GET /api/v1/instruments/{symbol}` | **ND-4** | **Delivered 2026-07-10.** Typed `InstrumentDetailResponse`/`InstrumentMeta` footprint (contract hygiene, like the Holdings §9-6 reshape). |
| **reshape ✅** | `GET /api/v1/portfolio/transactions` (+ sort/dir/filter/offset/limit + total) | **D-094** | **Delivered 2026-07-10.** Server-side sort/filter/windowing over the full dataset (never the loaded page); default most-recent-first; response carries `total` so the UI states "Showing X–Y of Z" and never silently truncates. Numeric columns cast for value-sort. CSV export stays full-dataset server-side (D-050). |
| **remove ✅** | `GET /api/v1/insurance/meta` → (into `/refdata`) | **D-005** | **Delivered 2026-07-16 (page-insurance §9-3).** Insurance vocab is served by `/refdata` (`policy_type`, `premium_frequency`, `{value,label}`); the duplicate `/insurance/meta` endpoint is deleted. |
| **remove ✅** | `GET /api/v1/estate/meta` → (into `/refdata`) | **D-005** | **Delivered 2026-07-16 (page-estate §9-1).** Estate vocab is served by `/refdata` (`will_status`, `estate_doc_status`, `estate_doc_category`, `contact_role`, all `{value,label}`); the duplicate `/estate/meta` endpoint is deleted. Removal discriminated by response SHAPE (the SPA catch-all serves 200 HTML for any unmatched path). |
| **add ✅** | `GET/POST /api/v1/institutions`, `PATCH/DELETE /api/v1/institutions/{iid}` | **D-008** (page-accounts §9-1) | **Delivered 2026-07-16 (Phase 0 commit 1).** The first user-extensible master-with-CRUD. Typed responses. Unique by NORMALIZED name (trimmed, whitespace-collapsed, case-insensitive `name_key`); display keeps first-seen casing (Amendment F). POST is **resolve-or-create** (a case/whitespace variant returns the existing row). DELETE is **FK-blocked** with a plain-language "merge instead" 400 — the guard is built now; its RED path becomes reachable once the `institution_id` FK columns land (commit 3). Merge is commit 2. +2 paths → **128**. |
| **add ✅** | `POST /api/v1/institutions/merge` | **D-008 / §9-2** | **Delivered 2026-07-16 (Phase 0 commit 2).** **User-driven** merge — the caller names `{survivor_id, duplicate_id}` explicitly; **no fuzzy auto-detection** (spec is silent → not invented). One transaction re-points **both** FK columns (accounts + insurance_policy) off the duplicate onto the survivor and deletes the duplicate. Re-pointing is tolerant of the pre-commit-3 state (no FK columns yet); the referencing-row re-point is proven in commit 3. +1 path → **129**. |
| **reshape ✅** | `POST/PATCH /api/v1/accounts` (`AccountIn` + `entity_id`) | **D-064 / §9-4** | **Delivered 2026-07-16 (Phase 0 commit 4).** `AccountIn` gains `entity_id` (int\|None, **FK-validated** → honest **400** on a nonexistent entity; today it was silently dropped). `_account_dict` now serves `entity_id`. Account-not-found on PATCH is now **404**, input validation **400** (split). |
| **reshape ✅** | `POST/PATCH /api/v1/accounts` (`AccountIn` + `cost_basis_method`) | **D-018 / §9-5** | **Delivered 2026-07-16 (Phase 0 commit 5).** `AccountIn` gains `cost_basis_method` (fifo/average, vocab-enforced → **400**; single-sourced `COST_BASIS_METHODS` also feeds `/refdata`). Served in the report + `_account_dict`. A PATCH that **changes** the method on an account **with transactions** triggers `rebuild_holdings_from_transactions` and returns a `restatement` warning — the realised figures actually move (FIFO 600 → average 450 on the demo AAPL fixture). ⚠ The rebuild/restatement is **behaviour** (invisible to a shape check) — pinned by a test. |
| **add ✅** | `POST /api/v1/entities`, `PATCH /api/v1/entities/{eid}`, `DELETE /api/v1/entities/{eid}` | **D-065 / §9-6 / Amendment H** | **Delivered 2026-07-16 (Phase 0 commit 6).** Entity CRUD (name + `kind` from `entity_kind`, **vocab-enforced → 400**). `ENTITY_KINDS` single-sourced (`services/entities.py`) and served by `/refdata` (the `policy_status` graduation, Amendment H). **DELETE blocked** while any account references the entity — honest **400**, service-level (no cascade; the FK has no `ondelete`). §9-7 / D-029: **no "Household" special-casing** — the lowest-id entity is renamable/re-kindable/deletable under the same guard (no `is_default`). +1 path → **130**. |
| **add ✅** | `GET /api/v1/portfolio/holdings.csv` | **D-050** | **Delivered 2026-07-10.** Server-side holdings CSV export (positions **snapshot / report** — not an import file); formula-injection sanitised; client never generates the file (P-5). |
| **add ✅** | `GET /api/v1/portfolio/transactions.csv` | **D-050 / D-095** | **Delivered 2026-07-10.** Server-side transactions export; columns are exactly the import schema so the file re-imports losslessly (round-trip contract); full dataset regardless of the ledger's UI window. +1 path → **126**. |
| **reshape ✅** | `POST/PUT /api/v1/portfolio/transactions` (`TransactionIn`) | **D-019** | **Delivered 2026-07-10.** Adds `related_instrument_id` — the merger "Absorbed into" target (ratio in `price`). The DB column + `resolve_mergers` already existed; this exposes it in the request body. |
| **reshape ✅** | `GET /api/v1/portfolio/holdings` | **§9-6** | **Delivered 2026-07-10.** Response typed (`HoldingsResponse`/`HoldingView`) — replaces `additionalProperties: true` with an explicit footprint for contract hygiene. Later added **`price_ts`** (as-of ISO, null when unpriced) for the compact StalenessChip (§9-32). |
| **rename** | `GET /api/v1/review/centre` → `GET /api/v1/review` | **D-030** | "Review Centre" retired to "Review". |
| **rename** | `GET /api/v1/portfolio/cost-of-ownership` → `…/ongoing-cost` | **D-029** | "Cost of ownership" retired to "Ongoing cost (expense ratio)". |
| **rename** | `GET /api/v1/portfolio/realised-gains` (+ `.csv`) → "Realised P/L" naming | **D-026** | "Realised gain(s)" retired to "Realised P/L". |
| **retired** | ~~`GET /api/v1/dashboard/home`~~ — **DELETED 2026-07-13** | **page-home §9-4** (D-046/D-038) | The legacy v1 aggregate is **gone**, not reshaped. Home composes from the **canonical readers, one card each** (D-038: a summary reuses the canonical page's reader, never a second code path) with **per-card progressive loading** — which an aggregate cannot give (it is a single gate: the slowest reader would blank the page). |
| **allow-list ✅** | `GET`/`PUT /api/v1/settings` — **`home_quote_source`** ADDED (`markets｜holdings｜global｜watchlist`, default **`holdings`**); default + vocabulary **SERVED** | **page-home §9-7** (D-005/D-078) | Server-persisted (kiosk survives a browser wipe). ⚠ **An allow-list key is INVISIBLE to a shape check** — `/settings` serves a free dict, so the contract regen produces **no diff**. It is pinned by **served-value tests**, not by the schema. |
| **retired** | `GET`/`PUT /api/v1/settings` — ~~**`home_layout`**~~ **REMOVED 2026-07-13** (key, default, and served vocabulary) | **page-home §12ho1-6** (D-046 AMENDMENT / D-078) | The **Simple layout was removed** — Home ships ONE composition, so a layout key would store a choice nothing can make. Leaving it would be a **write-only key**, exactly what D-078 forbids. |
| **behaviour ✅** | `PUT /api/v1/settings` — an **unknown key is now an honest 400** (it used to be silently skipped: **200, changed nothing**) | **page-home §12ho1-6** | The silent skip is what made the original Phase-0 bug invisible for a whole build; delisting `home_layout` would have re-armed the same trap, so the trap went instead. |
| **reshape** | `POST /api/v1/ai/chat`, `GET /api/v1/briefing`, instrument explainer | **D-067 / D-068 / P-6** | All AI surfaces ride the single grounded+validated pipeline; no direct model calls. |
| **present** | `GET/POST /api/v1/tokens`, `DELETE /api/v1/tokens/{id}` | **D-069** | API-token management already in the baseline — no change. |
| **present** | `GET/POST /api/v1/watchlists` (+ items) | **D-052** | Watchlist management already present (Markets-only in UI). |
| **present** | `GET /api/v1/portfolio/pricing-health` (+ `/refresh`) | **D-072** | Pricing Health diagnostics present (visibility yes, priority editing no). |
| **present** | `GET /api/v1/markets/global` | **D-051** | Markets **Global tab** — KEEP. Not the D-042 frontend `/global` page. |
| **present** | `GET`/`POST /api/v1/goals` · `PATCH`/`DELETE /api/v1/goals/{id}` | **D-057** | **Recorded 2026-07-15 (page-cash-flow §9-9).** Goals — records + **live progress** against the goal's basis. **PER-ROW CRUD**, PIN-gated. Frozen since the baseline; never listed here. |
| **present** | `GET`/`POST /api/v1/obligations` · `PATCH`/`DELETE /api/v1/obligations/{id}` | **D-057** | **Recorded 2026-07-15.** Obligations — recurring/one-off cash flows, **`kind ∈ {expense, income}`** (income is a **flagged obligation**, not a signed amount). **PER-ROW CRUD**, PIN-gated. |
| **present** | `GET`/`POST /api/v1/contributions` · `PATCH`/`DELETE /api/v1/contributions/{cid}` | **D-057** | **Recorded 2026-07-15.** Contributions — recorded plans. **PER-ROW CRUD**, PIN-gated. ⚠ **Contributions NEVER reduce the runway** (§0-protected) — now **pinned by tests**, not just by construction. |
| **reshape ✅** | `GET /obligations`, `GET /contributions` (+ per-row `monthly_equivalent`, `monthly_equivalent_display`) | **page-cash-flow §9-4** | **Delivered 2026-07-15.** The per-row monthly rate was **not served** — only the totals were — so a *"≈ 500/month"* column would have been **client money math** (forbidden). The factor is applied **server-side**. **`once` serves `null`, not 0**: a one-off has **no** monthly rate, and a served `0` would read as *"this costs nothing per month"*. |
| **reshape ✅** | `GET /goals`, `/obligations`, `/contributions`, `/portfolio/runway` (+ `*_display` money strings) | **page-cash-flow §9-5** (**D-105**) | **Delivered 2026-07-15.** Money is formatted in the **backend** and rendered **verbatim** — the D-105 scope amendment applied to the planning readers. **`None` passes through**, so an absent figure (a goal with `basis = none`) stays honestly empty and is **never a fabricated 0**. Percentages stay numbers. |
| **behaviour ✅** | `POST`/`PATCH /goals`, `/obligations`, `/contributions` — **served `detail` is USER copy**, and **`currency` is validated ∈ the master → 400** | **page-cash-flow §9-6** (D-005 / Gate A9) | **Delivered 2026-07-15.** *"kind must be one of ('expense', 'income')"* printed a **raw Python tuple** to a human. And **`currency` was never checked against the master** on any of the three writers — the **A9 free-text-enum defect, in three more places**. Both fixed **at the source**. The app-wide grep also caught **`PUT /settings`** serving a raw list (*"unknown setting key(s): ['foo']"*) — fixed in the same sweep. ⚠ Invisible to a shape check — pinned by **tests**. |
| **behaviour ✅** | `DELETE /goals/{id}`, `/obligations/{id}`, `/contributions/{cid}` — **missing id → honest `404`** | **page-cash-flow §9-7b** | **Delivered 2026-07-15.** Deleting an id that never existed returned **`200 {"ok": true}`**, so the UI **could not tell "deleted" from "there was nothing there"** — on the platform's **first destructive UI action**. |
| **present** | `GET /api/v1/portfolio/scenarios` | **D-058** | **Recorded 2026-07-15 (page-scenarios §9-11).** The fixed shock set + exposures + liquidity what-ifs — *a scenario, never a forecast*. **Read-only** (no write path). Frozen since the baseline; never listed. |
| **behaviour ✅** | `GET /portfolio/scenarios` — **`?entity_id` REJECTED (400)** | **page-scenarios §9-8** | **Delivered 2026-07-15.** The asset shocks would scope to one entity while the liquidity what-ifs stay **household** (runway/obligations have no entity scope) — a silently mixed-scope, meaningless comparison. Now an honest **400**. Per-entity scenarios → **R-35**. |
| **reshape ✅** | `GET /portfolio/scenarios` (+ `*_display` money strings) | **page-scenarios §9-3** (**D-105**) | **Delivered 2026-07-15.** `net_worth`, every shock's `exposure`/`delta`/`new_net_worth`, and the liquidity figures gain served display strings, rendered verbatim. Percentages stay numbers. |
| **reshape ✅** | `GET /portfolio/scenarios` (+ `stale_inputs`, `low_confidence_inputs`, `inputs_stale`, `inputs_note`) | **page-scenarios §9-2** (Guarantee 3; the A10 precedent) | **Delivered 2026-07-15.** A what-if computed on **stale** values now says so — the valuation carried `has_stale`, the payload had dropped it. Same shape as the Policy/Cash-flow A10 annotation, from **one shared reader** (`confidence.portfolio_input_quality`). |
| **behaviour ✅** | `GET /portfolio/scenarios` — **exposures from the canonical `allocation()`** | **page-scenarios §9-4** (P-1/D-038; A11) | **Delivered 2026-07-15.** `crypto`/`property` were re-derived in a private loop; they now read Portfolio's allocation-by-class, and `equities`/`foreign_fx` are **named sums of the canonical buckets** — one derivation, pinned by an equality test. The private loop is **deleted**. |
| **behaviour ✅** | `GET /portfolio/scenarios` — the drawdown note uses **"expenses"**, not "obligations" | **page-scenarios §9-10 / SN-1** | **Delivered 2026-07-15.** `next_12m_total` is expense outflows only, so the served note aligns to the §12cf1-2 / §12rv2-1 vocabulary. |
| **present** | `GET /api/v1/policy` | **D-055** | **Recorded 2026-07-14 (page-policy §9-9).** Stored policy **intent** (name, base currency, `default_band_pct`, `max_position_pct`, notes, targets). Already in the frozen baseline — the inherited contract satisfied D-055, so no delta was ever written, which is why a text search for "policy" read as inconclusive. **Doc repair, no contract change.** |
| **present** | `GET /api/v1/policy/drift` | **D-055** | **Recorded 2026-07-14.** Live drift / band status / coverage / untargeted / concentration. **Drift is computed live, never stored.** *(Reshaped in the same batch — see the rows below.)* |
| **present** | `PUT /api/v1/policy` | **D-055 / D-103** | **Recorded 2026-07-14.** Policy meta. **PIN-gated (`require_auth`)** — the [S] gate was already in place. |
| **present** | `PUT /api/v1/policy/targets` | **D-055 / D-103** | **Recorded 2026-07-14.** The target set — **atomic BULK REPLACE** (≤200 targets), PIN-gated. There is deliberately **no per-row POST/PATCH/DELETE** (page-policy §9-2). |
| **behaviour ✅** | `PUT /api/v1/policy/targets` — `bucket` validated against the **dimension's master**; unknown → **400** | **Gate A9** (D-005 / CLAUDE.md) | **Delivered 2026-07-14.** `bucket` was a **free-text enum** on a categorical field: a garbage bucket was accepted (200) and silently inflated `coverage_pct`. Masters: AssetClass (13) · `SUPPORTED_CURRENCIES` · REGIONS (6, D-083). Stored in the **master's spelling**. ⚠ An **allow-list/value** guard is INVISIBLE to a shape check — pinned by **served-value tests**, not the schema. |
| **reshape ✅** | `GET /api/v1/policy/drift` (+ `stale_inputs`, `low_confidence_inputs`, `inputs_stale`, `inputs_note`) | **Gate A10** (Guarantee 3) | **Delivered 2026-07-14.** A verdict derived from **stale/low-confidence** prices could present as **fresh**. Guarantee 3 does not exempt a **derived** verdict. `/review` `sections.policy` carries the same annotation **from the same reader**, so the two cannot disagree. |
| **reshape ✅** | `GET /api/v1/policy/drift` (+ `gross_assets`, `gross_assets_display`; **− `total_value`**) | **page-policy §9-3** (P-1 / D-033) | **Delivered 2026-07-14.** The payload served a **NET** total (`total_value`) beside percentages denominated in **GROSS** assets — two numbers that **cannot be reconciled** once a liability exists. `total_value` is **REMOVED** (Net worth is its canonical home, P-1); the actual denominator is served instead, at the **same precision Portfolio serves it** (one denominator, one home). |
| **reshape ✅** | `GET /api/v1/policy/drift` (+ `*_display` money strings) | **page-policy §9-6** (**D-105 SCOPE AMENDMENT**) | **Delivered 2026-07-14.** **D-105 is ruled to bind ALL money, not just quote prices:** `gap_base_display`, `actual_value_display`, `value_display`, `gross_assets_display` are **served display strings, rendered verbatim** (the frontend formats no money). **Percentages continue to format client-side** — D-105 is scoped to money. |
| **reshape ✅** | `GET /api/v1/policy/drift` — `concentration[].symbol` (**nullable**) | **page-policy §9-17** (D-098) | **Delivered 2026-07-14.** An entity reference **links** to `/instrument/{symbol}`. A **manual asset has no symbol** → honest `null` → rendered as **plain text, never a guessed route**. |
| **behaviour ✅** | `PUT /api/v1/policy/targets` — **per-dimension Σ `target_pct` > 100 → 400** | **page-policy §12po1-8** | **Delivered 2026-07-14 (owner walk).** The owner set a policy whose asset-class targets summed to **184%** and it was **ACCEPTED**. Such a policy can never be met by ANY portfolio: every bucket sits permanently out of band, reporting a gap that cannot close. Counted **per dimension** (a full asset-class policy + a full currency policy is 100% + 100%, and that is correct). **Sums UNDER 100% stay legal** — a partial policy deliberately does not speak for the rest, which is exactly what Coverage means. ⚠ A **value/behaviour** guard is invisible to a shape check — pinned by tests, not the schema. |
| **behaviour ✅** | `PUT /api/v1/policy/targets` — **`liability` is not a targetable asset class → 400** | **page-policy §11-5** | **Delivered 2026-07-14 (owner-ruled).** Gross assets **exclude liabilities by construction** (D-033), so a `liability` target's actual share is permanently **0.00%** — the page would report it "Under" its band **forever**, with a gap that can never close. A policy allocates **assets**. |
| **behaviour ✅** | **Served 400 `detail` strings are USER COPY** — `PUT /policy/targets`, `PUT /policy`, `PUT /settings`, `PUT /instruments/{symbol}/ongoing-cost` | **page-policy §12po1-6** | **Delivered 2026-07-14 (owner walk).** *"target_pct must be 0–100"* was shown to the user — that is us talking to ourselves. Every served validation `detail` is now plain language, fixed **at the source** and **app-wide** (the same grep found `base_currency`, `home_quote_source`, `annual_cost_bps`). `bucket`/`dimension` are **kept** — they are ratified GLOSSARY terms, i.e. the user's vocabulary, not internal names. Strings **PROPOSED → ratify at the re-verify**. |
| **behaviour ✅** | `GET /api/v1/policy/drift` — **`?entity_id` is REJECTED (400)** | **page-policy §9-21** | **Delivered 2026-07-14.** Policy targets are **household-global** (no entity FK), so scoping the *actuals* to one entity compared it against a policy that was never its own — precise-looking and meaningless. **A silently meaningless comparison is an API honesty trap**, so the param is an honest **400**, not ignored. Per-entity policies → **R-33**. |

### Frontend-route redirects — *not* API paths (recorded for completeness)

The IA route renames are **frontend** routes (D-022/D-056/D-042); they are **not**
server endpoints, so they are not rows above:

- `/snapshot` → `/net-worth`, `/planning` → `/cash-flow` (redirects kept for
  migration); `/global` removed with no redirect.
- At the API level these already resolve: net-worth data is
  `GET /api/v1/net-worth/history`; planning-domain data is `/goals`,
  `/obligations`, `/contributions`; there is **no** server `/snapshot`,
  `/planning`, or `/global` path to rename.

---

## Provenance

- Generated from `app.main:create_app().openapi()` after the Phase B prune.
- Serialization: `json.dumps(spec, indent=2, sort_keys=True) + "\n"` (see
  `scripts/check_api_contract.py`) — byte-stable across regenerations.
- Baseline size at freeze: **121 paths** (OpenAPI 3.1.0).

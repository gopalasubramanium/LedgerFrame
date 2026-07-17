# data-feed-routing — Provider routing matrix (ROADMAP R-38) build plan

> **STATUS: FULL PLAN — PLAN ONLY, NOT BUILT.** R-38 was **ACTIVATED as the NEXT
> milestone** (owner ruling 2026-07-18, page-settings close; `ROADMAP.md:50`),
> plan-file-first / verify-first (the R-35 precedent). This file expands the
> kickoff stub into the full plan per `TEMPLATE-page-build.md`. **Nothing is built
> yet — no code, no migration, no contract change.** Every claim is grepped from
> the live code / specs with a `file:line` cite. The §9 one-pass happens in chat
> with the owner; **no §9 item's resolution is a commitment** until the owner
> rules. Frontend exit code for this plan-only commit: **N/A** (no frontend
> touched).

---

## 0. WHAT R-38 IS

A **provider routing matrix**: a **per asset-class × listing-country** mapping that
says *which provider prices this kind of instrument in this market*. Today routing
is resolved by a fixed lane policy (`DEFAULT_PRIORITY`) + the active provider + a
per-instrument `source_override`. R-38 adds a **user-editable mapping table** as one
new precedence layer, with a canonical editor in **Settings → Data feeds** (§14st-1)
and per-cell provenance surfaced (read-only) on **Pricing Health**.

The platform still **never fabricates a price** and **never advises**; this is a
routing-*configuration* surface, not a pricing change. It **inherits verbatim** the
router's standing guarantee: *the active market provider can never overwrite a NAV
or a canonical-id crypto price with a wrong equity quote*
(`05-PROVIDERS-AND-ROUTING.md:106-107`; `router.py:245-276` + `services/market.py`
`refresh_quote`).

**R-38 is NOT R-13.** D-072 parks *per-lane provider **priority** editing* as R-13
(*"no user-editable provider priority in v2 — visibility yes, editability no"*,
`ROADMAP.md:26`; `page-pricing-health.md:146`). R-38 is a **different shape** — a
cell *selects one provider* for a class×country; it does **not** reorder a lane's
priority chain. The editor lives in **Settings**, not Pricing Health (which stays
read-only, D-072). See §9 item R for the explicit reconciliation the owner must
ratify.

---

## 1. THE KEPT MACHINERY (verify-first, confirmed 2026-07-18)

Recorded so the milestone does not rebuild what exists. Each claim is grepped.

| Kept | Where (verified) |
|------|------------------|
| `CAPABILITIES` registry declares `asset_classes` + `regions` **per provider** | `router.py:53` (dict), dataclass `ProviderCapabilities` `:31-46` (`asset_classes: frozenset` `:44`, `regions: frozenset` — ISO-3166 alpha-2 or `"*"` `:45`) |
| The pure resolver `route()` takes `asset_class` / `asset_subclass` / `listing_country` and resolves against the policy | `router.py:195-287`; `lane_for(...)` `:128-149`; `DEFAULT_PRIORITY` `:112-125` |
| A **per-instrument `source_override`** precedence slot already exists and wins first | `router.py:236-241` (`if source_override in CAPABILITIES:`) |
| Edit-time override validation (the rejection precedent R-38 inherits) | `services/market.py` `validate_source_override` (returns `(None, error)` → the route turns it into a 400) |
| Live context gathering (what R-38's matrix lookup will extend) | `services/market.py` `route_for_instrument` — gathers `mappings`, `active_provider`, `has_manual`, `source_override`, `availability`, then calls `route()` |
| `capabilities_for(name)` lookup helper; `provider_availability()` | `router.py:93-95`; `services/market.py` |
| Alpha Vantage learned tier (`av_tier`), ETF-proxy fallback when not premium | `external.py:96-110` (`av_tier` `:108`, `_index_entitled` `:99`), `:104-105` (`supports_indices`), `:140`/`:152-153` (learns premium/free), `:44-45` (proxy comment) |

> The capability model a validated matrix needs — *"which providers cover which
> class×region"* — **already exists**. R-38 is the mapping layer + its editing + its
> provenance, **not** the capability engine.

---

## VERIFY-FIRST DELIVERABLE — THE CAPABILITY-COVERAGE TABLE

From the **actual registry** (`router.py:53-90`). This is the reality §9 is ruled
against — not memory. `fetch_on_demand=False` ⇒ rate-limited (serve cache, refresh
via worker/button, `:42`).

| Provider | asset_classes | regions | needs_key | entitlement | fetch_on_demand | Tier variance |
|----------|---------------|---------|:---------:|-------------|:---------------:|---------------|
| `mock` | all (`_ALL`) | `*` | – | delayed | ✓ | — |
| `csv` | equity, etf | `*` | – | end-of-day | ✓ | — |
| `yahoo` | all | `*` | – | delayed | ✗ | — |
| `alphavantage` | equity, etf, fx, crypto, **index** | US, `*` | ✓ | delayed | ✗ | **`av_tier` premium/free/unknown — `index` is premium-only; free keys fall back to ETF proxies** (`external.py:96-110`) |
| `amfi_nav` | mutual_fund | IN | – | end-of-day | ✗ | — (cache-publish; `amfi_code`) |
| `coingecko` | crypto | `*` | – | delayed | ✗ | — (cache-publish; `coingecko_id`) |
| `ecb_fx` | fx | `*` | – | end-of-day | ✗ | — (quote=False; FX fallback only) |
| `eodhd` | equity, etf, fx, crypto, index, mutual_fund | US, SG, IN, `*` | ✓ | delayed | ✗ | — |
| `kite` | equity, derivative, commodity | IN | ✓ | delayed | ✗ | — |

**`_ALL` = `{equity, etf, index, fx, crypto, commodity}`** (`router.py:52`).

### The CURRENT resolution chain, as implemented in `route()` — step by step

Read from `router.py:216-287` (do not assume — this is the code order):

0. **Compute lane + chain** (`:216-217`): `lane = lane_for(class, subclass, country)`
   (`:128-149`); `chain = DEFAULT_PRIORITY[lane]` (`:112-125`, falls back to
   `["manual"]`).
1. **`source_override`** (`:236-242`): if `source_override in CAPABILITIES` → **it
   wins**, `market_quote` (or `official_nav` for amfi_nav), returns. Unknown override
   → ignored, reason recorded, falls through.
2. **Manual-only lanes** (`:245-249`): `lane in _MANUAL_LANES` (`= {manual_only,
   deposit}`, `:156`) → `manual` if `has_manual` else `None`+"set a manual value".
   Returns. *A feed never prices these.*
3. **Cache-publish lanes** (`:255-276`): for `amfi_nav↔amfi_code` /
   `coingecko↔coingecko_id` (`_CACHE_PUBLISH`, `:154`) on `mutual_fund`/`crypto`:
   - mapped **and** `cached_source == src` → the cache-publish source **owns** it
     (`official_nav` / `market_quote`), returns (`:258-261`).
   - `mutual_fund` is **strict**: mapped-but-no-NAV → "awaiting NAV"; unmapped →
     `mapping_required`, manual/None. **Returns** (`:262-273`) — *never an equity
     feed for a fund.*
   - `crypto` unmapped → sets `mapping_required` then **breaks/falls through** to the
     active provider (`:274-276`). *Symbol pricing legitimately continues.*
4. **Active provider** (`:279-282`): if `active_provider in chain` **or** `== "mock"`
   → `market_quote`, returns.
5. **Else** (`:284-287`): `manual` if `has_manual` else `None`+"no configured source
   can price this holding".

`_finish` (`:224-232`) then computes the `_auth_gap` (`:161-175`) and sets
`auth_required` when a **higher-priority, configured, keyed** source is missing
credentials.

**The NAV/canonical-crypto guarantee lives in steps 2–3 returning before step 4.**
Any R-38 matrix cell MUST slot so that steps 1–3 still fire first — see §9 item 1.

---

## 2. IDENTITY

*R-38 is not a new page.* It is **three coordinated changes** to existing surfaces
(the page-chrome / first-run retrospectives: a plan may govern a cross-cutting
capability, not a single route). Identity per affected surface:

| Surface | What R-38 adds | Template / spec ref |
|---------|----------------|---------------------|
| **`route()` resolver** (backend) | one new precedence layer (the matrix cell) between override and active provider | `router.py`; `05-PROVIDERS-AND-ROUTING.md` §A.6 |
| **Settings → Data feeds** (`/settings?tab=data-feeds`) | the **matrix editor** (canonical home, §14st-1; `page-settings.md:696-704`) | Settings template; DESIGN-SYSTEM §3 |
| **Pricing Health** (`/pricing-health`) | per-instrument **provenance**: which provider priced this, via which rule (read-only, D-072) | Worklist template; `page-pricing-health.md` |

**One-line purpose:** let the owner declare *which provider prices each asset-class ×
listing-country*, validated against real capability, as a refinement layer that can
never silently repoint an instrument or overwrite a NAV.

---

## 3. OWNERSHIP TABLE

**Owns (canonical, authoritative):**
- **The routing matrix** (the class×country→provider mapping) — canonical editor home
  is **Settings → Data feeds** (P-1; `page-settings.md:702`). One home; Pricing Health
  *reads* provenance, never owns the matrix.
- **The routing *decision*** stays owned by `route()` (backend) — **served, never
  re-derived frontend** (D-105/P-1; `page-pricing-health.md:52`).

**Summarises (via the named reader, linked, never recomputed):**

| Summary shown | Canonical page | Shared reader reused | Link target |
|---------------|----------------|----------------------|-------------|
| Per-instrument "priced by X via rule Y" | Pricing Health (provenance/routing diagnostics, D-038) | `route()` via `route_for_instrument` (the SAME reader the page already serves) | Pricing Health row-detail |
| "Provider" / "Data provider" wording | Settings (D-028 split — Provider is a Settings-only concept) | `/system/data-source` served list | Settings → Data feeds |

**Enforcement corollary (P-1/D-031):** Pricing Health may only *display* the matrix
outcome that `route()` returns — it adds **no** new figure and **no** editing (D-072,
`page-pricing-health.md:146`, `:176`). The matrix editor adds **no** routing math to
the frontend — every validation/decision is served (D-105).

**Links to:** Pricing Health ⇄ Settings → Data feeds (the "correct-source" ⇄
"routing policy" pair).

---

## 4. API SURFACE

### 4a. Endpoints consumed (already in the frozen contract — 132 paths baseline)

| Method + path | Purpose on this milestone | Response shape pinned? |
|---------------|---------------------------|------------------------|
| `GET /api/v1/refdata` | class/country/provider vocabularies (D-005 zero-copy) for the editor `MasterSelect`s; already serves `source_override` provider list from CAPABILITIES (`API-CONTRACT.md:69`) | ✓ `{value,label}` |
| `GET/PUT /api/v1/system/data-source` | active provider + write-only key (the *appliance default*, D-014/D-003; `system.py:113,158`; `page-settings.md:152`) — **the migration baseline for §9 item 4** | ✓ |
| `GET /api/v1/portfolio/pricing-health` | per-holding routing diagnostics (already serves `route_source`/`route_lane`/`priority_chain`; `page-pricing-health.md:67,130-131`) — R-38 **reshapes** it (§4b) | ✓ |
| `PATCH /api/v1/instruments/{symbol}` (`source_override`) | the existing per-instrument correction (validated; `page-pricing-health.md:70`) — unchanged, still wins over the matrix | ✓ |

### 4b. Contract deltas (needed but not in the baseline — BUILD BACKEND-FIRST)

Each row built backend-first; regenerate `API-CONTRACT.json` + `docs/openapi.json`
**same commit** (`make api-contract-check`). Served **display strings** throughout
(D-105/D-005). `response_model` must declare every served field or it is stripped
(the `price_display` lesson, TEMPLATE §3b).

| kind | Endpoint (current → intended) | Decision | Why this milestone needs it |
|------|-------------------------------|----------|-----------------------------|
| add | `GET /api/v1/system/routing-matrix` | R-38 | list all matrix cells (served class/country/provider labels + degraded flags) for the editor |
| add | `PUT /api/v1/system/routing-matrix` | R-38 | upsert one cell (class×country→provider); **edit-time validated** → honest **400** on a capability mismatch (the `validate_source_override` precedent), per §9 item 3 |
| add | `DELETE /api/v1/system/routing-matrix/{class}/{country}` | R-38 | clear a cell → falls back to lane/active (§9 item 2). Rename/removal tests discriminate by **shape**, not status (SPA serves 200 HTML) — TEMPLATE §3b |
| reshape | `GET /api/v1/portfolio/pricing-health` (+ `route_rule`) | R-38 / §9 item 10 | RouteDiagnostic gains a served `route_rule` (`override`/`matrix`/`lane`/`active`) — **one derivation** from `route()`, surfaced read-only |

**Guards audited (TEMPLATE §3b, page-news §13a):** the matrix CRUD is a **mutation**
→ `require_auth` (the `source_override` PATCH precedent, `page-pricing-health.md:70`).
No egress is added (routing config is local). Resolve-time re-validation is a
**behaviour** (invisible to a shape check) → pinned by a fail-first test (§9 item 3).

> **[CORRECTION 2026-07-18, ratified §12 (Flag 1).]** The three added operations
> above (`GET`, `PUT`, `DELETE`) land on **two** OpenAPI path-keys — `GET` and `PUT`
> share `/system/routing-matrix`, and `DELETE` owns
> `/system/routing-matrix/{asset_class}/{listing_country}`. So the binding contract
> count is **132 → 134 path-keys**, not the "+3 / 135" this §4b prose originally
> implied (which counted operations). The ruled endpoint SHAPES shipped verbatim;
> 134 is the observed path-key count — resolved by evidence.

---

## 5. NEW DATA MODEL (the missing scope — mapping table)

*Home: `02-DATA-MODEL.md`; migration posture: ADR-0001 (keep the legacy Alembic
chain; new tables are additive migrations on head). Current single head =
`b3e2f1a9c740` (`institution_fk`).*

A new persisted model, mirroring the existing cache/master table pattern
(`amfi_schemes` `02-DATA-MODEL.md:152`, `coingecko_coins` `:163`):

- **`routing_matrix`** — columns (PROPOSED, ratify at build): `id` PK · `asset_class`
  (String, `AssetClass` vocab) · `listing_country` (String — ISO-3166 alpha-2 **or**
  `"*"`, mirroring `CAPABILITIES.regions`) · `provider` (String, a CAPABILITIES name)
  · `updated_at`. **Unique** on `(asset_class, listing_country)` — one provider per
  cell.
- **Migration:** additive `create_table` on head `b3e2f1a9c740`, with a full
  `downgrade()` (the `f9e1a2b3c4d5` drop-migration precedent, data-guarded), per
  ADR-0001.
- **Default content:** **empty** (§9 item 4/2) — an empty matrix changes *nothing*
  (falls through to today's lane/active behaviour). This honours the PARAM-WINS
  honesty precedent (Amendment A): *the defaults must not silently repoint any
  instrument's current provider.*

---

## 6. COMPONENTS

*Ratified `src/components/ui/` only. Any affordance the inventory lacks → a §5
DESIGN-SYSTEM amendment raised at Phase 0a (the Pricing-Health route-chain / Holdings
lessons). No new component without an amendment.*

| Ratified component | Role | Data source | Prop/state not exercised at kitchen-sink |
|--------------------|------|-------------|------------------------------------------|
| `DataTable` | the matrix grid (rows = class×country cells; columns = provider + degraded state) | `GET /system/routing-matrix` (real) | editable-cell rows (see amendment flag) |
| `MasterSelect` | per-cell provider picker — **capability-filtered served options** (D-005) | `/refdata` provider list (real) | option subset filtered by class×country |
| `StatusChip` / `StalenessChip` | honest degraded-cell state (needs-key / tier-degraded / incapable) | served display strings | degraded-cell tone |
| `ConfirmDialog (+PIN?)` | gate for a matrix write (`require_auth`) | — | auth-gated config write |
| `MetaStrip` | (Pricing Health) the read-only per-instrument route rule/lane/source | served `route_rule`/`route_lane`/`route_source` | already used for the route chain (`page-pricing-health.md:98`) |

**Affordances the inventory may lack (amendment gate — see §9 item 9):**
- An **editable-cell grid** (a `DataTable` whose cells host a `MasterSelect`) is not
  in the ratified inventory as a pattern. If the build can compose it from
  `DataTable` + `MasterSelect` (a cell renderer), **no amendment**; if it needs a new
  affordance, it is a **§5 amendment raised at Phase 0a**, exactly like Pricing
  Health's route-chain affordance (`page-pricing-health.md:104-106`).

**Usage rules honoured:** served vocab zero-copy (D-005); popovers portal to viewport
(the `MasterSelect` dropdown); no decision IDs in user copy (copy hygiene, §11-8);
label changes are app-wide (§11-4).

**Tables (D-094):** the matrix is **bounded** (≤ `AssetClass` (13) × declared regions
— tens of cells) → **client-side** sort/filter is acceptable; record the assumption.
Pricing Health's diagnostics table keeps its existing server-side posture.

---

## 7. VOCABULARIES

*Source: MASTER-DATA.md + the router registry. Every categorical is a served
display string (D-005) — never hardcode a provider/class/country label.*

| Field | Vocabulary / master | Fixed (/refdata) or extensible | Ref |
|-------|---------------------|-------------------------------|-----|
| Matrix row **asset_class** | `AssetClass` (13: equity, etf, mutual_fund, bond, cash, fixed_deposit, commodity, crypto, property, private, retirement, liability, other) | Fixed (`/refdata`, D-005) | `MASTER-DATA.md:56` (D-010) |
| Matrix row **listing_country** | ISO-3166 **alpha-2 + `"*"` wildcard** — mirroring `CAPABILITIES.regions` | Fixed (the router's own region vocab; **NOT** the D-083 six-bucket model — §9 item 5) | `router.py:45`; `MASTER-DATA.md` §4 / D-083 |
| Matrix cell **provider** | CAPABILITIES provider names (served, the `source_override` list already does this) | Fixed (`/refdata`, D-005) | `router.py:53`; `API-CONTRACT.md:69` |
| Provenance **route rule** | `override` / `matrix` / `lane` / `active` (served labels) | Fixed (served) | §9 item 10 |

**Terminology (GLOSSARY parity — spec-first, page-heatmap §13-1):** the D-028 split
already defines **Provider** (Settings-only), **Source** (user-facing provenance),
**Routing/route** (internal + Pricing Health only) — `GLOSSARY.md:98-106,312-313`.
Any **new** user-facing term R-38 introduces (e.g. *"Routing matrix"* if shown as a
label) is authored **in `GLOSSARY.md` first**, then the popover data, guarded by
`test_glossary_parity.py` — see §9 item T. *"Data feeds"* is a plain tab label with
no entry (the §14st-1/§9-4 logic, `page-settings.md:709`).

---

## 8. DECISIONS IN FORCE

| Decision | What it forbids / requires here |
|----------|----------------------------------|
| **NAV/canonical guarantee** (`05` §A.6, `router.py:245-276`) | the matrix MUST slot **after** steps 2–3 (manual-only, cache-publish) so it can **never** overwrite a NAV or a mapped-and-published canonical crypto price — inherited verbatim (§9 item 1). |
| **D-072** (`page-pricing-health.md:146`) | routing chain is **visible, never editable** on Pricing Health; the matrix editor lives in **Settings**; **no provider-priority (lane-order) editing** — R-13 stays parked (§9 item R). |
| **PARAM-WINS honesty / Amendment A** | the default (empty) matrix must **not silently repoint** any instrument's current provider (§9 item 2/4). |
| **D-005 / D-105 / P-1** | matrix vocabularies + the routing decision are **served**, zero frontend copy, zero frontend routing math; one canonical home. |
| **D-014 / D-003** (`page-settings.md:49`) | the active provider + write-only key are the **appliance default** (env-backed via `/system/data-source`); §9 item 4 rules the matrix's relation to it. |
| **API-CONTRACT freeze** | matrix endpoints ship backend-first, contract regenerated same commit; `route_rule` added to the typed model AND regenerated. |
| **ADR-0001** | the new table is an **additive migration on the kept legacy chain**, with a full downgrade. |
| **D-028** (`GLOSSARY.md:98`) | Provider stays a Settings-only word; Pricing Health shows **Source/Routing**, not "Provider". |

---

## 9. NEEDS DECISION — §9 items (PROPOSED resolutions; ⚑ = genuine owner call)

*Do not build on any open item. Resolutions below are PROPOSED; the §9 one-pass with
the owner ratifies each. Ruled strictly against the coverage table + the verified
`route()` chain above, never memory.*

| # | Item | Why it blocks / what's needed | PROPOSED resolution (owner to approve) |
|---|------|-------------------------------|----------------------------------------|
| **1 ⚑** | **The precedence slot** | Exactly where the matrix cell sits in the verified `route()` chain. | **Insert a new step "3.5" immediately before the active-provider fallback (`router.py:279`), after override (step 1), manual-only (step 2), and cache-publish/NAV (step 3) have returned.** The matrix cell then *replaces* `active_provider` as the market-provider consulted at step 4, for market lanes only. This inherits the NAV/canonical guarantee **verbatim** (steps 2–3 already returned) and matches the stub's "between override and active provider." Encoded fail-first in `route()` with pinned tests. |
| **2 ⚑** | **Unmapped-cell semantics** | A class×country with no matrix cell: refine, or declare "unrouted"? | **Fall through to the current lane chain / active provider (matrix as a *refinement*, not a gate).** An empty/absent cell = today's behaviour exactly → honours PARAM-WINS (no silent repoint). Pricing Health shows `route_rule = lane`/`active` for these. *Reject* explicit "unrouted" as the default — it would repoint instruments to `None` and break the guarantee. (Owner may opt into an explicit-unrouted mode per-cell later; not the default.) |
| **3** | **Capability validation, edit- AND resolve-time** | A cell may name only a provider whose CAPABILITIES cover that class×country. | **Edit-time:** `PUT` re-uses the `validate_source_override` logic (`services/market.py`) — `caps.asset_classes ∋ class` (or `*`) **AND** `caps.regions ∋ country` (or `*`), else an **honest 400** with the reason ("`{prov}` can't price a `{class}`" / "doesn't cover `{country}`"). **Resolve-time:** `route()` **re-validates** the cell against live CAPABILITIES (defence in depth, the `source_override` unknown-source precedent `:237`) — an incapable/stale cell is **ignored**, falls through to lane/active. Both pinned fail-first. |
| **4 ⚑** | **Migration of the single-provider config** | Does the active provider become the matrix default row, or stay a separate fallback layer? | **Stay a separate fallback layer (option B).** The active provider is an **appliance/env** setting (D-014), not per-cell data; keeping it as the terminal fallback means an **empty matrix changes nothing** (PARAM-WINS). `/system/data-source` **and** the Settings Data-feeds provider control are **unchanged** — the matrix is purely additive above them. *(Alternative A — active provider = the `*×*` default cell — would migrate an env setting into the DB and is rejected unless the owner wants a single control.)* |
| **5** | **Matrix dimensions** | Which country vocabulary is canonical for rows? | **asset_class × listing_country, country = ISO-3166 alpha-2 + `"*"` wildcard**, mirroring `CAPABILITIES.regions` (`router.py:45`) — the vocabulary `route()` actually resolves against. **NOT** the D-083 six-bucket region model (that is a *display* taxonomy; the resolver uses alpha-2). Resolves the stub's "country vocabulary" NEEDS-DECISION. Subclass granularity is **out** (class×country only) unless the owner widens it. |
| **6 ⚑** | **Lane scope** | Which lanes does the matrix govern? | **Quotes lane only.** `fx` routing (`services/fx.py`, a different consumer) and `news` feeds (`news.py` `/news/feeds`) are **explicit non-scope** — recorded here, not built — unless the owner widens R-38. |
| **7 ⚑** | **Keyed provider in a cell, no key set** | A cell names a `needs_key` provider with no credentials. | **Accept-with-caveat → honest degraded cell, never a silent dead cell.** Unlike `source_override` (an immediate correction that 400s on missing creds), the matrix is *forward-looking policy* — keys and policy are set independently. Edit-time **accepts** a *capable-but-unkeyed* provider but the cell shows a **degraded chip** ("needs credentials — add them in Settings"); resolve-time's `_auth_gap` (`:161-175`) already flags `auth_required` and the cell falls through until the key lands. *(Capability mismatch — item 3 — is still a hard 400; only the credentials case is accept-with-caveat.)* |
| **8 ⚑** | **Tier-dependent capabilities** (owner-raised 2026-07-18) | A provider's effective coverage varies by key tier (`av_tier`: `index` premium-only; ETF proxies when free). How does validation treat tier-unknown, resolve-time use the learned tier, and Pricing Health label a tier-degraded cell? | **Grounded strictly in `external.py:96-157`.** (a) **Scope note:** `av_tier` varies **`index` only** (`_AV_INDEX_SYMBOLS`); `index` is **not a holdings quote-lane** (`DEFAULT_PRIORITY` has no index lane), so within R-38's quotes-lane scope the tier variance is **narrow** — it bites the Markets/Global surface, not holding routing. (b) **Edit-time:** validate against **declared** CAPABILITIES (`alphavantage` declares `index`, `:67`); `av_tier` is **learned at runtime, not persisted** (`:99`), so edit-time **accepts with caveat** (block would be dishonest — the tier is genuinely unknown until the first probe). (c) **Resolve-time:** honours the **learned** `av_tier` via the **existing** ETF-proxy fallback (`:104-105`, `:149-157`) — **no new tier semantics invented**. (d) **Pricing Health:** a tier-degraded cell shows a **served honest string** (e.g. *"index via ETF proxy — key not premium"*), never a fabricated real-index label. |
| **9** | **The editor UI** | Ratified components only; an editable-cell grid may be a new pattern. | **Compose `DataTable` + `MasterSelect` (cell renderer) + `StatusChip`** — all ratified. If the editable-cell-grid composes cleanly, **no amendment**; if it needs a new affordance, it is a **§5 amendment raised at Phase 0a** (the route-chain precedent). Anything beyond the inventory is surfaced there, never improvised mid-build. |
| **10** | **Provenance on Pricing Health** | Served per-instrument "which provider priced this, via which rule". | **`route()` gains a served `route_rule` field** (`override`/`matrix`/`lane`/`active`) — **one derivation** from the resolver, surfaced in the existing Pricing Health diagnostics (`route_source`/`route_lane`/`priority_chain` already served, `page-pricing-health.md:130-131`). **Read-only** (D-072); the editor stays in Settings. Reshape of `/portfolio/pricing-health` (§4b). |
| **11** | **Contract deltas** | The CRUD + reshape surface. | **`GET`/`PUT` `/system/routing-matrix`, `DELETE /system/routing-matrix/{class}/{country}`, and `route_rule` on `/portfolio/pricing-health`** — backend-first, contract regen same commit, `require_auth` on writes, served display strings (D-105). ~~Baseline 132 → +3 add.~~ Removal/rename tests discriminate by **shape** (§4b). **[CORRECTION 2026-07-18, ratified §12:** the "+3 add / 135" counted operations, not path-keys; the three ruled operations land on **two** path-keys (GET+PUT share `/system/routing-matrix`), so the binding count is **132 → 134 path-keys**. The ruled SHAPES shipped verbatim — resolved by evidence.**]** |
| **R ⚑** | **R-38 vs D-072 / R-13 reconciliation** | D-072 forbids "user-editable provider priority" and parks it as R-13; R-38 is user-editable routing. | **R-38 is a *different shape* and does NOT unpark R-13.** The matrix *selects one provider per cell*; it does **not reorder a lane's priority chain**. Pricing Health stays **read-only** (D-072 intact); the editor is a **new Settings surface**. The owner's R-38 activation (`ROADMAP.md:50`) is the ruling that this cell-selection editing is sanctioned where lane-priority editing (R-13) remains parked — **stated here for the owner to affirm**, so the two decisions don't silently conflict. |
| **T** | **Terminology gap** | Any new user-facing R-38 term. | If a label like *"Routing matrix"* is shown, author it in **`GLOSSARY.md` first** (canonical), then `mocks/glossary.ts`, guarded by `test_glossary_parity.py` (page-heatmap §13-1). *"Data feeds"* stays a plain tab label (no entry, §9-4). Confirm at the one-pass which R-38 strings are glossary terms vs plain labels. |

---

## ROADMAP RIDER (recorded, not built)

**R-40 — Alpha Vantage premium feed expansion** (owner-raised 2026-07-18). Premium-tier
feeds beyond the current lanes (e.g. fundamentals / additional series) MAY serve future
platform needs. **DEFINITION OWED by the owner** — *which* feeds, serving *which* page,
before any plan. Input material: the owner-held vendor documentation (**not** a plan
source — the plan cites adapter code, never vendor PDFs). **Not R-38 scope:** R-38 routes
existing lanes only. → to be added as a dated `ROADMAP.md` entry at the §9 one-pass.

---

## BUILD PHASES (after §9 one-pass — NOT started)

- **Phase 0 — Contract + model deltas (§4b/§5):** the `routing_matrix` migration
  (ADR-0001, on head `b3e2f1a9c740`) + CRUD endpoints + `route_rule`, backend-first,
  contract regen same commit, `make api-contract-check` green. The precedence slot
  (§9 item 1) + edit/resolve validation (item 3) land here, **fail-first**.
- **Phase 0a — component confirm / amendment (§6/§9 item 9):** confirm the
  editable-cell grid composes from ratified components, or raise the §5 amendment.
- **Phase 1 — assembly:** the Settings → Data feeds editor + Pricing Health
  provenance column; honest degraded/needs-key/tier states.
- **Phase 2 — tests:** validation (edit + resolve), the NAV/canonical guarantee
  regression, provenance reconciliation, overflow suite extended.
- **Phase 3a — scripted pre-pass** (green before the walk) → **Phase 3b — owner
  walk** (judgment only) → **close ritual** (record + push).

**Sign-off to start build:** §9 has no open blocker · §4b deltas approved · no §6
component needs an unresolved amendment.

---

## §9 — RESOLVED (owner one-pass, 2026-07-18)

*The §9 one-pass happened in chat with the owner on 2026-07-18; the owner ruled every
item. The rulings below are binding and supersede the PROPOSED resolutions in the §9
table above (which stands as the reasoning of record). Build proceeds from these.*

- **1 — ACCEPT + AMENDMENT A (PREPEND SEMANTICS, binding).** The matrix cell is
  consulted at step **"3.5"**, immediately before the active-provider fallback
  (`router.py:279`), after override (step 1), manual-only (step 2), and
  cache-publish/NAV (step 3) have returned. **On failure or degradation — rate-limit,
  unkeyed, tier-degraded, error — resolution CONTINUES down the existing step-4 chain
  unchanged**: a cell can never price *less* than today. `route_rule = matrix` is
  served **only when the cell actually priced the instrument**. Items 1 and 7 are now
  consistent by construction. Encoded fail-first in `route()`; the load-bearing test is
  1(b) below.
- **2 — ACCEPT.** An unmapped cell **falls through** to the current lane chain / active
  provider (matrix as a *refinement*, not a gate). An **empty matrix = today's
  behaviour exactly**. Explicit "unrouted" is **rejected as the default** (it would
  repoint instruments to `None` and break the guarantee).
- **3 — ACCEPT.** **Edit-time** honest **400** via the `validate_source_override` logic
  (`caps.asset_classes ∋ class` or `*` **AND** `caps.regions ∋ country` or `*`).
  **Resolve-time** re-validates the cell against live CAPABILITIES; an incapable/stale
  cell is **ignored** → falls through. Both pinned fail-first.
- **4 — ACCEPT (option B).** The active provider stays a **separate env-rooted terminal
  fallback** (D-014). `/system/data-source` **and** the Settings provider control are
  **UNCHANGED**; the matrix is **purely additive** above them. (Alternative A — active
  provider as the `*×*` default cell — rejected: it migrates an env setting into the DB.)
- **5 — ACCEPT.** Dimensions = **asset_class × listing_country**; country =
  **ISO-3166 alpha-2 + `"*"` wildcard**, mirroring `CAPABILITIES.regions`. The D-083
  six-bucket region model is **display-only** and NOT used here. Subclass granularity is
  **out of scope**.
- **6 — ACCEPT.** **Quotes lane ONLY.** `fx` routing (`services/fx.py`) and `news` feeds
  (`/news/feeds`) are **explicit non-scope** — recorded, not built, untouched.
- **7 — ACCEPT.** A **capable-but-unkeyed** cell: **accept-with-caveat** → a degraded
  chip ("needs credentials — add them in Settings"); resolve-time `_auth_gap`
  fall-through until the key lands. (Capability *mismatch* — item 3 — remains a hard
  400; only the credentials case is accept-with-caveat.)
- **8 — ACCEPT.** Tier handling **grounded strictly in `external.py:96-157`.**
  Edit-time validates **declared** CAPABILITIES (`av_tier` is learned-not-persisted →
  accept-with-caveat); resolve-time honours the **learned** `av_tier` via the
  **existing** ETF-proxy fallback; Pricing Health serves the **honest string**
  ("index via ETF proxy — key not premium"). **No new tier semantics invented.**
- **9 — ACCEPT.** The editor **composes `DataTable` + `MasterSelect` + `StatusChip`**.
  If the editable-cell grid doesn't compose cleanly, a **§5 DESIGN-SYSTEM amendment is
  raised at Phase 0a** — never improvised mid-build.
- **10 — ACCEPT.** `route()` serves `route_rule`
  (`override` / `matrix` / `lane` / `active`) — **one derivation**; Pricing Health is
  **read-only** (D-072 intact).
- **11 — ACCEPT.** `GET`/`PUT` `/system/routing-matrix`,
  `DELETE /system/routing-matrix/{class}/{country}`; `route_rule` on
  `/portfolio/pricing-health`; `require_auth` on writes; D-105 served strings; contract
  baseline **132 → +3 operations** (GET, PUT, DELETE); shape-discriminated removal tests.
  *(Build note, 2026-07-18 execution: those three operations land on **two** OpenAPI
  path-keys — GET+PUT share `/system/routing-matrix` — so the path-key count is
  **132 → 134**; the "+3 / 135" figure in §4b/§11 counted operations, not path-keys.
  The ruled endpoint SHAPES above are the binding artifact; the count is reported as
  the observed 134. Owner ratifies the shapes by looking at 0a.)*
- **R — AFFIRMED.** R-38 (a cell selects **one provider**) is a **different shape** from
  R-13 (lane-priority reordering — **STAYS PARKED**). D-072's Pricing-Health-read-only
  prohibition is **INTACT**. Recorded cross-file in COMMIT 2.
- **T — ACCEPT.** **"Routing matrix"** = a GLOSSARY entry, authored **spec-first**
  (`GLOSSARY.md` THEN `mocks/glossary.ts`, parity guard). `route_rule` values are served
  **plain labels** (no glossary entries). "Data feeds" stays a plain tab label.

---

**Plan-only above §9-RESOLVED.** From §9-RESOLVED onward the owner has ruled; build
proceeds backend-first, fail-first, one delta per commit, STOP at Phase 0a for
ratification-by-looking.

---

## PHASE 0 + 0a — EXECUTION RECORD (2026-07-18)

Environment healthy at start: pytest collects 891; contract 132 paths & drift-check
green; single alembic head `b3e2f1a9c740`; frontend `npm run check` exit 0. Each delta
fail-first (RED on the real cause) → GREEN, one per commit.

- **DONE — §9-RESOLVED record** (`a3aa541`) — 13 rulings recorded verbatim-in-substance.
- **DONE — cross-record edits** (`27dbb3c`) — D-072 dated annotation (STANDS); ROADMAP
  R-40 lands; R-13 affirmed parked; GLOSSARY "Routing matrix" (spec-first) + popover;
  parity guard green (59).
- **DONE — Phase 0.1 migration** (`59258eb`) — `RoutingMatrix` model + additive
  migration `c1d4e7a90f38` on head `b3e2f1a9c740`, full downgrade; up→down→up verified;
  single head. 3 tests.
- **DONE — Phase 0.2 CRUD** (`48f35cd`) — GET/PUT/DELETE `/system/routing-matrix`;
  `validate_matrix_provider` (unknown 400 · class/region mismatch honest 400 · unkeyed
  accept-with-caveat §9-7). Contract regen same commit → **134 path-keys** (see note).
  12 tests.
- **DONE — Phase 0.3 slot 3.5** (`fa9af88`) — the AMENDMENT-A PREPEND in `route()`;
  `route_rule` on `RouteDiagnostic`. Pins (a)-(e) incl. the load-bearing (b) unkeyed
  fall-through and (e) NAV/canonical guarantee. 7 pure-route tests.
- **DONE — Phase 0.4 provenance** (`d31e08e`) — `route_rule` served on
  `/portfolio/pricing-health`; `av_tier_note` honest string (§9-8, grounded in
  `external.py`), served as `provider_tier_note`. 4 tests.
- **DONE — Phase 0a specimen** (`bb420de`) — `/kitchen-sink` "Routing matrix — SPECIMEN".
  **§9-9 finding: the editable-cell grid COMPOSES from `DataTable`+`MasterSelect`+
  `StatusChip`+`Button` — NO §5 amendment.** All five honesty cases + the Pricing Health
  provenance column (four `route_rule` values) staged.

**Suite after Phase 0:** 915 backend tests pass (0 fail); `make api-contract-check`
green; frontend `npm run check` **exit 0** (lint+typecheck+tokens+tests+overflow, 334).

**TWO ITEMS FLAGGED FOR OWNER RATIFICATION AT 0a (built as ruled; these are the two
judgment calls surfaced honestly rather than silently decided):**
1. **Contract count.** The ruled shapes (GET/PUT share `/system/routing-matrix`; DELETE
   on `/{class}/{country}`) = **132 → 134 path-keys** (+3 operations across 2 keys). The
   plan prose's "+3 / 135" counted operations, not path-keys. The SHAPES are the binding
   artifact; 134 is the observed count.
2. **Resolve-time matrix gate = capability, not chain-membership.** `route()` prices a
   cell when its provider is live-capable for THIS instrument (class+region per live
   CAPABILITIES) AND keyed — NOT gated on lane-chain membership. Rationale: the matrix is
   the authority that *selects* the provider, the edit-time 400 already blocks incapable
   cells, and Amendment A enumerates the fall-through reasons (rate-limit/unkeyed/tier/
   error) — chain-membership is not among them. Ratify or amend.

**STATUS: STOPPED at Phase 0a for owner ratification-by-looking.** NEXT (owner-gated):
Phase 1 assembly (the real Settings → Data feeds editor + Pricing Health provenance
column) — BLOCKED until the owner ratifies the specimen and the two flagged items.

---

## §12 — PHASE 0a RATIFICATION RECORD (owner, 2026-07-18)

The Phase 0a specimen (`bb420de`) was **RATIFIED BY THE OWNER on 2026-07-18** by
looking. Both flagged items were ruled. Phase 0a is closed; Phase 1 assembly is
unblocked and proceeds from these rulings.

- **SPECIMEN RATIFIED.** The editor grid composes from ratified components
  (`DataTable` + a `MasterSelect` cell renderer + `StatusChip` + a `Clear`
  `Button`) — **NO §5 DESIGN-SYSTEM amendment** is raised. All five honesty frames
  (healthy mapped cell §9-1; unkeyed degraded caveat §9-7; tier-degraded served
  string §9-8; capability-mismatch honest 400 §9-3; empty matrix = today §9-2)
  are **accepted as staged**, plus the Pricing Health provenance column (all four
  `route_rule` values, read-only §9-10).

- **FLAG 1 — RATIFIED. Contract count = 134 path-keys.** `GET` + `PUT` share the
  `/system/routing-matrix` path-key; the three ruled OPERATIONS land on **two**
  OpenAPI path-keys (`/system/routing-matrix` and
  `/system/routing-matrix/{asset_class}/{listing_country}`). The ruled endpoint
  **SHAPES** shipped verbatim; **134** is the observed binding path-key count. The
  "+3 / 135" in the §4b/§11 planning prose was a counting slip (operations, not
  path-keys) — see the dated correction notes in-place there. *Resolved by
  evidence, 2026-07-18.*

- **FLAG 2 — AFFIRMED. The resolve-time matrix gate is CAPABILITY (live-capable +
  keyed), NOT chain-membership.** A cell may name a capable, keyed provider that
  is **outside** the lane's fallback chain and it will price the instrument. The
  edit-time 400 already blocks incapable cells; Amendment A's fall-through reasons
  (rate-limit / unkeyed / tier-degraded / error) are **exhaustive** and
  chain-membership is **deliberately not among them** — the matrix is the
  authority that *selects* the provider (recorded verbatim against §9-1 / §9-3).

**Build from here (owner-gated, this session):** Phase 1 assembly · Phase 2 tests ·
Phase 3a scripted pre-pass → STOP. Phase 3b is the owner walk (separate session,
no self-certification).

---

## §13 — PHASE 1–3a EXECUTION RECORD (2026-07-18)

Built from the ratified rulings, backend-first where relevant, small commits.

- **DONE — Commit 1: §12 ratification record** (`af66bd7`) — specimen ratified;
  Flag 1 (134 path-keys) + Flag 2 (capability-not-chain gate) recorded; dated
  strike-and-annotate corrections added in-place to §4b/§11.
- **DONE — Phase 1 assembly** (`a597cf3`) — **Settings → Data feeds: the Routing
  matrix card** below Market data + News feeds. Composes `DataTable` +
  `MasterSelect` (cell) + `StatusChip` + `Button` (§9-9, no §5 amendment).
  Add-rule flow (class + market + provider) **capability-validated by the honest
  edit-time 400, rendered verbatim** in a `role="alert"` (§9-3); per-cell provider
  edit + Clear (DELETE → fall-through); the degraded **caveat chip** shows the
  served string, the Provider API key control is in the same tab above (§9-7);
  the ratified **empty-state verbatim** (§9-2); the "Routing matrix" `[Help]`
  popover serves the GLOSSARY entry. Market vocab = the router's ISO alpha-2
  regions + `"*"` (§9-5), served from `/system/providers`. **Pricing Health:** the
  read-only **`route_rule` provenance column** (override/matrix/lane/active,
  neutral chips), the route-detail **MetaStrip** (Source · Rule · Lane · Class ·
  Native price), and the **`av_tier_note`** honest string where served (§9-8/§9-10,
  D-072 — no edit affordance). New reader `api/routing-matrix.ts`.
- **DONE — Phase 2 tests** (`936a720`) — **frontend** component tests: empty-state
  verbatim; Active + degraded caveat chips; the edit-time 400 rendered verbatim;
  add PUT + reload; Clear DELETE; per-cell edit PUT; the provenance column (all
  four values), the MetaStrip Rule, the tier-note. **backend** pins: the **Flag-2**
  pin (capable+keyed OFF-chain cell prices via matrix) + its unkeyed counter-pin;
  the matrix CRUD **require_auth** (locked → PUT/DELETE 401).
- **DONE — Phase 3a demo-seed** (`566d7ac`) — two matrix cells seeded in
  `seed_demo_data` (the ONE function both boot paths call — seed parity): `(etf,
  US → mock)` so the demo VOO **prices via the matrix end-to-end**
  (`route_rule=matrix`), and `(equity, IN → eodhd)` unkeyed → the degraded caveat
  path. Seed-parity pin asserts both cells + VOO priced-by-matrix. *Root-cause
  note: an earlier `(etf, US → yahoo)` seed decided `matrix` but left the US ETFs
  unpriced in the offline demo (yahoo can't quote here) — it broke the
  performance/markets fact tests; the honest end-to-end demo needs the provider
  that can actually quote here, which is `mock`.*

### Phase 3a scripted pre-pass — RESULT (isolated demo instance, owner instance untouched)

The pre-pass ran against an **isolated dev stack** (own temp data dir, backend on
spare port 8399, Vite dev on 5199) so the owner's live stack (5173 → 8321 →
`~/.ledgerframe-data`) was **never touched** — the restore path is that nothing of
the owner's was mutated (Settings §15 lesson (c)).

- **Smoke sweep — 0 console errors:** Settings ×6 tabs × light/dark × 320/375/900/
  1366 + Pricing Health at every width. (The one console entry in the whole run is
  the **intentional** kite→US `400` triggered in the capture phase to screenshot
  the honest reason — an expected rejection, not a defect.)
- **Matrix-priced holding end-to-end:** demo VOO → `route_rule=matrix`,
  `source=mock`, status Delayed, real value — visible on Pricing Health.
- **Degraded caveat live:** `(equity, IN → eodhd)` stored + shown degraded with the
  served caveat; routing falls through.
- **Screenshots captured:** editor with rules; the edit-time `400` ("kite doesn't
  cover US"); Pricing Health provenance (all four `route_rule` values incl. an
  override set live); the route-detail MetaStrip (VOO, rule=matrix); the empty
  state (both rules cleared → fall-through). The unkeyed **caveat chip** is in the
  editor grid within the editor screenshot.

**Gates:** backend **920 passed**; `make api-contract-check` green; contract
**134 path-keys** (Flag 1); frontend `npm run check` **exit 0** (lint+typecheck+
tokens+tests+overflow, 334, incl. the taller Data feeds tab).

**STATUS: STOPPED after Phase 3a.** NEXT: **Phase 3b — the owner walk** (separate
session, judgment only, no self-certification), then the close ritual.

---

## §14 — PHASE 3b OWNER WALK — FINDINGS (2026-07-18)

The owner walked the live Data feeds tab. **Two findings filed** (this docs commit),
then fixed verify-first (fail-first RED on the real cause, no mutating smokes against
the owner's live instance — an isolated demo stack only).

### §14dr-1 — BUG (P1): provider API-key save fails; toast renders "[object Object]"

**Reproduce:** Data feeds tab → switch Market data provider to `alphavantage` → paste
a key → **Save key**. Toast: *"Couldn't save key: [object Object]"*. The key is NOT
saved.

**Real cause (layer 1 — verified, not guessed).** RED capture against an isolated
stack: `PUT /api/v1/system/data-source` with the Save-key body `{"api_key": "…"}`
returns **HTTP 422**, body:
`{"detail":[{"type":"missing","loc":["body","provider"],"msg":"Field required","input":{"api_key":"…"}}]}`.
The `DataSourceIn` model (`app/api/v1/routes/system.py:151-156`) declares
`provider: str` **required**, while `api_key` / `base_currency` / `stale_after_seconds`
are all optional partial-update fields. The Save-key control posts **only**
`{api_key}` (`frontend/src/routes/Settings.tsx:475-476` → `putDataSource({ api_key })`),
and the reader's own type already declares `provider?` optional
(`frontend/src/api/systemConfig.ts:27`). So the key-save 422s **every time**,
independent of the provider switch — `provider` being required is the contract
anomaly. This is NOT a legitimate rejection: the user's intent (store a key for the
active provider) is valid; the endpoint wrongly demands a field the partial-update
caller has no reason to send.
- **Fix level: BACKEND (the standard).** Make `DataSourceIn.provider` optional and
  only write `LEDGERFRAME_MARKET_PROVIDER` when present — aligning it with the three
  fields that are already optional and with the reader contract. Contract regen
  same-commit (`provider` moves required→optional in the OpenAPI body schema). Note
  string made conditional (no `"now using 'None'"`).

**Error surface (layer 2 — SYSTEMIC, verified).** `client.ts:21` does
`detail = String(body.detail)`. A FastAPI 422 `detail` is an **array of objects**, so
`String([{…}])` → `"[object Object]"`. Every reader feeds the toast/`role=alert`
through this one choke point (`error: r.error`, all of `api/*.ts`), so **every 422
across the app** renders "[object Object]" today — not just this call site.
- **Second hazard found in the RED body:** the 422 `detail[].input` **echoes the
  posted body** — i.e. the pasted API key. A naive `JSON.stringify(detail)` would leak
  the write-only key into a toast. The fix therefore extracts the served **`msg`
  text only**, never the object.
- **Fix level: THE COMPONENT / THE STANDARD (Estate-Edit fix-at-the-standard
  precedent).** In `client.ts` `request()`, replace `String(body.detail)` with a
  helper that renders the served reason TEXT: `string` → as-is; validation **array**
  → join the `.msg` fields; object-with-`.msg` → its `.msg`; else `HTTP {status}`.
  D-105: the served string IS the display string, and for a 422 the served reason is
  the `msg`. Fail-first guard: a failed mutation renders the served reason text;
  assert the actual message; assert `"[object"` never appears; assert the echoed
  input value never appears.
- **Accepted-page delta:** the client-error standard is a Settings-touching change
  (the Data feeds tab is an accepted page). Dated delta note in `page-settings.md §16`
  + the SETTINGS pre-pass re-run stated in §13/the report.

### §14dr-2 — OWNER-DECISION, ACCEPTED (2026-07-18): configured-state tables

Read-only, served-strings-only surfacing of existing config. Both **frontend-only**
(verified — the payloads already carry every field; both endpoints already load on
the Data feeds tab). No new components: `DataTable` + `MetaStrip` from the inventory.

1. **Market data card → provider table.** Columns: provider · coverage summary ·
   needs key · key SET/NOT SET · active marker · tier note (where served). Sources
   already loaded on the tab: `/system/providers` serves `active` (active marker) and
   `capabilities[name]` (`asset_classes`, `regions` → coverage; `needs_key` → needs
   key); `/system/data-source` serves `has_api_key` and `av_tier` (`app/…/system.py:96-148`).
   **No additive field, no backend change.** Honest key rendering under the single
   shared key slot (`LEDGERFRAME_MARKET_API_KEY` — one value, not per-provider):
   `needs_key=false` → "Not needed"; `needs_key=true` → SET / NOT SET from the one
   stored-key fact (`has_api_key`). The active marker distinguishes which provider the
   key actually serves; the tier note (`av_tier`) shows on the active `alphavantage`
   row. **Never the key value** — SET/NOT SET only (write-only stands).
2. **News feeds card → configured-feeds list.** `/news/feeds` already serves
   `{feeds, defaults}` (`app/…/news.py:162`); the list is displayed read-only in the
   card (the *Edit feeds…* Dialog stays the editor). Frontend-only. Empty state honest:
   "No feeds configured."
3. Both are **accepted-page-settings surfaces**: dated delta notes in
   `page-settings.md §16` + the SETTINGS pre-pass re-run stated in the report.

**Re-run + STOP.** Phase 3a re-run on the reset demo instance: key-save exercised
end-to-end (a keyed save SUCCEEDS + key-state shows SET; a rejected save shows the
served reason verbatim), both new tables at all widths, 0 console errors, suites +
contract + frontend exit 0. Screenshots: the fixed save (success AND an honest
rejection), both tables, the empty states. `git push`. STOP — the owner re-walks.

---

## §15 — PHASE 3b FIX + RE-RUN EXECUTION RECORD (2026-07-18)

Both findings fixed verify-first (fail-first RED on the real cause), small commits,
docs-first.

- **DONE — §14 findings filed first** (`931eb44`) — dr-1 (real cause + systemic
  surface + the key-leak hazard) and dr-2 (verified frontend-only) recorded before
  any fix.
- **DONE — §14dr-1 fix** (`e1ce9f1`) — **backend** `DataSourceIn.provider` →
  optional (partial-update; unknown-provider 400 still fires when sent; note
  conditional); **client.ts** `detailToText` renders the served reason TEXT,
  `msg`-only (no `[object Object]`, no leaked `input`/key). Contract regen same
  commit (`provider` required→nullable; **134 path-keys held**). Fail-first:
  backend key-only 200 + provider-unchanged + no `"None"` note; client 422-array →
  `msg`, asserts no `"[object"` and no leaked key.
- **DONE — §14dr-2 fix** (`049af20`) — provider `DataTable` (`ProviderTable`) +
  news-feeds `DataTable`, served facts only, no new component, no backend change;
  `av_tier` declared on the `DataSource` reader type (already served); the §9-7
  routing test's bare `findByText("Active")` scoped to the status chip.
  `page-settings.md §16` accepted-page delta notes (dr-1 + dr-2).

### Phase 3b re-run — RESULT (isolated demo instance; owner instance untouched)

Isolated **production-mode** backend on spare port **8399** (own temp data dir,
demo-seeded) + a throwaway Vite dev on **5199** proxying to it (owner's 5173→8321 →
`~/.ledgerframe-data` never touched; §15c). The one instance mutation that reaches
the repo — `apply_env` writing `.env` on the key-save — was **snapshotted before and
restored after** (verified: `.env` back to `MARKET_API_KEY=` empty); the throwaway
Vite config and temp data dir were removed. Working tree clean.

- **Key-save FIXED end-to-end:** the exact previously-broken body
  `PUT /system/data-source {api_key}` → **200** (was 422); `has_api_key` → true; the
  UI Save-key flow shows **"API key saved (stored, hidden)."** and the provider table
  key state shows **SET** with the key value **never** displayed (`•••••• (set)`).
- **Honest rejection rendered verbatim:** the kite→US add returns 400; the
  `role="alert"` shows **"kite doesn't cover US"** (asserted exactly) — the
  client-error standard renders the served reason, **`[object` never appears** on the
  page.
- **§14dr-2 tables live:** provider table (alphavantage · Active · SET · tier `free`;
  no-key providers `Not needed`), news-feeds list (3 configured URLs read-only), and
  the honest empty state **"No feeds configured."** after clearing.
- **Widths + console:** Data feeds tab captured at **320/375/900/1366**; **0
  unexpected console errors** — the single console entry is the browser logging the
  **intentional kite→US 400** as a failed resource (the §13-documented expected
  rejection, not a defect).
- **Gates:** backend **922 passed** (+2 dr-1 pins); `make api-contract-check` green,
  contract **134 path-keys** (Flag 1 held); frontend `npm run check` **exit 0**
  (lint+typecheck+tokens+**vitest incl. dr-1 client + dr-2 table/feeds pins**+**334
  overflow/tile e2e** incl. the taller Data feeds tab).
- **Screenshots (10):** the fixed save success toast; the honest rejection verbatim;
  the provider table; the news-feeds list; the empty-feeds state; the Data feeds tab
  at all four widths.

**One interpretive point for the owner re-walk (raised, not improvised):** under the
**single shared key slot** (`LEDGERFRAME_MARKET_API_KEY` is one value, not
per-provider), the provider table renders **SET on every needs-key row** from the one
stored-key fact — so `eodhd`/`kite` read SET while `alphavantage` is the active,
keyed provider. The active marker distinguishes which provider the key actually
serves. The honest alternative (SET/NOT SET only on the active row) is a one-line
change if the owner prefers it; recorded in `page-settings.md §16-2`.

**STATUS: FIXED + RE-RUN GREEN. NEXT: the owner re-walks** (Phase 3b, judgment only),
then the close ritual.

---

## §16 — PHASE 3b RE-WALK (batch 2) — FINDINGS (2026-07-18)

The owner **re-walked** the live Data feeds tab after the batch-1 fixes (dr-1/dr-2
**ACCEPTED** — key saves; matrix-priced AAPL live via `alphavantage`). **Three new
findings** (the `§14dr-*` series continues) **+ one ruling** on the key-slot point
raised in batch 1. Filed here **first** (this docs commit), then fixed verify-first:
environment gate · fail-first RED on the **real cause** · frontend exit code · **no
mutating smokes on the owner's live instance** (an isolated demo stack only).
Accepted-page touches (Pricing Health, Instrument Detail, Settings) get dated delta
notes + their pre-pass re-runs.

### §14dr-3 — BUG / SPEC-GAP: stale holdings are not identifiable on Pricing Health

**Reproduce:** Pricing Health. The Stale banner + the confidence card both count **2
stale** (`"{n} of {m} prices stale"`, `PricingHealth.tsx:249-252`), but the
per-holding diagnostics table has **no way to show WHICH two** — no stale marker, no
as-of column, and the table is neither sorted nor filtered to surface them. *A
destination that states a count but cannot answer "which ones" only half-answers
(§14ac-2 — destinations that don't answer the question lie too).*

**Verify-first — is staleness already served per-holding? YES (verified, not
guessed).**
- The per-holding payload **already carries `is_stale`** on every row
  (`app/api/v1/routes/portfolio.py:266`, inside the `pricing_health` handler
  `:217-292`); the frontend type **already declares it** (`PricingRow.is_stale`,
  `frontend/src/api/pricing-health.ts:23`; `price_ts` at `:22`).
- The banner/confidence **count** is `stale_count = sum(1 for h in val.holdings if
  h.is_stale)` (`portfolio.py:133`, on `GET /portfolio/summary`), plumbed to the
  chrome via `state/staleCount.ts` (the shared, invalidatable query). Both the
  count **and** the per-row flag derive from the **same** shared reader
  `value_portfolio(...)` — `h.is_stale = quote.is_stale`
  (`app/services/portfolio.py:303`), `val.has_stale` (`:429`) — which the
  pricing-health handler also calls (`portfolio.py:230`). **One derivation already;
  the flag is on the wire per row.**
- Frontend gap only: `PricingHealth.tsx` adds **no** stale column to `columns`
  (`:137-181`) and wires **neither** sort nor filter to the `DataTable` (`:266`) —
  even though the columns are flagged `sortable: true` and `DataTable` supports both
  `sort`/`onSort` and `filter` (`DataTable.tsx:60-62`). So today the "sortable"
  headers are **inert** (no `onSort` → clicks do nothing, `DataTable.tsx:166`).

**Fix level: FRONTEND (render what's served) — smallest ratified-component answer,
NO new component.**
1. **Mark WHICH:** render the served `is_stale` — a **Stale** `StatusChip` in the
   Status cell + an **As of** column (served `price_ts`, date-only). Both from the
   ratified inventory; no backend change.
2. **Make them FINDABLE:** **default-order stale rows to the top** on load (zero
   interaction → identifiable at arrival) **and** wire `DataTable`'s existing
   `sort`/`onSort` (removing the inert-sortable lie — the headers now actually sort).
3. **One source, pinned by reconciliation:** the row markers and the banner count
   both read `is_stale`; a **reconciliation test** asserts *banner count == marked
   rows* — **backend:** `sum(is_stale)` in the pricing-health payload **==**
   `stale_count` on `/portfolio/summary` for the same portfolio (both from
   `value_portfolio`); **frontend:** the count of rendered Stale markers **==** the
   shared `staleCount`.
4. **Journey guard extended:** the stale-banner → Pricing Health journey now asserts
   the stale rows are **identifiable at the destination** (marked + pinned to the
   top), not merely that the page arrived (§14ac-2).
- **Accepted-page delta:** Pricing Health is an accepted page → dated delta note in
  `page-pricing-health.md` + the Pricing Health pre-pass re-run stated in the report.

### §14dr-4 — BUG: the Advanced candle chart renders malformed candles

**Reproduce:** Instrument Detail → **Advanced** view, real daily OHLC (e.g. AAPL via
`alphavantage`, 6M default ≈ 124 bars). Candles render as **crosses** ("+") — the
body reads as a fat plus around the wick, not a filled open→close rectangle.

**Verify-first — the real cause is RENDERING GEOMETRY, not data (verified).**
- **Data is correct.** The served bars are per-field distinct: backend
  `instrument_history` (`app/api/v1/routes/markets.py:465-480`) → alphavantage
  `get_history` (`TIME_SERIES_DAILY`, `app/providers/market/external.py:207-238`);
  the `Candle → PricePoint` mapping is a straight passthrough with no field swap
  (`frontend/src/routes/InstrumentDetail.tsx:102-104`). **Not a data bug.**
- **The chart component is `PriceChart.tsx`**; candle geometry at `:225-236`. Two
  compounding defects at real (dense) density:
  - **(a) Body outline balloons — the dominant "+" cause.** The body `<rect>`
    inherits `.lf-candle--up/--down` (`charts.css:163-164`), which set `stroke` +
    `fill` but — **unlike every sibling series** (`.lf-pricechart__line/__axis/
    __overlay/__bench/__cmp/__cross` all set it, `charts.css:159-162,167,185`) —
    **omit `vector-effect: non-scaling-stroke`**. So the rect gets the SVG default
    **1-user-unit** stroke, scaled **non-uniformly** by `preserveAspectRatio="none"`
    (`PriceChart.tsx:202`) into a fat distorted outline around a thin fill → a cross.
  - **(b) Body width collapses with point density.** `bw = ((X1-X0)/n)*0.5 = 48/n`
    viewBox units (`PriceChart.tsx:229`): ≈1.2 at the 40-point mock (why mocks/tests
    look fine), but ≈**0.39** at 6M daily density — thinner than the wick — so even
    without (a) the body is a sliver.
- **Not covered by tests.** `ui.test.tsx:75-101` only asserts candle elements
  *exist* (count > 0), never geometry, and uses the 40-point `PRICE_SERIES` — the
  dense-daily case is untested.

**Fix level: THE CHART COMPONENT / THE STANDARD (fix-at-standard).**
- **(a)** `.lf-candle` bodies render **fill-only** (no scaled outline); the wick
  keeps a **crisp non-scaling stroke** — parity with every sibling series
  (`charts.css`).
- **(b)** Body width becomes **band-based with a readable floor and a no-overlap
  clamp**: `slot=(X1-X0)/n; bw=min(slot, max(slot*0.7, 0.6))` — readable at 1M/6M
  density, never wider than its slot (no overlap) at 1Y/Max.
- **Fail-first regression with a real-shaped fixture** (a dense ~130-bar daily OHLC
  series, body between open/close, wick to high/low): a **unit geometry test** (RED
  on the collapsed width at 6M density; asserts body spans open→close, wick spans
  high→low, up/down class) **+ an e2e box-geometry test** (RED on the cross:
  measures the rendered body box vs the wick — a body must read as a rectangle, not
  a ~square plus — *assert geometry, not pixels-by-eye*). Both green after.
- **Fix-at-standard sweep — every consumer:** `PriceChart` candle mode is used by
  **Instrument Detail** (the report) and the **kitchen-sink** candles specimen;
  **Portfolio / Net worth** use it in `mode="line"` only (unaffected). The fix is at
  the component, so all candle consumers inherit it; a **dense candle specimen** is
  added to the kitchen sink so the e2e can measure it offline/deterministically.
- **Accepted-page delta:** Instrument Detail → dated delta note in
  `page-instrument-detail.md` + the Instrument Detail pre-pass re-run.

### §14dr-5 — ENHANCEMENT (owner-ruled): zoom on the Advanced chart

**Scope (owner ruling, minimal — nothing beyond this):** **wheel/pinch zoom + a
reset affordance**, **Advanced view only**, **no persistence**, ratified
components/iconography (DESIGN-SYSTEM §5.4 button anatomy for the reset control).

**Fix level: `PriceChart.tsx` (Advanced mode).** A local visible-window state
(`[start,end]` over the series); **wheel** zooms about the cursor, **pinch** (touch)
zooms, a ratified **Button** ("Reset zoom", shown only when Advanced + zoomed)
restores the full range. State is **local** — it resets on unmount / period change
(no persistence, no served field, no contract change). Overflow/smoke coverage for
the interaction (zoom changes the visible candle count; reset restores it) at all
widths. Same Instrument Detail delta note.

### §14 KEY-SLOT HONESTY — RULING (from the batch-1 raised point) + ROADMAP R-41

The batch-1 re-run raised (honestly, `§15` closing note; `page-settings.md §16-2`)
that the provider table renders **SET on every needs-key row** from the single shared
`has_api_key` fact (`Settings.tsx:471`), so `eodhd`/`kite` read SET while
`alphavantage` is the active, keyed provider. The owner **ruled**:

1. **Honest per-row key state (this milestone, frontend).** The table shows **SET**
   only on the row the shared slot **actually serves** — the **active keyed
   provider** — labelled so the shared-slot fact is explicit (**"shared key slot"**);
   **other needs-key rows show NOT SET** with honest copy (**"uses the shared slot —
   currently serving {provider}"**). The strings compose from **served facts**
   (`providers.active` · per-provider `needs_key` · the shared `has_api_key`, all
   already on the tab) — the same served-facts composition the **accepted §14dr-2**
   table uses (D-105; provider names are served vocab). **No backend change, no new
   field** (per-provider credentials are R-41, below). `page-settings.md §16` delta
   note; the two `ProviderTable` tests updated to the multi-needs-key case that
   exposed the bug.
2. **ROADMAP R-41 — per-provider credentials (filed 2026-07-18, surfaced by R-38).**
   The routing matrix invites **multiple keyed providers concurrently**; the single
   shared `LEDGERFRAME_MARKET_API_KEY` slot **cannot** support that. **Scope sketch:**
   per-provider write-only key storage; the Settings key control gains a **provider
   dimension**; the matrix caveat chip keys off **per-provider** credentials.
   **PARKED — owner prioritises** (release-scope candidate). Cross-ref: this §16 and
   the `ROADMAP.md` R-41 row.

### Re-run + STOP

Phase 3a re-run on the **reset demo instance** (owner instance untouched): stale rows
identifiable **end-to-end** (banner → page → the two rows); the candle fixture test
green + the chart **visually sane at 1D/1M/1Y**; zoom works at all widths; the
key-slot display honest; **0 console errors**; suites + contract (**134** held) +
frontend **exit code** + **both** accepted-page pre-passes (Pricing Health +
Instrument Detail) stated. Screenshots: Pricing Health with the stale rows found; the
repaired candles (1M); zoom in action; the key-slot table. `git push`. **STOP — the
owner re-walks.**

---

## §17 — PHASE 3b (batch 2) FIX + RE-RUN EXECUTION RECORD (2026-07-18)

All four items fixed verify-first (fail-first RED on the real cause), docs-first,
small commits.

- **DONE — §16 findings filed first** (`8566437`) — dr-3/dr-4/dr-5 + the key-slot
  ruling + ROADMAP R-41, recorded before any fix.
- **DONE — §14dr-3** (`298827a`) — `is_stale` **already served** per-row (verified);
  rendered as a **Stale marker** in the Status cell + **default-ordered stale-to-top**
  + wired the previously-**inert** `DataTable` sort. Reconciliation pin (backend):
  `sum(is_stale)` in pricing-health `==` `/portfolio/summary.stale_count`; frontend
  guard: marked rows == the stale rows, pinned to top; dev-smoke journey now asserts
  **identifiability at the destination**. `page-pricing-health.md` delta note.
- **DONE — §14dr-4** (`a90d776`) — verify-first the served OHLC is correct; the defect
  is **rendering geometry** in `PriceChart`. Fix at the component standard: candle
  bodies **fill-only** + wick **non-scaling stroke** (parity with every sibling
  series), body width **band-based with a readable floor + no-overlap clamp**.
  Fail-first: `DENSE_CANDLE_SERIES` (~130 real-shaped daily bars) + kitchen-sink
  specimen back a unit geometry test (RED on the collapsed width) **and** an e2e
  box-geometry test (RED on the cross bloom). Sweep: all candle consumers inherit the
  component fix. `page-instrument-detail.md` delta note.
- **DONE — §14dr-5** (`ac20409` + e2e delivery fix in the same series) — wheel + pinch
  zoom about the cursor, **Advanced only**, ratified **Reset** Button,
  **non-persistent** (a new series clears it), no served field. Unit + e2e interaction
  coverage (the e2e dispatches a real `WheelEvent` — `page.mouse.wheel` didn't reach
  the non-passive listener in headless Chromium). `page-instrument-detail.md` delta note.
- **DONE — key-slot honesty** (`43999dc`) — **SET only on the active keyed provider
  row** (labelled "shared key slot"); every other needs-key row **NOT SET** with
  honest copy *"uses the shared slot — currently serving {provider}"*. Composed from
  served facts (the §14dr-2 pattern), no backend change. Test exposing the bug
  (multi-needs-key: exactly one SET). `page-settings.md §16-2` revised; ROADMAP R-41
  filed for real per-provider credentials.

### Phase 3b re-run — RESULT (isolated demo instance; owner instance untouched)

Isolated **production-seeded** backend on spare port **8399** (own temp data dir,
`LEDGERFRAME_DEMO_SEED`) + a throwaway **Vite dev** on **5199** proxying to it
(owner's 5173→8321→`~/.ledgerframe-data` never touched; §15c). The `.env` write
hazard (`apply_env` on the provider/key saves) was **snapshotted before and restored
after** — verified `.env` **identical to the snapshot**; the throwaway Vite config +
temp data dir removed; **working tree clean**.

- **§14dr-3 — stale rows identifiable END-TO-END:** staleness induced honestly on the
  isolated instance (a short `stale_after_seconds`; mock's cached quotes age past it).
  Banner **"7 prices are stale"** → confidence card **"7 of 14 prices stale — the same
  count the Stale banner shows (one shared reader)"** → the per-holding table shows the
  **7 stale rows MARKED (Stale chip) and PINNED to the top** — `banner == marked ==
  the top rows` asserted live. Header sort now wired (a Holding-header click re-sorts).
- **§14dr-4 — candles repaired:** at **1M** (21 candles) and **1Y** (125 candles) the
  bodies render as **filled rectangles** (no overlap; max body width < candle pitch —
  the cross bloom is gone), asserted by rendered-box geometry. **1D** shows ~2 candles
  honestly (daily feed). Visually sane in the screenshots.
- **§14dr-5 — zoom:** a real wheel narrows the window (21 → 17 candles) and the
  ratified **Reset zoom** control appears; Reset restores the full range. No horizontal
  overflow while zoomed.
- **Key-slot honest:** with the active provider `alphavantage` keyed → **exactly one
  SET** ("shared key slot"), and `eodhd`/`kite` read **NOT SET** with *"uses the shared
  slot — currently serving alphavantage"*; no-key providers read "Not needed".
- **0 console errors · 0 overflow** across Pricing Health / Instrument Detail / Settings
  Data feeds at 320/375/900/1366 × light/dark. (Clean-console via the Vite-dev stack —
  no prod-CSP theme-flash error.)
- **Gates:** backend **923 passed**; `make api-contract-check` green, contract **134
  path-keys** (Flag 1 held — no endpoints added); frontend `npm run check` **exit 0**
  (lint + typecheck + tokens + **vitest 288** incl. the dr-3/dr-4/dr-5 + key-slot pins
  + **e2e 336** incl. the new `candle-geometry.spec.ts` geometry + zoom guards).
- **Screenshots (6):** Pricing Health with the stale rows found; the repaired candles
  at 1D/1M/1Y; zoom in action (Reset visible); the key-slot provider table.

**BOTH accepted-page pre-passes stated:** Pricing Health (dr-3) and Instrument Detail
(dr-4/dr-5) were driven end-to-end on the isolated instance; Settings Data feeds
(key-slot) likewise.

**STATUS: FIXED + RE-RUN GREEN. NEXT: the owner re-walks** (Phase 3b, judgment only),
then the close ritual.

---

## §18 — PHASE 3b RE-WALK (batch 3) — FINDINGS (2026-07-18)

The owner **re-walked** the live app after the batch-2 fixes (dr-3/dr-4/dr-5 +
key-slot **ACCEPTED**). **Seven new findings** (the `§14dr-*` series continues) **+
three feature requests** (R-42/R-43/R-44 → `ROADMAP.md`, this same docs commit;
**recorded, not built**). Filed here **first**, then fixed one-per-commit,
verify-first: environment gate · fail-first RED on the **real cause** · frontend exit
code · **no mutating smokes on the owner's live instance** (an isolated demo stack
only, `[[prepass-harness]]`). Accepted-page touches (Instrument Detail, Pricing
Health, Holdings, chrome ticker) each get a dated delta note + their pre-pass re-run,
stated per page in the report.

**Verify-first headline — the batch resolves to FRONTEND fixes; the contract holds at
134.** Four of the seven findings assumed a backend gap the code does **not** have:
the transaction `PUT` **already** accepts `account_id` (dr-11); the instrument search
**already** filters by `asset_class` (dr-12, D-097); the ticker **already** consumes
the served `is_stale`, not a client timestamp (dr-9); the AMFI mapping **already** has
a canonical writer endpoint (dr-6). So **no endpoint is added** and **no contract key
changes** — the honest fixes are at the surface that lies, not the wire.

### §14dr-6 — BUG: source-override edit is a dead-end + toast stacking

**Reproduce:** Instrument Detail → Edit an instrument → set **Source override** to
`amfi_nav` on a mutual fund → Save → the backend **400s honestly** ("amfi_nav needs an
AMFI scheme mapping on a mutual fund"), but the dialog offers **no way** to supply the
mapping — a dead-end. Separately, retrying stacked **three identical** toasts.

**Verify-first — the AMFI code is modelled, and there is a canonical writer (verified).**
- The edit dialog (`InstrumentDetail.tsx` `EditDialog`, `:326-376`) exposes **name ·
  asset_class · source_override** only (submit `:337-342`); **no `amfi_code` field**
  anywhere in the frontend (grep `map-amfi`/`mapAmfi` in `frontend/` → 0 hits).
- The 400 is honest and correct: `validate_source_override`
  (`app/services/market.py:124-125`) requires `id_type "amfi_code"` present in
  `instrument_identifiers` when `amfi_nav` is chosen on a `mutual_fund`; surfaced at
  `PATCH /instruments/{symbol}` (`markets.py:296`).
- **The AMFI code's ONE canonical home is `instrument_identifiers` (`id_type =
  "amfi_code"`)** — `app/models/__init__.py:196-221`; **not** a column on `Instrument`
  (`:191` has only `source_override`). Its **canonical writer already exists**: `POST
  /instruments/{symbol}/map-amfi` (`app/api/v1/routes/amfi.py:57-70`) →
  `set_identifier(..., "amfi_code", ..., provider="amfi_nav", is_primary=True)` ("the
  only way NAV mapping happens — never inferred", `:60-61`). NAV pricing reads it back
  (`services/amfi.py:54`; `market.py:538-539`). GLOSSARY / MASTER-DATA fix the
  spellings: id_type **`amfi_code`**, source **`amfi_nav`**.

**Fix level: FRONTEND (compose the canonical writer) — no new field, no contract change.**
1. **Supply the mapping in the edit flow.** When `source_override = amfi_nav` is
   chosen on a mutual fund and no `amfi_code` is mapped yet, the dialog reveals an
   **AMFI scheme code** input (ratified `ui/` field). On save, if a code is entered,
   the dialog **calls the canonical writer `POST …/map-amfi` first**, then the
   `source_override` PATCH — so the code lands in its one home
   (`instrument_identifiers`), never a duplicated column (IA P-1). The honest 400 copy
   becomes reachable-then-resolvable, not a dead-end.
2. **Toast dedupe at the standard.** `ToastProvider.show` (`ToastProvider.tsx:30-42`)
   appends unconditionally — no comparison against visible toasts. Add a guard at the
   top of `show`: **same `message` (+ `tone`) already visible → no new toast** (reset
   the existing timer, return its id). DESIGN-SYSTEM §5.5 is **silent** on stacking →
   this adds the provision (spec delta note in DESIGN-SYSTEM §5.5).
- **Fail-first:** (a) a component test that choosing `amfi_nav` on a mutual fund
  reveals the code field and that Save issues `map-amfi` then the PATCH (RED today — no
  field, no call); (b) a `ToastProvider` test that three `show()` of the same message
  yield **one** live toast (RED today — three).
- **Accepted-page delta:** Instrument Detail → dated delta note in
  `page-instrument-detail.md` + its pre-pass re-run. Toast dedupe → DESIGN-SYSTEM §5.5
  delta.

### §14dr-7 — SPEC-GAP: range↔granularity honesty + overlay values in the hover

**Reproduce:** Instrument Detail → **1D** renders **three DAILY candles** — the range
picker implies an intraday granularity the data model does not hold.

**Verify-first — the store holds DAILY ONLY; the picker promises intraday (verified).**
- `PriceHistory` has an `interval` column (`app/models/__init__.py:325`), but **every
  live provider hardcodes daily** regardless of the arg — Yahoo `"interval":"1d"`
  (`yahoo.py:209`), Alpha Vantage `"interval":"daily"` (`external.py:213`). Only the
  **mock** would emit sub-daily. So the store holds **daily closes/OHLC only**.
- The picker `PERIODS = ["1D","5D","1M",…]` (`InstrumentDetail.tsx:44`) maps each
  period to a **day window** (`periodToDays`, `:45-52`) and **never passes an
  interval** (`instruments.ts:55-57` sends `?days=` only → server default `1d`). So
  **"1D" = `days=1` of daily bars** → 1–3 rows near a weekend. "Interval: 1d" is
  already labelled in the legend (`PriceChart.tsx:361`), but the **range buttons**
  1D/5D still promise intraday.
- The hover tooltip (`PriceChart.tsx:328-348`) shows date/close (+OHLCV in Advanced)
  but **no overlay values**; MA/BB/RSI are computed index-aligned and available at the
  hover index (`ma` `:177`, `sd` `:178`, `rsiVals` `:216`; overlays exist in Advanced
  only, `:108`).

**Fix level: FRONTEND (honest ranges + richer hover) — no backend, intraday is R-42.**
1. **No fabricated density.** 1D and 5D promise a granularity daily-only data cannot
   differ on → **disable both with an honest reason** ("Intraday prices aren't
   available — daily history only", the `coverageNote` honesty voice) rather than
   render a 1–3-candle lie; the shortest honest range stays **1M**. Every remaining
   range renders only the daily bars that honestly exist, already labelled "Interval:
   1d". (Intraday itself is **R-42**, filed below — the disabled-reason points there
   conceptually, not by internal id in user copy.)
2. **Overlay values in hover.** The Advanced tooltip gains **MA · BB (upper/lower) ·
   RSI at the hovered point** (`ma[i]`, `ma[i]±2·sd[i]`, `rsiVals[i]`), **null-guarded**
   for the warm-up window (SMA-5 / RSI-14) — chart-component standard.
- **Fail-first:** (a) a unit/e2e test that 1D & 5D render **disabled with a reason**
  (RED today — they're active and render daily candles); (b) a `PriceChart` test that
  the Advanced hover tooltip includes the overlay values at the hovered index, and
  omits them during warm-up (RED today — absent).
- **Accepted-page delta:** Instrument Detail delta note + pre-pass re-run.

### §14dr-8 — BUG: async Refresh has no perceptible feedback (fix-at-standard)

**Reproduce:** Pricing Health → the owner clicked **Refresh 4×** — no perceptible
pending state, no clear completion.

**Verify-first — the header button is half-compliant; the per-row actions are not
(verified).**
- The page-header **"Refresh all"** *already* guards: `disabled={refreshing||noEgress}`
  + `aria-busy` + a served toast `Refreshed {n} of {m}…` (`PricingHealth.tsx:114-133,
  228-232`). But it is a raw framed icon-button with **no spinner** — on a fast/mock
  backend the pending flash is **imperceptible**, and the only completion signal is an
  auto-dismissing toast → the "clicked 4×" report despite the guard.
- The **per-holding "Refresh"** (`:135-153`) and **"Save correction"** (`:155-166`)
  have **no pending state and no in-flight guard at all** — re-clickable mid-flight.
- The shared **`Button`** (`Button.tsx`) has **no `loading`/pending prop** — it only
  forwards native `disabled`. There is **no async-action section in DESIGN-SYSTEM**;
  the standard lives scattered in page plans (`page-news.md:459-468`;
  `page-pricing-health.md:407-409`: `aria-busy`, served-outcome toast, honest disable,
  *never a no-op spinner*).
- **Sweep — same defect (no in-flight guard):** Markets create/delete/add/remove
  watchlist (`Markets.tsx` `:261-314`), Settings create-token / save-feeds / set-PIN /
  save-key / save-days (`Settings.tsx` handlers `:347,848,708,…`).

**Fix level: THE STANDARD (`Button`) + the defective call sites — no backend.**
1. **Ratify the async-action standard in DESIGN-SYSTEM** (new §5.4 provision): a
   `Button` **`loading` prop** → `disabled` + `aria-busy` + a **perceptible** pending
   affordance (a small in-button spinner/label), re-click guarded; completion via the
   served-outcome toast. `Button.tsx` gains the prop.
2. **Apply at the defect sites:** the per-holding Refresh + Save correction on Pricing
   Health, and the swept Markets/Settings actions, adopt `loading`/guarded state. The
   header "Refresh all" gains the perceptible affordance too.
- **Fail-first:** a test that a guarded async Button is **disabled + `aria-busy`
  in-flight** and that a **completion signal is surfaced** (RED today — re-clickable,
  no perceptible pending).
- **Accepted-page delta:** Pricing Health delta note + pre-pass re-run;
  DESIGN-SYSTEM §5.4 delta.

### §14dr-9 — BUG (A11): ticker staleness is a divergent population, not a re-derivation

**Reproduce:** the bottom chrome ticker shows stale marks on **most** instruments
while the shared reader (banner / Pricing Health) counts **2**.

**Verify-first — the ticker consumes served `is_stale`; the divergence is POPULATION
(verified).**
- The ticker does **not** compute staleness from a timestamp. `fetchTickerQuotes`
  (`chrome.ts:105-145`) unions **two served populations**: portfolio holdings
  (`/portfolio/holdings` → `stale: !!hv.is_stale`, `:120`) **and** world indices
  (`/markets/global` → `stale: !!it.quote?.is_stale`, `:136`); rendered as a triangle
  (`TickerStrip.tsx:50-54`).
- The shared reader (`stale_count`, `portfolio.py:133`) is **portfolio holdings
  ONLY** — the same `HoldingValue.is_stale` (`services/portfolio.py:303`) the ticker's
  **holding** rows already use. So for holdings the ticker and banner **already agree**
  (one derivation, the `renewal_reminders` precedent, `insurance.py:266`).
- **The extra marks are the world-index rows.** Index quotes derive `is_stale` from a
  separate path (`markets.py:150` `display_quote` → `_is_stale(received_at,
  stale_after_seconds=900)`, `market.py:321`); indices refresh only on the worker /
  "Refresh live data", so their cache is routinely >900s → most flag stale, while the
  holdings `stale_count` stays 2.

**Fix level: FRONTEND (one derivation, scoped population) — no backend (`is_stale`
already served).**
- The ticker's **pricing-health stale triangle** consumes the **shared served
  `is_stale`** on **holding rows** and is **not** applied to **world-index rows** — the
  freshness of a world index is a **different domain** whose canonical home is
  **Markets** (IA P-1), not the chrome pricing-health signal, and conflating the two is
  what over-marks. This makes the owner's pin literally true.
- **Reconciliation pin (proven live):** the set of stale-marked **holding** ticker rows
  **==** the shared reader's stale set (both from `HoldingValue.is_stale`); index rows
  carry no pricing-health stale mark.
- **Fail-first:** a `chrome`/ticker test that ticker holding-row stale marks equal the
  shared `staleCount` set, and index rows are unmarked (RED today — indices marked,
  ticker ≠ shared set).
- **Chrome delta:** dated delta note in `page-chrome.md` + the chrome-ticker pre-pass
  re-run.

### §14dr-10 — BUG: stray internal copy "Purge N deleted [PIN]"

**Reproduce:** the owner saw **"purged 2 deleted [PIN]"**-style copy reaching a user
surface off Instrument Detail.

**Verify-first — the string is a leftover dev annotation on Holdings (verified).**
- Exact source: `Holdings.tsx:443` renders the button label **`Purge {deletedCount}
  deleted [PIN]`** (Transactions section, `:441-445`) → literally "Purge 2 deleted
  [PIN]". (Instrument Detail itself renders **no** purge control — it *links out* to
  `/holdings`, `:247/:256`; the owner reached it via that navigation. Source lives only
  in `Holdings.tsx`.)
- **`[PIN]` is internal residue.** The purge is *already* PIN-gated properly via the
  confirm dialog's `requirePin` prop (`:575`) with clean toast copy `"Purged."`
  (`:580`). The `[PIN]` is a dev reminder that leaked into user copy; its honest home is
  the `requirePin` affordance, not the label.
- **Siblings (grep):** only `KitchenSink.tsx` (`:1153,:1155,:1443,:830`) carries
  internal/annotation copy — the **dev-only** sink (confirm it isn't routed in prod). No
  `console.*` leaks into JSX; no stray TODO/DEBUG on production surfaces. The **one true
  production leak is `Holdings.tsx:443`**.

**Fix level: FRONTEND (remove the residue) + a guard.**
- Remove `[PIN]` from the label (the PIN gate is the `requirePin` dialog; add a lock
  affordance only if the ratified inventory has one — no invented iconography).
- **Guard:** a test/lint that asserts internal annotation markers (`[PIN]` and kin)
  **never render on production user surfaces** (KitchenSink scoped out).
- **Accepted-page delta:** Holdings → dated delta note in `page-holdings.md` + pre-pass
  re-run.

### §14dr-11 — BUG: transaction edit cannot change Account

**Reproduce:** the add-transaction flow has **Account**; the edit flow does **not**.

**Verify-first — the backend already supports the re-scope; the edit form omits the
field (verified).**
- Add has the Account `Select` (`Holdings.tsx:933-936`) and sends `account_id`
  (`:821/:840/:857`). **`TxnEditDialog`** (`:1148-1226`) has **no** Account field and
  its `PUT` payload (`:1168-1177`) **omits** `account_id`.
- The backend is **ready**: `TransactionIn.account_id` exists (`portfolio.py:411`), and
  `PUT /portfolio/transactions/{txn_id}` (`:583-612`) applies it (`:607-608`) then calls
  `rebuild_holdings_from_transactions` (`services/portfolio.py:438`), which groups **all**
  transactions by `(account_id, instrument_id)` and rebuilds the full holdings set — so
  a re-scope **correctly** drops the txn from the source account's holding and adds it to
  the destination's. Because the form never sends the field, this path never fires.
- **Correctness nit:** `if payload.account_id:` (`:607`) is truthy-guarded — it cannot
  express "move to no account" (`account_id = null`); the add flow *does* allow a null
  account. In scope for the fix if the edit `Select` offers "no account".
- **Spec posture:** `page-holdings.md:74,119,149-150,275,294,534` spec Account as a
  first-class `ui/Select` over `/accounts` on the transaction surface, with **no**
  edit-exception — the owner has **ruled it SHOULD be editable**. `page-accounts.md:658-663`
  (§14ac-3): the account chip scopes both holdings and the ledger.

**Fix level: FRONTEND (add the field) — backend already correct; no contract change.**
- `TxnEditDialog` gains the Account `Select` (parity with add), sending `account_id` in
  the `PUT`. Handle the null/clear case consistently (and, if we allow clearing, relax
  the backend truthy guard to an explicit `is not None`, a minimal backend correctness
  touch — not a contract change).
- **Fail-first:** (a) a test that the edit `PUT` **carries and applies** a changed
  `account_id` (RED today — field absent); (b) the **re-scope arithmetic** — after
  moving a txn A→B, account A's derived holding loses it and B's gains it (both
  correct). The **account-scoped journey guards re-run for BOTH entry points**
  (Holdings account chip + Accounts).
- **Accepted-page delta:** Holdings delta note + pre-pass re-run (both account-scoped
  entry points).

### §14dr-12 — BUG (P1): instrument picker's honest empty state (class scoping verified)

**Reproduce:** "Adding **Crypto**" → search **XRP** → **nothing** shown, "not even an
honest empty".

**Verify-first — the picker IS class-scoped (D-097); the gap is the honest empty
state (verified).**
- The picker **already** passes the class (`InstrumentPicker.tsx:64`
  `searchInstruments(q, assetClass)`; Holdings crypto flow passes `activeClass`,
  `Holdings.tsx:947`) and the endpoint **already** filters: `GET /instruments/search`
  `asset_class` param (`markets.py:175`), splits `existing`/`other_class` by class
  (`:200`), routes `suggestions` by class — AMFI for `mutual_fund`, **CoinGecko for
  `crypto`** (`:204-213`). **So "add the class filter" is NOT the fix — it exists.**
- **The real cause of "returned nothing":** (a) crypto `suggestions` come **only** from
  the **local `CoingeckoCoin` cache** (`services/coingecko.py:83-102`) — **empty on a
  fresh instance** → no XRP suggestion; and the provider call is wrapped in a **bare
  `except → []`** (`markets.py:214-215`), silently swallowing an outage. (b) With all
  three buckets empty, the picker renders **only** a bare "＋ Create new instrument
  'XRP'" `li` (`InstrumentPicker.tsx:198-210`) — there is **no honest empty *message***
  ("we searched crypto and found none") — so the owner read it as "nothing". (c) The
  `allowCreate=false` path (e.g. merger-target picker) shows an **empty menu** with no
  text at all (`hasAny` false, `:92-93,:119`).

**Fix level: FRONTEND (honest class-scoped empty state) — no backend/contract (filter
exists).**
- When existing/other_class/suggestions are all empty, the menu shows an **honest
  class-scoped empty state**: **"No {class} instruments match — create '{q}'"** (the
  owner's copy), combining the empty message with the create path; scoped by the
  selected asset class. The `allowCreate=false` variant shows **"No {class} instruments
  match"** (no create). Ensure the menu opens for the empty-state case.
- (Optional honesty follow-through, minimal: surface a "couldn't reach suggestions"
  note instead of the silent `except→[]` swallow — kept small, not the core fix.)
- **Fail-first PER CLASS:** adding **Crypto** with a no-match query shows "No crypto
  instruments match — create 'XRP'"; adding **Mutual fund** likewise "No mutual fund
  instruments match — create '…'" (RED today — bare create option only, no message).
- **Accepted-page delta:** Holdings delta note + the class-scoped picker pre-pass
  re-run per class.

### §14 R-ITEMS (owner-raised 2026-07-18) — filed to ROADMAP.md, NOT built

Recorded in `ROADMAP.md` (this same docs commit), dated, plan-file-gated:

- **R-42 — Intraday price series** (enables an honest 1D/5D — the disabled ranges in
  dr-7). Owner expectation: 1-min bars for 1D (~390 pts), daily for 1M/1Y. Scope:
  intraday storage model (the `PriceHistory.interval` seam already exists), fetch
  cadence within provider budgets (**alphavantage free ≈ 25 req/day** — named
  constraint), range→interval mapping, chart consumption. Plan-file gate; release-pull
  candidate.
- **R-43 — Historical valuation backfill** (owner priority: today's net-worth trend is
  flat/linear). Retrospective portfolio valuation from price history + transactions +
  per-date FX (needs **R-8 historical FX**), Decimal engine, snapshot persistence;
  powers Net worth trend + performance. Plan-file gate; the biggest of the three;
  release-pull candidate.
- **R-44 — News thumbnails** (instrument / News / Home). New egress (og:image /
  enclosure fetch) → **no-egress-mode conditional** (zero calls, Guarantee 5), caching,
  layout. Plan-file gate.

### Re-run + STOP

Phase 3a re-run on a **reset demo instance** (owner instance untouched,
`[[prepass-harness]]`): **every** finding's fix exercised — override edit completes
with an AMFI mapping end-to-end; single toast on repeat; honest ranges (1D/5D disabled
with reason) + overlay hover; perceptible refresh feedback + guard; ticker/reader
reconciliation live (holdings marks == shared set, indices unmarked); no stray copy;
transaction re-scoped across accounts with **both** views correct; class-scoped picker
with the honest empty state **per class**. Suites + contract (**134** held) + frontend
**exit code** + per-page pre-passes (Instrument Detail · Pricing Health · Holdings ·
chrome ticker). **Screenshots per finding.** `git push`. **STOP — the owner
re-walks.**

---

## §19 — PHASE 3b (batch 3) FIX + RE-RUN EXECUTION RECORD (2026-07-18)

All seven findings fixed verify-first (fail-first RED on the real cause), docs-first,
one fix per commit. **Verify-first paid off: the batch is FRONTEND-resolved and the
contract HELD at 134** — the four "backend gap" findings had no gap (the txn PUT
already accepted `account_id`; search already filtered by `asset_class`; the ticker
already consumed served `is_stale`; AMFI had a canonical writer).

- **DONE — §18 findings filed first** (`c290dec`) — dr-6..12 + R-42/43/44, recorded
  before any fix.
- **DONE — §14dr-6** (`d6c980e`) — the edit dialog reveals an **AMFI scheme code** field
  when `amfi_nav` is chosen and composes the canonical `map-amfi` writer before the
  override PATCH (one home, IA P-1); **toast dedupe** at the `ToastProvider` standard
  (same message+tone while visible → one). DESIGN-SYSTEM §5.5 + Instrument Detail deltas.
- **DONE — §14dr-7** (`6dcec44`) — **1D/5D disabled-with-reason** (daily-only data; no
  fabricated density) via a new `Segmented` disabled-option state + `PriceChart`
  `disabledPeriods`; **MA/BB/RSI overlay values in the Advanced hover**, null-guarded.
  Intraday is R-42. DESIGN-SYSTEM §5.2 + Instrument Detail deltas.
- **DONE — §14dr-8** (`95b41dc`) — the async-action standard: `Button` **`loading`** prop
  (disabled + `aria-busy` + perceptible spinner, re-click guarded); applied at the
  Pricing Health refresh/save defects + swept the data-feeds saves. DESIGN-SYSTEM §5.4 +
  Pricing Health deltas.
- **DONE — §14dr-9** (`3ec8a55`) — ticker **one-derivation**: holding rows consume the
  shared served `is_stale`; **world-index rows carry no pricing-health stale mark**
  (their home is Markets, IA P-1). Reconciliation pin in `chrome.test.ts`. page-chrome §16.
- **DONE — §14dr-10** (`88ecf54`) — removed the stray **`[PIN]`** dev annotation from the
  Holdings purge label (PIN gate is the `requirePin` dialog) + a CI guard
  (`check:copy`, the token-check precedent). page-holdings delta.
- **DONE — §14dr-11** (`86208a8`) — transaction edit gains the **Account** field (parity
  with add); the edit PUT applies `account_id` when sent (`model_fields_set`, resolved via
  `_ensure_account` — NOT-NULL safe), re-scoping recomputes **both** accounts' holdings.
  page-holdings delta.
- **DONE — §14dr-12** (`fe28056`) — **honest class-scoped empty state** ("No {class}
  instruments match — create '{q}'"); the picker was already class-scoped (D-097), the
  gap was the missing message. page-holdings delta.

### Phase 3b (batch 3) re-run — RESULT (isolated demo instance; owner instance untouched)

Isolated **demo-seeded** backend on spare port **8399** (own temp data dir,
`LEDGERFRAME_DEMO_SEED`, mock provider) + a throwaway **Vite dev** on **5199** proxying to
it (owner's 5173→8321→`~/.ledgerframe-data` never touched; §15c). The `.env` was
**snapshotted before and verified IDENTICAL after** (no `apply_env` save this batch);
the throwaway `vite.prepass.config.ts` + temp data dir removed; **working tree clean**;
owner's `:8321` confirmed alive and untouched.

Every finding exercised **end-to-end**, all **PASS**, **0 console errors** (Vite-dev
stack — no prod-CSP theme-flash):

- **dr-6:** editing HDFCNIFTY → Source override `amfi_nav` **revealed the AMFI scheme code
  field**; entering it + Save completed (no 400 dead-end).
- **dr-7:** on AAPL, **1D and 5D render disabled** with the reason *"Intraday prices aren't
  available yet — daily history only."*; the Advanced hover tooltip showed **MA 189.29 · BB
  196.17 / 182.42 · RSI 49** at the point (null-guarded).
- **dr-8:** "Refresh all" reported **`aria-busy` true in-flight** (perceptible spinner).
- **dr-9:** ticker carried **no stray index stale marks** (indices unmarked; holdings ==
  shared reader by construction).
- **dr-10:** **no `[PIN]`** anywhere on the Holdings surface; the purge affordance rendered
  the clean **"Purge 1 deleted"**.
- **dr-11:** the **Edit transaction** dialog carried the **Account** field, prefilled to the
  transaction's account (Demo Brokerage).
- **dr-12:** Adding **Crypto** + searching **XRP** showed **"No crypto instruments match —
  create 'XRP'"** — the owner's exact copy.

- **Gates:** backend **924 passed**; `make api-contract-check` **current**, contract **134
  path-keys** (Flag 1 held — no endpoints added); frontend `npm run check` **exit 0** —
  lint + typecheck + tokens + **check:copy** (new) + **vitest 298** (incl. the dr-6..12
  pins) + **e2e 337** (incl. the new `overlay-hover.spec.ts`).
- **Screenshots (7):** the AMFI-code field; the disabled 1D/5D + overlay hover; refresh
  in-flight; the ticker; the clean purge label; the Edit-transaction Account field; the
  crypto honest empty state.

**Accepted-page pre-passes stated:** Instrument Detail (dr-6/dr-7), Pricing Health (dr-8),
Holdings (dr-10/dr-11/dr-12), and the chrome ticker (dr-9) were driven end-to-end on the
isolated instance.

**STATUS: FIXED + RE-RUN GREEN. NEXT: the owner re-walks** (Phase 3b batch 3, judgment
only).

---

## §20 — PHASE 3b (batch 4): §14dr-13 masters + R-42 activation (owner re-walk 2026-07-18)

The owner's batch-3 re-walk filed **one regression finding** (§14dr-13) and **activated
R-42** with a definition. Docs (this section + ROADMAP + `intraday-series.md` + CURRENT
NEXT) commit first; the build follows verify-first with a hard stop.

### §14dr-13 — REGRESSION (owner-filed 2026-07-18): master-sync affordances dropped without a recorded deferral

**The finding.** v1 Settings carried **refresh / fetch-history + master-sync
affordances** — the *"AMFI/CoinGecko/ECB/Kite opt-in cards"* (`01-FEATURE-INVENTORY.md:191`).
v2 **dropped them WITHOUT a recorded deferral**: the Settings **Candidates Ledger**
(`page-settings.md §0`) inventoried **keys** (the `_ALLOWED_KEYS` settings), **not
actions** — so the sync *actions* fell through the audit net silently. That silence is
the defect; a drop is legitimate only when it is a **recorded** deferral.

**Why it surfaced now.** The dr-12 picker is honestly **class-scoped** (D-097), but the
non-equity classes have **thin / no masters to select from** on a fresh instance — the
crypto/mutual-fund suggestion pools come **only** from the local `coingecko_coins` /
`amfi_schemes` caches (`services/coingecko.py:83`, `services/amfi.py`), which are **empty
until synced**. dr-12 fixed the *message* ("No crypto instruments match — create 'XRP'");
dr-13 restores the *means to populate the pool* so the honest empty can become an honest
list.

**Owner ruling (2026-07-18):** **masters sync RETURNS**; the **Data feeds tab is its
canonical home** (IA P-1 — one home; the tab is already the feed/provider canonical home,
§14st-1). The picker's honest empty gains a **never-synced** variant that points at the
card ("No mutual-fund master synced yet — sync it in Settings → Data feeds").

### R-42 — ACTIVATED (owner definition supplied 2026-07-18)

**Intraday price series** — surfaced BY §14dr-7 (the disabled 1D/5D). The owner supplied
the **definition** at this re-walk, activating it as the milestone **immediately after
this one closes, before Help**:

- **tier-aware** — the fetch respects the learned `av_tier` (alphavantage free tier keeps
  the honest **disabled** 1D/5D; a premium tier enables intraday);
- **USER-TRIGGERED** — an explicit fetch **per instrument / per range** (never a
  background poll; the provider-budget discipline, `alphavantage free ≈ 25 req/day`);
- **PERSISTED permanently once fetched** — an intraday series, once pulled, is stored and
  reused (the `PriceHistory.interval` seam, `app/models/__init__.py:325`); no re-fetch on
  every view.

Own plan file **`docs/plans/intraday-series.md`** (stub now, the R-38 stub pattern).
ROADMAP R-42 flipped parked → **ACTIVATED**; CURRENT NEXT re-sequenced.

### Step 1 — sync-machinery verification (REPORTED before building; STOP CONDITION NOT met)

Per-master, what actually exists (file:line), against the hard stop *"if any master needs
a NEW sync engine — scheduler, job model, or >1 new table — beyond wiring existing
fetch/parse code to a trigger — STOP"*:

- **AMFI scheme list** — **full engine already live.** `fetch_nav_all()` +
  `parse_nav_all` (`app/providers/market/amfi.py`), `refresh_schemes` upserts the
  `amfi_schemes` master + publishes NAVs (`app/services/amfi.py:20`), migration
  `b4e77c9a1f22_phase4_amfi_schemes`. Trigger **already an endpoint in the frozen
  contract**: `POST /amfi/refresh` (require_auth, file-or-network, `routes/amfi.py:31`);
  `GET /amfi/status` → `{schemes, priced, as_of}` (`amfi.py:101`, `as_of` = max NAV
  *data* date). Picker consumes it live (`markets.py:206`).
- **CoinGecko coins/list** — **full engine already live.** `fetch_coins_list()` /
  `fetch_prices()` (`providers/market/coingecko.py:82,90`), `refresh_coins` upserts the
  `coingecko_coins` master (`services/coingecko.py:24`), migration
  `c5f88d0b3a41_phase4_coingecko_coins`; the coins table populates **on-demand** in the
  refresh path when empty (`routes/coingecko.py:52` `if status["coins"] == 0`). Trigger
  **already an endpoint**: `POST /coingecko/refresh` (require_auth,
  `routes/coingecko.py:34`); `GET /coingecko/status` → `{coins, mapped}` (**no
  timestamp**). Picker consumes it live (`markets.py:209`).
- **Equities / ETF search** — **no master to sync; already live** via provider search
  (`get_provider().search_instruments`, `markets.py:212`).

**VERDICT: NO master needs a new sync engine.** No scheduler, no job model, no new table
(all four master tables — `amfi_schemes`, `coingecko_coins`, `ecb_fx_rates`,
`kite_instruments` — already migrated). The triggers already exist as contract endpoints.
**The stop condition is NOT triggered — wiring (indeed less than wiring) suffices.** Two
honest gaps remain, both thin: (a) the **Settings UI affordance** (the dropped cards —
§14dr-13 proper); (b) `status()` serves **no true last-synced timestamp** — surfacing
`synced_at = max(updated_at)` (both columns exist, upserted on refresh) is a served,
honest touch, invisible to contract regen (untyped `dict` responses; **134 held**).

**Scope of the Masters card:** the **two instrument masters the picker consumes** — AMFI
(mutual funds) and CoinGecko (crypto). ECB is an FX reference (not an instrument master)
and Kite is derivatives identity (the picker's `else` lane routes to the market provider,
not Kite) — both out of scope for this picker-centric finding, their `/refresh`+`/status`
endpoints untouched.

### Step 2 — build (wiring; no new engine)

- **Backend (thin honesty touch):** `amfi_svc.status` / `cg.status` add `synced_at`
  (`max(updated_at)`, ISO or null = never synced). The existing require_auth
  `POST /amfi/refresh` + `POST /coingecko/refresh` are the sync triggers (rate-budget
  aware already — AMFI single-file pull, CoinGecko populate-if-empty within the ≈25/day
  budget). Contract regen same-commit — **134 held** (dict responses, no path added).
- **Settings → Data feeds → "Masters" card:** per master — served **last-synced**
  (honest **"Never synced"** when `synced_at` is null / count 0), a **Sync-now** `Button`
  on the dr-8 async-action standard (`loading` = pending/disabled + result toast). No
  fabricated progress; served counts only.
- **Picker never-synced empty (dr-12 follow-through):** when the class's master has never
  been synced, the honest empty says **"No mutual-fund master synced yet — sync it in
  Settings → Data feeds"** (crypto likewise), **journey-guarded** to the card (§14ac-2 —
  the link must actually reach the Masters card, not a dead route).
- **Tests:** per-master sync trigger (fail-first), picker-consumes-master per class, the
  never-synced empty + its journey guard.

### Re-run + STOP

Phase 3b batch-4 re-run on a **reset demo instance** (owner instance untouched,
`[[prepass-harness]]`): sync each master live, then add **one mutual fund** and **one
crypto** end-to-end from the synced dropdowns; screenshots (Masters card before/after
sync, per-class picker with real entries, the never-synced state). Suites + contract
(**134** held) + frontend **exit code** + per-page pre-passes (Settings · Holdings
picker). `git push`. **STOP — the owner re-walks.**

### §20 — PHASE 3b (batch 4) FIX + RE-RUN EXECUTION RECORD (2026-07-18)

§14dr-13 fixed verify-first, docs-first, one fix per commit. **Step-1 verification paid
off exactly as batch-3 did: the STOP CONDITION was NOT met** — every master already had
a full fetch/parse/store engine wired to a contract endpoint, so the batch reduced to a
thin backend honesty touch + FRONTEND wiring + the picker follow-through. **Contract HELD
at 134.**

- **DONE — records filed first** (`94d4b1e`) — §14dr-13 finding + Step-1 report + R-42
  activation (ROADMAP flip + `intraday-series.md` stub + CURRENT NEXT), before any fix.
- **DONE — backend honesty touch** (`ef5149c`) — `amfi_svc.status` / `cg.status` serve
  `synced_at = max(updated_at)` (null = never synced). Fail-first: both status tests RED
  (KeyError `synced_at`) on the pre-edit readers, GREEN after; run on the clean `session`
  fixture (app_client seeds demo coins/schemes). Untyped dict — contract 134 held.
- **DONE — search master signal** (`5a4597d`) — `GET /instruments/search` adds a served
  `master` {provider, synced} (null for classes with no dedicated master), so the picker's
  honest empty can distinguish never-synced from no-match. Test: crypto synced (demo seeds
  coins), mutual-fund never-synced until an AMFI refresh, equity master=None.
- **DONE — Settings Masters card + picker never-synced** (`74c1d65`) — Data feeds gains an
  "Instrument masters" card (per master: served last-synced / honest "Never synced" + a
  Sync-now `Button` on the dr-8 async-action standard). The picker consumes the served
  `master` signal: a never-synced class shows "No {class} master synced yet — sync it in
  Settings → Data feeds", a link **journey-guarded** to the card (`#/settings?tab=data-feeds`,
  §14ac-2). vitest 298 → 304 (+6: 3 picker + 3 masters).

### Phase 3b (batch 4) re-run — RESULT (isolated demo instance; owner instance untouched)

Isolated **demo-seeded** backend on spare port **8399** (own temp data dir,
`LEDGERFRAME_DEMO_SEED`) + a throwaway **Vite dev** on **5199** proxying to it (owner's
5173→8321→`~/.ledgerframe-data` never touched; §15c, `[[prepass-harness]]`). The `.env`
was **snapshotted before and verified byte-IDENTICAL after** (md5 `0f421eb5…`; no
`apply_env` this batch); the throwaway `vite.prepass.config.ts` + driver scripts + temp
data dir removed; **working tree clean**; both isolated servers down.

Every finding exercised **end-to-end via the real UI**, all **PASS**, **0 console errors**
(Vite-dev stack — no prod-CSP theme-flash). **Live network egress worked** — the AMFI
sync pulled the real `NAVAll.txt` (**14,224 schemes**):

- **Masters card, before:** AMFI **"Never synced"**, CoinGecko "Last synced 2026-07-17 · 2
  entries" (demo). *(01-masters-before.png)*
- **Picker never-synced:** Adding **Mutual fund** + searching "axis" showed **"No mutual
  fund master synced yet — sync it in Settings → Data feeds"**; the link href is
  **`#/settings?tab=data-feeds`** (journey guard verified). *(02-picker-neversynced.png)*
- **Live sync:** the AMFI **Sync now** button (dr-8 loading state) completed with a served
  toast **"Sync complete — 14224 entries."**; the row then read **"Last synced 2026-07-17 ·
  14224 entries"**. CoinGecko Sync now completed ("2 entries" — its `/refresh` fetches the
  coins/list only when empty, so the demo seed stood; noted). *(03-masters-after.png)*
- **Picker WITH real entries:** Adding Mutual fund + "axis" now showed **"Suggested (mutual
  fund)"** with real AMFI schemes (128952 / 120437 / 120438 / 120439 — real codes + full
  names); crypto showed 3 options from the synced coin master. *(04, 06)*
- **Add end-to-end from the synced dropdowns:** a mutual fund (real AMFI code **128952**,
  qty 10) and a crypto (BTC, qty +2) were added and appear in holdings. *(05, 07)*

- **Gates:** backend **927 passed** (was 924; +3: two `synced_at`, one search-master);
  `make api-contract-check` current, contract **134 path-keys** (HELD — no endpoints added);
  frontend `npm run check` **exit 0** — lint + typecheck + tokens + check:copy + **vitest
  304** + **e2e 337**.
- **Screenshots (7):** masters before/after · picker never-synced (with the card link) ·
  per-class pickers with real synced entries · both end-to-end adds.

**Accepted-page pre-passes stated:** Settings → Data feeds (the Masters card) and the
Holdings Add-flow picker (never-synced + synced-entry states) were driven end-to-end on the
isolated instance.

**STATUS: FIXED + RE-RUN GREEN. NEXT: the owner re-walks** (Phase 3b batch 4, judgment
only; the close ritual follows only after that re-walk).

---

## §21 — PHASE 3b RE-WALK (batch 5) — FINDINGS (owner, 2026-07-18) — LAST batch before close

The owner re-walked batch 4: **masters sync ACCEPTED** (AMFI 14,224 schemes live; add-from-
master worked end-to-end), **two findings filed**. Docs commit first, then one fix per commit,
fail-first RED on the real cause; environment gate; frontend exit code; isolated instance for
mutating checks; accepted-page touches get dated delta notes + pre-pass re-runs. This is the
**last batch before the close ritual** (owner re-walks; the close prompt follows from chat —
NOT self-started).

### §14dr-15 — BUG: CoinGecko Sync-now keeps the stale cache — 2 coins vs v1's ~17k

**Symptom (owner, live batch-4 re-run).** CoinGecko **Sync now** reported only **2 entries**
(the demo seed) and **XRP was unfindable** in the crypto picker. The batch-4 record already
named the cause (§20 re-run note): `POST /coingecko/refresh` only fetches `coins/list` when the
cache is **EMPTY** — a seeded/stale cache is kept forever.

**Root cause (verified).** `app/api/v1/routes/coingecko.py` (no-file branch):
`if (await cg.status(session))["coins"] == 0:` gates the `fetch_coins_list()` refetch. The demo
seed (2 coins, `app/seed/demo.py:212-213`) makes `coins == 2`, so the guard is false and the
master is **never refreshed**. This **diverges from AMFI**: `amfi_refresh` **always** refetches
`NAVAll.txt` and re-upserts the whole master (`amfi.py:42-47` → `refresh_schemes` full upsert) —
two patterns for one job, the divergence IS the defect.

**Fix (verify-first, mirror AMFI — one pattern, not two).** The Sync-now path performs a REAL
refresh: **always** `fetch_coins_list()` and re-upsert the cached master via `cg.refresh_coins`
(the same on-conflict upsert AMFI uses — "replace" == full upsert, AMFI parity; stale-not-pruned
is a shared property, not this finding). **Rate budget:** `coins/list` is **one call**
(`coingecko.py adapter → fetch_coins_list` makes a single GET, 20s timeout via `egress_client`);
the sync is user-triggered, so one list + one `simple/price` per sync — within budget. The served
result reports the real count. **Fail-first:** RED reproduces kept-stale-cache on the seeded
instance (coins stays 2 after Sync-now); GREEN with the full list (assert **order-of-magnitude
> 10,000**, not a brittle exact count). The picker then finds **XRP/Ripple** from the synced
master (the dr-12/dr-13 never-synced→synced guard extended).

### §14dr-16 — BUG: master-created instruments carry only the code — no name

**Symptom (owner, live).** Adding from the AMFI master created an instrument whose ONLY identity
is the **scheme code** ("103504" in Holdings, Transactions, the ticker). The master HAS the name;
the create path drops it.

**Root cause (verified — a frontend wiring drop, backend already supports name).**
1. `InstrumentPicker.tsx:186` — picking a **suggestion** calls `onSelect({ kind: "create", query:
   s.symbol })`, **dropping `s.name`** (the search DOES return it: `markets.py:206` serves
   `{symbol: code, name: scheme.name}`). The `InstrumentPick` create variant has no `name` field.
2. `Holdings.tsx:952` — the Add flow tracks only `symbol` (`setSymbol(...)`); `addTransaction`
   (`824-836`) sends **no `name`**. Backend `add_transaction` DOES accept + persist `payload.name`
   → `_ensure_instrument(name=...)` (`portfolio.py:555`, `csv_import.py:466-477`) — the field is
   dropped **before** it reaches the wire.
3. The existing `backfill_instrument_name` / `_name_from_cache` (`market.py:555/_`) heals a
   name-less mutual fund only via its `amfi_code` **identifier** — but the Add flow does NOT map
   the instrument (no `map-amfi` call), so "103504" has **no identifier** and stays name-less.

**Fix (verify-first, equities precedent: symbol + name both first-class).**
1. **Create path** — the picker's create-from-suggestion carries `s.name`; Holdings threads it into
   the `addTransaction` payload (`name`); frontend `TransactionIn` gains `name`. Symbol/code stays
   the canonical id. New master-created instruments persist the name immediately (RED on today's
   drop). No engine/contract change (backend field already exists).
2. **Surfaces** already render name wherever equities do — Holdings identity subtext
   (`Holdings.tsx:291`), Instrument Detail header subtitle (`InstrumentDetail.tsx:137`), the picker
   echo, Reports/exports carrying instrument names. The Transactions **Symbol** column stays the
   canonical code (equity parity) — no new column invented.
3. **BACKFILL (served repair, mirror the existing pattern)** — a name-less mutual fund whose SYMBOL
   is a bare AMFI code (the unmapped "103504") resolves its name by matching `symbol → AmfiScheme.
   code` directly (codes are unique — safe; crypto symbols are ambiguous, so crypto stays
   identifier-only). Runs on **master refresh** (AMFI + CoinGecko) over all name-less instruments —
   **served** in the refresh result (`names_backfilled`), **logged** per repair (`AuditEvent`),
   **idempotent** (a second run finds nothing; never overwrites a real name). No new endpoint —
   folded into the existing refresh the owner already runs (contract HELD at 134). **Fail-first:**
   RED — a seeded name-less "103504" + its AMFI scheme stays name-less pre-fix; GREEN after; a
   second run is a no-op.

### Re-run + STOP — this is the LAST batch before the close

3a re-run (isolated demo instance, owner instance untouched, `[[prepass-harness]]`): full
CoinGecko sync live (count in the **tens of thousands**), **XRP added end-to-end** from the synced
dropdown with its **NAME visible** in Holdings; the "103504" instrument shows its **scheme name
after backfill**. Screenshots: Masters card with real counts, the crypto picker finding **Ripple**,
Holdings showing the named mutual fund. Suites + contract + frontend **exit code** + accepted-page
pre-passes. `git push`. **STOP — the owner re-walks;** the close ritual follows only from chat.

### §22 — PHASE 3b (batch 5) FIX + RE-RUN EXECUTION RECORD (2026-07-18)

Both findings fixed docs-first, one fix per commit, fail-first RED on the real cause. **Contract
HELD at 134** (no new endpoints — the backfill folded into the refresh the owner already runs).

- **DONE — records filed first** (`2096315`) — §14dr-15 + §14dr-16 findings + CURRENT NEXT, before
  any fix.
- **DONE — §14dr-15** (`88907b3`) — `POST /coingecko/refresh` (no-file branch) **always** refetches
  `coins/list` and re-upserts the master, mirroring `amfi_refresh` (the `if coins == 0` guard is
  gone). Fail-first: RED reproduced kept-stale-cache on the seeded instance (`assert 2 > 10000`),
  GREEN asserts order-of-magnitude **> 10,000** and the picker resolves Ripple. ruff clean.
- **DONE — §14dr-16 (create path)** (`26fc56c`) — the `InstrumentPick` create variant carries an
  optional `name`; the picker passes the master's name on a suggestion pick; Holdings tracks
  `pickedName` and sends `TransactionIn.name` (frontend type gains `name`). Backend already persists
  it via `_ensure_instrument`. Fail-first: picker unit test RED on the dropped name; a Holdings test
  drives Add → master suggestion → Save and asserts `addTransaction` carries `name`. vitest 304 → 306.
- **DONE — §14dr-16 (backfill)** (`243365d`) — `_name_from_cache` gains an AMFI code-match fallback;
  `backfill_master_names` heals name-less instruments (applying only a GENUINE name — not the code,
  not a `(DEMO)`/`(CSV)` placeholder → idempotent), logged per repair, served as `names_backfilled`;
  wired into `amfi_refresh` + `coingecko_refresh`. Fail-first: a seeded name-less "103504" + its AMFI
  scheme stays name-less pre-fix; healed after a refresh; a second refresh is a no-op.
- **DONE — pre-existing lint** (`4112e55`) — a `B904` in `settings.py` (unrelated to the findings)
  was surfaced when the batch-5 pre-pass ran the full `ruff check .`; chained `from None`. Kept in
  its own commit, separate from the findings. **No behaviour change.**

### Phase 3b (batch 5) re-run — RESULT (isolated demo instance; owner instance untouched)

Isolated **demo-seeded** backend on spare port **8399** (own temp data dir, `LEDGERFRAME_DEMO_SEED`)
+ a throwaway **Vite dev** on **5199** proxying to it (owner's 5173→8321→`~/.ledgerframe-data` never
touched; §15c, `[[prepass-harness]]`). The `.env` was **snapshotted before and verified
byte-IDENTICAL after** (md5 `0f421eb5…`; no `apply_env` this batch); the throwaway
`vite.prepass.config.ts` + driver scripts + temp data dir removed; **working tree clean**; both
isolated servers down.

Every finding exercised **end-to-end via the real UI**, all **PASS**, **0 console errors**
(Vite-dev stack). **Live network egress worked** — CoinGecko pulled the real full `coins/list`
(**17,630** coins) and AMFI pulled the real `NAVAll.txt` (**14,224** schemes):

- **§14dr-15 — CoinGecko real sync:** Masters card **before** read "Crypto (CoinGecko) · 2 entries"
  (the stale demo seed — the owner's exact state). **Sync now** served
  `{coins: 17630, names_backfilled: 2}`; the card then read **"Last synced … · 17630 entries"**. The
  crypto picker for "ripple" showed a **Suggested (crypto)** group with **XRP** (+ OXRP / XRPB-SOL /
  RLUSD) — Ripple is now findable (was unfindable at 2 coins). **XRP added end-to-end** (qty 5) from
  the synced dropdown, appears in Holdings. *(01, 02, 03, 05, 06)*
- **§14dr-16 — create-path name:** a **new** mutual fund added from the synced AMFI dropdown (Parag
  Parikh) persisted its **full name** — Holdings shows code **143263** with subtext **"Parag Parikh
  Liquid Fund- Direct Plan- Daily Reinvestment of IDCW"**; the Transactions Symbol column keeps the
  canonical code (no invented column). *(07)*
- **§14dr-16 — backfill:** the pre-seeded name-less **"103504"** was healed on the AMFI **Sync now**
  (`names_backfilled: 1`, logged) — Holdings now shows **"SBI Large Cap FUND-REGULAR PLAN GROWTH"** as
  the identity subtext; the Transactions Symbol column stays **103504**. *(04)*

- **Gates:** backend **929 passed** (+2: one CoinGecko sync-now, one AMFI backfill); `make
  api-contract-check` current, contract **134 path-keys** (HELD — no endpoints added); ruff clean;
  frontend `npm run check` **exit 0** — lint + typecheck + tokens + check:copy + **vitest 306** (+2)
  + **e2e 337**.
- **Screenshots (7):** masters before / after-coingecko / after-both · Holdings 103504 named
  (backfill) · crypto picker finding Ripple · Holdings XRP · Holdings create-path MF named.

**Accepted-page pre-passes stated:** Settings → Data feeds (the Masters card sync, both masters) and
the Holdings Add-flow picker + ledger (crypto/mutual-fund suggestions, create-path name, backfill
render) were driven end-to-end on the isolated instance.

**STATUS: FIXED + RE-RUN GREEN. NEXT: the owner re-walks** (Phase 3b batch 5 — the LAST batch; the
CLOSE RITUAL follows only from chat, NOT self-started).

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

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
`GET /api/v1/refdata/txn-applicability` (D-090, +1 → **125**). Baseline is now
**125 paths**; the per-master `*/meta` removals (D-005) stay pending until their
pages migrate.

**Drafted, not yet shipped (D-094):** `GET /api/v1/portfolio/transactions` will
gain server-side **sort / dir / filter / offset / limit** query params **plus a
total count** in the response, so sort and filter run over the full dataset (not
the loaded page) with windowed loading. Same-path **reshape** — no new path;
regenerate the contract in the commit that ships it (row below).

| Kind | Endpoint (current → intended) | Decision | Note |
|------|-------------------------------|----------|------|
| **add ✅** | `GET /api/v1/refdata` | **D-005** | **Delivered 2026-07-10.** Single fixed-vocabulary endpoint (22 vocabs). Retires the per-master meta endpoints and all frontend inline lists. |
| **add ✅** | `GET /api/v1/refdata/txn-applicability` | **D-090** | **Delivered 2026-07-10.** AssetClass → offered TxnTypes for the Add-flow Type dropdown (MASTER-DATA §10). Form-level filter only; frontend zero-copy (D-005). |
| **reshape** | `GET /api/v1/portfolio/transactions` (+ sort/dir/filter/offset/limit + total) | **D-094** | **Drafted, not shipped.** Server-side sort/filter/windowing over the full dataset (never the loaded page); default most-recent-first. CSV export stays full-dataset server-side (D-050). Regenerate the contract the commit it ships. |
| **remove** | `GET /api/v1/insurance/meta` → (into `/refdata`) | **D-005** | Insurance vocab moves to `/refdata`; endpoint removed once `/refdata` lands. |
| **remove** | `GET /api/v1/estate/meta` → (into `/refdata`) | **D-005** | Estate vocab (doc categories, contact roles) moves to `/refdata`. |
| **add** | `POST /api/v1/entities`, `PATCH /api/v1/entities/{id}`, `DELETE /api/v1/entities/{id}` | **D-065** | Entity CRUD; only `GET /api/v1/entities` exists today. |
| **add ✅** | `GET /api/v1/portfolio/holdings.csv` | **D-050** | **Delivered 2026-07-10.** Server-side holdings CSV export; formula-injection sanitised; client never generates the file (P-5). |
| **reshape ✅** | `POST/PUT /api/v1/portfolio/transactions` (`TransactionIn`) | **D-019** | **Delivered 2026-07-10.** Adds `related_instrument_id` — the merger "Absorbed into" target (ratio in `price`). The DB column + `resolve_mergers` already existed; this exposes it in the request body. |
| **reshape ✅** | `GET /api/v1/portfolio/holdings` | **§9-6** | **Delivered 2026-07-10.** Response typed (`HoldingsResponse`/`HoldingView`) — replaces `additionalProperties: true` with an explicit footprint for contract hygiene. |
| **rename** | `GET /api/v1/review/centre` → `GET /api/v1/review` | **D-030** | "Review Centre" retired to "Review". |
| **rename** | `GET /api/v1/portfolio/cost-of-ownership` → `…/ongoing-cost` | **D-029** | "Cost of ownership" retired to "Ongoing cost (expense ratio)". |
| **rename** | `GET /api/v1/portfolio/realised-gains` (+ `.csv`) → "Realised P/L" naming | **D-026** | "Realised gain(s)" retired to "Realised P/L". |
| **reshape** | `GET /api/v1/dashboard/home` | **D-046** | Home composition: fixed linked-summary set; Simple/Full layouts. |
| **reshape** | `POST /api/v1/ai/chat`, `GET /api/v1/briefing`, instrument explainer | **D-067 / D-068 / P-6** | All AI surfaces ride the single grounded+validated pipeline; no direct model calls. |
| **present** | `GET/POST /api/v1/tokens`, `DELETE /api/v1/tokens/{id}` | **D-069** | API-token management already in the baseline — no change. |
| **present** | `GET/POST /api/v1/watchlists` (+ items) | **D-052** | Watchlist management already present (Markets-only in UI). |
| **present** | `GET /api/v1/portfolio/pricing-health` (+ `/refresh`) | **D-072** | Pricing Health diagnostics present (visibility yes, priority editing no). |
| **present** | `GET /api/v1/markets/global` | **D-051** | Markets **Global tab** — KEEP. Not the D-042 frontend `/global` page. |

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

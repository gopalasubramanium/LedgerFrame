# page-holdings.md — Holdings page build plan

**Instantiated from `docs/plans/TEMPLATE-page-build.md`.** Holdings is the
canonical **data-entry / management** surface: add/edit/delete holdings,
transactions, and manual assets; imports; tags; soft-delete + undo; server-side
CSV export. It owns *management*, not *analytics* (Portfolio owns analytics,
D-023).

> **REVIEWED — all §9 items resolved 2026-07-10 (owner).** Build proceeds per §8.
> **Ratification gate:** the four §5 component amendments (Dialog/Drawer,
> FileInput, Toast, PIN-confirm) are built token-compliant and landed in
> `/kitchen-sink` first, then the **build pauses for the owner's ratification
> look** before Holdings assembly (Phase 1) starts. Resolutions are recorded in §9.

---

## 1. IDENTITY

| Field | Value | Spec ref |
|-------|-------|----------|
| Page name (H1 = nav label = route) | **Holdings** | IA §2 |
| Route | `/holdings` | IA §2 |
| Nav group | **Wealth** | IA §3 (group 2) |
| Page template | **Worklist** (primary DataTable(s) + row actions + CRUD editor) | DESIGN-SYSTEM §3 |
| Rotation eligibility | **Eligible** — any nav page is eligible; rotation **skips it when empty or erroring** (D-044) | IA §3 |
| One-line purpose | "Management surface: add/edit/delete holdings, transactions, manual assets, imports." | IA §2 |

---

## 2. OWNERSHIP TABLE

*Copied from INFORMATION-ARCHITECTURE.md §5 (Holdings — D-023/D-049/D-050).*

**Owns (canonical, authoritative here):**
- The **management surface**: add / edit / delete **holdings**; the
  **transactions ledger**; **manual assets**.
- **Instrument picker** replaces free-text symbol entry (D-012).
- **Merger type** in the transaction form (D-019).
- **All vocab from `/refdata`** (the 6-value `TXN_ASSET_CLASSES` subset dies, D-005/D-049).
- **Import preview→commit** with an **unresolved-symbol review queue** (D-012).
- **Soft-delete + 10s undo + purge-deleted [PIN]** (D-049).
- **One Add flow** — branch: listed instrument vs manual asset; per-type meta
  whitelisted (AddAssetWizard folds into this, D-049).
- **Holding tags** (add/remove; case-insensitive; cap 16/holding, D-011).

**Summarises (via the canonical page's reader, linked — never recomputed):**

| Summary shown | Canonical page | Shared reader reused | Link target |
|---------------|----------------|----------------------|-------------|
| The **value / positions header** (total value, position count) | **Portfolio** (analytics) | the Portfolio value/summary reader (`value_portfolio`) — **not** a second computation | → Portfolio |

**Links to:**
- **Portfolio** ("analytics") — the D-023 both-ways cross-link (Holdings
  "manage" ↔ Portfolio "analytics").
- **Pricing Health** — per-holding provenance/confidence detail.
- **Instrument Detail** (`/instrument/:symbol`) — per row (P-3 scoped view).

**Enforcement corollary (P-1/D-031):** the value/positions header shows **only**
figures the Portfolio reader already produces; Holdings adds **no** analytics
figure of its own. Per-holding value/price shown in the table are the same
reader's rows, not a re-derivation (all money math is backend, §4b).

---

## 3. API SURFACE

### 3a. Endpoints consumed (already in the frozen contract, 121-path baseline)

| Method + path | Purpose on this page | Response shape pinned? |
|---------------|----------------------|------------------------|
| `GET /api/v1/portfolio/holdings` | Holdings table rows (value/price/provenance/tags) | **No** (`additionalProperties: true`) — see §9-6 |
| `GET /api/v1/portfolio/summary` | The value/positions **summary header** (P-1 summary) | No — confirm exact reader, §9-6 |
| `GET /api/v1/portfolio/transactions` · `POST` | Transactions ledger; add a transaction | Request = `TransactionIn` (see §9-1) |
| `PUT /api/v1/portfolio/transactions/{txn_id}` · `DELETE` | Edit / **soft-delete** a transaction | `TransactionIn` |
| `POST /api/v1/portfolio/transactions/{txn_id}/restore` | **Undo** a soft-deleted transaction | — |
| `GET /api/v1/portfolio/manual-holdings` · `POST` | Manual assets list; add manual asset | `ManualHoldingIn` |
| `PUT /api/v1/portfolio/manual-holdings/{holding_id}` · `DELETE` | Edit / **soft-delete** a manual holding | `ManualHoldingIn` |
| `POST /api/v1/portfolio/manual-holdings/{holding_id}/restore` | **Undo** a soft-deleted manual holding | — |
| `POST /api/v1/portfolio/purge-deleted` | **Purge** soft-deleted rows **[PIN]** | — |
| `POST /api/v1/portfolio/import/preview` | Import **preview** (dry run → review queue) | **No** (`additionalProperties: true`) — see §9-6 |
| `POST /api/v1/portfolio/import/commit` | Import **commit** | multipart `file` |
| `GET /api/v1/portfolio/import/template` | Download the CSV import template | — |
| `PUT /api/v1/portfolio/holdings/{holding_id}/tags` | Set a holding's tags | `HoldingTagsIn` |
| `GET /api/v1/portfolio/tags` | Existing tags (tag master for the tag editor) | — |
| `GET /api/v1/accounts` (or `/accounts/list`) | Account selector options (user records) | — |
| `GET /api/v1/instruments/{symbol}` | Instrument resolution for the picker / row detail | — |

Possibly consumed (confirm during Phase 1, not a blocker): `POST /api/v1/portfolio/reclassify`
(the D-087 `other`-overuse reclassification nudge may surface a reclassify action here).

### 3b. Contract deltas (needed but not in the baseline — BUILD BACKEND-FIRST)

Each is built backend-first and regenerates `docs/specs/API-CONTRACT.json` +
`docs/openapi.json` in the **same commit** (freeze rule; `make api-contract-check`).

| kind | Endpoint (current → intended) | Decision | Why Holdings needs it |
|------|-------------------------------|----------|-----------------------|
| **add** | `GET /api/v1/refdata` | **D-005** | Every `MasterSelect` (asset_class, txn_type, currency) reads the fixed vocabularies from here; the frontend carries no vocab. *May be delivered by the dedicated `/refdata` plan; Holdings build is gated on it.* |
| **add** | `GET /api/v1/portfolio/holdings.csv` | **D-050** | Server-side holdings CSV export (P-5); the client never generates the file. Only `realised-gains.csv` / `statements.csv` exist today. *May be its own plan; Holdings consumes it.* |
| **reshape** | `POST /api/v1/portfolio/transactions` (`TransactionIn`) | **D-019** | **Blocker (§9-1):** the frozen `TransactionIn` has **no field for the merger target** ("Absorbed into") or the ratio. D-019 maps these to `related_instrument_id` + `price`, but the API request body does not expose `related_instrument_id`. A merger cannot be recorded through the current contract → reshape `TransactionIn` to accept it. |

---

## 4. COMPONENTS

*All from the ratified DESIGN-SYSTEM §5 inventory (2026-07-10). Kitchen-sink
coverage noted; anything unexercised carries build+test risk.*

| Ratified component | Role on Holdings | Prop/state NOT exercised at kitchen-sink |
|--------------------|------------------|------------------------------------------|
| **PageHeader** | Title "Holdings"; subtitle states the management↔analytics split (D-023); actions: Add · Import · Export | `actions` slot with **multiple** buttons |
| **DataTable** | (a) Holdings table — value/positions, per-row provenance, tags, `rowLink`→Instrument Detail; (b) Transactions ledger — with edit/delete row actions; (c) import review-queue table | **`rowLink`** (not demoed); a **row-actions column** (edit/delete via custom `render`); a **ProvenanceBadge/StalenessChip embedded in a cell** (badges were standalone at kitchen-sink); **two tables on one page** |
| **TrendStat** | The value/positions **summary header** (linked P-1 summary) | Used as a **linked summary header** (intended usage; provenance slot exercised) |
| **MoneyInput** | Manual asset value; transaction price, fees, taxes | — (currency-master options; exercised via other masters) |
| **QuantityInput** | Transaction / holding quantity | — |
| **DateInput** | Transaction date (`ts`) | — |
| **MasterSelect** | `asset_class`, `txn_type`, `currency` (currency master) | currency-master binding (same component, different master) |
| **InstrumentPicker** | Symbol entry (create path); merger **"Absorbed into"** target | `scope?` prop; **second usage as the merger-target picker** |
| **Select** | **Account** picker (user records, from `/accounts` — not a MASTER-DATA master) | Populated from a **user-record list** (vs the fixed source-scope demo) — confirm §9-7 |
| **ProvenanceBadge** / **StalenessChip** | Per-holding provenance / staleness in the table | Rendered **inside a table cell** |
| **EmptyState** | Empty holdings / empty transactions / import-with-no-rows / error | — |
| **GlossaryTerm** | Column-header / help popovers for shown terms (e.g. Unrealised P/L, Cost basis) | — |

**Affordances the ratified inventory LACKS — amendment required before build (see §9):**
- **CRUD editor container** — the "one Add flow" (branch listed vs manual),
  the edit forms, and the import wizard need a container. The worklist template
  (DESIGN-SYSTEM §3) names a "CRUD editor" but **no ratified component realises
  it** (no Dialog / Drawer / side-panel). *(§9-2)*
- **FileInput** — CSV import needs a file-picker control; §5.1 has no file input
  and raw `<input type="file">` is forbidden (§6). *(§9-3)*
- **Undo toast / snackbar** — soft-delete's **10s undo** needs a transient,
  timed, dismissible affordance with an Undo action; §5.5 chrome has StaleBanner
  / UpdateBanner but **no transient toast**. *(§9-4)*
- **PIN-confirm** — `purge-deleted` is **[PIN]-gated**; there is no PIN-entry /
  confirm-dialog component (depends on the §9-2 container decision). *(§9-5)*

---

## 5. VOCABULARIES

| Field on Holdings | Vocabulary / master | Fixed (/refdata) or extensible | MASTER-DATA ref |
|-------------------|---------------------|-------------------------------|-----------------|
| Transaction **type** (incl. `merger`) | `TxnType` (11) | Fixed | §2 |
| **Asset class** (manual asset; txn) | `AssetClass` (13) | Fixed | §2 |
| **Currency** (txn / manual value) | Currency master (22, 9 base-eligible) | Master (fixed set, D-006) | §3 |
| **Tags** (per holding) | Tag master | Extensible (case-insensitive, cap 16) | §6 |

**User data, NOT a master (use `Select`, not `MasterSelect`):**
- **Account** selector — accounts are user records from `/accounts`, not a
  MASTER-DATA vocabulary. Resolved by `ui/Select` over the account list.

*Not touched on Holdings (instrument-level, edited on Instrument Detail):*
`asset_subclass`, `liquidity_profile`, `sector`, `listing_country`,
`institution`. `ManualHoldingIn` sets `asset_class` only.

---

## 6. DECISIONS IN FORCE

| Decision | What it forbids / requires on Holdings |
|----------|-----------------------------------------|
| **D-012** | Instrument entry MUST be the typeahead **InstrumentPicker** with an **explicit create** path — no free-text symbol, no silent auto-create. Imports use the **same resolution + a review queue** for unresolved symbols. |
| **D-019** | Merger recorded in the txn form via **"Absorbed into" (picker) + "Ratio"** → `related_instrument_id` + `price`. *(Requires the §3b/§9-1 reshape — the field isn't in the frozen request body.)* |
| **D-023** | Holdings = **management** page; subtitle states the split; **cross-link Portfolio** both ways. Holdings shows no analytics figure Portfolio owns. |
| **D-049** | KEEP (reshaped): picker + merger + `/refdata` vocab + import review queue + **soft-delete + 10s undo + purge [PIN]** + **one Add flow** (listed vs manual, whitelisted meta). The `TXN_ASSET_CLASSES` 6-value subset is **deleted**. |
| **D-050 / P-5** | CSV export is **server-side** (`/portfolio/holdings.csv`); the client **never** generates the file. Exported cells are formula-injection sanitised server-side (SECURITY §10). |
| **D-005** | Every categorical is a **MasterSelect** bound to `/refdata`; **no inline option lists**, no `refdata.ts` copy. |
| **D-011** | Tags: case-insensitive uniqueness, **cap 16/holding**. |
| **P-1 / §4b** | Value/positions header is a **summary of the Portfolio reader**, linked; **no frontend money math** — every figure is a backend `Decimal` string. |
| **P-3** | Per-row link to Instrument Detail is a **scoped view** (filter), not a duplicate page. |
| **D-025 / D-026** | Terminology: **"Today's change"**, **"Unrealised P/L"** (if shown as columns) — retired synonyms ("Day", "Paper gain", "Realised gain") must not appear. |
| **§6 hard rule** | Compose ratified components; **no raw `<input>`/`<select>`**, no ad-hoc styling; tokens only. |
| **D-078 / D-066** | Correct in **both densities** and **both themes**; density affects table row height. |
| **Product Guarantee 3** | Empty/"—" regions show a **reason**; stale flagged; nothing fabricated. |
| **D-002 (PIN)** | `purge-deleted` is a destructive, **PIN-gated** action. |

---

## 7. ACCEPTANCE CRITERIA

- [ ] **Holdings table** lists positions with per-unit tabular figures (money 2dp,
      price 6dp, quantity per-instrument), right-aligned; each row links to
      Instrument Detail; per-row provenance (source·freshness·confidence) and a
      staleness flag are shown.
- [ ] **Summary header** shows total value + position count as a **linked summary**
      of the Portfolio reader (no recomputation); links to Portfolio.
- [ ] **Add flow (one flow)** branches to *listed instrument* (InstrumentPicker →
      currency/asset_class carried from the instrument) or *manual asset*
      (label, value, asset_class, currency); per-type meta whitelisted.
- [ ] **Add transaction** supports all `TxnType` values; **merger** shows
      "Absorbed into" (picker) + "Ratio"; buy/sell/dividend etc. as required.
- [ ] **Edit / delete** a holding, manual asset, or transaction; delete is
      **soft** and shows a **10s undo**; after the window the row is gone; **purge
      deleted** requires **PIN**.
- [ ] **Import**: upload CSV → **preview** with an **unresolved-symbol review
      queue** (resolve each via InstrumentPicker / explicit create — never silent
      auto-create) → **commit**; the CSV template is downloadable.
- [ ] **Tags**: add/remove per holding; case-insensitive; blocked past 16 with a reason.
- [ ] **Export** triggers the **server-side** `/portfolio/holdings.csv` download;
      the client generates no file.
- [ ] **Empty state:** "No holdings yet" with a reason + Add/Import actions
      (Product Guarantee 3). Empty transactions likewise.
- [ ] **Error state:** a failed reader shows "couldn't load … " with a reason —
      values are withheld, never guessed.
- [ ] **Stale / low-confidence** rows are flagged (amber chip), never hidden or faked.
- [ ] **Negative values, very long instrument names, multiple currencies** render
      correctly (tabular, no horizontal page overflow — table scrolls in its box).
- [ ] **Both densities** (comfortable/compact row heights) and **both themes**
      (light/dark) render correctly; **keyboard + WCAG AA** (focus ring, `aria-sort`,
      labelled inputs).
- [ ] **No frontend money math**; **terms** match GLOSSARY; **categoricals** come
      from `/refdata` via MasterSelect.

---

## 8. BUILD PHASES

*One commit per phase. §9 is resolved (2026-07-10). Component amendment first
(it is the ratification gate), then backend deltas, then assembly, then tests.*

- **Phase 0a — Component amendment (DESIGN-SYSTEM §5). ✅ DONE + RATIFIED
  2026-07-10.** Built **Dialog/Drawer**, **FileInput**, **Toast/Snackbar**, and
  **ConfirmDialog + PIN** (PIN overlay reuses Dialog — §9-5), token-compliant
  (drift green; added a `--scrim` token). DESIGN-SYSTEM §5 amended and
  **ratified at the owner's look** (both themes; light scrim opacity +
  nested-drawer isolation + reduced-motion toast confirmed). All four in
  `/kitchen-sink` (new "§5 amendments" section); 6 dedicated tests. `npm run
  check` (29 tests) + build green; verified in headless Chromium.
- **Phase 0b — Contract deltas (§3b), backend-first. ✅ DONE 2026-07-10.**
  Delivered `GET /refdata` (D-005, 22 vocabs from the canonical enums/constants),
  `GET /portfolio/holdings.csv` (D-050, formula-injection sanitised), the
  `TransactionIn` **merger reshape** (D-019 — exposes `related_instrument_id`;
  the DB column + `resolve_mergers` already existed), and the **typed**
  `GET /portfolio/holdings` response (`HoldingsResponse`/`HoldingView`, §9-6).
  Contract regenerated (`API-CONTRACT.json` + `docs/openapi.json`, 121→**123
  paths**); drift check green. **459 backend tests pass** (+4 new); ruff clean.
  *Scoping note (honest): §9-6 response-typing was scoped to `portfolio/holdings`
  per the owner's resolution; `portfolio/summary` and `import/preview` remain
  `additionalProperties: true` and are a follow-up contract-tighten (not a
  Holdings blocker).*
- **Phase 1 — Page assembly. ✅ DONE 2026-07-10.** `/holdings` route composes the
  ratified components: holdings **DataTable** (per-unit tabular figures,
  gain/loss cells, per-holding provenance via StalenessChip + valuation label,
  Tags action), the **linked P-1 summary header** (TrendStat → Portfolio,
  D-023), the **transactions ledger** with soft-delete + **10s undo Toast**
  (restore), the **one Add flow** (Dialog; listed-instrument vs manual-asset
  branch; **merger** shows Absorbed-into + Ratio, D-019), **import** (FileInput →
  preview → commit), **tags** editor (Dialog, cap 16), **purge [PIN]**
  (ConfirmDialog), and **server-side Export** (`apiDownload`, P-5). Honest
  loading/empty/error states. Vocab via **`/refdata`** through a `RefdataProvider`
  (MasterSelect reads live values, D-005; registry is the labelled offline
  fallback). New API client (`api/client.ts`, `api/holdings.ts`); formatters
  widened to accept the backend's display floats. **Verified in headless Chromium
  against the live backend** with real seeded data (14 positions, gain/loss,
  provenance). Surfaced + built **`TextInput`** (§9-8, PROPOSED) for free-text
  label/tag fields.
- **Phase 2 — Tests + verification. ✅ DONE 2026-07-10.** `Holdings.test.tsx` (6
  tests, API mocked): renders holdings + linked summary, honest empty + error
  states, server-side Export, the Add flow's listed/manual branches, and
  soft-delete → Undo → restore. Full frontend suite **35 tests**; drift +
  typecheck + lint + build all green.

---

## 9. NEEDS DECISION *(RESOLVED 2026-07-10 — owner; see resolutions below)*

| # | Item | Why it blocks / what's needed | Proposed resolution (for owner to approve) |
|---|------|-------------------------------|--------------------------------------------|
| **1** | **Merger target field missing from `TransactionIn`** | D-019 requires "Absorbed into" + "Ratio", mapped to `related_instrument_id` + `price`. The **frozen `TransactionIn` exposes neither `related_instrument_id` nor any merger-target field**, so a merger cannot be submitted through the current API. D-019's "no schema change" referred to the **DB model**, not the API request body. | **Reshape `TransactionIn`** to accept `related_instrument_id` (optional; required when `type == merger`) and document ratio-in-`price`. Backend-first contract delta (§3b), same-commit contract regen. |
| **2** | **CRUD-editor container not in the inventory** | The worklist template names a "CRUD editor" but no ratified component realises the Add flow / edit forms / import wizard container. New components are **forbidden without a DESIGN-SYSTEM amendment**. | **Amend DESIGN-SYSTEM §5** to add a container (recommend a **Dialog/Drawer** with focus-trap + Esc + `--shadow-1`), or ratify inline side-panel editing as the worklist CRUD editor. Pick one before build. |
| **3** | **No file-input component for CSV import** | §5.1 has no file picker and raw `<input type="file">` is forbidden (§6). | **Amend §5.1** to add a **`FileInput`** (accept filter, drag-drop optional, filename display, token-styled). |
| **4** | **No transient undo affordance** | Soft-delete's **10s undo** (D-049) needs a timed, dismissible toast with an Undo action; §5.5 has no transient toast. | **Amend §5.5** to add a **`Toast`/`Snackbar`** (auto-dismiss with countdown, action slot, reduced-motion aware, ARIA live-region). |
| **5** | **No PIN-confirm for destructive purge** | `purge-deleted` is **[PIN]-gated** (D-002/D-049); no PIN-entry or confirm-dialog component exists. | Depends on #2: a **ConfirmDialog** variant with a **numeric PIN entry** (masked; not MoneyInput). Amend §5 alongside #2. |
| **6** | **Untyped response shapes** | `GET /portfolio/holdings`, `/portfolio/summary`, and `POST /import/preview` are `additionalProperties: true` in the frozen contract — the **exact fields** for the table columns and the review-queue rows are **not pinned**. | Not a hard blocker (responses are reader-driven). **Confirm the reader's field set** at Phase 1 start against the live app; optionally pin these response schemas in a follow-up contract tighten. Which reader feeds the header (`/portfolio/summary` vs `/portfolio/stats`) must be named. |
| **7** | **Account selector = user data, not a master** | An account picker is not a MASTER-DATA vocabulary; the ratification put non-master selects on `ui/Select`. | Confirm **`ui/Select` over `/accounts`** is acceptable for account selection (recommended), vs. wanting a richer account picker. Low-risk. |

### Resolutions (2026-07-10, owner)

- **§9-1 — Merger reshape: APPROVED.** Backend-first `TransactionIn` reshape to
  carry the merger target (`related_instrument_id`; ratio in `price`), contract
  regenerated in the **same commit** (Phase 0b).
- **§9-2 / §9-3 / §9-4 — Dialog/Drawer · FileInput · Toast: APPROVED as a
  DESIGN-SYSTEM §5 amendment.** Built token-compliant and added to
  `/kitchen-sink`; **owner ratifies the four sections before Holdings assembly
  starts** (Phase 0a → pause).
- **§9-5 — PIN-confirm: APPROVED (spec-gap resolution).** The PIN-gated
  purge/confirm **reuses the newly amended `Dialog` primitive** for the overlay —
  structural consistency, no inventory sprawl (a masked PIN entry lives inside
  the ConfirmDialog).
- **§9-6 — Response typing: APPROVED as a contract delta (freeze rule).** Replace
  `additionalProperties: true` with an **explicit, strongly-typed schema** for
  `portfolio/holdings` (and `portfolio/summary`, `import/preview`), same-commit
  contract update (Phase 0b). Name the header reader (`portfolio/summary`).
- **§9-7 — Account picker: CONFIRMED.** `ui/Select` over `/accounts` (user
  records) — no `MasterSelect`, no new component.
- **Reclassify hook (3a note): APPROVED as a product call — lightest mechanism.**
  Prefer **reusing the existing instrument-edit path with a deep-link from the
  Review `other`-overuse signal**; add `POST /portfolio/reclassify` **only if**
  the existing path genuinely can't serve the nudge — with a same-commit contract
  update if so.

### Acceptance-walk findings (2026-07-10, owner) — resolved

- **§9-9 — Split/bonus purpose-labelled fields (resolved the D-019 way; no engine
  change).** The generic price/quantity form was ambiguous for corporate actions.
  Verified against the engine's **pinned §4.3 test vectors**
  (`tests/unit/test_fifo.py`): **split** scales lots by the **ratio carried in the
  `price` field** (qty ignored — `test_split_scales_lots`, `_split_4to1_…`);
  **bonus** adds shares at **zero cost from the `quantity` field**, no price
  (`test_bonus_adds_shares_at_zero_cost`). The Add flow now gives each a
  purpose-labelled field mapping onto that existing schema — **split → "Split
  ratio"** (→ price, qty 0); **bonus → "Bonus units"** (→ quantity, no price
  field). Merger unchanged (Absorbed-into + Ratio). No engine/contract change.
- **§9-10 — Select dark-theme popup (bug, fixed).** The native `<select>` open
  popup ignored the theme (white popup, light text in dark). Fixed **inside the
  ui input layer** (`inputs.css`): `color-scheme` themes the native popup +
  tokenized `option` colours; every consumer (Select/MasterSelect/DateInput)
  inherits. A "Select · open it in both themes" specimen added to `/kitchen-sink`;
  TEMPLATE-page-build.md §7 now requires **manual open-state verification in both
  themes**.
- **§9-11 — Terminology (fixed).** "Total value" (retired, D-021) relabelled to
  **"Net worth"** on the Holdings summary (the figure is net of liabilities per
  GLOSSARY), shown as a linked P-1 summary to the Net worth page. Frontend
  grepped for the other deprecated terms — none present.

### Add-flow per-type semantics — acceptance walk #2 (2026-07-10, owner)

Same discipline as split/bonus: engine semantics verified first, then forms
reshaped. **No engine changes.**

- **§9-12 — Dividend (fixed).** **Verified:** the engine consumes dividends as
  **total cash**, not per-share — `statements_report.py` sums `t.amount` into
  income (and `inc_ccy += t.amount`); `compute_fifo` does `income += t.amount`;
  a dividend never appends a lot. `t.amount` is the server-computed cash impact
  (`_txn_cash_impact` = qty×price − costs). **Form:** a single **"Amount
  received"** (+ currency), no quantity/price. **Mapping (no engine change):**
  quantity = 1, price = Amount → stored `amount` == Amount → income == Amount.
- **§9-13 — Interest (fixed).** Same engine path as dividend
  (`income += t.amount`; bucketed under "Interest"). **Form:** single **"Amount
  received"**, no quantity; the **instrument is optional** (interest on cash has
  no instrument — `Transaction.instrument_id` is nullable). Same quantity 1 ×
  price mapping.
- **§9-14 — Fee (fixed).** **Verified:** a `type = fee` transaction routes to the
  **Recorded fees** block via `abs(t.amount)` (`statements_report.py`), and has
  **no `compute_fifo` branch** → it **never enters cost basis** (D-048
  never-blend). Trade commissions stay on the trade (the buy/sell `fees` field,
  summed separately). **Form:** a single **"Amount"** with help text (standalone
  custody/platform/advisory charges; commissions recorded on the trade),
  instrument optional. **Mapping:** quantity = 1, price = Amount → `amount` =
  −Amount → Recorded fees += Amount. Deliberately **not** the `fees` field (that
  would double-count with line 73). GLOSSARY gains **"Fee (recorded)"**.
- **§9-15 — Fractional quantities (audited; supported end-to-end, no change).**
  Full-path audit:
  - **DB:** `Transaction.quantity`, `Holding.quantity`, lot quantities, price,
    amount are all **`DecimalText`** (exact arbitrary-precision Decimal). ✔
  - **Engine:** `compute_fifo` uses `Decimal` throughout (FIFO lot math exact). ✔
  - **API:** `TransactionIn.quantity` / `HoldingView.quantity` are **`float`** —
    decimals supported (0.75, mutual-fund units, fractional shares). The only
    ceiling is float's ~15–17 significant figures at the JSON boundary — adequate
    for real holdings, but not exact for 18-decimal (wei-level) crypto.
  - **Frontend:** `QuantityInput` is free-decimal text → `Number()`; no
    integer-only validation anywhere. ✔
  - **Verdict:** fractional is supported end-to-end; **no layer is integer-only**,
    so no fix is required. **Optional NEEDS DECISION (non-blocking):** if
    sub-float exactness is ever wanted for high-precision crypto, the minimal fix
    is Decimal **strings** at the API boundary for quantity/price (schema change,
    no engine change) — parked-worthy, not needed for v2.

### Add-flow type-first entry — acceptance walk #3 (2026-07-10, owner) — D-089

- **§9-16 — Type-first Add flow (D-089; recorded in DECISIONS.md).** The Add
  entry step becomes a **grid of asset-type tiles in user vocabulary** — Stocks &
  ETFs · Mutual fund · Crypto · Cash · Fixed deposit · Bond · Property ·
  Retirement · Private · Liability · Other — each with a one-line subtitle.
  Choosing a tile routes to the **existing single D-049 flow** with the correct
  **branch** and per-type fields preselected; the Listed/Manual mechanism tabs
  **stop being the front door** (mechanism becomes routing detail), the flow
  underneath **unchanged**. Branch map (owner clarification): **Listed** =
  provider-quoted (equity/ETF, mutual fund via AMFI, crypto via CoinGecko);
  **Manual** = manually-valued (cash, FD, bond, property, retirement, private,
  liability). **Insurance is never in this flow** (D-062). Tile → branch/asset
  class comes from the existing **MASTER-DATA `AssetClass`** — no new vocabulary;
  Listed tiles pass their asset class to new-instrument classification (crypto →
  CoinGecko, mutual_fund → AMFI), Manual tiles preselect
  `ManualHoldingIn.asset_class`. **No backend/engine/contract change.**

### Type drives the form — acceptance walk #4 (2026-07-10, owner)

- **§9-17 — Transaction-type applicability matrix (D-090, PROPOSED).** Authored a
  PROPOSED **AssetClass × TxnType** matrix — MASTER-DATA **§10**, every cell
  PROPOSED — from engine behaviour + financial reality (Indian MF splits/bonus;
  interest → FD/bond/cash; dividend → equity/ETF/MF; corporate actions →
  provider-quoted). After ratification the Type dropdown filters by the picked
  class (**form-level only, engine unchanged**). Judgment calls flagged (crypto
  corporate actions off; retirement/liability interest). **→ RATIFIED + SHIPPED
  2026-07-10 (see §9-25).**
- **§9-18 — Per-class creation-time field spec (D-091, PROPOSED).** Authored a
  PROPOSED per-class **REQUIRED vs OPTIONAL-PROMPTED** table — MASTER-DATA
  **§11** — seeded from the existing D-049 `_META_KEYS` whitelist. **Verified:**
  FD rate/maturity, bond coupon/maturity, property address/valuation-date,
  retirement scheme, private company/ownership already exist in the backend
  whitelist; **gaps** = property `cost`, private `round` (whitelist additions,
  no schema change). The frontend Manual form collects none of these yet.
  Incomplete optional details → a **low-priority Review signal** (never a hard
  wall; proposed `_INCOMPLETE_DETAILS_MIN`). **→ RATIFIED + SHIPPED 2026-07-10
  (see §9-25).**
- **§9-19 — Compact type picker (fixed now).** The "What are you adding?" grid is
  now **compact** (smaller type, tighter grid, `-webkit-line-clamp` subtitles,
  shorter copy) so all **11 tiles + Cancel fit without scrolling** on a laptop
  (3–4 columns as width allows), still usable on phone. Presentational only —
  independent of the D-090/D-091 ratification.

### Final findings batch — acceptance walk #5 (2026-07-10, owner)

- **§9-20 — D-092 Insurance signpost tile (DONE).** The type picker gains an
  **Insurance** tile that **navigates to `/insurance`** and never branches the
  Add form (D-062 register unchanged). Visually distinct (dashed, accent title,
  "→"). DECISIONS.md D-092.
- **§9-21 — D-093 editable import review grid (DONE).** Import preview → an
  **editable grid**: per-cell highlighting of invalid type/date, duplicate rows
  flagged (excluded by default), rows fixable **inline** (date/symbol/type/qty/
  price/currency) or **excluded**; **Commit disabled until every included row is
  valid**. Commit reconstructs a corrected CSV from the included rows and
  re-uploads (`commit_import` re-validates). No engine change. DECISIONS.md D-093.
- **§9-22 — Tags-clip fix + row quick actions (DONE).** The clipped "Tags"
  column is gone: per-row actions now live in a compact **`RowMenu`** (⋯) —
  Holdings: Details (→ instrument) · Tags · Delete (manual holdings soft-delete +
  undo; derived → a note to delete its transactions); Transactions: Edit
  (`TxnEditDialog` → PUT) · Delete (soft-delete + undo). DataTable gains a
  **`truncate`** column option (Name/Source/Note) so long text ellipsises instead
  of forcing horizontal scroll. Verified no clipped headers / no mandatory
  h-scroll at **1366px and 1920px**, both densities. DESIGN-SYSTEM §3 worklist
  note + §5.4 RowMenu.
- **§9-23 — Purge polish + `deleted-count` endpoint (DONE).** New read-only
  `GET /portfolio/deleted-count` (contract delta, +1 path → 124); the "Purge N
  deleted [PIN]" control is **hidden at zero** and shows the count when present.
- **§9-24 — 500 resolution (CLOSED).** Root cause was **environmental** (the
  owner's dev setup started only Vite, not the backend); with the backend up,
  holdings/summary/CSV all work and no valuation warnings appear. The per-holding
  resilience + `fx.convert`/`native_ccy` guards from the prior fix **stay as
  legitimate defence-in-depth** (`test_valuation_resilience`). See the `make dev`
  ergonomics work so this can't recur.

### Surfaced during Phase 1 assembly (2026-07-10) — for the Holdings look

- **§9-8 — free-text input gap → `TextInput`.** Assembly found the manual-asset
  **label** and **tag** fields are free text, and the ratified inventory had **no
  plain text input** (§6 forbids raw `<input>`). Resolved by building a minimal
  **`TextInput`** (§5.1, sibling of the other inputs; wraps the native input),
  added to `/kitchen-sink`, and **marked PROPOSED** — for the owner's **ratify at
  the Holdings look** (same pattern as the four §5 amendments). NOT for
  categorical data (that stays MasterSelect).
- **Known follow-ups (non-blocking, noted honestly):**
  1. **InstrumentPicker → real instrument search.** The ratified picker is
     mock-backed. Symbol *entry* works via its **create path** (returns the typed
     symbol string, which the backend `_ensure_instrument` resolves on submit).
     But selecting a **merger target** by real `related_instrument_id` needs the
     picker wired to a real instrument-search endpoint — a small follow-up delta.
     The D-019 merger **form** (Absorbed into + Ratio) is present.
  2. **Per-holding tags read-back.** The holdings reader doesn't echo a holding's
     current tags, so the tags editor starts empty (write works via
     `PUT …/tags`). Echoing current tags is a minor reader/contract tweak.
  3. **Purge PIN transport.** `require_pin` authorises via an Authorization
     header from an unlock session (a Settings/Security concern). The
     ConfirmDialog PIN is the **deliberate UX gate** (D-049); binding it to real
     session auth lands with the unlock flow.

### D-090/D-091 ratified + D-094 recorded — acceptance walk #6 (2026-07-10, owner)

- **§9-25 — D-090 ratified (ETF Bonus amendment) + shipped.** Matrix served at
  `GET /refdata/txn-applicability` (frontend zero-copy, D-005; +1 path → **125**).
  The **Listed** Type dropdown filters to the picked class's row (`MasterSelect`
  gains an `include` subset prop). The **Manual** branch gains a **"Record
  transaction"** sub-mode offering the class's cash-flow types
  (interest/deposit/withdrawal/fee/transfer; buy/sell excluded — a manual holding
  *is* the position), recorded instrument-less via the existing
  `POST /portfolio/transactions` (`qty 1 × price = amount`; `_txn_cash_impact`
  signs it). **No engine change.** MASTER-DATA §10 flipped to RATIFIED; ETF Bonus
  cell ✓.
- **§9-25 — D-091 ratified + shipped.** `_META_KEYS` gains property **`cost`** and
  private **`round`**. The Manual Add form prompts the per-class OPTIONAL-PROMPTED
  fields (`MANUAL_META_FIELDS`, ratified inputs by kind), submitted as `meta`.
  Review signal `_INCOMPLETE_DETAILS_MIN = 1` (severity `info`) surfaces
  *"N holdings have incomplete details"* for bare-value manual holdings in the
  detail-bearing classes — never a hard wall. MASTER-DATA §11 flipped to RATIFIED.
- **§9-26 — D-094 table dataset-size posture.** **Audit:** `DataTable` is
  presentational; the page previously wired **neither** sort nor filter, so both
  tables rendered in raw API order and Transactions was capped at `limit=500`.
  - **Holdings — client-side sort/filter (shipped).** Wired `sort`/`onSort` +
    a filter box; numeric-aware comparator; the dataset is **bounded** (family
    portfolios are tens of positions). **Explicit assumption + threshold:** if a
    portfolio ever approaches **~1,000 positions**, revisit and move Holdings
    server-side (D-094).
  - **Transactions — server-side (shipped, own commit).** `GET
    /portfolio/transactions` gained sort/dir/filter/offset/limit + a **`total`**;
    sort and filter run over the **full dataset** (never the loaded page), windowed
    (100/page, most-recent first). The UI states *"Showing X–Y of Z"* with
    Prev/Next and a debounced server-side filter box — the **500-row silent cap is
    gone**. Numeric columns cast for value-sort. CSV export stays full-dataset
    server-side (D-050). Contract regenerated, drift green; +4 backend paging tests,
    +1 frontend server-side test.
  - **Worklist rule** added to `TEMPLATE-page-build.md` §4/§7: every table's plan
    states its dataset-size assumption and where sort/filter execute.

### Final-walk findings #7 (2026-07-10, owner) — round-trip bug + layout

- **§9-27 — CSV round-trip bug FIXED (D-095).** *Diagnosis:* the Holdings
  **Export** produced a holdings **snapshot** (`symbol,name,asset_class,currency,
  quantity,price,market_value_base,…`) while **Import** ingests a transactions
  **ledger** (`date,symbol,type,…`). Every row failed on the missing `type`/`date`,
  and a failed record never carried `symbol` → the grid showed "(none)". A snapshot
  **cannot** round-trip into a ledger without fabricating trade dates (a Product-
  Guarantee violation), so the honest lossless pair is a **transactions export ⇄
  the transactions import**. *Fix:*
  - New **`GET /portfolio/transactions.csv`** (server-side, full dataset, D-050) —
    columns are **exactly** `IMPORT_COLUMNS`, so it re-imports with zero errors /
    zero fixes. Wired to the Transactions ledger's **Export**. Contract +1 → **126**.
  - The importer now recognises a **holdings snapshot** and returns **one honest
    `format_error`** ("…a holdings snapshot (a positions report), not a transactions
    file. Use the Transactions Export…") instead of 14 per-cell errors; the dialog
    shows a banner, no grid, no Commit.
  - **Permanent round-trip test** (`tests/integration/test_csv_roundtrip.py`):
    export → import-preview → `errors == 0`, all rows ok, dates/types/symbols
    parsed; plus the snapshot-guidance guard. **Rule recorded** here + in
    `TEMPLATE-page-build.md` §7 (D-095): any surface that both exports and imports a
    format must have a lossless round-trip test.
- **§9-28 — Import review grid responsive (item 1b).** The review grid now uses
  content-typed responsive columns (date/type fixed-narrow; symbol wide+flexible;
  qty/price flex; ccy/status/action compact), fills the dialog, and the dialog is
  **`size="xl"`** (`min(64rem, 96vw)`) — usable at 1366px with no horizontal scroll
  for the core columns.
- **§9-29 — Add dialog fits without scrolling (item 2).** `Dialog` gains a **`size`**
  prop (`md`/`lg`/`xl`, all viewport-clamped) — a §5.4 amendment. The Add form is
  **`size="lg"`** with a **two-column** field grid at desktop (Account+Instrument,
  Type full-width, then Qty/Price and Date/Currency paired; the D-091 optional
  fields flow two-up), single column on narrow. Tighter vertical rhythm.
- **§9-30 — Holdings table fits 1366px (item 3).** Symbol+Name **merged** into one
  identity cell (symbol bold, name secondary); **Class** → compact chip; **Source**
  → the `StalenessChip` + tooltip pattern (no wide text column); Tags stay in the
  row menu; numbers keep tabular alignment. **Compact density** tightened one step
  (`--cell-pad`/`--row-height`, tokens.css) — a density amendment.

### Post-import + polish findings #8 (2026-07-10, owner)

- **§9-31 — Import visibility (item 1).** *Not a persistence bug* — the commit
  path saves + rebuilds correctly (verified). Imported rows are typically
  **historical-dated**, so they sink below the ledger's most-recent-first window
  and looked "unchanged". Fix: the ledger endpoint gains an **`added`**
  (insertion-order / `Transaction.id`) sort; **post-commit the ledger jumps to
  "recently added" (first page)** and the toast reads *"Imported N — showing most
  recently added"*, so the import is always evident. Backend + frontend tests.
- **§9-32 — StalenessChip (item 2).** Two bugs: `provenanceCell` passed the
  provenance **label** as `asOf` → *"Stale · as of Stale cache"* (double-read), and
  the chip was too wide for a table cell. Fix: the holdings response now carries a
  real **`price_ts`** (as-of ISO, null when unpriced — never fabricated); the chip
  reads compact **"Stale · 08 Jul"** with the full date in the tooltip, and just
  **"Stale"** when there is no real timestamp (no "as of <label>"). `white-space:
  nowrap`, no horizontal scroll.
- **§9-33 — Table height (item 3).** `DataTable` (`.lf-table-wrap`) now **caps at
  `--table-max-h` (`60vh`) and scrolls internally** (sticky header stays), so
  neither table grows the page unboundedly. Recorded as the default in
  `TEMPLATE-page-build.md` §4.
- **§9-34 — Picker tile order (item 4).** **"Other"** moved to the **last** tile,
  after Insurance — the escape valve reads sensibly at the end.

### Confirmation-pass findings #9 (2026-07-10, owner) — verified with real flows

- **§9-35 — Import "Imported 0" bug (confirmed, then diagnosed with a REAL browser
  + real-API flow, not just unit tests).** *Not a payload bug:* the reconstructed
  commit CSV contains **exactly the included rows** (new rows import fine;
  proven by a frontend payload-guard test that reads the committed File). Root
  cause: the committed rows were **duplicates** already in the ledger, which
  `commit_import` skips (`skip_duplicates`) → `{imported: 0, skipped_duplicates: N}`
  with success styling. Fix: the `Toast` gains a **`tone`**; a commit that imports
  zero now shows a **warning** — *"No rows were committed — all N … were already in
  your ledger (duplicates)"* (or "no new valid rows") — and the "recently added"
  jump only happens when rows actually landed. A success import now also notes any
  duplicates skipped. **Verified in Chromium:** the warning toast renders with the
  amber accent (screenshot).
- **§9-36 — Holdings table fits 1366px (verified by rendering, not tests).**
  Screenshots at 1366 & 1920 in both themes showed the old table at
  `scrollWidth 1184 > clientWidth 1110` → horizontal scroll, ⋯ column clipped. The
  page content caps at ~1110px regardless of viewport, so the fix is to narrow the
  table: **the Price column is dropped** (it is "—" for every manual holding, and
  Value is the decision figure; price lives in the row's Details). Now
  `scrollWidth == clientWidth`, **`overflowX: false`** at both widths/themes, ⋯
  fully visible. The StalenessChip renders compact ("⚠ Stale · 10 Jul").
- **§9-37 — D-096 generated import template (DONE).** The Import dialog gains a
  **"Download template"** action → `GET /portfolio/import/template`, now generated
  from the **D-090 matrix** (one row per asset_class × permitted txn_type, valid
  vocab, real dates/symbols, exact import schema) — can't drift, and is itself
  importable. Verified in Chromium: the button downloads
  `ledgerframe-import-template.csv`.

### Final findings #10 (2026-07-10, owner) — picker + popover, verified live

- **§9-38 — D-097 class-aware instrument picker (DONE, verified live).** The picker
  was mock-backed and class-blind ("Mutual fund offered equities and BTC"). Now it
  takes the Add-flow `assetClass` and is wired to a new backend
  `GET /instruments/search?q=&asset_class=` returning **`existing`** (this class,
  selectable), **`other_class`** (a match under a different class → *"Found in
  {class}: SYM →"* navigate link, **never** selectable), and **`suggestions`**
  (provider search routed to the class's provider — AMFI / CoinGecko / market,
  never a mix). **Verified in Chromium:** a mutual-fund add with query "AAP" shows
  AAPL only as *"Found in equity: AAPL →"*, plus Create — no equity/crypto results.
- **§9-39 — Universal popover overlay rule (DONE, verified live).** `.lf-dialog__body`
  is `overflow-y:auto`, so an in-flow/absolute dropdown expanded the dialog / added
  dialog scroll. The InstrumentPicker menu now **portals to `document.body`**
  (`position:fixed` anchored to the field, `max-height: min(18rem,40vh)`, internal
  scroll) — it overlays within the viewport. Native `select`/`date` controls already
  overlay. **Verified in Chromium:** `portaledOutsideDialog: true`,
  `dialogScroll: false` with the picker open inside the Add dialog. Recorded as a
  **universal component rule** (DESIGN-SYSTEM §6) + an open-inside-dialog case at
  `/kitchen-sink`.

**Sign-off:** all §9 items resolved (2026-07-10). Build proceeds per §8; the
Phase 0a component amendment pauses at `/kitchen-sink` for the owner's
ratification look before Phase 1 assembly.

---

## DELTA NOTE — 2026-07-16 (page-insurance walk batch 2)

- **§14in-6 (page inset):** removed the page-local `.hold { max-width: 72rem; margin: 0 auto }` — the page
  now uses the ONE shell-owned inset (DESIGN-SYSTEM §3.1 "Page inset", RATIFIED). At wide viewports Holdings
  had centred ~244px in from each edge vs the full-width standard. Guarded by the cross-page inset test in
  `e2e/overflow.spec.ts` (at 1728). No functional change; pre-pass (overflow suite covers `/holdings`) green.
- **§14in-7 (base-currency affix):** the linked net-worth summary tile now shows the served `base_currency`
  as the muted `.lf-stat__unit` affix instead of embedding `SGD` inside the value string. Holdings.test.tsx (23) green.

---

## DELTA NOTE — 2026-07-16 (page-accounts Phase 1, Amendment G — account drill-down chip)

- **Amendment G (page-accounts §9-11):** the Accounts page's RowMenu **"View holdings"** now drills
  down here via **`#/holdings?account=<id>`**. Holdings reads the `account` URL query
  (`useSearchParams`) and, when set, fetches the **scoped reader** `GET /portfolio/holdings?account_id=`
  (`getHoldings(accountId)` — filter-not-recompute, the Phase-0 reader half) and renders a **visible,
  clearable filter chip** (`.hold__chip`, account name from the `accounts` list) beside the Holdings
  heading; clearing it drops the param and reloads unscoped. No money math added — the chip only scopes
  the canonical reader's output. Tokens-only CSS (drift green).
- **Guards / pre-pass re-run:** `Holdings.test.tsx` + the frontend unit suite GREEN; typecheck/lint/
  build green. `/holdings` stays in all three `e2e/overflow.spec.ts` arrays. The **`holdings-smoke`**
  live re-run (param → chip → clear round-trip, plus RowMenu navigation from `/accounts`) rides the
  page-accounts Phase-3a pre-pass on the reset demo-seeded instance. Served shape unchanged.

### ADDENDUM — 2026-07-16 (page-accounts WALK BATCH 1, §14ac-2/§14ac-3)

- **§14ac-2 — the JOURNEY was broken; fixed.** The drill-down navigated via a manual
  `window.location.hash` write, so Holdings mounted with `accountFilter=null` on render 1 and fired an
  **unfiltered** `getHoldings()` that raced the scoped one (owner saw unfiltered). Now both entry points
  navigate through **react-router via the shared builder** `nav/holdingsLink.ts` `holdingsForAccount(id)`
  → Holdings mounts scoped on render 1 (only scoped fetches, no race). **A second entry point** landed:
  the account **Name cell is a link** to the same URL (§14ac-5). Guarded by JOURNEY tests
  (`e2e/smoke/accounts-journey-smoke.spec.ts`): clicking the real RowMenu item AND the Name link both
  assert scoped arrival; **RED pre-fix** (`holdings reqs = ALL,ALL,SCOPED,SCOPED` — the unfiltered fetch)
  → **GREEN** (`SCOPED,SCOPED`).
- **§14ac-3 — the chip now scopes the transactions table too.** `getTransactions` gains `accountId`
  (→ `GET /portfolio/transactions?account_id=`, backend delta, contract regen); `reloadTxns` passes
  `accountFilter`, and changing the scope resets the ledger to page 1. The ONE chip scopes **both**
  tables; clearing unscopes both (journey guard asserts `txns` requests go `SCOPED` on arrival, `ALL` on
  clear). Backend fail-first: the ignored param today → scoped total == full total → RED → GREEN.
- **Re-verify:** `Holdings.test.tsx` (24) + `Accounts.test.tsx` (10) green; the journey smoke green; the
  `portfolio-smoke` (shared reader) re-run green. Served holdings/transactions shapes unchanged (a new
  optional query param only).

## DELTA NOTE — 2026-07-18 (R-38 data-feed-routing Phase 3b re-walk batch 3, §14dr-10)

- **Stray internal copy removed from the Transactions purge button.** The label read
  "Purge N deleted [PIN]" — the "[PIN]" was a leftover dev annotation reminding that the
  action is PIN-gated; it leaked into user-facing copy. **Verify-first:** the purge is
  *already* PIN-gated by the confirm dialog's `requirePin` prop (its honest home) with a
  clean "Purged." toast; the annotation added nothing but noise. Fix: the label is now
  "Purge N deleted". (The string lived only in `Holdings.tsx`; Instrument Detail renders no
  purge control — the owner reached it via the holdings navigation.)
- **Guard (mechanical, CI):** a new `scripts/check-internal-copy.mjs` (wired into
  `npm run check` as `check:copy`, mirroring the design-token drift check) fails if a
  bracketed dev marker ([PIN] and kin) appears in production route/component source outside
  comments — the KitchenSink playground + mockups are scoped out. Fail-first verified: RED
  with the marker present, GREEN after removal. Holdings pre-pass re-run stated in the report.

## DELTA NOTE — 2026-07-18 (R-38 data-feed-routing Phase 3b re-walk batch 3, §14dr-11)

- **Transaction edit can now change Account (parity with add).** **Verify-first:** the
  add flow had an Account `Select`; the edit dialog (`TxnEditDialog`) did **not**, and
  never sent `account_id` — so a transaction could never be re-scoped from the UI even
  though the `PUT` schema (`TransactionIn.account_id`) already carried it. Fix:
  - **Frontend:** `TxnEditDialog` gains the Account `Select` (served `/accounts`, prefilled
    from the transaction's `account_id`) and sends `account_id` on save.
  - **Backend (correctness, no contract change):** `PUT /portfolio/transactions/{id}`
    applied `account_id` only under a truthy guard (`if payload.account_id:`) — it couldn't
    re-scope reliably. It now applies the field whenever the client **sent** it
    (`model_fields_set`), resolving through the same **`_ensure_account`** the add flow uses
    (`transactions.account_id` is **NOT NULL**, so a null/absent selection maps to the
    default account — the add-flow bucket — never a constraint violation; omitted → unchanged).
  - **Re-scope arithmetic:** the account change flows through `rebuild_holdings_from_transactions`
    (groups by `(account_id, instrument_id)`), so **both** accounts' derived holdings recompute
    — the transaction leaves the source account's view and arrives in the destination's.
  - Fail-first: a frontend test (the edit dialog carries + prefills Account and sends a changed
    `account_id`, RED before — no field) and a backend integration test (a move A→B leaves A and
    arrives in B; an explicit-null clear leaves B via the default account — RED before against
    the truthy guard, which either ignored it or hit the NOT-NULL constraint). The account-scoped
    journey guards (Holdings account chip + Accounts) re-run in the report.

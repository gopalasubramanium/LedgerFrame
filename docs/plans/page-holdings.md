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

- **Phase 0a — Component amendment (DESIGN-SYSTEM §5). ✅ DONE — awaiting
  ratification look.** Built **Dialog/Drawer**, **FileInput**, **Toast/Snackbar**,
  and **ConfirmDialog + PIN** (PIN overlay reuses Dialog — §9-5), token-compliant
  (drift green; added a `--scrim` token). DESIGN-SYSTEM §5 amended (PROPOSED).
  All four in `/kitchen-sink` (new "§5 amendments" section) in their meaningful
  states; 6 dedicated tests (focus-trap/Esc/restore, PIN-gated confirm + numeric
  filter, file-choose, toast auto-dismiss + undo). Visually verified in headless
  Chromium (Dialog, PIN-confirm, FileInput, undo Toast). `npm run check` (29
  tests) + build green. **⏸ PAUSED for the owner's ratification look before
  Phase 1.**
- **Phase 0b — Contract deltas (§3b), backend-first.** `GET /refdata` (D-005),
  `GET /portfolio/holdings.csv` (D-050), the `TransactionIn` **reshape** for the
  merger target (D-019), and **explicit response schemas** for
  `portfolio/holdings`, `portfolio/summary`, and `import/preview` (replace
  `additionalProperties: true`, §9-6). Each regenerates `API-CONTRACT.json` +
  `docs/openapi.json` in the same commit; drift check green. *(Where `/refdata`
  or `holdings.csv` ship via their own plans, Holdings is sequenced after them.)*
- **Phase 1 — Page assembly.** Compose the ratified + newly-ratified components:
  holdings table + summary header; transactions ledger; one Add flow; import
  preview→commit + review queue; tags editor; soft-delete + undo + purge; export.
  Honest empty/error/stale states throughout.
- **Phase 2 — Tests + verification.** Render/behaviour tests per §7; drift +
  typecheck + lint + unit tests green; visual check in both themes and both
  densities (headless Chromium).

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

**Sign-off:** all §9 items resolved (2026-07-10). Build proceeds per §8; the
Phase 0a component amendment pauses at `/kitchen-sink` for the owner's
ratification look before Phase 1 assembly.

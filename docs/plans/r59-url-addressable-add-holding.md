# R-59 — URL-addressable add-holding form (phase 1)

**Instantiated from `docs/plans/TEMPLATE-page-build.md` as a DELTA-SCALE milestone.** Charter:
`ROADMAP.md` R-59 (authoritative; carries the owner's verbatim ruling, the phase-1/post-release
fence, and the F-G Rider-A `asset_class` charter input). Cross-refs: `r54-deterministic-answers.md`
§0-F (dead-affordance survey) + §9-D (the link registry + bidirectional resolution guard);
`page-holdings.md` (the accepted surface this delta amends); `pre-release-walk.md` 9e R11/R12/R13.

**Scope (phase 1 ONLY):** the **add-holding dialog** becomes URL-addressable on `/holdings`; the
R-54 link registry gains the form ID (tier-1(b) flips from `page:/holdings` to the form deep link);
the form classifies the instrument and passes `asset_class` on submit. **The general entity-dialog
pattern** (import/purge/tags/edit-txn, `Holdings.tsx:108-111`) stays **POST-RELEASE** in the ROADMAP
row (fence §3 of the session charter). This is a **closed-page delta** → the
**guard-REDs-an-accepted-surface rite** applies (dated delta note in `page-holdings.md` + that
page's pre-pass re-run, same delta).

---

## §0 — INTAKE (grounded at plan time; every row enters the §-ledger, TEMPLATE §-ledger rule)

Three work items flow into R-59 from the charter. Each was **verified against the code before
planning** (verify-don't-assume, the R-63/R12 lesson), and the verification materially reshaped
item **I-3**.

### I-1 — The add-holding dialog is a `useState` modal with no URL address (§0-F dead affordance 1)

**Verified.** `Holdings.tsx:107` `const [addOpen, setAddOpen] = useState(false)`; rendered at
`:527` (`{addOpen && <AddDialog … />}`). The page already reads **one** URL param today —
`?account=<id>` (`:120-122`, the Amendment-G account-scope chip) — through `useSearchParams`, and
clears it with the react-router **functional updater** that preserves siblings
(`clearAccountFilter`, `:123-132`, `{replace:true}`). So the plumbing pattern R-59 must follow
already exists on this exact page. **`?add=` does not exist**; the dialog cannot be linked, opened
cold from a URL, or round-tripped. → **the substantive phase-1 work.**

### I-2 — The R-54 link registry cannot name the form until the route ships (§9-D ordering)

**Verified.** Tier-1(b) *"how do I add a holding"* currently serves **`page:/holdings`** — proven
live by two guards this delta must flip:
- `tests/integration/test_served_link_ids.py::test_a_page_help_fact_points_at_the_page_not_back_at_itself`
  (asserts `Help · Holdings` → `page:/holdings`).
- `…::test_a_deep_link_target_still_obeys_the_acceptance_gate` (asserts `"page:/holdings" in links`).

The composition is mechanical: `_help_link_id("page-holdings", q)` (`app/ai/tools.py:436-449`) →
`_page_help_route` → `/holdings` → `page:/holdings`. The frontend resolver `resolveAskLink`
(`askLinks.ts:49-69`) already **accepts `page:/holdings?<query>`** — it validates only the PATH and
preserves the query verbatim (the delta-4b Settings-tab precedent, `?tab=appearance`). So a
`page:/holdings?add=1` link **resolves today** — which is exactly why the ordering must be enforced
by a guard that the param is *honored*, not merely that the path exists (see I-2a). → **registry
flip after the route ships.**

### I-3 — "The form classifies the instrument and passes `asset_class`" — ALREADY DONE (premise correction)

**⚠ VERIFY-DON'T-ASSUME PREMISE CORRECTION (R-63/R12 lesson; R12's own precedent).** The charter's
§2.2 premise — *"today `POST /portfolio/transactions` receives no class, so a crypto is born
equity … the missing piece is the form"* — is **stale**. Grounded proof:

1. **The form already sends the class.** `Holdings.tsx:880` — a listed add sends
   `asset_class: tile?.assetClass`. The D-089 type-first tile picker (`ASSET_TILES`, `:759-773`)
   maps **Crypto → `assetClass:"crypto"`**, Mutual fund → `mutual_fund`, etc. The tile is
   **mandatory** (`tile === null` renders the picker, not the form — `:929-930`), so a listed add
   **never omits** the class. The manual branch likewise always sends `asset_class` (`:911`); the
   manual cash-flow txn path is instrument-less (`symbol: null`, `:894`) so it creates no instrument.
2. **The backend classifies correctly when the class is present.** `identity.py:97-104` (R12) +
   `csv_import.py:466-469` (§14dr-27b): a crypto resolves to **`crypto/crypto/country-null`**
   (rendered "—"). The `equity`/`US` leak at `identity.py:91`/`:46` fires **only when `asset_class`
   is OMITTED** — which the form never does.
3. **Both sides are ALREADY PINNED, with runnable proof (ran 2026-07-24, 4/4 green):**
   - Backend: `test_fg_crypto_identity.py::test_adding_a_crypto_holding_reads_crypto_crypto_and_no_country`
     — the form's *exact* payload (`asset_class:"crypto"`) → crypto/crypto/—.
   - Frontend: `Holdings.test.tsx:217-231` — clicking the **Crypto tile** sends
     `asset_class:"crypto"` to `addTransaction`.
4. **R12 explicitly deferred only the `identity.py:91` OMISSION-default to R-59** (9e R12,
   line 227-228): *"The class/subclass=`equity` leak at `identity.py:91/:46` fires only when
   `asset_class` is OMITTED — the form (R-59), out of scope here."* The **form** is not a caller
   that omits; the question R-59 inherits is the narrower backend one (see the disposition fork).

**Consequence.** The "classification mechanism" the charter asks me to propose
(selector vs symbol-derived vs hybrid) **already exists**: the D-089 **type-first tile selector**,
already classifying and already passing `asset_class`, pinned end-to-end. R-59 adds **no new
mechanism**. The genuine asset_class-adjacent phase-1 contribution is a **deep-link-preserves-
classification guard** — the new `?add=` entry must land on the tile picker (step 1) so a deep-linked
add cannot bypass classification. → **verify + pin + deep-link guard; NOT a new mechanism.**

**The disposition fork (RULED 2026-07-24 — owner+architect chose Option (a); recorded for history):**
- **(a) RECOMMENDED — accept "already classified".** Treat I-3 as verified-and-pinned; R-59's only
  new asset_class work is the deep-link-preserves-classification guard. **Do NOT touch the
  `identity.py:91` EQUITY default** — a bare ticker with no class *should* resolve to a US equity
  (the common, correct case); the non-equity omission leak is already handled at the CoinGecko map
  path + the audited boot repair (R12), and no product caller omits the class for a non-equity.
- **(b) also harden the backend omission-default** (R12-deferred): change `identity.py:91` so an
  omitting caller cannot silently get equity/US. **Not recommended** — it would break legitimate
  bare-ticker equity classification, and there is no product caller that both omits the class and
  expects non-equity. If wanted, it is its own RED-first delta with a blindness pin.

---

## §-LEDGER (intake enters at plan time; a ledger may not claim CLOSED with an undispositioned row)

| # | Origin | Item | Status |
|---|--------|------|--------|
| **I-1** | §0 intake / charter §2.1 | Add-holding dialog becomes URL-addressable (`?add=` on `/holdings`; round-trip, back-button, no residue, composes with `?account=`) | **OPEN** — the substantive phase-1 build |
| **I-2** | §0 intake / charter §2.3 | Link registry flip: tier-1(b) `page:/holdings` → the form deep link, after the route ships | **OPEN** — after I-1 |
| **I-2a** | derived from I-2 | New guard: the served `?add=` param is HONORED by the route (not a silent no-op — dead-affordance-3 class), making the R-54→R-59 ordering mechanical | **OPEN** — ships with I-2 |
| **I-3** | §0 intake / charter §2.2 (F-G Rider A / R12) | Form classifies + passes `asset_class` | **DISPOSED — Option (a), owner+architect ruled 2026-07-24.** Already-implemented-and-pinned (`Holdings.tsx:880`, `identity.py:97-104`; `test_fg_crypto_identity.py` + `Holdings.test.tsx:217` green). Residual = the **I-3 deep-link-lands-on-picker guard** (below). `identity.py:91` omission-default hardening (Option 2) **NOT taken** — remains available as its own ruled delta if ever wanted. Premise correction recorded as a dated note on the ROADMAP R-59 charter input (I-5 never-age-it-silently precedent). |

---

## §1 — PROPOSED SPEC (param / form ID / addressability semantics — PROPOSED, for the owner's look)

*All strings/shapes below are PROPOSED until the owner looks (camera-over-green; copy PROPOSED). They
land as a dated delta in `page-holdings.md` BEFORE code (spec-first), on the ruling.*

### 1a — The URL param
- **Param:** `add` on `/holdings`. **Value:** `1` (presence-is-open; `?add=1`). A query-only param,
  no new route (the dialog is a modal over `/holdings`, matching the accepted worklist template).
- **Semantics:** `?add=1` present → the AddDialog opens at its **tile-picker step** ("What are you
  adding?"). Absent → closed. Classification is preserved **by construction** (the picker is step 1;
  I-3 deep-link guard).
- **Composition with `?account=`:** independent siblings. Opening Add while account-scoped keeps the
  chip; both params survive each other's open/close via the functional updater (§9-D sibling-param
  convention, the `clearAccountFilter` precedent, `Holdings.tsx:123-132`).
- **Open pushes history / close pops cleanly:** opening sets `add=1` with `{replace:false}` (a
  history entry) so **Back closes the dialog**; every close path (Cancel / Save / Esc / backdrop)
  **deletes `add`** via the sibling-preserving updater → **no param residue**, `?account=` intact.

### 1b — The served form ID (registry flip, I-2)
- **Served link:** `page:/holdings?add=1` for tier-1(b). Composition: a new `_holdings_add_intent(q)`
  refinement in `_help_link_id` (analogous to `_settings_tab_for`) appends `?add=1` when the route is
  `/holdings` AND the question reads like *add a holding* (word-boundary, ordered — the intent-rule
  discipline). A generic Holdings question keeps `page:/holdings`.
- **Label:** `askLinkLabel("page:/holdings?add=1")` → **"Add a holding"** (a W-4-style deep-link
  label, the SETTINGS_TAB_LABEL precedent) so the pointer line reads "→ Open Add a holding".
- **Guard flips:** the two `test_served_link_ids.py` assertions (page-fact pointer + acceptance-gate
  premise) update from `page:/holdings` to `page:/holdings?add=1`.

### 1c — The bidirectional ordering guard (I-2a)
- A guard in the `check`-suite shape (static parse, named owner, **blindness pin**) asserting the
  served `?add=` param is a param `Holdings.tsx` actually **reads** — mirroring
  `test_every_settings_tab_the_map_emits_is_a_real_tab` (which parses `Settings.tsx` TAB_IDS). This
  makes the R-54→R-59 ordering mechanical: the form ID cannot be registered while its param is a
  silent no-op. **Blindness-pinned** so it fails loudly if the parser stops finding the param read.

---

## §-RITES (closed-page; charter §2.4)

- **Holdings is closed** → dated delta note in `page-holdings.md` **+ that page's pre-pass re-run in
  the same delta** (both themes, isolated instance, on camera): the deep link opening the form cold,
  the `?add=` ↔ `?account=` round-trip, and a classified crypto add reading crypto/crypto/—.
- **Help delta** if tier-1(b)'s Help copy changes (§19-J findability) — assessed at build; the tier
  declaration/registry is navigation plumbing, so likely "no Help impact, guard-corroborated".

---

## §-STATUS

**⊕ 2026-07-24 — §0 INTAKE + DIAGNOSIS DONE (records-only, diagnose-only) → HARD STOP for the owner's
ruling on the I-3 disposition fork.** Verified at HEAD `0962dc6`: I-1 (dialog is a `useState` modal,
no `?add=`), I-2 (tier-1(b) serves `page:/holdings`, two guards pin it), and — the premise correction
— **I-3 is already implemented and pinned on both sides** (the form sends `asset_class` via the D-089
tile, `Holdings.tsx:880`; backend classifies crypto → crypto/crypto/—; `test_fg_crypto_identity.py`
+ `Holdings.test.tsx:217` green, 4/4). The charter's "missing piece is the form" premise does not
hold — the same finding R12 recorded for the sibling path. **No code changed this step.** On the
ruling: I-1 build (RED-first on the round-trip) → I-2/I-2a registry flip + ordering guard → verdicts
(SOLO pair, attributed) → closed-page pre-pass on camera → close.

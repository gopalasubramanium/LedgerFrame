# page-first-run-checklist.md — First-run checklist (D-045) build plan

**Status: Phase 0a RATIFIED · Phase 1 + Phase 2 DONE · Phase-3 live walk IN PROGRESS — batch 1
(§11-1) verified live + ratified; batch 2 (§11-2 F3, §11-3/F6) fixed + awaiting owner re-verify
(2026-07-11). Owner confirms close-out; do NOT self-close Phase 3.** §9 resolved (F-1..F-12);
three §5.5 components ratified; wired into `AppShell` after the lock gate. Pre-pass fixes (§12):
F1 portal z-index token, F2 links close overlay, F3/F4 three-state (0/5 fresh), F5/F9/F10
deterministic smoke tooling, F7 resume, **F8 6-digit PIN enforced API-side**, F11 test `.env`
isolation; **F6 provider-429 backoff = APPROVED + BUILT (Retry-After · cooldown · honest-stale FX;
provider-only, contract untouched).** Walk batch 2: **§11-2 F3 confirm-on-pick** (`CommitMenu`;
choosing the suggested value confirms + writes). Checks: **95 frontend tests + 32 Playwright
overflow + 487 backend** + contract current + drift/typecheck/lint/build green; fix-confirmation
smoke passed (0 console errors, fresh 0/5, F3 same-value confirm). Derived from PRODUCT-SPEC §7,
D-045, SECURITY-BASELINE §3, D-069, chrome C-4.

**This is a gate/overlay, not a content page — it adapts the template** (per the
`TEMPLATE-page-build.md` shell-adaptation note). Like the chrome, it deviates from the
page shape: **no route, no nav entry, no H1-owned figures.** It is a first-run **overlay
in the app shell** that runs five skippable settings steps. §1/§2 describe UI-state
ownership + settings mutation, not figure ownership; acceptance is behavioural
(skippable, links out, honest), not a single-page happy path.

---

## 1. IDENTITY (adapted — overlay, not a page)

| Field | Value | Spec ref |
|-------|-------|----------|
| Name | First-run checklist | PRODUCT-SPEC §7, D-045 |
| Route | **none** — an overlay mounted in the app shell (the chrome's reserved first-run gate slot) | page-chrome C-4; IA "Global chrome (D-045)" |
| Nav group | **n/a** — never in the sidebar (it is a one-time setup overlay) | D-043 (not a nav page) |
| Page template | **n/a** — a **gate/overlay** in the shell, like the LockScreen; the four page templates render *behind* it | DESIGN-SYSTEM §5.5; page-chrome §12 (shell-adaptation) |
| Rotation eligibility | **n/a** — not a rotatable page (D-044) | IA §3 |
| One-line purpose | A minimal, **skippable** first-run checklist run against **real settings** (no personas, no profiling): base currency · timezone · PIN · data provider · no-egress | PRODUCT-SPEC §7, D-045 |

**Replaces PersonaOnboarding, which is KILLED (D-045).** No personas, no profiling —
each step is a real setting, skippable, and links to its Settings home.

---

## 2. OWNERSHIP TABLE (adapted — UI state + settings mutation, no figures)

**Owns (UI state only):** the checklist's own **step state** (which of the five steps
are done / skipped / outstanding) and the one-time **first-run dismissal/completion**
state. **Owns no figures.**

**Writes (mutates settings via the canonical settings/auth endpoints — never a second
code path):** it does not *summarise* readers; it **sets** real configuration through
the same endpoints the (future) Settings page uses. Each step's canonical home is
**Settings**, and D-045 requires each step to **link to its Settings home**.

| Step (D-045 order) | Canonical Settings home | Real setting it writes | Endpoint (frozen contract) |
|--------------------|-------------------------|------------------------|----------------------------|
| 1. Base currency | Settings · General | `base_currency` | **`PUT /settings`** — canonical (F-10, verified: it also applies to `.env` + reloads + resets FX + restarts the worker); `/system/data-source.base_currency` stays a provider-bundle convenience |
| 2. Timezone | Settings · General | device `timezone` (D-013) | **`PUT /settings`** after the **F-3 delta** (timezone added to the write surface) |
| 3. PIN | Settings · Security | first PIN (access lock, D-002) | `POST /auth/set-pin` (first PIN from loopback, no auth) |
| 4. Data provider | Settings · Prices | `market_provider` (+ optional API key) | `PUT /system/data-source` |
| 5. No-egress toggle | Settings · Privacy | `privacy_mode` (D-069/D-075) | `PUT /settings` |

**Density is NOT a step** — it is a plain Settings → Appearance option (D-045),
explicitly excluded from the checklist.

**Enforcement corollary (P-1):** the checklist shows **no figures** — it only writes
settings and links to Settings. Nothing here duplicates a canonical page's numbers.

---

## 3. API SURFACE

### 3a. Consumed (already in the frozen contract)

| Method + path | Purpose in the checklist | Shape pinned? |
|---------------|--------------------------|---------------|
| `GET /settings` | read current `base_currency`, `timezone` (default), `demo_mode`, stored `privacy_mode` to show step state | `{stored, defaults}` (typed loosely) |
| `PUT /settings` | write `base_currency`, `privacy_mode` (no-egress) | `{values}` allow-listed keys |
| `POST /auth/set-pin` | set the first PIN (loopback; `PinPayload{pin}`, 4–32 chars — policy min 6, SECURITY-BASELINE §3) | pinned |
| `GET /auth/state` | know whether a PIN is already set (step-3 done-state) | `{pin_set}` |
| `GET /system/data-source` | read the **served provider list** (`providers`) + current provider (frontend zero-copy, D-005) | `{providers, ...}` |
| `PUT /system/data-source` | write `market_provider` (+ optional `api_key`, never returned) | `DataSourceIn` |

### 3b. Contract deltas — **DONE (Phase 0)**

| kind | Endpoint | Decision | Shipped |
|------|----------|----------|---------|
| reshape | **timezone settable** via `PUT /settings` | D-013 / D-045 step 2 / **F-3/F-4** | ✅ `timezone` added to the settings allow-list; **backend-validated against `zoneinfo.available_timezones()`** (invalid → honest 400, never a silent default); applied to `.env` + `reload_settings()` so `GET /settings.defaults.timezone` reflects it. |
| add | **first-run flag** via `PUT /settings` | D-045 / **F-5** | ✅ `first_run_complete` added to the allow-list — a **server-persisted settings key** (survives a browser wipe), set on complete OR dismiss; read from `GET /settings.stored`. |

**Contract note:** both deltas go through the **existing `PUT /settings` allow-list** — no
new endpoint and **no OpenAPI shape change** (the shape is `{values: dict}`), so
`API-CONTRACT.json`/`openapi.json` are **unchanged** (drift check run + current). Base
currency needs **no** delta — `PUT /settings` is canonical (§2/F-10). Provider API keys
stay in Settings (F-8), not first-run. **Tests:** `tests/integration/test_first_run_settings.py`.

---

## 4. COMPONENTS

*Only ratified `src/components/ui/` components may be composed. A needed affordance
the inventory lacks is a DESIGN-SYSTEM amendment (also listed in §9).*

| Ratified component | Role in the checklist | Data source (real / mock) | Notes |
|--------------------|-----------------------|---------------------------|-------|
| **LockScreen pattern** (reference, §5.5) | the closest existing full-shell gate/overlay — the checklist overlay may reuse its scrim/centering approach | — | reuse the *pattern*, not the component (it is a PIN gate) |
| **MoneyInput / MasterSelect** | base-currency choice (currency master, D-005) | `GET /refdata` (currency master) or `/system/data-source.providers` | currency is a MASTER-DATA vocab (§5) |
| **Select** | timezone choice; provider choice (served lists, not MASTER-DATA masters) | `/system/data-source.providers`; timezone source **§9** | see §5 |
| **LockScreen PIN input pattern / ConfirmDialog PIN** | the PIN step's masked numeric entry (min 6) | `POST /auth/set-pin` | reuse the masked-PIN pattern (no new input primitive) |
| **Toggle/`.lf-iconbtn` or a Settings-style switch** | the no-egress toggle | `PUT /settings{privacy_mode}` | **§9**: is there a ratified toggle/switch, or is it a §5.5 amendment? |
| **PageHeader / EmptyState / Toast** | overlay heading, per-step "skipped/reason" honesty, save confirmation | — | ratified |

**Affordances the ratified inventory LACKS (amendment — APPROVED, ratify at kitchen sink):**
- **A checklist / stepper overlay (+ the no-egress toggle/switch + a searchable picker).**
  No ratified checklist/stepper/first-run-overlay, no settings toggle, and **no searchable
  picker** (InstrumentPicker is instrument-bound) exist → **APPROVED (F-6):** author all
  as **PROPOSED, DESIGN-SYSTEM §5.5 amendment**, ratified at `/kitchen-sink` in **Phase 0a
  before assembly**. Dismissible card form (F-1). The **searchable picker** (F-4) backs the
  timezone step's ~400 `Intl.supportedValuesOf('timeZone')` options — **no silent new
  primitive**; it is part of this amendment.
- **The shell first-run slot — mounts AFTER the lock gate (F-7).** `AppShell` mounts only
  the LockScreen today; this milestone **adds the first-run overlay to `AppShell` after
  the lock gate** — unlock precedes onboarding (restored-DB-with-PIN: lock first, then the
  checklist). No leak behind either.

**Step-specific rules (resolved):**
- **Provider step = selection only (F-8/D-069).** It writes `market_provider` inline and
  **links out** for the API key — it **never renders a key field** (secrets stay in
  Settings).
- **Honest interplay copy (F-9, all PROPOSED — ratify at kitchen sink):** the no-egress
  step states **prices won't refresh**; the provider step **notes when no-egress is
  already enabled**. No decision IDs in the copy (copy hygiene).

**Component usage rules the build must honour (from the template + chrome):**
- **Every input is a ratified `ui/` component** — no raw `<input>`/`<select>` (DESIGN-SYSTEM §6).
- **Copy hygiene (template governing rule):** no decision IDs / implementation notes in
  any user-facing string; every shown term matches GLOSSARY (e.g. "No egress").
- **Overflow:** the overlay must show **zero horizontal overflow at 320/375/900/1366px**
  — extend the Playwright suite (ADR-0004), jsdom cannot measure it.

---

## 5. VOCABULARIES

| Field in the checklist | Vocabulary / master | Fixed / extensible | Source |
|------------------------|---------------------|--------------------|--------|
| Base currency | currency master | fixed (base-eligible subset) | MASTER-DATA §3 via `/refdata` — **MasterSelect** |
| Data provider | market-provider list `{mock, csv, alphavantage, yahoo, eodhd, kite}` | **served system list, NOT a MASTER-DATA master** | `GET /system/data-source.providers` (frontend zero-copy, D-005) — a `Select` over a served list |
| Timezone | IANA timezone id | **NOT a LedgerFrame vocabulary** (IANA is a public standard — no `/refdata`) | **`Intl.supportedValuesOf('timeZone')` client-side** (F-4); backend-validated on write (F-3 delta, `zoneinfo` truth). Uses the **PROPOSED searchable picker** (Phase-0a amendment), not `MasterSelect`/`Select`. |
| No-egress | boolean toggle | n/a | `privacy_mode` |

**Provider choice is user/system config, not a MASTER-DATA categorical** → it uses a
`Select` over the served `providers` list, not a `MasterSelect`. **Timezone has no
vocabulary source pinned** — §9.

---

## 6. DECISIONS IN FORCE

| Decision | What it forbids / requires here |
|----------|----------------------------------|
| **D-045** | The five steps + order; each **skippable**; each **links to its Settings home**; no personas/profiling; density is **not** a step. |
| **D-002** | PIN is an **access lock**, not encryption; min 6 digits (SECURITY-BASELINE §3). The PIN step must surface the **disk-encryption guidance** (SECURITY-BASELINE §3 makes this normative for first-run) and honour the **first-PIN-from-loopback guard** (a LAN-reachable instance can only set its first PIN from the device). |
| **D-103** | Unrelated but adjacent: unlocking never authorises purge — not a checklist concern, noted so the PIN step copy makes no such promise. |
| **D-069** | No-egress step: the Privacy posture is an **explicit first-run choice**; when enabled the state is **shown as a plain statement**, not merely offered. |
| **D-075 / D-060** | If no-egress is enabled at first run, the device makes **zero outbound calls** — the provider step (and any version check) must respect it. |
| **D-004** | No-PIN-open-local: with no PIN set, first-run writes are permitted from loopback; the checklist must not itself demand auth it cannot yet have. |
| **D-066** | The overlay is **chrome, composed once** in the shell — never re-implemented per page. |
| **D-065 / P-7** | Scope principle: keep the checklist **minimal** — exactly the five steps, nothing added. |
| **D-005** | The provider list (and any vocab) is **backend-served, frontend zero-copy** — no hardcoded lists. |

---

## 7. ACCEPTANCE CRITERIA (adapted — overlay behaviour, not a page)

- [ ] **Five steps, D-045 order:** base currency · timezone · PIN · data provider · no-egress. **Density is not a step.**
- [ ] **Every step is skippable** — skipping is honest (the step shows as skipped, not failed) and never blocks reaching the app.
- [ ] **Each step links to its Settings home** (General/Security/Prices/Privacy) — behaviour when Settings is **not yet built** is per §9 (links vs inline set).
- [ ] **PIN step:** masked numeric, **min 6 digits**; surfaces **disk-encryption guidance**; handles the **first-PIN-from-loopback** case honestly (if reachable over LAN and not on the device, it explains the PIN must be set from the device — never a silent failure).
- [ ] **No-egress step:** enabling it shows the **plain-statement** privacy state (D-069); with it on, the checklist itself makes **zero outbound calls** (extend the C-3 network-trace test).
- [ ] **First-run detection + dismissal:** the overlay appears only when first-run state says so and does **not reappear** once completed/dismissed (mechanism per §3b/§9).
- [ ] **Honesty (Guarantee 3):** every empty/unset field and every skipped step shows a **reason**, never a fabricated default presented as chosen.
- [ ] **Terms** match GLOSSARY; **copy hygiene** — no decision IDs / impl notes in any user string.
- [ ] **No frontend money math**; base currency is a served master value.
- [ ] **Base-currency side effects (F-10):** a Phase-2 test asserts `PUT /settings` with `base_currency` applies to `.env`, resets the FX cache, and restarts the worker (its response reports `restarted_worker`).
- [ ] **Both themes + both densities**; interactive OPEN states (Select/PIN) verified in both themes.
- [ ] **Rendered layout + overflow:** the overlay is verified **rendering at 320/375/900/1366px in both themes** with **zero horizontal overflow**, via the **Playwright suite (ADR-0004)** extended to the first-run overlay — not unit tests alone.
- [ ] **Composes with the lock gate:** the interaction order of first-run overlay ↔ LockScreen is correct (per §9) and neither leaks behind the other.

---

## 8. BUILD PHASES

*One commit per phase. Backend deltas FIRST. Nothing built until §9 clears.*

- **Phase 0 — Contract deltas (§3b): ✅ DONE.** `timezone` + `first_run_complete` settable via `PUT /settings` (timezone backend-validated); no OpenAPI change (allow-list), contract current; `test_first_run_settings.py` green.
- **Phase 0a — §5.5 component amendment: ✅ BUILT (PROPOSED), AWAITING RATIFICATION.** Authored `Switch`, `Combobox` (searchable, portaled per §6), and `FirstRunChecklist` (dismissible 5-step overlay with inline controls + Settings links + F-9 interplay copy + PIN disk-encryption note); `--radius-pill` token; DESIGN-SYSTEM §5.5 amendment table; `/kitchen-sink` specimens; `firstrun.test.tsx` (5). **PAUSE for owner ratification before Phase 1.**

---

## 10. PHASE 0a — BUILT, AWAITING RATIFICATION (2026-07-11)

Three PROPOSED §5.5 components in `frontend/src/components/ui/`, staged at `/kitchen-sink`
under **"First-run checklist (D-045) — PROPOSED"**. No shell wiring, no backend change
beyond Phase 0. **Ratify at `/kitchen-sink` (both themes · both densities · a narrow width),
then tell me to start Phase 1:**

- [ ] **Switch** — the no-egress toggle reads clearly on/off; keyboard-focusable.
- [ ] **Combobox** — searchable timezone picker; type filters ~400 zones; menu overlays (portaled), scrolls internally; selection sticks.
- [ ] **FirstRunChecklist** — dismissible 5-step card; each step's inline control + Skip + "more options" link; PIN gated at 6 digits + disk-encryption note; F-9 interplay copy (no-egress → prices won't refresh; provider note when no-egress on); Done/dismiss closes it.

**Checks:** 88 frontend tests (5 new) · 24 Playwright overflow · drift/typecheck/lint/build green.

**On ratify → Phase 1:** mount `FirstRunChecklist` in `AppShell` **after the lock gate** (F-7);
wire the five steps to `PUT /settings` (currency/timezone/no-egress/first_run_complete),
`POST /auth/set-pin`, `PUT /system/data-source` (provider); first-run trigger reads
`first_run_complete`; dismiss/skip-all set it (F-1/F-11); provider links out for keys (F-8).
- **Phase 1 — Overlay assembly: ✅ DONE.** `FirstRunChecklist` mounts in `AppShell` **after the lock gate** (`!locked && !firstRunComplete`, F-7). `fetchFirstRunState` reads the flag + current values + served provider list in one call. Handlers write the canonical endpoints: base currency / timezone / no-egress (`privacy_mode`) / `first_run_complete` → `PUT /settings`; PIN → `POST /auth/set-pin`; provider → `PUT /system/data-source` (selection-only; keys link to Settings, F-8). Dismiss / "Done — skip the rest" set `first_run_complete` (F-1/F-11). `api/system.setPin`, `api/chrome.{fetchFirstRunState,updateSetting,setDataProvider}`.
- **Phase 2 — Tests: ✅ DONE.** Frontend: `AppShell.test` first-run shows-when-incomplete + **hidden behind the lock gate (F-7)**; `firstrun.test` (5) for the components; **Playwright overflow extended** to the overlay (320/375/900/1366 × both themes, 8 checks). Backend: `test_first_run_settings.py` (4) incl. the **F-10 base-currency side-effects** assertion (`.env` applied + `restarted_worker` reported). **90 frontend + 32 Playwright + 4 backend green.**
- **Phase 3 — Owner acceptance walk (LIVE, owner-driven — NOT self-certified):** drive the real app on a **genuinely fresh instance** (reset one-liner below): overlay appears after unlock, each step sets/skips + writes, links behave, PIN + no-egress work, it does not reappear after completion. Each finding → numbered §-entry, re-verified live.

---

## 9. NEEDS DECISION — RESOLVED (owner, 2026-07-11)

All resolved by the owner except **F-4** (not addressed — see below) and **F-12**
(owner-added; recorded per the owner's stated rationale, confirm at sign-off).

| # | Item | Resolution (owner, 2026-07-11) |
|---|------|--------------------------------|
| F-1 | Overlay form + trigger | **Dismissible overlay/card, NOT a blocking gate** (D-045 skippability governs). Shown on first load when the first-run flag is unset; **dismiss = flag set, no re-nag.** |
| F-2 | Dependency on the unbuilt Settings page | **INLINE-minimal controls per step**, writing the real settings endpoints; each step **ALSO links to its Settings home** as the "more options" path. The link hits the `NotBuilt` fallback until Settings ships — **acceptable, honest.** |
| F-3 | Timezone not settable | **APPROVED — §3b delta:** timezone becomes settable **via the settings write surface**. Backend-first, contract regenerated same commit. |
| F-4 | Timezone option-list source | **RESOLVED (sign-off):** options come from **`Intl.supportedValuesOf('timeZone')` client-side**; the write is **backend-validated per the F-3 delta** (server zoneinfo is the validation truth — a rejected value surfaces the honest 400, never a silent default). **No `/refdata` vocab** — IANA is a public standard, not a LedgerFrame vocabulary. ~400 options need a **searchable picker**; **the ratified inventory has none** (InstrumentPicker is instrument-bound) → **scoped into the Phase-0a component amendment** as a PROPOSED searchable picker (no silent new primitive). |
| F-5 | First-run state storage + resumability | **APPROVED — §3b delta:** first-run flag as a **server-persisted settings key** (D-078 rotation precedent; survives a browser wipe). **Set on complete OR dismiss.** |
| F-6 | Checklist/stepper component scope | **APPROVED:** author the checklist/stepper as **PROPOSED (DESIGN-SYSTEM §5.5 amendment)**, ratified at `/kitchen-sink` in **Phase 0a before assembly.** |
| F-7 | Shell mount + order vs LockScreen | **Mounts inside the shell AFTER the lock gate** — unlock precedes onboarding (the restored-DB-with-PIN case: lock first, then the checklist). |
| F-8 | Provider step + API keys | **Provider SELECTION only, inline.** API-key entry stays **Settings territory (D-069)** — the step **links out** for keys, **never renders a key field.** |
| F-9 | No-egress ↔ provider ordering | **Keep the D-045 step order.** **Honest interplay copy required (all PROPOSED):** the no-egress step states that **prices won't refresh**; the provider step **notes when no-egress is already enabled.** |
| F-10 | Base-currency write path | **CONFIRMED (sign-off): `PUT /settings` is canonical.** Its **side effects — `.env` write, FX-cache reset, worker restart — must be asserted by Phase-2 tests** (§7). `/system/data-source.base_currency` stays a provider-bundle convenience (both write the same engine-consumed value; no divergence). |
| F-11 | Skip-all / "do this later" | **Skip-all = completion:** flag set, **defaults stand, no nag**; everything settable later in Settings. |
| F-12 | *(owner addition)* demo-data offer as a first-run step | **CONFIRMED (sign-off): EXCLUDE** — D-045's five steps only (P-7 scope). No demo-data step. |

**F-10 verification (owner asked to verify + report before Phase 0):** `base_currency`
is accepted by **two** endpoints, but there is **no divergence** — `PUT /settings`
writes the DB Setting row **and** applies `LEDGERFRAME_BASE_CURRENCY` to `.env` +
`reload_settings()` + FX-cache reset + worker restart; `PUT /system/data-source` writes
the same `.env` value as a side-effect of a provider change. The valuation engine reads
`get_settings().base_currency` (the env value) — so both ultimately set what the engine
uses. **Recommended canonical = `PUT /settings`** (the fuller path the Settings page
will use); this is a report, not a resolution — owner confirms.

---

**Open before Phase 0 (2 items):** **F-4** (timezone option-list source — not addressed)
and confirmation of the **F-10** canonical pick + **F-12** exclude reading. Everything
else is resolved; §3b deltas (timezone-settable + server-persisted first-run flag) are
approved; the Phase-0a component amendment is scoped.

**Sign-off to start build:** F-1..F-3, F-5..F-11 resolved · **F-4 stated** · F-10/F-12
confirmed · §3b deltas approved with pinned shapes · Phase-0a component amendment scoped.
**No build until the owner signs off the resolved plan.**

---

## 11. PHASE-3 WALK FINDINGS (owner live walk, 2026-07-11)

The owner's live acceptance walk. Each finding is recorded here, fixed, then re-verified
by the owner before the walk continues.

**Batch 1 (owner, 2026-07-11) — recorded + fixed, awaiting owner re-verify.**

- **§11-1 — Overlay layout: pinned header/footer, only the steps scroll (FIXED, D-101 applied
  to the overlay).** The card was one flat scroll region (the whole `.lf-firstrun` scrolled),
  so the title/count and the Done control scrolled away with the steps. Restructured to a
  **capped flex column**: a **pinned header** (title + "N of 5 confirmed") and a **pinned
  footer** (Done / skip the rest), with a new **`.lf-firstrun__body`** as the *only* scrolling
  region between them. **Desktop:** the card is height-capped to the viewport
  (`max-height: calc(100dvh - 2·space-8)`) and the step rhythm tightened (compact) so **all
  five steps fit with no scroll**. **Below the 900px laptop breakpoint (D-102):** the card
  becomes a **full-height sheet** (`100dvh`, no radius/gutter) with header/footer pinned and
  the body scrolling. `FirstRunChecklist.tsx` (body wrapper), `firstrun.css`. **Four smoke
  screenshots re-captured** (320/375/900/1366, both themes) — no horizontal overflow; header
  and footer stay pinned; desktop shows no vertical scroll.

**Batch 1 — RATIFIED / verified live by owner (2026-07-11):**
- **§11-1 overlay layout** (pinned header/footer, no-scroll desktop, sheet at narrow) — verified live.
- **F3/F4 step copy** ("Confirm or skip each…") — ratified as seen live (was PROPOSED at §12; now ratified).

**Batch 2 (owner, 2026-07-11) — recorded + fixed, awaiting owner re-verify.**

- **§11-2 — Confirming the pre-filled suggestion was impossible (F3 semantics bug, FIXED).**
  The currency/timezone/provider steps only reached **confirmed** when the value *changed*:
  the two native-`<select>` steps (currency = MasterSelect, provider = Select) rode on the
  select's `change` event, and **a native `<select>` emits no `change` for a same-value pick**
  — so choosing SGD when SGD was suggested was a silent no-op. **Fix: confirmation now fires on
  the selection/commit event regardless of value equality.** Added a small internal
  **`CommitMenu`** (button + portaled listbox reusing the `.lf-combo__menu` styles) that fires
  `onCommit` on **every** pick, incl. re-selecting the current value; `Select` and `MasterSelect`
  gained an opt-in **`onCommit`** prop that switches to it (native path unchanged when absent, so
  no regression to Holdings/Instrument-Detail callers). The checklist's three dropdown steps use
  commit-on-pick (timezone's `Combobox` already did). **Choosing the suggested value writes it +
  confirms the step.** `CommitMenu.tsx`, `Select.tsx`, `MasterSelect.tsx`, `FirstRunChecklist.tsx`,
  `inputs.css` (`.lf-commit__trigger`). **Tests:** two component tests (currency + provider
  select-same-value → confirmed + write issued) + the live smoke's F3 same-value check.
  DESIGN-SYSTEM §5.5: `Select`/`MasterSelect` gain the `onCommit` (commit-on-pick) note.
- **§11-3 — F6 provider-429 backoff (APPROVED as scoped, BUILT).** See §12 F6 (now built): the
  three approved behaviours — respect **Retry-After**, provider-level **cooldown after K
  consecutive 429s**, **honest-stale FX on failure instead of mock-FX substitution** — landed in
  the Yahoo provider only (no worker-loop rework); contract untouched; backend tests for all three.

**Post-close finding (owner, 2026-07-11) — milestone stays CLOSED; fix is a follow-up.**

- **§11-4 — Data-provider dropdown renders EMPTY after unlock (FIXED; root cause = data path,
  NOT CommitMenu).**
  *Investigation → root cause (reported before fixing):* the provider list comes from
  `GET /system/data-source`, which is **lock-gated** (`require_read_auth`). Proven at the API:
  fresh/no-PIN serves all 6 providers, but **PIN-set + no session → 401 "Locked"** (as do
  `/settings` and `/refdata`; only `/auth/state` stays open). `fetchFirstRunState` runs **once at
  `AppShell` mount**; on a PIN-set instance that fetch happens **before** unlock (no session) →
  `providers: []`, and **`onUnlock` never re-fetched**, so the first-run overlay that appears
  after unlock (F-7 restored-DB-with-PIN path) showed an empty provider dropdown.
  *Blast radius = provider only:* provider options have **no client fallback**; currency survives
  (MasterSelect falls back to the static `/refdata` registry) and timezone is client-side IANA —
  which is exactly why only provider went empty. **CommitMenu is exonerated** (fresh serves the
  list; the smoke opened it and picked `csv`; it renders whatever options it is handed).
  *"Populated before batch 2"* = earlier walks were fresh/no-PIN (endpoint open); batch-2 walking
  set a PIN, exposing this **pre-existing auth-timing gap** — not a batch-2 code regression.
  *Fix:* `AppShell.onUnlock` now **re-reads `fetchFirstRunState` after a successful unlock**, so
  the overlay gets the authenticated provider list + values. `AppShell.tsx`.
  *Tests:* **AppShell regression test** (provider list empty while locked → populated after
  unlock — the precise guard); **CommitMenu component test** (open renders exactly the options it
  was given, non-zero for a populated field — proves it is not the cause); **smoke hardening** —
  every dropdown (currency/timezone/provider) now **opens and asserts option count > 0 before
  selecting**, so an empty listbox can never pass the pre-pass again.

## 12. PHASE-3 PRE-PASS FINDINGS (F1–F11) — triaged + fixed (owner, 2026-07-11)

Live Playwright smoke pre-pass (dev-only, `frontend/e2e/smoke/`) surfaced these; owner
triaged; all fixed except **F6** (investigate + propose only). A fix-confirmation smoke
re-run passed with **0 console errors**; fresh state shows **0/5** with three-state badges.

- **F1 — Combobox occluded by the overlay (FIXED).** The portaled menu (`z-index:50`) sat
  below the overlay (`55`) and Dialog (`100`), so the timezone dropdown was un-clickable
  inside the overlay. Fixed **at the portal layer** with a token: `--z-portal: 1100`,
  applied to `.lf-combo__menu` **and** `.lf-picker__menu` (InstrumentPicker) — portaled
  menus now layer above any overlay/dialog. Kitchen-sink FirstRunChecklist specimen is
  the Combobox-inside-overlay ratification surface. Confirmed live: timezone pick works.
- **F2 — "More options" links CLOSE the overlay (FIXED).** Links now call `onNavigateAway`
  → AppShell hides the overlay for the session (does **not** set `first_run_complete`); on
  the next full load, if still incomplete, it reappears. Confirmed: link → overlay closed
  + NotBuilt visible. `FirstRunChecklist.tsx`, `AppShell.tsx`, render test.
- **F3 + F4 — three-state step model (FIXED).** Steps are **pending · confirmed · skipped**
  (distinct badges). A **fresh instance is 0/5**; defaults are **suggestions** pre-filled in
  the controls (not "done"); **interacting confirms** (writes) the value; Skip → skipped.
  Header shows "N of 5 confirmed". Copy updated ("Confirm or skip each…") — PROPOSED, owner
  ratifies at the walk. *Observation (owner call):* the confirmed badge is session-only —
  a reload resets badges to pending while the written values persist. `FirstRunChecklist.tsx`,
  `firstrun.css`, tests.
- **F5 / F9 / F10 — smoke tooling deterministic (FIXED).** New `frontend/e2e/smoke/reset.py`:
  reads the **active `.env`** `LEDGERFRAME_DATA_DIR` for the real DB path (F9); **snapshots +
  restores** the `LEDGERFRAME_*` lines each reset so overlay writes (provider/currency/tz)
  don't drift the `.env` across runs (F5) — provider stays `mock`, never `yahoo`; resets the
  DB via the **Python `sqlite3` module** (no CLI needed — F10). Snapshot gitignored.
- **F7 — deterministic resume (FIXED).** Overlay shows when `!locked && !firstRunComplete
  && !firstRunHidden`; after unlock, an incomplete first-run reappears. AppShell render test
  (lock → unlock → overlay resumes). The earlier smoke inconsistency was the F6 degraded
  backend, not a logic bug.
- **F8 — 6-digit PIN enforced at the API (FIXED, security-first).** `PinPayload.min_length`
  4 → 6 (SECURITY-BASELINE §3); a 4-digit PIN → **422** at the boundary, not just the
  frontend gate. Contract regenerated same commit (`minLength` 4→6). New rejection test; all
  pre-existing short test PINs padded to 6 digits.
- **F11 — tests never touch the real `.env` (FIXED).** Autouse conftest fixture points
  `envfile.ENV_PATH` at a per-test temp file, so `apply_env` (base_currency/timezone/provider)
  writes to a throwaway `.env`. Verified: the real `.env` is byte-unchanged after the
  env-mutating tests.
- **F6 — provider-429 backoff (APPROVED as scoped + BUILT, owner batch 2 2026-07-11).**
  Built exactly as scoped, in the **Yahoo provider only** (`app/providers/market/yahoo.py`), **no
  worker-loop rework, contract untouched**: (1) the 429 backoff now **honours `Retry-After`**
  (delta-seconds or HTTP-date, capped at 300s) instead of a fixed linear delay; (2) a
  **provider-level cooldown circuit-breaker** — after **K=3 consecutive 429s** the provider sets
  `_cooldown_until` and **skips the network** for the window (Retry-After or 120s default), so a
  sustained rate-limit no longer re-hammers Yahoo every worker cycle; a clean response resets the
  streak + lifts the cooldown; (3) **honest-stale FX on failure** — `get_fx_rate` no longer
  substitutes the mock provider's synthetic rate; it returns an explicit unavailable marker
  (`rate 0`, `is_stale`) so `fx.get_rate` falls to the **ECB reference rate** (honest, sourced),
  never a fabricated number. **Backend tests** cover all three behaviours
  (`tests/unit/test_yahoo_provider.py`): Retry-After honoured, cooldown-then-skip-network,
  honest-stale-not-mock (+ streak-reset). The original investigation is preserved below.

  *Original investigation (retained):*
  *Current behaviour:* the worker (`app/worker.py`) runs `refresh_market_data` on a **5-minute
  interval**, iterating **every** symbol serially. The Yahoo provider (`_paced_get`) serializes
  requests and, on `429`, retries **twice** with a fixed linear backoff (1.5s, 3s) then raises;
  `get_fx_rate` catches it and **falls back to a mock FX rate** (logging a warning per pair). It
  does **not** read `Retry-After`, and there is **no provider-level cooldown** — so on sustained
  429 it re-hammers Yahoo every cycle (the observed log flood + sluggish backend when a stray
  overlay selection left `provider=yahoo`).
  **PROPOSED minimal contained fix (owner approval BEFORE building; no provider-loop rework):**
  (1) respect the **`Retry-After`** header in the provider's 429 backoff (cap it); (2) a
  **provider-level cooldown/circuit-breaker** — after K consecutive 429s, skip that provider for
  the cooldown window and serve the cache; (3) on failure, **flag values honest-stale** (the
  existing StalenessChip) rather than substituting a mock FX rate. Scope-contained to the
  provider + worker; **awaiting owner approval.**

**Checks:** frontend 93 tests + drift/typecheck/lint/build · backend 484 · contract current.
Smoke fix-confirmation run green (0 console errors). Dev instance left reset + `.env` pristine.

---

### §12a — Reviewed and DECLINED for this milestone (owner, 2026-07-11; no code)

Recorded so these do **not** resurface later as gaps in the first-run flow — each is a
deliberate exclusion under existing spec, not an oversight:

- **Personal-profile fields (name/etc.)** — DECLINED. The checklist stays no-profiling per
  **D-045 / PRODUCT-SPEC**. Reopening this needs a deliberate no-profiling **amendment** +
  owner re-affirmation against the privacy identity; DOB/gender stay out regardless
  (parked as **ROADMAP R-25**).
- **Display-axis onboarding steps** (theme / density / contrast / motion) — DECLINED.
  **D-045 explicitly excludes density** (and the display axes generally) from the checklist;
  they are plain Settings → Appearance options (per-device, D-078). The five steps stand.
- **Per-lane provider configuration** in first-run — DECLINED. First-run is provider
  **selection only** (F-8); per-lane provider **priority/config editing** is parked as
  **ROADMAP R-13** (no user-editable provider priority in v2). The step links out for keys.

---

## 13. RETROSPECTIVE — first-run checklist milestone (owner-closed 2026-07-11)

Phase 3 CLOSED; the milestone is DONE (owner live re-verify passed: same-value confirm —
SGD-as-suggested — flips to confirmed). Lessons folded into `TEMPLATE-page-build.md` in the
same commit.

**PRIMARY LESSON — a scripted pre-pass runs GREEN before the owner walk.** The owner-scripted
smoke pre-pass (`frontend/e2e/smoke/`, a dev-only Playwright harness against the live app + real
backend on a reset instance) caught **11 findings (F1–F11) before the walk ever started** —
crucially including **backend defects no frontend test could see**: F5 (`.env` drift across
runs), F6 (provider re-hammering a 429'd endpoint every cycle), F8 (PIN length enforced only in
the UI, not the API), F11 (tests mutating the real `.env`). Unit/component suites were all green
throughout; these were only visible by **driving the whole flow live**. → **Encoded as a
standing Phase-3a step in the template:** author the scripted pre-pass, run it to green (0
console errors, correct fresh state) **before** the owner walk; the owner walk (Phase-3b) then
carries **judgment items only** (this milestone's walk was two small batches — §11-1 layout,
§11-2 F3 semantics — not a defect hunt).

**Confirm-on-pick is now a platform pattern.** A select **pre-filled with a suggested value the
user must confirm by choosing it** cannot be a native `<select>` — the browser emits no `change`
for a same-value pick, so confirming the suggestion silently no-ops (§11-2 / F3). `CommitMenu` +
the opt-in **`onCommit`** prop on `Select`/`MasterSelect` is the reusable answer (fires on every
pick incl. the unchanged one), native path unchanged elsewhere. → template §4 component-usage
rule + DESIGN-SYSTEM §5.5.

**Gate/overlays follow D-101.** A full-shell gate/overlay pins its header/footer and scrolls
only its content, caps to the viewport on desktop (all steps fit, no scroll), and becomes a
full-height sheet below the 900px laptop breakpoint (§11-1). It mounts **after** the lock gate.
→ template gate/overlay adaptation note.

**Scoped-change discipline held (F6).** An approved backend hardening (provider-429 backoff) was
kept to the **provider + worker boundary** with the **contract untouched** — Retry-After +
cooldown breaker + honest-stale FX (no mock substitution), each with a backend test. A provider
failure now degrades to the **honest ECB reference rate**, never a fabricated number.

**FLAGGED (judgment, not auto-applied) — for the owner:**
- **Pre-pass depth should scale with page type.** A gate/overlay and a data-entry page clearly
  warrant a scripted pre-pass; a **pure read-only display page** may not (the smoke harness is
  real effort). Recommend: pre-pass is **mandatory for gate/overlay + data-entry/mutating
  pages**, **owner-waivable for read-only display pages** — decide per plan at Phase-3 time
  rather than hard-mandating a harness for every page. *(Encoded as "standing", but this
  scope-nuance is the owner's call.)*
- **The "dirty dev DB" was the owner's own walk state, not a leak.** Verified: the full backend
  suite (and the first-run/PIN tests) run against temp dirs and leave the real dev DB untouched.
  No isolation fix needed. If future walks want a one-command "reset + relaunch", that is a small
  dev-ergonomics add (not built) — flag only.

---

## DELTA NOTE — 2026-07-20 (R-LEGAL §11-5, the acceptance gate)

**The checklist now mounts third, not second.** The entry sequence is **consent → PIN →
first-run**: `FirstRunChecklist` gained a `!gateOpen` condition alongside its existing `!locked`
one. The F-7 principle is unchanged and simply extended — the overlay mounts **after** every entry
barrier, never beside one.

**Why this matters here specifically.** The checklist's steps write to `/settings` and read the
served provider list, and **every one of those calls is refused with 451 while the gate is up**. An
overlay rendered behind the gate would have shown an empty data-provider dropdown and silently
failed its writes — the same class of defect as the post-close §11-4 regression, which was an empty
provider list caused by a fetch that ran while the app was still locked. Acceptance therefore
triggers the **same refetch** that unlocking already did.

**PRE-PASS RE-RUN — isolated stack, 2026-07-20** (backend `:8399`, Vite `:5199`; owner's stack
untouched, `.env` snapshotted and restored):

| Check | Result |
|---|---|
| Unaccepted, first-run incomplete → **gate shows, checklist does not** | ✅ |
| After a **PIN-less** acceptance → checklist appears | ✅ |
| Base currency · Timezone · **Data provider** populated after acceptance | ✅ *(the refetch — provider read `alphavantage`, not empty)* |
| Five steps, "0 of 5 confirmed", Skip / More options / Done | ✅ unchanged |
| Console errors (non-451) | ✅ **0** |

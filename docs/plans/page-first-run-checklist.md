# page-first-run-checklist.md — First-run checklist (D-045) build plan

**Status: PLAN ONLY — owner reviews before build** (drafted 2026-07-11). Derived
strictly from PRODUCT-SPEC §7, DECISIONS D-045, SECURITY-BASELINE §3 (PIN), D-069
(Privacy/no-egress), and the chrome milestone (C-4, the reserved first-run gate slot).
Nothing is resolved here that the specs leave open — every ambiguity is a **§9 NEEDS
DECISION** for the owner, not improvised.

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
| 1. Base currency | Settings · General | `base_currency` | `PUT /settings` (or `PUT /system/data-source`) — **§9** on which is canonical |
| 2. Timezone | Settings · General | device `timezone` (D-013) | **NO settable endpoint exists** — contract gap (§3b / §9) |
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

### 3b. Contract deltas (needed but NOT in the baseline — BUILD BACKEND-FIRST; each is a §9 item for owner approval before any backend work)

| kind | Endpoint (current → intended) | Decision | Why the checklist needs it |
|------|-------------------------------|----------|----------------------------|
| add/reshape | **timezone is not settable** — `timezone` is read in `GET /settings.defaults` but is **absent from the settings allow-list** and has no other write path | D-013 / D-045 step 2 | Step 2 ("Timezone → Settings · General") cannot function without a way to persist the device timezone. Shape (add `timezone` to the settings allow-list vs a dedicated endpoint) is **§9 / owner**. |
| add | **first-run state flag** — no `first_run_*` / `onboarding_complete` key exists anywhere in the contract | D-045 | The overlay needs a persisted signal for "has the checklist been seen / dismissed / completed" so it does not reappear every load, and (if resumable) where to resume. Storage + semantics are **§9 / owner**. |

*No other deltas are assumed. The base-currency dual write path and the provider
API-key handling are behavioural questions, not new endpoints — see §9.*

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

**Affordances the ratified inventory LACKS (amendment required before build — §9):**
- **A checklist / stepper overlay** — there is **no ratified "checklist", "stepper", or
  first-run-overlay component**. Building one is a **DESIGN-SYSTEM §5.5 amendment**
  ratified at `/kitchen-sink` **before** assembly (the chrome's Phase-0a pattern). Scope
  of the amendment (a bespoke overlay vs. composing Dialog + a list) is **§9 / owner**.
- **The shell first-run gate slot does not literally exist yet.** C-4 said the chrome
  "reserves the first-run gate slot"; in practice `AppShell` mounts only the LockScreen
  gate — **no first-run slot was added**. Mounting the overlay in `AppShell` is an
  integration point for this milestone (§8), and *where/how* it composes with the lock
  gate is **§9**.

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
| Timezone | IANA timezone id | **no MASTER-DATA vocab exists** | **§9** — where does the timezone option list come from (browser `Intl.supportedValuesOf('timeZone')`? a served list? a free text?) |
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
- [ ] **Both themes + both densities**; interactive OPEN states (Select/PIN) verified in both themes.
- [ ] **Rendered layout + overflow:** the overlay is verified **rendering at 320/375/900/1366px in both themes** with **zero horizontal overflow**, via the **Playwright suite (ADR-0004)** extended to the first-run overlay — not unit tests alone.
- [ ] **Composes with the lock gate:** the interaction order of first-run overlay ↔ LockScreen is correct (per §9) and neither leaks behind the other.

---

## 8. BUILD PHASES

*One commit per phase. Backend deltas FIRST. Nothing built until §9 clears.*

- **Phase 0 — Contract deltas (§3b):** with owner-approved shapes only — timezone-settable path + the first-run state flag; regenerate `API-CONTRACT.json` + `docs/openapi.json` same commit; drift + `make api-contract-check` green.
- **Phase 0a — §5.5 component amendment:** author the checklist/stepper overlay (+ any toggle/switch) as PROPOSED and **ratify at `/kitchen-sink` before assembly** (new components forbidden without an amendment — the chrome Phase-0a pattern).
- **Phase 1 — Overlay assembly:** compose the ratified overlay into `AppShell` (add the first-run gate slot); wire the five steps to their endpoints; honest skip/empty/error states; each step links to its Settings home; no-egress respected.
- **Phase 2 — Tests:** render/behaviour tests (skippable steps, first-run detection, PIN min-6 + loopback case, no-egress zero-call); **extend the Playwright overflow suite** for the overlay; drift/typecheck/lint green.
- **Phase 3 — Owner acceptance walk (LIVE):** drive the real app on a **fresh no-PIN, no-settings instance** (both themes + a narrow width): the overlay appears, each step sets/skips, links behave, PIN + no-egress work, it does not reappear after completion. Each finding → numbered §-entry, re-verified live. Done only after this walk.

---

## 9. NEEDS DECISION (surface to owner BEFORE build — none resolved here)

| # | Item | Why it blocks | Options / what's needed (OWNER decides) |
|---|------|---------------|------------------------------------------|
| F-1 | **Overlay form + trigger.** The owner framed this as a "gate/overlay," but the *form* is unspecified: full-screen **blocking** overlay (like LockScreen) vs a **dismissible** panel/banner vs a **first-run route**. And **how is "first run" detected** — no `first_run`/`onboarding` flag exists in the contract. | Determines §3b (the state flag), §4 (component), and the whole UX. | (a) blocking overlay + a completion flag; (b) dismissible panel + a "seen" flag; (c) other. **+ define the first-run trigger** (empty settings? explicit flag?). |
| F-2 | **Dependency on the unbuilt Settings page.** D-045 says each step "links to its Settings home," but **Settings is not built** — links land on the `NotBuilt` fallback. Does the checklist **set values inline**, **link out only** (dead-until-Settings), or **both** (inline set + a link)? | The core interaction model; also whether this milestone can complete before Settings exists. | (a) inline set + link; (b) link-only (defer real setting to Settings); (c) inline for the endpoints that exist, link-only for the rest. |
| F-3 | **Timezone is not settable in the frozen contract** (only read from env). Step 2 needs a write path. | Step 2 cannot function; it is a contract delta (§3b). | (a) add `timezone` to the settings allow-list; (b) a dedicated timezone endpoint; (c) other. **Owner approves the shape before backend work.** |
| F-4 | **Timezone option source.** No MASTER-DATA timezone vocab exists. | Step 2's picker needs a list. | (a) browser `Intl.supportedValuesOf('timeZone')`; (b) a served list; (c) free text validated backend-side. |
| F-5 | **First-run state storage + resumability.** Where is "checklist completed/dismissed" persisted, and can a **skipped** checklist be resumed later (and from where — a Settings "finish setup" affordance)? | §3b flag semantics + whether a re-entry affordance is in scope. | Define the flag + resume path (or "no resume — Settings is the home afterward"). |
| F-6 | **Checklist/stepper component scope.** No ratified checklist/stepper exists → a §5.5 amendment. Bespoke overlay vs compose `Dialog` + a list? Is there a ratified **toggle/switch** for the no-egress step, or is that also an amendment? | Phase 0a can't start without the amendment scope. | Owner approves the amendment scope at `/kitchen-sink`. |
| F-7 | **The shell first-run slot doesn't literally exist.** `AppShell` mounts only the LockScreen; C-4's "reserved slot" was conceptual. Where does the overlay mount, and **what is the order vs the LockScreen** (PIN-set-in-checklist then lock? checklist over lock? mutually exclusive on first run)? | Assembly integration + no-leak correctness. | Define the compose order of first-run overlay ↔ LockScreen ↔ lock state. |
| F-8 | **Provider step + API keys.** Some providers (`alphavantage`, `eodhd`, `kite`) need an **API key** (a secret — never in `/settings`). Does step 4 collect the key at first run (via `PUT /system/data-source.api_key`, write-only), or choose the provider only and defer the key to Settings? | Secrets handling + step scope. | (a) provider + key at first run; (b) provider only, key later; (c) provider only, key-required providers flagged. |
| F-9 | **No-egress ↔ provider ordering/interaction.** If the user enables no-egress, the data-provider step is effectively moot (no outbound). Should step 5 (no-egress) precede step 4 (provider), or should enabling no-egress **conditionally soften** the provider step? | Step order / conditional UX. | Owner decides ordering + any conditional behaviour. |
| F-10 | **Base-currency write path.** `base_currency` is settable via **both** `PUT /settings` and `PUT /system/data-source`. Which is canonical for the checklist (and does the checklist need to keep them consistent)? | Avoid a second code path / divergence. | Owner picks the canonical write path. |
| F-11 | **Skip-all / "do this later" affordance.** D-045 makes each step skippable; is there an explicit **"skip all / set up later"** that dismisses the whole overlay, and does that count as "completed" for F-1/F-5? | Overlay dismissal semantics. | Owner defines. |

---

**Sign-off to start build:** §9 (F-1..F-11) resolved · §3b deltas (timezone-settable +
first-run flag) approved with pinned shapes · the Phase-0a checklist/overlay component
amendment scoped for ratification. **No build — and no owner question resolved — until
the owner clears these.**

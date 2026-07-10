# page-chrome.md — Global chrome (app shell) build plan

**Status: PLAN ONLY — owner reviews before build** (drafted 2026-07-11). The chrome
is the **shell that wraps every page**, not a content page — so this plan adapts
`TEMPLATE-page-build.md`: it has no single route/ownership of figures; it composes
navigation + global controls + banners + the lock gate, and integrates the four page
templates. Derived from the specs with section refs; open blockers in §9 — build does
not start until they clear.

---

## 1. IDENTITY

| Field | Value | Spec ref |
|-------|-------|----------|
| Name | Global chrome (app shell) | IA §3, DESIGN-SYSTEM §5.5 |
| Route | none — wraps all routes (`main.tsx` shell around `<Routes>`) | — |
| Nav group | n/a (it *is* the nav) | IA §3 |
| Page template | n/a — the **shell** into which the four templates render | DESIGN-SYSTEM §3/§5.5 |
| One-line purpose | Sidebar nav (D-043) + top bar (D-066) + lock gate + banners, composed once around every page | IA §3, IA "Global chrome", DESIGN-SYSTEM §5.5 |

**Composed, not per-page (D-066).** Every element here lives in ONE shell; pages
never re-implement chrome.

---

## 2. OWNERSHIP TABLE

**The chrome owns UI STATE, not figures.** Owns: nav structure, the active
route highlight, per-device display axes (theme/density/contrast/motion, D-078),
rotation on/off (D-044), lock state. **Summarises** (via canonical readers, never
recomputed):

| Summary shown | Canonical source | Reader reused | Link |
|---------------|------------------|---------------|------|
| StaleBanner ("N stale") | Portfolio/summary reader (`has_stale`) | existing summary reader | → Pricing Health |
| UpdateBanner ("vX available") | version check (respects no-egress) | version endpoint (§3b) | → Settings/About |
| DemoBadge | demo-data flag | settings/status | — |
| Clock | device timezone (Settings, D-013) | settings | — |

**Owns nothing content.** Banners/badge are status summaries; the nav owns no data.

---

## 3. API SURFACE

### 3a. Consumed (already in the frozen contract)

| Method + path | Purpose |
|---------------|---------|
| `POST /auth/set-pin`, unlock/session endpoints | LockScreen gate (D-002) — verify against SECURITY-BASELINE |
| `GET /portfolio/summary` (`has_stale`) | StaleBanner signal |
| settings read/write (display, timezone, rotation) | top-bar controls + Clock; rotation **server-persisted** (D-017/D-078) |

### 3b. Contract deltas (BUILD BACKEND-FIRST — likely)

| kind | Endpoint | Decision | Why |
|------|----------|----------|-----|
| verify/add | **version-check** (respects no-egress: zero outbound when enabled) | D-066/D-075 | UpdateBanner. Confirm it exists; if not, add it + the no-egress guard. |
| verify | rotation config (page set + interval), server-persisted | D-044/D-017/D-078 | Confirm the settings shape exists. |
| verify | lock/unlock session contract | D-002 | LockScreen — pin against SECURITY-BASELINE. |

---

## 4. COMPONENTS

*Most chrome pieces are **not in the ratified §5 inventory yet** — DESIGN-SYSTEM
§5.5 describes them but the frontend only has `DisplayControls`. Each new component
is a **DESIGN-SYSTEM amendment** (new components forbidden without one — §9).*

| Component | Role | In inventory? |
|-----------|------|---------------|
| **Sidebar** | 6 fixed groups (D-043), active-route highlight, not reorderable | **NO — amend** |
| **TopBar** | hosts display controls + rotation toggle + Clock + DemoBadge + Detail toggle | **NO — amend** |
| **DisplayControls** | theme/density/contrast/motion — **move INTO the TopBar** | exists (relocate) |
| **StaleBanner** | "N stale" → Pricing Health | **NO — amend** |
| **UpdateBanner** | version available; **zero calls under no-egress** | **NO — amend** |
| **DemoBadge**, **Clock** | demo flag; timezone clock | **NO — amend** |
| **LockScreen** | PIN gate; reuses ConfirmDialog PIN pattern? | **NO — amend** |
| Toast/Dialog/etc. | already ratified; reused | yes |

**Layered cards / scroll / popover rules (D-100/D-101/§6)** apply to any chrome
panels. The **four page templates** render inside the shell's main region.

---

## 6. DECISIONS IN FORCE

| Decision | What it requires here |
|----------|-----------------------|
| **D-043** | 6 fixed sidebar groups, guessable names (P-4), NOT reorderable; nav-customization removed. |
| **D-066** | Chrome composed once; theme/density/contrast/motion in the top bar; StaleBanner/UpdateBanner/DemoBadge/Clock/rotation live here. |
| **D-044** | Rotation toggle in the top bar; config server-persisted; skips errored/empty pages. |
| **D-040** | The Detail toggle leaves the top bar but **only Home branches on it**. |
| **D-075/D-060** | **No-egress**: with the toggle on, the UpdateBanner/version-check makes **zero** outbound calls. |
| **D-002** | LockScreen is an access lock (PIN), not encryption; per SECURITY-BASELINE. |
| **D-078** | Display axes are per-device (localStorage); rotation is server-persisted (not localStorage). |
| **D-045** | First-run checklist replaces PersonaOnboarding (base ccy, tz, PIN, provider, no-egress) — see §9 (scope). |
| **D-067 / P-6** | The **Ask panel** is chrome per §5.5 but rides the AI pipeline — **DEFERRED to the AI-surfaces milestone** (like the Instrument Detail explainer); shell leaves a slot, D-067 intact (§9). |
| **D-042/D-022/D-056** | Route redirects: `/snapshot`→`/net-worth`, `/planning`→`/cash-flow`, `/global` removed. |

---

## 7. ACCEPTANCE CRITERIA

- [ ] **Sidebar**: 6 groups in fixed order (D-043), active route highlighted, guessable names; no reorder control.
- [ ] **Top bar** hosts theme/density/contrast/motion (moved from the page), rotation toggle, Clock, DemoBadge, Detail toggle.
- [ ] **StaleBanner** shows only when `has_stale`, links to Pricing Health; hidden otherwise (honest).
- [ ] **UpdateBanner** respects no-egress: **network trace shows zero outbound calls** when the toggle is on (D-075).
- [ ] **LockScreen** gates the app on a PIN install; a no-PIN install is unaffected (D-002).
- [ ] **Route redirects** (`/snapshot`, `/planning`, `/global`) behave per D-042.
- [ ] **Rendered layout verification** (1366 & 1920 + a narrow width, both themes + high-contrast): sidebar collapse behaviour, top bar wrap, banners.
- [ ] **Both densities/themes/contrast**; interactive open states verified in both themes.
- [ ] **The four templates** render correctly inside the shell (a page from each variant).

---

## 8. BUILD PHASES

- **Phase 0 — Contract deltas (§3b):** verify/add version-check (+ no-egress guard), rotation config, lock/unlock; regenerate contract same commit.
- **Phase 0a — §5 amendments:** ratify the new chrome components (Sidebar/TopBar/StaleBanner/UpdateBanner/DemoBadge/Clock/LockScreen) at `/kitchen-sink` before assembly (new components forbidden without amendment).
- **Phase 1 — Shell assembly:** sidebar + top bar + banners + lock gate wrap `<Routes>`; move `DisplayControls` into the top bar; wire redirects.
- **Phase 2 — Tests:** nav/lock/redirect/no-egress render tests; drift/typecheck/lint green.
- **Phase 3 — Owner acceptance walk (LIVE):** drive the real app (both themes + high-contrast + a narrow width), each finding → numbered §-entry, re-verified live. Done only after this walk.

---

## 9. NEEDS DECISION — ALL RESOLVED (owner, 2026-07-11)

| # | Item | Resolution (owner, 2026-07-11) |
|---|------|--------------------------------|
| C-1 | **New chrome components** not in the ratified inventory | **Authorized** — author all seven (Sidebar/TopBar/StaleBanner/UpdateBanner/DemoBadge/Clock/LockScreen) as PROPOSED; owner ratifies at `/kitchen-sink` in **Phase 0a before shell assembly**. |
| C-2 | **Ask panel (D-067)** rides the AI pipeline | **Deferral confirmed** — same call as the Instrument Detail explainer; shell **reserves a slot**, D-067 recorded **pending, not dropped**. |
| C-3 | **Version-check endpoint + no-egress guard** | **Proceed** — endpoints already exist (`system/version-check`, `system/update-status`). **Verify both make zero outbound calls under no-egress + add the network-trace acceptance test**; patch only if the guard is missing. Not a new-endpoint delta. |
| C-4 | **First-run checklist (D-045)** scope | **Accepted** — checklist is **its own small plan after the shell**; chrome reserves the **first-run gate slot only**. |
| C-5 | **LockScreen ↔ session/PIN contract** | **Reconcile as proposed** against SECURITY-BASELINE (`auth/set-pin`, `auth/unlock`, `auth/lock`, `auth/state` exist). **Owner sub-decision (D-103): purge-PIN NEVER binds to the unlock session — purge always demands fresh PIN, regardless of lock state.** Recorded in SECURITY-BASELINE §3 + DECISIONS D-103. |
| C-6 | **Sidebar collapse / responsive behaviour** | **Approved (D-102)** — **off-canvas/collapsible below laptop width with a top-bar toggle; fixed at laptop+**. Added to INFORMATION-ARCHITECTURE §3 (gap closed). |

---

**Sign-off to start build:** ✅ C-1..C-6 resolved (owner 2026-07-11). §3b reduces
to verification (C-3 endpoints exist; C-5 auth surface exists). **Proceeding: Phase
0a (author the seven components + kitchen-sink specimens), then PAUSE for owner
ratification** before shell assembly. Ask panel deferral (C-2) recorded; D-102 (IA)
and D-103 (SECURITY-BASELINE) recorded.

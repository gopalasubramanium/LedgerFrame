# page-settings — Settings (`/settings`) build plan

> **STATUS: §9 RESOLVED (owner one-pass, 2026-07-18) · Phase 0 (backend deltas)
> + Phase 0a specimen — STOP for owner ratification.** The §9 rulings are
> recorded verbatim in **"§9 — RESOLVED"** below (Amendments A–D bind). Phase 0
> executes the approved allow-list surgery (add `long_term_days`; remove the
> seven write-only keys) backend-first, one delta per commit. Phase 1 (page
> assembly) is **BLOCKED** until the owner ratifies the Phase-0a specimen.
> The original **PROPOSED** table (§9) is retained below the RESOLVED section
> as the accepted-text-of-record.
>
> Derived from the specs per `TEMPLATE-page-build.md`. Every claim cites its
> spec `file:line` or the repo `file:line` it was **verified against** (grep, not
> recall). Nothing about Settings is built yet — no route, no page, no contract
> change. This plan reads the engine first (verify-first, D-019).

---

## 0. THE CANDIDATES LEDGER (verify-first deliverable)

Every candidate setting, its spec source, its **current** persistence home
verified in the repo, and a proposed disposition. **No row without a spec
cite.** Homes: `env` = `app/core/config.py` `Settings`; `row` = a
`_ALLOWED_KEYS` DB `Setting`; `local` = per-device localStorage; `param` =
request query-param default; `NONEXISTENT`.

**The `_ALLOWED_KEYS` set as it stands** (`app/api/v1/routes/settings.py:23-39`,
**14 keys**): `base_currency, rotation_seconds, refresh_interval_seconds,
privacy_mode, reduced_motion, high_contrast, voice_enabled,
display_sleep_minutes, ai_model, focus_page, rotation_pages, timezone,
first_run_complete, home_quote_source`.

**⚠ VERIFY-FIRST DIVERGENCE — 9 of 14 allow-list keys are WRITE-ONLY.** A grep
for every key across `app/**` (backend) **and** `frontend/src/**` found **no
consumer** for `rotation_seconds`, `rotation_pages`, `focus_page`,
`refresh_interval_seconds`, `reduced_motion`, `high_contrast`,
`display_sleep_minutes`, and the DB rows `voice_enabled` / `ai_model` (the
*env* forms of the last two are consumed; the DB rows are not). Only
`base_currency`, `timezone`, `privacy_mode`, `first_run_complete`,
`home_quote_source` have a live reader. This is the exact condition **D-078's
hard requirement** forbids — *"every allow-listed key is either consumed or
removed"* (`DECISIONS.md:411-412`). It is the spine of §9-2, §9-6, §9-7 below.

| Setting (user-facing) | Spec source (file:line) | Current home (verified) | Proposed disposition |
|---|---|---|---|
| **Base / reporting currency** | D-045 `DECISIONS.md:323`; IA `INFORMATION-ARCHITECTURE.md:395`; GLOSSARY `GLOSSARY.md:226` | `env` `config.py:55` **+** `row` `settings.py:24` **+** `.env` write & in-proc reload `settings.py:117-126` — **CONSUMED** (valuation) | Settings → System/General; first-run links here (D-045). Existing surface. |
| **Timezone** | D-045 `DECISIONS.md:323`; IA `:395` | `env` `config.py:56` **+** `row` `settings.py:33` **+** `.env` write `settings.py:131-136`; validated vs IANA `settings.py:83-87` — **CONSUMED** (Clock) | Settings → System/General. `Combobox` (long IANA list). |
| **PIN (set / change)** | D-002 `DECISIONS.md:93-96`; D-045 `:323`; IA `:395` | `auth.py:60` set-pin · `:106` unlock · `:126` lock · `:142` state; `User.pin_hash` `deps.py:73` — **CONSUMED** | Settings → System (set/change); [S]-gated (`require_auth`). first-run links here. |
| **Data provider (market)** | D-045 `DECISIONS.md:323`; D-014 `.env` `DECISIONS.md:192` | `env` `config.py:59` **+** `GET/PUT /system/data-source` `system.py:113,158`; `api_key` write-only `system.py` `DataSourceIn` — **CONSUMED** | Settings → System; provider + write-only key (D-003). first-run links here. |
| **No-egress toggle (`privacy_mode`)** | **D-069** `DECISIONS.md:355`; D-004 `:106`; D-045 `:324`; GLOSSARY `GLOSSARY.md:277` | `row` `settings.py:24`; read `egress.py:52`, `feeds.py:53`; written frontend `AppShell.tsx:195` — **CONSUMED** | Settings → **Privacy** (ONE canonical home). first-run + UpdateBanner (D-066) respect it. |
| **Density** | D-045 `DECISIONS.md:326`; D-078 per-device `:406`; DESIGN-SYSTEM `DESIGN-SYSTEM.md:197-198` | `local` (DisplayProvider) — **CONSUMED** per-device | Settings → **Appearance** (per-device). |
| **Theme** | D-078 per-device `DECISIONS.md:406`; D-066 | `local` (chrome theme cycle) — **CONSUMED** | Appearance (per-device). Chrome cycle stays; ⚑ dup vs move is IA (§9-6). |
| **High contrast** | D-078 per-device `DECISIONS.md:406` | `local` (DisplayProvider) **AND** `row` `high_contrast` `settings.py:25` = **WRITE-ONLY (no consumer)** | Appearance (per-device); **remove the redundant row** (D-078). §9-6. |
| **Reduced motion** | D-078 per-device `DECISIONS.md:406` | `local` (DisplayProvider) **AND** `row` `reduced_motion` `settings.py:25` = **WRITE-ONLY** | Appearance (per-device); **remove the redundant row** (D-078). §9-6. |
| **Sidebar collapsed** | D-078 per-device `DECISIONS.md:406` | `local` (chrome) — **CONSUMED** per-device | Per-device; chrome toggle owns it — likely no Settings control. |
| **Rotation page-set + interval** | **D-044** `DECISIONS.md:319-321`; D-017 `:198-202`; IA `:134-137`; D-078 server `:409` | `row` `rotation_pages,focus_page,rotation_seconds` `settings.py:24,26` = **ALL WRITE-ONLY**; `env` default only `config.py:100` | ⚑ §9-2 owner call: **wire (ship)** or **remove (park)** — D-078 forbids leaving write-only. |
| **Refresh interval** | *(weak — only the key itself; refresh belongs to worker/Pricing Health, page-news ND-8 `page-news.md:283-286`)* | `row` `refresh_interval_seconds` `settings.py:24` = **WRITE-ONLY** | §9-6/§9-7: reconcile — **remove** (no spec home) unless owner defines a consumer. |
| **Display sleep (kiosk)** | *(weak — no spec cite beyond the key)* | `row` `display_sleep_minutes` `settings.py:25` = **WRITE-ONLY** | §9-6/§9-7: reconcile — **remove** unless owner names a kiosk consumer. OPEN QUESTION. |
| **Voice enabled** | R-32 Voice **definition still owed, owner-only** (`ROADMAP.md` R-32; CURRENT NEXT `CURRENT.md:1547`) | `env` `config.py:88` consumed `voice/service.py:45`; `row` `voice_enabled` `settings.py:25` = **WRITE-ONLY** | **DEFER to the Voice milestone**; do not surface a control until R-32 is defined; remove/keep the row is part of that milestone. |
| **AI model / AI config** | D-067/D-068 AI-surfaces milestone (`DECISIONS.md:352` context; deferred D-067) | `env` `config.py:81` + `GET/PUT /system/ai-config` `system.py:251,277`; `row` `ai_model` `settings.py:26` = **WRITE-ONLY** | System tab shows served AI config (present); **DEFER model management to AI-surfaces**; row reconciled there. |
| **Autolock minutes** | D-002 access lock `DECISIONS.md:93-96` | `env` `config.py:52` + `GET/PUT /system/config` `system.py:199,222` — **CONSUMED** | Settings → System. |
| **LAN access (`allow_lan`)** | D-001 posture `DECISIONS.md:88-92`; D-002; SECURITY-BASELINE | `env` `config.py:51` (`lan_exposed` `:105-109`) + `/system/config` — **CONSUMED** | Settings → System (posture; a PIN precondition, `deps.py:96-100`). |
| **Stale-after seconds** | freshness posture (three-layer, GLOSSARY) | `env` `config.py:69` + `/system/data-source` — **CONSUMED** | Settings → System. |
| **API tokens** | **D-069** `DECISIONS.md:355`; P-7 | `GET/POST /tokens`, `DELETE /tokens/{id}` `tokens.py:26,32,42` (`require_session`); raw token once `tokens.py:37-39` — **CONSUMED** | Settings → **Privacy/Security** API-token card; [S]-gated; shown once. |
| **`long_term_days` threshold** | **Amendment J** `page-reports.md:465-484`; §9-7 `:522`; D-077/Guarantee 4 `page-reports.md:254` | **NONEXISTENT as a setting** — not in `_ALLOWED_KEYS` `settings.py:23-39`, not in `env`; served `param` default **365** `portfolio.py:994,1003,1012,1026`, reader default `tax.py:285,373` (clamp `:289,377`) | ⚑ §9-1 owner call: **add allow-list key (ships with Settings)** per Amendment J, or **stay parked** (Reports keeps its read-only 365 line). |
| **`home_quote_source`** | page-home §9-7 (`API-CONTRACT.md:91`); D-046/D-052 | `row` `settings.py:38`, served default `settings.py:65` — **CONSUMED** (Home) | **NOT a Settings-page control** — a Home in-page source select. Listed for allow-list completeness only. |
| **`first_run_complete`** | D-045 `settings.py:31-32` | `row` `settings.py:33`, consumed by the checklist — **CONSUMED** | Internal flag, no user control. |
| **RSS feeds (ND-6)** | page-news **ND-6** `page-news.md:277-279` | `GET/PUT /news/feeds`, `GET /news/feeds/test` `news.py:162,171,177` (PUT `require_auth`) — **CONSUMED** | ⚑ §9-3 owner call: **Settings vs News** — ONE canonical home. |

---

## 1. IDENTITY

*Source: IA §2 (page map), §3 (nav + rotation); DESIGN-SYSTEM §3 (templates).*

| Field | Value | Spec ref |
|-------|-------|----------|
| Page name (H1 = nav label = route) | **Settings** | IA `:84`; D-022 |
| Route | `/settings` | IA `:84` |
| Nav group | **System** (Settings · Help · Legal) | IA `:109`; D-043 `DECISIONS.md:316` |
| Page template | **Settings** (sectioned/tabbed configuration, System group) | DESIGN-SYSTEM `:230` |
| Rotation eligibility | Eligible as any nav page (D-044) — but a config surface is a poor rotation target; ⚑ not a blocker | IA `:134`; D-044 `DECISIONS.md:319` |
| One-line purpose | Configuration across **4 tabs**, incl. **Privacy** and **API-token** cards | IA `:84`, `:369-378` |

> **Not worklist, not overview.** DESIGN-SYSTEM §3 maps Settings to the
> **Settings** template (`DESIGN-SYSTEM.md:230`), not the Reports-group Worklist
> note. It is *"sectioned/tabbed configuration."*

**The four tabs (D-069 `DECISIONS.md:355`; IA `:371`):**
1. **General / System** — base currency, timezone, PIN, data provider, autolock,
   LAN, stale-after; the sudo-helper-dependent controls (D-003) degrade gracefully.
2. **Appearance** — theme, density, high contrast, reduced motion (per-device,
   D-078); **persona is gone** (D-069 `:376`); **nav-customization is gone** (D-043).
3. **Privacy** — no-egress toggle + egress **state statement**, *"AI never
   persists"* statement, privacy-mode indicator, API-token card
   (`DECISIONS.md:355`; IA `:371-376`).
4. **Data / Advanced (System-degrading)** — provider/AI config, reset-data,
   refresh, fetch-history; degrades without the sudo helper (D-003/D-069, IA `:377`).

*(⚑ Tab membership is a §9-5 geometry/owner call — the spec fixes "4 tabs +
Privacy + tokens + Appearance-minus-persona", not the exact per-tab split.)*

---

## 2. OWNERSHIP TABLE

*Copied from IA §Settings (`INFORMATION-ARCHITECTURE.md:369-378`). Settings is a
**configuration** surface: it OWNS the settings it writes (there is no other
canonical home for a preference), and it **degrades**, never recomputes.*

**Owns (canonical, authoritative, fully explained here):**
- Every **user preference / configuration value** in the Candidates Ledger whose
  home is `env`, `row`, or `local` and whose disposition is a Settings control —
  base currency, timezone, PIN, data provider, autolock, LAN, stale-after,
  no-egress, theme, density, contrast, motion, rotation config *(if §9-2 ships)*.
- The **Privacy section** (no-egress toggle; egress-state statement; "AI never
  persists" statement; privacy-mode indicator) — canonical home (D-069, IA `:371-374`).
- The **API-token management card** (create/name/revoke; token shown once) — D-069, IA `:374-376`.
- The **System/Advanced controls** surfacing `/system/*` config — D-003/D-069.

**Summarises (other pages' info — via the named reader, linked, never recomputed):**

| Summary shown | Canonical page | Shared reader reused | Link target |
|---------------|----------------|----------------------|-------------|
| Egress state statement ("This device makes no network calls") | Settings owns the toggle; the STATE is derived from the same `privacy_mode` row | `egress.py` gate reader (`:52`) | — (own page) |
| `long_term_days` threshold (**if** §9-1 lands here) | **Reports** (`/reports`) shows it read-only today (Amendment J) | `tax.py` readers' default | `/reports` |

**Links to:**
- **Reports** (`/reports`) — the `long_term_days` read-only line links *here* once
  the setting lands (Amendment J, `page-reports.md:482`).
- **first-run checklist** links *into* Settings homes (D-045, IA `:396`): base
  currency, timezone, PIN, data provider, no-egress — each step's Settings home
  lives on this page.

**Enforcement corollary (P-1/D-031):** Settings adds **no figure** a canonical
page does not show; it surfaces the egress state as a **plain statement**, not a
new metric (D-069, `DECISIONS.md:355`).

---

## 3. API SURFACE

*Source: `API-CONTRACT.json` (frozen baseline) + `API-CONTRACT.md` delta table.*

### 3a. Endpoints consumed (already in the frozen contract)

| Method + path | Purpose on this page | Response shape pinned? |
|---------------|----------------------|------------------------|
| `GET /api/v1/settings` | Read stored prefs + served defaults (`settings.py:47-68`) | **No** — serves a free `{stored, defaults}` dict; allow-list keys are **invisible to shape checks** (`API-CONTRACT.md:91`) → pinned by **served-value tests**, not schema |
| `PUT /api/v1/settings` | Write prefs; unknown key → **honest 400** (`settings.py:97-99`, `require_auth`) | Behaviour pinned (`API-CONTRACT.md:93`) |
| `GET/POST /api/v1/tokens`, `DELETE /api/v1/tokens/{id}` | API-token card (`tokens.py:26,32,42`, `require_session`) | Present, D-069 (`API-CONTRACT.md:95`) |
| `GET/PUT /api/v1/system/data-source` | Provider + write-only key + base currency (`system.py:113,158`) | Present |
| `GET/PUT /api/v1/system/config` | Timezone, autolock, LAN (`system.py:199,222`) | Present |
| `GET/PUT /api/v1/system/ai-config` | AI provider/model (`system.py:251,277`) — **surfaced read-only-ish; model mgmt DEFERRED to AI-surfaces** | Present |
| `GET /api/v1/system/admin/available` | **D-003 graceful-degradation signal** — are the root helper + sudoers present (`system.py:570`)? | Present |
| `GET /api/v1/system/data-source` `admin_available` (`system.py:147`) | Same D-003 signal, per-control | Present |
| `POST /api/v1/system/reset-data`, `refresh-data`, `fetch-history` | Advanced/System actions (`system.py:307,400,445`, `require_auth`) | Present |
| `GET /api/v1/system/version-check`, `/update-status` | Update posture; **version-check no-egress guarded (C-3)** (`system.py:488,536`) | Present |
| `GET/PUT /api/v1/news/feeds`, `GET /news/feeds/test` | **If** feeds land here (§9-3) (`news.py:162,171,177`) | Present |
| `POST /api/v1/auth/set-pin` · `unlock` · `lock` · `GET /auth/state` | PIN set/change; [S] session contract (`auth.py:60,106,126,142`) | Present |

### 3b. Contract deltas (needed but not in the baseline — BUILD BACKEND-FIRST)

**Fast-path finding (page-pricing-health §13): §3b is essentially EMPTY.**
Verify-first found every reader Settings needs **already in the frozen
contract**. The only contract-touching work is **owner-gated in §9** and, if
approved, is allow-list-key surgery (invisible to shape regen — pinned by
served-value tests, `API-CONTRACT.md:91`), not new endpoints:

| kind | Endpoint (current → intended) | Decision | Why this page needs it |
|------|-------------------------------|----------|------------------------|
| add *(⚑ §9-1)* | `PUT /settings` `_ALLOWED_KEYS` **+ `long_term_days`** (numeric validator, mirror `ge=0, le=3660` `portfolio.py:994`) | Amendment J `page-reports.md:481-482` | Only if the owner rules the threshold ships with Settings; readers then default to the stored value; Reports' read-only line links here |
| remove *(⚑ §9-6/§9-7)* | `_ALLOWED_KEYS` **− write-only keys** (`reduced_motion, high_contrast, refresh_interval_seconds, display_sleep_minutes`, and `rotation_*`/`focus_page` if §9-2 parks rotation) | **D-078** `DECISIONS.md:411-412` | D-078 forbids a key with no consumer; each removal is a served-value / unknown-key-400 test |

> **Note (allow-list keys are invisible to shape checks).** Neither an add nor a
> removal changes `API-CONTRACT.json` (the endpoint serves a free dict). Each
> key therefore ships a **served-value test** and, for a removal, an
> **unknown-key-400 test** (`settings.py:97-99`) — the D-078 reconciliation is
> proven by tests, not by the contract regen (`API-CONTRACT.md:91`, page-home §12ho1-6).

---

## 4. COMPONENTS

*Source: DESIGN-SYSTEM §5 (ratified inventory). Ratified components only; a new
component needs a §5 amendment (§9-5).*

| Ratified component | Role on this page | Data source | Prop/state not exercised at kitchen-sink |
|--------------------|-------------------|-------------|------------------------------------------|
| **PageHeader** (§5.4) | H1 "Settings" + subtitle; tab strip host | — | — |
| **Segmented** (`DESIGN-SYSTEM.md:529`) | **The four tabs** (already the "tabs" primitive for Markets region tabs / News buckets) | — | ⚑ **as a `role="tablist"` affordance** — never used for full-page tab navigation (§9-5) |
| **Card / `.lf-card` + `.lf-card__body`** (D-100) | Each settings section/card (Privacy card, token card, Appearance card) | — | — |
| **Switch** (`DESIGN-SYSTEM.md:669`) | no-egress toggle; boolean prefs — *"available to the future Settings page"* | `PUT /settings` `privacy_mode` | first used on first-run; page-scale use here |
| **MasterSelect** | Base currency (currency master, MASTER-DATA §3) | `/refdata` + `/system/data-source` | — |
| **Combobox** (`DESIGN-SYSTEM.md:670`) | Timezone (~400 IANA zones — the F-4 case) | `/system/config`, validated `settings.py:83-87` | — |
| **Select** (`ui/Select`) | Data/AI provider (user-scope, not a master); density | `/system/data-source`, `/system/ai-config` | — |
| **TextInput** | Token name; AI base-url; write-only key/api-key fields | `/tokens`, `/system/*` | password-style masking for write-only keys (§9 note) |
| **Button** (§5.4, `DESIGN-SYSTEM.md:383-408`) | Create token, Save, Reset — lucide icon + label (`Plus`/`Pencil`) | `/tokens`, `/system/*` | — |
| **ConfirmDialog (+ PIN)** | Revoke token; reset-data; risky System actions — **fresh PIN** (D-103, never the unlock session) | `/tokens`, `/system/reset-data` | — |
| **Dialog** | Token-created "shown once" reveal; feeds editor (if §9-3) | `/tokens`, `/news/feeds` | — |
| **StatusChip** (`DESIGN-SYSTEM.md:536`) | Privacy-mode indicator; provider/admin availability (D-003) | `privacy_mode`, `admin/available` | label MANDATORY; tone semantic-only |
| **EmptyState** | No tokens yet; a System control unavailable sans helper (D-003) — **honest reason** | `/tokens`, `admin/available` | — |
| **Toast/Snackbar** | Save confirmation; base-currency restart notice (`settings.py:126`) | `PUT /settings` | `tone` (warning on restart) |
| **GlossaryTerm `[Help]`** | Terms shown (no-egress, base currency, density…) | glossary slice | parity vs `GLOSSARY.md` (§5, §9-4) |

**Data source (Holdings retrospective):** every component wires to a **real,
frozen-contract endpoint** (table above). **No mock-backed affordance** is
planned — this is a config page over existing `/settings`, `/tokens`, `/system/*`
readers. If build discovers one, it is a §9 item.

**Affordances the ratified inventory lacks (amendment required before build — see §9):**
- **⚑ A true `Tabs` (`role="tablist"`/`tabpanel`) control.** The inventory has
  **`Segmented`** (`role="group"` + `aria-pressed`, `DESIGN-SYSTEM.md:529`), used
  as "tabs" on Markets/News. Whether `Segmented` is an acceptable affordance for
  a **4-tab full-page** settings surface, or Settings warrants a proper `Tabs`
  amendment (WCAG tab semantics, deep-linkable), is **§9-5** — an owner call, not
  a default. **No new component is authored in this plan.**

**Component usage rules the build must honour (DESIGN-SYSTEM §5/§6):** cards are
layered (D-100); scroll = content only, header outside (D-101); popover overlays
portal to the viewport (§6); write-only key fields never render a stored value
back (D-003 write-only-key rule, `settings.py` secrets note `:4-6`); the token
card shows the raw token **once** and never re-reads it (`tokens.py:37-39`).

**Tables — dataset-size posture (D-094).** The only tabular surface is the
**API-token list** (`GET /tokens`) — **bounded** (a handful of tokens per
install); client-side sort/filter is acceptable; revisit if a user ever holds
tens of tokens (they will not). Not an unbounded/append-only table.

---

## 4b. PER-VARIANT FIELD & ACTION SPECS

**N/A — Settings has no entity variants.** It has *tabs/sections*, not asset
classes or policy types. The per-tab field split is a §1 / §9-5 layout question,
not a D-089/D-090/D-091 applicability matrix. *(Deferred cross-milestone
dependencies are handled honestly: Voice controls DEFER to R-32; AI-model
management DEFERs to AI-surfaces — visible placeholder + recorded pending
decision, never silently dropped, D-068 precedent.)*

---

## 5. VOCABULARIES

*Source: MASTER-DATA.md. Categorical fields → vocabulary + control.*

| Field on this page | Vocabulary / master | Fixed (/refdata) or extensible | MASTER-DATA ref |
|--------------------|---------------------|-------------------------------|-----------------|
| Base / reporting currency | `SUPPORTED_CURRENCIES` (9 codes) | Fixed (code const, `config.py:18`; served) | MASTER-DATA §3 (amended — the constant is canonical) |
| Timezone | IANA zoneinfo (server truth, `settings.py:84-86`) | Fixed (validated server-side) — **user data over a big list**, use `Combobox` | not a MASTER-DATA master (system-provided) |
| Data provider | market-provider set (`_MARKET_PROVIDERS`, `system.py`) | Fixed (served by `/system/data-source`) | served, not a master → `Select` |
| AI provider | `_AI_PROVIDERS` (`system.py`) | Fixed (served by `/system/ai-config`) | served → `Select` |
| Density | comfortable / compact | Fixed (DESIGN-SYSTEM §2.5, `:202-204`) | per-device → `Select`/`Segmented` |
| Theme, contrast, motion | display axes | Fixed (DESIGN-SYSTEM §2) | per-device (D-078) |

**Not a master (user records / system-provided):** timezone (system list →
`Combobox`), providers (served lists → `Select`), API-token names (free text →
`TextInput`). No inline enum lists — every categorical is served (D-005).

---

## 6. DECISIONS IN FORCE

*Source: `docs/audit/DECISIONS.md`. Each decision constraining this page.*

| Decision | What it forbids / requires on this page |
|----------|------------------------------------------|
| **D-069** (`:355`) | 4 tabs; Privacy section (no-egress toggle + **state statement**, "AI never persists", privacy indicator); API-token card (once, [S]-gated, P-7); Appearance gains density, **loses persona**; nav-customization dies; System degrades sans sudo helper. |
| **D-045** (`:322-326`) | Settings provides the **homes** the first-run checklist links to (base currency, timezone, PIN, data provider, no-egress); density is a plain Appearance option. |
| **D-078** (`:405-412`) | **Persistence split by nature** — theme/density/contrast/motion/sidebar are **per-device localStorage**; server rows are `home_layout`(retired)/language/rotation/… **HARD: every allow-list key is consumed or removed.** |
| **D-044** (`:319-321`) | Rotation kept fully configurable; page-set + interval **set in Settings, server-persisted** (D-017); skips error/empty pages; top-bar toggle stays. |
| **D-017** (`:198-202`) | Rotation config lives in **settings rows**, not localStorage; `DashboardConfig`/`RotationItem` tables dropped; write-only keys become read-back-and-consumed (D-078). |
| **D-002** (`:93-96`) | PIN = numeric ≥ 6; an **access lock, not encryption**; Argon2 + lockout; PIN set/change lives here. |
| **D-103** (`CURRENT.md`, page-chrome C-6) | A risky action's PIN (revoke, reset-data) is **always a fresh PIN**, never the unlock session. |
| **D-003** (`:97-101`) | `.env` writes + sudo helper are **install-time opt-in**; controls **hidden/disabled with explanation** when the helper is absent (`admin_available`, `system.py:147,570`); write-only key API (values never read back); allow-list, never free-form shell. |
| **D-004** (`:102-111`) | No-egress toggle is Guarantee 5; accepted gaps (#5 per D-003, #6 per D-002, #7 no-PIN-open-local) are **recorded ADR posture**, not revisited here. |
| **D-005** | Every categorical served (`/refdata`, `/system/*`); frontend carries **zero** vocabulary copies. |
| **D-043** (`:312-318`) | Nav-customization control **removed**; Settings never reorders nav. |
| **D-077 / Guarantee 4** (`page-reports.md:254`) | `long_term_days` is a **neutral user-set integer** — **no jurisdiction presets** if surfaced here. |
| **Amendment J** (`page-reports.md:465-484`) | The `long_term_days` seam: add to `_ALLOWED_KEYS` + numeric validator, readers read the stored default, Reports links here — **only if the owner rules it ships** (§9-1). |
| **P-1 / D-031** | Settings adds no figure a canonical page does not show; egress **state** is a statement, not a metric. |
| **P-7 / D-065** | Scope principle — the token card passes P-7 (D-069). |

---

## 7. ACCEPTANCE CRITERIA

*(Written now so build has the bar; not exercised in this plan.)*

- [ ] **Happy path:** all four tabs render; each control reads its current value
      from a real endpoint and writes through the **canonical** endpoint (no
      second code path) — `/settings`, `/tokens`, `/system/*`, `/auth/*`.
- [ ] **Empty state:** no tokens → EmptyState with reason; a System control
      unavailable without the sudo helper → **honest disabled + explanation**
      (D-003, `admin_available`), never a dead button.
- [ ] **Error state:** a `PUT` failure surfaces an honest error; an **unknown
      key** is a 400 shown as a real message (`settings.py:97-99`), never silent.
- [ ] **Privacy is honest:** no-egress ON → the **state statement** reads *"This
      device makes no network calls"* (D-069); UpdateBanner/version-check make
      **zero** outbound calls (C-3, `system.py` no-egress guard) — assert via a
      network trace, not a claim.
- [ ] **Write-only keys never echo:** the data-source/AI api-key and any secret
      field never render a stored value back (D-003 write-only-key rule).
- [ ] **Token shown once:** the raw token appears exactly once at creation
      (`tokens.py:37-39`); a re-open never re-reveals it; revoke needs a **fresh
      PIN** (D-103).
- [ ] **D-078 reconciliation (if §9-6/§9-7 land):** every remaining allow-list
      key has a **served-value test**; every removed key has an
      **unknown-key-400 test**; no write-only key survives (grep + test).
- [ ] **[S]-gating (D-069/D-002):** token management + settings/system mutations
      require a valid session when a PIN is set; an **API token is 403'd** on
      these mutations (`deps.py:85-87,168-172`); a no-PIN local install stays open.
- [ ] **Both densities + both themes** correct; **interactive OPEN states**
      verified in light AND dark — `Combobox` (timezone), `Select` (provider),
      `Switch`, ConfirmDialog PIN, token Dialog — added to `/kitchen-sink`.
- [ ] **Keyboard + WCAG AA:** the tab strip is keyboard-operable with correct
      roles (⚑ decided by §9-5: `Segmented` `aria-pressed` vs a `Tabs` `tablist`);
      focus ring, labels, no colour-only meaning (StatusChip label mandatory).
- [ ] **No frontend money math:** base-currency change is a backend `.env` write
      + in-proc reload + worker restart (`settings.py:117-126`); the frontend
      renders served strings only.
- [ ] **Terms match GLOSSARY** (§9-4): every shown term
      (no-egress, base currency, density, API token, privacy mode, rotation…)
      exists in `GLOSSARY.md` with identical spelling **and** in the frontend
      glossary slice; guarded by `test_glossary_parity.py`.
- [ ] **Copy hygiene (§11-8):** no `D-0…`/`P-…`/`§…`/endpoint/enum name in any
      user-facing string; a changed label updated **app-wide** (§11-4).
- [ ] **Overflow suite (ADR-0004):** extend `e2e/overflow.spec.ts` to
      `/settings` — zero horizontal overflow at 320/375/900/1366 × both themes;
      only `.lf-shell__content` scrolls vertically (page-markets §12mk1-1).
- [ ] **Cross-page journeys (page-accounts §14ac-2):** first-run → each Settings
      home is a **click-the-control** journey test arriving at the right tab/anchor;
      Reports' `long_term_days` link (if §9-1) lands on the right Settings control.
- [ ] **Request-body assertion:** a `PUT /settings` from tab state asserts the
      **actual body** equals the intended keys (Holdings §9-35).

---

## 8. BUILD PHASES

*One commit per phase. Deltas first (if any survive §9), then assembly, then tests.*

- **Phase 0 — Contract/allow-list deltas (ONLY if §9-1/§9-6/§9-7 approve
  changes):** backend-first. Add `long_term_days` (validator) and/or **remove**
  write-only keys; each ships its **served-value / unknown-key-400 test** in the
  **same commit** (D-078; keys are invisible to contract regen). If §9 approves
  **no** key changes, **Phase 0 is skipped** (fast-path).
- **Phase 0a — Component ratification:** confirm-only **if** §9-5 rules
  `Segmented` is the tab affordance (inventory already covers it). If §9-5 rules
  a `Tabs` amendment, Phase 0a ratifies `Tabs` at `/kitchen-sink` **before**
  assembly (new component gate).
- **Phase 1 — Page assembly:** compose the four tabs from ratified components,
  wired to `/settings`, `/tokens`, `/system/*`, `/auth/*`; honest
  empty/error/degraded states (D-003); Privacy state statement; token-once Dialog.
- **Phase 2 — Tests:** render/component tests; the §7 criteria; served-value +
  unknown-key-400 tests; glossary parity; extend the overflow suite; drift +
  typecheck + lint green.
- **Phase 3a — Scripted pre-pass (green before the walk):** drive all four tabs
  live in both themes across breakpoints; toggle no-egress and **trace the
  network** for zero outbound; set/change PIN; create + revoke a token
  (fresh-PIN); flip provider with the sudo helper absent (degradation).
- **Phase 3b — Owner acceptance walk (LIVE, judgment only):** copy, tab feel,
  privacy semantics, degradation wording; each finding a numbered
  `page-settings.md §*` entry, re-verified live. Owner closes; never self-certify.
- **Close ritual (page-accounts §15-2):** record the close (plan retrospective +
  `RATIFICATION.md §6`), strike-check every §9/walk item against the diff, and
  **`git push`** before the owner re-uploads.

---

## 9. NEEDS DECISION — PROPOSED resolutions (owner rules in the §9 one-pass)

> **Do not resolve here.** Each item carries a PROPOSED resolution for the owner
> to accept/amend; **⚑** marks a genuine owner call. No build starts on any open
> item. New ideas → ROADMAP, not assumptions.

| # | Item | Why it blocks / what's needed | Proposed resolution (owner to approve) |
|---|------|-------------------------------|-----------------------------------------|
| **9-1 ⚑** | **The `long_term_days` seam (Amendment J)** | Verified: **no persisted setting backs it** — absent from `_ALLOWED_KEYS` (`settings.py:23-39`), served default 365 (`portfolio.py:994,1003,1012,1026`; `tax.py:285,373`). Amendment J recorded the seam but left *ships-with-Settings vs parked* to this plan (`page-reports.md:481-484`). | **Ship it with Settings:** add `long_term_days` to `_ALLOWED_KEYS` with a numeric validator mirroring `ge=0, le=3660`; the `tax.py` readers read the stored value as their default; Reports' read-only line becomes a **link to this control** (the accepted §9-7 resolution). Neutral integer, **no jurisdiction presets** (D-077/Guarantee 4). *Alternative: stay parked — Reports keeps served-365 read-only. Owner's call.* |
| **9-2 ⚑** | **Rotation-keys: wire or remove** | `rotation_pages`/`focus_page`/`rotation_seconds` are **already in `_ALLOWED_KEYS`** (`settings.py:24,26`) but **write-only — no consumer** (verified backend+frontend). D-044 keeps rotation "fully configurable" (`DECISIONS.md:319`); D-078 **forbids** a write-only key (`:411-412`). CURRENT.md framed this as a "re-add" (`CURRENT.md:1546`) — but the keys already exist unconsumed. | **Two coherent options, owner picks:** (a) **Ship rotation config with Settings** — build the page-set + interval control AND the frontend rotation consumer that reads these rows (satisfies D-044 + D-078); or (b) **Park rotation** — **remove** the three write-only keys now (D-078 reconciliation) and re-add them *with their consumer* when rotation ships. Leaving them as-is is not an option (D-078). |
| **9-3 ⚑** | **ND-6 feeds management placement** | page-news deferred feed CRUD to "the Settings plan" — *"nothing built there now; the `/news/feeds*` endpoints exist"* (`page-news.md:277-279`; `news.py:162,171,177`). One canonical home (P-1); an IA challenge either way. | **Feeds management lives in Settings → Data/System** (config, not content — the provider-key precedent, ND-6). News stays display-only. A `Dialog` + `TextInput` multi-URL editor + Test, [S]-gated (`PUT /news/feeds` is `require_auth`). *Alternative: a Feeds card on News. Owner rules the single home.* |
| **9-4** | **Terminology gaps (GLOSSARY parity)** | CLAUDE.md hard rule: every shown term is in `GLOSSARY.md`. Verified present: **Base currency** (`GLOSSARY.md:226`), **No-egress toggle** (`:277`). **Absent:** *Density, API token, Privacy mode, Rotation, Data provider, High contrast, Reduced motion, Appearance* (grep found no canonical entries). | Author the missing terms **spec-first in `GLOSSARY.md`** (canonical) then the frontend slice, guarded by `test_glossary_parity.py` — during **build**, not now. Some (Appearance/Data provider) may be plain UI labels, not glossary terms; the owner confirms which need entries. *(Spec-first, never popover-only — page-heatmap §13-1.)* |
| **9-5 ⚑** | **Four tabs vs the ratified templates/components** | DESIGN-SYSTEM §3 maps Settings to the **Settings template** — *"sectioned/tabbed"* (`:230`). The inventory has **`Segmented`** (`role="group"`+`aria-pressed`, used as Markets/News "tabs", `:529`) but **no `Tabs` (`role="tablist"`) component** — a new component is forbidden without a §5 amendment. | **Default: use `Segmented` as the tab strip** (no amendment; matches Markets/News precedent), with the four D-069 tabs as segments. **⚑ Owner call:** if a full-page settings surface warrants proper tab semantics (WCAG `tablist`/`tabpanel`, deep-linkable `#privacy`), raise a **`Tabs` §5 amendment** in Phase 0a. Also confirm the **per-tab field split** (§1) — the spec fixes the *set*, not the *arrangement*. |
| **9-6 ⚑** | **D-078 persistence split — which keys move / are removed** | D-078: theme/density/contrast/motion/sidebar are **per-device localStorage** (`:406`); the chrome already stores them in localStorage (0 server hits). But `reduced_motion`/`high_contrast` **also exist as write-only server rows** (`settings.py:25`) — redundant, D-078-violating. | **Remove `reduced_motion` + `high_contrast` from `_ALLOWED_KEYS`** (per-device is their only home, D-078) — a Phase-0 reconciliation with an unknown-key-400 test each. Appearance reads/writes them via the **per-device** DisplayProvider, not the server. *(Moving any per-device axis to server is an IA/ownership change, not a default — owner rules if any should be server-persisted for kiosk.)* |
| **9-7** | **Allow-list pinning + the write-only reconciliation** | Allow-list keys are **invisible to contract regen** (`API-CONTRACT.md:91`) — a served field/removal produces no diff. D-078 requires **every** key consumed or removed. Beyond 9-2/9-6, `refresh_interval_seconds` + `display_sleep_minutes` are write-only with **no spec home**. | **Per-key served-value test obligation** stated in the plan: each surviving key ships a served-value test; each removal ships an unknown-key-400 test (page-home §12ho1-6 precedent). **Propose removing `refresh_interval_seconds` + `display_sleep_minutes`** (no consumer, no spec) unless the owner names a consumer. This is the D-078 hard requirement discharged. |
| **9-8** | **[S]-gating + PIN against the real session contract** | D-069 says the token card is **[S]-gated**; verify what [S] means. Verified: tokens use **`require_session`** (`tokens.py:26,32,42`; `deps.py:159-181`) — human session only, **API tokens 403'd**; settings/system mutations use **`require_auth`** (`deps.py:77-110`). **Both are OPEN on a no-PIN local install** (`deps.py:102-103,173-174`). | **[S] = a valid human session when a PIN is set; open on a no-PIN local install** (the accepted D-004 gap #7). Token management stays on `require_session` (an API token cannot mint/revoke tokens); risky actions (revoke, reset-data) additionally take a **fresh PIN** (D-103, `require_pin`). No contract change — state the mapping in the plan; test the 403-on-token path. |
| **9-9** | **No-egress toggle — one canonical home** | first-run sets it (D-045, `DECISIONS.md:324`); UpdateBanner respects it (D-066, `:352`); it is consumed by `egress.py:52`/`feeds.py:53` and written by the chrome (`AppShell.tsx:195`). Multiple writers, one truth. | **Settings → Privacy is the ONE canonical home** (D-069); first-run and any chrome affordance write the **same `privacy_mode` row** through `PUT /settings` (no second code path). Settings shows the **egress state statement** (D-069). The state is derived from the one row — cannot disagree. |
| **9-10** | **System tab without the sudo helper (D-003)** | D-003: controls **hidden/disabled with explanation** when the helper is absent; the signal is served (`admin_available`, `system.py:147,570`). The **graceful-degradation shape** is a plan decision, not an implementation detail. | Each sudo-dependent control renders **disabled with an honest EmptyState/explanation** ("System controls need the optional root helper — install-time opt-in") keyed off `admin_available`; read-only status still shows; no dead buttons, no fabricated success. Non-helper controls (currency, timezone, no-egress, tokens, appearance) work regardless. |

**Open questions (not assumptions):** `refresh_interval_seconds` /
`display_sleep_minutes` provenance (9-7) — if the owner names a consumer they
stay; otherwise removed. **Deferred by prior decision:** Voice controls → R-32
(definition owed, owner-only); AI-model management → AI-surfaces (D-067/D-068).
New ideas surfaced during build → ROADMAP with rationale, never silent scope.

---

**Sign-off to start build:** §9 has no open blocker · §3b deltas (if any survive
§9) approved · no §4 component needs an unresolved amendment (§9-5).

---

## §9 — RESOLVED (owner one-pass, 2026-07-18)

*All ten items RESOLVED in a single owner pass on **2026-07-18**. The rulings are
recorded **verbatim** below (substance preserved, not paraphrased away). **⚑**
marks the load-bearing owner calls named in the task. **Amendments A–D** and the
**LANGUAGE strike** + **recorded exemption** are recorded below the table and
**bind**. The PROPOSED table above is retained as the accepted-text-of-record.*

### Amendments (owner, 2026-07-18 — verbatim, binding)

- **AMENDMENT A (binds 9-1):** (i) **ONE default-resolution helper** — the stored
  `long_term_days` value is resolved in **exactly one place** and shared by the
  `tax.py` readers and every `long_term_days`-taking endpoint (A11; **no per-route
  re-reads**); (ii) **PARAM-WINS** — an explicit query param overrides the stored
  default; **existing export behaviour must not silently change**; (iii) the
  Reports read-only line becomes a **LINK** to the Settings control — an
  accepted-page touch: dated delta note in `page-reports.md` + the Reports
  pre-pass re-run (**Phase 1/3a, not now**); (iv) that link is guarded as a
  **JOURNEY** (arrival at the control, not the href — §14ac-2).
- **AMENDMENT B (binds 9-2):** the TopBar rotation toggle's disposition is part of
  THIS ruling — **no orphaned control**. Verify FIRST whether the toggle (or
  anything in `frontend/src/**`) **WRITES** any of the three keys; sequence the
  frontend toggle removal so the trunk **NEVER carries a chrome control that
  400s**. *(If a writer exists, the toggle removal ships in the same batch window,
  with a dated delta note in `page-chrome.md` + the chrome pre-pass re-run, and
  dated strike-annotations on the D-044/D-066 "toggle stays" lines and the
  DESIGN-SYSTEM §5.5 ↻/⊘ glyph row — never silent edits.)*
  **VERIFICATION FINDING (2026-07-18):** **NO writer exists.** The only keys that
  reach `PUT /settings` from the frontend are `first_run_complete`,
  `base_currency`, `timezone`, `privacy_mode` (`updateSetting()` callers,
  `AppShell.tsx:136,180,184,195` via `chrome.ts:61`). The TopBar rotation toggle
  is **local `useState` only** — `AppShell.tsx:50` (`useState(false)`) and
  `AppShell.tsx:151` (`onToggleRotation={() => setRotationOn((v) => !v)}`); it
  makes **zero backend calls** (`TopBar.tsx:72-81` renders the icon toggle with no
  fetch). Therefore removing the three rotation keys **cannot orphan a 400-ing
  control** → the toggle-removal batch is **NOT triggered** this milestone. The
  toggle **stays** as the D-044 chrome control the parked **Rotation engine
  (R-37)** will wire; the D-044/D-066 "toggle stays" lines and the DESIGN-SYSTEM
  §5.5 glyph row are **NOT struck**; no chrome pre-pass re-run this milestone.
- **AMENDMENT C (binds 9-5):** tab state is **URL-addressable**; the first-run
  →Settings-tab links (D-045) are guarded as **JOURNEYS**; a `Tabs` §5 amendment
  is raised **only if the owner calls for it at the 0a specimen**.
- **AMENDMENT D (binds ALL key removals this milestone):** each removed key gets
  an **API-CONTRACT.md retired row** (the `home_layout` pattern — allow-list
  changes are **invisible to contract regen**) **+ an unknown-key-400 test**; each
  surviving key gets a **served-value test**.

| # | Item | Ruling (owner 2026-07-18) |
|---|------|---------------------------|
| **9-1 ⚑** | The `long_term_days` seam (Amendment J) | ✅ **ACCEPT + AMENDMENT A.** `long_term_days` **ships with Settings** — allow-list key + numeric validator mirroring `ge=0, le=3660`. Neutral integer, **no jurisdiction presets** (D-077/Guarantee 4). Amendment A binds (one helper · PARAM-WINS · Reports line → link · link guarded as a journey). |
| **9-2 (b) ⚑** | Rotation-keys: wire or remove | ✅ **PARK + AMENDMENT B.** **REMOVE** `rotation_seconds`, `rotation_pages`, `focus_page` from `_ALLOWED_KEYS` (D-078). Rotation is **parked to a new ROADMAP item** (R-37). Amendment B binds the TopBar toggle disposition — verify the writer first; no orphaned control. *(Writer verification: none — see Amendment B finding; toggle stays.)* |
| **9-3** | ND-6 feeds management placement | ✅ **ACCEPT.** Feeds management (ND-6) lives in **Settings**; News stays **display-only**. *(Build work is Phase 1; record only.)* |
| **9-4** | Terminology gaps (GLOSSARY parity) | ✅ **ACCEPT.** Glossary entries, ruled list: **Density, API token, Privacy mode, Data provider, High contrast, Reduced motion.** **Appearance** and **Rotation** are plain UI labels — **no entries**. Spec-first order enforced: `docs/specs/GLOSSARY.md` **THEN** `mocks/glossary.ts` (parity guard). |
| **9-5 ⚑** | Four tabs vs ratified components | ✅ **ACCEPT + AMENDMENT C.** **`Segmented` is the tab strip** (no new component). Amendment C binds (URL-addressable tab state · first-run→tab links guarded as journeys · a `Tabs` §5 amendment raised only if the owner calls for it at the 0a specimen). |
| **9-6 ⚑** | D-078 persistence split — which keys removed | ✅ **ACCEPT + AMENDMENT D.** **REMOVE** `reduced_motion` + `high_contrast` rows (**per-device is their only home**, D-078). Amendment D binds all key removals this milestone (retired row + unknown-key-400 test per removal; served-value test per surviving key). |
| **9-7** | Allow-list pinning + write-only reconciliation | ✅ **ACCEPT.** **REMOVE** `refresh_interval_seconds` + `display_sleep_minutes` (**no consumer, no spec home**; re-add spec-first if a feature ever names them). |
| **9-8** | [S]-gating + PIN vs the real session contract | ✅ **ACCEPT.** [S] mapping **as verified** (`require_session` for tokens; `require_auth` for settings/system mutations; **both open on a no-PIN local install**, the accepted gap #7). **Token revoke stays `require_session`** — the fresh-PIN extension was **DECLINED** (D-103 binds the **destructive purge only**; a revoked token is re-creatable). Record D-103's correct scope; **do not cite it for revoke**. |
| **9-9** | No-egress toggle — one canonical home | ✅ **ACCEPT.** `privacy_mode`: **ONE row**, Settings → Privacy canonical; all writers via the **same `PUT /settings`**; the egress **state statement is derived from that row**. |
| **9-10** | System tab without the sudo helper (D-003) | ✅ **ACCEPT.** Sudo-dependent System controls **disabled with an honest explanation** keyed off served `admin_available`; **no dead buttons, no fabricated success**; non-helper controls work regardless. **REFINED at the Phase-3b walk (2026-07-18, §14):** the live surface degrades **only Allow LAN** (the one control that calls `POST /system/admin`); provider / auto-lock / reset / the AI line work regardless. The live behaviour **supersedes the §11 specimen's illustrative broad gating** — the "non-helper controls work regardless" clause is the shipped contract. |

### LANGUAGE — STRIKE via §-entry (owner, 2026-07-18)

`language` is **STRUCK** from D-078's server-persisted list — named but never
built (no key, no consumer, no i18n anywhere; re-add spec-first if i18n ever
lands). Recorded as a dated strike-annotation in `DECISIONS.md` (COMMIT 3), not a
silent edit. The residual **"Home layout"** mention in the same list is also
struck (already retired by the D-046 AMENDMENT, page-home §12ho1-6).

### Recorded exemption (so the strike-check doesn't trip later)

`voice_enabled` and `ai_model` rows **remain write-only BY RECORDED DEFERRAL** —
reconciled at the **Voice** (R-32, definition still owed) and **AI-surfaces**
(D-067/D-068) milestones respectively; **exempt from this milestone's D-078 sweep
by this ruling**. (They are therefore **not** removed in Phase 0 delta 3.)

---

**Sign-off — §9 CLOSED (owner 2026-07-18):** all **10 items RESOLVED** (ACCEPT/PARK
as recorded + Amendments A–D + the LANGUAGE strike + the voice/ai exemption).
Phase 0 executes the approved allow-list surgery backend-first (add
`long_term_days`; remove the seven write-only keys — the three rotation keys +
`reduced_motion` + `high_contrast` + `refresh_interval_seconds` +
`display_sleep_minutes`). **Phase 1 (page assembly) is BLOCKED until the owner
ratifies the Phase-0a specimen (§8).**

*(End of §9 record. Phase 0 evidence is appended as §10 after the deltas land.)*

---

## 10. PHASE 0 — CONTRACT/ALLOW-LIST DELTA EVIDENCE (backend-first; RED→GREEN per commit)

*One delta per commit, in the task's order. Each was proven **fail-first RED on the real cause**,
then GREEN with its pin. Allow-list keys are **invisible to contract regen** (`/settings` serves a
free dict, `API-CONTRACT.md:91`), so adds/removals are pinned by **served-value / unknown-key-400
tests**, not the schema. Environment gate: `pytest` collected cleanly (861 baseline) — the
ModuleNotFoundError-no-`app` shell did **not** apply, so the backend deltas were verifiable.*

| # | Delta [§9] | Fail-first RED (real cause) | GREEN (pin) | Commit |
|---|-----------|-----------------------------|-------------|--------|
| 1 | **`long_term_days` ADDED** to `_ALLOWED_KEYS` + numeric validator (`ge=0, le=3660` mirrored) [9-1/Amdt A] | `test_long_term_days_is_settable_and_reads_back` RED — `Unknown setting: long_term_days.` (unlisted key → 400) | Key added + validator; served-value round-trip + validator (`abc/-1/3661`→400, `0/3660`→200) GREEN. Suite **861→863** | `6cfb064` |
| 2 | **ONE resolution helper** `tax.resolve_long_term_days` (Amdt A / A11); routes pass the param as **None-when-absent**; PARAM-WINS | `test_stored_threshold_is_the_default_when_param_absent` RED for BOTH endpoints — `assert 365 == 1` (routes hard-defaulted 365; the stored row was never read) | Helper resolves stored-or-365 in one place, shared by both readers + the composed statements/pack callers; PARAM-WINS + absent→365 guardrails GREEN. **Param default 365→None flipped the four query params to `anyOf:[integer,null]` — a visible schema change regenerated same-commit** (no path diff). Suite **863→869** | `17db4f1` |
| 3 | **Seven write-only keys REMOVED** (`rotation_seconds/rotation_pages/focus_page` §9-2(b); `reduced_motion/high_contrast` §9-6; `refresh_interval_seconds/display_sleep_minutes` §9-7) [Amdt D] | `test_removed_key_is_unknown_400[*]` RED ×7 — each key was still accepted (200) | Keys delisted; unknown-key-400 per key + surviving-key round-trips (incl. the `voice_enabled`/`ai_model` deferral-exempt pair) GREEN. Allow-list removal **invisible to regen** → `make api-contract-check` green, no regen. Suite **869→880** | `552345e` |
| 4 | **API-CONTRACT.md rows** — 1 allow-list-add + 7 retired (the `home_layout` pattern) [Amdt D] | — (docs ledger) | Contract regen produced **NO diff** to `API-CONTRACT.json`/`openapi.json`; `make api-contract-check` **green** — the assertion that the surgery is invisible to the shape check | `344e38a` |

**Backend suite:** **880 passed** (861 baseline + 19 new: 2 delta-1 + 6 delta-2 + 11 delta-3).
**Contract-check:** green throughout; the only JSON delta was the delta-2 param-nullability, regenerated
in `17db4f1`. **Frontend `npm run check` (from `frontend/`):** **exit 0** (lint · typecheck ·
check:tokens · **252 vitest** · **262 overflow/tile e2e**).

**Amendment-B writer-verification finding (verify-first, done BEFORE delta 3):** **NO frontend writer
exists** for any of the seven removed keys. The only keys that reach `PUT /settings` from the frontend
are `first_run_complete`, `base_currency`, `timezone`, `privacy_mode` (`updateSetting()` callers —
`AppShell.tsx:136,180,184,195` via `chrome.ts:61`). The **TopBar rotation toggle is local `useState`
only** — `AppShell.tsx:50` (`useState(false)`), `AppShell.tsx:151`
(`onToggleRotation={() => setRotationOn((v) => !v)}`); it makes **zero backend calls**
(`TopBar.tsx:72-81`). Therefore removing the three rotation keys **cannot orphan a 400-ing control** →
the Amendment-B toggle-removal batch was **NOT triggered**; the toggle **stays** as the D-044 chrome
control the parked **Rotation engine (R-37)** will wire. The D-044/D-066 "toggle stays" lines and the
DESIGN-SYSTEM §5.5 ↻/⊘ glyph row were **NOT struck**; no chrome pre-pass re-run this milestone.

**Flagged (not edited — task-directed):** `DECISIONS.md` D-078's own text is reconciled (COMMIT 3),
but the **IA drift remains** — `INFORMATION-ARCHITECTURE.md:165` ("Simple layout") and `:411`
("Simple/Full layouts") still reference the retired two-layout Home (collapsed to ONE layout by
§12ho1-6). These are page-home's territory; recorded here, not touched.

**Related observation (not swept):** `GET /settings.defaults` still serves `rotation_seconds`
(`settings.py:69`, env-derived `rotation_default_seconds`) — a **served read-only default**, not an
allow-list write key, and unread by the frontend. It belongs to the parked rotation surface (R-37);
removing it now (without the engine) would repeat the §9-2 scope-creep concern, so it is left in place
and recorded for R-37.

---

## 11. PHASE 0a — THE GEOMETRY GATE SPECIMEN (static, unwired; ratify BY LOOKING)

*Static `/kitchen-sink` Settings specimen (`SettingsMockup.tsx` + `Settings.css`), composed from
ratified `ui/` only — the SETTINGS template (`DESIGN-SYSTEM.md:230`). Seven frames staged; nothing
wired (D-105 — the frontend computes nothing). **STOP after 0a — the owner ratifies by looking.**
Phase 1 is BLOCKED until then.*

**What is staged (seven frames):**
1. **General** — base currency (`MasterSelect`, SGD, + the restart notice) · timezone (`Combobox`,
   Asia/Singapore) · the **`long_term_days` control** (`TextInput` "365" + a "days" affix; help copy
   states *neutral organisation split, not tax advice, no jurisdiction presets* — D-077/Guarantee 4).
2. **Appearance** — theme/density (`Select`) · high-contrast/reduced-motion (`Switch`), with the
   **per-device** note (D-078; the server rows for contrast/motion were removed in Phase 0).
3. **Privacy** — ONE no-egress `Switch` → the **derived egress state statement** (`StatusChip`
   "No-egress: On" + *"This device makes no network calls."* — the D-069 wording **verbatim**; a plain
   statement, never a metric, P-1/D-031) · the *"AI never persists"* statement · the **API-token card**
   (`DataTable`, bounded D-094; a never-used token shows a **bare em dash** last-used) + the note that
   **revoke needs the session, not a fresh PIN** (§9-8; D-103 is the destructive-purge scope only).
4. **Privacy · token SHOWN-ONCE** — the reveal staged as a **static dialog-body frame** (the Accounts
   merge-dialog precedent — a live `Dialog` portals a full-screen modal that would block the gallery).
5. **Privacy · EMPTY tokens** — `EmptyState` with a reason + Create CTA (usable from zero).
6. **System · `admin_available=false`** — the sudo-helper controls **disabled + an honest
   explanation**; read-only status (`StatusChip` "Root helper: not installed", attention) stays; no
   dead buttons, no fabricated success (D-003/§9-10).
7. **System · `admin_available=true`** — the same controls **enabled** (the non-degraded contrast).

**Pixel walk (geometry + honesty):**
- **Arithmetic:** the only rendered numbers are literals — `365` (days), `15` (auto-lock min), token
  dates. **NONE is computed** (no sums, no percentages) — Settings has no money math (P-1/D-031). The
  honest **tile-integrity finding is the ABSENCE of arithmetic**, so nothing is staged as a computed
  tile.
- **Protected copy verbatim:** *"This device makes no network calls."* matches `PRODUCT-SPEC.md:219` /
  D-069 exactly. The *"AI never persists"* statement is present (final wording is an owner-walk call).
- **Derived-not-duplicated:** the egress `StatusChip` label and the statement both read from the one
  `noEgress` state — they cannot disagree (§9-9).
- **Empty/disabled states:** token EmptyState (reason + CTA); System controls disabled with the
  keyed-off explanation; the never-used token's bare em dash (absent is real, not "never" fabricated).

**Flagged for the owner at the gate (ratification questions, not invented):**
- **(a) the `long_term_days` control** is a `TextInput` + affix — a dedicated **integer/stepper input**
  is not in the ratified inventory; a `NumberInput` would be a §5 amendment. Owner's call.
- **(b) "Reset data" (destructive)** — the inventory has **no danger `ButtonVariant`**; the specimen
  uses a restrained CSS tint on the ratified `Button`. A proper danger variant is a §5 question.
- **(c) Tab affordance** — `Segmented` is the strip per §9-5/Amendment C; if the owner wants full WCAG
  `tablist`/`tabpanel` semantics + deep-linkable `#privacy`, that is the `Tabs` §5 amendment (raise at
  this gate per Amendment C).

**Frontend `npm run check`: exit 0.** (A first run surfaced 8 first-run-overlay e2e failures — a live
`<Dialog open>` in the gallery portalled a modal backdrop that blocked the page; refactored to the
static dialog-body frame, re-verified green.)

*(STOP. Owner ratifies the specimen by looking. Phase 1 is BLOCKED until then.)*

---

## 12. PHASE 0a RATIFICATION RECORD (owner, 2026-07-18)

**SPECIMEN RATIFIED (owner, 2026-07-18)** — the Phase-0a geometry-gate specimen
(`9f79352`; `SettingsMockup.tsx` + `Settings.css`, §11) is **ratified with
conditions**. Phase 1 (assembly) is **UNBLOCKED** and proceeds under the gate
rulings and ratification conditions recorded here (owner walk of the specimen,
2026-07-18). This is the accepted record; Phase 1 executes against it.

### Gate rulings (owner, 2026-07-18 — the §11 "flagged for the owner" questions, ruled)

- **(a) `long_term_days` control — TextInput + "days" affix STANDS.** The specimen's
  `TextInput` + affix is the ratified control (the numeric-input precedent). **No
  §5 amendment** — a dedicated `NumberInput`/stepper is **not** authored. (Resolves
  §11-flag (a).)
- **(b) §5 DANGER `ButtonVariant` — AMENDMENT RAISED (owner-ruled).** Destructive
  actions get a **ratified** danger variant (see COMMIT 2 / DESIGN-SYSTEM §5.4).
  The specimen's **one-off CSS tint** (`set__dangerbtn`) must **NOT** ship — Reset
  data adopts the ratified variant at assembly. (Resolves §11-flag (b).)
- **(c) `Segmented` STANDS as the tab strip.** No `Tabs` §5 amendment is called for
  at the gate — **Amendment C intact**: tab state is **URL-addressable at
  assembly**; the first-run → Settings-tab links are **journey-guarded** (arrival
  at the control, not the href). (Resolves §11-flag (c) / §9-5.)
- **(d) TopBar rotation toggle — HIDDEN until R-37 (owner-ruled).** The dead
  affordance (local `useState`, zero consumers) is **hidden** now, restored by the
  Rotation engine (R-37) with its wiring — the dead-affordance principle. See
  COMMIT 3. *(This SUPERSEDES the Amendment-B "toggle stays" finding for the
  chrome surface: the finding proved no key is orphaned by the Phase-0 removals;
  the owner separately rules the still-inert control hidden until its engine
  lands.)*
- **(e) `GET /settings.defaults` serving `rotation_seconds` — ACCEPTED as-is.** Left
  in place (a served read-only default, not an allow-list write key). **ROADMAP
  R-37 gains one line:** *"sweep the served defaults surface (`rotation_seconds`)
  when the engine lands."*
- **(f) IA:165 / IA:411 residual "Simple/Full" strike — ACCEPTED, batched.** The
  retired-two-layout Home residue in `INFORMATION-ARCHITECTURE.md` is struck at the
  **MILESTONE CLOSE batch**, not now. Ruling recorded; execution deferred to close.

### Ratification CONDITIONS (owner walk findings — each a Phase 1 deliverable)

Each is a **Phase 1 deliverable** carrying a **screenshot in the Phase 1/3a
report**. These are the specimen gaps the owner found at the walk:

- **§12st-1 — PIN set/change card (System).** `require_auth`; the ONE first-run
  choice that had no Settings home (D-002 / D-045). The specimen omitted it.
- **§12st-2 — Market-data provider WRITE-ONLY API-key input (System).** D-003; the
  field **never echoes the stored value** — an honest "set, hidden" state (never a
  read-back secret).
- **§12st-3 — the ND-6 feeds editor (System).** Per the §9-3 ruling: a **Dialog +
  `TextInput` multi-URL + Test**, **[S]-gated** — the ratified Accounts-dialog
  pattern; **no new component**.
- **§12st-4 — the read-only served AI-config display line (System).** Per the
  ledger disposition; a served display line only — model **MANAGEMENT** stays
  **deferred to AI-surfaces** (D-067/D-068).

*(End of §12 ratification record. Phase 1 proceeds against these rulings +
conditions; every §12st condition ships a screenshot in the phase report.)*

---

## 13. PHASE 1 / 2 / 3a — BUILD & PRE-PASS RECORD (four tabs; superseded in §14 by the §14st-1 restructure)

*The Phase-0a specimen (`SettingsMockup.tsx`) became the **real, wired** page
(`frontend/src/routes/Settings.tsx` + `Settings.css`). Every value shown is a
**served** display string (D-105); the frontend computes nothing and there is **no
money math** (P-1/D-031). Writes go through the **canonical** endpoints only —
`/settings`, `/tokens`, `/system/*`, `/auth/*`. Commits (post-§12 ratification):*

- **`794c0ee`** — DESIGN-SYSTEM §5.4 danger `ButtonVariant` amendment + slice
  (`--loss-contrast` token; `Button.tsx` `danger→lf-btn--danger`). *(Ratified at
  the Phase-3b walk — see §14.)*
- **`389c05f`** — chrome: TopBar rotation toggle **hidden until R-37** (0a gate
  ruling (d)).
- **`8d65420`** — Phase 1 backend: served `long_term_days`; reset-data D-103 gate.
- **`c4b8098`** — GLOSSARY §9-4 Settings terms (spec-first + `mocks/glossary.ts`
  slice; parity green): **Density · API token · Privacy mode · Data provider ·
  High contrast · Reduced motion** (Appearance / Rotation are plain UI labels — no
  entries, per the §9-4 ruling).
- **`b00cbd5`** — Phase 1: the real `/settings` page — **four URL-addressable
  tabs** (`?tab=general|appearance|privacy|system`, Amendment C), composing
  ratified `ui/` only; the four §12st conditions delivered (PIN card §12st-1;
  write-only provider key §12st-2; ND-6 feeds editor §12st-3; read-only served
  AI-config line §12st-4).
- **`d16bf86`** / **`ad243a8`** / **`41bb442`** — Phase 2: `Settings.test.tsx`
  render + honest-state + Amendment-C journey tests; `AppShell.test.tsx` first-run
  → Settings-TAB journey guards (§14ac-2); `e2e/overflow.spec.ts` extended to the
  four Settings tabs; de-flaked the served-value test.
- **`1af3652`** — contract regen for the reset-data D-103 `require_pin` gate.
- **`b8c31e6`** / **`b3907ea`** — Phase 3a scripted pre-pass: `settings-smoke.spec.ts`
  (live app + real backend, four tabs × both themes × 320/375/900/1366);
  fixed a live General 320px overflow finding; idempotent PIN-state guard.

**Pre-pass posture at the end of Phase 3a:** four tabs, containment + 0 console
errors across the matrix, the §12st screenshots captured. **This is the surface
the owner walked at Phase 3b (§14) — where §14st-1 restructures it to five.**

---

## 14. PHASE 3b — OWNER ACCEPTANCE WALK, BATCH 1 (live, demo-seeded; 2026-07-18)

*The owner walked the live, demo-seeded `/settings` (Phase 3b, 2026-07-18). The
page is **IN FLIGHT** (not yet owner-accepted) — no accepted-page delta machinery
applies to `/settings` itself. **ONE finding** (§14st-1, an IA arrangement
owner-decision) plus **two walk ratifications**, recorded below and executed as
COMMIT 2+.*

### §14st-1 — data-feed configuration is its own nature: a FIFTH "Data feeds" tab (owner-decision, IA arrangement, 2026-07-18)

**Ruling.** Data-feed configuration **does not belong under System**. A **fifth
tab, "Data feeds"**, is added. The Settings tab set becomes **five**:
**General · Appearance · Privacy · Data feeds · System.**

- **MOVES to Data feeds:** **Market data provider**, **Provider API key**
  (write-only, D-003), **stale-after posture**, and **News feeds** (the ND-6
  editor, §12st-3). These are all *feed/provider configuration* — one nature.
- **STAYS in System:** **Root helper status**, **PIN** (§12st-1), **Auto-lock**,
  **Allow LAN**, the **AI config line** (§12st-4), **Reset data**. Rationale:
  **auto-lock and LAN are access controls, not feeds**, and remain in System
  **despite** having lived in the old "Prices & access" card.
- **"Data feeds" is a plain tab label** — the §9-4 logic: **no GLOSSARY entry**
  for the label itself; the terms *inside* it (Data provider, etc.) already carry
  theirs.
- **Tab state stays URL-addressable** (`?tab=data-feeds`, Amendment C); **no new
  component** (the `Segmented` strip gains a fifth segment).

> **HONESTY NOTE (verify-first, 2026-07-18).** **Stale-after posture has no
> rendered control today** — `stale_after_seconds` is *served*
> (`getSystemConfig`, `systemConfig.ts:37`) but Phase 1 built no stale-after
> input (it was a §0-ledger candidate dispositioned to a tab, never assembled).
> §14st-1 fixes its **canonical home as Data feeds** for when it lands; the
> restructure therefore physically relocates the **three built controls**
> (provider, write-only key, feeds editor) — no stale-after control is
> fabricated. Recorded, not invented (CLAUDE.md hard rule).

### Walk ratifications (2026-07-18)

- **§5.4 danger `ButtonVariant` — RATIFIED at the walk.** The PROPOSED §5.4
  amendment (`794c0ee`; DESIGN-SYSTEM §5.4, dated 2026-07-18) is **ratified** —
  Reset data's `variant="danger"` treatment passed the walk in both themes. The
  DESIGN-SYSTEM §5.4 header **PROPOSED** marker is **struck → RATIFIED** (dated),
  not silently edited.
- **`admin_available` gating refinement — ACCEPTED (note against §9-10).** The
  live page degrades **only Allow LAN** without the root helper (the one control
  that genuinely calls `POST /system/admin`); provider / auto-lock / reset / the
  AI line all work regardless (`systemConfig.ts:1-7`). This **live behaviour
  supersedes the specimen's illustrative broad gating** (the §11 frame 6 showed
  the sudo-dependent *controls* disabled as a class). §9-10's ruling — *"non-helper
  controls work regardless"* — is affirmed by the live surface; the specimen's
  broad-gating illustration is **not** the shipped contract. Annotated against
  §9-10 above.

### COMMIT 2+ — the restructure (executed against §14st-1; fail-first where guards exist)

- Add the fifth `Segmented` segment; tab state URL-addressable (`?tab=data-feeds`).
- Move the three built items to a **`DataFeedsPanel`**; System reflows (root
  helper, PIN, auto-lock + LAN as access controls, AI line, reset).
- Update **every** guard that encoded four tabs or the old homes, **RED-first on
  the real cause**: the overflow suite (**×5 tabs**), the smoke matrix (**all five
  tabs × light/dark × four widths**), and — critically — the **D-045 first-run
  journey guards**: the data-provider step now lands on **`?tab=data-feeds`** at
  the **provider control** (destination-only guards lie — assert arrival at the
  CONTROL); the **PIN step still lands on System**. `Settings.test.tsx` tab-set
  assertions updated fail-first.

### Build & Phase-3a re-run evidence (2026-07-18)

- **COMMIT 1 `5feeab3`** (records) — §13/§14 above; DECISIONS D-069 dated five-tab
  amendment; IA mirror; DESIGN-SYSTEM §5.4 PROPOSED→RATIFIED; §9-10 refinement note.
- **COMMIT 2 `e155cc7`** (restructure) — the fifth `data-feeds` Segmented segment +
  `DataFeedsPanel` (provider · write-only key · ND-6 feeds); System reflow
  ("Access & auto-lock" holds auto-lock + Allow LAN); `FIRST_RUN_LINKS.prices →
  ?tab=data-feeds`. **Fail-first:** the five-tab set / provider-journey /
  data-feeds-control guards went **RED on the real cause** (2 test files, 5
  assertions) before the code moved, then GREEN.
- **No backend change this milestone** — `git diff` over `app/` for both commits
  is **empty**. Confirmed by re-running the suite + contract-check anyway:
  - **Backend `pytest -q` → 891 passed, 0 failed** (269s).
  - **`make api-contract-check` → green** (API contract current; allow-list/UI
    changes are invisible to the shape regen, as expected).
- **Frontend `npm run check` (from `frontend/`) → exit 0** — lint · typecheck ·
  check:tokens · **vitest** (the 5 fail-first guards GREEN) · **322 overflow/tile
  e2e** incl. the new `settings · data-feeds` route (×5 tabs × both themes).
- **Live settings-smoke (dev servers up; demo-seeded, PIN-free, provider `mock`,
  `admin_available=false`) — 5/5 read-only tests passed:** containment + **0
  console errors across FIVE tabs × both themes × 320/375/900/1366**; the five-tab
  strip; the **Data feeds** tab (provider + write-only key + feeds dialog); General
  `long_term_days` verbatim; Privacy derived statement + empty tokens.
  Screenshots (14:12): `settings-{general,appearance,privacy,data-feeds,system}-{light,dark}.png`,
  `settings-data-feeds.png`, `settings-feeds-dialog.png`, `settings-privacy-detail.png`.
  Visually confirmed: the five-tab strip, the Data feeds tab, the reflowed System tab.
- **Deliberately NOT run against the live instance: the PIN-mutating System test.**
  It sets a 6-digit PIN on a no-PIN install, and there is **no API to clear a PIN**
  — running it would leave the owner's demo instance **locked**. The reflowed System
  tab is captured read-only instead (`settings-system-{light,dark}.png`, 14:12); the
  enabled-Reset / fresh-PIN ConfirmDialog capture is covered by the vitest guards
  (`Settings.test.tsx` — danger variant + D-103 no-PIN refusal). The §9-10 live
  refinement (only Allow LAN degrades) is visible in the System screenshot.

**Journey guards (live, §14ac-2):** the first-run → provider step now targets
`?tab=data-feeds` and the guard asserts arrival at the **Market data provider**
control (not the href); the PIN step still targets `?tab=system` at the PIN card —
both GREEN in `AppShell.test.tsx` / `Settings.test.tsx`.

### STALE-AFTER — recorded gap (not fabricated)

`stale_after_seconds` is **served** (`/system/data-source` → `"900"`, confirmed on
the live instance) but has **no rendered control**. §14st-1 fixes its canonical
home as **Data feeds**; when a stale-after control is authored (spec-first) it
lands there. No control was fabricated in this restructure (CLAUDE.md hard rule).

*(The owner re-walked the restructured five-tab page — ACCEPTED, two rulings
filed: §14st-2 below, and §14st-3 recorded at the milestone close.)*

---

## §14st-2 — a SIXTH tab, "AI" (owner-decision, IA arrangement, 2026-07-18)

**Ruling (owner, option B, 2026-07-18).** The AI configuration line **does not
belong under System**. A **sixth tab, "AI"**, is added. The Settings tab set
becomes **six**:
**General · Appearance · Privacy · Data feeds · AI · System.**

**Rationale (the owner's principle, recorded verbatim).** *Data feeds is what
comes in; AI is what the machine does with it; egress remains Privacy's no-egress
toggle.* The three natures are distinct surfaces: **Data feeds** = ingest
(provider/keys/news feeds); **AI** = what the machine does with the data;
**Privacy** = the egress control (the no-egress toggle stays put). System keeps
only the access/appliance controls.

**Named "AI", NOT "AI & Voice" — deliberately.** **R-32 (Voice) is undefined** —
no spec, no decision, no plan, no behaviour (ROADMAP R-32). Naming an undefined
surface would **invent behaviour** (CLAUDE.md hard rule; the "a tab may only
exist if it has real contents today" principle — the rotation-toggle precedent).
The tab is **"AI"**. It **gains "& Voice" only after the owner's R-32
definition** — recorded as a dated annotation against R-32 in `ROADMAP.md`.

- **MOVES to AI:** the **read-only served AI-config line** (§12st-4) — its ONE
  home; **System loses it**. The AI tab also carries the **deferral note** as
  static copy: *"Model management lands with the AI surfaces milestone."*
- **STAYS in Privacy:** the **"AI never persists"** statement — its D-069 home
  (`DECISIONS.md:359`). **No move, no duplicate** (P-1: one canonical home).
- **"AI" is a plain tab label** — the §9-4 logic: **no GLOSSARY entry** for the
  label itself.
- **Tab state stays URL-addressable** (`?tab=ai`, Amendment C); **no new
  component** (the `Segmented` strip gains a sixth segment). **Nothing is
  invented beyond the moved line + the deferral note** — model MANAGEMENT stays
  deferred to AI-surfaces (D-067/D-068).

> **HONESTY NOTE (verify-first, 2026-07-18).** The AI tab surfaces exactly what
> System surfaced before — a **served display line** off `GET /system/ai-config`
> (`getAiConfig`, `systemConfig.ts`). No AI control is authored; no model
> management, no provider edit, no voice affordance. The restructure **relocates
> one built line and adds one static note** (CLAUDE.md hard rule — recorded, not
> invented).

### COMMIT 2 — the restructure (executed against §14st-2; fail-first where guards exist)

- Add the sixth `Segmented` segment; tab state URL-addressable (`?tab=ai`).
- Move the AI-config line to an **`AiPanel`**; **System loses its AI card**.
- Update **every** guard that encoded five tabs or the AI line's home,
  **RED-first on the real cause**: the tab-set assertions (**×6**), the overflow
  suite (**×6 tabs**), and the live smoke matrix (**all six tabs × light/dark ×
  four widths**). **Journey guards are unchanged** — §14st-2 moves no first-run
  target (the provider journey stays on Data feeds, the PIN journey on System).
- Screenshots: the **six-tab strip**, the **AI tab**, and **System without the
  AI line**.

### Build & re-run evidence (2026-07-18)

- **COMMIT 1 `8a3372a`** (records) — §14st-2 above; DECISIONS D-069 dated
  AMENDMENTS block (#1 five tabs, #2 six tabs) + the table-row strike five→SIX;
  IA mirror (page map + Settings ownership: six tabs); ROADMAP R-32 annotation
  (the tab gains "& Voice" only after the owner's Voice definition).
- **COMMIT 2 `f635467`** (restructure) — the sixth `ai` Segmented segment + an
  `AiPanel` (the served `getAiConfig` line + the static deferral note); the AI
  card **removed from System** (SystemPanel drops its `ai` state). **Fail-first:**
  the six-tab set / `?tab=system` "AI line is gone" / `?tab=ai` deep-link guards
  went **RED on the real cause** (3 vitest assertions in `Settings.test.tsx`)
  before the code moved, then GREEN.
- **No backend change this milestone** — `git diff` over `app/` for both commits
  is **empty** (the AI line is a served display off the existing
  `GET /system/ai-config`; no allow-list, no endpoint change).
- **Frontend `npm run check` (from `frontend/`) → exit 0** — lint · typecheck ·
  check:tokens · **12 Settings vitest** (the 3 fail-first guards GREEN) · **334
  overflow/tile e2e** incl. the new `settings · ai` route (×6 tabs × both themes).
- **Live settings-smoke (dev servers up; demo-seeded, PIN-free, provider `mock`,
  `admin_available=false`) — 6/6 read-only tests passed:** containment + **0
  console errors across SIX tabs × both themes × 320/375/900/1366**; the six-tab
  strip; the **AI** tab (served line *"AI is on — provider hailo, model
  (default)."* + the deferral note); the **System** tab **without** the AI line.
  Screenshots (15:30): `settings-{general,appearance,privacy,data-feeds,ai,system}-{light,dark}.png`,
  `settings-ai.png`. Visually confirmed: the six-tab strip, the AI tab, the
  reflowed System tab (no AI card).
- **Deliberately NOT run against the live instance: the PIN-mutating System
  test** (§15c rule — no API clears a PIN; running it would leave the owner's
  demo instance locked). The System-without-AI-line screenshot is captured
  read-only instead; the danger-Reset / D-103 behaviour stays covered by the
  vitest guards.

**Journey guards (§14ac-2): UNCHANGED.** §14st-2 moves no first-run target — the
provider journey still lands on `?tab=data-feeds`, the PIN journey on
`?tab=system`. Both GREEN.

### §14st-3 — sidebar refresh (owner-decision, DEFERRED; the re-walk's second ruling)

The owner's second re-walk ruling (2026-07-18): the **sidebar wants a visual /
interaction refresh** — but it is **NOT this milestone's work**. **DEFERRED to its
own milestone, `chrome-sidebar-refresh` (ROADMAP R-39)**, sequenced as the
**FINAL pre-release milestone** (after data-feed-routing · Help · Legal ·
AI-surfaces). **Translation constraints recorded now** so the milestone inherits
them and invents nothing beyond them:

- **(a) semantic-only colour** — the refresh honours DESIGN-SYSTEM's
  semantic-only-colour rule; no decorative palette.
- **(b) no avatar / account block** — a single-user appliance (D-001); the
  sidebar gains **no** profile/avatar/account affordance.
- **(c) collapse-to-icon rail rides the EXISTING D-078 sidebar-collapsed
  setting** — the icon rail is the **collapsed state** of the already-built
  per-device sidebar-collapsed toggle, **not** a new persistence axis.

Recorded in ROADMAP R-39; nothing built here.

---

## §14 — CLOSED (owner-accepted 2026-07-18, contingent on the batch-2 screenshots)

**The Settings milestone is COMPLETE.** The Phase-3b acceptance walk (§14) resolved
across the batches below; the page ships **six tabs** — General · Appearance ·
Privacy · Data feeds · AI · System.

- **§14st-1 (Data feeds tab) — DELIVERED** (five-tab restructure; commits
  `5feeab3`/`e155cc7`/`375b098`).
- **§14st-2 (AI tab) — DELIVERED** (this batch; commits `8a3372a`/`f635467`).
- **§14st-3 (sidebar refresh) — DEFERRED** to `chrome-sidebar-refresh` (R-39, the
  final pre-release milestone), with the (a)/(b)/(c) translation constraints
  recorded above.

**Owner pre-acceptance:** the close was accepted **contingent on the batch-2
screenshots** (the six-tab strip, the AI tab, System without the AI line) — all
captured live (§14st-2 evidence, 15:30) and visually confirmed.

---

## §15 — MILESTONE RETROSPECTIVE (strike-check + lessons to mechanise)

### Lessons MECHANISED (owner directive — these become rules, not judgment calls)

- **(a) File arrangement findings BEFORE acceptance.** An **in-flight page absorbs
  IA restructures cheaply** — the five-tab (§14st-1) and six-tab (§14st-2) catches
  landed while `/settings` was still IN FLIGHT (no accepted-page delta machinery),
  so each was a straight commit, not a spec-amendment cascade. **Rule:** raise
  arrangement/IA findings during the walk, before the page is accepted — an
  accepted page pays the full dated-delta cost for the same move.
- **(b) A tab/section may only exist if it has real contents TODAY.** Placeholders
  for undefined features are **pre-built dead affordances**. The **"AI, not
  AI & Voice"** ruling (R-32 undefined → name only what exists) and the
  **rotation-toggle** precedent (hidden until R-37 wires it) are the same
  principle. **Rule:** no tab, control, or label for a feature whose behaviour is
  not defined and built.
- **(c) Mutating smokes NEVER run against the owner's live instance without a
  restore path.** The **PIN-smoke refusal** (there is no API to clear a PIN;
  running the PIN-mutating System test would leave the demo instance locked) is
  now **a rule, not a judgment call** — a smoke that mutates state the harness
  cannot restore is captured read-only or skipped, and the skip is recorded.

### Strike-check — every §14 walk item against the diff

| Item | Ruling | Landed in the diff? |
|------|--------|---------------------|
| §14st-1 Data feeds tab | five tabs; provider/key/feeds move | ✅ `Settings.tsx` `DataFeedsPanel`; guards ×5 |
| §14st-2 AI tab | sixth tab; AI line moves System→AI; note | ✅ `Settings.tsx` `AiPanel`; System AI card removed; guards ×6 |
| §14st-2 "AI never persists" stays in Privacy | no move, no duplicate | ✅ `PrivacyPanel` unchanged (`set__aicopy`) |
| §14st-3 sidebar refresh | deferred to R-39 | ✅ ROADMAP R-39; nothing built (correct) |
| Ruling (f) IA Simple/Full strikes | dated strike-annotations, originals preserved | ✅ IA lines struck + annotated (D-046/D-047 AMENDMENTs) |
| R-38 activation | plan-only kickoff | ✅ `data-feed-routing.md` + ROADMAP R-38 |
| RD-9 Amendment 4 | v2.0.0 set; Voice post-release | ✅ `release-readiness.md` + R-32 annotation |
| D-069 amendment #2 | five→six tabs | ✅ DECISIONS table row + AMENDMENTS block |

### Changed-file table (the ACTUAL diff — both walk batches, `b3907ea..HEAD` + close)

| File | What changed |
|------|--------------|
| `frontend/src/routes/Settings.tsx` | `DataFeedsPanel` (st-1) + `AiPanel` (st-2); System reflow (lost provider/key/feeds, then the AI card); six-segment `Segmented` |
| `frontend/src/routes/Settings.test.tsx` | six-tab set; provider-on-data-feeds + AI-on-ai deep-link journeys; System asserts provider **and** AI line gone |
| `frontend/e2e/smoke/settings-smoke.spec.ts` | TABS ×6; Data feeds + AI read-only tests; System asserts AI line moved out |
| `frontend/e2e/overflow.spec.ts` | `settings · data-feeds` + `settings · ai` routes |
| `frontend/src/components/AppShell.tsx` / `.test.tsx` | st-1: `FIRST_RUN_LINKS.prices → ?tab=data-feeds`; provider-journey guard |
| `docs/plans/page-settings.md` | §14st-1 / §14st-2 / §14st-3 / §14 CLOSED / §15 |
| `docs/audit/DECISIONS.md` | D-069 table-row strike (five→SIX) + dated AMENDMENTS block (#1/#2) |
| `docs/specs/INFORMATION-ARCHITECTURE.md` | Settings six-tab mirror; ruling-(f) Simple/Full strikes |
| `docs/specs/DESIGN-SYSTEM.md` | §5.4 danger `ButtonVariant` PROPOSED→RATIFIED (st-1 walk) |
| `ROADMAP.md` | R-32 annotation (AI tab naming + Voice post-release); R-38 ACTIVATED; R-39 chrome-sidebar-refresh |
| `docs/plans/release-readiness.md` | RD-9 Amendment 4 (v2.0.0 set enumerated; Voice post-release) |
| `docs/plans/data-feed-routing.md` | **new** — R-38 plan-only kickoff |

### Baseline test count (at close)

- **Backend `pytest` → 891 passed** — **unchanged**; `git diff app/` over both
  walk batches is **empty** (the whole Settings milestone touched no backend code
  after Phase 0/1; the AI line is a served display off the existing
  `GET /system/ai-config`).
- **Frontend `npm run check` → exit 0** — lint · typecheck · check:tokens ·
  **266 vitest** · **334 overflow/tile e2e** (incl. `settings · data-feeds` +
  `settings · ai`).
- **Live settings-smoke — 6/6 read-only pass**, 0 console errors across six tabs
  × both themes × four widths; the PIN-mutating System smoke deliberately not run
  (§15c).

**Settings — DONE ✅ (six tabs; owner-accepted 2026-07-18).**

---

## §16 — ACCEPTED-PAGE DELTAS (dated; post-acceptance changes to `/settings`)

Settings is an **accepted page**; every change after §14 CLOSED carries a dated
delta note here + a SETTINGS pre-pass re-run (§15a machinery). These landed under
the R-38 `data-feed-routing` Phase-3b owner walk (`data-feed-routing.md §14`).

### §16-1 — client-error rendering standard (2026-07-18, data-feed-routing §14dr-1)

The Data feeds → Market data **Save key** control failed with a toast reading
*"Couldn't save key: [object Object]"* (the owner's live walk). **Two-layer fix, both
at the standard, not this one call site:**
- **Backend (`app/api/v1/routes/system.py`):** `DataSourceIn.provider` was **required**
  while the Save-key control posts `{api_key}` only → a **422** every time. Made
  `provider` optional (partial-update semantics matching `api_key` /
  `base_currency` / `stale_after_seconds`); the provider env is written only when
  sent; unknown-provider `400` still fires when it IS sent. Contract regen same
  commit (`provider` required→nullable; **134 path-keys held**, Flag-1).
- **Frontend (`frontend/src/api/client.ts` — the one choke point every reader feeds
  the toast/`role=alert` through):** `String(body.detail)` on a FastAPI 422 (an
  **array of objects**) produced `"[object Object]"`. Replaced with `detailToText`,
  which renders the served reason TEXT (D-105): string passthrough; validation array
  → joined `.msg` fields; else `HTTP {status}`. It extracts **`msg` only** — the 422
  `detail[].input` echoes the request body, so dumping the object would **leak the
  pasted write-only key** into a toast. Fixing here repairs **every** call site's 4xx
  surface, not just Save-key (the Estate-Edit fix-at-the-standard precedent).
- **Tests:** backend — key-only PUT 200 + provider-unchanged + no `"None"` note;
  client — a 422 array renders `msg`, asserts no `"[object"` and no leaked key.

### §16-2 — configured-state read-only tables (2026-07-18, data-feed-routing §14dr-2, ACCEPTED)

Read-only, served-strings-only surfacing of existing config on the Data feeds tab.
Both **frontend-only** (the payloads already carry every field; both endpoints
already load on the tab — no additive field, no backend change).
- **Market data card → provider `DataTable`** (`ProviderTable`, from the inventory —
  no new component): provider · coverage (`asset_classes`/`regions`) · needs key ·
  **key SET / NOT SET / Not needed** · **active marker** chip · **tier note**
  (`av_tier`) on the active row. Sources: `/system/providers`
  (`active` + `capabilities`) and `/system/data-source` (`has_api_key` + `av_tier`,
  the latter newly declared on the reader's `DataSource` type — already served).
  **Never the key value** — SET/NOT SET only; no-key rows read "Not needed" (honest
  empty state).
  - **[REVISED 2026-07-18, data-feed-routing §16 key-slot honesty ruling.]** The single
    shared key slot (`LEDGERFRAME_MARKET_API_KEY`) serves exactly ONE provider — the
    **active** one. So **SET shows only on the active keyed row**, labelled **"shared
    key slot"**; **every other needs-key row reads NOT SET** with honest copy — *"uses
    the shared slot — currently serving {provider}"* (the active provider). This
    supersedes the earlier "SET/NOT SET from `has_api_key` on every needs-key row"
    (which read SET on `eodhd`/`kite` while `alphavantage` was the active keyed
    provider — flagged honestly in §15's closing note). Composed from served facts
    (`providers.active` · per-provider `needs_key` · the shared `has_api_key`) — the
    same served-facts composition this table already uses; **no backend change**.
    Per-provider credentials (a real per-provider key slot) are **ROADMAP R-41**.
- **News feeds card → configured-URLs `DataTable`** (read-only; the *Edit feeds…*
  Dialog stays the editor). `/news/feeds` already serves the list; loaded on mount.
  Empty state honest: "No feeds configured."
- **Test collision resolved:** the §9-7 routing-matrix test's bare
  `findByText("Active")` became ambiguous against the new "Active" **column header** —
  scoped to the status chip (`lf-statuschip`), intent preserved.

### §16 pre-pass re-run (SETTINGS, isolated demo instance)

Stated in `data-feed-routing.md §13`/the report: the key-save path exercised
end-to-end (a keyed save SUCCEEDS + key-state SET; a rejected save shows the served
reason verbatim), both new tables at all widths, 0 console errors, suites + contract
+ frontend exit 0.

---

## DELTA NOTE — 2026-07-19 (page-help §9-bis-6 · the About card moves in)

> ## ⚠ SUPERSEDED THE SAME DAY — see the REVISION note below this one (2026-07-19).
> **The "it is a CARD, not a tab" ruling recorded here was REVERSED by the owner** at
> page-help §9-bis-11(c). About ships as a **dedicated 7th tab**. Everything else in this
> note — why About left Help, the six links, and the accuracy obligations — **still stands.**
> This note is kept, not rewritten: it recorded a real decision that was really reversed,
> and a plan file that erases its own reversals cannot be audited.

**Settings is CLOSED/accepted; this is a dated delta note on a touched accepted surface,
recorded per convention — not a re-opening.**

**What changes.** The **System** tab gains an **About card**: a brief platform description, the
author, credits, and links. Settings becomes the **canonical home** for the platform's
self-description.

**It is a CARD, not a tab.** The tab count stays **six** (General · Appearance · Privacy · Data
feeds · AI · System). D-069's six-tab shape as amended 2026-07-18 (§14st-1, §14st-2) is
**unchanged** — this note must not be read as amendment #3.

**Why it landed here.** Help was restructured into a three-section user journey — **Orientation ·
Pages · Glossary** (page-help §9-bis-1) — and the old Help **About** tab did not belong to any of
the three. It was never help content: a user opening Help wants to understand the product's
*pages and terms*, not its authorship. Settings→System already carries
platform-level-not-portfolio-level concerns, so About joins them rather than inventing a home.

**Links (owner-specified, §9-bis-6):**

- Platform — https://ledgerframe.org · https://github.com/gopalasubramanium/ledgerframe
- Author — https://me.sgopala.com/ · https://github.com/gopalasubramanium ·
  https://www.linkedin.com/in/gopalasubramanium/ · https://paypal.me/sgopala

**Copy is PROPOSED until the 0a look** — like all user-facing copy, the owner ratifies it by
looking, not by reading it here.

**Accuracy obligations that bind this card specifically:**

- **Credits reconcile to `docs/audit/LICENSES.md`.** That file is generated and reports 381
  packages with 0 unadjudicated findings; the card must not claim a credit the licence record
  contradicts, and must not imply an endorsement no dependency gave. Where the honest answer is
  "too many to list", the card **points** at the licence record rather than enumerating a subset
  that would read as complete. A credits list that disagrees with the licence record is the page
  describing itself falsely — a release bar, not a polish item.
- The project licence is **AGPL-3.0-or-later** (`LICENSE`, `NOTICE`); any licence statement on the
  card says that or says nothing.
- `https://paypal.me/sgopala` is a **donation** link and is labelled as one — never as a purchase,
  a subscription, or anything the platform gates a feature behind.
- **Dead-affordance rule applies:** every one of the six links is verified to render as a real,
  working external link in the 0a walk, or it does not ship.

**Required by the accepted-page convention:** this dated note **+ a Settings pre-pass re-run** on
an isolated instance (spare ports, temp data dir, owner `.env` untouched). Both are owed at the
0a report; neither is satisfied by this note alone.

---

## DELTA NOTE — REVISION — 2026-07-19 (page-help §9-bis-11(c) · About becomes the 7th TAB)

**Supersedes the "It is a CARD, not a tab" clause of the note above. Owner's ruling, reversing the
delegated one.** Everything else in that note stands unchanged.

**What changes.** About is a **DEDICATED 7th tab**, not a card inside System. The tab strip becomes
**General · Appearance · Privacy · Data feeds · AI · System · About**.

**This IS D-069 amendment #3** — and the earlier note's instruction *"this note must not be read as
amendment #3"* is **withdrawn**, because it now is one. `INFORMATION-ARCHITECTURE.md`'s Settings row
and the D-069 section are updated and dated.

**Why the reversal is not a wash.** The card ruling reasoned from *"About is platform-level, and
System already holds platform-level things"* — true, but it treated shelf-space as the deciding
question. About is not configuration at all: **every other tab CHANGES something; About only tells
you what the thing is and who made it.** Filing it inside System put a read-only identity surface
behind a tab named for controls, where nobody looking for it would go. A dedicated tab is the
honest shape.

**What this touches beyond the page — the count is ASSERTED in several places, and they all move:**

- the **Settings tab strip** and its tests;
- any **guard** asserting a six-tab count;
- **Help's own Settings entry (Section 2)** — it currently says six tabs and must now say seven and
  describe About. *This is the **HELP CURRENCY LAW** (page-help §9-bis-11(d)) in its first
  application: the Help delta ships in the same milestone as the platform change, unsaid.*

**Still required, unchanged from the note above:** a **Settings pre-pass re-run** on an isolated
instance. **PROPOSED copy** (ethos/brand/ethics, author bio) and **any new DS pattern** the tab
needs (avatar, brand block) are ratified by the owner **at the look**, not here.

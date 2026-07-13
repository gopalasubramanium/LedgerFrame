# release-readiness.md — defining the finish line

**Status: PLAN ONLY. STOP at §2 (NEEDS DECISION). Nothing here is decided, and no code, LICENSE, README
or SECURITY-BASELINE change ships from this file.**

This is **not** a page plan — it does not use `TEMPLATE-page-build.md`'s structure. It borrows its
**conventions**: verify-first with `file:line` evidence, a numbered **NEEDS DECISION** section resolved by
the owner in one pass, and a **STOP** before anything is built.

**Its job, in order:** (1) audit the repo's release posture **as it actually exists**; (2) lay out the
**owner's** definition-of-release decisions with evidence and honest costs; (3) derive a gated checklist
**from those decisions once they are made**. **The definition of "release" is the owner's.** This plan
surfaces options and decides nothing.

**It does NOT pause the page queue.** Policy is next and runs in parallel. This plan defines the finish
line; it does not move it.

> ⚠ **The single biggest finding, up front.** The repo is **already licensed AGPL-3.0-or-later** — in
> `pyproject.toml:7` and in an **SPDX header on every Python file** — but **there is no `LICENSE` file**
> (§1-1). The licence is therefore *asserted everywhere and shipped nowhere*. Decision **#2** is not a
> blank page: it is a **confirm-or-change** of a choice the codebase has already been making.

---

## 1. VERIFY-FIRST — release-posture audit (2026-07-14)

*Read before assuming anything. Every row is a `file:line` fact, not an impression.*

### §1-1 — Legal surface

| # | Finding | Evidence |
|---|---|---|
| 1a | **NO `LICENSE` file exists** in the repo root. | `ls LICENSE* COPYING*` → nothing |
| 1b | **But the code already declares AGPL-3.0-or-later**: the package metadata says so, and **every** Python source file (including the shell scripts) carries the SPDX header. | `pyproject.toml:7` (`license = "AGPL-3.0-or-later"`); `app/main.py:1`, `scripts/install.sh:2` — `# SPDX-License-Identifier: AGPL-3.0-or-later` |
| 1c | The frontend package declares **no licence** and is marked `private`. | `frontend/package.json:3-4` (`"private": true`, `"version": "0.1.0"`) — **no `license` field** |
| 1d | **Dependency licences (backend)** — all permissive; **no copyleft** found in the direct set: FastAPI, uvicorn, pydantic(-settings), SQLAlchemy, Alembic, aiosqlite, httpx, APScheduler, argon2-cffi, itsdangerous, python-multipart, tenacity. Optional `voice` extra: **vosk** (Apache-2.0) + sounddevice. | `pyproject.toml:10-30` |
| 1e | **Dependency licences (frontend)** — four direct deps, all MIT/ISC-class: react, react-dom, react-router-dom, lucide-react. | `frontend/package.json` dependencies |
| 1f | ⚠ **The direct set was read; the full transitive graph was NOT audited.** No licence-scanning tooling exists in the repo. A distribution claim needs the transitive set checked. | (absence of evidence — no `pip-licenses` / `license-checker` in any manifest or CI) |
| 1g | **R-24 (first-boot licence-acceptance gate) is PARKED**, and the ROADMAP itself records that the **owner flagged an alternative** (*"strike this and build the gate now"*) which is **still pending the owner's call**. | `ROADMAP.md:38` |
| 1h | **D-001** fixes the exposure posture as single-user, local-first + optional LAN, and records that **multi-user isolation is a future *proprietary* layer**. This **constrains the licence choice** (decision #2) and is the reason it is not a free pick. | `docs/audit/DECISIONS.md:86`; `docs/specs/SECURITY-BASELINE.md:41` |

### §1-2 — Install story: what a stranger actually needs

| # | Finding | Evidence |
|---|---|---|
| 2a | **There IS a real installer** — not just dev tooling. `scripts/install.sh` is a guided, idempotent, `--dry-run`-capable wizard (data dir, kiosk, voice, LAN, demo mode, service user) that explicitly **never formats or partitions a disk**. | `scripts/install.sh:1-25` |
| 2b | A full ops script set exists: `backup.sh`, `restore.sh`, `update.sh`, `uninstall.sh`, `doctor.sh`, `lf-admin.sh`, `reset-demo-data.sh`, plus `systemd/` units. | `scripts/`, `systemd/` |
| 2c | **The README is a DEVELOPER document, not an install guide.** Its Status section still says *"v2 is being rebuilt on the v1 backend"*, and its only instructions are `make dev`. **A stranger reading it would not find `install.sh`.** | `README.md:1-59` (59 lines total; "Development" is the only how-to) |
| 2d | **First boot on an EMPTY data dir WORKS.** Verified: `LEDGERFRAME_DATA_DIR=<tmp> alembic upgrade head` runs the whole chain (**26 migrations**) from nothing and creates `db/ledgerframe.db`. The chain is intact (ADR-0001). | run 2026-07-14; `app/db/migrations/versions/` (26 files); `alembic.ini:4` |
| 2e | ⚠ **The `.env` data-dir contract is NOT uniformly honoured by the bash scripts — and their defaults DISAGREE with each other.** The app itself is fine (`pydantic-settings` reads `.env`, so `backup.sh`/`restore.sh` inherit it by delegating to `app.services.backup`). But the scripts that compute the path **in bash** read only the *exported env var*, never `.env`, and each invents a different fallback: <br>• `doctor.sh:8` → `${LEDGERFRAME_DATA_DIR:-/mnt/ledgerframe-data}` <br>• `reset-demo-data.sh:7` → `${LEDGERFRAME_DATA_DIR:-$REPO_DIR/data}` <br>• `.env.example:13` → `/mnt/ledgerframe-data` <br>• `scripts/dev.sh` → `~/.local/share/ledgerframe-dev` <br>**Four sources, three different defaults.** A user who set `LEDGERFRAME_DATA_DIR` in `.env` (the documented contract) and runs `./scripts/reset-demo-data.sh` from a plain shell gets **the wrong directory**. *(This is the Review-close gotcha, and it is **not** a one-off — it is a class.)* | `scripts/doctor.sh:8`; `scripts/reset-demo-data.sh:7`; `.env.example:13`; `app/core/config.py:32,40` |
| 2f | Ports and versions: API `127.0.0.1:8321`, Vite `:5173`; **Python `>=3.12`**; Node version is **not pinned anywhere** (no `engines`, no `.nvmrc`). | `.env.example:15-16`; `pyproject.toml:6`; `frontend/package.json` (no `engines`) |
| 2g | **`.env.example` ships `LEDGERFRAME_MARKET_PROVIDER=mock`**, and `is_demo` is defined as exactly that. On first boot with an empty DB the app **auto-seeds demo data**. So a stranger's default first boot is a **DEMO instance full of synthetic holdings** — see decision **#8**. | `.env.example:36`; `app/core/config.py:59,152-153`; `app/main.py:114-123` |
| 2h | `.env.example` ships `LEDGERFRAME_SECRET_KEY=change-me-to-a-long-random-string`; a test enforces that this is not left as-is. | `.env.example:22`; `tests/integration/test_secret_key_enforcement.py` |

### §1-3 — Distribution-facing security re-read

**The SECURITY-BASELINE's 14-gap table is a PERSONAL-deployment document.** Its "Accept (ADR)" rows are
rational for *one person on their own loopback/VPN*. **Every one of the rows below changes meaning when
strangers run it**, and the plan states that without proposing a fix.

| Gap | Accepted because… | What changes when a **stranger** deploys it |
|---|---|---|
| **1** No multi-user model (`SECURITY-BASELINE.md:41`) | "Single-user appliance by design (D-001)" | Still true — but it must be **stated in the release notes**, not merely implied, or someone will put it on a shared box. |
| **2** Cookie `secure=False`, no in-app TLS (`:42`) | "Loopback by default; remote access via VPN, where TLS lives at the network layer" | A stranger who flips `LEDGERFRAME_ALLOW_LAN=true` gets **cleartext cookies over their LAN**. The ADR's mitigation is a *deployment assumption we cannot enforce*. |
| **3** No CSRF token (`:43`) | "`samesite=strict` + single-user local model" | Same assumption; same exposure once LAN is on. |
| **5** App writes its own `.env` + runs a sudo helper (`:45`) | "Guardrailed: fixed allow-list, write-only keys, `.env` 0600, install-time opt-in" | A **sudo-capable helper** is a very different proposition in software handed to strangers than in one's own appliance. |
| **6** Numeric PIN entropy (`:46`) | "min 6 digits, Argon2 + lockout" | Fine on loopback; thin if anyone exposes it. |
| **7** **No auth on read when no PIN is set** (`:47`) | "Deliberate no-PIN-open-local convenience" | **The default install has no PIN.** A stranger who enables LAN before setting one is serving their net worth unauthenticated. |
| **8** Secrets reachable by the process, no OS keyring (`:48`) | "Env-only at `.env` 0600" | Unchanged technically; **must be disclosed**, since users will put real broker API keys in it. |
| **13** Restore trusts backup content (`:53`) | "SHA-256 self-consistency + traversal guards" | A restore path that trusts its input is a **supply-chain surface** once backups can come from elsewhere. |

**Outbound-call inventory (Guarantee 5: no-egress ⇒ *zero* outbound calls).**

| Call site | Guarded by the no-egress gate? |
|---|---|
| `app/services/feeds.py:152,176` (news feeds) | ✅ yes |
| `app/services/briefing.py:125-127` | ✅ yes |
| `app/api/v1/routes/news.py:55,107` | ✅ yes |
| `app/api/v1/routes/markets.py:430` (symbol news) | ✅ yes |
| `app/api/v1/routes/system.py:496` (version check) | ✅ yes |
| **`app/providers/market/kite.py:140,167`** · **`eodhd.py:137`** · **`coingecko.py:83,99`** · **`amfi.py:100`** (price refresh) | ⚠ **NOT — no call site in the price path consults `no_egress_enabled`** |
| **`app/services/fx.py`, `app/services/ecb_fx.py`** (FX rates) | ⚠ **NOT** |
| **`app/providers/ai/hailo_ollama.py:47-51`**, **`openai_compatible.py:85-191`** | ⚠ **NOT** |

**Verified by enumerating *every* call site of the gate** (`grep -rn no_egress_enabled app/`): it is
referenced **only** from feeds, briefing, news, markets-news and version-check. **`app/services/market.py`,
`fx.py` and `ecb_fx.py` contain no reference to `privacy_mode` / `no_egress` at all.**
`no_egress_enabled` itself is defined at `app/services/feeds.py:46-54` and its docstring states the
intent plainly: *"the device must make ZERO outbound calls (Product Guarantee 5)"*.

⚠ **This is stated as a finding, not a verdict.** It is possible the price path is egress-free in
practice *because* no-egress users run `market_provider=mock` — **but that is a configuration
coincidence, not a guard**, and Guarantee 5 is written as an absolute. **It needs the owner's call
(decision #7) on whether it is release-blocking**, and — whatever the answer — it wants the ND-2
defence-in-depth treatment (guard at the call site, fail-first test) rather than an argument.

**Provider tokens.** Held env-only (`app/core/config.py:61-76`: `market_api_key`, `kite_api_key`,
`kite_access_token`, `openai_api_key`), never in the DB. **No logging of key/token values was found** in
`app/providers/`. **D-069 (API-token management) is present in the contract but the UI is parked.**

### §1-4 — Identity & versioning

| # | Finding | Evidence |
|---|---|---|
| 4a | ⚠ **The version number is incoherent with the product.** The backend says **`3.24.0`** — inherited from the v1 backend copy-in — while the product is called **v2** and the frontend says **`0.1.0`**. The API serves `3.24.0` as its OpenAPI version and logs it at boot. | `app/__init__.py:4`; `pyproject.toml:3`; `frontend/package.json:4`; `app/main.py:140,148,173` |
| 4b | **There are no git tags** and **no `CHANGELOG`.** Nothing in the repo answers "what is v2.0.0?" | `git tag` → empty; no `CHANGELOG*` |
| 4c | **Backup/restore exist and work through the app's own config** (so they honour `.env`), and there is an in-app restore path with SHA-256 + traversal guards. | `scripts/backup.sh:8` → `app.services.backup.create_backup`; `SECURITY-BASELINE.md:53` |
| 4d | ⚠ **But "how do I back up / move my data?" is written nowhere a user would look.** The README does not mention `backup.sh`, `restore.sh`, or the data dir. | `README.md` (59 lines; no mention) |

### §1-5 — Repo hygiene for publication

| # | Finding | Evidence |
|---|---|---|
| 5a | **No secret is tracked.** `.env` is git-ignored (`.gitignore:2-4`, with `!.env.example`), `data/` is ignored (`:10`). The only tracked file matching a secret-ish name is a **test** (`tests/integration/test_secret_key_enforcement.py`). | `.gitignore:2-10`; `git ls-files` scan |
| 5b | **No personal data found in the demo seed.** | grep of `app/seed/` for owner name/email → none |
| 5c | **`docs/` is 3.9 MB across 62 tracked files** and would ship with a source release: this includes **`docs/plans/` (the build plans, with their walk transcripts and retrospectives)** and **`docs/evidence/` (19 page-home screenshots)**. These are **internal working artefacts**, not user documentation. → decision **#10** | `du -sh docs/`; `git ls-files docs/ \| wc -l` |
| 5d | The git history's author email is the owner's **personal address**. Publishing the repo publishes that. Not a defect — but it is a **choice**, and it is irreversible once mirrored. | `git log --format=%ae` |
| 5e | **No history rewrite appears necessary** on the evidence above (no tracked secrets, no personal data in seed). *This is a scan, not a formal audit* — a proper secret-scanner over full history is a checklist item, not a claim this plan can make. | (scope statement) |

### §1-6 — Feature completeness vs the queue *(evidence for decision #9 — no opinion offered)*

**Built and closed (9):** Home · Net worth · Portfolio · Holdings · Markets · Heatmap · News · Review ·
Pricing Health. *(`nav.ts` — 9 entries carry `built: true`.)*

**Declared in the nav but NOT built (10):** **Accounts** · **Policy** · **Cash flow** · **Scenarios** ·
**Insurance** · **Estate** · **Reports** · **Settings** · **Help** · **Legal**.
*(They render the honest `NotBuilt` state; the sidebar only surfaces built pages.)*

**Three of those are load-bearing for a release, and the plan says so as evidence, not as a pick:**
- **Legal** — a page a release would be expected to have (licence, disclaimers). Its absence interacts
  directly with decisions #2 and #3.
- **Help** — the `[Help]` popovers exist across built pages; the Help *page* they belong to does not.
- **Settings** — **Home's layout control was removed and `home_layout` retired** partly on the reasoning
  that Settings would carry such things (page-home §9-2/§12ho1-6). Several settings keys are
  **allow-listed but have no UI**, and the **rotation keys are still write-only** (the D-078 violation
  already recorded in `docs/audit/08-TECH-DEBT.md`, queued as a chrome task).

---

## 2. NEEDS DECISION — **OWNER, ONE PASS. NOTHING BELOW IS DECIDED.**

*Options and honest costs only. Where the plan has a view it is labelled as such and is not a choice.*

> **⚖ This plan gives NO legal advice.** Decisions **#2**, **#3** and **#7** have legal consequences
> (licence, acceptance gate, disclosure). The options below are **factual descriptions of common
> practice**, not recommendations, and the owner may reasonably want **professional counsel** before
> settling #2 in particular.

### RD-1 — What does "first public release" MEAN?

| Option | What it costs, honestly |
|---|---|
| **(a) Source release** — public repo, `git clone`, `install.sh` | **Cheapest by far.** The installer already exists (§1-2a). Costs: README must become an *install* guide (§1-2c), the data-dir script divergence must be fixed (§1-2e), platform support must be stated honestly (RD-4). Risk: every user is a builder; support burden is "it didn't install". |
| **(b) Source + container image** | Adds a reproducible runtime and kills most "works on my machine". Costs: a Dockerfile exists (`Dockerfile`, `docker-compose.yml`) but is **unverified for release**; image publishing, base-image CVE upkeep, and a **data-volume story** (the data dir becomes a volume — see §1-2e). |
| **(c) Packaged binaries / installers** | **The most expensive.** Per-platform packaging, signing, auto-update, and an **upgrade/migration promise for strangers' data** (RD-6) that a source release can hedge on. Also the most likely to make **R-24** (licence-acceptance gate) a real requirement (RD-3). |

*Note: these are cumulative, not exclusive — (a) can ship first and (b)/(c) later. Sequencing is itself
part of the decision.*

### RD-2 — LICENCE. **This is a confirm-or-change, not a blank page.**

**The codebase already asserts AGPL-3.0-or-later** in package metadata and an SPDX header on every file
(§1-1b) — **but the `LICENSE` file that would make that operative does not exist** (§1-1a).

| Option | Practical properties (factual — not advice) |
|---|---|
| **AGPL-3.0-or-later** *(what the code already says)* | Strong copyleft **including over a network**: anyone who runs a modified version **as a service** must offer its source. Derivatives must stay AGPL. **Interacts directly with D-001's "future proprietary layer"** — the owner can relicense their **own** code (they hold the copyright), but any outside contribution received under AGPL constrains that, and a proprietary SaaS built on an AGPL core is the classic friction point. Commonly paired with a **CLA** to preserve relicensing freedom. |
| **Apache-2.0** | Permissive + an explicit **patent grant**. Anyone may build a closed product on it, **including a competitor**. Maximally friendly to adoption; gives away the SaaS moat that D-001 anticipates. |
| **MIT** | Permissive, shortest, no patent grant. Same trade as Apache-2.0, minus the patent clause. |
| **BSL / source-available** | Source is public; **commercial/SaaS use is restricted**, usually converting to an open licence after N years. **Not an OSI open-source licence** — cannot be called "open source". Directly preserves the D-001 proprietary path. |
| **All-rights-reserved public source** | Readable, not licensed for reuse. Maximum control, minimum community. |

**Sub-decisions that ride with it:** does the **frontend** package get the same licence (`private: true`
and no `license` field today — §1-1c)? Is a **CLA** wanted? Is the **transitive dependency licence set**
audited before publishing (§1-1f — *not yet done, and a source release should not claim otherwise*)?

### RD-3 — R-24 (first-boot licence-acceptance gate)

Currently **parked**, with an **owner alternative pending** (`ROADMAP.md:38`). The ROADMAP already records
the design constraint: it **cannot** be a D-045 checklist step, because *skippable ≠ acceptance*.

| Option | Cost |
|---|---|
| **Not needed for a source release** | Cloning implies reading the LICENSE. Cheapest; conventional for open source. |
| **Blocking gate NOW** | A separate blocking gate mounting before the shell (not the skippable first-run overlay). Real build work + a ratified copy/authoring pass. |
| **Revisit at packaged (c)** | The gate matters most when the user never sees a repo. Defers cost; risks retro-fitting into a shipped install. |

*Dependent on RD-1 and RD-2 — a permissive licence weakens the case; BSL/all-rights-reserved strengthens it.*

### RD-4 — Supported platforms + the honest "tested on" statement
What do we **claim**, and what have we actually **run**? Evidence: Python `>=3.12` is pinned;
**Node is pinned nowhere** (§1-2f); `install.sh` has Pi-shaped defaults (`/mnt/...`, kiosk, systemd
units). Options range from *"tested on Raspberry Pi OS + Debian, x86-64 and arm64"* (narrow, honest) to a
broader claim that would need CI on those platforms — **which does not exist today**.
**Guarantee-adjacent:** a "tested on" line the project cannot back is the same class of defect as a
fabricated figure.

### RD-5 — Versioning scheme; what does `v2.0.0` tag?
Today: backend **3.24.0**, frontend **0.1.0**, product **"v2"**, **no tags, no CHANGELOG** (§1-4a/4b).
Options: (i) **one product version** across backend+frontend, reset to `2.0.0` (clear to users; discards
the inherited 3.24.0 lineage); (ii) keep the backend's lineage and version the *product* separately
(honest to history; **confusing in the API's own OpenAPI version field**); (iii) date-based. **Whatever is
chosen, `app/__init__.py:4` and `frontend/package.json:4` must stop disagreeing.** Changelog posture:
none / keep-a-changelog / release notes only.

### RD-6 — Upgrade & migration promise for **other people's** data
Alembic is **forward-only** and the chain is intact from empty (§1-2d). Open: is **downgrade** supported
(the migrations may define `downgrade()`, but *supported* is a promise, not a function)? Is
**backup-before-upgrade** *enforced* by `update.sh`, or merely *documented*? What is the promise if a
migration fails **on a stranger's data we cannot inspect**? Cost of the strong version (tested upgrade
path from every released tag) vs the weak one (*"back up first; forward-only; no downgrade"*, stated
plainly).

### RD-7 — Security disclosure + support posture
No `SECURITY.md`, no disclosure contact, no support statement exist. Options: a disclosure address
(a real inbox someone reads) vs *"no formal process"* stated honestly; GitHub issues **on** (expectation
management needed) vs **off** (a fork-and-go posture).
**This decision must also answer the §1-3 finding:** is the **unguarded price/FX/AI egress path** under
`privacy_mode` **release-blocking**? Guarantee 5 says *zero* outbound calls; the gate is not consulted
there. *(The plan's view, offered and not chosen: this is exactly the ND-2 class — a guard at the call
site with a fail-first test — and it is cheap. But whether it blocks the release is the owner's call.)*

### RD-8 — Demo data in the release
Today, `.env.example` ships `MARKET_PROVIDER=mock`, so a stranger's **default first boot is a seeded demo
instance** (§1-2g). Options: **(a)** keep demo-by-default (a great first impression; risks someone
mistaking synthetic holdings for a working import — though the **DemoBadge** chrome is always on);
**(b)** default to an **empty instance** and make the demo an explicit opt-in (`--demo-mode` already
exists in the installer); **(c)** ask at install time (the wizard already has the flag).

### RD-9 — Release scope vs the remaining pages
**Evidence, not a pick** (§1-6): **9 built, 10 unbuilt**, of which **Legal**, **Help** and **Settings**
are the ones a release would most visibly miss — **Legal** because a licensed release wants a licence
surface (ties to RD-2/RD-3); **Help** because the `[Help]` affordance already ships and points at a page
that does not exist; **Settings** because Home's layout control was *removed on the reasoning that
Settings would own such things*, and several allow-listed keys still have **no UI** (with the rotation
keys **write-only** — an open D-078 violation already in `08-TECH-DEBT.md`).
Options: **(a)** wait for the whole queue; **(b)** v2.0 = the built set + a visible roadmap, with
Legal/Help (and possibly Settings) as the **only** release-blocking additions; **(c)** some middle cut.

### RD-10 — Repo publication hygiene
`docs/` is **3.9 MB / 62 files** and today would ship whole — including **`docs/plans/`** (build plans,
owner-walk transcripts, retrospectives) and **`docs/evidence/`** (19 screenshots) (§1-5c).
Options: ship everything (**radical transparency** — it is genuinely a strong artefact, and the page-home
§13 retrospective is a good advertisement for how the thing was built); split internal plans into a
private repo; or keep `docs/specs/` public and plans private. **History scrub:** on the evidence, **none
appears necessary** (§1-5a/5b) — but a formal secret-scan over full history is a **checklist item**, not
a claim this plan is entitled to make. Separately: publishing the repo publishes the **author email** in
every commit (§1-5d) — reversible only by rewriting history, and not at all once mirrored.

---

## 3. CHECKLIST SKELETON — *conditional; gated; derived FROM §2 once resolved*

**Nothing here is actionable until §2 is resolved.** Items marked **`[per RD-N]`** cannot even be *written*
until that decision lands. Every gate that produces **authored copy, a visual, or a legal artefact**
carries an owner **STOP** (PROPOSED → ratify), per the loop's conventions.

**Gate A — Legal foundation `[per RD-2, RD-3]`**
- [ ] `LICENSE` file added — **the text must match what the code already claims**, or every SPDX header and `pyproject.toml:7` is corrected in the same commit. **No drift between the two.** **STOP: owner ratifies the licence.**
- [ ] Frontend `package.json` licence field reconciled (`private: true` today) `[per RD-2]`
- [ ] **Transitive dependency licence audit** — actually run, not asserted (§1-1f). Copyleft findings recorded.
- [ ] `NOTICE` / third-party attributions **`[per RD-2]`**
- [ ] **Legal page** built, if release-blocking **`[per RD-9]`** — via `TEMPLATE-page-build.md`. **STOP.**
- [ ] R-24 acceptance gate **`[per RD-3]`** — build / defer / strike, recorded either way.

**Gate B — Install truth**
- [ ] **README rewritten as an INSTALL guide** for a stranger (it is a dev doc today, §1-2c). **STOP: owner ratifies the copy.**
- [ ] **Fix the data-dir divergence (§1-2e) — one resolution path, not four.** Fail-first: a test that a script honours `LEDGERFRAME_DATA_DIR` from `.env`, RED before. *(Not decision-dependent: this is a defect under every option.)*
- [ ] Node version pinned (`engines` / `.nvmrc`) — nothing pins it today
- [ ] Fresh-clone → install → first boot rehearsed **on a clean machine**, from the README alone
- [ ] Empty-data-dir first boot **kept green** (it works today, §1-2d) — pinned by a test
- [ ] Backup / restore / move-my-data **documented where a user will look** (§1-4d) **STOP: copy.**
- [ ] Container path verified **`[per RD-1b]`** · packaging + signing **`[per RD-1c]`**

**Gate C — Security, for strangers**
- [ ] **Decide the egress finding (§1-3): is the unguarded price/FX/AI path release-blocking?** **`[per RD-7]`** If yes: guard at the call site, **fail-first test**, ND-2 class.
- [ ] **SECURITY-BASELINE re-issued with a DISTRIBUTION column** — every "Accept (ADR)" restated for the stranger case (§1-3). **STOP: owner ratifies the posture.**
- [ ] The **no-PIN + LAN** combination (gap 7) given an explicit release stance — refuse, warn, or document
- [ ] `SECURITY.md` + disclosure contact **`[per RD-7]`**
- [ ] Full-history secret scan **run** (not assumed — §1-5e)

**Gate D — Identity**
- [ ] **One product version**; `app/__init__.py` and `frontend/package.json` **stop disagreeing** **`[per RD-5]`**
- [ ] Tag + changelog **`[per RD-5]`**
- [ ] Upgrade/migration promise **written and tested** **`[per RD-6]`**
- [ ] Demo-data default set **`[per RD-8]`** (`.env.example` + installer flag agree)

**Gate E — Scope + publication**
- [ ] Release scope frozen **`[per RD-9]`**; the roadmap for what is *not* in it is **public and honest**
- [ ] Nav: unbuilt pages either **shipped, hidden, or honestly labelled** (they render `NotBuilt` today)
- [ ] `docs/plans` + `docs/evidence` disposition **`[per RD-10]`**
- [ ] "Tested on" statement **`[per RD-4]`** — **claims only what was actually run**
- [ ] Final: **the release notes may not fabricate a capability**, exactly as the product may not fabricate a figure (Guarantee 3, applied to ourselves).

---

**STOP — §2 is the owner's, in one pass. Nothing in §3 begins until it is resolved, and this plan does
not pause the page queue (Policy is next, in parallel).**

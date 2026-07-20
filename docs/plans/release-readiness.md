# release-readiness.md — defining the finish line

**Status: ⏸ GATES C–F STANDING/DORMANT. GATE A CLOSED (+ A9–A11 addendum) · GATE B CLOSED
(owner-ratified). RELEASE REQUIRES FULL COMPLETION (RD-9 Amendment 3, as REFINED by Amendment 4 and
EXTENDED by Amendments 5 + 6, owner 2026-07-18, by Amendment 7, owner 2026-07-20, by
Amendment 8, owner 2026-07-20, and by **Amendment 9, owner 2026-07-20** — Voice is POST-RELEASE; the v2.0.0 set is enumerated below,
now incl. R-45 + R-46 + R-43 (with R-8) + R-54 + R-55 + R-57 + **R-58**; the R-41/R-43/R-44 ruling is now RESOLVED by Amendment 6 — R-43 IN, R-41 + R-44
POST-RELEASE).**

> ## ⚠ RD-9 SCOPE AMENDMENT 9 (owner, 2026-07-20, chat) — **v2.0.0 scope += R-58.** *(Filed from the F10 census.)*
>
> The enumerated set grows by one — **R-58** (the `settings.key` check-then-insert race at the four
> filed sites outside `get_history_cached`; `ROADMAP.md` R-58).
>
> **Origin — a census, not a bug report.** The F10 delta was required to sweep `app/` read-only for
> the *shape* of the defect it fixed, rather than stopping at the site that was reported. It found
> **four more**, none of them touched in that delta by ruling: `briefing.py:201-207` (a **generic
> helper**, so the widest blast radius and the one to take first), `feeds.py:72-78`,
> `settings.py:131-135`, `system.py:617-621` — plus `seed/demo.py:327` as an **adjacent variant**
> (unconditional insert, no SELECT).
>
> **Severity, stated rather than implied: none of the four sits on a guaranteed-concurrent path**, so
> unlike F10 this is **not release-train blocking**. It is in scope because the defect class is
> **proven to 500 a real request**, the repair is a **known, tested primitive** (F10's `_claim_marker`),
> and shipping v2.0.0 with four known instances of a race the same release just fixed is the kind of
> gap the enumerated set exists to close.
>
> **Sequencing: after R-54** (architect sequencing under standing delegation, 2026-07-20 —
> **reversible**; an ordering judgement, not a scope ruling).
>
> **The release gate remains FULL COMPLETION of the enumerated set (Amendment 3).**

> ## ⚠ RD-9 SCOPE AMENDMENT 8 (owner, 2026-07-20, chat) — **v2.0.0 scope += R-57.** *(Filed at the AI-surfaces close review.)*
>
> The enumerated set grows by one — **R-57** (AI model management, Settings › AI; `ROADMAP.md` R-57).
>
> **Origin, and it is the same origin as Amendment 7's:** the owner asked, at the close review, **how
> a user configures an external OpenAI-compatible endpoint** — and the answer today is
> **environment only**. The AI tab says so in its ratified sentence (*"Model management is not
> configurable here yet"*), so the product is **honest about a gap it does not close**. Honesty about
> a gap is the right interim state; it is not a substitute for the surface.
>
> **Sequencing: after R-54, before R-55** — same surface (Settings › AI), and **R-54's posture-copy
> amendment lands first so R-57 edits settled strings** rather than moving ones. *(Architect
> sequencing under standing delegation, 2026-07-20 — **reversible**; it is an ordering judgement, not
> a scope ruling.)*
>
> **The release gate remains FULL COMPLETION of the enumerated set (Amendment 3).**

> ## ⚠ RD-9 SCOPE AMENDMENT 7 (owner, 2026-07-20) — **v2.0.0 scope += R-54, R-55.** *(Filed at the AI-surfaces Phase-0a walk.)*
>
> **Both rows were raised by the owner USING THE SHIPPED 0a SPECIMEN**, which is the amendment's
> whole justification: they are not new ideas bolted onto a frozen scope, they are **what looking at
> the built thing revealed the built thing is missing**.
>
> - **R-54 — Deterministic answer intelligence (the two-tier Ask panel): ⚡ IN v2.0.0.** Owner's
>   rationale: **most of the Ask panel's value needs no model at all**, and *"a clear call-out of what
>   the inbuilt AI can do without egress is great value in itself, with the ethos of Privacy as the
>   core of the solution."* Tier 1 makes **zero network calls by construction**, so the panel goes
>   **LOCAL, not dark**, under no-egress. This is release-relevant rather than cosmetic: **the panel
>   as shipped at 0a is honest but thin in the posture the product is built to be proud of.**
> - **R-55 — Help content: asset classes & corporate actions: ⚡ IN v2.0.0.** Owner's rationale:
>   **missing coverage of the two subject areas a user most needs Help for.** Note the boundary
>   against R-51 (⛔ post-release): **R-51 is `[Help]`-mark parity; R-55 is subject coverage** — and
>   R-55 is bounded by the **verify-first hard gate**, so it can only ever document shipped
>   behaviour.
>
> **Relationship to Amendment 3 (RELEASE = FULL COMPLETION).** Amendment 3 is unchanged and is what
> makes this an amendment at all: because release requires the **enumerated set complete**, adding a
> row **moves the finish line**, and that is a ruling only the owner can make. It is recorded here so
> the finish line is never inferred from a roadmap status cell.
>
> **The v2.0.0 set is now:** all pages DONE + Settings + data-feed-routing (R-38) + intraday-series
> (R-42) + R-43 (with R-8) + Help + Legal + AI-surfaces (D-067/D-068) + R-45 + R-46 + **R-54** +
> **R-55** + chrome-sidebar-refresh (R-39, FINAL) + Gates C→F clear. (R-41 + R-44 + R-50 + R-51 +
> R-53 remain POST-RELEASE.) ROADMAP status cells filed for R-54 / R-55.
>
> **Neither row is started by this amendment.** Both carry the **plan-file gate standard**: own plan
> file, survey-first, a §9 one-pass with the owner, then the full loop. Cross-ref: ROADMAP R-54,
> R-55; ai-surfaces §12.

> ## ⚠ RD-9 SCOPE AMENDMENT 6 (owner, 2026-07-18) — **the R-41 / R-43 / R-44 ruling: R-43 IN (with R-8); R-41 + R-44 POST-RELEASE.**
>
> **RESOLVES the "STILL PENDING" R-41 / R-43 / R-44 release-scope ruling left open by Amendment 5
> (below, preserved).** Recorded at the **data-feed-routing (R-38) POST-CLOSE DELTA D1** session.
> Owner rulings 2026-07-18, with the owner's stated rationales:
>
> - **R-43 — Historical valuation backfill: ⚡ IN v2.0.0.** Rationale: **Time-to-Value / first-open
>   credibility** — a flat/linear Net-worth trend undermines the first open. **Includes the Net-worth
>   snapshot-now trigger.** **Hard-depends on R-8 (historical FX)** → **R-8 becomes in-scope with it**
>   (pulled into v2.0.0 as R-43's dependency).
> - **R-41 — Per-provider credentials: ⛔ POST-RELEASE.** Rationale: **YAGNI** — no felt friction until
>   a second keyed provider is actually in use; the shared key slot + active-marker honesty holds until
>   then.
> - **R-44 — News thumbnails: ⛔ POST-RELEASE.** Rationale: **cosmetic**; a **new egress surface** that
>   **can ride the R-45 egress ruling later** (same decision class).
>
> **Sequencing (architect, under owner delegation — owner may override):** **R-43 immediately after
> intraday-series (R-42), before Help** — R-42 and R-43 grow the **same history store**, so the
> storage/keying decisions should be made **adjacently**.
>
> **The v2.0.0 set is now:** all pages DONE + Settings + data-feed-routing (R-38) + intraday-series
> (R-42) + **R-43 (with R-8)** + Help + Legal + AI-surfaces (D-067/D-068) + **R-45** + **R-46** +
> chrome-sidebar-refresh (R-39, FINAL) + Gates C→F clear. (R-41 + R-44 are POST-RELEASE.)
> ROADMAP status cells updated for R-8 / R-41 / R-43 / R-44.

> ## ⚠ RD-9 SCOPE AMENDMENT 5 (owner, 2026-07-18) — **v2.0.0 scope += R-45, R-46.**
>
> **EXTENDS Amendment 4 (below, preserved): the v2.0.0 set gains two owner-raised items.** Recorded at
> the **data-feed-routing (R-38) close**. Owner ruling, in chat: *"All of these need to align (to be
> done) before release."*
>
> - **R-45 — Per-instrument + default news coverage.** Owner-raised 2026-07-18 (R-38 Phase 3b re-walk).
>   Per-instrument news source + default-coverage expansion; egress ruling required (P-8 symmetry,
>   no-egress conditional). See the ROADMAP R-45 row.
> - **R-46 — Home summary cards (post-close pages).** Owner-raised 2026-07-18. Cash-flow runway ·
>   liquidity what-ifs · upcoming insurance renewals · goal progress. Summarise-with-reader only (IA
>   ownership tables). See the ROADMAP R-46 row.
>
> **The v2.0.0 set is now:** all pages DONE + Settings + data-feed-routing (R-38) + Help + Legal +
> AI-surfaces (D-067/D-068) + **R-45** + **R-46** + chrome-sidebar-refresh (R-39, FINAL) + Gates C→F
> clear.
>
> ### ~~⚠ STILL PENDING with the owner (do NOT resolve): the **R-41 / R-43 / R-44** release-scope ruling.~~ **RESOLVED by Amendment 6 (above), owner 2026-07-18.**
>
> ~~R-41 (per-provider credentials), R-43 (historical valuation backfill), and R-44 (news thumbnails) are
> **release-scope CANDIDATES** raised by R-38; the owner has **not yet ruled** whether they gate v2.0.0.
> Recorded as **PENDING**, verbatim — unresolved until the owner rules.~~ (R-45/R-46 above ARE ruled in.)
> **Amendment 6 now rules: R-43 IN (with R-8); R-41 + R-44 POST-RELEASE.**

> ## ⚠ RD-9 SCOPE AMENDMENT 4 (owner, 2026-07-18) — **the v2.0.0 set is ENUMERATED; Voice (R-32) is POST-RELEASE.**
>
> **REFINES Amendment 3 (below, preserved): the FULL-COMPLETION gate STANDS, but its set is corrected.**
> Amendment 3 listed **Voice** inside the release gate; Amendment 4 **moves Voice to post-release** and
> pins the exact v2.0.0 set. Recorded at the **Settings milestone close** (page-settings §14 CLOSED).
>
> ### The v2.0.0 release set (owner-ruled 2026-07-18):
>
> > **v2.0.0 = all pages DONE + Settings + data-feed-routing (R-38) + Help + Legal + AI-surfaces
> > (D-067/D-068) + chrome-sidebar-refresh (R-39) + Gates C→F clear (this file).**
>
> - **data-feed-routing (R-38)** is **pulled forward as the NEXT milestone** (its own plan file,
>   `docs/plans/data-feed-routing.md`; plan-only kickoff filed at this close).
> - **chrome-sidebar-refresh (R-39)** is the **FINAL pre-release milestone** (page-settings §14st-3;
>   sequenced after Help · Legal · AI-surfaces).
> - **Gates C→F still clear against the FINAL set** — a scan of something other than what ships is not a
>   scan (Amendment 3's rule stands).
>
> ### ⚠ Voice (R-32) is POST-RELEASE — BY OWNER RULING (2026-07-18):
>
> **Voice does NOT gate v2.0.0.** Amendment 3 named it a release-scope gate; the owner now rules it
> **post-release**. **Its definition remains OWED** (ROADMAP R-32 — DEFINITION PENDING) and it **gates
> whichever release ships it**, not v2.0.0. No Voice behaviour is invented by moving it — it is still
> undefined; it is simply no longer in the v2.0.0 gate. Mirrored in the R-32 ROADMAP annotation.

> ## ⚠ RD-9 TIMING AMENDMENT 3 (owner, 2026-07-14) — **RELEASE = FULL COMPLETION. Gates C–F return to STANDING/DORMANT.** *(REFINED by Amendment 4 above — Voice moved to post-release; the set enumerated.)*
>
> **SUPERSEDES Amendment 2, which is preserved struck through below.** A superseded ruling is struck
> through, never deleted.
>
> ### The owner CORRECTS the release gate. Recorded verbatim:
>
> > **NO public release before ALL of** — Help, Legal, Policy, Cash flow, Scenarios, Insurance, Estate,
> > Accounts, Reports (+ Pack), Settings, the **AI-surfaces milestone** (D-067/D-068/R-22), and
> > **Voice**.
>
> **This is a SCOPE correction, not a timing slip.** RD-9's original resolution **(b)** — *"v2.0 = the
> built set + a visible roadmap; unbuilt Planning pages are bypassed for launch"* — **is overturned.**
> v2.0 now means **the whole product**, not the built subset with the rest on a roadmap.
>
> - **Gates C–F return to STANDING / DORMANT.** They **reactivate only when the full set above is
>   OWNER-ACCEPTED**. Nothing is started from them.
> - **Legal and Help no longer jump the queue.** They are still **release-blocking** — every page is,
>   now — and they return to **merit order** in the queue (`CURRENT.md` NEXT).
> - **The Planning group returns to the FRONT of the queue.** **Policy resumes first** (its §9 one-pass).
> - **E2 (secret/PII scan) and E4 (licence adjudication) run against the FINAL set** — which is now a
>   much later, much larger set. A scan of something other than what ships is not a scan.
> - **D3 tags `v2.0.0`** only after the full set is accepted **and** Gates C–F clear.
>
> ### ⚠ **Voice is NEW SCOPE. No spec exists.**
>
> **Voice has been named as a release-scope gate, and it is the only item in that list with no
> definition anywhere** — no spec, no decision, no plan file, no ROADMAP entry before today. It is
> recorded as **ROADMAP R-32 — DEFINITION PENDING (owner)**, and it **requires an owner definition and
> its own milestone plan before the release gate can even be EVALUATED against it.**
> **No Voice behaviour has been invented here.** *(A `voice` extra — vosk/sounddevice — exists in
> `pyproject.toml` and `install.sh` offers it, but nothing in the specs says what Voice IS. That is an
> installer option, not a definition, and it is not treated as one.)*
>
> **What this changes about Gates A and B:** nothing. Both stay CLOSED. **Gate A's A9–A11 addendum stands
> and was correct to ship** — those were defects in release-set code that Review already ships, and they
> would have been defects under any release scope.

> ## ~~✅ RD-9 TIMING AMENDMENT 2 (owner, 2026-07-14) — RELEASE INTENT DECLARED. Gates C–F REACTIVATE.~~
> ### **SUPERSEDED by Amendment 3 (above), 2026-07-14. Preserved for history — do not act on it.**
>
> ~~**SUPERSEDES Amendment 1 (the deferral), which is preserved verbatim below.**~~
>
> ~~**v2.0 proceeds NOW on the RD-9(b) scope: the built set + a visible roadmap.** The checklist is an
> **ACTIVE COUNTDOWN** again.~~
>
> - ~~**Gates C–F are LIVE.** C3/D/E/F execute per the checklist.~~
> - ~~**Legal and Help are RELEASE-BLOCKING and JUMP THE QUEUE** — the gate did not move, the deadline
>   arrived. (This restores the ORIGINAL RD-9 resolution; Amendment 1's B12 re-ordering is reverted.)~~
> - ~~**The Planning group moves POST-RELEASE.** Policy's plan is DRAFTED and **PARKED AT §9**.~~
> - ~~**E2 and E4 still run against the FINAL set** — that is now imminent, not hypothetical.~~
> - ~~**D3 tags `v2.0.0` at the moment of publication, not before.**~~
>
> ~~**What this changes about Gates A and B:** nothing — except that **Gate A gains an addendum
> (A9–A11)**, three release-set defects surfaced by the page-policy verify-first pass.~~ *(The A9–A11
> addendum SURVIVES Amendment 3 — see above. Only the timing/queue rulings are struck.)*

> ## ~~⚠ RD-9 AMENDMENT 1 — TIMING (owner, 2026-07-14). The public release is DEFERRED.~~
> ### **SUPERSEDED by Amendment 2 (above), 2026-07-14. Preserved for history — do not act on it.**
>
> ~~**v2.0 does not ship until the full page queue completes.** This checklist is therefore **NOT an
> active countdown** — it becomes a set of **STANDING GATES**.~~
>
> - ~~**Gates C–F remain derived and DORMANT.** No page is started from this plan.~~
> - ~~**E2 (secret/PII scan) and E4 (licence adjudication) re-run against the FINAL set at actual release
>   time** — not now. A scan of something other than what ships is not a scan, and a licence ruling can
>   go stale.~~
> - ~~**D3 tags `v2.0.0` only at that point.**~~
> - ~~**Legal and Help REMAIN release-blocking** whenever release intent is declared. Deferring the
>   release moves the deadline; it does not remove the gate.~~
>
> ~~**What this changes about Gate A and B:** nothing. Everything in them was a **defect fix or a true
> statement**, and neither expires because the release date moved. *(The original RD-9 resolution — v2.0
> = the built set + a visible roadmap — is preserved below; the SCOPE ruling stands, only the TIMING is
> amended.)*~~
Two **decision-independent defects** were fixed immediately (Part B — see §2A): the **data-dir
divergence** and the **Guarantee-5 egress gap**. Nothing else in §3 has been started.

This is **not** a page plan — it does not use `TEMPLATE-page-build.md`'s structure. It borrows its
**conventions**: verify-first with `file:line` evidence, a numbered **NEEDS DECISION** section resolved by
the owner in one pass, and a **STOP** before anything is built.

**Its job, in order:** (1) audit the repo's release posture **as it actually exists**; (2) lay out the
**owner's** definition-of-release decisions with evidence and honest costs; (3) derive a gated checklist
**from those decisions once they are made**. **The definition of "release" is the owner's.** This plan
surfaces options and decides nothing.

**It does NOT pause the page queue.** *(Current ruling — **RD-9 Amendment 3**: the release gate is **FULL
COMPLETION**, so this plan **does not lead the queue and does not schedule it**. Gates C–F are **dormant**
until the owner accepts the full set. The work order is `CURRENT.md` NEXT — **Policy resumes first**. The
plan defines the finish line; it does not move it, and it no longer pretends to be near it.)*

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

## 2A. §2 RESOLUTIONS — owner, one pass (2026-07-14)

*Resolution first; the considered options are preserved in §2 below, unchanged. Every pairing was
matched to its §2 item by **number and topic** before recording — no guesses.*

| # | Topic | RESOLVED |
|---|---|---|
| **RD-1** | What "first public release" means | **(a) SOURCE RELEASE first.** Container = a **fast-follow milestone**; packaged binaries **deferred**. Sequencing officially recorded. **The installer codebase is confirmed sufficient for the initial release** (§1-2a). |
| **RD-2** | Licence | **CONFIRM AGPL-3.0-or-later + a Contributor Licence Agreement (CLA).** Keeps open-source integrity for the community while preserving the owner's legal pathway to **dual-license a future proprietary SaaS/hosted engine** under D-001. **Ride-alongs regardless of anything else:** create the root `LICENSE` file; instantiate the frontend `license` field; and make a **dependency-licence compliance audit RELEASE-BLOCKING** — *no public claim may be published before it runs clean*. **The CLA text is an OWNER-AUTHORED artefact behind an owner-STOP gate — never drafted-and-shipped by automation.** Recorded as an **operational alignment decision, not formal legal counsel.** |
| **RD-3** | R-24 licence-acceptance gate | **Not needed for a source release.** R-24 **remains parked**; the *revisit-at-packaged* milestone dependency is recorded in `ROADMAP.md`. |
| **RD-4** | Platforms / "tested on" | **Narrowest TRUE claim.** Enumerate only the exact host OSes and architectures that have **actually completed clean test suites**. **Pin the Node execution version.** **No CI-backed ecosystem claims until a real CI pipeline exists.** |
| **RD-5** | Versioning | **ONE unified product version: `2.0.0`.** Synchronise backend `__init__`, frontend `package.json`, and the **OpenAPI version field**. **Tag `v2.0.0` at the moment of public release.** New `CHANGELOG.md` (Keep-a-Changelog); **the inaugural entry must explicitly declare the version RESET from the inherited v1 lineage (`3.24.0`) — historical honesty, not a silent renumber.** |
| **RD-6** | Upgrade / migration | **Forward-only.** Downgrade paths **explicitly unsupported**. `update.sh` must **abort unless it detects a fresh DB backup**, or is given an explicit `--no-backup` override. State the policy in the README. |
| **RD-7** | Disclosure + support | `SECURITY.md` pointing to **security@ledgerframe.org**. **A mailbox-verification gate is MANDATORY *before* SECURITY.md ships claiming that address** — *an unmonitored disclosure inbox is the same defect class as an untested "tested-on" claim*. GitHub Issues **enabled**, with a visible disclaimer defining support boundaries and response expectations. **The Guarantee-5 egress gap is a CRITICAL RELEASE-BLOCKER** → fixed now (Part B/2). |
| **RD-8** | Demo data | **Default first boot is EMPTY.** The installer wizard prompts explicitly; **`--demo-mode` is the only opt-in** for mock portfolios. `.env.example` must be adjusted so that **the default mock price provider no longer implies pre-seeded portfolio rows** — today `is_demo` (provider == mock) *is* the seed trigger (`app/main.py:114-123`), and those two things must be **decoupled**. |
| **RD-9** ⚠ **OVERTURNED 2026-07-14 by TIMING AMENDMENT 3 — the resolution below is HISTORY, not the ruling in force. The release gate is now FULL COMPLETION (every page + AI surfaces + Voice); no page is "bypassed for launch". Read the amendment at the top of this file.** | Scope vs remaining pages | ~~**(b) v2.0 = the built set + a visible roadmap.**~~ Unbuilt **Planning** pages are bypassed for launch. **Legal and Help are ELEVATED TO RELEASE-BLOCKING and jump the queue** (to prevent shipping dead interface links) → `CURRENT.md` NEXT becomes **Legal · Help · then the residual Planning pages**. **Settings is unblocked.** To maintain strict **D-078** compliance, the **write-only rotation keys are REMOVED from the codebase pre-release** via a **backend-first contract delta (spec regenerated in the same commit)**, reintroduced only when functional rotation UI ships. |
| **RD-10** | Publication hygiene | **Publication isolation.** The working repo stays **private**. `v2.0.0` is published as a **clean public repository**. **`docs/specs/` (the six core specs) IS included** as authoritative architectural documentation. **`docs/plans/` and `docs/evidence/` are excluded entirely.** A mandatory publication-hygiene step runs an **automated secret / PII scan across the public staging branch**. |

### Part B — the two DECISION-INDEPENDENT defects: **FIXED** (they were defects under every option)

**B/1 — data-dir divergence → ONE resolution path.** The repo had **five** answers to *"where is the
data dir?"*, and **only one of them read `.env`**: `doctor.sh:8` and `benchmark.sh:8` defaulted to
`/mnt/ledgerframe-data`; `reset-demo-data.sh:7` and `start-dev.sh:8` to `$REPO_DIR/data`; `update.sh:93`
`sed`-ed it out of `.env`; and `app/core/config.py:40` read it properly. The bash scripts read only the
**exported** variable — so a user who set `LEDGERFRAME_DATA_DIR` in `.env` (**the documented contract**)
and ran `./scripts/reset-demo-data.sh` from a plain shell hit that script's own fallback and **operated
on the wrong directory**. *A destructive script pointed at a directory the user never named is not a
papercut.* → **`scripts/lib/datadir.sh`** is now the one answer, sourced by every consumer, with
precedence identical to the app's (exported → `.env` → one documented default) and **that default
pinned by test to `app/core/config.py`'s**, so they can never drift apart again — otherwise the
primitive would simply have become a **sixth** answer. **Fail-first: 16 of 18 assertions RED.**

**B/2 — Guarantee 5 was not being kept.** `no_egress_enabled` was consulted from **news, briefing,
markets-news and version-check only**; **every other outbound path ignored it** — the price providers
(kite · eodhd · yahoo · external · coingecko · amfi), the **ECB FX feed**, and **both AI providers**.
Under `privacy_mode` a price refresh, an FX refresh or an **AI call carrying your figures** still went
out. It looked fine only because a no-egress user usually also runs `market_provider=mock` — **a
configuration coincidence, not a guard.** → **`app/core/egress.py` is now the ONLY way to obtain an
HTTP client**; under no-egress it **never constructs one** (no socket, no DNS, no timeout) and raises
`EgressBlocked`, which the services already treat as *withheld, with a reason* (Guarantee 3). *A guard
you must remember to call is a guard you will eventually forget* — so it is **structurally enforced**:
constructing an `httpx.AsyncClient` **anywhere outside the gate is a test failure**. **Fail-first with a
LIVE provider configured**: the tripwire fired (*"an HTTP client was CONSTRUCTED while no-egress is
on"*) on coingecko, AMFI, ECB FX and the AI chat path. *Also found and fixed: the AI chat path's
**non-streaming retry** was making a **second** outbound attempt on a refusal — a refusal is not a
transient error to retry.* **SECURITY-BASELINE.md now carries the outbound-call inventory as the master
enforcement record.**

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

## 3. RELEASE CHECKLIST — **DERIVED from §2A. NOT EXECUTED.**

**Owner reviews this tracking matrix before any item is started.** Nothing below has been done except
the two items marked **✅ DONE (Part B)** — the decision-independent defects.

**Legend.** 🧑 **OWNER-AUTHORED** — the owner writes it; automation may not draft-and-ship it.
🤖 **BUILDABLE** — automation can do it, fail-first where it is code. 🛑 **OWNER-STOP** — a gate that
does not pass without explicit owner sign-off. 🚫 **RELEASE-BLOCKER**.

> **AUTHORSHIP AMENDMENT (owner, 2026-07-14).** **B5 (README), B8 (SECURITY.md) and B10 (Issues
> disclaimer)** convert from 🧑 OWNER-AUTHORED to **🤖 draft-PROPOSED → 🛑 owner-ratify** — the project's
> standard copy pattern.
> **B2 (CLA text) and B6 (tested-on) do NOT convert.** The RD-2 bar on automation drafting CLA text
> **remains in force**, and automation must not enumerate platforms it has not verified.
> *(Nothing to discard: **no CLA text was ever drafted** under the prior instruction.)*

**Strict sequencing — a gate does not open until the one before it is closed:**
**A. Core defects → B. Docs sync → C. Legal + Help pages → D. Version & tag → E. Public hygiene scan
(runs LAST, against the ACTUAL final public set) → F. Public ingestion.**

---

### GATE A — Core defect resolution *(must close first: everything downstream describes the code)*

| # | Item | Who | Notes |
|---|---|---|---|
| A1 | **✅ DONE** — data-dir divergence: one shared resolver, sourced by every script; default pinned by test to the app's | 🤖 | 16/18 assertions RED first. `scripts/lib/datadir.sh` |
| A2 | **✅ DONE** — 🚫 **Guarantee-5 egress gate** [per RD-7]: one choke point; a client cannot be constructed outside it | 🤖 | RED with a **live provider** configured, on coingecko / AMFI / ECB FX / AI chat |
| A3 | 🚫 **Remove the write-only rotation keys** (`rotation_pages`, `focus_page`) — **backend-first contract delta, spec regenerated IN THE SAME COMMIT** [per RD-9] | 🤖 | D-078: a key that is written and never read must be **consumed or removed**. Fail-first: the key is **accepted** before, **400** after (the `home_layout` precedent, page-home §12ho1-6). Reintroduce only when rotation UI ships. Already logged in `docs/audit/08-TECH-DEBT.md` |
| A4 | **✅ DONE** — demo seed decoupled from the mock provider; **default first boot is EMPTY** [per RD-8] | 🤖 | `LEDGERFRAME_DEMO_SEED` (default **false**) is now its own decision. Mock **PRICES** ≠ seeded **PORTFOLIO ROWS** — only the second invents the user's money. `--demo-mode` is the sole opt-in. **Fail-first: booting the real app with the SHIPPED defaults seeded rows — RED.** *(conftest now asks for the seed explicitly: the suite wanted it, but it used to arrive as the same accident.)* |
| A5 | **✅ DONE** — `.env.example` states the seed setting explicitly [per RD-8] | 🤖 | Pinned by test: the shipped template **cannot** quietly imply a seeded portfolio |
| A6 | **✅ DONE** — `update.sh` **aborts** without a fresh backup; `--no-backup` to override [per RD-6] | 🤖 | It used to `backup.sh \|\| log "skipped"` — **try, swallow the failure, migrate anyway**. Forward-only with no downgrade means **the backup IS the rollback story**. `scripts/lib/backup_gate.sh`; a **stale** backup is not a backup. **6 RED**, including *the gate must run BEFORE the migration* — a gate that fires after it is not a gate |
| A7 | **✅ DONE** — Node pinned (`engines` + `.nvmrc`), and a **false claim removed** [per RD-4] | 🤖 | `install.sh` told users **"Node 18+"** — **already false**: vite's floor is `^20.19 \|\| >=22.12`. Following our own instructions would have left them unable to build. Floor now quoted **from vite itself** and pinned by test. **3 RED** |
| A8 | **✅ DONE — CLEAN (zero UNADJUDICATED findings)** [per RD-2] | 🤖 audit → 🧑 **OWNER** rules | `scripts/license_audit.py` walked **381 packages** (§1-1f had only ever read the ~16 **direct** ones). **"Clean" means ZERO UNADJUDICATED FINDINGS — never "zero findings":** the graph still contains copyleft, and every instance of it now carries a **recorded owner ruling** in `scripts/license-adjudications.toml` — **adjudication is an artifact, not a conversation.** Owner rulings (2026-07-14, all ACCEPT): **`certifi` MPL-2.0 (RUNTIME)** — unmodified dependency, file-level weak copyleft, §3.3 GPL-family Secondary-Licenses compatibility, not vendored, a source release does not redistribute it; *operational alignment, **not legal counsel** — flagged for optional counsel confirmation alongside the CLA*. **`pathspec` MPL-2.0, `argparse` Python-2.0, `caniuse-lite` CC-BY-4.0** — **dev-only**, not part of the distributed product. **70 platform-conditional** packages (declared-but-not-installed) across **21 ruled families**; upstream licences **read from the registry, not assumed** — one of them (`lightningcss`, MPL-2.0) is a real finding inside the category, which is why it is enumerated rather than waved through. **Stale rulings are findings too.** **Fail-first, three states proven:** RED with no rulings · GREEN with them · **RED again when a ruling's `licence` is mutated** — a rubber stamp that outlives what it stamped is worse than no stamp. **E4 re-runs the SAME mechanism against the final public set.** |

### GATE A — ADDENDUM (owner-approved 2026-07-14) — three release-set defects from `page-policy.md` §10

The **Policy PAGE is parked post-release**, but these three defects are in **`services/policy.py` /
`services/review.py` / the API** — code that **IS** in the release set and that **Review already ships**.
A parked page does not park its engine's defects. Each was **fail-first** and shipped in **one commit**.

| # | Item | Who | Notes |
|---|---|---|---|
| A9 | **✅ DONE** — `bucket` must reference its dimension's **master**; unknown bucket → **400** with honest detail | 🤖 | **RED first: a garbage bucket was ACCEPTED — `assert 200 == 400`.** `replace_targets` validated the DIMENSION but stored `bucket` as **free text** (`bucket[:40]`) — a **free-text enum on a categorical field**, which CLAUDE.md's hard rule forbids; it silently inflated `coverage_pct` with a bucket no holding can match. **A `MasterSelect` cannot close a hole an API token can still drive.** Masters: AssetClass (13) · the currency master · REGIONS (6, D-083). Buckets are stored in the **master's spelling**, so `"sgd"` can never enter as a second `SGD`. ⚠ **Recorded, not papered over: MASTER-DATA §3 describes a currency master TABLE with `is_base_eligible`; no such table exists in code** — `SUPPORTED_CURRENCIES` (`config.py:18`) is the de-facto master and is what A9 validates against. Spec-vs-code divergence → owner. |
| A10 | **✅ DONE** — a drift **verdict** computed off **stale/low-confidence** prices can no longer present as **fresh** | 🤖 | **RED first: `KeyError: 'stale_inputs'`** — a stale-priced fixture produced a confident *"is OVER its band"* verdict with **nothing to flag it**. `compute_drift` surfaced **zero** staleness/confidence. **Guarantee 3 does NOT exempt a verdict just because it is DERIVED.** Now consumes the **same rules every other reader honours** (stale priced holding; the `<50` band, PRODUCT-SPEC §5). **Served (PROPOSED — 🛑 OWNER ratifies wording):** `/policy/drift` + `stale_inputs`, `low_confidence_inputs`, `inputs_stale`, `inputs_note`; `/review` `sections.policy` + `stale_inputs`, `inputs_stale` — **from the SAME reader, so the two cannot disagree** (pinned by test). Figures are still **shown**, never hidden. ⚠ **The guard found a REAL thing in the SHIPPED demo fixture** (a manually-valued holding below the confidence band) — the first test asserted the convenient fiction and was **corrected to assert what is true**. **No new Review attention item** (the existing stale-prices signal already covers it; a second would double-report) — owner may rule otherwise. |
| A11 | **✅ DONE** — **ONE weight derivation**: policy drift reads Portfolio's canonical `allocation()` | 🤖 | **COST CALL: consolidation was LIGHT — no STOP.** The only blocker was that `region` was derived inside policy's private loop rather than being an attribute; exposing `HoldingValue.region` made all three dimensions ordinary allocation keys. **Fail-first, honest answer: the equality test was GREEN today** — the two paths agreed *by coincidence of identical rules*; the divergence was **LATENT, not active**. **An assertion never seen to fail is not a guard**, so it was **proven to fire** (the A8 mutation precedent): perturbing **only** Portfolio's canonical `allocation()` took it **RED — `assert 4.4 == 3.3 ± 0.1`** (Policy said 4.4%, Portfolio said 3.3%); perturbation reverted. Also added **`PortfolioValuation.gross_assets()`** — the **ONE denominator** every weight divides by (liabilities excluded by construction: *a mortgage cannot distort a weight*, D-033), now also read by `/portfolio/summary`. `_bucket_of` **deleted**. ⚠ **NOT DONE (scope, recorded):** the gross-assets sum is still hand-spelled in **~8 other readers** (analytics, review, news, ai/tools, worker, briefing, planning, seed) — all applying the same rule today. `gross_assets()` is the home to converge them on; that sweep is a **separate change**, not smuggled in. |

**All three are recorded as `§10-A9/A10/A11` entries on `docs/plans/page-policy.md`**, so the parked plan
stays truthful about which of its findings are already fixed.

### GATE B — ✅ **CLOSED 2026-07-14** (owner-ratified) — documentation synchronisation

| # | Item | Who | Notes |
|---|---|---|---|
| B1 | **✅ SIGNED 2026-07-14** — `LICENSE`, byte-exact canonical AGPL-3.0 (option **a**) | 🧑 owner signed | Fetched from gnu.org, cross-checked word-for-word against SPDX. **SHA-256 pinned by test.** Headers ↔ file agree, drift either way fails. **Copyright lives in NOTICE** — LICENSE stays pristine. |
| B2 | **✅ SELECTED 2026-07-14** — **Apache-style ICLA + CCLA**, **CLA-assistant-style bot**, gate = **PRE-FIRST-EXTERNAL-MERGE** | 🧑 owner | **No CLA text authored by automation** (bar stands; narrowed only to mechanical name-filling behind an owner STOP). ⚠ **Recorded verbatim:** *"Counsel deliberately deferred by the owner; the CLA and this selection MUST receive counsel review before the first external contribution merges. A CLA cannot be applied retroactively."* **This is the one outstanding item, and its deadline is not moveable.** |
| B3 | **✅ DONE** — frontend `license` = `AGPL-3.0-or-later` | 🤖 | Was absent. |
| B4 | **✅ RATIFIED** — `NOTICE`, generated from A8's adjudicated output; copyright **© 2026 Gopala Subramanium** | 🤖 → 🛑 signed | 41 runtime deps; adjudicated licences marked. Copyright pinned in the generator so a regenerate cannot drop it. |
| B5 | **✅ SIGNED 2026-07-14** — README as a stranger's install guide (+ Amendment 2) | 🤖 draft → 🛑 signed | ⚠ **Amendment 2 surfaced a CONFLICT, reported not softened:** the README claimed *"Your data stays on your machine"* unconditionally, while the app's own AI provider warns *"sends data off-device"*. **The overclaim was corrected; Guarantee 5's absolute language was NOT touched.** |
| B6 | **✅ ONE ROW, owner-supplied 2026-07-14** — **Zorin OS 18.1 (Ubuntu-based) · x86-64 · Py 3.12.3 · Node 24.14.0** | 🧑 owner | **Automation did not enumerate platforms and refused to.** Recorded as *what the machine is*, not rounded up to "Ubuntu 24.04". Standing rule: a row is added only on a personally verified clean run. |
| B7 | **✅ CLOSED 2026-07-14** — security@ledgerframe.org live; owner sent **and received** the verification mail | 🧑 owner | This is what unblocked B8 and B10. |
| B8 | **✅ SHIPPED 2026-07-14** — `/SECURITY.md` (+ Amendment 2) | 🤖 draft → 🛑 signed | Could not ship before B7. README's link **resolves in the same commit**. |
| B9 | **✅ RATIFIED 2026-07-14** — SECURITY-BASELINE **DISTRIBUTION** section (+ Amendment 2 intro) | 🛑 signed | **AUTHORIZED CODE CHANGE BUILT:** `install.sh` gains an **encouraged, skippable** set-a-PIN step. **7 tests RED first.** Skip on loopback prints the documented warning; **LAN keeps the HARD PIN gate** (backend `deps.py` tests untouched, still green — a question in a shell script is not a security control). |
| B10 | **✅ SHIPPED 2026-07-14** — `.github/SUPPORT.md` + issue-template config | 🤖 draft → 🛑 signed | Links resolve now that B8 has shipped. |
| B11 | **✅ DONE** — ROADMAP R-24 revisit-at-packaged note | 🤖 | Verified present. |
| B12 | **✅ DONE (Amendment 1)** — CURRENT.md NEXT **reverted to natural order**: Policy · Cash flow · … | 🤖 | Legal/Help return to their natural late position and **remain release-blocking whenever release intent is declared**. |

### GATE C — ⏸ **STANDING / DORMANT** (RD-9 AMENDMENT 3) — Legal + Help pages
*(🚫 still RELEASE-BLOCKING — but so is **every** page now, so they **no longer jump the queue**; they return to **merit order**. Reactivates only when the FULL set is owner-accepted. Each is built via `TEMPLATE-page-build.md` — **PLAN-ONLY FIRST**.)*

| # | Item | Who | Notes |
|---|---|---|---|
| C1 | 🚫 **Legal page** — built via `TEMPLATE-page-build.md` (geometry gate included) [per RD-9] | 🤖 build → 🛑 **OWNER** ratifies all copy | Surfaces the licence (B1) and the disclaimers. **Blocked by B1** — the page cannot present a licence that does not exist |
| C2 | 🚫 **Help page** — same [per RD-9] | 🤖 build → 🛑 **OWNER** ratifies all copy | The `[Help]` popovers already ship across built pages and point at a page that **does not exist** |
| C3 | Nav: the remaining unbuilt pages are **hidden or honestly labelled** — **no dead links in the shipped build** [per RD-9] | 🤖 | They render `NotBuilt` today. Fail-first: a test that **no nav entry in the release build leads to `NotBuilt`** |

### ⏸ STANDING / DORMANT — GATE D — Identity & versioning *(runs only once the shipped surface is final — i.e. after the FULL set is owner-accepted)*

| # | Item | Who | Notes |
|---|---|---|---|
| D1 | **ONE product version `2.0.0`** — backend `app/__init__.py`, `frontend/package.json`, **and the OpenAPI version field** synchronised [per RD-5] | 🤖 | They disagree today: **3.24.0 / 0.1.0 / "v2"** (§1-4a). Pinned by test so they cannot drift |
| D2 | 🛑 **`CHANGELOG.md` (Keep-a-Changelog); the inaugural entry MUST declare the version RESET from the inherited v1 lineage** [per RD-5] | 🧑 **OWNER** validates | *Historical honesty — not a silent renumber.* |
| D3 | **Tag `v2.0.0`** — **at the moment of public release, not before** [per RD-5] | 🤖 | |

### ⏸ STANDING / DORMANT — GATE E — Public hygiene *(runs LAST, against the ACTUAL final public set)*

| # | Item | Who | Notes |
|---|---|---|---|
| E1 | **Assemble the public staging branch:** include `docs/specs/` (the six core specs, as authoritative architecture docs); **EXCLUDE `docs/plans/` and `docs/evidence/` entirely** [per RD-10] | 🤖 | The working repo **stays private** |
| E2 | 🚫 **Automated secret / PII scan across the public staging branch** [per RD-10] | 🤖 → 🛑 **OWNER** reviews findings | **Runs against the FINAL set, not the working tree** — scanning something other than what ships is not a scan. §1-5e: the earlier pass was *a look, not an audit* |
| E3 | 🛑 **Publication data cleaning** — anything E2 surfaces | 🧑 **OWNER** | Includes the standing note that publishing the repo publishes the **author email** in every commit (§1-5d) — **irreversible once mirrored** |
| E4 | Re-run **the SAME adjudication mechanism** against the FINAL public set — **clean = ZERO UNADJUDICATED FINDINGS** (never "zero findings") [per RD-2] | 🤖 → 🧑 **OWNER** rules anything new | Not a re-read of the Gate-A result: the final set may differ, and any **new** finding — or any ruling that has gone **stale** — blocks. **No public claim ships until it is clean by that definition.** |

### ⏸ STANDING / DORMANT — GATE F — Public ingestion

| # | Item | Who | Notes |
|---|---|---|---|
| F1 | 🛑 **Publish the clean public repository** [per RD-10] | 🧑 **OWNER** | |
| F2 | 🛑 **Release notes** — the built set **and the visible roadmap of what is NOT in it** [per RD-9] | 🧑 **OWNER** (copy) | **The release notes may not fabricate a capability, exactly as the product may not fabricate a figure** (Guarantee 3, applied to ourselves) |
| F3 | **Container image** — the fast-follow milestone [per RD-1b] | 🤖 | **After** F1. Packaged binaries remain **deferred** [per RD-1c]; R-24 revisits **there** [per RD-3] |

---

**STOP — RELEASE REQUIRES FULL COMPLETION (RD-9 Amendment 3, owner 2026-07-14). Gates C–F are DORMANT.**

**Nothing in Gates C–F is started.** They **reactivate only when the owner has ACCEPTED the full set:**
Help · Legal · Policy · Cash flow · Scenarios · Insurance · Estate · Accounts · Reports (+ Pack) ·
Settings · the **AI-surfaces milestone** (D-067/D-068/R-22) · **Voice**.

**⚠ Voice cannot be evaluated as a gate yet — it has no definition** (ROADMAP **R-32**, DEFINITION
PENDING). It needs an **owner definition + its own milestone plan** before this gate can be measured
against it. **No Voice behaviour is assumed here.**

**The work order lives in `CURRENT.md` NEXT** (merit order, Policy first). This plan defines the finish
line; it does not schedule the work.

**Still outstanding and owner-only:** the **CLA counsel review before the first external merge** (B2) — a
CLA cannot be applied retroactively, and publishing the repo (F1) is what starts that clock. Amendment 3
moves that clock **later**, not away.

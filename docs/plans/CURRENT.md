# CURRENT — Active Plan

**The next session starts from files, not memory.** This file tracks live status: what
is DONE (owner-accepted), what is NEXT (the active milestone), and what comes THEN. The
full acceptance record for every closed page/milestone is the central log in
`RATIFICATION.md §6`; each carries a §-retrospective in its own plan file. Release scope
and gates live in `release-readiness.md` (RD-9); parked items in `ROADMAP.md`.

---

## DONE — owner-accepted (RATIFICATION §6)

The product shell + every built page + the platform milestones, owner-accepted:

- **Chrome / app shell** · **First-run checklist**
- **Holdings** · **Instrument Detail** · **Portfolio** · **Net worth** · **Pricing
  Health** · **Markets** · **News** · **Review** · **Heatmap** · **Home**
- **Policy** · **Cash flow** · **Scenarios** · **Insurance** · **Estate** ·
  **Accounts** · **Reports** · **Reports Pack** · **Settings**
- **Help (`/help`) + Settings → About** — **closed 2026-07-19**, `page-help.md` §9/§9-bis
  **CLOSED** + §16 strike-check. The Help page rebuilt on a three-section journey after the 0a
  specimen was REJECTED; **the knowledge base rewritten** (the v1-era entries were factually wrong,
  and `app/ai/tools.py:145` feeds them to the AI as grounded fact — AI-surfaces' grounding review
  must read the NEW content); **About moved out of Help** to become the 7th Settings tab, rebuilt on
  the four-beat template. **THE HELP CURRENCY LAW** established (CLAUDE.md hard rule + TEMPLATE §8):
  every close states a Help delta or a guard-corroborated "no Help impact". `RATIFICATION.md §6` row
  appended. **Open:** 18 hardcoded-port smoke specs (`08-TECH-DEBT.md`) — the harness must fail
  closed; queued as its own delta.

- **data-feed-routing (R-38)** — **closed 2026-07-18**, `data-feed-routing.md` §14
  **CLOSED (29 findings / 9 batches)** + §15. The owner walk was **deferred to the
  pre-release walk** by dated ruling (§14 ruling 1c); acceptance basis = the batch-9
  report reviewed in chat + the §26-bis real-posture closing evidence (`62034a7`).
- **intraday-series (R-42)** — **closed 2026-07-18**, `intraday-series.md` walk ledger
  **CLOSED (3 findings / 1 batch)** + §15 strike-check. Owner-accepted on the live 3b
  re-walk; the **§14dr-25 carryover is FULLY ACCEPTED** (clean TSLA 1D/5D on the real
  instance). `RATIFICATION.md §6` row appended.
- **historical-backfill (R-43)** — **closed 2026-07-19**, `r43-historical-backfill.md`
  walk ledger **CLOSED (8 numbered findings, F-1..F-4 + F-6..F-9 — no F-5 was ever
  assigned; 14 defects counting the lettered sub-findings)** + §23 strike-check.
  **The milestone that made the Net-worth trend REAL** — a real multi-year series
  (2019→today) at **6/6 coverage ending at the live headline**, owner-accepted in chat on
  his own instance. Includes **R-8** (historical per-date FX). `RATIFICATION.md §6` row
  appended. **Open, ruling owed:** §21-3 (a `TimeoutError` escaping the AMFI chunk loop);
  **R-50** filed POST-RELEASE.
- **Legal (`/legal`) + the acceptance gate** — **closed 2026-07-20**, `page-legal.md` §11 (all six
  items ratified by the owner, by looking) · §12 walk ledger **CLOSED, 0 findings** · §13 pre-pass
  **54/54** · §14 close · §15 **11 lessons, each with what turns red**. **"Product Guarantees" →
  PRODUCT COMMITMENTS** (the page had contradicted itself: warranty vocabulary above an AGPL §15
  NO-WARRANTY section). **A server-side acceptance gate** — 451 on every `/api/v1` read until
  accepted, **before** the PIN check, binding to the **sha256 of the served document**; three
  states (`accepted`/`stale`/`none`); **a reset erases acceptance** (the gate binds the person, not
  the machine); decline is a real answer; **/legal readable without accepting**. **§20-P
  unchanged** — a consent boundary, never an authentication one. **Three DS entries RATIFIED**
  (Checkbox · page-scoped Legal typography · reading-return bar, **its strings served** — §11-K).
  **`check:primitives`** added, and **"a hard rule without a guard is a request" escalated into
  CLAUDE.md**. `RATIFICATION.md §6` row appended. Contract **141 paths / 71 schemas**.

- **AI-surfaces (D-067 / D-068)** — **closed 2026-07-20**, `ai-surfaces.md` §17 (the 3b walk) ·
  §18 **§-LEDGER CLOSED (F1–F10 + two walk fixes, every disposition)** · §19 strike-check
  (**10 lessons, each with what turns red**) · §20 Help currency · §21 changed files · §22.
  **THE ASK PANEL SHIPPED** — the first prose in this product written by a **model**, and with it
  the first distinction the product had to draw **visually** rather than in copy. **The provenance
  legend** (§15-4) — every answer says **who wrote the sentence**, served, in three states, with
  model text in **italic** (DS §5 amendment **RATIFIED**, on a `getComputedStyle` measurement).
  **The three kinds of intelligence** ratified in GLOSSARY. **One resolver** (`app/ai/vocabulary.py`)
  after the Settings tab was caught naming a provider that was not answering. **The acceptance gate
  covers AI**, tested at those paths. **§17-1** one locality statement at every moment (D-067
  reading note); **§17-2** a fixed sentence may not cite UI that does not render; **§17-3**
  `Income (div/int)` sanctioned GLOSSARY-first; **§17-4** the tab says when writing to it would do
  nothing. Backend **1963 solo, ordered AND randomized**; `npm run check` PASS (**408 vitest / 361
  Playwright**); currency **569/15**; contract **141 paths / 71 schemas**. `RATIFICATION.md §6` row
  appended. **⚑ Open (as at that close):** **F10** (the NEXT delta, release-blocking — **since SHIPPED
  2026-07-20, see the F10 entry below**) · **R-54 / R-55** (Amendment 7) ·
  **R-56** (F7, post-release) · the §19-J gap — **no guard asserts a sanctioned short form is
  searchable in Help**, carried to the pre-release backlog.

  ⚠ **2026-07-20 post-close correction (§19-K):** the §0 intake item (contention-robustness, `test_ai_facts_routing.py:34`) was found NOT DONE after close — carried to R-54 by dated re-assignment; intake-in-ledger mechanised (TEMPLATE).

- **F10 — the fresh-DB `get_history_cached` race** — **SHIPPED 2026-07-20**, `63ec86a`
  (standalone delta, no plan file; recorded in `ai-surfaces.md` §17-5 delta note + §18 row).
  **RELEASE-TRAIN BLOCKING, cleared.** A check-then-insert race on `settings.key` at **FOUR sites in
  `get_history_cached`, not the three the ruling counted** — the fourth (`hist_fetched:{id}:{interval}`)
  **was found BY the isolation review §17-5 required**, scope extended by chat ruling. Both races
  **reproduced RED first** through concurrent requests against the app; fixed by one shared
  `_claim_marker` helper (SAVEPOINT-scoped, tolerates the loser), leaving `market.py` with exactly one
  `session.add(Setting(...))`. **The posture lesson:** site 4 is invisible on a *new* instrument — the
  preceding write serialises callers — and reproduces only when the instrument **already exists**, the
  ordinary case. Gates: backend **1966 solo, ordered AND randomized**; `make lint` PASS; contract
  **141 / 71 unchanged** (no regen); Help currency **no impact, guard-corroborated**.
  **⚑ Owed:** a follow-up ruling on **four FILED instances of the same shape outside this function** —
  `feeds.py:72–78`, **`briefing.py:201–207`** (a generic helper, so widest blast radius),
  `settings.py:131–135`, `system.py:617–621` (plus `seed/demo.py:327`, adjacent variant).

- **R-54 — deterministic answer intelligence, the two-tier Ask panel (D-067)** — **CLOSED 2026-07-23**,
  `r54-deterministic-answers.md` §-ledger **CLOSED** (I-1..I-3 + F-1..F-11, every disposition) · Phase 3a
  scripted pre-pass (45/45, both themes, 0 console errors, 15 shots) · Phase 3b owner walk RATIFIED · §16
  CLOSE record. **THE TWO-TIER ASK PANEL** — tier-1 deterministic answering (intent routing + canonical
  endpoints, **zero network calls by construction**, works under no-egress **local, not dark**) vs tier-2
  model narration (egress-gated, R-22 amendment). **The panel EXPLAINS AND POINTS** — figure facts carry a
  trailing pointer, a scoped action/nav answer carries a labeled link line ("Open Holdings" / "Open General
  settings"); an unroutable question is an **honest miss** (`REFUSAL_UNROUTABLE`), never a nearest match.
  **ONE registry** (`figure_registry.py`) — term → canonical GLOSSARY label → canonical endpoint, analytics'
  `term_id` a derived reverse index. **ONE router** (`classify_intent`, word-boundary; the substring hazards
  are RED specimens). **Every figure via the fact-pack projection, never recomputed** (one-derivation law;
  pack == canonical proven live). **F-8** — perf-timeout metrics render `"—"`, never a fabricated `0.00%`.
  **F-11** (3b finding, fixed before close, `07ffd97`) — a settings-control question the ranker misses now
  injects the page-settings fact for the resolved tab → the scoped `Settings·<tab>` link. Backend **2111
  solo, ordered AND randomized**; contract **141/71** unchanged; Help currency (`ask` entry current, W-7
  vocabulary consistency). `RATIFICATION.md §6` row appended. **⚑ Filed/deferred:** **F-9→R-62** (thin-history
  `0.0`, post-release) · **R-61** (typed AI response models, post-release) · walk item 2 (posture under a live
  model) → **R-57 acceptance** · finding 1(a) (answer relevance ordering + fact-group separators) →
  pre-release backlog. **⊕ R-63 FILED** at the close (RD-9 Amendment 11, ⚡ pre-release, see NEXT).

---

## NEXT — R-63 (Pricing routing reliability) — **⚡ PRE-RELEASE, RD-9 Amendment 11**

**⊕ 2026-07-23 — R-54 is CLOSED (owner-accepted; see DONE below); the release train moves to R-63.**

**⊕ 2026-07-23 — R-63 FILED (owner ruling at the R-54 close, RD-9 Amendment 11).** *"data is the core
of this platform, can't leave it so loose" / "needs to be fixed once and for all."* Pricing routing can
leave holdings unpriced in ways reported as a flat "none", masking distinct causes. **INVESTIGATION-FIRST
— a hard gate:** the milestone opens with a **read-only diagnosis on the owner's live instance** (logs +
one instrumented refresh; **never mutate his data, never print keys**), then the fix is shaped by five
recorded survey inputs — (a) a rule pins the chain's head, never removes the fallback net; (b) failure
states named precisely (throttled/unmapped/errored/empty ≠ one "none"); (c) per-symbol empty-result honesty
(the `.BSE` suspect); (d) provider preflight + a "provider doctor" live-chain test on Pricing Health;
(e) cache staleness honesty for forming bars. **Plan-file gate standard.** See `ROADMAP.md` R-63,
`release-readiness.md` RD-9 Amendment 11.

**⊕ 2026-07-23 — Phase A DONE (read-only live diagnosis); plan file `r63-pricing-routing.md`
§0→§9 written; STOPPED at §9 for the owner one-pass.** **Root cause found and it is NOT the
assumed one:** an **entitlement-envelope parse mismatch** — `external.py:124` sends
`entitlement=delayed` on every AV call, AV then returns the quote under the decorated key
`"Global Quote - DATA DELAYED BY 15 MINUTES"`, and `external.py:191` reads only `"Global Quote"`
→ `{}` → `"empty quote"` → UNAVAILABLE, on **every** AV symbol. A 5-call live probe confirmed:
TSLA/SBICARD.BSE/RELIANCE.BSE all price fine **without** the param; **`.BSE` is exonerated**; not
quota, not entitlement absence (the key IS entitled to delayed data). Compounding findings: no
fetch-time fallback net (the priority chain is display-only, never walked — yahoo is never
called); all failures collapsed into one message; free-first ordering (f) would keep the keyless
lanes carrying load. AV reference committed to the tree at `docs/reference/` (`b88adbe`).

**⊕ 2026-07-23 — §9 CLOSED (owner one-pass, in chat; all twelve items RESOLVED with verbatim
rationales).** §7 acceptance criteria (AC-1..AC-18) and §8 build phases (0..6) authored; §-ledger
seeded (I-1..I-7). Key rulings: **§9-0** BOTH (tolerant `Global Quote*` parse + `entitlement` audit;
REDs use captured real envelopes) · **§9-1** pin-head-keep-net (execution net built first; provenance
head=X/priced-by=Y) · **§9-2** seven-state taxonomy + two-premiums fix · **§9-4** provider doctor
on-demand only, ≤1 egress/lane, redacted · **§9-6** free-first within capability (`us_equity:[yahoo,
alphavantage,eodhd,csv,manual]`; user override wins but keeps the net) · **§9-10** (g) fenced to
**R-64** (post-release umbrella, filed in ROADMAP). **Build underway: Phase 0 — the parse-miss RED on
the real probe-#1 envelope, first.**

**⊕ 2026-07-23 — R-63 progress: Phase 0 (parse fix), Phase 1 (execution net), Phase 2 (failure
taxonomy) all COMPLETE on the full-suite verdict.** Backend **2130 solo, ordered AND randomized
(seed 6363)**; contract **141/71 unchanged** (pricing-health is `-> dict`, the new failure fields
pinned by a served-shape test, not the contract). Ledger I-1/I-2/I-3/I-7 DISCHARGED; I-4 backend
done, Settings verified-tier display → Phase 4. Frontend `npm run check` PASS. **R-65 Phase 1 survey
DONE** (rode the Phase-2 verdict + static analysis): zero test sleeps, runtime is per-test DB DDL +
heavy integration derivation; xdist feasible with per-worker DB isolation (see ROADMAP R-65).
**Rite consolidated to Phase 4** (Pricing Health + Settings, one discharge).

**⊕ 2026-07-24 — Phase 3 (free-first ordering + budget, §9-6) COMPLETE.** `DEFAULT_PRIORITY`
reordered free/keyless-before-paid within capability (chain/net order; the head — override/matrix/
active — still wins but keeps the net); refresh budget spends holdings before overview proxies.
Backend **2135 solo, ordered AND randomized (seed 6363)**. **R-65 Phase 2 (xdist) slotted after the
R-63 close, before R-59.**

**⊕ 2026-07-24 — Phase-4 re-entry reconciliation + Phase 3.5 (I-6 instrument-identity guard) COMPLETE.**
The ledger↔records grep at Phase-4 re-entry caught two drifts: **I-5** mislabelled OPEN after Phase 3
shipped it (corrected → DISCHARGED); **I-6** (duplicate-instrument invariant probe) had **aged
silently** — the assigned Phase-1 probe never ran. Root-caused: **the product PERMITTED the
duplicate** (nullable `exchange` + SQL NULL-distinct UNIQUE + two inconsistent get-or-create keys →
the live TSLA id-22/id-23 pair). **Owner ruled (chat 2026-07-24, §9-i ADDENDUM): FOLD into R-63,
exactly two fixes, six riders.** Shipped as **Phase 3.5** (`e7a7e94` + hardening `e2ab16e`): one
`resolve_or_create_instrument` (all create paths) + a functional UNIQUE index
`uq_instr_identity_ci` on `(upper(symbol),coalesce(exchange,''))` with a **dupe-tolerant** migration
(does not brick a live DB holding the dupe) + `GET /system/instrument-duplicates` + a Pricing Health
"Resolve on Holdings" banner (PROPOSED). Fail-first through the real path; the guard's concurrency
serialization surfaced (then fixed) a lock-spillover via a resolver **lost-race recovery**. Backend
**2143 solo, ordered AND randomized (seed 6363)**; contract **142/71** (+1 UNTYPED path); frontend
green (PricingHealth 17/17, tsc/ruff clean). **I-6 DISCHARGED; owner's live-data cleanup carried to
0a.** **Next: Phase 4 — Pricing Health head/priced-by labelling + the recut Settings routing sentence
+ verified-tier display (I-4), all under the ONE accepted-surface rite discharge (Pricing Health +
Settings); then Phase 5 provider doctor, 0a/3a/3b, close.**

**⊕ 2026-07-23 — R-65 FILED (owner ruling, chat): "Test-suite runtime — measure, then
parallelize" (TEST-INFRA, non-blocking).** Phase 1 = cheap survey delta (`pytest --durations`
census · real-sleep debt census · `pytest-xdist` feasibility vs the F-10 `RESET_REGISTRY` census
+ per-worker isolation) — runs at the next natural boundary, must not displace R-63 build. Phase 2
quality-invariant by construction: clock-mock incidental time only (behavioral keeps real clocks or
gains a mocked variant alongside; unclassifiable → behavioral); xdist is inner-loop only —
**gate/close verdicts stay solo, ordered AND randomized**; promoting parallel to verdict status
needs a paired-run equivalence baseline + a separate chat ruling (doubt → slow path). See
`ROADMAP.md` R-65. **R-63 build proceeds unblocked.**

## THEN — the road to v2.0.0 (RD-9 Amendment 4 + 5 + 6 + **7** + **8** + **9** + **10** + **11**)

The remaining v2.0.0 set, in sequence (**R-54 is CLOSED** — see DONE; the active NEXT above is **R-63**):

> **R-63 → R-59 → R-58 → R-57 → R-55 → R-45 → R-46 → R-39 → pre-release walk → Gates C→F → tag v2.0.0**
> *(R-54 CLOSED 2026-07-23; RD-9 Amendment 8/9/10, extended by **Amendment 11** — R-63 leads the
> post-R-54 set, owner-ruled fix-once-and-for-all; architect sequencing under delegation, reversible.)*

**⊕ RD-9 SCOPE AMENDMENT 7 (owner, 2026-07-20) — the set GREW by two**, both raised by the owner
**using the shipped Ask panel** at the 0a walk: **R-54** (deterministic answer intelligence — the
two-tier Ask panel) and **R-55** (Help content: asset classes & corporate actions). Neither is
started; both carry the plan-file gate standard (own plan file, survey-first, §9 one-pass, full
loop). See `release-readiness.md` Amendment 7 and `ROADMAP.md` R-54/R-55.

**⊕ RD-9 SCOPE AMENDMENT 8 (owner, 2026-07-20, chat) — the set GREW by one more: R-57** (AI model
management, Settings › AI). Same origin as Amendment 7 — the owner asked at the close review **how a
user configures an external endpoint**, and the answer today is **environment only**; the AI tab is
honest about that gap and honesty is not a substitute for the surface. **Sequenced after R-54 and
before R-55** — same surface, and R-54's posture-copy amendment lands first **so R-57 edits settled
strings rather than moving ones** (architect sequencing under delegation, **reversible**). See
`release-readiness.md` Amendment 8 and `ROADMAP.md` R-57.

1. ~~**Help**~~ — **CLOSED 2026-07-19** (DONE above).
2. ~~**Legal**~~ — **CLOSED 2026-07-20** (DONE above).
3. ~~**AI-surfaces**~~ — **CLOSED 2026-07-20** (DONE above).
4. ~~**F10**~~ — the fresh-DB `get_history_cached` race — **SHIPPED 2026-07-20** (DONE above).
5. ~~**R-54**~~ — deterministic answer intelligence, the two-tier Ask panel — **CLOSED 2026-07-23**
   (owner-accepted; see DONE above). §-ledger CLOSED (I-1..I-3, F-1..F-11); F-9→R-62, F-11 fixed
   (`07ffd97`). `RATIFICATION.md §6` row appended.
5a. **R-63** — **Pricing routing reliability** (RD-9 **Amendment 11**, owner ruling at the R-54 close).
   ⚡ pre-release, **investigation-first** (read-only live diagnosis before code); data-integrity is the
   platform's core, ruled fix-once-and-for-all. **Leads the post-R-54 set.** See `ROADMAP.md` R-63.
6. **R-59** — **URL-addressable add-holding form, phase 1** (RD-9 **Amendment 10**, from R-54's
   §0-F dead-affordance finding). Completes the owner's tier-1(b) example, which is **unbuildable
   until this route exists**. Delta-scale; Holdings is closed, so it ships under the
   **guard-REDs-an-accepted-surface rite** (dated delta note in `page-holdings.md` + that page's
   pre-pass re-run, same delta). The general entity-dialog pattern stays **post-release**.
7. **R-58** — the `settings.key` check-then-insert race at the **four filed sites outside
   `get_history_cached`** (RD-9 **Amendment 9**, from the F10 census). `briefing.py:201–207` **first**
   (a generic helper — widest blast radius), then `feeds.py:72–78`, `settings.py:131–135`,
   `system.py:617–621`; `seed/demo.py:327` is an **adjacent variant**, not a fifth site. **Not
   release-train blocking** — none sits on a guaranteed-concurrent path — but the fix is F10's
   already-tested `_claim_marker` primitive. **Fail-first with a blindness pin is mandatory.**
8. **R-57** — AI model management, Settings › AI (RD-9 Amendment 8). After R-54, before R-55.
9. **R-55** — Help content: asset classes & corporate actions (RD-9 Amendment 7). **Ships the
   §19-J findability parity guard** (chat ruling 2026-07-20).
10. **R-45** — per-instrument + default news coverage (pulled into v2.0.0, RD-9
   Amendment 5; egress ruling required, take together with R-44). **Verification item
   (observed 2026-07-18):** the **Home holdings-scoped headlines vs per-ticker feed
   inconsistency** — confirm/resolve in the R-45 walk (also noted in ROADMAP.md's R-45 row).
11. **R-46** — Home summary cards (pulled into v2.0.0, RD-9 Amendment 5; sequencing
   suggestion: adjacent to R-39).
12. **chrome-sidebar-refresh (R-39)** — the **FINAL pre-release** milestone.
13. **Pre-release owner walk** — `docs/plans/pre-release-walk.md` (the thorough capstone;
   carries the deferred verifications — dr-25 chart sign-off **[DONE at the R-42 close]**,
   dr-28 owner-eyes; plus the R-42-appended mixed-currency / intraday / fund-P/L checks
   and the **R-43-appended 10d–10g** — mixed-provider backfill spot-check, 6/6 trend with
   the carried note, **§20-P `LEDGERFRAME_SECRET_KEY` as a Gate-C blocker**, TWR/1Y once
   coverage fills).
14. **Gates C→F clear** (`release-readiness.md`) → **tag v2.0.0.**

**R-41 / R-43 / R-44 — RESOLVED (RD-9 Amendment 6, owner 2026-07-18):** R-43 **IN** (with
R-8); **R-41** (per-provider credentials — YAGNI) and **R-44** (news thumbnails —
cosmetic, rides the R-45 egress ruling) are **POST-RELEASE**.

**Post-release:** **R-41** · **R-44** (above) · **Voice (R-32)** — post-release, definition
owed · **R-40** (Alpha Vantage premium feed expansion) — parked, definition owed.

## Needs decision

- **✅ RESOLVED 2026-07-20 (owner) — the grounding fact pack is WIDENED, SCOPED.** *(AI-surfaces
  Phase 0.9.)* The pack carried `body` alone, so *"one structured source of truth used by BOTH
  the Help page and the AI"* was true of the **source** and not the **view**. **Ruled: the
  structured Help fields join the pack, `interpret` included.** Shipped as **two tiers** —
  `body` + `interpret` **unconditional** (the entry's meaning), `outputs` + `inputs` under a
  budget, **whole fields only, never truncated mid-text** (a caveat cut in half reads as
  complete, which is worse than one never sent). `search_help`'s own return shape is
  **unchanged** — it is the Help page's search-result contract. **Size pinned** (largest
  rendered fact ≤ 4000 chars; per-question help portion ≤ 12000). **Quoting surface extended
  with a RED specimen**: a verbatim quote from the widened pack is accepted, an invented one on
  the same subject is **still rejected by clause 5** — a bigger haystack is not a lower bar
  (Commitment 7). **Fail-first proof, as ruled:** *"why do I have to accept terms"* was RED
  (`['Help · Legal', 'Help · Help']`, not one containing the word "accept") and now retrieves the
  ruled answer, declining included.

  > **⊕ AMENDMENT, 2026-07-20 (owner, R-54 §9-B one-pass) — THE WIDENING NEVER REACHED THE GLOSSARY
  > CATEGORY, AND THE CENSUS IS NOW CORRECTED.** The ruling above shipped as
  > `_HELP_FACT_CORE = ("body", "interpret")` + `_HELP_FACT_EXTRA = ("outputs", "inputs")`
  > (`app/ai/tools.py:211-212`). R-54's §0-C survey **executed the corpus** and found the tiers were
  > named from **page-entry** field names only: **all 29 `term-*` Glossary entries carry
  > `what`/`why`/`improves`/`example` and NONE carries `interpret`, `outputs` or `inputs`** — so
  > every glossary term projected **`body` alone**, which is *this ruling's own defect, surviving in
  > the one category it never measured*. **Ruled: `what` + `why` join the unconditional core and
  > `improves` + `example` join the budgeted tail, for the Glossary category** — the **same intent
  > as the ruling above** (the entry's MEANING is unconditional; structural extras are budgeted),
  > applied to a **corrected census** rather than a re-opened decision. *Owner:* "Accepted (with 9-B
  > amendment). (Industry best practice: Centralizing fact identity into a single parity-guarded
  > backend table prevents drift and ensures robust reverse-indexing for analytics)." Ships in R-54
  > Phase 0. *Why it is recorded HERE:* this block is the ruling's canonical home, and an amendment
  > filed only against the milestone that found it would leave the next reader of this entry
  > believing a census that was wrong. Cross-ref: `r54-deterministic-answers.md` §0-C, §9-B.

- **✅ RESOLVED 2026-07-20 (owner, option (b)) — R-22 vs the shipped egress gate.** *(AI-surfaces §9-BIS; found at
  Phase 0.5. **Blocks one of three ruled posture states in the Ask panel; does not block the
  rest of the milestone.**)* **R-22 is normative** — *"under no-egress AI is **local-only**
  (Ollama), a cloud provider makes zero calls"* (`ROADMAP.md:36`, `DECISIONS.md:909`) — i.e.
  local AI keeps working. **The shipped gate blocks local AI too:** `egress_client`
  (`app/core/egress.py:73`) checks the toggle **before it looks at any URL** (`:82-83`) and has
  **no loopback exemption**. This is deliberate and already guarded —
  `tests/integration/test_egress_guard.py:120` constructs the provider at
  **`http://127.0.0.1:9/v1`** and asserts it is blocked. **Consequence:** the (f)-ruled posture
  string *"No-egress is on — AI runs on this device only"* would be **false as shipped**, on the
  one surface built to be honest about posture. **⚑ Two ways out, neither recommended here:**
  **(a)** R-22 stands, exempt loopback from the gate — defensible on Commitment 5's own wording
  (*"zero **outbound** network calls"*; loopback never leaves the device) but it edits the
  product's strongest guarantee and reverses a ratified assertion; **(b)** the gate stands,
  R-22 gains a dated amendment, and no-egress + local provider is re-worded as what it actually
  is — the same state as no-egress + no provider, AI off, deterministic answers. Evidence
  **RULED (b): the gate stands; R-22's "local-only" clause is superseded by a dated amendment**
  (`DECISIONS.md` R-22 AMENDMENT, `ROADMAP.md:36`). *Owner's rationale — the durable part:* a
  loopback exemption **delegates the promise to a process LedgerFrame does not control**; a local
  Ollama server makes its own outbound calls, **model pull being the counterexample**, so
  Commitment 5's *zero outbound calls* would stop being an observable property of the device.
  **Only in-process inference could reopen it.** Consequence: **two** no-egress posture states,
  not three — local-provider and no-provider are the same state (AI off, deterministic answers).
  The unwritten string was **deleted, not worded**.

- (none otherwise open). **RESOLVED 2026-07-19 — the author photograph's licence terms**
   (page-help §9-bis-14, `docs/audit/ASSETS.md`). The owner ruled:
   *"© Gopala Subramanium, all rights reserved; included in this repository by the
   author; not covered by the AGPL licence of the code."* The photograph is
   **carved out of the AGPL grant covering the code** — downstream recipients get
   the AGPL rights to the source and **no right to redistribute or modify the
   author's likeness**. The full line and its consequences live in
   `docs/audit/ASSETS.md`, which is its only home: `LICENSES.md` and `NOTICE` are
   regenerated wholesale and would erase a hand-edit.

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
  appended. **⚑ Open:** **F10** (the NEXT delta, release-blocking) · **R-54 / R-55** (Amendment 7) ·
  **R-56** (F7, post-release) · the §19-J gap — **no guard asserts a sanctioned short form is
  searchable in Help**, carried to the pre-release backlog.

---

## NEXT — F10: the fresh-DB `get_history_cached` race (⚡ RELEASE-TRAIN BLOCKING)

**⊕ 2026-07-20 — AI-surfaces CLOSED (see DONE). This is the very next delta, BEFORE any R-54
work, by owner ruling (`ai-surfaces.md` §17-5).**

```
GET /api/v1/portfolio/performance?days=365&benchmark=SPY&include_manual=false → 500
  app/services/analytics.py:244  performance_series → get_history_cached(...)
  app/services/market.py:980     get_history_cached → await session.flush()
  sqlite3.IntegrityError: UNIQUE constraint failed: settings.key
```

**The mechanism, re-verified at the close rather than recalled.** `get_history_cached` opens with
**three** one-time repair blocks — `hist_demo_residue_repaired_v1` (`market.py:976`),
`hist_extended_hours_purged_v1` (`:986`), and the §12-R3 wrong-instrument purge — each shaped
**`SELECT` marker → if absent, `session.add(Setting(...))` → `flush()`**. Two concurrent first-load
requests both read absent and both insert; the second hits the `UNIQUE` constraint on
`settings.key`. **A check-then-insert race, three times over, on the fresh-DB path every new
install takes.**

**How it must be done:**

1. **Fail-first on the REPRODUCED race** — concurrent first-load, not a unit call. *A race that is
   only reasoned about is a race that gets "fixed" by a change nobody watched work.*
2. **Upsert-shaped fix** (get-or-create that tolerates the loser), applied to **all three** blocks —
   fixing one leaves the same defect at two other sites in the same function.
3. **The pricing path reviewed in isolation**, which is the whole reason this was not swept into the
   AI milestone: an unreviewed change to pricing inside an AI-copy delta is a change where no
   reviewer is looking for it.
4. **RELEASE-TRAIN BLOCKING** — a first-run defect, and the first run is the one impression an
   install gets to make.

## THEN — R-54 kickoff (deterministic answer intelligence, the two-tier Ask panel)

RD-9 Amendment 7 scope. **Not started.** Carries the plan-file gate standard: own plan file,
survey-first, §9 one-pass, full loop. **Its tier-1 SEED already shipped** — the no-egress
deterministic answering built at AI-surfaces 0a (`ai-surfaces.md` §12-3 records the string as its
first artifact), and **R-54 owns the posture-copy amendment** when tier-1 formally lands. Stated
here because it is the cross-reference easiest to lose between milestones.

## THEN — the road to v2.0.0 (RD-9 Amendment 4 + 5 + 6 + **7**)

The remaining v2.0.0 set, in sequence (**AI-surfaces is CLOSED** — see DONE; the active NEXT
above is the **F10 delta**, then **R-54**).
**⊕ RD-9 SCOPE AMENDMENT 7 (owner, 2026-07-20) — the set GREW by two**, both raised by the owner
**using the shipped Ask panel** at the 0a walk: **R-54** (deterministic answer intelligence — the
two-tier Ask panel) and **R-55** (Help content: asset classes & corporate actions). Neither is
started; both carry the plan-file gate standard (own plan file, survey-first, §9 one-pass, full
loop). See `release-readiness.md` Amendment 7 and `ROADMAP.md` R-54/R-55.

1. ~~**Help**~~ — **CLOSED 2026-07-19** (DONE above).
2. ~~**Legal**~~ — **CLOSED 2026-07-20** (DONE above).
3. ~~**AI-surfaces**~~ — **CLOSED 2026-07-20** (DONE above).
4. **R-45** — per-instrument + default news coverage (pulled into v2.0.0, RD-9
   Amendment 5; egress ruling required, take together with R-44). **Verification item
   (observed 2026-07-18):** the **Home holdings-scoped headlines vs per-ticker feed
   inconsistency** — confirm/resolve in the R-45 walk (also noted in ROADMAP.md's R-45 row).
5. **R-46** — Home summary cards (pulled into v2.0.0, RD-9 Amendment 5; sequencing
   suggestion: adjacent to R-39).
6. **chrome-sidebar-refresh (R-39)** — the **FINAL pre-release** milestone.
7. **Pre-release owner walk** — `docs/plans/pre-release-walk.md` (the thorough capstone;
   carries the deferred verifications — dr-25 chart sign-off **[DONE at the R-42 close]**,
   dr-28 owner-eyes; plus the R-42-appended mixed-currency / intraday / fund-P/L checks
   and the **R-43-appended 10d–10g** — mixed-provider backfill spot-check, 6/6 trend with
   the carried note, **§20-P `LEDGERFRAME_SECRET_KEY` as a Gate-C blocker**, TWR/1Y once
   coverage fills).
8. **Gates C→F clear** (`release-readiness.md`) → **tag v2.0.0.**

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

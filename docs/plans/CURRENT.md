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

---

## NEXT — AI-surfaces (D-067 / D-068)

**⚠ INTAKE CROSS-NOTE — READ BEFORE THE GROUNDING REVIEW** (page-help §9-9 ruling, 2026-07-19):
the **help knowledge base was REWRITTEN in the Help milestone**. `app/services/help.py` is not just
the Help page's content — **`app/ai/tools.py:145` pulls it into the grounded fact pack**, so it is
what the AI cites as fact. The v1-era entries it used to serve were **factually wrong** (they
described "Snapshot", "Planning", "Investment policy", a removed Simple/Expert toggle, and four
Settings tabs where six ship). **The grounding review must read the NEW content**, and **no
pre-2026-07-19 review of AI help-grounding is still valid.** Accuracy is now mechanised by
`tests/unit/test_help_content_accuracy.py`.

**And it moved again since that note was written:** the **Legal milestone** added Legal's own Help
entry and rewrote the gate/lock/reset truth in the affected entries (2026-07-20, §14-B). The
grounding corpus the AI cites therefore includes **the acceptance gate's behaviour and the
Commitments rename** — an AI that still says *"Product Guarantees"*, or that describes entry
without the consent gate, is citing retired fact.

**Intake (R-43 §18-F7d):** `test_performance_question_pulls_risk_metrics` streams `/ai/chat` and
asserts the risk facts arrive; it is **contention-fragile** — it fails only when the suite shares
the machine with other pytest processes, and passes solo (controlled comparison in
`r43-historical-backfill.md` §18-F7d). **The robustness fix belongs to this milestone** as the
natural owner of the AI streaming surface, NOT to R-43.

**PLAN ONLY first — verify-first, STOP at §9** (the R-35/R-38/R-42/R-43/Help/Legal plan-file-first
precedent). No code before the owner's §9 one-pass.

**Binding on this milestone:**

- **THE HELP CURRENCY LAW applies from the first commit** — and with unusual force here, because
  Help content *is* this milestone's input: a change to the knowledge base changes what the AI
  asserts as fact. The **HELP CURRENCY SUITE** runs at the close.
- **A NEW GUARD THAT REDS AN ACCEPTED SURFACE IS A DELTA ON THAT SURFACE** (CLAUDE.md standing
  rule) — a dated delta note in that page's plan file **and** that page's pre-pass re-run, in the
  same delta.
- **A HARD RULE WITHOUT A GUARD IS A REQUEST** (CLAUDE.md, added at the Legal close): ask of every
  constraint this milestone states, *what turns red?*

## THEN — the road to v2.0.0 (RD-9 Amendment 4 + 5 + 6)

The remaining v2.0.0 set, in sequence (**AI-surfaces** is the active NEXT above):

1. ~~**Help**~~ — **CLOSED 2026-07-19** (DONE above).
2. ~~**Legal**~~ — **CLOSED 2026-07-20** (DONE above).
3. ~~**AI-surfaces**~~ — the active NEXT above (D-067 / D-068; the Help-grounding
   cross-note and the contention-fragile streaming test are carried there in full).
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

- (none open). **RESOLVED 2026-07-19 — the author photograph's licence terms**
   (page-help §9-bis-14, `docs/audit/ASSETS.md`). The owner ruled:
   *"© Gopala Subramanium, all rights reserved; included in this repository by the
   author; not covered by the AGPL licence of the code."* The photograph is
   **carved out of the AGPL grant covering the code** — downstream recipients get
   the AGPL rights to the source and **no right to redistribute or modify the
   author's likeness**. The full line and its consequences live in
   `docs/audit/ASSETS.md`, which is its only home: `LICENSES.md` and `NOTICE` are
   regenerated wholesale and would erase a hand-edit.

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
- **data-feed-routing (R-38)** — **closed 2026-07-18**, `data-feed-routing.md` §14
  **CLOSED (29 findings / 9 batches)** + §15. The owner walk was **deferred to the
  pre-release walk** by dated ruling (§14 ruling 1c); acceptance basis = the batch-9
  report reviewed in chat + the §26-bis real-posture closing evidence (`62034a7`).
- **intraday-series (R-42)** — **closed 2026-07-18**, `intraday-series.md` walk ledger
  **CLOSED (3 findings / 1 batch)** + §15 strike-check. Owner-accepted on the live 3b
  re-walk; the **§14dr-25 carryover is FULLY ACCEPTED** (clean TSLA 1D/5D on the real
  instance). `RATIFICATION.md §6` row appended.

---

## NEXT — R-43 — historical valuation backfill

**Owner priority** (RD-9 Amendment 6). Retrospective portfolio valuation so the Net worth
trend stops being flat/linear (only forward snapshots exist today).

Scope: a **Decimal engine** (no client money math, D-105); **persisted snapshots**;
powered from price history + transactions + per-date FX. Includes:

- **R-8 — historical FX series** (its **hard dependency**; pulled in with R-43).
- **Transaction currency + trade-date cost-basis FX** — **folded into R-43 by ruling at
  the R-42 close (2026-07-18)**: the India funds recorded cost in SGD while NAV is INR
  (a data-entry currency question, not a valuation bug); trade-date conversion is R-43's
  natural home, adjacent to R-8.
- **The Net-worth snapshot-now trigger** — an icon `Button` on the trend card.

**PLAN ONLY first — verify-first, STOP at §9** (the R-35/R-38/R-42 plan-file-first
precedent). No code before the owner's §9 one-pass.

---

## THEN — the road to v2.0.0 (RD-9 Amendment 4 + 5 + 6)

The remaining v2.0.0 set, in sequence (R-43 is the active NEXT above):

1. **Help** — `[Help]` retrofit, owner-picked targets (RD-9 Amendment 4).
2. **Legal.**
3. **AI-surfaces** — D-067 / D-068. **Intake (added 2026-07-19, R-43 §18-F7d):**
   `test_performance_question_pulls_risk_metrics` streams `/ai/chat` and asserts the risk
   facts arrive; it is **contention-fragile** — it fails only when the suite shares the
   machine with other pytest processes, and passes solo (controlled comparison in
   `r43-historical-backfill.md` §18-F7d). The robustness fix belongs to this milestone as
   the natural owner of the AI streaming surface, NOT to R-43.
4. **R-45** — per-instrument + default news coverage (pulled into v2.0.0, RD-9
   Amendment 5; egress ruling required, take together with R-44). **Verification item
   (observed 2026-07-18):** the **Home holdings-scoped headlines vs per-ticker feed
   inconsistency** — confirm/resolve in the R-45 walk (also noted in ROADMAP.md's R-45 row).
5. **R-46** — Home summary cards (pulled into v2.0.0, RD-9 Amendment 5; sequencing
   suggestion: adjacent to R-39).
6. **chrome-sidebar-refresh (R-39)** — the **FINAL pre-release** milestone.
7. **Pre-release owner walk** — `docs/plans/pre-release-walk.md` (the thorough capstone;
   carries the deferred verifications — dr-25 chart sign-off **[DONE at the R-42 close]**,
   dr-28 owner-eyes; plus the R-42-appended mixed-currency / intraday / fund-P/L checks).
8. **Gates C→F clear** (`release-readiness.md`) → **tag v2.0.0.**

**R-41 / R-43 / R-44 — RESOLVED (RD-9 Amendment 6, owner 2026-07-18):** R-43 **IN** (with
R-8); **R-41** (per-provider credentials — YAGNI) and **R-44** (news thumbnails —
cosmetic, rides the R-45 egress ruling) are **POST-RELEASE**.

**Post-release:** **R-41** · **R-44** (above) · **Voice (R-32)** — post-release, definition
owed · **R-40** (Alpha Vantage premium feed expansion) — parked, definition owed.

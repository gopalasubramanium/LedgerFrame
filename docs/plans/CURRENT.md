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

---

## NEXT — intraday-series (R-42)

**ACTIVATED** (owner definition, 2026-07-18). Stub plan: `docs/plans/intraday-series.md`.

Owner definition: **(a) tier-aware** — respects the learned `av_tier`; the free tier
keeps the honest **disabled** 1D/5D, a premium tier enables it; **(b) USER-TRIGGERED** —
an explicit fetch per instrument / per range, never a background poll (budget discipline:
alphavantage free ≈ 25 req/day); **(c) PERSISTED permanently once fetched** — stored +
reused, no re-fetch on view; the free tier keeps the **honest disable**.

**PLAN ONLY first — STOP at §9** (the R-35/R-38 plan-file-first, verify-first precedent).
No code before the owner's §9 one-pass. This milestone also carries the **dr-25 final
chart sign-off** (the 1D/5D ranges re-enable here — data-feed-routing §14 dr-25
carryover).

---

## THEN — the road to v2.0.0 (RD-9 Amendment 4 + 5)

The remaining v2.0.0 set, in sequence:

1. **Help** — `[Help]` retrofit, owner-picked targets (RD-9 Amendment 4).
2. **Legal.**
3. **AI-surfaces** — D-067 / D-068.
4. **R-45** — per-instrument + default news coverage (pulled into v2.0.0, RD-9
   Amendment 5; egress ruling required, take together with R-44).
5. **R-46** — Home summary cards (pulled into v2.0.0, RD-9 Amendment 5; sequencing
   suggestion: adjacent to R-39).
6. **chrome-sidebar-refresh (R-39)** — the **FINAL pre-release** milestone.
7. **Pre-release owner walk** — `docs/plans/pre-release-walk.md` (the thorough capstone;
   carries the batch-9 deferred verifications — dr-25 chart sign-off, dr-28 owner-eyes).
8. **Gates C→F clear** (`release-readiness.md`) → **tag v2.0.0.**

**Pending with the owner (do NOT resolve):** the **R-41 / R-43 / R-44** release-scope
ruling — release-scope candidates raised by R-38, not yet ruled in or out.

**Post-release:** **Voice (R-32)** — post-release, definition owed. **R-40** (Alpha
Vantage premium feed expansion) — parked, definition owed.

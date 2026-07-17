# intraday-series — Intraday price series (ROADMAP R-42) build plan

> **STATUS: KICKOFF STUB — PLAN ONLY, NOT BUILT.** R-42 was **ACTIVATED** with an
> owner **definition** at the data-feed-routing §14dr-13 re-walk (2026-07-18;
> `ROADMAP.md:54`), sequenced as the milestone **immediately after
> data-feed-routing closes, BEFORE Help**. This stub records the owner definition
> + the verified kept machinery + the missing scope; the **full plan** (this file
> expanded per `TEMPLATE-page-build.md`) is authored **when the milestone opens** —
> plan-file-first / verify-first (the R-35 / R-38 precedent). **Nothing is built
> yet — no code, no migration, no contract change.** Frontend exit code for this
> plan-only stub: **N/A** (no frontend touched).

---

## 0. WHAT R-42 IS

An **intraday price series** — sub-daily bars — so the **1D / 5D** ranges on the
Instrument Detail chart can show an honest intraday granularity instead of the
daily-only store they promised. dr-7 (`data-feed-routing.md §18`) **disabled 1D/5D
with an honest reason** ("Intraday prices aren't available yet — daily history
only") pending this milestone; R-42 re-enables them **only where the data honestly
exists**.

The platform still **never fabricates a price** and **never advises**. An intraday
series is shown only when it was actually fetched and stored; a range with no
intraday data stays honestly disabled (the dr-7 posture holds until the fetch runs).

## 1. OWNER DEFINITION (2026-07-18, verbatim intent)

Recorded at activation — the three properties the milestone must honour:

1. **Tier-aware.** The fetch respects the **learned `av_tier`**. The **free tier
   keeps the honest disabled 1D/5D** (intraday is a premium-tier capability); a
   premium tier enables the intraday fetch. No tier is ever assumed — the tier is
   the one already learned/served, not invented.
2. **User-triggered.** An **explicit fetch per instrument / per range** — never a
   background poll or scheduler. This inherits the budget discipline named at
   dr-7: **`alphavantage free ≈ 25 req/day`** (the constraint that makes a poll
   dishonest in the first place).
3. **Persisted permanently once fetched.** An intraday series, once pulled, is
   **stored and reused** — no re-fetch on every view. Storage is the existing
   `PriceHistory.interval` seam.

## 2. KEPT MACHINERY (verified 2026-07-18)

- **Storage seam** — `PriceHistory.interval` column already exists
  (`app/models/__init__.py:325`); an intraday series is a distinct `interval`
  value, not a new table.
- **Daily fetch precedent** — the provider fetch path already pulls a daily series
  (`yahoo.py:209` `"1d"`, `external.py:213` `"daily"`); the intraday fetch is a
  sibling interval on the same adapter surface.
- **Tier signal** — `av_tier` is already learned + served (surfaced read-only in
  Settings → Data feeds today); R-42 consumes it, does not add it.
- **Chart consumption** — `PriceChart` already supports `disabledPeriods` (dr-7);
  R-42 flips the relevant ranges from disabled → enabled where intraday data exists.

## 3. MISSING SCOPE (deferred to the full plan — nothing built here)

- The **intraday fetch adapter path** — a non-`"daily"` interval fetch, tier-gated,
  within provider budget; the range→interval fetch trigger.
- **Range → interval mapping** — 1D → 1-min (~390 pts), 5D → intraday, 1M/1Y →
  daily (unchanged). Owner expectation recorded: **1-min bars for 1D**.
- The **per-instrument / per-range user trigger** (never a poll) + its persistence
  write; idempotent re-use of a stored series.
- **Chart consumption** — re-enabling the dr-7 disabled ranges **only** where an
  intraday series is stored; the honest disabled/empty posture everywhere else.
- **No-egress + tier honesty** — the fetch is egress (Guarantee 5): zero calls under
  no-egress; free-tier stays disabled with the dr-7 reason.

## 4. PLAN-FILE GATE

Per `ROADMAP.md` and CLAUDE.md, **nothing on this milestone is built until this stub
is expanded into a full plan** (IDENTITY · OWNERSHIP · API SURFACE + contract delta ·
COMPONENTS · VOCABULARIES · DECISIONS IN FORCE · ACCEPTANCE CRITERIA · BUILD PHASES ·
NEEDS DECISION) and the §9 one-pass is walked with the owner. No resolution sketched
above is a commitment until the owner rules at plan-time.

Cross-ref: `data-feed-routing.md §18` (dr-7, the disabled ranges) + `§20` (dr-13,
the activation); `ROADMAP.md:54` (R-42).

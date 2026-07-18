# pre-release-walk — the single thorough owner walk before the v2.0.0 tag

> **What this is.** The owner's **one thorough walk** before the v2.0.0 tag — the
> **ADDITIVE capstone** on top of the per-milestone owner walks, **not a substitute**
> for them (data-feed-routing.md §14 ruling 1c, owner 2026-07-18). Findings triage per
> the standard §14 process in force at that time (file the finding first, fix
> verify-first, one delta per commit). Each item states **what "verified" looks like**.
>
> **Seeded at the data-feed-routing (R-38) close, 2026-07-18.** Carries the batch-9
> deferred verifications (dr-25 chart sign-off, dr-28 owner-eyes) plus the standing
> release checks. Later milestones **append their own walk items here at their close**
> (see item 10).

---

## Carryover items from data-feed-routing (R-38)

1. **dr-25 — chart integrity on the REAL-keyed instance. → RESOLVED at the R-42 close
   (owner-eyes, 2026-07-18).** The carryover final chart sign-off was taken on the R-42
   3b re-walk: clean TSLA 1D/5D on the real-keyed instance, extended-hours spikes
   root-caused (W-3) and purged. **Replaced by a standing regression item:** instrument
   **and** benchmark charts render **smooth** (no sawtooth "comb") on the real instance
   **across daily AND intraday ranges**; the benchmark overlay is **correctly absent on
   Instrument Detail** (§9-5 — the *"Benchmark comparison is daily-range only"* served
   reason ships with **R-48** if that milestone is pulled). *Verified:* a single
   continuous line per instrument chart at 1D/5D/daily; the Performance chart draws two
   distinct plausible lines (portfolio + benchmark); no duplicate-date candles; Source
   badge names the real provider.

2. **dr-26 — erase-all-data leaves nothing behind.** On a **disposable** instance,
   "Erase all data" leaves **zero rows in every user-data table**, including
   insurance/estate/planning (the tables that survived the pre-fix hardcoded list). The
   **D-103 fresh-PIN** is enforced (an ambient/unlocked session cannot erase).
   *Verified:* iterate live metadata post-reset → 0 user-data rows; settings/PIN/provider
   config preserved; a stale/ambient PIN is rejected.

3. **dr-27 — one instrument per asset class on the real key.** Create one instrument per
   asset class (**picker AND free-form where allowed**); verify **source**, **rule chip**,
   **price/NAV arrival**, and the **correction flow** for at least **crypto + mutual
   fund** (budget-aware — the alphavantage free tier is ~25 req/day; the real key here is
   premium). *Verified:* crypto free-form → correction links a `coingecko_id`, real price,
   Source CoinGecko; India MF → `listing_country=IN` + `amfi_code` at create, the
   `(mutual_fund, IN, amfi_nav)` cell not degraded, real NAV, Source amfi_nav; honest
   "not available yet" history where only one point is published.

4. **dr-28 — Reports first paint.** Fresh boot, **first** navigation to Reports:
   **populated, or an honest per-card error+Retry** — **never a silent blank**.
   Owner-eyes on the **boot-readiness-race** explanation (no Reports code defect was
   found; the honest error state renders during boot). *Verified:* first paint shows a
   populated tax-lots row (or a Retry card); no blank card; 0 console errors.

---

## Standing release checks

5. **dr-29 / news + headlines.** With **holdings present** and feeds at default, Home
   shows **headlines**; empty states are **honest** where coverage is absent (an erased
   instance legitimately shows none). *Verified:* holdings-scoped headlines populate;
   the served EmptyState (never invented copy) shows only where there is no coverage.

6. **D-103 PIN flows end-to-end.** Purge (trashed holdings), reset-data (erase all), and
   PIN change — each collects a **fresh PIN** and rejects an ambient/unlocked session.
   *Verified:* each destructive action requires deliberate PIN re-entry; a wrong/stale
   PIN is rejected with the honest reason.

7. **Settings write-through spot checks.** Theme, density, and `long_term_days` (and the
   other persisted axes) **write through** and survive a reload. *Verified:* change →
   reload → the change persisted; no key without a live consumer (D-078).

8. **Reports Pack print artifact.** The Reports Pack **renders + prints** correctly
   (print geometry intact). *Verified:* the print artifact paginates cleanly, no clipped
   sections, per-entity sections present (P-3).

9. **No-egress mode.** With no-egress on: **zero outbound calls**, honest fallbacks on
   News/quotes surfaces (stale-flagged, never fabricated — Guarantee 5). *Verified:* a
   network trace shows zero egress; News/quotes degrade to honest stale/empty.

10. **Milestones append their own walk items here at close.** Still to ship: Help · Legal ·
    AI-surfaces (D-067/D-068) · R-45 (per-instrument + default news) · R-46 (Home summary
    cards) · chrome-sidebar-refresh (R-39). Each milestone's close ritual **adds its walk
    rows to this file** so the pre-release capstone stays complete.

    **✅ intraday-series (R-42) — CONSUMED at close (2026-07-18).** Its walk rows are folded
    into item 1 (the dr-25 regression) plus the three checks below:

    10a. **Mixed-currency book spot-check.** With **one USD, one INR, and one SGD-native**
    holding present: each holding's **value**, **day change**, and the **Net worth** total
    are all honestly converted to the base currency (the value-currency derives from the
    **quote**, not the drifted holding currency — W-1). A **deliberately rate-less
    currency** shows the flagged **fx-unavailable** state (served reason + confidence
    penalty, zero contribution) — **never a fabricated 1.0** (W-1b). *Verified:* the INR
    fund reads ~S$20 magnitude (not raw INR labelled SGD); TSLA/USD unchanged; a rate-less
    holding is flagged, not silently valued.

    10b. **Intraday series contain regular-session candles only.** Spot-check a **fresh**
    intraday fetch (1D 1-min / 5D 5-min): **no extended-hours rows** (US regular session
    09:30–16:00 ET only — W-3); no session-boundary spikes on the 5D chart.

    10c. **Fund P/L cost-currency distortion is a KNOWN state until R-43.** India funds
    recorded cost in SGD while NAV is INR, distorting unrealised P/L — a data-entry
    currency question folded into R-43 (trade-date cost-basis FX, with R-8 historical FX).
    *Verified in the R-43 walk*, not this one: confirm it is resolved when R-43 ships.

---

**Gate:** this walk runs **after** every milestone through R-39 has closed, immediately
before Gates C→F and the v2.0.0 tag. It is owner-driven (judgment); no self-certification
substitutes for it.

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

9a. **Smoke isolation fails closed.** Before any pre-pass is trusted as evidence, confirm the
    smoke harness **refuses** to drive the owner's live stack by accident. *Verified:* with no
    `SMOKE_BASE`/`SMOKE_API` set, `npx playwright test --config
    e2e/smoke/playwright.smoke.config.ts --list` **refuses to collect** (it does not silently
    default to `:5173`/`:8321`); with `SMOKE_API` pointed at `:8321` it **refuses** by name; and
    `npm run check:smoke-isolation` reports **zero hardcoded live ports**. The owner's own walk
    against the live instance is the deliberate `SMOKE_ALLOW_LIVE=1` path — *this walk item is
    what makes that flag meaningful.* **A pre-pass run without this confirmed is not evidence:**
    it may have been reporting on the wrong machine (08-TECH-DEBT, resolved `4af11f5`).

9c. **UX resilience around refresh & locking (same fix family) — filed R-63 3b, 2026-07-24.** Three
    related gaps observed on the live walk, one fix family:
    - **Stale-banner has no inline refresh action** — the "N prices are stale" banner states the problem
      but offers no way to act on it in place (the only refresh is the page-header button).
    - **Lock-timeout shows raw errors, and unlock does not refetch until navigate-away** — a session that
      times out mid-view surfaces raw error text, and re-unlocking leaves the stale view until the user
      navigates elsewhere and back (no refetch on unlock).
    - **A long op's status is lost behind the lock** — a net-worth rebuild (or similar long-running op)
      in flight when the lock engages loses its progress/status; the user can't tell it is still running.
    *Verified (when taken):* the stale banner carries an inline Refresh; an unlock refetches the current
    view in place; a long op's status survives (or is honestly re-surfaced after) a lock engage — no raw
    error strings, no silent stall. **Same fix family — take together.**

9d. **Polish — the Source-override picker capitalizes "Alphavantage" (filed R-63 pre-close, 2026-07-24).**
    The instrument Edit dialog's Source-override picker (and the Settings routing-matrix picker) renders
    **"Alphavantage"** (title-cased by `labelFor`) while the canonical vocabulary value is lowercase
    **`alphavantage`** (`frontend/src/mocks/refdata.ts:85`; the Identity chip renders "AlphaVantage"). A
    cosmetic label inconsistency across the provider-name surfaces. *Verified (when taken):* one canonical
    display form for the provider name across picker / chip / Settings. Cosmetic — pre-release polish.

9e. **F-G — a coingecko crypto holding stays stale through "Refresh all market data" (filed R-63 close,
    owner R10, 2026-07-24). ⚑ PRE-RELEASE FIX ITEM — its own, diagnose-first, NOT folded into R-63.**
    Owner evidence: **BTC, 12:41 screenshot** — the crypto holding's quote stays stale after *"Refresh all
    market data"* and updates only via **Settings → Data feeds → Sync now**. The refresh explainer's
    carve-out covers **instrument masters**, not **holding quotes** — so this is either a **routing defect**
    (the coingecko lane isn't in the refresh universe / isn't fetched by refresh-data) or **undocumented
    design**: **diagnose first, then rule.** *Riders (same item):* (i) crypto **Identity shows Subclass
    "Equity" and Country "US" for BTC** — taxonomy defaults leaking into a Crypto-class instrument;
    (ii) the **"crypto detail" card title** → capitalized per DESIGN-SYSTEM conventions. Slotted after the
    R-63 close alongside the R-65-Phase-2/R-59 sequencing. Cross-ref: `r63-pricing-routing.md` (OWNER
    VERDICT, R10).

    ---

    **⟶ DIAGNOSIS (2026-07-24, diagnose-only — instrumented on an isolated repro; HARD STOP for owner
    ruling). VERDICT: NOT a routing defect — the routing is correct-by-design and TEST-PINNED. The real
    defects are (1) a served explainer that CONTRADICTS the design and (2) a genuine gap: "Refresh all"
    has no path to trigger the cache-publish lanes' own quote fetch. (R-63 lesson applied — the obvious
    story "coingecko isn't wired into refresh" is FALSE; the path was instrumented before ruling.)**

    - **(a) Does refresh walk the coingecko lane, and where does it drop out?** YES it routes the crypto
      to coingecko, then drops out. `POST /system/refresh-data` (`system.py:744`) → per-symbol
      `refresh_quote_detailed` (`market.py:660`). For a crypto, `route_for_instrument` returns
      `head="coingecko"`. But **`market.py:681`** excludes it from the execution net —
      `head not in _CACHE_PUBLISH` is FALSE (`_CACHE_PUBLISH = {"amfi_nav", "coingecko"}`,
      `router.py:198`). It then reaches `_refetch_route_mismatched` (`market.py:695`), which returns
      `None` at **`market.py:588-589`** because the cache is already on-route (`cached.source == "coingecko" == head`).
      So it serves the stale cache as `outcome="not_owned"` (`market.py:707-711`). **Isolated repro
      (mock active provider, on-route stale coingecko quote):** `route_head='coingecko' outcome='not_owned'
      fetched=False cg_fetch_calls=[] price=64665.62 is_stale=True`. This is **pinned as intended** by
      `tests/integration/test_route_mismatch_refetch.py::test_an_on_route_quote_is_not_refetched` —
      "an on-route quote must not trigger a refetch … which would burn the rate budget."
    - **(b) What does Settings "Sync now" do that refresh doesn't?** `POST /coingecko/refresh`
      (`coingecko.py:35`, file=None branch) refetches the coins/list master **AND** calls
      `publish_prices(fetch_prices(mapped_ids))` (`coingecko.py:60-61`) — a real price fetch that
      UPSERTS the quote cache. So Sync-now DOES side-effect quotes (master sync + fresh prices); refresh
      does not. (AMFI is symmetric: `amfi_refresh` publishes NAVs; refresh-all leaves amfi_nav quotes stale.)
    - **(c) Routing defect or undocumented design?** **Undocumented design.** The net-exclusion is CORRECT
      (the active equity provider must never price BTC/NAV) and the budget-driven on-route-no-refetch is
      recorded in code + test (§18-R3 F-7a). What is NOT recorded, and what CONTRADICTS the design, is the
      **served copy**: `PricingHealth.tsx:341-342` — *"refreshes quotes … Instrument masters (mutual funds,
      coins) aren't included"* — attributes the exclusion to **masters**, but the un-refreshed thing is the
      cache-publish-lane **QUOTE**. A user with a correctly-mapped BTC (master already synced) reads "masters
      not included, quotes are" and expects the price to update — it doesn't. Same class as R-52/Help
      ("describing itself falsely is a release bar"). Copy also at `PricingHealth.tsx:324` (tooltip) and the
      design comment `pricing-health.ts:152`.

    - **Fix options (owner to rule — NOTHING built):**
      1. **Copy honesty only (release-blocking honesty fix).** Rewrite the explainer so it says
         crypto/fund **quotes** refresh via their lane's Sync-now (Settings → Data feeds), not via
         Refresh-all — stop misattributing the carve-out to "masters." Backend untouched.
         *Blast radius:* `PricingHealth.tsx:324,341-342`; the pinning test
         `PricingHealth.test.tsx:353` ("names the excluded masters"); Help currency (Pricing Health
         entry); **closed-page rite** — dated delta note in `page-pricing-health.md` + a Pricing-Health
         pre-pass re-run.
      2. **Wire "Refresh all" to also publish the cache-publish lanes (budget-aware).** On the click
         (user-triggered, so within budget discipline — one `publish_prices` per lane per click), also
         trigger coingecko/amfi price publish. *Blast radius:* `system.refresh_data` or the frontend
         orchestration (it currently calls only `/system/refresh-data`, `pricing-health.ts:145`); egress
         + CoinGecko rate-budget handling; the per-lane refresh summary; new tests; reconcile against the
         §18-R3 on-route-no-refetch pin (a separate bulk-lane sync doesn't touch that path, but state it).
         Adjacent to **R-66** (background auto-refresh) budget/egress rulings.
      3. **Hybrid (RECOMMENDED).** Ship Option 1 now as the pre-release honesty fix (a page describing
         itself falsely is the release bar; the routing is already correct). File Option 2 as its own
         roadmap item — it is a design change touching the rate-budget/egress discipline (R-66 class),
         not a copy fix — and take it WITH the R-66/R-45 egress rulings. Feature-freeze discipline
         (R-63 §9-10 precedent).

    - **Rider A — BTC Identity Subclass "Equity" / Country "US" (taxonomy default-leak).** **Leak site:**
      `resolve_or_create_instrument` (`identity.py:53`) — `identity.py:91` defaults an omitted
      `asset_class` to `AssetClass.EQUITY`; `classify_defaults` (`identity.py:46`) sets
      `asset_subclass = asset_class` → "equity"; `identity.py:96` → `country_for_symbol` bare-ticker
      default **"US"** (`symbols.py:78`). **Trigger:** the add-holding form `POST /portfolio/transactions`
      (`portfolio.py:689-697`) passes `asset_class=payload.asset_class`, which is `None` when the form
      omits it (`TransactionIn.asset_class` default None, `portfolio.py:562`) — so a crypto added without
      an explicit class leaks EQUITY/US. `coingecko.py:99` later sets `asset_subclass="crypto"` **only via
      the explicit map endpoint**, and **nothing** corrects `listing_country`, so the "US" persists.
      **Correct crypto shape per specs:** `asset_class = crypto` (MASTER-DATA §2, `MASTER-DATA.md:56`);
      `asset_subclass = crypto` (DEF-2, `MASTER-DATA.md:138`). **⚠ OPEN QUESTION (do not invent):**
      MASTER-DATA assigns crypto **no `listing_country`** (it is a listing concept; crypto is borderless).
      The in-code precedent **§14dr-27(b)** already leaves a non-equity's country **unknown** (csv_import
      passes `country=None`; `identity.py:93-96`). The fix should **ratify "crypto → listing_country
      unknown"** against §14dr-27(b) rather than pick a value — owner to confirm the target (null vs a
      sentinel). *Ties into R-59 (the add-holding form): the form should classify crypto and pass the class.*
    - **Rider B — "crypto detail" card title casing.** **Site:** `InstrumentDetail.tsx:276` —
      `{detailPanel[0].replace(/_/g, " ")} detail` composes the lowercase `asset_detail` key + "detail"
      → "crypto detail" / "mutual fund detail" / "derivative detail". **Convention:** the sibling
      `.idp__h2` titles on this same (accepted) page are all **Sentence case** — "Identity",
      "Price history", "Your position", "Explain this instrument". *(No explicit written casing rule in
      DESIGN-SYSTEM; the convention is de-facto from ratified sibling usage — flag.)* **One-line fix
      scope:** uppercase the first character of the composed label (Sentence case → "Crypto detail"),
      **not** CSS `text-transform: capitalize` (that Title-Cases every word → "Mutual Fund Detail").
      Single line at `InstrumentDetail.tsx:276`; **closed-page rite** (dated delta in
      `page-instrument-detail`/relevant plan + a pre-pass re-run). No test pins the current lowercase title.

    ---

9f. **Page-load performance profiling pass (filed R-63 close, owner, 2026-07-24).** Owner evidence:
    **Portfolio worst** (12:49 skeleton-state screenshot), **Home/Holdings sluggish**. A profiling pass —
    where the load time goes per page — with **severity assessed at the pre-release walk** (may fold into
    R-46 Home cards / R-39 chrome work if adjacent). Not release-blocking until measured.

10. **Milestones append their own walk items here at close.** Still to ship: Help · Legal ·
    AI-surfaces (D-067/D-068) · R-45 (per-instrument + default news) · R-46 (Home summary
    cards) · chrome-sidebar-refresh (R-39). Each milestone's close ritual **adds its walk
    rows to this file** so the pre-release capstone stays complete. *(R-42 and R-43 have
    been consumed — see below.)*

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
    **→ RESOLVED in the R-43 walk (closed 2026-07-19)** — trade-date cost-basis FX shipped
    and the exclusions are loud (F-3). Kept here as a **regression** check only.

    **✅ historical-backfill (R-43) — CONSUMED at close (2026-07-19).** Its walk rows:

    10d. **Mixed-provider backfill spot-check.** Re-run **Build history** on the real
    instance and read the **per-instrument** outcomes (`instrument_acquisitions`), not just
    the headline: **funds top up (`ok=1`)** — or fail with an **honestly named transient**
    (`AmfiReportUnavailable` / a timed-out fetch **named in the log AND the row**, F-9c),
    never a silent zero and never "malformed"; **crypto respects the 12h skip** (F-8b) and
    does not re-spend a fresh window. *Verified:* every held instrument has a row whose
    `ok`/`rows`/`source`/`reason` match what the log says happened; a re-run inside 12h
    skips crypto rather than refetching it.

    10e. **The trend renders at full coverage with its honest note.** The Net-worth trend
    shows **6/6 coverage** and **ends at the live headline** (the two valuation bases agree
    — F-1/F-2), and the **CoinGecko 365-day carried note is VISIBLE** where a crypto
    holding predates the public-API window. *Verified:* the trend's last point equals the
    headline; the carried note renders as served text (never invented copy); no square
    pulse, no flat plateau standing in for a cost.

    10f. **§20-P — `LEDGERFRAME_SECRET_KEY`. GATE-C BLOCKER BEFORE EXPOSURE.**
    `ledgerframe.log` carries on **every boot**: *"SECURITY: weak LEDGERFRAME_SECRET_KEY
    (placeholder/short) — tolerated on a loopback-only bind, but set a strong one before
    any LAN/remote exposure."* The tolerance is **correct** for the current loopback-only
    dev bind and the warning is doing its job — but a strong key **must** be set before
    **ANY** LAN or remote exposure (`python -c "import secrets;
    print(secrets.token_urlsafe(48))"`). *Verified:* a strong key is set and the boot
    warning is **absent** from the log before any non-loopback bind. **This one is a
    blocker, not a check** — it does not wait for owner judgment to be worth doing.

    10g. **TWR / 1Y compute once the coverage windows fill.** The performance card is
    **coverage-gated by design** (F-2 refuse-until-coverage): until a metric's window is
    covered it must **refuse with its served reason and basis label** — which is the
    honest state, not a defect. *Verified:* with coverage present, TWR/1Y/max-drawdown
    compute and carry their basis labels; where a window is still short, the card names
    what is missing rather than printing a −99.9% artifact of empty FX history.

---

**Gate:** this walk runs **after** every milestone through R-39 has closed, immediately
before Gates C→F and the v2.0.0 tag. It is owner-driven (judgment); no self-certification
substitutes for it.

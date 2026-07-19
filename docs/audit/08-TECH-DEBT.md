# 08 — Tech Debt

No `TODO`/`FIXME`/`HACK`/`XXX` markers exist in `app/` or `frontend/src/` (verified by grep) —
the codebase is unusually clean and heavily commented. The debt below is structural: dead
code/tables, duplication between frontend and backend, unfinished "schema-only" features, and
inconsistent patterns.

## 1. Dead / unused tables & code

| Item | Evidence | Recommendation |
|------|----------|----------------|
| `ProviderConfig` table | No reads/writes anywhere outside `models/__init__.py` (provider selection lives in `.env`) | Drop or wire up |
| `Note` table | Defined only; no route reads/writes notes | Drop or build the feature |
| `AIConversation` / `AIMessage` tables | Only referenced in `system.py` reset-data deletion; AI chat is SSE and **never persists** conversations | Drop, or persist chat history if a "history" feature is intended |
| `DashboardConfig` / `DashboardRotationItem` tables | Created only by `seed/demo.py`; rotation is driven client-side + `settings` rows (`focus_page`, `rotation_pages`) | Consolidate rotation storage into one mechanism (settings rows) and drop these, or wire them |
| `verify_token()` (`core/security.py:66`) | "kept for callers without a DB session" — no callers found | Remove if truly unused |
| Commented-out `_carry_forward` (`analytics.py:194-205`) | A dead duplicate above the live version | Delete |
| `/global` route (`App.tsx:170`) | Legacy redirect to `/markets` | Remove once no bookmarks rely on it |
| `Account` fetched-but-unused (`portfolio.py:378,395`) | `account = await session.get(...)`; then `if account: pass` | Remove the no-op |

## 2. Two storage mechanisms for the same thing

| Concept | Mechanism A | Mechanism B | Fix |
|---------|-------------|-------------|-----|
| Dashboard rotation / focus | `DashboardConfig`/`DashboardRotationItem` tables (seeded) | `settings` rows + client localStorage | Pick one (settings rows) |
| Briefing text | `settings` rows (`daily_briefing`, `daily_briefing_ts`) | — (fine) | — |
| View mode / density / theme / nav | localStorage only (client) + some `settings` allow-list keys (`focus_page`, `rotation_pages`, etc.) never read back | | Decide client-only vs server-persisted; the allow-listed keys `privacy_mode`, `reduced_motion`, `high_contrast`, `voice_enabled`, `display_sleep_minutes`, `ai_model`, `focus_page`, `rotation_pages` are writable via `PUT /settings` but not obviously consumed |

## 3. Duplicated logic (frontend ⇄ backend, and within a layer)

| Logic | Locations | Risk |
|-------|-----------|------|
| **Signed cash-impact** | `portfolio.py:_txn_cash_impact`, `csv_import` convention, `analytics.py:_signed_flow` | 3 copies of the buy/sell/dividend sign rules — can drift |
| **Master lists (currencies)** | `config.SUPPORTED_CURRENCIES` (9), `refdata.ts` CURRENCIES (14), `PortfolioEditor` inline (22) | 3 divergent lists |
| **Asset classes** | backend `AssetClass` (13), `api.ts:ASSET_CLASSES` (13), `refdata.ts` (13), `TXN_ASSET_CLASSES` (6) | 4 copies |
| **Transaction types** | backend `TxnType` (11, incl. `merger`), `api.ts:TXN_TYPES` (10, **omits merger**) | UI cannot record a merger; `merger` absent from frontend entirely |
| **Reason/label vocab** | service `*_meta` endpoints vs `refdata.ts`/`policyTemplates.ts` client copies | drift |
| **`strip_reasoning`** | `ai/prompts.py:strip_reasoning` + `services/briefing.py:_strip_reasoning` | 2 near-identical fns |
| **Portfolio value figures** | `/portfolio/summary`, `/portfolio/holdings` each re-run `value_portfolio` *(`/dashboard/home` **RETIRED** 2026-07-13 — page-home §9-4)* | recomputation |
| **Rotation settings are WRITE-ONLY (D-078 violation)** | `rotation_pages` + `focus_page` are allow-listed and writable (`settings.py`), but **nothing consumes them**: the top-bar rotation toggle is UI-only state with **no interval and no navigation** (`AppShell.tsx:50`, `TopBar.tsx:78`) | D-078 requires every allow-listed key to be **"either consumed or removed"**. Queued as a **chrome** task (D-044/D-078) — **out of Home's scope** (page-home §9-14); slots with Settings |
| **Review feeds** | `/portfolio/review` (`review_report`) vs `/review/centre` (`review_centre`) | overlapping reads |
| **Headlines/news** | `/news`, `/news/grouped`, per-instrument, Home/Markets all fetch feeds | repeated live fetches |

## 4. Unfinished "schema-only" features (columns present, not consumed)

Per model comments (02) and code:
- `instruments.domicile_country` — added, never read (only `listing_country`/`country` used).
- `accounts.cost_basis_method = "average"` — engine branch **exists** (`tax.fifo_report(method=...)`),
  but **no UI to set it** and the "spec" method is deferred; every account is `fifo`.
- `transactions.related_instrument_id` (merger) — `resolve_mergers` handles it, but there's **no UI
  to record a merger** (TxnForm omits the type), so it's unreachable from the app.
- `transactions.fx_to_base`/`fx_base` — captured on new same-day trades; historical rows are NULL;
  surfaced only as a secondary realised total. Backfill impossible (honest).
- `ProviderConfig.config_json`, `AIMessage.facts_json` — defined, unused.

## 5. Inconsistent / fragile patterns

- **Simple/Expert mode is nearly a no-op**: only `Home.tsx` and `Settings.tsx` branch on `mode`
  (`store/app.tsx`). Every other page renders identically. Either wire it through all pages or
  scope it to Home explicitly. Default is `expert`.
- **`value_portfolio(warm=True)` on-demand fetch** inside a read path can make GETs slow on
  rate-limited providers; mitigated by `fetch_on_demand` and time budgets but fragile.
- **Naive/aware datetime normalisation** repeated in many places (`_sort_ts`, `_naive`,
  `_carry_forward`) — SQLite returns naive; a repeated source of `can't compare` bugs. Centralise.
- **Broad `except Exception`** (`# noqa: BLE001`) is pervasive for resilience — intentional but
  hides errors; ensure logging is adequate.
- **Client-side CSV export** (Holdings) duplicates server CSV exports (statements/realised) — two
  code paths for "export".
- **`_get_or_create_instrument`** auto-creates instrument rows on many read paths (markets
  overview, quotes) — side effects in GET handlers.
- **Reports page AI helper** streams via `streamChat` (direct fetch) — inconsistent with the
  centralized `api` client; also InstrumentDetail, AskPanel, AiConfigCard use direct fetch.

## 6. Test coverage (observed from `tests/`)

Strong integration + unit coverage (~90 test files) across auth, routing, FIFO, XIRR/TWR, FX,
confidence, soft-delete, migrations, AI grounding/safety, provenance, entities, tax. Gaps worth
checking:
- No obvious tests for the **frontend** beyond `format.test.ts` / `persona.test.ts` (2 files);
  no page/component tests, no Playwright specs committed under `frontend/src` (playwright.config
  exists — e2e likely elsewhere / memory notes e2e gotchas).
- Dead tables (Note/ProviderConfig/AIConversation) have no behavioural tests (nothing to test).
- `cost_basis_method="average"` engine branch is tested (`test_average_cost.py`) but has no UI/API
  to select it — a tested-but-unreachable path.

## 7. Miscellaneous

- Large single-file modules: `app/models/__init__.py` (685), `services/analytics.py` (718),
  `services/help.py` (549), `services/market.py` (563), `routes/portfolio.py` (797),
  `routes/system.py` (611), `frontend/.../Settings.tsx` (495), `PortfolioEditor.tsx` (469).
  Consider splitting models per domain and portfolio routes by concern.
- Two large stale session-transcript `.txt` files in the repo root (`2026-06-28…`, `2026-06-30…`)
  and a `09-Jul-2026` file — likely accidental commits / working notes; should be gitignored.

## v2 findings (post-audit)

- **`GET /system/staleness` is orphaned** (found 2026-07-12, page-pricing-health §9 ND-9): the
  endpoint exists but has **no frontend consumer** — the StaleBanner reads `summary.stale_count` and
  Pricing Health reads `/portfolio/pricing-health`, both over `value_portfolio`. **Candidate for
  removal at a future contract-review milestone.** Contract is frozen (API-CONTRACT.json); **no change
  now** (removal is a contract delta with its own review).

<!-- AUDIT COMPLETE -->

## Untyped policy routes — `response_model` DEFERRED (page-policy §9-10, owner 2026-07-14)

`GET /api/v1/policy` and `GET /api/v1/policy/drift` return a bare `dict` (`routes/policy.py`), so their
response shape is **not pinned in the OpenAPI contract** — only their served **values** are pinned, by
tests.

**Typing them is DEFERRED, deliberately, and it was NOT bundled into the page-policy build.** The reason
is the **page-markets §12mk3-2 hazard**: a `response_model` **silently strips any key it does not
declare**. The page-policy Phase 0 batch *added* served fields (`gross_assets`, the `*_display` strings,
`concentration[].symbol`, the A10 staleness annotation) — adding a `response_model` in the same change is
exactly how one of those fields vanishes **unnoticed**, with the contract regenerating cleanly around the
hole.

**When it is done:** as its **own change**, with an assertion that **every currently-served key survives**
the typing. Until then the status quo (untyped, value-pinned) blocks nothing.

## Card-header anatomy — `.lf-card__header` styles nothing (flagged at page-cash-flow Phase 0a, owner 2026-07-15)

**`.lf-card__header` has NO CSS RULE.** `.lf-card` and `.lf-card__body` are ratified (D-100), but the card
**header** is not: **Policy uses `.lf-card__header`, and it styles nothing** — its staleness chip falls
under the title by accident, not by design. Meanwhile every other page that needs a card header has
**invented its own** (`.nw__cardhead` on Net worth, Pricing Health's, News's, and now `.cf__head` on Cash
flow).

**The page-local header treatments EXCEED the centralization threshold** (the rule that extracted
`Segmented`, `StatusChip` and `Button`: *per-instance copies of a standard are the defect*).

**Consolidate onto a `SummaryHead`-derived anatomy — as its OWN task, NOT as a rider on any page build.**
The reason it is not folded into a page: **Policy is an ACCEPTED page**, and centralising the header would
**change its rendered geometry**. That is a deliberate, owner-visible change with its own before/after —
not something to smuggle into an unrelated build. *(It was deliberately left un-fixed at the page-cash-flow
geometry gate for exactly this reason.)*

## e2e flake — one unreproduced failure (2026-07-15, pre-Phase-0a run)

**A full Playwright run reported `1 failed · 177 passed`; the immediate re-run was clean (`178 passed`),
and every subsequent run has been clean.**

⚠ **THE TEST NAME WAS NOT CAPTURED — recorded honestly rather than guessed.** The failing spec's name was
not printed by the filter used on that run, `test-results/` was empty by the time it was checked, and
inventing a plausible name would be worse than admitting the gap. **The gap is itself the finding: a flake
with no name cannot be hunted.**

**Posture: A FLAKE IS A LATENT RACE UNTIL PROVEN OTHERWISE.** It is not "just a flake" — it is a defect
whose trigger has not been identified yet. **Recurrence promotes this to a defect** and it gets a name, a
reproduction and a fix.

**Tooling note earned here:** a full-suite run must **capture the failing test's identity** (keep the
reporter output / `test-results/`) — not just the pass/fail counts. A failure you cannot name is a failure
you cannot chase.

## vitest teardown flake — `window is not defined` from `InstrumentPicker` onBlur timer (named, 2026-07-16)

**Surfaced during the Estate Phase-2 run:** one `npm run check` exited 1 with an **uncaught exception AFTER
all 227 tests passed** — `ReferenceError: window is not defined` originating in `ui.test.tsx`
(`InstrumentPicker`). Immediate re-runs were clean (`npx vitest run` → EXIT 0, **0 window-errors across 3
consecutive runs**; the follow-up `npm run check` → EXIT 0). Not caused by the Estate change (it touches no
InstrumentPicker/ui.test.tsx code — both unchanged in the diff).

**Named trigger + reproduction (this flake HAS an identity, unlike the 2026-07-15 one):**
`InstrumentPicker.tsx:111` schedules `window.setTimeout(() => setOpen(false), 150)` on **blur** and never
clears it on unmount. When a test tears down the jsdom environment before that 150 ms timer fires, the
callback runs `setOpen` → React touches `window` after it is gone → uncaught `ReferenceError`. It is a
**latent race** per the standing rule, not "just a flake."

**Fix (deferred — unrelated to Estate, kept out of this build's scope):** clear the blur timeout in a
`useEffect` cleanup (store the id in a ref, `clearTimeout` on unmount), the standard React timer-hygiene
fix. Cheap and safe, but it edits a shared component mid-page-build; done as its own small change. Until
then a rare `npm run check` exit-1 with **all tests green + this exact stack** is this flake, not a
regression — re-run to confirm.

## CI e2e runs WITHOUT a backend — page-level assertions execute only locally (page-cash-flow §13c, 2026-07-15)

`npm run check`'s Playwright pass has **no server**: product pages render their honest empty/error states,
not data. So any **page-level** e2e assertion that needs real rows **runs only locally** (against a dev
backend) and is **silently absent in CI** — a page test can be green on a developer's machine and *never
execute* in the pipeline.

**Surfaced concretely (page-cash-flow §12cf1):** two new **component** guards (the table-header pixel check;
the icon+label button) were written against product pages, passed locally, and **timed out in the full CI
run** because those pages were empty there. They were moved onto the **backend-free `/kitchen-sink`
specimen**, which is the correct home for a component guard.

**The gap itself is unclosed and is ITS OWN TASK.** Either stand up a **CI backend** (seed a deterministic
instance for the e2e pass) or introduce an **explicit local-only e2e tier** (so a page-level assertion is
*named* as local-only rather than silently skipped). Until then: **component** guards go on the specimen, and
**a new e2e guard is validated by running the FULL suite, not the file in isolation.**

## Intermittent 500 on `/portfolio/stats` under a concurrent load burst (surfaced 2026-07-15)

**`GET /api/v1/portfolio/stats` returned a 500 during the `review-smoke` pre-pass's Net-worth leg** (a full
page load fires many readers at once). **Reproduced 2/2 in that flow — but 200 on EVERY sequential hit**
(direct curl, cold-cache-after-reset ×3, and its 7 integration tests all pass). So it is a **concurrency
race**, not a broken endpoint: it manifests only under the simultaneous-request burst of a rendered page,
not under sequential calls.

**Not caused by the 2026-07-15 change** (that diff touched only `app/services/review.py`; `/portfolio/stats`
is a Net-worth/Portfolio reader, untouched). Surfaced *by* running `review-smoke` to verify the Review
change — a dev-only pre-pass for another page.

**Posture (the standing flake rule):** a flake is a **latent race until proven otherwise**. This one has a
named trigger (concurrent burst during a Net-worth-class page load) and a named endpoint, so it is a
**hunt-able latent defect**, not "just a flake." **Recurrence promotes it to a defect** with a reproduction
and a fix — the natural place to chase it is the **Net worth / portfolio-stats** path (likely a shared
FX/valuation resource raced under concurrency), not a Planning page.

## `review-smoke` referenced the retired `.rv__chip` (migration follow-up, fixed 2026-07-15)

The Review severity chip was migrated to the ratified **`StatusChip`** (`.lf-statuschip`) in the Policy
StatusChip extraction (page-policy §9-15). The **dev-only `review-smoke` pre-pass** still selected the
retired **`.rv__chip`** — stale since that migration, and only surfaced now because nobody had re-run the
Review pre-pass since. Selectors updated (`.rv__chip` → `.lf-statuschip`); the assertions are unchanged.
**Lesson (already the §11-4 rule):** a selector/label migration must grep **the dev-only smoke specs too**,
not just shipped code and CI tests — they are the ones that rot unseen because they run by hand.


## `/portfolio/scenarios` untyped — `response_model` DEFERRED (page-scenarios §3b, 2026-07-15)

`GET /api/v1/portfolio/scenarios` returns a bare `dict`; its shape is pinned by **values** (tests), not by
the OpenAPI contract. Typing it is **deferred** for the §12mk3-2 reason a `response_model` **silently strips
any undeclared key** — and the Phase-0 batch *added* served fields (`*_display`, the A10 annotation), exactly
the moment a strip vanishes a field unnoticed. When done, as its own change, with an assertion that every
served key survives.

## `/estate` untyped — `response_model` DEFERRED (page-estate §3b, 2026-07-16)

`GET /api/v1/estate` returns a bare `dict` (`{profile, contacts[], documents[], readiness, disclaimer}`);
its shape is pinned by **values** (tests), not by the OpenAPI contract. Typing it is **deferred** for the
§12mk3-2 reason a `response_model` **silently strips any undeclared key** — the same hazard the Policy and
Scenarios deferrals record. Estate's Phase 0 only **removed** a surface (`/estate/meta`) and **retired** a
field (`relationship`); it added no served field, so the status quo (untyped, value-pinned) blocks nothing.
When done, as its own change, with an assertion that every served key survives.

## Input-quality helper duplicated across readers (recorded 2026-07-15)

The Gate-A10 *(stale, low-confidence)* input-quality logic now lives in **`confidence.portfolio_input_quality`
/ `inputs_quality_note`** (extracted for page-scenarios, which uses it — no new copy). But **`policy.py` and
`review.py` still carry their own copies** (`_input_quality`, `_inputs_note`, and Review's two inline sums).
Per the centralization rule they should migrate onto the shared helper — **as its own behaviour-neutral
task**, NOT rewired mid-Scenarios-build on accepted pages (their pre-passes would need re-verifying). Recorded
so the consolidation is a decision, not forgotten.

---

## Pre-existing frontend-suite unhandled error — `CashFlow.tsx:330` (found 2026-07-16, page-insurance Phase 0) — ✅ RESOLVED 2026-07-16 (this hygiene commit)

**RESOLVED** in a dedicated hygiene commit: the obligations/contributions/goals section reads are now
optional-chained (`(obs.obligations?.length ?? 0)` etc., matching the page's existing `?? []` defensive
reads), so a partial mock can no longer crash the render — real API behaviour unchanged (the readers always
serve the arrays). Fail-first: the `AppShell` `/snapshot` redirect test reproduced the unhandled
`TypeError` before the guard, green after. `npm run check` exits 0. *(The same commit also fixed a
collateral `TrendStat` regression the batch-2 §14in-7 affix introduced — a zero-width-space break had split
the value's text node, breaking `getByText` in `Insurance.test.tsx`; the affix now wraps via `.lf-stat__value`
flex-wrap instead, keeping DOM text nodes clean. Both were required for a green `npm run check`.)* Delta
note in `docs/plans/page-cash-flow.md`. Original entry preserved below.

`npm run check`'s Vitest run fails with **one unhandled error** (all 208 tests still PASS): `TypeError:
Cannot read properties of undefined (reading 'length')` at **`CashFlow.tsx:330`** (`obs.obligations.length`),
thrown asynchronously while `AppShell.test.tsx`'s `/snapshot` **redirect** test incidentally renders CashFlow
with a mock whose `obs` lacks `obligations`. **Verified pre-existing** — it reproduces at `c0e9fb1` (the
scenarios close, before any insurance work), and it is a **test-harness / partial-mock race**, not a product
regression. **Not touched by the insurance build** (no insurance commit changes CashFlow/AppShell). Fix is a
one-line defensive guard (`obs?.obligations?.length` or an early `obligations ?? []`) **on an accepted page**,
so it belongs in **its own hygiene commit**, not mid-insurance-build (the "make lint RED on trunk" precedent,
page-heatmap close). Until then the frontend `npm run check` exits non-zero on this alone.

---

## CSV import silently attributes to the first account — `csv_import.py:428-438` (recorded 2026-07-16, page-accounts §9-12 Recording Note) — OPEN

**RECORDED, NOT FIXED** — the owner ruled §9-12 to keep the import↔account-creation seam (account
**creation** lives only on `/accounts`) and to flag this fallback as a Holdings-page follow-up, not to
re-solve it during the Accounts backend.

`/portfolio/import/{csv,commit}` take an optional `?account_id`; the frontend import UI passes **none**
(`holdings.ts:186-192`; `Holdings.tsx` `ImportDialog`). `_ensure_account` (`csv_import.py:428-438`) then
**silently falls back to the first account**, else **auto-creates an `"Imported"/brokerage` account**.

**Risk:** mis-attribution — imported holdings land on whatever account happens to sort first (or a
surprise auto-created one), with **no honest signal** to the user that the attribution was guessed. This
is the same class of silent-fallback honesty gap the platform elsewhere converts to an explicit choice or
an honest message (Guarantee 3).

**Follow-up home:** the **Holdings page** (`page-holdings.md`) — the import UI should make the target
account an **explicit choice** (an account picker, optionally linking to `/accounts` to create one first),
so the attribution is chosen, never guessed. Not an Accounts-page capability (no new capability was added
to Accounts by recording this).

---

## TD — `test_reports_pack.py` + `test_performance.py` fail by TEST ORDER, not by code (found 2026-07-19, page-help Phase 1)

**Status: PRE-EXISTING. Not caused by the Help milestone — proven by controlled comparison.**

**Symptom.** A solo full-suite run reported **5 failed / 1406 passed**, all inside
`tests/unit/test_reports_pack.py` and `tests/integration/test_performance.py`
(`test_key_stats_endpoint` fails with a SQLAlchemy error; the Pack tests fail on rendered content).
The *same* files had passed in a targeted run 30 minutes earlier, and an earlier solo full run the
same day was **1360 passed / 0 failed** on nearly the same tree.

**It is ORDER/SHARED-STATE, not contention and not content:**
- `test_reports_pack.py::test_reports_pack_route_serves_html_with_the_header_block` **passes alone**
  (1 passed in 22.69s).
- Running the two files **together** reproduces it: **7 failed / 12 passed**.
- The run logs show the suite mutating shared DB state as it goes — e.g.
  *"§12-R3 wrong-instrument candle purge: purged 795 candle(s)"* — so what a later test sees depends
  on what an earlier one did.

**CONTROLLED COMPARISON (the reason this is filed rather than fixed here).** The same two files, in
the same order, run against a **clean worktree at `2b54eb2`** — the commit immediately *before* the
Help milestone, with none of its changes present:

| Tree | Result on `test_reports_pack.py` + `test_performance.py` |
|---|---|
| **baseline `2b54eb2`** (pre-Help) | **9 failed / 10 passed** |
| **Help branch** (post Phase 1) | **7 failed / 12 passed** |

The defect is **present on untouched code**, and the Help milestone's changes *reduced* the failure
count by two (it corrected two assertions that had pinned the D-021-retired "Total value").

**Why this matters beyond the fix.** A suite whose verdict depends on execution order gives a
**green that does not mean what it says** — the 1360/0 run and the 1406/5 run were both "solo" and
both honest reports of the same code. Until this is closed, *no single full-suite run is on its own
proof*; a failure in these two files must be re-checked in isolation and against the baseline before
it is attributed to a change.

> **NEW DATA POINT — 2026-07-19, page-help §9-bis-12 (Step F gates).** The same pair, same order,
> on the completed Help tree: **19 passed / 0 failed** (89.7s). The solo full suite the same hour:
> **1603 passed / 15 skipped / 0 failed** (10m45s).
>
> **This is NOT a claim that the defect is fixed, and it must not be read as one.** Nothing in this
> milestone touched `test_reports_pack.py`, `test_performance.py`, or their fixtures. Three
> recorded runs of the identical command now read **9 failed**, **7 failed**, and **0 failed** —
> which is precisely the symptom, not its resolution: *a suite whose verdict depends on execution
> order gives a green that does not mean what it says.* A green pair is exactly as weak a signal as
> a red one until the shared state is isolated. Recorded because the numbers are owed, not because
> they settle anything.

**Scope of the fix (its own task, not this milestone's):** give these modules per-test DB isolation
(the fixtures currently share seeded state and mutate it), or make the mutating purges idempotent /
scoped. Reproducing ref: `pytest tests/unit/test_reports_pack.py tests/integration/test_performance.py`
run in that order.

## The "isolated" pre-pass protocol is NOT enforced — 18 smoke specs hardcode the owner's backend port (found 2026-07-19, page-help §9-bis-11 Step F) — **OPEN**

**The protocol says** every walk/re-run happens on an **isolated instance** (spare ports, temp data
dir, owner's live stack never touched). **`SMOKE_BASE` redirects only the BROWSER.**

**Every `page.request.*` call in a smoke spec talks to the API DIRECTLY**, bypassing the frontend
proxy — and **18 specs hardcode `const API = "http://127.0.0.1:8321/api/v1"`**, the owner's
backend. So an "isolated" pre-pass drives the spare-port instance in the browser **while sending
its writes to the owner's live database.**

**This is not hypothetical. It happened during this milestone's Policy re-run.**
`policy-smoke.spec.ts` issued `PUT /policy/targets`, `PUT /policy` and `PUT /settings` against
**`:8321`** while the browser drove `:5199`.

> **NOTHING WAS WRITTEN — and the reason is luck, not design.** The owner's instance was
> **PIN-locked** and answered **401** to every request (verified read-only afterwards:
> `GET /api/v1/policy` → `401 {"detail":"Locked. Unlock with your PIN."}`). Had the instance been
> unlocked — which is its normal state while the owner is using it — the pre-pass would have
> **wiped his policy targets and rewritten his concentration limit**, silently, as a side effect of
> a test claiming to be isolated.

**Detected because the spec FAILED** (`expect(put.ok())` on a 401), not because anything checked
isolation. **A pre-pass has no way to notice it is talking to the wrong machine.**

**Fixed here (2 of 20):** `policy-smoke.spec.ts` and `settings-smoke.spec.ts` now use
`(process.env.SMOKE_API ?? "http://127.0.0.1:8321") + "/api/v1"` — the pattern
**`reports-smoke.spec.ts:12` already had**, which is why this was a propagation failure rather than
an unknown. Isolated runs use:

```
SMOKE_BASE=http://127.0.0.1:5199 SMOKE_API=http://127.0.0.1:8399 \
  npx playwright test --config e2e/smoke/playwright.smoke.config.ts <spec>
```

**Still OPEN — the remaining 18 specs**, and the deeper problem: *the environment variable is
opt-in, so forgetting it silently re-targets the owner's machine.* The real fix is to make the
harness **fail closed** — e.g. the smoke config refuses to run when `SMOKE_BASE` is set but
`SMOKE_API` is not, so a half-isolated run is impossible to express rather than merely
discouraged. Remaining specs: `accounts-journey`, `accounts`, `news`, `markets`, `heatmap`,
`cash-flow`, `cash-flow-editor`, `insurance`, `net-worth` (3 inline URLs), `estate`,
`reports-pack-journey`, `review`, `first-run`, `pricing-health`, `portfolio`, `scenarios`,
`reports-artifact`.

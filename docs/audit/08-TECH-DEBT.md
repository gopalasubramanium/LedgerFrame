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

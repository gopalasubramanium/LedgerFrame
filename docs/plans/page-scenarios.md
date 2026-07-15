# page-scenarios — build plan

**Status: ✅ DONE — page ACCEPTED (owner, 2026-07-15). Phase 3b walk (§14 batch 1) ratified at re-verify;
close-out in §15. `/scenarios` is live.** Fastest full loop yet — one walk batch. See §15 for the CLOSE
lines and the milestone retrospective.

Drafted 2026-07-15 from `TEMPLATE-page-build.md`. The **verify-first pass
(D-019) is done** — §10 records what the scenario engine **actually serves and what it actually guards**,
with `file:line` cites. **Nothing is built.** Every ambiguity is in **§9**; the owner resolves them
**one-pass**. **I resolved none.**

Scenarios is a **Planning**-group page (IA §2/§3): **deterministic what-if shocks on today's values — a
scenario, never a forecast** (D-058, IA §2). Its protected copy bar is D-058's, the D-055-equivalent for this
page:

> **"A scenario, never a forecast."** No probability, no prediction, no projection, no recommendation. It is
> **arithmetic on today's values**, and the copy must never imply a future.

**Headline of the verify-first pass — six findings, all in §9:**

1. ✅ **The reader exists, is frozen, and is READ-ONLY.** `GET /api/v1/portfolio/scenarios` (`scenario_report`,
   `services/scenarios.py`) serves the **7-shock fixed set + 2 liquidity what-ifs + exposures**. **No write
   path exists** and none is wanted (§10-6). **The forecast-language audit is CLEAN** — the only
   forecast/prediction/projection words in the whole surface are in the **disclaimer that forbids them**
   (§10-7).
2. ⚠ **Exposures are aggregated in a PRIVATE LOOP over holdings, not via Portfolio's canonical
   `allocation()`** — the **A11 pattern**. `crypto` and `property` are figures Portfolio already serves as
   allocation-by-class; Scenarios re-derives them (§10-4).
3. ⚠ **No staleness/confidence layer — the A10 gap.** The what-ifs run on `value_portfolio`'s market values,
   which **may be stale**; the valuation even carries `has_stale`, but `scenario_report` **drops it**. The
   disclaimer says *"on today's values"* — which answers the **forecast** bar but not the **staleness** of
   those values (§10-3b).
4. ⚠ **Money is served as raw floats** (`_f`), and the **D-105 scope amendment** (money = served display
   strings everywhere, ratified 2026-07-15) now binds this page (§10-5).
5. ⚠ **The shock magnitudes are inline literals with no named constant and no rationale** — unlike Review's
   D-059 named-constant thresholds. They are a **distinct threshold family** (the **fixed shock set**,
   product-defined) that §9 must **name and locate**, not leave as scattered `-0.10`s (§10-2).
6. ⚠ **`?entity_id` scopes the asset shocks but NOT the liquidity what-ifs** — a silently mixed-scope
   comparison, the **Policy §9-21 class** (§10-8). Plus the **SN-1** obligation-note vocabulary
   (already recorded) (§10-9).

---

## 1. IDENTITY

| Field | Value | Spec ref |
|-------|-------|----------|
| Page name (H1 = nav label = route) | **Scenarios** | IA §2, D-022 |
| Route | **`/scenarios`** | IA §2 |
| Nav group | **Planning** (Review · Policy · Cash flow · **Scenarios** · Insurance · Estate) | IA §3 |
| Page template | **Overview** — DESIGN-SYSTEM §3 **names Scenarios in the Overview row explicitly** (*"Composed dashboard of stat tiles, charts, and summary widgets"*). **NOT Worklist** — there are no records to manage; every figure is a **computed what-if** (§10-6). **Copied, not presumed.** | DESIGN-SYSTEM §3 |
| Rotation eligibility | **Eligible** — *"any nav page"* (D-044). Rotation **skips empty/erroring pages**; a scenarios page on an **empty portfolio** shows all-zero shocks — §9-9 decides whether that counts as "empty" and is skipped. | IA §3 (D-044) |
| One-line purpose | **Deterministic what-if shocks on today's values; a scenario, never a forecast.** | IA §2 |

---

## 2. OWNERSHIP TABLE

**Owns (canonical, authoritative, fully explained here):** — IA §5, D-058

- **The fixed shock set** — the 7 downside asset/FX scenarios and their per-shock impact on net worth
  (§10-1).
- **Exposures** — the base-currency totals the shocks are applied to (`equities` = equity + ETF + mutual
  fund; `crypto`; `property`; `foreign_fx` = non-base-currency holdings) — ⚠ but see §9-4 (whether these are
  re-derived or read from the canonical allocation reader).
- **The liquidity what-ifs** — *income stops* and *a large obligation drawn now*, computed from the canonical
  runway/planning readers.
- **The protected D-058 disclaimer** — *"Scenario, not forecast … not a prediction, probability or
  recommendation."* (`scenarios.py:100`).

**Summarises (other pages' info — via the named reader, linked, never recomputed):**

IA §5 is explicit that this page's runway what-ifs **"consume the canonical runway reader (Net worth), not a
private copy."** So the liquidity block **summarises** figures whose canonical home is elsewhere:

| Summary shown | Canonical page | Shared reader reused | Link target |
|---------------|----------------|----------------------|-------------|
| Liquid assets · runway (the base the what-ifs perturb) | **Net worth** (D-036) | **`runway_report`** (`services/runway.py`) — the same reader Cash flow summarises and Net worth owns | `/net-worth` |
| The obligation-drawdown amount (`next_12m_total`) | **Cash flow** (D-057) | **`obligations_report`** (`services/planning.py`) | `/cash-flow` |
| The shocked **net worth** figure's base (`total_value`) | **Net worth** (D-032) | **`value_portfolio`** | `/net-worth` |

**Links to:** **Net worth** (the runway/net-worth figures the what-ifs perturb) · **Cash flow** (the
obligations behind the drawdown what-if). Per D-038, an impact links to the canonical page where its **base
figure** originates.

**Nothing summarises Scenarios.** Grep confirms **`scenario_report` has no consumer** — no other reader or
page imports it (§10-1). It is a **terminal** canonical page (it does not feed Review, Home, or the Reports
Pack today; if the Reports Pack should carry a scenarios section, that is a **Reports-plan** decision, not
this page's — the R-34 precedent).

**Enforcement corollary (P-1/D-031):** the liquidity what-ifs must **perturb the served canonical figures**,
never re-implement runway. ⚠ **The exposure aggregation is the open question** (§9-4): it is the one place
this page computes a figure by its **own** loop rather than through a canonical reader.

---

## 3. API SURFACE

### 3a. Endpoints consumed (already in the frozen contract)

| Method + path | Purpose on this page | Response shape pinned? |
|---------------|----------------------|------------------------|
| `GET /api/v1/portfolio/scenarios` | **The whole page** — exposures, the 7 asset shocks, the 2 liquidity what-ifs, disclaimer | **In the contract; untyped** (bare `dict`). Full shape in §10-1. Accepts **`?entity_id`** (§10-8). |
| `GET /api/v1/refdata` | *(only if a categorical control is added — none is expected on a read-only page)* | in the contract |

**No write path.** The page ships **no editor, no form, no mutation** (§10-6).

### 3b. Contract deltas (needed but not in the baseline — BUILD BACKEND-FIRST)

> **⚠ Verify-first divergence flag.** The reader **exists and is frozen**, so §3b is **not** a "the page has
> no reader" list. Every row is a **guard / honesty / D-105** delta found by auditing what the reader
> *guards*, not what it *returns* — the page-news / page-policy pattern.

**Every row is PROPOSED and GATED on its §9 item. None is approved.**

| kind | Endpoint (current → intended) | Decision | Why this page needs it |
|------|-------------------------------|----------|------------------------|
| **reshape** | `GET /portfolio/scenarios` — **serve `*_display` money strings** (`net_worth`, each shock's `exposure`/`delta`/`new_net_worth`, the liquidity figures) | **§9-3** (**D-105** scope amendment) | Every money figure is a **raw float** (`_f`, `scenarios.py:22`). D-105 now binds **all** money — the backend formats, the frontend renders verbatim. The Policy/Cash-flow delta, again. |
| **reshape** | `GET /portfolio/scenarios` — **serve a staleness/confidence annotation** (`stale_inputs` / `inputs_stale` / `inputs_note`) | **§9-2** (Guarantee 3; the A10 precedent) | The what-ifs are computed on values that may be stale, and the payload **says nothing** — the valuation carries `has_stale` (in hand at `scenarios.py:30`) but drops it. *"On today's values"* addresses the forecast bar, not the staleness of those values. |
| **behaviour / reshape** | `GET /portfolio/scenarios` — **exposures from the canonical `allocation()`** (or a by-construction equality test if a superset grouping genuinely needs its own derivation) | **§9-4** (P-1/D-038; the **A11** precedent) | `crypto`/`property` are figures Portfolio serves as allocation-by-class; Scenarios re-aggregates them in a private loop (`scenarios.py:34-45`). Resolve as A11 was: read the canonical reader, or pin the two to agree. |
| **behaviour** | `GET /portfolio/scenarios` — **`?entity_id` handling made consistent** (reject, or scope the liquidity block too) | **§9-8** | `entity_id` scopes the **asset** shocks (`value_portfolio(... entity_id)`, `scenarios.py:30`) but the liquidity what-ifs call `runway_report(session)` / `obligations_report(session)` **without it** (`:69,:72`) — a silently **mixed-scope** answer (entity assets vs household liquidity). The Policy §9-21 class. |
| **behaviour** | `GET /portfolio/scenarios` — **the `obligation_due` note uses the §12cf1-2 vocabulary** | **SN-1 / §9-10** | *"the next 12 months of recorded **obligations**"* (`scenarios.py:89`) — the model's word. `next_12m_total` is **expense outflows only**, so the aligned word is **"expenses"**. Served-string, D-005, fail-first. |
| **doc-only** | **API-CONTRACT.md** — add `GET /portfolio/scenarios` as a **`present`** row | **§9-11** | Frozen in the JSON, absent from the delta table — the same gap Policy/Cash flow found. |

**Note (typed response).** The route returns a bare `dict`. **Typing is DEFERRED** for the same reason as
Policy §9-10 / Cash flow — a `response_model` **silently strips undeclared keys**, and this batch would be
*adding* served fields. Record in `08-TECH-DEBT.md`, do not bundle.

---

## 4. COMPONENTS

*Overview template — a composed dashboard, read-only. Only ratified components.*

| Ratified component | Role on this page | Data source | Prop/state not exercised at kitchen-sink |
|--------------------|-------------------|-------------|------------------------------------------|
| **PageHeader** | H1 "Scenarios" + subtitle carrying the protected **"a scenario, never a forecast"** line | — | subtitle carrying protected copy |
| **DataTable** | The **7-shock table** — shock · exposure · delta · new net worth · % change. **Bounded (7 rows), client-side** (D-094). | `/portfolio/scenarios` (**real**) | `footer?` not needed (no reconciling total — the shocks are alternatives, not a sum) |
| **TrendStat** | The **exposures strip** (Equities / Crypto / Property / Foreign FX) and possibly the base net-worth headline — KPI tiles | `.exposures` (**real**) | — |
| **StatusChip** | The liquidity what-ifs' **verdict** — *"covered" / "not covered"* for the obligation drawdown. ⚠ **This page MAY use `positive`/`negative`** (the Cash-flow §9-11 precedent: a cash fact implies no trade) — **§9-5 confirms** | served `covered` | — |
| **SummaryHead** | The **canonical-home cross-links** (D-100) on the liquidity card → Net worth; and the runway figures' provenance | — | — |
| **EmptyState** | The **empty-portfolio** state (all shocks zero) — §9-9 | `net_worth == 0` / no exposures | the reason + link |
| **Skeleton** | Per-card progressive loading — the single reader drives the page; if split into cards, each skeletons independently | — | — |
| **GlossaryTerm** | `[Help]` — **Scenario** exists in GLOSSARY; **Shock** and **Exposure** (as its own term) do **not** (§9-6) | GLOSSARY | — |

**Affordances the ratified inventory lacks:** **none identified.** *(Delta bars / a tornado chart for the
shock magnitudes would be nice-to-have, but the ratified `DataTable` + `TrendStat` cover the page; any chart
is a §5 amendment and a §9 item, not an assumption.)*

**Component usage rules the build must honour**

- **Cards LAYERED (D-100)**; **scroll = content only (D-101)**; the shared **`.lf-page` shell** (§12po1-1) and
  the **centralised in-page link treatment** (§12po1-7) — a new page satisfies both **by existing** (the
  cross-page guards).
- **No delta colour that implies advice.** A shock delta is **always negative** (downside stress) — render it
  factually (`--loss` is defensible for a *loss* figure; a red "−12%" beside "you should…" is not, but there
  is **no advice** here). **Never `--gain`** (there are no upside shocks). §9-5 confirms the treatment.
- **Money = served display strings (D-105)** rendered verbatim; **percentages format client-side** (§9-3).

**Tables — dataset-size posture (D-094):** the shock table is **fixed at 7 rows** (the product-defined set) —
**bounded, client-side** sort. It will never grow until R-11 (user-defined shocks) ships, which is **parked**.

---

## 4b. PER-VARIANT FIELD & ACTION SPECS

**Not applicable — this page has no entity, no variants, and no data entry.** Every figure is a computed
what-if on the household portfolio. *(Recorded explicitly so the absence is a decision, not an oversight.)*

---

## 5. VOCABULARIES

**No categorical input fields** — the page is read-only, so there is **no `MasterSelect`, no vocabulary
binding**. The only served categoricals are **display labels** rendered verbatim (D-005):

| Served value | Nature | Note |
|--------------|--------|------|
| shock `name` (e.g. *"Equities fall 10%"*) | **served display string** | rendered verbatim; **never reconstructed** from `id` + `pct` on the client |
| shock `group` (`markets` / `fx`) | **served display key** | if shown as a section label, display-case at the **backend** (the §12rv1-5 boundary) — not a raw enum in the UI |
| `covered` (liquidity) | **served boolean** | → a **labelled** StatusChip (*"Covered" / "Not covered"*), never a raw `true`/`false` |

**Entity scope note:** there is **no entity picker** — §9-8 rules the page **household-only** (the readers
are household by construction, and the mixed-scope `?entity_id` is the defect, not a feature).

---

## 6. DECISIONS IN FORCE

| Decision | What it forbids / requires on this page |
|----------|------------------------------------------|
| **D-058** *(§0-equivalent bar)* | **"A scenario, never a forecast."** Fixed shock set; **no probability, prediction, projection or recommendation.** The disclaimer is **protected copy**. **User-defined shocks are ROADMAP R-11 — PARKED**, gated on their own plan file: this page ships the **fixed** set only, and must not hint at editing it. |
| **D-036** | **Runway is canonical on Net worth.** The liquidity what-ifs **perturb the served runway reader** — never a private runway. |
| **D-038 / P-1 / D-031** | Impacts **link** to the canonical page where the base figure lives (Net worth, Cash flow). ⚠ **§9-4:** the exposure aggregation must not become a **second code path** for Portfolio's allocation. |
| **D-105** *(scope amendment, 2026-07-15)* | **Money is formatted in the BACKEND and rendered verbatim.** Raw floats today → **§9-3**. Percentages stay client-side. |
| **D-005** | Served labels (shock names, group keys, the `covered` verdict) render **verbatim**; no client reconstruction, no raw enum. |
| **Guarantee 3 (honesty)** | Every empty region states a **reason**; **stale values are flagged** — including values a **what-if is computed on** (§9-2); an insufficient input renders **"—"**, never a fabricated number (e.g. `income_stop` runway is `None` when there is no recorded expense — show a reason, not `0`). |
| **Guarantee 1** | The platform **never advises**. A shock states a **factual delta**, never *"you should hedge / de-risk / sell"*. |
| **Gross-asset / net-worth basis (D-032/D-033)** | Exposures are **gross-positive** holdings (`mv > 0`); shocked net worth is `total_value` (**net of liabilities**); the `pct_change` is the delta as a share of net worth. ⚠ **§9-4/§9-9** confirm this reads honestly at the edges (a near-zero or negative net worth makes `pct_change` unstable). |
| **D-044** | Rotation-eligible; empty/erroring pages skipped (§9-9). |
| **D-098 / D-100 / D-101** | Canonical-home links; layered cards; scroll = content only. |
| **D-094** | The shock table is **bounded (7 rows) → client-side**. |
| **TEMPLATE §13 (new)** | **Assertions with teeth · pixels are facts · component guards on the static specimen · CI has no backend** — all apply. |
| **SN-1** *(page-cash-flow walk)* | The served `obligation_due` note must align to the **§12cf1-2 vocabulary** (§9-10). |

### The threshold families — the shock magnitudes are a THIRD, distinct category

Policy and Cash flow distinguished **Family A** (Review's app-authored signal constants — D-059/D-084, R-15
parked) from **Family B** (the user's own numbers). **The shock magnitudes are NEITHER:**

- They are **not** signal thresholds (they trigger no attention item).
- They are **not** the user's own (the user cannot set them — R-11 is parked).
- They are **the fixed shock set itself** — the **product-defined scenario parameters** (D-058): `-10% / -20%
  / -30%` equities, `-20%` risk, `-50%` crypto, `-10%` property, `-10%` FX.

**⇒ Call this the "fixed shock set" (Family C, product-defined).** It is **shown to the user as the scenario
definitions** (they are the whole point of the page), and it is **user-configurable only via ROADMAP R-11**.
The page must **never** offer to edit a magnitude, and **§9-7** rules where these literals live and whether
they earn a rationale line (the D-059 posture) so a future R-11 has a home to make configurable.

---

## 7. ACCEPTANCE CRITERIA

- [ ] **Happy path:** the exposures strip, the 7-shock table (shock · exposure · delta · new net worth · %),
      and the 2 liquidity what-ifs render from the served payload.
- [ ] **D-058 — NO FORECAST LANGUAGE (protected).** The disclaimer renders. **Grep the rendered copy** for
      `forecast`, `predict`, `projection`, `will `, `expected`, `likely`, `probab`, `should` — **zero** in
      any served or rendered string except the disclaimer's own *"not a …"* clause. A **standing** test.
- [ ] **Deterministic arithmetic (D-058):** the shown `new_net_worth` == `net_worth + delta` for every shock;
      the 20%/30% deltas are 2×/3× the 10% (the `test_scenarios` invariants, now asserted on the **rendered**
      figures too).
- [ ] **Single derivation (P-1/D-038), DEMONSTRATED live:** the liquidity what-ifs' `liquid` and runway ==
      Net worth's served runway; the exposure figures == Portfolio's served allocation (per §9-4's ruling).
      A test proves it against the canonical readers — not prose.
- [ ] **Staleness honesty (§9-2):** when the portfolio has stale inputs, the page **says so** (the served
      annotation), so a what-if is never presented as resting on fresh values when it does not.
- [ ] **No frontend money math / D-105:** every money figure is a **served display string**; the client
      computes **no** delta or new-net-worth (those are served). Percentages format client-side.
- [ ] **Honest "—" (Guarantee 3):** `income_stop` with no recorded expense shows a **reason**, never `0`
      months; an empty portfolio shows the **empty state**, not a table of zeros presented as insight.
- [ ] **`covered` verdict:** rendered as a **labelled StatusChip**, never a raw boolean; meaning not
      colour-alone.
- [ ] **Terms match GLOSSARY** — including any added under §9-6 (**spec first**, then the popover store; the
      parity guard polices it).
- [ ] **Copy hygiene (§12po1-6):** no decision ID or implementation note (`equities_10`, `obligation_due`,
      `total_value`) in any user-facing string.
- [ ] **Both densities · both themes · keyboard · WCAG AA.**
- [ ] **Rendered layout verification (ADR-0004):** `/scenarios` added to the **overflow + single-scroll**
      suite **and** the **shared-shell + themed-link** cross-page guards (320/375/900/1366 × both themes).
- [ ] **Geometry gate (if §9-1 composes the page):** the Overview grid map + density/viewport target +
      visual hierarchy are ratified from a specimen **inside the real shell with real-shaped data** BEFORE
      assembly (the page-home / page-cash-flow lesson) — **pixels sampled, not computed** (§13a).
- [ ] **Assertions with teeth (§13):** every owner-visible defect's guard is written against the **rendered**
      artefact, seen **RED** on that exact state, and carries the **fixture** that reproduces it; **component**
      guards run on the `/kitchen-sink` specimen (§13b), validated in the **full** suite (§13c).
- [ ] **Export: NOT built** (§9-12 — expected DECLINED).

---

## 8. BUILD PHASES

- **Phase 0 — Contract deltas (§3b), backend-first, contract regenerated in the SAME commit, fail-first:**
  §9-3 display strings · §9-2 staleness annotation · §9-4 exposure derivation · §9-8 entity handling ·
  §9-10 (SN-1) note · §9-7 shock-constant home · §9-11 doc row. *(If §9 approves none beyond the doc row,
  Phase 0 collapses to the doc repair — the pricing-health fast-path.)*
- **Phase 0a — DESIGN-SYSTEM amendment ONLY IF a chart component is ruled in (§9-1).** Else **confirm-only**
  (the ratified inventory covers the page).
- **Phase 1 — Page assembly.** Compose ratified components; per-card progressive loading; honest
  empty/"—"/error states; the protected disclaimer.
- **Phase 2 — Tests.** The §7 criteria; the **D-058 forecast grep**; the **live single-derivation**
  reconciliation; extend the overflow/single-scroll/shell/link suites to `/scenarios`.
- **Phase 3a — Scripted pre-pass GREEN before the walk.** Live app + real backend on a **reset** instance —
  which is **empty**, so the **empty-portfolio state is the first thing it drives** — both themes × every
  breakpoint, **0 console errors**. Also drive a **seeded** instance so the 7 shocks and the liquidity
  what-ifs actually render.
- **Phase 3b — Owner acceptance walk (LIVE) — JUDGMENT ITEMS ONLY.** **The owner closes the phase — never
  self-certify it.**

---

## 9. NEEDS DECISION — ✅ **RESOLVED, OWNER ONE-PASS 2026-07-15**

**All 14 items are ruled. Build is unblocked through Phase 0a — then it STOPS at the geometry gate.**
Rulings first; the **original questions, options and evidence are PRESERVED VERBATIM below** — a resolved
question keeps its reasoning, or the next reader inherits a verdict with no argument.

**Matched by NUMBER AND TOPIC before recording — all 14 agree; no mismatch, no STOP.**

| # | Topic | ✅ RULING (owner, 2026-07-15) |
|---|-------|------------------------------|
| **9-1** | Geometry | **Exposures `TrendStat` strip · the 7 shocks as ONE `DataTable` · the two liquidity what-ifs as a card with StatusChip verdicts.** **GATE: a static specimen at `/kitchen-sink`** (real shell, real-shaped data **incl. the stale + near-zero honesty cases**, both themes). **STOP after Phase 0a for the owner's screenshot ratification BEFORE Phase 1.** |
| **9-2** | Staleness (A10 gap) | **§3b — serve the A10-shape annotation** (`stale_inputs` / `inputs_stale` / `inputs_note`); render **`StalenessChip` + a Pricing Health link**; **shared `staleCount` posture, NO second fetch.** **Fail-first** (a stale fixture yields unflagged what-ifs today = RED). |
| **9-3** | D-105 money | **§3b — `*_display` served for EVERY money figure** (`net_worth`, per-shock `exposure`/`delta`/`new_net_worth`, the liquidity figures), **rendered verbatim; percentages stay numbers.** |
| **9-4** | Exposure derivation (A11) | **(a) ONE DERIVATION.** `crypto`/`property` **from `allocation()`**; `equities`/`foreign_fx` as **NAMED SUMS of served canonical buckets** (equities = equity + etf + mutual_fund buckets; foreign_fx = Σ non-base `allocation("native_currency")`). **The private loop is DELETED; an equality test pins the named sums to the canonical buckets.** Fail-first. |
| **9-5** | StatusChip / delta colour | **CONFIRMED — `positive`/`negative` sanctioned here** (cash facts, the Cash-flow §9-11 precedent): **`covered` → positive; `not covered` → attention** (needs-a-look, **not** a loss verdict); **shock deltas render factual `--loss` amounts, never `--gain`.** Ratify visuals at the walk. |
| **9-6** | GLOSSARY | **Add `Shock` + `Exposure` (its own term)** — `docs/specs/GLOSSARY.md` **FIRST**, then `mocks/glossary.ts` (parity guard). **`Stress test` only if body copy uses it.** **PROPOSED → walk.** |
| **9-7** | Shock-magnitude home | **Extract the magnitudes to NAMED CONSTANTS with one-line rationales** (the D-059 posture; Family-C recorded in §6). **NO magnitude changes.** **The R-11 seam is now named — the ROADMAP note updated to say so.** |
| **9-8** | Entity scope | **HOUSEHOLD-ONLY — `/portfolio/scenarios` REJECTS `?entity_id` with an honest 400** (*"scenarios are household-scoped"*). **Fail-first** (accepted today = RED). Per-entity scenarios → **ROADMAP R-35**. |
| **9-9** | Empty / near-zero portfolio | **Empty → `EmptyState`** (reason + route to Holdings). **Near-zero/negative net worth → suppress the `%`, show the base-currency delta with an honest note.** Copy **PROPOSED → walk.** |
| **9-10** | SN-1 note vocabulary | **Served note aligned to "expenses"** (*"…of recorded expenses were paid from liquid assets now."*), matching §12cf1-2 / §12rv2-1. **Fail-first.** |
| **9-11** | Contract docs | **One `present` row** in `API-CONTRACT.md`. **Doc-only.** |
| **9-12** | Export | **DECLINED** — the **Reports Pack** decides scenario inclusion at the **Reports plan**. No §3b delta. |
| **9-13** | Disclaimer cadence | **Once in the PageHeader subtitle** (*"a scenario, never a forecast"*) **+ the served disclaimer at the table foot; NEVER per row.** Ratify at the walk. |
| **9-14** | Rotation | **Rotation-eligible; the empty state → skipped by construction.** Confirmed. |

**Execution order (owner):** **Phase 0** (9-2 · 9-3 · 9-4 · 9-7 · 9-8 · 9-10 · 9-11, all backend-first,
contract regen same commit, fail-first) → **Phase 0a** (the 9-1 specimen, both themes, honesty cases staged)
→ **STOP for the geometry ratification.** **Phases 1–3a proceed only after it.**

---

### The original questions, options and evidence — PRESERVED


| # | Item | Why it blocks / what's needed | Proposed resolution (for owner to approve) |
|---|------|-------------------------------|---------------------------------------------|
| **9-1** | **Page composition / geometry** — a shock TABLE, or per-shock CARDS, plus where exposures and the two liquidity what-ifs sit. | Overview template (DESIGN-SYSTEM §3), **a widget list is not a layout** (page-home §12ho1-3). The page has three distinct blocks (exposures · the 7 shocks · liquidity) + a headline. **This is a geometry ruling.** | **PROPOSE:** an **exposures TrendStat strip** at the top, the **7 shocks as one `DataTable`** (they are homogeneous rows — a table reads them better than 7 cards), and the **two liquidity what-ifs as a card** with StatusChip verdicts. **Ratify the grid map from a specimen (inside the real shell, real-shaped data) before assembly.** |
| **9-2** | ⚠ **No staleness/confidence layer (A10 gap).** | The what-ifs run on values that may be stale; the payload drops the `has_stale` the valuation already carries (§10-3b). *"On today's values"* is the forecast bar, not a staleness flag. Guarantee 3 flags stale values — a **derived what-if** is not exempt (the Policy A10 ruling). | **§3b reshape: serve a staleness annotation** (`stale_inputs` / `inputs_stale` / `inputs_note`, the A10 shape) and render the ratified **StalenessChip** + a link to **Pricing Health**. Reuse the shared `staleCount` posture, **never a second fetch**. |
| **9-3** | **D-105 binds this page.** | Every money figure is a **raw float** (`_f`). The amendment makes money a **served display string everywhere**. | **§3b reshape: serve `*_display`** for `net_worth`, each shock's `exposure`/`delta`/`new_net_worth`, and the liquidity figures. Rendered verbatim. Percentages stay numbers. |
| **9-4** | ⚠ **Are exposures a SECOND code path for Portfolio's allocation? (A11)** | `crypto`/`property` are served by Portfolio's `allocation("asset_class")`; Scenarios re-aggregates them in a private loop (`scenarios.py:34-45`). `equities` (equity+etf+mutual_fund **superset**) and `foreign_fx` (non-base currency) are **not** directly served anywhere. | **Rule it, as A11 was.** **(a)** Derive `crypto`/`property` **from `allocation()`**, and build `equities`/`foreign_fx` as **named sums of served allocation buckets** (equities = the 3 class buckets; foreign_fx = Σ non-base `allocation("native_currency")`), so **one derivation** feeds both pages. **(b)** If a private loop is kept for the superset, **add a test pinning it == the sum of the canonical buckets**, so it can never silently diverge. **Do not leave it unruled.** |
| **9-5** | **StatusChip / delta colour treatment.** | The `covered` verdict wants a chip; the shock deltas are always losses. Policy **bars** `positive`/`negative`; Cash flow **unbarred** them for a cash fact (§9-11 there). | **CONFIRM: this page MAY use `positive`/`negative`** — a scenario is a **cash fact**, not a trade implication (the Cash-flow precedent). `covered` → **positive**; `not covered` → **attention** (not `negative` — an uncovered obligation is *needs-a-look*, not a verdict of loss). Shock deltas render with a factual **`--loss`** amount, **never `--gain`**. **Ratify at the walk.** |
| **9-6** | **GLOSSARY gaps.** | **Present:** *Scenario* (:186, protected D-058). **MISSING** and displayed: **Shock** (a single hypothetical move), **Exposure** (as its **own** term — it currently appears only inside the Instrument/D-085 definitions). Possibly **Stress test** if used as body copy. | **Add to `docs/specs/GLOSSARY.md` FIRST**, then `mocks/glossary.ts` (the two-store rule; parity guard). **All PROPOSED → owner ratifies.** |
| **9-7** | **The fixed-shock magnitudes have no named home or rationale.** | They are inline literals (`-0.10`, `-0.20`, …, `scenarios.py:58-66`) — a **Family-C** product-defined set (§6). Review's analogous constants are **named with a one-line rationale** (D-059); these are not, and R-11 will need a home to make them configurable. | **Extract them to named constants with a one-line rationale each** (the D-059 posture). **No magnitude changes** (that would alter the shipped scenarios — out of scope). **This is the seam R-11 unlocks; naming it now is what makes R-11 a config change, not a rewrite.** |
| **9-8** | ⚠ **`?entity_id` scopes the asset shocks but NOT the liquidity what-ifs.** | `value_portfolio(... entity_id)` scopes the shocks (`:30`); `runway_report(session)` / `obligations_report(session)` are **household** (`:69,:72`, and they take no entity param). Passing `entity_id` yields **entity assets vs household liquidity** — a precise-looking, meaningless mix. The **Policy §9-21 class**. | **HOUSEHOLD-ONLY. `/portfolio/scenarios` REJECTS `?entity_id` with an honest 400** (*"scenarios are household-scoped"*) — a silently mixed-scope comparison is an API honesty trap. **Fail-first (the param is accepted today = RED).** Per-entity scenarios → **ROADMAP** (with per-entity planning, R-35). |
| **9-9** | **Empty (and near-zero / negative) portfolio.** | An empty portfolio yields all-zero shocks and `pct_change = 0`; a **near-zero or negative** net worth makes `pct_change = delta/nw` **unstable/misleading** (`scenarios.py:53` guards `nw else ZERO`, but a tiny positive nw gives an enormous %). | **Empty portfolio → `EmptyState`** with a reason + a route to Holdings (*"Add holdings to model a shock against them"*). **Near-zero/negative net worth → suppress the `%` (show the base-currency delta only) with an honest note** — a percentage of a near-zero base is noise, not insight. **PROPOSED copy → walk.** |
| **9-10** | **SN-1 — the `obligation_due` note vocabulary.** | *"the next 12 months of recorded **obligations**"* (`scenarios.py:89`) is the model's word; `next_12m_total` is **expense outflows only**. | **§3b served-string: align to "expenses"** (*"…of recorded expenses were paid from liquid assets now."*) — matching §12cf1-2 / §12rv2-1. **Fail-first.** *(Already recorded as SN-1.)* |
| **9-11** | **API-CONTRACT.md never lists `/portfolio/scenarios`.** | Frozen in the JSON, absent from the delta table — the recurring doc gap. | **One `present` row.** Doc-only. |
| **9-12** | **Export?** | Overview/Reports-adjacent surfaces export server-side (P-5); there is **no** scenarios export endpoint. | **DECLINE.** If scenarios belong in an export, the **Reports Pack** (D-061) is the home, decided at the **Reports plan** — not a `/scenarios` export. No §3b delta. *(Expected outcome — recorded so it is a decision.)* |
| **9-13** | **Disclaimer placement / cadence.** | The protected D-058 line must be **legible without nagging** — one prominent statement, not a banner on every shock row. | **PROPOSE: once in the PageHeader subtitle** (*"a scenario, never a forecast"*) **and once as the served disclaimer** at the foot of the shock table — **not per row**. **Ratify at the walk.** |
| **9-14** | **Rotation on an empty portfolio.** | D-044 skips empty pages; an empty-portfolio scenarios page is the `EmptyState` (§9-9). | **Rotation-eligible; the empty state counts as empty → skipped by construction.** Confirm. |

---

**Sign-off to start build:** §9 has no open blocker · §3b deltas are approved · no component in §4 requires an
unresolved amendment.

**Not signed off. §9 is open — 14 items. Nothing is built.**

---

## 10. VERIFY-FIRST RECORD (D-019)

*What the engine **actually serves and actually guards**. Every claim carries a `file:line` cite.*

### 10-1. The reader — one frozen, read-only GET; no consumer

**`GET /api/v1/portfolio/scenarios`** (`routes/portfolio.py:994-1000`) → `scenario_report`
(`services/scenarios.py:28`), accepting **`?entity_id`** (`:995`). **In `API-CONTRACT.json`; untyped** (bare
`dict`).

**Served shape:**

```
{ base_currency,
  net_worth,                                     # = val.total_value (NET of liabilities), scenarios.py:31
  exposures: { equities, crypto, property, foreign_fx },
  asset_scenarios: [ { id, name, group,          # 7 shocks (below)
                       exposure, delta, new_net_worth, pct_change } ],
  liquidity: { liquid, runway_months,
               income_stop:    { monthly_expense, runway_months, note },
               obligation_due: { amount, new_liquid, covered, note } },
  disclaimer }                                    # protected D-058 copy, scenarios.py:100
```

**The FIXED SHOCK SET (7, enumerated verbatim — `scenarios.py:58-66`):**

| id | name (served) | perturbs | magnitude | group |
|----|---------------|----------|-----------|-------|
| `equities_10` | Equities fall 10% | equity + ETF + mutual fund | −10% | markets |
| `equities_20` | Equities fall 20% | equity + ETF + mutual fund | −20% | markets |
| `equities_30` | Equities fall 30% | equity + ETF + mutual fund | −30% | markets |
| `risk_20` | Risk assets fall 20% (equities + crypto) | equities + crypto | −20% | markets |
| `crypto_50` | Crypto falls 50% | crypto | −50% | markets |
| `property_10` | Property falls 10% | property | −10% | markets |
| `fx_10` | Your foreign currencies weaken 10% vs base | non-base-currency holdings | −10% | fx |

Plus **two liquidity what-ifs** (`scenarios.py:69-93`): **income stops** (`liquid / monthly_expense` runway)
and **obligation drawn now** (`liquid − next_12m_total`, with a `covered` boolean).

**No consumer.** Grep for `scenario_report` / `portfolio/scenarios` across `app/` and `frontend/src` returns
**only its definition and its route** — nothing summarises it (§2). The nav entry is **not `built`**
(`nav.ts:48` — no `built: true`), so `/scenarios` renders **`NotBuilt`** today.

### 10-2. Shock constants — inline literals, no rationale, a distinct family

The magnitudes are **hardcoded floats inline** in the `asset_scenarios` list (`scenarios.py:58-66`:
`-0.10, -0.20, -0.30, -0.20, -0.50, -0.10, -0.10`). **No named constant, no rationale line** — unlike
`review.py`'s D-059 constants (each `_NAME = value  # one-line rationale`). They are **product-fixed** (the
user cannot set them; R-11 is parked) and are **the scenario definitions themselves** — a **third threshold
family** the plan names in §6 (Family C, the *fixed shock set*). → **§9-7.**

### 10-3. Single-derivation posture

**✅ Net worth and runway flow through canonical readers.** `nw = val.total_value` (`:31`) — the canonical
valuation. The liquidity block calls **`runway_report(session)`** (`:69`) and reads its served `liquid` /
`monthly_expense` / `runway_months`; the drawdown reads **`obligations_report(session)`** (`:72`). The
income-stop runway (`liquid / monthly_expense`, `:75`) is a **scenario variant computed FROM the canonical
reader's served figures** — a perturbation of canonical values, not a private runway. **This satisfies D-058's
"via the canonical reader."**

**⚠ 10-3b. …but there is NO staleness/confidence passthrough (the A10 gap).** `value_portfolio` returns a
valuation carrying **`has_stale`** (`portfolio.py:195`) and per-holding **`is_stale`** — and `scenario_report`
**reads none of them**. The payload has **no** `stale_inputs` / `inputs_stale`. So a shock computed on a
**stale** portfolio is served with the same confidence as one on fresh data; the disclaimer's *"on today's
values"* addresses **forecast**, not **staleness**. → **§9-2.**

### 10-4. ⚠ The exposure seam — a private loop, not the canonical allocation (A11)

`equities`, `crypto`, `prop`, `foreign` are summed in **Scenarios' own loop over `val.holdings`**
(`scenarios.py:34-45`, filtering `mv > 0`). Portfolio serves the canonical **`allocation("asset_class")`** and
**`allocation("native_currency")`** (`routes/portfolio.py:120-121`). So:

- **`crypto`, `property`** — figures Portfolio **already serves** as allocation-by-class, **re-derived** here.
  Same rule, second code path — the **A11 defect class**.
- **`equities`** (equity + ETF + mutual fund) and **`foreign_fx`** (Σ non-base currency) are **superset /
  derived** groupings **not** served as single figures anywhere — legitimately this page's to compute, but
  they should be **named sums of the canonical buckets**, not an independent holdings walk.

→ **§9-4** (read `allocation()`, or pin the two to agree).

### 10-5. ⚠ Money is raw floats (D-105)

`_f(x)` (`scenarios.py:22`) returns `float(round(x, p))`. Every money figure — `net_worth`, each
`exposure`/`delta`/`new_net_worth`, `liquid`, `monthly_expense`, the drawdown `amount`/`new_liquid` — is a
**raw float**. The **D-105 scope amendment** (ratified 2026-07-15) makes money a **served display string
everywhere** (`format_money_display` exists). → **§9-3.**

### 10-6. Read-only — confirmed

`routes/portfolio.py` exposes **only** `@router.get("/portfolio/scenarios")` — **no** POST/PATCH/DELETE, no
`require_auth` mutation. `scenarios.py` has **no session writes** (no `session.add/delete/flush/commit`). The
page **ships no editor** — every figure is computed. *(This is why the template is Overview, not Worklist.)*

### 10-7. Forecast-language audit — CLEAN ✅

Grep of `scenarios.py` + the route for `forecast|predict|projection|will (be|rise|…)|expected|likely|probab`:
**every hit is a NEGATION in the protected copy** — the module docstring (*"never a forecast … no
probabilities, no return projections, no prediction"*, `:2,:6`), the route docstring (*"scenario, not
forecast"*, `routes/portfolio.py:997`), and the served disclaimer (*"not a prediction, probability or
recommendation"*, `:100-101`). **No shock name, note, or served string forecasts anything** — the notes are
**conditional what-ifs** (*"If recorded income stopped…"*, *"If the next 12 months … were paid…"*). **There
is no legacy v1 scenarios UI** to audit (no frontend scenarios route/component exists). **The D-058 bar is
held.** *(The §7 copy grep makes it a standing guard.)*

### 10-8. ⚠ Entity scope — mixed by construction

`scenario_report(session, entity_id)` threads `entity_id` into **`value_portfolio`** (`:30`) — so the **asset
shocks and exposures are entity-scoped**. But the liquidity block calls **`runway_report(session)`** (`:69`)
and **`obligations_report(session)`** (`:72`) **without `entity_id`** — and those readers are **household-only
by construction** (no entity FK; page-cash-flow §10-6). So `?entity_id=N` yields **entity N's assets shocked,
against the HOUSEHOLD's liquidity** — a precise-looking, meaningless mix. The **Policy §9-21 / Cash-flow
§9-15 class**. → **§9-8.**

### 10-9. SN-1 — the obligation-note vocabulary

`liquidity.obligation_due.note` = *"If the next 12 months of recorded **obligations** were paid from liquid
assets now."* (`scenarios.py:89`) — the model's word. `next_12m_total` counts **expense outflows only**
(page-cash-flow §10-1: *"only outflows count toward the total"*), so the accurate aligned word is
**"expenses"**. This is the SN-1 item recorded at the Cash-flow walk. → **§9-10.**

### 10-10. Basis invariants

Exposures sum **positive** market values only (`mv > 0`, `:36`) — gross-positive, so a liability is never an
"exposure". Shocked net worth is **`total_value`** (net of liabilities, `:31`); a shock's `delta` is applied
to the **gross-positive exposure**, and `pct_change = delta / nw` (`:53`) expresses it as a share of **net
worth** — honest for a scenario (the delta is a real change to net worth), but **unstable when `nw` is
near-zero or negative** (§9-9). Liabilities are **not shocked** (correct — an equity-fall scenario does not
move a mortgage's balance). GLOSSARY: **Exposure** as its own term is missing (§9-6).

---

## 11. BUILD RECORD — Phase 0 → Phase 0a (2026-07-15)

**Phase 0 (backend-first, contract regenerated in the same commit). All fail-first.**

| Item | RED evidence (before the fix) |
|------|-------------------------------|
| **9-3** — `*_display` on every money figure | `KeyError: 'net_worth_display'` |
| **9-2** — the A10 staleness annotation | `'stale_inputs' not in {...}` — served from the **shared** `confidence.portfolio_input_quality` (extracted, not a 4th copy) |
| **9-4** — ONE derivation (A11 class closed) | The private holdings loop is **deleted**; exposures read `allocation()`; an equality test pins `crypto`/`property`/`equities`/`foreign_fx` to the canonical `/portfolio/summary` buckets |
| **9-7** — named shock constants | `module has no attribute 'EQUITY_SHOCKS'` — magnitudes extracted with rationale lines; **values unchanged** (a value-preserving test pins the 7 shocks + the 2×/3× determinism) |
| **9-8** — `?entity_id` rejected | `assert 200 == 400` |
| **9-10** — SN-1 note | `'expenses' in 'if the next 12 months of recorded obligations were paid'` |
| **9-11** | one `present` row + the behaviour/reshape deltas in `API-CONTRACT.md`; typing **deferred** (08-TECH-DEBT) |

**Recorded, not done here (08-TECH-DEBT):** the A10 input-quality helper is duplicated in `policy.py` /
`review.py`; they should migrate onto the shared `confidence.py` helper as their **own behaviour-neutral
task**, not rewired mid-Scenarios-build on accepted pages.

**Phase 0a — the §9-1 STATIC LAYOUT SPECIMEN** ships at `/kitchen-sink`, in the **real content region**
(1440×724), **both themes**, with **both honesty cases staged**:
- **populated** — exposures `TrendStat` strip · the **7 shocks as one `DataTable`** (Impact rendered as a
  factual **loss**, never a gain — §9-5) · the **liquidity what-ifs** card with **StatusChip verdicts**
  (`Covered` → positive, `Not covered` → attention — §9-5) · the **A10 staleness strip** (§9-2) · the
  protected disclaimer **once at the table foot** (§9-13) · the **"expenses"** vocabulary (SN-1/§9-10).
- **near-zero net worth** — the **% column is suppressed** (em dash) and only the base-currency amount shows,
  with an honest footnote (§9-9); the header net worth reflects the near-zero value so the specimen is
  internally consistent.

Screenshots (both themes, top / near-zero / liquidity) in `frontend/e2e/smoke/artifacts/sc-*.png`.

---

## 12. GEOMETRY GATE — ✅ RATIFIED (owner, 2026-07-15)

**The §9-1 specimen is RATIFIED as shown (both frames: populated + near-zero).** Phases 1–3a proceed on the ratified geometry.

**To review:** `/kitchen-sink` → *"Scenarios — LAYOUT SPECIMEN (§9-1) — PROPOSED, AWAITING RATIFICATION"*
(two frames: populated + near-zero).

**What is being ratified:** the exposures strip + the single shock table + the liquidity card; the staleness
annotation's placement; the near-zero % suppression; the disclaimer at the table foot.

**Also pending ratification at the walk:** the §9-5 chip/loss treatment · the §9-6 GLOSSARY additions
(`Shock`, `Exposure`) · the §9-9 / §9-13 copy · the §9-2 staleness wording.

---

## 13. BUILD RECORD — Phases 1 → 3a (2026-07-15)

**Geometry gate PASSED** (owner, 2026-07-15) — the §9-1 specimen was ratified as shown (both frames), and
assembly proceeded on the ratified geometry.

**Phase 1 — assembly.** GLOSSARY **first**, then the popover store (`Shock`, `Exposure`; parity guard green).
Composed on the ratified geometry: the exposures `TrendStat` strip · the **7 shocks as one `DataTable`**
(Impact rendered as a factual **loss**, never a gain) · the **liquidity what-ifs** card with **StatusChip
verdicts** (Covered → positive, Not covered → attention). Read-only — no editor. Honest states: **empty
portfolio** (reason + route to Holdings), **near-zero net worth** (% suppressed, amount shown, honest note),
**stale/low-confidence inputs** (the A10 annotation + a Pricing Health link, riding the same payload — no
second fetch). Protected D-058 copy in the subtitle **and** once at the table foot (§9-13). Route + nav wired
— **the `/scenarios` `NotBuilt` fallback is gone** (Gate C3).

**Phase 2 — tests (7 frontend + the backend suite), every guard PROVEN RED on the defect it exists to catch.**

| Guard | Mutation → RED |
|---|---|
| **D-058 — no forecast language** | renaming a heading to *"Liquidity forecast"* → the grep fails (forecast word outside the protected copy) |
| **§9-5 — a shock impact is a LOSS, never a gain** | colouring the impact `sc__gain` → **`expected 'sc__gain' to contain 'sc__loss'`** |

Also pinned: served money rendered **verbatim** (no client money math); the A10 annotation renders with its
Pricing Health route; the **near-zero % suppression** (every % cell an em dash + the honest footnote); the
**empty-portfolio** reason + Holdings route; the **covered/not-covered** chip tones. `/scenarios` added to the
**overflow · single-scroll · shared-shell · themed-link** cross-page guards.

**Phase 3a — pre-pass GREEN on a live instance.** The page renders the **real 7 shocks + exposures +
liquidity** on the seeded demo → **D-058 clean on the rendered page** → the **single derivation holds LIVE**
(exposures == Portfolio's served allocation-by-class; `liquid` == Net worth's runway reader) → **`?entity_id`
rejected (400)** → geometry clean at 320/375/900/1366 × both themes → **0 console errors**.

### Two of my own test mistakes, recorded
1. **Ambiguous locators, not page bugs.** `312,400.00` appears in **both** the exposures tile **and** the
   shock table, so a page-wide `findByText` was ambiguous — rescoped to the specific shock row.
2. **A wrong test-harness pattern:** I re-rendered after `cleanup()` in one test (*"Cannot update an unmounted
   root"*). Split into two independent tests. *(Both were my tests, not the page — fixed the tests.)*

### For the walk — pending ratification
The **§9-5** chip/loss treatment · the **§9-6** GLOSSARY terms (`Shock`, `Exposure`) · the **§9-9** empty /
near-zero copy · the **§9-13** disclaimer cadence · the **§9-2** staleness wording.

**Phase 3b (owner acceptance walk) is the gate. Nothing here is self-certified.**

---

## 14. OWNER WALK — BATCH 1 (§12sc1-N, 2026-07-15)

| # | Finding | Resolution | RED evidence |
|---|---------|------------|--------------|
| **§12sc1-1** | ⚠ **Exposures strip overflows on mobile — and the containment guard had a GAP.** At ~375px the two-across tiles were narrower than the tabular value, which **does not wrap**, so it **clipped** its box. The card-level tile-integrity guard missed it (the tile is a child of a card, not a card), and a `getBoundingClientRect` check would have missed it too — the rect is **clamped to the visible box** (96px) while the content is **160px** (`scrollWidth`). | The strip is a **clean grid** — **1-col phone (≤30rem) · 2×2 below desktop · 4-across only ≥82rem**. The 4-across breakpoint is **high on purpose**: at laptop widths the **fixed sidebar eats ~230px**, so a 1100px viewport is a ~870px content box where four tiles clip (the page-home §12ho1-7 lesson — *the breakpoint must model the box the product has*, measured not assumed). Values contained at **every** width 320–1600. | **RED at 375px** (fix reverted): *"no exposure value clipped @375px"* — `160px content in a 115px box`. **GUARD** = a **real-viewport** check in the scenarios pre-pass (scrollWidth ≤ clientWidth at 320/375/420/500/900/1100/1366). ⚠ **A specimen guard could NOT do this** — the layout is **media-query driven**, and narrowing a fixed-width `/kitchen-sink` frame does not change the viewport the `@media` responds to (a real limit of §13b for responsive components; the guard lives in the pre-pass instead, §13c). |
| **§12sc1-2** | **Interactive sensitivity analysis (owner idea) → ROADMAP, not built.** | **ROADMAP R-11 UPGRADED:** a **per asset-class / currency / region shock slider** over a **parameterized scenario endpoint** (server computes; **no client money math**, D-105); **debounced**; the **D-058 bar applies to the exploratory surface** (a scenario, never a forecast, even while dragging). **Enabled by** the §9-7 named-constant seam and the §9-4 single derivation. **Requires its own plan file.** No UI now. | — |
| **§12sc1-3** | **Impact chart.** | **DONUT DECLINED (chart-semantics honesty):** a donut asserts **composition** — parts of a whole that **sum**. The shocks are **alternative hypotheticals that do NOT sum**; charting them as a donut would **visually claim a false relationship** (D-058-adjacent). **INLINE BARS — OWNER: YES, BUILT:** a **house-SVG** impact bar in the shock table's **% column**, **magnitude-scaled against the largest shock**, **`--loss` tone**, **no axis, no forecast framing**. Suppressed with the % under near-zero net worth (§9-9). **Kitchen-sink specimen updated.** **PROPOSED → ratify the visuals at re-verify.** | **Guard:** the larger-magnitude shock has the fuller bar; the **largest is 100** (scaled); the near-zero state renders **no bar**. |

### Carried ratifications — ✅ ALL RATIFIED (owner, re-verify, 2026-07-15)
The **§9-5** chip/loss treatment · the **§9-6** GLOSSARY terms (`Shock`, `Exposure`) · the **§9-9** empty /
near-zero copy · the **§9-13** disclaimer cadence · the **§9-2** staleness copy · the **§12sc1-3 impact
bar** visual — **all accepted as shown.** The CLOSE lines are recorded in §15.

**Phase 3b re-verify PASSED — the page is accepted. Close-out follows in §15.**

---

## 15. CLOSE-OUT — ✅ OWNER ACCEPTED (2026-07-15)

`/scenarios` is **live and owner-accepted**. Phase 3b was closed in a **single walk batch** (§14) —
the fastest full loop to date. The owner ratified every carried judgment item at the re-verify.

### 15a. CLOSE lines (owner, 2026-07-15)

| Item | Ratification |
|------|--------------|
| **§9-5** — chip / loss treatment | `covered` → **positive**, `not covered` → **attention** (needs-a-look, not a loss verdict); shock deltas render **factual `--loss`** amounts, never `--gain`. **CLOSE.** |
| **§9-6** — GLOSSARY | **`Shock` + `Exposure`** accepted; `GLOSSARY.md` markers flipped **PROPOSED → ratified**, `mocks/glossary.ts` parity green. **CLOSE.** |
| **§9-9** — empty / near-zero copy | Empty → `EmptyState` (*"No holdings to model a shock against."* + Add-holdings route); near-zero net worth → **% suppressed** (em dash + honest footnote), amount shown. **CLOSE.** |
| **§9-13** — disclaimer cadence | Once in the PageHeader subtitle (*"a scenario, never a forecast"*) **+** the served disclaimer at the table foot; **never per row.** **CLOSE.** |
| **§9-2** — staleness copy | The A10 annotation wording (*"N prices are stale and M holdings are low-confidence — these figures may not reflect current values"*) + Pricing Health link. **CLOSE.** |
| **§12sc1-1** — mobile exposures | **1-col phone · 2×2 below desktop · 4-across only ≥82rem**; values contained 320–1600. **CLOSE.** |
| **§12sc1-3** — impact bars | **APPROVED, built** — house-SVG magnitude-scaled `--loss` bar in the % column; suppressed with the % under near-zero. **The donut DECLINE stands** (chart-semantics honesty: the shocks are alternative hypotheticals that do not sum). **CLOSE.** |
| **§12sc1-2** — R-11 upgrade | Recorded to ROADMAP — interactive per-class/currency/region **slider** over a parameterized endpoint; D-058 bar applies to the exploratory surface; own plan file required. **No UI now.** |

### 15b. Retrospective — §13-family lessons (strike-checked, verified, folded)

Each lesson was **strike-checked against the TEMPLATE first** (is it already recorded?), **verified against
the shipped code**, and only then **folded** — an extension where a rule already existed, never a duplicate.

| # | Lesson | Verified against | Fold (strike-check outcome) |
|---|--------|------------------|-----------------------------|
| **(a)** | `getBoundingClientRect` is **clamped to the visible box**, so a clipped non-wrapping value is invisible to a rect check and to a card-level guard; measure **`el.scrollWidth <= el.clientWidth` on the value node**. | `scenarios-smoke.spec.ts:47-59` (the real check) + the comment at `:45`. | **EXTENDED** the existing §7 CONTAINMENT bullet — it already said *"never a container's scroll metrics"*; the new nuance is the rect-clamp + measure-the-clipped-element. Not a fresh bullet. |
| **(b)** | Breakpoints must model the **REAL content box** — the fixed sidebar subtracts ~230px, so a 4-across breakpoint tuned to the viewport clips in the ~870px box. | The shipped `Scenarios.css` breakpoints (4-across gated at ≥82rem, deliberately high) + `scenarios-smoke.spec.ts:41-43`. | **EXTENDED** the §12ho1-7 *"model the box the product has"* rule with a **breakpoint corollary** — the principle was recorded for gate artifacts; now stated for `@media` selection too. |
| **(c)** | A **media-query-responsive** component is **un-guardable on a static specimen** — narrowing a fixed-width `/kitchen-sink` frame does not change the viewport the `@media` responds to; its containment guard runs in the **pre-pass at real viewports** with the shell present. | `scenarios-smoke.spec.ts:38-59` (PART 1b, real-viewport loop) vs. the §13b specimen rule. | **EXTENDED** the §7 §13b component-guard bullet with the **media-query exception → §13c pre-pass** (as drafted in §14 §12sc1-1). |
| **(d)** | The **D-058 forecast-language guard is a STANDING test proven to bite** — a protected-copy bar ships as a permanent test, not a one-time check. | `Scenarios.test.tsx:70-84` + smoke PART 2; proven RED by renaming a heading to *"Liquidity forecast"* (§13). | Recorded — the D-058 bar is **mechanised** as a standing content guard (§7 copy-hygiene family). No new rule needed; the pattern is now demonstrated. |

**Positives worth keeping:** (1) **two guards were honestly corrected, not bent** — the card-level
tile-integrity guard and a rect check both *missed* the §12sc1-1 clip, and the response was to fix the
guards (measure the clipped element at real viewports), not to weaken the claim; (2) the **specimen
self-caught** an internal inconsistency (the near-zero frame's header net worth had to reflect the near-zero
value for the % suppression to read honestly).

### 15c. Changed-file table (wholesale re-upload)

Derived from the milestone diff (`git diff 9ced7de~1 HEAD` + this close-out):

| File | What changed |
|------|--------------|
| `docs/plans/page-scenarios.md` | §9 rulings → build record (§11–§14) → this close-out (§15). |
| `docs/specs/GLOSSARY.md` | `Shock` + `Exposure` added, flipped **PROPOSED → ratified** at close. |
| `docs/specs/API-CONTRACT.md` | `present` row + the `?entity_id`-reject / `*_display` / staleness / `allocation()` / `expenses`-note delta rows (§9-2/3/4/8/10/11). |
| `ROADMAP.md` | **R-11** — named-constant seam recorded (§9-7) + interactive-slider **upgrade** (§12sc1-2). |
| `docs/audit/08-TECH-DEBT.md` | the shared A10 input-quality helper migration (behaviour-neutral, deferred); typed `scenarios` response deferred. |
| `app/services/scenarios.py` | `*_display` money strings · A10 staleness annotation · exposures from `allocation()` (private loop deleted) · named shock constants · `?entity_id` → 400 · `expenses` note. |
| `app/services/confidence.py` | shared `portfolio_input_quality` helper (extracted, not a 4th copy). |
| `app/api/v1/routes/portfolio.py` | `?entity_id` rejection wiring. |
| `docs/specs/API-CONTRACT.json` | regenerated in the same commit as the deltas. |
| `tests/integration/test_scenarios_phase0.py` | the Phase-0 fail-first backend guards. |
| `frontend/src/routes/Scenarios.tsx` / `.css` / `.test.tsx` | the page, its styles, and the 9 render guards (incl. the standing D-058 grep, §9-5 loss tone, impact bars). |
| `frontend/src/api/scenarios.ts` | the typed client. |
| `frontend/src/routes/ScenariosMockup.tsx`, `KitchenSink.tsx` | the §9-1 layout specimen (both frames). |
| `frontend/src/AppRoutes.tsx`, `components/ui/nav.ts` | route + nav wired (`NotBuilt` fallback gone). |
| `frontend/src/mocks/glossary.ts` | `Shock` + `Exposure` popover parity. |
| `frontend/e2e/smoke/scenarios-smoke.spec.ts` | the Phase-3a pre-pass (incl. the §12sc1-1 real-viewport containment guard). |
| `frontend/e2e/overflow.spec.ts` | `/scenarios` added to the cross-page overflow / single-scroll suite. |
| `docs/plans/TEMPLATE-page-build.md` | §7 folds — containment (a), breakpoint corollary (b), media-query exception (c). |
| `docs/plans/CURRENT.md` | Scenarios → DONE; NEXT = Insurance. |

**Reported for the owner's final look. No self-certification — the guards above were run RED-then-GREEN and
are cited by `file:line`.**

---

## DELTA NOTE — 2026-07-16 (page-insurance walk batch 2, §14in-7)

- **Base-currency affix (RATIFIED):** the four Exposure tiles + the "Net worth today" caption now carry the
  served `base_currency` (`/portfolio/scenarios`) as the muted `.lf-stat__unit` affix. The widened value
  clipped at 320px until `TrendStat` gained a zero-width-space break before the unit (wraps the code to its
  own line when tight); proven RED (`980,000.00SGD` `191>186`) → GREEN. Scenarios.test.tsx (9) + `scenarios-smoke` green.

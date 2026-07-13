# page-review.md — Review page build plan

**Status: PLAN ONLY — owner reviews §9 before any code.** Drafted 2026-07-13 from
`TEMPLATE-page-build.md` (incl. the tooling-guard fail-first, the ⚠ verify-first divergence-flag +
**audit-guards** additions, the vertical-single-scroll invariant, and the Reports-group worklist-shape
note). Verify-first pass done (§10 — read what the review reader actually serves **and its honesty
guards**, D-019 / page-news §13a). **Nothing is built.** Every ambiguity is in §9; the owner resolves
them one-pass. **I resolved none.**

Review is a **Planning-group** page (Review · Policy · Cash flow · Scenarios · Insurance · Estate, IA
§3) and the **canonical home for review verdicts + the attention list, Mark-reviewed (with history),
and the D-059 threshold-constants table** (IA §5, D-038/D-059). **Building it unblocks Home** — Net
worth's / Home's **`ReviewCard`** already reads the Review reader (D-038); Review is the last unbuilt
canonical source Home summarises. It is **worklist-shaped** (a summary header + an attention/records
body — page-pricing-health §13 ND-7); the **IA nav group is Planning** (CURRENT.md's "Reports-group"
phrasing refers only to the *shape*).

> **⚠ THREE things dominate this plan (read first):** **(1) The code diverges from the owner-set
> thresholds.** `review.py` still serves **`_RUNWAY_LOW_MONTHS = 6`** and **`_GOAL_SOON_DAYS = 90`**;
> **D-084** set these to **3** and **180**, and **D-087**'s `_OTHER_CLASS_OVERUSE_PCT = 10%` signal is
> **absent from the code** — PRODUCT-SPEC §5 records the divergence (ND-1). **(2) The D-030 rename is
> not applied** — the endpoint is `/review/centre`, not `/review` (API-CONTRACT delta; ND-2). **(3) Two
> readers, reconciled by construction** — `/review/centre` (sections + attention, **currently
> unconsumed**) reuses `review_report`, the same reader `/portfolio/review` (ReviewCard) uses; P-1
> single-fetch is ND-3.

---

## 1. IDENTITY

*Source: INFORMATION-ARCHITECTURE.md §2 (page map), §3 (nav + rotation); DESIGN-SYSTEM.md §3.*

| Field | Value | Spec ref |
|-------|-------|----------|
| Page name (H1 = nav label = route) | **Review** | IA §2, D-022, D-030 |
| Route | `/review` | IA §2 |
| Nav group | **Planning** (Review · Policy · Cash flow · Scenarios · Insurance · Estate) | IA §3 |
| Page template | **Worklist** — a summary header (section verdicts + last-review) over an **attention/records body** (attention list + history) | DESIGN-SYSTEM §3; pricing-health §13 ND-7 |
| Rotation eligibility | **Confirm ND-6** (any nav page is eligible, D-044; pricing-health ND-10 precedent = YES) — IA is not Review-specific | IA §3 (D-044) |
| One-line purpose | **Review** — a live "what needs a look" attention list from existing signals + a per-section verdict; **Mark-reviewed** snapshots state to `ReviewLog` with a note + next-review date; review history. Reporting only, never advice or a required action. | IA §2/§5 |

---

## 2. OWNERSHIP TABLE

*Copied from INFORMATION-ARCHITECTURE.md §5 (Review). Never re-derived.*

**Owns (canonical, authoritative, fully explained here):**
- **Section verdicts + the attention list** — the served `attention[]` items (`{area, title, severity}`)
  and per-section verdict; each item's `area` links to its canonical page (ND-7).
- **Mark-reviewed** — records a `ReviewLog` (net worth, confidence, drift flags, attention count, **note
  + next-review date**) via `POST /review/log` (`require_auth`, `[S]`); **review history**.
- **The D-059 threshold-constants table** — **PRODUCT-SPEC §5 names the Review page spec as the
  canonical home** for this table; it is carried below (each a named constant + one-line rationale).

**Summarises (other pages' info — via the named canonical reader, never recomputed):**

| Summary shown | Canonical page | Shared reader reused | Link target |
|---------------|----------------|----------------------|-------------|
| Drift / out-of-band (policy section) | Policy | **`compute_drift`** (`services/policy.py`) — the same reader Policy uses | Policy |
| Runway (liquidity section) | Net worth / Cash flow | **`runway_report`** (`services/runway.py`) — the Net-worth reader | Net worth / Cash flow |
| Trust / confidence (trust section) | Pricing Health | confidence/staleness readers (D-038) | Pricing Health |
| Net worth + day change (header/changed section) | Net worth | **`value_portfolio`** | Net worth |

**Links to (each attention `area` → its canonical page, ND-7):** **Policy** (`policy`), **Pricing
Health** (`data` — confidence/staleness/incomplete/expense-ratio), **Cash flow / Net worth**
(`liquidity`, `runway`), **Scenarios / Planning** (`goals`, `obligations`), **Insurance**
(`insurance`), **Estate** (`estate`), **Holdings / InstrumentDetail** (`corporate`).

**Enforcement corollary (P-1/D-031):** the section verdicts + attention items are **served display
values** from `review_centre`/`review_report`; the page performs **no money math**. **`ReviewCard`
shows no figure the Review page doesn't** (D-038; the component "reuses the Review reader's verdicts —
it never computes its own"). Home / Net worth **summarise** Review (ReviewCard), linked here.

### The D-059 threshold-constants table (canonical here — PRODUCT-SPEC §5)

*Values per D-084 (owner-set) / D-087 / D-091. **⚠ the running code diverges — see ND-1 + §10.***

| Constant | Value | Signal | Rationale |
|----------|-------|--------|-----------|
| `_LIQUID_THIN_PCT` | 15 (%) | Liquidity thin when `liquid_pct` < 15% | Below ~1/7 of gross assets in immediate/short rungs is too little cushion. |
| `_RUNWAY_LOW_MONTHS` | **3** (D-084) | Runway low when `runway_months` < 3 | Owner-set floor: below three months' recurring net burn warrants a look. |
| `_GOAL_SOON_DAYS` | **180** (D-084) | Goal target date within 180 days | Owner-set: a half-year's notice to act on an approaching goal. |
| `_OBLIGATION_SOON_DAYS` | 30 | Obligation due within 30 days | One month's notice on an upcoming cash obligation. |
| `_INSURANCE_SOON_DAYS` | 30 | Insurance renewal within 30 days (or overdue) | One month to renew before a policy lapses; overdue always flags. |
| `_CORP_ACTION_RECENT_DAYS` | 45 | Split/bonus within 45 days → "verify" | Recent corporate actions warrant a manual verification window. |
| `LEDGERFRAME_STALE_AFTER_SECONDS` | 900 | Stale holding count | Quotes older than 15 min flagged stale (EOD/NAV use a longer 30h threshold). |
| `_OTHER_CLASS_OVERUSE_PCT` | 10 (%) (D-087) | `other`-class holdings exceed ~10% of gross assets | `other` is the honest escape valve; over-use signals holdings to reclassify. |
| `_INCOMPLETE_DETAILS_MIN` | **1** (D-091) | Manual holdings in {fixed_deposit, bond, property, retirement, private} with **no** optional detail | Low-priority `info` nudge to enrich a bare-value holding — *never a hard wall*. |

---

## 3. API SURFACE

*Source: API-CONTRACT.json (frozen) + API-CONTRACT.md delta table. Verify-first shapes in §10.*

### 3a. Endpoints consumed (already in the frozen contract)

| Method + path | Purpose on this page | Response shape (verified §10) |
|---------------|----------------------|-------------------------------|
| `GET /review/centre` **(→ `/review`, ND-2)** | the Review page body — sections + attention | `{base_currency, net_worth, sections:{trust,policy,liquidity,goals,changed}, attention:[{area,title,severity}], attention_count, last_review, disclaimer}` — `attention` = `review_report.items` (by-construction, ND-3) |
| `GET /portfolio/review` | **ReviewCard's** feed (Home/Net worth) — **not fetched by this page** unless ND-3 shares it | `{as_of, count, items:[{area,title,severity}], disclaimer}` |
| `GET /review/history` | review-history table | `{history:[{id,reviewed_at,days_ago,net_worth,base_currency,confidence,drift_flags,attention_count,note,next_review_date}]}` |
| `POST /review/log` (**`require_auth`**) | **Mark-reviewed** (`[S]`) | body `{note?, next_review_date?}` → `{ok, id}` |

### 3b. Contract deltas (needed but not in the baseline — BUILD BACKEND-FIRST, only if §9 approves)

| kind | Endpoint / code (current → intended) | Decision | Why this page needs it |
|------|--------------------------------------|----------|------------------------|
| rename | `GET /review/centre` → **`GET /review`** | **D-030 (ND-2)** | API-CONTRACT delta not yet applied; retire "Review Centre" |
| reshape (values) | `review.py` thresholds → **`_RUNWAY_LOW_MONTHS=3`, `_GOAL_SOON_DAYS=180`** + **add `_OTHER_CLASS_OVERUSE_PCT=10%`** signal | **D-084/D-087 (ND-1)** | code serves 6/90 + lacks the over-use signal; PRODUCT-SPEC §5 records the divergence |

**⚠ Verify-first divergence flags (§9, not §3b guesses).** **(ND-1)** the served threshold VALUES + a
served SIGNAL diverge from the owner's decisions (D-084/D-087) — a real behavior gap, caught by reading
the constants, not assumed. **(ND-2)** the D-030 rename is unapplied. Any approved delta regenerates
`API-CONTRACT.json` + `docs/openapi.json` same commit (`make api-contract-check`); the threshold change
is a **backend value edit + its test**, not a shape change.

---

## 4. COMPONENTS

*Source: DESIGN-SYSTEM.md §5 (ratified) + §3 (templates). Ratified only; a missing affordance is a §9
amendment request. Data-wired to real endpoints.*

| Ratified component | Role on this page | Data source (real endpoint) | Not exercised at kitchen-sink |
|--------------------|-------------------|-----------------------------|-------------------------------|
| **PageHeader** | H1 "Review" + subtitle + actions (Mark-reviewed) | — | a primary action |
| **ReviewCard** (Verdict) | section-verdict summary strip (its designed "canonical body on Review" role) | `/review/centre.sections` / `attention` | items-as-sections with per-area link (ND-7) |
| **DataTable** | the **attention list** (area · title · severity · link) + **review history** | `/review/centre.attention`, `/review/history` | severity column; area→canonical-page links |
| **Dialog + TextInput + DateInput** | **Mark-reviewed** (note + next-review date, `[S]`) | `/review/log` | a compose-inputs dialog (not `ConfirmDialog` — it needs fields) |
| **Segmented** | (optional) filter attention by severity / section | client filter | severity/section filter |
| **EmptyState** | "Nothing needs a look right now." (served) · reader error | reader shapes | the served honest empty |
| **Skeleton** | per-card progressive loading | — | header + attention + history cards |
| **GlossaryTerm** | `[Help]` on **Review** (+ severity? ND-11) | GLOSSARY | the Review definition |

**Affordances the ratified inventory may lack (amendment — resolve in §9 before build):**
- **Severity chip (ND-4).** Served severity ∈ {`review`, `info`} must render as a **labelled chip** (not
  the raw enum key — copy hygiene). Pricing Health hand-rolled a page-local `ph__chip`; confirm a
  page-local chip suffices or a ratified **severity chip** is a §5 amendment.
- **Per-section verdict strip (ND-7).** `review_centre.sections` is **raw section data** (counts/pcts),
  not verdicts; the verdict (ok/attention/info) is a **display grouping** of the attention items by
  `area` (never a recompute). Confirm `ReviewCard` (items-as-sections) covers it, or a small strip is a
  §5 note.

**Component usage rules the build must honour (template §4):**
- **Attention items are served display strings** — render `title`/`area`/`severity` verbatim (map the
  enum severity to a label, never show `"review"`/`"info"` raw). No frontend money math.
- **Per-signal resilience is honest (D-059):** one failing signal never breaks the feed (the reader
  guards each; the page must not assume all signals present).
- **Mark-reviewed is `require_auth`** (`[S]`); reporting-only copy is protected ("reporting only, not
  advice or a required action").
- **Cards LAYERED (D-100); scroll = content only, header outside (D-101); single vertical scroll region**
  (§12mk1-1). **Progressive per-card loading.**

**Tables — dataset-size posture (D-094):** the **attention list** is **bounded** (one row per fired
signal — tens at most) → client-side sort/filter fine. **History** is **append-only** but the reader
caps at `limit=24` (bounded window) → client-side over the loaded window; a "load more"/full history is
**not** a v2 need (record a revisit threshold if it grows).

---

## 5. VOCABULARIES

*Source: MASTER-DATA.md + served data.*

| Field on this page | Vocabulary / source | Fixed / served | Ref |
|--------------------|---------------------|----------------|-----|
| **severity** | served on each attention item — **{`review`, `info`}** (only two emitted, §10) | **served** — **NOT in GLOSSARY/MASTER-DATA** (ND-4/ND-11 terminology gap) | §10; `review.py` |
| **area / section** | served `area` (policy · data · liquidity · goals · obligations · insurance · estate · runway · corporate · ok) | **served** display keys → map to a canonical-page link (ND-7); render label verbatim | §10 |
| **note / next-review date** | user input on Mark-reviewed | user data (free-text `note`, ISO `next_review_date`) | §10 |

All severity/area/verdict labels are **served display strings** (D-005) — render verbatim; **never
render the raw enum key** (`review`/`info`) in a user string (copy hygiene).

---

## 6. DECISIONS IN FORCE

| Decision | What it forbids / requires on this page |
|----------|------------------------------------------|
| **D-038** | Review **canonical** for verdicts + attention; **Home / Net worth show a `ReviewCard` summary-with-link** (no figure Review doesn't own); provenance/confidence link to Pricing Health. |
| **D-059** | Every threshold is a **named constant with a one-line rationale** (table in §2); **per-signal try/except resilience** — one failing signal never breaks the feed. |
| **D-030** | The label is **"Review"** — **"Review Centre" / "Needs a look" (as a label) / "What needs attention" are RETIRED** (GLOSSARY deprecated table). **"what needs a look" allowed only as body copy.** Endpoint rename `/review/centre → /review` (ND-2). |
| **D-084** | Owner-set defaults **`_RUNWAY_LOW_MONTHS = 3`, `_GOAL_SOON_DAYS = 180`** (the code still serves 6/90 — ND-1). |
| **D-087** | The `_OTHER_CLASS_OVERUSE_PCT = 10%` over-use signal is part of the set (**absent from code** — ND-1); `other` retained as the honest escape valve. |
| **D-091** | Incomplete-details signal is **severity `info`** (a low-priority nudge, **never a hard wall**). |
| **D-031 / P-1** | Served display values only; the summary count on ReviewCard and the page reconcile (ND-3). |
| **D-027 / Guarantee 3** | Every empty / "—" shows a **reason**; the served empty is **"Nothing needs a look right now."** (verbatim). Never fabricate a signal. |
| **D-005 / D-050** | Served vocab/labels (zero-copy); any export server-side. |
| **D-065 / P-7** | Review is **household** (readers take **no `entity_id`**, §10) — ND-12. |
| **R-15** | User-configurable thresholds are **ROADMAP (later)** — **no config UI now** (ND-9). |

---

## 7. ACCEPTANCE CRITERIA

- [ ] **Attention list (D-038):** the served `attention[]` renders (area · title · severity chip);
      each item **links to its canonical page** by `area` (ND-7); **no raw enum key** in any string.
- [ ] **Section verdicts (D-038):** a per-section verdict summary (ReviewCard or strip) — verdicts are
      the served reader's, never recomputed.
- [ ] **Empty state (Guarantee 3):** with no signals, the served **"Nothing needs a look right now."**
      shows (verbatim), never a fabricated item.
- [ ] **Per-signal resilience (D-059):** the page renders correctly when some signals are absent (one
      failing signal never blanks the feed).
- [ ] **Mark-reviewed (D-038):** a `[S]`-gated dialog records a `ReviewLog` with **note + next-review
      date**; **review history** renders (date · net worth · confidence · attention count · note).
- [ ] **Thresholds (D-059):** the named-constant table is the canonical reference (ND-9 = in-app or
      spec-only); reporting-only copy protected ("not advice or a required action").
- [ ] **P-1 reconciliation (ND-3):** the page's attention count **matches ReviewCard's** (by
      construction / shared reader) — acceptance demonstrates it.
- [ ] **Terms match GLOSSARY;** `[Help]` on **Review**; copy hygiene — no decision IDs / enum keys.
- [ ] **Both themes + densities;** interactive OPEN states (Mark-reviewed dialog, DateInput) in both.
- [ ] **Rendered layout + overflow:** 320/375/900/1366 both themes, **zero horizontal overflow** +
      **single vertical scroll region** (extend the suites to `/review`). Geometry fixes **fail-first**.

---

## 8. BUILD PHASES

*One commit per phase. Backend deltas FIRST. **Do not start until §9 clears.***

- **Phase 0 — Contract/code deltas (only if §9 approves ND-1/ND-2):** **backend-first** — (a) the D-030
  rename `/review/centre → /review` (regenerate contract same commit); (b) the D-084/D-087 threshold +
  signal reconciliation in `review.py` **with a value test** (assert the served thresholds = the
  spec/D-084 values; the over-use signal fires at >10%). *(Skip only if §9 defers both.)*
- **Phase 0a — DESIGN-SYSTEM §5 amendment (only if ND-4 needs a ratified severity chip / verdict
  strip):** author PROPOSED, ratify at `/kitchen-sink`. *(Skip if a page-local chip + ReviewCard
  suffice.)*
- **Phase 1 — Page assembly:** compose ratified components over the reader; progressive per-card
  loading; header (section verdicts + last-review) + attention list (links by area) + Mark-reviewed +
  history + honest empty/error/resilience states.
- **Phase 2 — Tests:** component/render + acceptance (§7); the **P-1 reconciliation test** (page count ==
  ReviewCard count); a **per-signal-resilience test** (a missing signal doesn't blank the feed); extend
  the overflow + single-scroll suite to `/review`; drift/typecheck/lint/build green.
- **Phase 3a — Scripted pre-pass (GREEN before the walk):** drive the live page + real backend on seeded
  demo; assert populated attention list + section verdicts + Mark-reviewed round-trip + history + the
  empty state + honest guards; 0 overflow, single scroll region, 0 console errors; tooling guards
  demonstrated firing (§7/§8a). Geometry fixes **fail-first**.
- **Phase 3b — Owner acceptance walk (LIVE, judgment items only):** each finding → a numbered
  `page-review.md §*` entry, fixed + re-verified live. **Owner closes the page.**

---

## 9. NEEDS DECISION — OPEN (owner resolves one-pass; nothing resolved here)

Each item is an ambiguity the specs do not settle. Options laid out; **I resolved none.** Items flagged
**⚠** may need a backend delta or an owner scope call.

- **ND-1 — Threshold code↔spec divergence. ⚠ BEHAVIOR GAP (D-084/D-087).** `review.py` serves
  **`_RUNWAY_LOW_MONTHS = 6`** and **`_GOAL_SOON_DAYS = 90`**; **D-084** set them to **3 / 180**, and
  **D-087**'s `_OTHER_CLASS_OVERUSE_PCT = 10%` signal is **not in the code** (§10). PRODUCT-SPEC §5
  documents the divergence. Options: **(a)** apply D-084/D-087 to `review.py` NOW (this page's **Phase-0
  backend delta** — set 3/180, add the over-use signal, with a value test); **(b)** ship the page against
  the served values (6/90, no over-use), render the threshold table as the D-084/D-087 **intent** with a
  visible divergence note, and reconcile the code later. *(R-15 makes thresholds configurable later —
  no config UI now, ND-9.)* Owner picks — building Review is the natural place to close a documented
  owner-decision gap.
- **ND-2 — D-030 endpoint rename. ⚠ CONTRACT DELTA.** API-CONTRACT delta **`/review/centre → /review`**
  (retire "Review Centre") is **not applied**. Options: **(a)** apply it in **Phase 0** (backend-first,
  regenerate the contract) and read `/review`; **(b)** defer the rename, read `/review/centre` now (the
  user-facing label is already "Review" regardless). Confirm timing.
- **ND-3 — Which reader + P-1 single-fetch.** `/review/centre` (sections + attention, **unconsumed**)
  **reuses `review_report`**, the same reader `/portfolio/review` (ReviewCard) uses → the counts
  **reconcile by construction** (like Pricing Health ND-1). Options: **(a)** Review reads `/review/centre`
  (renamed `/review`); ReviewCard keeps `/portfolio/review`; acceptance + a test demonstrate the counts
  match; **(b)** a **shared client query** (the `staleCount` pattern) so ReviewCard + the page share one
  fetch site. Owner picks the P-1 posture. *(Both endpoints stay consumed after Review ships — neither
  is orphaned.)*
- **ND-4 — Severity display treatment + possible §5 amendment.** Served severity ∈ **{`review`, `info`}**
  (enum keys — not in GLOSSARY/MASTER-DATA). Options: **(a)** map to display labels + a **page-local
  severity chip** (the Pricing Health `ph__chip` precedent — no amendment); **(b)** a ratified
  **severity chip** component (§5 amendment). And the **section-verdict strip** (ReviewCard items-as-
  sections vs a small strip). Owner picks.
- **ND-5 — Acknowledgement / dismissal state.** **No per-signal ack exists in the served shapes** (§10 —
  verified, not assumed). Options: **(a)** **out of scope for v2** — **Mark-reviewed / `ReviewLog` is the
  only acknowledgement** (a state snapshot, not per-item dismissal); **(b)** a per-signal-ack **contract
  delta** this page owns; **(c)** **ROADMAP**. Recommend (a) — surface for the owner.
- **ND-6 — Rotation eligibility (D-044).** IA is not Review-specific. Confirm **YES** (any nav page is
  eligible; the user picks the set; pricing-health ND-10 precedent) — surfaced, not presumed.
- **ND-7 — Attention-item links + area model.** Each attention `area` (policy/data/liquidity/goals/
  obligations/insurance/estate/runway/corporate) should link to its **canonical page**. Confirm the
  `area → page` map (Policy · Pricing Health · Cash flow/Net worth · Scenarios · Insurance · Estate ·
  Holdings) and that a bare `ok`/empty item is a non-link. Rendering: a `DataTable` (area · title ·
  severity · link) vs `ReviewCard`.
- **ND-8 — Mark-reviewed composition + history.** `POST /review/log` (`require_auth`, `[S]`) takes
  `{note?, next_review_date?}`. Confirm the affordance: a **`Dialog` + `TextInput` (note) + `DateInput`
  (next-review date)** (not `ConfirmDialog` — it needs fields), `[S]`-gated; and **history** as a
  `DataTable` over `/review/history`.
- **ND-9 — Threshold table in-app or spec-only?** D-059's canonical home is **this spec** (the table is
  in §2). Confirm whether the page **renders** the table as an in-app "why these thresholds" reference,
  or it stays **spec-only**. **No config UI** (R-15 later).
- **ND-10 — Export posture.** Expect **DECLINED** (Reports territory, like pricing-health ND-12) — but an
  owner call. Confirm no CSV here.
- **ND-11 — Terminology / GLOSSARY.** **"Review"** is a GLOSSARY term (`[Help]`). Do the **severity
  values** ("review"/"info") need a GLOSSARY entry + display label, and does "severity" get `[Help]`?
  Confirm which terms are user-shown (no raw enum keys).
- **ND-12 — Entity scope (D-065).** Review readers take **no `entity_id`** (household, §10) — confirm;
  log for the Accounts milestone (pricing-health ND-11 precedent).

**Lower-risk confirms (owner ratifies with the above):** served labels throughout (D-005); Mark-reviewed
`[S]`-gated; reporting-only copy protected (D-038/Guarantee); the empty message verbatim (D-027).

---

## 10. VERIFY-FIRST FINDINGS (2026-07-13) — read before assuming shapes (D-019 + audit guards, §13a)

Ran the read-what-the-engine-serves pass — **and audited each reader's honesty guards, not just its
shape** — before drafting §3/§4/§5. **No shape was assumed; gaps went to §9, not §3b.**

| Item | What the engine actually serves / guards | Source |
|------|-----------------------------------------|--------|
| Review feed | `GET /portfolio/review` → `{as_of, count, items:[{area,title,severity}], disclaimer}`; `count` = # of `severity=="review"` items; disclaimer "Items to review — reporting only, not advice or a required action." | `portfolio.py:898`, `review.py:42/197` |
| Review centre | `GET /review/centre` → `{base_currency, net_worth, sections:{trust,policy,liquidity,goals,changed}, attention, attention_count, last_review, disclaimer}`; **`attention` = `review_report.items`, `attention_count` = `review_report.count`** (⇒ by-construction reconciliation, ND-3) | `portfolio.py:906`, `review.py:227/273` |
| Item shape | `_item(area,title,severity="review")` → `{area,title,severity}` — **no ack/dismiss field** (ND-5) | `review.py:38` |
| **Severity values** | **only two emitted: `review` (default) and `info`** (D-091 incomplete-details; the empty "ok" item) — no high/warn/critical | `review.py:38/166/195` |
| Areas | policy · data · liquidity · goals · obligations · insurance · estate · runway · corporate · ok | `review.py:53–195` |
| Empty state | `_item("ok", "Nothing needs a look right now.", severity="info")` — **verbatim** | `review.py:195` |
| **Per-signal resilience (D-059)** | **each signal block is wrapped in its own `try/except Exception: pass`** (policy, confidence/stale, liquidity, goals, obligations, insurance, estate, runway, corporate, incomplete-details, misplaced-expense) — one failing signal never breaks the feed. **Guard verified per-signal, not just overall.** | `review.py:48–192` |
| **⚠ Thresholds (code ≠ spec)** | code: `_RUNWAY_LOW_MONTHS = 6`, `_GOAL_SOON_DAYS = 90`; **D-084 = 3 / 180**; **`_OTHER_CLASS_OVERUSE_PCT` (D-087) is ABSENT from code**; PRODUCT-SPEC §5 records the divergence (ND-1) | `review.py:25–31`, PRODUCT-SPEC §5:141/160 |
| **⚠ D-030 rename unapplied** | endpoint is `/review/centre`, not `/review`; API-CONTRACT delta rows it (ND-2) | `portfolio.py:906`, API-CONTRACT.md:79 |
| History | `GET /review/history` → `{history:[{id,reviewed_at,days_ago,net_worth,base_currency,confidence,drift_flags,attention_count,note,next_review_date}]}` (reader caps `limit=24`) | `portfolio.py:914`, `review.py:298` |
| Mark-reviewed | `POST /review/log` (**`require_auth`**) body `{note?, next_review_date?}` → `{ok, id}`; records a `ReviewLog` snapshot | `portfolio.py:926`, `review.py:280` |
| Reader ↔ ReviewCard | **`ReviewCard` (Home/Net worth) consumes `/portfolio/review`** (`getReview`, `ReviewResp{as_of,count,items}`); **`/review/centre` is currently UNCONSUMED** (no Review page yet) | `frontend/api/net-worth.ts:88`, `routes/NetWorth.tsx:308` |
| Verdict mapping | `ReviewCard` `Verdict = "ok"｜"attention"｜"info"`; Net worth maps `severity==="review" → "attention"`; the component "reuses the Review reader's verdicts — never computes its own" | `components/ui/ReviewCard.tsx:6`, `NetWorth.tsx:62` |
| Entity scope | `review_report`/`review_centre`/`review_history`/`record_review` take **no `entity_id`** (household) — ND-12 | `review.py:42/227/280/298` |

**Owner sign-off surface (all in §9):** ND-1 (threshold divergence — the headline reconciliation), ND-2
(D-030 rename timing), ND-3 (reader + P-1 single-fetch), ND-4 (severity chip / §5), ND-5 (acknowledgement
scope), plus ND-6/7/8/9/10/11/12. **No build until the owner resolves §9.**

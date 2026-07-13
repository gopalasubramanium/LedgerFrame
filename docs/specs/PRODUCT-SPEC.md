# PRODUCT-SPEC.md — LedgerFrame v2

**Normative.** This is the top-level product definition: what LedgerFrame is,
its deployment posture, the guarantees it makes, the protected design decisions
it must never regress, and the cross-cutting rules (scope, first-run, privacy).
Terms match GLOSSARY.md; the IA lives in INFORMATION-ARCHITECTURE.md; vocabularies
in MASTER-DATA.md.

---

## 1. What LedgerFrame is

LedgerFrame is a **single-user, local-first wealth-reporting appliance** (D-001).
It consolidates an individual's (and their household entities') holdings across
accounts, instruments, and currencies into one private, honest picture: net
worth, portfolio analytics, allocation and policy drift, liquidity and cash
runway, realised/unrealised P/L for an accountant, insurance and estate
readiness, and a grounded AI briefing.

**It reports; it does not act.** The platform **never executes trades, never
advises, and never fabricates a number** (CLAUDE.md; Product Guarantees §3).
There are no order endpoints — market-data access (incl. Kite) is read-only.

**Who it's for.** The single owner of a personal or household wealth ledger who
wants a private, local record and reporting surface — spanning multiple
ownership entities (`self`, `spouse`, `trust`, `company`, `other`; D-010/D-065)
and multiple currencies — without sending their financial data to a cloud
service. Persona-based onboarding was deliberately removed (D-045); the product
does not profile its user.

**Scope of the v2 rebuild.** v2 re-implements the existing capability set on a
sound architecture. It **adds no new financial capabilities** (§6). Money math,
valuation, returns, and tax logic are re-used, not reinvented.

---

## 2. Deployment posture (D-001)

v2 core is a **single-user local appliance**:

- **Loopback bind by default.** The app serves on localhost.
- **LAN exposure is opt-in and requires a PIN** (D-001/D-002). Binding beyond
  loopback without a PIN drops into a setup/lock state.
- **No TLS, CSRF tokens, or multi-user isolation in v2 core.** These are
  explicitly accepted omissions for the local-appliance threat model
  (D-001/D-004); their rationale lives in SECURITY-BASELINE.md.
- **Sanctioned remote access = VPN / Tailscale** (D-001). Reaching the appliance
  from outside the LAN is done by joining its private network, not by exposing
  it to the internet.

**SaaS/PaaS is out of scope for v2 core — but not precluded** (D-001, recorded as
an ADR note, not a ROADMAP item). Multi-tenant SaaS/PaaS hardening will be a
future **proprietary layer**. v2 core must not make choices that preclude that
layer, but must not build for it either.

---

## 3. Product Guarantees (verbatim from DECISIONS.md)

> Destined verbatim for the glossary guarantee block, the Legal page, and README:
>
> 1. **No trades.** LedgerFrame never places or executes trades. No order
>    endpoints exist (Kite is market-data read-only).
> 2. **No advice.** Never gives buy/sell/hold, tax, or financial advice. Every
>    AI answer ends with the fixed information-only disclaimer.
> 3. **No fabrication.** Never fabricates a price, headline, or figure.
>    Insufficient inputs produce "—"/None with a reason, never a made-up number.
> 4. **No jurisdiction tax logic — ever** (D-077). `long_term_days` is a
>    neutral user-set threshold with no jurisdiction presets. Statements and
>    Realised P/L outputs are "for your accountant".
> 5. **No egress (opt-in)** (D-004). With the no-egress toggle enabled the
>    device makes zero outbound network calls — version check, feeds, and
>    banner included (D-066, D-075).
> 6. **No stored AI conversations** (D-016). AI questions and answers are
>    never persisted.
> 7. **The validation contract never weakens** (D-071). Implementation may
>    improve; the contract (below, §8) may not be loosened.

(The validation contract itself is normative in SECURITY-BASELINE.md.)

---

## 4. Deliberate-semantics register (protected design)

Each rule below was **deliberately decided** and is protected: it may not be
"fixed", normalised, or simplified away in the rebuild. Grouped by kind.

### 4a. Protected honesty features (not-removable copy) — DECISIONS.md §0

| Protected feature | What it guarantees | Decision | Shown on |
|-------------------|--------------------|----------|----------|
| **Not-a-Sharpe disclaimer** | "Return / volatility" is labelled explicitly **not a Sharpe ratio** (no risk-free rate subtracted). | D-030 | Portfolio (KeyStats) |
| **Real-indices vs ETF-proxy badge** | World indices marked when a real index vs an ETF proxy is shown. | D-051 | Markets (Global tab) |
| **"Reporting, never a trade instruction"** | Policy drift reports a gap; it never names or implies a trade. | D-055 | Policy |
| **Contributions don't reduce runway** | A contribution builds wealth; it is shown as monthly-equivalent and **never subtracted from cash runway**. | D-057 | Cash flow; Net worth (runway) |
| **'once' obligations excluded from burn** | One-off obligations are lumpy and **excluded from recurring net burn** (runway). | D-057 | Cash flow; Net worth (runway) |
| **Honest-NULL trade-date FX + excluded-events count** | Trade-date FX is captured only for same-day trades; backdated trades are honestly `None`, and the trade-date-FX realised total shows an **excluded-events count**. | D-020, D-076 | Reports |
| **Insurance cash-value exclusion lines** | Insurance cash value is **excluded from the headline Net worth total**, shown on Net worth as a **labelled *valued* line** ("Insurance cash value (excluded): «amount» — see Insurance") and stated on Insurance. | D-039, D-081 | Insurance; Net worth |
| **Visible AI-fallback signal** | When AI output fails grounding checks: "AI answer didn't pass grounding checks — showing facts directly." | D-070 | Ask panel; any AI surface |
| **Normative validation contract** | The AI validation contract may improve but **never weaken** (Product Guarantee 7). | D-071 | (SECURITY-BASELINE.md) |

### 4b. Architectural invariants — DECISIONS.md §0

| Invariant | Rule | Decision |
|-----------|------|----------|
| **Estate/insurance no-FK isolation** | Estate and insurance registers deliberately do **not FK** into portfolio tables; `estate_document.related_to` is **free text by design**. Protected from future schema "normalisation". | D-063 |
| **Backend-only money math** | All money math is backend `decimal.Decimal`; the **frontend never computes financial values**. Downstream reports consume the canonical readers (`value_portfolio`, `fifo_report`); they never re-derive money. | §0 / P-1 |
| **One datetime-normalisation utility** | v2 ships **one shared datetime-normalisation utility** for all naive/aware UTC handling; the scattered per-module fixes (`_sort_ts`, `_naive`, `_carry_forward`) are retired. | D-080 |

### 4c. Calculation honesty invariants — 04-CALCULATION-ENGINE §"Honesty invariants"

These are enforced in the calculation engine and must be preserved:

| Invariant | Rule |
|-----------|------|
| **None, not fabricated** | Insufficient inputs return `None`/"—" with a reason — never a made-up number (XIRR, TWR, attribution, FX, `pct_change` when `prev==0`). |
| **Never overwrite NAV** | `manual_value` / official NAV / statement valuations are **never overridden by staleness**; only market quotes degrade to "Stale cached value" (`valuation_label` precedence). |
| **Never mix trade-date and current FX** | The current-FX realised total and the trade-date-FX total are separate; a leg with no valid same-base trade-date rate is excluded, not silently converted at today's rate. |
| **Liabilities negative** | `AssetClass.liability` holdings count **negative** toward Net worth. |
| **Gross-asset denominators** | Allocation weight, concentration, and drift use **gross assets** (positive holdings) as the denominator so a mortgage cannot distort weights. |
| **Residual reconciliation** | Attribution carries an explicit **residual** so `Σ contributions + residual == headline` by construction. |
| **Costs never blended** | Recorded fees (a currency fact) and estimated Ongoing cost (a forward %) are shown as **two blocks, never combined** into one total. |
| **No annualized return below minimum history** (D-086) | Below a **named minimum-history constant**, performance shows **cumulative (non-annualized) return only** — no annualized/CAGR-style figure and no 1Y trailing return/volatility. **XIRR appears from the minimum-history threshold upward**; below it, XIRR is "Not applicable" (a case of "None, not fabricated"). |

---

## 5. Review signal thresholds (D-059)

The Review feed aggregates signals into "what needs a look" items, each wrapped
in its own try/except so one failing signal never breaks the feed (D-059). Every
threshold is a **named constant with a one-line rationale** (D-059). Values are
those recorded in 04-CALCULATION-ENGINE §13/§10/§11, **except the two owner-set
defaults in D-084** (`_RUNWAY_LOW_MONTHS = 3`, `_GOAL_SOON_DAYS = 180`) and the
signal added in D-087 (`_OTHER_CLASS_OVERUSE_PCT`). The canonical home for this
table is the Review page spec. **ROADMAP R-15** makes these thresholds
user-configurable (D-084).

| Constant | Value | Signal | Rationale (one line) |
|----------|-------|--------|----------------------|
| `_LIQUID_THIN_PCT` | 15 (%) | Liquidity thin when `liquid_pct` < 15% | Below ~1/7 of gross assets in immediate/short rungs is too little cushion to meet surprises. |
| `_RUNWAY_LOW_MONTHS` | **3** (D-084) | Runway low when `runway_months` < 3 | Owner-set floor (D-084): below three months' recurring net burn warrants a look. |
| `_GOAL_SOON_DAYS` | **180** (D-084) | Goal target date within 180 days | Owner-set (D-084): a half-year's notice to act on an approaching goal. |
| `_OBLIGATION_SOON_DAYS` | 30 | Obligation due within 30 days | One month's notice on an upcoming cash obligation. |
| `_INSURANCE_SOON_DAYS` | 30 | Insurance renewal within 30 days (or overdue) | One month to renew before a policy lapses; overdue always flags. |
| `_CORP_ACTION_RECENT_DAYS` | 45 | Split/bonus within 45 days → "verify" | Recent corporate actions warrant a manual verification window. |
| `low` confidence band | < 50 | Low-confidence holding count | Below the medium band (≥50); poorly-sourced values deserve attention. |
| `LEDGERFRAME_STALE_AFTER_SECONDS` | 900 (default) | Stale holding count | Quotes older than 15 min are flagged stale (EOD/NAV use a longer 30h threshold). |
| `_OTHER_CLASS_OVERUSE_PCT` | 10 (%) (D-087) | `other`-classed holdings exceed ~10% of gross assets | `other` is the honest escape valve (D-087); over-use signals holdings that should be reclassified. |
| `_INCOMPLETE_DETAILS_MIN` | **1** (D-091) | Manual holdings in {fixed_deposit, bond, property, retirement, private} recorded with **no** optional detail | Low-priority (`info`) nudge to enrich a bare-value holding — *never a hard wall*. A holding with any detail does not count. |
| Policy band / concentration | per-policy | Out-of-band buckets; positions over `max_position_pct` | Uses the user's own policy bands and optional concentration limit — no fixed number. |

The constant **names** are **reconciled verbatim** against
`app/services/review.py:25-30` (legacy v1 source, read-only): `_LIQUID_THIN_PCT`
(:25), `_GOAL_SOON_DAYS` (:26), `_OBLIGATION_SOON_DAYS` (:27),
`_INSURANCE_SOON_DAYS` (:28), `_RUNWAY_LOW_MONTHS` (:29),
`_CORP_ACTION_RECENT_DAYS` (:30); two previously-proposed names were corrected to
the real constants (`_INSURANCE_SOON_DAYS`, `_CORP_ACTION_RECENT_DAYS`).

**Value provenance (honest audit trail):** the legacy code values were
`_LIQUID_THIN_PCT = 15.0`, `_GOAL_SOON_DAYS = 90`, `_OBLIGATION_SOON_DAYS = 30`,
`_INSURANCE_SOON_DAYS = 30`, `_RUNWAY_LOW_MONTHS = 6`, `_CORP_ACTION_RECENT_DAYS
= 45`. **D-084 set two defaults away from the legacy code** (`_RUNWAY_LOW_MONTHS
= 3`, was 6; `_GOAL_SOON_DAYS = 180`, was 90) and **D-087 added
`_OTHER_CLASS_OVERUSE_PCT = 10`** (no legacy equivalent). **RECONCILED IN CODE
2026-07-13 (page-review Phase 0):** `review.py` now serves the owner-set values
(3 / 180) and implements the over-use signal — the table and the code no longer
disagree (the earlier deliberate divergence is closed; fail-first tests pin it).
Confidence band `<50` (`confidence.py`) and `LEDGERFRAME_STALE_AFTER_SECONDS`
(900) are per 04-CALCULATION-ENGINE §10/§11.
Confidence band `<50` (`confidence.py`) and `LEDGERFRAME_STALE_AFTER_SECONDS`
(900) are per 04-CALCULATION-ENGINE §10/§11.

---

## 6. Scope principle (D-065 / P-7)

> The rebuild **adds no new capabilities**, but **UI for existing capabilities
> that decided features depend on is in scope**. (Entity CRUD D-065 and token UI
> D-069 pass this test.)

Practical test for any proposed work: does it expose a capability the backend
already has, that a decided v2 feature needs? If yes, in scope (e.g. Entity CRUD
UI on Accounts, D-065; API-token management UI in Settings, D-069). If it is a
*new* financial capability, it is out of scope — it belongs on ROADMAP.md behind
a plan file, not in v2.

---

## 7. First-run checklist (D-045)

PersonaOnboarding is **killed** (D-045). It is replaced by a minimal **first-run
checklist run against real settings** — no personas, no profiling. Each step is
**skippable** and **links to its Settings home**:

1. **Base currency** → Settings · General
2. **Timezone** → Settings · General
3. **PIN** → Settings · Security
4. **Data provider** → Settings · Prices
5. **No-egress toggle** → Settings · Privacy — privacy posture is an explicit
   first-run choice (D-045)

Display density becomes a plain **Settings → Appearance** option (not an
onboarding step).

---

## 8. Settings — Privacy section (D-069)

Settings has 4 tabs; the **Privacy section** makes the privacy posture visible,
not merely available (D-069):

- **No-egress toggle.** When enabled the device makes **zero outbound network
  calls** — feeds, version check, and update banner included (Product Guarantee 5;
  D-066/D-075).
- **"AI never persists" statement.** AI questions and answers are never stored
  (Product Guarantee 6; D-016).
- **Privacy-mode indicator.** Always-visible label of the current privacy mode.
- **Current egress state shown as a plain statement** — e.g. **"This device
  makes no network calls"** when no-egress is enabled. **State shown, not merely
  offered** (D-069).

(Also in Settings, though not part of the Privacy section: the **API-token
management card** — create/name/revoke, token shown once, [S]-gated, passes P-7,
D-069. Full Settings layout is in INFORMATION-ARCHITECTURE.md §5.)

---

**Derived from:** `docs/audit/01-FEATURE-INVENTORY.md`,
`docs/audit/04-CALCULATION-ENGINE.md`, and `docs/audit/DECISIONS.md` throughout.
Decision IDs applied: D-001, D-002, D-004, D-010, D-016, D-020, D-030, D-039,
D-045, D-051, D-055, D-057, D-059, D-063, D-065 (P-7), D-066, D-069, D-070,
D-071, D-075, D-076, D-077, D-080, plus **Batch 12: D-081 (insurance valued
line, amends D-039, §4a), D-084 (owner-set review defaults, §5), D-086 (no
annualized return below minimum history, §4c), D-087 (`other` over-use signal,
§5)**, plus the Product Guarantees block (D-077 + accumulated) verbatim. §5
Review threshold **names** are reconciled against the legacy v1 source
`app/services/review.py:25-30` (read-only); two **values** (`_RUNWAY_LOW_MONTHS`,
`_GOAL_SOON_DAYS`) are owner-set overrides per D-084.

## Needs decision

- (none) — the Review threshold constant **names** (DEF-7) are reconciled against
  `app/services/review.py`; **values** now include two owner-set overrides
  (`_RUNWAY_LOW_MONTHS = 3`, `_GOAL_SOON_DAYS = 180`, D-084) that deliberately
  diverge from the code, plus the `_OTHER_CLASS_OVERUSE_PCT = 10` signal (D-087).
  The divergence is recorded in §5 (Batch 12).

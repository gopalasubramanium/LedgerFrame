# GLOSSARY.md — LedgerFrame v2 Canonical Terminology

**Normative for all UI copy.** Every term shown to a user must appear here with
that exact spelling (CLAUDE.md hard rule). Where an audit recommendation and
DECISIONS.md conflicted, the decision wins and only the chosen term appears
below; retired synonyms are listed in the [Deprecated terms](#deprecated-terms)
table with their replacement and the deciding ID. Terms marked **[Help]** have a
full what/why/improves entry in the in-app Help catalogue.

---

## Product Guarantees (verbatim from DECISIONS.md)

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

---

## Headline totals & formula relationships

The one headline total is **Net worth**. Its components are labelled; no other
figure competes with it for the headline slot (D-021).

```
Net worth      = Gross assets − Liabilities
Gross assets   = Σ (positive holdings' current market value, base ccy, today's FX)
Liabilities    = Σ (LIABILITY-class holdings, counted negative)
```

| Term | Canonical definition |
|------|----------------------|
| **Net worth** | Gross assets − Liabilities, in base currency. The only headline total. In code this equals `value_portfolio.total_value` because liabilities are already stored negative. Canonical on the **Net worth** page. **[Help]** |
| **Gross assets** | Sum of positive holdings' current market value in base currency at today's FX. Appears **only as a labelled component**, never as a standalone headline (D-021). |
| **Liability** | An `AssetClass.liability` holding; counted **negative** toward Net worth. |
| **Cash & deposits** | The KPI-strip figure for immediately/near-term available cash on the Net worth page (D-054). |

---

## Instruments, holdings, accounts

| Term | Canonical definition |
|------|----------------------|
| **Instrument** | A tradable/valuable security identified by symbol + exchange, with taxonomy (asset class/subclass, `listing_country`, sector) and linked identifiers (ISIN/AMFI/CoinGecko/Kite/…). Model `Instrument`. **Classification (D-085):** `asset_class` describes economic **exposure**; `asset_subclass` describes the **wrapper** — e.g. a listed REIT is `asset_class = property` with `asset_subclass = reit`. |
| **Identifier** | A normalized key mapping an instrument to the outside world (`id_type`, `value`): ISIN, CUSIP, FIGI, SEDOL, amfi_code, kite_token, coingecko_id, provider_symbol. High-confidence ids are globally unique. |
| **Holding** | The row: a quantity of one instrument in one account. **Derived** from the transaction ledger via FIFO (rebuilt on every mutation) — except **manual holdings**, which survive rebuilds. |
| **Position** | The quantity count within a holding. (Use **Position** for the count, **Holding** for the row.) |
| **Manual asset / holding** | A holding valued by a user-entered `manual_value` (cash, property, private, FD, insurance cash value), not a market quote. |
| **Lot** | A single parcel from one buy, with its own acquisition date and unit cost. FIFO consumes lots oldest-first. |
| **Tax lot / Open lot** | An unsold lot with acquisition date, quantity, cost, and holding period. **[Help]** |
| **Account** | A container of holdings at an institution, with a currency, kind, and an owning entity. Canonical on the **Accounts** page. |
| **Institution** | The broker/bank an account is held at (`Account.institution`), from the Institution master. Retired synonym: "platform" (D-029). |
| **Entity** | An ownership entity. `kind` ∈ {self, spouse, trust, company, other}. Every account belongs to one; consolidated views span all. "Household" is a valid **entity name**, not a kind and not a separate term (D-029). Model `Entity`. |

---

## Valuation & provenance

| Term | Canonical definition |
|------|----------------------|
| **Cost basis** | Quantity × FIFO average cost (native ccy → base). Canonical on **Portfolio**. |
| **Valuation method** | How a value was established: `market_quote`, `official_nav`, `broker_quote`, `manual_valuation`, `statement_import`, `calculated_accrual`, `estimated_value`, `fx_reference`, `unavailable` (enum `ValuationMethod`, 9 values). `calculated_accrual` and `statement_import` remain in the vocabulary but **no v2 lane emits them** (D-073). **[Help]** |
| **Provenance** | The traceable record of where a value came from — source, valuation method, identifier mapping, timestamp. **[Help]** |
| **Data confidence** | 0–100 score of how well-sourced a value is: base-by-valuation-method minus itemised penalties (stale −20, needs-mapping −15, unavailable −15). Value-weighted at portfolio level. **[Help]** |
| **Mapping required** | An instrument needs an identifier (AMFI code / CoinGecko id) before its cache-publish source can price it. |
| **Auth required** | A configured, higher-priority keyed provider is missing credentials. |

### Freshness — the three-layer structure (D-027)

These three layers are distinct and must not be conflated. Loose use of
"as_of" or "delayed" outside these definitions is retired.

| Layer | Term | Canonical definition |
|-------|------|----------------------|
| 1 | **Entitlement** | The best data grade a **source claims**: `real-time`, `delayed`, `end-of-day`, `cached`, `unavailable` (`EntitlementStatus`). LedgerFrame never claims real-time. **[Help]** |
| 2 | **Stale** | A cached quote older than its threshold (`stale_after_seconds`, default 900s; EOD/NAV 30h). Flagged, **never hidden or faked**. **[Help]** |
| 3 | **Status** | The one-word **Pricing Health** chip summarising a holding's pricing state: `Fresh` / `Delayed` / `End-of-day` / `Cached` / `Manual` / `Estimated` / `Unavailable` (`provenance.health_status`). |

### Source / Provider / Routing — the split (D-028)

One concept per word; do not interchange.

| Term | Scope | Canonical definition |
|------|-------|----------------------|
| **Source** | User-facing | The provenance term — what owns a given price. This is the word shown to users. |
| **Provider** | Settings only | The adapter/config concept (mock/csv/yahoo/alphavantage/eodhd/kite; metadata adapters amfi_nav/coingecko/ecb_fx). Appears only in Settings. |
| **Routing / route** | Internal | The per-instrument decision of which source owns a price. Internal + **Pricing Health** diagnostics only. |

---

## Returns & performance

| Term | Canonical definition |
|------|----------------------|
| **Realised P/L** | Sale proceeds − FIFO-matched cost of the parcels sold. Native currency exact (filing-grade, D-076); base total shown at today's FX (indicative) or trade-date FX with an excluded-events count. Report heading is "Realised P/L report" (D-026). Not tax advice. **[Help]** |
| **Unrealised P/L** | Current market value − cost basis on holdings still held. ("Paper gain" is a retired colloquialism; the glossary may explain it, UI may not use it — D-026.) **[Help]** |
| **Today's change** | The day's change in value. The only term for this concept (D-025). **[Help]** |
| **Income** | Dividends + interest recorded in the ledger, base currency at today's FX. **[Help]** |
| **Income yield** | Recorded income ÷ current gross assets (trailing, backward-looking). **[Help]** |
| **Total return** | Overall % gain/loss vs cost basis, since-inception **cumulative** (non-annualized). Below the minimum-history threshold it is the **only** return shown (D-086). **[Help]** |
| **1-year return / volatility / max drawdown** | Trailing-12-month figures from the invested performance series; 0.0 can mean "no data". Annualized/trailing figures are **suppressed below the minimum-history threshold** (D-086). **[Help]** |
| **Current holdings — price return** | The **performance chart's** line: **today's positions marked-to-market over the window** (current quantities × historical prices × FX), **excluding external flows and closed positions**. It answers *"what would my current holdings have been worth"*, **not** *"how did my decisions perform"* — so it is **neither TWR nor money-weighted** (those are separate stat-rail figures). Invested holdings only; the **"include manual assets"** variant adds constant manual assets (a net-worth-style line). **[Help]** |
| **XIRR** | Money-weighted return — the IRR of dated cash flows. **Appears only from the minimum-history threshold upward**; below it, "Not applicable" — never a fabricated annualized figure (D-086). **[Help]** |
| **TWR** | Time-weighted return — chain-linked daily returns with external flows removed (for benchmark comparison). **[Help]** |
| **Return / volatility** | 1Y return ÷ 1Y volatility. **Explicitly NOT a Sharpe ratio** (no risk-free rate subtracted) — this disclaimer is protected copy (D-030). **[Help]** |
| **Return attribution** | Per-holding contribution (weight × return, signed pp) rolled to class/sector, with an explicit **residual** (income + realised + closed positions) so Σ contributions + residual = headline. Single-period approximation. **[Help]** |
| **Beta / Correlation / Downside deviation / Information ratio / Tracking error** | Benchmark-relative (or downside) risk metrics needing no risk-free rate. Sharpe/Sortino deliberately excluded. **[Help]** |

### Movers — two pairs, two list types (D-024)

Both pairs exist; the pair used depends on the list type. Never interchange them,
and "Top movers" is retired as a label.

| Pair | List type | Canonical home |
|------|-----------|----------------|
| **Gainers / Losers** | **Price-move** lists (ranked by price change) | Markets |
| **Contributors / Detractors** | **Contribution-weighted** lists (ranked by contribution to portfolio return) | Portfolio |

Home shows one summary of each, linked to its canonical page.

### News (briefing & headlines) — D-037/D-068 (page-news ND-9)

| Term | Canonical definition |
|------|----------------------|
| **Briefing** | A short, **factual** daily summary of your portfolio and the market, built **deterministically from your own served figures** — never a fabricated number. **Information only, not advice.** Canonical on **News** (Home shows a summary). Richer AI narration is a future addition (AI-surfaces milestone, D-068) and is not shown until then. **[Help]** |
| **Headlines** | **Grouped news headlines** retrieved from your configured sources (RSS + provider), **deduplicated** and grouped by area (My holdings · India · Singapore · US · Global · Macro / FX); "My holdings" ranked by relevance. **Retrieved, never invented** — the app never fabricates a headline (Guarantee 3). Under **no-egress**, none are fetched (honest empty). Canonical on **News**. **[Help]** |

---

## Allocation, risk, policy

| Term | Canonical definition |
|------|----------------------|
| **Allocation weight** | Each asset group's share of **gross** assets (liabilities excluded). Canonical on **Portfolio**. **[Help]** |
| **Concentration** | Share of gross assets in the biggest positions. Kept **distinct** from the terms below — never interchanged (D-029). **[Help]** |
| **Largest position** | The single biggest holding's share of gross assets. |
| **Top-5** | Combined share of the five biggest holdings. |
| **HHI** | Herfindahl-Hirschman Index — Σ squared weights; 1/N (equal) → 1 (single). **[Help]** |
| **Investment policy (IPS)** | Stored **intent**: target allocation per dimension, tolerance bands, optional concentration limit. Intent only — drift is computed live, never stored. |
| **Drift & bands** | Actual − target share; if beyond the band, "over"/"under". **Reporting, never a trade instruction** (protected copy, D-055). **[Help]** |
| **Dimension** | The policy axis: asset_class / currency / region. |
| **Bucket** | A value within a dimension (e.g. equity / SGD / India), driven by that dimension's master (D-055). |
| **Region** | Derived from `listing_country`, never stored (D-007). Six buckets (D-083): **India** (IN), **Singapore** (SG), **US** (US), **Europe**, **APAC**, and **Other** (catch-all for any unlisted country). Full membership table in MASTER-DATA §4. |
| **Unclassified sector** | The explicit sector-view bucket for positive holdings with `sector = null` — non-equity assets (property, cash, deposits) and non-company exposures (crypto, index/ETF wrappers, commodities) that **have no sector** (this is the truth, not a "pending" state). Shown as its own bucket, never hidden (D-082; label amended 2026-07-11). |

---

## Liquidity, planning, cash

| Term | Canonical definition |
|------|----------------------|
| **Liquidity ladder** | Assets grouped by time-to-cash: Immediate / Short / Locked / Illiquid (from `liquidity_profile` override or asset class). Canonical on **Net worth**. **[Help]** |
| **Liquid** | Immediate + Short rungs. |
| **Cash runway** | Liquid assets ÷ recurring net burn (expenses − income), at today's FX. Status: no_data / positive / finite. Canonical on **Net worth**. **[Help]** |
| **Goal** | A target amount with a basis (net_worth / liquid / none); progress computed live. |
| **Obligation** | A recurring or one-off future cash flow (expense / income); feeds runway + next-12-months total. `once` obligations are **excluded from recurring burn** (protected semantics, D-057). |
| **Contribution** | A recorded plan (invest / withdraw / prepay); shown as monthly-equivalent; **does not reduce runway** (protected semantics, D-057). |
| **Scenario** | A deterministic "what-if" shock on today's values — a **scenario, never a forecast** (protected copy, D-058). |
| **Cash flow** | The planning page holding Goals, Obligations, and Contributions (renamed from "Planning", D-056). It sits inside the **Planning** nav group. |

---

## Cost & organisation

| Term | Canonical definition |
|------|----------------------|
| **Recorded fees** | Actual commissions + taxes from the ledger for a year (a currency fact). |
| **Fee (recorded)** | A **standalone charge** transaction (`type = fee`) — custody / platform / advisory fees not tied to a specific trade. It flows to the **Recorded fees** block and **never enters cost basis** (no FIFO effect, D-048 never-blend). Trade commissions, by contrast, are recorded **on the trade** (the buy/sell `fees` field). Entered as a single **Amount** (no quantity/price). |
| **Ongoing cost (expense ratio)** | Forward estimate = expense ratio (`annual_cost_bps`) × current value. Kept **separate** from recorded fees, never blended. A card may be titled "Costs" (D-029). **[Help]** |
| **Statements** | Income, fees, cash flow, realised-vs-unrealised from recorded transactions — for review / your accountant. |
| **Review** | The page/concept: a live "what needs a look" feed from existing signals; a recorded review snapshots state to `ReviewLog`. "what needs a look" may survive as body copy but not as a label (D-030). Canonical on the **Review** page. |
| **Tag** | A user-extensible, case-insensitively-unique label on a holding (cap 16/holding). Normalised on write (lowercase/underscore/truncate, D-104) but **rendered verbatim** (no UI casing transform); demo-seed tags carry display casing as a sanctioned exception. |

---

## Corporate actions & FX

| Term | Canonical definition |
|------|----------------------|
| **Split** | Corporate action scaling lots by the ratio in the `price` field. |
| **Bonus** | Zero-cost extra shares (average cost falls). |
| **Merger** | Instrument A absorbed into B at ratio R; A's lots carried into B as synthetic buys (`resolve_mergers`), no realised event. Recorded via the transaction form ("Absorbed into" + "Ratio", D-019). |
| **Rights issue** | Exercising a rights issue is recorded as a **Buy at the rights (subscription) price** — an existing transaction type, correct cost basis, **no special form** needed. (The right to subscribe is not itself valued; only the exercised purchase is recorded.) |
| **Buyback** | A tendered share buyback is recorded as a **Sell at the offer price** — an existing transaction type, correct realised P/L, no special form needed. |
| **De-merger / Spin-off** | A holding splits into several resulting instruments — a **merger-in-reverse**: cost basis is **apportioned** across the resulting instruments per an approved ratio, the **holding period is carried** (original acquisition dates kept), and there is **zero realised gain** (not a sale). **Not in v2** — parked as ROADMAP **R-7** (v2.1 "accounting precision"); until built there is no single-action form for it. |
| **Ticker / name change** | An instrument's **display name** can be corrected today (edit instrument → name); because transactions, holdings, and lots reference the instrument's **id** (not the symbol string) and identity is `(id_type, value)`, the change **preserves transaction history and price continuity**. Changing the **symbol/ticker** itself is not yet exposed — parked as ROADMAP **R-7** (the data model already supports it safely). |
| **Trade-date FX** | The native→base rate captured live at commit **only when the trade date is today**; else honestly unavailable (honest-NULL). Feeds the trade-date-FX realised total, shown with an excluded-events count (D-020). |
| **Reference FX (ECB)** | EUR-based reference rates used only as an FX translation fallback, never a trading quote (`ecb_fx`, quote capability = ✗, D-074). |
| **Base currency** | The single reporting currency everything is translated to (`LEDGERFRAME_BASE_CURRENCY`). |

---

## Insurance & estate — two document concepts (D-062)

These two "documents" ideas are distinct and must not be merged in copy:

| Term | Canonical definition |
|------|----------------------|
| **Policy documents (checklist)** | Per-policy: "do I hold this policy's papers?" A checklist on the Insurance page. |
| **Estate documents** | Estate-wide: "is my estate documentation in order?" The document register on the Estate page (`estate_document`, `related_to` free text by design). |
| **Insurance cash value** | Surrender/cash value of a policy. **Excluded from the headline Net worth total** in v2; shown on the Net worth page as a labelled **valued** line ("Insurance cash value (excluded): «amount» — see Insurance", D-039/D-081) and stated visibly on Insurance. Opt-in inclusion stays parked (R-9). |

---

## System

| Term | Canonical definition |
|------|----------------------|
| **Detail level: Simple/Expert** | Presentation-only view mode; scoped to Home in v2 (D-040). The control's single label wherever it appears (D-030). |
| **Home layout: Simple / Full** | The Settings control choosing Home's composition; Full adds the fuller widget set and the ticker strip (D-040/D-046/D-047). |
| **No-egress toggle** | The privacy switch that makes the device make zero outbound network calls when enabled — feeds, version check, and banner included (Product Guarantee 5). |
| **Demo mode** | `market_provider == "mock"` — deterministic DEMO data, entitlement delayed, seeded on empty DB. |
| **Reports Pack** | A print/export artifact composed from canonical readers with disclaimers preserved — the one sanctioned duplication, reachable from Reports only (D-038/D-061). Not a page in the IA sense. |

---

## Deprecated terms

Term (retired) → replacement, with the deciding ID. These must not appear in UI
copy.

| Retired term | Use instead | Decision |
|--------------|-------------|----------|
| Total value | Net worth (with liabilities) / Gross assets (positive holdings), per context | D-021 |
| Portfolio value | Net worth / Gross assets, per context | D-021 |
| Snapshot (page/nav) | Net worth | D-022 |
| Top movers | Gainers / Losers **or** Contributors / Detractors, per list type | D-024 |
| Today (alone) | Today's change | D-025 |
| Day / day_change | Today's change | D-025 |
| Realised gain(s) (incl. headings) | Realised P/L | D-026 |
| Realised (alone) | Realised P/L | D-026 |
| Paper gain | Unrealised P/L (colloquialism may be explained, not shown) | D-026 |
| as_of / delayed (loose usage) | Entitlement / Stale / Status, per the three-layer structure | D-027 |
| Provider (as user-facing provenance) | Source | D-028 |
| route_source / routing (user-facing) | Source (user) · Routing kept for Pricing Health diagnostics only | D-028 |
| Cost of ownership | Ongoing cost (expense ratio) | D-029 |
| Platform | Institution | D-029 |
| Household (as a term/kind) | Entity (Household is only a valid entity name) | D-029 |
| Review Centre | Review | D-030 |
| Needs a look (as label) | Review | D-030 |
| What needs attention | Review | D-030 |
| Planning (as page label) | Cash flow (page) · "Planning" survives only as the nav group name | D-056 |

---

**Derived from:** `docs/audit/09-GLOSSARY.md`, `docs/audit/06-UI-AND-TERMINOLOGY-AUDIT.md`
(sections b, c), and `docs/audit/DECISIONS.md`. Decision IDs applied: D-010,
D-019, D-020, D-021, D-022, D-023, D-024, D-025, D-026, D-027, D-028, D-029,
D-030, D-039, D-040, D-046, D-047, D-054, D-055, D-056, D-057, D-058, D-061,
D-062, D-073, D-074, D-076, D-077 (Product Guarantees block verbatim), plus
**Batch 12: D-081 (insurance valued line), D-082 (non-equity sector bucket),
D-083 (six-bucket region), D-085 (class=exposure / subclass=wrapper), D-086
(no annualized return below minimum history)**. Where the
audit and DECISIONS.md conflicted, the decision won (notably: "Total value"
retired for Net worth/Gross assets; the single "movers" canonical replaced by
two pairs; "Provider/Source" split into Source/Provider/Routing; Entity kind set
corrected to self/spouse/trust/company/other with "Household" as a name only).

## Needs decision

- (none — all terminology conflicts in scope were resolved by DECISIONS.md
  Batch 4 and the referenced decisions.)

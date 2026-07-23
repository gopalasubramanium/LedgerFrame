# GLOSSARY.md — LedgerFrame v2 Canonical Terminology

**Normative for all UI copy.** Every term shown to a user must appear here with
that exact spelling (CLAUDE.md hard rule). Where an audit recommendation and
DECISIONS.md conflicted, the decision wins and only the chosen term appears
below; retired synonyms are listed in the [Deprecated terms](#deprecated-terms)
table with their replacement and the deciding ID. Terms marked **[Help]** have a
full what/why/improves entry in the in-app Help catalogue.

---

## Product Commitments (canonical in `PRODUCT-SPEC.md` §3 — this block is a pointer)

**SUBTITLE CORRECTED 2026-07-20** (AI-surfaces §9(j) record-hygiene authorization; plan §0-K item
2). This heading read *"(verbatim from DECISIONS.md)"* — a relationship `PRODUCT-SPEC.md:67-74`
records as **no longer holding**, and one this block's own body (below) already contradicted. The
heading now states the relationship that actually holds: **`PRODUCT-SPEC.md` §3 is the rendering
source** — guarded by `tests/unit/test_legal_content.py` (AC-L3) and served verbatim to the Legal
page — and **`DECISIONS.md` is the ratifying record**, history that is not rewritten. This block
copies neither. *(Same correction the Legal milestone made to the §3 subtitle itself, page-legal
§11-2; a stale subtitle is a claim, and a claim gets checked.)*

**RENAMED 2026-07-20 (owner, page-legal §11-1): "Product Guarantees" → "Product Commitments".**
*Why:* **"guarantee" is warranty-family vocabulary**, and the product's warranty position — stated
in the licence it actually ships under, AGPL-3.0-or-later section 15 — is **NO WARRANTY**. A page
that headed these seven as *guarantees* and then disclaimed all warranty two sections later
contradicted itself **in its own vocabulary**. The seven are what they always were: **self-enforced
behavioural commitments, each one tested**. The name now says that. The **claims are unchanged** —
this is a rename, not a weakening, and nothing the product promised before it promises less of now.
*Deprecated synonym:* **Product Guarantees** (see [Deprecated terms](#deprecated-terms)).

**THE SEVEN LIVE IN `PRODUCT-SPEC.md` §3 — THIS FILE POINTS AT THEM AND DOES NOT COPY THEM.**

*Changed 2026-07-20 (page-legal §11-2), and the reason is this file's own rule.* There were
**three** copies of the commitments block — `DECISIONS.md`, `PRODUCT-SPEC.md` §3, and one here —
and **exactly one of them was guarded**: `tests/unit/test_legal_content.py` (AC-L3) asserts string
equality between §3 and the served page, and nothing at all watched this copy. When §3 was cleaned
for rendering, this copy went stale **silently**, which is precisely the failure the
one-canonical-home rule exists to prevent — and a glossary that quietly disagreed with the spec
would be the worst possible place for the drift to land.

So: **`PRODUCT-SPEC.md` §3 is the rendering source of record**, guarded, and served verbatim to
the Legal page. **`DECISIONS.md` is the ratifying record** — history, not rewritten. This block is
a **pointer to the first**, which is what the rest of this file already does for every term it
does not own.

See **[Product Commitments](#system)** in the System table for the one-line definition, and
`docs/specs/PRODUCT-SPEC.md` §3 for the seven as the user reads them.

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
| **Liabilities** | The **aggregate** figure: the total of all **Liability** holdings, stated **positive** as a component of **Net worth** (`Net worth = Gross assets − Liabilities`). Canonical on the **Net worth** page (D-032); one of its four KPI-strip figures (D-054). **Distinct from Liability**, which is the asset-class term for a single holding — the aggregate is a figure, the class is a taxonomy. |
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
| **Positions** | The **count of Holdings** currently held — the Portfolio stat-rail figure (`len(value_portfolio(...).holdings)`). **Counts every non-soft-deleted Holding, INCLUDING Liability holdings** and including any that could not be valued (rendered *Unavailable*, never fabricated). It is therefore a count of **rows in the ledger**, not of assets owned — a portfolio of 13 assets and one mortgage reports **14**. Distinct from **Gross assets**, which counts value and excludes liabilities. |
| **Manual asset / holding** | A holding valued by a user-entered `manual_value` (cash, property, private, FD, insurance cash value), not a market quote. |
| **Purge** | Permanently deleting the soft-deleted ("trashed") holdings and transactions — emptying the trash. Irreversible: the rows are gone for good and cannot be restored. A **D-103** action — it always demands a **freshly-entered PIN**, never the unlocked session. **[Help]** |
| **Lot** | A single parcel from one buy, with its own acquisition date and unit cost. FIFO consumes lots oldest-first. |
| **Tax lot / Open lot** | An unsold lot with acquisition date, quantity, cost, and holding period. **[Help]** |
| **Account** | A container of holdings at an institution, with a currency, kind, and an owning entity. Canonical on the **Accounts** page. |
| **Institution** | The broker/bank an account is held at, from the user-extensible **Institution master** (`Account.institution_id` FK; also FK'd from `insurance_policy.institution_id`). Create · rename · **merge** · delete (FK-blocked). Retired synonym: "platform" (D-029). |
| **Entity** | An ownership entity. `kind` ∈ {self, spouse, trust, company, other}. Every account belongs to one; consolidated views span all. "Household" is a valid **entity name**, not a kind and not a separate term (D-029). Model `Entity`. |
| **Account kind** | The category of an account: `brokerage`, `bank`, `retirement`, `wallet`, `property`, `manual`, `other` (fixed vocab, `account_kind`). Distinct from the account's currency and entity. Canonical on the **Accounts** page. |
| **Cost-basis method** | The per-account method for computing realised gains from lots: `fifo` (FIFO — oldest lots sold first) or `average` (all open lots pooled to one average cost). Distinct from **Cost basis** (the amount). Changing it on an account **with history** restates realised/unrealised figures (D-018). Canonical on the **Accounts** page. **[Help]** |
| **Rollup** | A per-account summary of the holdings/value reader — value, holdings count, asset classes, currencies, and stale / low-confidence counts — shown on the **Accounts** page. A **linked summary** of the canonical reader, never a second figure or a recompute (P-1 / D-031). |
| **Merge** | Folding one Institution master row (the **duplicate**) into another (the **survivor**): re-point every referencing account and policy onto the survivor, then delete the duplicate — in one transaction. **User-driven** (you name both); no fuzzy auto-detection. Offered when a delete is blocked because rows still reference the institution. |

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
| **Source** | User-facing | The provenance term — what owns a given price (the "priced-by" on the quote badge). This is the word shown to users. |
| **Source override** | User-facing (Instrument → Edit / Identity) | Your explicit per-instrument choice of which **Source** should own this holding's price — it pins the routing head. Distinct from **Source**: an override names your *preference*; Source names the *result* that actually priced it (they differ when the override can't price and the net falls through). Empty / "auto" clears it. **[Help]** *(R-63 F-C session, ruled 2026-07-24; disambiguates the two "Source" semantics — override vs priced-by.)* |
| **Provider** | Settings only | The adapter/config concept (mock/csv/yahoo/alphavantage/eodhd/kite; metadata adapters amfi_nav/coingecko/ecb_fx). Appears only in Settings. |
| **Routing / route** | Internal | The per-instrument decision of which source owns a price. Internal + **Pricing Health** diagnostics only. |

### Intraday price series (R-42)

Sub-daily price bars, so the short chart ranges (1D / 5D) can show honest sub-daily
granularity instead of the daily-only store. Tier-aware, user-triggered, persisted once
fetched; a range with no intraday data stays honestly disabled with a **served** reason.

| Term | Canonical definition |
|------|----------------------|
| **Intraday** | Sub-daily price bars for a single trading day (e.g. 1-minute bars for the 1D range). Shown only where a source actually served them — never fabricated; a range with no intraday data stays honestly disabled with a served reason. **[Help]** |
| **Interval** | The bar granularity of a price series (`1min`, `5min`, `1d`). The **range** you pick (1D / 5D / 1M …) maps to an interval on the server; the interval literal is internal and is never shown in copy. **[Help]** |
| **Routing matrix** | User-facing (Settings → Data feeds) | Your table of *which provider prices each kind of instrument in each market* — one choice per asset-class × listing-country. It is a **preference layer**, not a price: a cell only takes effect when the provider you named can actually price that instrument, and it **can never fabricate, replace, or worsen** a value — if the named provider can't price a holding, LedgerFrame falls back to its normal source exactly as before. It never executes trades and never advises. Pricing Health shows the outcome **read-only**. **[Help]** *(data-feed-routing §9-T, ruled 2026-07-18.)* |

### Historical valuation backfill (R-43)

The Net-worth trend reads dated valuation records. A **Backfill** reconstructs the ones that
predate the appliance from price history + the transaction ledger + per-date FX, so the trend
stops being flat. Every reconstructed point rests on honestly-available inputs — a date without a
price or an exchange rate is a flagged, carried-forward gap, never a fabricated number.

| Term | Canonical definition |
|------|----------------------|
| **Snapshot** | A dated record of the portfolio's valuation — assets, liabilities and **Net worth** — at a point in time. The **Net worth** trend is a series of these; they are written forward as the appliance runs, added on demand (the snapshot-now action), or reconstructed by a **Backfill**. *(Distinct from the retired "Snapshot" page/nav alias for **Net worth**, D-022 — this is the data concept.)* **[Help]** |
| **Backfill** | Reconstructing past **Snapshot**s from price history + transactions + per-date FX, and persisting them as dated records, so the **Net worth** trend shows real history. A backfilled figure is marked as such and rests only on honestly-available inputs — a date with no price or exchange rate is a flagged, carried-forward gap, never fabricated. **[Help]** *(R-43 §9-T, ruled 2026-07-18.)* |

---

## Returns & performance

| Term | Canonical definition |
|------|----------------------|
| **Realised P/L** | Sale proceeds − FIFO-matched cost of the parcels sold. Native currency exact (filing-grade, D-076); base total shown at today's FX (indicative) or trade-date FX with an excluded-events count. Report heading is "Realised P/L report" (D-026). Not tax advice. **[Help]** |
| **Unrealised P/L** | Current market value − cost basis on holdings still held. ("Paper gain" is a retired colloquialism; the glossary may explain it, UI may not use it — D-026.) **[Help]** |
| **Today's change** | The day's change in value. The only term for this concept (D-025). **[Help]** |
| **Income** | Dividends + interest recorded in the ledger, base currency at today's FX. **Sanctioned short form: `Income (div/int)`** — the label used where a fact list or KPI strip must disambiguate income from the *Obligation* sense of the word in a single narrow row (the AI fact pack, `app/services/analytics.py` KPIs). **The canonical term is unchanged and there is NO app-wide rename** (owner ruling, AI-surfaces §17-3, 2026-07-20 — F8): a rename would reach every page that shows income, for a problem that exists only where the row is too narrow to say *(dividends & interest)*. So the short form is **sanctioned, singular and guarded** — one abbreviation, recorded here first, rather than a habit of abbreviating. Parity: `tests/unit/test_glossary_parity.py`. **[Help]** |
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
| **Briefing** | A short, **factual** daily summary of your portfolio and the market, built **deterministically from your own served figures** — never a fabricated number. **Information only, not advice.** Canonical on **News** (Home shows a summary). Richer AI narration is a future addition ~~(AI-surfaces milestone, D-068)~~ **(deferred to ROADMAP R-45 by the owner, 2026-07-20 — AI-surfaces ships the Ask panel, not Briefing narration)** and is not shown until then. **[Help]** |
| **Headlines** | **Grouped news headlines** retrieved from your configured sources (RSS + provider), **deduplicated** and grouped by area (My holdings · India · Singapore · US · Global · Macro / FX); "My holdings" ranked by relevance. **Retrieved, never invented** — the app never fabricates a headline (Commitment 3). Under **no-egress**, none are fetched (honest empty). Canonical on **News**. **[Help]** |

| **Ask panel** | The panel that answers questions about **your own data**, opened from the top bar. Every answer is built from a **Fact pack** shown before it, is checked against the **Validation contract** before you see any of it, and ends with the fixed information-only disclaimer. **Nothing you ask or receive is stored** (Commitment 6) — closing the panel discards the exchange. **[Help]** |
| **Fact pack** | The **served figures and help entries an AI answer is built from**, shown **before** the answer rather than after it, so what the answer rests on is visible whether or not you read the answer. Facts carry their source and staleness. **The facts are the only source of numbers** — the AI never computes one. |
| **Grounding** | Building an answer **only** from the Fact pack. An answer that introduces a figure, symbol or quotation not in the pack is **not grounded** and is discarded before display — you are shown the facts directly, and told that is what happened. |
| **Validation contract** | The **seven checks every AI answer passes before it is displayed** — buffered and never streamed raw; every significant figure traced to a fact; unknown symbols, recommendations, real-time claims and secret-like text rejected; long quotations verbatim; failure falls back to a deterministic answer. **It may be strengthened and never loosened** (Commitment 7). |

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
| **Policy (investment)** | The **investment policy** — your own target allocation, bands and optional concentration limit. Canonical on the **Policy** page. **Distinct from an insurance policy** (a protection contract, on Insurance); the two never mean the same thing, and the nav label "Policy" always means this one. *(PROPOSED 2026-07-14, page-policy §9-14 — ratify at the walk.)* **[Help]** |
| **Target** | The share of gross assets you **intend** to hold in a bucket. Your own number — the platform never sets, suggests or judges it. *(PROPOSED 2026-07-14 — ratify at the walk.)* **[Help]** |
| **Band** | The tolerance either side of a target, within which a bucket counts as **In band**. Set per target, or inherited from the policy's default band. Your own number — there is no fixed platform threshold. *(PROPOSED 2026-07-14 — ratify at the walk.)* **[Help]** |
| **In band** | The actual share sits **within** the target's band. Nothing to look at. *(PROPOSED 2026-07-14 — ratify at the walk.)* |
| **Out of band** | The actual share sits **outside** the target's band — **over** or **under**. It reports a **distance**, and **never a trade instruction** (protected copy, D-055). Over and under are flagged the same way: both simply need a look. *(PROPOSED 2026-07-14 — ratify at the walk.)* **[Help]** |
| **Gap to target** | The **distance** from a target, in base currency: actual value − target value. Positive = above target. **A statement of distance, never an instruction to trade** (D-055). *(PROPOSED 2026-07-14, page-policy §9-19 — ratify at the walk.)* **[Help]** |
| **Untargeted** | A bucket you **hold** but your policy does not mention. Shown honestly rather than hidden — an unmentioned holding is not a zero. *(PROPOSED 2026-07-14 — ratify at the walk.)* **[Help]** |
| **Coverage** | How much of a dimension your targets add up to. Under 100% is a legitimate policy, not an error — it means your policy deliberately does not speak for the rest. *(PROPOSED 2026-07-14 — ratify at the walk.)* **[Help]** |
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
| **Obligation** | A recurring or one-off future cash flow (expense / income); feeds runway + next-12-months total. `once` obligations are **excluded from recurring burn** (protected semantics, D-057). **Display grouping (§12cf1-2, PROPOSED 2026-07-15):** the records are SHOWN to the user as **"Income & expenses"** — calling an incoming salary an *obligation* is the model's word, not the user's. **The MODEL is unchanged** (one record type, `kind ∈ {expense, income}`); only the label is. |
| **Contribution** | A recorded plan (invest / withdraw / prepay); shown as monthly-equivalent; **does not reduce runway** (protected semantics, D-057). |
| **Net monthly burn** | Recurring expenses − recurring income, per month. **`once` obligations are excluded** — a one-off is lumpy, not a steady burn (protected semantics, D-057). Canonical on **Net worth** (it drives Cash runway). *(PROPOSED 2026-07-15, page-cash-flow §9-12 — ratify at the walk.)* **[Help]** |
| **Monthly equivalent** | A recurring amount expressed as a per-month rate (quarterly ÷ 3, annual ÷ 12). A **`once`** item has **no** monthly equivalent — it shows "—", never 0: excluded from the burn is not the same as free. *(PROPOSED 2026-07-15 — ratify at the walk.)* **[Help]** |
| **Next 12 months** | The total of your recorded **outflows** falling due in the next twelve months, including one-offs. Income is not netted off it. *(PROPOSED 2026-07-15 — ratify at the walk.)* **[Help]** |
| **Planned cash out** | Recurring expenses **plus** planned contributions, per month — a fuller picture of money leaving your accounts. It **does not change the Cash runway** (a contribution builds wealth; it isn't consumption — D-057). *(PROPOSED 2026-07-15 — ratify at the walk.)* **[Help]** |
| **Progress (goal)** | How far the goal's **basis** (net worth or liquid assets) has come against its target. A goal with **no basis** has **no progress** — it shows "—", never 0%. A fact against your target, **never a forecast** (Commitment 3). *(PROPOSED 2026-07-15 — ratify at the walk.)* **[Help]** |
| **Scenario** | A deterministic "what-if" shock on today's values — a **scenario, never a forecast** (protected copy, D-058). |
| **Shock** | A single hypothetical move applied to an exposure — e.g. *equities fall 20%*. Deterministic arithmetic on today's values, **never a forecast** (D-058). *(Ratified 2026-07-15, page-scenarios §9-6.)* **[Help]**
| **Exposure** | The base-currency amount a shock is applied to — your holdings grouped by what would move together (equities, crypto, property, foreign currencies). A share of **gross** assets; liabilities are not exposures. *(Ratified 2026-07-15, page-scenarios §9-6.)* **[Help]**
| **Cash flow** | The planning page holding Goals, Obligations, and Contributions (renamed from "Planning", D-056). It sits inside the **Planning** nav group. |

---

## Cost & organisation

| Term | Canonical definition |
|------|----------------------|
| **Recorded fees** | Actual commissions + taxes from the ledger for a year (a currency fact). |
| **Fee (recorded)** | A **standalone charge** transaction (`type = fee`) — custody / platform / advisory fees not tied to a specific trade. It flows to the **Recorded fees** block and **never enters cost basis** (no FIFO effect, D-048 never-blend). Trade commissions, by contrast, are recorded **on the trade** (the buy/sell `fees` field). Entered as a single **Amount** (no quantity/price). |
| **Ongoing cost (expense ratio)** | Forward estimate = expense ratio (`annual_cost_bps`) × current value. Kept **separate** from recorded fees, never blended. A card may be titled "Costs" (D-029). **[Help]** |
| **Report** | A composed, read-only view of your recorded data for organisation and review — the Reports page brings together **Statements**, the **Realised P/L report**, and **open tax lots**, with server-side exports whose disclaimers travel into the file. For your accountant — not tax or financial advice (D-060/D-077). *(RATIFIED 2026-07-17, owner walk, page-reports §14.)* **[Help]** |
| **Statements** | Income, fees, cash flow, realised-vs-unrealised from recorded transactions — for review / your accountant. |
| **Review** | The page/concept: a live "what needs a look" feed from existing signals; a recorded review snapshots state to `ReviewLog`. "what needs a look" may survive as body copy but not as a label (D-030). Canonical on the **Review** page. **[Help]** |
| **Mark reviewed** (RATIFIED 2026-07-13, page-review ND-11 / §12) | Record the current state (net worth, confidence, attention count) as a **dated review snapshot** with an optional **note** + **next-review date** (`ReviewLog`). The **only acknowledgement in v2** (per-signal acknowledge/dismiss is ROADMAP; implicit "seen" is R-29). **[Help]** |
| **Severity** (RATIFIED 2026-07-13, page-review ND-11 / §12) | How much attention a review item warrants — served, display-cased values **`Review`** (worth a look) and **`Info`** (a low-priority nudge, never a hard wall) (§12rv1-5). Rendered **verbatim** in a chip carrying a **semantic tone** (§12rv1-4, ND-4 reversal): `Review` → the ratified `--attention` colour, `Info` (and any unknown severity) → neutral. **[Help]** |
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

### Insurance policy terms (page-insurance §9-11)

The canonical term for the payout amount is **"Cover"** — LedgerFrame does **not** use "sum assured". All
**RATIFIED 2026-07-16 (owner walk, page-insurance §9-11).**

| Term | Canonical definition |
|------|----------------------|
| **Cover** | The amount an insurance policy would pay out on a claim (its **cover amount** / sum insured). The canonical term is **Cover**, never "sum assured". A protection figure — **never added to your Net worth**. *(RATIFIED 2026-07-16, owner walk, page-insurance §9-11.)* **[Help]** |
| **Cover amount** | The base-currency **Cover** a single policy provides — shown per policy and summed by type on Insurance. *(RATIFIED 2026-07-16, owner walk, page-insurance §9-11.)* |
| **Premium** | What you pay for a policy, at its **Premium frequency**. Insurance sums premiums to an annual-equivalent total (a single-pay policy contributes nothing recurring). *(RATIFIED 2026-07-16, owner walk, page-insurance §9-11.)* **[Help]** |
| **Premium frequency** | How often a premium is paid: monthly, quarterly, annual, or single (a paid-once policy). *(RATIFIED 2026-07-16, owner walk, page-insurance §9-11.)* **[Help]** |
| **Nominee** | The person you have named to receive a policy's benefit. A name you record, not a fixed list. *(RATIFIED 2026-07-16, owner walk, page-insurance §9-11.)* **[Help]** |
| **Insured person** | The person a policy covers. A name you record, not a fixed list. *(RATIFIED 2026-07-16, owner walk, page-insurance §9-11.)* **[Help]** |
| **Renewal** | The date a policy is next due to renew. Insurance flags renewals due soon (or overdue) as **neutral reminders — never advice**. *(RATIFIED 2026-07-16, owner walk, page-insurance §9-11.)* **[Help]** |

### Estate terms (page-estate §9-9)

The Estate page is a **readiness register, never legal or estate-planning advice**. Status
values ride their parent term's entry (no per-value rows). **RATIFIED 2026-07-16, owner walk
(page-estate §9-9 authored → §14 walk).** Parity suite green (`test_glossary_parity.py`).

| Term | Canonical definition |
|------|----------------------|
| **Will** | A document recording how you want your estate handled. LedgerFrame records **that one exists and where** — it never drafts a will and is not legal advice. **[Help]** |
| **Will status** | Where your will stands, as a plain state you record: **None** (not recorded), **Draft** (being prepared), **Executed** (signed and in force), or **Needs update** (recorded but marked for revision). A fact you record, never a prompt. **[Help]** |
| **Executor** | The person you name to carry out your will. A name you record, not a fixed list. **[Help]** |
| **Beneficiary** | A person you have named to receive part of your estate. A name you record, not a fixed list. **[Help]** |
| **Guardian** | A person you have named to care for a dependant. A name you record, not a fixed list. **[Help]** |
| **Emergency contact** | A person to reach in an emergency. A name you record, not a fixed list. **[Help]** |
| **Readiness** | A plain count of how much of your estate documentation is in order — documents **present** versus those needing attention. Each document has a status: **Present** (on file), **Missing** (not held), or **Outdated** (needs refreshing). A record and a reminder, never a score. **[Help]** |

---

## System

| Term | Canonical definition |
|------|----------------------|
| **No-egress toggle** | The privacy switch that makes the device make zero outbound network calls when enabled — feeds, version check, and banner included (Product Commitment 5). |
| **Privacy mode** | The device's egress posture, set by the **No-egress toggle**: when on, the app makes **zero outbound network calls** and prices/news go stale honestly rather than reaching out (Product Commitment 5). The Settings → Privacy state statement — *"This device makes no network calls."* — is **derived from this one state**, never a separate metric (P-1/D-031). **[Help]** *(page-settings §9-4, ruled 2026-07-18.)* |
| **API token** | A **scoped, read-only** token that lets a LAN widget (Home Assistant, a wall display) read your summary over your local network. Created with a name, the **raw value is shown once** and never retrievable after; **revocable** any time. Managing tokens needs your session ([S]-gated) — an API token can neither mint nor revoke tokens. **[Help]** *(page-settings §9-4, ruled 2026-07-18.)* |
| **Data provider** | The Settings label for the market-price **Provider** (the adapter/config that supplies quotes: `mock`/`csv`/`yahoo`/`alphavantage`/`eodhd`/`kite`). One concept with **Provider** (the D-028 split) — *Data provider* is the user-facing Settings wording. Its API key is **write-only** (set, never read back, D-003). **[Help]** *(page-settings §9-4, ruled 2026-07-18.)* |
| **Density** | A **per-device** display preference — **comfortable** (roomier) or **compact** (more rows per screen). Saved on this device only (localStorage, D-078); it describes the display, not your data. **[Help]** *(page-settings §9-4, ruled 2026-07-18.)* |
| **High contrast** | A **per-device** display axis — stronger borders and text contrast for legibility (WCAG). Saved on this device only (localStorage, D-078), not a server setting. **[Help]** *(page-settings §9-4, ruled 2026-07-18.)* |
| **Reduced motion** | A **per-device** display axis — stops animations and the ticker scroll. Saved on this device only (localStorage, D-078), not a server setting; also honours your operating system's reduce-motion preference. **[Help]** *(page-settings §9-4, ruled 2026-07-18.)* |
| **Demo mode** | `market_provider == "mock"` — deterministic DEMO data, entitlement delayed, seeded on empty DB. |
| **Reports Pack** | A print/export artifact composed from canonical readers with disclaimers preserved — the one sanctioned duplication, reachable from Reports only (D-038/D-061). Not a page in the IA sense. |
| **Consolidated** | The whole-household view — figures computed across every account and entity together, with no entity filter. In the Reports Pack the **Consolidated** section (net-worth trend, review, cash flow, scenarios) is rendered once, before the per-entity sections (reports-pack Pack-1/Pack-7). |
| **Per-entity** | Scoped to one ownership **Entity** — figures filtered to the accounts that entity owns. The Reports Pack renders a **Per-entity** section for each entity (net worth, drift, realised P/L, risk + attribution), composed server-side from the same canonical readers as the whole-household view (reports-pack Pack-2/Pack-7; §9-2 — the entity axis stays UI-dormant, no switcher). |
| **Home** | The summary dashboard (`/`). It **owns nothing** — every figure on it is a **linked summary** of the page that owns it, read from that page's canonical reader (P-1/D-038). Composition is **fixed** (D-046) and there is **ONE layout** — the ratified grid (D-046 AMENDMENT; page-home §12ho1-5/§12ho1-6). **[Help]** *(PROPOSED 2026-07-13, page-home §9-13 — ratify at the walk.)* |
| **Heatmap** | A treemap visualisation of your holdings — tile size is position value, colour is **Today's change**. It owns no figure; every number comes from the canonical readers. Priced holdings only; assets only (liabilities excluded), with an honest coverage note. **[Help]** *(RATIFIED 2026-07-13, page-heatmap ND-11.)* |
| **Long-term threshold** | The number of days a holding must be held before Realised P/L and the tax-lots report show it as **long-term**. **A neutral figure you set yourself** — it has **no jurisdiction presets**, and the product does not know or assume which country's rules apply to you (Commitment 4). It is an **organisation split, not tax advice**. The Settings → General control carries this exact label. *(Added 2026-07-20, page-legal §11-2 — the term entered served copy when §3's `long_term_days` was replaced by the human label; it had been user-visible in Settings since that control shipped, with no glossary row.)* |
| **Product Commitments** | The seven things LedgerFrame **will never do** — no trades · no advice · no fabrication · no jurisdiction tax logic · no egress when you switch it off · no stored AI conversations · a validation contract that never weakens. **Self-enforced behavioural commitments, each one tested** — deliberately **not** called *guarantees*, because the licence's warranty position is **no warranty** and the product will not borrow warranty vocabulary it cannot honour. **Defined once, in full, in the [Product Commitments](#product-commitments-verbatim-from-decisionsmd) block above** — this row is a pointer, never a second copy. Rendered verbatim on **Legal**. *(RENAMED 2026-07-20, page-legal §11-1 — ratify at the re-look.)* |
| **Legal** | The page (`/legal`) stating the terms you have LedgerFrame under: the product-level position (it reports, it does not advise or act), the seven **Product Commitments** rendered verbatim, the **licence**, and the no-jurisdiction-tax stance (D-077). It owns the **product-level position only** — the scoped caveat on each figure stays with the figure (D-106). **[Help]** *(PROPOSED 2026-07-19, page-legal §9-7 — ratify at the 0a.)* |
| **Disclaimer** | A stated limit on what a figure or the product means. **Two kinds, deliberately (D-106):** a **scoped caveat** is served by the reader that owns a figure, sits at the point of use, and is **part of the figure** (*"Open lots by FIFO. Organisation only — not tax advice."*); the **product-level position** is stated once, on **Legal**. Removing a scoped caveat is an **honesty regression**, never a de-duplication. *(PROPOSED 2026-07-19, page-legal §9-2/§9-7 — ratify at the 0a.)* |
| **Licence** | The terms LedgerFrame itself is released under — **AGPL-3.0-or-later**. **Spelling is deliberate and split (page-legal §9-7):** user-facing prose says British **"licence"**; **filenames and SPDX identifiers say "License"** (`LICENSE`, `AGPL-3.0-or-later`), because those are fixed by convention and not freely changeable. The full dependency and licence record is **generated** and **ships with the source** (`NOTICE`, `docs/audit/LICENSES.md`); no page reproduces it. *(PROPOSED 2026-07-19, page-legal §9-5/§9-7 — ratify at the 0a.)* |

### AI answers — the three kinds of intelligence (AI-surfaces §14-2, owner 2026-07-20)

**These three names are the whole user-facing vocabulary for how an answer was produced.** They
exist because the product asks the reader to trust an answer, and trust needs to know **who wrote
the sentence** — not only what it was built from. The distinction they draw is **where the
narration came from and whether anything left the device**; it is not a quality ranking, and none
of the three is presented as better than another.

| Term | Canonical definition |
|------|----------------------|
| **Built-in intelligence** | Deterministic answers assembled from **your own figures** by the app itself. **No model is involved** — nothing is generated, nothing is phrased by an LLM. It works in **every** posture, including **no-egress**, because it makes no call of any kind. This is what answers when no model is configured, when a model is unreachable, and when a model's answer fails the validation contract. |
| **On-device model** | An LLM running **on this device** (Ollama or a compatible endpoint). Your questions and your figures **never leave the device**, but the narration **is model-generated** — the sentences are written by a model, the figures underneath them are not. Served label: **On-device model (Ollama-compatible)**. |
| **External model** | A **cloud API**. **Data leaves this device** — the question and the portfolio facts it is grounded in are sent to the configured provider. The copy says so plainly, wherever this is the active kind. |

**Whatever the kind, the figures are the same figures.** A model never supplies a number: it
narrates facts the engine served (D-068, *"model may add no numbers"*; validation contract clause
7). So the three kinds differ in **who phrased the answer** and **where the data went** — never in
where the numbers came from.

**On naming the STANDARD, not the vendor.** The served label says *Ollama-compatible* rather than
naming one product, because the endpoint is OpenAI-compatible and works with Ollama **and its
lookalikes**. A label that names a single implementation becomes false the moment a second one is
what is actually running — which is the same defect as a Settings tab naming a provider that is not
the one answering (AI-surfaces §14-3). *Retired:* **hailo** as a user-facing word — see
[Deprecated terms](#deprecated-terms). *(**RATIFIED 2026-07-20** — owner, by looking, at the
AI-surfaces 3b walk; AI-surfaces §14-2 / §17. The vocabulary was ratified with the three provenance
legends and the four AI-tab sentences that spend it, which is the right order: a vocabulary is
ratified by reading the sentences it produces, not the definitions in isolation.)*

---

## Deprecated terms

Term (retired) → replacement, with the deciding ID. These must not appear in UI
copy.

| Retired term | Use instead | Decision |
|--------------|-------------|----------|
| **Product Guarantees** / **Guarantee *n*** | **Product Commitments** / **Commitment *n*** — *"guarantee" is warranty-family vocabulary and the licence's position is **NO WARRANTY** (AGPL section 15); these seven are self-enforced behavioural commitments, tested.* **Claims unchanged — a rename, not a weakening.** ⚠ **The ordinary English word is NOT retired:** *"indicative, not a guarantee of sale price or timing"* (Liquidity) is a plain-English caveat, not this term, and must not be swept | owner 2026-07-20, page-legal §11-1 |
| **hailo** (as a user-facing word) | **On-device model (Ollama-compatible)** — *name the standard, not the vendor: the endpoint is OpenAI-compatible and works with Ollama and its lookalikes, so a label naming one implementation is false as soon as a second one is running.* ⚠ **Only the USER-FACING word is retired.** The internal module, the provider id and the `LEDGERFRAME_HAILO_*` env keys are **unchanged and still accepted** — the owner's live `.env` must keep working across this rename | owner 2026-07-20, AI-surfaces §14-2 |
| Detail level: Simple/**Expert** | *(nothing — the control it named is gone)* Retired first in favour of "Home layout: Simple / Full" (page-home §9-1), which is **itself now retired** — see the row below | D-030 / D-040 / page-home §9-1 → §12ho1-6 |
| Home layout: Simple / **Full** | *(nothing — Home has ONE layout)* The **Simple** layout was REMOVED (owner, 2026-07-13): Home ships a single composition, the ratified grid. There is no layout control, no `home_layout` setting, and no user-facing choice to label | D-046 AMENDMENT / page-home §12ho1-6 |
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
D-062, D-073, D-074, D-076, D-077 (Product Commitments block verbatim), plus
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

// A small slice of GLOSSARY.md keyed by term id, for the GlossaryTerm popover.
// Definitions are trimmed from GLOSSARY.md — the spelling of every term matches
// the glossary exactly (CLAUDE.md hard rule).

export interface GlossaryEntry {
  term: string;
  definition: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  // Intraday price series (R-42 §9-T). Added to docs/specs/GLOSSARY.md FIRST, then here —
  // the two-store rule; tests/unit/test_glossary_parity.py polices the identical spelling
  // ("Intraday", "Interval"). The `interval` literal (1min/5min) never appears in copy.
  "term-intraday": {
    term: "Intraday",
    definition:
      "Sub-daily price bars for a single trading day (e.g. 1-minute bars for the 1D range). Shown only where a source actually served them — never fabricated; a range with no intraday data stays honestly disabled with a served reason.",
  },
  "term-interval": {
    term: "Interval",
    definition:
      "The bar granularity of a price series (1min, 5min, 1d). The range you pick (1D / 5D / 1M …) maps to an interval on the server; the interval literal is internal and is never shown in copy.",
  },
  // Historical valuation backfill (R-43 §9-T). Added to docs/specs/GLOSSARY.md FIRST, then here —
  // the two-store rule; tests/unit/test_glossary_parity.py polices the spelling ("Snapshot",
  // "Backfill"). Internal enums (source=backfilled/live/manual) never appear in copy.
  "term-snapshot": {
    term: "Snapshot",
    definition:
      "A dated record of the portfolio's valuation — assets, liabilities and net worth — at a point in time. The Net worth trend is a series of these; they are written forward as the appliance runs, added on demand, or reconstructed by a Backfill.",
  },
  "term-backfill": {
    term: "Backfill",
    definition:
      "Reconstructing past snapshots from price history + transactions + per-date FX, and persisting them as dated records, so the Net worth trend shows real history. A backfilled figure is marked as such and rests only on honestly-available inputs — a date with no price or exchange rate is a flagged, carried-forward gap, never fabricated.",
  },
  // Reports (page-reports §9-9). Added to docs/specs/GLOSSARY.md FIRST, then here — the two-store
  // rule; tests/unit/test_glossary_parity.py polices the spellings. "Statements" (plural) is the
  // confirmed label; copy uses "Realised P/L report", never the deprecated "Realised gains" (D-026).
  "term-report": {
    term: "Report",
    definition:
      "A composed, read-only view of your recorded data for organisation and review — the Reports page brings together Statements, the Realised P/L report, and open tax lots, with server-side exports whose disclaimers travel into the file. For your accountant — not tax or financial advice.",
  },
  // page-reports §9-9 / §13 (Phase 1). These three spellings exist in docs/specs/GLOSSARY.md
  // (the [Help]-marked rows: **Statements**, **Realised P/L**, **Tax lot / Open lot**); the parity
  // guard (tests/unit/test_glossary_parity.py) enforces the identical spelling. NEVER "Realised gains"
  // (deprecated, D-026) — the report heading is "Realised P/L report".
  "term-statements": {
    term: "Statements",
    definition:
      "Income, fees, cash flow and realised-vs-unrealised, drawn from your recorded transactions — for review / your accountant. The table is all-years; the Year control scopes the Realised figure and the export.",
  },
  "term-realised-pl": {
    term: "Realised P/L",
    definition:
      "Sale proceeds minus the FIFO-matched cost of the parcels sold. Exact in each instrument's native currency; the base total is shown at today's FX (indicative) AND at trade-date FX with an excluded-events count. Not tax advice.",
  },
  "term-tax-lot": {
    term: "Tax lot / Open lot",
    definition:
      "An unsold parcel with its acquisition date, quantity, cost and holding period. Open lots are matched by FIFO. Organisation only — not tax advice.",
  },
  // §14dr-20: added to docs/specs/GLOSSARY.md FIRST, then here (two-store rule; the parity
  // guard tests/unit/test_glossary_parity.py polices the spelling "Purge").
  "term-purge": {
    term: "Purge",
    definition:
      "Permanently deleting the soft-deleted (“trashed”) holdings and transactions — emptying the trash. Irreversible: the rows are gone for good and cannot be restored. A D-103 action — it always demands a freshly-entered PIN, never the unlocked session.",
  },
  // Accounts (page-accounts §9-13). Added to docs/specs/GLOSSARY.md FIRST, then here — the
  // two-store rule; tests/unit/test_glossary_parity.py polices the spellings.
  "term-account-kind": {
    term: "Account kind",
    definition:
      "The category of an account: brokerage, bank, retirement, wallet, property, manual, or other. Distinct from the account's currency and entity.",
  },
  "term-cost-basis-method": {
    term: "Cost-basis method",
    definition:
      "The per-account method for realised gains: FIFO (oldest lots sold first) or average (open lots pooled to one average cost). Changing it on an account with history restates your realised and unrealised figures.",
  },
  "term-rollup": {
    term: "Rollup",
    definition:
      "A per-account summary of the holdings reader — value, holdings count, asset classes, currencies, and stale / low-confidence counts. A linked summary of the canonical figure, never a recompute.",
  },
  "term-merge": {
    term: "Merge",
    definition:
      "Folding one institution (the duplicate) into another (the survivor): every account and policy that referenced the duplicate is re-pointed to the survivor, then the duplicate is deleted. You name both — there is no fuzzy auto-detection.",
  },
  // Scenarios (page-scenarios §9-6). Added to docs/specs/GLOSSARY.md FIRST, then here — the
  // two-store rule; tests/unit/test_glossary_parity.py polices the spellings.
  "term-shock": {
    term: "Shock",
    definition:
      "A single hypothetical move applied to an exposure — e.g. equities fall 20%. Deterministic arithmetic on today's values, never a forecast.",
  },
  "term-exposure": {
    term: "Exposure",
    definition:
      "The base-currency amount a shock is applied to — your holdings grouped by what would move together (equities, crypto, property, foreign currencies). A share of gross assets; liabilities are not exposures.",
  },
  // Cash flow (page-cash-flow §9-12). Added to docs/specs/GLOSSARY.md FIRST, then here — the
  // two-store rule; tests/unit/test_glossary_parity.py polices the spellings.
  "term-net-monthly-burn": {
    term: "Net monthly burn",
    definition:
      "Recurring expenses minus recurring income, per month. One-off obligations are excluded — a one-off is lumpy, not a steady burn.",
  },
  "term-monthly-equivalent": {
    term: "Monthly equivalent",
    definition:
      "A recurring amount expressed as a per-month rate (quarterly ÷ 3, annual ÷ 12). A one-off has no monthly equivalent — it shows an em dash, never 0.",
  },
  "term-next-12-months": {
    term: "Next 12 months",
    definition:
      "The total of your recorded outflows falling due in the next twelve months, including one-offs. Income is not netted off it.",
  },
  "term-planned-cash-out": {
    term: "Planned cash out",
    definition:
      "Recurring expenses plus planned contributions, per month. It does not change the Cash runway — a contribution builds wealth, it isn't consumption.",
  },
  "term-goal-progress": {
    term: "Progress (goal)",
    definition:
      "How far the goal's basis (net worth or liquid assets) has come against its target. A goal with no basis has no progress — it shows an em dash, never 0%. A fact against your target, never a forecast.",
  },
  // Policy (page-policy §9-14). Added to docs/specs/GLOSSARY.md FIRST, then here — the two-store
  // rule (page-heatmap §13-1); tests/unit/test_glossary_parity.py polices the spellings.
  "term-concentration": {
    term: "Concentration",
    definition:
      "Share of gross assets in the biggest positions. Kept distinct from allocation weight — never interchanged.",
  },
  "term-policy-investment": {
    term: "Policy (investment)",
    definition:
      "Your own target allocation, bands and optional concentration limit. Distinct from an insurance policy — the nav label \"Policy\" always means this one.",
  },
  "term-target": {
    term: "Target",
    definition:
      "The share of gross assets you intend to hold in a bucket. Your own number — the platform never sets, suggests or judges it.",
  },
  "term-band": {
    term: "Band",
    definition:
      "The tolerance either side of a target, within which a bucket counts as In band. Set per target, or inherited from the policy's default band.",
  },
  "term-out-of-band": {
    term: "Out of band",
    definition:
      "The actual share sits outside the target's band — over or under. It reports a distance, and never a trade instruction. Over and under are flagged the same way: both simply need a look.",
  },
  "term-gap-to-target": {
    term: "Gap to target",
    definition:
      "The distance from a target, in base currency: actual value minus target value. Positive means above target. A statement of distance, never an instruction to trade.",
  },
  "term-untargeted": {
    term: "Untargeted",
    definition:
      "A bucket you hold but your policy does not mention. Shown honestly rather than hidden — an unmentioned holding is not a zero.",
  },
  "term-coverage": {
    term: "Coverage",
    definition:
      "How much of a dimension your targets add up to. Under 100% is a legitimate policy, not an error — it means your policy deliberately does not speak for the rest.",
  },
  "term-net-worth": {
    term: "Net worth",
    definition:
      "Gross assets − Liabilities, in base currency. The only headline total.",
  },
  "term-gross-assets": {
    term: "Gross assets",
    definition:
      "Sum of positive holdings' current market value in base currency at today's FX. A labelled component, never a standalone headline.",
  },
  "term-cost-basis": {
    term: "Cost basis",
    definition: "Quantity × FIFO average cost (native ccy → base). Canonical on Portfolio.",
  },
  "term-unrealised-pl": {
    term: "Unrealised P/L",
    definition: "Current market value − cost basis on holdings still held.",
  },
  "term-todays-change": {
    term: "Today's change",
    definition: "The day's change in value. The only term for this concept.",
  },
  "term-data-confidence": {
    term: "Data confidence",
    definition:
      "0–100 score of how well-sourced a value is: base-by-valuation-method minus itemised penalties. Value-weighted at portfolio level.",
  },
  "term-cash-runway": {
    term: "Cash runway",
    definition:
      "Liquid assets ÷ recurring net burn (expenses − income), at today's FX.",
  },
  // Trimmed from GLOSSARY.md (Movers — two pairs, D-024). Markets shows Gainers / Losers; the
  // contribution-weighted pair (Contributors / Detractors) is Portfolio's — never interchanged.
  "term-gainers-losers": {
    term: "Gainers / Losers",
    definition:
      "Price-move lists ranked by price change — Markets' pair. NOT Contributors / Detractors (the contribution-weighted pair, canonical on Portfolio). The two are never interchanged (D-024).",
  },
  // News terms (page-news ND-9). Trimmed from GLOSSARY.md (News — briefing & headlines).
  "term-briefing": {
    term: "Briefing",
    definition:
      "A short, factual daily summary built deterministically from your own served figures — never a fabricated number. Information only, not advice.",
  },
  "term-headlines": {
    term: "Headlines",
    definition:
      "Grouped news headlines retrieved from your configured sources, deduplicated and grouped by area. Retrieved, never invented; under no-egress none are fetched (honest empty).",
  },
  // Review terms (page-review ND-11). "Review" trimmed from GLOSSARY.md; Mark reviewed + Severity PROPOSED.
  "term-review": {
    term: "Review",
    definition:
      "A live 'what needs a look' list derived from existing signals — reporting only, never advice or a required action. 'Mark reviewed' snapshots the state to a recorded review.",
  },
  "term-mark-reviewed": {
    term: "Mark reviewed",
    definition:
      "Record the current state (net worth, confidence, attention count) as a dated review snapshot, with an optional note and next-review date. The only acknowledgement in v2.",
  },
  "term-severity": {
    term: "Severity",
    definition:
      "How much attention an item warrants: 'review' (worth a look) or 'info' (a low-priority nudge — never a hard wall). Reporting only.",
  },
  // Heatmap term (page-heatmap ND-11, PROPOSED — ratify at the walk).
  "term-heatmap": {
    term: "Heatmap",
    definition:
      "A treemap visualisation of your holdings — tile size is position value, colour is Today's change. It owns no figure; every number comes from the canonical readers.",
  },
  // Home term (page-home ND/§9-13, PROPOSED — ratify at the walk).
  "term-home": {
    term: "Home",
    definition:
      "The summary dashboard. It owns nothing — every figure on it is a linked summary of the page that owns it (P-1/D-038).",
  },
  // Insurance terms (page-insurance §9-11, PROPOSED — ratify at the walk). Added to
  // docs/specs/GLOSSARY.md FIRST, then here — the two-store rule; test_glossary_parity.py
  // polices the spellings. Canonical term is "Cover" (never "sum assured").
  "term-cover": {
    term: "Cover",
    definition:
      "The amount an insurance policy would pay out on a claim (its cover amount / sum insured). A protection figure — never added to your Net worth.",
  },
  "term-premium": {
    term: "Premium",
    definition:
      "What you pay for a policy, at its premium frequency. Insurance sums premiums to an annual-equivalent total (a single-pay policy contributes nothing recurring).",
  },
  "term-premium-frequency": {
    term: "Premium frequency",
    definition:
      "How often a premium is paid: monthly, quarterly, annual, or single (a paid-once policy).",
  },
  "term-nominee": {
    term: "Nominee",
    definition: "The person you have named to receive a policy's benefit. A name you record, not a fixed list.",
  },
  "term-insured-person": {
    term: "Insured person",
    definition: "The person a policy covers. A name you record, not a fixed list.",
  },
  "term-renewal": {
    term: "Renewal",
    definition:
      "The date a policy is next due to renew. Insurance flags renewals due soon (or overdue) as neutral reminders — never advice.",
  },
  // Estate terms (page-estate §9-9, PROPOSED — ratify at the walk). Added to
  // docs/specs/GLOSSARY.md FIRST, then here — the two-store rule; test_glossary_parity.py
  // polices the spellings. Status values ride their parent term (no per-value entries).
  "term-will": {
    term: "Will",
    definition:
      "A document recording how you want your estate handled. LedgerFrame records that one exists and where — it never drafts a will and is not legal advice.",
  },
  "term-will-status": {
    term: "Will status",
    definition:
      "Where your will stands, as a plain state you record: None (not recorded), Draft (being prepared), Executed (signed and in force), or Needs update (recorded but marked for revision). A fact you record, never a prompt.",
  },
  "term-executor": {
    term: "Executor",
    definition: "The person you name to carry out your will. A name you record, not a fixed list.",
  },
  "term-beneficiary": {
    term: "Beneficiary",
    definition: "A person you have named to receive part of your estate. A name you record, not a fixed list.",
  },
  "term-guardian": {
    term: "Guardian",
    definition: "A person you have named to care for a dependant. A name you record, not a fixed list.",
  },
  "term-emergency-contact": {
    term: "Emergency contact",
    definition: "A person to reach in an emergency. A name you record, not a fixed list.",
  },
  "term-readiness": {
    term: "Readiness",
    definition:
      "A plain count of how much of your estate documentation is in order — documents present versus those needing attention. Each document has a status: Present (on file), Missing (not held), or Outdated (needs refreshing). A record and a reminder, never a score.",
  },
  // Settings terms (page-settings §9-4, ruled 2026-07-18). Added to docs/specs/GLOSSARY.md FIRST,
  // then here — the two-store rule; test_glossary_parity.py polices the spellings.
  "term-privacy-mode": {
    term: "Privacy mode",
    definition:
      "The device's egress posture, set by the No-egress toggle: when on, the app makes zero outbound network calls and prices/news go stale honestly rather than reaching out. The Privacy state statement is derived from this one state, never a separate metric.",
  },
  "term-api-token": {
    term: "API token",
    definition:
      "A scoped, read-only token that lets a LAN widget (Home Assistant, a wall display) read your summary over your local network. The raw value is shown once and never retrievable after; revocable any time. Managing tokens needs your session — an API token can neither mint nor revoke tokens.",
  },
  "term-data-provider": {
    term: "Data provider",
    definition:
      "The Settings label for the market-price Provider — the adapter that supplies quotes (mock/csv/yahoo/alphavantage/eodhd/kite). Its API key is write-only: set, never read back.",
  },
  "term-density": {
    term: "Density",
    definition:
      "A per-device display preference — comfortable (roomier) or compact (more rows per screen). Saved on this device only; it describes the display, not your data.",
  },
  "term-high-contrast": {
    term: "High contrast",
    definition:
      "A per-device display axis — stronger borders and text contrast for legibility. Saved on this device only, not a server setting.",
  },
  "term-reduced-motion": {
    term: "Reduced motion",
    definition:
      "A per-device display axis — stops animations and the ticker scroll. Saved on this device only, not a server setting; also honours your operating system's reduce-motion preference.",
  },
  // data-feed-routing §9-T (ruled 2026-07-18). Authored in docs/specs/GLOSSARY.md FIRST
  // (the two-store rule), then here — the parity guard (tests/unit/test_glossary_parity.py)
  // enforces the identical spelling "Routing matrix".
  "term-routing-matrix": {
    term: "Routing matrix",
    definition:
      "Your table of which provider prices each kind of instrument in each market — one choice per asset-class and listing-country, edited in Settings → Data feeds. It is a preference layer, not a price: a cell only takes effect when the provider you named can actually price that instrument, and it can never fabricate, replace, or worsen a value — if the named provider can't price a holding, LedgerFrame falls back to its normal source exactly as before. Pricing Health shows the outcome read-only.",
  },
};

export function lookupTerm(id: string): GlossaryEntry | undefined {
  return GLOSSARY[id];
}

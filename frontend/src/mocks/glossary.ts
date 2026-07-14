// A small slice of GLOSSARY.md keyed by term id, for the GlossaryTerm popover.
// Definitions are trimmed from GLOSSARY.md — the spelling of every term matches
// the glossary exactly (CLAUDE.md hard rule).

export interface GlossaryEntry {
  term: string;
  definition: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
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
};

export function lookupTerm(id: string): GlossaryEntry | undefined {
  return GLOSSARY[id];
}

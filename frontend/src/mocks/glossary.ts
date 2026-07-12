// A small slice of GLOSSARY.md keyed by term id, for the GlossaryTerm popover.
// Definitions are trimmed from GLOSSARY.md — the spelling of every term matches
// the glossary exactly (CLAUDE.md hard rule).

export interface GlossaryEntry {
  term: string;
  definition: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
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
};

export function lookupTerm(id: string): GlossaryEntry | undefined {
  return GLOSSARY[id];
}

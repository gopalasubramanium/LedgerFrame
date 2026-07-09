// Mock of the single /refdata endpoint (D-005) plus the user-extensible masters.
// Seed values are verbatim from MASTER-DATA.md — the frontend carries no
// vocabulary of its own; MasterSelect resolves options through here so no
// component ever inlines an option list (CLAUDE.md hard rule / §6).

export interface RefOption {
  value: string;
  label: string;
}

export interface Master {
  id: string;
  /** Human label for the field/master. */
  label: string;
  /** User-extensible masters allow "create new" (institution, sector, tag). */
  extensible: boolean;
  options: RefOption[];
}

// snake_case / kebab value → Title Case label for display.
function humanize(value: string): string {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function fixed(values: string[]): RefOption[] {
  return values.map((v) => ({ value: v, label: humanize(v) }));
}

// --- Fixed vocabularies (served via /refdata; MASTER-DATA §2) ------------------
const FIXED: Record<string, string[]> = {
  txn_type: [
    "buy", "sell", "dividend", "interest", "deposit", "withdrawal", "fee",
    "split", "bonus", "merger", "transfer",
  ],
  asset_class: [
    "equity", "etf", "mutual_fund", "bond", "cash", "fixed_deposit",
    "commodity", "crypto", "property", "private", "retirement", "liability",
    "other",
  ],
  asset_subclass: ["crypto", "derivative", "equity", "etf", "mutual_fund", "reit"],
  liquidity_profile: ["listed", "redeemable", "locked", "illiquid", "manual"],
  entity_kind: ["self", "spouse", "trust", "company", "other"],
  goal_basis: ["net_worth", "liquid", "none"],
  obligation_recurrence: ["once", "monthly", "quarterly", "annual"],
  obligation_kind: ["expense", "income"],
  contribution_frequency: ["monthly", "quarterly", "annual", "once"],
  contribution_kind: ["invest", "withdraw", "prepay"],
  will_status: ["none", "draft", "executed", "needs_update"],
  estate_doc_status: ["present", "missing", "outdated"],
  valuation_method: [
    "market_quote", "official_nav", "broker_quote", "manual_valuation",
    "statement_import", "calculated_accrual", "estimated_value", "fx_reference",
    "unavailable",
  ],
  entitlement: ["real-time", "delayed", "end-of-day", "cached", "unavailable"],
  policy_dimension: ["asset_class", "currency", "region"],
  cost_basis_method: ["fifo", "average"],
  account_kind: [
    "brokerage", "bank", "retirement", "wallet", "property", "manual", "other",
  ],
  policy_type: [
    "term_life", "whole_life", "health", "critical_illness", "disability",
    "personal_accident", "property", "motor", "travel", "other",
  ],
  premium_frequency: ["monthly", "quarterly", "annual", "single"],
  estate_doc_category: [
    "will", "insurance", "property", "loan", "identity", "bank", "tax",
    "medical", "other",
  ],
  contact_role: ["nominee", "beneficiary", "executor", "emergency", "guardian"],
};

const FIXED_LABELS: Record<string, string> = {
  txn_type: "Transaction type",
  asset_class: "Asset class",
  asset_subclass: "Asset subclass",
  liquidity_profile: "Liquidity profile",
  entity_kind: "Entity kind",
  goal_basis: "Goal basis",
  obligation_recurrence: "Recurrence",
  obligation_kind: "Obligation kind",
  contribution_frequency: "Contribution frequency",
  contribution_kind: "Contribution kind",
  will_status: "Will status",
  estate_doc_status: "Document status",
  valuation_method: "Valuation method",
  entitlement: "Entitlement",
  policy_dimension: "Policy dimension",
  cost_basis_method: "Cost-basis method",
  account_kind: "Account kind",
  policy_type: "Policy type",
  premium_frequency: "Premium frequency",
  estate_doc_category: "Document category",
  contact_role: "Contact role",
};

// --- Currency master (D-006; 22 codes, 9 base-eligible; MASTER-DATA §3) --------
const BASE_ELIGIBLE = ["SGD", "USD", "INR", "EUR", "GBP", "JPY", "AUD", "CNY", "HKD"];
const WIDER = [
  "CAD", "CHF", "AED", "MYR", "THB", "KRW", "TWD", "SEK", "NOK", "DKK", "ZAR",
  "BRL", "NZD",
];
export const CURRENCIES: RefOption[] = [...BASE_ELIGIBLE, ...WIDER].map((c) => ({
  value: c,
  label: c,
}));
export const BASE_CURRENCIES: RefOption[] = BASE_ELIGIBLE.map((c) => ({
  value: c,
  label: c,
}));

// --- Region (derived; six buckets, D-083; MASTER-DATA §4) ----------------------
const REGIONS = ["India", "Singapore", "US", "Europe", "APAC", "Other"];

// --- Extensible masters (MASTER-DATA §6) ---------------------------------------
// Sector: 11 GICS sectors (authored, PROPOSED, D-009/DEF-6). Institution/Tag
// start empty in real data; seeded here so the picker has something to show.
const SECTORS = [
  "Energy", "Materials", "Industrials", "Consumer Discretionary",
  "Consumer Staples", "Health Care", "Financials", "Information Technology",
  "Communication Services", "Utilities", "Real Estate",
];
const INSTITUTIONS = [
  "DBS Bank", "OCBC", "Interactive Brokers", "Zerodha", "Vanguard",
  "Standard Chartered",
];

export const MASTERS: Record<string, Master> = {
  ...Object.fromEntries(
    Object.entries(FIXED).map(([id, values]) => [
      id,
      { id, label: FIXED_LABELS[id] ?? humanize(id), extensible: false, options: fixed(values) },
    ]),
  ),
  currency: { id: "currency", label: "Currency", extensible: false, options: CURRENCIES },
  base_currency: { id: "base_currency", label: "Base currency", extensible: false, options: BASE_CURRENCIES },
  region: { id: "region", label: "Region", extensible: false, options: REGIONS.map((r) => ({ value: r, label: r })) },
  sector: { id: "sector", label: "Sector", extensible: true, options: SECTORS.map((s) => ({ value: s, label: s })) },
  institution: { id: "institution", label: "Institution", extensible: true, options: INSTITUTIONS.map((i) => ({ value: i, label: i })) },
};

export function getMaster(id: string): Master {
  const m = MASTERS[id];
  if (!m) throw new Error(`Unknown master: ${id}`);
  return m;
}

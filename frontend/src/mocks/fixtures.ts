// Realistic finance fixtures for the component library: plausible numbers, long
// names, negative values, multiple currencies, and stale / low-confidence /
// unavailable provenance — so every honesty state is exercisable in the kitchen
// sink. Terminology follows GLOSSARY; vocab values follow MASTER-DATA.

import type {
  Holding,
  Instrument,
  PricePoint,
  Provenance,
  Quote,
  Segment,
  TreemapNode,
} from "./types";

// --- Provenance presets --------------------------------------------------------
export const PROV_FRESH: Provenance = {
  source: "Kite",
  entitlement: "delayed",
  valuationMethod: "market_quote",
  confidence: { score: 92, band: "high" },
  status: "Fresh",
  asOf: "2026-07-09T09:14:00Z",
  isStale: false,
  staleAfterSeconds: 900,
};

export const PROV_EOD: Provenance = {
  source: "AMFI",
  entitlement: "end-of-day",
  valuationMethod: "official_nav",
  confidence: { score: 78, band: "high" },
  status: "End-of-day",
  asOf: "2026-07-08T12:30:00Z",
  isStale: false,
  staleAfterSeconds: 108000,
};

export const PROV_STALE: Provenance = {
  source: "Yahoo",
  entitlement: "delayed",
  valuationMethod: "market_quote",
  confidence: { score: 54, band: "medium" },
  status: "Cached",
  asOf: "2026-07-07T16:00:00Z",
  isStale: true,
  staleAfterSeconds: 900,
};

export const PROV_MANUAL: Provenance = {
  source: "Manual",
  entitlement: "unavailable",
  valuationMethod: "manual_valuation",
  confidence: { score: 40, band: "low" },
  status: "Manual",
  asOf: "2026-06-30T00:00:00Z",
  isStale: false,
};

export const PROV_UNAVAILABLE: Provenance = {
  source: "—",
  entitlement: "unavailable",
  valuationMethod: "unavailable",
  confidence: { score: 12, band: "low" },
  status: "Unavailable",
  asOf: "2026-07-01T00:00:00Z",
  isStale: true,
  staleAfterSeconds: 900,
};

// --- Instruments ---------------------------------------------------------------
export const INSTRUMENTS: Instrument[] = [
  {
    id: "ins-1",
    symbol: "VWRA",
    name: "Vanguard FTSE All-World UCITS ETF (USD Accumulating)",
    assetClass: "etf",
    assetSubclass: "etf",
    listingCountry: "IE",
    sector: null,
    currency: "USD",
  },
  {
    id: "ins-2",
    symbol: "D05",
    name: "DBS Group Holdings Ltd",
    assetClass: "equity",
    assetSubclass: "equity",
    listingCountry: "SG",
    sector: "Financials",
    currency: "SGD",
  },
  {
    id: "ins-3",
    symbol: "INFY",
    name: "Infosys Limited",
    assetClass: "equity",
    assetSubclass: "equity",
    listingCountry: "IN",
    sector: "Information Technology",
    currency: "INR",
  },
  {
    id: "ins-4",
    symbol: "BTC",
    name: "Bitcoin",
    assetClass: "crypto",
    assetSubclass: "crypto",
    listingCountry: "US",
    sector: null,
    currency: "USD",
  },
  {
    id: "ins-5",
    symbol: "CLR",
    name: "CapitaLand Ascendas REIT",
    assetClass: "property",
    assetSubclass: "reit",
    listingCountry: "SG",
    sector: "Real Estate",
    currency: "SGD",
  },
];

// --- Holdings (incl. negatives, long names, low-confidence, stale) -------------
export const HOLDINGS: Holding[] = [
  {
    id: "h-1",
    instrument: INSTRUMENTS[0],
    account: "IBKR Taxable",
    quantity: "1240.0000",
    price: "128.4500",
    value: "159278.00",
    costBasis: "121440.00",
    unrealisedPl: "37838.00",
    todaysChange: "612.40",
    provenance: PROV_FRESH,
  },
  {
    id: "h-2",
    instrument: INSTRUMENTS[1],
    account: "DBS Vickers",
    quantity: "3000.0000",
    price: "38.1200",
    value: "114360.00",
    costBasis: "99000.00",
    unrealisedPl: "15360.00",
    todaysChange: "-1830.00",
    provenance: PROV_STALE,
  },
  {
    id: "h-3",
    instrument: INSTRUMENTS[2],
    account: "Zerodha",
    quantity: "500.0000",
    price: "1560.7500",
    value: "9420.13",
    costBasis: "11200.00",
    unrealisedPl: "-1779.87",
    todaysChange: "-88.20",
    provenance: PROV_EOD,
  },
  {
    id: "h-4",
    instrument: INSTRUMENTS[3],
    account: "Cold Wallet",
    quantity: "0.75000000",
    price: "94120.00",
    value: "70590.00",
    costBasis: "48000.00",
    unrealisedPl: "22590.00",
    todaysChange: "2140.55",
    provenance: PROV_STALE,
  },
  {
    id: "h-5",
    instrument: INSTRUMENTS[4],
    account: "DBS Vickers",
    quantity: "9000.0000",
    price: "2.7100",
    value: "24390.00",
    costBasis: "27000.00",
    unrealisedPl: "-2610.00",
    todaysChange: "0.00",
    provenance: PROV_MANUAL,
  },
];

// --- Allocation segments (Portfolio, D-033) ------------------------------------
export const ALLOCATION_BY_CLASS: Segment[] = [
  { label: "Equity", value: "159278.00" },
  { label: "ETF", value: "159278.00" },
  { label: "Crypto", value: "70590.00" },
  { label: "Property", value: "24390.00" },
  { label: "Cash", value: "31500.00" },
];

// Sector view carries the explicit non-equity bucket (D-082).
export const ALLOCATION_BY_SECTOR: Segment[] = [
  { label: "Financials", value: "114360.00" },
  { label: "Information Technology", value: "9420.13" },
  { label: "Real Estate", value: "24390.00" },
  { label: "Unclassified sector", value: "229868.00" },
];

// --- Quotes (Markets / Home quote-card row) ------------------------------------
export const QUOTES: Quote[] = [
  { symbol: "^STI", name: "Straits Times Index", price: "3712.44", changePct: "0.42", currency: "SGD", provenance: PROV_FRESH },
  { symbol: "^NSEI", name: "NIFTY 50", price: "24810.15", changePct: "-0.88", currency: "INR", provenance: PROV_EOD },
  { symbol: "^GSPC", name: "S&P 500", price: "6284.30", changePct: "1.12", currency: "USD", provenance: PROV_STALE },
  { symbol: "BTC", name: "Bitcoin", price: "94120.00", changePct: "2.34", currency: "USD", provenance: PROV_STALE },
  { symbol: "USDSGD", name: "US Dollar / Singapore Dollar", price: "1.2842", changePct: "-0.05", currency: "SGD", provenance: PROV_FRESH },
];

// --- Treemap nodes (Heatmap; squarified — tone + day-move magnitude) -----------
// magnitudePct drives fill intensity: soft tints for small moves, full at >=5%.
export const TREEMAP_NODES: TreemapNode[] = [
  { label: "VWRA", value: 159278, tone: "gain", magnitudePct: 0.4 },
  { label: "DBS", value: 114360, tone: "loss", magnitudePct: 1.6 },
  { label: "BTC", value: 70590, tone: "gain", magnitudePct: 2.3 },
  { label: "CLR REIT", value: 24390, tone: "flat", magnitudePct: 0 },
  { label: "INFY", value: 9420, tone: "loss", magnitudePct: 0.9 },
  { label: "Cash", value: 31500, tone: "flat", magnitudePct: 0 },
  { label: "Gold", value: 18200, tone: "gain", magnitudePct: 5.2 },
];

// Sample tiles demonstrating the magnitude scale at 0.5% / 2% / 5%+ (both signs).
export const TREEMAP_SCALE_SAMPLES: TreemapNode[] = [
  { label: "+0.5%", value: 1, tone: "gain", magnitudePct: 0.5 },
  { label: "+2%", value: 1, tone: "gain", magnitudePct: 2 },
  { label: "+5%", value: 1, tone: "gain", magnitudePct: 5 },
  { label: "−0.5%", value: 1, tone: "loss", magnitudePct: 0.5 },
  { label: "−2%", value: 1, tone: "loss", magnitudePct: 2 },
  { label: "−5%", value: 1, tone: "loss", magnitudePct: 5 },
];

// --- Price series (Instrument Detail / Portfolio performance) ------------------
export const PRICE_SERIES: PricePoint[] = Array.from({ length: 40 }, (_, i) => {
  const base = 120 + Math.sin(i / 4) * 8 + i * 0.6;
  const open = base;
  const close = base + Math.cos(i / 3) * 3;
  const high = Math.max(open, close) + 2.2;
  const low = Math.min(open, close) - 2.4;
  const day = String((i % 28) + 1).padStart(2, "0");
  return { t: `2026-05-${day}`, open, high, low, close };
});

export const BENCHMARK_SERIES: number[] = PRICE_SERIES.map(
  (_, i) => 118 + i * 0.5 + Math.sin(i / 5) * 4,
);

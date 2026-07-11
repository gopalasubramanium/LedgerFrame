// Domain shapes for the component library, following the frozen API-CONTRACT
// schemas and GLOSSARY terminology. Monetary/quantity fields are backend-computed
// decimal STRINGS (the frontend never computes them).

import type { DecimalString } from "../format/number";

// Freshness — three-layer structure (GLOSSARY, D-027).
export type Entitlement =
  | "real-time"
  | "delayed"
  | "end-of-day"
  | "cached"
  | "unavailable";

// The one-word Pricing Health Status chip (GLOSSARY layer 3).
export type HealthStatus =
  | "Fresh"
  | "Delayed"
  | "End-of-day"
  | "Cached"
  | "Manual"
  | "Estimated"
  | "Unavailable";

export type ValuationMethod =
  | "market_quote"
  | "official_nav"
  | "broker_quote"
  | "manual_valuation"
  | "statement_import"
  | "calculated_accrual"
  | "estimated_value"
  | "fx_reference"
  | "unavailable";

export type ConfidenceBand = "high" | "medium" | "low";

export interface Confidence {
  /** 0–100 (GLOSSARY: Data confidence). */
  score: number;
  band: ConfidenceBand;
}

export interface Provenance {
  /** User-facing Source (GLOSSARY: Source/Provider/Routing split, D-028). */
  source: string;
  entitlement: Entitlement;
  valuationMethod: ValuationMethod;
  confidence: Confidence;
  status: HealthStatus;
  /** ISO timestamp the value was as-of. */
  asOf: string;
  /** Cached quote older than its threshold (GLOSSARY layer 2). */
  isStale: boolean;
  staleAfterSeconds?: number;
}

export interface Instrument {
  id: string;
  symbol: string;
  name: string;
  assetClass: string;
  assetSubclass?: string;
  listingCountry: string;
  sector: string | null;
  currency: string;
}

export interface Holding {
  id: string;
  instrument: Instrument;
  account: string;
  quantity: DecimalString;
  price: DecimalString;
  /** Current market value, base currency (backend-computed). */
  value: DecimalString;
  costBasis: DecimalString;
  unrealisedPl: DecimalString;
  todaysChange: DecimalString;
  provenance: Provenance;
}

export interface Segment {
  label: string;
  value: DecimalString;
  /** Optional per-segment explanation, shown in the hover/focus tooltip (e.g. the D-082
   *  "Unclassified sector" note). */
  note?: string;
}

export interface Quote {
  symbol: string;
  name: string;
  price: DecimalString;
  changePct: DecimalString;
  currency: string;
  provenance: Provenance;
}

export interface TreemapNode {
  label: string;
  value: number;
  /** Semantic tone for gain/loss shading (never decorative colour). */
  tone: "gain" | "loss" | "flat";
  /** Day-move magnitude in percent (unsigned); drives fill intensity. When
   *  absent, the tile renders at full intensity. */
  magnitudePct?: number;
}

export interface PricePoint {
  t: string; // ISO date
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
}

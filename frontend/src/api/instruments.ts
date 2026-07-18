import { apiGet, apiSend } from "./client";
import type { HoldingsResponse } from "./holdings";

// Instrument Detail (entity-detail page, P-3 scoped view). Money fields are display
// values / strings the backend produced — the frontend never computes them.
export interface InstrumentMeta {
  symbol: string;
  name?: string | null;
  asset_class?: string | null;
  currency?: string | null;
  exchange?: string | null;
  sector?: string | null;
  country?: string | null;
  asset_subclass?: string | null;
  listing_country?: string | null;
  source_override?: string | null;
  annual_cost_bps?: number | null;
  identifiers?: { id_type: string; value: string }[] | null;
  asset_detail?: Record<string, Record<string, unknown>> | null;
  history_status?: string | Record<string, unknown> | null;
}
export interface InstrumentQuote {
  symbol: string;
  price?: number | null;
  price_display?: string | null; // D-105 served display string (rendered verbatim)
  change?: number | null;
  change_pct?: number | null;
  currency?: string;
  source?: string;
  entitlement?: string;
  received_at?: string;
  is_stale?: boolean;
}
export interface InstrumentDetail {
  quote: InstrumentQuote;
  instrument: InstrumentMeta;
}
export interface Candle { ts: string; open: number; high: number; low: number; close: number; volume?: number | null; }
// R-42 §9-9 — the SERVED per-range intraday availability (D-105). The backend decides
// enabled/disabled + the reason (tier-, class- & capability-aware); the frontend RENDERS
// it and never decides it. The range→interval mapping is server-side, never frontend math.
export interface IntradayRangeState { interval: string; enabled: boolean; state: string; reason: string | null; }
export interface IntradayAvailability {
  ranges: Record<string, IntradayRangeState>;
  benchmark_reason: string;
  requested_range: string | null;
  fetch_state: string | null;
}
export interface HistoryResponse { symbol: string; interval: string; candles: Candle[]; intraday?: IntradayAvailability; }
export interface NewsItem {
  headline: string;
  summary?: string | null;
  url?: string | null;
  source: string;
  published_at: string;
}
export interface InstrumentPatchIn {
  asset_class?: string | null;
  country?: string | null;
  name?: string | null;
  source_override?: string | null;
}

export const getInstrument = (symbol: string) =>
  apiGet<InstrumentDetail>(`/instruments/${encodeURIComponent(symbol)}`);
// `range` (1D/5D…) is user-triggered: the server maps it to an interval, applies the
// server-side gate, and fetches (or refuses with a served reason). Daily ranges pass `days`.
export const getInstrumentHistory = (symbol: string, days = 180, range?: string) => {
  const params = new URLSearchParams({ days: String(days) });
  if (range) params.set("range", range);
  return apiGet<HistoryResponse>(
    `/instruments/${encodeURIComponent(symbol)}/history?${params.toString()}`,
  );
};
export const getInstrumentNews = (symbol: string) =>
  apiGet<{ symbol: string; items: NewsItem[] }>(`/instruments/${encodeURIComponent(symbol)}/news`);
// ND-1: the "position if held" panel reuses the canonical holdings reader, scoped.
export const getInstrumentPosition = (symbol: string) =>
  apiGet<HoldingsResponse>(`/portfolio/holdings?symbol=${encodeURIComponent(symbol)}`);
export const patchInstrument = (symbol: string, patch: InstrumentPatchIn) =>
  apiSend<InstrumentMeta>(`/instruments/${encodeURIComponent(symbol)}`, "PATCH", patch);
export const setOngoingCost = (symbol: string, annual_cost_bps: number | null) =>
  apiSend<{ ok: boolean; annual_cost_bps: number | null }>(
    `/instruments/${encodeURIComponent(symbol)}/ongoing-cost`, "PUT", { annual_cost_bps },
  );
// §14dr-6 — the canonical writer for the AMFI scheme mapping. The code's ONE home is
// instrument_identifiers (id_type amfi_code); this is the only way NAV mapping happens
// (never inferred). The edit dialog composes it when amfi_nav is chosen so the
// source override can validate (a mapping must exist first).
export const mapAmfi = (symbol: string, code: string) =>
  apiSend<{ ok: boolean; symbol: string; code: string; published: number }>(
    `/instruments/${encodeURIComponent(symbol)}/map-amfi`, "POST", { code },
  );

// D-097 — class-aware instrument search for the Add-flow picker. Three honest
// buckets so an autocomplete can never misclassify (see backend /instruments/search).
export interface InstrumentSearchItem {
  id?: number;
  symbol: string;
  name: string;
  asset_class?: string;
  currency?: string;
}
export interface InstrumentSearchResult {
  existing: InstrumentSearchItem[]; // ledger instruments of the picked class
  other_class: InstrumentSearchItem[]; // ledger instruments under a DIFFERENT class
  suggestions: { symbol: string; name: string }[]; // provider search routed by class
  // §14dr-13 — the class's instrument-master state, so the picker's honest empty can
  // distinguish "never synced" (actionable: sync in Settings) from "no match". Null for
  // classes with no dedicated master (equity/etf → live provider search, nothing to sync).
  master?: { provider: "amfi" | "coingecko"; synced: boolean } | null;
}

export const searchInstruments = (q: string, assetClass?: string) => {
  const p = new URLSearchParams({ q });
  if (assetClass) p.set("asset_class", assetClass);
  return apiGet<InstrumentSearchResult>(`/instruments/search?${p.toString()}`);
};

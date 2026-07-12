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
export const getInstrumentHistory = (symbol: string, days = 180) =>
  apiGet<{ symbol: string; interval: string; candles: Candle[] }>(
    `/instruments/${encodeURIComponent(symbol)}/history?days=${days}`,
  );
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
}

export const searchInstruments = (q: string, assetClass?: string) => {
  const p = new URLSearchParams({ q });
  if (assetClass) p.set("asset_class", assetClass);
  return apiGet<InstrumentSearchResult>(`/instruments/search?${p.toString()}`);
};

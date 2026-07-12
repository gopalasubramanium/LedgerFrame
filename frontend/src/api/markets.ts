import { apiGet, apiSend } from "./client";

// Markets (Markets-group home) readers — page-markets §3a. Everything is already in the frozen
// contract (no §3b delta; ND-1 Gainers/Losers is a display-sort of the served overview quotes, not a
// new endpoint). Every price/percent/status is a SERVED display value — the page performs no money
// math (P-1/D-031). Ranking Gainers/Losers is a display SORT of served `change_pct`, never a
// computation.

// A served quote (backend `Quote.model_dump`, app/schemas/common.py). Money fields cross the JSON
// boundary as strings/numbers for exact display; the frontend only renders them.
export interface ServedQuote {
  symbol: string;
  exchange?: string | null;
  price: string | number | null;
  change_pct: string | number | null;
  currency: string;
  source: string;
  entitlement: string;
  valuation_method: string;
  market_time?: string | null;
  received_at: string;
  is_stale: boolean;
}

export interface MarketStatus {
  market: string;
  state: string; // MarketState enum: open | closed | pre-market | post-market | unknown
  as_of: string;
  next_change?: string | null;
}

export interface OverviewInstrument {
  symbol: string;
  name: string;
  asset_class: string;
  currency: string;
  country: string | null;
  held: boolean;
  quote: ServedQuote;
}

export interface OverviewResp {
  quotes: ServedQuote[];
  instruments: OverviewInstrument[];
  market_status: MarketStatus;
  demo_mode: boolean;
}

export interface GlobalItem {
  symbol: string;
  label: string;
  quote: ServedQuote;
}
export interface GlobalGroup {
  region: string;
  items: GlobalItem[];
}
export interface GlobalResp {
  groups: GlobalGroup[];
  market_status: MarketStatus;
  demo_mode: boolean;
  real_indices: boolean;
}

export interface WatchlistItemT {
  symbol: string;
  name: string;
  quote: ServedQuote;
}
export interface WatchlistT {
  id: number;
  name: string;
  items: WatchlistItemT[];
}
export interface WatchlistsResp {
  watchlists: WatchlistT[];
}

export const getMarketsOverview = () => apiGet<OverviewResp>("/markets/overview");
export const getMarketsGlobal = () => apiGet<GlobalResp>("/markets/global");
export const getWatchlists = () => apiGet<WatchlistsResp>("/watchlists");

// Watchlist management — ONLY here (D-052). Every mutation is require_auth (session [S], ND-4);
// the server writes, the client never fabricates. No rename endpoint exists (ND-4 — rename DECLINED).
export const createWatchlist = (name: string) =>
  apiSend<{ ok: boolean; id: number }>("/watchlists", "POST", { name });
export const deleteWatchlist = (id: number) =>
  apiSend<{ ok: boolean }>(`/watchlists/${id}`, "DELETE");
export const addWatchlistItem = (id: number, symbol: string) =>
  apiSend<{ ok: boolean }>(`/watchlists/${id}/items`, "POST", { symbol });
export const removeWatchlistItem = (id: number, symbol: string) =>
  apiSend<{ ok: boolean }>(`/watchlists/${id}/items/${encodeURIComponent(symbol)}`, "DELETE");

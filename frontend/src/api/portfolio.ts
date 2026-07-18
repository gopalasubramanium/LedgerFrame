import { apiGet } from "./client";

// Portfolio (analytics) readers — page-portfolio §3a. All figures are SERVED display values;
// the page performs no money math. Types mirror the verified payloads (Phase-0 §10).

export interface MoverRow {
  id: number;
  label: string | null;
  symbol: string | null;
  name?: string | null; // §14dr-19: instrument name beside the ticker
  price: number | null;
  currency: string | null;
  market_value: number | null;
  day_change: number | null;
  day_change_pct: number | null;
}

export interface PortfolioSummary {
  base_currency: string;
  total_value: number;
  gross_assets: number;
  liabilities: number;
  cash_and_deposits: number;
  cost_basis: number;
  // §12-R2 (F-3): served cost-basis exclusion annotation (D-105) — the excluded-lot count + note.
  cost_fx_excluded_lots?: number;
  cost_basis_note?: string | null;
  unrealised_pl: number;
  day_change: number;
  total_return_pct: number;
  has_stale: boolean;
  stale_count: number;
  allocation_by_class: Record<string, number>;
  allocation_by_currency: Record<string, number>;
  allocation_by_sector: Record<string, number>;
  top_gainers: MoverRow[];
  top_losers: MoverRow[];
}

export interface StatMetric {
  label: string;
  value: number | null;
  kind: string; // money | pct | ratio | count
  term_id: string | null;
  signed?: boolean;
  note?: string | null;
  // §12-R1 (F-2): valuation basis of this metric — "live" (current quotes + FX) vs "date-aware"
  // (per-date reconstructed history). Served so the card never mixes the two silently.
  basis?: string | null;
}
export interface PortfolioStats {
  base_currency: string;
  metrics: StatMetric[];
}

export interface Benchmark {
  symbol: string;
  label: string;
}

export interface PerfPoint {
  ts: string;
  value: number;
}
export interface PerfStats {
  return_pct: number;
  benchmark_return_pct: number;
  excess_pct: number;
  volatility_pct: number;
  max_drawdown_pct: number;
  best_day_pct: number;
  worst_day_pct: number;
  start_value: number;
  end_value: number;
}
export interface PerformanceResp {
  base_currency: string;
  benchmark_symbol: string;
  series: PerfPoint[];
  benchmark: PerfPoint[];
  stats: PerfStats | null;
}

export interface AttributionHolding {
  holding_id: number;
  label: string;
  symbol: string | null;
  name?: string | null; // §14dr-19: instrument name beside the ticker
  asset_class: string | null;
  sector: string | null;
  contribution_pct: number;
}
export interface AttributionResp {
  attribution: {
    available: boolean;
    headline_return_pct?: number;
    residual_pct?: number;
    residual_breakdown?: { income_pct: number; realised_pct: number };
    holdings?: AttributionHolding[];
    window_days?: number;
    reason?: string;
  };
  risk: {
    available: boolean;
    hhi?: number | null;
    beta?: number | null;
    correlation?: number | null;
    downside_deviation?: number | null;
    information_ratio?: number | null;
    tracking_error?: number | null;
  };
}

export interface CostResp {
  base_currency: string;
  recorded_fees: { currency: string; year: number; label: string; total: number; commissions: number; taxes: number };
  estimated_ongoing_cost: {
    currency: string;
    available: boolean;
    estimated_annual_total: number | null;
    covered_value: number | null;
    covered: number;
    total: number;
    coverage_label: string;
    holdings: { symbol: string | null; label: string; annual_cost: number }[];
    unavailable: { symbol: string | null; label: string; reason: string }[];
  };
}

export interface RealisedResp {
  year: number;
  years: number[];
  base_currency: string;
  base_realised_total_current_fx: number;
  base_realised_total_historical_fx: number;
  realised_fx_events_excluded: number;
  disclaimer: string;
}

export interface TagRow {
  tag: string;
  value: number;
  count: number;
  pct: number;
}
export interface TagsResp {
  base_currency: string;
  total: number;
  tags: TagRow[];
}

export const getPortfolioSummary = () => apiGet<PortfolioSummary>("/portfolio/summary");
export const getPortfolioStats = () => apiGet<PortfolioStats>("/portfolio/stats");
export const getBenchmarks = () => apiGet<{ benchmarks: Benchmark[] }>("/portfolio/benchmarks");
export const getPerformance = (days: number, benchmark: string, includeManual: boolean) =>
  apiGet<PerformanceResp>(
    `/portfolio/performance?days=${days}&benchmark=${encodeURIComponent(benchmark)}&include_manual=${includeManual}`,
  );
export const getAttribution = (days: number, benchmark: string) =>
  apiGet<AttributionResp>(`/portfolio/attribution?days=${days}&benchmark=${encodeURIComponent(benchmark)}`);
export const getCostOfOwnership = () => apiGet<CostResp>("/portfolio/cost-of-ownership");
export const getRealisedGains = () => apiGet<RealisedResp>("/portfolio/realised-gains");
export const getTagAllocation = () => apiGet<TagsResp>("/portfolio/tags");

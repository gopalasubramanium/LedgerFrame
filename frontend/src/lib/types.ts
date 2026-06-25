// Shared response types mirroring the FastAPI models (kept intentionally light).

export type Entitlement =
  | "real-time"
  | "delayed"
  | "end-of-day"
  | "cached"
  | "unavailable";

export interface Quote {
  symbol: string;
  exchange: string | null;
  price: number | null;
  previous_close: number | null;
  change: number | null;
  change_pct: number | null;
  currency: string;
  source: string;
  entitlement: Entitlement;
  market_time: string | null;
  received_at: string;
  is_stale: boolean;
}

export interface SystemStatus {
  version: string;
  demo_mode: boolean;
  market_provider: string;
  base_currency: string;
  timezone: string;
  ai_enabled: boolean;
  voice_enabled: boolean;
  allow_lan: boolean;
  pin_set: boolean;
  db_ok: boolean;
  data_writable: boolean;
}

export interface PortfolioSummary {
  base_currency: string;
  total_value: number;
  cost_basis: number;
  unrealised_pl: number;
  day_change: number;
  total_return_pct: number | null;
  has_stale: boolean;
  allocation_by_class: Record<string, number>;
  allocation_by_currency: Record<string, number>;
  top_gainers: HoldingRow[];
  top_losers: HoldingRow[];
}

export interface HoldingRow {
  id: number;
  label: string;
  symbol: string | null;
  asset_class: string;
  quantity: number;
  currency: string;
  price: number | null;
  market_value: number;
  cost_basis: number;
  unrealised_pl: number;
  day_change: number;
  is_stale: boolean;
  is_priced: boolean;
}

export interface HomeDashboard {
  now: string;
  timezone: string;
  demo_mode: boolean;
  market_status: { market: string; state: string; as_of: string };
  portfolio: {
    total_value: number;
    day_change: number;
    unrealised_pl: number;
    total_return_pct: number | null;
    base_currency: string;
    has_stale: boolean;
  };
  top_movers: {
    gainers: { label: string; symbol: string | null; day_change: number; is_stale: boolean }[];
    losers: { label: string; symbol: string | null; day_change: number; is_stale: boolean }[];
  };
  markets: Quote[];
  fx: { base: string; quote: string; rate: number; is_stale: boolean }[];
  briefing: { text: string; generated_at: string | null };
}

export interface GroundingFact {
  label: string;
  value: string;
  source: string;
  timestamp: string | null;
  entitlement: string | null;
  is_stale: boolean;
}

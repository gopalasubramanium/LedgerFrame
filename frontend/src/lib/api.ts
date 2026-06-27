// Thin typed fetch wrapper. Same-origin in production; Vite proxies /api in dev.

import type {
  GroundingFact,
  HomeDashboard,
  PortfolioSummary,
  Quote,
  SystemStatus,
} from "./types";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    // Bound every request so a slow/rate-limited backend can't hang a panel.
    signal: init?.signal ?? AbortSignal.timeout(25000),
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // Session locked/expired → tell the app to pop the PIN screen automatically.
    if (res.status === 401) window.dispatchEvent(new CustomEvent("lf:unauthorized"));
    throw new ApiError(res.status, body || res.statusText);
  }
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const api = {
  systemStatus: () => req<SystemStatus>("/api/v1/system/status"),
  aiStatus: () => req<{ available: boolean; provider: string; detail: string }>("/api/v1/ai/status"),
  home: () => req<HomeDashboard>("/api/v1/dashboard/home"),
  portfolioSummary: () => req<PortfolioSummary>("/api/v1/portfolio/summary"),
  holdings: () => req<{ base_currency: string; holdings: import("./types").HoldingRow[] }>("/api/v1/portfolio/holdings"),
  performance: (days = 365, benchmark = "SPY", includeManual = false) =>
    req<{
      base_currency: string;
      benchmark_symbol: string;
      series: { ts: string; value: number }[];
      benchmark: { ts: string; value: number }[];
      stats: null | {
        return_pct: number; benchmark_return_pct: number; excess_pct: number;
        max_drawdown_pct: number; volatility_pct: number; best_day_pct: number;
        worst_day_pct: number; start_value: number; end_value: number;
      };
    }>(`/api/v1/portfolio/performance?days=${days}&benchmark=${encodeURIComponent(benchmark)}&include_manual=${includeManual}`),
  benchmarks: () => req<{ benchmarks: { symbol: string; label: string }[] }>("/api/v1/portfolio/benchmarks"),
  stats: (benchmark = "SPY") =>
    req<{ base_currency: string; metrics: { label: string; value: number | null; kind: string; signed?: boolean; note?: string | null }[] }>(
      `/api/v1/portfolio/stats?benchmark=${encodeURIComponent(benchmark)}`,
    ),
  marketsOverview: () =>
    req<{
      quotes: Quote[];
      instruments: { symbol: string; name: string; asset_class: string; currency: string; held: boolean; quote: Quote }[];
      market_status: { state: string };
      demo_mode: boolean;
    }>("/api/v1/markets/overview"),
  instrumentNews: (symbol: string) =>
    req<{ symbol: string; items: { headline: string; summary?: string | null; url?: string | null; source: string; published_at: string }[] }>(`/api/v1/instruments/${encodeURIComponent(symbol)}/news`),
  history: (symbol: string, days = 180) =>
    req<{ symbol: string; candles: { ts: string; open: number; high: number; low: number; close: number; volume: number | null }[] }>(
      `/api/v1/instruments/${encodeURIComponent(symbol)}/history?days=${days}`,
    ),
  search: (q: string) =>
    req<{ results: { symbol: string; name: string; asset_class: string; currency: string }[] }>(`/api/v1/markets/search?q=${encodeURIComponent(q)}`),
  marketsGlobal: () =>
    req<{ groups: { region: string; items: { symbol: string; label: string; quote: Quote }[] }[]; market_status: { state: string }; demo_mode: boolean }>("/api/v1/markets/global"),
  news: () =>
    req<{ items: { headline: string; summary?: string | null; url?: string | null; source: string; published_at: string; symbols: string[] }[]; rss_count: number }>("/api/v1/news"),
  watchlists: () => req<{ watchlists: { id: number; name: string; items: { symbol: string; name: string; quote: Quote }[] }[] }>("/api/v1/watchlists"),
  createWatchlist: (name: string, symbols: string[]) =>
    req<{ ok: boolean; id: number }>("/api/v1/watchlists", { method: "POST", body: JSON.stringify({ name, symbols }) }),
  addWatchItem: (wlId: number, symbol: string) =>
    req<{ ok: boolean; watchlist_id: number }>(`/api/v1/watchlists/${wlId}/items`, { method: "POST", body: JSON.stringify({ symbol }) }),
  removeWatchItem: (wlId: number, symbol: string) =>
    req<{ ok: boolean }>(`/api/v1/watchlists/${wlId}/items/${encodeURIComponent(symbol)}`, { method: "DELETE" }),
  deleteWatchlist: (wlId: number) =>
    req<{ ok: boolean }>(`/api/v1/watchlists/${wlId}`, { method: "DELETE" }),
  settings: () => req<{ stored: Record<string, string>; defaults: Record<string, unknown> }>("/api/v1/settings"),
  updateSettings: (values: Record<string, string>) =>
    req("/api/v1/settings", { method: "PUT", body: JSON.stringify({ values }) }),
  setPin: (pin: string) => req("/api/v1/auth/set-pin", { method: "POST", body: JSON.stringify({ pin }) }),
  unlock: (pin: string) => req("/api/v1/auth/unlock", { method: "POST", body: JSON.stringify({ pin }) }),
  lock: () => req("/api/v1/auth/lock", { method: "POST" }),
  authState: () => req<{ pin_set: boolean }>("/api/v1/auth/state"),

  // --- Transactions ---
  transactions: () => req<{ transactions: TxnRow[] }>("/api/v1/portfolio/transactions"),
  addTransaction: (t: TxnInput) =>
    req<{ ok: boolean }>("/api/v1/portfolio/transactions", { method: "POST", body: JSON.stringify(t) }),
  updateTransaction: (id: number, t: TxnInput) =>
    req<{ ok: boolean }>(`/api/v1/portfolio/transactions/${id}`, { method: "PUT", body: JSON.stringify(t) }),
  deleteTransaction: (id: number) =>
    req<{ ok: boolean }>(`/api/v1/portfolio/transactions/${id}`, { method: "DELETE" }),
  importCsv: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/v1/portfolio/import/csv", { method: "POST", body: form, credentials: "same-origin" });
    if (!res.ok) throw new ApiError(res.status, await res.text());
    return res.json() as Promise<{ imported: number; errors: string[] }>;
  },
  csvTemplateUrl: "/api/v1/portfolio/import/template",

  // --- News feeds (free RSS) ---
  feeds: () => req<{ feeds: string[]; defaults: string[] }>("/api/v1/news/feeds"),
  setFeeds: (feeds: string[]) =>
    req<{ ok: boolean; feeds: string[] }>("/api/v1/news/feeds", { method: "PUT", body: JSON.stringify({ feeds }) }),

  feedsTest: () => req<{ results: { url: string; ok: boolean; count: number; error: string | null; status: number | null }[] }>("/api/v1/news/feeds/test"),

  // --- Data source (mock ↔ live) ---
  dataSource: () => req<{ provider: string; has_api_key: boolean; base_currency: string; stale_after_seconds: string; providers: string[]; admin_available: boolean }>("/api/v1/system/data-source"),
  setDataSource: (d: { provider: string; api_key?: string; base_currency?: string; stale_after_seconds?: number }) =>
    req<{ ok: boolean; applied: boolean; note: string }>("/api/v1/system/data-source", { method: "PUT", body: JSON.stringify(d) }),
  config: () => req<Record<string, string>>("/api/v1/system/config"),
  setConfig: (values: Record<string, string>) =>
    req<{ ok: boolean; note: string }>("/api/v1/system/config", { method: "PUT", body: JSON.stringify({ values }) }),
  aiConfig: () => req<{ enabled: boolean; provider: string; hailo_base_url: string; model: string; openai_base_url: string; has_openai_key: boolean; providers: string[] }>("/api/v1/system/ai-config"),
  setAiConfig: (d: { enabled: boolean; provider: string; hailo_base_url?: string; model?: string; openai_base_url?: string; openai_api_key?: string }) =>
    req<{ ok: boolean; available: boolean; detail: string }>("/api/v1/system/ai-config", { method: "PUT", body: JSON.stringify(d) }),
  resetData: () => req<{ ok: boolean; note: string }>("/api/v1/system/reset-data", { method: "POST" }),
  refreshData: () => req<{ ok: boolean; refreshed: number; total: number; succeeded: string[]; failed: { symbol: string; reason: string }[]; errors: string[] }>("/api/v1/system/refresh-data", { method: "POST" }),
  fetchHistory: () => req<{ ok: boolean; with_history: string[]; no_history: string[]; total: number }>("/api/v1/system/fetch-history", { method: "POST" }),

  versionCheck: () => req<{ current: string; latest: string; update_available: boolean; url: string }>("/api/v1/system/version-check"),
  updateStatus: () => req<{ running: boolean; ok: boolean; failed: boolean; status: string; version: string; log_tail: string }>("/api/v1/system/update-status"),

  // --- System admin (scoped root helper) ---
  adminAvailable: () => req<{ available: boolean }>("/api/v1/system/admin/available"),
  admin: (action: string, arg?: string) =>
    req<{ ok: boolean; output: string }>("/api/v1/system/admin", { method: "POST", body: JSON.stringify({ action, arg }) }),

  // --- Manual assets / liabilities ---
  manualHoldings: () => req<{ holdings: ManualRow[] }>("/api/v1/portfolio/manual-holdings"),
  addManualHolding: (h: ManualInput) =>
    req<{ ok: boolean }>("/api/v1/portfolio/manual-holdings", { method: "POST", body: JSON.stringify(h) }),
  updateManualHolding: (id: number, h: ManualInput) =>
    req<{ ok: boolean }>(`/api/v1/portfolio/manual-holdings/${id}`, { method: "PUT", body: JSON.stringify(h) }),
  deleteManualHolding: (id: number) =>
    req<{ ok: boolean }>(`/api/v1/portfolio/manual-holdings/${id}`, { method: "DELETE" }),
};

export interface TxnRow {
  id: number;
  symbol: string | null;
  type: string;
  ts: string;
  quantity: number;
  price: number;
  fees: number;
  taxes: number;
  amount: number;
  currency: string;
  note: string | null;
}
export interface TxnInput {
  symbol?: string | null;
  type: string;
  ts: string;
  quantity: number;
  price: number;
  fees: number;
  taxes: number;
  currency: string;
  note?: string | null;
}
export interface ManualRow {
  id: number;
  label: string;
  asset_class: string;
  value: number;
  currency: string;
}
export interface ManualInput {
  label: string;
  asset_class: string;
  value: number;
  currency: string;
}

export const TXN_TYPES = [
  "buy", "sell", "dividend", "interest", "deposit", "withdrawal", "fee", "split", "bonus", "transfer",
] as const;
export const ASSET_CLASSES = [
  "equity", "etf", "mutual_fund", "bond", "cash", "fixed_deposit", "commodity", "crypto",
  "property", "private", "retirement", "liability", "other",
] as const;

// Stream a grounded AI answer over SSE. Calls onFacts once, onDelta repeatedly.
export async function streamChat(
  question: string,
  handlers: {
    onFacts?: (facts: GroundingFact[]) => void;
    onDelta?: (text: string) => void;
    onDone?: (meta: Record<string, unknown>) => void;
  },
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch("/api/v1/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
    credentials: "same-origin",
    signal,
  });
  if (!res.body) throw new ApiError(res.status, "no stream body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.replace(/^data:\s*/, "").trim();
      if (!trimmed) continue;
      try {
        const ev = JSON.parse(trimmed);
        if (ev.type === "facts") handlers.onFacts?.(ev.facts);
        else if (ev.type === "delta") handlers.onDelta?.(ev.delta);
        else if (ev.type === "done") handlers.onDone?.(ev);
      } catch {
        /* ignore partial frames */
      }
    }
  }
}

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
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
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
  marketsOverview: () =>
    req<{ quotes: Quote[]; market_status: { state: string }; demo_mode: boolean }>("/api/v1/markets/overview"),
  history: (symbol: string, days = 180) =>
    req<{ symbol: string; candles: { ts: string; close: number }[] }>(
      `/api/v1/instruments/${encodeURIComponent(symbol)}/history?days=${days}`,
    ),
  news: () =>
    req<{ items: { headline: string; source: string; published_at: string; symbols: string[] }[] }>("/api/v1/news"),
  watchlists: () => req<{ watchlists: { id: number; name: string; items: { symbol: string; name: string; quote: Quote }[] }[] }>("/api/v1/watchlists"),
  createWatchlist: (name: string, symbols: string[]) =>
    req("/api/v1/watchlists", { method: "POST", body: JSON.stringify({ name, symbols }) }),
  settings: () => req<{ stored: Record<string, string>; defaults: Record<string, unknown> }>("/api/v1/settings"),
  updateSettings: (values: Record<string, string>) =>
    req("/api/v1/settings", { method: "PUT", body: JSON.stringify({ values }) }),
  setPin: (pin: string) => req("/api/v1/auth/set-pin", { method: "POST", body: JSON.stringify({ pin }) }),
  unlock: (pin: string) => req("/api/v1/auth/unlock", { method: "POST", body: JSON.stringify({ pin }) }),
  lock: () => req("/api/v1/auth/lock", { method: "POST" }),
  authState: () => req<{ pin_set: boolean }>("/api/v1/auth/state"),
};

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

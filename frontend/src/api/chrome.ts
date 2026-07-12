// Chrome status readers: settings (timezone/demo/no-egress) + the stale summary.
// These feed the top bar's Clock/DemoBadge and the StaleBanner. All are status
// summaries — the chrome owns no figures (IA P-1). Every reader degrades to a safe
// empty value so a failed call hides its chrome piece rather than breaking the shell.
import { apiGet, apiSend } from "./client";

const TRUTHY = new Set(["1", "true", "yes", "on"]);

interface SettingsResponse {
  stored?: Record<string, string>;
  defaults?: {
    timezone?: string;
    demo_mode?: boolean;
    base_currency?: string;
    market_provider?: string;
  };
}

export interface StaleSummary {
  has_stale: boolean;
  stale_count: number;
}

export async function fetchStaleSummary(): Promise<StaleSummary> {
  const r = await apiGet<{ has_stale?: boolean; stale_count?: number }>("/portfolio/summary");
  if (!r.ok) return { has_stale: false, stale_count: 0 };
  return { has_stale: !!r.data.has_stale, stale_count: r.data.stale_count ?? 0 };
}

// Global ticker footer (D-047 amendment, §11-17): the user's holdings + world indices.
// Both come from the frozen contract (no contract change) — /portfolio/holdings and
// /markets/global (which exposes index quotes; §11-17 4a). Prices/percents stay strings
// (the frontend never computes money); staleness is carried through per item. Degrades
// safely — a failed reader just contributes nothing.
export interface TickerQuote {
  symbol: string;
  price: string | null;
  changePct: string | null;
  stale?: boolean;
  /** Link target: holdings → their instrument-detail page (D-098); world indices → `/markets`,
   *  the Markets-group home that owns them (R-17, page-markets ND-5). Never a dead link. */
  href?: string;
}

const numToStr = (v: unknown): string | null =>
  v === null || v === undefined ? null : String(v);

interface HoldingsResp {
  holdings?: { symbol?: string | null; price?: number | null; day_change_pct?: number | null; is_stale?: boolean }[];
}
interface GlobalResp {
  groups?: { items?: { symbol?: string; label?: string; quote?: { price?: unknown; change_pct?: unknown; is_stale?: boolean } }[] }[];
}

// ---- First-run checklist (D-045) -------------------------------------------------
// The checklist writes real settings through the canonical endpoints (F-2). PUT /settings
// is the canonical base-currency / timezone / no-egress / first-run-flag path (F-10);
// the data provider goes through /system/data-source (F-8; keys stay in Settings).
export async function updateSetting(key: string, value: string): Promise<boolean> {
  const r = await apiSend<{ ok?: boolean }>("/settings", "PUT", { values: { [key]: value } });
  return r.ok;
}

export async function setDataProvider(provider: string): Promise<boolean> {
  const r = await apiSend<{ ok?: boolean }>("/system/data-source", "PUT", { provider });
  return r.ok;
}

export interface FirstRunState {
  complete: boolean;
  baseCurrency: string;
  timezone: string;
  provider: string;
  noEgress: boolean;
  pinSet: boolean;
  demo: boolean;
  providers: string[];
}

// One combined read for the shell's settings-derived state: whether first-run is done,
// the current values the checklist edits, and the served provider list (frontend
// zero-copy). Degrades to safe defaults so a failed call never breaks the shell.
export async function fetchFirstRunState(): Promise<FirstRunState> {
  const [s, a, d] = await Promise.all([
    apiGet<SettingsResponse & { stored?: Record<string, string> }>("/settings"),
    apiGet<{ pin_set?: boolean }>("/auth/state"),
    apiGet<{ providers?: string[] }>("/system/data-source"),
  ]);
  const stored = s.ok ? s.data.stored ?? {} : {};
  const defaults = s.ok ? s.data.defaults ?? {} : {};
  return {
    complete: TRUTHY.has((stored.first_run_complete ?? "").toLowerCase()),
    baseCurrency: defaults.base_currency ?? "",
    timezone: defaults.timezone ?? "UTC",
    provider: defaults.market_provider ?? "",
    noEgress: TRUTHY.has((stored.privacy_mode ?? "").toLowerCase()),
    pinSet: a.ok ? !!a.data.pin_set : false,
    demo: !!defaults.demo_mode,
    providers: d.ok ? d.data.providers ?? [] : [],
  };
}

export async function fetchTickerQuotes(): Promise<TickerQuote[]> {
  const [h, g] = await Promise.all([
    apiGet<HoldingsResp>("/portfolio/holdings"),
    apiGet<GlobalResp>("/markets/global"),
  ]);
  const out: TickerQuote[] = [];
  // Holdings first (it's the user's portfolio), then world indices.
  if (h.ok) {
    for (const hv of h.data.holdings ?? []) {
      if (!hv.symbol) continue;
      out.push({
        symbol: hv.symbol,
        price: numToStr(hv.price),
        changePct: numToStr(hv.day_change_pct),
        stale: !!hv.is_stale,
        // D-098: holdings link to their instrument-detail page.
        href: `/instrument/${encodeURIComponent(hv.symbol)}`,
      });
    }
  }
  if (g.ok) {
    for (const grp of g.data.groups ?? []) {
      for (const it of grp.items ?? []) {
        const label = it.label || it.symbol;
        if (!label) continue;
        out.push({
          symbol: label,
          price: numToStr(it.quote?.price),
          changePct: numToStr(it.quote?.change_pct),
          stale: !!it.quote?.is_stale,
          // R-17 (page-markets ND-5): world indices link to /markets, which owns them. The Global
          // tab lives on the page (no deep-link anchor). Holdings still → InstrumentDetail (above).
          href: "/markets",
        });
      }
    }
  }
  return out;
}

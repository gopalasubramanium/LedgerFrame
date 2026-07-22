import { apiGet, apiSend } from "./client";
import { refreshBriefing } from "./news";

// Pricing Health (diagnostics) readers — page-pricing-health §3a. All display values are SERVED
// (provenance/confidence/routing); the page performs no money math (P-1/D-031). Everything the
// page needs is already in the frozen contract (no §3b delta).

/** One priority-chain entry as served (§18-R4) — read-only presentation, never editable (D-072). */
export interface ChainEntry {
  source: string;
  keyed: boolean;
  note: string | null;
}

export interface PricingRow {
  id: number;
  symbol: string | null;
  label: string;
  asset_class: string | null;
  sector: string | null;
  exchange: string | null;
  currency: string | null;
  native_price: number | null;
  market_value: number | null;
  valuation_method: string;
  valuation_label: string;
  status: string; // HealthStatus (Fresh/Delayed/End-of-day/Cached/Manual/Estimated/Unavailable)
  source: string;
  entitlement: string;
  price_ts: string | null;
  is_stale: boolean;
  failure_reason: string | null;
  // R-63 §9-2: the TYPED reason there is no live price — one of throttled/empty/errored/
  // parse_error/unmapped/no_key/unsupported, never a flat "none". `failure_at` is when it was
  // last recorded (ISO); `failure_note` is the SERVED explanation (rendered verbatim, D-105 —
  // ⚠ PROPOSED copy pending the 0a ratification). null when there is no recorded failure.
  failure_state: string | null;
  failure_at: string | null;
  failure_note: string | null;
  source_override: string | null;
  // routing (D-072 — visible, never editable)
  route_lane: string;
  route_source: string;
  priority_chain: string[];
  // §18-R4: the same chain, per entry, with its keyed state and the SERVED annotation for the
  // unkeyed case ("(no key)"). The chain is a shipped policy constant naming every provider that
  // could price the lane; without this, entries this instance has no credential for read as
  // phantom providers. `note` is rendered verbatim — never frontend-invented (D-105).
  priority_chain_detail?: ChainEntry[];
  mapping_required: boolean;
  auth_required: boolean;
  // R-38 §9-10: which rule selected the source (override | matrix | lane | active) — ONE derivation
  // from route(), served read-only. The frontend never recomputes it (D-105/D-072).
  route_rule: string;
  // D1-c: the router's OWN served reason (e.g. "awaiting NAV (refresh AMFI)"), surfaced in the
  // routing diagnostics block. Never frontend-invented (D-105).
  route_reason: string | null;
  // confidence
  confidence: number;
  confidence_band: string; // high | medium | low (high≥80 / med≥50 / low<50)
  confidence_factors: string[];
}

export interface BandBreakdown {
  count: number;
  value_pct: number;
}
export interface PricingHealthResp {
  base_currency: string;
  holdings: PricingRow[];
  summary: Record<string, number>; // status → count
  confidence: { overall: number; overall_band: string; by_band: Record<string, BandBreakdown> };
  // R-38 §9-8: the honest Alpha-Vantage tier string when the active provider is a non-premium AV key
  // ("index via ETF proxy — key not premium"); null otherwise. Served, never a fabricated real-index
  // label — index isn't a holdings lane, so this is surfaced as provider context (D-105).
  provider_tier_note?: string | null;
}

export interface DuplicateGroup {
  id_type: string;
  value: string;
  instrument_count: number;
  instruments: { id: number; symbol: string | null; name: string | null }[];
}
export interface DuplicatesResp {
  duplicates: DuplicateGroup[];
  count: number;
}

// Bulk refresh (D-069 [S]-gated). Long-running (40s + 8s/symbol); reports updated/failed/skipped.
export interface RefreshSummary {
  ok: boolean;
  refreshed: number;
  total: number;
  skipped: number;
  succeeded: string[];
  failed: { symbol: string; reason: string }[];
  // §18-R2 (F-7b): symbols still stale AFTER the pass. The lane may never read as fully
  // successful while this is non-empty — that is exactly the "26 of 26 but stale" lie.
  still_stale: string[];
  errors: string[];
}

export const getPricingHealth = () => apiGet<PricingHealthResp>("/portfolio/pricing-health");
export const getIdentifierDuplicates = () => apiGet<DuplicatesResp>("/system/identifier-duplicates");
// Per-holding refresh (row action) + bulk "Refresh all" — the SAME endpoints the app already
// exposes; no banner refresh (ND-2). Both are require_auth (session [S], ND-3).
export const refreshHolding = (id: number) =>
  apiSend<{ ok: boolean; refreshed?: boolean; reason?: string }>(`/portfolio/pricing-health/${id}/refresh`, "POST");
export const refreshAllData = () => apiSend<RefreshSummary>("/system/refresh-data", "POST");
// §14dr-17: FX (ECB reference rates) — the opt-in daily feed when no file is supplied.
export const refreshFxEcb = () => apiSend<{ currencies?: number; as_of?: string }>("/fx/ecb/refresh", "POST");

// §14dr-17 — REFRESH ALL MARKET DATA. Contract-held (owner ruling): the frontend
// orchestrates the three existing lane endpoints — quotes (world-index proxies ride
// this lane via display-symbols), FX, and news — and reports a per-lane result
// summary. Instrument masters are EXCLUDED by ruling (rarely change; budget) and stay
// manual in Settings → Data feeds. Lanes run in sequence (user-triggered; the quotes
// lane already paces itself). No new endpoint — contract 134 HELD.
export interface LaneResult {
  lane: string;
  ok: boolean;
  detail: string;
}
export async function refreshAllMarketData(): Promise<LaneResult[]> {
  const lanes: LaneResult[] = [];

  const q = await refreshAllData();
  lanes.push(
    q.ok
      ? {
          lane: "Quotes & indices",
          ok: q.data.failed.length === 0 && (q.data.still_stale?.length ?? 0) === 0,
          detail: `Refreshed ${q.data.refreshed} of ${q.data.total}${
            q.data.failed.length ? ` · ${q.data.failed.length} not refreshed` : ""
          }${q.data.skipped ? ` · ${q.data.skipped} skipped` : ""}${
            q.data.still_stale?.length ? ` · ${q.data.still_stale.length} still stale` : ""
          }`,
        }
      : { lane: "Quotes & indices", ok: false, detail: q.error },
  );

  const fxr = await refreshFxEcb();
  lanes.push(
    fxr.ok
      ? { lane: "FX rates", ok: true, detail: `Updated ${fxr.data.currencies ?? 0} rates` }
      : { lane: "FX rates", ok: false, detail: fxr.error },
  );

  const n = await refreshBriefing();
  lanes.push(
    n.ok
      ? { lane: "News", ok: true, detail: "Briefing refreshed" }
      : { lane: "News", ok: false, detail: n.error },
  );

  return lanes;
}
// Correct-source: a per-instrument CORRECTION (validated), never priority editing (D-072, ND-4).
export const correctSource = (symbol: string, source_override: string) =>
  apiSend<{ ok?: boolean; source_override?: string | null }>(`/instruments/${encodeURIComponent(symbol)}`, "PATCH", { source_override });

// No-egress state (ND-3): under privacy_mode, refresh makes zero outbound calls — the page shows an
// honest "refresh unavailable — no-egress is on" state rather than a dead button.
const TRUTHY = new Set(["1", "true", "yes", "on"]);
export const getNoEgress = async (): Promise<boolean> => {
  const r = await apiGet<{ stored?: Record<string, string> }>("/settings");
  return r.ok ? TRUTHY.has((r.data.stored?.privacy_mode ?? "").toLowerCase()) : false;
};

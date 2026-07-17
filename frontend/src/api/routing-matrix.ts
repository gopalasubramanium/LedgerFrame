// Routing matrix (R-38; data-feed-routing §9-11) readers/writers for the Settings → Data feeds
// editor. Every value shown is a SERVED display string (D-005/D-105): the frontend computes NO
// routing decision — capability facts and the honest edit-time reason both come from the backend.
// Writes go through the canonical /system/routing-matrix endpoints (require_auth); on a capability
// mismatch the PUT returns an honest 400 whose reason is rendered verbatim (§9-3), never swallowed.
import { apiGet, apiSend } from "./client";

/** One stored cell, with the served display state (degraded/caveat) matrix_cell_state computes
 *  (a persisted-but-now-incapable cell is shown degraded with the honest reason — never removed). */
export interface RoutingCell {
  asset_class: string;
  listing_country: string; // ISO-3166 alpha-2 or "*"
  provider: string;
  degraded: boolean;
  caveat: string | null;
  updated_at: string | null;
}

export async function getRoutingMatrix(): Promise<{ cells: RoutingCell[] } | null> {
  const r = await apiGet<{ cells: RoutingCell[] }>("/system/routing-matrix");
  return r.ok ? r.data : null;
}

/** Upsert one cell. `require_auth`. A capability mismatch is an honest 400 → `{ok:false, error}`
 *  carrying the server's exact reason (e.g. "kite doesn't cover US"); a capable-but-unkeyed
 *  provider is ACCEPTED (`{ok:true}`) and comes back with `cell.degraded` + the caveat (§9-7). */
export async function putRoutingCell(
  cell: { asset_class: string; listing_country: string; provider: string },
): Promise<{ ok: true; cell: RoutingCell } | { ok: false; error: string }> {
  const r = await apiSend<{ ok?: boolean; cell: RoutingCell }>("/system/routing-matrix", "PUT", cell);
  return r.ok ? { ok: true, cell: r.data.cell } : { ok: false, error: r.error };
}

/** Clear a cell → routing falls back to the lane chain / active provider (§9-2). Idempotent. */
export async function deleteRoutingCell(
  asset_class: string, listing_country: string,
): Promise<{ ok: true; deleted: boolean } | { ok: false; error: string }> {
  const r = await apiSend<{ ok?: boolean; deleted?: boolean }>(
    `/system/routing-matrix/${encodeURIComponent(asset_class)}/${encodeURIComponent(listing_country)}`,
    "DELETE",
  );
  return r.ok ? { ok: true, deleted: !!r.data.deleted } : { ok: false, error: r.error };
}

// --- Served provider capabilities (read-only; the source of the market vocab + provider list) ----
// /system/providers already serves each provider's declared class/region coverage (no secrets).
// The editor reads it to build its SERVED option lists — the market vocab (§9-5: the router's own
// ISO alpha-2 region vocab + "*", NOT the D-083 six-bucket display model) and the provider list.
// It is NOT used to pre-decide validity: the authoritative gate is the edit-time 400 (§9-3).
export interface ProviderCapability {
  asset_classes: string[];
  regions: string[];
  needs_key: boolean;
}
export interface ProvidersResp {
  active: string;
  capabilities: Record<string, ProviderCapability>;
  default_priority: Record<string, string[]>;
}

export async function getProviders(): Promise<ProvidersResp | null> {
  const r = await apiGet<ProvidersResp>("/system/providers");
  return r.ok ? r.data : null;
}

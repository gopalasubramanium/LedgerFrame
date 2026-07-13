import { apiGet } from "./client";

// Home (Overview-group landing page) — page-home §3a. Home OWNS NOTHING: every figure is a linked
// summary of the page that owns it, read from that page's canonical reader (P-1/D-038). There is no
// Home aggregate endpoint: `/dashboard/home` was RETIRED (§9-4) precisely so each card reads its own
// canonical reader and loads progressively — an aggregate is a single gate.
//
// This module carries ONLY Home's own preference (the served setting), not any figure.
//
// There is NO layout preference. §12ho1-6 removed the Simple layout: Home has ONE composition (the
// ratified grid, §12ho1-5), so `home_layout` was retired from the contract rather than left behind
// as a key nothing consumes (D-078).

export type HomeQuoteSource = "markets" | "holdings" | "global" | "watchlist";

interface SettingsShape {
  stored?: Record<string, string>;
  defaults?: Record<string, unknown>;
}

/**
 * The SERVED quote-card source (§9-7): the stored value when the owner has set one, else the SERVED
 * default — the frontend never invents a source, and carries no copy of the vocabulary (D-005).
 * Server-persisted, so a kiosk survives a browser wipe (D-078).
 *
 * `null` means the settings reader is unreachable. Home does NOT hold the page on that: the source
 * decides only WHICH quotes one card shows, so an unreachable settings reader must not blank a page
 * whose other cards are fine — that card says so itself. (This reader used to gate the entire page,
 * because it also carried the LAYOUT, and a page cannot render a composition it does not know. With
 * one layout, there is nothing to wait for.)
 */
export async function getHomeQuoteSource(): Promise<HomeQuoteSource | null> {
  const r = await apiGet<SettingsShape>("/settings");
  if (!r.ok) return null;
  const stored = r.data.stored ?? {};
  const defaults = (r.data.defaults ?? {}) as Record<string, string | undefined>;
  return (stored.home_quote_source ?? defaults.home_quote_source ?? null) as HomeQuoteSource | null;
}

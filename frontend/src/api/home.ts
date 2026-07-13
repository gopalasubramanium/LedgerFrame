import { apiGet } from "./client";

// Home (Overview-group landing page) — page-home §3a. Home OWNS NOTHING: every figure is a linked
// summary of the page that owns it, read from that page's canonical reader (P-1/D-038). There is no
// Home aggregate endpoint: `/dashboard/home` was RETIRED (§9-4) precisely so each card reads its own
// canonical reader and loads progressively — an aggregate is a single gate.
//
// This module carries ONLY Home's own preferences (the served settings), not any figure.

/** page-home §9-1: the ratified vocabulary is Simple / Full ("Expert" was RETIRED). */
export type HomeLayout = "simple" | "full";
export type HomeQuoteSource = "markets" | "holdings" | "global" | "watchlist";

export interface HomePrefs {
  layout: HomeLayout;
  quoteSource: HomeQuoteSource;
}

interface SettingsShape {
  stored?: Record<string, string>;
  defaults?: Record<string, unknown>;
}

/**
 * The SERVED Home preferences (§9-3/§9-7): the stored value when the owner has set one, else the
 * SERVED default — the frontend never invents a layout or a source of its own. Server-persisted, so
 * a kiosk survives a browser wipe and rotation lands on the configured layout (D-078/D-040).
 *
 * §9-2a: there is no user-facing switch until Settings ships; the layout is read here and honoured.
 */
export async function getHomePrefs(): Promise<HomePrefs | null> {
  const r = await apiGet<SettingsShape>("/settings");
  if (!r.ok) return null; // the reader is unreachable — say so; never invent a layout
  const stored = r.data.stored ?? {};
  const defaults = (r.data.defaults ?? {}) as Record<string, string | undefined>;
  const layout = (stored.home_layout ?? defaults.home_layout) as HomeLayout;
  const source = (stored.home_quote_source ?? defaults.home_quote_source) as HomeQuoteSource;
  return { layout, quoteSource: source };
}

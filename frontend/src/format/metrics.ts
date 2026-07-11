import type { PortfolioStats, StatMetric } from "../api/portfolio";
import type { Sign } from "./number";
import { formatMoney, formatSignedMoney, signOf } from "./number";

// Shared helpers for rendering a SERVED `/portfolio/stats` metric (Portfolio + Net worth).
// Every value is a served display string — no client money math (P-1/D-031).

/** Find a served metric by its exact served label (D-005 — never invent a label). */
export function metric(stats: PortfolioStats | null | undefined, label: string): StatMetric | undefined {
  return stats?.metrics?.find((m) => m.label === label);
}

/** Gain/loss tone from a signed metric's SERVED value (no client math). Magnitude-only metrics
 *  (e.g. volatility) must NOT be passed through this — they stay neutral. */
export function metricTone(m: StatMetric | undefined): Sign | undefined {
  return m && m.value != null ? signOf(m.value) : undefined;
}

/** Display a served metric per its kind. Rounds for display only (never a long unbreakable number). */
export function metricDisplay(m: StatMetric | undefined): string {
  if (!m || m.value == null) return "—";
  if (m.kind === "money") return m.signed ? formatSignedMoney(m.value) : formatMoney(m.value);
  if (m.kind === "pct") return `${Number(m.value).toFixed(2)}%`;
  if (m.kind === "ratio") return Number(m.value).toFixed(2);
  if (m.kind === "count") return String(m.value);
  return String(m.value);
}

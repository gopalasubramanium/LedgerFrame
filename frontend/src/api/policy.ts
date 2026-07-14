import { apiGet, apiSend } from "./client";

// Policy readers/writers — page-policy §3a. Canonical home for investment-policy INTENT and DRIFT
// (computed live, never stored — D-055). Review SUMMARISES this page's drift via the SAME backend
// reader (`compute_drift`), so the two can never disagree (D-038, by construction).
//
// Every money figure arrives as a SERVED display string (`*_display`, D-105) and is rendered
// verbatim — the frontend formats no money. Percentages are served as numbers and formatted here.
//
// Drift REPORTS A GAP. It never names or implies a trade (D-055, protected).

export interface PolicyTarget {
  dimension: string;
  bucket: string;
  target_pct: number;
  min_pct: number | null;
  max_pct: number | null;
}
export interface PolicyResp {
  name: string;
  base_currency: string | null;
  default_band_pct: number;
  max_position_pct: number | null;
  notes: string | null;
  targets: PolicyTarget[];
}

export interface DriftRow {
  bucket: string;
  target_pct: number;
  actual_pct: number;
  drift_pct: number;
  lower_pct: number;
  upper_pct: number;
  status: string; // served: in_band | over | under
  gap_base: number;
  gap_base_display: string; // D-105
  actual_value: number;
  actual_value_display: string;
}
export interface DriftUntargeted {
  bucket: string;
  actual_pct: number;
  actual_value: number;
  actual_value_display: string;
}
export interface DriftDimension {
  dimension: string;
  coverage_pct: number;
  rows: DriftRow[];
  untargeted: DriftUntargeted[];
}
export interface ConcentrationRow {
  label: string;
  symbol: string | null; // nullable — a manual asset has no symbol (§9-17); never a guessed route
  weight_pct: number;
  limit_pct: number;
  value: number;
  value_display: string;
}
export interface DriftResp {
  base_currency: string;
  /** The denominator every weight is OF. `total_value` (NET) is deliberately NOT served (§9-3). */
  gross_assets: number;
  gross_assets_display: string;
  has_targets: boolean;
  max_position_pct: number | null;
  dimensions: DriftDimension[];
  concentration: ConcentrationRow[];
  // A10 — a verdict off stale/low-confidence prices can never present as fresh.
  stale_inputs: number;
  low_confidence_inputs: number;
  inputs_stale: boolean;
  inputs_note: string | null;
  disclaimer: string;
}

export const fetchPolicy = () => apiGet<PolicyResp>("/policy");
export const fetchDrift = () => apiGet<DriftResp>("/policy/drift");

export interface PolicyMetaIn {
  name?: string;
  base_currency?: string | null;
  default_band_pct?: number;
  max_position_pct?: number | null;
  notes?: string | null;
}

/** [S]-gated (ambient PIN session, D-103 — no second prompt on save). */
export const savePolicyMeta = (body: PolicyMetaIn) => apiSend<PolicyResp>("/policy", "PUT", body);

/**
 * BULK REPLACE (§9-2) — the whole target set, atomically. There is deliberately no per-row
 * endpoint, so the editor always sends the COMPLETE set: dropping a row here would delete it.
 */
export const saveTargets = (targets: Omit<PolicyTarget, never>[]) =>
  apiSend<PolicyResp>("/policy/targets", "PUT", { targets });

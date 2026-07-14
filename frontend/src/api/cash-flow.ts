import { apiGet, apiSend } from "./client";

// Cash flow readers/writers — page-cash-flow §3a. Canonical home for Goals, Obligations and
// Contributions (D-056/D-057). PER-ROW CRUD (POST / PATCH /{id} / DELETE /{id}), PIN-gated —
// the endpoint evidence, NOT Policy's bulk-replace shape (§9-2).
//
// Every money figure arrives as a SERVED display string (`*_display`, D-105) and is rendered
// verbatim: the frontend formats and computes NO money. `null` means "no such figure" — it renders
// as an em dash, never as a fabricated 0 (Guarantee 3).
//
// §0-PROTECTED (D-057): contributions NEVER reduce the runway; `once` obligations are excluded from
// recurring net burn. Both are pinned by backend tests (tests/integration/test_d057_protected.py).

export interface Goal {
  id: number;
  name: string;
  basis: string;                       // net_worth | liquid | none  (served vocabulary)
  currency: string;
  target_amount: number;
  target_amount_display: string;
  target_base: number;
  target_base_display: string;
  target_date: string | null;
  note: string | null;
  /** null when the goal has NO basis — a goal without a basis is not a goal at 0%. */
  current_base: number | null;
  current_base_display: string | null;
  progress_pct: number | null;         // a PERCENTAGE is not money: it stays a number
  remaining_base: number | null;
  remaining_base_display: string | null;
  days_to_target: number | null;
}
export interface GoalsResp {
  base_currency: string;
  goals: Goal[];
  disclaimer: string;
}

export interface Obligation {
  id: number;
  name: string;
  amount: number;
  amount_display: string;
  currency: string;
  amount_base: number;
  amount_base_display: string;
  /** null for a `once` obligation — a one-off has NO monthly rate (D-057). Never 0. */
  monthly_equivalent: number | null;
  monthly_equivalent_display: string | null;
  due_date: string;
  recurrence: string;                  // once | monthly | quarterly | annual
  kind: string;                        // expense | income  (income is a FLAGGED obligation)
  note: string | null;
  occurrences_12m: number;
  next_due: string;
}
export interface ObligationsResp {
  base_currency: string;
  obligations: Obligation[];
  next_12m_total: number;
  next_12m_total_display: string;
  disclaimer: string;
}

export interface Contribution {
  id: number;
  name: string;
  amount: number;
  amount_display: string;
  currency: string;
  frequency: string;                   // monthly | quarterly | annual | once
  kind: string;                        // invest | withdraw | prepay
  target_goal_id: number | null;       // a SOFT link — the goal may be gone (renders "—")
  monthly_equivalent: number | null;   // null for `once`
  monthly_equivalent_display: string | null;
  start_date: string | null;
  active: boolean;
  note: string | null;
}
export interface ContributionsResp {
  base_currency: string;
  contributions: Contribution[];
  monthly_invest: number;
  monthly_invest_display: string;
  monthly_withdraw: number;
  monthly_withdraw_display: string;
  monthly_net_investing: number;
  monthly_net_investing_display: string;
  monthly_cash_out_with_expenses: number;
  monthly_cash_out_with_expenses_display: string;
  disclaimer: string;
}

/** Net worth's canonical runway reader (D-036). This page SUMMARISES it — it never recomputes it. */
export interface RunwayResp {
  base_currency: string;
  liquid: number;
  liquid_display: string;
  monthly_expense: number;
  monthly_expense_display: string;
  monthly_income: number;
  monthly_income_display: string;
  net_monthly_burn: number;
  net_monthly_burn_display: string;
  runway_months: number | null;
  runway_date: string | null;
  status: string;                      // no_data | positive | finite
  note: string;
  disclaimer: string;
}

export const fetchGoals = () => apiGet<GoalsResp>("/goals");
export const fetchObligations = () => apiGet<ObligationsResp>("/obligations");
export const fetchContributions = () => apiGet<ContributionsResp>("/contributions");
export const fetchRunway = () => apiGet<RunwayResp>("/portfolio/runway");

// --- writes ([S]-gated; ambient PIN session, D-103 — no second prompt on save or delete) ------- //

export interface GoalIn {
  name: string;
  target_amount: number;
  target_date?: string | null;
  currency?: string | null;
  basis: string;
  note?: string | null;
}
export interface ObligationIn {
  name: string;
  amount: number;
  due_date: string;
  currency?: string | null;
  recurrence: string;
  kind: string;
  note?: string | null;
}
export interface ContributionIn {
  name: string;
  amount: number;
  currency?: string | null;
  frequency: string;
  kind: string;
  target_goal_id?: number | null;
  start_date?: string | null;
  active: boolean;
  note?: string | null;
}

export const createGoal = (b: GoalIn) => apiSend<{ id: number }>("/goals", "POST", b);
export const updateGoal = (id: number, b: GoalIn) => apiSend<{ id: number }>(`/goals/${id}`, "PATCH", b);
export const deleteGoal = (id: number) => apiSend<{ ok: boolean }>(`/goals/${id}`, "DELETE");

export const createObligation = (b: ObligationIn) => apiSend<{ id: number }>("/obligations", "POST", b);
export const updateObligation = (id: number, b: ObligationIn) =>
  apiSend<{ id: number }>(`/obligations/${id}`, "PATCH", b);
export const deleteObligation = (id: number) => apiSend<{ ok: boolean }>(`/obligations/${id}`, "DELETE");

export const createContribution = (b: ContributionIn) => apiSend<{ ok: boolean }>("/contributions", "POST", b);
export const updateContribution = (id: number, b: ContributionIn) =>
  apiSend<{ ok: boolean }>(`/contributions/${id}`, "PATCH", b);
export const deleteContribution = (id: number) => apiSend<{ ok: boolean }>(`/contributions/${id}`, "DELETE");

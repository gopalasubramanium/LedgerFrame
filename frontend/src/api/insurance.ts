import { apiGet, apiSend } from "./client";

// Insurance — the protection register (IA §5, D-039/D-062). Worklist CRUD on the Cash flow pattern:
// GET /insurance + per-row POST / PATCH /{id} / DELETE /{id}, [S]-gated by the served route (ambient
// PIN session, D-103 — no second prompt).
//
// Every money figure arrives as a SERVED display string (`*_display`, D-105) and is rendered verbatim:
// the frontend formats and computes NO money. Non-base currencies carry their code (`USD 500,000.00`,
// §12in-1). `null` means "no such figure" → an em dash, never a fabricated 0 (Guarantee 3 / §12in-4).
//
// Renewal `state` (overdue / soon / upcoming) is SERVED (§12in-3): the frontend renders it verbatim and
// holds NO day-threshold constant. `count` is ACTIVE policies only (§9-10).

export interface DocumentItem {
  label: string;
  have: boolean;
}

export interface Policy {
  id: number;
  name: string;
  insurer: string | null;
  policy_type: string;
  policy_type_label: string; // display-cased at the backend boundary (§9-12) — rendered verbatim
  policy_number: string | null;
  insured_person: string | null;
  cover_amount: number;
  cover_amount_display: string | null;
  currency: string;
  cash_value: number | null;
  cash_value_display: string | null;
  premium: number | null;
  premium_display: string | null;
  premium_frequency: string;
  start_date: string | null;
  renewal_date: string | null;
  nominee: string | null;
  linked_goal_id: number | null; // served, but NOT surfaced in the editor (§9-9)
  documents: DocumentItem[];
  notes: string | null;
  status: string; // active | lapsed | expired (served vocabulary)
}

export interface CoverByType {
  type: string;
  label: string; // display-cased at the backend boundary (§9-12) — rendered verbatim
  value: number;
  value_display: string;
}

export type RenewalState = "overdue" | "soon" | "upcoming";
export interface UpcomingRenewal {
  id: number;
  name: string;
  renewal_date: string;
  days: number;
  state: RenewalState; // served (§12in-3) — no client threshold
}

export interface InsuranceResp {
  base_currency: string;
  policies: Policy[];
  count: number; // ACTIVE policies only (§9-10)
  total_cover: number;
  total_cover_display: string | null;
  total_cash_value: number;
  total_cash_value_display: string | null;
  total_annual_premium: number;
  total_annual_premium_display: string | null;
  cover_by_type: CoverByType[];
  upcoming_renewals: UpcomingRenewal[];
  document_defaults: string[]; // seed content for a NEW policy's checklist (§9-8) — not a vocabulary
  disclaimer: string; // served copy incl. the two exclusion sentences (§12in-2)
}

// Write body — mirrors PolicyIn (routes/insurance.py). `linked_goal_id` is intentionally omitted (§9-9).
export interface PolicyIn {
  name: string;
  insurer?: string | null;
  policy_type: string;
  policy_number?: string | null;
  insured_person?: string | null;
  cover_amount?: number | null;
  currency?: string | null;
  cash_value?: number | null;
  premium?: number | null;
  premium_frequency: string;
  start_date?: string | null;
  renewal_date?: string | null;
  nominee?: string | null;
  documents?: DocumentItem[] | null;
  notes?: string | null;
  status: string;
}

export const fetchInsurance = () => apiGet<InsuranceResp>("/insurance");
export const createPolicy = (b: PolicyIn) => apiSend<{ ok: boolean; id: number }>("/insurance", "POST", b);
export const updatePolicy = (id: number, b: PolicyIn) =>
  apiSend<{ ok: boolean; id: number }>(`/insurance/${id}`, "PATCH", b);
export const deletePolicy = (id: number) => apiSend<{ ok: boolean }>(`/insurance/${id}`, "DELETE");

import { apiGet, apiSend } from "./client";

// Accounts domain — page-accounts §3. Canonical home for Account CRUD (institution from the
// master, kind + cost-basis method from /refdata, currency, entity assignment), Entity CRUD
// (D-065), and the Institution master (D-008 — the first user-extensible master-with-CRUD).
// PER-ROW CRUD, [S]-gated (ambient PIN session, D-103 — no second prompt on save/delete).
//
// Money on this page is ALWAYS a backend-served display string (D-105); the frontend renders
// `value_display` / `total_display` verbatim and computes no financial value. Categoricals are
// rendered from the SERVED /refdata `{value,label}` label (§12es-3), never a client-side map.
// `institution` (and insurance `insurer`) are sent/received as free-text NAME strings — the
// write path resolves-or-creates the master row (Amendment F), never an id.

// --- GET /accounts — the per-account rollup (money reader; NO entity_id — join /accounts/list) --- //
export interface AccountReport {
  id: number | null; // null = the "account-less holdings" bucket (holdings with no account_id)
  name: string;
  institution: string | null;
  kind: string;
  currency: string;
  cost_basis_method: string;
  value: number;
  value_display: string; // base-currency rollup, served (D-105) — rendered verbatim
  holdings: number;
  asset_classes: string[];
  currencies: string[];
  stale: number;
  low_confidence: number;
  last_activity: string | null; // latest recorded transaction date — the "has history" proxy (§9-5)
}
export interface AccountsReport {
  base_currency: string; // the SERVED base — the Value column header reads Value ({base_currency}) (§12ac-1)
  total: number;
  total_display: string;
  count: number;
  accounts: AccountReport[];
  disclaimer: string;
}
export const fetchAccounts = () => apiGet<AccountsReport>("/accounts");

// --- GET /accounts/list — editable attributes incl. entity_id (the rollup reader omits it) ------- //
export interface AccountListRow {
  id: number;
  name: string;
  institution: string | null;
  kind: string;
  currency: string;
  entity_id: number | null;
  cost_basis_method: string;
}
export const fetchAccountList = () => apiGet<{ accounts: AccountListRow[]; kinds: string[] }>("/accounts/list");

// --- writes ([S]-gated) ------------------------------------------------------------------------- //
export interface AccountIn {
  name: string;
  institution?: string | null; // NAME (resolve-or-create into the master), never an id
  kind?: string;
  currency?: string | null;
  entity_id?: number | null;
  cost_basis_method?: string | null;
}
// PATCH returns `restatement` only when the cost-basis method actually changed on an account with
// transactions (§9-5) — the backend rebuilt the holdings; the UI already warned before the PATCH.
export interface AccountWriteResult {
  ok: boolean;
  id?: number;
  name?: string;
  restatement?: string;
}
export const createAccount = (b: AccountIn) => apiSend<AccountWriteResult>("/accounts", "POST", b);
export const updateAccount = (id: number, b: AccountIn) =>
  apiSend<AccountWriteResult>(`/accounts/${id}`, "PATCH", b);
export const deleteAccount = (id: number) => apiSend<{ ok: boolean }>(`/accounts/${id}`, "DELETE");

// --- entities (D-065) --------------------------------------------------------------------------- //
export interface EntityRow {
  id: number;
  name: string;
  kind: string; // entity_kind vocab (Amendment H) — rendered from the served /refdata label
}
export const fetchEntities = () => apiGet<{ entities: EntityRow[] }>("/entities");

export interface EntityIn {
  name: string;
  kind?: string | null;
}
export const createEntity = (b: EntityIn) =>
  apiSend<{ ok: boolean; id: number; name: string; kind: string }>("/entities", "POST", b);
export const updateEntity = (id: number, b: EntityIn) =>
  apiSend<{ ok: boolean; id: number; name: string; kind: string }>(`/entities/${id}`, "PATCH", b);
export const deleteEntity = (id: number) => apiSend<{ ok: boolean }>(`/entities/${id}`, "DELETE");

// --- institution master (D-008) ----------------------------------------------------------------- //
export interface InstitutionRow {
  id: number;
  name: string;
  account_count: number; // SERVED referenced-by counts (§12-1) — drive the card + the merge consequence
  policy_count: number;
}
export const fetchInstitutions = () => apiGet<{ institutions: InstitutionRow[] }>("/institutions");
export const createInstitution = (name: string) =>
  apiSend<{ ok: boolean; id: number; name: string }>("/institutions", "POST", { name });
export const renameInstitution = (id: number, name: string) =>
  apiSend<{ ok: boolean; id: number; name: string }>(`/institutions/${id}`, "PATCH", { name });
export const deleteInstitution = (id: number) => apiSend<{ ok: boolean }>(`/institutions/${id}`, "DELETE");

export interface MergeResult {
  ok: boolean;
  survivor_id: number;
  duplicate_id: number;
  survivor_name: string;
  repointed: number;
}
export const mergeInstitutions = (survivor_id: number, duplicate_id: number) =>
  apiSend<MergeResult>("/institutions/merge", "POST", { survivor_id, duplicate_id });

// Holdings-page API surface (page-holdings.md §3). Types mirror the backend
// responses (holdings response is contract-typed as of Phase 0b, §9-6).
import { apiGet, apiSend, apiUpload } from "./client";
import type { Result } from "./client";

export interface HoldingRow {
  id: number;
  label?: string | null;
  name?: string | null;
  symbol?: string | null;
  asset_class?: string | null;
  quantity?: number | null;
  currency?: string | null;
  price?: number | null;
  market_value?: number | null;
  cost_basis?: number | null;
  unrealised_pl?: number | null;
  day_change?: number | null;
  day_change_pct?: number | null;
  is_stale: boolean;
  is_priced: boolean;
  valuation_method?: string | null;
  valuation_label?: string | null;
}
export interface HoldingsResponse {
  base_currency: string;
  holdings: HoldingRow[];
}

export interface SummaryResponse {
  base_currency: string;
  total_value?: number | null;
  cost_basis?: number | null;
  unrealised_pl?: number | null;
  day_change?: number | null;
  total_return_pct?: number | null;
  has_stale?: boolean;
}

export interface TransactionRow {
  id: number;
  account_id?: number | null;
  symbol?: string | null;
  type: string;
  ts: string;
  quantity?: number | null;
  price?: number | null;
  fees?: number | null;
  taxes?: number | null;
  amount?: number | null;
  currency: string;
  note?: string | null;
  related_instrument_id?: number | null;
}

export interface TransactionIn {
  account_id?: number | null;
  symbol?: string | null;
  type: string;
  ts: string;
  quantity?: number;
  price?: number;
  fees?: number;
  taxes?: number;
  currency?: string;
  note?: string | null;
  asset_class?: string | null;
  related_instrument_id?: number | null;
}

export interface ManualHoldingIn {
  account_id?: number | null;
  label: string;
  asset_class: string;
  value: number;
  currency?: string;
}

export interface AccountRow {
  id: number;
  name: string;
  institution?: string | null;
  currency?: string | null;
}

export interface ImportRow {
  row: number;
  ok: boolean;
  error?: string | null;
  duplicate?: boolean;
  date?: string;
  type?: string;
  symbol?: string;
  quantity?: string;
  price?: string;
  fees?: string;
  taxes?: string;
  currency?: string;
  note?: string;
  asset_class?: string;
  country?: string;
  [k: string]: unknown;
}
export interface ImportPreview {
  batch?: string;
  already_imported?: boolean;
  summary?: { total: number; valid: number; errors: number; duplicates: number; new: number };
  rows: ImportRow[];
}

export interface DeletedCount { holdings: number; transactions: number; total: number; }
export const getDeletedCount = () => apiGet<DeletedCount>("/portfolio/deleted-count");

export const getHoldings = () => apiGet<HoldingsResponse>("/portfolio/holdings");
export const getSummary = () => apiGet<SummaryResponse>("/portfolio/summary");
export const getTransactions = () =>
  apiGet<{ transactions: TransactionRow[] }>("/portfolio/transactions");
export const getAccounts = () => apiGet<{ accounts: AccountRow[] }>("/accounts");
export const getTags = () => apiGet<{ tags: string[] }>("/portfolio/tags");

export const addTransaction = (t: TransactionIn) =>
  apiSend<{ ok: boolean; transaction_id: number }>("/portfolio/transactions", "POST", t);
export const updateTransaction = (id: number, t: TransactionIn) =>
  apiSend<{ ok: boolean }>(`/portfolio/transactions/${id}`, "PUT", t);
export const deleteTransaction = (id: number) =>
  apiSend<{ ok: boolean }>(`/portfolio/transactions/${id}`, "DELETE");
export const restoreTransaction = (id: number) =>
  apiSend<{ ok: boolean }>(`/portfolio/transactions/${id}/restore`, "POST");

export const addManualHolding = (m: ManualHoldingIn) =>
  apiSend<{ ok: boolean }>("/portfolio/manual-holdings", "POST", m);
export const deleteManualHolding = (id: number) =>
  apiSend<{ ok: boolean }>(`/portfolio/manual-holdings/${id}`, "DELETE");
export const restoreManualHolding = (id: number) =>
  apiSend<{ ok: boolean }>(`/portfolio/manual-holdings/${id}/restore`, "POST");

export const purgeDeleted = (): Promise<Result<{ ok: boolean }>> =>
  apiSend<{ ok: boolean }>("/portfolio/purge-deleted", "POST");

export const setHoldingTags = (id: number, tags: string[]) =>
  apiSend<{ ok: boolean }>(`/portfolio/holdings/${id}/tags`, "PUT", { tags });

export const importPreview = (file: File) =>
  apiUpload<ImportPreview>("/portfolio/import/preview", file);
export const importCommit = (file: File) =>
  apiUpload<{ ok: boolean; imported?: number }>("/portfolio/import/commit", file);

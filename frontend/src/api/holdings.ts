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
  // D-105 served display string for the QUOTE price (class-appropriate precision) — rendered verbatim.
  price_display?: string | null;
  market_value?: number | null;
  // §12hm1-1 served display strings (D-105 posture — rendered verbatim, the frontend formats
  // nothing). Null when the figure does not exist: shown as "—" + a reason, never fabricated.
  market_value_display?: string | null;
  cost_basis?: number | null;
  unrealised_pl?: number | null;
  day_change?: number | null;
  day_change_pct?: number | null;
  day_change_pct_display?: string | null;
  is_stale: boolean;
  price_ts?: string | null; // as-of ISO timestamp (null when unpriced)
  is_priced: boolean;
  valuation_method?: string | null;
  valuation_label?: string | null;
  country?: string | null; // ISO-3166 alpha-2 listing country (null when unknown)
  region?: string | null; // D-083 six-bucket region, server-derived (page-heatmap ND-8)
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
  // D-091 per-class OPTIONAL-PROMPTED detail; only whitelisted keys are persisted
  // (backend `_META_KEYS`). Values are short strings.
  meta?: Record<string, string>;
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
  // Set when the file is the wrong format entirely (e.g. a holdings snapshot, not a
  // transactions ledger) — one honest message instead of per-row garbage.
  format_error?: string;
  summary?: { total: number; valid: number; errors: number; duplicates: number; new: number };
  rows: ImportRow[];
}

export interface DeletedCount { holdings: number; transactions: number; total: number; }
export const getDeletedCount = () => apiGet<DeletedCount>("/portfolio/deleted-count");

// Amendment G (page-accounts §9-11): the Accounts page's "View holdings" drills down via
// ?account= → this SCOPED reader (filter-not-recompute, the canonical value_portfolio output
// filtered to one account_id). Unscoped when accountId is omitted.
export const getHoldings = (accountId?: number | null) =>
  apiGet<HoldingsResponse>(
    accountId != null ? `/portfolio/holdings?account_id=${accountId}` : "/portfolio/holdings",
  );
export const getSummary = () => apiGet<SummaryResponse>("/portfolio/summary");

// D-094 — the transactions ledger is windowed; sort/filter/paging run SERVER-SIDE
// over the full dataset. `total` is the honest denominator so the UI can state
// "Showing X–Y of Z" and never silently truncate.
export interface TransactionsQuery {
  limit?: number;
  offset?: number;
  sort?: string;
  dir?: "asc" | "desc";
  filter?: string;
  accountId?: number | null; // §14ac-3 (Amendment G): scope the ledger to one account
}
export interface TransactionsResponse {
  transactions: TransactionRow[];
  total: number;
  offset: number;
  limit: number;
  sort: string;
  dir: "asc" | "desc";
  filter: string;
}
export const getTransactions = (q: TransactionsQuery = {}) => {
  const p = new URLSearchParams();
  if (q.limit != null) p.set("limit", String(q.limit));
  if (q.offset != null) p.set("offset", String(q.offset));
  if (q.sort) p.set("sort", q.sort);
  if (q.dir) p.set("dir", q.dir);
  if (q.filter) p.set("filter", q.filter);
  if (q.accountId != null) p.set("account_id", String(q.accountId));
  const qs = p.toString();
  return apiGet<TransactionsResponse>(`/portfolio/transactions${qs ? `?${qs}` : ""}`);
};
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
  apiUpload<{ ok: boolean; imported?: number; skipped_duplicates?: number }>(
    "/portfolio/import/commit",
    file,
  );

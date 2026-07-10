import { createContext, useContext } from "react";

// Fixed vocabularies from GET /refdata (D-005) — the canonical source of vocab
// VALUES. Null until loaded (or if the fetch fails); consumers fall back to the
// labelled registry so the UI degrades gracefully offline.
export type Vocabs = Record<string, string[]>;

// D-090 — per-AssetClass → offered TxnTypes for the Add-flow Type dropdown, from
// GET /refdata/txn-applicability (MASTER-DATA §10). The frontend carries no copy
// of the matrix; null until loaded (no filtering applied while null → show all).
export type TxnApplicability = Record<string, string[]>;

export interface RefdataValue {
  vocabs: Vocabs | null;
  txnApplicability: TxnApplicability | null;
}

export const RefdataContext = createContext<RefdataValue>({
  vocabs: null,
  txnApplicability: null,
});

export function useRefdataVocabs(): Vocabs | null {
  return useContext(RefdataContext).vocabs;
}

export function useTxnApplicability(): TxnApplicability | null {
  return useContext(RefdataContext).txnApplicability;
}

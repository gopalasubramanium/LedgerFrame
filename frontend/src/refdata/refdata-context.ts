import { createContext, useContext } from "react";
import { humanize } from "../mocks/refdata";

// Fixed vocabularies from GET /refdata (D-005) — the canonical source of vocab
// VALUES *and* their DISPLAY LABELS (item 3b: labels are served, never hardcoded).
// Null until loaded (or if the fetch fails); consumers fall back to the labelled
// registry so the UI degrades gracefully offline.
export interface RefOption { value: string; label: string }
export type Vocabs = Record<string, RefOption[]>;

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

// Resolve a value to its SERVED display label (item 3b). Falls back to a humanized
// value when the vocab/label hasn't loaded — never renders a raw enum where a label
// exists. Returns "—" for empty values.
export function useLabelFor(): (vocab: string, value: string | null | undefined) => string {
  const vocabs = useContext(RefdataContext).vocabs;
  return (vocab, value) => {
    if (value == null || value === "") return "—";
    const opt = vocabs?.[vocab]?.find((o) => o.value === value);
    return opt?.label ?? humanize(value);
  };
}

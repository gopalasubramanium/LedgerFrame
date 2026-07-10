import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { apiGet } from "../api/client";
import { RefdataContext } from "./refdata-context";
import type { TxnApplicability, Vocabs } from "./refdata-context";

// Fetches GET /refdata + GET /refdata/txn-applicability once and provides them to
// consumers (D-005 — the frontend carries no vocabulary or matrix of its own).
// On failure a value stays null: MasterSelect falls back to the labelled registry,
// and the Add-flow Type filter applies no restriction (shows all types).
export function RefdataProvider({ children }: { children: ReactNode }) {
  const [vocabs, setVocabs] = useState<Vocabs | null>(null);
  const [txnApplicability, setTxnApplicability] = useState<TxnApplicability | null>(null);

  useEffect(() => {
    let live = true;
    apiGet<Vocabs>("/refdata").then((r) => {
      if (live && r.ok) setVocabs(r.data);
    });
    apiGet<TxnApplicability>("/refdata/txn-applicability").then((r) => {
      if (live && r.ok) setTxnApplicability(r.data);
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <RefdataContext.Provider value={{ vocabs, txnApplicability }}>
      {children}
    </RefdataContext.Provider>
  );
}

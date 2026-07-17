// SPDX-License-Identifier: AGPL-3.0-or-later
import { Link } from "react-router-dom";
import "./InstrumentLabel.css";

// §14dr-19 (owner reversal of dr-16): the ONE symbol+name display pattern, symbol
// prominent + name secondary — promoted from the Holdings identity subtext so every
// surface (Portfolio movers/attribution, Home movers/gainers-losers, Transactions)
// renders it identically, never a per-instance copy. Name is hidden when it is null
// or equals the symbol (the served payloads already null it in that case). A
// composition of a Link + spans, not a new ui/ primitive.
export function InstrumentLabel({
  symbol,
  name,
  fallback,
  link = true,
  truncate = false,
}: {
  symbol?: string | null;
  name?: string | null;
  fallback?: string | null;
  link?: boolean;
  // §14dr-22: dense consumers (Home/Portfolio movers, table cells) set truncate so the
  // sym+name ellipsize within a bounded flex parent instead of pushing the row wide; the
  // full identity rides a title tooltip. Requires the parent to allow shrink (min-width:0).
  truncate?: boolean;
}) {
  const sym = symbol || fallback || "—";
  const showName = name && name !== symbol && name !== sym;
  return (
    <span
      className={`lf-instr${truncate ? " lf-instr--truncate" : ""}`}
      title={truncate ? (showName ? `${sym} — ${name}` : sym) : undefined}
    >
      {link && symbol ? (
        <Link className="lf-instr__sym lf-instr__link" to={`/instrument/${encodeURIComponent(symbol)}`}>
          {sym}
        </Link>
      ) : (
        <span className="lf-instr__sym">{sym}</span>
      )}
      {showName && <span className="lf-instr__name">{name}</span>}
    </span>
  );
}

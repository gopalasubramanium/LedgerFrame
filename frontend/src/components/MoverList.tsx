import { useState } from "react";
import { Link } from "react-router-dom";
import { money, pct, signedMoney, toneClass } from "../lib/format";

export interface MoverItem {
  label: string;
  name?: string | null;
  symbol: string | null;
  price?: number | null;
  currency?: string;
  day_change: number;
  day_change_pct?: number | null;
  is_stale?: boolean;
}

// Compact list of movers/contributors. Three aligned columns: name · native price ·
// today's change. The change column shows percent (Δ%) by default and toggles to the
// absolute base-currency change (Δ) on click — shared by Home (Today's Movers) and
// Portfolio (Contributors). The header label always reflects which the column shows.
export function MoverList({ title, rows, ccy, max = 5 }: { title: string; rows: MoverItem[]; ccy: string; max?: number }) {
  // Percent change is the default read; click the header or any change value to
  // switch the change column to the absolute base-currency amount.
  const [showPct, setShowPct] = useState(true);
  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-x-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-faint">
        <span>{title}</span>
        <span className="text-right">Price</span>
        <button className="text-right justify-self-end hover:text-accent" title="Toggle change % / change"
          onClick={() => setShowPct((v) => !v)}>{showPct ? "Δ%" : "Δ"}</button>
      </div>
      {rows.length === 0 && <div className="text-muted text-xs">—</div>}
      <ul className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-x-3 gap-y-1 text-xs">
        {rows.slice(0, max).map((r) => (
          <li key={r.symbol || r.label} className="contents">
            {r.symbol ? (
              <Link to={`/instrument/${r.symbol}`} className="truncate hover:text-accent" title={r.name || r.label}>
                {r.name || r.label}{r.is_stale ? " ⚠" : ""}
              </Link>
            ) : (
              <span className="truncate" title={r.name || r.label}>{r.name || r.label}</span>
            )}
            <span className="tnum text-right text-muted tabular-nums">
              {r.price == null ? "—" : money(r.price, r.currency || ccy, true)}
            </span>
            <button
              className={`tnum text-right justify-self-end tabular-nums ${toneClass(r.day_change)}`}
              title="Click to toggle change % / change"
              onClick={() => setShowPct((v) => !v)}
            >
              {showPct ? pct(r.day_change_pct ?? null) : signedMoney(r.day_change, ccy)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

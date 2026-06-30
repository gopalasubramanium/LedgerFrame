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

// Compact list of movers/contributors: name · native price · today's change. The
// change column toggles between absolute (Δ) and percent (Δ%) on click — shared by
// Home (Today's Movers) and Portfolio (Contributors) for space-efficient density.
export function MoverList({ title, rows, ccy, max = 5 }: { title: string; rows: MoverItem[]; ccy: string; max?: number }) {
  // Percent change is the default read; click any value (or the header) to switch
  // to the absolute base-currency change.
  const [showPct, setShowPct] = useState(true);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs uppercase tracking-wide text-faint">{title}</span>
        <button
          className="text-[10px] font-semibold uppercase tracking-wide text-faint hover:text-accent"
          title="Toggle change % / change"
          onClick={() => setShowPct((v) => !v)}
        >
          {showPct ? "Δ%" : "Δ"}
        </button>
      </div>
      {rows.length === 0 && <div className="text-muted text-xs">—</div>}
      <ul className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2 gap-y-1 text-xs">
        {rows.slice(0, max).map((r) => (
          <li key={r.symbol || r.label} className="contents">
            {r.symbol ? (
              <Link to={`/instrument/${r.symbol}`} className="truncate hover:text-accent" title={r.name || r.label}>
                {r.name || r.label}{r.is_stale ? " ⚠" : ""}
              </Link>
            ) : (
              <span className="truncate" title={r.name || r.label}>{r.name || r.label}</span>
            )}
            <button
              className={`tnum text-right justify-self-end tabular-nums ${toneClass(r.day_change)}`}
              title={r.price != null ? `${money(r.price, r.currency || ccy, true)} · click to toggle Δ%/Δ` : "click to toggle Δ%/Δ"}
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

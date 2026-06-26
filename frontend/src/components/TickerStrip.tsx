import { Link } from "react-router-dom";
import { pct, toneClass } from "../lib/format";
import type { Quote } from "../lib/types";

// Compact scrolling-style ticker row of key quotes (indices, FX, etc.) shown
// across the top of the dashboard.
export function TickerStrip({ quotes, fx }: { quotes: Quote[]; fx: { base: string; quote: string; rate: number }[] }) {
  return (
    <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
      {quotes.map((q) => (
        <Link
          key={q.symbol}
          to={`/instrument/${q.symbol}`}
          className="shrink-0 bg-surface border border-line rounded-card px-3 py-2 hover:border-accent transition-colors"
        >
          <div className="text-xs text-faint">{q.symbol}</div>
          <div className="flex items-baseline gap-2">
            <span className="tnum text-sm text-ink">
              {q.price == null ? "—" : q.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
            <span className={`tnum text-xs ${toneClass(q.change_pct)}`}>{pct(q.change_pct)}</span>
          </div>
        </Link>
      ))}
      {fx.map((f) => (
        <div key={`${f.base}${f.quote}`} className="shrink-0 bg-surface border border-line rounded-card px-3 py-2">
          <div className="text-xs text-faint">{f.base}/{f.quote}</div>
          <div className="tnum text-sm text-ink">{f.rate.toFixed(4)}</div>
        </div>
      ))}
    </div>
  );
}

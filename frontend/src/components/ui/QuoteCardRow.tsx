import "./data.css";
import { Select } from "./Select";
import { StalenessChip } from "./StalenessChip";
import { formatPrice, formatSignedPercent, signOf } from "../../format/number";
import type { DecimalString } from "../../format/number";

// Home's single compact quote-card row with a source select (DESIGN-SYSTEM §5.2,
// D-046); replaces the three separate market rows.
export type QuoteSource = "markets" | "holdings" | "global" | "watchlist";

/** page-home Phase 1: exactly the fields this row RENDERS — no more. It previously took the full
 *  `Quote` (with a complete `Provenance`), but the quote readers serve only part of one: `confidence`
 *  and `status` are not served per quote, and this row does not show them. Requiring them would have
 *  forced the caller to INVENT provenance for a card that never displays it (Guarantee 3). Staleness
 *  is served and IS shown, per item. No visual change — a prop-type narrowing only. */
export interface QuoteCardItem {
  symbol: string;
  name: string;
  price: DecimalString;
  changePct: DecimalString;
  currency: string;
  /** Served per-item staleness (never fabricated) — rendered as a StalenessChip. */
  isStale: boolean;
  asOf: string;
}

export interface QuoteCardRowProps {
  quotes: QuoteCardItem[];
  source: QuoteSource;
  onSourceChange?: (source: QuoteSource) => void;
}

const SOURCE_OPTIONS = [
  { value: "markets", label: "Markets" },
  { value: "holdings", label: "Holdings" },
  { value: "global", label: "Global" },
  { value: "watchlist", label: "Watchlist" },
];

export function QuoteCardRow({ quotes, source, onSourceChange }: QuoteCardRowProps) {
  return (
    <div className="lf-quoterow">
      <div className="lf-quoterow__head">
        <span className="lf-stat__label">Quotes</span>
        <Select
          value={source}
          options={SOURCE_OPTIONS}
          aria-label="Quote source"
          onChange={(v) => onSourceChange?.(v as QuoteSource)}
        />
      </div>
      <div className="lf-quoterow__cards">
        {quotes.map((q) => {
          const sign = signOf(q.changePct);
          return (
            <div className="lf-quote" key={q.symbol}>
              <span className="lf-quote__sym">
                {q.symbol}
                <StalenessChip isStale={q.isStale} asOf={q.asOf} />
              </span>
              <span className="lf-quote__name">{q.name}</span>
              <span className="lf-quote__price">
                {q.currency} {formatPrice(q.price)}
              </span>
              <span className={`lf-quote__chg lf-chg--${sign}`}>
                {formatSignedPercent(q.changePct)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

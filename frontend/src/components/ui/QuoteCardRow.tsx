import "./data.css";
import { Select } from "./Select";
import { StalenessChip } from "./StalenessChip";
import { formatPrice, formatSignedPercent, signOf } from "../../format/number";
import type { Quote } from "../../mocks/types";

// Home's single compact quote-card row with a source select (DESIGN-SYSTEM §5.2,
// D-046); replaces the three separate market rows.
export type QuoteSource = "markets" | "holdings" | "global" | "watchlist";

export interface QuoteCardRowProps {
  quotes: Quote[];
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
                <StalenessChip
                  isStale={q.provenance.isStale}
                  asOf={q.provenance.asOf}
                />
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

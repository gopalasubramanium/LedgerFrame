import "./data.css";
import { formatPrice, formatSignedPercent, signOf } from "../../format/number";
import type { Quote } from "../../mocks/types";
import type { QuoteSource } from "./QuoteCardRow";

// Home Full layout ONLY — never Simple, never any other page (DESIGN-SYSTEM
// §5.2, D-047). Wall-appliance identity. The marquee halts under reduced motion
// (data-motion="reduced"; handled in data.css).
export interface TickerStripProps {
  quotes: Quote[];
  source: QuoteSource;
}

export function TickerStrip({ quotes }: TickerStripProps) {
  // Duplicate the sequence so the -50% scroll loops seamlessly.
  const items = [...quotes, ...quotes];
  return (
    <div className="lf-ticker" role="marquee" aria-label="Ticker">
      <div className="lf-ticker__track">
        {items.map((q, i) => {
          const sign = signOf(q.changePct);
          return (
            <span className="lf-ticker__item" key={`${q.symbol}-${i}`}>
              <strong>{q.symbol}</strong>
              <span>{formatPrice(q.price)}</span>
              <span className={`lf-chg--${sign}`}>
                {formatSignedPercent(q.changePct)}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

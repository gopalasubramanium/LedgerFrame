import { Link } from "react-router-dom";
import "./data.css";
import { formatPrice, formatSignedPercent, signOf } from "../../format/number";
import type { DecimalString } from "../../format/number";
import { TriangleAlert } from "../../icons";

// Global chrome ticker (DESIGN-SYSTEM §5.2, D-047 AMENDMENT — §11-17). Was Home-Full-
// only; now the app's fixed footer strip in the chrome, every width. Shows the user's
// holdings (+ world indices). The marquee halts under reduced motion (data-motion=
// "reduced"; then the strip is static + manually scrollable — data.css). Staleness stays
// visible per item — the price is FLAGGED, never hidden or faked (Product Guarantee).
//
// D-098 (§11-19): a symbol with an `href` links to its target page; a symbol WITHOUT one renders
// unlinked (never a dead link). Holdings → their instrument-detail page; world indices → `/markets`
// (R-17, page-markets ND-5 — Markets owns the indices). The mapping is set in `fetchTickerQuotes`.
export interface TickerQuote {
  symbol: string;
  price: DecimalString;
  changePct: DecimalString;
  stale?: boolean;
  /** Link target (holdings → /instrument/{symbol}; indices → /markets); omitted → unlinked. */
  href?: string;
}

export interface TickerStripProps {
  quotes: TickerQuote[];
}

export function TickerStrip({ quotes }: TickerStripProps) {
  if (quotes.length === 0) return null; // honest: nothing to scroll
  // Duplicate the sequence so the -50% scroll loops seamlessly.
  const items = [...quotes, ...quotes];
  return (
    <div className="lf-ticker" role="marquee" aria-label="Ticker">
      <div className="lf-ticker__track">
        {items.map((q, i) => {
          const sign = signOf(q.changePct);
          return (
            <span className="lf-ticker__item" key={`${q.symbol}-${i}`}>
              {q.href ? (
                <Link className="lf-ticker__sym" to={q.href}>
                  {q.symbol}
                </Link>
              ) : (
                <strong>{q.symbol}</strong>
              )}
              <span>{formatPrice(q.price)}</span>
              <span className={`lf-chg--${sign}`}>{formatSignedPercent(q.changePct)}</span>
              {q.stale && (
                <span className="lf-ticker__stale" title="Stale price" aria-label="stale">
                  <TriangleAlert aria-hidden="true" />
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

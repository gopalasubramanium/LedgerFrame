import type { ReactNode } from "react";
import "./data.css";
import { Sparkline } from "./Sparkline";
import { signOf } from "../../format/number";
import type { DecimalString } from "../../format/number";

// KPI / stat tile (DESIGN-SYSTEM §5.2): Net worth KPI strip, Portfolio stat rail,
// Today's change. Delta uses --gain/--loss ONLY, and always carries a sign glyph
// (colour is never the sole signal). Optional ProvenanceBadge slot.
export interface TrendStatProps {
  label: string;
  /** Pre-formatted display string (backend-computed value). */
  value: string;
  /** Signed delta value string (e.g. "+612.40"); drives colour + glyph. */
  delta?: DecimalString;
  /** Pre-formatted delta display (e.g. "+612.40 (0.4%)"). */
  deltaDisplay?: string;
  /** Colour the VALUE itself gain/loss — for tiles where the value IS a signed figure (the
   *  change), so no redundant delta subline is needed (page-portfolio §12b-1). */
  tone?: "up" | "down" | "flat";
  unit?: string;
  sparkline?: number[];
  provenance?: ReactNode;
}

const GLYPH = { up: "▲", down: "▼", flat: "→" } as const;

export function TrendStat({
  label,
  value,
  delta,
  deltaDisplay,
  tone,
  unit,
  sparkline,
  provenance,
}: TrendStatProps) {
  const sign = signOf(delta);
  return (
    <div className="lf-stat">
      <span className="lf-stat__label">{label}</span>
      <span className={`lf-stat__value${tone ? ` lf-stat__value--${tone}` : ""}`}>
        {value}
        {/* The unit/affix (e.g. a base-currency code, §14in-7) gets a zero-width-space break BEFORE it,
            so on a narrow tile it drops to its own line instead of clipping the value — invisible when
            the value+unit fit on one line. */}
        {unit && <>{"​"}<span className="lf-stat__unit">{unit}</span></>}
      </span>

      {(delta !== undefined || deltaDisplay) && (
        <span className={`lf-stat__delta lf-stat__delta--${sign}`}>
          <span aria-hidden="true">{GLYPH[sign]}</span>
          {deltaDisplay ?? delta}
        </span>
      )}

      {sparkline && (
        <Sparkline points={sparkline} tone={sign} aria-label={`${label} trend`} />
      )}

      {provenance && <div className="lf-stat__prov">{provenance}</div>}
    </div>
  );
}

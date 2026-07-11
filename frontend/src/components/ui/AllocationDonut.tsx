import { useState } from "react";
import "./charts.css";
import { formatPercent } from "../../format/number";
import type { Segment } from "../../mocks/types";

// Allocation by class/sector/currency/tag (DESIGN-SYSTEM §5.2, D-033): one summary donut on
// Home. Categorical identity palette (§4 amendment) — never a rainbow of meaning. The donut is
// a TRUE RING (transparent centre, §12-3). Each segment has a hover/focus tooltip (label · value ·
// pct · optional note) and is keyboard-reachable via the legend (§12-7). The share label is the
// visual proportion of the SERVED values — no money math here.
export interface AllocationDonutProps {
  segments: Segment[];
  legend?: boolean;
  onSegmentClick?: (segment: Segment) => void;
  /** PROPOSED (page-portfolio ND-4): an honest footnote line under the donut. */
  footnote?: string;
  "aria-label"?: string;
}

function num(v: Segment["value"]): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

export function AllocationDonut({
  segments,
  legend = true,
  onSegmentClick,
  footnote,
  "aria-label": ariaLabel,
}: AllocationDonutProps) {
  const [active, setActive] = useState<number | null>(null);
  const total = segments.reduce((s, seg) => s + num(seg.value), 0);
  let cumulative = 0;
  const arcs = segments.map((seg, i) => {
    const pct = total > 0 ? (num(seg.value) / total) * 100 : 0;
    const arc = { seg, i, pct, offset: cumulative };
    cumulative += pct;
    return arc;
  });

  const hot = active != null ? arcs[active] : null;
  const tip = hot
    ? `${hot.seg.label} · ${num(hot.seg.value).toLocaleString()} · ${formatPercent(String(hot.pct))}${hot.seg.note ? ` — ${hot.seg.note}` : ""}`
    : "";

  return (
    <div className="lf-donut">
      <svg className="lf-donut__svg" viewBox="0 0 100 100" role="img" aria-label={ariaLabel ?? "Allocation"}>
        <g transform="rotate(-90 50 50)">
          {arcs.map(({ i, pct, offset }) => (
            <circle
              key={i}
              cx="50"
              cy="50"
              r="38"
              fill="none"
              className={`lf-seg--${i % 8}${active === i ? " is-active" : ""}`}
              strokeWidth="16"
              pathLength={100}
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeDashoffset={-offset}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive((a) => (a === i ? null : a))}
            />
          ))}
        </g>
      </svg>

      {/* Hover/focus readout (aria-live so keyboard users hear the active segment). */}
      <div className="lf-donut__tip" role="status" aria-live="polite">{tip}</div>

      {legend && (
        <ul className="lf-donut__legend">
          {arcs.map(({ seg, i, pct }) => (
            <li
              key={i}
              className={`lf-donut__row${onSegmentClick ? " lf-donut__row--clickable" : ""}${active === i ? " is-active" : ""}`}
              tabIndex={0}
              title={seg.note ?? undefined}
              onClick={onSegmentClick ? () => onSegmentClick(seg) : undefined}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive((a) => (a === i ? null : a))}
              onFocus={() => setActive(i)}
              onBlur={() => setActive((a) => (a === i ? null : a))}
            >
              <span className={`lf-donut__swatch lf-seg--${i % 8}`} aria-hidden="true" />
              <span className="lf-donut__label">{seg.label}</span>
              <span className="lf-donut__pct">{formatPercent(String(pct))}</span>
            </li>
          ))}
        </ul>
      )}

      {footnote && <p className="lf-donut__footnote">{footnote}</p>}
    </div>
  );
}

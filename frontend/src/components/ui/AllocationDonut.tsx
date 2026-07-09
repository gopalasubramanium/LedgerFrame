import "./charts.css";
import { formatPercent } from "../../format/number";
import type { Segment } from "../../mocks/types";

// Allocation by class/sector/currency/tag (DESIGN-SYSTEM §5.2, D-033): one
// summary donut on Home; not used on Net worth (composition donut dropped,
// D-054). Slate+accent segments (§4). The donut renders proportions of the
// backend-computed segment values — it performs no money math; the share label
// is the visual proportion of the provided values.
export interface AllocationDonutProps {
  segments: Segment[];
  legend?: boolean;
  onSegmentClick?: (segment: Segment) => void;
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
  "aria-label": ariaLabel,
}: AllocationDonutProps) {
  const total = segments.reduce((s, seg) => s + num(seg.value), 0);
  let cumulative = 0;
  const arcs = segments.map((seg, i) => {
    const pct = total > 0 ? (num(seg.value) / total) * 100 : 0;
    const arc = { seg, i, pct, offset: cumulative };
    cumulative += pct;
    return arc;
  });

  return (
    <div className="lf-donut">
      <svg
        className="lf-donut__svg"
        viewBox="0 0 100 100"
        role="img"
        aria-label={ariaLabel ?? "Allocation"}
      >
        <g transform="rotate(-90 50 50)">
          {arcs.map(({ i, pct, offset }) => (
            <circle
              key={i}
              cx="50"
              cy="50"
              r="38"
              fill="none"
              className={`lf-seg--${i % 5}`}
              strokeWidth="16"
              pathLength={100}
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeDashoffset={-offset}
            />
          ))}
        </g>
      </svg>

      {legend && (
        <ul className="lf-donut__legend">
          {arcs.map(({ seg, i, pct }) => (
            <li
              key={i}
              className={`lf-donut__row${onSegmentClick ? " lf-donut__row--clickable" : ""}`}
              onClick={onSegmentClick ? () => onSegmentClick(seg) : undefined}
            >
              <span className={`lf-donut__swatch lf-seg--${i % 5}`} aria-hidden="true" />
              <span className="lf-donut__label">{seg.label}</span>
              <span className="lf-donut__pct">{formatPercent(String(pct))}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

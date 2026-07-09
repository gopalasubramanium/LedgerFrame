import "./charts.css";
import type { Sign } from "../../format/number";

// House-SVG sparkline used by TrendStat. Coordinates are data-space (unitless),
// not px; colour is semantic via the tone.
export interface SparklineProps {
  points: number[];
  tone?: Sign;
  "aria-label"?: string;
}

const W = 100;
const H = 32;

export function Sparkline({ points, tone = "flat", "aria-label": ariaLabel }: SparklineProps) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = W / (points.length - 1);
  const d = points
    .map((p, i) => {
      const x = i * step;
      const y = H - ((p - min) / span) * H;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  const cls =
    tone === "up"
      ? "lf-spark__line lf-spark__line--gain"
      : tone === "down"
        ? "lf-spark__line lf-spark__line--loss"
        : "lf-spark__line";

  return (
    <svg
      className="lf-spark"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel ?? "trend"}
    >
      <path className={cls} d={d} />
    </svg>
  );
}

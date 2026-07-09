import "./charts.css";
import type { PricePoint } from "../../mocks/types";

// House-SVG price/performance chart (DESIGN-SYSTEM §5.2, D-035): candles +
// MA/BB/RSI on Instrument Detail; line + benchmark for the Portfolio performance
// panel. No ECharts. All maths here are chart geometry / technical indicators
// (visualization), never a reported financial figure.
export type Overlay = "MA" | "BB" | "RSI";

export interface PriceChartProps {
  series: PricePoint[];
  overlays?: Overlay[];
  mode?: "candles" | "line";
  /** Comparison index series (normalized to the price range for overlay). */
  benchmark?: number[];
  interval: string;
}

const VW = 100;
const PLOT_TOP = 2;
const PLOT_BOT = 46;
const RSI_TOP = 50;
const RSI_BOT = 60;
const X0 = 2;
const X1 = 98;

function sma(values: number[], period: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < period - 1) return null;
    let s = 0;
    for (let k = i - period + 1; k <= i; k++) s += values[k];
    return s / period;
  });
}

function stddev(values: number[], period: number): (number | null)[] {
  const m = sma(values, period);
  return values.map((_, i) => {
    if (i < period - 1 || m[i] === null) return null;
    let s = 0;
    for (let k = i - period + 1; k <= i; k++) s += (values[k] - (m[i] as number)) ** 2;
    return Math.sqrt(s / period);
  });
}

function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = [];
  let gain = 0;
  let loss = 0;
  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      out.push(null);
      continue;
    }
    const ch = values[i] - values[i - 1];
    gain += Math.max(ch, 0);
    loss += Math.max(-ch, 0);
    if (i < period) {
      out.push(null);
      continue;
    }
    const rs = loss === 0 ? 100 : gain / period / (loss / period || 1e-9);
    out.push(100 - 100 / (1 + rs));
  }
  return out;
}

export function PriceChart({
  series,
  overlays = [],
  mode = "line",
  benchmark,
  interval,
}: PriceChartProps) {
  const closes = series.map((p) => p.close);
  const lows = series.map((p) => p.low);
  const highs = series.map((p) => p.high);
  const ma = sma(closes, 5);
  const sd = stddev(closes, 5);

  const priceMin = Math.min(...lows);
  const priceMax = Math.max(...highs);
  const span = priceMax - priceMin || 1;

  const n = series.length;
  const xAt = (i: number) => X0 + (i / (n - 1)) * (X1 - X0);
  const yAt = (v: number) =>
    PLOT_BOT - ((v - priceMin) / span) * (PLOT_BOT - PLOT_TOP);

  const linePath = (vals: (number | null)[]) =>
    vals
      .map((v, i) =>
        v === null ? "" : `${i === 0 || vals[i - 1] === null ? "M" : "L"}${xAt(i).toFixed(2)} ${yAt(v).toFixed(2)}`,
      )
      .join(" ")
      .trim();

  // Benchmark normalized into the same price band for visual comparison.
  let benchPath = "";
  if (benchmark && benchmark.length === n) {
    const bMin = Math.min(...benchmark);
    const bMax = Math.max(...benchmark);
    const bSpan = bMax - bMin || 1;
    benchPath = benchmark
      .map((v, i) => {
        const y = PLOT_BOT - ((v - bMin) / bSpan) * (PLOT_BOT - PLOT_TOP);
        return `${i === 0 ? "M" : "L"}${xAt(i).toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  }

  const showRsi = overlays.includes("RSI");
  const rsiVals = showRsi ? rsi(closes) : [];
  const rsiPath = showRsi
    ? rsiVals
        .map((v, i) =>
          v === null ? "" : `${i === 0 || rsiVals[i - 1] === null ? "M" : "L"}${xAt(i).toFixed(2)} ${(RSI_BOT - (v / 100) * (RSI_BOT - RSI_TOP)).toFixed(2)}`,
        )
        .join(" ")
        .trim()
    : "";

  const height = showRsi ? 60 : 48;

  return (
    <div className="lf-pricechart">
      <svg
        className="lf-pricechart__svg"
        viewBox={`0 0 ${VW} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Price chart, ${interval}`}
      >
        <line className="lf-pricechart__axis" x1={X0} y1={PLOT_BOT} x2={X1} y2={PLOT_BOT} />

        {overlays.includes("BB") &&
          ["up", "down"].map((side) => (
            <path
              key={side}
              className="lf-pricechart__overlay"
              d={linePath(
                ma.map((m, i) =>
                  m === null || sd[i] === null
                    ? null
                    : m + (side === "up" ? 2 : -2) * (sd[i] as number),
                ),
              )}
            />
          ))}

        {overlays.includes("MA") && (
          <path className="lf-pricechart__overlay" d={linePath(ma)} />
        )}

        {mode === "candles"
          ? series.map((p, i) => {
              const up = p.close >= p.open;
              const x = xAt(i);
              const bw = ((X1 - X0) / n) * 0.5;
              return (
                <g key={i} className={up ? "lf-candle--up" : "lf-candle--down"}>
                  <line x1={x} y1={yAt(p.high)} x2={x} y2={yAt(p.low)} strokeWidth="0.4" />
                  <rect
                    x={x - bw / 2}
                    y={yAt(Math.max(p.open, p.close))}
                    width={bw}
                    height={Math.max(Math.abs(yAt(p.open) - yAt(p.close)), 0.4)}
                  />
                </g>
              );
            })
          : <path className="lf-pricechart__line" d={linePath(closes)} />}

        {benchPath && <path className="lf-pricechart__bench" d={benchPath} />}

        {showRsi && (
          <>
            <line className="lf-pricechart__axis" x1={X0} y1={RSI_TOP} x2={X1} y2={RSI_TOP} />
            <path className="lf-pricechart__overlay" d={rsiPath} />
          </>
        )}
      </svg>

      <div className="lf-pricechart__legend">
        <span>Interval: {interval}</span>
        <span>Mode: {mode}</span>
        {overlays.length > 0 && <span>Overlays: {overlays.join(" · ")}</span>}
        {benchmark && <span>Benchmark overlaid (indexed)</span>}
      </div>
    </div>
  );
}

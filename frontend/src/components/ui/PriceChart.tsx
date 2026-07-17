import { useEffect, useMemo, useRef, useState } from "react";
import "./charts.css";
import { Button } from "./Button";
import { Segmented } from "./Segmented";
import type { PricePoint } from "../../mocks/types";

// House-SVG price/performance chart (DESIGN-SYSTEM §5.2, D-035). No ECharts. All
// maths here are chart geometry / technical indicators (visualization), never a
// reported financial figure. AMENDMENT (PROPOSED 2026-07-10, mini-ratify): a
// Simple/Advanced view toggle, a hover crosshair + tooltip, and a period selector
// with HONEST short-history behaviour (shows only what exists, labels it, never
// stretches or fabricates).
export type Overlay = "MA" | "BB" | "RSI";

export interface PriceChartProps {
  series: PricePoint[];
  overlays?: Overlay[];
  mode?: "candles" | "line";
  /** Comparison index series (normalized to the price range for overlay). */
  benchmark?: number[];
  /** PROPOSED comparison mode (page-portfolio ND-3d/e). A SECOND **same-unit** series plotted on
   *  the SHARED value axis — NOT normalised to its own range like `benchmark` — so relative
   *  out/under-performance is visible. `label` names it in the legend; `sublabel` is a provenance
   *  line (e.g. "S&P 500 — SPY proxy · price return, excl. dividends"). Values must be same-unit
   *  and same-length as `series` (both come pre-indexed to a common start from the engine — zero
   *  frontend math). */
  comparison?: { values: number[]; label: string; sublabel?: string };
  interval: string;
  /** Show the Simple/Advanced toggle + period selector (Instrument Detail). */
  controls?: boolean;
  defaultView?: "simple" | "advanced";
  periods?: string[];
  activePeriod?: string;
  onPeriodChange?: (p: string) => void;
  /** Honest label when the fetched history covers less than the requested period. */
  coverageNote?: string;
}

const VW = 100;
const PLOT_TOP = 2;
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
  comparison,
  interval,
  controls = false,
  defaultView = "simple",
  periods,
  activePeriod,
  onPeriodChange,
  coverageNote,
}: PriceChartProps) {
  const [view, setView] = useState<"simple" | "advanced">(defaultView);
  const [hover, setHover] = useState<{ i: number; x: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Controls drive the presets; without controls, honour the passed mode/overlays.
  const advanced = controls ? view === "advanced" : mode === "candles";
  const effMode: "candles" | "line" = advanced ? "candles" : "line";
  const effOverlays: Overlay[] = controls ? (advanced ? ["MA", "BB", "RSI"] : []) : overlays;

  // §14dr-5 — zoom is ADVANCED-only and NON-persistent: a window [lo,hi] over the full series in
  // index space; wheel/pinch narrow or widen it (see the effect below), the Reset control clears it.
  // A new `series` (a period change, or unmount) resets the window — no persistence, no served field.
  const [zoom, setZoom] = useState<{ lo: number; hi: number } | null>(null);
  useEffect(() => setZoom(null), [series]);
  const zoomed = advanced && zoom != null;
  const zSeries = zoomed ? series.slice(zoom!.lo, zoom!.hi + 1) : series;

  // Wheel + pinch zoom about the cursor (Advanced only). Native non-passive listeners so
  // preventDefault stops the page from scrolling while zooming. Recomputes the [lo,hi] window in
  // FULL-series index space; a full zoom-out clears the window (→ Reset state).
  useEffect(() => {
    const el = wrapRef.current;
    const n0 = series.length;
    if (!el || !advanced || n0 < 4) return;
    const MINW = 3; // never zoom below a few candles
    const applyZoom = (factor: number, frac: number) => {
      setZoom((z) => {
        const lo = z?.lo ?? 0;
        const hi = z?.hi ?? n0 - 1;
        const idx = lo + frac * (hi - lo);
        const w = Math.max((hi - lo) * factor, MINW);
        if (w >= n0 - 1) return null; // fully zoomed out
        let nlo = Math.round(idx - frac * w);
        let nhi = Math.round(nlo + w);
        if (nlo < 0) { nlo = 0; nhi = Math.round(w); }
        if (nhi > n0 - 1) { nhi = n0 - 1; nlo = Math.round(nhi - w); }
        nlo = Math.max(nlo, 0);
        return nhi - nlo < MINW ? z : { lo: nlo, hi: nhi };
      });
    };
    const fracAt = (clientX: number) => {
      const r = el.getBoundingClientRect();
      if (!r.width) return 0.5; // no layout (e.g. jsdom) → zoom about the centre
      return Math.min(Math.max((clientX - r.left) / r.width, 0), 1);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      applyZoom(e.deltaY < 0 ? 0.8 : 1.25, fracAt(e.clientX));
    };
    const gap = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    let pinch = 0;
    const onTouchStart = (e: TouchEvent) => { if (e.touches.length === 2) pinch = gap(e.touches); };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const d = gap(e.touches);
      if (pinch && Math.abs(1 - pinch / d) >= 0.05) {
        applyZoom(pinch / d, fracAt((e.touches[0].clientX + e.touches[1].clientX) / 2));
      }
      pinch = d;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, [advanced, series]);

  const showVolume = advanced && zSeries.some((p) => p.volume != null);

  const closes = zSeries.map((p) => p.close);
  const lows = zSeries.map((p) => p.low);
  const highs = zSeries.map((p) => p.high);
  const ma = useMemo(() => sma(closes, 5), [closes]);
  const sd = useMemo(() => stddev(closes, 5), [closes]);

  const n = zSeries.length;
  // Comparison mode shares the value axis: fold the second series into the min/max so both fit.
  const cmpVals = comparison?.values ?? [];
  const useCmp = comparison != null && cmpVals.length === n;
  const priceMin = Math.min(...lows, ...(useCmp ? cmpVals : []));
  const priceMax = Math.max(...highs, ...(useCmp ? cmpVals : []));
  const span = priceMax - priceMin || 1;

  const showRsi = effOverlays.includes("RSI");
  const plotBot = showVolume ? 40 : 46; // leave room for the volume band
  const height = showRsi ? RSI_BOT : plotBot + 2;

  const xAt = (i: number) => X0 + (i / Math.max(n - 1, 1)) * (X1 - X0);
  const yAt = (v: number) => plotBot - ((v - priceMin) / span) * (plotBot - PLOT_TOP);

  const linePath = (vals: (number | null)[]) =>
    vals
      .map((v, i) =>
        v === null ? "" : `${i === 0 || vals[i - 1] === null ? "M" : "L"}${xAt(i).toFixed(2)} ${yAt(v).toFixed(2)}`,
      )
      .join(" ")
      .trim();

  // Comparison series on the SHARED axis (same yAt as the main line) — no re-normalisation.
  const cmpPath = useCmp ? linePath(cmpVals) : "";

  let benchPath = "";
  if (benchmark && benchmark.length === n) {
    const bMin = Math.min(...benchmark);
    const bMax = Math.max(...benchmark);
    const bSpan = bMax - bMin || 1;
    benchPath = benchmark
      .map((v, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(2)} ${(plotBot - ((v - bMin) / bSpan) * (plotBot - PLOT_TOP)).toFixed(2)}`)
      .join(" ");
  }

  const rsiVals = showRsi ? rsi(closes) : [];
  const rsiPath = showRsi
    ? rsiVals
        .map((v, i) =>
          v === null ? "" : `${i === 0 || rsiVals[i - 1] === null ? "M" : "L"}${xAt(i).toFixed(2)} ${(RSI_BOT - (v / 100) * (RSI_BOT - RSI_TOP)).toFixed(2)}`,
        )
        .join(" ")
        .trim()
    : "";

  const volMax = showVolume ? Math.max(...zSeries.map((p) => p.volume ?? 0), 1) : 1;

  function onMove(e: React.MouseEvent) {
    const el = wrapRef.current;
    if (!el || n === 0) return;
    const r = el.getBoundingClientRect();
    const frac = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);
    setHover({ i: Math.round(frac * (n - 1)), x: e.clientX - r.left });
  }

  const hp = hover ? zSeries[hover.i] : null;

  return (
    <div className="lf-pricechart">
      {controls && (
        <div className="lf-pricechart__controls">
          <Segmented
            aria-label="Chart view"
            value={view}
            onChange={(v) => setView(v as "simple" | "advanced")}
            options={[{ value: "simple", label: "Simple" }, { value: "advanced", label: "Advanced" }]}
          />
          {periods && onPeriodChange && (
            <Segmented
              aria-label="Period"
              value={activePeriod ?? ""}
              onChange={onPeriodChange}
              options={periods.map((p) => ({ value: p, label: p }))}
            />
          )}
        </div>
      )}

      {n < 2 ? (
        <p className="lf-pricechart__empty">{coverageNote ?? "No price history for the selected period."}</p>
      ) : (
      <div className="lf-pricechart__plot" ref={wrapRef} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <svg
          className="lf-pricechart__svg"
          viewBox={`0 0 ${VW} ${height}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Price chart, ${interval}, ${effMode}`}
        >
          <line className="lf-pricechart__axis" x1={X0} y1={plotBot} x2={X1} y2={plotBot} />

          {effOverlays.includes("BB") &&
            ["up", "down"].map((side) => (
              <path
                key={side}
                className="lf-pricechart__overlay"
                d={linePath(ma.map((m, i) => (m === null || sd[i] === null ? null : m + (side === "up" ? 2 : -2) * (sd[i] as number))))}
              />
            ))}

          {effOverlays.includes("MA") && <path className="lf-pricechart__overlay" d={linePath(ma)} />}

          {showVolume &&
            zSeries.map((p, i) => {
              const vh = ((p.volume ?? 0) / volMax) * (46 - plotBot);
              return <rect key={`v${i}`} className="lf-pricechart__vol" x={xAt(i) - 0.3} y={46 - vh} width={0.6} height={Math.max(vh, 0.1)} />;
            })}

          {effMode === "candles"
            ? zSeries.map((p, i) => {
                const up = p.close >= p.open;
                const x = xAt(i);
                // §14dr-4 — body width is BAND-based with a readable floor and a no-overlap clamp:
                // `slot` = the per-point width. `slot*0.7` gives a normal gapped candle at sparse
                // density; the 0.6 floor keeps the body readable at real daily density (was
                // `slot*0.5` → ~0.39 at the 6M/~124-bar default, thinner than the wick); the outer
                // `min(slot, …)` guarantees the body never exceeds its slot (no overlap) at 1Y/Max.
                const slot = (X1 - X0) / n;
                const bw = Math.min(slot, Math.max(slot * 0.7, 0.6));
                return (
                  <g key={i} className={up ? "lf-candle--up" : "lf-candle--down"}>
                    <line x1={x} y1={yAt(p.high)} x2={x} y2={yAt(p.low)} strokeWidth="0.4" />
                    <rect x={x - bw / 2} y={yAt(Math.max(p.open, p.close))} width={bw} height={Math.max(Math.abs(yAt(p.open) - yAt(p.close)), 0.4)} />
                  </g>
                );
              })
            : <path className="lf-pricechart__line" d={linePath(closes)} />}

          {benchPath && <path className="lf-pricechart__bench" d={benchPath} />}
          {cmpPath && <path className="lf-pricechart__cmp" d={cmpPath} />}

          {showRsi && (
            <>
              <line className="lf-pricechart__axis" x1={X0} y1={RSI_TOP} x2={X1} y2={RSI_TOP} />
              <path className="lf-pricechart__overlay" d={rsiPath} />
            </>
          )}

          {/* Hover crosshair — vertical line + close marker at the nearest point. */}
          {hp && (
            <>
              <line className="lf-pricechart__cross" x1={xAt(hover!.i)} y1={PLOT_TOP} x2={xAt(hover!.i)} y2={plotBot} />
              <circle className="lf-pricechart__dot" cx={xAt(hover!.i)} cy={yAt(hp.close)} r={0.8} />
            </>
          )}
        </svg>

        {hp && (
          <div
            className="lf-pricechart__tip"
            style={{ left: `${hover!.x}px` }}
            role="status"
          >
            <span className="lf-pricechart__tipdate">{hp.t}</span>
            <span>{hp.close.toLocaleString()}</span>
            {/* Comparison mode (§12-7): read the benchmark value at the same point, so hover
                compares both same-axis series, not just the portfolio line. */}
            {useCmp && comparison && (
              <span className="lf-pricechart__tipcmp">{comparison.label}: {cmpVals[hover!.i]?.toLocaleString()}</span>
            )}
            {advanced && (
              <span className="lf-pricechart__tipohlc">
                O {hp.open.toLocaleString()} · H {hp.high.toLocaleString()} · L {hp.low.toLocaleString()}
                {hp.volume != null ? ` · V ${hp.volume.toLocaleString()}` : ""}
              </span>
            )}
          </div>
        )}

        {/* §14dr-5 — zoom reset. Ratified Button (§5.4), shown only while zoomed (Advanced only);
            clears the non-persistent window back to the full range. */}
        {zoomed && (
          <div className="lf-pricechart__zoom">
            <Button className="lf-pricechart__zoomreset" onClick={() => setZoom(null)}>Reset zoom</Button>
          </div>
        )}
      </div>
      )}

      <div className="lf-pricechart__legend">
        <span>Interval: {interval}</span>
        {/* Honest metadata (page-net-worth §12b2-3): a legend line describes only a control that
            EXISTS on the page. The Simple/Advanced view line shows only when its toggle is present
            (`controls`) — never on a page (e.g. Net worth) that has no view toggle. */}
        {controls && <span>View: {advanced ? "Advanced" : "Simple"}</span>}
        {/* Honest metadata: the zoom control only exists in Advanced, so the hint shows only there. */}
        {advanced && <span>Scroll or pinch to zoom{zoomed ? ` · showing ${n} of ${series.length}` : ""}</span>}
        {effOverlays.length > 0 && <span>Overlays: {effOverlays.join(" · ")}</span>}
        {benchmark && <span>Benchmark overlaid (indexed)</span>}
        {comparison && (
          <span className="lf-pricechart__cmplegend">
            <span className="lf-pricechart__swatch lf-pricechart__swatch--cmp" aria-hidden="true" /> {comparison.label}
          </span>
        )}
        {comparison?.sublabel && <span className="lf-pricechart__note">{comparison.sublabel}</span>}
        {/* Honest short-history: never stretched or fabricated. */}
        {coverageNote && <span className="lf-pricechart__note">{coverageNote}</span>}
      </div>
    </div>
  );
}

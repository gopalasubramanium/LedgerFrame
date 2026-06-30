import ReactECharts from "echarts-for-react";
import * as echarts from "echarts/core";
import { BarChart, CandlestickChart, LineChart, PieChart, TreemapChart } from "echarts/charts";
import {
  AxisPointerComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useMemo } from "react";
import { useApp } from "../store/app";

// Register only what we use → smaller bundle, faster on the Pi.
echarts.use([
  LineChart, PieChart, TreemapChart, BarChart, CandlestickChart,
  GridComponent, TooltipComponent, DataZoomComponent, LegendComponent,
  MarkLineComponent, AxisPointerComponent, CanvasRenderer,
]);

export interface Candle { ts: string; open: number; high: number; low: number; close: number; volume: number | null }

function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

// Wilder's RSI(14) computed from closes — standard 0–100 momentum oscillator.
function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  let ag = gain / period, al = loss / period;
  out[period] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    ag = (ag * (period - 1) + (d > 0 ? d : 0)) / period;
    al = (al * (period - 1) + (d < 0 ? -d : 0)) / period;
    out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  }
  return out;
}

function bollinger(values: number[], period = 20, mult = 2) {
  const mid = sma(values, period);
  const upper: (number | null)[] = [], lower: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) { upper.push(null); lower.push(null); continue; }
    const slice = values.slice(i - period + 1, i + 1);
    const m = mid[i] as number;
    const sd = Math.sqrt(slice.reduce((a, v) => a + (v - m) ** 2, 0) / period);
    upper.push(m + mult * sd); lower.push(m - mult * sd);
  }
  return { mid, upper, lower };
}

function rgbVar(name: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v ? `rgb(${v})` : "#888";
}
function palette() {
  return {
    axis: rgbVar("--c-faint"),
    line: rgbVar("--c-line"),
    ink: rgbVar("--c-ink"),
    surface: rgbVar("--c-elevated"),
    base: rgbVar("--c-base"),
    accent: rgbVar("--c-accent"),
    up: rgbVar("--c-up"),
    down: rgbVar("--c-down"),
  };
}
function tooltip(p: ReturnType<typeof palette>) {
  return { backgroundColor: p.surface, borderColor: p.line, textStyle: { color: p.ink } };
}

const DONUT_COLORS = ["#2f9e7c", "#4f8fd6", "#c79a4e", "#a06fc4", "#d2685f", "#5bb6b0", "#7a8aa0", "#cf8a52"];

export function Sparkline({ points, up, height = 48 }: { points: number[]; up: boolean; height?: number | string }) {
  const { theme } = useApp();
  const option = useMemo(() => {
    const p = palette();
    return {
      animation: false,
      grid: { left: 0, right: 0, top: 4, bottom: 0 },
      xAxis: { type: "category", show: false, data: points.map((_, i) => i) },
      yAxis: { type: "value", show: false, scale: true },
      series: [{
        type: "line", data: points, smooth: true, symbol: "none",
        // With animation:false, hover-emphasis re-clips the area from zero and
        // (because there's no animation to restore it) the line vanishes until
        // mouse-out. Disabling emphasis keeps the series stable on hover.
        emphasis: { disabled: true },
        lineStyle: { width: 2, color: up ? p.up : p.down },
        areaStyle: { opacity: 0.12, color: up ? p.up : p.down },
      }],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, up, theme]);
  return <ReactECharts echarts={echarts} option={option} style={{ height, width: "100%" }} notMerge lazyUpdate />;
}

export function LineSeries({ x, y, height = 280 }: { x: string[]; y: number[]; height?: number }) {
  const { theme } = useApp();
  const up = y.length > 1 && y[y.length - 1] >= y[0];
  const option = useMemo(() => {
    const p = palette();
    return {
      animation: false,
      grid: { left: 50, right: 16, top: 16, bottom: 28 },
      tooltip: { trigger: "axis", ...tooltip(p) },
      xAxis: { type: "category", data: x, axisLine: { lineStyle: { color: p.line } }, axisLabel: { color: p.axis } },
      yAxis: { type: "value", scale: true, splitLine: { lineStyle: { color: p.line } }, axisLabel: { color: p.axis } },
      series: [{
        type: "line", data: y, smooth: true, symbol: "none",
        emphasis: { disabled: true },  // keep line/area visible while hovering (see Sparkline)
        lineStyle: { width: 2, color: up ? p.up : p.down },
        areaStyle: { opacity: 0.1, color: up ? p.up : p.down },
      }],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x, y, up, theme]);
  return <ReactECharts echarts={echarts} option={option} style={{ height, width: "100%" }} />;
}

export function BenchmarkChart({
  x, portfolio, benchmark, benchmarkLabel = "Benchmark", height = 300,
}: { x: string[]; portfolio: number[]; benchmark: number[]; benchmarkLabel?: string; height?: number }) {
  const { theme } = useApp();
  const up = portfolio.length > 1 && portfolio[portfolio.length - 1] >= portfolio[0];
  const option = useMemo(() => {
    const p = palette();
    return {
      animation: false,
      grid: { left: 56, right: 16, top: 16, bottom: 28 },
      legend: { data: ["Portfolio", benchmarkLabel], textStyle: { color: p.axis }, right: 10, top: 0, icon: "roundRect" },
      tooltip: { trigger: "axis", ...tooltip(p) },
      xAxis: { type: "category", data: x, boundaryGap: false, axisLine: { lineStyle: { color: p.line } }, axisLabel: { color: p.axis } },
      yAxis: { type: "value", scale: true, splitLine: { lineStyle: { color: p.line } }, axisLabel: { color: p.axis } },
      series: [
        { name: "Portfolio", type: "line", data: portfolio, smooth: true, symbol: "none",
          emphasis: { disabled: true },
          lineStyle: { width: 2.5, color: up ? p.up : p.down }, areaStyle: { opacity: 0.1, color: up ? p.up : p.down } },
        { name: benchmarkLabel, type: "line", data: benchmark, smooth: true, symbol: "none",
          emphasis: { disabled: true },
          lineStyle: { width: 1.5, color: p.accent, type: "dashed" } },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x, portfolio, benchmark, benchmarkLabel, up, theme]);
  return <ReactECharts echarts={echarts} option={option} style={{ height, width: "100%" }} />;
}

export function Donut({ data }: { data: { name: string; value: number }[] }) {
  const { theme } = useApp();
  const option = useMemo(() => {
    const p = palette();
    return {
      animation: false,
      tooltip: { trigger: "item", ...tooltip(p) },
      legend: { show: false },
      color: DONUT_COLORS,
      series: [{
        type: "pie", radius: ["58%", "82%"], avoidLabelOverlap: true,
        itemStyle: { borderColor: p.surface, borderWidth: 2 }, label: { show: false }, data,
      }],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, theme]);
  return <ReactECharts echarts={echarts} option={option} style={{ height: 220, width: "100%" }} />;
}

export function Heatmap({ data }: { data: { name: string; value: number; changePct: number }[] }) {
  const { theme } = useApp();
  const option = useMemo(() => {
    const p = palette();
    const colour = (c: number) => {
      if (c > 1.5) return "#2f7a63";
      if (c > 0) return "#3d6b5c";
      if (c === 0) return p.line;
      if (c > -1.5) return "#7a4a45";
      return "#9c4138";
    };
    return {
      animation: false,
      tooltip: { ...tooltip(p), formatter: (pt: { name: string; data: { changePct: number } }) =>
        `${pt.name}<br/>${pt.data.changePct > 0 ? "+" : ""}${pt.data.changePct.toFixed(2)}%` },
      series: [{
        type: "treemap", roam: false, nodeClick: false, breadcrumb: { show: false },
        label: { show: true, color: "#f3f6fa", fontSize: 12 },
        itemStyle: { borderColor: p.base, borderWidth: 2, gapWidth: 2 },
        data: data.map((d) => ({ name: d.name, value: d.value, changePct: d.changePct, itemStyle: { color: colour(d.changePct) } })),
      }],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, theme]);
  return <ReactECharts echarts={echarts} option={option} style={{ height: "100%", width: "100%", minHeight: 360 }} />;
}

export interface CandleOptions { showVolume?: boolean; showMa?: boolean; showBoll?: boolean; showRsi?: boolean }

// TradingView-style chart: candlesticks + a volume sub-pane, optional moving
// averages / Bollinger bands overlay, and an optional RSI(14) sub-pane, with
// zoom/pan. All indicators are computed from the real OHLC — nothing fabricated.
export function CandleChart({ candles, height = 460, opts = {} }: { candles: Candle[]; height?: number; opts?: CandleOptions }) {
  const { theme } = useApp();
  const { showVolume = true, showMa = true, showBoll = false, showRsi = true } = opts;
  const option = useMemo(() => {
    const p = palette();
    const dates = candles.map((c) => new Date(c.ts).toLocaleDateString());
    const ohlc = candles.map((c) => [c.open, c.close, c.low, c.high]); // ECharts order
    const closes = candles.map((c) => c.close);
    const vols = candles.map((c) => ({ value: c.volume ?? 0, itemStyle: { color: c.close >= c.open ? p.up : p.down, opacity: 0.45 } }));

    // Vertical layout: price pane, then (optional) volume, then (optional) RSI.
    const panes: { h: number }[] = [{ h: showRsi ? 56 : 70 }];
    if (showVolume) panes.push({ h: 16 });
    if (showRsi) panes.push({ h: 18 });
    const grids: Record<string, unknown>[] = [];
    const xAxes: Record<string, unknown>[] = [];
    const yAxes: Record<string, unknown>[] = [];
    let top = 4;
    panes.forEach((pane, i) => {
      grids.push({ left: 8, right: 56, top: `${top}%`, height: `${pane.h - 6}%` });
      xAxes.push({
        type: "category", gridIndex: i, data: dates, boundaryGap: true,
        axisLine: { lineStyle: { color: p.line } }, axisTick: { show: false },
        axisLabel: { show: i === panes.length - 1, color: p.axis, fontSize: 10 },
        splitLine: { show: false },
      });
      yAxes.push({
        scale: true, gridIndex: i, position: "right",
        axisLabel: { color: p.axis, fontSize: 10 }, axisLine: { show: false }, axisTick: { show: false },
        splitLine: { show: i === 0, lineStyle: { color: p.line, opacity: 0.4 } },
      });
      top += pane.h;
    });

    const volIdx = showVolume ? 1 : -1;
    const rsiIdx = showRsi ? (showVolume ? 2 : 1) : -1;

    const series: Record<string, unknown>[] = [{
      name: "Price", type: "candlestick", data: ohlc, xAxisIndex: 0, yAxisIndex: 0,
      itemStyle: { color: p.up, color0: p.down, borderColor: p.up, borderColor0: p.down },
    }];
    const legendData: string[] = [];
    const addLine = (name: string, data: (number | null)[], color: string, width = 1.4) => {
      legendData.push(name);
      series.push({ name, type: "line", data, xAxisIndex: 0, yAxisIndex: 0, smooth: true, symbol: "none", lineStyle: { width, color }, z: 3 });
    };
    if (showMa) { addLine("MA20", sma(closes, 20), p.accent); addLine("MA50", sma(closes, 50), "#c79a4e"); }
    if (showBoll) {
      const b = bollinger(closes, 20, 2);
      addLine("BB upper", b.upper, "#4f8fd6", 1);
      addLine("BB lower", b.lower, "#4f8fd6", 1);
    }
    if (showVolume) {
      series.push({ name: "Volume", type: "bar", data: vols, xAxisIndex: volIdx, yAxisIndex: volIdx });
    }
    if (showRsi) {
      series.push({
        name: "RSI 14", type: "line", data: rsi(closes, 14), xAxisIndex: rsiIdx, yAxisIndex: rsiIdx,
        smooth: true, symbol: "none", lineStyle: { width: 1.2, color: "#a06fc4" },
        markLine: {
          silent: true, symbol: "none", label: { color: p.axis, fontSize: 9 },
          lineStyle: { color: p.line, type: "dashed" },
          data: [{ yAxis: 70 }, { yAxis: 30 }],
        },
      });
      (yAxes[rsiIdx] as Record<string, unknown>).min = 0;
      (yAxes[rsiIdx] as Record<string, unknown>).max = 100;
    }

    return {
      animation: false,
      legend: legendData.length ? { data: legendData, top: 0, right: 56, textStyle: { color: p.axis, fontSize: 10 }, itemWidth: 14, itemHeight: 8 } : undefined,
      grid: grids,
      xAxis: xAxes,
      yAxis: yAxes,
      axisPointer: { link: [{ xAxisIndex: "all" }], label: { backgroundColor: p.surface, color: p.ink } },
      tooltip: { ...tooltip(p), trigger: "axis", axisPointer: { type: "cross" }, confine: true },
      dataZoom: [
        { type: "inside", xAxisIndex: panes.map((_, i) => i), start: 40, end: 100 },
        { type: "slider", xAxisIndex: panes.map((_, i) => i), height: 16, bottom: 2, start: 40, end: 100,
          borderColor: p.line, fillerColor: "rgba(127,127,127,0.15)", textStyle: { color: p.axis, fontSize: 9 } },
      ],
      series,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, theme, showVolume, showMa, showBoll, showRsi]);
  return <ReactECharts echarts={echarts} option={option} notMerge style={{ height, width: "100%" }} />;
}

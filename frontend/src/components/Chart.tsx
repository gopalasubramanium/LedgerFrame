import ReactECharts from "echarts-for-react";
import * as echarts from "echarts/core";
import { LineChart, PieChart, TreemapChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useMemo } from "react";
import { useApp } from "../store/app";

// Register only what we use → smaller bundle, faster on the Pi.
echarts.use([LineChart, PieChart, TreemapChart, GridComponent, TooltipComponent, CanvasRenderer]);

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

export function Sparkline({ points, up }: { points: number[]; up: boolean }) {
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
  return <ReactECharts echarts={echarts} option={option} style={{ height: 48, width: "100%" }} />;
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

import ReactECharts from "echarts-for-react";
import * as echarts from "echarts/core";
import { LineChart, PieChart, TreemapChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useMemo } from "react";

// Register only what we use → smaller bundle, faster on the Pi.
echarts.use([LineChart, PieChart, TreemapChart, GridComponent, TooltipComponent, CanvasRenderer]);

const AXIS = "#5b647a";
const LINE = "#2a3242";
const ACCENT = "#d9a566";

export function Sparkline({ points, up }: { points: number[]; up: boolean }) {
  const option = useMemo(
    () => ({
      animation: false,
      grid: { left: 0, right: 0, top: 4, bottom: 0 },
      xAxis: { type: "category", show: false, data: points.map((_, i) => i) },
      yAxis: { type: "value", show: false, scale: true },
      series: [
        {
          type: "line",
          data: points,
          smooth: true,
          symbol: "none",
          lineStyle: { width: 2, color: up ? "#4ea88b" : "#d2685f" },
          areaStyle: { opacity: 0.12, color: up ? "#4ea88b" : "#d2685f" },
        },
      ],
    }),
    [points, up],
  );
  return <ReactECharts echarts={echarts} option={option} style={{ height: 48, width: "100%" }} />;
}

export function LineSeries({ x, y, height = 280 }: { x: string[]; y: number[]; height?: number }) {
  const up = y.length > 1 && y[y.length - 1] >= y[0];
  const option = useMemo(
    () => ({
      animation: false,
      grid: { left: 50, right: 16, top: 16, bottom: 28 },
      tooltip: { trigger: "axis", backgroundColor: "#1c2230", borderColor: LINE, textStyle: { color: "#e8ecf2" } },
      xAxis: { type: "category", data: x, axisLine: { lineStyle: { color: LINE } }, axisLabel: { color: AXIS } },
      yAxis: { type: "value", scale: true, splitLine: { lineStyle: { color: LINE } }, axisLabel: { color: AXIS } },
      series: [
        {
          type: "line",
          data: y,
          smooth: true,
          symbol: "none",
          lineStyle: { width: 2, color: up ? "#4ea88b" : "#d2685f" },
          areaStyle: { opacity: 0.1, color: up ? "#4ea88b" : "#d2685f" },
        },
      ],
    }),
    [x, y, up],
  );
  return <ReactECharts echarts={echarts} option={option} style={{ height, width: "100%" }} />;
}

export function Donut({ data }: { data: { name: string; value: number }[] }) {
  const palette = ["#d9a566", "#4ea88b", "#5b8bd9", "#a673c4", "#d2685f", "#6ec0c4", "#c4a36e", "#7a8499"];
  const option = useMemo(
    () => ({
      animation: false,
      tooltip: { trigger: "item", backgroundColor: "#1c2230", borderColor: LINE, textStyle: { color: "#e8ecf2" } },
      legend: { show: false },
      color: palette,
      series: [
        {
          type: "pie",
          radius: ["58%", "82%"],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: "#141923", borderWidth: 2 },
          label: { show: false },
          data,
        },
      ],
    }),
    [data],
  );
  return <ReactECharts echarts={echarts} option={option} style={{ height: 220, width: "100%" }} />;
}

export function Heatmap({
  data,
}: {
  data: { name: string; value: number; changePct: number }[];
}) {
  // Original treemap heatmap: size by value, colour by performance.
  const colour = (c: number) => {
    if (c > 1.5) return "#2f7a63";
    if (c > 0) return "#3d6b5c";
    if (c === 0) return "#2a3242";
    if (c > -1.5) return "#7a4a45";
    return "#9c4138";
  };
  const option = useMemo(
    () => ({
      animation: false,
      tooltip: {
        backgroundColor: "#1c2230",
        borderColor: LINE,
        textStyle: { color: "#e8ecf2" },
        formatter: (p: { name: string; data: { changePct: number } }) =>
          `${p.name}<br/>${p.data.changePct > 0 ? "+" : ""}${p.data.changePct.toFixed(2)}%`,
      },
      series: [
        {
          type: "treemap",
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          label: { show: true, color: "#e8ecf2", fontSize: 12 },
          itemStyle: { borderColor: "#141923", borderWidth: 2, gapWidth: 2 },
          data: data.map((d) => ({
            name: d.name,
            value: d.value,
            changePct: d.changePct,
            itemStyle: { color: colour(d.changePct) },
          })),
        },
      ],
    }),
    [data],
  );
  return <ReactECharts echarts={echarts} option={option} style={{ height: "100%", width: "100%", minHeight: 360 }} />;
}

export { ACCENT };

import "./charts.css";
import type { TreemapNode } from "../../mocks/types";

// Heatmap (DESIGN-SYSTEM §5.2, D-053): house-SVG, squarified. ECharts escape
// hatch is available via ADR only (§4) — not taken here. Tone is semantic
// (gain/loss/flat), never decorative colour.
export interface TreemapProps {
  nodes: TreemapNode[];
  /** House squarified layout (the only supported mode). */
  squarified?: boolean;
  "aria-label"?: string;
}

interface Rect { x: number; y: number; w: number; h: number; }
interface Tile extends Rect { node: TreemapNode; }
interface Item { node: TreemapNode; area: number; }

const W = 100;
const H = 60;

function worst(areas: number[], side: number): number {
  const s = areas.reduce((a, b) => a + b, 0);
  const max = Math.max(...areas);
  const min = Math.min(...areas);
  return Math.max((side * side * max) / (s * s), (s * s) / (side * side * min));
}

function layoutRow(row: Item[], r: Rect, tiles: Tile[]): void {
  const rowArea = row.reduce((a, it) => a + it.area, 0);
  if (r.w >= r.h) {
    const dw = rowArea / r.h;
    let y = r.y;
    for (const it of row) {
      const h = it.area / dw;
      tiles.push({ node: it.node, x: r.x, y, w: dw, h });
      y += h;
    }
    r.x += dw;
    r.w -= dw;
  } else {
    const dh = rowArea / r.w;
    let x = r.x;
    for (const it of row) {
      const w = it.area / dh;
      tiles.push({ node: it.node, x, y: r.y, w, h: dh });
      x += w;
    }
    r.y += dh;
    r.h -= dh;
  }
}

// Squarified treemap (Bruls, Huizing & van Wijk).
function squarify(nodes: TreemapNode[]): Tile[] {
  const total = nodes.reduce((a, n) => a + Math.max(n.value, 0), 0) || 1;
  const items: Item[] = nodes
    .map((node) => ({ node, area: (Math.max(node.value, 0) / total) * (W * H) }))
    .sort((a, b) => b.area - a.area);

  const tiles: Tile[] = [];
  const r: Rect = { x: 0, y: 0, w: W, h: H };
  let remaining = items;

  while (remaining.length) {
    const side = Math.min(r.w, r.h);
    let row: Item[] = [];
    let i = 0;
    while (i < remaining.length) {
      const test = [...row, remaining[i]];
      if (
        row.length === 0 ||
        worst(test.map((t) => t.area), side) <= worst(row.map((t) => t.area), side)
      ) {
        row = test;
        i++;
      } else {
        break;
      }
    }
    layoutRow(row, r, tiles);
    remaining = remaining.slice(row.length);
  }
  return tiles;
}

export function Treemap({ nodes, "aria-label": ariaLabel }: TreemapProps) {
  const tiles = squarify(nodes);
  return (
    <div className="lf-treemap">
      <svg
        className="lf-treemap__svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={ariaLabel ?? "Holdings heatmap"}
      >
        {tiles.map((t, i) => (
          <g key={i}>
            <rect
              className={`lf-treemap__cell-rect lf-treemap__cell--${t.node.tone}`}
              x={t.x}
              y={t.y}
              width={t.w}
              height={t.h}
            />
            {t.w > 10 && t.h > 6 && (
              <text
                className={`lf-treemap__label${t.node.tone === "flat" ? " lf-treemap__label--flat" : ""}`}
                x={t.x + 1.5}
                y={t.y + 4.5}
              >
                {t.node.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

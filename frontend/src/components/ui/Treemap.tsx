import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";
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

// page-heatmap ND-7 (§5 amendment, PROPOSED): a tile carrying `href` becomes a
// keyboard-operable link (focusable, Enter native + Space handled) to its entity
// (D-098). Focus/hover use outline + inset shadow only — NO layout shift.
function activateOnSpace(e: ReactKeyboardEvent<HTMLAnchorElement>): void {
  if (e.key === " " || e.key === "Spacebar") {
    e.preventDefault();
    e.currentTarget.click();
  }
}

interface Rect { x: number; y: number; w: number; h: number; }
interface Tile extends Rect { node: TreemapNode; }
interface Item { node: TreemapNode; area: number; }

const W = 100;
const H = 60;

// Map a day-move magnitude (%) to a fill-intensity percentage: a soft muted
// tint near zero (FLOOR), reaching full at CAP% and above (amended 2026-07-10).
const INTENSITY_FLOOR = 15;
const INTENSITY_CAP_PCT = 5;
function intensity(magnitudePct: number | undefined): string {
  if (magnitudePct === undefined) return "100%";
  const t = Math.min(Math.abs(magnitudePct), INTENSITY_CAP_PCT) / INTENSITY_CAP_PCT;
  return `${Math.round(INTENSITY_FLOOR + t * (100 - INTENSITY_FLOOR))}%`;
}

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
      {/* Rects fill the container (distortion is fine for area). Labels are an
       * HTML overlay positioned by percentage so text stays crisp and square. */}
      <svg
        className="lf-treemap__svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={ariaLabel ?? "Holdings heatmap"}
      >
        {tiles.map((t, i) => (
          <rect
            key={i}
            className={`lf-treemap__cell-rect lf-treemap__cell--${t.node.tone}`}
            x={t.x}
            y={t.y}
            width={t.w}
            height={t.h}
            style={
              t.node.tone === "flat"
                ? undefined
                : ({ "--fill-intensity": intensity(t.node.magnitudePct) } as CSSProperties)
            }
          />
        ))}
      </svg>
      <div className="lf-treemap__labels" aria-hidden="true">
        {tiles.map((t, i) =>
          t.w > 8 && t.h > 6 ? (
            <span
              key={i}
              className={`lf-treemap__label${t.node.tone === "flat" ? " lf-treemap__label--flat" : ""}`}
              style={
                {
                  "--tx": `${(t.x / W) * 100}%`,
                  "--ty": `${(t.y / H) * 100}%`,
                } as CSSProperties
              }
            >
              {t.node.label}
            </span>
          ) : null,
        )}
      </div>
      {/* ND-7: interactive layer — one keyboard-operable link per tile that carries an href.
       * It overlays the svg exactly (percentage-positioned), so pointer + keyboard both land on
       * the right tile; the accessible name is the tile's label. Absent href ⇒ no link rendered. */}
      {tiles.some((t) => t.node.href) ? (
        <div className="lf-treemap__links">
          {tiles.map((t, i) =>
            t.node.href ? (
              <a
                key={i}
                className="lf-treemap__link"
                href={t.node.href}
                aria-label={t.node.label}
                onKeyDown={activateOnSpace}
                style={
                  {
                    "--tx": `${(t.x / W) * 100}%`,
                    "--ty": `${(t.y / H) * 100}%`,
                    "--tw": `${(t.w / W) * 100}%`,
                    "--th": `${(t.h / H) * 100}%`,
                  } as CSSProperties
                }
              />
            ) : null,
          )}
        </div>
      ) : null}
    </div>
  );
}

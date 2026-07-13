// Platform icon set (ADR-0003): lucide-react, bundled + tree-shaken (no CDN, no
// runtime fetch — no-egress applies to assets). This is the ONE place the app's icon
// vocabulary is declared; components import from here. Size comes from `--icon-size`
// (see structure.css `.lf-iconbtn svg`), colour from `currentColor`, so icons follow
// the token layer + theme automatically.
export {
  // Theme (light / dark / system)
  Sun,
  Moon,
  Monitor,
  // Density (comfortable / compact)
  Rows2,
  Rows4,
  // Contrast (system / normal / high)
  Contrast,
  Circle,
  Disc,
  // Motion (full / reduced / system)
  Waves,
  Minus,
  Wind,
  // Rotation (on / off)
  RotateCw,
  Ban,
  // Detail level (simple line / full candlestick)
  LineChart,
  CandlestickChart,
  // Menu / overflow
  Menu,
  MoreHorizontal,
  // Page actions
  Pencil,
  Upload,
  Download,
  Plus,
  CircleCheck,
  // Status
  TriangleAlert,
} from "lucide-react";

export type { LucideIcon } from "lucide-react";

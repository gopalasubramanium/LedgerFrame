import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import "./chrome.css";
import "./structure.css";

// Stateful-glyph rule (DESIGN-SYSTEM §5.5): each toggle shows a state-distinct glyph;
// the tooltip names the state ("Function: state"), and the aria-label matches. Rotation
// = arrows(on)/slashed(off); Detail = line(simple) vs candlestick(full). No collision
// with ☰ (sidebar/menu toggle).
const ROTATION_ICON = { on: "↻", off: "⊘" } as const;
const DETAIL_ICON = { simple: "╱", full: "╪" } as const;

// Global chrome (DESIGN-SYSTEM §5.5, D-066). The ONE slim top bar. At laptop+ the
// display axes + rotation + Detail render inline, right-aligned. Below the laptop
// breakpoint (D-102 extension, batch 2 §11-11) they collapse into a single overflow
// popover so the bar never wraps at any width ≥320px: ☰ + brand + overflow + Clock +
// DemoBadge. The DemoBadge shows in the bar only at narrow widths (at laptop+ it lives
// in the sidebar footer — §11-12).
export interface TopBarProps {
  /** Open the off-canvas sidebar at narrow widths (D-102). */
  onToggleNav?: () => void;
  /** The per-device display axes, relocated here from the page (D-066/D-078). */
  controls?: ReactNode;
  /** Timezone Clock (D-013). */
  clock?: ReactNode;
  /** DemoBadge (narrow widths only; at laptop+ it renders in the sidebar footer). */
  demoBadge?: ReactNode;
  /** Rotation toggle state + handler (D-044); rendered only when a handler is given. */
  rotationOn?: boolean;
  onToggleRotation?: () => void;
  /** App-wide Detail level (D-040); rendered only when a handler is given. */
  detailLevel?: "simple" | "full";
  onToggleDetail?: () => void;
  /** Reserved slot for the Ask panel (D-067) — DEFERRED (C-2). */
  askSlot?: ReactNode;
}

export function TopBar({
  onToggleNav,
  controls,
  clock,
  demoBadge,
  rotationOn,
  onToggleRotation,
  detailLevel,
  onToggleDetail,
  askSlot,
}: TopBarProps) {
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);

  // Close the overflow popover on outside-click / Esc.
  useEffect(() => {
    if (!overflowOpen) return;
    const onDown = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOverflowOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [overflowOpen]);

  // The display axes + rotation + Detail — rendered inline (laptop+) AND inside the
  // overflow popover (narrow). DisplayControls is context-driven, so two instances
  // stay in sync.
  const axes = (
    <>
      {controls}
      {onToggleRotation && (
        <button
          type="button"
          className="lf-iconbtn"
          aria-pressed={rotationOn}
          aria-label={`Rotation: ${rotationOn ? "On" : "Off"}`}
          title={`Rotation: ${rotationOn ? "On" : "Off"}`}
          onClick={onToggleRotation}
        >
          {rotationOn ? ROTATION_ICON.on : ROTATION_ICON.off}
        </button>
      )}
      {onToggleDetail && (
        <button
          type="button"
          className="lf-iconbtn"
          aria-label={`Detail: ${detailLevel === "full" ? "Full" : "Simple"}`}
          title={`Detail: ${detailLevel === "full" ? "Full" : "Simple"}`}
          onClick={onToggleDetail}
        >
          {detailLevel === "full" ? DETAIL_ICON.full : DETAIL_ICON.simple}
        </button>
      )}
    </>
  );

  return (
    <header className="lf-topbar">
      {onToggleNav && (
        <button
          type="button"
          className="lf-iconbtn lf-topbar__navtoggle"
          aria-label="Open navigation"
          title="Menu"
          onClick={onToggleNav}
        >
          ☰
        </button>
      )}
      <div className="lf-topbar__brand">LedgerFrame</div>

      <div className="lf-topbar__right">
        {/* Inline at laptop+ */}
        <div className="lf-topbar__axes">{axes}</div>

        {/* Overflow popover below the laptop breakpoint */}
        <div className="lf-topbar__overflow" ref={overflowRef}>
          <button
            type="button"
            className="lf-iconbtn"
            aria-haspopup="menu"
            aria-expanded={overflowOpen}
            aria-label="Display settings"
            title="Display settings"
            onClick={() => setOverflowOpen((v) => !v)}
          >
            ⋯
          </button>
          {overflowOpen && (
            <div className="lf-topbar__popover" role="menu">
              {axes}
            </div>
          )}
        </div>

        {clock}
        <span className="lf-topbar__demo">{demoBadge}</span>
        {askSlot}
      </div>
    </header>
  );
}

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import "./chrome.css";
import "./structure.css";
import { RotateCw, Ban, Menu, MoreHorizontal } from "../../icons";
import { BrandLockup } from "./BrandLockup";

// Stateful-icon rule (DESIGN-SYSTEM §5.5, lucide ADR-0003): each toggle shows a
// state-distinct icon; the tooltip names the state ("Function: state") and the
// aria-label matches. Rotation = RotateCw(on)/Ban(off) — the ONE toggle this bar owns.
// The Detail toggle was REMOVED (page-home §9-15, DESIGN-SYSTEM §5.5 amendment) — it held state that
// persisted nowhere. Nothing replaced it: §12ho1-6 removed the Simple layout, so Home has ONE layout
// and there is no layout to toggle, in this bar or in Settings. Menu is the nav toggle.

// Global chrome (DESIGN-SYSTEM §5.5, D-066). The ONE slim top bar. At laptop+ the
// display axes + rotation render inline, right-aligned. Below the laptop
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
          {rotationOn ? <RotateCw aria-hidden="true" /> : <Ban aria-hidden="true" />}
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
          <Menu aria-hidden="true" />
        </button>
      )}
      <div className="lf-topbar__brand">
        <BrandLockup />
      </div>

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
            <MoreHorizontal aria-hidden="true" />
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

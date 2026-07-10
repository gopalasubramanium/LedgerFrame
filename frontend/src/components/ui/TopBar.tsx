import type { ReactNode } from "react";
import "./chrome.css";
import "./structure.css";

// Global chrome (DESIGN-SYSTEM §5.5, D-066) — PROPOSED 2026-07-11. The ONE top bar,
// composed once above every page. It is a layout container: the shell supplies the
// pieces (banners, the relocated DisplayControls, Clock, DemoBadge, the reserved Ask
// slot) and TopBar arranges them, plus it owns the two chrome toggles that live only
// here — rotation (D-044) and Detail level (D-040; only Home branches on it). At
// narrow widths it shows the sidebar nav toggle (D-102); at laptop+ that toggle is
// hidden by CSS.
export interface TopBarProps {
  /** Open the off-canvas sidebar at narrow widths (D-102). */
  onToggleNav?: () => void;
  /** StaleBanner / UpdateBanner (status summaries; canonical elsewhere). */
  banners?: ReactNode;
  /** The per-device display axes, relocated here from the page (D-066/D-078). */
  controls?: ReactNode;
  /** Timezone Clock (D-013). */
  clock?: ReactNode;
  /** DemoBadge when demo data is loaded. */
  demoBadge?: ReactNode;
  /** Rotation toggle state + handler (D-044); rendered only when a handler is given. */
  rotationOn?: boolean;
  onToggleRotation?: () => void;
  /** App-wide Detail level (D-040); rendered only when a handler is given. */
  detailLevel?: "simple" | "full";
  onToggleDetail?: () => void;
  /** Reserved slot for the Ask panel (D-067) — DEFERRED to the AI-surfaces
      milestone (C-2). The shell leaves this empty for now; D-067 is not dropped. */
  askSlot?: ReactNode;
}

export function TopBar({
  onToggleNav,
  banners,
  controls,
  clock,
  demoBadge,
  rotationOn,
  onToggleRotation,
  detailLevel,
  onToggleDetail,
  askSlot,
}: TopBarProps) {
  return (
    <header className="lf-topbar">
      {onToggleNav && (
        <button
          type="button"
          className="lf-btn lf-topbar__navtoggle"
          aria-label="Open navigation"
          onClick={onToggleNav}
        >
          ☰
        </button>
      )}

      <div className="lf-topbar__banners">{banners}</div>

      <div className="lf-topbar__right">
        {onToggleRotation && (
          <button
            type="button"
            className={`lf-btn${rotationOn ? " lf-btn--primary" : ""}`}
            aria-pressed={rotationOn}
            onClick={onToggleRotation}
          >
            Rotation: {rotationOn ? "On" : "Off"}
          </button>
        )}
        {onToggleDetail && (
          <button
            type="button"
            className="lf-btn"
            aria-label="Toggle detail level"
            onClick={onToggleDetail}
          >
            Detail: {detailLevel === "full" ? "Full" : "Simple"}
          </button>
        )}
        {controls}
        {clock}
        {demoBadge}
        {askSlot}
      </div>
    </header>
  );
}

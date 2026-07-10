import type { ReactNode } from "react";
import "./chrome.css";
import "./structure.css";

// Global chrome (DESIGN-SYSTEM §5.5, D-066) — recomposed 2026-07-11 (page-chrome
// Phase 0a re-ratify). The ONE top bar, composed once above every page. A slim
// (~48px) calm register: NO banners live here (StaleBanner/UpdateBanner render as
// full-width status strips BELOW the bar). Brand "LedgerFrame" sits top-LEFT but
// only at narrow widths — at laptop+ the sidebar header carries it, so exactly one
// brand is ever visible (never two, D-066).
//
// Right cluster, right-aligned and icon-only: the relocated display axes
// (theme/density/contrast/motion via `controls`), then the two toggles this bar
// owns — rotation (D-044) and Detail level (D-040, only Home branches) — then the
// Clock and the DemoBadge. At narrow widths the sidebar nav toggle appears (D-102).
export interface TopBarProps {
  /** Open the off-canvas sidebar at narrow widths (D-102). */
  onToggleNav?: () => void;
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
        {controls}
        {onToggleRotation && (
          <button
            type="button"
            className="lf-iconbtn"
            aria-pressed={rotationOn}
            aria-label={`Rotation: ${rotationOn ? "On" : "Off"}. Click to toggle.`}
            title={`Rotation: ${rotationOn ? "On" : "Off"}`}
            onClick={onToggleRotation}
          >
            ↻
          </button>
        )}
        {onToggleDetail && (
          <button
            type="button"
            className="lf-iconbtn"
            aria-label={`Detail level: ${detailLevel === "full" ? "Full" : "Simple"}. Click to toggle.`}
            title={`Detail: ${detailLevel === "full" ? "Full" : "Simple"}`}
            onClick={onToggleDetail}
          >
            ⊕
          </button>
        )}
        {clock}
        {demoBadge}
        {askSlot}
      </div>
    </header>
  );
}

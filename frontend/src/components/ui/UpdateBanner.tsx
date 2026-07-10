import { Link } from "react-router-dom";
import "./chrome.css";

// Global chrome (DESIGN-SYSTEM §5.5, D-066) — PROPOSED 2026-07-11. Announces an
// available app version and links to Settings/About.
//
// Recomposed 2026-07-11 (re-ratify) — renders as a full-width slim strip BELOW the
// top bar (pushing content, never overlaying), only when a newer version exists.
//
// NO-EGRESS (D-075/D-060): this component is PRESENTATIONAL and makes NO network
// call itself. The version is supplied by a no-egress-guarded reader — when the
// no-egress toggle is on, that reader performs ZERO outbound calls and passes
// `version = null`, so the strip simply never renders. The zero-outbound guarantee
// is verified at the data layer (Phase 1 + the network-trace acceptance test, C-3),
// not here. Renders nothing when there is no newer version (honest).
export interface UpdateBannerProps {
  /** The available newer version, or null (incl. always-null under no-egress). */
  version: string | null;
  /** Canonical destination (Settings / About). */
  href?: string;
  onDismiss?: () => void;
}

export function UpdateBanner({ version, href = "/settings", onDismiss }: UpdateBannerProps) {
  if (!version) return null;
  return (
    <div className="lf-statusstrip lf-statusstrip--update" role="status">
      <span>Version {version} is available</span>
      <Link className="lf-statusstrip__link" to={href}>
        About →
      </Link>
      {onDismiss && (
        <button
          type="button"
          className="lf-statusstrip__dismiss"
          aria-label="Dismiss update notice"
          onClick={onDismiss}
        >
          ✕
        </button>
      )}
    </div>
  );
}

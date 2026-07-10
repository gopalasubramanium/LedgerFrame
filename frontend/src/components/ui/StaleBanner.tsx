import { Link } from "react-router-dom";
import "./chrome.css";

// Global chrome (DESIGN-SYSTEM §5.5, D-066) — recomposed 2026-07-11 (re-ratify). A
// status summary, NOT a canonical figure: it reads the `has_stale` / stale count from
// the summary reader and links to the canonical page (Pricing Health) — it never
// recomputes and owns nothing (IA P-1). Renders as a full-width slim strip BELOW the
// top bar (pushing content, never overlaying), only when active. Amber attention only
// (§2.1). Hidden entirely when nothing is stale (honest — no "0 stale" noise).
export interface StaleBannerProps {
  /** Count of stale-priced positions from the summary reader. */
  count: number;
  /** Canonical destination (Pricing Health). */
  href?: string;
}

export function StaleBanner({ count, href = "/pricing-health" }: StaleBannerProps) {
  if (count <= 0) return null;
  return (
    <div className="lf-statusstrip lf-statusstrip--stale" role="status">
      <span aria-hidden="true">⚠</span>
      <span>
        {count} {count === 1 ? "price is" : "prices are"} stale
      </span>
      <Link className="lf-statusstrip__link" to={href}>
        Pricing Health →
      </Link>
    </div>
  );
}

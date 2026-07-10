import "./badges.css";
import "./chrome.css";

// Global chrome (DESIGN-SYSTEM §5.5, D-066) — PROPOSED 2026-07-11. Signals that the
// instance is running on demo/seed data, so no number on screen is real. Renders
// nothing when not in demo mode (honest — the badge is only ever an active warning).
export interface DemoBadgeProps {
  /** True when the backend reports demo/seed data is loaded. */
  active?: boolean;
}

export function DemoBadge({ active = true }: DemoBadgeProps) {
  if (!active) return null;
  return (
    <span className="lf-badge lf-badge--demo" title="This instance is showing demo data — no figure here is real.">
      Demo data
    </span>
  );
}

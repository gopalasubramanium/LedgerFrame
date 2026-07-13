import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import "./structure.css";

// SummaryLink — the ONE linked-summary affordance (DESIGN-SYSTEM §5, page-home §12ho1-2).
//
// A summary tile shows a figure another page OWNS; it must always say where the full detail lives.
// That affordance had drifted into page-local variants (a text link under the title, a bare corner
// glyph, a link in the header row), so at its 3rd recurrence it is CENTRALISED here: the corner ↗,
// top-right of the tile. Titles are never text links, and there are no page-local variants.
//
// Accessibility: both forms are a real link (keyboard focusable, Enter activates natively) carrying
// `data-summarylink`; the ↗ glyph is decorative, so the accessible name comes from `aria-label` and
// always NAMES THE DESTINATION. `whole` makes the entire header the click target — for PURE summary
// tiles only. A header with its own interactive content (a [Help] popover) must NOT use it: nesting
// an interactive element inside a link is an accessibility defect.

export interface SummaryLinkProps {
  /** Route of the page that owns the figure. */
  to: string;
  /** The destination's name — becomes the accessible name (e.g. "Portfolio"). */
  destination: string;
}

export function SummaryLink({ to, destination }: SummaryLinkProps) {
  return (
    <Link className="lf-summarylink" data-summarylink to={to} aria-label={destination} title={destination}>
      <span className="lf-summarylink__glyph" aria-hidden="true">↗</span>
    </Link>
  );
}

export interface SummaryHeadProps {
  /** Tile title. May contain a [Help] popover — in which case do NOT pass `whole`. */
  title: ReactNode;
  to: string;
  destination: string;
  /** Make the whole header the click target (pure-summary tiles only — no interactive title). */
  whole?: boolean;
}

/** A summary tile's header: the title, with the ↗ affordance pinned top-right. */
export function SummaryHead({ title, to, destination, whole }: SummaryHeadProps) {
  if (whole) {
    return (
      <Link
        className="lf-summaryhead lf-summaryhead--whole lf-summarylink"
        data-summarylink
        to={to}
        aria-label={destination}
        title={destination}
      >
        <h2 className="lf-summaryhead__title">{title}</h2>
        <span className="lf-summarylink__glyph" aria-hidden="true">↗</span>
      </Link>
    );
  }
  return (
    <div className="lf-summaryhead">
      <h2 className="lf-summaryhead__title">{title}</h2>
      <SummaryLink to={to} destination={destination} />
    </div>
  );
}

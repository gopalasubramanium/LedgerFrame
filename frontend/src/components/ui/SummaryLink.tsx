import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import "./structure.css";

// SummaryLink / SummaryHead — the ONE linked-summary affordance (DESIGN-SYSTEM §5, page-home §12ho1-2).
//
// A summary tile shows a figure another page OWNS; it must always say where the full detail lives.
// That affordance had drifted into page-local variants (a text link under the title, a bare corner
// glyph, a link in the header row), so at its 3rd recurrence it was CENTRALISED here: the corner ↗,
// top-right of the tile. Titles are never text links, and there are no page-local variants.
//
// §12ho2-8 — the ↗ is the LUCIDE `arrow-up-right` SVG (ADR-0003's icon set), not a text glyph. A
// typographic "↗" renders differently in every font and sits on the text baseline rather than optically
// centred on the title. One component, so every site got it at once.
//
// §12ho2-5 — the header is UNIFORM: title left, optional `meta` (trailing), ↗ right — one type size,
// one weight, one spacing, everywhere. `meta` is what killed the page-local header variants: Review's
// attention count and the Quotes source select now sit IN the header row instead of each tile
// inventing its own bar.
//
// Accessibility: both forms are a real link (keyboard focusable, Enter activates) carrying
// `data-summarylink`; the icon is decorative (`aria-hidden`), so the accessible name comes from
// `aria-label` and always NAMES THE DESTINATION. `whole` makes the entire header the click target —
// for PURE summary tiles only. A header with its own interactive content (a [Help] popover, a Select)
// must NOT use it: nesting an interactive element inside a link is an accessibility defect.

export interface SummaryLinkProps {
  /** Route of the page that owns the figure. */
  to: string;
  /** The destination's name — becomes the accessible name (e.g. "Portfolio"). */
  destination: string;
}

export function SummaryLink({ to, destination }: SummaryLinkProps) {
  return (
    <Link className="lf-summarylink" data-summarylink to={to} aria-label={destination} title={destination}>
      <ArrowUpRight className="lf-summarylink__glyph" aria-hidden="true" focusable="false" />
    </Link>
  );
}

export interface SummaryHeadProps {
  /** Tile title. May contain a [Help] popover — in which case do NOT pass `whole`. */
  title: ReactNode;
  to: string;
  destination: string;
  /** Trailing meta in the SAME header row (an attention count, a scope select). Never a second bar. */
  meta?: ReactNode;
  /** Make the whole header the click target (pure-summary tiles only — no interactive content). */
  whole?: boolean;
}

/** A summary tile's header: the title, optional trailing meta, and the ↗ pinned top-right. */
export function SummaryHead({ title, to, destination, meta, whole }: SummaryHeadProps) {
  if (whole) {
    // NOT `lf-summarylink` on the header — that class absolutely-positions the corner GLYPH, and
    // putting it here made the HEADER itself absolute (it wins over `.lf-summaryhead { position:
    // relative }` on source order), tearing every whole-header out of its tile and piling them in the
    // page's corner (§12ho1-4). The header is a link; it is not the glyph.
    return (
      <Link
        className="lf-summaryhead lf-summaryhead--whole"
        data-summarylink
        to={to}
        aria-label={destination}
        title={destination}
      >
        <h2 className="lf-summaryhead__title">{title}</h2>
        {meta && <span className="lf-summaryhead__meta">{meta}</span>}
        <ArrowUpRight className="lf-summarylink__glyph" aria-hidden="true" focusable="false" />
      </Link>
    );
  }
  return (
    <div className="lf-summaryhead">
      <h2 className="lf-summaryhead__title">{title}</h2>
      {meta && <span className="lf-summaryhead__meta">{meta}</span>}
      <SummaryLink to={to} destination={destination} />
    </div>
  );
}

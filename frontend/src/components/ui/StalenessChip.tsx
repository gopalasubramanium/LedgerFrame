import "./badges.css";

// Amber chip for the Stale layer (GLOSSARY layer 2). It FLAGS, never hides, the
// value — distinct from ProvenanceBadge (which carries full source·freshness·
// confidence). When not stale it renders nothing.
export interface StalenessChipProps {
  isStale: boolean;
  /** ISO timestamp the value was as-of. */
  asOf: string;
  staleAfter?: number;
}

function asOfLabel(asOf: string): string {
  const d = new Date(asOf);
  return Number.isNaN(d.getTime())
    ? asOf
    : d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

export function StalenessChip({ isStale, asOf }: StalenessChipProps) {
  if (!isStale) return null;
  return (
    <span className="lf-stale" title={`As of ${asOf}`}>
      <span className="lf-stale__glyph" aria-hidden="true">
        ⚠
      </span>
      Stale · as of {asOfLabel(asOf)}
    </span>
  );
}

import "./skeleton.css";

// Loading placeholder for progressive, per-card loading (§12-8 / TEMPLATE amendment). Token-only
// shimmer that collapses to a static tint under reduced motion. Each overview card shows its own
// Skeleton until its reader resolves — no full-page block on the slowest reader.
export interface SkeletonProps {
  /** Number of placeholder bars. */
  lines?: number;
  /** Optional height for a single block (e.g. a chart area) instead of text bars. */
  block?: boolean;
  "aria-label"?: string;
}

export function Skeleton({ lines = 3, block = false, "aria-label": ariaLabel = "Loading…" }: SkeletonProps) {
  return (
    <div className={`lf-skeleton${block ? " lf-skeleton--block" : ""}`} role="status" aria-label={ariaLabel} aria-busy="true">
      {Array.from({ length: block ? 1 : lines }).map((_, i) => (
        <div key={i} className="lf-skeleton__bar" aria-hidden="true" />
      ))}
    </div>
  );
}

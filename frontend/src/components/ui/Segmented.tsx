import type { ReactNode } from "react";
import "./segmented.css";

// The ratified segmented-button control (DESIGN-SYSTEM §5.2, EXTRACTED 2026-07-13 — page-news §13a).
// The pattern had recurred 3× (PriceChart periods, Markets region tabs, News buckets); per the
// centralization rule those page-local copies are replaced by this one primitive. `role="group"` +
// `aria-pressed`; one option active at a time; wraps at narrow widths (no overflow). An option's
// `label` is a ReactNode, so a tab may carry a count badge (`lf-segbtn__count`).
export interface SegmentedOption {
  value: string;
  label: ReactNode;
}
export interface SegmentedProps {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  "aria-label": string;
}

export function Segmented({ options, value, onChange, "aria-label": ariaLabel }: SegmentedProps) {
  return (
    <div className="lf-segmented" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`lf-segbtn${o.value === value ? " lf-segbtn--on" : ""}`}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

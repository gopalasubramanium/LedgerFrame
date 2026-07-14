// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ReactNode } from "react";
import "./badges.css";

/** Semantic tone. Colour is NEVER the sole signal — the label always carries the meaning (WCAG). */
export type StatusChipTone = "neutral" | "attention" | "positive" | "negative";

export interface StatusChipProps {
  /**
   * The SERVED display string, rendered verbatim (D-005) — never a raw enum key.
   * MANDATORY: a chip's meaning is never carried by colour alone (WCAG 1.4.1). `ReactNode` so a
   * chip may carry a link (Pricing Health's "add in Settings") — it is still always a visible label.
   */
  label: ReactNode;
  tone?: StatusChipTone;
  /** Optional trailing count, e.g. "Delayed · 3". */
  count?: number;
  title?: string;
}

/**
 * StatusChip — THE status/severity chip (DESIGN-SYSTEM §5.3 amendment, page-policy §9-15).
 *
 * Extracted at the THIRD recurrence of the same page-local pattern (Pricing Health's `ph__chip`,
 * Review's `rv__chip`, and Policy's band chip), per the centralization rule the Segmented extraction
 * set: *per-instance copies of a standard are the defect*. Both page-local copies are migrated onto
 * this component; neither remains.
 *
 * The label is MANDATORY and always rendered: a chip's meaning may never be carried by colour alone.
 */
export function StatusChip({ label, tone = "neutral", count, title }: StatusChipProps) {
  return (
    <span className={`lf-statuschip lf-statuschip--${tone}`} title={title}>
      {label}
      {count !== undefined && <span className="lf-statuschip__count">· {count}</span>}
    </span>
  );
}

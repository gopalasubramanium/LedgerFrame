// SPDX-License-Identifier: AGPL-3.0-or-later
import "./brand.css";
import { BrandMark } from "./BrandMark";

export interface BrandLockupProps {
  /** Positioning class from the host surface (e.g. `lf-sidebar__brand` / `lf-topbar__brand`
      supply padding + font; the lockup owns the internal mark↔wordmark geometry). */
  className?: string;
}

/**
 * BrandLockup — the ONE brand lockup: `[mark] LedgerFrame` (DESIGN-SYSTEM §5.6).
 *
 * The single ratified pairing of {@link BrandMark} + the wordmark, consumed by EVERY
 * surface that shows the brand — the sidebar brand row AND the mobile top bar. A surface
 * never hand-builds its own lockup: the mobile header once rendered a bare "LedgerFrame"
 * with no mark while the sidebar carried the mark (owner walk, 2026-07-17), because there
 * were two hand-built lockups. One component, one geometry, no drift.
 *
 * The mark is decorative (`aria-hidden`, from BrandMark); the wordmark is the accessible
 * name, so the lockup reads as one "LedgerFrame", never "graphic LedgerFrame". The mark is
 * sized to the wordmark's cap height so the row height stays TEXT-driven (the nav-density
 * math §5.5 is untouched).
 */
export function BrandLockup({ className }: BrandLockupProps) {
  return (
    <span className={className ? `lf-brandlockup ${className}` : "lf-brandlockup"}>
      <BrandMark className="lf-brandlockup__mark" />
      <span className="lf-brandlockup__word">LedgerFrame</span>
    </span>
  );
}

import { useEffect } from "react";
import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import "./chrome.css";
import { BrandLockup } from "./BrandLockup";
import { NAV_GROUPS } from "./nav";
import type { NavGroup } from "./nav";

// Global chrome (DESIGN-SYSTEM §5.5, D-066) — PROPOSED 2026-07-11. The app's ONE
// sidebar: six fixed groups in fixed order (D-043), active-route highlight, NOT
// reorderable (no customization control — D-043/D-069). Composed once around every
// page. Active state is derived from the router (NavLink), so it needs no props to
// stay in sync.
//
// Responsive (D-102): fixed and always visible at laptop+; off-canvas below laptop
// width, opened by the TopBar nav toggle. `open`/`onClose` drive that state; at wide
// widths they are inert (CSS keeps the panel static).
export interface SidebarProps {
  /** Off-canvas open state at narrow widths (D-102). Ignored at laptop+. */
  open?: boolean;
  /** Dismiss the off-canvas panel (scrim click / link follow). */
  onClose?: () => void;
  /** Override the canonical groups (tests/specimens only; defaults to NAV_GROUPS). */
  groups?: NavGroup[];
  /** Force the active highlight to a path, regardless of the router location.
      For previews/specimens only (e.g. the kitchen sink, where the real route is
      /kitchen-sink and no nav item would otherwise highlight). Omit in the shell —
      the router drives active state. */
  activePath?: string;
  /** Preview the full skeleton with EVERY page as an entry (specimens only). In the
      shell this stays false: only built pages (`item.built`) appear; every group
      header shows regardless (progressive reveal of the fixed D-043 skeleton). */
  showAll?: boolean;
  /** Bottom-left footer slot (e.g. DemoBadge at laptop+ — §11-12). Hidden below the
      laptop breakpoint, where the sidebar is off-canvas. */
  footer?: ReactNode;
}

export function Sidebar({
  open = false,
  onClose,
  groups = NAV_GROUPS,
  activePath,
  showAll = false,
  footer,
}: SidebarProps) {
  // Off-canvas (D-102): Esc dismisses it, matching the backdrop click. No-op at
  // laptop+ where the panel is fixed (open stays false there).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        className={`lf-sidebar__scrim${open ? " is-open" : ""}`}
        aria-hidden="true"
        onClick={onClose}
      />
      <nav
        className={`lf-sidebar${open ? " is-open" : ""}`}
        aria-label="Primary"
      >
        <div className="lf-sidebar__brand">
          <BrandLockup />
        </div>
        <div className="lf-sidebar__nav">
          {groups.map((group) => {
            // Every group header always renders (fixed D-043 skeleton); only built
            // pages appear as entries unless previewing the full nav.
            const items = showAll ? group.items : group.items.filter((i) => i.built);
            return (
              <div className="lf-sidebar__group" key={group.label}>
                <div className="lf-sidebar__grouplabel">{group.label}</div>
                {items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === "/"}
                    className={({ isActive }) =>
                      `lf-sidebar__link${
                        isActive || activePath === item.path ? " is-active" : ""
                      }`
                    }
                    onClick={onClose}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </div>
        {footer && <div className="lf-sidebar__foot">{footer}</div>}
      </nav>
    </>
  );
}

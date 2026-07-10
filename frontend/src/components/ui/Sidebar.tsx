import { NavLink } from "react-router-dom";
import "./chrome.css";
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
}

export function Sidebar({ open = false, onClose, groups = NAV_GROUPS, activePath }: SidebarProps) {
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
        <div className="lf-sidebar__brand">LedgerFrame</div>
        <div className="lf-sidebar__nav">
          {groups.map((group) => (
            <div className="lf-sidebar__group" key={group.label}>
              <div className="lf-sidebar__grouplabel">{group.label}</div>
              {group.items.map((item) => (
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
          ))}
        </div>
      </nav>
    </>
  );
}

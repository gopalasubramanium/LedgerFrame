import { useEffect, useRef, useState } from "react";
import "./RowMenu.css";

// Compact per-row overflow menu (⋯) for worklist row actions — details / edit /
// delete etc. (DESIGN-SYSTEM worklist template: row actions are a standard
// affordance). Keeps tables narrow (a single icon column instead of wide text
// buttons), so a data-dense table degrades gracefully at laptop widths.
export interface RowMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export interface RowMenuProps {
  items: RowMenuItem[];
  "aria-label"?: string;
}

export function RowMenu({ items, "aria-label": ariaLabel = "Row actions" }: RowMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="lf-rowmenu" ref={ref}>
      <button
        type="button"
        className="lf-rowmenu__trigger"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        ⋯
      </button>
      {open && (
        <div className="lf-rowmenu__menu" role="menu">
          {items.map((it, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              className={`lf-rowmenu__item${it.danger ? " lf-rowmenu__item--danger" : ""}`}
              disabled={it.disabled}
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

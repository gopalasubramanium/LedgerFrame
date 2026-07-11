import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./inputs.css";
import "./firstrun.css";

// PROPOSED (DESIGN-SYSTEM §5.5 amendment, page-first-run-checklist Phase 0a). A
// SEARCHABLE picker over an arbitrary option list — the ratified inventory had none
// (InstrumentPicker is instrument-bound; Select/MasterSelect are native selects, poor
// for ~hundreds of options). Backs the timezone step's ~400 IANA options (F-4). The menu
// PORTALS to the viewport (fixed + max-height + internal scroll) per the universal
// popover rule (DESIGN-SYSTEM §6). NOT for MASTER-DATA categoricals — use MasterSelect.
export interface ComboboxOption {
  label: string;
  value: string;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  "aria-label"?: string;
}

export function Combobox({ options, value, onChange, placeholder, "aria-label": ariaLabel }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [rect, setRect] = useState<DOMRect | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedLabel = useMemo(
    () => options.find((o) => o.value === value)?.label ?? "",
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 100);
    return options.filter((o) => o.label.toLowerCase().includes(q)).slice(0, 100);
  }, [options, query]);

  useLayoutEffect(() => {
    if (open && inputRef.current) setRect(inputRef.current.getBoundingClientRect());
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      // The menu is PORTALED outside wrapRef — treat clicks inside it as inside too,
      // or the outside-click handler would close the menu before an option's click.
      const inside = wrapRef.current?.contains(t) || menuRef.current?.contains(t);
      if (!inside) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };
  const pick = (v: string) => {
    onChange(v);
    close();
  };

  return (
    <div className="lf-combo" ref={wrapRef}>
      <span className="lf-field lf-field--block">
        <input
          ref={inputRef}
          className="lf-field__input"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          autoComplete="off"
          placeholder={placeholder}
          value={open ? query : selectedLabel}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
        />
      </span>
      {open &&
        rect &&
        createPortal(
          <div
            ref={menuRef}
            className="lf-combo__menu"
            role="listbox"
            style={{ position: "fixed", top: rect.bottom + 4, left: rect.left, width: rect.width }}
          >
            {filtered.length === 0 ? (
              <div className="lf-combo__empty">No matches</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  className={`lf-combo__opt${o.value === value ? " is-active" : ""}`}
                  onClick={() => pick(o.value)}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

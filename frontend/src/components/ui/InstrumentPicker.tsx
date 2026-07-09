import { useMemo, useState } from "react";
import "./inputs.css";
import "./InstrumentPicker.css";
import { INSTRUMENTS } from "../../mocks/fixtures";
import type { Instrument } from "../../mocks/types";

// Typeahead over existing instruments + provider search, with an EXPLICIT
// "create new instrument" path — no silent auto-create (DESIGN-SYSTEM §5.1,
// D-012). Selecting an existing instrument carries its currency/asset_class.
export type InstrumentPick =
  | { kind: "existing"; instrument: Instrument }
  | { kind: "create"; query: string };

export interface InstrumentPickerProps {
  /** Selected instrument id, if any. */
  value?: string;
  onSelect: (pick: InstrumentPick) => void;
  allowCreate?: boolean;
  scope?: string;
  disabled?: boolean;
}

export function InstrumentPicker({
  value,
  onSelect,
  allowCreate = true,
  disabled,
}: InstrumentPickerProps) {
  const selected = INSTRUMENTS.find((i) => i.id === value);
  const [query, setQuery] = useState(selected ? selected.symbol : "");
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return INSTRUMENTS;
    return INSTRUMENTS.filter(
      (i) =>
        i.symbol.toLowerCase().includes(q) || i.name.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div className="lf-picker">
      <span
        className={`lf-field lf-field--block${disabled ? " lf-field--disabled" : ""}`}
      >
        <input
          className="lf-field__input"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-label="Instrument"
          placeholder="Search symbol or name…"
          value={query}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
        />
      </span>

      {open && (
        <ul className="lf-picker__menu" role="listbox">
          {matches.map((i) => (
            <li
              key={i.id}
              role="option"
              aria-selected={i.id === value}
              className={`lf-picker__option${i.id === value ? " lf-picker__option--active" : ""}`}
              onMouseDown={() => {
                onSelect({ kind: "existing", instrument: i });
                setQuery(i.symbol);
                setOpen(false);
              }}
            >
              <span className="lf-picker__sym">
                {i.symbol} · {i.currency}
              </span>
              <span className="lf-picker__name">{i.name}</span>
            </li>
          ))}

          {matches.length === 0 && !allowCreate && (
            <li className="lf-picker__empty">No instruments match.</li>
          )}

          {allowCreate && query.trim() && (
            <li
              role="option"
              aria-selected={false}
              className="lf-picker__option lf-picker__create"
              onMouseDown={() => {
                onSelect({ kind: "create", query: query.trim() });
                setOpen(false);
              }}
            >
              ＋ Create new instrument “{query.trim()}”
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

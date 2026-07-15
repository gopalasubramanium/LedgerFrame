import { useId } from "react";
import "./inputs.css";

// Plain free-text entry (DESIGN-SYSTEM §5.1, amended 2026-07-10 — Holdings
// page-build): the sanctioned control for name-like free text that is NOT a
// money/date/quantity/categorical field (e.g. manual-asset label, tag entry,
// free-text names). Wraps the native input internally so §6's "no raw <input>"
// rule holds. NOT for categorical data — use MasterSelect for those.
//
// `suggestions` (optional, page-insurance §9-5) attaches a native <datalist> —
// a free-text field with typeahead HINTS drawn from existing user data. It is a
// CONVENIENCE, not a vocabulary: any typed value is still accepted (unlike
// MasterSelect), so it never constrains input.
export interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
  onEnter?: () => void;
  suggestions?: string[];
  "aria-label": string;
}

export function TextInput({
  value,
  onChange,
  placeholder,
  disabled,
  maxLength,
  onEnter,
  suggestions,
  "aria-label": ariaLabel,
}: TextInputProps) {
  const listId = useId();
  return (
    <span className={`lf-field lf-field--block${disabled ? " lf-field--disabled" : ""}`}>
      <input
        className="lf-field__input"
        type="text"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        aria-label={ariaLabel}
        list={suggestions && suggestions.length ? listId : undefined}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={
          onEnter
            ? (e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onEnter();
                }
              }
            : undefined
        }
      />
      {suggestions && suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </span>
  );
}

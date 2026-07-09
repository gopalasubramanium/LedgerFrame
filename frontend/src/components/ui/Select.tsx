import "./inputs.css";

// Generic select ui primitive for non-master UI scopes (e.g. the QuoteCardRow
// source selector, D-046). Categorical DATA fields must use MasterSelect
// instead — this exists so §6's "no raw <select>" rule holds for view-scope
// controls too.
export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  "aria-label": string;
}

export function Select({
  value,
  onChange,
  options,
  disabled,
  "aria-label": ariaLabel,
}: SelectProps) {
  return (
    <span className={`lf-field${disabled ? " lf-field--disabled" : ""}`}>
      <select
        className="lf-field__select"
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}

import "./inputs.css";
import { CommitMenu } from "./CommitMenu";

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
  /** When set, the control commits on EVERY pick — including re-selecting the value already
   *  shown (a native <select> emits no change for a same-value pick). Used by the first-run
   *  checklist so confirming a pre-filled suggestion writes + confirms the step (F3). */
  onCommit?: (value: string) => void;
  "aria-label": string;
}

export function Select({
  value,
  onChange,
  options,
  disabled,
  onCommit,
  "aria-label": ariaLabel,
}: SelectProps) {
  if (onCommit) {
    return (
      <CommitMenu options={options} value={value} onCommit={onCommit} disabled={disabled} aria-label={ariaLabel} />
    );
  }
  return (
    <span className={`lf-field lf-field--select${disabled ? " lf-field--disabled" : ""}`}>
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

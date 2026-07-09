import "./inputs.css";
import type { DecimalString } from "../../format/number";

// Targets, bands, thresholds (DESIGN-SYSTEM §5.1). 2dp; shows %. Note: a plain
// day count like long_term_days is a number input, NOT this control.
export interface PercentInputProps {
  value: DecimalString;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  "aria-label": string;
}

export function PercentInput({
  value,
  onChange,
  min,
  max,
  disabled,
  "aria-label": ariaLabel,
}: PercentInputProps) {
  return (
    <span
      className={`lf-field lf-field--block${disabled ? " lf-field--disabled" : ""}`}
    >
      <input
        className="lf-field__input lf-field__input--num"
        inputMode="decimal"
        type="text"
        value={value ?? ""}
        min={min}
        max={max}
        disabled={disabled}
        aria-label={ariaLabel}
        placeholder="0.00"
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="lf-field__adornment" aria-hidden="true">
        %
      </span>
    </span>
  );
}

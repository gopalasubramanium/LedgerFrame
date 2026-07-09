import "./inputs.css";
import type { DecimalString } from "../../format/number";

// Share/unit quantities (DESIGN-SYSTEM §5.1): high precision, tabular,
// right-aligned. No financial math — the string is passed up verbatim.
export interface QuantityInputProps {
  value: DecimalString;
  onChange: (value: string) => void;
  /** Per-instrument display precision. */
  precision?: number;
  step?: number;
  disabled?: boolean;
  "aria-label": string;
}

export function QuantityInput({
  value,
  onChange,
  step,
  disabled,
  "aria-label": ariaLabel,
}: QuantityInputProps) {
  return (
    <span
      className={`lf-field lf-field--block${disabled ? " lf-field--disabled" : ""}`}
    >
      <input
        className="lf-field__input lf-field__input--num"
        inputMode="decimal"
        type="text"
        value={value ?? ""}
        step={step}
        disabled={disabled}
        aria-label={ariaLabel}
        placeholder="0"
        onChange={(e) => onChange(e.target.value)}
      />
    </span>
  );
}

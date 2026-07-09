import "./inputs.css";
import type { DecimalString } from "../../format/number";

// The ONLY control for money entry (DESIGN-SYSTEM §5.1). Currency-aware; no
// client-side money math — the string is passed straight up. Currency options
// come from the currency master (MASTER-DATA §3). Renders 2dp, tabular.
export interface MoneyInputProps {
  value: DecimalString;
  /** ISO code from the currency master. */
  currency: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  "aria-label": string;
}

export function MoneyInput({
  value,
  currency,
  onChange,
  min,
  max,
  disabled,
  "aria-label": ariaLabel,
}: MoneyInputProps) {
  return (
    <span
      className={`lf-field lf-field--block${disabled ? " lf-field--disabled" : ""}`}
    >
      <span className="lf-field__adornment" aria-hidden="true">
        {currency}
      </span>
      <input
        className="lf-field__input lf-field__input--num"
        inputMode="decimal"
        type="text"
        value={value ?? ""}
        disabled={disabled}
        min={min}
        max={max}
        aria-label={ariaLabel}
        placeholder="0.00"
        onChange={(e) => onChange(e.target.value)}
      />
    </span>
  );
}

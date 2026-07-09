import "./inputs.css";

// Replaces every inline type="date" (DESIGN-SYSTEM §5.1); stores ISO yyyy-mm-dd.
export interface DateInputProps {
  value: string; // ISO yyyy-mm-dd
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  "aria-label": string;
}

export function DateInput({
  value,
  onChange,
  min,
  max,
  disabled,
  "aria-label": ariaLabel,
}: DateInputProps) {
  return (
    <span
      className={`lf-field lf-field--block${disabled ? " lf-field--disabled" : ""}`}
    >
      <input
        className="lf-field__input"
        type="date"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
      />
    </span>
  );
}

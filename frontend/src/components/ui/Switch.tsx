import "./firstrun.css";

// PROPOSED (DESIGN-SYSTEM §5.5 amendment, page-first-run-checklist Phase 0a). A boolean
// toggle — the ratified inventory had no switch. Used first by the no-egress step, and
// available to the future Settings page. ARIA `role="switch"` + `aria-checked`; the
// accessible name is `aria-label` (or the visible `label`).
export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

export function Switch({ checked, onChange, label, disabled, "aria-label": ariaLabel }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel ?? label}
      disabled={disabled}
      className={`lf-switch${checked ? " is-on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="lf-switch__track" aria-hidden="true">
        <span className="lf-switch__thumb" />
      </span>
      {label && <span className="lf-switch__label">{label}</span>}
    </button>
  );
}

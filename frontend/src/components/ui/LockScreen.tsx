import { useEffect, useId, useState } from "react";
import "./chrome.css";
import "./structure.css";
import "./inputs.css";

// Global chrome (DESIGN-SYSTEM §5.5, D-066) — PROPOSED 2026-07-11. The PIN gate that
// covers the whole app when the instance is locked. It is an ACCESS LOCK, not
// encryption (D-002 / SECURITY-BASELINE §3) — the hint states this plainly. Numeric
// PIN, minimum 6 digits (SECURITY-BASELINE §3). Reuses the masked-PIN input pattern
// from ConfirmDialog for consistency (no new input primitive). The unlock/session
// call and exponential-lockout `Retry-After` handling live in the shell (Phase 1,
// C-5); this component surfaces `error`/`busy` and reports the entered PIN.
//
// Note (D-103): this gate does NOT authorize the destructive purge — purge always
// demands a fresh PIN regardless of lock state. Unlocking here grants ambient
// session access only.
export interface LockScreenProps {
  open: boolean;
  onUnlock: (pin: string) => void;
  /** Error to show (wrong PIN, or a lockout message with Retry-After). */
  error?: string | null;
  /** Disable input/submit while an unlock attempt is in flight. */
  busy?: boolean;
}

export function LockScreen({ open, onUnlock, error, busy }: LockScreenProps) {
  const [pin, setPin] = useState("");
  const pinId = useId();

  useEffect(() => {
    if (open) setPin("");
  }, [open]);

  if (!open) return null;

  const canUnlock = pin.trim().length >= 6 && !busy;
  const submit = () => {
    if (canUnlock) onUnlock(pin);
  };

  return (
    <div className="lf-lock" role="dialog" aria-modal="true" aria-label="Locked">
      <div className="lf-card lf-lock__panel">
        <div className="lf-lock__brand">LedgerFrame</div>
        <h1 className="lf-lock__title">Locked</h1>
        <p className="lf-lock__hint">
          Enter your PIN to unlock. The PIN is an access lock, not encryption — it
          gates this running instance (D-002).
        </p>
        <div>
          <label className="lf-lock__label" htmlFor={pinId}>
            PIN
          </label>
          <span className="lf-field lf-field--block">
            <input
              id={pinId}
              className="lf-field__input lf-field__input--num"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              disabled={busy}
              value={pin}
              aria-label="PIN"
              placeholder="••••••"
              onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
          </span>
        </div>
        {error && (
          <span className="lf-lock__error" role="alert">
            {error}
          </span>
        )}
        <div className="lf-lock__row">
          <button
            type="button"
            className="lf-btn lf-btn--primary"
            disabled={!canUnlock}
            onClick={submit}
          >
            {busy ? "Unlocking…" : "Unlock"}
          </button>
        </div>
      </div>
    </div>
  );
}

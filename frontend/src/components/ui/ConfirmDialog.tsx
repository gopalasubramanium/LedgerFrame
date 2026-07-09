import { useEffect, useId, useState } from "react";
import "./overlay.css";
import "./inputs.css";
import { Dialog } from "./Dialog";

// Confirm overlay for destructive actions (DESIGN-SYSTEM §5.4, amended
// 2026-07-10 — Holdings page-build §9-5). Reuses the Dialog primitive; when
// `requirePin` is set it gates confirmation on a masked PIN (e.g. purge-deleted,
// D-002/D-049). Structural consistency, no inventory sprawl.
export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Require a PIN before confirming; onConfirm receives it. */
  requirePin?: boolean;
  onCancel: () => void;
  onConfirm: (pin?: string) => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  requirePin,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const [pin, setPin] = useState("");
  const pinId = useId();

  // Reset the PIN whenever the dialog reopens.
  useEffect(() => {
    if (open) setPin("");
  }, [open]);

  const canConfirm = !requirePin || pin.trim().length >= 6;

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <button type="button" className="lf-btn" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`lf-btn${destructive ? "" : " lf-btn--primary"}`}
            disabled={!canConfirm}
            onClick={() => onConfirm(requirePin ? pin : undefined)}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="lf-confirm__msg">{message}</p>
      {requirePin && (
        <div>
          <label className="lf-confirm__pin-label" htmlFor={pinId}>
            Enter your PIN to continue
          </label>
          <span className="lf-field lf-field--block">
            <input
              id={pinId}
              className="lf-field__input lf-field__input--num"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              aria-label="PIN"
              placeholder="••••••"
              onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))}
            />
          </span>
        </div>
      )}
    </Dialog>
  );
}

import { useCallback, useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import "./overlay.css";
import "./structure.css";

// Modal container (DESIGN-SYSTEM §5.4, amended 2026-07-10 — Holdings page-build).
// Realises the worklist "CRUD editor": Add flow, edit forms, import wizard, and
// the base for ConfirmDialog. Focus-trapped, Esc-to-close, backdrop-dismiss,
// restores focus on close. `variant="drawer"` slides from the side.
export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  variant?: "center" | "drawer";
  /** Set false to keep the dialog open on backdrop click (e.g. dirty forms). */
  dismissOnBackdrop?: boolean;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea,input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  variant = "center",
  dismissOnBackdrop = true,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const nodes = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (nodes.length === 0) {
        e.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const firstField = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (firstField ?? panel)?.focus();
    return () => restoreRef.current?.focus?.();
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className={`lf-scrim lf-scrim--${variant}`}
      onMouseDown={(e) => {
        if (dismissOnBackdrop && e.target === e.currentTarget) onClose();
      }}
      onKeyDown={onKeyDown}
    >
      <div
        ref={panelRef}
        className="lf-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="lf-dialog__head">
          <h2 className="lf-dialog__title" id={titleId}>
            {title}
          </h2>
          <button
            type="button"
            className="lf-dialog__close"
            aria-label="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="lf-dialog__body">{children}</div>
        {footer && <div className="lf-dialog__foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

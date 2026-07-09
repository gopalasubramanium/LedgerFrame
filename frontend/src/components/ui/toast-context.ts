import { createContext, useContext } from "react";

// Transient toast/snackbar (DESIGN-SYSTEM §5.5, amended 2026-07-10 — Holdings
// page-build §9-4). The 10s soft-delete undo affordance rides this.
export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastSpec {
  message: string;
  action?: ToastAction;
  /** Auto-dismiss after this many ms (default 10000 — the soft-delete window). */
  durationMs?: number;
}

export interface ToastState {
  /** Show a toast; returns its id. */
  show: (spec: ToastSpec) => number;
  dismiss: (id: number) => void;
}

export const ToastContext = createContext<ToastState | null>(null);

export function useToast(): ToastState {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

export const DEFAULT_TOAST_MS = 10000;

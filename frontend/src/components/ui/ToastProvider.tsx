import { useCallback, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import "./toast.css";
import {
  DEFAULT_TOAST_MS,
  ToastContext,
} from "./toast-context";
import type { ToastSpec } from "./toast-context";

interface LiveToast extends ToastSpec {
  id: number;
  durationMs: number;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<LiveToast[]>([]);
  const timers = useRef<Map<number, number>>(new Map());
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (spec: ToastSpec) => {
      const id = nextId.current++;
      const durationMs = spec.durationMs ?? DEFAULT_TOAST_MS;
      setToasts((ts) => [...ts, { ...spec, id, durationMs }]);
      timers.current.set(
        id,
        window.setTimeout(() => dismiss(id), durationMs),
      );
      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="lf-toasts" role="region" aria-label="Notifications">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="lf-toast"
              role="status"
              aria-live="polite"
              style={{ "--toast-ms": `${t.durationMs}ms` } as CSSProperties}
            >
              <span className="lf-toast__msg">{t.message}</span>
              {t.action && (
                <button
                  type="button"
                  className="lf-toast__action"
                  onClick={() => {
                    t.action?.onClick();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
              <button
                type="button"
                className="lf-toast__close"
                aria-label="Dismiss"
                onClick={() => dismiss(t.id)}
              >
                ✕
              </button>
              <span className="lf-toast__bar" aria-hidden="true" />
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

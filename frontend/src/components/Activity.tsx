// Global activity + toast system.
//
// Gives every action visible feedback (a spinner toast while it runs, then a
// success/error toast) and guards against double-clicks: starting an action
// whose key is already in-flight just flashes "still running" instead of firing
// a second request. A small header pip shows when anything is working.

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type Kind = "pending" | "success" | "error" | "info";
interface Toast { id: number; kind: Kind; msg: string }

interface RunOpts<T> {
  pending?: string;                       // message shown while running
  success?: string | ((r: T) => string | undefined); // shown on success (undefined = silent)
  error?: string | ((e: unknown) => string);          // shown on failure
}

interface ActivityCtx {
  running: number;
  isRunning: (key: string) => boolean;
  toast: (msg: string, kind?: Kind, ms?: number) => number;
  dismiss: (id: number) => void;
  run: <T>(key: string, fn: () => Promise<T>, opts?: RunOpts<T>) => Promise<T | undefined>;
}

const Ctx = createContext<ActivityCtx | null>(null);

const TTL: Record<Kind, number> = { pending: 0, success: 3500, info: 3500, error: 7000 };

export function ActivityProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [runningKeys, setRunningKeys] = useState<Set<string>>(new Set());
  const idRef = useRef(1);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    if (timers.current[id]) { clearTimeout(timers.current[id]); delete timers.current[id]; }
  }, []);

  const toast = useCallback((msg: string, kind: Kind = "info", ms?: number) => {
    const id = idRef.current++;
    setToasts((t) => [...t, { id, kind, msg }]);
    const ttl = ms ?? TTL[kind];
    if (ttl > 0) timers.current[id] = setTimeout(() => dismiss(id), ttl);
    return id;
  }, [dismiss]);

  const update = useCallback((id: number, kind: Kind, msg: string) => {
    setToasts((t) => t.map((x) => (x.id === id ? { ...x, kind, msg } : x)));
    const ttl = TTL[kind];
    if (ttl > 0) timers.current[id] = setTimeout(() => dismiss(id), ttl);
  }, [dismiss]);

  const isRunning = useCallback((key: string) => runningKeys.has(key), [runningKeys]);

  const run = useCallback(async function run<T>(key: string, fn: () => Promise<T>, opts: RunOpts<T> = {}): Promise<T | undefined> {
    let already = false;
    setRunningKeys((s) => { if (s.has(key)) { already = true; return s; } const n = new Set(s); n.add(key); return n; });
    if (already) { toast(`${opts.pending ?? key} is already running — please wait…`, "info"); return undefined; }

    const id = toast(opts.pending ?? "Working…", "pending");
    try {
      const r = await fn();
      const sm = typeof opts.success === "function" ? opts.success(r) : opts.success;
      if (sm) update(id, "success", sm); else dismiss(id);
      return r;
    } catch (e) {
      const em = typeof opts.error === "function" ? opts.error(e) : (opts.error ?? (e instanceof Error ? e.message : "Action failed"));
      update(id, "error", em);
      return undefined;
    } finally {
      setRunningKeys((s) => { const n = new Set(s); n.delete(key); return n; });
    }
  }, [toast, update, dismiss]);

  const value: ActivityCtx = { running: runningKeys.size, isRunning, toast, dismiss, run };
  return (
    <Ctx.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </Ctx.Provider>
  );
}

export function useActivity(): ActivityCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useActivity must be used within ActivityProvider");
  return ctx;
}

function Spinner() {
  return (
    <svg className="animate-spin w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

const ICON: Record<Kind, string> = { pending: "", success: "✓", error: "✕", info: "ℹ" };
const TONE: Record<Kind, string> = {
  pending: "border-line text-muted",
  success: "border-up/50 text-up",
  error: "border-down/60 text-down",
  info: "border-accent/50 text-accent",
};

function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-3 right-3 z-[60] flex flex-col gap-2 max-w-[92vw] w-80" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id}
          className={`lf-card bg-elevated shadow-card border ${TONE[t.kind]} flex items-center gap-2 px-3 py-2 text-sm`}>
          {t.kind === "pending" ? <Spinner /> : <span className="shrink-0">{ICON[t.kind]}</span>}
          <span className="flex-1 text-ink/90 break-words">{t.msg}</span>
          <button className="text-faint hover:text-ink text-xs" onClick={() => onDismiss(t.id)} aria-label="Dismiss">✕</button>
        </div>
      ))}
    </div>
  );
}

// Small header indicator: shows a spinner while any action is in flight.
export function ActivityPip() {
  const { running } = useActivity();
  if (!running) return null;
  return (
    <span className="flex items-center gap-1 text-xs text-muted" title={`${running} action(s) running`}>
      <Spinner /> <span className="hidden sm:inline">Working…</span>
    </span>
  );
}

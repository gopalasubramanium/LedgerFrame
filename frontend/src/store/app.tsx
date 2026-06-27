import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import type { SystemStatus } from "../lib/types";

type ThemeMode = "light" | "dark" | "system";

interface AppState {
  status: SystemStatus | null;
  locked: boolean;
  setLocked: (v: boolean) => void;
  reducedMotion: boolean;
  highContrast: boolean;
  toggleReducedMotion: () => void;
  toggleHighContrast: () => void;
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  refreshStatus: () => void;
}

const Ctx = createContext<AppState | null>(null);

function applyTheme(mode: ThemeMode) {
  const sys = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.dataset.theme = mode === "system" ? sys : mode;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [locked, setLocked] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(localStorage.getItem("lf_reduced_motion") === "1");
  const [highContrast, setHighContrast] = useState(localStorage.getItem("lf_high_contrast") === "1");
  const [theme, setThemeState] = useState<ThemeMode>((localStorage.getItem("lf_theme") as ThemeMode) || "system");

  const refreshStatus = () => {
    api.systemStatus().then(setStatus).catch(() => setStatus(null));
  };

  useEffect(() => {
    refreshStatus();
    api.authState().then((s) => setLocked(s.pin_set)).catch(() => {});
  }, []);

  // Apply theme + follow system changes when in "system" mode.
  useEffect(() => {
    applyTheme(theme);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => theme === "system" && applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", reducedMotion);
    document.documentElement.classList.toggle("high-contrast", highContrast);
  }, [reducedMotion, highContrast]);

  const setTheme = (t: ThemeMode) => {
    localStorage.setItem("lf_theme", t);
    setThemeState(t);
  };

  const value: AppState = {
    status,
    locked,
    setLocked,
    reducedMotion,
    highContrast,
    toggleReducedMotion: () =>
      setReducedMotion((v) => {
        localStorage.setItem("lf_reduced_motion", v ? "0" : "1");
        return !v;
      }),
    toggleHighContrast: () =>
      setHighContrast((v) => {
        localStorage.setItem("lf_high_contrast", v ? "0" : "1");
        return !v;
      }),
    theme,
    setTheme,
    refreshStatus,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

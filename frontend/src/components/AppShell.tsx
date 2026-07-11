import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import "./AppShell.css";
import {
  Clock,
  DemoBadge,
  LockScreen,
  Sidebar,
  StaleBanner,
  TopBar,
  UpdateBanner,
} from "./ui";
import { DisplayControls } from "./DisplayControls";
import { fetchAuthState, fetchVersionCheck, unlock as apiUnlock } from "../api/system";
import { fetchChromeSettings, fetchStaleSummary } from "../api/chrome";

// The app SHELL (DESIGN-SYSTEM §5.5, D-066): Sidebar + slim TopBar + status strips +
// lock gate, composed ONCE around every page. Pages never re-implement chrome. The
// shell owns UI state (nav open, rotation, detail level, lock) and consumes status
// summaries (stale count, version, demo flag, timezone) — it owns no figures (IA P-1).
export function AppShell({ children }: { children: ReactNode }) {
  // UI state owned by the chrome.
  const [navOpen, setNavOpen] = useState(false);
  const [rotationOn, setRotationOn] = useState(false);
  const [detailLevel, setDetailLevel] = useState<"simple" | "full">("simple");
  const [updateDismissed, setUpdateDismissed] = useState(false);

  // Consumed status summaries.
  const [timezone, setTimezone] = useState("UTC");
  const [demo, setDemo] = useState(false);
  const [staleCount, setStaleCount] = useState(0);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);

  // Lock gate (D-002 access lock). If a PIN is set, the app starts locked until this
  // session is unlocked; a no-PIN instance is never gated (D-004 no-auth-when-no-PIN).
  const [locked, setLocked] = useState(false);
  const [lockBusy, setLockBusy] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchAuthState().then((a) => alive && setLocked(a.pin_set));
    fetchChromeSettings().then((s) => {
      if (!alive) return;
      setTimezone(s.timezone);
      setDemo(s.demo);
    });
    fetchStaleSummary().then((s) => alive && setStaleCount(s.stale_count));
    fetchVersionCheck().then((v) => {
      if (alive && v?.update_available) setUpdateVersion(v.latest);
    });
    return () => {
      alive = false;
    };
  }, []);

  const onUnlock = async (pin: string) => {
    setLockBusy(true);
    setLockError(null);
    const r = await apiUnlock(pin);
    setLockBusy(false);
    if (r.ok) setLocked(false);
    else setLockError(r.error || "Incorrect PIN");
  };

  // DemoBadge lives in the sidebar footer at laptop+ and in the top bar at narrow
  // widths (CSS shows the right one per breakpoint) — never hidden when demo is on.
  const demoBadge = demo ? <DemoBadge /> : undefined;

  return (
    <div className="lf-shell">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} footer={demoBadge} />
      <div className="lf-shell__main">
        <TopBar
          onToggleNav={() => setNavOpen((v) => !v)}
          controls={<DisplayControls />}
          clock={<Clock timezone={timezone} />}
          demoBadge={demoBadge}
          rotationOn={rotationOn}
          onToggleRotation={() => setRotationOn((v) => !v)}
          detailLevel={detailLevel}
          onToggleDetail={() => setDetailLevel((d) => (d === "simple" ? "full" : "simple"))}
        />
        <StaleBanner count={staleCount} />
        {!updateDismissed && (
          <UpdateBanner version={updateVersion} onDismiss={() => setUpdateDismissed(true)} />
        )}
        <main className="lf-shell__content">{children}</main>
      </div>
      <LockScreen open={locked} onUnlock={onUnlock} error={lockError} busy={lockBusy} />
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import "./AppShell.css";
import {
  Clock,
  DemoBadge,
  FirstRunChecklist,
  LockScreen,
  Sidebar,
  StaleBanner,
  TickerStrip,
  TopBar,
  UpdateBanner,
} from "./ui";
import type { FirstRunLinks } from "./ui";
import { DisplayControls } from "./DisplayControls";
import { fetchVersionCheck, setPin as apiSetPin, unlock as apiUnlock } from "../api/system";
import {
  fetchFirstRunState,
  fetchTickerQuotes,
  setDataProvider,
  updateSetting,
} from "../api/chrome";
import type { TickerQuote } from "../api/chrome";
import { useStaleCount } from "../state/staleCount";

// Each first-run step links to its Settings home (D-045). Settings isn't built yet, so
// the links land on the honest NotBuilt fallback (F-2) — one route for all four for now.
const FIRST_RUN_LINKS: FirstRunLinks = {
  general: "/settings",
  security: "/settings",
  prices: "/settings",
  privacy: "/settings",
};

function timezoneOptions() {
  const zones =
    (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.(
      "timeZone",
    ) ?? ["UTC", "Asia/Singapore", "America/New_York", "Europe/London"];
  return zones.map((z) => ({ label: z, value: z }));
}

// The app SHELL (DESIGN-SYSTEM §5.5, D-066): Sidebar + slim TopBar + status strips +
// lock gate + first-run overlay, composed ONCE around every page. Pages never
// re-implement chrome. The shell owns UI state and consumes status summaries.
export function AppShell({ children }: { children: ReactNode }) {
  // UI state owned by the chrome.
  const [navOpen, setNavOpen] = useState(false);
  const [rotationOn, setRotationOn] = useState(false);
  const [updateDismissed, setUpdateDismissed] = useState(false);

  // Consumed status summaries + settings-derived state.
  const [timezone, setTimezone] = useState("UTC");
  const [demo, setDemo] = useState(false);
  // Stale count comes from the ONE shared query (page-pricing-health §12ph1-1) — the same value the
  // Pricing Health footnote reads, so the two can never disagree. Poll + invalidate-on-refresh.
  const { count: staleCount } = useStaleCount();
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [ticker, setTicker] = useState<TickerQuote[]>([]);

  // Lock gate (D-002). PIN set → start locked; a no-PIN instance is never gated (D-004).
  const [locked, setLocked] = useState(false);
  const [lockBusy, setLockBusy] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);

  // First-run checklist (D-045). Shown when first-run isn't complete AND the app is
  // unlocked — the overlay mounts AFTER the lock gate (F-7).
  const [firstRunComplete, setFirstRunComplete] = useState(true); // assume done until known
  // Session-only hide (F-2): a "more options" link closes the overlay WITHOUT completing;
  // it reappears on the next full load if still incomplete (this resets on remount).
  const [firstRunHidden, setFirstRunHidden] = useState(false);
  const [baseCurrency, setBaseCurrency] = useState("");
  const [provider, setProvider] = useState("");
  const [noEgress, setNoEgress] = useState(false);
  const [pinSet, setPinSet] = useState(false);
  const [providers, setProviders] = useState<string[]>([]);
  const tzOptions = useMemo(timezoneOptions, []);

  useEffect(() => {
    let alive = true;
    fetchFirstRunState().then((s) => {
      if (!alive) return;
      setLocked(s.pinSet);
      setPinSet(s.pinSet);
      setTimezone(s.timezone);
      setDemo(s.demo);
      setNoEgress(s.noEgress);
      setBaseCurrency(s.baseCurrency);
      setProvider(s.provider);
      setProviders(s.providers);
      setFirstRunComplete(s.complete);
    });
    fetchVersionCheck().then((v) => {
      if (alive && v?.update_available) setUpdateVersion(v.latest);
    });
    fetchTickerQuotes().then((q) => alive && setTicker(q));
    return () => {
      alive = false;
    };
  }, []);

  // Re-read the settings-derived state now that we hold a session. The initial mount fetch
  // can run PRE-unlock (restored DB with a PIN, F-7): /system/data-source, /settings and
  // /refdata all 401 while locked, so the served provider list comes back EMPTY. Without this
  // refetch the first-run overlay that appears right after unlock shows an empty data-provider
  // dropdown (post-close regression, §11-4). Currency/timezone survive (static /refdata
  // fallback + client-side IANA); the provider list has no fallback, so it must be refetched.
  const refreshFirstRunState = () => {
    void fetchFirstRunState().then((s) => {
      setPinSet(s.pinSet);
      setTimezone(s.timezone);
      setDemo(s.demo);
      setNoEgress(s.noEgress);
      setBaseCurrency(s.baseCurrency);
      setProvider(s.provider);
      setProviders(s.providers);
      setFirstRunComplete(s.complete);
    });
  };

  const onUnlock = async (pin: string) => {
    setLockBusy(true);
    setLockError(null);
    const r = await apiUnlock(pin);
    setLockBusy(false);
    if (r.ok) {
      setLocked(false);
      refreshFirstRunState(); // pull the authenticated values (incl. the provider list)
    } else setLockError(r.error || "Incorrect PIN");
  };

  // First-run step handlers — inline-minimal writes to the canonical endpoints (F-2).
  const completeFirstRun = () => {
    setFirstRunComplete(true);
    void updateSetting("first_run_complete", "1");
  };

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
        />
        <StaleBanner count={staleCount} />
        {!updateDismissed && (
          <UpdateBanner version={updateVersion} onDismiss={() => setUpdateDismissed(true)} />
        )}
        <main className="lf-shell__content">{children}</main>
        {!locked && ticker.length > 0 && (
          <footer className="lf-shell__ticker">
            <TickerStrip quotes={ticker} />
          </footer>
        )}
      </div>
      <LockScreen open={locked} onUnlock={onUnlock} error={lockError} busy={lockBusy} />
      {/* First-run overlay — only when unlocked (AFTER the lock gate, F-7) and not done.
          Deterministic: after unlock, if first-run is incomplete it shows again. */}
      {!locked && !firstRunComplete && !firstRunHidden && (
        <FirstRunChecklist
          open
          baseCurrency={baseCurrency}
          timezone={timezone}
          pinSet={pinSet}
          provider={provider}
          noEgress={noEgress}
          timezoneOptions={tzOptions}
          providerOptions={providers.map((p) => ({ label: p, value: p }))}
          links={FIRST_RUN_LINKS}
          onBaseCurrency={(v) => {
            setBaseCurrency(v);
            void updateSetting("base_currency", v);
          }}
          onTimezone={(v) => {
            setTimezone(v);
            void updateSetting("timezone", v);
          }}
          onSetPin={(pin) => {
            void apiSetPin(pin).then((r) => r.ok && setPinSet(true));
          }}
          onProvider={(v) => {
            setProvider(v);
            void setDataProvider(v);
          }}
          onNoEgress={(v) => {
            setNoEgress(v);
            void updateSetting("privacy_mode", v ? "true" : "false");
          }}
          onDismiss={completeFirstRun}
          onNavigateAway={() => setFirstRunHidden(true)}
        />
      )}
    </div>
  );
}

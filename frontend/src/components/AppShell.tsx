import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import "./AppShell.css";
import {
  AcceptanceGate,
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
import { fetchAcceptance, fetchGateCopy, recordAcceptance } from "../api/legal";
import type { AcceptanceState, LegalGateCopy } from "../api/legal";
import { useStaleCount } from "../state/staleCount";

// Each first-run step links to its Settings home (D-045). Settings is built with URL-addressable
// tabs (Amendment C), so each step deep-links to the TAB that holds its control: base
// currency/timezone → General; PIN → System; data provider → Data feeds (§14st-1); no-egress →
// Privacy. The journey guard asserts arrival at the CONTROL, not the href (§14ac-2).
const FIRST_RUN_LINKS: FirstRunLinks = {
  general: "/settings?tab=general",
  security: "/settings?tab=system",
  prices: "/settings?tab=data-feeds",
  privacy: "/settings?tab=privacy",
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
  // The rotation toggle's local state was REMOVED 2026-07-18 — owner-ruled at the Settings Phase-0a
  // gate (page-settings §12 ruling (d)): the toggle wrote local state consumed by nothing (the three
  // rotation keys were removed in Phase 0). R-37 (the Rotation engine) restores the toggle + the state
  // that drives it, server-persisted per D-017.
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

  // THE ACCEPTANCE GATE (page-legal §11-5). `null` = not yet known, and it is deliberately NOT
  // defaulted to "none": defaulting would flash the consent panel at every returning user on every
  // load, which trains people to click Accept without reading — the precise failure a consent
  // record cannot survive. The gate renders only once the server has actually answered.
  const [acceptance, setAcceptance] = useState<AcceptanceState | null>(null);
  const [gateCopy, setGateCopy] = useState<LegalGateCopy | null>(null);
  const [gateBusy, setGateBusy] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);
  // Set while the user is reading /legal from the gate. Hides the panel WITHOUT accepting anything
  // — the document must be readable before the answer, or the consent is not informed (§11-E1).
  const [readingLegal, setReadingLegal] = useState(false);
  // Bumped when the gate clears, and used as a KEY on the page subtree so every route component
  // remounts and re-reads. Necessary because pages fetch once in a `useEffect` on mount and there
  // is no shared query cache to invalidate: a page mounted BEHIND the gate had every read refused
  // with 451, cached the honest "couldn't load" state, and had no reason to ask again. Found in
  // the walk — accepting revealed a Home full of "Couldn't load this summary" until a manual
  // reload. Each card's Retry button would have worked, but making the user click six of them to
  // undo a refusal the product created is not an honest empty, it is a mess wearing one.
  const [entryEpoch, setEntryEpoch] = useState(0);

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

  // --- The acceptance gate -------------------------------------------------------------------
  //
  // Asked at mount, and re-asked whenever the SERVER says consent is missing. The client never
  // tries to work out for itself whether the terms still apply: `client.ts` announces every 451 and
  // this listens. That covers the causes nobody enumerated as well as the two that are known — a
  // changed document (§11-D4, any served-content change re-locks) and a data reset (§11-D3, which
  // erases the record deliberately).
  const readAcceptance = () => {
    void fetchAcceptance().then((r) => {
      if (!r.ok) return; // exempt endpoint; a failure here is a dead backend, not a refusal
      // Only the three contracted values are trusted. Anything else leaves the state UNKNOWN and
      // the panel unrendered — which is fail-OPEN, and safe here for one specific reason: this
      // component is not the lock. The server refuses every read regardless, and that refusal
      // arrives as a 451 which re-triggers this read. Guessing at an unrecognised status would
      // mean rendering a consent panel whose copy we cannot know is right, in front of data the
      // server is already holding back.
      const s = r.data?.status;
      if (s !== "none" && s !== "stale" && s !== "accepted") return;
      setAcceptance(s);
      if (s !== "accepted") setDeclined(false);
    });
  };

  useEffect(() => {
    readAcceptance();
    void fetchGateCopy().then((r) => r.ok && setGateCopy(r.data));
    const onConsentRequired = () => readAcceptance();
    window.addEventListener("lf:consent-required", onConsentRequired);
    return () => window.removeEventListener("lf:consent-required", onConsentRequired);
  }, []);

  const answerGate = async (action: "accepted" | "declined") => {
    setGateBusy(true);
    setGateError(null);
    const r = await recordAcceptance(action);
    setGateBusy(false);
    if (!r.ok) {
      setGateError(r.error || "Could not record your answer.");
      return;
    }
    setAcceptance(r.data.status);
    setDeclined(action === "declined");
    if (r.data.status === "accepted") {
      setReadingLegal(false);
      // The mount fetch ran while every non-exempt read was answering 451, so the served provider
      // list, currency and no-egress state came back empty. Same refetch the PIN unlock does, for
      // the same reason (§11-4) — one gate earlier in the sequence.
      refreshFirstRunState();
      fetchTickerQuotes().then(setTicker);
      setEntryEpoch((n) => n + 1);
    }
  };

  const gateOpen = acceptance !== null && acceptance !== "accepted" && !readingLegal;

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
        />
        <StaleBanner count={staleCount} />
        {!updateDismissed && (
          <UpdateBanner version={updateVersion} onDismiss={() => setUpdateDismissed(true)} />
        )}
        <main className="lf-shell__content" key={entryEpoch}>
          {children}
        </main>
        {!locked && ticker.length > 0 && (
          <footer className="lf-shell__ticker">
            <TickerStrip quotes={ticker} />
          </footer>
        )}
      </div>
      {/* While the terms are being READ, the gate is hidden and the shell is showing /legal. This
          bar is the way back, and it exists so the state cannot become a trap: without it a user
          who clicked "Read the Legal page" would be looking at a document with no visible way to
          answer the question that sent them there. */}
      {readingLegal && (
        <div className="lf-gate__readingbar" role="region" aria-label="Accept the terms">
          <span>You are reading the Legal page. Nothing has been accepted yet.</span>
          <button type="button" className="lf-btn lf-btn--primary" onClick={() => setReadingLegal(false)}>
            Return to accept
          </button>
        </div>
      )}
      {/* THE ORDER MIRRORS THE SERVER (§11-E1): consent, then authentication. The acceptance gate
          renders in front of the PIN because the server checks it first — terms, then unlock. The
          other order would leave an unaccepted PIN-less install (i.e. every fresh install) with
          nothing in front of it at all. */}
      <AcceptanceGate
        open={gateOpen}
        state={acceptance === "stale" ? "stale" : "none"}
        copy={gateCopy}
        busy={gateBusy}
        error={gateError}
        declined={declined}
        onAccept={() => void answerGate("accepted")}
        onDecline={() => void answerGate("declined")}
        onReadLegal={() => {
          setReadingLegal(true);
          window.location.hash = "#/legal";
        }}
      />
      {/* The PIN lock, BEHIND the consent gate. `!gateOpen` is what enforces the sequence: an
          unaccepted install never reaches the PIN prompt, so a user is never asked to unlock an
          app whose terms they have not been shown. */}
      <LockScreen
        open={locked && !gateOpen && !readingLegal}
        onUnlock={onUnlock}
        error={lockError}
        busy={lockBusy}
      />
      {/* First-run overlay — only when unlocked (AFTER the lock gate, F-7) and not done.
          Deterministic: after unlock, if first-run is incomplete it shows again. */}
      {!locked && !gateOpen && !readingLegal && !firstRunComplete && !firstRunHidden && (
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

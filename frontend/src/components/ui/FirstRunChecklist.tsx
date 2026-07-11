import { useState } from "react";
import { Link } from "react-router-dom";
import "./firstrun.css";
import "./inputs.css";
import "./structure.css";
import { MasterSelect } from "./MasterSelect";
import { Select } from "./Select";
import type { SelectOption } from "./Select";
import { Combobox } from "./Combobox";
import type { ComboboxOption } from "./Combobox";
import { Switch } from "./Switch";

// PROPOSED (DESIGN-SYSTEM §5.5 amendment, page-first-run-checklist Phase 0a; three-state
// model added at Phase-3 pre-pass §F-3/§F-4). The first-run checklist (D-045): a
// DISMISSIBLE overlay card (not a blocking gate — F-1) with five skippable settings.
//
// THREE-STATE steps (§F-3/§F-4): pending · confirmed · skipped, visually distinct. A
// FRESH instance is 0/5 — the defaults are pre-filled in the controls as *suggestions*,
// NOT "done"; the user CONFIRMS a step by interacting with its control (which writes the
// value, F-2), or Skips it. Presentational + prop-driven; Phase 1 wires it after the lock
// gate (F-7).
export type FirstRunStepId = "currency" | "timezone" | "pin" | "provider" | "no-egress";
type StepState = "pending" | "confirmed" | "skipped";

export interface FirstRunLinks {
  general: string;
  security: string;
  prices: string;
  privacy: string;
}

export interface FirstRunChecklistProps {
  open: boolean;
  baseCurrency: string;
  timezone: string | null;
  pinSet: boolean;
  provider: string;
  noEgress: boolean;
  timezoneOptions: ComboboxOption[];
  providerOptions: SelectOption[];
  links: FirstRunLinks;
  onBaseCurrency: (v: string) => void;
  onTimezone: (v: string) => void;
  onSetPin: (pin: string) => void;
  onProvider: (v: string) => void;
  onNoEgress: (v: boolean) => void;
  /** Dismiss / skip-all — marks the checklist complete (F-1/F-11). */
  onDismiss: () => void;
  /** A "more options" link was clicked — close the overlay for THIS session without
      completing it, so it reappears on next load if still incomplete (§F-2). */
  onNavigateAway: () => void;
}

function StepStatus({ state }: { state: StepState }) {
  if (state === "confirmed")
    return <span className="lf-firstrun__badge is-confirmed">✓ confirmed</span>;
  if (state === "skipped") return <span className="lf-firstrun__badge is-skipped">skipped</span>;
  return <span className="lf-firstrun__badge is-pending">not set</span>;
}

export function FirstRunChecklist(props: FirstRunChecklistProps) {
  const {
    open, baseCurrency, timezone, provider, noEgress,
    timezoneOptions, providerOptions, links,
    onBaseCurrency, onTimezone, onSetPin, onProvider, onNoEgress, onDismiss, onNavigateAway,
  } = props;

  const [state, setState] = useState<Record<FirstRunStepId, StepState>>({
    currency: "pending",
    timezone: "pending",
    pin: "pending",
    provider: "pending",
    "no-egress": "pending",
  });
  const [pin, setPin] = useState("");
  const set = (id: FirstRunStepId, s: StepState) => setState((m) => ({ ...m, [id]: s }));
  const skip = (id: FirstRunStepId) => set(id, "skipped");
  const confirmedCount = Object.values(state).filter((s) => s === "confirmed").length;

  if (!open) return null;

  return (
    <div className="lf-firstrun" role="dialog" aria-modal="false" aria-label="Set up LedgerFrame">
      <div className="lf-firstrun__card">
        <div className="lf-firstrun__head">
          <div>
            <h2 className="lf-firstrun__title">Set up LedgerFrame</h2>
            <p className="lf-firstrun__sub">
              Five quick settings. Confirm or skip each — you can change them later in
              Settings.
            </p>
            <p className="lf-firstrun__count">{confirmedCount} of 5 confirmed</p>
          </div>
          <button type="button" className="lf-iconbtn" aria-label="Dismiss setup" title="Dismiss" onClick={onDismiss}>
            ✕
          </button>
        </div>

        {/* 1 — Base currency */}
        <div className="lf-firstrun__step">
          <div className="lf-firstrun__step-head">
            <span className="lf-firstrun__step-label">Base currency</span>
            <StepStatus state={state.currency} />
          </div>
          <div className="lf-firstrun__step-control">
            <MasterSelect master="base_currency" value={baseCurrency} aria-label="Base currency"
              onChange={(v) => { onBaseCurrency(v); set("currency", "confirmed"); }} />
            <button type="button" className="lf-btn" onClick={() => skip("currency")}>Skip</button>
            <Link className="lf-firstrun__link" to={links.general} onClick={onNavigateAway}>More options →</Link>
          </div>
        </div>

        {/* 2 — Timezone */}
        <div className="lf-firstrun__step">
          <div className="lf-firstrun__step-head">
            <span className="lf-firstrun__step-label">Timezone</span>
            <StepStatus state={state.timezone} />
          </div>
          <div className="lf-firstrun__step-control">
            <Combobox options={timezoneOptions} value={timezone} placeholder="Search timezones…" aria-label="Timezone"
              onChange={(v) => { onTimezone(v); set("timezone", "confirmed"); }} />
            <button type="button" className="lf-btn" onClick={() => skip("timezone")}>Skip</button>
            <Link className="lf-firstrun__link" to={links.general} onClick={onNavigateAway}>More options →</Link>
          </div>
        </div>

        {/* 3 — PIN */}
        <div className="lf-firstrun__step">
          <div className="lf-firstrun__step-head">
            <span className="lf-firstrun__step-label">PIN</span>
            <StepStatus state={state.pin} />
          </div>
          <div className="lf-firstrun__step-control">
            <span className="lf-field">
              <input
                className="lf-field__input lf-field__input--num"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                placeholder="••••••"
                aria-label="PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))}
              />
            </span>
            <button type="button" className="lf-btn lf-btn--primary" disabled={pin.length < 6}
              onClick={() => { onSetPin(pin); set("pin", "confirmed"); }}>
              Set PIN
            </button>
            <button type="button" className="lf-btn" onClick={() => skip("pin")}>Skip</button>
            <Link className="lf-firstrun__link" to={links.security} onClick={onNavigateAway}>More options →</Link>
          </div>
          <p className="lf-firstrun__step-note">
            The PIN locks access to this device; it does not encrypt your data. For at-rest
            protection, use your operating system's disk encryption.
          </p>
        </div>

        {/* 4 — Data provider */}
        <div className="lf-firstrun__step">
          <div className="lf-firstrun__step-head">
            <span className="lf-firstrun__step-label">Data provider</span>
            <StepStatus state={state.provider} />
          </div>
          <div className="lf-firstrun__step-control">
            <Select options={providerOptions} value={provider} aria-label="Data provider"
              onChange={(v) => { onProvider(v); set("provider", "confirmed"); }} />
            <button type="button" className="lf-btn" onClick={() => skip("provider")}>Skip</button>
            <Link className="lf-firstrun__link" to={links.prices} onClick={onNavigateAway}>Add an API key →</Link>
          </div>
          {noEgress && (
            <p className="lf-firstrun__step-note">
              No egress is on — the chosen provider won't be contacted until you turn it off.
            </p>
          )}
        </div>

        {/* 5 — No-egress */}
        <div className="lf-firstrun__step">
          <div className="lf-firstrun__step-head">
            <span className="lf-firstrun__step-label">No egress</span>
            <StepStatus state={state["no-egress"]} />
          </div>
          <div className="lf-firstrun__step-control">
            <Switch checked={noEgress} label="Make no network calls" aria-label="No egress"
              onChange={(v) => { onNoEgress(v); set("no-egress", "confirmed"); }} />
            <button type="button" className="lf-btn" onClick={() => skip("no-egress")}>Skip</button>
            <Link className="lf-firstrun__link" to={links.privacy} onClick={onNavigateAway}>More options →</Link>
          </div>
          <p className="lf-firstrun__step-note">
            With no egress on, prices won't refresh — cached values are shown and flagged stale.
          </p>
        </div>

        <div className="lf-firstrun__foot">
          <span className="lf-firstrun__step-note">Everything here is changeable later in Settings.</span>
          <button type="button" className="lf-btn lf-btn--primary" onClick={onDismiss}>
            Done — skip the rest
          </button>
        </div>
      </div>
    </div>
  );
}

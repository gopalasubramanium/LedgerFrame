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

// PROPOSED (DESIGN-SYSTEM §5.5 amendment, page-first-run-checklist Phase 0a). The
// first-run checklist (D-045): a DISMISSIBLE overlay card (not a blocking gate — F-1)
// running five skippable settings steps, each with an INLINE-minimal control that writes
// the real setting (F-2) AND a "more options" link to its Settings home. Presentational
// + prop-driven so it ratifies at /kitchen-sink; the shell wires it in Phase 1 (mounts
// AFTER the lock gate — F-7). Copy is plain (no decision IDs); the F-9 interplay notes
// are shown here for ratification.
export type FirstRunStepId = "currency" | "timezone" | "pin" | "provider" | "no-egress";

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
  /** Dismiss / skip-all — both mark the checklist complete (F-1/F-11). */
  onDismiss: () => void;
}

function StepStatus({ done, skipped }: { done: boolean; skipped: boolean }) {
  if (done) return <span className="lf-firstrun__step-label is-done">✓ done</span>;
  if (skipped) return <span className="lf-firstrun__step-label is-skipped">skipped</span>;
  return null;
}

export function FirstRunChecklist(props: FirstRunChecklistProps) {
  const {
    open, baseCurrency, timezone, pinSet, provider, noEgress,
    timezoneOptions, providerOptions, links,
    onBaseCurrency, onTimezone, onSetPin, onProvider, onNoEgress, onDismiss,
  } = props;

  const [skipped, setSkipped] = useState<Set<FirstRunStepId>>(new Set());
  const [pin, setPin] = useState("");
  const skip = (id: FirstRunStepId) => setSkipped((s) => new Set(s).add(id));
  const isSkipped = (id: FirstRunStepId) => skipped.has(id);

  if (!open) return null;

  return (
    <div className="lf-firstrun" role="dialog" aria-modal="false" aria-label="Set up LedgerFrame">
      <div className="lf-firstrun__card">
        <div className="lf-firstrun__head">
          <div>
            <h2 className="lf-firstrun__title">Set up LedgerFrame</h2>
            <p className="lf-firstrun__sub">
              Five quick settings. Skip any — you can change them later in Settings.
            </p>
          </div>
          <button type="button" className="lf-iconbtn" aria-label="Dismiss setup" title="Dismiss" onClick={onDismiss}>
            ✕
          </button>
        </div>

        {/* 1 — Base currency */}
        <div className="lf-firstrun__step">
          <div className="lf-firstrun__step-head">
            <span className="lf-firstrun__step-label">Base currency</span>
            <StepStatus done={!!baseCurrency} skipped={isSkipped("currency")} />
          </div>
          <div className="lf-firstrun__step-control">
            <MasterSelect master="base_currency" value={baseCurrency} onChange={onBaseCurrency} aria-label="Base currency" />
            <button type="button" className="lf-btn" onClick={() => skip("currency")}>Skip</button>
            <Link className="lf-firstrun__link" to={links.general}>More options →</Link>
          </div>
        </div>

        {/* 2 — Timezone */}
        <div className="lf-firstrun__step">
          <div className="lf-firstrun__step-head">
            <span className="lf-firstrun__step-label">Timezone</span>
            <StepStatus done={!!timezone} skipped={isSkipped("timezone")} />
          </div>
          <div className="lf-firstrun__step-control">
            <Combobox options={timezoneOptions} value={timezone} onChange={onTimezone} placeholder="Search timezones…" aria-label="Timezone" />
            <button type="button" className="lf-btn" onClick={() => skip("timezone")}>Skip</button>
            <Link className="lf-firstrun__link" to={links.general}>More options →</Link>
          </div>
        </div>

        {/* 3 — PIN */}
        <div className="lf-firstrun__step">
          <div className="lf-firstrun__step-head">
            <span className="lf-firstrun__step-label">PIN</span>
            <StepStatus done={pinSet} skipped={isSkipped("pin")} />
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
            <button type="button" className="lf-btn lf-btn--primary" disabled={pin.length < 6} onClick={() => onSetPin(pin)}>
              Set PIN
            </button>
            <button type="button" className="lf-btn" onClick={() => skip("pin")}>Skip</button>
            <Link className="lf-firstrun__link" to={links.security}>More options →</Link>
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
            <StepStatus done={!!provider} skipped={isSkipped("provider")} />
          </div>
          <div className="lf-firstrun__step-control">
            <Select options={providerOptions} value={provider} onChange={onProvider} aria-label="Data provider" />
            <button type="button" className="lf-btn" onClick={() => skip("provider")}>Skip</button>
            <Link className="lf-firstrun__link" to={links.prices}>Add an API key →</Link>
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
            <StepStatus done={false} skipped={isSkipped("no-egress")} />
          </div>
          <div className="lf-firstrun__step-control">
            <Switch checked={noEgress} onChange={onNoEgress} label="Make no network calls" aria-label="No egress" />
            <button type="button" className="lf-btn" onClick={() => skip("no-egress")}>Skip</button>
            <Link className="lf-firstrun__link" to={links.privacy}>More options →</Link>
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

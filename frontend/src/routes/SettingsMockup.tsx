// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from "react";
import type { ReactNode } from "react";
import {
  Button,
  Combobox,
  DataTable,
  EmptyState,
  MasterSelect,
  PageHeader,
  Segmented,
  Select,
  StatusChip,
  Switch,
  TextInput,
} from "../components/ui";
import type { Column } from "../components/ui";
import { Plus } from "../icons";
import "./Settings.css";

// STATIC LAYOUT SPECIMEN — page-settings §9 / Phase 0a (the GEOMETRY GATE).
//
// Nothing here is wired: it exists so the owner can RATIFY THE GEOMETRY BY LOOKING, before the page is
// assembled (Phase 1 is BLOCKED until then). The §9 rulings this specimen renders:
//   - §9-5 (Amendment C): the tab strip is `Segmented` (no new component) — four D-069 tabs; tab
//     state is URL-addressable at assembly (here it is local useState so the strip is clickable).
//   - GENERAL: base currency (MasterSelect, restart notice) · timezone (Combobox) · long_term_days
//     (§9-1 — a NEUTRAL integer, NO jurisdiction presets, D-077/Guarantee 4).
//   - APPEARANCE: theme/density/high-contrast/reduced-motion — PER-DEVICE (D-078); the note says so.
//   - PRIVACY (§9-9): ONE no-egress toggle → the egress STATE STATEMENT derived from it (a plain
//     statement, never a metric — P-1/D-031); the "AI never persists" statement; the API-token card
//     (§9-8: revoke is require_session, NOT a fresh PIN — D-103 is the destructive-purge scope only)
//     with the raw token shown ONCE at creation.
//   - SYSTEM (§9-10): sudo-helper-dependent controls DISABLED with an honest explanation keyed off
//     `admin_available` — no dead buttons, no fabricated success; read-only status still shows;
//     non-helper controls (currency, timezone, no-egress, tokens, appearance) work regardless.
//
// Settings has NO computed figures (P-1/D-031): no sums, no percentages, no money math on this page.
// The egress statement is DERIVED FROM the toggle state, not a new number. So there is nothing to
// tile-integrity-check — the honest finding is the absence of arithmetic, stated, not staged.
//
// All values are STATIC display strings — the frontend computes nothing (D-105). Honesty variants are
// staged via props: `adminAvailable` (System degradation), `tokensEmpty` (EmptyState), `tokenReveal`
// (the shown-once Dialog).

type TabId = "general" | "appearance" | "privacy" | "system";

const TABS = [
  { value: "general", label: "General" },
  { value: "appearance", label: "Appearance" },
  { value: "privacy", label: "Privacy" },
  { value: "system", label: "System" },
];

// --- Privacy: the API-token card (bounded table, D-094) ----------------------
interface TokenRow {
  id: string;
  name: string;
  created: string;
  lastUsed: string;
}
const TOKENS: TokenRow[] = [
  { id: "t1", name: "Home Assistant", created: "2026-05-02", lastUsed: "2026-07-16" },
  { id: "t2", name: "MagicMirror (hallway)", created: "2026-06-11", lastUsed: "—" },
];
const TOKEN_COLS: Column<TokenRow>[] = [
  { key: "name", label: "Name", sortable: true, truncate: true, render: (r) => <span className="set__tokname">{r.name}</span> },
  { key: "created", label: "Created", render: (r) => r.created },
  // A token that has never been used shows a BARE em dash — absent is real, never "never" fabricated.
  { key: "lastUsed", label: "Last used", render: (r) => r.lastUsed },
  {
    key: "id",
    label: "",
    render: () => (
      <Button onClick={() => {}}>Revoke</Button>
    ),
  },
];

interface SettingsMockupProps {
  initialTab?: TabId;
  /** D-003 graceful degradation — false hides/disables the sudo-helper-dependent System controls. */
  adminAvailable?: boolean;
  /** Stage the empty API-token register. */
  tokensEmpty?: boolean;
  /** Stage the token-created "shown once" reveal Dialog. */
  tokenReveal?: boolean;
}

export function SettingsMockup({
  initialTab = "general",
  adminAvailable = true,
  tokensEmpty = false,
  tokenReveal = false,
}: SettingsMockupProps) {
  const [tab, setTab] = useState<TabId>(initialTab);
  // Static toggle states — the specimen shows a settled ON no-egress so the derived statement reads.
  const [noEgress, setNoEgress] = useState(true);

  return (
    <div className="lf-page set">
      <PageHeader
        title="Settings"
        subtitle="Preferences for this install — how figures are reported, how the app looks on this device, your privacy posture, and system controls."
      />

      <div className="set__tabs">
        <Segmented
          aria-label="Settings sections"
          options={TABS}
          value={tab}
          onChange={(v) => setTab(v as TabId)}
        />
      </div>

      <div className="set__panel" role="tabpanel">
        {tab === "general" && <GeneralPanel />}
        {tab === "appearance" && <AppearancePanel />}
        {tab === "privacy" && (
          <PrivacyPanel
            noEgress={noEgress}
            onNoEgress={setNoEgress}
            tokensEmpty={tokensEmpty}
            tokenReveal={tokenReveal}
          />
        )}
        {tab === "system" && <SystemPanel adminAvailable={adminAvailable} />}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- //
// GENERAL — base currency · timezone · long_term_days (§9-1)
// --------------------------------------------------------------------------- //
function GeneralPanel() {
  return (
    <section className="lf-card set__section">
      <div className="lf-card__body set__grid">
        <Field
          label="Base / reporting currency"
          help="Every page reports in this currency. Changing it restarts valuation so the whole app re-reports — a moment of recompute, not instant."
        >
          <MasterSelect master="base_currency" value="SGD" onChange={() => {}} aria-label="Base currency" />
        </Field>

        <Field label="Timezone" help="Used for the clock and every timestamp. The server validates against its IANA zone list.">
          <Combobox
            options={[
              { value: "Asia/Singapore", label: "Asia/Singapore" },
              { value: "Europe/London", label: "Europe/London" },
              { value: "America/New_York", label: "America/New_York" },
            ]}
            value="Asia/Singapore"
            onChange={() => {}}
            aria-label="Timezone"
          />
        </Field>

        <Field
          label="Long-term threshold"
          help="Holdings held at least this many days are shown as long-term in the Realised P/L and tax-lots reports. A neutral organisation split — not tax advice, and with no jurisdiction presets."
        >
          <div className="set__daysfield">
            <TextInput value="365" onChange={() => {}} aria-label="Long-term threshold in days" maxLength={4} />
            <span className="set__affix">days</span>
          </div>
        </Field>
      </div>
    </section>
  );
}

// --------------------------------------------------------------------------- //
// APPEARANCE — per-device (D-078)
// --------------------------------------------------------------------------- //
function AppearancePanel() {
  return (
    <section className="lf-card set__section">
      <div className="lf-card__body set__grid">
        <p className="set__perdevice">
          These are saved on <strong>this device only</strong> — they do not sync across browsers or
          survive a data restore (they describe the display, not your data).
        </p>

        <Field label="Theme" help="System follows your operating system.">
          <Select
            options={[
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
            value="system"
            onChange={() => {}}
            aria-label="Theme"
          />
        </Field>

        <Field label="Density" help="Compact fits more rows per screen.">
          <Select
            options={[
              { value: "comfortable", label: "Comfortable" },
              { value: "compact", label: "Compact" },
            ]}
            value="comfortable"
            onChange={() => {}}
            aria-label="Density"
          />
        </Field>

        <Field label="High contrast" help="Stronger borders and text contrast.">
          <Switch checked={false} onChange={() => {}} aria-label="High contrast" />
        </Field>

        <Field label="Reduced motion" help="Stops animations and the ticker scroll.">
          <Switch checked={false} onChange={() => {}} aria-label="Reduced motion" />
        </Field>
      </div>
    </section>
  );
}

// --------------------------------------------------------------------------- //
// PRIVACY (§9-9) — one no-egress toggle → derived state statement · token card
// --------------------------------------------------------------------------- //
function PrivacyPanel({
  noEgress,
  onNoEgress,
  tokensEmpty,
  tokenReveal,
}: {
  noEgress: boolean;
  onNoEgress: (v: boolean) => void;
  tokensEmpty: boolean;
  tokenReveal: boolean;
}) {
  return (
    <div className="set__stack">
      {/* Token-created "shown once" reveal — the raw token appears EXACTLY ONCE (tokens.py:37-39);
          a re-open never re-reveals it. Staged as a STATIC dialog-body frame (the real Dialog
          portals a full-screen modal — the gate ratifies the copy + affordance by looking, the
          Accounts merge-dialog precedent). */}
      {tokenReveal && (
        <div className="set__dialogframe" role="group" aria-label="Token created — shown once">
          <h3 className="set__dialogtitle">Token created — copy it now</h3>
          <p className="set__oncewarn">
            This is the only time this token is shown. Copy it now — you will not be able to see it again.
          </p>
          <code className="set__tokenreveal">lf_tok_9f3a2b7c4d5e6f7a8b9c0d1e2f3a4b5c</code>
          <div className="set__dialogfoot">
            <Button onClick={() => {}}>Done</Button>
          </div>
        </div>
      )}
      <section className="lf-card set__section">
        <div className="lf-card__body set__grid">
          <Field
            label="No-egress mode"
            help="When on, the app makes no outbound network calls — prices and news go stale honestly rather than reaching out."
          >
            <Switch checked={noEgress} onChange={onNoEgress} aria-label="No-egress mode" />
          </Field>

          {/* The egress STATE STATEMENT is DERIVED from the one toggle — it cannot disagree with it
              (§9-9). A plain statement, never a metric (P-1/D-031). */}
          <div className="set__statement" role="status">
            <StatusChip
              label={noEgress ? "No-egress: On" : "No-egress: Off"}
              tone={noEgress ? "positive" : "neutral"}
            />
            <p className="set__statementtext">
              {noEgress
                ? "This device makes no network calls."
                : "This device may reach configured providers for prices and news."}
            </p>
          </div>

          <p className="set__aicopy">AI never persists your conversations — nothing you ask is stored.</p>
        </div>
      </section>

      <section className="lf-card set__section">
        <header className="set__cardhead">
          <h2 className="lf-card__title">API tokens</h2>
          <Button icon={Plus} onClick={() => {}}>Create token</Button>
        </header>
        <div className="lf-card__body">
          {tokensEmpty ? (
            <EmptyState
              message="No API tokens yet"
              reason="Create a token to let a read-only widget (Home Assistant, a wall display) show your summary over your LAN."
              action={<Button icon={Plus} onClick={() => {}}>Create token</Button>}
            />
          ) : (
            <>
              <DataTable<TokenRow> caption="API tokens for read-only LAN widgets" columns={TOKEN_COLS} rows={TOKENS} stickyHeader />
              <p className="set__tokennote">
                Revoking a token cuts off anything using it. A revoked token can be re-created — revoke
                needs your session, not a fresh PIN.
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

// --------------------------------------------------------------------------- //
// SYSTEM (§9-10) — graceful degradation without the sudo helper (D-003)
// --------------------------------------------------------------------------- //
function SystemPanel({ adminAvailable }: { adminAvailable: boolean }) {
  return (
    <div className="set__stack">
      <section className="lf-card set__section">
        <header className="set__cardhead">
          <h2 className="lf-card__title">Root helper</h2>
          <StatusChip
            label={adminAvailable ? "Root helper: available" : "Root helper: not installed"}
            tone={adminAvailable ? "positive" : "attention"}
          />
        </header>
        <div className="lf-card__body set__grid">
          {!adminAvailable && (
            <p className="set__degraded">
              Some system controls need the optional root helper — an install-time opt-in. It is not
              installed, so those controls are shown but disabled. Everything else on this page works
              regardless.
            </p>
          )}

          <Field
            label="Market data provider"
            help={adminAvailable ? "The lane prices come from." : "Read-only — enabling a change needs the root helper."}
          >
            <Select
              options={[
                { value: "yahoo", label: "Yahoo" },
                { value: "alphavantage", label: "Alpha Vantage" },
              ]}
              value="yahoo"
              onChange={() => {}}
              disabled={!adminAvailable}
              aria-label="Market data provider"
            />
          </Field>

          <Field label="Auto-lock after" help="Minutes of inactivity before the app locks.">
            <div className="set__daysfield">
              <TextInput value="15" onChange={() => {}} disabled={!adminAvailable} aria-label="Auto-lock minutes" maxLength={3} />
              <span className="set__affix">min</span>
            </div>
          </Field>

          <Field label="Allow LAN access" help="Serve to other devices on your local network (never the internet).">
            <Switch checked onChange={() => {}} disabled={!adminAvailable} aria-label="Allow LAN access" />
          </Field>
        </div>
      </section>

      <section className="lf-card set__section">
        <header className="set__cardhead">
          <h2 className="lf-card__title">Data</h2>
        </header>
        <div className="lf-card__body set__grid">
          <Field label="Reset data" help="Erase all data and start clean. This cannot be undone — it asks for a fresh PIN.">
            <Button className="set__dangerbtn" onClick={() => {}} disabled={!adminAvailable}>
              Reset data…
            </Button>
          </Field>
          {!adminAvailable && (
            <p className="set__degraded">Reset needs the root helper (it rewrites the data directory) — install it to enable this.</p>
          )}
        </div>
      </section>
    </div>
  );
}

// --------------------------------------------------------------------------- //
// A labelled field row: label · control · help. Shared by every tab.
// --------------------------------------------------------------------------- //
function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <div className="set__field">
      <div className="set__fieldlabel">{label}</div>
      <div className="set__fieldcontrol">{children}</div>
      {help && <p className="set__fieldhelp">{help}</p>}
    </div>
  );
}

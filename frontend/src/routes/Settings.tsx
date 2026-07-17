// SPDX-License-Identifier: AGPL-3.0-or-later
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Button,
  Combobox,
  ConfirmDialog,
  DataTable,
  Dialog,
  EmptyState,
  GlossaryTerm,
  MasterSelect,
  PageHeader,
  Segmented,
  Select,
  Skeleton,
  StatusChip,
  Switch,
  TextInput,
  useToast,
} from "../components/ui";
import type { Column } from "../components/ui";
import { Plus, Trash2 } from "../icons";
import { useTheme } from "../theme/theme-context";
import { useDisplay } from "../theme/display-context";
import { getSettings, putSettings } from "../api/settings";
import type { SettingsData } from "../api/settings";
import { listTokens, createToken, revokeToken } from "../api/tokens";
import type { TokenMeta, CreatedToken } from "../api/tokens";
import {
  getDataSource,
  putDataSource,
  getSystemConfig,
  putSystemConfig,
  getAiConfig,
  getLanEnabled,
  setLanAccess,
  resetData,
  getPinSet,
} from "../api/systemConfig";
import type { DataSource, SystemConfig, AiConfig } from "../api/systemConfig";
import { getFeeds, putFeeds, testFeeds } from "../api/feeds";
import type { FeedTestResult } from "../api/feeds";
import {
  getRoutingMatrix,
  putRoutingCell,
  deleteRoutingCell,
  getProviders,
} from "../api/routing-matrix";
import type { RoutingCell, ProvidersResp } from "../api/routing-matrix";
import { useLabelFor } from "../refdata/refdata-context";
import { setPin } from "../api/system";
import "./Settings.css";

// R-38 §9-5: the matrix market vocab is the router's own ISO-3166 alpha-2 region set + the "*"
// wildcard (NOT the D-083 six-bucket display model). "*" is shown as "All markets".
const marketLabel = (code: string) => (code === "*" ? "All markets" : code);

// Settings (/settings) — page-settings Phase 1 (the specimen at §11 turned into a REAL, wired page).
// Every value shown is a SERVED display string (D-105): the frontend computes nothing, and there is
// NO money math on this page (P-1/D-031). Writes go through the CANONICAL endpoints only — /settings,
// /tokens, /system/*, /auth/* — never a second code path. Tab state lives in the URL (Amendment C):
// `?tab=general|appearance|privacy|data-feeds|system`, so the first-run checklist links deep-link to
// the tab that holds the control they name.
//
// §14st-1 (owner, Phase-3b walk 2026-07-18): a "Data feeds" tab is the canonical home for feed/provider
// config — market data provider, write-only provider API key, stale-after posture (not yet built —
// served only), and the ND-6 news-feeds editor.
// §14st-2 (owner re-walk 2026-07-18, option B): a SIXTH "AI" tab. The read-only served AI-config line
// MOVES out of System to its own AI tab (System loses it); the "AI never persists" statement stays in
// Privacy (its D-069 home). Named "AI", NOT "AI & Voice" — R-32 (Voice) is undefined and naming an
// undefined surface would invent behaviour; it gains "& Voice" only after the owner's R-32 definition.
// System keeps the ACCESS controls (root helper status, PIN, auto-lock, Allow LAN, Reset data) — auto-
// lock and LAN are access controls, not feeds.

const TRUTHY = new Set(["1", "true", "yes", "on"]);
type TabId = "general" | "appearance" | "privacy" | "data-feeds" | "ai" | "system";
const TAB_IDS: TabId[] = ["general", "appearance", "privacy", "data-feeds", "ai", "system"];
const TABS = [
  { value: "general", label: "General" },
  { value: "appearance", label: "Appearance" },
  { value: "privacy", label: "Privacy" },
  { value: "data-feeds", label: "Data feeds" },
  { value: "ai", label: "AI" },
  { value: "system", label: "System" },
];

function timezoneOptions() {
  const zones =
    (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.(
      "timeZone",
    ) ?? ["UTC", "Asia/Singapore", "America/New_York", "Europe/London"];
  return zones.map((z) => ({ label: z, value: z }));
}

// A served ISO timestamp → its date part (a display slice, not a computed figure). Null → em dash.
const isoDate = (iso: string | null): string => (iso ? iso.slice(0, 10) : "—");

export function Settings() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const tab: TabId = TAB_IDS.includes(raw as TabId) ? (raw as TabId) : "general";
  const setTab = (v: string) => setParams({ tab: v }, { replace: true });

  return (
    <div className="lf-page set">
      <PageHeader
        title="Settings"
        subtitle="Preferences for this install — how figures are reported, how the app looks on this device, your privacy posture, and system controls."
      />

      <div className="set__tabs">
        <Segmented aria-label="Settings sections" options={TABS} value={tab} onChange={setTab} />
      </div>

      <div className="set__panel" role="tabpanel" aria-label={`${tab} settings`}>
        {tab === "general" && <GeneralPanel />}
        {tab === "appearance" && <AppearancePanel />}
        {tab === "privacy" && <PrivacyPanel />}
        {tab === "data-feeds" && <DataFeedsPanel />}
        {tab === "ai" && <AiPanel />}
        {tab === "system" && <SystemPanel />}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- //
// GENERAL — base currency · timezone · long_term_days (§9-1)
// --------------------------------------------------------------------------- //
function GeneralPanel() {
  const toast = useToast();
  const [data, setData] = useState<SettingsData | null | undefined>(undefined);
  const reload = useCallback(() => {
    setData(undefined);
    getSettings().then((d) => setData(d));
  }, []);
  useEffect(() => reload(), [reload]);

  // Local edit buffer for the threshold (a number field commits on Enter/blur, not per keystroke).
  const [days, setDays] = useState<string>("");
  useEffect(() => {
    if (data) setDays(String(data.defaults.long_term_days));
  }, [data]);

  if (data === undefined) return <CardSkeleton />;
  if (data === null) return <LoadError onRetry={reload} />;

  const baseCurrency = data.stored.base_currency ?? data.defaults.base_currency;
  const timezone = data.stored.timezone ?? data.defaults.timezone;

  const saveCurrency = async (v: string) => {
    const r = await putSettings({ base_currency: v });
    toast.show(
      r.ok
        ? { message: `Base currency set to ${v}. Valuation is restarting so every page re-reports.`, tone: "warning" }
        : { message: `Couldn't change currency: ${r.error}` },
    );
    if (r.ok) reload();
  };
  const saveTimezone = async (v: string) => {
    const r = await putSettings({ timezone: v });
    toast.show(r.ok ? { message: "Timezone saved." } : { message: `Couldn't save timezone: ${r.error}` });
    if (r.ok) reload();
  };
  const saveDays = async () => {
    if (days === String(data.defaults.long_term_days)) return;
    const r = await putSettings({ long_term_days: days.trim() });
    toast.show(r.ok ? { message: "Long-term threshold saved." } : { message: r.error });
    if (r.ok) reload();
    else setDays(String(data.defaults.long_term_days));
  };

  return (
    <section className="lf-card set__section">
      <div className="lf-card__body set__grid">
        <Field
          label="Base / reporting currency"
          help="Every page reports in this currency. Changing it restarts valuation so the whole app re-reports — a moment of recompute, not instant."
        >
          <MasterSelect master="base_currency" value={baseCurrency} onChange={saveCurrency} aria-label="Base currency" />
        </Field>

        <Field label="Timezone" help="Used for the clock and every timestamp. The server validates against its IANA zone list.">
          <Combobox options={timezoneOptions()} value={timezone} onChange={saveTimezone} aria-label="Timezone" />
        </Field>

        <Field
          label="Long-term threshold"
          help="Holdings held at least this many days are shown as long-term in the Realised P/L and tax-lots reports. A neutral organisation split — not tax advice, and with no jurisdiction presets."
        >
          <div className="set__daysfield">
            <TextInput
              value={days}
              onChange={(v) => setDays(v.replace(/[^0-9]/g, "").slice(0, 4))}
              onEnter={saveDays}
              aria-label="Long-term threshold in days"
              maxLength={4}
            />
            <span className="set__affix">days</span>
            <Button onClick={saveDays}>Save</Button>
          </div>
        </Field>
      </div>
    </section>
  );
}

// --------------------------------------------------------------------------- //
// APPEARANCE — per-device (D-078); DisplayProvider ONLY, zero server calls
// --------------------------------------------------------------------------- //
function AppearancePanel() {
  const { choice, setChoice } = useTheme();
  const { density, setDensity, contrast, setContrastPref, motion, setMotionPref } = useDisplay();

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
            value={choice}
            onChange={(v) => setChoice(v as typeof choice)}
            aria-label="Theme"
          />
        </Field>

        <Field label="Density" helpTerm="term-density" help="Compact fits more rows per screen.">
          <Select
            options={[
              { value: "comfortable", label: "Comfortable" },
              { value: "compact", label: "Compact" },
            ]}
            value={density}
            onChange={(v) => setDensity(v as typeof density)}
            aria-label="Density"
          />
        </Field>

        <Field label="High contrast" helpTerm="term-high-contrast" help="Stronger borders and text contrast.">
          <Switch
            checked={contrast === "high"}
            onChange={(on) => setContrastPref(on ? "high" : "normal")}
            aria-label="High contrast"
          />
        </Field>

        <Field label="Reduced motion" helpTerm="term-reduced-motion" help="Stops animations and the ticker scroll.">
          <Switch
            checked={motion === "reduced"}
            onChange={(on) => setMotionPref(on ? "reduced" : "full")}
            aria-label="Reduced motion"
          />
        </Field>
      </div>
    </section>
  );
}

// --------------------------------------------------------------------------- //
// PRIVACY (§9-9) — one no-egress toggle → derived state statement · token card
// --------------------------------------------------------------------------- //
function PrivacyPanel() {
  const toast = useToast();
  const [data, setData] = useState<SettingsData | null | undefined>(undefined);
  const reload = useCallback(() => {
    setData(undefined);
    getSettings().then((d) => setData(d));
  }, []);
  useEffect(() => reload(), [reload]);

  if (data === undefined) return <CardSkeleton />;
  if (data === null) return <LoadError onRetry={reload} />;

  const noEgress = TRUTHY.has((data.stored.privacy_mode ?? "").toLowerCase());
  const onNoEgress = async (on: boolean) => {
    const r = await putSettings({ privacy_mode: on ? "true" : "false" });
    toast.show(r.ok ? { message: on ? "No-egress on." : "No-egress off." } : { message: r.error });
    if (r.ok) reload();
  };

  return (
    <div className="set__stack">
      <section className="lf-card set__section">
        <div className="lf-card__body set__grid">
          <Field
            label="No-egress mode"
            helpTerm="term-privacy-mode"
            help="When on, the app makes no outbound network calls — prices and news go stale honestly rather than reaching out."
          >
            <Switch checked={noEgress} onChange={onNoEgress} aria-label="No-egress mode" />
          </Field>

          {/* The egress STATE STATEMENT is DERIVED from the one toggle — it cannot disagree with it
              (§9-9). A plain statement, never a metric (P-1/D-031). */}
          <div className="set__statement" role="status">
            <StatusChip label={noEgress ? "No-egress: On" : "No-egress: Off"} tone={noEgress ? "positive" : "neutral"} />
            <p className="set__statementtext">
              {noEgress
                ? "This device makes no network calls."
                : "This device may reach configured providers for prices and news."}
            </p>
          </div>

          <p className="set__aicopy">AI never persists your conversations — nothing you ask is stored.</p>
        </div>
      </section>

      <TokenCard />
    </div>
  );
}

// --- Privacy: the API-token card --------------------------------------------
const TOKEN_COLS = (onRevoke: (t: TokenMeta) => void): Column<TokenMeta>[] => [
  { key: "name", label: "Name", sortable: true, truncate: true, render: (r) => <span className="set__tokname">{r.name}</span> },
  { key: "created_at", label: "Created", render: (r) => isoDate(r.created_at) },
  // A never-used token shows a BARE em dash — absent is real, never "never" fabricated.
  { key: "last_used_at", label: "Last used", render: (r) => isoDate(r.last_used_at) },
  { key: "id", label: "", render: (r) => <Button onClick={() => onRevoke(r)}>Revoke</Button> },
];

function TokenCard() {
  const toast = useToast();
  const [tokens, setTokens] = useState<TokenMeta[] | null | undefined>(undefined);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [revoke, setRevoke] = useState<TokenMeta | null>(null);
  const [reveal, setReveal] = useState<CreatedToken | null>(null);

  const reload = useCallback(() => {
    setTokens(undefined);
    listTokens().then((t) => setTokens(t));
  }, []);
  useEffect(() => reload(), [reload]);

  const doCreate = async () => {
    const r = await createToken(name.trim() || "API token");
    setCreateOpen(false);
    setName("");
    if (r.ok) {
      setReveal(r.token); // shown ONCE
      reload();
    } else {
      toast.show({ message: `Couldn't create token: ${r.error}` });
    }
  };
  const doRevoke = async () => {
    if (!revoke) return;
    const r = await revokeToken(revoke.id);
    setRevoke(null);
    toast.show(r.ok ? { message: "Token revoked." } : { message: `Couldn't revoke: ${r.error}` });
    if (r.ok) reload();
  };

  return (
    <section className="lf-card set__section">
      <header className="set__cardhead">
        <h2 className="lf-card__title">
          <GlossaryTerm term="term-api-token">API tokens</GlossaryTerm>
        </h2>
        <Button icon={Plus} onClick={() => setCreateOpen(true)}>Create token</Button>
      </header>
      <div className="lf-card__body">
        {tokens === undefined && <Skeleton lines={3} />}
        {tokens === null && <EmptyState message="Couldn't load tokens" reason="The token list didn't load. Try again." action={<Button onClick={reload}>Retry</Button>} />}
        {tokens && tokens.length === 0 && (
          <EmptyState
            message="No API tokens yet"
            reason="Create a token to let a read-only widget (Home Assistant, a wall display) show your summary over your LAN."
            action={<Button icon={Plus} onClick={() => setCreateOpen(true)}>Create token</Button>}
          />
        )}
        {tokens && tokens.length > 0 && (
          <>
            <DataTable<TokenMeta> caption="API tokens for read-only LAN widgets" columns={TOKEN_COLS(setRevoke)} rows={tokens} stickyHeader />
            <p className="set__tokennote">
              Revoking a token cuts off anything using it. A revoked token can be re-created — revoke
              needs your session, not a fresh PIN.
            </p>
          </>
        )}
      </div>

      {/* Create token — a small named-input Dialog (require_session). */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create API token"
        footer={
          <>
            <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="primary" icon={Plus} onClick={doCreate}>Create token</Button>
          </>
        }
      >
        <p className="set__dialoglead">Name it for the device that will use it — the raw token is shown once.</p>
        <TextInput value={name} onChange={setName} placeholder="e.g. Home Assistant" onEnter={doCreate} aria-label="Token name" maxLength={80} />
      </Dialog>

      {/* Token created — shown EXACTLY ONCE (tokens.py:37-39); a re-open never re-reveals it. */}
      <Dialog
        open={reveal !== null}
        onClose={() => setReveal(null)}
        title="Token created — copy it now"
        footer={<Button variant="primary" onClick={() => setReveal(null)}>Done</Button>}
      >
        <p className="set__oncewarn">
          This is the only time this token is shown. Copy it now — you will not be able to see it again.
        </p>
        {reveal && <code className="set__tokenreveal">{reveal.token}</code>}
      </Dialog>

      {/* Revoke — require_session (§9-8), NOT a fresh PIN (D-103 binds the destructive purge only). */}
      <ConfirmDialog
        open={revoke !== null}
        title="Revoke this token?"
        message={revoke ? `"${revoke.name}" will stop working immediately. Anything using it loses access. You can create a new token any time.` : ""}
        confirmLabel="Revoke"
        destructive
        onCancel={() => setRevoke(null)}
        onConfirm={doRevoke}
      />
    </section>
  );
}

// --------------------------------------------------------------------------- //
// DATA FEEDS (§14st-1) — market provider · write-only key (§12st-2) · ND-6 feeds (§12st-3)
// --------------------------------------------------------------------------- //
// Feed/provider config is its own nature (owner, Phase-3b walk 2026-07-18). These controls apply
// through the app's own endpoints and work REGARDLESS of the root helper (the §9-10 refinement: only
// Allow LAN — an access control that stays in System — genuinely needs it).
function DataFeedsPanel() {
  const toast = useToast();
  const [ds, setDs] = useState<DataSource | null | undefined>(undefined);
  const reload = useCallback(() => {
    setDs(undefined);
    getDataSource().then(setDs);
  }, []);
  useEffect(() => reload(), [reload]);

  if (ds === undefined) return <CardSkeleton />;
  if (ds === null) return <LoadError onRetry={reload} />;

  return (
    <div className="set__stack">
      {/* Market-data provider + the write-only key (§12st-2). */}
      <section className="lf-card set__section">
        <header className="set__cardhead"><h2 className="lf-card__title">Market data</h2></header>
        <div className="lf-card__body set__grid">
          <Field label="Market data provider" helpTerm="term-data-provider" help="The lane prices come from.">
            <Select
              options={ds.providers.map((p) => ({ value: p, label: p }))}
              value={ds.provider}
              onChange={async (v) => {
                const r = await putDataSource({ provider: v });
                toast.show(r.ok ? { message: r.note ?? "Provider saved." } : { message: `Couldn't change provider: ${r.error}` });
                if (r.ok) reload();
              }}
              aria-label="Market data provider"
            />
          </Field>

          <ApiKeyField hasKey={ds.has_api_key} onSave={async (key) => {
            const r = await putDataSource({ api_key: key });
            toast.show(r.ok ? { message: "API key saved (stored, hidden)." } : { message: `Couldn't save key: ${r.error}` });
            if (r.ok) reload();
          }} />
        </div>
      </section>

      {/* News feeds editor (§12st-3 / ND-6) — Dialog + multi-URL + Test, [S]-gated. */}
      <FeedsCard />

      {/* Routing matrix editor (R-38 §14st-1) — the canonical home for the class×market→provider
          matrix, below Market data + News feeds. Composes DataTable + MasterSelect + StatusChip
          (§9-9, no amendment). The unkeyed caveat points at the Provider API key control above. */}
      <RoutingMatrixCard />
    </div>
  );
}

// --------------------------------------------------------------------------- //
// AI (§14st-2 / §12st-4) — a READ-ONLY served line; model management is deferred (AI-surfaces)
// --------------------------------------------------------------------------- //
// AI is its own nature (owner re-walk 2026-07-18, option B): "AI is what the machine does with the
// data." This tab surfaces ONLY the served AI-config line (D-105 — the frontend computes nothing) plus
// a static deferral note. Model MANAGEMENT stays deferred to the AI-surfaces milestone (D-067/D-068);
// nothing is invented beyond the moved line + the note. The "AI never persists" statement stays in
// Privacy (its D-069 home — no move, no duplicate). Named "AI", NOT "AI & Voice" (R-32 undefined).
function AiPanel() {
  const [ai, setAi] = useState<AiConfig | null | undefined>(undefined);
  useEffect(() => {
    getAiConfig().then((a) => setAi(a));
  }, []);

  return (
    <section className="lf-card set__section">
      <header className="set__cardhead"><h2 className="lf-card__title">AI configuration</h2></header>
      <div className="lf-card__body">
        <p className="set__aiconfig">
          {ai === undefined
            ? "Loading…"
            : ai
              ? ai.enabled
                ? `AI is on — provider ${ai.provider}, model ${ai.model || "(default)"}${ai.has_openai_key ? ", API key set" : ""}.`
                : "AI is off."
              : "AI configuration unavailable."}
        </p>
        <p className="set__fieldhelp">Model management lives with the AI surfaces — this line reflects the served configuration only.</p>
      </div>
    </section>
  );
}

// --------------------------------------------------------------------------- //
// SYSTEM (§9-10 + §12st) — root helper · PIN · auto-lock · LAN · reset
// --------------------------------------------------------------------------- //
// §14st-1: the ACCESS controls stay here (auto-lock and LAN are access controls, not feeds); the
// feed/provider config moved to Data feeds; §14st-2: the AI line moved to the AI tab. `ds` is still
// read for the D-003 `admin_available` signal that gates the ONE sudo-dependent control — Allow LAN.
function SystemPanel() {
  const toast = useToast();
  const [ds, setDs] = useState<DataSource | null | undefined>(undefined);
  const [cfg, setCfg] = useState<SystemConfig | null>(null);
  const [pinSet, setPinSet] = useState(false);
  const [lan, setLan] = useState(false);

  const reload = useCallback(() => {
    setDs(undefined);
    getDataSource().then(setDs);
    getSystemConfig().then(setCfg);
    getPinSet().then(setPinSet);
    getLanEnabled().then(setLan);
  }, []);
  useEffect(() => reload(), [reload]);

  if (ds === undefined) return <CardSkeleton />;
  if (ds === null) return <LoadError onRetry={reload} />;
  const adminAvailable = ds.admin_available;

  return (
    <div className="set__stack">
      {/* Root helper status + the D-003 degradation banner (only the LAN control truly needs it). */}
      <section className="lf-card set__section">
        <header className="set__cardhead">
          <h2 className="lf-card__title">Root helper</h2>
          <StatusChip
            label={adminAvailable ? "Root helper: available" : "Root helper: not installed"}
            tone={adminAvailable ? "positive" : "attention"}
          />
        </header>
        {!adminAvailable && (
          <div className="lf-card__body">
            <p className="set__degraded">
              The optional root helper is an install-time opt-in. It isn't installed, so system service
              actions that need it — <strong>Allow LAN access</strong> — are shown but disabled.
              Everything else here works regardless (an auto-lock change saves; the background worker
              just won't restart itself until the helper is installed).
            </p>
          </div>
        )}
      </section>

      {/* PIN (§12st-1) — require_auth; the first-run choice that had no Settings home (D-002/D-045). */}
      <PinCard pinSet={pinSet} onChanged={reload} />

      {/* Access controls (§14st-1) — auto-lock + Allow LAN stay in System; they are not feeds. */}
      <section className="lf-card set__section">
        <header className="set__cardhead"><h2 className="lf-card__title">Access &amp; auto-lock</h2></header>
        <div className="lf-card__body set__grid">
          <AutolockField value={cfg?.autolock_minutes ?? ""} onSave={async (mins) => {
            const r = await putSystemConfig({ autolock_minutes: mins });
            toast.show(r.ok ? { message: r.note ?? "Saved." } : { message: `Couldn't save: ${r.error}` });
            if (r.ok) reload();
          }} />

          <Field label="Allow LAN access" help="Serve to other devices on your local network (never the internet). Changing this needs the root helper.">
            <Switch
              checked={lan}
              disabled={!adminAvailable}
              onChange={async (on) => {
                const r = await setLanAccess(on);
                toast.show(r.ok ? { message: on ? "LAN access enabled." : "LAN access disabled." } : { message: `Couldn't change LAN access: ${r.error}` });
                if (r.ok) reload();
              }}
              aria-label="Allow LAN access"
            />
          </Field>
        </div>
      </section>

      {/* Reset data — the danger variant + ConfirmDialog + D-103 fresh purge-PIN. */}
      <section className="lf-card set__section">
        <header className="set__cardhead"><h2 className="lf-card__title">Data</h2></header>
        <div className="lf-card__body set__grid">
          <ResetDataControl pinSet={pinSet} onDone={reload} />
        </div>
      </section>
    </div>
  );
}

// --- System sub-controls ----------------------------------------------------
function PinCard({ pinSet, onChanged }: { pinSet: boolean; onChanged: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pin, setPinValue] = useState("");
  const save = async () => {
    const r = await setPin(pin);
    setOpen(false);
    setPinValue("");
    toast.show(r.ok ? { message: pinSet ? "PIN changed." : "PIN set." } : { message: `Couldn't set PIN: ${r.error}` });
    if (r.ok) onChanged();
  };
  return (
    <section className="lf-card set__section">
      <header className="set__cardhead">
        <h2 className="lf-card__title">PIN</h2>
        <StatusChip label={pinSet ? "PIN: set" : "PIN: not set"} tone={pinSet ? "positive" : "attention"} />
      </header>
      <div className="lf-card__body set__grid">
        <Field
          label={pinSet ? "Change PIN" : "Set a PIN"}
          help="A numeric PIN of at least 6 digits. This is an access lock for this install, not encryption — it keeps a casual passer-by out."
        >
          <Button onClick={() => setOpen(true)}>{pinSet ? "Change PIN…" : "Set PIN…"}</Button>
        </Field>
      </div>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={pinSet ? "Change PIN" : "Set a PIN"}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" disabled={pin.trim().length < 6} onClick={save}>{pinSet ? "Change PIN" : "Set PIN"}</Button>
          </>
        }
      >
        <p className="set__dialoglead">At least 6 digits.</p>
        <TextInput
          value={pin}
          onChange={(v) => setPinValue(v.replace(/[^0-9]/g, "").slice(0, 32))}
          onEnter={pin.trim().length >= 6 ? save : undefined}
          aria-label="New PIN"
        />
      </Dialog>
    </section>
  );
}

function ApiKeyField({ hasKey, onSave }: { hasKey: boolean; onSave: (key: string) => void }) {
  const [key, setKey] = useState("");
  return (
    <Field
      label="Provider API key"
      help={
        hasKey
          ? "A key is set (stored, hidden — it is never shown back). Enter a new key to replace it."
          : "Some providers need an API key. It is stored write-only and never shown back."
      }
    >
      <div className="set__daysfield">
        <TextInput
          value={key}
          onChange={setKey}
          placeholder={hasKey ? "•••••••• (set)" : "Paste key to set"}
          aria-label="Provider API key (write-only)"
        />
        <Button disabled={key.trim().length === 0} onClick={() => { onSave(key.trim()); setKey(""); }}>Save key</Button>
      </div>
    </Field>
  );
}

function AutolockField({ value, onSave }: { value: string; onSave: (mins: string) => void }) {
  const [mins, setMins] = useState(value);
  useEffect(() => setMins(value), [value]);
  return (
    <Field label="Auto-lock after" help="Minutes of inactivity before the app locks.">
      <div className="set__daysfield">
        <TextInput
          value={mins}
          onChange={(v) => setMins(v.replace(/[^0-9]/g, "").slice(0, 4))}
          onEnter={() => onSave(mins)}
          aria-label="Auto-lock minutes"
          maxLength={4}
        />
        <span className="set__affix">min</span>
        <Button onClick={() => onSave(mins)}>Save</Button>
      </div>
    </Field>
  );
}

function ResetDataControl({ pinSet, onDone }: { pinSet: boolean; onDone: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const doReset = async () => {
    setOpen(false);
    const r = await resetData();
    toast.show(r.ok ? { message: r.note ?? "Data reset." } : { message: `Couldn't reset: ${r.error}` });
    if (r.ok) onDone();
  };
  return (
    <>
      <Field
        label="Reset data"
        help={
          pinSet
            ? "Erase all portfolio and market data and start clean. This cannot be undone — it asks for your PIN."
            : "Erase all portfolio and market data. Set a PIN first — an irreversible wipe is refused on an install with no PIN."
        }
      >
        <Button variant="danger" icon={Trash2} disabled={!pinSet} onClick={() => setOpen(true)}>Reset data…</Button>
      </Field>
      <ConfirmDialog
        open={open}
        title="Reset all data?"
        message="This permanently erases all portfolio and market data (transactions, holdings, prices, snapshots, news). Your settings, PIN, and provider config are kept. This cannot be undone."
        confirmLabel="Reset data"
        destructive
        requirePin
        onCancel={() => setOpen(false)}
        onConfirm={doReset}
      />
    </>
  );
}

// --- Feeds editor (§12st-3) — the ratified Accounts-dialog pattern -----------
function FeedsCard() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [feeds, setFeeds] = useState<string[]>([]);
  const [results, setResults] = useState<FeedTestResult[] | null>(null);
  const [testing, setTesting] = useState(false);

  const load = async () => {
    const d = await getFeeds();
    setFeeds(d ? [...d.feeds] : []);
    setResults(null);
  };
  const openEditor = async () => { await load(); setOpen(true); };

  const save = async () => {
    const cleaned = feeds.map((f) => f.trim()).filter(Boolean);
    const r = await putFeeds(cleaned);
    setOpen(false);
    toast.show(r.ok ? { message: "News feeds saved." } : { message: `Couldn't save feeds: ${r.error}` });
  };
  const runTest = async () => {
    setTesting(true);
    // Save first so the test reflects what's in the editor, then test (test reads stored feeds).
    await putFeeds(feeds.map((f) => f.trim()).filter(Boolean));
    setResults((await testFeeds()) ?? []);
    setTesting(false);
  };

  return (
    <section className="lf-card set__section">
      <header className="set__cardhead">
        <h2 className="lf-card__title">News feeds</h2>
        <Button onClick={openEditor}>Edit feeds…</Button>
      </header>
      <div className="lf-card__body">
        <p className="set__fieldhelp">The RSS/Atom feeds the news briefing reads. Managed here; News stays display-only.</p>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="News feeds"
        size="lg"
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={runTest} disabled={testing}>{testing ? "Testing…" : "Test feeds"}</Button>
            <Button variant="primary" onClick={save}>Save feeds</Button>
          </>
        }
      >
        <p className="set__dialoglead">One feed URL per row. Test fetches each (no outbound calls under no-egress).</p>
        <div className="set__feedlist">
          {feeds.map((url, i) => {
            const res = results?.find((r) => r.url === url.trim());
            return (
              <div key={i} className="set__feedrow">
                <TextInput
                  value={url}
                  onChange={(v) => setFeeds((f) => f.map((u, j) => (j === i ? v : u)))}
                  placeholder="https://example.com/feed.xml"
                  aria-label={`Feed URL ${i + 1}`}
                />
                {res && (
                  <StatusChip
                    label={res.ok ? `OK · ${res.count}` : res.error ? "Failed" : "No items"}
                    tone={res.ok ? "positive" : "negative"}
                  />
                )}
                <Button onClick={() => setFeeds((f) => f.filter((_, j) => j !== i))} aria-label={`Remove feed ${i + 1}`}>Remove</Button>
              </div>
            );
          })}
          <Button icon={Plus} onClick={() => setFeeds((f) => [...f, ""])}>Add feed</Button>
        </div>
      </Dialog>
    </section>
  );
}

// --- Routing matrix editor (R-38 §14st-1 / data-feed-routing §9) ------------
// The canonical home for the provider routing matrix: one provider per asset-class × market,
// validated against real capability. Every option is SERVED (D-005) and the frontend computes NO
// routing decision (D-105) — capability is validated by the edit-time 400 (§9-3), rendered
// verbatim; a capable-but-unkeyed cell is accepted with a degraded caveat (§9-7); an empty matrix
// changes nothing (§9-2). Composes DataTable + MasterSelect + StatusChip + Button (§9-9 — ratified,
// NO §5 amendment). Read-only provenance of the outcome lives on Pricing Health (D-072).
function RoutingMatrixCard() {
  const toast = useToast();
  const labelFor = useLabelFor();
  const [cells, setCells] = useState<RoutingCell[] | null | undefined>(undefined);
  const [providers, setProviders] = useState<ProvidersResp | null | undefined>(undefined);
  // Add-rule draft (class + market + provider) + the honest edit-time reason the PUT returns.
  const [draftClass, setDraftClass] = useState("");
  const [draftMarket, setDraftMarket] = useState("*");
  const [draftProvider, setDraftProvider] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setCells(undefined);
    getRoutingMatrix().then((d) => setCells(d ? d.cells : null));
  }, []);
  useEffect(() => {
    reload();
    getProviders().then((p) => setProviders(p ?? null));
  }, [reload]);

  // SERVED option lists (D-005). Providers = the CAPABILITIES names; markets = the union of provider
  // regions + "*" (§9-5, the router's own vocab). Neither pre-decides validity — the authority is the
  // edit-time 400 (§9-3), so an impossible class×market→provider is taught, never silently hidden.
  const providerOptions = useMemo(
    () => Object.keys(providers?.capabilities ?? {}).sort().map((p) => ({ value: p, label: p })),
    [providers],
  );
  const marketOptions = useMemo(() => {
    const codes = new Set<string>();
    for (const cap of Object.values(providers?.capabilities ?? {})) for (const r of cap.regions) codes.add(r);
    codes.delete("*");
    return [{ value: "*", label: "All markets" }, ...[...codes].sort().map((c) => ({ value: c, label: c }))];
  }, [providers]);

  const onAdd = useCallback(async () => {
    setAddError(null);
    const r = await putRoutingCell({ asset_class: draftClass, listing_country: draftMarket, provider: draftProvider });
    if (!r.ok) { setAddError(r.error); return; } // honest edit-time 400, rendered verbatim (§9-3)
    toast.show({
      message: r.cell.degraded && r.cell.caveat
        ? `Rule added — ${r.cell.caveat}.` // accept-with-caveat (§9-7): stored, shown degraded
        : `Rule added — ${labelFor("asset_class", r.cell.asset_class)} · ${marketLabel(r.cell.listing_country)} → ${r.cell.provider}.`,
    });
    setDraftClass(""); setDraftProvider(""); setDraftMarket("*");
    reload();
  }, [draftClass, draftMarket, draftProvider, toast, labelFor, reload]);

  const onChangeProvider = useCallback(async (cell: RoutingCell, provider: string) => {
    const r = await putRoutingCell({ asset_class: cell.asset_class, listing_country: cell.listing_country, provider });
    toast.show(r.ok ? { message: `Provider set to ${provider}.` } : { message: `Couldn't set provider: ${r.error}` });
    if (r.ok) reload();
  }, [toast, reload]);

  const onClear = useCallback(async (cell: RoutingCell) => {
    const r = await deleteRoutingCell(cell.asset_class, cell.listing_country);
    toast.show(r.ok ? { message: "Rule cleared — routing falls back to the default lane." } : { message: `Couldn't clear: ${r.error}` });
    if (r.ok) reload();
  }, [toast, reload]);

  const columns: Column<RoutingCell>[] = [
    { key: "asset_class", label: "Asset class", render: (c) => labelFor("asset_class", c.asset_class) },
    { key: "listing_country", label: "Market", render: (c) => marketLabel(c.listing_country) },
    {
      key: "provider", label: "Provider",
      render: (c) => (
        <MasterSelect
          master="source_override"
          options={providerOptions}
          value={c.provider}
          onChange={(v) => onChangeProvider(c, v)}
          aria-label={`Provider for ${labelFor("asset_class", c.asset_class)} · ${marketLabel(c.listing_country)}`}
        />
      ),
    },
    {
      key: "degraded", label: "State",
      // §9-7: a degraded cell shows the SERVED caveat as its label ("needs credentials — add them in
      // Settings"); the Provider API key control is in THIS same tab, above (Market data card).
      render: (c) => (c.degraded
        ? <StatusChip tone="attention" label={c.caveat ?? "Degraded"} />
        : <StatusChip tone="positive" label="Active" />),
    },
    {
      key: "updated_at", label: "", align: "right",
      render: (c) => (
        <Button
          icon={Trash2}
          onClick={() => onClear(c)}
          aria-label={`Clear rule for ${labelFor("asset_class", c.asset_class)} · ${marketLabel(c.listing_country)}`}
        >
          Clear
        </Button>
      ),
    },
  ];

  const canAdd = !!draftClass && !!draftMarket && !!draftProvider;

  return (
    <section className="lf-card set__section">
      <header className="set__cardhead">
        <h2 className="lf-card__title"><GlossaryTerm term="term-routing-matrix">Routing matrix</GlossaryTerm></h2>
      </header>
      <div className="lf-card__body set__stack">
        <p className="set__fieldhelp">
          One provider per asset-class × market. A rule only takes effect when its provider can actually
          price the instrument; otherwise routing falls through to the default lane, exactly as today.
        </p>

        {/* Add-rule flow: class + market + provider, capability-validated by the edit-time 400 (§9-3). */}
        <div className="set__matrixadd">
          <Field label="Asset class">
            <MasterSelect master="asset_class" value={draftClass} onChange={setDraftClass} aria-label="New rule — asset class" />
          </Field>
          <Field label="Market">
            <Select options={marketOptions} value={draftMarket} onChange={setDraftMarket} aria-label="New rule — market" />
          </Field>
          <Field label="Provider">
            <MasterSelect master="source_override" options={providerOptions} value={draftProvider} onChange={setDraftProvider} aria-label="New rule — provider" />
          </Field>
          <Button icon={Plus} variant="primary" onClick={onAdd} disabled={!canAdd}>Add rule</Button>
        </div>
        {addError && <p className="set__matrixerror" role="alert">{addError}</p>}

        {/* The matrix grid, or the honest empty state (§9-2 — an empty matrix changes nothing). */}
        {cells === undefined ? (
          <Skeleton lines={3} />
        ) : cells === null ? (
          <EmptyState message="Couldn't load the routing matrix" reason="It didn't load. Try again." action={<Button onClick={reload}>Retry</Button>} />
        ) : cells.length > 0 ? (
          <DataTable columns={columns} rows={cells} caption="Routing matrix — one provider per asset-class × market." />
        ) : (
          <EmptyState
            message="No routing rules yet"
            reason="An empty matrix changes nothing — every holding routes by its default lane and your active provider, exactly as today. Add a rule to prefer a specific provider for an asset-class in a market."
          />
        )}
      </div>
    </section>
  );
}

// --------------------------------------------------------------------------- //
// Shared bits
// --------------------------------------------------------------------------- //
function Field({
  label,
  help,
  helpTerm,
  children,
}: {
  label: string;
  help?: string;
  /** A GLOSSARY term id — wraps the label in a [Help] popover (§9-4). */
  helpTerm?: string;
  children: ReactNode;
}) {
  return (
    <div className="set__field">
      <div className="set__fieldlabel">{helpTerm ? <GlossaryTerm term={helpTerm}>{label}</GlossaryTerm> : label}</div>
      <div className="set__fieldcontrol">{children}</div>
      {help && <p className="set__fieldhelp">{help}</p>}
    </div>
  );
}

const CardSkeleton = () => (
  <section className="lf-card set__section">
    <div className="lf-card__body"><Skeleton lines={6} /></div>
  </section>
);

const LoadError = ({ onRetry }: { onRetry: () => void }) => (
  <section className="lf-card set__section">
    <div className="lf-card__body">
      <EmptyState message="Couldn't load settings" reason="These settings didn't load. Try again." action={<Button onClick={onRetry}>Retry</Button>} />
    </div>
  </section>
);

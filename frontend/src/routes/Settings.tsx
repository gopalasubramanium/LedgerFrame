// SPDX-License-Identifier: AGPL-3.0-or-later
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Button,
  Combobox,
  ConfirmDialog,
  DataTable,
  BrandLockup,
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
import { Plus, Trash2, Globe, Code, UserRound, GitBranch, Briefcase, Heart } from "../icons";
import type { LucideIcon } from "../icons";
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
import authorPhoto from "../assets/author-gs.jpg";
import { getFeeds, putFeeds, testFeeds } from "../api/feeds";
import type { FeedTestResult } from "../api/feeds";
import { getMasters, syncMaster } from "../api/masters";
import type { MasterState } from "../api/masters";
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
type TabId = "general" | "appearance" | "privacy" | "data-feeds" | "ai" | "system" | "about";
const TAB_IDS: TabId[] = ["general", "appearance", "privacy", "data-feeds", "ai", "system", "about"];
const TABS = [
  { value: "general", label: "General" },
  { value: "appearance", label: "Appearance" },
  { value: "privacy", label: "Privacy" },
  { value: "data-feeds", label: "Data feeds" },
  { value: "ai", label: "AI" },
  { value: "system", label: "System" },
  { value: "about", label: "About" },
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
  // R-54 §9-D: preserve sibling params. A fresh `{ tab: v }` object dropped every other query param
  // (latent today — no sibling is produced yet — fixed under the accepted-surface rite so R-60's
  // `?control=` and any future param survive a tab switch). The functional updater mutates the
  // CURRENT params, so only `tab` changes and siblings pass through.
  const setTab = (v: string) =>
    setParams(
      (prev) => {
        prev.set("tab", v);
        return prev;
      },
      { replace: true },
    );

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
        {tab === "about" && <AboutPanel />}
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
// Configured-state provider table (data-feed-routing §14dr-2) — a READ-ONLY surfacing of what
// /system/providers + /system/data-source already serve (D-105, no new field, no math): one row per
// provider · coverage · needs key · key SET/NOT SET · the active marker · the tier note where served.
// Never the key VALUE — write-only stands; SET/NOT SET only (the single stored key is a global fact).
interface ProviderRow {
  provider: string;
  coverage: string;
  needs_key: boolean;
  key_state: "Not needed" | "SET" | "NOT SET";
  key_note: string | null;
  active: boolean;
  // R-63 I-4 (two-premiums): VERIFIED capability per product, never one coarse claim.
  quote_tier: string | null;  // verified quote entitlement (delayed / real-time / end-of-day)
  index_tier: string | null;  // Index Data entitlement (premium / free / unknown) — a DIFFERENT product
}

function ProviderTable({ ds }: { ds: DataSource }) {
  const labelFor = useLabelFor();
  const [providers, setProviders] = useState<ProvidersResp | null | undefined>(undefined);
  useEffect(() => { getProviders().then(setProviders); }, []);

  const rows = useMemo<ProviderRow[]>(() => {
    if (!providers) return [];
    const activeName = providers.active;
    return Object.entries(providers.capabilities ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, cap]) => {
        const classes = cap.asset_classes.map((c) => labelFor("asset_class", c)).join(", ");
        const regions = cap.regions.map(marketLabel).join(", ");
        const active = name === activeName;
        // §14 key-slot honesty ruling: the single shared slot (LEDGERFRAME_MARKET_API_KEY) serves
        // exactly ONE provider — the active one. So SET shows ONLY on the active keyed row (labelled
        // "shared key slot"); every OTHER needs-key provider reads NOT SET with honest copy that it
        // has no key of its own and the slot currently serves the active provider. (Per-provider
        // credentials are ROADMAP R-41.) Composed from served facts — the accepted §14dr-2 pattern.
        let key_state: ProviderRow["key_state"];
        let key_note: string | null = null;
        if (!cap.needs_key) {
          key_state = "Not needed";
        } else if (active) {
          key_state = ds.has_api_key ? "SET" : "NOT SET";
          key_note = "shared key slot";
        } else {
          key_state = "NOT SET";
          key_note = `uses the shared slot — currently serving ${activeName}`;
        }
        return {
          provider: name,
          coverage: [classes, regions].filter(Boolean).join(" · ") || "—",
          needs_key: cap.needs_key,
          key_state,
          key_note,
          active,
          // Tiers are only served/meaningful for the active provider (e.g. alphavantage), and are
          // shown PER PRODUCT: a verified "delayed" quote entitlement must never read as the coarse
          // "premium" Index-Data claim (I-4, AC-9). null → not verified / not applicable (em dash).
          quote_tier: active ? (ds.quote_entitlement ?? null) : null,
          index_tier: active ? (ds.av_tier ?? null) : null,
        };
      });
  }, [providers, ds, labelFor]);

  const columns: Column<ProviderRow>[] = [
    { key: "provider", label: "Provider" },
    { key: "coverage", label: "Coverage", truncate: true },
    { key: "needs_key", label: "Needs key", render: (r) => (r.needs_key ? "Yes" : "No") },
    {
      key: "key_state", label: "Key",
      render: (r) => (r.key_state === "Not needed"
        ? <span className="set__fieldhelp">Not needed</span>
        : (
          <span className="set__keycell">
            <StatusChip tone={r.key_state === "SET" ? "positive" : "attention"} label={r.key_state} />
            {r.key_note && <span className="set__fieldhelp">{r.key_note}</span>}
          </span>
        )),
    },
    {
      key: "active", label: "Active", align: "right",
      render: (r) => (r.active ? <StatusChip tone="positive" label="Active" /> : <span aria-hidden>—</span>),
    },
    {
      // R-63 I-4: verified capability PER PRODUCT (quotes vs indices), never one coarse "premium".
      // PROPOSED copy — the owner ratifies at the 0a look.
      key: "quote_tier", label: "Verified tier",
      render: (r) =>
        r.quote_tier || r.index_tier ? (
          <span className="set__tiercell">
            <span className="set__fieldhelp">
              Quotes: {r.quote_tier ?? "not yet verified"}
            </span>
            {r.index_tier && <span className="set__fieldhelp">Indices: {r.index_tier}</span>}
          </span>
        ) : (
          <span aria-hidden>—</span>
        ),
    },
  ];

  if (providers === undefined) return <Skeleton lines={3} />;
  if (providers === null) return null; // the provider control above already carries the served list
  return <DataTable columns={columns} rows={rows} caption="Configured market-data providers (read-only)." />;
}

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
          {/* R-63 Phase 4 (§9-6): meaning shift — this is no longer the SINGLE source but the
              PREFERRED HEAD; the free-first chain still prices a holding the head can't. PROPOSED. */}
          <Field label="Market data provider" helpTerm="term-data-provider"
                 help="Your preferred head lane. Prices fall through the free-first chain when the head can't price a holding.">
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
        {/* §14dr-2: the configured providers, read-only (served facts only; never the key value). */}
        <div className="lf-card__body">
          <ProviderTable ds={ds} />
        </div>
      </section>

      {/* Instrument masters (§14dr-13) — the reference lists the Add-flow picker searches.
          v1 carried these sync affordances (01-FEATURE-INVENTORY:191); v2 dropped the UI
          without a recorded deferral. The backend sync engines never left — this card wires
          the existing require_auth /{master}/refresh triggers + served /status timestamps. */}
      <MastersCard />

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
// a static note. Model MANAGEMENT stays deferred (AI-surfaces shipped the Ask panel, not model config);
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
        {/* ⊕ 2026-07-20 (AI-surfaces §14-3, Finding 6 + the tab-copy ruling — ONE delta, because
            the 0a walk found this line wrong in TWO ways at once and fixing the truthfulness
            without the vocabulary would ship a sentence that is accurate and still unreadable).

            IT WAS COMPOSED HERE, and both defects followed from that. The old line interpolated
            the raw provider id — `AI is on — provider ${ai.provider}` — so it rendered the
            RETIRED vendor word "hailo" straight to the screen (§14-2), and it described whatever
            the served payload said, which at the walk was the `.env` FILE's provider rather than
            the one actually answering (§13-C).

            The sentence is now SERVED and rendered VERBATIM. That is the same rule the Ask
            panel's posture line follows and for the same reason (§0-C): a claim the product makes
            about what it is doing with the user's data has ONE author, and it is not the browser.
            The tab renders; it no longer decides. */}
        <p className="set__aiconfig" data-testid="ai-config-summary">
          {ai === undefined ? "Loading…" : ai ? ai.summary : "AI configuration unavailable."}
        </p>
        {/* ⊕ 2026-07-20 (AI-surfaces §17-4, Finding 9) — CONDITIONAL, and SERVED.

            The line above is always TRUE: it reports what this device is actually running. What
            it never said is that writing this configuration may not CHANGE that — an OS-env
            override (a systemd `Environment=`, a container `-e`) outranks the `.env` file, so a
            user could save, watch the line report something else, and find nothing on screen that
            explains why. A true sentence beside an unexplained outcome is its own kind of
            dishonesty: the reader concludes the save failed, or that they misread the tab.

            RENDERED ONLY WHEN TRUE, and the condition is the SERVED SENTENCE's presence rather
            than the `env_override` flag. Those come apart in exactly one case and it is the one
            worth designing for: a server that reports an override without wording for it. Keying
            on the flag would put this component in the position of inventing the sentence — the
            §0-C defect, reintroduced in the branch where a helpful fallback string is most
            tempting. No sentence, no paragraph. */}
        {ai?.env_override_note && (
          <p className="set__aiconfig-override" data-testid="ai-config-env-override" role="status">
            {ai.env_override_note}
          </p>
        )}
        {/* ⊕ 2026-07-20 (AI-surfaces §9(b)) — the deferral note is REPLACED, not deleted.
            The dead-affordance rule (page-settings §12 (d)) cuts both ways: a note promising
            something that has now shipped is as misleading as a control that does nothing. The
            Ask panel SHIPPED in this milestone, so "lives with the AI surfaces" now points at a
            milestone that has arrived. Model MANAGEMENT did not ship and is still deferred, so
            the note says exactly that and no more. This tab tells the truth about TODAY. */}
        {/* ⊕ 2026-07-20 (§14-3). "the served configuration only" → "the configuration this device
            is actually running". The old phrasing was RATIFIED (page-settings §15st-1) and was
            true of what the endpoint intended; it was not true of what the endpoint DID, which
            read the .env file while the process ran something else. The promise is the same
            promise — the wording now names the thing that makes it keepable.

            The external-model sentence is deliberately NOT "external models are configured here":
            no control here configures anything today, and a note promising one would be the
            dead-affordance rule (page-settings §12 (d)) broken in prose — the very rule the §9(b)
            note-replacement above was written to honour. It names this tab as where that
            configuration BELONGS, and says plainly in the next clause that the controls have not
            landed. */}
        <p className="set__fieldhelp">This tab is where the kind of intelligence — including an external model, which would send your data off this device — belongs. Model management is not configurable here yet — this line reflects the configuration this device is actually running. Ask, in the top bar, answers questions about your data using this configuration.</p>
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

// About — the SEVENTH Settings tab (D-069 amendment #3; page-help §9-bis-11(c), owner 2026-07-19,
// REVERSING the §9-bis-6 card ruling that put it inside System).
//
// WHY A TAB AND NOT A CARD. Every other Settings tab CHANGES something; About only tells you what
// the thing is and who made it. Filing a read-only identity surface behind a tab named for
// controls put it where nobody looking for it would go. The reversal is recorded in
// page-settings.md rather than rewritten over, because a plan file that erases its own reversals
// cannot be audited.
//
// ── REBUILT ON THE FOUR-BEAT TEMPLATE (page-help §9-bis-13, owner 2026-07-19) ──────────────────
//
// The owner REOPENED About's content ratification and adopted a four-beat narrative template:
// Story & Mission · Conflict · Resolution · Sequel. What is reopened is the COPY, not the
// placement — About is still the seventh tab, and `set__avatar` survives untouched.
//
// ONE SURFACE, DE-BOXED. The four bordered cards this replaces (about-brand / about-ethics /
// about-author / about-links) chopped one continuous piece of prose into four unrelated
// announcements. The beats are a story; a story is one surface. Hierarchy is carried by SPACING,
// not borders — which is why nothing here is an `lf-card`.
//
// ⚠ THE TEMPLATE'S ORIGINAL WORDING WAS VETOED ON ACCURACY, and that is the load-bearing note.
// It described a trading product: "globally connected trading systems", "purposeful profit /
// seamless integration / empowering teams", and a capital-allocation framing. LedgerFrame connects
// to nothing, trades nothing, has no team, and REPORTS RATHER THAN ACTS. The copy below is the
// architect's truthful rewrite. The rule it enforces: **About satisfies the SAME truth bar as Help
// content** — a page describing the product is product documentation, and a product whose central
// promise is that it would rather say nothing than say something untrue fails that promise first
// and worst in the paragraph where it describes itself. Borrowed template copy is exactly where
// this slips through, because it reads as polished and was never checked against what it describes.
//
// PROPOSED COPY — every string here is ratified by the owner AT THE RE-LOOK, like all user-facing
// copy. The author's professional sentences and the six links are the owner's own, verbatim.
//
// PROPOSED DS PATTERNS listed for the re-look: the pull-quote, the social-icon row, the
// brand-lockup size variant, the beat heading + its glyph, and the round avatar (`set__avatar`,
// carried over). The brand block is NOT a new pattern: it uses the ratified `BrandLockup`, because
// DESIGN-SYSTEM §5.6 says every surface showing the brand uses the one lockup, and the last time a
// surface hand-built its own the mobile header shipped without the mark.
//
// PUNCTUATION RULE (owner): prose sentences take full stops; pull-quotes and headings are exempt.

// The six owner-given destinations. `name` is the ACCESSIBLE NAME — it is not decoration, it is
// where the meaning lives, because the glyphs are semantic rather than brand marks (see icons.ts:
// lucide 1.24.0 has no `Github`/`Linkedin`, and adding a brand-icon package would need an ADR).
const ABOUT_LINKS: { url: string; href: string; name: string; Icon: LucideIcon }[] = [
  { url: "ledgerframe.org", href: "https://ledgerframe.org", name: "Project home", Icon: Globe },
  {
    url: "github.com/gopalasubramanium/ledgerframe",
    href: "https://github.com/gopalasubramanium/ledgerframe",
    name: "Source code on GitHub",
    Icon: Code,
  },
  { url: "me.sgopala.com", href: "https://me.sgopala.com/", name: "Author's site", Icon: UserRound },
  {
    url: "github.com/gopalasubramanium",
    href: "https://github.com/gopalasubramanium",
    name: "Author on GitHub",
    Icon: GitBranch,
  },
  {
    url: "linkedin.com/in/gopalasubramanium",
    href: "https://www.linkedin.com/in/gopalasubramanium/",
    name: "Author on LinkedIn",
    Icon: Briefcase,
  },
  // `Heart`, not `Coffee` — both were offered. A coffee cup is a tip-jar idiom that reads as a joke
  // about the price, and it sits directly under a sentence written in earnest.
  { url: "paypal.me/sgopala", href: "https://paypal.me/sgopala", name: "Support the project", Icon: Heart },
];

// A narrative beat: the ornament, the heading, the paragraph. The glyph is the TYPOGRAPHIC ORNAMENT
// ✦ and not a lucide sparkle — a sparkle icon is the AI-affordance vocabulary everywhere else in
// this product (D-088), and borrowing it here would imply these paragraphs were machine-written,
// which is the one thing About cannot imply. It is `aria-hidden`: it carries no meaning a reader
// who cannot see it is missing.
function Beat({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="set__beat">
      <h2 className="set__beathead">
        <span className="set__beatglyph" aria-hidden="true">✦</span>
        {title}
      </h2>
      <p className="set__beatbody">{children}</p>
    </section>
  );
}

function AboutPanel() {
  // The hovered/focused destination, shown in ONE reserved caption line under the row. A `title`
  // attribute was the obvious alternative and is the wrong one: it never appears for keyboard
  // focus, so the URL would be visible to a mouse and invisible to a Tab key. The caption is
  // `aria-hidden` because the accessible name already announces the destination — without it a
  // screen reader reads every link twice.
  const [shownUrl, setShownUrl] = useState<string | null>(null);

  return (
    <article className="set__about">
      <header className="set__aboutlede">
        <BrandLockup className="set__brandlockup" />
        <p className="set__tagline">A private record of everything you own and owe.</p>
      </header>

      <Beat title="The Story & Mission">
        Wealth ends up scattered across brokers, banks, funds, insurers and currencies, and no one
        of them can show the whole picture. LedgerFrame exists to keep that whole picture — private,
        complete, and on your own machine.
      </Beat>

      {/* PROPOSED DS — the pull-quote. No terminal full stop, per the owner's punctuation rule.
          A `blockquote` and not a styled `p`: it is a restatement of the line above it in the
          product's own voice, and the element that says so is the one to use. */}
      <blockquote className="set__pullquote">
        <p>One honest picture of everything you own and owe</p>
      </blockquote>

      <Beat title="The Conflict">
        Every app shows only its own slice. Aggregators want your credentials and your data in their
        cloud. Spreadsheets drift, and nothing says <q>I don&rsquo;t know</q> when it doesn&rsquo;t.
        The question no statement answers honestly at once: <em>where do I actually stand?</em>
      </Beat>

      <Beat title="The Resolution">
        A single-user, local-first reporting appliance: one derivation per figure, a dash and the
        reason where a value cannot be established, and consolidation without consolidating your
        privacy. It reports; it does not act.
      </Beat>

      <Beat title="The Sequel">
        The direction is more explanation, not more automation: derivations you can audit step by
        step, help that stays current with the platform — and still never a trade, never advice.
      </Beat>

      <section className="set__beat">
        <h2 className="set__beathead">Who built it</h2>
        <div className="set__author">
          {/* The round author avatar. VENDORED, never fetched: the import is bundled locally,
              because a local-first appliance advertising no telemetry cannot reach out to
              github.com to draw a face, and under no-egress a remote image would fail visibly.
              Provenance + EXIF-stripping recorded in docs/audit/ASSETS.md. `alt` names the person;
              it is not decorative — a reader who cannot see it should still learn whose photograph
              stands beside the bio. */}
          <img
            className="set__avatar"
            src={authorPhoto}
            alt="Gopala Subramanium"
            width={64}
            height={64}
            loading="lazy"
            decoding="async"
          />
          <div className="set__authorbio">
            <p className="set__authorname">
              Gopala Subramanium
              <span className="set__authorrole"> — Capital Market Solutions | Singapore.</span>
            </p>
            <p className="set__beatbody">
              With over two decades driving technological and operational excellence in financial
              services, Gopala architects platforms that bridge high-performance infrastructure with
              real-world capital-market demands. LedgerFrame is the tool its author wanted and could
              not buy.
            </p>

            {/* PROPOSED DS — the social-icon row. Icon-only, so every link carries an `aria-label`;
                external, so `rel` is not optional — `noopener` denies the opened page a handle back
                to this one. Nothing here is fetched: these are links, and a local-first appliance
                under no-egress stays local until the user chooses to leave. */}
            <ul className="set__social">
              {ABOUT_LINKS.map(({ url, href, name, Icon }) => (
                <li key={href}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={name}
                    onMouseEnter={() => setShownUrl(url)}
                    onMouseLeave={() => setShownUrl(null)}
                    onFocus={() => setShownUrl(url)}
                    onBlur={() => setShownUrl(null)}
                  >
                    <Icon aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
            {/* The caption line holds its height whether or not it has text, so pointing at an icon
                never nudges the licence line below it. */}
            <p className="set__socialcap" aria-hidden="true">{shownUrl ?? " "}</p>
          </div>
        </div>
      </section>

      {/* CREDITS RECONCILED WITH THE LICENCE RECORD (§9-bis-6). `docs/audit/LICENSES.md` is
          GENERATED ("Regenerate, never hand-edit") — a dependency audit, not a credits file. This
          line does not restate it: a restated list is a second home for something regenerated on a
          schedule, stale the first time a dependency moves. It names the licence this product ships
          under and credits the open-source stack in the general, which is the claim that stays
          true. */}
      <p className="set__licence">
        Released under the AGPL-3.0-or-later licence and built on open-source software — the full
        dependency and licence record ships with the source.
      </p>
    </article>
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
  const doReset = async (pin?: string) => {
    // §14dr-20 / D-103: thread the freshly-entered PIN — the server rejects an ambient
    // session (401) and only wipes with the correct fresh PIN.
    const r = await resetData(pin ?? "");
    if (r.ok) {
      setOpen(false);
      toast.show({ message: r.note ?? "Data reset." });
      onDone();
    } else {
      toast.show({ message: `Couldn't reset: ${r.error}`, tone: "warning" });
    }
  };
  return (
    <>
      <Field
        label="Reset data"
        help={
          pinSet
            ? "Erase all portfolio and market data and start clean, as if the app were newly installed. This cannot be undone — it asks for your PIN."
            : "Erase all portfolio and market data. Set a PIN first — an irreversible wipe is refused on an install with no PIN."
        }
      >
        <Button variant="danger" icon={Trash2} disabled={!pinSet} onClick={() => setOpen(true)}>Reset data…</Button>
      </Field>
      {/*
        THE SECOND SENTENCE IS A CONDITION OF A RULING, NOT A FLOURISH (page-legal §11-D3).
        A reset erases this install's acceptance of the Legal terms and re-locks the app behind the
        acceptance gate. That is deliberate — a reset returns first-run posture, and the usual
        reason to press this is to hand the install on, so the next person must be asked for
        themselves rather than inheriting someone else's agreement.

        It is spelled out HERE, before the wipe, because an unannounced version of it is exactly
        the silent re-lock the earlier decision refused: the user would be told their settings and
        PIN are kept and then find themselves locked out by something the dialog never mentioned.
        Deleting this sentence turns a ruled behaviour back into that defect, so it is guarded from
        the backend — `test_the_reset_confirmation_copy_STATES_the_erasure` in
        tests/integration/test_reset_data.py reads this file. Reword it freely; do not drop it.
      */}
      <ConfirmDialog
        open={open}
        title="Reset all data?"
        message="This permanently erases all portfolio and market data (transactions, holdings, prices, snapshots, news). Your settings, PIN, and provider config are kept. Because this returns the app to a freshly-installed state, it also clears the record that you accepted the Legal terms — the app will lock and ask you to accept them again before it reopens. This cannot be undone."
        confirmLabel="Reset data"
        destructive
        requirePin
        onCancel={() => setOpen(false)}
        onConfirm={doReset}
      />
    </>
  );
}

// --- Instrument masters (§14dr-13) — restored sync affordance ----------------
// Per master: served last-synced (honest "Never synced"), the entry count, and a
// Sync-now Button on the dr-8 async-action standard (loading = pending/disabled +
// result toast). No fabricated progress; served counts only. The picker's honest
// empty ("No … master synced yet") points users here (§14ac-2 journey).
function MastersCard() {
  const toast = useToast();
  const [masters, setMasters] = useState<MasterState[] | null | undefined>(undefined);
  const [syncing, setSyncing] = useState<string | null>(null);
  const reload = useCallback(() => {
    setMasters(undefined);
    getMasters().then(setMasters);
  }, []);
  useEffect(() => reload(), [reload]);

  const sync = async (key: MasterState["key"]) => {
    setSyncing(key);
    const r = await syncMaster(key);
    setSyncing(null);
    toast.show(
      r.ok
        ? { message: `Sync complete — ${r.count} entries.` }
        : { message: `Couldn't sync: ${r.error}`, tone: "warning" },
    );
    if (r.ok) reload();
  };

  return (
    <section className="lf-card set__section">
      <header className="set__cardhead"><h2 className="lf-card__title">Instrument masters</h2></header>
      <div className="lf-card__body">
        <p className="set__fieldhelp">
          The reference lists the Add-flow picker searches — mutual funds from AMFI, cryptos from
          CoinGecko. Sync pulls the latest master (opt-in network; nothing is fetched under no-egress).
        </p>
        {masters === undefined ? (
          <Skeleton lines={2} />
        ) : masters === null ? (
          <EmptyState
            message="Couldn't load masters"
            reason="The master status didn't load. Try again."
            action={<Button onClick={reload}>Retry</Button>}
          />
        ) : (
          <div className="set__masters">
            {masters.map((m) => (
              <div key={m.key} className="set__masterrow">
                <div className="set__masterinfo">
                  <span className="set__masterlabel">{m.label}</span>
                  <span className="set__fieldhelp">
                    {m.synced_at
                      ? `Last synced ${isoDate(m.synced_at)} · ${m.count} entries`
                      : "Never synced"}
                  </span>
                </div>
                <Button
                  onClick={() => sync(m.key)}
                  loading={syncing === m.key}
                  disabled={syncing !== null}
                >
                  Sync now
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// --- Feeds editor (§12st-3) — the ratified Accounts-dialog pattern -----------
function FeedsCard() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [feeds, setFeeds] = useState<string[]>([]);
  const [results, setResults] = useState<FeedTestResult[] | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false); // §14dr-8 async-action guard

  const load = async () => {
    const d = await getFeeds();
    setFeeds(d ? [...d.feeds] : []);
    setResults(null);
  };
  // §14dr-2: show the configured feeds read-only in the card on mount (the Dialog stays the editor).
  useEffect(() => { load(); }, []);
  const openEditor = async () => { await load(); setOpen(true); };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const cleaned = feeds.map((f) => f.trim()).filter(Boolean);
      const r = await putFeeds(cleaned);
      setOpen(false);
      toast.show(r.ok ? { message: "News feeds saved." } : { message: `Couldn't save feeds: ${r.error}` });
    } finally {
      setSaving(false);
    }
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
      <div className="lf-card__body set__stack">
        <p className="set__fieldhelp">The RSS/Atom feeds the news briefing reads. Managed here; News stays display-only.</p>
        {/* §14dr-2: the configured feed URLs, read-only. Empty state honest. */}
        {feeds.filter((f) => f.trim()).length > 0 ? (
          <DataTable
            columns={[{ key: "url", label: "Feed URL", truncate: true }]}
            rows={feeds.filter((f) => f.trim()).map((url) => ({ url }))}
            caption="Configured news feeds (read-only)."
          />
        ) : (
          <p className="set__fieldhelp">No feeds configured.</p>
        )}
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="News feeds"
        size="lg"
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={runTest} loading={testing}>Test feeds</Button>
            <Button variant="primary" onClick={save} loading={saving}>Save feeds</Button>
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
  const [adding, setAdding] = useState(false); // §14dr-8 async-action guard

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
    if (adding) return; // §14dr-8 re-click guard
    setAddError(null);
    setAdding(true);
    try {
      const r = await putRoutingCell({ asset_class: draftClass, listing_country: draftMarket, provider: draftProvider });
      if (!r.ok) { setAddError(r.error); return; } // honest edit-time 400, rendered verbatim (§9-3)
      toast.show({
        message: r.cell.degraded && r.cell.caveat
          ? `Rule added — ${r.cell.caveat}.` // accept-with-caveat (§9-7): stored, shown degraded
          : `Rule added — ${labelFor("asset_class", r.cell.asset_class)} · ${marketLabel(r.cell.listing_country)} → ${r.cell.provider}.`,
      });
      setDraftClass(""); setDraftProvider(""); setDraftMarket("*");
      reload();
    } finally {
      setAdding(false);
    }
  }, [adding, draftClass, draftMarket, draftProvider, toast, labelFor, reload]);

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
        {/* R-63 Phase 4 (§9-1): recut so the shipped promise is now TRUE in EXECUTION, not just in
            the decision of which provider is named — the priority chain is walked at fetch time
            (pin-head-keep-net), free-first, and Pricing Health shows which lane actually priced each
            holding. PROPOSED copy — ratified at the 0a look. */}
        <p className="set__fieldhelp">
          One provider per asset-class × market — the pinned head for that cell. LedgerFrame tries it
          first, then walks the free-first chain to the next lane that can actually price the
          instrument, so a rule pins the head without removing the fallback net. Pricing Health names
          the lane that priced each holding.
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
          <Button icon={Plus} variant="primary" onClick={onAdd} disabled={!canAdd} loading={adding}>Add rule</Button>
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

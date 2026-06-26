import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { Card } from "../components/ui";
import { useApp } from "../store/app";

export default function Settings() {
  const { status, reducedMotion, highContrast, toggleReducedMotion, toggleHighContrast, setLocked, refreshStatus } = useApp();
  const settings = useApi(api.settings, 0);
  const aiStatus = useApi(api.aiStatus, 0);
  const adminAvail = useApi(api.adminAvailable, 0);
  const feeds = useApi(api.feeds, 0);
  const ds = useApi(api.dataSource, 0);

  const [provider, setProvider] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [feedTest, setFeedTest] = useState<{ url: string; ok: boolean; count: number; error: string | null }[] | null>(null);

  const [baseCcy, setBaseCcy] = useState("");
  const [rotation, setRotation] = useState("30");
  const [refresh, setRefresh] = useState("60");
  const [sleepMin, setSleepMin] = useState("0");
  const [pin, setPin] = useState("");
  const [feedText, setFeedText] = useState("");
  const [msg, setMsg] = useState("");
  const [adminOut, setAdminOut] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (settings.data) {
      const s = settings.data.stored, d = settings.data.defaults as Record<string, unknown>;
      setBaseCcy(s.base_currency ?? String(d.base_currency ?? "SGD"));
      setRotation(s.rotation_seconds ?? String(d.rotation_seconds ?? 30));
      setRefresh(s.refresh_interval_seconds ?? "60");
      setSleepMin(s.display_sleep_minutes ?? "0");
    }
  }, [settings.data]);
  useEffect(() => { if (feeds.data) setFeedText(feeds.data.feeds.join("\n")); }, [feeds.data]);
  useEffect(() => { if (ds.data) setProvider(ds.data.provider); }, [ds.data]);

  async function saveDataSource() {
    try {
      const r = await api.setDataSource({ provider, api_key: apiKey || undefined });
      setMsg(r.note); setApiKey(""); ds.refetch(); refreshStatus();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Save failed (locked?)"); }
  }

  const ccys = (settings.data?.defaults.supported_currencies as string[]) ?? ["SGD", "USD", "INR", "EUR", "GBP"];
  const adminOn = adminAvail.data?.available ?? false;

  async function saveConfig() {
    try {
      await api.updateSettings({
        base_currency: baseCcy, rotation_seconds: rotation,
        refresh_interval_seconds: refresh, display_sleep_minutes: sleepMin,
      });
      setMsg("Saved. Some changes (currency) apply after a service restart.");
      refreshStatus();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Save failed (locked? set a PIN)"); }
  }
  async function saveFeeds() {
    try { await api.setFeeds(feedText.split("\n").map((s) => s.trim()).filter(Boolean)); setMsg("News feeds saved."); feeds.refetch(); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Save failed"); }
  }
  async function admin(action: string, arg?: string) {
    setBusy(`${action} ${arg ?? ""}`); setAdminOut("");
    try { const r = await api.admin(action, arg); setAdminOut(r.output || (r.ok ? "done" : "failed")); refreshStatus(); }
    catch (e) { setAdminOut(e instanceof Error ? e.message : "failed"); }
    finally { setBusy(""); }
  }
  async function setNewPin() {
    try { await api.setPin(pin); setMsg("PIN set."); setPin(""); refreshStatus(); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Could not set PIN"); }
  }

  return (
    <div className="grid grid-cols-12 gap-4 auto-rows-min">
      {/* General */}
      <Card title="General" className="col-span-12 lg:col-span-6">
        <label className="block text-sm text-muted mb-1">Base currency</label>
        <select className="lf-input mb-3" value={baseCcy} onChange={(e) => setBaseCcy(e.target.value)}>
          {ccys.map((c) => <option key={c}>{c}</option>)}
        </select>
        <div className="grid grid-cols-3 gap-3">
          <Num label="Rotation (s)" v={rotation} set={setRotation} min={10} max={300} />
          <Num label="Refresh (s)" v={refresh} set={setRefresh} min={15} max={3600} />
          <Num label="Screen sleep (min, 0=off)" v={sleepMin} set={setSleepMin} min={0} max={180} />
        </div>
        <button className="lf-btn-accent mt-3" onClick={saveConfig}>Save</button>
      </Card>

      {/* Data source (mock <-> live) */}
      <Card title="Data source (demo ↔ live prices)" className="col-span-12 lg:col-span-6">
        <label className="block text-sm text-muted mb-1">Market data provider</label>
        <select className="lf-input mb-3" value={provider} onChange={(e) => setProvider(e.target.value)}>
          {(ds.data?.providers ?? ["mock"]).map((p) => (
            <option key={p} value={p}>
              {p === "mock" ? "mock — demo / synthetic (no key)" : p === "csv" ? "csv — local files" : `${p} — live (needs API key)`}
            </option>
          ))}
        </select>
        {provider !== "mock" && provider !== "csv" && (
          <>
            <label className="block text-sm text-muted mb-1">API key {ds.data?.has_api_key && <span className="text-up">(saved)</span>}</label>
            <input className="lf-input mb-3" type="password" placeholder={ds.data?.has_api_key ? "•••••• (leave blank to keep)" : "paste key"} value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
          </>
        )}
        <button className="lf-btn-accent" onClick={saveDataSource}>Save & apply</button>
        <p className="text-xs text-faint mt-2">Switching providers restarts the API. See docs/DATA_SOURCES.md for keys & limits.</p>
      </Card>

      {/* Accessibility */}
      <Card title="Accessibility & display" className="col-span-12 lg:col-span-6">
        <Toggle label="Reduced motion" on={reducedMotion} onClick={toggleReducedMotion} />
        <Toggle label="High contrast" on={highContrast} onClick={toggleHighContrast} />
        <p className="text-xs text-faint mt-2">Stored on this device.</p>
      </Card>

      {/* Network / Voice / AI system toggles */}
      <Card title="System controls" className="col-span-12 lg:col-span-6">
        {!adminOn && <p className="text-xs text-warn mb-2">In-app controls unavailable — run the installer to enable, or use the CLI.</p>}
        <Row k="LAN access" v={status?.allow_lan ? "ON" : "off"} />
        <div className="flex gap-2 mb-3">
          <button className="lf-btn" disabled={!adminOn || !!busy} onClick={() => admin("lan", "on")}>Enable LAN</button>
          <button className="lf-btn" disabled={!adminOn || !!busy} onClick={() => admin("lan", "off")}>Disable LAN</button>
        </div>
        <Row k="Voice" v={status?.voice_enabled ? "ON" : "off"} />
        <div className="flex gap-2 mb-3">
          <button className="lf-btn" disabled={!adminOn || !!busy} onClick={() => admin("voice", "on")}>Enable voice</button>
          <button className="lf-btn" disabled={!adminOn || !!busy} onClick={() => admin("voice", "off")}>Disable voice</button>
        </div>
        <Row k="AI" v={status?.ai_enabled ? "ON" : "off"} />
        <div className="flex gap-2">
          <button className="lf-btn" disabled={!adminOn || !!busy} onClick={() => admin("ai", "on")}>Enable AI</button>
          <button className="lf-btn" disabled={!adminOn || !!busy} onClick={() => admin("ai", "off")}>Disable AI</button>
        </div>
        <p className="text-xs text-warn mt-3">Enabling LAN exposes the app to your network — set a PIN first.</p>
      </Card>

      {/* Maintenance */}
      <Card title="Service & maintenance" className="col-span-12 lg:col-span-6">
        <div className="flex flex-wrap gap-2">
          <button className="lf-btn" disabled={!adminOn || !!busy} onClick={() => admin("restart")}>Restart services</button>
          <button className="lf-btn" disabled={!adminOn || !!busy} onClick={() => admin("status")}>Service status</button>
          <button className="lf-btn" disabled={!adminOn || !!busy} onClick={() => admin("doctor")}>Run diagnostics</button>
          <button className="lf-btn" disabled={!!busy} onClick={async () => {
            setBusy("backup"); try { const r = await fetch("/api/v1/backup/create", { method: "POST", credentials: "same-origin" }); const j = await r.json(); setAdminOut(r.ok ? `Backup: ${j.filename}` : (j.detail || "failed")); } catch { setAdminOut("backup failed"); } finally { setBusy(""); }
          }}>Create backup</button>
        </div>
        {busy && <p className="text-xs text-muted mt-2">Running {busy}…</p>}
        {adminOut && <pre className="text-xs bg-base rounded-card p-3 mt-3 overflow-auto max-h-48 whitespace-pre-wrap">{adminOut}</pre>}
        <p className="text-xs text-faint mt-2">Updates & installs (Hailo, packages) stay on the command line for safety: <code>./scripts/update.sh</code>.</p>
      </Card>

      {/* News feeds */}
      <Card title="News feeds (free RSS)" className="col-span-12 lg:col-span-6">
        <p className="text-xs text-muted mb-2">One feed URL per line. No API key needed. Leave blank to disable RSS.</p>
        <textarea className="lf-input font-mono text-xs h-32" value={feedText} onChange={(e) => setFeedText(e.target.value)} spellCheck={false} />
        <div className="flex gap-2 mt-2">
          <button className="lf-btn-accent" onClick={saveFeeds}>Save feeds</button>
          <button className="lf-btn" onClick={() => setFeedText((feeds.data?.defaults ?? []).join("\n"))}>Reset to defaults</button>
          <button className="lf-btn" onClick={async () => { setFeedTest(null); setMsg("Testing feeds…"); try { const r = await api.feedsTest(); setFeedTest(r.results); setMsg(""); } catch (e) { setMsg(String(e)); } }}>Test feeds</button>
        </div>
        {feedTest && (
          <ul className="mt-3 space-y-1 text-xs">
            {feedTest.map((t, i) => (
              <li key={i} className="flex justify-between gap-2 border-b border-line/40 py-1">
                <span className="truncate text-muted">{t.url}</span>
                <span className={t.ok ? "text-up whitespace-nowrap" : "text-down whitespace-nowrap"}>
                  {t.ok ? `✓ ${t.count} items` : `✗ ${t.error ?? "failed"}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Security */}
      <Card title="Security" className="col-span-12 lg:col-span-6">
        <p className="text-sm text-muted mb-2">PIN is {status?.pin_set ? "set" : "not set"}.</p>
        <div className="flex gap-2">
          <input type="password" inputMode="numeric" placeholder="New PIN (min 4)" className="lf-input tnum" value={pin} onChange={(e) => setPin(e.target.value)} />
          <button className="lf-btn" onClick={setNewPin}>Set PIN</button>
        </div>
        {status?.pin_set && <button className="lf-btn mt-3" onClick={() => { api.lock(); setLocked(true); }}>Lock now</button>}
      </Card>

      {/* Diagnostics */}
      <Card title="Status & data sources" className="col-span-12 lg:col-span-6">
        <Row k="Version" v={status?.version ?? "—"} />
        <Row k="Market provider" v={status?.market_provider ?? "—"} />
        <Row k="Demo mode" v={status?.demo_mode ? "yes" : "no"} />
        <Row k="AI provider" v={aiStatus.data?.provider ?? "—"} />
        <Row k="AI available" v={aiStatus.data?.available ? "yes" : "no"} />
        <Row k="Data dir writable" v={status?.data_writable ? "yes" : "no"} />
        <p className="text-xs text-faint mt-2">For live market prices and paid providers, set keys in <code>.env</code> — see docs/DATA_SOURCES.md.</p>
      </Card>

      {msg && <div className="col-span-12 lf-chip bg-accent/15 text-accent">{msg}</div>}
    </div>
  );
}

function Num({ label, v, set, min, max }: { label: string; v: string; set: (s: string) => void; min: number; max: number }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-faint">{label}</span>
      <input type="number" min={min} max={max} className="lf-input tnum mt-1" value={v} onChange={(e) => set(e.target.value)} />
    </label>
  );
}
function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button className="flex items-center justify-between w-full py-2 touch" onClick={onClick}>
      <span>{label}</span>
      <span className={`w-12 h-7 rounded-full p-1 transition-colors ${on ? "bg-accent" : "bg-line"}`}>
        <span className={`block w-5 h-5 rounded-full bg-base transition-transform ${on ? "translate-x-5" : ""}`} />
      </span>
    </button>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between py-1 text-sm border-b border-line/50">
      <span className="text-muted">{k}</span>
      <span className="text-ink text-right">{v}</span>
    </div>
  );
}

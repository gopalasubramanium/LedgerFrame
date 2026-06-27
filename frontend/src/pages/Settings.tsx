import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { Card } from "../components/ui";
import { AiConfigCard } from "../components/AiConfigCard";
import { useApp } from "../store/app";
import { useActivity } from "../components/Activity";

export default function Settings() {
  const { status, reducedMotion, highContrast, toggleReducedMotion, toggleHighContrast, setLocked, refreshStatus, theme, setTheme } = useApp();
  const { run, running } = useActivity();
  const settings = useApi(api.settings, 0);
  const aiStatus = useApi(api.aiStatus, 0);
  const adminAvail = useApi(api.adminAvailable, 0);
  const feeds = useApi(api.feeds, 0);
  const ds = useApi(api.dataSource, 0);
  const cfg = useApi(api.config, 0);

  const [conf, setConf] = useState<Record<string, string>>({});
  const setC = (k: string, v: string) => setConf((p) => ({ ...p, [k]: v }));
  const [provider, setProvider] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [feedTest, setFeedTest] = useState<{ url: string; ok: boolean; count: number; error: string | null }[] | null>(null);
  const [refreshResult, setRefreshResult] = useState<{ refreshed: number; total: number; succeeded: string[]; failed: { symbol: string; reason: string }[] } | null>(null);

  const [baseCcy, setBaseCcy] = useState("");
  const [rotation, setRotation] = useState("30");
  const [refresh, setRefresh] = useState("60");
  const [sleepMin, setSleepMin] = useState("0");
  const [pin, setPin] = useState("");
  const [feedText, setFeedText] = useState("");
  const [msg, setMsg] = useState("");
  const [adminOut, setAdminOut] = useState("");
  const busy = running > 0;  // a system action is in flight (see Activity)

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
  useEffect(() => { if (cfg.data) setConf(cfg.data); }, [cfg.data]);

  async function saveConf(keys: string[]) {
    await run(`save:${keys.join(",")}`, async () => {
      const values = Object.fromEntries(keys.map((k) => [k, conf[k] ?? ""]));
      const r = await api.setConfig(values);
      setMsg(r.note); cfg.refetch(); refreshStatus();
      return r;
    }, { pending: "Saving", success: (r) => r.note || "Saved", error: (e) => e instanceof Error ? e.message : "Save failed (locked?)" });
  }

  async function saveDataSource() {
    await run("save:datasource", async () => {
      const r = await api.setDataSource({ provider, api_key: apiKey || undefined });
      setMsg(r.note); setApiKey(""); ds.refetch(); refreshStatus();
      return r;
    }, { pending: "Applying data source", success: (r) => r.note || "Applied", error: (e) => e instanceof Error ? e.message : "Save failed (locked?)" });
  }

  const ccys = (settings.data?.defaults.supported_currencies as string[]) ?? ["SGD", "USD", "INR", "EUR", "GBP"];
  const adminOn = adminAvail.data?.available ?? false;

  async function saveConfig() {
    const ccyChanged = baseCcy !== (settings.data?.defaults.base_currency as string | undefined);
    await run("save:display", async () => {
      await api.updateSettings({
        base_currency: baseCcy, rotation_seconds: rotation,
        refresh_interval_seconds: refresh, display_sleep_minutes: sleepMin,
      });
      setMsg("Saved.");
      refreshStatus();
      // Base currency re-reports the whole app — reload so every page picks it up.
      if (ccyChanged) setTimeout(() => window.location.reload(), 700);
    }, { pending: "Saving display", success: ccyChanged ? `Base currency → ${baseCcy}; reloading…` : "Display saved", error: (e) => e instanceof Error ? e.message : "Save failed (locked? set a PIN)" });
  }
  async function saveFeeds() {
    await run("save:feeds", async () => {
      await api.setFeeds(feedText.split("\n").map((s) => s.trim()).filter(Boolean)); setMsg("News feeds saved."); feeds.refetch();
    }, { pending: "Saving feeds", success: "News feeds saved", error: (e) => e instanceof Error ? e.message : "Save failed" });
  }
  async function admin(action: string, arg?: string) {
    const label = `${action}${arg ? " " + arg : ""}`;
    await run(`admin:${label}`, async () => {
      const r = await api.admin(action, arg);
      setAdminOut(r.output || (r.ok ? "done" : "failed"));
      refreshStatus();
      if (!r.ok) throw new Error(r.output || "failed");
      return r;
    }, { pending: label, success: `${label} ✓`, error: (e) => `${label}: ${e instanceof Error ? e.message : "failed"}` });
  }

  // Trigger + watch a one-click update. Polls the update-status endpoint so it
  // shows live progress, reloads when the new version is live, and surfaces
  // failures instead of hanging silently.
  async function checkAndUpdate() {
    await run("update", async () => {
      const v = await api.versionCheck();
      if (!v.update_available) { setAdminOut(`Up to date (v${v.current}).`); return "Up to date"; }
      if (!adminOn) { setAdminOut(`Update available: v${v.latest}. Run ./scripts/update.sh on the device.`); return undefined; }
      const r = await api.admin("update");
      if (!r.ok) { setAdminOut(`Update could not start: ${r.output || "use the CLI"}`); throw new Error(r.output || "could not start update"); }
      setAdminOut(`Updating v${v.current} → v${v.latest} in the background…`);
      await new Promise<void>((resolve, reject) => {
        let tries = 0;
        const iv = setInterval(async () => {
          tries += 1;
          try {
            const s = await api.updateStatus();
            if (s.log_tail) setAdminOut(s.log_tail);
            if (s.failed) { clearInterval(iv); reject(new Error(s.status || "update failed")); return; }
            if (s.version === v.latest && !s.running) { clearInterval(iv); resolve(); window.location.reload(); return; }
          } catch { /* API restarting — keep waiting */ }
          if (tries > 150) { clearInterval(iv); reject(new Error("update timed out — check Settings log or run ./scripts/update.sh")); }
        }, 4000);
      });
      return `Updated to v${v.latest}`;
    }, { pending: "Updating", success: "Update complete — reloading", error: (e) => e instanceof Error ? e.message : "update failed" });
  }
  async function setNewPin() {
    await run("save:pin", async () => {
      await api.setPin(pin); setMsg("PIN set."); setPin(""); refreshStatus();
    }, { pending: "Setting PIN", success: "PIN set", error: (e) => e instanceof Error ? e.message : "Could not set PIN" });
  }

  return (
    <div className="grid grid-cols-12 gap-4 auto-rows-min">
      {/* General */}
      <Card title="General" className="col-span-12 lg:col-span-6">
        <label className="block text-sm text-muted mb-1">Base currency</label>
        <select className="lf-input mb-3" value={baseCcy} onChange={(e) => setBaseCcy(e.target.value)}>
          {ccys.map((c) => <option key={c}>{c}</option>)}
        </select>
        <label className="block text-sm text-muted mb-1">Timezone</label>
        <input className="lf-input mb-3" value={conf.timezone ?? ""} onChange={(e) => setC("timezone", e.target.value)} placeholder="Asia/Singapore" />
        <div className="grid grid-cols-3 gap-3">
          <Num label="Rotation (s)" v={rotation} set={setRotation} min={10} max={300} />
          <Num label="Refresh (s)" v={refresh} set={setRefresh} min={15} max={3600} />
          <Num label="Screen sleep (min, 0=off)" v={sleepMin} set={setSleepMin} min={0} max={180} />
          <Num label="Stale after (s)" v={conf.stale_after_seconds ?? "900"} set={(v) => setC("stale_after_seconds", v)} min={30} max={86400} />
        </div>
        <div className="flex gap-2 mt-3">
          <button className="lf-btn-accent" onClick={saveConfig}>Save display</button>
          <button className="lf-btn" onClick={() => saveConf(["timezone", "stale_after_seconds"])}>Save timezone & staleness</button>
        </div>
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
        <p className="text-xs text-faint mt-2">Applies immediately (no restart). See docs/DATA_SOURCES.md for keys & limits.</p>

        <div className="border-t border-line mt-4 pt-3 space-y-2">
          <div className="text-xs uppercase tracking-wide text-faint">Data</div>
          <div className="flex flex-wrap gap-2">
            <button className="lf-btn" onClick={() => run("refresh", async () => {
              setRefreshResult(null);
              const r = await api.refreshData(); setRefreshResult(r);
              return r;
            }, { pending: "Refreshing live prices", success: (r) => `Refreshed ${r.refreshed}/${r.total}${r.failed.length ? ` · ${r.failed.length} unavailable` : ""}`, error: "Refresh failed" })}>Refresh live prices</button>
            <button className="lf-btn" onClick={() => run("history", async () => {
              const r = await api.fetchHistory();
              return r;
            }, { pending: "Fetching & caching history", success: (r) => `History cached for ${r.with_history.length}/${r.total}${r.no_history.length ? ` · ${r.no_history.length} unavailable` : ""}`, error: "History fetch failed" })}>Fetch &amp; cache history</button>
            <button className="lf-btn border-down/50 text-down" onClick={() => {
              if (!confirm("Delete ALL demo & portfolio data (holdings, transactions, watchlists, prices)? Your settings and PIN are kept. This cannot be undone.")) return;
              run("reset", async () => { const r = await api.resetData(); ds.refetch(); refreshStatus(); return r; },
                { pending: "Clearing data", success: (r) => r.note || "Data cleared", error: "Reset failed" });
            }}>Clear demo / all data</button>
          </div>
          <p className="text-xs text-faint">Clear, then set a live provider above and add your own holdings (Holdings page). Demo data won't come back.</p>

          {refreshResult && (
            <div className="text-xs mt-1 space-y-1">
              <div className="text-up">✓ Updated ({refreshResult.refreshed}): {refreshResult.succeeded.join(", ") || "—"}</div>
              {refreshResult.failed.length > 0 && (
                <div>
                  <div className="text-down">✗ No data ({refreshResult.failed.length}):</div>
                  <ul className="ml-3">
                    {refreshResult.failed.map((f) => (
                      <li key={f.symbol} className="text-muted"><span className="text-ink">{f.symbol}</span> — {f.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Appearance */}
      <Card title="Appearance & accessibility" className="col-span-12 lg:col-span-6">
        <div className="text-sm text-muted mb-1">Theme</div>
        <div className="flex gap-2 mb-3">
          {(["light", "dark", "system"] as const).map((t) => (
            <button key={t}
              className={`touch flex-1 rounded-card px-3 text-sm capitalize ${theme === t ? "bg-accent text-accent-fg" : "bg-elevated text-muted hover:text-ink"}`}
              onClick={() => setTheme(t)}>
              {t}
            </button>
          ))}
        </div>
        <Toggle label="Reduced motion" on={reducedMotion} onClick={toggleReducedMotion} />
        <Toggle label="High contrast" on={highContrast} onClick={toggleHighContrast} />
        <p className="text-xs text-faint mt-2">Stored on this device.</p>
      </Card>

      {/* Network / Voice / AI system toggles */}
      <Card title="System controls" className="col-span-12 lg:col-span-6">
        {!adminOn && <p className="text-xs text-warn mb-2">In-app controls unavailable — run the installer to enable, or use the CLI.</p>}
        <Row k="LAN access" v={status?.allow_lan ? "ON" : "off"} />
        <div className="flex gap-2 mb-3">
          <button className="lf-btn" disabled={!adminOn || busy} onClick={() => admin("lan", "on")}>Enable LAN</button>
          <button className="lf-btn" disabled={!adminOn || busy} onClick={() => admin("lan", "off")}>Disable LAN</button>
        </div>
        <Row k="Voice" v={status?.voice_enabled ? "ON" : "off"} />
        <div className="flex gap-2 mb-3">
          <button className="lf-btn" disabled={!adminOn || busy} onClick={() => admin("voice", "on")}>Enable voice</button>
          <button className="lf-btn" disabled={!adminOn || busy} onClick={() => admin("voice", "off")}>Disable voice</button>
        </div>
        <Row k="AI" v={status?.ai_enabled ? "ON" : "off"} />
        <div className="flex gap-2 mb-3">
          <button className="lf-btn" disabled={!adminOn || busy} onClick={() => admin("ai", "on")}>Enable AI</button>
          <button className="lf-btn" disabled={!adminOn || busy} onClick={() => admin("ai", "off")}>Disable AI</button>
        </div>
        <Row k="Kiosk (full-screen)" v="" />
        <div className="flex gap-2">
          <button className="lf-btn" disabled={!adminOn || busy} onClick={() => admin("kiosk", "on")}>Enable kiosk</button>
          <button className="lf-btn" disabled={!adminOn || busy} onClick={() => admin("kiosk", "off")}>Disable kiosk</button>
        </div>
        <p className="text-xs text-warn mt-3">Enabling LAN exposes the app to your network — set a PIN first.</p>
      </Card>

      {/* Maintenance */}
      <Card title="Service & maintenance" className="col-span-12 lg:col-span-6">
        <div className="flex flex-wrap gap-2">
          <button className="lf-btn" disabled={!adminOn || busy} onClick={() => admin("restart")}>Restart services</button>
          <button className="lf-btn" disabled={!adminOn || busy} onClick={() => admin("status")}>Service status</button>
          <button className="lf-btn" disabled={!adminOn || busy} onClick={() => admin("doctor")}>Run diagnostics</button>
          <button className="lf-btn" onClick={() => run("backup", async () => {
            const r = await fetch("/api/v1/backup/create", { method: "POST", credentials: "same-origin" });
            const j = await r.json(); setAdminOut(r.ok ? `Backup: ${j.filename}` : (j.detail || "failed"));
            if (!r.ok) throw new Error(j.detail || "backup failed");
            return j;
          }, { pending: "Creating backup", success: (j) => `Backup: ${j.filename}`, error: "Backup failed" })}>Create backup</button>
          <button className="lf-btn" onClick={checkAndUpdate}>Check &amp; update</button>
        </div>
        {busy && <p className="text-xs text-muted mt-2">A system action is running…</p>}
        {adminOut && <pre className="text-xs bg-base rounded-card p-3 mt-3 overflow-auto max-h-48 whitespace-pre-wrap">{adminOut}</pre>}
        <p className="text-xs text-faint mt-2">Package/Hailo installation stays on the command line for safety.</p>
      </Card>

      {/* News feeds */}
      <AiConfigCard className="col-span-12 lg:col-span-6" onSaved={setMsg} />

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
        <div className="mt-3 flex items-end gap-2">
          <Num label="Auto-lock after (min, 0=off)" v={conf.autolock_minutes ?? "15"} set={(v) => setC("autolock_minutes", v)} min={0} max={1440} />
          <button className="lf-btn" onClick={() => saveConf(["autolock_minutes"])}>Save</button>
        </div>
        {status?.pin_set && <button className="lf-btn mt-3" onClick={() => { api.lock(); setLocked(true); }}>Lock now</button>}
      </Card>

      {/* Advanced */}
      <Card title="Advanced" className="col-span-12 lg:col-span-6">
        <div className="grid grid-cols-2 gap-3 mb-1">
          <Num label="Web port" v={conf.api_port ?? "8321"} set={(v) => setC("api_port", v)} min={1} max={65535} />
          <Num label="Backups to keep" v={conf.backup_keep ?? "14"} set={(v) => setC("backup_keep", v)} min={1} max={365} />
        </div>
        <label className="block text-sm text-muted mt-2 mb-1">Data folder</label>
        <input className="lf-input mb-1" value={conf.data_dir ?? ""} onChange={(e) => setC("data_dir", e.target.value)} placeholder="/mnt/ledgerframe-data" />
        <p className="text-xs text-warn mb-2">⚠ Port & data-folder changes need a service restart. The data folder is NOT moved automatically — move it first, then restart.</p>
        <label className="block text-sm text-muted mb-1">Backup age recipient (optional)</label>
        <input className="lf-input" value={conf.backup_age_recipient ?? ""} onChange={(e) => setC("backup_age_recipient", e.target.value)} placeholder="age1…" />
        <button className="lf-btn-accent mt-3" onClick={() => saveConf(["api_port", "data_dir", "backup_keep", "backup_age_recipient"])}>Save advanced</button>
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

      {msg && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm">
          <div className="lf-card bg-elevated border-accent text-ink shadow-card flex items-start gap-3 px-4 py-3">
            <span className="text-accent">●</span>
            <span className="flex-1 text-sm">{msg}</span>
            <button className="text-faint hover:text-ink" onClick={() => setMsg("")} aria-label="Dismiss">✕</button>
          </div>
        </div>
      )}
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

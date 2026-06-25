import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { Card } from "../components/ui";
import { useApp } from "../store/app";

export default function Settings() {
  const { status, reducedMotion, highContrast, toggleReducedMotion, toggleHighContrast, setLocked, refreshStatus } = useApp();
  const settings = useApi(api.settings, 0);
  const aiStatus = useApi(api.aiStatus, 0);
  const [baseCcy, setBaseCcy] = useState("");
  const [rotation, setRotation] = useState("30");
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (settings.data) {
      setBaseCcy(settings.data.stored.base_currency ?? String(settings.data.defaults.base_currency ?? "SGD"));
      setRotation(settings.data.stored.rotation_seconds ?? String(settings.data.defaults.rotation_seconds ?? 30));
    }
  }, [settings.data]);

  async function save() {
    try {
      await api.updateSettings({ base_currency: baseCcy, rotation_seconds: rotation });
      setMsg("Saved. Restart services to apply currency changes.");
      refreshStatus();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed (PIN locked?)");
    }
  }

  async function setNewPin() {
    try {
      await api.setPin(pin);
      setMsg("PIN set.");
      setPin("");
      refreshStatus();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not set PIN");
    }
  }

  const ccys = (settings.data?.defaults.supported_currencies as string[]) ?? ["SGD", "USD", "INR", "EUR", "GBP"];

  return (
    <div className="grid grid-cols-12 gap-4 auto-rows-min">
      <Card title="General" className="col-span-12 lg:col-span-6">
        <label className="block text-sm text-muted mb-1">Base currency</label>
        <select className="touch w-full rounded-card bg-base border border-line px-3 mb-4" value={baseCcy} onChange={(e) => setBaseCcy(e.target.value)}>
          {ccys.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="block text-sm text-muted mb-1">Rotation interval (seconds)</label>
        <input type="number" min={10} max={300} className="touch w-full rounded-card bg-base border border-line px-3 mb-4 tnum" value={rotation} onChange={(e) => setRotation(e.target.value)} />
        <button className="lf-btn-accent" onClick={save}>Save</button>
      </Card>

      <Card title="Accessibility" className="col-span-12 lg:col-span-6">
        <Toggle label="Reduced motion" on={reducedMotion} onClick={toggleReducedMotion} />
        <Toggle label="High contrast" on={highContrast} onClick={toggleHighContrast} />
        <p className="text-xs text-faint mt-2">These preferences are stored on this device.</p>
      </Card>

      <Card title="Security" className="col-span-12 lg:col-span-6">
        <p className="text-sm text-muted mb-2">PIN is {status?.pin_set ? "set" : "not set"}. {status?.allow_lan ? "LAN access enabled — PIN required." : "Local-only."}</p>
        <div className="flex gap-2">
          <input type="password" inputMode="numeric" placeholder="New PIN (min 4)" className="touch flex-1 rounded-card bg-base border border-line px-3 tnum" value={pin} onChange={(e) => setPin(e.target.value)} />
          <button className="lf-btn" onClick={setNewPin}>Set PIN</button>
        </div>
        {status?.pin_set && <button className="lf-btn mt-3" onClick={() => { api.lock(); setLocked(true); }}>Lock now</button>}
      </Card>

      <Card title="AI & data" className="col-span-12 lg:col-span-6">
        <Row k="AI provider" v={aiStatus.data?.provider ?? "—"} />
        <Row k="AI available" v={aiStatus.data?.available ? "Yes" : "No"} />
        <Row k="AI detail" v={aiStatus.data?.detail ?? "—"} />
        <Row k="Market provider" v={status?.market_provider ?? "—"} />
        <Row k="Demo mode" v={status?.demo_mode ? "Yes" : "No"} />
        <Row k="Voice" v={status?.voice_enabled ? "Enabled" : "Disabled"} />
      </Card>

      <Card title="Backup" className="col-span-12">
        <button className="lf-btn" onClick={async () => {
          try { const r = await fetch("/api/v1/backup/create", { method: "POST", credentials: "same-origin" }); const j = await r.json(); setMsg(r.ok ? `Backup created: ${j.filename}` : (j.detail || "Backup failed")); }
          catch { setMsg("Backup failed"); }
        }}>Create encrypted backup now</button>
        <p className="text-xs text-faint mt-2">Backups are written to the data directory and rotated automatically. Configure an age recipient in .env to encrypt.</p>
      </Card>

      {msg && <div className="col-span-12 lf-chip bg-accent/15 text-accent">{msg}</div>}
    </div>
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

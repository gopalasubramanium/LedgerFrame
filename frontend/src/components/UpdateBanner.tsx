import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useActivity } from "./Activity";

// Checks for a newer release on load and shows a snoozable banner. "Update now"
// runs the scoped admin update (if the helper is installed), then polls the
// update-status endpoint so it shows live progress, reloads when the new version
// is live, and surfaces failures instead of silently doing nothing. Snooze hides
// it for 24h.
export function UpdateBanner() {
  const [info, setInfo] = useState<{ latest: string; url: string } | null>(null);
  const [msg, setMsg] = useState("");
  const { run, isRunning } = useActivity();

  useEffect(() => {
    const snoozedUntil = Number(localStorage.getItem("lf_update_snooze") || 0);
    if (Date.now() < snoozedUntil) return;
    api.versionCheck()
      .then((v) => { if (v.update_available) setInfo({ latest: v.latest, url: v.url }); })
      .catch(() => {});
  }, []);

  if (!info) return null;

  function update() {
    run("update", async () => {
      const r = await api.admin("update");
      if (!r.ok) {
        setMsg(r.output?.includes("install.sh") ? "System controls aren't installed — re-run ./scripts/install.sh on the device." : "Update could not start (use the CLI: ./scripts/update.sh).");
        throw new Error(r.output || "could not start");
      }
      setMsg("Updating in the background… the page reloads automatically when done.");
      const fromVer = (await api.updateStatus().catch(() => null))?.version ?? "";
      await new Promise<void>((resolve, reject) => {
        let tries = 0;
        let sawRunning = false;
        const iv = setInterval(async () => {
          tries += 1;
          try {
            const s = await api.updateStatus();
            if (s.running) sawRunning = true;
            if (s.failed) { clearInterval(iv); setMsg("Update failed — see Settings → log, or run ./scripts/update.sh."); reject(new Error(s.status)); return; }
            // Done when the script reported success and the API is back — robust to
            // version-string differences and stale status from a prior run.
            const finished = !s.running && s.ok && (s.version !== fromVer || sawRunning);
            if (finished) { clearInterval(iv); resolve(); window.location.reload(); return; }
          } catch { /* API restarting — keep waiting */ }
          if (tries > 180) { clearInterval(iv); setMsg("Update is taking a while — refresh in a moment."); reject(new Error("timeout")); }
        }, 4000);
      });
      return true;
    }, { pending: "Updating", success: "Update complete — reloading", error: (e) => e instanceof Error ? e.message : "update failed" });
  }

  function snooze() {
    localStorage.setItem("lf_update_snooze", String(Date.now() + 24 * 3600 * 1000));
    setInfo(null);
  }

  const busy = isRunning("update");
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[92%]">
      <div className="lf-card bg-elevated border-accent shadow-card flex items-center gap-3 px-4 py-3">
        <span className="text-accent">⬆</span>
        <div className="flex-1 text-sm">
          <div>Update available: <b>v{info.latest}</b></div>
          {msg && <div className="text-xs text-faint mt-1">{msg}</div>}
        </div>
        <a className="lf-btn text-xs" href={info.url} target="_blank" rel="noreferrer">Notes</a>
        <button className="lf-btn-accent text-xs" disabled={busy} onClick={update}>{busy ? "Updating…" : "Update now"}</button>
        <button className="lf-btn text-xs" onClick={snooze}>Later</button>
      </div>
    </div>
  );
}

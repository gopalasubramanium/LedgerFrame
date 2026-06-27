import { useEffect, useState } from "react";
import { api } from "../lib/api";

// Checks for a newer release on load and shows a snoozable banner. "Update now"
// runs the scoped admin update action (if the helper is installed); otherwise it
// links to the release. Snooze hides it for 24h.
export function UpdateBanner() {
  const [info, setInfo] = useState<{ latest: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const snoozedUntil = Number(localStorage.getItem("lf_update_snooze") || 0);
    if (Date.now() < snoozedUntil) return;
    api.versionCheck()
      .then((v) => { if (v.update_available) setInfo({ latest: v.latest, url: v.url }); })
      .catch(() => {});
  }, []);

  if (!info) return null;

  // Poll the version endpoint until the running app reports it's up to date
  // (the build + restart can take a few minutes on a Pi); then reload. The API
  // is briefly unreachable while it restarts — those errors are expected.
  function pollUntilUpdated() {
    let tries = 0;
    const iv = setInterval(async () => {
      tries += 1;
      try {
        const v = await api.versionCheck();
        if (!v.update_available) { clearInterval(iv); window.location.reload(); return; }
      } catch { /* API restarting — keep waiting */ }
      if (tries > 120) { clearInterval(iv); setMsg("Update is taking a while — refresh the page in a moment."); }
    }, 5000);
  }

  async function update() {
    setBusy(true); setMsg("Starting update…");
    try {
      const r = await api.admin("update");
      if (r.ok) {
        setMsg("Updating in the background — this can take a few minutes. The page reloads automatically when it's done.");
        pollUntilUpdated();
      } else {
        setMsg("Update could not run (use the CLI: ./scripts/update.sh).");
        setBusy(false);
      }
    } catch {
      setMsg("Update needs the in-app helper. Run ./scripts/update.sh on the device.");
      setBusy(false);
    }
  }
  function snooze() {
    localStorage.setItem("lf_update_snooze", String(Date.now() + 24 * 3600 * 1000));
    setInfo(null);
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[92%]">
      <div className="lf-card bg-elevated border-accent shadow-card flex items-center gap-3 px-4 py-3">
        <span className="text-accent">⬆</span>
        <div className="flex-1 text-sm">
          <div>Update available: <b>v{info.latest}</b></div>
          {msg && <div className="text-xs text-faint mt-1">{msg}</div>}
        </div>
        <a className="lf-btn text-xs" href={info.url} target="_blank" rel="noreferrer">Notes</a>
        <button className="lf-btn-accent text-xs" disabled={busy} onClick={update}>Update now</button>
        <button className="lf-btn text-xs" onClick={snooze}>Later</button>
      </div>
    </div>
  );
}

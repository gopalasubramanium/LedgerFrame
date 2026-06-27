import { useEffect, useState } from "react";
import { Card } from "../components/ui";

// Terms, conditions, disclaimer & license. Acceptance is stored locally; the
// "agree" box defaults to ticked, and the date of acceptance is recorded.
export default function Legal() {
  const [agreed, setAgreed] = useState(localStorage.getItem("lf_legal_accepted") === "1");
  const [when, setWhen] = useState(localStorage.getItem("lf_legal_accepted_at") || "");

  useEffect(() => {
    // Default to ticked on first view.
    if (localStorage.getItem("lf_legal_accepted") === null) setAgreed(true);
  }, []);

  function save() {
    if (agreed) {
      const now = new Date().toISOString();
      localStorage.setItem("lf_legal_accepted", "1");
      localStorage.setItem("lf_legal_accepted_at", now);
      setWhen(now);
    } else {
      localStorage.setItem("lf_legal_accepted", "0");
      setWhen("");
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-xl font-semibold">Terms, disclaimer &amp; license</h1>

      <Card title="Important disclaimer">
        <ul className="list-disc pl-5 space-y-2 text-sm text-ink">
          <li><b>Not financial advice.</b> LedgerFrame is an information and tracking tool only.
            Nothing here is advice or a recommendation to buy, sell, or hold any asset.</li>
          <li><b>Not real-time and not guaranteed.</b> Market data may be delayed, cached, end-of-day,
            or unavailable, and may contain errors. Verify anything important with an authoritative source.</li>
          <li><b>Not a trading platform.</b> There is no order placement or brokerage integration.</li>
          <li><b>You are responsible</b> for your data, API keys, backups, and any decisions you make.</li>
          <li><b>AI answers</b> explain computed figures only; they can still be incomplete or wrong.
            Don't rely on them for decisions.</li>
        </ul>
      </Card>

      <Card title="Terms of use">
        <p className="text-sm text-muted">
          LedgerFrame is self-hosted, local-first software you run on your own hardware. You use it at
          your own risk. The software is provided “as is”, without warranty of any kind, express or
          implied, including merchantability, fitness for a particular purpose, and non-infringement.
          In no event shall the authors or copyright holders be liable for any claim, damages, or other
          liability arising from the software or its use. Market data and any third-party providers are
          subject to their own terms and licences — see <code>docs/DATA_SOURCES.md</code>.
        </p>
      </Card>

      <Card title="License">
        <p className="text-sm text-muted">
          Released under the <b>MIT License</b>. The full text is in the <code>LICENSE</code> file in the
          repository. You're free to use, modify, and distribute it under those terms.
        </p>
      </Card>

      <Card>
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="w-5 h-5 accent-accent" />
          <span className="text-sm">I have read and agree to the disclaimer, terms, and license.</span>
        </label>
        <div className="flex items-center gap-3 mt-3">
          <button className="lf-btn-accent" onClick={save}>Save</button>
          {when && <span className="text-xs text-faint">Accepted {new Date(when).toLocaleString()}</span>}
        </div>
      </Card>
    </div>
  );
}

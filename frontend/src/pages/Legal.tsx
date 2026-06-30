import { useEffect, useState } from "react";
import { Card } from "../components/ui";

const REPO = "https://github.com/gopalasubramanium/LedgerFrame";

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
    <div className="space-y-3 pb-4">
      <h1 className="text-lg font-semibold">Terms, disclaimer &amp; license</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        <Card title="Important disclaimer" className="text-sm">
          <ul className="list-disc pl-5 space-y-1 text-sm text-ink">
            <li><b>Not financial advice</b> — an information & tracking tool only; nothing here is a recommendation to buy, sell or hold.</li>
            <li><b>Not real-time / not guaranteed</b> — data may be delayed, cached, EOD or unavailable, and may contain errors. Verify anything important.</li>
            <li><b>Not a trading platform</b> — no order placement or brokerage integration.</li>
            <li><b>You are responsible</b> for your data, API keys, backups and decisions.</li>
            <li><b>AI answers</b> explain computed figures only; they can be incomplete or wrong — don't rely on them for decisions.</li>
          </ul>
        </Card>

        <div className="grid gap-3">
          <Card title="Terms of use" className="text-sm">
            <p className="text-xs text-muted leading-relaxed">
              Self-hosted, local-first software you run on your own hardware, used at your own risk. Provided
              “as is”, without warranty of any kind (incl. merchantability, fitness for purpose, non-infringement).
              The authors are not liable for any claim or damages arising from its use. Third-party market data is
              subject to its own terms — see <code>docs/DATA_SOURCES.md</code>.
            </p>
          </Card>
          <Card title="License" className="text-sm">
            <p className="text-xs text-muted leading-relaxed">
              Released under the <b>MIT License</b> (full text in <code>LICENSE</code>). Free to use, modify and
              distribute under those terms.
            </p>
          </Card>
        </div>
      </div>

      {/* Detailed legal documents on GitHub */}
      <Card title="Full terms, conditions, disclaimer & license (on GitHub)">
        <p className="text-sm text-muted mb-3">
          The complete, authoritative documents live in the public repository. They may be updated between releases.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <a className="lf-btn justify-center" href={`${REPO}#legal--disclaimers`} target="_blank" rel="noreferrer">Terms &amp; disclaimers →</a>
          <a className="lf-btn justify-center" href={`${REPO}/blob/main/LICENSE`} target="_blank" rel="noreferrer">MIT License (full text) →</a>
          <a className="lf-btn justify-center" href={`${REPO}/blob/main/docs/DATA_SOURCES.md`} target="_blank" rel="noreferrer">Data-provider terms →</a>
          <a className="lf-btn justify-center" href={`${REPO}/releases`} target="_blank" rel="noreferrer">Releases &amp; changelog →</a>
        </div>
      </Card>

      <Card className="py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="w-5 h-5 accent-accent" />
            <span className="text-sm">I have read and agree to the disclaimer, terms, and license.</span>
          </label>
          <div className="flex items-center gap-3">
            {when && <span className="text-xs text-faint">Accepted {new Date(when).toLocaleString()}</span>}
            <button className="lf-btn-accent" onClick={save}>Save</button>
          </div>
        </div>
      </Card>
    </div>
  );
}

import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { Card, ChangePill } from "../components/ui";
import { money } from "../lib/format";

// Global = the world's major market indices + cross-asset benchmarks, grouped by
// region. Click any to open its detail / drill into that market.
export default function GlobalAssets() {
  const { data } = useApi(api.marketsGlobal, 60000);
  const open = data?.market_status.state === "open";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Global markets</h1>
          <p className="text-sm text-muted">Tracked via liquid ETFs — % change mirrors the index; prices are the ETF (USD).</p>
        </div>
        <span className={`lf-chip ${open ? "bg-up/15 text-up" : "bg-elevated text-muted"}`}>{open ? "● US open" : "○ US closed"}</span>
      </div>

      <div className="grid grid-cols-12 gap-4 auto-rows-min">
        {data?.groups.map((g) => (
          <Card key={g.region} title={g.region} className="col-span-12 md:col-span-6 lg:col-span-4">
            <ul className="divide-y divide-line/50">
              {g.items.map((it) => (
                <li key={it.symbol} className="flex items-center justify-between py-2">
                  <Link to={`/instrument/${it.symbol}`} className="hover:text-accent">
                    <div className="text-sm">{it.label}</div>
                    <div className="text-xs text-faint">{it.symbol}</div>
                  </Link>
                  <div className="flex items-center gap-3">
                    <span className="tnum text-sm">{it.quote.price === null ? "—" : money(it.quote.price, it.quote.currency, true)}</span>
                    <ChangePill value={it.quote.change_pct} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ))}
        {data?.demo_mode && (
          <p className="col-span-12 text-xs text-accent">Showing DEMO data. Set a live provider in Settings for real index levels.</p>
        )}
      </div>
    </div>
  );
}

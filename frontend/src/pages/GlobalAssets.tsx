import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { Card, ChangePill } from "../components/ui";
import { money } from "../lib/format";
import type { Quote } from "../lib/types";

// Cross-asset overview grouped by asset class. Correlations are intentionally
// omitted: with demo/limited history they would be misleading, and correlation
// is not causation. Documented as a v1 limitation.
const GROUPS: { label: string; match: (q: Quote) => boolean }[] = [
  { label: "Equities & Indices", match: (q) => ["AAPL", "MSFT", "NVDA", "^GSPC", "^STI", "VOO"].includes(q.symbol) },
  { label: "Commodities", match: (q) => ["GLD"].includes(q.symbol) },
  { label: "Crypto", match: (q) => ["BTC", "ETH"].includes(q.symbol) },
];

export default function GlobalAssets() {
  const { data } = useApi(api.marketsOverview, 60000);
  const quotes = data?.quotes ?? [];

  return (
    <div className="grid grid-cols-12 gap-4 auto-rows-min">
      {GROUPS.map((g) => {
        const rows = quotes.filter(g.match);
        return (
          <Card key={g.label} title={g.label} className="col-span-12 lg:col-span-4">
            <ul className="space-y-2">
              {rows.map((q) => (
                <li key={q.symbol} className="flex items-center justify-between">
                  <span className="text-sm text-muted">{q.symbol}</span>
                  <span className="tnum">{q.price === null ? "—" : money(q.price, q.currency, true)}</span>
                  <ChangePill value={q.change_pct} />
                </li>
              ))}
              {rows.length === 0 && <li className="text-muted text-sm">No data.</li>}
            </ul>
          </Card>
        );
      })}
      <Card title="Coverage note" className="col-span-12">
        <p className="text-sm text-muted">
          Cross-asset correlations are shown only when sufficient historical data exists. They are
          omitted here for the demo dataset. {data?.demo_mode && <span className="text-accent">DEMO data.</span>}
        </p>
      </Card>
    </div>
  );
}

import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { Card, ChangePill } from "../components/ui";
import { money } from "../lib/format";

// Cross-asset overview grouped by the instrument's own asset class, so every
// held / watchlisted / default instrument appears under the right bucket.
// Correlations are intentionally omitted (limited history; correlation ≠ causation).
const GROUP_LABELS: Record<string, string> = {
  equity: "Equities", etf: "ETFs & Indices", mutual_fund: "Funds", bond: "Bonds",
  commodity: "Commodities", crypto: "Crypto", cash: "Cash", fixed_deposit: "Deposits",
  property: "Property", private: "Private", retirement: "Retirement", liability: "Liabilities",
  other: "Other",
};

export default function GlobalAssets() {
  const { data } = useApi(api.marketsOverview, 60000);
  const instruments = data?.instruments ?? [];

  const groups = new Map<string, typeof instruments>();
  for (const it of instruments) {
    const key = it.asset_class || "other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(it);
  }
  const orderedKeys = [...groups.keys()].sort((a, b) => (groups.get(b)!.length - groups.get(a)!.length));

  return (
    <div className="grid grid-cols-12 gap-4 auto-rows-min">
      {orderedKeys.map((key) => (
        <Card key={key} title={GROUP_LABELS[key] ?? key} className="col-span-12 lg:col-span-4">
          <ul className="space-y-2">
            {groups.get(key)!.map((it) => (
              <li key={it.symbol} className="flex items-center justify-between">
                <Link to={`/instrument/${it.symbol}`} className="text-sm text-muted hover:text-accent">
                  {it.symbol}{it.held && <span className="text-accent text-xs ml-1">●</span>}
                </Link>
                <span className="tnum">{it.quote.price === null ? "—" : money(it.quote.price, it.quote.currency, true)}</span>
                <ChangePill value={it.quote.change_pct} />
              </li>
            ))}
          </ul>
        </Card>
      ))}
      <Card title="Coverage note" className="col-span-12">
        <p className="text-sm text-muted">
          Grouped by asset class across your holdings, watchlist, and default instruments.
          Cross-asset correlations are shown only when sufficient history exists (omitted here).
          {data?.demo_mode && <span className="text-accent"> DEMO data.</span>}
        </p>
      </Card>
    </div>
  );
}

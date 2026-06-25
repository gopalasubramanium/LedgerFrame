import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { Card, ChangePill, DataBadge } from "../components/ui";
import { money } from "../lib/format";

export default function Markets() {
  const { data, stale } = useApi(api.marketsOverview, 60000);
  const wl = useApi(api.watchlists, 60000);

  return (
    <div className="grid grid-cols-12 gap-4 auto-rows-min">
      <Card title="Market overview" className="col-span-12 lg:col-span-7">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {data?.quotes.map((q) => (
            <Link key={q.symbol} to={`/instrument/${q.symbol}`} className="bg-base rounded-card p-3 border border-line hover:border-accent transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-muted text-sm">{q.symbol}</span>
                <DataBadge entitlement={q.entitlement} stale={q.is_stale} source={q.source} asOf={q.received_at} />
              </div>
              <div className="tnum text-lg mt-1">{q.price === null ? "—" : money(q.price, q.currency)}</div>
              <ChangePill value={q.change_pct} />
            </Link>
          ))}
        </div>
        {stale && <div className="mt-3"><DataBadge stale /></div>}
      </Card>

      <Card title="Watchlist" className="col-span-12 lg:col-span-5">
        {wl.data?.watchlists.map((list) => (
          <div key={list.id} className="mb-3">
            <div className="text-xs uppercase tracking-wide text-faint mb-2">{list.name}</div>
            <ul className="divide-y divide-line/50">
              {list.items.map((it) => (
                <li key={it.symbol} className="flex items-center justify-between py-2">
                  <Link to={`/instrument/${it.symbol}`} className="hover:text-accent">
                    <span className="text-sm">{it.symbol}</span>
                    <span className="text-faint text-xs ml-2">{it.name}</span>
                  </Link>
                  <div className="flex items-center gap-3">
                    <span className="tnum text-sm">{it.quote.price === null ? "—" : money(it.quote.price, it.quote.currency, true)}</span>
                    <ChangePill value={it.quote.change_pct} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Card>
    </div>
  );
}

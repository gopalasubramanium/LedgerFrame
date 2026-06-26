import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { Card, ChangePill, DataBadge } from "../components/ui";
import { money } from "../lib/format";

export default function Markets() {
  const { data, stale } = useApi(api.marketsOverview, 60000);
  const wl = useApi(api.watchlists, 60000);

  const instruments = data?.instruments ?? [];
  const held = instruments.filter((i) => i.held);
  const others = instruments.filter((i) => !i.held);

  return (
    <div className="grid grid-cols-12 gap-4 auto-rows-min">
      {held.length > 0 && (
        <Card title="Your holdings" className="col-span-12 lg:col-span-7">
          <Grid items={held} />
        </Card>
      )}

      <Card title="Market overview" className={`col-span-12 ${held.length > 0 ? "lg:col-span-5" : "lg:col-span-7"}`}>
        <Grid items={others} />
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

function Grid({ items }: { items: { symbol: string; name: string; held: boolean; quote: import("../lib/types").Quote }[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {items.map((it) => (
        <Link
          key={it.symbol}
          to={`/instrument/${it.symbol}`}
          className="bg-base rounded-card p-3 border border-line hover:border-accent transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-muted text-sm">{it.symbol}{it.held && <span className="text-accent text-xs ml-1">●</span>}</span>
            <DataBadge entitlement={it.quote.entitlement} stale={it.quote.is_stale} source={it.quote.source} asOf={it.quote.received_at} />
          </div>
          <div className="tnum text-lg mt-1">{it.quote.price === null ? "—" : money(it.quote.price, it.quote.currency)}</div>
          <ChangePill value={it.quote.change_pct} />
        </Link>
      ))}
      {items.length === 0 && <p className="text-muted text-sm col-span-full">Nothing to show.</p>}
    </div>
  );
}

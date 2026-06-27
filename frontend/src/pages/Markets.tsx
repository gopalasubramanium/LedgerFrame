import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { Card, ChangePill, DataBadge } from "../components/ui";
import { money } from "../lib/format";

type View = "holdings" | "watchlist" | "equity" | "etf" | "crypto" | "commodity" | "all";

const VIEWS: { id: View; label: string }[] = [
  { id: "holdings", label: "My holdings" },
  { id: "watchlist", label: "Watchlist" },
  { id: "equity", label: "Equities" },
  { id: "etf", label: "ETFs & Indices" },
  { id: "crypto", label: "Crypto" },
  { id: "commodity", label: "Commodities" },
  { id: "all", label: "All" },
];

// Markets = the markets/instruments YOU care about. Pick a view, or search any
// symbol and open its page. (Global page = the world's major indices.)
export default function Markets() {
  const { data, stale } = useApi(api.marketsOverview, 60000);
  const wl = useApi(api.watchlists, 60000);
  const [view, setView] = useState<View>("holdings");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ symbol: string; name: string }[]>([]);

  const instruments = data?.instruments ?? [];
  const watchSymbols = useMemo(
    () => new Set((wl.data?.watchlists ?? []).flatMap((l) => l.items.map((i) => i.symbol))),
    [wl.data],
  );

  const shown = useMemo(() => {
    if (view === "holdings") return instruments.filter((i) => i.held);
    if (view === "watchlist") return instruments.filter((i) => watchSymbols.has(i.symbol));
    if (view === "all") return instruments;
    return instruments.filter((i) => i.asset_class === view);
  }, [instruments, view, watchSymbols]);

  async function runSearch(q: string) {
    setQuery(q);
    if (q.trim().length < 1) { setResults([]); return; }
    try { setResults((await api.search(q)).results.slice(0, 8)); } catch { setResults([]); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">Markets</h1>
          <select className="lf-input w-auto" value={view} onChange={(e) => setView(e.target.value as View)}>
            {VIEWS.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </div>
        <div className="relative">
          <input className="lf-input w-64" placeholder="Search any symbol…" value={query} onChange={(e) => runSearch(e.target.value)} />
          {results.length > 0 && (
            <div className="absolute z-20 mt-1 w-full bg-elevated border border-line rounded-card shadow-card max-h-72 overflow-auto">
              {results.map((r) => (
                <Link key={r.symbol} to={`/instrument/${r.symbol}`} onClick={() => { setResults([]); setQuery(""); }}
                  className="block px-3 py-2 hover:bg-line text-sm">
                  <span className="text-ink">{r.symbol}</span> <span className="text-faint">{r.name}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <Card title={VIEWS.find((v) => v.id === view)?.label} action={stale ? <DataBadge stale /> : undefined}>
        {shown.length === 0 ? (
          <p className="text-muted text-sm py-6 text-center">
            Nothing here. {view === "holdings" ? "Add holdings on the Holdings page." : "Try another view or search above."}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {shown.map((it) => (
              <Link key={it.symbol} to={`/instrument/${it.symbol}`}
                className="bg-base rounded-card p-3 border border-line hover:border-accent transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-muted text-sm truncate">{it.symbol}{it.held && <span className="text-accent text-xs ml-1">●</span>}</span>
                  <DataBadge entitlement={it.quote.entitlement} stale={it.quote.is_stale} source={it.quote.source} asOf={it.quote.received_at} />
                </div>
                <div className="text-xs text-faint truncate">{it.name}</div>
                <div className="tnum text-lg mt-1">{it.quote.price === null ? "—" : money(it.quote.price, it.quote.currency)}</div>
                <ChangePill value={it.quote.change_pct} />
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

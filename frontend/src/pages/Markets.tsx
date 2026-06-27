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

  const [newWl, setNewWl] = useState("");
  const watchlists = wl.data?.watchlists ?? [];

  async function runSearch(q: string) {
    setQuery(q);
    if (q.trim().length < 1) { setResults([]); return; }
    try { setResults((await api.search(q)).results.slice(0, 8)); } catch { setResults([]); }
  }
  async function addToWatch(symbol: string, wlId = 0) {
    try { await api.addWatchItem(wlId, symbol); wl.refetch(); } catch { /* shows lock if 401 */ }
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
                <div key={r.symbol} className="flex items-center justify-between px-3 py-2 hover:bg-line text-sm">
                  <Link to={`/instrument/${r.symbol}`} onClick={() => { setResults([]); setQuery(""); }} className="truncate">
                    <span className="text-ink">{r.symbol}</span> <span className="text-faint">{r.name}</span>
                  </Link>
                  <button className="text-accent text-xs ml-2 shrink-0" title="Add to watchlist"
                    onClick={() => addToWatch(r.symbol)}>★ watch</button>
                </div>
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
              <div key={it.symbol} className="bg-base rounded-card p-3 border border-line hover:border-accent transition-colors relative">
                <button className="absolute top-2 right-2 text-faint hover:text-accent text-sm" title="Add to watchlist"
                  onClick={() => addToWatch(it.symbol)}>{watchSymbols.has(it.symbol) ? "★" : "☆"}</button>
                <Link to={`/instrument/${it.symbol}`} className="block">
                  <div className="text-muted text-sm truncate pr-6">{it.symbol}{it.held && <span className="text-accent text-xs ml-1">●</span>}</div>
                  <div className="text-xs text-faint truncate">{it.name}</div>
                  <div className="tnum text-lg mt-1">{it.quote.price === null ? "—" : money(it.quote.price, it.quote.currency)}</div>
                  <ChangePill value={it.quote.change_pct} />
                </Link>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Watchlist management */}
      <Card title="Watchlists">
        <div className="flex gap-2 mb-3">
          <input className="lf-input" placeholder="New watchlist name…" value={newWl} onChange={(e) => setNewWl(e.target.value)} />
          <button className="lf-btn-accent" onClick={async () => { if (newWl.trim()) { await api.createWatchlist(newWl.trim(), []); setNewWl(""); wl.refetch(); } }}>Create</button>
        </div>
        {watchlists.length === 0 && <p className="text-muted text-sm">No watchlists yet. Create one, then add symbols with ☆ above.</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {watchlists.map((list) => (
            <div key={list.id} className="border border-line/60 rounded-card p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{list.name}</span>
                <button className="text-down text-xs hover:underline" onClick={async () => { if (confirm(`Delete watchlist "${list.name}"?`)) { await api.deleteWatchlist(list.id); wl.refetch(); } }}>Delete</button>
              </div>
              {list.items.length === 0 && <p className="text-faint text-xs">Empty — add symbols with ☆.</p>}
              <ul className="space-y-1">
                {list.items.map((it) => (
                  <li key={it.symbol} className="flex items-center justify-between text-sm">
                    <Link to={`/instrument/${it.symbol}`} className="hover:text-accent">{it.symbol} <span className="text-faint text-xs">{it.name}</span></Link>
                    <div className="flex items-center gap-2">
                      <ChangePill value={it.quote.change_pct} />
                      <button className="text-faint hover:text-down" title="Remove" onClick={async () => { await api.removeWatchItem(list.id, it.symbol); wl.refetch(); }}>✕</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

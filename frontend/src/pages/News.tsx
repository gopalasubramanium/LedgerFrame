import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { Card } from "../components/ui";
import { Markdown } from "../components/Markdown";
import { useActivity } from "../components/Activity";
import { money, timeAgo } from "../lib/format";

export default function News() {
  const news = useApi(api.news, 120000);
  const home = useApi(api.home, 120000);
  const glob = useApi(api.marketsGlobal, 120000);
  const holdings = useApi(api.holdings, 120000);
  const { run } = useActivity();
  const rss = news.data?.rss_count ?? 0;
  const [mineOnly, setMineOnly] = useState(false);

  const indices = useMemo(() => (glob.data?.groups ?? []).flatMap((g) => g.items).slice(0, 8), [glob.data]);

  // Terms that identify the user's holdings, to flag/filter relevant headlines.
  const terms = useMemo(() => {
    const t = new Set<string>();
    for (const h of holdings.data?.holdings ?? []) {
      if (h.symbol) t.add(h.symbol.toLowerCase());
      if (h.name) t.add(h.name.toLowerCase());
    }
    return t;
  }, [holdings.data]);

  const mentionsHolding = (headline: string, summary: string | null | undefined, symbols: string[]) => {
    const blob = `${headline} ${summary ?? ""}`.toLowerCase();
    return symbols.some((s) => terms.has(s.toLowerCase())) || [...terms].some((t) => t.length > 2 && blob.includes(t));
  };

  const items = news.data?.items ?? [];
  const shown = mineOnly ? items.filter((i) => mentionsHolding(i.headline, i.summary, i.symbols)) : items;

  return (
    <div className="space-y-4">
      {/* Markets at a glance — context for the day's headlines */}
      {indices.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {indices.map((it) => {
            const cp = it.quote.change_pct;
            return (
              <Link key={it.symbol} to={`/instrument/${it.symbol}`}
                className="shrink-0 bg-surface rounded-card border border-line px-3 py-2 hover:border-accent transition-colors min-w-[8.5rem]">
                <div className="text-xs text-muted truncate">{it.label.split("·").pop()?.trim()}</div>
                <div className="tnum text-sm">{it.quote.price === null ? "—" : money(it.quote.price, it.quote.currency, true)}</div>
                <div className={`tnum text-xs ${cp == null ? "text-faint" : cp >= 0 ? "text-up" : "text-down"}`}>
                  {cp == null ? "" : `${cp >= 0 ? "+" : ""}${cp.toFixed(2)}%`}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-12 gap-4 auto-rows-min">
        <Card title="AI briefing" className="col-span-12 lg:col-span-5"
          action={
            <button className="lf-chip bg-elevated text-accent hover:text-ink" title="Regenerate the AI briefing"
              onClick={() => run("briefing", async () => { const r = await api.refreshBriefing(); home.refetch(); return r; },
                { pending: "Regenerating briefing", success: "Briefing updated", error: "Couldn't refresh briefing" })}>
              ↻ Refresh
            </button>
          }>
          {home.data?.briefing.text ? <Markdown>{home.data.briefing.text}</Markdown> : <p className="text-muted">—</p>}
          <p className="text-xs text-faint mt-3">Grounded in your portfolio + market data. Information only, not financial advice.</p>
        </Card>

        <Card
          title="Headlines"
          className="col-span-12 lg:col-span-7"
          action={
            <div className="flex items-center gap-2">
              <button
                className={`lf-chip ${mineOnly ? "bg-accent/15 text-accent" : "bg-elevated text-muted hover:text-ink"}`}
                title="Show only headlines mentioning your holdings"
                onClick={() => setMineOnly((v) => !v)}
              >
                {mineOnly ? "★ My holdings" : "My holdings"}
              </button>
              <span className="text-xs text-faint hidden sm:inline">{rss > 0 ? `${rss} RSS` : "RSS: 0"}</span>
              <button className="lf-chip bg-elevated text-accent hover:text-ink" title="Refresh headlines"
                onClick={() => run("headlines", async () => news.refetch(),
                  { pending: "Refreshing headlines", success: "Headlines refreshed", error: "Couldn't refresh" })}>↻</button>
            </div>
          }
        >
          {news.loading && !news.data && <p className="text-muted text-sm">Loading headlines…</p>}
          <ul className="divide-y divide-line/50">
            {shown.map((item, i) => {
              const mine = mentionsHolding(item.headline, item.summary, item.symbols);
              return (
                <li key={i} className="py-3">
                  <div className="flex items-start gap-2">
                    {mine && <span className="lf-chip bg-accent/15 text-accent shrink-0 mt-0.5" title="Mentions your holdings">★</span>}
                    <div className="min-w-0">
                      {item.url ? (
                        <a className="text-ink hover:text-accent" href={item.url} target="_blank" rel="noreferrer">{item.headline}</a>
                      ) : (
                        <div className="text-ink">{item.headline}</div>
                      )}
                      {item.summary && <div className="text-sm text-muted mt-1 line-clamp-2">{item.summary}</div>}
                      <div className="text-xs text-faint mt-1">
                        {item.source} · {timeAgo(item.published_at)}
                        {item.symbols.length > 0 && ` · ${item.symbols.join(", ")}`}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
            {news.data && shown.length === 0 && (
              <li className="py-3 text-muted text-sm">
                {mineOnly
                  ? "No recent headlines mention your holdings. Toggle off “My holdings” to see everything."
                  : <>No headlines. Add RSS feed URLs in <Link to="/settings" className="text-accent">Settings → News feeds</Link>, then use <span className="text-ink">Test feeds</span> to check them.</>}
              </li>
            )}
          </ul>
          {rss === 0 && news.data && items.length > 0 && !mineOnly && (
            <p className="text-xs text-warn mt-3">
              Showing provider headlines only — your RSS feeds returned nothing. Open
              <Link to="/settings" className="text-accent"> Settings → News feeds → Test feeds</Link> to see why.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

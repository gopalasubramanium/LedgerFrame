import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { Card, ChangePill, DataBadge, Figure, Skeleton } from "../components/ui";
import { useActivity } from "../components/Activity";
import { MoverList } from "../components/MoverList";
import { Donut, Sparkline } from "../components/Chart";
import { TickerStrip } from "../components/TickerStrip";
import { money, pct, signedMoney, timeAgo, toneClass } from "../lib/format";
import type { HoldingRow, Quote } from "../lib/types";

type TickerSrc = "markets" | "holdings" | "global" | "watchlist";

// Home = the master dashboard: a clean, equal-height summary of every page —
// Portfolio (value, allocation, movers, performance), Markets (indices, your
// instruments, watchlist, FX) and News (briefing + headlines). Each row is its
// own grid so cards align and share a height.
export default function Home() {
  const { data, loading, stale, refetch } = useApi(api.home, 60000);
  const summary = useApi(api.portfolioSummary, 60000);
  const holdings = useApi(api.holdings, 60000);
  const perf = useApi(() => api.performance(90, "SPY"), 0);
  const wl = useApi(api.watchlists, 60000);
  const news = useApi(api.news, 180000);
  const glob = useApi(api.marketsGlobal, 60000);
  const { run } = useActivity();
  const [tickerSrc, setTickerSrc] = useState<TickerSrc>(
    (localStorage.getItem("lf_ticker") as TickerSrc) || "markets",
  );

  // Lazy / progressive: the page shell renders immediately and each card fills in
  // as its own request resolves, so a slow /home call never blanks the whole page.
  // Only show the full-page skeleton on the very first paint with nothing at all.
  const cold = loading && !data && !summary.data && !holdings.data;
  if (cold) return <HomeSkeleton />;

  const p = data?.portfolio;
  const s = summary.data;
  const ccy = p?.base_currency ?? s?.base_currency ?? "SGD";
  const open = data?.market_status?.state === "open";
  const watch = wl.data?.watchlists.flatMap((l) => l.items) ?? [];
  const indices = (glob.data?.groups ?? []).flatMap((g) => g.items);
  const markets = data?.markets ?? [];
  const fx = data?.fx ?? [];
  const allocClass = s ? Object.entries(s.allocation_by_class).map(([name, value]) => ({ name, value: Math.abs(value) })).filter((x) => x.value > 0) : [];
  const perfSeries = (perf.data?.series ?? []).map((x) => x.value);
  const topHoldings = [...(holdings.data?.holdings ?? [])].filter((h) => h.market_value > 0).sort((a, b) => b.market_value - a.market_value).slice(0, 5);
  const gross = topHoldings.reduce((acc, h) => acc + h.market_value, 0) || 1;

  const tickerQuotes: Quote[] =
    tickerSrc === "holdings" ? (holdings.data?.holdings ?? []).filter((h) => h.symbol).map((h) => ({ symbol: h.symbol!, price: h.price, change_pct: h.day_change_pct ?? null, currency: h.currency } as Quote))
      : tickerSrc === "global" ? indices.map((i) => i.quote)
        : tickerSrc === "watchlist" ? watch.map((i) => i.quote)
          : markets;
  const setTicker = (sx: TickerSrc) => { localStorage.setItem("lf_ticker", sx); setTickerSrc(sx); };

  return (
    <div className="space-y-4">
      {stale && <div className="lf-chip bg-warn/15 text-warn">⚠ Offline — showing last known data.</div>}

      {/* Ticker */}
      <div className="flex items-center gap-2">
        <select className="lf-input w-auto py-1 text-sm shrink-0" value={tickerSrc} onChange={(e) => setTicker(e.target.value as TickerSrc)} title="Ticker source">
          <option value="markets">Markets</option>
          <option value="holdings">My holdings</option>
          <option value="global">Global</option>
          <option value="watchlist">Watchlist</option>
        </select>
        <div className="flex-1 min-w-0"><TickerStrip quotes={tickerQuotes} fx={fx} /></div>
      </div>

      {/* Row 1 — Portfolio headline + allocation */}
      <div className="grid grid-cols-12 gap-4 items-stretch">
        <Card title="Portfolio" className="col-span-12 lg:col-span-8 h-full"
          action={
            <div className="flex items-center gap-2">
              <span className={`lf-chip ${open ? "bg-up/15 text-up" : "bg-elevated text-muted"}`}>{open ? "● Open" : "○ Closed"}</span>
              <Link to="/portfolio" className="lf-chip bg-elevated text-accent">Analytics →</Link>
            </div>
          }>
          {p ? (
            <>
              <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
                <Figure label={`Total value (${ccy})`}>{money(p.total_value, ccy)}</Figure>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 flex-1 min-w-[16rem]">
                  <Mini label="Today" value={signedMoney(p.day_change, ccy)} tone={p.day_change} />
                  <Mini label="Total return" value={pct(p.total_return_pct)} tone={p.total_return_pct} />
                  <Mini label="Unrealised" value={signedMoney(p.unrealised_pl, ccy)} tone={p.unrealised_pl} />
                  <Mini label="Cost basis" value={money(s?.cost_basis ?? null, ccy)} tone={undefined} />
                </div>
              </div>
              {perfSeries.length > 1 && (
                <div className="mt-3 -mb-1"><Sparkline points={perfSeries} up={perfSeries[perfSeries.length - 1] >= perfSeries[0]} /></div>
              )}
              {p.has_stale && <div className="mt-2"><DataBadge stale /></div>}
            </>
          ) : (
            <div className="space-y-3">
              <Skeleton className="h-9 w-44" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}
        </Card>

        <Card title="Allocation" className="col-span-12 lg:col-span-4 h-full"
          action={<Link to="/portfolio" className="lf-chip bg-elevated text-accent">More →</Link>}>
          {allocClass.length ? (
            <div className="flex items-center gap-3">
              <div className="w-28 shrink-0"><Donut data={allocClass} /></div>
              <ul className="flex-1 min-w-0 grid grid-cols-1 gap-y-1 text-sm">
                {allocClass.sort((a, b) => b.value - a.value).slice(0, 5).map((a) => (
                  <li key={a.name} className="flex justify-between gap-2">
                    <span className="text-muted capitalize truncate">{a.name.replace("_", " ")}</span>
                    <span className="tnum">{money(a.value, ccy, true)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : <p className="text-muted text-sm">No holdings yet.</p>}
        </Card>
      </div>

      {/* Row 2 — Insights: movers · performance · top holdings (3 equal) */}
      <div className="grid grid-cols-12 gap-4 items-stretch">
        <Card title="Today's movers" className="col-span-12 md:col-span-6 lg:col-span-4 h-full">
          <div className="grid grid-cols-2 gap-5">
            <MoverList title="Gainers" rows={(s?.top_gainers ?? []) as HoldingRow[]} ccy={ccy} max={5} />
            <MoverList title="Detractors" rows={(s?.top_losers ?? []) as HoldingRow[]} ccy={ccy} max={5} />
          </div>
        </Card>

        <Card title="Performance" className="col-span-12 md:col-span-6 lg:col-span-4 h-full"
          action={<Link to="/portfolio" className="lf-chip bg-elevated text-accent">vs {perf.data?.benchmark_symbol ?? "SPY"} →</Link>}>
          {perfSeries.length > 1 ? (
            <>
              <Sparkline points={perfSeries} up={perfSeries[perfSeries.length - 1] >= perfSeries[0]} />
              <div className="grid grid-cols-3 gap-2 mt-2">
                <Mini label="90d return" value={pct(perf.data?.stats?.return_pct ?? null)} tone={perf.data?.stats?.return_pct ?? null} />
                <Mini label={`vs ${perf.data?.benchmark_symbol ?? "SPY"}`} value={pct(perf.data?.stats?.excess_pct ?? null)} tone={perf.data?.stats?.excess_pct ?? null} />
                <Mini label="Max DD" value={pct(perf.data?.stats?.max_drawdown_pct ?? null)} tone={perf.data?.stats?.max_drawdown_pct ?? null} />
              </div>
            </>
          ) : <p className="text-muted text-sm">{perf.loading ? "Loading…" : "Building price history…"}</p>}
        </Card>

        <Card title="Top holdings" className="col-span-12 md:col-span-12 lg:col-span-4 h-full"
          action={<Link to="/holdings" className="lf-chip bg-elevated text-accent">All →</Link>}>
          {topHoldings.length ? (
            <ul className="space-y-2">
              {topHoldings.map((h) => {
                const w = Math.min(100, (h.market_value / gross) * 100);
                return (
                  <li key={h.id}>
                    <div className="flex justify-between text-sm gap-2">
                      <Link to={h.symbol ? `/instrument/${h.symbol}` : "/holdings"} className="truncate hover:text-accent">{h.name || h.label}</Link>
                      <span className="tnum text-muted shrink-0">{w.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-elevated mt-1"><div className="h-full rounded-full bg-accent" style={{ width: `${w}%` }} /></div>
                  </li>
                );
              })}
            </ul>
          ) : <p className="text-muted text-sm">No holdings yet.</p>}
        </Card>
      </div>

      {/* Row 3 — Markets: indices · your markets · watchlist + FX (3 equal) */}
      <div className="grid grid-cols-12 gap-4 items-stretch">
        <CompactQuoteCard title="World indices" to="/markets"
          rows={indices.slice(0, 7).map((i) => ({ key: i.symbol, symbol: i.symbol, label: i.label.split("·").pop()?.trim() ?? i.symbol, quote: i.quote }))} />
        <CompactQuoteCard title="Markets" to="/markets"
          rows={markets.slice(0, 7).map((q) => ({ key: q.symbol, symbol: q.symbol, label: q.symbol, quote: q }))} />
        <Card title="Watchlist & FX" className="col-span-12 md:col-span-12 lg:col-span-4 h-full"
          action={<Link to="/markets" className="lf-chip bg-elevated text-accent">All →</Link>}>
          <ul className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-x-3 gap-y-1.5 text-sm">
            {watch.slice(0, 4).map((it) => (
              <li key={it.symbol} className="contents">
                <Link to={`/instrument/${it.symbol}`} className="truncate hover:text-accent">{it.symbol}</Link>
                <span className="tnum text-right">{it.quote.price === null ? "—" : money(it.quote.price, it.quote.currency, true)}</span>
                <span className="justify-self-end"><ChangePill value={it.quote.change_pct} /></span>
              </li>
            ))}
            {watch.length === 0 && <li className="text-muted text-sm col-span-3">No watchlist items.</li>}
          </ul>
          <div className="border-t border-line/60 mt-3 pt-2 grid grid-cols-2 gap-x-5 gap-y-1 text-sm">
            {fx.slice(0, 4).map((f) => (
              <div key={`${f.base}${f.quote}`} className="flex justify-between gap-2">
                <span className="text-xs text-faint">{f.base}/{f.quote}</span>
                <span className="tnum">{f.rate.toFixed(4)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Row 4 — News: briefing + headlines (aligned, equal) */}
      <div className="grid grid-cols-12 gap-4 items-stretch">
        <Card title="Daily briefing" className="col-span-12 lg:col-span-7 h-full"
          action={
            <button className="lf-chip bg-elevated text-accent hover:text-ink" title="Regenerate the AI briefing"
              onClick={() => run("briefing", async () => { const r = await api.refreshBriefing(); refetch(); return r; },
                { pending: "Regenerating briefing", success: "Briefing updated", error: "Couldn't refresh briefing" })}>↻ Refresh</button>
          }>
          {data?.briefing ? (
            <>
              <p className="text-ink leading-relaxed text-sm">{data.briefing.text}</p>
              <p className="text-xs text-faint mt-3">
                {data.briefing.generated_at ? `Generated ${timeAgo(data.briefing.generated_at)}` : "Not yet generated"} · Information only, not financial advice.
              </p>
            </>
          ) : (
            <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-11/12" /><Skeleton className="h-4 w-4/5" /></div>
          )}
        </Card>

        <Card title="Headlines" className="col-span-12 lg:col-span-5 h-full"
          action={
            <div className="flex items-center gap-2">
              <button className="lf-chip bg-elevated text-accent hover:text-ink" title="Refresh headlines"
                onClick={() => run("headlines", async () => news.refetch(), { pending: "Refreshing headlines", success: "Headlines refreshed", error: "Couldn't refresh" })}>↻</button>
              <Link to="/news" className="lf-chip bg-elevated text-accent">More →</Link>
            </div>
          }>
          <ul className="divide-y divide-line/50">
            {(news.data?.items ?? []).slice(0, 6).map((item, i) => (
              <li key={i} className="py-1.5">
                {item.url ? (
                  <a className="text-sm text-ink hover:text-accent line-clamp-1" href={item.url} target="_blank" rel="noreferrer">{item.headline}</a>
                ) : (
                  <span className="text-sm text-ink line-clamp-1">{item.headline}</span>
                )}
                <div className="text-xs text-faint">{item.source} · {timeAgo(item.published_at)}</div>
              </li>
            ))}
            {(!news.data || news.data.items.length === 0) && (
              <li className="py-2 text-muted text-sm">No headlines. Add feeds in Settings → News feeds.</li>
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: number | null }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-faint">{label}</div>
      <div className={`tnum text-sm ${tone === undefined || tone === null ? "text-ink" : toneClass(tone)}`}>{value}</div>
    </div>
  );
}

function CompactQuoteCard({ title, to, rows }: {
  title: string; to: string;
  rows: { key: string; symbol: string; label: string; quote: Quote }[];
}) {
  return (
    <Card title={title} className="col-span-12 md:col-span-6 lg:col-span-4 h-full"
      action={<Link to={to} className="lf-chip bg-elevated text-accent">All →</Link>}>
      <ul className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-x-3 gap-y-1.5 text-sm">
        {rows.map((r) => (
          <li key={r.key} className="contents">
            <Link to={`/instrument/${r.symbol}`} className="text-muted hover:text-accent truncate" title={r.label}>{r.label}</Link>
            <span className="tnum text-right">{r.quote.price === null ? "—" : money(r.quote.price, r.quote.currency, true)}</span>
            <span className="justify-self-end"><ChangePill value={r.quote.change_pct} /></span>
          </li>
        ))}
        {rows.length === 0 && <li className="text-muted text-sm col-span-3">—</li>}
      </ul>
    </Card>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-12 gap-4">
        <Skeleton className="h-40 col-span-12 lg:col-span-8" />
        <Skeleton className="h-40 col-span-12 lg:col-span-4" />
      </div>
      <div className="grid grid-cols-12 gap-4">
        <Skeleton className="h-44 col-span-12 lg:col-span-4" />
        <Skeleton className="h-44 col-span-12 lg:col-span-4" />
        <Skeleton className="h-44 col-span-12 lg:col-span-4" />
      </div>
    </div>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { Card, ChangePill, DataBadge, Figure, Skeleton } from "../components/ui";
import { TickerStrip } from "../components/TickerStrip";
import { money, pct, signedMoney, timeAgo, toneClass } from "../lib/format";
import type { Quote } from "../lib/types";

type TickerSrc = "markets" | "holdings" | "global" | "watchlist";

// Home = the glanceable "command centre": what's happening right now across your
// portfolio and the markets. Deep analytics (performance, allocation, key stats)
// live on the Portfolio page; position management lives on Holdings.
export default function Home() {
  const { data, loading, stale } = useApi(api.home, 60000);
  const wl = useApi(api.watchlists, 60000);
  const news = useApi(api.news, 180000);
  const overview = useApi(api.marketsOverview, 60000);
  const glob = useApi(api.marketsGlobal, 60000);
  const [tickerSrc, setTickerSrc] = useState<TickerSrc>(
    (localStorage.getItem("lf_ticker") as TickerSrc) || "markets",
  );
  if (loading && !data) return <HomeSkeleton />;
  if (!data) return <p className="text-muted">Unable to load dashboard.</p>;

  const p = data.portfolio;
  const open = data.market_status.state === "open";
  const watch = wl.data?.watchlists.flatMap((l) => l.items) ?? [];

  const tickerQuotes: Quote[] =
    tickerSrc === "holdings"
      ? (overview.data?.instruments ?? []).filter((i) => i.held).map((i) => i.quote)
      : tickerSrc === "global"
        ? (glob.data?.groups ?? []).flatMap((g) => g.items.map((i) => i.quote))
        : tickerSrc === "watchlist"
          ? watch.map((i) => i.quote)
          : data.markets;
  const setTicker = (s: TickerSrc) => { localStorage.setItem("lf_ticker", s); setTickerSrc(s); };

  return (
    <div className="space-y-4">
      {stale && <div className="lf-chip bg-warn/15 text-warn">⚠ Offline — showing last known data.</div>}
      <div className="flex items-center gap-2">
        <select className="lf-input w-auto py-1 text-sm" value={tickerSrc} onChange={(e) => setTicker(e.target.value as TickerSrc)} title="Ticker source">
          <option value="markets">Markets</option>
          <option value="holdings">My holdings</option>
          <option value="global">Global</option>
          <option value="watchlist">Watchlist</option>
        </select>
        <div className="flex-1 min-w-0"><TickerStrip quotes={tickerQuotes} fx={data.fx} /></div>
      </div>

      <div className="grid grid-cols-12 gap-4 auto-rows-min">
        {/* Portfolio headline */}
        <Card title="Portfolio" className="col-span-12 lg:col-span-5"
          action={
            <div className="flex items-center gap-2">
              <span className={`lf-chip ${open ? "bg-up/15 text-up" : "bg-elevated text-muted"}`}>{open ? "● Markets open" : "○ Markets closed"}</span>
              <Link to="/portfolio" className="lf-chip bg-elevated text-accent">Analytics →</Link>
            </div>
          }>
          <Figure label={`Total value (${p.base_currency})`}>{money(p.total_value, p.base_currency)}</Figure>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Mini label="Today" value={signedMoney(p.day_change, p.base_currency)} tone={p.day_change} />
            <Mini label="Total return" value={pct(p.total_return_pct)} tone={p.total_return_pct} />
            <Mini label="Unrealised" value={signedMoney(p.unrealised_pl, p.base_currency)} tone={p.unrealised_pl} />
          </div>
          {p.has_stale && <div className="mt-3"><DataBadge stale /></div>}
        </Card>

        {/* Top movers */}
        <Card title="Today's movers" className="col-span-12 lg:col-span-7">
          <div className="grid grid-cols-2 gap-6">
            <Movers title="Gainers" rows={data.top_movers.gainers} ccy={p.base_currency} />
            <Movers title="Detractors" rows={data.top_movers.losers} ccy={p.base_currency} />
          </div>
        </Card>

        {/* Markets */}
        <Card title="Markets" className="col-span-12 lg:col-span-4">
          <ul className="space-y-2">
            {data.markets.map((q) => (
              <li key={q.symbol} className="flex items-center justify-between">
                <Link to={`/instrument/${q.symbol}`} className="text-muted text-sm hover:text-accent">{q.symbol}</Link>
                <span className="tnum text-sm">{q.price === null ? "—" : money(q.price, q.currency, true)}</span>
                <ChangePill value={q.change_pct} />
              </li>
            ))}
          </ul>
        </Card>

        {/* Watchlist snapshot */}
        <Card title="Watchlist" className="col-span-12 lg:col-span-4"
          action={<Link to="/markets" className="lf-chip bg-elevated text-accent">All →</Link>}>
          {watch.length === 0 && <p className="text-muted text-sm">No watchlist items.</p>}
          <ul className="space-y-2">
            {watch.slice(0, 7).map((it) => (
              <li key={it.symbol} className="flex items-center justify-between">
                <Link to={`/instrument/${it.symbol}`} className="text-sm hover:text-accent">{it.symbol}</Link>
                <span className="tnum text-sm">{it.quote.price === null ? "—" : money(it.quote.price, it.quote.currency, true)}</span>
                <ChangePill value={it.quote.change_pct} />
              </li>
            ))}
          </ul>
        </Card>

        {/* FX */}
        <Card title="FX" className="col-span-12 lg:col-span-4">
          <ul className="grid grid-cols-2 gap-3">
            {data.fx.map((f) => (
              <li key={`${f.base}${f.quote}`} className="flex items-center justify-between">
                <span className="text-xs text-faint">{f.base}/{f.quote}</span>
                <span className="tnum">{f.rate.toFixed(4)}</span>
              </li>
            ))}
          </ul>
        </Card>

        {/* Daily briefing */}
        <Card title="Daily briefing" className="col-span-12 lg:col-span-7">
          <p className="text-ink leading-relaxed">{data.briefing.text}</p>
          <p className="text-xs text-faint mt-3">
            {data.briefing.generated_at ? `Generated ${timeAgo(data.briefing.generated_at)}` : "Not yet generated"} · Information only, not financial advice.
          </p>
        </Card>

        {/* Headlines preview */}
        <Card title="Headlines" className="col-span-12 lg:col-span-5"
          action={<Link to="/news" className="lf-chip bg-elevated text-accent">More →</Link>}>
          <ul className="divide-y divide-line/50">
            {(news.data?.items ?? []).slice(0, 5).map((item, i) => (
              <li key={i} className="py-2">
                {item.url ? (
                  <a className="text-sm text-ink hover:text-accent" href={item.url} target="_blank" rel="noreferrer">{item.headline}</a>
                ) : (
                  <span className="text-sm text-ink">{item.headline}</span>
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

function Mini({ label, value, tone }: { label: string; value: string; tone: number | null }) {
  return (
    <div className="bg-base rounded-card px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-faint">{label}</div>
      <div className={`tnum ${tone === null ? "text-ink" : toneClass(tone)}`}>{value}</div>
    </div>
  );
}

function Movers({ title, rows, ccy }: { title: string; rows: { label: string; symbol: string | null; day_change: number; is_stale: boolean }[]; ccy: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-faint mb-2">{title}</div>
      {rows.length === 0 && <div className="text-muted text-sm">No priced positions.</div>}
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.label} className="flex justify-between text-sm">
            {r.symbol ? (
              <Link to={`/instrument/${r.symbol}`} className="truncate mr-2 hover:text-accent">{r.label}{r.is_stale ? " ⚠" : ""}</Link>
            ) : (
              <span className="truncate mr-2">{r.label}{r.is_stale ? " ⚠" : ""}</span>
            )}
            <span className={`tnum ${toneClass(r.day_change)}`}>{signedMoney(r.day_change, ccy)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-14 w-full" />
      <div className="grid grid-cols-12 gap-4">
        <Skeleton className="h-44 col-span-12 lg:col-span-5" />
        <Skeleton className="h-44 col-span-12 lg:col-span-7" />
        <Skeleton className="h-56 col-span-12 lg:col-span-4" />
        <Skeleton className="h-56 col-span-12 lg:col-span-4" />
        <Skeleton className="h-56 col-span-12 lg:col-span-4" />
      </div>
    </div>
  );
}

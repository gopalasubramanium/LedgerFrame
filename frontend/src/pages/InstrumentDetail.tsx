import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { Card, ChangePill, DataBadge } from "../components/ui";
import { LineSeries } from "../components/Chart";
import { money, num, pct, signedMoney, timeAgo, toneClass } from "../lib/format";

const PERIODS: { label: string; days: number }[] = [
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
  { label: "5Y", days: 1825 },
  { label: "All", days: 3650 },
];

export default function InstrumentDetail() {
  const { symbol = "" } = useParams();
  const [period, setPeriod] = useState(2); // 6M default

  const detail = useApi(
    () => fetch(`/api/v1/instruments/${encodeURIComponent(symbol)}`).then((r) => r.json()),
    0, [symbol],
  );
  const history = useApi(() => api.history(symbol, PERIODS[period].days), 0, [symbol, period]);
  const wl = useApi(api.watchlists, 0);
  const holdings = useApi(api.holdings, 0);
  const news = useApi(() => api.instrumentNews(symbol), 0, [symbol]);

  const q = detail.data?.quote;
  const meta = detail.data?.instrument;
  const candles = history.data?.candles ?? [];
  const holding = (holdings.data?.holdings ?? []).find((h) => h.symbol === symbol);

  // Derived stats from the series.
  const stats = useMemo(() => {
    if (candles.length === 0) return null;
    const closes = candles.map((c) => c.close);
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const first = closes[0];
    const last = closes[closes.length - 1];
    const periodPct = first ? ((last - first) / first) * 100 : null;
    return {
      periodHigh: Math.max(...highs),
      periodLow: Math.min(...lows),
      periodPct,
      dayHigh: candles[candles.length - 1].high,
      dayLow: candles[candles.length - 1].low,
    };
  }, [candles]);

  const ccy = q?.currency ?? "USD";
  const price = q?.price ?? null;
  // Position of current price within the period range, for the range bar.
  const rangePos =
    stats && price != null && stats.periodHigh > stats.periodLow
      ? ((price - stats.periodLow) / (stats.periodHigh - stats.periodLow)) * 100
      : 50;

  return (
    <div className="grid grid-cols-12 gap-4 auto-rows-min">
      {/* Header */}
      <Card className="col-span-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight">
                {meta?.name && meta.name.toUpperCase() !== symbol.toUpperCase() ? meta.name : symbol}
              </h1>
              {meta?.name && meta.name.toUpperCase() !== symbol.toUpperCase() && (
                <span className="text-muted text-sm font-medium">{symbol}</span>
              )}
              {q && <DataBadge entitlement={q.entitlement} stale={q.is_stale} source={q.source} asOf={q.received_at} />}
            </div>
            <div className="text-muted text-sm mt-1">
              {[meta?.exchange, meta?.sector, meta?.country].filter(Boolean).join(" · ")}
            </div>
          </div>
          <div className="text-right">
            <div className="text-hero tnum leading-none">{price == null ? "—" : money(price, ccy)}</div>
            <div className="mt-2 flex items-center justify-end gap-2">
              <span className={`tnum ${toneClass(q?.change ?? null)}`}>
                {q?.change == null ? "" : money(q.change, ccy)}
              </span>
              <ChangePill value={q?.change_pct ?? null} />
            </div>
          </div>
        </div>
      </Card>

      {/* Chart + period selector */}
      <Card className="col-span-12 lg:col-span-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Price</h2>
          <div className="flex gap-1">
            {PERIODS.map((p, i) => (
              <button
                key={p.label}
                className={`touch px-3 py-1 rounded-card text-sm ${i === period ? "bg-accent text-base" : "bg-elevated text-muted hover:text-ink"}`}
                onClick={() => setPeriod(i)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {candles.length > 1 ? (
          <LineSeries x={candles.map((c) => new Date(c.ts).toLocaleDateString())} y={candles.map((c) => c.close)} height={340} />
        ) : (
          <p className="text-muted">No history available.</p>
        )}
        {stats?.periodPct != null && (
          <p className={`text-sm mt-2 ${toneClass(stats.periodPct)}`}>
            {PERIODS[period].label}: {pct(stats.periodPct)}
          </p>
        )}
      </Card>

      {/* Key statistics */}
      <Card title="Key statistics" className="col-span-12 lg:col-span-4">
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <Stat k="Previous close" v={q?.previous_close == null ? "—" : money(q.previous_close, ccy)} />
          <Stat k="Day change" v={q?.change == null ? "—" : money(q.change, ccy)} />
          <Stat k="Currency" v={ccy} />
          <Stat k="Entitlement" v={q?.entitlement ?? "—"} />
          <Stat k={`${PERIODS[period].label} high`} v={stats ? money(stats.periodHigh, ccy) : "—"} />
          <Stat k={`${PERIODS[period].label} low`} v={stats ? money(stats.periodLow, ccy) : "—"} />
          <Stat k="Volume (last)" v={candles.length ? num(candles[candles.length - 1].volume ?? 0, 0) : "—"} />
          <Stat k="Asset class" v={meta?.asset_class ?? "—"} />
        </dl>

        {/* Range bar */}
        {stats && price != null && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-faint mb-1">
              <span>{money(stats.periodLow, ccy)}</span>
              <span>{PERIODS[period].label} range</span>
              <span>{money(stats.periodHigh, ccy)}</span>
            </div>
            <div className="relative h-2 rounded-full bg-elevated">
              <div className="absolute -top-1 h-4 w-1 rounded bg-accent" style={{ left: `${Math.min(100, Math.max(0, rangePos))}%` }} />
            </div>
          </div>
        )}
      </Card>

      {/* If held: your position; otherwise the watchlist for context. */}
      {holding ? (
        <Card title="Your position" className="col-span-12 lg:col-span-4">
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <Stat k="Quantity" v={num(holding.quantity, 4)} />
            <Stat k="Avg cost" v={holding.quantity ? money(holding.cost_basis / holding.quantity, ccy, true) : "—"} />
            <Stat k="Market value" v={money(holding.market_value, ccy)} />
            <Stat k="Cost basis" v={money(holding.cost_basis, ccy)} />
            <Stat k="Unrealised P/L" v={signedMoney(holding.unrealised_pl, ccy)} />
            <Stat k="Day change" v={signedMoney(holding.day_change, ccy)} />
          </dl>
          <Link to="/holdings" className="lf-btn mt-3 w-full">Manage holding</Link>
        </Card>
      ) : (
        <Card title="Watchlist" className="col-span-12 lg:col-span-4">
          {(wl.data?.watchlists.flatMap((l) => l.items) ?? []).slice(0, 10).map((it) => (
            <Link key={it.symbol} to={`/instrument/${it.symbol}`}
              className={`flex items-center justify-between py-2 border-b border-line/40 ${it.symbol === symbol ? "text-accent" : "hover:text-accent"}`}>
              <span className="text-sm">{it.symbol}</span>
              <div className="flex items-center gap-3">
                <span className="tnum text-sm">{it.quote.price == null ? "—" : money(it.quote.price, it.quote.currency, true)}</span>
                <ChangePill value={it.quote.change_pct} />
              </div>
            </Link>
          ))}
          {(wl.data?.watchlists.flatMap((l) => l.items) ?? []).length === 0 && (
            <p className="text-muted text-sm">You don't hold {symbol}. Add it on Markets (☆) to watch it.</p>
          )}
        </Card>
      )}

      {/* News for this instrument */}
      <Card title={`${symbol} news`} className="col-span-12 lg:col-span-8">
        {news.loading && !news.data && <p className="text-muted text-sm">Loading…</p>}
        <ul className="divide-y divide-line/50">
          {(news.data?.items ?? []).map((item, i) => (
            <li key={i} className="py-2">
              {item.url ? (
                <a className="text-sm text-ink hover:text-accent" href={item.url} target="_blank" rel="noreferrer">{item.headline}</a>
              ) : (
                <span className="text-sm text-ink">{item.headline}</span>
              )}
              <div className="text-xs text-faint">{item.source} · {timeAgo(item.published_at)}</div>
            </li>
          ))}
          {news.data && news.data.items.length === 0 && (
            <li className="py-3 text-muted text-sm">No recent headlines mention {symbol}. Add RSS feeds in Settings → News.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-muted">{k}</dt>
      <dd className="tnum text-right">{v}</dd>
    </>
  );
}

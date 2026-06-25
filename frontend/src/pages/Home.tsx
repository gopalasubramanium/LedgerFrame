import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { Card, ChangePill, DataBadge, Figure, Skeleton } from "../components/ui";
import { money, pct, signedMoney, timeAgo, toneClass } from "../lib/format";

export default function Home() {
  const { data, loading, stale } = useApi(api.home, 60000);
  if (loading && !data) return <HomeSkeleton />;
  if (!data) return <p className="text-muted">Unable to load dashboard.</p>;

  const p = data.portfolio;
  const open = data.market_status.state === "open";

  return (
    <div className="grid grid-cols-12 gap-4 auto-rows-min">
      {stale && (
        <div className="col-span-12 lf-chip bg-warn/15 text-warn">
          ⚠ Offline — showing last known data.
        </div>
      )}

      <Card title="Portfolio" className="col-span-12 lg:col-span-5">
        <div className="flex items-end justify-between">
          <Figure label={`Total value (${p.base_currency})`}>{money(p.total_value, p.base_currency)}</Figure>
          <div className="text-right space-y-1">
            <div className={`text-xl tnum ${toneClass(p.day_change)}`}>{signedMoney(p.day_change, p.base_currency)}</div>
            <div className="text-xs text-muted">today {pct(p.total_return_pct)} total</div>
          </div>
        </div>
        {p.has_stale && <div className="mt-3"><DataBadge stale /></div>}
      </Card>

      <Card
        title="Market"
        className="col-span-12 lg:col-span-3"
        action={<span className={`lf-chip ${open ? "bg-up/15 text-up" : "bg-elevated text-muted"}`}>{open ? "● Open" : "○ Closed"}</span>}
      >
        <ul className="space-y-2">
          {data.markets.slice(0, 4).map((q) => (
            <li key={q.symbol} className="flex items-center justify-between">
              <span className="text-muted text-sm">{q.symbol}</span>
              <span className="tnum">{q.price === null ? "—" : money(q.price, q.currency, true)}</span>
              <ChangePill value={q.change_pct} />
            </li>
          ))}
        </ul>
      </Card>

      <Card title="FX" className="col-span-12 lg:col-span-4">
        <ul className="grid grid-cols-3 gap-3">
          {data.fx.map((f) => (
            <li key={`${f.base}${f.quote}`} className="text-center">
              <div className="text-xs text-faint">{f.base}/{f.quote}</div>
              <div className="tnum text-lg">{f.rate.toFixed(4)}</div>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Top movers" className="col-span-12 lg:col-span-6">
        <div className="grid grid-cols-2 gap-4">
          <Movers title="Gainers" rows={data.top_movers.gainers} ccy={p.base_currency} />
          <Movers title="Detractors" rows={data.top_movers.losers} ccy={p.base_currency} />
        </div>
      </Card>

      <Card title="Daily briefing" className="col-span-12 lg:col-span-6">
        <p className="text-ink leading-relaxed">{data.briefing.text}</p>
        <p className="text-xs text-faint mt-3">
          {data.briefing.generated_at ? `Generated ${timeAgo(data.briefing.generated_at)}` : "Not yet generated"}
        </p>
      </Card>
    </div>
  );
}

function Movers({ title, rows, ccy }: { title: string; rows: { label: string; day_change: number; is_stale: boolean }[]; ccy: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-faint mb-2">{title}</div>
      {rows.length === 0 && <div className="text-muted text-sm">No priced positions.</div>}
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.label} className="flex justify-between text-sm">
            <span className="truncate mr-2">{r.label}{r.is_stale ? " ⚠" : ""}</span>
            <span className={`tnum ${toneClass(r.day_change)}`}>{signedMoney(r.day_change, ccy)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="grid grid-cols-12 gap-4">
      <Skeleton className="h-32 col-span-12 lg:col-span-5" />
      <Skeleton className="h-32 col-span-12 lg:col-span-3" />
      <Skeleton className="h-32 col-span-12 lg:col-span-4" />
      <Skeleton className="h-40 col-span-12 lg:col-span-6" />
      <Skeleton className="h-40 col-span-12 lg:col-span-6" />
    </div>
  );
}

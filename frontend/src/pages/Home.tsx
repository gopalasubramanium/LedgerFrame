import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { Card, ChangePill, DataBadge, Figure, Skeleton } from "../components/ui";
import { Donut } from "../components/Chart";
import { PerformancePanel } from "../components/PerformancePanel";
import { TickerStrip } from "../components/TickerStrip";
import { money, pct, signedMoney, timeAgo, toneClass } from "../lib/format";

export default function Home() {
  const { data, loading, stale } = useApi(api.home, 60000);
  const summary = useApi(api.portfolioSummary, 60000);
  if (loading && !data) return <HomeSkeleton />;
  if (!data) return <p className="text-muted">Unable to load dashboard.</p>;

  const p = data.portfolio;
  const open = data.market_status.state === "open";
  const s = summary.data;
  const allocClass = s ? Object.entries(s.allocation_by_class).map(([name, v]) => ({ name, value: Math.abs(v) })) : [];
  const allocCcy = s ? Object.entries(s.allocation_by_currency).map(([name, v]) => ({ name, value: Math.abs(v) })) : [];

  return (
    <div className="space-y-4">
      {stale && <div className="lf-chip bg-warn/15 text-warn">⚠ Offline — showing last known data.</div>}

      {/* Ticker strip */}
      <TickerStrip quotes={data.markets} fx={data.fx} />

      <div className="grid grid-cols-12 gap-4 auto-rows-min">
        {/* Portfolio headline */}
        <Card title="Portfolio" className="col-span-12 lg:col-span-4"
          action={<span className={`lf-chip ${open ? "bg-up/15 text-up" : "bg-elevated text-muted"}`}>{open ? "● Markets open" : "○ Markets closed"}</span>}>
          <Figure label={`Total value (${p.base_currency})`}>{money(p.total_value, p.base_currency)}</Figure>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Mini label="Today" value={signedMoney(p.day_change, p.base_currency)} tone={p.day_change} />
            <Mini label="Total return" value={pct(p.total_return_pct)} tone={p.total_return_pct} />
            <Mini label="Unrealised P/L" value={signedMoney(p.unrealised_pl, p.base_currency)} tone={p.unrealised_pl} />
            <Mini label="Cost basis" value={money(s?.cost_basis, p.base_currency)} tone={null} />
          </div>
          {p.has_stale && <div className="mt-3"><DataBadge stale /></div>}
        </Card>

        {/* Performance vs benchmark */}
        <PerformancePanel className="col-span-12 lg:col-span-8" height={260} />

        {/* Allocation donuts */}
        <Card title="Allocation by class" className="col-span-12 md:col-span-6 lg:col-span-4">
          {allocClass.length ? <Donut data={allocClass} /> : <p className="text-muted">No holdings.</p>}
          <Legend items={allocClass} />
        </Card>
        <Card title="By currency" className="col-span-12 md:col-span-6 lg:col-span-4">
          {allocCcy.length ? <Donut data={allocCcy} /> : <p className="text-muted">No holdings.</p>}
          <Legend items={allocCcy} />
        </Card>

        {/* Top movers */}
        <Card title="Top movers" className="col-span-12 lg:col-span-4">
          <div className="grid grid-cols-2 gap-4">
            <Movers title="Gainers" rows={data.top_movers.gainers} ccy={p.base_currency} />
            <Movers title="Detractors" rows={data.top_movers.losers} ccy={p.base_currency} />
          </div>
        </Card>

        {/* Markets + FX summary */}
        <Card title="Markets" className="col-span-12 lg:col-span-5">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2">
            {data.markets.map((q) => (
              <li key={q.symbol} className="flex items-center justify-between">
                <Link to={`/instrument/${q.symbol}`} className="text-muted text-sm hover:text-accent">{q.symbol}</Link>
                <span className="tnum text-sm">{q.price === null ? "—" : money(q.price, q.currency, true)}</span>
                <ChangePill value={q.change_pct} />
              </li>
            ))}
          </ul>
        </Card>

        {/* Briefing */}
        <Card title="Daily briefing" className="col-span-12 lg:col-span-7">
          <p className="text-ink leading-relaxed">{data.briefing.text}</p>
          <p className="text-xs text-faint mt-3">
            {data.briefing.generated_at ? `Generated ${timeAgo(data.briefing.generated_at)}` : "Not yet generated"} · Information only, not financial advice.
          </p>
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

function Legend({ items }: { items: { name: string; value: number }[] }) {
  const total = items.reduce((a, b) => a + b.value, 0) || 1;
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs">
      {items.slice(0, 8).map((a) => (
        <li key={a.name} className="flex justify-between">
          <span className="text-muted capitalize truncate">{a.name.replace("_", " ")}</span>
          <span className="tnum text-faint">{((a.value / total) * 100).toFixed(0)}%</span>
        </li>
      ))}
    </ul>
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
        <Skeleton className="h-44 col-span-12 lg:col-span-4" />
        <Skeleton className="h-44 col-span-12 lg:col-span-8" />
        <Skeleton className="h-56 col-span-12 lg:col-span-4" />
        <Skeleton className="h-56 col-span-12 lg:col-span-4" />
        <Skeleton className="h-56 col-span-12 lg:col-span-4" />
      </div>
    </div>
  );
}

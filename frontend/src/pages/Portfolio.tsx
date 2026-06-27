import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { Card } from "../components/ui";
import { Donut } from "../components/Chart";
import { PerformancePanel } from "../components/PerformancePanel";
import { KeyStatsPanel } from "../components/KeyStatsPanel";
import { money, pct, signedMoney, toneClass } from "../lib/format";
import type { HoldingRow } from "../lib/types";

// Analytics view of the portfolio. Position management lives on the Holdings page.
export default function Portfolio() {
  const summary = useApi(api.portfolioSummary, 60000);
  const holdings = useApi(api.holdings, 60000);
  const s = summary.data;
  const ccy = s?.base_currency ?? "SGD";

  const allocClass = s ? Object.entries(s.allocation_by_class).map(([name, value]) => ({ name, value: Math.abs(value) })) : [];
  const allocCcy = s ? Object.entries(s.allocation_by_currency).map(([name, value]) => ({ name, value: Math.abs(value) })) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Portfolio analytics</h1>
        <Link to="/holdings" className="lf-btn-accent">Manage holdings →</Link>
      </div>

      {/* Stat rail */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label={`Value (${ccy})`} value={money(s?.total_value, ccy)} />
        <Stat label="Today" value={signedMoney(s?.day_change, ccy)} tone={s?.day_change ?? 0} />
        <Stat label="Total return" value={pct(s?.total_return_pct ?? null)} tone={s?.total_return_pct ?? 0} />
        <Stat label="Unrealised P/L" value={signedMoney(s?.unrealised_pl, ccy)} tone={s?.unrealised_pl ?? 0} />
        <Stat label="Cost basis" value={money(s?.cost_basis, ccy)} />
        <Stat label="Positions" value={String(holdings.data?.holdings.length ?? 0)} />
      </div>

      <div className="grid grid-cols-12 gap-4 auto-rows-min">
        <PerformancePanel className="col-span-12 lg:col-span-8" height={300} />

        <Card title="Contributors" className="col-span-12 lg:col-span-4">
          <div className="grid grid-cols-2 gap-4">
            <MoverList title="Top" rows={s?.top_gainers ?? []} ccy={ccy} />
            <MoverList title="Bottom" rows={s?.top_losers ?? []} ccy={ccy} />
          </div>
        </Card>

        <Card title="Allocation by class" className="col-span-12 md:col-span-6 lg:col-span-4">
          {allocClass.length ? <Donut data={allocClass} /> : <p className="text-muted">No holdings.</p>}
          <Legend items={allocClass} ccy={ccy} />
        </Card>
        <Card title="Currency exposure" className="col-span-12 md:col-span-6 lg:col-span-4">
          {allocCcy.length ? <Donut data={allocCcy} /> : <p className="text-muted">No holdings.</p>}
          <Legend items={allocCcy} ccy={ccy} />
        </Card>
        <Card title="Concentration" className="col-span-12 lg:col-span-4">
          <Concentration holdings={holdings.data?.holdings ?? []} total={s?.total_value ?? 0} />
        </Card>

        <KeyStatsPanel className="col-span-12" />
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: number }) {
  return (
    <div className="lf-card py-3">
      <div className="text-xs uppercase tracking-wide text-faint">{label}</div>
      <div className={`tnum text-xl mt-1 ${tone === undefined ? "text-ink" : toneClass(tone)}`}>{value}</div>
    </div>
  );
}

function Legend({ items, ccy }: { items: { name: string; value: number }[]; ccy: string }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-sm">
      {items.map((a) => (
        <li key={a.name} className="flex justify-between">
          <span className="text-muted capitalize truncate">{a.name.replace("_", " ")}</span>
          <span className="tnum">{money(a.value, ccy, true)}</span>
        </li>
      ))}
    </ul>
  );
}

function MoverList({ title, rows, ccy }: { title: string; rows: HoldingRow[]; ccy: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-faint mb-2">{title}</div>
      {rows.length === 0 && <div className="text-muted text-sm">—</div>}
      <ul className="space-y-1">
        {rows.slice(0, 5).map((h) => (
          <li key={h.id} className="flex justify-between text-sm">
            {h.symbol ? (
              <Link to={`/instrument/${h.symbol}`} className="truncate mr-2 hover:text-accent">{h.label}</Link>
            ) : (
              <span className="truncate mr-2">{h.label}</span>
            )}
            <span className={`tnum ${toneClass(h.day_change)}`}>{signedMoney(h.day_change, ccy)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Concentration({ holdings, total }: { holdings: HoldingRow[]; total: number }) {
  const top = [...holdings].filter((h) => h.market_value > 0).sort((a, b) => b.market_value - a.market_value).slice(0, 6);
  const denom = total || 1;
  return (
    <ul className="space-y-2">
      {top.map((h) => {
        const wpct = Math.min(100, (h.market_value / denom) * 100);
        return (
          <li key={h.id}>
            <div className="flex justify-between text-sm">
              {h.symbol ? (
                <Link to={`/instrument/${h.symbol}`} className="truncate mr-2 hover:text-accent">{h.label}</Link>
              ) : (
                <span className="truncate mr-2">{h.label}</span>
              )}
              <span className="tnum text-muted">{wpct.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-elevated mt-1">
              <div className="h-full rounded-full bg-accent" style={{ width: `${wpct}%` }} />
            </div>
          </li>
        );
      })}
      {top.length === 0 && <li className="text-muted text-sm">No holdings.</li>}
    </ul>
  );
}

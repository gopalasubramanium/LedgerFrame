import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { Card, Figure } from "../components/ui";
import { Donut, LineSeries } from "../components/Chart";
import { money, pct, signedMoney, toneClass } from "../lib/format";

// Snapshot = the net-worth view: a clean KPI strip (net worth · assets ·
// liabilities · cash), the net-worth trend, and what it's made of (allocation).
export default function Snapshot() {
  const summary = useApi(api.portfolioSummary, 60000);
  const holdings = useApi(api.holdings, 60000);
  // Net-worth history reconstructed from holdings × price history (include manual
  // assets) — available immediately, not only after the worker accumulates snapshots.
  const nw = useApi(() => api.performance(365, "SPY", true), 0);

  const s = summary.data;
  const ccy = s?.base_currency ?? "SGD";
  const h = holdings.data?.holdings ?? [];
  const assets = h.filter((x) => x.market_value > 0).reduce((sum, x) => sum + x.market_value, 0);
  const liabilities = h.filter((x) => x.market_value < 0).reduce((sum, x) => sum + Math.abs(x.market_value), 0);
  const cash = h.filter((x) => x.asset_class === "cash" || x.asset_class === "fixed_deposit").reduce((sum, x) => sum + x.market_value, 0);

  const history = (nw.data?.series ?? []) as { ts: string; value: number }[];
  const first = history[0]?.value ?? 0;
  const last = history[history.length - 1]?.value ?? 0;
  const trendPct = first ? ((last - first) / Math.abs(first)) * 100 : null;

  const allocClass = s
    ? Object.entries(s.allocation_by_class).map(([name, value]) => ({ name, value: Math.abs(value) })).filter((x) => x.value > 0)
    : [];

  return (
    <div className="space-y-4">
      {/* KPI strip — equal-height, aligned */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
        <Card title="Net worth" className="h-full">
          <Figure label={ccy}>{money(s?.total_value, ccy)}</Figure>
          <div className={`mt-2 tnum text-sm ${toneClass(s?.day_change ?? 0)}`}>{signedMoney(s?.day_change, ccy)} today</div>
        </Card>
        <Card title="Assets" className="h-full">
          <Figure label={ccy}>{money(assets, ccy)}</Figure>
          <div className="mt-2 text-xs text-faint">{h.filter((x) => x.market_value > 0).length} positions</div>
        </Card>
        <Card title="Liabilities" className="h-full">
          <Figure label={ccy}>{money(liabilities, ccy)}</Figure>
          <div className="mt-2 text-xs text-faint">{h.filter((x) => x.market_value < 0).length || "no"} short / debt</div>
        </Card>
        <Card title="Cash & deposits" className="h-full">
          <Figure label={ccy}>{money(cash, ccy)}</Figure>
          <div className="mt-2 text-xs text-faint">{s?.total_value ? `${((cash / s.total_value) * 100).toFixed(1)}% of net worth` : "—"}</div>
        </Card>
      </div>

      {/* Trend + composition */}
      <div className="grid grid-cols-12 gap-4 items-stretch">
        <Card title="Net-worth history" className="col-span-12 lg:col-span-8 h-full"
          action={trendPct != null ? <span className={`lf-chip ${trendPct >= 0 ? "bg-up/15 text-up" : "bg-down/15 text-down"}`}>{pct(trendPct)} · 12mo</span> : undefined}>
          {history.length > 1 ? (
            <LineSeries x={history.map((p) => new Date(p.ts).toLocaleDateString())} y={history.map((p) => p.value)} />
          ) : (
            <p className="text-muted">
              {nw.loading ? "Loading…"
                : h.length > 0 ? "Building price history — check back in a moment (or run Settings → Fetch & cache history)."
                  : "Add holdings to see your net-worth trend."}
            </p>
          )}
        </Card>

        <Card title="Composition" className="col-span-12 lg:col-span-4 h-full">
          {allocClass.length ? (
            <div className="flex items-center gap-3">
              <div className="w-28 shrink-0"><Donut data={allocClass} /></div>
              <ul className="flex-1 min-w-0 grid grid-cols-1 gap-y-1 text-sm">
                {allocClass.sort((a, b) => b.value - a.value).slice(0, 6).map((a) => (
                  <li key={a.name} className="flex justify-between gap-2">
                    <span className="text-muted capitalize truncate">{a.name.replace("_", " ")}</span>
                    <span className="tnum">{money(a.value, ccy, true)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : <p className="text-muted text-sm">Add holdings to see your asset mix.</p>}
        </Card>
      </div>

      <p className="text-xs text-faint">
        Cash runway estimates require recurring-expense data, which isn't tracked in v1.
      </p>
    </div>
  );
}

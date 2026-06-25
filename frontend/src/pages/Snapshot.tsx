import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { Card, Figure } from "../components/ui";
import { LineSeries } from "../components/Chart";
import { money, signedMoney, toneClass } from "../lib/format";

export default function Snapshot() {
  const summary = useApi(api.portfolioSummary, 60000);
  const holdings = useApi(api.holdings, 60000);
  const nw = useApi(() => fetch("/api/v1/net-worth/history").then((r) => r.json()), 0);

  const ccy = summary.data?.base_currency ?? "SGD";
  const h = holdings.data?.holdings ?? [];
  const assets = h.filter((x) => x.market_value > 0).reduce((s, x) => s + x.market_value, 0);
  const liabilities = h.filter((x) => x.market_value < 0).reduce((s, x) => s + Math.abs(x.market_value), 0);
  const cash = h.filter((x) => x.asset_class === "cash" || x.asset_class === "fixed_deposit").reduce((s, x) => s + x.market_value, 0);

  const history = (nw.data?.history ?? []) as { ts: string; net_worth: number }[];

  return (
    <div className="grid grid-cols-12 gap-4 auto-rows-min">
      <Card title="Net worth" className="col-span-12 lg:col-span-4">
        <Figure label={ccy}>{money(summary.data?.total_value, ccy)}</Figure>
        <div className={`mt-2 tnum ${toneClass(summary.data?.day_change ?? 0)}`}>{signedMoney(summary.data?.day_change, ccy)} today</div>
      </Card>
      <Card title="Assets" className="col-span-6 lg:col-span-4">
        <Figure label={ccy}>{money(assets, ccy)}</Figure>
      </Card>
      <Card title="Liabilities" className="col-span-6 lg:col-span-4">
        <Figure label={ccy}>{money(liabilities, ccy)}</Figure>
      </Card>

      <Card title="Net-worth history" className="col-span-12 lg:col-span-8">
        {history.length > 1 ? (
          <LineSeries x={history.map((p) => new Date(p.ts).toLocaleDateString())} y={history.map((p) => p.net_worth)} />
        ) : (
          <p className="text-muted">History accumulates as the worker generates snapshots (every 6h by default).</p>
        )}
      </Card>

      <Card title="Cash & runway" className="col-span-12 lg:col-span-4">
        <Figure label={`Cash + deposits (${ccy})`}>{money(cash, ccy)}</Figure>
        <p className="text-xs text-faint mt-3">
          Cash runway estimates require recurring expense data, which is not tracked in v1.
        </p>
      </Card>
    </div>
  );
}

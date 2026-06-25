import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { Card, ChangePill, DataBadge, Figure } from "../components/ui";
import { Donut } from "../components/Chart";
import { money, pct, signedMoney, toneClass } from "../lib/format";

export default function Portfolio() {
  const summary = useApi(api.portfolioSummary, 60000);
  const holdings = useApi(api.holdings, 60000);
  const s = summary.data;
  const ccy = s?.base_currency ?? "SGD";

  const alloc = s ? Object.entries(s.allocation_by_class).map(([name, value]) => ({ name, value: Math.abs(value) })) : [];

  return (
    <div className="grid grid-cols-12 gap-4 auto-rows-min">
      <Card title="Total value" className="col-span-12 lg:col-span-3">
        <Figure label={ccy}>{money(s?.total_value, ccy)}</Figure>
        <div className={`mt-2 tnum ${toneClass(s?.day_change ?? 0)}`}>{signedMoney(s?.day_change, ccy)} today</div>
      </Card>
      <Card title="Unrealised P/L" className="col-span-12 lg:col-span-3">
        <Figure label="vs cost">{signedMoney(s?.unrealised_pl, ccy)}</Figure>
        <div className="mt-2 text-muted">{pct(s?.total_return_pct ?? null)} total return</div>
      </Card>
      <Card title="Allocation by class" className="col-span-12 lg:col-span-6 row-span-2">
        {alloc.length ? <Donut data={alloc} /> : <p className="text-muted">No holdings.</p>}
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-sm">
          {alloc.map((a) => (
            <li key={a.name} className="flex justify-between">
              <span className="text-muted capitalize">{a.name.replace("_", " ")}</span>
              <span className="tnum">{money(a.value, ccy, true)}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Currency exposure" className="col-span-12 lg:col-span-6">
        <ul className="flex flex-wrap gap-3">
          {s && Object.entries(s.allocation_by_currency).map(([c, v]) => (
            <li key={c} className="lf-chip bg-elevated text-ink">
              {c}: <span className="tnum ml-1">{money(Math.abs(v), ccy, true)}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Holdings" className="col-span-12" action={s?.has_stale ? <DataBadge stale /> : undefined}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-faint text-xs uppercase">
              <tr className="text-left border-b border-line">
                <th className="py-2">Asset</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Price</th>
                <th className="text-right">Value ({ccy})</th>
                <th className="text-right">Unrealised</th>
                <th className="text-right">Day</th>
              </tr>
            </thead>
            <tbody>
              {holdings.data?.holdings.map((h) => (
                <tr key={h.id} className="border-b border-line/50">
                  <td className="py-2">
                    {h.symbol ? (
                      <Link to={`/instrument/${h.symbol}`} className="text-ink hover:text-accent">{h.label}</Link>
                    ) : (
                      h.label
                    )}
                    {!h.is_priced && <span className="text-faint text-xs ml-2">manual</span>}
                    {h.is_stale && <span className="text-warn text-xs ml-1">⚠</span>}
                  </td>
                  <td className="text-right tnum">{h.quantity}</td>
                  <td className="text-right tnum">{h.price === null ? "—" : money(h.price, h.currency, true)}</td>
                  <td className="text-right tnum">{money(h.market_value, ccy)}</td>
                  <td className={`text-right tnum ${toneClass(h.unrealised_pl)}`}>{signedMoney(h.unrealised_pl, ccy)}</td>
                  <td className="text-right"><ChangePill value={h.day_change} currency={ccy} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

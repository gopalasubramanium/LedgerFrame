import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { Card, ChangePill, DataBadge } from "../components/ui";
import { PortfolioEditor } from "../components/PortfolioEditor";
import { money, signedMoney, toneClass } from "../lib/format";

// The single place to add / edit / delete holdings, transactions and manual assets.
export default function Holdings() {
  const summary = useApi(api.portfolioSummary, 60000);
  const holdings = useApi(api.holdings, 60000);
  const [editing, setEditing] = useState(false);
  const s = summary.data;
  const ccy = s?.base_currency ?? "SGD";
  const rows = holdings.data?.holdings ?? [];
  const refresh = () => { summary.refetch(); holdings.refetch(); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Holdings</h1>
          <p className="text-sm text-muted">
            {rows.length} positions · {money(s?.total_value, ccy)} total ·
            <Link to="/portfolio" className="text-accent ml-1">view analytics →</Link>
          </p>
        </div>
        <button className="lf-btn-accent" onClick={() => setEditing(true)}>✎ Add / Edit / Delete</button>
      </div>

      <Card action={s?.has_stale ? <DataBadge stale /> : undefined}>
        {rows.length === 0 && (
          <div className="text-center py-10">
            <p className="text-muted mb-3">No holdings yet.</p>
            <button className="lf-btn-accent" onClick={() => setEditing(true)}>+ Add your first holding</button>
            <p className="text-xs text-faint mt-3">
              Or import a CSV / set a live data source in <Link to="/settings" className="text-accent">Settings</Link>.
            </p>
          </div>
        )}
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-faint text-xs uppercase">
                <tr className="text-left border-b border-line">
                  <th className="py-2">Asset</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Price</th>
                  <th className="text-right">Value ({ccy})</th>
                  <th className="text-right">Cost basis</th>
                  <th className="text-right">Unrealised</th>
                  <th className="text-right">Day</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((h) => (
                  <tr key={h.id} className="border-b border-line/50">
                    <td className="py-2">
                      {h.symbol ? (
                        <Link to={`/instrument/${h.symbol}`} className="text-ink hover:text-accent">{h.label}</Link>
                      ) : (h.label)}
                      {!h.is_priced && <span className="text-faint text-xs ml-2">manual</span>}
                      {h.is_stale && <span className="text-warn text-xs ml-1">⚠</span>}
                    </td>
                    <td className="text-right tnum">{h.quantity}</td>
                    <td className="text-right tnum">{h.price === null ? "—" : money(h.price, h.currency, true)}</td>
                    <td className="text-right tnum">{money(h.market_value, ccy)}</td>
                    <td className="text-right tnum text-muted">{money(h.cost_basis, ccy)}</td>
                    <td className={`text-right tnum ${toneClass(h.unrealised_pl)}`}>{signedMoney(h.unrealised_pl, ccy)}</td>
                    <td className="text-right"><ChangePill value={h.day_change} currency={ccy} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && <PortfolioEditor onClose={() => setEditing(false)} onChanged={refresh} />}
    </div>
  );
}

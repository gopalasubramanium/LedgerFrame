import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { Card, ChangePill, DataBadge } from "../components/ui";
import { PortfolioEditor } from "../components/PortfolioEditor";
import { money, signedMoney, toneClass } from "../lib/format";
import type { HoldingRow } from "../lib/types";

type SortKey = "asset" | "quantity" | "price" | "market_value" | "cost_basis" | "unrealised_pl" | "day_change";

const COLS: { key: SortKey; label: string; right?: boolean }[] = [
  { key: "asset", label: "Asset" },
  { key: "quantity", label: "Qty", right: true },
  { key: "price", label: "Price", right: true },
  { key: "market_value", label: "Value", right: true },
  { key: "cost_basis", label: "Cost basis", right: true },
  { key: "unrealised_pl", label: "Unrealised", right: true },
  { key: "day_change", label: "Day", right: true },
];

function exportCsv(rows: HoldingRow[], ccy: string) {
  const head = ["Asset", "Symbol", "Qty", "Price", "Currency", `Value (${ccy})`, `Cost basis (${ccy})`, `Unrealised (${ccy})`, `Day (${ccy})`, "Day %"];
  const body = rows.map((h) => [
    (h.name || h.label || "").replace(/"/g, '""'), h.symbol ?? "", h.quantity, h.price ?? "",
    h.currency, h.market_value, h.cost_basis, h.unrealised_pl, h.day_change, h.day_change_pct ?? "",
  ]);
  const csv = [head, ...body].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url; a.download = `ledgerframe-holdings-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// The single place to add / edit / delete holdings, with search, sort and export.
export default function Holdings() {
  const summary = useApi(api.portfolioSummary, 60000);
  const holdings = useApi(api.holdings, 60000);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "market_value", dir: -1 });
  const s = summary.data;
  const ccy = s?.base_currency ?? "SGD";
  const allRows = holdings.data?.holdings ?? [];
  const refresh = () => { summary.refetch(); holdings.refetch(); };

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? allRows.filter((h) => `${h.name ?? ""} ${h.label ?? ""} ${h.symbol ?? ""} ${h.asset_class}`.toLowerCase().includes(q))
      : allRows;
    const key = sort.key;
    return [...filtered].sort((a, b) => {
      if (key === "asset") return (a.name || a.label).localeCompare(b.name || b.label) * sort.dir;
      return (((a[key] as number) ?? 0) - ((b[key] as number) ?? 0)) * sort.dir;
    });
  }, [allRows, query, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((p) => (p.key === key ? { key, dir: (p.dir === 1 ? -1 : 1) as 1 | -1 } : { key, dir: key === "asset" ? 1 : -1 }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Holdings</h1>
          <p className="text-sm text-muted">
            {allRows.length} positions · {money(s?.total_value, ccy)} total ·
            <Link to="/portfolio" className="text-accent ml-1">view analytics →</Link>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input className="lf-input w-44 sm:w-56" placeholder="Search holdings…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button className="lf-btn" title="Export CSV" disabled={!rows.length} onClick={() => exportCsv(rows, ccy)}>⤓ Export</button>
          <button className="lf-btn-accent" onClick={() => setEditing(true)}>✎ Add / Edit</button>
        </div>
      </div>

      <Card action={s?.has_stale ? <DataBadge stale /> : undefined}>
        {allRows.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-muted mb-3">No holdings yet.</p>
            <button className="lf-btn-accent" onClick={() => setEditing(true)}>+ Add your first holding</button>
            <p className="text-xs text-faint mt-3">
              Or import a CSV / set a live data source in <Link to="/settings" className="text-accent">Settings</Link>.
            </p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[calc(100vh-15rem)]">
            <table className="w-full text-sm">
              <thead className="text-faint text-xs uppercase sticky top-0 bg-surface z-10">
                <tr className="border-b border-line">
                  {COLS.map((c) => (
                    <th key={c.key}
                      className={`py-2 cursor-pointer select-none hover:text-ink ${c.right ? "text-right" : "text-left"}`}
                      onClick={() => toggleSort(c.key)}>
                      {c.key === "market_value" || c.key === "cost_basis" || c.key === "unrealised_pl" || c.key === "day_change" ? `${c.label} (${ccy})` : c.label}
                      {sort.key === c.key && <span className="ml-1">{sort.dir === 1 ? "▲" : "▼"}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((h) => (
                  <tr key={h.id} className="border-b border-line/50">
                    <td className="py-2">
                      {h.symbol ? (
                        <Link to={`/instrument/${h.symbol}`} className="group block">
                          <span className="text-ink group-hover:text-accent">{h.name || h.label}</span>
                          {h.name && <span className="text-faint text-xs ml-2">{h.symbol}</span>}
                        </Link>
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
                {rows.length === 0 && (
                  <tr><td colSpan={COLS.length} className="py-6 text-center text-muted">No holdings match “{query}”.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && <PortfolioEditor onClose={() => setEditing(false)} onChanged={refresh} />}
    </div>
  );
}

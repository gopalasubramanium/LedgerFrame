import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { Card } from "./ui";
import { money, pct, signedMoney, toneClass } from "../lib/format";

// Deterministic portfolio metrics (returns, income, risk, allocation weights,
// concentration). Values are computed server-side; this only formats them.
export function KeyStatsPanel({ className = "" }: { className?: string }) {
  const { data } = useApi(api.stats, 60000);
  const ccy = data?.base_currency ?? "SGD";

  function fmt(m: { value: number | null; kind: string; signed?: boolean }): string {
    if (m.value === null || m.value === undefined) return "—";
    if (m.kind === "money") return m.signed ? signedMoney(m.value, ccy) : money(m.value, ccy);
    if (m.kind === "pct") return m.signed ? pct(m.value) : `${m.value}%`;
    if (m.kind === "ratio") return m.value.toFixed(2);
    return String(m.value);
  }
  function tone(m: { value: number | null; signed?: boolean }): string {
    return m.signed && m.value !== null ? toneClass(m.value) : "text-ink";
  }

  return (
    <Card title="Key statistics" className={className}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {(data?.metrics ?? []).map((m) => (
          <div key={m.label} className="flex justify-between border-b border-line/40 py-1">
            <dt className="text-muted truncate mr-2" title={m.note ?? undefined}>{m.label}</dt>
            <dd className={`tnum text-right ${tone(m)}`}>{fmt(m)}</dd>
          </div>
        ))}
        {!data && <p className="text-muted col-span-2">Loading…</p>}
      </dl>
      <p className="text-xs text-faint mt-2">
        Computed from your data. Weights/concentration use gross assets. No fabricated
        Sharpe/duration — "return/volatility" is shown instead.
      </p>
    </Card>
  );
}

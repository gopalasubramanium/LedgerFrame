import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { Card, ChangePill, DataBadge, Figure } from "../components/ui";
import { LineSeries } from "../components/Chart";
import { money } from "../lib/format";

export default function InstrumentDetail() {
  const { symbol = "" } = useParams();
  const quote = useApi(() => api.marketsOverview().then((d) => d.quotes.find((q) => q.symbol === symbol) ?? null), 0, [symbol]);
  const detail = useApi(() => fetch(`/api/v1/instruments/${encodeURIComponent(symbol)}`).then((r) => r.json()), 0, [symbol]);
  const history = useApi(() => api.history(symbol, 180), 0, [symbol]);

  const q = detail.data?.quote ?? quote.data;
  const candles = history.data?.candles ?? [];

  return (
    <div className="grid grid-cols-12 gap-4 auto-rows-min">
      <Card title={symbol} className="col-span-12 lg:col-span-4"
        action={q && <DataBadge entitlement={q.entitlement} stale={q.is_stale} source={q.source} asOf={q.received_at} />}>
        <Figure label={q?.currency ?? ""}>{q?.price == null ? "—" : money(q.price, q.currency)}</Figure>
        <div className="mt-2"><ChangePill value={q?.change_pct ?? null} /></div>
        <p className="text-xs text-faint mt-3">
          Source: {q?.source ?? "—"} · {q?.received_at ? new Date(q.received_at).toLocaleString() : "—"}
        </p>
      </Card>

      <Card title="Price history (180d)" className="col-span-12 lg:col-span-8">
        {candles.length > 1 ? (
          <LineSeries x={candles.map((c) => new Date(c.ts).toLocaleDateString())} y={candles.map((c) => c.close)} />
        ) : (
          <p className="text-muted">No history available.</p>
        )}
      </Card>

      <Card title="Key statistics" className="col-span-12 lg:col-span-6">
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-muted">Previous close</dt>
          <dd className="tnum text-right">{q?.previous_close == null ? "—" : money(q.previous_close, q.currency)}</dd>
          <dt className="text-muted">Change</dt>
          <dd className="tnum text-right">{q?.change == null ? "—" : money(q.change, q.currency)}</dd>
          <dt className="text-muted">Entitlement</dt>
          <dd className="text-right">{q?.entitlement ?? "—"}</dd>
        </dl>
      </Card>

      <Card title="Notes" className="col-span-12 lg:col-span-6">
        <p className="text-muted text-sm">Per-instrument notes are stored locally. (Editing UI is a v1.1 item.)</p>
      </Card>
    </div>
  );
}

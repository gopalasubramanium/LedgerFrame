import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { Card } from "../components/ui";
import { Heatmap } from "../components/Chart";

export default function HeatmapPage() {
  const { data } = useApi(api.marketsOverview, 60000);
  const holdings = useApi(api.holdings, 60000);

  // Heatmap reflects YOUR holdings: size by position value, colour by daily % change.
  // (Falls back to nothing if you have no priced holdings yet.)
  const rows = holdings.data?.holdings ?? [];
  const quoteBy = new Map((data?.instruments ?? []).map((i) => [i.symbol, i.quote]));
  const items = rows
    .filter((h) => h.symbol && h.is_priced && h.market_value > 0)
    .map((h) => ({
      name: h.symbol as string,
      value: Math.max(1, h.market_value),
      changePct: quoteBy.get(h.symbol as string)?.change_pct ?? 0,
    }));

  const coverage = items.length;
  const total = rows.filter((h) => h.symbol).length;

  return (
    <Card
      title="Holdings heatmap"
      className="h-[calc(100vh-9rem)]"
      action={
        <span className="text-xs text-faint">
          {coverage}/{total} priced holdings · size = position value, colour = daily %
        </span>
      }
    >
      {coverage > 0 ? (
        <Heatmap data={items} />
      ) : (
        <p className="text-muted">No priced holdings yet. Add holdings, then refresh prices.</p>
      )}
      {data?.demo_mode && <p className="text-xs text-accent mt-2">Showing DEMO data.</p>}
    </Card>
  );
}

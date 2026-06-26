import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { Card } from "../components/ui";
import { Heatmap } from "../components/Chart";

export default function HeatmapPage() {
  const { data } = useApi(api.marketsOverview, 60000);

  // Build from all market instruments (defaults + holdings + watchlist):
  // size by |price| (proxy), colour by daily % change.
  const instruments = data?.instruments ?? [];
  const items = instruments
    .filter((i) => i.quote.price !== null)
    .map((i) => ({
      name: i.symbol,
      value: Math.max(1, Math.abs(i.quote.price ?? 1)),
      changePct: i.quote.change_pct ?? 0,
    }));

  const coverage = items.length;
  const total = instruments.length;

  return (
    <Card
      title="Performance heatmap"
      className="h-[calc(100vh-9rem)]"
      action={
        <span className="text-xs text-faint">
          Coverage: {coverage}/{total} priced · size ≈ price, colour = daily %
        </span>
      }
    >
      {coverage > 0 ? (
        <Heatmap data={items} />
      ) : (
        <p className="text-muted">No priced instruments available to render the heatmap.</p>
      )}
      {data?.demo_mode && <p className="text-xs text-accent mt-2">Showing DEMO data.</p>}
    </Card>
  );
}

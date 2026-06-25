import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { Card } from "../components/ui";
import { Heatmap } from "../components/Chart";

export default function HeatmapPage() {
  const { data } = useApi(api.marketsOverview, 60000);
  const wl = useApi(api.watchlists, 60000);

  // Build heatmap from watchlist quotes: size by |price| (proxy), colour by % change.
  const items =
    wl.data?.watchlists.flatMap((l) =>
      l.items
        .filter((i) => i.quote.price !== null)
        .map((i) => ({
          name: i.symbol,
          value: Math.max(1, Math.abs(i.quote.price ?? 1)),
          changePct: i.quote.change_pct ?? 0,
        })),
    ) ?? [];

  const coverage = items.length;
  const total = wl.data?.watchlists.reduce((n, l) => n + l.items.length, 0) ?? 0;

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

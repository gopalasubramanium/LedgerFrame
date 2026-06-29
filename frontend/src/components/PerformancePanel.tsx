import { useState } from "react";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { Card } from "./ui";
import { BenchmarkChart } from "./Chart";
import { pct, toneClass } from "../lib/format";

const PERIODS = [
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
  { label: "5Y", days: 1825 },
];

// Benchmarked performance of the invested portfolio vs an index, with a period
// selector and a row of computed stats (return, vs-benchmark, drawdown, volatility).
export function PerformancePanel({ height = 300, className = "" }: { height?: number; className?: string }) {
  const [p, setP] = useState(3); // 1Y
  const [benchmark, setBenchmark] = useState("SPY");
  const benches = useApi(api.benchmarks, 0);
  const perf = useApi(() => api.performance(PERIODS[p].days, benchmark), 0, [p, benchmark]);
  const holdings = useApi(api.holdings, 0);
  const d = perf.data;
  const stats = d?.stats;
  const hasInvested = (holdings.data?.holdings ?? []).some((h) => h.symbol && h.is_priced);
  const emptyMsg = perf.loading
    ? "Loading…"
    : hasInvested
      ? "Building price history for this view — check back in a moment (or run Settings → Fetch & cache history)."
      : "Add priced holdings to see performance.";

  return (
    <Card
      title="Performance vs benchmark"
      className={className}
      action={
        <div className="flex items-center gap-2">
          <select
            className="touch rounded-card bg-elevated border border-line text-sm px-2 text-muted"
            value={benchmark}
            onChange={(e) => setBenchmark(e.target.value)}
            title="Benchmark"
          >
            {(benches.data?.benchmarks ?? [{ symbol: "SPY", label: "S&P 500" }]).map((b) => (
              <option key={b.symbol} value={b.symbol}>vs {b.label}</option>
            ))}
          </select>
          <div className="flex gap-1">
            {PERIODS.map((per, i) => (
              <button
                key={per.label}
                className={`touch px-3 py-1 rounded-card text-sm ${i === p ? "bg-accent text-base" : "bg-elevated text-muted hover:text-ink"}`}
                onClick={() => setP(i)}
              >
                {per.label}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {d && d.series.length > 1 ? (
        <BenchmarkChart
          x={d.series.map((s) => new Date(s.ts).toLocaleDateString())}
          portfolio={d.series.map((s) => s.value)}
          benchmark={d.benchmark.map((s) => s.value)}
          benchmarkLabel={d.benchmark_symbol}
          height={height}
        />
      ) : (
        <p className="text-muted">{emptyMsg}</p>
      )}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <Metric label={`${PERIODS[p].label} return`} value={pct(stats.return_pct)} tone={stats.return_pct} />
          <Metric label={`vs ${d?.benchmark_symbol}`} value={pct(stats.excess_pct)} tone={stats.excess_pct} />
          <Metric label="Max drawdown" value={pct(stats.max_drawdown_pct)} tone={stats.max_drawdown_pct} />
          <Metric label="Volatility (ann.)" value={`${stats.volatility_pct}%`} tone={null} />
        </div>
      )}
    </Card>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: number | null }) {
  return (
    <div className="bg-base rounded-card px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-faint">{label}</div>
      <div className={`tnum text-lg ${tone === null ? "text-ink" : toneClass(tone)}`}>{value}</div>
    </div>
  );
}

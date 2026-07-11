import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./Portfolio.css";
import {
  AllocationDonut,
  EmptyState,
  PageHeader,
  PriceChart,
  Select,
  StalenessChip,
  Switch,
  TrendStat,
} from "../components/ui";
import type { Segment } from "../mocks/types";
import type { PricePoint } from "../mocks/types";
import { useLabelFor } from "../refdata/refdata-context";
import {
  formatMoney,
  formatSignedMoney,
  formatSignedPercent,
} from "../format/number";
import {
  getAttribution,
  getBenchmarks,
  getCostOfOwnership,
  getPerformance,
  getPortfolioStats,
  getPortfolioSummary,
  getRealisedGains,
  getTagAllocation,
} from "../api/portfolio";
import type {
  AttributionResp,
  Benchmark,
  CostResp,
  MoverRow,
  PerformanceResp,
  PortfolioStats,
  PortfolioSummary,
  RealisedResp,
  StatMetric,
  TagsResp,
} from "../api/portfolio";

// Portfolio (analytics) — IA §5, D-023/D-032/D-033/D-034/D-035/D-048. The canonical home for
// investment analytics; the MANAGEMENT surface is Holdings (cross-linked). Every figure is a
// SERVED display value from a canonical reader — the page performs no money math (P-1/D-031).

// D-030 protected copy — NOT a Sharpe ratio. Verbatim from GLOSSARY ("Return / volatility");
// an exact-match test guards against paraphrase drift (page-portfolio ND-6).
export const NOT_A_SHARPE =
  "Explicitly NOT a Sharpe ratio (no risk-free rate subtracted).";

// Performance windows (page-portfolio ND-10) → server days; YTD computed live.
const WINDOWS = ["1M", "3M", "6M", "YTD", "1Y", "5Y", "Max"];
function windowToDays(w: string): number {
  if (w === "YTD") {
    const now = new Date();
    return Math.max(7, Math.round((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000));
  }
  const base: Record<string, number> = { "1M": 30, "3M": 90, "6M": 180, "1Y": 365, "5Y": 1825, Max: 3650 };
  return base[w] ?? 365;
}

// Find a served metric by its exact served label (D-005 — never invent a label).
function metric(stats: PortfolioStats | null, label: string): StatMetric | undefined {
  return stats?.metrics.find((m) => m.label === label);
}
function metricDisplay(m: StatMetric | undefined): string {
  if (!m || m.value == null) return "—";
  // Round served values for display (the backend may serve raw floats); never a long
  // unbreakable number that overflows a stat tile. No money math — display rounding only.
  if (m.kind === "money") return m.signed ? formatSignedMoney(m.value) : formatMoney(m.value);
  if (m.kind === "pct") return `${Number(m.value).toFixed(2)}%`;
  if (m.kind === "ratio") return Number(m.value).toFixed(2);
  if (m.kind === "count") return String(m.value);
  return String(m.value);
}
function segmentsOf(map: Record<string, number> | undefined): Segment[] {
  return Object.entries(map ?? {}).map(([label, value]) => ({ label, value: String(value) }));
}

export function Portfolio() {
  const labelFor = useLabelFor();
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [stats, setStats] = useState<PortfolioStats | null>(null);
  const [realised, setRealised] = useState<RealisedResp | null>(null);
  const [tags, setTags] = useState<TagsResp | null>(null);
  const [cost, setCost] = useState<CostResp | null>(null);
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [perf, setPerf] = useState<PerformanceResp | null>(null);
  const [attr, setAttr] = useState<AttributionResp | null>(null);

  const [benchmark, setBenchmark] = useState("SPY");
  const [window, setWindow] = useState("1Y");
  const [includeManual, setIncludeManual] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [s, st, r, t, c, b] = await Promise.all([
      getPortfolioSummary(),
      getPortfolioStats(),
      getRealisedGains(),
      getTagAllocation(),
      getCostOfOwnership(),
      getBenchmarks(),
    ]);
    if (s.ok) setSummary(s.data);
    else setError(s.error);
    if (st.ok) setStats(st.data);
    if (r.ok) setRealised(r.data);
    if (t.ok) setTags(t.data);
    if (c.ok) setCost(c.data);
    if (b.ok) setBenchmarks(b.data.benchmarks);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Performance + attribution refetch on window/benchmark/include-manual (server-sliced).
  const days = windowToDays(window);
  useEffect(() => {
    let live = true;
    getPerformance(days, benchmark, includeManual).then((p) => live && setPerf(p.ok ? p.data : null));
    getAttribution(days, benchmark).then((a) => live && setAttr(a.ok ? a.data : null));
    return () => {
      live = false;
    };
  }, [days, benchmark, includeManual]);

  const benchLabel = benchmarks.find((b) => b.symbol === benchmark)?.label ?? benchmark;

  // Comparison chart: both series arrive from the engine as absolute values, the benchmark
  // pre-indexed to the portfolio's start value — plot on a SHARED axis, zero client math.
  const chartSeries = useMemo<PricePoint[]>(
    () => (perf?.series ?? []).map((p) => ({ t: p.ts.slice(0, 10), open: p.value, high: p.value, low: p.value, close: p.value })),
    [perf],
  );
  const chartComparison = useMemo(
    () =>
      perf && perf.benchmark.length === (perf.series?.length ?? -1)
        ? {
            values: perf.benchmark.map((p) => p.value),
            label: benchLabel,
            sublabel: `${benchLabel} — ${benchmark} proxy · price return (excl. dividends)`,
          }
        : undefined,
    [perf, benchLabel, benchmark],
  );

  const liabFootnote =
    summary && summary.liabilities < 0
      ? `Liabilities ${formatMoney(summary.liabilities)} excluded — allocation is of gross assets.`
      : undefined;

  const attribution = attr?.attribution;
  const risk = attr?.risk;

  return (
    <div className="pf">
      <PageHeader
        title="Portfolio"
        subtitle="Investment analytics — manage holdings on Holdings"
        actions={<Link className="lf-btn" to="/holdings">Manage holdings ↗</Link>}
      />

      {loading ? (
        <EmptyState message="Loading…" reason="Fetching from the portfolio analytics readers." />
      ) : error ? (
        <EmptyState
          message="Couldn't load your portfolio"
          reason={`The reader is unreachable (${error}). Values are withheld, never guessed.`}
          action={<button type="button" className="lf-btn" onClick={reload}>Retry</button>}
        />
      ) : (
        <>
          {/* Stat rail (D-032) — served figures only. Net worth is summarised with a link (D-032). */}
          <section className="pf__rail">
            <TrendStat label="Today's change" value={formatSignedMoney(summary?.day_change)} delta={summary?.day_change} />
            <TrendStat label="Unrealised P/L" value={formatSignedMoney(summary?.unrealised_pl)} delta={summary?.unrealised_pl} />
            <RealisedTile realised={realised} />
            <TrendStat label="Cost basis" value={formatMoney(summary?.cost_basis)} />
            <TrendStat label="Total return" value={formatSignedPercent(summary?.total_return_pct)} delta={summary?.total_return_pct} />
            <TrendStat label={metric(stats, "Time-weighted return (TWR)")?.label ?? "Time-weighted return (TWR)"} value={metricDisplay(metric(stats, "Time-weighted return (TWR)"))} />
          </section>
          <p className="pf__netlink">
            Net worth <strong>{formatMoney(summary?.total_value)}</strong> (net of liabilities) — canonical on{" "}
            <Link to="/net-worth">Net worth ↗</Link>
            {summary?.has_stale ? <> · <StalenessChip isStale asOf="" /> {summary.stale_count} stale</> : null}
          </p>

          {/* Performance chart (D-035) — benchmark + window pickers + include-manual toggle. */}
          <section className="pf__card lf-card">
            <div className="pf__cardhead">
              <h2 className="pf__h2">Performance</h2>
              <div className="pf__controls">
                <Select
                  value={benchmark}
                  onChange={setBenchmark}
                  options={benchmarks.map((b) => ({ value: b.symbol, label: b.label }))}
                  aria-label="Benchmark"
                />
                <Select
                  value={window}
                  onChange={setWindow}
                  options={WINDOWS.map((w) => ({ value: w, label: w }))}
                  aria-label="Time window"
                />
                <Switch checked={includeManual} onChange={setIncludeManual} label="Include manual assets" aria-label="Include manual assets" />
              </div>
            </div>
            <div className="lf-card__body">
              {chartSeries.length >= 2 ? (
                <PriceChart
                  series={chartSeries}
                  mode="line"
                  interval={window}
                  comparison={chartComparison}
                  coverageNote={perf?.stats ? undefined : "Not enough history for this window yet — showing what exists."}
                />
              ) : (
                <EmptyState message="Not enough history yet" reason="The performance line needs at least two days of priced history for this window." />
              )}
              <p className="pf__note">
                {includeManual
                  ? "Current holdings — price return (incl. manual assets): today's positions marked to market over the window."
                  : "Current holdings — price return: today's invested positions marked to market over the window (excludes flows, closed positions and manual assets)."}
              </p>
            </div>
          </section>

          {/* Allocation (D-033/D-048) — four donuts; class/currency/sector over GROSS assets. */}
          <section className="pf__card lf-card">
            <h2 className="pf__h2">Allocation</h2>
            <div className="lf-card__body pf__donuts">
              <DonutBlock title="By class" segments={segmentsOf(summary?.allocation_by_class)} footnote={liabFootnote} />
              <DonutBlock title="By sector" segments={segmentsOf(summary?.allocation_by_sector)} footnote={liabFootnote} />
              <DonutBlock title="By currency" segments={segmentsOf(summary?.allocation_by_currency)} footnote={liabFootnote} />
              <DonutBlock
                title="By tag"
                segments={(tags?.tags ?? []).map((t) => ({ label: t.tag, value: String(t.value) }))}
                emptyReason="No tags yet — add tags to holdings to see this breakdown."
              />
            </div>
          </section>

          {/* Contributors / Detractors — today (D-024/D-034). Never "Gainers/Losers". */}
          <section className="pf__card lf-card">
            <h2 className="pf__h2">Contributors &amp; detractors — today</h2>
            <div className="lf-card__body pf__movers">
              <MoverList title="Contributors — today" rows={summary?.top_gainers ?? []} emptyReason="Nothing gained today." />
              <MoverList title="Detractors — today" rows={summary?.top_losers ?? []} emptyReason="Nothing declined today." />
            </div>
          </section>

          {/* Concentration (D-029) — distinct figures; HHI from attribution.risk (ND-5). */}
          <section className="pf__card lf-card">
            <h2 className="pf__h2">Concentration</h2>
            <div className="lf-card__body pf__rail pf__rail--tight">
              {(stats?.metrics.filter((m) => m.term_id === "term-concentration") ?? []).map((m) => (
                <TrendStat key={m.label} label={m.label} value={metricDisplay(m)} />
              ))}
              <TrendStat label="HHI" value={risk?.available && risk.hhi != null ? Number(risk.hhi).toFixed(4) : "—"} />
            </div>
          </section>

          {/* Return / volatility — NOT a Sharpe ratio (D-030 protected copy). */}
          <section className="pf__card lf-card">
            <h2 className="pf__h2">Risk &amp; return</h2>
            <div className="lf-card__body">
              <div className="pf__rail pf__rail--tight">
                <TrendStat label="1Y return" value={metricDisplay(metric(stats, "1Y return"))} />
                <TrendStat label="1Y volatility" value={metricDisplay(metric(stats, "1Y volatility"))} />
                <TrendStat label="Return / volatility" value={metricDisplay(metric(stats, "Return / volatility"))} />
                <TrendStat label="Max drawdown (1Y)" value={metricDisplay(metric(stats, "Max drawdown (1Y)"))} />
              </div>
              <p className="pf__note">{NOT_A_SHARPE}</p>
            </div>
          </section>

          {/* Attribution — per-holding contribution + explicit residual row (D-034/GLOSSARY). */}
          <section className="pf__card lf-card">
            <h2 className="pf__h2">Return attribution</h2>
            <div className="lf-card__body">
              {attribution?.available ? (
                <>
                  <div className="pf__scroll">
                  <table className="pf__attr">
                    <thead>
                      <tr>
                        <th scope="col">Holding</th>
                        <th scope="col">Class</th>
                        <th scope="col" className="pf__num">Contribution</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(attribution.holdings ?? []).map((h) => (
                        <tr key={h.holding_id}>
                          <td>{h.symbol ? <Link to={`/instrument/${encodeURIComponent(h.symbol)}`}>{h.label}</Link> : h.label}</td>
                          <td>{h.asset_class ? labelFor("asset_class", h.asset_class) : "—"}</td>
                          <td className="pf__num">{formatSignedPercent(h.contribution_pct)}</td>
                        </tr>
                      ))}
                      <tr className="pf__residual">
                        <td>Residual (income, realised, closed)</td>
                        <td>—</td>
                        <td className="pf__num">{formatSignedPercent(attribution.residual_pct)}</td>
                      </tr>
                      <tr className="pf__headline">
                        <td>Headline return</td>
                        <td>—</td>
                        <td className="pf__num">{formatSignedPercent(attribution.headline_return_pct)}</td>
                      </tr>
                    </tbody>
                  </table>
                  </div>
                  <p className="pf__note">Single-period approximation — sub-holdings + residual reconcile to the headline.</p>
                </>
              ) : (
                <EmptyState message="Attribution unavailable" reason={attribution?.reason ?? "Not enough priced history to attribute return honestly."} />
              )}
            </div>
          </section>

          {/* Costs (D-048) — recorded fees vs ongoing cost, TWO blocks, never blended. */}
          <section className="pf__card lf-card">
            <div className="pf__cardhead">
              <h2 className="pf__h2">Costs</h2>
              <Link className="pf__link" to="/reports">Reports ↗</Link>
            </div>
            <div className="lf-card__body pf__costs">
              <div className="pf__costblock lf-card__body">
                <h3 className="pf__h3">Recorded fees</h3>
                <p className="pf__costnum">{formatMoney(cost?.recorded_fees.total)}</p>
                <p className="pf__note">{cost?.recorded_fees.label ?? "Fees charged in the ledger."}</p>
              </div>
              <div className="pf__costblock lf-card__body">
                <h3 className="pf__h3">Ongoing cost (expense ratio)</h3>
                {cost?.estimated_ongoing_cost.available ? (
                  <p className="pf__costnum">{formatMoney(cost.estimated_ongoing_cost.estimated_annual_total)} / yr</p>
                ) : (
                  <p className="pf__costnum pf__muted">—</p>
                )}
                <p className="pf__note">{cost?.estimated_ongoing_cost.coverage_label ?? "Estimated from each instrument's expense ratio."}</p>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function RealisedTile({ realised }: { realised: RealisedResp | null }) {
  // ND-12: label with the SERVED report year (never "YTD"); link to the full report.
  const label = realised ? `Realised P/L · ${realised.year}` : "Realised P/L";
  const value = realised ? formatSignedMoney(realised.base_realised_total_current_fx) : "—";
  return (
    <div className="pf__railtile">
      <TrendStat label={label} value={value} delta={realised?.base_realised_total_current_fx} />
      <Link className="pf__tilelink" to="/reports">Report ↗</Link>
    </div>
  );
}

function DonutBlock({
  title,
  segments,
  footnote,
  emptyReason,
}: {
  title: string;
  segments: Segment[];
  footnote?: string;
  emptyReason?: string;
}) {
  return (
    <div className="pf__donut">
      <h3 className="pf__h3">{title}</h3>
      {segments.length > 0 ? (
        <AllocationDonut segments={segments} footnote={footnote} aria-label={title} />
      ) : (
        <EmptyState message="Nothing to show" reason={emptyReason ?? "No allocation data."} />
      )}
    </div>
  );
}

function MoverList({ title, rows, emptyReason }: { title: string; rows: MoverRow[]; emptyReason: string }) {
  return (
    <div className="pf__moverlist">
      <h3 className="pf__h3">{title}</h3>
      {rows.length > 0 ? (
        <ul className="pf__moverrows">
          {rows.map((r) => (
            <li key={r.id} className="pf__moverrow">
              <span className="pf__moversym">
                {r.symbol ? <Link to={`/instrument/${encodeURIComponent(r.symbol)}`}>{r.symbol}</Link> : r.label}
              </span>
              <span className={`pf__moverval ${Number(r.day_change ?? 0) >= 0 ? "pf__up" : "pf__down"}`}>
                {formatSignedMoney(r.day_change)}
                {r.day_change_pct != null ? ` (${formatSignedPercent(r.day_change_pct)})` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState message="Nothing here" reason={emptyReason} />
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import "./Portfolio.css";
import { InstrumentLabel } from "../components/InstrumentLabel";
import {
  AllocationDonut,
  DataTable,
  EmptyState,
  PageHeader,
  PriceChart,
  Select,
  Skeleton,
  StalenessChip,
  Switch,
  TrendStat,
  SummaryHead,
  SummaryLink,
} from "../components/ui";
import type { Column, SortState } from "../components/ui";
import type { Segment } from "../mocks/types";
import type { PricePoint } from "../mocks/types";
import { useLabelFor } from "../refdata/refdata-context";
import { Rows4 } from "../icons";
import { apiDownload } from "../api/client";
import {
  formatMoney,
  formatPrice,
  formatSignedMoney,
  formatSignedPercent,
  signOf,
} from "../format/number";
import { metric, metricDisplay, metricTone } from "../format/metrics";
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
  AttributionHolding,
  AttributionResp,
  Benchmark,
  CostResp,
  MoverRow,
  PerformanceResp,
  PortfolioStats,
  PortfolioSummary,
  RealisedResp,
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

function segmentsOf(map: Record<string, number> | undefined): Segment[] {
  return Object.entries(map ?? {}).map(([label, value]) => ({ label, value: String(value) }));
}
// Map raw served keys → SERVED display labels (D-005 + copy hygiene, §12-3). Never render an
// internal enum key (`fixed_deposit`, `equity`, …) in a legend — same source as Holdings' chips.
function labeledSegments(map: Record<string, number> | undefined, labelFn: (k: string) => string): Segment[] {
  return Object.entries(map ?? {}).map(([k, value]) => ({ label: labelFn(k), value: String(value) }));
}
// D-082 (§12-4/§12-1): the "Unclassified sector" bucket carries an explanation tooltip so the
// truth is legible — non-equity holdings have no sector, this is not a pending state.
const UNCLASSIFIED_NOTE = "Non-equity holdings (property, cash, deposits) have no sector — not pending.";
function sectorSegments(map: Record<string, number> | undefined): Segment[] {
  return Object.entries(map ?? {}).map(([label, value]) => ({
    label,
    value: String(value),
    note: label === "Unclassified sector" ? UNCLASSIFIED_NOTE : undefined,
  }));
}

export function Portfolio() {
  const labelFor = useLabelFor();
  // Per-card progressive loading (§12-8): `undefined` = still loading (show a Skeleton),
  // `null` = the reader failed (honest error), a value = loaded. Cards resolve independently.
  const [summary, setSummary] = useState<PortfolioSummary | null>();
  const [stats, setStats] = useState<PortfolioStats | null>();
  const [realised, setRealised] = useState<RealisedResp | null>();
  const [tags, setTags] = useState<TagsResp | null>();
  const [cost, setCost] = useState<CostResp | null>();
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [perf, setPerf] = useState<PerformanceResp | null>();
  const [attr, setAttr] = useState<AttributionResp | null>();

  const [benchmark, setBenchmark] = useState("SPY");
  const [window, setWindow] = useState("1Y");
  const [includeManual, setIncludeManual] = useState(false);

  // Return-attribution table: client-side sort + filter (bounded dataset), like Holdings (§12-6).
  const [attrSort, setAttrSort] = useState<SortState>({ key: "contribution_pct", dir: "desc" });
  const [attrFilter, setAttrFilter] = useState("");

  const reload = useCallback(() => {
    // Fire each reader independently → every card resolves on its own (no full-page block on the
    // slowest reader, §12-8). Reset to `undefined` (loading) first so a re-load re-skeletons.
    setSummary(undefined);
    setStats(undefined);
    setRealised(undefined);
    setTags(undefined);
    setCost(undefined);
    getPortfolioSummary().then((s) => setSummary(s.ok ? s.data : null));
    getPortfolioStats().then((s) => setStats(s.ok ? s.data : null));
    getRealisedGains().then((r) => setRealised(r.ok ? r.data : null));
    getTagAllocation().then((t) => setTags(t.ok ? t.data : null));
    getCostOfOwnership().then((c) => setCost(c.ok ? c.data : null));
    getBenchmarks().then((b) => b.ok && setBenchmarks(b.data.benchmarks));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Performance + attribution refetch on window/benchmark/include-manual (server-sliced).
  const days = windowToDays(window);
  useEffect(() => {
    let live = true;
    setPerf(undefined); // re-skeleton the chart/attribution cards while the new slice loads
    setAttr(undefined);
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

  // Client-side filter + sort of the per-holding attribution rows (bounded set, §12-6).
  const attrRows = useMemo<AttributionHolding[]>(() => {
    const rows = attribution?.holdings ?? [];
    const q = attrFilter.trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) => [r.label, r.symbol, r.asset_class, r.sector].some((v) => (v ?? "").toLowerCase().includes(q)))
      : rows;
    const dir = attrSort.dir === "asc" ? 1 : -1;
    const key = attrSort.key as keyof AttributionHolding;
    return [...filtered].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
    });
  }, [attribution, attrSort, attrFilter]);

  const attrColumns: Column<AttributionHolding>[] = [
    { key: "label", label: "Holding", sortable: true, render: (h) => <InstrumentLabel symbol={h.symbol} name={h.name} fallback={h.label} truncate /> },
    { key: "asset_class", label: "Class", sortable: true, render: (h) => (h.asset_class ? labelFor("asset_class", h.asset_class) : "—") },
    { key: "sector", label: "Sector", sortable: true, render: (h) => h.sector ?? "—" },
    { key: "contribution_pct", label: "Contribution", align: "right", format: "signed-percent", sortable: true },
  ];

  return (
    <div className="lf-page pf">
      <PageHeader
        title="Portfolio"
        subtitle="Investment analytics — manage holdings on Holdings"
        actions={
          <Link className="lf-iconbtn lf-iconbtn--framed" to="/holdings" title="Manage holdings" aria-label="Manage holdings">
            <Rows4 aria-hidden="true" />
          </Link>
        }
      />

      {/* Per-card progressive loading (§12-8): each card resolves independently —
          Skeleton while its reader loads, then data / EmptyState / honest error. */}

      {/* Stat rail (D-032) + Net worth summary — driven by the summary reader. */}
      <CardBody data={summary} lines={2} onRetry={reload}>
        {(s) => (
          <>
            <section className="pf__rail" data-card="rail">
              {/* §14in-7 — base-currency affix on the MONEY tiles (served base_currency); %/metric tiles carry none. */}
              <TrendStat label="Today's change" value={formatSignedMoney(s.day_change)} tone={signOf(s.day_change)} unit={s.base_currency} />
              <TrendStat label="Unrealised P/L" value={formatSignedMoney(s.unrealised_pl)} tone={signOf(s.unrealised_pl)} unit={s.base_currency} />
              <RealisedTile realised={realised} base={s.base_currency} />
              <TrendStat label="Cost basis" value={formatMoney(s.cost_basis)} unit={s.base_currency} />
              <TrendStat label="Total return" value={formatSignedPercent(s.total_return_pct)} tone={signOf(s.total_return_pct)} />
              <TrendStat label="Time-weighted return (TWR)" value={metricDisplay(metric(stats, "Time-weighted return (TWR)"))} />
            </section>
            <p className="pf__netlink">
              Net worth <strong>{formatMoney(s.total_value)}</strong> (net of liabilities) — canonical on{" "}
              <Link to="/net-worth">Net worth ↗</Link>
              {s.has_stale ? <> · <StalenessChip isStale asOf="" /> {s.stale_count} stale</> : null}
            </p>
            {/* §12-R2 (F-3 EXCLUSIONS ARE LOUD): the cost basis carries a SERVED annotation (D-105,
                rendered verbatim) when lots are excluded for want of a trade-date rate — so an
                incomplete basis (and the total-return denominator it feeds) is never shown as fact. */}
            {s.cost_basis_note && <p className="pf__note pf__note--warn">{s.cost_basis_note}</p>}
          </>
        )}
      </CardBody>

      {/* Performance chart (D-035) — controls always visible; body loads on its own reader. */}
      <section className="pf__card lf-card" data-card="performance">
        <div className="pf__cardhead">
          <h2 className="pf__h2">Performance</h2>
          <div className="pf__controls">
            <Select value={benchmark} onChange={setBenchmark} options={benchmarks.map((b) => ({ value: b.symbol, label: b.label }))} aria-label="Benchmark" />
            <Select value={window} onChange={setWindow} options={WINDOWS.map((w) => ({ value: w, label: w }))} aria-label="Time window" />
            <Switch checked={includeManual} onChange={setIncludeManual} label="Include manual assets" aria-label="Include manual assets" />
          </div>
        </div>
        <div className="lf-card__body">
          <CardBody data={perf} block onRetry={reload}>
            {() => (
              <>
                {chartSeries.length >= 2 ? (
                  <PriceChart series={chartSeries} mode="line" interval={window} comparison={chartComparison}
                    coverageNote={perf?.stats ? undefined : "Not enough history for this window yet — showing what exists."} />
                ) : (
                  <EmptyState message="Not enough history yet" reason="The performance line needs at least two days of priced history for this window." />
                )}
                <p className="pf__note">
                  {includeManual
                    ? "Current holdings — price return (incl. manual assets): today's positions marked to market over the window."
                    : "Current holdings — price return: today's invested positions marked to market over the window (excludes flows, closed positions and manual assets)."}
                </p>
              </>
            )}
          </CardBody>
        </div>
      </section>

      {/* Allocation (D-033/D-048) — driven by the summary reader; footnote once (§12-4). */}
      <section className="pf__card lf-card" data-card="allocation">
        <h2 className="pf__h2">Allocation</h2>
        <div className="lf-card__body">
          <CardBody data={summary} block onRetry={reload}>
            {(s) => (
              <>
                <div className="pf__donuts">
                  <DonutBlock title="By class" marker={liabFootnote ? "*" : undefined} segments={labeledSegments(s.allocation_by_class, (k) => labelFor("asset_class", k))} />
                  <DonutBlock title="By sector" marker={liabFootnote ? "*" : undefined} segments={sectorSegments(s.allocation_by_sector)} />
                  <DonutBlock title="By currency" marker={liabFootnote ? "*" : undefined} segments={segmentsOf(s.allocation_by_currency)} />
                  <DonutBlock title="By tag"
                    segments={(tags?.tags ?? []).map((t) => ({ label: t.tag, value: String(t.value) }))}
                    emptyReason="No tags yet — add tags to holdings to see this breakdown." />
                </div>
                {liabFootnote && <p className="pf__note">* {liabFootnote}</p>}
              </>
            )}
          </CardBody>
        </div>
      </section>

      {/* Contributors / Detractors — today (D-024/D-034). Never "Gainers/Losers". */}
      <section className="pf__card lf-card" data-card="movers">
        <h2 className="pf__h2">Contributors &amp; detractors — today</h2>
        <div className="lf-card__body">
          <CardBody data={summary} onRetry={reload}>
            {(s) => (
              <div className="pf__movers">
                <MoverList title="Contributors — today" rows={s.top_gainers} emptyReason="Nothing gained today." />
                <MoverList title="Detractors — today" rows={s.top_losers} emptyReason="Nothing declined today." />
              </div>
            )}
          </CardBody>
        </div>
      </section>

      {/* Concentration (D-029) — distinct figures; HHI from attribution.risk (ND-5). */}
      <section className="pf__card lf-card" data-card="concentration">
        <h2 className="pf__h2">Concentration</h2>
        <div className="lf-card__body">
          <CardBody data={stats} onRetry={reload}>
            {(st) => (
              <div className="pf__rail pf__rail--tight">
                {st.metrics.filter((m) => m.term_id === "term-concentration").map((m) => (
                  <TrendStat key={m.label} label={m.label} value={metricDisplay(m)} />
                ))}
                <TrendStat label="HHI" value={risk?.available && risk.hhi != null ? Number(risk.hhi).toFixed(4) : "—"} />
              </div>
            )}
          </CardBody>
        </div>
      </section>

      {/* Return / volatility — NOT a Sharpe ratio (D-030 protected copy). */}
      <section className="pf__card lf-card" data-card="risk">
        <h2 className="pf__h2">Risk &amp; return</h2>
        <div className="lf-card__body">
          <CardBody data={stats} onRetry={reload}>
            {(st) => {
              // §12b4-4: signed metrics take gain/loss tone; volatility is a magnitude → neutral.
              const ret1y = metric(st, "1Y return");
              const vol1y = metric(st, "1Y volatility");
              const retVol = metric(st, "Return / volatility");
              const maxDd = metric(st, "Max drawdown (1Y)");
              // §12-R1 (F-2 REFUSE-UNTIL-COVERAGE): these are date-aware (reconstructed-history)
              // metrics. When the window isn't covered the backend serves value=null + a served
              // refusal note — render it verbatim (never a fabricated −99.93%), never the number.
              const daRefusal = ret1y && ret1y.value == null ? ret1y.note : null;
              return (
              <>
                <div className="pf__rail pf__rail--tight">
                  <TrendStat label="1Y return" value={metricDisplay(ret1y)} tone={metricTone(ret1y)} />
                  <TrendStat label="1Y volatility" value={metricDisplay(vol1y)} />
                  <TrendStat label="Return / volatility" value={metricDisplay(retVol)} tone={metricTone(retVol)} />
                  <TrendStat label="Max drawdown (1Y)" value={metricDisplay(maxDd)} tone={metricTone(maxDd)} />
                </div>
                {daRefusal
                  ? <p className="pf__note pf__note--warn" data-testid="da-refusal">{daRefusal}</p>
                  : <p className="pf__note">Basis: date-aware (per-date reconstructed history).</p>}
                <p className="pf__note">{NOT_A_SHARPE}</p>
              </>
              );
            }}
          </CardBody>
        </div>
      </section>

      {/* Attribution — DataTable (sort/filter/export) + reconciling residual + headline. */}
      <section className="pf__card lf-card" data-card="attribution">
        <h2 className="pf__h2">Return attribution</h2>
        <div className="lf-card__body">
          <CardBody data={attr} lines={5} onRetry={reload}>
            {(a) =>
              a.attribution.available ? (
                <>
                  <DataTable
                    columns={attrColumns}
                    rows={attrRows}
                    sort={attrSort}
                    onSort={(key) => setAttrSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }))}
                    filter={{ value: attrFilter, onChange: setAttrFilter, placeholder: "Filter holdings…", ariaLabel: "Filter attribution" }}
                    onExport={() => apiDownload(`/portfolio/attribution.csv?days=${days}`)}
                    stickyHeader
                    caption="Return attribution by holding"
                  />
                  <dl className="pf__attrsummary">
                    <div className="pf__attrsumrow">
                      <dt>Residual (income, realised, closed)</dt>
                      <dd className="pf__num">{formatSignedPercent(a.attribution.residual_pct)}</dd>
                    </div>
                    <div className="pf__attrsumrow pf__attrsumrow--headline">
                      <dt>Headline return</dt>
                      <dd className="pf__num">{formatSignedPercent(a.attribution.headline_return_pct)}</dd>
                    </div>
                  </dl>
                  <p className="pf__note">Single-period approximation — sub-holdings + residual reconcile to the headline.</p>
                </>
              ) : (
                <EmptyState message="Attribution unavailable" reason={a.attribution.reason ?? "Not enough priced history to attribute return honestly."} />
              )
            }
          </CardBody>
        </div>
      </section>

      {/* Costs (D-048) — recorded fees vs ongoing cost, TWO blocks, never blended. */}
      <section className="pf__card lf-card" data-card="costs">
        <SummaryHead title="Costs" to="/reports" destination="Reports" whole />
        <div className="lf-card__body">
          <CardBody data={cost} lines={3} onRetry={reload}>
            {(c) => (
              <div className="pf__costs">
                <div className="pf__costblock lf-card__body">
                  <h3 className="pf__h3">Recorded fees</h3>
                  {/* §14in-7 — base-currency affix (served base_currency), the one muted form. */}
                  <p className="pf__costnum">{formatMoney(c.recorded_fees.total)}<span className="lf-stat__unit">{c.base_currency}</span></p>
                  <p className="pf__note">{c.recorded_fees.label}</p>
                </div>
                <div className="pf__costblock lf-card__body">
                  <h3 className="pf__h3">Ongoing cost (expense ratio)</h3>
                  {c.estimated_ongoing_cost.available ? (
                    <p className="pf__costnum">{formatMoney(c.estimated_ongoing_cost.estimated_annual_total)}<span className="lf-stat__unit">{c.base_currency}</span> / yr</p>
                  ) : (
                    <p className="pf__costnum pf__muted">—</p>
                  )}
                  <p className="pf__note">{c.estimated_ongoing_cost.coverage_label}</p>
                </div>
              </div>
            )}
          </CardBody>
        </div>
      </section>
    </div>
  );
}

function RealisedTile({ realised, base }: { realised: RealisedResp | null | undefined; base: string }) {
  // ND-12: label with the SERVED report year (never "YTD"); link to the full report.
  const label = realised ? `Realised P/L · ${realised.year}` : "Realised P/L";
  const value = realised ? formatSignedMoney(realised.base_realised_total_current_fx) : "—";
  return (
    <div className="pf__railtile">
      <TrendStat label={label} value={value} unit={base} tone={realised ? signOf(realised.base_realised_total_current_fx) : undefined} />
      {/* D-100 header-arrow, inside the tile, to the full report on Reports. */}
      <SummaryLink to="/reports" destination="Realised P/L report" />
    </div>
  );
}

function DonutBlock({
  title,
  segments,
  marker,
  emptyReason,
}: {
  title: string;
  segments: Segment[];
  marker?: string;
  emptyReason?: string;
}) {
  return (
    <div className="pf__donut">
      <h3 className="pf__h3">
        {title}
        {marker ? <sup className="pf__marker">{marker}</sup> : null}
      </h3>
      {segments.length > 0 ? (
        <AllocationDonut segments={segments} aria-label={title} />
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
                <InstrumentLabel symbol={r.symbol} name={r.name} fallback={r.label} truncate />
              </span>
              <span className="pf__moverright">
                {r.price != null && (
                  <span className="pf__moverprice">{r.currency ? `${r.currency} ` : ""}{formatPrice(r.price)}</span>
                )}
                <span className={`pf__moverval ${Number(r.day_change ?? 0) >= 0 ? "pf__up" : "pf__down"}`}>
                  {formatSignedMoney(r.day_change)}
                  {r.day_change_pct != null ? ` (${formatSignedPercent(r.day_change_pct)})` : ""}
                </span>
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

// Per-card loading wrapper (§12-8): `undefined` → Skeleton, `null` → honest error (+ retry),
// value → the card content. Overview cards each resolve on their own reader — no full-page block.
function CardBody<T>({
  data,
  lines = 4,
  block = false,
  onRetry,
  children,
}: {
  data: T | null | undefined;
  lines?: number;
  block?: boolean;
  onRetry?: () => void;
  children: (d: T) => ReactNode;
}) {
  if (data === undefined) return <Skeleton lines={lines} block={block} />;
  if (data === null)
    return (
      <EmptyState
        message="Couldn't load this section"
        reason="We couldn't reach the source of these figures — they're held back rather than guessed."
        action={onRetry ? <button type="button" className="lf-btn" onClick={onRetry}>Retry</button> : undefined}
      />
    );
  return <>{children(data)}</>;
}

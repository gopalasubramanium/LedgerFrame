import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import "./NetWorth.css";
import {
  DataTable,
  EmptyState,
  PageHeader,
  PriceChart,
  ReviewCard,
  Select,
  Skeleton,
  Sparkline,
  StalenessChip,
  TrendStat,
} from "../components/ui";
import type { Column, ReviewSection, Verdict } from "../components/ui";
import type { PricePoint } from "../mocks/types";
import { useLabelFor } from "../refdata/refdata-context";
import { LineChart } from "../icons";
import { formatMoney, formatSignedMoney, formatSignedPercent, signOf } from "../format/number";
import { metric, metricDisplay, metricTone } from "../format/metrics";
import { getPerformance, getPortfolioStats, getPortfolioSummary } from "../api/portfolio";
import type { PortfolioStats, PortfolioSummary, PerformanceResp } from "../api/portfolio";
import {
  getInsurance,
  getLiquidity,
  getNetWorthHistory,
  getNetWorthStatement,
  getReview,
  getRunway,
} from "../api/net-worth";
import type {
  InsuranceResp,
  LiquidityResp,
  NetWorthHistoryResp,
  ReviewResp,
  RunwayResp,
  StatementResp,
  StatementRow,
} from "../api/net-worth";

// Net worth (overview) — IA §5, D-032/D-033/D-036/D-039/D-054. The canonical home for the one
// headline total (Gross assets − Liabilities), its trend, the liquidity ladder, and cash runway.
// Analytics live on Portfolio (D-023). Every figure is a SERVED display value — no money math.

// Trend windows (page-net-worth ND-2): the ratified set minus intraday; default Max while young.
// Windowing is a FRONTEND DISPLAY SLICE of the served series (no param, no math).
const WINDOWS = ["1M", "3M", "6M", "YTD", "1Y", "5Y", "Max"];
function windowCutoff(w: string): Date | null {
  if (w === "Max") return null;
  const now = new Date();
  if (w === "YTD") return new Date(now.getFullYear(), 0, 1);
  const days: Record<string, number> = { "1M": 30, "3M": 90, "6M": 180, "1Y": 365, "5Y": 1825 };
  return new Date(now.getTime() - (days[w] ?? 3650) * 86400000);
}

// Basis label for the runway card (ND-9) — the engine's honest basis, stated next to the figure.
const RUNWAY_BASIS =
  "Basis: liquid assets ÷ recurring monthly net burn (recurring expenses − income), at today's FX; one-off obligations excluded.";

function reviewVerdict(severity: string): Verdict {
  if (severity === "review") return "attention";
  if (severity === "info") return "info";
  return "ok";
}

export function NetWorth() {
  const labelFor = useLabelFor();
  // Per-card progressive loading (overview standard): `undefined` = loading (Skeleton),
  // `null` = reader failed (honest error), value = loaded. Cards resolve independently.
  const [summary, setSummary] = useState<PortfolioSummary | null>();
  const [history, setHistory] = useState<NetWorthHistoryResp | null>();
  const [statement, setStatement] = useState<StatementResp | null>();
  const [liquidity, setLiquidity] = useState<LiquidityResp | null>();
  const [runway, setRunway] = useState<RunwayResp | null>();
  const [insurance, setInsurance] = useState<InsuranceResp | null>();
  const [review, setReview] = useState<ReviewResp | null>();
  const [perf, setPerf] = useState<PerformanceResp | null>();
  const [stats, setStats] = useState<PortfolioStats | null>();

  const [window, setWindow] = useState("Max");

  const reload = useCallback(() => {
    setSummary(undefined);
    setHistory(undefined);
    setStatement(undefined);
    setLiquidity(undefined);
    setRunway(undefined);
    setInsurance(undefined);
    setReview(undefined);
    getPortfolioSummary().then((r) => setSummary(r.ok ? r.data : null));
    getNetWorthHistory().then((r) => setHistory(r.ok ? r.data : null));
    getNetWorthStatement().then((r) => setStatement(r.ok ? r.data : null));
    getLiquidity().then((r) => setLiquidity(r.ok ? r.data : null));
    getRunway().then((r) => setRunway(r.ok ? r.data : null));
    getInsurance().then((r) => setInsurance(r.ok ? r.data : null));
    getReview().then((r) => setReview(r.ok ? r.data : null));
    getPerformance(365, "SPY", false).then((r) => setPerf(r.ok ? r.data : null));
    getPortfolioStats().then((r) => setStats(r.ok ? r.data : null));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Trend chart: single series (net_worth), sliced to the window on the client (display only).
  const trendPoints = useMemo<PricePoint[]>(() => {
    const cutoff = windowCutoff(window);
    return (history?.history ?? [])
      .filter((p) => !cutoff || new Date(p.ts) >= cutoff)
      .map((p) => ({ t: p.ts.slice(0, 10), open: p.net_worth, high: p.net_worth, low: p.net_worth, close: p.net_worth }));
  }, [history, window]);

  const statementColumns: Column<StatementRow>[] = [
    { key: "asset_class", label: "Class", render: (r) => labelFor("asset_class", r.asset_class) },
    { key: "value", label: "Value", align: "right", render: (r) => formatMoney(r.value) },
  ];

  const reviewSections: ReviewSection[] = (review?.items ?? []).map((i) => ({
    label: i.title,
    verdict: reviewVerdict(i.severity),
    detail: i.area,
  }));

  const sparkPoints = (perf?.series ?? []).map((p) => p.value);

  return (
    <div className="nw">
      <PageHeader
        title="Net worth"
        subtitle="Your headline & liquidity — investment analytics on Portfolio"
        actions={
          <Link className="lf-iconbtn lf-iconbtn--framed" to="/portfolio" title="Portfolio analytics" aria-label="Portfolio analytics">
            <LineChart aria-hidden="true" />
          </Link>
        }
      />

      {/* KPI strip (D-054) — equal-geometry tiles from the grid (no wrapper resizes a tile, §12b4-1). */}
      <CardBody data={summary} lines={2} onRetry={reload}>
        {(s) => (
          <>
            <section className="nw__kpis" data-card="kpis">
              <TrendStat label="Net worth" value={formatMoney(s.total_value)} />
              <TrendStat label="Gross assets" value={formatMoney(s.gross_assets)} />
              <TrendStat label="Liabilities" value={formatMoney(s.liabilities)} />
              <TrendStat label="Cash & deposits" value={formatMoney(s.cash_and_deposits)} />
            </section>
            <p className="nw__note">
              Net worth = Gross assets − Liabilities (GLOSSARY).
              {s.has_stale ? <> · <StalenessChip isStale asOf="" /> {s.stale_count} stale</> : null}
            </p>
          </>
        )}
      </CardBody>

      {/* Net-worth trend (D-032/D-086) — single series; honest EmptyState when history is thin (ND-1). */}
      <section className="nw__card lf-card" data-card="trend">
        <div className="nw__cardhead">
          <h2 className="nw__h2">Net-worth trend</h2>
          <Select value={window} onChange={setWindow} options={WINDOWS.map((w) => ({ value: w, label: w }))} aria-label="Time window" />
        </div>
        <div className="lf-card__body">
          <CardBody data={history} block onRetry={reload}>
            {() =>
              trendPoints.length >= 2 ? (
                <PriceChart series={trendPoints} mode="line" interval={window}
                  coverageNote={trendPoints.length < 8 ? "History is short — the trend fills in as the appliance runs." : undefined} />
              ) : (
                <EmptyState message="Not enough history yet"
                  reason="Net-worth history accumulates as the appliance runs — the trend appears once at least two snapshots exist." />
              )
            }
          </CardBody>
        </div>
      </section>

      {/* Composition statement (D-033) — signed, INCLUDES liabilities, reconciles to the headline.
          This is the STATEMENT, deliberately NOT Portfolio's allocation weight. No donut (D-054). */}
      <section className="nw__card lf-card" data-card="statement">
        <h2 className="nw__h2">Composition by class</h2>
        <div className="lf-card__body">
          <CardBody data={statement} lines={5} onRetry={reload}>
            {(st) => (
              <>
                {/* Totals are <tfoot> rows of the SAME table (§12b1-2) so the Value column stays
                    x-aligned with the body — never offset by the scroll gutter. */}
                <DataTable
                  columns={statementColumns}
                  rows={st.rows}
                  caption="Net-worth statement by asset class"
                  stickyHeader
                  footer={[
                    { key: "gross", cells: { asset_class: "Gross assets", value: formatMoney(st.gross_assets) } },
                    { key: "liab", cells: { asset_class: "Liabilities", value: formatMoney(st.liabilities) } },
                    { key: "net", cells: { asset_class: "Net worth", value: formatMoney(st.net_worth) }, emphasis: true },
                  ]}
                />
                <p className="nw__note">A balance statement (assets and liabilities), not an allocation weight — allocation lives on <Link to="/portfolio">Portfolio</Link>.</p>
              </>
            )}
          </CardBody>
        </div>
      </section>

      {/* Liquidity ladder (D-036) — time-to-cash rungs; Liquid = Immediate + Short. */}
      <section className="nw__card lf-card" data-card="liquidity">
        <h2 className="nw__h2">Liquidity ladder</h2>
        <div className="lf-card__body">
          <CardBody data={liquidity} lines={4} onRetry={reload}>
            {(l) =>
              (l.rungs ?? []).length > 0 ? (
                <>
                  <DataTable
                    columns={[
                      { key: "label", label: "Rung", render: (r: LiquidityResp["rungs"][number]) => r.label },
                      { key: "value", label: "Value", align: "right", render: (r) => formatMoney(r.value) },
                      { key: "pct", label: "Share", align: "right", render: (r) => `${r.pct.toFixed(1)}%` },
                      { key: "cumulative_pct", label: "Cumulative", align: "right", render: (r) => `${r.cumulative_pct.toFixed(1)}%` },
                    ]}
                    rows={l.rungs}
                    caption="Liquidity ladder"
                    stickyHeader
                  />
                  <p className="nw__note">Liquid (Immediate + Short) = {l.liquid_pct.toFixed(1)}% of gross assets. {l.disclaimer}</p>
                </>
              ) : (
                <EmptyState message="Nothing to show" reason="No positive-value holdings to grade by liquidity." />
              )
            }
          </CardBody>
        </div>
      </section>

      {/* Cash runway (D-036/D-057) — honest no_data / positive / finite states, basis labelled (ND-9). */}
      <section className="nw__card lf-card" data-card="runway">
        <h2 className="nw__h2">Cash runway</h2>
        <div className="lf-card__body">
          <CardBody data={runway} lines={3} onRetry={reload}>
            {(r) => (
              <div className="nw__runway">
                {r.status === "finite" ? (
                  <TrendStat label="Cash runway" value={r.runway_months != null ? String(r.runway_months) : "—"} unit=" months" />
                ) : (
                  <TrendStat label="Cash runway" value={r.status === "positive" ? "Cash-flow positive" : "No data"} />
                )}
                <p className="nw__note">{r.note}</p>
                <dl className="nw__totals">
                  <div className="nw__totrow"><dt>Monthly expense</dt><dd className="nw__num">{formatMoney(r.monthly_expense)}</dd></div>
                  <div className="nw__totrow"><dt>Monthly income</dt><dd className="nw__num">{formatMoney(r.monthly_income)}</dd></div>
                  <div className="nw__totrow nw__totrow--net"><dt>Net monthly burn</dt><dd className="nw__num">{formatMoney(r.net_monthly_burn)}</dd></div>
                </dl>
                <p className="nw__note">{RUNWAY_BASIS} {r.disclaimer}</p>
                <p className="nw__note"><Link to="/cash-flow">Edit obligations →</Link></p>
              </div>
            )}
          </CardBody>
        </div>
      </section>

      {/* Insurance valued exclusion line (D-039/D-081) — shown only when ≥1 policy (ND-5). */}
      <CardBody data={insurance} lines={1} onRetry={reload}>
        {(ins) =>
          ins.count > 0 ? (
            <p className="nw__exclusion">
              Insurance cash value (excluded): <strong>{formatMoney(ins.total_cash_value)}</strong> — <Link to="/insurance">see Insurance</Link>
            </p>
          ) : null
        }
      </CardBody>

      {/* Summarises (P-1, never recomputes): Portfolio headline + performance sparkline; ReviewCard. */}
      <div className="nw__summaries">
        <section className="nw__card lf-card" data-card="portfolio-summary">
          <div className="nw__cardhead">
            <h2 className="nw__h2">Portfolio</h2>
            <Link className="nw__link" to="/portfolio">Portfolio ↗</Link>
          </div>
          <div className="lf-card__body">
            <CardBody data={summary} onRetry={reload}>
              {(s) => {
                // §12b3-2: 2×2 tile grid — all SERVED display strings from the Portfolio reader
                // (P-1: every figure exists on the Portfolio page); gain/loss tone via metricTone.
                const twr = metric(stats, "Time-weighted return (TWR)");
                return (
                  <div className="nw__psummary">
                    <div className="nw__prow">
                      <TrendStat label="Today's change" value={formatSignedMoney(s.day_change)} tone={signOf(s.day_change)} />
                      <TrendStat label="Total return" value={formatSignedPercent(s.total_return_pct)} tone={signOf(s.total_return_pct)} />
                      <TrendStat label="Unrealised P/L" value={formatSignedMoney(s.unrealised_pl)} tone={signOf(s.unrealised_pl)} />
                      <TrendStat label="Time-weighted return (TWR)" value={metricDisplay(twr)} tone={metricTone(twr)} />
                    </div>
                    {sparkPoints.length >= 2 && (
                      <div className="nw__spark">
                        <Sparkline points={sparkPoints} tone={signOf(s.total_return_pct)} aria-label="Portfolio performance" />
                      </div>
                    )}
                  </div>
                );
              }}
            </CardBody>
          </div>
        </section>

        <div className="nw__reviewcell" data-card="review">
          <CardBody data={review} lines={4} onRetry={reload}>
            {() => <ReviewCard sections={reviewSections} attention={review?.count ?? 0} link={{ href: "#/review", label: "Review" }} />}
          </CardBody>
        </div>
      </div>
    </div>
  );
}

// Per-card loading wrapper (overview standard): `undefined` → Skeleton, `null` → honest error,
// value → the card content. Each overview card resolves on its own reader — no full-page block.
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
        reason="The reader is unreachable — values are withheld, never guessed."
        action={onRetry ? <button type="button" className="lf-btn" onClick={onRetry}>Retry</button> : undefined}
      />
    );
  return <>{children(data)}</>;
}

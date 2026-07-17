// SPDX-License-Identifier: AGPL-3.0-or-later
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button, DataTable, EmptyState, GlossaryTerm, PageHeader, Select, Skeleton } from "../components/ui";
import type { Column, SelectOption } from "../components/ui";
import { apiDownload } from "../api/client";
import { formatMoney, formatQuantity } from "../format/number";
import { Download, Printer } from "../icons";
import {
  getRealisedGains,
  getStatements,
  getTaxLots,
  realisedGainsCsvPath,
  statementsCsvPath,
  taxLotsCsvPath,
} from "../api/reports";
import type { RealisedReport, StatementsReport, TaxLotsReport } from "../api/reports";
import "./Reports.css";

// Reports (/reports) — page-reports §13 (Phase 1). OVERVIEW template (§9-6): three OWNED, STACKED
// D-100 cards in reading order — Statements → Realised P/L report → Open tax lots — each with its
// header/controls OUTSIDE the scroll (D-101) and its SERVED disclaimer shown in-page AND noted to
// travel INTO the export (§9-5, honest on both surfaces). Geometry RATIFIED WITH CONDITIONS
// (owner 2026-07-17, §12):
//   • §12rp-1 — the Statements TABLE is ALL-YEARS; the Year control sits in a scoped GROUP with the
//     Realised stat + Export (labelled for them, clearly NOT a table filter).
//   • §12rp-2 — the Realised P/L table carries a PER-ROW Currency column (the tax-lots precedent).
//   • §12rp-3 — the Statements Realised stat renders `realised_unrealised.realised`, which the backend
//     serves == `realised_gains_report(year).base_realised_total_current_fx` (ONE truth, pinned by a
//     backend equality test) — so it is byte-identical to the Realised P/L current-FX total.
//   • §12rp-4 — the subtitle, both EmptyState wordings and the travel captions are PROTECTED COPY.
// Money is a backend-served value rendered by the display formatters (D-105 posture — no client math);
// disclaimers are the served display strings, rendered VERBATIM. Symbols LINK to detail (D-098).
// AMENDMENT J: the long-term threshold is rendered READ-ONLY (no persisted setting exists — §10-9),
// never an input. The AI-helper placeholder stays deferred (Amendment K, D-060 intact — records only).
// REPORTS PACK ENTRY POINT (reports-pack §7a Phase 1, 2026-07-17 — the Amendment-K phasing corollary
// ends now that the Pack artifact exists): a §5.4 PageHeader action opens the print artifact at
// /reports/pack in a new tab. Reachable from Reports ONLY (D-041/D-061); no sidebar entry, no other
// inbound link. §14pk-1 (owner walk): it is the ratified PRIMARY Button (icon + label), not a
// link-styled anchor; /reports/pack is a BACKEND-served HTML route (not an SPA route), so the Button
// opens it via window.open in a new tab, rather than a react-router <Link>.

function symbolCell(symbol: string, name: string) {
  return (
    <span className="rpt__ident">
      <Link className="rpt__symbol" to={`/instrument/${symbol}`}>
        {symbol}
      </Link>{" "}
      <span className="rpt__name">{name}</span>
    </span>
  );
}

function yearOptions(years: number[]): SelectOption[] {
  return years.map((y) => ({ value: String(y), label: String(y) }));
}

function moneyStat(label: string, value: number, ccy: string, excluded?: number) {
  return (
    <div className="rpt__total">
      <span className="rpt__totallabel">{label}</span>
      <span className="rpt__totalvalue">
        {formatMoney(value)}
        <span className="rpt__affix">{ccy}</span>
      </span>
      {excluded !== undefined && excluded > 0 && (
        <span className="rpt__excluded">
          {excluded} event{excluded === 1 ? "" : "s"} excluded — trade-date FX unavailable
        </span>
      )}
    </div>
  );
}

// The Amendment-J read-only threshold line — the SERVED default, never an input, no dead Settings link.
function thresholdLine(days: number) {
  return (
    <div className="rpt__threshold">
      Long-term threshold: <span className="rpt__thresholdvalue">{days} days</span>
      <span className="rpt__thresholdnote">· a neutral holding-period threshold (read-only)</span>
    </div>
  );
}

function disclaimerCaption(disclaimer: string, file: string) {
  return (
    <p className="rpt__disclaimer">
      {disclaimer}
      <span className="rpt__travels">This disclaimer travels into the export ({file}).</span>
    </p>
  );
}

function reloadError(retry: () => void, what: string) {
  return (
    <EmptyState
      message={`Couldn't load ${what}`}
      reason="It couldn't be loaded just now, so the figures are held back rather than guessed."
      action={<button className="lf-btn" onClick={retry}>Retry</button>}
    />
  );
}

// --- merged all-years statements rows (income + fees + cash flow, keyed by year) ------------------ //
interface StatementRow {
  year: number;
  dividends: number;
  interest: number;
  fees: number;
  netCashFlow: number;
}
function mergeStatementRows(rep: StatementsReport): StatementRow[] {
  const byYear = new Map<number, StatementRow>();
  const get = (y: number) =>
    byYear.get(y) ?? byYear.set(y, { year: y, dividends: 0, interest: 0, fees: 0, netCashFlow: 0 }).get(y)!;
  // Defensive (a partial/failed payload must degrade to an EmptyState, never crash the card).
  for (const r of rep.income_by_year ?? []) {
    const row = get(r.year);
    row.dividends = r.dividend;
    row.interest = r.interest;
  }
  for (const r of rep.fees?.by_year ?? []) get(r.year).fees = r.total;
  for (const r of rep.cashflow?.by_year ?? []) get(r.year).netCashFlow = r.net;
  return [...byYear.values()].sort((a, b) => b.year - a.year);
}

const STATEMENT_COLS: Column<StatementRow>[] = [
  { key: "year", label: "Year", sortable: true, render: (r) => String(r.year) },
  { key: "dividends", label: "Dividends", align: "right", render: (r) => formatMoney(r.dividends) },
  { key: "interest", label: "Interest", align: "right", render: (r) => formatMoney(r.interest) },
  { key: "fees", label: "Fees", align: "right", render: (r) => formatMoney(r.fees) },
  { key: "netCashFlow", label: "Net cash flow", align: "right", render: (r) => formatMoney(r.netCashFlow) },
];

// --- flattened realised events (§12rp-2 per-row Currency column) ---------------------------------- //
interface RealisedRow {
  key: string;
  symbol: string;
  name: string;
  sell_date: string;
  acquired_date: string;
  quantity: number;
  proceeds: number;
  cost: number;
  gain: number;
  currency: string;
  long_term: boolean;
}
function flattenRealised(rep: RealisedReport): RealisedRow[] {
  const rows: RealisedRow[] = [];
  for (const g of rep.currency_groups ?? []) {
    g.events.forEach((e, i) => {
      rows.push({
        key: `${g.currency}-${e.symbol}-${e.sell_date}-${i}`,
        symbol: e.symbol,
        name: e.name,
        sell_date: e.sell_date,
        acquired_date: e.acquired_date,
        quantity: e.quantity,
        proceeds: e.proceeds,
        cost: e.cost,
        gain: e.gain,
        currency: g.currency,
        long_term: e.long_term,
      });
    });
  }
  return rows;
}
const REALISED_COLS: Column<RealisedRow>[] = [
  { key: "symbol", label: "Instrument", truncate: true, render: (r) => symbolCell(r.symbol, r.name) },
  { key: "sell_date", label: "Sold", sortable: true, render: (r) => r.sell_date },
  { key: "acquired_date", label: "Acquired", render: (r) => r.acquired_date },
  { key: "quantity", label: "Qty", align: "right", render: (r) => formatQuantity(r.quantity) },
  { key: "proceeds", label: "Proceeds", align: "right", render: (r) => formatMoney(r.proceeds) },
  { key: "cost", label: "Cost", align: "right", render: (r) => formatMoney(r.cost) },
  { key: "gain", label: "Gain (native)", align: "right", render: (r) => formatMoney(r.gain) },
  // §12rp-2: per-row native currency — the SAME pattern the open-tax-lots table uses below.
  { key: "currency", label: "Currency", render: (r) => r.currency },
  { key: "long_term", label: "Term", render: (r) => (r.long_term ? "Long" : "Short") },
];

// --- open tax lots -------------------------------------------------------------------------------- //
interface LotRow {
  key: string;
  symbol: string;
  name: string;
  acquired_date: string;
  quantity: number;
  unit_cost: number;
  cost: number;
  currency: string;
  long_term: boolean;
}
function taxLotRows(rep: TaxLotsReport): LotRow[] {
  return (rep.lots ?? []).map((l, i) => ({ key: `${l.symbol}-${l.acquired_date}-${i}`, ...l }));
}
const LOT_COLS: Column<LotRow>[] = [
  { key: "symbol", label: "Instrument", truncate: true, render: (r) => symbolCell(r.symbol, r.name) },
  { key: "acquired_date", label: "Acquired", sortable: true, render: (r) => r.acquired_date },
  { key: "quantity", label: "Qty", align: "right", render: (r) => formatQuantity(r.quantity) },
  { key: "unit_cost", label: "Unit cost", align: "right", render: (r) => formatMoney(r.unit_cost) },
  { key: "cost", label: "Cost", align: "right", render: (r) => formatMoney(r.cost) },
  { key: "currency", label: "Currency", render: (r) => r.currency },
  { key: "long_term", label: "Term", render: (r) => (r.long_term ? "Long" : "Short") },
];

export function Reports() {
  // Each reader owns its own card state (progressive per-card loading): undefined = skeleton,
  // null = honest error, data = report. Years persist across a card's reloads so the Year control
  // keeps its options while its own card skeletons.
  const [statements, setStatements] = useState<StatementsReport | null | undefined>(undefined);
  const [statementsYear, setStatementsYear] = useState<string>("");
  const [statementsYears, setStatementsYears] = useState<number[]>([]);
  const [realised, setRealised] = useState<RealisedReport | null | undefined>(undefined);
  const [realisedYear, setRealisedYear] = useState<string>("");
  const [realisedYears, setRealisedYears] = useState<number[]>([]);
  const [taxLots, setTaxLots] = useState<TaxLotsReport | null | undefined>(undefined);

  const loadStatements = useCallback(async (year?: string) => {
    setStatements(undefined);
    const res = await getStatements(year || undefined);
    if (res.ok) {
      setStatements(res.data);
      setStatementsYear(String(res.data.year));
      setStatementsYears(res.data.years);
    } else {
      setStatements(null);
    }
  }, []);

  const loadRealised = useCallback(async (year?: string) => {
    setRealised(undefined);
    const res = await getRealisedGains(year || undefined);
    if (res.ok) {
      setRealised(res.data);
      setRealisedYear(String(res.data.year));
      setRealisedYears(res.data.years);
    } else {
      setRealised(null);
    }
  }, []);

  const loadTaxLots = useCallback(async () => {
    setTaxLots(undefined);
    const res = await getTaxLots();
    setTaxLots(res.ok ? res.data : null);
  }, []);

  useEffect(() => {
    void loadStatements();
    void loadRealised();
    void loadTaxLots();
  }, [loadStatements, loadRealised, loadTaxLots]);

  const statementRows = useMemo(() => (statements ? mergeStatementRows(statements) : []), [statements]);
  const realisedRows = useMemo(() => (realised ? flattenRealised(realised) : []), [realised]);
  const lotRows = useMemo(() => (taxLots ? taxLotRows(taxLots) : []), [taxLots]);

  // Both Year controls offer EVERY ledger year (the union of the two readers' served year lists), not
  // only the years a reader happens to have populated. `realised.years` lists only years WITH sales, so
  // without this an EMPTY year (transactions but no realised sale) would be unselectable and the ratified
  // "No realised sales in {year}" EmptyState unreachable — the populated↔empty round-trip the owner
  // staged in the specimen. Union → an empty year is selectable and answers "were there sales?" honestly.
  const ledgerYears = useMemo(
    () => [...new Set([...statementsYears, ...realisedYears])].sort((a, b) => b - a),
    [statementsYears, realisedYears],
  );

  return (
    <div className="lf-page rpt">
      <PageHeader
        title="Reports"
        subtitle="Statements, the Realised P/L report and open tax lots — for your accountant. Every export carries the same disclaimers you see here."
        actions={
          // §14pk-1: the ratified §5.4 primary Button (icon + label), NOT a link-styled anchor. The
          // artifact is a backend HTML route (not an SPA route), so the Button opens it in a new tab.
          <Button
            variant="primary"
            icon={Printer}
            onClick={() => window.open("/reports/pack", "_blank", "noopener")}
            title="Open the printable Reports Pack in a new tab"
          >
            Reports Pack
          </Button>
        }
      />

      {/* 1) STATEMENTS — the all-years rollup table; the Year control scopes the Realised stat + export */}
      <section className="lf-card rpt__section" data-card="statements">
        <header className="rpt__cardhead">
          <h2 className="lf-card__title">
            <GlossaryTerm term="term-statements">Statements</GlossaryTerm>
          </h2>
        </header>
        <div className="lf-card__body">
          {statements === undefined && <Skeleton lines={8} />}
          {statements === null && reloadError(() => void loadStatements(statementsYear), "your statements")}
          {statements && statementRows.length === 0 && (
            <EmptyState
              message="No statements yet"
              reason="Once you record income, fees, deposits or trades, they're summarised here by year. Add or import transactions on Holdings to get started."
            />
          )}
          {statements && statementRows.length > 0 && (
            <>
              <DataTable<StatementRow>
                caption="Income, fees and cash flow by year — all years"
                columns={STATEMENT_COLS}
                rows={statementRows}
                stickyHeader
              />
              {/* §12rp-1 SCOPED GROUP: the Year control governs the Realised stat + the export ONLY —
                  visibly separated from the all-years table, labelled for what it scopes. */}
              <div className="rpt__scoped" data-scope="statements-year">
                <div className="rpt__scopedhead">
                  <span className="rpt__scopedlabel">Realised figure &amp; export — for year</span>
                  <span className="rpt__yearfield">
                    <Select
                      value={statementsYear}
                      onChange={(v) => void loadStatements(v)}
                      options={yearOptions(ledgerYears)}
                      aria-label="Realised figure and export year"
                    />
                  </span>
                  <Button
                    icon={Download}
                    aria-label="Export statements.csv"
                    onClick={() => apiDownload(statementsCsvPath(statementsYear))}
                  >
                    Export CSV
                  </Button>
                </div>
                <div className="rpt__totals">
                  {moneyStat(`Realised (${statementsYear})`, statements.realised_unrealised.realised, statements.base_currency)}
                  {moneyStat("Unrealised (open positions, now)", statements.realised_unrealised.unrealised, statements.base_currency)}
                </div>
              </div>
              {disclaimerCaption(statements.disclaimer, "statements.csv")}
            </>
          )}
        </div>
      </section>

      {/* 2) REALISED P/L REPORT — per-event table (per-row currency), both base totals + excluded count */}
      <section className="lf-card rpt__section" data-card="realised">
        <header className="rpt__cardhead">
          <h2 className="lf-card__title">
            <GlossaryTerm term="term-realised-pl">Realised P/L report</GlossaryTerm>
          </h2>
          <div className="rpt__controls">
            <span className="rpt__yearfield">
              <span className="rpt__yearlabel">Year</span>
              <Select
                value={realisedYear}
                onChange={(v) => void loadRealised(v)}
                options={yearOptions(ledgerYears)}
                aria-label="Realised P/L year"
              />
            </span>
            <Button
              icon={Download}
              aria-label="Export realised-gains.csv"
              onClick={() => apiDownload(realisedGainsCsvPath(realisedYear))}
            >
              Export CSV
            </Button>
          </div>
        </header>
        <div className="lf-card__body">
          {realised === undefined && <Skeleton lines={8} />}
          {realised === null && reloadError(() => void loadRealised(realisedYear), "the Realised P/L report")}
          {realised && (
            <>
              {thresholdLine(realised.long_term_days)}
              {realisedRows.length === 0 ? (
                <EmptyState
                  message={`No realised sales in ${realised.year}`}
                  reason={`You didn't sell anything in ${realised.year}, so there's nothing to report for this year. Pick another year, or check the Open tax lots below for what's still held.`}
                />
              ) : (
                <DataTable<RealisedRow>
                  caption="Realised sales for the year — gains in each instrument's native currency"
                  columns={REALISED_COLS}
                  rows={realisedRows}
                  stickyHeader
                />
              )}
              {/* BOTH base totals ALWAYS visible; the excluded-events count rendered when NON-ZERO. */}
              <div className="rpt__totals">
                {moneyStat("Base realised total (current FX)", realised.base_realised_total_current_fx, realised.base_currency)}
                {moneyStat(
                  "Base realised total (trade-date FX)",
                  realised.base_realised_total_historical_fx,
                  realised.base_currency,
                  realised.realised_fx_events_excluded,
                )}
              </div>
              {disclaimerCaption(realised.disclaimer, "realised-gains.csv")}
            </>
          )}
        </div>
      </section>

      {/* 3) OPEN TAX LOTS — unsold lots by FIFO; per-row currency; read-only threshold */}
      <section className="lf-card rpt__section" data-card="taxlots">
        <header className="rpt__cardhead">
          <h2 className="lf-card__title">
            <GlossaryTerm term="term-tax-lot">Open tax lots</GlossaryTerm>
          </h2>
          <div className="rpt__controls">
            <Button icon={Download} aria-label="Export tax-lots.csv" onClick={() => apiDownload(taxLotsCsvPath())}>
              Export CSV
            </Button>
          </div>
        </header>
        <div className="lf-card__body">
          {taxLots === undefined && <Skeleton lines={6} />}
          {taxLots === null && reloadError(() => void loadTaxLots(), "your open tax lots")}
          {taxLots && (
            <>
              {thresholdLine(taxLots.long_term_days)}
              {lotRows.length === 0 ? (
                <EmptyState
                  message="No open lots"
                  reason="Every parcel you've bought has been fully sold — there are no unsold lots to list. New purchases will appear here as open lots."
                />
              ) : (
                <DataTable<LotRow>
                  caption="Open (unsold) lots by FIFO — acquisition date, quantity, cost and holding period"
                  columns={LOT_COLS}
                  rows={lotRows}
                  stickyHeader
                />
              )}
              {disclaimerCaption(taxLots.disclaimer, "tax-lots.csv")}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

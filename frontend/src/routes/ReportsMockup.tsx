// SPDX-License-Identifier: AGPL-3.0-or-later
import { Button, DataTable, EmptyState, PageHeader, Select } from "../components/ui";
import type { Column } from "../components/ui";
import { Download } from "../icons";
import "./Reports.css";

// STATIC LAYOUT SPECIMEN — page-reports §9 / Phase 0a (the GEOMETRY GATE).
//
// Nothing here is wired: it exists so the owner can RATIFY THE GEOMETRY BY LOOKING, before the page is
// assembled (Phase 1 is BLOCKED until then). The proposed §-geometry (OVERVIEW template — §9-6,
// DESIGN-SYSTEM.md:227, NOT worklist): THREE OWNED, STACKED sections —
//   Statements  →  Realised P/L report  →  Open tax lots
// each a D-100 layered card whose header (title · year filter · Export control) sits OUTSIDE the scroll
// (D-101), body is a DataTable, and footer is the SERVED disclaimer shown in-page AND noted to travel
// INTO the export file (the §9-5 honesty story — honest on both surfaces).
//
// Every money figure is written AS THE BACKEND SERVES IT (a display string, D-105) — the frontend
// computes nothing here. Disclaimers are the SERVED display strings, rendered VERBATIM. Export controls
// use the §5.4 anatomy (Download icon + label). Symbols LINK to their detail page (D-098).
//
// AMENDMENT K (what SHIPS): there is NO Reports Pack entry point on this page this milestone (the
// phasing corollary — D-041 preserved, recorded not rendered) and NO "explain this report" AI-helper
// placeholder (records only, D-060 intact). The specimen shows exactly what ships.
//
// AMENDMENT J (long_term_days): NO persisted setting backs the threshold (§10-9 verdict), so the
// Realised P/L and Open tax lots sections render the SERVED default (365) READ-ONLY — never an input,
// and no dead Settings link while Settings is unbuilt.
//
// Honesty is staged: an EMPTY YEAR (no realised events → EmptyState with a reason); NO OPEN LOTS
// (EmptyState); the excluded-FX-events count rendered when NON-ZERO (D-020/D-076); and a long
// instrument name that TRUNCATES in the identity cell.
//
// TILE-INTEGRITY (the Estate/Accounts precedent): within each currency group short_term + long_term ==
// realised_total, and the sum of the event gains shown == that group's realised_total.

// --- the served disclaimers (D-105 display strings — rendered VERBATIM; these travel into the CSVs) - #
const STATEMENTS_DISCLAIMER =
  "Organisation for review / your accountant — not tax or financial advice. " +
  "Base-currency figures use current FX and are indicative, not for filing.";
const REALISED_DISCLAIMER =
  "Organisation & reporting only — NOT tax advice. Gains are in each instrument's native currency; " +
  "the current-FX base total uses TODAY's FX (approximate — not for filing). The trade-date-FX base " +
  "total instead values each leg at the FX rate stored when the trade was recorded, and omits any " +
  "trade lacking a stored rate. Short/long term is a neutral holding-period split at your chosen " +
  "threshold, not a tax ruling. Verify against your broker records and your jurisdiction's rules.";
const TAX_LOTS_DISCLAIMER = "Open lots by FIFO. Organisation only — not tax advice.";

const BASE_CCY = "SGD";
const YEAR_OPTIONS = [
  { value: "2024", label: "2024" },
  { value: "2023", label: "2023" },
  { value: "2022", label: "2022" },
];

function symbolCell(symbol: string, name: string) {
  return (
    <span className="rpt__ident">
      <a className="rpt__symbol" href={`/instrument/${symbol}`} onClick={(e) => e.preventDefault()}>
        {symbol}
      </a>{" "}
      <span className="rpt__name">{name}</span>
    </span>
  );
}

// --- 1) STATEMENTS: income / fees / cash flow by year + realised-vs-unrealised (selected year) ------ #
interface StatementRow {
  year: number;
  dividends: string;
  interest: string;
  fees: string;
  netCashFlow: string; // a withdrawal-heavy year is NEGATIVE (honest, never hidden)
}
const STATEMENTS: StatementRow[] = [
  { year: 2024, dividends: "3,120.00", interest: "840.00", fees: "285.00", netCashFlow: "42,000.00" },
  { year: 2023, dividends: "2,540.00", interest: "610.00", fees: "240.00", netCashFlow: "31,500.00" },
  { year: 2022, dividends: "1,980.00", interest: "300.00", fees: "195.00", netCashFlow: "-8,000.00" },
];
const STATEMENT_COLS: Column<StatementRow>[] = [
  { key: "year", label: "Year", sortable: true, render: (r) => String(r.year) },
  { key: "dividends", label: "Dividends", align: "right", render: (r) => r.dividends },
  { key: "interest", label: "Interest", align: "right", render: (r) => r.interest },
  { key: "fees", label: "Fees", align: "right", render: (r) => r.fees },
  { key: "netCashFlow", label: "Net cash flow", align: "right", render: (r) => r.netCashFlow },
];

// --- 2) REALISED P/L: per-event table + BOTH base totals + the excluded-events count --------------- #
interface RealisedRow {
  symbol: string;
  name: string;
  sold: string;
  acquired: string;
  quantity: string;
  proceeds: string;
  cost: string;
  gain: string;
  term: "Long" | "Short";
}
// USD group: short 1,200.00 + long 8,300.00 == realised 9,500.00 (tile-integrity: event gains sum too).
// One row carries a deliberately LONG instrument name that must TRUNCATE in the identity cell.
const REALISED: RealisedRow[] = [
  { symbol: "AAPL", name: "Apple Inc.", sold: "2024-03-14", acquired: "2021-06-01", quantity: "40", proceeds: "12,500.00", cost: "4,200.00", gain: "8,300.00", term: "Long" },
  { symbol: "VWRA", name: "Vanguard FTSE All-World UCITS ETF USD Accumulating (Ireland-domiciled)", sold: "2024-09-02", acquired: "2024-01-15", quantity: "18", proceeds: "2,050.00", cost: "850.00", gain: "1,200.00", term: "Short" },
];
const REALISED_COLS: Column<RealisedRow>[] = [
  { key: "symbol", label: "Instrument", truncate: true, render: (r) => symbolCell(r.symbol, r.name) },
  { key: "sold", label: "Sold", sortable: true, render: (r) => r.sold },
  { key: "acquired", label: "Acquired", render: (r) => r.acquired },
  { key: "quantity", label: "Qty", align: "right", render: (r) => r.quantity },
  { key: "proceeds", label: "Proceeds", align: "right", render: (r) => r.proceeds },
  { key: "cost", label: "Cost", align: "right", render: (r) => r.cost },
  { key: "gain", label: "Gain (native)", align: "right", render: (r) => r.gain },
  { key: "term", label: "Term", render: (r) => r.term },
];
// Served base-currency totals (cross-currency → FX applied server-side; pinned display strings, D-105).
// The two totals DIVERGE honestly (current FX vs trade-date FX), and 2 events are excluded from the
// trade-date total for want of a stored rate — rendered because the count is NON-ZERO (D-020/D-076).
const REALISED_TOTAL_CURRENT_FX = "14,820.00";
const REALISED_TOTAL_TRADE_DATE_FX = "13,905.00";
const REALISED_EXCLUDED = 2;
// Realised-vs-unrealised (selected year 2024) — realised cross-references the current-FX total above.
const REALISED_SELECTED = "14,820.00";
const UNREALISED_SELECTED = "128,650.00";

// --- 3) OPEN TAX LOTS: unsold lots by FIFO (cost == qty × unit cost, served) ------------------------ #
interface LotRow {
  symbol: string;
  name: string;
  acquired: string;
  quantity: string;
  unitCost: string;
  cost: string; // == quantity × unitCost (served — the frontend does not multiply)
  currency: string;
  term: "Long" | "Short";
}
const LOTS: LotRow[] = [
  { symbol: "AAPL", name: "Apple Inc.", acquired: "2022-04-11", quantity: "40", unitCost: "105.00", cost: "4,200.00", currency: "USD", term: "Long" },
  { symbol: "VUAA", name: "Vanguard S&P 500 UCITS ETF USD Accumulating (Ireland-domiciled)", acquired: "2024-05-20", quantity: "60", unitCost: "92.50", cost: "5,550.00", currency: "USD", term: "Short" },
  { symbol: "RELIANCE", name: "Reliance Industries Ltd", acquired: "2021-11-03", quantity: "150", unitCost: "2,410.00", cost: "361,500.00", currency: "INR", term: "Long" },
];
const LOT_COLS: Column<LotRow>[] = [
  { key: "symbol", label: "Instrument", truncate: true, render: (r) => symbolCell(r.symbol, r.name) },
  { key: "acquired", label: "Acquired", sortable: true, render: (r) => r.acquired },
  { key: "quantity", label: "Qty", align: "right", render: (r) => r.quantity },
  { key: "unitCost", label: "Unit cost", align: "right", render: (r) => r.unitCost },
  { key: "cost", label: "Cost", align: "right", render: (r) => r.cost },
  { key: "currency", label: "Currency", render: (r) => r.currency },
  { key: "term", label: "Term", render: (r) => r.term },
];

// --- shared bits ---------------------------------------------------------------------------------- #
function yearFilter(label: string) {
  return (
    <span className="rpt__yearfield">
      <span className="rpt__yearlabel">{label}</span>
      <Select value="2024" onChange={() => {}} options={YEAR_OPTIONS} aria-label={label} />
    </span>
  );
}
function exportButton(file: string) {
  return (
    <Button icon={Download} aria-label={`Export ${file}`}>
      Export CSV
    </Button>
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
function thresholdLine() {
  return (
    <div className="rpt__threshold">
      Long-term threshold:{" "}
      <span className="rpt__thresholdvalue">365 days</span>
      <span className="rpt__thresholdnote">· a neutral holding-period threshold (read-only)</span>
    </div>
  );
}

// --- the page: three stacked owned sections ------------------------------------------------------- #
export function ReportsMockup() {
  return (
    <div className="lf-page rpt">
      <PageHeader
        title="Reports"
        subtitle="Statements, the Realised P/L report and open tax lots — for your accountant. Every export carries the same disclaimers you see here."
      />

      {/* 1) Statements */}
      <section className="lf-card rpt__section" data-card="statements">
        <header className="rpt__cardhead">
          <h2 className="lf-card__title">Statements</h2>
          <div className="rpt__controls">
            {yearFilter("Year")}
            {exportButton("statements.csv")}
          </div>
        </header>
        <div className="lf-card__body">
          <DataTable<StatementRow>
            caption="Income, fees and cash flow by year"
            columns={STATEMENT_COLS}
            rows={STATEMENTS}
            stickyHeader
          />
          <div className="rpt__totals">
            <div className="rpt__total">
              <span className="rpt__totallabel">Realised (2024)</span>
              <span className="rpt__totalvalue">{REALISED_SELECTED}<span className="rpt__affix">{BASE_CCY}</span></span>
            </div>
            <div className="rpt__total">
              <span className="rpt__totallabel">Unrealised (open positions, now)</span>
              <span className="rpt__totalvalue">{UNREALISED_SELECTED}<span className="rpt__affix">{BASE_CCY}</span></span>
            </div>
          </div>
          {disclaimerCaption(STATEMENTS_DISCLAIMER, "statements.csv")}
        </div>
      </section>

      {/* 2) Realised P/L report */}
      <section className="lf-card rpt__section" data-card="realised">
        <header className="rpt__cardhead">
          <h2 className="lf-card__title">Realised P/L report</h2>
          <div className="rpt__controls">
            {yearFilter("Year")}
            {exportButton("realised-gains.csv")}
          </div>
        </header>
        <div className="lf-card__body">
          {thresholdLine()}
          <DataTable<RealisedRow>
            caption="Realised sales for the year — gains in each instrument's native currency"
            columns={REALISED_COLS}
            rows={REALISED}
            stickyHeader
          />
          <div className="rpt__totals">
            <div className="rpt__total">
              <span className="rpt__totallabel">Base realised total (current FX)</span>
              <span className="rpt__totalvalue">{REALISED_TOTAL_CURRENT_FX}<span className="rpt__affix">{BASE_CCY}</span></span>
            </div>
            <div className="rpt__total">
              <span className="rpt__totallabel">Base realised total (trade-date FX)</span>
              <span className="rpt__totalvalue">{REALISED_TOTAL_TRADE_DATE_FX}<span className="rpt__affix">{BASE_CCY}</span></span>
              {REALISED_EXCLUDED > 0 && (
                <span className="rpt__excluded">
                  {REALISED_EXCLUDED} events excluded — trade-date FX unavailable
                </span>
              )}
            </div>
          </div>
          {disclaimerCaption(REALISED_DISCLAIMER, "realised-gains.csv")}
        </div>
      </section>

      {/* 3) Open tax lots */}
      <section className="lf-card rpt__section" data-card="taxlots">
        <header className="rpt__cardhead">
          <h2 className="lf-card__title">Open tax lots</h2>
          <div className="rpt__controls">{exportButton("tax-lots.csv")}</div>
        </header>
        <div className="lf-card__body">
          {thresholdLine()}
          <DataTable<LotRow>
            caption="Open (unsold) lots by FIFO — acquisition date, quantity, cost and holding period"
            columns={LOT_COLS}
            rows={LOTS}
            stickyHeader
          />
          {disclaimerCaption(TAX_LOTS_DISCLAIMER, "tax-lots.csv")}
        </div>
      </section>
    </div>
  );
}

// --- HONESTY FRAME: an EMPTY YEAR — the Realised P/L section for a year with no realised sales ------ #
// Guarantee 3: an empty region shows a REASON, never a blank or a fabricated zero. The year filter +
// Export stay in the header (the export of an empty year is an honest empty file, not an error).
export function ReportsEmptyYearSpecimen() {
  return (
    <div className="lf-page rpt">
      <section className="lf-card rpt__section" data-card="realised-empty">
        <header className="rpt__cardhead">
          <h2 className="lf-card__title">Realised P/L report</h2>
          <div className="rpt__controls">
            <span className="rpt__yearfield">
              <span className="rpt__yearlabel">Year</span>
              <Select value="2021" onChange={() => {}} options={[{ value: "2021", label: "2021" }, ...YEAR_OPTIONS]} aria-label="Year" />
            </span>
            {exportButton("realised-gains.csv")}
          </div>
        </header>
        <div className="lf-card__body">
          {thresholdLine()}
          <EmptyState
            message="No realised sales in 2021"
            reason="You didn't sell anything in 2021, so there's nothing to report for this year. Pick another year, or check the Open tax lots below for what's still held."
          />
          {disclaimerCaption(REALISED_DISCLAIMER, "realised-gains.csv")}
        </div>
      </section>
    </div>
  );
}

// --- HONESTY FRAME: NO OPEN LOTS — every parcel bought has been fully sold -------------------------- #
export function ReportsNoOpenLotsSpecimen() {
  return (
    <div className="lf-page rpt">
      <section className="lf-card rpt__section" data-card="taxlots-empty">
        <header className="rpt__cardhead">
          <h2 className="lf-card__title">Open tax lots</h2>
          <div className="rpt__controls">{exportButton("tax-lots.csv")}</div>
        </header>
        <div className="lf-card__body">
          {thresholdLine()}
          <EmptyState
            message="No open lots"
            reason="Every parcel you've bought has been fully sold — there are no unsold lots to list. New purchases will appear here as open lots."
          />
          {disclaimerCaption(TAX_LOTS_DISCLAIMER, "tax-lots.csv")}
        </div>
      </section>
    </div>
  );
}

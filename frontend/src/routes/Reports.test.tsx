import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Reports } from "./Reports";
import type { RealisedReport, StatementsReport, TaxLotsReport } from "../api/reports";

// page-reports §13 (Phase 2). Render guards for the geometry conditions the owner ratified (§12):
// §12rp-1 (all-years table + Year-scoped stat/export), §12rp-2 (per-row currency), §12rp-3 (the
// Statements Realised stat is ONE truth with the Realised P/L current-FX total), §12rp-4 (verbatim
// disclaimers + EmptyStates + travel captions), Amendment J (read-only threshold, never an input).

// The served statements disclaimer (D-105) — rendered VERBATIM; asserted char-for-char below.
const STATEMENTS_DISCLAIMER =
  "Organisation for review / your accountant — not tax or financial advice. " +
  "Base-currency figures use current FX and are indicative, not for filing.";
const REALISED_DISCLAIMER =
  "Organisation & reporting only — NOT tax advice. Gains are in each instrument's native currency; the " +
  "current-FX base total uses TODAY's FX (approximate — not for filing).";
const TAX_LOTS_DISCLAIMER = "Open lots by FIFO. Organisation only — not tax advice.";

// §12rp-3: statements.realised_unrealised.realised is the SAME number the realised report serves as
// base_realised_total_current_fx (14,820.37) — the fixtures encode the one-truth the backend pins.
const REALISED_CURRENT_FX = 14820.37;

const STATEMENTS: StatementsReport = {
  base_currency: "SGD",
  years: [2024, 2023, 2022],
  year: 2024,
  income_by_year: [
    { year: 2024, dividend: 3120, interest: 840, total: 3960 },
    { year: 2023, dividend: 2540, interest: 610, total: 3150 },
    { year: 2022, dividend: 1980, interest: 300, total: 2280 },
  ],
  fees: {
    commissions: 285, taxes: 0, total: 285,
    by_year: [
      { year: 2024, commissions: 285, taxes: 0, total: 285 },
      { year: 2023, commissions: 240, taxes: 0, total: 240 },
      { year: 2022, commissions: 195, taxes: 0, total: 195 },
    ],
  },
  cashflow: {
    deposits: 42000, withdrawals: 0, net: 42000,
    by_year: [
      { year: 2024, deposits: 42000, withdrawals: 0, net: 42000 },
      { year: 2023, deposits: 31500, withdrawals: 0, net: 31500 },
      { year: 2022, deposits: 0, withdrawals: -8000, net: -8000 }, // an honest NEGATIVE year
    ],
  },
  realised_unrealised: { realised: REALISED_CURRENT_FX, unrealised: 128650 },
  disclaimer: STATEMENTS_DISCLAIMER,
};

const REALISED: RealisedReport = {
  year: 2024,
  years: [2024, 2023, 2022],
  long_term_days: 365,
  base_currency: "SGD",
  currency_groups: [
    {
      currency: "USD", realised_total: 9500, short_term: 1200, long_term: 8300, income: 0,
      events: [
        { symbol: "AAPL", name: "Apple Inc.", sell_date: "2024-03-14", acquired_date: "2021-06-01", quantity: 40, proceeds: 12500, cost: 4200, gain: 8300, holding_days: 1017, long_term: true },
        { symbol: "VWRA", name: "Vanguard FTSE All-World UCITS ETF USD Accumulating (Ireland-domiciled)", sell_date: "2024-09-02", acquired_date: "2024-01-15", quantity: 18, proceeds: 2050, cost: 850, gain: 1200, holding_days: 231, long_term: false },
      ],
    },
    {
      currency: "INR", realised_total: 4405, short_term: 4405, long_term: 0, income: 0,
      events: [
        { symbol: "RELIANCE", name: "Reliance Industries Ltd", sell_date: "2024-05-20", acquired_date: "2024-01-02", quantity: 10, proceeds: 30000, cost: 25595, gain: 4405, holding_days: 139, long_term: false },
      ],
    },
  ],
  base_realised_total_current_fx: REALISED_CURRENT_FX,
  base_realised_total_historical_fx: 13905,
  realised_fx_events_excluded: 2, // NON-ZERO → the caveat must render
  disclaimer: REALISED_DISCLAIMER,
};

const TAX_LOTS: TaxLotsReport = {
  long_term_days: 365,
  lots: [
    { symbol: "AAPL", name: "Apple Inc.", acquired_date: "2022-04-11", quantity: 40, unit_cost: 105, cost: 4200, currency: "USD", holding_days: 827, long_term: true },
    { symbol: "RELIANCE", name: "Reliance Industries Ltd", acquired_date: "2021-11-03", quantity: 150, unit_cost: 2410, cost: 361500, currency: "INR", holding_days: 986, long_term: true },
  ],
  disclaimer: TAX_LOTS_DISCLAIMER,
};

vi.mock("../api/reports", async (importActual) => {
  const actual = await importActual<typeof import("../api/reports")>();
  return { ...actual, getStatements: vi.fn(), getRealisedGains: vi.fn(), getTaxLots: vi.fn() };
});
vi.mock("../api/client", () => ({ apiDownload: vi.fn() }));

import { getRealisedGains, getStatements, getTaxLots } from "../api/reports";
import { apiDownload } from "../api/client";

const mStatements = vi.mocked(getStatements);
const mRealised = vi.mocked(getRealisedGains);
const mTaxLots = vi.mocked(getTaxLots);
const mDownload = vi.mocked(apiDownload);

function setData(opts?: { realised?: RealisedReport; taxLots?: TaxLotsReport }) {
  // getStatements echoes the requested year so the scoped stat/export track the control (the table
  // stays all-years regardless — it renders income_by_year, never a year-filtered subset).
  mStatements.mockImplementation(async (year?: number | string) => ({
    ok: true as const,
    data: { ...STATEMENTS, year: year ? Number(year) : 2024 },
  }));
  mRealised.mockImplementation(async (year?: number | string) => ({
    ok: true as const,
    data: { ...(opts?.realised ?? REALISED), year: year ? Number(year) : 2024 },
  }));
  mTaxLots.mockResolvedValue({ ok: true as const, data: opts?.taxLots ?? TAX_LOTS });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <Reports />
    </MemoryRouter>,
  );
}

beforeEach(() => setData());
afterEach(() => { cleanup(); vi.clearAllMocks(); });

test("§12rp-1: the Statements table is ALL-YEARS; the Year control scopes the Realised stat + export", async () => {
  const { container } = renderPage();
  await screen.findByText("Income, fees and cash flow by year — all years");
  const table = container.querySelector('[data-card="statements"] table') as HTMLElement;
  // ALL-YEARS: every recorded year is a row, regardless of the selected year.
  for (const y of ["2024", "2023", "2022"]) expect(within(table).getByText(y)).toBeTruthy();
  // The Year control lives in the SCOPED GROUP (not the table header) and is labelled for its scope.
  const scoped = container.querySelector('[data-scope="statements-year"]') as HTMLElement;
  expect(scoped).toBeTruthy();
  expect(within(scoped).getByText(/Realised figure & export — for year/)).toBeTruthy();
  expect(within(scoped).getByText(/^Realised \(2024\)$/)).toBeTruthy();

  // Change the year → the stat re-labels to the new year, but the all-years TABLE is unchanged.
  fireEvent.change(within(scoped).getByLabelText("Realised figure and export year"), { target: { value: "2023" } });
  await waitFor(() => expect(mStatements).toHaveBeenCalledWith("2023"));
  await screen.findByText(/^Realised \(2023\)$/);
  const tableAfter = container.querySelector('[data-card="statements"] table') as HTMLElement;
  for (const y of ["2024", "2023", "2022"]) expect(within(tableAfter).getByText(y)).toBeTruthy();

  // The export honours the scoped year (reaches the artifact URL) — proving the control governs it.
  fireEvent.click(within(container.querySelector('[data-scope="statements-year"]') as HTMLElement).getByRole("button", { name: "Export statements.csv" }));
  expect(mDownload).toHaveBeenCalledWith("/portfolio/statements.csv?year=2023");
});

test("§12rp-2: the Realised P/L table carries a per-row Currency column (tax-lots precedent)", async () => {
  const { container } = renderPage();
  await screen.findByText("Realised sales for the year — gains in each instrument's native currency");
  const table = container.querySelector('[data-card="realised"] table') as HTMLElement;
  expect(within(table).getByText("Currency")).toBeTruthy(); // the column header
  expect(within(table).getByText("Gain (native)")).toBeTruthy();
  const bodyText = (table.querySelector("tbody") as HTMLElement).textContent ?? "";
  expect(bodyText).toContain("USD");
  expect(bodyText).toContain("INR"); // per-row native currency present
  // The open-tax-lots table uses the SAME Currency-column pattern (consistency).
  const lots = container.querySelector('[data-card="taxlots"] table') as HTMLElement;
  expect(within(lots).getByText("Currency")).toBeTruthy();
});

test("§12rp-3: the Statements Realised stat == the Realised P/L current-FX total (one truth)", async () => {
  const { container } = renderPage();
  await screen.findByText(/^Realised \(2024\)$/);
  const stmtStat = container.querySelector('[data-card="statements"] .rpt__totalvalue') as HTMLElement;
  const realisedCard = container.querySelector('[data-card="realised"]') as HTMLElement;
  const currentFxLabel = within(realisedCard).getByText("Base realised total (current FX)");
  const currentFxValue = currentFxLabel.parentElement?.querySelector(".rpt__totalvalue") as HTMLElement;
  // Both render formatMoney(14820.37) = "14,820.37" — byte-identical (the backend pins the equality).
  expect(stmtStat.textContent).toContain("14,820.37");
  expect(currentFxValue.textContent).toContain("14,820.37");
});

test("both realised base totals render, and the excluded-events count shows when non-zero", async () => {
  renderPage();
  const card = (await screen.findByText("Base realised total (current FX)")).closest('[data-card="realised"]') as HTMLElement;
  expect(within(card).getByText("Base realised total (current FX)")).toBeTruthy();
  expect(within(card).getByText("Base realised total (trade-date FX)")).toBeTruthy();
  expect(within(card).getByText("13,905.00")).toBeTruthy();
  expect(within(card).getByText("2 events excluded — trade-date FX unavailable")).toBeTruthy();
});

test("the excluded-events caveat is HIDDEN when the count is zero (never a fabricated caveat)", async () => {
  setData({ realised: { ...REALISED, realised_fx_events_excluded: 0 } });
  renderPage();
  await screen.findByText("Base realised total (trade-date FX)");
  expect(screen.queryByText(/events excluded/)).toBeNull();
});

test("§12rp-4: all three served disclaimers render VERBATIM, each noting it travels into its export", async () => {
  renderPage();
  expect(await screen.findByText(STATEMENTS_DISCLAIMER, { exact: false })).toBeTruthy();
  expect(screen.getByText(REALISED_DISCLAIMER, { exact: false })).toBeTruthy();
  expect(screen.getByText(TAX_LOTS_DISCLAIMER, { exact: false })).toBeTruthy();
  expect(screen.getByText("This disclaimer travels into the export (statements.csv).")).toBeTruthy();
  expect(screen.getByText("This disclaimer travels into the export (realised-gains.csv).")).toBeTruthy();
  expect(screen.getByText("This disclaimer travels into the export (tax-lots.csv).")).toBeTruthy();
});

test("§14pk-1: the Reports Pack entry point is the ratified primary Button (icon + label), opening the artifact", async () => {
  // reports-pack §7a/§14pk-1 — the Amendment-K corollary ends and the entry point uses the ratified
  // §5.4 primary Button anatomy (icon + label), not a link-styled anchor. Reports page ONLY (D-041).
  const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
  renderPage();
  const btn = await screen.findByRole("button", { name: /Reports Pack/i });
  expect(btn.tagName).toBe("BUTTON");
  expect(btn.className).toContain("lf-btn--primary"); // the ratified primary variant, not a link
  expect(btn.querySelector("svg"), "the primary Button carries its lucide icon").toBeTruthy();
  expect(btn.textContent).toContain("Reports Pack"); // the GLOSSARY term, exact spelling
  // Clicking opens the backend artifact in a new tab.
  fireEvent.click(btn);
  expect(openSpy).toHaveBeenCalledWith("/reports/pack", "_blank", "noopener");
  openSpy.mockRestore();
});

test("Amendment J: the long-term threshold is READ-ONLY (rendered value, no input control)", async () => {
  const { container } = renderPage();
  await screen.findByText("Realised sales for the year — gains in each instrument's native currency");
  const threshold = container.querySelector('[data-card="realised"] .rpt__threshold') as HTMLElement;
  expect(threshold.textContent).toContain("Long-term threshold:");
  expect(threshold.textContent).toContain("365 days");
  // It is a read-only line, never an input — no form control lives inside it.
  expect(threshold.querySelector("input, select, button")).toBeNull();
});

test("§12rp-4 EmptyStates: empty realised year + no open lots render their ratified reasons", async () => {
  setData({
    realised: { ...REALISED, currency_groups: [], base_realised_total_current_fx: 0, base_realised_total_historical_fx: 0, realised_fx_events_excluded: 0 },
    taxLots: { ...TAX_LOTS, lots: [] },
  });
  renderPage();
  expect(await screen.findByText("No realised sales in 2024")).toBeTruthy();
  expect(screen.getByText(/You didn't sell anything in 2024, so there's nothing to report/)).toBeTruthy();
  expect(screen.getByText("No open lots")).toBeTruthy();
  expect(screen.getByText(/Every parcel you've bought has been fully sold/)).toBeTruthy();
  // The empty year keeps its export control alive (an empty year's export is an honest empty file).
  expect(screen.getByRole("button", { name: "Export realised-gains.csv" })).toBeTruthy();
});

test("honest per-card error state (Product Guarantee 3) when a reader fails", async () => {
  mRealised.mockResolvedValue({ ok: false as const, error: "boom" });
  renderPage();
  expect(await screen.findByText("Couldn't load the Realised P/L report")).toBeTruthy();
});

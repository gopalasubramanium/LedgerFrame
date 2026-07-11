import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../theme/ThemeProvider";
import { DisplayProvider } from "../theme/DisplayProvider";
import { RefdataProvider } from "../refdata/RefdataProvider";

vi.mock("../api/portfolio", () => ({
  getPortfolioSummary: vi.fn(async () => ({
    ok: true,
    data: {
      base_currency: "SGD", total_value: 819848.4, gross_assets: 1239848.4, liabilities: -420000,
      cost_basis: 711738.95, unrealised_pl: 108109.45, day_change: 296.84, total_return_pct: 15.19,
      has_stale: true, stale_count: 11,
      allocation_by_class: { equity: 45699.11, cash: 25000, property: 980000 },
      allocation_by_currency: { SGD: 738768, USD: 77203 },
      allocation_by_sector: { Technology: 33171, "Not sector-classified (non-equity)": 229868 },
      top_gainers: [{ id: 10, label: "VOO", symbol: "VOO", market_value: 1000, day_change: 120, day_change_pct: 1.2 }],
      top_losers: [], // empty → Detractors EmptyState
    },
  })),
  getPortfolioStats: vi.fn(async () => ({
    ok: true,
    data: {
      base_currency: "SGD",
      metrics: [
        { label: "Time-weighted return (TWR)", value: 8.4, kind: "pct", term_id: "term-xirr-twr" },
        { label: "Largest position", value: 79.0, kind: "pct", term_id: "term-concentration" },
        { label: "Top 5 concentration", value: 92.0, kind: "pct", term_id: "term-concentration" },
        { label: "1Y return", value: -3.37, kind: "pct", term_id: "term-period-return" },
        { label: "1Y volatility", value: 4.82, kind: "pct", term_id: "term-volatility" },
        { label: "Return / volatility", value: -0.7, kind: "ratio", term_id: "term-return-volatility" },
        { label: "Max drawdown (1Y)", value: -6.21, kind: "pct", term_id: "term-max-drawdown" },
      ],
    },
  })),
  getRealisedGains: vi.fn(async () => ({
    ok: true,
    data: { year: 2024, years: [2024], base_currency: "SGD", base_realised_total_current_fx: 807.07, base_realised_total_historical_fx: 0, realised_fx_events_excluded: 1, disclaimer: "…" },
  })),
  getTagAllocation: vi.fn(async () => ({ ok: true, data: { base_currency: "SGD", total: 1239848, tags: [] } })),
  getCostOfOwnership: vi.fn(async () => ({
    ok: true,
    data: {
      base_currency: "SGD",
      recorded_fees: { currency: "SGD", year: 2024, label: "fees recorded in 2024", total: 1.0, commissions: 1.0, taxes: 0 },
      estimated_ongoing_cost: { currency: "SGD", available: false, estimated_annual_total: null, covered_value: null, covered: 0, total: 12, coverage_label: "covers 0 of 12 holdings", holdings: [], unavailable: [] },
    },
  })),
  getBenchmarks: vi.fn(async () => ({ ok: true, data: { benchmarks: [{ symbol: "SPY", label: "S&P 500" }] } })),
  getPerformance: vi.fn(async () => ({
    ok: true,
    data: {
      base_currency: "SGD", benchmark_symbol: "SPY",
      series: [{ ts: "2025-01-01", value: 100 }, { ts: "2025-06-01", value: 110 }],
      benchmark: [{ ts: "2025-01-01", value: 100 }, { ts: "2025-06-01", value: 120 }],
      stats: { return_pct: 10, benchmark_return_pct: 20, excess_pct: -10, volatility_pct: 4.8, max_drawdown_pct: -6, best_day_pct: 0.6, worst_day_pct: -0.6, start_value: 100, end_value: 110 },
    },
  })),
  getAttribution: vi.fn(async () => ({
    ok: true,
    data: {
      attribution: {
        available: true, headline_return_pct: 15.3029, residual_pct: 0.1134,
        residual_breakdown: { income_pct: 0, realised_pct: 0.1134 },
        holdings: [{ holding_id: 7, label: "AAPL", symbol: "AAPL", asset_class: "equity", sector: "Technology", contribution_pct: 0.4389 }],
        window_days: 365,
      },
      risk: { available: true, hhi: 0.6311, beta: null, correlation: null, downside_deviation: null, information_ratio: null, tracking_error: null },
    },
  })),
}));
vi.mock("../api/client", async (orig) => ({
  ...(await orig<typeof import("../api/client")>()),
  apiGet: vi.fn(async () => ({ ok: false, error: "no refdata in test" })),
}));

import { Portfolio, NOT_A_SHARPE } from "./Portfolio";

function renderPage() {
  return render(
    <ThemeProvider>
      <DisplayProvider>
        <RefdataProvider>
          <MemoryRouter initialEntries={["/portfolio"]}>
            <Portfolio />
          </MemoryRouter>
        </RefdataProvider>
      </DisplayProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {});
afterEach(cleanup);

test("stat rail shows the D-032 figures + the served TWR metric", async () => {
  renderPage();
  expect(await screen.findByText("Today's change")).toBeTruthy();
  expect(screen.getByText("Unrealised P/L")).toBeTruthy();
  expect(screen.getByText("Cost basis")).toBeTruthy();
  expect(screen.getByText("Total return")).toBeTruthy();
  expect(screen.getByText("Time-weighted return (TWR)")).toBeTruthy();
});

test("Realised P/L rail uses the SERVED report year, never 'YTD' (ND-12)", async () => {
  const { container } = renderPage();
  expect(await screen.findByText("Realised P/L · 2024")).toBeTruthy();
  expect(container.textContent).not.toMatch(/Realised P\/L · YTD|Realised P\/L · YTD/);
});

test("movers are labelled Contributors/Detractors — today (D-024/D-034), never Gainers/Losers", async () => {
  const { container } = renderPage();
  expect(await screen.findByText("Contributors — today")).toBeTruthy();
  expect(screen.getByText("Detractors — today")).toBeTruthy();
  expect(container.textContent).not.toMatch(/Gainers|Losers/);
});

test("empty Detractors shows an honest EmptyState (Nothing declined today, ND-9)", async () => {
  renderPage();
  expect(await screen.findByText(/Nothing declined today/)).toBeTruthy();
});

test("allocation donut carries the excluded-liabilities footnote (ND-4)", async () => {
  const { container } = renderPage();
  await screen.findByText("Allocation");
  await waitFor(() => {
    const foots = Array.from(container.querySelectorAll(".lf-donut__footnote"));
    expect(foots.some((f) => /Liabilities .* excluded/.test(f.textContent ?? ""))).toBe(true);
  });
});

test("sector donut renders the served D-082 'Not sector-classified (non-equity)' bucket", async () => {
  renderPage();
  expect(await screen.findByText("Not sector-classified (non-equity)")).toBeTruthy();
});

test("attribution shows an explicit residual row + headline that reconcile (ND-7)", async () => {
  renderPage();
  expect(await screen.findByText(/Residual \(income, realised, closed\)/)).toBeTruthy();
  expect(screen.getByText("Headline return")).toBeTruthy();
  expect(screen.getByText(/Single-period approximation/)).toBeTruthy();
});

test("HHI renders from attribution.risk (ND-5) alongside the two served concentration figures", async () => {
  renderPage();
  await screen.findByText("Concentration");
  expect(screen.getByText("HHI")).toBeTruthy();
  expect(screen.getByText("Largest position")).toBeTruthy();
  expect(screen.getByText("Top 5 concentration")).toBeTruthy();
});

test("not-a-Sharpe disclaimer is the verbatim protected constant (D-030 / ND-6, drift-proof)", async () => {
  // Exact-match guard: any paraphrase of the frontend constant fails this test.
  expect(NOT_A_SHARPE).toBe("Explicitly NOT a Sharpe ratio (no risk-free rate subtracted).");
  renderPage();
  expect(await screen.findByText(NOT_A_SHARPE)).toBeTruthy();
});

test("Costs card shows two separate blocks, never a blended total (D-048)", async () => {
  renderPage();
  await screen.findByText("Costs");
  const recorded = screen.getByText("Recorded fees");
  const ongoing = screen.getByText("Ongoing cost (expense ratio)");
  expect(recorded).toBeTruthy();
  expect(ongoing).toBeTruthy();
  // Cross-link to the Reports page.
  expect(within(document.body).getAllByText(/Reports ↗|Report ↗/).length).toBeGreaterThan(0);
});

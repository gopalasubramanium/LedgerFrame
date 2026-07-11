import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../theme/ThemeProvider";
import { DisplayProvider } from "../theme/DisplayProvider";
import { RefdataProvider } from "../refdata/RefdataProvider";

// Populated defaults; individual tests override a reader with mockResolvedValueOnce.
vi.mock("../api/portfolio", () => ({
  getPortfolioSummary: vi.fn(async () => ({
    ok: true,
    data: {
      base_currency: "SGD", total_value: 819848.4, gross_assets: 1239848.4, liabilities: -420000,
      cash_and_deposits: 25000, cost_basis: 711738.95, unrealised_pl: 108109.45, day_change: 296.84,
      total_return_pct: 15.19, has_stale: true, stale_count: 11,
      allocation_by_class: {}, allocation_by_currency: {}, allocation_by_sector: {},
      top_gainers: [], top_losers: [],
    },
  })),
  getPerformance: vi.fn(async () => ({
    ok: true,
    data: {
      base_currency: "SGD", benchmark_symbol: "SPY",
      series: [{ ts: "2025-01-01", value: 100 }, { ts: "2025-06-01", value: 110 }],
      benchmark: [], stats: null,
    },
  })),
  getPortfolioStats: vi.fn(async () => ({
    ok: true,
    data: { base_currency: "SGD", metrics: [
      { label: "Time-weighted return (TWR)", value: 8.4, kind: "pct", term_id: "term-xirr-twr" },
    ] },
  })),
}));

vi.mock("../api/net-worth", () => ({
  getNetWorthHistory: vi.fn(async () => ({
    ok: true,
    data: { history: [
      { ts: "2025-01-01T00:00:00Z", assets: 1000000, liabilities: 400000, net_worth: 600000, currency: "SGD" },
      { ts: "2025-06-01T00:00:00Z", assets: 1239848, liabilities: 420000, net_worth: 819848, currency: "SGD" },
    ] },
  })),
  getNetWorthStatement: vi.fn(async () => ({
    ok: true,
    data: {
      base_currency: "SGD",
      rows: [
        { asset_class: "property", value: 980000 },
        { asset_class: "equity", value: 234848.4 },
        { asset_class: "cash", value: 25000 },
        { asset_class: "liability", value: -420000 },
      ],
      gross_assets: 1239848.4, liabilities: -420000, net_worth: 819848.4,
    },
  })),
  getLiquidity: vi.fn(async () => ({
    ok: true,
    data: {
      base_currency: "SGD", gross_assets: 1239848.4,
      rungs: [
        { key: "immediate", label: "Immediate (cash & listed)", value: 259848, pct: 21, cumulative_pct: 21 },
        { key: "illiquid", label: "Illiquid (property & private)", value: 980000, pct: 79, cumulative_pct: 100 },
      ],
      liquid_pct: 21, liabilities: -420000, disclaimer: "Indicative liquidity by asset type.",
    },
  })),
  getRunway: vi.fn(async () => ({
    ok: true,
    data: {
      base_currency: "SGD", liquid: 259848, monthly_expense: 3000, monthly_income: 600,
      net_monthly_burn: 2400, runway_months: 8.5, runway_date: "2027-03-01",
      status: "finite", note: "At your recorded recurring net burn, your liquid assets would last this long.",
      disclaimer: "Indicative — liquid assets ÷ your recorded recurring net burn.",
    },
  })),
  getInsurance: vi.fn(async () => ({ ok: true, data: { base_currency: "SGD", count: 0, total_cash_value: 0 } })),
  getReview: vi.fn(async () => ({
    ok: true,
    data: { as_of: "2026-07-11", count: 1, items: [
      { area: "data", title: "7 holdings have stale prices — refresh", severity: "review" },
      { area: "data", title: "4 holdings have incomplete details", severity: "info" },
    ] },
  })),
}));

vi.mock("../api/client", async (orig) => ({
  ...(await orig<typeof import("../api/client")>()),
  apiGet: vi.fn(async () => ({ ok: false, error: "no refdata in test" })),
}));

import { NetWorth } from "./NetWorth";
import { getNetWorthHistory, getInsurance } from "../api/net-worth";

function renderPage() {
  return render(
    <ThemeProvider>
      <DisplayProvider>
        <RefdataProvider>
          <MemoryRouter initialEntries={["/net-worth"]}>
            <NetWorth />
          </MemoryRouter>
        </RefdataProvider>
      </DisplayProvider>
    </ThemeProvider>,
  );
}

afterEach(cleanup);

test("KPI strip shows the four D-054 figures", async () => {
  const { container } = renderPage();
  await screen.findByText("Cash & deposits");
  const kpis = within(container.querySelector('[data-card="kpis"]') as HTMLElement);
  expect(kpis.getByText("Net worth")).toBeTruthy();
  expect(kpis.getByText("Gross assets")).toBeTruthy();
  expect(kpis.getByText("Liabilities")).toBeTruthy();
  expect(kpis.getByText("Cash & deposits")).toBeTruthy();
});

test("composition statement includes a NEGATIVE liability row and a reconciling Net worth total (ND-4)", async () => {
  const { container } = renderPage();
  await screen.findByText("Composition by class");
  await waitFor(() => {
    const stmt = container.querySelector('[data-card="statement"]') as HTMLElement;
    // Class labels resolve via the offline refdata registry (never a raw enum key).
    expect(stmt.textContent).toMatch(/Liability/);
    // The statement's Net worth total is a <tfoot> row (shares the column grid, §12b1-2).
    expect(stmt.querySelector(".lf-table__foot--emph")?.textContent).toMatch(/Net worth/);
    // Liability value renders negative.
    expect(stmt.textContent).toMatch(/-420,000/);
  });
});

test("liquidity ladder renders rungs + the Liquid share line (D-036)", async () => {
  renderPage();
  await screen.findByText("Liquidity ladder");
  expect(await screen.findByText("Immediate (cash & listed)")).toBeTruthy();
  expect(await screen.findByText(/Liquid \(Immediate \+ Short\) = 21\.0% of gross assets/)).toBeTruthy();
});

test("runway shows the finite figure + the honest basis label (ND-9)", async () => {
  const { container } = renderPage();
  await screen.findByText("Cash runway");
  await waitFor(() => {
    expect(container.textContent).toMatch(/8\.5/);
    expect(container.textContent).toMatch(/Basis: liquid assets ÷ recurring monthly net burn/);
  });
});

test("fresh instance: empty net-worth history shows the honest EmptyState, never a fabricated curve (ND-1)", async () => {
  vi.mocked(getNetWorthHistory).mockResolvedValueOnce({ ok: true, data: { history: [] } });
  renderPage();
  expect(await screen.findByText("Not enough history yet")).toBeTruthy();
  expect(await screen.findByText(/history accumulates as the appliance runs/i)).toBeTruthy();
});

test("insurance exclusion line is OMITTED with zero policies (ND-5)", async () => {
  const { container } = renderPage();
  await screen.findByText("Liquidity ladder");
  await waitFor(() => expect(container.querySelector(".nw__exclusion")).toBeNull());
});

test("insurance exclusion line shows the verbatim wording when ≥1 policy (D-039/D-081, ND-5)", async () => {
  vi.mocked(getInsurance).mockResolvedValueOnce({ ok: true, data: { base_currency: "SGD", count: 2, total_cash_value: 15000 } });
  renderPage();
  expect(await screen.findByText(/Insurance cash value \(excluded\):/)).toBeTruthy();
  expect(await screen.findByText(/see Insurance/)).toBeTruthy();
});

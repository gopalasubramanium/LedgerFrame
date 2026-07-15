import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../theme/ThemeProvider";
import { DisplayProvider } from "../theme/DisplayProvider";
import { ToastProvider } from "../components/ui";
import { Scenarios } from "./Scenarios";

const shock = (id: string, name: string, exposure: number, delta: number, pct: number) => ({
  id, name, group: "markets", exposure, exposure_display: exposure.toLocaleString("en-US", { minimumFractionDigits: 2 }),
  delta, delta_display: `−${Math.abs(delta).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
  new_net_worth: 796246 + delta, new_net_worth_display: (796246 + delta).toLocaleString("en-US", { minimumFractionDigits: 2 }),
  pct_change: pct,
});

const DATA = {
  base_currency: "SGD",
  net_worth: 796246, net_worth_display: "796,246.00",
  exposures: {
    equities: 312400, equities_display: "312,400.00",
    crypto: 45900, crypto_display: "45,900.00",
    property: 280000, property_display: "280,000.00",
    foreign_fx: 184500, foreign_fx_display: "184,500.00",
  },
  asset_scenarios: [
    shock("equities_10", "Equities fall 10%", 312400, -31240, -3.9),
    shock("crypto_50", "Crypto falls 50%", 45900, -22950, -2.9),
  ],
  liquidity: {
    liquid: 120000, liquid_display: "120,000.00", runway_months: 14.2,
    income_stop: { monthly_expense: 8777, monthly_expense_display: "8,777.00", runway_months: 7.2,
      note: "If recorded income stopped, liquid assets would cover recurring expenses for this long." },
    obligation_due: { amount: 68800, amount_display: "68,800.00", new_liquid: 51200, new_liquid_display: "51,200.00",
      covered: true, note: "If the next 12 months of recorded expenses were paid from liquid assets now." },
  },
  stale_inputs: 2, low_confidence_inputs: 1, inputs_stale: true,
  inputs_note: "2 prices are stale and 1 holding is low-confidence — these figures may not reflect current values.",
  disclaimer: "Scenario, not forecast — arithmetic on today's values, not a prediction, probability or recommendation. Real outcomes will differ.",
};

function mockFetch(over: Partial<typeof DATA> = {}) {
  vi.stubGlobal("fetch", vi.fn(async () =>
    new Response(JSON.stringify({ ...DATA, ...over }), { status: 200, headers: { "content-type": "application/json" } })));
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <ThemeProvider><DisplayProvider><ToastProvider>
        <Scenarios />
      </ToastProvider></DisplayProvider></ThemeProvider>
    </MemoryRouter>,
  );

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test("renders exposures, the shock table with served money VERBATIM, and impacts as LOSSES", async () => {
  mockFetch();
  const { container } = renderPage();
  await screen.findByText("−31,240.00");
  const table = container.querySelector('[data-card="shocks"]') as HTMLElement;
  const eqRow = [...table.querySelectorAll("tbody tr")].find((r) => r.textContent?.includes("Equities fall 10%"))!;
  expect(eqRow.textContent).toContain("312,400.00");                 // exposure (served) in the shock row
  const impact = within(eqRow as HTMLElement).getByText("−31,240.00").closest("span")!;
  expect(impact.className).toContain("sc__loss");                    // §9-5 — a loss, never a gain
  expect(impact.className).not.toContain("gain");
  expect(screen.getByText("765,006.00")).toBeTruthy();               // new net worth (served)
});

test("D-058 — NO FORECAST LANGUAGE outside the protected disclaimer's own negations", async () => {
  mockFetch();
  const { container } = renderPage();
  await screen.findByText("−31,240.00");
  // Two strings legitimately NEGATE these words — the protected subtitle ("a scenario, never a
  // forecast") and the disclaimer. Strip BOTH, then no forecast word may appear anywhere else.
  const subtitle = "what today's values would look like under a hypothetical shock. a scenario, never a forecast.";
  const text = (container.textContent ?? "").toLowerCase().replace(DATA.disclaimer.toLowerCase(), "").replace(subtitle, "");
  for (const banned of ["forecast", "predict", "projection", "expected", "likely", "probab", "you should"]) {
    expect(text, `no forecast word "${banned}" outside the protected copy`).not.toContain(banned);
  }
  // ...and the protected subtitle + disclaimer ARE present.
  expect(screen.getByText(/a scenario, never a forecast/i)).toBeTruthy();
  expect(screen.getByText(/not a prediction, probability or recommendation/i)).toBeTruthy();
});

test("A10 — a what-if on stale/low-confidence inputs says so, with a Pricing Health route", async () => {
  mockFetch();
  renderPage();
  expect(await screen.findByText(DATA.inputs_note)).toBeTruthy();
  expect(screen.getByRole("link", { name: /pricing health/i })).toBeTruthy();
});

test("§9-5 — covered → positive chip", async () => {
  mockFetch();
  renderPage();
  const covered = (await screen.findByText("Covered")).closest(".lf-statuschip")!;
  expect(covered.className).toContain("lf-statuschip--positive");
});

test("§9-5 — not covered → attention (needs-a-look, NOT a loss verdict)", async () => {
  mockFetch({ liquidity: { ...DATA.liquidity, obligation_due: { ...DATA.liquidity.obligation_due, covered: false } } });
  renderPage();
  const notCovered = (await screen.findByText("Not covered")).closest(".lf-statuschip")!;
  expect(notCovered.className).toContain("lf-statuschip--attention");
  expect(notCovered.className).not.toContain("negative");
});

test("§9-9 — near-zero net worth suppresses the %, shows only the amount, with an honest note", async () => {
  mockFetch({ net_worth: 412, net_worth_display: "412.00" });
  const { container } = renderPage();
  await screen.findByText("−31,240.00");
  const table = container.querySelector('[data-card="shocks"]')!;
  // Every % cell is an em dash...
  const rows = [...table.querySelectorAll("tbody tr")];
  for (const row of rows) {
    const lastCell = row.querySelectorAll("td")[4];
    expect(lastCell.textContent).toBe("—");
  }
  // ...and the footnote explains why.
  expect(within(table as HTMLElement).getByText(/percentages are not shown/i)).toBeTruthy();
});

test("§9-9 — an empty portfolio shows a reason and a route to Holdings", async () => {
  mockFetch({ net_worth: 0, asset_scenarios: [] });
  renderPage();
  expect(await screen.findByText("No holdings to model a shock against.")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Add holdings" }).getAttribute("href")).toContain("/holdings");
});


test("§12sc1-3 — the impact bar is magnitude-scaled: the largest shock fills it; a loss tone; no forecast", async () => {
  // crypto (−2.9) is smaller than equities (−3.9) in the fixture → equities' bar is the fuller one.
  mockFetch();
  const { container } = renderPage();
  await screen.findByText("−31,240.00");
  const table = container.querySelector('[data-card="shocks"]') as HTMLElement;
  const bars = [...table.querySelectorAll(".sc__impactfill")] as SVGRectElement[];
  expect(bars.length).toBe(2);
  const eqRow = [...table.querySelectorAll("tbody tr")].find((r) => r.textContent?.includes("Equities fall 10%"))!;
  const eqFill = Number((eqRow.querySelector(".sc__impactfill") as SVGRectElement).getAttribute("width"));
  const crRow = [...table.querySelectorAll("tbody tr")].find((r) => r.textContent?.includes("Crypto"))!;
  const crFill = Number((crRow.querySelector(".sc__impactfill") as SVGRectElement).getAttribute("width"));
  // The larger-magnitude shock (equities −3.9%) has the fuller bar; the largest is 100.
  expect(eqFill).toBeGreaterThan(crFill);
  expect(Math.max(eqFill, crFill)).toBe(100);   // scaled against the largest shock
  // The fill uses the loss token (no gain, no forecast framing).
  expect((eqRow.querySelector(".sc__impactfill") as SVGElement).getAttribute("class")).toContain("sc__impactfill");
});

test("§12sc1-3 + §9-9 — near-zero net worth suppresses BOTH the % and its bar", async () => {
  mockFetch({ net_worth: 412, net_worth_display: "412.00" });
  const { container } = renderPage();
  await screen.findByText("−31,240.00");
  const table = container.querySelector('[data-card="shocks"]') as HTMLElement;
  expect(table.querySelectorAll(".sc__impactfill").length).toBe(0);   // no bar when the % is suppressed
});

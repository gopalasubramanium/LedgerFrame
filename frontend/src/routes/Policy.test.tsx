import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../theme/ThemeProvider";
import { DisplayProvider } from "../theme/DisplayProvider";
import { ToastProvider } from "../components/ui";
import { Policy } from "./Policy";

const DRIFT = {
  base_currency: "SGD",
  gross_assets: 1000000,
  gross_assets_display: "1,000,000.00",
  has_targets: true,
  max_position_pct: 25,
  dimensions: [
    {
      dimension: "asset_class",
      coverage_pct: 70,
      rows: [
        {
          bucket: "equity", target_pct: 30, actual_pct: 12.5, drift_pct: -17.5,
          lower_pct: 25, upper_pct: 35, status: "under",
          gap_base: -175000, gap_base_display: "-175,000.00",
          actual_value: 125000, actual_value_display: "125,000.00",
        },
        {
          bucket: "property", target_pct: 40, actual_pct: 80.6, drift_pct: 40.6,
          lower_pct: 35, upper_pct: 45, status: "over",
          gap_base: 406000, gap_base_display: "406,000.00",
          actual_value: 806000, actual_value_display: "806,000.00",
        },
        {
          bucket: "cash", target_pct: 5, actual_pct: 5.1, drift_pct: 0.1,
          lower_pct: 0, upper_pct: 10, status: "in_band",
          gap_base: 1000, gap_base_display: "1,000.00",
          actual_value: 51000, actual_value_display: "51,000.00",
        },
      ],
      untargeted: [
        { bucket: "crypto", actual_pct: 1.8, actual_value: 18000, actual_value_display: "18,000.00" },
      ],
    },
  ],
  concentration: [
    { label: "Home (est.)", symbol: null, weight_pct: 80.6, limit_pct: 25, value: 806000, value_display: "806,000.00" },
    { label: "Vanguard S&P 500", symbol: "VOO", weight_pct: 30.1, limit_pct: 25, value: 301000, value_display: "301,000.00" },
  ],
  stale_inputs: 0,
  low_confidence_inputs: 1,
  inputs_stale: true,
  inputs_note: "1 holding is low-confidence — these figures may not reflect current values.",
  disclaimer: "Reporting only — distance from your own targets. Not financial advice.",
};

const POLICY = {
  name: "Investment Policy",
  base_currency: null,
  default_band_pct: 5,
  max_position_pct: 25,
  notes: null,
  targets: [
    { dimension: "asset_class", bucket: "equity", target_pct: 30, min_pct: 25, max_pct: 35 },
    { dimension: "asset_class", bucket: "property", target_pct: 40, min_pct: null, max_pct: null },
    { dimension: "currency", bucket: "SGD", target_pct: 60, min_pct: null, max_pct: null },
  ],
};

function mockFetch(overrides: { drift?: unknown; policy?: unknown } = {}) {
  const sent: { path: string; body: unknown }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const path = String(url);
    if (init?.method && init.method !== "GET") {
      sent.push({ path, body: JSON.parse(String(init.body)) });
      return new Response(JSON.stringify(POLICY), { status: 200, headers: { "content-type": "application/json" } });
    }
    const body = path.includes("/policy/drift")
      ? (overrides.drift ?? DRIFT)
      : path.includes("/policy")
        ? (overrides.policy ?? POLICY)
        : {};
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }));
  return sent;
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <ThemeProvider><DisplayProvider><ToastProvider>
        <Policy />
      </ToastProvider></DisplayProvider></ThemeProvider>
    </MemoryRouter>,
  );

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test("drift renders: served money verbatim, band status as a LABELLED chip, coverage as a total", async () => {
  mockFetch();
  renderPage();

  // Served display strings are rendered VERBATIM — the page formats no money (D-105).
  expect(await screen.findByText("406,000.00")).toBeTruthy();
  expect(screen.getByText("-175,000.00")).toBeTruthy();

  // The gap column is a GAP, not an instruction (§9-19).
  expect(screen.getByText("Gap to target")).toBeTruthy();

  // Status is a LABELLED chip — never the raw enum key.
  expect(screen.getByText("Over")).toBeTruthy();
  expect(screen.getByText("Under")).toBeTruthy();
  expect(screen.getByText("In band")).toBeTruthy();
  expect(screen.queryByText("in_band")).toBeNull();

  // Coverage renders inside the table as a reconciling total.
  expect(screen.getByText("Coverage")).toBeTruthy();
});

test("§9-16 — over and under BOTH carry the amber attention tone; in-band is neutral; never gain/loss", async () => {
  mockFetch();
  renderPage();
  const over = (await screen.findByText("Over")).closest(".lf-statuschip") as HTMLElement;
  const under = screen.getByText("Under").closest(".lf-statuschip") as HTMLElement;
  const inBand = screen.getByText("In band").closest(".lf-statuschip") as HTMLElement;

  // Over and under are the SAME tone: both simply need a look. Colouring "over" as a loss would
  // VALUE the gap, the nearest a colour can come to implying a trade (D-055).
  expect(over.className).toContain("lf-statuschip--attention");
  expect(under.className).toContain("lf-statuschip--attention");
  expect(inBand.className).toContain("lf-statuschip--neutral");
  for (const chip of [over, under, inBand]) {
    expect(chip.className).not.toContain("positive");
    expect(chip.className).not.toContain("negative");
  }
});

test("D-055 — no served or rendered string names or implies a trade", async () => {
  mockFetch();
  const { container } = renderPage();
  await screen.findByText("Gap to target");
  const text = (container.textContent ?? "").toLowerCase();
  for (const banned of ["rebalance", "amount to sell", "amount to buy", "sell ", "buy ", "trim", "top up"]) {
    expect(text).not.toContain(banned);
  }
  // The protected disclaimer is present (D-055 — may not be removed).
  expect(screen.getByText(/reporting, never a trade instruction/i)).toBeTruthy();
  expect(screen.getByText(/not financial advice/i)).toBeTruthy();
});

test("A10 — a verdict resting on low-confidence inputs cannot present as fresh", async () => {
  mockFetch();
  renderPage();
  // The SERVED note is rendered verbatim, with a route to the canonical provenance page.
  expect(await screen.findByText(DRIFT.inputs_note)).toBeTruthy();
  expect(screen.getByRole("link", { name: /pricing health/i })).toBeTruthy();
  // Nothing is STALE here (only low-confidence), so the page must NOT claim staleness.
  expect(screen.queryByText(/^Stale/)).toBeNull();
});

test("§9-17 / D-098 — a concentration row links only when it has a symbol; a manual asset stays plain text", async () => {
  mockFetch();
  renderPage();
  expect(await screen.findByRole("link", { name: "Vanguard S&P 500" })).toBeTruthy();
  // The manual property has no symbol: honest plain text, never a guessed route.
  expect(screen.queryByRole("link", { name: "Home (est.)" })).toBeNull();
  expect(screen.getByText("Home (est.)")).toBeTruthy();
});

test("§9-13 — the empty state states a REASON and offers the way forward", async () => {
  mockFetch({ drift: { ...DRIFT, has_targets: false, dimensions: [], concentration: [] },
              policy: { ...POLICY, targets: [] } });
  renderPage();
  expect(await screen.findByText("No policy defined.")).toBeTruthy();
  expect(screen.getByText(/set target allocations to see how far your holdings sit/i)).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "Set targets" }).length).toBeGreaterThan(0);
});

test("§9-2 — BULK REPLACE: editing one row sends the COMPLETE set; no other row is dropped", async () => {
  const sent = mockFetch();
  const user = userEvent.setup();
  renderPage();

  await user.click(await screen.findByRole("button", { name: "Edit policy" }));
  const dialog = await screen.findByRole("dialog");

  // Change ONE target's percentage.
  const targets = within(dialog).getAllByLabelText("Target");
  await user.clear(targets[0]);
  await user.type(targets[0], "35");

  await user.click(within(dialog).getByRole("button", { name: "Save policy" }));

  await waitFor(() => expect(sent.some((s) => s.path.includes("/policy/targets"))).toBe(true));
  const body = sent.find((s) => s.path.includes("/policy/targets"))!.body as { targets: { bucket: string; target_pct: number }[] };

  // THE GUARANTEE: all three original targets are still there — the edit changed one, dropped none.
  // The endpoint is an atomic bulk REPLACE, so an omitted row is a DELETED row.
  expect(body.targets).toHaveLength(3);
  expect(body.targets.map((t) => t.bucket).sort()).toEqual(["SGD", "equity", "property"]);
  expect(body.targets.find((t) => t.bucket === "equity")!.target_pct).toBe(35);
  // ...and the untouched rows kept their values.
  expect(body.targets.find((t) => t.bucket === "property")!.target_pct).toBe(40);
  expect(body.targets.find((t) => t.bucket === "SGD")!.target_pct).toBe(60);
});

test("§9-18 — a blank band is NOT 'no band': the editor shows the band it INHERITS", async () => {
  mockFetch();
  const user = userEvent.setup();
  renderPage();
  await user.click(await screen.findByRole("button", { name: "Edit policy" }));
  const dialog = await screen.findByRole("dialog");

  // `property` (target 40) sets no min/max, so it inherits the default band of 5 → 35–45.
  expect(within(dialog).getByText("inherits 35%")).toBeTruthy();
  expect(within(dialog).getByText("inherits 45%")).toBeTruthy();
  // `equity` sets its own band (25/35), so it inherits nothing.
  expect(within(dialog).queryByText("inherits 25%")).toBeNull();
});

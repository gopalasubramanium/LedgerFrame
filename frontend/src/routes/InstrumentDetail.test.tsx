import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../theme/ThemeProvider";
import { DisplayProvider } from "../theme/DisplayProvider";
import { RefdataProvider } from "../refdata/RefdataProvider";

vi.mock("../api/instruments", () => ({
  getInstrument: vi.fn(),
  getInstrumentHistory: vi.fn(async () => ({ ok: true, data: { symbol: "AAPL", interval: "1d", candles: [] } })),
  getInstrumentNews: vi.fn(async () => ({ ok: true, data: { symbol: "AAPL", items: [] } })),
  getInstrumentPosition: vi.fn(async () => ({ ok: true, data: { base_currency: "SGD", holdings: [] } })),
  patchInstrument: vi.fn(async () => ({ ok: true, data: {} })),
  setOngoingCost: vi.fn(async () => ({ ok: true, data: { ok: true, annual_cost_bps: 20 } })),
}));
vi.mock("../api/client", async (orig) => ({
  ...(await orig<typeof import("../api/client")>()),
  apiGet: vi.fn(async () => ({ ok: false, error: "no refdata in test" })),
}));

import { InstrumentDetail } from "./InstrumentDetail";
import * as api from "../api/instruments";

const DETAIL = {
  quote: { symbol: "AAPL", price: 190.5, price_display: "190.50", change: 0.6, change_pct: 0.32, currency: "USD", source: "mock", entitlement: "delayed", received_at: "2026-07-10T00:00:00", is_stale: false },
  instrument: { symbol: "AAPL", name: "Apple Inc.", asset_class: "equity", currency: "USD", exchange: "NASDAQ", sector: "Technology", country: "US", annual_cost_bps: null, identifiers: [], asset_detail: {}, history_status: null },
};

function renderAt(symbol = "AAPL") {
  return render(
    <ThemeProvider><DisplayProvider><ToastProvider><RefdataProvider>
      <MemoryRouter initialEntries={[`/instrument/${symbol}`]}>
        <Routes><Route path="/instrument/:symbol" element={<InstrumentDetail />} /></Routes>
      </MemoryRouter>
    </RefdataProvider></ToastProvider></DisplayProvider></ThemeProvider>,
  );
}

beforeEach(() => {
  vi.mocked(api.getInstrument).mockResolvedValue({ ok: true, data: DETAIL });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

test("renders the scoped-view header, quote and sections", async () => {
  renderAt();
  await waitFor(() => expect(screen.getByRole("heading", { name: "AAPL", level: 1 })).toBeInTheDocument());
  expect(screen.getByText(/scoped view/)).toBeInTheDocument();
  expect(screen.getByText(/USD 190\.5/)).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Your position" })).toBeInTheDocument();
  // AI explainer is present but deferred (D-068 intact), never a fabricated answer.
  expect(screen.getByText(/AI-surfaces milestone/)).toBeInTheDocument();
});

test("unpriced instrument shows '—' with an honest reason, never a number", async () => {
  vi.mocked(api.getInstrument).mockResolvedValue({
    ok: true,
    data: { ...DETAIL, quote: { ...DETAIL.quote, price: null, change: null, change_pct: null } },
  });
  renderAt();
  await waitFor(() => expect(screen.getByText(/No live quote from the source/)).toBeInTheDocument());
});

test("a not-held instrument shows 'Not in your portfolio' (honest empty)", async () => {
  vi.mocked(api.getInstrumentPosition).mockResolvedValue({ ok: true, data: { base_currency: "SGD", holdings: [] } });
  renderAt();
  await waitFor(() => expect(screen.getByText("Not in your portfolio")).toBeInTheDocument());
});

test("held position comes from the scoped holdings reader (ND-1, P-3)", async () => {
  vi.mocked(api.getInstrumentPosition).mockResolvedValue({
    ok: true,
    data: { base_currency: "SGD", holdings: [{ id: 1, symbol: "AAPL", asset_class: "equity", quantity: 70, currency: "USD", market_value: 17986.88, cost_basis: 14846.66, unrealised_pl: 3140.21, is_stale: false, is_priced: true }] },
  });
  renderAt();
  await waitFor(() => expect(screen.getByText("17,986.88")).toBeInTheDocument());
  expect(screen.getByText("+3,140.21")).toBeInTheDocument();
  expect(vi.mocked(api.getInstrumentPosition)).toHaveBeenCalledWith("AAPL");
});

test("Edit submits a PATCH with exactly the edited fields (request-body assertion)", async () => {
  const user = userEvent.setup();
  renderAt();
  await waitFor(() => expect(screen.getByRole("heading", { name: "AAPL", level: 1 })).toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "Edit" }));
  const dialog = screen.getByRole("dialog");
  const name = within(dialog).getByLabelText("Display name");
  await user.clear(name);
  await user.type(name, "Apple");
  await user.click(within(dialog).getByRole("button", { name: "Save" }));
  expect(vi.mocked(api.patchInstrument)).toHaveBeenCalledWith(
    "AAPL",
    expect.objectContaining({ name: "Apple", asset_class: "equity", source_override: "auto" }),
  );
});

test("Ongoing cost submits the entered bps (fund-wrapped only, D-099)", async () => {
  // D-099: the expense-ratio action exists only for fund-wrapped classes.
  vi.mocked(api.getInstrument).mockResolvedValue({
    ok: true, data: { ...DETAIL, instrument: { ...DETAIL.instrument, symbol: "VOO", asset_class: "etf" } },
  });
  const user = userEvent.setup();
  renderAt("VOO");
  await waitFor(() => expect(screen.getByRole("heading", { name: "VOO", level: 1 })).toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "Ongoing cost" }));
  const dialog = screen.getByRole("dialog");
  await user.type(within(dialog).getByLabelText("Annual cost (bps)"), "20");
  await user.click(within(dialog).getByRole("button", { name: "Save" }));
  expect(vi.mocked(api.setOngoingCost)).toHaveBeenCalledWith("VOO", 20);
});

test("D-099: an equity page shows no expense-ratio action or card", async () => {
  renderAt(); // DETAIL is equity
  await waitFor(() => expect(screen.getByRole("heading", { name: "AAPL", level: 1 })).toBeInTheDocument());
  expect(screen.queryByRole("button", { name: "Ongoing cost" })).toBeNull();
  expect(screen.queryByText(/Ongoing cost \(expense ratio\)/)).toBeNull();
});

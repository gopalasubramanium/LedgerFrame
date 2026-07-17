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
  mapAmfi: vi.fn(async () => ({ ok: true, data: { ok: true, symbol: "PPFAS", code: "122639", published: 1 } })),
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

test("§14dr-6: choosing amfi_nav reveals the AMFI code field and Save maps it before the PATCH", async () => {
  // The 400 dead-end fix: the edit dialog must let the user supply the AMFI scheme
  // mapping in its one home (instrument_identifiers via the canonical map-amfi writer),
  // then set the source_override. Fail-first RED: today there is no code field and no
  // map-amfi call. A mutual fund with no amfi_code mapped yet.
  vi.mocked(api.getInstrument).mockResolvedValue({
    ok: true,
    data: { ...DETAIL, instrument: { ...DETAIL.instrument, symbol: "PPFAS", name: "PPFAS Flexi Cap", asset_class: "mutual_fund", identifiers: [] } },
  });
  const user = userEvent.setup();
  renderAt("PPFAS");
  await waitFor(() => expect(screen.getByRole("heading", { name: "PPFAS", level: 1 })).toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "Edit" }));
  const dialog = screen.getByRole("dialog");
  await user.selectOptions(within(dialog).getByLabelText("Source override"), "amfi_nav");
  // The AMFI code field appears only when amfi_nav is chosen.
  const code = within(dialog).getByLabelText("AMFI scheme code");
  await user.type(code, "122639");
  await user.click(within(dialog).getByRole("button", { name: "Save" }));
  // Canonical writer first (one home), then the override PATCH.
  expect(vi.mocked(api.mapAmfi)).toHaveBeenCalledWith("PPFAS", "122639");
  expect(vi.mocked(api.patchInstrument)).toHaveBeenCalledWith(
    "PPFAS",
    expect.objectContaining({ source_override: "amfi_nav", asset_class: "mutual_fund" }),
  );
});

test("§14dr-7: 1D/5D ranges are disabled with a reason (daily-only data, no fabricated intraday)", async () => {
  // The store holds daily closes only (every live provider fetches daily), so 1D/5D
  // promised an intraday granularity the data can't differ on — "1D" rendered a couple
  // of daily candles. Honest fix: those ranges are disabled-with-reason until intraday
  // (R-42) lands. Fail-first RED: today they're active buttons.
  const user = userEvent.setup();
  renderAt();
  await waitFor(() => expect(screen.getByRole("heading", { name: "AAPL", level: 1 })).toBeInTheDocument());
  const oneD = screen.getByRole("button", { name: "1D" });
  const fiveD = screen.getByRole("button", { name: "5D" });
  expect(oneD).toBeDisabled();
  expect(fiveD).toBeDisabled();
  expect(oneD).toHaveAccessibleDescription(/daily/i);
  // A clickable range still works and is not disabled.
  expect(screen.getByRole("button", { name: "1M" })).toBeEnabled();
  await user.click(oneD); // no-op while disabled — no throw, no period change
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

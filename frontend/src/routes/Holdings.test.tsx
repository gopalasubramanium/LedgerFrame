import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../theme/ThemeProvider";
import { DisplayProvider } from "../theme/DisplayProvider";
import { RefdataProvider } from "../refdata/RefdataProvider";
import type { HoldingRow } from "../api/holdings";

// Mock the API surface so the page is exercised without a backend.
vi.mock("../api/holdings", () => ({
  getHoldings: vi.fn(),
  getSummary: vi.fn(async () => ({ ok: true, data: { base_currency: "SGD", total_value: 100, day_change: 5 } })),
  getTransactions: vi.fn(async () => ({ ok: true, data: { transactions: [] } })),
  getAccounts: vi.fn(async () => ({ ok: true, data: { accounts: [] } })),
  getTags: vi.fn(async () => ({ ok: true, data: { tags: [] } })),
  addTransaction: vi.fn(async () => ({ ok: true, data: { ok: true, transaction_id: 1 } })),
  addManualHolding: vi.fn(async () => ({ ok: true, data: { ok: true } })),
  deleteTransaction: vi.fn(async () => ({ ok: true, data: { ok: true } })),
  restoreTransaction: vi.fn(async () => ({ ok: true, data: { ok: true } })),
  purgeDeleted: vi.fn(async () => ({ ok: true, data: { ok: true } })),
  setHoldingTags: vi.fn(async () => ({ ok: true, data: { ok: true } })),
  importPreview: vi.fn(),
  importCommit: vi.fn(),
}));
vi.mock("../api/client", async (orig) => ({
  ...(await orig<typeof import("../api/client")>()),
  apiDownload: vi.fn(),
  apiGet: vi.fn(async () => ({ ok: false, error: "no refdata in test" })),
}));

import { Holdings } from "./Holdings";
import * as api from "../api/holdings";
import * as client from "../api/client";

function row(over: Partial<HoldingRow> = {}): HoldingRow {
  return {
    id: 1, symbol: "AAPL", name: "Apple", asset_class: "equity",
    quantity: 10, currency: "USD", price: 190, market_value: 1900,
    cost_basis: 1500, unrealised_pl: 400, day_change: 12, day_change_pct: 0.6,
    is_stale: false, is_priced: true, valuation_method: "market_quote",
    valuation_label: "Live", ...over,
  };
}

function renderPage() {
  return render(
    <ThemeProvider>
      <DisplayProvider>
        <ToastProvider>
          <RefdataProvider>
            <MemoryRouter>
              <Holdings />
            </MemoryRouter>
          </RefdataProvider>
        </ToastProvider>
      </DisplayProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  vi.mocked(api.getHoldings).mockResolvedValue({
    ok: true, data: { base_currency: "SGD", holdings: [row()] },
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test("renders holdings + the linked summary header from the API", async () => {
  renderPage();
  await waitFor(() => expect(screen.getByText("AAPL")).toBeInTheDocument());
  // Linked P-1 summary header naming the position count.
  expect(screen.getByText(/1 position/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Portfolio" })).toBeInTheDocument();
  // Unrealised P/L rendered with a sign.
  expect(screen.getByText("+400.00")).toBeInTheDocument();
});

test("shows an honest empty state with a reason and an Add action", async () => {
  vi.mocked(api.getHoldings).mockResolvedValue({
    ok: true, data: { base_currency: "SGD", holdings: [] },
  });
  renderPage();
  await waitFor(() => expect(screen.getByText("No holdings yet")).toBeInTheDocument());
  expect(screen.getByText(/Add a holding or import/)).toBeInTheDocument();
});

test("shows an honest error state (values withheld, never guessed)", async () => {
  vi.mocked(api.getHoldings).mockResolvedValue({ ok: false, error: "reader down" });
  renderPage();
  await waitFor(() => expect(screen.getByText("Couldn't load holdings")).toBeInTheDocument());
  expect(screen.getByText(/withheld, never guessed/)).toBeInTheDocument();
});

test("Export triggers the server-side download (client never builds the file)", async () => {
  const user = userEvent.setup();
  renderPage();
  await waitFor(() => expect(screen.getByText("AAPL")).toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: /Export/ }));
  expect(vi.mocked(client.apiDownload)).toHaveBeenCalledWith("/portfolio/holdings.csv");
});

test("Add opens the one Add flow with listed / manual branches", async () => {
  const user = userEvent.setup();
  renderPage();
  await waitFor(() => expect(screen.getByText("AAPL")).toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "Add" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByRole("button", { name: "Listed instrument" })).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Manual asset" })).toBeInTheDocument();
});

test("split and bonus get purpose-labelled fields (D-019 way, §4.3 mapping)", async () => {
  const user = userEvent.setup();
  renderPage();
  await waitFor(() => expect(screen.getByText("AAPL")).toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "Add" }));
  const dialog = screen.getByRole("dialog");
  const typeSelect = within(dialog).getByLabelText("Transaction type");

  await user.selectOptions(typeSelect, "split");
  expect(within(dialog).getByLabelText("Split ratio")).toBeInTheDocument();
  expect(within(dialog).queryByLabelText("Price")).toBeNull();
  expect(within(dialog).queryByLabelText("Quantity")).toBeNull();

  await user.selectOptions(typeSelect, "bonus");
  expect(within(dialog).getByLabelText("Bonus units")).toBeInTheDocument();
  expect(within(dialog).queryByLabelText("Price")).toBeNull(); // zero-cost per engine
});

test("deleting a transaction soft-deletes and offers Undo", async () => {
  vi.mocked(api.getTransactions).mockResolvedValue({
    ok: true,
    data: { transactions: [{ id: 7, type: "buy", ts: "2024-05-01T00:00:00", symbol: "AAPL", currency: "USD", amount: -1900 }] },
  });
  const user = userEvent.setup();
  renderPage();
  await waitFor(() => expect(screen.getByText(/2024-05-01/)).toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "Delete" }));
  await waitFor(() => expect(vi.mocked(api.deleteTransaction)).toHaveBeenCalledWith(7));
  const undo = await screen.findByRole("button", { name: "Undo" });
  await user.click(undo);
  expect(vi.mocked(api.restoreTransaction)).toHaveBeenCalledWith(7);
});

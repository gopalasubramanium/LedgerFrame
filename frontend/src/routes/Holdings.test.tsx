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
  getDeletedCount: vi.fn(async () => ({ ok: true, data: { holdings: 0, transactions: 0, total: 0 } })),
  getTags: vi.fn(async () => ({ ok: true, data: { tags: [] } })),
  addTransaction: vi.fn(async () => ({ ok: true, data: { ok: true, transaction_id: 1 } })),
  updateTransaction: vi.fn(async () => ({ ok: true, data: { ok: true } })),
  addManualHolding: vi.fn(async () => ({ ok: true, data: { ok: true } })),
  deleteTransaction: vi.fn(async () => ({ ok: true, data: { ok: true } })),
  restoreTransaction: vi.fn(async () => ({ ok: true, data: { ok: true } })),
  deleteManualHolding: vi.fn(async () => ({ ok: true, data: { ok: true } })),
  restoreManualHolding: vi.fn(async () => ({ ok: true, data: { ok: true } })),
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

test("Add opens the D-089 type-first grid; a type routes to the flow", async () => {
  const user = userEvent.setup();
  renderPage();
  await waitFor(() => expect(screen.getByText("AAPL")).toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "Add" }));
  const dialog = screen.getByRole("dialog");
  // Type-first grid in user vocabulary (no Listed/Manual front door).
  expect(within(dialog).getByText("Stocks & ETFs")).toBeInTheDocument();
  expect(within(dialog).getByText("Crypto")).toBeInTheDocument();
  expect(within(dialog).getByText("Cash & deposits")).toBeInTheDocument();
  expect(within(dialog).queryByRole("button", { name: "Listed instrument" })).toBeNull();
  // A manual type routes to the manual branch with asset class preselected.
  await user.click(within(dialog).getByText("Cash & deposits"));
  expect(within(dialog).getByLabelText("Label")).toBeInTheDocument();
  const cls = within(dialog).getByLabelText("Asset class") as HTMLSelectElement;
  expect(cls.value).toBe("cash");
});

test("split and bonus get purpose-labelled fields (D-019 way, §4.3 mapping)", async () => {
  const user = userEvent.setup();
  renderPage();
  await waitFor(() => expect(screen.getByText("AAPL")).toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "Add" }));
  const dialog = screen.getByRole("dialog");
  await user.click(within(dialog).getByText("Stocks & ETFs")); // D-089 listed tile
  const typeSelect = within(dialog).getByLabelText("Transaction type");

  await user.selectOptions(typeSelect, "split");
  expect(within(dialog).getByLabelText("Split ratio")).toBeInTheDocument();
  expect(within(dialog).queryByLabelText("Price")).toBeNull();
  expect(within(dialog).queryByLabelText("Quantity")).toBeNull();

  await user.selectOptions(typeSelect, "bonus");
  expect(within(dialog).getByLabelText("Bonus units")).toBeInTheDocument();
  expect(within(dialog).queryByLabelText("Price")).toBeNull(); // zero-cost per engine
});

test("dividend/interest/fee use a single Amount field (total-cash types)", async () => {
  const user = userEvent.setup();
  renderPage();
  await waitFor(() => expect(screen.getByText("AAPL")).toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "Add" }));
  const dialog = screen.getByRole("dialog");
  await user.click(within(dialog).getByText("Stocks & ETFs")); // D-089 listed tile
  const typeSelect = within(dialog).getByLabelText("Transaction type");

  await user.selectOptions(typeSelect, "dividend");
  expect(within(dialog).getByLabelText("Amount received")).toBeInTheDocument();
  expect(within(dialog).queryByLabelText("Quantity")).toBeNull();
  expect(within(dialog).queryByLabelText("Price")).toBeNull();

  await user.selectOptions(typeSelect, "fee");
  expect(within(dialog).getByLabelText("Amount")).toBeInTheDocument();
  expect(within(dialog).getByText(/never enter cost basis/)).toBeInTheDocument();
  expect(within(dialog).queryByLabelText("Quantity")).toBeNull();
});

test("dividend submits its Amount as quantity 1 × price (engine total-cash map)", async () => {
  const user = userEvent.setup();
  renderPage();
  await waitFor(() => expect(screen.getByText("AAPL")).toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "Add" }));
  const dialog = screen.getByRole("dialog");
  await user.click(within(dialog).getByText("Stocks & ETFs")); // D-089 listed tile
  await user.selectOptions(within(dialog).getByLabelText("Transaction type"), "dividend");
  // Symbol via the instrument picker's explicit create path.
  await user.type(within(dialog).getByLabelText("Instrument"), "AAPL");
  await user.click(within(dialog).getByText(/Create new instrument/));
  const amount = within(dialog).getByLabelText("Amount received");
  await user.clear(amount);
  await user.type(amount, "125.50");
  await user.click(within(dialog).getByRole("button", { name: "Save" }));
  expect(vi.mocked(api.addTransaction)).toHaveBeenCalledWith(
    expect.objectContaining({ type: "dividend", quantity: 1, price: 125.5, symbol: "AAPL" }),
  );
});

test("a Listed tile classifies the new instrument by type (D-089: crypto → crypto)", async () => {
  const user = userEvent.setup();
  renderPage();
  await waitFor(() => expect(screen.getByText("AAPL")).toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "Add" }));
  const dialog = screen.getByRole("dialog");
  await user.click(within(dialog).getByText("Crypto"));
  await user.type(within(dialog).getByLabelText("Instrument"), "BTC");
  await user.click(within(dialog).getByText(/Create new instrument/));
  const qty = within(dialog).getByLabelText("Quantity");
  await user.clear(qty);
  await user.type(qty, "0.75"); // fractional
  await user.click(within(dialog).getByRole("button", { name: "Save" }));
  expect(vi.mocked(api.addTransaction)).toHaveBeenCalledWith(
    expect.objectContaining({ asset_class: "crypto", symbol: "BTC", quantity: 0.75 }),
  );
});

test("D-092 Insurance tile navigates to the register, never branches the form", async () => {
  const user = userEvent.setup();
  renderPage();
  await waitFor(() => expect(screen.getByText("AAPL")).toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "Add" }));
  const dialog = screen.getByRole("dialog");
  await user.click(within(dialog).getByText(/Policies live in their own register/));
  expect(window.location.hash).toContain("/insurance");
  expect(screen.queryByRole("dialog")).toBeNull(); // form never opened
});

test("D-093 import review grid gates Commit until errors are fixed or excluded", async () => {
  vi.mocked(api.importPreview).mockResolvedValue({
    ok: true,
    data: {
      summary: { total: 2, valid: 1, errors: 1, duplicates: 0, new: 1 },
      rows: [
        { row: 2, ok: true, date: "2024-01-01", type: "buy", symbol: "AAPL", quantity: "10", price: "100", currency: "USD" },
        { row: 3, ok: false, error: "unknown type 'byu'", date: "2024-01-02", type: "byu", symbol: "MSFT", quantity: "5", price: "200", currency: "USD" },
      ],
    },
  });
  const user = userEvent.setup();
  renderPage();
  await waitFor(() => expect(screen.getByText("AAPL")).toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "Import" }));
  const dialog = screen.getByRole("dialog");
  await user.upload(within(dialog).getByLabelText("Import CSV"), new File(["x"], "t.csv", { type: "text/csv" }));
  await waitFor(() => expect(within(dialog).getByText(/need a fix or exclusion/)).toBeInTheDocument());
  expect(within(dialog).getByRole("button", { name: /Commit/ })).toBeDisabled();
  // Exclude the invalid row → commit unlocks.
  const excludes = within(dialog).getAllByRole("button", { name: "Exclude" });
  await user.click(excludes[1]);
  expect(within(dialog).getByRole("button", { name: /Commit/ })).toBeEnabled();
});

test("deleting a transaction soft-deletes and offers Undo", async () => {
  vi.mocked(api.getTransactions).mockResolvedValue({
    ok: true,
    data: { transactions: [{ id: 7, type: "buy", ts: "2024-05-01T00:00:00", symbol: "AAPL", currency: "USD", amount: -1900 }] },
  });
  const user = userEvent.setup();
  renderPage();
  await waitFor(() => expect(screen.getByText(/2024-05-01/)).toBeInTheDocument());
  // Row actions live behind the compact ⋯ menu now.
  await user.click(screen.getByRole("button", { name: /Actions for buy AAPL/ }));
  await user.click(screen.getByRole("menuitem", { name: "Delete" }));
  await waitFor(() => expect(vi.mocked(api.deleteTransaction)).toHaveBeenCalledWith(7));
  const undo = await screen.findByRole("button", { name: "Undo" });
  await user.click(undo);
  expect(vi.mocked(api.restoreTransaction)).toHaveBeenCalledWith(7);
});

test("row menu Edit opens the edit dialog and updates the transaction", async () => {
  vi.mocked(api.getTransactions).mockResolvedValue({
    ok: true,
    data: { transactions: [{ id: 9, type: "buy", ts: "2024-05-01T00:00:00", symbol: "AAPL", quantity: 5, price: 100, currency: "USD", amount: -500 }] },
  });
  const user = userEvent.setup();
  renderPage();
  await waitFor(() => expect(screen.getByText(/2024-05-01/)).toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: /Actions for buy AAPL/ }));
  await user.click(screen.getByRole("menuitem", { name: "Edit" }));
  const dialog = screen.getByRole("dialog");
  const note = within(dialog).getByLabelText("Note");
  await user.type(note, "corrected");
  await user.click(within(dialog).getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(vi.mocked(api.updateTransaction)).toHaveBeenCalledWith(
      9,
      expect.objectContaining({ type: "buy", symbol: "AAPL", note: "corrected" }),
    ),
  );
});

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
  await user.click(await screen.findByText(/Create new instrument/));
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
  await user.click(await screen.findByText(/Create new instrument/));
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
  await screen.findByRole("button", { name: "Import" });
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

test("post-import: the ledger jumps to 'recently added' so imports are visible (item 1)", async () => {
  vi.mocked(api.importPreview).mockResolvedValue({
    ok: true,
    data: {
      summary: { total: 1, valid: 1, errors: 0, duplicates: 0, new: 1 },
      rows: [{ row: 2, ok: true, date: "2019-01-01", type: "buy", symbol: "ZOLD", quantity: "1", price: "5", currency: "USD" }],
    },
  });
  vi.mocked(api.importCommit).mockResolvedValue({ ok: true, data: { ok: true, imported: 1 } });
  const user = userEvent.setup();
  renderPage();
  await screen.findByRole("button", { name: "Import" });
  await user.click(screen.getByRole("button", { name: "Import" }));
  const dialog = screen.getByRole("dialog");
  await user.upload(within(dialog).getByLabelText("Import CSV"), new File(["x"], "t.csv", { type: "text/csv" }));
  await waitFor(() => expect(within(dialog).getByRole("button", { name: /Commit/ })).toBeEnabled());
  await user.click(within(dialog).getByRole("button", { name: /Commit/ }));
  // The ledger refetches sorted by recently-added so the (historical) import shows.
  await waitFor(() =>
    expect(vi.mocked(api.getTransactions)).toHaveBeenCalledWith(
      expect.objectContaining({ sort: "added", dir: "desc", offset: 0 }),
    ),
  );
  expect(await screen.findByText(/most recently added/)).toBeInTheDocument();
});

test("D-091 manual FD tile prompts optional detail; meta is submitted", async () => {
  const user = userEvent.setup();
  renderPage();
  await waitFor(() => expect(screen.getByText("AAPL")).toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "Add" }));
  const dialog = screen.getByRole("dialog");
  await user.click(within(dialog).getByText("Fixed deposit"));
  // Per-class OPTIONAL-PROMPTED fields appear (never required).
  expect(within(dialog).getByLabelText("Interest rate (%)")).toBeInTheDocument();
  expect(within(dialog).getByLabelText("Maturity date")).toBeInTheDocument();
  await user.type(within(dialog).getByLabelText("Label"), "My FD");
  await user.type(within(dialog).getByLabelText("Interest rate (%)"), "3.5");
  await user.click(within(dialog).getByRole("button", { name: "Save" }));
  expect(vi.mocked(api.addManualHolding)).toHaveBeenCalledWith(
    expect.objectContaining({
      asset_class: "fixed_deposit",
      meta: expect.objectContaining({ rate: "3.5" }),
    }),
  );
});

test("D-090 manual FD tile can record a cash-flow transaction, types filtered", async () => {
  // Applicability served (only the txn-applicability path returns data).
  vi.mocked(client.apiGet).mockImplementation((async (path: string) =>
    path === "/refdata/txn-applicability"
      ? { ok: true, data: { fixed_deposit: ["interest", "deposit", "withdrawal", "fee", "transfer"] } }
      : { ok: false, error: "no refdata in test" }) as typeof client.apiGet);
  const user = userEvent.setup();
  renderPage();
  await waitFor(() => expect(screen.getByText("AAPL")).toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "Add" }));
  const dialog = screen.getByRole("dialog");
  await user.click(within(dialog).getByText("Fixed deposit"));
  // Choose "record a transaction" instead of adding the holding.
  await user.selectOptions(within(dialog).getByLabelText("Record"), "txn");
  const typeSelect = within(dialog).getByLabelText("Transaction type") as HTMLSelectElement;
  const opts = Array.from(typeSelect.options).map((o) => o.value);
  expect(opts).toContain("interest");
  expect(opts).not.toContain("buy"); // D-090: cash-flow only, no buy/sell
  await user.type(within(dialog).getByLabelText("Amount"), "120");
  await user.click(within(dialog).getByRole("button", { name: "Save" }));
  expect(vi.mocked(api.addTransaction)).toHaveBeenCalledWith(
    expect.objectContaining({ type: "interest", symbol: null, quantity: 1, price: 120 }),
  );
});

test("D-094 holdings filter runs client-side (bounded dataset)", async () => {
  vi.mocked(api.getHoldings).mockResolvedValue({
    ok: true,
    data: {
      base_currency: "SGD",
      holdings: [row(), row({ id: 2, symbol: "MSFT", name: "Microsoft", market_value: 500 })],
    },
  });
  const user = userEvent.setup();
  renderPage();
  await waitFor(() => expect(screen.getByText("AAPL")).toBeInTheDocument());
  expect(screen.getByText("MSFT")).toBeInTheDocument();
  await user.type(screen.getByLabelText("Filter holdings"), "msft");
  await waitFor(() => expect(screen.queryByText("AAPL")).toBeNull());
  expect(screen.getByText("MSFT")).toBeInTheDocument();
});

test("round-trip: importing a holdings snapshot is guided, not garbled", async () => {
  vi.mocked(api.importPreview).mockResolvedValue({
    ok: true,
    data: {
      format_error:
        "This looks like a holdings snapshot (a positions report), not a transactions file. Use the Transactions “Export” to get a re-importable ledger.",
      rows: [],
      summary: { total: 0, valid: 0, errors: 0, duplicates: 0, new: 0 },
    },
  });
  const user = userEvent.setup();
  renderPage();
  await screen.findByRole("button", { name: "Import" });
  await user.click(screen.getByRole("button", { name: "Import" }));
  const dialog = screen.getByRole("dialog");
  await user.upload(within(dialog).getByLabelText("Import CSV"), new File(["x"], "snap.csv", { type: "text/csv" }));
  // One honest banner, no review grid, no Commit.
  await waitFor(() => expect(within(dialog).getByText(/isn’t a transactions ledger/)).toBeInTheDocument());
  expect(within(dialog).getByText(/holdings snapshot/)).toBeInTheDocument();
  expect(within(dialog).queryByRole("button", { name: /Commit/ })).toBeNull();
});

test("round-trip: the ledger Export downloads the server-side transactions.csv", async () => {
  vi.mocked(api.getTransactions).mockResolvedValue({
    ok: true,
    data: {
      transactions: [{ id: 7, type: "buy", ts: "2024-05-01T00:00:00", symbol: "AAPL", currency: "USD", amount: -1900 }],
      total: 1, offset: 0, limit: 100, sort: "ts", dir: "desc", filter: "",
    },
  });
  const user = userEvent.setup();
  renderPage();
  await waitFor(() => expect(screen.getByText(/2024-05-01/)).toBeInTheDocument());
  // Two server-side exports on the page (holdings snapshot in the header, ledger in
  // the transactions section) — the ledger's is last in the DOM.
  const exports = screen.getAllByRole("button", { name: /Export CSV/ });
  await user.click(exports[exports.length - 1]);
  expect(vi.mocked(client.apiDownload)).toHaveBeenCalledWith("/portfolio/transactions.csv");
});

test("commit request body contains exactly the included rows (payload guard)", async () => {
  vi.mocked(api.importPreview).mockResolvedValue({
    ok: true,
    data: {
      summary: { total: 2, valid: 2, errors: 0, duplicates: 0, new: 2 },
      rows: [
        { row: 2, ok: true, date: "2024-01-01", type: "buy", symbol: "KEEPME", quantity: "10", price: "100", currency: "USD" },
        { row: 3, ok: true, date: "2024-01-02", type: "buy", symbol: "DROPME", quantity: "5", price: "200", currency: "USD" },
      ],
    },
  });
  let committedText = "";
  vi.mocked(api.importCommit).mockImplementation(
    (file: File) =>
      new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          committedText = String(reader.result);
          resolve({ ok: true, data: { ok: true, imported: 1, skipped_duplicates: 0 } });
        };
        reader.readAsText(file);
      }),
  );
  const user = userEvent.setup();
  renderPage();
  await screen.findByRole("button", { name: "Import" });
  await user.click(screen.getByRole("button", { name: "Import" }));
  const dialog = screen.getByRole("dialog");
  await user.upload(within(dialog).getByLabelText("Import CSV"), new File(["x"], "t.csv", { type: "text/csv" }));
  await waitFor(() => expect(within(dialog).getAllByRole("button", { name: "Exclude" })).toHaveLength(2));
  // Exclude the second row → the committed CSV must contain ONLY the first.
  await user.click(within(dialog).getAllByRole("button", { name: "Exclude" })[1]);
  await user.click(within(dialog).getByRole("button", { name: /Commit/ }));
  await waitFor(() => expect(committedText).toContain("KEEPME"));
  expect(committedText).not.toContain("DROPME");
  expect(committedText.split("\n").filter((l) => l.trim()).length).toBe(2); // header + 1 row
});

test("a commit that imports zero shows a WARNING toast, never success styling", async () => {
  vi.mocked(api.importPreview).mockResolvedValue({
    ok: true,
    data: {
      summary: { total: 1, valid: 1, errors: 0, duplicates: 0, new: 1 },
      rows: [{ row: 2, ok: true, date: "2024-01-01", type: "buy", symbol: "DUP", quantity: "1", price: "1", currency: "USD" }],
    },
  });
  vi.mocked(api.importCommit).mockResolvedValue({ ok: true, data: { ok: true, imported: 0, skipped_duplicates: 1 } });
  const user = userEvent.setup();
  renderPage();
  await screen.findByRole("button", { name: "Import" });
  await user.click(screen.getByRole("button", { name: "Import" }));
  const dialog = screen.getByRole("dialog");
  await user.upload(within(dialog).getByLabelText("Import CSV"), new File(["x"], "t.csv", { type: "text/csv" }));
  await waitFor(() => expect(within(dialog).getByRole("button", { name: /Commit/ })).toBeEnabled());
  await user.click(within(dialog).getByRole("button", { name: /Commit/ }));
  expect(await screen.findByText(/No rows were committed/)).toBeInTheDocument();
  expect(screen.getByText(/already in your ledger/)).toBeInTheDocument();
  expect(document.querySelector('.lf-toast[data-tone="warning"]')).not.toBeNull();
});

test("D-096 the import dialog offers a Download template action (server-generated)", async () => {
  const user = userEvent.setup();
  renderPage();
  await screen.findByRole("button", { name: "Import" });
  await user.click(screen.getByRole("button", { name: "Import" }));
  const dialog = screen.getByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name: "Download template" }));
  expect(vi.mocked(client.apiDownload)).toHaveBeenCalledWith("/portfolio/import/template");
});

test("D-094 transactions ledger is server-side: window stated, sort/filter/page hit the API", async () => {
  vi.mocked(api.getTransactions).mockResolvedValue({
    ok: true,
    data: {
      transactions: [
        { id: 7, type: "buy", ts: "2024-05-01T00:00:00", symbol: "AAPL", currency: "USD", amount: -1900 },
      ],
      total: 250, offset: 0, limit: 100, sort: "ts", dir: "desc", filter: "",
    },
  });
  const user = userEvent.setup();
  renderPage();
  await waitFor(() => expect(screen.getByText(/2024-05-01/)).toBeInTheDocument());
  // The window is explicit — the full total is stated, never silently truncated.
  expect(screen.getByText("Showing 1–1 of 250")).toBeInTheDocument();

  // Sorting a column refetches server-side with the sort params.
  await user.click(screen.getByText("Amount"));
  await waitFor(() =>
    expect(vi.mocked(api.getTransactions)).toHaveBeenCalledWith(
      expect.objectContaining({ sort: "amount", dir: "asc", offset: 0 }),
    ),
  );

  // Next page refetches with the new offset (server-side paging).
  await user.click(screen.getByRole("button", { name: /Next/ }));
  await waitFor(() =>
    expect(vi.mocked(api.getTransactions)).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 100 }),
    ),
  );

  // Filtering refetches server-side (debounced) with the filter term.
  await user.type(screen.getByLabelText("Filter transactions"), "aapl");
  await waitFor(() =>
    expect(vi.mocked(api.getTransactions)).toHaveBeenCalledWith(
      expect.objectContaining({ filter: "aapl", offset: 0 }),
    ),
  );
});

test("deleting a transaction soft-deletes and offers Undo", async () => {
  vi.mocked(api.getTransactions).mockResolvedValue({
    ok: true,
    data: { transactions: [{ id: 7, type: "buy", ts: "2024-05-01T00:00:00", symbol: "AAPL", currency: "USD", amount: -1900 }], total: 1, offset: 0, limit: 100, sort: "ts", dir: "desc", filter: "" },
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
    data: { transactions: [{ id: 9, type: "buy", ts: "2024-05-01T00:00:00", symbol: "AAPL", quantity: 5, price: 100, currency: "USD", amount: -500 }], total: 1, offset: 0, limit: 100, sort: "ts", dir: "desc", filter: "" },
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

import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../theme/ThemeProvider";
import { DisplayProvider } from "../theme/DisplayProvider";
import { RefdataProvider } from "../refdata/RefdataProvider";
import { ToastProvider } from "../components/ui";

// A served quote (backend Quote.model_dump shape). change_pct drives Gainers/Losers ordering.
function q(over: Partial<Record<string, unknown>> = {}) {
  return {
    symbol: "X", price: 100, change_pct: 0, currency: "USD", source: "mock",
    entitlement: "delayed", valuation_method: "market_quote",
    market_time: "2026-07-11T00:00:00Z", received_at: "2026-07-11T00:00:00Z", is_stale: false,
    ...over,
  };
}
function instr(symbol: string, pct: number, over: Partial<Record<string, unknown>> = {}) {
  return {
    symbol, name: `${symbol} Inc`, asset_class: "equity", currency: "USD", country: "US",
    held: false, quote: q({ symbol, change_pct: pct, price: 100 + pct }), ...over,
  };
}

const OVERVIEW = {
  ok: true,
  data: {
    quotes: [],
    instruments: [
      instr("AAPL", 2.5, { held: true }),
      instr("MSFT", 1.0),
      instr("GLDX", 0.0), // flat — never a gainer or a loser
      instr("TSLA", -1.2),
      instr("NVDA", -3.4),
    ],
    market_status: { market: "US", state: "open", as_of: "2026-07-11T14:00:00Z", next_change: null },
    demo_mode: true,
  },
};

const GLOBAL = {
  ok: true,
  data: {
    groups: [
      {
        region: "Americas",
        items: [
          // Proxy-sourced index (symbol is a plain ticker) → D-051/ND-6 badge.
          { symbol: "SPY", label: "US · S&P 500", quote: q({ symbol: "SPY", price: 500, change_pct: 0.4 }) },
          // Real index level (symbol starts with ^) → NO proxy badge.
          { symbol: "^DJI", label: "US · Dow Jones", quote: q({ symbol: "^DJI", price: 39000, change_pct: -0.2 }) },
        ],
      },
      {
        region: "Crypto",
        items: [{ symbol: "BTC", label: "Bitcoin", quote: q({ symbol: "BTC", price: 60000, change_pct: 5.1 }) }],
      },
    ],
    market_status: { market: "US", state: "open", as_of: "2026-07-11T14:00:00Z", next_change: null },
    demo_mode: true,
    real_indices: false,
  },
};

const WATCHLISTS = {
  ok: true,
  data: {
    watchlists: [
      { id: 1, name: "Tech watch", items: [{ symbol: "AAPL", name: "Apple", quote: q({ symbol: "AAPL", change_pct: 2.5 }) }] },
      { id: 2, name: "Empty list", items: [] },
    ],
  },
};

const createWatchlist = vi.fn(async () => ({ ok: true, data: { ok: true, id: 3 } }));
const deleteWatchlist = vi.fn(async () => ({ ok: true, data: { ok: true } }));
const addWatchlistItem = vi.fn(async () => ({ ok: true, data: { ok: true } }));
const removeWatchlistItem = vi.fn(async () => ({ ok: true, data: { ok: true } }));

vi.mock("../api/markets", () => ({
  getMarketsOverview: vi.fn(async () => OVERVIEW),
  getMarketsGlobal: vi.fn(async () => GLOBAL),
  getWatchlists: vi.fn(async () => WATCHLISTS),
  getMarketsSearch: vi.fn(async () => ({ ok: true, data: { results: [{ symbol: "TSMC", name: "Taiwan Semi", exchange: null }] } })),
  createWatchlist: (...a: unknown[]) => createWatchlist(...(a as [])),
  deleteWatchlist: (...a: unknown[]) => deleteWatchlist(...(a as [])),
  addWatchlistItem: (...a: unknown[]) => addWatchlistItem(...(a as [])),
  removeWatchlistItem: (...a: unknown[]) => removeWatchlistItem(...(a as [])),
}));

// Keep the InstrumentPicker inert (no provider search in the unit test).
vi.mock("../api/instruments", () => ({
  searchInstruments: vi.fn(async () => ({ ok: true, data: { existing: [], other_class: [], suggestions: [] } })),
}));

// No refdata backend in the test — labelFor falls back to the offline registry.
vi.mock("../api/client", async (orig) => ({
  ...(await orig<typeof import("../api/client")>()),
  apiGet: vi.fn(async () => ({ ok: false, error: "no refdata in test" })),
}));

import { Markets } from "./Markets";

function renderPage() {
  return render(
    <ThemeProvider>
      <DisplayProvider>
        <ToastProvider>
          <RefdataProvider>
            <MemoryRouter initialEntries={["/markets"]}>
              <Markets />
            </MemoryRouter>
          </RefdataProvider>
        </ToastProvider>
      </DisplayProvider>
    </ThemeProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test("market-status pill renders the SERVED state as a labelled chip", async () => {
  renderPage();
  expect(await screen.findByText(/US · Open/)).toBeTruthy();
});

test("Gainers/Losers are a display-sort of served change_pct; losers show ONLY declines (ND-1)", async () => {
  renderPage();
  const movers = (await screen.findByText("Gainers / Losers")).closest("section") as HTMLElement;
  const [gainers, losers] = within(movers).getAllByRole("list");
  // Gainers: positives, sorted desc → AAPL (+2.5) before MSFT (+1.0). No flat/negative symbol.
  const gTxt = gainers.textContent ?? "";
  expect(gTxt.indexOf("AAPL")).toBeGreaterThanOrEqual(0);
  expect(gTxt.indexOf("AAPL")).toBeLessThan(gTxt.indexOf("MSFT"));
  expect(gTxt).not.toMatch(/NVDA|TSLA|GLDX/);
  // Losers: negatives only, sorted asc → NVDA (−3.4) before TSLA (−1.2). Flat GLDX never appears.
  const lTxt = losers.textContent ?? "";
  expect(lTxt.indexOf("NVDA")).toBeGreaterThanOrEqual(0);
  expect(lTxt.indexOf("NVDA")).toBeLessThan(lTxt.indexOf("TSLA"));
  expect(lTxt).not.toMatch(/AAPL|MSFT|GLDX/);
});

test("which-list rule: shows Gainers / Losers, NEVER Contributors/Detractors (D-024, protected copy)", async () => {
  const { container } = renderPage();
  await screen.findByText("Gainers / Losers");
  const txt = container.textContent ?? "";
  expect(txt).toMatch(/Gainers/);
  expect(txt).toMatch(/Losers/);
  // The contribution-weighted pair is Portfolio's — it must never leak onto Markets.
  expect(txt).not.toMatch(/Contributors/);
  expect(txt).not.toMatch(/Detractors/);
});

test("Global tab badges a proxy-sourced index and NOT a real index level (ND-6, D-051)", async () => {
  renderPage();
  // Americas is the default region tab; S&P 500 is served via the SPY ETF proxy → badged.
  expect(await screen.findByText(/via SPY proxy/)).toBeTruthy();
  // The Dow row is a real ^-index level → no proxy badge on it.
  const dow = (await screen.findByText("US · Dow Jones")).closest("li") as HTMLElement;
  expect(dow.textContent).not.toMatch(/proxy/);
});

test("region segmented tabs switch the SERVED Global group (ND-2, no client region model)", async () => {
  const user = userEvent.setup();
  renderPage();
  await screen.findByText("US · S&P 500");
  await user.click(screen.getByRole("button", { name: "Crypto" }));
  await waitFor(() => expect(screen.getByText("Bitcoin")).toBeTruthy());
  expect(screen.queryByText("US · S&P 500")).toBeNull();
});

test("instrument grid renders served instruments with a Held badge + search filter (ND-2)", async () => {
  const user = userEvent.setup();
  renderPage();
  const grid = (await screen.findByText("Instruments")).closest("section") as HTMLElement;
  await waitFor(() => expect(within(grid).getAllByText("AAPL").length).toBeGreaterThan(0));
  expect(within(grid).getByText("Held")).toBeTruthy();
  // Client-side search narrows to matching rows.
  await user.type(within(grid).getByRole("searchbox", { name: /Search instruments/ }), "NVDA");
  await waitFor(() => {
    expect(within(grid).getByText("NVDA")).toBeTruthy();
    expect(within(grid).queryByText("MSFT")).toBeNull();
  });
});

test("page-level search hits /markets/search; a hit links to InstrumentDetail (ND-5, §12mk1-5)", async () => {
  const user = userEvent.setup();
  renderPage();
  await screen.findByText("Find a symbol");
  await user.type(screen.getByLabelText("Search markets"), "tsm");
  // TSMC is only in the served search results (not the grid), so it uniquely identifies the hit.
  const link = await screen.findByRole("link", { name: "TSMC" });
  expect(link.getAttribute("href")).toContain("/instrument/TSMC");
});

test("create watchlist: dialog → createWatchlist([S]-gated) with the entered name (ND-4)", async () => {
  const user = userEvent.setup();
  renderPage();
  await screen.findByText("Watchlists");
  // "New watchlist" is offered in both the header (icon) and the card — either opens the dialog.
  await user.click(screen.getAllByRole("button", { name: "New watchlist" })[0]);
  const dialog = await screen.findByRole("dialog");
  await user.type(within(dialog).getByLabelText("Watchlist name"), "Energy");
  await user.click(within(dialog).getByRole("button", { name: "Create" }));
  await waitFor(() => expect(createWatchlist).toHaveBeenCalledWith("Energy"));
});

test("delete watchlist: ConfirmDialog → deleteWatchlist(id) (ND-4, destructive, [S])", async () => {
  const user = userEvent.setup();
  renderPage();
  await screen.findByText("Tech watch");
  await user.click(screen.getByRole("button", { name: "Actions for Tech watch" }));
  await user.click(await screen.findByText("Delete list"));
  const dialog = await screen.findByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name: "Delete" }));
  await waitFor(() => expect(deleteWatchlist).toHaveBeenCalledWith(1));
});

test("remove watchlist item: RowMenu → removeWatchlistItem(id, symbol) (ND-4)", async () => {
  const user = userEvent.setup();
  renderPage();
  await screen.findByText("Tech watch");
  await user.click(screen.getByRole("button", { name: "Actions for AAPL" }));
  await user.click(await screen.findByText("Remove"));
  await waitFor(() => expect(removeWatchlistItem).toHaveBeenCalledWith(1, "AAPL"));
});

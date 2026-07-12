import { afterEach, expect, test, vi } from "vitest";

// R-17 (page-markets ND-5): the TickerStrip's world-index entries link to /markets (the Markets-group
// home that owns them); holdings still link to their instrument-detail page (D-098). Both hrefs are
// set in fetchTickerQuotes — this pins that mapping so a regression can't silently unlink the indices.

const apiGet = vi.fn();
vi.mock("./client", () => ({ apiGet: (...a: unknown[]) => apiGet(...(a as [])) }));

import { fetchTickerQuotes } from "./chrome";

afterEach(() => vi.clearAllMocks());

test("holdings link to /instrument/{symbol}; world indices link to /markets (R-17)", async () => {
  apiGet.mockImplementation(async (path: string) => {
    if (path === "/portfolio/holdings") {
      return { ok: true, data: { holdings: [{ symbol: "AAPL", price: 190, day_change_pct: 1.2, is_stale: false }] } };
    }
    if (path === "/markets/global") {
      return {
        ok: true,
        data: { groups: [{ items: [{ symbol: "SPY", label: "US · S&P 500", quote: { price: 500, change_pct: 0.4, is_stale: false } }] }] },
      };
    }
    return { ok: false, error: "unexpected path" };
  });

  const quotes = await fetchTickerQuotes();
  const holding = quotes.find((x) => x.symbol === "AAPL");
  const index = quotes.find((x) => x.symbol === "US · S&P 500");
  expect(holding?.href).toBe("/instrument/AAPL");
  expect(index?.href).toBe("/markets"); // R-17: no longer unlinked
});

test("a failed reader contributes nothing (degrades safely, never a dead link)", async () => {
  apiGet.mockResolvedValue({ ok: false, error: "unreachable" });
  const quotes = await fetchTickerQuotes();
  expect(quotes).toEqual([]);
});

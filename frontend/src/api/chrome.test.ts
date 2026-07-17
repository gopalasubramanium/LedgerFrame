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

test("§14dr-9 — ticker stale marks == the shared reader's set (holdings only); world indices carry no pricing-health mark", async () => {
  // The shared reader (StaleBanner / Pricing Health `stale_count`) counts PORTFOLIO HOLDINGS only.
  // World indices refresh on their own cadence and are routinely >900s stale — if the ticker marked
  // them too, "most instruments" read as stale while the banner shows 1. The ticker's pricing-health
  // triangle must equal the shared set: stale holdings marked, indices never marked (their freshness
  // home is Markets, IA P-1). Fail-first RED: today index rows carry `stale: true`.
  apiGet.mockImplementation(async (path: string) => {
    if (path === "/portfolio/holdings") {
      return {
        ok: true,
        data: {
          holdings: [
            { symbol: "AAPL", price: 190, day_change_pct: 1.2, is_stale: false },
            { symbol: "DBS", price: 33, day_change_pct: -0.3, is_stale: true }, // the one stale holding
          ],
        },
      };
    }
    if (path === "/markets/global") {
      return {
        ok: true,
        data: { groups: [{ items: [
          { symbol: "SPY", label: "US · S&P 500", quote: { price: 500, change_pct: 0.4, is_stale: true } },
          { symbol: "N225", label: "JP · Nikkei 225", quote: { price: 39000, change_pct: 0.1, is_stale: true } },
        ] }] },
      };
    }
    return { ok: false, error: "unexpected path" };
  });

  const quotes = await fetchTickerQuotes();
  // Holdings: marked iff the served is_stale (== the shared reader's summand).
  expect(quotes.find((x) => x.symbol === "AAPL")?.stale).toBe(false);
  expect(quotes.find((x) => x.symbol === "DBS")?.stale).toBe(true);
  // World indices: NEVER a pricing-health stale mark, even though served is_stale is true.
  expect(quotes.find((x) => x.symbol === "US · S&P 500")?.stale).toBeFalsy();
  expect(quotes.find((x) => x.symbol === "JP · Nikkei 225")?.stale).toBeFalsy();
  // Reconciliation: the ticker's stale set is exactly the stale holdings.
  const staleSet = quotes.filter((x) => x.stale).map((x) => x.symbol);
  expect(staleSet).toEqual(["DBS"]);
});

test("a failed reader contributes nothing (degrades safely, never a dead link)", async () => {
  apiGet.mockResolvedValue({ ok: false, error: "unreachable" });
  const quotes = await fetchTickerQuotes();
  expect(quotes).toEqual([]);
});

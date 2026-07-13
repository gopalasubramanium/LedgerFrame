import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { RefdataProvider } from "../refdata/RefdataProvider";
import { Home } from "./Home";

// page-home Phase 2 — Home is a COMPOSITION of linked summaries. These tests assert what it must
// show, what it must never show, and that it stays honest when a reader fails. Geometry is NOT
// tested here (jsdom has no layout engine, ADR-0004) — that lives in e2e/tile-integrity.spec.ts.

const SUMMARY = {
  base_currency: "SGD",
  total_value: "796216.68",
  gross_assets: "1216216.68",
  liabilities: "420000.00",
  day_change: "2140.55",
  has_stale: true,
  stale_count: 2,
  allocation_by_class: { equity: "496839.20", cash: "57327.60" },
  // The SERVED field names differ from the SHOWN labels — the enum key must never leak into copy.
  top_gainers: [{ id: 1, symbol: "VWRA", day_change_pct: "0.18" }],
  top_losers: [{ id: 2, symbol: "RELIANCE", day_change_pct: "-0.09" }],
};
const REVIEW = {
  count: 3,
  items: [
    { title: "Cash runway below 3 months", severity: "Review", area: "Liquidity" },
    { title: "2 holdings need a price source", severity: "Review", area: "Data" },
    { title: "Allocation drift within bands", severity: "Ok", area: "Policy" },
    { title: "A fourth item Home must NOT list", severity: "Info", area: "Estate" },
  ],
};
const MARKETS = {
  instruments: [
    { symbol: "NVDA", name: "NVIDIA", quote: { symbol: "NVDA", price: "1204.30", change_pct: "2.41", currency: "USD", is_stale: false, received_at: "" } },
    { symbol: "DIA", name: "Dow", quote: { symbol: "DIA", price: "400.00", change_pct: "-1.50", currency: "USD", is_stale: false, received_at: "" } },
  ],
};

interface Opts {
  noEgress?: boolean;
  summaryFails?: boolean;
  emptyBriefing?: boolean;
}

function stub(opts: Opts = {}) {
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/portfolio/summary"))
        return opts.summaryFails ? json({ detail: "boom" }, 500) : json(SUMMARY);
      if (u.includes("/portfolio/performance"))
        return json({ base_currency: "SGD", series: [{ ts: "1", value: 1 }, { ts: "2", value: 2 }], benchmark: [], stats: {} });
      if (u.includes("/portfolio/review")) return json(REVIEW);
      if (u.includes("/briefing"))
        return json({ text: opts.emptyBriefing ? "" : "Your net worth rose today.", generated_at: "" });
      if (u.includes("/news/grouped"))
        return json({
          no_egress: !!opts.noEgress,
          total: 1,
          groups: opts.noEgress
            ? []
            : [{ name: "My holdings", items: [{ headline: "Nvidia extends rally", source: "Reuters", published_at: null }] }],
        });
      if (u.includes("/markets/overview")) return json(MARKETS);
      if (u.includes("/portfolio/holdings"))
        return json({
          holdings: [
            { id: 1, symbol: "BTC", name: "Bitcoin", price: "66084.90", day_change_pct: "-0.50", currency: "USD", is_priced: true, is_stale: true, price_ts: "2026-07-13T18:02:00Z" },
          ],
        });
      if (u.includes("/settings"))
        return json({ stored: {}, defaults: { home_quote_source: "holdings", home_quote_sources: ["markets", "holdings", "global", "watchlist"] } });
      if (u.includes("/refdata")) return json({ vocabularies: {} });
      return json({});
    }),
  );
}

function renderHome() {
  return render(
    <MemoryRouter>
      <RefdataProvider>
        <Home />
      </RefdataProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => stub());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test("renders the D-046 widget set — and NO layout branch exists (§12ho1-6)", async () => {
  const { container } = renderHome();
  // "news", not "briefing": §12ho2-7 retitled the tile — it shows headlines as well as the Briefing,
  // and naming the whole tile after one of its two parts mislabelled the rest.
  for (const card of ["networth", "change", "review", "allocation", "movers", "news", "quotes"]) {
    await waitFor(() => expect(container.querySelector(`[data-card="${card}"]`)).not.toBeNull());
  }
  // There is exactly ONE layout. Nothing on this page may branch on a layout, and no card is left
  // in a skeleton once its reader answers.
  await waitFor(() => expect(container.querySelectorAll(".lf-skeleton")).toHaveLength(0));
  expect(container.querySelectorAll("[data-card]")).toHaveLength(7);
});

test("D-024: BOTH movers pairs, under their OWN canonical names — never interchanged", async () => {
  renderHome();
  // Portfolio's contribution-weighted pair and Markets' price-move pair are DIFFERENT things.
  await screen.findByText("Contributors");
  await screen.findByText("Detractors");
  await screen.findByText("Gainers");
  await screen.findByText("Losers");
  // The served field names (`top_gainers` / `top_losers`) must NOT leak into the copy: Portfolio's
  // pair is Contributors/Detractors, so VWRA (a served "top_gainer") must sit under Contributors.
  const movers = document.querySelector('[data-card="movers"]') as HTMLElement;
  expect(within(movers).getByText("VWRA")).toBeTruthy();
  expect(within(movers).getByText("NVDA")).toBeTruthy(); // Markets' pair, from its own reader
});

test("the attention count is the SERVED count — Home never recounts (reconciles with /review)", async () => {
  renderHome();
  // The reader serves count=3 while carrying FOUR items. Home shows the served count verbatim and
  // lists only the top 3 — a summary never out-details its canonical page (P-1).
  await screen.findByText(/3 need a look/);
  expect(screen.queryByText("A fourth item Home must NOT list")).toBeNull();
});

test("Guarantee 3: per-item staleness is PRESERVED in the summary, never presented as fresh", async () => {
  renderHome();
  // The headline tile carries the served stale flag…
  await screen.findByText(/2 of these prices are stale/);
  // …and the compact quote cards carry their OWN per-item staleness (BTC is served stale) — a
  // summary must not drop the honesty flag its canonical page shows.
  await waitFor(() => {
    const quotes = document.querySelector('[data-card="quotes"]') as HTMLElement;
    expect(quotes.querySelector(".lf-stale")).not.toBeNull();
  });
});

test("Guarantee 5: under no-egress the headlines show the REASON — no fetch, no invented item", async () => {
  stub({ noEgress: true });
  renderHome();
  await screen.findByText("No headlines right now.");
  await screen.findByText(/No-egress is on/);
  expect(screen.queryByText("Nvidia extends rally")).toBeNull();
});

test("an unreachable reader is HONEST — a reason and a retry, never a guessed figure", async () => {
  stub({ summaryFails: true });
  renderHome();
  const errs = await screen.findAllByText("Couldn't load this summary");
  expect(errs.length).toBeGreaterThan(0);
  await screen.findAllByText(/held back rather than guessed/);
  // The figure is WITHHELD — the page must not invent a zero.
  expect(screen.queryByText(/796,216\.68/)).toBeNull();
  // …and the cards whose readers DID answer still render: one bad reader never blanks the page.
  expect(document.querySelector('[data-card="news"]')).not.toBeNull();
});

test("an empty briefing says WHY (Guarantee 3) rather than showing an empty box", async () => {
  stub({ emptyBriefing: true });
  renderHome();
  await screen.findByText("No briefing yet.");
});

test("copy hygiene: no decision ID or implementation note reaches the user", async () => {
  const { container } = renderHome();
  await screen.findByText(/3 need a look/);
  const text = container.textContent ?? "";
  for (const leak of ["D-0", "P-1", "§", "top_gainers", "top_losers", "allocation_by_class", "canonical", "reader"]) {
    expect(text.includes(leak), `user copy leaks ${leak}`).toBe(false);
  }
});

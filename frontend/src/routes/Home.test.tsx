import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../theme/ThemeProvider";
import { DisplayProvider } from "../theme/DisplayProvider";

// page-home Phase 2. Home OWNS NOTHING — these tests guard exactly that: the composition per LAYOUT
// (served, §9-3), the honesty of every widget's empty/stale state (Guarantee 3/5), the D-024 label
// integrity of the two movers pairs, and the reconciliation of the counts Home only SUMMARISES.

const SUMMARY = {
  base_currency: "SGD",
  total_value: 100000,
  gross_assets: 110000,
  liabilities: -10000,
  cash_and_deposits: 5000,
  cost_basis: 90000,
  unrealised_pl: 10000,
  day_change: 250.5,
  total_return_pct: 11.1,
  has_stale: true,
  stale_count: 2,
  allocation_by_class: { equity: 70000, crypto: 30000 },
  allocation_by_currency: { SGD: 100000 },
  allocation_by_sector: { Tech: 100000 },
  top_gainers: [{ id: 1, label: "Apple", symbol: "AAPL", price: 1, currency: "USD", market_value: 1, day_change: 5, day_change_pct: 1.2 }],
  top_losers: [{ id: 2, label: "DBS", symbol: "DBS", price: 1, currency: "SGD", market_value: 1, day_change: -3, day_change_pct: -0.8 }],
};
const REVIEW = {
  as_of: "2026-07-13",
  count: 2,
  items: [
    { area: "Pricing", title: "Two holdings are stale", severity: "Review" },
    { area: "Policy", title: "Drift is within band", severity: "Info" },
  ],
};
const PERF = { base_currency: "SGD", benchmark_symbol: "SPY", series: [{ ts: "a", value: 1 }, { ts: "b", value: 2 }], benchmark: [], stats: null };
const BRIEFING = { text: "Your portfolio rose today.", generated_at: "2026-07-13T00:00:00Z" };
const NEWS = {
  total: 1,
  no_egress: false,
  groups: [{ name: "My holdings", items: [{ headline: "Apple ships something", source: "Reuters", url: "https://e.com", published_at: "2026-07-13T00:00:00Z", symbols: ["AAPL"] }] }],
};
const OVERVIEW = {
  quotes: [],
  market_status: { market: "US", state: "open", as_of: "" },
  demo_mode: true,
  instruments: [
    { symbol: "UP", name: "Riser", asset_class: "equity", currency: "USD", country: "US", held: false, quote: { symbol: "UP", price: 10, change_pct: 3.5, currency: "USD", source: "s", entitlement: "delayed", valuation_method: "market_quote", received_at: "", is_stale: false } },
    { symbol: "DOWN", name: "Faller", asset_class: "equity", currency: "USD", country: "US", held: false, quote: { symbol: "DOWN", price: 8, change_pct: -2.1, currency: "USD", source: "s", entitlement: "delayed", valuation_method: "market_quote", received_at: "", is_stale: true } },
  ],
};
const HOLDINGS = {
  base_currency: "SGD",
  holdings: [
    { id: 1, symbol: "AAPL", name: "Apple", asset_class: "equity", currency: "USD", price: 190, price_display: "190.00", day_change_pct: 1.2, market_value: 1000, is_priced: true, is_stale: true, price_ts: "2026-07-12T00:00:00Z" },
  ],
};

const prefs = vi.fn(async () => ({ layout: "full", quoteSource: "holdings" }));
const summary = vi.fn(async () => ({ ok: true, data: SUMMARY }));
const review = vi.fn(async () => ({ ok: true, data: REVIEW }));
const briefing = vi.fn(async () => ({ ok: true, data: BRIEFING }));
const news = vi.fn(async () => ({ ok: true, data: NEWS }));
const perf = vi.fn(async () => ({ ok: true, data: PERF }));
const overview = vi.fn(async () => ({ ok: true, data: OVERVIEW }));
const holdings = vi.fn(async () => ({ ok: true, data: HOLDINGS }));

vi.mock("../api/home", () => ({ getHomePrefs: () => prefs() }));
vi.mock("../api/portfolio", () => ({ getPortfolioSummary: () => summary(), getPerformance: () => perf() }));
vi.mock("../api/net-worth", () => ({ getReview: () => review() }));
vi.mock("../api/news", () => ({ getBriefing: () => briefing(), getGroupedNews: () => news() }));
vi.mock("../api/markets", () => ({
  getMarketsOverview: () => overview(),
  getMarketsGlobal: async () => ({ ok: true, data: { groups: [] } }),
  getWatchlists: async () => ({ ok: true, data: { watchlists: [] } }),
}));
vi.mock("../api/holdings", () => ({ getHoldings: () => holdings() }));

import { Home } from "./Home";

function renderPage() {
  return render(
    <ThemeProvider>
      <DisplayProvider>
        <MemoryRouter initialEntries={["/"]}>
          <Home />
        </MemoryRouter>
      </DisplayProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  prefs.mockResolvedValue({ layout: "full", quoteSource: "holdings" });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// --- §9-3 / §9-2a: the LAYOUT is served, and it decides the composition ------------------------

test("FULL renders the whole D-046 set (served layout)", async () => {
  const { container } = renderPage();
  await waitFor(() => expect(screen.getByRole("heading", { name: "Home" })).toBeTruthy());
  for (const card of ["headline", "performance", "allocation", "movers", "review", "briefing", "quotes"]) {
    await waitFor(() => expect(container.querySelector(`[data-card="${card}"]`)).not.toBeNull());
  }
});

test("SIMPLE renders ONLY headline + ReviewCard + briefing — and fetches nothing else (D-046)", async () => {
  prefs.mockResolvedValue({ layout: "simple", quoteSource: "holdings" });
  const { container } = renderPage();
  // SIMPLE = headline + ReviewCard + briefing (D-046) — assert all THREE are present. The first
  // version of this test only asserted the absences, which is exactly how a missing ReviewCard
  // reached the pre-pass (Phase 3a caught it). An "is not there" test needs its "is there" half.
  await waitFor(() => expect(container.querySelector('[data-card="headline"]')).not.toBeNull());
  await waitFor(() => expect(container.querySelector('[data-card="review"]')).not.toBeNull());
  expect(container.querySelector('[data-card="briefing"]')).not.toBeNull();
  // The Full-only widgets are ABSENT — a layout is a composition, not a CSS hide…
  expect(container.querySelector('[data-card="performance"]')).toBeNull();
  expect(container.querySelector('[data-card="allocation"]')).toBeNull();
  expect(container.querySelector('[data-card="movers"]')).toBeNull();
  expect(container.querySelector('[data-card="quotes"]')).toBeNull();
  // …and their readers are never even called.
  expect(perf).not.toHaveBeenCalled();
  expect(overview).not.toHaveBeenCalled();
  expect(news).not.toHaveBeenCalled();
});

test("an unreachable settings reader shows an honest error + retry — never an invented layout", async () => {
  prefs.mockResolvedValue(null as never);
  renderPage();
  expect(await screen.findByText("Couldn't load your Home layout")).toBeTruthy();
  expect(screen.getByText(/rather than guess a layout/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
});

// --- D-024: the two movers pairs are NEVER interchanged ----------------------------------------

test("both movers pairs render under their OWN canonical labels (D-024)", async () => {
  renderPage();
  // Portfolio's pair is contribution-weighted…
  expect(await screen.findByText("Contributors — today")).toBeTruthy();
  expect(screen.getByText("Detractors — today")).toBeTruthy();
  // …Markets' pair is price-move. Both are present; neither borrows the other's name.
  expect(screen.getByText("Gainers — today")).toBeTruthy();
  expect(screen.getByText("Losers — today")).toBeTruthy();
  // The price-move pair is a DISPLAY SORT of the served change_pct: UP gained, DOWN fell. It arrives
  // on its OWN reader (progressive per-card loading), so it is awaited rather than assumed present.
  expect(await screen.findByText("UP")).toBeTruthy();
  expect(await screen.findByText("DOWN")).toBeTruthy();
});

// --- Reconciliation: Home only SUMMARISES; the count is the reader's ---------------------------

test("the ReviewCard attention count is the SERVED count — Home never recounts", async () => {
  renderPage();
  // The reader served count: 2 (and Home renders exactly that; it does not re-derive it from items).
  expect(await screen.findByText(/2 needs? a look/)).toBeTruthy();
  expect(screen.getByText("Two holdings are stale")).toBeTruthy();
});

// --- Guarantee 3 / 5: honesty per widget -------------------------------------------------------

test("the served stale count is surfaced on the headline (never hidden)", async () => {
  renderPage();
  await waitFor(() => expect(screen.getByText(/2 stale/)).toBeTruthy());
});

test("per-item staleness survives into the compact quote cards", async () => {
  const { container } = renderPage();
  // The one holding is stale → its card carries the chip (staleness is served, never inferred).
  await waitFor(() => expect(container.querySelector('[data-card="quotes"] .lf-chip--stale, [data-card="quotes"] .lf-stale')).not.toBeNull());
});

test("no-egress shows the honest reason instead of headlines (Guarantee 5)", async () => {
  news.mockResolvedValue({ ok: true, data: { ...NEWS, no_egress: true, groups: [], total: 0 } } as never);
  renderPage();
  expect(await screen.findByText(/No-egress is on/)).toBeTruthy();
});

test("an empty briefing shows a reason, never a fabricated summary (Guarantee 3)", async () => {
  briefing.mockResolvedValue({ ok: true, data: { text: "", generated_at: null } } as never);
  renderPage();
  expect(await screen.findByText("No briefing yet.")).toBeTruthy();
});

test("an unreachable widget reader withholds the figure and offers a retry — it never guesses", async () => {
  summary.mockResolvedValue({ ok: false, error: "boom" } as never);
  renderPage();
  const errs = await screen.findAllByText("Couldn't load this summary");
  expect(errs.length).toBeGreaterThan(0);
  expect(screen.getAllByText(/held back rather than guessed/).length).toBeGreaterThan(0);
});

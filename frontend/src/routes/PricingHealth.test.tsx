import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../theme/ThemeProvider";
import { DisplayProvider } from "../theme/DisplayProvider";
import { RefdataProvider } from "../refdata/RefdataProvider";
import { ToastProvider } from "../components/ui";

function row(over: Partial<Record<string, unknown>>) {
  return {
    id: 1, symbol: "AAPL", label: "AAPL", asset_class: "equity", sector: "Technology", exchange: "NASDAQ",
    currency: "USD", native_price: 190, market_value: 1900, valuation_method: "market_quote",
    valuation_label: "Market quote", status: "Fresh", source: "market", entitlement: "delayed",
    price_ts: "2026-07-11T00:00:00Z", is_stale: false, failure_reason: null, source_override: null,
    failure_state: null, failure_at: null, failure_note: null,
    route_lane: "equity", route_source: "market", priority_chain: ["market", "manual"],
    mapping_required: false, auth_required: false, route_rule: "lane", route_reason: null,
    confidence: 92, confidence_band: "high", confidence_factors: ["Live market quote"],
    ...over,
  };
}

vi.mock("../api/pricing-health", () => ({
  getPricingHealth: vi.fn(async () => ({
    ok: true,
    data: {
      base_currency: "SGD",
      holdings: [
        // Each holding carries a distinct served route_rule so the provenance column shows all four
        // values (§9-10): matrix · override · lane · active.
        // §18-R4: a realistic served chain — one keyed provider and one supported-but-unkeyed.
        row({ id: 1, symbol: "AAPL", label: "AAPL", status: "Fresh", is_stale: false, confidence: 92, confidence_band: "high", route_rule: "matrix", route_source: "yahoo",
          priority_chain: ["eodhd", "yahoo", "manual"],
          priority_chain_detail: [
            { source: "eodhd", keyed: false, note: "(no key)" },
            { source: "yahoo", keyed: true, note: null },
            { source: "manual", keyed: true, note: null },
          ] }),
        row({ id: 2, symbol: "D05", label: "DBS", status: "Cached", is_stale: true, confidence: 60, confidence_band: "medium", source: "kite", auth_required: true, route_rule: "override", source_override: "kite" }),
        row({ id: 3, symbol: null, label: "My Flat", status: "Manual", is_stale: false, confidence: 40, confidence_band: "low", valuation_method: "manual_valuation", source: "manual", priority_chain: [], route_rule: "lane" }),
        row({ id: 4, symbol: "RELIANCE", label: "Reliance", status: "Delayed", is_stale: true, confidence: 55, confidence_band: "medium", route_rule: "active" }),
      ],
      summary: { Fresh: 1, Cached: 1, Manual: 1, Delayed: 1 },
      confidence: { overall: 68, overall_band: "medium", by_band: { high: { count: 1, value_pct: 40 }, medium: { count: 2, value_pct: 45 }, low: { count: 1, value_pct: 15 } } },
      provider_tier_note: null,
    },
  })),
  getIdentifierDuplicates: vi.fn(async () => ({ ok: true, data: { duplicates: [], count: 0 } })),
  getNoEgress: vi.fn(async () => false),
  refreshHolding: vi.fn(async () => ({ ok: true, data: { ok: true, refreshed: true } })),
  refreshAllData: vi.fn(async () => ({ ok: true, data: { ok: true, refreshed: 2, total: 4, skipped: 0, succeeded: [], failed: [], still_stale: [], errors: [] } })),
  refreshAllMarketData: vi.fn(async () => [
    { lane: "Quotes & indices", ok: true, detail: "Refreshed 2 of 4" },
    { lane: "FX rates", ok: true, detail: "Updated 30 rates" },
    { lane: "News", ok: true, detail: "Briefing refreshed" },
  ]),
  correctSource: vi.fn(async () => ({ ok: true, data: { ok: true } })),
}));

vi.mock("../api/client", async (orig) => ({
  ...(await orig<typeof import("../api/client")>()),
  apiGet: vi.fn(async () => ({ ok: false, error: "no refdata in test" })),
}));

// The shared stale-count store (§12ph1-1) — the SAME source the StaleBanner reads. Return a value
// distinct from the holdings' own is_stale count so the test proves the footnote renders the shared
// value, never an independently-computed one.
vi.mock("../state/staleCount", () => ({
  useStaleCount: () => ({ count: 3, loaded: true }),
  invalidateStaleCount: vi.fn(),
}));

import { PricingHealth } from "./PricingHealth";
import { correctSource, getIdentifierDuplicates, getNoEgress, getPricingHealth } from "../api/pricing-health";

function renderPage() {
  return render(
    <ThemeProvider>
      <DisplayProvider>
        <ToastProvider>
          <RefdataProvider>
            <MemoryRouter initialEntries={["/pricing-health"]}>
              <PricingHealth />
            </MemoryRouter>
          </RefdataProvider>
        </ToastProvider>
      </DisplayProvider>
    </ThemeProvider>,
  );
}

afterEach(cleanup);

test("per-holding diagnostics render with served status + confidence chips", async () => {
  renderPage();
  expect(await screen.findByText("Per-holding diagnostics")).toBeTruthy();
  await waitFor(() => {
    expect(screen.getByText("DBS")).toBeTruthy();
    // Status chips are the served labels (no client invention).
    expect(screen.getAllByText("Cached").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Delayed").length).toBeGreaterThan(0);
  });
});

test("footnote renders the SHARED stale count, not its own (§12ph1-1)", async () => {
  renderPage();
  // The shared store (which the StaleBanner also reads) returns 3; the mocked holdings have 2
  // is_stale rows. The footnote must show 3 — the shared/banner value — never the 2 it could compute
  // itself, so it can't claim "matches the Stale banner" while displaying a different number.
  const el = await screen.findByTestId("ph-stale-count");
  expect(el.textContent).toBe("3");
});

test("§14dr-3 — stale rows are MARKED and PINNED to the top (identifiable at the destination)", async () => {
  const { container } = renderPage();
  await screen.findByText("Per-holding diagnostics");
  await waitFor(() => expect(screen.getByText("DBS")).toBeTruthy());
  // MARKED: exactly the two is_stale holdings (DBS, Reliance) carry a Stale marker — the SAME served
  // flag the banner sums, so "marked rows == banner count" holds by construction (§14ac-2).
  expect(screen.getAllByText("Stale").length).toBe(2);
  // PINNED: the two stale rows are the top two rows of the diagnostics table — found with zero
  // interaction, not buried below the fresh ones (arrival alone doesn't answer "which two").
  const bodyRows = container.querySelectorAll('[data-card="diagnostics"] tbody tr');
  expect(within(bodyRows[0] as HTMLElement).getByText("DBS")).toBeTruthy();
  expect(within(bodyRows[1] as HTMLElement).getByText("Reliance")).toBeTruthy();
  // A fresh row (AAPL) carries no Stale marker.
  const aaplRow = Array.from(bodyRows).find((r) => within(r as HTMLElement).queryByText("AAPL"));
  expect(within(aaplRow as HTMLElement).queryByText("Stale")).toBeNull();
});

test("§14dr-3 — the diagnostics table is genuinely sortable (a header click re-sorts)", async () => {
  const user = userEvent.setup();
  const { container } = renderPage();
  await screen.findByText("Per-holding diagnostics");
  await waitFor(() => expect(screen.getByText("DBS")).toBeTruthy());
  // Sort by Holding ascending — the inert-sortable headers are now wired (§14dr-3), so the order
  // changes from the stale-first default to alphabetical (AAPL first).
  await user.click(screen.getByRole("columnheader", { name: "Holding" }));
  const bodyRows = container.querySelectorAll('[data-card="diagnostics"] tbody tr');
  expect(within(bodyRows[0] as HTMLElement).getByText("AAPL")).toBeTruthy();
});

test("§14dr-8 — Save correction disables in-flight (re-click guarded) and surfaces completion", async () => {
  const user = userEvent.setup();
  // Deferred correctSource → we can observe the in-flight state before it resolves.
  let resolve!: (v: { ok: true; data: { ok: true } }) => void;
  vi.mocked(correctSource).mockImplementationOnce(
    () => new Promise((r) => { resolve = r; }),
  );
  renderPage();
  await screen.findByText("Per-holding diagnostics");
  await waitFor(() => expect(screen.getByText("DBS")).toBeTruthy());
  // Open the Correct-source dialog for DBS (a symbol'd row).
  await user.click(screen.getByRole("button", { name: "Actions for DBS" }));
  await user.click(screen.getByRole("menuitem", { name: "Correct source" }));
  const dialog = screen.getByRole("dialog");
  const save = within(dialog).getByRole("button", { name: "Save correction" });
  await user.click(save);
  // In-flight: disabled + aria-busy; a re-click must not fire a second correctSource.
  expect(save).toBeDisabled();
  expect(save).toHaveAttribute("aria-busy", "true");
  await user.click(save);
  expect(vi.mocked(correctSource)).toHaveBeenCalledTimes(1);
  // Completion: resolve → the served-outcome toast appears and the dialog closes.
  resolve({ ok: true, data: { ok: true } });
  expect(await screen.findByText(/Source corrected for DBS\./)).toBeInTheDocument();
});

test("portfolio confidence card shows overall band + by-band table (ND-6, ratified components)", async () => {
  const { container } = renderPage();
  await screen.findByText("Portfolio confidence");
  await waitFor(() => {
    expect(screen.getByText("Overall confidence")).toBeTruthy();
    // by-band table has a Value % column (served); no segmented bar.
    expect(container.querySelector(".ph__bandtable")).toBeTruthy();
    expect(container.textContent).toMatch(/45\.0%/);
  });
});

test("Details row action opens the read-only routing chain + confidence factors (ND-5/ND-8)", async () => {
  const user = userEvent.setup();
  renderPage();
  await screen.findByText("Per-holding diagnostics");
  // Open the first row's menu → Details.
  const menus = await screen.findAllByRole("button", { name: /Actions for/ });
  await user.click(menus[0]);
  await user.click(await screen.findByText("Details"));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByText("Routing")).toBeTruthy();
  expect(within(dialog).getByText(/Priority chain \(read-only\)/)).toBeTruthy();
  expect(within(dialog).getByText(/Why this confidence/)).toBeTruthy();
});

test("§18-R4: an unkeyed chain provider renders muted with its SERVED note; a keyed one renders normally", async () => {
  const user = userEvent.setup();
  const { container } = renderPage();
  await screen.findByText("Per-holding diagnostics");
  await user.click(await screen.findByRole("button", { name: /Actions for AAPL/ }));
  await user.click(await screen.findByText("Details"));
  const dialog = await screen.findByRole("dialog");
  // The annotation is the SERVED string, rendered verbatim (D-105) — never composed here.
  const unkeyed = within(dialog).getByText("1. eodhd (no key)");
  expect(unkeyed.classList.contains("lf-statuschip--muted")).toBe(true);
  // A keyed provider is neither annotated nor muted — the distinction the ruling exists for.
  const keyed = within(dialog).getByText("2. yahoo");
  expect(keyed.classList.contains("lf-statuschip--muted")).toBe(false);
  expect(container.textContent).not.toMatch(/yahoo \(no key\)/);
});

test("identifier-duplicate banner is omitted at zero, shown when count > 0", async () => {
  const { container, unmount } = renderPage();
  await screen.findByText("Per-holding diagnostics");
  await waitFor(() => expect(container.querySelector(".ph__dupbanner")).toBeNull());
  unmount();
  vi.mocked(getIdentifierDuplicates).mockResolvedValueOnce({
    ok: true,
    data: { count: 1, duplicates: [{ id_type: "isin", value: "US123", instrument_count: 2, instruments: [] }] },
  });
  const { container: c2 } = renderPage();
  await waitFor(() => expect(c2.querySelector(".ph__dupbanner")).not.toBeNull());
});

test("no-egress disables Refresh all with an honest state (ND-3)", async () => {
  vi.mocked(getNoEgress).mockResolvedValueOnce(true);
  renderPage();
  const btn = await screen.findByRole("button", { name: /Refresh all/ });
  await waitFor(() => expect((btn as HTMLButtonElement).disabled).toBe(true));
  expect(await screen.findByText(/Refresh unavailable — no-egress is on/)).toBeTruthy();
});

// --- §14dr-17 — Refresh all market data (honest scope, per-lane summary) --------------------
test("Refresh all market data reports a per-lane summary and names the excluded masters", async () => {
  const user = userEvent.setup();
  renderPage();
  await screen.findByText("Per-holding diagnostics");
  // The honest scope caption names the masters exclusion + links to the Masters card.
  const scopeLink = await screen.findByRole("link", { name: /sync them in Settings/ });
  expect(scopeLink.getAttribute("href")).toBe("#/settings?tab=data-feeds");
  // Clicking refresh shows a per-lane result summary (quotes+indices · FX · news).
  const btn = await screen.findByRole("button", { name: /Refresh all market data/ });
  await user.click(btn);
  const summary = await screen.findByText(/Quotes & indices:.*FX rates:.*News:/);
  expect(summary).toBeTruthy();
});

// --- R-38 provenance (Phase 1; §9-10/§9-8) — served route_rule, read-only (D-072) -----------
test("provenance column: the served route_rule chip renders all four values (§9-10)", async () => {
  renderPage();
  await screen.findByText("Per-holding diagnostics");
  // The served route_rule values (matrix · override · lane · active) appear as plain chips — the
  // frontend never recomputes provenance (one derivation from route(), D-105).
  await waitFor(() => {
    expect(screen.getAllByText("matrix").length).toBeGreaterThan(0);
    expect(screen.getAllByText("override").length).toBeGreaterThan(0);
    expect(screen.getAllByText("active").length).toBeGreaterThan(0);
    expect(screen.getAllByText("lane").length).toBeGreaterThan(0);
  });
});

test("route detail MetaStrip shows Route · Rule · Lane, distinct from the ProvenanceBadge Source (D1-c/D-028)", async () => {
  const user = userEvent.setup();
  renderPage();
  await screen.findByText("Per-holding diagnostics");
  const menus = await screen.findAllByRole("button", { name: /Actions for AAPL/ });
  await user.click(menus[0]);
  await user.click(await screen.findByText("Details"));
  const dialog = await screen.findByRole("dialog");
  // D1-c: the routing block uses routing vocabulary — "Route" (the route decision), NOT a second
  // "Source" label. The ProvenanceBadge above keeps "Source" (the value-supplier). Two distinct
  // labels for two distinct concepts (D-028), instead of two fields both labeled "Source".
  expect(within(dialog).getByText("Route")).toBeTruthy();
  expect(within(dialog).getByText("Source")).toBeTruthy();
  // The route-detail strip carries the served Rule (AAPL priced via matrix, source yahoo).
  expect(within(dialog).getByText("Rule")).toBeTruthy();
  expect(within(dialog).getByText("matrix")).toBeTruthy();
  expect(within(dialog).getByText("yahoo")).toBeTruthy();
});

test("route detail surfaces the router's OWN served reason in the Routing block (D1-c)", async () => {
  const user = userEvent.setup();
  // An awaiting-NAV mutual fund: the router serves "awaiting NAV (refresh AMFI)" as route_reason.
  vi.mocked(getPricingHealth).mockResolvedValueOnce({
    ok: true,
    data: {
      base_currency: "SGD",
      holdings: [row({
        id: 1, symbol: "145834", label: "Franklin India Fund", status: "Unavailable",
        valuation_method: "unavailable", route_rule: "lane", route_lane: "in_mutual_fund",
        route_source: "amfi_nav", route_reason: "awaiting NAV (refresh AMFI)",
        failure_reason: "No value available from any configured source.",
      })],
      summary: { Unavailable: 1 },
      confidence: { overall: 30, overall_band: "low", by_band: { high: { count: 0, value_pct: 0 }, medium: { count: 0, value_pct: 0 }, low: { count: 1, value_pct: 100 } } },
      provider_tier_note: null,
    },
  });
  renderPage();
  await screen.findByText("Per-holding diagnostics");
  const menus = await screen.findAllByRole("button", { name: /Actions for Franklin India Fund/ });
  await user.click(menus[0]);
  await user.click(await screen.findByText("Details"));
  const dialog = await screen.findByRole("dialog");
  // The served router reason is asserted at its destination control (the Routing block) — never
  // frontend-invented (D-105).
  expect(within(dialog).getByText("awaiting NAV (refresh AMFI)")).toBeTruthy();
});

test("R-63 §9-2: the drawer names the TYPED failure state + its served note (throttled, last-at)", async () => {
  const user = userEvent.setup();
  // A stale holding whose last refresh was rate-limited: the typed state + served note (with
  // 'last at T') render verbatim (D-105) — distinct causes, never a flat "none". Copy PROPOSED.
  vi.mocked(getPricingHealth).mockResolvedValueOnce({
    ok: true,
    data: {
      base_currency: "SGD",
      holdings: [row({
        id: 1, symbol: "TSLA", label: "TSLA", status: "Cached", is_stale: true,
        failure_state: "throttled",
        failure_at: "2026-07-23T20:47:00Z",
        failure_note: "The data provider is rate-limiting requests — will retry (last at 2026-07-23T20:47:00Z).",
      })],
      summary: { Cached: 1 },
      confidence: { overall: 40, overall_band: "low", by_band: { high: { count: 0, value_pct: 0 }, medium: { count: 0, value_pct: 0 }, low: { count: 1, value_pct: 100 } } },
      provider_tier_note: null,
    },
  });
  renderPage();
  await screen.findByText("Per-holding diagnostics");
  const menus = await screen.findAllByRole("button", { name: /Actions for TSLA/ });
  await user.click(menus[0]);
  await user.click(await screen.findByText("Details"));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByText("throttled")).toBeTruthy();
  // The served note is rendered verbatim (never frontend-invented, D-105).
  expect(within(dialog).getByText(/rate-limiting requests — will retry \(last at/)).toBeTruthy();
});

test("tier note: the served av_tier honest string renders only when present (§9-8)", async () => {
  // Default response has provider_tier_note null → no note.
  const { unmount } = renderPage();
  await screen.findByText("Per-holding diagnostics");
  expect(screen.queryByText(/index via ETF proxy/)).toBeNull();
  unmount();
  // A non-premium AV key → the served honest string is surfaced (never a fabricated real-index label).
  vi.mocked(getPricingHealth).mockResolvedValueOnce({
    ok: true,
    data: {
      base_currency: "SGD",
      holdings: [row({ id: 1, symbol: "AAPL", label: "AAPL", route_rule: "active" })],
      summary: { Fresh: 1 },
      confidence: { overall: 90, overall_band: "high", by_band: { high: { count: 1, value_pct: 100 }, medium: { count: 0, value_pct: 0 }, low: { count: 0, value_pct: 0 } } },
      provider_tier_note: "index via ETF proxy — key not premium",
    },
  });
  renderPage();
  expect(await screen.findByText("index via ETF proxy — key not premium")).toBeTruthy();
});

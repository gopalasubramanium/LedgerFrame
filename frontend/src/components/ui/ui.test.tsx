import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  AllocationDonut,
  Button,
  DataTable,
  EmptyState,
  InstrumentPicker,
  MasterSelect,
  MoneyInput,
  PriceChart,
  ProvenanceBadge,
  StalenessChip,
  Treemap,
} from "./index";
import type { Column } from "./index";
import {
  ALLOCATION_BY_CLASS,
  DENSE_CANDLE_SERIES,
  HOLDINGS,
  PRICE_SERIES,
  PROV_STALE,
  TREEMAP_NODES,
} from "../../mocks/fixtures";

// The InstrumentPicker searches the backend; keep it offline in unit tests (the
// explicit create path renders regardless of search results).
vi.mock("../../api/instruments", () => ({
  searchInstruments: vi.fn(async () => ({ ok: false, error: "no server" })),
}));
import { searchInstruments } from "../../api/instruments";

afterEach(cleanup);

test("MoneyInput shows the currency and passes the raw string up (no math)", async () => {
  const onChange = vi.fn();
  render(
    <MoneyInput
      value="1234.5"
      currency="SGD"
      onChange={onChange}
      aria-label="Amount"
    />,
  );
  expect(screen.getByText("SGD")).toBeInTheDocument();
  const input = screen.getByLabelText("Amount") as HTMLInputElement;
  expect(input.value).toBe("1234.5");
  await userEvent.type(input, "6");
  expect(onChange).toHaveBeenCalled();
});

test("MasterSelect resolves options from the master registry, not an inline list", () => {
  render(<MasterSelect master="asset_class" value="equity" onChange={() => {}} />);
  const select = screen.getByLabelText("Asset class") as HTMLSelectElement;
  // 13 AssetClass values + the disabled placeholder.
  const values = within(select)
    .getAllByRole("option")
    .map((o) => (o as HTMLOptionElement).value);
  expect(values).toContain("mutual_fund");
  expect(values).toContain("liability");
  expect(select.value).toBe("equity");
});

test("MasterSelect honours a custom placeholder (R-63 R4: routing matrix reads 'Select provider…')", () => {
  render(<MasterSelect master="source_override" value="" placeholder="Select provider…" onChange={() => {}} />);
  const opt = screen.getAllByRole("option").find((o) => (o as HTMLOptionElement).value === "");
  expect(opt?.textContent).toBe("Select provider…");
});

test("MasterSelect offers create only for extensible masters", () => {
  const { rerender } = render(
    <MasterSelect master="sector" value="Financials" allowCreate onChange={() => {}} />,
  );
  expect(screen.getByRole("option", { name: /Create new/ })).toBeInTheDocument();
  // asset_class is a fixed vocabulary — no create even with allowCreate.
  rerender(
    <MasterSelect master="asset_class" value="equity" allowCreate onChange={() => {}} />,
  );
  expect(screen.queryByRole("option", { name: /Create new/ })).toBeNull();
});

test("PriceChart amendment: Simple default, Advanced shows candles, period fires (PROPOSED)", async () => {
  const onPeriod = vi.fn();
  const { container } = render(
    <PriceChart series={PRICE_SERIES} interval="1d" controls defaultView="simple"
      periods={["1M", "6M", "Max"]} activePeriod="6M" onPeriodChange={onPeriod}
      coverageNote="Only 4 days of history available" />,
  );
  // Simple default → a line, no candles.
  expect(container.querySelector(".lf-pricechart__line")).not.toBeNull();
  expect(container.querySelectorAll(".lf-candle--up, .lf-candle--down").length).toBe(0);
  // Toggle to Advanced → candles appear.
  await userEvent.click(screen.getByRole("button", { name: "Advanced" }));
  expect(container.querySelectorAll(".lf-candle--up, .lf-candle--down").length).toBeGreaterThan(0);
  // Period buttons fire the callback (page refetches server-side).
  await userEvent.click(screen.getByRole("button", { name: "1M" }));
  expect(onPeriod).toHaveBeenCalledWith("1M");
  // Honest short-history note is shown, never hidden.
  expect(screen.getByText(/Only 4 days of history available/)).toBeInTheDocument();
});

// §14dr-4 — candlestick GEOMETRY at real daily density. The 40-point PRICE_SERIES hid the bug
// (sparse → wide bodies); with a dense ~130-bar daily fixture the body width collapsed below the
// wick and rendered as a cross. Assert the SVG geometry (not pixels-by-eye): readable body width,
// no overlap, body between open/close, wick to high/low, correct up/down class.
test("PriceChart: dense-daily candles keep readable, non-overlapping bodies between open/close (§14dr-4)", () => {
  const { container } = render(<PriceChart series={DENSE_CANDLE_SERIES} mode="candles" interval="1D" />);
  const groups = Array.from(container.querySelectorAll(".lf-candle--up, .lf-candle--down"));
  expect(groups.length).toBe(DENSE_CANDLE_SERIES.length);

  const X0 = 2, X1 = 98;
  const slot = (X1 - X0) / DENSE_CANDLE_SERIES.length; // ≈ 0.738 viewBox units at 130 bars
  const num = (el: Element | null, a: string) => parseFloat(el!.getAttribute(a) ?? "NaN");

  groups.forEach((g, i) => {
    const p = DENSE_CANDLE_SERIES[i];
    const rect = g.querySelector("rect");
    const line = g.querySelector("line");
    expect(rect).not.toBeNull();
    expect(line).not.toBeNull();

    // READABLE: the body is wider than the wick (0.4) and clears the old collapsed width (~0.37 at
    // this density) — the fix floors it to 0.6. This is the fail-first assertion: RED before the fix.
    const bw = num(rect, "width");
    expect(bw).toBeGreaterThanOrEqual(0.5);
    // NO OVERLAP: the body never exceeds its per-point slot (holds at 1Y/Max density too).
    expect(bw).toBeLessThanOrEqual(slot + 1e-6);

    // WICK to high→low: y1 (high) is at/above y2 (low) — smaller y = higher price.
    const wickTop = num(line, "y1"), wickBot = num(line, "y2");
    expect(wickTop).toBeLessThanOrEqual(wickBot);

    // BODY between open/close: its top (yAt(max(open,close))) sits WITHIN the wick's high→low span,
    // and the body has positive height. (The bottom allows the 0.4 min-height doji floor.)
    const bodyTop = num(rect, "y"), bodyH = num(rect, "height"), bodyBot = bodyTop + bodyH;
    expect(bodyTop).toBeGreaterThanOrEqual(wickTop - 1e-6);
    expect(bodyTop).toBeLessThanOrEqual(wickBot + 1e-6);
    expect(bodyH).toBeGreaterThan(0);
    expect(bodyBot).toBeLessThanOrEqual(wickBot + 0.4 + 1e-6);

    // UP/DOWN class matches the served open/close.
    expect(g.classList.contains(p.close >= p.open ? "lf-candle--up" : "lf-candle--down")).toBe(true);
  });
});

// §14dr-5 — zoom on the Advanced chart: wheel narrows the visible window (fewer candles) and a
// ratified Reset control appears; Reset restores the full range. Advanced-only, non-persistent.
test("PriceChart: Advanced candles zoom on wheel + Reset restores the full range (§14dr-5)", async () => {
  const { container } = render(<PriceChart series={DENSE_CANDLE_SERIES} mode="candles" interval="1D" />);
  const plot = container.querySelector(".lf-pricechart__plot") as HTMLElement;
  const count = () => container.querySelectorAll(".lf-candle--up, .lf-candle--down").length;
  expect(count()).toBe(DENSE_CANDLE_SERIES.length);
  // No Reset control until zoomed.
  expect(screen.queryByRole("button", { name: "Reset zoom" })).toBeNull();

  // Wheel up = zoom in → fewer visible candles + a Reset control.
  fireEvent.wheel(plot, { deltaY: -120, clientX: 100 });
  await waitFor(() => expect(count()).toBeLessThan(DENSE_CANDLE_SERIES.length));
  const reset = screen.getByRole("button", { name: "Reset zoom" });

  // Reset restores the full range and hides the control (non-persistent).
  await userEvent.click(reset);
  await waitFor(() => expect(count()).toBe(DENSE_CANDLE_SERIES.length));
  expect(screen.queryByRole("button", { name: "Reset zoom" })).toBeNull();
});

// Owner addition (2026-07-18) — a zoomed chart can PAN horizontally (drag / shift-scroll) and
// Reset still restores. Zoom (§14dr-5) narrowed the window but couldn't move it. Pan is pure
// index-space, so it works identically on daily and intraday series. Fail-first RED before pan.
// (jsdom has no layout width, so drag is a no-op there; shift-scroll drives the deterministic path.)
test("PriceChart: a zoomed chart PANS horizontally via shift-scroll, same width, Reset restores (owner 2026-07-18)", async () => {
  const { container } = render(<PriceChart series={DENSE_CANDLE_SERIES} mode="candles" interval="1D" />);
  const plot = container.querySelector(".lf-pricechart__plot") as HTMLElement;
  const count = () => container.querySelectorAll(".lf-candle--up, .lf-candle--down").length;
  // Not zoomed → not pannable, no window hook.
  expect(plot.getAttribute("data-window")).toBeNull();
  expect(plot.classList.contains("lf-pricechart__plot--pannable")).toBe(false);

  // Zoom in → a window appears and the plot becomes pannable.
  fireEvent.wheel(plot, { deltaY: -120, clientX: 100 });
  await waitFor(() => expect(plot.getAttribute("data-window")).not.toBeNull());
  const win0 = plot.getAttribute("data-window")!;
  const [lo0, hi0] = win0.split("-").map(Number);
  const visible = count();
  expect(plot.classList.contains("lf-pricechart__plot--pannable")).toBe(true);

  // Shift-scroll right → the window moves to LATER data, SAME width (a pan, not a re-zoom).
  fireEvent.wheel(plot, { deltaY: 120, shiftKey: true, clientX: 100 });
  await waitFor(() => expect(plot.getAttribute("data-window")).not.toBe(win0));
  const [lo1, hi1] = plot.getAttribute("data-window")!.split("-").map(Number);
  expect(lo1).toBeGreaterThan(lo0);        // moved to later data
  expect(hi1 - lo1).toBe(hi0 - lo0);       // width unchanged → panned, not zoomed
  expect(count()).toBe(visible);           // same number of candles visible

  // Shift-scroll left → moves back toward earlier data.
  fireEvent.wheel(plot, { deltaY: -120, shiftKey: true, clientX: 100 });
  await waitFor(() => expect(Number(plot.getAttribute("data-window")!.split("-")[0])).toBeLessThan(lo1));

  // Reset restores the full range and drops the window hook (non-persistent).
  await userEvent.click(screen.getByRole("button", { name: "Reset zoom" }));
  await waitFor(() => expect(plot.getAttribute("data-window")).toBeNull());
  expect(count()).toBe(DENSE_CANDLE_SERIES.length);
});

test("PriceChart: NO zoom in Simple view (Advanced only, §14dr-5)", () => {
  const { container } = render(
    <PriceChart series={DENSE_CANDLE_SERIES} interval="1D" controls defaultView="simple" />,
  );
  const plot = container.querySelector(".lf-pricechart__plot") as HTMLElement;
  const linePts = () => (container.querySelector(".lf-pricechart__line") as SVGPathElement).getAttribute("d")!.length;
  const before = linePts();
  fireEvent.wheel(plot, { deltaY: -120, clientX: 100 });
  // Simple view ignores the wheel — the line path is unchanged and no Reset control appears.
  expect(linePts()).toBe(before);
  expect(screen.queryByRole("button", { name: "Reset zoom" })).toBeNull();
});

// §14dr-8 / §12-8 — the intraday fetch (user-triggered, may hit the network) shows the RATIFIED
// loading treatment: a Skeleton block with aria-busy, NOT a bare text note and NOT a stale plot.
// The pending line persists beneath (the legend note), per the dr-8 idiom. Fail-first RED before
// the `loading` prop existed.
test("PriceChart: loading renders the dr-8 skeleton (aria-busy), not the plot (§14dr-8/§12-8)", () => {
  const { container } = render(
    <PriceChart series={DENSE_CANDLE_SERIES} interval="1-minute" controls loading
      coverageNote="Fetching intraday prices…" />,
  );
  // The ratified skeleton: role=status + aria-busy, not a bare <p> note.
  const status = screen.getByRole("status", { name: /Fetching intraday prices/ });
  expect(status).toHaveAttribute("aria-busy", "true");
  expect(container.querySelector(".lf-skeleton")).not.toBeNull();
  // The plot (and any stale series) is NOT rendered while loading — no stale candles flashed.
  expect(container.querySelector(".lf-pricechart__svg")).toBeNull();
  expect(container.querySelectorAll(".lf-candle--up, .lf-candle--down").length).toBe(0);
  // The pending line persists beneath (dr-8 idiom) — shown in the legend note.
  expect(container.querySelector(".lf-pricechart__note")?.textContent).toMatch(/Fetching intraday prices/);
  // The range control stays mounted so the user can still switch away.
  expect(screen.getByRole("group", { name: "Chart view" })).toBeInTheDocument();
});

test("InstrumentPicker exposes an explicit create path (no silent auto-create)", async () => {
  const onSelect = vi.fn();
  render(<InstrumentPicker onSelect={onSelect} allowCreate />);
  const input = screen.getByRole("combobox");
  await userEvent.type(input, "Zzz New Co");
  await userEvent.click(await screen.findByText(/Create new instrument/));
  expect(onSelect).toHaveBeenCalledWith({ kind: "create", query: "Zzz New Co" });
});

test("InstrumentPicker is class-aware: same-class selectable, cross-class navigates (D-097)", async () => {
  vi.mocked(searchInstruments).mockResolvedValueOnce({
    ok: true,
    data: {
      existing: [{ id: 1, symbol: "0P0001", name: "Acme Fund", asset_class: "mutual_fund", currency: "INR" }],
      other_class: [{ id: 2, symbol: "D05", name: "DBS Group", asset_class: "equity", currency: "SGD" }],
      suggestions: [{ symbol: "0P0002", name: "Beta Fund" }],
    },
  });
  const onSelect = vi.fn();
  render(<InstrumentPicker onSelect={onSelect} allowCreate assetClass="mutual_fund" />);
  await userEvent.type(screen.getByRole("combobox"), "fund");
  // Same-class existing + provider suggestion for THIS class appear.
  expect(await screen.findByText("Acme Fund")).toBeInTheDocument();
  expect(screen.getByText("Beta Fund")).toBeInTheDocument();
  // A symbol under a different class appears as a navigate link, not a result.
  const cross = screen.getByText(/Found in equity: D05/);
  await userEvent.click(cross);
  expect(window.location.hash).toContain("/instrument/D05");
  expect(onSelect).not.toHaveBeenCalled(); // never selectable into the wrong flow
});

test("§14dr-12: an empty class-scoped search shows an honest empty state + create path (per class)", async () => {
  // Verify-first: the picker IS class-scoped (D-097) and has a create path. The "XRP returned
  // nothing" symptom was a MISSING honest empty message — a bare create option read as "nothing".
  // Fail-first RED: today no "No {class} instruments match" line renders on an empty result.
  vi.mocked(searchInstruments).mockResolvedValue({
    ok: true,
    data: { existing: [], other_class: [], suggestions: [] },
  });
  const onSelect = vi.fn();
  // Crypto (the XRP case): honest scoped empty + create.
  const { unmount } = render(<InstrumentPicker onSelect={onSelect} allowCreate assetClass="crypto" />);
  await userEvent.type(screen.getByRole("combobox"), "XRP");
  const cryptoEmpty = await screen.findByText(/No crypto instruments match/i);
  expect(cryptoEmpty).toBeInTheDocument();
  await userEvent.click(cryptoEmpty); // the honest empty IS the create path here
  expect(onSelect).toHaveBeenCalledWith({ kind: "create", query: "XRP" });
  unmount();

  // Mutual fund: the same honesty, scoped to the picked class.
  render(<InstrumentPicker onSelect={vi.fn()} allowCreate assetClass="mutual_fund" />);
  await userEvent.type(screen.getByRole("combobox"), "Nowhere Fund");
  expect(await screen.findByText(/No mutual fund instruments match/i)).toBeInTheDocument();
});

test("§14dr-12: with create disabled, an empty search still states the honest scoped empty (no blank menu)", async () => {
  vi.mocked(searchInstruments).mockResolvedValue({
    ok: true,
    data: { existing: [], other_class: [], suggestions: [] },
  });
  render(<InstrumentPicker onSelect={vi.fn()} allowCreate={false} assetClass="crypto" />);
  await userEvent.type(screen.getByRole("combobox"), "XRP");
  // Not blank: an honest info line, and NO create affordance.
  expect(await screen.findByText(/No crypto instruments match/i)).toBeInTheDocument();
  expect(screen.queryByText(/create/i)).toBeNull();
});

test("DataTable marks sortable headers with aria-sort and exports server-side", async () => {
  const onSort = vi.fn();
  const onExport = vi.fn();
  interface Row { name: string; value: string; }
  const columns: Column<Row>[] = [
    { key: "name", label: "Name", sortable: true },
    { key: "value", label: "Value", format: "money", sortable: true },
  ];
  render(
    <DataTable
      columns={columns}
      rows={[{ name: "DBS", value: "114360" }]}
      sort={{ key: "value", dir: "desc" }}
      onSort={onSort}
      onExport={onExport}
    />,
  );
  const valueHeader = screen.getByRole("columnheader", { name: /Value/ });
  expect(valueHeader).toHaveAttribute("aria-sort", "descending");
  expect(screen.getByText("114,360.00")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /Export/ }));
  expect(onExport).toHaveBeenCalled();
});

test("StalenessChip flags stale but renders nothing when fresh", () => {
  const { rerender } = render(<StalenessChip isStale asOf={PROV_STALE.asOf} />);
  expect(screen.getByText(/Stale/)).toBeInTheDocument();
  rerender(<StalenessChip isStale={false} asOf={PROV_STALE.asOf} />);
  expect(screen.queryByText(/Stale/)).toBeNull();
});

test("ProvenanceBadge renders source, freshness, and confidence", () => {
  render(
    <ProvenanceBadge
      source="Kite"
      entitlement="delayed"
      valuationMethod="market_quote"
      confidence={{ score: 92, band: "high" }}
      asOf="2026-07-09T09:14:00Z"
    />,
  );
  expect(screen.getByText("Kite")).toBeInTheDocument();
  expect(screen.getByText(/92 · high/)).toBeInTheDocument();
});

test("AllocationDonut renders a legend percentage per segment", () => {
  render(<AllocationDonut segments={ALLOCATION_BY_CLASS} />);
  // Five segments → five legend rows with % values.
  const pcts = screen.getAllByText(/%$/);
  expect(pcts.length).toBe(ALLOCATION_BY_CLASS.length);
});

test("AllocationDonut footnote (PROPOSED, ND-4) renders the excluded-liabilities line", () => {
  const { container } = render(
    <AllocationDonut segments={ALLOCATION_BY_CLASS} footnote="Liabilities −S$420,000 excluded — allocation is of gross assets." />,
  );
  const foot = container.querySelector(".lf-donut__footnote");
  expect(foot?.textContent).toContain("Liabilities −S$420,000 excluded");
});

test("PriceChart comparison mode (PROPOSED, ND-3d/e) plots a second same-axis series + legend", () => {
  const { container } = render(
    <PriceChart
      series={PRICE_SERIES}
      mode="line"
      interval="1Y"
      comparison={{ values: PRICE_SERIES.map((p) => p.close + 5), label: "Benchmark", sublabel: "SPY proxy" }}
    />,
  );
  // The comparison series is a distinct shared-axis path (not the normalised __bench overlay).
  expect(container.querySelector(".lf-pricechart__cmp")).not.toBeNull();
  expect(screen.getByText("Benchmark")).toBeTruthy();
  expect(screen.getByText("SPY proxy")).toBeTruthy();
});

test("Treemap squarified tiles cover the full area without overlap gaps", () => {
  const { container } = render(<Treemap nodes={TREEMAP_NODES} />);
  const rects = Array.from(container.querySelectorAll("rect"));
  expect(rects.length).toBe(TREEMAP_NODES.length);
  const area = rects.reduce((a, r) => {
    const w = Number(r.getAttribute("width"));
    const h = Number(r.getAttribute("height"));
    return a + w * h;
  }, 0);
  // Total tile area ≈ the 100×60 viewBox (proportional layout).
  expect(area).toBeGreaterThan(100 * 60 * 0.98);
  expect(area).toBeLessThan(100 * 60 * 1.02);
});

test("EmptyState always shows a reason (Product Guarantee 3)", () => {
  render(<EmptyState message="No holdings yet" reason="Add a holding to begin." />);
  expect(screen.getByText("No holdings yet")).toBeInTheDocument();
  expect(screen.getByText("Add a holding to begin.")).toBeInTheDocument();
});

test("holdings fixture carries a negative unrealised P/L for loss-state coverage", () => {
  expect(HOLDINGS.some((h) => Number(h.unrealisedPl) < 0)).toBe(true);
});

// §14dr-8 — async-action standard on the shared Button: loading disables (re-click guarded),
// sets aria-busy, and shows a PERCEPTIBLE spinner. Fail-first RED before the prop existed.
test("§14dr-8: Button loading disables, sets aria-busy, and shows a spinner (async standard)", async () => {
  const onClick = vi.fn();
  const { rerender, container } = render(<Button loading onClick={onClick}>Save</Button>);
  const btn = screen.getByRole("button", { name: "Save" });
  expect(btn).toBeDisabled();
  expect(btn).toHaveAttribute("aria-busy", "true");
  expect(container.querySelector(".lf-btn__spinner")).not.toBeNull();
  await userEvent.click(btn); // guarded — disabled swallows the click
  expect(onClick).not.toHaveBeenCalled();
  // Not loading → clickable, no spinner, no aria-busy.
  rerender(<Button onClick={onClick}>Save</Button>);
  expect(screen.getByRole("button", { name: "Save" })).not.toBeDisabled();
  expect(container.querySelector(".lf-btn__spinner")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(onClick).toHaveBeenCalledTimes(1);
});

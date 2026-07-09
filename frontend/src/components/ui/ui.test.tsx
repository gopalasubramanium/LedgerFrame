import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  AllocationDonut,
  DataTable,
  EmptyState,
  InstrumentPicker,
  MasterSelect,
  MoneyInput,
  ProvenanceBadge,
  StalenessChip,
  Treemap,
} from "./index";
import type { Column } from "./index";
import {
  ALLOCATION_BY_CLASS,
  HOLDINGS,
  PROV_STALE,
  TREEMAP_NODES,
} from "../../mocks/fixtures";

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

test("InstrumentPicker exposes an explicit create path (no silent auto-create)", async () => {
  const onSelect = vi.fn();
  render(<InstrumentPicker onSelect={onSelect} allowCreate />);
  const input = screen.getByRole("combobox");
  await userEvent.type(input, "Zzz New Co");
  await userEvent.click(screen.getByText(/Create new instrument/));
  expect(onSelect).toHaveBeenCalledWith({ kind: "create", query: "Zzz New Co" });
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

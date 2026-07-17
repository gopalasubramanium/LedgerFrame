// §14dr-12/§14dr-13 — the class-scoped picker's honest empty states. dr-12: "no match —
// create"; dr-13: when the class's instrument master was NEVER SYNCED, say so and point at
// the sync card (Settings → Data feeds) rather than pushing a manual-create the picker could
// have found once the master is synced. The link is journey-guarded to the card (§14ac-2).
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InstrumentPicker } from "./InstrumentPicker";

vi.mock("../../api/instruments", () => ({ searchInstruments: vi.fn() }));
import { searchInstruments } from "../../api/instruments";

const empty = (master: { provider: "amfi" | "coingecko"; synced: boolean } | null) => ({
  ok: true as const,
  data: { existing: [], other_class: [], suggestions: [], master },
});

afterEach(() => cleanup());

test("never-synced master → honest empty pointing at the sync card (crypto)", async () => {
  vi.mocked(searchInstruments).mockResolvedValue(empty({ provider: "coingecko", synced: false }));
  render(<InstrumentPicker assetClass="crypto" onSelect={() => {}} />);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "XRP" } });
  const link = await screen.findByText("Settings → Data feeds", {}, { timeout: 2000 });
  // The copy names the class and the action; it is NOT a create option.
  expect(screen.getByText(/No crypto master synced yet/)).toBeTruthy();
  expect(screen.queryByText(/create/i)).toBeNull();
  // Journey guard (§14ac-2): the link actually targets the Masters card's tab, not a dead route.
  expect(link.getAttribute("href")).toBe("#/settings?tab=data-feeds");
});

test("never-synced master → the mutual-fund copy names that class", async () => {
  vi.mocked(searchInstruments).mockResolvedValue(empty({ provider: "amfi", synced: false }));
  render(<InstrumentPicker assetClass="mutual_fund" onSelect={() => {}} />);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "AXIS" } });
  expect(await screen.findByText(/No mutual fund master synced yet/, {}, { timeout: 2000 })).toBeTruthy();
});

test("synced master with no match → the dr-12 create empty (not the never-synced copy)", async () => {
  vi.mocked(searchInstruments).mockResolvedValue(empty({ provider: "coingecko", synced: true }));
  render(<InstrumentPicker assetClass="crypto" onSelect={() => {}} />);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "ZZZ" } });
  expect(await screen.findByText(/No crypto instruments match — create/, {}, { timeout: 2000 })).toBeTruthy();
  await waitFor(() => expect(screen.queryByText(/master synced yet/)).toBeNull());
});

test("§14dr-16 — picking a master suggestion carries the master's NAME, not just the code", async () => {
  vi.mocked(searchInstruments).mockResolvedValue({
    ok: true as const,
    data: {
      existing: [],
      other_class: [],
      suggestions: [{ symbol: "103504", name: "Axis Bluechip Fund - Growth" }],
      master: { provider: "amfi", synced: true },
    },
  });
  const onSelect = vi.fn();
  render(<InstrumentPicker assetClass="mutual_fund" onSelect={onSelect} />);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "axis" } });
  const opt = await screen.findByText("Axis Bluechip Fund - Growth", {}, { timeout: 2000 });
  fireEvent.mouseDown(opt);
  // The pick MUST carry the name so the created instrument isn't identified by the bare code.
  expect(onSelect).toHaveBeenCalledWith({
    kind: "create",
    query: "103504",
    name: "Axis Bluechip Fund - Growth",
  });
});

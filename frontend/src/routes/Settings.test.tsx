// Settings page — render + honest-state + Amendment-C journey guards (page-settings Phase 2).
// Every value shown is a SERVED string (D-105); these tests assert the page renders what the readers
// serve and behaves honestly (no dead buttons, no fabricated success, write-only key never echoed).
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../theme/ThemeProvider";
import { DisplayProvider } from "../theme/DisplayProvider";
import { ToastProvider } from "../components/ui";
import { Settings } from "./Settings";
import type { SettingsData } from "../api/settings";
import type { DataSource } from "../api/systemConfig";

// --- mocks -------------------------------------------------------------------
vi.mock("../api/settings", () => ({ getSettings: vi.fn(), putSettings: vi.fn(async () => ({ ok: true })) }));
vi.mock("../api/tokens", () => ({
  listTokens: vi.fn(),
  createToken: vi.fn(async () => ({ ok: true, token: { id: 9, name: "New", prefix: "lf_tok", token: "lf_tok_RAWSECRET", note: "once" } })),
  revokeToken: vi.fn(async () => ({ ok: true })),
}));
vi.mock("../api/systemConfig", () => ({
  getDataSource: vi.fn(),
  putDataSource: vi.fn(async () => ({ ok: true })),
  getSystemConfig: vi.fn(async () => ({ timezone: "Asia/Singapore", autolock_minutes: "15", stale_after_seconds: "900" })),
  putSystemConfig: vi.fn(async () => ({ ok: true })),
  getAiConfig: vi.fn(async () => ({ enabled: true, provider: "hailo", model: "llama3", has_openai_key: false })),
  getLanEnabled: vi.fn(async () => false),
  setLanAccess: vi.fn(async () => ({ ok: true })),
  resetData: vi.fn(async () => ({ ok: true })),
  getPinSet: vi.fn(async () => false),
}));
vi.mock("../api/feeds", () => ({
  getFeeds: vi.fn(async () => ({ feeds: ["https://a.example/feed.xml"], defaults: [] })),
  putFeeds: vi.fn(async () => ({ ok: true, feeds: [] })),
  testFeeds: vi.fn(async () => []),
}));
vi.mock("../api/system", () => ({ setPin: vi.fn(async () => ({ ok: true })) }));
// R-38 routing-matrix editor (Phase 1) readers/writers — mocked so the Data feeds tab's third card
// renders deterministically (served strings only; no network in tests).
vi.mock("../api/routing-matrix", () => ({
  getRoutingMatrix: vi.fn(),
  getProviders: vi.fn(),
  putRoutingCell: vi.fn(),
  deleteRoutingCell: vi.fn(async () => ({ ok: true, deleted: true })),
}));

import { getSettings } from "../api/settings";
import { listTokens } from "../api/tokens";
import { getDataSource, getPinSet } from "../api/systemConfig";
import { getRoutingMatrix, getProviders, putRoutingCell, deleteRoutingCell } from "../api/routing-matrix";
import type { ProvidersResp } from "../api/routing-matrix";
import { getFeeds } from "../api/feeds";

const SETTINGS: SettingsData = {
  stored: { privacy_mode: "true" },
  defaults: {
    base_currency: "SGD",
    timezone: "Asia/Singapore",
    market_provider: "yahoo",
    supported_currencies: ["SGD", "USD", "EUR"],
    long_term_days: 365,
  },
};
const DATA_SOURCE: DataSource = {
  provider: "yahoo",
  has_api_key: false,
  base_currency: "SGD",
  providers: ["yahoo", "alphavantage", "mock"],
  admin_available: true,
};

function renderAt(path = "/settings") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider><DisplayProvider><ToastProvider>
        <Settings />
      </ToastProvider></DisplayProvider></ThemeProvider>
    </MemoryRouter>,
  );
}

const PROVIDERS: ProvidersResp = {
  active: "mock",
  capabilities: {
    yahoo: { asset_classes: ["equity", "etf", "crypto"], regions: ["*"], needs_key: false },
    eodhd: { asset_classes: ["equity", "etf", "crypto"], regions: ["US", "SG", "IN", "*"], needs_key: true },
    kite: { asset_classes: ["equity"], regions: ["IN"], needs_key: true },
  },
  default_priority: {},
};

beforeEach(() => {
  vi.mocked(getSettings).mockResolvedValue(SETTINGS);
  vi.mocked(listTokens).mockResolvedValue([]);
  vi.mocked(getDataSource).mockResolvedValue(DATA_SOURCE);
  vi.mocked(getPinSet).mockResolvedValue(false);
  vi.mocked(getRoutingMatrix).mockResolvedValue({ cells: [] });
  vi.mocked(getProviders).mockResolvedValue(PROVIDERS);
  vi.mocked(putRoutingCell).mockResolvedValue({
    ok: true,
    cell: { asset_class: "equity", listing_country: "US", provider: "yahoo", degraded: false, caveat: null, updated_at: null },
  });
  vi.mocked(deleteRoutingCell).mockResolvedValue({ ok: true, deleted: true });
});
afterEach(() => cleanup());

// --- tabs + URL state (Amendment C) -----------------------------------------
test("renders the six D-069 tabs (§14st-2) and defaults to General", async () => {
  renderAt();
  for (const t of ["General", "Appearance", "Privacy", "Data feeds", "AI", "System"]) {
    expect(screen.getByRole("button", { name: t })).toBeTruthy();
  }
  // General is the default control set: base currency + timezone + the long-term threshold.
  expect(await screen.findByLabelText("Base currency")).toBeTruthy();
  expect(screen.getByLabelText("Long-term threshold in days")).toBeTruthy();
});

test("General serves long_term_days verbatim (D-105 — the frontend carries no 365 literal)", async () => {
  renderAt("/settings?tab=general");
  const field = await screen.findByLabelText("Long-term threshold in days");
  // The field seeds from the served default via an effect — wait for the value, don't race it.
  await waitFor(() => expect((field as HTMLInputElement).value).toBe("365"));
});

// Amendment C — tab state is URL-addressable; deep-linking lands on that tab's CONTROL (§14ac-2).
test("Amendment C: ?tab=privacy deep-links to the no-egress control + derived statement", async () => {
  renderAt("/settings?tab=privacy");
  expect(await screen.findByLabelText("No-egress mode")).toBeTruthy();
  // The protected copy is VERBATIM and DERIVED from the one toggle (§9-9), never a metric.
  expect(screen.getByText("This device makes no network calls.")).toBeTruthy();
  expect(screen.getByText(/No-egress: On/)).toBeTruthy();
});

test("Amendment C: ?tab=system deep-links to the PIN control (first-run PIN journey target)", async () => {
  renderAt("/settings?tab=system");
  // arrival at the CONTROL, not the href: the PIN card is on screen (PIN stays in System, §14st-1).
  expect(await screen.findByRole("button", { name: /Set PIN/ })).toBeTruthy();
  // The provider control has MOVED to the Data feeds tab — it is NOT on System.
  expect(screen.queryByLabelText("Market data provider")).toBeNull();
  // §14st-2: the AI-config line has MOVED to the AI tab — System no longer carries it.
  expect(screen.queryByText(/^AI is (on|off)/)).toBeNull();
});

// §14st-2 — the AI-config line is its own tab (owner option B, 2026-07-18).
test("Amendment C: ?tab=ai deep-links to the read-only served AI-config line + deferral note (§14st-2)", async () => {
  renderAt("/settings?tab=ai");
  // arrival at the CONTROL: the served AI-config display line (getAiConfig → enabled/hailo/llama3).
  expect(await screen.findByText(/^AI is (on|off)/)).toBeTruthy();
  // The static deferral note — model management stays with AI-surfaces (D-067/D-068).
  expect(screen.getByText(/Model management lives with the AI surfaces/i)).toBeTruthy();
});

test("Amendment C: ?tab=data-feeds deep-links to the provider control (first-run provider journey target, §14st-1)", async () => {
  renderAt("/settings?tab=data-feeds");
  // arrival at the CONTROL: the market-data provider select + the write-only key field are on screen.
  expect(await screen.findByLabelText("Market data provider")).toBeTruthy();
  expect(screen.getByLabelText("Provider API key (write-only)")).toBeTruthy();
});

// --- honest states -----------------------------------------------------------
test("PIN card shows an honest 'not set' state and offers to set one", async () => {
  renderAt("/settings?tab=system");
  expect(await screen.findByText("PIN: not set")).toBeTruthy();
  expect(screen.getByRole("button", { name: /Set PIN/ })).toBeTruthy();
});

test("write-only API key never echoes a value — an honest 'set, hidden' state", async () => {
  vi.mocked(getDataSource).mockResolvedValue({ ...DATA_SOURCE, has_api_key: true });
  renderAt("/settings?tab=data-feeds");
  const key = await screen.findByLabelText("Provider API key (write-only)");
  // The field is empty (never the stored secret); the placeholder states it is set + hidden.
  expect((key as HTMLInputElement).value).toBe("");
  expect((key as HTMLInputElement).placeholder).toMatch(/set/i);
});

test("Reset data uses the ratified danger variant and is refused without a PIN (D-103)", async () => {
  renderAt("/settings?tab=system");
  const reset = await screen.findByRole("button", { name: /Reset data/ });
  expect(reset.className).toContain("lf-btn--danger");
  // D-103: a wipe is impossible on a no-PIN install — the control is disabled with an honest reason.
  expect((reset as HTMLButtonElement).disabled).toBe(true);
});

test("Allow LAN degrades honestly without the root helper (§9-10) — disabled, not dead", async () => {
  vi.mocked(getDataSource).mockResolvedValue({ ...DATA_SOURCE, admin_available: false });
  renderAt("/settings?tab=system");
  const lan = await screen.findByLabelText("Allow LAN access");
  expect((lan as HTMLInputElement).disabled).toBe(true);
  expect(screen.getByText(/optional root helper/i)).toBeTruthy();
});

// --- token card --------------------------------------------------------------
test("token card is honest at zero (EmptyState with a reason + CTA)", async () => {
  renderAt("/settings?tab=privacy");
  expect(await screen.findByText("No API tokens yet")).toBeTruthy();
  expect(screen.getAllByRole("button", { name: /Create token/ }).length).toBeGreaterThan(0);
});

test("token is shown ONCE at creation and never re-revealed", async () => {
  renderAt("/settings?tab=privacy");
  // Open the create dialog, name it, create.
  fireEvent.click(await screen.findByRole("button", { name: /Create token/ }));
  const name = await screen.findByLabelText("Token name");
  fireEvent.change(name, { target: { value: "Wall display" } });
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Create token/ }));
  // The raw token appears exactly once.
  expect(await screen.findByText("lf_tok_RAWSECRET")).toBeTruthy();
  // Dismiss — it is gone and never re-read.
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(screen.queryByText("lf_tok_RAWSECRET")).toBeNull();
});

// --- R-38 routing-matrix editor (Phase 1; Settings → Data feeds, §9) ----------
// The third Data feeds card. Every value is a SERVED string (D-005); capability is validated by the
// honest edit-time 400 rendered verbatim (§9-3); an empty matrix changes nothing (§9-2).

test("routing matrix: the empty matrix shows the ratified verbatim empty state (§9-2)", async () => {
  vi.mocked(getRoutingMatrix).mockResolvedValue({ cells: [] });
  renderAt("/settings?tab=data-feeds");
  expect(await screen.findByText("No routing rules yet")).toBeTruthy();
  // The verbatim reason — an empty matrix implies nothing (PARAM-WINS honesty).
  expect(screen.getByText(/An empty matrix changes nothing/)).toBeTruthy();
  // The [Help] popover term is the GLOSSARY entry (parity guard green).
  expect(screen.getByText("Routing matrix")).toBeTruthy();
});

test("routing matrix: renders Active + degraded caveat cells from served state (§9-7)", async () => {
  vi.mocked(getRoutingMatrix).mockResolvedValue({
    cells: [
      { asset_class: "equity", listing_country: "US", provider: "yahoo", degraded: false, caveat: null, updated_at: null },
      { asset_class: "equity", listing_country: "IN", provider: "eodhd", degraded: true,
        caveat: "eodhd needs credentials — add them in Settings", updated_at: null },
    ],
  });
  renderAt("/settings?tab=data-feeds");
  // The healthy cell shows an Active status chip; the unkeyed cell shows the SERVED caveat
  // (not colour alone). Scoped to the chip — the §14dr-2 provider table adds an "Active" column
  // header, so a bare text match is intentionally ambiguous now.
  const actives = await screen.findAllByText("Active");
  expect(actives.some((el) => el.className.includes("lf-statuschip"))).toBe(true);
  expect(screen.getByText("eodhd needs credentials — add them in Settings")).toBeTruthy();
});

test("routing matrix: an edit-time capability-mismatch 400 is rendered verbatim (§9-3)", async () => {
  vi.mocked(putRoutingCell).mockResolvedValue({ ok: false, error: "kite doesn't cover US" });
  renderAt("/settings?tab=data-feeds");
  // Fill the add-rule flow: class + market + provider, then Add.
  fireEvent.change(await screen.findByLabelText("New rule — asset class"), { target: { value: "equity" } });
  fireEvent.change(screen.getByLabelText("New rule — market"), { target: { value: "US" } });
  fireEvent.change(screen.getByLabelText("New rule — provider"), { target: { value: "kite" } });
  fireEvent.click(screen.getByRole("button", { name: /Add rule/ }));
  // The server's honest reason is surfaced verbatim in an alert — never swallowed, never fabricated.
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toBe("kite doesn't cover US");
});

test("routing matrix: adding a valid rule PUTs the served cell and reloads (§9-11)", async () => {
  renderAt("/settings?tab=data-feeds");
  fireEvent.change(await screen.findByLabelText("New rule — asset class"), { target: { value: "equity" } });
  fireEvent.change(screen.getByLabelText("New rule — market"), { target: { value: "US" } });
  fireEvent.change(screen.getByLabelText("New rule — provider"), { target: { value: "yahoo" } });
  fireEvent.click(screen.getByRole("button", { name: /Add rule/ }));
  await waitFor(() =>
    expect(putRoutingCell).toHaveBeenCalledWith({ asset_class: "equity", listing_country: "US", provider: "yahoo" }));
  // Success reloads the grid (getRoutingMatrix called again after the initial load).
  await waitFor(() => expect(vi.mocked(getRoutingMatrix).mock.calls.length).toBeGreaterThanOrEqual(2));
});

test("routing matrix: Clear deletes the cell (§9-2 fall-through)", async () => {
  vi.mocked(getRoutingMatrix).mockResolvedValue({
    cells: [{ asset_class: "equity", listing_country: "US", provider: "yahoo", degraded: false, caveat: null, updated_at: null }],
  });
  renderAt("/settings?tab=data-feeds");
  fireEvent.click(await screen.findByRole("button", { name: /Clear rule for/ }));
  await waitFor(() => expect(deleteRoutingCell).toHaveBeenCalledWith("equity", "US"));
});

test("routing matrix: editing a cell's provider PUTs the change (§9-11)", async () => {
  vi.mocked(getRoutingMatrix).mockResolvedValue({
    cells: [{ asset_class: "equity", listing_country: "US", provider: "yahoo", degraded: false, caveat: null, updated_at: null }],
  });
  renderAt("/settings?tab=data-feeds");
  const cellSelect = await screen.findByLabelText(/Provider for Equity · US/);
  fireEvent.change(cellSelect, { target: { value: "eodhd" } });
  await waitFor(() =>
    expect(putRoutingCell).toHaveBeenCalledWith({ asset_class: "equity", listing_country: "US", provider: "eodhd" }));
});

// --- §14dr-2: configured-state tables (read-only, served facts only) ---------
test("provider table surfaces served facts — SET/NOT SET, Not needed, active marker, tier note", async () => {
  vi.mocked(getDataSource).mockResolvedValue({
    ...DATA_SOURCE, provider: "alphavantage", has_api_key: true, av_tier: "premium",
  });
  vi.mocked(getProviders).mockResolvedValue({
    active: "alphavantage",
    capabilities: {
      alphavantage: { asset_classes: ["equity", "etf"], regions: ["US", "*"], needs_key: true },
      yahoo: { asset_classes: ["equity"], regions: ["*"], needs_key: false },
    },
    default_priority: {},
  });
  renderAt("/settings?tab=data-feeds");
  const table = (await screen.findByText("Configured market-data providers (read-only).")).closest("table")!;
  // needs-key active provider with a stored key → SET, labelled as the shared slot; no-key → Not needed.
  expect(within(table).getByText("SET")).toBeTruthy();
  expect(within(table).getByText("shared key slot")).toBeTruthy();
  expect(within(table).getByText("Not needed")).toBeTruthy();
  // active marker (a positive chip) + the served tier note, both on the active row.
  expect(within(table).getAllByText("Active").some((el) => el.className.includes("lf-statuschip"))).toBe(true);
  expect(within(table).getByText("premium")).toBeTruthy();
});

test("provider table shows NOT SET when the active keyed provider has no stored key", async () => {
  vi.mocked(getDataSource).mockResolvedValue({ ...DATA_SOURCE, provider: "eodhd", has_api_key: false });
  vi.mocked(getProviders).mockResolvedValue({
    active: "eodhd",
    capabilities: { eodhd: { asset_classes: ["equity"], regions: ["US"], needs_key: true } },
    default_priority: {},
  });
  renderAt("/settings?tab=data-feeds");
  const table = (await screen.findByText("Configured market-data providers (read-only).")).closest("table")!;
  expect(within(table).getByText("NOT SET")).toBeTruthy();
});

// §14 key-slot honesty ruling: under the SINGLE shared key slot, SET must show ONLY on the active
// keyed provider — every other needs-key provider reads NOT SET with honest copy that the shared
// slot currently serves the active one. (Before the fix, a stored key rendered SET on EVERY needs-key
// row — eodhd/kite read SET while alphavantage was the active, keyed provider.)
test("provider table: SET only on the active keyed row; other needs-key rows are honest NOT SET", async () => {
  vi.mocked(getDataSource).mockResolvedValue({
    ...DATA_SOURCE, provider: "alphavantage", has_api_key: true, av_tier: "free",
  });
  vi.mocked(getProviders).mockResolvedValue({
    active: "alphavantage",
    capabilities: {
      alphavantage: { asset_classes: ["equity", "etf"], regions: ["US", "*"], needs_key: true },
      eodhd: { asset_classes: ["equity"], regions: ["US", "SG", "IN"], needs_key: true },
      kite: { asset_classes: ["equity"], regions: ["IN"], needs_key: true },
      yahoo: { asset_classes: ["equity"], regions: ["*"], needs_key: false },
    },
    default_priority: {},
  });
  renderAt("/settings?tab=data-feeds");
  const table = (await screen.findByText("Configured market-data providers (read-only).")).closest("table")!;
  // Exactly ONE SET (the active, keyed alphavantage), labelled as the shared slot.
  expect(within(table).getAllByText("SET").length).toBe(1);
  expect(within(table).getByText("shared key slot")).toBeTruthy();
  // The other two needs-key providers (eodhd, kite) read NOT SET with the honest shared-slot copy.
  expect(within(table).getAllByText("NOT SET").length).toBe(2);
  expect(within(table).getAllByText("uses the shared slot — currently serving alphavantage").length).toBe(2);
  // yahoo needs no key.
  expect(within(table).getByText("Not needed")).toBeTruthy();
});

test("news feeds card lists the configured URLs read-only (Edit dialog stays the editor)", async () => {
  vi.mocked(getFeeds).mockResolvedValue({ feeds: ["https://news.example/rss.xml"], defaults: [] });
  renderAt("/settings?tab=data-feeds");
  const table = (await screen.findByText("Configured news feeds (read-only).")).closest("table")!;
  expect(within(table).getByText("https://news.example/rss.xml")).toBeTruthy();
});

test("news feeds card is honest when no feeds are configured", async () => {
  vi.mocked(getFeeds).mockResolvedValue({ feeds: [], defaults: [] });
  renderAt("/settings?tab=data-feeds");
  expect(await screen.findByText("No feeds configured.")).toBeTruthy();
});

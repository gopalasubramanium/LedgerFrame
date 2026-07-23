// Settings page — render + honest-state + Amendment-C journey guards (page-settings Phase 2).
// Every value shown is a SERVED string (D-105); these tests assert the page renders what the readers
// serve and behaves honestly (no dead buttons, no fabricated success, write-only key never echoed).
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
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
  // ⊕ 2026-07-20 (AI-surfaces §14-3). `summary` is SERVED now — the tab renders it verbatim and
  // composes nothing. Note what that means for this mock: `provider: "hailo"` is still here and is
  // deliberately NOT reflected in `summary`, because the retired vendor word must not reach the
  // screen even when the internal id is exactly that (§14-2).
  getAiConfig: vi.fn(async () => ({
    enabled: true, provider: "hailo", model: "llama3", has_openai_key: false,
    kind: "on_device_model", kind_label: "On-device model (Ollama-compatible)",
    remote: false, no_egress: false,
    summary: "AI is on — on-device model (Ollama-compatible); no data leaves this device. "
      + "Built-in answers work in every mode.",
    // §17-4 — the DEFAULT mock is the ordinary install: no override, no note. The note's
    // rendered case is driven by a per-test override below, so the quiet state is the one every
    // other test in this file exercises by default.
    env_override: false, env_override_note: null,
  })),
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
// §14dr-13 instrument-masters card (Settings → Data feeds) — served status + sync trigger, mocked.
vi.mock("../api/masters", () => ({
  getMasters: vi.fn(),
  syncMaster: vi.fn(async () => ({ ok: true, count: 5 })),
}));
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
import { getMasters, syncMaster } from "../api/masters";
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
  vi.mocked(getMasters).mockResolvedValue([
    { key: "amfi", label: "Mutual funds (AMFI)", count: 0, synced_at: null },
    { key: "coingecko", label: "Crypto (CoinGecko)", count: 5, synced_at: "2026-07-18T09:00:00+00:00" },
  ]);
  vi.mocked(syncMaster).mockResolvedValue({ ok: true, count: 5 });
  vi.mocked(putRoutingCell).mockResolvedValue({
    ok: true,
    cell: { asset_class: "equity", listing_country: "US", provider: "yahoo", degraded: false, caveat: null, updated_at: null },
  });
  vi.mocked(deleteRoutingCell).mockResolvedValue({ ok: true, deleted: true });
});
afterEach(() => cleanup());

// --- tabs + URL state (Amendment C) -----------------------------------------
test("renders the seven D-069 tabs (§14st-2, amendment #3) and defaults to General", async () => {
  renderAt();
  // D-069 amendment #3 (page-help §9-bis-11(c), 2026-07-19): About is the SEVENTH tab, reversing
  // the ruling that had made it a card inside System.
  const TABS = ["General", "Appearance", "Privacy", "Data feeds", "AI", "System", "About"];
  for (const t of TABS) {
    expect(screen.getByRole("button", { name: t })).toBeTruthy();
  }
  // The COUNT is asserted too, not just the presence of each: a strip that grew an eighth tab
  // would satisfy every check above while shipping something nobody ratified.
  const strip = screen.getByRole("group", { name: "Settings sections" });
  expect(within(strip).getAllByRole("button")).toHaveLength(TABS.length);
  // General is the default control set: base currency + timezone + the long-term threshold.
  expect(await screen.findByLabelText("Base currency")).toBeTruthy();
  expect(screen.getByLabelText("Long-term threshold in days")).toBeTruthy();
});

test("changing a tab PRESERVES sibling query params (the setParams sibling-param fix, R-54 §9-D)", async () => {
  // FAIL-FIRST: `setTab` called `setParams({ tab: v })` with a FRESH object, which drops EVERY
  // sibling param. A deep link like `/settings?tab=general&keep=me` lost `keep` on the first tab
  // click. Latent today (no sibling is produced yet — R-60's `?control=` is post-release), fixed
  // here under the guard-REDs-an-accepted-surface rite so a future sibling can never be dropped.
  let search = "";
  function Probe() {
    search = useLocation().search;
    return null;
  }
  render(
    <MemoryRouter initialEntries={["/settings?tab=general&keep=me"]}>
      <ThemeProvider><DisplayProvider><ToastProvider>
        <Settings />
        <Probe />
      </ToastProvider></DisplayProvider></ThemeProvider>
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Appearance" }));
  await waitFor(() => expect(search).toContain("tab=appearance"));
  expect(search).toContain("keep=me"); // the sibling survives the tab switch
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
  // arrival at the CONTROL: the served AI-config display line.
  //
  // ⊕ 2026-07-20 (AI-surfaces §14-3) — and the CHANGE OF SUBJECT here is the point. This used to
  // assert /^AI is (on|off)/ against a sentence the COMPONENT composed from the payload, so it
  // could only ever confirm that the component's own template still ran. It could not have caught
  // Finding 6, in which the payload described a provider that was not the one answering: the
  // template would have rendered the wrong provider in the right shape, and this assertion would
  // have been green. It now asserts the SERVED sentence is rendered VERBATIM, which is a claim
  // about the boundary rather than about the template.
  const line = await screen.findByTestId("ai-config-summary");
  expect(line.textContent).toBe(
    "AI is on — on-device model (Ollama-compatible); no data leaves this device. "
    + "Built-in answers work in every mode.",
  );
  // §14-2 — the retired vendor word never reaches the screen, even though `provider` IS "hailo".
  expect(line.textContent).not.toMatch(/hailo/i);
  // The static note. ⊕ UPDATED 2026-07-20 (AI-surfaces §9(b); page-settings §15st-1): it used to
  // read "Model management lives with the AI surfaces", which promised a milestone that has now
  // ARRIVED — the Ask panel shipped. The dead-affordance rule cuts both ways: a note pointing at
  // a milestone that has landed is as misleading as a control that does nothing. Model MANAGEMENT
  // genuinely did not ship, so the note now says only that, and names what DID.
  expect(screen.getByText(/Model management is not configurable here yet/i)).toBeTruthy();
  expect(screen.getByText(/Ask, in the top bar/i)).toBeTruthy();
  // §14-3 — the tab says that an external model is configured here AND what that would mean for
  // the data. Naming the kind without its consequence is only half of what the ruling asked for.
  expect(screen.getByText(/external model, which would send your data off this device/i)).toBeTruthy();
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
    // R-63 I-4: verified quote entitlement ("delayed") is a DIFFERENT product from the Index-Data
    // tier ("premium") — the table shows them PER PRODUCT, never one coarse "premium" claim.
    ...DATA_SOURCE, provider: "alphavantage", has_api_key: true,
    av_tier: "premium", quote_entitlement: "delayed",
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
  // active marker (a positive chip) + the VERIFIED-tier cell, both on the active row. I-4: the
  // quote entitlement and the Index-Data tier are shown as distinct products — never "premium" alone.
  expect(within(table).getAllByText("Active").some((el) => el.className.includes("lf-statuschip"))).toBe(true);
  expect(within(table).getByText("Quotes: delayed")).toBeTruthy();
  expect(within(table).getByText("Indices: premium")).toBeTruthy();
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

// --- §14dr-13 instrument-masters card (Settings → Data feeds) ----------------
// The card the picker's never-synced empty points at (§14ac-2 journey destination).
test("masters card serves honest last-synced state per master (Never synced vs a served date)", async () => {
  renderAt("/settings?tab=data-feeds");
  expect(await screen.findByText("Instrument masters")).toBeTruthy();
  // AMFI mock: never synced → the honest empty, not a fabricated date.
  const amfi = (await screen.findByText("Mutual funds (AMFI)")).closest(".set__masterrow") as HTMLElement;
  expect(within(amfi).getByText("Never synced")).toBeTruthy();
  // CoinGecko mock: synced → the served date + count (a display slice, not computed).
  const cg = (await screen.findByText("Crypto (CoinGecko)")).closest(".set__masterrow") as HTMLElement;
  expect(within(cg).getByText("Last synced 2026-07-18 · 5 entries")).toBeTruthy();
});

test("Sync now triggers the master sync and reports the served result (no fabricated progress)", async () => {
  renderAt("/settings?tab=data-feeds");
  const amfi = (await screen.findByText("Mutual funds (AMFI)")).closest(".set__masterrow") as HTMLElement;
  fireEvent.click(within(amfi).getByRole("button", { name: "Sync now" }));
  await waitFor(() => expect(vi.mocked(syncMaster)).toHaveBeenCalledWith("amfi"));
  expect(await screen.findByText("Sync complete — 5 entries.")).toBeTruthy();
});

test("masters card is honest when the status readers fail (retry, never a fake row)", async () => {
  vi.mocked(getMasters).mockResolvedValue(null);
  renderAt("/settings?tab=data-feeds");
  expect(await screen.findByText("Couldn't load masters")).toBeTruthy();
});

// --- About, the 7th tab, on the FOUR-BEAT template (page-help §9-bis-13) -----
test("About: the four beats, the pull-quote, the author with a LOCAL photo, and the six links", async () => {
  renderAt("/settings?tab=about");

  // The four beats, in order. Order is the assertion, not just presence: the template IS a
  // narrative, and Resolution before Conflict is not the same page.
  const beats = ["The Story & Mission", "The Conflict", "The Resolution", "The Sequel"];
  expect(await screen.findByText(beats[0])).toBeTruthy();
  const headings = screen.getAllByRole("heading", { level: 2 });
  // Order, with the ✦ ornament stripped — it is in `textContent` because it is a real character.
  expect(headings.map((h) => h.textContent!.replace("✦", ""))).toEqual([...beats, "Who built it"]);

  // …and the ornament is NOT in the ACCESSIBLE NAME. `getByRole({ name })` computes the accname,
  // which honours `aria-hidden` — so this fails the moment the glyph stops being decorative and a
  // screen reader starts announcing "black four pointed star, The Conflict".
  for (const beat of beats) {
    expect(screen.getByRole("heading", { level: 2, name: beat })).toBeTruthy();
  }

  // ⚠ THE ACCURACY VETO, KEPT AS A GUARD. The template arrived describing a trading product, and
  // three of its phrases were struck (§9-bis-13). About satisfies the SAME truth bar as Help
  // content: the rule that forbids a fabricated figure forbids a fabricated self-description by
  // the same logic. This asserts the vetoed vocabulary cannot come back in a later copy edit —
  // a ruling nobody can find is a ruling that gets re-litigated.
  const page = document.body.textContent ?? "";
  for (const banned of [/trading system/i, /purposeful profit/i, /seamless integration/i,
                        /empowering teams/i, /allocat/i]) {
    expect(page, `About uses vetoed template wording: ${banned}`).not.toMatch(banned);
  }

  // The pull-quote: bold-italic, centred, and NO terminal full stop (the owner's punctuation
  // rule — prose takes full stops, pull-quotes and headings are exempt).
  const quote = document.querySelector(".set__pullquote")!;
  expect(quote.textContent).toBe("One honest picture of everything you own and owe");

  expect(screen.getByText("Gopala Subramanium")).toBeTruthy();

  // THE PHOTO IS BUNDLED, NEVER FETCHED. A local-first appliance that advertises no telemetry
  // cannot reach github.com to draw a face, and under no-egress a remote image would fail
  // visibly. The bundler rewrites the import to a local URL, so the assertion is that the src is
  // NOT remote — the pre-pass proves the stronger claim (no request leaves) from the live page's
  // own request log, which is the only place that can actually be observed.
  const photo = screen.getByAltText("Gopala Subramanium") as HTMLImageElement;
  expect(photo.getAttribute("src")).toBeTruthy();
  expect(photo.getAttribute("src")).not.toMatch(/^https?:\/\//);

  // All six owner-specified links. Each carries BOTH rel tokens (`noopener` denies the opened page
  // a handle back to this one, and it is not optional on target="_blank"), and each carries an
  // ACCESSIBLE NAME — these links are icon-only, so without the label they announce as their bare
  // URL or as nothing at all. The name is where the meaning lives, because lucide 1.24.0 has no
  // brand glyphs and the icons are semantic stand-ins (§9-bis-13).
  const links: [string, string][] = [
    ["https://ledgerframe.org", "Project home"],
    ["https://github.com/gopalasubramanium/ledgerframe", "Source code on GitHub"],
    ["https://me.sgopala.com/", "Author's site"],
    ["https://github.com/gopalasubramanium", "Author on GitHub"],
    ["https://www.linkedin.com/in/gopalasubramanium/", "Author on LinkedIn"],
    ["https://paypal.me/sgopala", "Support the project"],
  ];
  for (const [href, name] of links) {
    const a = document.querySelector(`a[href="${href}"]`);
    expect(a, `About is missing the link ${href}`).toBeTruthy();
    expect(a!.getAttribute("rel")).toContain("noopener");
    expect(a!.getAttribute("rel")).toContain("noreferrer");
    expect(a!.getAttribute("aria-label"), `${href} has no accessible name`).toBe(name);
  }

  // The licence line survived the rebuild. It is the only sentence on the surface that is a legal
  // claim, and a rebuild is exactly when that kind of line goes missing unnoticed.
  expect(screen.getByText(/AGPL-3\.0-or-later/)).toBeTruthy();
});

test("About: the destination URL is revealed on FOCUS, not just hover", async () => {
  // A `title` attribute was the obvious way to show the URL and is the wrong one: it never appears
  // for keyboard focus. This asserts the keyboard path specifically, because it is the one that
  // silently regresses the moment someone "simplifies" this back to a title.
  renderAt("/settings?tab=about");
  const home = (await screen.findByLabelText("Project home")) as HTMLAnchorElement;

  expect(document.querySelector(".set__socialcap")!.textContent!.trim()).toBe("");
  fireEvent.focus(home);
  expect(document.querySelector(".set__socialcap")!.textContent).toBe("ledgerframe.org");
  fireEvent.blur(home);
  expect(document.querySelector(".set__socialcap")!.textContent!.trim()).toBe("");
});

test("About left the System tab — it is not rendered in both places", async () => {
  // The §9-bis-6 card lived inside System. When it became a tab, the card had to GO, not stay:
  // two homes for one surface is the duplication the IA law exists to prevent, and it is exactly
  // the shape of the Policy defect fixed in this same milestone.
  renderAt("/settings?tab=system");
  await screen.findByText("PIN");
  expect(screen.queryByText("The Conflict")).toBeNull();
  expect(screen.queryByAltText("Gopala Subramanium")).toBeNull();
});

// --- §17-4 / Finding 9: the tab says when writing to it would do nothing ---------------------- //
//
// Under ruling (a) this tab is always TRUE — it reports what the process runs. What it never said
// is that a PUT writing `.env` may not CHANGE that: an OS-env override outranks the file, so the
// user saves, the line honestly reports something else, and NOTHING ON SCREEN EXPLAINS WHY. A true
// sentence beside an unexplained outcome is its own kind of dishonesty — the reader concludes the
// save failed, or that they misread the tab, and neither is what happened.
//
// BOTH DIRECTIONS, because the failure mode of a conditional warning is never "it did not render",
// it is "it rendered when it was not true". A device wrongly told its saves do nothing has been
// given a reason to stop trusting the tab at all — which costs more than the warning was worth.

const OVERRIDE_NOTE =
  "This device's configuration is currently set by its environment — changes written here will " +
  "not take effect until that override is removed.";

test("§17-4: the override note renders when the environment outranks the file", async () => {
  const { getAiConfig } = await import("../api/systemConfig");
  vi.mocked(getAiConfig).mockResolvedValueOnce({
    enabled: true, provider: "hailo", model: "llama3", has_openai_key: false,
    kind: "on_device_model", kind_label: "On-device model (Ollama-compatible)",
    remote: false, no_egress: false,
    summary: "AI is on — on-device model (Ollama-compatible); no data leaves this device. "
      + "Built-in answers work in every mode.",
    env_override: true, env_override_note: OVERRIDE_NOTE,
  });

  renderAt("/settings?tab=ai");
  // SERVED and rendered VERBATIM — the browser does not author the product's claims about itself
  // (§0-C). Asserting the exact string is what makes that a claim about the boundary rather than
  // about this component's template.
  const note = await screen.findByTestId("ai-config-env-override");
  expect(note.textContent).toBe(OVERRIDE_NOTE);
});

test("§17-4: NO override note on an ordinary install — the direction that matters most", async () => {
  // The default mock is `env_override: false`. A warning that fires here would tell a correctly
  // configured device that saving does nothing, which is both false and alarming.
  renderAt("/settings?tab=ai");
  await screen.findByTestId("ai-config-summary");
  expect(screen.queryByTestId("ai-config-env-override")).toBeNull();
});

test("§17-4: the tab renders NO note the server did not send, even if it claims an override", async () => {
  // The anti-composition arm. `env_override: true` with no served sentence must produce silence,
  // not a sentence this component invented to fill the gap — the §0-C defect would be reintroduced
  // precisely here, in the branch where a helpful-looking fallback string is most tempting.
  const { getAiConfig } = await import("../api/systemConfig");
  vi.mocked(getAiConfig).mockResolvedValueOnce({
    enabled: true, provider: "hailo", model: "llama3", has_openai_key: false,
    kind: "on_device_model", kind_label: "On-device model (Ollama-compatible)",
    remote: false, no_egress: false,
    summary: "AI is on — on-device model (Ollama-compatible); no data leaves this device. "
      + "Built-in answers work in every mode.",
    env_override: true, env_override_note: null,
  });

  renderAt("/settings?tab=ai");
  await screen.findByTestId("ai-config-summary");
  expect(screen.queryByTestId("ai-config-env-override")).toBeNull();
});

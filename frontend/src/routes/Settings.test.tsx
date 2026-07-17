// Settings page — render + honest-state + Amendment-C journey guards (page-settings Phase 2).
// Every value shown is a SERVED string (D-105); these tests assert the page renders what the readers
// serve and behaves honestly (no dead buttons, no fabricated success, write-only key never echoed).
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, fireEvent, within } from "@testing-library/react";
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

import { getSettings } from "../api/settings";
import { listTokens } from "../api/tokens";
import { getDataSource, getPinSet } from "../api/systemConfig";

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

beforeEach(() => {
  vi.mocked(getSettings).mockResolvedValue(SETTINGS);
  vi.mocked(listTokens).mockResolvedValue([]);
  vi.mocked(getDataSource).mockResolvedValue(DATA_SOURCE);
  vi.mocked(getPinSet).mockResolvedValue(false);
});
afterEach(() => cleanup());

// --- tabs + URL state (Amendment C) -----------------------------------------
test("renders the four D-069 tabs and defaults to General", async () => {
  renderAt();
  for (const t of ["General", "Appearance", "Privacy", "System"]) {
    expect(screen.getByRole("button", { name: t })).toBeTruthy();
  }
  // General is the default control set: base currency + timezone + the long-term threshold.
  expect(await screen.findByLabelText("Base currency")).toBeTruthy();
  expect(screen.getByLabelText("Long-term threshold in days")).toBeTruthy();
});

test("General serves long_term_days verbatim (D-105 — the frontend carries no 365 literal)", async () => {
  renderAt("/settings?tab=general");
  const field = await screen.findByLabelText("Long-term threshold in days");
  expect((field as HTMLInputElement).value).toBe("365");
});

// Amendment C — tab state is URL-addressable; deep-linking lands on that tab's CONTROL (§14ac-2).
test("Amendment C: ?tab=privacy deep-links to the no-egress control + derived statement", async () => {
  renderAt("/settings?tab=privacy");
  expect(await screen.findByLabelText("No-egress mode")).toBeTruthy();
  // The protected copy is VERBATIM and DERIVED from the one toggle (§9-9), never a metric.
  expect(screen.getByText("This device makes no network calls.")).toBeTruthy();
  expect(screen.getByText(/No-egress: On/)).toBeTruthy();
});

test("Amendment C: ?tab=system deep-links to the PIN + provider controls (first-run journey target)", async () => {
  renderAt("/settings?tab=system");
  // arrival at the CONTROL, not the href: the PIN card + the provider select are on screen.
  expect(await screen.findByRole("button", { name: /Set PIN/ })).toBeTruthy();
  expect(screen.getByLabelText("Market data provider")).toBeTruthy();
});

// --- honest states -----------------------------------------------------------
test("PIN card shows an honest 'not set' state and offers to set one", async () => {
  renderAt("/settings?tab=system");
  expect(await screen.findByText("PIN: not set")).toBeTruthy();
  expect(screen.getByRole("button", { name: /Set PIN/ })).toBeTruthy();
});

test("write-only API key never echoes a value — an honest 'set, hidden' state", async () => {
  vi.mocked(getDataSource).mockResolvedValue({ ...DATA_SOURCE, has_api_key: true });
  renderAt("/settings?tab=system");
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

import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../theme/ThemeProvider";
import { DisplayProvider } from "../theme/DisplayProvider";
import { ToastProvider } from "../components/ui";
import { RefdataContext } from "../refdata/refdata-context";
import type { Vocabs } from "../refdata/refdata-context";
import { Accounts } from "./Accounts";
import { holdingsForAccount } from "../nav/holdingsLink";
import type {
  AccountsReport,
  AccountListRow,
  EntityRow,
  InstitutionRow,
} from "../api/accounts";

// page-accounts §13 (Phase 2). The page renders SERVED labels + display strings verbatim, so the
// vocabs are wired here (proves the FIFO override reaches the cell, not the titleizer's "Fifo").
const VOCABS: Vocabs = {
  account_kind: [
    { value: "brokerage", label: "Brokerage" }, { value: "bank", label: "Bank" },
    { value: "wallet", label: "Wallet" }, { value: "retirement", label: "Retirement" },
  ],
  cost_basis_method: [{ value: "fifo", label: "FIFO" }, { value: "average", label: "Average" }],
  entity_kind: [
    { value: "self", label: "Self" }, { value: "trust", label: "Trust" },
    { value: "spouse", label: "Spouse" }, { value: "company", label: "Company" },
  ],
  currency: [{ value: "SGD", label: "SGD" }, { value: "USD", label: "USD" }, { value: "INR", label: "INR" }],
};

// A NON-SGD base (INR) — the §12ac-1 guard: the Value header must follow the SERVED base_currency,
// so a hardcoded "SGD" goes RED here. total_display is the exact sum of the three rows (tile-integrity).
const REPORT: AccountsReport = {
  base_currency: "INR",
  total: 175000,
  total_display: "175,000.00",
  count: 3,
  disclaimer: "…",
  accounts: [
    { id: 1, name: "Citi SG", institution: "Citibank Singapore", kind: "brokerage", currency: "SGD",
      cost_basis_method: "fifo", value: 100000, value_display: "100,000.00", holdings: 4,
      asset_classes: ["equity"], currencies: ["SGD"], stale: 0, low_confidence: 0, last_activity: "2026-06-01" },
    { id: 2, name: "Saxo", institution: "Saxo Markets", kind: "bank", currency: "USD",
      cost_basis_method: "average", value: 50000, value_display: "50,000.00", holdings: 2,
      asset_classes: ["cash"], currencies: ["USD"], stale: 0, low_confidence: 0, last_activity: "2026-05-01" },
    { id: 3, name: "Wallet", institution: null, kind: "wallet", currency: "INR",
      cost_basis_method: "fifo", value: 25000, value_display: "25,000.00", holdings: 1,
      asset_classes: ["crypto"], currencies: ["INR"], stale: 0, low_confidence: 0, last_activity: null },
  ],
};
const LIST: AccountListRow[] = [
  { id: 1, name: "Citi SG", institution: "Citibank Singapore", kind: "brokerage", currency: "SGD", entity_id: 10, cost_basis_method: "fifo" },
  { id: 2, name: "Saxo", institution: "Saxo Markets", kind: "bank", currency: "USD", entity_id: 20, cost_basis_method: "average" },
  { id: 3, name: "Wallet", institution: null, kind: "wallet", currency: "INR", entity_id: null, cost_basis_method: "fifo" },
];
const ENTITIES: EntityRow[] = [
  { id: 10, name: "Household", kind: "self" },
  { id: 20, name: "Rajan Family Trust", kind: "trust" },
  { id: 30, name: "Meera Iyer", kind: "spouse" }, // 0 accounts → deletable
];
const BASE_INSTITUTIONS: InstitutionRow[] = [
  { id: 100, name: "Citibank Singapore", account_count: 1, policy_count: 0 },
  { id: 101, name: "Saxo Markets", account_count: 1, policy_count: 0 },
  { id: 102, name: "Citibank", account_count: 1, policy_count: 2 }, // referenced → FK-block + merge demo
];

let institutionsData: InstitutionRow[] = [];

vi.mock("../api/accounts", () => ({
  fetchAccounts: vi.fn(),
  fetchAccountList: vi.fn(),
  fetchEntities: vi.fn(),
  fetchInstitutions: vi.fn(),
  createAccount: vi.fn(async () => ({ ok: true, data: { ok: true, id: 9 } })),
  updateAccount: vi.fn(async () => ({ ok: true, data: { ok: true } })),
  deleteAccount: vi.fn(async () => ({ ok: true, data: { ok: true } })),
  createEntity: vi.fn(async () => ({ ok: true, data: { ok: true, id: 9, name: "X", kind: "self" } })),
  updateEntity: vi.fn(async () => ({ ok: true, data: { ok: true, id: 9, name: "X", kind: "self" } })),
  deleteEntity: vi.fn(async () => ({ ok: true, data: { ok: true } })),
  createInstitution: vi.fn(),
  renameInstitution: vi.fn(async () => ({ ok: true, data: { ok: true, id: 1, name: "X" } })),
  deleteInstitution: vi.fn(async () => ({ ok: true, data: { ok: true } })),
  mergeInstitutions: vi.fn(async () => ({
    ok: true,
    data: { ok: true, survivor_id: 100, duplicate_id: 102, survivor_name: "Citibank Singapore", repointed: 3 },
  })),
}));
import {
  fetchAccounts,
  fetchAccountList,
  fetchEntities,
  fetchInstitutions,
  createInstitution,
  mergeInstitutions,
} from "../api/accounts";

const mReport = vi.mocked(fetchAccounts);
const mList = vi.mocked(fetchAccountList);
const mEntities = vi.mocked(fetchEntities);
const mInstitutions = vi.mocked(fetchInstitutions);
const mCreateInst = vi.mocked(createInstitution);
const mMerge = vi.mocked(mergeInstitutions);

function setData(opts?: { report?: AccountsReport | null; entities?: EntityRow[]; institutions?: InstitutionRow[] }) {
  const report = opts?.report === undefined ? REPORT : opts.report;
  mReport.mockResolvedValue(report ? { ok: true as const, data: report } : { ok: false as const, error: "boom" });
  mList.mockResolvedValue({ ok: true as const, data: { accounts: report ? LIST : [], kinds: [] } });
  mEntities.mockResolvedValue({ ok: true as const, data: { entities: opts?.entities ?? ENTITIES } });
  institutionsData = [...(opts?.institutions ?? BASE_INSTITUTIONS)];
  mInstitutions.mockImplementation(async () => ({ ok: true as const, data: { institutions: institutionsData } }));
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ThemeProvider><DisplayProvider><ToastProvider>
        <RefdataContext.Provider value={{ vocabs: VOCABS, txnApplicability: null }}>
          <Accounts />
        </RefdataContext.Provider>
      </ToastProvider></DisplayProvider></ThemeProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  setData();
  mCreateInst.mockImplementation(async (name: string) => {
    institutionsData.push({ id: 200, name, account_count: 0, policy_count: 0 });
    return { ok: true as const, data: { ok: true, id: 200, name } };
  });
});
afterEach(() => cleanup());

test("§12ac-1: the Value header carries the SERVED base_currency, never hardcoded", async () => {
  renderPage();
  // RED if hardcoded "SGD": the fixture serves base_currency "INR".
  expect(await screen.findByText("Value (INR)")).toBeTruthy();
  expect(screen.queryByText("Value (SGD)")).toBeNull();
});

test("served labels render VERBATIM (FIFO, not the titleizer's Fifo); entity-less cell is an em dash", async () => {
  const { container } = renderPage();
  await screen.findByText("Value (INR)");
  const table = container.querySelector('[data-card="accounts"] table') as HTMLElement;
  expect(within(table).getAllByText("FIFO").length).toBeGreaterThan(0);
  expect(within(table).queryByText("Fifo")).toBeNull();
  expect(within(table).getByText("Average")).toBeTruthy();
  // The entity-less account (Wallet) shows a bare em dash in its Entity cell (column index 5 now that
  // Name leads: Name(0) Institution(1) Kind(2) Currency(3) Cost basis(4) Entity(5) Value(6) actions(7)).
  const walletRow = [...table.querySelectorAll("tbody tr")].find((r) => r.textContent?.includes("Wallet"))!;
  expect((walletRow.querySelectorAll("td")[5] as HTMLElement).textContent).toBe("—");
});

test("§14ac-1 + §14ac-5: the FIRST column is the account Name, rendered as a link to the shared Holdings URL", async () => {
  const { container } = renderPage();
  await screen.findByText("Value (INR)");
  const table = container.querySelector('[data-card="accounts"] table') as HTMLElement;
  // first data column is the name; the institution-less row (Wallet, institution null) is still
  // identifiable BY NAME (the §14ac-1 defect: institution-led rows were unidentifiable).
  const walletRow = [...table.querySelectorAll("tbody tr")].find((r) => (r.querySelectorAll("td")[1] as HTMLElement).textContent === "—")!;
  const nameCell = walletRow.querySelectorAll("td")[0] as HTMLElement;
  const link = nameCell.querySelector("a") as HTMLAnchorElement;
  expect(link, "the name is a link").toBeTruthy();
  expect(nameCell.textContent).toBe("Wallet");
  // the href is the SHARED builder's output (HashRouter renders it under the hash).
  expect(link.getAttribute("href")).toContain(holdingsForAccount(3)); // Wallet is id 3
});

test("footer Σ equals total_display AND the sum of the rendered value rows (tile-integrity)", async () => {
  const { container } = renderPage();
  await screen.findByText("Value (INR)");
  const table = container.querySelector('[data-card="accounts"] table') as HTMLElement;
  const num = (s: string) => Number(s.replace(/[^0-9.-]/g, ""));
  // value column is index 6 (name, institution, kind, currency, cost basis, entity, value, actions).
  const rowValues = [...table.querySelectorAll("tbody tr")].map((r) => num((r.querySelectorAll("td")[6] as HTMLElement).textContent ?? "0"));
  const sum = rowValues.reduce((a, b) => a + b, 0);
  const footer = table.querySelector("tfoot") as HTMLElement;
  // the footer's VALUE cell is the same column index (6) — not the "N accounts" entity cell.
  const footerValue = num((footer.querySelectorAll("td")[6] as HTMLElement).textContent ?? "0");
  expect(sum).toBe(175000); // 100,000 + 50,000 + 25,000
  expect(footerValue).toBe(sum); // served total_display == Σ rendered rows
});

test("honest empty states (Product Guarantee 3) — no accounts / no institutions", async () => {
  setData({ report: null, entities: [], institutions: [] });
  // report:null → the reader-error state; use an empty (not error) report instead to hit the empty CTA.
  mReport.mockResolvedValue({ ok: true as const, data: { ...REPORT, accounts: [], count: 0 } });
  mList.mockResolvedValue({ ok: true as const, data: { accounts: [], kinds: [] } });
  mEntities.mockResolvedValue({ ok: true as const, data: { entities: [] } });
  renderPage();
  expect(await screen.findByText("No accounts yet")).toBeTruthy();
  expect(screen.getByText("No entities yet")).toBeTruthy();
  expect(screen.getByText("No institutions yet")).toBeTruthy();
});

test("entity FK-block dialog body is rendered verbatim (§12ac-5 protected copy)", async () => {
  const user = userEvent.setup();
  renderPage();
  await screen.findByText("Value (INR)");
  await user.click(screen.getByRole("button", { name: "Actions for Household" }));
  await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
  // Household has 1 assigned account → blocked, Delete disabled, ratified body shown.
  expect(await screen.findByText(/still\s+assigned to it\. Reassign those accounts to another entity first/)).toBeTruthy();
});

test("institution FK-block body offers merge with the SERVED counts (§12ac-5)", async () => {
  const user = userEvent.setup();
  renderPage();
  await screen.findByText("Value (INR)");
  await user.click(screen.getByRole("button", { name: "Actions for Citibank" }));
  await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
  // Citibank: served account_count 1 + policy_count 2 → "1 account and 2 policies still use it".
  expect(await screen.findByText(/1 account and 2 policies still use it/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Merge instead…" })).toBeTruthy();
});

test("merge consequence renders the duplicate's SERVED counts; merge calls the endpoint once", async () => {
  const user = userEvent.setup();
  renderPage();
  await screen.findByText("Value (INR)");
  await user.click(screen.getByRole("button", { name: "Actions for Citibank" }));
  await user.click(await screen.findByRole("menuitem", { name: "Merge…" }));
  // Duplicate is preset to Citibank (id 102); pick the survivor.
  fireEvent.change(screen.getByLabelText("Survivor institution"), { target: { value: "100" } });
  // Consequence reads the SERVED counts of the duplicate (1 account + 2 policies).
  expect(await screen.findByText(/1 account and 2 policies will move to/)).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Merge" }));
  await waitFor(() => expect(mMerge).toHaveBeenCalledTimes(1));
  expect(mMerge).toHaveBeenCalledWith(100, 102);
});

test("live master round-trip: Create-new POSTs to /institutions and the new row appears", async () => {
  const user = userEvent.setup();
  renderPage();
  await screen.findByText("Value (INR)");
  // Open the account editor.
  await user.click(screen.getByRole("button", { name: "Add account" }));
  await screen.findByLabelText("Institution");
  // Choose "＋ Create new…" then type the new institution and commit.
  fireEvent.change(screen.getByLabelText("Institution"), { target: { value: "__create__" } });
  const input = await screen.findByLabelText("New Institution");
  fireEvent.change(input, { target: { value: "Fresh Bank" } });
  fireEvent.keyDown(input, { key: "Enter" });
  await waitFor(() => expect(mCreateInst).toHaveBeenCalledWith("Fresh Bank"));
  // It POSTed to the master and the master card now lists it (reload picked up the new row).
  const instCard = document.querySelector('[data-card="institutions"]') as HTMLElement;
  await waitFor(() => expect(within(instCard).getByText("Fresh Bank")).toBeTruthy());
});

test("FAIL-FIRST: when the POST is rejected the institution is NOT added to the master", async () => {
  const user = userEvent.setup();
  mCreateInst.mockResolvedValue({ ok: false as const, error: "master unavailable" });
  renderPage();
  await screen.findByText("Value (INR)");
  await user.click(screen.getByRole("button", { name: "Add account" }));
  await screen.findByLabelText("Institution");
  fireEvent.change(screen.getByLabelText("Institution"), { target: { value: "__create__" } });
  const input = await screen.findByLabelText("New Institution");
  fireEvent.change(input, { target: { value: "Rejected Bank" } });
  fireEvent.keyDown(input, { key: "Enter" });
  await waitFor(() => expect(mCreateInst).toHaveBeenCalledWith("Rejected Bank"));
  const instCard = document.querySelector('[data-card="institutions"]') as HTMLElement;
  expect(within(instCard).queryByText("Rejected Bank")).toBeNull();
});

import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../theme/ThemeProvider";
import { DisplayProvider } from "../theme/DisplayProvider";
import { ToastProvider } from "../components/ui";
import { CashFlow } from "./CashFlow";

const RUNWAY = {
  base_currency: "SGD", liquid: 120000, liquid_display: "120,000.00",
  monthly_expense: 8777.5, monthly_expense_display: "8,777.50",
  monthly_income: 13140, monthly_income_display: "13,140.00",
  net_monthly_burn: 3470, net_monthly_burn_display: "3,470.00",
  runway_months: 14.2, runway_date: "2027-09-01", status: "finite",
  note: "At your recorded recurring net burn, your liquid assets would last this long.",
  disclaimer: "Indicative — liquid assets ÷ your recorded recurring net burn, at today's FX.",
};

const OBS = {
  base_currency: "SGD",
  obligations: [
    { id: 1, name: "Rent", amount: 4200, amount_display: "4,200.00", currency: "SGD",
      amount_base: 4200, amount_base_display: "4,200.00",
      monthly_equivalent: 4200, monthly_equivalent_display: "4,200.00",
      due_date: "2026-08-01", recurrence: "monthly", kind: "expense", note: null,
      occurrences_12m: 12, next_due: "2026-08-01" },
    // A `once` obligation: NO monthly rate. It must render "—", never "0.00".
    { id: 2, name: "Income tax", amount: 18400, amount_display: "18,400.00", currency: "SGD",
      amount_base: 18400, amount_base_display: "18,400.00",
      monthly_equivalent: null, monthly_equivalent_display: null,
      due_date: "2026-09-30", recurrence: "once", kind: "expense", note: null,
      occurrences_12m: 1, next_due: "2026-09-30" },
  ],
  next_12m_total: 68800, next_12m_total_display: "68,800.00",
  disclaimer: "Known future cash flows you've entered.",
};

const CONS = {
  base_currency: "SGD",
  contributions: [
    { id: 10, name: "VWRA SIP", amount: 2000, amount_display: "2,000.00", currency: "SGD",
      frequency: "monthly", kind: "invest", target_goal_id: 100,
      monthly_equivalent: 2000, monthly_equivalent_display: "2,000.00",
      start_date: null, active: true, note: null },
    // An ORPHAN: it points at a goal that no longer exists (a SOFT link, no FK).
    { id: 11, name: "Orphaned plan", amount: 500, amount_display: "500.00", currency: "SGD",
      frequency: "monthly", kind: "invest", target_goal_id: 999,
      monthly_equivalent: 500, monthly_equivalent_display: "500.00",
      start_date: null, active: true, note: null },
  ],
  monthly_invest: 2500, monthly_invest_display: "2,500.00",
  monthly_withdraw: 0, monthly_withdraw_display: "0.00",
  monthly_net_investing: 2500, monthly_net_investing_display: "2,500.00",
  monthly_cash_out_with_expenses: 11277.5, monthly_cash_out_with_expenses_display: "11,277.50",
  disclaimer: "Recorded plans, not projections. Contributions build wealth, so they do not reduce the cash runway.",
};

const GOALS = {
  base_currency: "SGD",
  goals: [
    { id: 100, name: "House deposit", basis: "net_worth", currency: "SGD",
      target_amount: 250000, target_amount_display: "250,000.00",
      target_base: 250000, target_base_display: "250,000.00", target_date: "2028-01-01", note: null,
      current_base: 156000, current_base_display: "156,000.00", progress_pct: 62.4,
      remaining_base: 94000, remaining_base_display: "94,000.00", days_to_target: 540 },
    // basis "none": NO progress. Must render "—", never 0%.
    { id: 101, name: "Sabbatical fund", basis: "none", currency: "SGD",
      target_amount: 60000, target_amount_display: "60,000.00",
      target_base: 60000, target_base_display: "60,000.00", target_date: null, note: null,
      current_base: null, current_base_display: null, progress_pct: null,
      remaining_base: null, remaining_base_display: null, days_to_target: null },
  ],
  disclaimer: "Progress is a fact against your target — not a forecast or advice.",
};

function mockFetch(over: { obs?: unknown; cons?: unknown; goals?: unknown; postStatus?: number; postBody?: unknown } = {}) {
  const sent: { path: string; method: string; body: unknown }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const path = String(url);
    const method = init?.method ?? "GET";
    if (method !== "GET") {
      sent.push({ path, method, body: init?.body ? JSON.parse(String(init.body)) : null });
      const status = over.postStatus ?? 200;
      return new Response(JSON.stringify(over.postBody ?? { id: 1, ok: true }),
        { status, headers: { "content-type": "application/json" } });
    }
    const body = path.includes("/portfolio/runway") ? RUNWAY
      : path.includes("/obligations") ? (over.obs ?? OBS)
        : path.includes("/contributions") ? (over.cons ?? CONS)
          : path.includes("/goals") ? (over.goals ?? GOALS)
            : {};
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }));
  return sent;
}

/** Scope to ONE section — "House deposit" also appears in the contributions "Towards" cell, and a
 *  page-wide query would silently measure the wrong table. */
const section = (c: HTMLElement, name: string) => c.querySelector(`[data-card="${name}"]`) as HTMLElement;
const rowIn = (c: HTMLElement, name: string, text: string) =>
  [...section(c, name).querySelectorAll("tbody tr")].find((r) => r.textContent?.includes(text)) as HTMLElement;
/** The cell under a given column, by its index in that table's header row. */
const cellUnder = (row: HTMLElement, table: HTMLElement, label: string) => {
  const heads = [...table.querySelectorAll("thead th")].map((h) => h.textContent?.trim() ?? "");
  const i = heads.findIndex((h) => h.startsWith(label));
  return row.querySelectorAll("td")[i] as HTMLElement;
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <ThemeProvider><DisplayProvider><ToastProvider>
        <CashFlow />
      </ToastProvider></DisplayProvider></ThemeProvider>
    </MemoryRouter>,
  );

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test("the three sections render served money VERBATIM (D-105 — the page formats no money)", async () => {
  mockFetch();
  renderPage();
  // 4,200.00 is BOTH the amount and the monthly equivalent — a page-wide getByText would be
  // ambiguous, and asserting "one of them exists" would prove nothing about which.
  expect((await screen.findAllByText("4,200.00")).length).toBeGreaterThanOrEqual(2);
  // The total sits beside its [Help] term, so the text is split across nodes — assert on the
  // section header, not on a naive whole-string match.
  const { container } = renderPage();
  void container;
  expect(screen.getAllByText(/68,800\.00/).length).toBeGreaterThan(0);   // next-12m total
  expect(screen.getByText("3,470.00")).toBeTruthy();        // net monthly burn (SERVED)
  expect(screen.getByText("250,000.00")).toBeTruthy();
});

test("D-057 — a `once` obligation shows NO monthly equivalent: an em dash, never 0", async () => {
  mockFetch();
  const { container } = renderPage();
  await screen.findByText("Income tax");
  const table = section(container, "obligations");
  const row = rowIn(container, "obligations", "Income tax");
  // The amount IS shown (a one-off is a real outflow)...
  expect(cellUnder(row, table, "Amount").textContent).toBe("18,400.00");
  // ...but it has NO monthly rate. Excluded from the burn is not the same as free.
  // (Asserting on the ROW's text would be wrong: "18,400.00" *contains* "0.00".)
  expect(cellUnder(row, table, "Monthly equivalent").textContent).toBe("—");
  // ...while a recurring row DOES carry one.
  const rent = rowIn(container, "obligations", "Rent");
  expect(cellUnder(rent, table, "Monthly equivalent").textContent).toBe("4,200.00");
});

test("Guarantee 3 — a goal with NO basis shows no progress: an em dash, never 0%", async () => {
  mockFetch();
  const { container } = renderPage();
  await screen.findByText("Sabbatical fund");
  const table = section(container, "goals");
  const row = rowIn(container, "goals", "Sabbatical");
  expect(cellUnder(row, table, "Progress").textContent).toBe("—");
  expect(cellUnder(row, table, "Progress").textContent).not.toContain("0%");
  // ...while a real goal DOES show its served progress.
  const real = rowIn(container, "goals", "House deposit");
  expect(cellUnder(real, table, "Progress").textContent).toBe("62.4%");
  // §9-11 — the served number as a FACT, not a "soon" flag (Review owns that threshold).
  expect(cellUnder(real, table, "Target date").textContent).toBe("in 540 days");
});

test("§9-7c — a contribution pointing at a DELETED goal renders '—', never a fabricated name", async () => {
  mockFetch();
  const { container } = renderPage();
  await screen.findByText("Orphaned plan");
  const table = section(container, "contributions");
  expect(cellUnder(rowIn(container, "contributions", "Orphaned"), table, "Towards").textContent).toBe("—");
  // The live one still resolves its goal's name.
  expect(cellUnder(rowIn(container, "contributions", "VWRA"), table, "Towards").textContent).toBe("House deposit");
});

test("D-057 — the protected copy is on the page: contributions do not reduce the runway", async () => {
  mockFetch();
  renderPage();
  expect(await screen.findByText(/do not reduce the cash runway/i)).toBeTruthy();
});

test("§9-2 — PER-ROW CRUD: adding an obligation POSTs exactly that record (request-body assertion)", async () => {
  const sent = mockFetch();
  const user = userEvent.setup();
  renderPage();

  await user.click((await screen.findAllByRole("button", { name: /add obligation/i }))[0]);
  const dialog = await screen.findByRole("dialog");
  await user.type(within(dialog).getByLabelText("Name"), "School fees");
  await user.type(within(dialog).getByLabelText("Amount"), "3500");
  await user.click(within(dialog).getByRole("button", { name: "Save" }));

  await waitFor(() => expect(sent.length).toBeGreaterThan(0));
  const req = sent[0];
  expect(req.method).toBe("POST");                       // per-row create — NOT a bulk replace
  expect(req.path).toContain("/obligations");
  expect(req.path).not.toMatch(/\/obligations\/\d/);     // ...and not an id path
  const body = req.body as { name: string; amount: number; recurrence: string; kind: string };
  expect(body.name).toBe("School fees");
  expect(body.amount).toBe(3500);
  expect(body.recurrence).toBe("monthly");
  expect(body.kind).toBe("expense");
});

test("§9-2 — editing a row PATCHes THAT row by id (no bulk replace of the others)", async () => {
  const sent = mockFetch();
  const user = userEvent.setup();
  const { container } = renderPage();
  await screen.findByText("Rent");

  const row = rowIn(container, "obligations", "Rent");
  await user.click(within(row).getByRole("button", { name: /actions for rent/i }));
  await user.click(await screen.findByRole("menuitem", { name: "Edit" }));
  const dialog = await screen.findByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name: "Save" }));

  await waitFor(() => expect(sent.length).toBeGreaterThan(0));
  expect(sent[0].method).toBe("PATCH");
  expect(sent[0].path).toContain("/obligations/1");
  expect(sent).toHaveLength(1);   // ONE row touched — the others are not resent, let alone replaced
});

test("§9-7c — deleting a goal WARNS with the live count of contributions pointing at it", async () => {
  mockFetch();
  const user = userEvent.setup();
  const { container } = renderPage();
  // "House deposit" appears in BOTH tables (the goal, and the contribution pointing at it).
  await screen.findAllByText("House deposit");

  const row = rowIn(container, "goals", "House deposit");   // the GOALS table, not the contributions one
  await user.click(within(row).getByRole("button", { name: /actions for house deposit/i }));
  await user.click(await screen.findByRole("menuitem", { name: "Delete" }));

  // ONE contribution points at goal 100 — the warning states the LIVE count, and says what survives.
  const dialog = await screen.findByRole("dialog");
  expect(dialog).toHaveTextContent(/1 contribution points at this goal/i);
  expect(dialog).toHaveTextContent(/keeps its record but loses the link/i);
  expect(dialog).toHaveTextContent(/cannot be undone/i);
});

test("§9-8 — each empty list states a REASON and offers the way forward", async () => {
  mockFetch({ obs: { ...OBS, obligations: [], next_12m_total: 0, next_12m_total_display: "0.00" },
              cons: { ...CONS, contributions: [] },
              goals: { ...GOALS, goals: [] } });
  renderPage();
  expect(await screen.findByText("No obligations recorded.")).toBeTruthy();
  expect(screen.getByText("No contributions recorded.")).toBeTruthy();
  expect(screen.getByText("No goals recorded.")).toBeTruthy();
  expect(screen.getByText(/never reduce your cash runway/i)).toBeTruthy();
});

test("a served validation error is shown IN PLACE and the dialog stays open", async () => {
  const user = userEvent.setup();
  mockFetch({ postStatus: 400, postBody: { detail: "'ZZZ' is not a currency you can use — choose one of: SGD, USD." } });
  renderPage();
  await user.click((await screen.findAllByRole("button", { name: /add goal/i }))[0]);
  const dialog = await screen.findByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name: "Save" }));
  expect(await within(dialog).findByRole("alert")).toHaveTextContent(/not a currency you can use/);
  expect(screen.getByRole("dialog")).toBeTruthy();
});

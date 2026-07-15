import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../theme/ThemeProvider";
import { DisplayProvider } from "../theme/DisplayProvider";
import { ToastProvider } from "../components/ui";
import { Insurance } from "./Insurance";
import type { InsuranceResp } from "../api/insurance";

const DISCLAIMER =
  "Records and reminders only — not an assessment of whether your cover is adequate, and not advice. " +
  "Base-currency totals use current FX. Lapsed and expired policies are shown but excluded from the " +
  "totals and the active count. Insurance cash value is excluded from Net worth — see Net worth.";

const policy = (over: Partial<InsuranceResp["policies"][number]>): InsuranceResp["policies"][number] => ({
  id: 1, name: "Term Life", insurer: "Prudential", policy_type: "term_life", policy_type_label: "Term life",
  policy_number: null, insured_person: null,
  cover_amount: 500000, cover_amount_display: "500,000.00", currency: "SGD",
  cash_value: null, cash_value_display: null, premium: 1200, premium_display: "1,200.00",
  annual_premium: 1200, annual_premium_display: "1,200.00",
  premium_frequency: "annual", start_date: null, renewal_date: "2026-08-30", nominee: null,
  linked_goal_id: null, documents: [], notes: null, status: "active", ...over,
});

const DATA: InsuranceResp = {
  base_currency: "SGD",
  policies: [
    // A MONTHLY-100 policy: the "Premium / yr" column shows the annual equivalent 1,200.00 (§14in-2).
    policy({ id: 1, name: "Term Life", cover_amount_display: "500,000.00", renewal_date: "2026-08-15",
      premium: 100, premium_display: "100.00", premium_frequency: "monthly",
      annual_premium: 1200, annual_premium_display: "1,200.00" }),
    policy({ id: 2, name: "Global Whole Life", policy_type: "whole_life", policy_type_label: "Whole life",
      currency: "USD", cover_amount_display: "USD 500,000.00", cash_value_display: "USD 12,000.00",
      premium_display: "USD 800.00", annual_premium: 800, annual_premium_display: "USD 800.00",
      renewal_date: "2026-07-28" }),
    policy({ id: 3, name: "Motor (private car)", policy_type: "motor", policy_type_label: "Motor",
      premium: null, premium_display: null, annual_premium: null, annual_premium_display: null,
      renewal_date: "2026-07-08" }),
    policy({ id: 9, name: "Endowment (matured)", policy_type: "whole_life", policy_type_label: "Whole life",
      status: "lapsed", premium: null, premium_display: null, annual_premium: null,
      annual_premium_display: null, renewal_date: null }),
  ],
  count: 3, // ACTIVE only (the lapsed Endowment is excluded)
  total_cover: 2580000, total_cover_display: "2,580,000.00",
  total_cash_value: 42000, total_cash_value_display: "42,000.00",
  total_annual_premium: 10400, total_annual_premium_display: "10,400.00",
  cover_by_type: [
    { type: "whole_life", label: "Whole life", value: 500000, value_display: "500,000.00" },
    { type: "term_life", label: "Term life", value: 500000, value_display: "500,000.00" },
  ],
  upcoming_renewals: [
    { id: 3, name: "Motor (private car)", renewal_date: "2026-07-08", days: -8, state: "overdue" },
    { id: 2, name: "Global Whole Life", renewal_date: "2026-07-28", days: 12, state: "soon" },
    { id: 1, name: "Term Life", renewal_date: "2026-08-15", days: 45, state: "upcoming" },
  ],
  document_defaults: ["Policy schedule", "Premium receipts", "Nominee form", "Terms & conditions"],
  disclaimer: DISCLAIMER,
};

vi.mock("../api/insurance", () => ({
  fetchInsurance: vi.fn(),
  createPolicy: vi.fn(async () => ({ ok: true, id: 99 })),
  updatePolicy: vi.fn(async () => ({ ok: true, id: 1 })),
  deletePolicy: vi.fn(async () => ({ ok: true })),
}));
import { fetchInsurance } from "../api/insurance";
const mockedFetch = vi.mocked(fetchInsurance);

function renderPage() {
  return render(
    <MemoryRouter>
      <ThemeProvider><DisplayProvider><ToastProvider>
        <Insurance />
      </ToastProvider></DisplayProvider></ThemeProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => { mockedFetch.mockResolvedValue({ ok: true as const, data: DATA }); });
afterEach(() => cleanup());

test("totals strip renders the SERVED display strings and the active count", async () => {
  renderPage();
  await screen.findByText("2,580,000.00");           // total cover (served)
  expect(screen.getByText("42,000.00")).toBeTruthy(); // cash value (excluded)
  expect(screen.getByText("10,400.00")).toBeTruthy(); // annual premium
  // active count = 3 (the lapsed policy is not counted)
  expect(screen.getByText("Active policies").closest(".lf-stat")?.textContent).toContain("3");
});

test("a lapsed policy is VISIBLE in the table but excluded from the active count (§9-10)", async () => {
  const { container } = renderPage();
  await screen.findByText("2,580,000.00");
  const table = container.querySelector('[data-card="policies"]') as HTMLElement;
  const row = [...table.querySelectorAll("tbody tr")].find((r) => r.textContent?.includes("Endowment"))!;
  expect(row).toBeTruthy();                                  // shown
  expect(within(row as HTMLElement).getByText("Lapsed")).toBeTruthy(); // status chip, mandatory label
  // 4 policies visible, but the active count tile reads 3
  expect(table.querySelectorAll("tbody tr").length).toBe(4);
});

test("renewal chips render the SERVED state with a MANDATORY label (§12in-3)", async () => {
  renderPage();
  await screen.findByText("2,580,000.00");
  // overdue + soon appear as labelled chips (meaning never colour-alone)
  expect(screen.getAllByText("Overdue").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Renews soon").length).toBeGreaterThan(0);
});

test("a non-base-currency policy shows the currency code (§12in-1)", async () => {
  renderPage();
  await screen.findByText("2,580,000.00");
  expect(screen.getByText("USD 500,000.00")).toBeTruthy();
});

test("a missing premium renders a bare em dash, never a 0 (§12in-4)", async () => {
  const { container } = renderPage();
  await screen.findByText("2,580,000.00");
  const table = container.querySelector('[data-card="policies"]') as HTMLElement;
  const motor = [...table.querySelectorAll("tbody tr")].find((r) => r.textContent?.includes("Motor"))!;
  // the PREMIUM cell (column index 3) is a bare em dash (U+2014), never "0.00"
  const premiumCell = motor.querySelectorAll("td")[3];
  expect(premiumCell.textContent).toBe("—");
});

test("the 'Premium / yr' column renders the ANNUAL EQUIVALENT, not the per-frequency premium (§14in-2)", async () => {
  const { container } = renderPage();
  await screen.findByText("2,580,000.00");
  const table = container.querySelector('[data-card="policies"]') as HTMLElement;
  const term = [...table.querySelectorAll("tbody tr")].find((r) => r.textContent?.includes("Term Life"))!;
  // Term Life is monthly-100; the Premium/yr cell (column index 3) shows 1,200.00 (×12), NOT 100.00.
  const premiumCell = term.querySelectorAll("td")[3];
  expect(premiumCell.textContent).toBe("1,200.00");
  expect(premiumCell.textContent).not.toBe("100.00");
});

test("the served disclaimer carries both exclusion sentences; 'see Net worth' is a link (§12in-2)", async () => {
  renderPage();
  await screen.findByText(/excluded from the totals and the active count/);
  expect(screen.getByText(/Insurance cash value is excluded from Net worth/)).toBeTruthy();
  const link = screen.getByRole("link", { name: "see Net worth" });
  expect(link.getAttribute("href")).toContain("/net-worth");
});

test("empty register shows a reason and an Add CTA (§9-1)", async () => {
  mockedFetch.mockResolvedValueOnce({ ok: true as const, data: { ...DATA, policies: [], count: 0 } });
  renderPage();
  expect(await screen.findByText("No policies yet")).toBeTruthy();
  expect(screen.getAllByRole("button", { name: /add policy/i }).length).toBeGreaterThan(0);
});

// STANDING GUARD (§9-2, the D-058 precedent) — the page must never speak adequacy/advice. The only
// legitimate uses of "adequate"/"adequacy" are the protected NEGATIONS (the subtitle bar + the served
// disclaimer): strip BOTH, then no adequacy/advice word may appear anywhere on the rendered page.
test("STANDING: no adequacy/advice language outside the protected copy (§9-2)", async () => {
  const { container } = renderPage();
  await screen.findByText("2,580,000.00");
  const subtitle = "a register, never an adequacy judgment";
  const text = (container.textContent ?? "").toLowerCase()
    .replace(DISCLAIMER.toLowerCase(), "")
    .replace(subtitle, "");
  for (const banned of ["adequate", "adequacy", "under-insured", "coverage gap", "sufficient",
    "recommend", "should buy", "should increase"]) {
    expect(text, `no adequacy/advice word "${banned}" outside the protected copy`).not.toContain(banned);
  }
  // ...and the protected bar + disclaimer ARE present.
  expect(screen.getByText(/a register, never an adequacy judgment/i)).toBeTruthy();
  expect(screen.getByText(/not an assessment of whether your cover is adequate/i)).toBeTruthy();
});

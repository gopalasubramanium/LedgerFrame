import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../theme/ThemeProvider";
import { DisplayProvider } from "../theme/DisplayProvider";
import { ToastProvider } from "../components/ui";

const PAGE = {
  ok: true,
  data: {
    base_currency: "SGD",
    net_worth: 795860,
    sections: {
      trust: { confidence: 82, low: 1, stale: 2 },
      policy: { out_of_band: 1, has_targets: true },
      liquidity: { liquid_pct: 20, runway_status: "finite", runway_months: 5 },
      goals: { goals: 1, next_obligation: null, next_12m_total: 0 },
      changed: { day_change: 170, top_mover: "VOO" },
    },
    // §12rv1-5 — the reader serves DISPLAY-CASED area/severity labels (verbatim on the page).
    attention: [
      { area: "Data", title: "1 holding has incomplete details", severity: "Info" },
      { area: "Data", title: "2 holdings have stale prices — refresh", severity: "Review" },
      { area: "Policy", title: "Equity is under its asset class band", severity: "Review" },
      { area: "Zzz-unknown", title: "An unmapped area item", severity: "Info" },
    ],
    attention_count: 2,
    last_review: { reviewed_at: "2026-07-10", days_ago: 3, next_review_date: "2026-08-01" },
    disclaimer: "reporting only",
  },
};
const HISTORY = {
  ok: true,
  data: { history: [{ id: 1, reviewed_at: "2026-07-10", days_ago: 3, net_worth: 790000, base_currency: "SGD", confidence: 80, drift_flags: 1, attention_count: 2, note: "Rebalanced", next_review_date: "2026-08-01" }] },
};

const getReviewPage = vi.fn(async () => PAGE);
const getReviewHistory = vi.fn(async () => HISTORY);
const markReviewed = vi.fn(async () => ({ ok: true, data: { ok: true, id: 2 } }));
vi.mock("../api/review", () => ({
  getReviewPage: () => getReviewPage(),
  getReviewHistory: () => getReviewHistory(),
  markReviewed: (...a: unknown[]) => markReviewed(...(a as [])),
}));

import { Review } from "./Review";

function renderPage() {
  return render(
    <ThemeProvider>
      <DisplayProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={["/review"]}>
            <Review />
          </MemoryRouter>
        </ToastProvider>
      </DisplayProvider>
    </ThemeProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test("attention items render a SEMANTIC severity chip (served verbatim + tone class) sorted review-first (§12rv1-4/ND-4 reversal)", async () => {
  renderPage();
  const table = (await screen.findByText(/2 holdings have stale prices/)).closest("table") as HTMLElement;
  // Severity is the served display-cased string, verbatim (§12rv1-5) — no raw enum key.
  expect(within(table).getAllByText("Review").length).toBeGreaterThan(0);
  expect(within(table).getAllByText("Info").length).toBeGreaterThan(0);
  // §12rv1-4 — the chip carries a semantic tone class: Review → attention, Info → neutral.
  const reviewChip = within(table).getAllByText("Review")[0].closest(".rv__chip") as HTMLElement;
  expect(reviewChip.className).toContain("rv__chip--attention");
  const infoChip = within(table).getAllByText("Info")[0].closest(".rv__chip") as HTMLElement;
  expect(infoChip.className).toContain("rv__chip--neutral");
  // review-first ordering: the first body row is a 'Review' item, not the served-first 'Info' one.
  const firstRow = table.querySelector("tbody tr") as HTMLElement;
  expect(within(firstRow).getByText("Review")).toBeTruthy();
});

test("each area links to its canonical page; an unrecognised area is NOT linked (ND-7, casing-normalised §12rv1-5)", async () => {
  renderPage();
  await screen.findByText(/2 holdings have stale prices/);
  // Known areas (display-cased) map to their canonical route (lookup normalises casing).
  expect(screen.getByRole("link", { name: "Policy" }).getAttribute("href")).toContain("/policy");
  expect(screen.getAllByRole("link", { name: "Data" })[0].getAttribute("href")).toContain("/pricing-health");
  // Unrecognised area renders WITHOUT a link — never a guessed route.
  expect(screen.queryByRole("link", { name: "Zzz-unknown" })).toBeNull();
  expect(screen.getByText("Zzz-unknown")).toBeTruthy();
});

test("empty signal renders the served honest empty, never a fabricated row (Guarantee 3)", async () => {
  getReviewPage.mockResolvedValueOnce({ ok: true, data: { ...PAGE.data, attention: [{ area: "Ok", title: "Nothing needs a look right now.", severity: "Info" }], attention_count: 0 } });
  renderPage();
  expect(await screen.findByText("Nothing needs a look right now.")).toBeTruthy();
});

test("Mark reviewed: the request body is the entered note + next-review date (ND-8, §7 request-body)", async () => {
  const user = userEvent.setup();
  renderPage();
  await user.click(await screen.findByRole("button", { name: "Mark reviewed" }));
  const dialog = await screen.findByRole("dialog");
  await user.type(within(dialog).getByLabelText("Review note"), "Rebalanced equity");
  fireEvent.change(within(dialog).getByLabelText("Next review date"), { target: { value: "2026-08-01" } });
  await user.click(within(dialog).getByRole("button", { name: "Save" }));
  await waitFor(() => expect(markReviewed).toHaveBeenCalledWith("Rebalanced equity", "2026-08-01"));
});

test("review history renders with the honest last-24 legend", async () => {
  renderPage();
  expect(await screen.findByText("Rebalanced")).toBeTruthy();
  expect(screen.getByText(/last 24 recorded reviews/)).toBeTruthy();
});

test("the retired 'Needs a look' label is gone — the tile + history column read 'Attention' (§12rv1-7/D-030)", async () => {
  renderPage();
  await screen.findByText(/2 holdings have stale prices/);
  // The retired label appears nowhere (subtitle/section body-copy "what needs a look" is sanctioned, D-030).
  expect(screen.queryByText("Needs a look")).toBeNull();
  // The summary tile label and the history column header both read "Attention".
  expect(screen.getAllByText("Attention").length).toBeGreaterThanOrEqual(2);
});

test("Mark reviewed keeps its text label AND carries an icon (§12rv1-1, WCAG-AA)", async () => {
  renderPage();
  const btn = await screen.findByRole("button", { name: "Mark reviewed" });
  expect(btn.textContent).toContain("Mark reviewed"); // text label KEPT (icon-only declined)
  expect(btn.querySelector("svg")).toBeTruthy(); // + a lucide icon
});

test("the 'Last reviewed' tile uses the shared relative-time copy (§12rv1-3)", async () => {
  renderPage();
  // days_ago: 3 → "3 days ago" (the shared relativeDays formatter), never "3d ago".
  expect(await screen.findByText("3 days ago")).toBeTruthy();
  expect(screen.queryByText("3d ago")).toBeNull();
});

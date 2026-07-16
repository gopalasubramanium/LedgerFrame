import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

// ⚠ DEV-ONLY smoke. page-reports §13 (Phase 2) — the ARTIFACT-LEVEL JOURNEY guards that mechanise the
// §12rp-4 subtitle promise ("Every export carries the same disclaimers you see here"). For EACH Export
// control we click the REAL button, capture the DOWNLOAD, and assert INSIDE the artifact bytes — not
// the DOM. A DOM-only guard would pass while the CSV shed its disclaimer (the very Phase-0 hole); these
// read the file. The fail-first test points a guard at a stubbed endpoint stripped of the disclaimer →
// the assertion is proven to read the file (absent when stripped, present when real).
//   npx playwright test --config e2e/smoke/playwright.smoke.config.ts reports-artifact-smoke

const API = "http://127.0.0.1:8321/api/v1";

// The served disclaimers (D-105) — the exact substrings the on-screen page shows AND the file must carry.
const STATEMENTS_DISCLAIMER = "not tax or financial advice";
const REALISED_DISCLAIMER = "NOT tax advice";
const TAX_LOTS_DISCLAIMER = "Open lots by FIFO. Organisation only — not tax advice.";

async function gotoReports(page: import("@playwright/test").Page) {
  await page.request.put(`${API}/settings`, { data: { values: { first_run_complete: "1" } } });
  await page.goto("/#/reports");
  await expect(page.getByRole("heading", { name: "Reports", exact: true, level: 1 })).toBeVisible({ timeout: 15_000 });
}

async function downloadText(page: import("@playwright/test").Page, buttonName: string): Promise<{ text: string; filename: string }> {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: buttonName }).click(),
  ]);
  const path = await download.path();
  return { text: readFileSync(path, "utf-8"), filename: download.suggestedFilename() };
}

test.describe.serial("reports exports carry their disclaimers INTO the artifact (live)", () => {
  test("statements.csv — disclaimer travels; the scoped YEAR reaches the artifact (§12rp-1)", async ({ page }) => {
    await gotoReports(page);
    // Read the year the scoped control is bound to, so the assertion tracks the real selection.
    const year = await page.getByLabel("Realised figure and export year").inputValue();
    const { text, filename } = await downloadText(page, "Export statements.csv");
    expect(text, "the served D-077 disclaimer is INSIDE the file").toContain(STATEMENTS_DISCLAIMER);
    // §12rp-1: the Year control governs this export — the selected year reaches the artifact.
    expect(text, "the selected year rode the file content").toContain(year);
    expect(filename, "the selected year rode the filename").toContain(year);
    // §14rp-1: an export mirrors its section — the card's Realised (year-scoped) + Unrealised
    // (open positions, as-of) figures travel INTO the artifact; the now-snapshot is explicitly as-of.
    expect(text, "the Realised stat is a YEAR-scoped row in the file").toContain(`Realised P/L (selected year, ${year})`);
    expect(text, "the Unrealised stat is an explicit AS-OF row (never a year figure)").toMatch(/Unrealised P\/L \(open positions, as of \d{4}-\d{2}-\d{2}\)/);
    console.log(`statements.csv — year=${year} filename=${filename} disclaimer+realised+unrealised=present`);
  });

  test("realised-gains.csv — disclaimer + historical-FX total + excluded-count rows travel", async ({ page }) => {
    await gotoReports(page);
    const { text } = await downloadText(page, "Export realised-gains.csv");
    expect(text, "the served disclaimer is INSIDE the file").toContain(REALISED_DISCLAIMER);
    // The honesty payload the CSV once shed (D-020/D-076): both rows are present in the artifact.
    expect(text, "the trade-date-FX total row travels").toMatch(/trade-date FX/i);
    expect(text, "the excluded-events count row travels").toMatch(/excluded/i);
    console.log("realised-gains.csv — disclaimer + trade-date-FX total + excluded-count present");
  });

  test("tax-lots.csv — the born-with-it disclaimer travels", async ({ page }) => {
    await gotoReports(page);
    const { text } = await downloadText(page, "Export tax-lots.csv");
    expect(text, "the served tax-lots disclaimer is INSIDE the file").toContain(TAX_LOTS_DISCLAIMER);
    console.log("tax-lots.csv — disclaimer present");
  });

  test("FAIL-FIRST: the guard reads the FILE, not the DOM — a stubbed endpoint stripped of the disclaimer is caught", async ({ page }) => {
    await gotoReports(page);
    // Stub statements.csv with a body that has NO disclaimer (the shed-disclaimer regression).
    await page.route("**/portfolio/statements.csv*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/csv",
        headers: { "content-disposition": 'attachment; filename="stripped-statements.csv"' },
        body: "Year,Total\n2024,700\n",
      }),
    );
    const { text } = await downloadText(page, "Export statements.csv");
    // If the guard read the DOM (where the disclaimer IS shown) it would pass; reading the FILE, the
    // stripped artifact has no disclaimer — proving the real-file guard above has teeth.
    expect(text, "stripped artifact must NOT contain the disclaimer (proves the guard reads the file)").not.toContain(STATEMENTS_DISCLAIMER);
    await page.unroute("**/portfolio/statements.csv*");
    console.log("fail-first — stripped statements.csv correctly lacks the disclaimer (guard reads the file, not the DOM)");
  });
});

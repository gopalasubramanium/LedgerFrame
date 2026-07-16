import { test, expect } from "@playwright/test";

// ⚠ DEV-ONLY smoke. §14ac-2 JOURNEY guards — click the REAL controls on a seeded account and assert the
// scoped ARRIVAL (chip + both tables scoped), not just the destination. RED on the pre-fix build (the
// manual window.location.hash write fires an UNFILTERED holdings fetch that races the scoped one);
// GREEN after (react-router navigation via the shared builder → Holdings mounts scoped, only scoped
// fetches). This is the guard Phase-2 lacked: a destination-only test was green while the link was broken.
//   npx playwright test --config e2e/smoke/playwright.smoke.config.ts accounts-journey-smoke

const API = "http://127.0.0.1:8321/api/v1";

async function seededAccount(page: import("@playwright/test").Page) {
  // pick an account that has BOTH holdings and transactions, so both tables can be proven scoped.
  const accts = (await (await page.request.get(`${API}/accounts/list`)).json()).accounts as { id: number; name: string }[];
  const sg = accts.find((a) => a.name === "Demo SG CDP")!; // holds the SGD demo transactions + holdings
  const allH = (await (await page.request.get(`${API}/portfolio/holdings`)).json()).holdings.length;
  const scopedH = (await (await page.request.get(`${API}/portfolio/holdings?account_id=${sg.id}`)).json()).holdings.length;
  const allT = (await (await page.request.get(`${API}/portfolio/transactions?limit=500`)).json()).total;
  const scopedT = (await (await page.request.get(`${API}/portfolio/transactions?account_id=${sg.id}&limit=500`)).json()).total;
  return { sg, allH, scopedH, allT, scopedT };
}

function trackReqs(page: import("@playwright/test").Page) {
  const holdings: string[] = [];
  const txns: string[] = [];
  page.on("request", (r) => {
    const u = r.url();
    if (u.includes("/portfolio/holdings") && !u.includes(".csv")) holdings.push(u.includes("account_id") ? "SCOPED" : "ALL");
    if (u.includes("/portfolio/transactions") && !u.includes(".csv")) txns.push(u.includes("account_id") ? "SCOPED" : "ALL");
  });
  return { holdings, txns };
}

async function assertScopedArrival(page: import("@playwright/test").Page, reqs: { holdings: string[]; txns: string[] }, d: Awaited<ReturnType<typeof seededAccount>>) {
  // 1) chip visible, naming the account.
  const chip = page.getByRole("button", { name: /Clear account filter/ });
  await expect(chip).toBeVisible({ timeout: 10_000 });
  await expect(chip).toContainText("Demo SG CDP");
  await page.waitForLoadState("networkidle");
  // 2) THE TEETH: not a single UNFILTERED holdings fetch fired during the journey (RED pre-fix).
  expect(reqs.holdings.length, "at least one holdings fetch fired").toBeGreaterThan(0);
  expect(reqs.holdings, "every holdings fetch is scoped — no unfiltered race").not.toContain("ALL");
  // 3) the holdings TABLE is scoped (fewer rows than the whole portfolio; the scoped count).
  const sec = page.locator(".hold__section", { hasText: "Holdings" }).first();
  await expect.poll(async () => sec.locator("table tbody tr").count(), { timeout: 10_000 }).toBe(d.scopedH);
  expect(d.scopedH).toBeLessThan(d.allH); // proves it is actually a subset
  // 4) §14ac-3: the transactions table is scoped too — a scoped ledger request fired.
  expect(reqs.txns, "the ledger fetched scoped").toContain("SCOPED");
}

test.describe.serial("accounts → holdings journey (live)", () => {
  test("RowMenu 'View holdings' arrives SCOPED (both tables); clear unscopes both", async ({ page }) => {
    await page.request.put(`${API}/settings`, { data: { values: { first_run_complete: "1" } } });
    const d = await seededAccount(page);
    await page.goto("/#/accounts");
    await expect(page.getByRole("heading", { name: "Accounts", exact: true, level: 1 })).toBeVisible({ timeout: 15_000 });
    const reqs = trackReqs(page);
    await page.locator('[data-card="accounts"] tbody tr', { hasText: "Demo SG CDP" }).first().getByRole("button", { name: /Actions for/ }).click();
    await page.getByRole("menuitem", { name: "View holdings" }).click();
    await assertScopedArrival(page, reqs, d);
    console.log(`RowMenu journey — holdings reqs=[${reqs.holdings.join(",")}] txns=[${reqs.txns.join(",")}] scopedH=${d.scopedH}/${d.allH} scopedT=${d.scopedT}/${d.allT}`);
    // clear → both tables unscope.
    reqs.holdings.length = 0; reqs.txns.length = 0;
    await page.getByRole("button", { name: /Clear account filter/ }).click();
    await expect(page.getByRole("button", { name: /Clear account filter/ })).toHaveCount(0);
    await page.waitForLoadState("networkidle");
    expect(reqs.holdings, "clear refetched holdings unscoped").toContain("ALL");
    expect(reqs.txns, "clear refetched the ledger unscoped").toContain("ALL");
    console.log("clear — both tables unscoped");
  });

  test("the account NAME link arrives at the SAME scoped destination", async ({ page }) => {
    const d = await seededAccount(page);
    await page.goto("/#/accounts");
    await expect(page.getByRole("heading", { name: "Accounts", exact: true, level: 1 })).toBeVisible({ timeout: 15_000 });
    const reqs = trackReqs(page);
    // click the Name cell LINK (the shared-builder second entry point).
    await page.locator('[data-card="accounts"] tbody tr', { hasText: "Demo SG CDP" }).first().getByRole("link", { name: "Demo SG CDP" }).click();
    await assertScopedArrival(page, reqs, d);
    console.log(`Name-link journey — holdings reqs=[${reqs.holdings.join(",")}] txns=[${reqs.txns.join(",")}]`);
  });
});

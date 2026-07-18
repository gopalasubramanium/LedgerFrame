import { test, expect } from "@playwright/test";

// ⚠ DEV-ONLY pre-pass (page-reports §13, Phase 3a). Drives /reports on the LIVE app + real backend on
// a reset, demo-seeded instance — both themes × the four breakpoints: containment (no horizontal
// overflow, one scroll region), every card OUT of skeleton, 0 console errors; the year-filter round-trip
// (populated ↔ empty year keeps the filter + export + disclaimer alive); the symbol link lands on
// Instrument Detail. NEVER wired into npm run check.
//   npx playwright test --config e2e/smoke/playwright.smoke.config.ts reports-smoke

// Isolated-instance override (§14dr-28 / rule #6): point the harness at a spare-port
// isolated demo backend via SMOKE_API — never mutate the owner's live 8321 instance.
const API = (process.env.SMOKE_API ?? "http://127.0.0.1:8321") + "/api/v1";
const WIDTHS = [320, 375, 900, 1366];
const THEMES = ["light", "dark"] as const;

async function ready(page: import("@playwright/test").Page) {
  await page.request.put(`${API}/settings`, { data: { values: { first_run_complete: "1" } } });
  await page.goto("/#/reports");
  await expect(page.getByRole("heading", { name: "Reports", exact: true, level: 1 })).toBeVisible({ timeout: 15_000 });
  // Every card resolves OUT of skeleton (progressive per-card loading — no .lf-skeleton left).
  await expect.poll(async () => page.locator(".lf-skeleton").count(), { timeout: 15_000 }).toBe(0);
}

test.describe.serial("reports pre-pass (live)", () => {
  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      test(`containment + 0 console errors · ${theme} · ${width}px`, async ({ page }) => {
        const errors: string[] = [];
        page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
        page.on("pageerror", (e) => errors.push(String(e)));
        await page.emulateMedia({ colorScheme: theme });
        await page.setViewportSize({ width, height: 900 });
        await ready(page);
        const overflow = await page.evaluate(() => {
          const doc = document.documentElement;
          const content = document.querySelector(".lf-shell__content");
          return { doc: doc.scrollWidth - doc.clientWidth, content: content ? content.scrollWidth - content.clientWidth : 0 };
        });
        expect(overflow.doc, "document h-overflow").toBeLessThanOrEqual(1);
        expect(overflow.content, "content h-overflow").toBeLessThanOrEqual(1);
        // Only the shell content scrolls vertically — the window itself must not.
        const winScrolled = await page.evaluate(() => { window.scrollTo(0, 5000); const y = window.scrollY; window.scrollTo(0, 0); return y; });
        expect(winScrolled, "the document must not scroll").toBeLessThanOrEqual(1);
        expect(errors, `console errors: ${errors.join(" | ")}`).toEqual([]);
        if (width === 1366) await page.screenshot({ path: `e2e/smoke/artifacts/reports-${theme}-1366.png`, fullPage: true });
      });
    }
  }

  test("year-filter round-trip: populated → empty keeps filter + export + disclaimer alive → back", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await ready(page);
    const card = page.locator('[data-card="realised"]');
    const yearSel = card.getByLabel("Realised P/L year");
    // A populated year renders the events table (the demo's realised sales are in 2024).
    const populated = await page.request.get(`${API}/portfolio/realised-gains`).then((r) => r.json());
    const popYear = String(populated.year);
    await yearSel.selectOption(popYear);
    await expect(card.locator("table tbody tr").first()).toBeVisible({ timeout: 10_000 });
    // An EMPTY year (transactions but no sales) → the EmptyState, with the export + disclaimer still alive.
    const stmt = await page.request.get(`${API}/portfolio/statements`).then((r) => r.json());
    const emptyYear = (stmt.years as number[]).map(String).find((y) => y !== popYear);
    expect(emptyYear, "the demo has a second ledger year to exercise the empty case").toBeTruthy();
    await yearSel.selectOption(emptyYear!);
    await expect(card.getByText(`No realised sales in ${emptyYear}`)).toBeVisible({ timeout: 10_000 });
    await expect(card.getByRole("button", { name: "Export realised-gains.csv" })).toBeVisible(); // export stays
    await expect(card.getByText(/NOT tax advice/)).toBeVisible(); // the disclaimer stays
    // Round-trip back → the table returns (filter is reversible, no state lost).
    await yearSel.selectOption(popYear);
    await expect(card.locator("table tbody tr").first()).toBeVisible({ timeout: 10_000 });
    console.log(`year round-trip — populated=${popYear} empty=${emptyYear} (EmptyState + export + disclaimer alive)`);
  });

  test("§14dr-28: FIRST paint renders a populated report row (no reload) — 3 cold loads", async ({ browser }) => {
    // The owner's finding: Reports rendered empty until 3–4 hard refreshes. Verified: the load
    // path is idempotent (loaders useCallback([], one mount effect, services compute fresh, no
    // cache-skip; the sole warm-fetch is skipped for rate-limited providers). This guard fails
    // if a regression ever makes the report fill only after a refresh: it does a COLD load
    // (fresh context, no reload) three times and asserts a concrete destination CONTROL — a real
    // row in the always-populated open-tax-lots table (§14ac-2) — on the FIRST paint each time.
    for (let i = 0; i < 3; i++) {
      const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
      const page = await ctx.newPage();
      const errors: string[] = [];
      page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.request.put(`${API}/settings`, { data: { values: { first_run_complete: "1" } } });
      await page.goto("/#/reports");   // single COLD navigation — NO page.reload()
      // Destination control: a concrete rendered row, not merely "0 skeletons" (which passes on
      // an EmptyState too). The demo always has open tax lots.
      await expect(page.locator('[data-card="taxlots"] table tbody tr').first())
        .toBeVisible({ timeout: 20_000 });
      expect(errors, `console errors on cold load ${i + 1}: ${errors.join(" | ")}`).toEqual([]);
      await ctx.close();
    }
    console.log("first-paint — 3/3 cold loads rendered a populated tax-lots row without a refresh");
  });

  test("a symbol in a report row LINKS to Instrument Detail (D-098)", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await ready(page);
    // Click the first symbol link in the open-tax-lots table (always populated in the demo).
    const link = page.locator('[data-card="taxlots"] table a.rpt__symbol').first();
    const symbol = (await link.textContent())?.trim();
    await link.click();
    await expect(page).toHaveURL(new RegExp(`#/instrument/${symbol}`), { timeout: 10_000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    console.log(`symbol link — ${symbol} → Instrument Detail`);
  });
});

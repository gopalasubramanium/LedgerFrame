import { test, expect } from "@playwright/test";

// ⚠ DEV-ONLY smoke (see playwright.smoke.config.ts). Phase-3a scripted pre-pass for the Net worth
// page — drives the LIVE app + real backend on the seeded demo data (incl. the ND-1 synthetic
// net-worth snapshots), checks the POPULATED page (data + controls + reconciliation + geometry +
// overflow), and captures console errors. NOT wired into `npm run check`/CI. Assumes both dev
// servers live + the demo seed present. Run (from frontend/):
//   npx playwright test --config e2e/smoke/playwright.smoke.config.ts net-worth-smoke

const WIDTHS = [320, 375, 900, 1366];
const consoleErrors: string[] = [];

function money(t: string | null): number {
  return Number((t ?? "").replace(/[^0-9.-]/g, ""));
}

test.describe.serial("net worth pre-pass (live)", () => {
  test("drive the populated /net-worth + assert data, reconciliation, geometry, overflow, 0 errors", async ({ page }) => {
    page.on("console", (m) => m.type() === "error" && consoleErrors.push(`[console] ${m.text()}`));
    page.on("pageerror", (e) => consoleErrors.push(`[pageerror] ${e.message}`));

    // PART 0: clear the first-run gate SERVER-SIDE so the page (not the overlay) is tested.
    await page.request.put("http://127.0.0.1:8321/api/v1/settings", { data: { values: { first_run_complete: "1" } } });

    // PART 1: KPI strip populated (the four D-054 figures) --------------------------------------
    await page.goto("/#/net-worth");
    await expect(page.getByRole("heading", { name: "Net worth", exact: true })).toBeVisible({ timeout: 15_000 });
    const kpis = page.locator('[data-card="kpis"]');
    for (const label of ["Net worth", "Gross assets", "Liabilities", "Cash & deposits"]) {
      await expect(kpis.getByText(label, { exact: true })).toBeVisible();
    }
    // §12b4-1 rule (TEMPLATE §7/§8): KPI tiles equal width AND height per rendered row, all breakpoints.
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.waitForTimeout(150);
      const rows = await page.evaluate(() => {
        const tiles = Array.from(document.querySelectorAll('[data-card="kpis"] .lf-stat'));
        const byRow = new Map<number, { w: number; h: number }[]>();
        for (const t of tiles) {
          const r = (t as HTMLElement).getBoundingClientRect();
          const arr = byRow.get(Math.round(r.top)) ?? [];
          arr.push({ w: Math.round(r.width), h: Math.round(r.height) });
          byRow.set(Math.round(r.top), arr);
        }
        return Array.from(byRow.values()).map((c) => ({
          wSpread: Math.max(...c.map((x) => x.w)) - Math.min(...c.map((x) => x.w)),
          hSpread: Math.max(...c.map((x) => x.h)) - Math.min(...c.map((x) => x.h)),
        }));
      });
      console.log(`PART 1 — KPI geometry @${w}px:`, JSON.stringify(rows));
      for (const row of rows) {
        expect(row.wSpread, `KPI tiles equal width per row @${w}px`).toBeLessThanOrEqual(1);
        expect(row.hSpread, `KPI tiles equal height per row @${w}px`).toBeLessThanOrEqual(1);
      }
    }
    await page.setViewportSize({ width: 1366, height: 900 });

    // PART 2: net-worth trend POPULATED (ND-1 demo snapshots) — a line, never a fabricated curve --
    const trendCard = page.locator('[data-card="trend"]');
    await expect(trendCard.locator(".lf-pricechart__line, .lf-empty").first()).toBeVisible({ timeout: 15_000 });
    await expect(trendCard.locator(".lf-pricechart__line").first(), "demo trend renders a populated line").toBeVisible();
    // A window switch keeps an honest chart (line or EmptyState), never a crash.
    await page.getByRole("combobox", { name: "Time window" }).selectOption("1Y");
    await page.waitForTimeout(400);
    await expect(trendCard.locator(".lf-pricechart__line, .lf-empty").first()).toBeVisible();

    // PART 3: composition statement RECONCILES on-page to the headline (ND-4) --------------------
    const nwKpi = money(await kpis.locator(".lf-stat").filter({ hasText: "Net worth" }).locator(".lf-stat__value").textContent());
    const stmtNet = money(await page.locator('[data-card="statement"] .lf-table__foot--emph .lf-table__td--num').first().textContent());
    console.log("PART 3 — KPI net worth:", nwKpi, "· statement net total:", stmtNet);
    expect(Math.abs(nwKpi - stmtNet), "statement net total reconciles to the KPI headline").toBeLessThanOrEqual(1);
    // The statement carries a NEGATIVE liability row (signed balance, not a gross weight).
    const stmtText = (await page.locator('[data-card="statement"]').textContent()) ?? "";
    expect(stmtText).toMatch(/-[\d,]+/);
    // §12b1-2: the total (tfoot) Value column is x-aligned with the body Value column, both themes
    // (tfoot shares the table's column grid + scroll gutter — no scrollbar offset).
    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await page.waitForTimeout(120);
      const dx = await page.evaluate(() => {
        const card = document.querySelector('[data-card="statement"]')!;
        const bodyCell = card.querySelector("tbody tr .lf-table__td--num") as HTMLElement | null;
        const footCell = card.querySelector("tfoot tr .lf-table__td--num") as HTMLElement | null;
        if (!bodyCell || !footCell) return -1;
        return Math.abs(bodyCell.getBoundingClientRect().right - footCell.getBoundingClientRect().right);
      });
      console.log(`PART 3 — footer↔body value x-offset (${theme}):`, dx);
      expect(dx, `statement total value x-aligned with body value column (${theme})`).toBeLessThanOrEqual(1);
    }
    await page.emulateMedia({ colorScheme: "light" });

    // PART 4: liquidity ladder + Liquid line -----------------------------------------------------
    await expect(page.getByText(/Liquid \(Immediate \+ Short\) =/)).toBeVisible();
    expect(await page.locator('[data-card="liquidity"] .lf-table tbody tr').count(), "ladder has rungs").toBeGreaterThan(0);

    // §12b1-3: the two summary cards (Portfolio + Review) are EQUAL height from the row grid when
    // side by side (content cannot shrink a card) — measured at a wide viewport (single row).
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.waitForTimeout(150);
    const summaryHeights = await page.evaluate(() => {
      const cells = Array.from(document.querySelectorAll(".nw__summaries > *"));
      return cells.map((c) => Math.round((c as HTMLElement).getBoundingClientRect().height));
    });
    console.log("PART 4b — summary card heights:", JSON.stringify(summaryHeights));
    expect(Math.max(...summaryHeights) - Math.min(...summaryHeights), "summary cards equal height per row").toBeLessThanOrEqual(1);

    // PART 5: runway card + honest basis label (ND-9) --------------------------------------------
    await expect(page.getByText(/Basis: liquid assets ÷ recurring monthly net burn/)).toBeVisible();

    // PART 6: insurance exclusion line — demo has 0 policies → line OMITTED (ND-5) ---------------
    expect(await page.locator(".nw__exclusion").count(), "no exclusion line when zero policies").toBe(0);

    // PART 7: progressive loading — every card resolved OUT of skeleton --------------------------
    await expect(page.locator(".lf-skeleton"), "no card stuck in skeleton").toHaveCount(0);

    // PART 8: NO horizontal overflow on the POPULATED page at every breakpoint × both themes ------
    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme });
      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: 900 });
        await page.waitForTimeout(120);
        const over = await page.evaluate(() => {
          const doc = document.documentElement;
          const content = document.querySelector(".lf-shell__content");
          return { doc: doc.scrollWidth - doc.clientWidth, content: content ? content.scrollWidth - content.clientWidth : 0 };
        });
        console.log(`PART 8 — overflow ${theme} ${w}px:`, JSON.stringify(over));
        expect(over.doc, `doc overflow ${theme} ${w}`).toBeLessThanOrEqual(1);
        expect(over.content, `content overflow ${theme} ${w}`).toBeLessThanOrEqual(1);
      }
    }

    console.log("\n===== CONSOLE ERRORS (" + consoleErrors.length + ") =====\n" + (consoleErrors.join("\n") || "(none)") + "\n===== END =====\n");
    expect(consoleErrors, "zero console errors on the populated page").toHaveLength(0);
  });
});

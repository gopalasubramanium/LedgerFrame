import { test, expect } from "@playwright/test";

// ⚠ DEV-ONLY smoke (see playwright.smoke.config.ts). Phase-3a scripted pre-pass for Review — drives the
// LIVE app + real backend on seeded demo, checks the POPULATED page (summary rail · attention list with
// neutral severity chips + area links · the ND-3 ReviewCard↔page count reconciliation LIVE · the
// Mark-reviewed round-trip · [Help] · single scroll + 0 overflow), and captures console errors. NOT
// wired into `npm run check`/CI. Run (from frontend/):
//   npx playwright test --config e2e/smoke/playwright.smoke.config.ts review-smoke

const WIDTHS = [320, 375, 900, 1366];
const API = "http://127.0.0.1:8321/api/v1";
const consoleErrors: string[] = [];

test.describe.serial("review pre-pass (live)", () => {
  test("drive the populated /review + assert attention/reconciliation/mark-reviewed/overflow, 0 errors", async ({ page }) => {
    page.on("console", (m) => m.type() === "error" && consoleErrors.push(`[console] ${m.text()}`));
    page.on("pageerror", (e) => consoleErrors.push(`[pageerror] ${e.message}`));

    // PART 0: clear the first-run gate SERVER-SIDE so the page (not the overlay) is tested.
    await page.request.put(`${API}/settings`, { data: { values: { first_run_complete: "1" } } });

    // PART 1: page renders — summary rail + attention list -----------------------------------------
    await page.goto("/#/review");
    await expect(page.getByRole("heading", { name: "Review", exact: true })).toBeVisible({ timeout: 15_000 });
    const rows = page.locator('[data-card="attention"] .lf-table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });
    const rowCount = await rows.count();
    console.log("PART 1 — attention rows:", rowCount);
    expect(rowCount, "attention list populated").toBeGreaterThan(0);

    // PART 2: SEMANTIC severity chip (served verbatim, display-cased) + area links (§12rv1-4/5, ND-7) --
    const chip = page.locator('[data-card="attention"] .rv__chip').first();
    const chipText = (await chip.innerText()).trim();
    const chipClass = (await chip.getAttribute("class")) ?? "";
    console.log("PART 2 — first severity chip:", chipText, "· class:", chipClass);
    // §12rv1-5 — the served value is display-cased, rendered verbatim (no raw enum key).
    expect(["Review", "Info"], "severity rendered verbatim (display-cased)").toContain(chipText);
    // §12rv1-4 — the chip carries a semantic tone class per severity (Review → attention, Info → neutral).
    expect(chipClass, "chip carries a semantic tone class").toMatch(/rv__chip--(attention|neutral)/);
    if (chipText === "Review") expect(chipClass, "Review → attention token").toContain("rv__chip--attention");
    if (chipText === "Info") expect(chipClass, "Info → neutral").toContain("rv__chip--neutral");
    // A known area links to its canonical page (Data → /pricing-health, which IS built).
    const dataLink = page.locator('[data-card="attention"] a', { hasText: "Data" }).first();
    if (await dataLink.count()) {
      expect(await dataLink.getAttribute("href"), "area links to its canonical page").toContain("/");
    }

    // PART 3: ND-3 reconciliation LIVE — ReviewCard (Net worth) count == Review page count ----------
    const cardApi = (await (await page.request.get(`${API}/portfolio/review`)).json()).count;
    const pageApi = (await (await page.request.get(`${API}/review`)).json()).attention_count;
    console.log("PART 3 — /portfolio/review.count:", cardApi, "· /review.attention_count:", pageApi);
    expect(cardApi, "the two readers reconcile by construction").toBe(pageApi);
    // DOM: the Review summary rail shows the same count.
    const pageDom = await page.evaluate(() => {
      const tiles = [...document.querySelectorAll('[data-card="rail"] .lf-stat')];
      const t = tiles.find((x) => x.querySelector(".lf-stat__label")?.textContent === "Attention"); // §12rv1-7
      return t ? Number(t.querySelector(".lf-stat__value")?.textContent) : -1;
    });
    // DOM: Net worth's ReviewCard shows the same count.
    await page.goto("/#/net-worth");
    await page.waitForSelector(".lf-review", { timeout: 15_000 });
    const cardDom = await page.evaluate(() => {
      const el = document.querySelector(".lf-review__attention");
      const m = el?.textContent?.match(/(\d+)/);
      return m ? Number(m[1]) : 0;
    });
    console.log("PART 3 — Review page DOM:", pageDom, "· Net worth ReviewCard DOM:", cardDom);
    expect(pageDom, "Review page count == served count").toBe(pageApi);
    expect(cardDom, "Net worth ReviewCard count == served count (live reconciliation)").toBe(pageApi);
    await page.goto("/#/review");
    await expect(page.getByRole("heading", { name: "Review", exact: true })).toBeVisible();

    // PART 4: Mark-reviewed round-trip (ND-8) — record a snapshot, see it in history ----------------
    const beforeRows = await page.locator('[data-card="history"] .lf-table tbody tr').count();
    const note = `prepass-${Date.now()}`;
    await page.getByRole("button", { name: "Mark reviewed" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Review note").fill(note);
    await dialog.getByLabel("Next review date").fill("2026-09-01");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Marked reviewed."), "mark-reviewed outcome").toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-card="history"]').getByText(note), "the new review appears in history").toBeVisible({ timeout: 10_000 });
    const afterRows = await page.locator('[data-card="history"] .lf-table tbody tr').count();
    console.log("PART 4 — history rows:", beforeRows, "→", afterRows);
    expect(afterRows, "history grew by the recorded review").toBeGreaterThan(beforeRows);

    // PART 5: [Help] on Review -----------------------------------------------------------------------
    expect(await page.locator('[data-card="attention"] .lf-term').count(), "Review [Help]").toBeGreaterThan(0);

    // PART 5b: retired label gone (§12rv1-7) + Mark reviewed icon (§12rv1-1) + history cap (§12rv1-6) --
    // The retired "Needs a look" label appears nowhere as a LABEL (body copy "what needs a look" is OK).
    expect(await page.getByText("Needs a look", { exact: true }).count(), "retired label gone").toBe(0);
    // The summary tile + history column read "Attention".
    expect(await page.getByText("Attention", { exact: true }).count(), "'Attention' label present").toBeGreaterThan(0);
    // Mark reviewed keeps its text AND carries an icon.
    const markBtn = page.getByRole("button", { name: "Mark reviewed" });
    expect(await markBtn.locator("svg").count(), "Mark reviewed icon (text label kept)").toBeGreaterThan(0);
    // §12rv1-6 — the history table is BOUNDED (the DataTable worklist cap), scrolling internally.
    const histMaxH = await page.locator('[data-card="history"] .lf-table__scroll').first().evaluate(
      (el) => getComputedStyle(el).maxHeight,
    );
    console.log("PART 5b — history table max-height:", histMaxH);
    expect(histMaxH, "history table caps (worklist standard)").not.toBe("none");

    // PART 6: nothing stuck in skeleton ------------------------------------------------------------
    await expect(page.locator(".lf-skeleton"), "no card stuck in skeleton").toHaveCount(0);

    // PART 7: single vertical scroll region + NO horizontal overflow × both themes -----------------
    await page.setViewportSize({ width: 1366, height: 1000 });
    await page.waitForTimeout(120);
    const winScrolled = await page.evaluate(() => {
      window.scrollTo(0, 5000);
      const y = window.scrollY;
      window.scrollTo(0, 0);
      return y;
    });
    console.log("PART 7 — window scrolled (must be 0):", winScrolled);
    expect(winScrolled, "document/window must not scroll — one region").toBeLessThanOrEqual(1);
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
        console.log(`PART 7 — overflow ${theme} ${w}px:`, JSON.stringify(over));
        expect(over.doc, `doc overflow ${theme} ${w}`).toBeLessThanOrEqual(1);
        expect(over.content, `content overflow ${theme} ${w}`).toBeLessThanOrEqual(1);
      }
    }

    console.log("\n===== CONSOLE ERRORS (" + consoleErrors.length + ") =====\n" + (consoleErrors.join("\n") || "(none)") + "\n===== END =====\n");
    expect(consoleErrors, "zero console errors on the populated page").toHaveLength(0);
  });
});

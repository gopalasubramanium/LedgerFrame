import { test, expect } from "@playwright/test";

// ⚠ DEV-ONLY smoke (see playwright.smoke.config.ts). Phase-3a scripted pre-pass for Pricing Health —
// drives the LIVE app + real backend on seeded demo, checks the POPULATED page (diagnostics +
// confidence + the banner↔page reconciliation + refresh/correct-source + no config controls +
// overflow), and captures console errors. NOT wired into `npm run check`/CI. Run (from frontend/):
//   npx playwright test --config e2e/smoke/playwright.smoke.config.ts pricing-health-smoke

const WIDTHS = [320, 375, 900, 1366];
const consoleErrors: string[] = [];

test.describe.serial("pricing health pre-pass (live)", () => {
  test("drive the populated /pricing-health + assert diagnostics, reconciliation, D-072, overflow, 0 errors", async ({ page }) => {
    page.on("console", (m) => m.type() === "error" && consoleErrors.push(`[console] ${m.text()}`));
    page.on("pageerror", (e) => consoleErrors.push(`[pageerror] ${e.message}`));

    // PART 0: clear the first-run gate SERVER-SIDE so the page (not the overlay) is tested.
    await page.request.put("http://127.0.0.1:8321/api/v1/settings", { data: { values: { first_run_complete: "1" } } });

    // PART 1: diagnostics populated + confidence card ------------------------------------------
    await page.goto("/#/pricing-health");
    await expect(page.getByRole("heading", { name: "Pricing Health", exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Portfolio confidence" })).toBeVisible();
    const rows = page.locator('[data-card="diagnostics"] .lf-table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });
    const rowCount = await rows.count();
    console.log("PART 1 — diagnostics rows:", rowCount);
    expect(rowCount, "per-holding diagnostics populated").toBeGreaterThan(0);
    // by-band table + status-count strip present (ND-6).
    await expect(page.locator(".ph__bandtable")).toBeVisible();
    // Retargeted from the removed page-local `.ph__chip` → the ratified `.lf-statuschip` (StatusChip
    // migration, page-policy §9-15) — this dev smoke's selector was missed when the guards were
    // retargeted, so it had been red since that migration (pre-existing; not this batch).
    expect(await page.locator('[data-card="confidence"] .lf-statuschip').count(), "status/band chips render").toBeGreaterThan(0);
    // §12ph1-3: the diagnostics DataTable caption is present for a11y but VISUALLY HIDDEN (the card
    // header already titles the table — no duplicate visible title).
    const cap = page.locator('[data-card="diagnostics"] table caption');
    await expect(cap).toHaveCount(1);
    expect(await cap.evaluate((el) => Math.round(el.getBoundingClientRect().width)), "caption visually hidden").toBeLessThanOrEqual(2);

    // PART 2: banner ↔ page stale-count RECONCILIATION + SKEW test (§12ph1-1) --------------------
    // Banner and page footnote read ONE shared query → they can never disagree. The footnote also
    // matches /portfolio/summary.stale_count (the shared reader), and a server-side staleness
    // mutation (a refresh) moves both together.
    const readBanner = async (): Promise<number> => {
      const b = page.locator(".lf-statusstrip--stale");
      if ((await b.count()) === 0) return 0; // hidden when nothing is stale
      const m = (await b.first().innerText()).match(/(\d+)/);
      return m ? Number(m[1]) : 0;
    };
    const readFootnote = async (): Promise<number> => Number((await page.getByTestId("ph-stale-count").textContent()) ?? "-1");
    const summary0 = await (await page.request.get("http://127.0.0.1:8321/api/v1/portfolio/summary")).json();
    const b0 = await readBanner();
    const f0 = await readFootnote();
    console.log("PART 2 — banner:", b0, "footnote:", f0, "summary.stale_count:", summary0.stale_count);
    expect(f0, "footnote == banner (one shared query)").toBe(b0);
    expect(f0, "footnote == summary.stale_count (shared reader)").toBe(summary0.stale_count);
    // Skew: mutate staleness server-side via a bulk refresh, then confirm banner + page still agree.
    await page.getByRole("button", { name: "Refresh all prices" }).click();
    await page.waitForTimeout(2500); // bulk refresh (mock provider, fast) + shared-query invalidate
    const b1 = await readBanner();
    const f1 = await readFootnote();
    console.log("PART 2 — after refresh — banner:", b1, "footnote:", f1);
    expect(f1, "banner == footnote after a server-side staleness mutation (they move together)").toBe(b1);

    // §12ph1-2: the 3 confidence sections FILL the card width (no phantom auto-fit dead space).
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 1000 });
      await page.waitForTimeout(120);
      const dead = await page.evaluate(() => {
        const card = document.querySelector('[data-card="confidence"] .lf-card__body') as HTMLElement;
        const cr = card.getBoundingClientRect();
        const padR = parseFloat(getComputedStyle(card).paddingRight);
        const grid = document.querySelector(".ph__confgrid") as HTMLElement;
        const kids = Array.from(grid.children).map((k) => k.getBoundingClientRect());
        const topRow = Math.min(...kids.map((k) => Math.round(k.top)));
        const sections = kids.filter((k) => Math.round(k.top) === topRow);
        return Math.round(cr.right - padR - Math.max(...sections.map((k) => k.right)));
      });
      console.log(`PART 2b — confidence card-fill @${w}px: deadRight=${dead}`);
      expect(dead, `confidence sections fill the card width (no dead right) @${w}px`).toBeLessThanOrEqual(2);
    }
    await page.setViewportSize({ width: 1366, height: 900 });

    // PART 3: D-072 — routing chain is READ-ONLY; NO provider-priority config on the page --------
    // Open a Details dialog and confirm the routing chain has no form controls (chips only).
    await page.getByRole("button", { name: /Actions for/ }).first().click();
    await page.getByText("Details", { exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Routing")).toBeVisible();
    await expect(dialog.getByText(/Priority chain \(read-only\)/)).toBeVisible();
    expect(await dialog.locator(".ph__chain select, .ph__chain input").count(), "routing chain is read-only (no controls)").toBe(0);
    await page.keyboard.press("Escape");
    // No provider-priority editing anywhere on the page (D-072). The only select is the correct-source
    // MasterSelect, which lives inside its own dialog (closed now) — so the base page has none.
    expect(await page.locator('[data-card="diagnostics"] select, [data-card="confidence"] select').count(), "no priority config controls").toBe(0);

    // PART 4: Correct-source dialog opens with a served MasterSelect (per-instrument correction) --
    await page.getByRole("button", { name: /Actions for/ }).first().click();
    await page.getByText("Correct source", { exact: true }).click();
    await expect(page.getByRole("dialog").getByText(/per-instrument correction/)).toBeVisible();
    await expect(page.getByRole("dialog").locator("select")).toBeVisible(); // MasterSelect
    await page.keyboard.press("Escape");

    // PART 5: identifier-duplicate banner — honest (shown only when count > 0) -------------------
    const dupCount = (await (await page.request.get("http://127.0.0.1:8321/api/v1/system/identifier-duplicates")).json()).count;
    const dupBannerCount = await page.locator(".ph__dupbanner").count();
    console.log("PART 5 — identifier duplicates:", dupCount, "· banner shown:", dupBannerCount);
    expect(dupBannerCount, "dup banner present iff duplicates exist").toBe(dupCount > 0 ? 1 : 0);

    // PART 6: progressive loading — every card resolved OUT of skeleton --------------------------
    await expect(page.locator(".lf-skeleton"), "no card stuck in skeleton").toHaveCount(0);

    // PART 7: NO horizontal overflow on the POPULATED page at every breakpoint × both themes ------
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

import { test, expect } from "@playwright/test";

// ⚠ DEV-ONLY smoke (see playwright.smoke.config.ts). Phase-3a scripted pre-pass for Markets — drives
// the LIVE app + real backend on seeded demo, checks the POPULATED page (market status + Global tab
// with region tabs + the ETF-proxy honesty badge + Gainers/Losers display-sort + the instrument grid
// + watchlist management + the R-17 ticker link), asserts no overflow at every breakpoint × both
// themes, and captures console errors. NOT wired into `npm run check`/CI. Run (from frontend/):
//   npx playwright test --config e2e/smoke/playwright.smoke.config.ts markets-smoke

const WIDTHS = [320, 375, 900, 1366];
const consoleErrors: string[] = [];
const API = "http://127.0.0.1:8321/api/v1";

test.describe.serial("markets pre-pass (live)", () => {
  test("drive the populated /markets + assert every section, R-17, overflow, 0 errors", async ({ page }) => {
    page.on("console", (m) => m.type() === "error" && consoleErrors.push(`[console] ${m.text()}`));
    page.on("pageerror", (e) => consoleErrors.push(`[pageerror] ${e.message}`));

    // PART 0: clear the first-run gate SERVER-SIDE so the page (not the overlay) is tested.
    await page.request.put(`${API}/settings`, { data: { values: { first_run_complete: "1" } } });

    // PART 1: market status + Global tab (region tabs + proxy honesty) ---------------------------
    await page.goto("/#/markets");
    await expect(page.getByRole("heading", { name: "Markets", exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".mk__pill")).toContainText(/US · (Open|Closed|Pre-market|Post-market|Unknown)/);

    const tabs = page.locator('[data-card="global"] .lf-segmented .lf-segbtn');
    await expect(tabs.first()).toBeVisible({ timeout: 15_000 });
    const tabCount = await tabs.count();
    console.log("PART 1 — region tabs:", await tabs.allInnerTexts());
    expect(tabCount, "served Global groups render as region tabs").toBeGreaterThan(1);
    // Americas is the default region; its indices are served via ETF proxies here (real_indices=false)
    // → the D-051/ND-6 protected-honesty badge is shown per proxy row, never passed off as the index.
    const idxRows = page.locator('[data-card="global"] .mk__idxrow');
    expect(await idxRows.count(), "Global index rows populated").toBeGreaterThan(0);
    await expect(page.getByText(/via .* proxy/).first(), "proxy-sourced index is badged").toBeVisible();
    await expect(page.locator('[data-card="global"] .mk__note')).toBeVisible();

    // Region switch: Commodities are the asset itself (GLD/BTC), NEVER an ETF proxy for an index →
    // no per-row proxy badge appears in that group (only index groups get it).
    await page.getByRole("button", { name: "Commodities" }).click();
    await page.waitForTimeout(120);
    expect(await page.locator('[data-card="global"] .mk__proxy').count(), "no proxy badge on commodities").toBe(0);
    await page.getByRole("button", { name: "Americas" }).click();

    // PART 1b: Global-tab 30-day sparklines (batch 2, §12mk2-1) — progressive per-row; sparks render
    // for available symbols; none stuck in the loading placeholder; NO fabricated flat line. ---------
    const sparks = page.locator('[data-card="global"] .mk__spark .lf-spark');
    await expect(sparks.first(), "index-row sparkline renders").toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(400);
    const sparkCount = await sparks.count();
    const loadingStuck = await page.locator('[data-card="global"] .mk__spark--loading').count();
    console.log("PART 1b — sparklines rendered:", sparkCount, "· loading stuck:", loadingStuck);
    expect(sparkCount, "sparklines render for available index symbols").toBeGreaterThan(0);
    expect(loadingStuck, "no sparkline stuck in the loading placeholder").toBe(0);

    // PART 1c: Global-row alignment below the laptop breakpoint (§12mk4-1) — EVERY row uses the
    // explicit 2-line layout (label line, then spark+price+change line), consistent regardless of
    // label length; price/change right-aligned across rows; no spark/price overlap. Asia-Pacific has
    // the most varied labels (the stress case). 320/375/880 × both themes. -------------------------
    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme });
      for (const w of [320, 375, 880]) {
        await page.setViewportSize({ width: w, height: 1000 });
        await page.getByRole("button", { name: "Asia-Pacific" }).click();
        await page.waitForTimeout(200);
        const geo = await page.evaluate(() => {
          const rows = [...document.querySelectorAll('[data-card="global"] .mk__idxrow')];
          const d = rows.map((row) => {
            const lab = (row.querySelector(".mk__idxlabel") as HTMLElement).getBoundingClientRect();
            const sp = (row.querySelector(".mk__spark") as HTMLElement).getBoundingClientRect();
            const pr = (row.querySelector(".mk__idxprice") as HTMLElement).getBoundingClientRect();
            const cg = (row.querySelector(".mk__chg") as HTMLElement).getBoundingClientRect();
            return { stacked: Math.round(sp.top) >= Math.round(lab.bottom) - 1, overlap: Math.round(sp.right) > Math.round(pr.left), chgR: Math.round(cg.right) };
          });
          return { allStacked: d.every((x) => x.stacked), anyOverlap: d.some((x) => x.overlap), spread: Math.max(...d.map((x) => x.chgR)) - Math.min(...d.map((x) => x.chgR)) };
        });
        console.log(`PART 1c — ${theme} ${w}px: allStacked=${geo.allStacked} overlap=${geo.anyOverlap} priceAlignSpread=${geo.spread}`);
        expect(geo.allStacked, `every Global row is 2-line stacked · ${theme} ${w}px`).toBe(true);
        expect(geo.anyOverlap, `no spark/price overlap · ${theme} ${w}px`).toBe(false);
        expect(geo.spread, `price/change right-aligned across rows · ${theme} ${w}px`).toBeLessThanOrEqual(2);
      }
    }
    // Restore the default context for the remaining parts.
    await page.emulateMedia({ colorScheme: "light" });
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.getByRole("button", { name: "Americas" }).click();

    // PART 2: Gainers / Losers — a display-sort of served change_pct; the which-list copy is guarded --
    const movers = page.locator('[data-card="movers"]');
    await expect(movers.getByText("Gainers / Losers")).toBeVisible();
    await expect(movers.getByRole("heading", { name: "Gainers", exact: true })).toBeVisible();
    await expect(movers.getByRole("heading", { name: "Losers", exact: true })).toBeVisible();
    const moverRows = movers.locator(".mk__moverow");
    console.log("PART 2 — Gainers/Losers rows:", await moverRows.count());
    // D-024 protected copy: the contribution-weighted pair (Portfolio's) must never leak onto Markets.
    const bodyText = (await page.locator(".mk").innerText()).toLowerCase();
    expect(bodyText, "no Contributors on Markets").not.toContain("contributor");
    expect(bodyText, "no Detractors on Markets").not.toContain("detractor");

    // PART 3: instrument grid — populated, search filters (no region filter, no money math) ---------
    const gridRows = page.locator('[data-card="grid"] tbody tr');
    await expect(gridRows.first()).toBeVisible({ timeout: 15_000 });
    const before = await gridRows.count();
    console.log("PART 3 — grid rows:", before);
    expect(before, "instrument grid populated").toBeGreaterThan(0);
    await page.getByRole("searchbox", { name: /Search instruments/ }).fill("SPY");
    await page.waitForTimeout(150);
    const after = await gridRows.count();
    console.log("PART 3 — grid rows after 'SPY' filter:", after);
    expect(after, "search narrows the grid").toBeLessThan(before);
    await page.getByRole("searchbox", { name: /Search instruments/ }).fill("");

    // PART 4: watchlist management round-trip (D-052, [S]-gated create/delete) ----------------------
    await expect(page.locator('[data-card="watchlists"]')).toBeVisible();
    const listName = `SMOKE-${Date.now()}`;
    await page.getByRole("button", { name: "New watchlist" }).first().click();
    const createDlg = page.getByRole("dialog");
    await createDlg.getByLabel("Watchlist name").fill(listName);
    await createDlg.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("heading", { name: listName }), "created list appears").toBeVisible({ timeout: 10_000 });
    // Delete it again (clean up the dev DB) via its RowMenu → ConfirmDialog.
    await page.getByRole("button", { name: `Actions for ${listName}` }).click();
    await page.getByText("Delete list", { exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("heading", { name: listName }), "deleted list is gone").toHaveCount(0, { timeout: 10_000 });
    console.log("PART 4 — watchlist create/delete round-trip OK:", listName);

    // PART 5: R-17 — the TickerStrip footer links world indices to /markets (ND-5) ------------------
    const idxLinks = page.locator('.lf-ticker a[href*="/markets"]');
    await expect(idxLinks.first(), "ticker index entries link to /markets (R-17)").toBeVisible({ timeout: 15_000 });
    console.log("PART 5 — ticker /markets links:", await idxLinks.count());

    // PART 5b: PageHeader "Find a symbol" search wired to /markets/search (§12mk3-1) ----------------
    await page.getByLabel("Search markets").fill("app");
    const hit = page.locator(".mk__searchmenu .mk__searchrow a").first();
    await expect(hit, "served search hit renders in the header dropdown").toBeVisible({ timeout: 10_000 });
    expect(await hit.getAttribute("href"), "a hit links to InstrumentDetail").toContain("/instrument/");
    await page.getByLabel("Search markets").fill("");

    // PART 5c: link treatment (§12mk1-2) — NO browser-default underlined links in tables or the
    // Gainers/Losers lists (the Portfolio §12b3-3 recurrence, now centralized in .lf-table + fixed). --
    const underlined = await page.evaluate(() =>
      [...document.querySelectorAll('.lf-table a, [data-card="movers"] .mk__movesym a')].filter((a) =>
        getComputedStyle(a as HTMLElement).textDecorationLine.includes("underline"),
      ).length,
    );
    console.log("PART 5c — underlined table/mover links (must be 0):", underlined);
    expect(underlined, "no default-underlined links in tables or Gainers/Losers").toBe(0);

    // PART 5d: single vertical scroll region (§12mk1-1) — at a TALL viewport the document/window must
    // NOT scroll (pre-fix this page scrolled the whole window beside the content scroller). ----------
    await page.setViewportSize({ width: 1366, height: 1000 });
    await page.waitForTimeout(150);
    const winScrolled = await page.evaluate(() => {
      window.scrollTo(0, 5000);
      const y = window.scrollY;
      window.scrollTo(0, 0);
      return y;
    });
    console.log("PART 5d — window scrolled (must be 0):", winScrolled);
    expect(winScrolled, "document/window must not scroll — one region (shell content)").toBeLessThanOrEqual(1);
    await page.setViewportSize({ width: 1366, height: 900 });

    // PART 6: progressive loading — nothing stuck in skeleton --------------------------------------
    await expect(page.locator(".lf-skeleton"), "no card stuck in skeleton").toHaveCount(0);

    // PART 7: NO horizontal overflow on the POPULATED page at every breakpoint × both themes --------
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

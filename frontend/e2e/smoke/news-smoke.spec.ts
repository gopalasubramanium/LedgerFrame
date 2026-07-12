import { test, expect } from "@playwright/test";

// ⚠ DEV-ONLY smoke (see playwright.smoke.config.ts). Phase-3a scripted pre-pass for News — drives the
// LIVE app + real backend on seeded demo, checks the POPULATED page (deterministic briefing with NO AI
// copy · grouped headlines with external + symbol links · [Help] terms · the no-egress honest state ·
// single scroll region + 0 overflow), and captures console errors. NOT wired into `npm run check`/CI.
// Run (from frontend/):
//   npx playwright test --config e2e/smoke/playwright.smoke.config.ts news-smoke

const WIDTHS = [320, 375, 900, 1366];
const API = "http://127.0.0.1:8321/api/v1";
const consoleErrors: string[] = [];

test.describe.serial("news pre-pass (live)", () => {
  test("drive the populated /news + assert briefing/headlines/no-egress/overflow, 0 errors", async ({ page }) => {
    page.on("console", (m) => m.type() === "error" && consoleErrors.push(`[console] ${m.text()}`));
    page.on("pageerror", (e) => consoleErrors.push(`[pageerror] ${e.message}`));

    // PART 0: clear the first-run gate + generate the deterministic briefing (worker's job; demo-seeded
    // here like clearing first-run). Ensure no-egress is OFF to start.
    await page.request.put(`${API}/settings`, { data: { values: { first_run_complete: "1", privacy_mode: "false" } } });
    await page.request.post(`${API}/briefing/refresh`);

    // PART 1: briefing — deterministic served text, NO AI copy (ND-1) --------------------------------
    await page.goto("/#/news");
    await expect(page.getByRole("heading", { name: "News", exact: true })).toBeVisible({ timeout: 15_000 });
    const briefing = page.locator('[data-card="briefing"]');
    await expect(briefing.locator(".nw__briefing")).toBeVisible();
    const briefingText = await briefing.locator(".nw__briefing").innerText();
    console.log("PART 1 — briefing:", briefingText.slice(0, 90));
    expect(briefingText, "briefing is populated (not the empty default)").toContain("Information only");
    expect(briefingText, "no AI copy on the briefing card (ND-1)").not.toMatch(/\bAI\b|narrat|artificial intelligence/i);

    // PART 2: grouped headlines — served buckets + NewsList links (ND-3/ND-5) ------------------------
    const heads = page.locator('[data-card="headlines"] .lf-newslist__head');
    await expect(heads.first()).toBeVisible({ timeout: 15_000 });
    const groupCount = await page.locator('[data-card="headlines"] .lf-segmented .lf-segbtn').count();
    const itemCount = await heads.count();
    console.log("PART 2 — bucket tabs:", groupCount, "· headlines (active bucket):", itemCount);
    expect(groupCount, "grouped headline buckets render as tabs").toBeGreaterThan(0);
    expect(itemCount, "active bucket headlines populated").toBeGreaterThan(0);
    // PART 2b: segmented tabs (§12nw1-2) — one bucket visible; switching shows another. Iterate the
    // buckets to find an external-linked headline (RSS feeds carry urls; some provider items don't)
    // and a per-symbol InstrumentDetail link (the "My holdings" bucket) — proving ND-5 links + tabs.
    const tabs = page.locator('[data-card="headlines"] .lf-segmented .lf-segbtn');
    const tabCount = await tabs.count();
    console.log("PART 2b — bucket tabs:", await tabs.allInnerTexts());
    expect(tabCount, "served buckets render as segmented tabs").toBeGreaterThan(0);
    let foundExt = false;
    let foundSym = false;
    for (let i = 0; i < tabCount; i++) {
      await tabs.nth(i).click();
      await page.waitForTimeout(120);
      await expect(page.locator('[data-card="headlines"] .lf-newslist__head').first(), "bucket has headlines").toBeVisible();
      const a = page.locator('[data-card="headlines"] a.lf-newslist__head').first();
      if (!foundExt && (await a.count())) {
        expect(await a.getAttribute("target"), "external link opens new tab").toBe("_blank");
        expect(await a.getAttribute("rel"), "external link has a safe rel").toContain("noreferrer");
        foundExt = true;
      }
      const sym = page.locator('[data-card="headlines"] .lf-newslist__sym').first();
      if (!foundSym && (await sym.count())) {
        expect(await sym.getAttribute("href"), "symbol → InstrumentDetail").toContain("/instrument/");
        foundSym = true;
      }
      if (foundExt && foundSym) break;
    }
    console.log("PART 2b — external link ok:", foundExt, "· symbol link ok:", foundSym);
    expect(foundExt, "at least one external-linked headline (ND-5)").toBe(true);
    await tabs.first().click(); // restore to the first bucket

    // PART 2c: per-card refresh (§12nw1-3, ND-8 reversal) — briefing regenerate works; headlines
    // refresh button is present + enabled (a re-GET — not clicked here to avoid a second RSS fetch).
    await page.getByRole("button", { name: "Refresh briefing" }).click();
    await expect(page.getByText("Briefing updated."), "briefing refresh outcome").toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Refresh headlines" })).toBeEnabled();
    console.log("PART 2c — briefing refresh OK; headlines refresh enabled");

    // PART 3: [Help] terms — Briefing + Headlines are GlossaryTerms (ND-9) ---------------------------
    expect(await page.locator('[data-card="briefing"] .lf-term').count(), "Briefing [Help]").toBeGreaterThan(0);
    expect(await page.locator('[data-card="headlines"] .lf-term').count(), "Headlines [Help]").toBeGreaterThan(0);

    // PART 4: no-egress honest state (ND-2) — toggle ON, then RESTORE -------------------------------
    await page.request.put(`${API}/settings`, { data: { values: { privacy_mode: "true" } } });
    await page.reload(); // full reload so the News readers re-fetch (a hash goto wouldn't re-mount)
    await expect(page.getByText(/no-egress is on/), "honest no-egress reason").toBeVisible({ timeout: 15_000 });
    expect(await page.locator('[data-card="headlines"] .lf-newslist__head').count(), "zero headlines under no-egress").toBe(0);
    // §12nw1-3: refresh is egress — the buttons render honestly DISABLED under no-egress (never a no-op).
    await expect(page.getByRole("button", { name: "Refresh briefing" }), "briefing refresh disabled").toBeDisabled();
    await expect(page.getByRole("button", { name: "Refresh headlines" }), "headlines refresh disabled").toBeDisabled();
    // Restore egress and confirm headlines return.
    await page.request.put(`${API}/settings`, { data: { values: { privacy_mode: "false" } } });
    await page.reload();
    await expect(page.locator('[data-card="headlines"] .lf-newslist__head').first(), "headlines return with egress").toBeVisible({ timeout: 15_000 });
    console.log("PART 4 — no-egress honest state OK; restored");

    // PART 5: progressive loading — nothing stuck in skeleton --------------------------------------
    await expect(page.locator(".lf-skeleton"), "no card stuck in skeleton").toHaveCount(0);

    // PART 6: single vertical scroll region + NO horizontal overflow × both themes ------------------
    await page.setViewportSize({ width: 1366, height: 1000 });
    await page.waitForTimeout(120);
    const winScrolled = await page.evaluate(() => {
      window.scrollTo(0, 5000);
      const y = window.scrollY;
      window.scrollTo(0, 0);
      return y;
    });
    console.log("PART 6 — window scrolled (must be 0):", winScrolled);
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
        console.log(`PART 6 — overflow ${theme} ${w}px:`, JSON.stringify(over));
        expect(over.doc, `doc overflow ${theme} ${w}`).toBeLessThanOrEqual(1);
        expect(over.content, `content overflow ${theme} ${w}`).toBeLessThanOrEqual(1);
      }
    }

    console.log("\n===== CONSOLE ERRORS (" + consoleErrors.length + ") =====\n" + (consoleErrors.join("\n") || "(none)") + "\n===== END =====\n");
    expect(consoleErrors, "zero console errors on the populated page").toHaveLength(0);
  });
});

import { test, expect } from "@playwright/test";

// ⚠ DEV-ONLY smoke (see playwright.smoke.config.ts). Phase-3a scripted pre-pass for SCENARIOS —
// drives the LIVE app + real backend, both themes × every breakpoint. NOT wired into `npm run check`.
//   npx playwright test --config e2e/smoke/playwright.smoke.config.ts scenarios-smoke
//
// It exercises what unit tests cannot: the SEEDED page rendering the real 7 shocks + exposures +
// liquidity, the D-058 forecast bar on the RENDERED page, the live single-derivation (exposures ==
// Portfolio's allocation; runway == Net worth's reader), the ?entity_id rejection, and the geometry.

const WIDTHS = [320, 375, 900, 1366];
const THEMES = ["light", "dark"] as const;
const API = "http://127.0.0.1:8321/api/v1";
const consoleErrors: string[] = [];

test.describe.serial("scenarios pre-pass (live)", () => {
  test("empty → seeded → D-058 → single derivation → geometry → 0 console errors", async ({ page }) => {
    page.on("console", (m) => m.type() === "error" && consoleErrors.push(`[console] ${m.text()}`));
    page.on("pageerror", (e) => consoleErrors.push(`[pageerror] ${e.message}`));
    await page.request.put(`${API}/settings`, { data: { values: { first_run_complete: "1" } } });

    // PART 1 — the page renders (seeded demo has holdings, so it is populated).
    await page.goto("/#/scenarios");
    await expect(page.getByRole("heading", { name: "Scenarios", exact: true })).toBeVisible({ timeout: 15_000 });

    const api = await (await page.request.get(`${API}/portfolio/scenarios`)).json();
    if (api.net_worth !== 0 && api.asset_scenarios.some((s: { exposure: number }) => s.exposure > 0)) {
      const rows = page.locator('[data-card="shocks"] tbody tr');
      await expect.poll(async () => rows.count(), { timeout: 10_000 }).toBe(7); // the 7 fixed shocks
      await expect(page.locator('[data-card="exposures"]')).toBeVisible();
      await expect(page.locator('[data-card="liquidity"]')).toBeVisible();
      console.log("PART 1 — populated: 7 shocks, exposures, liquidity");
    } else {
      await expect(page.getByText("No holdings to model a shock against.")).toBeVisible();
      console.log("PART 1 — empty state (no holdings)");
    }

    // PART 1b — §12sc1-1 — THE EXPOSURES STRIP CONTAINS ITS VALUES AT EVERY MOBILE WIDTH.
    //
    // ⚠ This is a REAL-VIEWPORT check, not a specimen one: the strip's layout is media-query driven
    // (2×2 below tablet, 4-across on wide, 1-col on phone) and the fixed sidebar eats content width,
    // so it can ONLY be measured at a real viewport with the shell present (§13b's limit — a
    // media-query-responsive component cannot be tested by narrowing a fixed-width specimen frame).
    // The value is a TABULAR number that does not wrap, so a too-narrow tile CLIPS it: assert the
    // content fits its box (scrollWidth <= clientWidth) — getBoundingClientRect is clamped and misses
    // it (§13a: measure the actual thing).
    for (const w of [320, 375, 420, 500, 900, 1100, 1366]) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.waitForTimeout(150);
      const clipped = await page.evaluate(() => {
        const out: string[] = [];
        document.querySelectorAll('[data-card="exposures"] .lf-stat__value').forEach((v) => {
          const el = v as HTMLElement;
          if (el.scrollWidth > el.clientWidth + 1) out.push(`${el.textContent?.trim()} (${el.scrollWidth} in ${el.clientWidth})`);
        });
        return out;
      });
      expect(clipped, `no exposure value clipped @${w}px`).toEqual([]);
    }
    await page.setViewportSize({ width: 1366, height: 900 });
    console.log("PART 1b — exposures strip contains its values at 320..1366");

    // PART 2 — D-058: NO forecast language on the RENDERED page except the protected copy.
    const body = ((await page.locator(".lf-page").innerText()) || "").toLowerCase();
    const protectedCopy = "never a forecast";
    for (const banned of ["prediction", "projection", "expected to", "likely to", "probability"]) {
      // (These appear only inside the disclaimer's own negations, which contain "never a forecast".)
      if (body.includes(banned)) {
        expect(body, `"${banned}" only in protected copy`).toContain(protectedCopy);
      }
    }
    await expect(page.getByText(/a scenario, never a forecast/i)).toBeVisible();
    await expect(page.getByText(/not a prediction, probability or recommendation/i)).toBeVisible();
    console.log("PART 2 — D-058 clean on the rendered page");

    // PART 3 — SINGLE DERIVATION, LIVE. Exposures == Portfolio's allocation; runway == Net worth's.
    const summary = await (await page.request.get(`${API}/portfolio/summary`)).json();
    const alloc = summary.allocation_by_class;
    expect(Math.abs(api.exposures.crypto - (alloc.crypto ?? 0))).toBeLessThan(1);
    expect(Math.abs(api.exposures.property - (alloc.property ?? 0))).toBeLessThan(1);
    const eq = (alloc.equity ?? 0) + (alloc.etf ?? 0) + (alloc.mutual_fund ?? 0);
    expect(Math.abs(api.exposures.equities - eq)).toBeLessThan(1);
    const runway = await (await page.request.get(`${API}/portfolio/runway`)).json();
    expect(api.liquidity.liquid).toBe(runway.liquid);   // one reader — cannot disagree
    console.log("PART 3 — single derivation holds live (exposures == allocation; liquid == runway)");

    // PART 4 — ?entity_id is rejected (household-only).
    const scoped = await page.request.get(`${API}/portfolio/scenarios`, { params: { entity_id: 1 } });
    expect(scoped.status()).toBe(400);
    console.log("PART 4 — ?entity_id rejected (400, household-scoped)");

    // PART 5 — no card left in skeleton.
    expect(await page.locator(".lf-skeleton").count()).toBe(0);

    // PART 6 — geometry: both themes × every breakpoint.
    for (const theme of THEMES) {
      await page.emulateMedia({ colorScheme: theme });
      await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: 800 });
        await page.waitForTimeout(120);
        const overflow = await page.evaluate(() => {
          const d = document.documentElement;
          const c = document.querySelector(".lf-shell__content") as HTMLElement | null;
          return { doc: d.scrollWidth - d.clientWidth, content: c ? c.scrollWidth - c.clientWidth : 0 };
        });
        expect(overflow.doc, `document no h-scroll @${w} ${theme}`).toBeLessThanOrEqual(1);
        expect(overflow.content, `content no h-scroll @${w} ${theme}`).toBeLessThanOrEqual(1);
        await page.evaluate(() => window.scrollTo(0, 500));
        expect(await page.evaluate(() => window.scrollY), `document never scrolls @${w} ${theme}`).toBe(0);
      }
    }
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.screenshot({ path: "e2e/smoke/artifacts/scenarios-1366.png", fullPage: true });
    console.log("PART 6 — geometry clean: 0 h-overflow, single vertical scroll region");

    console.log("CONSOLE ERRORS:", JSON.stringify(consoleErrors, null, 2));
    expect(consoleErrors, "0 console errors").toEqual([]);
  });
});

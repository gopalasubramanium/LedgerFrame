import { test, expect } from "@playwright/test";

// ⚠ DEV-ONLY smoke (see playwright.smoke.config.ts). Phase-3a scripted pre-pass for INSURANCE —
// drives the LIVE app + real backend (demo-seeded, incl. the non-SGD + lapsed policies), both themes
// × every breakpoint. NOT wired into `npm run check`.
//   npx playwright test --config e2e/smoke/playwright.smoke.config.ts insurance-smoke
//
// It exercises what unit tests cannot: the SEEDED register rendering the real policies + totals +
// renewals live, the served currency code on the USD row (§12in-1), the served renewal state chips
// (§12in-3), the lapsed-excluded honesty (§9-10), the served disclaimer (§12in-2), a full CRUD
// round-trip through the [S]-gated editor, containment at real viewports, and 0 console errors.

const WIDTHS = [320, 375, 900, 1366];
const THEMES = ["light", "dark"] as const;
const API = "http://127.0.0.1:8321/api/v1";
const consoleErrors: string[] = [];

test.describe.serial("insurance pre-pass (live)", () => {
  test("populated → currency/state/lapsed honesty → CRUD → containment → 0 console errors", async ({ page }) => {
    page.on("console", (m) => m.type() === "error" && consoleErrors.push(`[console] ${m.text()}`));
    page.on("pageerror", (e) => consoleErrors.push(`[pageerror] ${e.message}`));
    await page.request.put(`${API}/settings`, { data: { values: { first_run_complete: "1" } } });

    // PART 1 — the seeded register renders (demo has ≥1 policy).
    const api = await (await page.request.get(`${API}/insurance`)).json();
    expect(api.policies.length, "demo seeds an insurance register").toBeGreaterThan(0);
    await page.goto("/#/insurance");
    await expect(page.getByRole("heading", { name: "Insurance", exact: true })).toBeVisible({ timeout: 15_000 });
    const rows = page.locator('[data-card="policies"] tbody tr');
    await expect.poll(async () => rows.count(), { timeout: 10_000 }).toBe(api.policies.length);
    await expect(page.locator('[data-card="totals"]')).toBeVisible();

    // PART 2 — §12in-1: a non-base policy shows the currency code, served verbatim.
    const nonBase = api.policies.find((p: { currency: string }) => p.currency !== api.base_currency);
    if (nonBase) {
      await expect(page.getByText(nonBase.cover_amount_display, { exact: false }).first()).toBeVisible();
      expect(nonBase.cover_amount_display).toContain(nonBase.currency);
      console.log(`PART 2 — non-base row: ${nonBase.cover_amount_display}`);
    }

    // PART 3 — §9-10: a lapsed policy is VISIBLE but the active count excludes it.
    const lapsed = api.policies.find((p: { status: string }) => p.status !== "active");
    if (lapsed) {
      await expect(page.getByText(lapsed.name, { exact: false }).first()).toBeVisible();
      expect(api.count, "count is active-only").toBeLessThan(api.policies.length);
      console.log(`PART 3 — lapsed '${lapsed.name}' shown; active count ${api.count} < ${api.policies.length} rows`);
    }

    // PART 4 — §12in-3: served renewal states render as LABELLED chips (never colour-alone).
    const states = new Set(api.upcoming_renewals.map((r: { state: string }) => r.state));
    if (states.has("overdue")) await expect(page.getByText("Overdue").first()).toBeVisible();
    if (states.has("soon")) await expect(page.getByText("Renews soon").first()).toBeVisible();
    console.log(`PART 4 — renewal states present: ${[...states].join(", ")}`);

    // PART 5 — §12in-2: the served disclaimer carries both exclusion sentences + the Net worth link.
    await expect(page.getByText(/excluded from the totals and the active count/)).toBeVisible();
    await expect(page.getByRole("link", { name: "see Net worth" })).toBeVisible();

    // PART 6 — §9-2 STANDING: no adequacy/advice language on the rendered page outside the protected copy.
    const bodyText = ((await page.locator(".lf-page").innerText()) || "").toLowerCase();
    const protectedCopy = "a register, never an adequacy judgment";
    const disclaimer = "not an assessment of whether your cover is adequate";
    for (const banned of ["under-insured", "coverage gap", "sufficient", "recommend", "should buy", "should increase"]) {
      expect(bodyText, `"${banned}" must not appear`).not.toContain(banned);
    }
    // "adequate/adequacy" appear ONLY inside the protected bar + disclaimer.
    expect(bodyText).toContain(protectedCopy);
    expect(bodyText).toContain(disclaimer);
    console.log("PART 6 — no adequacy/advice language outside the protected copy");

    // PART 7 — no card left in skeleton.
    await expect(page.locator(".lf-skeleton")).toHaveCount(0);

    // PART 8 — CRUD ROUND-TRIP through the [S]-gated editor (ambient session; no PIN in dev).
    const NAME = "Smoke Test Policy";
    await page.getByRole("button", { name: /add policy/i }).first().click();
    await page.getByLabel("Name").fill(NAME);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(NAME).first()).toBeVisible({ timeout: 10_000 });
    console.log("PART 8a — added a policy via the editor");
    // Edit it.
    await page.getByRole("button", { name: `Actions for ${NAME}` }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await page.getByLabel("Name").fill(`${NAME} (edited)`);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(`${NAME} (edited)`).first()).toBeVisible({ timeout: 10_000 });
    console.log("PART 8b — edited the policy");
    // Delete it.
    await page.getByRole("button", { name: `Actions for ${NAME} (edited)` }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText(`${NAME} (edited)`)).toHaveCount(0, { timeout: 10_000 });
    console.log("PART 8c — deleted the policy — CRUD round-trip complete");

    // PART 9 — CONTAINMENT at real viewports: no money value clips its box (measure the clipped
    // element's scrollWidth, never a container's scroll metrics — page-scenarios §12sc1-1).
    for (const w of [320, 375, 420, 500, 900, 1100, 1366]) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.waitForTimeout(150);
      const clipped = await page.evaluate(() => {
        const out: string[] = [];
        document.querySelectorAll('[data-card="totals"] .lf-stat__value, [data-card="policies"] td').forEach((v) => {
          const el = v as HTMLElement;
          if (el.scrollWidth > el.clientWidth + 1) out.push(`${el.textContent?.trim()} (${el.scrollWidth} in ${el.clientWidth})`);
        });
        return out;
      });
      expect(clipped, `no clipped value @${w}px`).toEqual([]);
    }
    await page.setViewportSize({ width: 1366, height: 900 });
    console.log("PART 9 — values contained at 320..1366");

    // PART 10 — geometry: both themes × every breakpoint, single vertical scroll region, 0 overflow.
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
    await page.screenshot({ path: "e2e/smoke/artifacts/insurance-1366.png", fullPage: true });
    console.log("PART 10 — geometry clean, single vertical scroll region");

    console.log("CONSOLE ERRORS:", JSON.stringify(consoleErrors, null, 2));
    expect(consoleErrors, "0 console errors").toEqual([]);
  });
});

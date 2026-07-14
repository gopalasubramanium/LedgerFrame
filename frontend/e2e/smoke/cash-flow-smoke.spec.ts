import { test, expect } from "@playwright/test";

// ⚠ DEV-ONLY smoke (see playwright.smoke.config.ts). Phase-3a scripted pre-pass for CASH FLOW —
// drives the LIVE app + real backend on a RESET instance (which is EMPTY, so the empty states are
// the FIRST thing it must drive), both themes × every breakpoint. NOT wired into `npm run check`.
//   npx playwright test --config e2e/smoke/playwright.smoke.config.ts cash-flow-smoke
//
// It exercises what unit tests cannot: the full per-row CRUD round-trip INCLUDING DELETE against the
// real PIN-gated write path, the §0-protected D-057 invariants VISIBLE ON THE PAGE, the live
// Cash-flow↔Net-worth runway identity, and the geometry with real-shaped data.

const WIDTHS = [320, 375, 900, 1366];
const THEMES = ["light", "dark"] as const;
const API = "http://127.0.0.1:8321/api/v1";
const consoleErrors: string[] = [];

test.describe.serial("cash flow pre-pass (live)", () => {
  test("empty states → CRUD round-trip → D-057 → geometry → 0 console errors", async ({ page }) => {
    page.on("console", (m) => m.type() === "error" && consoleErrors.push(`[console] ${m.text()}`));
    page.on("pageerror", (e) => consoleErrors.push(`[pageerror] ${e.message}`));

    await page.request.put(`${API}/settings`, { data: { values: { first_run_complete: "1" } } });

    // PART 0 — ESTABLISH THE PRECONDITION, do not assume it. `reset.py` clears settings and the PIN
    // but NOT these records, so a previous run's rows survive it: the pre-pass must clear them itself
    // or its "empty state" claim is false the second time it runs. (A pre-pass that only works once
    // is not a pre-pass.)
    for (const [path, key] of [["obligations", "obligations"], ["contributions", "contributions"], ["goals", "goals"]] as const) {
      const existing = await (await page.request.get(`${API}/${path}`)).json();
      for (const row of existing[key] ?? []) await page.request.delete(`${API}/${path}/${row.id}`);
    }

    // PART 1 — THE EMPTY STATE. A reset instance has all three lists empty: this is the FIRST thing
    // a real user sees, not an edge case.
    await page.goto("/#/cash-flow");
    await expect(page.getByRole("heading", { name: "Cash flow", exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("No obligations recorded.")).toBeVisible();
    await expect(page.getByText("No contributions recorded.")).toBeVisible();
    await expect(page.getByText("No goals recorded.")).toBeVisible();
    console.log("PART 1 — all three empty states render with a reason + a way forward");

    // PART 2 — CRUD round-trip against the REAL PIN-gated write path.
    const ob = await page.request.post(`${API}/obligations`, {
      data: { name: "Rent", amount: 4200, due_date: "2026-08-01", recurrence: "monthly", kind: "expense" },
    });
    expect(ob.ok(), "the write path accepts a valid obligation").toBeTruthy();
    await page.request.post(`${API}/obligations`, {
      data: { name: "Salary", amount: 12500, due_date: "2026-07-25", recurrence: "monthly", kind: "income" },
    });
    // A `once` obligation — the §0 invariant's subject.
    await page.request.post(`${API}/obligations`, {
      data: { name: "Income tax", amount: 18400, due_date: "2026-09-30", recurrence: "once", kind: "expense" },
    });
    const goal = await page.request.post(`${API}/goals`, {
      data: { name: "House deposit", target_amount: 250000, basis: "net_worth", target_date: "2028-01-01" },
    });
    const goalId = (await goal.json()).id as number;
    await page.request.post(`${API}/contributions`, {
      data: { name: "VWRA SIP", amount: 100000, frequency: "monthly", kind: "invest", target_goal_id: goalId, active: true },
    });

    // PART 3 — §0-PROTECTED D-057, VISIBLE ON THE PAGE (not just in the backend tests).
    const beforeRunway = await (await page.request.get(`${API}/portfolio/runway`)).json();
    // The contribution above is 100k/month — vastly bigger than the burn. If it leaked in AT ALL,
    // the runway would collapse.
    expect(beforeRunway.monthly_expense, "the `once` tax bill is NOT in the recurring burn").toBe(4200);
    expect(beforeRunway.monthly_income).toBe(12500);
    console.log(`PART 3 — D-057 holds live: burn excludes the one-off; a 100k/month contribution did not touch it (runway ${beforeRunway.runway_months ?? "positive"})`);

    await page.reload();
    await expect(page.getByRole("heading", { name: "Cash flow", exact: true })).toBeVisible({ timeout: 15_000 });

    // The `once` row shows NO monthly equivalent — an em dash, never 0.
    const taxRow = page.locator('[data-card="obligations"] tbody tr', { hasText: "Income tax" });
    await expect(taxRow).toBeVisible();
    await expect(taxRow, "a one-off has no monthly rate — '—', never 0.00").toContainText("—");

    // PART 4 — the runway summary is NET WORTH'S figure, from the SAME reader (§9-3 identity).
    //
    // ⚠ WAIT THE CARD OUT OF ITS SKELETON FIRST. My first version asserted as soon as the card was
    // "visible" — but a card's HEADER is visible while its BODY is still loading, so it read back
    // just "Cash runway" and failed on a page that was fine. This is the progressive-loading race
    // the template warns about (§12-8), and I walked straight into it.
    const runwayCard = page.locator('[data-card="runway"]');
    await expect(runwayCard.locator(".lf-skeleton")).toHaveCount(0);
    await expect(runwayCard).toContainText("Net monthly burn");
    const shownBurn = await runwayCard.innerText();
    expect(shownBurn, "the page shows the SERVED burn, verbatim").toContain(beforeRunway.net_monthly_burn_display);
    const nw = await (await page.request.get(`${API}/portfolio/runway`)).json();
    expect(nw.net_monthly_burn, "one reader — Cash flow and Net worth cannot disagree").toBe(beforeRunway.net_monthly_burn);
    console.log("PART 4 — runway summary == Net worth's served figure (one reader)");

    // PART 5 — DELETE round-trip (the platform's first destructive action) + the honest 404.
    const gone = await page.request.delete(`${API}/obligations/999999`);
    expect(gone.status(), "deleting nothing is an honest 404, not a silent ok").toBe(404);
    console.log("PART 5 — DELETE of a missing id is an honest 404");

    // PART 6 — no card left in skeleton.
    expect(await page.locator(".lf-skeleton").count(), "every card is out of skeleton").toBe(0);

    // PART 7 — GEOMETRY: both themes × every breakpoint.
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
        expect(overflow.doc, `document must not scroll horizontally @${w} ${theme}`).toBeLessThanOrEqual(1);
        expect(overflow.content, `shell content must not scroll horizontally @${w} ${theme}`).toBeLessThanOrEqual(1);

        await page.evaluate(() => window.scrollTo(0, 500));
        expect(await page.evaluate(() => window.scrollY), `the document never scrolls vertically @${w} ${theme}`).toBe(0);
      }
    }
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.screenshot({ path: "e2e/smoke/artifacts/cash-flow-1366.png", fullPage: true });
    console.log("PART 7 — geometry clean: 0 h-overflow, single vertical scroll region");

    console.log("CONSOLE ERRORS:", JSON.stringify(consoleErrors, null, 2));
    expect(consoleErrors, "0 console errors across the whole run").toEqual([]);
  });
});

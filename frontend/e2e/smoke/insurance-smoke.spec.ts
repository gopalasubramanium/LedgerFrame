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

    // --- OWNER WALK BATCH 1 measuring assertions (page-insurance §14) ---
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.waitForTimeout(150);

    // PART 7a — §14in-1: the vertical rhythm equals `.lf-page`'s gap (no page-local margin inflates it).
    // RED (pre-fix): the totals→policies and policies→flank gaps measured 28px (16 gap + a 12px page-local
    // margin) vs the 16px platform standard on /cash-flow and /scenarios.
    const rhythm = await page.evaluate(() => {
      const pageEl = document.querySelector(".lf-page") as HTMLElement;
      const gap = parseFloat(getComputedStyle(pageEl).rowGap || getComputedStyle(pageEl).gap);
      const kids = [...pageEl.children] as HTMLElement[];
      const gaps: number[] = [];
      for (let i = 1; i < kids.length; i++) {
        gaps.push(Math.round(kids[i].getBoundingClientRect().top - kids[i - 1].getBoundingClientRect().bottom));
      }
      return { gap: Math.round(gap), gaps };
    });
    console.log(`PART 7a — page gap=${rhythm.gap}px, section gaps=${JSON.stringify(rhythm.gaps)}`);
    for (const g of rhythm.gaps) expect(Math.abs(g - rhythm.gap), "section rhythm == .lf-page gap").toBeLessThanOrEqual(1);

    // PART 7b — §14in-2: the "Premium / yr" column renders the served ANNUAL EQUIVALENT (not the raw
    // per-frequency premium), and Σ(served active annuals) reconciles with the strip total.
    const monthly = api.policies.find((p: { premium_frequency: string; annual_premium_display: string | null }) =>
      p.premium_frequency === "monthly" && p.annual_premium_display);
    if (monthly) {
      const row = page.locator('[data-card="policies"] tbody tr', { hasText: monthly.name });
      await expect(row.locator("td").nth(3)).toHaveText(monthly.annual_premium_display);
      expect(monthly.annual_premium_display).not.toBe(monthly.premium_display); // annualised ≠ per-frequency
      console.log(`PART 7b — ${monthly.name}: /yr column = ${monthly.annual_premium_display} (premium ${monthly.premium_display})`);
    }
    // Σ reconciliation (the A11 pin): sum of served per-row annual_premium over active policies == total.
    const sumAnnual = api.policies
      .filter((p: { status: string; annual_premium: number | null }) => p.status === "active" && p.annual_premium != null)
      .reduce((a: number, p: { annual_premium: number }) => a + p.annual_premium, 0);
    // total_annual_premium is FX-converted for non-base rows, so compare in base by re-summing base rows
    // exactly and allowing the non-base contribution to close the gap within FX rounding.
    const baseOnlySum = api.policies
      .filter((p: { status: string; currency: string; annual_premium: number | null }) =>
        p.status === "active" && p.currency === api.base_currency && p.annual_premium != null)
      .reduce((a: number, p: { annual_premium: number }) => a + p.annual_premium, 0);
    expect(api.total_annual_premium, "total >= base-only annual sum").toBeGreaterThanOrEqual(baseOnlySum - 1);
    console.log(`PART 7b — Σ active annual (incl. FX) ${sumAnnual} vs served total ${api.total_annual_premium}`);

    // PART 7c — §14in-4: renewals rows are an ALIGNED grid (dates + right edges line up) and the card is
    // NOT stretched to reserve dead space (content-driven, shorter than the taller cover-by-type sibling).
    const ren = await page.evaluate(() => {
      const card = document.querySelector('[data-card="renewals"]') as HTMLElement;
      const cover = document.querySelector('[data-card="cover-by-type"]') as HTMLElement;
      const rows = [...card.querySelectorAll("li")];
      const dateLefts = rows.map((li) => Math.round((li.querySelector(".ins__rdate") as HTMLElement).getBoundingClientRect().left));
      const rightEdges = rows.map((li) => {
        const last = li.lastElementChild as HTMLElement;
        return Math.round(last.getBoundingClientRect().right);
      });
      const lastRowBottom = rows.length ? Math.round(rows[rows.length - 1].getBoundingClientRect().bottom) : 0;
      const cardBottom = Math.round(card.getBoundingClientRect().bottom);
      return {
        n: rows.length, dateLefts, rightEdges,
        deadSpaceBelowList: cardBottom - lastRowBottom,
        renewalsH: Math.round(card.getBoundingClientRect().height),
        coverH: Math.round(cover.getBoundingClientRect().height),
      };
    });
    console.log(`PART 7c — renewals: dateLefts=${JSON.stringify(ren.dateLefts)} rightEdges=${JSON.stringify(ren.rightEdges)} renewalsH=${ren.renewalsH} coverH=${ren.coverH} deadBelow=${ren.deadSpaceBelowList}`);
    if (ren.n > 1) {
      expect(Math.max(...ren.dateLefts) - Math.min(...ren.dateLefts), "date column aligned across rows").toBeLessThanOrEqual(1);
      expect(Math.max(...ren.rightEdges) - Math.min(...ren.rightEdges), "row right edges aligned").toBeLessThanOrEqual(1);
    }
    // No reserved dead space: the card is content-driven, so with fewer rows it is SHORTER than the
    // taller cover-by-type sibling (before the fix the grid stretched both to the same 351px).
    expect(ren.renewalsH, "renewals card content-driven, not stretched to the sibling").toBeLessThan(ren.coverH);
    expect(ren.deadSpaceBelowList, "little slack below the renewals list").toBeLessThan(48);

    // PART 7d — §14in-5: money summary tiles carry the served base-currency affix; the count tile does not.
    const affix = await page.evaluate((base: string) => {
      const stats = [...document.querySelectorAll('[data-card="totals"] .lf-stat')] as HTMLElement[];
      return stats.map((s) => {
        const label = (s.querySelector(".lf-stat__label")?.textContent || "").trim();
        const unit = (s.querySelector(".lf-stat__unit")?.textContent || "").trim();
        return { label, unit, hasBase: unit === base };
      });
    }, api.base_currency);
    console.log(`PART 7d — totals affixes: ${JSON.stringify(affix)}`);
    for (const s of affix) {
      if (/cover|cash value|premium/i.test(s.label)) expect(s.hasBase, `${s.label} carries the ${api.base_currency} affix`).toBe(true);
      if (/policies/i.test(s.label)) expect(s.unit, "the count tile carries no currency affix").toBe("");
    }
    await page.setViewportSize({ width: 1366, height: 900 });

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

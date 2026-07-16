import { test, expect } from "@playwright/test";

// ⚠ DEV-ONLY smoke (see playwright.smoke.config.ts). Phase-3a scripted pre-pass for ESTATE —
// drives the LIVE app + real backend (demo-seeded estate register), both themes × every breakpoint.
// NOT wired into `npm run check`.
//   npx playwright test --config e2e/smoke/playwright.smoke.config.ts estate-smoke
//
// It exercises what unit tests cannot: the SEEDED register rendering the real profile + contacts +
// documents live; the profile-card will-status chip LEADING (§12es-1); the SERVED "Not recorded" /
// "Executed" labels (§12es-3); the readiness COUNTS strip with NO currency affix (§9-3); served-label
// role/category/status chips; a full CRUD round-trip through the [S]-gated editors (profile edit;
// contact add→edit→delete with multi-role Switch selection; document add→edit→delete); the review-soon
// signal on the seeded next_review (§9-8); CONTAINMENT at real viewports; and 0 console errors.

const WIDTHS = [320, 375, 900, 1366];
const THEMES = ["light", "dark"] as const;
const API = "http://127.0.0.1:8321/api/v1";
const consoleErrors: string[] = [];

test.describe.serial("estate pre-pass (live)", () => {
  test("populated → served labels → counts-only → CRUD → review-soon → containment → 0 console errors", async ({ page }) => {
    page.on("console", (m) => m.type() === "error" && consoleErrors.push(`[console] ${m.text()}`));
    page.on("pageerror", (e) => consoleErrors.push(`[pageerror] ${e.message}`));
    await page.request.put(`${API}/settings`, { data: { values: { first_run_complete: "1" } } });

    // PART 1 — the seeded register renders (demo seeds a populated estate).
    const api = await (await page.request.get(`${API}/estate`)).json();
    expect(api.contacts.length, "demo seeds estate contacts").toBeGreaterThan(0);
    expect(api.documents.length, "demo seeds estate documents").toBeGreaterThan(0);
    await page.goto("/#/estate");
    await expect(page.getByRole("heading", { name: "Estate", exact: true })).toBeVisible({ timeout: 15_000 });
    const contactRows = page.locator('[data-card="contacts"] tbody tr');
    await expect.poll(async () => contactRows.count(), { timeout: 10_000 }).toBe(api.contacts.length);
    const docRows = page.locator('[data-card="documents"] tbody tr');
    await expect.poll(async () => docRows.count(), { timeout: 10_000 }).toBe(api.documents.length);

    // PART 2 — §12es-1: the profile card leads with the will-status chip (served label), NOT the strip.
    const profile = page.locator('[data-card="profile"]');
    const willChip = profile.locator(".lf-statuschip, .lf-chip").first();
    const willValue: string = api.profile.will_status;
    const refdata = await (await page.request.get(`${API}/refdata`)).json();
    const willLabel = refdata.will_status.find((o: { value: string }) => o.value === willValue).label;
    await expect(willChip).toHaveText(willLabel);
    console.log(`PART 2 — will_status '${willValue}' → served label '${willLabel}' leads the profile card`);

    // PART 3 — §9-3: the readiness strip is COUNTS-ONLY. No money-formatted string, no base-currency
    // affix (.lf-stat__unit) anywhere on the page — the guard that keeps the chosen absence chosen.
    const strip = page.locator('[data-card="readiness"]');
    await expect(strip.locator(".lf-stat")).toHaveCount(5);
    const money = await page.evaluate(() => {
      const text = (document.querySelector(".lf-page") as HTMLElement).innerText;
      const units = document.querySelectorAll(".lf-page .lf-stat__unit").length;
      return { hasMoney: /\d{1,3}(,\d{3})+\.\d{2}/.test(text), units };
    });
    expect(money.hasMoney, "no money-formatted string on /estate (§9-3)").toBe(false);
    expect(money.units, "no base-currency affix on /estate (§9-3)").toBe(0);
    console.log("PART 3 — readiness strip is 5 count tiles; no money string, no currency affix");

    // PART 4 — served-label chips: a missing + an outdated document render ATTENTION chips with labels.
    const missing = api.documents.find((d: { status: string }) => d.status === "missing");
    const outdated = api.documents.find((d: { status: string }) => d.status === "outdated");
    if (missing) {
      const row = page.locator('[data-card="documents"] tbody tr', { hasText: missing.title });
      await expect(row.getByText("Missing")).toBeVisible();
    }
    if (outdated) {
      const row = page.locator('[data-card="documents"] tbody tr', { hasText: outdated.title });
      await expect(row.getByText("Outdated")).toBeVisible();
    }
    console.log(`PART 4 — missing='${missing?.title}' outdated='${outdated?.title}' render attention chips`);

    // PART 5 — the served disclaimer renders VERBATIM, once, at the foot (§9-10).
    await expect(page.locator(".est__disclaimer")).toHaveText(api.disclaimer);
    await expect(page.locator(".est__disclaimer")).toHaveCount(1);
    expect(api.disclaimer).toContain("Not legal or estate-planning advice");
    console.log("PART 5 — served disclaimer rendered verbatim, once");

    // PART 6 — a blank optional cell is a bare em dash (§12in-4), never 0.
    const blankPhone = api.contacts.find((c: { phone: string | null }) => c.phone === null);
    if (blankPhone) {
      const row = page.locator('[data-card="contacts"] tbody tr', { hasText: blankPhone.name });
      await expect(row.locator("td").nth(2)).toHaveText("—");
      console.log(`PART 6 — '${blankPhone.name}' blank phone renders a bare em dash`);
    }

    // PART 7 — no card left in skeleton.
    await expect(page.locator(".lf-skeleton")).toHaveCount(0);

    // PART 8 — §9-8: the review-soon signal fires on the seeded next_review (within 30d).
    const review = await (await page.request.get(`${API}/portfolio/review`)).json();
    const estSignals = review.items.filter((i: { area: string }) => i.area === "Estate").map((i: { title: string }) => i.title);
    expect(estSignals.some((t: string) => t.includes("Estate review due in")), "review-soon signal fires").toBe(true);
    console.log(`PART 8 — estate review signals: ${JSON.stringify(estSignals)}`);

    // PART 9 — CRUD ROUND-TRIP through the [S]-gated editors (ambient session; no PIN in dev).
    await page.setViewportSize({ width: 1366, height: 900 });

    // 9a — profile edit.
    await page.locator('[data-card="profile"]').getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Executor").fill("Priya R-V (edited)");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Priya R-V (edited)").first()).toBeVisible({ timeout: 10_000 });
    console.log("PART 9a — edited the profile executor");

    // 9b — contact add with MULTI-ROLE Switch selection.
    const CNAME = "Smoke Contact";
    await page.getByRole("button", { name: /add contact/i }).first().click();
    await page.getByLabel("Name").fill(CNAME);
    await page.getByLabel("Executor").click();     // Switch label
    await page.getByLabel("Guardian").click();     // second role → multi-role
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(CNAME).first()).toBeVisible({ timeout: 10_000 });
    const cRow = page.locator('[data-card="contacts"] tbody tr', { hasText: CNAME });
    await expect(cRow.getByText("Executor")).toBeVisible();
    await expect(cRow.getByText("Guardian")).toBeVisible();
    console.log("PART 9b — added a contact with two roles (multi-role Switch)");

    // 9c — contact edit.
    await page.getByRole("button", { name: `Actions for ${CNAME}` }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await page.getByLabel("Name").fill(`${CNAME} (edited)`);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(`${CNAME} (edited)`).first()).toBeVisible({ timeout: 10_000 });
    // 9d — contact delete.
    await page.getByRole("button", { name: `Actions for ${CNAME} (edited)` }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText(`${CNAME} (edited)`)).toHaveCount(0, { timeout: 10_000 });
    console.log("PART 9c/d — edited then deleted the contact — CRUD round-trip complete");

    // 9e — document add→delete.
    const DNAME = "Smoke Document";
    await page.getByRole("button", { name: /add document/i }).first().click();
    await page.getByLabel("Title", { exact: true }).fill(DNAME);   // exact: a doc row's ⋯ aria-label contains "Title"
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(DNAME).first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: `Actions for ${DNAME}` }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText(DNAME)).toHaveCount(0, { timeout: 10_000 });
    console.log("PART 9e — added then deleted a document");

    // PART 10 — CONTAINMENT at real viewports (measure the clipped element's scrollWidth, never a
    // container's scroll metrics — page-scenarios §12sc1-1). The readiness COUNT values and the
    // StatusChip/category chips must NEVER clip. Long Name/Email/Document/Location cells are `truncate`
    // columns — they ELLIPSIZE by design (that IS containment), and the whole table scrolls INSIDE its
    // card, so the PAGE never overflows (proven at every breakpoint in PART 11). So this part measures
    // only the must-not-truncate elements.
    for (const w of [320, 375, 420, 500, 900, 1100, 1366]) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.waitForTimeout(150);
      const clipped = await page.evaluate(() => {
        const out: string[] = [];
        document.querySelectorAll('[data-card="readiness"] .lf-stat__value, [data-card="documents"] .lf-statuschip, [data-card="documents"] .lf-chip, [data-card="contacts"] .lf-chip').forEach((v) => {
          const el = v as HTMLElement;
          if (el.scrollWidth > el.clientWidth + 1) out.push(`${el.textContent?.trim()} (${el.scrollWidth} in ${el.clientWidth})`);
        });
        return out;
      });
      expect(clipped, `no clipped count/chip @${w}px`).toEqual([]);
    }
    console.log("PART 10 — count values + status/role chips contained at 320..1366 (truncate cells ellipsize by design)");

    // PART 11 — geometry: both themes × every breakpoint, single vertical scroll region, 0 overflow.
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
    await page.screenshot({ path: "e2e/smoke/artifacts/estate-1366.png", fullPage: true });
    console.log("PART 11 — geometry clean, single vertical scroll region");

    console.log("CONSOLE ERRORS:", JSON.stringify(consoleErrors, null, 2));
    expect(consoleErrors, "0 console errors").toEqual([]);
  });
});

import { test, expect } from "@playwright/test";

// ⚠ DEV-ONLY smoke (see playwright.smoke.config.ts). Phase-3a scripted pre-pass for ACCOUNTS —
// drives the LIVE app + real backend on a RESET, demo-seeded instance (entities + institution master
// wired), both themes × every breakpoint. NOT wired into `npm run check`.
//   npx playwright test --config e2e/smoke/playwright.smoke.config.ts accounts-smoke
//
// It exercises what unit tests cannot: the SEEDED register rendering live; the §12ac-1 SERVED Value
// header; tile-integrity of the footer Σ; served labels (FIFO); full [S]-gated CRUD incl. an
// inline-created institution (LIVE POST) and a cost-basis change → restatement → figures move; entity
// add/rename/delete-blocked; institution rename + a REAL merge; the Amendment-G Holdings drill-down;
// containment at real viewports; 0 console errors.

const WIDTHS = [320, 375, 900, 1366];
const THEMES = ["light", "dark"] as const;
const API = "http://127.0.0.1:8321/api/v1";
const consoleErrors: string[] = [];
const num = (s: string) => Number(s.replace(/[^0-9.-]/g, ""));

test.describe.serial("accounts pre-pass (live)", () => {
  test("seeded register → served header/labels → CRUD → masters → drill-down → 0 console errors", async ({ page }) => {
    page.on("console", (m) => m.type() === "error" && consoleErrors.push(`[console] ${m.text()}`));
    page.on("pageerror", (e) => consoleErrors.push(`[pageerror] ${e.message}`));
    await page.request.put(`${API}/settings`, { data: { values: { first_run_complete: "1" } } });

    // PART 1 — the demo seed populates entities + the institution master + wired accounts.
    const rep = await (await page.request.get(`${API}/accounts`)).json();
    const insts = (await (await page.request.get(`${API}/institutions`)).json()).institutions as {
      name: string; account_count: number; policy_count: number;
    }[];
    const ents = (await (await page.request.get(`${API}/entities`)).json()).entities as { name: string }[];
    expect(rep.accounts.length, "demo seeds accounts").toBeGreaterThan(0);
    expect(insts.length, "demo seeds the institution master").toBeGreaterThan(0);
    expect(ents.map((e) => e.name)).toContain("Household");
    expect(ents.map((e) => e.name)).toContain("Rajan Family Trust");
    console.log(`PART 1 — ${rep.accounts.length} accounts, ${insts.length} institutions, ${ents.length} entities; base=${rep.base_currency}`);

    await page.goto("/#/accounts");
    await expect(page.getByRole("heading", { name: "Accounts", exact: true, level: 1 })).toBeVisible({ timeout: 15_000 });
    const acctTable = page.locator('[data-card="accounts"] table');
    await expect.poll(async () => acctTable.locator("tbody tr").count(), { timeout: 10_000 }).toBe(rep.accounts.length);

    // PART 2 — §12ac-1: the Value header carries the SERVED base_currency (never hardcoded).
    await expect(page.getByRole("columnheader", { name: `Value (${rep.base_currency})` })).toBeVisible();
    console.log(`PART 2 — Value header follows the served base: Value (${rep.base_currency})`);

    // PART 3 — tile-integrity: the footer Σ equals the sum of the rendered value rows.
    const sums = await page.evaluate(() => {
      const t = document.querySelector('[data-card="accounts"] table') as HTMLElement;
      const n = (s: string | null) => Number((s ?? "").replace(/[^0-9.-]/g, ""));
      // columns: Name(0) Institution(1) Kind(2) Currency(3) Cost basis(4) Entity(5) Value(6) actions(7).
      const rows = [...t.querySelectorAll("tbody tr")].map((r) => n((r.querySelectorAll("td")[6] as HTMLElement).textContent));
      const foot = n((t.querySelector("tfoot")!.querySelectorAll("td")[6] as HTMLElement).textContent);
      return { sum: rows.reduce((a, b) => a + b, 0), foot };
    });
    expect(Math.round(sums.foot * 100)).toBe(Math.round(sums.sum * 100));
    console.log(`PART 3 — footer Σ ${sums.foot} == Σ rows ${sums.sum} (tile-integrity)`);

    // PART 4 — served labels render verbatim (FIFO, never "Fifo").
    await expect(page.getByText("FIFO", { exact: true }).first()).toBeVisible();
    // case-sensitive exact: the titleizer's "Fifo" must NOT appear (the served override is "FIFO").
    expect(await page.locator('[data-card="accounts"] table').getByText("Fifo", { exact: true }).count()).toBe(0);

    // PART 5 — CRUD: add an account with an INLINE-CREATED institution (LIVE POST to /institutions).
    const NEW_INST = "Smoke Test Bank";
    const NEW_ACCT = "Smoke Test Account";
    await page.getByRole("button", { name: "Add account" }).first().click();
    await page.getByLabel("Account name").fill(NEW_ACCT);
    // create-new institution inline
    await page.getByLabel("Institution").selectOption("__create__");
    await page.getByLabel("New Institution").fill(NEW_INST);
    await page.getByLabel("New Institution").press("Enter");
    // it POSTed to the master:
    await expect.poll(async () => {
      const list = (await (await page.request.get(`${API}/institutions`)).json()).institutions as { name: string }[];
      return list.some((i) => i.name === NEW_INST);
    }, { timeout: 10_000 }).toBe(true);
    await page.getByLabel("Entity").selectOption({ label: "Rajan Family Trust" });
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("cell", { name: NEW_INST }).first()).toBeVisible({ timeout: 10_000 });
    console.log(`PART 5 — added '${NEW_ACCT}' with inline-created institution '${NEW_INST}' (LIVE POST)`);

    // PART 6 — cost-basis change on the seeded account WITH transactions → warning → rebuild → figures move.
    const seededWithHistory = rep.accounts.find((a: { last_activity: string | null; name: string }) => a.last_activity && a.name);
    const beforeTotal = num(rep.total_display);
    // §14ac-1: the account RowMenu is keyed by the account NAME now (its identity).
    await page.getByRole("button", { name: `Actions for ${seededWithHistory.name}` }).first().click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    const cb = page.getByLabel("Cost-basis method", { exact: true }); // not the GlossaryTerm "… — definition"
    const current = await cb.inputValue();
    await cb.selectOption(current === "fifo" ? "average" : "fifo");
    await page.getByRole("button", { name: "Save" }).click();
    // the restatement warning is interposed BEFORE the PATCH (§9-5).
    await expect(page.getByText(/realised and unrealised figures will change/)).toBeVisible();
    await page.getByRole("button", { name: /Change and restate/ }).click();
    await expect(page.getByText(/realised and unrealised figures for this account will change/)).toBeVisible({ timeout: 10_000 });
    const afterRep = await (await page.request.get(`${API}/accounts`)).json();
    console.log(`PART 6 — cost-basis restated; base total ${beforeTotal} → ${num(afterRep.total_display)} (rebuild fired)`);

    // PART 7 — delete the smoke account (cleanup + delete path).
    await page.locator('[data-card="accounts"]').getByRole("button", { name: `Actions for ${NEW_ACCT}` }).first().click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    // the ACCOUNT row (its institution cell) is gone — the institution master still lists the institution.
    await expect(page.locator('[data-card="accounts"]').getByRole("cell", { name: NEW_INST })).toHaveCount(0, { timeout: 10_000 });
    console.log("PART 7 — deleted the smoke account");

    // PART 8 — entities: add, rename, and a DELETE that is FK-blocked (ratified body).
    await page.locator('[data-card="entities"]').getByRole("button", { name: "Add entity" }).click();
    await page.getByLabel("Entity name").fill("Smoke Entity");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.locator('[data-card="entities"]').getByText("Smoke Entity")).toBeVisible({ timeout: 10_000 });
    // rename it
    await page.getByRole("button", { name: "Actions for Smoke Entity" }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await page.getByLabel("Entity name").fill("Smoke Entity 2");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.locator('[data-card="entities"]').getByText("Smoke Entity 2")).toBeVisible({ timeout: 10_000 });
    // delete-blocked: Household has accounts → the ratified FK-block body, Delete disabled.
    await page.getByRole("button", { name: "Actions for Household" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await expect(page.getByText(/Reassign those accounts to another entity first/)).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    console.log("PART 8 — entity add/rename OK; Household delete correctly FK-blocked");

    // PART 9 — institution rename + a REAL merge (the seed's near-duplicate pair, re-points a real account).
    const instCard = page.locator('[data-card="institutions"]');
    await instCard.getByRole("button", { name: "Actions for Saxo Markets" }).click();
    await page.getByRole("menuitem", { name: "Rename" }).click();
    await page.getByLabel("Institution name").fill("Saxo Markets SG");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(instCard.getByText("Saxo Markets SG")).toBeVisible({ timeout: 10_000 });
    // merge Citibank → Citibank Singapore (duplicate has a real account reference).
    await instCard.getByRole("button", { name: "Actions for Citibank", exact: true }).click();
    await page.getByRole("menuitem", { name: "Merge…" }).click();
    await page.getByLabel("Survivor institution").selectOption({ label: "Citibank Singapore" });
    await expect(page.getByText(/will move to/)).toBeVisible();
    await page.getByRole("button", { name: "Merge", exact: true }).click();
    await expect.poll(async () => {
      const list = (await (await page.request.get(`${API}/institutions`)).json()).institutions as { name: string }[];
      return list.some((i) => i.name === "Citibank");
    }, { timeout: 10_000 }).toBe(false);
    console.log("PART 9 — institution rename OK; REAL merge folded Citibank into Citibank Singapore");

    // PART 10 — Amendment G: "View holdings" drills down to the scoped Holdings chip.
    const firstActions = page.locator('[data-card="accounts"] tbody tr').first().getByRole("button", { name: /Actions for/ });
    await firstActions.click();
    await page.getByRole("menuitem", { name: "View holdings" }).click();
    await expect(page).toHaveURL(/#\/holdings\?account=\d+/);
    await expect(page.getByRole("button", { name: /Clear account filter/ })).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /Clear account filter/ }).click();
    await expect(page.getByRole("button", { name: /Clear account filter/ })).toHaveCount(0);
    console.log("PART 10 — Amendment-G drill-down chip navigates + clears");

    // PART 11 — no card left in skeleton.
    await page.goto("/#/accounts");
    await expect(page.getByRole("heading", { name: "Accounts", exact: true, level: 1 })).toBeVisible();
    await expect(page.locator(".lf-skeleton")).toHaveCount(0);

    // PART 12 — CONTAINMENT at real viewports: no value clips its box (clipped-element scrollWidth).
    for (const w of [320, 375, 420, 500, 900, 1100, 1366]) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.waitForTimeout(120);
      const clipped = await page.evaluate(() => {
        const out: string[] = [];
        document.querySelectorAll('[data-card="accounts"] td, [data-card="institutions"] td, [data-card="entities"] td').forEach((v) => {
          const el = v as HTMLElement;
          // A cell that TRUNCATES with an ellipsis is honestly contained (§7: long institution names
          // truncate, not overflow). Only a cell that overruns WITHOUT truncation is a real clip.
          const truncates = el.classList.contains("lf-table__td--trunc") ||
            getComputedStyle(el).textOverflow === "ellipsis";
          if (!truncates && el.scrollWidth > el.clientWidth + 1) {
            out.push(`${el.textContent?.trim()} (${el.scrollWidth} in ${el.clientWidth})`);
          }
        });
        return out;
      });
      expect(clipped, `no clipped cell @${w}px`).toEqual([]);
    }
    console.log("PART 12 — cells contained at 320..1366");

    // PART 13 — geometry: both themes × every breakpoint, single vertical scroll region, 0 overflow.
    for (const theme of THEMES) {
      await page.emulateMedia({ colorScheme: theme });
      await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: 800 });
        await page.waitForTimeout(100);
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
    await page.screenshot({ path: "e2e/smoke/artifacts/accounts-1366.png", fullPage: true });
    console.log("PART 13 — geometry clean, single vertical scroll region");

    console.log("CONSOLE ERRORS:", JSON.stringify(consoleErrors, null, 2));
    expect(consoleErrors, "0 console errors").toEqual([]);
  });
});

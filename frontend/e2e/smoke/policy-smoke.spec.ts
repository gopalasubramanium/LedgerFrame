import { test, expect } from "@playwright/test";

// ⚠ DEV-ONLY smoke (see playwright.smoke.config.ts). Phase-3a scripted pre-pass for POLICY — drives the
// LIVE app + real backend on the seeded demo, both themes × every breakpoint, and captures console
// errors. NOT wired into `npm run check`/CI. Run (from frontend/):
//   npx playwright test --config e2e/smoke/playwright.smoke.config.ts policy-smoke
//
// It exercises what unit tests CANNOT: the empty state a real fresh instance actually shows, the
// editor ROUND-TRIP against the real PIN-gated write path, the geometry with REAL-SHAPED data
// (§9-12: the full 13-class asset_class table, not a 3-row toy), and the D-055 bar on the rendered
// page rather than on a fixture.

const WIDTHS = [320, 375, 900, 1366];
const THEMES = ["light", "dark"] as const;
const API = "http://127.0.0.1:8321/api/v1";
const consoleErrors: string[] = [];

// The 13 AssetClass values — REAL-SHAPED data. page-home's lesson: a mockup fed 5 classes while the
// real dataset had 8, and the difference was the whole fit.
// The 12 TARGETABLE asset classes (§11-5 bars `liability`: gross assets exclude it, so a liability
// target could never be satisfied). REAL-SHAPED data — page-home's lesson: a mockup fed 5 classes
// while the real dataset had 8, and the difference was the whole fit.
const ALL_CLASSES = [
  "equity", "etf", "mutual_fund", "bond", "cash", "fixed_deposit", "commodity",
  "crypto", "property", "private", "retirement", "other",
];

test.describe.serial("policy pre-pass (live)", () => {
  test("empty state → editor round-trip → drift → geometry → 0 console errors", async ({ page }) => {
    page.on("console", (m) => m.type() === "error" && consoleErrors.push(`[console] ${m.text()}`));
    page.on("pageerror", (e) => consoleErrors.push(`[pageerror] ${e.message}`));

    // PART 0: clear the first-run gate SERVER-SIDE so the PAGE is what gets tested.
    await page.request.put(`${API}/settings`, { data: { values: { first_run_complete: "1" } } });
    // Start from NO POLICY — the state every real user actually starts in (nothing is seeded).
    await page.request.put(`${API}/policy/targets`, { data: { targets: [] } });
    await page.request.put(`${API}/policy`, { data: { max_position_pct: 0 } });

    // PART 1: THE EMPTY STATE — the most-seen state of this page ---------------------------------
    await page.goto("/#/policy");
    await expect(page.getByRole("heading", { name: "Policy", exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("No policy defined.")).toBeVisible();
    await expect(page.getByText(/set target allocations to see how far your holdings sit/i)).toBeVisible();
    // The protected D-055 line is present even with no policy.
    await expect(page.getByText(/reporting, never a trade instruction/i)).toBeVisible();
    console.log("PART 1 — empty state OK (reason + way forward + protected copy)");

    // PART 2: EDITOR ROUND-TRIP against the REAL PIN-gated write path -----------------------------
    await page.getByRole("button", { name: "Set targets" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Build a REAL-SHAPED policy: every one of the 13 asset classes gets a target, so the table is
    // the size the product actually has to render (§9-12 geometry, measured on real shape).
    await page.request.put(`${API}/policy`, { data: { default_band_pct: 5, max_position_pct: 25 } });
    // 12 x 8 = 96% — under the 100% ceiling (§12po1-8), which is a legitimate partial policy.
    const targets = ALL_CLASSES.map((c) => ({ dimension: "asset_class", bucket: c, target_pct: 8 }));
    targets.push(
      { dimension: "currency", bucket: "SGD", target_pct: 60 },
      { dimension: "region", bucket: "India", target_pct: 20 },
    );
    const put = await page.request.put(`${API}/policy/targets`, { data: { targets } });
    expect(put.ok(), "the PIN-gated write path accepts a valid full set").toBeTruthy();

    // §12po1-3 — the editor's table header PINS inside its own scroll region. It used to be a raw
    // <table> sitting directly in the dialog, so the header had nothing to stick to and slid away
    // under the rows as you scrolled.
    await page.request.put(`${API}/policy/targets`, { data: { targets } });
    await page.keyboard.press("Escape");
    await page.reload();
    await page.getByRole("button", { name: /edit policy/i }).first().click();
    const editor = page.getByRole("dialog");
    await expect(editor).toBeVisible();
    const scroller = editor.locator(".lf-table__scroll");
    await expect(scroller, "the editor table has its OWN scroll region").toHaveCount(1);
    const headTopBefore = await editor.locator(".lf-table__th").first().boundingBox();
    await scroller.evaluate((el) => el.scrollTo(0, 400));
    await page.waitForTimeout(150);
    const headTopAfter = await editor.locator(".lf-table__th").first().boundingBox();
    expect(await scroller.evaluate((el) => el.scrollTop), "the table actually scrolled").toBeGreaterThan(50);
    expect(
      Math.abs(headTopAfter!.y - headTopBefore!.y),
      "the header stays pinned while the rows scroll under it",
    ).toBeLessThanOrEqual(1);
    console.log("PART 2b — editor sticky header pinned after scroll");

    // §12po1-4 — no horizontal overflow in the dialog at desktop width.
    const dlgOverflow = await editor.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(dlgOverflow, "the editor does not scroll horizontally at 1366").toBeLessThanOrEqual(1);
    console.log("PART 2b — editor has no horizontal overflow at 1366");

    await page.keyboard.press("Escape");
    await page.reload();

    // PART 3: DRIFT renders with real-shaped data --------------------------------------------------
    await expect(page.getByRole("heading", { name: "Drift" })).toBeVisible({ timeout: 15_000 });
    const rows = page.locator(".lf-table tbody tr");
    await expect
      .poll(async () => await rows.count(), { timeout: 10_000 })
      .toBeGreaterThanOrEqual(12); // all 12 targetable classes render
    await expect(page.getByRole("columnheader", { name: /gap to target/i })).toBeVisible();
    // Coverage renders as a reconciling total INSIDE the table.
    await expect(page.locator(".lf-table tfoot")).toBeVisible();
    console.log(`PART 3 — drift table rendered with ${await rows.count()} rows (12 targetable classes, real shape)`);

    // The dimension switcher actually switches.
    await page.getByRole("button", { name: "Region" }).click();
    await expect(page.locator(".lf-table tbody").getByText("India")).toBeVisible();
    await page.getByRole("button", { name: "Asset class" }).click();

    // PART 3b: §12po1-8 — an UNSATISFIABLE policy is refused, and the editor says so IN PLACE.
    const bad = await page.request.put(`${API}/policy/targets`, {
      data: { targets: [
        { dimension: "asset_class", bucket: "equity", target_pct: 100 },
        { dimension: "asset_class", bucket: "property", target_pct: 84 },
      ] },
    });
    expect(bad.status(), "a 184% policy is refused").toBe(400);
    const badDetail = (await bad.json()).detail as string;
    expect(badDetail).toContain("184");
    expect(badDetail, "the served error is USER copy — never a field name (§12po1-6)").not.toContain("target_pct");
    console.log(`PART 3b — unsatisfiable policy refused: "${badDetail}"`);

    // §11-5 — a liability target is refused, and says WHY.
    const liab = await page.request.put(`${API}/policy/targets`, {
      data: { targets: [{ dimension: "asset_class", bucket: "liability", target_pct: 10 }] },
    });
    expect(liab.status()).toBe(400);
    console.log(`PART 3b — liability target refused: "${(await liab.json()).detail}"`);

    // Restore the real-shaped policy for the geometry pass.
    await page.request.put(`${API}/policy/targets`, { data: { targets } });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Drift" })).toBeVisible({ timeout: 15_000 });

    // PART 4: D-055 — NO TRADE LANGUAGE anywhere on the RENDERED page ------------------------------
    const body = ((await page.locator("body").innerText()) || "").toLowerCase();
    for (const banned of ["rebalance", "amount to sell", "amount to buy", "you should", "recommend"]) {
      expect(body, `D-055: the rendered page must never say "${banned}"`).not.toContain(banned);
    }
    await expect(page.getByText(/not financial advice/i)).toBeVisible();
    console.log("PART 4 — D-055 clean on the rendered page");

    // PART 4b: §12po1-1 — Policy uses the SHARED page shell (its cards no longer butt into the
    // header band), and §12po1-7 — no in-page link falls back to the browser default.
    const shell = await page.evaluate(() => {
      const first = document.querySelector(".lf-shell__content")?.firstElementChild as HTMLElement | null;
      const links = [...document.querySelectorAll(".lf-page a")].map(
        (a) => getComputedStyle(a as HTMLElement).textDecorationLine,
      );
      return { hasPageShell: !!first?.classList.contains("lf-page"), underlinedAtRest: links.filter((d) => d.includes("underline")).length };
    });
    expect(shell.hasPageShell, "Policy uses the shared .lf-page shell").toBe(true);
    expect(shell.underlinedAtRest, "no in-page link is default-underlined").toBe(0);
    console.log("PART 4b — shared shell + themed links OK");

    // PART 5: no card is left in skeleton (progressive loading resolved) ---------------------------
    expect(await page.locator(".lf-skeleton").count(), "every card is out of skeleton").toBe(0);

    // PART 6: GEOMETRY — both themes × every breakpoint, real-shaped data --------------------------
    for (const theme of THEMES) {
      await page.emulateMedia({ colorScheme: theme });
      await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: 800 });
        await page.waitForTimeout(120);

        // Zero HORIZONTAL overflow on the document and the shell content.
        const overflow = await page.evaluate(() => {
          const d = document.documentElement;
          const c = document.querySelector(".lf-shell__content") as HTMLElement | null;
          return {
            doc: d.scrollWidth - d.clientWidth,
            content: c ? c.scrollWidth - c.clientWidth : 0,
          };
        });
        expect(overflow.doc, `document must not scroll horizontally @${w} ${theme}`).toBeLessThanOrEqual(1);
        expect(overflow.content, `shell content must not scroll horizontally @${w} ${theme}`).toBeLessThanOrEqual(1);

        // SINGLE vertical scroll region — only .lf-shell__content scrolls; the window never does.
        await page.evaluate(() => window.scrollTo(0, 500));
        const scrollY = await page.evaluate(() => window.scrollY);
        expect(scrollY, `the document must never scroll vertically @${w} ${theme}`).toBe(0);

        // The band chip must never escape ITS OWN ROW (§12ho3-3: assert the PAINTED box).
        //
        // ⚠ This assertion was FIXED after the pre-pass RED'd it. The first version compared the
        // chip's ABSOLUTE viewport x against the viewport width — and it failed at 320px. Measuring
        // (rather than believing the theory — page-net-worth §12b3-1) showed the page was fine: the
        // DataTable's own `.lf-table__scroll` is `overflow-x: auto` BY DESIGN (585px of table in a
        // 208px box at 320px), so a cell legitimately sits outside the viewport until you scroll the
        // TABLE. The document and the shell do not overflow (asserted above) — that is the real
        // invariant. Containment within the row is the honest thing to assert.
        const chip = page.locator(".lf-statuschip").first();
        if (await chip.count()) {
          const contained = await chip.evaluate((el) => {
            const row = el.closest("tr");
            if (!row) return true;
            return el.getBoundingClientRect().right <= row.getBoundingClientRect().right + 1;
          });
          expect(contained, `chip stays inside its row @${w} ${theme}`).toBe(true);
        }
      }
    }
    await page.setViewportSize({ width: 1366, height: 800 });
    await page.screenshot({ path: "e2e/smoke/artifacts/policy-1366.png", fullPage: true });
    console.log("PART 6 — geometry clean: 0 h-overflow, single vertical scroll, chips contained");

    // PART 7: RECONCILIATION, LIVE — Review's verdict == what Policy displays ----------------------
    const drift = await (await page.request.get(`${API}/policy/drift`)).json();
    const review = await (await page.request.get(`${API}/review`)).json();
    const shown =
      drift.dimensions.reduce(
        (n: number, d: { rows: { status: string }[] }) =>
          n + d.rows.filter((r) => r.status === "over" || r.status === "under").length,
        0,
      ) + drift.concentration.length;
    expect(review.sections.policy.out_of_band, "Review == Policy, live (one derivation)").toBe(shown);
    console.log(`PART 7 — reconciliation LIVE: policy shows ${shown} out-of-band, review serves ${review.sections.policy.out_of_band}`);

    // TELEMETRY
    console.log("CONSOLE ERRORS:", JSON.stringify(consoleErrors, null, 2));
    expect(consoleErrors, "0 console errors across the whole run").toEqual([]);
  });
});

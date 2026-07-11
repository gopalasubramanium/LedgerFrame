import { test, expect } from "@playwright/test";

// ⚠ DEV-ONLY smoke (see playwright.smoke.config.ts). Phase-3a scripted pre-pass for the
// Portfolio page — drives the LIVE app + real backend on the seeded demo data, checks the
// POPULATED page (data + controls + overflow), and captures console errors. NOT wired into
// `npm run check` / CI. Assumes both dev servers live and the demo seed present. Run:
//   npx playwright test --config e2e/smoke/portfolio-smoke.spec.ts   (from frontend/)

const WIDTHS = [320, 375, 900, 1366];
const consoleErrors: string[] = [];

test.describe.serial("portfolio pre-pass (live)", () => {
  test("drive the populated /portfolio + assert data, controls, overflow, 0 errors", async ({ page }) => {
    page.on("console", (m) => m.type() === "error" && consoleErrors.push(`[console] ${m.text()}`));
    page.on("pageerror", (e) => consoleErrors.push(`[pageerror] ${e.message}`));

    // --- PART 0: clear the first-run gate SERVER-SIDE so the page (not the overlay) is tested.
    await page.request.put("http://127.0.0.1:8321/api/v1/settings", {
      data: { values: { first_run_complete: "1" } },
    });

    // --- PART 1: page + stat rail populated ------------------------------------------------
    await page.goto("/#/portfolio");
    await expect(page.getByRole("heading", { name: "Portfolio", exact: true })).toBeVisible({ timeout: 15_000 });
    for (const label of ["Today's change", "Unrealised P/L", "Cost basis", "Total return", "Time-weighted return (TWR)"]) {
      await expect(page.locator(".pf__rail").getByText(label, { exact: true }).first()).toBeVisible();
    }
    // ND-12: realised rail uses the SERVED report year, never "YTD".
    const realisedLabel = await page.getByText(/Realised P\/L · /).first().innerText();
    console.log("PART 1 — realised label:", JSON.stringify(realisedLabel));
    expect(realisedLabel).not.toContain("YTD");
    expect(realisedLabel).toMatch(/Realised P\/L · \d{4}/);

    // --- PART 2: allocation donuts + D-082 bucket + excluded-liabilities footnote ----------
    const donutSegs = await page.locator(".lf-donut__legend .lf-donut__row").count();
    console.log("PART 2 — donut legend rows (all donuts):", donutSegs);
    expect(donutSegs, "allocation donuts render segments").toBeGreaterThan(0);
    await expect(page.getByText("Unclassified sector").first()).toBeVisible(); // D-082
    // §12-4: the excluded-liabilities footnote is stated ONCE at the section bottom, asterisk-marked.
    const footnote = (await page.getByText(/^\*\s*Liabilities .* excluded/).first().textContent()) ?? "";
    console.log("PART 2 — liabilities footnote:", JSON.stringify(footnote.trim()));
    expect(footnote).toMatch(/Liabilities .* excluded/);
    expect(await page.locator(".lf-donut__footnote").count(), "footnote is section-level, not per-donut").toBe(0);
    expect(await page.locator(".pf__marker").count(), "affected donuts carry the * marker").toBeGreaterThanOrEqual(3);

    // --- PART 3: Contributors/Detractors — today (never Gainers/Losers) ---------------------
    await expect(page.getByRole("heading", { name: "Contributors — today", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Detractors — today", exact: true })).toBeVisible();
    expect(await page.getByText(/Gainers|Losers/).count(), "no Gainers/Losers wording").toBe(0);

    // --- PART 4: performance chart + controls (benchmark, window, include_manual) -----------
    // Wait for the performance card to resolve out of its skeleton (progressive loading, §12-8).
    await expect(page.locator(".lf-pricechart__cmp").first()).toBeVisible({ timeout: 15_000 }); // shared-axis benchmark line
    // Window + include_manual on the default benchmark (SPY, which has demo history) → line stays.
    await page.getByRole("combobox", { name: "Time window" }).selectOption("3M");
    await page.waitForTimeout(500);
    const sw = page.getByRole("switch", { name: "Include manual assets" });
    await sw.scrollIntoViewIfNeeded();
    await sw.click(); // toggle on
    await expect(sw).toHaveAttribute("aria-checked", "true"); // the toggle actually flipped (functional)
    await page.waitForTimeout(500);
    await expect(page.locator(".lf-pricechart__line").first()).toBeVisible(); // portfolio line still drawn
    // Switching benchmark to one WITHOUT demo history must degrade HONESTLY (line OR EmptyState),
    // never a crash or a fabricated curve (Guarantee 3).
    await page.getByRole("combobox", { name: "Benchmark" }).selectOption("QQQ");
    const perfCard = page.locator(".pf__card").filter({ hasText: "Performance" });
    // Wait for the card to resolve out of its (re-)skeleton, then it must show a line OR an
    // honest EmptyState — never a crash or a fabricated curve (Guarantee 3).
    await expect(perfCard.locator(".lf-pricechart__line, .lf-empty").first()).toBeVisible({ timeout: 15_000 });
    const chartOk = await perfCard.locator(".lf-pricechart__line, .lf-empty").count();
    console.log("PART 4 — after benchmark switch, chart shows line-or-honest-empty:", chartOk > 0);
    expect(chartOk, "chart degrades honestly on a no-history benchmark").toBeGreaterThan(0);

    // --- PART 5: attribution residual + concentration HHI ----------------------------------
    await expect(page.getByText(/Residual \(income, realised, closed\)/)).toBeVisible();
    await expect(page.getByText("Headline return")).toBeVisible();
    await expect(page.getByText("HHI")).toBeVisible();
    await expect(page.getByText(/Explicitly NOT a Sharpe ratio/)).toBeVisible(); // D-030 verbatim

    // --- PART 6: costs — two blocks -------------------------------------------------------
    await expect(page.getByText("Recorded fees")).toBeVisible();
    await expect(page.getByText("Ongoing cost (expense ratio)")).toBeVisible();

    // --- PART 6b: batch-2 — page-action icon, attribution export, donut hover, no skeletons ---
    // §12: "Manage holdings" is an icon-only page-action (aria-label, no visible text label).
    await expect(page.getByRole("link", { name: "Manage holdings" })).toBeVisible();
    // §12-6: attribution has the ratified Export CSV + a filter input (DataTable).
    await expect(page.getByRole("button", { name: "Export CSV" })).toBeVisible();
    await expect(page.getByPlaceholder("Filter holdings…")).toBeVisible();
    // §12-7: donut segment hover activates the segment + shows the label · value · pct readout.
    const firstLegendRow = page.locator(".lf-donut__row").first();
    await firstLegendRow.scrollIntoViewIfNeeded();
    await firstLegendRow.hover();
    await expect(firstLegendRow).toHaveClass(/is-active/);
    const tip = (await page.locator(".lf-donut__tip").first().textContent()) ?? "";
    console.log("PART 6b — donut hover readout:", JSON.stringify(tip.trim()));
    expect(tip.trim().length, "donut hover shows a readout").toBeGreaterThan(0);
    // §12-8: progressive loading — every card has resolved OUT of skeleton by now.
    expect(await page.locator(".lf-skeleton").count(), "no card stuck in skeleton").toBe(0);

    // --- PART 7: NO horizontal overflow on the POPULATED page at every breakpoint ----------
    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme });
      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: 900 });
        await page.waitForTimeout(150);
        const over = await page.evaluate(() => {
          const doc = document.documentElement;
          const content = document.querySelector(".lf-shell__content");
          return { doc: doc.scrollWidth - doc.clientWidth, content: content ? content.scrollWidth - content.clientWidth : 0 };
        });
        if (over.content > 1) {
          const wide = await page.evaluate(() => {
            const content = document.querySelector(".lf-shell__content") as HTMLElement;
            const cw = content.clientWidth;
            let worst = { sel: "", over: 0 };
            content.querySelectorAll("*").forEach((el) => {
              const over = (el as HTMLElement).scrollWidth - (el as HTMLElement).clientWidth;
              if (over > worst.over) worst = { sel: `${el.tagName}.${(el as HTMLElement).className}`, over };
            });
            const cr = content.getBoundingClientRect();
            const edge = cr.left + cw;
            const stick: string[] = [];
            content.querySelectorAll("*").forEach((el) => {
              const r = el.getBoundingClientRect();
              if (r.right > edge + 1 && (el as HTMLElement).className !== "pf__scroll") stick.push(`${el.tagName}.${(el as HTMLElement).className}=${Math.round(r.right)}(edge ${Math.round(edge)})`);
            });
            return { contentClientW: cw, worstOverflow: worst, sticking: stick.slice(0, 6) };
          });
          console.log(`PART 7 — DIAG at ${theme} ${w}px:`, JSON.stringify(wide));
        }
        console.log(`PART 7 — overflow ${theme} ${w}px:`, JSON.stringify(over));
        expect(over.doc, `doc overflow ${theme} ${w}`).toBeLessThanOrEqual(1);
        expect(over.content, `content overflow ${theme} ${w}`).toBeLessThanOrEqual(1);
      }
    }

    console.log("\n===== CONSOLE ERRORS (" + consoleErrors.length + ") =====\n" + (consoleErrors.join("\n") || "(none)") + "\n===== END =====\n");
    expect(consoleErrors, "zero console errors on the populated page").toHaveLength(0);
  });
});

import { test, expect } from "@playwright/test";

// ⚠ DEV-ONLY smoke (see playwright.smoke.config.ts). Phase-3a scripted pre-pass for Home — drives the
// LIVE app + real backend on seeded demo, across BOTH LAYOUTS × both themes × every breakpoint. It
// flips the layout the ONLY way the product can (the served `home_layout` setting — there is no
// on-page switch, §9-2a), checks the composition per layout, proves the reconciliations Home only
// summarises, and captures console errors. NOT wired into `npm run check`/CI. Run:
//   npx playwright test --config e2e/smoke/playwright.smoke.config.ts home-smoke

const WIDTHS = [320, 375, 900, 1366];
const API = "http://127.0.0.1:8321/api/v1";
const consoleErrors: string[] = [];

// The §8 WALK COMMAND — the owner flips the layout live with exactly this (there is no UI switch
// until Settings ships, §9-2a):
//   curl -X PUT http://127.0.0.1:8321/api/v1/settings \
//        -H 'Content-Type: application/json' \
//        -d '{"values":{"home_layout":"simple"}}'      # or "full"
const FULL_CARDS = ["headline", "performance", "allocation", "movers", "review", "briefing", "quotes"];
const SIMPLE_CARDS = ["headline", "review", "briefing"];
const FULL_ONLY = ["performance", "allocation", "movers", "quotes"];

test.describe.serial("home pre-pass (live)", () => {
  test("drive BOTH layouts × both themes × all breakpoints; reconcile; 0 errors", async ({ page }) => {
    page.on("console", (m) => m.type() === "error" && consoleErrors.push(`[console] ${m.text()}`));
    page.on("pageerror", (e) => consoleErrors.push(`[pageerror] ${e.message}`));

    // PART 0: clear the first-run gate SERVER-SIDE so the page (not the overlay) is tested.
    await page.request.put(`${API}/settings`, { data: { values: { first_run_complete: "1" } } });

    // PART 1: the SERVED default layout is FULL (§9-3) ---------------------------------------------
    const defaults = (await (await page.request.get(`${API}/settings`)).json()).defaults;
    console.log("PART 1 — served defaults:", JSON.stringify({ home_layout: defaults.home_layout, home_quote_source: defaults.home_quote_source }));
    expect(defaults.home_layout, "fresh-install default layout is FULL (§9-3)").toBe("full");
    expect(defaults.home_quote_source, "default quote source is HOLDINGS (§9-7)").toBe("holdings");

    // PART 2: the retired aggregate is GONE (§9-4) — a 404, not an SPA page with 200 ----------------
    const dead = await page.request.get(`${API}/dashboard/home`);
    console.log("PART 2 — GET /dashboard/home →", dead.status());
    expect(dead.status(), "/dashboard/home is RETIRED (§9-4)").toBe(404);

    // PART 3: FULL layout — the whole D-046 set, each card out of skeleton -------------------------
    // Capture the payloads the PAGE ITSELF receives. Reconciling the rendered DOM against a LATER
    // API call is racy on a live system: the refresh worker can clear a stale-driven review item
    // between the page's fetch and ours, and the "mismatch" would be our clock, not a defect. So we
    // compare the DOM to the response THIS page rendered from.
    let pageReview: { count: number } | null = null;
    let pageSummary: { stale_count: number } | null = null;
    page.on("response", async (r) => {
      try {
        if (r.url().endsWith("/api/v1/portfolio/review")) pageReview = await r.json();
        if (r.url().endsWith("/api/v1/portfolio/summary")) pageSummary = await r.json();
      } catch { /* a non-JSON/aborted response is not our concern */ }
    });

    await page.request.put(`${API}/settings`, { data: { values: { home_layout: "full" } } });
    await page.goto("/#/");
    await expect(page.getByRole("heading", { name: "Home", exact: true })).toBeVisible({ timeout: 15_000 });
    for (const card of FULL_CARDS) {
      await expect(page.locator(`[data-card="${card}"]`), `FULL renders the ${card} card`).toBeVisible({ timeout: 15_000 });
    }
    await expect(page.locator(".lf-skeleton"), "no card left in skeleton").toHaveCount(0, { timeout: 20_000 });
    console.log("PART 3 — FULL: all 7 D-046 cards rendered, none left in skeleton");

    // NO page-level ticker (D-047 AMENDMENT): the strip belongs to the chrome footer, once.
    const tickers = await page.locator(".lf-ticker").count();
    const inHome = await page.locator(".hm2 .lf-ticker").count();
    console.log("PART 3 — tickers on the page:", tickers, "| inside Home:", inHome);
    expect(inHome, "Home renders NO ticker of its own (D-047 AMENDMENT)").toBe(0);

    // PART 4: RECONCILIATION — Home only summarises; the counts are the readers' -------------------
    // (a) The two review readers agree BY CONSTRUCTION (same service) — fetched back-to-back.
    const review = await (await page.request.get(`${API}/portfolio/review`)).json();
    const reviewPage = await (await page.request.get(`${API}/review`)).json();
    console.log("PART 4 — readers: /portfolio/review =", review.count, "| /review =", reviewPage.attention_count);
    expect(review.count, "Home's reader and the Review page's reader agree BY CONSTRUCTION").toBe(reviewPage.attention_count);

    // (b) Home RENDERS the count it was served — compared against the page's OWN response, not a
    // later one (see the note in PART 3: the worker can legitimately change the count in between).
    const shown = await page.locator(".lf-review__attention").textContent();
    console.log("PART 4 — the page was served:", pageReview?.count, "| Home shows:", JSON.stringify(shown));
    expect(pageReview, "the page fetched the review reader").not.toBeNull();
    if ((pageReview!.count ?? 0) > 0) {
      expect(shown, "Home renders the SERVED count, never a recount").toContain(String(pageReview!.count));
    }
    // (c) Staleness: the chrome owns the ONE shared count; Home's headline note must echo the SERVED
    // stale_count from the response the page itself rendered — never a second, recomputed number.
    const homeStale = await page.locator('[data-card="headline"] .hm2__note').textContent();
    console.log("PART 4 — the page was served stale_count:", pageSummary?.stale_count, "| headline note:", JSON.stringify(homeStale?.trim()));
    if ((pageSummary?.stale_count ?? 0) > 0) {
      expect(homeStale, "the stale count Home shows is the SERVED one").toContain(String(pageSummary!.stale_count));
    }

    // PART 4b: §12ho1-1 — NO governance-speak in the rendered copy; §12ho1-2 — every linked summary
    // carries the corner ↗ affordance (no page-local text-link variants). ---------------------------
    const copy = (await page.locator(".hm2").innerText()).replace(/\s+/g, " ");
    const leaks = ["canonical", "owned by", "the reader", "readers"].filter((w) => copy.toLowerCase().includes(w));
    console.log("PART 4b — governance-speak in Home's copy:", JSON.stringify(leaks));
    expect(leaks, "no internal governance vocabulary in user copy (§12ho1-1)").toEqual([]);

    const textLinks = await page.locator(".hm2__link").count();
    const arrows = await page.locator(".hm2 .lf-summarylink").count();
    const labelled = await page.locator(".hm2 .lf-summarylink[aria-label]").count();
    console.log("PART 4b — legacy text links:", textLinks, "| ↗ affordances:", arrows, "| with aria-label:", labelled);
    expect(textLinks, "no text-link variants remain (§12ho1-2)").toBe(0);
    expect(arrows, "every linked summary carries the ↗ affordance").toBeGreaterThanOrEqual(5);
    expect(labelled, "each ↗ names its destination for screen readers").toBe(arrows);
    // Keyboard-operable: the affordance is a real link, focusable.
    await page.locator(".hm2 .lf-summarylink").first().focus();
    expect(await page.evaluate(() => document.activeElement?.classList.contains("lf-summarylink")), "the ↗ is keyboard focusable").toBe(true);

    // PART 5: D-024 — both movers pairs, under their OWN labels, never interchanged ----------------
    for (const label of ["Contributors — today", "Detractors — today", "Gainers — today", "Losers — today"]) {
      await expect(page.getByText(label, { exact: true }), `${label} is present`).toBeVisible();
    }
    console.log("PART 5 — both movers pairs present under their canonical labels (D-024)");

    // PART 6: the quote-card SOURCE SELECT works across all four served sources (§9-7) -------------
    for (const src of ["Markets", "Holdings", "Global", "Watchlist"]) {
      await page.getByLabel("Quote source").selectOption({ label: src });
      await page.waitForTimeout(400);
      const cards = await page.locator(".lf-quote").count();
      const empty = await page.locator('[data-card="quotes"] .lf-empty').count();
      console.log(`PART 6 — source ${src}: ${cards} quote cards${cards === 0 ? ` (honest empty: ${empty > 0})` : ""}`);
      // Either it quotes something, or it says honestly why not — never a blank card.
      expect(cards > 0 || empty > 0, `${src} either quotes or explains itself`).toBe(true);
    }

    // PART 7: [Help] targets (§9-12: Net worth · Today's change · Briefing) ------------------------
    const help = await page.locator(".hm2 .lf-term").count();
    console.log("PART 7 — [Help] terms on Home:", help);
    expect(help, "[Help] on Net worth, Today's change, Briefing").toBeGreaterThanOrEqual(3);

    // PART 8: SIMPLE layout — flipped the ONLY way the product allows (the served setting) ---------
    await page.request.put(`${API}/settings`, { data: { values: { home_layout: "simple" } } });
    await page.goto("/#/");
    await page.reload(); // a hash-route goto to the SAME url does not remount the SPA — force a re-read
    await expect(page.getByRole("heading", { name: "Home", exact: true })).toBeVisible({ timeout: 15_000 });
    for (const card of SIMPLE_CARDS) {
      await expect(page.locator(`[data-card="${card}"]`), `SIMPLE renders the ${card} card`).toBeVisible({ timeout: 15_000 });
    }
    for (const card of FULL_ONLY) {
      await expect(page.locator(`[data-card="${card}"]`), `SIMPLE must NOT render the ${card} card`).toHaveCount(0);
    }
    await expect(page.locator(".lf-skeleton"), "no card left in skeleton (simple)").toHaveCount(0, { timeout: 20_000 });
    console.log("PART 8 — SIMPLE: headline + ReviewCard + briefing only; the Full-only cards are ABSENT");

    // PART 9: single scroll + 0 overflow — BOTH layouts × both themes × every breakpoint -----------
    for (const layout of ["full", "simple"] as const) {
      await page.request.put(`${API}/settings`, { data: { values: { home_layout: layout } } });
      await page.goto("/#/");
      await page.reload(); // re-read the served layout (see PART 8)
      await expect(page.getByRole("heading", { name: "Home", exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(page.locator(".lf-skeleton")).toHaveCount(0, { timeout: 20_000 });

      await page.setViewportSize({ width: 1366, height: 1000 });
      await page.waitForTimeout(120);
      const winScrolled = await page.evaluate(() => {
        window.scrollTo(0, 5000);
        const y = window.scrollY;
        window.scrollTo(0, 0);
        return y;
      });
      console.log(`PART 9 — ${layout}: window scrolled (must be 0):`, winScrolled);
      expect(winScrolled, `document must not scroll — one region (${layout})`).toBeLessThanOrEqual(1);

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
          console.log(`PART 9 — overflow ${layout} ${theme} ${w}px:`, JSON.stringify(over));
          expect(over.doc, `doc overflow ${layout} ${theme} ${w}`).toBeLessThanOrEqual(1);
          expect(over.content, `content overflow ${layout} ${theme} ${w}`).toBeLessThanOrEqual(1);
        }
      }
      await page.emulateMedia({ colorScheme: "light" });
    }

    // Restore the served default so the next session starts clean.
    await page.request.put(`${API}/settings`, { data: { values: { home_layout: "full" } } });

    console.log("\n===== CONSOLE ERRORS (" + consoleErrors.length + ") =====\n" + (consoleErrors.join("\n") || "(none)") + "\n===== END =====");
    expect(consoleErrors, "zero console errors across both layouts").toHaveLength(0);
  });
});

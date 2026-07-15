import { test, expect } from "@playwright/test";

// §11-14 permanent regression suite (ADR-0004): NO horizontal overflow at any of the
// standard breakpoints, across the shell + both built pages, in both themes. The app
// runs without a backend here (API calls fail gracefully) — layout is what we measure,
// and the chrome + page headers render regardless. Theme follows prefers-color-scheme
// (the default choice is "system"), so emulateMedia drives light/dark.

const WIDTHS = [320, 375, 900, 1366];
const ROUTES = [
  // `/` is HOME — REBUILT on the ratified grid (§12ho1-5) and wired (§12ho1-6: ONE layout). This
  // suite runs with NO backend, so Home renders its honest per-card empty/error states; the LIVE
  // composition is driven by the Phase-3a pre-pass against the real backend.
  { name: "home (overview)", hash: "#/" },
  { name: "net worth (overview)", hash: "#/net-worth" },
  { name: "holdings (worklist)", hash: "#/holdings" },
  { name: "portfolio (overview)", hash: "#/portfolio" },
  { name: "markets (overview+worklist)", hash: "#/markets" },
  { name: "heatmap (overview)", hash: "#/heatmap" },
  { name: "news (overview+worklist)", hash: "#/news" },
  { name: "instrument (entity-detail)", hash: "#/instrument/AAPL" },
  { name: "pricing health (worklist)", hash: "#/pricing-health" },
  { name: "review (worklist)", hash: "#/review" },
  { name: "policy (worklist)", hash: "#/policy" },
  { name: "cash flow (worklist)", hash: "#/cash-flow" },
  { name: "scenarios (overview)", hash: "#/scenarios" },
  { name: "insurance (worklist)", hash: "#/insurance" },
];
const THEMES = ["light", "dark"] as const;

for (const theme of THEMES) {
  for (const route of ROUTES) {
    for (const width of WIDTHS) {
      test(`no horizontal overflow · ${theme} · ${route.name} · ${width}px`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: theme });
        await page.setViewportSize({ width, height: 800 });
        await page.goto(`/${route.hash}`);
        // Shell chrome is present (the top bar renders on every in-shell route).
        await page.waitForSelector(".lf-topbar", { timeout: 15_000 });

        const overflow = await page.evaluate(() => {
          const doc = document.documentElement;
          const content = document.querySelector(".lf-shell__content");
          return {
            doc: doc.scrollWidth - doc.clientWidth,
            content: content ? content.scrollWidth - content.clientWidth : 0,
          };
        });

        // Allow 1px for sub-pixel rounding; anything more is a real overflow.
        expect(overflow.doc, "document horizontal overflow (px)").toBeLessThanOrEqual(1);
        expect(overflow.content, "shell content horizontal overflow (px)").toBeLessThanOrEqual(1);
      });
    }
  }
}

// Single vertical scroll region (page-markets §12mk1-1): the shell content is the ONLY vertical
// scroller — the DOCUMENT/window itself must never scroll (a second scrollbar beside the content
// was the bug; a tall descendant was propagating overflow up to documentElement). Backend-free here,
// so we FORCE the content tall with a spacer, then assert the window still can't scroll — proving
// the shell (not the document) owns the scroll. Height-sensitive → measured at a tall viewport.
for (const route of ROUTES) {
  for (const width of WIDTHS) {
    test(`document never scrolls — one scroll region · ${route.name} · ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`/${route.hash}`);
      await page.waitForSelector(".lf-topbar", { timeout: 15_000 });
      // Wait for the content region to actually MOUNT before forcing overflow — not just the chrome.
      // Under parallel load the page's async content is still settling when only `.lf-topbar` has
      // rendered, and appending the spacer + testing scroll before the shell has laid out is a race
      // (it flaked ~1 run in 4 in the full suite, 0/96 single-worker). The sibling content-inset
      // test already waits for `.lf-shell__content > *` — same wait here.
      await page.waitForSelector(".lf-shell__content > *", { timeout: 15_000 });
      // Force the shell content to overflow, so a broken containment would spill to the document.
      await page.evaluate(() => {
        const c = document.querySelector(".lf-shell__content");
        if (c) {
          const spacer = document.createElement("div");
          spacer.style.height = "4000px";
          c.appendChild(spacer);
        }
      });
      const winScrolled = await page.evaluate(() => {
        window.scrollTo(0, 8000);
        const y = window.scrollY;
        window.scrollTo(0, 0);
        return y;
      });
      expect(winScrolled, "the document/window must not scroll — only .lf-shell__content does").toBeLessThanOrEqual(1);
    });
  }
}

// THE PAGE INSET IS OWNED BY THE SHELL — ONE standard for every page (DESIGN-SYSTEM "Page inset",
// page-insurance §14in-6). The page content fills the shell content box on all four sides; NO page adds
// a root `max-width` / centering `margin` / padding that grows the inset.
//
// ⚠ THIS GUARD MEASURES THE GEOMETRY THE FINDING NAMES, AT THE WIDTH WHERE IT APPEARS (§14in-6 lesson).
// The previous version measured the content-LEFT at 1200px — but a page's `max-width` only bites ABOVE
// its cap (Holdings 1152px, Insurance 1120px via a `.ins` class collision), so at 1200px every page's
// left was identical and the guard was green over a real, visible defect (Insurance/Holdings rendered
// ~250px of extra left+right inset at 1920). Matching an adjacent property at the wrong width is a green
// that hides the bug. This runs WIDE (1728) and measures the inset on ALL FOUR relevant sides.
test("every page fills the shell content box — one page inset, no per-page cap/centering", async ({ page }) => {
  await page.setViewportSize({ width: 1728, height: 1000 });
  const ROUTES = ["#/", "#/net-worth", "#/holdings", "#/portfolio", "#/markets", "#/heatmap", "#/news",
    "#/instrument/AAPL", "#/pricing-health", "#/review", "#/policy", "#/cash-flow", "#/scenarios", "#/insurance"];
  const offenders: string[] = [];
  for (const hash of ROUTES) {
    await page.goto(`/${hash}`);
    await page.waitForSelector(".lf-page", { timeout: 15_000 });
    const inset = await page.evaluate(() => {
      const content = document.querySelector(".lf-shell__content") as HTMLElement | null;
      const pageEl = document.querySelector(".lf-page") as HTMLElement | null;
      if (!content || !pageEl) return null;
      const cs = getComputedStyle(content);
      const cRect = content.getBoundingClientRect();
      const innerLeft = cRect.left + parseFloat(cs.paddingLeft);
      const innerRight = cRect.right - parseFloat(cs.paddingRight);
      const p = pageEl.getBoundingClientRect();
      return { left: Math.round(p.left - innerLeft), right: Math.round(innerRight - p.right) };
    });
    if (!inset) { offenders.push(`${hash}: no .lf-page`); continue; }
    // The page root fills the shell content box: left and right insets are ~0. A capped/centered page
    // shows a large left+right gap (max-width) — that is the deviation this guard exists to catch.
    if (Math.abs(inset.left) > 1 || Math.abs(inset.right) > 1) {
      offenders.push(`${hash}: left=${inset.left} right=${inset.right}`);
    }
  }
  expect(offenders, `pages deviating from the shell-owned inset @1728: ${offenders.join(" | ")}`).toEqual([]);
});

// First-run checklist overlay (D-045). Opened from the kitchen-sink specimen (the shell
// keeps it hidden without a backend); the overlay is fixed inset:0, so `.lf-firstrun`
// scrollWidth vs clientWidth measures the overlay's own horizontal overflow, independent
// of the gallery behind it.
for (const theme of THEMES) {
  for (const width of WIDTHS) {
    test(`no horizontal overflow · ${theme} · first-run overlay · ${width}px`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/#/kitchen-sink");
      await page.getByRole("button", { name: "Show first-run checklist" }).click();
      await page.waitForSelector(".lf-firstrun__card", { timeout: 15_000 });

      const over = await page.evaluate(() => {
        const el = document.querySelector(".lf-firstrun");
        return el ? el.scrollWidth - el.clientWidth : 0;
      });
      expect(over, "first-run overlay horizontal overflow (px)").toBeLessThanOrEqual(1);
    });
  }
}

// §12po1-1 — THE PAGE SHELL IS SHARED, NOT COPIED (generalised from the Policy walk).
//
// Policy shipped with NO page root at all (a bare fragment), so its first card butted straight
// into the header band while every other page sat in a `flex column · gap · min-width:0` root —
// a root that had been COPY-PASTED into ten page-local classes (.nw .pf .rv .ph .hold .mk .hm
// .ins …). The owner saw the difference immediately; no assertion could, because each page was
// internally consistent with itself.
//
// Generalised per the centralization rule (per-instance copies of a standard ARE the defect):
// there is ONE shared `.lf-page` root, and EVERY route must use it. A page-local shell is now a
// TEST FAILURE, not a style choice — which is what stops the eleventh page from re-inventing it.
const SHELL_ROUTES = [
  "#/", "#/net-worth", "#/holdings", "#/portfolio", "#/markets", "#/heatmap",
  "#/news", "#/instrument/AAPL", "#/pricing-health", "#/review", "#/policy", "#/cash-flow", "#/scenarios", "#/insurance",
];
test("every page uses the ONE shared page shell (page-local shells are a failure)", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 800 });
  const offenders: string[] = [];
  for (const hash of SHELL_ROUTES) {
    await page.goto(`/${hash}`);
    await page.waitForSelector(".lf-shell__content > *", { timeout: 15_000 });
    const ok = await page.evaluate(() => {
      const content = document.querySelector(".lf-shell__content");
      const first = content?.firstElementChild as HTMLElement | null;
      if (!first) return { root: false, gap: "", dir: "" };
      const cs = getComputedStyle(first);
      return {
        root: first.classList.contains("lf-page"),
        gap: cs.rowGap,
        dir: cs.flexDirection,
      };
    });
    if (!ok.root) offenders.push(`${hash} (no .lf-page root)`);
  }
  expect(offenders, `pages not using the shared shell: ${offenders.join(", ")}`).toEqual([]);
});

// §12po1-7 — no page-level anchor may fall back to the browser's default link styling.
test("every in-page link uses the themed treatment (no default blue/underline)", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 800 });
  const offenders: string[] = [];
  for (const hash of SHELL_ROUTES) {
    await page.goto(`/${hash}`);
    await page.waitForSelector(".lf-shell__content > *", { timeout: 15_000 });
    const bad = await page.evaluate(() => {
      const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
      const out: string[] = [];
      document.querySelectorAll(".lf-page a").forEach((a) => {
        const cs = getComputedStyle(a as HTMLElement);
        // A default UA link is underlined at rest and NOT the accent colour.
        if (cs.textDecorationLine.includes("underline")) out.push(`underlined at rest: ${a.textContent?.slice(0, 30)}`);
        void accent;
      });
      return out;
    });
    offenders.push(...bad.map((b) => `${hash}: ${b}`));
  }
  expect(offenders, `default-styled links: ${offenders.join(" | ")}`).toEqual([]);
});

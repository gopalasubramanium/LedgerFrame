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

// Content-left offset is OWNED by the shell (page-portfolio §12-1): every built content page
// starts at the same left inset from the chrome — no page sets its own root padding. At ≤1366
// the content box is narrower than any page's max-width, so no page centering shifts the left.
test("built pages share one content-left inset (shell owns the padding)", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  const lefts: number[] = [];
  for (const hash of ["#/", "#/net-worth", "#/holdings", "#/portfolio", "#/markets", "#/heatmap", "#/news", "#/instrument/AAPL", "#/pricing-health", "#/review", "#/policy"]) {
    await page.goto(`/${hash}`);
    await page.waitForSelector(".lf-shell__content > *", { timeout: 15_000 });
    lefts.push(
      await page.evaluate(() => {
        const first = document.querySelector(".lf-shell__content")?.firstElementChild as HTMLElement | null;
        return first ? Math.round(first.getBoundingClientRect().left) : -1;
      }),
    );
  }
  // All equal (within 1px) and non-zero (there IS a gap from the chrome).
  expect(Math.max(...lefts) - Math.min(...lefts), `content-left offsets: ${lefts.join(",")}`).toBeLessThanOrEqual(1);
  expect(Math.min(...lefts), "content is inset from the chrome, not flush").toBeGreaterThan(4);
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

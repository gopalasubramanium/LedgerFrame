import { test, expect } from "@playwright/test";

// §11-14 permanent regression suite (ADR-0004): NO horizontal overflow at any of the
// standard breakpoints, across the shell + both built pages, in both themes. The app
// runs without a backend here (API calls fail gracefully) — layout is what we measure,
// and the chrome + page headers render regardless. Theme follows prefers-color-scheme
// (the default choice is "system"), so emulateMedia drives light/dark.

const WIDTHS = [320, 375, 900, 1366];
const ROUTES = [
  { name: "home (overview)", hash: "#/" },
  { name: "holdings (worklist)", hash: "#/holdings" },
  { name: "instrument (entity-detail)", hash: "#/instrument/AAPL" },
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

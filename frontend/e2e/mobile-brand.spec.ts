import { test, expect } from "@playwright/test";

// P-5 — THE BRAND MARK RIDES THE MOBILE HEADER TOO (owner walk 2026-07-17; DESIGN-SYSTEM §5.6).
//
// The desktop sidebar carried the BrandMark lockup; the mobile top bar rendered a BARE
// "LedgerFrame" with no mark, because the two lockups were hand-built separately and only one
// got the mark. The fix is ONE `BrandLockup` component (mark + wordmark) consumed by BOTH
// surfaces. This guard proves the mobile header now renders the svg mark BESIDE the wordmark.
//
// REAL-VIEWPORT territory (§13c): the mobile header shows only below the 900px breakpoint
// (D-102), a @media rule jsdom cannot evaluate — so the guard lives in the Playwright suite and
// runs at true mobile widths (320/375), never a static specimen. Fail-first: RED on the bare
// mobile header (no svg inside `.lf-topbar__brand`), GREEN once the lockup is shared.
const MOBILE = [
  { name: "320", width: 320, height: 640 },
  { name: "375", width: 375, height: 667 },
];

for (const theme of ["light", "dark"] as const) {
  for (const vp of MOBILE) {
    test(`mobile header shows the brand mark beside the wordmark · ${vp.name} · ${theme}`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/#/");
      await page.waitForSelector(".lf-topbar__brand", { timeout: 15_000 });

      const m = await page.evaluate(() => {
        const brand = document.querySelector(".lf-topbar__brand") as HTMLElement;
        const mark = brand?.querySelector("svg.lf-brandmark") as SVGElement | null;
        const word = brand?.querySelector(".lf-brandlockup__word") as HTMLElement | null;
        const br = brand?.getBoundingClientRect();
        const mr = mark?.getBoundingClientRect();
        const wr = word?.getBoundingClientRect();
        return {
          brandVisible:
            !!brand && window.getComputedStyle(brand).display !== "none" && (br?.height ?? 0) > 0,
          hasMark: !!mark,
          markVisible: (mr?.width ?? 0) > 0 && (mr?.height ?? 0) > 0,
          markAriaHidden: mark?.getAttribute("aria-hidden") === "true",
          markLeftOfWord: mr && wr ? mr.right <= wr.left + 1 : false,
          // The svg is decorative, so the accessible name of the brand is exactly the wordmark.
          accessibleName: brand?.textContent?.trim(),
        };
      });

      // The mobile header is present (it replaces the sidebar brand below 900px).
      expect(m.brandVisible, "mobile top-bar brand is visible below 900px").toBe(true);
      // The mark rides beside the wordmark — the whole point of the fix.
      expect(m.hasMark, "the brand mark svg is present in the mobile header").toBe(true);
      expect(m.markVisible, "the brand mark is actually painted (non-zero box)").toBe(true);
      expect(m.markLeftOfWord, "the mark sits to the LEFT of the wordmark (one lockup)").toBe(true);
      // The mark stays decorative; the accessible name is the wordmark, so screen readers say
      // "LedgerFrame", never "graphic LedgerFrame".
      expect(m.markAriaHidden, "the mark is aria-hidden (decorative)").toBe(true);
      expect(m.accessibleName, "accessible name is the wordmark").toBe("LedgerFrame");
    });
  }
}

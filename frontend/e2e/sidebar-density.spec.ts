import { test, expect } from "@playwright/test";

// P-3 — THE WHOLE NAV FITS WITHOUT SCROLLING (owner ruling 2026-07-16; DESIGN-SYSTEM §5.5 nav density).
//
// Accordion/collapsible groups were DECLINED (hiding destinations costs a click per cross-group hop and
// harms orientation). Instead the nav's vertical rhythm is tightened via tokens so all six D-043 groups +
// every planned item fit at normal desktop heights with NO scrollbar. Below a ~640–680px floor the items
// region alone scrolls with the brand pinned — graceful degradation, never hidden groups.
//
// This is MEDIA-QUERY / real-viewport territory — jsdom has no layout engine (TEMPLATE §7), so the guard
// lives in the Playwright suite. The suite runs with NO BACKEND, so the DemoBadge footer is absent; the
// headroom math RESERVES its height so the fit is proven for the real, footer-present layout too.
//
// DESIGN FOR THE FULL RD-9 NAV, NOT TODAY'S. NAV_GROUPS ships 6 groups / 19 items:
//   Overview 1 · Wealth 4 · Markets 3 · Planning 6 · Reports 2 · System 3 = 19.
// Only built pages render as entries today (14), so the fit guard measures the CURRENT count and asserts
// HEADROOM for the (19 − current) still-to-ship items, so the density is not redone at Accounts/Settings.
const PLANNED_ITEMS = 19;
const PLANNED_GROUPS = 6;
// Reserve for the pinned DemoBadge footer (~44px), which the no-backend suite does not render.
const FOOTER_RESERVE = 44;

// Fit targets: normal desktop heights where the WHOLE nav must be visible without a nav scrollbar.
const FIT = [
  { name: "1366x720", width: 1366, height: 720 },
  { name: "1024x700", width: 1024, height: 700 },
];

for (const theme of ["light", "dark"] as const) {
  for (const vp of FIT) {
    test(`whole nav fits, no scrollbar, headroom for the full nav · ${vp.name} · ${theme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/#/");
      await page.waitForSelector(".lf-sidebar__nav", { timeout: 15_000 });

      const m = await page.evaluate(() => {
        const nav = document.querySelector(".lf-sidebar__nav") as HTMLElement;
        const links = Array.from(document.querySelectorAll(".lf-sidebar__link")) as HTMLElement[];
        const labels = document.querySelectorAll(".lf-sidebar__grouplabel");
        const last = links[links.length - 1];
        return {
          navScroll: nav.scrollHeight - nav.clientHeight,
          count: links.length,
          groups: labels.length,
          rowHeight: links[0].getBoundingClientRect().height,
          lastBottom: last.getBoundingClientRect().bottom,
          viewportH: window.innerHeight,
        };
      });

      // (a) The docked sidebar is visible; all six group headers + every built entry render.
      expect(m.groups, "all six D-043 group headers render").toBe(PLANNED_GROUPS);
      expect(m.count, "built nav entries render").toBeGreaterThan(0);
      // (b) The items region does NOT scroll at this height — the whole current nav is visible.
      expect(m.navScroll, "nav must not scroll at normal desktop heights").toBeLessThanOrEqual(1);
      // (c) The last item's bottom is within the viewport (no clipped SYSTEM group — the reported bug).
      expect(m.lastBottom, "last nav item bottom is within the viewport").toBeLessThanOrEqual(m.viewportH + 1);
      // (d) HEADROOM for the FULL nav: measured at the CURRENT count, prove the (19 − current) still-to-ship
      //     items AND the demo footer would still fit below the last item. Math is stated in the message.
      const extra = PLANNED_ITEMS - m.count;
      const need = extra * m.rowHeight + FOOTER_RESERVE;
      const have = m.viewportH - m.lastBottom;
      expect(
        have,
        `headroom ${have.toFixed(0)}px ≥ ${extra} planned items × ${m.rowHeight.toFixed(0)}px + ${FOOTER_RESERVE}px footer = ${need.toFixed(0)}px`,
      ).toBeGreaterThanOrEqual(need);
    });
  }
}

// DEGRADATION — below the floor the items region alone scrolls, brand PINNED, no group hidden.
//
// Note on the viewport: the DOCKED sidebar (laptop+, width > 900px per D-102) is the surface whose brand
// is pinned while its items scroll — so the degradation is exercised on a docked short height (1024×460),
// NOT at ≤900px. Two reasons: (1) at ≤900px the sidebar is an off-canvas full-height DRAWER whose brand
// moves to the TopBar (D-102) — a different surface, and its off-canvas layout is already guarded by
// e2e/overflow.spec.ts at 900px; (2) the current 14-item nav is dense enough to still FIT at 900×600
// (the density win), so the scroll only engages below the floor — we force it at 460px to observe it on
// today's build. What the guard proves is the MECHANISM (nav is the sole scroller; brand + footer are
// flex-shrink:0), which is what carries the full 19-item nav below the ~640–680px floor.
for (const theme of ["light", "dark"] as const) {
  test(`degradation (docked, short height): items scroll, brand pinned, no group hidden · ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.setViewportSize({ width: 1024, height: 460 });
    await page.goto("/#/");
    await page.waitForSelector(".lf-sidebar__nav", { timeout: 15_000 });

    const m = await page.evaluate(() => {
      const sidebar = document.querySelector(".lf-sidebar") as HTMLElement;
      const brand = document.querySelector(".lf-sidebar__brand") as HTMLElement;
      const nav = document.querySelector(".lf-sidebar__nav") as HTMLElement;
      const labels = document.querySelectorAll(".lf-sidebar__grouplabel");
      const br = brand.getBoundingClientRect();
      const nr = nav.getBoundingClientRect();
      return {
        navScrolls: nav.scrollHeight - nav.clientHeight,
        sidebarScrolls: sidebar.scrollHeight - sidebar.clientHeight,
        groups: labels.length,
        brandVisible: window.getComputedStyle(brand).display !== "none" && br.height > 0,
        brandTop: br.top,
        navStartsBelowBrand: nr.top >= br.bottom - 1,
        viewportH: window.innerHeight,
        navBottom: nr.bottom,
      };
    });

    // The ITEMS region scrolls (degradation engaged) — but the SIDEBAR itself does not.
    expect(m.navScrolls, "the items region scrolls when it can't fit").toBeGreaterThan(1);
    expect(m.sidebarScrolls, "the sidebar shell itself never scrolls (brand stays put)").toBeLessThanOrEqual(1);
    // The brand is PINNED at the top, outside the scroll region, and stays within the viewport.
    expect(m.brandVisible, "brand is visible (pinned)").toBe(true);
    expect(m.brandTop, "brand pinned at the top").toBeLessThanOrEqual(1);
    expect(m.navStartsBelowBrand, "the scroll region starts below the pinned brand").toBe(true);
    expect(m.navBottom, "the items region ends within the viewport").toBeLessThanOrEqual(m.viewportH + 1);
    // NO group is hidden — all six D-043 headers are still in the DOM (accordion was declined).
    expect(m.groups, "all six group headers remain (nothing hidden)").toBe(PLANNED_GROUPS);
  });
}

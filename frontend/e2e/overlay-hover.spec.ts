import { test, expect } from "@playwright/test";

// §14dr-7 — the Advanced hover tooltip carries the overlay values (MA · BB · RSI) at the
// hovered point. jsdom has no layout, so hover-index math (clientX → nearest point) is only
// exercisable in a real browser. Drive the kitchen-sink overlay specimen; hover near the
// right edge (past the SMA-5/RSI-14 warm-up) and assert the overlay line appears, then hover
// at the far-left warm-up edge and assert it does NOT (null-guarded — no fabricated value).
// A real bubbling mousemove is dispatched so it reaches the component's onMouseMove
// deterministically in headless Chromium (the wheel-delivery precedent, §14dr-5).
async function hoverAtFraction(plot: import("@playwright/test").Locator, frac: number) {
  await plot.evaluate((el, f) => {
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent("mousemove", {
      clientX: r.left + r.width * f,
      clientY: r.top + r.height * 0.5,
      bubbles: true,
      cancelable: true,
    }));
  }, frac);
}

test("Advanced tooltip shows MA/BB/RSI at the hovered point, omitted during warm-up (§14dr-7)", async ({ page }) => {
  await page.goto("/#/kitchen-sink");
  const plot = page.locator('[data-testid="ks-overlay-candles"] .lf-pricechart__plot');
  await expect(plot).toBeVisible();

  // Hover near the RIGHT edge → past warm-up → MA/BB/RSI present.
  await hoverAtFraction(plot, 0.95);
  const tip = page.locator('[data-testid="ks-overlay-candles"] .lf-pricechart__tipoverlay');
  await expect(tip).toBeVisible();
  const text = (await tip.textContent()) ?? "";
  expect(text).toContain("MA");
  expect(text).toContain("BB");
  expect(text).toContain("RSI");

  // Hover at the FAR-LEFT warm-up edge → indicators are null → no overlay line (never a
  // fabricated 0 or blank number).
  await hoverAtFraction(plot, 0.0);
  await expect(page.locator('[data-testid="ks-overlay-candles"] .lf-pricechart__tipoverlay')).toHaveCount(0);
});

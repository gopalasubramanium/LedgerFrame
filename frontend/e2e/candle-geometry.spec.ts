import { test, expect } from "@playwright/test";

// §14dr-4 — candlestick GEOMETRY in a real browser. jsdom has no layout engine and applies no
// CSS, so the "candles render as crosses" defect (a body outline — the SVG default 1-user-unit
// stroke, scaled non-uniformly by the plot's `preserveAspectRatio="none"` — ballooning around a
// thin fill at real daily density) is only observable here. Drive the DENSE-daily kitchen-sink
// specimen and assert the bodies read as non-overlapping rectangles, not fat crosses. Assert
// geometry (bounding boxes), not pixels-by-eye. This complements the unit geometry test
// (ui.test.tsx), which guards the body WIDTH; this guards the STROKE bloom the unit env can't see.
test("dense-daily candle bodies render as non-overlapping rectangles, not crosses (§14dr-4)", async ({ page }) => {
  await page.goto("/#/kitchen-sink");
  const svg = page.locator('[data-testid="ks-dense-candles"] svg');
  await expect(svg).toBeVisible();

  const geo = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="ks-dense-candles"]');
    if (!root) return [];
    return Array.from(root.querySelectorAll(".lf-candle--up rect, .lf-candle--down rect"))
      .map((r) => r.getBoundingClientRect())
      .map((b) => ({ x: b.x, w: b.width }))
      .sort((a, b) => a.x + a.w / 2 - (b.x + b.w / 2));
  });

  expect(geo.length, "dense specimen renders ~130 candle bodies").toBeGreaterThan(100);

  // Candle pitch = median spacing between adjacent body centres.
  const centres = geo.map((b) => b.x + b.w / 2);
  const pitches = centres.slice(1).map((c, i) => c - centres[i]).sort((a, b) => a - b);
  const pitch = pitches[Math.floor(pitches.length / 2)];
  expect(pitch, "positive candle pitch").toBeGreaterThan(0);

  // NO body wider than the pitch → each body is a distinct rectangle, never a fat cross swallowing
  // the gap. Before the fix the scaled 1-unit outline inflated every body well past the pitch.
  const maxW = Math.max(...geo.map((b) => b.w));
  expect(maxW, "candle body width stays within the candle pitch (no cross bloom)").toBeLessThanOrEqual(pitch + 1);

  // NO adjacent overlap (the direct consequence): each body ends before the next begins.
  let overlaps = 0;
  for (let i = 1; i < geo.length; i++) if (geo[i - 1].x + geo[i - 1].w > geo[i].x + 1) overlaps++;
  expect(overlaps, "adjacent candle bodies do not overlap").toBe(0);
});

// §14dr-5 — zoom interaction on the Advanced chart: wheel narrows the visible window, a ratified
// Reset control restores it, and neither introduces horizontal overflow.
test("Advanced chart zoom: wheel narrows the window, Reset restores it, no overflow (§14dr-5)", async ({ page }) => {
  await page.goto("/#/kitchen-sink");
  const specimen = page.locator('[data-testid="ks-dense-candles"]');
  await expect(specimen.locator("svg")).toBeVisible();
  const bodies = specimen.locator(".lf-candle--up rect, .lf-candle--down rect");
  const full = await bodies.count();
  expect(full).toBeGreaterThan(100);

  // Reset control is absent until zoomed.
  await expect(specimen.getByRole("button", { name: "Reset zoom" })).toHaveCount(0);

  // Wheel up over the plot = zoom in → fewer visible candles.
  const box = (await specimen.locator(".lf-pricechart__plot").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -240);
  await expect.poll(async () => bodies.count(), { timeout: 4000 }).toBeLessThan(full);

  // No horizontal overflow while zoomed.
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over, "no horizontal overflow while zoomed").toBeLessThanOrEqual(1);

  // Reset restores the full range and hides the control.
  await specimen.getByRole("button", { name: "Reset zoom" }).click();
  await expect.poll(async () => bodies.count(), { timeout: 4000 }).toBe(full);
  await expect(specimen.getByRole("button", { name: "Reset zoom" })).toHaveCount(0);
});

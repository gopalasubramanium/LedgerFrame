import { test, expect } from "@playwright/test";

// ICON-IN-LABELLED-BUTTON SIZING (DESIGN-SYSTEM §5.4 amendment, owner walk 2026-07-16 P-1).
//
// HISTORY, kept because it names exactly what the owner just ruled on. This guard was born at
// §12po3-1 (Policy close-out): the pencil was hardcoded at 16px via lucide's `size` prop, OFF-TOKEN.
// The FIRST version asserted "icon box == the button's font-size"; it went RED on an ALREADY-ACCEPTED
// button, so it was walked back to "icon == the --icon-size TOKEN (18px)". That parked a known tension:
// on a 13px-text button an 18px glyph reads visibly LARGER than the label.
//
// The owner has now RULED on that tension (P-1): the icon in a LABELLED Button renders at the button's
// OWN font-size (cap-height aligned), NEVER larger than the text beside it — 1–2pt smaller than the old
// 18px. The fix is central: `.lf-btn svg { width/height: 1em }` (the icon-only `.lf-iconbtn` keeps
// --icon-size, a distinct surface). So this guard FLIPS: it now asserts the svg's rendered bounding
// height is ≤ the button's font-size + 1px — RED on today's 18px oversize, GREEN at ~13px after.
//
// ⚠ MEASURED IN THE GALLERY, NOT ON A LIVE PAGE. The CI e2e suite runs with NO BACKEND, so Policy
// renders no action button at all (it has no policy to edit) and this guard TIMED OUT there. A COMPONENT
// guard must not depend on a page having data — the static kitchen-sink specimen can never render zero.
// Review is kept as a second live case: its Mark-reviewed button renders regardless of data.
const BUTTONS = [
  { name: "kitchen-sink · Button specimen", hash: "#/kitchen-sink", selector: ".lf-btn--icon" },
  { name: "review · Mark reviewed", hash: "#/review", selector: ".lf-btn--icon" },
];

for (const theme of ["light", "dark"] as const) {
  for (const b of BUTTONS) {
    test(`labelled-button icon renders at the button's font-size · ${b.name} · ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 1366, height: 900 });
      await page.goto(`/${b.hash}`);
      await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
      const btn = page.locator(b.selector).first();
      await expect(btn).toBeVisible({ timeout: 15_000 });

      const m = await btn.evaluate((el) => {
        const svg = el.querySelector("svg") as SVGElement;
        const ib = svg.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const bb = el.getBoundingClientRect();
        return {
          fontSizePx: parseFloat(cs.fontSize),
          iconW: ib.width,
          iconH: ib.height,
          gap: parseFloat(cs.columnGap || "0"),
          display: cs.display,
          iconCentre: ib.top + ib.height / 2,
          btnCentre: bb.top + bb.height / 2,
          label: (el.textContent ?? "").trim(),
        };
      });

      // THE RULING: the icon renders at the button's font-size (cap-height aligned), NEVER larger than
      // the text beside it. `1em` on `.lf-btn svg` ties the two together. Pixels-are-facts (§13a): we
      // assert the RENDERED svg bounding box, not the CSS value. (Old build: 18px on 13px text → RED.)
      expect(m.iconH, `icon height ${m.iconH} ≤ font-size ${m.fontSizePx} + 1px`).toBeLessThanOrEqual(m.fontSizePx + 1);
      expect(m.iconW, `icon width ${m.iconW} ≤ font-size ${m.fontSizePx} + 1px`).toBeLessThanOrEqual(m.fontSizePx + 1);
      // …and it is not shrunk to nothing — it still reads as an icon (≥ ~70% of the text, cap-height band).
      expect(m.iconH, `icon height ${m.iconH} is a real glyph, not collapsed`).toBeGreaterThanOrEqual(m.fontSizePx * 0.7);
      // Optically centred with the label, with a consistent gap — and the TEXT LABEL IS KEPT.
      expect(Math.abs(m.iconCentre - m.btnCentre), "icon is optically centred with the label").toBeLessThanOrEqual(1.5);
      expect(m.gap, "a consistent gap between icon and label").toBeGreaterThan(0);
      expect(m.display).toContain("flex");
      expect(m.label.length, "the icon rides WITH a text label, never instead of it").toBeGreaterThan(0);
    });
  }
}

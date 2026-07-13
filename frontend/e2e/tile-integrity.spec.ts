import { test, expect } from "@playwright/test";

// TILE INTEGRITY (page-home §12ho1-4) — the regression suite for the defect that killed the
// first Home build: `SummaryHead whole` carried BOTH `lf-summaryhead` and `lf-summarylink`, and
// `.lf-summarylink { position: absolute }` (structure.css) beat `.lf-summaryhead { position:
// relative }` on source order — so every whole-header was torn out of its tile and pinned to the
// top-right of the PAGE, stacking on top of the others. It shipped to FOUR pages.
//
// Why no existing suite caught it: the §12ho1-2 checks COUNTED affordances (`[data-summarylink]`,
// aria-labels, keyboard focus) — all still true of a header lying in a heap in the wrong corner.
// A count is not a geometry. jsdom has no layout engine (ADR-0004), so this can only live here.
//
// The invariant, stated once: A SUMMARY HEADER RENDERS INSIDE ITS OWN TILE. It is asserted on the
// kitchen-sink gallery (no backend, deterministic specimens) and on every built page that uses the
// affordance, so any future page-local variant is caught the moment it renders.

const ROUTES = [
  // This suite runs with NO backend, so a live page may honestly render an empty/error state instead
  // of its summary cards. `strict` marks the routes that must show the affordance regardless: the
  // kitchen-sink specimens are static, so they can never render zero — and they alone would have
  // caught the original defect. The live pages are checked opportunistically: whenever they DO
  // render a header, its geometry must hold.
  { name: "kitchen-sink (specimens)", hash: "#/kitchen-sink", strict: true },
  { name: "net worth", hash: "#/net-worth", strict: false },
  { name: "portfolio", hash: "#/portfolio", strict: false },
  { name: "instrument detail", hash: "#/instrument/AAPL", strict: false },
];

// The Home mockup is the RATIFICATION GATE (§12ho1-4): its whole claim is "Full fits one viewport at
// 1366×768 with demo data, and no tile clips its content". A claim nobody checks is a claim that
// rots — so the gate artifact is asserted, not just looked at. The frame IS 1366×768.
test("home mockup · Full fits 1366×768 and no tile clips its content", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto("/#/kitchen-sink");
  await page.locator(".hm3--full").waitFor({ state: "attached", timeout: 15_000 });

  const report = await page.evaluate(() => {
    const frame = document.querySelector(".ks__viewport") as HTMLElement;
    const page_ = frame.querySelector(".hm3--full") as HTMLElement;

    const clipped: string[] = [];
    for (const cell of frame.querySelectorAll<HTMLElement>(".hm3__cell")) {
      const name = cell.className.split(" ").pop() ?? "?";
      if (cell.scrollHeight > cell.clientHeight + 2) clipped.push(`${name} (height)`);
      if (cell.scrollWidth > cell.clientWidth + 2) clipped.push(`${name} (width)`);
    }
    // A quote card losing its staleness chip off the tile edge is exactly the kind of truncation
    // that must never buy a fit — check the cards' boxes, not just the tile's scroll size.
    const tile = frame.querySelector(".hm3__cell--quotes")?.getBoundingClientRect();
    if (tile) {
      for (const card of frame.querySelectorAll(".hm3__cell--quotes .lf-quote")) {
        const b = card.getBoundingClientRect();
        if (b.right > tile.right + 2 || b.bottom > tile.bottom + 2) clipped.push("quote card cut off");
      }
    }
    return {
      vOverflow: page_.scrollHeight - frame.clientHeight,
      hOverflow: page_.scrollWidth - frame.clientWidth,
      clipped,
    };
  });

  expect(report.vOverflow, "Full must fit the 768px viewport — no vertical scroll").toBeLessThanOrEqual(0);
  expect(report.hOverflow, "Full must fit the 1366px viewport — no horizontal scroll").toBeLessThanOrEqual(0);
  expect(report.clipped, "a tile is hiding its own content to make the layout fit").toEqual([]);
});

for (const route of ROUTES) {
  test(`summary headers stay inside their tiles · ${route.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(`/${route.hash}`);
    await page.waitForSelector(".lf-shell__content > *, .ks", { timeout: 15_000 });
    await page
      .locator(".lf-summaryhead")
      .first()
      .waitFor({ state: "attached", timeout: 5_000 })
      .catch(() => {}); // a backend-less page may legitimately render no summary cards at all

    const report = await page.evaluate(() => {
      const heads = [...document.querySelectorAll<HTMLElement>(".lf-summaryhead")];
      const escaped: string[] = [];
      const outside: string[] = [];

      for (const head of heads) {
        const name = (head.textContent ?? "").trim().slice(0, 32);

        // (1) A header is never ripped out of the flow. `absolute` here is the exact defect:
        // it makes the header a free-floating element positioned against some ancestor far away.
        if (getComputedStyle(head).position === "absolute") escaped.push(name);

        // (2) And it renders within the bounds of the card it heads.
        const tile = head.closest(".lf-card");
        if (tile) {
          const h = head.getBoundingClientRect();
          const t = tile.getBoundingClientRect();
          if (h.top < t.top - 2 || h.left < t.left - 2 || h.right > t.right + 2) outside.push(name);
        }
      }

      // (2b) The ↗ glyph is absolutely positioned BY DESIGN — so it is only ever correct if its own
      // offset parent is the header that owns it. ReviewCard's head had no `position: relative`, so
      // its ↗ escaped the same way (the defect class, not just the one instance).
      for (const link of document.querySelectorAll<HTMLElement>("[data-summarylink]")) {
        const owner = link.closest(".lf-summaryhead, .lf-review__head, .lf-card");
        if (!owner) continue;
        const l = link.getBoundingClientRect();
        const o = owner.getBoundingClientRect();
        if (l.top < o.top - 2 || l.right > o.right + 2 || l.left < o.left - 2 || l.bottom > o.bottom + 2) {
          outside.push(`↗ ${link.getAttribute("aria-label") ?? "?"}`);
        }
      }

      // (3) No two headers occupy the same space — the visible symptom was a garbled pile of them.
      const overlaps: string[] = [];
      for (let i = 0; i < heads.length; i++) {
        for (let j = i + 1; j < heads.length; j++) {
          const a = heads[i].getBoundingClientRect();
          const b = heads[j].getBoundingClientRect();
          if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) {
            overlaps.push(`${heads[i].textContent?.trim().slice(0, 20)} ⨯ ${heads[j].textContent?.trim().slice(0, 20)}`);
          }
        }
      }
      return { count: heads.length, escaped, outside, overlaps };
    });

    if (route.strict) {
      expect(report.count, "the specimens must render, or this guard is vacuous").toBeGreaterThan(0);
    }
    expect(report.escaped, "summary headers absolutely positioned out of their tile").toEqual([]);
    expect(report.outside, "summary headers rendering outside their tile's bounds").toEqual([]);
    expect(report.overlaps, "summary headers overlapping each other").toEqual([]);
  });
}

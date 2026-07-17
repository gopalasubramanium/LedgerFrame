import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ⚠ DEV-ONLY smoke. reports-pack §7a Phase 2 — the ARTIFACT JOURNEY guard for the Reports Pack.
// It clicks the REAL Reports-page entry point, follows the popup to the backend-served artifact, and
// asserts INSIDE the rendered artifact (the §14 lesson: assert the artifact, not a DOM theory) — the
// Pack-5 header block, all four consolidated sections, one per-entity section per SEEDED entity, the
// §12pk-1 served labels (not raw keys), a served disclaimer verbatim, and the Pack-3 empty-entity
// reason. A fail-first test stubs /reports/pack stripped of that content, proving the guard reads the
// ARTIFACT bytes (not the link/DOM, which are identical either way — the stripped-endpoint pattern).
// Plus a print-emulation assertion on RENDERED PIXELS (never computed styles): §12pk-2 — page 1 has
// no running header (masked by the header block); page 2+ does.
//
// Prereqs: dev frontend (127.0.0.1:5173, which now proxies /reports/pack → backend) + dev backend
// (127.0.0.1:8321) on a RESET demo seed (the canonical three entities); `pdftoppm` on PATH.
//   npx playwright test --config e2e/smoke/playwright.smoke.config.ts reports-pack-journey-smoke

const API = "http://127.0.0.1:8321/api/v1";
const SEEDED_ENTITIES = ["Household", "Meera Iyer", "Rajan Family Trust"]; // §12pk-4: exactly three.
const REVIEW_DISCLAIMER = "reporting only, not advice or a required action."; // review.py:259, verbatim.

async function gotoReports(page: Page) {
  await page.request.put(`${API}/settings`, { data: { values: { first_run_complete: "1" } } });
  await page.goto("/#/reports");
  await expect(page.getByRole("heading", { name: "Reports", exact: true, level: 1 })).toBeVisible({ timeout: 15_000 });
}

async function openArtifactViaEntryPoint(page: Page, context: BrowserContext): Promise<Page> {
  const [artifact] = await Promise.all([
    context.waitForEvent("page"),
    // §14pk-1: the entry point is the ratified primary Button (not a link-styled anchor).
    page.getByRole("button", { name: /Reports Pack/i }).click(),
  ]);
  await artifact.waitForLoadState("networkidle");
  return artifact;
}

test.describe.serial("Reports Pack — the artifact journey (live, DEV-ONLY)", () => {
  test("clicking the REAL entry point opens the artifact; assert INSIDE it", async ({ page, context }) => {
    await gotoReports(page);
    const artifact = await openArtifactViaEntryPoint(page, context);
    expect(new URL(artifact.url()).pathname, "the entry point navigates to the backend artifact").toBe("/reports/pack");
    const html = await artifact.content();

    // Pack-5 header block.
    expect(html).toContain("<h1>Reports Pack</h1>");
    expect(html).toContain("Generated");
    expect(html).toContain("Base currency");
    expect(html, "the not-advice line").toContain("reporting only, not tax or financial advice");

    // Pack-1 — all four consolidated sections, single heading each (§12pk-3: no duplicate card h3).
    for (const h of ["Net worth trend", "Review", "Cash flow", "Scenarios"]) {
      expect(html, `consolidated section ${h}`).toContain(`<h2>${h}</h2>`);
      expect(html, `no duplicate card heading for ${h} (§12pk-3)`).not.toContain(`<h3>${h}</h3>`);
    }

    // Pack-6 — one per-entity section per SEEDED entity (served names), and exactly the canonical three.
    const served: string[] = (await (await page.request.get(`${API}/entities`)).json()).entities.map(
      (e: { name: string }) => e.name,
    );
    expect([...served].sort(), "§12pk-4: exactly the canonical three entities").toEqual(SEEDED_ENTITIES);
    for (const name of served) {
      const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      expect(html, `per-entity section for ${name}`).toMatch(new RegExp(`Per-entity (&mdash;|—) ${esc}`));
    }
    expect((html.match(/pack-section--entity/g) ?? []).length, "one entity section per seeded entity").toBe(served.length);

    // §12pk-1 — attribution rows render SERVED display labels, never the raw reader key.
    expect(html, "served asset-class label").toContain("Fixed deposit");
    expect(html, "the raw reader key must not leak").not.toContain("fixed_deposit");

    // Disclaimer verbatim (D-061/D-105).
    expect(html, "a served disclaimer renders verbatim").toContain(REVIEW_DISCLAIMER);

    // Pack-3 — the thin entity (Meera Iyer, 0 accounts) renders each reader's honest served reason.
    expect(html, "empty-entity served reason (Pack-3)").toContain("No holdings recorded for this entity.");

    console.log(`artifact journey — ${served.length} entities; header + 4 consolidated + served labels + disclaimer + empty-reason all present INSIDE the artifact`);
  });

  test("§14pk-1: the entry point is the ratified primary Button with NO link underline on hover", async ({ page }) => {
    await gotoReports(page);
    const btn = page.getByRole("button", { name: /Reports Pack/i });
    await expect(btn, "the entry point is a primary Button").toHaveClass(/lf-btn--primary/);
    expect(await btn.evaluate((el) => el.tagName), "a <button>, not a link-styled anchor").toBe("BUTTON");
    await btn.hover();
    const deco = await btn.evaluate((el) => getComputedStyle(el).textDecorationLine);
    expect(deco, "the primary Button has no link underline on hover (§14pk-1, Estate §14es-1 precedent)").toBe("none");
    console.log(`§14pk-1 — entry point is a primary Button, hover text-decoration=${deco}`);
  });

  test("FAIL-FIRST: the journey reads the ARTIFACT bytes — a stripped /reports/pack is caught", async ({ page, context }) => {
    await gotoReports(page);
    // Stub the artifact stripped of the header block + the served label. The link/DOM are IDENTICAL to
    // the real journey; only reading the artifact bytes distinguishes them.
    await context.route("**/reports/pack", (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><html><body><p>stripped</p></body></html>" }),
    );
    const artifact = await openArtifactViaEntryPoint(page, context);
    const html = await artifact.content();
    expect(html, "stripped artifact lacks the header (proves the guard reads the artifact, not the DOM)").not.toContain("<h1>Reports Pack</h1>");
    expect(html, "stripped artifact lacks the served label").not.toContain("Fixed deposit");
    await context.unroute("**/reports/pack");
    console.log("fail-first — stripped /reports/pack correctly lacks the header + label (the guard reads the artifact)");
  });

  test("print emulation (§12pk-2): page 1 has NO running header; page 2+ does — RENDERED PIXELS", async ({ page }) => {
    // Paginated output is the only place page 2's running header exists — a screenshot/DOM check can't
    // see the page-1 mask (the running header is present in the DOM on every page, painted over on
    // page 1). So render the real PDF and sample PIXELS in the top band above the H1 (paper 14–17.5mm,
    // printable 0–3.5mm): on page 1 that band is white (header suppressed); on page 2 it carries the
    // running-header text. Measured on the fixed specimen: page 1 = 0 dark px, page 2 = 465.
    await page.goto("/reports/pack", { waitUntil: "networkidle" });
    const dir = mkdtempSync(join(tmpdir(), "pack-pdf-"));
    const pdf = join(dir, "pack.pdf");
    await page.pdf({
      path: pdf, format: "A4", printBackground: true,
      margin: { top: "14mm", bottom: "14mm", left: "12mm", right: "12mm" },
    });
    const dark1 = topBandDark(pdf, 1, dir);
    const dark2 = topBandDark(pdf, 2, dir);
    expect(dark1, "page 1 top band is white — the running header is suppressed (§12pk-2)").toBeLessThan(20);
    expect(dark2, "page 2 top band carries the running header").toBeGreaterThan(100);
    console.log(`print emulation — page1 top-band dark=${dark1} (suppressed) · page2 dark=${dark2} (running header present)`);
  });
});

/** Dark-pixel count in the paper 14–17.5mm top band of one PDF page, via a grayscale PGM render. */
function topBandDark(pdf: string, pageNo: number, dir: string): number {
  const prefix = join(dir, `p${pageNo}`);
  execFileSync("pdftoppm", ["-gray", "-r", "150", "-f", String(pageNo), "-l", String(pageNo), "-singlefile", pdf, prefix]);
  const { width, height, pixels } = readPgm(`${prefix}.pgm`);
  const A4_MM = 297;
  const r0 = Math.round((14 / A4_MM) * height);
  const r1 = Math.round((17.5 / A4_MM) * height);
  let dark = 0;
  for (let y = r0; y < r1; y++) for (let x = 0; x < width; x++) if (pixels[y * width + x] < 128) dark++;
  return dark;
}

/** Minimal binary PGM (P5) reader — no external image lib. */
function readPgm(path: string): { width: number; height: number; pixels: Buffer } {
  const buf = readFileSync(path);
  if (buf.toString("latin1", 0, 2) !== "P5") throw new Error(`not a P5 PGM: ${path}`);
  let i = 2;
  const tokens: number[] = [];
  while (tokens.length < 3) {
    while (i < buf.length && (buf[i] === 0x20 || buf[i] === 0x09 || buf[i] === 0x0a || buf[i] === 0x0d)) i++;
    if (buf[i] === 0x23) { while (i < buf.length && buf[i] !== 0x0a) i++; continue; } // comment
    let j = i;
    while (j < buf.length && buf[j] > 0x20) j++;
    tokens.push(parseInt(buf.toString("latin1", i, j), 10));
    i = j;
  }
  i++; // single whitespace after maxval
  const [width, height] = tokens;
  return { width, height, pixels: buf.subarray(i, i + width * height) };
}

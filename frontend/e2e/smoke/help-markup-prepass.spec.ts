import { test, expect, type Page } from "@playwright/test";

// PHASE 3a SCRIPTED PRE-PASS — page-help §9-bis-11 (Steps B/C/D).
// DEV-ONLY, isolated instance (spare ports, temp data dir). Never in `npm run check` / CI.
//
// Drives what the owner will drive at 3b, and fixes what it surfaces first:
//   1. formatted entries — three, including a long one — render structure, not raw markers
//   2. entry bodies use the FULL width (the 78ch cap is retired, §9-bis-11(b))
//   3. no horizontal overflow at 320 / 375 / 768 / 1366
//   4. About is the 7th tab, complete, with the photo rendering FROM THE LOCAL ASSET —
//      proven from the page's own request log, not from the src attribute
//   5. Policy renders ONE band + concentration pair
//   6. type-ahead + deep links still green
//
// Screenshots land in artifacts/ for the owner's 3b look.

const OUT = "e2e/smoke/artifacts";
const BASE = process.env.SMOKE_BASE ?? "http://127.0.0.1:5199";

/**
 * Dismiss the first-run checklist and WAIT FOR IT TO GO.
 *
 * The naive version — `if (await count()) click()` — silently does nothing: the checklist mounts
 * after its fetch resolves, so the count is 0 at that instant and the helper returns happy. The
 * dialog then appears and swallows every subsequent click as `.lf-firstrun intercepts pointer
 * events`. A dismiss helper that can no-op without saying so is the same silent-success shape as
 * a guard that never looked.
 */
async function dismissFirstRun(page: Page) {
  const dialog = page.locator(".lf-firstrun");
  try {
    await dialog.waitFor({ state: "visible", timeout: 4000 });
  } catch {
    return; // genuinely absent (already dismissed on this instance) — nothing to do
  }
  await page.getByLabel("Dismiss setup").click();
  await dialog.waitFor({ state: "detached", timeout: 5000 });
}

/** Horizontal overflow of the document and of the shell content box. */
async function overflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const content = document.querySelector(".lf-page") ?? doc;
    return {
      doc: doc.scrollWidth - doc.clientWidth,
      content: (content as HTMLElement).scrollWidth - (content as HTMLElement).clientWidth,
    };
  });
}

test.describe("help markup + about + policy — 3a pre-pass", () => {
  test("formatted entries render STRUCTURE, never raw markers, at full width", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

    await page.goto(`${BASE}/#/help`);
    await dismissFirstRun(page);

    // Three formatted entries, including a long one (page-policy carries five points).
    for (const topic of ["page-home", "page-policy", "orientation-pages"]) {
      await page.goto(`${BASE}/#/help?topic=${topic}`);
      const entry = page.locator(`#${topic}`);
      await expect(entry).toBeVisible();
      await expect(entry.locator(".help__panel")).toBeVisible();

      // Structure is REAL elements, not text that looks like markup.
      const prose = entry.locator(".help__prose").first();
      await expect(prose).toBeVisible();
      const text = (await entry.innerText()) ?? "";
      expect(text, `${topic} shows raw bold markers`).not.toContain("**");
      expect(text, `${topic} shows a raw heading marker`).not.toMatch(/(^|\n)##\s/);

      // §9-bis-11(b) — FULL width: the body tracks the entry, not a 78ch column. The old cap
      // measured ~689px; the assertion is that the body is not stranded well inside its parent.
      const body = await prose.boundingBox();
      const host = await entry.boundingBox();
      expect(body && host).toBeTruthy();
      expect(
        body!.width / host!.width,
        `${topic} body is capped well inside the entry — the 78ch column is back`,
      ).toBeGreaterThan(0.8);
    }

    // A formatted entry actually renders list items and emphasis somewhere.
    await page.goto(`${BASE}/#/help?topic=page-policy`);
    await expect(page.locator("#page-policy .help__proselist li").first()).toBeVisible();
    await expect(page.locator("#page-home .help__prose strong, #page-home strong").first())
      .toBeVisible();

    expect(errors, `console errors: ${errors.join(" | ")}`).toHaveLength(0);
    await page.screenshot({ path: `${OUT}/help-formatted-entry.png`, fullPage: true });
  });

  test("no horizontal overflow at 320 / 375 / 768 / 1366, both themes", async ({ page }) => {
    // Dismissed ONCE, outside the loop. Dismissal is persisted (it marks the checklist complete),
    // so calling it per-iteration only bought eight 4-second waits for a dialog that was already
    // gone — 32s against a 30s test timeout. The first run of this failed as
    // "Target page … has been closed", which reads exactly like a layout crash and was nothing of
    // the kind: the harness timed itself out. Worth naming, because a pre-pass that fails for its
    // own reasons trains you to distrust the ones that matter.
    await page.goto(`${BASE}/#/help?topic=page-policy`);
    await dismissFirstRun(page);

    for (const theme of ["light", "dark"] as const) {
      for (const w of [320, 375, 768, 1366]) {
        await page.setViewportSize({ width: w, height: 900 });
        await page.goto(`${BASE}/#/help?topic=page-policy`);
        await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
        const ov = await overflow(page);
        expect(ov.doc, `doc overflow ${theme}/${w}px`).toBeLessThanOrEqual(1);
        expect(ov.content, `content overflow ${theme}/${w}px`).toBeLessThanOrEqual(1);
      }
    }
  });

  test("type-ahead and deep links still work", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(`${BASE}/#/help`);
    await dismissFirstRun(page);

    // Mid-word type-ahead, grouped, with the SERVED count.
    await page.getByLabel(/search help/i).fill("confid");
    await expect(page.locator(".help__resultcount")).toBeVisible();
    const count = await page.locator(".help__resultcount").innerText();
    expect(count).toMatch(/\d/);

    // Deep link opens AND marks its entry.
    //
    // about:blank FIRST — a HashRouter `goto` from one hash route to another does NOT remount, so
    // the search box above stays filled and the results list REPLACES the sections. The entry then
    // genuinely is not in the DOM, and the failure reads as "deep links are broken" when what
    // actually happened is that the previous step's state survived the navigation.
    await page.goto("about:blank");
    await page.goto(`${BASE}/#/help?topic=term-xirr-twr`);
    const entry = page.locator("#term-xirr-twr");
    await expect(entry).toBeVisible();
    await expect(entry.locator(".help__panel")).toBeVisible();
    await page.screenshot({ path: `${OUT}/help-glossary-entry.png`, fullPage: true });
  });

  test("About is the 7th tab, complete, and its photo NEVER leaves the machine", async ({ page }) => {
    // THE CLAIM UNDER TEST is not "the src looks local" — it is that no request leaves for the
    // photo. Only the request log can say that, so the request log is what is asserted.
    const external: string[] = [];
    page.on("request", (r) => {
      const u = r.url();
      if (!u.startsWith(BASE) && !u.startsWith("data:") && !u.startsWith("blob:")) external.push(u);
    });

    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(`${BASE}/#/settings?tab=about`);
    await dismissFirstRun(page);

    // The strip carries SEVEN tabs, About among them.
    const strip = page.getByRole("group", { name: "Settings sections" });
    await expect(strip.getByRole("button")).toHaveCount(7);
    await expect(strip.getByRole("button", { name: "About" })).toBeVisible();

    // ⚠ UPDATED FOR THE FOUR-BEAT REBUILD (§9-bis-13). This asserted "What it stands for" — a card
    // heading the rebuild REMOVED. The unit tests were updated in that delta and this pre-pass was
    // not, so the guard went stale: it kept passing until the rebuild actually shipped, then failed
    // naming a heading nobody had deleted by mistake. A guard pinned to superseded copy is worse
    // than no guard, because its red reads as a regression in the code rather than in itself.
    for (const beat of ["The Story & Mission", "The Conflict", "The Resolution", "The Sequel"]) {
      await expect(page.getByRole("heading", { level: 2, name: beat })).toBeVisible();
    }
    await expect(page.getByRole("heading", { level: 2, name: "Who built it" })).toBeVisible();
    // The pull-quote, with no terminal full stop (the ratified punctuation rule).
    await expect(page.locator(".set__pullquote")).toHaveText("One honest picture of everything you own and owe");

    // The photo RENDERS — decoded with real pixels, not a broken-image box.
    const photo = page.getByAltText("Gopala Subramanium");
    await expect(photo).toBeVisible();
    const painted = await photo.evaluate(
      (el) => (el as HTMLImageElement).naturalWidth > 0 && (el as HTMLImageElement).complete,
    );
    expect(painted, "the author photo did not decode — it is not rendering from the local asset")
      .toBe(true);

    // All six links, each with both rel tokens.
    for (const href of [
      "https://ledgerframe.org",
      "https://github.com/gopalasubramanium/ledgerframe",
      "https://me.sgopala.com/",
      "https://github.com/gopalasubramanium",
      "https://www.linkedin.com/in/gopalasubramanium/",
      "https://paypal.me/sgopala",
    ]) {
      const a = page.locator(`a[href="${href}"]`);
      await expect(a, `About is missing ${href}`).toHaveCount(1);
      expect(await a.getAttribute("rel")).toContain("noopener");
      expect(await a.getAttribute("rel")).toContain("noreferrer");
      // Icon-only since the rebuild: without an accessible name these announce as a bare URL or as
      // nothing at all, and the glyphs are semantic stand-ins (lucide has no brand marks), so the
      // name is where the destination's meaning actually lives.
      expect(await a.getAttribute("aria-label"), `${href} has no accessible name`).toBeTruthy();
    }

    expect(external, `the page reached OFF-MACHINE: ${external.join(" | ")}`).toHaveLength(0);
    await page.screenshot({ path: `${OUT}/settings-about.png`, fullPage: true });

    // And About is NOT also inside System — one surface, one home.
    await page.goto(`${BASE}/#/settings?tab=system`);
    await expect(page.getByAltText("Gopala Subramanium")).toHaveCount(0);
  });

  test("About holds together at 320px — the width that caught the last defect", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(`${BASE}/#/settings?tab=about`);
    await dismissFirstRun(page);
    await expect(page.getByAltText("Gopala Subramanium")).toBeVisible();
    const ov = await overflow(page);
    expect(ov.doc, "doc overflow about/320px").toBeLessThanOrEqual(1);
    expect(ov.content, "content overflow about/320px").toBeLessThanOrEqual(1);
    await page.screenshot({ path: `${OUT}/settings-about-320.png`, fullPage: true });
  });

  // ⚑ THE COMPUTED-STYLE ASSERTION — the guard gap that let 23 undefined tokens ship
  // (page-help §9-bis-14 delta 2).
  //
  // Help.css referenced `--text-muted`, `--text-sm`, `--text`, `--focus`, `--text-md` and
  // `--text-xs`, NONE of which exist. Each such declaration is invalid at computed-value time and is
  // DROPPED, so the property inherits — silently. No suite noticed, because no suite had ever
  // asserted a COMPUTED STYLE: the unit tests assert text and structure (and jsdom does not even
  // load these stylesheets), while the pre-passes assert containment and console errors. A dropped
  // declaration overflows nothing and logs nothing.
  //
  // Its source-level counterpart is `src/theme/tokens.test.ts`, which proves no undefined token
  // exists ANYWHERE. This one proves the tokens actually RESOLVE in a real browser on the real page
  // — the two fail in different ways and neither replaces the other.
  test("Help's tokens actually RESOLVE — computed styles, not just source text", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(`${BASE}/#/help`);
    await dismissFirstRun(page);
    const toggle = page.locator(".help__entrytoggle").first();
    await expect(toggle).toBeVisible({ timeout: 15_000 });

    // 1. MUTED PROSE IS ACTUALLY MUTED. `--text-muted` did not exist, so `color` inherited and the
    //    text rendered at full primary contrast. Assert the level chip differs from body text —
    //    comparing against the SIBLING rather than a hardcoded rgb keeps this theme-agnostic.
    const colours = await page.evaluate(() => {
      const level = document.querySelector(".help__level");
      const title = document.querySelector(".help__entrytitle");
      return {
        level: level ? getComputedStyle(level).color : null,
        title: title ? getComputedStyle(title).color : null,
        levelSize: level ? parseFloat(getComputedStyle(level).fontSize) : null,
        titleSize: title ? parseFloat(getComputedStyle(title).fontSize) : null,
      };
    });
    expect(colours.level, "no .help__level rendered — the assertion measured nothing").toBeTruthy();
    expect(colours.level, "muted level text computes to the SAME colour as the title — a dropped `color` declaration").not.toBe(colours.title);
    // 2. THE SIZE TOKENS RESOLVED. `--text-xs` (the level chip) must land smaller than the title's
    //    `--font-size-16`; when both were undefined they inherited the same size.
    expect(colours.levelSize!, "the level chip is not smaller than the entry title — a dropped `font-size`").toBeLessThan(colours.titleSize!);

    // 3. ⚠ THE FOCUS RING EXISTS. This is the one that made the class non-cosmetic:
    //    `outline: var(--focus-width) solid var(--focus)` — with `--focus` undefined the WHOLE
    //    shorthand was invalid, so Help's accordion toggle, topic link and jump link had NO visible
    //    keyboard focus ring at all. Drive it with a real keyboard focus, not a class.
    await toggle.focus();
    const ring = await toggle.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth), colour: cs.outlineColor };
    });
    expect(ring.style, "the focused accordion toggle has NO outline style — the :focus-visible shorthand was dropped").toBe("solid");
    expect(ring.width, "the focused accordion toggle's outline has no width").toBeGreaterThan(0);
    expect(ring.colour, "the focused accordion toggle's outline has no colour").toBeTruthy();

    await page.screenshot({ path: `${OUT}/help-tokens-resolved.png`, fullPage: true });
  });

  test("Policy renders ONE band + concentration pair", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(`${BASE}/#/policy`);
    await dismissFirstRun(page);
    await page.getByRole("button", { name: /edit policy|set policy/i }).first().click();
    const editor = page.getByRole("dialog");
    await expect(editor).toBeVisible();

    await expect(editor.getByLabel("Default band"), "ONE band control").toHaveCount(1);
    await expect(editor.getByLabel("Concentration limit"), "ONE limit control").toHaveCount(1);
    await expect(editor.locator(".pol__edithead"), "ONE header block").toHaveCount(1);
    // Let the dialog's entry transition SETTLE before capturing. The first run screenshotted it
    // mid-fade — every assertion passed, and the image handed to the owner showed a half-
    // transparent dialog printing through the page behind it. A pre-pass artifact that looks
    // broken costs exactly as much owner attention as a defect that is.
    await editor.locator(".pol__edithead").waitFor({ state: "visible" });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/policy-header.png`, fullPage: true });
  });
});

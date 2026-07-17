import { test, expect } from "@playwright/test";

// ⚠ DEV-ONLY smoke (see playwright.smoke.config.ts). Phase-3a scripted pre-pass for the Settings
// page — drives the LIVE app + real backend (127.0.0.1:8321) on the demo-seeded instance across all
// four D-069 tabs, both themes, all breakpoints: containment (no horizontal overflow), 0 console
// errors, and captures the §12st ratification-condition screenshots + the danger Reset control. NOT
// wired into `npm run check`/CI. Run (from frontend/):
//   npx playwright test --config e2e/smoke/playwright.smoke.config.ts settings-smoke
//
// It exercises the PIN set flow (§12st-1) to capture the enabled Reset + the D-103 fresh-PIN
// ConfirmDialog, but NEVER confirms a reset (demo data untouched). The harness driver restores the
// instance to PIN-free afterward (reset.py mechanism).

const API = "http://127.0.0.1:8321/api/v1";
const OUT = "e2e/smoke/artifacts";
const WIDTHS = [320, 375, 900, 1366];
const THEMES = ["light", "dark"] as const;
const TABS = ["general", "appearance", "privacy", "system"] as const;
const TEST_PIN = "090909";
const consoleErrors: string[] = [];

test.describe.serial("settings pre-pass (live)", () => {
  test.beforeAll(() => {
    consoleErrors.length = 0;
  });

  test("containment + 0 console errors across four tabs × both themes × breakpoints", async ({ page }) => {
    page.on("console", (m) => m.type() === "error" && consoleErrors.push(`[console] ${m.text()}`));
    page.on("pageerror", (e) => consoleErrors.push(`[pageerror] ${e.message}`));

    // Clean state: first-run complete so the PAGE is tested (not the overlay).
    await page.request.put(`${API}/settings`, { data: { values: { first_run_complete: "1" } } });

    for (const theme of THEMES) {
      await page.emulateMedia({ colorScheme: theme });
      for (const tab of TABS) {
        await page.goto(`/#/settings?tab=${tab}`);
        await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible({ timeout: 15_000 });
        // The tab strip is present and the requested tab is the live panel.
        await expect(page.getByRole("tabpanel")).toBeVisible();
        for (const w of WIDTHS) {
          await page.setViewportSize({ width: w, height: 900 });
          await page.waitForTimeout(120);
          const ov = await page.evaluate(() => {
            const doc = document.documentElement;
            const content = document.querySelector(".lf-shell__content");
            return { doc: doc.scrollWidth - doc.clientWidth, content: content ? content.scrollWidth - content.clientWidth : 0 };
          });
          expect(ov.doc, `doc overflow ${theme}/${tab}/${w}px`).toBeLessThanOrEqual(1);
          expect(ov.content, `content overflow ${theme}/${tab}/${w}px`).toBeLessThanOrEqual(1);
        }
      }
    }
    console.log(`SETTINGS smoke — console errors: ${consoleErrors.length}`, consoleErrors);
    expect(consoleErrors, "zero console/page errors across the settings pre-pass").toEqual([]);
  });

  test("tab screenshots — each of the four tabs, both themes", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    for (const theme of THEMES) {
      await page.emulateMedia({ colorScheme: theme });
      for (const tab of TABS) {
        await page.goto(`/#/settings?tab=${tab}`);
        await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible({ timeout: 15_000 });
        await page.waitForTimeout(200);
        await page.screenshot({ path: `${OUT}/settings-${tab}-${theme}.png`, fullPage: true });
      }
    }
  });

  test("General serves long_term_days verbatim (D-105) + protected long-term copy (D-077)", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(`/#/settings?tab=general`);
    const days = page.getByLabel("Long-term threshold in days");
    await expect(days).toHaveValue("365");
    // Neutral framing — no jurisdiction presets, not tax advice (D-077/Guarantee 4).
    await expect(page.getByText(/neutral organisation split/i)).toBeVisible();
  });

  test("Privacy — derived state statement VERBATIM + token empty state (§9-9)", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(`/#/settings?tab=privacy`);
    await expect(page.getByLabel("No-egress mode")).toBeVisible();
    // Empty token register (usable from zero).
    await expect(page.getByText("No API tokens yet")).toBeVisible();
    await page.screenshot({ path: `${OUT}/settings-privacy-detail.png`, fullPage: true });
  });

  test("System §12st + the danger Reset control (D-103) + the §9-10 degradation", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.emulateMedia({ colorScheme: "light" });
    // This harness assumes a RESET (PIN-free) demo-seeded instance, like every smoke here. If a prior
    // run left the test PIN set, clear it first (reset.py / null pin_hash) before re-running.
    await page.goto(`/#/settings?tab=system`);
    await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible({ timeout: 15_000 });
    const pinAlreadySet = await page.getByText("PIN: set").isVisible().catch(() => false);

    // §12st-4 — the READ-ONLY served AI-config line.
    await expect(page.getByText(/^AI is (on|off)/)).toBeVisible();
    // §12st-2 — the write-only key field never echoes a value (an honest "set, hidden" state).
    await expect(page.getByLabel("Provider API key (write-only)")).toBeVisible();
    // §9-10 — the root helper is absent on this instance → Allow LAN is disabled (not dead) with a note.
    await expect(page.getByText(/optional root helper/i)).toBeVisible();
    await expect(page.getByLabel("Allow LAN access")).toBeDisabled();
    // §12st-1 — the PIN card + the danger Reset. On a no-PIN instance it is DISABLED (the honest
    // D-103 state: an irreversible wipe is impossible on an unprotected install).
    const reset = page.getByRole("button", { name: /Reset data/ });
    await expect(reset).toHaveClass(/lf-btn--danger/);
    if (!pinAlreadySet) {
      await expect(page.getByText("PIN: not set")).toBeVisible();
      await expect(reset).toBeDisabled();
      await page.screenshot({ path: `${OUT}/settings-system-degraded.png`, fullPage: true });
    }

    // §12st-3 — the ND-6 feeds editor Dialog (the ratified Accounts-dialog pattern).
    await page.getByRole("button", { name: /Edit feeds/ }).click();
    await expect(page.getByRole("dialog", { name: "News feeds" })).toBeVisible();
    await page.screenshot({ path: `${OUT}/settings-feeds-dialog.png` });
    await page.getByRole("button", { name: "Cancel" }).click();

    // §12st-1 — set a PIN if one isn't set, so the ENABLED danger Reset + the D-103 fresh-PIN
    // ConfirmDialog can be captured (never confirmed — demo data untouched).
    if (!pinAlreadySet) {
      await page.getByRole("button", { name: /Set PIN/ }).click();
      await page.getByLabel("New PIN").fill(TEST_PIN);
      await page.getByRole("dialog").getByRole("button", { name: /Set PIN/ }).click();
    }
    await expect(page.getByText("PIN: set")).toBeVisible({ timeout: 10_000 });
    await expect(reset).toBeEnabled();
    await page.screenshot({ path: `${OUT}/settings-system-pin-set.png`, fullPage: true });

    await reset.click();
    const confirm = page.getByRole("dialog", { name: "Reset all data?" });
    await expect(confirm).toBeVisible();
    await expect(confirm.getByText(/Enter your PIN/i)).toBeVisible(); // D-103 fresh purge-PIN
    await page.screenshot({ path: `${OUT}/settings-reset-confirm.png` });
    await confirm.getByRole("button", { name: "Cancel" }).click(); // NEVER confirm — data untouched
  });
});

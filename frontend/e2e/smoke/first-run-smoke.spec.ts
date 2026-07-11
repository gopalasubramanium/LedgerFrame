import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

// ⚠ DEV-ONLY smoke (see playwright.smoke.config.ts). Telemetry/observation + fix-confirmation
// for the Phase-3 pre-pass. NOT the acceptance walk. Assumes the dev DB was reset via
// `python frontend/e2e/smoke/reset.py` (settings cleared, pin NULL, .env restored to the
// pristine snapshot) and both dev servers are live. Captures console errors across the run.

const ART = "e2e/smoke/artifacts";
mkdirSync(ART, { recursive: true });
const consoleErrors: string[] = [];

test.describe.serial("first-run pre-pass (post-fix)", () => {
  test("drive the overlay + confirm fixes + capture telemetry", async ({ page }) => {
    page.on("console", (m) => m.type() === "error" && consoleErrors.push(`[console] ${m.text()}`));
    page.on("pageerror", (e) => consoleErrors.push(`[pageerror] ${e.message}`));

    // --- PART 1: FRESH STATE — overlay auto-opens; 0/5; three-state = all pending -------
    await page.goto("/");
    const card = page.locator(".lf-firstrun__card");
    await expect(card, "overlay auto-opens on fresh cold load").toBeVisible({ timeout: 15_000 });
    expect(await page.locator(".lf-lock").count(), "no lock on a no-PIN instance").toBe(0);

    const count0 = await page.locator(".lf-firstrun__count").innerText();
    const pending = await page.locator(".lf-firstrun__badge.is-pending").count();
    const confirmed0 = await page.locator(".lf-firstrun__badge.is-confirmed").count();
    console.log("PART 1 — fresh state:", JSON.stringify({ count: count0, pendingBadges: pending, confirmedBadges: confirmed0 }));
    expect(count0, "fresh = 0 of 5 confirmed (§F-3/§F-4)").toBe("0 of 5 confirmed");
    expect(pending, "all five steps pending on fresh").toBe(5);

    const verbatim = (await card.innerText()).trim();
    console.log("\n===== PART 1: VERBATIM OVERLAY COPY =====\n" + verbatim + "\n===== END =====\n");
    const baseCcy = await page.getByRole("combobox", { name: "Base currency" }).inputValue();
    const tz = await page.getByRole("combobox", { name: "Timezone" }).inputValue();
    const provider = await page.getByRole("combobox", { name: "Data provider" }).inputValue();
    console.log("PRE-FILLED DEFAULTS (suggestions, not confirmed):", JSON.stringify({ baseCcy, tz, provider }));

    // --- PART 4: BOUNDARY — 4-digit PIN --------------------------------------------------
    await page.getByLabel("PIN").fill("1234");
    const disabledAt4 = await page.getByRole("button", { name: "Set PIN" }).isDisabled();
    console.log("PART 4 — 4-digit PIN Set-disabled:", disabledAt4, "(backend now also enforces 6, §F-8)");
    await page.getByLabel("PIN").fill("");

    // --- PART 3: interplay copy + screenshots (three-state visible) ----------------------
    await page.getByRole("switch", { name: "No egress" }).click();
    const providerNote = (await page.locator(".lf-firstrun__step").filter({ hasText: "Data provider" }).locator(".lf-firstrun__step-note").innerText()).trim();
    console.log("PART 3 — provider interplay copy (no-egress ON):", JSON.stringify(providerNote));
    const shots: string[] = [];
    for (const [w, theme] of [[320, "light"], [320, "dark"], [1440, "light"], [1440, "dark"]] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize({ width: w, height: 1000 });
      await page.reload();
      await expect(page.locator(".lf-firstrun__card")).toBeVisible({ timeout: 15_000 });
      const path = `${ART}/first-run-${w}-${theme}.png`;
      await page.screenshot({ path });
      shots.push(path);
    }
    console.log("SCREENSHOTS (three-state 'not set' badges visible):", JSON.stringify(shots));

    // --- PART 2: F1 (combobox now clickable in overlay) + confirm + persist + F2 link ----
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({ colorScheme: "light" });
    await page.reload();
    await expect(page.locator(".lf-firstrun__card")).toBeVisible();

    // F1: the Timezone Combobox menu now layers ABOVE the overlay → the option is clickable.
    const tzInput = page.getByRole("combobox", { name: "Timezone" });
    await tzInput.click();
    await tzInput.fill("London");
    await page.getByRole("option", { name: "Europe/London" }).first().click();
    const tzConfirmed = await page.locator(".lf-firstrun__step").filter({ hasText: "Timezone" }).locator(".lf-firstrun__badge.is-confirmed").count();
    console.log("PART 2 — F1 timezone pick worked; step confirmed:", tzConfirmed === 1);

    await page.getByRole("combobox", { name: "Base currency" }).selectOption({ index: 1 });
    await page.getByRole("combobox", { name: "Data provider" }).selectOption("csv");
    const countAfter = await page.locator(".lf-firstrun__count").innerText();
    console.log("PART 2 — confirmed count after 3 confirms + no-egress:", JSON.stringify(countAfter));

    // Persist across reload (no PIN → no lock).
    await page.reload();
    await expect(page.locator(".lf-firstrun__card")).toBeVisible();
    const persisted = {
      ccy: await page.getByRole("combobox", { name: "Base currency" }).inputValue(),
      provider: await page.getByRole("combobox", { name: "Data provider" }).inputValue(),
      noEgress: await page.getByRole("switch", { name: "No egress" }).getAttribute("aria-checked"),
    };
    console.log("PART 2 — persisted after reload:", JSON.stringify(persisted));

    // F2: a "more options" link CLOSES the overlay and navigates (does NOT complete).
    await page.getByRole("link", { name: "More options →" }).first().click();
    await page.waitForTimeout(400);
    const afterLink = {
      overlayStillCovering: await page.locator(".lf-firstrun__card").count(),
      notBuilt: await page.getByText(/isn't built yet/).count(),
    };
    console.log("PART 2 — F2 link → overlay closed + NotBuilt visible:", JSON.stringify(afterLink));
    // Reload → still incomplete → overlay reappears (§F-2).
    await page.goto("/");
    const overlayReappears = await page.locator(".lf-firstrun__card").count();
    console.log("PART 2 — overlay reappears on reload (still incomplete):", overlayReappears);

    // Complete → reload → absent.
    await page.getByRole("button", { name: "Done — skip the rest" }).click();
    await page.waitForTimeout(500);
    await page.reload();
    await page.waitForSelector(".lf-topbar", { timeout: 15_000 });
    const overlayAfterComplete = await page.locator(".lf-firstrun__card").count();
    console.log("PART 2 — after complete + reload, overlay present?:", overlayAfterComplete);
    expect(overlayAfterComplete, "overlay must not reappear after completion").toBe(0);

    console.log("\n===== CONSOLE ERRORS (" + consoleErrors.length + ") =====\n" + (consoleErrors.join("\n") || "(none)") + "\n===== END =====\n");
  });
});

import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

// ⚠ DEV-ONLY smoke (see playwright.smoke.config.ts). Telemetry/observation only — this is
// NOT the acceptance walk. Assumes the dev DB was reset (settings cleared, pin_hash NULL)
// and both dev servers are live. Captures console errors across the whole run.

const ART = "e2e/smoke/artifacts";
mkdirSync(ART, { recursive: true });

const consoleErrors: string[] = [];

test.describe.serial("first-run pre-pass", () => {
  test("drive the overlay + capture telemetry", async ({ page }) => {
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(`[console] ${m.text()}`);
    });
    page.on("pageerror", (e) => consoleErrors.push(`[pageerror] ${e.message}`));

    // --- PART 1: FRESH STATE — overlay auto-opens on cold load -------------------
    await page.goto("/");
    const card = page.locator(".lf-firstrun__card");
    await expect(card, "overlay auto-opens on fresh cold load").toBeVisible({ timeout: 15_000 });
    // Not locked (no PIN) — the LockScreen must not be present.
    expect(await page.locator(".lf-lock").count(), "no lock gate on a no-PIN instance").toBe(0);

    // Verbatim rendered copy (whole card).
    const verbatim = (await card.innerText()).trim();
    console.log("\n===== PART 1: VERBATIM OVERLAY COPY =====\n" + verbatim + "\n===== END =====\n");

    // Exact pre-filled default values, as displayed.
    const baseCcy = await page.getByRole("combobox", { name: "Base currency" }).inputValue();
    const tz = await page.getByRole("combobox", { name: "Timezone" }).inputValue();
    const provider = await page.getByRole("combobox", { name: "Data provider" }).inputValue();
    const noEgress = await page.getByRole("switch", { name: "No egress" }).getAttribute("aria-checked");
    console.log("PRE-FILLED DEFAULTS:", JSON.stringify({ baseCcy, tz, provider, noEgress }));

    // --- PART 4: BOUNDARY — 4-digit PIN --------------------------------------------
    const pinField = page.getByLabel("PIN");
    await pinField.fill("1234");
    const setPin = page.getByRole("button", { name: "Set PIN" });
    const disabledAt4 = await setPin.isDisabled();
    const errorTextAt4 = await page.locator(".lf-firstrun__step .lf-lock__error, [role='alert']").count();
    console.log("PART 4 — 4-digit PIN:", JSON.stringify({ setPinDisabled: disabledAt4, explicitErrorElements: errorTextAt4 }));
    await expect(card, "overlay state intact after a short PIN").toBeVisible();
    await pinField.fill("");

    // --- PART 3 (interplay): enable no-egress, read the provider step's note --------
    await page.getByRole("switch", { name: "No egress" }).click();
    const providerNote = (await page.locator(".lf-firstrun__step").filter({ hasText: "Data provider" }).locator(".lf-firstrun__step-note").innerText()).trim();
    console.log("PART 3 — provider interplay copy (no-egress ON):", JSON.stringify(providerNote));

    // --- PART 3 (captures): four screenshots ---------------------------------------
    const shots: string[] = [];
    for (const [w, theme] of [[320, "light"], [320, "dark"], [1440, "light"], [1440, "dark"]] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize({ width: w, height: 900 });
      await page.reload();
      await expect(page.locator(".lf-firstrun__card")).toBeVisible({ timeout: 15_000 });
      const path = `${ART}/first-run-${w}-${theme}.png`;
      await page.screenshot({ path, fullPage: false });
      shots.push(path);
    }
    console.log("SCREENSHOTS:", JSON.stringify(shots));

    // --- PART 2: STATE & LINKS -----------------------------------------------------
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: "light" });
    await page.reload();
    await expect(page.locator(".lf-firstrun__card")).toBeVisible();

    // Valid writes.
    await page.getByRole("combobox", { name: "Base currency" }).selectOption({ index: 1 });
    const ccyWritten = await page.getByRole("combobox", { name: "Base currency" }).inputValue();

    // FINDING: the Timezone Combobox menu is portaled to <body> at z-index 50, BELOW the
    // overlay (z-index 55) — so inside the overlay the dropdown renders behind the scrim
    // and its options are un-clickable. Observe + record; do NOT drive the tz write here.
    const tzInput = page.getByRole("combobox", { name: "Timezone" });
    await tzInput.click();
    await tzInput.fill("London");
    const opt = page.getByRole("option", { name: "Europe/London" }).first();
    const optBox = await opt.boundingBox();
    const occluded =
      optBox === null
        ? "no-menu"
        : await page.evaluate(
            ({ x, y }) => {
              const el = document.elementFromPoint(x, y);
              return el ? `${el.className || el.tagName}` : "none";
            },
            { x: optBox.x + optBox.width / 2, y: optBox.y + optBox.height / 2 },
          );
    console.log("PART 2 — timezone combobox option top element at its centre:", JSON.stringify(occluded));
    await page.keyboard.press("Escape"); // close the (occluded) menu

    await page.getByRole("combobox", { name: "Data provider" }).selectOption("yahoo");
    // no-egress is already ON from Part 3; leave it ON. (PIN set later — a mid-checklist
    // PIN triggers the lock on reload, F-7, so persist is checked BEFORE it.)
    await page.keyboard.press("Escape");

    // Persist check (no PIN yet → no lock): reload → overlay reopens with written values.
    await page.reload();
    await expect(page.locator(".lf-firstrun__card")).toBeVisible({ timeout: 15_000 });
    const ccyAfterReload = await page.getByRole("combobox", { name: "Base currency" }).inputValue();
    const providerAfterReload = await page.getByRole("combobox", { name: "Data provider" }).inputValue();
    const noEgressAfterReload = await page.getByRole("switch", { name: "No egress" }).getAttribute("aria-checked");
    console.log("PART 2 — persisted after reload:", JSON.stringify({ ccyWritten, ccyAfterReload, providerAfterReload, noEgressAfterReload }));

    // Skip one step (timezone) — internal UI state, no write.
    await page.locator(".lf-firstrun__step").filter({ hasText: "Timezone" }).getByRole("button", { name: "Skip" }).click();
    const tzSkippedText = await page.locator(".lf-firstrun__step").filter({ hasText: "Timezone" }).innerText();
    console.log("PART 2 — timezone step after Skip contains 'skipped'?:", /skipped/.test(tzSkippedText));

    // "More options" links → NotBuilt fallback (observe overlay behaviour on nav).
    await page.getByRole("link", { name: "More options →" }).first().click();
    await page.waitForTimeout(400);
    const notBuiltPresent = await page.getByText(/isn't built yet/).count();
    const overlayStillUp = await page.locator(".lf-firstrun__card").count();
    console.log("PART 2 — link → NotBuilt:", JSON.stringify({ notBuiltPresent, overlayStillCoveringScreen: overlayStillUp }));

    // Complete (no PIN set, so no lock interferes) → reload → overlay absent.
    // Navigate back to Home first (the link above moved us to /#/settings).
    await page.goto("/");
    await expect(page.locator(".lf-firstrun__card")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Done — skip the rest" }).click();
    await page.waitForTimeout(500);
    await page.reload();
    await page.waitForSelector(".lf-topbar", { timeout: 15_000 });
    const overlayAfterComplete = await page.locator(".lf-firstrun__card").count();
    console.log("PART 2 — after complete + reload, overlay present?:", overlayAfterComplete);
    expect(overlayAfterComplete, "overlay must not reappear after completion").toBe(0);

    // --- console errors across the whole run ---------------------------------------
    console.log("\n===== CONSOLE ERRORS (" + consoleErrors.length + ") =====\n" + (consoleErrors.join("\n") || "(none)") + "\n===== END =====\n");
  });
});

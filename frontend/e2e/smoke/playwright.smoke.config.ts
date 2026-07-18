import { defineConfig } from "@playwright/test";

// ⚠ DEV-ONLY SMOKE HARNESS — NOT a test suite, NEVER wired into `npm run check` or CI.
// It drives the FIRST-RUN CHECKLIST against a LIVE dev backend (127.0.0.1:8321) +
// frontend (127.0.0.1:5173) and assumes a DESTRUCTIVE reset has been applied to the dev
// DB (settings cleared, pin_hash NULL). Telemetry/observation only; run manually:
//   npx playwright test --config e2e/smoke/playwright.smoke.config.ts
export default defineConfig({
  testDir: ".",
  reporter: [["list"]],
  workers: 1,
  // SMOKE_BASE lets an isolated pre-pass point at a spare-port frontend (§14dr-28 / rule #6).
  use: { baseURL: process.env.SMOKE_BASE ?? "http://127.0.0.1:5173" },
  // No webServer — the dev servers must already be running (dev tool).
});

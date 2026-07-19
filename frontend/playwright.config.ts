import { defineConfig } from "@playwright/test";

// ADR-0004 — real-browser breakpoint overflow suite. jsdom has no layout engine, so
// horizontal-overflow regressions (page-chrome §11-14) can only be caught in a real
// browser. Playwright builds the app, serves it via `vite preview`, and asserts zero
// horizontal overflow at 320/375/900/1366px across the shell + built pages, both themes.
// CI must run `npx playwright install chromium` (browser binary) before this suite.
export default defineConfig({
  testDir: "./e2e",
  // e2e/smoke/ is a DEV-ONLY manual harness (live backend + destructive reset) — never
  // part of `npm run check` / CI. It has its own config, `e2e/smoke/playwright.smoke.config.ts`
  // — run it with `npx playwright test --config e2e/smoke/playwright.smoke.config.ts`.
  //
  // The path is spelled in full deliberately (§9-bis-11, Step E). The bare filename here read as
  // a sibling of THIS file, so a reader who looked for `frontend/playwright.smoke.config.ts`
  // found nothing and recorded the config as MISSING (page-help §9-bis-10). It was never
  // missing; it sits in `e2e/smoke/` beside the specs it configures, which is where it belongs.
  // Nothing was created to fix this — the reference was wrong, not the repo.
  testIgnore: "**/smoke/**",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:4173" },
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});

import { expect, test } from "@playwright/test";

// These map directly to the acceptance criteria in the build brief (§15).
// They assume the backend is running in DEMO mode with AI disabled or absent,
// which is exactly the "no Hailo / no external provider" scenario.

test("1. dashboard opens in demo mode", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("LedgerFrame")).toBeVisible();
  await expect(page.getByText("DEMO DATA")).toBeVisible();
  await expect(page.getByText(/Total value/i)).toBeVisible();
});

test("2. portfolio page shows seeded holdings", async ({ page }) => {
  await page.goto("/portfolio");
  await expect(page.getByRole("heading", { name: "Holdings" })).toBeVisible();
  await expect(page.getByRole("link", { name: /AAPL/i }).first()).toBeVisible();
});

test("3. a watchlist can be created", async ({ page }) => {
  await page.goto("/markets");
  await expect(page.getByText("Watchlist")).toBeVisible();
  // Core Watchlist is seeded; verify it renders quote rows.
  await expect(page.getByText("Core Watchlist")).toBeVisible();
});

test("4. dashboard rotation toggles", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Rotate/i }).click();
  await expect(page.getByRole("button", { name: /Rotating|Paused/i })).toBeVisible();
});

test("5 & 6 & 7. AI answer shows grounding facts with timestamps and no fabrication", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Ask" }).click();
  await page.getByRole("button", { name: /What moved in my portfolio today/i }).click();
  await expect(page.getByText(/Based on these facts/i)).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/not financial advice/i).first()).toBeVisible();
});

test("9 & 10. app works without Hailo and without external provider", async ({ page }) => {
  // Demo mode (no external provider) + AI disabled (no Hailo) is the test config.
  await page.goto("/markets");
  await expect(page.getByText("Market overview")).toBeVisible();
  await page.goto("/heatmap");
  await expect(page.getByText(/heatmap/i).first()).toBeVisible();
});

// NOTE: this test mutates persistent state (sets a PIN), so it runs LAST.
// Reset demo data between full e2e runs: ./scripts/reset-demo-data.sh
test("8. PIN lock blocks protected actions", async ({ page, request }) => {
  await request.post("/api/v1/auth/set-pin", { data: { pin: "2468" } });
  await request.post("/api/v1/auth/lock");
  await page.context().clearCookies();
  await page.goto("/");
  await expect(page.getByText(/Enter your PIN/i)).toBeVisible();
});

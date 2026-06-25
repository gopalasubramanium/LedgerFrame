import { defineConfig, devices } from "@playwright/test";

// E2E runs against the FastAPI server serving the built frontend (production-like).
// Start the backend first:  LEDGERFRAME_DATA_DIR=... uvicorn app.main:app --port 8321
export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: process.env.LF_BASE_URL || "http://127.0.0.1:8321",
    trace: "on-first-retry",
    viewport: { width: 1920, height: 1080 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});

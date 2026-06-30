// Regenerate documentation screenshots against a running demo backend.
//   node scripts/screenshots.mjs              (expects API on :8321)
// Adds a few foreign-currency holdings first so the multi-currency display
// (native ₹/£/¥ price, base-currency value) is visible.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.LF_BASE_URL || "http://127.0.0.1:8321";
const OUT = new URL("../../docs/screenshots/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

async function addTxn(t) {
  await fetch(`${BASE}/api/v1/portfolio/transactions`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(t),
  });
}

const seed = [
  { symbol: "HDFCBANK.BSE", type: "buy", ts: "2024-03-01T10:00:00", quantity: 40, price: 1500, currency: "INR" },
  { symbol: "RELIANCE.NSE", type: "buy", ts: "2024-02-10T10:00:00", quantity: 20, price: 2850, currency: "INR" },
  { symbol: "VOD.L", type: "buy", ts: "2024-01-15T10:00:00", quantity: 300, price: 0.72, currency: "GBP" },
  { symbol: "7203.T", type: "buy", ts: "2024-04-01T10:00:00", quantity: 50, price: 3100, currency: "JPY" },
];

const shots = [
  ["/", "home.png", { full: false }],
  ["/holdings", "holdings.png", { full: true }],
  ["/portfolio", "portfolio.png", { full: true }],
  ["/markets", "markets.png", { full: true }],
  ["/heatmap", "heatmap.png", { full: false }],
  ["/news", "news.png", { full: true }],
  ["/snapshot", "snapshot.png", { full: true }],
  ["/settings", "settings.png", { full: true }],
  ["/legal", "legal.png", { full: true }],
  ["/instrument/HDFCBANK.BSE", "instrument.png", { full: true }],
];

const run = async () => {
  for (const t of seed) await addTxn(t);
  // Warm price-history so Performance / Net-worth / Home sparklines render.
  await fetch(`${BASE}/api/v1/portfolio/performance?days=90&benchmark=SPY`).catch(() => {});
  await fetch(`${BASE}/api/v1/portfolio/performance?days=365&benchmark=SPY&include_manual=true`).catch(() => {});
  await new Promise((r) => setTimeout(r, 800));

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  for (const [path, file, opts] of shots) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: OUT + file, fullPage: opts.full });
    console.log("saved", file);
  }

  // Light theme home
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.evaluate(() => { localStorage.setItem("lf_theme", "light"); document.documentElement.dataset.theme = "light"; });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: OUT + "home-light.png" });
  console.log("saved home-light.png");

  // Mobile home (dark)
  const mob = await browser.newContext({ viewport: { width: 414, height: 896 }, deviceScaleFactor: 2 });
  const mp = await mob.newPage();
  await mp.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await mp.waitForTimeout(1000);
  await mp.screenshot({ path: OUT + "home-mobile.png" });
  console.log("saved home-mobile.png");

  // Mobile settings (verifies the responsive layout — no text overlap)
  await mp.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  await mp.waitForTimeout(800);
  await mp.screenshot({ path: OUT + "settings-mobile.png", fullPage: true });
  console.log("saved settings-mobile.png");

  await browser.close();
};

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

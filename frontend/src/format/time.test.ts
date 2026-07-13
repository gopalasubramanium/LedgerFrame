import { expect, test } from "vitest";
import { relativeDays, relativeTime } from "./time";

// §12rv1-3 — the shared day-granular relative-time copy (owner pick 2026-07-13):
// 0 → "Today", 1 → "1 day ago" (singular), N → "N days ago" (plural).
test("relativeDays pluralizes 0 / 1 / N correctly", () => {
  expect(relativeDays(0)).toBe("Today");
  expect(relativeDays(1)).toBe("1 day ago");
  expect(relativeDays(2)).toBe("2 days ago");
  expect(relativeDays(30)).toBe("30 days ago");
  // Defensive: negatives clamp to Today, fractions round.
  expect(relativeDays(-3)).toBe("Today");
  expect(relativeDays(1.4)).toBe("1 day ago");
});

test("relativeTime routes its day branch through the shared day copy (app-wide consistency)", () => {
  const twoDays = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();
  expect(relativeTime(twoDays)).toBe("2 days ago");
  // Sub-day granularity is unchanged.
  const twoHours = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
  expect(relativeTime(twoHours)).toBe("2h ago");
  expect(relativeTime(null)).toBe("");
});

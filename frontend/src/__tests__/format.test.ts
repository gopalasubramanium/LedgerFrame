import { describe, expect, it } from "vitest";
import { money, pct, signedMoney, toneClass } from "../lib/format";

describe("format helpers", () => {
  it("formats money with currency", () => {
    expect(money(1234.5, "USD")).toContain("1,234.50");
    expect(money(null)).toBe("—");
  });
  it("formats percentages with sign", () => {
    expect(pct(3.2)).toBe("+3.20%");
    expect(pct(-1)).toBe("-1.00%");
    expect(pct(null)).toBe("—");
  });
  it("signs money", () => {
    expect(signedMoney(10, "USD")).toMatch(/^\+/);
  });
  it("tone classes reflect direction", () => {
    expect(toneClass(5)).toBe("text-up");
    expect(toneClass(-5)).toBe("text-down");
    expect(toneClass(0)).toBe("text-muted");
  });
});

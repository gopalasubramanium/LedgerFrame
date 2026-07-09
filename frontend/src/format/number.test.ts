import { expect, test } from "vitest";
import {
  EMDASH,
  formatMoney,
  formatPercent,
  formatPrice,
  formatQuantity,
  formatSignedMoney,
  formatSignedPercent,
  signOf,
} from "./number";

test("money is grouped to 2dp", () => {
  expect(formatMoney("12000000")).toBe("12,000,000.00");
  expect(formatMoney("-1779.87")).toBe("-1,779.87");
});

test("price allows up to 6dp", () => {
  expect(formatPrice("1.2842")).toBe("1.2842");
  expect(formatPrice("94120")).toBe("94,120.00");
});

test("percent shows a trailing %", () => {
  expect(formatPercent("12.5")).toBe("12.50%");
});

test("quantity trims to 8dp", () => {
  expect(formatQuantity("0.75000000")).toBe("0.75");
  expect(formatQuantity("1240", 4)).toBe("1,240.0000");
});

test("missing values render as an em dash, never a fabricated number", () => {
  expect(formatMoney(null)).toBe(EMDASH);
  expect(formatMoney("")).toBe(EMDASH);
  expect(formatPercent(undefined)).toBe(EMDASH);
});

test("signed formatters carry an explicit sign glyph", () => {
  expect(formatSignedMoney("612.40")).toBe("+612.40");
  expect(formatSignedMoney("-1830")).toBe("−1,830.00");
  expect(formatSignedPercent("0")).toBe("0.00%");
});

test("signOf classifies gain/loss/flat", () => {
  expect(signOf("1")).toBe("up");
  expect(signOf("-1")).toBe("down");
  expect(signOf("0")).toBe("flat");
  expect(signOf(null)).toBe("flat");
});

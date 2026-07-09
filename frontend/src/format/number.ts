// Display formatting ONLY. The backend computes every financial value in Decimal
// (PRODUCT-SPEC §4b); the frontend never computes money — it renders the strings
// the backend produced. These helpers group digits and fix decimal places for
// display; they perform no financial arithmetic.
//
// Per-unit decimal places (DESIGN-SYSTEM §1): money 2dp, price 6dp, percent 2dp,
// quantity per-instrument precision. Missing values render as "—" (never a
// fabricated number — Product Guarantee 3).

export const EMDASH = "—";

/** A backend-supplied decimal value: a string, or null/undefined when absent. */
export type DecimalString = string | null | undefined;

function isMissing(value: DecimalString): value is null | undefined | "" {
  return value === null || value === undefined || value === "";
}

function toNumber(value: string): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function formatDecimal(
  value: DecimalString,
  dp: number,
  maxDp?: number,
): string {
  if (isMissing(value)) return EMDASH;
  const n = toNumber(value);
  if (n === null) return EMDASH;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: dp,
    maximumFractionDigits: maxDp ?? dp,
  }).format(n);
}

/** Money: fixed 2dp, grouped. Currency shown separately by the component. */
export function formatMoney(value: DecimalString): string {
  return formatDecimal(value, 2);
}

/** Price/quote: up to 6dp (DESIGN-SYSTEM §1). */
export function formatPrice(value: DecimalString): string {
  return formatDecimal(value, 2, 6);
}

/** Percent: 2dp with a trailing %. Input is the percent value (e.g. "12.5"). */
export function formatPercent(value: DecimalString): string {
  if (isMissing(value)) return EMDASH;
  const body = formatDecimal(value, 2);
  return body === EMDASH ? EMDASH : `${body}%`;
}

/** Share/unit quantity: per-instrument precision (default up to 8dp, trimmed). */
export function formatQuantity(value: DecimalString, precision?: number): string {
  if (precision !== undefined) return formatDecimal(value, precision);
  return formatDecimal(value, 0, 8);
}

/** Sign of a delta for the gain/loss glyph + colour (colour is never sole signal). */
export type Sign = "up" | "down" | "flat";
export function signOf(value: DecimalString): Sign {
  if (isMissing(value)) return "flat";
  const n = toNumber(value);
  if (n === null || n === 0) return "flat";
  return n > 0 ? "up" : "down";
}

/** A signed figure for deltas: explicit + / − prefix (arrow supplied by caller). */
export function formatSignedMoney(value: DecimalString): string {
  if (isMissing(value)) return EMDASH;
  const n = toNumber(value);
  if (n === null) return EMDASH;
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${formatMoney(String(Math.abs(n)))}`;
}

export function formatSignedPercent(value: DecimalString): string {
  if (isMissing(value)) return EMDASH;
  const n = toNumber(value);
  if (n === null) return EMDASH;
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${formatPercent(String(Math.abs(n)))}`;
}

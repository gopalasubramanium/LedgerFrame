// Display formatting helpers. All inputs are already-computed numbers from the API.

// Exchange-suffix -> trading currency (mirrors app/core/symbols.py). Lets the
// transaction form auto-fill the currency when you type e.g. HDFC.BSE.
const SUFFIX_CCY: Record<string, string> = {
  BSE: "INR", NSE: "INR", NS: "INR", BO: "INR",
  L: "GBP", LON: "GBP", IL: "GBP",
  TO: "CAD", V: "CAD", CN: "CAD", NE: "CAD",
  AX: "AUD", NZ: "NZD", HK: "HKD", T: "JPY", TYO: "JPY",
  SS: "CNY", SZ: "CNY", KS: "KRW", KQ: "KRW", TW: "TWD", TWO: "TWD",
  SI: "SGD", SES: "SGD",
  DE: "EUR", F: "EUR", PA: "EUR", AS: "EUR", BR: "EUR", MI: "EUR",
  MC: "EUR", LS: "EUR", VI: "EUR", HE: "EUR", IR: "EUR", AT: "EUR",
  SW: "CHF", VX: "CHF", ST: "SEK", OL: "NOK", CO: "DKK",
  JO: "ZAR", SA: "BRL", MX: "MXN", TA: "ILS", BK: "THB", KL: "MYR", JK: "IDR",
};

export function currencyForSymbol(symbol: string | null | undefined): string | null {
  if (!symbol || !symbol.includes(".")) return null;
  const suffix = symbol.trim().toUpperCase().split(".").pop() || "";
  return SUFFIX_CCY[suffix] ?? null;
}

export function money(value: number | null | undefined, currency = "SGD", compact = false): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
  }).format(value);
}

export function num(value: number | null | undefined, dp = 2): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-SG", { maximumFractionDigits: dp, minimumFractionDigits: dp }).format(value);
}

export function pct(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function signedMoney(value: number | null | undefined, currency = "SGD"): string {
  if (value === null || value === undefined) return "—";
  const sign = value > 0 ? "+" : "";
  return sign + money(value, currency);
}

export function toneClass(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return "text-muted";
  return value > 0 ? "text-up" : "text-down";
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

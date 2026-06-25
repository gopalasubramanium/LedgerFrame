// Display formatting helpers. All inputs are already-computed numbers from the API.

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

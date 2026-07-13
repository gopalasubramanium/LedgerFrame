// Display-only time formatting (relative age). Not money — client formatting is fine here; the
// backend serves ISO timestamps (published_at / generated_at) and the UI renders their age.

/**
 * §12rv1-3 — the ONE day-granular relative-time copy, applied APP-WIDE. Owner pick (2026-07-13):
 * 0 → "Today", 1 → "1 day ago", N → "N days ago". Sub-day ages use `relativeTime` below; every
 * day-level render (the Review "Last reviewed" tile, the NewsList meta line's ≥24h items) routes
 * through here so the wording never diverges between one instance and another.
 */
export function relativeDays(days: number): string {
  const n = Math.max(0, Math.round(days));
  if (n === 0) return "Today";
  return `${n} day${n === 1 ? "" : "s"} ago`;
}

/** Relative age of a served ISO timestamp ("just now", "3h ago", "5 days ago"). Empty for a bad/missing value. */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return relativeDays(h / 24); // day-level copy shared with the Review tile (§12rv1-3)
}

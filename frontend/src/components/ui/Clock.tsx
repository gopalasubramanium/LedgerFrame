import { useEffect, useState } from "react";
import "./chrome.css";

// Global chrome (DESIGN-SYSTEM §5.5, D-066) — PROPOSED 2026-07-11. A timezone clock
// for the top bar; the timezone comes from Settings (D-013), never guessed. Carries
// no figure and no provenance — it is a device clock, not portfolio data. Ticks once
// a minute (seconds are noise on an appliance). Pass a fixed `now` to freeze it
// (tests/specimens) — the live tick is then disabled.
export interface ClockProps {
  /** IANA timezone id from Settings (D-013), e.g. "Asia/Singapore". */
  timezone: string;
  /** Freeze the displayed time (disables the live tick). */
  now?: Date;
}

function formatTime(date: Date, timezone: string): string {
  const opts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", hour12: false };
  try {
    return new Intl.DateTimeFormat(undefined, { timeZone: timezone, ...opts }).format(date);
  } catch {
    // Bad/unknown tz — fall back to the local zone rather than crash the chrome.
    return new Intl.DateTimeFormat(undefined, opts).format(date);
  }
}

// Full date + the IANA timezone name for the tooltip, e.g.
// "Friday, 11 July 2026 · Asia/Singapore".
function fullLabel(date: Date, timezone: string): string {
  try {
    const d = new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(date);
    return `${d} · ${timezone}`;
  } catch {
    return timezone;
  }
}

export function Clock({ timezone, now }: ClockProps) {
  const [tick, setTick] = useState<Date>(now ?? new Date());

  useEffect(() => {
    if (now) return; // frozen
    const id = setInterval(() => setTick(new Date()), 60_000);
    return () => clearInterval(id);
  }, [now]);

  const shown = now ?? tick;
  const full = fullLabel(shown, timezone);
  // Time-only in the bar at all widths (page-chrome batch 2, §11-12); the full date
  // and IANA timezone live in the tooltip / accessible name.
  return (
    <span className="lf-clock" title={full} aria-label={full}>
      {formatTime(shown, timezone)}
    </span>
  );
}

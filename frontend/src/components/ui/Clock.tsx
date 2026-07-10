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

function format(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    // Bad/unknown tz — fall back to the local zone rather than crash the chrome.
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }
}

function shortZone(timezone: string): string {
  const city = timezone.split("/").pop() ?? timezone;
  return city.replace(/_/g, " ");
}

export function Clock({ timezone, now }: ClockProps) {
  const [tick, setTick] = useState<Date>(now ?? new Date());

  useEffect(() => {
    if (now) return; // frozen
    const id = setInterval(() => setTick(new Date()), 60_000);
    return () => clearInterval(id);
  }, [now]);

  const shown = now ?? tick;
  return (
    <span className="lf-clock" aria-label={`Current time, ${shortZone(timezone)}`}>
      <span>{format(shown, timezone)}</span>
      <span className="lf-clock__tz">{shortZone(timezone)}</span>
    </span>
  );
}

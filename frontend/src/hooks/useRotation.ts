import { useCallback, useEffect, useRef, useState } from "react";

// Dashboard rotation engine. Advances through `pages` on an interval, pauses on
// any user interaction (touch/key/mouse) or when `enabled` is false, and resumes
// after `resumeAfterMs` of idle. Supports a locked "focus" page.
export function useRotation(opts: {
  pages: string[];
  intervalMs: number;
  enabled: boolean;
  resumeAfterMs?: number;
  current: string;
  onChange: (page: string) => void;
}) {
  const { pages, intervalMs, enabled, resumeAfterMs = 30000, current, onChange } = opts;
  const [paused, setPaused] = useState(false);
  const idleTimer = useRef<number>();
  const currentRef = useRef(current);
  currentRef.current = current;

  const bump = useCallback(() => {
    setPaused(true);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setPaused(false), resumeAfterMs);
  }, [resumeAfterMs]);

  useEffect(() => {
    if (!enabled) return;
    const events = ["pointerdown", "keydown", "touchstart", "wheel"];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, bump));
  }, [enabled, bump]);

  useEffect(() => {
    if (!enabled || paused || pages.length < 2) return;
    const id = window.setInterval(() => {
      const idx = pages.indexOf(currentRef.current);
      onChange(pages[(idx + 1) % pages.length]);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, paused, pages, intervalMs, onChange]);

  return { paused, pause: () => setPaused(true), resume: () => setPaused(false) };
}

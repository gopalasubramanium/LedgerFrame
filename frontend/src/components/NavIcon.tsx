// Minimal monochrome (currentColor) icons for the sidebar, keyed by route path so
// the collapsed rail stays recognisable. Unknown/future paths get a neutral dot.
const PATHS: Record<string, string> = {
  "/": "M3 10.5 12 3l9 7.5V21H3z",
  "/portfolio": "M21 12a9 9 0 1 1-9-9v9z",
  "/holdings": "M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM8 6V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1",
  "/markets": "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18",
  "/heatmap": "M3 4a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM14 4a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1zM3 15a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM14 15a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1z",
  "/news": "M4 4h16v16H4zM7 8h10M7 12h10M7 16h6",
  "/snapshot": "M3 17l6-6 4 4 8-8M17 7h4v4",
  "/settings": "M4 6h16M4 12h16M4 18h16",
  "/legal": "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6",
};

export function NavIcon({ path, className = "w-5 h-5 shrink-0" }: { path: string; className?: string }) {
  const d = PATHS[path];
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {d ? <path d={d} /> : <circle cx="12" cy="12" r="3" />}
    </svg>
  );
}

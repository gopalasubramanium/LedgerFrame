// Minimal, non-obtrusive credit footer. Concept & direction by the author; built
// with Claude. Stays a thin bar; on small screens it shows icons only.

const LINKS: { label: string; href: string; icon: React.ReactNode }[] = [
  { label: "Website", href: "https://me.sgopala.com", icon: (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 2.5 16 0 18M12 3c-2.5 2.5-2.5 16 0 18"/></svg>
  ) },
  { label: "GitHub", href: "https://github.com/gopalasubramanium", icon: (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M12 .5A11.5 11.5 0 0 0 .5 12 11.5 11.5 0 0 0 8.4 23c.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5z"/></svg>
  ) },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/gopalasubramanium/", icon: (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M20.5 2h-17A1.5 1.5 0 0 0 2 3.5v17A1.5 1.5 0 0 0 3.5 22h17a1.5 1.5 0 0 0 1.5-1.5v-17A1.5 1.5 0 0 0 20.5 2zM8 19H5V9h3v10zM6.5 7.5A1.75 1.75 0 1 1 6.5 4a1.75 1.75 0 0 1 0 3.5zM19 19h-3v-5.3c0-1.3-.5-2.2-1.7-2.2-.9 0-1.4.6-1.7 1.2-.1.2-.1.5-.1.8V19h-3V9h3v1.3c.4-.6 1.1-1.5 2.8-1.5 2 0 3.4 1.3 3.4 4.1V19z"/></svg>
  ) },
  { label: "X", href: "https://x.com/sgopala", icon: (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M18.9 2H22l-7.6 8.7L23 22h-6.8l-5.3-7-6.1 7H1.6l8.1-9.3L1 2h7l4.8 6.4L18.9 2zm-2.4 18h1.9L7.6 4H5.6l10.9 16z"/></svg>
  ) },
  { label: "YouTube", href: "https://www.youtube.com/@sgopala", icon: (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M23 7.5a3 3 0 0 0-2.1-2.1C19 5 12 5 12 5s-7 0-8.9.4A3 3 0 0 0 1 7.5 31 31 0 0 0 .6 12 31 31 0 0 0 1 16.5a3 3 0 0 0 2.1 2.1C5 19 12 19 12 19s7 0 8.9-.4A3 3 0 0 0 23 16.5 31 31 0 0 0 23.4 12 31 31 0 0 0 23 7.5zM9.8 15.3V8.7l5.7 3.3-5.7 3.3z"/></svg>
  ) },
  { label: "Facebook", href: "https://www.facebook.com/gopala.subramanium", icon: (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z"/></svg>
  ) },
  { label: "Support (PayPal)", href: "https://www.paypal.com/donate/?business=gopalasubramanium@gmail.com&item_name=Support%20LedgerFrame&no_recurring=0", icon: (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M7.2 21l.5-3H5.1c-.5 0-.8-.4-.7-.9L6.7 4.3c.1-.5.6-.9 1.1-.9h6.4c2.7 0 4.6 1.4 4.2 4-.5 3.2-2.7 4.6-5.7 4.6H10l-.8 4.9c-.1.6-.6 1-1.2 1H7.2zm4-11.7h1.9c1.4 0 2.4-.6 2.6-1.9.2-1-.4-1.5-1.5-1.5h-1.7l-.5 2.9 -.8 0.5z"/></svg>
  ) },
];

export function Footer() {
  return (
    <footer className="shrink-0 border-t border-line bg-surface/50 px-3 sm:px-6 py-1.5 text-xs text-faint flex items-center justify-between gap-3">
      <span className="truncate">
        <span className="hidden sm:inline">Concept &amp; direction by </span>
        <a href="https://me.sgopala.com" target="_blank" rel="noreferrer" className="hover:text-accent">Gopala Subramanium</a>
        <span className="hidden md:inline"> · built with Claude</span>
      </span>
      <nav className="flex items-center gap-3 shrink-0">
        {LINKS.map((l) => (
          <a key={l.label} href={l.href} target="_blank" rel="noreferrer" title={l.label}
             aria-label={l.label} className="hover:text-accent transition-colors">
            {l.icon}
          </a>
        ))}
      </nav>
    </footer>
  );
}

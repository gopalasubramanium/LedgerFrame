import { useId, useState } from "react";
import type { ReactNode } from "react";
import "./structure.css";
import { lookupTerm } from "../../mocks/glossary";

// Popover linking a shown term to its GLOSSARY entry (DESIGN-SYSTEM §5.4). The
// term spelling must match GLOSSARY exactly (CLAUDE.md hard rule).
export interface GlossaryTermProps {
  /** term-* id into the glossary. */
  term: string;
  children: ReactNode;
}

export function GlossaryTerm({ term, children }: GlossaryTermProps) {
  const entry = lookupTerm(term);
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span
      className="lf-term"
      tabIndex={0}
      role="button"
      aria-describedby={open ? id : undefined}
      aria-label={entry ? `${entry.term} — definition` : undefined}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && entry && (
        <span className="lf-term__pop" id={id} role="tooltip">
          <span className="lf-term__pop-title">{entry.term}</span>
          {entry.definition}
        </span>
      )}
    </span>
  );
}

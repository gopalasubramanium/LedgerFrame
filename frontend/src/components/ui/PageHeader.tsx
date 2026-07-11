import type { ReactNode } from "react";
import "./structure.css";

// Opens every page (DESIGN-SYSTEM §5.4). H1 = nav label = route (D-022). The
// subtitle states the canonical/summary split where relevant (e.g. Portfolio
// "analytics" ↔ Holdings "management", D-023).
export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="lf-pageheader">
      <div className="lf-pageheader__titles">
        <h1 className="lf-pageheader__title">{title}</h1>
        {subtitle && <p className="lf-pageheader__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="lf-pageheader__actions">{actions}</div>}
    </header>
  );
}

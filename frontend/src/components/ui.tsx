import type { ReactNode } from "react";
import { pct, signedMoney, toneClass } from "../lib/format";
import type { Entitlement } from "../lib/types";

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`lf-card flex flex-col ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between mb-3">
          {title && <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">{title}</h2>}
          {action}
        </header>
      )}
      <div className="flex-1 min-h-0">{children}</div>
    </section>
  );
}

export function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-faint mb-1">{label}</div>
      <div className="text-figure tnum text-ink">{children}</div>
    </div>
  );
}

export function ChangePill({ value, currency }: { value: number | null; currency?: string }) {
  return (
    <span className={`lf-chip bg-elevated tnum ${toneClass(value)}`}>
      {currency ? signedMoney(value, currency) : pct(value)}
    </span>
  );
}

const ENTITLEMENT_LABEL: Record<Entitlement, string> = {
  "real-time": "Live",
  delayed: "Delayed",
  "end-of-day": "EOD",
  cached: "Cached",
  unavailable: "No data",
};

export function DataBadge({
  entitlement,
  stale,
  source,
  asOf,
}: {
  entitlement?: Entitlement;
  stale?: boolean;
  source?: string;
  asOf?: string | null;
}) {
  if (stale || entitlement === "cached") {
    return (
      <span className="lf-chip bg-warn/15 text-warn" title={`source: ${source ?? "?"} · ${asOf ?? ""}`}>
        ⚠ Stale{asOf ? ` · ${new Date(asOf).toLocaleTimeString()}` : ""}
      </span>
    );
  }
  if (entitlement === "unavailable") {
    return <span className="lf-chip bg-elevated text-faint">No data</span>;
  }
  return (
    <span className="lf-chip bg-elevated text-muted" title={`source: ${source ?? "?"}`}>
      {entitlement ? ENTITLEMENT_LABEL[entitlement] : "—"}
    </span>
  );
}

export function DemoBadge() {
  return <span className="lf-chip bg-accent/15 text-accent font-semibold">DEMO DATA</span>;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-elevated rounded ${className}`} />;
}

export function Spinner() {
  return (
    <div className="flex items-center gap-2 text-muted text-sm">
      <span className="h-3 w-3 rounded-full border-2 border-faint border-t-accent animate-spin" />
      Loading…
    </div>
  );
}

import "./badges.css";
import type {
  Confidence,
  Entitlement,
  HealthStatus,
  ValuationMethod,
} from "../../mocks/types";

// The ONE standardized badge (DESIGN-SYSTEM §5.3): renders source · freshness ·
// confidence identically on every number that has provenance. Wording per
// GLOSSARY (Source / Entitlement / Status). Fullest detail lives on Pricing
// Health; the same component renders the compact form elsewhere.
export interface ProvenanceBadgeProps {
  source: string;
  entitlement: Entitlement;
  valuationMethod: ValuationMethod;
  confidence: Confidence;
  /** ISO timestamp. */
  asOf: string;
  /** Optional one-word Status chip (GLOSSARY layer 3). */
  status?: HealthStatus;
}

const ENTITLEMENT_LABEL: Record<Entitlement, string> = {
  "real-time": "Real-time",
  delayed: "Delayed",
  "end-of-day": "End-of-day",
  cached: "Cached",
  unavailable: "Unavailable",
};

function asOfLabel(asOf: string): string {
  const d = new Date(asOf);
  return Number.isNaN(d.getTime())
    ? asOf
    : d.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export function ProvenanceBadge({
  source,
  entitlement,
  confidence,
  asOf,
  status,
}: ProvenanceBadgeProps) {
  return (
    <span className="lf-badge" title={`Valued as of ${asOf}`}>
      <span className="lf-badge__seg">
        <span>Source</span>
        <span className="lf-badge__strong">{source}</span>
      </span>
      <span className="lf-badge__seg">
        <span>{status ?? ENTITLEMENT_LABEL[entitlement]}</span>
        <span className="lf-badge__strong">{asOfLabel(asOf)}</span>
      </span>
      <span className="lf-badge__seg">
        <span>Confidence</span>
        <span
          className={`lf-badge__strong lf-badge__conf--${confidence.band}`}
        >
          {confidence.score} · {confidence.band}
        </span>
      </span>
    </span>
  );
}

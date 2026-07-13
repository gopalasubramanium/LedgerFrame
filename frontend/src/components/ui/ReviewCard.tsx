import { ArrowUpRight } from "lucide-react";
import "./structure.css";

// Summary-with-link on Home / Net worth; canonical body on Review (DESIGN-SYSTEM
// §5.4). Enforcement corollary (P-1): shows NO figure the Review page does not.
// It reuses the Review reader's verdicts — it never computes its own.
export type Verdict = "ok" | "attention" | "info";

export interface ReviewSection {
  label: string;
  verdict: Verdict;
  detail?: string;
}

export interface ReviewCardProps {
  sections: ReviewSection[];
  /** Count of items needing attention (from the Review reader). */
  attention: number;
  /** Link to the canonical Review page. */
  link: { href: string; label: string };
}

export function ReviewCard({ sections, attention, link }: ReviewCardProps) {
  return (
    <section className="lf-review" aria-label="Review">
      {/* §12ho2-5: the SAME header anatomy as every other summary tile — title left, trailing meta,
        * ↗ right. This card used to invent its own bar (its own title type, its own attention chip
        * floating beside the link), which is exactly the page-local variant the rule forbids. The
        * attention count is now the header's `meta`. An <a>, not a router Link, so the component
        * stays router-agnostic; `href` is the hash route its callers already pass. */}
      <div className="lf-summaryhead lf-review__head">
        <h2 className="lf-summaryhead__title">Review</h2>
        {attention > 0 && (
          <span className="lf-summaryhead__meta lf-review__attention">
            {attention} need{attention === 1 ? "s" : ""} a look
          </span>
        )}
        <a className="lf-summarylink" data-summarylink href={link.href} aria-label={link.label} title={link.label}>
          <ArrowUpRight className="lf-summarylink__glyph" aria-hidden="true" focusable="false" />
        </a>
      </div>

      {sections.map((s) => (
        <div className="lf-review__section" key={s.label}>
          <span
            className={`lf-review__verdict lf-review__verdict--${s.verdict}`}
            aria-hidden="true"
          />
          <div>
            <div className="lf-review__label">{s.label}</div>
            {s.detail && <div className="lf-review__detail">{s.detail}</div>}
          </div>
        </div>
      ))}

    </section>
  );
}

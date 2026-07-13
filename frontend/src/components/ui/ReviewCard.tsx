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
      <div className="lf-review__head">
        <h2 className="lf-review__title">Review</h2>
        {/* §12ho1-2: the ONE linked-summary affordance — the corner ↗, top-right. (Was a footer text
          * link "Review →", a fourth variant of the same idea.) An <a> rather than a router Link, so
          * the component stays router-agnostic; `href` is the hash route its callers already pass. */}
        <a className="lf-summarylink" data-summarylink href={link.href} aria-label={link.label} title={link.label}>
          <span className="lf-summarylink__glyph" aria-hidden="true">↗</span>
        </a>
        {attention > 0 && (
          <span className="lf-review__attention">
            {attention} need{attention === 1 ? "s" : ""} a look
          </span>
        )}
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
